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
  BillingNature, ContextTier, DailySlot, ModelPricing, ModelRates, PricingNow, PricingSegment, PricingTable, PricingViewRow, ProviderAliasMap, ProviderPricingEntry, ProviderPricingTable, ProviderPricingViewRow, RateKey, RateWindow, TimeRule, UsageTotals,
} from './types.ts'

/** The hand-maintained pricing file inside the data directory. */
export const PRICING_FILE = 'pricing.json'

/** The cloud-feed mirror written on startup. */
export const PRICING_CCSA_FILE = 'pricing.ccsa.json'

/** The provider-overlay mirror written on startup. */
export const PROVIDER_PRICING_CCSA_FILE = 'provider-pricing.ccsa.json'

/** The hand-maintained provider-overlay file (user edits win over the mirror). */
export const PROVIDER_PRICING_FILE = 'provider-pricing.json'

/** The reserved top-level key of `provider-pricing.json` holding route aliases
 *  (`{ "$routes": { "plan-b": "plan-a" } }`): route → the route it follows. */
export const PROVIDER_ROUTES_KEY = '$routes'

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
  /** Model vendor / family the feed groups the model under (`deepseek`, `claude`,
   *  `qwen`, …) — display metadata only, never used by the price chain. */
  family?: string
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
      ...(typeof row.family === 'string' && row.family !== '' ? { family: row.family } : {}),
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

/** The vendor/family of every cloud key (each `modelId` plus its aliases) — the
 *  grouping the pricing tab renders the cloud reference list by. Key precedence
 *  mirrors {@link cloudToTable}: a modelId wins over another row's alias. */
export function cloudFamilies(feed: CloudPricingData): Record<string, string> {
  const families: Record<string, string> = {}
  for (const model of feed.models) {
    if (model.family === undefined) continue
    for (const alias of model.aliases ?? []) {
      if (alias !== '' && !(alias in families)) families[alias] = model.family
    }
  }
  for (const model of feed.models) if (model.family !== undefined) families[model.modelId] = model.family
  return families
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
  label?: unknown
  /** Channel-level billing nature; the default for every entry of the group. */
  billing?: unknown
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

function coerceProviderEntry(value: unknown, defaultBilling?: BillingNature): ProviderPricingEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as CloudProviderEntry
  const out: ProviderPricingEntry = {}
  if (raw.billing !== undefined) {
    if (!isBillingNature(raw.billing)) return null
    out.billing = raw.billing
  } else if (defaultBilling !== undefined) {
    // The channel's own billing nature covers every entry that does not
    // override it; stamping it here keeps the rest of the pipeline unchanged.
    out.billing = defaultBilling
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
  // A malformed channel-level billing is a malformed group, not a silent
  // fall-through to the metered default (that would mislabel a subscription
  // channel as real spend).
  if (group.billing !== undefined && !isBillingNature(group.billing)) return null
  const defaultBilling = group.billing === undefined ? undefined : group.billing
  const entries: Record<string, ProviderPricingEntry> = {}
  for (const raw of group.entries as unknown[]) {
    if (typeof raw !== 'object' || raw === null) continue
    const model = (raw as CloudProviderEntry).model
    if (typeof model !== 'string' || model === '') continue
    const entry = coerceProviderEntry(raw, defaultBilling)
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

/** The mirror feed's provider labels (`providers[].label`), route → label.
 *  Display-only: a route the feed does not label is simply absent, and a
 *  malformed label never invalidates the entries themselves. */
export function coerceProviderLabels(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {}
  const feed = value as CloudProviderData
  if (!Array.isArray(feed.providers)) return {}
  const labels: Record<string, string> = {}
  for (const raw of feed.providers as unknown[]) {
    if (typeof raw !== 'object' || raw === null) continue
    const group = raw as CloudProviderGroup
    if (typeof group.provider !== 'string' || group.provider === '') continue
    if (typeof group.label !== 'string' || group.label === '') continue
    labels[group.provider] = group.label
  }
  return labels
}

/** Coerce the hand file's `$routes` section into a one-hop alias map, dropping
 *  malformed pairs (lenient read path, like every other hand-file read). */
export function coerceProviderAliases(value: unknown): ProviderAliasMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const aliases: ProviderAliasMap = {}
  for (const [route, target] of Object.entries(value as Record<string, unknown>)) {
    if (route === '' || route === PROVIDER_ROUTES_KEY) continue
    if (typeof target !== 'string' || target === '' || target === route) continue
    aliases[route] = target
  }
  return aliases
}

/** One hand-edited overlay file: its per-route entries plus its route aliases. */
export interface ManualProviderOverlay {
  table: ProviderPricingTable
  routes: ProviderAliasMap
}

/** Coerce a hand-edited provider-overlay body (the `Record<provider, Record<
 *  model, entry>>` shape of `provider-pricing.json`, plus the reserved
 *  `$routes` key) into the two-level table, dropping malformed entries — never
 *  fatal, like the model-level manual file. Aliases are read separately by
 *  {@link coerceProviderAliases}. */
export function coerceManualProviderPricing(value: unknown): ProviderPricingTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const table: ProviderPricingTable = {}
  for (const [provider, models] of Object.entries(value)) {
    if (provider === '' || provider === PROVIDER_ROUTES_KEY || typeof models !== 'object' || models === null || Array.isArray(models)) continue
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

/** Read the hand-edited `provider-pricing.json` (entries + `$routes`). */
export async function readManualProviderOverlay(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<ManualProviderOverlay> {
  const raw = await readJsonFile(dir, PROVIDER_PRICING_FILE, logger)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { table: {}, routes: {} }
  return {
    table: coerceManualProviderPricing(raw),
    routes: coerceProviderAliases((raw as Record<string, unknown>)[PROVIDER_ROUTES_KEY]),
  }
}

/** Apply route aliases to a merged overlay: an aliased route inherits its
 *  target's entries, while the route's OWN entries (hand or mirror) win — an
 *  explicit per-route entry is the escape hatch that overrides the group.
 *  Computed against the UN-aliased table, so the result is order-independent
 *  and alias chains never apply (one hop, by construction). */
export function applyProviderAliases(table: ProviderPricingTable, routes: ProviderAliasMap): ProviderPricingTable {
  const aliased = Object.entries(routes)
  if (aliased.length === 0) return table
  const out: ProviderPricingTable = { ...table }
  for (const [route, target] of aliased) {
    if (route === target) continue
    const inherited = table[target]
    if (inherited === undefined) continue
    const own = table[route]
    out[route] = own === undefined ? { ...inherited } : { ...inherited, ...own }
  }
  return out
}

/** Read the EFFECTIVE provider overlay: the synced cloud mirror as the base,
 * the hand-edited `provider-pricing.json` layered on top — a manual entry
 * wins wholesale for that exact (provider, model) — then route aliases
 * materialized, so every lookup can stay a plain `providers[route][model]`.
 * Absent files read as empty, so a broken table never blocks the route. */
export async function readProviderPricing(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<ProviderPricingTable> {
  const merged: ProviderPricingTable = { ...(await readSyncedProviderPricing(dir, logger)).table }
  const manual = await readManualProviderOverlay(dir, logger)
  for (const [provider, entries] of Object.entries(manual.table)) {
    merged[provider] = { ...merged[provider], ...entries }
  }
  return applyProviderAliases(merged, manual.routes)
}

async function readSyncedProviderPricing(
  dir: string,
  logger: { error(...args: unknown[]): void } = console,
): Promise<{ table: ProviderPricingTable; labels: Record<string, string> }> {
  const raw = await readJsonFile(dir, PROVIDER_PRICING_CCSA_FILE, logger)
  if (raw === null) return { table: {}, labels: {} }
  const coerced = coerceProviderPricing(raw)
  if (coerced === null) {
    logger.error(`[tokbook] ${PROVIDER_PRICING_CCSA_FILE} is not a valid RMB provider overlay; treating as absent`)
    return { table: {}, labels: {} }
  }
  return { table: coerced, labels: coerceProviderLabels(raw) }
}

/** Build the provider-overlay rows the 价格表 tab renders for its provider
 *  dimension: every (provider, model) of the hand-edited layer first (they are
 *  the ones the user maintains, and a hand row wins over a mirror row of the
 *  same pair), then every mirror (provider, model) not shadowed. Groups are
 *  alphabetical by provider, hand rows before mirror rows within one provider.
 *  Each row also carries the EFFECTIVE rule container it prices through and
 *  the price that container resolves to now, so a 跟随基准 row shows the
 *  number it inherits instead of only naming the model it follows. */
export async function readProviderPricingView(
  dir: string,
  usedProviders: Iterable<string> = [],
  logger: { error(...args: unknown[]): void } = console,
): Promise<{ rows: ProviderPricingViewRow[]; dataDir: string; routes: ProviderAliasMap; names: string[]; labels: Record<string, string> }> {
  const rows: ProviderPricingViewRow[] = []
  const seen = new Set<string>()
  const manual = await readManualProviderOverlay(dir, logger)
  const { table: synced, labels } = await readSyncedProviderPricing(dir, logger)
  // The merged overlay + merged base table price every row through the same
  // dual-dimension chain the cost layer uses; aliases are materialized so an
  // inherited row prices exactly like the canonical row it follows.
  const merged: ProviderPricingTable = { ...synced }
  for (const [provider, entries] of Object.entries(manual.table)) merged[provider] = { ...merged[provider], ...entries }
  const overlay = applyProviderAliases(merged, manual.routes)
  const base = await readPricingTable(dir, logger)
  const toRow = (
    provider: string,
    model: string,
    entry: ProviderPricingEntry,
    manualRow: boolean,
    via?: string,
  ): ProviderPricingViewRow => {
    const rules = effectiveRatesOf(base, overlay, provider, model)
    return {
      provider,
      model,
      manual: manualRow,
      ...(via !== undefined ? { via } : {}),
      ...(entry.billing !== undefined ? { billing: entry.billing } : {}),
      ...(entry.inheritBase !== undefined ? { inheritBase: entry.inheritBase } : {}),
      ...(entry.segments !== undefined ? { segments: entry.segments } : {}),
      ...(entry.placeholder === true ? { placeholder: true } : {}),
      ...(entry.note !== undefined ? { note: entry.note } : {}),
      ...(rules !== null ? { rules, now: nowOf(rules) } : {}),
    }
  }
  for (const [provider, entries] of Object.entries(manual.table)) {
    for (const [model, entry] of Object.entries(entries)) {
      rows.push(toRow(provider, model, entry, true))
      seen.add(`${provider}\n${model}`)
    }
  }
  for (const [provider, entries] of Object.entries(synced)) {
    for (const [model, entry] of Object.entries(entries)) {
      if (seen.has(`${provider}\n${model}`)) continue // hand row shadows the mirror row
      rows.push(toRow(provider, model, entry, false))
      seen.add(`${provider}\n${model}`)
    }
  }
  // A route following another: synthesize the rows it inherits, so the tab
  // shows what that route actually pays and where to go edit it. A model the
  // route defines itself was already emitted above and is left alone.
  for (const [route, target] of Object.entries(manual.routes)) {
    if (route === target) continue
    const inherited = merged[target]
    if (inherited === undefined) continue
    for (const [model, entry] of Object.entries(inherited)) {
      if (seen.has(`${route}\n${model}`)) continue
      rows.push(toRow(route, model, entry, false, target))
      seen.add(`${route}\n${model}`)
    }
  }
  rows.sort((a, b) =>
    a.provider < b.provider ? -1 : a.provider > b.provider ? 1
      : a.model < b.model ? -1 : a.model > b.model ? 1 : 0)
  // Every route the tab can offer as an alias target: mirror/hand keys, alias
  // sources and targets, and the routes the ledger billed (a brand-new key has
  // no entries yet, so the ledger is the only place it appears).
  const names = [...new Set([
    ...Object.keys(merged),
    ...Object.keys(manual.routes),
    ...Object.values(manual.routes),
    ...usedProviders,
  ])].filter(name => name !== '').sort((a, b) => a.localeCompare(b))
  return { rows, dataDir: dir, routes: manual.routes, names, labels }
}

/** Outcome of validating a client-submitted manual provider-overlay body. */
export type ManualProviderPricingParse =
  | { ok: true; table: ProviderPricingTable; routes: ProviderAliasMap }
  | { ok: false; error: string }

/** Validate the `$routes` section of a submitted overlay body: route → the
 *  route it follows. Strict like the rest of the write path: one hop only
 *  (the target must not itself be an alias), never itself, non-empty names. */
function parseProviderAliasesInput(value: unknown): { ok: true; routes: ProviderAliasMap } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, routes: {} }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: `${PROVIDER_ROUTES_KEY} 必须是对象（路由 → 它跟随的路由）` }
  }
  const raw = value as Record<string, unknown>
  const routes: ProviderAliasMap = {}
  for (const [route, target] of Object.entries(raw)) {
    if (route === '') return { ok: false, error: `${PROVIDER_ROUTES_KEY} 下存在空路由名` }
    if (route.length > 128) return { ok: false, error: `路由名过长：${route.slice(0, 40)}…` }
    if (typeof target !== 'string' || target === '') {
      return { ok: false, error: `「${route}」跟随的路由名必须是非空字符串` }
    }
    if (target.length > 128) return { ok: false, error: `「${route}」跟随的路由名过长：${target.slice(0, 40)}…` }
    if (target === route) return { ok: false, error: `「${route}」不能跟随自己` }
    // One hop: following a route that itself follows another would make the
    // resolution order matter, so it is refused rather than silently flattened.
    if (target in raw) return { ok: false, error: `「${route}」跟随的「${target}」自己也在跟随别的路由（只允许一跳）` }
    routes[route] = target
  }
  return { ok: true, routes }
}

/** Validate a manual provider-overlay body (as sent by the 价格表 tab) into
 *  the two-level table plus its route aliases. The body is the COMPLETE
 *  desired manual overlay (`provider` → `model` → entry, plus the reserved
 *  `$routes` key), whole-table semantics like the model-level manual file: an
 *  omitted (provider, model) drops its override. A malformed body is REJECTED
 *  with a reason — this is the write path, where a typo must surface. The
 *  empty object is valid: it removes every manual override and alias. */
export function parseManualProviderPricingInput(value: unknown): ManualProviderPricingParse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: '手工 provider 覆盖必须是 JSON 对象（provider → model → 条目）' }
  }
  const raw = value as Record<string, unknown>
  const aliases = parseProviderAliasesInput(raw[PROVIDER_ROUTES_KEY])
  if (!aliases.ok) return aliases
  const table: ProviderPricingTable = {}
  for (const [provider, models] of Object.entries(raw)) {
    if (provider === PROVIDER_ROUTES_KEY) continue
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
  return { ok: true, table, routes: aliases.routes }
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
 *  rename; the same recipe the other writers use). Replaces the whole file;
 *  the `$routes` section is written only when there are aliases. */
export async function writeManualProviderOverlay(
  dir: string,
  overlay: ManualProviderOverlay,
  logger: { error(...args: unknown[]): void } = console,
): Promise<void> {
  const file: Record<string, unknown> = { ...overlay.table }
  if (Object.keys(overlay.routes).length > 0) file[PROVIDER_ROUTES_KEY] = overlay.routes
  const target = join(dir, PROVIDER_PRICING_FILE)
  const tmp = join(dir, `${PROVIDER_PRICING_FILE}.tmp`)
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(tmp, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
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

/** Which container (time rule) or peak slot decided one resolved rate, for
 *  display: the slot's label wins over its container's. */
export function describeRate(rules: ModelRates, key: RateKey): { label?: string; peak: boolean } {
  const rule = key.ruleStart !== 0 || key.ruleEnd !== 0
    ? rules.timeRules.find(r => r.startTime === key.ruleStart && r.endTime === key.ruleEnd) ?? null
    : null
  const slots = rule !== null ? rule.dailySlots ?? [] : rules.dailySlots
  const label = key.slot >= 0 ? slots[key.slot]?.label : rule?.label
  return { ...(label !== undefined ? { label } : {}), peak: key.slot >= 0 }
}

/** The price one rule set resolves to at `timeMs` (default: now), plus which
 *  rule/slot produced it. Context tiers are resolved at context 0, i.e. the
 *  price a request below every threshold pays — the honest headline number
 *  for a table whose tiers we do not model per request here. */
export function nowOf(
  rules: ModelRates,
  timeMs: number = Date.now(),
  tzOffsetHours: number = -new Date().getTimezoneOffset() / 60,
): PricingNow {
  const { prices, key } = resolveRate(rules, timeMs, 0, tzOffsetHours)
  return { rates: prices, ...describeRate(rules, key) }
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
      ...(segment.note !== undefined ? { label: segment.note } : {}),
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

// ---------------------------------------------------------------------------
// Hand-edited rule entries (`pricing.json`)
// ---------------------------------------------------------------------------

/** One hand-edited `pricing.json` entry as STORED in the file: the original
 *  flat rate slate, or a rule set — `base` plus an optional price timeline
 *  (`timeRules`, epoch-second windows) and recurring peak windows
 *  (`dailySlots`, local minute-of-day windows). Context tiers are deliberately
 *  NOT part of the manual layer. */
export type ManualPricingFileEntry = ModelPricing | ManualRulesFile

/** The layered (rule-set) shape of one hand-edited entry. */
export interface ManualRulesFile {
  base: ModelPricing
  timeRules?: ManualRuleFile[]
  dailySlots?: DailySlot[]
}

/** One price window as STORED in the file: an omitted `endTime` means
 *  permanent (the engine reads it as open-ended). */
export interface ManualRuleFile {
  label?: string
  startTime: number
  endTime?: number
  rates: ModelPricing
  dailySlots?: DailySlot[]
}

const MINUTES_PER_DAY = 1440

function isMinute(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MINUTES_PER_DAY
}

/** Coerce one peak window of the manual shape (lenient read path). */
function coerceManualWindow(value: unknown): RateWindow | null {
  if (typeof value !== 'object' || value === null) return null
  const window = value as Record<string, unknown>
  if (!isMinute(window.startMinute) || !isMinute(window.endMinute) || window.startMinute >= window.endMinute) return null
  return { startMinute: window.startMinute, endMinute: window.endMinute }
}

function coerceManualDays(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const days = [...new Set(value.filter((day): day is number => typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 7))]
  return days.length > 0 ? days : undefined
}

function coerceManualSlot(value: unknown): DailySlot | null {
  if (typeof value !== 'object' || value === null) return null
  const slot = value as Record<string, unknown>
  if (!isModelPricing(slot.rates) || !Array.isArray(slot.windows)) return null
  const windows = (slot.windows as unknown[]).map(coerceManualWindow).filter((window): window is RateWindow => window !== null)
  if (windows.length === 0) return null
  const days = coerceManualDays(slot.daysOfWeek)
  return {
    windows,
    rates: slot.rates,
    ...(days !== undefined ? { daysOfWeek: days } : {}),
    ...(typeof slot.label === 'string' && slot.label !== '' ? { label: slot.label } : {}),
  }
}

function coerceManualRule(value: unknown): TimeRule | null {
  if (typeof value !== 'object' || value === null) return null
  const rule = value as Record<string, unknown>
  if (typeof rule.startTime !== 'number' || !Number.isFinite(rule.startTime) || rule.startTime < 0) return null
  const endTime = rule.endTime === undefined ? OPEN_SEGMENT_END : rule.endTime
  if (typeof endTime !== 'number' || !Number.isFinite(endTime) || endTime < rule.startTime) return null
  if (!isModelPricing(rule.rates)) return null
  const slots = Array.isArray(rule.dailySlots)
    ? (rule.dailySlots as unknown[]).map(coerceManualSlot).filter((slot): slot is DailySlot => slot !== null)
    : []
  return {
    startTime: rule.startTime,
    endTime,
    rates: rule.rates,
    ...(slots.length > 0 ? { dailySlots: slots } : {}),
    ...(typeof rule.label === 'string' && rule.label !== '' ? { label: rule.label } : {}),
  }
}

/** Coerce ONE hand-edited entry into the engine rule shape: a bare rate slate
 *  (flat, the original format) or `{base, timeRules?, dailySlots?}`. Null when
 *  neither shape holds — the entry is then dropped, never fatal. */
export function coerceManualPricingEntry(value: unknown): ModelRates | null {
  if (isModelPricing(value)) return { base: value, contextTiers: [], dailySlots: [], timeRules: [] }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (!isModelPricing(raw.base)) return null
  const timeRules = Array.isArray(raw.timeRules)
    ? (raw.timeRules as unknown[]).map(coerceManualRule).filter((rule): rule is TimeRule => rule !== null)
    : []
  const dailySlots = Array.isArray(raw.dailySlots)
    ? (raw.dailySlots as unknown[]).map(coerceManualSlot).filter((slot): slot is DailySlot => slot !== null)
    : []
  return { base: raw.base, contextTiers: [], dailySlots, timeRules }
}

/** Serialize one rule set back to its file shape: a bare rate slate when the
 *  entry has no timeline and no peak windows (the original, most readable
 *  form), else the layered object. */
export function manualFileEntryOf(rates: ModelRates): ManualPricingFileEntry {
  if (rates.timeRules.length === 0 && rates.dailySlots.length === 0) return rates.base
  const out: ManualRulesFile = { base: rates.base }
  if (rates.timeRules.length > 0) {
    out.timeRules = rates.timeRules.map(rule => ({
      startTime: rule.startTime,
      ...(rule.endTime < OPEN_SEGMENT_END ? { endTime: rule.endTime } : {}),
      rates: rule.rates,
      ...(rule.dailySlots !== undefined && rule.dailySlots.length > 0 ? { dailySlots: rule.dailySlots } : {}),
      ...(rule.label !== undefined ? { label: rule.label } : {}),
    }))
  }
  if (rates.dailySlots.length > 0) out.dailySlots = rates.dailySlots
  return out
}

/** What the ledger knows about one model string, for the pricing view. */
export interface UsedModelHint {
  /** Ledger records naming this string. */
  records: number
  /** True when some provider-overlay entry already prices it — it is then NOT
   *  an unpriced model-layer seed (its money lives in the overlay layer). */
  overlayPriced: boolean
  /** The overlay-resolved price at view time, when the model layer does not
   *  price the string and an overlay entry does (so the row can show it). */
  overlayNow?: PricingNow
  /** The provider route that price came from. */
  overlayProvider?: string
}

/** Whether a rule set carries anything beyond its flat base rate. */
export function isLayeredRules(rates: ModelRates | undefined): boolean {
  return rates !== undefined
    && (rates.timeRules.length > 0 || rates.dailySlots.length > 0 || rates.contextTiers.length > 0)
}

type ManualEntryParse = { ok: true; rates: ModelRates } | { ok: false; error: string }
type RatesParse = { ok: true; rates: ModelPricing } | { ok: false; error: string }
type RulesParse = { ok: true; rules: TimeRule[] } | { ok: false; error: string }
type SlotsParse = { ok: true; slots: DailySlot[] } | { ok: false; error: string }

function parseManualEntry(raw: Record<string, unknown>, model: string): ManualEntryParse {
  const where = `「${model}」`
  if (!('base' in raw)) {
    const base = parseRatesObject(raw, where)
    if (!base.ok) return base
    return { ok: true, rates: { base: base.rates, contextTiers: [], dailySlots: [], timeRules: [] } }
  }
  const extra = Object.keys(raw).filter(key => key !== 'base' && key !== 'timeRules' && key !== 'dailySlots')
  if (extra.length > 0) {
    return { ok: false, error: `${where}的规则集含未知字段「${extra[0]!}」（只支持 base / timeRules / dailySlots）` }
  }
  const base = parseRatesObject(raw.base, `${where}的 base`)
  if (!base.ok) return base
  const rules = parseRulesList(raw.timeRules, where)
  if (!rules.ok) return rules
  const slots = parseSlotsList(raw.dailySlots, where)
  if (!slots.ok) return slots
  return {
    ok: true,
    rates: { base: base.rates, contextTiers: [], dailySlots: slots.slots, timeRules: rules.rules },
  }
}

function parseRatesObject(value: unknown, where: string): RatesParse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: `${where}必须是对象（inputPerMillion / outputPerMillion …）` }
  }
  const prices = value as Record<string, unknown>
  const readRate = (key: string): number | undefined => {
    const raw = prices[key]
    if (raw === undefined) return undefined
    return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : NaN
  }
  const inputPerMillion = readRate('inputPerMillion')
  const outputPerMillion = readRate('outputPerMillion')
  if (inputPerMillion === undefined || outputPerMillion === undefined || Number.isNaN(inputPerMillion) || Number.isNaN(outputPerMillion)) {
    return { ok: false, error: `${where}缺少合法的 inputPerMillion / outputPerMillion（非负数字）` }
  }
  const out: ModelPricing = { inputPerMillion, outputPerMillion }
  const cacheReadPerMillion = readRate('cacheReadPerMillion')
  const cacheWritePerMillion = readRate('cacheWritePerMillion')
  if (cacheReadPerMillion !== undefined && Number.isNaN(cacheReadPerMillion)) {
    return { ok: false, error: `${where}的 cacheReadPerMillion 必须是非负数字` }
  }
  if (cacheWritePerMillion !== undefined && Number.isNaN(cacheWritePerMillion)) {
    return { ok: false, error: `${where}的 cacheWritePerMillion 必须是非负数字` }
  }
  if (cacheReadPerMillion !== undefined) out.cacheReadPerMillion = cacheReadPerMillion
  if (cacheWritePerMillion !== undefined) out.cacheWritePerMillion = cacheWritePerMillion
  return { ok: true, rates: out }
}

function parseRulesList(value: unknown, model: string): RulesParse {
  if (value === undefined) return { ok: true, rules: [] }
  if (!Array.isArray(value)) return { ok: false, error: `「${model}」的 timeRules 必须是数组` }
  const rules: TimeRule[] = []
  let index = 0
  for (const raw of value as unknown[]) {
    index += 1
    const where = `「${model}」第 ${String(index)} 个调价段`
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: `${where}必须是对象` }
    const rule = raw as Record<string, unknown>
    const extra = Object.keys(rule).filter(key => key !== 'startTime' && key !== 'endTime' && key !== 'rates' && key !== 'label' && key !== 'dailySlots')
    if (extra.length > 0) return { ok: false, error: `${where}含未知字段「${extra[0]!}」` }
    const startTime = rule.startTime
    const endTime = rule.endTime === undefined ? OPEN_SEGMENT_END : rule.endTime
    if (typeof startTime !== 'number' || !Number.isFinite(startTime) || startTime < 0) {
      return { ok: false, error: `${where}的 startTime 必须是非负秒级时间戳` }
    }
    if (typeof endTime !== 'number' || !Number.isFinite(endTime) || endTime < startTime) {
      return { ok: false, error: `${where}的 endTime 必须 ≥ startTime（省略 = 永久）` }
    }
    const rates = parseRatesObject(rule.rates, where)
    if (!rates.ok) return rates
    const slots = parseSlotsList(rule.dailySlots, where)
    if (!slots.ok) return slots
    if (rule.label !== undefined && typeof rule.label !== 'string') return { ok: false, error: `${where}的 label 必须是字符串` }
    rules.push({
      startTime,
      endTime,
      rates: rates.rates,
      ...(slots.slots.length > 0 ? { dailySlots: slots.slots } : {}),
      ...(typeof rule.label === 'string' && rule.label !== '' ? { label: rule.label } : {}),
    })
  }
  // Overlapping windows are ambiguous (the engine takes the FIRST match) —
  // reject them so one instant can never have two prices. Then sort by start
  // so the stored order is the resolution order.
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i]!
      const b = rules[j]!
      if (a.startTime <= b.endTime && b.startTime <= a.endTime) {
        return { ok: false, error: `「${model}」第 ${String(i + 1)} 与第 ${String(j + 1)} 个调价段在时间上重叠（同一时刻只能有一段价）` }
      }
    }
  }
  rules.sort((a, b) => a.startTime - b.startTime)
  return { ok: true, rules }
}

function parseSlotsList(value: unknown, where: string): SlotsParse {
  if (value === undefined) return { ok: true, slots: [] }
  if (!Array.isArray(value)) return { ok: false, error: `${where}的 dailySlots 必须是数组` }
  const slots: DailySlot[] = []
  let index = 0
  for (const raw of value as unknown[]) {
    index += 1
    const label = `${where}第 ${String(index)} 个峰谷时段`
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: `${label}必须是对象` }
    const slot = raw as Record<string, unknown>
    const extra = Object.keys(slot).filter(key => key !== 'windows' && key !== 'rates' && key !== 'label' && key !== 'daysOfWeek')
    if (extra.length > 0) return { ok: false, error: `${label}含未知字段「${extra[0]!}」` }
    const rates = parseRatesObject(slot.rates, label)
    if (!rates.ok) return rates
    if (!Array.isArray(slot.windows) || slot.windows.length === 0) return { ok: false, error: `${label}至少需要一个时间窗口` }
    const windows: RateWindow[] = []
    for (const rawWindow of slot.windows as unknown[]) {
      if (typeof rawWindow !== 'object' || rawWindow === null || Array.isArray(rawWindow)) {
        return { ok: false, error: `${label}的时间窗口必须是对象` }
      }
      const window = rawWindow as Record<string, unknown>
      if (!isMinute(window.startMinute) || !isMinute(window.endMinute) || window.startMinute >= window.endMinute) {
        return { ok: false, error: `${label}的时间窗口需要 0–1440 的整数 startMinute < endMinute` }
      }
      windows.push({ startMinute: window.startMinute, endMinute: window.endMinute })
    }
    let days: number[] | undefined
    if (slot.daysOfWeek !== undefined) {
      if (!Array.isArray(slot.daysOfWeek)) return { ok: false, error: `${label}的 daysOfWeek 必须是 1–7 的整数数组` }
      const rawDays = slot.daysOfWeek as unknown[]
      const unique = [...new Set(rawDays.filter((day): day is number => typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 7))]
      if (unique.length !== rawDays.length) return { ok: false, error: `${label}的 daysOfWeek 只能是 1–7 的整数` }
      if (unique.length > 0) days = unique
    }
    if (slot.label !== undefined && typeof slot.label !== 'string') return { ok: false, error: `${label}的 label 必须是字符串` }
    slots.push({
      windows,
      rates: rates.rates,
      ...(days !== undefined ? { daysOfWeek: days } : {}),
      ...(typeof slot.label === 'string' && slot.label !== '' ? { label: slot.label } : {}),
    })
  }
  return { ok: true, slots }
}

/** Read the hand-edited `pricing.json` into the engine rule table (entries
 *  whose rates/rules are malformed are dropped, never fatal). */
export async function readManualPricing(
  dir: string,
  logger: { error(...args: unknown[]): void } = console,
): Promise<PricingTable> {
  const raw = await readJsonFile(dir, PRICING_FILE, logger)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const table: PricingTable = {}
  for (const [model, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (model === '') continue
    const rates = coerceManualPricingEntry(entry)
    if (rates === null) continue
    // Sort the hand timeline by start: the engine takes the first matching
    // window, so a stable order makes resolution deterministic (the write path
    // already refuses overlapping windows).
    table[model] = rates.timeRules.length > 1
      ? { ...rates, timeRules: [...rates.timeRules].sort((a, b) => a.startTime - b.startTime) }
      : rates
  }
  return table
}

/** Outcome of validating a client-submitted manual pricing body. */
export type ManualPricingParse =
  | { ok: true; table: PricingTable }
  | { ok: false; error: string }

/** Validate a manual pricing body (as sent by the 价格表 tab) into the engine
 *  rule table. Each entry is either a flat rate slate or a rule set
 *  (`{base, timeRules?, dailySlots?}`). Unlike {@link coerceManualPricingEntry},
 *  a malformed body is REJECTED with a reason instead of silently dropping rows
 *  — this is the write path, where a typo must surface rather than disappear.
 *  The empty table is valid: it removes every manual override. */
export function parseManualPricingInput(value: unknown): ManualPricingParse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: '手工价格表必须是 JSON 对象（模型 → 单价或规则集）' }
  }
  const table: PricingTable = {}
  for (const [model, entry] of Object.entries(value as Record<string, unknown>)) {
    if (model === '') return { ok: false, error: '存在空模型名' }
    if (model.length > 256) return { ok: false, error: `模型名过长：${model.slice(0, 40)}…` }
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, error: `「${model}」的条目必须是对象` }
    }
    const parsed = parseManualEntry(entry as Record<string, unknown>, model)
    if (!parsed.ok) return parsed
    table[model] = parsed.rates
  }
  return { ok: true, table }
}

/** Persist the hand-edited `pricing.json` atomically (temp file + rename; the
 *  target is unlinked first because Windows rename-over-existing fails
 *  intermittently — the same recipe the quota snapshots and the cloud mirror
 *  use). Replaces the whole file; an absent cloud mirror is unaffected. */
export async function writeManualPricing(
  dir: string,
  table: PricingTable,
  logger: { error(...args: unknown[]): void } = console,
): Promise<void> {
  const file: Record<string, ManualPricingFileEntry> = {}
  for (const [model, rates] of Object.entries(table)) file[model] = manualFileEntryOf(rates)
  const target = join(dir, PRICING_FILE)
  const tmp = join(dir, `${PRICING_FILE}.tmp`)
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(tmp, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
    await unlink(target).catch(() => undefined)
    await rename(tmp, target)
  } catch (error) {
    logger.error('[tokbook] cannot write pricing.json:', error)
    throw error
  }
}

/** Assemble the pricing-table view the 价格表 tab renders: one row per exact
 *  model string a record can be billed under. Manual (`pricing.json`) entries
 *  come first — they are the ones the user maintains — then ledger-billed
 *  strings with no model-layer entry, then every cloud model id and alias from
 *  the synced mirror (each group alphabetical). Every row carries the FULL
 *  rule set of its layer(s) plus `now`, the price the effective rule set
 *  resolves to at view time, so a model with a discount window or peak windows
 *  never advertises a base rate that is not in force.
 *
 *  `usedModels` carries what the ledger billed: `records` surfaces on every row
 *  the ledger named (so the tab can filter to the models actually in use), and
 *  a string with no model-layer entry but an overlay-priced channel shows as
 *  `overlayPriced` rather than a ¥0 seed. */
export async function readPricingView(
  dir: string,
  usedModels: ReadonlyMap<string, UsedModelHint> = new Map(),
  logger: { error(...args: unknown[]): void } = console,
): Promise<{ rows: PricingViewRow[]; dataDir: string }> {
  const feed = await readCloudFeed(dir, logger)
  const synced = feed === null ? {} : cloudToTable(feed)
  const families = feed === null ? {} : cloudFamilies(feed)
  const manual = await readManualPricing(dir, logger)
  const rows: PricingViewRow[] = []
  const seen = new Set<string>()
  const recordsOf = (model: string): { records?: number } => {
    const hint = usedModels.get(model)
    return hint !== undefined && hint.records > 0 ? { records: hint.records } : {}
  }
  for (const model of Object.keys(manual).sort((a, b) => a.localeCompare(b))) {
    const manualRules = manual[model]!
    const cloudRules = synced[model]
    rows.push({
      model,
      manual: true,
      manualRules,
      manualRates: manualRules.base,
      ...(cloudRules !== undefined ? { cloudRules, cloudRates: cloudRules.base } : {}),
      ...(isLayeredRules(manualRules) || isLayeredRules(cloudRules) ? { layered: true } : {}),
      ...recordsOf(model),
      now: nowOf(manualRules),
    })
    seen.add(model)
  }
  // Ledger-billed strings with no model-layer entry. One the provider overlay
  // already prices is NOT unpriced (its money lives in the overlay layer), but
  // it still belongs in the "in use" view.
  const ledgerOnly = [...usedModels.keys()]
    .filter(model => !(model in synced) && !(model in manual))
    .sort((a, b) => a.localeCompare(b))
  for (const model of ledgerOnly) {
    const hint = usedModels.get(model)!
    rows.push({
      model,
      manual: false,
      ...(hint.overlayPriced
        ? {
            overlayPriced: true,
            // The overlay IS this row's price: show it, and name the route so
            // the UI can send the user to that override instead of offering a
            // model-layer edit that could never take effect.
            ...(hint.overlayNow !== undefined ? { now: hint.overlayNow } : {}),
            ...(hint.overlayProvider !== undefined ? { provider: hint.overlayProvider } : {}),
          }
        : { unpriced: true, now: { rates: { inputPerMillion: 0, outputPerMillion: 0 }, peak: false } }),
      records: hint.records,
    })
    seen.add(model)
  }
  for (const model of Object.keys(synced).sort((a, b) => a.localeCompare(b))) {
    if (seen.has(model)) continue
    const rates = synced[model]!
    rows.push({
      model,
      manual: false,
      cloudRules: rates,
      cloudRates: rates.base,
      ...(families[model] !== undefined ? { family: families[model] } : {}),
      ...(isLayeredRules(rates) ? { layered: true } : {}),
      ...recordsOf(model),
      now: nowOf(rates),
    })
  }
  return { rows, dataDir: dir }
}

async function readCloudFeed(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<CloudPricingData | null> {
  return coerceCloudPricing(await readJsonFile(dir, PRICING_CCSA_FILE, logger))
}

async function readSyncedPricing(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<PricingTable> {
  const feed = await readCloudFeed(dir, logger)
  return feed === null ? {} : cloudToTable(feed)
}

/** Load the merged pricing table: the synced cloud mirror as the base, the
 * hand-edited `pricing.json` layered on top — a manual entry wins wholesale. */
export async function readPricingTable(dir: string, logger: { error(...args: unknown[]): void } = console): Promise<PricingTable> {
  const merged: PricingTable = { ...await readSyncedPricing(dir, logger) }
  for (const [model, rates] of Object.entries(await readManualPricing(dir, logger))) merged[model] = rates
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
