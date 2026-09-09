/**
 * Shared domain types for dsh-tokbook (type-only; no runtime imports).
 *
 * The token ledger records ONE row per provider-billed model call (the
 * `assistant/message` provider `usage`, plus compaction summarize calls and
 * failed attempts), then aggregates the rows into totals, per-day, per-hour,
 * per-model and per-(day, model, provider, rate) cells. Cost is an additive
 * layer computed through a (provider, model) price resolution — a per-model
 * price table (¥ per million tokens) with a provider overlay, resolved by the
 * "time rule → context tier → peak slot" chain — so a price update re-prices
 * history without rebuilding the aggregation. Amounts split into real spend
 * (metered channels) and subscription value (subscription channels).
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
  /** Real spend (¥) of this day; present only once the cost layer has run
   * (`attachCosts`). The token-only summary and the stored rollup carry none —
   * the cost layer re-derives it from the rate rows on every read. */
  spend?: number
  /** Subscription value (¥, non-cash) of this day; same presence rule as
   * {@link spend}. */
  subscriptionValue?: number
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

/** Billing nature of one provider channel, decided per (provider, model). */
export type BillingNature = 'metered' | 'subscription'

/** One self-priced time segment of a provider entry: applies while
 * `from ≤ seconds < to` (epoch seconds; `from`/`to` absent = unbounded on
 * that side). The segment rate *is* the price during the window — it never
 * inherits rules. */
export interface PricingSegment {
  /** Window start, epoch seconds; absent = the beginning of time. */
  from?: number
  /** Window end (exclusive), epoch seconds; absent = open-ended. */
  to?: number
  /** The flat price applied during the window. */
  rate: ModelPricing
  /** Human note. */
  note?: string
}

/** One provider-layer override for an exact ledger model string. */
export interface ProviderPricingEntry {
  /** How this channel's amount is counted: real spend vs subscription value. */
  billing?: BillingNature
  /** Follow the base table's FULL rule set (incl. timeRules) of this modelId. */
  inheritBase?: string
  /** Explicit user timeline of flat prices; wins over `inheritBase` when present. */
  segments?: PricingSegment[]
  /** Relay placeholder: base prices stand in until the user fills real segments. */
  placeholder?: boolean
  /** Human note. */
  note?: string
}

/** provider route key → exact model string → override entry. */
export type ProviderPricingTable = Record<string, Record<string, ProviderPricingEntry>>


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

/** The price one (provider, model) resolves to at a single instant — the
 * answer to "what does this cost right now", through the whole
 * time-rule → context-tier → peak-slot chain. */
export interface PricingNow {
  /** The rates that apply now (¥/M). */
  rates: ModelPricing
  /** Label of the winning container or peak slot (`限时5折`, `工作日高峰时段`);
   * absent when the base slate decided the price. */
  label?: string
  /** True when a peak/off-peak slot decided this price. */
  peak: boolean
}

/** One model row of the pricing-table view: an exact model string records can
 * be billed under. `cloudRules` is the synced feed's FULL rule set for that
 * string (absent = manual-only row, i.e. a model the cloud never named);
 * `manualRules` is the hand-edited `pricing.json` entry, which — when present
 * — replaces the cloud rules wholesale. `cloudRates` / `manualRates` are the
 * flat base-rate shorthands of those two (kept for older clients). `now` is
 * the price the EFFECTIVE rule set (manual over cloud) resolves to at view
 * time, so a row never advertises a base rate that is not in force. */
export interface PricingViewRow {
  /** The exact model string (modelId or alias) records may use. */
  model: string
  /** Whether a manual `pricing.json` entry exists for this exact string. */
  manual: boolean
  /** Full manual rule set; present when `manual` is true. */
  manualRules?: ModelRates
  /** Manual base rates (¥/M) shorthand = `manualRules.base`. */
  manualRates?: ModelPricing
  /** Full cloud rule set behind this string; absent on manual-only rows. */
  cloudRules?: ModelRates
  /** Cloud base rates (¥/M) shorthand = `cloudRules.base`. */
  cloudRates?: ModelPricing
  /** Cloud entry carries time rules / context tiers / peak slots (its flat
   * base is not the whole story; a manual entry would replace those rules). */
  layered?: boolean
  /** True when the ledger recorded this model string but neither the cloud
   * feed nor a manual entry names it — it is currently billed ¥0. */
  unpriced?: boolean
  /** True when the model has no model-layer entry but some provider-overlay
   * entry prices it (its money lives in the overlay layer, not as ¥0). */
  overlayPriced?: boolean
  /** The provider route whose overlay entry prices this string (present with
   * `overlayPriced`, so the UI can send the user to that exact override). */
  provider?: string
  /** Number of ledger records naming this model; present on ANY row the
   * ledger billed (not just unpriced ones), so the tab can surface the models
   * actually in use. */
  records?: number
  /** Price of the effective rule set at view time. For an `overlayPriced` row
   * that is the provider overlay's price (model layer has no entry). */
  now?: PricingNow
}

/** The wire payload of the pricing-table view (价格表 tab). */
export interface PricingView {
  /** One row per exact model string in the merged table, manual rows first
   * then cloud models/aliases (both alphabetical within each group). */
  rows: PricingViewRow[]
  /** One row per (provider, model) in the EFFECTIVE provider overlay (cloud
   * mirror + hand edits), the read/display side of the provider dimension.
   * Absent on hosts that predate the provider layer. */
  providerRows?: ProviderPricingViewRow[]
  /** The data directory the pricing files live in (informational). */
  dataDir: string
}

/** One (provider, model) row of the provider-overlay view: the exact ledger
 * string the mirror (or a hand edit) overrides for one provider route, how it
 * bills, and where its price comes from. */
export interface ProviderPricingViewRow {
  /** Provider route key ('' groups unknown rows, which never have entries). */
  provider: string
  /** The exact model string the entry overrides. */
  model: string
  /** Billing nature; absent when the mirror left it unset. */
  billing?: BillingNature
  /** Price source: follow this base model's full rule set. */
  inheritBase?: string
  /** Price source: an explicit user timeline of flat segments. */
  segments?: PricingSegment[]
  /** Relay placeholder: base prices stand in until real segments are filled. */
  placeholder?: boolean
  /** Hand-edited `provider-pricing.json` entry wins over the mirror row. */
  manual: boolean
  /** Human note (mirror or hand). */
  note?: string
  /** The EFFECTIVE rule container this row prices through (the inherited
   * base model's full rules, or the flat container built from `segments`).
   * Absent when nothing can price the string. */
  rules?: ModelRates
  /** Price of `rules` at view time, so a 跟随基准 row can show the number. */
  now?: PricingNow
}

/**
 * One ledger row of the overview's 最近记录 slice: a {@link UsageRecord}
 * with the billed amounts (¥) of that single request folded in. The amounts
 * are server-derived read-time fields — they re-price whenever the price table
 * changes and never touches the ledger/rollup format. Failure rows and
 * unpriced rows carry 0. `cost` is kept as the sum (spend + subscriptionValue)
 * so older clients that read only `cost` still see a total; the two buckets
 * let new clients show 实际支出 and 订阅价值 separately.
 */
export interface RecentLedgerEntry extends UsageRecord {
  /** Sum of the two buckets (¥); 0 = unpriced, no usage reported, or a failed
   * attempt that billed no tokens. Compatibility field. */
  cost: number
  /** Real spend (¥): the amount of rows whose billing is `metered`. */
  spend: number
  /** Subscription value (¥, non-cash): the amount of rows whose billing is
   * `subscription`. */
  subscriptionValue: number
}

/** One per-day × per-model × per-provider × per-rate aggregation row. */
export interface UsageRateRow {
  day: string
  model: string
  /** Provider route key of the row; '' (absent) for unattributed rows. */
  provider: string
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

/** A per-model row carrying its billed amounts (¥). `cost` is the sum of the
 * two buckets (spend + subscriptionValue) — kept so older clients reading only
 * `cost` still see a total; `spend` and `subscriptionValue` split it by the
 * billing nature of the (provider, model) channel. 0 when the model is
 * unpriced. */
export type CostedModelRow = UsageModelRow & {
  /** Compatibility total (¥) = spend + subscriptionValue. */
  cost: number
  /** Real spend (¥): metered-channel amount. */
  spend: number
  /** Subscription value (¥, non-cash): subscription-channel amount. */
  subscriptionValue: number
}

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
  /** Billed cost over every recorded request (¥); unpriced models count 0.
   * Compatibility total = spend + subscriptionValue. */
  totalCost: number
  /** Real spend (¥): amount of rows whose billing is `metered`. */
  spend: number
  /** Subscription value (¥, non-cash): amount of rows whose billing is
   * `subscription`. */
  subscriptionValue: number
  /** Models with usage but no entry in the pricing table. */
  unpricedModels: string[]
  /** The active pricing table (user-maintained; empty when none is configured). */
  pricing: PricingTable
  /** The active provider overlay table (empty when the mirror never synced). */
  providerPricing: ProviderPricingTable
  /** Per-model rows with their billed amounts attached. */
  byModel: CostedModelRow[]
}

/** A selectable look-back window of the Provider-usage tab, named after the
 * local calendar days it covers (same day-partition the ledger files use). */
export type ProviderRange = 'today' | 'yesterday' | 'last7' | 'last30'

/** Every valid {@link ProviderRange} id; route validation reuses this. */
export const PROVIDER_RANGES: readonly ProviderRange[] = ['today', 'yesterday', 'last7', 'last30']

/** One provider-billed model row inside a provider card (tokens already
 * summed over the four buckets; amounts are the ¥ billed under the price
 * table, split into the dual buckets by the channel's billing nature). */
export interface ProviderModelUsage {
  /** Provider model id as recorded. */
  model: string
  /** Per-bucket counts of this model inside the window. */
  totals: UsageTotals
  /** Sum of the four provider buckets. */
  tokens: number
  /** Billed ¥ over the window; 0 when the model is unpriced.
   * Compatibility total = spend + subscriptionValue. */
  cost: number
  /** Real spend (¥) of this model inside the window. */
  spend: number
  /** Subscription value (¥, non-cash) of this model inside the window. */
  subscriptionValue: number
  /** How this model's channel bills; undefined when unpriced. */
  billing?: BillingNature
}

/** One provider card of the Provider-usage tab: every model the provider
 * billed inside the selected window, aggregated under the provider key. */
export interface ProviderUsageCard {
  /** Provider route key as recorded; rows that never saw a header group
   * under `'(未知)'`. */
  provider: string
  /** Sum of the four buckets over the whole card. */
  tokens: number
  /** Billed ¥ over the whole card; unpriced models count 0.
   * Compatibility total = spend + subscriptionValue. */
  cost: number
  /** Real spend (¥) over the whole card. */
  spend: number
  /** Subscription value (¥, non-cash) over the whole card. */
  subscriptionValue: number
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
 * folded into `spend` / `subscriptionValue` / `totalCost` / `byModel[].*`.
 */
export interface TokBookOverview extends Omit<CostedSummary, 'pricing' | 'providerPricing' | 'rateRows' | 'byHour' | 'recent'> {
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
  /** Explicit provider-overlay pricing feed URL; wins over the mirror default. */
  pricingProviderUrl?: string
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
