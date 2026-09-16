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
import { LedgerSkeleton, LedgerView } from './LedgerView.tsx'
import { ProviderPanel } from './ProviderPanel.tsx'
import { MethodDoc } from './MethodDoc.tsx'
import { CloseGlyph, RefreshGlyph, UsageGlyph } from './icons.tsx'
import { formatDateTime } from './format.ts'

export interface LedgerOverlayProps {
  /** 共享 view store（inject 注入）。 */
  view: TokBookViewStore
}

/** 追一轮后台 walk 的轮询步长与上限（30 s）：够覆盖一次「整份会话日志重读」，又不至于
 *  在状态真卡住时无限打路由。 */
const SYNC_FOLLOW_INTERVAL_MS = 500
const SYNC_FOLLOW_ATTEMPTS = 60

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

  // host 的读路径刻意**不**等后台的权威 walk（D-030），所以一次读到的 `running` 只是
  // 那一刻的事实：不追它，footer 就会一直停在「正在重新扫描…」。打开浮窗（读路径自己
  // 排了 walk）与按下重新扫描（路由在扫描完成前就返回）都靠它把状态追到落定——否则
  // 不仅状态是假的，walk 补进来的行也不会出现在屏上。
  const followSync = useCallback(async (signal?: AbortSignal): Promise<void> => {
    for (let attempt = 0; attempt < SYNC_FOLLOW_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, SYNC_FOLLOW_INTERVAL_MS))
      if (signal?.aborted === true) return
      await fetchOverview(signal)
      if (view.getSnapshot().overview?.syncStatus !== 'running') return
    }
  }, [fetchOverview, view])

  // 每次打开拉取一次（读到 running 则继续追到落定）；关闭/重开后忽略过期响应。
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void fetchOverview(controller.signal).then(() => {
      if (view.getSnapshot().overview?.syncStatus === 'running') return followSync(controller.signal)
    })
    return () => { controller.abort() }
  }, [open, fetchOverview, followSync, view])

  // 触发一次权威再同步，然后轮询总览直到同步结束。
  const onRescan = useCallback(async () => {
    setScanning(true)
    try {
      await fetch('/tokbook/rescan', { method: 'POST' }).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`) })
      await followSync()
    } catch (err) {
      view.setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }, [followSync, view])

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
  const cardRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

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
          {/* 五个 tab 共指**同一个** tabpanel（`dtpl-panel`）：面板是同一个滚动容器、内容随 tab 换，
              所以每格写死一个自己的 id 会让四个 `aria-controls` 指向不存在的元素——指向一个不存在的
              id 比不指更糟（`ProviderPanel` 的切法条是同一条判据的另一处落地）。 */}
          <button
            type="button"
            role="tab"
            id="dtpl-tab-ledger"
            aria-selected={tab === 'ledger'}
            aria-controls="dtpl-panel"
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
            aria-controls="dtpl-panel"
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
            aria-controls="dtpl-panel"
            tabIndex={tab === 'provider' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => setTab('provider')}
          >
            用量明细
          </button>
          <button
            type="button"
            role="tab"
            id="dtpl-tab-pricing"
            aria-selected={tab === 'pricing'}
            aria-controls="dtpl-panel"
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
            aria-controls="dtpl-panel"
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
          id="dtpl-panel"
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
