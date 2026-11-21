import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { SessionStepRow, SessionUsageView } from '../types.ts'
import { settleTiming } from '../types.ts'
import { QUERY_SESSION, ROUTE_SESSION } from '../route-paths.ts'
import { formatDuration } from './format.ts'
import { ClockGlyph } from './icons.tsx'
import { ledgerClockSupported, subscribeLedgerChanges } from './ledger-clock.ts'
import { PHASE_LABEL, TimeBar, TimeReads, sumSegments } from './session-timing.tsx'
import { readSessionView } from './session-wire.ts'

const POLL_MS = 15_000

const PANEL_GAP = 6

const VIEW_MARGIN = 8

interface TurnCard {
  key: string
  turn: number
  steps: number
  untimed: number
  workMs?: number
  phases: ReturnType<typeof sumSegments>
}

export interface SessionTimingEntryProps {
  sessionId?: string
  openTokens: () => void
}

function workOf(rows: readonly SessionStepRow[]): number | undefined {
  if (!rows.some((row) => row.timing !== undefined)) return undefined
  const { llmMs, toolMs } = settleTiming(rows)
  return llmMs + toolMs
}

function turnCards(view: SessionUsageView): TurnCard[] {
  const cards: TurnCard[] = []
  for (const group of view.turns) {
    if (group.turn === null) continue
    cards.push({
      key: `turn:${String(group.turn)}`,
      turn: group.turn,
      steps: group.rows.length,
      untimed: group.rows.filter((row) => row.timing?.llmMs === undefined).length,
      workMs: workOf(group.rows),
      phases: sumSegments(group.rows),
    })
  }
  return cards.reverse()
}

function placePanel(panel: HTMLDivElement, trigger: HTMLButtonElement): void {
  const anchor = trigger.getBoundingClientRect()
  const width = panel.offsetWidth
  const height = panel.offsetHeight
  const right = Math.min(
    Math.max(VIEW_MARGIN, window.innerWidth - anchor.right),
    Math.max(VIEW_MARGIN, window.innerWidth - width - VIEW_MARGIN),
  )
  const below = anchor.bottom + PANEL_GAP
  const above = anchor.top - PANEL_GAP - height
  const top = below + height <= window.innerHeight - VIEW_MARGIN || above < VIEW_MARGIN
    ? Math.min(below, Math.max(VIEW_MARGIN, window.innerHeight - VIEW_MARGIN - height))
    : above
  panel.style.top = `${String(Math.round(top))}px`
  panel.style.right = `${String(Math.round(right))}px`
  panel.style.left = 'auto'
  panel.style.bottom = 'auto'
}

export function SessionTimingEntry({ sessionId, openTokens }: SessionTimingEntryProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<SessionUsageView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const panelId = `dtpl-dur-${useId().replaceAll(':', '')}`

  const close = useCallback((restoreFocus: boolean): void => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open || sessionId === undefined || sessionId === '') return
    const controller = new AbortController()
    const url = `${ROUTE_SESSION}?${QUERY_SESSION}=${encodeURIComponent(sessionId)}`
    let pending = false
    const load = (): void => {
      if (pending || document.hidden) return
      pending = true
      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json() as Promise<unknown>
        })
        .then((raw) => {
          if (controller.signal.aborted) return
          const next = readSessionView(raw)
          if (next === null) {
            setError('响应不是一份会话词元视图')
            return
          }
          setView(next)
          setError(null)
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          setError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          pending = false
        })
    }
    load()
    const unsubscribe = subscribeLedgerChanges(load)
    const timer = setInterval(() => {
      if (!ledgerClockSupported()) load()
    }, POLL_MS)
    return () => {
      controller.abort()
      unsubscribe()
      clearInterval(timer)
    }
  }, [open, sessionId, reload])

  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const trigger = triggerRef.current
    if (panel === null || trigger === null) return
    panel.setAttribute('popover', 'manual')
    try {
      panel.showPopover()
    } catch {}
    placePanel(panel, trigger)
    const onResize = (): void => {
      placePanel(panel, trigger)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      try {
        panel.hidePopover()
      } catch {}
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target) === true) return
      if (triggerRef.current?.contains(target) === true) return
      close(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close(true)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  if (sessionId === undefined || sessionId === '') return null

  const current = view !== null && view.sessionId === sessionId ? view : null
  const cards = current === null ? [] : turnCards(current)
  const scale = Math.max(1, ...cards.map((card) => card.workMs ?? 0))

  return (
    <div className="dtpl-dur-root" data-plugin="dsh-tokbook">
      <button
        ref={triggerRef}
        type="button"
        className="dtpl-tok-entry"
        data-plugin="dsh-tokbook"
        title="查看本会话每轮耗时"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <ClockGlyph className="dtpl-tok-entry-ico" />
        <span className="dtpl-tok-entry-label">耗时</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="dtpl-dur-panel"
          role="dialog"
          aria-label="每轮耗时"
          tabIndex={-1}
        >
          <div className="dtpl-dur-head">
            <span className="dtpl-dur-title">每轮耗时</span>
            <span className="dtpl-dur-sum">
              {current !== null
                ? `共 ${String(cards.length)} 轮`
                : error === null ? '读取中' : '读取失败'}
            </span>
          </div>
          {current === null
            ? (error === null
                ? (
                  <div className="dtpl-dur-list" aria-hidden="true">
                    <div className="dtpl-dur-sk" />
                  </div>
                )
                : (
                  <div className="dtpl-dur-list">
                    <p className="dtpl-dur-error">读取失败：{error}</p>
                    <button type="button" className="dtpl-dur-retry" onClick={() => setReload((value) => value + 1)}>重试</button>
                  </div>
                ))
            : cards.length === 0
              ? (
                <div className="dtpl-dur-list">
                  <p className="dtpl-dur-empty">这个会话还没有可归属轮次的计费调用——轮间与轮次未知的用时在词元页里。</p>
                </div>
              )
              : (
                <div className="dtpl-dur-list">
                  {cards.map((card) => (
                    <article className="dtpl-dur-card" key={card.key}>
                      <div className="dtpl-dur-card-head">
                        <span className="dtpl-dur-card-k">第 {String(card.turn)} 轮</span>
                        <span className="dtpl-dur-card-meta">
                          {String(card.steps)} 步{card.workMs === undefined || card.untimed === 0 ? '' : ` · ${String(card.untimed)} 步未计时`}
                        </span>
                        <span
                          className={card.workMs === undefined ? 'dtpl-dur-card-time is-flat' : 'dtpl-dur-card-time'}
                          title={card.workMs === undefined
                            ? '未计时：没有量到模型与工具的起止事件'
                            : `引擎工作（模型用时 + 工具用时）：${formatDuration(card.workMs)}`}
                        >
                          {card.workMs === undefined ? '未计时' : formatDuration(card.workMs)}
                        </span>
                      </div>
                      {card.workMs !== undefined && card.phases.length > 0 && (
                        <>
                          <span className="dtpl-dur-card-bar">
                            <TimeBar tone="turn" scale={scale} segments={card.phases} />
                          </span>
                          <TimeReads
                            reads={card.phases.map((phase) => ({
                              key: phase.key,
                              kind: phase.kind,
                              label: PHASE_LABEL[phase.kind],
                              value: formatDuration(phase.value),
                            }))}
                          />
                        </>
                      )}
                      {card.workMs !== undefined && card.phases.length === 0 && (
                        <p className="dtpl-dur-gap">拆不开：这一轮没有量到模型与工具的起止事件。</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
          <div className="dtpl-dur-foot">
            <span className="dtpl-dur-note">本机墙钟 · 最新在前 · 不含轮间与子代理</span>
            <button
              type="button"
              className="dtpl-dur-link"
              onClick={() => {
                close(false)
                openTokens()
              }}
            >
              词元页 →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
