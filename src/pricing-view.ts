import { MODELS_DEV_URL } from './models-dev.ts'
import { billingOf, rateKeyAt, readPriceFile } from './pricing.ts'
import { PRICING_SYNC_RETRY_MS, readPricingSyncState } from './pricing-sync-state.ts'
import type {
  HolidayCalendar, HolidaySyncView, PriceEntry, PriceSlot, PricingEntryInput, PricingModelView,
  PricingRouteView, PricingSlotInput, PricingSyncView, PricingTable, PricingView, RouteCatalogEntry, UsageRecord,
} from './types.ts'

interface Logger {
  error(...args: unknown[]): void
}

export interface LedgerModelUsage {
  records: number
  firstAt: number
  unpriced: number
}

export interface LedgerUsage {
  byRouteModel: ReadonlyMap<string, ReadonlyMap<string, LedgerModelUsage>>
  byRoute: ReadonlyMap<string, number>
}

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
  holidays?: { readonly calendar: HolidayCalendar; readonly autoOnly: readonly string[]; readonly sync: HolidaySyncView },
  syncView?: PricingSyncView,
): Promise<PricingView> {
  const [file, syncState] = await Promise.all([readPriceFile(dir, logger), readPricingSyncState(dir)])
  interface ModelAcc {
    configured: boolean
    records: number
    name?: string
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
  const calendar = holidays?.calendar ?? file.calendar
  const autoOnly = holidays?.autoOnly ?? []
  return {
    routes: cards,
    calendar,
    calendarMissing: missingCalendarYears(ledger, calendar, now),
    ...(autoOnly.length > 0 ? { calendarAuto: [...autoOnly] } : {}),
    ...(holidays !== undefined ? { holidaySync: holidays.sync } : {}),
    ...(file.fx !== undefined ? { fx: file.fx } : {}),
    sync: syncView ?? {
      source: { label: 'models.dev', url: MODELS_DEV_URL },
      refreshDays: 1,
      retryMinutes: Math.round(PRICING_SYNC_RETRY_MS / 60_000),
      state: syncState.lastError !== null ? 'failed' : syncState.lastAttemptAt === null ? 'missing' : 'ok',
      gaps: 0,
      lastSuccessDay: syncState.lastSyncDay,
      lastAdded: syncState.lastAdded,
      lastAttemptAt: syncState.lastAttemptAt,
      lastError: syncState.lastError,
      nextAttemptAt: syncState.nextAttemptAt,
    },
    dataDir: dir,
    updatedAt: now,
  }
}
