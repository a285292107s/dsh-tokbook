import type { QuotaView } from '../types.ts'
import type { TokBookContext } from './contract.ts'
import { ROUTE_QUOTA } from '../route-paths.ts'
import { createTokBookViewStore, type TokBookViewStore } from './store.ts'
import { injectStyles } from './styles.ts'
import { TokBookPanel } from './TokBookPanel.tsx'
import { TokBookPanelIcon } from './TokBookPanelIcon.tsx'
import { SessionTimingEntry } from './SessionTimingEntry.tsx'
import { SessionTokens } from './SessionTokens.tsx'
import { SessionTokensEntry } from './SessionTokensEntry.tsx'

export const inject = ['slots', 'sidebarRightTabs', 'sidebarRight']

const PANEL_ID = 'tokbook'

const PANEL_ENTRY_ORDER = 30

const TOKENS_TAB_ID = 'dsh-tokbook/tokens'

const TOKENS_TAB_KIND = 'tokbook-tokens'

const TOKENS_ENTRY_ORDER = -4

const TIMING_ENTRY_ORDER = -3

const QUOTA_ALERT_POLL_MS = 5 * 60_000

function refreshQuotaAlert(view: TokBookViewStore): Promise<void> {
  return fetch(ROUTE_QUOTA)
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<QuotaView> })
    .then((data) => { view.setQuotaAlert(data.alert === true) })
    .catch(() => undefined)
}

export function apply(ctx: TokBookContext): void {
  const view = createTokBookViewStore()

  ctx.effect(() => injectStyles())

  ctx.slots.inject('main', () =>
    ctx.slots.register({
      name: 'main',
      key: PANEL_ID,
      inject: () => ({ view }),
    }, TokBookPanel))

  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: PANEL_ENTRY_ORDER,
      label: '词元账本',
      inject: () => ({ view }),
    }, TokBookPanelIcon))

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TOKENS_TAB_ID,
    kind: TOKENS_TAB_KIND,
    title: () => '词元',
  }))

  ctx.slots.inject('sidebar.right.pane.tab', () =>
    ctx.slots.register({
      name: 'sidebar.right.pane.tab',
      key: TOKENS_TAB_ID,
    }, SessionTokens))

  ctx.slots.inject('conversation.session.header.utilities', () =>
    ctx.slots.register({
      name: 'conversation.session.header.utilities',
      id: 'tokbook-tokens',
      order: TOKENS_ENTRY_ORDER,
      inject: () => ({ openTokens: () => { ctx.sidebarRight.openTab(TOKENS_TAB_KIND) } }),
    }, SessionTokensEntry))

  ctx.slots.inject('conversation.session.header.utilities', () =>
    ctx.slots.register({
      name: 'conversation.session.header.utilities',
      id: 'tokbook-timing',
      order: TIMING_ENTRY_ORDER,
      inject: () => ({ openTokens: () => { ctx.sidebarRight.openTab(TOKENS_TAB_KIND) } }),
    }, SessionTimingEntry))

  void refreshQuotaAlert(view)
  const poll = setInterval(() => { void refreshQuotaAlert(view) }, QUOTA_ALERT_POLL_MS)
  ctx.effect(() => () => { clearInterval(poll) })
}
