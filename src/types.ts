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

/** One model row of the pricing-table view: an exact model string records can
 * be billed under. `cloudRates` is the synced feed's flat base price for that
 * string (absent = manual-only row, i.e. a model the cloud never named);
 * `manualRates` is the hand-edited `pricing.json` entry, which — when present
 * — replaces the cloud rules wholesale. `layered` marks a cloud entry that
 * also carries time rules / context tiers / peak slots: its billed rate then
 * varies, and writing a manual entry replaces the whole rule set with flat
 * prices. */
export interface PricingViewRow {
  /** The exact model string (modelId or alias) records may use. */
  model: string
  /** Whether a manual `pricing.json` entry exists for this exact string. */
  manual: boolean
  /** Manual entry rates (¥/M); present when `manual` is true. */
  manualRates?: ModelPricing
  /** Cloud base rates (¥/M) behind this string; absent on manual-only rows. */
  cloudRates?: ModelPricing
  /** Cloud entry carries time/context/peak rules (its flat base is not the
   * whole story; a manual entry would replace those rules). */
  layered?: boolean
  /** True when the ledger recorded this model string but neither the cloud
   * feed nor a manual entry names it — it is currently billed ¥0. */
  unpriced?: boolean
  /** Number of ledger records naming this model (present on unpriced rows,
   *  so the hint can show how much usage is at stake). */
  records?: number
}

/** The wire payload of the pricing-table view (价格表 tab). */
export interface PricingView {
  /** One row per exact model string in the merged table, manual rows first
   * then cloud models/aliases (both alphabetical within each group). */
  rows: PricingViewRow[]
  /** The data directory the pricing files live in (informational). */
  dataDir: string
}

/**
 * One ledger row of the overview's 最近记录 slice: a {@link UsageRecord}
 * with the billed cost (¥) of that single request folded in. The cost is a
 * server-derived read-time field — it re-prices whenever the price table
 * changes and never touches the ledger/rollup format. Failure rows and
 * unpriced rows carry 0.
 */
export interface RecentLedgerEntry extends UsageRecord {
  /** Billed ¥ of this request under the current price table (0 = unpriced,
   * no usage reported, or a failed attempt that billed no tokens). */
  cost: number
}

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

/** A selectable look-back window of the Provider-usage tab, named after the
 * local calendar days it covers (same day-partition the ledger files use). */
export type ProviderRange = 'today' | 'yesterday' | 'last7' | 'last30'

/** Every valid {@link ProviderRange} id; route validation reuses this. */
export const PROVIDER_RANGES: readonly ProviderRange[] = ['today', 'yesterday', 'last7', 'last30']

/** One provider-billed model row inside a provider card (tokens already
 * summed over the four buckets; cost is the ¥ billed under the price table). */
export interface ProviderModelUsage {
  /** Provider model id as recorded. */
  model: string
  /** Per-bucket counts of this model inside the window. */
  totals: UsageTotals
  /** Sum of the four provider buckets. */
  tokens: number
  /** Billed ¥ over the window; 0 when the model is unpriced. */
  cost: number
}

/** One provider card of the Provider-usage tab: every model the provider
 * billed inside the selected window, aggregated under the provider key. */
export interface ProviderUsageCard {
  /** Provider route key as recorded; rows that never saw a header group
   * under `'(未知)'`. */
  provider: string
  /** Sum of the four buckets over the whole card. */
  tokens: number
  /** Billed ¥ over the whole card; unpriced models count 0. */
  cost: number
  /** Models whose usage has no entry in the pricing table (costed as ¥0). */
  unpricedModels: string[]
  /** Models of this provider, largest token total first. */
  models: ProviderModelUsage[]
  /** Recorded requests of this card (plain requests plus compaction
   * summarize calls; failed attempts never join this count). */
  requests: number
  /** Compaction summarize requests inside the card. */
  compactions: number
}

/** The wire payload of the Provider-usage route. Slim and read-only: only the
 * aggregated cards for one window cross the wire. */
export interface ProviderUsageView {
  /** The window this view was computed for. */
  range: ProviderRange
  /** Local date key of the window's first day (inclusive), e.g. `2026-09-01`. */
  fromDay: string
  /** Local date key of the window's last day (inclusive). */
  toDay: string
  /** The display currency the page converts cost figures into. */
  currency: DisplayCurrency
  /** Effective RMB-per-USD rate (feed value, else a built-in default). */
  usdExchangeRate: number
  /** When the snapshot was computed, epoch ms. */
  updatedAt: number
  /** One card per provider with recorded usage inside the window, largest
   * token total first; empty when the window holds no records. */
  providers: ProviderUsageCard[]
}

/**
 * The aggregated snapshot the browser floating window reads. Deliberately
 * slimmed from {@link CostedSummary}: the pricing table (a cloud mirror can be
 * hundreds of models), the rateRows, and the byHour rows are dropped — the
 * floating window renders none of them, and the cost layer has already been
 * folded into `totalCost` / `byModel[].cost`.
 */
export interface TokBookOverview extends Omit<CostedSummary, 'pricing' | 'rateRows' | 'byHour' | 'recent'> {
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
  /** Newest ledger rows (newest first), each carrying its own billed ¥. */
  recent: RecentLedgerEntry[]
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
  /** Quota plans keyed by provider route (`opencode-go`, `commandcode`). A
   * plan turns on automatically once a usable API key is found (config, env,
   * or the provider's auth file) unless `enabled:false`. The official usage
   * is fetched from each provider's own account endpoints — the tab never
   * falls back to a local estimate. See `src/quota.ts` / `src/quota-official.ts`. */
  plans?: Record<string, PlanConfig>
}

/** A user-configured quota plan override (see `src/quota.ts`). */
export interface PlanConfig {
  /** Force the plan on even before a key is found (best-effort fetch). */
  enabled?: boolean
  /** Explicit API key literal; wins over the credentials service. Intended
   * for tests / non-DSH hosts — a key stored in the dsh Models page lives in
   * the credentials service and is found without this field. */
  apiKey?: string
  /** Credential reference name to resolve through `ctx.credentials`; defaults
   * to the provider's reference (`OPENCODE_GO_API_KEY`, `COMMANDCODE_API_KEY`),
   * i.e. the name the provider adapter's own `apiKeyEnv` declares. */
  apiKeyEnv?: string
}

/** One window of an official quota card. Amounts are optional because some
 * providers (OpenCode Go) expose only a used percent + reset, while others
 * (Command Code) expose used/cap in dollars. */
export interface QuotaWindowView {
  /** Stable window id (`rolling5h`, `weekly`, `monthly`, `fiveHour`…). */
  id: string
  /** Display label (5 小时 / 本周 / 本月 …). */
  label: string
  /** 0–100 percent the server reports (or derived from used/cap). */
  usagePercent: number
  /** Whether the server reports this window exceeded/rate-limited. */
  exceeded: boolean
  /** Epoch ms when capacity returns; null when not reported. */
  resetAt: number | null
  /** Used amount in the window (Command Code). Absent → percent-only display. */
  usedUsd?: number
  /** Window cap in USD (Command Code). Absent → percent-only display. */
  capUsd?: number
}

/** Optional subscription/account context of an official quota card. */
export interface QuotaAccountInfo {
  /** Account display name (userName/name) when the provider reports one. */
  name?: string
}

/** Optional plan identity of an official quota card. */
export interface QuotaPlanInfo {
  /** Raw plan id (`individual-goat`, …); empty when unreported. */
  planId?: string
  /** Display plan name (GOAT / Pro …). */
  name?: string
  /** Raw subscription status (`active`, `trialing`, `past_due`…). */
  status?: string
  /** Billing period end, epoch ms; null when unreported. */
  periodEnd?: number | null
}

/** Optional usage summary of an official quota card (Command Code reports it;
 * OpenCode Go does not). */
export interface QuotaUsageSummary {
  /** Completed (successful) request count. */
  completed?: number
  /** Failed request count. */
  failed?: number
  /** Success rate 0–100. */
  successRate?: number
  /** Total cost in USD of the period, when reported. */
  costUsd?: number
  /** Input tokens in the period. */
  tokensIn?: number
  /** Output tokens in the period. */
  tokensOut?: number
}

/** Optional credit-pool state of an official quota card (Command Code). */
export interface QuotaCreditPool {
  /** Remaining subscription monthly credits (USD), when reported. */
  monthlyUsd?: number
  /** Purchased (top-up, roll-over) credits (USD). */
  purchasedUsd?: number
  /** Free/promo credits (USD). */
  freeUsd?: number
}

/** The availability of one official quota card. */
export type QuotaCardState = 'ok' | 'unconfigured' | 'error'

/** One official quota card: one provider's account usage fetched from the
 * provider's own endpoints. Never a local estimate. */
export interface QuotaCard {
  /** Provider route key the plan attaches to. */
  plan: string
  /** Display title (OpenCode Go / Command Code GOAT …). */
  title: string
  state: QuotaCardState
  /** Short hint shown when `unconfigured` (no key) or `error` (fetch failed). */
  message?: string
  /** Account identity when reported. */
  account?: QuotaAccountInfo
  /** Subscription plan identity when reported. */
  planInfo?: QuotaPlanInfo
  /** Period usage summary when reported. */
  usage?: QuotaUsageSummary
  /** Credit-pool state when reported. */
  credits?: QuotaCreditPool
  /** Limit windows in display order. */
  windows: QuotaWindowView[]
  /** When the official data was fetched, epoch ms. */
  fetchedAt?: number
}

/** The wire payload of the quota route (订阅额度 tab) when no `provider` is
 * given: a fast, non-network list of the enabled provider routes, so the
 * client can then fetch each provider's card independently (`?provider=`). */
export interface QuotaView {
  /** Enabled built-in provider routes in display order (no network fetch). */
  providers: string[]
}


/** Sum the four buckets of an aggregated totals row. */
export function totalsTokens(totals: UsageTotals): number {
  return totals.inputTokens
    + totals.cacheReadTokens
    + totals.cacheWriteTokens
    + totals.outputTokens
}
