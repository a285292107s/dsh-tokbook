/**
 * provider 用量卡聚合（纯函数，无 I/O）。同一 model 串被不同 provider
 * 计费时分属不同卡；每卡跑与概览一致的 summary + 成本层。
 */

import type {
  BillingMap, CostedModelRow, PricingTable, ProviderModelUsage, ProviderUsageCard, UsageRecord,
} from './types.ts'
import { totalsTokens } from './types.ts'
import type { RateResolver } from './stats.ts'
import { attachCosts, summarizeRecords } from './stats.ts'
import { billingOf } from './pricing.ts'

export const UNKNOWN_PROVIDER = '(未知)'

/** '' 的行归到 {@link UNKNOWN_PROVIDER}。 */
export function providerKeyOf(record: UsageRecord): string {
  return record.provider !== undefined && record.provider !== '' ? record.provider : UNKNOWN_PROVIDER
}

/** 按 provider 切分窗口记录，保持输入顺序。 */
export function splitByProvider(records: readonly UsageRecord[]): Map<string, UsageRecord[]> {
  const groups = new Map<string, UsageRecord[]>()
  for (const record of records) {
    const key = providerKeyOf(record)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, [record])
    else group.push(record)
  }
  return groups
}

/** 失败行只进 `failures`，从不抬高 token 总量（与概览一致）。 */
export function providerCards(
  records: readonly UsageRecord[],
  pricing: PricingTable,
  resolve: RateResolver,
  billing: BillingMap = {},
): ProviderUsageCard[] {
  const groups = splitByProvider(records)
  const cards: ProviderUsageCard[] = []
  for (const [provider, group] of groups) {
    const summary = summarizeRecords(group, resolve)
    // 窗口内某 provider 只有失败（完全没有计费请求）时没有可展示的消费——
    // 跳过空卡，而不是渲染一堆 0。
    if (summary.total.requests === 0) continue
    // `dataDir` 只是经 CostedSummary 回传；卡从不渲染它。
    const costed = attachCosts({ dataDir: '', ...summary }, pricing, billing)
    const models: ProviderModelUsage[] = costed.byModel
      .map((row) => ({
        model: row.model,
        totals: row.totals,
        tokens: totalsTokens(row.totals),
        cost: row.cost,
        spend: row.spend,
        subscriptionValue: row.subscriptionValue,
        billing: billingOf(billing, row.provider),
      }))
      .sort((left, right) =>
        right.tokens - left.tokens || right.totals.requests - left.totals.requests
        || left.model.localeCompare(right.model))
    cards.push({
      provider,
      tokens: models.reduce((sum, row) => sum + row.tokens, 0),
      cost: costed.totalCost,
      spend: costed.spend,
      subscriptionValue: costed.subscriptionValue,
      unpricedModels: costed.unpricedModels,
      models,
      requests: summary.total.requests,
      compactions: summary.total.compactions ?? 0,
      usageUnknown: summary.total.usageUnknown ?? 0,
    })
  }
  cards.sort((left, right) =>
    right.tokens - left.tokens || right.requests - left.requests
    || left.provider.localeCompare(right.provider))
  return cards
}

/**
 * 同一批记录的**按模型**切法：摊平各卡的模型行，而不另跑一遍
 * `summarizeRecords` + `attachCosts`——「按模型」与「按通道」因此同源，合计逐分
 * 相等，也共用「只有失败的行不成清单」的规矩。顺序不是契约——展示层按词元降序排。
 */
export function modelRowsOf(cards: readonly ProviderUsageCard[]): CostedModelRow[] {
  const rows: CostedModelRow[] = []
  for (const card of cards) {
    for (const model of card.models) {
      rows.push({
        provider: card.provider,
        model: model.model,
        totals: model.totals,
        cost: model.cost,
        spend: model.spend,
        subscriptionValue: model.subscriptionValue,
      })
    }
  }
  return rows
}
