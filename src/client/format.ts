/**
 * 浮窗各 tab 共享的纯展示辅助函数。
 *
 * 日期键沿用宿主本地 `YYYY-MM-DD` 命名；wire 上的金额一律为人民币。无 React、无 fetch——任何面板均可安全 import。
 */

/** 日期键平移 N 天；宿主的日文件也按同一方式命名。 */
export function shiftDayKey(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(year!, month! - 1, date! + delta)
  const m = String(shifted.getMonth() + 1).padStart(2, '0')
  const d = String(shifted.getDate()).padStart(2, '0')
  return `${shifted.getFullYear()}-${m}-${d}`
}

/** 浏览器本地日历日，与宿主的本地日键一致。 */
export function localDayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** 紧凑的月/日标签（8/26），供轴和图表的无障碍名称使用。 */
export function shortDay(day: string): string {
  const [, month, date] = day.split('-')
  return `${Number(month)}/${Number(date)}`
}

export function share(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, (value / total) * 100))
}

/**
 * 占比的读法（百分比字符串）。两条与 `formatRatio` 同源的诚实规则：**不足 1% 写「<1%」**
 * 而不是取整成 0（那会把「有一点」说成「没有」），**99.x% 不凑整成 100%**（部分占满不是占满）。
 */
export function formatShare(value: number, total: number): string {
  const percent = share(value, total)
  if (percent <= 0) return '0%'
  if (percent < 1) return '<1%'
  const rounded = Math.round(percent)
  if (rounded >= 100 && percent < 100) return '>99%'
  return `${rounded}%`
}

/**
 * 比率的读法：恒定一位小数、**截断**（`Math.floor`）。截断而不是四舍五入：展示只会低估，
 * 99.95% 不会被印成 100.0%——「满」与「几乎满」是两回事。分母为 0 时无比率可说（null）。
 */
export function formatRatio(part: number, whole: number): string | null {
  if (whole <= 0) return null
  const percent = Math.min(100, (part / whole) * 100)
  return (Math.floor(percent * 10) / 10).toFixed(1)
}

/** 紧凑词元计数：517 / 12.2K / 1.2M。 */
export function formatTokens(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${Math.round((value / 1_000) * 10) / 10}K`
  return `${Math.round((value / 1_000_000) * 10) / 10}M`
}

export function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`
}

/** 本地化的 MM-DD HH:mm，用于最新事件行。 */
export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * 最近记录行的可扫读时间：一分钟内显示「刚刚」，今天内显示「N 分钟前」/「N 小时前」，再退到时钟时间（昨天 14:20）、日期，跨年后显示完整日期。
 */
export function formatRelative(epochMs: number, now: Date = new Date()): string {
  const t = new Date(epochMs)
  const elapsed = now.getTime() - epochMs
  if (elapsed >= 0 && elapsed < 60_000) return '刚刚'
  if (elapsed >= 0 && elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} 分钟前`
  const sameDay = t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate()
  if (elapsed >= 0 && sameDay) return `${Math.floor(elapsed / 3_600_000)} 小时前`
  const hhmm = t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const monthDay = `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  if (t.getFullYear() === now.getFullYear()) {
    // 昨天保留时钟时间，避免整行过于笼统。
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    if (t.getFullYear() === yesterday.getFullYear() && t.getMonth() === yesterday.getMonth() && t.getDate() === yesterday.getDate()) {
      return `昨天 ${hhmm}`
    }
    return `${monthDay} ${hhmm}`
  }
  return `${String(t.getFullYear()).slice(2)}-${monthDay} ${hhmm}`
}
