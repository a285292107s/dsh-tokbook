import type { SessionStepRow, StepTiming } from '../types.ts'

export interface TimeBarRead {
  key: string
  kind: TimeSegment['kind']
  label: string
  value: string
}

export const PHASE_LABEL: Record<'wait' | 'generate' | 'model' | 'tool', string> = {
  wait: '等首 token',
  generate: '生成',
  model: '模型（拆不开）',
  tool: '工具',
}

export const LEGEND_SHAPE: ReadonlyArray<{ kind: 'wait' | 'generate' | 'tool'; share: number; label: string }> = (
  [
    { kind: 'wait', share: 30 },
    { kind: 'generate', share: 52 },
    { kind: 'tool', share: 32 },
  ] as const
).map((phase) => ({ ...phase, label: PHASE_LABEL[phase.kind] }))

type TimeSegment = { key: string; value: number; kind: 'model' | 'wait' | 'generate' | 'tool' | 'work' | 'idle' }

export interface TimeBarRead {
  key: string
  kind: TimeSegment['kind']
  label: string
  value: string
}

export function TimeReads({ reads }: { reads: readonly TimeBarRead[] }) {
  return (
    <span className="dtpl-tok-reads">
      {reads.map((read) => (
        <span className="dtpl-tok-read" key={read.key}>
          <span className="dtpl-tok-read-mark" data-kind={read.kind} aria-hidden="true" />
          <span>{read.label}</span>
          <b>{read.value}</b>
        </span>
      ))}
    </span>
  )
}

type TimeBarProps = { segments: readonly TimeSegment[] } & (
  | { tone: 'step' }
  | { tone: 'turn'; scale: number }
  | { tone: 'hero'; scale: number; reads: readonly TimeBarRead[] }
)

export function TimeBar(props: TimeBarProps) {
  const total = props.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  if (!(total > 0)) return null
  const segPct = (value: number): string =>
    `${String(Math.round((Math.max(0, value) / total) * 1000) / 10)}%`
  if (props.tone !== 'step' && !(props.scale > 0)) return null
  const width = props.tone === 'step'
    ? '100%'
    : `max(2px, ${String(Math.round(Math.min(1, total / props.scale) * 1000) / 10)}%)`
  const bar = (
    <span
      className="dtpl-tok-bar"
      data-tone={props.tone}
      aria-hidden="true"
      style={{ width }}
    >
      {props.segments.map((segment) => (
        <span
          key={segment.key}
          className="dtpl-tok-bar-seg"
          data-kind={segment.kind}
          style={{ width: `max(${segment.value > 0 ? 2 : 0}px, ${segPct(segment.value)})` }}
        />
      ))}
    </span>
  )
  if (props.tone !== 'hero') return bar
  return (
    <span className="dtpl-tok-hero-ratio">
      {bar}
      <TimeReads reads={props.reads} />
    </span>
  )
}

export function sumSegments(rows: readonly SessionStepRow[]): { key: string; value: number; kind: 'model' | 'wait' | 'generate' | 'tool' }[] {
  const byKind = new Map<'model' | 'wait' | 'generate' | 'tool', number>()
  for (const row of rows) {
    for (const segment of stepSegments(row.timing)) {
      byKind.set(segment.kind, (byKind.get(segment.kind) ?? 0) + segment.value)
    }
  }
  return (['wait', 'generate', 'model', 'tool'] as const)
    .filter((kind) => (byKind.get(kind) ?? 0) > 0)
    .map((kind) => ({ key: kind, value: byKind.get(kind) ?? 0, kind }))
}

export function stepSegments(timing: StepTiming | undefined): { key: string; value: number; kind: 'model' | 'wait' | 'generate' | 'tool' }[] {
  if (timing === undefined || timing.llmMs === undefined) return []
  const segments: { key: string; value: number; kind: 'model' | 'wait' | 'generate' | 'tool' }[] = []
  const { ttftMs, decodeMs } = timing
  if (ttftMs !== undefined && decodeMs !== undefined && decodeMs > 0) {
    if (ttftMs > 0) segments.push({ key: 'wait', value: ttftMs, kind: 'wait' })
    segments.push({ key: 'generate', value: decodeMs, kind: 'generate' })
  } else {
    segments.push({ key: 'model', value: timing.llmMs, kind: 'model' })
  }
  if (timing.toolMs !== undefined && timing.toolMs > 0) {
    segments.push({ key: 'tool', value: timing.toolMs, kind: 'tool' })
  }
  return segments
}
