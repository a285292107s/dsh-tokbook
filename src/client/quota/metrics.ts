import type { QuotaCard, QuotaWindowView } from '../../types.ts'

export type QuotaTone = 'ok' | 'warn' | 'danger'

export function toneOf(pct: number): QuotaTone {
  if (pct >= 85) return 'danger'
  if (pct >= 60) return 'warn'
  return 'ok'
}

export function balanceUsd(credits: QuotaCard['credits']): number {
  if (credits === undefined) return 0
  return (credits.monthlyUsd ?? 0) + (credits.purchasedUsd ?? 0) + (credits.freeUsd ?? 0)
}

export function extraCreditsUsd(credits: NonNullable<QuotaCard['credits']>): number {
  return (credits.purchasedUsd ?? 0) + (credits.freeUsd ?? 0)
}

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

export function ringPressure(card: QuotaCard): { pct: number; tone: QuotaTone; cap: string } | undefined {
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

export function headStateWord(card: QuotaCard | null): { word: string; alert: boolean } {
  if (card === null) return { word: '—', alert: false }
  if (card.state === 'error') return { word: '失败', alert: true }
  if (card.state === 'unconfigured') return { word: '未配置', alert: false }
  if (card.gate !== undefined && card.gate !== 'subscription') {
    const ended = card.planInfo?.periodEnd
    return ended !== undefined && ended !== null && ended <= Date.now()
      ? { word: '过期', alert: false }
      : { word: '无订阅', alert: false }
  }
  return { word: '无读数', alert: false }
}

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

export function money(value: number): string {
  return `$${value.toFixed(2)}`
}

export function formatClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
