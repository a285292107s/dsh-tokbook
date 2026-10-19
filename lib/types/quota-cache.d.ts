import type { QuotaCard } from './types.ts';
export interface QuotaSnapshotFile {
    savedAt: number;
    card: QuotaCard;
}
export declare function readQuotaSnapshot(dir: string, provider: string): Promise<QuotaCard | null>;
export declare function writeQuotaSnapshot(dir: string, provider: string, card: QuotaCard): Promise<void>;
