import type { DaySet, HolidayRange } from './types.ts'

export const PRICING_BILLING_KEY = '$billing'

export const PRICING_CALENDAR_KEY = '$calendar'

export const PRICING_CURRENCY_KEY = '$currency'

export const PRICING_FX_KEY = '$fx'

export const MAX_ROUTE_LENGTH = 128
export const MAX_MODEL_LENGTH = 256

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u

export const DAY_SETS: readonly DaySet[] = ['daily', 'weekdays', 'workdays', 'weekends']

export const DAY_SET_LABELS: Record<DaySet, string> = {
  daily: '每天',
  weekdays: '周一至周五',
  workdays: '法定工作日',
  weekends: '周末',
}

export const DAY_SET_HINTS: Record<DaySet, string> = {
  daily: '每天 00:00–24:00，含周末与节假日',
  weekdays: '按星期一到星期五计，法定节假日也算',
  workdays: '按工作日计；年历收录的法定节假日不生效',
  weekends: '仅星期六与星期日',
}

export interface HourRange {
  start: number
  end: number
}

export interface SlotScope extends HourRange {
  days: DaySet
}

export function dayKeyOf(ms: number): string {
  const at = new Date(ms)
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${String(at.getFullYear())}-${month}-${day}`
}

export function hourOfDay(ms: number): number {
  return new Date(ms).getHours()
}

export function weekdayOf(ms: number): number {
  return new Date(ms).getDay()
}

export function dayStartMs(date: string): number | null {
  if (!DATE_RE.test(date)) return null
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const at = new Date(year, month - 1, day)
  if (at.getFullYear() !== year || at.getMonth() !== month - 1 || at.getDate() !== day) return null
  return at.getTime()
}

export function clockLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function dayIndex(date: string): number | null {
  if (dayStartMs(date) === null) return null
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000
}

export function dayKeyOfIndex(index: number): string {
  const at = new Date(index * 86_400_000)
  const month = String(at.getUTCMonth() + 1).padStart(2, '0')
  const day = String(at.getUTCDate()).padStart(2, '0')
  return `${String(at.getUTCFullYear())}-${month}-${day}`
}

export function isValidHolidayRange(range: HolidayRange): boolean {
  const start = dayIndex(range.start)
  const end = dayIndex(range.end)
  return start !== null && end !== null && start <= end
}

export function holidayDates(range: HolidayRange): string[] {
  const start = dayIndex(range.start)
  const end = dayIndex(range.end)
  if (start === null || end === null || start > end) return []
  const dates: string[] = []
  for (let index = start; index <= end; index += 1) dates.push(dayKeyOfIndex(index))
  return dates
}

export function holidaySet(calendar: Readonly<Record<string, readonly HolidayRange[]>>): ReadonlySet<string> {
  const dates = new Set<string>()
  for (const ranges of Object.values(calendar)) {
    for (const range of ranges) {
      if (!isValidHolidayRange(range)) continue
      for (const date of holidayDates(range)) dates.add(date)
    }
  }
  return dates
}

export function yearOfDate(date: string): string | null {
  return DATE_RE.test(date) ? date.slice(0, 4) : null
}

export function isYearKey(year: string): boolean {
  return /^\d{4}$/u.test(year)
}

export function rangeLabel(range: HourRange): string {
  return `${clockLabel(range.start)}–${clockLabel(range.end)}`
}

export function isHourRange(range: HourRange): boolean {
  return Number.isInteger(range.start) && Number.isInteger(range.end)
    && range.start >= 0 && range.start < range.end && range.end <= 24
}

export function hourRangesOverlap(left: HourRange, right: HourRange): boolean {
  return left.start < right.end && right.start < left.end
}

function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6
}

function daySetsIntersect(left: DaySet, right: DaySet): boolean {
  if (left === 'daily' || right === 'daily') return true
  if (left === right) return true
  const pair = left === 'workdays' ? right : right === 'workdays' ? left : null
  return pair === 'weekdays'
}

export function daySetCovers(days: DaySet, weekday: number, date: string, holidays: ReadonlySet<string>): boolean {
  if (days === 'daily') return true
  if (isWeekend(weekday)) return days === 'weekends'
  if (days === 'weekends') return false
  return days === 'weekdays' || !holidays.has(date)
}

export function slotCovers(slot: SlotScope, ms: number, holidays: ReadonlySet<string>): boolean {
  const hour = hourOfDay(ms)
  return hour >= slot.start && hour < slot.end && daySetCovers(slot.days, weekdayOf(ms), dayKeyOf(ms), holidays)
}

export function slotsOverlap(left: SlotScope, right: SlotScope): boolean {
  return hourRangesOverlap(left, right) && daySetsIntersect(left.days, right.days)
}
