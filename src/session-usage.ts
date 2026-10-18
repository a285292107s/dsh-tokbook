import { billingOf, costOf, priceOfKey } from './pricing.ts'
import { countOf, timingIndexOf, type SessionTimingIndex } from './session-timing.ts'
import { summarizeRecords, type RateResolver, type StatsLogger } from './stats.ts'
import { recordFromRetry, type SessionEventLike } from './usage-record.ts'
import type { SyncPersistence } from './sync.ts'
import {
  settleTiming, totalsTokens, type BillingMap, type PricingTable, type SessionStepRow, type SessionSubagentRow,
  type SessionSubagentsView, type SessionUsageGroup, type SessionUsageView, type StepTiming, type UsageFields,
  type UsageRecord, type UsageTotals,
} from './types.ts'

export interface SessionUsageInput {
  sessionId: string
  records: readonly UsageRecord[]
  join: SessionJoin
  sessions?: readonly SessionLineageLike[]
  pricing: PricingTable
  billing: BillingMap
  resolve: RateResolver
  todaySpend: number
  updatedAt: number
}

export interface SessionLineageLike {
  header: { id: string; parentSession?: string; origin?: string }
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
  span: { first: number; last: number } | null
  labels: ReadonlyMap<string, string>
}

const NO_JOIN: SessionJoin = { turn: null, timing: null, span: null, labels: new Map() }

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
  let first = Number.POSITIVE_INFINITY
  let last = Number.NEGATIVE_INFINITY
  const labels = new Map<string, string>()
  for (const event of events) {
    if (Number.isFinite(event.time)) {
      if (event.time < first) first = event.time
      if (event.time > last) last = event.time
    }
    if (event.type === 'subagent/catalog') {
      const childId = event.data?.childId
      const label = event.data?.label
      if (typeof childId === 'string' && childId !== '' && typeof label === 'string' && label !== '') {
        labels.set(childId, label)
      }
    }
  }
  return {
    turn: turnIndexOf(sessionId, events),
    timing: timingIndexOf(sessionId, events),
    span: Number.isFinite(first) && last >= first ? { first, last } : null,
    labels,
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

interface SubagentBranch {
  id: string
  tree: readonly string[]
}

function subagentBranches(sessions: readonly SessionLineageLike[], rootId: string): SubagentBranch[] {
  const children = new Map<string, string[]>()
  for (const snapshot of sessions) {
    const { id, parentSession, origin } = snapshot.header
    if (origin !== 'subagent') continue
    if (typeof parentSession !== 'string' || parentSession === '') continue
    const siblings = children.get(parentSession)
    if (siblings === undefined) children.set(parentSession, [id])
    else siblings.push(id)
  }
  const branches: SubagentBranch[] = []
  for (const child of children.get(rootId) ?? []) {
    const tree: string[] = []
    const seen = new Set<string>()
    const stack = [child]
    while (stack.length > 0) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      tree.push(id)
      for (const grandchild of children.get(id) ?? []) stack.push(grandchild)
    }
    branches.push({ id: child, tree })
  }
  return branches
}

function subagentsOf(input: SessionUsageInput, labels: ReadonlyMap<string, string>): SessionSubagentsView | undefined {
  const sessions = input.sessions
  if (sessions === undefined || sessions.length === 0) return undefined
  const branches = subagentBranches(sessions, input.sessionId)
  if (branches.length === 0) return undefined

  const owner = new Map<string, string>()
  for (const branch of branches) {
    for (const id of branch.tree) owner.set(id, branch.id)
  }
  const recordsByBranch = new Map<string, UsageRecord[]>()
  for (const record of input.records) {
    const branchId = owner.get(record.sessionId)
    if (branchId === undefined) continue
    const list = recordsByBranch.get(branchId)
    if (list === undefined) recordsByBranch.set(branchId, [record])
    else list.push(record)
  }

  const unpriced = new Set<string>()
  const rows: SessionSubagentRow[] = []
  let totalTokens = 0
  let spend = 0
  let subscriptionValue = 0
  let usageUnknown = 0
  let failures = 0
  for (const branch of branches) {
    const records = recordsByBranch.get(branch.id) ?? []
    const totals = summarizeRecords(records, input.resolve).total
    let branchSpend = 0
    let branchSubscription = 0
    let priced = false
    for (const record of records) {
      const price = priceOfRecord(record, input.pricing, input.billing, input.resolve, unpriced)
      if (price.bucket === 'spend') {
        branchSpend += price.cost
        priced = true
      } else if (price.bucket === 'subscription') {
        branchSubscription += price.cost
        priced = true
      }
    }
    const tokens = totalsTokens(totals)
    const unknown = totals.usageUnknown ?? 0
    const failed = totals.failures ?? 0
    rows.push({
      sessionId: branch.id,
      label: labels.get(branch.id) ?? '',
      tokens,
      requests: totals.requests,
      failures: failed,
      usageUnknown: unknown,
      spend: branchSpend,
      subscriptionValue: branchSubscription,
      priced,
      descendants: branch.tree.length - 1,
    })
    totalTokens += tokens
    spend += branchSpend
    subscriptionValue += branchSubscription
    usageUnknown += unknown
    failures += failed
  }
  rows.sort((left, right) => right.tokens - left.tokens
    || (left.label !== right.label ? (left.label < right.label ? -1 : 1)
      : (left.sessionId < right.sessionId ? -1 : left.sessionId > right.sessionId ? 1 : 0)))
  return {
    count: rows.length,
    totalTokens,
    spend,
    subscriptionValue,
    usageUnknown,
    failures,
    unpriced: [...unpriced].sort(),
    rows,
  }
}

export function buildSessionUsageView(input: SessionUsageInput): SessionUsageView {
  const { turn: index, timing, span } = input.join
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
  const subagents = subagentsOf(input, input.join.labels)

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
    ...spanOf(span, all.map(entry => entry.row)),
    ...(subagents === undefined ? {} : { subagents }),
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

function spanOf(
  span: { first: number; last: number } | null,
  rows: readonly SessionStepRow[],
): { spanMs?: number; workMs?: number } {
  if (span === null) return {}
  const { llmMs, toolMs } = settleTiming(rows)
  const timed = rows.some((row) => row.timing !== undefined)
  const elapsed = span.last >= span.first ? { spanMs: span.last - span.first } : {}
  return timed ? { ...elapsed, workMs: llmMs + toolMs } : elapsed
}
