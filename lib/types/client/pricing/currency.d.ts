import type { PriceCurrency } from '../../types.ts';
export interface MoneyView {
    route: PriceCurrency;
    cnyPerUsd: number | null;
}
export declare function parseAmount(text: string): number | null;
export declare function rateOf(view: MoneyView): number | null;
export declare function unitOf(view: MoneyView): string;
export declare function counterpartOf(view: MoneyView, text: string): string | null;
export declare function convertText(view: MoneyView, text: string, to: PriceCurrency): string | null;
export declare function inverseHint(cnyPerUsd: number | null): string | null;
