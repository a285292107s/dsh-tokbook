/**
 * Pricing vocabulary and store of the token-book: per-model price rules (¥ per
 * million tokens) backing the cost figures of the overview. Two sources merge
 * on read — the cloud feed mirrored on startup into `<data dir>/pricing.ccsa.json`,
 * and the hand-edited `<data dir>/pricing.json`, whose entries always win and
 * replace a model's cloud rules wholesale. Absent files mean no pricing; a
 * malformed file reads as empty, so a broken table never blocks the route.
 *
 * Every record is priced individually through the rule chain — time-rule
 * container first, then context tier, then peak slot — and the aggregation
 * keeps rows per (day, model, rate identity), so re-pricing under an updated
 * table needs no rebuild. The context size for tier matching is approximated
 * by the request's input-side tokens (input + cacheRead + cacheWrite).
 *
 * @module dsh-tokbook/pricing
 */

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  ContextTier, DailySlot, ModelPricing, ModelRates, PricingTable, PricingViewRow, RateKey, TimeRule, UsageTotals,
} from './types.ts'

/** The hand-maintained pricing file inside the data directory. */
export const PRICING_FILE = 'pricing.json'

/** The cloud-feed mirror written on startup. */
export const PRICING_CCSA_FILE = 'pricing.ccsa.json'

/** Default domestic (China) cloud pricing feed (¥ per million tokens, RMB). */
export const DEFAULT_PRICING_URL_DOMESTIC = 'https://gitee.com/oyw125/model-price-table/raw/master/model_pricing.json'

/** Default overseas cloud pricing feed (same table mirrored to GitHub). */
export const DEFAULT_PRICING_URL_OVERSEAS = 'https://raw.githubusercontent.com/LaoYueHanNi/model-price-table/master/model_pricing.json'

/** Stand-in RMB-per-USD rate until the feed carries a usable one. */
export const DEFAULT_USD_EXCHANGE_RATE = 7

export type PricingRegion = 'domestic' | 'overseas'

export interface PricingSourceInput {
  pricingUrl?: string
  pricingUrlDomestic?: string
  pricingUrlOverseas?: string
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
