import { type SessionTimingIndex } from './session-timing.ts';
import { type RateResolver, type StatsLogger } from './stats.ts';
import { type SessionEventLike } from './usage-record.ts';
import type { SyncPersistence } from './sync.ts';
import { type BillingMap, type PricingTable, type SessionUsageView, type UsageRecord } from './types.ts';
export interface SessionUsageInput {
    sessionId: string;
    records: readonly UsageRecord[];
    join: SessionJoin;
    sessions?: readonly SessionLineageLike[];
    pricing: PricingTable;
    billing: BillingMap;
    resolve: RateResolver;
    todaySpend: number;
    updatedAt: number;
}
export interface SessionLineageLike {
    header: {
        id: string;
        parentSession?: string;
        origin?: string;
    };
}
interface Attribution {
    turn: number;
    step?: number;
}
export interface SessionJoin {
    turn: ReadonlyMap<string, Attribution> | null;
    timing: SessionTimingIndex | null;
    span: {
        first: number;
        last: number;
    } | null;
    labels: ReadonlyMap<string, string>;
}
export declare function joinOfEvents(sessionId: string, events: readonly SessionEventLike[]): SessionJoin;
export declare function sessionJoin(persistence: SyncPersistence | undefined, sessionId: string, logger?: StatsLogger): Promise<SessionJoin>;
export declare function readSessionJoinEvents(persistence: SyncPersistence | undefined, sessionId: string, logger?: StatsLogger): Promise<readonly SessionEventLike[] | null>;
export declare function buildSessionUsageView(input: SessionUsageInput): SessionUsageView;
export {};
