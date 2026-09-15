/**
 * 词元账本浮窗（路由 A：`shell.overlay`）——纯壳层。
 *
 * 对话语义：Escape 和点背景都关闭；打开时焦点移入卡片，Tab 被困在内部，关闭后焦点回到触发按钮。
 *
 * @module dsh-tokbook/client/LedgerOverlay
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { TokBookOverview } from '../types.ts'
import type { TokBookViewStore } from './store.ts'
import { injectStyles } from './styles.ts'
import { PricingPanel } from './pricing/PricingPanel.tsx'
import { QuotaPanel } from './quota/QuotaPanel.tsx'
import type { PricingFocus } from './contract.ts'
import { LedgerSkeleton, LedgerView } from './LedgerView.tsx'
import { ProviderPanel } from './ProviderPanel.tsx'
import { MethodDoc } from './MethodDoc.tsx'
import { CloseGlyph, RefreshGlyph, UsageGlyph } from './icons.tsx'
import { formatDateTime } from './format.ts'

export interface LedgerOverlayProps {
  /** 共享 view store（inject 注入）。 */
  view: TokBookViewStore
}

export function LedgerOverlay({ view }: LedgerOverlayProps) {
  useEffect(() => injectStyles(), [])
  const { open, overview, error, pricingDirty } = useSyncExternalStore(view.subscribe, view.getSnapshot)
  const [scanning, setScanning] = useState(false)

  const fetchOverview = useCallback((signal?: AbortSignal): Promise<void> => {
    return fetch('/tokbook/overview')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .then((data: TokBookOverview) => { if (!signal?.aborted) view.setOverview(data) })
      .catch((err: unknown) => { if (!signal?.aborted) view.setError(err instanceof Error ? err.message : String(err)) })
  }, [view])

  // 每次打开拉取一次；关闭/重开后忽略过期响应。
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void fetchOverview(controller.signal)
    return () => { controller.abort() }
  }, [open, fetchOverview])

  // 触发一次权威再同步，然后轮询总览直到同步结束（再同步路由在扫描完成前就返回，固定延迟会读到中途快照）。
  const onRescan = useCallback(async () => {
    setScanning(true)
    try {
      await fetch('/tokbook/rescan', { method: 'POST' }).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`) })
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 250))
        await fetchOverview()
        if (view.getSnapshot().overview?.syncStatus !== 'running') break
      }
    } catch (err) {
      view.setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }, [fetchOverview, view])

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
      onClose={() => view.setOpen(false)}
    />
  )
}

/** 浮窗当前显示的 surface。 */
type OverlayTab = 'ledger' | 'provider' | 'quota' | 'pricing' | 'method'

const TAB_IDS: ReadonlyArray<OverlayTab> = ['ledger', 'quota', 'provider', 'pricing', 'method']

function OverviewCard({ overview, error, scanning, pricingDirty, onDirtyChange, onRescan, onRetry, onRefresh, onClose }: {
  overview: TokBookOverview | null
  error: string | null
  scanning: boolean
  pricingDirty: boolean
  onDirtyChange: (dirty: boolean) => void
  onRescan: () => void
  onRetry: () => void
  onRefresh: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<OverlayTab>('ledger')
  // 跨 tab 跳转（概览的价格未知备注）要求价格表 tab 以特定筛选打开；面板应用后清掉请求。
  const [pricingScope, setPricingScope] = useState<PricingFocus>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const openPricing = (scope: PricingFocus): void => { setPricingScope(scope); setTab('pricing') }

  // 打开时聚焦卡片，关闭时焦点回到触发按钮。
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    cardRef.current?.focus()
    return () => previous?.focus()
  }, [])

  // body 是所有 tab 共享的持久滚动容器；每次切换 tab 重置到顶部。
  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0)
  }, [tab])

  // Escape 关闭；打开时 Tab 被困在对话框内。
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

  // tablist 的 roving-tabindex 方向键导航（自动激活）。
  const onTablistKeyDown = useCallback((e: ReactKeyboardEvent) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    e.preventDefault()
    setTab((current) => {
      const next = TAB_IDS[(TAB_IDS.indexOf(current) + delta + TAB_IDS.length) % TAB_IDS.length]!
      document.getElementById(`dtpl-tab-${next}`)?.focus()
      return next
    })
  }, [])

  // 点中背景本身（非卡片）时关闭。
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
            aria-controls="dtpl-panel-ledger"
            tabIndex={tab === 'ledger' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => setTab('ledger')}
          >
            用量总览
          </button>
          <button
            type="button"
            role="tab"
            id="dtpl-tab-quota"
            aria-selected={tab === 'quota'}
            aria-controls="dtpl-panel-quota"
            tabIndex={tab === 'quota' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => setTab('quota')}
          >
            订阅额度
          </button>
          <button
            type="button"
            role="tab"
            id="dtpl-tab-provider"
            aria-selected={tab === 'provider'}
            aria-controls="dtpl-panel-provider"
            tabIndex={tab === 'provider' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => setTab('provider')}
          >
            通道用量
          </button>
          <button
            type="button"
            role="tab"
            id="dtpl-tab-pricing"
            aria-selected={tab === 'pricing'}
            aria-controls="dtpl-panel-pricing"
            tabIndex={tab === 'pricing' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => setTab('pricing')}
          >
            价格表
            {pricingDirty && <i className="dtpl-tab-dot" role="img" aria-label="有未保存的改动" title="有未保存的改动" />}
          </button>
          <button
            type="button"
            role="tab"
            id="dtpl-tab-method"
            aria-selected={tab === 'method'}
            aria-controls="dtpl-panel-method"
            tabIndex={tab === 'method' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => setTab('method')}
          >
            统计口径
          </button>
        </div>

        <div
          ref={bodyRef}
          className="dtpl-body"
          role="tabpanel"
          id={`dtpl-panel-${tab}`}
          aria-labelledby={`dtpl-tab-${tab}`}
        >
          {tab === 'method'
            ? <MethodDoc overview={overview} />
            : tab === 'provider'
              ? <ProviderPanel />
              : tab === 'quota'
                ? <QuotaPanel />
                : tab === 'pricing'
                  ? (
                    <PricingPanel
                      onChanged={onRefresh}
                      onDirtyChange={onDirtyChange}
                      focus={pricingScope}
                      onFocusHandled={() => setPricingScope(null)}
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
                      : <LedgerView overview={overview} onOpenPricing={openPricing} />}
                  </>
                  )}
        </div>

        {overview !== null && tab === 'ledger' && (
          <footer className="dtpl-foot">
            {/* 正常态（待同步 / 已同步）不占字。读者要的答案是「屏上这份数据有多新」，
                而那个时刻就是答案；插件内部状态机的名字只在该他采取行动时出现
                （正在扫 / 上次失败）。 */}
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
