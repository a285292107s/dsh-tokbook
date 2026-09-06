/**
 * Shared domain types for dsh-tokbook (type-only; no runtime imports).
 *
 * The token ledger records ONE row per provider-billed model call (the
 * `assistant/message` provider `usage`, plus compaction summarize calls and
 * failed attempts), then aggregates the rows into totals, per-day, per-hour,
 * per-model and per-(day, model, rate) cells. Cost is an additive layer
 * computed from a per-model price table (¥ per million tokens) through a
 * "time rule → context tier → peak slot" chain, so a price update re-prices
 * history without rebuilding the aggregation.
 *
 * @module dsh-tokbook/types
 */

/** Provider-reported token buckets of one model call. */
export interface UsageFields {
  /** Uncached input tokens (billed input = input + cacheRead + cacheWrite). */
  inputTokens: number
  /** Output tokens. */
  outputTokens: number
  /** Cache-hit input tokens; omitted when the provider reported none. */
  cacheReadTokens?: number
  /** Cache-write input tokens; omitted when the provider reported none. */
  cacheWriteTokens?: number
}

/** Where a record came from: a plain request, a compaction summarize call,
 * or a failed provider attempt. */
export type UsageRecordKind = 'request' | 'compaction' | 'failure'

/** One JSONL row: one provider model call (successful or failed). */
export interface UsageRecord {
  /** Stable request identity (dedupe key): the assistant message id, or a
   * synthesized `compaction:<session>:<seq>` / `failure:<session>:<seq>`. */
  requestId: string
  /** Session-event wall time, epoch milliseconds. */
  time: number
  /** Owning session id. */
  sessionId: string
  /** Provider model id that produced the message; a failure row carries the
   * session's last-known route model ('' when none was ever observed). */
  model: string
  /** Provider route key, best-effort; absent for rows that never saw a header. */
  provider?: string
  /** Token buckets; omitted when the provider reported no usage at all. */
  usage?: UsageFields
  /** Record origin; absent means a plain request. */
  kind?: UsageRecordKind
  /** Failure row only: the provider-neutral `LlmFailure.code`. */
  failureCode?: string
}

/** Aggregated token counts over one group of records. */
export interface UsageTotals {
  /** Number of recorded provider-billed calls: plain requests plus compaction
   * summarize requests. Failed requests never join this count. */
  requests: number
  /** Uncached input tokens. */
  inputTokens: number
  /** Output tokens. */
  outputTokens: number
  /** Cache-hit input tokens. */
  cacheReadTokens: number
  /** Cache-write input tokens. */
  cacheWriteTokens: number
  /** Compaction summarize requests in this group; absent on legacy rollups
   * (reads as 0). */
  compactions?: number
  /** Failed model requests in this group; absent on legacy rollups (reads as 0). */
  failures?: number
  /** Failure counts by the provider-neutral `LlmFailure.code`. */
  failuresByCode?: Record<string, number>
}

/** One per-day aggregation row, keyed by local date `YYYY-MM-DD`. */
export interface UsageDayRow {
  day: string
  totals: UsageTotals
}

/** One per-hour × per-model row, keyed by local `YYYY-MM-DDTHH`. */
export interface UsageHourRow {
  hour: string
  model: string
  totals: UsageTotals
}

/** One per-model aggregation row (token counts only; cost is added later). */
export interface UsageModelRow {
  /** Provider route key, best-effort; '' when unknown (unattributed rows). */
  provider: string
  model: string
  totals: UsageTotals
}

/** Per-million-token prices of one rate node, in ¥ (RMB). */
export interface ModelPricing {
  inputPerMillion: number
  outputPerMillion: number
  cacheReadPerMillion?: number
  cacheWritePerMillion?: number
}

/** One peak window of a day, half-open [startMinute, endMinute) in local minutes. */
export interface RateWindow {
  startMinute: number
  endMinute: number
}

/** A peak-pricing slot: the rates that apply inside its windows. */
export interface DailySlot {
  label?: string
  windows: RateWindow[]
  /** ISO weekdays (1=Monday … 7=Sunday); absent or empty = every day. */
  daysOfWeek?: number[]
  rates: ModelPricing
}

/** A context tier: the rates that apply once the context reaches the threshold. */
export interface ContextTier {
  threshold: number
  rates: ModelPricing
  dailySlots?: DailySlot[]
}

/** A time rule: the container whose rates (and tiers/slots) apply inside its window. */
export interface TimeRule {
  label?: string
  startTime: number
  endTime: number
  rates: ModelPricing
  contextTiers?: ContextTier[]
  dailySlots?: DailySlot[]
}

/** The full pricing of one model (base rates + the rule chain). */
export interface ModelRates {
  base: ModelPricing
  contextTiers: ContextTier[]
  dailySlots: DailySlot[]
  timeRules: TimeRule[]
}

/** The identity of the rate one record was billed at. Holds rule identity,
 * never price numbers, so a price update re-prices history without a rebuild. */
export interface RateKey {
  ruleStart: number
  ruleEnd: number
  tier: number
  slot: number
}

/** The neutral key of an unpriced model's rows. */
export const UNPRICED_KEY: RateKey = { ruleStart: 0, ruleEnd: 0, tier: 0, slot: -1 }

/** The merged pricing table: model id → full rule set. */
export type PricingTable = Record<string, ModelRates>

/** One per-day × per-model × per-rate aggregation row. */
export interface UsageRateRow {
  day: string
  model: string
  rate: RateKey
  totals: UsageTotals
}

/** The token-only aggregation shape (no currency). */
export interface TokenSummary {
  total: UsageTotals
  byDay: UsageDayRow[]
  byHour: UsageHourRow[]
  byModel: UsageModelRow[]
  rateRows: UsageRateRow[]
  recent: UsageRecord[]
}

/** A per-model row carrying its billed cost (¥); 0 when the model is unpriced. */
export type CostedModelRow = UsageModelRow & { cost: number }

/** The currency the stats page renders cost figures in. Amounts on the wire
 * stay RMB; this only names the display convention. */
export type DisplayCurrency = 'CNY' | 'USD'

/** The display currency a mirror region implies. */
export function currencyOfRegion(region: 'domestic' | 'overseas' | undefined): DisplayCurrency {
  return region === 'overseas' ? 'USD' : 'CNY'
}

/** The token aggregation plus the cost layer. */
export interface CostedSummary extends TokenSummary {
  /** Absolute data directory the summary was computed from. */
  dataDir: string
  /** Billed cost over every recorded request (¥); unpriced models count 0. */
  totalCost: number
  /** Models with usage but no entry in the pricing table. */
  unpricedModels: string[]
  /** The active pricing table (user-maintained; empty when none is configured). */
  pricing: PricingTable
  /** Per-model rows with their billed cost attached. */
  byModel: CostedModelRow[]
}

/**
 * The aggregated snapshot the browser floating window reads. Deliberately
 * slimmed from {@link CostedSummary}: the pricing table (a cloud mirror can be
 * hundreds of models), the rateRows, and the byHour rows are dropped — the
 * floating window renders none of them, and the cost layer has already been
 * folded into `totalCost` / `byModel[].cost`.
 */
export interface TokBookOverview extends Omit<CostedSummary, 'pricing' | 'rateRows' | 'byHour'> {
  /** Distinct sessions that contributed records. */
  sessions: number
  /** Sum of the four provider buckets (input + cacheRead + cacheWrite + output). */
  totalTokens: number
  /** The display currency the page converts cost figures into. */
  currency: DisplayCurrency
  /** Effective RMB-per-USD rate (feed value, else a built-in default). */
  usdExchangeRate: number
  /** When the snapshot was computed, epoch ms. */
  updatedAt: number
  /** Total records read from the ledger (diagnostics). */
  records: number
  /** Number of day files the ledger holds (diagnostics). */
  files: number
  /** Timestamp of the newest record, or null when the ledger is empty. */
  lastEventAt: number | null
  /** When the last authoritative re-sync completed, or null if never. */
  lastSyncAt: number | null
  /** Live re-sync state the page can show. */
  syncStatus: 'idle' | 'running' | 'done' | 'error'
  /** Re-sync error, when the last run failed. */
  syncError: string | null
}

/** Token-meter plugin config (optional knobs; all defaults provided). */
export interface TokBookConfig {
  /** Data directory; defaults to `$DSH_HOME/tokbook` (`~/.dsh/tokbook`). */
  path?: string
  /** Explicit cloud pricing feed URL; wins over every region/mirror setting. */
  pricingUrl?: string
  /** Which cloud mirror to pull when `pricingUrl` is unset: `domestic`
   * (default) or `overseas`. */
  pricingRegion?: 'domestic' | 'overseas'
  /** Whether compaction summarize requests are recorded and billed (default true). */
  recordCompaction?: boolean
}

/** Sum the four buckets of an aggregated totals row. */
export function totalsTokens(totals: UsageTotals): number {
  return totals.inputTokens
    + totals.cacheReadTokens
    + totals.cacheWriteTokens
    + totals.outputTokens
}
