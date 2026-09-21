/**
 * 调价史轴：一行自己的每一段价以带日期的节点呈现，夹在「最早那一段价」与今天之间。
 * 一端都没有价可放时（还没有调价史）画一条暗淡的空轨——轴是这一屏的固定构件，
 * 不该因为这一行还没价就消失。
 *
 * 最小间距是像素值，所以轨道宽度用 `ResizeObserver` 实测，而不是百分比布局。
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { axisNodes, labelWidth, placeNodes } from './axis.ts'
import type { ModelDraft } from './draft.ts'

/** 聚焦轴指向的段编辑器块。偏好 reduced motion 的用户跳过平滑滚动。 */
function jumpToSegment(id: number): void {
  const input = document.getElementById(`seg-${String(id)}-from`)
  if (input === null) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  input.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  input.focus()
}

/** 一行调价史的轴。没有任何调价史时只画一条暗淡的空轨（见 {@link axisNodes}）。 */
export function PriceTimeline({ row, activeId }: {
  /** 该行：它的段，以及宿主随行发送的账本事实。 */
  row: ModelDraft
  /** 当前生效的段 id。 */
  activeId: number | null
}) {
  // 右端「今天」取每次渲染的时刻。
  const nodes = useMemo(() => axisNodes(row, activeId, Date.now()), [row, activeId])
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  // 最小间距是像素宽度，必须实测；layout effect 使首帧就已定位。
  useLayoutEffect(() => {
    const track = trackRef.current
    if (track === null) return
    const measure = (): void => { setTrackWidth(track.clientWidth) }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => { observer.disconnect() }
  }, [nodes])
  // 空轴：轨道照旧（这一屏的构件），只是没有节点、没有标签，颜色退到最暗一档。
  if (nodes.length === 0) {
    return (
      <div className="dtpl-tl" data-dim="true" role="group" aria-label="价段时间轴：这一段还没有调价史">
        <div className="dtpl-tl-track" ref={trackRef}>
          <span className="dtpl-tl-rail" aria-hidden="true" />
        </div>
      </div>
    )
  }
  const spots = placeNodes(nodes.map(node => node.ratio), nodes.map(node => labelWidth(node.label)), trackWidth)
  const changes = nodes.filter(node => node.segmentId !== null)
  const active = nodes.find(node => node.active)
  const spoken = `价段时间轴：共 ${String(changes.length)} 段价，分别在 ${changes.map(node => node.label).join('、')} 生效`
    + (active === undefined ? '' : `；当前生效的是 ${active.label}`)
    + '。'
  return (
    <div className="dtpl-tl" role="group" aria-label={spoken}>
      <div className="dtpl-tl-track" ref={trackRef}>
        <span className="dtpl-tl-rail" aria-hidden="true" />
        {nodes.map((node, index) => {
          const id = node.segmentId
          // 两端由样式表定位（[data-cap]）；其余节点居中于 `placeNodes` 给出的圆点。
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
