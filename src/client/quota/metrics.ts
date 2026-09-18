/**
 * 订阅额度卡的纯规则：头部环概括的是哪个预算、月度额度如何变成窗口形行、已用百分比映射到什么色调。
 *
 * 无 React、无 fetch——`QuotaPanel.tsx` 拥有数据，`QuotaCard.tsx` 拥有标记。
 */

import type { QuotaCard, QuotaWindowView } from '../../types.ts'

/** 窗口条 / 仪表可着的色调。 */
export type QuotaTone = 'ok' | 'warn' | 'danger'

/** 已用百分比到色调：绿 < 60，琥珀 < 85，红更远。 */
export function toneOf(pct: number): QuotaTone {
  if (pct >= 85) return 'danger'
  if (pct >= 60) return 'warn'
  return 'ok'
}

/** provider 报告的三个额度来源之和——与参考实现推导的
 *  `remainingCredits` 相同，也是无生效订阅账户的全部约束。 */
export function balanceUsd(credits: QuotaCard['credits']): number {
  if (credits === undefined) return 0
  return (credits.monthlyUsd ?? 0) + (credits.purchasedUsd ?? 0) + (credits.freeUsd ?? 0)
}

/** 充值 + 免费额度：计划过期后仍存活、且在滚动窗口触发时 provider **优先**扣除的那部分余额。 */
export function extraCreditsUsd(credits: NonNullable<QuotaCard['credits']>): number {
  return (credits.purchasedUsd ?? 0) + (credits.freeUsd ?? 0)
}

/** Command Code 月度额度的共享算术：剩余池（provider 报告的月度额度）、
 * 本周期已花、以及隐含总量（剩余 + 已花）。卡未报额度池时为 null。 */
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

/** Command Code 的月度额度池，以**窗口形**的 meter 行呈现（id `monthlyAllowance`）。需要真实的周期已花才能构成总量/百分比——只报了剩余池时无东西可画，故省略该行。 */
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

/** 头部环概括的内容。环回答**固定的**问题——账户用掉了本月预算的多少——而不是恰好最紧的滚动窗口（「最差窗口」标题会让指代模糊）。只有完全没有月度度量时环才回落到最紧的滚动窗口——且 `cap` 随之命名那个窗口。 */
export function ringPressure(card: QuotaCard): { pct: number; tone: QuotaTone; cap: string } | undefined {
  // 非订阅卡不受窗口限额约束，正文隐藏或省略那些行——从其中之一画环会概括一个卡上不显示的数字。余额没有分母，故以金额形式展示。
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

/** 环**没有读数**时写在环里的话（环照旧只画轨道）。槽位空着等于 54px 缩进里什么都没有，
 *  读作「少了东西」；假装一个 0% 的环则是另一句假话。判据是「有没有环」，不是 gate：
 *  有订阅但端点一个窗口都没报的卡同样是「无读数」，绝不能错说成「无订阅」。
 *  「过期」也只在 provider 真的报了一个已经过去的周期终点时才用——端点只说「没有生效中的
 *  订阅」时（按量账户 / 从未订阅 / 欠费），不替它把话升级成「过期」。 */
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

/** 一个窗口的「重置」倒计时文本。 */
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

/** 卡副标题的账户/计划上下文。计费重置住在窗口行上，故副标题只放身份。 */
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

/** USD 金额格式（wire 上的金额已是 USD）。 */
export function money(value: number): string {
  return `$${value.toFixed(2)}`
}

/** 拉取时间戳的 HH:mm，显示在卡的刷新控件旁。 */
export function formatClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
