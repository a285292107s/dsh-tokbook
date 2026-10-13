/**
 * models.dev 目录 → 价文件的合并算法（纯函数，无 I/O）。
 *
 * 四道门槛，一道不过就不写那一格——价表是钱的口径，宁可继续价格未知：
 * 1. **通道按美元报价**（`$currency[route] === 'USD'`）：models.dev 是美元目录，
 *    人民币通道的挂牌价不是美元价的函数，机械换算即估算；
 * 2. **账本计过费**：目录驱动会灌入几千条用不上的价，且金额是现价刻度——
 *    补上价后窗口内自动回填，账本驱动零损失（理由见 docs/CONTRACTS.md §2）；
 * 3. **该格现在没有价**：手写价永远赢，同步只是补洞（含已有价但读不懂的格子
 *    ——那是手写文件坏行，不是同步该修的）；
 * 4. **目录命中且采信**：归一化 id 命中 `models-dev.ts` 采信目录。
 *
 * 合并只动 table：`$billing` / `$calendar` / `$currency` / `$fx` 原样带过。
 */

import { normalizeModelId, type ModelsDevCatalog } from './models-dev.ts'
import type { PricingTable, UsageRecord } from './types.ts'

export interface SyncReport {
  /** 本次写入的 (route, model) 数。 */
  added: number
  /** 账本出现、但因门槛没写的 (route, model) 数（无价格仍按价格未知报出）。 */
  skipped: number
  /** 报告细节：跳过的 (route, model) 与原因。 */
  reasons: Record<string, string>
}

/** 账本计过费的 (route, model) 集合（失败行不算：它们没有用量可折价）。 */
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

/** 四档价写进价文件的舍入：models.dev 的美元价最多 6 位小数（`0.003` 量级），
 *  全精度写盘会让文件读不下去，6 位对美元/百万 token 已经是 1e-6 美元精度。 */
function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

/**
 * 合并出下一份价表。输入是**原表**（`readPriceFile` 的 `table`）、美元通道集合
 * 与账本集合；输出新表与报告。纯函数：不读文件、不打网络，host 侧包一层 I/O。
 */
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
        // 已有价（或手写坏行）不动：同步只补洞，不覆盖。
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
