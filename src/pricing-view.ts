/**
 * 价格表 tab 的数据装配：视图渲染的卡片，由三个各知部分真相的源的并集构成——
 * route catalog（settings profiles ∪ 活的适配器 registry）、账本计过费的每个
 * route 与 model、价文件命名的一切。因此从配置中消失的 route——或只带手写
 * 价格的 route——仍可见、可编辑，其金额不会变成孤儿。
 *
 * 与拥有价**文件**本身（读、写、解析）的 `./pricing.ts` 分开。
 */

import { instantKey, EARLIEST } from './price-format.ts'
import { billingOf, rateKeyAt, readPriceFile } from './pricing.ts'
import type {
  ModelEntry, PriceSegment, PriceSlot, PricingModelView, PricingRouteView, PricingSegmentInput, PricingSlotInput,
  PricingTable, PricingView, RouteCatalogEntry, UsageRecord,
} from './types.ts'
interface Logger {
  error(...args: unknown[]): void
}

/** 账本对一个 (route, model) 计过什么。`unpriced` 按当前表判定，与成本层
 *  定价规则（`rateKeyAt`）一致，故计数与金额一致。 */
export interface LedgerModelUsage {
  records: number
  firstAt: number
  lastAt: number
  /** 按各自时间戳不被任何价格段覆盖的请求。它们计 ¥0，而**有**价的行仍可能
   *  持有它们：写下的生效时间会静默截断其之前的一切。 */
  unpriced: number
}

/** 账本计过什么，按 route 与 (route, model)。 */
export interface LedgerUsage {
  /** route → 精确 model 串 → 该行计过什么。 */
  byRouteModel: ReadonlyMap<string, ReadonlyMap<string, LedgerModelUsage>>
  byRoute: ReadonlyMap<string, number>
}

/** 把账本行折成价格视图的用量透镜。失败尝试命名 route 但没有计费调用，故
 *  不进——价格表卡片上的「N 次请求」与通道用量 tab 的请求计数同义。未归属行无法定价，
 *  不进价格表卡片。 */
export function ledgerUsageOf(records: readonly UsageRecord[], table: PricingTable): LedgerUsage {
  const byRouteModel = new Map<string, Map<string, LedgerModelUsage>>()
  const byRoute = new Map<string, number>()
  for (const record of records) {
    if (record.kind === 'failure') continue
    const route = record.provider ?? ''
    if (route === '' || record.model === '') continue
    let models = byRouteModel.get(route)
    if (models === undefined) {
      models = new Map()
      byRouteModel.set(route, models)
    }
    const row = models.get(record.model)
      ?? { records: 0, firstAt: record.time, lastAt: record.time, unpriced: 0 }
    row.records += 1
    if (record.time < row.firstAt) row.firstAt = record.time
    if (record.time > row.lastAt) row.lastAt = record.time
    if (rateKeyAt(table, route, record.model, record.time).from < 0) row.unpriced += 1
    models.set(record.model, row)
    byRoute.set(route, (byRoute.get(route) ?? 0) + 1)
  }
  return { byRouteModel, byRoute }
}

function slotInput(slot: PriceSlot): PricingSlotInput {
  return {
    days: slot.days,
    start: slot.start,
    end: slot.end,
    inputPerMillion: slot.rates.inputPerMillion,
    outputPerMillion: slot.rates.outputPerMillion,
    ...(slot.rates.cacheReadPerMillion !== undefined
      ? { cacheReadPerMillion: slot.rates.cacheReadPerMillion } : {}),
    ...(slot.rates.cacheWritePerMillion !== undefined
      ? { cacheWritePerMillion: slot.rates.cacheWritePerMillion } : {}),
  }
}

function segmentInput(segment: PriceSegment): PricingSegmentInput {
  const slots = (segment.slots ?? []).map(slotInput)
  return {
    from: segment.from > EARLIEST ? instantKey(segment.from) : null,
    inputPerMillion: segment.rates.inputPerMillion,
    outputPerMillion: segment.rates.outputPerMillion,
    ...(segment.rates.cacheReadPerMillion !== undefined
      ? { cacheReadPerMillion: segment.rates.cacheReadPerMillion } : {}),
    ...(segment.rates.cacheWritePerMillion !== undefined
      ? { cacheWritePerMillion: segment.rates.cacheWritePerMillion } : {}),
    ...(slots.length > 0 ? { slots } : {}),
    ...(segment.note !== undefined ? { note: segment.note } : {}),
  }
}

/**
 * 装配价格表卡片：每个 provider route 一张卡，route 可计费的每个 model 一行。
 * 一行只带它的价段（与账本透镜）；**行内那个「此刻的价」不在这里算**——它由 client
 * 按当前时刻从段里现算，wire 上不带一份会过期的快照。
 */
export async function readPricingView(
  dir: string,
  catalog: readonly RouteCatalogEntry[],
  ledger: LedgerUsage,
  logger: Logger = console,
): Promise<PricingView> {
  const file = await readPriceFile(dir, logger)
  interface ModelAcc {
    configured: boolean
    records: number
    name?: string
    /** 账本自身的事实，行有一条记录后在场。 */
    firstAt?: number
    lastAt?: number
    unpriced?: number
  }
  const routes = new Map<string, { label: string; models: Map<string, ModelAcc> }>()
  const ensure = (route: string, label?: string): Map<string, ModelAcc> => {
    let entry = routes.get(route)
    if (entry === undefined) {
      entry = { label: label !== undefined && label !== '' ? label : route, models: new Map() }
      routes.set(route, entry)
    } else if (label !== undefined && label !== '' && entry.label === route) {
      entry.label = label
    }
    return entry.models
  }
  for (const entry of catalog) {
    const models = ensure(entry.route, entry.label)
    for (const model of entry.models) {
      const name = model.name !== undefined && model.name !== '' && model.name !== model.id ? model.name : undefined
      const row = models.get(model.id)
      if (row === undefined) {
        models.set(model.id, { configured: true, records: 0, ...(name !== undefined ? { name } : {}) })
        continue
      }
      row.configured = true
      // 配置里的名字优先于稍后适配器目录的名字；账本与价文件从不给串命名，
      // 故「不在配置」的行不带 name。
      if (row.name === undefined && name !== undefined) row.name = name
    }
  }
  for (const [route, byModel] of ledger.byRouteModel) {
    const models = ensure(route)
    for (const [model, usage] of byModel) {
      const row = models.get(model)
      if (row === undefined) {
        models.set(model, {
          configured: false,
          records: usage.records,
          firstAt: usage.firstAt,
          lastAt: usage.lastAt,
          unpriced: usage.unpriced,
        })
        continue
      }
      row.records = usage.records
      row.firstAt = usage.firstAt
      row.lastAt = usage.lastAt
      row.unpriced = usage.unpriced
    }
  }
  for (const [route, byModel] of Object.entries(file.table)) {
    const models = ensure(route)
    for (const model of Object.keys(byModel)) {
      if (!models.has(model)) models.set(model, { configured: false, records: 0 })
    }
  }

  const now = Date.now()
  const cards: PricingRouteView[] = []
  for (const [route, entry] of routes) {
    const models: PricingModelView[] = []
    for (const [model, acc] of entry.models) {
      const segments = file.table[route]?.[model]
      models.push({
        model,
        ...(acc.name !== undefined ? { name: acc.name } : {}),
        configured: acc.configured,
        records: acc.records,
        ...(acc.firstAt !== undefined ? { firstAt: acc.firstAt } : {}),
        ...(acc.lastAt !== undefined ? { lastAt: acc.lastAt } : {}),
        ...(acc.unpriced !== undefined ? { unpriced: acc.unpriced } : {}),
        segments: (segments ?? []).map(segmentInput),
      })
    }
    models.sort((left, right) =>
      right.records - left.records
      || Number(right.configured) - Number(left.configured)
      || left.model.localeCompare(right.model))
    cards.push({
      route,
      label: entry.label,
      billing: billingOf(file.billing, route),
      records: ledger.byRoute.get(route) ?? 0,
      models,
    })
  }
  cards.sort((left, right) => right.records - left.records || left.route.localeCompare(right.route))
  return { routes: cards, dataDir: dir, updatedAt: now }
}
