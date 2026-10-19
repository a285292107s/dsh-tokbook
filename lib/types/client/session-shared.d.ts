import type { SessionStepRow, UsageFields } from '../types.ts';
export declare function hasPricedRow(rows: readonly SessionStepRow[]): boolean;
export declare const BUCKETS: ReadonlyArray<{
    key: keyof UsageFields;
    label: string;
}>;
export interface TurnPreview {
    turn: number;
    prompt: string;
    response: string;
}
export type PreviewMap = ReadonlyMap<number, TurnPreview>;
