/**
 * 调价史轴（`Timeline.tsx`）的纯规则：哪些时刻成为节点，每个带标签的节点落在轨道上的哪里。
 *
 * 轴括住一行的**价**：左端是它最早的调价时刻，右端是今天。价定在未来时两端对调，
 * 今天于是成为轴内的一个节点。**没有任何调价史时返回空数组**——那时没有可说的时刻，
 * 由组件画一条暗淡的空轨，而不是把轴藏起来。纯逻辑：无 React、无 DOM。
 */

import { hourStartMs, instantKey } from '../../price-format.ts'
import { isBlankSegment, segmentInstant, sortedSegments, type ModelDraft } from './draft.ts'

/** 轴上一个带标签的点。 */
export interface AxisNode {
  /** 在括号内的位置，0 = 左端 … 1 = 右端（间距修正前）。 */
  ratio: number
  /** 节点下方打印的文字。 */
  label: string
  /** 点击跳转的目标段；「今天」这个节点上为 null。 */
  segmentId: number | null
  /** 此刻生效的那一段：它这个节点带「当前生效」的分量。 */
  active: boolean
  /** 本节点是括号的一端（`start` = 左端，`today` = 右端），由样式表钉在边缘。 */
  cap: 'start' | 'today' | null
}

/** 一个标签的宽度（px），按字符估算而非 DOM 实测，且刻意略偏宽——估窄了两个日期会叠在一起。 */
const LABEL_PX = 9
const ASCII_EM = 0.52
/** 两个相邻标签在自身宽度之外保留的空隙。 */
const LABEL_GAP = 6

export function labelWidth(label: string): number {
  let em = 0
  for (const char of label) em += (char.codePointAt(0) ?? 0) > 0x2e7f ? 1 : ASCII_EM
  return em * LABEL_PX
}

function segLabel(at: number): string {
  return instantKey(at).replace('T', ' ')
}

/** 每一段价一个节点；「今天」不落在两端时自己也进轴，标出此刻在价的时间里落在哪儿。 */
export function axisNodes(row: ModelDraft, activeId: number | null, nowMs: number): AxisNode[] {
  const changes = sortedSegments(row)
    .filter(segment => !isBlankSegment(segment))
    .map(segment => ({ id: segment.id, at: segmentInstant(segment) }))
    .filter((item): item is { id: number; at: number } => item.at !== null)
  if (changes.length === 0) return []

  const today = hourStartMs(nowMs)
  // 两端：最早的一段价与今天，谁前谁后不定——价可能定在未来。
  const start = Math.min(changes[0]!.at, today)
  const end = Math.max(changes[changes.length - 1]!.at, today)
  const span = end - start
  const ratio = (at: number): number => (span <= 0 ? 0 : (at - start) / span)

  const nodes: AxisNode[] = changes.map(change => ({
    ratio: ratio(change.at),
    label: segLabel(change.at),
    segmentId: change.id,
    active: change.id === activeId,
    cap: null,
  }))
  // 今天始终在轴上：它落在价的时间里时是中间一个节点（标出「此刻」在哪儿），
  // 落在某一段价上时那一段自己就是它，不必再画一个重复的节点。
  if (!changes.some(change => change.at === today)) {
    nodes.push({ ratio: ratio(today), label: '今天', segmentId: null, active: false, cap: null })
  }
  nodes.sort((left, right) => left.ratio - right.ratio)
  // 端帽按**位置**给：左端那个当左端帽、右端那个当右端帽（它们只决定标签贴哪边）。
  // 只有一个节点时（一行的价恰好就是今天）它当左端帽。
  nodes[0]!.cap = 'start'
  if (nodes.length > 1) nodes[nodes.length - 1]!.cap = 'today'
  return nodes
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
