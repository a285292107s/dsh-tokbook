import { type SessionEventLike } from './usage-record.ts';
import type { UsageLog } from './usage-log.ts';
export interface SyncResult {
    added: number;
    skipped: number;
    failedSessions: number;
}
export interface SyncProgressTick {
    processed: number;
    total: number;
    added: number;
    skipped: number;
    failedSessions: number;
}
export interface PersistenceSnapshotLike {
    header: {
        id: string;
        cwd?: string;
        parentSession?: string;
        origin?: 'subagent';
    };
    revision?: unknown;
}
export interface SyncPersistence {
    list?(): Promise<readonly unknown[]>;
    listSnapshots?(): Promise<readonly unknown[]>;
    inspect?(id: string): Promise<{
        meta: {
            id: string;
        };
        events: readonly SessionEventLike[];
    }>;
    open?(id: string, access: 'read'): Promise<SessionHandleLike>;
    stat?(id: string): Promise<{
        header?: unknown;
        revision?: unknown;
    } | undefined>;
}
export interface SessionHandleLike {
    read(offset?: number, length?: number): Promise<{
        events: readonly SessionEventLike[];
    }>;
    close?(): Promise<void>;
    inheritedEventCount?: number;
}
export declare function listPersistenceSnapshots(persistence: SyncPersistence, logger?: {
    error(...args: unknown[]): void;
}): Promise<readonly PersistenceSnapshotLike[]>;
export interface SyncDeps {
    persistence: SyncPersistence;
    log: UsageLog;
    recordCompaction?: boolean;
    onSessionFailure?: (id: string, error: unknown) => void;
    logger?: {
        error(...args: unknown[]): void;
    };
}
export interface SyncOptions {
    snapshots?: readonly PersistenceSnapshotLike[];
    sessionIds?: readonly string[];
    onTick?: (tick: SyncProgressTick) => void;
}
export declare function syncHistory(deps: SyncDeps, options?: SyncOptions): Promise<SyncResult>;
export declare function autoSyncIfNeeded(deps: SyncDeps, dir: string): Promise<SyncResult | null>;
