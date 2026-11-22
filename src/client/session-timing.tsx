import { useId } from 'react'
import type { SessionStepRow, StepTiming } from '../types.ts'
import { formatDuration, formatShare } from './format.ts'
import { Dial, DialFigure } from './dial.tsx'

type TimeKind = 'model' | 'wait' | 'generate' | 'tool'

export interface TimeSegment {
  key: string
  value: number
  kind: TimeKind
}

export const PHASE_LABEL: Record<TimeKind, string> = {
  wait: '等首 token',
  generate: '生成',
  model: '模型·拆不开',
  tool: '工具',
}

function phaseFill(kind: TimeKind, key: string): string {
  if (kind === 'generate') return 'currentColor'
  return `url(#${key}-${kind})`
}

export function TimeDial({ workMs, segments }: {
  workMs?: number
  segments: readonly TimeSegment[]
}) {
  const fillKey = `dtpl-dur-${useId().replaceAll(':', '')}`
  return (
    <Dial
      title={workMs === undefined
        ? '未计时：没有量到模型与工具的起止事件'
        : `引擎工作（模型用时 + 工具用时）：${formatDuration(workMs)}`}
      segments={segments.map((segment) => ({
        key: segment.key,
        value: segment.value,
        fill: phaseFill(segment.kind, fillKey),
      }))}
      defs={(
        <>
          <pattern id={`${fillKey}-wait`} width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="currentColor" fillOpacity="0.52" />
            <rect width="1.5" height="4" fill="currentColor" fillOpacity="0.66" />
          </pattern>
          <pattern id={`${fillKey}-tool`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="currentColor" fillOpacity="0.72" />
            <rect width="1.5" height="6" fill="currentColor" fillOpacity="0.88" />
          </pattern>
          <pattern id={`${fillKey}-model`} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="currentColor" fillOpacity="0.55" />
            <rect width="1.5" height="5" fill="currentColor" />
            <path d="M0 5L5 0" stroke="currentColor" strokeWidth="1.5" />
          </pattern>
        </>
      )}
      center={workMs === undefined
        ? <span className="dtpl-dial-note">未计时</span>
        : <DialFigure text={formatDuration(workMs)} />}
    />
  )
}

export function PhaseLedger({ segments }: { segments: readonly TimeSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  return (
    <span className="dtpl-dur-phases">
      {segments.map((segment) => (
        <span className="dtpl-dur-phase" key={segment.key}>
          <span className="dtpl-tok-read-mark" data-kind={segment.kind} aria-hidden="true" />
          <span className="dtpl-dur-phase-name" title={PHASE_LABEL[segment.kind]}>{PHASE_LABEL[segment.kind]}</span>
          <b className="dtpl-dur-phase-value">{formatDuration(segment.value)}</b>
          <span className="dtpl-dur-phase-share">{formatShare(segment.value, total)}</span>
        </span>
      ))}
    </span>
  )
}

export function sumSegments(rows: readonly SessionStepRow[]): TimeSegment[] {
  const byKind = new Map<TimeKind, number>()
  for (const row of rows) {
    for (const segment of stepSegments(row.timing)) {
      byKind.set(segment.kind, (byKind.get(segment.kind) ?? 0) + segment.value)
    }
  }
  return (['wait', 'generate', 'model', 'tool'] as const)
    .filter((kind) => (byKind.get(kind) ?? 0) > 0)
    .map((kind) => ({ key: kind, value: byKind.get(kind) ?? 0, kind }))
}

export function stepSegments(timing: StepTiming | undefined): TimeSegment[] {
  if (timing === undefined || timing.llmMs === undefined) return []
  const segments: TimeSegment[] = []
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
