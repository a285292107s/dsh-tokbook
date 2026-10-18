import type { PlanConfig, QuotaCard, QuotaCreditPool, QuotaUsageSummary } from './types.ts'
import {
  BUILTIN_KEY_ENV, BUILTIN_PLAN_TITLES, COMMAND_CODE_PLAN_NAMES, COMMAND_CODE_PROVIDER, OPENCODE_GO_PROVIDER,
  balanceGateNote, errorCard, hasQuotaContent, noSubscriptionCard, planInfoFromSubscriptions, quotaGate, unconfiguredCard,
  windowFromCreditsBlock, windowFromUsagePercent,
} from './quota.ts'

export interface CredentialResolver {
  resolve(ref: string): Promise<string | undefined>
}

export interface QuotaFetchDeps {
  plan?: PlanConfig
  logger?: { error(...args: unknown[]): void; warn?(...args: unknown[]): void }
  credentials?: CredentialResolver
}

const REQUEST_TIMEOUT_MS = 10_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export async function resolvePlanApiKey(
  provider: string,
  plan: PlanConfig | undefined,
  credentials: CredentialResolver | undefined,
): Promise<string | undefined> {
  const literal = plan?.apiKey
  if (literal !== undefined && literal !== '') return literal
  if (credentials === undefined) return undefined
  const envName = plan?.apiKeyEnv !== undefined && plan.apiKeyEnv !== ''
    ? plan.apiKeyEnv
    : BUILTIN_KEY_ENV[provider]
  if (envName === undefined) return undefined
  try {
    const value = await credentials.resolve(envName)
    if (value !== undefined && value !== '') return value
  } catch {
  }
  return undefined
}

const COMMAND_CODE_API_BASE = 'https://api.commandcode.ai'
const COMMAND_CODE_CLI_VERSION = '1.47.0'

function ccPath(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value)
  }
  const query = search.toString()
  return query === '' ? path : `${path}?${query}`
}

function rawTimestamp(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

async function ccGet(
  path: string,
  key: string,
  logger: QuotaFetchDeps['logger'],
): Promise<Record<string, unknown> | { __httpStatus: number }> {
  try {
    const response = await fetch(`${COMMAND_CODE_API_BASE}${path}`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key}`,
        'x-command-code-version': COMMAND_CODE_CLI_VERSION,
        'x-cli-environment': 'production',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      logger?.warn?.(`[tokbook] commandcode ${path}: HTTP ${response.status}`)
      return { __httpStatus: response.status }
    }
    const parsed: unknown = await response.json()
    return isRecord(parsed) ? parsed : { __httpStatus: 0 }
  } catch (error) {
    logger?.warn?.(`[tokbook] commandcode ${path}:`, error)
    return { __httpStatus: 0 }
  }
}

function isAuthFailure(body: Record<string, unknown> | { __httpStatus: number }): boolean {
  if ('__httpStatus' in body) return body.__httpStatus === 401
  return body.error === 'invalid-key' || body.message === 'Unauthorized'
}

function commandCodePlanName(planId: string): string | undefined {
  const normalized = planId.toLowerCase().replace(/_/g, '-')
  return COMMAND_CODE_PLAN_NAMES[normalized]
}

function attachPlanInfo(card: QuotaCard, raw: Record<string, unknown> | undefined, fallbackPlanId?: string): void {
  const planInfo = planInfoFromSubscriptions(raw ?? {})
    ?? (fallbackPlanId !== undefined ? planInfoFromSubscriptions({ planId: fallbackPlanId }) : undefined)
  if (planInfo === undefined) return
  card.planInfo = planInfo
  const planId = planInfo.planId
  const display = planId !== undefined ? commandCodePlanName(planId) : undefined
  if (planInfo.name !== undefined && planInfo.name !== '') card.title = planInfo.name
  else if (display !== undefined) card.title = display
}

export async function fetchCommandCodeQuota(deps: QuotaFetchDeps = {}): Promise<QuotaCard> {
  const key = await resolvePlanApiKey(COMMAND_CODE_PROVIDER, deps.plan, deps.credentials)
  if (key === undefined) return unconfiguredCard(COMMAND_CODE_PROVIDER)
  const logger = deps.logger

  const whoami = await ccGet('/alpha/whoami', key, logger)
  const whoamiBody = isRecord(whoami) && !('__httpStatus' in whoami) ? whoami : undefined
  const orgId = whoamiBody !== undefined && isRecord(whoamiBody.org) ? str(whoamiBody.org.id) : undefined
  const [credits, subscription] = await Promise.all([
    ccGet(ccPath('/alpha/billing/credits', { orgId }), key, logger),
    ccGet(ccPath('/alpha/billing/subscriptions', { orgId }), key, logger),
  ])
  const subscriptionBody = isRecord(subscription) && !('__httpStatus' in subscription) ? subscription : undefined
  const subscriptionNode = subscriptionBody !== undefined && isRecord(subscriptionBody.data)
    ? subscriptionBody.data
    : subscriptionBody
  const usage = await ccGet(
    ccPath('/alpha/usage/summary', { orgId, since: rawTimestamp(subscriptionNode?.currentPeriodStart) }),
    key,
    logger,
  )

  const bodies = [whoami, usage, credits, subscription]
  if (bodies.every(isAuthFailure)) {
    return errorCard(COMMAND_CODE_PROVIDER, '官方接口拒绝了该 key（401）——请检查 Command Code API key。')
  }

  const card: QuotaCard = {
    plan: COMMAND_CODE_PROVIDER,
    title: BUILTIN_PLAN_TITLES[COMMAND_CODE_PROVIDER]!,
    state: 'ok',
    windows: [],
    fetchedAt: Date.now(),
  }

  if (isRecord(whoami) && !('__httpStatus' in whoami)) {
    const user = isRecord(whoami.user) ? whoami.user : undefined
    const name = str(user?.userName) ?? str(user?.name)
    if (name !== undefined && name !== '') card.account = { name }
  }

  if (isRecord(usage) && !('__httpStatus' in usage)) {
    const summary: QuotaUsageSummary = {}
    const completed = num(usage.completedCount)
    const failed = num(usage.failedCount)
    if (completed !== undefined) summary.completed = completed
    if (failed !== undefined) summary.failed = failed
    const rate = num(usage.successRate)
    if (rate !== undefined) summary.successRate = rate
    const cost = num(usage.totalCost)
    if (cost !== undefined) summary.costUsd = cost
    const tin = num(usage.totalTokensIn)
    const tout = num(usage.totalTokensOut)
    if (tin !== undefined) summary.tokensIn = tin
    if (tout !== undefined) summary.tokensOut = tout
    if (Object.keys(summary).length > 0) card.usage = summary
  }

  let creditsPlanId: string | undefined
  if (isRecord(credits) && !('__httpStatus' in credits)) {
    const creditsNode = isRecord(credits.credits) ? credits.credits : undefined
    creditsPlanId = creditsNode !== undefined ? str(creditsNode.planId) : undefined
    const limits = isRecord(credits.windowLimits) ? credits.windowLimits : undefined
    if (creditsNode !== undefined) {
      const pool: QuotaCreditPool = {}
      const monthly = num(creditsNode.monthlyCredits)
      const purchased = num(creditsNode.purchasedCredits)
      const free = num(creditsNode.freeCredits)
      if (monthly !== undefined) pool.monthlyUsd = monthly
      if (purchased !== undefined) pool.purchasedUsd = purchased
      if (free !== undefined) pool.freeUsd = free
      if (Object.keys(pool).length > 0) card.credits = pool
    }
    const fiveHour = isRecord(limits?.fiveHour) ? limits.fiveHour : undefined
    const weekly = isRecord(limits?.weekly) ? limits.weekly : undefined
    if (fiveHour !== undefined) {
      card.windows.push(windowFromCreditsBlock('fiveHour', '5 小时', fiveHour))
    }
    if (weekly !== undefined) {
      card.windows.push(windowFromCreditsBlock('weekly', '本周', weekly))
    }
  }

  if (subscriptionNode !== undefined) {
    attachPlanInfo(card, subscriptionNode, creditsPlanId)
  } else if (creditsPlanId !== undefined) {
    attachPlanInfo(card, undefined, creditsPlanId)
  }

  if (subscriptionBody !== undefined) {
    card.gate = quotaGate(card.planInfo)
    if (card.gate === 'balance') {
      card.gateNote = balanceGateNote(card.planInfo)
      if (card.credits === undefined) {
        card.gate = 'none'
        card.gateNote = `${card.gateNote}（本次未取到余额，暂无法显示可用量）`
      }
    }
  }

  if (!hasQuotaContent(card)) {
    return errorCard(COMMAND_CODE_PROVIDER, '官方接口未返回可用数据。')
  }
  return card
}

const OPENCODE_GO_USAGE_URL = 'https://opencode.ai/zen/go/v1/usage'

interface GoUsageWindow {
  status?: unknown
  percent?: unknown
  resetsAt?: unknown
  usagePercent?: unknown
  resetInSec?: unknown
}

export function parseOpenCodeGoUsage(body: Record<string, unknown>, now: number = Date.now()): QuotaCard {
  const usage = isRecord(body.usage) ? body.usage : body
  const rolling = isRecord(usage.rolling) ? usage.rolling as GoUsageWindow : undefined
  const weekly = isRecord(usage.weekly) ? usage.weekly as GoUsageWindow : undefined
  const monthly = isRecord(usage.monthly) ? usage.monthly as GoUsageWindow : undefined

  const card: QuotaCard = {
    plan: OPENCODE_GO_PROVIDER,
    title: BUILTIN_PLAN_TITLES[OPENCODE_GO_PROVIDER]!,
    state: 'ok',
    gate: 'subscription',
    windows: [],
    fetchedAt: Date.now(),
  }
  if (rolling !== undefined) card.windows.push(windowFromUsagePercent('rolling5h', '5 小时', rolling, now))
  if (weekly !== undefined) card.windows.push(windowFromUsagePercent('weekly', '本周', weekly, now))
  if (monthly !== undefined) card.windows.push(windowFromUsagePercent('monthly', '本月', monthly, now))
  return card
}

export async function fetchOpenCodeGoQuota(deps: QuotaFetchDeps = {}): Promise<QuotaCard> {
  const key = await resolvePlanApiKey(OPENCODE_GO_PROVIDER, deps.plan, deps.credentials)
  if (key === undefined) return unconfiguredCard(OPENCODE_GO_PROVIDER)
  const logger = deps.logger

  let body: Record<string, unknown>
  try {
    const response = await fetch(OPENCODE_GO_USAGE_URL, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key}`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (response.status === 401) {
      return errorCard(OPENCODE_GO_PROVIDER, '官方接口拒绝了该 key（401）——请检查 OpenCode Go API key。')
    }
    if (response.status === 403) {
      return noSubscriptionCard(
        OPENCODE_GO_PROVIDER,
        '该 key 有效，但当前没有生效中的 OpenCode Go 订阅（未订阅或已过期）——订阅后点右上角刷新即可恢复显示。',
      )
    }
    if (!response.ok) {
      return errorCard(OPENCODE_GO_PROVIDER, `官方接口返回 HTTP ${response.status}。`)
    }
    const parsed: unknown = await response.json()
    if (!isRecord(parsed)) return errorCard(OPENCODE_GO_PROVIDER, '官方接口返回了无法识别的数据。')
    body = parsed
  } catch (error) {
    logger?.warn?.('[tokbook] opencode-go usage fetch failed:', error)
    return errorCard(OPENCODE_GO_PROVIDER, '无法连接官方接口（网络错误）。')
  }

  const card = parseOpenCodeGoUsage(body)
  if (card.windows.length === 0) {
    return errorCard(OPENCODE_GO_PROVIDER, '官方接口未返回可用数据。')
  }
  return card
}

export async function fetchOfficialQuota(provider: string, deps: QuotaFetchDeps = {}): Promise<QuotaCard> {
  if (provider === COMMAND_CODE_PROVIDER) return fetchCommandCodeQuota(deps)
  if (provider === OPENCODE_GO_PROVIDER) return fetchOpenCodeGoQuota(deps)
  return errorCard(provider, '该 provider 没有内置的官方额度查询。')
}
