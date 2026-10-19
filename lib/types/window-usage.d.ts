import { type BillingMap, type CostedModelRow, type PricingTable, type ProviderUsageCard, type UsageRecord, type WorkspaceUsageRow } from './types.ts';
import type { RateResolver } from './stats.ts';
export declare const UNKNOWN_PROVIDER = "(\u672A\u77E5)";
export declare const UNATTRIBUTED_ID = "";
export declare const UNATTRIBUTED_TITLE = "\u672A\u5F52\u5C5E";
export declare function providerKeyOf(record: UsageRecord): string;
export declare function pathKey(path: string): string;
export interface WorkspaceRef {
    id: string;
    title: string;
    path: string;
}
export interface WindowAggregate {
    providers: ProviderUsageCard[];
    byWorkspace: WorkspaceUsageRow[];
    byModel: CostedModelRow[];
}
export declare function aggregateWindow(records: readonly UsageRecord[], workspaces: readonly WorkspaceRef[] | null, cwdOf: (sessionId: string) => string | undefined, pricing: PricingTable, resolve: RateResolver, billing?: BillingMap): WindowAggregate;
