/**
 * 单个会话的账本视图（`GET /tokbook/session` 的载荷）：token 与钱只取账本行，
 * 轮次 / 步骤在**请求时** join 该会话的持久化日志——不给账本行加字段的理由见
 * docs/adr/0001-turn-attribution-read-time-join.md。
 *
 * join 键复用写入侧的同一条身份规则，而不是在这里推第二套：普通请求是
 * `assistant/message` 的 `message.id`，retry 失败是 `recordFromRetry` 合成的
 * `failure:` 键，`turn/end` 失败行的键里本来就带回合号（不必 join）。日志读不到
 * 时那些行进 `unattributed`——不猜、不按时间硬塞（同 ADR 的后果 2）。
 */

import { billingOf, costOf, priceOfKey } from './pricing.ts'
import { summarizeRecords, type RateResolver, type StatsLogger } from './stats.ts'
import { recordFromRetry, type SessionEventLike } from './usage-record.ts'
import type { SyncPersistence } from './sync.ts'
import {
  totalsTokens, type BillingMap, type PricingTable, type SessionStepRow, type SessionUsageGroup, type SessionUsageView,
  type UsageFields, type UsageRecord, type UsageTotals,
} from './types.ts'

/** {@link buildSessionUsageView} 的输入：账本行 + 计价上下文 + 该会话日志。 */
export interface SessionUsageInput {
  sessionId: string
  /** 全部会话的账本记录（本函数按 `sessionId` 过滤，调用方不必先筛）。 */
  records: readonly UsageRecord[]
  /** 该会话用于 join 的事件；读不到为 null = 所有需要 join 的行进 `unattributed`。 */
  events: readonly SessionEventLike[] | null
  /** 计价用的价表（已折人民币；口径同 `attachCosts` 的 `table`）。 */
  pricing: PricingTable
  billing: BillingMap
  /** 解 rate 身份用的解析器（绑在**原**价表上，同 `TokenUsageBook.rateContext`）。 */
  resolve: RateResolver
  /** 今日实际支出 ¥（全部会话）——抬头参照系，取自概览同一条聚合。 */
  todaySpend: number
  updatedAt: number
}

/** join 出来的归属：`step` 缺席 = 该事件没带步骤号（`turn/end` 失败行就没有）。 */
interface Attribution {
  turn: number
  step?: number
}

interface Entry {
  record: UsageRecord
  row: SessionStepRow
}

function countOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

/** 事件的 `step` 载荷。`SessionEventLike.data` 没有这个字段（账本侧不读它），
 *  但 `assistant/message` 与 `llm/retry` 都带——字段名以 DSH 的事件载荷为准，
 *  宿主改了名这里必须跟着改。 */
function stepOf(event: SessionEventLike): number | undefined {
  const data: unknown = event.data
  if (typeof data !== 'object' || data === null) return undefined
  return countOf((data as Record<string, unknown>)['step'])
}

/** `assistant/message` 的账本身份：与写入侧取的是同一个 `message.id`。 */
function messageIdOf(event: SessionEventLike): string | undefined {
  const id = event.data?.message?.id
  return typeof id === 'string' && id !== '' ? id : undefined
}

/** `turn/end` 失败行的回合号就在 requestId 里（`failure:<sid>:turn:<N>`）。 */
function decodeTurnFailure(sessionId: string, requestId: string): number | undefined {
  const prefix = `failure:${sessionId}:turn:`
  if (!requestId.startsWith(prefix)) return undefined
  const raw = requestId.slice(prefix.length)
  return /^\d+$/.test(raw) ? Number(raw) : undefined
}

/**
 * 该会话日志的「账本 requestId → (turn, step)」索引。键都用写入侧的同一条身份
 * 规则造出，故与账本行逐字相符。压缩事件不进来：它注定归轮间。
 */
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
      // retry 的身份不在这里重推：复用写入侧的投影，两条规则分叉即错。
      index.set(recordFromRetry(event, sessionId, '').requestId, step === undefined ? { turn } : { turn, step })
    }
  }
  return index
}

/** 一条记录归属到哪个轮次。`turn/end` 失败行先认自己身份里的回合号（它不带步骤
 *  号），其余（普通请求、retry 失败）看 join 索引。 */
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

/** 单条记录的 token 桶，供 `costOf` 使用（它只读这四个桶）。 */
function totalsOfUsage(usage: UsageFields | undefined): UsageTotals {
  return {
    requests: 0,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cacheReadTokens: usage?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage?.cacheWriteTokens ?? 0,
  }
}

/** 四桶之和；`usage` 缺席读作 0（那仍是「用量未知」的一次调用）。 */
function tokensOf(usage: UsageFields | undefined): number {
  if (usage === undefined) return 0
  return usage.inputTokens + usage.outputTokens
    + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
}

/**
 * 一条账本行的金额，走 `attachCosts` 的同一条路径（`resolve` 解出的 rate 身份 →
 * `priceOfKey` 回查 → `costOf` 计价），只是按**单条**记录计价。未定价计 ¥0 并进
 * `unpriced`；空 model 串与 `attachCosts` 一致地不进清单。
 */
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
  step: number | undefined,
): SessionStepRow {
  const priced = priceOfRecord(record, input.pricing, input.billing, input.resolve, unpriced)
  return {
    requestId: record.requestId,
    time: record.time,
    model: record.model,
    provider: record.provider ?? '',
    ...(record.kind !== undefined ? { kind: record.kind } : {}),
    ...(record.failureCode !== undefined ? { failureCode: record.failureCode } : {}),
    ...(record.usage !== undefined ? { usage: record.usage } : {}),
    tokens: tokensOf(record.usage),
    ...(step !== undefined ? { step } : {}),
    bucket: priced.bucket,
    cost: priced.cost,
  }
}

function sortEntries(entries: readonly Entry[]): Entry[] {
  return [...entries].sort((left, right) => left.record.time - right.record.time
    || (left.record.requestId < right.record.requestId ? -1
      : left.record.requestId > right.record.requestId ? 1 : 0))
}

/** 一组记录折成一组：合计仍由 `summarizeRecords` 出，故失败 / 用量未知的口径
 *  与其余 totals 逐字一致。 */
function groupOf(turn: number | null, entries: readonly Entry[], resolve: RateResolver): SessionUsageGroup {
  const ordered = sortEntries(entries)
  const totals = summarizeRecords(ordered.map(entry => entry.record), resolve).total
  let spend = 0
  let subscriptionValue = 0
  for (const entry of ordered) {
    if (entry.row.bucket === 'spend') spend += entry.row.cost
    else if (entry.row.bucket === 'subscription') subscriptionValue += entry.row.cost
  }
  return { turn, totals, tokens: totalsTokens(totals), spend, subscriptionValue, rows: ordered.map(entry => entry.row) }
}

/** 读该会话的日志供 join：`open(id,'read')` 不取写所有权，与在写的宿主并行安全；
 *  从 `inheritedEventCount` 起读——fork 继承的父前缀不是本会话的计费调用（同
 *  `sync.ts` 的 `readSessionEvents`）。读不到一律答 null，绝不抛给读路径。 */
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

/** 把一个会话的账本记录折成视图。分组规则见 docs/CONTEXT.md：压缩归轮间（不硬塞
 *  进某一轮），失败行按自己身份里的回合号进组，join 不上的行进 `unattributed`
 *  ——「轮次未知」与「轮间」分列。 */
export function buildSessionUsageView(input: SessionUsageInput): SessionUsageView {
  const index = input.events === null ? null : turnIndexOf(input.sessionId, input.events)
  const all: Entry[] = []
  const turns = new Map<number, Entry[]>()
  const between: Entry[] = []
  const unattributed: Entry[] = []
  const unpriced = new Set<string>()

  const place = (record: UsageRecord, at: Attribution | undefined, bucket: Entry[]): void => {
    const entry: Entry = { record, row: stepRowOf(record, input, unpriced, at?.step) }
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
    turns: [...turns.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([turn, entries]) => groupOf(turn, entries, input.resolve)),
    betweenTurns: between.length === 0 ? null : groupOf(null, between, input.resolve),
    unattributed: sortEntries(unattributed).map(entry => entry.row),
    todaySpend: input.todaySpend,
  }
}
