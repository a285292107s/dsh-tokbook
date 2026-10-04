/**
 * 价格表 tab 的数据装配：视图渲染的卡片，由三个各知部分真相的源的并集构成——
 * route catalog（settings profiles ∪ 活的适配器 registry）、账本计过费的每个
 * route 与 model、价文件命名的一切。因此从配置中消失的 route——或只带手写
 * 价格的 route——仍可见、可编辑，其金额不会变成孤儿。
 *
 * 与拥有价**文件**本身（读、写、解析）的 `./pricing.ts` 分开。
 */

import { billingOf, rateKeyAt, readPriceFile } from './pricing.ts'
import type {
  HolidayCalendar, ModelEntry, PriceEntry, PriceSlot, PricingEntryInput, PricingModelView,
  PricingRouteView, PricingSlotInput, PricingTable, PricingView, RouteCatalogEntry, UsageRecord,
} from './types.ts'
interface Logger {
  error(...args: unknown[]): void
}

/** 账本对一个 (route, model) 计过什么。`unpriced` 按当前表判定，与成本层
 *  定价规则（`rateKeyAt`）一致，故计数与金额一致。 */
export interface LedgerModelUsage {
  records: number
  firstAt: number
  /** 按当前价折算不出金额的请求（整行没有价，或按美元报价却没设汇率）。
   *  它们计 ¥0，并由价格表的分组摘要报出。 */
  unpriced: number
}

/** 账本计过什么，按 route 与 (route, model)。 */
export interface LedgerUsage {
  byRouteModel: ReadonlyMap<string, ReadonlyMap<string, LedgerModelUsage>>
  byRoute: ReadonlyMap<string, number>
}

/** 把账本行折成价格视图的用量透镜。失败尝试命名 route 但没有计费调用，故
 *  不进；未归属行无法定价，也不进。 */
export function ledgerUsageOf(
  records: readonly UsageRecord[],
  table: PricingTable,
  holidays: ReadonlySet<string>,
): LedgerUsage {
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
      ?? { records: 0, firstAt: record.time, unpriced: 0 }
    row.records += 1
    if (record.time < row.firstAt) row.firstAt = record.time
    if (rateKeyAt(table, route, record.model, record.time, holidays).unpriced === true) row.unpriced += 1
    models.set(record.model, row)
    byRoute.set(route, (byRoute.get(route) ?? 0) + 1)
  }
  return { byRouteModel, byRoute }
}

function earliestRecordAt(ledger: LedgerUsage): number | null {
  let earliest: number | null = null
  for (const models of ledger.byRouteModel.values()) {
    for (const usage of models.values()) {
      if (earliest === null || usage.firstAt < earliest) earliest = usage.firstAt
    }
  }
  return earliest
}

/**
 * 账本覆盖到、而年历里没有的年份——从那一年起到今年。这些年的 `workdays` 会
 * 退化成「周一至周五全额高峰」（法定节假日多算），所以价格表 tab 把它显式报出来：
 * 这是这套设计里唯一要人记得做的事（国家每年底公布一次安排），必须自己喊。
 */
function missingCalendarYears(ledger: LedgerUsage, calendar: HolidayCalendar, now: number): string[] {
  const earliest = earliestRecordAt(ledger)
  if (earliest === null) return []
  const taken = new Set(Object.keys(calendar))
  const missing: string[] = []
  for (let year = new Date(earliest).getFullYear(); year <= new Date(now).getFullYear(); year += 1) {
    const key = String(year)
    if (!taken.has(key)) missing.push(key)
  }
  return missing
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

/** 表里的一份价 → wire 形态（wire 不带任何快照，client 按当前时刻现算生效时段）。 */
function entryInput(entry: PriceEntry): PricingEntryInput {
  const slots = (entry.slots ?? []).map(slotInput)
  return {
    inputPerMillion: entry.rates.inputPerMillion,
    outputPerMillion: entry.rates.outputPerMillion,
    ...(entry.rates.cacheReadPerMillion !== undefined
      ? { cacheReadPerMillion: entry.rates.cacheReadPerMillion } : {}),
    ...(entry.rates.cacheWritePerMillion !== undefined
      ? { cacheWritePerMillion: entry.rates.cacheWritePerMillion } : {}),
    ...(slots.length > 0 ? { slots } : {}),
  }
}

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
      // 配置里的名字优先于适配器目录的名字；账本与价文件从不给串命名。
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
          unpriced: usage.unpriced,
        })
        continue
      }
      row.records = usage.records
      row.firstAt = usage.firstAt
      row.unpriced = usage.unpriced
    }
  }
  for (const [route, byModel] of Object.entries(file.table)) {
    const models = ensure(route)
    for (const model of Object.keys(byModel)) {
      if (!models.has(model)) models.set(model, { configured: false, records: 0 })
    }
  }
  // 只出现在 `$billing` / `$currency` 里的路由也有卡片：价表 tab 的保存是整份重写，
  // 没有卡片就没有草稿行，这些手写的键会在下一次自动保存时静默消失。
  for (const route of [...Object.keys(file.billing), ...Object.keys(file.currency)]) ensure(route)

  const now = Date.now()
  const cards: PricingRouteView[] = []
  for (const [route, entry] of routes) {
    const models: PricingModelView[] = []
    for (const [model, acc] of entry.models) {
      const price = file.table[route]?.[model]
      models.push({
        model,
        ...(acc.name !== undefined ? { name: acc.name } : {}),
        configured: acc.configured,
        records: acc.records,
        ...(acc.unpriced !== undefined ? { unpriced: acc.unpriced } : {}),
        ...(price !== undefined ? { price: entryInput(price) } : {}),
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
      currency: file.currency[route] ?? 'CNY',
      records: ledger.byRoute.get(route) ?? 0,
      models,
    })
  }
  cards.sort((left, right) => right.records - left.records || left.route.localeCompare(right.route))
  return {
    routes: cards,
    calendar: file.calendar,
    calendarMissing: missingCalendarYears(ledger, file.calendar, now),
    ...(file.fx !== undefined ? { fx: file.fx } : {}),
    dataDir: dir,
    updatedAt: now,
  }
}
