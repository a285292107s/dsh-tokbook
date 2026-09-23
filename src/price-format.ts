/**
 * 价文件的纯规则，host 半区与 browser 半区共享：文件本身的词表（保留键、长度上限）
 * 与时间轴的取值规则。
 *
 * 两级独立轴决定一个价格：生效时刻（本地日，或本地日 + 整点小时）选定生效段；
 * 日内时段（小时区间 + 覆盖的星期集合）选定段内的例外价。两个半区用同一套规则
 * 校验手写 `pricing.json`，因此 browser 草稿接受的表永远不会被 host writer 拒绝。
 * 独立且无依赖的原因：词表也放这里，因为 client 不能 import `pricing.ts`（它拉了
 * `node:fs`），而这几条字面量一旦两处各写一遍就会静默漂移。
 */

import type { DaySet, HolidayRange } from './types.ts'

/** 旧价文件里「没有生效时刻」那一段的 `from`（自始生效）在此取值，使朴素的
 *  `from <= timeMs` 比较直接可用。**新写入不再产生这个形态**：一段价必须有生效时刻，
 *  没有价段覆盖的日期一律按 ¥0 计。它现在只服务两件事——读旧文件时的**迁移**
 *  （视图层把它落成真实日期）与迁移前历史金额的连续性。 */
export const EARLIEST = 0

/** 价文件唯一的保留顶层键：route → `"metered" | "subscription"`。 */
export const PRICING_BILLING_KEY = '$billing'

/** 价文件另一个保留顶层键：`YYYY` → 放假日区间数组（法定节假日年历）。 */
export const PRICING_CALENDAR_KEY = '$calendar'

/** 价文件的第三个保留顶层键：`{ cnyPerUsd }`——1 美元值多少元。**它只服务价格表的
 *  读写面**：文件里的价永远是人民币/百万词元，host 的计价路径（`pricing.ts` 的
 *  `priceAt` / `costOf`、`stats.ts` 的折叠）从不读它，所以改汇率不动任何历史金额。
 *  手填（不联网）、缺席 = 未设汇率（美元面不可用）。 */
export const PRICING_FX_KEY = '$fx'

/** 通道路由名与模型串的长度上限（写路径拒绝超长，读路径不设限）。放在共享词表里，
 *  草稿才能在自己这一侧就报出「写不进去」的原因，而不是把整份文件交给 host 拒掉。 */
export const MAX_ROUTE_LENGTH = 128
export const MAX_MODEL_LENGTH = 256

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u
const HOUR_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:00$/u

/** 时段可携带的全部 day set，展示顺序（也是文件顺序）。`weekdays` 排在
 *  `workdays` 前面：从宽到窄，依次收窄。 */
export const DAY_SETS: readonly DaySet[] = ['daily', 'weekdays', 'workdays', 'weekends']

export const DAY_SET_LABELS: Record<DaySet, string> = {
  daily: '每天',
  weekdays: '周一至周五（含节假日）',
  workdays: '工作日（不含节假日）',
  weekends: '周末',
}

/** 一个时段覆盖的小时：`[start, end)`，故全天时段为 0 → 24。 */
export interface HourRange {
  start: number
  end: number
}

/** day set + 小时区间：时段覆盖的完整范围。 */
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

/** 包含 `ms` 的小时的本地起点——价文件自身的时间单位，即 `from` 所命名的时刻。
 *  价格轴按此精度读取，账本时刻必须先 floor 到它才能与之比较。 */
export function hourStartMs(ms: number): number {
  const at = new Date(ms)
  at.setMinutes(0, 0, 0)
  return at.getTime()
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

/**
 * 文件 / wire 时刻的 epoch ms：`YYYY-MM-DD`（本地零点）或
 * `YYYY-MM-DDTHH:00`（该本地整点）。不是真实日期、不是整点，或命名了本时区
 * 不存在的本地小时（DST 春季跳变）时为 null——无法解析到唯一时刻的表会被拒绝，
 * 而不是静默取整。
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

/** 时刻的文件文本：本地零点写短日期，否则 `YYYY-MM-DDTHH:00`。午夜保留短形式，
 *  使常见情形在小时级时刻出现前后读（及 diff）完全一致。 */
export function instantKey(ms: number): string {
  const day = dayKeyOf(ms)
  const hour = hourOfDay(ms)
  return hour === 0 ? day : `${day}T${String(hour).padStart(2, '0')}:00`
}

/** 小时数作时钟标签：9 → `09:00`，24 → `24:00`。 */
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

/** 自 epoch 起的天数 → `YYYY-MM-DD`（UTC 日，与 {@link dayIndex} 互逆）。 */
export function dayKeyOfIndex(index: number): string {
  const at = new Date(index * 86_400_000)
  const month = String(at.getUTCMonth() + 1).padStart(2, '0')
  const day = String(at.getUTCDate()).padStart(2, '0')
  return `${String(at.getUTCFullYear())}-${month}-${day}`
}

/** 一段放假日是否合法：两端都是真实日期，且起不晚于止。 */
export function isValidHolidayRange(range: HolidayRange): boolean {
  const start = dayIndex(range.start)
  const end = dayIndex(range.end)
  return start !== null && end !== null && start <= end
}

/**
 * 一段放假日包含哪些天（`YYYY-MM-DD` 日历日）。所有年历都是「一段连续假期」，
 * 但覆盖判定要按天问，所以这里把区间展开成集合。
 */
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

/** `YYYY-MM-DD` 的年份；不是那个形状时为 null。 */
export function yearOfDate(date: string): string | null {
  return DATE_RE.test(date) ? date.slice(0, 4) : null
}

/** 年份 `YYYY` 是否合法（四位数字）。 */
export function isYearKey(year: string): boolean {
  return /^\d{4}$/u.test(year)
}

/** 时段小时区间在各界面上的打印形式：`09:00–12:00`。 */
export function rangeLabel(range: HourRange): string {
  return `${clockLabel(range.start)}–${clockLabel(range.end)}`
}

/** 小时区间是否合法：整点且 `0 ≤ start < end ≤ 24`（end 不含，24 收日）。 */
export function isHourRange(range: HourRange): boolean {
  return Number.isInteger(range.start) && Number.isInteger(range.end)
    && range.start >= 0 && range.start < range.end && range.end <= 24
}

/** 两个小时区间是否共享某一小时。 */
export function hourRangesOverlap(left: HourRange, right: HourRange): boolean {
  return left.start < right.end && right.start < left.end
}

/** 周末日（本地星期 0 或 6）。 */
function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6
}

/** 两个 day set 是否有共同星期。`workdays` ⊂ `weekdays`，两者与 `daily` 都相交。 */
function daySetsIntersect(left: DaySet, right: DaySet): boolean {
  if (left === 'daily' || right === 'daily') return true
  if (left === right) return true
  const pair = left === 'workdays' ? right : right === 'workdays' ? left : null
  return pair === 'weekdays'
}

/**
 * day set 是否覆盖某个本地星期 + 日期。`holidays` 只影响 `workdays` / `weekdays`
 * 两档的差别：`workdays` 要求那天不在年历里。年历里没有那一年时按空集读
 * （`workdays` 等于 `weekdays`），这是**安全方向**——宁可多按高峰算，不少算。
 */
export function daySetCovers(days: DaySet, weekday: number, date: string, holidays: ReadonlySet<string>): boolean {
  if (days === 'daily') return true
  if (isWeekend(weekday)) return days === 'weekends'
  if (days === 'weekends') return false
  return days === 'weekdays' || !holidays.has(date)
}

/** 一个时段是否覆盖某时刻：时刻的本地星期在时段的 day set 内，且本地小时
 *  落在 `[start, end)` 内。 */
export function slotCovers(slot: SlotScope, ms: number, holidays: ReadonlySet<string>): boolean {
  const hour = hourOfDay(ms)
  return hour >= slot.start && hour < slot.end && daySetCovers(slot.days, weekdayOf(ms), dayKeyOf(ms), holidays)
}

/**
 * 两个时段是否可能同时生效。写路径拒绝这样的对，因此「某时刻生效的时段」
 *  永不歧义；星期集合不相交的一对可以共享同一小时区间（工作日早高峰挨着
 *  周末早高峰）。
 *
 *  `workdays` 是周一至周五里去掉法定节假日的那些天，所以它与 `weekdays` 仍共享
 *  每一个非法定节假日——在同一小时区间上依然重叠；只有与 `weekends` 才不相交。
 *  年历不参与判定：换一年只会让两者更接近（`workdays` ⊂ `weekdays` 恒成立），
 *  所以这里的结论对任何年历都成立。
 */
export function slotsOverlap(left: SlotScope, right: SlotScope): boolean {
  return hourRangesOverlap(left, right) && daySetsIntersect(left.days, right.days)
}
