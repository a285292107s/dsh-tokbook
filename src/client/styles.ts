/**
 * dsh-tokbook 各界面共用的一张注入样式表。
 *
 * 取值走 DSH 的 `--dsw-alias-*` token（不写死颜色，插件随皮肤走）；每个 var 都带浅色兜底。片段在 `styles/*.ts`，按该顺序拼接——CSS 级联顺序是契约，不要打乱。中文界面：标签用正常文本，层级靠小号次级字重表达。
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
import { CSS_PRICING_TIMELINE } from './styles/pricing-timeline.ts'
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
  CSS_PRICING_TIMELINE,
  CSS_SHARED,
].join('')

let active = false

/** 注入样式表；返回移除它的 disposer。幂等。 */
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
