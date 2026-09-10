/**
 * Shared domain types for dsh-tokbook (type-only; no runtime imports).
 *
 * The token ledger records ONE row per provider-billed model call (the
 * `assistant/message` provider `usage`, plus compaction summarize calls and
 * failed attempts), then aggregates the rows into totals, per-day, per-hour,
 * per-model and per-(day, model, provider, rate) cells. Cost is an additive
 * layer computed through a (route, model) price resolution — a hand-written
 * price table (¥ per million tokens) whose only key is the effective date —
 * so a price update re-prices history without rebuilding the aggregation.
 * Amounts split into real spend (metered channels) and subscription value
 * (subscription channels).
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

/** Per-million-token prices of one price segment, in ¥ (RMB). The cache
 *  buckets fall back to the plain input rate when omitted. */
export interface ModelPricing {
  inputPerMillion: number
  outputPerMillion: number
  cacheReadPerMillion?: number
  cacheWritePerMillion?: number
}

/** How one provider channel's amount is counted: real spend vs subscription
 *  value. A route-level fact (`$billing` in the price file); absent = metered. */
export type BillingNature = 'metered' | 'subscription'

/** One price segment of one (route, model): the price in force from `from`
 *  (epoch ms; 0 = 最早一段, i.e. since the beginning of time) until the next
 *  segment of the same (route, model) starts. The list stays ascending by
 *  `from`, so "the price at time T" is the last segment with `from ≤ T`. */
export interface PriceSegment {
  from: number
  rates: ModelPricing
  note?: string
}

/** The hand-written price table: provider route key → exact model string →
 *  that (route, model)'s price timeline. An empty/absent list = 价格未知. */
export type PricingTable = Record<string, Record<string, PriceSegment[]>>

/** route → its billing nature. The price file's reserved `$billing` section. */
export type BillingMap = Record<string, BillingNature>

/** The identity of the price segment one record was billed under: the start
 *  instant of the segment that applied. Holds identity, never numbers, so a
 *  price edit re-prices history on the next read. */
export interface RateKey {
  from: number
}

/** The neutral key of an unpriced record's rows. */
export const UNPRICED_KEY: RateKey = { from: -1 }

/** One price segment as it travels on the wire and lives in `pricing.json`:
 *  `from` is a local calendar date (`YYYY-MM-DD`) or null for 最早一段. Flat
 *  on purpose — the file is hand-written, so a segment is one object carrying
 *  its four rates, not a nested `rates` node. */
export interface PricingSegmentInput {
  from: string | null
  inputPerMillion: number
  outputPerMillion: number
  cacheReadPerMillion?: number
  cacheWritePerMillion?: number
  note?: string
}

/** One model row of one route card: the exact model string, where the route
 *  knows it from, and its price timeline. */
export interface PricingModelView {
  /** The exact model string records are billed under. */
  model: string
  /** True when settings / the adapter catalog lists this string for the route
   *  (i.e. it is callable there); false = a 仅账本 row the configuration no
   *  longer lists, or a string that only carries a hand-written price. */
  configured: boolean
  /** Ledger records naming this (route, model); 0 when never billed. */
  records: number
  /** Price segments in force order (empty = 价格未知, billed ¥0). */
  segments: PricingSegmentInput[]
  /** The price in force at view time; absent = nothing prices this row. */
  now?: ModelPricing
  /** Effective date of the segment that governs `now` (null = 最早一段). */
  nowFrom?: string | null
}

/** One route card of the 价格表 tab: one provider route key, its display name,
 *  its billing nature, and every model it can be billed for. */
export interface PricingRouteView {
  /** Provider route key (the ledger's channel identity). */
  route: string
  /** Display name: the settings profile's `displayName`, else the adapter's
   *  provider name, else the route key itself. */
  label: string
  /** Billing nature of this route (its `$billing` entry; default metered). */
  billing: BillingNature
  /** Ledger records over the whole route (drives card order). */
  records: number
  models: PricingModelView[]
}

/** The wire payload of the pricing-table view (价格表 tab). */
export interface PricingView {
  /** One card per provider route: routes with ledger usage first (most-used
   *  first), then the rest by route key. */
  routes: PricingRouteView[]
  /** The data directory the price file lives in (informational). */
  dataDir: string
  /** When the view was computed, epoch ms. */
  updatedAt: number
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
  /** The active price table (hand-written; empty when nothing is priced). */
  pricing: PricingTable
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
  /** The route's billing nature (`$billing`); independent of whether this
   *  model is priced. Unattributed routes read as metered. */
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
  /** When the snapshot was computed, epoch ms. */
  updatedAt: number
  /** Human label per provider route: the route's display name (settings
   *  `displayName`, else the adapter's provider name), so a card heads with
   *  "DeepSeek" and shows the route key beneath it. Absent when nothing names
   *  the route; the card then shows the key alone. */
  providerLabels?: Record<string, string>
  /** One card per provider with recorded usage inside the window, largest
   * token total first; empty when the window holds no records. */
  providers: ProviderUsageCard[]
}

/**
 * The aggregated snapshot the browser floating window reads. Deliberately
 * slimmed from {@link CostedSummary}: the price table, the rateRows and the
 * byHour rows are dropped — the floating window renders none of them, and the
 * cost layer has already been folded into `spend` / `subscriptionValue` /
 * `totalCost` / `byModel[].*`.
 */
export interface TokBookOverview extends Omit<CostedSummary, 'pricing' | 'rateRows' | 'byHour' | 'recent'> {
  /** Distinct sessions that contributed records. */
  sessions: number
  /** Sum of the four provider buckets (input + cacheRead + cacheWrite + output). */
  totalTokens: number
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
