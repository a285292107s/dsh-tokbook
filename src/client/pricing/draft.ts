import {
  DAY_SETS, DAY_SET_LABELS, MAX_MODEL_LENGTH, MAX_ROUTE_LENGTH, PRICING_BILLING_KEY, PRICING_CALENDAR_KEY,
  PRICING_CURRENCY_KEY, PRICING_FX_KEY,
  dayIndex, holidaySet, isHourRange, isYearKey, rangeLabel, slotCovers, slotsOverlap,
} from '../../price-format.ts'
import type {
  BillingNature, CurrencyMap, DaySet, HolidayRange, ModelPricing, PriceCurrency,
  PricingCalendarInput, PricingEntryInput, PricingSlotInput, PricingView,
} from '../../types.ts'
import { convertText, parseAmount, type MoneyView } from './currency.ts'

export interface DraftRates {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

export type SlotRates = Partial<DraftRates>

export const RATE_FIELD_NAMES: ReadonlyArray<readonly [keyof DraftRates, keyof ModelPricing]> = [
  ['input', 'inputPerMillion'],
  ['output', 'outputPerMillion'],
  ['cacheRead', 'cacheReadPerMillion'],
  ['cacheWrite', 'cacheWritePerMillion'],
]

export interface RateTexts {
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

const RATE_INPUTS: ReadonlyArray<readonly [keyof RateTexts, string]> = [
  ['input', '输入价'],
  ['output', '输出价'],
  ['cacheRead', '缓存读价'],
  ['cacheWrite', '缓存写价'],
]

export interface SlotDraft extends RateTexts {
  id: number
  days: DaySet
  start: string
  end: string
}

export interface ModelDraft extends RateTexts {
  model: string
  name?: string
  records: number
  unpriced?: number
  slots: SlotDraft[]
}

export interface RouteDraft {
  route: string
  label: string
  billing: BillingNature
  currency: PriceCurrency
  records: number
  models: Map<string, ModelDraft>
}

export type PriceDraft = Map<string, RouteDraft>

export interface CalendarHolidayDraft {
  id: number
  start: string
  end: string
}

export interface CalendarDraft {
  year: string
  holidays: CalendarHolidayDraft[]
}

export type CalendarEntries = Map<string, CalendarDraft>

export interface PriceState {
  routes: PriceDraft
  calendar: CalendarEntries
  holidays: ReadonlySet<string>
  autoYears: ReadonlySet<string>
  fx: string
}

let nextId = 1

function takeId(): number {
  const id = nextId
  nextId += 1
  return id
}

export function newHoliday(seed: Partial<Omit<CalendarHolidayDraft, 'id'>> = {}): CalendarHolidayDraft {
  return { start: '', end: '', ...seed, id: takeId() }
}

export function defaultCalendarYear(entries: CalendarEntries, now: Date = new Date()): string {
  const started = [...entries.values()].some(entry => entry.holidays.some(row => row.start !== '' || row.end !== ''))
  let year = now.getFullYear() + (started ? 1 : 0)
  while (entries.has(String(year))) year += 1
  return String(year)
}

export function missingYearDrafts(calendar: CalendarEntries, missingYears: readonly string[]): CalendarDraft[] {
  const drafts: CalendarDraft[] = []
  for (const year of missingYears) {
    if (calendar.has(year)) continue
    drafts.push({ year, holidays: [newHoliday()] })
  }
  return drafts
}

export type HolidayRead =
  | { kind: 'empty' }
  | { kind: 'partial' }
  | { kind: 'ok'; days: number }
  | { kind: 'bad'; error: string }

type HolidaySpan =
  | { kind: 'empty' }
  | { kind: 'partial' }
  | { kind: 'ok'; days: number; span: HolidayRange }
  | { kind: 'bad'; error: string }

function holidaySpan(row: CalendarHolidayDraft, year: string): HolidaySpan {
  if (row.start === '' && row.end === '') return { kind: 'empty' }
  if (row.start === '' || row.end === '') return { kind: 'partial' }
  const start = dayIndex(row.start)
  const end = dayIndex(row.end)
  if (start === null || end === null) return { kind: 'bad', error: '开始与结束都要是真实存在的一天' }
  if (start > end) return { kind: 'bad', error: `开始（${row.start}）晚于结束（${row.end}）` }
  if (row.start.slice(0, 4) !== year || row.end.slice(0, 4) !== year) {
    return { kind: 'bad', error: `跨出了 ${year} 年：一段假期必须落在它所属的那一年里` }
  }
  return { kind: 'ok', days: end - start + 1, span: { start: row.start, end: row.end } }
}

export function readHolidays(year: string, rows: readonly CalendarHolidayDraft[]): readonly HolidayRead[] {
  const spans = rows.map(row => holidaySpan(row, year))
  return spans.map((span, index) => {
    if (span.kind !== 'ok') return span
    for (let other = 0; other < index; other += 1) {
      const peer = spans[other]!
      if (peer.kind !== 'ok') continue
      if (peer.span.start <= span.span.end && span.span.start <= peer.span.end) {
        return { kind: 'bad', error: `与第 ${String(other + 1)} 段假期重叠：同一年里两段假期不能共享一天` }
      }
    }
    return { kind: 'ok', days: span.days }
  })
}

function writableRanges(year: string, rows: readonly CalendarHolidayDraft[]): HolidayRange[] {
  const reads = readHolidays(year, rows)
  return rows.flatMap((row, index) => (reads[index]!.kind === 'ok' ? [{ start: row.start, end: row.end }] : []))
}

export function calendarYearTally(year: string, rows: readonly CalendarHolidayDraft[]): { ranges: number; days: number } {
  let ranges = 0
  let days = 0
  for (const read of readHolidays(year, rows)) {
    if (read.kind !== 'ok') continue
    ranges += 1
    days += read.days
  }
  return { ranges, days }
}

export function composeCalendar(
  entries: CalendarEntries,
  autoYears: ReadonlySet<string> = new Set(),
): { ok: true; calendar: PricingCalendarInput } | { ok: false; error: string } {
  const calendar: PricingCalendarInput = {}
  for (const [year, entry] of entries) {
    if (autoYears.has(year)) continue
    if (!isYearKey(year)) return { ok: false, error: `年历的年份「${year}」必须是四位数字` }
    const reads = readHolidays(year, entry.holidays)
    const bad = reads.findIndex(read => read.kind === 'bad')
    const problem = reads[bad]
    if (problem !== undefined && problem.kind === 'bad') {
      return { ok: false, error: `年历 ${year} 第 ${String(bad + 1)} 段假期：${problem.error}` }
    }
    const ranges = writableRanges(year, entry.holidays)
    if (ranges.length > 0) calendar[year] = ranges
  }
  return { ok: true, calendar }
}

export function holidaysOf(entries: CalendarEntries): ReadonlySet<string> {
  const calendar: PricingCalendarInput = {}
  for (const [year, entry] of entries) {
    const ranges = writableRanges(year, entry.holidays)
    if (ranges.length > 0) calendar[year] = ranges
  }
  return holidaySet(calendar)
}

function calendarSignature(entries: CalendarEntries, autoYears: ReadonlySet<string>): string {
  const filled = [...entries]
    .map(([year, entry]) => [
      year,
      entry.holidays.filter(row => row.start !== '' || row.end !== '').map(row => [row.start, row.end]),
      autoYears.has(year),
    ] as const)
    .filter(([, rows]) => rows.length > 0)
    .sort((left, right) => left[0].localeCompare(right[0]))
  return JSON.stringify(filled)
}

export function withCalendar(state: PriceState, calendar: CalendarEntries): PriceState {
  return { ...state, calendar, holidays: holidaysOf(calendar) }
}

export function adoptYear(state: PriceState, year: string): PriceState {
  if (!state.autoYears.has(year)) return state
  const autoYears = new Set(state.autoYears)
  autoYears.delete(year)
  return { ...state, autoYears }
}

export function fxValue(text: string): number | null {
  const parsed = parseAmount(text)
  return parsed === null || parsed === 0 ? null : parsed
}

export function fxIssue(text: string): string | null {
  const raw = text.trim()
  if (raw === '' || fxValue(raw) !== null) return null
  return '汇率必须是大于 0 的数字（1 美元等于多少元）'
}

export function fxSignature(text: string): string {
  const raw = text.trim()
  if (raw === '') return ''
  const rate = fxValue(raw)
  return rate === null ? raw : String(rate)
}

export function fxSetting(text: string): { cnyPerUsd: number } | null {
  const rate = fxValue(text)
  return rate === null ? null : { cnyPerUsd: rate }
}

export function withFx(state: PriceState, fx: string): PriceState {
  return { ...state, fx }
}

function convertedRates(view: MoneyView, holder: RateTexts, to: PriceCurrency): RateTexts {
  const next: RateTexts = { ...holder }
  for (const [field] of RATE_INPUTS) {
    const converted = convertText(view, holder[field], to)
    if (converted !== null) next[field] = converted
  }
  return next
}

export function withRouteCurrency(
  state: PriceState,
  route: string,
  to: PriceCurrency,
  cnyPerUsd: number | null,
): PriceState {
  const card = state.routes.get(route)
  if (card === undefined || card.currency === to) return state
  if (cnyPerUsd === null || !(cnyPerUsd > 0)) return state
  const view: MoneyView = { route: card.currency, cnyPerUsd }
  const models = new Map<string, ModelDraft>()
  for (const [model, row] of card.models) {
    models.set(model, {
      ...row,
      ...convertedRates(view, row, to),
      slots: row.slots.map(slot => ({ ...slot, ...convertedRates(view, slot, to) })),
    })
  }
  const routes = new Map(state.routes)
  routes.set(route, { ...card, models, currency: to })
  return { ...state, routes }
}

function hourValue(text: string): number {
  const raw = text.trim()
  return /^\d{1,2}$/u.test(raw) ? Number(raw) : Number.NaN
}

export function slotRange(slot: SlotDraft): { start: number; end: number } {
  return { start: hourValue(slot.start), end: hourValue(slot.end) }
}

function isBlankRates(holder: RateTexts): boolean {
  return RATE_INPUTS.every(([field]) => holder[field].trim() === '')
}

export function isBlankSlot(slot: SlotDraft): boolean {
  return isBlankRates(slot)
}

export function effectiveSlots(price: { slots: readonly SlotDraft[] }): SlotDraft[] {
  return price.slots.filter(slot => !isBlankSlot(slot))
}

function hasContent(price: { slots: readonly SlotDraft[] } & RateTexts): boolean {
  return !isBlankRates(price) || effectiveSlots(price).length > 0
}

export function newSlot(seed: Partial<Omit<SlotDraft, 'id'>> = {}): SlotDraft {
  return {
    id: takeId(),
    days: seed.days ?? 'daily',
    start: seed.start ?? '9',
    end: seed.end ?? '12',
    input: seed.input ?? '',
    output: seed.output ?? '',
    cacheRead: seed.cacheRead ?? '',
    cacheWrite: seed.cacheWrite ?? '',
  }
}

export function duplicateSlot(slot: SlotDraft): SlotDraft {
  const { start, end } = slotRange(slot)
  const length = isHourRange({ start, end }) ? end - start : 1
  if (isHourRange({ start, end }) && end + length <= 24) {
    return { ...slot, id: takeId(), start: String(end), end: String(end + length) }
  }
  if (isHourRange({ start, end }) && start - length >= 0) {
    return { ...slot, id: takeId(), start: String(start - length), end: String(start) }
  }
  return { ...slot, id: takeId() }
}

export function withSlotStart(slot: SlotDraft, startText: string): SlotDraft {
  const start = hourValue(startText)
  if (!Number.isFinite(start)) return slot
  const end = hourValue(slot.end)
  const nextEnd = Number.isFinite(end) && end > start ? end : Math.min(24, start + 1)
  return { ...slot, start: String(start), end: String(nextEnd) }
}

export function withSlotEnd(slot: SlotDraft, endText: string): SlotDraft {
  const end = hourValue(endText)
  if (!Number.isFinite(end)) return slot
  const start = hourValue(slot.start)
  const nextStart = Number.isFinite(start) && start < end ? start : Math.max(0, end - 1)
  return { ...slot, start: String(nextStart), end: String(end) }
}

function rateText(value: number | undefined): string {
  return value === undefined ? '' : String(value)
}

function slotDraft(slot: PricingSlotInput): SlotDraft {
  return {
    id: takeId(),
    days: slot.days,
    start: String(slot.start),
    end: String(slot.end),
    input: rateText(slot.inputPerMillion),
    output: rateText(slot.outputPerMillion),
    cacheRead: rateText(slot.cacheReadPerMillion),
    cacheWrite: rateText(slot.cacheWritePerMillion),
  }
}

function priceDraft(price: PricingEntryInput): RateTexts & { slots: SlotDraft[] } {
  return {
    input: rateText(price.inputPerMillion),
    output: rateText(price.outputPerMillion),
    cacheRead: rateText(price.cacheReadPerMillion),
    cacheWrite: rateText(price.cacheWritePerMillion),
    slots: (price.slots ?? []).map(slotDraft),
  }
}

export function draftFromView(view: PricingView): PriceState {
  const draft: PriceDraft = new Map()
  for (const card of view.routes) {
    const models = new Map<string, ModelDraft>()
    for (const row of card.models) {
      const price = row.price === undefined
        ? { input: '', output: '', cacheRead: '', cacheWrite: '', slots: [] }
        : priceDraft(row.price)
      models.set(row.model, {
        model: row.model,
        ...(row.name !== undefined ? { name: row.name } : {}),
        records: row.records,
        ...(row.unpriced !== undefined ? { unpriced: row.unpriced } : {}),
        ...price,
      })
    }
    draft.set(card.route, {
      route: card.route,
      label: card.label,
      billing: card.billing,
      currency: card.currency ?? 'CNY',
      records: card.records,
      models,
    })
  }
  const calendar: CalendarEntries = new Map()
  for (const [year, ranges] of Object.entries(view.calendar ?? {})) {
    calendar.set(year, {
      year,
      holidays: ranges.map(range => newHoliday({ start: range.start, end: range.end })),
    })
  }
  return {
    routes: draft,
    calendar,
    holidays: holidaysOf(calendar),
    autoYears: new Set(view.calendarAuto ?? []),
    fx: view.fx === undefined ? '' : String(view.fx.cnyPerUsd),
  }
}

export function isUnpriced(model: ModelDraft): boolean {
  return isBlankRates(model)
}

export function priceUnknown(model: ModelDraft): boolean {
  return isUnpriced(model) || (model.unpriced ?? 0) > 0
}

export type RateField = keyof RateTexts

export interface InForceRates {
  slot: SlotDraft | null
  values: RateTexts
}

function activeSlot(price: ModelDraft, nowMs: number, holidays: ReadonlySet<string>): SlotDraft | null {
  for (const slot of effectiveSlots(price)) {
    const { start, end } = slotRange(slot)
    if (isHourRange({ start, end }) && slotCovers({ days: slot.days, start, end }, nowMs, holidays)) return slot
  }
  return null
}

export function ratesInForce(
  model: ModelDraft,
  holidays: ReadonlySet<string>,
  nowMs: number = Date.now(),
): InForceRates | null {
  if (isUnpriced(model)) return null
  const slot = activeSlot(model, nowMs, holidays)
  if (slot === null) return { slot: null, values: inheritedRates(model) }
  const inherit = (field: RateField): string => {
    const own = slot[field].trim()
    return own === '' ? model[field] : own
  }
  return {
    slot,
    values: {
      input: inherit('input'),
      output: inherit('output'),
      cacheRead: inherit('cacheRead'),
      cacheWrite: inherit('cacheWrite'),
    },
  }
}

export type FieldState = 'ok' | 'empty' | 'bad'

export function fieldState(holder: RateTexts | null, field: RateField): FieldState {
  if (holder === null) return 'empty'
  const raw = holder[field].trim()
  if (raw === '') return 'empty'
  return parseAmount(raw) === null ? 'bad' : 'ok'
}

export function inheritedRates(price: RateTexts): RateTexts {
  return {
    input: price.input,
    output: price.output,
    cacheRead: price.cacheRead,
    cacheWrite: price.cacheWrite,
  }
}

export interface InheritedCell {
  value?: string
  note?: string
}

export function inheritedCell(
  price: RateTexts,
  slot: SlotDraft | null,
  field: RateField,
  show: (cnyText: string) => string = cnyText => cnyText,
): InheritedCell {
  const wider = slot === null ? '' : price[field].trim()
  if (wider !== '') return { value: show(wider), note: `留空 = 沿用基准价 ${show(wider)}` }
  if (field === 'input' || field === 'output') {
    return slot === null ? {} : { note: '留空 = 沿用基准价（基准价这档也是空的）' }
  }
  const own = slot === null ? '' : slot.input.trim()
  const input = own !== '' ? own : price.input.trim()
  if (input === '') return { note: '留空 = 按输入价计（输入价还没填）' }
  return { value: show(input), note: `留空 = 按输入价计 ${show(input)}：这一档没有单独定价` }
}

function rateIssue(holder: RateTexts, prefix: string): string | null {
  for (const [field, label] of RATE_INPUTS) {
    const state = fieldState(holder, field)
    if (state === 'bad') return `${prefix}${label}「${holder[field].trim()}」不是有效的非负数字`
    if (state === 'empty' && (field === 'input' || field === 'output')) return `${prefix}${label}还空着`
  }
  return null
}

export function ratesOf(holder: RateTexts): DraftRates | null {
  const input = parseAmount(holder.input)
  const output = parseAmount(holder.output)
  if (input === null || output === null) return null
  const cacheRead = parseAmount(holder.cacheRead)
  const cacheWrite = parseAmount(holder.cacheWrite)
  return {
    input,
    output,
    ...(cacheRead !== null ? { cacheRead } : {}),
    ...(cacheWrite !== null ? { cacheWrite } : {}),
  }
}

function badRateField(holder: RateTexts): string | null {
  for (const [field, label] of RATE_INPUTS) {
    if (fieldState(holder, field) === 'bad') return `${label}「${holder[field].trim()}」不是有效的非负数字`
  }
  return null
}

export function slotRates(slot: SlotDraft): { ok: true; rates: SlotRates } | { ok: false; error: string } {
  const rates: SlotRates = {}
  for (const [field, label] of RATE_INPUTS) {
    const raw = slot[field].trim()
    if (raw === '') continue
    const parsed = parseAmount(raw)
    if (parsed === null) return { ok: false, error: `${label}「${raw}」不是有效的非负数字` }
    rates[field] = parsed
  }
  return { ok: true, rates }
}

function slotIssue(slot: SlotDraft, all: readonly SlotDraft[], index: number): string | null {
  const where = `第 ${String(index + 1)} 个峰谷时段`
  const { start, end } = slotRange(slot)
  if (!isHourRange({ start, end })) {
    return `${where}的时段必须是整点，且 0 ≤ 开始 < 结束 ≤ 24（24 = 当天结束）`
  }
  const rates = slotRates(slot)
  if (!rates.ok) return `${where}的${rates.error}`
  for (let other = 0; other < index; other += 1) {
    const peer = all[other]!
    if (isBlankSlot(peer)) continue
    const peerRange = slotRange(peer)
    if (!isHourRange(peerRange)) continue
    if (slotsOverlap({ days: peer.days, ...peerRange }, { days: slot.days, start, end })) {
      return `${where}（${dayLabel(slot)}）与第 ${String(other + 1)} 个峰谷时段（${dayLabel(peer)}）重叠：同一时刻只能有一个时段价`
    }
  }
  return null
}

export function dayLabel(slot: SlotDraft): string {
  return `${DAY_SET_LABELS[slot.days]} ${rangeLabel(slotRange(slot))}`
}

export function priceIssue(model: ModelDraft): string | null {
  if (!hasContent(model)) return null
  const rates = rateIssue(model, '')
  if (rates !== null) return rates
  for (let index = 0; index < model.slots.length; index += 1) {
    const slot = model.slots[index]!
    if (isBlankSlot(slot)) continue
    const problem = slotIssue(slot, model.slots, index)
    if (problem !== null) return problem
  }
  return null
}

function priceSignature(model: ModelDraft): Record<string, unknown> | null {
  if (!hasContent(model)) return null
  const rates = ratesOf(model)
  return {
    rates: rates === null || badRateField(model) !== null ? null : rates,
    slots: effectiveSlots(model).map((slot) => {
      const rates = slotRates(slot)
      return {
        days: slot.days,
        start: hourValue(slot.start),
        end: hourValue(slot.end),
        rates: rates.ok ? rates.rates : null,
      }
    }),
  }
}

export function modelSignature(model: ModelDraft): string {
  return JSON.stringify(priceSignature(model))
}

export function rowKey(route: string, model: string): string {
  return `${route}\u0000${model}`
}

function slotBody(slot: SlotDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {
    days: slot.days,
    start: hourValue(slot.start),
    end: hourValue(slot.end),
  }
  const rates = slotRates(slot)
  if (rates.ok) {
    for (const [draftKey, wireKey] of RATE_FIELD_NAMES) {
      const value = rates.rates[draftKey]
      if (value !== undefined) body[wireKey] = value
    }
  }
  return body
}

function routeIssue(route: string): string | null {
  if (route === '') return '存在空通道路由名'
  if (route.startsWith('$')) return `通道路由名不得以「$」开头（「$」是价文件的保留键前缀）：${route}`
  if (route.length > MAX_ROUTE_LENGTH) return `通道路由名超过 ${String(MAX_ROUTE_LENGTH)} 字：${route.slice(0, 40)}…`
  return null
}

function modelIssue(model: string): string | null {
  if (model === '') return '存在空模型串'
  if (model.length > MAX_MODEL_LENGTH) return `模型串超过 ${String(MAX_MODEL_LENGTH)} 字：${model.slice(0, 40)}…`
  return null
}

export function composePriceBody(state: PriceState): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  const body: Record<string, unknown> = {}
  const billing: Record<string, BillingNature> = {}
  for (const [route, card] of state.routes) {
    if (card.billing !== 'metered') billing[route] = card.billing
    const models: Record<string, unknown> = {}
    for (const [model, row] of card.models) {
      if (!hasContent(row)) continue
      const modelProblem = modelIssue(model)
      if (modelProblem !== null) return { ok: false, error: `「${route}」的${modelProblem}` }
      const where = `「${route}」的「${model}」`
      const issue = rateIssue(row, '')
      if (issue !== null) return { ok: false, error: `${where}的${issue}` }
      const rates = ratesOf(row)
      if (rates === null) return { ok: false, error: `${where}的输入价 / 输出价必须是非负数字` }
      const out: Record<string, unknown> = {}
      for (const [draftKey, wireKey] of RATE_FIELD_NAMES) {
        const value = rates[draftKey]
        if (value !== undefined) out[wireKey] = value
      }
      const slots = effectiveSlots(row)
      if (slots.length > 0) {
        for (let index = 0; index < row.slots.length; index += 1) {
          const slot = row.slots[index]!
          if (isBlankSlot(slot)) continue
          const problem = slotIssue(slot, row.slots, index)
          if (problem !== null) return { ok: false, error: `${where}的${problem}` }
        }
        out.slots = [...slots]
          .sort((left, right) =>
            hourValue(left.start) - hourValue(right.start)
            || DAY_SETS.indexOf(left.days) - DAY_SETS.indexOf(right.days))
          .map(slotBody)
      }
      models[model] = out
    }
    if (Object.keys(models).length > 0) {
      const routeProblem = routeIssue(route)
      if (routeProblem !== null) return { ok: false, error: routeProblem }
      body[route] = models
    }
  }
  if (Object.keys(billing).length > 0) body[PRICING_BILLING_KEY] = billing
  const calendar = composeCalendar(state.calendar, state.autoYears)
  if (!calendar.ok) return { ok: false, error: calendar.error }
  if (Object.keys(calendar.calendar).length > 0) body[PRICING_CALENDAR_KEY] = calendar.calendar
  const fxProblem = fxIssue(state.fx)
  if (fxProblem !== null) return { ok: false, error: fxProblem }
  const fx = fxSetting(state.fx)
  const currency: CurrencyMap = {}
  for (const [route, card] of state.routes) {
    if (card.currency !== 'USD') continue
    if (fx === null) {
      return { ok: false, error: `「${route}」按美元报价，但还没有汇率：先在汇率格里填 1 美元等于多少元` }
    }
    currency[route] = 'USD'
  }
  if (Object.keys(currency).length > 0) body[PRICING_CURRENCY_KEY] = currency
  if (fx !== null) body[PRICING_FX_KEY] = fx
  return { ok: true, body }
}

export interface PriceBaseline {
  models: Map<string, string>
  billing: Map<string, BillingNature>
  currency: Map<string, PriceCurrency>
  calendar: string
  fx: string
}

export function baselinesOf(view: PricingView): PriceBaseline {
  return baselineOfDraft(draftFromView(view))
}

export function baselineOfDraft(state: PriceState): PriceBaseline {
  const models = new Map<string, string>()
  const billing = new Map<string, BillingNature>()
  const currency = new Map<string, PriceCurrency>()
  for (const [route, card] of state.routes) {
    billing.set(route, card.billing)
    currency.set(route, card.currency)
    for (const [model, row] of card.models) {
      models.set(rowKey(route, model), modelSignature(row))
    }
  }
  return {
    models, billing, currency,
    calendar: calendarSignature(state.calendar, state.autoYears),
    fx: fxSignature(state.fx),
  }
}

export function stagedChanges(state: PriceState, baseline: PriceBaseline): number {
  let count = 0
  for (const [route, card] of state.routes) {
    if ((baseline.billing.get(route) ?? 'metered') !== card.billing) count += 1
    if ((baseline.currency.get(route) ?? 'CNY') !== card.currency) count += 1
    for (const row of card.models.values()) {
      if (modelDirty(route, row, baseline.models)) count += 1
    }
  }
  if (calendarSignature(state.calendar, state.autoYears) !== baseline.calendar) count += 1
  if (fxSignature(state.fx) !== baseline.fx) count += 1
  return count
}

export function calendarDirty(state: PriceState, baseline: PriceBaseline): boolean {
  return calendarSignature(state.calendar, state.autoYears) !== baseline.calendar
}

export function modelDirty(route: string, row: ModelDraft, baseline: ReadonlyMap<string, string>): boolean {
  return (baseline.get(rowKey(route, row.model)) ?? '') !== modelSignature(row)
}

export function routeOptionLabel(card: RouteDraft): string {
  const models = [...card.models.values()]
  const unknown = models.filter(priceUnknown).length
  const parts = [card.route]
  if (card.records > 0) parts.push(`${String(card.records)} 次`)
  parts.push(unknown === 0 ? `${String(models.length)} 个模型` : `${String(unknown)} 个模型未知`)
  return parts.join(' · ')
}

export function modelOptionLabel(row: ModelDraft, dirty: boolean): string {
  const parts = [row.model]
  if (row.records > 0) parts.push(`${String(row.records)} 次`)
  if (priceUnknown(row)) parts.push('价格未知')
  if (dirty) parts.push('未保存')
  return parts.join(' · ')
}
