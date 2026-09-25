/**
 * 手工价表：provider route key → 精确 model 串 → 该 pair 的价格时间轴。
 *
 * 读宽松（畸形段/时段丢弃，不致命）；写严格且整文件替换，坏 PUT 不会半落地。
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DAY_SETS, EARLIEST, MAX_MODEL_LENGTH, MAX_ROUTE_LENGTH, PRICING_BILLING_KEY, PRICING_CALENDAR_KEY,
  PRICING_CURRENCY_KEY, PRICING_FX_KEY,
  dayIndex, dayKeyOfIndex, holidayDates, instantKey, instantMs, isHourRange, isValidHolidayRange, isYearKey,
  slotCovers, slotsOverlap, yearOfDate,
} from './price-format.ts'
import type {
  BillingMap, BillingNature, CurrencyMap, FxSetting, HolidayCalendar, HolidayRange, ModelPricing, PriceCurrency,
  PriceSegment, PriceSlot,
  PricingSegmentInput, PricingSlotInput, PricingTable, RateKey, SlotRef, UsageTotals,
} from './types.ts'
import { UNPRICED_KEY } from './types.ts'

export const PRICING_FILE = 'pricing.json'

export {
  DAY_SETS, EARLIEST, PRICING_BILLING_KEY, PRICING_CALENDAR_KEY, PRICING_CURRENCY_KEY, PRICING_FX_KEY,
  dayKeyOf, dayStartMs, instantKey, instantMs,
} from './price-format.ts'

interface Logger {
  error(...args: unknown[]): void
}

/** `revision` 是价文件**文本**的内容签名——派生 rollup 记下其 rate 行所折叠的
 *  revision，不同则重建；外部对文件的任何编辑都因此可见。 */
export interface PriceFile {
  table: PricingTable
  billing: BillingMap
  currency: CurrencyMap
  calendar: HolidayCalendar
  fx?: FxSetting
  revision: string
}

function isRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

async function readTextFile(dir: string, name: string, logger: Logger): Promise<string | null> {
  try {
    const text = await readFile(join(dir, name), 'utf8')
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    logger.error(`[tokbook] cannot read ${name}:`, error)
    return null
  }
}

/** 廉价内容签名（djb2, hex）：rollup 只需区分不同价文件，不需抗篡改。 */
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
  } catch (error) {
    logger.error(`[tokbook] ${name} is not valid JSON; the whole price table is read as empty, so every amount is ¥0`, error)
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

/** 峰谷时段重述的费率：四档的任意非空子集。 */
function coerceSlotRates(raw: Record<string, unknown>): ModelPricing | null {
  const rates: ModelPricing = {
    ...(isRate(raw.inputPerMillion) ? { inputPerMillion: raw.inputPerMillion } : {}),
    ...(isRate(raw.outputPerMillion) ? { outputPerMillion: raw.outputPerMillion } : {}),
    ...(isRate(raw.cacheReadPerMillion) ? { cacheReadPerMillion: raw.cacheReadPerMillion } : {}),
    ...(isRate(raw.cacheWritePerMillion) ? { cacheWritePerMillion: raw.cacheWritePerMillion } : {}),
  } as ModelPricing
  return Object.keys(rates).length === 0 ? null : rates
}

/** 文件中的一个峰谷时段：覆盖的小时与星期集合 + 重述的档位。畸形时段丢弃
 *  ——绝不猜 day set 套用，否则会静默按例外价计费每一天。 */
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

/** 按 start 升序；重叠时段丢弃——文件中较早的时段胜出。 */
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
  // 旧形态（省略 / null / 空串 from）读作哨兵，等视图层迁移成真实日期；迁移前成本层照旧按它计价。
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
  return {
    from,
    rates,
    ...(slots.length > 0 ? { slots } : {}),
  }
}

/** 按生效时刻升序；同一时刻只留一段——文件中该时刻的首段胜出。 */
function normalizeSegments(segments: readonly PriceSegment[]): PriceSegment[] {
  const out: PriceSegment[] = []
  for (const segment of [...segments].sort((left, right) => left.from - right.from)) {
    const last = out[out.length - 1]
    if (last !== undefined && last.from === segment.from) continue
    out.push(segment)
  }
  return out
}

/** 一年里的一段放假日：两端都是真实日期且起不晚于止。 */
function coerceHolidayRange(raw: unknown): HolidayRange | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const range = raw as Record<string, unknown>
  if (typeof range.start !== 'string' || typeof range.end !== 'string') return null
  const parsed: HolidayRange = { start: range.start, end: range.end }
  return isValidHolidayRange(parsed) ? parsed : null
}

/** 读路径的年历：畸形的年 / 区间丢弃（不致命），合法区间合并成不重叠的区间表。 */
function coerceCalendar(raw: unknown): HolidayCalendar {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const calendar: HolidayCalendar = {}
  for (const [year, ranges] of Object.entries(raw as Record<string, unknown>)) {
    if (!isYearKey(year) || !Array.isArray(ranges)) continue
    const kept = mergeHolidayDates(
      ranges.map(coerceHolidayRange).filter((range): range is HolidayRange => range !== null).flatMap(holidayDates),
    )
    if (kept.length > 0) calendar[year] = kept
  }
  return calendar
}

/** 年历在文件里按区间写，所以读（可能来自手写文件）与写都经过这一个合并，
 *  两种形态才收敛到同一份。 */
function mergeHolidayDates(dates: readonly string[]): HolidayRange[] {
  const indexes = [...new Set(dates)].map(dayIndex).filter((index): index is number => index !== null)
  indexes.sort((left, right) => left - right)
  const ranges: HolidayRange[] = []
  for (const index of indexes) {
    const last = ranges[ranges.length - 1]
    // 按天数索引比较，所以夏令时那两天既不会断开一段假期，也不会错并相邻两天。
    if (last !== undefined && index - (dayIndex(last.end) ?? index) === 1) last.end = dayKeyOfIndex(index)
    else ranges.push({ start: dayKeyOfIndex(index), end: dayKeyOfIndex(index) })
  }
  return ranges
}

function coerceFx(raw: unknown): FxSetting | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const value = (raw as Record<string, unknown>).cnyPerUsd
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? { cnyPerUsd: value } : undefined
}

function coerceCurrency(raw: unknown): CurrencyMap {
  const currency: CurrencyMap = {}
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return currency
  for (const [route, value] of Object.entries(raw as Record<string, unknown>)) {
    if (route !== '' && value === 'USD') currency[route] = 'USD'
  }
  return currency
}

export function coercePriceFile(value: unknown, logger: Logger = console): PriceFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    logger.error(`[tokbook] ${PRICING_FILE} is not a JSON object; treating it as empty`)
    return { table: {}, billing: {}, currency: {}, calendar: {}, revision: '' }
  }
  const raw = value as Record<string, unknown>
  const table: PricingTable = {}
  const billing: BillingMap = {}
  const calendar = coerceCalendar(raw[PRICING_CALENDAR_KEY])
  const currency = coerceCurrency(raw[PRICING_CURRENCY_KEY])
  const fx = coerceFx(raw[PRICING_FX_KEY])
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
  return { table, billing, currency, calendar, ...(fx !== undefined ? { fx } : {}), revision: '' }
}

export async function readPriceFile(dir: string, logger: Logger = console): Promise<PriceFile> {
  const text = await readTextFile(dir, PRICING_FILE, logger)
  if (text === null) return { table: {}, billing: {}, currency: {}, calendar: {}, revision: '' }
  const raw = parseJson(text, PRICING_FILE, logger)
  if (raw === null) return { table: {}, billing: {}, currency: {}, calendar: {}, revision: revisionOf(text) }
  return { ...coercePriceFile(raw, logger), revision: revisionOf(text) }
}

const SLOT_FIELDS = new Set([
  'days', 'start', 'end', 'inputPerMillion', 'outputPerMillion', 'cacheReadPerMillion', 'cacheWritePerMillion',
])

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
      return { ok: false, error: `${where}的 ${key} 必须是非负数字（要沿用基准价就别写它）` }
    }
  }
  const rates = coerceSlotRates(raw)
  if (rates === null) {
    return { ok: false, error: `${where}至少要写一档价（输入 / 输出 / 缓存读 / 缓存写），否则整条时段等于基准价` }
  }
  return { ok: true, slot: { days, start: raw.start, end: raw.end, rates } }
}

function parseSegment(value: unknown, where: string): { ok: true; segment: PriceSegment } | { ok: false; error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: `${where}必须是对象（from + 四档单价 + slots?）` }
  }
  const raw = value as Record<string, unknown>
  const known = new Set(['from', 'inputPerMillion', 'outputPerMillion', 'cacheReadPerMillion', 'cacheWritePerMillion', 'slots'])
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
  if (typeof raw.from !== 'string') {
    return { ok: false, error: `${where}缺少 from（生效时间）：一段价必须有生效时刻，写 YYYY-MM-DD 或整点 YYYY-MM-DDTHH:00` }
  }
  const from = instantMs(raw.from)
  if (from === null) {
    return { ok: false, error: `${where}的 from 必须是真实存在的 YYYY-MM-DD 或整点 YYYY-MM-DDTHH:00：${raw.from}` }
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
    },
  }
}

/** 一次 PUT body 的判定。 */
export type PriceParse = { ok: true; file: PriceFile } | { ok: false; error: string }

/** 严格解析 `$calendar`：`YYYY` → 放假日区间数组。区间之间允许相邻或重叠
 *  （会被合并），手写时不必自己收拾边界。 */
function parseCalendar(value: unknown): { ok: true; calendar: HolidayCalendar } | { ok: false; error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: `${PRICING_CALENDAR_KEY} 必须是对象（年份 → 放假日区间数组）` }
  }
  const calendar: HolidayCalendar = {}
  for (const [year, ranges] of Object.entries(value as Record<string, unknown>)) {
    if (!isYearKey(year)) return { ok: false, error: `${PRICING_CALENDAR_KEY} 的年份键必须是四位数字：${year}` }
    if (!Array.isArray(ranges)) {
      return { ok: false, error: `${PRICING_CALENDAR_KEY} 的「${year}」必须是区间数组（每项 { start, end }）` }
    }
    const dates: string[] = []
    for (let index = 0; index < ranges.length; index += 1) {
      const where = `${PRICING_CALENDAR_KEY} 的「${year}」第 ${String(index + 1)} 段`
      const raw = ranges[index]
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return { ok: false, error: `${where}必须是对象（start + end）` }
      }
      const range = raw as Record<string, unknown>
      const extra = Object.keys(range).find(key => key !== 'start' && key !== 'end')
      if (extra !== undefined) return { ok: false, error: `${where}含未知字段「${extra}」` }
      if (typeof range.start !== 'string' || typeof range.end !== 'string') {
        return { ok: false, error: `${where}的 start / end 必须是 YYYY-MM-DD` }
      }
      if (!isValidHolidayRange({ start: range.start, end: range.end })) {
        return { ok: false, error: `${where}的日期不合法（两端都要是真实日期，且 start ≤ end）：${range.start} ~ ${range.end}` }
      }
      if (yearOfDate(range.start) !== year || yearOfDate(range.end) !== year) {
        return { ok: false, error: `${where}跨出了 ${year} 年：一段假期必须落在它所属的那一年里` }
      }
      dates.push(...holidayDates({ start: range.start, end: range.end }))
    }
    const merged = mergeHolidayDates(dates)
    if (merged.length > 0) calendar[year] = merged
  }
  return { ok: true, calendar }
}

/** `{}`（或省掉 `cnyPerUsd`）= 未设汇率，合法——「不用美元面」。0 与负数一律拒：换算会除零。 */
function parseFx(value: unknown): { ok: true; fx?: FxSetting } | { ok: false; error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: `${PRICING_FX_KEY} 必须是对象（{ cnyPerUsd: 1 美元等于多少元 }）` }
  }
  const raw = value as Record<string, unknown>
  const extra = Object.keys(raw).find(key => key !== 'cnyPerUsd')
  if (extra !== undefined) return { ok: false, error: `${PRICING_FX_KEY} 含未知字段「${extra}」` }
  if (raw.cnyPerUsd === undefined) return { ok: true }
  if (typeof raw.cnyPerUsd !== 'number' || !Number.isFinite(raw.cnyPerUsd) || raw.cnyPerUsd <= 0) {
    return { ok: false, error: `${PRICING_FX_KEY} 的 cnyPerUsd 必须是大于 0 的数字（1 美元等于多少元）` }
  }
  return { ok: true, fx: { cnyPerUsd: raw.cnyPerUsd } }
}

/** `USD` 必须有可用汇率，这件事由 {@link parsePriceInput} 在两侧都读完后再判（这里看不到 `$fx`）。 */
function parseCurrency(value: unknown): { ok: true; currency: CurrencyMap } | { ok: false; error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: `${PRICING_CURRENCY_KEY} 必须是对象（路由 → "CNY" | "USD"）` }
  }
  const currency: CurrencyMap = {}
  for (const [route, raw] of Object.entries(value as Record<string, unknown>)) {
    if (route === '') return { ok: false, error: `${PRICING_CURRENCY_KEY} 下存在空路由名` }
    if (route.startsWith('$')) {
      return { ok: false, error: `${PRICING_CURRENCY_KEY} 下的键必须是通道路由名，不能以「$」开头：${route}` }
    }
    if (raw !== 'CNY' && raw !== 'USD') {
      return { ok: false, error: `「${route}」的报价币种必须是 "CNY" 或 "USD"` }
    }
    if (raw === 'USD') currency[route] = 'USD'
  }
  return { ok: true, currency }
}

/** 严格解析一次 PUT 的完整目标文件：任何偏差都以出错位置拒绝。 */
export function parsePriceInput(value: unknown): PriceParse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: '价格表必须是 JSON 对象（路由 → 模型串 → 价段数组）' }
  }
  const raw = value as Record<string, unknown>
  const table: PricingTable = {}
  const billing: BillingMap = {}
  const currency: CurrencyMap = {}
  let calendar: HolidayCalendar = {}
  let fx: FxSetting | undefined
  for (const [route, models] of Object.entries(raw)) {
    if (route.startsWith('$')) {
      if (route === PRICING_CALENDAR_KEY) {
        const parsed = parseCalendar(models)
        if (!parsed.ok) return { ok: false, error: parsed.error }
        calendar = parsed.calendar
        continue
      }
      if (route === PRICING_FX_KEY) {
        const parsed = parseFx(models)
        if (!parsed.ok) return { ok: false, error: parsed.error }
        fx = parsed.fx
        continue
      }
      if (route === PRICING_CURRENCY_KEY) {
        const parsed = parseCurrency(models)
        if (!parsed.ok) return { ok: false, error: parsed.error }
        for (const [key, value] of Object.entries(parsed.currency)) currency[key] = value
        continue
      }
      if (route !== PRICING_BILLING_KEY) {
        return {
          ok: false,
          error: `未知保留键「${route}」（只支持 ${PRICING_BILLING_KEY} / ${PRICING_CALENDAR_KEY} / ${PRICING_CURRENCY_KEY} / ${PRICING_FX_KEY}）`,
        }
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
          return { ok: false, error: `${where}有两段的生效时间相同（${instantKey(parsed.segment.from)}）：同一时刻只能有一段价` }
        }
        seen.add(parsed.segment.from)
        segments.push(parsed.segment)
      }
      priced[model] = segments.sort((left, right) => left.from - right.from)
    }
    if (Object.keys(priced).length > 0) table[route] = priced
  }
  // 美元报价必须有汇率，否则那些价算不成人民币、整条读作价格未知；client 按同一判据各挡一道。
  for (const route of Object.keys(currency)) {
    if (fx === undefined) {
      return {
        ok: false,
        error: `「${route}」按美元报价（${PRICING_CURRENCY_KEY}），但文件里没有可用的 ${PRICING_FX_KEY} 汇率：美元价换算不成人民币`,
      }
    }
  }
  return { ok: true, file: { table, billing, currency, calendar, ...(fx !== undefined ? { fx } : {}), revision: '' } }
}

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

/** 价文件的文件体。键序（保留键在前，route 与 model 排序，段按生效时刻升序）
 *  与 client 的 writer 是同一份约定。 */
function priceFileBody(file: PriceFile): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const billingRoutes = Object.keys(file.billing).sort((left, right) => left.localeCompare(right))
  if (billingRoutes.length > 0) {
    const billing: Record<string, BillingNature> = {}
    for (const route of billingRoutes) billing[route] = file.billing[route]!
    body[PRICING_BILLING_KEY] = billing
  }
  const calendarYears = Object.keys(file.calendar).sort((left, right) => left.localeCompare(right))
  if (calendarYears.length > 0) {
    const calendar: Record<string, HolidayRange[]> = {}
    for (const year of calendarYears) {
      calendar[year] = mergeHolidayDates((file.calendar[year] ?? []).flatMap(range => holidayDates(range)))
    }
    body[PRICING_CALENDAR_KEY] = calendar
  }
  const usdRoutes = Object.keys(file.currency).filter(route => file.currency[route] === 'USD').sort((left, right) => left.localeCompare(right))
  if (usdRoutes.length > 0) {
    const currency: CurrencyMap = {}
    for (const route of usdRoutes) currency[route] = 'USD'
    body[PRICING_CURRENCY_KEY] = currency
  }
  if (file.fx !== undefined) body[PRICING_FX_KEY] = { cnyPerUsd: file.fx.cnyPerUsd }
  for (const route of Object.keys(file.table).sort((left, right) => left.localeCompare(right))) {
    const models = file.table[route]!
    const priced: Record<string, unknown[]> = {}
    for (const model of Object.keys(models).sort((left, right) => left.localeCompare(right))) {
      const segments = models[model]!
      if (segments.length === 0) continue
      priced[model] = segments.map((segment) => {
        const slots = segment.slots ?? []
        return {
          // 每段都有生效时刻：`from` 一律写出来（1970 前那种更早的时刻也是真实身份，
          // 必须原样写出去，省掉它会让两段在盘上撞成同一条身份）。
          from: instantKey(segment.from),
          inputPerMillion: segment.rates.inputPerMillion,
          outputPerMillion: segment.rates.outputPerMillion,
          ...(segment.rates.cacheReadPerMillion !== undefined
            ? { cacheReadPerMillion: segment.rates.cacheReadPerMillion } : {}),
          ...(segment.rates.cacheWritePerMillion !== undefined
            ? { cacheWritePerMillion: segment.rates.cacheWritePerMillion } : {}),
          ...(slots.length > 0 ? { slots: slots.map(slotBody) } : {}),
        }
      })
    }
    if (Object.keys(priced).length > 0) body[route] = priced
  }
  return body
}

/** 原子落盘整个价文件（临时文件 + rename；rename 前把旧文件挪成 `.bak`——
 *  Windows 覆盖 rename 间歇失败，而缺失的 `pricing.json` 绝不能读作空表）。 */
export async function writePriceFile(dir: string, file: PriceFile, logger: Logger = console): Promise<void> {
  const target = join(dir, PRICING_FILE)
  const tmp = join(dir, `${PRICING_FILE}.tmp`)
  const backup = join(dir, `${PRICING_FILE}.bak`)
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(tmp, `${JSON.stringify(priceFileBody(file), null, 2)}\n`, 'utf8')
    await rename(target, backup).catch(() => undefined)
    await rename(tmp, target)
  } catch (error) {
    logger.error(`[tokbook] cannot write ${PRICING_FILE}:`, error)
    throw error
  }
}

/** (route, model) 在 `timeMs` 生效的段；null = 价格未知（无人定价，或时刻早于最早一段）。 */
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

/** 未提供年历时的读法：**空集** = 那一年未知，`workdays` 因此退化为「周一至周五」，
 *  只会把法定节假日多算成高峰，绝不会少算。 */
const NO_HOLIDAYS: ReadonlySet<string> = new Set()

/** 该段在 `timeMs` 生效的例外时段，或 null = 段的基准价。任一时刻至多一个时段：
 *  写路径拒绝重叠对，读路径丢弃较晚的那个。 */
export function slotAt(
  segment: PriceSegment,
  timeMs: number,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): PriceSlot | null {
  for (const slot of segment.slots ?? []) {
    if (slotCovers(slot, timeMs, holidays)) return slot
  }
  return null
}

function slotRefAt(segment: PriceSegment, timeMs: number, holidays: ReadonlySet<string>): SlotRef | null {
  const slot = slotAt(segment, timeMs, holidays)
  return slot === null ? null : { start: slot.start, days: slot.days }
}

/** 基准价叠上当时生效的例外时段；时段只重述真正变化的档，其余档沿用基准价。 */
export function ratesOfSegment(
  segment: PriceSegment,
  timeMs: number,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): ModelPricing {
  const slot = slotAt(segment, timeMs, holidays)
  return slot === null ? segment.rates : { ...segment.rates, ...slot.rates }
}

/** (route, model) 在 `timeMs` 的价格，null = 价格未知。 */
export function ratesAt(
  table: PricingTable,
  route: string | undefined,
  model: string,
  timeMs: number,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): ModelPricing | null {
  const segment = priceAt(table, route, model, timeMs)
  return segment === null ? null : ratesOfSegment(segment, timeMs, holidays)
}

/** (route, model) 在 `timeMs` 的 rate 身份——当时生效段的生效时刻 + 段内生效
 *  的例外时段，或 {@link UNPRICED_KEY}。只存身份、不存数字，改价后下次读即
 *  重算历史（年历改了同理：时段身份不变，但重算会按新节假日取价）。 */
export function rateKeyAt(
  table: PricingTable,
  route: string | undefined,
  model: string,
  timeMs: number,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): RateKey {
  const hit = priceAt(table, route, model, timeMs)
  return hit === null ? UNPRICED_KEY : { from: hit.from, slot: slotRefAt(hit, timeMs, holidays) }
}

/** 一个 rate 身份的价格：在当前表里回查该段的生效时刻，再找它命名的时段
 *  （rate 行以计费时所依据的段时刻 + 时段为键，故重算历史无需每条记录的时间戳）。
 *  表里不再持有该身份时为 null——这些行读作价格未知。 */
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

export function billingOf(billing: BillingMap, route: string | undefined): BillingNature {
  if (route === undefined || route === '') return 'metered'
  return billing[route] ?? 'metered'
}

export function costOf(totals: UsageTotals, prices: ModelPricing): number {
  const M = 1_000_000
  const cacheRead = prices.cacheReadPerMillion ?? prices.inputPerMillion
  const cacheWrite = prices.cacheWritePerMillion ?? prices.inputPerMillion
  return (totals.inputTokens * prices.inputPerMillion
    + totals.outputTokens * prices.outputPerMillion
    + totals.cacheReadTokens * cacheRead
    + totals.cacheWriteTokens * cacheWrite) / M
}

/** 四档价整体乘一个率；**缺席的档保持缺席**（省略 ≠ 0：缓存两档省略时回落输入价）。 */
function scaledRates(rates: ModelPricing, rate: number): ModelPricing {
  return {
    inputPerMillion: rates.inputPerMillion * rate,
    outputPerMillion: rates.outputPerMillion * rate,
    ...(rates.cacheReadPerMillion !== undefined ? { cacheReadPerMillion: rates.cacheReadPerMillion * rate } : {}),
    ...(rates.cacheWritePerMillion !== undefined ? { cacheWritePerMillion: rates.cacheWritePerMillion * rate } : {}),
  }
}

/**
 * **计价用的表**：把按美元报价的通道按汇率折成人民币，其余原样。币种只活在这一个缝上，
 * 成本层与折叠都不认识币种；没有汇率时**丢掉那些通道的价**（读作价格未知），绝不把
 * 美元数当人民币数。段身份（`from` + 时段）不受换算影响。取舍见 `docs/CONTRACTS.md` §2。
 */
export function cnyTable(table: PricingTable, currency: CurrencyMap, fx: FxSetting | undefined): PricingTable {
  const usdRoutes = Object.keys(currency).filter(route => currency[route] === 'USD')
  if (usdRoutes.length === 0) return table
  const rate = fx === undefined ? 0 : fx.cnyPerUsd
  const out: PricingTable = { ...table }
  for (const route of usdRoutes) {
    const models = table[route]
    if (models === undefined) continue
    if (!(rate > 0)) {
      delete out[route]
      continue
    }
    const scaled: Record<string, PriceSegment[]> = {}
    for (const [model, segments] of Object.entries(models)) {
      scaled[model] = segments.map(segment => ({
        from: segment.from,
        rates: scaledRates(segment.rates, rate),
        ...(segment.slots !== undefined
          ? { slots: segment.slots.map(slot => ({ ...slot, rates: scaledRates(slot.rates, rate) })) }
          : {}),
      }))
    }
    out[route] = scaled
  }
  return out
}
