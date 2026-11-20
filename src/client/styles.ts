import { CSS_TOKENS } from './styles/tokens.ts'
import { CSS_PAGE } from './styles/page.ts'
import { CSS_GRID } from './styles/grid.ts'
import { CSS_LEDGER } from './styles/ledger.ts'
import { CSS_METHOD } from './styles/method.ts'
import { CSS_PROVIDER } from './styles/provider.ts'
import { CSS_SESSION } from './styles/session.ts'
import { CSS_QUOTA } from './styles/quota.ts'
import { CSS_PRICING } from './styles/pricing.ts'
import { CSS_SHARED } from './styles/shared.ts'

const CSS = [
  CSS_TOKENS,
  CSS_PAGE,
  CSS_GRID,
  CSS_LEDGER,
  CSS_METHOD,
  CSS_PROVIDER,
  CSS_SESSION,
  CSS_QUOTA,
  CSS_PRICING,
  CSS_SHARED,
].join('')

let active = false

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
