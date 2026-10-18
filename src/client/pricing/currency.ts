import type { PriceCurrency } from '../../types.ts'

export interface MoneyView {
  route: PriceCurrency
  cnyPerUsd: number | null
}

const DECIMALS = 6

const TINY_DECIMALS = 10

const AMOUNT_RE = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u

export function parseAmount(text: string): number | null {
  const raw = text.trim()
  if (raw === '' || !AMOUNT_RE.test(raw)) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function rateOf(view: MoneyView): number | null {
  const rate = view.cnyPerUsd
  return rate !== null && Number.isFinite(rate) && rate > 0 ? rate : null
}

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

export function counterpartOf(view: MoneyView, text: string): string | null {
  const amount = parseAmount(text)
  if (amount === null) return null
  const rate = rateOf(view)
  if (rate === null) return null
  return view.route === 'USD'
    ? `= ¥${amountText(amount * rate)}/百万词元`
    : `≈ $${amountText(amount / rate)}/百万词元`
}

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

export function inverseHint(cnyPerUsd: number | null): string | null {
  if (cnyPerUsd === null || !(cnyPerUsd > 0)) return null
  return `¥1 ≈ $${fixed(1 / cnyPerUsd, 4)}`
}
