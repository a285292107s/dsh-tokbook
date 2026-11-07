import { useState } from 'react'
import type { CSSProperties } from 'react'
import { settleTiming } from '../types.ts'
import type { SessionStepRow, SessionUsageGroup, StepTiming } from '../types.ts'
import { formatDateTime, formatDuration, formatMoney, formatTokens } from './format.ts'
import { num } from './session-wire.ts'
import { BUCKETS, hasPricedRow, type PreviewMap, type TurnPreview } from './session-shared.ts'
import {
  LEGEND_SHAPE, PHASE_LABEL, TimeBar, TimeReads, stepSegments, sumSegments, type TimeBarRead,
} from './session-timing.tsx'

interface BlockTotals {
  steps: number
  tokens: number
  spend: number
  subscriptionValue: number
  priced: boolean
  failures: number
  workMs?: number
}

function groupTotals(group: SessionUsageGroup): BlockTotals {
  return {
    steps: group.rows.length,
    tokens: group.tokens,
    spend: group.spend,
    subscriptionValue: group.subscriptionValue,
    priced: hasPricedRow(group.rows),
    failures: group.rows.filter((row) => row.kind === 'failure' || row.failureCode !== undefined).length,
    ...timedTotal(group.rows),
  }
}

function rowsTotals(rows: readonly SessionStepRow[]): BlockTotals {
  let tokens = 0
  let spend = 0
  let subscriptionValue = 0
  let failures = 0
  for (const row of rows) {
    tokens += num(row.tokens)
    if (row.bucket === 'subscription') subscriptionValue += num(row.cost)
    else if (row.bucket !== 'unpriced') spend += num(row.cost)
    if (row.kind === 'failure' || row.failureCode !== undefined) failures += 1
  }
  return {
    steps: rows.length,
    tokens,
    spend,
    subscriptionValue,
    priced: hasPricedRow(rows),
    failures,
    ...timedTotal(rows),
  }
}

function timedTotal(rows: readonly SessionStepRow[]): { workMs?: number } {
  if (!rows.some((row) => row.timing !== undefined)) return {}
  const shape = settleTiming(rows)
  return { workMs: shape.llmMs + shape.toolMs }
}

export function TurnBlocks({ turns, betweenTurns, unattributed, previews, providerLabels }: {
  turns: readonly SessionUsageGroup[]
  betweenTurns: SessionUsageGroup | null
  unattributed: readonly SessionStepRow[]
  previews: PreviewMap
  providerLabels?: Readonly<Record<string, string>>
}) {
  const labels = providerLabels ?? {}
  const [order, setOrder] = useState<TurnOrder>('oldest')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>())
  const ordered = order === 'newest' ? [...turns].reverse() : turns
  const turnScale = Math.max(1, ...[...turns, ...(betweenTurns === null ? [] : [betweenTurns])]
    .map((group) => groupTotals(group).workMs ?? 0))
  const toggle = (key: string): void => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  return (
    <section className="dtpl-tok-sec" aria-label="轮次明细">
      <div className="dtpl-tok-sec-h">
        <h2 className="dtpl-tok-sec-k">轮次明细</h2>
        <span className="dtpl-tok-order" role="group" aria-label="轮次排序">
          {TURN_ORDERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`dtpl-range-tab${order === entry.id ? ' dtpl-range-active' : ''}`}
              aria-pressed={order === entry.id}
              onClick={() => setOrder(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </span>
      </div>
      <div className="dtpl-tok-legend">
        {LEGEND_SHAPE.map((phase) => (
          <span className="dtpl-tok-legend-read" key={phase.kind}>
            <i className="dtpl-tok-legend-mark" data-kind={phase.kind} aria-hidden="true" />
            {phase.label}
          </span>
        ))}
        <span className="dtpl-tok-legend-model">
          <i className="dtpl-tok-legend-mark" data-kind="model" aria-hidden="true" />
          模型（拆不开）：通道没上报流，等与生成分不清
        </span>
        <span className="dtpl-tok-legend-say">块头那条有长度、按最重一轮归一；步骤尺铺满整行</span>
      </div>
      <div className="dtpl-tok-turns">
        {ordered.map((group) => (
          <TurnEntry
            key={turnKey(group.turn)}
            blockKey={turnKey(group.turn)}
            label={`第 ${String(group.turn)} 轮`}
            totals={groupTotals(group)}
            rows={group.rows}
            preview={group.turn === null ? undefined : previews.get(group.turn)}
            expanded={expanded}
            onToggle={toggle}
            turnScale={turnScale}
            providerLabels={labels}
          />
        ))}
        {betweenTurns !== null && (
          <TurnEntry
            blockKey={LOOSE_KEYS.between}
            label="轮间"
            note="确定不属于任何轮次的计费调用（目前只有压缩 summarize）"
            totals={groupTotals(betweenTurns)}
            rows={betweenTurns.rows}
            expanded={expanded}
            onToggle={toggle}
            turnScale={turnScale}
            providerLabels={labels}
          />
        )}
        {unattributed.length > 0 && (
          <TurnEntry
            blockKey={LOOSE_KEYS.unattributed}
            label="轮次未知"
            note="没能拿到轮次/步骤的账本行：会话日志读不到，或这一行没有对应的事件"
            totals={rowsTotals(unattributed)}
            rows={unattributed}
            expanded={expanded}
            onToggle={toggle}
            turnScale={turnScale}
            providerLabels={labels}
          />
        )}
      </div>
    </section>
  )
}

type TurnOrder = 'oldest' | 'newest'

const TURN_ORDERS: ReadonlyArray<{ id: TurnOrder; label: string }> = [
  { id: 'oldest', label: '最早在前' },
  { id: 'newest', label: '最新在前' },
]

const LOOSE_KEYS = { between: 'loose:between', unattributed: 'loose:unattributed' } as const

function turnKey(turn: number | null): string {
  return turn === null ? LOOSE_KEYS.between : `turn:${String(turn)}`
}

interface ModelLabel {
  text: string
  title: string
}

function routeWord(provider: string, labels: Readonly<Record<string, string>>): string {
  if (provider === '') return '通道未知'
  return labels[provider] ?? provider
}

function modelPairOf(row: SessionStepRow, labels: Readonly<Record<string, string>>): string {
  return `${routeWord(row.provider, labels)} / ${row.model === '' ? '模型未知' : row.model}`
}

function turnModelOf(rows: readonly SessionStepRow[], labels: Readonly<Record<string, string>>): ModelLabel {
  const pairs = new Set<string>()
  for (const row of rows) pairs.add(modelPairOf(row, labels))
  if (pairs.size === 0) return { text: '模型未知', title: '' }
  const [first] = pairs
  if (pairs.size === 1) return { text: first!, title: '' }
  return { text: `${first!} 等 ${String(pairs.size)} 个`, title: [...pairs].join(' · ') }
}

function moneyOf(totals: BlockTotals): { text: string; kind: 'spend' | 'subscription' | 'unpriced' } {
  if (!totals.priced) return { text: '价格未知', kind: 'unpriced' }
  if (totals.spend > 0 || totals.subscriptionValue === 0) return { text: formatMoney(totals.spend), kind: 'spend' }
  return { text: `${formatMoney(totals.subscriptionValue)} 订阅`, kind: 'subscription' }
}

function TurnEntry({ blockKey, label, totals, rows, preview, note, expanded, onToggle, turnScale, providerLabels }: {
  blockKey: string
  label: string
  totals: BlockTotals
  rows: readonly SessionStepRow[]
  preview?: TurnPreview
  note?: string
  expanded: ReadonlySet<string>
  onToggle: (key: string) => void
  turnScale: number
  providerLabels: Readonly<Record<string, string>>
}) {
  const open = expanded.has(blockKey)
  const columns = timingColumnsOf(rows)
  const phases = sumSegments(rows)
  const money = moneyOf(totals)
  const model = turnModelOf(rows, providerLabels)
  const waitMs = phases.find((phase) => phase.kind === 'wait')?.value ?? 0
  const generateMs = phases.find((phase) => phase.kind === 'generate')?.value ?? 0
  const waitOverGenerates = waitMs > generateMs
  const phaseReads: TimeBarRead[] = phases.map((phase) => ({
    key: phase.key,
    kind: phase.kind,
    label: PHASE_LABEL[phase.kind],
    value: formatDuration(phase.value),
    ...(waitOverGenerates && phase.kind === 'wait' ? { isOver: true } : {}),
  }))
  return (
    <div className="dtpl-tok-turn" data-open={open ? '' : undefined}>
      <button
        type="button"
        className="dtpl-tok-turn-h"
        aria-expanded={open}
        title={waitOverGenerates ? `${note === undefined ? '' : `${note}\n`}这一轮等首 token 比生成还久` : note}
        onClick={() => onToggle(blockKey)}
      >
        <span className="dtpl-tok-turn-k">{label}</span>
        <span className="dtpl-tok-turn-reads">
          <span><b>{totals.steps}</b> 步</span>
          <span><b>{formatTokens(totals.tokens)}</b> 词元</span>
          {totals.workMs !== undefined && <span>用时 <b>{formatDuration(totals.workMs)}</b></span>}
          {totals.failures > 0 && (
            <span className="dtpl-tok-turn-bad">失败 <b>{totals.failures}</b> 次</span>
          )}
          <span className="dtpl-tok-turn-model" title={model.title !== '' ? model.title : undefined}>{model.text}</span>
        </span>
        <span className="dtpl-tok-turn-money" data-kind={money.kind}>{money.text}</span>
        {phases.length > 0 && (
          <>
            <span className="dtpl-tok-turn-bar">
              <TimeBar tone="turn" scale={turnScale} segments={phases} />
            </span>
            <TimeReads reads={phaseReads} />
          </>
        )}
        {preview !== undefined && (preview.prompt !== '' || preview.response !== '') && (
          <span className="dtpl-tok-turn-preview">
            {preview.prompt !== '' && (
              <span className="dtpl-tok-turn-ask" title={preview.prompt}>{preview.prompt}</span>
            )}
            {preview.response !== '' && (
              <span className="dtpl-tok-turn-reply" title={preview.response}>{preview.response}</span>
            )}
          </span>
        )}
        {note !== undefined && <span className="dtpl-tok-turn-note">{note}</span>}
        <span className="dtpl-tok-turn-cue" aria-hidden="true">▾</span>
      </button>
      {rows.length > 0 && (
        <div className="dtpl-tok-steps" data-open={open}>
          <div className="dtpl-tok-steps-inner">
            {open && rows.map((row) => (
              <StepRow key={row.requestId} row={row} columns={columns} providerLabels={providerLabels} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const TIMING_METRICS: ReadonlyArray<{ key: 'llmMs' | 'ttftMs' | 'decodeMs' | 'toolMs'; label: string }> = [
  { key: 'llmMs', label: '模型' },
  { key: 'ttftMs', label: PHASE_LABEL.wait },
  { key: 'decodeMs', label: PHASE_LABEL.generate },
  { key: 'toolMs', label: PHASE_LABEL.tool },
]

function timingColumnsOf(rows: readonly SessionStepRow[]): { metrics: typeof TIMING_METRICS[number][]; speed: boolean } {
  const metrics = TIMING_METRICS.filter((metric) => rows.some((row) => row.timing?.[metric.key] !== undefined))
  const speed = rows.some((row) => speedOf(row) !== null)
  return { metrics, speed }
}

function speedOf(row: SessionStepRow): number | null {
  return tokensPerSecond(row.usage?.outputTokens, row.timing?.decodeMs)
}

function StepRow({ row, columns, providerLabels }: {
  row: SessionStepRow
  columns: { metrics: typeof TIMING_METRICS[number][]; speed: boolean }
  providerLabels: Readonly<Record<string, string>>
}) {
  const usage = row.usage
  const chip = chipOf(row)
  const segments = stepSegments(row.timing)
  return (
    <div className="dtpl-tok-step" title={stepDetail(row)}>
      <div className="dtpl-tok-step-id">
        <span className="dtpl-tok-step-no">
          {row.step === undefined ? '步骤未知' : `第 ${String(row.step)} 步`}
        </span>
        <span className="dtpl-tok-step-time">{formatDateTime(num(row.time))}</span>
        <span className="dtpl-tok-step-model">{modelPairOf(row, providerLabels)}</span>
        {chip !== null && <em className="dtpl-tok-chip" data-kind={chip.kind}>{chip.word}</em>}
      </div>
      <CostCell row={row} />
      <div className="dtpl-tok-step-read">
        <span className="dtpl-tok-step-buckets">
          {usage === undefined
            ? <span className="dtpl-tok-untimed">用量未知：通道没上报 usage</span>
            : BUCKETS.map((bucketOf) => (
              <span className="dtpl-tok-step-bk" key={bucketOf.key}>
                <span className="dtpl-tok-step-bk-k">{bucketOf.label}</span>
                <span className="dtpl-tok-step-bk-v">{formatTokens(num(usage[bucketOf.key]))}</span>
              </span>
            ))}
        </span>
        {segments.length > 0
          ? <span className="dtpl-tok-step-bar"><TimeBar segments={segments} tone="step" /></span>
          : (
            <span className="dtpl-tok-step-flat">
              {row.timing?.wallMs === undefined ? '未计时' : `无产出 · ${formatDuration(row.timing.wallMs)}`}
            </span>
          )}
      </div>
      <span className="dtpl-tok-step-timing">
        <StepTimingTable row={row} columns={columns} />
      </span>
    </div>
  )
}

function StepTimingTable({ row, columns }: {
  row: SessionStepRow
  columns: { metrics: typeof TIMING_METRICS[number][]; speed: boolean }
}) {
  const timing = row.timing
  const speed = speedOf(row)
  const cells = Math.max(1, columns.metrics.length + (columns.speed ? 1 : 0))
  const style = { '--dtpl-tok-cells': String(cells) } as CSSProperties
  if (timing?.llmMs === undefined) {
    const wall = timing?.wallMs
    return (
      <span className="dtpl-tok-metrics is-flat" style={style}>
        <span className="dtpl-tok-metric">
          <span className="dtpl-tok-metric-k">用时</span>
          <span className={wall === undefined ? 'dtpl-tok-metric-v dtpl-tok-untimed' : 'dtpl-tok-metric-v'}>
            {wall === undefined ? '未计时' : formatDuration(wall)}
          </span>
        </span>
        {wall !== undefined && (
          <span className="dtpl-tok-untimed is-note">无产出：这段墙钟耗在重试与退避上，没有模型那段可归属</span>
        )}
      </span>
    )
  }
  return (
    <span className="dtpl-tok-metrics" style={style}>
      {columns.metrics.map((metric) => {
        const value = timing[metric.key]
        return (
          <span className="dtpl-tok-metric" key={metric.key}>
            <span className="dtpl-tok-metric-k">{metric.label}</span>
            <span className={value === undefined ? 'dtpl-tok-metric-v dtpl-tok-untimed' : 'dtpl-tok-metric-v'}>
              {value === undefined ? '—' : formatDuration(value)}
            </span>
          </span>
        )
      })}
      {columns.speed && (
        <span className="dtpl-tok-metric">
          <span className="dtpl-tok-metric-k">tok/s</span>
          <span className={speed === null ? 'dtpl-tok-metric-v dtpl-tok-untimed' : 'dtpl-tok-metric-v'}>
            {speed === null ? '—' : String(speed)}
          </span>
        </span>
      )}
    </span>
  )
}

function CostCell({ row }: { row: SessionStepRow }) {
  const bucket = row.bucket === 'subscription' || row.bucket === 'unpriced' ? row.bucket : 'spend'
  const valueClass = bucket === 'unpriced' ? 'dtpl-tok-amt-na' : bucket === 'subscription' ? 'dtpl-tok-amt-sub' : 'dtpl-tok-amt'
  return (
    <span className="dtpl-tok-step-cost">
      <span className="dtpl-tok-step-cost-k">
        {bucket === 'unpriced' ? <>价格未知<i>按 ¥0 计</i></> : bucketWord(bucket)}
      </span>
      <span className={valueClass}>
        {bucket === 'unpriced' ? '—' : formatMoney(num(row.cost))}
      </span>
    </span>
  )
}

function bucketWord(bucket: 'spend' | 'subscription'): string {
  return bucket === 'subscription' ? '订阅价值' : '实际支出'
}

function tokensPerSecond(outputTokens: unknown, decodeMs: number | undefined): number | null {
  if (typeof outputTokens !== 'number' || !Number.isFinite(outputTokens) || outputTokens <= 0) return null
  if (decodeMs === undefined || decodeMs <= 0) return null
  const rate = outputTokens / (decodeMs / 1000)
  return rate >= 10 ? Math.round(rate) : Math.round(rate * 10) / 10
}

function chipOf(row: SessionStepRow): { kind: string; word: string } | null {
  if (row.kind === 'failure' || row.failureCode !== undefined) return { kind: 'failure', word: '失败' }
  if (row.kind === 'compaction') return { kind: 'compaction', word: '压缩' }
  return null
}

function stepDetail(row: SessionStepRow): string {
  const usage = row.usage
  return [
    row.step === undefined ? '步骤未知' : `第 ${String(row.step)} 步`,
    formatDateTime(num(row.time)),
    row.model === '' ? '模型未知' : row.model,
    ...(row.provider === '' ? [] : [`通道 ${row.provider}`]),
    usage === undefined
      ? '用量未知：通道没有上报 usage，这一次调用没有词元可加'
      : BUCKETS.map((bucket) => `${bucket.label} ${formatTokens(num(usage[bucket.key]))}`).join(' · '),
    `合计 ${formatTokens(num(row.tokens))} 词元`,
    row.bucket === 'unpriced'
      ? `价格未知：这一行按 ¥0 计（价表计不了 ${row.provider === '' ? '这条通道' : row.provider} 的这个模型）`
      : `金额 ${formatMoney(num(row.cost))} ${bucketWord(row.bucket)}`,
    ...(row.failureCode === undefined ? [] : [`失败码 ${row.failureCode}`]),
    ...timingDetail(row.timing),
  ].join('\n')
}

function timingDetail(timing: StepTiming | undefined): string[] {
  if (timing === undefined) return ['未计时：这一步没有可用的起止事件']
  const wall = timing.wallMs === undefined ? undefined : `用时 ${formatDuration(timing.wallMs)}`
  const model = timing.llmMs === undefined
    ? '模型用时未知：这一步没有产出（取消 / 重试耗尽）'
    : `其中模型 ${formatDuration(timing.llmMs)}`
  const lines = [
    wall === undefined ? model : `${wall}（${model}）`,
  ]
  if (timing.ttftMs !== undefined) lines.push(`${PHASE_LABEL.wait} ${formatDuration(timing.ttftMs)}`)
  if (timing.decodeMs !== undefined) lines.push(`生成 ${formatDuration(timing.decodeMs)}`)
  if (timing.toolMs !== undefined) {
    const calls = timing.toolCalls ?? 0
    lines.push(`工具 ${formatDuration(timing.toolMs)}（${String(calls)} 次调用取并集，并行只算一次）`)
    const slow = timing.slowTool
    if (slow !== undefined) {
      const name = slow.name === '' ? '未具名工具' : slow.name
      lines.push(`  最慢：${name} ${formatDuration(slow.ms)}${WAITING_TOOLS.has(slow.name) ? '（在等外部输入 / 外部任务，不是它在算）' : ''}`)
    }
  }
  return lines
}

const WAITING_TOOLS = new Set(['ask_user_question', 'wait_agent', 'exit_plan_mode'])
