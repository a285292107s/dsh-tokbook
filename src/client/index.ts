/**
 * dsh-tokbook client entry.
 *
 * Route A: fills two declared root-scoped slots, no in-repo DSH change needed.
 *   - `sidebar.footer.action` — the trigger button beside the settings button.
 *   - `shell.overlay` — the floating token-book window (list, additive; the
 *     entry opts into pointer events by rendering an interactive card).
 *
 * Also owns the 告急 badge refresh: a cheap `GET /tokbook/quota` (enabled
 * providers + alert from durable last-known snapshots; never a provider API
 * hit) on apply, every {@link QUOTA_ALERT_POLL_MS}, and after the overlay
 * closes (so a forced refresh on the 订阅额度 tab shows up on the button).
 *
 * @module dsh-tokbook/client
 */

import type { QuotaView } from '../types.ts'
import type { TokBookContext } from './contract.ts'
import { createTokBookViewStore, type TokBookViewStore } from './store.ts'
import { FooterButton } from './FooterButton.tsx'
import { LedgerOverlay } from './LedgerOverlay.tsx'

export const inject = ['slots']

/** How often the closed-window badge re-reads the host list (disk-only). */
const QUOTA_ALERT_POLL_MS = 5 * 60_000

/** Pull the non-network quota list and store its alert bit. Failures leave the
 *  previous badge alone — a flaky host must not clear a real warning. */
function refreshQuotaAlert(view: TokBookViewStore): Promise<void> {
  return fetch('/tokbook/quota')
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<QuotaView> })
    .then((data) => { view.setQuotaAlert(data.alert === true) })
    .catch(() => undefined)
}

export function apply(ctx: TokBookContext): void {
  // One root-scoped store shared by both entries (button ↔ overlay state).
  const view = createTokBookViewStore()

  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'dsh-tokbook',
      order: 100,
      // The owner passes only the column state; our data comes from `inject`.
      inject: () => ({ view }),
    }, FooterButton))

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({
      name: 'shell.overlay',
      id: 'dsh-tokbook',
      order: 200,
      inject: () => ({ view }),
    }, LedgerOverlay))

  // Badge: one shot on load, then a gentle disk-only poll, and again whenever
  // the overlay closes (the quota tab may have force-refreshed snapshots).
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

// NOTE: no `export default` here. The cordis loader does `exports.default ?? exports`,
// so a client plugin MUST expose `inject`/`apply` as NAMED exports and not smuggle a
// default — the default would mask `.inject`, and cordis would read an empty inject.
