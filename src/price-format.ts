/**
 * 价文件的纯规则，host 半区与 browser 半区共享：文件本身的词表（保留键、长度上限）
 * 与价格的取值规则。
 *
 * 价格分两层：每个 (route, model) 一份**当前价**（基准价），叠上按记录**本地时间**
 * 生效的日内时段（小时区间 + 覆盖的星期集合）。没有生效时刻那一轴——账本里所有记录
 * 都用同一份价折算（口径见 docs/CONTRACTS.md §2）。词表也放这里，因为
 * client 不能 import `pricing.ts`（它拉了 `node:fs`），字面量两处各写一遍会静默漂移。
 */

import type { DaySet, HolidayRange } from './types.ts'

/** 价文件唯一的保留顶层键：route → `"metered" | "subscription"`。 */
export const PRICING_BILLING_KEY = '$billing'

/** 价文件另一个保留顶层键：`YYYY` → 放假日区间数组（法定节假日年历）。 */
export const PRICING_CALENDAR_KEY = '$calendar'

/** 价文件的第三个保留顶层键：route → 报价币种（`"USD"`）。省略 = 人民币。 */
export const PRICING_CURRENCY_KEY = '$currency'

/** 价文件的第四个保留顶层键：`{ cnyPerUsd }`——1 美元值多少元。**唯一的换算率**：
 *  把 `$currency` 标成美元的通道折成人民币（计价 + 悬停读数），以及切换报价币种时换算已有的数。
 *  手填（不联网）、缺席 = 未设汇率（美元通道算不出人民币，绝不按 1 算）。 */
export const PRICING_FX_KEY = '$fx'

/** 通道路由名与模型串的长度上限（写路径拒绝超长，读路径不设限）。放在共享词表里，
 *  草稿才能在自己这一侧就报出「写不进去」的原因，而不是把整份文件交给 host 拒掉。 */
export const MAX_ROUTE_LENGTH = 128
export const MAX_MODEL_LENGTH = 256

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u

/** 时段可携带的全部 day set，展示顺序（也是文件顺序）。`weekdays` 排在
 *  `workdays` 前面：从宽到窄，依次收窄。 */
export const DAY_SETS: readonly DaySet[] = ['daily', 'weekdays', 'workdays', 'weekends']

/** 下拉静止时显示的短名——判定本身要一眼读全，完整口径在 `DAY_SET_HINTS`（悬停）。 */
export const DAY_SET_LABELS: Record<DaySet, string> = {
  daily: '每天',
  weekdays: '周一至周五',
  workdays: '法定工作日',
  weekends: '周末',
}

/** 每一档日期的完整口径，悬停在下拉上时给出。 */
export const DAY_SET_HINTS: Record<DaySet, string> = {
  daily: '每天 00:00–24:00，含周末与节假日',
  weekdays: '按星期一到星期五计，法定节假日也算',
  workdays: '按工作日计；年历收录的法定节假日不生效',
  weekends: '仅星期六与星期日',
}

/** 一个时段覆盖的小时：`[start, end)`，故全天时段为 0 → 24。 */
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

/** 时刻的本地小时（0–23）。 */
export function hourOfDay(ms: number): number {
  return new Date(ms).getHours()
}

/** 时刻的本地星期（0 = 周日 … 6 = 周六）。 */
export function weekdayOf(ms: number): number {
  return new Date(ms).getDay()
}

/** `YYYY-MM-DD` 的本地零点 epoch ms；不是真实日历日（2026-02-31）时为 null。 */
export function dayStartMs(date: string): number | null {
  if (!DATE_RE.test(date)) return null
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const at = new Date(year, month - 1, day)
  if (at.getFullYear() !== year || at.getMonth() !== month - 1 || at.getDate() !== day) return null
  return at.getTime()
}

/** 小时 → `HH:00` 的展示写法（峰谷时段的下拉）。 */
export function clockLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/** `YYYY-MM-DD` → 自 epoch 起的天数；不是真实日历日时为 null。轴取 **UTC 日**：它必须与
 *  {@link dayKeyOfIndex} 严格互逆——本地零点除以一天只在 UTC 以东恰好落回正确的日号，
 *  在 UTC 以西会让整份年历错一天。日期字符串在这里就是日历日，故加减是纯整数运算，
 *  不受夏令时影响。 */
export function dayIndex(date: string): number | null {
  if (dayStartMs(date) === null) return null
  // Date.UTC 把 0–99 年当 19xx，但那些年上一步已判为非法（本地 Date 也加 1900）。
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

/**
 * 年历 → 覆盖判定用的日期集合。畸形区间由调用方在读路径上丢弃；这里遇到
 * 不合法的区间**跳过**，绝不让它把整个年历变成空集。
 */
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

/** `workdays` ⊂ `weekdays`，两者与 `daily` 都相交；`workdays` 只与 `weekends` 不相交。 */
function daySetsIntersect(left: DaySet, right: DaySet): boolean {
  if (left === 'daily' || right === 'daily') return true
  if (left === right) return true
  const pair = left === 'workdays' ? right : right === 'workdays' ? left : null
  return pair === 'weekdays'
}

/** day set 是否覆盖某个本地星期 + 日期。`holidays` 只影响 `workdays`：
 *  它要求那天不在年历里。 */
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

/**
 * 两个时段是否可能同时生效。写路径拒绝这样的对，因此「某时刻生效的时段」
 *  永不歧义；星期集合不相交的一对可以共享同一小时区间。年历不参与判定
 *  （`workdays` ⊂ `weekdays` 恒成立），所以这里的结论对任何年历都成立。
 */
export function slotsOverlap(left: SlotScope, right: SlotScope): boolean {
  return hourRangesOverlap(left, right) && daySetsIntersect(left.days, right.days)
}
