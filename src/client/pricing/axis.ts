/**
 * The pure rules of the 调价史 axis (`Timeline.tsx`): which instants become
 * nodes, and where each labelled node sits on the track.
 *
 * The axis brackets ONE row's own history: its left end is 首记 (the row's first
 * ledger record, taken at the price file's hourly precision), its right end is
 * 今天. A boundary outside that bracket is not a change this history saw — one
 * dated before 首记 was already in force when the history began, and one dated
 * after today has not taken effect yet — so only the 调价 INSIDE it are nodes. A
 * row the ledger never billed has no bracket to draw, and a bracket with no 调价
 * in it has nothing to draw either: either way there is no axis.
 *
 * Positions are time-proportional, with one correction: two 调价 a day apart in a
 * half-year history land on the same pixel, so neighbouring labels are pushed
 * apart until they clear a minimum gap. The distance between nodes is therefore
 * approximate — the axis is read as an ORDER of 调价, not as a scale — while both
 * ends stay exactly where they are: 首记 and 今天 never move, and the axis never
 * scrolls sideways. When even the minimum gap does not fit, the gap shrinks.
 *
 * Pure: no React, no DOM. `scripts/smoke.ts` holds the invariants.
 *
 * @module dsh-tokbook/client/pricing/axis
 */

import { hourStartMs, instantKey } from '../../price-format.ts'
import { isBlankSegment, segmentInstant, sortedSegments, type ModelDraft } from './draft.ts'

/** One labelled point of the axis. */
export interface AxisNode {
  /** Where it falls inside the bracket, 0 = 首记 … 1 = 今天, before spacing. */
  ratio: number
  /** What is printed under it. */
  label: string
  /** The segment clicking it jumps to; null on a cap no 调价 falls on. */
  segmentId: number | null
  /** The price in force today takes effect here. */
  active: boolean
  /** This node is one of the bracket's two ends. */
  cap: 'start' | 'today' | null
}

/** A node label's width, in px, near enough to space labels apart with: at 9px,
 *  tabular figures measure ~0.49em and CJK ~1em (measured in the browser). The
 *  estimate is per character instead of measured in the DOM, and deliberately
 *  errs a shade wide — it only decides how much clear space two neighbours keep,
 *  so overestimating costs a few px of gap while underestimating piles two dates
 *  on top of each other. */
const LABEL_PX = 9
const ASCII_EM = 0.52
/** The clear space two neighbouring labels keep, on top of their own widths. */
const LABEL_GAP = 6

/** How wide one label prints, in px (see the constants above). */
export function labelWidth(label: string): number {
  let em = 0
  for (const char of label) em += (char.codePointAt(0) ?? 0) > 0x2e7f ? 1 : ASCII_EM
  return em * LABEL_PX
}

/**
 * The axis of one row: 首记, every 调价 that took effect inside the bracket, and
 * 今天 — or null when there is no axis to draw: the ledger knows no 首记, or no
 * 调价 landed inside the bracket.
 */
export function axisNodes(row: ModelDraft, activeId: number | null, nowMs: number): AxisNode[] | null {
  if (row.records <= 0 || row.firstAt === undefined) return null
  const start = hourStartMs(row.firstAt)
  const span = nowMs - start
  // A 调价 exactly at 首记 IS the left end: one instant, one label — the cap's.
  // So the first boundary to land there folds into the cap instead of doubling
  // its date, and the cap keeps the dot (the node) that leads to that segment.
  let first: AxisNode = {
    ratio: 0, label: `首记 ${instantKey(start).replace('T', ' ')}`,
    segmentId: null, active: false, cap: 'start',
  }
  const inside: AxisNode[] = []
  for (const segment of sortedSegments(row)) {
    if (isBlankSegment(segment)) continue
    const at = segmentInstant(segment)
    // Not a placeable boundary: 无起点 (0 — before the history, not in it) or a
    // half-typed date. Outside the bracket — earlier than 首记, or still ahead —
    // is no 调价 of this history either.
    if (at === null || at < start || at > nowMs) continue
    const node: AxisNode = {
      ratio: span <= 0 ? 0 : (at - start) / span,
      label: instantKey(at).replace('T', ' '),
      segmentId: segment.id,
      active: segment.id === activeId,
      cap: null,
    }
    if (at === start && first.segmentId === null) {
      first = { ...first, segmentId: node.segmentId, active: node.active }
      continue
    }
    inside.push(node)
  }
  // A bracket with no 调价 in it has nothing to say: a bare rail between two dates
  // is not a timeline, and the row's own price, badges and segment list already
  // say everything about a price that never changed. So the axis is drawn only
  // when a boundary really landed inside the row's history.
  if (first.segmentId === null && inside.length === 0) return null
  return [first, ...inside, { ratio: 1, label: '今天', segmentId: null, active: false, cap: 'today' }]
}

/**
 * Where each node's dot sits on a track `trackWidth` px wide, in px from the
 * track's left end — one position per node, in the order they were given.
 *
 * Every label is centred on its own dot, except the two ends, whose labels are
 * held inside the track (the first one starts at 0, the last one ends at the
 * track's right edge): they are the bracket, so they cannot be pushed anywhere.
 * `gap` is the clear space two neighbouring labels keep; when the labels do not
 * all fit at that width, it shrinks rather than letting the bracket scroll.
 */
export function placeNodes(
  ratios: readonly number[],
  widths: readonly number[],
  trackWidth: number,
  gap: number = LABEL_GAP,
): number[] {
  const count = ratios.length
  if (count === 0) return []
  const clamp = (ratio: number): number => Math.min(Math.max(ratio, 0), 1)
  // Each label's box: what the forward and backward passes below push around.
  const left = ratios.map((ratio, index) => clamp(ratio) * trackWidth - widths[index] / 2)
  left[0] = 0
  left[count - 1] = trackWidth - widths[count - 1]
  const room = trackWidth - widths.reduce((sum, width) => sum + width, 0)
  const clear = count > 1 ? Math.max(0, Math.min(gap, room / (count - 1))) : gap
  for (let index = 1; index < count - 1; index++) {
    const behind = left[index - 1] + widths[index - 1] + clear
    left[index] = Math.max(left[index], behind)
  }
  for (let index = count - 2; index > 0; index--) {
    const ahead = left[index + 1] - clear - widths[index]
    left[index] = Math.min(left[index], ahead)
  }
  return left.map((box, index) => {
    if (index === 0) return 0
    if (index === count - 1) return trackWidth
    return box + widths[index] / 2
  })
}
