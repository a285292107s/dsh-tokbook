import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { dayIndex, dayKeyOfIndex, isYearKey } from './price-format.ts'
import type { HolidayCalendar, HolidayRange } from './types.ts'

export const HOLIDAY_CN_BASE = 'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master'

export const HOLIDAY_CN_TIMEOUT_MS = 10_000

export const HOLIDAY_CACHE_FILE = 'holiday-cn.json'

export const HOLIDAY_REFRESH_DAYS = 1

export interface HolidayCachedYear {
  ranges: HolidayRange[]
  fetchedAt: number
}

export interface HolidayCache {
  years: Record<string, HolidayCachedYear>
  lastAttemptAt?: number | null
  lastError?: string | null
}

export const EMPTY_HOLIDAY_CACHE: HolidayCache = { years: {} }

function isRange(value: unknown): value is HolidayRange {
  if (typeof value !== 'object' || value === null) return false
  const raw = value as Record<string, unknown>
  return typeof raw.start === 'string' && typeof raw.end === 'string'
}

export async function readHolidayCache(dir: string): Promise<HolidayCache> {
  let text: string
  try {
    text = await readFile(join(dir, HOLIDAY_CACHE_FILE), 'utf8')
  } catch {
    return EMPTY_HOLIDAY_CACHE
  }
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_HOLIDAY_CACHE
    const raw = parsed as Record<string, unknown>
    const years = raw.years
    if (typeof years !== 'object' || years === null) return EMPTY_HOLIDAY_CACHE
    const kept: Record<string, HolidayCachedYear> = {}
    for (const [year, entry] of Object.entries(years as Record<string, unknown>)) {
      if (!isYearKey(year) || typeof entry !== 'object' || entry === null) continue
      const value = entry as Record<string, unknown>
      if (!Array.isArray(value.ranges) || typeof value.fetchedAt !== 'number') continue
      kept[year] = { ranges: value.ranges.filter(isRange), fetchedAt: value.fetchedAt }
    }
    const lastAttemptAt = typeof raw.lastAttemptAt === 'number' ? raw.lastAttemptAt : null
    const lastError = typeof raw.lastError === 'string' ? raw.lastError : null
    return { years: kept, lastAttemptAt, lastError }
  } catch {
    return EMPTY_HOLIDAY_CACHE
  }
}

export async function writeHolidayCache(dir: string, cache: HolidayCache): Promise<void> {
  const target = join(dir, HOLIDAY_CACHE_FILE)
  const tmp = `${target}.${String(process.pid)}.${randomUUID()}.tmp`
  await mkdir(dirname(target), { recursive: true })
  try {
    await writeFile(tmp, JSON.stringify(cache, null, 2), 'utf8')
    await unlink(target).catch(() => undefined)
    await rename(tmp, target)
  } catch (error) {
    await unlink(tmp).catch(() => undefined)
    throw error
  }
}

export function parseHolidayYear(body: unknown, year: string): HolidayRange[] | null {
  if (typeof body !== 'object' || body === null) return null
  const raw = body as Record<string, unknown>
  if (raw.year !== undefined && Number(raw.year) !== Number(year)) return null
  if (!Array.isArray(raw.days)) return null
  const indexes: number[] = []
  for (const item of raw.days) {
    if (typeof item !== 'object' || item === null) continue
    const day = item as Record<string, unknown>
    if (day.isOffDay !== true) continue
    if (typeof day.date !== 'string') continue
    if (day.date.slice(0, 4) !== year) continue
    const index = dayIndex(day.date)
    if (index !== null) indexes.push(index)
  }
  return mergeIndexes(indexes)
}

function mergeIndexes(indexes: readonly number[]): HolidayRange[] {
  const sorted = [...new Set(indexes)].sort((left, right) => left - right)
  const ranges: HolidayRange[] = []
  for (const index of sorted) {
    const last = ranges[ranges.length - 1]
    if (last !== undefined && index - (dayIndex(last.end) ?? index) === 1) last.end = dayKeyOfIndex(index)
    else ranges.push({ start: dayKeyOfIndex(index), end: dayKeyOfIndex(index) })
  }
  return ranges
}

export async function fetchHolidayYear(year: string): Promise<HolidayRange[]> {
  const response = await fetch(`${HOLIDAY_CN_BASE}/${year}.json`, {
    signal: AbortSignal.timeout(HOLIDAY_CN_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`holiday-cn/${year}.json 答 HTTP ${String(response.status)}`)
  const body: unknown = await response.json()
  const ranges = parseHolidayYear(body, year)
  if (ranges === null) throw new Error(`holiday-cn/${year}.json 的形状读不懂`)
  return ranges
}

export function mergeHolidayCalendars(manual: HolidayCalendar, auto: HolidayCalendar): HolidayCalendar {
  const merged: HolidayCalendar = { ...auto }
  for (const [year, ranges] of Object.entries(manual)) merged[year] = ranges
  return merged
}

export function autoOnly(manual: HolidayCalendar, auto: HolidayCalendar): HolidayCalendar {
  const out: HolidayCalendar = {}
  for (const [year, ranges] of Object.entries(auto)) {
    if (manual[year] === undefined) out[year] = ranges
  }
  return out
}

export function calendarSignature(calendar: HolidayCalendar): string {
  const years = Object.keys(calendar).sort((left, right) => left.localeCompare(right))
  return years.map(year => `${year}:${calendar[year]!.map(range => `${range.start}~${range.end}`).join(',')}`).join(';')
}

export function isFresh(entry: HolidayCachedYear | undefined, nowMs: number): boolean {
  if (entry === undefined) return false
  return nowMs - entry.fetchedAt < HOLIDAY_REFRESH_DAYS * 86_400_000
}

export type AutoHolidayState = 'ok' | 'stale' | 'failed' | 'missing'

export function autoHolidayState(
  cache: HolidayCache,
  wantedYears: readonly string[],
  nowMs: number,
): { state: AutoHolidayState; covered: string[]; uncovered: string[] } {
  const covered = wantedYears.filter(year => (cache.years[year]?.ranges.length ?? 0) > 0)
  const uncovered = wantedYears.filter(year => !covered.includes(year))
  const error = cache.lastError ?? null
  const lastAttemptAt = cache.lastAttemptAt ?? null
  if (wantedYears.length === 0) return { state: 'ok', covered, uncovered }
  if (covered.length === 0) return { state: 'missing', covered, uncovered }
  if (error !== null) return { state: 'failed', covered, uncovered }
  const fresh = covered.some(year => isFresh(cache.years[year], nowMs))
  if (!fresh && lastAttemptAt !== null && nowMs - lastAttemptAt >= HOLIDAY_REFRESH_DAYS * 86_400_000) {
    return { state: 'stale', covered, uncovered }
  }
  return { state: 'ok', covered, uncovered }
}
