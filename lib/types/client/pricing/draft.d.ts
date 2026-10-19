import type { BillingNature, DaySet, ModelPricing, PriceCurrency, PricingCalendarInput, PricingView } from '../../types.ts';
export interface DraftRates {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
}
export type SlotRates = Partial<DraftRates>;
export declare const RATE_FIELD_NAMES: ReadonlyArray<readonly [keyof DraftRates, keyof ModelPricing]>;
export interface RateTexts {
    input: string;
    output: string;
    cacheRead: string;
    cacheWrite: string;
}
export interface SlotDraft extends RateTexts {
    id: number;
    days: DaySet;
    start: string;
    end: string;
}
export interface ModelDraft extends RateTexts {
    model: string;
    name?: string;
    records: number;
    unpriced?: number;
    slots: SlotDraft[];
}
export interface RouteDraft {
    route: string;
    label: string;
    billing: BillingNature;
    currency: PriceCurrency;
    records: number;
    models: Map<string, ModelDraft>;
}
export type PriceDraft = Map<string, RouteDraft>;
export interface CalendarHolidayDraft {
    id: number;
    start: string;
    end: string;
}
export interface CalendarDraft {
    year: string;
    holidays: CalendarHolidayDraft[];
}
export type CalendarEntries = Map<string, CalendarDraft>;
export interface PriceState {
    routes: PriceDraft;
    calendar: CalendarEntries;
    holidays: ReadonlySet<string>;
    autoYears: ReadonlySet<string>;
    fx: string;
}
export declare function newHoliday(seed?: Partial<Omit<CalendarHolidayDraft, 'id'>>): CalendarHolidayDraft;
export declare function defaultCalendarYear(entries: CalendarEntries, now?: Date): string;
export declare function missingYearDrafts(calendar: CalendarEntries, missingYears: readonly string[]): CalendarDraft[];
export type HolidayRead = {
    kind: 'empty';
} | {
    kind: 'partial';
} | {
    kind: 'ok';
    days: number;
} | {
    kind: 'bad';
    error: string;
};
export declare function readHolidays(year: string, rows: readonly CalendarHolidayDraft[]): readonly HolidayRead[];
export declare function calendarYearTally(year: string, rows: readonly CalendarHolidayDraft[]): {
    ranges: number;
    days: number;
};
export declare function composeCalendar(entries: CalendarEntries, autoYears?: ReadonlySet<string>): {
    ok: true;
    calendar: PricingCalendarInput;
} | {
    ok: false;
    error: string;
};
export declare function holidaysOf(entries: CalendarEntries): ReadonlySet<string>;
export declare function withCalendar(state: PriceState, calendar: CalendarEntries): PriceState;
export declare function adoptYear(state: PriceState, year: string): PriceState;
export declare function fxValue(text: string): number | null;
export declare function fxIssue(text: string): string | null;
export declare function fxSignature(text: string): string;
export declare function fxSetting(text: string): {
    cnyPerUsd: number;
} | null;
export declare function withFx(state: PriceState, fx: string): PriceState;
export declare function withRouteCurrency(state: PriceState, route: string, to: PriceCurrency, cnyPerUsd: number | null): PriceState;
export declare function slotRange(slot: SlotDraft): {
    start: number;
    end: number;
};
export declare function isBlankSlot(slot: SlotDraft): boolean;
export declare function effectiveSlots(price: {
    slots: readonly SlotDraft[];
}): SlotDraft[];
export declare function newSlot(seed?: Partial<Omit<SlotDraft, 'id'>>): SlotDraft;
export declare function duplicateSlot(slot: SlotDraft): SlotDraft;
export declare function withSlotStart(slot: SlotDraft, startText: string): SlotDraft;
export declare function withSlotEnd(slot: SlotDraft, endText: string): SlotDraft;
export declare function draftFromView(view: PricingView): PriceState;
export declare function isUnpriced(model: ModelDraft): boolean;
export declare function priceUnknown(model: ModelDraft): boolean;
export type RateField = keyof RateTexts;
export interface InForceRates {
    slot: SlotDraft | null;
    values: RateTexts;
}
export declare function ratesInForce(model: ModelDraft, holidays: ReadonlySet<string>, nowMs?: number): InForceRates | null;
export type FieldState = 'ok' | 'empty' | 'bad';
export declare function fieldState(holder: RateTexts | null, field: RateField): FieldState;
export declare function inheritedRates(price: RateTexts): RateTexts;
export interface InheritedCell {
    value?: string;
    note?: string;
}
export declare function inheritedCell(price: RateTexts, slot: SlotDraft | null, field: RateField, show?: (cnyText: string) => string): InheritedCell;
export declare function ratesOf(holder: RateTexts): DraftRates | null;
export declare function slotRates(slot: SlotDraft): {
    ok: true;
    rates: SlotRates;
} | {
    ok: false;
    error: string;
};
export declare function dayLabel(slot: SlotDraft): string;
export declare function priceIssue(model: ModelDraft): string | null;
export declare function modelSignature(model: ModelDraft): string;
export declare function rowKey(route: string, model: string): string;
export declare function composePriceBody(state: PriceState): {
    ok: true;
    body: Record<string, unknown>;
} | {
    ok: false;
    error: string;
};
export interface PriceBaseline {
    models: Map<string, string>;
    billing: Map<string, BillingNature>;
    currency: Map<string, PriceCurrency>;
    calendar: string;
    fx: string;
}
export declare function baselinesOf(view: PricingView): PriceBaseline;
export declare function baselineOfDraft(state: PriceState): PriceBaseline;
export declare function stagedChanges(state: PriceState, baseline: PriceBaseline): number;
export declare function calendarDirty(state: PriceState, baseline: PriceBaseline): boolean;
export declare function modelDirty(route: string, row: ModelDraft, baseline: ReadonlyMap<string, string>): boolean;
export declare function routeOptionLabel(card: RouteDraft): string;
export declare function modelOptionLabel(row: ModelDraft, dirty: boolean): string;
