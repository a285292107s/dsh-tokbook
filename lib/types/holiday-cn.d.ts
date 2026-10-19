import type { HolidayCalendar, HolidayRange } from './types.ts';
export declare const HOLIDAY_CN_BASE = "https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master";
export declare const HOLIDAY_CN_TIMEOUT_MS = 10000;
export declare const HOLIDAY_CACHE_FILE = "holiday-cn.json";
export declare const HOLIDAY_REFRESH_DAYS = 1;
export interface HolidayCachedYear {
    ranges: HolidayRange[];
    fetchedAt: number;
}
export interface HolidayCache {
    years: Record<string, HolidayCachedYear>;
    lastAttemptAt?: number | null;
    lastError?: string | null;
}
export declare const EMPTY_HOLIDAY_CACHE: HolidayCache;
export declare function readHolidayCache(dir: string): Promise<HolidayCache>;
export declare function writeHolidayCache(dir: string, cache: HolidayCache): Promise<void>;
export declare function parseHolidayYear(body: unknown, year: string): HolidayRange[] | null;
export declare function fetchHolidayYear(year: string): Promise<HolidayRange[]>;
export declare function mergeHolidayCalendars(manual: HolidayCalendar, auto: HolidayCalendar): HolidayCalendar;
export declare function autoOnly(manual: HolidayCalendar, auto: HolidayCalendar): HolidayCalendar;
export declare function calendarSignature(calendar: HolidayCalendar): string;
export declare function isFresh(entry: HolidayCachedYear | undefined, nowMs: number): boolean;
export type AutoHolidayState = 'ok' | 'stale' | 'failed' | 'missing';
export declare function autoHolidayState(cache: HolidayCache, wantedYears: readonly string[], nowMs: number): {
    state: AutoHolidayState;
    covered: string[];
    uncovered: string[];
};
