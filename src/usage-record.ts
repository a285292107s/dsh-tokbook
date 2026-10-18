import type { UsageFields, UsageRecord, UsageRecordKind } from './types.ts'

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
      source: { provider?: string; model: string; callId?: string }
    }
    provider?: string
    source?: { provider?: string; model: string }
    reason?: { kind: string; error?: { code?: string } }
    failure?: { code?: string }
    compactionId?: string
    retryId?: string
    retry?: number
    turn?: number
    step?: number
    callId?: string
    name?: string
    stream?: readonly unknown[]
    childId?: string
    label?: string
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function stableId(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function failureKey(sessionId: string, event: { seq: number }, discriminator: string | undefined): string {
  return discriminator !== undefined
    ? `failure:${sessionId}:${discriminator}`
    : `failure:${sessionId}:${String(event.seq)}`
}

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

export function modelOfEvent(event: SessionEventLike): string | undefined {
  if (event.type === 'request/context') return event.data?.model
  if (event.type === 'assistant/message') return event.data?.message?.source.model
  return undefined
}

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

export function parseRecord(line: string): UsageRecord | null {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  return coerceRecord(value)
}

export function serializeRecord(record: UsageRecord): string {
  return JSON.stringify(record)
}

export type { UsageRecordKind }
