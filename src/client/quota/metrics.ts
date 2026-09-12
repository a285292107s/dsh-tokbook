/**
 * Pure rules of the 订阅额度 cards: what each number means and how it reads.
 *
 * No React and no fetch — these are the derivations the card views render
 * (which budget the header ring summarizes, how a monthly allowance becomes a
 * window-shaped row, the tone a used-% maps to) together with the small text
 * builders that belong to them. Split out so the card's arithmetic reads
 * without the component tree around it: `QuotaPanel.tsx` owns the data,
 * `QuotaCard.tsx` owns the markup.
 *
 * @module dsh-tokbook/client/quota/metrics
 */

import type { QuotaCard, QuotaWindowView } from '../../types.ts'

/** What a window bar / gauge may be colored as. */
export type QuotaTone = 'ok' | 'warn' | 'danger'

/** Tone by used percent: green < 60, amber < 85, red beyond. */
export function toneOf(pct: number): QuotaTone {
  if (pct >= 85) return 'danger'
  if (pct >= 60) return 'warn'
  return 'ok'
}

/** Sum of the three credit sources the provider reports — the same
 *  `remainingCredits` the reference implementation derives, and the whole of
 *  what bounds an account with no in-force subscription. */
export function balanceUsd(credits: QuotaCard['credits']): number {
  if (credits === undefined) return 0
  return (credits.monthlyUsd ?? 0) + (credits.purchasedUsd ?? 0) + (credits.freeUsd ?? 0)
}

/** Top-up + free credits: the part of the balance that outlives a plan and
 *  that the provider spends *first* once a rolling window is hit, so it
 *  explains a card whose monthly pool still reads as untouched. */
export function extraCreditsUsd(credits: NonNullable<QuotaCard['credits']>): number {
  return (credits.purchasedUsd ?? 0) + (credits.freeUsd ?? 0)
}

/** Shared math for the Command Code monthly allowance: remaining pool (the
 * provider-reported monthly credits), spent this cycle, and the implied total
 * (remaining + spent). null when the card reports no credit pool. */
function allowanceState(card: QuotaCard): {
  remaining: number
  spent?: number
  total?: number
  percent: number
  tone: QuotaTone
} | null {
  const monthly = card.credits?.monthlyUsd
  if (monthly === undefined) return null
  const remaining = monthly
  const spent = card.usage?.costUsd
  const total = spent !== undefined ? spent + remaining : undefined
  const percent = total !== undefined && total > 0
    ? Math.min(100, Math.max(0, (spent! / total) * 100))
    : 0
  return {
    remaining,
    spent,
    total,
    percent,
    tone: toneOf(percent),
  }
}

/** Command Code's monthly credit pool as a *window-shaped* meter row (id
 * `monthlyAllowance`), appended after the rolling window rows so every
 * budget on the card reads identically: label + used/total on the first
 * line, a tone meter, then remaining $ + reset. Needs a real period spend
 * (`usage.costUsd`) to form the total/percent — when only the remaining pool
 * is reported there is nothing to draw, so the row is omitted. */
export function monthlyAllowanceWindow(card: QuotaCard): QuotaWindowView | null {
  const a = allowanceState(card)
  if (a === null || a.spent === undefined || a.total === undefined) return null
  return {
    id: 'monthlyAllowance',
    label: '本月额度',
    usagePercent: a.percent,
    exceeded: a.percent >= 100,
    resetAt: card.planInfo?.periodEnd ?? null,
    usedUsd: a.spent,
    capUsd: a.total,
  }
}

/** What the header ring summarizes. The ring answers one *fixed* question —
 * how much of the month's budget the account has used — instead of whichever
 * rolling window happens to be tightest. A "worst window" headline made the
 * referent ambiguous (the user could not tell 5 小时 / 本周 / 本月 apart, and
 * the % jumped when a rolling window reset even though nothing was spent).
 *
 * Command Code reports no official monthly window, so its monthly measure is
 * the credit-pool allowance (`allowanceState` — the same 本月额度 the body
 * row draws). OpenCode Go reports an official `monthly` window. Only when a
 * card carries no monthly measure at all does the ring fall back to the
 * tightest rolling window — and `cap` then names that window, so the ring's
 * referent is never implicit. */
export function ringPressure(card: QuotaCard): { pct: number; tone: QuotaTone; cap: string } | undefined {
  // Nothing to be a percentage *of*: a non-subscription card is not under its
  // window limits at all, and the body hides or omits those rows — so a ring
  // drawn from one (or from the fallback below) would summarize a number the
  // card does not show. A balance has no denominator, so it is shown as an
  // amount instead (see QuotaBalanceBody); a `none` card has no number at all.
  if (card.gate !== undefined && card.gate !== 'subscription') return undefined
  const monthly = card.windows.find((w) => w.id === 'monthly')
  if (monthly !== undefined) {
    return { pct: monthly.usagePercent, tone: toneOf(monthly.usagePercent), cap: '本月' }
  }
  const allowance = allowanceState(card)
  if (allowance !== null && allowance.spent !== undefined && allowance.total !== undefined) {
    return { pct: allowance.percent, tone: allowance.tone, cap: '本月' }
  }
  let worst: QuotaWindowView | undefined
  for (const w of card.windows) {
    if (worst === undefined || w.usagePercent > worst.usagePercent) worst = w
  }
  if (worst === undefined) return undefined
  return { pct: worst.usagePercent, tone: toneOf(worst.usagePercent), cap: worst.label }
}

/** "重置" countdown text of one window. */
export function resetLabel(window: QuotaWindowView): string {
  if (window.resetAt === null) return '—'
  const ms = window.resetAt - Date.now()
  if (ms <= 0) return '即将重置'
  const totalMin = Math.ceil(ms / 60_000)
  if (totalMin < 60) return `${totalMin} 分钟后重置`
  const totalHours = Math.ceil(totalMin / 60)
  if (totalHours < 24) return `${totalHours} 小时后重置`
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours > 0 ? `${days} 天 ${hours} 小时后重置` : `${days} 天后重置`
}

/** Account/plan context for the card subtitle (e.g. `user · GOAT`). Billing
 *  resets live on the window rows (Command Code's monthly-allowance meter
 *  shows its own countdown), so the subtitle stays identity-only. */
export function planContext(card: QuotaCard): string {
  const bits: string[] = []
  const account = card.account?.name
  if (account !== undefined && account !== '') bits.push(account)
  const planName = card.planInfo?.name
  if (planName !== undefined && planName !== '') {
    const status = card.planInfo?.status
    bits.push(status !== undefined && status !== 'active' && status !== ''
      ? `${planName}（${status}）`
      : planName)
  }
  const periodEnd = card.planInfo?.periodEnd
  if (card.gate !== 'balance' && card.gate !== 'none'
    && card.credits === undefined
    && periodEnd !== undefined && periodEnd !== null && periodEnd > 0) {
    bits.push(`至 ${new Date(periodEnd).toLocaleDateString()}`)
  }
  return bits.join(' · ')
}

/** USD money format (wire amounts are already USD). */
export function money(value: number): string {
  return `$${value.toFixed(2)}`
}

/** HH:mm of a fetch timestamp, shown next to the card's refresh control. */
export function formatClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
