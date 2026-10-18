import type {
  SessionStepRow, SessionSubagentRow, SessionSubagentsView, SessionUsageGroup, SessionUsageView, StepTiming, UsageTotals,
} from '../types.ts'

export function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function optionalMs(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

export function readSessionView(raw: unknown): SessionUsageView | null {
  if (typeof raw !== 'object' || raw === null) return null
  const source = raw as Partial<SessionUsageView>
  return {
    sessionId: typeof source.sessionId === 'string' ? source.sessionId : '',
    updatedAt: num(source.updatedAt),
    firstAt: num(source.firstAt),
    lastAt: num(source.lastAt),
    total: readTotals(source.total),
    totalTokens: num(source.totalTokens),
    spend: num(source.spend),
    subscriptionValue: num(source.subscriptionValue),
    unpriced: Array.isArray(source.unpriced)
      ? source.unpriced.filter((key): key is string => typeof key === 'string')
      : [],
    turns: readGroups(source.turns).filter((group) => group.turn !== null),
    betweenTurns: readGroup(source.betweenTurns),
    unattributed: readRows(source.unattributed),
    todaySpend: num(source.todaySpend),
    spanMs: optionalMs(source.spanMs),
    workMs: optionalMs(source.workMs),
    subagents: readSubagents(source.subagents),
  }
}

function readSubagents(raw: unknown): SessionSubagentsView | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const source = raw as Partial<SessionSubagentsView>
  const rows: SessionSubagentRow[] = []
  if (Array.isArray(source.rows)) {
    for (const item of source.rows) {
      if (typeof item !== 'object' || item === null) continue
      const row = item as Partial<SessionSubagentRow>
      if (typeof row.sessionId !== 'string' || row.sessionId === '') continue
      rows.push({
        sessionId: row.sessionId,
        label: typeof row.label === 'string' ? row.label : '',
        tokens: num(row.tokens),
        requests: num(row.requests),
        failures: num(row.failures),
        usageUnknown: num(row.usageUnknown),
        spend: num(row.spend),
        subscriptionValue: num(row.subscriptionValue),
        priced: row.priced === true,
        descendants: num(row.descendants),
      })
    }
  }
  if (rows.length === 0) return undefined
  return {
    count: num(source.count),
    totalTokens: num(source.totalTokens),
    spend: num(source.spend),
    subscriptionValue: num(source.subscriptionValue),
    usageUnknown: num(source.usageUnknown),
    failures: num(source.failures),
    unpriced: Array.isArray(source.unpriced)
      ? source.unpriced.filter((key): key is string => typeof key === 'string')
      : [],
    rows,
  }
}

function readTotals(raw: unknown): UsageTotals {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<UsageTotals>
  return {
    requests: num(source.requests),
    inputTokens: num(source.inputTokens),
    outputTokens: num(source.outputTokens),
    cacheReadTokens: num(source.cacheReadTokens),
    cacheWriteTokens: num(source.cacheWriteTokens),
    compactions: num(source.compactions),
    failures: num(source.failures),
    usageUnknown: num(source.usageUnknown),
  }
}

function readGroups(raw: unknown): SessionUsageGroup[] {
  if (!Array.isArray(raw)) return []
  const groups: SessionUsageGroup[] = []
  for (const item of raw) {
    const group = readGroup(item)
    if (group !== null) groups.push(group)
  }
  return groups
}

function readGroup(raw: unknown): SessionUsageGroup | null {
  if (typeof raw !== 'object' || raw === null) return null
  const source = raw as Partial<SessionUsageGroup>
  return {
    turn: typeof source.turn === 'number' ? source.turn : null,
    totals: readTotals(source.totals),
    tokens: num(source.tokens),
    spend: num(source.spend),
    subscriptionValue: num(source.subscriptionValue),
    rows: readRows(source.rows),
  }
}

function readRows(raw: unknown): SessionStepRow[] {
  if (!Array.isArray(raw)) return []
  const rows: SessionStepRow[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const source = item as Partial<SessionStepRow>
    if (typeof source.requestId !== 'string') continue
    const bucket = source.bucket === 'subscription' || source.bucket === 'unpriced' ? source.bucket : 'spend'
    rows.push({
      requestId: source.requestId,
      time: num(source.time),
      model: typeof source.model === 'string' ? source.model : '',
      provider: typeof source.provider === 'string' ? source.provider : '',
      kind: source.kind,
      failureCode: source.failureCode,
      usage: source.usage,
      tokens: num(source.tokens),
      step: typeof source.step === 'number' ? source.step : undefined,
      timing: readTiming(source.timing),
      bucket,
      cost: num(source.cost),
    })
  }
  return rows
}

function readTiming(raw: unknown): StepTiming | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const source = raw as Partial<StepTiming>
  const timing: StepTiming = {}
  const wall = optionalMs(source.wallMs)
  const llm = optionalMs(source.llmMs)
  const ttft = optionalMs(source.ttftMs)
  const decode = optionalMs(source.decodeMs)
  const tool = optionalMs(source.toolMs)
  if (wall !== undefined) timing.wallMs = wall
  if (llm !== undefined) timing.llmMs = llm
  if (ttft !== undefined) timing.ttftMs = ttft
  if (decode !== undefined) timing.decodeMs = decode
  if (tool !== undefined) {
    timing.toolMs = tool
    timing.toolCalls = num(source.toolCalls)
  }
  const slow = readSlowTool(source.slowTool)
  if (slow !== undefined) timing.slowTool = slow
  return Object.keys(timing).length === 0 ? undefined : timing
}

function readSlowTool(raw: unknown): { name: string; ms: number } | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const source = raw as { name?: unknown; ms?: unknown }
  const ms = optionalMs(source.ms)
  if (ms === undefined) return undefined
  return { name: typeof source.name === 'string' ? source.name : '', ms }
}