/**
 * 价格表 tab 的纯逻辑：草稿、脏标记签名、保存 wire body。空白时段只是草稿、不写出去，
 * 所以探索不被惩罚。价格口径（每个 (通道, 模型) 一份当前价 + 峰谷时段）与宿主共用
 * `price-format.ts` 与 `docs/CONTRACTS.md`。刻意无 React——tab 可测试的那一半。
 */

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

/** 峰谷时段的四个桶，各自可选：时段留空的桶沿用基准价。 */
export type SlotRates = Partial<DraftRates>

/** 草稿 rate 字段 → 写成 wire/文件的字段名。 */
export const RATE_FIELD_NAMES: ReadonlyArray<readonly [keyof DraftRates, keyof ModelPricing]> = [
  ['input', 'inputPerMillion'],
  ['output', 'outputPerMillion'],
  ['cacheRead', 'cacheReadPerMillion'],
  ['cacheWrite', 'cacheWritePerMillion'],
]

/** 一份可编辑价格的四个价输入——基准价或其中一个峰谷时段。字符串使半输入的数字存活。 */
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
  /** 本地 React key；编辑间稳定，输入框不丢焦点。 */
  id: number
  days: DaySet
  /** 开始小时，文本（`0`–`23`）。 */
  start: string
  /** 结束小时，文本，不含（`1`–`24`；`24` 关日）。 */
  end: string
}

/** 一个模型的可编辑价格：四档基准价 + 叠在它上面的峰谷时段。
 *  四档全空 = 这条 (通道, 模型) 没有价，它的记录按 ¥0 计并列为价格未知。 */
export interface ModelDraft extends RateTexts {
  model: string
  /** settings / 适配器目录给出的展示名；无人命名该串时省略。 */
  name?: string
  records: number
  /** 账本里按当前价折算不出金额的记录数。wire 上的只读事实，不参与保存；
   *  省略 = 读不到账本透镜，**不等于**零。 */
  unpriced?: number
  /** 叠在基准价上的峰谷时段；空 = 仅基准价。 */
  slots: SlotDraft[]
}

export interface RouteDraft {
  route: string
  label: string
  billing: BillingNature
  /** 这条通道的价用哪种货币记（`$currency`；缺席读作人民币）。价里的文本就是它。 */
  currency: PriceCurrency
  records: number
  models: Map<string, ModelDraft>
}

export type PriceDraft = Map<string, RouteDraft>

/** 一段可编辑的假期：开始与结束日期（`YYYY-MM-DD`，含两端）。空串 = 那一头还没填。 */
export interface CalendarHolidayDraft {
  /** 本地 React key；编辑间稳定，日期格不丢焦点。 */
  id: number
  start: string
  end: string
}

/** 一份可编辑的法定节假日年历：一年一组，组里是一段段假期。 */
export interface CalendarDraft {
  /** 年份，四位数字；组里每一段都必须落在这一年里（控件与判定各挡一道）。 */
  year: string
  holidays: CalendarHolidayDraft[]
}

/** 年历草稿：年份 → 那一年。 */
export type CalendarEntries = Map<string, CalendarDraft>

/**
 * 整份价表草稿：route 卡 + 年历。
 *
 * `holidays` 是年历草稿当前解析出的放假日集合——`workdays` 时段的生效判定要用它，
 * 所以它跟着文本走（改一个字，行内「此刻的价」当场跟着变）。它只在写入成功后更换，
 * 那一次写入的正是同一份年历。
 */
export interface PriceState {
  routes: PriceDraft
  calendar: CalendarEntries
  holidays: ReadonlySet<string>
  /** 价文件 `$fx` 的汇率文本框（1 美元等于多少元）。字符串使半输入存活；空 = 未设汇率
   *  （美元面不可用）。它是**全表共用的一份事实**，不属于任何一行。 */
  fx: string
}

let nextId = 1

function takeId(): number {
  const id = nextId
  nextId += 1
  return id
}

// ---------------------------------------------------------------------------
// 法定节假日年历
// ---------------------------------------------------------------------------

export function newHoliday(seed: Partial<Omit<CalendarHolidayDraft, 'id'>> = {}): CalendarHolidayDraft {
  return { start: '', end: '', ...seed, id: takeId() }
}

/**
 * 「不填年份时加哪一年」：一年都没填过日期 → **今年**（新装的插件不该跳过眼下这一年），
 * 填过 → **下一年**（国家的安排提前一年公布）。只建了组没填日期不算「填过」；
 * 候选年被占就往后找第一个空位。
 */
export function defaultCalendarYear(entries: CalendarEntries, now: Date = new Date()): string {
  const started = [...entries.values()].some(entry => entry.holidays.some(row => row.start !== '' || row.end !== ''))
  let year = now.getFullYear() + (started ? 1 : 0)
  while (entries.has(String(year))) year += 1
  return String(year)
}

export type HolidayRead =
  | { kind: 'empty' }
  | { kind: 'partial' }
  | { kind: 'ok'; days: number }
  | { kind: 'bad'; error: string }

/** 内部读法，比 {@link HolidayRead} 多带算好的区间——重叠判定要用它。 */
type HolidaySpan =
  | { kind: 'empty' }
  | { kind: 'partial' }
  | { kind: 'ok'; days: number; span: HolidayRange }
  | { kind: 'bad'; error: string }

/** 只填了一头**不是错误**：那是「还没写完」，是占位。 */
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

/**
 * 一年里每一段假期的读数。天数（含两端）是这份数据的自检：官方通知写的就是「每条假期共 N 天」，
 * 一个一个对过去才查得出抄错；只看全年总数会被两处方向相反的手误抵消。
 *
 * 重叠**算错**：同一年里两段假期按定义不相交。冲突报在后出现的那一段上，
 * 于是同一份草稿的读法是确定的：先写的那一段照旧生效。
 */
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

/** 一年里能写出去的那些区间（读作 ok 的段），判定与写路径共用。 */
function writableRanges(year: string, rows: readonly CalendarHolidayDraft[]): HolidayRange[] {
  const reads = readHolidays(year, rows)
  return rows.flatMap((row, index) => (reads[index]!.kind === 'ok' ? [{ start: row.start, end: row.end }] : []))
}

/** 一组假期有几段、共几天（只算能写出去的那些）。 */
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

/**
 * 年历草稿 → 送宿主 / 写文件的那份年历；填坏了的那一段即拒绝（连同年份与第几段）。
 * 还没写完的（整组没填 / 只填了一头）**跳过**：写出去等于没写。它们因此不挡住同一份
 * 文件里的价——年历与价共用一个文件，为一行占位把整张价表冻住是拿错的代价去罚没错的
 * 东西；缺年告警会继续说那一年。
 */
export function composeCalendar(entries: CalendarEntries): { ok: true; calendar: PricingCalendarInput } | { ok: false; error: string } {
  const calendar: PricingCalendarInput = {}
  for (const [year, entry] of entries) {
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

/** 年历草稿当前的放假日集合（服务行内「此刻的价」与时段重叠判定）。读不出 ok 的段在这一刻
 *  不参与判定——它们自己也写不出去；跳过 = 那些日子仍按高峰算，安全方向。 */
export function holidaysOf(entries: CalendarEntries): ReadonlySet<string> {
  const calendar: PricingCalendarInput = {}
  for (const [year, entry] of entries) {
    const ranges = writableRanges(year, entry.holidays)
    if (ranges.length > 0) calendar[year] = ranges
  }
  return holidaySet(calendar)
}

/** 一份年历草稿的签名：**填过**的段按 `年: [[起, 止], …]` 排序（顺序不该算作改动）。整组
 *  没填的年份不进签名——它本来就写不出去，也不该让草稿看起来与磁盘不同（与行内「填了却
 *  写不出去的那一格照旧算脏」同一条尺子：填过才算数）。 */
function calendarSignature(entries: CalendarEntries): string {
  const filled = [...entries]
    .map(([year, entry]) => [
      year,
      entry.holidays.filter(row => row.start !== '' || row.end !== '').map(row => [row.start, row.end]),
    ] as const)
    .filter(([, rows]) => rows.length > 0)
    .sort((left, right) => left[0].localeCompare(right[0]))
  return JSON.stringify(filled)
}

/**
 * 换一份年历草稿，并把它的放假日集合一起换掉。
 *
 * `holidays` 与 `calendar` 必须同步换：`holidays` 错一代，就会让「年历刚写错、
 * 时段却还按旧年历生效」这种状态混进行内显示。删掉最后一年时保留上一份集合——
 * 冻结旧读法是**安全方向**（`workdays` 收窄，只会多算高峰），比空集更保守。
 */
export function withCalendar(state: PriceState, calendar: CalendarEntries): PriceState {
  return { ...state, calendar, holidays: holidaysOf(calendar) }
}

// ---------------------------------------------------------------------------
// 汇率（$fx）：全表共用的第二份数据
// ---------------------------------------------------------------------------

/** 汇率文本 → 正数；空、非法、0、负数 → null（「换不出来」）。 */
export function fxValue(text: string): number | null {
  const parsed = parseAmount(text)
  return parsed === null || parsed === 0 ? null : parsed
}

/** 汇率文本的问题，或 null。空不是问题——那是「不用汇率」（只要没有美元通道）。只在提交点报出来。 */
export function fxIssue(text: string): string | null {
  const raw = text.trim()
  if (raw === '' || fxValue(raw) !== null) return null
  return '汇率必须是大于 0 的数字（1 美元等于多少元）'
}

/** 汇率在签名里的样子：能解析就用解析值，否则用 trim 后的原文——`7.150` 与 `7.15`
 *  写出去的是同一个数，不该看起来像两处改动；填了却写不出去的原文照旧记账（保持脏）。 */
export function fxSignature(text: string): string {
  const raw = text.trim()
  if (raw === '') return ''
  const rate = fxValue(raw)
  return rate === null ? raw : String(rate)
}

/** 汇率的 wire 值：能写出去时才给（`{}` 与缺席都是「未设汇率」）。 */
export function fxSetting(text: string): { cnyPerUsd: number } | null {
  const rate = fxValue(text)
  return rate === null ? null : { cnyPerUsd: rate }
}

/** 改汇率文本本身不动任何一行——它只在计价与切换时被读。 */
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

/** 把一条通道的报价币种换成 `to`：它每一个模型、每一个时段里可解析的价都按汇率重记。 */
export function withRouteCurrency(
  state: PriceState,
  route: string,
  to: PriceCurrency,
  cnyPerUsd: number | null,
): PriceState {
  const card = state.routes.get(route)
  if (card === undefined || card.currency === to) return state
  // 换算不出来（没有汇率）时**什么都不动**：只把标签换个字、数字原样留着，等于把同一串数
  // 当成另一种货币读——那是 7 倍级的错。控件在没汇率时也点不动，这一条是最后一道闸。
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

/** 一个时段的小时，转成共享规则与标签接受的区间（非整点文本时 NaN；校验会报错，这里只喂展示与重叠检查）。 */
export function slotRange(slot: SlotDraft): { start: number; end: number } {
  return { start: hourValue(slot.start), end: hourValue(slot.end) }
}

// ---------------------------------------------------------------------------
// 草稿 vs 价格
// ---------------------------------------------------------------------------

/** 四档 rate 组是否完全没填。没填的组不参与有效性、签名或写入——一条还没定价的行
 *  不会弄脏草稿，也不会阻塞保存。 */
function isBlankRates(holder: RateTexts): boolean {
  return RATE_INPUTS.every(([field]) => holder[field].trim() === '')
}

export function isBlankSlot(slot: SlotDraft): boolean {
  return isBlankRates(slot)
}

export function effectiveSlots(price: { slots: readonly SlotDraft[] }): SlotDraft[] {
  return price.slots.filter(slot => !isBlankSlot(slot))
}

/** 这一行有没有任何**填过**的东西——四档基准价，或任一峰谷时段。全空 = 这条没有价
 *  （不报问题、不写进文件）；只填了时段而没填基准价 = 填了却写不出去（照旧算脏并挡住这一笔）。 */
function hasContent(price: { slots: readonly SlotDraft[] } & RateTexts): boolean {
  return !isBlankRates(price) || effectiveSlots(price).length > 0
}

// ---------------------------------------------------------------------------
// 播种
// ---------------------------------------------------------------------------

/** 一个新的峰谷时段：09:00–12:00 每天（峰谷窗口的起始形状），尚无费率——留空的桶继承基准价。 */
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

/** 一个峰谷时段的副本，紧接其**后**放置、长度相同，使「复制」永远不落在被复制的时段上。当天放不下时改放在其**前**。 */
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

/** 移动时段的开始小时并保持区间有效：结束不晚于新开始时跟随它，选小时时不会经过行会报错的中间状态。 */
export function withSlotStart(slot: SlotDraft, startText: string): SlotDraft {
  const start = hourValue(startText)
  if (!Number.isFinite(start)) return slot
  const end = hourValue(slot.end)
  const nextEnd = Number.isFinite(end) && end > start ? end : Math.min(24, start + 1)
  return { ...slot, start: String(start), end: String(nextEnd) }
}

/** {@link withSlotStart} 的镜像。 */
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

/** 从一份 wire 视图播种可编辑状态。**不补任何价**：没有价就是没有价——那些记录按 ¥0 计
 *  并列为价格未知，要给它价就在这一行的四格里填。 */
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
      // wire 上必有；手搭的视图（预览台 / 测试）可能没有，缺了就是人民币。
      currency: card.currency ?? 'CNY',
      records: card.records,
      models,
    })
  }
  const calendar: CalendarEntries = new Map()
  // 视图里的年历是合并过的区间（host 写的），所以逐段铺成行之后与文件逐字一致——
  // 刚播种的草稿不会因为「两段相邻的假期该不该并」而看起来像被编辑过。
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
    fx: view.fx === undefined ? '' : String(view.fx.cnyPerUsd),
  }
}

// ---------------------------------------------------------------------------
// 价格未知
// ---------------------------------------------------------------------------

/** 一行是否完全没有价（其记录计 ¥0）。 */
export function isUnpriced(model: ModelDraft): boolean {
  return isBlankRates(model)
}

/** 「价格未知」的判定：草稿里还没有价，或账本透镜报出有记录折算不出金额（按美元报价却没设
 *  汇率那种）。前者按草稿算，改价后当场跟手；后者是 host 的权威计数。 */
export function priceUnknown(model: ModelDraft): boolean {
  return isUnpriced(model) || (model.unpriced ?? 0) > 0
}

export type RateField = keyof RateTexts

/** 此刻在计费的价：基准价，叠上此刻生效的峰谷时段。 */
export interface InForceRates {
  /** 此刻生效的峰谷时段；null = 按基准价。 */
  slot: SlotDraft | null
  /** 四档的展示值：时段重述过的档用它自己的，留空的档沿用基准价。 */
  values: RateTexts
}

/** 这份价里此刻生效的峰谷时段；null = 基准价。`holidays` 决定 `workdays` 在法定节假日那天不生效。 */
function activeSlot(price: ModelDraft, nowMs: number, holidays: ReadonlySet<string>): SlotDraft | null {
  for (const slot of effectiveSlots(price)) {
    const { start, end } = slotRange(slot)
    if (isHourRange({ start, end }) && slotCovers({ days: slot.days, start, end }, nowMs, holidays)) return slot
  }
  return null
}

/** 行头那四个数字读的东西：此刻计费所用的价——宿主 `ratesOfEntry` 的同一条规则。
 *  还没定价时为 null（这一刻价格未知）。 */
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

/** 一个单元格的读数状态：`ok`（数字）、`empty`（尚未填）、`bad`（已输入但不是非负数字）。 */
export type FieldState = 'ok' | 'empty' | 'bad'

/** 一个单元格的状态，使行能标出确切出错的字段。 */
export function fieldState(holder: RateTexts | null, field: RateField): FieldState {
  if (holder === null) return 'empty'
  const raw = holder[field].trim()
  if (raw === '') return 'empty'
  return parseAmount(raw) === null ? 'bad' : 'ok'
}

/** 一份基准价，作为峰谷时段显示的继承 placeholder。 */
export function inheritedRates(price: RateTexts): RateTexts {
  return {
    input: price.input,
    output: price.output,
    cacheRead: price.cacheRead,
    cacheWrite: price.cacheWrite,
  }
}

/** 一个空单元格显示的鬼影与它的解释；`value` 缺省即这一档确实没有可沿用的数（`—` = 还没填）。 */
export interface InheritedCell {
  value?: string
  note?: string
}

/**
 * 一个空单元格显示的那个数，以及悬停时对它的解释。全表只有一条规则：**格子里出现数字 =
 * 留空沿用它；`—` = 还没填**。缓存读 / 写两档没有单独定价时按**输入价**计（宿主 `costOf`
 * 的同一条规则），所以它们的终点是生效的输入价；输入 / 输出必填，空着就是还没填。
 *
 * `show` 是数字进格子与说明文字之前的最后一道换算（价格表按美元读写时用，见 `./currency.ts`）：
 * **鬼影与说明里的数一起换**，否则格子里是美元、旁边注解还是人民币。缺省恒等。
 */
export function inheritedCell(
  price: RateTexts,
  slot: SlotDraft | null,
  field: RateField,
  show: (cnyText: string) => string = cnyText => cnyText,
): InheritedCell {
  // 更宽作用域里这一档自己的值。基准价那一行没有更宽的作用域，所以恒为空。
  const wider = slot === null ? '' : price[field].trim()
  if (wider !== '') return { value: show(wider), note: `留空 = 沿用基准价 ${show(wider)}` }
  if (field === 'input' || field === 'output') {
    return slot === null ? {} : { note: '留空 = 沿用基准价（基准价这档也是空的）' }
  }
  // 终点是**生效的**输入价：时段自己重述过就用它自己的。
  const own = slot === null ? '' : slot.input.trim()
  const input = own !== '' ? own : price.input.trim()
  if (input === '') return { note: '留空 = 按输入价计（输入价还没填）' }
  return { value: show(input), note: `留空 = 按输入价计 ${show(input)}：这一档没有单独定价` }
}

// ---------------------------------------------------------------------------
// 有效性
// ---------------------------------------------------------------------------

/** 一份基准价的首个问题，或 null：输入价与输出价必填，cache 桶可选，每个已填单元格须为非负数字。 */
function rateIssue(holder: RateTexts, prefix: string): string | null {
  for (const [field, label] of RATE_INPUTS) {
    const state = fieldState(holder, field)
    if (state === 'bad') return `${prefix}${label}「${holder[field].trim()}」不是有效的非负数字`
    if (state === 'empty' && (field === 'input' || field === 'output')) return `${prefix}${label}还空着`
  }
  return null
}

/** 一份草稿价格的 ¥/M 数字（段的基准价），必填字段尚非非负数字时为 null（cache 桶可选）。 */
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

/** **填了**却不是非负数字的那一格（`ratesOf` 负责「必填档空着 / 非法」；这里只补
 *  它看不见的可选档）。写路径与脏标记共用它：填了却写不出去的档既不能悄悄丢掉，
 *  也不能让那一行看起来「与磁盘一致」。 */
function badRateField(holder: RateTexts): string | null {
  for (const [field, label] of RATE_INPUTS) {
    if (fieldState(holder, field) === 'bad') return `${label}「${holder[field].trim()}」不是有效的非负数字`
  }
  return null
}

/** 一个峰谷时段重写的桶，或首个非数字值。可以只重写任意子集：留空的桶继承段的基准价。 */
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

/** 一个峰谷时段的首个问题，或 null。重叠检查针对前面已显示的时段，使消息能指名冲突的一对；空白草稿不参与。 */
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

/** 阻止这一行写入文件的唯一问题，可写时为 null。没填过的行不是问题——它只是还没有价。 */
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

// ---------------------------------------------------------------------------
// 签名与 wire body
// ---------------------------------------------------------------------------

/** 这一行的价保存时会写成的样子，草稿（四档全空）落在签名之外。填了却写不出去的档
 *  （四档里任一格非法）以 `null` 参与签名——那一格正红着，这一行就还没「与磁盘一致」。 */
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

/** 一个模型行的签名：保存时会为它写入的确切内容，tab 据此区分已编辑行与干净行。
 *  没价的行（`null`）与磁盘上同样没价的行签名相同。 */
export function modelSignature(model: ModelDraft): string {
  return JSON.stringify(priceSignature(model))
}

export function rowKey(route: string, model: string): string {
  return `${route}\u0000${model}`
}

/** 一个峰谷时段保存时写入的内容：它重写的桶，其余省略使基准价继续生效。 */
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

/** 一个 keys 层面的写入障碍，或 null：host 只接受非空、不以 `$` 开头（保留键前缀）、
 *  且不超长的 route / model 串。上限与保留键同源于 `price-format.ts`，所以草稿这一侧
 *  报得出位置与原因，而不是整份文件被拒。 */
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

/** 一次保存发送的 body：**完整的**目标文件。拒绝时给出首个问题的确切位置，与宿主自身解析的报错方式一致。 */
export function composePriceBody(state: PriceState): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  const body: Record<string, unknown> = {}
  const billing: Record<string, BillingNature> = {}
  for (const [route, card] of state.routes) {
    if (card.billing !== 'metered') billing[route] = card.billing
    const models: Record<string, unknown> = {}
    for (const [model, row] of card.models) {
      // 只有真会写出去的行才受键规则约束：完全没填的 route / model 不进 body，也就不该挡住这一笔。
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
  // 年历、报价币种、汇率与计费性质同处保留键前缀之下，写在 route 之前（与宿主 writer 同一顺序）。
  const calendar = composeCalendar(state.calendar)
  if (!calendar.ok) return { ok: false, error: calendar.error }
  if (Object.keys(calendar.calendar).length > 0) body[PRICING_CALENDAR_KEY] = calendar.calendar
  // 填了却写不出去的汇率必须挡住这一笔：让它过去就是把用户敲的数**悄悄丢掉**，而状态栏
  // 还会说「已保存」（与四档价里那一格红着是同一条尺子）。空着不是错误——那是「不用汇率」。
  const fxProblem = fxIssue(state.fx)
  if (fxProblem !== null) return { ok: false, error: fxProblem }
  const fx = fxSetting(state.fx)
  // 美元报价的通道**必须先有汇率**：没有它那些价换算不成人民币，金额会整条读作价格未知。
  // 宿主也挡这一笔（同一个判据），但这里说的是用户眼前那两样东西（通道 + 汇率格）。
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

/** 一次性写入的基线：每个 route 的计费性质与报价币种、每一行的签名、年历签名，以及汇率签名。 */
export interface PriceBaseline {
  models: Map<string, string>
  billing: Map<string, BillingNature>
  /** route → 报价币种（只记美元那几条；缺席 = 人民币）。 */
  currency: Map<string, PriceCurrency>
  calendar: string
  /** 汇率（`$fx`）的签名；见 `fxSignature`。 */
  fx: string
}

/** 一份视图的基线：行签名变了即 dirty。取自视图播种的同一草稿，故首记锚定等规则绝不会让刚播种的行看起来像被编辑过。 */
export function baselinesOf(view: PricingView): PriceBaseline {
  return baselineOfDraft(draftFromView(view))
}

/** 一次成功保存为草稿建立的基线：就是它自己的签名，本地草稿保持为唯一真源，tab 不必重新播种（那会 remount 正在输入的输入框）。 */
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
    calendar: calendarSignature(state.calendar),
    fx: fxSignature(state.fx),
  }
}

/** 与基线不同的行数（以及 route 计费开关数、报价币种数、年历一处、汇率一处）。 */
export function stagedChanges(state: PriceState, baseline: PriceBaseline): number {
  let count = 0
  for (const [route, card] of state.routes) {
    if ((baseline.billing.get(route) ?? 'metered') !== card.billing) count += 1
    if ((baseline.currency.get(route) ?? 'CNY') !== card.currency) count += 1
    for (const [model, row] of card.models) {
      if (modelDirty(route, row, baseline.models)) count += 1
    }
  }
  // 年历与汇率各算一处：它们都是全表共用的一份数据，不是逐行编辑。
  if (calendarSignature(state.calendar) !== baseline.calendar) count += 1
  if (fxSignature(state.fx) !== baseline.fx) count += 1
  return count
}

export function calendarDirty(state: PriceState, baseline: PriceBaseline): boolean {
  return calendarSignature(state.calendar) !== baseline.calendar
}

export function modelDirty(route: string, row: ModelDraft, baseline: ReadonlyMap<string, string>): boolean {
  return (baseline.get(rowKey(route, row.model)) ?? '') !== modelSignature(row)
}

// ---------------------------------------------------------------------------
// 下拉选项的文字
// ---------------------------------------------------------------------------

/**
 * 通道下拉里一项写什么。选项文字自己就是这一屏唯一的摘要面——它必须回答「这条通道有没有
 * 洞」，否则读者只能一条条点开看。全 0 的那一半不复述 0：负号（`N 个模型未知`）更短、更快认出来。
 */
export function routeOptionLabel(card: RouteDraft): string {
  const models = [...card.models.values()]
  const unknown = models.filter(priceUnknown).length
  const parts = [card.route]
  if (card.records > 0) parts.push(`${String(card.records)} 次`)
  parts.push(unknown === 0 ? `${String(models.length)} 个模型` : `${String(unknown)} 个模型未知`)
  return parts.join(' · ')
}

/** 模型下拉里一项写什么。`dirty` 由调用处按基线算——文字里那句「未保存」是这一屏唯一能说它的地方。 */
export function modelOptionLabel(row: ModelDraft, dirty: boolean): string {
  const parts = [row.model]
  if (row.records > 0) parts.push(`${String(row.records)} 次`)
  if (priceUnknown(row)) parts.push('价格未知')
  if (dirty) parts.push('未保存')
  return parts.join(' · ')
}

