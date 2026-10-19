import { type ModelsDevCatalog } from './models-dev.ts';
import type { PricingTable, UsageRecord } from './types.ts';
export interface SyncReport {
    added: number;
    skipped: number;
    reasons: Record<string, string>;
}
export declare function billedRouteModels(records: readonly UsageRecord[]): Map<string, Set<string>>;
export declare function mergeCatalogIntoTable(table: PricingTable, currency: Readonly<Record<string, 'CNY' | 'USD'>>, ledger: ReadonlyMap<string, ReadonlySet<string>>, catalog: ModelsDevCatalog): {
    table: PricingTable;
    report: SyncReport;
};
