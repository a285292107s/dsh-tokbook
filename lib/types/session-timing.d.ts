import type { StepTiming } from './types.ts';
import { type SessionEventLike } from './usage-record.ts';
export declare function countOf(value: unknown): number | undefined;
export interface SessionTimingIndex {
    steps: ReadonlyMap<string, StepTiming>;
    compactions: ReadonlyMap<string, number>;
}
export declare function timingIndexOf(sessionId: string, events: readonly SessionEventLike[]): SessionTimingIndex;
