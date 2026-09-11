/**
 * Pure display helpers shared by the overlay tabs.
 *
 * Day keys use the host's local `YYYY-MM-DD` naming; money on the wire is
 * always RMB. No React, no fetch — safe to import from any panel.
 *
 * @module dsh-tokbook/client/format
 */

import type { UsageRecord, UsageTotals } from '../types.ts'

/** A day key shifted by N days; the host names its day files the same way. */
export function shiftDayKey(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(year!, month! - 1, date! + delta)
  const m = String(shifted.getMonth() + 1).padStart(2, '0')
  const d = String(shifted.getDate()).padStart(2, '0')
  return `${shifted.getFullYear()}-${m}-${d}`
}

/** The browser's local calendar day, matching the host's local-day keys. */
export function localDayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Compact month/day label (8/26) for the axis and the chart's accessible name. */
export function shortDay(day: string): string {
  const [, month, date] = day.split('-')
  return `${Number(month)}/${Number(date)}`
}

/** Session ids are long opaque slugs; the visible line keeps a readable head. */
export function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 12)}…`
}

/** Provider-neutral failure codes gain a Chinese gloss; unknown codes show raw. */
const FAILURE_LABELS: Record<string, string> = {
  RATE_LIMIT: '限流',
  QUOTA: '配额不足',
  TIMEOUT: '超时',
  CONNECTION: '连接中断',
  NETWORK: '网络错误',
  AUTH: '鉴权失败',
  SERVER: '服务端错误',
  PROTOCOL: '协议错误',
  MODEL_NOT_FOUND: '模型不可用',
  CONTEXT: '上下文超限',
}

export function failureCodeLabel(code: string | undefined): string {
  if (code === undefined || code === '') return '失败'
  const label = FAILURE_LABELS[code]
  return label === undefined ? code : `${code} ${label}`
}

/** Total tokens across the four buckets of an aggregates row. */
export function totalsOf(t: UsageTotals): number {
  return t.inputTokens + t.cacheReadTokens + t.cacheWriteTokens + t.outputTokens
}

/** Total tokens of one record ('' usage rows count 0). */
export function usageTotal(r: UsageRecord): number {
  const u = r.usage
  if (u === undefined) return 0
  return u.inputTokens + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0) + u.outputTokens
}

/** Model share of total tokens, clamped to 0–100. */
export function share(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, (value / total) * 100))
}

/**
 * Cache-hit share of the prompt side — uncached input + cache read + cache
 * write, the same denominator the harness's own session stats use. A partial
 * hit never prints as 100%: integer rounding is kept while the result stays
 * below 100, otherwise the value drops to one decimal, truncated, so the
 * display can only understate a hit and never claim a full one.
 */
export function formatHitRate(cacheReadTokens: number, billedInputTokens: number): string | null {
  if (billedInputTokens <= 0) return null
  if (cacheReadTokens >= billedInputTokens) return '100'
  const percent = (cacheReadTokens / billedInputTokens) * 100
  const whole = Math.round(percent)
  return whole < 100 ? String(whole) : (Math.floor(percent * 10) / 10).toFixed(1)
}

/** Compact token count: 517 / 12.2K / 1.2M. */
export function formatTokens(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${Math.round((value / 1_000) * 10) / 10}K`
  return `${Math.round((value / 1_000_000) * 10) / 10}M`
}

/** Money on the wire is always RMB; the one display convention is ¥. */
export function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`
}

/** Locale-aware MM-DD HH:mm for the latest-event line. */
export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * A scan-friendly time for a 最近记录 row: "刚刚" under a minute, "N 分钟前"
 * / "N 小时前" for today, then the clock time (昨天 14:20), the date, and the
 * full date once the row crosses into an earlier year.
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
    // Yesterday keeps the clock time so a row is not fully generic.
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    if (t.getFullYear() === yesterday.getFullYear() && t.getMonth() === yesterday.getMonth() && t.getDate() === yesterday.getDate()) {
      return `昨天 ${hhmm}`
    }
    return `${monthDay} ${hhmm}`
  }
  return `${String(t.getFullYear()).slice(2)}-${monthDay} ${hhmm}`
}
