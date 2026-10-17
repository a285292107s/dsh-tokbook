/**
 * 手工价表：provider route key → 精确 model 串 → 该 (route, model) 的**当前价**
 * （四档基准价 + 可选峰谷时段）。没有生效时刻那一轴——账本里所有记录都用同一份价
 * 折算（理由与代价见 docs/CONTRACTS.md §2）。旧文件的价段数组仍读得进来：取生效时刻
 * 最晚的那一段（就是今天仍在生效的价），更早的段按它重算。
 *
 * 读宽松（畸形段/时段丢弃，不致命）；写严格且整文件替换，坏 PUT 不会半落地。
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DAY_SETS, MAX_MODEL_LENGTH, MAX_ROUTE_LENGTH, PRICING_BILLING_KEY, PRICING_CALENDAR_KEY,
  PRICING_CURRENCY_KEY, PRICING_FX_KEY,
  dayIndex, dayKeyOfIndex, dayStartMs, holidayDates, isHourRange, isValidHolidayRange, isYearKey,
  slotCovers, slotsOverlap, yearOfDate,
} from './price-format.ts'
import type {
  BillingMap, BillingNature, CurrencyMap, FxSetting, HolidayCalendar, HolidayRange, ModelPricing,
  PriceEntry, PriceSlot,
  PricingTable, RateKey, SlotRef, UsageTotals,
} from './types.ts'
import { UNPRICED_KEY } from './types.ts'

export const PRICING_FILE = 'pricing.json'

export {
  DAY_SETS, PRICING_BILLING_KEY, PRICING_CALENDAR_KEY, PRICING_CURRENCY_KEY, PRICING_FX_KEY,
  dayKeyOf, dayStartMs,
} from './price-format.ts'

interface Logger {
  error(...args: unknown[]): void
  /** 可选：读路径的降级说明（从 `.bak` 恢复、跨年区间被夹取）。 */
  warn?(...args: unknown[]): void
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

/** 读文件的结果：`text` 为 null 时 `missing` 区分「**确实不存在**（ENOENT）」与
 *  「存在但读不到（EACCES/EBUSY/…）」。两者的处置不同：只有前者才允许走
 *  `.bak` 回退——把权限错误当成「文件没了」会拿旧备份盖住一份还在的文件。 */
type TextFileRead = { text: string } | { text: null; missing: boolean }

async function readTextFile(dir: string, name: string, logger: Logger): Promise<TextFileRead> {
  try {
    const text = await readFile(join(dir, name), 'utf8')
    return { text: text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text }
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT'
    // 「还没有这个文件」是正常状态（首次安装），不报；读不到已有文件才报。
    if (!missing) logger.error(`[tokbook] cannot read ${name}:`, error)
    return { text: null, missing }
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

/** 旧文件里 `from` 的两种写法：本地日，或本地日 + 整点。 */
const LEGACY_FROM_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:00)?$/u

/** 旧文件里的一段价。**读**路径只拿它挑出「今天仍在生效」的那一段——`from` 因此
 *  只用来排序，不再参与计价；缺 `from`（更旧的兜底段）按最早处理。 */
function coerceLegacySegment(raw: unknown): { from: string; entry: PriceEntry } | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const segment = raw as Record<string, unknown>
  const rates = coerceRates(segment)
  if (rates === null) return null
  const text = segment.from
  let from = ''
  if (text !== undefined && text !== null && text !== '') {
    if (typeof text !== 'string' || !LEGACY_FROM_RE.test(text) || dayStartMs(text.slice(0, 10)) === null) return null
    from = text
  }
  const slots = Array.isArray(segment.slots)
    ? normalizeSlots(segment.slots.map(coerceSlot).filter((slot): slot is PriceSlot => slot !== null))
    : []
  return { from, entry: { rates, ...(slots.length > 0 ? { slots } : {}) } }
}

/** 旧形态的价段数组 → 生效时刻最晚的那一段。日期串是定宽且逐位可比的，所以
 *  字典序就是时间序（缺 `from` 的兜底段排在最前）。任一段读不懂 → null：我们
 *  无法知道坏的哪一段是不是最晚的那一段，保守起见整个 (route, model) 读作价格未知。 */
function coerceLegacySegments(list: readonly unknown[]): PriceEntry | null {
  let best: { from: string; entry: PriceEntry } | null = null
  for (const item of list) {
    const segment = coerceLegacySegment(item)
    if (segment === null) return null
    if (best === null || segment.from > best.from) best = segment
  }
  return best === null ? null : best.entry
}

/** 一个 (route, model) 的价：当前形态（四档价 + 可选 slots 的对象），或旧文件的
 *  价段数组。两者都读不懂 → null（价格未知）。 */
function coerceEntry(raw: unknown): PriceEntry | null {
  if (Array.isArray(raw)) return coerceLegacySegments(raw)
  if (typeof raw !== 'object' || raw === null) return null
  const entry = raw as Record<string, unknown>
  const rates = coerceRates(entry)
  if (rates === null) return null
  const slots = Array.isArray(entry.slots)
    ? normalizeSlots(entry.slots.map(coerceSlot).filter((slot): slot is PriceSlot => slot !== null))
    : []
  return {
    rates,
    ...(slots.length > 0 ? { slots } : {}),
  }
}

/** 一年里的一段放假日：两端都是真实日期且起不晚于止。 */
function coerceHolidayRange(raw: unknown): HolidayRange | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const range = raw as Record<string, unknown>
  if (typeof range.start !== 'string' || typeof range.end !== 'string') return null
  const parsed: HolidayRange = { start: range.start, end: range.end }
  return isValidHolidayRange(parsed) ? parsed : null
}

/** 读路径的年历：畸形的年 / 区间丢弃（不致命），合法区间合并成不重叠的区间表。
 *
 *  每个区间**夹到它自己的年 key 内**：写路径（{@link parseCalendar}）拒绝跨年区间，
 *  而 client 把写规则用在读结果上，所以读路径放行一个跨年区间就等于让整份价文件
 *  存不进去、并让 client 的节假日集合为空（`workdays` 在节假日当天照高峰算，
 *  显示价与计费价分叉）。夹掉的部分按「年历里查不到这一天」退化——`workdays`
 *  退成周一至周五，宁可多按高峰算，绝不因此丢掉整年的年历。 */
function coerceCalendar(raw: unknown, logger: Logger = console): HolidayCalendar {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const calendar: HolidayCalendar = {}
  for (const [year, ranges] of Object.entries(raw as Record<string, unknown>)) {
    if (!isYearKey(year) || !Array.isArray(ranges)) continue
    const yearStart = dayIndex(`${year}-01-01`)
    const yearEnd = dayIndex(`${year}-12-31`)
    if (yearStart === null || yearEnd === null) continue
    const dates: string[] = []
    for (const item of ranges) {
      const range = coerceHolidayRange(item)
      if (range === null) continue
      const start = dayIndex(range.start)!
      const end = dayIndex(range.end)!
      const from = Math.max(start, yearStart)
      const to = Math.min(end, yearEnd)
      if (from > to) {
        logger.warn?.(`[tokbook] ${PRICING_CALENDAR_KEY} 的「${year}」有一段假期（${range.start} ~ ${range.end}）整段都不在这一年里，读路径丢掉它`)
        continue
      }
      if (from !== start || to !== end) {
        logger.warn?.(`[tokbook] ${PRICING_CALENDAR_KEY} 的「${year}」有一段假期跨出了这一年（${range.start} ~ ${range.end}），读路径把它夹成 ${dayKeyOfIndex(from)} ~ ${dayKeyOfIndex(to)}`)
      }
      dates.push(...holidayDates({ start: dayKeyOfIndex(from), end: dayKeyOfIndex(to) }))
    }
    const kept = mergeHolidayDates(dates)
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
  const calendar = coerceCalendar(raw[PRICING_CALENDAR_KEY], logger)
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
    const priced: Record<string, PriceEntry> = {}
    for (const [model, raw] of Object.entries(models as Record<string, unknown>)) {
      if (model === '') continue
      // 读不懂 → 整个 (route, model) 读作价格未知。**不猜**：手写的价要么读得出
      // 四档价，要么这一行没有价（README 承诺的是「畸形文件只把受影响的
      //  (路由, 模型) 降级为价格未知(¥0)」）。残留：该 (route, model) 因此在下一次
      //  整表保存时不再出现在视图里（整表重写的既有语义），手写的坏行会被那个动作
      //  永久删掉——接受的代价，错钱比丢一条手写价更严重。
      const entry = coerceEntry(raw)
      if (entry === null) {
        logger.error(`[tokbook] ${PRICING_FILE} 的「${route}」/「${model}」读不懂（既不是「四档价 + 可选 slots」的对象，也不是旧的价段数组）；整个 (路由, 模型) 读作价格未知`)
        continue
      }
      priced[model] = entry
    }
    if (Object.keys(priced).length > 0) table[route] = priced
  }
  return { table, billing, currency, calendar, ...(fx !== undefined ? { fx } : {}), revision: '' }
}

function emptyPriceFile(): PriceFile {
  return { table: {}, billing: {}, currency: {}, calendar: {}, revision: '' }
}

/** 读价文件。主文件**确实不存在**（ENOENT，不是别的读取错误）而 `pricing.json.bak`
 *  在时从备份恢复：{@link writePriceFile} 先 `rename(target, backup)` 再 `rename(tmp,
 *  target)`，两步之间崩溃就只剩 `.bak`，而缺失的主文件若读作空表，界面会显示
 *  「全部价格未知」，用户随手改一格就把空表整表写回、历史价全丢。
 *
 *  回退只在 ENOENT 上做（权限 / 占用错误读的是还在的文件，绝不拿备份盖它），
 *  也不在 JSON 语法错误上做（文件在、内容坏，按 `parseJson` 的既有语义读空表）。 */
export async function readPriceFile(dir: string, logger: Logger = console): Promise<PriceFile> {
  const read = await readTextFile(dir, PRICING_FILE, logger)
  if (read.text === null) {
    if (read.missing) {
      const backup = await readTextFile(dir, `${PRICING_FILE}.bak`, logger)
      if (backup.text !== null) {
        const recovered = parseJson(backup.text, `${PRICING_FILE}.bak`, logger)
        if (recovered !== null) {
          logger.warn?.(`[tokbook] ${PRICING_FILE} 不存在；已从 ${PRICING_FILE}.bak 恢复，请确认后重新保存一次`)
          return { ...coercePriceFile(recovered, logger), revision: revisionOf(backup.text) }
        }
      }
    }
    return emptyPriceFile()
  }
  const raw = parseJson(read.text, PRICING_FILE, logger)
  if (raw === null) return { ...emptyPriceFile(), revision: revisionOf(read.text) }
  return { ...coercePriceFile(raw, logger), revision: revisionOf(read.text) }
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

function parseEntry(value: unknown, where: string): { ok: true; entry: PriceEntry } | { ok: false; error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: `${where}必须是对象（四档单价 + 可选 slots）` }
  }
  const raw = value as Record<string, unknown>
  const known = new Set(['inputPerMillion', 'outputPerMillion', 'cacheReadPerMillion', 'cacheWritePerMillion', 'slots'])
  const extra = Object.keys(raw).find(key => !known.has(key))
  if (extra !== undefined) {
    // 旧文件的 `from` 是这一屏最可能手写回来的字段，所以单独说一句它去哪儿了。
    const hint = extra === 'from' ? '：价表没有生效时间了，整份价就是当前价' : ''
    return { ok: false, error: `${where}含未知字段「${extra}」${hint}` }
  }
  if (!isRate(raw.inputPerMillion) || !isRate(raw.outputPerMillion)) {
    return { ok: false, error: `${where}缺少合法的 inputPerMillion / outputPerMillion（非负数字）` }
  }
  if (raw.cacheReadPerMillion !== undefined && !isRate(raw.cacheReadPerMillion)) {
    return { ok: false, error: `${where}的 cacheReadPerMillion 必须是非负数字` }
  }
  if (raw.cacheWritePerMillion !== undefined && !isRate(raw.cacheWritePerMillion)) {
    return { ok: false, error: `${where}的 cacheWritePerMillion 必须是非负数字` }
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
    entry: {
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
      return { ok: false, error: `「${route}」必须是对象（模型串 → 该模型的价）` }
    }
    const priced: Record<string, PriceEntry> = {}
    for (const [model, raw] of Object.entries(models as Record<string, unknown>)) {
      const where = `「${route}」的「${model}」`
      if (model === '') return { ok: false, error: `「${route}」下存在空模型串` }
      if (model.length > MAX_MODEL_LENGTH) return { ok: false, error: `模型串过长：${model.slice(0, 40)}…` }
      const parsed = parseEntry(raw, where)
      if (!parsed.ok) return { ok: false, error: parsed.error }
      priced[model] = parsed.entry
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

/** 价文件的文件体。键序（保留键在前，route 与 model 排序，时段按开始小时升序）
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
    const priced: Record<string, unknown> = {}
    for (const model of Object.keys(models).sort((left, right) => left.localeCompare(right))) {
      const entry = models[model]!
      const slots = entry.slots ?? []
      priced[model] = {
        inputPerMillion: entry.rates.inputPerMillion,
        outputPerMillion: entry.rates.outputPerMillion,
        ...(entry.rates.cacheReadPerMillion !== undefined
          ? { cacheReadPerMillion: entry.rates.cacheReadPerMillion } : {}),
        ...(entry.rates.cacheWritePerMillion !== undefined
          ? { cacheWritePerMillion: entry.rates.cacheWritePerMillion } : {}),
        ...(slots.length > 0 ? { slots: slots.map(slotBody) } : {}),
      }
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

/** (route, model) 的当前价；null = 价格未知（无人定价）。 */
export function entryAt(table: PricingTable, route: string | undefined, model: string): PriceEntry | null {
  if (route === undefined || route === '') return null
  return table[route]?.[model] ?? null
}

/** 未提供年历时的读法：**空集** = 那一年未知，`workdays` 因此退化为「周一至周五」，
 *  只会把法定节假日多算成高峰，绝不会少算。 */
const NO_HOLIDAYS: ReadonlySet<string> = new Set()

/** 该价在 `timeMs` 生效的例外时段，或 null = 基准价。任一时刻至多一个时段：
 *  写路径拒绝重叠对，读路径丢弃较晚的那个。 */
export function slotAt(
  entry: PriceEntry,
  timeMs: number,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): PriceSlot | null {
  for (const slot of entry.slots ?? []) {
    if (slotCovers(slot, timeMs, holidays)) return slot
  }
  return null
}

function slotRefAt(entry: PriceEntry, timeMs: number, holidays: ReadonlySet<string>): SlotRef | null {
  const slot = slotAt(entry, timeMs, holidays)
  return slot === null ? null : { start: slot.start, days: slot.days }
}

/** 基准价叠上当时生效的例外时段；时段只重述真正变化的档，其余档沿用基准价。 */
export function ratesOfEntry(
  entry: PriceEntry,
  timeMs: number,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): ModelPricing {
  const slot = slotAt(entry, timeMs, holidays)
  return slot === null ? entry.rates : { ...entry.rates, ...slot.rates }
}

/** (route, model) 在 `timeMs` 的价，null = 价格未知。 */
export function ratesAt(
  table: PricingTable,
  route: string | undefined,
  model: string,
  timeMs: number,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): ModelPricing | null {
  const entry = entryAt(table, route, model)
  return entry === null ? null : ratesOfEntry(entry, timeMs, holidays)
}

/** (route, model) 在 `timeMs` 的 rate 身份——当时生效的例外时段，或
 *  {@link UNPRICED_KEY}。只存身份、不存数字，改价后下次读即重算历史
 *  （年历改了同理：时段身份不变，但重算会按新节假日取价）。 */
export function rateKeyAt(
  table: PricingTable,
  route: string | undefined,
  model: string,
  timeMs: number,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): RateKey {
  const entry = entryAt(table, route, model)
  return entry === null ? UNPRICED_KEY : { slot: slotRefAt(entry, timeMs, holidays) }
}

/** 一个 rate 身份的价格：在当前表里回查它命名的例外时段（rate 行以时段为键，
 *  故重算历史无需每条记录的时间戳）。定价路径只在一种情况下回查落空：时段被
 *  移动或删掉且折叠还没作废（价文件任何改动都会让 `pricingRevision` 变化、整份折叠
 *  重建，见 docs/CONTRACTS.md §2），以及按美元报价却没设汇率的通道（换算表里整条被丢）。 */
export function priceOfKey(
  table: PricingTable,
  route: string | undefined,
  model: string,
  key: RateKey,
): ModelPricing | null {
  if (key.unpriced === true) return null
  const entry = entryAt(table, route, model)
  if (entry === null) return null
  const ref = key.slot
  if (ref === undefined || ref === null) return entry.rates
  const slot = (entry.slots ?? []).find(item => item.start === ref.start && item.days === ref.days)
  return slot === undefined ? null : { ...entry.rates, ...slot.rates }
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
 * 美元数当人民币数。时段身份不受换算影响。取舍见 `docs/CONTRACTS.md` §2。
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
    const scaled: Record<string, PriceEntry> = {}
    for (const [model, entry] of Object.entries(models)) {
      scaled[model] = {
        rates: scaledRates(entry.rates, rate),
        ...(entry.slots !== undefined
          ? { slots: entry.slots.map(slot => ({ ...slot, rates: scaledRates(slot.rates, rate) })) }
          : {}),
      }
    }
    out[route] = scaled
  }
  return out
}
