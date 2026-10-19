import type { BillingMap, BillingNature, CurrencyMap, FxSetting, HolidayCalendar, ModelPricing, PriceEntry, PriceSlot, PricingTable, RateKey, UsageTotals } from './types.ts';
export declare const PRICING_FILE = "pricing.json";
export { DAY_SETS, PRICING_BILLING_KEY, PRICING_CALENDAR_KEY, PRICING_CURRENCY_KEY, PRICING_FX_KEY, dayKeyOf, dayStartMs, } from './price-format.ts';
interface Logger {
    error(...args: unknown[]): void;
    warn?(...args: unknown[]): void;
}
export interface PriceFile {
    table: PricingTable;
    billing: BillingMap;
    currency: CurrencyMap;
    calendar: HolidayCalendar;
    fx?: FxSetting;
    revision: string;
}
export declare function coercePriceFile(value: unknown, logger?: Logger): PriceFile;
export declare function readPriceFile(dir: string, logger?: Logger): Promise<PriceFile>;
export type PriceParse = {
    ok: true;
    file: PriceFile;
} | {
    ok: false;
    error: string;
};
export declare function parsePriceInput(value: unknown): PriceParse;
export declare function writePriceFile(dir: string, file: PriceFile, logger?: Logger): Promise<void>;
export declare function entryAt(table: PricingTable, route: string | undefined, model: string): PriceEntry | null;
export declare function slotAt(entry: PriceEntry, timeMs: number, holidays?: ReadonlySet<string>): PriceSlot | null;
export declare function ratesOfEntry(entry: PriceEntry, timeMs: number, holidays?: ReadonlySet<string>): ModelPricing;
export declare function ratesAt(table: PricingTable, route: string | undefined, model: string, timeMs: number, holidays?: ReadonlySet<string>): ModelPricing | null;
export declare function rateKeyAt(table: PricingTable, route: string | undefined, model: string, timeMs: number, holidays?: ReadonlySet<string>): RateKey;
export declare function priceOfKey(table: PricingTable, route: string | undefined, model: string, key: RateKey): ModelPricing | null;
export declare function billingOf(billing: BillingMap, route: string | undefined): BillingNature;
export declare function costOf(totals: UsageTotals, prices: ModelPricing): number;
export declare function cnyTable(table: PricingTable, currency: CurrencyMap, fx: FxSetting | undefined): PricingTable;
