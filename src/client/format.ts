export function shiftDayKey(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(year!, month! - 1, date! + delta)
  const m = String(shifted.getMonth() + 1).padStart(2, '0')
  const d = String(shifted.getDate()).padStart(2, '0')
  return `${shifted.getFullYear()}-${m}-${d}`
}

export function localDayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function shortDay(day: string): string {
  const [, month, date] = day.split('-')
  return `${Number(month)}/${Number(date)}`
}

export function share(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, (value / total) * 100))
}

export function formatShare(value: number, total: number): string {
  const percent = share(value, total)
  if (percent <= 0) return '0%'
  if (percent < 1) return '<1%'
  const rounded = Math.round(percent)
  if (rounded >= 100 && percent < 100) return '>99%'
  return `${rounded}%`
}

export function formatRatio(part: number, whole: number): string | null {
  if (whole <= 0) return null
  const percent = Math.min(100, (part / whole) * 100)
  return (Math.floor(percent * 10) / 10).toFixed(1)
}

export function formatTokens(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${Math.round((value / 1_000) * 10) / 10}K`
  return `${Math.round((value / 1_000_000) * 10) / 10}M`
}

export function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`
}

export function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${String(Math.round(seconds * 10) / 10)}秒`
  if (seconds < 3600) {
    const whole = Math.round(seconds)
    return `${String(Math.floor(whole / 60))}分${String(whole % 60)}秒`
  }
  const whole = Math.round(seconds / 60)
  const minutes = whole % 60
  return `${String(Math.floor(whole / 60))}时${String(minutes).padStart(2, '0')}分`
}

export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

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
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    if (t.getFullYear() === yesterday.getFullYear() && t.getMonth() === yesterday.getMonth() && t.getDate() === yesterday.getDate()) {
      return `昨天 ${hhmm}`
    }
    return `${monthDay} ${hhmm}`
  }
  return `${String(t.getFullYear()).slice(2)}-${monthDay} ${hhmm}`
}
