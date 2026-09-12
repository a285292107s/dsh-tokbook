/**
 * The route catalog of the 价格表 tab: which provider routes exist and which
 * models each can currently be billed for.
 *
 * The source of truth is the local configuration — the DSH settings document
 * (`llm-pi-ai.providers` for every pi-ai route, `llm-deepseek` for the single
 * direct DeepSeek route) — joined with the LIVE adapter registry, so a route
 * that is registered without being written in the document (a plugin-minted
 * route) still gets a card, and the adapter's own catalog fills in the models
 * of a route whose profile lists none. Whatever neither source knows (a route
 * the ledger billed, a string that only carries a hand-written price) is added
 * by `readPricingView`, which owns the union.
 *
 * @module dsh-tokbook/route-catalog
 */

import type { ModelEntry, RouteCatalogEntry } from './types.ts'

/** The one route the direct DeepSeek adapter owns (`dsh-llm-deepseek`). */
export const DEEPSEEK_ROUTE = 'deepseek-official'

const PI_AI_NS = 'llm-pi-ai'
const DEEPSEEK_NS = 'llm-deepseek'

/** Minimal face of the host settings seam (`ctx.settings`). */
export interface SettingsLike {
  get(ns: string): unknown
}

/** Minimal face of the host LLM seam (`ctx.llm`). `listModels` carries the
 *  adapter's own display names, the same ones the model picker shows. */
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

/** The models of one `models:` list — entries are `{ id, name? }` objects in
 *  the settings document, a bare string also counts (a hand-trimmed section).
 *  The name is kept: it is what the model picker labels the row with, and the
 *  price table shows it the same way (exact string as the identity beneath). */
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

/** The routes and models the settings document alone declares. */
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
  // The direct adapter owns exactly ONE route and writes no route key into the
  // document: the namespace's presence is what says it is mounted.
  const deepseek = asRecord(settings.get(DEEPSEEK_NS))
  if (deepseek !== null) {
    entries.push({ route: DEEPSEEK_ROUTE, label: '', models: modelEntries(deepseek.models) })
  }
  return entries
}

/** Route → display name, without asking any adapter for its model list: the
 *  settings profiles' `displayName` first, then the registered adapter's
 *  provider name. The 通道用量 cards head with this; a route neither source
 *  names is simply absent and the card falls back to the route key. */
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

/** Merge the settings routes with the live adapter registry. A registry route
 *  the document does not carry becomes a card of its own; a route whose
 *  configured model list is empty asks its adapter. */
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
  /** Add one model, keeping the first name a source gave it (the settings
   *  document's name is the user's own wording and wins over the adapter's). */
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
    // The configured list is the user's declaration and wins; only a route that
    // declares no models asks its adapter (which answers from its own registry,
    // never the network).
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
