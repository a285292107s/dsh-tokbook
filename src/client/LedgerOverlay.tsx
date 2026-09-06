/**
 * Token-book overlay window (route A: `shell.overlay`).
 *
 * Registered into the root-scoped list slot; renders null until the store says
 * it is open, then fetches `/tokbook/overview` and presents the costed
 * aggregate: a data-first hero (total tokens + cost), the 4-bucket split, a
 * daily trend chart, a per-model breakdown with cost, a data-status line
 * (records/files/latest event), and a pinned window footer with the live
 * re-sync state + "重新扫描" button. A second tab (统计口径) documents the
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
import type { CostedModelRow, TokBookOverview, UsageDayRow, UsageRecord, UsageTotals } from '../types.ts'
import type { TokBookViewStore } from './store.ts'
import { injectStyles } from './styles.ts'
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
type OverlayTab = 'ledger' | 'method'

const TAB_IDS: ReadonlyArray<OverlayTab> = ['ledger', 'method']

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

  // Focus the card on open, restore focus to the trigger on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    cardRef.current?.focus()
    return () => previous?.focus()
  }, [])

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
          className="dtpl-body"
          role="tabpanel"
          id={`dtpl-panel-${tab}`}
          aria-labelledby={`dtpl-tab-${tab}`}
        >
          {tab === 'method'
            ? <MethodDoc />
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
            <span className={`dtpl-sync dtpl-sync-${overview.syncStatus}`}>
              <i className="dtpl-sync-dot" aria-hidden="true" />
              {syncLabel(overview.syncStatus)}
              {overview.syncStatus === 'error' && overview.syncError !== null ? `：${overview.syncError}` : ''}
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

          {overview.recent.length > 0 && <RecentList records={overview.recent} />}

          <div className="dtpl-update">更新于 {formatTime(overview.updatedAt)}</div>

          <StatusLine overview={overview} />
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
 * The 统计口径 tab: how the numbers are produced and where they stop matching
 * the provider's bill. Pure static content — no store, no fetch. Structured as
 * 算法 → 采集范围 → 局限 → 与账单对账, so a reader can stop after the first
 * section and still be correct about the happy path.
 */
function MethodDoc() {
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
      <p className="dtpl-doc-foot">口径说明基于 DSH v11.9.0 源码核对 · 适配层约定：四桶互斥（billed input = input + cacheRead + cacheWrite）。</p>
    </div>
  )
}

/** Data-status line at the bottom of the scroll area (records / files / latest). */
function StatusLine({ overview }: { overview: TokBookOverview }) {
  return (
    <div className="dtpl-status" title={overview.dataDir}>
      <span className="dtpl-status-item">记录 <b>{overview.records}</b></span>
      <span className="dtpl-status-sep" aria-hidden="true">·</span>
      <span className="dtpl-status-item">日文件 <b>{overview.files}</b></span>
      <span className="dtpl-status-sep" aria-hidden="true">·</span>
      <span className="dtpl-status-item">最新 <b className={overview.lastEventAt === null ? 'dtpl-dim' : ''}>{overview.lastEventAt === null ? '—' : formatDateTime(overview.lastEventAt)}</b></span>
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

function RecentList({ records }: { records: readonly UsageRecord[] }) {
  if (records.length === 0) return null
  return (
    <section className="dtpl-recent-sec">
      <h2 className="dtpl-sec-title">最近记录</h2>
      <div className="dtpl-recent">
        {records.slice(0, 6).map((r) => (
          <div className="dtpl-recent-row" key={r.requestId}>
            <span className="dtpl-recent-model">{r.model || '—'}</span>
            <span className="dtpl-recent-tokens">{formatTokens(usageTotal(r))}</span>
          </div>
        ))}
      </div>
    </section>
  )
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

/** Locale-aware HH:MM for the "updated at" line. */
function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

/** Locale-aware MM-DD HH:mm for the latest-event line. */
function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}
