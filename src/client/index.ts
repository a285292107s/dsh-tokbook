import type { QuotaView } from '../types.ts'
import type { TokBookContext } from './contract.ts'
import { ROUTE_QUOTA } from '../route-paths.ts'
import { createTokBookViewStore, type TokBookViewStore } from './store.ts'
import { injectStyles } from './styles.ts'
import { FooterButton } from './FooterButton.tsx'
import { LedgerOverlay } from './LedgerOverlay.tsx'
import { SessionTokens } from './SessionTokens.tsx'

export const inject = ['slots']

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

  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'dsh-tokbook',
      order: 100,
      inject: () => ({ view }),
    }, FooterButton))

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({
      name: 'shell.overlay',
      id: 'dsh-tokbook',
      order: 200,
      inject: () => ({ view }),
    }, LedgerOverlay))

  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register({
      name: 'conversation.view',
      id: 'dsh-tokbook-tokens',
      order: 20,
      label: '词元',
      inject: (sessionId) => ({ sessionId }),
    }, SessionTokens))

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
