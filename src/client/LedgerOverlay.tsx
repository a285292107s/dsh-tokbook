import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { SyncStatusView, TokBookOverview, UsageDayRow } from '../types.ts'
import { ROUTE_OVERVIEW, ROUTE_RESCAN, ROUTE_SYNC } from '../route-paths.ts'
import type { TokBookViewStore } from './store.ts'
import { injectStyles } from './styles.ts'
import { PricingPanel } from './pricing/PricingPanel.tsx'
import { QuotaPanel } from './quota/QuotaPanel.tsx'
import { LedgerSkeleton, LedgerView } from './LedgerView.tsx'
import { ProviderPanel } from './ProviderPanel.tsx'
import { MethodDoc } from './MethodDoc.tsx'
import { CloseGlyph, RefreshGlyph, UsageGlyph } from './icons.tsx'
import { formatDateTime } from './format.ts'
import { subscribeLedgerChanges } from './ledger-clock.ts'

export interface LedgerOverlayProps {
  view: TokBookViewStore
}

const SYNC_FOLLOW_INTERVAL_MS = 500
const SYNC_FOLLOW_ATTEMPTS = 60

const OVERVIEW_REFRESH_MIN_GAP_MS = 2_000

function isBucketTotals(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false
  const totals = raw as Partial<UsageDayRow['totals']>
  return typeof totals.inputTokens === 'number'
    && typeof totals.cacheReadTokens === 'number'
    && typeof totals.cacheWriteTokens === 'number'
    && typeof totals.outputTokens === 'number'
}

function readOverview(raw: unknown): TokBookOverview | null {
  if (typeof raw !== 'object' || raw === null) return null
  const source = raw as Partial<TokBookOverview>
  if (!Array.isArray(source.byDay)) return null
  for (const row of source.byDay) {
    if (typeof row !== 'object' || row === null) return null
    const day = row as Partial<UsageDayRow>
    if (typeof day.day !== 'string' || !isBucketTotals(day.totals)) return null
  }
  if (source.lastEventAt !== null && typeof source.lastEventAt !== 'number') return null
  if (source.syncError !== null && typeof source.syncError !== 'string') return null
  if (typeof source.records !== 'number' || typeof source.dataDir !== 'string') return null
  if (source.syncStatus !== 'idle' && source.syncStatus !== 'running'
    && source.syncStatus !== 'done' && source.syncStatus !== 'error') return null
  return source as TokBookOverview
}

export function LedgerOverlay({ view }: LedgerOverlayProps) {
  useEffect(() => injectStyles(), [])
  const { open, overview, error, pricingDirty } = useSyncExternalStore(view.subscribe, view.getSnapshot)
  const [scanning, setScanning] = useState(false)
  const followRef = useRef<AbortController | null>(null)

  const lastOverviewAt = useRef(0)

  const beginFollow = useCallback((): AbortController => {
    followRef.current?.abort()
    const controller = new AbortController()
    followRef.current = controller
    return controller
  }, [])

  const fetchOverview = useCallback((signal?: AbortSignal): Promise<void> => {
    return fetch(ROUTE_OVERVIEW, { signal })
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<unknown> })
      .then((raw) => {
        if (signal?.aborted === true) return
        const next = readOverview(raw)
        if (next === null) throw new Error('响应不是一份账本概览')
        lastOverviewAt.current = Date.now()
        view.setOverview(next)
      })
      .catch((err: unknown) => { if (signal?.aborted !== true) view.setError(err instanceof Error ? err.message : String(err)) })
  }, [view])

  const fetchSyncState = useCallback((signal?: AbortSignal): Promise<SyncStatusView | null> => {
    return fetch(ROUTE_SYNC, { signal })
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<SyncStatusView> })
      .then((state) => (signal?.aborted === true ? null : state))
      .catch(() => null)
  }, [])

  const followSync = useCallback(async (signal?: AbortSignal): Promise<void> => {
    for (let attempt = 0; attempt < SYNC_FOLLOW_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, SYNC_FOLLOW_INTERVAL_MS))
      if (signal?.aborted === true) return
      const state = await fetchSyncState(signal)
      if (state !== null && state.status === 'running') continue
      await fetchOverview(signal)
      if (view.getSnapshot().overview?.syncStatus !== 'running') return
    }
    await fetchOverview(signal)
  }, [fetchOverview, fetchSyncState, view])

  useEffect(() => {
    if (!open) return
    const controller = beginFollow()
    void fetchOverview(controller.signal).then(() => {
      if (view.getSnapshot().overview?.syncStatus === 'running') return followSync(controller.signal)
    })
    return () => { controller.abort() }
  }, [open, beginFollow, fetchOverview, followSync, view])

  useEffect(() => {
    if (!open) {
      followRef.current?.abort()
      setScanning(false)
      return
    }
    return () => { followRef.current?.abort() }
  }, [open])

  const visibleTab = useRef<OverlayTab>('ledger')
  useEffect(() => {
    if (!open) return
    const unsubscribe = subscribeLedgerChanges(() => {
      if (visibleTab.current !== 'ledger') return
      if (view.getSnapshot().overview?.syncStatus === 'running') return
      if (Date.now() - lastOverviewAt.current < OVERVIEW_REFRESH_MIN_GAP_MS) return
      void fetchOverview()
    })
    return unsubscribe
  }, [open, fetchOverview, view])

  const onVisibleTab = useCallback((next: OverlayTab) => {
    const previous = visibleTab.current
    visibleTab.current = next
    if (next !== 'ledger' || previous === 'ledger') return
    if (view.getSnapshot().overview?.syncStatus === 'running') return
    if (Date.now() - lastOverviewAt.current < OVERVIEW_REFRESH_MIN_GAP_MS) return
    void fetchOverview()
  }, [fetchOverview, view])

  const onRescan = useCallback(async () => {
    const controller = beginFollow()
    setScanning(true)
    try {
      await fetch(ROUTE_RESCAN, { method: 'POST', signal: controller.signal })
        .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`) })
      await followSync(controller.signal)
    } catch (err) {
      if (!controller.signal.aborted) view.setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (followRef.current === controller) setScanning(false)
    }
  }, [beginFollow, followSync, view])

  if (!open) return null
  return (
    <OverviewCard
      overview={overview}
      error={error}
      scanning={scanning}
      pricingDirty={pricingDirty}
      onDirtyChange={view.setPricingDirty}
      onRescan={onRescan}
      onRetry={() => { view.setError(null); void fetchOverview() }}
      onRefresh={fetchOverview}
      onVisibleTab={onVisibleTab}
      onClose={() => view.setOpen(false)}
    />
  )
}

type OverlayTab = 'ledger' | 'quota' | 'pricing' | 'method'

const TAB_IDS: ReadonlyArray<OverlayTab> = ['ledger', 'quota', 'pricing', 'method']

function OverviewCard({ overview, error, scanning, pricingDirty, onDirtyChange, onRescan, onRetry, onRefresh, onVisibleTab, onClose }: {
  overview: TokBookOverview | null
  error: string | null
  scanning: boolean
  pricingDirty: boolean
  onDirtyChange: (dirty: boolean) => void
  onRescan: () => void
  onRetry: () => void
  onRefresh: () => void
  onVisibleTab: (tab: OverlayTab) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<OverlayTab>('ledger')
  const cardRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const selectTab = useCallback((next: OverlayTab) => {
    setTab(next)
    onVisibleTab(next)
  }, [onVisibleTab])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    cardRef.current?.focus()
    return () => previous?.focus()
  }, [])

  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0)
  }, [tab])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const card = cardRef.current
      if (card === null) return
      const focusables = card.querySelectorAll<HTMLElement>(
        'button:not(:disabled),[href],[tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) { e.preventDefault(); return }
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const onTablistKeyDown = useCallback((e: ReactKeyboardEvent) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    e.preventDefault()
    const next = TAB_IDS[(TAB_IDS.indexOf(tab) + delta + TAB_IDS.length) % TAB_IDS.length]!
    selectTab(next)
    document.getElementById(`dtpl-tab-${next}`)?.focus()
  }, [tab, selectTab])

  const onBackdropMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  return (
    <div className="dtpl-overlay" data-plugin="dsh-tokbook" onMouseDown={onBackdropMouseDown}>
      <div
        ref={cardRef}
        className="dtpl-card"
        role="dialog"
        aria-modal="true"
        aria-label="词元账本"
        tabIndex={-1}
      >
        <header className="dtpl-head">
          <div className="dtpl-title">
            <span className="dtpl-title-ico-chip"><UsageGlyph className="dtpl-title-ico" /></span>
            <span>词元账本</span>
          </div>
          <button type="button" className="dtpl-close" onClick={onClose} aria-label="关闭">
            <CloseGlyph className="dtpl-close-ico" />
          </button>
        </header>

        <div className="dtpl-tabs" role="tablist" aria-label="账本视图" onKeyDown={onTablistKeyDown}>
          <button
            type="button"
            role="tab"
            id="dtpl-tab-ledger"
            aria-selected={tab === 'ledger'}
            aria-controls="dtpl-panel"
            tabIndex={tab === 'ledger' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => selectTab('ledger')}
          >
            用量总览
          </button>
          <button
            type="button"
            role="tab"
            id="dtpl-tab-quota"
            aria-selected={tab === 'quota'}
            aria-controls="dtpl-panel"
            tabIndex={tab === 'quota' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => selectTab('quota')}
          >
            订阅额度
          </button>
          <button
            type="button"
            role="tab"
            id="dtpl-tab-pricing"
            aria-selected={tab === 'pricing'}
            aria-controls="dtpl-panel"
            tabIndex={tab === 'pricing' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => selectTab('pricing')}
          >
            价格表
            {pricingDirty && <i className="dtpl-tab-dot" role="img" aria-label="有未保存的改动" title="有未保存的改动" />}
          </button>
          <button
            type="button"
            role="tab"
            id="dtpl-tab-method"
            aria-selected={tab === 'method'}
            aria-controls="dtpl-panel"
            tabIndex={tab === 'method' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => selectTab('method')}
          >
            统计口径
          </button>
        </div>

        <div
          ref={bodyRef}
          className="dtpl-body"
          role="tabpanel"
          id="dtpl-panel"
          aria-labelledby={`dtpl-tab-${tab}`}
        >
          {tab === 'method'
            ? <MethodDoc overview={overview} />
            : tab === 'quota'
              ? <QuotaPanel />
              : tab === 'pricing'
                ? (
                  <PricingPanel
                    onChanged={onRefresh}
                    onDirtyChange={onDirtyChange}
                  />
                )
                : (
                <>
                  {error !== null && (
                    <div className="dtpl-error" role="alert">
                      <p className="dtpl-error-text">加载失败：{error}</p>
                      <button type="button" className="dtpl-retry" onClick={onRetry}>重试</button>
                    </div>
                  )}
                  {overview === null
                    ? <LedgerSkeleton />
                    : <LedgerView overview={overview} />}
                  <ProviderPanel />
                </>
                )}
        </div>

        {overview !== null && tab === 'ledger' && (
          <footer className="dtpl-foot">
            <span className="dtpl-foot-state">
              {overview.syncStatus === 'running' && (
                <span className="dtpl-sync dtpl-sync-running">
                  <i className="dtpl-sync-dot" aria-hidden="true" />
                  正在重新扫描…
                </span>
              )}
              {overview.syncStatus === 'error' && (
                <span className="dtpl-sync dtpl-sync-error">
                  <i className="dtpl-sync-dot" aria-hidden="true" />
                  上次重新扫描失败{overview.syncError !== null ? `：${overview.syncError}` : ''}
                </span>
              )}
              {overview.lastEventAt !== null && (
                <span className="dtpl-foot-latest">最新记录 {formatDateTime(overview.lastEventAt)}</span>
              )}
            </span>
            <button type="button" className="dtpl-rescan" onClick={onRescan} disabled={scanning}>
              <RefreshGlyph className={`dtpl-rescan-ico${scanning ? ' dtpl-spin' : ''}`} />
              {scanning ? '扫描中…' : '重新扫描'}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}
