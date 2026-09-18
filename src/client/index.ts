/**
 * dsh-tokbook client 入口。
 *
 * 路由 A：填入两个已声明的 root-scoped slot（`sidebar.footer.action` + `shell.overlay`），无需改 DSH 本体。
 */

import type { QuotaView } from '../types.ts'
import type { TokBookContext } from './contract.ts'
import { ROUTE_QUOTA } from '../route-paths.ts'
import { createTokBookViewStore, type TokBookViewStore } from './store.ts'
import { FooterButton } from './FooterButton.tsx'
import { LedgerOverlay } from './LedgerOverlay.tsx'

export const inject = ['slots']

/** 浮窗关闭时徽标重读宿主列表的间隔（纯磁盘，不走网络）。 */
const QUOTA_ALERT_POLL_MS = 5 * 60_000

/** 拉取非网络的额度列表并写入 alert 位。失败时保留上一次徽标——宿主抖动不得清除真实的告警。 */
function refreshQuotaAlert(view: TokBookViewStore): Promise<void> {
  return fetch(ROUTE_QUOTA)
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<QuotaView> })
    .then((data) => { view.setQuotaAlert(data.alert === true) })
    .catch(() => undefined)
}

export function apply(ctx: TokBookContext): void {
  // 两个入口共享的 root 级 store（按钮 ↔ 浮窗状态）。
  const view = createTokBookViewStore()

  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'dsh-tokbook',
      order: 100,
      // 宿主只传列状态；数据来自 `inject`。
      inject: () => ({ view }),
    }, FooterButton))

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({
      name: 'shell.overlay',
      id: 'dsh-tokbook',
      order: 200,
      inject: () => ({ view }),
    }, LedgerOverlay))

  // 徽标：加载时刷一次，然后每间隔轮询一次，浮窗关闭后再刷一次（额度 tab 可能强制刷新了快照）。
  void refreshQuotaAlert(view)
  const poll = setInterval(() => { void refreshQuotaAlert(view) }, QUOTA_ALERT_POLL_MS)
  ctx.effect(() => () => { clearInterval(poll) })
  let wasOpen = false
  const unsubscribe = view.subscribe(() => {
    const open = view.getSnapshot().open
    if (wasOpen && !open) void refreshQuotaAlert(view)
    wasOpen = open
  })
  ctx.effect(() => unsubscribe)
}

// 注意：此处**没有** `export default`。cordis loader 做 `exports.default ?? exports`，
// 因此 client plugin 必须以**命名导出**暴露 `inject`/`apply`——default 会遮蔽
// `.inject`，cordis 会读到空的 inject。
