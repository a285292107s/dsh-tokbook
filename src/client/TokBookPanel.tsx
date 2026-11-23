import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { SyncResultView, SyncStatusView, TokBookOverview, UsageDayRow } from '../types.ts'
import { ROUTE_OVERVIEW, ROUTE_RESCAN, ROUTE_SYNC } from '../route-paths.ts'
import type { TokBookViewStore } from './store.ts'
import { PricingPanel } from './pricing/PricingPanel.tsx'
import { QuotaSection } from './quota/QuotaSection.tsx'
import { LedgerSkeleton, LedgerView } from './LedgerView.tsx'
import { ProviderPanel } from './ProviderPanel.tsx'
import { MethodDoc } from './MethodDoc.tsx'
import { UsageGlyph } from './icons.tsx'
import { RescanButton } from './RescanButton.tsx'
import { formatDateTime, formatRelative } from './format.ts'
import { subscribeLedgerChanges } from './ledger-clock.ts'

export interface TokBookPanelProps {
  view: TokBookViewStore
}

const SYNC_FOLLOW_INTERVAL_MS = 500

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

type TokBookTab = 'ledger' | 'pricing' | 'method'

const TAB_IDS: ReadonlyArray<TokBookTab> = ['ledger', 'pricing', 'method']

function describeScanResult(result: SyncResultView): string {
  const added = result.added === 0 ? '扫描没有新记录' : `扫描补上 ${result.added} 条记录`
  return result.failedSessions === 0 ? added : `${added}，${result.failedSessions} 个会话读取失败`
}

export function TokBookPanel({ view }: TokBookPanelProps) {
  const { overview, error, pricingDirty } = useSyncExternalStore(view.subscribe, view.getSnapshot)
  const [tab, setTab] = useState<TokBookTab>('ledger')
  const [sync, setSync] = useState<SyncStatusView | null>(null)
  const [scanResult, setScanResult] = useState<SyncResultView | null>(null)
  const [scanNotice, setScanNotice] = useState<string | null>(null)
  const lastOverviewAt = useRef(0)
  const visibleTab = useRef<TokBookTab>('ledger')
  const followRun = useRef(0)
  const busy = sync?.status === 'running'
  const busyRef = useRef(busy)

  useEffect(() => { busyRef.current = busy }, [busy])

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

  const probeSync = useCallback((signal?: AbortSignal): Promise<SyncStatusView | null> => {
    return fetch(ROUTE_SYNC, { signal })
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<SyncStatusView> })
      .catch(() => null)
      .then((state) => {
        if (state === null || signal?.aborted === true) return null
        setSync(state)
        return state
      })
  }, [])

  const refresh = useCallback(async (signal?: AbortSignal): Promise<SyncStatusView | null> => {
    await fetchOverview(signal)
    if (signal?.aborted === true) return null
    return probeSync(signal)
  }, [fetchOverview, probeSync])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => { controller.abort() }
  }, [refresh])

  useEffect(() => {
    if (!busy) return
    const run = followRun.current + 1
    followRun.current = run
    const stopped = (): boolean => followRun.current !== run
    setScanResult(null)
    setScanNotice(null)
    void (async () => {
      while (!stopped()) {
        await new Promise((resolve) => setTimeout(resolve, SYNC_FOLLOW_INTERVAL_MS))
        if (stopped()) return
        const state = await probeSync()
        if (state === null) continue
        if (state.status === 'running') continue
        setScanResult(state.lastResult ?? null)
        const next = await refresh()
        if (next?.status === 'running') continue
        return
      }
    })()
    return () => { if (followRun.current === run) followRun.current += 1 }
  }, [busy, probeSync, refresh])

  useEffect(() => {
    const unsubscribe = subscribeLedgerChanges(() => {
      if (visibleTab.current !== 'ledger') return
      if (busyRef.current) return
      if (Date.now() - lastOverviewAt.current < OVERVIEW_REFRESH_MIN_GAP_MS) return
      void refresh()
    })
    return unsubscribe
  }, [refresh])

  const onVisibleTab = useCallback((next: TokBookTab) => {
    setTab(next)
    const previous = visibleTab.current
    visibleTab.current = next
    if (next !== 'ledger' || previous === 'ledger') return
    if (busyRef.current) return
    if (Date.now() - lastOverviewAt.current < OVERVIEW_REFRESH_MIN_GAP_MS) return
    void refresh()
  }, [refresh])

  const onRescan = useCallback(async () => {
    setScanNotice(null)
    setScanResult(null)
    try {
      const started = await fetch(ROUTE_RESCAN, { method: 'POST' })
        .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<{ status?: string }> })
        .then((body) => body.status !== 'skipped')
      const state = await probeSync()
      if (state?.status === 'running') return
      if (!started) setScanNotice('扫描没有启动，请稍后再试')
      setScanResult(state?.lastResult ?? null)
      await refresh()
    } catch (err) {
      view.setError(err instanceof Error ? err.message : String(err))
    }
  }, [probeSync, refresh, view])

  const syncFailure = sync?.status === 'error' ? sync.error ?? '原因不明' : null

  return (
    <div className="dtpl-page" data-plugin="dsh-tokbook" data-tab={tab}>
      <TokBookPage
        tab={tab}
        overview={overview}
        error={error}
        busy={busy}
        syncFailure={syncFailure}
        scanResult={scanResult}
        scanNotice={scanNotice}
        pricingDirty={pricingDirty}
        onDirtyChange={view.setPricingDirty}
        onRescan={onRescan}
        onRetry={() => { view.setError(null); void refresh() }}
        onRefresh={() => { void refresh() }}
        onVisibleTab={onVisibleTab}
      />
    </div>
  )
}
function LedgerHeadMeta({ overview }: { overview: TokBookOverview }) {
  return (
    <div className="dtpl-head-meta">
      <span>账本 <b>{overview.records}</b> 条</span>
    </div>
  )
}

function TokBookPage({ tab, overview, error, busy, syncFailure, scanResult, scanNotice, pricingDirty, onDirtyChange, onRescan, onRetry, onRefresh, onVisibleTab }: {
  tab: TokBookTab
  overview: TokBookOverview | null
  error: string | null
  busy: boolean
  syncFailure: string | null
  scanResult: SyncResultView | null
  scanNotice: string | null
  pricingDirty: boolean
  onDirtyChange: (dirty: boolean) => void
  onRescan: () => void
  onRetry: () => void
  onRefresh: () => void
  onVisibleTab: (tab: TokBookTab) => void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)

  const selectTab = useCallback((next: TokBookTab) => {
    onVisibleTab(next)
  }, [onVisibleTab])

  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0)
  }, [tab])

  const onTablistKeyDown = useCallback((e: ReactKeyboardEvent) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    e.preventDefault()
    const next = TAB_IDS[(TAB_IDS.indexOf(tab) + delta + TAB_IDS.length) % TAB_IDS.length]!
    selectTab(next)
    document.getElementById(`dtpl-tab-${next}`)?.focus()
  }, [tab, selectTab])

  const failedText = busy
    ? null
    : syncFailure !== null
      ? `扫描失败：${syncFailure}`
      : scanNotice
  const footText = busy
    ? '正在扫描记录…'
    : failedText ?? [
      overview !== null && overview.lastEventAt !== null ? `数据截至 ${formatRelative(overview.lastEventAt)}` : '',
      scanResult !== null ? describeScanResult(scanResult) : '',
    ].filter((part) => part !== '').join(' · ')
  const footTitle = busy || failedText !== null ? '' : [
    overview !== null && overview.lastEventAt !== null ? `最新记录 ${formatDateTime(overview.lastEventAt)}` : '',
    scanResult !== null ? `扫描完成于 ${formatDateTime(scanResult.at)}` : '',
  ].filter((part) => part !== '').join('；')
  const footTone = busy ? ' dtpl-sync-running' : failedText !== null ? ' dtpl-sync-error' : ''
  const emptyLedger = overview !== null && overview.records === 0

  return (
    <>
      <header className="dtpl-head">
        <h1 className="dtpl-title">
          <span className="dtpl-title-ico-chip"><UsageGlyph className="dtpl-title-ico" /></span>
          <span>词元账本</span>
        </h1>
        {tab === 'ledger' && overview !== null && <LedgerHeadMeta overview={overview} />}
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
          ? (
            <div className="dtpl-grid dtpl-grid-doc">
              <MethodDoc overview={overview} />
            </div>
          )
          : tab === 'pricing'
            ? (
              <div className="dtpl-grid">
                <PricingPanel
                  onChanged={onRefresh}
                  onDirtyChange={onDirtyChange}
                />
              </div>
            )
            : (
              <div className="dtpl-grid">
                {error !== null && (
                  <div className="dtpl-error dtpl-span-12" role="alert">
                    <p className="dtpl-error-text">加载失败：{error}</p>
                    <button type="button" className="dtpl-retry" onClick={onRetry}>重试</button>
                  </div>
                )}
                {overview === null
                  ? <LedgerSkeleton />
                  : <LedgerView
                      overview={overview}
                      busy={busy}
                      retry={failedText !== null}
                      onRescan={onRescan}
                      quota={<QuotaSection />}
                    />}
                {!(overview !== null && overview.records === 0) && <ProviderPanel />}
              </div>
            )}
      </div>

      {overview !== null && tab === 'ledger' && (!emptyLedger || footText !== '') && (
        <footer className="dtpl-foot">
          <span className={`dtpl-sync${footTone}`} role="status" aria-live="polite">
            {footTone === '' ? null : <i className="dtpl-sync-dot" aria-hidden="true" />}
            <span className="dtpl-sync-text" title={footTitle === '' ? undefined : footTitle}>{footText}</span>
          </span>
          {!emptyLedger && <RescanButton busy={busy} retry={failedText !== null} onRescan={onRescan} />}
        </footer>
      )}
    </>
  )
}
