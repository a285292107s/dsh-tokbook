/**
 * profile 配置：声明形状严格校验；plan 覆盖宽松纠错（笔误不得拖垮宿主）。
 *
 * @module dsh-tokbook/config
 */

import type { PlanConfig, TokBookConfig } from './types.ts'

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

/** 丢掉未知键与畸形字段，而不是抛错。 */
export function coercePlanConfig(value: unknown): PlanConfig | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const out: PlanConfig = {}
  if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled
  if (typeof raw.apiKey === 'string' && raw.apiKey !== '') out.apiKey = raw.apiKey
  if (typeof raw.apiKeyEnv === 'string' && raw.apiKeyEnv !== '') out.apiKeyEnv = raw.apiKeyEnv
  return out
}

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
