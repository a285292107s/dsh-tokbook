/**
 * 价格表读写面的币种换算——纯逻辑、无 React，进 smoke。
 *
 * 文件里的价**永远是人民币/百万词元**；美元只是一个**透镜**：显示时 `¥ / 汇率`，
 * 录入时 `$ × 汇率`。所以草稿、行签名、保存 body 全部与币种无关——切币种的唯一
 * 后果是这一屏的读数字符变了个样，任何一行都不会因此变脏或被重写。
 *
 * 汇率来自价文件保留键 `$fx`（手填、不联网）。缺席 = 美元面不可用：没有汇率就
 * 换算不了，这不是「按 1 算」，所以 `isUsd` 为假、开关停用（见 `PricingPanel`）。
 */

/** 价格表读写面的两种货币。目前只有这两种。 */
export type Currency = 'CNY' | 'USD'

/** 一份价在读写面上所用的货币。`cnyPerUsd` 为 null = 汇率未设（只能读人民币）。 */
export interface MoneyView {
  currency: Currency
  cnyPerUsd: number | null
}

/** 人民币面：恒等换算，也是默认。 */
export const CNY_VIEW: MoneyView = { currency: 'CNY', cnyPerUsd: null }

/**
 * 换算精度：显示与落盘共用 6 位小数（1e-6 元/百万词元，远小于计价需要的分辨率）。
 * 落盘那一步必须取整，否则浮点噪声会写进文件（0.28 × 7.15 = 2.0020000000000002）。
 */
const DECIMALS = 6

/** 6 位小数把**非零**的极小价压成 0 时再放开几位——显示成 0 会是个谎（缓存档那种价）。 */
const TINY_DECIMALS = 10

/** 非负有限数的读法，四档价与汇率共用（币种无关）。空 / 非法 / 负数 → null。 */
export function parseAmount(text: string): number | null {
  const raw = text.trim()
  if (raw === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/** 定点显示：去尾零、**不用指数记法**（`1.4e-8` 那种字面量塞进 80px 的格子里既读不出也写不回）。 */
function fixed(value: number, decimals: number): string {
  const text = value.toFixed(decimals)
  return text.includes('.') ? text.replace(/0+$/u, '').replace(/\.$/u, '') : text
}

/** 美元面显示：小数位由「看起来是不是 0」定，而不是由数字大小定。 */
function usdText(usd: number): string {
  const six = fixed(usd, DECIMALS)
  return six === '0' && usd !== 0 ? fixed(usd, TINY_DECIMALS) : six
}

/** 这一屏是不是按美元读写价：选了美元**且**有可用汇率。 */
export function isUsd(view: MoneyView): boolean {
  return view.currency === 'USD' && view.cnyPerUsd !== null && view.cnyPerUsd > 0
}

/** 人民币文本 → 当前货币的显示文本。人民币面恒等；不可解析的原文原样返回（它本来就红着）。 */
export function textOf(view: MoneyView, cnyText: string): string {
  if (!isUsd(view)) return cnyText
  const cny = parseAmount(cnyText)
  if (cny === null) return cnyText
  return usdText(cny / (view.cnyPerUsd as number))
}

/** 用户在这一货币下敲的文本 → 落盘的人民币文本；不可解析时 null（调用方保留原文并报错）。
 *  人民币面恒等——含空串与非法文本，与今天的行为逐字一致。空串 = 这一档未填（不是 0）。 */
export function storedText(view: MoneyView, typed: string): string | null {
  if (!isUsd(view)) return typed
  const raw = typed.trim()
  if (raw === '') return ''
  const amount = parseAmount(raw)
  if (amount === null) return null
  const cny = amount * (view.cnyPerUsd as number)
  // 与显示同一处保底：正的美元价绝不能被落成 ¥0（¥0 是「免费」，一个已知价）。
  const six = fixed(cny, DECIMALS)
  return six === '0' && cny !== 0 ? fixed(cny, TINY_DECIMALS) : six
}

/** 这一档在 tooltip 里报的单位。 */
export function unitOf(view: MoneyView): string {
  return isUsd(view) ? '$/百万词元' : '¥/百万词元'
}

/** 美元面：把「这个数换算自哪个人人民币数」附进提示——显示是透镜这件事随手可核，
 *  也顺手解决「极小价被舍成 0」的可信问题。人民币面（或原文不是数）没有可附的。 */
export function originOf(view: MoneyView, cnyText: string): string | null {
  if (!isUsd(view)) return null
  const cny = parseAmount(cnyText)
  return cny === null ? null : `= ¥${cnyText.trim()}/百万词元`
}

/** 汇率行右边那句反向读数：`¥1 ≈ $0.14`。汇率未设时无可说。 */
export function inverseHint(view: MoneyView): string | null {
  const rate = view.cnyPerUsd
  if (rate === null || !(rate > 0)) return null
  return `¥1 ≈ $${fixed(1 / rate, 4)}`
}
