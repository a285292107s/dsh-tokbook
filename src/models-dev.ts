export const MODELS_DEV_URL = 'https://models.dev/api.json'

export const MODELS_DEV_TIMEOUT_MS = 15_000

export interface ModelsDevCost {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

export interface ModelsDevEntry {
  provider: string
  modelId: string
  name: string
  cost: ModelsDevCost
}

export type ModelsDevCatalog = Map<string, ModelsDevEntry>

export const FIRST_PARTY_PROVIDERS: ReadonlySet<string> = new Set([
  'openai', 'anthropic', 'deepseek', 'google', 'xai', 'alibaba', 'moonshotai',
  'moonshotai-cn', 'zai', 'minimax', 'minimax-cn', 'xiaomi', 'tencent',
  'cohere', 'mistral', 'bytedance', 'baidu',
])

export function normalizeModelId(modelId: string): string {
  const afterSlash = modelId.slice(modelId.lastIndexOf('/') + 1)
  const beforeColon = afterSlash.split(':')[0] ?? ''
  let normalized = beforeColon.trim().replace(/@/g, '-').toLowerCase()
  if (normalized.endsWith('[1m]')) normalized = normalized.slice(0, -'[1m]'.length).trim()
  return normalized
}

function isRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function coerceCost(raw: Record<string, unknown>): ModelsDevCost | null {
  if (!isRate(raw.input) || !isRate(raw.output)) return null
  return {
    input: raw.input,
    output: raw.output,
    ...(isRate(raw.cache_read) ? { cacheRead: raw.cache_read } : {}),
    ...(isRate(raw.cache_write) ? { cacheWrite: raw.cache_write } : {}),
  }
}

function isTextPricingModel(modelId: string, model: Record<string, unknown>): boolean {
  if (typeof model.status === 'string' && model.status.toLowerCase() === 'deprecated') return false
  const output = Array.isArray(model.modalities)
    ? undefined
    : (model.modalities as Record<string, unknown> | undefined)?.output
  const out = Array.isArray(output) ? output.filter((m): m is string => typeof m === 'string').map(m => m.toLowerCase()) : undefined
  if (out !== undefined && out.length > 0 && (!out.includes('text') || out.some(m => m !== 'text'))) return false
  const name = typeof model.name === 'string' ? model.name : ''
  return !/\b(embedding|embed|tts|whisper|realtime|moderation|audio|image|video|transcribe)\b/i.test(`${modelId} ${name}`)
}

export function parseCatalog(value: unknown): ModelsDevCatalog {
  const catalog: ModelsDevCatalog = new Map()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return catalog
  const pending = new Map<string, { entry: ModelsDevEntry; rates: string }>()
  for (const [providerId, providerRaw] of Object.entries(value as Record<string, unknown>)) {
    if (!FIRST_PARTY_PROVIDERS.has(providerId)) continue
    if (typeof providerRaw !== 'object' || providerRaw === null) continue
    const models = (providerRaw as Record<string, unknown>).models
    if (typeof models !== 'object' || models === null || Array.isArray(models)) continue
    for (const [modelId, modelRaw] of Object.entries(models as Record<string, unknown>)) {
      if (typeof modelRaw !== 'object' || modelRaw === null) continue
      const model = modelRaw as Record<string, unknown>
      if (!isTextPricingModel(modelId, model)) continue
      const cost = coerceCost(model.cost as Record<string, unknown> | undefined ?? {})
      if (cost === null) continue
      const key = normalizeModelId(modelId)
      if (key === '') continue
      const entry: ModelsDevEntry = {
        provider: providerId,
        modelId,
        name: typeof model.name === 'string' && model.name !== '' ? model.name : modelId,
        cost,
      }
      const rates = `${cost.input}/${cost.output}/${cost.cacheRead ?? ''}/${cost.cacheWrite ?? ''}`
      const previous = pending.get(key)
      if (previous === undefined) pending.set(key, { entry, rates })
      else if (previous.rates !== rates) pending.set(key, { entry: previous.entry, rates: '' })
    }
  }
  for (const [key, { entry, rates }] of pending) {
    if (rates !== '') catalog.set(key, entry)
  }
  return catalog
}

export async function fetchCatalog(): Promise<ModelsDevCatalog> {
  const response = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(MODELS_DEV_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`models.dev HTTP ${String(response.status)}`)
  return parseCatalog(await response.json())
}

export const LOOKUP_LIMIT = 8

export interface ModelsDevMatch {
  entry: ModelsDevEntry
  key: string
  score: number
}

export function searchCatalog(catalog: ModelsDevCatalog, keyword: string, limit = LOOKUP_LIMIT): ModelsDevMatch[] {
  const kw = normalizeModelId(keyword)
  if (kw === '') return []
  const results: ModelsDevMatch[] = []
  for (const [key, entry] of catalog) {
    const score = scoreEntry(key, entry, kw)
    if (score > 0) results.push({ entry, key, score })
  }
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}

const TOKEN_SPLIT = /[-_.]/u
const DIGIT_BOUNDARY = /(?<=[A-Za-z])(?=[0-9])|(?<=[0-9])(?=[A-Za-z])/u

function splitTokens(s: string): string[] {
  return s.split(TOKEN_SPLIT).flatMap((t) => t.split(DIGIT_BOUNDARY))
}

function scoreEntry(key: string, entry: ModelsDevEntry, kw: string): number {
  let score = 0
  if (key === kw) score += 1000
  else if (key.startsWith(kw)) score += 700
  else if (key.includes(kw)) score += 500
  const keyTokens = splitTokens(key)
  const kwTokens = splitTokens(kw).filter((t) => t.length >= 2)
  if (kwTokens.length >= 2) {
    const matchedTokens = kwTokens.filter((token) => keyTokens.some((t) => t.includes(token))).length
    if (matchedTokens === kwTokens.length) score += 300 + 100 * matchedTokens
  }
  if (entry.name.toLowerCase().includes(kw)) score += 200
  return score
}
