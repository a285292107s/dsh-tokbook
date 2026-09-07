/**
 * Official-usage fetchers for the 订阅额度 tab.
 *
 * The tab shows *account-level* subscription usage, and the only correct
 * source for that is the provider's own account API — a local ledger cannot
 * see usage from other tools/devices sharing the same subscription key. This
 * module resolves the key through the DSH credentials service
 * (`ctx.credentials`, the same seam the provider adapters use — a key the
 * user stored in the Models/settings page lives there under the reference
 * name the provider's `apiKeyEnv` declares, e.g. `COMMANDCODE_API_KEY` /
 * `OPENCODE_GO_API_KEY`), then fetches the provider's official usage endpoint.
 *
 * Endpoints (both mirror what the respective official CLIs use; see the
 * source notes):
 *  - Command Code (mirrors dsh-commandcode-provider / the official `cmd` CLI):
 *      GET {base}/alpha/whoami
 *      GET {base}/alpha/usage/summary
 *      GET {base}/alpha/billing/credits        → credits + windowLimits{fiveHour,weekly}
 *      GET {base}/alpha/billing/subscriptions  → plan identity + period
 *    Auth: `Authorization: Bearer <key>` + CLI version / environment headers.
 *  - OpenCode Go (live endpoint — see cc-switch #6433 / dsh-opencode-go-usage):
 *      GET https://opencode.ai/zen/go/v1/usage  → { usage: {
 *           rolling|weekly|monthly: { status, percent, resetsAt } } }
 *    Auth: `Authorization: Bearer <key>` (+ a browser User-Agent, since the
 *    endpoint sits behind Cloudflare).
 *
 * Every fetch is best-effort and short-timeout; failures surface as an
 * `error` card rather than throwing.
 *
 * @module dsh-tokbook/quota-official
 */

import type { PlanConfig, QuotaCard, QuotaCreditPool, QuotaUsageSummary } from './types.ts'
import {
  BUILTIN_KEY_ENV, BUILTIN_PLAN_TITLES, COMMAND_CODE_PLAN_NAMES, COMMAND_CODE_PROVIDER, OPENCODE_GO_PROVIDER,
  errorCard, hasQuotaContent, planInfoFromSubscriptions, unconfiguredCard,
  windowFromCreditsBlock, windowFromUsagePercent,
} from './quota.ts'

/** One fetcher's face: a raw usage snapshot for one plan key. */
export interface OfficialQuota {
  account?: { name?: string }
  planInfo?: QuotaCard['planInfo']
  usage?: QuotaUsageSummary
  credits?: QuotaCreditPool
  windows: QuotaCard['windows']
}

/**
 * The credential seam a fetcher consumes. The host wires this to
 * `ctx.credentials.resolve` (the DSH credential provider), so a key stored in
 * the Models page / settings is found under the reference the plan names.
 * Resolving is intentionally async and returns the raw value only.
 */
export interface CredentialResolver {
  resolve(ref: string): Promise<string | undefined>
}

export interface QuotaFetchDeps {
  /** Config for the provider's plan (may carry an apiKey literal override). */
  plan?: PlanConfig
  /** Logger face (duck-typed). */
  logger?: { error(...args: unknown[]): void; warn?(...args: unknown[]): void }
  /** The DSH credentials seam (`ctx.credentials`). Absent → no key resolves. */
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

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the API key for one built-in provider from the DSH credentials
 * seam. The reference name is `plans[<key>].apiKeyEnv` when set, else the
 * provider default (`COMMANDCODE_API_KEY`, `OPENCODE_GO_API_KEY`) — exactly
 * the name the provider adapter's settings page writes through the
 * credentials service. A literal `plans[<key>].apiKey` (config) wins for
 * explicit/test overrides. No seam → undefined (the caller shows an
 * `unconfigured` card).
 */
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
  } catch (error) {
    // A failing seam must not crash the quota fetch; treat as unconfigured.
    // The host logs the underlying cause.
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Command Code official fetch
// ---------------------------------------------------------------------------

const COMMAND_CODE_API_BASE = 'https://api.commandcode.ai'
const COMMAND_CODE_CLI_VERSION = '1.47.0'

/** Fetch one Command Code `/alpha/*` endpoint, returning its parsed body or
 * `{ status }` on failure. */
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

/** Whether an `/alpha/*` result body indicates an auth failure. */
function isAuthFailure(body: Record<string, unknown> | { __httpStatus: number }): boolean {
  if ('__httpStatus' in body) return body.__httpStatus === 401
  return body.error === 'invalid-key' || body.message === 'Unauthorized'
}

/** Friendly display name for a Command Code plan id (falls back to the id). */
function commandCodePlanName(planId: string): string | undefined {
  const normalized = planId.toLowerCase().replace(/_/g, '-')
  return COMMAND_CODE_PLAN_NAMES[normalized]
}

/** Set the plan identity + card title from a raw plan node / id. */
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

/** Fetch the Command Code account usage (whoami + usage/summary +
 * billing/credits + billing/subscriptions). Returns the normalized card or
 * an `error`/`unconfigured` card. */
export async function fetchCommandCodeQuota(deps: QuotaFetchDeps = {}): Promise<QuotaCard> {
  const key = await resolvePlanApiKey(COMMAND_CODE_PROVIDER, deps.plan, deps.credentials)
  if (key === undefined) return unconfiguredCard(COMMAND_CODE_PROVIDER)
  const logger = deps.logger

  // whoami, usage/summary and billing/credits are independent — fire them
  // concurrently so the card never waits for four serial round trips. The
  // subscriptions endpoint may need an orgId read from whoami (org accounts),
  // so it is issued after the trio resolves.
  const [whoami, usage, credits] = await Promise.all([
    ccGet('/alpha/whoami', key, logger),
    ccGet('/alpha/usage/summary', key, logger),
    ccGet('/alpha/billing/credits', key, logger),
  ])
  const whoamiBody = isRecord(whoami) && !('__httpStatus' in whoami) ? whoami : undefined
  const orgId = whoamiBody !== undefined && isRecord(whoamiBody.org) ? str(whoamiBody.org.id) : undefined
  const subscription = await ccGet(
    orgId === undefined
      ? '/alpha/billing/subscriptions'
      : `/alpha/billing/subscriptions?orgId=${encodeURIComponent(orgId)}`,
    key,
    logger,
  )

  // Classify a total auth failure across the endpoints that must succeed.
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

  // whoami → account.
  if (isRecord(whoami) && !('__httpStatus' in whoami)) {
    const user = isRecord(whoami.user) ? whoami.user : undefined
    const name = str(user?.userName) ?? str(user?.name)
    if (name !== undefined && name !== '') card.account = { name }
  }

  // usage/summary → usage summary.
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

  // billing/credits → credits + window limits. The credits node may carry a
  // planId fallback when the subscriptions endpoint is unavailable.
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

  // billing/subscriptions → plan identity (fall back to credits.planId).
  if (isRecord(subscription) && !('__httpStatus' in subscription)) {
    const data = isRecord(subscription.data) ? subscription.data : undefined
    attachPlanInfo(card, data ?? subscription, creditsPlanId)
  } else if (creditsPlanId !== undefined) {
    attachPlanInfo(card, undefined, creditsPlanId)
  }

  if (!hasQuotaContent(card)) {
    return errorCard(COMMAND_CODE_PROVIDER, '官方接口未返回可用数据。')
  }
  return card
}

// ---------------------------------------------------------------------------
// OpenCode Go official fetch
// ---------------------------------------------------------------------------

const OPENCODE_GO_USAGE_URL = 'https://opencode.ai/zen/go/v1/usage'

interface GoUsageWindow {
  status?: unknown
  percent?: unknown
  resetsAt?: unknown
  usagePercent?: unknown
  resetInSec?: unknown
}

/** Normalize a raw OpenCode Go usage body (`{ usage: { rolling, weekly,
 * monthly } }`, each `{ status, percent, resetsAt }`) into a quota card.
 * Pure and exported so the parse is unit-tested without network. */
export function parseOpenCodeGoUsage(body: Record<string, unknown>, now: number = Date.now()): QuotaCard {
  const usage = isRecord(body.usage) ? body.usage : body
  const rolling = isRecord(usage.rolling) ? usage.rolling as GoUsageWindow : undefined
  const weekly = isRecord(usage.weekly) ? usage.weekly as GoUsageWindow : undefined
  const monthly = isRecord(usage.monthly) ? usage.monthly as GoUsageWindow : undefined

  const card: QuotaCard = {
    plan: OPENCODE_GO_PROVIDER,
    title: BUILTIN_PLAN_TITLES[OPENCODE_GO_PROVIDER]!,
    state: 'ok',
    windows: [],
    fetchedAt: Date.now(),
  }
  if (rolling !== undefined) card.windows.push(windowFromUsagePercent('rolling5h', '5 小时', rolling, now))
  if (weekly !== undefined) card.windows.push(windowFromUsagePercent('weekly', '本周', weekly, now))
  if (monthly !== undefined) card.windows.push(windowFromUsagePercent('monthly', '本月', monthly, now))
  return card
}

/** Fetch the OpenCode Go official usage (three windows: rolling/weekly/
 * monthly, percent + reset only). The live endpoint answers
 * `{ usage: { rolling|weekly|monthly: { status, percent, resetsAt } } }`
 * (verified via cc-switch and the dsh-opencode-go-usage plugin). */
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
        // The endpoint sits behind Cloudflare; a browser User-Agent avoids
        // being dropped (error 1010) — same fix cc-switch / cost-meter use.
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (response.status === 401) {
      return errorCard(OPENCODE_GO_PROVIDER, '官方接口拒绝了该 key（401）——请检查 OpenCode Go API key。')
    }
    if (response.status === 403) {
      return errorCard(OPENCODE_GO_PROVIDER, '官方接口拒绝了请求（403）——可能无 Go 订阅或 key 无权访问。')
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

/** Fetch official usage for one built-in provider. Unknown provider → an
 * `error` card. */
export async function fetchOfficialQuota(provider: string, deps: QuotaFetchDeps = {}): Promise<QuotaCard> {
  if (provider === COMMAND_CODE_PROVIDER) return fetchCommandCodeQuota(deps)
  if (provider === OPENCODE_GO_PROVIDER) return fetchOpenCodeGoQuota(deps)
  return errorCard(provider, '该 provider 没有内置的官方额度查询。')
}
