import type { IncomingMessage, ServerResponse } from 'node:http';
import { type HolidayRefreshResult, type PricingLookupResult, type PricingSyncResult, type PricingView, type ProviderRange, type ProviderUsageView, type QuotaCard, type QuotaView, type SessionUsageView, type SyncStatusView, type TokBookOverview } from './types.ts';
import type { PriceParse } from './pricing.ts';
export interface WebServerLike {
    register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
}
export interface RescanView {
    status: 'running' | 'skipped';
    lastSyncAt: number | null;
}
export declare function isSameOriginFetch(req: IncomingMessage): boolean;
export declare function registerTokBookRoutes(webServer: WebServerLike | undefined, overview: () => TokBookOverview | Promise<TokBookOverview>, syncState: () => SyncStatusView | Promise<SyncStatusView>, rescan: () => RescanView | Promise<RescanView>): () => void;
export declare function parseProviderRange(req: IncomingMessage): ProviderRange | null;
export declare function registerTokBookUsageRoute(webServer: WebServerLike | undefined, usageView: (range: ProviderRange) => ProviderUsageView | Promise<ProviderUsageView>): () => void;
export declare function registerTokBookSessionRoute(webServer: WebServerLike | undefined, sessionView: (sessionId: string) => SessionUsageView | Promise<SessionUsageView>): () => void;
export declare function registerTokBookQuotaRoute(webServer: WebServerLike | undefined, quotaView: () => QuotaView | Promise<QuotaView>, quotaCardOf: (provider: string, force?: boolean) => Promise<QuotaCard>): () => void;
export declare function registerTokBookPricingSyncRoute(webServer: WebServerLike | undefined, syncPricing: (force: boolean) => Promise<PricingSyncResult>): () => void;
export declare function registerTokBookHolidaySyncRoute(webServer: WebServerLike | undefined, refreshHolidays: (options: {
    force?: boolean;
    extraYears?: readonly string[];
}) => Promise<HolidayRefreshResult>): () => void;
export declare function registerTokBookPricingLookupRoute(webServer: WebServerLike | undefined, lookup: (keyword: string) => Promise<PricingLookupResult>): () => void;
export declare function registerTokBookPricingRoutes(webServer: WebServerLike | undefined, pricingView: () => PricingView | Promise<PricingView>, savePricing: (body: unknown) => Promise<PriceParse>): () => void;
