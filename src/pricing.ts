/**
 * The hand-written price table of the token-book.
 *
 * ONE file, ONE axis: `pricing.json` maps a provider route key → an exact model
 * string → that pair's price timeline. A segment is four ¥/M rates plus the
 * date it takes effect; a record is priced by the LAST segment whose effective
 * date has arrived, so backdating a price re-prices history and no aggregation
 * is ever rebuilt. Nothing else decides a price: there is no cloud mirror and
 * no global per-model layer — every (route, model) is the user's own number,
 * and a pair nobody priced bills ¥0 while surfacing as 价格未知.
 *
 * The file has exactly one reserved key, `$billing`: route → billing nature
 * (`metered` = real spend, `subscription` = folded plan value). It is a
 * channel-level fact, the same way the ledger records a channel per row.
 *
 * Reading is lenient (a malformed segment is dropped, never fatal); writing is
 * strict and replaces the whole file, so a bad PUT cannot half-apply.
 *
 * @module dsh-tokbook/pricing
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  BillingMap, BillingNature, ModelPricing, PriceSegment, PricingModelView, PricingRouteView,
  PricingSegmentInput, PricingTable, PricingView, RateKey, UsageTotals,
} from './types.ts'
import { UNPRICED_KEY } from './types.ts'

/** The price file's name inside the data directory. */
export const PRICING_FILE = 'pricing.json'

/** The file's one reserved top-level key (route → billing nature). */
export const PRICING_BILLING_KEY = '$billing'

/** The `from` of a segment with no effective date: 最早一段, i.e. it has always
 *  applied. Stored as 0 so a plain `from <= timeMs` comparison works. */
export const EARLIEST = 0

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u
const MAX_NOTE_LENGTH = 120
const MAX_ROUTE_LENGTH = 128
const MAX_MODEL_LENGTH = 256

interface Logger {
  error(...args: unknown[]): void
}

/** The whole price file: the (route, model) timelines plus the billing map.
 *  `revision` is a content signature — the derived rollup records the revision
 *  its rate rows were folded under, and a different one rebuilds it. */
export interface PriceFile {
  table: PricingTable
  billing: BillingMap
  revision: string
}

/** One route's catalog entry: the models it can currently be billed for, and
 *  the label to head its card with. */
export interface RouteCatalogEntry {
  route: string
  label: string
  models: readonly string[]
}

/** What the ledger billed, per route and per (route, model). */
export interface LedgerUsage {
  /** route → exact model string → recorded requests. */
  byRouteModel: ReadonlyMap<string, ReadonlyMap<string, number>>
  /** route → recorded requests over the whole route. */
  byRoute: ReadonlyMap<string, number>
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Local-midnight epoch ms of a `YYYY-MM-DD` date; null when it is not a real
 *  calendar date (2026-02-31 is not). */
export function dayStartMs(date: string): number | null {
  if (!DATE_RE.test(date)) return null
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const at = new Date(year, month - 1, day)
  if (at.getFullYear() !== year || at.getMonth() !== month - 1 || at.getDate() !== day) return null
  return at.getTime()
}

/** The local `YYYY-MM-DD` of an epoch-ms instant. */
export function dayKeyOf(ms: number): string {
  const at = new Date(ms)
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${String(at.getFullYear())}-${month}-${day}`
}

// ---------------------------------------------------------------------------
// Reading (lenient) and writing (strict)
// ---------------------------------------------------------------------------

function isRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

async function readTextFile(dir: string, name: string, logger: Logger): Promise<string | null> {
  try {
    return await readFile(join(dir, name), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    logger.error(`[tokbook] cannot read ${name}:`, error)
    return null
  }
}

/** A cheap content signature (djb2, hex): the rollup only needs to tell one
 *  price file from another, not to resist tampering. */
function revisionOf(text: string): string {
  let hash = 5381
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0
  }
  return `${(hash >>> 0).toString(16)}:${String(text.length)}`
}

function parseJson(text: string, name: string, logger: Logger): unknown {
  try {
    return JSON.parse(text)
  } catch {
    logger.error(`[tokbook] ${name} is not valid JSON; treating it as empty`)
    return null
  }
}

function coerceRates(raw: Record<string, unknown>): ModelPricing | null {
  if (!isRate(raw.inputPerMillion) || !isRate(raw.outputPerMillion)) return null
  return {
    inputPerMillion: raw.inputPerMillion,
    outputPerMillion: raw.outputPerMillion,
    ...(isRate(raw.cacheReadPerMillion) ? { cacheReadPerMillion: raw.cacheReadPerMillion } : {}),
    ...(isRate(raw.cacheWritePerMillion) ? { cacheWritePerMillion: raw.cacheWritePerMillion } : {}),
  }
}

function coerceSegment(raw: unknown): PriceSegment | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const segment = raw as Record<string, unknown>
  const rates = coerceRates(segment)
  if (rates === null) return null
  let from = EARLIEST
  if (segment.from !== undefined && segment.from !== null && segment.from !== '') {
    if (typeof segment.from !== 'string') return null
    const at = dayStartMs(segment.from)
    if (at === null) return null
    from = at
  }
  const note = typeof segment.note === 'string' && segment.note.trim() !== ''
    ? segment.note.trim().slice(0, MAX_NOTE_LENGTH)
    : undefined
  return { from, rates, ...(note !== undefined ? { note } : {}) }
}

/** Ascending by effective date, one segment per date (the file's FIRST segment
 *  for a repeated date wins — the read path never throws). */
function normalizeSegments(segments: readonly PriceSegment[]): PriceSegment[] {
  const out: PriceSegment[] = []
  for (const segment of [...segments].sort((left, right) => left.from - right.from)) {
    const last = out[out.length - 1]
    if (last !== undefined && last.from === segment.from) continue
    out.push(segment)
  }
  return out
}

/** Lenient coercion of one file body: malformed routes / models / segments are
 *  dropped (never fatal), the way the ledger reads its own day files. */
export function coercePriceFile(value: unknown, logger: Logger = console): PriceFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    logger.error(`[tokbook] ${PRICING_FILE} is not a JSON object; treating it as empty`)
    return { table: {}, billing: {}, revision: '' }
  }
  const raw = value as Record<string, unknown>
  const table: PricingTable = {}
  const billing: BillingMap = {}
  const rawBilling = raw[PRICING_BILLING_KEY]
  if (typeof rawBilling === 'object' && rawBilling !== null && !Array.isArray(rawBilling)) {
    for (const [route, nature] of Object.entries(rawBilling as Record<string, unknown>)) {
      if (route === '') continue
      if (nature === 'metered' || nature === 'subscription') billing[route] = nature
    }
  }
  for (const [route, models] of Object.entries(raw)) {
    if (route === '' || route.startsWith('$')) continue
    if (typeof models !== 'object' || models === null || Array.isArray(models)) continue
    const priced: Record<string, PriceSegment[]> = {}
    for (const [model, list] of Object.entries(models as Record<string, unknown>)) {
      if (model === '' || !Array.isArray(list)) continue
      const segments = normalizeSegments(
        list.map(coerceSegment).filter((segment): segment is PriceSegment => segment !== null),
      )
      if (segments.length > 0) priced[model] = segments
    }
    if (Object.keys(priced).length > 0) table[route] = priced
  }
  return { table, billing, revision: '' }
}

/** The price file of one data directory. A missing / malformed file reads as
 *  an empty table (nothing is priced). The revision is the file TEXT's
 *  signature, so any edit — including one this process did not make — is
 *  visible to the derived rollup without a restart. */
export async function readPriceFile(dir: string, logger: Logger = console): Promise<PriceFile> {
  const text = await readTextFile(dir, PRICING_FILE, logger)
  if (text === null) return { table: {}, billing: {}, revision: '' }
  const raw = parseJson(text, PRICING_FILE, logger)
  if (raw === null) return { table: {}, billing: {}, revision: revisionOf(text) }
  return { ...coercePriceFile(raw, logger), revision: revisionOf(text) }
}

function parseSegment(value: unknown, where: string): { ok: true; segment: PriceSegment } | { ok: false; error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: `${where}必须是对象（from? + 四档单价）` }
  }
  const raw = value as Record<string, unknown>
  const known = new Set(['from', 'inputPerMillion', 'outputPerMillion', 'cacheReadPerMillion', 'cacheWritePerMillion', 'note'])
  const extra = Object.keys(raw).find(key => !known.has(key))
  if (extra !== undefined) return { ok: false, error: `${where}含未知字段「${extra}」` }
  if (!isRate(raw.inputPerMillion) || !isRate(raw.outputPerMillion)) {
    return { ok: false, error: `${where}缺少合法的 inputPerMillion / outputPerMillion（非负数字）` }
  }
  if (raw.cacheReadPerMillion !== undefined && !isRate(raw.cacheReadPerMillion)) {
    return { ok: false, error: `${where}的 cacheReadPerMillion 必须是非负数字` }
  }
  if (raw.cacheWritePerMillion !== undefined && !isRate(raw.cacheWritePerMillion)) {
    return { ok: false, error: `${where}的 cacheWritePerMillion 必须是非负数字` }
  }
  let from = EARLIEST
  if (raw.from !== undefined && raw.from !== null && raw.from !== '') {
    if (typeof raw.from !== 'string' || !DATE_RE.test(raw.from)) {
      return { ok: false, error: `${where}的 from 必须是 YYYY-MM-DD 日期（省略 = 最早一段）` }
    }
    const at = dayStartMs(raw.from)
    if (at === null) return { ok: false, error: `${where}的 from 不是有效日期：${raw.from}` }
    from = at
  }
  if (raw.note !== undefined && typeof raw.note !== 'string') {
    return { ok: false, error: `${where}的 note 必须是字符串` }
  }
  const note = typeof raw.note === 'string' ? raw.note.trim() : ''
  if (note.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: `${where}的 note 过长（最多 ${String(MAX_NOTE_LENGTH)} 字）` }
  }
  return {
    ok: true,
    segment: {
      from,
      rates: {
        inputPerMillion: raw.inputPerMillion,
        outputPerMillion: raw.outputPerMillion,
        ...(raw.cacheReadPerMillion !== undefined ? { cacheReadPerMillion: raw.cacheReadPerMillion } : {}),
        ...(raw.cacheWritePerMillion !== undefined ? { cacheWritePerMillion: raw.cacheWritePerMillion } : {}),
      },
      ...(note !== '' ? { note } : {}),
    },
  }
}

/** The verdict of one PUT body. */
export type PriceParse = { ok: true; file: PriceFile } | { ok: false; error: string }

/** Strict parse of a complete desired file: every deviation is refused with the
 *  offending location, so a bad body never half-applies. */
export function parsePriceInput(value: unknown): PriceParse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: '价格表必须是 JSON 对象（路由 → 模型串 → 价段数组）' }
  }
  const raw = value as Record<string, unknown>
  const table: PricingTable = {}
  const billing: BillingMap = {}
  for (const [route, models] of Object.entries(raw)) {
    if (route.startsWith('$')) {
      if (route !== PRICING_BILLING_KEY) {
        return { ok: false, error: `未知保留键「${route}」（只支持 ${PRICING_BILLING_KEY}）` }
      }
      if (typeof models !== 'object' || models === null || Array.isArray(models)) {
        return { ok: false, error: `${PRICING_BILLING_KEY} 必须是对象（路由 → "metered" | "subscription"）` }
      }
      for (const [key, nature] of Object.entries(models as Record<string, unknown>)) {
        if (key === '') return { ok: false, error: `${PRICING_BILLING_KEY} 下存在空路由名` }
        if (nature !== 'metered' && nature !== 'subscription') {
          return { ok: false, error: `「${key}」的计费性质必须是 "metered" 或 "subscription"` }
        }
        billing[key] = nature
      }
      continue
    }
    if (route === '') return { ok: false, error: '存在空通道路由名' }
    if (route.length > MAX_ROUTE_LENGTH) return { ok: false, error: `通道路由名过长：${route.slice(0, 40)}…` }
    if (typeof models !== 'object' || models === null || Array.isArray(models)) {
      return { ok: false, error: `「${route}」必须是对象（模型串 → 价段数组）` }
    }
    const priced: Record<string, PriceSegment[]> = {}
    for (const [model, list] of Object.entries(models as Record<string, unknown>)) {
      const where = `「${route}」的「${model}」`
      if (model === '') return { ok: false, error: `「${route}」下存在空模型串` }
      if (model.length > MAX_MODEL_LENGTH) return { ok: false, error: `模型串过长：${model.slice(0, 40)}…` }
      if (!Array.isArray(list)) return { ok: false, error: `${where}必须是价段数组` }
      if (list.length === 0) continue // 空数组 = 这条价不存在（等价于省略）
      const segments: PriceSegment[] = []
      const seen = new Set<number>()
      for (let index = 0; index < list.length; index += 1) {
        const parsed = parseSegment(list[index], `${where}第 ${String(index + 1)} 段`)
        if (!parsed.ok) return { ok: false, error: parsed.error }
        if (seen.has(parsed.segment.from)) {
          const label = parsed.segment.from === EARLIEST ? '最早一段' : dayKeyOf(parsed.segment.from)
          return { ok: false, error: `${where}有两段的生效日期相同（${label}）：同一时刻只能有一段价` }
        }
        seen.add(parsed.segment.from)
        segments.push(parsed.segment)
      }
      priced[model] = segments.sort((left, right) => left.from - right.from)
    }
    if (Object.keys(priced).length > 0) table[route] = priced
  }
  return { ok: true, file: { table, billing, revision: '' } }
}

/** The file body of one price file: routes and models sorted, the reserved
 *  `$billing` section first, segments ascending by effective date. */
export function priceFileBody(file: PriceFile): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const billingRoutes = Object.keys(file.billing).sort((left, right) => left.localeCompare(right))
  if (billingRoutes.length > 0) {
    const billing: Record<string, BillingNature> = {}
    for (const route of billingRoutes) billing[route] = file.billing[route]!
    body[PRICING_BILLING_KEY] = billing
  }
  for (const route of Object.keys(file.table).sort((left, right) => left.localeCompare(right))) {
    const models = file.table[route]!
    const priced: Record<string, unknown[]> = {}
    for (const model of Object.keys(models).sort((left, right) => left.localeCompare(right))) {
      const segments = models[model]!
      if (segments.length === 0) continue
      priced[model] = segments.map(segment => ({
        ...(segment.from > EARLIEST ? { from: dayKeyOf(segment.from) } : {}),
        inputPerMillion: segment.rates.inputPerMillion,
        outputPerMillion: segment.rates.outputPerMillion,
        ...(segment.rates.cacheReadPerMillion !== undefined
          ? { cacheReadPerMillion: segment.rates.cacheReadPerMillion } : {}),
        ...(segment.rates.cacheWritePerMillion !== undefined
          ? { cacheWritePerMillion: segment.rates.cacheWritePerMillion } : {}),
        ...(segment.note !== undefined ? { note: segment.note } : {}),
      }))
    }
    if (Object.keys(priced).length > 0) body[route] = priced
  }
  return body
}

/** Persist the whole price file atomically (temp file + rename; the previous
 *  file is kept as `.bak` until the rename lands, because Windows
 *  rename-over-existing fails intermittently and a missing `pricing.json`
 *  must never read as an empty table). */
export async function writePriceFile(dir: string, file: PriceFile, logger: Logger = console): Promise<void> {
  const target = join(dir, PRICING_FILE)
  const tmp = join(dir, `${PRICING_FILE}.tmp`)
  const backup = join(dir, `${PRICING_FILE}.bak`)
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(tmp, `${JSON.stringify(priceFileBody(file), null, 2)}\n`, 'utf8')
    // Keep the previous file until the rename lands: a crash between remove
    // and rename would leave pricing.json missing (read as an empty table),
    // and an auto-save of that empty view would then erase a hand-written book.
    await rename(target, backup).catch(() => undefined)
    await rename(tmp, target)
  } catch (error) {
    logger.error(`[tokbook] cannot write ${PRICING_FILE}:`, error)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** The segment in force at `timeMs` for one (route, model): the last segment
 *  whose effective date has arrived. Null = 价格未知 (nothing priced it, or the
 *  instant predates the earliest segment). */
export function priceAt(
  table: PricingTable,
  route: string | undefined,
  model: string,
  timeMs: number,
): PriceSegment | null {
  const segments = route === undefined || route === '' ? undefined : table[route]?.[model]
  if (segments === undefined || segments.length === 0) return null
  let hit: PriceSegment | null = null
  for (const segment of segments) {
    if (segment.from > timeMs) break
    hit = segment
  }
  return hit
}

/** The rate identity of one (route, model) at `timeMs` — the effective date of
 *  the segment that applied, or {@link UNPRICED_KEY}. Holds identity, never
 *  numbers, so editing a rate re-prices history on the next read. */
export function rateKeyAt(
  table: PricingTable,
  route: string | undefined,
  model: string,
  timeMs: number,
): RateKey {
  const hit = priceAt(table, route, model, timeMs)
  return hit === null ? UNPRICED_KEY : { from: hit.from }
}

/** The price of one rate identity: look the segment's own instant back up under
 *  the current table (a rate row is keyed by the segment start it was billed
 *  under, so re-pricing history needs no per-record timestamps). */
export function priceOfKey(
  table: PricingTable,
  route: string | undefined,
  model: string,
  key: RateKey,
): ModelPricing | null {
  if (key.from < 0) return null
  return priceAt(table, route, model, key.from)?.rates ?? null
}

/** The billing nature of one route: its `$billing` entry, default metered. */
export function billingOf(billing: BillingMap, route: string | undefined): BillingNature {
  if (route === undefined || route === '') return 'metered'
  return billing[route] ?? 'metered'
}

/** Billed cost of one totals row at a resolved price: each bucket at its own
 *  ¥/M rate, the cache buckets falling back to the plain input rate. */
export function costOf(totals: UsageTotals, prices: ModelPricing): number {
  const M = 1_000_000
  const cacheRead = prices.cacheReadPerMillion ?? prices.inputPerMillion
  const cacheWrite = prices.cacheWritePerMillion ?? prices.inputPerMillion
  return (totals.inputTokens * prices.inputPerMillion
    + totals.outputTokens * prices.outputPerMillion
    + totals.cacheReadTokens * cacheRead
    + totals.cacheWriteTokens * cacheWrite) / M
}

// ---------------------------------------------------------------------------
// The 价格表 view
// ---------------------------------------------------------------------------

function segmentInput(segment: PriceSegment): PricingSegmentInput {
  return {
    from: segment.from > EARLIEST ? dayKeyOf(segment.from) : null,
    inputPerMillion: segment.rates.inputPerMillion,
    outputPerMillion: segment.rates.outputPerMillion,
    ...(segment.rates.cacheReadPerMillion !== undefined
      ? { cacheReadPerMillion: segment.rates.cacheReadPerMillion } : {}),
    ...(segment.rates.cacheWritePerMillion !== undefined
      ? { cacheWritePerMillion: segment.rates.cacheWritePerMillion } : {}),
    ...(segment.note !== undefined ? { note: segment.note } : {}),
  }
}

/**
 * Assemble the 价格表 cards: one card per provider route, one row per model the
 * route can be billed for. The route set is the union of
 *   · the route catalog (settings profiles ∪ the live adapter registry), and
 *   · every route the ledger billed, and
 *   · every route the price file mentions,
 * so a route that disappeared from configuration — or that only carries a
 * hand-written price — stays visible and editable instead of orphaning its
 * money. The same union applies inside a card: `configured` marks the models
 * settings/catalog list, and a ledger-only string is kept so its history keeps
 * an editable price.
 */
export async function readPricingView(
  dir: string,
  catalog: readonly RouteCatalogEntry[],
  ledger: LedgerUsage,
  logger: Logger = console,
): Promise<PricingView> {
  const file = await readPriceFile(dir, logger)
  interface ModelAcc { configured: boolean; records: number }
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
      const row = models.get(model)
      if (row === undefined) models.set(model, { configured: true, records: 0 })
      else row.configured = true
    }
  }
  for (const [route, byModel] of ledger.byRouteModel) {
    const models = ensure(route)
    for (const [model, records] of byModel) {
      const row = models.get(model)
      if (row === undefined) models.set(model, { configured: false, records })
      else row.records = records
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
        configured: acc.configured,
        records: acc.records,
        segments: (segments ?? []).map(segmentInput),
        ...(hit !== null
          ? { now: hit.rates, nowFrom: hit.from > EARLIEST ? dayKeyOf(hit.from) : null }
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
