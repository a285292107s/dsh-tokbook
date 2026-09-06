/**
 * History sync: replay persisted session logs and append the request rows
 * the ledger does not already hold, deduped by request id. Rows come from
 * `assistant/message` events (plain requests), `compaction/summary` events
 * (the summarize provider calls, unless disabled), `turn/end` events whose
 * reason is an LLM error, and `llm/retry` events. Runs automatically once on
 * the first startup after installation (gated by the initialized marker), and
 * on an overview read for the sessions the freshness probe reports stale
 * (see {@link ../stats.ts|`staleSessionIds`} — after a restart only sessions
 * whose persisted log changed since the recorded baseline). A session whose
 * stored log fails to inspect is skipped and counted, never fatal to the run.
 *
 * This walk is deliberately cancellation-free: it is a short authoritative
 * refresh and dropping `AbortSignal` plumbing keeps us from ever feeding a
 * non-signal into the persistence backend.
 *
 * @module dsh-tokbook/sync
 */

import { isInitialized, markInitialized } from './sync-state.ts'
import { modelOfEvent, providerOfEvent, recordOfEvent, type SessionEventLike } from './usage-record.ts'
import type { UsageLog } from './usage-log.ts'

/** Outcome of one sync run. */
export interface SyncResult {
  /** Rows appended to the log. */
  added: number
  /** Requests already present in the log (deduped). */
  skipped: number
  /** Sessions whose stored log failed to load or validate. */
  failedSessions: number
}

/** One progress tick of a long sync, forwarded to the card so the user can
 * see how far a manual scan has gotten. */
export interface SyncProgressTick {
  processed: number
  total: number
  added: number
  skipped: number
  failedSessions: number
}

/**
 * Per-session listing item as the sync reads it: the immutable header plus,
 * when the backend provides one, a cheap change token (equal revisions mean an
 * unchanged log). `revision` is optional — `listSnapshots()` provides it, a
 * plain `list()` fallback does not (every session then counts as stale).
 */
export interface PersistenceSnapshotLike {
  header: { id: string }
  revision?: unknown
}

/**
 * The persistence surface the sync needs (duck-typed for tests), matching the
 * current DSH `SessionPersistence` service: sessions are listed through
 * `listSnapshots()` (header + opaque revision per materialized session; a
 * plain-header `list()` is accepted as a fallback), and a session's validated
 * logical event log is read through `inspect(id)` (`{ meta, events }`). No
 * cancellation options are passed through.
 */
export interface SyncPersistence {
  listSnapshots?(): Promise<readonly PersistenceSnapshotLike[]>
  list?(): Promise<readonly { id: string }[]>
  inspect(id: string): Promise<{ meta: { id: string }; events: readonly SessionEventLike[] }>
}

/** Coerce one raw listing item into a snapshot, or null when it names no id.
 * Accepts both a bare `SessionHeader` and a `{ header, revision }` snapshot —
 * the two shapes the real backends hand out. */
function normalizeSnapshot(value: unknown): PersistenceSnapshotLike | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const header = (typeof raw.header === 'object' && raw.header !== null ? raw.header : raw) as Record<string, unknown>
  if (typeof header.id !== 'string' || header.id === '') return null
  return {
    header: header as { id: string },
    ...(raw.revision !== undefined ? { revision: raw.revision } : {}),
  }
}

/** List every materialized session as normalized snapshots. Prefers
 * `listSnapshots()` (cheap change tokens); falls back to a bare-header
 * `list()`, where each session defaults to stale (no revision to compare). */
export async function listPersistenceSnapshots(
  persistence: SyncPersistence,
  logger: { error(...args: unknown[]): void } = console,
): Promise<readonly PersistenceSnapshotLike[]> {
  if (typeof persistence.listSnapshots === 'function') {
    try {
      return (await persistence.listSnapshots())
        .map(normalizeSnapshot)
        .filter((snap): snap is PersistenceSnapshotLike => snap !== null)
    } catch (error) {
      logger.error('[tokbook] listSnapshots failed, falling back to list():', error)
    }
  }
  if (typeof persistence.list !== 'function') {
    throw new Error('sessionPersistence exposes neither listSnapshots() nor list()')
  }
  return (await persistence.list())
    .map(normalizeSnapshot)
    .filter((snap): snap is PersistenceSnapshotLike => snap !== null)
}

/** Dependencies of one sync run. */
export interface SyncDeps {
  persistence: SyncPersistence
  log: UsageLog
  recordCompaction?: boolean
  onSessionFailure?: (id: string, error: unknown) => void
}

/** Options of one sync run. */
export interface SyncOptions {
  /**
   * Per-session snapshots already fetched by the caller's freshness probe.
   * When given, the run reuses them instead of listing a second time; when
   * absent (the one-shot startup backfill) the run lists itself.
   */
  snapshots?: readonly PersistenceSnapshotLike[]
  /**
   * Incremental subset: only these sessions are walked. Absent (or when the
   * caller is doing a first full sync) walks every listed session. Each kept
   * session's whole log is re-read and folded — request-id dedupe makes the
   * overlap with already-recorded rows a no-op.
   */
  sessionIds?: readonly string[]
  /** Progress ticks for the caller's progress bar. */
  onTick?: (tick: SyncProgressTick) => void
}

/** Append every missing request row. The log's dedupe set is rebuilt from the
 * data files first (once per process), so a second run is a no-op. */
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
  for (const session of sessions) {
    const id = session.header.id
    // One unreadable session log (a format the current dsh build rejects, a
    // torn file, …) must not abort the whole walk: skip the session, report
    // it, and let the rest of the history land.
    let events: readonly SessionEventLike[]
    try {
      // `inspect` returns the validated header and the session's logical
      // event log; a live session's open turn may appear in the middle of the
      // log, which is harmless here — only billed-call events project rows.
      const inspection = await deps.persistence.inspect(id)
      events = inspection.events
    } catch (error) {
      failedSessions += 1
      processed += 1
      deps.onSessionFailure?.(id, error)
      options.onTick?.({ processed, total, added, skipped, failedSessions })
      continue
    }
    // Last-known route model/provider of this session: failure rows need a
    // model to attribute, and turn/end names none, so the walk follows the
    // same request/context + assistant/message events the live recorder does.
    let model = ''
    let provider: string | undefined
    for (const event of events) {
      const revealedModel = modelOfEvent(event)
      if (revealedModel !== undefined) model = revealedModel
      const revealedProvider = providerOfEvent(event)
      if (revealedProvider !== undefined) provider = revealedProvider
      const record = recordOfEvent(event, id, model, deps.recordCompaction !== false)
      if (record === null) continue
      if (provider !== undefined && record.provider === undefined) record.provider = provider
      if (await deps.log.record(record)) added += 1
      else skipped += 1
    }
    processed += 1
    options.onTick?.({ processed, total, added, skipped, failedSessions })
  }
  return { added, skipped, failedSessions }
}

/** Run the one-shot automatic sync when the initialized marker is absent, then
 * persist the marker. A crash between the sync and the marker write leaves the
 * marker absent, so the next startup re-runs the sync — a no-op thanks to
 * request-id dedupe.
 * @returns the sync outcome, or null when the marker was already present. */
export async function autoSyncIfNeeded(deps: SyncDeps, dir: string): Promise<SyncResult | null> {
  if (await isInitialized(dir)) return null
  const result = await syncHistory(deps)
  await markInitialized(dir)
  return result
}
