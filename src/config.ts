/**
 * Plugin profile config: strict validation of the declared shape, and lenient
 * coercion of plan overrides (a config typo must not take the host down).
 *
 * @module dsh-tokbook/config
 */

import type { PlanConfig, TokBookConfig } from './types.ts'

/** Reject stale or misspelled config keys before defaults can hide them. */
export function validateConfig(config: TokBookConfig): void {
  const unknown = Object.keys(config).find(key =>
    key !== 'path' && key !== 'recordCompaction' && key !== 'plans')
  if (unknown !== undefined) {
    throw new Error(`TokBookConfig: unknown key "${unknown}"`)
  }
  if (config.path !== undefined && typeof config.path !== 'string') {
    throw new Error('TokBookConfig: "path" must be a string')
  }
  if (config.recordCompaction !== undefined && typeof config.recordCompaction !== 'boolean') {
    throw new Error('TokBookConfig: "recordCompaction" must be a boolean')
  }
  if (config.plans !== undefined && (typeof config.plans !== 'object' || config.plans === null || Array.isArray(config.plans))) {
    throw new Error('TokBookConfig: "plans" must be a record keyed by provider route')
  }
}

/** Coerce a user-supplied plan override into a valid PlanConfig (drop unknown
 * keys and malformed fields instead of throwing — a config typo must not take
 * down the plugin). */
export function coercePlanConfig(value: unknown): PlanConfig | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const out: PlanConfig = {}
  if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled
  if (typeof raw.apiKey === 'string' && raw.apiKey !== '') out.apiKey = raw.apiKey
  if (typeof raw.apiKeyEnv === 'string' && raw.apiKeyEnv !== '') out.apiKeyEnv = raw.apiKeyEnv
  return out
}

/** Coerce the whole `plans` config record. Malformed entries are dropped. */
export function coercePlansConfig(value: unknown): Record<string, PlanConfig> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const out: Record<string, PlanConfig> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (key === '') continue
    const coerced = coercePlanConfig(entry)
    if (coerced !== undefined) out[key] = coerced
  }
  return out
}
