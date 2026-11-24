import type { PriceCurrency } from '../../types.ts'
import { convertText, type MoneyView } from './currency.ts'

export interface PriceTemplate {
  id: string
  name: string
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
  currency: PriceCurrency
}

export interface TemplateRates {
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

export const TEMPLATES_KEY = 'dsh-tokbook.price-templates'

export const MAX_TEMPLATES = 50

const MAX_NAME_LENGTH = 40

const MAX_RATE_LENGTH = 64

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cleanRate(value: unknown): string {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return text.length > MAX_RATE_LENGTH ? '' : text
}

function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_NAME_LENGTH) : ''
}

function cleanCurrency(value: unknown): PriceCurrency {
  return value === 'USD' ? 'USD' : 'CNY'
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTemplate(raw: unknown): PriceTemplate | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' ? raw.id : ''
  const name = cleanName(raw.name)
  if (id === '' || name === '') return null
  return {
    id,
    name,
    input: cleanRate(raw.input),
    output: cleanRate(raw.output),
    cacheRead: cleanRate(raw.cacheRead),
    cacheWrite: cleanRate(raw.cacheWrite),
    currency: cleanCurrency(raw.currency),
  }
}

export function parseTemplates(raw: unknown): PriceTemplate[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const templates: PriceTemplate[] = []
  for (const item of raw) {
    const template = normalizeTemplate(item)
    if (template === null || seen.has(template.id)) continue
    seen.add(template.id)
    templates.push(template)
    if (templates.length >= MAX_TEMPLATES) break
  }
  return templates
}

export function readTemplates(): PriceTemplate[] {
  try {
    const saved = localStorage.getItem(TEMPLATES_KEY)
    if (saved === null) return []
    return parseTemplates(JSON.parse(saved) as unknown)
  } catch {
    return []
  }
}

export function writeTemplates(templates: readonly PriceTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.slice(-MAX_TEMPLATES)))
  } catch {
  }
}

export function makeTemplate(name: string, rates: TemplateRates, currency: PriceCurrency): PriceTemplate {
  return {
    id: makeId(),
    name: cleanName(name),
    input: cleanRate(rates.input),
    output: cleanRate(rates.output),
    cacheRead: cleanRate(rates.cacheRead),
    cacheWrite: cleanRate(rates.cacheWrite),
    currency,
  }
}

export function applyTemplate(
  template: PriceTemplate,
  targetCurrency: PriceCurrency,
  cnyPerUsd: number | null,
): TemplateRates | null {
  const view: MoneyView = { route: template.currency, cnyPerUsd }
  const input = convertText(view, template.input, targetCurrency)
  const output = convertText(view, template.output, targetCurrency)
  const cacheRead = convertText(view, template.cacheRead, targetCurrency)
  const cacheWrite = convertText(view, template.cacheWrite, targetCurrency)
  if (input === null || output === null || cacheRead === null || cacheWrite === null) return null
  return { input, output, cacheRead, cacheWrite }
}
