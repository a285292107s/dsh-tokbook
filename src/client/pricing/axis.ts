/**
 * 调价史轴（`Timeline.tsx`）的纯规则：哪些时刻成为节点，每个带标签的节点落在轨道上的哪里。
 *
 * 轴括住一行自己的历史：左端是首记，右端是今天。相邻标签会被推开直到满足最小间距。
 * 纯逻辑：无 React、无 DOM。
 */

import { hourStartMs, instantKey } from '../../price-format.ts'
import { isBlankSegment, segmentInstant, sortedSegments, type ModelDraft } from './draft.ts'

/** 轴上一个带标签的点。 */
export interface AxisNode {
  /** 在括号内的位置，0 = 首记 … 1 = 今天（间距修正前）。 */
  ratio: number
  /** 节点下方打印的文字。 */
  label: string
  /** 点击跳转的目标段；端帽上无调价时为 null。 */
  segmentId: number | null
  /** 今天生效的价格从这里开始。 */
  active: boolean
  /** 本节点是括号两端之一。 */
  cap: 'start' | 'today' | null
}

/** 一个标签的宽度（px），足以用来推开相邻标签。按字符估算而非 DOM 实测，且刻意略偏宽——估宽了多花几像素，估窄了两个日期会叠在一起。 */
const LABEL_PX = 9
const ASCII_EM = 0.52
/** 两个相邻标签在自身宽度之外保留的空隙。 */
const LABEL_GAP = 6

/** 一个标签打印出来有多宽（px）。 */
export function labelWidth(label: string): number {
  let em = 0
  for (const char of label) em += (char.codePointAt(0) ?? 0) > 0x2e7f ? 1 : ASCII_EM
  return em * LABEL_PX
}

/**
 * 一行的轴：首记、括号内生效的每一次调价，以及今天——无轴可画时返回 null。
 */
export function axisNodes(row: ModelDraft, activeId: number | null, nowMs: number): AxisNode[] | null {
  if (row.records <= 0 || row.firstAt === undefined) return null
  const start = hourStartMs(row.firstAt)
  const span = nowMs - start
  // 正好落在首记时刻的调价**就是**左端：一个时刻、一个标签——端帽的。
  let first: AxisNode = {
    ratio: 0, label: `首记 ${instantKey(start).replace('T', ' ')}`,
    segmentId: null, active: false, cap: 'start',
  }
  const inside: AxisNode[] = []
  for (const segment of sortedSegments(row)) {
    if (isBlankSegment(segment)) continue
    const at = segmentInstant(segment)
    // 不可放置的边界：无起点（在历史之前）或半输入的日期；早于首记、或仍在未来，也不属于这段历史。
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
  // 括号内没有调价 → 无轴可画。
  if (first.segmentId === null && inside.length === 0) return null
  return [first, ...inside, { ratio: 1, label: '今天', segmentId: null, active: false, cap: 'today' }]
}

/**
 * 每个节点的圆点落在 `trackWidth` px 宽轨道上的位置（距轨道左端的 px），顺序与传入一致。
 *
 * 每个标签居中于自己的圆点，两端除外：它们的标签被保持在轨道内——它们是括号，不能被推到任何地方。
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
