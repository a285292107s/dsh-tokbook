/**
 * dsh-tokbook 各界面共用的一张注入样式表。
 *
 * 取值走 DSH 的 `--dsw-alias-*` token（不写死颜色，插件随皮肤走）；每个 var 都带浅色兜底。片段在 `styles/*.ts`，按该顺序拼接——CSS 级联顺序是契约，不要打乱。中文界面：标签用正常文本，层级靠小号次级字重表达。
 */

// 今日仪表卡的底图。**走 import 而不是 public 目录**：client 半区只有一个产物
// （`lib/client.js`），没有能挂相对 URL 的静态目录，所以 esbuild 把它内联成 data URI，
// 由 `--dtpl-hero-art` 交给 CSS（见 styles/ledger.ts 的 hero 段）。
import heroArt from './assets/hero-yanagi.jpg'

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
import { CSS_DEVICE } from './styles/device.ts'

/**
 * 资产的写法只在这里出现一次：下面的片段引用 token，不各自重复那串 base64。
 *
 * 这一行**不能用模板字符串拼**：上面那段模块注释以星号加斜杠收尾，而模板字符串里的同一对
 * 字符会被解析成注释结束符，把注入的整张样式表在它之前就闭合掉——症状是后面所有规则静默
 * 消失（实测：底图声明只剩注释里的名字，计算值 background-image: none）。普通字符串没有这个坑。
 */
const HERO_ART_VAR = '[data-plugin="dsh-tokbook"]{--dtpl-hero-art:url("' + heroArt + '");}'

const CSS = [
  CSS_TOKENS,
  HERO_ART_VAR,
  CSS_FOOTER,
  CSS_OVERLAY,
  CSS_LEDGER,
  CSS_METHOD,
  CSS_PROVIDER,
  CSS_QUOTA,
  CSS_PRICING,
  CSS_PRICING_TIMELINE,
  CSS_SHARED,
  // 设备皮压轴：只被 `[data-dtpl-device]` 根激活，宿主内整段静默（见 device.ts 文件头）。
  CSS_DEVICE,
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
