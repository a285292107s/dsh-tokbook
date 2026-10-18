import type { ModelEntry, RouteCatalogEntry } from './types.ts'

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
  const deepseek = asRecord(settings.get(DEEPSEEK_NS))
  if (deepseek !== null) {
    entries.push({ route: DEEPSEEK_ROUTE, label: '', models: modelEntries(deepseek.models) })
  }
  return entries
}

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
