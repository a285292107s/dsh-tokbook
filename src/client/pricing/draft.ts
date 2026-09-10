/**
 * Pure logic of the 价格表 tab: the editable draft of one price file, its
 * signature (for the unsaved-changes marks) and the wire body one save sends.
 *
 * A draft mirrors the file the host owns: route → model string → price
 * segments, with every number held as a STRING so a half-typed value survives
 * a keystroke. Composing the body validates it and refuses with the offending
 * location, so the host's strict parse only ever sees a good table.
 *
 * Deliberately React-free: this module is the testable half of the tab.
 *
 * @module dsh-tokbook/client/pricing/draft
 */

import type { BillingNature, ModelPricing, PricingSegmentInput, PricingView } from '../../types.ts'

/** The file's one reserved top-level key. Mirrors `src/pricing.ts`; the client
 *  cannot import that module (it pulls in `node:fs`). */
export const BILLING_KEY = '$billing'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u
const MAX_NOTE_LENGTH = 120

/** The four ¥/M buckets of one segment, as numbers, keyed like the draft fields
 *  (the cache buckets stay absent while their input is empty). */
export interface DraftRates {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

/** Draft rate field → the wire/file field it is written as. */
export const RATE_FIELD_NAMES: ReadonlyArray<readonly [keyof DraftRates, keyof ModelPricing]> = [
  ['input', 'inputPerMillion'],
  ['output', 'outputPerMillion'],
  ['cacheRead', 'cacheReadPerMillion'],
  ['cacheWrite', 'cacheWritePerMillion'],
]

/** One editable price segment. `from` is `YYYY-MM-DD`, or `''` for 最早一段. */
export interface SegmentDraft {
  /** Local React key; stable across edits so inputs do not lose focus. */
  id: number
  from: string
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
  note: string
}

/** One editable model row of a route card. */
export interface ModelDraft {
  model: string
  /** Settings / the adapter catalog lists this string for the route. */
  configured: boolean
  /** Ledger records naming this (route, model). */
  records: number
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

let nextSegmentId = 1

/** The local `YYYY-MM-DD` of today. */
export function todayKey(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${String(now.getFullYear())}-${month}-${day}`
}

/** A segment prefilled from an existing one (or from a flat rate) and dated
 *  today — the shape 「加一段调价」 starts from. */
export function newSegment(from: Partial<SegmentDraft> = {}): SegmentDraft {
  const id = nextSegmentId
  nextSegmentId += 1
  return {
    id,
    from: from.from ?? todayKey(),
    input: from.input ?? '',
    output: from.output ?? '',
    cacheRead: from.cacheRead ?? '',
    cacheWrite: from.cacheWrite ?? '',
    note: from.note ?? '',
  }
}

function rateText(value: number | undefined): string {
  return value === undefined ? '' : String(value)
}

function segmentDraft(segment: PricingSegmentInput): SegmentDraft {
  const id = nextSegmentId
  nextSegmentId += 1
  return {
    id,
    from: segment.from ?? '',
    input: rateText(segment.inputPerMillion),
    output: rateText(segment.outputPerMillion),
    cacheRead: rateText(segment.cacheReadPerMillion),
    cacheWrite: rateText(segment.cacheWritePerMillion),
    note: segment.note ?? '',
  }
}

/** Seed an editable draft from one wire view. */
export function draftFromView(view: PricingView): PriceDraft {
  const draft: PriceDraft = new Map()
  for (const card of view.routes) {
    const models = new Map<string, ModelDraft>()
    for (const row of card.models) {
      models.set(row.model, {
        model: row.model,
        configured: row.configured,
        records: row.records,
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
  return draft
}

/** One row's segments in force order (`''` = 最早一段 sorts first). */
export function sortedSegments(model: ModelDraft): SegmentDraft[] {
  return [...model.segments].sort((left, right) => left.from.localeCompare(right.from))
}

/** The segment in force at `today` — what the row header prints as 当前价. */
export function segmentInForce(model: ModelDraft, today: string = todayKey()): SegmentDraft | null {
  let hit: SegmentDraft | null = null
  for (const segment of sortedSegments(model)) {
    if (segment.from === '' || segment.from <= today) hit = segment
    else break
  }
  return hit
}

/** Whether a row carries no price at all (its records bill ¥0). */
export function isUnpriced(model: ModelDraft): boolean {
  return model.segments.length === 0
}

/** The four ¥/M buckets of a segment, as the row's fixed columns. */
export type RateField = 'input' | 'output' | 'cacheRead' | 'cacheWrite'

/** The segment the row's inline cells edit: the one in force, else the
 *  earliest — a price dated in the future is still the one being written. */
export function editableSegment(model: ModelDraft): SegmentDraft | null {
  return segmentInForce(model) ?? sortedSegments(model)[0] ?? null
}

/** Whether a segment governs today (a future-dated one is written but idle). */
export function inForceToday(segment: SegmentDraft | null, today: string = todayKey()): boolean {
  return segment !== null && (segment.from === '' || segment.from <= today)
}

/** How one cell's value reads: `ok` (a number), `empty` (not filled yet), or
 *  `bad` (typed, but not a non-negative number). */
export type FieldState = 'ok' | 'empty' | 'bad'

/** One cell's state, so the row can mark the exact field that is wrong. */
export function fieldState(segment: SegmentDraft | null, field: RateField): FieldState {
  if (segment === null) return 'empty'
  const raw = segment[field].trim()
  if (raw === '') return 'empty'
  return parseRate(raw) === null ? 'bad' : 'ok'
}

/** The one thing keeping this row out of the file, or null when it is writable:
 *  shown next to the row's own fields (never only in the footer). */
export function rowIssue(model: ModelDraft): string | null {
  const seen = new Set<string>()
  for (const segment of sortedSegments(model)) {
    if (segment.from !== '' && !DATE_RE.test(segment.from)) return `生效日期「${segment.from}」不是 YYYY-MM-DD`
    if (seen.has(segment.from)) return segment.from === '' ? '有两段价都填了「最早一段」' : `有两段价都从 ${segment.from} 起生效`
    seen.add(segment.from)
    for (const [field, label] of [['input', '输入价'], ['output', '输出价']] as const) {
      const state = fieldState(segment, field)
      if (state === 'bad') return `${label}「${segment[field].trim()}」不是有效的非负数字`
      if (state === 'empty') return `${label}还空着`
    }
    for (const [field, label] of [['cacheRead', '缓存读价'], ['cacheWrite', '缓存写价']] as const) {
      if (fieldState(segment, field) === 'bad') return `${label}「${segment[field].trim()}」不是有效的非负数字`
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

/** The ¥/M numbers of one draft segment, or null while a required field is not
 *  a non-negative number yet (the cache buckets are optional). */
export function ratesOf(segment: SegmentDraft): DraftRates | null {
  const input = parseRate(segment.input)
  const output = parseRate(segment.output)
  if (input === null || output === null) return null
  const cacheRead = parseRate(segment.cacheRead)
  const cacheWrite = parseRate(segment.cacheWrite)
  return {
    input,
    output,
    ...(cacheRead !== null ? { cacheRead } : {}),
    ...(cacheWrite !== null ? { cacheWrite } : {}),
  }
}

/** The signature of one model row: exactly what a save would write for it, so
 *  the tab can tell an edited row from a clean one. */
export function modelSignature(model: ModelDraft): string {
  return JSON.stringify(sortedSegments(model).map(segment => ({
    from: segment.from === '' ? null : segment.from,
    rates: ratesOf(segment),
    note: segment.note.trim(),
  })))
}

/** The combined key of one card row. */
export function rowKey(route: string, model: string): string {
  return `${route}\u0000${model}`
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
      if (row.segments.length === 0) continue
      const where = `「${route}」的「${model}」`
      const segments: Record<string, unknown>[] = []
      const seen = new Set<string>()
      for (const segment of sortedSegments(row)) {
        const from = segment.from.trim()
        if (from !== '' && !DATE_RE.test(from)) {
          return { ok: false, error: `${where}的生效日期必须是 YYYY-MM-DD（当前「${from}」）` }
        }
        if (seen.has(from)) {
          return { ok: false, error: `${where}有两段价填了同一个生效日期（${from === '' ? '最早一段' : from}）` }
        }
        seen.add(from)
        const rates = ratesOf(segment)
        if (rates === null) return { ok: false, error: `${where}的输入价 / 输出价必须是非负数字` }
        const out: Record<string, unknown> = {}
        if (from !== '') out.from = from
        for (const [draftKey, wireKey] of RATE_FIELD_NAMES) {
          const value = rates[draftKey]
          if (value !== undefined) out[wireKey] = value
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
 *  signature moved, a route when its billing switch did. */
export function baselinesOf(view: PricingView): { models: Map<string, string>; billing: Map<string, BillingNature> } {
  const models = new Map<string, string>()
  const billing = new Map<string, BillingNature>()
  for (const card of view.routes) {
    billing.set(card.route, card.billing)
    for (const row of card.models) {
      models.set(rowKey(card.route, row.model), modelSignature({
        model: row.model,
        configured: row.configured,
        records: row.records,
        segments: row.segments.map(segmentDraft),
      }))
    }
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
