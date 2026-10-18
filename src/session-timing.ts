import type { StepTiming } from './types.ts'
import { type SessionEventLike, recordFromCompaction } from './usage-record.ts'

export function countOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

interface Anchors {
  start: number
  end?: number
  message?: number
  outputTokens?: number
  firstToken?: number
  spans: { start: number; end: number; name: string }[]
}

function stepKeyOf(event: SessionEventLike): string | undefined {
  const turn = countOf(event.data?.turn)
  const step = countOf(event.data?.step)
  if (turn === undefined || step === undefined) return undefined
  return `${String(turn)}:${String(step)}`
}

function isTokenDelta(chunk: unknown): boolean {
  if (typeof chunk !== 'object' || chunk === null) return false
  const value = chunk as { type?: unknown; text?: unknown; argumentsDelta?: unknown; name?: unknown }
  switch (value.type) {
    case 'text-delta':
    case 'reasoning-delta': return value.text !== ''
    case 'tool-call-delta': return value.argumentsDelta !== '' || value.name !== undefined
    default: return false
  }
}

function runFirstToken(run: { type?: unknown; time0?: unknown; dt?: unknown; texts?: unknown; args?: unknown; name?: unknown }): number | undefined {
  const time0 = countOf(run.time0)
  if (time0 === undefined) return undefined
  if (run.type === 'tool-call-chunks' && run.name !== undefined) return time0
  const fragments = run.type === 'tool-call-chunks' ? run.args : run.texts
  const dt = run.dt
  if (!Array.isArray(fragments) || !Array.isArray(dt)) return undefined
  let time = time0
  for (let index = 0; index < fragments.length; index += 1) {
    if (index > 0) {
      const delta = countOf(dt[index - 1])
      if (delta === undefined) return undefined
      time += delta
    }
    if (fragments[index] !== '') return time
  }
  return undefined
}

function streamFirstToken(stream: unknown): number | undefined {
  if (!Array.isArray(stream)) return undefined
  for (const record of stream) {
    if (typeof record !== 'object' || record === null) continue
    const item = record as { type?: unknown; time?: unknown; chunk?: unknown }
    const time = item.type === 'chunk'
      ? (isTokenDelta(item.chunk) ? countOf(item.time) : undefined)
      : runFirstToken(record as Parameters<typeof runFirstToken>[0])
    if (time !== undefined) return time
  }
  return undefined
}

function outputTokensOf(usage: unknown): number | undefined {
  if (typeof usage !== 'object' || usage === null) return undefined
  const value = (usage as { outputTokens?: unknown }).outputTokens
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function anchorsOf(event: SessionEventLike, into: Map<string, Anchors>): void {
  const key = stepKeyOf(event)
  if (key === undefined) return
  const data = event.data
  switch (event.type) {
    case 'step/start': {
      into.set(key, { start: event.time, spans: [] })
      return
    }
    case 'step/end': {
      const anchors = into.get(key)
      if (anchors !== undefined && anchors.end === undefined) anchors.end = event.time
      return
    }
    case 'assistant/attempt': {
      const anchors = into.get(key)
      const first = streamFirstToken(data?.stream)
      if (anchors !== undefined && anchors.firstToken === undefined && first !== undefined) anchors.firstToken = first
      return
    }
    case 'assistant/message': {
      const anchors = into.get(key)
      if (anchors === undefined) return
      anchors.message = event.time
      anchors.outputTokens = outputTokensOf(data?.usage)
      if (anchors.firstToken === undefined) anchors.firstToken = streamFirstToken(data?.stream)
      return
    }
    default: return
  }
}

export interface SessionTimingIndex {
  steps: ReadonlyMap<string, StepTiming>
  compactions: ReadonlyMap<string, number>
}

const EMPTY_TIMING: SessionTimingIndex = { steps: new Map(), compactions: new Map() }

export function timingIndexOf(sessionId: string, events: readonly SessionEventLike[]): SessionTimingIndex {
  const anchors = new Map<string, Anchors>()
  const calls = new Map<string, { time: number; name: string; key: string | undefined }>()
  const compactions = new Map<string, number>()
  const compStarted = new Map<string, number>()

  for (const event of events) {
    if (event.type === 'tool/call' || event.type === 'tool/result') {
      const callId = event.type === 'tool/call' ? event.data?.callId : event.data?.message?.source.callId
      if (typeof callId !== 'string' || callId === '') continue
      if (event.type === 'tool/call') {
        calls.set(callId, { time: event.time, name: event.data?.name ?? '', key: stepKeyOf(event) })
        continue
      }
      const call = calls.get(callId)
      if (call === undefined) continue
      calls.delete(callId)
      const step = call.key === undefined ? undefined : anchors.get(call.key)
      if (step !== undefined && event.time >= call.time) {
        step.spans.push({ start: call.time, end: event.time, name: call.name })
      }
      continue
    }
    if (event.type === 'compaction/start') {
      const id = event.data?.compactionId
      if (typeof id === 'string' && id !== '') compStarted.set(id, event.time)
      continue
    }
    if (event.type === 'compaction/summary') {
      const id = event.data?.compactionId
      const start = typeof id === 'string' ? compStarted.get(id) : undefined
      if (start === undefined) continue
      compactions.set(recordFromCompaction(event, sessionId).requestId, Math.max(0, event.time - start))
      continue
    }
    anchorsOf(event, anchors)
  }

  const steps = new Map<string, StepTiming>()
  for (const [key, stepAnchors] of anchors) {
    const timing = finishStep(stepAnchors)
    if (timing !== undefined) steps.set(key, timing)
  }
  return steps.size === 0 && compactions.size === 0 ? EMPTY_TIMING : { steps, compactions }
}

function finishStep(anchors: Anchors): StepTiming | undefined {
  const { start, end, message, firstToken } = anchors
  const spans = end === undefined ? anchors.spans : anchors.spans.filter((span) => span.end <= end)
  const timing: StepTiming = {}
  if (end !== undefined) timing.wallMs = Math.max(0, end - start)
  if (message !== undefined) timing.llmMs = Math.max(0, message - start)
  if (firstToken !== undefined) {
    timing.ttftMs = Math.max(0, firstToken - start)
    if (message !== undefined && anchors.outputTokens !== undefined) {
      timing.decodeMs = Math.max(0, message - firstToken)
    }
  }
  if (spans.length > 0) {
    let low = spans[0]!.start
    let high = spans[0]!.end
    let slow = spans[0]!
    for (const span of spans) {
      if (span.start < low) low = span.start
      if (span.end > high) high = span.end
      if (span.end - span.start > slow.end - slow.start) slow = span
    }
    timing.toolMs = high - low
    timing.toolCalls = spans.length
    timing.slowTool = { name: slow.name, ms: slow.end - slow.start }
  }
  return Object.keys(timing).length === 0 ? undefined : timing
}
