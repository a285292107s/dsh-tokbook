/**
 * 调价史抽屉的轴：一行自己的调价以带日期的节点呈现，夹在首记与今天之间。
 *
 * 轴上只放轴该放的东西——没有柱、节点旁没有状态标签。日期按时间比例但被推开到最小间距，
 * 故轨道用 `ResizeObserver` 实测而非百分比布局。有段可去的节点是按钮——轴是导航而非装饰。
 *
 * @module dsh-tokbook/client/pricing/Timeline
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { axisNodes, labelWidth, placeNodes } from './axis.ts'
import type { ModelDraft } from './draft.ts'

/** 聚焦轴指向的段编辑器块。空的生效时间字段正是无起点段获得日期的地方。偏好 reduced motion 的用户跳过平滑滚动。 */
function jumpToSegment(id: number): void {
  const input = document.getElementById(`seg-${String(id)}-from`)
  if (input === null) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  input.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  input.focus()
}

/** 一行调价史的轴。无轴可画时不渲染任何内容——见 {@link axisNodes}。 */
export function PriceTimeline({ row, activeId }: {
  /** 该行：它的段，以及宿主随行发送的账本事实。 */
  row: ModelDraft
  /** 行内四个单元格编辑的段，标记为当前生效。 */
  activeId: number | null
}) {
  // 每行版本一个时刻：右端是今天，位置按每次渲染读取而非按节点读取。
  const nodes = useMemo(() => axisNodes(row, activeId, Date.now()), [row, activeId])
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  // 实测而非假设：两个标签之间的最小间距是像素宽度。layout effect 使首帧就已定位。
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
          // 两端由样式表定位；其余节点居中于 `placeNodes` 给出的圆点。
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
