/**
 * 用量明细一页要的三种「窗口切法」——按通道的卡、按工作区的行、按模型（= 各卡的模型行
 * 摊平）——**一趟**折出来。
 *
 * 为什么是一趟：三样东西出自同一批窗口记录，分开算就要把同一批记录扫三遍、各自把 rate
 * 身份解一遍、各自计一遍价，而这份成本随 **rate 行数**（`byDay × 模型 × 通道 × rate 身份`）
 * 增长，不是随记录数：本机 12.8 万条记录的 `all` 窗口上，分开算约 1.1 s，占整条路由的九成
 * ——而这一页根本不渲染 byDay / byHour / rateRows。合并之后一条记录只解一次身份、只计一次
 * 价，卡片与工作区行各记自己那一份（实测 173 ms，逐项与分开算一致）。
 *
 * 归日 / 归小时 / 报表行仍归 `stats.ts` 的 `summarizeRecords`（概览与会话页用），记账口径
 * 由 `docs/CONTRACTS.md` §2 定，改动这里必须让两边逐字一致——`pnpm smoke` 的「通道卡片与
 * 按模型切法」「工作区」两节断言的正是这一点。
 */

import { resolve as resolvePath } from 'node:path'
import {
  type BillingMap, type BillingNature, type CostedModelRow, type PricingTable,
  type ProviderModelUsage, type ProviderUsageCard, type UsageFields, type UsageRecord,
  type UsageTotals, type WorkspaceUsageRow, totalsTokens,
} from './types.ts'
import type { RateResolver } from './stats.ts'
import { billingOf, costOf, priceOfKey } from './pricing.ts'

/** 无 header 的行归到这枚 route key（与界面上的「(未知)」逐字一致）。 */
export const UNKNOWN_PROVIDER = '(未知)'

/** 无人认领的兜底行的行 id 与标题。 */
export const UNATTRIBUTED_ID = ''
export const UNATTRIBUTED_TITLE = '未归属'

/** 一行记录的 provider route 键；`''` 归到 {@link UNKNOWN_PROVIDER}。 */
export function providerKeyOf(record: UsageRecord): string {
  return record.provider !== undefined && record.provider !== '' ? record.provider : UNKNOWN_PROVIDER
}

/**
 * 目录路径的比较键。会话 header 带着创建时的 cwd，registry 带着解析后的
 * 路径：两者指同一目录但不必字节相同（分隔符写法、尾斜杠、`..`，以及
 * Windows 上盘符/文件夹大小写）。`resolve` 归一写法；大小写折叠只在文件系统
 * 大小写不敏感时应用——在 POSIX 上折叠会把两个真正不同的项目合并。
 */
export function pathKey(path: string): string {
  const normalized = resolvePath(path)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

/** 本聚合所需的 workspace 事实，由宿主从 workspace registry 读出。保持结构性而不是
 *  import DSH 的 `Workspace`（宿主包只针对 `@deepseek-ai/cordis` 编译）。 */
export interface WorkspaceRef {
  id: string
  title: string
  /** 规范目录路径（注册目录的 `fs.realpath`）。 */
  path: string
}

function emptyTotals(): UsageTotals {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    compactions: 0,
    failures: 0,
    usageUnknown: 0,
  }
}

/** 口径与 `stats.ts` 的 `addUsage` 逐字一致（失败只进 `failures`；用量未知仍计请求）。 */
function addUsage(totals: UsageTotals, record: UsageRecord): void {
  if (record.kind === 'failure') {
    totals.failures = (totals.failures ?? 0) + 1
    const code = record.failureCode ?? 'UNKNOWN'
    const byCode = totals.failuresByCode ?? {}
    byCode[code] = (byCode[code] ?? 0) + 1
    totals.failuresByCode = byCode
    return
  }
  totals.requests += 1
  if (record.kind === 'compaction') totals.compactions = (totals.compactions ?? 0) + 1
  const usage = record.usage
  if (usage === undefined) {
    totals.usageUnknown = (totals.usageUnknown ?? 0) + 1
    return
  }
  totals.inputTokens += usage.inputTokens
  totals.outputTokens += usage.outputTokens
  if (usage.cacheReadTokens !== undefined) totals.cacheReadTokens += usage.cacheReadTokens
  if (usage.cacheWriteTokens !== undefined) totals.cacheWriteTokens += usage.cacheWriteTokens
}

/** 单条记录的四个桶，供 `costOf` 使用（它只读这四个）。 */
function bucketsOf(usage: UsageFields | undefined): UsageTotals {
  return {
    requests: 0,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cacheReadTokens: usage?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage?.cacheWriteTokens ?? 0,
  }
}

/** 一个分组的两桶金额：实际支出与订阅价值，`cost` 是两者的合计。 */
interface Money {
  cost: number
  spend: number
  subscriptionValue: number
}

function emptyMoney(): Money {
  return { cost: 0, spend: 0, subscriptionValue: 0 }
}

function addMoney(into: Money, cost: number, nature: BillingNature): void {
  into.cost += cost
  if (nature === 'subscription') into.subscriptionValue += cost
  else into.spend += cost
}

interface ModelAcc {
  model: string
  totals: UsageTotals
  money: Money
  billing: BillingNature
}

interface ProviderAcc {
  provider: string
  totals: UsageTotals
  money: Money
  models: Map<string, ModelAcc>
  unpriced: Set<string>
}

interface WorkspaceAcc {
  totals: UsageTotals
  money: Money
  lastAt: number
}

/** {@link aggregateWindow} 的产物：两种「窗口切法」加摊平后的按模型行。 */
export interface WindowAggregate {
  /** 按通道的卡，按词元降序；卡内模型同样按词元降序。 */
  providers: ProviderUsageCard[]
  /** 按工作区，最近有操作在前、「未归属」收尾。空的两种情况不同：宿主没有工作区
   *  注册表（这一面根本不存在），或窗口里没有记录。 */
  byWorkspace: WorkspaceUsageRow[]
  /** 按模型 = 各卡模型行摊平（与卡片同源，合计因此逐分相等）。 */
  byModel: CostedModelRow[]
}

/**
 * 把一批窗口记录一次折成三种切法。
 *
 * `workspaces` 为 `null` = 宿主没有 workspace registry：按工作区一面是空的，而不是把
 * 所有记录塞进「未归属」——那会把「这一面不存在」说成「这些用量都不属于任何工作区」。
 */
export function aggregateWindow(
  records: readonly UsageRecord[],
  workspaces: readonly WorkspaceRef[] | null,
  cwdOf: (sessionId: string) => string | undefined,
  pricing: PricingTable,
  resolve: RateResolver,
  billing: BillingMap = {},
): WindowAggregate {
  const providers = new Map<string, ProviderAcc>()
  const byPath = new Map<string, WorkspaceRef>()
  const byId = new Map<string, WorkspaceRef>()
  if (workspaces !== null) {
    for (const workspace of workspaces) {
      byId.set(workspace.id, workspace)
      if (workspace.path !== '') byPath.set(pathKey(workspace.path), workspace)
    }
  }
  /** 会话 → 工作区（未归属为 null）：一个会话贡献多条记录，但只有一个 header。 */
  const owner = new Map<string, WorkspaceRef | null>()
  const workspaceAcc = new Map<string, WorkspaceAcc>()

  for (const record of records) {
    const key = providerKeyOf(record)
    let provider = providers.get(key)
    if (provider === undefined) {
      provider = { provider: key, totals: emptyTotals(), money: emptyMoney(), models: new Map(), unpriced: new Set() }
      providers.set(key, provider)
    }
    addUsage(provider.totals, record)

    let workspace: WorkspaceAcc | null = null
    if (workspaces !== null) {
      let hit = owner.get(record.sessionId)
      if (hit === undefined) {
        const cwd = cwdOf(record.sessionId)
        hit = cwd === undefined || cwd === '' ? null : byPath.get(pathKey(cwd)) ?? null
        owner.set(record.sessionId, hit)
      }
      const workspaceKey = hit?.id ?? UNATTRIBUTED_ID
      let acc = workspaceAcc.get(workspaceKey)
      if (acc === undefined) {
        acc = { totals: emptyTotals(), money: emptyMoney(), lastAt: record.time }
        workspaceAcc.set(workspaceKey, acc)
      } else if (record.time > acc.lastAt) {
        acc.lastAt = record.time
      }
      addUsage(acc.totals, record)
      workspace = acc
    }

    // 未归属失败（`model === ''`）不进模型行：空白表格行会假装我们知道 route。
    let model: ModelAcc | null = null
    if (record.model !== '') {
      let row = provider.models.get(record.model)
      if (row === undefined) {
        row = { model: record.model, totals: emptyTotals(), money: emptyMoney(), billing: billingOf(billing, record.provider) }
        provider.models.set(record.model, row)
      }
      addUsage(row.totals, record)
      model = row
    }

    // 计价与 `attachCosts` 同一条路：rate 身份 → 回查当前价 → costOf。失败行的
    // usage 缺席，金额因此是 0；它仍会把「没有价」的模型报进 `unpriced`。
    const prices = priceOfKey(pricing, record.provider, record.model, resolve(record))
    if (prices === null) {
      if (record.model !== '') provider.unpriced.add(record.model)
      continue
    }
    const nature = billingOf(billing, record.provider)
    const cost = costOf(bucketsOf(record.usage), prices)
    addMoney(provider.money, cost, nature)
    if (workspace !== null) addMoney(workspace.money, cost, nature)
    if (model !== null) addMoney(model.money, cost, nature)
  }

  const cards: ProviderUsageCard[] = []
  const byModel: CostedModelRow[] = []
  for (const provider of providers.values()) {
    // 窗口内某 provider 只有失败（完全没有计费请求）时没有可展示的消费——
    // 跳过空卡，而不是渲染一堆 0。
    if (provider.totals.requests === 0) continue
    const models: ProviderModelUsage[] = [...provider.models.values()]
      .sort((left, right) =>
        totalsTokens(right.totals) - totalsTokens(left.totals)
        || right.totals.requests - left.totals.requests
        || left.model.localeCompare(right.model))
      .map(row => ({
        model: row.model,
        totals: row.totals,
        tokens: totalsTokens(row.totals),
        cost: row.money.cost,
        spend: row.money.spend,
        subscriptionValue: row.money.subscriptionValue,
        billing: row.billing,
      }))
    for (const row of models) {
      byModel.push({
        provider: provider.provider,
        model: row.model,
        totals: row.totals,
        cost: row.cost,
        spend: row.spend,
        subscriptionValue: row.subscriptionValue,
      })
    }
    cards.push({
      provider: provider.provider,
      tokens: models.reduce((sum, row) => sum + row.tokens, 0),
      cost: provider.money.cost,
      spend: provider.money.spend,
      subscriptionValue: provider.money.subscriptionValue,
      unpricedModels: [...provider.unpriced],
      models,
      requests: provider.totals.requests,
      compactions: provider.totals.compactions ?? 0,
      usageUnknown: provider.totals.usageUnknown ?? 0,
    })
  }
  cards.sort((left, right) =>
    right.tokens - left.tokens || right.requests - left.requests
    || left.provider.localeCompare(right.provider))

  if (workspaces === null) return { providers: cards, byWorkspace: [], byModel }

  const named: WorkspaceUsageRow[] = []
  let unattributed: WorkspaceUsageRow | null = null
  for (const [key, acc] of workspaceAcc) {
    // 从未计费过请求的工作区（只有失败行）跳过，而不是显示为零行。
    if (acc.totals.requests === 0) continue
    const workspace = byId.get(key)
    const row: WorkspaceUsageRow = {
      id: key,
      title: workspace?.title ?? UNATTRIBUTED_TITLE,
      path: workspace?.path ?? '',
      totals: acc.totals,
      tokens: totalsTokens(acc.totals),
      spend: acc.money.spend,
      subscriptionValue: acc.money.subscriptionValue,
      lastAt: acc.lastAt,
    }
    if (key === UNATTRIBUTED_ID) unattributed = row
    else named.push(row)
  }
  named.sort((left, right) =>
    right.lastAt - left.lastAt || right.tokens - left.tokens
    || left.title.localeCompare(right.title))
  return {
    providers: cards,
    byWorkspace: unattributed === null ? named : [...named, unattributed],
    byModel,
  }
}
