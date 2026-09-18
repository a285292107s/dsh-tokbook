/**
 * 订阅额度 tab 的官方用量拉取器。
 *
 * tab 展示**账户级**订阅用量，其唯一正确来源是 provider 自己的账户 API——
 * 本地账本看不到共享同一订阅 key 的其他工具/设备的用量。本模块经 DSH 凭据
 * 服务（`ctx.credentials`）解析 key，然后拉取 provider 的官方用量端点。
 *
 * Command Code：`/alpha/whoami` + `/alpha/billing/credits` + `/alpha/billing/subscriptions`
 * + `/alpha/usage/summary`；认证 `Authorization: Bearer <key>` + CLI 版本头。
 * OpenCode Go：`https://opencode.ai/zen/go/v1/usage`；认证 Bearer key + 浏览器
 * User-Agent（端点在 Cloudflare 后面）。401 = 坏 key；403 = 有效 key 但无 Go
 * 订阅（Zen 与 Go 共享 workspace key），答为 `gate: 'none'` 状态卡而非失败。
 *
 * 每次拉取尽力而为、短超时；失败以 `error` 卡露出而不是抛。
 */

import type { PlanConfig, QuotaCard, QuotaCreditPool, QuotaUsageSummary } from './types.ts'
import {
  BUILTIN_KEY_ENV, BUILTIN_PLAN_TITLES, COMMAND_CODE_PLAN_NAMES, COMMAND_CODE_PROVIDER, OPENCODE_GO_PROVIDER,
  balanceGateNote, errorCard, hasQuotaContent, noSubscriptionCard, planInfoFromSubscriptions, quotaGate, unconfiguredCard,
  windowFromCreditsBlock, windowFromUsagePercent,
} from './quota.ts'

/**
 * 拉取器消费的凭据缝。宿主将其接到 `ctx.credentials.resolve`（DSH 凭据
 * provider），因此 Models 页 / settings 里存的 key 能在计划命名的引用下被找到。
 * 解析刻意异步，且只返回原始值。
 */
export interface CredentialResolver {
  resolve(ref: string): Promise<string | undefined>
}

export interface QuotaFetchDeps {
  /** 该 provider 计划的配置（可带 apiKey 字面量覆盖）。 */
  plan?: PlanConfig
  /** logger 面（duck-typed）。 */
  logger?: { error(...args: unknown[]): void; warn?(...args: unknown[]): void }
  /** DSH 凭据缝（`ctx.credentials`）。缺席 → 无 key 可解析。 */
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
// Key 解析
// ---------------------------------------------------------------------------

/**
 * 从 DSH 凭据缝解析一个内置 provider 的 API key。引用名是设置了的
 * `plans[<key>].apiKeyEnv`，否则是 provider 默认（`COMMANDCODE_API_KEY`、
 * `OPENCODE_GO_API_KEY`）——正是 provider 适配器 settings 页经凭据服务写入的
 * 名字。配置里的字面量 `plans[<key>].apiKey` 优先，供显式/测试覆盖。无缝 →
 * undefined（调用方展示 `unconfigured` 卡）。
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
  } catch {
    // 缝失败不得崩掉额度拉取；当作 unconfigured。宿主记下底层原因。
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Command Code 官方拉取
// ---------------------------------------------------------------------------

const COMMAND_CODE_API_BASE = 'https://api.commandcode.ai'
const COMMAND_CODE_CLI_VERSION = '1.47.0'

/** 一个 `/alpha/*` 路径及其查询参数；空/缺席值剔除。`orgId` 圈定 billing
 *  端点，`since` 圈定用量摘要。 */
function ccPath(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value)
  }
  const query = search.toString()
  return query === '' ? path : `${path}?${query}`
}

/** 原始时间戳字段作字符串，供 API 原样接受的查询参数（`since`）：provider
 *  可能报 ISO 串或 epoch，原样传回是唯一两边都合适的读法。 */
function rawTimestamp(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

/** 拉取一个 Command Code `/alpha/*` 端点，返回解析后的 body，失败时返回
 *  `{ status }`。 */
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

/** `/alpha/*` 结果体是否表示认证失败。 */
function isAuthFailure(body: Record<string, unknown> | { __httpStatus: number }): boolean {
  if ('__httpStatus' in body) return body.__httpStatus === 401
  return body.error === 'invalid-key' || body.message === 'Unauthorized'
}

/** Command Code 计划 id 的友好展示名（回落到 id）。 */
function commandCodePlanName(planId: string): string | undefined {
  const normalized = planId.toLowerCase().replace(/_/g, '-')
  return COMMAND_CODE_PLAN_NAMES[normalized]
}

/** 从原始计划节点 / id 设定计划身份与卡标题。 */
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

/** 拉取 Command Code 账户用量（whoami + usage/summary + billing/credits +
 *  billing/subscriptions）。返回归一后的卡，或 `error`/`unconfigured` 卡。 */
export async function fetchCommandCodeQuota(deps: QuotaFetchDeps = {}): Promise<QuotaCard> {
  const key = await resolvePlanApiKey(COMMAND_CODE_PROVIDER, deps.plan, deps.credentials)
  if (key === undefined) return unconfiguredCard(COMMAND_CODE_PROVIDER)
  const logger = deps.logger

  // whoami 先行——它命名 billing 端点所圈定的 org——然后 credits 与
  // subscriptions 并发，用量摘要最后，因为只有 subscriptions 知道当前周期起点。
  // 摘要以该周期为界（`since`）：它是月度额度算术的花费一侧，必须与所对照的
  // 余额池属同一周期。（手工验证：周期花费 + 剩余池 ≈ 计划的月度 credits。）
  // 该顺序多花一次往返，tab 的 stale-while-revalidate 首屏从不等待它。
  const whoami = await ccGet('/alpha/whoami', key, logger)
  const whoamiBody = isRecord(whoami) && !('__httpStatus' in whoami) ? whoami : undefined
  const orgId = whoamiBody !== undefined && isRecord(whoamiBody.org) ? str(whoamiBody.org.id) : undefined
  const [credits, subscription] = await Promise.all([
    ccGet(ccPath('/alpha/billing/credits', { orgId }), key, logger),
    ccGet(ccPath('/alpha/billing/subscriptions', { orgId }), key, logger),
  ])
  // subscriptions 端点**是否回答了**？与「有没有计划节点」不是同一问题：
  // 调用本身失败时也没有节点，两者要求相反读法（见下方 gate 块）。
  const subscriptionBody = isRecord(subscription) && !('__httpStatus' in subscription) ? subscription : undefined
  const subscriptionNode = subscriptionBody !== undefined && isRecord(subscriptionBody.data)
    ? subscriptionBody.data
    : subscriptionBody
  const usage = await ccGet(
    ccPath('/alpha/usage/summary', { orgId, since: rawTimestamp(subscriptionNode?.currentPeriodStart) }),
    key,
    logger,
  )

  // 在必须成功的端点上判定整体认证失败。
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

  // whoami → account。
  if (isRecord(whoami) && !('__httpStatus' in whoami)) {
    const user = isRecord(whoami.user) ? whoami.user : undefined
    const name = str(user?.userName) ?? str(user?.name)
    if (name !== undefined && name !== '') card.account = { name }
  }

  // usage/summary → usage summary。
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

  // billing/credits → credits + 窗口限额。credits 节点可能在 subscriptions
  // 端点不可用时提供 planId 回落。
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

  // billing/subscriptions → 计划身份（回落到 credits.planId）。
  if (subscriptionNode !== undefined) {
    attachPlanInfo(card, subscriptionNode, creditsPlanId)
  } else if (creditsPlanId !== undefined) {
    attachPlanInfo(card, undefined, creditsPlanId)
  }

  // 上面数字**意味着什么**取决于是否有生效订阅。滚动窗口与月度池只限制生效
  // 计划所含的 credits；无订阅时 provider 仅按余额约束用量，窗口不适用。故卡
  // 说出自己的 gate，而不是让残留的窗口数字读作预算。
  //
  // gate **只**从携带证据的端点读：`status` 与 `periodEnd` 只存在于
  // `billing/subscriptions`，该调用失败意味着「未知」，绝非「无订阅」。从 5xx
  // 推出计划已失效，既会藏掉账户仍在其下的窗口，**还会用文字说出来**。未设定
  // 时 gate 默认为 `subscription`，卡渲染与 gate 出现之前完全相同，直到稍后
  // 刷新真正答上。
  if (subscriptionBody !== undefined) {
    card.gate = quotaGate(card.planInfo)
    if (card.gate === 'balance') {
      card.gateNote = balanceGateNote(card.planInfo)
      // `balance` 门承诺有余额可展示。当 `billing/credits` 也没答上时，没有
      // 数字可放在窗口的位置，而缺席的余额会渲染成 `$0.00`——我们无法支持的
      // 断言。与 OpenCode Go 的「无物可展示」是同一情形，故取同一 gate，而
      // 不是编造零。
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

// ---------------------------------------------------------------------------
// OpenCode Go 官方拉取
// ---------------------------------------------------------------------------

const OPENCODE_GO_USAGE_URL = 'https://opencode.ai/zen/go/v1/usage'

interface GoUsageWindow {
  status?: unknown
  percent?: unknown
  resetsAt?: unknown
  usagePercent?: unknown
  resetInSec?: unknown
}

/** 把原始 OpenCode Go 用量体（`{ usage: { rolling, weekly, monthly } }`，各
 *  `{ status, percent, resetsAt }`）归一成额度卡。纯函数并导出，解析可无网
 *  单测。 */
export function parseOpenCodeGoUsage(body: Record<string, unknown>, now: number = Date.now()): QuotaCard {
  const usage = isRecord(body.usage) ? body.usage : body
  const rolling = isRecord(usage.rolling) ? usage.rolling as GoUsageWindow : undefined
  const weekly = isRecord(usage.weekly) ? usage.weekly as GoUsageWindow : undefined
  const monthly = isRecord(usage.monthly) ? usage.monthly as GoUsageWindow : undefined

  const card: QuotaCard = {
    plan: OPENCODE_GO_PROVIDER,
    title: BUILTIN_PLAN_TITLES[OPENCODE_GO_PROVIDER]!,
    state: 'ok',
    // 窗口百分比**就是**该计划的限额（5 小时 = 模型月度额度的 20%，周 = 50%，
    // 月 = 100%），故带窗口的卡是 subscription 门。显式写出，client 永不必
    // 从某字段的有无推断 gate。
    gate: 'subscription',
    windows: [],
    fetchedAt: Date.now(),
  }
  if (rolling !== undefined) card.windows.push(windowFromUsagePercent('rolling5h', '5 小时', rolling, now))
  if (weekly !== undefined) card.windows.push(windowFromUsagePercent('weekly', '本周', weekly, now))
  if (monthly !== undefined) card.windows.push(windowFromUsagePercent('monthly', '本月', monthly, now))
  return card
}

/** 拉取 OpenCode Go 官方用量（三个窗口：rolling/weekly/monthly，仅百分比 +
 *  重置）。live 端点答 `{ usage: { rolling|weekly|monthly: { status, percent,
 *  resetsAt } } }`（经 cc-switch 与 dsh-opencode-go-usage 插件验证）。 */
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
        // 端点在 Cloudflare 后面；浏览器 User-Agent 避免被丢（error 1010）
        // ——与 cc-switch / cost-meter 的同一修法。
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (response.status === 401) {
      return errorCard(OPENCODE_GO_PROVIDER, '官方接口拒绝了该 key（401）——请检查 OpenCode Go API key。')
    }
    if (response.status === 403) {
      // 文档化为「有效 key、无 Go 订阅」——Zen 与 Go 共享同一 workspace key，
      // 故这不是认证失败也不是故障：账户只是没有生效中的 Go 计划（从未订阅，
      // 或已结束）。答为状态，tab 展示真相而不是「查询失败」。此端点只报窗口
      // 百分比，与 Command Code 不同，没有余额可放在窗口的位置。
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

/** 为一个内置 provider 拉取官方用量。未知 provider → `error` 卡。 */
export async function fetchOfficialQuota(provider: string, deps: QuotaFetchDeps = {}): Promise<QuotaCard> {
  if (provider === COMMAND_CODE_PROVIDER) return fetchCommandCodeQuota(deps)
  if (provider === OPENCODE_GO_PROVIDER) return fetchOpenCodeGoQuota(deps)
  return errorCard(provider, '该 provider 没有内置的官方额度查询。')
}
