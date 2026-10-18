import { resolve as resolvePath } from 'node:path'
import {
  type BillingMap, type BillingNature, type CostedModelRow, type PricingTable,
  type ProviderModelUsage, type ProviderUsageCard, type UsageFields, type UsageRecord,
  type UsageTotals, type WorkspaceUsageRow, totalsTokens,
} from './types.ts'
import type { RateResolver } from './stats.ts'
import { billingOf, costOf, priceOfKey } from './pricing.ts'

export const UNKNOWN_PROVIDER = '(未知)'

export const UNATTRIBUTED_ID = ''
export const UNATTRIBUTED_TITLE = '未归属'

export function providerKeyOf(record: UsageRecord): string {
  return record.provider !== undefined && record.provider !== '' ? record.provider : UNKNOWN_PROVIDER
}

export function pathKey(path: string): string {
  const normalized = resolvePath(path)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

export interface WorkspaceRef {
  id: string
  title: string
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

function bucketsOf(usage: UsageFields | undefined): UsageTotals {
  return {
    requests: 0,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cacheReadTokens: usage?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage?.cacheWriteTokens ?? 0,
  }
}

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

export interface WindowAggregate {
  providers: ProviderUsageCard[]
  byWorkspace: WorkspaceUsageRow[]
  byModel: CostedModelRow[]
}

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
