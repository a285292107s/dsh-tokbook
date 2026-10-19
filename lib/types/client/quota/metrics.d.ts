import type { QuotaCard, QuotaWindowView } from '../../types.ts';
export type QuotaTone = 'ok' | 'warn' | 'danger';
export declare function toneOf(pct: number): QuotaTone;
export declare function balanceUsd(credits: QuotaCard['credits']): number;
export declare function extraCreditsUsd(credits: NonNullable<QuotaCard['credits']>): number;
export declare function monthlyAllowanceWindow(card: QuotaCard): QuotaWindowView | null;
export declare function ringPressure(card: QuotaCard): {
    pct: number;
    tone: QuotaTone;
    cap: string;
} | undefined;
export declare function headStateWord(card: QuotaCard | null): {
    word: string;
    alert: boolean;
};
export declare function resetLabel(window: QuotaWindowView): string;
export declare function planContext(card: QuotaCard): string;
export declare function money(value: number): string;
export declare function formatClock(epochMs: number): string;
