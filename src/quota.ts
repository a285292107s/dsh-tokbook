/**
 * token-book 的额度计划域：订阅额度 tab 展示的**官方**账户用量。
 *
 * tab 从不从本地账本估算——订阅 key 在所有工具/设备间共享，本机账本无法知道
 * 真实账户花费。两个内置 provider 的官方端点暴露的内容不同：Command Code 报告
 * 真实美元金额；OpenCode Go 只报告百分比 + 重置。wire 类型让金额可选。
 */

import type { QuotaCard, QuotaGate, QuotaPlanInfo, QuotaWindowView } from './types.ts'

export type { QuotaCard, QuotaView, QuotaWindowView } from './types.ts'

// ---------------------------------------------------------------------------
// 内置计划（仅展示身份——无预算、无价格）
// ---------------------------------------------------------------------------

/** 内置 OpenCode Go 计划的 provider route key。 */
export const OPENCODE_GO_PROVIDER = 'opencode-go'

/** 内置 Command Code 计划的 provider route key。 */
export const COMMAND_CODE_PROVIDER = 'commandcode'

export const BUILTIN_PLAN_TITLES: Readonly<Record<string, string>> = {
  [OPENCODE_GO_PROVIDER]: 'OpenCode Go',
  [COMMAND_CODE_PROVIDER]: 'Command Code',
}

/** 已知的 Command Code 订阅计划 id → 展示名（参考 provider 映射的子集）。 */
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

/** 各 provider 读取 API key 的默认环境变量。 */
export const BUILTIN_KEY_ENV: Readonly<Record<string, string>> = {
  [OPENCODE_GO_PROVIDER]: 'OPENCODE_GO_API_KEY',
  [COMMAND_CODE_PROVIDER]: 'COMMANDCODE_API_KEY',
}

/** 最近一次已知窗口点亮侧栏告急点的用量百分比。90 是「你很快会注意到」，
 *  不是「已经死透」——exceeded 是另一回事。 */
export const QUOTA_ALERT_PERCENT = 90

/**
 * 一张官方额度卡是否值得 footer 触发器上持久的告急指示。只计 'ok' 卡：
 * unconfigured/error 卡没有窗口事实，从拉取失败里编出告急会狼来了。
 *
 * 非 `subscription` 卡也永不告急：其窗口不限制账户当前承受的任何限额。
 */
export function isQuotaAlert(card: QuotaCard | null | undefined): boolean {
  if (card === null || card === undefined || card.state !== 'ok') return false
  if (card.gate !== undefined && card.gate !== 'subscription') return false
  return card.windows.some((window) => window.exceeded || window.usagePercent >= QUOTA_ALERT_PERCENT)
}

/**
 * 哪些 provider route 携带官方额度拉取。计划「开启」当 route 已知且未禁用
 * （配置中 `enabled:false`）。key 是否存在在拉取时检查；已启用但无 key 的
 * 计划产出 `unconfigured` 卡。
 */
export function isBuiltinQuotaPlan(provider: string): boolean {
  return provider === OPENCODE_GO_PROVIDER || provider === COMMAND_CODE_PROVIDER
}

/**
 * 订阅额度 tab 的卡片顺序：账户无生效订阅的卡沉到有生效订阅的之下，使 tab
 * 打开在真正还能花的计划上，而不是已退役的那个。
 *
 * 稳定切分，不是排序：`providers` 是宿主的展示顺序（见
 * `QuotaView.providers`），并保持**组内**顺序，因此除降级本身外无任何重排。
 * 还没有已知 gate 的 provider——仍在加载，或最近一次拉取失败——算作 active，
 * 与卡渲染的读法一致（缺席的 gate 意味着 `subscription`）；从缺失数据里猜
 * 「已退役」正是 gate 要防止的错误。
 */
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

// ---------------------------------------------------------------------------
// 用量 gate：此刻约束账户的是什么
// ---------------------------------------------------------------------------

/**
 * 无歧义地表示生效中计划的订阅状态。其他一切按计费周期而非按名字判定：provider
 * 自己文档化的取消流程在周期结束前保留访问权（「保持 active 直到当前计费周期
 * 结束」），因此像 `canceled` 这样的状态词仍可能意味着「生效至 `periodEnd`」。
 * 未知状态词按日期而非硬编码词表判定，也意味着 provider 的新词会降级到日期
 * 规则，而不是错误的卡。
 */
export const QUOTA_IN_FORCE_STATUSES: readonly string[] = ['active', 'trialing']

/**
 * 一个账户的用量被什么约束，由 provider 报告的计划身份
 * （`billing/subscriptions`）推出。完全没有计划身份 = 没有生效订阅的证据——
 * balance 门，这也是按量付费账户的诚实读法（正常、非错误状态：provider 卖
 * 这种）。
 */
export function quotaGate(planInfo: QuotaPlanInfo | undefined, now: number = Date.now()): QuotaGate {
  if (planInfo === undefined) return 'balance'
  const status = planInfo.status?.trim().toLowerCase() ?? ''
  if (QUOTA_IN_FORCE_STATUSES.includes(status)) return 'subscription'
  const periodEnd = planInfo.periodEnd
  if (periodEnd !== undefined && periodEnd !== null && periodEnd > now) return 'subscription'
  return 'balance'
}

/** epoch-ms 时刻的本地 `YYYY-MM-DD`。手写格式（不用 `toLocaleDateString`），
 *  使宿主拼好的句子不受宿主进程 locale 影响。 */
export function dayText(epochMs: number): string {
  const date = new Date(epochMs)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(date.getFullYear())}-${month}-${day}`
}

/**
 * `balance` 门卡上展示的一句话：滚动窗口为何不再描述任何东西，以及现在由什么
 * 约束。说出它所依据的证据——周期结束，或 provider 发来的原始状态词——使卡
 * 从不在空口上断言「已过期」（按量付费账户两者都不报，也不是过期）。
 */
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

// ---------------------------------------------------------------------------
// 归一化助手（原始官方载荷 → wire 形状）
// ---------------------------------------------------------------------------

/** 把服务端百分比夹到 0–100；缺失/非法 → 0。 */
export function clampPercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

/** 从原始 reset 值得到 epoch ms：*距重置的秒数*、毫秒数，或 ISO 日期。
 *  缺席/非法时为 null。 */
export function resetEpoch(value: unknown, now: number = Date.now()): number | null {
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  // 启发式：落在合理*秒级倒计时*范围内的值（< 2^32 且远「于以 ms 表示的 now」）
  // 视为倒计时。
  if (value > 0 && value < 4_294_967_296 && Math.abs(value - now) > 4_294_967_296) {
    return now + value * 1000
  }
  return value
}

/** 从原始 `{used, cap, exceeded, resetAt}` 块（Command Code 形状）构建一行窗口。
 *  金额是真实美元。 */
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

/** 从 OpenCode Go 形状构建一行窗口——真实端点
 *  `{status, percent, resetsAt}`（百分比 + ISO 重置串；无金额）。兼容旧的内部
 *  写法 `{status, usagePercent, resetInSec}`，形状变更不会清空卡片。`ok` 以外
 *  的 status 意味着窗口已限流/耗尽。 */
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

/** 归一 Command Code `billing/subscriptions` 计划节点。 */
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

/** 原始额度卡可用（有窗口/数据）当且仅当官方拉取返回了值得展示的东西。 */
export function hasQuotaContent(card: QuotaCard): boolean {
  return card.windows.length > 0
    || card.planInfo !== undefined
    || card.usage !== undefined
    || card.credits !== undefined
    || card.account !== undefined
}

/** 为内置计划构建 `unconfigured` 卡（未找到 API key）。 */
export function unconfiguredCard(provider: string, hint?: string): QuotaCard {
  return {
    plan: provider,
    title: BUILTIN_PLAN_TITLES[provider] ?? provider,
    state: 'unconfigured',
    message: hint ?? '未找到该订阅的 API key（可配置 apiKey / apiKeyEnv / authFile，或登录官方 CLI）。',
    windows: [],
  }
}

/** 为内置计划构建 `error` 卡（官方拉取失败）。 */
export function errorCard(provider: string, reason: string): QuotaCard {
  return {
    plan: provider,
    title: BUILTIN_PLAN_TITLES[provider] ?? provider,
    state: 'error',
    message: reason,
    windows: [],
  }
}

/**
 * 为 provider **已回答**、但答案是「没有生效订阅，且此端点也无可报告余额」的
 * 账户构建 `ok` 卡——OpenCode Go 的 403，端点自身参考将其读作「有效 key、无
 * Go 订阅」（区别于 401 认证失败）。
 *
 * 刻意 `state: 'ok'`：什么都没失败，标成「查询失败」会教用户调试错方向。缺陷
 * 移到 `gate: 'none'`——正是它阻止渲染方展示仪表，并把卡挡在自动刷新循环与
 * 告急点之外。卡完全不带窗口——这里没有可画的约束，编一个 0% 会读作「还剩
 * 很多」。
 */
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
