/**
 * 历史同步：重放持久化的会话日志，append 账本尚未持有的请求行，按
 * request-id 去重。安装后首次启动自动跑一次；之后在概览读时，对新鲜度探针报
 * 为 stale 的会话跑。
 *
 * 本 walk 刻意不取消：这是一次短的权威刷新，不接 `AbortSignal` 管道可
 * 避免向持久化后端喂非 signal。
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
 * （revision 相等 = 日志未变）。`revision` 可选——当前 `list()` 与旧的
 * `listSnapshots()` 都给，更早的裸 header 列表没有（届时每个会话都算 stale）。
 * header 的 `cwd` 一并带上，概览的按工作区一节用它 join 账本；`parentSession` 与
 * `origin` 只带**已声明的**两格血缘（会话词元页的「子代理」一段据它认下级）。
 */
export interface PersistenceSnapshotLike {
  header: {
    id: string
    cwd?: string
    /** fork 血缘（用户手动 fork 的会话也带它），不能单独用来认子代理。 */
    parentSession?: string
    /** 宿主对「这个会话是子代理」的粗分类。 */
    origin?: 'subagent'
  }
  revision?: unknown
}

/**
 * 同步所需的持久化面（为测试鸭子类型），对齐当前 DSH `SessionPersistence`
 * 服务：会话经 `list()` 列出（每会话一个 header + opaque revision），经
 * `open(id, 'read')` 取该会话校验后的逻辑事件日志，`stat(id)` 取单会话的变更令牌。
 * 两个更早的形状仍接受——`listSnapshots()`（列表的旧名）与 `inspect()`（一次返回
 * 整份日志的旧读法），使本包在新旧宿主上读的是同一份数据。不透传取消选项。
 */
export interface SyncPersistence {
  /** 列全部已物化会话：当前形状 `{ header, revision }`，更早的后端回裸 header。 */
  list?(): Promise<readonly unknown[]>
  /** `list()` 的旧名（0.1.7 前的持久化面）。 */
  listSnapshots?(): Promise<readonly unknown[]>
  /** 旧读法：一次返回校验后的整份逻辑日志。 */
  inspect?(id: string): Promise<{ meta: { id: string }; events: readonly SessionEventLike[] }>
  /** 当前读法：开只读句柄。`read` 不取写所有权，故与在写的宿主并行安全。 */
  open?(id: string, access: 'read'): Promise<SessionHandleLike>
  /** 单会话的廉价观察：只回 header 与不透明变更令牌，不读日志。**`revision` 相等即
   *  日志未变**是它的契约——会话词元页按它缓存「整份日志 join 出来的归属与用时」，
   *  没有它就只能每次重读整份日志（见 `session-usage.ts` 的 `sessionJoin`）。 */
  stat?(id: string): Promise<{ header?: unknown; revision?: unknown } | undefined>
}

/** 只读句柄上本模块用到的部分：`read()` 默认从 seq 0 读到日志末尾。
 *  `inheritedEventCount` 是 seeded(fork)会话的父前缀长度：这类会话的存盘日志从
 *  seq 0 就含父会话的历史，「child-owned history starts at inheritedEventCount」。
 *  非 seeded 会话不设该字段；旧宿主也没有。 */
export interface SessionHandleLike {
  read(offset?: number, length?: number): Promise<{ events: readonly SessionEventLike[] }>
  close?(): Promise<void>
  inheritedEventCount?: number
}

/** 读一份会话的逻辑事件日志：优先旧的 `inspect()`，否则开只读句柄读到底再关。
 *  两者都缺席时抛错——调用方只把该会话计一次失败。 */
async function readSessionEvents(persistence: SyncPersistence, id: string): Promise<readonly SessionEventLike[]> {
  if (typeof persistence.inspect === 'function') {
    return (await persistence.inspect(id)).events
  }
  if (typeof persistence.open !== 'function') {
    throw new Error('sessionPersistence exposes neither inspect() nor open()')
  }
  const handle = await persistence.open(id, 'read')
  try {
    // 继承前缀（父会话的历史）不是本会话的计费调用，重折它会让带 sessionId 的
    // 压缩 / 失败行按子会话 id 再落一行，且 append-only 永久留下。
    const cut = typeof handle.inheritedEventCount === 'number' && handle.inheritedEventCount > 0
      ? handle.inheritedEventCount
      : 0
    return (await handle.read(cut)).events
  } finally {
    await handle.close?.()
  }
}

/** 把一条原始列表项纠错成 snapshot；不带 id 的条目答 null（两种真实后端形状，
 *  见 {@link SyncPersistence}）。 */
function normalizeSnapshot(value: unknown): PersistenceSnapshotLike | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const header = (typeof raw.header === 'object' && raw.header !== null ? raw.header : raw) as Record<string, unknown>
  if (typeof header.id !== 'string' || header.id === '') return null
  return {
    // 只拷本模块声明的几个字段，外来后端无法把非 string 值走私进工作区 join /
    // 子代理血缘。
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

/** 列出全部已物化会话为规范化 snapshot（形状与回落顺序见
 *  {@link SyncPersistence}）。没有 revision 的条目默认 stale。 */
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
  /** 单事件折不动时记 error 的去处；缺省 console（与 {@link listPersistenceSnapshots} 同口径）。 */
  logger?: { error(...args: unknown[]): void }
}

export interface SyncOptions {
  /**
   * 调用方新鲜探针已取好的会话 snapshot。给了就复用，不再列一次；缺省
   * （启动时的一次性回填）由本轮自己列。
   */
  snapshots?: readonly PersistenceSnapshotLike[]
  /**
   * 增量子集：只走这些会话。缺省（或调用方在做首次全量同步）走列出的全部。
   * 每个保留的会话整份日志重读再折叠。
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
  const logger: { error(...args: unknown[]): void } = deps.logger ?? console
  for (const session of sessions) {
    const id = session.header.id
    // 每个会话**最多**算一份失败：无论是整份日志读不动，还是它中间某条事件折不动。
    let sessionFailed = false
    const fail = (error: unknown): void => {
      if (sessionFailed) return
      sessionFailed = true
      failedSessions += 1
      deps.onSessionFailure?.(id, error)
    }
    // 一份读不了的会话日志（当前 dsh 拒绝的格式、撕裂文件……）不得中止整轮 walk：
    // 跳过该会话、报出，让其余历史落盘。异常穿出本函数时调用方记 error 而不推进同步
    // 基线，该会话会被每个探针反复重走。
    try {
      // 当前持久化面按句柄读：`read()` 返回校验过的逻辑事件日志；进行中会话
      // 的未关 turn 可能出现在日志中部，在此无害——只有计费调用事件投影行。
      const events = await readSessionEvents(deps.persistence, id)
      // 本会话最近已知的 route model/provider：失败行需要一个 model 来归属，
      // 而 turn/end 不带，所以 walk 跟随与实时记录器相同的 request/context +
      // assistant/message 事件。
      let model = ''
      let provider: string | undefined
      for (const event of events) {
        // try 只包单条事件的投影 + 落盘这两步：一条折不动的事件只作废它自己。包在
        // 整个会话外面会让它之后的所有计费行都折不出来，而调用方从不推进该会话的
        // 同步基线——那份大日志于是每次读都全量重走，尾部还永远补不上。
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
      // 走到这里的只有「整份会话日志读不动」：单事件的投影 / 落盘失败已在上面的
      // 内层 catch 就地兜住，不再穿到这里。
      fail(error)
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
