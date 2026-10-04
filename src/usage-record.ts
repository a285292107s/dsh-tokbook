/**
 * token-book 的纯记录词汇：JSONL 行类型、从会话事件的投影（assistant 消息、
 * compaction summary、turn 结束的 LLM 失败、重试的失败尝试），以及供去重扫描
 * 使用的宽松行解析。无 I/O，所有消费方共享同一 wire 格式。
 *
 * **行身份必须是跨格式稳定的事实**，因为会话日志的格式迁移会稠密重排信封
 * `seq`：assistant 消息用 `message.id`；压缩用事件自带的 `compactionId`；
 * 失败用 `turn`（一个回合只关一次）或 `retryId` + 第几次。只有畸形/旧形态
 * 缺这些字段时才回落到 `seq`——同一事件被两个身份记成两行正是这么来的。
 */

import type { UsageFields, UsageRecord, UsageRecordKind } from './types.ts'

// 最小的会话事件面（见 host WIRE NOTES）。本地声明，使本外部包只针对
// `@deepseek-ai/cordis` 编译。
export interface TokenUsageLike {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export interface SessionEventLike {
  readonly type: string
  readonly time: number
  readonly seq: number
  readonly data?: {
    usage?: TokenUsageLike
    model?: string
    message?: {
      id: string
      source: { provider?: string; model: string }
    }
    provider?: string
    source?: { provider?: string; model: string }
    reason?: { kind: string; error?: { code?: string } }
    failure?: { code?: string }
    /** 压缩调用自带的稳定身份。 */
    compactionId?: string
    /** 一次重试尝试的身份：`retryId` 标定这次重试，`retry` 是它的第几次。 */
    retryId?: string
    retry?: number
    /** `turn/end` 关闭的回合号——一个回合只关一次。 */
    turn?: number
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** 事件自带的稳定 id（非空字符串才算），否则 undefined。 */
function stableId(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function failureKey(sessionId: string, event: { seq: number }, discriminator: string | undefined): string {
  return discriminator !== undefined
    ? `failure:${sessionId}:${discriminator}`
    : `failure:${sessionId}:${String(event.seq)}`
}

/** 把事件的可选 provider usage 投影为基础桶。usage 缺失，或必需桶非法时，
 * 整份 usage 视为缺席：行仍记下请求，但其数字不可信。 */
export function projectUsage(usage: TokenUsageLike | undefined): UsageFields | undefined {
  if (usage === undefined) return undefined
  if (!isCount(usage.inputTokens) || !isCount(usage.outputTokens)) return undefined
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    ...(isCount(usage.cacheReadTokens) ? { cacheReadTokens: usage.cacheReadTokens } : {}),
    ...(isCount(usage.cacheWriteTokens) ? { cacheWriteTokens: usage.cacheWriteTokens } : {}),
  }
}

/** 为一条 `assistant/message` 会话事件构建日志行。 */
export function recordFromMessage(event: SessionEventLike, sessionId: string): UsageRecord {
  const usage = projectUsage(event.data?.usage)
  return {
    requestId: event.data!.message!.id,
    time: event.time,
    sessionId,
    model: event.data!.message!.source.model,
    ...(event.data!.message!.source.provider !== undefined
      ? { provider: event.data!.message!.source.provider } : {}),
    ...(usage !== undefined ? { usage } : {}),
  }
}

/** 为一条 `compaction/summary` 事件构建日志行。summarize 的 provider 调用与普通
 *  请求同价计费；usage 缺失或非法时**仍写行**、只欠桶，「用量未知 ≠ 0」的口径见
 *  docs/CONTRACTS.md §2。 */
export function recordFromCompaction(event: SessionEventLike, sessionId: string): UsageRecord {
  const usage = projectUsage(event.data?.usage)
  const compactionId = stableId(event.data?.compactionId)
  return {
    requestId: `compaction:${sessionId}:${compactionId ?? String(event.seq)}`,
    time: event.time,
    sessionId,
    model: event.data!.model ?? '',
    ...(event.data!.provider !== undefined ? { provider: event.data!.provider } : {}),
    ...(usage !== undefined ? { usage } : {}),
    kind: 'compaction',
  }
}

/** 一次失败尝试身份行（turn/end 的终止错误与 `llm/retry` 共用）。 */
function failureRow(
  event: { seq: number; time: number },
  sessionId: string,
  model: string,
  code: string | undefined,
  discriminator: string | undefined,
): UsageRecord {
  return {
    requestId: failureKey(sessionId, event, discriminator),
    time: event.time,
    sessionId,
    model,
    kind: 'failure',
    ...(code !== undefined && code !== '' ? { failureCode: code } : {}),
  }
}

/** 为 reason 是 LLM 错误的 `turn/end` 事件构建日志行；身份用 `turn`。 */
export function recordFromTurnEnd(
  event: SessionEventLike,
  sessionId: string,
  model: string,
): UsageRecord | null {
  if (event.data?.reason?.kind !== 'error') return null
  const turn = event.data.turn
  return failureRow(
    event,
    sessionId,
    model,
    event.data.reason.error?.code,
    isCount(turn) ? `turn:${String(turn)}` : undefined,
  )
}

/** 为一条 `llm/retry` 事件构建日志行——一次已失败、且 retry 插件已安排重试的
 *  provider 尝试。 */
export function recordFromRetry(
  event: SessionEventLike,
  sessionId: string,
  model: string,
): UsageRecord {
  const retryId = stableId(event.data?.retryId)
  const retry = event.data?.retry
  const discriminator = retryId === undefined
    ? undefined
    : isCount(retry) ? `retry:${retryId}:${String(retry)}` : `retry:${retryId}`
  return failureRow(event, sessionId, model, event.data?.failure?.code, discriminator)
}

/** 把一条会话事件投影成日志行；不是已记录的来源时为 null。`lastModel` 是会话
 *  最近已知的 route（失败行不自带 model）。
 *
 *  **已知缺口（故意不实现）**：`assistant/attempt` 这一形态当前不投影。所以「只把 usage
 *  放在 attempt 的 stream 上报」的那种**失败尝试不会入账**；一次 attempt 既没有安排重试
 *  （没有 `llm/retry`）也没有以 error 收尾（没有 `reason.kind === 'error'` 的 `turn/end`）
 *  时，当前一行都不写。正确实现需要按 retry 生命周期折叠尝试（把 attempt 与它的重试 /
 *  终止事件配对），不是在这里补一个 case 就够，故留作后续——别把这条注释读成「已支持」。 */
export function recordOfEvent(
  event: SessionEventLike,
  sessionId: string,
  lastModel: string,
  recordCompaction = true,
): UsageRecord | null {
  switch (event.type) {
    case 'assistant/message':
      return recordFromMessage(event, sessionId)
    case 'compaction/summary':
      return recordCompaction ? recordFromCompaction(event, sessionId) : null
    case 'turn/end':
      return recordFromTurnEnd(event, sessionId, lastModel)
    case 'llm/retry':
      return recordFromRetry(event, sessionId, lastModel)
    default:
      return null
  }
}

/** 事件揭示的会话当前 route 的 model id。 */
export function modelOfEvent(event: SessionEventLike): string | undefined {
  if (event.type === 'request/context') return event.data?.model
  if (event.type === 'assistant/message') return event.data?.message?.source.model
  return undefined
}

/** 事件揭示的会话当前 route 的 provider。`llm/retry` 自带 provider，因此失败
 *  尝试可直接归属。 */
export function providerOfEvent(event: SessionEventLike): string | undefined {
  if (event.type === 'request/context') return event.data?.provider
  if (event.type === 'assistant/message') return event.data?.message?.source.provider
  if (event.type === 'llm/retry') return event.data?.provider
  return undefined
}

function normalizeCount(value: unknown): number | undefined {
  return isCount(value) ? value : undefined
}

function isUsageFields(value: unknown): value is UsageFields {
  if (typeof value !== 'object' || value === null) return false
  const fields = value as Record<string, unknown>
  return isCount(fields.inputTokens) && isCount(fields.outputTokens)
}

function isRecord(value: unknown): value is UsageRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.requestId === 'string'
    && isCount(record.time)
    && typeof record.sessionId === 'string'
    && typeof record.model === 'string'
    && (record.usage === undefined || record.usage === null || isUsageFields(record.usage))
}

/** 把未知值强制成记录，多余字段与 null 桶归一为省略。 */
export function coerceRecord(value: unknown): UsageRecord | null {
  if (!isRecord(value)) return null
  const record = value as unknown as Record<string, unknown>
  const isFailure = record.kind === 'failure'
  const kind = record.kind === 'compaction' ? { kind: 'compaction' as const }
    : isFailure ? { kind: 'failure' as const }
      : {}
  const failureCode = isFailure && typeof record.failureCode === 'string' && record.failureCode !== ''
    ? { failureCode: record.failureCode } : {}
  const provider = typeof record.provider === 'string' && record.provider !== ''
    ? { provider: record.provider } : {}
  if (record.usage === undefined || record.usage === null) {
    return {
      requestId: record.requestId as string,
      time: record.time as number,
      sessionId: record.sessionId as string,
      model: record.model as string,
      ...kind,
      ...failureCode,
      ...provider,
    }
  }
  const fields = record.usage as Record<string, unknown>
  const cacheRead = normalizeCount(fields.cacheReadTokens)
  const cacheWrite = normalizeCount(fields.cacheWriteTokens)
  return {
    requestId: record.requestId as string,
    time: record.time as number,
    sessionId: record.sessionId as string,
    model: record.model as string,
    ...kind,
    ...failureCode,
    ...provider,
    usage: {
      inputTokens: fields.inputTokens as number,
      outputTokens: fields.outputTokens as number,
      ...(cacheRead !== undefined ? { cacheReadTokens: cacheRead } : {}),
      ...(cacheWrite !== undefined ? { cacheWriteTokens: cacheWrite } : {}),
    },
  }
}

/** 把一行 JSONL 解析回记录；行非法时为 null。 */
export function parseRecord(line: string): UsageRecord | null {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  return coerceRecord(value)
}

/** 把一条记录序列化为一行 JSONL（无尾换行）。 */
export function serializeRecord(record: UsageRecord): string {
  return JSON.stringify(record)
}

export type { UsageRecordKind }
