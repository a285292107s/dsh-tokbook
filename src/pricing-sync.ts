import { normalizeModelId, type ModelsDevCatalog } from './models-dev.ts'
import type { PricingTable, UsageRecord } from './types.ts'

export interface SyncReport {
  added: number
  skipped: number
  reasons: Record<string, string>
}

export function billedRouteModels(records: readonly UsageRecord[]): Map<string, Set<string>> {
  const byRoute = new Map<string, Set<string>>()
  for (const record of records) {
    if (record.kind === 'failure') continue
    const route = record.provider ?? ''
    if (route === '' || record.model === '') continue
    let models = byRoute.get(route)
    if (models === undefined) {
      models = new Set()
      byRoute.set(route, models)
    }
    models.add(record.model)
  }
  return byRoute
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function mergeCatalogIntoTable(
  table: PricingTable,
  currency: Readonly<Record<string, 'CNY' | 'USD'>>,
  ledger: ReadonlyMap<string, ReadonlySet<string>>,
  catalog: ModelsDevCatalog,
): { table: PricingTable; report: SyncReport } {
  const next: PricingTable = { ...table }
  const report: SyncReport = { added: 0, skipped: 0, reasons: {} }
  const skip = (route: string, model: string, reason: string): void => {
    report.skipped += 1
    report.reasons[`${route}/${model}`] = reason
  }
  for (const [route, models] of ledger) {
    if (currency[route] !== 'USD') {
      for (const model of models) skip(route, model, '通道不是美元报价')
      continue
    }
    const priced = table[route] ?? {}
    for (const model of models) {
      if (priced[model] !== undefined) {
        continue
      }
      const entry = catalog.get(normalizeModelId(model))
      if (entry === undefined) {
        skip(route, model, 'models.dev 上没有采信的条目')
        continue
      }
      next[route] = {
        ...(next[route] ?? {}),
        [model]: {
          rates: {
            inputPerMillion: round6(entry.cost.input),
            outputPerMillion: round6(entry.cost.output),
            ...(entry.cost.cacheRead !== undefined ? { cacheReadPerMillion: round6(entry.cost.cacheRead) } : {}),
            ...(entry.cost.cacheWrite !== undefined ? { cacheWritePerMillion: round6(entry.cost.cacheWrite) } : {}),
          },
        },
      }
      report.added += 1
    }
  }
  return { table: next, report }
}
