/**
 * Pure logic of the 价格表 tab: staged draft shapes, draft ↔ wire conversion,
 * validation, and the row model the panel renders.
 *
 * The host keeps TWO hand-price layers — `pricing.json` (per-model global rules)
 * and `provider-pricing.json` (per (channel route, exact model string) overlay)
 * — but the tab shows ONE list keyed by the thing the ledger actually bills: a
 * (通道, 模型串) pair. Which layer prices a row is derived here (`PriceRow.layer`)
 * and edited in place, so the user never has to work out which file holds the
 * number before finding it.
 *
 * Deliberately React-free: this module is the testable half of the tab.
 *
 * @module dsh-tokbook/client/pricing/draft
 */

import type {
  BillingNature, ChannelForm, ChannelUsageRow, DailySlot, ModelPricing, ModelRates, PricingNow,
  PricingView, PricingViewRow, ProviderPricingTable, ProviderPricingViewRow, TimeRule,
} from '../../types.ts'

// ---------------------------------------------------------------------------
// Staged shapes
// ---------------------------------------------------------------------------

/** Blank editable rate slate (undefined = leave the field out on save). */
export interface DraftRates {
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

/** One staged price window of a hand rule set (dates are local `YYYY-MM-DD`;
 *  empty `from` = from the beginning of time, empty `to` = permanent). */
export interface DraftRule {
  id: string
  label: string
  from: string
  to: string
  rates: DraftRates
  /** Peak windows that apply INSIDE this price window. */
  slots: DraftSlot[]
}

/** One staged peak window: minute-of-day windows plus optional weekdays. */
export interface DraftSlot {
  id: string
  label: string
  /** ISO weekdays 1–7; empty = every day. */
  days: number[]
  windows: Array<{ start: string; end: string }>
  rates: DraftRates
}

/** The staged rule set of one hand-edited model entry (the model layer). */
export interface ManualDraft {
  base: DraftRates
  rules: DraftRule[]
  slots: DraftSlot[]
}

/** One staged price segment of a provider entry (dates local `YYYY-MM-DD`). */
export interface DraftSegment {
  id: string
  from: string
  to: string
  rates: DraftRates
  note: string
}

/** One editable draft of a (channel route, model) hand entry (the overlay). */
export interface ProviderDraft {
  key: string
  provider: string
  model: string
  billing: BillingNature
  /** 'inherit' follows a base model's full rules (timeline included);
   *  'segments' is an explicit multi-window price timeline. */
  source: 'inherit' | 'segments'
  /** inherit source: the base model id to follow. */
  inheritBase: string
  /** segments source: the staged price windows. */
  segments: DraftSegment[]
  note: string
  placeholder: boolean
}

export const BLANK_RATES: DraftRates = { input: '', output: '', cacheRead: '', cacheWrite: '' }

/** The `endTime` sentinel meaning "open-ended" (mirrors `pricing.ts`). */
export const OPEN_END = Number.MAX_SAFE_INTEGER

export const FIELD_LABELS = { input: '输入', output: '输出', cacheRead: '缓存读', cacheWrite: '缓存写' } as const
export const FIELD_ORDER: ReadonlyArray<keyof DraftRates> = ['input', 'cacheRead', 'cacheWrite', 'output']
export const WEEKDAY_LABELS: ReadonlyArray<[number, string]> = [[1, '一'], [2, '二'], [3, '三'], [4, '四'], [5, '五'], [6, '六'], [7, '日']]

/** The four channel forms the mirror feed names, in the order the tab lists
 *  them: 直连 → 中转 → 订阅 → 包装. `form` is the feed's own fact — never
 *  guessed from billing or the price source, since a first-party metered channel
 *  may price with segments just as a relay may follow the official table. */
export const FORM_ORDER: ReadonlyArray<ChannelForm> = ['official', 'relay', 'subscription', 'wrapper']
export const FORM_LABELS: Record<ChannelForm, string> = {
  official: '官方通道',
  relay: '中转转售',
  subscription: '订阅套餐',
  wrapper: '包装路由',
}

let uidCounter = 0
export const nextId = (): string => `d${++uidCounter}`

// ---------------------------------------------------------------------------
// Formatting + parsing
// ---------------------------------------------------------------------------

/** Render a rate (¥/M) compactly: drop trailing zeros, show at most 4 decimals. */
export function fmtRate(value: number | undefined): string {
  if (value === undefined) return '—'
  return String(Math.round(value * 10000) / 10000)
}

/** Parse one staged rate cell: empty → undefined (field omitted); else a
 *  non-negative finite number, or NaN for a validation error. */
export function parseRate(value: string): number | undefined | typeof NaN {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return NaN
  return n
}

/** 'YYYY-MM-DD' → local-midnight epoch seconds; null when not a real date. */
export function dateStartSec(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return Math.floor(date.getTime() / 1000)
}

/** 'YYYY-MM-DD' → local END of that day (inclusive window end). */
export function dateEndSec(value: string): number | null {
  const start = dateStartSec(value)
  return start === null ? null : start + 86399
}

/** Epoch seconds → local `YYYY-MM-DD`. */
export function secToDate(sec: number): string {
  const date = new Date(sec * 1000)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 'HH:MM' → minute of day 0–1440; null when malformed. */
export function clockToMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (match === null) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 24 || minute > 59) return null
  const total = hour * 60 + minute
  return total > 1440 ? null : total
}

/** Minute of day → 'HH:MM'. */
export function minuteToClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Render a rule/window span for display. */
export function spanText(from: number, to: number): string {
  const start = from === 0 ? '自始' : secToDate(from)
  const end = to >= OPEN_END ? '永久' : secToDate(to)
  return `${start} → ${end}`
}

/** The window start of a staged rule in epoch seconds (empty date = 自始). */
export function ruleStartSec(rule: DraftRule): number {
  return rule.from.trim() === '' ? 0 : dateStartSec(rule.from) ?? 0
}

/** The window end of a staged rule in epoch seconds (empty date = 永久). */
export function ruleEndSec(rule: DraftRule): number {
  return rule.to.trim() === '' ? OPEN_END : dateEndSec(rule.to) ?? 0
}

// ---------------------------------------------------------------------------
// Draft ↔ wire conversion
// ---------------------------------------------------------------------------

export function ratesToDraft(rate: ModelPricing | undefined): DraftRates {
  if (rate === undefined) return { ...BLANK_RATES }
  return {
    input: String(rate.inputPerMillion),
    output: String(rate.outputPerMillion),
    cacheRead: rate.cacheReadPerMillion !== undefined ? String(rate.cacheReadPerMillion) : '',
    cacheWrite: rate.cacheWritePerMillion !== undefined ? String(rate.cacheWritePerMillion) : '',
  }
}

export function slotsToDraft(slots: DailySlot[] | undefined): DraftSlot[] {
  return (slots ?? []).map(slot => ({
    id: nextId(),
    label: slot.label ?? '',
    days: [...(slot.daysOfWeek ?? [])],
    windows: slot.windows.map(window => ({ start: minuteToClock(window.startMinute), end: minuteToClock(window.endMinute) })),
    rates: ratesToDraft(slot.rates),
  }))
}

export function rulesToDraft(rules: TimeRule[] | undefined): DraftRule[] {
  return [...(rules ?? [])]
    .sort((a, b) => a.startTime - b.startTime)
    .map(rule => ({
      id: nextId(),
      label: rule.label ?? '',
      from: rule.startTime === 0 ? '' : secToDate(rule.startTime),
      to: rule.endTime >= OPEN_END ? '' : secToDate(rule.endTime),
      rates: ratesToDraft(rule.rates),
      slots: slotsToDraft(rule.dailySlots),
    }))
}

export function draftOf(rules: ModelRates | undefined): ManualDraft {
  if (rules === undefined) return { base: { ...BLANK_RATES }, rules: [], slots: [] }
  return { base: ratesToDraft(rules.base), rules: rulesToDraft(rules.timeRules), slots: slotsToDraft(rules.dailySlots) }
}

/** Compose a staged slate into a wire rate object; null when input/output are
 *  missing or invalid (the save validation reports which row). */
export function composeRates(draft: DraftRates): ModelPricing | null {
  const input = parseRate(draft.input)
  const output = parseRate(draft.output)
  if (typeof input !== 'number' || Number.isNaN(input) || typeof output !== 'number' || Number.isNaN(output)) return null
  const out: ModelPricing = { inputPerMillion: input, outputPerMillion: output }
  const cacheRead = parseRate(draft.cacheRead)
  if (typeof cacheRead === 'number' && !Number.isNaN(cacheRead)) out.cacheReadPerMillion = cacheRead
  const cacheWrite = parseRate(draft.cacheWrite)
  if (typeof cacheWrite === 'number' && !Number.isNaN(cacheWrite)) out.cacheWritePerMillion = cacheWrite
  return out
}

export function composeSlots(slots: readonly DraftSlot[]): DailySlot[] {
  return slots.map(slot => ({
    windows: slot.windows.map(window => ({
      startMinute: clockToMinute(window.start) ?? 0,
      endMinute: clockToMinute(window.end) ?? 0,
    })),
    rates: composeRates(slot.rates) ?? { inputPerMillion: 0, outputPerMillion: 0 },
    ...(slot.days.length > 0 ? { daysOfWeek: [...slot.days].sort((a, b) => a - b) } : {}),
    ...(slot.label.trim() !== '' ? { label: slot.label.trim() } : {}),
  }))
}

/** Compose staged windows into the wire shape, SORTED by start so the written
 *  order matches the read order and the resolution order (the engine takes the
 *  first matching window). An open-ended window omits `endTime` (the host reads
 *  that as "permanent"). */
export function composeRules(rules: readonly DraftRule[]): Array<Record<string, unknown>> {
  return [...rules]
    .sort((a, b) => ruleStartSec(a) - ruleStartSec(b))
    .map(rule => ({
      startTime: ruleStartSec(rule),
      ...(rule.to.trim() === '' ? {} : { endTime: ruleEndSec(rule) }),
      rates: composeRates(rule.rates) ?? { inputPerMillion: 0, outputPerMillion: 0 },
      ...(rule.slots.length > 0 ? { dailySlots: composeSlots(rule.slots) } : {}),
      ...(rule.label.trim() !== '' ? { label: rule.label.trim() } : {}),
    }))
}

/** The staged draft as a `ModelRates` shape, so the READ-ONLY timeline can show
 *  what a hand price looks like without turning the row into a form. Staged
 *  values that do not parse read as ¥0 (the save path reports the real error). */
export function draftToRates(draft: ManualDraft): ModelRates {
  return {
    base: composeRates(draft.base) ?? { inputPerMillion: 0, outputPerMillion: 0 },
    contextTiers: [],
    dailySlots: composeSlots(draft.slots),
    timeRules: [...draft.rules]
      .sort((a, b) => ruleStartSec(a) - ruleStartSec(b))
      .map(rule => ({
        startTime: ruleStartSec(rule),
        endTime: ruleEndSec(rule),
        rates: composeRates(rule.rates) ?? { inputPerMillion: 0, outputPerMillion: 0 },
        ...(rule.slots.length > 0 ? { dailySlots: composeSlots(rule.slots) } : {}),
        ...(rule.label.trim() !== '' ? { label: rule.label.trim() } : {}),
      })),
  }
}

function composeEntry(draft: ManualDraft): Record<string, unknown> | null {
  const base = composeRates(draft.base)
  if (base === null) return null
  const timeRules = composeRules(draft.rules)
  const dailySlots = composeSlots(draft.slots)
  if (timeRules.length === 0 && dailySlots.length === 0) return base as unknown as Record<string, unknown>
  return {
    base,
    ...(timeRules.length > 0 ? { timeRules } : {}),
    ...(dailySlots.length > 0 ? { dailySlots } : {}),
  }
}

/** The COMPLETE desired model-layer hand table (whole-file PUT semantics). */
export function composeModelTable(drafts: ReadonlyMap<string, ManualDraft>): Record<string, unknown> {
  const table: Record<string, unknown> = {}
  for (const [model, draft] of drafts) {
    const entry = composeEntry(draft)
    if (entry !== null) table[model] = entry
  }
  return table
}

/** Compose the staged overlay into the wire table, or report the first error. */
export function composeProviderTable(
  drafts: ReadonlyMap<string, ProviderDraft>,
): { ok: true; table: ProviderPricingTable } | { ok: false; error: string } {
  const table: ProviderPricingTable = {}
  for (const draft of drafts.values()) {
    const where = `「${draft.provider}/${draft.model}」`
    const entry: Record<string, unknown> = { billing: draft.billing }
    if (draft.source === 'inherit') {
      const base = draft.inheritBase.trim()
      if (base === '') return { ok: false, error: `${where}的跟随基准模型名不能为空` }
      entry.inheritBase = base
    } else {
      if (draft.segments.length === 0) return { ok: false, error: `${where}至少需要一个价格时段` }
      const segments: Array<Record<string, unknown>> = []
      for (const [index, segment] of draft.segments.entries()) {
        const label = `${where}第 ${String(index + 1)} 个时段`
        const from = segment.from.trim() === '' ? 0 : dateStartSec(segment.from)
        const to = segment.to.trim() === '' ? undefined : dateEndSec(segment.to)
        if (from === null) return { ok: false, error: `${label}的开始日期不是有效日期（YYYY-MM-DD）` }
        if (to === null) return { ok: false, error: `${label}的结束日期不是有效日期（YYYY-MM-DD）` }
        if (to !== undefined && to < from) return { ok: false, error: `${label}的结束日期早于开始日期` }
        const rateError = validateRates(segment.rates, label)
        if (rateError !== null) return { ok: false, error: rateError }
        const rate = composeRates(segment.rates)!
        segments.push({
          ...(from !== 0 ? { from } : {}),
          ...(to !== undefined ? { to: to + 1 } : {}),
          rate,
          ...(segment.note.trim() !== '' ? { note: segment.note.trim() } : {}),
        })
      }
      entry.segments = segments
    }
    // A placeholder is "official price stands in" — it only makes sense while
    // following a base model, never alongside an explicit timeline.
    if (draft.placeholder && draft.source === 'inherit') entry.placeholder = true
    if (draft.note.trim() !== '') entry.note = draft.note.trim()
    const models = (table[draft.provider] ?? {}) as Record<string, unknown>
    models[draft.model] = entry
    table[draft.provider] = models as ProviderPricingTable[string]
  }
  return { ok: true, table }
}

/** Seed an overlay draft from a mirror/hand row so the user can edit it. */
export function providerDraftOf(row: ProviderPricingViewRow): ProviderDraft {
  return {
    key: providerKeyOf(row.provider, row.model),
    provider: row.provider,
    model: row.model,
    billing: row.billing ?? 'metered',
    source: row.segments !== undefined ? 'segments' : 'inherit',
    inheritBase: row.inheritBase ?? row.model,
    segments: (row.segments ?? []).map(segment => ({
      id: nextId(),
      from: segment.from === undefined || segment.from === 0 ? '' : secToDate(segment.from),
      to: segment.to === undefined ? '' : secToDate(segment.to - 1),
      rates: ratesToDraft(segment.rate),
      note: segment.note ?? '',
    })),
    note: row.manual ? row.note ?? '' : '',
    placeholder: row.placeholder === true,
  }
}

/** A one-line human summary of an overlay row's price source. */
export function providerSourceSummary(row: ProviderPricingViewRow): string {
  if (row.segments !== undefined && row.segments.length > 0) {
    if (row.segments.length === 1 && row.segments[0]!.from === undefined && row.segments[0]!.to === undefined) {
      const rate = row.segments[0]!.rate
      return `固定价 入 ¥${fmtRate(rate.inputPerMillion)} · 出 ¥${fmtRate(rate.outputPerMillion)}`
    }
    return `自己填价 · ${String(row.segments.length)} 段`
  }
  if (row.placeholder === true) return '先按官方价（还没填中转价）'
  if (row.inheritBase !== undefined) return `跟随 ${row.inheritBase} 的价`
  return '云端给的价'
}

// ---------------------------------------------------------------------------
// Staged status: one generic mechanism for both layers
// ---------------------------------------------------------------------------

/** How one row's staged state differs from the view it was loaded from. */
export type RowStatus = 'clean' | 'unsaved' | 'pending-delete'

/** Signature of ONE staged draft. It includes INVALID staged values (unlike the
 *  composed table, which drops them), so an incomplete row still counts as
 *  unsaved and one 保存 press surfaces the validation error instead of leaving a
 *  disabled button. */
export function signatureOf(value: unknown): string {
  return JSON.stringify(value)
}

/** Per-key baseline signatures of the loaded/saved view. A map rather than one
 *  whole-table string: row order never counts as an edit, and every row carries
 *  its own dirty state instead of sharing one global flag. */
export function baselineOf<T>(entries: Iterable<[string, T]>): ReadonlyMap<string, string> {
  const map = new Map<string, string>()
  for (const [key, value] of entries) map.set(key, signatureOf(value))
  return map
}

/** One row's staged state. An edited draft is 未保存; a key whose baseline entry
 *  is gone from the staged map is 待删除 — a staged deletion must be as visible
 *  as a staged edit. */
export function rowStatusOf(saved: string | undefined, current: string | undefined): RowStatus {
  if (current !== undefined) return saved === current ? 'clean' : 'unsaved'
  return saved === undefined ? 'clean' : 'pending-delete'
}

/** How many staged rows differ from their baseline. Iterates the union of both
 *  sides, because deleting the last draft can leave no row behind at all. */
export function stagedChangeCount<T>(
  current: ReadonlyMap<string, T>,
  baseline: ReadonlyMap<string, string>,
): number {
  let changed = 0
  for (const [key, value] of current) {
    if (baseline.get(key) !== signatureOf(value)) changed++
  }
  for (const key of baseline.keys()) {
    if (!current.has(key)) changed++
  }
  return changed
}

/** Whether a staged map differs from its baseline (see `stagedChangeCount`). */
export function stagedDirty<T>(
  current: ReadonlyMap<string, T>,
  baseline: ReadonlyMap<string, string>,
): boolean {
  return stagedChangeCount(current, baseline) > 0
}

/** Order-insensitive signature of a staged alias map (route → canonical). */
export function aliasSignature(aliases: ReadonlyMap<string, string>): string {
  return JSON.stringify([...aliases].sort(([left], [right]) => left.localeCompare(right)))
}

// ---------------------------------------------------------------------------
// Validation + live "price now"
// ---------------------------------------------------------------------------

export function validateRates(rates: DraftRates, where: string): string | null {
  for (const field of FIELD_ORDER) {
    if (Number.isNaN(parseRate(rates[field]))) return `${where}的${FIELD_LABELS[field]}不是有效价格（非负数字）`
  }
  if (composeRates(rates) === null) return `${where}至少需要填写 输入 与 输出 单价`
  return null
}

function validateSlots(slots: readonly DraftSlot[], where: string): string | null {
  for (const [index, slot] of slots.entries()) {
    const label = `${where}第 ${String(index + 1)} 个峰谷时段`
    if (slot.windows.length === 0) return `${label}至少需要一个时间窗口`
    for (const window of slot.windows) {
      const start = clockToMinute(window.start)
      const end = clockToMinute(window.end)
      if (start === null || end === null || start >= end) return `${label}的时间窗口需要合法的 HH:MM 且开始早于结束`
    }
    const rateError = validateRates(slot.rates, label)
    if (rateError !== null) return rateError
  }
  return null
}

/** Validate one staged model-layer draft; null = fine. */
export function validateManualDraft(model: string, draft: ManualDraft): string | null {
  const baseError = validateRates(draft.base, `「${model}」的基础价`)
  if (baseError !== null) return baseError
  const spans: Array<{ index: number; from: number; to: number }> = []
  for (const [index, rule] of draft.rules.entries()) {
    const where = `「${model}」第 ${String(index + 1)} 个调价段`
    const from = rule.from.trim() === '' ? 0 : dateStartSec(rule.from)
    const to = rule.to.trim() === '' ? OPEN_END : dateEndSec(rule.to)
    if (from === null) return `${where}的开始日期不是有效日期（YYYY-MM-DD）`
    if (to === null) return `${where}的结束日期不是有效日期（YYYY-MM-DD）`
    if (to < from) return `${where}的结束日期早于开始日期`
    const rateError = validateRates(rule.rates, where)
    if (rateError !== null) return rateError
    const slotError = validateSlots(rule.slots, where)
    if (slotError !== null) return slotError
    spans.push({ index, from, to })
  }
  // Overlapping price windows are ambiguous (the engine takes the first match)
  // — refuse them instead of silently ignoring one.
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i]!
      const b = spans[j]!
      if (a.from <= b.to && b.from <= a.to) {
        return `「${model}」第 ${String(a.index + 1)} 与第 ${String(b.index + 1)} 个调价段重叠（${spanText(a.from, a.to)} / ${spanText(b.from, b.to)}）；同一时刻只能有一段价`
      }
    }
  }
  return validateSlots(draft.slots, `「${model}」`)
}

/** The price one STAGED rule set applies right now — live feedback while the
 *  user edits, mirroring the host chain for the tier-free hand layer
 *  (time rule first, then its peak windows, else the base and its windows). */
export function draftNow(draft: ManualDraft, at: Date = new Date()): PricingNow | null {
  const seconds = Math.floor(at.getTime() / 1000)
  const minute = at.getHours() * 60 + at.getMinutes()
  const weekday = at.getDay() === 0 ? 7 : at.getDay()
  const matchSlot = (slots: readonly DraftSlot[]): DraftSlot | null => {
    for (const slot of slots) {
      if (slot.days.length > 0 && !slot.days.includes(weekday)) continue
      for (const window of slot.windows) {
        const start = clockToMinute(window.start)
        const end = clockToMinute(window.end)
        if (start === null || end === null || start >= end) continue
        if (start <= minute && minute < end) return slot
      }
    }
    return null
  }
  let rule: DraftRule | null = null
  // Sorted so the live preview matches the engine's first-match rule even while
  // the user is still typing overlapping windows (which the save will refuse).
  for (const candidate of [...draft.rules].sort((a, b) => ruleStartSec(a) - ruleStartSec(b))) {
    const from = ruleStartSec(candidate)
    const to = ruleEndSec(candidate)
    if (from <= seconds && seconds <= to) { rule = candidate; break }
  }
  const slot = matchSlot(rule !== null ? rule.slots : draft.slots)
  if (slot !== null) {
    const rates = composeRates(slot.rates)
    return rates === null ? null : { rates, ...(slot.label.trim() !== '' ? { label: slot.label.trim() } : {}), peak: true }
  }
  const rates = composeRates(rule !== null ? rule.rates : draft.base)
  if (rates === null) return null
  const label = rule !== null ? rule.label.trim() : ''
  return { rates, ...(label !== '' ? { label } : {}), peak: false }
}

/** The price a staged segment timeline applies at `nowSec` (live feedback). */
export function segmentNow(segments: readonly DraftSegment[], nowSec: number): PricingNow | undefined {
  for (const segment of segments) {
    const from = segment.from.trim() === '' ? 0 : dateStartSec(segment.from)
    const to = segment.to.trim() === '' ? OPEN_END : dateEndSec(segment.to)
    if (from === null || to === null) continue
    if (from <= nowSec && nowSec <= to) {
      const rates = composeRates(segment.rates)
      if (rates === null) return undefined
      return { rates, ...(segment.note.trim() !== '' ? { label: segment.note.trim() } : {}), peak: false }
    }
  }
  return undefined
}

/** Whether a staged segment timeline currently applies (used to decide which
 *  segment the row's four rate cells edit). */
export function segmentIndexNow(segments: readonly DraftSegment[], nowSec: number): number {
  for (const [index, segment] of segments.entries()) {
    const from = segment.from.trim() === '' ? 0 : dateStartSec(segment.from)
    const to = segment.to.trim() === '' ? OPEN_END : dateEndSec(segment.to)
    if (from === null || to === null) continue
    if (from <= nowSec && nowSec <= to) return index
  }
  return -1
}

// ---------------------------------------------------------------------------
// The row model: one row per (通道, 模型串)
// ---------------------------------------------------------------------------

/** Which hand layer a row's price comes from. */
export type PriceLayer = 'overlay' | 'model'

export interface PriceRow {
  /** `${provider}\n${model}` — the row's identity (see `providerKeyOf`). */
  key: string
  /** Channel route key; '' = no route (a model-layer entry the ledger never
   *  billed through any route). */
  provider: string
  model: string
  /** Ledger records for this exact (route, string); 0 = never billed. */
  records: number
  billing: BillingNature
  /** The layer that prices this row today. */
  layer: PriceLayer
  /** Short source badge (手工价 / 手工覆盖 / 跟随官方价 / 云端 · 分时 / 价格未知 …). */
  tag: string
  /** Badge tone, for the chip colour. */
  tone: 'hand' | 'overlay' | 'cloud' | 'unknown' | 'follow'
  /** One-line explanation shown under the model name. */
  detail: string
  /** Price in force now (the channel's own resolved price when billed). */
  now?: PricingNow
  /** True when nothing prices this row (billed ¥0 — 不知价,不是免费). */
  unpriced: boolean
  /** The cloud rule set behind this string carries windows/tiers/slots. */
  layered: boolean
  /** Read-only: follows another route (`via`) or shares the global model-layer
   *  price owned by `canonical`. */
  locked: boolean
  /** Following row: the canonical route to edit instead. */
  via?: string
  /** Shared-global-price row: the route whose row owns the model-layer editor. */
  canonical?: string
  /** Other routes billing this same model string. */
  sharedRoutes: readonly string[]
  /** The wire row behind the model layer (absent when the feed never named it). */
  modelRow?: PricingViewRow
  /** The wire row behind the overlay layer (absent when no entry exists). */
  overlayRow?: ProviderPricingViewRow
}

export const providerKeyOf = (provider: string, model: string): string => `${provider}\n${model}`

/** One 未计费 row (a hand price nothing has billed through) lives in this
 *  synthetic route bucket so it stays visible. */
export const UNBILLED_GROUP = '\u0000unbilled'

/** Build the tab's rows: every (route, string) the ledger billed, every entry
 *  of the effective overlay, and every staged hand entry — deduplicated by
 *  (route, string), with the layer each row's price comes from resolved. */
export function buildPriceRows(
  view: PricingView,
  modelDrafts: ReadonlyMap<string, ManualDraft>,
  overlayDrafts: ReadonlyMap<string, ProviderDraft>,
): PriceRow[] {
  const modelRows = new Map(view.rows.map(row => [row.model, row]))
  const channels = view.channelRows ?? []
  const overlayRows = new Map((view.providerRows ?? []).map(row => [providerKeyOf(row.provider, row.model), row]))
  const byModel = new Map<string, ChannelUsageRow[]>()
  for (const channel of channels) {
    const list = byModel.get(channel.model)
    if (list === undefined) byModel.set(channel.model, [channel])
    else list.push(channel)
  }
  /** The route whose row carries the EDITABLE model-layer price for a string.
   *  The model-layer price is global (one entry per string), so a string billed
   *  by several routes must not offer an editor in each of them: prefer a route
   *  that actually spends money (`metered`), then the one with the most records,
   *  then the route key — a deterministic choice the user can see. */
  const canonicalOf = (model: string): string => {
    const group = byModel.get(model) ?? []
    const metered = group.filter(row => row.billing === 'metered')
    const pool = metered.length > 0 ? metered : group
    return [...pool].sort((a, b) => b.records - a.records || a.provider.localeCompare(b.provider))[0]?.provider ?? ''
  }

  const rows: PriceRow[] = []
  const seen = new Set<string>()
  const emit = (provider: string, model: string, channel: ChannelUsageRow | undefined): void => {
    const key = providerKeyOf(provider, model)
    if (seen.has(key)) return
    seen.add(key)

    const modelRow = modelRows.get(model)
    const overlayDraft = overlayDrafts.get(key)
    const overlayRow = overlayRows.get(key)
    const records = channel?.records ?? 0
    const billing = channel?.billing ?? overlayDraft?.billing ?? overlayRow?.billing ?? 'metered'
    const now = channel?.now ?? overlayRow?.now ?? modelRow?.now
    const shared = (byModel.get(model) ?? []).filter(entry => entry.provider !== provider)
    const sharedRoutes = shared.map(entry => entry.provider)

    if (overlayDraft !== undefined || overlayRow !== undefined) {
      const via = overlayRow?.via
      // A row inherited through a route alias (mirror wrapper / hand 同价通道)
      // is read-only: the canonical route owns the entry.
      const source = via !== undefined
        ? { tag: `跟随 ${via}`, tone: 'follow' as const, detail: overlayRow === undefined ? '' : providerSourceSummary(overlayRow) }
        : overlayDraft !== undefined
          ? {
            tag: '手工覆盖',
            tone: 'hand' as const,
            detail: overlayDraft.source === 'inherit'
              ? `跟随 ${overlayDraft.inheritBase !== '' ? overlayDraft.inheritBase : '—'} 的价`
              : `自己填价 · ${String(overlayDraft.segments.length)} 段`,
          }
          : {
            tag: overlayRow?.segments !== undefined ? '自己填价' : overlayRow?.placeholder === true ? '先按官方价' : overlayRow?.inheritBase !== undefined ? '跟随官方价' : '镜像覆盖',
            tone: 'overlay' as const,
            detail: overlayRow === undefined ? '' : providerSourceSummary(overlayRow),
          }
      rows.push({
        key, provider, model, records, billing,
        layer: 'overlay',
        tag: source.tag,
        tone: source.tone,
        detail: source.detail,
        ...(now !== undefined ? { now } : {}),
        unpriced: false,
        layered: false,
        locked: via !== undefined,
        ...(via !== undefined ? { via } : {}),
        sharedRoutes,
        ...(modelRow !== undefined ? { modelRow } : {}),
        ...(overlayRow !== undefined ? { overlayRow } : {}),
      })
      return
    }

    const manual = modelDrafts.has(model)
    const canonical = canonicalOf(model)
    // Only the canonical route's row (or a row with no route at all) may edit
    // the global model-layer entry.
    const locked = provider !== '' && canonical !== '' && canonical !== provider
    const unpriced = channel?.unpriced === true || (modelRow?.unpriced === true && !manual)
    const tag = manual ? '手工价'
      : unpriced ? '价格未知'
        : modelRow?.overlayPriced === true ? '覆盖层定价'
          : modelRow?.layered === true ? '云端 · 分时'
            : modelRow === undefined ? '价格未知' : '云端'
    const detail = manual
      ? (modelRow?.records !== undefined && modelRow.records > 0 ? '本机手工价（全局：改动对所有通道生效）' : '本机手工价（账本还没按它计费）')
      : unpriced ? '两表都不知道它的价，暂按 ¥0 计 —— 价格未知，不是免费'
        : modelRow?.overlayPriced === true ? `由通道覆盖层定价（${modelRow.provider !== undefined && modelRow.provider !== '' ? modelRow.provider : '—'}）`
          // A plain cloud row needs no second line: the badge already says 云端
          // (· 分时), and the four cells carry the price.
          : ''
    rows.push({
      key, provider, model, records, billing,
      layer: 'model',
      tag,
      tone: manual ? 'hand' : unpriced || modelRow === undefined ? 'unknown' : 'cloud',
      detail,
      ...(now !== undefined ? { now } : {}),
      unpriced,
      layered: modelRow?.layered === true,
      locked,
      ...(locked ? { canonical } : {}),
      sharedRoutes,
      ...(modelRow !== undefined ? { modelRow } : {}),
      ...(overlayRow !== undefined ? { overlayRow } : {}),
    })
  }

  for (const channel of channels) emit(channel.provider, channel.model, channel)
  for (const overlay of view.providerRows ?? []) emit(overlay.provider, overlay.model, undefined)
  for (const draft of overlayDrafts.values()) emit(draft.provider, draft.model, undefined)
  for (const model of modelDrafts.keys()) {
    // A hand price for a string the ledger has not billed keeps its own row, so
    // it stays visible and editable instead of vanishing into a file.
    if ((byModel.get(model) ?? []).length === 0) emit('', model, undefined)
  }
  return rows
}

// ---------------------------------------------------------------------------
// Grouping, filtering, reference rows
// ---------------------------------------------------------------------------

export interface PriceGroup {
  /** Route key, or `UNBILLED_GROUP` for the trailing 未计费 bucket. */
  provider: string
  label: string
  form?: ChannelForm
  records: number
  rows: PriceRow[]
  /** No ledger record for this route (or no route at all): 未计费. */
  unbilled: boolean
}

/** Group rows by channel route (most-used first, then the mirror's channel form,
 *  then the route key); routes the ledger never billed — and model-layer entries
 *  with no route at all — collect into one trailing 未计费 group. */
export function groupRows(
  rows: readonly PriceRow[],
  labels: Record<string, string>,
  forms: Record<string, ChannelForm>,
  formFilter: ChannelForm | null,
): PriceGroup[] {
  const byProvider = new Map<string, PriceRow[]>()
  for (const row of rows) {
    const key = row.provider === '' && row.records === 0 ? UNBILLED_GROUP : row.provider
    const list = byProvider.get(key)
    if (list === undefined) byProvider.set(key, [row])
    else list.push(row)
  }
  const groups: PriceGroup[] = []
  const unbilled: PriceRow[] = []
  for (const [provider, list] of byProvider) {
    const records = list.reduce((sum, row) => sum + row.records, 0)
    if (provider !== UNBILLED_GROUP && records === 0) { unbilled.push(...list); continue }
    if (provider === UNBILLED_GROUP) { unbilled.push(...list); continue }
    list.sort((a, b) => b.records - a.records || a.model.localeCompare(b.model))
    const form = forms[provider]
    groups.push({
      provider,
      label: labels[provider] ?? (provider === '' ? '(未知)' : provider),
      ...(form !== undefined ? { form } : {}),
      records,
      rows: list,
      unbilled: false,
    })
  }
  const rankOf = (form: ChannelForm | undefined): number => {
    const index = form === undefined ? -1 : FORM_ORDER.indexOf(form)
    return index < 0 ? FORM_ORDER.length : index
  }
  groups.sort((a, b) => b.records - a.records || rankOf(a.form) - rankOf(b.form) || a.provider.localeCompare(b.provider))
  const visible = formFilter === null ? groups : groups.filter(group => group.form === formFilter)
  // The 未计费 bucket has no single form, so a form filter narrows its ROWS by
  // their own route instead of dropping the whole bucket.
  const unbilledVisible = formFilter === null
    ? unbilled
    : unbilled.filter(row => forms[row.provider] === formFilter)
  if (unbilledVisible.length > 0) {
    unbilledVisible.sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model))
    visible.push({
      provider: UNBILLED_GROUP,
      label: '未计费',
      records: 0,
      rows: unbilledVisible,
      unbilled: true,
    })
  }
  return visible
}

/** Count of route groups per channel form (the form chips' badges). */
export function formCounts(groups: readonly PriceGroup[]): Map<ChannelForm, number> {
  const counts = new Map<ChannelForm, number>()
  for (const group of groups) {
    if (group.form === undefined || group.unbilled) continue
    counts.set(group.form, (counts.get(group.form) ?? 0) + 1)
  }
  return counts
}

/** The reference table: cloud rows the ledger has never billed, no hand entry
 *  touches, and no overlay prices — the mirror's catalogue, read-only. Rows in
 *  use stay in the main list with a 云端 badge instead. */
export function referenceRows(view: PricingView): PricingViewRow[] {
  return view.rows.filter(row =>
    !row.manual
    && row.unpriced !== true
    && row.overlayPriced !== true
    && (row.records ?? 0) === 0)
}

/** Group reference rows by the feed's `family`: most models first, then name;
 *  the unnamed bucket (`''`, rendered as 未标注厂商) always sorts last. */
export function groupByFamily(rows: readonly PricingViewRow[]): Array<[string, PricingViewRow[]]> {
  const byFamily = new Map<string, PricingViewRow[]>()
  for (const row of rows) {
    const family = row.family ?? ''
    const list = byFamily.get(family)
    if (list === undefined) byFamily.set(family, [row])
    else list.push(row)
  }
  return [...byFamily].sort(([a, listA], [b, listB]) => {
    if (a === '') return 1
    if (b === '') return -1
    return listB.length - listA.length || a.localeCompare(b)
  })
}

/** Every price-window / peak-window label a model string currently carries
 *  (staged draft when present, loaded rules otherwise) — what the search matches
 *  besides the model string itself. */
export function ruleLabelsOf(row: PricingViewRow | undefined, draft: ManualDraft | undefined): string[] {
  const labels: string[] = []
  if (draft !== undefined) {
    for (const rule of draft.rules) {
      if (rule.label.trim() !== '') labels.push(rule.label.trim())
      for (const slot of rule.slots) if (slot.label.trim() !== '') labels.push(slot.label.trim())
    }
    for (const slot of draft.slots) if (slot.label.trim() !== '') labels.push(slot.label.trim())
    return labels
  }
  const rules = row?.manualRules ?? row?.cloudRules
  if (rules === undefined) return labels
  for (const rule of rules.timeRules) {
    if (rule.label !== undefined) labels.push(rule.label)
    for (const slot of rule.dailySlots ?? []) if (slot.label !== undefined) labels.push(slot.label)
  }
  for (const slot of rules.dailySlots) if (slot.label !== undefined) labels.push(slot.label)
  return labels
}

/** Provider route keys can contain characters invalid in an HTML id. */
export function cssId(provider: string): string {
  return provider.replace(/[^a-zA-Z0-9_-]/g, '-')
}
