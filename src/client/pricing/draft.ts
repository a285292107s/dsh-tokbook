/**
 * Pure logic of the 价格表 tab: the editable draft of one price file, its
 * signature (for the unsaved-changes marks) and the wire body one save sends.
 *
 * A draft mirrors the file the host owns: route → model string → price
 * segments, each segment carrying its whole-day price plus the 峰谷时段 that
 * override it, with every number held as a STRING so a half-typed value
 * survives a keystroke. Composing the body validates it and refuses with the
 * offending location, so the host's strict parse only ever sees a good table.
 *
 * Two rules keep the tab from punishing the user for exploring:
 *   · a BLANK segment or slot is a draft, not an error — it is dropped on the
 *     way out and takes no part in validity, the dirty mark or the save, so
 *     "＋ 加一段" can never be the reason a write stops;
 *   · a 峰谷时段 may restate any subset of the four rates, so what a slot
 *     leaves empty inherits the whole-day rate of its segment — and the cell
 *     shows that inherited number as its placeholder, so nothing is invisible.
 *
 * The time axis itself (instants, hours, day sets, the overlap rule) comes from
 * `../../price-format.ts` — the very module the host writer uses, so the two
 * halves can never drift into "the draft accepted it, the write refused it".
 *
 * Deliberately React-free: this module is the testable half of the tab.
 *
 * @module dsh-tokbook/client/pricing/draft
 */

import {
  DAY_SETS, DAY_SET_LABELS, EARLIEST, instantKey, instantMs, isHourRange, rangeLabel, slotsOverlap,
} from '../../price-format.ts'
import type { BillingNature, DaySet, ModelPricing, PricingSegmentInput, PricingSlotInput, PricingView } from '../../types.ts'

/** The file's one reserved top-level key. Mirrors `src/pricing.ts`; the client
 *  cannot import that module (it pulls in `node:fs`). */
export const BILLING_KEY = '$billing'

const MAX_NOTE_LENGTH = 120

/** The four ¥/M buckets of one price, as numbers, keyed like the draft fields
 *  (a bucket stays absent while it is not written). */
export interface DraftRates {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

/** The four buckets of a 峰谷时段, each optional: a bucket the slot leaves
 *  empty keeps the whole-day rate of its segment. */
export type SlotRates = Partial<DraftRates>

/** Draft rate field → the wire/file field it is written as. */
export const RATE_FIELD_NAMES: ReadonlyArray<readonly [keyof DraftRates, keyof ModelPricing]> = [
  ['input', 'inputPerMillion'],
  ['output', 'outputPerMillion'],
  ['cacheRead', 'cacheReadPerMillion'],
  ['cacheWrite', 'cacheWritePerMillion'],
]

/** The four ¥/M inputs of one editable price — a segment's whole-day price, or
 *  one of its 峰谷时段. Strings, so a half-typed number survives. */
export interface RateTexts {
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

/** The four buckets, in the order every surface writes them, with the label a
 *  validation message names them by. */
const RATE_INPUTS: ReadonlyArray<readonly [keyof RateTexts, string]> = [
  ['input', '输入价'],
  ['output', '输出价'],
  ['cacheRead', '缓存读价'],
  ['cacheWrite', '缓存写价'],
]

/** One editable 峰谷时段: the hours and days it covers and its own rate
 *  inputs. */
export interface SlotDraft extends RateTexts {
  /** Local React key; stable across edits so inputs do not lose focus. */
  id: number
  days: DaySet
  /** Start hour, text (`0`–`23`). */
  start: string
  /** End hour, text, exclusive (`1`–`24`; `24` closes the day). */
  end: string
}

/** One editable price segment. `from` is `''` for 最早一段, else `YYYY-MM-DD`
 *  (midnight) or `YYYY-MM-DDTHH:00`. */
export interface SegmentDraft extends RateTexts {
  /** Local React key; stable across edits so inputs do not lose focus. */
  id: number
  from: string
  /** 峰谷时段 layered over the whole-day price; empty = one price for the
   *  whole day. */
  slots: SlotDraft[]
  note: string
}

/** One editable model row of a route card. */
export interface ModelDraft {
  model: string
  /** Human-readable name from settings / the adapter catalog; absent when
   *  nothing names this string, and then the exact string is the label. */
  name?: string
  /** Settings / the adapter catalog lists this string for the route. */
  configured: boolean
  /** Ledger records naming this (route, model). */
  records: number
  /** When the ledger first and last billed this row, and how many of its records
   *  no price segment covers (¥0) — read-only facts off the wire, none of which
   *  is part of a save. Absent = the ledger lens could not be read, which is not
   *  the same as zero. */
  firstAt?: number
  lastAt?: number
  unpriced?: number
  segments: SegmentDraft[]
}

/** One editable route card. */
export interface RouteDraft {
  route: string
  label: string
  billing: BillingNature
  records: number
  models: Map<string, ModelDraft>
}

/** The whole draft, keyed by route key. */
export type PriceDraft = Map<string, RouteDraft>

let nextId = 1

function takeId(): number {
  const id = nextId
  nextId += 1
  return id
}

/** The local `YYYY-MM-DD` of today. */
export function todayKey(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${String(now.getFullYear())}-${month}-${day}`
}

/** The effective instant a draft `from` names: `''` = 最早一段 (0), a text that
 *  is not a real instant = null. */
function instantOf(from: string): number | null {
  const text = from.trim()
  if (text === '') return EARLIEST
  return instantMs(text)
}

/** An hour input's number; NaN when it is not a whole-hour text. */
function hourValue(text: string): number {
  const raw = text.trim()
  return /^\d{1,2}$/u.test(raw) ? Number(raw) : Number.NaN
}

/** One slot's hours as the range the shared rules and labels take (NaN when a
 *  text is not a whole hour; validation reports that, this only feeds display
 *  and the overlap check). */
export function slotRange(slot: SlotDraft): { start: number; end: number } {
  return { start: hourValue(slot.start), end: hourValue(slot.end) }
}

// ---------------------------------------------------------------------------
// Drafts vs prices
// ---------------------------------------------------------------------------

/** Whether a four-rate group has nothing typed into it at all. Such a block is
 *  an unfinished draft: it takes no part in validity, the signature or the
 *  write, so clicking 「＋ 加一段价」 can never dirty a row or block a save. */
export function isBlankRates(holder: RateTexts): boolean {
  return RATE_INPUTS.every(([field]) => holder[field].trim() === '')
}

/** Whether one 峰谷时段 carries no price yet. */
export function isBlankSlot(slot: SlotDraft): boolean {
  return isBlankRates(slot)
}

/** Whether one segment carries no price yet (its slots and note are empty too). */
export function isBlankSegment(segment: SegmentDraft): boolean {
  return isBlankRates(segment) && segment.note.trim() === '' && segment.slots.every(isBlankSlot)
}

/** The slots of one segment that actually carry a price. */
export function effectiveSlots(segment: SegmentDraft): SlotDraft[] {
  return segment.slots.filter(slot => !isBlankSlot(slot))
}

/** The segments of one row that actually carry a price — everything the tab
 *  writes, marks dirty or validates reads from these. */
export function effectiveSegments(model: ModelDraft): SegmentDraft[] {
  return model.segments.filter(segment => !isBlankSegment(segment))
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

/** A segment prefilled from an existing one (or from nothing) and dated today —
 *  the shape 「加一段价」 starts from. */
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

/** A fresh 峰谷时段: 09:00–12:00 每天 (the shape a peak window starts from) and
 *  no rates yet — every bucket it leaves empty inherits the whole-day price. */
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

/** A copy of one 峰谷时段 placed right AFTER it with the same length, so
 *  「复制」 never lands on top of the slot it copies (which would always be a
 *  clash). If there is no room left in the day it goes just BEFORE instead. */
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

/** Move a slot's start hour, keeping the range valid: an end at or before the
 *  new start follows it (a one-hour window), so picking the hours never passes
 *  through a state the row would report as broken. */
export function withSlotStart(slot: SlotDraft, startText: string): SlotDraft {
  const start = hourValue(startText)
  if (!Number.isFinite(start)) return slot
  const end = hourValue(slot.end)
  const nextEnd = Number.isFinite(end) && end > start ? end : Math.min(24, start + 1)
  return { ...slot, start: String(start), end: String(nextEnd) }
}

/** Move a slot's end hour, keeping the range valid (mirror of
 *  {@link withSlotStart}). */
export function withSlotEnd(slot: SlotDraft, endText: string): SlotDraft {
  const end = hourValue(endText)
  if (!Number.isFinite(end)) return slot
  const start = hourValue(slot.start)
  const nextStart = Number.isFinite(start) && start < end ? start : Math.max(0, end - 1)
  return { ...slot, start: String(nextStart), end: String(end) }
}

/** An empty 最早一段 carrying one typed rate — what the first keystroke on an
 *  unpriced row writes. Its missing date does not survive: {@link anchoredRow}
 *  fills it in like every other unwritten one. */
export function blankSegment(field: keyof RateTexts, value: string): SegmentDraft {
  const segment = newSegment({ from: '' })
  segment[field] = value
  return segment
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

/** The instant an unwritten 生效时间 stands for: the local hour this row's FIRST
 *  ledger record falls in (the axis's own 首记, at the file's hourly precision).
 *  `''` leaves the price 无起点 — the row has no record to anchor on, or another
 *  segment already starts at or before that hour: the anchor may never move this
 *  price past a boundary, because the segment ORDER is what decides the price
 *  each record gets. */
function firstAnchor(row: ModelDraft): string {
  if (row.firstAt === undefined) return ''
  for (const segment of row.segments) {
    const from = instantOf(segment.from)
    if (from !== null && from !== EARLIEST && from <= row.firstAt) return ''
  }
  return instantKey(row.firstAt)
}

/** The row with its unwritten effective instant filled in. A price the ledger
 *  already billed is not left 自始生效 by default: 「这条模型从什么时候起按这个价
 *  算」 has an answer — its first record — and a price that starts when the row's
 *  history starts prices exactly the same records as one that starts at the
 *  beginning of time. Only the EARLIEST open segment takes the anchor (two
 *  prices may not start at one instant), and the row comes back unchanged when
 *  there is nothing to fill, so this can run on every change. */
export function anchoredRow(row: ModelDraft): ModelDraft {
  const at = firstAnchor(row)
  if (at === '') return row
  const open = forceOrder(row.segments).find(segment => segment.from.trim() === '')
  if (open === undefined) return row
  return {
    ...row,
    segments: row.segments.map(segment => (segment.id === open.id ? { ...segment, from: at } : segment)),
  }
}

/** Seed an editable draft from one wire view. */
export function draftFromView(view: PricingView): PriceDraft {
  const draft: PriceDraft = new Map()
  for (const card of view.routes) {
    const models = new Map<string, ModelDraft>()
    for (const row of card.models) {
      models.set(row.model, anchoredRow({
        model: row.model,
        ...(row.name !== undefined ? { name: row.name } : {}),
        configured: row.configured,
        records: row.records,
        ...(row.firstAt !== undefined ? { firstAt: row.firstAt } : {}),
        ...(row.lastAt !== undefined ? { lastAt: row.lastAt } : {}),
        ...(row.unpriced !== undefined ? { unpriced: row.unpriced } : {}),
        segments: row.segments.map(segmentDraft),
      }))
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
// Reading order of a row
// ---------------------------------------------------------------------------

/** The force rank of a `from`: `''` (最早一段) ranks first, a text that is not a
 *  real instant ranks last so a half-typed date never jumps to the top. */
function forceRank(from: string): number {
  const at = instantOf(from)
  return at === null ? Number.MAX_SAFE_INTEGER : at
}

function forceOrder(segments: readonly SegmentDraft[]): SegmentDraft[] {
  return [...segments].sort((left, right) => forceRank(left.from) - forceRank(right.from))
}

/** Every segment of one row in force order, drafts included — what the drawer
 *  renders. */
export function sortedSegments(model: ModelDraft): SegmentDraft[] {
  return forceOrder(model.segments)
}

/** The priced segments of one row in force order. */
function pricedSegments(model: ModelDraft): SegmentDraft[] {
  return forceOrder(effectiveSegments(model))
}

/** The segment in force at `nowMs` — what the row header prints as 当前价. Blank
 *  drafts are skipped: they price nothing, so they are never "the current
 *  price". */
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

/** Whether a row carries no price at all (its records bill ¥0). */
export function isUnpriced(model: ModelDraft): boolean {
  return effectiveSegments(model).length === 0
}

/** The four ¥/M buckets of a segment, as the row's fixed columns. */
export type RateField = keyof RateTexts

/** The segment the row's inline cells edit: the one in force, else the earliest
 *  priced one — a price dated in the future is still the one being written. */
export function editableSegment(model: ModelDraft): SegmentDraft | null {
  return segmentInForce(model) ?? pricedSegments(model)[0] ?? null
}

/** The unfinished block the inline cells fill when the row has no price yet:
 *  the latest blank segment already in the drawer, so adding one and then
 *  typing in the row writes into THAT segment rather than creating a second. */
export function pendingSegment(model: ModelDraft): SegmentDraft | null {
  const blanks = forceOrder(model.segments).filter(isBlankSegment)
  return blanks[blanks.length - 1] ?? null
}

/** Whether a segment governs the present (a future-dated one is written but
 *  idle). */
export function inForceToday(segment: SegmentDraft | null, nowMs: number = Date.now()): boolean {
  if (segment === null) return false
  const at = instantOf(segment.from)
  return at !== null && at <= nowMs
}

/** Whether a segment's effective instant is still ahead of `nowMs` — written
 *  but idle. A segment with no date never is: it applies from the beginning. */
export function isFutureSegment(segment: SegmentDraft, nowMs: number = Date.now()): boolean {
  const at = instantOf(segment.from)
  return at !== null && at > nowMs
}

/** A segment's effective instant in epoch ms (`0` = 无起点), or null while its
 *  date is not a real instant. The axis compares this against the ledger's
 *  first record to place a boundary ON or OFF its left end. */
export function segmentInstant(segment: SegmentDraft): number | null {
  return instantOf(segment.from)
}

/** How one cell's value reads: `ok` (a number), `empty` (not filled yet), or
 *  `bad` (typed, but not a non-negative number). */
export type FieldState = 'ok' | 'empty' | 'bad'

/** One cell's state, so the row can mark the exact field that is wrong. */
export function fieldState(holder: RateTexts | null, field: RateField): FieldState {
  if (holder === null) return 'empty'
  const raw = holder[field].trim()
  if (raw === '') return 'empty'
  return parseRate(raw) === null ? 'bad' : 'ok'
}

/** The whole-day price of one segment, as the four texts a 峰谷时段 shows as its
 *  inherited placeholders. */
export function inheritedRates(segment: SegmentDraft): RateTexts {
  return {
    input: segment.input,
    output: segment.output,
    cacheRead: segment.cacheRead,
    cacheWrite: segment.cacheWrite,
  }
}

// ---------------------------------------------------------------------------
// Validity
// ---------------------------------------------------------------------------

/** The first problem of one whole-day price, or null: input and output are
 *  required, the cache buckets optional, and every filled cell a non-negative
 *  number. */
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

/** The ¥/M numbers of one draft price (a segment's whole-day price), or null
 *  while a required field is not a non-negative number yet (the cache buckets
 *  are optional). */
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

/** The buckets one 峰谷时段 restates, or the first value that is not a number.
 *  It may restate any subset: the ones it leaves out inherit the segment's
 *  whole-day rate. */
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

/** The first problem of one 峰谷时段, or null. Overlap is checked against the
 *  slots shown before it, so the message names the pair that clashes; blank
 *  drafts take no part. */
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

/** How one slot's coverage reads: `工作日 09:00–12:00`. */
export function dayLabel(slot: SlotDraft): string {
  return `${DAY_SET_LABELS[slot.days]} ${rangeLabel(slotRange(slot))}`
}

/** The one thing keeping this row out of the file, or null when it is writable:
 *  shown next to the row's own fields (never only in the footer). Unfinished
 *  drafts are not problems — they simply are not written. */
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
// Signatures and the wire body
// ---------------------------------------------------------------------------

/** One segment as a save would write it, drafts excluded. */
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

/** The signature of one model row: exactly what a save would write for it, so
 *  the tab can tell an edited row from a clean one. An unfinished draft block
 *  is not part of it — adding one leaves the row clean, exactly as the write
 *  leaves the file unchanged. */
export function modelSignature(model: ModelDraft): string {
  return JSON.stringify(pricedSegments(model).map(segmentSignature))
}

/** The combined key of one card row. */
export function rowKey(route: string, model: string): string {
  return `${route}\u0000${model}`
}

/** The readable instant a `from` names, or null for 最早一段 — the segment that
 *  omits its effective instant, i.e. one that has applied to every moment. */
function instantLabel(from: string): string | null {
  const text = from.trim()
  return text === '' ? null : text.replace('T', ' ')
}

/** How a segment's effective instant reads in the 调价史 drawer, right beside
 *  that segment's own 生效时间 field — the field that gives it a date when it
 *  has none. A segment without a date is not "the earliest of a list": its
 *  region has an OPEN LEFT END, and 无起点 is the shortest way to say that. */
export function fmtFrom(from: string): string {
  const at = instantLabel(from)
  return at === null ? '无起点' : `${at} 起`
}

/** How a row's meta line states when the price its four cells edit took effect.
 *  That line sits beside 「账本 N 次」, so the phrase carries its own subject: a
 *  bare 「无起点」 in that position reads as a ledger time. A segment that omits
 *  `from` has no instant to print and says so, instead of dressing a state up
 *  as a date. */
export function fmtRowFrom(from: string): string {
  const at = instantLabel(from)
  return at === null ? '价段无起点（自始生效）' : `价段自 ${at} 起`
}

/** A segment's `from` as a `datetime-local` input value: midnight prints as
 *  `00:00`, since that is what a plain date means. */
export function fromFieldValue(from: string): string {
  const text = from.trim()
  if (text === '') return ''
  return text.includes('T') ? text : `${text}T00:00`
}

/** The draft `from` a `datetime-local` value means: midnight keeps the short
 *  date form (so the file stays as it was), and minutes are dropped — the table
 *  resolves prices by the hour. */
export function fromFieldInput(value: string): string {
  const text = value.trim()
  const [day, time] = text.split('T')
  if (day === undefined || day === '' || time === undefined) return day ?? ''
  const hour = time.slice(0, 2)
  return hour === '00' ? day : `${day}T${hour}:00`
}

/** One 峰谷时段 as a save writes it: the buckets it restates, the rest omitted
 *  so the whole-day rate keeps applying. */
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

/** The body one save sends: the COMPLETE desired file. Refuses with the exact
 *  location of the first problem, the way the host's own parse reports it. */
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
  if (Object.keys(billing).length > 0) body[BILLING_KEY] = billing
  return { ok: true, body }
}

/** The per-row and per-route baselines of one view: a row is dirty when its
 *  signature moved, a route when its billing switch did. Taken from the very
 *  draft the view seeds ({@link draftFromView}), so a rule that shapes a draft
 *  row — the 首记 anchor, for one — can never make a freshly seeded row look
 *  edited. */
export function baselinesOf(view: PricingView): { models: Map<string, string>; billing: Map<string, BillingNature> } {
  const models = new Map<string, string>()
  const billing = new Map<string, BillingNature>()
  for (const [route, card] of draftFromView(view)) {
    billing.set(route, card.billing)
    for (const [model, row] of card.models) models.set(rowKey(route, model), modelSignature(row))
  }
  return { models, billing }
}

/** The baseline a successful save establishes for a draft: exactly its own
 *  signatures, so the local draft stays the source of truth and the tab does
 *  not have to re-seed (which would remount the inputs being typed in). */
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

/** How many rows (and route billing switches) differ from the baseline. */
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

/** Whether one model row differs from the baseline. */
export function modelDirty(route: string, row: ModelDraft, baseline: ReadonlyMap<string, string>): boolean {
  return (baseline.get(rowKey(route, row.model)) ?? '') !== modelSignature(row)
}

/** A rate as the row header prints it (trimmed, at most 4 decimals). */
export function fmtRate(value: string | number | undefined): string {
  const raw = typeof value === 'number' ? String(value) : (value ?? '').trim()
  if (raw === '') return '—'
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return raw
  return String(Math.round(parsed * 10_000) / 10_000)
}
