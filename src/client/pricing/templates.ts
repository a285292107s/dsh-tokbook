import type { DaySet, PriceCurrency } from '../../types.ts'
import { DAY_SETS } from '../../price-format.ts'
import { convertText, type MoneyView } from './currency.ts'

export interface TemplateRates {
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

export interface TemplateSlot extends TemplateRates {
  days: DaySet
  start: string
  end: string
}

export interface PriceTemplate extends TemplateRates {
  id: string
  name: string
  currency: PriceCurrency
  slots: TemplateSlot[]
}

export const TEMPLATES_KEY = 'dsh-tokbook.price-templates'

const LEGACY_TEMPLATES_KEY = 'dsh-tookbook.price-templates'

export const MAX_TEMPLATES = 50

const MAX_TEMPLATE_SLOTS = 50

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

function cleanHour(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return ''
  return value.trim()
}

function cleanSlot(raw: unknown): TemplateSlot | null {
  if (!isRecord(raw)) return null
  const days = DAY_SETS.includes(raw.days as DaySet) ? raw.days as DaySet : null
  const start = cleanHour(raw.start)
  const end = cleanHour(raw.end)
  if (days === null || start === '' || end === '') return null
  return {
    days,
    start,
    end,
    input: cleanRate(raw.input),
    output: cleanRate(raw.output),
    cacheRead: cleanRate(raw.cacheRead),
    cacheWrite: cleanRate(raw.cacheWrite),
  }
}

function cleanSlots(raw: unknown): TemplateSlot[] {
  if (!Array.isArray(raw)) return []
  const slots: TemplateSlot[] = []
  for (const item of raw) {
    const slot = cleanSlot(item)
    if (slot === null) continue
    slots.push(slot)
    if (slots.length >= MAX_TEMPLATE_SLOTS) break
  }
  return slots
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
    slots: cleanSlots(raw.slots),
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
    const saved = localStorage.getItem(TEMPLATES_KEY) ?? localStorage.getItem(LEGACY_TEMPLATES_KEY)
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

export function makeTemplate(
  name: string,
  rates: TemplateRates,
  slots: readonly TemplateSlot[],
  currency: PriceCurrency,
): PriceTemplate {
  return {
    id: makeId(),
    name: cleanName(name),
    input: cleanRate(rates.input),
    output: cleanRate(rates.output),
    cacheRead: cleanRate(rates.cacheRead),
    cacheWrite: cleanRate(rates.cacheWrite),
    currency,
    slots: cleanSlots(slots),
  }
}

function convertRateSet(view: MoneyView, holder: TemplateRates, to: PriceCurrency): TemplateRates | null {
  const input = convertText(view, holder.input, to)
  const output = convertText(view, holder.output, to)
  const cacheRead = convertText(view, holder.cacheRead, to)
  const cacheWrite = convertText(view, holder.cacheWrite, to)
  if (input === null || output === null || cacheRead === null || cacheWrite === null) return null
  return { input, output, cacheRead, cacheWrite }
}

export function applyTemplate(
  template: PriceTemplate,
  targetCurrency: PriceCurrency,
  cnyPerUsd: number | null,
): { rates: TemplateRates; slots: TemplateSlot[] } | null {
  const view: MoneyView = { route: template.currency, cnyPerUsd }
  const rates = convertRateSet(view, template, targetCurrency)
  if (rates === null) return null
  const slots: TemplateSlot[] = []
  for (const slot of template.slots) {
    const slotRates = convertRateSet(view, slot, targetCurrency)
    if (slotRates === null) return null
    slots.push({ days: slot.days, start: slot.start, end: slot.end, ...slotRates })
  }
  return { rates, slots }
}
