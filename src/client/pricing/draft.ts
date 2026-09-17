/**
 * 价格表 tab 的纯逻辑：草稿、脏标记签名、保存 wire body。
 *
 * 三条规则让探索不被惩罚：空白段/时段是草稿不写出去；峰谷时段可只重写任意子集，
 * 空着的档继承全天价；**托底价**（没有生效时刻的那一段）永远在场，没被调价史覆盖
 * 的时间都按它算。时间轴规则与宿主共用 `price-format.ts`。刻意无 React——tab 可
 * 测试的那一半。
 *
 * @module dsh-tokbook/client/pricing/draft
 */

// 价文件的共享词表（保留键、备注长度上限）从共享内核取——client 不能 import
// `src/pricing.ts`（它拉了 `node:fs`），两条字面量各写一遍就会静默漂移。
import {
  DAY_SETS, DAY_SET_LABELS, EARLIEST, MAX_NOTE_LENGTH, PRICING_BILLING_KEY, instantKey, instantMs, isHourRange, rangeLabel,
  slotCovers, slotsOverlap,
} from '../../price-format.ts'
import type { BillingNature, DaySet, ModelPricing, PricingSegmentInput, PricingSlotInput, PricingView } from '../../types.ts'

/** 一份价格的四个 ¥/M 桶，数字形式，键与草稿字段一致（未填写时桶缺席）。 */
export interface DraftRates {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

/** 峰谷时段的四个桶，各自可选：时段留空的桶沿用段的全天价。 */
export type SlotRates = Partial<DraftRates>

/** 草稿 rate 字段 → 写成 wire/文件的字段名。 */
export const RATE_FIELD_NAMES: ReadonlyArray<readonly [keyof DraftRates, keyof ModelPricing]> = [
  ['input', 'inputPerMillion'],
  ['output', 'outputPerMillion'],
  ['cacheRead', 'cacheReadPerMillion'],
  ['cacheWrite', 'cacheWritePerMillion'],
]

/** 一份可编辑价格的四个 ¥/M 输入——段的全天价或其中一个峰谷时段。字符串使半输入的数字存活。 */
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

/** 一个可编辑峰谷时段：覆盖的小时与星期，以及自己的 rate 输入。 */
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
  /** 叠在全天价上的峰谷时段；空 = 仅全天价。 */
  slots: SlotDraft[]
  note: string
}

/** 一张 route 卡的可编辑模型行。 */
export interface ModelDraft {
  model: string
  /** settings / 适配器目录给出的展示名；无人命名该串时省略。 */
  name?: string
  /** settings / 适配器目录是否列出该串。 */
  configured: boolean
  /** 账本记录了该 (route, model) 的次数。 */
  records: number
  /** 账本首/末计费时刻，以及多少条记录没有价格段覆盖（¥0）——wire 上的
   *  只读事实，都不参与保存。省略 = 读不到账本透镜，**不等于**零。 */
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

/** 草稿 `from` 所指的有效时刻：`''` = 最早一段（0），非真实时刻的文本 = null。 */
function instantOf(from: string): number | null {
  const text = from.trim()
  if (text === '') return EARLIEST
  return instantMs(text)
}

/** 小时输入的数字；非整点文本时为 NaN。 */
function hourValue(text: string): number {
  const raw = text.trim()
  return /^\d{1,2}$/u.test(raw) ? Number(raw) : Number.NaN
}

/** 一个时段的小时，转成共享规则与标签接受的区间（非整点文本时 NaN；
 *  校验会报错，这里只喂展示和重叠检查）。 */
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

/** 一个段是否还没有价（时段和备注也为空）。 */
export function isBlankSegment(segment: SegmentDraft): boolean {
  return isBlankRates(segment) && segment.note.trim() === '' && segment.slots.every(isBlankSlot)
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
    note: seed.note ?? '',
  }
}

/** 一个新的峰谷时段：09:00–12:00 每天（峰谷窗口的起始形状），尚无费率——
 *  留空的桶继承全天价。 */
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

/** 托底价那一张：没有生效时刻的一段（文件里省略 `from`，即自始生效）。它不是一次调价。 */
export function isFloorSegment(segment: SegmentDraft): boolean {
  return segment.from.trim() === ''
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
    note: segment.note ?? '',
  }
}

/** 从一份 wire 视图播种可编辑草稿。托底价那一张**永远在场**：文件里没有无日期段时补一张空卡，
 *  使每一行都有「其它时间按它算」的那一张；空卡在被填之前不进签名、不进请求体。 */
export function draftFromView(view: PricingView): PriceDraft {
  const draft: PriceDraft = new Map()
  for (const card of view.routes) {
    const models = new Map<string, ModelDraft>()
    for (const row of card.models) {
      const segments = row.segments.map(segmentDraft)
      models.set(row.model, {
        model: row.model,
        ...(row.name !== undefined ? { name: row.name } : {}),
        configured: row.configured,
        records: row.records,
        ...(row.firstAt !== undefined ? { firstAt: row.firstAt } : {}),
        ...(row.lastAt !== undefined ? { lastAt: row.lastAt } : {}),
        ...(row.unpriced !== undefined ? { unpriced: row.unpriced } : {}),
        segments: segments.some(isFloorSegment) ? segments : [newSegment({ from: '' }), ...segments],
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
  return draft
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

/** 行是不是「价格未知」：整行没有价，或有账本记录早于最早的一段有价段——那些记录按 ¥0 计。
 *  托底价在场即覆盖自始至今，所以这条判定等价于「没有托底价，且第一段调价晚于首记」。
 *  账本透镜另有一份权威计数（host 的 `unpriced`）；这里按草稿算，改价后当场跟手。 */
export function priceUnknown(model: ModelDraft): boolean {
  const first = pricedSegments(model)[0]
  if (first === undefined) return true
  const at = instantOf(first.from)
  return model.firstAt !== undefined && (at === null || at > model.firstAt)
}

/** 一个段的四个 ¥/M 桶，作为行的固定列。 */
export type RateField = keyof RateTexts

/** 此刻在计费的价：生效段的全天价，叠上此刻生效的峰谷时段。 */
export interface InForceRates {
  /** 此刻在生效的那一段——行内四个数字与抽屉里的「当前生效」都指它。 */
  segment: SegmentDraft
  /** 该段里此刻生效的峰谷时段；null = 按全天价。 */
  slot: SlotDraft | null
  /** 四档的展示值：时段重述过的档用它自己的，留空的档沿用全天价。 */
  values: RateTexts
}

/** 段里此刻生效的峰谷时段（按时刻自身的本地星期与小时）；null = 全天价。 */
function activeSlot(segment: SegmentDraft, nowMs: number): SlotDraft | null {
  for (const slot of effectiveSlots(segment)) {
    const { start, end } = slotRange(slot)
    if (isHourRange({ start, end }) && slotCovers({ days: slot.days, start, end }, nowMs)) return slot
  }
  return null
}

/** 行内四个数字读的东西：此刻计费所用的价——宿主 `ratesOfSegment` 的同一条规则（生效段叠上生效时段，
 *  时段留空的档沿用全天价）。没有一段在生效时为 null = 这一刻价格未知。 */
export function ratesInForce(model: ModelDraft, nowMs: number = Date.now()): InForceRates | null {
  const segment = segmentInForce(model, nowMs)
  if (segment === null) return null
  const slot = activeSlot(segment, nowMs)
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

/** 段的有效时刻（epoch ms；`0` = 无起点），日期不是真实时刻时为 null。轴用它把边界放在左端**上**或**外**。 */
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

/** 一个段的全天价，作为峰谷时段显示的继承 placeholder。 */
export function inheritedRates(segment: SegmentDraft): RateTexts {
  return {
    input: segment.input,
    output: segment.output,
    cacheRead: segment.cacheRead,
    cacheWrite: segment.cacheWrite,
  }
}

// ---------------------------------------------------------------------------
// 有效性
// ---------------------------------------------------------------------------

/** 一份全天价的首个问题，或 null：输入价与输出价必填，cache 桶可选，每个已填单元格须为非负数字。 */
function rateIssue(holder: RateTexts, prefix: string): string | null {
  for (const [field, label] of [['input', '输入价'], ['output', '输出价']] as const) {
    const state = fieldState(holder, field)
    if (state === 'bad') return `${prefix}${label}「${holder[field].trim()}」不是有效的非负数字`
    if (state === 'empty') return `${prefix}${label}还空着`
  }
  for (const [field, label] of [['cacheRead', '缓存读价'], ['cacheWrite', '缓存写价']] as const) {
    if (fieldState(holder, field) === 'bad') return `${prefix}${label}「${holder[field].trim()}」不是有效的非负数字`
  }
  return null
}

/** 一份草稿价格的 ¥/M 数字（段的全天价），必填字段尚非非负数字时为 null（cache 桶可选）。 */
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

/** 一个峰谷时段重写的桶，或首个非数字值。可以只重写任意子集：留空的桶继承段的全天价。 */
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
    if (at === null) return `生效时间「${text}」不是 YYYY-MM-DD 或整点 YYYY-MM-DDTHH:00`
    if (seen.has(at)) {
      return at === EARLIEST ? '有两段价都填了「无起点」' : `有两段价都从 ${instantKey(at)} 起生效`
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
    if (segment.note.trim().length > MAX_NOTE_LENGTH) return `备注超过 ${String(MAX_NOTE_LENGTH)} 字`
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

/** 一个段保存时会写成的样子，草稿被排除。 */
function segmentSignature(segment: SegmentDraft): Record<string, unknown> {
  return {
    from: segment.from.trim() === '' ? null : segment.from.trim(),
    rates: ratesOf(segment),
    slots: effectiveSlots(segment).map((slot) => {
      const rates = slotRates(slot)
      return {
        days: slot.days,
        start: hourValue(slot.start),
        end: hourValue(slot.end),
        rates: rates.ok ? rates.rates : null,
      }
    }),
    note: segment.note.trim(),
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

/** `from` 所指的可读时刻，最早一段为 null——省略了生效时刻的段，即对每个时刻都生效过的段。 */
function instantLabel(from: string): string | null {
  const text = from.trim()
  return text === '' ? null : text.replace('T', ' ')
}

/** 段的有效时刻在调价史抽屉中的读法。无日期的段不是「列表里最早的那个」——它有开放的左端，无起点是说出这一点最短的方式。 */
export function fmtFrom(from: string): string {
  const at = instantLabel(from)
  return at === null ? '无起点' : `${at} 起`
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

/** 改一段的生效时刻。清空输入不落地：一次调价必须有生效时刻，而「无起点」那一张是托底价——
 *  它不是「把日期删掉」能变成的东西（否则一行会拿到两张托底价，写出去必被拒绝）。 */
export function withSegmentFrom(segment: SegmentDraft, value: string): SegmentDraft {
  const next = fromFieldInput(value)
  return next === '' ? segment : { ...segment, from: next }
}

/** 一个峰谷时段保存时写入的内容：它重写的桶，其余省略使全天价继续生效。 */
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

/** 一次保存发送的 body：**完整的**目标文件。拒绝时给出首个问题的确切位置，与宿主自身解析的报错方式一致。 */
export function composePriceBody(draft: PriceDraft): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  const body: Record<string, unknown> = {}
  const billing: Record<string, BillingNature> = {}
  for (const [route, card] of draft) {
    if (card.billing !== 'metered') billing[route] = card.billing
    const models: Record<string, unknown[]> = {}
    for (const [model, row] of card.models) {
      const priced = pricedSegments(row)
      if (priced.length === 0) continue
      const where = `「${route}」的「${model}」`
      const segments: Record<string, unknown>[] = []
      const seen = new Set<number>()
      for (const segment of priced) {
        const at = instantOf(segment.from)
        if (at === null) {
          return { ok: false, error: `${where}的生效时间必须是 YYYY-MM-DD 或整点 YYYY-MM-DDTHH:00（当前「${segment.from.trim()}」）` }
        }
        if (seen.has(at)) {
          return { ok: false, error: `${where}有两段价填了同一个生效时间（${at === EARLIEST ? '无起点' : instantKey(at)}）` }
        }
        seen.add(at)
        const rates = ratesOf(segment)
        if (rates === null) return { ok: false, error: `${where}的输入价 / 输出价必须是非负数字` }
        const out: Record<string, unknown> = {}
        if (at !== EARLIEST) out.from = instantKey(at)
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
        const note = segment.note.trim()
        if (note.length > MAX_NOTE_LENGTH) {
          return { ok: false, error: `${where}的备注超过 ${String(MAX_NOTE_LENGTH)} 字` }
        }
        if (note !== '') out.note = note
        segments.push(out)
      }
      models[model] = segments
    }
    if (Object.keys(models).length > 0) body[route] = models
  }
  if (Object.keys(billing).length > 0) body[PRICING_BILLING_KEY] = billing
  return { ok: true, body }
}

/** 一份视图的行级与 route 级基线：行签名变了即 dirty。取自视图播种的同一草稿，故首记锚定等规则绝不会让刚播种的行看起来像被编辑过。 */
export function baselinesOf(view: PricingView): { models: Map<string, string>; billing: Map<string, BillingNature> } {
  return baselineOfDraft(draftFromView(view))
}

/** 一次成功保存为草稿建立的基线：就是它自己的签名，本地草稿保持为唯一真源，tab 不必重新播种（那会 remount 正在输入的输入框）。 */
export function baselineOfDraft(draft: PriceDraft): { models: Map<string, string>; billing: Map<string, BillingNature> } {
  const models = new Map<string, string>()
  const billing = new Map<string, BillingNature>()
  for (const [route, card] of draft) {
    billing.set(route, card.billing)
    for (const [model, row] of card.models) {
      models.set(rowKey(route, model), modelSignature(row))
    }
  }
  return { models, billing }
}

/** 与基线不同的行数（以及 route 计费开关数）。 */
export function stagedChanges(
  draft: PriceDraft,
  baseline: { models: ReadonlyMap<string, string>; billing: ReadonlyMap<string, BillingNature> },
): number {
  let count = 0
  for (const [route, card] of draft) {
    if ((baseline.billing.get(route) ?? 'metered') !== card.billing) count += 1
    for (const [model, row] of card.models) {
      if (modelDirty(route, row, baseline.models)) count += 1
    }
  }
  return count
}

/** 一个模型行是否与基线不同。 */
export function modelDirty(route: string, row: ModelDraft, baseline: ReadonlyMap<string, string>): boolean {
  return (baseline.get(rowKey(route, row.model)) ?? '') !== modelSignature(row)
}
