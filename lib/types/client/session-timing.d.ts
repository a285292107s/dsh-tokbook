import type { SessionStepRow, StepTiming } from '../types.ts';
export interface TimeBarRead {
    key: string;
    kind: TimeSegment['kind'];
    label: string;
    value: string;
}
export declare const PHASE_LABEL: Record<'wait' | 'generate' | 'model' | 'tool', string>;
export declare const LEGEND_SHAPE: ReadonlyArray<{
    kind: 'wait' | 'generate' | 'tool';
    share: number;
    label: string;
}>;
type TimeSegment = {
    key: string;
    value: number;
    kind: 'model' | 'wait' | 'generate' | 'tool' | 'work' | 'idle';
};
export interface TimeBarRead {
    key: string;
    kind: TimeSegment['kind'];
    label: string;
    value: string;
}
export declare function TimeReads({ reads }: {
    reads: readonly TimeBarRead[];
}): import("react").JSX.Element;
type TimeBarProps = {
    segments: readonly TimeSegment[];
} & ({
    tone: 'step';
} | {
    tone: 'turn';
    scale: number;
} | {
    tone: 'hero';
    scale: number;
    reads: readonly TimeBarRead[];
});
export declare function TimeBar(props: TimeBarProps): import("react").JSX.Element | null;
export declare function sumSegments(rows: readonly SessionStepRow[]): {
    key: string;
    value: number;
    kind: 'model' | 'wait' | 'generate' | 'tool';
}[];
export declare function stepSegments(timing: StepTiming | undefined): {
    key: string;
    value: number;
    kind: 'model' | 'wait' | 'generate' | 'tool';
}[];
export {};
