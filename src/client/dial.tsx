import type { ReactNode } from 'react'

export interface DialSegment {
  key: string
  value: number
  fill: string
}

const DIAL = 108
const RING_RADIUS = 42
const RING_STROKE = 9
const SEGMENT_GAP = 2
const SEGMENT_MIN = 3
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function arcLengths(values: readonly number[], usable: number): number[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0)
  if (!(total > 0) || !(usable > 0)) return values.map(() => 0)
  const raw = values.map((value) => (Math.max(0, value) / total) * usable)
  const pinned = raw.map((arc) => arc < SEGMENT_MIN)
  const fixed = pinned.reduce((sum, isPinned) => sum + (isPinned ? SEGMENT_MIN : 0), 0)
  const flexible = raw.reduce((sum, arc, index) => sum + (pinned[index] ? 0 : arc), 0)
  const rest = usable - fixed
  if (!(flexible > 0) || rest <= 0) return values.map(() => SEGMENT_MIN)
  return raw.map((arc, index) => (pinned[index] ? SEGMENT_MIN : (arc / flexible) * rest))
}

function polar(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  const radians = ((angle - 90) * Math.PI) / 180
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polar(cx, cy, radius, endAngle)
  const end = polar(cx, cy, radius, startAngle)
  const large = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${String(radius)} ${String(radius)} 0 ${String(large)} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`
}

export function Dial({ title, segments, defs, center }: {
  title: string
  segments: readonly DialSegment[]
  defs?: ReactNode
  center: ReactNode
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  const arcs = total > 0
    ? arcLengths(segments.map((segment) => segment.value), RING_CIRCUMFERENCE - segments.length * SEGMENT_GAP)
    : []
  let cursor = 0
  return (
    <span className="dtpl-dial" title={title}>
      <svg
        className="dtpl-dial-ring"
        viewBox={`0 0 ${String(DIAL)} ${String(DIAL)}`}
        width={DIAL}
        height={DIAL}
        aria-hidden="true"
        focusable="false"
      >
        {defs !== undefined && <defs>{defs}</defs>}
        <circle
          className="dtpl-dial-ring-track"
          cx={DIAL / 2}
          cy={DIAL / 2}
          r={RING_RADIUS}
          strokeWidth={RING_STROKE}
        />
        {segments.map((segment, index) => {
          const arc = arcs[index] ?? 0
          const start = cursor
          cursor += arc + SEGMENT_GAP
          return (
            <path
              className="dtpl-dial-ring-seg"
              key={segment.key}
              d={arcPath(DIAL / 2, DIAL / 2, RING_RADIUS, (start / RING_CIRCUMFERENCE) * 360, ((start + arc) / RING_CIRCUMFERENCE) * 360)}
              strokeWidth={RING_STROKE}
              stroke={segment.fill}
            />
          )
        })}
      </svg>
      <span className="dtpl-dial-val">{center}</span>
    </span>
  )
}

export function DialFigure({ text }: { text: string }) {
  const parts = text.split(/(\d+(?:\.\d+)?)/).filter((part) => part !== '')
  return (
    <span className="dtpl-dial-figure">
      {parts.map((part, index) => (/^\d/.test(part)
        ? <b key={`${part}-${String(index)}`}>{part}</b>
        : <span key={`${part}-${String(index)}`}>{part}</span>))}
    </span>
  )
}
