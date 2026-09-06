/**
 * dsh-tokbook client entry.
 *
 * Route A: fills two declared root-scoped slots, no in-repo DSH change needed.
 *   - `sidebar.footer.action` — the trigger button beside the settings button.
 *   - `shell.overlay` — the floating token-book window (list, additive; the
 *     entry opts into pointer events by rendering an interactive card).
 *
 * @module dsh-tokbook/client
 */

import type { TokBookContext } from './contract.ts'
import { createTokBookViewStore } from './store.ts'
import { FooterButton } from './FooterButton.tsx'
import { LedgerOverlay } from './LedgerOverlay.tsx'

export const inject = ['slots']

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
}

// NOTE: no `export default` here. The cordis loader does `exports.default ?? exports`,
// so a client plugin MUST expose `inject`/`apply` as NAMED exports and not smuggle a
// default — the default would mask `.inject`, and cordis would read an empty inject.
