/**
 * 账本时钟：一个全插件共享的、**极廉价**的「账本变了没有」探针。
 *
 * 为什么需要它：浮窗打开后从不刷新（只有「重新扫描」或关掉重开会重拉），会话词元页则靠
 * 15 s 盲轮询——每一跳都要宿主读账本、再把该会话日志整份读来 join。于是「会话还在跑」
 * 这件事在界面上的表现是：数字要么一直不动，要么每隔十几秒花一次整份日志的钱。
 *
 * 宿主因此端出 `SyncStatusView.ledger`（`src/usage-log.ts` 的目录代数：每落一行 +1）。
 * 它只读内存、不碰盘，所以拿它当探针几乎免费（实测一次 2–6 ms）；订阅者只在**代数真的
 * 变了**之后才去拉自己那份载荷，那才是贵的那一步。
 *
 * 四条边界：
 * - **没有订阅者就不探。** 浮窗关着、词元页不在前台时，这个模块一个请求都不发。
 * - **页面在后台时整个停。** 回到可见立刻补探一次（隐藏期间落下的行不必等下一个周期）。
 * - **只比较相等，不比大小。** `ledger` 是宿主进程内的计数器，重启 / HMR 会归零；跨进程
 *   比较没有意义，同进程内「变了没有」才是订阅者要问的问题。
 * - **读不到 ≠ 没变化。** 宿主不端出这一格（旧 host、HMR 只换了一半）时
 *   {@link ledgerClockSupported} 为 false，订阅者据此保留自己的定时轮询兜底——把「读不到」
 *   当成「什么都没变」会让界面永久冻住。
 */

import type { SyncStatusView } from '../types.ts'
import { ROUTE_SYNC } from '../route-paths.ts'

/** 两次探针之间的间隔。宿主侧只读内存，所以这个数可以远小于任何一份载荷的轮询间隔。 */
const PROBE_MS = 3_000

/** 探针失败后的退避：路由不可用时不至于每 3 s 打一次注定失败的请求。 */
const PROBE_RETRY_MS = 15_000

/**
 * 从「探到变了」到「通知订阅者」之间的合并窗。一轮对话里连着落好几行，订阅者要的是
 * 「现在的账本」而不是每一行的中间态——把一串变化并成一跳，就是把 N 次重载并成一次。
 */
const NOTIFY_DELAY_MS = 400

/** 账本代数；`null` = 还没探到过，或宿主不给这一格。 */
type Ledger = number | null

type Listener = (ledger: Ledger, previous: Ledger) => void

let ledger: Ledger = null
const listeners = new Set<Listener>()
let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<boolean> | null = null
let visibilityBound = false

/** 一次探针。并发调用共享同一趟；失败只保留旧值（网络抖动不得被读成「账本清了」）。
 *  @returns 这一趟是否真的读到了宿主。 */
function probe(): Promise<boolean> {
  if (inflight !== null) return inflight
  const pending = fetch(ROUTE_SYNC)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as Partial<SyncStatusView>
    })
    .then((state) => {
      const previous = ledger
      // `ledger` 缺席（旧宿主）时保留 null：订阅者的「读不到」与「没变化」必须可分。
      ledger = typeof state.ledger === 'number' && Number.isFinite(state.ledger) ? state.ledger : null
      for (const listener of [...listeners]) listener(ledger, previous)
      return true
    })
    .catch(() => {
      // 探针失败不是一次「账本变了」：什么都不通知，等下一次（并退避）。
      return false
    })
    .finally(() => {
      if (inflight === pending) inflight = null
    })
  inflight = pending
  return pending
}

function schedule(delay: number): void {
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    if (listeners.size === 0) return
    if (document.hidden) { schedule(PROBE_MS); return }
    void probe().then((ok) => {
      if (listeners.size > 0) schedule(ok ? PROBE_MS : PROBE_RETRY_MS)
    })
  }, delay)
}

/** 回到可见时补探一次：隐藏期间落下的行不该等下一个周期。 */
function onVisibility(): void {
  if (document.hidden || listeners.size === 0) return
  void probe().then((ok) => {
    if (listeners.size > 0) schedule(ok ? PROBE_MS : PROBE_RETRY_MS)
  })
}

/**
 * 订阅时钟。**订阅时不立刻回调**——订阅者本来就要在挂载时自己拉一份载荷，这里只负责
 * 告诉它「之后又变了」。第一次探到代数时也不算变化：那只是建立基线。
 * @returns 取消订阅（最后一个订阅者走掉时停止轮询）。
 */
function subscribeLedgerClock(listener: Listener): () => void {
  listeners.add(listener)
  if (!visibilityBound) {
    document.addEventListener('visibilitychange', onVisibility)
    visibilityBound = true
  }
  if (listeners.size === 1) {
    // 首个订阅者：立刻探一次建立基线，之后按周期跑。
    void probe().then((ok) => { if (listeners.size > 0) schedule(ok ? PROBE_MS : PROBE_RETRY_MS) })
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
}

/**
 * 订阅「账本又落行了」。回调只在代数**真的变了**、且前一次已经探到过时才触发——首次探到
 * 只是基线。宿主不给 `ledger` 时它永不触发，订阅者应据 {@link ledgerClockSupported}
 * 回落到自己的定时器。
 *
 * 连着几次探到变化会被合并成**一跳**（{@link NOTIFY_DELAY_MS}）：订阅者的响应通常是一次
 * 完整重载，一轮对话里落三行不该造成三次重载。
 */
export function subscribeLedgerChanges(onChange: () => void): () => void {
  let queued = false
  let pending: ReturnType<typeof setTimeout> | null = null
  const unsubscribe = subscribeLedgerClock((next, previous) => {
    if (next === null || previous === null || next === previous) return
    if (queued) return
    queued = true
    pending = setTimeout(() => {
      queued = false
      pending = null
      onChange()
    }, NOTIFY_DELAY_MS)
  })
  return () => {
    if (pending !== null) clearTimeout(pending)
    pending = null
    queued = false
    unsubscribe()
  }
}

/**
 * 宿主是否在端出 `ledger`。`false` = 旧宿主 / 探针从没成功过，调用方应当保留自己的定时
 * 轮询兜底，而不是相信一个永远不触发的订阅。
 */
export function ledgerClockSupported(): boolean {
  return ledger !== null
}
