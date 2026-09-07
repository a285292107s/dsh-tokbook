/**
 * 订阅额度 tab of the token-book floating window.
 *
 * Renders each configured subscription's *official* account usage (fetched
 * Host-side from the provider's own endpoints; the browser never holds the
 * API key and the tab never estimates from the local ledger). Data comes from
 * its own exact route `/tokbook/quota`, independent of the overview store and
 * of the Provider-usage range selector: quota windows are budget windows with
 * reset instants, not look-back windows, and they describe the *account* (all
 * tools/devices on the same key).
 *
 * Open latency is a first-class concern: an official fetch takes a network
 * round trip but the numbers change on a minutes scale, so the tab renders
 * the *last known* card immediately (host TTL, else the host's durable
 * per-provider snapshot — no provider round trip on first paint) and only
 * refreshes when the served data is older than the freshness budget. A
 * refresh never blanks the card: old numbers stay visible until fresh ones
 * replace them in place. The only skeleton ever shown is the very first open
 * of a fresh install, when nothing is known yet.
 *
 * Card anatomy (see `QuotaCard` in types):
 *  - header identity: the worst-window ring gauge (max used %, number
 *    centered inside the ring) leads on the left in place of a monogram,
 *    followed by provider + plan/account context; a per-card refresh
 *    control (or state chip) sits on the right.
 *  - ok body, top to bottom:
 *    1. one meter row per budget window (amount windows show used/cap +
 *       remaining $; percent-only windows show used % + remaining % on the
 *       same skeleton) — Command Code ends with a "本月额度" meter row built
 *       from the monthly credit pool (see `monthlyAllowanceWindow`), so every
 *       budget reads identically;
 *    2. a thin period-activity strip (completed calls / success / tokens),
 *       only when the provider reports a usage summary;
 *    3. an "更新于 HH:mm" footnote driven by `fetchedAt` (the time of the
 *       official fetch, so a cached render is honest about its age).
 *  - unconfigured / error states: a state chip in the header + an explanatory
 *    panel (hint names the fix / reason).
 *
 * @module dsh-tokbook/client/QuotaPanel
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuotaCard, QuotaView, QuotaWindowView } from '../types.ts'
import { RefreshGlyph, UsageGlyph } from './icons.tsx'

/** What a window bar / gauge may be colored as. */
type QuotaTone = 'ok' | 'warn' | 'danger'

/** Auto-refresh presets offered by the segmented control (0 = off). */
const AUTO_PRESETS: ReadonlyArray<{ min: number; label: string }> = [
  { min: 0, label: '关闭' },
  { min: 1, label: '1 分' },
  { min: 5, label: '5 分' },
  { min: 15, label: '15 分' },
  { min: 30, label: '30 分' },
]

export function QuotaPanel() {
  const [providers, setProviders] = useState<readonly string[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [autoMinutes, setAutoMinutes] = useState(5)
  const [autoTicker, setAutoTicker] = useState(0)

  // Fetch the enabled-provider list once per mount. Fast and non-network.
  useEffect(() => {
    let cancelled = false
    setListError(null)
    fetch('/tokbook/quota')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<QuotaView>
      })
      .then((view) => {
        if (!cancelled) setProviders(view.providers)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setListError(err instanceof Error ? err.message : String(err))
          setProviders([])
        }
      })
    return () => { cancelled = true }
  }, [])

  // Auto-refresh: bump a ticker on the chosen interval (0 = off).
  useEffect(() => {
    if (autoMinutes <= 0) return
    const timer = setInterval(() => {
      setAutoTicker((t) => t + 1)
    }, autoMinutes * 60_000)
    return () => clearInterval(timer)
  }, [autoMinutes])

  const hasProviders = providers !== null && providers.length > 0
  return (
    <section className="dtpl-quota-sec" aria-label="订阅额度">
      <p className="dtpl-quota-intro">
        各订阅的<b>官方账户用量</b>（由插件用你配置的 key 直接查询服务商，含你在其它
        工具/设备上的用量；不做事后本地推算）。
      </p>

      {hasProviders && (
        <AutoRefreshControl value={autoMinutes} onChange={setAutoMinutes} />
      )}

      {listError !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">额度加载失败：{listError}</p>
          <button type="button" className="dtpl-retry" onClick={() => setListError(null)}>重试</button>
        </div>
      )}

      {providers === null && listError === null
        ? (
          <div className="dtpl-skeleton" aria-hidden="true">
            <div className="dtpl-quota-sk-card dtpl-sk" />
            <div className="dtpl-quota-sk-card dtpl-sk" />
          </div>
        )
        : !hasProviders
          ? (
            <div className="dtpl-empty">
              <UsageGlyph className="dtpl-empty-ico" />
              <p className="dtpl-empty-title">尚未配置任何订阅额度查询</p>
              <p className="dtpl-empty-sub">在插件配置的 <code>plans</code> 里为 opencode-go / commandcode 提供 API key（或登录对应官方 CLI），这里就会展示官方账户用量。</p>
            </div>
          )
          : (
            <div className="dtpl-quota-cards">
              {providers!.map((provider) => (
                <QuotaCardController key={provider} provider={provider} autoTicker={autoTicker} />
              ))}
            </div>
          )}
    </section>
  )
}

/** Segmented auto-refresh picker: 关闭 / 1 / 5 / 15 / 30 分钟. */
function AutoRefreshControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="dtpl-quota-autorefresh">
      <span className="dtpl-quota-autorefresh-label">自动刷新</span>
      <div className="dtpl-quota-autorefresh-seg" role="group" aria-label="自动刷新间隔">
        {AUTO_PRESETS.map((preset) => (
          <button
            key={preset.min}
            type="button"
            className={`dtpl-quota-autorefresh-opt${value === preset.min ? ' dtpl-quota-autorefresh-on' : ''}`}
            aria-pressed={value === preset.min}
            onClick={() => onChange(preset.min)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <span className={`dtpl-quota-autorefresh-state${value > 0 ? ' dtpl-quota-autorefresh-live' : ''}`}>
        {value > 0 ? `每 ${value} 分钟自动刷新` : '不自动刷新'}
      </span>
    </div>
  )
}

/** How old served 'ok' data may be before the controller refreshes it in
 * place on tab entry. Quota windows move on a minutes scale, so anything
 * within this budget is shown as-is. */
const QUOTA_FRESH_MS = 60_000

/** Minimum gap between automatic follow-up refreshes, so rapid tab toggling
 * does not hammer the provider API. */
const QUOTA_REFRESH_COOLDOWN_MS = 30_000

/** One card owning its own data fetch + refresh, so cards load/refresh
 * independently. `autoTicker` bumps trigger a forced refetch.
 *
 * Render model is stale-while-revalidate: the first fetch returns instantly
 * (fresh host TTL, else the host's durable last-known card — never a provider
 * round trip), and only when that served data is already old does the card
 * refresh itself in place. A refresh never blanks a rendered card: old
 * numbers stay visible and are swapped when fresh ones arrive. */
function QuotaCardController({ provider, autoTicker }: { provider: string; autoTicker: number }) {
  const [card, setCard] = useState<QuotaCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const inFlight = useRef(0)
  const lastRefreshAt = useRef(0)

  const fetchCard = useCallback((force: boolean): Promise<QuotaCard | null> => {
    const token = ++inFlight.current
    setLoading(true)
    setError(null)
    return fetch(`/tokbook/quota?provider=${encodeURIComponent(provider)}${force ? '&refresh=1' : ''}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json() as QuotaCard
      })
      .then((data) => {
        if (token !== inFlight.current) return null
        setCard(data)
        setError(null)
        return data
      })
      .catch((err: unknown) => {
        if (token !== inFlight.current) return null
        // Keep whatever card is rendered — a failed refresh must not blank
        // the last-known numbers (the error surfaces as an in-card note).
        setError(err instanceof Error ? err.message : String(err))
        return null
      })
      .finally(() => {
        if (token === inFlight.current) setLoading(false)
      })
  }, [provider])

  // Initial load (host serves fresh TTL or the durable last-known card, so
  // this resolves without waiting on the provider). If the served data is
  // already older than the freshness budget, refresh it once in place.
  useEffect(() => {
    let cancelled = false
    void fetchCard(false).then((first) => {
      if (cancelled || first === null || first.state !== 'ok' || first.fetchedAt === undefined) return
      const now = Date.now()
      if (now - first.fetchedAt <= QUOTA_FRESH_MS) return
      if (now - lastRefreshAt.current < QUOTA_REFRESH_COOLDOWN_MS) return
      lastRefreshAt.current = Date.now()
      void fetchCard(true)
    })
    return () => { cancelled = true; inFlight.current += 1 }
  }, [fetchCard])

  // Auto-refresh tick → force this card's data.
  const firstTick = useRef(true)
  useEffect(() => {
    if (firstTick.current) { firstTick.current = false; return }
    lastRefreshAt.current = Date.now()
    void fetchCard(true)
  }, [autoTicker, fetchCard])

  return (
    <QuotaCardView
      provider={provider}
      card={card}
      error={error}
      loading={loading}
      onRefresh={() => { lastRefreshAt.current = Date.now(); void fetchCard(true) }}
    />
  )
}

/** The card's shell: a header (identity + gauge/chip + refresh), then either
 * the loading placeholder, an error/hint panel, or the data body. */
function QuotaCardView({ provider, card, error, loading, onRefresh }: {
  provider: string
  card: QuotaCard | null
  error: string | null
  loading: boolean
  onRefresh: () => void
}) {
  const title = card?.title ?? provider
  const ok = card !== null && card.state === 'ok'
  const ctx = ok && card !== null ? planContext(card) : ''
  const worst = ok && card !== null ? worstPressure(card) : undefined
  const state = card?.state ?? 'loading'

  return (
    <article className="dtpl-quota-card" data-plan={provider} data-state={state}>
      <header className="dtpl-quota-head">
        <div className="dtpl-quota-id">
          {ok && card !== null && worst !== undefined ? (
            <QuotaGauge pct={worst.pct} tone={worst.tone} caption={worst.label} />
          ) : (
            <span className="dtpl-quota-state-gap" aria-hidden="true" />
          )}
          <span className="dtpl-quota-id-text">
            <span className="dtpl-quota-name">{title}</span>
            <span className="dtpl-quota-sub">{ok && card !== null ? `${provider}${ctx !== '' ? ` · ${ctx}` : ''}` : provider}</span>
          </span>
        </div>

        <div className="dtpl-quota-head-side">
          {card !== null && card.state === 'unconfigured' && (
            <span className="dtpl-quota-chip dtpl-quota-chip-muted">未配置</span>
          )}
          {card !== null && card.state === 'error' && (
            <span className="dtpl-quota-chip dtpl-quota-chip-err">查询失败</span>
          )}
          <button
            type="button"
            className="dtpl-quota-refresh"
            onClick={onRefresh}
            disabled={loading}
            aria-label={`刷新 ${title} 用量`}
            title="刷新此卡片"
          >
            <RefreshGlyph className={`dtpl-quota-refresh-ico${loading ? ' dtpl-spin' : ''}`} />
          </button>
        </div>
      </header>

      {card === null && loading ? (
        <QuotaCardSkeleton />
      ) : card === null && error !== null ? (
        <div className="dtpl-quota-msg dtpl-quota-msg-err" role="alert">
          <p className="dtpl-quota-msg-title">加载失败</p>
          <p className="dtpl-quota-msg-body">{error}</p>
          <button type="button" className="dtpl-retry" onClick={onRefresh}>重试</button>
        </div>
      ) : card === null ? (
        <p className="dtpl-quota-note">暂无数据</p>
      ) : card.state !== 'ok' ? (
        <div className={`dtpl-quota-msg dtpl-quota-msg-${card.state === 'unconfigured' ? 'muted' : 'err'}`}>
          <p className="dtpl-quota-msg-title">
            {card.state === 'unconfigured' ? '未配置 API key' : '官方查询失败'}
          </p>
          {card.message !== undefined && card.message !== '' && (
            <p className="dtpl-quota-msg-body">{card.message}</p>
          )}
        </div>
      ) : (
        <>
          {/* A rendered card is never replaced by a fetch error: a failed
              in-place refresh keeps the last-known numbers and reports the
              failure as a note above them. */}
          {error !== null && (
            <p className="dtpl-quota-stale" role="status">刷新失败（{error}），当前显示上次官方数据</p>
          )}
          <QuotaCardBody card={card} />
        </>
      )}
    </article>
  )
}

/** The data body of an ok card. Top to bottom: budget-window meter rows
 * (Command Code appends its monthly-allowance meter), activity strip,
 * freshness footnote. */
function QuotaCardBody({ card }: { card: QuotaCard }) {
  const rows = [...card.windows]
  const monthly = monthlyAllowanceWindow(card)
  if (monthly !== null) rows.push(monthly)
  return (
    <>
      {rows.length > 0 && (
        <div className="dtpl-quota-windows">
          {rows.map((window) => (
            <QuotaWindowRow key={window.id} window={window} />
          ))}
        </div>
      )}
      {card.usage !== undefined && <ActivityStrip usage={card.usage} />}
      {card.fetchedAt !== undefined && (
        <p className="dtpl-quota-updated">更新于 {formatClock(card.fetchedAt)}</p>
      )}
    </>
  )
}

/** One budget window, on one skeleton for both data shapes: label + used
 * metric on the first line, a tone meter, then remaining + reset. Money
 * windows (Command Code) show used/cap and a $-remaining; percent-only
 * windows (OpenCode Go) show used % and a remaining %. */
function QuotaWindowRow({ window }: { window: QuotaWindowView }) {
  const pct = window.usagePercent
  const tone = toneOf(pct)
  const hasAmounts = window.capUsd !== undefined && window.usedUsd !== undefined
  const metric = hasAmounts
    ? `已用 ${money(window.usedUsd!)} / ${money(window.capUsd!)}`
    : `已用 ${pct}%`
  const remaining = hasAmounts
    ? `剩 ${money(Math.max(0, (window.capUsd ?? 0) - (window.usedUsd ?? 0)))}`
    : `剩 ${Math.max(0, Math.round(100 - pct))}%`
  return (
    <div className="dtpl-quota-window" data-window={window.id} data-tone={tone}>
      <div className="dtpl-quota-window-line1">
        <span className="dtpl-quota-window-label">{window.label}</span>
        <span className="dtpl-quota-window-metric">{metric}</span>
      </div>
      <div
        className="dtpl-quota-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`${window.label} 已用 ${Math.round(pct)}%`}
      >
        <span className={`dtpl-quota-bar-fill dtpl-quota-tone-${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="dtpl-quota-window-line2">
        <span className="dtpl-quota-remaining">{remaining}</span>
        <span className={`dtpl-quota-reset${window.exceeded ? ' dtpl-quota-reset-limited' : ''}`}>
          {window.exceeded
            ? '已超限'
            : resetLabel(window)}
        </span>
      </div>
    </div>
  )
}

/** Command Code's monthly credit pool as a *window-shaped* meter row (id
 * `monthlyAllowance`), appended after the rolling window rows so every
 * budget on the card reads identically: label + used/total on the first
 * line, a tone meter, then remaining $ + reset. Needs a real period spend
 * (`usage.costUsd`) to form the total/percent — when only the remaining pool
 * is reported there is nothing to draw, so the row is omitted. */
function monthlyAllowanceWindow(card: QuotaCard): QuotaWindowView | null {
  const a = allowanceState(card)
  if (a === null || a.spent === undefined || a.total === undefined) return null
  return {
    id: 'monthlyAllowance',
    label: '本月额度',
    usagePercent: a.percent,
    exceeded: a.percent >= 100,
    resetAt: card.planInfo?.periodEnd ?? null,
    usedUsd: a.spent,
    capUsd: a.total,
  }
}

/** Shared math for the Command Code monthly allowance: remaining pool (the
 * provider-reported monthly credits), spent this cycle, and the implied total
 * (remaining + spent). null when the card reports no credit pool. */
function allowanceState(card: QuotaCard): {
  remaining: number
  spent?: number
  total?: number
  percent: number
  tone: QuotaTone
} | null {
  const monthly = card.credits?.monthlyUsd
  if (monthly === undefined) return null
  const remaining = monthly
  const spent = card.usage?.costUsd
  const total = spent !== undefined ? spent + remaining : undefined
  const percent = total !== undefined && total > 0
    ? Math.min(100, Math.max(0, (spent! / total) * 100))
    : 0
  return {
    remaining,
    spent,
    total,
    percent,
    tone: toneOf(percent),
  }
}

/** The most constrained budget on the card — whichever of the monthly
 * allowance (Command Code) or the rolling windows is closest to its cap. The
 * header ring should scream about what will actually stop you first. */
function worstPressure(card: QuotaCard): { pct: number; tone: QuotaTone; label: string } | undefined {
  let worst: { pct: number; label: string } | undefined
  const consider = (pct: number, label: string): void => {
    if (worst === undefined || pct > worst.pct) worst = { pct, label }
  }
  for (const w of card.windows) consider(w.usagePercent, w.label)
  const allowance = allowanceState(card)
  if (allowance !== null) consider(allowance.percent, '本月额度')
  if (worst === undefined) return undefined
  return { pct: worst.pct, tone: toneOf(worst.pct), label: worst.label }
}

/** Optional period-activity stat strip (Command Code): completed calls +
 * success + tokens. Slimmer than the budget meters above — this answers "is
 * my usage healthy / where did the money go", not the "how much is left"
 * question the window rows own. */
function ActivityStrip({ usage }: { usage: NonNullable<QuotaCard['usage']> }) {
  const cells: Array<{ value: string; key: string; warn?: string }> = []
  if (usage.completed !== undefined) {
    cells.push({
      value: String(usage.completed),
      key: '完成请求',
      warn: usage.failed !== undefined && usage.failed > 0 ? `${usage.failed} 失败` : undefined,
    })
  }
  if (usage.successRate !== undefined) {
    cells.push({ value: `${usage.successRate}%`, key: '成功率' })
  }
  if (usage.tokensIn !== undefined || usage.tokensOut !== undefined) {
    cells.push({
      value: `${formatTokens(usage.tokensIn ?? 0)} / ${usage.tokensOut !== undefined ? formatTokens(usage.tokensOut) : '—'}`,
      key: '词元（入/出）',
    })
  }
  if (cells.length === 0) return null
  return (
    <div className="dtpl-quota-stats">
      {cells.map((cell) => (
        <div className="dtpl-quota-stat" key={cell.key}>
          <span className="dtpl-quota-stat-v">
            {cell.value}
            {cell.warn !== undefined && <i className="dtpl-quota-stat-warn">{cell.warn}</i>}
          </span>
          <span className="dtpl-quota-stat-k">{cell.key}</span>
        </div>
      ))}
    </div>
  )
}

/** Ring gauge showing the card's worst (max) window usage. Sits in the
 * header identity slot on the card's leading edge (where the plan monogram
 * used to be): the ring stroke carries the tone and the used-% number is
 * centered *inside* the ring. The window it summarizes is exposed via the
 * accessible name / tooltip rather than a visible caption, keeping the
 * identity row compact. */
function QuotaGauge({ pct, tone, caption }: { pct: number; tone: QuotaTone; caption?: string }) {
  const p = Math.max(0, Math.min(100, pct))
  const R = 15.5
  const C = 2 * Math.PI * R
  const label = caption ?? '当前窗口'
  return (
    <div
      className={`dtpl-quota-gauge dtpl-quota-tone-${tone}`}
      role="img"
      aria-label={`${label} 已用 ${Math.round(p)}%`}
      title={`${label} 已用 ${Math.round(p)}%`}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true" className="dtpl-quota-gauge-svg">
        <circle className="dtpl-quota-gauge-track" cx="20" cy="20" r={R} />
        <circle
          className="dtpl-quota-gauge-fill"
          cx="20"
          cy="20"
          r={R}
          strokeDasharray={`${(p / 100) * C} ${C}`}
        />
      </svg>
      <span className="dtpl-quota-gauge-n" aria-hidden="true">
        {Math.round(p)}<i>%</i>
      </span>
    </div>
  )
}

/** Loading placeholder shaped like the real card (reserved geometry). */
function QuotaCardSkeleton() {
  return (
    <div className="dtpl-quota-sk-body" aria-hidden="true">
      <div className="dtpl-quota-sk-line dtpl-sk" />
      <div className="dtpl-quota-sk-bar dtpl-sk" />
      <div className="dtpl-quota-sk-line dtpl-quota-sk-line-short dtpl-sk" />
      <div className="dtpl-quota-sk-bar dtpl-sk" />
    </div>
  )
}

/** Account/plan context for the card subtitle (e.g. `user · GOAT`). Billing
 * resets live on the window rows (Command Code's monthly-allowance meter
 * shows its own countdown), so the subtitle stays identity-only. */
function planContext(card: QuotaCard): string {
  const bits: string[] = []
  const account = card.account?.name
  if (account !== undefined && account !== '') bits.push(account)
  const planName = card.planInfo?.name
  if (planName !== undefined && planName !== '') {
    const status = card.planInfo?.status
    bits.push(status !== undefined && status !== 'active' && status !== ''
      ? `${planName}（${status}）`
      : planName)
  }
  const periodEnd = card.planInfo?.periodEnd
  if (card.credits === undefined
    && periodEnd !== undefined && periodEnd !== null && periodEnd > 0) {
    bits.push(`至 ${new Date(periodEnd).toLocaleDateString()}`)
  }
  return bits.join(' · ')
}

/** Tone by used percent: green < 60, amber < 85, red beyond. */
function toneOf(pct: number): QuotaTone {
  if (pct >= 85) return 'danger'
  if (pct >= 60) return 'warn'
  return 'ok'
}

/** "重置" countdown text of one window. */
function resetLabel(window: QuotaWindowView): string {
  if (window.resetAt === null) return '—'
  const ms = window.resetAt - Date.now()
  if (ms <= 0) return '即将重置'
  const totalMin = Math.ceil(ms / 60_000)
  if (totalMin < 60) return `${totalMin} 分钟后重置`
  const totalHours = Math.ceil(totalMin / 60)
  if (totalHours < 24) return `${totalHours} 小时后重置`
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours > 0 ? `${days} 天 ${hours} 小时后重置` : `${days} 天后重置`
}

/** USD money format (wire amounts are already USD). */
function money(value: number): string {
  return `$${value.toFixed(2)}`
}

/** Compact token count (Command Code usage summary). */
function formatTokens(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${Math.round(value / 100) / 10}K`
  return `${Math.round(value / 100_000) / 10}M`
}

/** HH:mm of a fetch timestamp, shown in the card footnote. */
function formatClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
