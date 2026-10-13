/**
 * 会话事件里的**用时**：把一步的墙钟拆成模型与工具两段，再补上首 token 与生成时长。
 *
 * 读法照搬宿主 `dsh-session-stats` 的同名折叠（`llmMs` / `ttftMs` / `decodeMs` / `toolMs`），
 * 只有一处不同：宿主的 `toolMs` 把步内每次配对**逐个相加**，这里取它们的**并集**——一步里
 * 几个工具调用可以并行，相加会把同一段墙钟数两遍（本机实测某会话因此虚高 7.75 倍）。
 *
 * 每段的起止事件：
 * - 墙钟 `step/start` → `step/end`
 * - 模型 `step/start` → `assistant/message`
 * - 首 token `step/start` → 流里第一个 token（**跨过**步内重试，所以它是距步骤开始）
 * - 生成 首个 token → `assistant/message`
 * - 工具 `tool/call` → `tool/result`，按 `callId` 配对，取并集
 *
 * 量不出来的一律**缺席**，不是 0：取消的步骤没有产出，重试耗尽的步骤没有产出、但墙钟还在。
 *
 * @module dsh-tokbook/session-timing
 */

import type { StepTiming } from './types.ts'
import { type SessionEventLike, recordFromCompaction } from './usage-record.ts'

/** 整数载荷读法。事件的 `turn` / `step` 都是整数；不是整数（含 `null`）就是没给。 */
export function countOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

/** 一步的计时锚点，按 `${turn}:${step}` 归位。 */
interface Anchors {
  start: number
  end?: number
  message?: number
  /** 模型这一步报的 output tokens；生成时长只在它可信时计入（同宿主）。 */
  outputTokens?: number
  /** 首个 token 的时刻。 */
  firstToken?: number
  spans: { start: number; end: number; name: string }[]
}

function stepKeyOf(event: SessionEventLike): string | undefined {
  const turn = countOf(event.data?.turn)
  const step = countOf(event.data?.step)
  if (turn === undefined || step === undefined) return undefined
  return `${String(turn)}:${String(step)}`
}

/** 一个流片段是不是模型产出的 token（宿主 `dsh-llm` 的 `isTokenDelta`）。块起止、usage、
 *  finish 都不是——把它们当首 token 会把延迟读成「块开始」，TTFT 系统性偏小。 */
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

/**
 * 打包段里第 n 个片段的时刻：整段只有 `time0` 与相邻差值 `dt`，所以只能从头累加出来。
 * 名字自带的工具调用段整段起于 `time0`（宿主 `runFirstTokenTime`）。
 */
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

/** 一条压缩流里首个 token 的时刻（宿主 `assistantStreamFirstTokenTime`）：读完就停。 */
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

/** output tokens 只在可信时才让生成时长入账（同宿主 `usageOutputTokens`）。 */
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
      // 收尾事件是墙钟的右端。它在 `finally` 里落，所以完成 / 失败 / 取消 / 触顶的步都有它；
      // 没有它的步（进程被打断）量不出墙钟，那就是「未计时」。
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

/** 记账本行要用的用时索引。 */
export interface SessionTimingIndex {
  /** `${turn}:${step}` → 这一步的用时；没量到任何一段的步不在表里。 */
  steps: ReadonlyMap<string, StepTiming>
  /** 账本 requestId → 这次压缩 provider 调用的墙钟（`compaction/start` → `compaction/summary`）。 */
  compactions: ReadonlyMap<string, number>
}

const EMPTY_TIMING: SessionTimingIndex = { steps: new Map(), compactions: new Map() }

/** 从该会话的日志里量出每一步的用时。事件里没有的锚点就是不量，绝不拿邻近的事件顶替。 */
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
      // 身份不在这里重推：复用写入侧的投影，两条规则分叉即错。
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

/** 锚点折成一步的用时。一段都量不出来时返回 undefined——那一步是「未计时」，不是 0。 */
function finishStep(anchors: Anchors): StepTiming | undefined {
  const { start, end, message, firstToken } = anchors
  // 配对的工具调用不得越过这一步的收尾：会话被挂起再续上时，结果可能几天后才落盘。
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
    // 并集：并行调用的重叠段只算一次（见文件头）。
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
