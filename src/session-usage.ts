import { billingOf, costOf, priceOfKey } from './pricing.ts'
import { countOf, timingIndexOf, type SessionTimingIndex } from './session-timing.ts'
import { summarizeRecords, type RateResolver, type StatsLogger } from './stats.ts'
import { recordFromRetry, type SessionEventLike } from './usage-record.ts'
import type { SyncPersistence } from './sync.ts'
import {
  totalsTokens, type BillingMap, type PricingTable, type SessionStepRow, type SessionUsageGroup,
  type SessionUsageView, type StepTiming, type UsageFields, type UsageRecord, type UsageTotals,
} from './types.ts'

export interface SessionUsageInput {
  sessionId: string
  records: readonly UsageRecord[]
  join: SessionJoin
  pricing: PricingTable
  billing: BillingMap
  resolve: RateResolver
  todaySpend: number
  updatedAt: number
  providerLabels?: Record<string, string>
}

interface Attribution {
  turn: number
  step?: number
}

interface Entry {
  record: UsageRecord
  row: SessionStepRow
}

function stepOf(event: SessionEventLike): number | undefined {
  return countOf(event.data?.step)
}

function messageIdOf(event: SessionEventLike): string | undefined {
  const id = event.data?.message?.id
  return typeof id === 'string' && id !== '' ? id : undefined
}

function decodeTurnFailure(sessionId: string, requestId: string): number | undefined {
  const prefix = `failure:${sessionId}:turn:`
  if (!requestId.startsWith(prefix)) return undefined
  const raw = requestId.slice(prefix.length)
  return /^\d+$/.test(raw) ? Number(raw) : undefined
}

function turnIndexOf(sessionId: string, events: readonly SessionEventLike[]): Map<string, Attribution> {
  const index = new Map<string, Attribution>()
  for (const event of events) {
    if (event.type === 'assistant/message') {
      const id = messageIdOf(event)
      const turn = countOf(event.data?.turn)
      if (id === undefined || turn === undefined) continue
      const step = stepOf(event)
      index.set(id, step === undefined ? { turn } : { turn, step })
      continue
    }
    if (event.type === 'llm/retry') {
      const turn = countOf(event.data?.turn)
      if (turn === undefined) continue
      const step = stepOf(event)
      index.set(recordFromRetry(event, sessionId, '').requestId, step === undefined ? { turn } : { turn, step })
    }
  }
  return index
}

function locate(
  record: UsageRecord,
  index: ReadonlyMap<string, Attribution> | null,
  sessionId: string,
): Attribution | undefined {
  if (record.kind === 'failure') {
    const turn = decodeTurnFailure(sessionId, record.requestId)
    if (turn !== undefined) return { turn }
  }
  return index?.get(record.requestId)
}

function totalsOfUsage(usage: UsageFields | undefined): UsageTotals {
  return {
    requests: 0,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cacheReadTokens: usage?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage?.cacheWriteTokens ?? 0,
  }
}

function tokensOf(usage: UsageFields | undefined): number {
  if (usage === undefined) return 0
  return usage.inputTokens + usage.outputTokens
    + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
}

function priceOfRecord(
  record: UsageRecord,
  pricing: PricingTable,
  billing: BillingMap,
  resolve: RateResolver,
  unpriced: Set<string>,
): { bucket: SessionStepRow['bucket']; cost: number } {
  const prices = priceOfKey(pricing, record.provider, record.model, resolve(record))
  if (prices === null) {
    if (record.model !== '') unpriced.add(`${record.provider ?? ''}|${record.model}`)
    return { bucket: 'unpriced', cost: 0 }
  }
  return {
    bucket: billingOf(billing, record.provider) === 'subscription' ? 'subscription' : 'spend',
    cost: costOf(totalsOfUsage(record.usage), prices),
  }
}

function stepRowOf(
  record: UsageRecord,
  input: SessionUsageInput,
  unpriced: Set<string>,
  at: Attribution | undefined,
  timing: SessionTimingIndex | null,
  owners: ReadonlyMap<string, string>,
): SessionStepRow {
  const priced = priceOfRecord(record, input.pricing, input.billing, input.resolve, unpriced)
  const own = timingOfRow(record, at, timing, owners)
  return {
    requestId: record.requestId,
    time: record.time,
    model: record.model,
    provider: record.provider ?? '',
    ...(record.kind !== undefined ? { kind: record.kind } : {}),
    ...(record.failureCode !== undefined ? { failureCode: record.failureCode } : {}),
    ...(record.usage !== undefined ? { usage: record.usage } : {}),
    tokens: tokensOf(record.usage),
    ...(at?.step !== undefined ? { step: at.step } : {}),
    ...(own !== undefined ? { timing: own } : {}),
    bucket: priced.bucket,
    cost: priced.cost,
  }
}

function sortEntries(entries: readonly Entry[]): Entry[] {
  return [...entries].sort((left, right) => left.record.time - right.record.time
    || (left.record.requestId < right.record.requestId ? -1
      : left.record.requestId > right.record.requestId ? 1 : 0))
}

function groupOf(turn: number | null, entries: readonly Entry[], resolve: RateResolver): SessionUsageGroup {
  const ordered = sortEntries(entries)
  const totals = summarizeRecords(ordered.map(entry => entry.record), resolve).total
  let spend = 0
  let subscriptionValue = 0
  for (const entry of ordered) {
    if (entry.row.bucket === 'spend') spend += entry.row.cost
    else if (entry.row.bucket === 'subscription') subscriptionValue += entry.row.cost
  }
  return {
    turn, totals, tokens: totalsTokens(totals), spend, subscriptionValue,
    rows: ordered.map(entry => entry.row),
  }
}

export interface SessionJoin {
  turn: ReadonlyMap<string, Attribution> | null
  timing: SessionTimingIndex | null
}

const NO_JOIN: SessionJoin = { turn: null, timing: null }

const joinCache = new Map<string, SessionJoin>()
const JOIN_CACHE_MAX = 8

async function revisionOf(persistence: SyncPersistence, sessionId: string): Promise<string | null> {
  if (typeof persistence.stat !== 'function') return null
  try {
    const snapshot = await persistence.stat(sessionId)
    const revision = snapshot?.revision
    return typeof revision === 'string' && revision !== '' ? revision : null
  } catch {
    return null
  }
}

export function joinOfEvents(sessionId: string, events: readonly SessionEventLike[]): SessionJoin {
  return {
    turn: turnIndexOf(sessionId, events),
    timing: timingIndexOf(sessionId, events),
  }
}

export async function sessionJoin(
  persistence: SyncPersistence | undefined,
  sessionId: string,
  logger: StatsLogger = console,
): Promise<SessionJoin> {
  const revision = persistence === undefined ? null : await revisionOf(persistence, sessionId)
  const cacheKey = `${sessionId}\u0000${revision ?? ''}`
  if (revision !== null) {
    const cached = joinCache.get(cacheKey)
    if (cached !== undefined) {
      joinCache.delete(cacheKey)
      joinCache.set(cacheKey, cached)
      return cached
    }
  }
  const events = await readSessionJoinEvents(persistence, sessionId, logger)
  if (events === null) return NO_JOIN
  const join = joinOfEvents(sessionId, events)
  if (revision !== null) {
    joinCache.set(cacheKey, join)
    for (const key of joinCache.keys()) {
      if (joinCache.size <= JOIN_CACHE_MAX) break
      joinCache.delete(key)
    }
  }
  return join
}

export async function readSessionJoinEvents(
  persistence: SyncPersistence | undefined,
  sessionId: string,
  logger: StatsLogger = console,
): Promise<readonly SessionEventLike[] | null> {
  if (persistence === undefined) return null
  try {
    if (typeof persistence.open === 'function') {
      const handle = await persistence.open(sessionId, 'read')
      try {
        const inherited = handle.inheritedEventCount
        const cut = typeof inherited === 'number' && inherited > 0 ? inherited : 0
        return (await handle.read(cut)).events
      } finally {
        await handle.close?.()
      }
    }
    if (typeof persistence.inspect === 'function') return (await persistence.inspect(sessionId)).events
    return null
  } catch (error) {
    logger.error(`[tokbook] cannot read the session log for the turn join (${sessionId}):`, error)
    return null
  }
}


export function buildSessionUsageView(input: SessionUsageInput): SessionUsageView {
  const { turn: index, timing } = input.join
  const owners = index === null ? new Map<string, string>() : timingOwners(input.records, index, input.sessionId)
  const all: Entry[] = []
  const turns = new Map<number, Entry[]>()
  const between: Entry[] = []
  const unattributed: Entry[] = []
  const unpriced = new Set<string>()

  const place = (record: UsageRecord, at: Attribution | undefined, bucket: Entry[]): void => {
    const entry: Entry = { record, row: stepRowOf(record, input, unpriced, at, timing, owners) }
    all.push(entry)
    bucket.push(entry)
  }

  for (const record of input.records) {
    if (record.sessionId !== input.sessionId) continue
    if (record.kind === 'compaction') {
      place(record, undefined, between)
      continue
    }
    const at = locate(record, index, input.sessionId)
    if (at === undefined) {
      place(record, undefined, unattributed)
      continue
    }
    let entries = turns.get(at.turn)
    if (entries === undefined) {
      entries = []
      turns.set(at.turn, entries)
    }
    place(record, at, entries)
  }

  const total = summarizeRecords(all.map(entry => entry.record), input.resolve).total
  let firstAt = Number.POSITIVE_INFINITY
  let lastAt = 0
  let spend = 0
  let subscriptionValue = 0
  for (const entry of all) {
    const time = entry.record.time
    if (time < firstAt) firstAt = time
    if (time > lastAt) lastAt = time
    if (entry.row.bucket === 'spend') spend += entry.row.cost
    else if (entry.row.bucket === 'subscription') subscriptionValue += entry.row.cost
  }
  const groups = [...turns.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([turn, entries]) => groupOf(turn, entries, input.resolve))
  const tail = between.length === 0 ? null : groupOf(null, between, input.resolve)

  return {
    sessionId: input.sessionId,
    updatedAt: input.updatedAt,
    firstAt: Number.isFinite(firstAt) ? firstAt : 0,
    lastAt,
    total,
    totalTokens: totalsTokens(total),
    spend,
    subscriptionValue,
    unpriced: [...unpriced].sort(),
    turns: groups,
    betweenTurns: tail,
    unattributed: sortEntries(unattributed).map(entry => entry.row),
    todaySpend: input.todaySpend,
    ...(input.providerLabels === undefined ? {} : { providerLabels: input.providerLabels }),
  }
}

function timingOwners(records: readonly UsageRecord[], index: ReadonlyMap<string, Attribution> | null, sessionId: string): Map<string, string> {
  const best = new Map<string, { requestId: string; rank: number; time: number }>()
  for (const record of records) {
    if (record.sessionId !== sessionId || record.kind === 'compaction') continue
    const at = locate(record, index, sessionId)
    if (at?.step === undefined) continue
    const rank = record.usage !== undefined ? 0 : record.kind === 'failure' ? 2 : 1
    const key = `${String(at.turn)}:${String(at.step)}`
    const seen = best.get(key)
    if (seen === undefined || rank < seen.rank || (rank === seen.rank && record.time < seen.time)) {
      best.set(key, { requestId: record.requestId, rank, time: record.time })
    }
  }
  return new Map([...best].map(([key, value]) => [key, value.requestId]))
}

function timingOfRow(
  record: UsageRecord,
  at: Attribution | undefined,
  timing: SessionTimingIndex | null,
  owners: ReadonlyMap<string, string>,
): StepTiming | undefined {
  if (timing === null) return undefined
  if (record.kind === 'compaction') {
    const llmMs = timing.compactions.get(record.requestId)
    return llmMs === undefined ? undefined : { llmMs }
  }
  if (at?.step === undefined) return undefined
  const key = `${String(at.turn)}:${String(at.step)}`
  if (owners.get(key) !== record.requestId) return undefined
  return timing.steps.get(key)
}
