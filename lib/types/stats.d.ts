import { type BillingMap, type CostedSummary, type PricingTable, type ProviderRange, type RateKey, type TokenSummary, type UsageDayRow, type UsageHourRow, type UsageModelRow, type UsageRateRow, type UsageRecord, type UsageTotals } from './types.ts';
export interface PersistenceSnapshotLike {
    header: {
        id: string;
        cwd?: string;
        parentSession?: string;
        origin?: 'subagent';
    };
    revision?: unknown;
}
export declare function snapshotBaseline(snapshots: readonly PersistenceSnapshotLike[]): Map<string, string>;
export declare function staleSessionIds(syncedOnce: boolean, syncedBySession: ReadonlyMap<string, string>, snapshots: readonly PersistenceSnapshotLike[]): string[];
export declare function isLedgerStale(syncedOnce: boolean, syncedBySession: ReadonlyMap<string, string>, snapshots: readonly PersistenceSnapshotLike[]): boolean;
export type RateResolver = (record: UsageRecord) => RateKey;
export type StatsLogger = {
    error(...args: unknown[]): void;
    info?(...args: unknown[]): void;
};
export declare function rangeDayWindow(range: ProviderRange, now?: () => Date): {
    fromDay: string;
    toDay: string;
};
export declare function clearRecordCache(dir?: string): void;
export declare function listDayFiles(dir: string): Promise<string[]>;
export declare function readCachedRecords(dir: string, logger?: StatsLogger): Promise<UsageRecord[]>;
export declare function readRecordsByDayRange(dir: string, fromDay: string, toDay: string, logger?: StatsLogger): Promise<UsageRecord[]>;
export declare function warmRecordCache(dir: string, logger?: StatsLogger): Promise<void>;
export declare const ROLLUP_FILE_NAME = "rollup.json";
export declare const ROLLUP_SCHEMA_VERSION = 10;
export interface RollupFile {
    schemaVersion: number;
    upto: string;
    pricingRevision: string;
    files: Record<string, string>;
    lastEventAt: number | null;
    total: UsageTotals;
    byDay: UsageDayRow[];
    byHour: UsageHourRow[];
    byModel: UsageModelRow[];
    rateRows: UsageRateRow[];
}
export declare function rollupIsCurrent(rollup: RollupFile, stamps: ReadonlyMap<string, string>): boolean;
export declare function readRollup(dir: string, logger?: StatsLogger, pricingRevision?: string): Promise<RollupFile | null>;
export declare function writeRollup(dir: string, rollup: RollupFile): Promise<void>;
export interface SummaryWithLastEvent extends TokenSummary {
    lastEventAt: number | null;
}
export declare function summarizeRecords(records: readonly UsageRecord[], resolve?: RateResolver): SummaryWithLastEvent;
export declare function mergeSummaries(left: SummaryWithLastEvent, right: SummaryWithLastEvent): SummaryWithLastEvent;
export declare function attachCosts(summary: TokenSummary & {
    dataDir: string;
}, pricing: PricingTable, billing?: BillingMap): CostedSummary;
export declare function buildSummary(dir: string, now?: () => Date, resolve?: RateResolver, logger?: StatsLogger, options?: {
    pricingRevision?: string;
}): Promise<SummaryWithLastEvent & {
    dataDir: string;
}>;
