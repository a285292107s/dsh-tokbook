/**
 * Token-book overlay window (route A: `shell.overlay`).
 *
 * Registered into the root-scoped list slot; renders null until the store says
 * it is open, then fetches `/tokbook/overview` and presents the costed
 * aggregate: a data-first hero (total tokens + cost), the 4-bucket split, a
 * daily trend chart, a per-model breakdown with cost, a data-status line
 * (records/files/latest event), and a pinned window footer with the live
 * re-sync state + "重新扫描" button. A second tab (Provider 用量) shows one
 * card per provider route over a selectable 今日 / 昨天 / 近7天 / 近30天
 * window, its own route `/tokbook/usage?range=…`. A third tab (订阅额度) shows
 * account-level subscription budgets (OpenCode Go + Command Code GOAT: dollar
 * windows) from `/tokbook/quota`. A fourth tab (统计口径) documents the
 * counting method and its known limits, so a number is never read without its
 * caveats.
 *
 * Dialog semantics: Escape and a backdrop click both close, focus moves into
 * the card on open, Tab is trapped inside while open, and focus returns to the
 * trigger on close.
 *
 * Uses DSH design tokens and owns its CSS scope.
 *
 * @module dsh-tokbook/client/LedgerOverlay
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import type {
  CostedModelRow, ProviderRange, ProviderUsageCard, ProviderUsageView, RecentLedgerEntry, TokBookOverview, UsageDayRow,
  UsageRecord, UsageTotals,
} from '../types.ts'
import type { TokBookViewStore } from './store.ts'
import { injectStyles } from './styles.ts'
import { PricingPanel } from './PricingPanel.tsx'
import { QuotaPanel } from './QuotaPanel.tsx'
import { CloseGlyph, RefreshGlyph, UsageGlyph } from './icons.tsx'

export interface LedgerOverlayProps {
  /** Shared view store (injected). */
  view: TokBookViewStore
}

export function LedgerOverlay({ view }: LedgerOverlayProps) {
  useEffect(() => injectStyles(), [])
  const { open, overview, error } = useSyncExternalStore(view.subscribe, view.getSnapshot)
  const [scanning, setScanning] = useState(false)

  const fetchOverview = useCallback((signal?: AbortSignal): Promise<void> => {
    return fetch('/tokbook/overview')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .then((data: TokBookOverview) => { if (!signal?.aborted) view.setOverview(data) })
      .catch((err: unknown) => { if (!signal?.aborted) view.setError(err instanceof Error ? err.message : String(err)) })
  }, [view])

  // Fetch once per open; ignore stale responses after close/reopen.
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void fetchOverview(controller.signal)
    return () => { controller.abort() }
  }, [open, fetchOverview])

  // Force an authoritative re-sync, then poll the overview until the sync
  // settles (the rescan route returns before the walk finishes, so a fixed
  // delay could read a mid-run snapshot).
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
      onRescan={onRescan}
      onRetry={() => { view.setError(null); void fetchOverview() }}
      onRefresh={fetchOverview}
      onClose={() => view.setOpen(false)}
    />
  )
}

/** Which surface of the overlay is visible. */
type OverlayTab = 'ledger' | 'provider' | 'quota' | 'pricing' | 'method'

const TAB_IDS: ReadonlyArray<OverlayTab> = ['ledger', 'provider', 'quota', 'pricing', 'method']

/** Provider-usage window ids in display order. */
const RANGE_IDS: ReadonlyArray<ProviderRange> = ['today', 'yesterday', 'last7', 'last30']

const RANGE_LABELS: Record<ProviderRange, string> = {
  today: '今日',
  yesterday: '昨天',
  last7: '近7天',
  last30: '近30天',
}

const RANGE_DAY_LABELS: Record<ProviderRange, string> = {
  today: '今天',
  yesterday: '昨天',
  last7: '近 7 天',
  last30: '近 30 天',
}

function OverviewCard({ overview, error, scanning, onRescan, onRetry, onRefresh, onClose }: {
  overview: TokBookOverview | null
  error: string | null
  scanning: boolean
  onRescan: () => void
  onRetry: () => void
  onRefresh: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<OverlayTab>('ledger')
  const cardRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Focus the card on open, restore focus to the trigger on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    cardRef.current?.focus()
    return () => previous?.focus()
  }, [])

  // The body is one persistent scroll container shared by every tab, so a
  // scroll offset left by one panel carries over into the next. Reset to top
  // on every tab switch (including when re-selecting the current tab).
  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0)
  }, [tab])

  // Escape closes; Tab is trapped inside the dialog while it is open.
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

  // Roving-tabindex arrow-key navigation for the tablist (automatic activation).
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

  // A click that lands on the backdrop itself (not the card) dismisses.
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
            id="dtpl-tab-provider"
            aria-selected={tab === 'provider'}
            aria-controls="dtpl-panel-provider"
            tabIndex={tab === 'provider' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => setTab('provider')}
          >
            Provider 用量
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
            id="dtpl-tab-pricing"
            aria-selected={tab === 'pricing'}
            aria-controls="dtpl-panel-pricing"
            tabIndex={tab === 'pricing' ? 0 : -1}
            className="dtpl-tab"
            onClick={() => setTab('pricing')}
          >
            价格表
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
                  ? <PricingPanel onChanged={onRefresh} />
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
              <span className={`dtpl-sync dtpl-sync-${overview.syncStatus}`}>
                <i className="dtpl-sync-dot" aria-hidden="true" />
                {syncLabel(overview.syncStatus)}
                {overview.syncStatus === 'error' && overview.syncError !== null ? `：${overview.syncError}` : ''}
              </span>
              {overview.lastEventAt !== null && (
                <>
                  <span className="dtpl-foot-sep" aria-hidden="true">·</span>
                  <span className="dtpl-foot-latest">最新 {formatDateTime(overview.lastEventAt)}</span>
                </>
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

function LedgerView({ overview }: {
  overview: TokBookOverview
}) {
  const money = (value: number): string => formatMoney(value, overview.currency, overview.usdExchangeRate)
  const empty = overview.records === 0

  return (
    <>
      {empty ? (
        <div className="dtpl-empty">
          <UsageGlyph className="dtpl-empty-ico" />
          <p className="dtpl-empty-title">尚未记录到 token 用量</p>
          <p className="dtpl-empty-sub">本插件监听模型调用的 provider usage 并逐条记录。产生对话后点击右下角“重新扫描”即可回填，或用过一段时间后这里会累计出数据。</p>
        </div>
      ) : (
        <>
          <div className="dtpl-hero">
            <div className="dtpl-hero-main">
              <span className="dtpl-total-k">累计词元</span>
              <span className="dtpl-total-num">{formatTokens(overview.totalTokens)}</span>
              <span className="dtpl-hero-cost">{money(overview.totalCost)}</span>
            </div>
            <div className="dtpl-hero-meta">
              <span className="dtpl-meta"><b className="dtpl-meta-n">{overview.sessions}</b> 会话</span>
              <span className="dtpl-meta"><b className="dtpl-meta-n">{overview.total.requests}</b> 请求</span>
              <span className={`dtpl-meta${(overview.total.failures ?? 0) > 0 ? ' dtpl-meta-warn' : ''}`}><b className="dtpl-meta-n">{(overview.total.failures ?? 0)}</b> 失败</span>
            </div>
          </div>

          <div className="dtpl-grid">
            <Stat label="输入" value={formatTokens(overview.total.inputTokens)} />
            <Stat label="缓存读取" value={formatTokens(overview.total.cacheReadTokens)} />
            <Stat label="缓存写入" value={formatTokens(overview.total.cacheWriteTokens)} />
            <Stat label="输出" value={formatTokens(overview.total.outputTokens)} />
          </div>

          <DailyTrend days={overview.byDay} />

          <ModelBreakdown byModel={overview.byModel} totalTokens={overview.totalTokens} money={money} />

          {(overview.total.compactions ?? 0) > 0 && (
            <p className="dtpl-note">其中包含 {overview.total.compactions} 次上下文压缩 summarize 调用。</p>
          )}
          {overview.unpricedModels.length > 0 && (
            <p className="dtpl-note">未定价模型（按 ¥0 计）：{overview.unpricedModels.join('、')}</p>
          )}

          {overview.recent.length > 0 && (
            <RecentList records={overview.recent} unpricedModels={overview.unpricedModels} money={money} />
          )}
        </>
      )}
    </>
  )
}

/** Placeholder blocks while the first fetch is in flight; reserves layout space. */
function LedgerSkeleton() {
  return (
    <div className="dtpl-skeleton" aria-hidden="true">
      <div className="dtpl-sk dtpl-sk-hero" />
      <div className="dtpl-sk-grid">
        <div className="dtpl-sk dtpl-sk-tile" />
        <div className="dtpl-sk dtpl-sk-tile" />
        <div className="dtpl-sk dtpl-sk-tile" />
        <div className="dtpl-sk dtpl-sk-tile" />
      </div>
      <div className="dtpl-sk dtpl-sk-chart" />
      <div className="dtpl-sk dtpl-sk-row" />
      <div className="dtpl-sk dtpl-sk-row" />
    </div>
  )
}

/**
 * The Provider-usage tab of the floating window: one card per provider, each
 * listing the models that provider billed inside the selected look-back
 * window (今日 / 昨天 / 近7天 / 近30天), with token totals and cost. Data
 * comes from its own exact route `/tokbook/usage?range=…` (the overview's
 * payload keys models by model id alone, which would merge one model billed by
 * several providers); each loaded range is cached so switching back costs no
 * refetch. Deliberately independent of the overview store — the tab stays
 * usable even while the overview fetch failed.
 */
function ProviderPanel() {
  const [range, setRange] = useState<ProviderRange>('last7')
  const [views, setViews] = useState<ReadonlyMap<ProviderRange, ProviderUsageView>>(() => new Map())
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef(0)
  // Ref mirror of the cache so `load` stays referentially stable (its identity
  // must not churn on every successful fetch, or the fetch effect re-fires).
  const viewsRef = useRef(views)
  viewsRef.current = views

  const load = useCallback(async (target: ProviderRange, force?: boolean) => {
    if (!force && viewsRef.current.has(target)) return // cached — switching back is free
    const token = ++activeRef.current
    setError(null)
    try {
      const res = await fetch(`/tokbook/usage?range=${target}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const view = await res.json() as ProviderUsageView
      if (token !== activeRef.current) return // a newer switch superseded us
      setViews((current) => {
        const next = new Map(current)
        next.set(target, view)
        return next
      })
    } catch (err) {
      if (token !== activeRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  // Fetch once per selected range; stale responses after a switch are dropped.
  useEffect(() => {
    void load(range)
  }, [range, load])

  // Bump the active token when the panel unmounts (tab switch) so an in-flight
  // response never updates state of an unmounted panel.
  useEffect(() => () => { activeRef.current += 1 }, [])

  const view = views.get(range)
  const moneyOf = (value: number): string =>
    view === undefined ? '¥0.00' : formatMoney(value, view.currency, view.usdExchangeRate)

  return (
    <section className="dtpl-provider-sec" aria-label="按 Provider 查看用量">
      <div className="dtpl-range-tabs" role="group" aria-label="时间跨度">
        {RANGE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`dtpl-range-tab${range === id ? ' dtpl-range-active' : ''}`}
            aria-pressed={range === id}
            onClick={() => setRange(id)}
          >
            {RANGE_LABELS[id]}
          </button>
        ))}
      </div>

      {error !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">Provider 用量加载失败：{error}</p>
          <button type="button" className="dtpl-retry" onClick={() => void load(range, true)}>重试</button>
        </div>
      )}

      {view === undefined && !error
        ? <ProviderSkeleton />
        : view === undefined
          ? null
          : view.providers.length === 0
            ? (
              <div className="dtpl-empty">
                <UsageGlyph className="dtpl-empty-ico" />
                <p className="dtpl-empty-title">该时间范围暂无用量</p>
                <p className="dtpl-empty-sub">{RANGE_DAY_LABELS[view.range]}没有 provider 计费记录。换个时间跨度，或点击右下角“重新扫描”回填历史。</p>
              </div>
            )
            : (
              <div className="dtpl-providers">
                {view.providers.map((card) => (
                  <ProviderCard key={card.provider} card={card} money={moneyOf} />
                ))}
              </div>
            )}
    </section>
  )
}

/** One provider card: header (provider + totals) over its model rows. */
function ProviderCard({ card, money }: { card: ProviderUsageCard; money: (value: number) => string }) {
  const cardTokens = card.tokens
  return (
    <article className="dtpl-provider-card" data-provider={card.provider}>
      <header className="dtpl-provider-head">
        <div className="dtpl-provider-id">
          <span className="dtpl-provider-name">{card.provider}</span>
          <span className="dtpl-provider-meta">
            {card.requests} 请求{card.compactions > 0 ? ` · ${card.compactions} 压缩` : ''}
            {card.unpricedModels.length > 0 ? ` · 未定价 ${card.unpricedModels.join('、')}` : ''}
          </span>
        </div>
        <div className="dtpl-provider-nums">
          <span className="dtpl-provider-tokens">{formatTokens(cardTokens)}</span>
          <span className="dtpl-provider-cost">{money(card.cost)}</span>
        </div>
      </header>
      <div className="dtpl-provider-models">
        {card.models.map((m) => (
          <div className="dtpl-row" key={m.model}>
            <div className="dtpl-model">
              <span className="dtpl-model-name">{m.model}</span>
              <span className="dtpl-model-bar" role="presentation">
                <span className="dtpl-model-bar-fill" style={{ width: `${share(m.tokens, cardTokens)}%` }} />
              </span>
            </div>
            <div className="dtpl-model-nums">
              <span className="dtpl-val">{formatTokens(m.tokens)}</span>
              <span className="dtpl-provider-model-sub">{m.totals.requests} 请求 · {money(m.cost)}</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

/** Placeholder for a range whose first fetch is in flight. */
function ProviderSkeleton() {
  return (
    <div className="dtpl-skeleton" aria-hidden="true">
      <div className="dtpl-sk dtpl-sk-card" />
      <div className="dtpl-sk dtpl-sk-card" />
      <div className="dtpl-sk dtpl-sk-card" />
    </div>
  )
}

/**
 * The 统计口径 tab: how the numbers are produced and where they stop matching
 * the provider's bill.
 *
 * Reading order follows what a skeptical user actually asks, newest first:
 *   1. 一眼看懂 — a 3-fact strip (source / precision / coverage) answers
 *      "can I trust this" before any detail;
 *   2. 词元分四桶 — the four mutually-exclusive buckets as scannable tiles
 *      with the sum equation under them;
 *   3. 记了哪些调用 — scope of the recording (what is / isn't a row);
 *   4. 差额从哪来 — the two reasons a number diverges from the bill, side by
 *      side: calls the ledger structurally cannot see vs. same facts counted
 *      under a different rule;
 *   5. 怎么核对 — 30-second field mapping against the DeepSeek console.
 * Then one cross-reference line for the 订阅额度 tab's separate (official)
 * counting rule, the live data-file diagnostics, and the source-version foot.
 *
 * Only facts worth keeping made the cut; implementation plumbing (event
 * anchor names, credential resolution) lives in the README, not this tab.
 */
function MethodDoc({ overview }: { overview: TokBookOverview | null }) {
  return (
    <div className="dtpl-doc">
      <div className="dtpl-doc-lede">
        <p>本插件<b>不估算</b>：每个数字都来自<b>本机保存的对话记录</b>。</p>
        <p>向模型提问时，提供服务的厂商（界面里叫 <b>Provider</b>，如 DeepSeek、Anthropic）会回报这次消耗了多少词元。</p>
        <p>本插件照实记录、逐条累加——不是厂商官网上的账户数据。</p>
      </div>

      {/* ── 1 · 一眼看懂：来源 / 精度 / 完整度 ── */}
      <div className="dtpl-doc-facts" aria-label="口径速览">
        <div className="dtpl-doc-fact">
          <span className="dtpl-doc-fact-k">来源</span>
          <span className="dtpl-doc-fact-v">本机对话记录，逐条统计</span>
        </div>
        <div className="dtpl-doc-fact">
          <span className="dtpl-doc-fact-k">精度</span>
          <span className="dtpl-doc-fact-v">单条照实记录，无舍入</span>
        </div>
        <div className="dtpl-doc-fact dtpl-doc-fact-key">
          <span className="dtpl-doc-fact-k">完整度</span>
          <span className="dtpl-doc-fact-v"><b className="dtpl-doc-fact-big">≈95%</b><span className="dtpl-doc-fact-tail"> 正常使用下</span></span>
        </div>
      </div>

      {/* ── 2 · 词元分四桶 ── */}
      <section className="dtpl-doc-sec">
        <h2 className="dtpl-doc-title"><span className="dtpl-doc-idx">1</span>词元分四桶</h2>
        <p className="dtpl-doc-sub">
          厂商按 <b>词元（token）</b>计费——可以理解为模型读写的最小文字单位。
        </p>
        <p className="dtpl-doc-sub">
          一次请求的用量被拆成四类、互不重复，加起来就是「累计词元」：
        </p>
        <div className="dtpl-doc-buckets">
          <Bucket name="输入" desc="你发过去、但没命中缓存的文字量。" />
          <Bucket name="缓存读取" desc="命中了缓存、不必重新计算的文字量，费率更低。" />
          <Bucket name="缓存写入" desc="写入缓存的文字量；多数厂商不上报，多为 0。" />
          <Bucket name="输出" desc="模型回复的全部文字（含思考过程）。" />
        </div>
        <div className="dtpl-doc-eq" role="note">
          <span className="dtpl-doc-eq-lead">累计词元</span>
          <span className="dtpl-doc-eq-op">=</span>
          <span className="dtpl-doc-eq-term">输入</span>
          <span className="dtpl-doc-eq-op">+</span>
          <span className="dtpl-doc-eq-term">缓存读取</span>
          <span className="dtpl-doc-eq-op">+</span>
          <span className="dtpl-doc-eq-term">缓存写入</span>
          <span className="dtpl-doc-eq-op">+</span>
          <span className="dtpl-doc-eq-term">输出</span>
        </div>
        <p className="dtpl-doc-sub">
          金额 = 按每模型价格表（每百万词元多少元）逐条计价后累加。价格表存在本机、
          可能跟不上厂商最新费率——所以<b>金额是近似值</b>，词元数不受影响。
        </p>
      </section>

      {/* ── 3 · 记了哪些调用 ── */}
      <section className="dtpl-doc-sec">
        <h2 className="dtpl-doc-title"><span className="dtpl-doc-idx">2</span>记了哪些调用</h2>
        <ul className="dtpl-doc-scope">
          <li><span className="dtpl-doc-chip">计入</span>对话中每次向模型发起请求、并成功收到回复——一次一记。</li>
          <li><span className="dtpl-doc-chip">计入</span>自动总结——对话太长时自动压缩上文，那次总结也按一次请求计费并记录（可在配置中关闭）。</li>
          <li><span className="dtpl-doc-chip dtpl-doc-chip-off">仅计次数</span>失败请求——没收到回复，不计词元、不抬高总量。</li>
          <li><span className="dtpl-doc-chip dtpl-doc-chip-off">回填</span>历史——安装前的旧记录、或当时漏记的，会按原始记录自动补齐。</li>
        </ul>
      </section>

      {/* ── 4 · 差额从哪来 ── */}
      <section className="dtpl-doc-sec">
        <h2 className="dtpl-doc-title"><span className="dtpl-doc-idx">3</span>差额从哪来</h2>
        <div className="dtpl-doc-gap">
          <article className="dtpl-doc-gap-card dtpl-doc-gap-warn">
            <h3 className="dtpl-doc-gap-title">账本会比账单少：没记到的</h3>
            <ul className="dtpl-doc-gap-list">
              <li>
                <span className="dtpl-doc-gap-item-name">自动生成的会话标题</span>
                <span className="dtpl-doc-gap-item-desc">给新对话起标题的小请求没有走常规记录通道，本账本拿不到那次用量。每个新会话发生一次，是最大的固定漏项。</span>
              </li>
              <li>
                <span className="dtpl-doc-gap-item-name">中途取消 / 出错的请求</span>
                <span className="dtpl-doc-gap-item-desc">已经发出去、但没等到厂商回复的那部分文字，厂商可能照常计费，本账本却拿不到用量。</span>
              </li>
              <li>
                <span className="dtpl-doc-gap-item-name">不走会话记录的调用</span>
                <span className="dtpl-doc-gap-item-desc">其它插件或脚本直接调用模型时，本账本同样看不到。</span>
              </li>
            </ul>
            <p className="dtpl-doc-gap-sum">同一请求不会重复计数，可以放心反复扫描——但「重新扫描」只能补齐日志里有的调用，补不回这些根本没进日志的。</p>
          </article>
          <article className="dtpl-doc-gap-card">
            <h3 className="dtpl-doc-gap-title">对不上 ≠ 记错：统计方式不同</h3>
            <ul className="dtpl-doc-gap-list">
              <li>
                <span className="dtpl-doc-gap-item-name">缓存写入常为 0</span>
                <span className="dtpl-doc-gap-item-desc">多数厂商不单独报「写入缓存」这项，所以它通常为 0，不是记漏；少数厂商（如 Anthropic）会报，对比时注意。</span>
              </li>
              <li>
                <span className="dtpl-doc-gap-item-name">记账维度不同</span>
                <span className="dtpl-doc-gap-item-desc">本账本按「这台设备上的会话」记账，账单按「账号」汇总；同一个账号在多台设备 / 多个工具里使用时，两边必然对不齐。</span>
              </li>
              <li>
                <span className="dtpl-doc-gap-item-name">金额是估算</span>
                <span className="dtpl-doc-gap-item-desc">本机价格表跟不上厂商最新费率时，金额会偏离（词元数不受影响）。</span>
              </li>
            </ul>
          </article>
        </div>
      </section>

      {/* ── 5 · 怎么核对 ── */}
      <section className="dtpl-doc-sec">
        <h2 className="dtpl-doc-title"><span className="dtpl-doc-idx">4</span>怎么核对</h2>
        <p className="dtpl-doc-sub">
          登录模型厂商的官网（如 DeepSeek 开放平台），<b>按天导出用量</b>，
          与本页「每日词元」对比。
        </p>
        <p className="dtpl-doc-sub">
          左侧是本账本，右侧是平台导出的字段：
        </p>
        <div className="dtpl-doc-map">
          <div className="dtpl-doc-map-row">
            <span className="dtpl-doc-map-side"><b>输入</b></span>
            <span className="dtpl-doc-map-arrow">↔</span>
            <span className="dtpl-doc-map-side"><code>prompt_cache_miss_tokens</code></span>
          </div>
          <div className="dtpl-doc-map-row">
            <span className="dtpl-doc-map-side"><b>缓存读取</b></span>
            <span className="dtpl-doc-map-arrow">↔</span>
            <span className="dtpl-doc-map-side"><code>prompt_cache_hit_tokens</code></span>
          </div>
          <div className="dtpl-doc-map-row">
            <span className="dtpl-doc-map-side"><b>输出</b></span>
            <span className="dtpl-doc-map-arrow">↔</span>
            <span className="dtpl-doc-map-side"><code>completion_tokens</code></span>
          </div>
        </div>
        <p className="dtpl-doc-map-note">输入、缓存读取、输出正好对应平台导出的三个字段。</p>
        <p className="dtpl-doc-map-note">除「会话标题」和「中途取消的请求」两类外，应逐日吻合。</p>
      </section>

      {/* ── 6 · 订阅额度页是另一套口径 ── */}
      <div className="dtpl-doc-quota">
        <p><b>小提示：</b>旁边的「订阅额度」页用的是<b>另一套数据</b>。</p>
        <p>它用你的账号凭据直接向厂商查询<b>官方用量</b>（含你在其它设备上的消费），与本页的本机账本不同。</p>
      </div>

      {overview !== null && overview.dataDir !== '' && (
        <div className="dtpl-doc-data">
          <p className="dtpl-doc-data-line">
            账本已记录 <b>{overview.records}</b> 条原始记录，分布在 <b>{overview.files}</b> 个按天文件中。
          </p>
          <p className="dtpl-doc-data-line">
            最新一条记录于 <b>{overview.lastEventAt === null ? '—' : formatDateTime(overview.lastEventAt)}</b>。
          </p>
          <p className="dtpl-doc-data-dir">数据目录：<code>{overview.dataDir}</code></p>
        </div>
      )}

      <p className="dtpl-doc-foot">以上口径基于当前 DSH 版本源码核对。</p>
    </div>
  )
}

/** One 词元分四桶 tile: short label + a plain-language definition. */
function Bucket({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="dtpl-doc-bucket">
      <span className="dtpl-doc-bucket-name">{name}</span>
      <span className="dtpl-doc-bucket-desc">{desc}</span>
    </div>
  )
}

function syncLabel(status: 'idle' | 'running' | 'done' | 'error'): string {
  switch (status) {
    case 'running': return '进行中'
    case 'done': return '已同步'
    case 'error': return '失败'
    default: return '待同步'
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="dtpl-stat">
      <div className="dtpl-v">{value}</div>
      <div className="dtpl-k">{label}</div>
    </div>
  )
}

/**
 * Simple daily total-token bar chart (last 30 days). Pointer users get a
 * title tooltip per bar; screen readers get one summary line with the peak,
 * so the trend is never conveyed by visuals alone.
 */
function DailyTrend({ days }: { days: readonly UsageDayRow[] }) {
  if (days.length === 0) return null
  const last = days.slice(-30)
  const max = Math.max(...last.map(row => totalsOf(row.totals)), 1)
  const peak = last.reduce((a, b) => totalsOf(a.totals) >= totalsOf(b.totals) ? a : b, last[0]!)
  const sum = last.reduce((acc, row) => acc + totalsOf(row.totals), 0)
  return (
    <section className="dtpl-trend">
      <h2 className="dtpl-sec-title">每日词元</h2>
      <div className="dtpl-bars">
        {last.map((row) => {
          const tokens = totalsOf(row.totals)
          const height = Math.max(4, Math.round((tokens / max) * 100))
          return (
            <div className="dtpl-bar" key={row.day} title={`${row.day}\n${formatTokens(tokens)}`}>
              <div className="dtpl-bar-fill" style={{ height: `${height}%` }} />
            </div>
          )
        })}
      </div>
      <div className="dtpl-trend-axis">
        <span>{last[0]!.day}</span>
        <span>{last[last.length - 1]!.day}</span>
      </div>
      <p className="dtpl-trend-sum">
        近 {last.length} 天合计 {formatTokens(sum)} 词元，峰值 {peak.day}（{formatTokens(totalsOf(peak.totals))}）。
      </p>
    </section>
  )
}

function ModelBreakdown({ byModel, totalTokens, money }: {
  byModel: readonly CostedModelRow[]
  totalTokens: number
  money: (value: number) => string
}) {
  if (byModel.length === 0) return null
  return (
    <section className="dtpl-models-sec">
      <h2 className="dtpl-sec-title">按模型</h2>
      <div className="dtpl-models">
        {byModel.map((m) => (
          <div className="dtpl-row" key={`${m.provider}/${m.model}`}>
            <div className="dtpl-model">
              <span className="dtpl-model-name">{m.model}</span>
              {m.provider !== '' && <span className="dtpl-model-provider">{m.provider}</span>}
              <span className="dtpl-model-bar" role="presentation">
                <span className="dtpl-model-bar-fill" style={{ width: `${share(totalsOf(m.totals), totalTokens)}%` }} />
              </span>
            </div>
            <div className="dtpl-model-nums">
              <span className="dtpl-val">{formatTokens(totalsOf(m.totals))}</span>
              <span className="dtpl-cost">{money(m.cost)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Newest visible ledger rows: payload holds 20, scanning stops at 10. */
const RECENT_VISIBLE = 10

function RecentList({ records, unpricedModels, money }: {
  records: readonly RecentLedgerEntry[]
  unpricedModels: readonly string[]
  money: (value: number) => string
}) {
  if (records.length === 0) return null
  const rows = records.slice(0, RECENT_VISIBLE)
  const unpriced = new Set(unpricedModels)
  const sumCost = rows.reduce((acc, r) => acc + r.cost, 0)
  return (
    <section className="dtpl-recent-sec">
      <header className="dtpl-recent-head">
        <h2 className="dtpl-sec-title">最近记录</h2>
        <span className="dtpl-recent-head-sum">近 {rows.length} 条 · 合计 {money(sumCost)}</span>
      </header>
      <ul className="dtpl-recent">
        {rows.map((r) => (
          <RecentRow key={r.requestId} record={r} unpriced={unpriced.has(r.model)} money={money} />
        ))}
      </ul>
    </section>
  )
}

/**
 * One 最近记录 row: when it happened, which model/provider/session, what kind
 * of call it was (request / compaction / failure), and what it cost. Visible
 * lines answer at a glance; the hover tooltip carries the full audit trail —
 * complete session/request ids and the four-bucket split (a cache-heavy row is
 * otherwise easy to misread as expensive). Failed attempts bill nothing, so
 * their token/cost cells show an em dash instead of pretending "0".
 */
function RecentRow({ record, unpriced, money }: {
  record: RecentLedgerEntry
  unpriced: boolean
  money: (value: number) => string
}) {
  const failed = record.kind === 'failure'
  const detail = recentDetail(record, money)
  const costTitle = failed ? undefined
    : unpriced ? '模型未定价，按 ¥0 计' : undefined
  return (
    <li
      className={`dtpl-recent-row${failed ? ' dtpl-recent-fail' : ''}`}
      title={detail}
    >
      <span className="dtpl-recent-time">{formatRelative(record.time)}</span>
      <span className="dtpl-recent-body">
        <span className="dtpl-recent-main">
          <span className="dtpl-recent-model">{record.model || '—'}</span>
          {record.kind === 'compaction' && (
            <span className="dtpl-recent-badge dtpl-badge-compact">压缩</span>
          )}
          {failed && (
            <span className="dtpl-recent-badge dtpl-badge-fail">失败</span>
          )}
        </span>
        <span className="dtpl-recent-meta">{recentMeta(record)}</span>
      </span>
      <span className="dtpl-recent-tokens">{failed ? '—' : formatTokens(usageTotal(record))}</span>
      <span
        className="dtpl-recent-cost"
        title={costTitle}
      >
        {failed ? '—' : money(record.cost)}
      </span>
    </li>
  )
}

/** The visible meta line of one row: provider · short session id (failure
 * rows lead with the failure label). Bucket details stay on the hover. */
function recentMeta(record: RecentLedgerEntry): string {
  const parts: string[] = []
  if (record.kind === 'failure') {
    parts.push(failureCodeLabel(record.failureCode))
  }
  if (record.provider !== undefined && record.provider !== '') {
    parts.push(record.provider)
  }
  parts.push(`会话 ${shortId(record.sessionId)}`)
  return parts.join(' · ')
}

/** The hover audit trail of one row: kind, model/provider/session/request ids,
 * wall time, the four-bucket split and the billed ¥. */
function recentDetail(record: RecentLedgerEntry, money: (value: number) => string): string {
  const head = record.kind === 'failure'
    ? `失败尝试${record.failureCode !== undefined ? ` · ${failureCodeLabel(record.failureCode)}` : ''}`
    : record.kind === 'compaction'
      ? '上下文压缩 summarize 调用'
      : '模型请求'
  const lines = [
    head,
    `模型 ${record.model || '(未知)'}`,
    `Provider ${record.provider ?? '(未知)'}`,
    `会话 ${record.sessionId}`,
    `请求 ${record.requestId}`,
    `时间 ${formatDateTime(record.time)}`,
  ]
  const usage = record.usage
  if (usage !== undefined) {
    lines.push(
      `输入 ${formatTokens(usage.inputTokens)} · 输出 ${formatTokens(usage.outputTokens)}`
      + ` · 缓存读取 ${formatTokens(usage.cacheReadTokens ?? 0)} · 缓存写入 ${formatTokens(usage.cacheWriteTokens ?? 0)}`,
      `共 ${formatTokens(usageTotal(record))} 词元`,
      `费用 ${money(record.cost)}`,
    )
  }
  return lines.join('\n')
}

/** Provider-neutral failure codes gain a Chinese gloss; unknown codes show raw. */
const FAILURE_LABELS: Record<string, string> = {
  RATE_LIMIT: '限流',
  QUOTA: '配额不足',
  TIMEOUT: '超时',
  CONNECTION: '连接中断',
  NETWORK: '网络错误',
  AUTH: '鉴权失败',
  SERVER: '服务端错误',
  PROTOCOL: '协议错误',
  MODEL_NOT_FOUND: '模型不可用',
  CONTEXT: '上下文超限',
}

function failureCodeLabel(code: string | undefined): string {
  if (code === undefined || code === '') return '失败'
  const label = FAILURE_LABELS[code]
  return label === undefined ? code : `${code} ${label}`
}

/** Session ids are long opaque slugs; the visible line keeps a readable head. */
function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 12)}…`
}

/** Total tokens across the four buckets of an aggregates row. */
function totalsOf(t: UsageTotals): number {
  return t.inputTokens + t.cacheReadTokens + t.cacheWriteTokens + t.outputTokens
}

/** Total tokens of one record ('' usage rows count 0). */
function usageTotal(r: UsageRecord): number {
  const u = r.usage
  if (u === undefined) return 0
  return u.inputTokens + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0) + u.outputTokens
}

/** Model share of total tokens, clamped to 0–100. */
function share(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, (value / total) * 100))
}

/** Compact token count: 517 / 12.2K / 1.2M. */
function formatTokens(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${Math.round((value / 1_000) * 10) / 10}K`
  return `${Math.round((value / 1_000_000) * 10) / 10}M`
}

/** Currency-aware money: wire amounts are RMB; USD just divides by the rate. */
function formatMoney(value: number, currency: 'CNY' | 'USD', usdExchangeRate: number): string {
  if (currency === 'USD') {
    const usd = value / (usdExchangeRate > 0 ? usdExchangeRate : 1)
    return `$${usd.toFixed(2)}`
  }
  return `¥${value.toFixed(2)}`
}

/** Locale-aware MM-DD HH:mm for the latest-event line. */
function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * A scan-friendly time for a 最近记录 row: "刚刚" under a minute, "N 分钟前"
 * / "N 小时前" for today, then the clock time (昨天 14:20), the date, and the
 * full date once the row crosses into an earlier year.
 */
function formatRelative(epochMs: number, now: Date = new Date()): string {
  const t = new Date(epochMs)
  const elapsed = now.getTime() - epochMs
  if (elapsed >= 0 && elapsed < 60_000) return '刚刚'
  if (elapsed >= 0 && elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} 分钟前`
  const sameDay = t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate()
  if (elapsed >= 0 && sameDay) return `${Math.floor(elapsed / 3_600_000)} 小时前`
  const hhmm = t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const monthDay = `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  if (t.getFullYear() === now.getFullYear()) {
    // Yesterday keeps the clock time so a row is not fully generic.
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    if (t.getFullYear() === yesterday.getFullYear() && t.getMonth() === yesterday.getMonth() && t.getDate() === yesterday.getDate()) {
      return `昨天 ${hhmm}`
    }
    return `${monthDay} ${hhmm}`
  }
  return `${String(t.getFullYear()).slice(2)}-${monthDay} ${hhmm}`
}
