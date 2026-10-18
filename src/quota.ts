import type { QuotaCard, QuotaGate, QuotaPlanInfo, QuotaWindowView } from './types.ts'

export type { QuotaCard, QuotaView, QuotaWindowView } from './types.ts'

export const OPENCODE_GO_PROVIDER = 'opencode-go'

export const COMMAND_CODE_PROVIDER = 'commandcode'

export const BUILTIN_PLAN_TITLES: Readonly<Record<string, string>> = {
  [OPENCODE_GO_PROVIDER]: 'OpenCode Go',
  [COMMAND_CODE_PROVIDER]: 'Command Code',
}

export const COMMAND_CODE_PLAN_NAMES: Readonly<Record<string, string>> = {
  'individual-go': 'Go',
  'individual-goat': 'GOAT',
  'individual-pro': 'Pro',
  'individual-pro-v1': 'Pro',
  'individual-provider': 'Provider',
  'individual-max': 'Max',
  'individual-ultra': 'Ultra',
  'teams-pro': 'Teams Pro',
}

export const BUILTIN_KEY_ENV: Readonly<Record<string, string>> = {
  [OPENCODE_GO_PROVIDER]: 'OPENCODE_GO_API_KEY',
  [COMMAND_CODE_PROVIDER]: 'COMMANDCODE_API_KEY',
}

export const QUOTA_ALERT_PERCENT = 90

export function isQuotaAlert(card: QuotaCard | null | undefined): boolean {
  if (card === null || card === undefined || card.state !== 'ok') return false
  if (card.gate !== undefined && card.gate !== 'subscription') return false
  return card.windows.some((window) => window.exceeded || window.usagePercent >= QUOTA_ALERT_PERCENT)
}

export function isBuiltinQuotaPlan(provider: string): boolean {
  return provider === OPENCODE_GO_PROVIDER || provider === COMMAND_CODE_PROVIDER
}

export function orderQuotaProviders(
  providers: readonly string[],
  gateOf: (provider: string) => QuotaGate | undefined,
): string[] {
  const active: string[] = []
  const retired: string[] = []
  for (const provider of providers) {
    const gate = gateOf(provider)
    if (gate !== undefined && gate !== 'subscription') retired.push(provider)
    else active.push(provider)
  }
  return [...active, ...retired]
}

export const QUOTA_IN_FORCE_STATUSES: readonly string[] = ['active', 'trialing']

export function quotaGate(planInfo: QuotaPlanInfo | undefined, now: number = Date.now()): QuotaGate {
  if (planInfo === undefined) return 'balance'
  const status = planInfo.status?.trim().toLowerCase() ?? ''
  if (QUOTA_IN_FORCE_STATUSES.includes(status)) return 'subscription'
  const periodEnd = planInfo.periodEnd
  if (periodEnd !== undefined && periodEnd !== null && periodEnd > now) return 'subscription'
  return 'balance'
}

export function dayText(epochMs: number): string {
  const date = new Date(epochMs)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(date.getFullYear())}-${month}-${day}`
}

export function balanceGateNote(planInfo: QuotaPlanInfo | undefined, now: number = Date.now()): string {
  const periodEnd = planInfo?.periodEnd
  if (periodEnd !== undefined && periodEnd !== null && periodEnd > 0 && periodEnd <= now) {
    return `订阅已于 ${dayText(periodEnd)} 结束，现仅由余额决定可用量——5 小时 / 本周窗口只约束订阅内的月度额度，该账户不再适用。`
  }
  const status = planInfo?.status?.trim()
  if (status !== undefined && status !== '') {
    return `官方报告的订阅状态为 ${status}，当前没有生效中的月度额度——该账户由余额决定可用量。`
  }
  return '未检测到生效中的订阅——该账户由余额决定可用量（5 小时 / 本周窗口仅约束订阅内的月度额度）。'
}

export function clampPercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

const RESET_COUNTDOWN_MAX_SEC = 31_536_000

export function resetEpoch(value: unknown, now: number = Date.now()): number | null {
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value > 0 && value <= RESET_COUNTDOWN_MAX_SEC && Math.abs(value - now) > 4_294_967_296) {
    return now + value * 1000
  }
  return value
}

export function windowFromCreditsBlock(
  id: string,
  label: string,
  raw: { used?: unknown; cap?: unknown; exceeded?: unknown; resetAt?: unknown } | undefined,
  now?: number,
): QuotaWindowView {
  const used = typeof raw?.used === 'number' && Number.isFinite(raw.used) ? raw.used : undefined
  const cap = typeof raw?.cap === 'number' && Number.isFinite(raw.cap) ? raw.cap : undefined
  const resetAt = resetEpoch(raw?.resetAt, now)
  const usagePercent = cap !== undefined && cap > 0 && used !== undefined
    ? Math.min(100, Math.max(0, (used / cap) * 100))
    : clampPercent(raw?.exceeded === true ? 100 : undefined)
  return {
    id,
    label,
    usagePercent,
    exceeded: raw?.exceeded === true || usagePercent >= 100,
    resetAt,
    ...(used !== undefined ? { usedUsd: used } : {}),
    ...(cap !== undefined ? { capUsd: cap } : {}),
  }
}

export function windowFromUsagePercent(
  id: string,
  label: string,
  raw: { status?: unknown; percent?: unknown; resetsAt?: unknown; usagePercent?: unknown; resetInSec?: unknown } | undefined,
  now?: number,
): QuotaWindowView {
  const percent = clampPercent(raw?.percent ?? raw?.usagePercent)
  const throttled = typeof raw?.status === 'string' && raw.status !== '' && raw.status !== 'ok'
  const limited = throttled || raw?.status === 'rate-limited'
  return {
    id,
    label,
    usagePercent: limited ? 100 : percent,
    exceeded: limited || percent >= 100,
    resetAt: resetEpoch(raw?.resetsAt ?? raw?.resetInSec, now),
  }
}

export function planInfoFromSubscriptions(raw: { planId?: unknown; status?: unknown; currentPeriodEnd?: unknown } | undefined): QuotaPlanInfo | undefined {
  if (raw === undefined) return undefined
  const planId = typeof raw.planId === 'string' && raw.planId !== '' ? raw.planId : undefined
  const status = typeof raw.status === 'string' && raw.status !== '' ? raw.status : undefined
  const periodEnd = resetEpoch(raw.currentPeriodEnd)
  if (planId === undefined && status === undefined && periodEnd === null) return undefined
  const info: QuotaPlanInfo = {}
  if (planId !== undefined) info.planId = planId
  if (status !== undefined) info.status = status
  if (periodEnd !== null) info.periodEnd = periodEnd
  return info
}

export function hasQuotaContent(card: QuotaCard): boolean {
  return card.windows.length > 0
    || card.planInfo !== undefined
    || card.usage !== undefined
    || card.credits !== undefined
}

export function unconfiguredCard(provider: string, hint?: string): QuotaCard {
  return {
    plan: provider,
    title: BUILTIN_PLAN_TITLES[provider] ?? provider,
    state: 'unconfigured',
    message: hint ?? '未找到该订阅的 API key（可配置 apiKey / apiKeyEnv，或在本机 Models 页填好该通道的 key）。',
    windows: [],
  }
}

export function errorCard(provider: string, reason: string): QuotaCard {
  return {
    plan: provider,
    title: BUILTIN_PLAN_TITLES[provider] ?? provider,
    state: 'error',
    message: reason,
    windows: [],
  }
}

export function noSubscriptionCard(provider: string, note: string, now: number = Date.now()): QuotaCard {
  return {
    plan: provider,
    title: BUILTIN_PLAN_TITLES[provider] ?? provider,
    state: 'ok',
    gate: 'none',
    gateNote: note,
    windows: [],
    fetchedAt: now,
  }
}
