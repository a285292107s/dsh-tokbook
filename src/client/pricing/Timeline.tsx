/**
 * The 调价史 drawer's axis: ONE row's 调价 as dated nodes, between the two ends
 * of its own history — 首记 on the left, 今天 on the right.
 *
 * What is on the axis is only what the axis is for. A node is a 调价 that took
 * effect INSIDE this row's own history, and its date hangs UNDER its dot, while
 * the bracket's two ends — 首记 and 今天 — name themselves ABOVE the rail; the row
 * above already carries the price in force, its 未生效/峰谷 badges and its record
 * count, and the segment list below repeats every date in full. So there are no
 * bars (their width never stood for a duration — the axis has no scale), no
 * state tags beside the nodes, no 「未覆盖」 block and no sentence under the axis:
 * each of those said something twice, or said it in the one place where it could
 * not be read as a position. What is left is a rail, a dot per 调价, and the two
 * dates that bracket them.
 *
 * The ends are the bracket and never move (see `axis.ts` for how a boundary
 * outside it is treated). A row with nothing to put between them has no axis at
 * all: no 首记 to anchor on (the ledger never billed it), or no 调价 inside the
 * bracket (a bare rail between two dates is not a timeline). The dates are
 * time-proportional but pushed apart to a minimum gap, which is why the track is
 * measured (`ResizeObserver`) rather than laid out in percentages: the gap that
 * keeps two labels from piling up is a width in px, not a fraction of whatever
 * the drawer happens to be.
 *
 * A node with a segment behind it is a button — the axis is navigation, not
 * decoration — and it lands on that segment's 生效时间 field, which is also where
 * the date would be edited.
 *
 * @module dsh-tokbook/client/pricing/Timeline
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { axisNodes, labelWidth, placeNodes } from './axis.ts'
import type { ModelDraft } from './draft.ts'

/** Focus the segment editor block the axis points at. The ids come from
 *  `SegmentEditor`'s own `seg-<id>-from` — an empty 生效时间 field is exactly
 *  where a 无起点 segment gets its date, so landing there is the whole gesture.
 *  The smooth scroll is skipped for users who asked for reduced motion. */
function jumpToSegment(id: number): void {
  const input = document.getElementById(`seg-${String(id)}-from`)
  if (input === null) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  input.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  input.focus()
}

/** The axis of one row's 调价史. Renders nothing when there is no axis to draw —
 *  see {@link axisNodes}: the row and its segment list already say everything
 *  about a price that this history never saw change. */
export function PriceTimeline({ row, activeId }: {
  /** The row: its segments, and the ledger facts the host sent with it. */
  row: ModelDraft
  /** The segment the row's four cells edit, marked 当前生效. */
  activeId: number | null
}) {
  // One instant per row version: the right end is 今天, and where it falls is
  // read once per render rather than per node.
  const nodes = useMemo(() => axisNodes(row, activeId, Date.now()), [row, activeId])
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  // Measured, not assumed: the minimum gap between two labels is a px width, so
  // the drawer's own width has to be known — and it changes when the window
  // does. A layout effect keeps the first paint already placed.
  useLayoutEffect(() => {
    const track = trackRef.current
    if (track === null) return
    const measure = (): void => { setTrackWidth(track.clientWidth) }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => { observer.disconnect() }
  }, [nodes])
  if (nodes === null) return null
  const spots = placeNodes(nodes.map(node => node.ratio), nodes.map(node => labelWidth(node.label)), trackWidth)
  const changes = nodes.filter(node => node.cap === null)
  const spoken = `价段时间轴：${nodes[0].label}`
    + (changes.length === 0 ? '' : `，之后 ${changes.map(node => node.label).join('、')} 各调过一次价`)
    + '；今天在最右端。'
  return (
    <div className="dtpl-tl" role="group" aria-label={spoken}>
      <div className="dtpl-tl-track" ref={trackRef}>
        <span className="dtpl-tl-rail" aria-hidden="true" />
        {nodes.map((node, index) => {
          const id = node.segmentId
          // The ends are placed by the stylesheet (left edge / right edge); every
          // other node is centred on the dot `placeNodes` gave it.
          const style = node.cap === null ? { left: `${String(spots[index])}px` } : undefined
          const what = `${node.label} 起生效${node.active ? '（当前生效）' : ''}`
          if (id === null) {
            return (
              <span
                key={node.cap ?? `node-${String(index)}`}
                className="dtpl-tl-node"
                data-cap={node.cap}
                style={style}
                aria-hidden="true"
              >
                <span className="dtpl-tl-node-k">{node.label}</span>
              </span>
            )
          }
          return (
            <button
              key={node.cap ?? String(id)}
              type="button"
              className="dtpl-tl-node"
              data-cap={node.cap}
              data-active={node.active}
              style={style}
              aria-current={node.active ? 'true' : undefined}
              aria-label={`${what}。激活后跳到这一段`}
              title={`${what}\n点击跳到这一段`}
              onClick={() => jumpToSegment(id)}
            >
              <span className="dtpl-tl-node-k" aria-hidden="true">{node.label}</span>
              <span className="dtpl-tl-dot" aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
