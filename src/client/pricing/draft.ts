/**
 * 价格表 tab 的纯逻辑：草稿、脏标记签名、保存 wire body。
 *
 * 三条规则让探索不被惩罚：空白段/时段是草稿不写出去；峰谷时段可只重写任意子集，
 * 空着的档继承基准价；**每一段价都必须有生效时刻**，没有被任何段覆盖的日期按 ¥0 计
 * （列为价格未知，不是免费）。时间轴规则与宿主共用 `price-format.ts`。
 * 刻意无 React——tab 可测试的那一半。
 */

// 价文件的共享词表（保留键、长度上限）从共享内核取——client 不能 import
// `src/pricing.ts`（它拉了 `node:fs`），两条字面量各写一遍就会静默漂移。
import {
  DAY_SETS, DAY_SET_LABELS, MAX_MODEL_LENGTH, MAX_ROUTE_LENGTH, PRICING_BILLING_KEY, PRICING_CALENDAR_KEY,
  holidayRangeLabel, holidaySet, instantKey, instantMs, isHourRange, isYearKey, rangeLabel, slotCovers, slotsOverlap,
} from '../../price-format.ts'
import type {
  BillingNature, DaySet, HolidayCalendar, HolidayRange, ModelPricing, PricingCalendarInput,
  PricingSegmentInput, PricingSlotInput, PricingView,
} from '../../types.ts'

/** 一份价格的四个 ¥/M 桶，数字形式，键与草稿字段一致（未填写时桶缺席）。 */
export interface DraftRates {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

/** 峰谷时段的四个桶，各自可选：时段留空的桶沿用段的基准价。 */
export type SlotRates = Partial<DraftRates>

/** 草稿 rate 字段 → 写成 wire/文件的字段名。 */
export const RATE_FIELD_NAMES: ReadonlyArray<readonly [keyof DraftRates, keyof ModelPricing]> = [
  ['input', 'inputPerMillion'],
  ['output', 'outputPerMillion'],
  ['cacheRead', 'cacheReadPerMillion'],
  ['cacheWrite', 'cacheWritePerMillion'],
]

/** 一份可编辑价格的四个 ¥/M 输入——段的基准价或其中一个峰谷时段。字符串使半输入的数字存活。 */
export interface RateTexts {
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

/** 四个桶，按所有 surface 书写顺序排列，附校验消息用的标签。 */
const RATE_INPUTS: ReadonlyArray<readonly [keyof RateTexts, string]> = [
  ['input', '输入价'],
  ['output', '输出价'],
  ['cacheRead', '缓存读价'],
  ['cacheWrite', '缓存写价'],
]

/** 一个峰谷时段：覆盖的小时与星期，以及自己的 rate 输入。 */
export interface SlotDraft extends RateTexts {
  /** 本地 React key；编辑间稳定，输入框不丢焦点。 */
  id: number
  days: DaySet
  /** 开始小时，文本（`0`–`23`）。 */
  start: string
  /** 结束小时，文本，不含（`1`–`24`；`24` 关日）。 */
  end: string
}

/** 一个可编辑价格段。`from` 为 `''` = 最早一段，否则 `YYYY-MM-DD` 或 `YYYY-MM-DDTHH:00`。 */
export interface SegmentDraft extends RateTexts {
  /** 本地 React key；编辑间稳定，输入框不丢焦点。 */
  id: number
  from: string
  /** 叠在基准价上的峰谷时段；空 = 仅基准价。 */
  slots: SlotDraft[]
}
/** 一张 route 卡的可编辑模型行。 */
export interface ModelDraft {
  model: string
  /** settings / 适配器目录给出的展示名；无人命名该串时省略。 */
  name?: string
  /** 账本记录了该 (route, model) 的次数。 */
  records: number
  /** 账本首/末计费时刻，以及多少条记录没有价段覆盖（¥0）。wire 上的只读事实，都不参与保存；
   *  省略 = 读不到账本透镜，**不等于**零。 */
  firstAt?: number
  lastAt?: number
  unpriced?: number
  segments: SegmentDraft[]
}

/** 一张可编辑 route 卡。 */
export interface RouteDraft {
  route: string
  label: string
  billing: BillingNature
  records: number
  models: Map<string, ModelDraft>
}

/** 整份草稿，按 route key 键控。 */
export type PriceDraft = Map<string, RouteDraft>

/** 一份可编辑的法定节假日年历。 */
export interface CalendarDraft {
  /** 年份，四位数字。 */
  year: string
  /** 放假日区间，每项形如 `2026-02-15 ~ 2026-02-23`；一行一项（逗号/换行/顿号分隔）。 */
  text: string
}

/** 年历草稿：年份 → 该年的原始文本。 */
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
}

let nextId = 1

function takeId(): number {
  const id = nextId
  nextId += 1
  return id
}

/** 今天的本地 `YYYY-MM-DD`。 */
export function todayKey(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${String(now.getFullYear())}-${month}-${day}`
}

/** 草稿 `from` 所指的有效时刻；空或不是真实时刻 = null（一段价必须有生效时刻）。 */
function instantOf(from: string): number | null {
  return instantMs(from.trim())
}

// ---------------------------------------------------------------------------
// 法定节假日年历
// ---------------------------------------------------------------------------

/** 一行 / 逗号 / 顿号分隔的区间文本。 */
const RANGE_SEPARATORS_RE = /[\n,，、;；]/u

/** 一个区间项的文本形态：`2026-02-15 ~ 2026-02-23`（单独一天写成 `起 ~ 止` 同值）。 */
export function holidayRangeText(range: HolidayRange): string {
  return `${range.start} ~ ${range.end}`
}

/**
 * 一年区间文本 → 区间数组，或首个问题。
 *
 * 只接受**完整日期**的区间对（`起 ~ 止`，单个日期也算），分隔符是换行 / 逗号 /
 * 顿号 / 分号。刻意不接受「省略年份」这类简写：漏写一年就会静默把假期记到错的
 * 年份上，而这份数据的代价正是「写错一年 = 整年错价」。
 */
export function parseCalendarText(text: string, year: string): { ok: true; ranges: HolidayRange[] } | { ok: false; error: string } {
  const ranges: HolidayRange[] = []
  for (const raw of text.split(RANGE_SEPARATORS_RE)) {
    const item = raw.trim()
    if (item === '') continue
    const parts = item.split('~')
    if (parts.length > 2) return { ok: false, error: `「${item}」不是日期或区间（写成 2026-01-01 或 2026-01-01 ~ 2026-01-03）` }
    const start = (parts[0] ?? '').trim()
    const end = (parts.length === 2 ? parts[1] ?? '' : start).trim()
    const at = instantMs(start)
    const to = instantMs(end)
    if (at === null || to === null) {
      return { ok: false, error: `「${item}」不是有效日期（要 YYYY-MM-DD，且是真实存在的一天）` }
    }
    if (at > to) return { ok: false, error: `「${item}」的开始晚于结束` }
    if (start.slice(0, 4) !== year || end.slice(0, 4) !== year) {
      return { ok: false, error: `「${item}」跨出了 ${year} 年：一段假期必须落在它所属的那一年里` }
    }
    ranges.push({ start, end })
  }
  if (ranges.length === 0) return { ok: false, error: `${year} 年还没有写任何放假日` }
  return { ok: true, ranges }
}

/** 年历草稿 → 送宿主 / 写文件的那份年历；有问题的年份即拒绝（连同位置）。 */
export function composeCalendar(entries: CalendarEntries): { ok: true; calendar: PricingCalendarInput } | { ok: false; error: string } {
  const calendar: PricingCalendarInput = {}
  for (const [year, entry] of entries) {
    if (!isYearKey(year)) return { ok: false, error: `年历的年份「${year}」必须是四位数字` }
    const parsed = parseCalendarText(entry.text, year)
    if (!parsed.ok) return { ok: false, error: `年历 ${year}：${parsed.error}` }
    calendar[year] = parsed.ranges
  }
  return { ok: true, calendar }
}

/** 年历草稿当前的放假日集合（服务行内「此刻的价」与时段重叠判定）。含问题的
 *  年份在这一刻不参与判定——它自己也写不出去。 */
export function holidaysOf(entries: CalendarEntries): ReadonlySet<string> {
  const calendar: PricingCalendarInput = {}
  for (const [year, entry] of entries) {
    const parsed = parseCalendarText(entry.text, year)
    if (parsed.ok) calendar[year] = parsed.ranges
  }
  return holidaySet(calendar)
}

/** 一份年历草稿的签名：加入的年份按 `年: 文本` 排序（顺序不该算作改动）。 */
function calendarSignature(entries: CalendarEntries): string {
  return JSON.stringify([...entries].map(([year, entry]) => [year, entry.text]).sort((left, right) => left[0]!.localeCompare(right[0]!)))
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

/** 年历的一个年份条目：该年的区间读法（写不出来时为空串，调用处显示问题）。 */
export function calendarEntryLabel(entry: CalendarDraft): string {
  const parsed = parseCalendarText(entry.text, entry.year)
  return parsed.ok ? parsed.ranges.map(holidayRangeLabel).join('、') : ''
}

/** 小时输入的数字；非整点文本时为 NaN。 */
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

/** 四档 rate 组是否完全没填。这样的块不参与有效性、签名或写入——「＋ 加一段价」永远不会弄脏行或阻塞保存。 */
function isBlankRates(holder: RateTexts): boolean {
  return RATE_INPUTS.every(([field]) => holder[field].trim() === '')
}

/** 一个峰谷时段是否还没有价。 */
export function isBlankSlot(slot: SlotDraft): boolean {
  return isBlankRates(slot)
}

/** 一个段是否还没有价（时段也为空）。 */
export function isBlankSegment(segment: SegmentDraft): boolean {
  return isBlankRates(segment) && segment.slots.every(isBlankSlot)
}

/** 一个段里实际带价的时段。 */
export function effectiveSlots(segment: SegmentDraft): SlotDraft[] {
  return segment.slots.filter(slot => !isBlankSlot(slot))
}

/** 一行里实际带价的段——tab 写入、弄脏标记、校验都只读这些。 */
export function effectiveSegments(model: ModelDraft): SegmentDraft[] {
  return model.segments.filter(segment => !isBlankSegment(segment))
}

// ---------------------------------------------------------------------------
// 播种
// ---------------------------------------------------------------------------

/** 从已有段（或从无）预填并日期定在今天的段——「加一段价」的起始形状。 */
export function newSegment(seed: Partial<Omit<SegmentDraft, 'id'>> = {}): SegmentDraft {
  return {
    id: takeId(),
    from: seed.from ?? todayKey(),
    input: seed.input ?? '',
    output: seed.output ?? '',
    cacheRead: seed.cacheRead ?? '',
    cacheWrite: seed.cacheWrite ?? '',
    slots: seed.slots ?? [],
  }
}

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

/** 移动时段的结束小时并保持区间有效（{@link withSlotStart} 的镜像）。 */
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

function segmentDraft(segment: PricingSegmentInput): SegmentDraft {
  return {
    id: takeId(),
    from: segment.from ?? '',
    input: rateText(segment.inputPerMillion),
    output: rateText(segment.outputPerMillion),
    cacheRead: rateText(segment.cacheReadPerMillion),
    cacheWrite: rateText(segment.cacheWritePerMillion),
    slots: (segment.slots ?? []).map(slotDraft),
  }
}

/** 从一份 wire 视图播种可编辑状态。**不补任何段**：没有价就是没有价——
 *  没有价段覆盖的日期按 ¥0 计（并列为价格未知），要给它价就自己加一段。 */
export function draftFromView(view: PricingView): PriceState {
  const draft: PriceDraft = new Map()
  for (const card of view.routes) {
    const models = new Map<string, ModelDraft>()
    for (const row of card.models) {
      models.set(row.model, {
        model: row.model,
        ...(row.name !== undefined ? { name: row.name } : {}),
        records: row.records,
        ...(row.firstAt !== undefined ? { firstAt: row.firstAt } : {}),
        ...(row.lastAt !== undefined ? { lastAt: row.lastAt } : {}),
        ...(row.unpriced !== undefined ? { unpriced: row.unpriced } : {}),
        segments: row.segments.map(segmentDraft),
      })
    }
    draft.set(card.route, {
      route: card.route,
      label: card.label,
      billing: card.billing,
      records: card.records,
      models,
    })
  }
  const calendar: CalendarEntries = new Map()
  // 视图里的年历是合并过的区间（host 写的），所以这里的文本与文件逐字一致——
  // 刚播种的草稿不会因为「两段相邻的假期该不该并」而看起来像被编辑过。
  for (const [year, ranges] of Object.entries(view.calendar ?? {})) {
    calendar.set(year, { year, text: ranges.map(holidayRangeText).join('\n') })
  }
  return { routes: draft, calendar, holidays: holidaysOf(calendar) }
}

// ---------------------------------------------------------------------------
// 行的阅读顺序
// ---------------------------------------------------------------------------

/** `from` 的效力排名：`''`（最早一段）排第一，非真实时刻的文本排最后，半输入的日期永远不会跳到顶部。 */
function forceRank(from: string): number {
  const at = instantOf(from)
  return at === null ? Number.MAX_SAFE_INTEGER : at
}

function forceOrder(segments: readonly SegmentDraft[]): SegmentDraft[] {
  return [...segments].sort((left, right) => forceRank(left.from) - forceRank(right.from))
}

/** 一行的全部段，按效力顺序（含草稿）——抽屉渲染的顺序。 */
export function sortedSegments(model: ModelDraft): SegmentDraft[] {
  return forceOrder(model.segments)
}

/** 一行的有价段，按效力顺序。 */
function pricedSegments(model: ModelDraft): SegmentDraft[] {
  return forceOrder(effectiveSegments(model))
}

/** `nowMs` 时生效的段——行头显示的当前价。空白草稿被跳过：它们不定价。 */
export function segmentInForce(model: ModelDraft, nowMs: number = Date.now()): SegmentDraft | null {
  let hit: SegmentDraft | null = null
  for (const segment of pricedSegments(model)) {
    const at = instantOf(segment.from)
    if (at === null) continue
    if (at > nowMs) break
    hit = segment
  }
  return hit
}

/** 一行是否完全没有价（其记录计 ¥0）。 */
export function isUnpriced(model: ModelDraft): boolean {
  return effectiveSegments(model).length === 0
}

/** 「价格未知」的判定：整行没有价，或有账本记录早于最早的一段有价段——那些记录按 ¥0 计。
 *  账本透镜另有一份权威计数（host 的 `unpriced`）；这里按草稿算，改价后当场跟手。 */
export function priceUnknown(model: ModelDraft): boolean {
  const first = pricedSegments(model)[0]
  if (first === undefined) return true
  const at = instantOf(first.from)
  return model.firstAt !== undefined && (at === null || at > model.firstAt)
}

/** 一个段的四个 ¥/M 桶，作为行的固定列。 */
export type RateField = keyof RateTexts

/** 此刻在计费的价：生效段的基准价，叠上此刻生效的峰谷时段。 */
export interface InForceRates {
  /** 此刻在生效的那一段——行内四个数字与抽屉里的「当前生效」都指它。 */
  segment: SegmentDraft
  /** 该段里此刻生效的峰谷时段；null = 按基准价。 */
  slot: SlotDraft | null
  /** 四档的展示值：时段重述过的档用它自己的，留空的档沿用基准价。 */
  values: RateTexts
}

/** 段里此刻生效的峰谷时段（按时刻自身的本地星期、日期与小时）；null = 基准价。
 *  `holidays` 决定 `workdays` 时段在法定节假日那天不生效。 */
function activeSlot(segment: SegmentDraft, nowMs: number, holidays: ReadonlySet<string>): SlotDraft | null {
  for (const slot of effectiveSlots(segment)) {
    const { start, end } = slotRange(slot)
    if (isHourRange({ start, end }) && slotCovers({ days: slot.days, start, end }, nowMs, holidays)) return slot
  }
  return null
}

/** 行内四个数字读的东西：此刻计费所用的价——宿主 `ratesOfSegment` 的同一条规则。
 *  没有一段在生效时为 null = 这一刻价格未知。 */
export function ratesInForce(
  model: ModelDraft,
  holidays: ReadonlySet<string>,
  nowMs: number = Date.now(),
): InForceRates | null {
  const segment = segmentInForce(model, nowMs)
  if (segment === null) return null
  const slot = activeSlot(segment, nowMs, holidays)
  if (slot === null) return { segment, slot: null, values: inheritedRates(segment) }
  const inherit = (field: RateField): string => {
    const own = slot[field].trim()
    return own === '' ? segment[field] : own
  }
  return {
    segment,
    slot,
    values: {
      input: inherit('input'),
      output: inherit('output'),
      cacheRead: inherit('cacheRead'),
      cacheWrite: inherit('cacheWrite'),
    },
  }
}

/** 段的有效时刻（epoch ms），日期不是真实时刻时为 null。轴用它放这一段的节点。 */
export function segmentInstant(segment: SegmentDraft): number | null {
  return instantOf(segment.from)
}

/** 一个单元格的读数状态：`ok`（数字）、`empty`（尚未填）、`bad`（已输入但不是非负数字）。 */
export type FieldState = 'ok' | 'empty' | 'bad'

/** 一个单元格的状态，使行能标出确切出错的字段。 */
export function fieldState(holder: RateTexts | null, field: RateField): FieldState {
  if (holder === null) return 'empty'
  const raw = holder[field].trim()
  if (raw === '') return 'empty'
  return parseRate(raw) === null ? 'bad' : 'ok'
}

/** 一个段的基准价，作为峰谷时段显示的继承 placeholder。 */
export function inheritedRates(segment: SegmentDraft): RateTexts {
  return {
    input: segment.input,
    output: segment.output,
    cacheRead: segment.cacheRead,
    cacheWrite: segment.cacheWrite,
  }
}

/** 一个空单元格显示的鬼影与它的解释；`value` 缺省即这一档确实没有可沿用的数（`—` = 还没填）。 */
export interface InheritedCell {
  value?: string
  note?: string
}

/** 一个空单元格显示的那个数，以及悬停时对它的解释。
 *
 *  全表只有一条规则：**格子里出现数字 = 留空沿用它；`—` = 还没填**。于是
 *  - 峰谷时段的每一档留空 → 沿用基准价；
 *  - 缓存读 / 缓存写没有单独定价时按**输入价**计（宿主 `costOf` 的同一条规则），所以
 *    这两档的终点是生效的输入价——基准价那一行的这两格因此也报得出一个数，而不是「没有值」；
 *  - 输入 / 输出必填，基准价那一行的这两格空着只是还没填（`—`），行本来就写不出去。 */
export function inheritedCell(segment: SegmentDraft, slot: SlotDraft | null, field: RateField): InheritedCell {
  // 更宽作用域里这一档自己的值。基准价那一行没有更宽的作用域，所以恒为空。
  const wider = slot === null ? '' : segment[field].trim()
  if (wider !== '') return { value: wider, note: `留空 = 沿用基准价 ${wider}` }
  if (field === 'input' || field === 'output') {
    return slot === null ? {} : { note: '留空 = 沿用基准价（基准价这档也是空的）' }
  }
  // 终点是**生效的**输入价：时段自己重述过就用它自己的。
  const own = slot === null ? '' : slot.input.trim()
  const input = own !== '' ? own : segment.input.trim()
  if (input === '') return { note: '留空 = 按输入价计（输入价还没填）' }
  return { value: input, note: `留空 = 按输入价计 ${input}：这一档没有单独定价` }
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
  const input = parseRate(holder.input)
  const output = parseRate(holder.output)
  if (input === null || output === null) return null
  const cacheRead = parseRate(holder.cacheRead)
  const cacheWrite = parseRate(holder.cacheWrite)
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
    const parsed = parseRate(raw)
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

/** 一个时段的覆盖读法：`工作日 09:00–12:00`。 */
export function dayLabel(slot: SlotDraft): string {
  return `${DAY_SET_LABELS[slot.days]} ${rangeLabel(slotRange(slot))}`
}

/** 阻止这一行写入文件的唯一问题，可写时为 null：显示在行自身字段旁。未完成的草稿不是问题——它们只是不写出去。 */
export function rowIssue(model: ModelDraft): string | null {
  const seen = new Set<number>()
  for (const segment of pricedSegments(model)) {
    const text = segment.from.trim()
    const at = instantOf(text)
    if (at === null) return `生效时间「${text}」不是 YYYY-MM-DD 或整点 YYYY-MM-DDTHH:00（一段价必须有生效时刻）`
    if (seen.has(at)) {
      return `有两段价都从 ${instantKey(at)} 起生效`
    }
    seen.add(at)
    const rates = rateIssue(segment, '')
    if (rates !== null) return rates
    for (let index = 0; index < segment.slots.length; index += 1) {
      const slot = segment.slots[index]!
      if (isBlankSlot(slot)) continue
      const problem = slotIssue(slot, segment.slots, index)
      if (problem !== null) return problem
    }
  }
  return null
}

function parseRate(value: string): number | null {
  const raw = value.trim()
  if (raw === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

// ---------------------------------------------------------------------------
// 签名与 wire body
// ---------------------------------------------------------------------------

/** 一个段保存时会写成的样子，草稿被排除。填了却写不出去的档（四档里任一格非法）
 *  以 `null` 参与签名——那一格正红着，这一行就还没「与磁盘一致」。 */
function segmentSignature(segment: SegmentDraft): Record<string, unknown> {
  const rates = ratesOf(segment)
  return {
    // 生效时刻空着时这一行本来就写不出去（`composePriceBody` 会拒），签名照实记空串，
    // 于是它一定与磁盘上的基线不同——那一行保持脏。
    from: segment.from.trim(),
    rates: rates === null || badRateField(segment) !== null ? null : rates,
    slots: effectiveSlots(segment).map((slot) => {
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

/** 一个模型行的签名：保存时会为它写入的确切内容，tab 据此区分已编辑行与干净行。未完成的草稿块不在其中。 */
export function modelSignature(model: ModelDraft): string {
  return JSON.stringify(pricedSegments(model).map(segmentSignature))
}

/** 一张卡行的组合键。 */
export function rowKey(route: string, model: string): string {
  return `${route}\u0000${model}`
}

/** 段的 `from` 作为 `datetime-local` 输入值：零点打印为 `00:00`，因为纯日期就是这个意思。 */
export function fromFieldValue(from: string): string {
  const text = from.trim()
  if (text === '') return ''
  return text.includes('T') ? text : `${text}T00:00`
}

/** `datetime-local` 值所代表的草稿 `from`：零点保留短日期形式（文件保持原样），分钟被丢弃——价表按整点解析价格。 */
function fromFieldInput(value: string): string {
  const text = value.trim()
  const [day, time] = text.split('T')
  if (day === undefined || day === '' || time === undefined) return day ?? ''
  const hour = time.slice(0, 2)
  return hour === '00' ? day : `${day}T${hour}:00`
}

/** 改一段的生效时刻。清空输入不落地：**一段价必须有生效时刻**，日期空着的段写不出去
 *  （也没有「无起点」那张卡可以退回去）。 */
export function withSegmentFrom(segment: SegmentDraft, value: string): SegmentDraft {
  const next = fromFieldInput(value)
  return next === '' ? segment : { ...segment, from: next }
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

/** 一个 keys 层面的写入障碍，或 null：host 的写路径只接受非空的、不以 `$` 开头
 *  （保留键前缀）、且不超长的 route / model 串。长度上限与保留键同源于
 *  `price-format.ts`，所以草稿这一侧报得出位置与原因，而不是整份文件被拒。 */
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
    const models: Record<string, unknown[]> = {}
    for (const [model, row] of card.models) {
      const priced = pricedSegments(row)
      // 只有真会写出去的行才受键规则约束：没价的 route / model 不进 body，也就不该挡住这一笔。
      if (priced.length === 0) continue
      const modelProblem = modelIssue(model)
      if (modelProblem !== null) return { ok: false, error: `「${route}」的${modelProblem}` }
      const where = `「${route}」的「${model}」`
      const segments: Record<string, unknown>[] = []
      const seen = new Set<number>()
      for (const segment of priced) {
        const at = instantOf(segment.from)
        if (at === null) {
          return { ok: false, error: `${where}的生效时间必须是 YYYY-MM-DD 或整点 YYYY-MM-DDTHH:00（当前「${segment.from.trim()}」）` }
        }
        if (seen.has(at)) {
          return { ok: false, error: `${where}有两段价填了同一个生效时间（${instantKey(at)}）` }
        }
        seen.add(at)
        const rates = ratesOf(segment)
        if (rates === null) return { ok: false, error: `${where}的输入价 / 输出价必须是非负数字` }
        // 可选档填了却不是数字：与 `rowIssue` 同一把尺子挡住这一笔，不静默丢掉那一档
        // （否则草稿里那格红着、工具栏却说「已保存」）。
        const badRate = badRateField(segment)
        if (badRate !== null) return { ok: false, error: `${where}的${badRate}` }
        const out: Record<string, unknown> = {}
        out.from = instantKey(at)
        for (const [draftKey, wireKey] of RATE_FIELD_NAMES) {
          const value = rates[draftKey]
          if (value !== undefined) out[wireKey] = value
        }
        const slots = effectiveSlots(segment)
        if (slots.length > 0) {
          for (let index = 0; index < segment.slots.length; index += 1) {
            const slot = segment.slots[index]!
            if (isBlankSlot(slot)) continue
            const problem = slotIssue(slot, segment.slots, index)
            if (problem !== null) return { ok: false, error: `${where}的${problem}` }
          }
          out.slots = [...slots]
            .sort((left, right) =>
              hourValue(left.start) - hourValue(right.start)
              || DAY_SETS.indexOf(left.days) - DAY_SETS.indexOf(right.days))
            .map(slotBody)
        }
        segments.push(out)
      }
      models[model] = segments
    }
    if (Object.keys(models).length > 0) {
      const routeProblem = routeIssue(route)
      if (routeProblem !== null) return { ok: false, error: routeProblem }
      body[route] = models
    }
  }
  if (Object.keys(billing).length > 0) body[PRICING_BILLING_KEY] = billing
  // 年历与计费性质同处保留键前缀之下，写在 route 之前（与宿主 writer 同一顺序）。
  const calendar = composeCalendar(state.calendar)
  if (!calendar.ok) return { ok: false, error: calendar.error }
  if (Object.keys(calendar.calendar).length > 0) body[PRICING_CALENDAR_KEY] = calendar.calendar
  return { ok: true, body }
}

/** 一次性写入的基线：每个 route 的计费性质、每一行的签名，以及年历签名。 */
export interface PriceBaseline {
  models: Map<string, string>
  billing: Map<string, BillingNature>
  calendar: string
}

/** 一份视图的基线：行签名变了即 dirty。取自视图播种的同一草稿，故首记锚定等规则绝不会让刚播种的行看起来像被编辑过。 */
export function baselinesOf(view: PricingView): PriceBaseline {
  return baselineOfDraft(draftFromView(view))
}

/** 一次成功保存为草稿建立的基线：就是它自己的签名，本地草稿保持为唯一真源，tab 不必重新播种（那会 remount 正在输入的输入框）。 */
export function baselineOfDraft(state: PriceState): PriceBaseline {
  const models = new Map<string, string>()
  const billing = new Map<string, BillingNature>()
  for (const [route, card] of state.routes) {
    billing.set(route, card.billing)
    for (const [model, row] of card.models) {
      models.set(rowKey(route, model), modelSignature(row))
    }
  }
  return { models, billing, calendar: calendarSignature(state.calendar) }
}

/** 与基线不同的行数（以及 route 计费开关数、年历一处）。 */
export function stagedChanges(state: PriceState, baseline: PriceBaseline): number {
  let count = 0
  for (const [route, card] of state.routes) {
    if ((baseline.billing.get(route) ?? 'metered') !== card.billing) count += 1
    for (const [model, row] of card.models) {
      if (modelDirty(route, row, baseline.models)) count += 1
    }
  }
  // 年历整体算一处：它是一份数据，不是逐行编辑。
  if (calendarSignature(state.calendar) !== baseline.calendar) count += 1
  return count
}

/** 年历是否与磁盘不同（面板据此给它自己的状态标记）。 */
export function calendarDirty(state: PriceState, baseline: PriceBaseline): boolean {
  return calendarSignature(state.calendar) !== baseline.calendar
}

/** 一个模型行是否与基线不同。 */
export function modelDirty(route: string, row: ModelDraft, baseline: ReadonlyMap<string, string>): boolean {
  return (baseline.get(rowKey(route, row.model)) ?? '') !== modelSignature(row)
}

// ---------------------------------------------------------------------------
// 下拉选项的文字
// ---------------------------------------------------------------------------

/**
 * 通道下拉里一项写什么。
 *
 * 两个下拉取代平铺之后，**选项文字自己就是这一屏唯一的摘要面**——它必须回答「这条通道有没有
 * 洞」，否则读者只能一条条点开看（那正是这一版要消灭的成本）。全 0 的那一半不复述 0：选项
 * 列是扫读面，负号（`N 个模型未知`）比 `0 个模型未知` 短一截、也更快认出来。
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

