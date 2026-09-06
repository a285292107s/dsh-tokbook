/**
 * Pure record vocabulary of the token-book: the JSONL row type, its
 * projections from session events (assistant messages, compaction summaries,
 * turn-ending LLM failures, and retried failed attempts), and lenient line
 * parsing for the dedupe scan. No I/O, so every consumer shares one wire
 * format.
 *
 * @module dsh-tokbook/usage-record
 */

import type { UsageFields, UsageRecord, UsageRecordKind } from './types.ts'

// Minimal session-event faces (see host WIRE NOTES). Kept local so the
// external package compiles against `@deepseek-ai/cordis` only.
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
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Project the event's optional provider usage into the base buckets. A
 * missing record or an invalid required bucket renders the whole usage
 * absent: the row still records the request, but its numbers are not trusted. */
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

/** Build the log row for one `assistant/message` session event. */
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

/** Build the log row for one `compaction/summary` event. The summarize
 * provider call is billed exactly like a plain request. A missing or invalid
 * usage renders the record null (unusable for pricing). */
export function recordFromCompaction(event: SessionEventLike, sessionId: string): UsageRecord | null {
  const usage = projectUsage(event.data?.usage)
  if (usage === undefined) return null
  return {
    requestId: `compaction:${sessionId}:${String(event.seq)}`,
    time: event.time,
    sessionId,
    model: event.data!.model ?? '',
    ...(event.data!.provider !== undefined ? { provider: event.data!.provider } : {}),
    usage,
    kind: 'compaction',
  }
}

/** Build the row for one failed provider attempt (shared by a terminal
 * `turn/end` error and an `llm/retry`). */
function failureRow(
  event: { seq: number; time: number },
  sessionId: string,
  model: string,
  code: string | undefined,
): UsageRecord {
  return {
    requestId: `failure:${sessionId}:${String(event.seq)}`,
    time: event.time,
    sessionId,
    model,
    kind: 'failure',
    ...(code !== undefined && code !== '' ? { failureCode: code } : {}),
  }
}

/** Build the log row for one `turn/end` event whose reason is an LLM error. */
export function recordFromTurnEnd(
  event: SessionEventLike,
  sessionId: string,
  model: string,
): UsageRecord | null {
  if (event.data?.reason?.kind !== 'error') return null
  return failureRow(event, sessionId, model, event.data.reason.error?.code)
}

/** Build the log row for one `llm/retry` event — a provider attempt that
 * failed and that the retry plugin scheduled another try for. */
export function recordFromRetry(
  event: SessionEventLike,
  sessionId: string,
  model: string,
): UsageRecord {
  return failureRow(event, sessionId, model, event.data?.failure?.code)
}

/** Project one session event into a log row, or null when it is not a
 * recorded origin. `lastModel` is a session's last-known route (failure rows
 * name no model of their own). */
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

/** The model id an event reveals about the session's current route. */
export function modelOfEvent(event: SessionEventLike): string | undefined {
  if (event.type === 'request/context') return event.data?.model
  if (event.type === 'assistant/message') return event.data?.message?.source.model
  return undefined
}

/** The provider an event reveals about the session's current route. `llm/retry`
 * names its provider itself, so a failed attempt is attributed directly. */
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

/** Coerce an unknown value into a record, normalizing extra fields and null
 * buckets to omission. */
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

/** Parse one JSONL line back into a record, or null when the line is invalid. */
export function parseRecord(line: string): UsageRecord | null {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  return coerceRecord(value)
}

/** Serialize one record to a JSONL line (no trailing newline). */
export function serializeRecord(record: UsageRecord): string {
  return JSON.stringify(record)
}

export type { UsageRecordKind }
