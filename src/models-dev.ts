/**
 * models.dev 公共目录（https://models.dev/api.json）的拉取、解析与归一化。
 *
 * models.dev 是**美元单一币种**的目录：每百万 token 的 `cost` 四档，无币种字段。
 * 因此只有价文件里声明 `$currency: USD` 的通道可以直接采用它的价——人民币
 * 通道的挂牌价不是美元价的函数（厂商各自取整定价），换算即估算，不猜。
 *
 * 目录里同一模型同时出现在原厂与几百个转售/聚合通道上，挂牌价系统性分裂
 * （实测 `deepseek-v4-flash` 五种价）。**哪家是原厂**在数据里没有标记，唯一的
 * 稳定判据是显式的原厂 slug 清单（{@link FIRST_PARTY_PROVIDERS}）；清单外的
 * 条目再便宜也不采——宁可价格未知，不把转售价冒充通道成本。
 */

/** models.dev 的整包目录地址（一次请求带全部供应商与模型）。 */
export const MODELS_DEV_URL = 'https://models.dev/api.json'

/** 拉取超时：5 MB 量级的整包在慢网下仍应秒级放弃，价表 tab 不等它。 */
export const MODELS_DEV_TIMEOUT_MS = 15_000

/** models.dev 的一个模型价（美元 / 百万 token）。缺哪档就不采哪档。 */
export interface ModelsDevCost {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

/** 归一化后的一份可采价：`{原厂 slug}/{模型 id}` 只是报告用的人读身份。 */
export interface ModelsDevEntry {
  provider: string
  modelId: string
  name: string
  cost: ModelsDevCost
}

export type ModelsDevCatalog = Map<string, ModelsDevEntry>

/**
 * 原厂供应商 slug。models.dev 没有第一方标记；这份清单是**唯一**的采信边界，
 * 增删 slug 等于改变哪些价可信。新模型厂商出现时在这里补一行。
 */
export const FIRST_PARTY_PROVIDERS: ReadonlySet<string> = new Set([
  'openai', 'anthropic', 'deepseek', 'google', 'xai', 'alibaba', 'moonshotai',
  'moonshotai-cn', 'zai', 'minimax', 'minimax-cn', 'xiaomi', 'tencent',
  'cohere', 'mistral', 'bytedance', 'baidu',
])

/**
 * 模型串 → 匹配键：剥 `vendor/` 前缀、截 `:` 变体、`@`→`-`、去 `[1m]` 长上下文
 * 标记、转小写。models.dev 与账本各写各的（`deepseek/deepseek-v4-flash` vs
 * `deepseek-v4-flash`），这套归一化让两边落到同一个键上；与目录侧共用。
 */
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

/** 文本模型才进目录：输出不含 text / 含多模态输出、名字带 embedding|tts 等标记词、
 *  已 deprecated 的一律不采——这些模型的「每百万 token 价」要么不存在要么已经停用。 */
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

/**
 * 解析整包目录 → 归一化 id 的价表。同一 id 在多个原厂条目上时要求**全体一致**，
 * 否则不采（分裂价说明至少一家不是同一成本口径，无法替它选边）；一致时几条
 * 等价条目保留哪条无关紧要。返回的表只含采信的条目。
 */
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
      // 档位一致 = 等价条目（不同原厂 slug 挂同一个价，如 `kimi-k3` 在 moonshotai
      // 与 moonshotai-cn 上）；不一致 = 分裂价，整键弃采。
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

/**
 * 拉取并解析目录。网络失败抛给调用方（同步过程会把它记进状态文件并保持现有
 * 价表原样）；解析层面宽容——畸形条目跳过，目录永远是对方在动的活物。
 */
export async function fetchCatalog(): Promise<ModelsDevCatalog> {
  const response = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(MODELS_DEV_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`models.dev HTTP ${String(response.status)}`)
  return parseCatalog(await response.json())
}

/** 「查价」面板每屏最多展示的候选数：再多就该翻页了，而这一屏只面对一个模型。 */
export const LOOKUP_LIMIT = 8

/**
 * 按关键词在**采信目录**里模糊搜索，返回按相关性降序的候选。
 *
 * 搜索是**用户自己判断**的那条路（与批量补价的自动精确命中分开）：候选池仍是
 * `parseCatalog` 的原厂采信集，所以搜出来的每一条都是可信价，不存在「转售价
 * 冒充通道成本」的问题——用户要做的只是挑哪一家。排序只看名字，不看价格：
 * 便宜的转售价在池子里根本不存在，而同一 id 上的分裂价整键弃采，也不会有
 * 两个价让你为难。
 *
 * 关键词同样走 `normalizeModelId`：用户敲 `deepseek/deepseek-v4-flash` 或
 * `deepseek-v4-flash[1m]` 都能落到同一个候选集上。
 */
export interface ModelsDevMatch {
  entry: ModelsDevEntry
  /** 归一化后的命中键，供面板标出「就是当前这条模型」。 */
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

/** 拆词：`deepseek-v4-flash` → `['deepseek', 'v4', 'flash']`，`@` 已在归一化里转成 `-`。
 *  再按字母/数字边界拆第二道（`qwen3` → `['qwen', '3']`），使 `qwen3-8b` 与
 *  `qwen-3-8b` 这类写法差异可比。单字母（`v` / `x` / `4`）不参与匹配，避免污染。 */
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
  // 词级命中：`deepseek-v4` 这种关键词，靠 `includes` 只能命中 `deepseek-v4-flash`
  // 这类整串包含的；而 `v4` 这种短词靠它命中一切含 `v4` 的噪声。逐词判「关键词的
  // 每个有效词是不是某条目词的子串」，且**要求关键词的有效词全部命中**——单个共享词
  // （如 `gpt-x` 里的 `gpt` 命中 `gpt-5.6-luna`、`deepseek-v4-flash` 里的 `flash`
  // 命中 `gemini-3.8-flash`）不足以构成一次命中，否则搜 `gpt-x` 会返回一堆 gpt。
  // 单词关键词（`qwen` / `claude`）不走这里，靠上面的 `includes` 兜。
  const keyTokens = splitTokens(key)
  const kwTokens = splitTokens(kw).filter((t) => t.length >= 2)
  if (kwTokens.length >= 2) {
    const matchedTokens = kwTokens.filter((token) => keyTokens.some((t) => t.includes(token))).length
    if (matchedTokens === kwTokens.length) score += 300 + 100 * matchedTokens
  }
  // 展示名是次一级的信号：模型串本身搜不到时，靠名字兜（如 `Qwen3` 对 `qwen-3-8b`）。
  if (entry.name.toLowerCase().includes(kw)) score += 200
  return score
}
