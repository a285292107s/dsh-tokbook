import type { UsageFields, UsageRecord, UsageRecordKind } from './types.ts';
export interface TokenUsageLike {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
}
export interface SessionEventLike {
    readonly type: string;
    readonly time: number;
    readonly seq: number;
    readonly data?: {
        usage?: TokenUsageLike;
        model?: string;
        message?: {
            id: string;
            source: {
                provider?: string;
                model: string;
                callId?: string;
            };
        };
        provider?: string;
        source?: {
            provider?: string;
            model: string;
        };
        reason?: {
            kind: string;
            error?: {
                code?: string;
            };
        };
        failure?: {
            code?: string;
        };
        compactionId?: string;
        retryId?: string;
        retry?: number;
        turn?: number;
        step?: number;
        callId?: string;
        name?: string;
        stream?: readonly unknown[];
        childId?: string;
        label?: string;
    };
}
export declare function projectUsage(usage: TokenUsageLike | undefined): UsageFields | undefined;
export declare function recordFromMessage(event: SessionEventLike, sessionId: string): UsageRecord;
export declare function recordFromCompaction(event: SessionEventLike, sessionId: string): UsageRecord;
export declare function recordFromTurnEnd(event: SessionEventLike, sessionId: string, model: string): UsageRecord | null;
export declare function recordFromRetry(event: SessionEventLike, sessionId: string, model: string): UsageRecord;
export declare function recordOfEvent(event: SessionEventLike, sessionId: string, lastModel: string, recordCompaction?: boolean): UsageRecord | null;
export declare function modelOfEvent(event: SessionEventLike): string | undefined;
export declare function providerOfEvent(event: SessionEventLike): string | undefined;
export declare function coerceRecord(value: unknown): UsageRecord | null;
export declare function parseRecord(line: string): UsageRecord | null;
export declare function serializeRecord(record: UsageRecord): string;
export type { UsageRecordKind };
