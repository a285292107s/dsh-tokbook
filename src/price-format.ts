/**
 * The pure rules of the price file's time axis, shared by the host half and the
 * browser half.
 *
 * Two independent axes decide a price:
 *   · the EFFECTIVE INSTANT — a local date, or a local date plus an exact hour —
 *     which picks the segment in force (the last `from ≤ the record's own
 *     timestamp`);
 *   · the DAILY SLOT — an hour range plus the weekdays it covers — which picks
 *     the exception price inside that segment. A moment no slot covers is billed
 *     at the segment's own whole-day price.
 *
 * Both halves validate a hand-written `pricing.json` by THE SAME rules, so a
 * table the browser draft accepts is never refused by the host writer. That is
 * why this module exists separately and stays dependency-free — no `node:fs`,
 * no React: `src/pricing.ts` and `src/client/pricing/draft.ts` both import it.
 *
 * @module dsh-tokbook/price-format
 */

import type { DaySet } from './types.ts'

/** The `from` of a segment with no effective instant: 最早一段, i.e. it has
 *  always applied. Stored as 0 so a plain `from <= timeMs` comparison works. */
export const EARLIEST = 0

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u
const HOUR_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:00$/u

/** Every day set a slot may carry, in display order (also the file's order). */
export const DAY_SETS: readonly DaySet[] = ['daily', 'weekdays', 'weekends']

/** The label each day set goes by on every surface that prints one. */
export const DAY_SET_LABELS: Record<DaySet, string> = {
  daily: '每天',
  weekdays: '工作日',
  weekends: '周末',
}

/** The hours one slot covers: `[start, end)`, so a whole-day slot is 0 → 24. */
export interface HourRange {
  start: number
  end: number
}

/** A day set plus an hour range: exactly what a slot covers. */
export interface SlotScope extends HourRange {
  days: DaySet
}

/** Local `YYYY-MM-DD` of an instant. */
export function dayKeyOf(ms: number): string {
  const at = new Date(ms)
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${String(at.getFullYear())}-${month}-${day}`
}

/** Local hour of day (0–23) of an instant. */
export function hourOfDay(ms: number): number {
  return new Date(ms).getHours()
}

/** The local start of the hour containing `ms` — the file's own time unit, i.e.
 *  the instant a `from` of `YYYY-MM-DDTHH:00` names. The price axis is read at
 *  this precision, so a ledger instant has to be floored to it before the two
 *  can be compared (or drawn together). */
export function hourStartMs(ms: number): number {
  const at = new Date(ms)
  at.setMinutes(0, 0, 0)
  return at.getTime()
}

/** Local weekday (0 = Sunday … 6 = Saturday) of an instant. */
export function weekdayOf(ms: number): number {
  return new Date(ms).getDay()
}

/** Local-midnight epoch ms of a `YYYY-MM-DD` date; null when it is not a real
 *  calendar date (2026-02-31 is not). */
export function dayStartMs(date: string): number | null {
  if (!DATE_RE.test(date)) return null
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const at = new Date(year, month - 1, day)
  if (at.getFullYear() !== year || at.getMonth() !== month - 1 || at.getDate() !== day) return null
  return at.getTime()
}

/**
 * Epoch ms of a file/wire instant: `YYYY-MM-DD` (local midnight) or
 * `YYYY-MM-DDTHH:00` (that local hour). Null when it is not a real date, not an
 * exact hour, or names a local hour this timezone does not have (a DST
 * spring-forward) — a table that cannot be resolved to one instant is refused
 * rather than silently rounded.
 */
export function instantMs(text: string): number | null {
  if (DATE_RE.test(text)) return dayStartMs(text)
  if (!HOUR_RE.test(text)) return null
  const date = text.slice(0, 10)
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const hour = Number(text.slice(11, 13))
  if (dayStartMs(date) === null) return null
  const at = new Date(year, month - 1, day, hour)
  if (at.getFullYear() !== year || at.getMonth() !== month - 1 || at.getDate() !== day) return null
  if (at.getHours() !== hour) return null
  return at.getTime()
}

/** The file text of an instant: the plain date at local midnight, else
 *  `YYYY-MM-DDTHH:00`. Midnight keeps the short form, so the common case reads
 *  (and diffs) exactly as it did before hourly instants existed. */
export function instantKey(ms: number): string {
  const day = dayKeyOf(ms)
  const hour = hourOfDay(ms)
  return hour === 0 ? day : `${day}T${String(hour).padStart(2, '0')}:00`
}

/** An hour number as a clock label: 9 → `09:00`, 24 → `24:00`. */
export function clockLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/** A slot's hour range as every surface prints it: `09:00–12:00`. */
export function rangeLabel(range: HourRange): string {
  return `${clockLabel(range.start)}–${clockLabel(range.end)}`
}

/** Whether an hour range is well formed: whole hours with
 *  `0 ≤ start < end ≤ 24` (end-exclusive, so 24 closes the day). */
export function isHourRange(range: HourRange): boolean {
  return Number.isInteger(range.start) && Number.isInteger(range.end)
    && range.start >= 0 && range.start < range.end && range.end <= 24
}

/** Whether two hour ranges share an hour. */
export function hourRangesOverlap(left: HourRange, right: HourRange): boolean {
  return left.start < right.end && right.start < left.end
}

/** Whether two day sets have a weekday in common. */
export function daySetsIntersect(left: DaySet, right: DaySet): boolean {
  return left === 'daily' || right === 'daily' || left === right
}

/** Whether a day set covers a local weekday (0 = Sunday). */
export function daySetCovers(days: DaySet, weekday: number): boolean {
  if (days === 'daily') return true
  const weekend = weekday === 0 || weekday === 6
  return days === 'weekends' ? weekend : !weekend
}

/** Whether one slot covers an instant: the instant's local weekday is in the
 *  slot's day set and its local hour falls inside `[start, end)`. */
export function slotCovers(slot: SlotScope, ms: number): boolean {
  const hour = hourOfDay(ms)
  return hour >= slot.start && hour < slot.end && daySetCovers(slot.days, weekdayOf(ms))
}

/** Whether two slots can ever be in force at the same moment. The write path
 *  refuses such a pair, so "the slot in force at an instant" is never
 *  ambiguous; a day-disjoint pair may share an hour range (工作日早高峰 next to
 *  周末早高峰). */
export function slotsOverlap(left: SlotScope, right: SlotScope): boolean {
  return hourRangesOverlap(left, right) && daySetsIntersect(left.days, right.days)
}
