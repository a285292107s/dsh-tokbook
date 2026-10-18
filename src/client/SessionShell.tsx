import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode, RefObject, WheelEvent } from 'react'

const COLUMN_KEY = 'dsh-tokbook.tokens.contentWidth'
const COLUMN_MIN = 640
const COLUMN_EDGE_BUDGET = 176
const KEY_STEP = 16
const KEY_STEP_COARSE = 64
const WHEEL_LINE_PX = 16

type WidthStyle = CSSProperties & Record<'--dtpl-tok-width', string>

function readWidth(): number | null {
  try {
    const raw = localStorage.getItem(COLUMN_KEY)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function SessionShell({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState<number | null>(readWidth)
  const root = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState({ drawn: 0, available: 0 })

  useEffect(() => {
    const view = viewport.current
    const column = view?.firstElementChild
    if (!(view instanceof HTMLElement) || !(column instanceof HTMLElement)) return
    const read = (): void => {
      setMetrics({ drawn: Math.round(column.getBoundingClientRect().width), available: view.clientWidth })
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(view)
    observer.observe(column)
    return () => { observer.disconnect() }
  }, [])

  const apply = useCallback((next: number | null, persist = true): void => {
    setWidth(next)
    if (!persist) return
    try {
      if (next === null) localStorage.removeItem(COLUMN_KEY)
      else localStorage.setItem(COLUMN_KEY, String(next))
    } catch {
    }
  }, [])

  const style: WidthStyle | undefined = width === null ? undefined : { '--dtpl-tok-width': `${String(width)}px` }
  return (
    <div className="dtpl-tok" data-plugin="dsh-tokbook" data-conversation-composer-overlay="" ref={root} style={style}>
      {(['left', 'right'] as const).map((side) => (
        <ColumnGrip key={side} side={side} viewport={viewport} width={width} metrics={metrics} onApply={apply} />
      ))}
      <div className="dtpl-tok-scroll" ref={viewport}>
        <div className="dtpl-tok-col">{children}</div>
      </div>
    </div>
  )
}

function ColumnGrip({ side, viewport, width, metrics, onApply }: {
  side: 'left' | 'right'
  viewport: RefObject<HTMLDivElement>
  width: number | null
  metrics: { drawn: number; available: number }
  onApply: (next: number | null, persist?: boolean) => void
}) {
  const [dragging, setDragging] = useState(false)
  const base = useRef(0)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)

  const ceiling = (): number => Math.max(COLUMN_MIN, metrics.available - COLUMN_EDGE_BUDGET)
  const clamp = (value: number): number => Math.min(Math.max(Math.round(value), COLUMN_MIN), ceiling())
  const startWidth = (): number => clamp(metrics.drawn > 0 ? metrics.drawn : metrics.available)
  const draggedWidth = (): number => {
    const outward = side === 'right' ? 1 : -1
    return clamp(base.current + outward * (latest.current - origin.current) * 2)
  }

  const stopFrame = (): void => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }
  useEffect(() => stopFrame, [])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    origin.current = event.clientX
    latest.current = event.clientX
    base.current = startWidth()
    setDragging(true)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const box = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--dtpl-grip-y', `${String(Math.round(event.clientY - box.top))}px`)
    latest.current = event.clientX
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      onApply(draggedWidth(), false)
    })
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return
    stopFrame()
    setDragging(false)
    latest.current = event.clientX
    if (latest.current !== origin.current) onApply(draggedWidth())
  }
  const onPointerCancel = (): void => {
    stopFrame()
    setDragging(false)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? KEY_STEP_COARSE : KEY_STEP
    const outward = side === 'right' ? 1 : -1
    const from = width ?? startWidth()
    let next: number | null = null
    if (event.key === 'ArrowRight') next = from + outward * step
    else if (event.key === 'ArrowLeft') next = from - outward * step
    else if (event.key === 'Home') next = COLUMN_MIN
    else if (event.key === 'End') next = ceiling()
    if (next === null) return
    event.preventDefault()
    onApply(clamp(next))
  }
  const onWheel = (event: WheelEvent<HTMLDivElement>): void => {
    const element = viewport.current
    if (element === null || event.ctrlKey || event.deltaY === 0) return
    const perUnit = event.deltaMode === 1 ? WHEEL_LINE_PX : event.deltaMode === 2 ? element.clientHeight : 1
    element.scrollTop += event.deltaY * perUnit
  }

  return (
    <div
      className="dtpl-tok-grip"
      data-side={side}
      data-dragging={dragging ? '' : undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label="调整内容列宽度"
      aria-valuemin={COLUMN_MIN}
      aria-valuemax={ceiling()}
      aria-valuenow={metrics.drawn > 0 ? metrics.drawn : COLUMN_MIN}
      tabIndex={0}
      title="拖动调整内容列宽度（方向键微调，双击恢复为跟随对话正文）"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onApply(null)}
      onWheel={onWheel}
    />
  )
}
