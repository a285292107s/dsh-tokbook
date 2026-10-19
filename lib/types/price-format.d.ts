import type { DaySet, HolidayRange } from './types.ts';
export declare const PRICING_BILLING_KEY = "$billing";
export declare const PRICING_CALENDAR_KEY = "$calendar";
export declare const PRICING_CURRENCY_KEY = "$currency";
export declare const PRICING_FX_KEY = "$fx";
export declare const MAX_ROUTE_LENGTH = 128;
export declare const MAX_MODEL_LENGTH = 256;
export declare const DAY_SETS: readonly DaySet[];
export declare const DAY_SET_LABELS: Record<DaySet, string>;
export declare const DAY_SET_HINTS: Record<DaySet, string>;
export interface HourRange {
    start: number;
    end: number;
}
export interface SlotScope extends HourRange {
    days: DaySet;
}
export declare function dayKeyOf(ms: number): string;
export declare function hourOfDay(ms: number): number;
export declare function weekdayOf(ms: number): number;
export declare function dayStartMs(date: string): number | null;
export declare function clockLabel(hour: number): string;
export declare function dayIndex(date: string): number | null;
export declare function dayKeyOfIndex(index: number): string;
export declare function isValidHolidayRange(range: HolidayRange): boolean;
export declare function holidayDates(range: HolidayRange): string[];
export declare function holidaySet(calendar: Readonly<Record<string, readonly HolidayRange[]>>): ReadonlySet<string>;
export declare function yearOfDate(date: string): string | null;
export declare function isYearKey(year: string): boolean;
export declare function rangeLabel(range: HourRange): string;
export declare function isHourRange(range: HourRange): boolean;
export declare function hourRangesOverlap(left: HourRange, right: HourRange): boolean;
export declare function daySetCovers(days: DaySet, weekday: number, date: string, holidays: ReadonlySet<string>): boolean;
export declare function slotCovers(slot: SlotScope, ms: number, holidays: ReadonlySet<string>): boolean;
export declare function slotsOverlap(left: SlotScope, right: SlotScope): boolean;
