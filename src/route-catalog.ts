/**
 * 价格表 tab 的 route catalog：哪些 provider route 存在，各自当前可对哪些
 * model 计费。
 *
 * 真源是 settings 文档与活的适配器 registry 联合；两个源都不知道的（账本
 * 计过费的 route、只带手写价格的串）由 `readPricingView` 补入。
 */

import type { ModelEntry, RouteCatalogEntry } from './types.ts'

/** 直连 DeepSeek 适配器（`dsh-llm-deepseek`）拥有的唯一 route。 */
export const DEEPSEEK_ROUTE = 'deepseek-official'

const PI_AI_NS = 'llm-pi-ai'
const DEEPSEEK_NS = 'llm-deepseek'

export interface SettingsLike {
  get(ns: string): unknown
}

export interface LlmLike {
  listProviders(): readonly { id: string; name: string }[]
  listModels(provider: string): Promise<readonly { id: string; name?: string }[]>
}

interface Logger {
  error(...args: unknown[]): void
  warn?(...args: unknown[]): void
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/** settings 文档中的条目是 `{ id, name? }` 对象，裸字符串也算（手工精简过的
 *  节）。保留 name：模型选择器用它标行，价格表同样展示。 */
function modelEntries(value: unknown): ModelEntry[] {
  if (!Array.isArray(value)) return []
  const out: ModelEntry[] = []
  for (const entry of value) {
    const id = typeof entry === 'string' ? entry : asRecord(entry)?.id
    if (typeof id !== 'string' || id === '') continue
    const name = typeof entry === 'string' ? undefined : asRecord(entry)?.name
    out.push({
      id,
      ...(typeof name === 'string' && name.trim() !== '' && name.trim() !== id
        ? { name: name.trim() }
        : {}),
    })
  }
  return out
}

/** 仅 settings 文档声明的 route 与 model。 */
export function routesFromSettings(settings: SettingsLike | undefined): RouteCatalogEntry[] {
  if (settings === undefined) return []
  const entries: RouteCatalogEntry[] = []
  const piAi = asRecord(settings.get(PI_AI_NS))
  const providers = asRecord(piAi?.providers)
  if (providers !== null) {
    for (const [route, profile] of Object.entries(providers)) {
      if (route === '') continue
      const raw = asRecord(profile)
      const displayName = typeof raw?.displayName === 'string' ? raw.displayName.trim() : ''
      entries.push({ route, label: displayName !== '' ? displayName : '', models: modelEntries(raw?.models) })
    }
  }
  // 直连适配器恰好拥有**一个** route，且不在文档里写 route key：命名空间的
  // 存在本身即表示它已挂载。
  const deepseek = asRecord(settings.get(DEEPSEEK_NS))
  if (deepseek !== null) {
    entries.push({ route: DEEPSEEK_ROUTE, label: '', models: modelEntries(deepseek.models) })
  }
  return entries
}

/** route → 展示名，不向任何适配器要模型列表：settings profile 的
 *  `displayName` 优先，其次已注册适配器的 provider 名。通道用量卡以此为题；
 *  两个源都不命名的 route 直接缺席，卡回落到 route key。 */
export function routeLabels(
  settings: SettingsLike | undefined,
  llm: LlmLike | undefined,
  logger: Logger = console,
): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const entry of routesFromSettings(settings)) {
    if (entry.label !== '') labels[entry.route] = entry.label
  }
  if (llm !== undefined) {
    try {
      for (const provider of llm.listProviders()) {
        if (provider.name !== '' && labels[provider.id] === undefined) labels[provider.id] = provider.name
      }
    } catch (error) {
      logger.warn?.('[tokbook] cannot list provider routes:', error)
    }
  }
  return labels
}

/** 合并 settings route 与活的适配器 registry。文档未携带的 registry route 成为
 *  自己的一张卡；配置模型列表为空的 route 询问其适配器。 */
export async function collectRoutes(
  settings: SettingsLike | undefined,
  llm: LlmLike | undefined,
  logger: Logger = console,
): Promise<RouteCatalogEntry[]> {
  const byRoute = new Map<string, { label: string; models: Map<string, ModelEntry> }>()
  const ensure = (route: string, label: string): { label: string; models: Map<string, ModelEntry> } => {
    let entry = byRoute.get(route)
    if (entry === undefined) {
      entry = { label, models: new Map() }
      byRoute.set(route, entry)
    } else if (entry.label === '' && label !== '') {
      entry.label = label
    }
    return entry
  }
  /** 加一个模型，保留某个源给出的第一个名字（settings 文档的名字是用户自己的
   *  措辞，优先于适配器的）。 */
  const add = (models: Map<string, ModelEntry>, model: ModelEntry): void => {
    const seen = models.get(model.id)
    if (seen === undefined) models.set(model.id, model)
    else if (seen.name === undefined && model.name !== undefined) seen.name = model.name
  }
  for (const entry of routesFromSettings(settings)) {
    const acc = ensure(entry.route, entry.label)
    for (const model of entry.models) add(acc.models, model)
  }

  let providers: readonly { id: string; name: string }[] = []
  if (llm !== undefined) {
    try {
      providers = llm.listProviders()
    } catch (error) {
      logger.warn?.('[tokbook] cannot list provider routes:', error)
    }
  }
  for (const provider of providers) {
    const acc = ensure(provider.id, provider.name)
    // 配置列表是用户的声明，优先；只有未声明模型的 route 才询问适配器
    // （后者从自身 registry 回答，从不联网）。
    if (acc.models.size > 0 || llm === undefined) continue
    try {
      for (const model of await llm.listModels(provider.id)) {
        if (model.id === '') continue
        add(acc.models, {
          id: model.id,
          ...(typeof model.name === 'string' && model.name.trim() !== '' && model.name.trim() !== model.id
            ? { name: model.name.trim() }
            : {}),
        })
      }
    } catch (error) {
      logger.warn?.(`[tokbook] cannot list models of route ${provider.id}:`, error)
    }
  }

  return [...byRoute.entries()].map(([route, acc]) => ({
    route,
    label: acc.label !== '' ? acc.label : route,
    models: [...acc.models.values()],
  }))
}
