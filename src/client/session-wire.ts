/**
 * 会话词元页的 **wire → 视图** 反序列化。
 *
 * `GET /tokbook/session` 回的是 JSON，这一页要的 `SessionUsageView` 是带类型的——字段
 * 缺一个就填一个中性值，让渲染层不必到处判 undefined（`usage` 缺席本身就是「用量未知」
 * 这件事，口径见 docs/CONTRACTS.md §2）。
 *
 * 这一层**不碰 React、不碰 fetch、不碰缓存**：它只把 `unknown` 折成结构化的读数。
 * 拆出来有两个理由——一是 `SessionTokens.tsx` 里它与组件和轮询逻辑挤在一起，读这一页的
 * 数据形状得先在脑子里跳过那 80 行 effect；二是它是纯函数，`smoke.ts` 可以直接对它
 * 断言（「坏字段不炸、缺字段填中性值、`turn === null` 的轮间不进轮次序列」），现在它被
 * export 之外的东西包着，一条都测不了。
 *
 * 唯一对外出口是 `readSessionView`。`num` 也放这里——它的 doc 就是「账本数字一律当不可信
 * 的 wire 读」，它是 wire 层的工具，不是展示层的。
 */

import type {
  SessionStepRow, SessionSubagentRow, SessionSubagentsView, SessionUsageGroup, SessionUsageView, StepTiming, UsageTotals,
} from '../types.ts'

/** 账本数字一律当**不可信**的 wire 读：缺字段时这一页仍要画出来（空白不报错，也不显示 NaN）。 */
export function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** 时长读成非负有限数；其余（负数、NaN、缺字段）一律当没量到。 */
function optionalMs(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** 一页读数的入口。`raw` 是 `GET /tokbook/session` 的响应体，形状不保证。 */
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

/**
 * 「子代理」一段。一段的存在与否是**事实**：宿主读不到血缘时整格缺席（旧 host / 独立查看器），
 * 客户端不能把它填成「0 个子代理」——那是把「不知道」印成「没有」。所以缺字段 / 形状不合法
 * 一律返回 undefined，而不是一份空视图。
 */
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

/**
 * 一行账本。**只认 requestId 是字符串**的那一半（它是去重键、也是 React 的 key）；其余字段
 * 缺一个就填一个中性值，让渲染层不必到处判 undefined。`usage` 保留原样——它缺席本身就是
 * 「用量未知」这件事（口径见 docs/CONTRACTS.md §2）。
 */
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

/**
 * 一行用时。每一段都是「有就报、没有就不报」——缺席在这里读作 `undefined`，渲染成
 * 「未计时」而不是 0s（口径同「用量未知 ≠ 0」，见 docs/CONTRACTS.md §2）。
 */
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