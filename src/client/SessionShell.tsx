/**
 * 词元页的外壳：三层盒子 + 两侧的**列宽手柄**。
 *
 * 三层按职责分：根（`data-plugin` 与那个宿主模式开关的挂点，同时是手柄的定位父级）、滚动区
 * （这一页自己的滚动，见 styles/session.ts）、列（阅读宽度）。
 *
 * 手柄补的是宿主藏起来的那一对：宿主的宽度手柄挂在自己的视图根上，而
 * `.wSkVaW_root:has([data-conversation-composer-overlay]) .wSkVaW_widthHandle{display:none}`
 * —— 非对话视图一激活，宿主那对手柄跟着一起藏，于是这一页上没人能拖宽度。拖法与手感照抄宿主的
 * `WidthHandle`（居中列，指针走 1px 宽度变 2px；rAF 节流；指针捕获；`data-dragging` 时那道
 * 跟着指针走的 2px 线），只在两处不一样：方向键也能调（拖动要有等价的键盘路径），双击回到跟随。
 *
 * 宽度**只存这一页的**（键与宿主的 `dsh.conversation.contentWidth` 并列，互不影响）：没调过就
 * 跟着宿主给对话正文的那条列走，调过之后这一页有自己的宽度，对话那一页不动。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode, RefObject, WheelEvent } from 'react'

/** 这一页存列宽的键。宿主存的是它自己那页的（`dsh.conversation.contentWidth`）。 */
const COLUMN_KEY = 'dsh-tokbook.tokens.contentWidth'
/** 上下限照抄宿主那套：下限是它的列宽下限，上限给两侧手柄与安全区留 176px。 */
const COLUMN_MIN = 640
const COLUMN_EDGE_BUDGET = 176
/** 拖动一格的键盘步长（按住 Shift 收紧到一次 64px）。 */
const KEY_STEP = 16
const KEY_STEP_COARSE = 64
/** 指针轮询的一行是多少 px——滚轮落在手柄上时按它换算（与宿主同一套算法）。 */
const WHEEL_LINE_PX = 16

/** 只能挂在 style 上的自定义属性：React 的 CSSProperties 不收 `--*`，在这里开一个口子。 */
type WidthStyle = CSSProperties & Record<'--dtpl-tok-width', string>

/** 存下来的列宽（px）；没存过或存坏了都是 null（= 跟随对话正文那条列）。 */
function readWidth(): number | null {
  try {
    const raw = localStorage.getItem(COLUMN_KEY)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    // 隐私模式等拿不到存储：这一页照常画，只是宽度不记得。
    return null
  }
}

export function SessionShell({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState<number | null>(readWidth)
  const root = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  /** 画出来的那两个数：列现在多宽、这一页当下能有多宽。都从真实盒子上量，不由公式推。 */
  const [metrics, setMetrics] = useState({ drawn: 0, available: 0 })

  // 列宽每次变（拖动、方向键、窗口缩放、宿主那条列变了）都重新量一遍：两个数都从量来的值走，
  // 所以「跟随对话正文」时 aria 报的也是真实宽度，而不是我们没存过的默认值。
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
      // 存不下不影响这一次调整，只是下次进来回到默认。
    }
  }, [])

  const style: WidthStyle | undefined = width === null ? undefined : { '--dtpl-tok-width': `${String(width)}px` }
  return (
    <div className="dtpl-tok" data-plugin="dsh-tokbook" data-conversation-composer-overlay="" ref={root} style={style}>
      {/* 手柄排在滚动区**前面**：绝对定位不吃 DOM 顺序，但 Tab 顺序吃——排后面的话要先按过
          一屏的轮次块头才够得着，那条键盘路径就只是摆设（分层号保证它仍画在滚动区之上）。 */}
      {(['left', 'right'] as const).map((side) => (
        <ColumnGrip key={side} side={side} viewport={viewport} width={width} metrics={metrics} onApply={apply} />
      ))}
      <div className="dtpl-tok-scroll" ref={viewport}>
        <div className="dtpl-tok-col">{children}</div>
      </div>
    </div>
  )
}

/**
 * 一枚手柄。两条路改同一个数：指针拖（照抄宿主的算法）与方向键（等价路径）。
 * 拖动期间逐帧走的是 `persist = false`：屏幕每帧跟着动，但落盘与 aria 的数字只在松手那一下定。
 */
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

  /** 这一页当下能给的宽度上限；下限是宿主那条。 */
  const ceiling = (): number => Math.max(COLUMN_MIN, metrics.available - COLUMN_EDGE_BUDGET)
  const clamp = (value: number): number => Math.min(Math.max(Math.round(value), COLUMN_MIN), ceiling())
  /** 拖动起点：以**画出来的**宽度为准——没调过时它就是宿主那条列的宽度。 */
  const startWidth = (): number => clamp(metrics.drawn > 0 ? metrics.drawn : metrics.available)
  /** 居中列：指针往外走 1px，两侧各让 1px，宽度因此变 2px。 */
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
    // 挡掉拖出选区：这一页是可以选文本的。
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
    // 那 2px 线不画满整条手柄：它跟着指针走（每帧一次写属性，不带过渡）。
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
    // 没挪过就不提交：一次误触不该把「跟随对话正文」变成一个写死的宽度。
    if (latest.current !== origin.current) onApply(draggedWidth())
  }
  const onPointerCancel = (): void => {
    stopFrame()
    setDragging(false)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? KEY_STEP_COARSE : KEY_STEP
    // 方向键的意义是**移这枚手柄**：右手柄往右是变宽，左手柄往右是变窄。
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
  /** 滚轮落在手柄上时，滚的还是这一页——手柄只是浮在旁边的窄条，不该吃掉滚动。 */
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
