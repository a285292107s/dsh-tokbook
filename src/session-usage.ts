/**
 * 单个会话的账本视图（`GET /tokbook/session` 的载荷）：token 与钱只取账本行，
 * 轮次 / 步骤在**请求时** join 该会话的持久化日志——不给账本行加字段的理由见
 * docs/adr/0001-turn-attribution-read-time-join.md。
 *
 * join 键复用写入侧的同一条身份规则，而不是在这里推第二套：普通请求是
 * `assistant/message` 的 `message.id`，retry 失败是 `recordFromRetry` 合成的
 * `failure:` 键，`turn/end` 失败行的键里本来就带回合号（不必 join）。日志读不到
 * 时那些行进 `unattributed`——不猜、不按时间硬塞（同 ADR 的后果 2）。
 *
 * 「子代理」一段走另一条读时归集：会话清单的 header 血缘（`parentSession` +
 * `origin`）把本会话直接派出的下级会话认出来，账本行按 `sessionId` 折进各自的整棵子树。
 * 它不改主会话的轮次 / 步骤折叠，也不往账本行里补字段。
 */

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

/** {@link buildSessionUsageView} 的输入：账本行 + 计价上下文 + 该会话日志的 join。 */
export interface SessionUsageInput {
  sessionId: string
  /** 全部会话的账本记录（本函数按 `sessionId` 过滤，调用方不必先筛）。 */
  records: readonly UsageRecord[]
  /** 该会话日志的 join 产物（见 {@link sessionJoinIndex}）。读不到日志时
   *  `turn` / `timing` 为 null，所有需要 join 的行进 `unattributed`。 */
  join: SessionJoin
  /** 持久化会话清单（只用 header 的两格血缘）：子代理一段靠它把下级会话 join 到本会话。
   *  缺席 = 这一页读不到血缘（独立查看器没有持久化面），那一段整块不出。 */
  sessions?: readonly SessionLineageLike[]
  /** 计价用的价表（已折人民币；口径同 `attachCosts` 的 `table`）。 */
  pricing: PricingTable
  billing: BillingMap
  /** 解 rate 身份用的解析器（绑在**原**价表上，同 `TokenUsageBook.rateContext`）。 */
  resolve: RateResolver
  /** 今日实际支出 ¥（全部会话）——抬头参照系，取自概览同一条聚合。 */
  todaySpend: number
  updatedAt: number
}

/**
 * 会话清单里本页只读的那两格血缘事实。`origin` 是宿主对「这是子代理会话」的粗分类；
 * `parentSession` 只是 fork 血缘——用户手动 fork 的会话也带它，所以**不能**只用
 * `parentSession` 认子代理（那会把 fork 的用量算成子代理花的）。
 */
export interface SessionLineageLike {
  header: { id: string; parentSession?: string; origin?: string }
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

/** {@link buildSessionUsageView} 需要的 join 资料：归属索引、用时索引、日志首末时刻、子代理标签。 */
export interface SessionJoin {
  /** 账本 requestId → (turn, step)；日志读不到为 null。 */
  turn: ReadonlyMap<string, Attribution> | null
  /** 每步的用时；日志读不到为 null。 */
  timing: SessionTimingIndex | null
  /** 日志首末事件时刻（算会话跨度用）；日志读不到为 null → 跨度与工作量都缺席。 */
  span: { first: number; last: number } | null
  /** 父会话日志里 `subagent/catalog` 的创建标签：child session id → label。读不到日志时为空表。 */
  labels: ReadonlyMap<string, string>
}

/** 日志读不到时的 join：需要 join 的行全进「轮次未知」，用时与跨度都缺席。 */
const NO_JOIN: SessionJoin = { turn: null, timing: null, span: null, labels: new Map() }

/**
 * 一份日志的 join 资料，按「日志 revision」缓存。
 *
 * 这一页每被打开一次、每跟一次账本变化，都要把该会话**整份**日志读来 join——本机最大的
 * 一份压缩日志 14 MB，解压 + 解析 + 量用时是秒级。而绝大多数重读发生时日志一个字都没变
 * （账本刚落了别处的行、用户只是切回这一页），所以把 join 资料按持久化的 `revision` 记住：
 * 变了才重算。`revision` 是宿主 `stat`/`list` 给出的不透明变更令牌，其契约正是「相等即
 * 日志未变」。
 *
 * 三条边界：
 * - **读不到 `revision` 就每次都重算**（旧宿主没有这个字段）。宁可多算，不可拿一份可能
 *   已经过时的归属去报数。
 * - **读不到日志（events === null）不缓存**：那是「这一次没读到」，不是「那里什么都没有」。
 * - **上界按条数给**：一条 join 资料随会话长度增长，不设界会在长时间开着的 host 里越攒越大。
 */
const joinCache = new Map<string, SessionJoin>()
const JOIN_CACHE_MAX = 8

/** 该会话日志的变更令牌；读不到（旧宿主、stat 不支持）时为 null。 */
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

/**
 * 一组事件 → join 资料（纯函数，无 I/O）。生产路径由 {@link sessionJoin} 调它并按日志
 * revision 缓存结果；测试与预览台直接拿事件算，不必假造一个持久化后端。
 */
export function joinOfEvents(sessionId: string, events: readonly SessionEventLike[]): SessionJoin {
  let first = Number.POSITIVE_INFINITY
  let last = Number.NEGATIVE_INFINITY
  const labels = new Map<string, string>()
  for (const event of events) {
    if (Number.isFinite(event.time)) {
      if (event.time < first) first = event.time
      if (event.time > last) last = event.time
    }
    // 父会话目录里的创建标签：子代理那一行靠它显示「是哪个子代理」，不必再读子会话日志。
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

/** 日志的 join 资料：该会话日志读一次、按 revision 记住。 */
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
      // 命中即把这一条挪到末尾（Map 的迭代序就是 LRU 序）。
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

/**
 * 一个直接子代理连同它自己派出的下级。子树里的会话 id 只挂在**一个**直接子代理下：
 * 报数按这棵树分组，读者把各行的数加起来正好是下一段那一个合计，不会重复。
 */
interface SubagentBranch {
  id: string
  tree: readonly string[]
}

/**
 * 从会话清单折出本会话的直接子代理与各自的整棵子树。只认 `origin === 'subagent'`：
 * `parentSession` 也是 fork 血缘，手动 fork 的会话带它却不是子代理（见 SessionLineageLike）。
 * 环（畸形血缘）由 `seen` 挡住，不会把遍历挂死。
 */
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

/**
 * 本会话的「子代理」一段：直接子代理各占一行、含自己的整棵子树，一段另给合计。
 * token 与钱都只取账本行——子代理是**独立的 sessionId**，所以它们的行不在主会话的
 * `total` 里；这里按血缘把它们折成一段，**不并进抬头合计**（那会让抬头与按轮次明细对不上）。
 *
 * 读不到会话清单时返回 undefined：那是「不知道有没有下级」，不是「没有」。
 */
function subagentsOf(input: SessionUsageInput, labels: ReadonlyMap<string, string>): SessionSubagentsView | undefined {
  const sessions = input.sessions
  if (sessions === undefined || sessions.length === 0) return undefined
  const branches = subagentBranches(sessions, input.sessionId)
  if (branches.length === 0) return undefined

  // 一条账本行只归一个直接子代理的子树：按 sessionId 建好归属表，再扫一遍全部记录。
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
    // 次数与四桶走 summarizeRecords，与主会话 totals 是同一条口径（失败不计入 requests、
    // 缺 usage 的行单独计 usageUnknown）。
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
  // 花的多的排前面：「哪个子代理重」正是这一段要回答的问题。
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

/** 把一个会话的账本记录折成视图。分组规则见 docs/CONTEXT.md：压缩归轮间（不硬塞
 *  进某一轮），失败行按自己身份里的回合号进组，join 不上的行进 `unattributed`
 *  ——「轮次未知」与「轮间」分列。
 *
 *  join 资料由调用方经 {@link sessionJoin} 备好（按日志 revision 缓存），这里只做纯折叠：
 *  同一份日志的第二次读因此不再解压 / 解析整份日志。 */
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
 * 跨度会把「最后一句话之后挂了几小时」全丢掉。首末时刻来自 `join.span`（读日志时一并
 * 量好并按 revision 缓存），所以重读一次这一页不必再扫一遍日志。
 *
 * 日志读不到时**两个都缺席**：那时候一行都没计时，工作量会是 0，而「0秒」在此正是
 * 「不知道」被印成了「没花时间」（同「用量未知 ≠ 0」，见 docs/CONTRACTS.md §2）。
 */
function spanOf(
  span: { first: number; last: number } | null,
  rows: readonly SessionStepRow[],
): { spanMs?: number; workMs?: number } {
  if (span === null) return {}
  const { llmMs, toolMs } = settleTiming(rows)
  const timed = rows.some((row) => row.timing !== undefined)
  const elapsed = span.last >= span.first ? { spanMs: span.last - span.first } : {}
  // 一行都没计时就不报工作量：那 0 是「量不到」，不是「没花时间」。
  return timed ? { ...elapsed, workMs: llmMs + toolMs } : elapsed
}
