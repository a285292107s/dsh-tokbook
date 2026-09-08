/**
 * Pricing vocabulary and store of the token-book: per-model price rules (¥ per
 * million tokens) backing the cost figures of the overview. Two sources merge
 * on read — the cloud feed mirrored on startup into `<data dir>/pricing.ccsa.json`,
 * and the hand-edited `<data dir>/pricing.json`, whose entries always win and
 * replace a model's cloud rules wholesale. Absent files mean no pricing; a
 * malformed file reads as empty, so a broken table never blocks the route.
 *
 * A second mirror — the **provider overlay** (`<data dir>/provider-pricing.ccsa.json`)
 * — maps exact ledger model strings per provider route to a billing nature
 * (`metered` vs `subscription`) and a price source: follow another base model's
 * full rule set (`inheritBase`), or an explicit user timeline of flat segment
 * prices (`segments`). Resolution is therefore dual-dimensional: the effective
 * price of one record comes from `(provider, model)` — never `model` alone —
 * resolved at the record's own timestamp, and the resulting amount lands in
 * either the real-spend bucket or the subscription-value bucket.
 *
 * Every record is priced individually through the rule chain — time-rule
 * container first, then context tier, then peak slot — and the aggregation
 * keeps rows per (day, model, provider, rate identity), so re-pricing under an
 * updated table needs no rebuild. The context size for tier matching is
 * approximated by the request's input-side tokens (input + cacheRead +
 * cacheWrite).
 *
 * @module dsh-tokbook/pricing
 */

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  BillingNature, ContextTier, DailySlot, ModelPricing, ModelRates, PricingSegment, PricingTable, PricingViewRow, ProviderPricingEntry, ProviderPricingTable, ProviderPricingViewRow, RateKey, TimeRule, UsageTotals,
} from './types.ts'

/** The hand-maintained pricing file inside the data directory. */
export const PRICING_FILE = 'pricing.json'

/** The cloud-feed mirror written on startup. */
export const PRICING_CCSA_FILE = 'pricing.ccsa.json'

/** The provider-overlay mirror written on startup. */
export const PROVIDER_PRICING_CCSA_FILE = 'provider-pricing.ccsa.json'

/** The hand-maintained provider-overlay file (user edits win over the mirror). */
export const PROVIDER_PRICING_FILE = 'provider-pricing.json'

/** Default domestic (China) cloud pricing feed (¥ per million tokens, RMB). */
export const DEFAULT_PRICING_URL_DOMESTIC = 'https://gitee.com/oyw125/model-price-table/raw/master/model_pricing.json'

/** Default overseas cloud pricing feed (same table mirrored to GitHub). */
export const DEFAULT_PRICING_URL_OVERSEAS = 'https://raw.githubusercontent.com/LaoYueHanNi/model-price-table/master/model_pricing.json'

/** Default provider-overlay pricing feed (dsh-model-pricing mirror). */
export const DEFAULT_PROVIDER_PRICING_URL = 'https://raw.githubusercontent.com/a285292107s/dsh-model-pricing/master/provider_pricing.json'

/** Stand-in RMB-per-USD rate until the feed carries a usable one. */
export const DEFAULT_USD_EXCHANGE_RATE = 7

export type PricingRegion = 'domestic' | 'overseas'

export interface PricingSourceInput {
  pricingUrl?: string
  pricingUrlDomestic?: string
  pricingUrlOverseas?: string
  pricingProviderUrl?: string
  pricingRegion?: PricingRegion
}

/** Resolve the feed URL: an explicit `pricingUrl` wins; otherwise the region
 * picks the domestic (default) or overseas mirror. */ 
export function resolvePricingUrl(input: PricingSourceInput = {}): string {
  if (input.pricingUrl !== undefined) return input.pricingUrl
  if (input.pricingRegion === 'overseas') {
    return input.pricingUrlOverseas ?? DEFAULT_PRICING_URL_OVERSEAS
  }
  return input.pricingUrlDomestic ?? DEFAULT_PRICING_URL_DOMESTIC
}

/** Resolve the provider-overlay feed URL: an explicit `pricingProviderUrl`
 * wins; otherwise the mirror default (which is provider-agnostic — the same
 * repo holds both layers, so the region split does not apply here). */
export function resolveProviderPricingUrl(input: PricingSourceInput = {}): string {
  return input.pricingProviderUrl ?? DEFAULT_PROVIDER_PRICING_URL
}

function isRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

// ---------------------------------------------------------------------------
// Cloud feed shapes (raw, as served by the model-price-table repository)
// ---------------------------------------------------------------------------

interface CloudRates {
  inputCostPerMillion: number
  outputCostPerMillion: number
  cacheReadCostPerMillion?: number
  cacheCreationCostPerMillion?: number
  dailySlots?: CloudSlot[]
}

interface CloudTier extends CloudRates {
  threshold: number
}

interface CloudTimeRule extends CloudRates {
  label?: string
  startTime: number
  endTime: number
  contextTiers?: CloudTier[]
}

interface CloudSlot {
  label?: string
  windows: Array<{ startMinute: number; endMinute: number }>
  daysOfWeek?: number[]
  inputCostPerMillion: number
  outputCostPerMillion: number
  cacheReadCostPerMillion?: number
  cacheCreationCostPerMillion?: number
}

export interface CloudPricingModel extends CloudRates {
  modelId: string
  contextTiers?: CloudTier[]
  timeRules?: CloudTimeRule[]
  aliases?: string[]
}

export interface CloudPricingData {
  version: number
  updatedAt: number
  currency: string
  usdExchangeRate?: number
  models: CloudPricingModel[]
}

function coerceRates(value: unknown): CloudRates | null {
  if (typeof value !== 'object' || value === null) return null
  const node = value as Record<string, unknown>
  if (!isRate(node.inputCostPerMillion) || !isRate(node.outputCostPerMillion)) return null
  return {
    inputCostPerMillion: node.inputCostPerMillion,
    outputCostPerMillion: node.outputCostPerMillion,
    ...(isRate(node.cacheReadCostPerMillion) ? { cacheReadCostPerMillion: node.cacheReadCostPerMillion } : {}),
    ...(isRate(node.cacheCreationCostPerMillion) ? { cacheCreationCostPerMillion: node.cacheCreationCostPerMillion } : {}),
    ...(Array.isArray(node.dailySlots)
      ? { dailySlots: (node.dailySlots as unknown[]).map(coerceSlot).filter((slot): slot is CloudSlot => slot !== null) }
      : {}),
  }
}

function coerceTier(value: unknown): CloudTier | null {
  if (typeof value !== 'object' || value === null) return null
  const tier = value as Record<string, unknown>
  if (!isRate(tier.threshold)) return null
  const rates = coerceRates(value)
  return rates === null ? null : { ...rates, threshold: tier.threshold }
}

function coerceSlot(value: unknown): CloudSlot | null {
  if (typeof value !== 'object' || value === null) return null
  const slot = value as Record<string, unknown>
  if (!Array.isArray(slot.windows)) return null
  const windows: Array<{ startMinute: number; endMinute: number }> = []
  for (const window of slot.windows) {
    if (typeof window !== 'object' || window === null) continue
    const w = window as Record<string, unknown>
    if (isRate(w.startMinute) && isRate(w.endMinute)) windows.push({ startMinute: w.startMinute, endMinute: w.endMinute })
  }
  if (windows.length === 0) return null
  const rates = coerceRates(value)
  if (rates === null) return null
  const days = Array.isArray(slot.daysOfWeek)
    ? [...new Set(slot.daysOfWeek.filter((day): day is number => typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 7))]
    : []
  return {
    windows,
    inputCostPerMillion: rates.inputCostPerMillion,
    outputCostPerMillion: rates.outputCostPerMillion,
    ...(rates.cacheReadCostPerMillion !== undefined ? { cacheReadCostPerMillion: rates.cacheReadCostPerMillion } : {}),
    ...(rates.cacheCreationCostPerMillion !== undefined ? { cacheCreationCostPerMillion: rates.cacheCreationCostPerMillion } : {}),
    ...(days.length > 0 ? { daysOfWeek: days } : {}),
    ...(typeof slot.label === 'string' ? { label: slot.label } : {}),
  }
}

function coerceTimeRule(value: unknown): CloudTimeRule | null {
  if (typeof value !== 'object' || value === null) return null
  const rule = value as Record<string, unknown>
  if (!isRate(rule.startTime) || !isRate(rule.endTime)) return null
  const rates = coerceRates(value)
  if (rates === null) return null
  const tiers = Array.isArray(rule.contextTiers)
    ? (rule.contextTiers as unknown[]).map(coerceTier).filter((tier): tier is CloudTier => tier !== null)
    : []
  return {
    ...rates,
    startTime: rule.startTime,
    endTime: rule.endTime,
    ...(typeof rule.label === 'string' ? { label: rule.label } : {}),
    ...(tiers.length > 0 ? { contextTiers: tiers } : {}),
  }
}

/** Coerce an unknown value into the cloud feed shape, dropping invalid model
 * rows and any non-RMB currency. */
export function coerceCloudPricing(value: unknown): CloudPricingData | null {
  if (typeof value !== 'object' || value === null) return null
  const feed = value as Record<string, unknown>
  if (!Array.isArray(feed.models)) return null
  if (typeof feed.currency !== 'string' || feed.currency !== 'RMB') return null
  const models: CloudPricingModel[] = []
  for (const raw of feed.models as unknown[]) {
    if (typeof raw !== 'object' || raw === null) continue
    const row = raw as Record<string, unknown>
    const rates = coerceRates(raw)
    if (rates === null || typeof row.modelId !== 'string' || row.modelId === '') continue
    models.push({
      ...rates,
      modelId: row.modelId,
      ...(Array.isArray(row.contextTiers)
        ? { contextTiers: (row.contextTiers as unknown[]).map(coerceTier).filter((tier): tier is CloudTier => tier !== null) }
        : {}),
      ...(Array.isArray(row.timeRules)
        ? { timeRules: (row.timeRules as unknown[]).map(coerceTimeRule).filter((rule): rule is CloudTimeRule => rule !== null) }
        : {}),
      ...(Array.isArray(row.aliases) && row.aliases.every(alias => typeof alias === 'string')
        ? { aliases: row.aliases as string[] }
        : {}),
    })
  }
  return {
    version: typeof feed.version === 'number' ? feed.version : 0,
    updatedAt: typeof feed.updatedAt === 'number' ? feed.updatedAt : 0,
    currency: feed.currency,
    ...(typeof feed.usdExchangeRate === 'number' && Number.isFinite(feed.usdExchangeRate) && feed.usdExchangeRate > 0
      ? { usdExchangeRate: feed.usdExchangeRate } : {}),
    models,
  }
}

// ---------------------------------------------------------------------------
// Cloud feed → ModelRates
// ---------------------------------------------------------------------------

function toPricing(rates: CloudRates): ModelPricing {
  return {
    inputPerMillion: rates.inputCostPerMillion,
    outputPerMillion: rates.outputCostPerMillion,
    ...(rates.cacheReadCostPerMillion !== undefined ? { cacheReadPerMillion: rates.cacheReadCostPerMillion } : {}),
    ...(rates.cacheCreationCostPerMillion !== undefined ? { cacheWritePerMillion: rates.cacheCreationCostPerMillion } : {}),
  }
}

function toSlots(slots: CloudSlot[] | undefined): DailySlot[] {
  return slots?.map(slot => ({
    windows: slot.windows,
    ...(slot.daysOfWeek !== undefined ? { daysOfWeek: slot.daysOfWeek } : {}),
    rates: toPricing(slot),
    ...(slot.label !== undefined ? { label: slot.label } : {}),
  })) ?? []
}

function toTiers(tiers: CloudTier[] | undefined): ContextTier[] {
  return tiers?.map(tier => ({
    threshold: tier.threshold,
    rates: toPricing(tier),
    ...(tier.dailySlots !== undefined ? { dailySlots: toSlots(tier.dailySlots) } : {}),
  })) ?? []
}

function toTimeRules(rules: CloudTimeRule[] | undefined): TimeRule[] {
  return rules?.map(rule => ({
    startTime: rule.startTime,
    endTime: rule.endTime,
    rates: toPricing(rule),
    ...(rule.contextTiers !== undefined ? { contextTiers: toTiers(rule.contextTiers) } : {}),
    ...(rule.dailySlots !== undefined ? { dailySlots: toSlots(rule.dailySlots) } : {}),
    ...(rule.label !== undefined ? { label: rule.label } : {}),
  })) ?? []
}

function cloudModelRates(model: CloudPricingModel): ModelRates {
  return {
    base: toPricing(model),
    contextTiers: toTiers(model.contextTiers),
    dailySlots: toSlots(model.dailySlots),
    timeRules: toTimeRules(model.timeRules),
  }
}

/** Flatten one cloud feed into a pricing table: every `modelId` becomes a key,
 * every alias becomes a key holding the same rule set. */
export function cloudToTable(feed: CloudPricingData): PricingTable {
  const table: PricingTable = {}
  for (const model of feed.models) {
    for (const alias of model.aliases ?? []) {
      if (alias !== '' && !(alias in table)) table[alias] = cloudModelRates(model)
    }
  }
  for (const model of feed.models) table[model.modelId] = cloudModelRates(model)
  return table
}

// ---------------------------------------------------------------------------
// Provider overlay feed (dsh-model-pricing `provider_pricing.json`) → table
// ---------------------------------------------------------------------------

interface CloudProviderSegment {
  from?: unknown
  to?: unknown
  rate?: unknown
  note?: unknown
}

interface CloudProviderEntry {
  model?: unknown
  billing?: unknown
  inheritBase?: unknown
  segments?: unknown
  placeholder?: unknown
  note?: unknown
}

interface CloudProviderGroup {
  provider?: unknown
  entries?: unknown
}

interface CloudProviderData {
  currency?: unknown
  providers?: unknown
}

function isBillingNature(value: unknown): value is BillingNature {
  return value === 'metered' || value === 'subscription'
}

function coerceSegment(value: unknown): PricingSegment | null {
  if (typeof value !== 'object' || value === null) return null
  const seg = value as CloudProviderSegment
  if (typeof seg.rate !== 'object' || seg.rate === null || !isModelPricing(seg.rate)) return null
  return {
    ...(seg.from !== undefined && typeof seg.from === 'number' && Number.isFinite(seg.from) ? { from: seg.from } : {}),
    ...(seg.to !== undefined && typeof seg.to === 'number' && Number.isFinite(seg.to) ? { to: seg.to } : {}),
    rate: seg.rate,
    ...(typeof seg.note === 'string' ? { note: seg.note } : {}),
  }
}

function coerceProviderEntry(value: unknown): ProviderPricingEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as CloudProviderEntry
  const out: ProviderPricingEntry = {}
  if (raw.billing !== undefined) {
    if (!isBillingNature(raw.billing)) return null
    out.billing = raw.billing
  }
  const inheritBase = typeof raw.inheritBase === 'string' && raw.inheritBase !== '' ? raw.inheritBase : undefined
  const segments = Array.isArray(raw.segments)
    ? (raw.segments as unknown[]).map(coerceSegment).filter((seg): seg is PricingSegment => seg !== null)
    : []
  if (inheritBase !== undefined) out.inheritBase = inheritBase
  if (segments.length > 0) out.segments = segments
  // A bare entry with neither source is a useless override: reject it (keeps
  // the table honest instead of silently pricing everything to ¥0).
  if (inheritBase === undefined && segments.length === 0) return null
  if (raw.placeholder === true) out.placeholder = true
  if (typeof raw.note === 'string') out.note = raw.note
  return out
}

function coerceProviderGroup(value: unknown): { provider: string; entries: Record<string, ProviderPricingEntry> } | null {
  if (typeof value !== 'object' || value === null) return null
  const group = value as CloudProviderGroup
  if (typeof group.provider !== 'string' || group.provider === '' || !Array.isArray(group.entries)) return null
  const entries: Record<string, ProviderPricingEntry> = {}
  for (const raw of group.entries as unknown[]) {
    if (typeof raw !== 'object' || raw === null) continue
    const model = (raw as CloudProviderEntry).model
    if (typeof model !== 'string' || model === '') continue
    const entry = coerceProviderEntry(raw)
    if (entry !== null) entries[model] = entry
  }
  if (Object.keys(entries).length === 0) return null
  return { provider: group.provider, entries }
}

/** Coerce the provider-overlay feed into the two-level table. Null when the
 *  feed is not the expected shape. */
export function coerceProviderPricing(value: unknown): ProviderPricingTable | null {
  if (typeof value !== 'object' || value === null) return null
  const feed = value as CloudProviderData
  if (!Array.isArray(feed.providers)) return null
  if (typeof feed.currency !== 'string' || feed.currency !== 'RMB') return null
  const table: ProviderPricingTable = {}
  for (const raw of feed.providers as unknown[]) {
    const group = coerceProviderGroup(raw)
    if (group === null) continue
    table[group.provider] = group.entries
  }
  return table
}

/** Coerce a hand-edited provider-overlay body (the `Record<provider, Record<
 *  model, entry>>` shape of `provider-pricing.json`) into the two-level table,
 *  dropping malformed entries — never fatal, like the model-level manual file.
 */
export function coerceManualProviderPricing(value: unknown): ProviderPricingTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const table: ProviderPricingTable = {}
  for (const [provider, models] of Object.entries(value)) {
    if (provider === '' || typeof models !== 'object' || models === null || Array.isArray(models)) continue
    const entries: Record<string, ProviderPricingEntry> = {}
    for (const [model, raw] of Object.entries(models)) {
      if (model === '' || typeof raw !== 'object' || raw === null) continue
      const entry = coerceProviderEntry(raw)
      if (entry !== null) entries[model] = entry
    }
    if (Object.keys(entries).length > 0) table[provider] = entries
  }
  return table
}

/** Read the hand-edited `provider-pricing.json` into the two-level table. */
export async function readManualProviderPricing(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<ProviderPricingTable> {
  return coerceManualProviderPricing(await readJsonFile(dir, PROVIDER_PRICING_FILE, logger))
}

/** Read the EFFECTIVE provider overlay: the synced cloud mirror as the base,
 * the hand-edited `provider-pricing.json` layered on top — a manual entry
 * wins wholesale for that exact (provider, model). Absent files read as empty,
 * so a broken table never blocks the route. */
export async function readProviderPricing(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<ProviderPricingTable> {
  const merged: ProviderPricingTable = { ...await readSyncedProviderPricing(dir, logger) }
  const manual = await readManualProviderPricing(dir, logger)
  for (const [provider, entries] of Object.entries(manual)) {
    merged[provider] = { ...merged[provider], ...entries }
  }
  return merged
}

async function readSyncedProviderPricing(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<ProviderPricingTable> {
  const raw = await readJsonFile(dir, PROVIDER_PRICING_CCSA_FILE, logger)
  if (raw === null) return {}
  const coerced = coerceProviderPricing(raw)
  if (coerced === null) {
    logger.error(`[tokbook] ${PROVIDER_PRICING_CCSA_FILE} is not a valid RMB provider overlay; treating as absent`)
    return {}
  }
  return coerced
}

/** Build the provider-overlay rows the 价格表 tab renders for its provider
 *  dimension: every (provider, model) of the hand-edited layer first (they are
 *  the ones the user maintains, and a hand row wins over a mirror row of the
 *  same pair), then every mirror (provider, model) not shadowed. Groups are
 *  alphabetical by provider, hand rows before mirror rows within one provider. */
export async function readProviderPricingView(
  dir: string,
  logger: { error(...args: unknown[]): void } = console,
): Promise<{ rows: ProviderPricingViewRow[]; dataDir: string }> {
  const rows: ProviderPricingViewRow[] = []
  const seen = new Set<string>()
  const toRow = (provider: string, model: string, entry: ProviderPricingEntry, manual: boolean): ProviderPricingViewRow => ({
    provider,
    model,
    manual,
    ...(entry.billing !== undefined ? { billing: entry.billing } : {}),
    ...(entry.inheritBase !== undefined ? { inheritBase: entry.inheritBase } : {}),
    ...(entry.segments !== undefined ? { segments: entry.segments } : {}),
    ...(entry.placeholder === true ? { placeholder: true } : {}),
    ...(entry.note !== undefined ? { note: entry.note } : {}),
  })
  const manual = await readManualProviderPricing(dir, logger)
  for (const [provider, entries] of Object.entries(manual)) {
    for (const [model, entry] of Object.entries(entries)) {
      rows.push(toRow(provider, model, entry, true))
      seen.add(`${provider}\n${model}`)
    }
  }
  const synced = await readSyncedProviderPricing(dir, logger)
  for (const [provider, entries] of Object.entries(synced)) {
    for (const [model, entry] of Object.entries(entries)) {
      if (seen.has(`${provider}\n${model}`)) continue // hand row shadows the mirror row
      rows.push(toRow(provider, model, entry, false))
    }
  }
  rows.sort((a, b) =>
    a.provider < b.provider ? -1 : a.provider > b.provider ? 1
      : a.model < b.model ? -1 : a.model > b.model ? 1 : 0)
  return { rows, dataDir: dir }
}

/** Outcome of validating a client-submitted manual provider-overlay body. */
export type ManualProviderPricingParse =
  | { ok: true; table: ProviderPricingTable }
  | { ok: false; error: string }

/** Validate a manual provider-overlay body (as sent by the 价格表 tab) into
 *  the two-level table. The body is the COMPLETE desired manual overlay
 *  (`provider` → `model` → entry), whole-table semantics like the model-level
 *  manual file: an omitted (provider, model) drops its override. A malformed
 *  body is REJECTED with a reason — this is the write path, where a typo must
 *  surface. The empty object is valid: it removes every manual override. */
export function parseManualProviderPricingInput(value: unknown): ManualProviderPricingParse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: '手工 provider 覆盖必须是 JSON 对象（provider → model → 条目）' }
  }
  const table: ProviderPricingTable = {}
  for (const [provider, models] of Object.entries(value)) {
    if (provider === '') return { ok: false, error: '存在空 provider 名' }
    if (provider.length > 128) return { ok: false, error: `provider 名过长：${provider.slice(0, 40)}…` }
    if (typeof models !== 'object' || models === null || Array.isArray(models)) {
      return { ok: false, error: `「${provider}」的覆盖必须是对象（model → 条目）` }
    }
    const entries: Record<string, ProviderPricingEntry> = {}
    for (const [model, raw] of Object.entries(models)) {
      if (model === '') return { ok: false, error: `「${provider}」下存在空模型名` }
      if (model.length > 256) return { ok: false, error: `模型名过长：${model.slice(0, 40)}…` }
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return { ok: false, error: `「${provider}/${model}」的条目必须是对象` }
      }
      const entry = raw as Record<string, unknown>
      if (entry.billing !== undefined && !isBillingNature(entry.billing)) {
        return { ok: false, error: `「${provider}/${model}」的 billing 必须是 "metered" 或 "subscription"` }
      }
      const out: ProviderPricingEntry = {}
      if (entry.billing !== undefined) out.billing = entry.billing
      const inheritBase = entry.inheritBase
      const segments = Array.isArray(entry.segments) ? entry.segments as unknown[] : undefined
      if (inheritBase !== undefined && (typeof inheritBase !== 'string' || inheritBase === '')) {
        return { ok: false, error: `「${provider}/${model}」的 inheritBase 必须是非空模型名` }
      }
      if (segments !== undefined) {
        const parsed: PricingSegment[] = []
        for (const rawSegment of segments) {
          const segment = parseProviderSegment(rawSegment)
          if (segment === null) {
            return { ok: false, error: `「${provider}/${model}」的 segments 含非法段（需要 rate.inputPerMillion / outputPerMillion）` }
          }
          parsed.push(segment)
        }
        if (parsed.length === 0) return { ok: false, error: `「${provider}/${model}」的 segments 不能为空` }
        out.segments = parsed
      }
      // inheritBase and segments are alternative price sources; an entry that
      // names both is ambiguous (resolution would silently prefer one) — reject.
      if (inheritBase !== undefined && segments !== undefined) {
        return { ok: false, error: `「${provider}/${model}」不能同时给出 inheritBase 与 segments` }
      }
      if (inheritBase !== undefined) out.inheritBase = inheritBase
      // A row must override something: an inheritBase or at least one segment.
      if (out.inheritBase === undefined && out.segments === undefined) {
        return { ok: false, error: `「${provider}/${model}」必须给出 inheritBase 或 segments（否则删除覆盖即可，不必保留空条目）` }
      }
      if (entry.placeholder === true) out.placeholder = true
      if (typeof entry.note === 'string' && entry.note !== '') out.note = entry.note
      entries[model] = out
    }
    if (Object.keys(entries).length > 0) table[provider] = entries
  }
  return { ok: true, table }
}

function parseProviderSegment(value: unknown): PricingSegment | null {
  if (typeof value !== 'object' || value === null) return null
  const seg = value as CloudProviderSegment
  if (typeof seg.rate !== 'object' || seg.rate === null || !isModelPricing(seg.rate)) return null
  const out: PricingSegment = { rate: seg.rate }
  if (seg.from !== undefined) {
    if (typeof seg.from !== 'number' || !Number.isFinite(seg.from)) return null
    out.from = seg.from
  }
  if (seg.to !== undefined) {
    if (typeof seg.to !== 'number' || !Number.isFinite(seg.to)) return null
    out.to = seg.to
  }
  if (typeof seg.note === 'string' && seg.note !== '') out.note = seg.note
  return out
}

/** Persist the hand-edited `provider-pricing.json` atomically (temp file +
 *  rename; the same recipe the other writers use). Replaces the whole file. */
export async function writeManualProviderPricing(
  dir: string,
  table: ProviderPricingTable,
  logger: { error(...args: unknown[]): void } = console,
): Promise<void> {
  const target = join(dir, PROVIDER_PRICING_FILE)
  const tmp = join(dir, `${PROVIDER_PRICING_FILE}.tmp`)
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(tmp, `${JSON.stringify(table, null, 2)}\n`, 'utf8')
    await unlink(target).catch(() => undefined)
    await rename(tmp, target)
  } catch (error) {
    logger.error(`[tokbook] cannot write ${PROVIDER_PRICING_FILE}:`, error)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Per-record rate resolution (the analyzer's rule chain)
// ---------------------------------------------------------------------------

/** The context tier matching a context size: the highest threshold it reaches. */
function resolveTier(tiers: ContextTier[], contextSize: number): ContextTier | null {
  let best: ContextTier | null = null
  for (const tier of tiers) {
    if (tier.threshold <= contextSize && (best === null || tier.threshold > best.threshold)) best = tier
  }
  return best
}

function localMinuteOfDay(epochSeconds: number, tzOffsetHours: number): number {
  const local = epochSeconds + tzOffsetHours * 3600
  const secondOfDay = ((local % 86400) + 86400) % 86400
  return Math.floor(secondOfDay / 60)
}

/** ISO weekday (1=Monday … 7=Sunday) of a Unix-seconds timestamp under a tz
 * offset: 1970-01-01 was a Thursday, so local day 0 maps to 4. */
function localWeekday(epochSeconds: number, tzOffsetHours: number): number {
  const localDay = Math.floor((epochSeconds + tzOffsetHours * 3600) / 86400)
  return (((localDay + 3) % 7) + 7) % 7 + 1
}

/** The first peak slot that applies to the timestamp; -1 when off-peak. */
function matchingSlot(slots: DailySlot[] | undefined, epochSeconds: number, tzOffsetHours: number): number {
  if (slots === undefined || slots.length === 0) return -1
  const minute = localMinuteOfDay(epochSeconds, tzOffsetHours)
  const weekday = localWeekday(epochSeconds, tzOffsetHours)
  for (let index = 0; index < slots.length; index++) {
    const days = slots[index]!.daysOfWeek
    if (days !== undefined && days.length > 0 && !days.includes(weekday)) continue
    for (const window of slots[index]!.windows) {
      if (window.startMinute <= minute && minute < window.endMinute) return index
    }
  }
  return -1
}

interface RateNode {
  rates: ModelPricing
  slots: DailySlot[]
}

/** Resolve the rate one request was billed at, mirroring the analyzer's chain:
 * the time rule covering the timestamp first (its tiers, its slots), else the
 * model root (its tiers, its slots), else the base rates. */
export function resolveRate(
  rates: ModelRates,
  timeMs: number,
  contextTokens: number,
  tzOffsetHours: number = -new Date().getTimezoneOffset() / 60,
): { prices: ModelPricing; key: RateKey } {
  const seconds = Math.floor(timeMs / 1000)
  const rule = rates.timeRules.find(r => seconds >= r.startTime && seconds <= r.endTime) ?? null
  const tiers = rule?.contextTiers ?? rates.contextTiers
  const tier = resolveTier(tiers, contextTokens)
  const node: RateNode = tier !== null
    ? { rates: tier.rates, slots: tier.dailySlots ?? [] }
    : rule !== null
      ? { rates: rule.rates, slots: rule.dailySlots ?? [] }
      : { rates: rates.base, slots: rates.dailySlots }
  const slot = matchingSlot(node.slots, seconds, tzOffsetHours)
  return {
    prices: slot >= 0 ? node.slots[slot]!.rates : node.rates,
    key: {
      ruleStart: rule?.startTime ?? 0,
      ruleEnd: rule?.endTime ?? 0,
      tier: tier?.threshold ?? 0,
      slot,
    },
  }
}

/** Look the prices of a rate identity back up under the current rule set.
 * Structural drift falls back toward the base rates. */
export function ratesForKey(rates: ModelRates, key: RateKey): ModelPricing {
  const rule = key.ruleStart !== 0 || key.ruleEnd !== 0
    ? rates.timeRules.find(r => r.startTime === key.ruleStart && r.endTime === key.ruleEnd) ?? null
    : null
  const tiers = rule?.contextTiers ?? rates.contextTiers
  const tier = key.tier > 0 ? tiers.find(t => t.threshold === key.tier) ?? null : null
  const node: RateNode = tier !== null
    ? { rates: tier.rates, slots: tier.dailySlots ?? [] }
    : rule !== null
      ? { rates: rule.rates, slots: rule.dailySlots ?? [] }
      : { rates: rates.base, slots: rates.dailySlots }
  return key.slot >= 0 ? node.slots[key.slot]?.rates ?? node.rates : node.rates
}

/** The largest epoch-second boundary an open-ended provider segment maps to
 * (Year ~292M; JSON-safe, comfortably beyond any real timestamp). */
const OPEN_SEGMENT_END = Number.MAX_SAFE_INTEGER

/** How one (provider, model) resolved: which source won and what it meant. */
export type PricedSource = 'inheritBase' | 'segments' | 'base' | 'unpriced'

/** The outcome of resolving one (provider, model) record's price. */
export interface PricedResolution {
  /** The price applied at this record's timestamp. */
  prices: ModelPricing
  /** Rate identity under the effective rule container. */
  key: RateKey
  /** Billing nature of the channel; undefined = no provider entry (the cost
   * layer then treats priced rows as metered by default). */
  billing: BillingNature | undefined
  /** Which resolution branch won. */
  source: PricedSource
  /** The effective `ModelRates` the resolution ran against (for callers that
   * want to re-derive prices for a stored key later). */
  effective: ModelRates
}

/** The effective rule container one (provider, model) record resolves against:
 *  - a provider entry with `inheritBase` → that base model's FULL rules;
 *  - a provider entry with `segments` → a flat container whose time rules are
 *    the segment windows (outside any window the model's flat base applies, if
 *    the model has one, else ¥0);
 *  - otherwise → the model's own rules.
 * Returns null when nothing can price the string (no entry AND no base row). */
export function effectiveRatesOf(
  base: PricingTable,
  providers: ProviderPricingTable,
  provider: string | undefined,
  model: string,
): ModelRates | null {
  const entry = provider !== undefined && provider !== '' ? providers[provider]?.[model] : undefined
  if (entry?.inheritBase !== undefined) {
    const inherited = base[entry.inheritBase]
    if (inherited !== undefined) return inherited
    // Fall through: an inheritBase naming a model the base table lacks is a
    // stale override — behave as if the entry were absent.
  }
  if (entry?.segments !== undefined && entry.segments.length > 0) {
    const fallback = base[model]?.base ?? { inputPerMillion: 0, outputPerMillion: 0 }
    const timeRules: TimeRule[] = entry.segments.map((segment) => ({
      startTime: segment.from ?? 0,
      endTime: segment.to === undefined ? OPEN_SEGMENT_END : Math.max(segment.to - 1, segment.from ?? 0),
      rates: segment.rate,
    }))
    return { base: fallback, contextTiers: [], dailySlots: [], timeRules }
  }
  return base[model] ?? null
}

/** The billing nature of one (provider, model): the provider entry's explicit
 * value, else 'metered' (rows the overlay does not cover are treated as real
 * spend — the conservative default the plan's table assigns to 未知串 too). */
export function billingOf(providers: ProviderPricingTable, provider: string | undefined, model: string): BillingNature {
  const entry = provider !== undefined && provider !== '' ? providers[provider]?.[model] : undefined
  return entry?.billing ?? 'metered'
}

/** Resolve the price one (provider, model) record was billed at — the dual
 *  entry point that replaces the model-only `resolveRate` chain in the host:
 *  a provider-overlay entry for the record's EXACT string wins (following
 *  `inheritBase` into the base table's full rules, or `segments` by time),
 *  then the base table's model row, else unpriced. Segments are half-open
 *  `[from, to)` in epoch seconds; an entry outside every segment falls back to
 *  the model's flat base price when the model has one, else ¥0. */
export function resolvePriced(
  base: PricingTable,
  providers: ProviderPricingTable,
  provider: string | undefined,
  model: string,
  timeMs: number,
  contextTokens: number,
  tzOffsetHours: number = -new Date().getTimezoneOffset() / 60,
): PricedResolution {
  const entry = provider !== undefined && provider !== '' ? providers[provider]?.[model] : undefined
  // inheritBase: follow the full base rule set of the named modelId.
  if (entry?.inheritBase !== undefined) {
    const inherited = base[entry.inheritBase]
    if (inherited !== undefined) {
      const { prices, key } = resolveRate(inherited, timeMs, contextTokens, tzOffsetHours)
      return { prices, key, billing: entry.billing, source: 'inheritBase', effective: inherited }
    }
  }
  // segments: a flat price timeline owned by the provider entry.
  if (entry?.segments !== undefined && entry.segments.length > 0) {
    const effective = effectiveRatesOf(base, providers, provider, model)!
    const { prices, key } = resolveRate(effective, timeMs, contextTokens, tzOffsetHours)
    const seconds = Math.floor(timeMs / 1000)
    const covered = entry.segments.some(segment =>
      (segment.from ?? 0) <= seconds && (segment.to === undefined || seconds < segment.to))
    const source: PricedSource = covered ? 'segments' : 'base'
    return { prices, key, billing: entry.billing, source, effective }
  }
  const rules = base[model]
  if (rules === undefined) {
    return {
      prices: { inputPerMillion: 0, outputPerMillion: 0 },
      key: { ruleStart: 0, ruleEnd: 0, tier: 0, slot: -1 },
      billing: undefined,
      source: 'unpriced',
      effective: { base: { inputPerMillion: 0, outputPerMillion: 0 }, contextTiers: [], dailySlots: [], timeRules: [] },
    }
  }
  const { prices, key } = resolveRate(rules, timeMs, contextTokens, tzOffsetHours)
  return { prices, key, billing: undefined, source: 'base', effective: rules }
}

/** Billed cost of one totals row at a resolved price: each bucket billed at
 * its own per-million rate, cache buckets billed at their rate when present
 * and at the plain input rate otherwise. */
export function costOf(totals: UsageTotals, prices: ModelPricing): number {
  const M = 1_000_000
  const cacheRead = prices.cacheReadPerMillion ?? prices.inputPerMillion
  const cacheWrite = prices.cacheWritePerMillion ?? prices.inputPerMillion
  return (totals.inputTokens * prices.inputPerMillion
    + totals.outputTokens * prices.outputPerMillion
    + totals.cacheReadTokens * cacheRead
    + totals.cacheWriteTokens * cacheWrite) / M
}

// ---------------------------------------------------------------------------
// File store: cloud mirror + manual overrides
// ---------------------------------------------------------------------------

async function readJsonFile(dir: string, name: string, logger: { error(...args: unknown[]): void } = console): Promise<unknown> {
  let text: string
  try {
    text = await readFile(join(dir, name), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    logger.error(`[tokbook] cannot read ${name}:`, error)
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    logger.error(`[tokbook] ${name} is not valid JSON; treating as absent`)
    return null
  }
}

function isModelPricing(value: unknown): value is ModelPricing {
  if (typeof value !== 'object' || value === null) return false
  const pricing = value as Record<string, unknown>
  return isRate(pricing.inputPerMillion) && isRate(pricing.outputPerMillion)
    && (pricing.cacheReadPerMillion === undefined || isRate(pricing.cacheReadPerMillion))
    && (pricing.cacheWritePerMillion === undefined || isRate(pricing.cacheWritePerMillion))
}

/** Coerce a hand-edited file body into flat table entries (base rates only). */
export function coercePricingTable(value: unknown): Record<string, ModelPricing> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const table: Record<string, ModelPricing> = {}
  for (const [model, entry] of Object.entries(value)) {
    if (model === '' || !isModelPricing(entry)) continue
    table[model] = entry
  }
  return table
}

/** Read the hand-edited `pricing.json` into a flat table (entries with
 *  invalid rates are dropped, never fatal). */
export async function readManualPricing(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<Record<string, ModelPricing>> {
  return coercePricingTable(await readJsonFile(dir, PRICING_FILE, logger))
}

/** Outcome of validating a client-submitted manual pricing body. */
export type ManualPricingParse =
  | { ok: true; table: Record<string, ModelPricing> }
  | { ok: false; error: string }

/** Validate a manual pricing body (as sent by the 价格表 tab) into a flat
 *  table. Unlike {@link coercePricingTable}, a malformed body is REJECTED with
 *  a reason instead of silently dropping rows — this is the write path, where
 *  a typo must surface rather than disappear. The empty table is valid: it
 *  removes every manual override. */
export function parseManualPricingInput(value: unknown): ManualPricingParse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: '手工价格表必须是 JSON 对象（模型 → 单价）' }
  }
  const raw = value as Record<string, unknown>
  const table: Record<string, ModelPricing> = {}
  for (const [model, entry] of Object.entries(raw)) {
    if (model === '') return { ok: false, error: '存在空模型名' }
    if (model.length > 256) return { ok: false, error: `模型名过长：${model.slice(0, 40)}…` }
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, error: `「${model}」的单价必须是对象` }
    }
    const prices = entry as Record<string, unknown>
    const readRate = (key: string): number | undefined => {
      const v = prices[key]
      if (v === undefined) return undefined
      return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : NaN
    }
    const inputPerMillion = readRate('inputPerMillion')
    const outputPerMillion = readRate('outputPerMillion')
    if (inputPerMillion === undefined || outputPerMillion === undefined || Number.isNaN(inputPerMillion) || Number.isNaN(outputPerMillion)) {
      return { ok: false, error: `「${model}」缺少合法的 inputPerMillion / outputPerMillion（非负数字）` }
    }
    const out: ModelPricing = { inputPerMillion, outputPerMillion }
    const cacheReadPerMillion = readRate('cacheReadPerMillion')
    const cacheWritePerMillion = readRate('cacheWritePerMillion')
    if (cacheReadPerMillion !== undefined && Number.isNaN(cacheReadPerMillion)) {
      return { ok: false, error: `「${model}」的 cacheReadPerMillion 必须是非负数字` }
    }
    if (cacheWritePerMillion !== undefined && Number.isNaN(cacheWritePerMillion)) {
      return { ok: false, error: `「${model}」的 cacheWritePerMillion 必须是非负数字` }
    }
    if (cacheReadPerMillion !== undefined) out.cacheReadPerMillion = cacheReadPerMillion
    if (cacheWritePerMillion !== undefined) out.cacheWritePerMillion = cacheWritePerMillion
    table[model] = out
  }
  return { ok: true, table }
}

/** Persist the hand-edited `pricing.json` atomically (temp file + rename; the
 *  target is unlinked first because Windows rename-over-existing fails
 *  intermittently — the same recipe the quota snapshots and the cloud mirror
 *  use). Replaces the whole file; an absent cloud mirror is unaffected. */
export async function writeManualPricing(
  dir: string,
  table: Record<string, ModelPricing>,
  logger: { error(...args: unknown[]): void } = console,
): Promise<void> {
  const target = join(dir, PRICING_FILE)
  const tmp = join(dir, `${PRICING_FILE}.tmp`)
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(tmp, `${JSON.stringify(table, null, 2)}\n`, 'utf8')
    await unlink(target).catch(() => undefined)
    await rename(tmp, target)
  } catch (error) {
    logger.error('[tokbook] cannot write pricing.json:', error)
    throw error
  }
}

/** Assemble the pricing-table view the 价格表 tab renders: one row per exact
 *  model string a record can be billed under. Manual (`pricing.json`) entries
 *  come first — they are the ones the user maintains — then every cloud model
 *  id and alias from the synced mirror, each group alphabetical. A manual row
 *  that shadows a cloud string keeps its cloud base rates alongside (as a
 *  "参考" reference for the edit form); a manual-only row (a model the cloud
 *  never named) has no cloud side. Cloud rows expose their flat base rates
 *  plus a `layered` flag when the cloud entry also carries time rules /
 *  context tiers / peak slots: the billed rate then varies by time/context,
 *  and a manual entry replaces the whole rule set with flat prices.
 *
 *  `usedModels` (model string → ledger record count) marks models the ledger
 *  actually billed that neither the cloud feed nor a manual entry names —
 *  they currently bill ¥0, and surface at the top of the list as one-click
 *  manual seeds. */
export async function readPricingView(
  dir: string,
  usedModels: ReadonlyMap<string, number> = new Map(),
  logger: { error(...args: unknown[]): void } = console,
): Promise<{ rows: PricingViewRow[]; dataDir: string }> {
  const synced = await readSyncedPricing(dir, logger)
  const manual = await readManualPricing(dir, logger)
  const rows: PricingViewRow[] = []
  const seen = new Set<string>()
  const manualModels = Object.keys(manual).sort((a, b) => a.localeCompare(b))
  for (const model of manualModels) {
    const cloudRates = synced[model]?.base
    rows.push({ model, manual: true, manualRates: manual[model], cloudRates })
    seen.add(model)
  }
  // Ledger-billed strings with NO entry at all (neither manual nor cloud):
  // these bill ¥0 today, listed right under the manual rows as seeds.
  const unpriced = [...usedModels.keys()]
    .filter(model => !(model in synced) && !(model in manual))
    .sort((a, b) => a.localeCompare(b))
  for (const model of unpriced) {
    rows.push({ model, manual: false, unpriced: true, records: usedModels.get(model), cloudRates: undefined })
    seen.add(model)
  }
  const cloudModels = Object.keys(synced).sort((a, b) => a.localeCompare(b))
  for (const model of cloudModels) {
    if (seen.has(model)) continue
    const rates = synced[model]!
    rows.push({
      model,
      manual: false,
      cloudRates: rates.base,
      layered: rates.timeRules.length > 0 || rates.contextTiers.length > 0 || rates.dailySlots.length > 0,
    })
  }
  return { rows, dataDir: dir }
}

async function readSyncedPricing(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<PricingTable> {
  const feed = coerceCloudPricing(await readJsonFile(dir, PRICING_CCSA_FILE, logger))
  return feed === null ? {} : cloudToTable(feed)
}

/** Load the merged pricing table: the synced cloud mirror as the base, the
 * hand-edited `pricing.json` layered on top — a manual entry wins wholesale. */
export async function readPricingTable(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<PricingTable> {
  const merged: PricingTable = { ...await readSyncedPricing(dir, logger) }
  for (const [model, base] of Object.entries(await readManualPricing(dir, logger))) {
    merged[model] = { base, contextTiers: [], dailySlots: [], timeRules: [] }
  }
  return merged
}

/** The effective USD conversion rate of one data directory. */
export async function readUsdExchangeRate(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<number> {
  const feed = coerceCloudPricing(await readJsonFile(dir, PRICING_CCSA_FILE, logger))
  return feed?.usdExchangeRate ?? DEFAULT_USD_EXCHANGE_RATE
}

export interface CloudSyncResult {
  version: number
  updatedAt: number
  models: number
  aliases: number
  usdExchangeRate: number
}

export interface ProviderSyncResult {
  version: number
  updatedAt: number
  providers: number
  entries: number
}

/** Fetch the provider-overlay pricing feed and mirror it verbatim into
 * `<data dir>/provider-pricing.ccsa.json` (atomically: temp file + rename).
 * The same 1MB / RMB guardrail as the base feed. */
export async function syncProviderPricing(dir: string, url: string): Promise<ProviderSyncResult> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  const text = await response.text()
  if (text.length > 1_048_576) throw new Error('feed exceeds the 1MB limit')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('feed is not valid JSON')
  }
  const table = coerceProviderPricing(value)
  if (table === null) throw new Error('feed is not a valid RMB provider overlay')
  const raw = value as { version?: unknown; updatedAt?: unknown }
  const version = typeof raw.version === 'number' ? raw.version : 0
  const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : 0
  const target = join(dir, PROVIDER_PRICING_CCSA_FILE)
  const tmp = join(dir, `${PROVIDER_PRICING_CCSA_FILE}.tmp`)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(tmp, text.endsWith('\n') ? text : `${text}\n`, 'utf8')
  // Unlink before rename: Windows rename-over-existing fails intermittently.
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
  return {
    version,
    updatedAt,
    providers: Object.keys(table).length,
    entries: Object.values(table).reduce((sum, models) => sum + Object.keys(models).length, 0),
  }
}

/** Fetch the cloud pricing feed and mirror it verbatim into
 * `<data dir>/pricing.ccsa.json` (atomically: temp file + rename). */
export async function syncCloudPricing(dir: string, url: string): Promise<CloudSyncResult> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  const text = await response.text()
  if (text.length > 1_048_576) throw new Error('feed exceeds the 1MB limit')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('feed is not valid JSON')
  }
  const feed = coerceCloudPricing(value)
  if (feed === null) throw new Error('feed is not a valid RMB pricing table')
  const target = join(dir, PRICING_CCSA_FILE)
  const tmp = join(dir, `${PRICING_CCSA_FILE}.tmp`)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(tmp, text.endsWith('\n') ? text : `${text}\n`, 'utf8')
  // Unlink before rename: Windows rename-over-existing fails intermittently.
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
  return {
    version: feed.version,
    updatedAt: feed.updatedAt,
    models: feed.models.length,
    aliases: feed.models.reduce((sum, model) => sum + (model.aliases?.length ?? 0), 0),
    usdExchangeRate: feed.usdExchangeRate ?? DEFAULT_USD_EXCHANGE_RATE,
  }
}
