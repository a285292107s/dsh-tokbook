/**
 * 手工价表：provider route key → 精确 model 串 → 该 pair 的价格时间轴。
 *
 * 记录按「已到达的最新生效时刻」的段计价，再按该段在记录本地时间生效的时段计
 * （无时段 = 全天价），因此改价 / 改时段只重算历史，从不重建聚合。唯一保留键
 * `$billing`：route → 计费性质（metered = 真实消费，subscription = 订阅价值）。
 *
 * 读宽松（畸形段/时段丢弃，不致命）；写严格且整文件替换，坏 PUT 不会半落地。
 * 时间轴规则经 `./price-format.ts` 与 browser 半区共享。
 *
 * @module dsh-tokbook/pricing
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DAY_SETS, EARLIEST, MAX_NOTE_LENGTH, PRICING_BILLING_KEY, instantKey, instantMs, isHourRange, slotCovers, slotsOverlap,
} from './price-format.ts'
import type {
  BillingMap, BillingNature, ModelPricing, PriceSegment, PriceSlot, PricingSegmentInput, PricingSlotInput,
  PricingTable, RateKey, SlotRef, UsageTotals,
} from './types.ts'
import { UNPRICED_KEY } from './types.ts'

export const PRICING_FILE = 'pricing.json'

export { DAY_SETS, EARLIEST, PRICING_BILLING_KEY, dayKeyOf, dayStartMs, instantKey, instantMs } from './price-format.ts'

const MAX_ROUTE_LENGTH = 128
const MAX_MODEL_LENGTH = 256

interface Logger {
  error(...args: unknown[]): void
}

/** 整个价文件：(route, model) 时间轴 + billing 映射。`revision` 是内容签名——
 *  派生 rollup 记下其 rate 行所折叠的 revision，不同则重建。 */
export interface PriceFile {
  table: PricingTable
  billing: BillingMap
  revision: string
}

// ---------------------------------------------------------------------------
// 读（宽松）与写（严格）
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

/** 峰谷时段重述的费率：四档的任意非空子集。省略的档沿用段的全天价。 */
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

/** 按 start 升序；重叠时段丢弃——文件中较早的时段胜出（读路径从不抛）。 */
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

/** 按生效时刻升序；同一时刻只留一段——文件中该时刻的首段胜出（读路径从不抛）。 */
function normalizeSegments(segments: readonly PriceSegment[]): PriceSegment[] {
  const out: PriceSegment[] = []
  for (const segment of [...segments].sort((left, right) => left.from - right.from)) {
    const last = out[out.length - 1]
    if (last !== undefined && last.from === segment.from) continue
    out.push(segment)
  }
  return out
}

/** 宽松解析整个文件：畸形 route / model / 段丢弃（不致命），与账本读自身分日
 *  文件一致。 */
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

/** 读一个数据目录的价文件。缺失 / 畸形读作空表（无人定价）。revision 是文件
 *  **文本**的签名——包括本进程未做的编辑在内，任何改动对派生 rollup 都可见。 */
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

/** 严格解析一个峰谷时段：小时落在一个本地日内、day set 已知、四档费率的任意
 *  非空子集——省略的档沿用段的全天价。 */
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

/** 一次 PUT body 的判定。 */
export type PriceParse = { ok: true; file: PriceFile } | { ok: false; error: string }

/** 严格解析完整目标文件：任何偏差都以出错位置拒绝，坏 body 绝不半落地。 */
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

/** 一段价的一个例外时段在文件中的形态。 */
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

/** 价文件的文件体：route 与 model 排序，`$billing` 段在前，段按生效时刻升序，
 *  段内例外时段按 start 小时升序。 */
function priceFileBody(file: PriceFile): Record<string, unknown> {
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

/** 原子落盘整个价文件（临时文件 + rename；rename 前把旧文件挪成 `.bak`——
 *  Windows 覆盖 rename 间歇失败，而缺失的 `pricing.json` 绝不能读作空表）。 */
export async function writePriceFile(dir: string, file: PriceFile, logger: Logger = console): Promise<void> {
  const target = join(dir, PRICING_FILE)
  const tmp = join(dir, `${PRICING_FILE}.tmp`)
  const backup = join(dir, `${PRICING_FILE}.bak`)
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(tmp, `${JSON.stringify(priceFileBody(file), null, 2)}\n`, 'utf8')
    // rename 落地前保留旧文件：remove 与 rename 之间崩溃会让 pricing.json
    // 缺失（读作空表），该空视图的自动保存随后会抹掉手写价表。
    await rename(target, backup).catch(() => undefined)
    await rename(tmp, target)
  } catch (error) {
    logger.error(`[tokbook] cannot write ${PRICING_FILE}:`, error)
    throw error
  }
}

// ---------------------------------------------------------------------------
// 解析
// ---------------------------------------------------------------------------

/** (route, model) 在 `timeMs` 生效的段：最后一个生效时刻已到达的段。
 *  null = 价格未知（无人定价，或时刻早于最早一段）。 */
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

/** 该段在 `timeMs` 生效的例外时段（按时刻自身的本地星期与小时），或 null =
 *  段的全天价。任一时刻至多一个时段：写路径拒绝重叠对，读路径丢弃较晚的那个。 */
export function slotAt(segment: PriceSegment, timeMs: number): PriceSlot | null {
  for (const slot of segment.slots ?? []) {
    if (slotCovers(slot, timeMs)) return slot
  }
  return null
}

/** `timeMs` 生效时段的身份，或 null = 全天价。 */
function slotRefAt(segment: PriceSegment, timeMs: number): SlotRef | null {
  const slot = slotAt(segment, timeMs)
  return slot === null ? null : { start: slot.start, days: slot.days }
}

/** 该段在 `timeMs` 的 ¥/M：全天价叠上当时生效的例外时段。时段省略的档沿用
 *  全天价，因此峰值时段只需重述真正变化的部分。 */
export function ratesOfSegment(segment: PriceSegment, timeMs: number): ModelPricing {
  const slot = slotAt(segment, timeMs)
  return slot === null ? segment.rates : { ...segment.rates, ...slot.rates }
}

/** (route, model) 在 `timeMs` 的价格，两级都解析：生效段，再取该段在时刻本地
 *  时间的时段。null = 价格未知。 */
export function ratesAt(
  table: PricingTable,
  route: string | undefined,
  model: string,
  timeMs: number,
): ModelPricing | null {
  const segment = priceAt(table, route, model, timeMs)
  return segment === null ? null : ratesOfSegment(segment, timeMs)
}

/** (route, model) 在 `timeMs` 的 rate 身份——当时生效段的生效时刻 + 段内生效
 *  的例外时段，或 {@link UNPRICED_KEY}。只存身份、不存数字，改价后下次读即
 *  重算历史。 */
export function rateKeyAt(
  table: PricingTable,
  route: string | undefined,
  model: string,
  timeMs: number,
): RateKey {
  const hit = priceAt(table, route, model, timeMs)
  return hit === null ? UNPRICED_KEY : { from: hit.from, slot: slotRefAt(hit, timeMs) }
}

/** 一个 rate 身份的价格：在当前表里回查该段的生效时刻，再找它命名的时段
 *  （rate 行以计费时所依据的段时刻 + 时段为键，故重算历史无需每条记录的时间戳）。
 *  表里不再持有该身份时为 null——段时刻消失，或命名的时段被移动/删除——
 *  这些行就读作价格未知。 */
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

/** route 的计费性质：其 `$billing` 条目，默认 metered。 */
export function billingOf(billing: BillingMap, route: string | undefined): BillingNature {
  if (route === undefined || route === '') return 'metered'
  return billing[route] ?? 'metered'
}

/** 在已解析价格下一行 totals 的计费金额：各桶按自身 ¥/M，cache 桶回落到普通
 *  input 价。 */
export function costOf(totals: UsageTotals, prices: ModelPricing): number {
  const M = 1_000_000
  const cacheRead = prices.cacheReadPerMillion ?? prices.inputPerMillion
  const cacheWrite = prices.cacheWritePerMillion ?? prices.inputPerMillion
  return (totals.inputTokens * prices.inputPerMillion
    + totals.outputTokens * prices.outputPerMillion
    + totals.cacheReadTokens * cacheRead
    + totals.cacheWriteTokens * cacheWrite) / M
}
