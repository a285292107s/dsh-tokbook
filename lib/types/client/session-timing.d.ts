import type { SessionStepRow, StepTiming } from '../types.ts';
type TimeKind = 'model' | 'wait' | 'generate' | 'tool';
export interface TimeSegment {
    key: string;
    value: number;
    kind: TimeKind;
}
export declare const PHASE_LABEL: Record<TimeKind, string>;
export declare function TimeDial({ workMs, segments }: {
    workMs?: number;
    segments: readonly TimeSegment[];
}): import("react").JSX.Element;
export declare function PhaseLedger({ segments }: {
    segments: readonly TimeSegment[];
}): import("react").JSX.Element;
export declare function sumSegments(rows: readonly SessionStepRow[]): TimeSegment[];
export declare function stepSegments(timing: StepTiming | undefined): TimeSegment[];
export {};
