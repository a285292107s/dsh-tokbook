/**
 * 价格表 tab of the token-book floating window: two editing surfaces behind
 * one segmented switch —
 *
 *  · 「模型价」 — the per-model base price table (¥ / million tokens). A hand
 *    override (`pricing.json`) beats the synced cloud mirror wholesale and may
 *    carry a TIME dimension: a price timeline (`timeRules`, one flat slate per
 *    window — a limited-time cut, a permanent cut) and recurring peak windows
 *    (`dailySlots` — DeepSeek-style peak/off-peak). Both the hand layer and the
 *    cloud mirror are shown as a timeline, and every row states the price in
 *    force NOW, so a discounted or peak-priced model never advertises a base
 *    rate that is not actually charged. The cloud table is reference-only and
 *    folded into a bounded scroll by default, so the tab never becomes a wall
 *    of hundreds of rows.
 *  · 「通道覆盖层」 — per (provider, exact model string) overrides of the
 *    billing nature and price source (`provider-pricing.json`), grouped by
 *    provider route. A row either follows a base model's full rule set
 *    (`inheritBase`, so the timeline comes along) or owns an explicit
 *    multi-segment price timeline (`segments`). Rows are compact summaries; the
 *    editor for one row opens only while that row is being edited, and new
 *    (provider, model) overrides can be added.
 *
 * Edits write the WHOLE hand file for the active surface (`PUT /tokbook/pricing`
 * for the model layer, `PUT /tokbook/provider-pricing` for the overlay), so each
 * row edit is staged in local state and one 保存 applies everything. The host
 * answers a fresh view which replaces the list in place; the overview figures
 * re-price on the next read, so a successful save asks the parent to refresh.
 * The save button is enabled by DIRTY state, not by row count — removing the
 * last override is a legal edit (the empty table clears the hand layer).
 *
 * @module dsh-tokbook/client/PricingPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BillingNature, ChannelUsageRow, DailySlot, ModelPricing, ModelRates, PricingNow, PricingView, PricingViewRow, ProviderAliasMap, ProviderPricingTable, ProviderPricingViewRow, TimeRule } from '../types.ts'

/** Blank editable rate slate (undefined = leave the field out on save). */
interface DraftRates {
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

/** One staged price window of a hand rule set (dates are local `YYYY-MM-DD`;
 *  empty `from` = from the beginning of time, empty `to` = permanent). */
interface DraftRule {
  id: string
  label: string
  from: string
  to: string
  rates: DraftRates
  /** Peak windows that apply INSIDE this price window. */
  slots: DraftSlot[]
}

/** One staged peak window: minute-of-day windows plus optional weekdays. */
interface DraftSlot {
  id: string
  label: string
  /** ISO weekdays 1–7; empty = every day. */
  days: number[]
  windows: Array<{ start: string; end: string }>
  rates: DraftRates
}

/** The staged rule set of one hand-edited model entry. */
interface ManualDraft {
  base: DraftRates
  rules: DraftRule[]
  slots: DraftSlot[]
}

/** One model row of the model-price surface. */
interface EditableRow {
  model: string
  /** The wire row as loaded (cloud rules, ledger counts, layer flags). */
  origin: PricingViewRow
  /** True while this row carries a staged/loaded hand entry. */
  manual: boolean
  draft: ManualDraft
  open: boolean
}

export interface PricingPanelProps {
  /** Called after a successful save so the parent can refresh the overview. */
  onChanged: () => void
  /** Reports whether the tab currently holds unsaved staged edits (drives the
   *  tab dot). Not cleared on unmount: the drafts outlive the panel. */
  onDirtyChange?: (dirty: boolean) => void
  /** A cross-tab request (the overview's 价格未知 note) to open on one scope. */
  focusScope?: ModelScope | null
  /** Called once `focusScope` has been applied. */
  onFocusScopeHandled?: () => void
}

/**
 * Dirty staged edits survive a panel unmount (switching tabs, or closing the
 * floating window) so an unsaved draft is never silently dropped: the panel
 * rehydrates it on the next mount and the save button stays dirty until the
 * user saves or discards. Only a DIRTY state is cached — a clean one is
 * dropped so the next mount fetches a fresh view.
 */
interface StagedModelDrafts {
  rows: readonly EditableRow[]
  baseline: ReadonlyMap<string, string>
  /** The channel lens travels with the drafts so a rehydrated panel still
   *  groups 在用 by provider instead of silently falling back to a flat list. */
  channels: readonly ChannelUsageRow[]
  labels: Record<string, string>
}
let stagedModelDrafts: StagedModelDrafts | null = null

interface StagedProviderDrafts {
  rows: readonly ProviderPricingViewRow[]
  drafts: ReadonlyMap<string, ProviderDraft>
  baseline: ReadonlyMap<string, string>
  aliases: ReadonlyMap<string, string>
  /** Signature of the loaded aliases, for the staged-alias dirty check. */
  aliasBaseline: string
  /** Every route the tab can offer in the alias / override pickers. */
  names: readonly string[]
  /** Every model id the base table knows, offered by the 跟随官方价 field. */
  modelNames: readonly string[]
}
let stagedProviderDrafts: StagedProviderDrafts | null = null

/** Which editing surface the tab shows. */
type PricingMode = 'model' | 'provider'

/** Which slice of the model list the toolbar narrows to. `null` = 全部 (the
 *  grouped view: hand prices / ledger-unpriced / cloud reference). */
export type ModelScope = 'used' | 'unpriced' | null

const BLANK_RATES: DraftRates = { input: '', output: '', cacheRead: '', cacheWrite: '' }

/** The `endTime` sentinel meaning "open-ended" (mirrors `pricing.ts`). */
const OPEN_END = Number.MAX_SAFE_INTEGER

const FIELD_LABELS = { input: '输入', output: '输出', cacheRead: '缓存读', cacheWrite: '缓存写' } as const
const FIELD_ORDER: ReadonlyArray<keyof DraftRates> = ['input', 'cacheRead', 'cacheWrite', 'output']
const WEEKDAY_LABELS: ReadonlyArray<[number, string]> = [[1, '一'], [2, '二'], [3, '三'], [4, '四'], [5, '五'], [6, '六'], [7, '日']]

let uidCounter = 0
const nextId = (): string => `d${++uidCounter}`

// ---------------------------------------------------------------------------
// Formatting + parsing helpers
// ---------------------------------------------------------------------------

/** Render a rate (¥/M) compactly: drop trailing zeros, show at most 4 decimals. */
function fmtRate(value: number | undefined): string {
  if (value === undefined) return '—'
  return String(Math.round(value * 10000) / 10000)
}

/** Parse one staged rate cell: empty → undefined (field omitted); else a
 *  non-negative finite number, or NaN for a validation error. */
function parseRate(value: string): number | undefined | typeof NaN {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return NaN
  return n
}

/** 'YYYY-MM-DD' → local-midnight epoch seconds; null when not a real date. */
function dateStartSec(value: string): number | null {
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
function dateEndSec(value: string): number | null {
  const start = dateStartSec(value)
  return start === null ? null : start + 86399
}

/** Epoch seconds → local `YYYY-MM-DD`. */
function secToDate(sec: number): string {
  const date = new Date(sec * 1000)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 'HH:MM' → minute of day 0–1440; null when malformed. */
function clockToMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (match === null) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 24 || minute > 59) return null
  const total = hour * 60 + minute
  return total > 1440 ? null : total
}

/** Minute of day → 'HH:MM'. */
function minuteToClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Render a rule/window span for display. */
function spanText(from: number, to: number): string {
  const start = from === 0 ? '自始' : secToDate(from)
  const end = to >= OPEN_END ? '永久' : secToDate(to)
  return `${start} → ${end}`
}

/** The window start of a staged rule in epoch seconds (empty date = 自始). */
function ruleStartSec(rule: DraftRule): number {
  return rule.from.trim() === '' ? 0 : dateStartSec(rule.from) ?? 0
}

/** The window end of a staged rule in epoch seconds (empty date = 永久). */
function ruleEndSec(rule: DraftRule): number {
  return rule.to.trim() === '' ? OPEN_END : dateEndSec(rule.to) ?? 0
}

// ---------------------------------------------------------------------------
// Draft ↔ wire conversion
// ---------------------------------------------------------------------------

function ratesToDraft(rate: ModelPricing | undefined): DraftRates {
  if (rate === undefined) return { ...BLANK_RATES }
  return {
    input: String(rate.inputPerMillion),
    output: String(rate.outputPerMillion),
    cacheRead: rate.cacheReadPerMillion !== undefined ? String(rate.cacheReadPerMillion) : '',
    cacheWrite: rate.cacheWritePerMillion !== undefined ? String(rate.cacheWritePerMillion) : '',
  }
}

function slotsToDraft(slots: DailySlot[] | undefined): DraftSlot[] {
  return (slots ?? []).map(slot => ({
    id: nextId(),
    label: slot.label ?? '',
    days: [...(slot.daysOfWeek ?? [])],
    windows: slot.windows.map(window => ({ start: minuteToClock(window.startMinute), end: minuteToClock(window.endMinute) })),
    rates: ratesToDraft(slot.rates),
  }))
}

function rulesToDraft(rules: TimeRule[] | undefined): DraftRule[] {
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

function draftOf(rules: ModelRates | undefined): ManualDraft {
  if (rules === undefined) return { base: { ...BLANK_RATES }, rules: [], slots: [] }
  return { base: ratesToDraft(rules.base), rules: rulesToDraft(rules.timeRules), slots: slotsToDraft(rules.dailySlots) }
}

/** Compose a staged slate into a wire rate object; null when input/output are
 *  missing or invalid (the save validation reports which row). */
function composeRates(draft: DraftRates): ModelPricing | null {
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

function composeSlots(slots: readonly DraftSlot[]): DailySlot[] {
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
function composeRules(rules: readonly DraftRule[]): Array<Record<string, unknown>> {
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
function draftToRates(draft: ManualDraft): ModelRates {
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

/** The COMPLETE desired hand table (whole-file PUT semantics). */
function composeTable(rows: readonly EditableRow[]): Record<string, unknown> {
  const table: Record<string, unknown> = {}
  for (const row of rows) {
    if (!row.manual) continue
    const entry = composeEntry(row.draft)
    if (entry !== null) table[row.model] = entry
  }
  return table
}

/** How one row's staged state differs from the view it was loaded from. */
type RowStatus = 'clean' | 'unsaved' | 'pending-delete'

/** Signature of ONE staged hand draft, so a row can answer "am I unsaved?" on
 *  its own. It includes INVALID staged values (unlike the composed table, which
 *  drops them), so an incomplete row still counts as unsaved and one 保存 press
 *  surfaces the validation error instead of leaving a disabled button. */
function rowSignature(row: EditableRow): string {
  return JSON.stringify(row.draft)
}

/** Per-model baseline signatures of the loaded/saved view. A map rather than
 *  one whole-table string: row order never counts as an edit, and every row
 *  carries its own dirty state instead of sharing one global flag. */
function modelBaseline(rows: readonly EditableRow[]): ReadonlyMap<string, string> {
  return new Map(rows.filter(row => row.manual).map(row => [row.model, rowSignature(row)]))
}

/** One row's staged state. An edited hand price is 未保存; a row whose baseline
 *  hand price is staged for deletion (the user went back to 云端/价格未知) is
 *  待删除 — a staged deletion must be as visible as a staged edit. */
function rowStatus(row: EditableRow, baseline: ReadonlyMap<string, string>): RowStatus {
  const saved = baseline.get(row.model)
  if (row.manual) return saved === rowSignature(row) ? 'clean' : 'unsaved'
  return saved === undefined ? 'clean' : 'pending-delete'
}

/** The per-row staged marker, shown in the row header so an unsaved change is
 *  visible without expanding the row. */
function StagedTag({ staged }: { staged: RowStatus }) {
  if (staged === 'clean') return null
  return (
    <span
      className="dtpl-pricing-model-tag dtpl-pricing-model-tag-staged"
      title={staged === 'pending-delete' ? '保存后这条手工价会被删除' : '这条改动还没有保存'}
    >
      {staged === 'pending-delete' ? '待删除' : '未保存'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Staged-rule validation + live "price now"
// ---------------------------------------------------------------------------

function validateRates(rates: DraftRates, where: string): string | null {
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

function validateDraft(row: EditableRow): string | null {
  const baseError = validateRates(row.draft.base, `「${row.model}」的基础价`)
  if (baseError !== null) return baseError
  const spans: Array<{ index: number; from: number; to: number }> = []
  for (const [index, rule] of row.draft.rules.entries()) {
    const where = `「${row.model}」第 ${String(index + 1)} 个调价段`
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
        return `「${row.model}」第 ${String(a.index + 1)} 与第 ${String(b.index + 1)} 个调价段重叠（${spanText(a.from, a.to)} / ${spanText(b.from, b.to)}）；同一时刻只能有一段价`
      }
    }
  }
  return validateSlots(row.draft.slots, `「${row.model}」`)
}

/** The price one STAGED rule set applies right now — live feedback while the
 *  user edits, mirroring the host chain for the tier-free hand layer
 *  (time rule first, then its peak windows, else the base and its windows). */
function draftNow(draft: ManualDraft, at: Date = new Date()): PricingNow | null {
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

/** Row state from a wire row: a hand row pre-fills its own rule set, a
 *  cloud/unpriced row starts blank (editing begins when the user asks). */
function rowOf(view: PricingViewRow): EditableRow {
  return {
    model: view.model,
    origin: view,
    manual: view.manual,
    draft: view.manual ? draftOf(view.manualRules) : { base: { ...BLANK_RATES }, rules: [], slots: [] },
    open: false,
  }
}

/** Every price-window / peak-window label a row currently carries (staged
 *  draft for a hand row, loaded rules otherwise) — what the search matches
 *  besides the model string. */
function ruleLabelsOf(row: EditableRow): string[] {
  const labels: string[] = []
  if (row.manual) {
    for (const rule of row.draft.rules) {
      if (rule.label.trim() !== '') labels.push(rule.label.trim())
      for (const slot of rule.slots) if (slot.label.trim() !== '') labels.push(slot.label.trim())
    }
    for (const slot of row.draft.slots) if (slot.label.trim() !== '') labels.push(slot.label.trim())
    return labels
  }
  const rules = row.origin.manualRules ?? row.origin.cloudRules
  if (rules === undefined) return labels
  for (const rule of rules.timeRules) {
    if (rule.label !== undefined) labels.push(rule.label)
    for (const slot of rule.dailySlots ?? []) if (slot.label !== undefined) labels.push(slot.label)
  }
  for (const slot of rules.dailySlots) if (slot.label !== undefined) labels.push(slot.label)
  return labels
}

// ---------------------------------------------------------------------------
// The 价格表 tab shell
// ---------------------------------------------------------------------------

/**
 * The 价格表 tab shell: a segmented switch between the model layer and the
 * provider overlay. Both sub-panels stay mounted (hidden, not unmounted) so
 * switching modes never discards staged-but-unsaved edits.
 *
 * A model row that is priced by the provider overlay cannot be edited in the
 * model layer, so its action switches to this surface and opens that exact
 * override — the user never has to work out which layer to edit.
 */
export function PricingPanel({ onChanged, onDirtyChange, focusScope, onFocusScopeHandled }: PricingPanelProps) {
  const [mode, setMode] = useState<PricingMode>('model')
  const [providerFocus, setProviderFocus] = useState<{ provider: string; model: string } | null>(null)
  const [modelDirty, setModelDirty] = useState(false)
  const [providerDirty, setProviderDirty] = useState(false)

  // The tab dot must reflect BOTH surfaces, and it must survive unmount (the
  // drafts do), so the flag is pushed up to the shared store instead of being
  // cleared here.
  useEffect(() => {
    onDirtyChange?.(modelDirty || providerDirty)
  }, [modelDirty, providerDirty, onDirtyChange])

  return (
    <section className="dtpl-pricing-sec" aria-label="价格表">
      <div className="dtpl-pricing-modes" role="group" aria-label="价格表视图">
        <button
          type="button"
          className={`dtpl-pricing-mode${mode === 'model' ? ' dtpl-pricing-mode-active' : ''}`}
          aria-pressed={mode === 'model'}
          onClick={() => setMode('model')}
        >
          模型价
        </button>
        <button
          type="button"
          className={`dtpl-pricing-mode${mode === 'provider' ? ' dtpl-pricing-mode-active' : ''}`}
          aria-pressed={mode === 'provider'}
          onClick={() => setMode('provider')}
        >
          通道覆盖层
        </button>
      </div>

      <div hidden={mode !== 'model'} className="dtpl-pricing-pane">
        <ModelPriceEditor
          onChanged={onChanged}
          active={mode === 'model'}
          onDirtyChange={setModelDirty}
          focusScope={focusScope ?? null}
          onFocusScopeHandled={onFocusScopeHandled}
          onOpenProvider={(provider, model) => { setProviderFocus({ provider, model }); setMode('provider') }}
        />
      </div>
      <div hidden={mode !== 'provider'} className="dtpl-pricing-pane">
        <ProviderOverlayEditor
          onChanged={onChanged}
          active={mode === 'provider'}
          onDirtyChange={setProviderDirty}
          focus={providerFocus}
          onFocusHandled={() => setProviderFocus(null)}
        />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 模型价 surface
// ---------------------------------------------------------------------------

/**
 * 模型价 surface: the per-model table. Hand rows are edited in place (inline
 * four rates = the base slate, expanded body = the price timeline and peak
 * windows); ledger-billed rows with no model-layer entry sit right under them;
 * the cloud mirror is folded behind a fold bar and, once opened, lives in a
 * bounded scroll region with a sticky column header so hundreds of reference
 * rows never stretch the whole dialog.
 *
 * Every row states the price in force NOW. The four cells show the base slate
 * for a hand row (what the user edits) and the effective price for a read-only
 * row; when a timeline window or peak window decides the price, the model cell
 * carries a `当前` line naming it.
 */
function ModelPriceEditor({ onChanged, active, onDirtyChange, focusScope, onFocusScopeHandled, onOpenProvider }: {
  onChanged: () => void
  active: boolean
  onDirtyChange: (dirty: boolean) => void
  focusScope: ModelScope
  onFocusScopeHandled?: () => void
  onOpenProvider: (provider: string, model: string) => void
}) {
  const [rows, setRows] = useState<readonly EditableRow[] | null>(() => stagedModelDrafts?.rows ?? null)
  const [baseline, setBaseline] = useState<ReadonlyMap<string, string>>(() => stagedModelDrafts?.baseline ?? new Map())
  // The channel lens of the 在用 view (one row per billed (provider, model)) and
  // the mirror's provider labels; both absent on an older host, which makes the
  // view fall back to the flat model list.
  const [channels, setChannels] = useState<readonly ChannelUsageRow[] | null>(() => stagedModelDrafts?.channels ?? null)
  const [labels, setLabels] = useState<Record<string, string>>(() => stagedModelDrafts?.labels ?? {})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [query, setQuery] = useState('')
  const [cloudOpen, setCloudOpen] = useState(false)
  // Which vendor groups of the cloud reference list are expanded. Groups start
  // collapsed (the list is a browse-only reference of ~185 rows); a search
  // expands every group that still has matches.
  const [openFamilies, setOpenFamilies] = useState<ReadonlySet<string>>(() => new Set())
  // The default view answers the tab's main question: what do the models the
  // ledger actually billed cost right now?
  const [scope, setScope] = useState<ModelScope>('used')
  // One row is editable at a time (the same interaction the provider surface
  // uses): the default state of a hand row is a READ-only summary, so looking
  // at prices never means staring at input boxes.
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [flashModel, setFlashModel] = useState<string | null>(null)
  // Which provider route the flash should land on, when the 在用 view renders
  // the same model string under several routes.
  const [flashProvider, setFlashProvider] = useState<string | null>(null)
  const activeRef = useRef(0)
  const errorRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef<readonly EditableRow[] | null>(rows)
  useEffect(() => { rowsRef.current = rows }, [rows])

  // A refused save must not look like a no-op: bring the reason into view.
  // Deliberately instant (not smooth): the scroll has to survive the same
  // commit that renders the error.
  useEffect(() => {
    if (error !== null) errorRef.current?.scrollIntoView({ block: 'center' })
  }, [error])

  // After a row is promoted (去定价 / 自定义 / 新增), follow it so the user does
  // not lose their place, and flash it once.
  useEffect(() => {
    if (flashModel === null) return
    const target = [...document.querySelectorAll<HTMLElement>('.dtpl-pricing-item')]
      .find(element => element.dataset.pricingModel === flashModel
        && (flashProvider === null || element.dataset.pricingProvider === flashProvider))
    target?.scrollIntoView({ block: 'center' })
    const timer = window.setTimeout(() => { setFlashModel(null); setFlashProvider(null) }, 1500)
    return () => { window.clearTimeout(timer) }
  }, [flashModel, flashProvider])

  const applyView = useCallback((view: PricingView) => {
    // Keep the rows the user had expanded across a save: a refresh must not
    // collapse the editor they are working in. Read the open set from a ref so
    // the new rows and the baseline stay one identical array.
    const openModels = new Set((rowsRef.current ?? []).filter(row => row.open).map(row => row.model))
    const next = view.rows.map(row => ({ ...rowOf(row), open: openModels.has(row.model) }))
    setRows(next)
    setBaseline(modelBaseline(next))
    setChannels(view.channelRows ?? null)
    setLabels(view.providerLabels ?? {})
  }, [])

  const load = useCallback(async () => {
    const token = ++activeRef.current
    setError(null)
    try {
      const res = await fetch('/tokbook/pricing')
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`)
      const view = await res.json() as PricingView
      if (token !== activeRef.current) return
      applyView(view)
    } catch (err) {
      if (token !== activeRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [applyView])

  useEffect(() => {
    // A rehydrated dirty draft is authoritative until the user saves/discards.
    if (stagedModelDrafts !== null) return
    void load()
    return () => { activeRef.current += 1 }
  }, [load])

  const updateRow = useCallback((model: string, patch: (row: EditableRow) => EditableRow) => {
    setRows(current => current === null ? current : current.map(row => row.model === model ? patch(row) : row))
  }, [])

  const patchDraft = useCallback((model: string, patch: (draft: ManualDraft) => ManualDraft) => {
    updateRow(model, row => ({ ...row, draft: patch(row.draft) }))
  }, [updateRow])

  const customize = useCallback((model: string) => {
    updateRow(model, row => ({
      ...row,
      manual: true,
      open: true,
      draft: draftOf(row.origin.manualRules ?? row.origin.cloudRules),
    }))
    setEditingModel(model)
    setFlashProvider(null)
    setFlashModel(model)
  }, [updateRow])

  const revert = useCallback((model: string) => {
    updateRow(model, row => ({
      ...row,
      manual: false,
      open: false,
      draft: { base: { ...BLANK_RATES }, rules: [], slots: [] },
    }))
    setEditingModel(current => current === model ? null : current)
    setFlashProvider(null)
    setFlashModel(model)
  }, [updateRow])

  const toggleOpen = useCallback((model: string) => {
    updateRow(model, row => ({ ...row, open: !row.open }))
  }, [updateRow])

  /** Enter edit mode on one row (expanding it, since the rule editor lives in
   *  the detail area). */
  const startEdit = useCallback((model: string) => {
    setEditingModel(model)
    updateRow(model, row => row.open ? row : { ...row, open: true })
  }, [updateRow])

  const stopEdit = useCallback(() => setEditingModel(null), [])

  const addRow = useCallback((model: string) => {
    setRows(current => current === null ? current : [
      { model, origin: { model, manual: true }, manual: true, open: true, draft: { base: { ...BLANK_RATES }, rules: [], slots: [] } },
      ...current,
    ])
    // A brand-new model has no ledger records, so a narrowed scope would hide
    // it right after adding: widen to 全部.
    setScope(current => current === 'used' || current === 'unpriced' ? null : current)
    setEditingModel(model)
    setFlashProvider(null)
    setFlashModel(model)
  }, [])

  const dirty = rows !== null && rows.some(row => rowStatus(row, baseline) !== 'clean')

  // Cache only dirty state; a clean view is re-fetched on the next mount.
  useEffect(() => {
    stagedModelDrafts = dirty && rows !== null
      ? { rows, baseline, channels: channels ?? [], labels }
      : null
    onDirtyChange(dirty)
  }, [rows, baseline, channels, labels, dirty, onDirtyChange])

  // A cross-tab jump (价格未知 note) narrows this surface once, then clears.
  useEffect(() => {
    if (focusScope === null || focusScope === undefined) return
    setScope(focusScope)
    onFocusScopeHandled?.()
  }, [focusScope, onFocusScopeHandled])

  const save = useCallback(async () => {
    if (rows === null) return
    // Validate every staged hand row first; the whole save is refused on the
    // first bad value so the user fixes the visible row (host-side validation
    // re-runs regardless — this is only for immediate feedback).
    for (const row of rows) {
      if (!row.manual) continue
      const problem = validateDraft(row)
      if (problem !== null) {
        setError(problem)
        updateRow(row.model, current => ({ ...current, open: true }))
        setEditingModel(row.model)
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/tokbook/pricing', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(composeTable(rows)),
      })
      const payload = await res.json().catch(() => null) as { ok?: boolean; error?: string; view?: PricingView } | null
      if (!res.ok || payload === null || payload.ok !== true) {
        const message = payload?.error !== undefined && payload.error !== '' ? payload.error : `HTTP ${String(res.status)}`
        throw new Error(message)
      }
      if (payload.view !== undefined) applyView(payload.view)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1600)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [rows, onChanged, applyView, updateRow])

  // Ctrl/Cmd+S saves while this pane is the visible one (both panes stay
  // mounted, so the hidden one must not steal the shortcut).
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      if (!saving && dirty) void save()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, saving, dirty, save])

  // 在用 is a FILTER over the whole table, not a mutually exclusive group: the
  // models the ledger billed are the tab's main subject, and a row must not
  // vanish from that view just because the user gave it a hand price. 全部 keeps
  // the grouped layout (手工价 / 价格未知 / 云端基准表).
  const manualRows = useMemo(() => rows === null ? [] : rows.filter(row => row.manual), [rows])
  const unpricedRows = useMemo(() => rows === null ? [] : rows.filter(row => !row.manual && row.origin.unpriced === true), [rows])
  const cloudRows = useMemo(() => rows === null ? [] : rows.filter(row => !row.manual && row.origin.unpriced !== true), [rows])
  const usedCount = useMemo(() => rows === null ? 0 : rows.filter(row => (row.origin.records ?? 0) > 0).length, [rows])

  const q = query.trim().toLowerCase()
  const inScope = (row: EditableRow): boolean => {
    switch (scope) {
      case 'used': return (row.origin.records ?? 0) > 0
      case 'unpriced': return !row.manual && row.origin.unpriced === true
      default: return true
    }
  }
  const matchQ = (row: EditableRow): boolean => {
    if (q === '') return true
    if (row.model.toLowerCase().includes(q)) return true
    // Searching a rule/slot label is how a user finds "限时5折" or "工作日高峰".
    return ruleLabelsOf(row).some(label => label.toLowerCase().includes(q))
  }
  const scoped = useMemo(() => (rows ?? []).filter(row => inScope(row) && matchQ(row)), [rows, scope, q])
  // Most-used first: the flat 在用 list is read top-down.
  const usedList = useMemo(() => scope !== 'used' ? [] : [...scoped].sort((a, b) => (b.origin.records ?? 0) - (a.origin.records ?? 0)), [scope, scoped])
  const manualVisible = scoped.filter(row => row.manual)
  const unpricedVisible = scoped.filter(row => !row.manual && row.origin.unpriced === true)
  const cloudVisible = scoped.filter(row => !row.manual && row.origin.unpriced !== true)
  // The cloud reference list is grouped by the feed's vendor/family: the flat
  // ~185-row dump was this tab's least scannable surface. Strings the feed does
  // not name (e.g. overlay-priced aggregator strings) fall into 未标注厂商, last
  // — deliberately not 其他, which is a real `family` value in the feed.
  const cloudGroups = groupByFamily(cloudVisible)
  // The bounded scroll exists only for the 全部 view's browsing of hundreds of
  // reference rows; a narrowed view is small and stays in the page flow.
  const cloudBounded = scope === null
  const cloudShown = cloudRows.length > 0 && cloudBounded
  const cloudPaneOpen = cloudBounded ? (cloudOpen || q !== '') : true
  const showOuterHeader = scope === 'used' ? usedList.length > 0 : manualVisible.length > 0 || unpricedVisible.length > 0
  const hasFilter = q !== '' || scope !== null
  const nothingVisible = scoped.length === 0

  const nowSec = Math.floor(Date.now() / 1000)
  const rowsByModel = useMemo(() => new Map((rows ?? []).map(row => [row.model, row])), [rows])

  // 在用's channel lens: one entry per billed (provider, model) route.
  const channelsOfModel = useMemo(() => {
    const map = new Map<string, ChannelUsageRow[]>()
    for (const row of channels ?? []) {
      const list = map.get(row.model)
      if (list === undefined) map.set(row.model, [row])
      else list.push(row)
    }
    return map
  }, [channels])

  /** The route whose row carries the EDITABLE price for a model string. The
   *  model-layer price is global (one entry per string), so a string billed by
   *  several routes must not offer an editor in each of them: prefer a route
   *  that actually spends money (`metered`), then the one with the most
   *  records, then the route key — a deterministic choice the user can see. */
  const canonicalRoute = (model: string): string => {
    const group = channelsOfModel.get(model) ?? []
    const metered = group.filter(row => row.billing === 'metered')
    const pool = metered.length > 0 ? metered : group
    return [...pool].sort((a, b) => b.records - a.records || a.provider.localeCompare(b.provider))[0]?.provider ?? ''
  }

  const jumpToChannel = (model: string, provider: string): void => {
    setFlashProvider(provider)
    setFlashModel(model)
  }

  // One renderer for every model list (在用 / 手工价 / 价格未知 / 云端厂商分组):
  // the props are identical, only the React key prefix differs. `provider`
  // marks the row as a channel row of the 在用 view (it disambiguates the same
  // model string rendered under several routes).
  const renderRow = (row: EditableRow, prefix: string, opts?: { provider?: string; sharedRoutes?: readonly string[] }) => (
    <ModelRow
      key={`${prefix}:${row.model}`}
      row={row}
      nowSec={nowSec}
      flash={flashModel === row.model && (flashProvider === null || opts?.provider === flashProvider)}
      staged={rowStatus(row, baseline)}
      editing={editingModel === row.model}
      {...(opts?.provider !== undefined ? { dataProvider: opts.provider } : {})}
      {...(opts?.sharedRoutes !== undefined ? { sharedRoutes: opts.sharedRoutes } : {})}
      onEdit={() => startEdit(row.model)}
      onDone={stopEdit}
      onToggle={() => toggleOpen(row.model)}
      onPatchDraft={patch => patchDraft(row.model, patch)}
      onRevert={() => revert(row.model)}
      onCustomize={() => customize(row.model)}
      onOpenProvider={() => onOpenProvider(row.origin.provider ?? '', row.model)}
    />
  )

  // The 在用 view grouped by billing channel. Null when the host predates the
  // channel lens (or the ledger has nothing in use) — the view then stays flat.
  const usedGroups = scope !== 'used' || channels === null || channels.length === 0
    ? null
    : groupByProvider(usedList.flatMap(row => channelsOfModel.get(row.model) ?? []))

  return (
    <div className="dtpl-pricing-model-view">
      <p className="dtpl-pricing-intro">
        金额按本机价格表逐条计价：<b>你手工写的价优先</b>，云端基准表只作参考。展开一行看它
        现在生效的价与时段；点「编辑」可以改四档单价，并加<b>限时/长期降价</b>与
        <b>高峰时段</b>。保存后全部历史按新价重算。
      </p>

      {error !== null && (
        <div className="dtpl-error" role="alert" ref={errorRef}>
          <p className="dtpl-error-text">{error}</p>
          <button type="button" className="dtpl-retry" onClick={() => setError(null)}>忽略</button>
        </div>
      )}

      {/* Toolbar: scope chips with live counts + a search input. */}
      <div className="dtpl-pricing-bar">
        <div className="dtpl-pricing-scopes" role="group" aria-label="显示范围">
          <button type="button" className="dtpl-pricing-scope" aria-pressed={scope === 'used'} onClick={() => setScope('used')}>
            在用<span className="dtpl-pricing-scope-count">{usedCount}</span>
          </button>
          <button type="button" className="dtpl-pricing-scope" aria-pressed={scope === 'unpriced'} onClick={() => setScope('unpriced')} title="账本记过这些串，但两表都不知道它们的价——暂按 ¥0 计，不是免费">
            价格未知<span className="dtpl-pricing-scope-count">{unpricedRows.length}</span>
          </button>
          <button type="button" className="dtpl-pricing-scope" aria-pressed={scope === null} onClick={() => setScope(null)}>
            全部<span className="dtpl-pricing-scope-count">{rows?.length ?? 0}</span>
          </button>
          {(q !== '' || scope === 'unpriced') && (
            <button type="button" className="dtpl-pricing-scope-reset" onClick={() => { setQuery(''); setScope('used'); setCloudOpen(false) }}>
              清除筛选
            </button>
          )}
        </div>
        <div className="dtpl-pricing-filter" role="search">
          <input
            className="dtpl-pricing-search"
            type="search"
            placeholder="搜索模型名…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="搜索模型名"
          />
        </div>
      </div>

      {rows === null ? (
        <div className="dtpl-pricing-skeleton dtpl-sk" />
      ) : (
        <>
          {showOuterHeader && (
            <div className="dtpl-pricing-col-header" aria-hidden="true">
              <span>模型 · 当前生效价</span>
              <span className="dtpl-pricing-rates">
                <span>输入</span>
                <span>缓存读</span>
                <span>缓存写</span>
                <span>输出</span>
              </span>
              <span className="dtpl-pricing-col-actions">操作</span>
            </div>
          )}

          <div className="dtpl-pricing-list">
            {scope === 'used' ? (
              /* ── the flat "in use" list: one row per model the ledger billed,
                    whatever layer prices it, so nothing moves between groups
                    when the user edits it ── */
              <>
                {usedList.length === 0 ? (
                  <p className="dtpl-pricing-empty">
                    {q !== '' ? `没有匹配「${query}」的在用模型。` : '账本还没有记过模型用量。'}
                    <button type="button" className="dtpl-pricing-empty-link" onClick={() => { setQuery(''); setScope(null) }}>浏览全部价表</button>
                  </p>
                ) : usedGroups === null ? (
                  // An older host does not send the channel lens: stay flat.
                  usedList.map(row => renderRow(row, 'u'))
                ) : (
                  <div className="dtpl-pricing-chan-groups">
                    {usedGroups.map(([provider, group]) => {
                      const records = group.reduce((sum, row) => sum + row.records, 0)
                      const billing = group[0]?.billing ?? 'metered'
                      // A channel nothing prices is not "实际支出" — say 价格未知
                      // instead of claiming a spend bucket it cannot fill.
                      const allUnpriced = group.every(row => row.unpriced === true)
                      const name = provider === '' ? '(未知)' : labels[provider] ?? provider
                      return (
                        <section className="dtpl-pricing-chan-group" key={provider} data-provider={provider}>
                          <div className="dtpl-pricing-chan-head">
                            <span className="dtpl-pricing-chan-name">{name}</span>
                            {labels[provider] !== undefined && provider !== '' && (
                              <span className="dtpl-pricing-chan-route">{provider}</span>
                            )}
                            <span className={`dtpl-pricing-chan-billing dtpl-pricing-chan-billing-${allUnpriced ? 'unpriced' : billing}`}>
                              {allUnpriced ? '价格未知' : billing === 'subscription' ? '订阅价值' : '实际支出'}
                            </span>
                            <span className="dtpl-pricing-chan-meta">{group.length} 个模型 · {records} 条</span>
                          </div>
                          <div className="dtpl-pricing-chan-rows">
                            {group.map((channel) => {
                              const modelRow = rowsByModel.get(channel.model)
                              if (modelRow === undefined) return null
                              const shared = channelsOfModel.get(channel.model) ?? []
                              const canonical = canonicalRoute(channel.model)
                              if (channel.provider === canonical) {
                                return renderRow(modelRow, `u-${provider}`, {
                                  provider,
                                  ...(shared.length > 1
                                    ? { sharedRoutes: shared.filter(row => row.provider !== provider).map(row => row.provider) }
                                    : {}),
                                })
                              }
                              return (
                                <SharedChannelRow
                                  key={`s:${provider}:${channel.model}`}
                                  channel={channel}
                                  source={channelSourceTag(channel, modelRow)}
                                  canonicalRoute={canonical}
                                  onJump={() => jumpToChannel(channel.model, canonical)}
                                />
                              )
                            })}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}
                <AddRow onAdd={addRow} />
              </>
            ) : (
              <>
                {/* ── hand overrides: edited in place ── */}
                {manualRows.length > 0 && (
                  <SectionHead title="手工价" count={manualRows.length} shown={manualVisible.length} tone="accent" hint="本机覆盖，保存后生效" />
                )}
                {manualVisible.map(row => renderRow(row, 'm'))}
                {scope === null && manualRows.length === 0 && (
                  <p className="dtpl-pricing-empty">还没有手工价。在「在用 / 价格未知」里点「自定义 / 去定价」，或在下方输入模型串新增。</p>
                )}

                {/* ── 新增模型 entry: starts an empty hand row. ── */}
                {scope !== 'unpriced' && <AddRow onAdd={addRow} />}

                {/* ── ledger-billed, no model-layer entry, currently ¥0 ── */}
                {unpricedRows.length > 0 && (
                  <SectionHead title="价格未知" count={unpricedRows.length} shown={unpricedVisible.length} tone="warn" hint="不知价，暂按 ¥0 计；点「去定价」设置手工价" />
                )}
                {unpricedVisible.map(row => renderRow(row, 'p'))}
                {scope === 'unpriced' && unpricedVisible.length === 0 && (
                  <p className="dtpl-pricing-empty">没有价格未知的账本模型。</p>
                )}

                {/* ── cloud mirror (folded, bounded scroll) ── */}
                {cloudShown && (
                  <div className="dtpl-pricing-cloud">
                    <button
                      type="button"
                      className="dtpl-pricing-cloud-bar"
                      aria-expanded={cloudPaneOpen}
                      onClick={() => {
                        if (scope === null && q === '') setCloudOpen(open => !open)
                      }}
                    >
                      <span className="dtpl-pricing-cloud-bar-title">
                        云端基准价表
                        <span className="dtpl-pricing-cloud-bar-count">{q === '' ? cloudRows.length : cloudVisible.length}</span>
                      </span>
                      <span className="dtpl-pricing-cloud-bar-cue">{cloudPaneOpen ? '收起' : '展开浏览'}</span>
                    </button>

                    {cloudPaneOpen && (
                      <div className="dtpl-pricing-cloud-scroll">
                        <div className="dtpl-pricing-col-header dtpl-pricing-col-header-sticky" aria-hidden="true">
                          <span>模型 · 当前生效价</span>
                          <span className="dtpl-pricing-rates">
                            <span>输入</span>
                            <span>缓存读</span>
                            <span>缓存写</span>
                            <span>输出</span>
                          </span>
                          <span className="dtpl-pricing-col-actions">操作</span>
                        </div>
                        {cloudVisible.length === 0 ? (
                          <p className="dtpl-pricing-empty">{q !== '' ? `没有匹配「${query}」的云端模型。` : '没有符合条件的模型。'}</p>
                        ) : cloudGroups.map(([family, list]) => {
                          const key = family === '' ? '__other__' : family
                          // A search expands every group that still has matches.
                          const open = q !== '' || openFamilies.has(key)
                          return (
                            <section className="dtpl-pricing-family-group" key={key} data-family={key}>
                              <button
                                type="button"
                                className="dtpl-pricing-family-head"
                                aria-expanded={open}
                                aria-controls={`dtpl-fam-${cssId(key)}`}
                                onClick={() => setOpenFamilies(current => {
                                  const next = new Set(current)
                                  if (next.has(key)) next.delete(key)
                                  else next.add(key)
                                  return next
                                })}
                              >
                                <span className="dtpl-pricing-family-head-name">{family === '' ? '未标注厂商' : family}</span>
                                <span className="dtpl-pricing-family-head-meta">{list.length} 个模型</span>
                                <span className="dtpl-pricing-family-head-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                              </button>
                              {open && (
                                <div className="dtpl-pricing-family-rows" id={`dtpl-fam-${cssId(key)}`}>
                                  {list.map(row => renderRow(row, 'c'))}
                                </div>
                              )}
                            </section>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── global empty states ── */}
            {rows.length === 0 && (
              <p className="dtpl-pricing-empty">价格表为空（云端镜像可能尚未同步成功）。可以用下方输入框手工添加模型。</p>
            )}
            {rows.length > 0 && hasFilter && nothingVisible && scope !== 'used' && (
              <p className="dtpl-pricing-empty">没有匹配「{query}」的模型。<button type="button" className="dtpl-pricing-empty-link" onClick={() => { setQuery(''); setScope('used') }}>清除筛选</button></p>
            )}
          </div>
        </>
      )}

      <div className="dtpl-pricing-foot">
        <span className={`dtpl-pricing-save-state${savedFlash ? ' dtpl-pricing-saved' : ''}`}>{savedFlash ? '已保存' : ''}</span>
        {dirty && (
          <button type="button" className="dtpl-pricing-btn" onClick={() => void load()} disabled={saving}>放弃修改</button>
        )}
        <button
          type="button"
          className="dtpl-pricing-save"
          onClick={() => void save()}
          disabled={saving || rows === null || !dirty}
        >
          {saving ? '保存中…' : manualRows.length > 0 ? `保存 ${String(manualRows.length)} 条手工价` : '保存手工价'}
        </button>
      </div>
    </div>
  )
}

/** A section header for one model group: label + total count, plus a subtle
 *  hint of how many rows are actually shown after filtering. */
function SectionHead({ title, count, shown, tone, hint }: {
  title: string
  count: number
  shown: number
  tone: 'accent' | 'warn' | 'neutral'
  hint: string
}) {
  return (
    <div className={`dtpl-pricing-sec-head dtpl-pricing-sec-head-${tone}`}>
      <span className="dtpl-pricing-sec-title">{title}</span>
      <span className="dtpl-pricing-sec-count">{count}</span>
      <span className="dtpl-pricing-sec-hint">{shown !== count ? `显示 ${String(shown)} 条 · ` : ''}{hint}</span>
    </div>
  )
}

/**
 * One channel row of the 在用 view that is NOT the editable row for its model
 * string. The price shown is this channel's own resolved price, but the entry
 * the user can edit is the model-layer one — global, one per string — so the
 * row is read-only, carries the 全局价 chip, and points at the route that holds
 * the editor.
 */
function SharedChannelRow({ channel, source, canonicalRoute, onJump }: {
  channel: ChannelUsageRow
  source: string
  canonicalRoute: string
  onJump: () => void
}) {
  const now = channel.now
  const value = (field: keyof DraftRates): string => fmtRate(
    field === 'input' ? now?.rates.inputPerMillion
      : field === 'output' ? now?.rates.outputPerMillion
        : field === 'cacheRead' ? now?.rates.cacheReadPerMillion
          : now?.rates.cacheWritePerMillion,
  )
  return (
    <div
      className="dtpl-pricing-item dtpl-pricing-item-shared"
      data-pricing-model={channel.model}
      data-pricing-provider={channel.provider}
    >
      <div className={`dtpl-pricing-row${channel.unpriced === true ? ' dtpl-pricing-row-unpriced' : ''}`}>
        <div className="dtpl-pricing-model">
          <span className="dtpl-pricing-model-head">
            <span className="dtpl-pricing-model-name" title={channel.model}>{channel.model}</span>
            <span className="dtpl-pricing-model-tag">{source}</span>
            <span
              className="dtpl-pricing-global-chip"
              title={`模型层价是全局的：这条串由 ${canonicalRoute} 下的那一行编辑，改动对所有通道生效`}
            >全局价</span>
            <span className="dtpl-pricing-used" title={`账本记过 ${String(channel.records)} 条`}>{channel.records} 条</span>
          </span>
        </div>
        <div className="dtpl-pricing-rates">
          {FIELD_ORDER.map(field => (
            <RateCell key={field} field={field} editing={false} value={value(field)} onChange={() => {}} />
          ))}
        </div>
        <div className="dtpl-pricing-actions">
          <button
            type="button"
            className="dtpl-pricing-btn dtpl-pricing-custom"
            onClick={onJump}
            title={`模型层价在 ${canonicalRoute} 下编辑（改动对所有通道生效）`}
          >改全局价</button>
        </div>
      </div>
    </div>
  )
}

/**
 * One model row plus, when expanded, its price timeline. A hand row is a
 * READ-ONLY summary until the user clicks 编辑 (one row at a time, the same
 * interaction the provider surface uses); then its four cells become inputs and
 * the detail area becomes the rule editor. The `当前` line appears whenever a
 * timeline window or peak window decides the price, so the base slate is never
 * mistaken for the billed rate.
 */
function ModelRow({ row, nowSec, flash, staged, editing, dataProvider, sharedRoutes, onToggle, onEdit, onDone, onPatchDraft, onRevert, onCustomize, onOpenProvider }: {
  row: EditableRow
  nowSec: number
  flash: boolean
  staged: RowStatus
  editing: boolean
  /** Set on the 在用 view's channel rows: which route this row belongs to, so a
   *  jump can land on the right one when the string is billed by several. */
  dataProvider?: string
  /** The OTHER routes billing this same string. Present when >1 route does:
   *  the model-layer price edited here applies to all of them. */
  sharedRoutes?: readonly string[]
  onToggle: () => void
  onEdit: () => void
  onDone: () => void
  onPatchDraft: (patch: (draft: ManualDraft) => ManualDraft) => void
  onRevert: () => void
  onCustomize: () => void
  onOpenProvider: () => void
}) {
  const origin = row.origin
  const savedNow = origin.now ?? null
  const live = row.manual ? draftNow(row.draft) : savedNow
  const editable = row.manual && editing
  const layered = row.manual
    ? row.draft.rules.length > 0 || row.draft.slots.length > 0
    : (origin.layered === true)
  const overlayPriced = origin.overlayPriced === true
  const tag = row.manual ? '手工价'
    : origin.unpriced === true ? `价格未知${origin.records !== undefined && origin.records > 0 ? ` · ${String(origin.records)} 条` : ''}`
      // Inside a channel group the route is the group's own header, so the tag
      // does not repeat it (that space goes to the model name instead).
      : overlayPriced ? `覆盖层定价${dataProvider === undefined && origin.provider !== undefined && origin.provider !== '' ? ` · ${origin.provider}` : ''}`
        : origin.layered === true ? '云端 · 分时' : '云端'
  // The base slate differs from the price in force → say which rule wins.
  const base = row.manual ? composeRates(row.draft.base) : origin.cloudRules?.base ?? null
  const usedRecords = origin.records
  // A hand row's cells edit the base slate, so the current price needs its own
  // line whenever a window/peak decides it; a read-only row already shows the
  // current price in its cells, so it only needs the winning window's name.
  let nowLine: ReactNode = null
  if (origin.unpriced !== true && live !== null
    && (base === null || live.rates.inputPerMillion !== base.inputPerMillion || live.rates.outputPerMillion !== base.outputPerMillion)) {
    nowLine = (
      <span className="dtpl-pricing-now">
        {row.manual
          ? <>当前生效 <b>入 ¥{fmtRate(live.rates.inputPerMillion)} · 出 ¥{fmtRate(live.rates.outputPerMillion)}</b>{live.label !== undefined ? ` · ${live.label}` : ''}{live.peak ? ' · 峰时' : ''}</>
          : <>当前生效 · {live.label ?? (live.peak ? '峰谷时段' : '调价时段')}{live.peak ? ' · 峰时' : ''}</>}
      </span>
    )
  }

  return (
    <div
      className={`dtpl-pricing-item${row.manual ? ' dtpl-pricing-item-manual' : ''}${flash ? ' dtpl-pricing-item-flash' : ''}`}
      data-pricing-model={row.model}
      {...(dataProvider !== undefined ? { 'data-pricing-provider': dataProvider } : {})}
    >
      <div className={`dtpl-pricing-row${row.manual ? ' dtpl-pricing-row-manual' : ''}${origin.unpriced === true ? ' dtpl-pricing-row-unpriced' : ''}${layered ? ' dtpl-pricing-row-layered' : ''}`}>
        <div className="dtpl-pricing-model">
          <span className="dtpl-pricing-model-head">
            <button
              type="button"
              className="dtpl-pricing-expand"
              aria-expanded={row.open}
              title={row.open ? '收起规则' : '展开价格时间轴'}
              onClick={onToggle}
            >
              {row.open ? '▾' : '▸'}
            </button>
            <span className="dtpl-pricing-model-name" title={row.model}>{row.model}</span>
            <span className="dtpl-pricing-model-tag">{tag}</span>
            {sharedRoutes !== undefined && sharedRoutes.length > 0 && (
              <span
                className="dtpl-pricing-global-chip"
                title={`模型层价是全局的：另有 ${sharedRoutes.join('、')} 也按这条串计费，在这里改价对所有通道生效`}
              >全局价 · 另 {sharedRoutes.length} 条通道</span>
            )}
            <StagedTag staged={staged} />
            {usedRecords !== undefined && usedRecords > 0 && !row.manual && origin.unpriced !== true && (
              <span className="dtpl-pricing-used" title={`账本记过 ${String(usedRecords)} 条`}>{usedRecords} 条</span>
            )}
          </span>
          {nowLine}
        </div>
        <div className="dtpl-pricing-rates">
          {FIELD_ORDER.map(field => (
            <RateCell
              key={field}
              field={field}
              editing={editable}
              value={row.manual ? row.draft.base[field] : fmtRate(field === 'input' ? savedNow?.rates.inputPerMillion : field === 'output' ? savedNow?.rates.outputPerMillion : field === 'cacheRead' ? savedNow?.rates.cacheReadPerMillion : savedNow?.rates.cacheWritePerMillion)}
              onChange={value => onPatchDraft(draft => ({ ...draft, base: { ...draft.base, [field]: value } }))}
            />
          ))}
        </div>
        <div className="dtpl-pricing-actions">
          {row.manual ? (
            editable
              ? <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={onDone}>完成</button>
              : <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={onEdit} title="编辑这条手工价：四档单价 + 限时降价 / 高峰时段">编辑</button>
          ) : origin.unpriced === true ? (
            <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={onCustomize} title="此模型账本有记录但价格未知，暂按 ¥0 计（不是免费）。点击为它设置手工价">去定价</button>
          ) : overlayPriced ? (
            // A model-layer entry for this string would never be read (the
            // overlay entry wins), so send the user to the override instead of
            // offering an edit that cannot take effect.
            <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={onOpenProvider} title="由通道覆盖层定价；点击跳到那条覆盖去编辑">去覆盖层</button>
          ) : (
            <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={onCustomize} title="以当前规则集为底稿新增手工价">自定义</button>
          )}
        </div>
      </div>

      {row.open && (
        <div className="dtpl-pricing-detail">
          {row.manual ? (
            editable ? (
              <>
                <DraftRulesEditor draft={row.draft} onPatch={onPatchDraft} />
                <div className="dtpl-pricing-detail-actions">
                  <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={onRevert} title="删除这条手工价，回到云端/价格未知">删除手工价</button>
                </div>
              </>
            ) : (
              <RuleTimeline
                rules={draftToRates(row.draft)}
                now={live}
                nowSec={nowSec}
                emptyHint="这条手工价只有一个价，没有限时降价或高峰时段。"
              />
            )
          ) : (
            <RuleTimeline
              rules={origin.manualRules ?? origin.cloudRules}
              now={savedNow}
              nowSec={nowSec}
              emptyHint={overlayPriced
                ? `这个模型串由通道覆盖层（${origin.provider !== undefined && origin.provider !== '' ? origin.provider : '—'}）定价，模型层没有条目；点「去覆盖层」修改那条覆盖。`
                : origin.unpriced === true ? '这个模型串没有任何价格条目，当前按 ¥0 计价。' : undefined}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** One rate cell: an editable <input> for a hand row, a plain value otherwise.
 *  The label is hidden on wide layouts (the column header names the column) and
 *  shown when the row stacks on a narrow screen. */
function RateCell({ field, editing, value, onChange }: {
  field: keyof DraftRates
  editing: boolean
  value: string
  onChange: (value: string) => void
}) {
  return (
    <span className="dtpl-pricing-cell">
      <span className="dtpl-pricing-cell-label">{FIELD_LABELS[field]}</span>
      {editing ? (
        <input
          className="dtpl-pricing-input"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={value}
          title={`${FIELD_LABELS[field]}（¥/百万词元）`}
          aria-label={`${FIELD_LABELS[field]}单价（¥/百万词元）`}
          placeholder="—"
          onChange={event => onChange(event.target.value)}
        />
      ) : (
        <span className="dtpl-pricing-rate" title={`${FIELD_LABELS[field]}（¥/百万词元）`}>{value === '' ? '—' : value}</span>
      )}
    </span>
  )
}

/** The staged rule-set editor of one hand row: the base slate lives in the row
 *  above, so this edits the price timeline and its peak windows. */
function DraftRulesEditor({ draft, onPatch }: {
  draft: ManualDraft
  onPatch: (patch: (draft: ManualDraft) => ManualDraft) => void
}) {
  const patchRule = (id: string, patch: Partial<DraftRule>): void => {
    onPatch(current => ({ ...current, rules: current.rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule) }))
  }
  const patchSlotList = (ruleId: string | null, patch: (slots: DraftSlot[]) => DraftSlot[]): void => {
    onPatch(current => ruleId === null
      ? { ...current, slots: patch(current.slots) }
      : { ...current, rules: current.rules.map(rule => rule.id === ruleId ? { ...rule, slots: patch(rule.slots) } : rule) })
  }
  const addRule = (): void => {
    onPatch(current => {
      // Pre-fill the window with the base slate: the common case is a discount
      // on the normal price, so the user only edits what changes.
      const rule: DraftRule = { id: nextId(), label: '', from: '', to: '', rates: { ...current.base }, slots: [] }
      return { ...current, rules: [...current.rules, rule].sort((a, b) => ruleStartSec(a) - ruleStartSec(b)) }
    })
  }
  const addSlot = (ruleId: string | null): void => {
    onPatch(current => {
      // Same idea for a peak window: start from the price it applies to.
      const source = ruleId === null ? current.base : current.rules.find(rule => rule.id === ruleId)?.rates ?? current.base
      const slot: DraftSlot = { id: nextId(), label: '', days: [], windows: [{ start: '09:00', end: '12:00' }], rates: { ...source } }
      return ruleId === null
        ? { ...current, slots: [...current.slots, slot] }
        : { ...current, rules: current.rules.map(rule => rule.id === ruleId ? { ...rule, slots: [...rule.slots, slot] } : rule) }
    })
  }
  const removeSlot = (ruleId: string | null, id: string): void => {
    patchSlotList(ruleId, slots => slots.filter(slot => slot.id !== id))
  }
  const patchSlot = (ruleId: string | null, id: string, patch: Partial<DraftSlot>): void => {
    patchSlotList(ruleId, slots => slots.map(slot => slot.id === id ? { ...slot, ...patch } : slot))
  }

  return (
    <div className="dtpl-pricing-rules">
      <p className="dtpl-pricing-detail-hint">基础价 = 上方四档单价。下面可以加<b>限时/长期降价</b>和<b>高峰时段</b>（按本机时区）。</p>

      <div className="dtpl-pricing-rule-list">
        {draft.rules.map((rule, index) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            index={index}
            onPatch={patch => patchRule(rule.id, patch)}
            onRemove={() => onPatch(current => ({ ...current, rules: current.rules.filter(candidate => candidate.id !== rule.id) }))}
            onAddSlot={() => addSlot(rule.id)}
            onPatchSlot={(id, patch) => patchSlot(rule.id, id, patch)}
            onRemoveSlot={id => removeSlot(rule.id, id)}
          />
        ))}
      </div>
      <button type="button" className="dtpl-pricing-add" onClick={addRule}>+ 新增调价时段</button>

      <div className="dtpl-pricing-slot-block">
        <span className="dtpl-pricing-slot-title">峰谷时段（基础价之上，工作日/周末可分别设置）</span>
        {draft.slots.map((slot, index) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            index={index}
            onPatch={patch => patchSlot(null, slot.id, patch)}
            onRemove={() => removeSlot(null, slot.id)}
          />
        ))}
        <button type="button" className="dtpl-pricing-add" onClick={() => addSlot(null)}>+ 新增峰谷时段</button>
      </div>
    </div>
  )
}

/** One staged price window card: label, span and four rates. */
function RuleCard({ rule, index, onPatch, onRemove, onAddSlot, onPatchSlot, onRemoveSlot }: {
  rule: DraftRule
  index: number
  onPatch: (patch: Partial<DraftRule>) => void
  onRemove: () => void
  onAddSlot: () => void
  onPatchSlot: (id: string, patch: Partial<DraftSlot>) => void
  onRemoveSlot: (id: string) => void
}) {
  return (
    <div className="dtpl-pricing-rule">
      <div className="dtpl-pricing-rule-head">
        <span className="dtpl-pricing-rule-index">调价时段 {index + 1}</span>
        <input
          className="dtpl-pricing-input dtpl-pricing-label-input"
          type="text"
          value={rule.label}
          placeholder="标签（如 限时5折 / 第一次长期降价）"
          aria-label={`调价时段 ${String(index + 1)} 标签`}
          onChange={event => onPatch({ label: event.target.value })}
        />
        <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={onRemove}>删除</button>
      </div>
      <div className="dtpl-pricing-rule-grid">
        <label className="dtpl-pricing-field">
          <span>开始日期</span>
          <input className="dtpl-pricing-input" type="date" value={rule.from} aria-label="开始日期" onChange={event => onPatch({ from: event.target.value })} />
        </label>
        <label className="dtpl-pricing-field">
          <span>结束日期（空 = 永久）</span>
          <input className="dtpl-pricing-input" type="date" value={rule.to} aria-label="结束日期" onChange={event => onPatch({ to: event.target.value })} />
        </label>
      </div>
      <RateFields rates={rule.rates} onChange={rates => onPatch({ rates })} />

      <div className="dtpl-pricing-slot-block dtpl-pricing-slot-block-nested">
        <span className="dtpl-pricing-slot-title">该时段的峰谷（不设则整段一个价）</span>
        {rule.slots.map((slot, slotIndex) => (
          <SlotCard key={slot.id} slot={slot} index={slotIndex} onPatch={patch => onPatchSlot(slot.id, patch)} onRemove={() => onRemoveSlot(slot.id)} />
        ))}
        <button type="button" className="dtpl-pricing-add" onClick={onAddSlot}>+ 峰谷时段</button>
      </div>
    </div>
  )
}

/** One staged peak window card: label, weekdays, windows and four rates. */
function SlotCard({ slot, index, onPatch, onRemove }: {
  slot: DraftSlot
  index: number
  onPatch: (patch: Partial<DraftSlot>) => void
  onRemove: () => void
}) {
  const toggleDay = (day: number): void => {
    onPatch({ days: slot.days.includes(day) ? slot.days.filter(value => value !== day) : [...slot.days, day].sort((a, b) => a - b) })
  }
  const patchWindow = (windowIndex: number, patch: Partial<{ start: string; end: string }>): void => {
    onPatch({ windows: slot.windows.map((window, i) => i === windowIndex ? { ...window, ...patch } : window) })
  }
  return (
    <div className="dtpl-pricing-slot">
      <div className="dtpl-pricing-rule-head">
        <span className="dtpl-pricing-rule-index">峰谷 {index + 1}</span>
        <input
          className="dtpl-pricing-input dtpl-pricing-label-input"
          type="text"
          value={slot.label}
          placeholder="标签（如 工作日高峰）"
          aria-label={`峰谷时段 ${String(index + 1)} 标签`}
          onChange={event => onPatch({ label: event.target.value })}
        />
        <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={onRemove}>删除</button>
      </div>
      <div className="dtpl-pricing-days" role="group" aria-label="生效星期">
        <button type="button" className="dtpl-pricing-day dtpl-pricing-day-preset" onClick={() => onPatch({ days: [1, 2, 3, 4, 5] })}>工作日</button>
        <button type="button" className="dtpl-pricing-day dtpl-pricing-day-preset" onClick={() => onPatch({ days: [6, 7] })}>周末</button>
        <button type="button" className="dtpl-pricing-day dtpl-pricing-day-preset" onClick={() => onPatch({ days: [] })}>每天</button>
        <span className="dtpl-pricing-days-gap" aria-hidden="true" />
        {WEEKDAY_LABELS.map(([day, label]) => (
          <button
            key={day}
            type="button"
            className="dtpl-pricing-day"
            aria-pressed={slot.days.includes(day)}
            onClick={() => toggleDay(day)}
          >
            {label}
          </button>
        ))}
        <span className="dtpl-pricing-days-hint">{slot.days.length === 0 ? '每天' : ''}</span>
      </div>
      <div className="dtpl-pricing-windows">
        {slot.windows.map((window, windowIndex) => (
          <div className="dtpl-pricing-window" key={windowIndex}>
            <input className="dtpl-pricing-input dtpl-pricing-clock" type="time" value={window.start} aria-label="开始时间" onChange={event => patchWindow(windowIndex, { start: event.target.value })} />
            <span className="dtpl-pricing-window-sep">→</span>
            <input className="dtpl-pricing-input dtpl-pricing-clock" type="time" value={window.end} aria-label="结束时间" onChange={event => patchWindow(windowIndex, { end: event.target.value })} />
            <button
              type="button"
              className="dtpl-pricing-btn dtpl-pricing-remove"
              disabled={slot.windows.length <= 1}
              title={slot.windows.length <= 1 ? '至少保留一个窗口' : '删除这个窗口'}
              onClick={() => onPatch({ windows: slot.windows.filter((_, i) => i !== windowIndex) })}
            >
              删
            </button>
          </div>
        ))}
        <button type="button" className="dtpl-pricing-add" onClick={() => onPatch({ windows: [...slot.windows, { start: '14:00', end: '18:00' }] })}>+ 时间窗口</button>
      </div>
      <RateFields rates={slot.rates} onChange={rates => onPatch({ rates })} />
    </div>
  )
}

/** Four staged rate inputs (输入 / 缓存读 / 缓存写 / 输出). */
function RateFields({ rates, onChange }: {
  rates: DraftRates
  onChange: (rates: DraftRates) => void
}) {
  return (
    <div className="dtpl-pricing-fields">
      {FIELD_ORDER.map(field => (
        <label className="dtpl-pricing-field" key={field}>
          <span>{FIELD_LABELS[field]} ¥/M</span>
          <input
            className="dtpl-pricing-input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={rates[field]}
            aria-label={`${FIELD_LABELS[field]}单价（¥/百万词元）`}
            placeholder="—"
            onChange={event => onChange({ ...rates, [field]: event.target.value })}
          />
        </label>
      ))}
    </div>
  )
}

/** Read-only price timeline of one rule set (cloud mirror or a saved hand
 *  entry), with the window in force now highlighted. */
function RuleTimeline({ rules, now, nowSec, emptyHint }: {
  rules: ModelRates | undefined
  now: PricingNow | null | undefined
  nowSec: number
  emptyHint?: string
}) {
  if (rules === undefined) {
    return <p className="dtpl-pricing-detail-hint">{emptyHint ?? '没有可显示的规则。'}</p>
  }
  const sorted = [...rules.timeRules].sort((a, b) => a.startTime - b.startTime)
  const covering = sorted.find(rule => rule.startTime <= nowSec && nowSec <= rule.endTime)
  const hasRules = sorted.length > 0 || rules.dailySlots.length > 0 || rules.contextTiers.length > 0
  return (
    <div className="dtpl-pricing-timeline">
      {emptyHint !== undefined && <p className="dtpl-pricing-detail-hint">{emptyHint}</p>}
      {!hasRules && <p className="dtpl-pricing-detail-hint">单一价格，没有调价时段或峰谷时段。</p>}
      {rules.contextTiers.length > 0 && (
        <p className="dtpl-pricing-detail-hint">云端此模型按上下文长度分档（≥{fmtRate(rules.contextTiers[0]!.threshold)} 词元起）；手工覆盖后分档不再生效。</p>
      )}

      {sorted.map(rule => {
        const active = covering === rule
        const flat = rule.dailySlots === undefined || rule.dailySlots.length === 0
        return (
          <div className={`dtpl-pricing-tl-row${active ? ' dtpl-pricing-tl-active' : ''}`} key={`${String(rule.startTime)}:${String(rule.endTime)}`}>
            <span className="dtpl-pricing-tl-label">{rule.label ?? '调价时段'}</span>
            <span className="dtpl-pricing-tl-span">{spanText(rule.startTime, rule.endTime)}</span>
            <span className="dtpl-pricing-tl-rates">
              入 ¥{fmtRate(rule.rates.inputPerMillion)} · 缓读 ¥{fmtRate(rule.rates.cacheReadPerMillion)} · 缓写 ¥{fmtRate(rule.rates.cacheWritePerMillion)} · 出 ¥{fmtRate(rule.rates.outputPerMillion)}
            </span>
            {active && <span className="dtpl-pricing-tl-badge">现在生效</span>}
            {flat && rule.startTime !== 0 && <span className="dtpl-pricing-tl-note">该时段无峰谷，整段一个价</span>}
            {(rule.dailySlots ?? []).map((slot, index) => (
              <span className="dtpl-pricing-tl-slot" key={index}>
                ↳ {slot.label ?? '峰谷'} · {slot.daysOfWeek === undefined || slot.daysOfWeek.length === 0 ? '每天' : slot.daysOfWeek.map(day => WEEKDAY_LABELS.find(([value]) => value === day)?.[1] ?? String(day)).join('')}
                {' '}{slot.windows.map(window => `${minuteToClock(window.startMinute)}–${minuteToClock(window.endMinute)}`).join('、')}
                {' '}入 ¥{fmtRate(slot.rates.inputPerMillion)} · 出 ¥{fmtRate(slot.rates.outputPerMillion)}
                {now?.peak === true && now.label === slot.label && <b className="dtpl-pricing-tl-badge">现在生效</b>}
              </span>
            ))}
          </div>
        )
      })}

      <div className={`dtpl-pricing-tl-row dtpl-pricing-tl-base${covering === undefined ? ' dtpl-pricing-tl-active' : ''}`}>
        <span className="dtpl-pricing-tl-label">基础价</span>
        <span className="dtpl-pricing-tl-span">以上时段之外</span>
        <span className="dtpl-pricing-tl-rates">
          入 ¥{fmtRate(rules.base.inputPerMillion)} · 缓读 ¥{fmtRate(rules.base.cacheReadPerMillion)} · 缓写 ¥{fmtRate(rules.base.cacheWritePerMillion)} · 出 ¥{fmtRate(rules.base.outputPerMillion)}
        </span>
        {covering === undefined && <span className="dtpl-pricing-tl-badge">现在生效</span>}
        {rules.dailySlots.map((slot, index) => (
          <span className="dtpl-pricing-tl-slot" key={index}>
            ↳ {slot.label ?? '峰谷'} · {slot.daysOfWeek === undefined || slot.daysOfWeek.length === 0 ? '每天' : slot.daysOfWeek.map(day => WEEKDAY_LABELS.find(([value]) => value === day)?.[1] ?? String(day)).join('')}
            {' '}{slot.windows.map(window => `${minuteToClock(window.startMinute)}–${minuteToClock(window.endMinute)}`).join('、')}
            {' '}入 ¥{fmtRate(slot.rates.inputPerMillion)} · 出 ¥{fmtRate(slot.rates.outputPerMillion)}
            {now?.peak === true && now.label === slot.label && <b className="dtpl-pricing-tl-badge">现在生效</b>}
          </span>
        ))}
      </div>
    </div>
  )
}

/** The 新增模型 row: a model-name field + add button at the top of the list. */
function AddRow({ onAdd }: { onAdd: (model: string) => void }) {
  const [name, setName] = useState('')
  const submit = (): void => {
    const model = name.trim()
    if (model === '') return
    onAdd(model)
    setName('')
  }
  return (
    <div className="dtpl-pricing-row dtpl-pricing-row-add">
      <div className="dtpl-pricing-model">
        {/* The head wrapper is a ROW flex (name + tag side by side); without it
            the column layout of .dtpl-pricing-model stacks the tag underneath
            and stretches it across the whole track. */}
        <span className="dtpl-pricing-model-head">
          <input
            className="dtpl-pricing-search dtpl-pricing-name-input"
            type="text"
            placeholder="新增模型：输入账本里的精确模型串…"
            value={name}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
            aria-label="新增模型名"
          />
          <span className="dtpl-pricing-model-tag dtpl-pricing-model-tag-new">新增</span>
        </span>
      </div>
      <div className="dtpl-pricing-rates" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <div className="dtpl-pricing-actions">
        <button
          type="button"
          className="dtpl-pricing-btn dtpl-pricing-custom"
          disabled={name.trim() === ''}
          onClick={submit}
        >
          添加
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Provider overlay surface (provider 维度)：read + hand-edit provider-pricing.json
// ---------------------------------------------------------------------------

/** One staged price segment of a provider entry (dates local `YYYY-MM-DD`). */
interface DraftSegment {
  id: string
  from: string
  to: string
  rates: DraftRates
  note: string
}

/** One editable draft of a (provider, model) hand entry. */
interface ProviderDraft {
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

const providerKeyOf = (provider: string, model: string): string => `${provider}\n${model}`

/** Signature of ONE staged overlay draft, so a row can answer "am I unsaved?"
 *  on its own. Invalid staged values are included, so an incomplete override
 *  still counts as unsaved and one 保存 press surfaces the validation error. */
function providerDraftSignature(draft: ProviderDraft): string {
  return JSON.stringify({
    key: draft.key,
    billing: draft.billing,
    source: draft.source,
    inheritBase: draft.inheritBase,
    segments: draft.segments,
    note: draft.note,
    placeholder: draft.placeholder,
  })
}

/** Per-key baseline signatures of the loaded/saved overlay (see `modelBaseline`
 *  for why this is a map rather than one whole-table string). */
function providerBaseline(drafts: ReadonlyMap<string, ProviderDraft>): ReadonlyMap<string, string> {
  return new Map([...drafts].map(([key, draft]) => [key, providerDraftSignature(draft)]))
}

/** One overlay row's staged state (see `rowStatus`). A draft with no baseline
 *  is a new override; a baseline key with no draft is a staged deletion. */
function providerRowStatus(key: string, draft: ProviderDraft | undefined, baseline: ReadonlyMap<string, string>): RowStatus {
  const saved = baseline.get(key)
  if (draft !== undefined) return saved === providerDraftSignature(draft) ? 'clean' : 'unsaved'
  return saved === undefined ? 'clean' : 'pending-delete'
}

/** Whether the overlay holds staged changes. Iterates drafts ∪ baseline keys,
 *  because deleting a draft can leave no row behind at all (an override the
 *  mirror never named). */
function providerDirty(drafts: ReadonlyMap<string, ProviderDraft>, baseline: ReadonlyMap<string, string>): boolean {
  for (const [key, draft] of drafts) {
    if (baseline.get(key) !== providerDraftSignature(draft)) return true
  }
  for (const key of baseline.keys()) {
    if (!drafts.has(key)) return true
  }
  return false
}

/** Order-insensitive signature of a staged alias map (route → canonical). */
function aliasSignature(aliases: ReadonlyMap<string, string>): string {
  return JSON.stringify([...aliases].sort(([left], [right]) => left.localeCompare(right)))
}

/** Seed a draft from a mirror/hand row so the user can edit it in place. */
function providerDraftOf(row: ProviderPricingViewRow): ProviderDraft {
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

/** Compose the staged overlay into the wire table, or report the first error. */
function composeProviderTable(drafts: ReadonlyMap<string, ProviderDraft>): { ok: true; table: ProviderPricingTable } | { ok: false; error: string } {  const table: ProviderPricingTable = {}
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

/** A one-line human summary of a provider row's price source. */
function providerSourceSummary(row: ProviderPricingViewRow): string {
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

/**
 * 通道覆盖层 surface: one compact row per (provider, model) grouped by
 * provider route. Rows are read-only summaries until the user opens the row's
 * editor (one row at a time), which stages changes into a drafts map; the
 * footer 保存 writes the WHOLE desired hand overlay. Rows with no mirror entry
 * can be created with the 新增覆盖 form.
 */
function ProviderOverlayEditor({ onChanged, active, onDirtyChange, focus, onFocusHandled }: {
  onChanged: () => void
  active: boolean
  onDirtyChange: (dirty: boolean) => void
  focus: { provider: string; model: string } | null
  onFocusHandled: () => void
}) {
  const [rows, setRows] = useState<readonly ProviderPricingViewRow[] | null>(() => stagedProviderDrafts?.rows ?? null)
  const [drafts, setDrafts] = useState<ReadonlyMap<string, ProviderDraft>>(() => stagedProviderDrafts?.drafts ?? new Map())
  const [baseline, setBaseline] = useState<ReadonlyMap<string, string>>(() => stagedProviderDrafts?.baseline ?? new Map())
  const [aliases, setAliases] = useState<ReadonlyMap<string, string>>(() => stagedProviderDrafts?.aliases ?? new Map())
  const [aliasBaseline, setAliasBaseline] = useState(() => stagedProviderDrafts?.aliasBaseline ?? aliasSignature(new Map()))
  const [names, setNames] = useState<readonly string[]>(() => stagedProviderDrafts?.names ?? [])
  const [modelNames, setModelNames] = useState<readonly string[]>(() => stagedProviderDrafts?.modelNames ?? [])
  const [aliasSource, setAliasSource] = useState('')
  const [aliasTarget, setAliasTarget] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const activeRef = useRef(0)

  const seed = useCallback((providerRows: readonly ProviderPricingViewRow[], routes: ProviderAliasMap) => {
    const next = new Map(providerRows.filter(row => row.manual).map(row => [providerKeyOf(row.provider, row.model), providerDraftOf(row)]))
    const aliasMap = new Map(Object.entries(routes))
    setDrafts(next)
    setBaseline(providerBaseline(next))
    setAliases(aliasMap)
    setAliasBaseline(aliasSignature(aliasMap))
  }, [])

  const load = useCallback(async () => {
    const token = ++activeRef.current
    setError(null)
    try {
      const res = await fetch('/tokbook/provider-pricing')
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`)
      const payload = await res.json() as {
        providerRows?: ProviderPricingViewRow[]
        providerRoutes?: ProviderAliasMap
        providerNames?: string[]
        modelNames?: string[]
      }
      if (token !== activeRef.current) return
      const providerRows = payload.providerRows ?? []
      setRows(providerRows)
      setNames(payload.providerNames ?? [])
      setModelNames(payload.modelNames ?? [])
      seed(providerRows, payload.providerRoutes ?? {})
      setCollapsed(new Set())
      setEditingKey(null)
    } catch (err) {
      if (token !== activeRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [seed])

  useEffect(() => {
    // A rehydrated dirty draft is authoritative until the user saves/discards.
    if (stagedProviderDrafts !== null) return
    void load()
    return () => { activeRef.current += 1 }
  }, [load])

  // Deep link from a model row the overlay prices: open that exact override. A
  // row inherited through a route alias has no entry of its own, so the link
  // lands on the canonical row instead — that is where its price lives.
  useEffect(() => {
    if (focus === null || rows === null) return
    const found = rows.find(candidate => candidate.provider === focus.provider && candidate.model === focus.model)
    if (found !== undefined) {
      const row = found.via === undefined
        ? found
        : rows.find(candidate => candidate.provider === found.via && candidate.model === found.model) ?? found
      const key = providerKeyOf(row.provider, row.model)
      setDrafts(current => {
        if (current.has(key)) return current
        const next = new Map(current)
        next.set(key, providerDraftOf(row))
        return next
      })
      setCollapsed(current => { const next = new Set(current); next.delete(row.provider); return next })
      setEditingKey(key)
      window.setTimeout(() => {
        const target = [...document.querySelectorAll<HTMLElement>('.dtpl-pricing-provider-row')]
          .find(element => element.dataset.providerModel === key)
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 0)
    }
    onFocusHandled()
  }, [focus, rows, onFocusHandled])

  const patchDraft = useCallback((key: string, patch: Partial<ProviderDraft>) => {
    setDrafts(current => {
      const draft = current.get(key)
      if (draft === undefined) return current
      const next = new Map(current)
      next.set(key, { ...draft, ...patch })
      return next
    })
  }, [])

  const deleteDraft = useCallback((key: string) => {
    setDrafts(current => {
      const next = new Map(current)
      next.delete(key)
      return next
    })
    setEditingKey(current => current === key ? null : current)
  }, [])

  const startOverride = useCallback((row: ProviderPricingViewRow) => {
    const draft = providerDraftOf(row)
    setDrafts(current => {
      const next = new Map(current)
      next.set(draft.key, draft)
      return next
    })
    setEditingKey(draft.key)
  }, [])

  const addOverride = useCallback((provider: string, model: string) => {
    const draft: ProviderDraft = {
      key: providerKeyOf(provider, model),
      provider,
      model,
      billing: 'metered',
      source: 'inherit',
      inheritBase: model,
      segments: [],
      note: '',
      placeholder: false,
    }
    setDrafts(current => {
      const next = new Map(current)
      next.set(draft.key, draft)
      return next
    })
    setCollapsed(current => {
      const next = new Set(current)
      next.delete(provider)
      return next
    })
    setEditingKey(draft.key)
  }, [])

  const toggleGroup = useCallback((provider: string) => {
    setCollapsed(current => {
      const next = new Set(current)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }, [])

  const aliasDirty = aliasSignature(aliases) !== aliasBaseline
  const dirty = rows !== null && (providerDirty(drafts, baseline) || aliasDirty)

  // Cache only dirty state; a clean view is re-fetched on the next mount.
  useEffect(() => {
    stagedProviderDrafts = dirty && rows !== null
      ? { rows, drafts, baseline, aliases, aliasBaseline, names, modelNames }
      : null
    onDirtyChange(dirty)
  }, [rows, drafts, baseline, aliases, aliasBaseline, names, modelNames, dirty, onDirtyChange])

  const save = useCallback(async () => {
    const result = composeProviderTable(drafts)
    if (!result.ok) {
      setError(result.error)
      return
    }
    // The wire body is the file shape: the entry map plus the reserved
    // `$routes` alias section (`pricing.ts` PROVIDER_ROUTES_KEY).
    const body: Record<string, unknown> = { ...result.table }
    if (aliases.size > 0) body.$routes = Object.fromEntries(aliases)
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/tokbook/provider-pricing', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!res.ok || payload === null || payload.ok !== true) {
        const message = payload?.error !== undefined && payload.error !== '' ? payload.error : `HTTP ${String(res.status)}`
        throw new Error(message)
      }
      await load()
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1600)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [drafts, aliases, onChanged, load])

  // Ctrl/Cmd+S saves while this pane is the visible one.
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      if (!saving && dirty) void save()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, saving, dirty, save])

  // Group rows by provider; hand rows first within each group. Hand rows the
  // mirror never named are synthesized so a new override is visible at once.
  const grouped = useMemo(() => {
    const byProvider = new Map<string, ProviderPricingViewRow[]>()
    const known = new Set<string>()
    for (const row of rows ?? []) {
      const list = byProvider.get(row.provider) ?? []
      list.push(row)
      byProvider.set(row.provider, list)
      known.add(providerKeyOf(row.provider, row.model))
    }
    for (const draft of drafts.values()) {
      if (known.has(draft.key)) continue
      const list = byProvider.get(draft.provider) ?? []
      list.push({ provider: draft.provider, model: draft.model, manual: true })
      byProvider.set(draft.provider, list)
    }
    const out: Array<[string, ProviderPricingViewRow[]]> = []
    for (const [provider, list] of byProvider) {
      list.sort((a, b) => {
        if (a.manual !== b.manual) return a.manual ? -1 : 1
        return a.model < b.model ? -1 : a.model > b.model ? 1 : 0
      })
      out.push([provider, list])
    }
    out.sort((a, b) => a[0].localeCompare(b[0]))
    return out
  }, [rows, drafts])

  const providerNames = useMemo(
    () => [...new Set([...(rows ?? []).map(row => row.provider), ...names])].filter(name => name !== '').sort((a, b) => a.localeCompare(b)),
    [rows, names],
  )
  // Alias pickers: a route can follow one other route, one hop only — so a
  // route already following something is not a source, and a route someone
  // already follows is not a source either (that would make a chain).
  const aliasTargeted = useMemo(() => new Set(aliases.values()), [aliases])
  const aliasSourceCandidates = useMemo(
    () => names.filter(name => !aliases.has(name) && !aliasTargeted.has(name)),
    [names, aliases, aliasTargeted],
  )
  const aliasTargetCandidates = useMemo(() => names.filter(name => !aliases.has(name)), [names, aliases])

  const addAlias = useCallback((route: string, target: string) => {
    if (route === '' || target === '' || route === target) return
    setAliases(current => {
      const next = new Map(current)
      next.set(route, target)
      return next
    })
    setAliasSource('')
    setAliasTarget('')
  }, [])

  const removeAlias = useCallback((route: string) => {
    setAliases(current => {
      const next = new Map(current)
      next.delete(route)
      return next
    })
  }, [])

  /** Jump from an inherited row to the canonical override it follows, opening
   *  its editor (a mirror row is staged as a hand override, since that is the
   *  only way its price can be edited). */
  const openCanonical = useCallback((target: string, model: string) => {
    const canonical = (rows ?? []).find(row => row.provider === target && row.model === model)
    if (canonical === undefined) return
    const key = providerKeyOf(target, model)
    setDrafts(current => {
      if (current.has(key)) return current
      const next = new Map(current)
      next.set(key, providerDraftOf(canonical))
      return next
    })
    setCollapsed(current => { const next = new Set(current); next.delete(target); return next })
    setEditingKey(key)
    window.setTimeout(() => {
      const element = [...document.querySelectorAll<HTMLElement>('.dtpl-pricing-provider-row')]
        .find(candidate => candidate.dataset.providerModel === key)
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 0)
  }, [rows])

  const draftCount = drafts.size
  const nowSec = Math.floor(Date.now() / 1000)

  return (
    <div className="dtpl-pricing-provider">
      {error !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">{error}</p>
          <button type="button" className="dtpl-retry" onClick={() => setError(null)}>忽略</button>
        </div>
      )}

      <p className="dtpl-pricing-provider-intro">
        按「通道 + 精确模型串」定价：订阅通道算<b>订阅价值</b>、跟随官方价的写「跟随官方价」、
        中转自定价用「自己填价」逐段填。前缀串（如 <code>deepseek/deepseek-v4-flash</code>）在这里命中。
      </p>

      {rows === null ? (
        <div className="dtpl-pricing-skeleton dtpl-sk" />
      ) : (
        <div className="dtpl-pricing-provider-list">
          {grouped.length === 0 && <p className="dtpl-pricing-empty">通道覆盖层为空（云端镜像可能尚未同步）。用下方「新增覆盖」为你的通道手工定价。</p>}
          {grouped.map(([provider, list]) => {
            const isCollapsed = collapsed.has(provider)
            const handCount = list.filter(row => drafts.has(providerKeyOf(row.provider, row.model))).length
            return (
              <section className="dtpl-pricing-provider-group" key={provider} data-provider={provider}>
                <button
                  type="button"
                  className="dtpl-pricing-provider-head"
                  aria-expanded={!isCollapsed}
                  aria-controls={`dtpl-prov-${cssId(provider)}`}
                  onClick={() => toggleGroup(provider)}
                >
                  <span className="dtpl-pricing-provider-head-name">{provider}</span>
                  <span className="dtpl-pricing-provider-head-meta">
                    {list.length} 条{handCount > 0 ? ` · 手工 ${String(handCount)}` : ''}
                    {aliases.has(provider) ? ` · 跟随 ${aliases.get(provider)!}` : ''}
                  </span>
                  <span className="dtpl-pricing-provider-head-caret" aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                </button>

                {!isCollapsed && (
                  <div className="dtpl-pricing-provider-rows" id={`dtpl-prov-${cssId(provider)}`}>
                    {list.map(row => {
                      const key = providerKeyOf(row.provider, row.model)
                      const draft = drafts.get(key)
                      const isEditing = editingKey === key
                      // A row inherited through a route alias is read-only here:
                      // its price is owned by the canonical route.
                      const via = row.via
                      const isHand = draft !== undefined && via === undefined
                      const summary = via !== undefined
                        ? `跟随 ${via} · ${providerSourceSummary(row)}`
                        : draft !== undefined
                          ? (draft.source === 'inherit' ? `跟随 ${draft.inheritBase !== '' ? draft.inheritBase : '—'} 的价` : `自己填价 · ${String(draft.segments.length)} 段`)
                          : providerSourceSummary(row)
                      const tag = via !== undefined ? '跟随'
                        : draft !== undefined ? '手工价'
                          : row.segments !== undefined ? '自己填价'
                            : row.placeholder === true ? '先按官方价'
                              : row.inheritBase !== undefined ? '跟随官方价' : '云端给的价'
                      const live = draft !== undefined && draft.source === 'segments'
                        ? segmentNow(draft.segments, nowSec)
                        : row.now
                      return (
                        <div key={key}>
                          <div
                            className={`dtpl-pricing-provider-row${isHand ? ' dtpl-pricing-provider-row-hand' : ''}`}
                            data-provider-model={key}
                          >
                            <div className="dtpl-pricing-provider-model">
                              <span className="dtpl-pricing-model-head">
                                <span className="dtpl-pricing-provider-model-name" title={row.model}>{row.model}</span>
                                <span className="dtpl-pricing-model-tag">{tag}</span>
                                <StagedTag staged={providerRowStatus(key, draft, baseline)} />
                                <span className={`dtpl-pricing-provider-billing dtpl-pricing-provider-billing-${(draft ?? row).billing ?? 'metered'}`}>
                                  {(draft ?? row).billing === 'subscription' ? '订阅价值' : '按量支出'}
                                </span>
                              </span>
                              <span className="dtpl-pricing-provider-summary">{summary}</span>
                              {live !== undefined && (
                                <span className="dtpl-pricing-now">
                                  当前生效 <b>入 ¥{fmtRate(live.rates.inputPerMillion)} · 出 ¥{fmtRate(live.rates.outputPerMillion)}</b>
                                  {live.label !== undefined ? ` · ${live.label}` : ''}{live.peak ? ' · 峰时' : ''}
                                </span>
                              )}
                            </div>
                            <div className="dtpl-pricing-actions">
                              {via !== undefined ? (
                                <button
                                  type="button"
                                  className="dtpl-pricing-btn dtpl-pricing-custom"
                                  onClick={() => openCanonical(via, row.model)}
                                  title={`这条路由跟随「${via}」，点这里去那条覆盖编辑`}
                                >
                                  去编辑
                                </button>
                              ) : isEditing ? (
                                <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={() => setEditingKey(null)}>收起</button>
                              ) : isHand ? (
                                <>
                                  <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={() => setEditingKey(key)}>编辑</button>
                                  <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={() => deleteDraft(key)} title="删除手工覆盖，回到云端镜像行">删除覆盖</button>
                                </>
                              ) : (
                                <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={() => startOverride(row)} title="以镜像行为参考新增手工覆盖">设为覆盖</button>
                              )}
                            </div>
                          </div>

                          {isEditing && draft !== undefined && (
                            <ProviderRowEditor
                              draft={draft}
                              rules={row.rules}
                              nowSec={nowSec}
                              models={modelNames}
                              onPatch={patch => patchDraft(key, patch)}
                              onDone={() => setEditingKey(null)}
                              onDelete={() => deleteDraft(key)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* 高级：同价通道（一条路由跟随另一条的价格）与「新增覆盖」。收起来是
          为了让首屏只有「一张表」；展开后才出现配置表单。 */}
      {rows !== null && (
        <div className="dtpl-pricing-advanced">
          <button
            type="button"
            className="dtpl-pricing-advanced-bar"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen(open => !open)}
          >
            <span className="dtpl-pricing-advanced-title">高级：同价通道 / 新增覆盖</span>
            {aliases.size > 0 && <span className="dtpl-pricing-advanced-count">同价通道 {aliases.size}</span>}
            <StagedTag staged={aliasDirty ? 'unsaved' : 'clean'} />
            <span className="dtpl-pricing-advanced-cue">{advancedOpen ? '收起' : '展开'}</span>
          </button>

          {advancedOpen && (
            <>
              <section className="dtpl-pricing-alias" aria-label="同价通道">
                <div className="dtpl-pricing-alias-head">
                  <span className="dtpl-pricing-alias-title">同价通道</span>
                  <span className="dtpl-pricing-alias-hint">一条路由跟随另一条的价格；同款套餐买多份时只维护一处</span>
                </div>
                {aliases.size > 0 && (
                  <div className="dtpl-pricing-alias-list">
                    {[...aliases].map(([route, target]) => (
                      <span className="dtpl-pricing-alias-item" key={route}>
                        <span className="dtpl-pricing-alias-route" title={route}>{route}</span>
                        <span className="dtpl-pricing-alias-arrow" aria-hidden="true">跟随</span>
                        <span className="dtpl-pricing-alias-route" title={target}>{target}</span>
                        <button
                          type="button"
                          className="dtpl-pricing-alias-remove"
                          onClick={() => removeAlias(route)}
                          title="取消跟随"
                          aria-label={`取消「${route}」跟随「${target}」`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="dtpl-pricing-alias-add">
                  <select
                    className="dtpl-pricing-input dtpl-pricing-select"
                    value={aliasSource}
                    onChange={event => setAliasSource(event.target.value)}
                    aria-label="要跟随别的价格的路由"
                  >
                    <option value="">选择路由…</option>
                    {aliasSourceCandidates.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <span className="dtpl-pricing-alias-arrow" aria-hidden="true">跟随</span>
                  <select
                    className="dtpl-pricing-input dtpl-pricing-select"
                    value={aliasTarget}
                    onChange={event => setAliasTarget(event.target.value)}
                    aria-label="被跟随的路由"
                  >
                    <option value="">选择被跟随的路由…</option>
                    {aliasTargetCandidates.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <button
                    type="button"
                    className="dtpl-pricing-btn"
                    onClick={() => addAlias(aliasSource, aliasTarget)}
                    disabled={aliasSource === '' || aliasTarget === '' || aliasSource === aliasTarget}
                  >
                    添加
                  </button>
                </div>
              </section>

              <AddOverrideForm providers={providerNames} onAdd={addOverride} />
            </>
          )}
        </div>
      )}

      <div className="dtpl-pricing-foot">
        <span className={`dtpl-pricing-save-state${savedFlash ? ' dtpl-pricing-saved' : ''}`}>{savedFlash ? '已保存' : ''}</span>
        {dirty && <button type="button" className="dtpl-pricing-btn" onClick={() => void load()} disabled={saving}>放弃修改</button>}
        <button type="button" className="dtpl-pricing-save" onClick={() => void save()} disabled={saving || rows === null || !dirty}>
          {saving ? '保存中…' : draftCount > 0 ? `保存 ${String(draftCount)} 条通道覆盖` : aliasDirty ? '保存同价通道' : '保存通道覆盖'}
        </button>
      </div>
    </div>
  )
}

/** The price a staged segment timeline applies at `nowSec` (live feedback). */
function segmentNow(segments: readonly DraftSegment[], nowSec: number): PricingNow | undefined {
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

/** The inline editor of ONE provider row, shown only while that row is being
 *  edited. Every change stages into the row's draft; the footer 保存 persists
 *  all drafts at once. */
function ProviderRowEditor({ draft, rules, nowSec, models, onPatch, onDone, onDelete }: {
  draft: ProviderDraft
  rules: ModelRates | undefined
  nowSec: number
  /** Base-table model ids offered by the 跟随官方价 field. */
  models: readonly string[]
  onPatch: (patch: Partial<ProviderDraft>) => void
  onDone: () => void
  onDelete: () => void
}) {
  const patchSegment = (id: string, patch: Partial<DraftSegment>): void => {
    onPatch({ segments: draft.segments.map(segment => segment.id === id ? { ...segment, ...patch } : segment) })
  }
  return (
    <div className="dtpl-pricing-prov-editor" role="group" aria-label={`编辑 ${draft.provider}/${draft.model} 覆盖`}>
      <div className="dtpl-pricing-prov-editor-grid">
        <label className="dtpl-pricing-field">
          <span>计费方式</span>
          <select
            className="dtpl-pricing-input dtpl-pricing-select"
            value={draft.billing}
            aria-label="计费性质"
            onChange={event => onPatch({ billing: event.target.value as BillingNature })}
          >
            <option value="metered">按量（实际支出）</option>
            <option value="subscription">订阅（算作价值）</option>
          </select>
        </label>
        <label className="dtpl-pricing-field">
          <span>价格从哪来</span>
          <select
            className="dtpl-pricing-input dtpl-pricing-select"
            value={draft.source}
            aria-label="价格来源"
            onChange={event => onPatch({ source: event.target.value as ProviderDraft['source'] })}
          >
            <option value="inherit">跟随官方价（含调价史/峰谷）</option>
            <option value="segments">自己填价（逐段固定价）</option>
          </select>
        </label>
        <label className="dtpl-pricing-field dtpl-pricing-field-wide">
          <span>备注（可空）</span>
          <input className="dtpl-pricing-input" type="text" value={draft.note} aria-label="备注" onChange={event => onPatch({ note: event.target.value })} />
        </label>
      </div>

      {draft.source === 'inherit' ? (
        <>
          <label className="dtpl-pricing-field dtpl-pricing-field-wide">
            <span>跟随哪个模型的价</span>
            <input
              className="dtpl-pricing-input"
              type="text"
              list="dtpl-pricing-model-ids"
              value={draft.inheritBase}
              aria-label="跟随基准模型"
              onChange={event => onPatch({ inheritBase: event.target.value })}
            />
            <datalist id="dtpl-pricing-model-ids">
              {models.map(model => <option key={model} value={model} />)}
            </datalist>
          </label>
          <RuleTimeline rules={rules} now={undefined} nowSec={nowSec} emptyHint={rules === undefined ? '云端基准价表里没有这个模型，跟随不会生效。' : undefined} />
        </>
      ) : (
        <div className="dtpl-pricing-segments">
          {draft.segments.map((segment, index) => (
            <div className="dtpl-pricing-rule" key={segment.id}>
              <div className="dtpl-pricing-rule-head">
                <span className="dtpl-pricing-rule-index">价格时段 {index + 1}</span>
                <input
                  className="dtpl-pricing-input dtpl-pricing-label-input"
                  type="text"
                  value={segment.note}
                  placeholder="备注（如 中转真实价）"
                  aria-label={`价格时段 ${String(index + 1)} 备注`}
                  onChange={event => patchSegment(segment.id, { note: event.target.value })}
                />
                <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={() => onPatch({ segments: draft.segments.filter(candidate => candidate.id !== segment.id) })}>删除</button>
              </div>
              <div className="dtpl-pricing-rule-grid">
                <label className="dtpl-pricing-field">
                  <span>开始日期（空 = 自始）</span>
                  <input className="dtpl-pricing-input" type="date" value={segment.from} aria-label="时段开始日期" onChange={event => patchSegment(segment.id, { from: event.target.value })} />
                </label>
                <label className="dtpl-pricing-field">
                  <span>结束日期（空 = 永久）</span>
                  <input className="dtpl-pricing-input" type="date" value={segment.to} aria-label="时段结束日期" onChange={event => patchSegment(segment.id, { to: event.target.value })} />
                </label>
              </div>
              <RateFields rates={segment.rates} onChange={rates => patchSegment(segment.id, { rates })} />
            </div>
          ))}
          <button
            type="button"
            className="dtpl-pricing-add"
            onClick={() => onPatch({ segments: [...draft.segments, { id: nextId(), from: '', to: '', rates: { ...BLANK_RATES }, note: '' }] })}
          >
            + 新增价格时段
          </button>
        </div>
      )}

      <div className="dtpl-pricing-prov-editor-actions">
        <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={onDone}>完成</button>
        <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={onDelete}>删除覆盖</button>
      </div>
    </div>
  )
}

/** The 新增覆盖 form: create an override for a (provider, model) pair the
 *  mirror never named (a private relay, a new subscription channel). */
function AddOverrideForm({ providers, onAdd }: {
  providers: readonly string[]
  onAdd: (provider: string, model: string) => void
}) {
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const ready = provider.trim() !== '' && model.trim() !== ''
  return (
    <div className="dtpl-pricing-add-override">
      <span className="dtpl-pricing-slot-title">新增覆盖</span>
      <div className="dtpl-pricing-add-override-row">
        <input
          className="dtpl-pricing-input"
          type="text"
          list="dtpl-provider-names"
          value={provider}
          placeholder="通道路由键"
          aria-label="通道路由键"
          onChange={event => setProvider(event.target.value)}
        />
        <datalist id="dtpl-provider-names">
          {providers.map(name => <option value={name} key={name} />)}
        </datalist>
        <input
          className="dtpl-pricing-input"
          type="text"
          value={model}
          placeholder="精确模型串"
          aria-label="精确模型串"
          onChange={event => setModel(event.target.value)}
        />
        <button
          type="button"
          className="dtpl-pricing-btn dtpl-pricing-custom"
          disabled={!ready}
          onClick={() => { onAdd(provider.trim(), model.trim()); setModel('') }}
        >
          添加
        </button>
      </div>
    </div>
  )
}

/** Provider route keys can contain characters invalid in an HTML id. */
function cssId(provider: string): string {
  return provider.replace(/[^a-zA-Z0-9_-]/g, '-')
}

/** Group cloud reference rows by the feed's `family`: most models first, then
 *  name; the unnamed bucket (`''`, rendered as 未标注厂商) always sorts last. */
function groupByFamily(rows: readonly EditableRow[]): Array<[string, EditableRow[]]> {
  const byFamily = new Map<string, EditableRow[]>()
  for (const row of rows) {
    const family = row.origin.family ?? ''
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

/** Group the 在用 channel rows by billing route: most-used channel first (by
 *  records, then route key), models inside a group by records then name. */
function groupByProvider(rows: readonly ChannelUsageRow[]): Array<[string, ChannelUsageRow[]]> {
  const byProvider = new Map<string, ChannelUsageRow[]>()
  for (const row of rows) {
    const list = byProvider.get(row.provider)
    if (list === undefined) byProvider.set(row.provider, [row])
    else list.push(row)
  }
  for (const list of byProvider.values()) {
    list.sort((a, b) => b.records - a.records || a.model.localeCompare(b.model))
  }
  const total = (list: readonly ChannelUsageRow[]): number => list.reduce((sum, row) => sum + row.records, 0)
  return [...byProvider].sort(([a, listA], [b, listB]) => total(listB) - total(listA) || a.localeCompare(b))
}

/** The source chip of one channel row: which layer prices THIS channel. */
function channelSourceTag(channel: ChannelUsageRow, modelRow: EditableRow | undefined): string {
  if (channel.unpriced === true) return '价格未知'
  if (channel.overlay) return '覆盖层定价'
  if (modelRow?.manual === true) return '手工价'
  return modelRow?.origin.layered === true ? '云端 · 分时' : '云端'
}
