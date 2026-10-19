export declare const PRICING_SYNC_STATE_FILE = "models-dev-sync.json";
export interface PricingSyncState {
    lastSyncDay: string | null;
    lastAttemptAt: number | null;
    lastError: string | null;
    nextAttemptAt: number | null;
    lastAdded: number | null;
}
export declare const PRICING_SYNC_RETRY_MS: number;
export declare function shouldSyncNow(state: PricingSyncState, nowMs: number, force: boolean): boolean;
export declare function readPricingSyncState(dir: string): Promise<PricingSyncState>;
export declare function writePricingSyncState(dir: string, state: PricingSyncState): Promise<void>;
