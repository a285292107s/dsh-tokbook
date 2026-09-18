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

import type { DaySet } from './types.ts'

/** 无生效时刻的段的 `from`：最早一段，即自始生效。存为 0，使朴素的 `from <= timeMs` 比较直接可用。 */
export const EARLIEST = 0

/** 价文件唯一的保留顶层键：route → `"metered" | "subscription"`。 */
export const PRICING_BILLING_KEY = '$billing'

/** 段备注的长度上限（读路径截断，写路径拒绝超长；两半区同一把尺子）。 */
export const MAX_NOTE_LENGTH = 120

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u
const HOUR_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:00$/u

/** 时段可携带的全部 day set，展示顺序（也是文件顺序）。 */
export const DAY_SETS: readonly DaySet[] = ['daily', 'weekdays', 'weekends']

export const DAY_SET_LABELS: Record<DaySet, string> = {
  daily: '每天',
  weekdays: '工作日',
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

/** 两个 day set 是否有共同星期。 */
function daySetsIntersect(left: DaySet, right: DaySet): boolean {
  return left === 'daily' || right === 'daily' || left === right
}

/** day set 是否覆盖某个本地星期（0 = 周日）。 */
export function daySetCovers(days: DaySet, weekday: number): boolean {
  if (days === 'daily') return true
  const weekend = weekday === 0 || weekday === 6
  return days === 'weekends' ? weekend : !weekend
}

/** 一个时段是否覆盖某时刻：时刻的本地星期在时段的 day set 内，且本地小时
 *  落在 `[start, end)` 内。 */
export function slotCovers(slot: SlotScope, ms: number): boolean {
  const hour = hourOfDay(ms)
  return hour >= slot.start && hour < slot.end && daySetCovers(slot.days, weekdayOf(ms))
}

/** 两个时段是否可能同时生效。写路径拒绝这样的对，因此「某时刻生效的时段」
 *  永不歧义；星期集合不相交的一对可以共享同一小时区间（工作日早高峰挨着
 *  周末早高峰）。 */
export function slotsOverlap(left: SlotScope, right: SlotScope): boolean {
  return hourRangesOverlap(left, right) && daySetsIntersect(left.days, right.days)
}
