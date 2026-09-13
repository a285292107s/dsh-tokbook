/**
 * 历史同步：重放持久化的会话日志，append 账本尚未持有的请求行，按
 * request-id 去重。安装后首次启动自动跑一次；之后在概览读时，对新鲜度探针报
 * 为 stale 的会话跑。日志 inspect 失败的会话被跳过并计数，绝不使整轮致命。
 *
 * 本 walk 刻意不取消：这是一次短的权威刷新，不接 `AbortSignal` 管道可
 * 避免向持久化后端喂非 signal。
 *
 * @module dsh-tokbook/sync
 */

import { isInitialized, markInitialized } from './sync-state.ts'
import { modelOfEvent, providerOfEvent, recordOfEvent, type SessionEventLike } from './usage-record.ts'
import type { UsageLog } from './usage-log.ts'

/** 一轮同步的结果。 */
export interface SyncResult {
  /** append 进日志的行数。 */
  added: number
  /** 日志里已有的请求（已去重）。 */
  skipped: number
  failedSessions: number
}

/** 长同步的一次进度 tick，转发给卡片，使用户能看到手动扫描走到哪。 */
export interface SyncProgressTick {
  processed: number
  total: number
  added: number
  skipped: number
  failedSessions: number
}

/**
 * 同步读到的会话列表项：不可变 header，外加（后端有则）廉价变更 token
 * （revision 相等 = 日志未变）。`revision` 可选——`listSnapshots()` 提供，
 * 裸 `list()` 回落没有（届时每个会话都算 stale）。header 的 `cwd` 一并
 * 带上，概览的按工作区一节用它 join 账本。
 */
export interface PersistenceSnapshotLike {
  header: { id: string; cwd?: string }
  revision?: unknown
}

/**
 * 同步所需的持久化面（为测试鸭子类型），对齐当前 DSH `SessionPersistence`
 * 服务：会话经 `listSnapshots()` 列出（每个已物化会话一个 header + opaque
 * revision；裸 header 的 `list()` 可作回落），经 `inspect(id)` 读该会话的
 * 校验后逻辑事件日志（`{ meta, events }`）。不透传取消选项。
 */
export interface SyncPersistence {
  listSnapshots?(): Promise<readonly PersistenceSnapshotLike[]>
  list?(): Promise<readonly { id: string }[]>
  inspect(id: string): Promise<{ meta: { id: string }; events: readonly SessionEventLike[] }>
}

/** 把一条原始列表项纠错成 snapshot；不带 id 则答 null。同时接受裸
 *  `SessionHeader` 与 `{ header, revision }` snapshot——真实后端的两种形状。 */
function normalizeSnapshot(value: unknown): PersistenceSnapshotLike | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const header = (typeof raw.header === 'object' && raw.header !== null ? raw.header : raw) as Record<string, unknown>
  if (typeof header.id !== 'string' || header.id === '') return null
  return {
    // 只拷本模块声明的两个字段，外来后端无法把非 string `cwd` 走私进
    // 工作区 join。
    header: {
      id: header.id,
      ...(typeof header.cwd === 'string' && header.cwd !== '' ? { cwd: header.cwd } : {}),
    },
    ...(raw.revision !== undefined ? { revision: raw.revision } : {}),
  }
}

/** 列出全部已物化会话为规范化 snapshot。优先 `listSnapshots()`
 *  （廉价变更 token）；回落到裸 header 的 `list()`，届时每个会话默认 stale
 *  （无 revision 可比）。 */
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

/** 一轮同步的依赖。 */
export interface SyncDeps {
  persistence: SyncPersistence
  log: UsageLog
  recordCompaction?: boolean
  onSessionFailure?: (id: string, error: unknown) => void
}

/** 一轮同步的选项。 */
export interface SyncOptions {
  /**
   * 调用方新鲜探针已取好的会话 snapshot。给了就复用，不再列一次；缺省
   * （启动时的一次性回填）由本轮自己列。
   */
  snapshots?: readonly PersistenceSnapshotLike[]
  /**
   * 增量子集：只走这些会话。缺省（或调用方在做首次全量同步）走列出的
   * 全部。每个保留的会话整份日志重读再折叠——request-id 去重使与已记行
   * 的重叠成为空操作。
   */
  sessionIds?: readonly string[]
  /** 转发给调用方进度条的进度 tick。 */
  onTick?: (tick: SyncProgressTick) => void
}

/** append 全部缺失的请求行。日志的去重集合先从数据文件重建（每进程一次），
 *  因此第二轮是空操作。 */
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
    // 一份读不了的会话日志（当前 dsh 拒绝的格式、撕裂文件……）不得中止
    // 整轮 walk：跳过该会话、报出，让其余历史落盘。
    let events: readonly SessionEventLike[]
    try {
      // `inspect` 返回校验过的 header 与该会话的逻辑事件日志；进行中会话
      // 的未关 turn 可能出现在日志中部，在此无害——只有计费调用事件投影行。
      const inspection = await deps.persistence.inspect(id)
      events = inspection.events
    } catch (error) {
      failedSessions += 1
      processed += 1
      deps.onSessionFailure?.(id, error)
      options.onTick?.({ processed, total, added, skipped, failedSessions })
      continue
    }
    // 本会话最近已知的 route model/provider：失败行需要一个 model 来归属，
    // 而 turn/end 不带，所以 walk 跟随与实时记录器相同的 request/context +
    // assistant/message 事件。
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

/** initialized marker 缺席时跑一次性自动同步，然后持久化 marker。同步与
 *  marker 写之间崩溃会使 marker 仍缺席，下次启动重跑同步——因 request-id
 *  去重而是空操作。
 * @returns 同步结果；marker 已在场时为 null。 */
export async function autoSyncIfNeeded(deps: SyncDeps, dir: string): Promise<SyncResult | null> {
  if (await isInitialized(dir)) return null
  const result = await syncHistory(deps)
  await markInitialized(dir)
  return result
}
