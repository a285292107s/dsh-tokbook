export interface UsageFields {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
}
export type UsageRecordKind = 'request' | 'compaction' | 'failure';
export interface UsageRecord {
    requestId: string;
    time: number;
    sessionId: string;
    model: string;
    provider?: string;
    usage?: UsageFields;
    kind?: UsageRecordKind;
    failureCode?: string;
}
export interface UsageTotals {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    compactions?: number;
    failures?: number;
    failuresByCode?: Record<string, number>;
    usageUnknown?: number;
}
export interface UsageDayRow {
    day: string;
    totals: UsageTotals;
    spend?: number;
    subscriptionValue?: number;
}
export interface UsageHourRow {
    hour: string;
    model: string;
    totals: UsageTotals;
}
export interface UsageModelRow {
    provider: string;
    model: string;
    totals: UsageTotals;
}
export interface ModelPricing {
    inputPerMillion: number;
    outputPerMillion: number;
    cacheReadPerMillion?: number;
    cacheWritePerMillion?: number;
}
export type PriceCurrency = 'CNY' | 'USD';
export type CurrencyMap = Record<string, PriceCurrency>;
export interface FxSetting {
    cnyPerUsd: number;
}
export type BillingNature = 'metered' | 'subscription';
export type DaySet = 'daily' | 'workdays' | 'weekdays' | 'weekends';
export type HolidayCalendar = Record<string, HolidayRange[]>;
export interface HolidayRange {
    start: string;
    end: string;
}
export interface PriceSlot {
    days: DaySet;
    start: number;
    end: number;
    rates: ModelPricing;
}
export interface PriceEntry {
    rates: ModelPricing;
    slots?: PriceSlot[];
}
export interface SlotRef {
    start: number;
    days: DaySet;
}
export type PricingTable = Record<string, Record<string, PriceEntry>>;
export type BillingMap = Record<string, BillingNature>;
export type PricingCalendarInput = Record<string, HolidayRange[]>;
export interface RateKey {
    slot?: SlotRef | null;
    unpriced?: true;
}
export declare const UNPRICED_KEY: RateKey;
export interface PricingSlotInput {
    days: DaySet;
    start: number;
    end: number;
    inputPerMillion: number;
    outputPerMillion: number;
    cacheReadPerMillion?: number;
    cacheWritePerMillion?: number;
}
export interface PricingEntryInput {
    inputPerMillion: number;
    outputPerMillion: number;
    cacheReadPerMillion?: number;
    cacheWritePerMillion?: number;
    slots?: PricingSlotInput[];
}
export interface ModelEntry {
    id: string;
    name?: string;
}
export interface RouteCatalogEntry {
    route: string;
    label: string;
    models: readonly ModelEntry[];
}
export interface PricingModelView {
    model: string;
    name?: string;
    configured: boolean;
    records: number;
    unpriced?: number;
    price?: PricingEntryInput;
}
export interface PricingRouteView {
    route: string;
    label: string;
    billing: BillingNature;
    currency: PriceCurrency;
    records: number;
    models: PricingModelView[];
}
export interface PricingView {
    routes: PricingRouteView[];
    calendar: PricingCalendarInput;
    calendarMissing: string[];
    calendarAuto?: string[];
    holidaySync?: HolidaySyncView;
    fx?: FxSetting;
    sync: PricingSyncView;
    dataDir: string;
    updatedAt: number;
}
export type PriceVerdict = {
    ok: true;
} | {
    ok: false;
    error: string;
};
export interface WorkspaceUsageRow {
    id: string;
    title: string;
    path: string;
    totals: UsageTotals;
    tokens: number;
    spend: number;
    subscriptionValue: number;
    lastAt: number;
}
export interface UsageRateRow {
    day: string;
    model: string;
    provider: string;
    rate: RateKey;
    totals: UsageTotals;
}
export interface TokenSummary {
    total: UsageTotals;
    byDay: UsageDayRow[];
    byHour: UsageHourRow[];
    byModel: UsageModelRow[];
    rateRows: UsageRateRow[];
}
export type CostedModelRow = UsageModelRow & {
    cost: number;
    spend: number;
    subscriptionValue: number;
};
export interface CostedSummary extends TokenSummary {
    dataDir: string;
    totalCost: number;
    spend: number;
    subscriptionValue: number;
    unpricedModels: string[];
    pricing: PricingTable;
    byModel: CostedModelRow[];
}
export type ProviderRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'all';
export declare const PROVIDER_RANGES: readonly ProviderRange[];
export declare function rangeCarriesMoney(range: ProviderRange): boolean;
export interface ProviderModelUsage {
    model: string;
    totals: UsageTotals;
    tokens: number;
    cost: number;
    spend: number;
    subscriptionValue: number;
    billing?: BillingNature;
}
export interface ProviderUsageCard {
    provider: string;
    tokens: number;
    cost: number;
    spend: number;
    subscriptionValue: number;
    unpricedModels: string[];
    models: ProviderModelUsage[];
    requests: number;
    compactions: number;
    usageUnknown: number;
}
export interface ProviderUsageView {
    range: ProviderRange;
    fromDay: string;
    toDay: string;
    updatedAt: number;
    providerLabels?: Record<string, string>;
    totalTokens: number;
    totalRequests: number;
    totalSpend: number;
    totalSubscriptionValue: number;
    byModel: CostedModelRow[];
    byWorkspace: WorkspaceUsageRow[];
    providers: ProviderUsageCard[];
}
export interface TokBookOverview extends Omit<CostedSummary, 'pricing' | 'rateRows' | 'byHour' | 'byModel' | 'unpricedModels'> {
    totalTokens: number;
    updatedAt: number;
    records: number;
    lastEventAt: number | null;
    syncStatus: SyncStatus;
    syncError: string | null;
}
export type SyncStatus = 'idle' | 'running' | 'done' | 'error';
export interface SyncStatusView {
    status: SyncStatus;
    error: string | null;
    lastSyncAt: number | null;
    ledger: number;
}
export interface PricingSyncView {
    source: {
        label: string;
        url: string;
    };
    refreshDays: number;
    retryMinutes: number;
    state: 'ok' | 'stale' | 'failed' | 'missing';
    gaps: number;
    lastSuccessDay: string | null;
    lastAdded: number | null;
    lastAttemptAt: number | null;
    lastError: string | null;
    nextAttemptAt: number | null;
}
export interface HolidaySyncView {
    source: {
        label: string;
        url: string;
    };
    refreshDays: number;
    state: 'ok' | 'stale' | 'failed' | 'missing';
    covered: string[];
    uncovered: string[];
    lastAttemptAt: number | null;
    lastError: string | null;
}
export interface HolidayRefreshResult {
    fetched: string[];
    unpublished: string[];
    failed: Record<string, string>;
    changed: boolean;
    refreshedAt: number;
}
export interface PricingSyncResult {
    added: number;
    skipped: number;
    syncedAt: number;
    throttled?: boolean;
    reasons: Record<string, string>;
}
export interface ModelsDevCandidate {
    provider: string;
    modelId: string;
    name: string;
    key: string;
    cost: {
        input: number;
        output: number;
        cacheRead?: number;
        cacheWrite?: number;
    };
}
export interface PricingLookupResult {
    keyword: string;
    candidates: ModelsDevCandidate[];
}
export interface TokBookConfig {
    path?: string;
    recordCompaction?: boolean;
    plans?: Record<string, PlanConfig>;
}
export interface PlanConfig {
    enabled?: boolean;
    apiKey?: string;
    apiKeyEnv?: string;
}
export interface QuotaWindowView {
    id: string;
    label: string;
    usagePercent: number;
    exceeded: boolean;
    resetAt: number | null;
    usedUsd?: number;
    capUsd?: number;
}
export interface QuotaAccountInfo {
    name?: string;
}
export interface QuotaPlanInfo {
    planId?: string;
    name?: string;
    status?: string;
    periodEnd?: number | null;
}
export interface QuotaUsageSummary {
    completed?: number;
    failed?: number;
    successRate?: number;
    costUsd?: number;
    tokensIn?: number;
    tokensOut?: number;
}
export interface QuotaCreditPool {
    monthlyUsd?: number;
    purchasedUsd?: number;
    freeUsd?: number;
}
export type QuotaCardState = 'ok' | 'unconfigured' | 'error';
export type QuotaGate = 'subscription' | 'balance' | 'none';
export interface QuotaCard {
    plan: string;
    title: string;
    state: QuotaCardState;
    message?: string;
    account?: QuotaAccountInfo;
    planInfo?: QuotaPlanInfo;
    usage?: QuotaUsageSummary;
    credits?: QuotaCreditPool;
    gate?: QuotaGate;
    gateNote?: string;
    windows: QuotaWindowView[];
    fetchedAt?: number;
}
export interface QuotaView {
    providers: string[];
    alert?: boolean;
}
export interface StepTiming {
    wallMs?: number;
    llmMs?: number;
    ttftMs?: number;
    decodeMs?: number;
    toolMs?: number;
    toolCalls?: number;
    slowTool?: {
        name: string;
        ms: number;
    };
}
export interface StepTimingTotals {
    llmMs: number;
    toolMs: number;
}
export declare function settleTiming(rows: readonly SessionStepRow[]): StepTimingTotals;
export interface SessionStepRow {
    requestId: string;
    time: number;
    model: string;
    provider: string;
    kind?: UsageRecordKind;
    failureCode?: string;
    usage?: UsageFields;
    tokens: number;
    step?: number;
    timing?: StepTiming;
    bucket: 'spend' | 'subscription' | 'unpriced';
    cost: number;
}
export interface SessionUsageGroup {
    turn: number | null;
    totals: UsageTotals;
    tokens: number;
    spend: number;
    subscriptionValue: number;
    rows: SessionStepRow[];
}
export interface SessionSubagentRow {
    sessionId: string;
    label: string;
    tokens: number;
    requests: number;
    failures: number;
    usageUnknown: number;
    spend: number;
    subscriptionValue: number;
    priced: boolean;
    descendants: number;
}
export interface SessionSubagentsView {
    count: number;
    totalTokens: number;
    spend: number;
    subscriptionValue: number;
    usageUnknown: number;
    failures: number;
    unpriced: string[];
    rows: SessionSubagentRow[];
}
export interface SessionUsageView {
    sessionId: string;
    updatedAt: number;
    firstAt: number;
    lastAt: number;
    total: UsageTotals;
    totalTokens: number;
    spend: number;
    subscriptionValue: number;
    unpriced: string[];
    turns: SessionUsageGroup[];
    betweenTurns: SessionUsageGroup | null;
    unattributed: SessionStepRow[];
    todaySpend: number;
    spanMs?: number;
    workMs?: number;
    subagents?: SessionSubagentsView;
}
export declare function totalsTokens(totals: UsageTotals): number;
