/**
 * 价格表读写面的币种——纯逻辑、无 React，进 smoke。
 *
 * **价文件里每条通道的价用它自己的报价币种记**（`$currency`，缺席 = 人民币）。
 * 所以这一屏的四个格子显示什么、你敲进去的存什么，**都是那个数本身**：没有透镜，
 * 没有「敲美元、落人民币」这一步。换算只发生在两处，都是单向的读：
 *
 * ① **悬停读数**：把这一格折成另一种货币给你看（`counterpartOf`）；
 * ② **切换报价币种**：把这条通道已有的数整体换一种货币记（`convertText`）——
 *    那是一次真正的改价（脏、自动保存），因为文件里那些数字的含义变了。
 *
 * 汇率来自价文件保留键 `$fx`（手填、不联网）。缺席 = 换算不出来：美元通道算不出人民币
 * （计价按价格未知报出），也切不过去——这不是「按 1 算」。
 */

import type { PriceCurrency } from '../../types.ts'

/** 一条通道报价币种的读法。`cnyPerUsd` 为 null = 汇率未设（换算不出来）。 */
export interface MoneyView {
  /** 这条通道的价用什么货币记——四档价格子里的数就是这个单位。 */
  route: PriceCurrency
  cnyPerUsd: number | null
}

/** 人民币报价、未设汇率：这一屏的默认读法。 */
export const CNY_VIEW: MoneyView = { route: 'CNY', cnyPerUsd: null }

/** 显示与换算共用 6 位小数。换算那一步必须取整，否则浮点噪声会写进文件（0.15 × 6.7 = 1.0050000000000001）。 */
const DECIMALS = 6

/** 6 位小数把**非零**的极小价压成 0 时再放开几位——显示成 0 会是个谎（缓存档那种价）。 */
const TINY_DECIMALS = 10

/**
 * 价的写法：十进制，可带小数与指数（`String(1e-7)` 就是 `1e-7`，草稿会原样拿它当文本）。
 * 空串 = 这一档未填（不是 0），由调用方判。**十六进制 / 二进制 / 八进制不收**：
 * `Number('0x10')` 是 16，一个「必须是数字」的格子不该把 `0x10` 读成 16。
 */
const AMOUNT_RE = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u

/** 非负有限数的读法，四档价与汇率共用（币种无关）。空 / 非法 / 负数 → null。 */
export function parseAmount(text: string): number | null {
  const raw = text.trim()
  if (raw === '' || !AMOUNT_RE.test(raw)) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/** 可用的汇率（正数）或 null。 */
export function rateOf(view: MoneyView): number | null {
  const rate = view.cnyPerUsd
  return rate !== null && Number.isFinite(rate) && rate > 0 ? rate : null
}

/** 定点显示：去尾零、**不用指数记法**（`1.4e-8` 那种字面量塞进 80px 的格子里既读不出也写不回）。 */
function fixed(value: number, decimals: number): string {
  const text = value.toFixed(decimals)
  return text.includes('.') ? text.replace(/0+$/u, '').replace(/\.$/u, '') : text
}

function amountText(value: number): string {
  const six = fixed(value, DECIMALS)
  return six === '0' && value !== 0 ? fixed(value, TINY_DECIMALS) : six
}

export function unitOf(view: MoneyView): string {
  return view.route === 'USD' ? '$/百万词元' : '¥/百万词元'
}

/**
 * 同一格折成**另一种**货币的读数，或 null（原文不是数 / 没设汇率）。
 *
 * 美元通道折成人民币是**计入金额的那个数**（`= ¥…`）；人民币通道折成美元只是给你读
 * （`≈ $…`）。留空 = 「换算不出来」，绝不按 1 报一个数。
 */
export function counterpartOf(view: MoneyView, text: string): string | null {
  const amount = parseAmount(text)
  if (amount === null) return null
  const rate = rateOf(view)
  if (rate === null) return null
  return view.route === 'USD'
    ? `= ¥${amountText(amount * rate)}/百万词元`
    : `≈ $${amountText(amount / rate)}/百万词元`
}

/**
 * 把这一格按**另一种货币**重记：切换一条通道的报价币种时，整条通道的价都走这一步。
 * 不可解析的原文原样返回（它本来就红着，换算不了也不该被悄悄抹掉）。
 */
export function convertText(view: MoneyView, text: string, to: PriceCurrency): string | null {
  if (to === view.route) return text
  const raw = text.trim()
  if (raw === '') return ''
  const amount = parseAmount(raw)
  if (amount === null) return null
  const rate = rateOf(view)
  if (rate === null) return null
  return amountText(to === 'USD' ? amount / rate : amount * rate)
}

/** 汇率行右边那句反向读数；汇率未设时为 null。 */
export function inverseHint(cnyPerUsd: number | null): string | null {
  if (cnyPerUsd === null || !(cnyPerUsd > 0)) return null
  return `¥1 ≈ $${fixed(1 / cnyPerUsd, 4)}`
}
