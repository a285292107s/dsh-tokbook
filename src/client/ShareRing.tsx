import type { CSSProperties } from 'react'
import { formatShare, share } from './format.ts'

const R = 11
const CIRC = 2 * Math.PI * R
const PX = 44

export function ShareRing({ value, total, denom }: {
  value: number
  total: number
  denom: string
}) {
  const label = formatShare(value, total)
  const arc = (share(value, total) / 100) * CIRC
  return (
    <span className="dtpl-share-ring">
      <svg viewBox="-13.5 -13.5 27 27" width={PX} height={PX} aria-hidden="true">
        <circle className="dtpl-share-ring-track" cx="0" cy="0" r={R} />
        <circle
          className="dtpl-share-ring-arc"
          cx="0"
          cy="0"
          r={R}
          transform="rotate(-90)"
          strokeDasharray={`${arc} ${CIRC}`}
          style={{ '--dtpl-arc': `${arc}px` } as CSSProperties}
        />
      </svg>
      <span className="dtpl-share-ring-num">
        <span className="dtpl-sr">占{denom} </span>{label.endsWith('%') ? label.slice(0, -1) : label}<i>%</i>
      </span>
    </span>
  )
}
