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
      onClose={() => view.setOpen(false)}
    />
  )
}

/** Which surface of the overlay is visible. */
type OverlayTab = 'ledger' | 'provider' | 'quota' | 'method'

const TAB_IDS: ReadonlyArray<OverlayTab> = ['ledger', 'provider', 'quota', 'method']

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

function OverviewCard({ overview, error, scanning, onRescan, onRetry, onClose }: {
  overview: TokBookOverview | null
  error: string | null
  scanning: boolean
  onRescan: () => void
  onRetry: () => void
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
 * the provider's bill. Structured as 算法 → 采集范围 → 局限 → 与账单对账, so a
 * reader can stop after the first section and still be correct about the happy
 * path. The overview payload feeds one live diagnostics block at the bottom
 * (记录/日文件/最新/数据目录) — plumbing facts belong with the counting method,
 * not in the ledger tab's scroll of usage content.
 */
function MethodDoc({ overview }: { overview: TokBookOverview | null }) {
  return (
    <div className="dtpl-doc">
      <h2 className="dtpl-doc-title">tokens 是怎么算出来的</h2>
      <p>
        本插件<b>不做任何 token 估算或分词</b>。每次成功模型调用完成后，DSH
        适配层把 provider 返回的原始用量（如 DeepSeek 的 <code>prompt_tokens</code> /
        <code>completion_tokens</code>）整理成四个互斥桶，本插件原样采信并逐条落盘：
      </p>
      <ul>
        <li><b>输入</b>（<code>inputTokens</code>）— 未命中缓存的输入词元。provider 原始值里含缓存命中的部分已被适配层减去。</li>
        <li><b>缓存读取</b>（<code>cacheReadTokens</code>）— 命中前缀缓存的输入部分。</li>
        <li><b>缓存写入</b>（<code>cacheWriteTokens</code>）— 本次写入缓存的输入部分（DeepSeek 官方 API 不报此项，故通常恒为 0）。</li>
        <li><b>输出</b>（<code>outputTokens</code>）— 模型生成的全部输出（含推理词元）。</li>
      </ul>
      <p>
        展示的「累计词元」= 四桶之和；费用按每模型价格表（¥/M，时间规则 → 上下文档位
        → 峰时时段链）逐条计价后累加。单条记录的数值与 provider 上报值一致，没有舍入或采样。
      </p>

      <h2 className="dtpl-doc-title">采集范围</h2>
      <ul>
        <li><b>成功请求</b> — 会话日志里的 <code>assistant/message</code> 锚点事件，每次 provider 计费调用恰好一条。</li>
        <li><b>上下文压缩</b> — <code>compaction/summary</code> 携带 summarize 调用自身的 usage，按普通请求同样计入（可在配置中关闭）。</li>
        <li><b>失败请求</b> — <code>llm/retry</code> / 出错的 <code>turn/end</code> 只计次数（失败维度），不计词元，因此不会抬高 token 总量。</li>
        <li><b>历史回填</b> — 首次启动与「重新扫描」会从持久会话日志重放补齐，按请求 id 去重，不重复计数。</li>
      </ul>

      <h2 className="dtpl-doc-title">已知局限（账本 &lt; 实际消耗的部分）</h2>
      <p>凡 provider 已计费、但 usage 从未落盘的调用，本账本结构性看不见：</p>
      <ul>
        <li><b>会话标题生成</b> — 标题模型调用直接走底层流式接口，用量在消费处即被丢弃、不进入会话日志。这是最主要的固定漏项（每个新会话一次小请求）。</li>
        <li><b>中断流的前缀</b> — 请求被取消且 provider 未报 usage 时，已消耗的输入前缀不落盘。</li>
        <li><b>失败尝试的前缀</b> — 超时 / 连接中断的尝试可能已被 provider 计费，但账本只记失败次数。</li>
        <li><b>插件级直连调用</b> — 任何不走会话锚点机制的模型调用同理不可见。</li>
      </ul>
      <p>正常负载下账本约为实际消耗的 <b>95% 以上</b>；单请求粒度则是精确值。</p>

      <h2 className="dtpl-doc-title">口径差异（记了，但和账单对不上号的部分）</h2>
      <ul>
        <li><b>缓存写入桶</b> — DeepSeek 官方路由恒缺省（计 0）；经其他适配器的 provider（如 Anthropic）才有真实值。跨 provider 比较时注意口径。</li>
        <li><b>归因维度</b> — 本账本按会话 / 模型 / 路由记账；provider 账单按 API key 汇总。多配置共用一把 key 时只能内部自洽，无法逐条对账。</li>
        <li><b>计价是本地近似</b> — 费用来自本地价格表，若与 provider 实际费率（或其缓存折扣）不同步，金额会偏离；token 数不受影响。</li>
      </ul>

      <h2 className="dtpl-doc-title">如何验证</h2>
      <p>
        在 DeepSeek 开放平台后台按天导出用量，与本页「每日词元」对照：
        <code>cacheReadTokens ↔ prompt_cache_hit_tokens</code>、
        <code>inputTokens ↔ prompt_cache_miss_tokens</code>、
        <code>outputTokens ↔ completion_tokens</code>。
        除标题调用与失败前缀外应逐日吻合。
      </p>

      <h2 className="dtpl-doc-title">订阅额度的数据来源</h2>
      <p>
        「订阅额度」页展示的是各订阅的<b>官方账户用量</b>，由插件用你配置的 key
        直接查询服务商自己的账户接口得到——<b>不是本地推算</b>。因为订阅 key 在
        多个工具 / 设备间共享，本地账本只能看到本机的那部分，推算不出真实剩余；
        只有官方接口才掌握账号级（全部消费）口径。
      </p>
      <ul>
        <li><b>Command Code</b> — 查询官方 CLI 同款账户接口（<code>whoami</code> /
          <code>usage/summary</code> / <code>billing/credits</code> /
          <code>billing/subscriptions</code>），给出美元窗口
          <code>used/cap/exceeded/resetAt</code>、月度额度池与套餐信息。</li>
        <li><b>OpenCode Go</b> — 查询官方 usage 接口（<code>/zen/go/v1/usage</code>），
          给出三个窗口的 <code>usagePercent + resetInSec + rate-limited</code>
          （官方不返回金额，故该卡只显示百分比与重置）。</li>
      </ul>
      <p><b>Key 从哪来</b>：从 <b>DSH 凭据服务</b>（<code>ctx.credentials</code>）解析
        该 provider 的凭据引用——你在「设置 → Models」里为 commandcode /
        opencode-go 填写的 key 就存在那里，引用名默认 <code>COMMANDCODE_API_KEY</code> /
        <code>OPENCODE_GO_API_KEY</code>（可用 <code>plans.&lt;provider&gt;.apiKeyEnv</code>
        换名；也接受插件配置里的字面量 <code>apiKey</code> 覆盖）。未找到 key 时卡片显示
        “未配置”；查询失败显示原因；两者都不回退本地估算。</p>
      <p>官方数字即为权威值，但仍可能因展示延迟而滞后实时扣减；账户是否被限流
        以服务商实时判定为准。</p>

      {overview !== null && overview.dataDir !== '' && (
        <>
          <h2 className="dtpl-doc-title">数据文件状态</h2>
          <p>
            账本已记录 <b>{overview.records}</b> 条原始记录，分布在 <b>{overview.files}</b>
            个按天文件中；最新一条记录于 <b>{overview.lastEventAt === null ? '—' : formatDateTime(overview.lastEventAt)}</b>。
            数据目录：<code>{overview.dataDir}</code>。
          </p>
        </>
      )}

      <p className="dtpl-doc-foot">口径说明基于 DSH v11.9.0 源码核对 · 适配层约定：四桶互斥（billed input = input + cacheRead + cacheWrite）。</p>
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
