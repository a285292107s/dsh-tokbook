import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SessionStepRow, SessionUsageView } from '../types.ts'
import { QUERY_SESSION, ROUTE_SESSION } from '../route-paths.ts'
import { ledgerClockSupported, subscribeLedgerChanges } from './ledger-clock.ts'
import { readSessionView } from './session-wire.ts'

const POLL_MS = 15_000

const PANEL_GAP = 6

const VIEW_MARGIN = 8

export interface ModelLabel {
  text: string
  count: number
  title: string
}

export interface OverlayCard {
  key: string
  turn: number
  meta: string
  model: ModelLabel
  leading: ReactNode
  body: ReactNode
}

export interface SessionOverlayProps {
  sessionId?: string
  triggerTitle: string
  triggerLabel: string
  triggerIcon: ReactNode
  panelTitle: string
  panelLabel: string
  emptyText: string
  footnote: string
  skeletonClass?: string
  cards: (view: SessionUsageView) => OverlayCard[]
}

function routeWord(provider: string, labels: Readonly<Record<string, string>>): string {
  if (provider === '') return '通道未知'
  return labels[provider] ?? provider
}

function modelPairOf(row: SessionStepRow, labels: Readonly<Record<string, string>>): string {
  return `${routeWord(row.provider, labels)} / ${row.model === '' ? '模型未知' : row.model}`
}

export function modelLabelOf(rows: readonly SessionStepRow[], labels: Readonly<Record<string, string>>): ModelLabel {
  const pairs = new Set<string>()
  for (const row of rows) pairs.add(modelPairOf(row, labels))
  if (pairs.size === 0) return { text: '模型未知', count: 0, title: '' }
  const [first] = pairs
  if (pairs.size === 1) return { text: first!, count: 1, title: first! }
  return { text: first!, count: pairs.size, title: [...pairs].join(' · ') }
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

export function SessionOverlay({
  sessionId,
  triggerTitle,
  triggerLabel,
  triggerIcon,
  panelTitle,
  panelLabel,
  emptyText,
  footnote,
  skeletonClass,
  cards,
}: SessionOverlayProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<SessionUsageView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const panelId = `dtpl-ov-${useId().replaceAll(':', '')}`

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
            setError('响应不是一份会话视图')
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
    if (!open || sessionId === undefined || sessionId === '') return
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
  }, [open, sessionId])

  useEffect(() => {
    if (!open || sessionId === undefined || sessionId === '') return
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
  }, [open, close, sessionId])

  if (sessionId === undefined || sessionId === '') return null

  const current = view !== null && view.sessionId === sessionId ? view : null
  const list = current === null ? [] : cards(current)

  return (
    <div className="dtpl-ov-root" data-plugin="dsh-tokbook">
      <button
        ref={triggerRef}
        type="button"
        className="dtpl-tok-entry"
        data-plugin="dsh-tokbook"
        title={triggerTitle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {triggerIcon}
        <span className="dtpl-tok-entry-label">{triggerLabel}</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="dtpl-ov-panel"
          role="dialog"
          aria-label={panelLabel}
          tabIndex={-1}
        >
          <div className="dtpl-ov-head">
            <span className="dtpl-ov-title">{panelTitle}</span>
            <span className="dtpl-ov-sum">
              {current !== null
                ? `共 ${String(list.length)} 轮`
                : error === null ? '读取中' : '读取失败'}
            </span>
          </div>
          {current === null
            ? (error === null
                ? (
                  <div className="dtpl-ov-list" aria-hidden="true">
                    <div className={skeletonClass === undefined ? 'dtpl-ov-sk' : `dtpl-ov-sk ${skeletonClass}`} />
                  </div>
                )
                : (
                  <div className="dtpl-ov-list">
                    <p className="dtpl-ov-error">读取失败：{error}</p>
                    <button type="button" className="dtpl-ov-retry" onClick={() => setReload((value) => value + 1)}>重试</button>
                  </div>
                ))
            : list.length === 0
              ? (
                <div className="dtpl-ov-list">
                  <p className="dtpl-ov-empty">{emptyText}</p>
                </div>
              )
              : (
                <div className="dtpl-ov-list">
                  {list.map((card) => (
                    <article className="dtpl-ov-card" key={card.key}>
                      {card.leading}
                      <div className="dtpl-ov-body">
                        <div className="dtpl-ov-card-head">
                          <span className="dtpl-ov-card-k">第 {String(card.turn)} 轮</span>
                          <span className="dtpl-ov-card-meta" title={card.meta}>{card.meta}</span>
                        </div>
                        <span className="dtpl-ov-card-route" title={card.model.title === '' ? undefined : card.model.title}>
                          {card.model.text}
                          {card.model.count > 1 && <span className="dtpl-sr">；全部：{card.model.title}</span>}
                        </span>
                        {card.body}
                      </div>
                    </article>
                  ))}
                </div>
              )}
          <div className="dtpl-ov-foot">
            <span className="dtpl-ov-note">{footnote}</span>
          </div>
        </div>
      )}
    </div>
  )
}
