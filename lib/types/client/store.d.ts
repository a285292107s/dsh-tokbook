import type { TokBookOverview } from '../types.ts';
export interface TokBookViewSnapshot {
    readonly overview: TokBookOverview | null;
    readonly error: string | null;
    readonly pricingDirty: boolean;
    readonly quotaAlert: boolean;
}
export interface TokBookViewStore {
    subscribe(listener: () => void): () => void;
    getSnapshot(): TokBookViewSnapshot;
    setOverview(overview: TokBookOverview | null): void;
    setError(error: string | null): void;
    setPricingDirty(dirty: boolean): void;
    setQuotaAlert(alert: boolean): void;
}
export declare function createTokBookViewStore(): TokBookViewStore;
