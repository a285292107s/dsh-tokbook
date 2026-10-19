export declare function isInitialized(dir: string): Promise<boolean>;
export declare function markInitialized(dir: string): Promise<void>;
export interface SyncProgressFile {
    syncedAt: number;
    sessions: Record<string, string>;
}
export declare function readSyncProgress(dir: string): Promise<SyncProgressFile | null>;
export declare function writeSyncProgress(dir: string, progress: SyncProgressFile): Promise<void>;
