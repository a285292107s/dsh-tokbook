/**
 * One injected stylesheet for dsh-tokbook's surfaces.
 *
 * Values use DSH `--dsw-alias-*` tokens (no hard-coded colors, so the plugin
 * follows every skin); each var carries a safe light-mode fallback. Dark-mode
 * fallbacks (where translucency alone is not enough) are tuned under
 * `body[data-ds-dark-theme]`, the attribute DSH itself uses for dark skins.
 * Injected once at materialize time and removed by the returned disposer.
 *
 * Fragments live in `styles/*.ts` (tokens / footer / overlay / ledger /
 * method / provider / quota / pricing / shared) and are concatenated in that
 * order — CSS cascade order is part of the contract, do not reshuffle.
 *
 * Chinese UI: labels use normal text (no `text-transform: uppercase`, which is
 * meaningless for CJK) with a small secondary type style for hierarchy.
 *
 * @module dsh-tokbook/client/styles
 */

import { CSS_TOKENS } from './styles/tokens.ts'
import { CSS_FOOTER } from './styles/footer.ts'
import { CSS_OVERLAY } from './styles/overlay.ts'
import { CSS_LEDGER } from './styles/ledger.ts'
import { CSS_METHOD } from './styles/method.ts'
import { CSS_PROVIDER } from './styles/provider.ts'
import { CSS_QUOTA } from './styles/quota.ts'
import { CSS_PRICING } from './styles/pricing.ts'
import { CSS_SHARED } from './styles/shared.ts'

const CSS = [
  CSS_TOKENS,
  CSS_FOOTER,
  CSS_OVERLAY,
  CSS_LEDGER,
  CSS_METHOD,
  CSS_PROVIDER,
  CSS_QUOTA,
  CSS_PRICING,
  CSS_SHARED,
].join('')

let active = false

/** Inject the stylesheet; returns a disposer removing it. Idempotent. */
export function injectStyles(): () => void {
  if (active) return () => {}
  active = true
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)
  return () => {
    style.remove()
    active = false
  }
}
