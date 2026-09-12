/**
 * The 价格表 tab's data assembly: the cards the pricing view renders, built as
 * the union of three sources that each know part of the truth —
 *
 *   · the route catalog (settings profiles ∪ the live adapter registry),
 *   · every route and model the ledger billed, and
 *   · everything the price file names,
 *
 * so a route that disappeared from configuration — or that only carries a
 * hand-written price — stays visible and editable instead of orphaning its
 * money.
 *
 * Separate from `./pricing.ts`, which owns the price FILE itself (read, write,
 * resolve): this module only decides what the tab shows, and owns no rule about
 * what a price means.
 *
 * @module dsh-tokbook/pricing-view
 */

import { instantKey, EARLIEST } from './price-format.ts'
import { billingOf, priceAt, rateKeyAt, readPriceFile } from './pricing.ts'
import type {
  PriceSegment, PriceSlot, PricingModelView, PricingRouteView, PricingSegmentInput, PricingSlotInput,
  PricingTable, PricingView, UsageRecord,
} from './types.ts'
interface Logger {
  error(...args: unknown[]): void
}

/** One model a route can be billed for: the exact string records carry, plus
 *  the human name a source gives it (settings `models[].name`, else the
 *  adapter catalog's `name`) — the same pair the model picker renders, where
 *  the name is the label and the exact id stays the identity. */
export interface ModelEntry {
  /** Exact model string, as the ledger records it. */
  id: string
  /** Display name; absent when nothing names this string. */
  name?: string
}

/** One route's catalog entry: the models it can currently be billed for, and
 *  the label to head its card with. */
export interface RouteCatalogEntry {
  route: string
  label: string
  models: readonly ModelEntry[]
}

/** What the ledger billed one (route, model): the count the row shows, when it
 *  was first and last billed, and how much of it the price table does not
 *  cover. */
export interface LedgerModelUsage {
  /** Recorded requests naming this exact string. */
  records: number
  /** Timestamp of its first recorded request. */
  firstAt: number
  /** Timestamp of its last one. */
  lastAt: number
  /** Requests no price segment covers at their own timestamp. They bill ¥0, and
   *  a row that HAS a price can still hold them: a written 生效时间 cuts off
   *  everything before it, silently. The 价格表 has to be able to say so, which
   *  is why the count travels with the row. */
  unpriced: number
}

/** What the ledger billed, per route and per (route, model). */
export interface LedgerUsage {
  /** route → exact model string → what that row was billed. */
  byRouteModel: ReadonlyMap<string, ReadonlyMap<string, LedgerModelUsage>>
  /** route → recorded requests over the whole route. */
  byRoute: ReadonlyMap<string, number>
}

/** Fold the ledger's rows into the pricing view's usage lens. Failed attempts
 *  name a route but no billed call, so they stay out — the card's
 *  「账本 N 次」 means the same thing the 通道用量 tab's request count does.
 *  Unattributed rows (no route header was ever seen) cannot be priced and stay
 *  out of the 价格表 cards.
 *
 *  `unpriced` is judged per record against the CURRENT table — the same rule the
 *  cost layer prices with (`rateKeyAt`), so the count and the money agree: it
 *  rises exactly when a row's history stops being covered (a 生效时间 added to
 *  the segment that used to be 无起点). */
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
 * Assemble the 价格表 cards: one card per provider route, one row per model the
 * route can be billed for. A row's `now` is the WHOLE-DAY price of the segment
 * in force at read time — exactly what the row's inline cells edit; the peak and
 * off-peak exception slots live one level down in its `segments`.
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
    /** The ledger's own facts, present once the row has one record. */
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
      // The configured name wins over a later adapter-only one; the ledger and
      // the price file never name a string, so a 仅账本 row keeps no name.
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
      const hit = segments === undefined ? null : priceAt(file.table, route, model, now)
      models.push({
        model,
        ...(acc.name !== undefined ? { name: acc.name } : {}),
        configured: acc.configured,
        records: acc.records,
        ...(acc.firstAt !== undefined ? { firstAt: acc.firstAt } : {}),
        ...(acc.lastAt !== undefined ? { lastAt: acc.lastAt } : {}),
        ...(acc.unpriced !== undefined ? { unpriced: acc.unpriced } : {}),
        segments: (segments ?? []).map(segmentInput),
        ...(hit !== null
          ? { now: hit.rates, nowFrom: hit.from > EARLIEST ? instantKey(hit.from) : null }
          : {}),
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
