import type { SessionStepRow, SessionUsageView } from '../types.ts'
import { settleTiming } from '../types.ts'
import { ClockGlyph } from './icons.tsx'
import { PhaseLedger, TimeDial, sumSegments } from './session-timing.tsx'
import { SessionOverlay, modelLabelOf, type OverlayCard } from './SessionOverlay.tsx'

export interface SessionTimingEntryProps {
  sessionId?: string
}

function workOf(rows: readonly SessionStepRow[]): number | undefined {
  if (!rows.some((row) => row.timing !== undefined)) return undefined
  const { llmMs, toolMs } = settleTiming(rows)
  return llmMs + toolMs
}

function timingCards(view: SessionUsageView): OverlayCard[] {
  const labels = view.providerLabels ?? {}
  const cards: OverlayCard[] = []
  for (const group of view.turns) {
    const untimed = group.rows.filter((row) => row.timing?.llmMs === undefined).length
    const workMs = workOf(group.rows)
    const phases = sumSegments(group.rows)
    const model = modelLabelOf(group.rows, labels)
    cards.push({
      key: `turn:${String(group.turn)}`,
      turn: group.turn,
      meta: `${String(group.rows.length)} 步${untimed === 0 ? '' : ` · ${String(untimed)} 步未计时`}${model.count > 1 ? ` · ${String(model.count)} 个模型` : ''}`,
      model,
      leading: <TimeDial workMs={workMs} segments={phases} />,
      body: workMs === undefined
        ? null
        : phases.length > 0
          ? <PhaseLedger segments={phases} />
          : <p className="dtpl-ov-gap">拆不开：这一轮没有量到模型与工具的起止事件。</p>,
    })
  }
  return cards.reverse()
}

export function SessionTimingEntry({ sessionId }: SessionTimingEntryProps) {
  return (
    <SessionOverlay
      sessionId={sessionId}
      triggerTitle="查看本会话每轮耗时"
      triggerLabel="耗时"
      triggerIcon={<ClockGlyph className="dtpl-tok-entry-ico" />}
      panelTitle="每轮耗时"
      panelLabel="每轮耗时"
      emptyText="这个会话还没有可归属轮次的计费调用。"
      footnote="本机墙钟 · 最新在前 · 不含轮间/轮次未知/子代理"
      cards={timingCards}
    />
  )
}
