import { isInitialized, markInitialized } from './sync-state.ts'
import { modelOfEvent, providerOfEvent, recordOfEvent, type SessionEventLike } from './usage-record.ts'
import type { UsageLog } from './usage-log.ts'

export interface SyncResult {
  added: number
  skipped: number
  failedSessions: number
}

export interface SyncProgressTick {
  processed: number
  total: number
  added: number
  skipped: number
  failedSessions: number
}

export interface PersistenceSnapshotLike {
  header: {
    id: string
    cwd?: string
    parentSession?: string
    origin?: 'subagent'
  }
  revision?: unknown
}

export interface SyncPersistence {
  list?(): Promise<readonly unknown[]>
  listSnapshots?(): Promise<readonly unknown[]>
  inspect?(id: string): Promise<{ meta: { id: string }; events: readonly SessionEventLike[] }>
  open?(id: string, access: 'read'): Promise<SessionHandleLike>
  stat?(id: string): Promise<{ header?: unknown; revision?: unknown } | undefined>
}

export interface SessionHandleLike {
  read(offset?: number, length?: number): Promise<{ events: readonly SessionEventLike[] }>
  close?(): Promise<void>
  inheritedEventCount?: number
}

async function readSessionEvents(persistence: SyncPersistence, id: string): Promise<readonly SessionEventLike[]> {
  if (typeof persistence.inspect === 'function') {
    return (await persistence.inspect(id)).events
  }
  if (typeof persistence.open !== 'function') {
    throw new Error('sessionPersistence exposes neither inspect() nor open()')
  }
  const handle = await persistence.open(id, 'read')
  try {
    const cut = typeof handle.inheritedEventCount === 'number' && handle.inheritedEventCount > 0
      ? handle.inheritedEventCount
      : 0
    return (await handle.read(cut)).events
  } finally {
    await handle.close?.()
  }
}

function normalizeSnapshot(value: unknown): PersistenceSnapshotLike | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const header = (typeof raw.header === 'object' && raw.header !== null ? raw.header : raw) as Record<string, unknown>
  if (typeof header.id !== 'string' || header.id === '') return null
  return {
    header: {
      id: header.id,
      ...(typeof header.cwd === 'string' && header.cwd !== '' ? { cwd: header.cwd } : {}),
      ...(typeof header.parentSession === 'string' && header.parentSession !== ''
        ? { parentSession: header.parentSession } : {}),
      ...(header.origin === 'subagent' ? { origin: header.origin as 'subagent' } : {}),
    },
    ...(raw.revision !== undefined ? { revision: raw.revision } : {}),
  }
}

export async function listPersistenceSnapshots(
  persistence: SyncPersistence,
  logger: { error(...args: unknown[]): void } = console,
): Promise<readonly PersistenceSnapshotLike[]> {
  if (typeof persistence.list === 'function') {
    try {
      return (await persistence.list())
        .map(normalizeSnapshot)
        .filter((snap): snap is PersistenceSnapshotLike => snap !== null)
    } catch (error) {
      logger.error('[tokbook] list() failed, falling back to listSnapshots():', error)
    }
  }
  if (typeof persistence.listSnapshots !== 'function') {
    throw new Error('sessionPersistence exposes neither list() nor listSnapshots()')
  }
  return (await persistence.listSnapshots())
    .map(normalizeSnapshot)
    .filter((snap): snap is PersistenceSnapshotLike => snap !== null)
}

export interface SyncDeps {
  persistence: SyncPersistence
  log: UsageLog
  recordCompaction?: boolean
  onSessionFailure?: (id: string, error: unknown) => void
  logger?: { error(...args: unknown[]): void }
}

export interface SyncOptions {
  snapshots?: readonly PersistenceSnapshotLike[]
  sessionIds?: readonly string[]
  onTick?: (tick: SyncProgressTick) => void
}

export async function syncHistory(
  deps: SyncDeps,
  options: SyncOptions = {},
): Promise<SyncResult> {
  await deps.log.scan()
  const listed = options.snapshots ?? await listPersistenceSnapshots(deps.persistence)
  const wanted = options.sessionIds !== undefined ? new Set(options.sessionIds) : undefined
  const sessions = wanted === undefined
    ? listed
    : listed.filter(session => wanted.has(session.header.id))
  let added = 0
  let skipped = 0
  let failedSessions = 0
  const total = sessions.length
  let processed = 0
  options.onTick?.({ processed, total, added, skipped, failedSessions })
  const logger: { error(...args: unknown[]): void } = deps.logger ?? console
  for (const session of sessions) {
    const id = session.header.id
    let sessionFailed = false
    const fail = (error: unknown): void => {
      if (sessionFailed) return
      sessionFailed = true
      failedSessions += 1
      deps.onSessionFailure?.(id, error)
    }
    try {
      const events = await readSessionEvents(deps.persistence, id)
      let model = ''
      let provider: string | undefined
      for (const event of events) {
        try {
          const revealedModel = modelOfEvent(event)
          if (revealedModel !== undefined) model = revealedModel
          const revealedProvider = providerOfEvent(event)
          if (revealedProvider !== undefined) provider = revealedProvider
          const record = recordOfEvent(event, id, model, deps.recordCompaction !== false)
          if (record === null) continue
          if (provider !== undefined && record.provider === undefined) record.provider = provider
          if (await deps.log.record(record)) added += 1
          else skipped += 1
        } catch (error) {
          logger.error(`[tokbook] cannot fold ${event.type} (seq ${String(event.seq)}) in session ${id}:`, error)
          fail(error)
          continue
        }
      }
    } catch (error) {
      fail(error)
    }
    processed += 1
    options.onTick?.({ processed, total, added, skipped, failedSessions })
  }
  return { added, skipped, failedSessions }
}

export async function autoSyncIfNeeded(deps: SyncDeps, dir: string): Promise<SyncResult | null> {
  if (await isInitialized(dir)) return null
  const result = await syncHistory(deps)
  await markInitialized(dir)
  return result
}
