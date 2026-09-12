/**
 * The hand-written price table of the token-book.
 *
 * ONE file, ONE axis: `pricing.json` maps a provider route key → an exact model
 * string → that pair's price timeline. A segment is four whole-day ¥/M rates
 * plus the instant it takes effect — a local date, or a local date and an exact
 * hour — and, optionally, the exception slots that override those rates inside
 * an hour range on a day set (工作日早高峰, 周末通宵…). A record is priced by the
 * LAST segment whose effective instant has arrived, then by the slot of that
 * segment in force at the record's own local time (no slot in force = the
 * whole-day price), so backdating or re-slotting a price re-prices history and
 * no aggregation is ever rebuilt. Nothing else decides a price: there is no
 * cloud mirror and no global per-model layer — every (route, model) is the
 * user's own number, and a pair nobody priced bills ¥0 while surfacing as
 * 价格未知.
 *
 * The file has exactly one reserved key, `$billing`: route → billing nature
 * (`metered` = real spend, `subscription` = folded plan value). It is a
 * channel-level fact, the same way the ledger records a channel per row.
 *
 * Reading is lenient (a malformed segment or slot is dropped, never fatal);
 * writing is strict and replaces the whole file, so a bad PUT cannot
 * half-apply. The time axis itself — instants, hours and day sets — is shared
 * with the browser half through `./price-format.ts`, so the draft the tab
 * accepts is exactly what this writer takes.
 *
 * @module dsh-tokbook/pricing
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DAY_SETS, EARLIEST, instantKey, instantMs, isHourRange, slotCovers, slotsOverlap,
} from './price-format.ts'
import type {
  BillingMap, BillingNature, ModelPricing, PriceSegment, PriceSlot, PricingSegmentInput, PricingSlotInput,
  PricingTable, RateKey, SlotRef, UsageTotals,
} from './types.ts'
import { UNPRICED_KEY } from './types.ts'

/** The price file's name inside the data directory. */
export const PRICING_FILE = 'pricing.json'

/** The file's one reserved top-level key (route → billing nature). */
export const PRICING_BILLING_KEY = '$billing'

export { DAY_SETS, EARLIEST, dayKeyOf, dayStartMs, instantKey, instantMs } from './price-format.ts'

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

/** The rates a 峰谷时段 restates: any non-empty subset of the four buckets. A
 *  bucket it omits keeps the segment's whole-day rate, so a peak window can
 *  restate just what differs. Null = nothing rate-shaped in there at all. */
function coerceSlotRates(raw: Record<string, unknown>): ModelPricing | null {
  const rates: ModelPricing = {
    ...(isRate(raw.inputPerMillion) ? { inputPerMillion: raw.inputPerMillion } : {}),
    ...(isRate(raw.outputPerMillion) ? { outputPerMillion: raw.outputPerMillion } : {}),
    ...(isRate(raw.cacheReadPerMillion) ? { cacheReadPerMillion: raw.cacheReadPerMillion } : {}),
    ...(isRate(raw.cacheWritePerMillion) ? { cacheWritePerMillion: raw.cacheWritePerMillion } : {}),
  } as ModelPricing
  return Object.keys(rates).length === 0 ? null : rates
}

/** One 峰谷时段 of the file: the hours and days it covers, plus the buckets it
 *  restates. A malformed slot (bad hours, an unknown day set, no usable rate)
 *  is dropped — never applied with a guessed day set, which would silently bill
 *  every day at the exception price. */
function coerceSlot(raw: unknown): PriceSlot | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const slot = raw as Record<string, unknown>
  const rates = coerceSlotRates(slot)
  if (rates === null) return null
  if (typeof slot.start !== 'number' || typeof slot.end !== 'number') return null
  if (!isHourRange({ start: slot.start, end: slot.end })) return null
  let days: PriceSlot['days'] = 'daily'
  if (slot.days !== undefined) {
    const named = DAY_SETS.find(item => item === slot.days)
    if (named === undefined) return null
    days = named
  }
  return { days, start: slot.start, end: slot.end, rates }
}

/** Ascending by start hour, overlapping slots dropped (the file's EARLIER slot
 *  wins — the read path never throws). */
function normalizeSlots(slots: readonly PriceSlot[]): PriceSlot[] {
  const out: PriceSlot[] = []
  for (const slot of [...slots].sort((left, right) =>
    left.start - right.start || DAY_SETS.indexOf(left.days) - DAY_SETS.indexOf(right.days))) {
    if (out.some(kept => slotsOverlap(kept, slot))) continue
    out.push(slot)
  }
  return out
}

function coerceSegment(raw: unknown): PriceSegment | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const segment = raw as Record<string, unknown>
  const rates = coerceRates(segment)
  if (rates === null) return null
  let from = EARLIEST
  if (segment.from !== undefined && segment.from !== null && segment.from !== '') {
    if (typeof segment.from !== 'string') return null
    const at = instantMs(segment.from)
    if (at === null) return null
    from = at
  }
  const slots = Array.isArray(segment.slots)
    ? normalizeSlots(segment.slots.map(coerceSlot).filter((slot): slot is PriceSlot => slot !== null))
    : []
  const note = typeof segment.note === 'string' && segment.note.trim() !== ''
    ? segment.note.trim().slice(0, MAX_NOTE_LENGTH)
    : undefined
  return {
    from,
    rates,
    ...(slots.length > 0 ? { slots } : {}),
    ...(note !== undefined ? { note } : {}),
  }
}

/** Ascending by effective instant, one segment per instant (the file's FIRST
 *  segment for a repeated instant wins — the read path never throws). */
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

const SLOT_FIELDS = new Set([
  'days', 'start', 'end', 'inputPerMillion', 'outputPerMillion', 'cacheReadPerMillion', 'cacheWritePerMillion',
])

/** Strict parse of one 峰谷时段: hours inside one local day, a known day set,
 *  and any non-empty subset of the four rates — a bucket left out keeps the
 *  segment's whole-day rate. */
function parseSlot(value: unknown, where: string): { ok: true; slot: PriceSlot } | { ok: false; error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: `${where}必须是对象（start + end + 要覆盖的档位单价）` }
  }
  const raw = value as Record<string, unknown>
  const extra = Object.keys(raw).find(key => !SLOT_FIELDS.has(key))
  if (extra !== undefined) return { ok: false, error: `${where}含未知字段「${extra}」` }
  let days: PriceSlot['days'] = 'daily'
  if (raw.days !== undefined) {
    if (typeof raw.days !== 'string' || !DAY_SETS.includes(raw.days as PriceSlot['days'])) {
      return { ok: false, error: `${where}的 days 必须是 "daily" / "weekdays" / "weekends"` }
    }
    days = raw.days as PriceSlot['days']
  }
  if (typeof raw.start !== 'number' || typeof raw.end !== 'number' || !isHourRange({ start: raw.start, end: raw.end })) {
    return { ok: false, error: `${where}的时段必须是整数整点，且 0 ≤ start < end ≤ 24（24 = 当天结束）` }
  }
  for (const key of ['inputPerMillion', 'outputPerMillion', 'cacheReadPerMillion', 'cacheWritePerMillion'] as const) {
    if (raw[key] !== undefined && !isRate(raw[key])) {
      return { ok: false, error: `${where}的 ${key} 必须是非负数字（要沿用全天价就别写它）` }
    }
  }
  const rates = coerceSlotRates(raw)
  if (rates === null) {
    return { ok: false, error: `${where}至少要写一档价（输入 / 输出 / 缓存读 / 缓存写），否则整条时段等于全天价` }
  }
  return { ok: true, slot: { days, start: raw.start, end: raw.end, rates } }
}

function parseSegment(value: unknown, where: string): { ok: true; segment: PriceSegment } | { ok: false; error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: `${where}必须是对象（from? + 四档单价 + slots?）` }
  }
  const raw = value as Record<string, unknown>
  const known = new Set(['from', 'inputPerMillion', 'outputPerMillion', 'cacheReadPerMillion', 'cacheWritePerMillion', 'slots', 'note'])
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
    if (typeof raw.from !== 'string') {
      return { ok: false, error: `${where}的 from 必须是 YYYY-MM-DD 或 YYYY-MM-DDTHH:00（省略 = 无起点，自始生效）` }
    }
    const at = instantMs(raw.from)
    if (at === null) {
      return { ok: false, error: `${where}的 from 必须是真实存在的 YYYY-MM-DD 或整点 YYYY-MM-DDTHH:00：${raw.from}` }
    }
    from = at
  }
  if (raw.note !== undefined && typeof raw.note !== 'string') {
    return { ok: false, error: `${where}的 note 必须是字符串` }
  }
  const note = typeof raw.note === 'string' ? raw.note.trim() : ''
  if (note.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: `${where}的 note 过长（最多 ${String(MAX_NOTE_LENGTH)} 字）` }
  }
  const slots: PriceSlot[] = []
  if (raw.slots !== undefined) {
    if (!Array.isArray(raw.slots)) return { ok: false, error: `${where}的 slots 必须是数组` }
    for (let index = 0; index < raw.slots.length; index += 1) {
      const parsed = parseSlot(raw.slots[index], `${where}第 ${String(index + 1)} 个例外时段`)
      if (!parsed.ok) return { ok: false, error: parsed.error }
      const clash = slots.find(kept => slotsOverlap(kept, parsed.slot))
      if (clash !== undefined) {
        return {
          ok: false,
          error: `${where}的例外时段重叠：${clash.start}–${clash.end} 与 ${parsed.slot.start}–${parsed.slot.end} 会在同一时刻同时生效`,
        }
      }
      slots.push(parsed.slot)
    }
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
      ...(slots.length > 0 ? { slots: normalizeSlots(slots) } : {}),
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
          const label = parsed.segment.from === EARLIEST ? '无起点' : instantKey(parsed.segment.from)
          return { ok: false, error: `${where}有两段的生效时间相同（${label}）：同一时刻只能有一段价` }
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

/** One exception slot of one segment, as the file writes it. */
function slotBody(slot: PriceSlot): Record<string, unknown> {
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

/** The file body of one price file: routes and models sorted, the reserved
 *  `$billing` section first, segments ascending by effective instant and the
 *  exception slots inside each ascending by start hour. */
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
      priced[model] = segments.map((segment) => {
        const slots = segment.slots ?? []
        return {
          ...(segment.from > EARLIEST ? { from: instantKey(segment.from) } : {}),
          inputPerMillion: segment.rates.inputPerMillion,
          outputPerMillion: segment.rates.outputPerMillion,
          ...(segment.rates.cacheReadPerMillion !== undefined
            ? { cacheReadPerMillion: segment.rates.cacheReadPerMillion } : {}),
          ...(segment.rates.cacheWritePerMillion !== undefined
            ? { cacheWritePerMillion: segment.rates.cacheWritePerMillion } : {}),
          ...(slots.length > 0 ? { slots: slots.map(slotBody) } : {}),
          ...(segment.note !== undefined ? { note: segment.note } : {}),
        }
      })
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
 *  whose effective instant has arrived. Null = 价格未知 (nothing priced it, or
 *  the instant predates the earliest segment). */
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

/** The exception slot of one segment in force at `timeMs` — by the instant's own
 *  local weekday and hour — or null for the segment's whole-day price. At most
 *  one slot is ever in force: the write path refuses an overlapping pair and the
 *  read path drops the later of the two. */
export function slotAt(segment: PriceSegment, timeMs: number): PriceSlot | null {
  for (const slot of segment.slots ?? []) {
    if (slotCovers(slot, timeMs)) return slot
  }
  return null
}

/** The identity of the slot in force at `timeMs`, or null for the whole-day
 *  price. */
export function slotRefAt(segment: PriceSegment, timeMs: number): SlotRef | null {
  const slot = slotAt(segment, timeMs)
  return slot === null ? null : { start: slot.start, days: slot.days }
}

/** The ¥/M rates of one segment at `timeMs`: its whole-day price with the
 *  exception slot in force layered over it. A rate a slot omits keeps the
 *  whole-day one, so a peak slot may restate only what actually changes. */
export function ratesOfSegment(segment: PriceSegment, timeMs: number): ModelPricing {
  const slot = slotAt(segment, timeMs)
  return slot === null ? segment.rates : { ...segment.rates, ...slot.rates }
}

/** The price in force at `timeMs` for one (route, model), both levels resolved:
 *  the segment whose effective instant has arrived, then its slot for that
 *  instant's local time. Null = 价格未知. */
export function ratesAt(
  table: PricingTable,
  route: string | undefined,
  model: string,
  timeMs: number,
): ModelPricing | null {
  const segment = priceAt(table, route, model, timeMs)
  return segment === null ? null : ratesOfSegment(segment, timeMs)
}

/** The rate identity of one (route, model) at `timeMs` — the effective instant
 *  of the segment that applied plus the slot that applied inside it, or
 *  {@link UNPRICED_KEY}. Holds identity, never numbers, so editing a rate
 *  re-prices history on the next read. */
export function rateKeyAt(
  table: PricingTable,
  route: string | undefined,
  model: string,
  timeMs: number,
): RateKey {
  const hit = priceAt(table, route, model, timeMs)
  return hit === null ? UNPRICED_KEY : { from: hit.from, slot: slotRefAt(hit, timeMs) }
}

/** The price of one rate identity: look the segment's own instant back up under
 *  the current table, then the slot it names (a rate row is keyed by the segment
 *  instant and slot it was billed under, so re-pricing history needs no
 *  per-record timestamps). Null when the table no longer holds that identity —
 *  the segment instant is gone, or the named slot was moved or deleted — which
 *  reads as 价格未知 for exactly those rows. */
export function priceOfKey(
  table: PricingTable,
  route: string | undefined,
  model: string,
  key: RateKey,
): ModelPricing | null {
  if (key.from < 0) return null
  const segment = priceAt(table, route, model, key.from)
  if (segment === null) return null
  const ref = key.slot
  if (ref === undefined || ref === null) return segment.rates
  const slot = (segment.slots ?? []).find(item => item.start === ref.start && item.days === ref.days)
  return slot === undefined ? null : { ...segment.rates, ...slot.rates }
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

