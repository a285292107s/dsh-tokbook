/**
 * Provider-card aggregation of the token-book, the pure math behind the
 * Provider-usage tab of the floating window.
 *
 * The existing per-model aggregation keys rows by model id alone, but the same
 * model id can be billed by different provider routes (the ledger keeps the
 * provider key per row), so a per-provider view cannot reuse `byModel` — it
 * must first partition the window's records by provider, then run the regular
 * summary + cost layer inside each partition (model ids are unique within one
 * provider). Pure function: no I/O, so it is unit-tested directly.
 *
 * @module dsh-tokbook/by-provider
 */

import type {
  PricingTable, ProviderModelUsage, ProviderUsageCard, UsageRecord,
} from './types.ts'
import { totalsTokens } from './types.ts'
import type { RateResolver } from './stats.ts'
import { attachCosts, summarizeRecords } from './stats.ts'

/** The display key rows with no provider attribution group under. */
export const UNKNOWN_PROVIDER = '(未知)'

/** The provider key of one record ('' rows group under {@link UNKNOWN_PROVIDER}). */
export function providerKeyOf(record: UsageRecord): string {
  return record.provider !== undefined && record.provider !== '' ? record.provider : UNKNOWN_PROVIDER
}

/** Split a window's records into per-provider lists, preserving input order. */
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

/** Fold the window's records into one card per provider. Each partition runs
 * the regular summary + cost layer (exactly the overview's per-model math, so
 * the ¥ figures agree with the 用量总览 tab), then the card sums its models'
 * tokens, requests and cost and marks the unpriced ones. Cards sort by token
 * total descending; models inside a card sort the same way. A record without
 * provider usage still counts a request; a failure row counts only the
 * `failures` dimension inside its model's totals — failed attempts never
 * inflate token totals, matching the overview's semantics. */
export function providerCards(
  records: readonly UsageRecord[],
  pricing: PricingTable,
  resolve: RateResolver,
): ProviderUsageCard[] {
  const groups = splitByProvider(records)
  const cards: ProviderUsageCard[] = []
  for (const [provider, group] of groups) {
    const summary = summarizeRecords(group, resolve)
    // A window where a provider only failed (no billed request at all) has no
    // consumption to show — skip the empty card instead of rendering 0s.
    if (summary.total.requests === 0) continue
    // `dataDir` is only echoed through CostedSummary; the card never renders it.
    const costed = attachCosts({ dataDir: '', ...summary }, pricing)
    const models: ProviderModelUsage[] = costed.byModel
      .map((row) => ({
        model: row.model,
        totals: row.totals,
        tokens: totalsTokens(row.totals),
        cost: row.cost,
      }))
      .sort((left, right) =>
        right.tokens - left.tokens || right.totals.requests - left.totals.requests
        || left.model.localeCompare(right.model))
    cards.push({
      provider,
      tokens: models.reduce((sum, row) => sum + row.tokens, 0),
      cost: costed.totalCost,
      unpricedModels: costed.unpricedModels,
      models,
      requests: summary.total.requests,
      compactions: summary.total.compactions ?? 0,
    })
  }
  cards.sort((left, right) =>
    right.tokens - left.tokens || right.requests - left.requests
    || left.provider.localeCompare(right.provider))
  return cards
}

