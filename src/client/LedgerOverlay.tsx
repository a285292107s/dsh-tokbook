/**
 * 词元账本浮窗（路由 A：`shell.overlay`）——纯壳层：tab 条、面板分发与浮窗级生命周期，
 * 各 tab 内容在各自组件里。
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { SyncStatusView, TokBookOverview } from '../types.ts'
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
  /** 在飞的那一轮「重新扫描」跟随。存 ref 是为了让关窗 / 卸载能中止它——轮询本身没有生命周期。 */
  const rescanRef = useRef<AbortController | null>(null)

  const fetchOverview = useCallback((signal?: AbortSignal): Promise<void> => {
    return fetch(ROUTE_OVERVIEW, { signal })
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .then((data: TokBookOverview) => { if (!signal?.aborted) view.setOverview(data) })
      .catch((err: unknown) => { if (!signal?.aborted) view.setError(err instanceof Error ? err.message : String(err)) })
  }, [view])

  /** 只读 host 内存的同步状态探针。追 walk 落定靠它、不靠反复拉概览：概览每次都是全量
   *  聚合，而追的 tick 次数正比于 walk 耗时——那等于把负载加在正被 walk 压着的路径上。
   *  读不到就返回 null（调用方按「已落定」处理，随后照常拉一次概览：同一份包里 client 与
   *  host 同版本，探针失败只可能是路由之外的意外）。 */
  const fetchSyncState = useCallback((signal?: AbortSignal): Promise<SyncStatusView | null> => {
    return fetch(ROUTE_SYNC, { signal })
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<SyncStatusView> })
      .then((state) => (signal?.aborted === true ? null : state))
      .catch(() => null)
  }, [])

  // host 的读路径不等后台 walk（CONTRACTS §2），所以概览里的 `running` 只是那一刻的事实：
  // 打开浮窗与按下重新扫描都靠追到落定，walk 补进来的行也才会被拉回屏上。
  // 退出条件看**屏上那份快照**、不看探针：探针可能在 walk 真正开始前就报 `done`
  // （`rescan` 的 walk 是 fire-and-forget 起跑的）。所以探针说落定后仍拉一次概览，
  // 若它报 `running` 就继续追。
  const followSync = useCallback(async (signal?: AbortSignal): Promise<void> => {
    for (let attempt = 0; attempt < SYNC_FOLLOW_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, SYNC_FOLLOW_INTERVAL_MS))
      if (signal?.aborted === true) return
      const state = await fetchSyncState(signal)
      if (state !== null && state.status === 'running') continue
      await fetchOverview(signal)
      if (view.getSnapshot().overview?.syncStatus !== 'running') return
    }
    // 上限内没落定：数据仍取一次——walk 可能还在跑，状态由载荷自己说。
    await fetchOverview(signal)
  }, [fetchOverview, fetchSyncState, view])

  // 每次打开拉取一次（读到 running 则继续追到落定）。
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void fetchOverview(controller.signal).then(() => {
      if (view.getSnapshot().overview?.syncStatus === 'running') return followSync(controller.signal)
    })
    return () => { controller.abort() }
  }, [open, fetchOverview, followSync, view])

  // 关闭浮窗 / 组件卸载即中止这一轮跟随。
  useEffect(() => {
    if (!open) {
      rescanRef.current?.abort()
      return
    }
    return () => { rescanRef.current?.abort() }
  }, [open])

  // 触发一次权威再同步，然后追到落定。
  const onRescan = useCallback(async () => {
    rescanRef.current?.abort()
    const controller = new AbortController()
    rescanRef.current = controller
    setScanning(true)
    try {
      await fetch(ROUTE_RESCAN, { method: 'POST' }).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`) })
      await followSync(controller.signal)
    } catch (err) {
      // 被中止不是失败：那一轮已经随着关窗作废，报错只会把「关掉了」说成「扫不动」。
      if (!controller.signal.aborted) view.setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (rescanRef.current === controller) setScanning(false)
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
              id 比不指更糟。 */}
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
