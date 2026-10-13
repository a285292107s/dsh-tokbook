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
import { countOf, timingIndexOf, type SessionTimingIndex } from './session-timing.ts'
import { summarizeRecords, type RateResolver, type StatsLogger } from './stats.ts'
import { recordFromRetry, type SessionEventLike } from './usage-record.ts'
import type { SyncPersistence } from './sync.ts'
import {
  settleTiming, totalsTokens, type BillingMap, type PricingTable, type SessionStepRow, type SessionUsageGroup,
  type SessionUsageView, type StepTiming, type UsageFields, type UsageRecord, type UsageTotals,
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

/** 事件的 `step` 载荷。`SessionEventLike.data` 里的字段名以 DSH 的事件载荷为准，
 *  宿主改了名这里必须跟着改。 */
function stepOf(event: SessionEventLike): number | undefined {
  return countOf(event.data?.step)
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
  return {
    turn, totals, tokens: totalsTokens(totals), spend, subscriptionValue,
    rows: ordered.map(entry => entry.row),
  }
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
  const timing = input.events === null ? null : timingIndexOf(input.sessionId, input.events)
  const owners = input.events === null ? new Map<string, string>() : timingOwners(input.records, index, input.sessionId)
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
    ...spanOf(input.events, all.map(entry => entry.row)),
  }
}

/**
 * 这一步的用时归**哪一行**报。
 *
 * 一步可能落不止一行账本：重试过的步既有那次重试的失败行、又有最终产出的那行，而
 * `(turn, step)` 只有一个、`step/start → step/end` 也只有一个区间。若按行各报一次，
 * 同一步的用时会被加两遍——本机 760 个会话里 163 个有这种重复行，「引擎工作总时长」
 * 就会超过会话跨度（实测 27 个会话如此）。
 *
 * 所以按步定一个报时用的行：**有产出的那行**（`usage` 在）优先，其次是**非失败行**，
 * 再不然取最早落盘的那行。其余同步行读到「未计时」——它们确实分不出自己那一段的
 * 起止，报 0 或报整步都是假话。
 */
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

/**
 * 这一步的用时，只由 `owners` 指定的那一行报出（见 `timingOwners`）。压缩行没有步骤号，
 * 走自己那条 requestId——`compaction/start` → `compaction/summary` 那一段**就是**这次
 * summarize 的模型调用（summary 事件带 usage 与正文，是调用完成时落盘的），所以报成模型
 * 用时，不再另记墙钟：同一段墙钟报两次就成了两个数。
 */
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

/**
 * 会话跨度与引擎工作总时长。这两个数**并排放**才是它们存在的理由：跨度和工作量的差额
 * 就是这一步没在算的时间（等用户输入、等外部、会话挂起）。
 *
 * 跨度取日志的首末事件时刻，不是账本的首末记录——账本只在有计费调用时才落行，用它算
 * 跨度会把「最后一句话之后挂了几小时」全丢掉。
 *
 * 日志读不到时**两个都缺席**：那时候一行都没计时，工作量会是 0，而「0秒」在此正是
 * 「不知道」被印成了「没花时间」（同「用量未知 ≠ 0」，见 docs/CONTRACTS.md §2）。
 */
function spanOf(
  events: readonly SessionEventLike[] | null,
  rows: readonly SessionStepRow[],
): { spanMs?: number; workMs?: number } {
  if (events === null || events.length === 0) return {}
  let first = Number.POSITIVE_INFINITY
  let last = Number.NEGATIVE_INFINITY
  for (const event of events) {
    if (!Number.isFinite(event.time)) continue
    if (event.time < first) first = event.time
    if (event.time > last) last = event.time
  }
  const { llmMs, toolMs } = settleTiming(rows)
  const timed = rows.some((row) => row.timing !== undefined)
  const span = Number.isFinite(first) && last >= first ? { spanMs: last - first } : {}
  // 一行都没计时就不报工作量：那 0 是「量不到」，不是「没花时间」。
  return timed ? { ...span, workMs: llmMs + toolMs } : span
}
