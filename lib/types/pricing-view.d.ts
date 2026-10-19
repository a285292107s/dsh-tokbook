import type { HolidayCalendar, HolidaySyncView, PricingSyncView, PricingTable, PricingView, RouteCatalogEntry, UsageRecord } from './types.ts';
interface Logger {
    error(...args: unknown[]): void;
}
export interface LedgerModelUsage {
    records: number;
    firstAt: number;
    unpriced: number;
}
export interface LedgerUsage {
    byRouteModel: ReadonlyMap<string, ReadonlyMap<string, LedgerModelUsage>>;
    byRoute: ReadonlyMap<string, number>;
}
export declare function ledgerUsageOf(records: readonly UsageRecord[], table: PricingTable, holidays: ReadonlySet<string>): LedgerUsage;
export declare function readPricingView(dir: string, catalog: readonly RouteCatalogEntry[], ledger: LedgerUsage, logger?: Logger, holidays?: {
    readonly calendar: HolidayCalendar;
    readonly autoOnly: readonly string[];
    readonly sync: HolidaySyncView;
}, syncView?: PricingSyncView): Promise<PricingView>;
export {};
