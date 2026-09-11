/**
 * Quota-plan domain of the token-book: the *official* account usage shown in
 * the 订阅额度 tab.
 *
 * The tab never estimates from the local ledger — a subscription key is shared
 * across every tool/device, so a machine-local ledger cannot know the true
 * account spend. Instead each built-in provider's card is fetched from that
 * provider's own account endpoints (see `src/quota-official.ts` for the
 * fetchers), and this module normalizes the raw provider payloads into the
 * wire shapes the client renders.
 *
 * The two built-in providers differ in what their official endpoints expose:
 *  - Command Code (`/alpha/billing/credits` + friends) reports real dollar
 *    amounts: window used/cap/exceeded/resetAt, monthly credit pool, plan,
 *    and a usage summary.
 *  - OpenCode Go (`/zen/go/v1/usage`) reports only usage-percent + reset for
 *    the three windows (no amounts).
 * The wire types keep amounts optional so a card can be percent-only.
 *
 * Pure functions (no I/O) so normalization is unit-tested directly.
 *
 * @module dsh-tokbook/quota
 */

import type { QuotaCard, QuotaPlanInfo, QuotaWindowView } from './types.ts'

export type { QuotaCard, QuotaView, QuotaWindowView } from './types.ts'

// ---------------------------------------------------------------------------
// Built-in plans (display identity only — no budgets, no prices)
// ---------------------------------------------------------------------------

/** The provider route key of the built-in OpenCode Go plan. */
export const OPENCODE_GO_PROVIDER = 'opencode-go'

/** The provider route key of the built-in Command Code plan. */
export const COMMAND_CODE_PROVIDER = 'commandcode'

/** Built-in plan display titles keyed by provider route. */
export const BUILTIN_PLAN_TITLES: Readonly<Record<string, string>> = {
  [OPENCODE_GO_PROVIDER]: 'OpenCode Go',
  [COMMAND_CODE_PROVIDER]: 'Command Code',
}

/** Known Command Code subscription plan ids → display name (subset of the
 * reference provider's map). Used to render a friendly plan title. */
export const COMMAND_CODE_PLAN_NAMES: Readonly<Record<string, string>> = {
  'individual-go': 'Go',
  'individual-goat': 'GOAT',
  'individual-pro': 'Pro',
  'individual-pro-v1': 'Pro',
  'individual-provider': 'Provider',
  'individual-max': 'Max',
  'individual-ultra': 'Ultra',
  'teams-pro': 'Teams Pro',
}

/** Default env var each provider reads its API key from. */
export const BUILTIN_KEY_ENV: Readonly<Record<string, string>> = {
  [OPENCODE_GO_PROVIDER]: 'OPENCODE_GO_API_KEY',
  [COMMAND_CODE_PROVIDER]: 'COMMANDCODE_API_KEY',
}

/** Usage percent at which a last-known window lights the sidebar 告急 dot.
 *  90 is "you will notice soon", not "already dead" — exceeded is separate. */
export const QUOTA_ALERT_PERCENT = 90

/**
 * Whether one official quota card is worth a persistent 告急 indicator on the
 * footer trigger. Only 'ok' cards count: an unconfigured/error card has no
 * window facts, and inventing an alert from a fetch failure would cry wolf.
 */
export function isQuotaAlert(card: QuotaCard | null | undefined): boolean {
  if (card === null || card === undefined || card.state !== 'ok') return false
  return card.windows.some((window) => window.exceeded || window.usagePercent >= QUOTA_ALERT_PERCENT)
}

/**
 * Which provider routes carry an official quota fetch. A plan is "on" when
 * the route is known and not disabled (`enabled:false` in the config). A key
 * presence check happens at fetch time; an enabled plan without a key yields
 * an `unconfigured` card.
 */
export function isBuiltinQuotaPlan(provider: string): boolean {
  return provider === OPENCODE_GO_PROVIDER || provider === COMMAND_CODE_PROVIDER
}

// ---------------------------------------------------------------------------
// Normalization helpers (raw official payload → wire shape)
// ---------------------------------------------------------------------------

/** Clamp a server percent into 0–100; missing/invalid → 0. */
export function clampPercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

/** Epoch ms from a raw reset value: a number of *seconds until reset*, a
 * number of ms, or an ISO date. null when absent/invalid. */
export function resetEpoch(value: unknown, now: number = Date.now()): number | null {
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  // Heuristic: values in a plausible *seconds-until-reset* range (< 2^32 and
  // far from "now as ms") are treated as a countdown.
  if (value > 0 && value < 4_294_967_296 && Math.abs(value - now) > 4_294_967_296) {
    return now + value * 1000
  }
  return value
}

/** Build one window row from a raw `{used, cap, exceeded, resetAt}` block
 * (Command Code shape). Amounts are real dollars. */
export function windowFromCreditsBlock(
  id: string,
  label: string,
  raw: { used?: unknown; cap?: unknown; exceeded?: unknown; resetAt?: unknown } | undefined,
  now?: number,
): QuotaWindowView {
  const used = typeof raw?.used === 'number' && Number.isFinite(raw.used) ? raw.used : undefined
  const cap = typeof raw?.cap === 'number' && Number.isFinite(raw.cap) ? raw.cap : undefined
  const resetAt = resetEpoch(raw?.resetAt, now)
  const usagePercent = cap !== undefined && cap > 0 && used !== undefined
    ? Math.min(100, Math.max(0, (used / cap) * 100))
    : clampPercent(raw?.exceeded === true ? 100 : undefined)
  return {
    id,
    label,
    usagePercent,
    exceeded: raw?.exceeded === true || usagePercent >= 100,
    resetAt,
    ...(used !== undefined ? { usedUsd: used } : {}),
    ...(cap !== undefined ? { capUsd: cap } : {}),
  }
}

/** Build one window row from the OpenCode Go shape — real endpoint
 * `{status, percent, resetsAt}` (percent + ISO reset string; no amounts).
 * Tolerates the older internal spelling `{status, usagePercent, resetInSec}`
 * so a shape change never blanks the card. A status other than `ok` means the
 * window is throttled/exhausted. */
export function windowFromUsagePercent(
  id: string,
  label: string,
  raw: { status?: unknown; percent?: unknown; resetsAt?: unknown; usagePercent?: unknown; resetInSec?: unknown } | undefined,
  now?: number,
): QuotaWindowView {
  const percent = clampPercent(raw?.percent ?? raw?.usagePercent)
  const throttled = typeof raw?.status === 'string' && raw.status !== '' && raw.status !== 'ok'
  const limited = throttled || raw?.status === 'rate-limited'
  return {
    id,
    label,
    usagePercent: limited ? 100 : percent,
    exceeded: limited || percent >= 100,
    resetAt: resetEpoch(raw?.resetsAt ?? raw?.resetInSec, now),
  }
}

/** Normalize a Command Code `billing/subscriptions` plan node. */
export function planInfoFromSubscriptions(raw: { planId?: unknown; status?: unknown; currentPeriodEnd?: unknown } | undefined): QuotaPlanInfo | undefined {
  if (raw === undefined) return undefined
  const planId = typeof raw.planId === 'string' && raw.planId !== '' ? raw.planId : undefined
  const status = typeof raw.status === 'string' && raw.status !== '' ? raw.status : undefined
  const periodEnd = resetEpoch(raw.currentPeriodEnd)
  if (planId === undefined && status === undefined && periodEnd === null) return undefined
  const info: QuotaPlanInfo = {}
  if (planId !== undefined) info.planId = planId
  if (status !== undefined) info.status = status
  if (periodEnd !== null) info.periodEnd = periodEnd
  return info
}

/** A raw quota card is usable (has windows/data) only when the official fetch
 * returned something worth showing. */
export function hasQuotaContent(card: QuotaCard): boolean {
  return card.windows.length > 0
    || card.planInfo !== undefined
    || card.usage !== undefined
    || card.credits !== undefined
    || card.account !== undefined
}

/** Build an `unconfigured` card (no API key found) for a built-in plan. */
export function unconfiguredCard(provider: string, hint?: string): QuotaCard {
  return {
    plan: provider,
    title: BUILTIN_PLAN_TITLES[provider] ?? provider,
    state: 'unconfigured',
    message: hint ?? '未找到该订阅的 API key（可配置 apiKey / apiKeyEnv / authFile，或登录官方 CLI）。',
    windows: [],
  }
}

/** Build an `error` card (official fetch failed) for a built-in plan. */
export function errorCard(provider: string, reason: string): QuotaCard {
  return {
    plan: provider,
    title: BUILTIN_PLAN_TITLES[provider] ?? provider,
    state: 'error',
    message: reason,
    windows: [],
  }
}
