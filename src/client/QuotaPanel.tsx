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
 * Card order: the host's list is the base order, and cards that turn out to
 * have no in-force subscription are demoted below the rest as they resolve
 * (`orderQuotaProviders`) — the tab should open on the plans that can actually
 * be spent, not on a retired one. Each card owns its own fetch, so the order is
 * learned one card at a time and a card moves at most once, when its first
 * response lands.
 *
 * Card anatomy (see `QuotaCard` in types):
 *  - header identity: a ring gauge leads on the left in place of a monogram,
 *    followed by provider + plan/account context. The ring answers one fixed
 *    question — this month's budget used (Command Code: the monthly credit
 *    pool; OpenCode Go: the official `monthly` window) — and names itself
 *    with a small visible caption beneath the number, so it never silently
 *    means a different window; a card with no monthly measure falls back to
 *    its tightest rolling window, still captioned. On the right sits the
 *    "更新于 HH:mm" freshness label driven by `fetchedAt` (the time of the
 *    official fetch, so a cached render is honest about its age), in front
 *    of the per-card refresh control (or a state chip).
 *  - ok body, top to bottom:
 *    1. one meter row per budget window (amount windows show used/cap +
 *       remaining $; percent-only windows show used % + remaining % on the
 *       same skeleton) — Command Code ends with a "本月额度" meter row built
 *       from the monthly credit pool (see `monthlyAllowanceWindow`), so every
 *       budget reads identically;
 *    2. a thin period-activity strip (completed calls / success / tokens),
 *       only when the provider reports a usage summary.
 *  - non-subscription gates: a card whose account has no in-force subscription
 *    renders a different body, because the provider's rolling windows pace an
 *    in-force plan's included monthly credits only. `gate: 'balance'` (a lapsed
 *    plan, or a pay-as-you-go account) hides the window rows, drops the ring (a
 *    balance has no denominator) and leads with the credit balance and its
 *    sources — including the top-up/free credits that outlive a plan.
 *    `gate: 'none'` (OpenCode Go: valid key, no subscription, and an endpoint
 *    that reports no balance at all) shows the state and nothing else, since
 *    there is no number this card could honestly put on screen. Both are
 *    skipped by auto-refresh: nothing they report moves on a minutes scale, and
 *    the manual + on-open refreshes still pick up a renewal.
 *  - unconfigured / error states: a state chip in the header + an explanatory
 *    panel (hint names the fix / reason).
 *
 * @module dsh-tokbook/client/QuotaPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QuotaCard, QuotaGate, QuotaView, QuotaWindowView } from '../types.ts'
import { orderQuotaProviders } from '../quota.ts'
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
  /** Last gate each card reported, keyed by provider. Cards fetch and load
   *  independently (that is the point of the per-provider route), so the panel
   *  cannot know the order up front — it learns each card's gate as that card
   *  resolves. Only known gates are stored: an absent entry means "not known
   *  yet", which orders as active, the same way an absent gate renders. */
  const [gates, setGates] = useState<Readonly<Record<string, QuotaGate>>>({})

  // Stable identity on purpose: the cards take this as a prop and hold it in
  // their fetch callback's deps, so a new function on every render would
  // rebuild that callback and re-run their mount effect (a refetch loop).
  const reportGate = useCallback((provider: string, gate: QuotaGate | undefined) => {
    setGates((prev) => {
      if (prev[provider] === gate) return prev
      const next = { ...prev }
      if (gate === undefined) delete next[provider]
      else next[provider] = gate
      return next
    })
  }, [])

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
  // Display order: retired plans last (see `orderQuotaProviders`). Recomputed
  // as cards report their gate, which is why it lives here and not in the host's
  // list payload — the host's list is static and un-fetched, while the truth
  // arrives one card at a time.
  const ordered = useMemo(
    () => (providers === null ? [] : orderQuotaProviders(providers, (provider) => gates[provider])),
    [providers, gates],
  )
  return (
    <section className="dtpl-quota-sec" aria-label="订阅额度">
      <p className="dtpl-quota-intro">
        各订阅的<b>官方账户用量</b>（由插件用你配置的 key 直接向该通道方查询）。
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
              {ordered.map((provider) => (
                <QuotaCardController
                  key={provider}
                  provider={provider}
                  autoTicker={autoTicker}
                  onGate={reportGate}
                />
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
function QuotaCardController({ provider, autoTicker, onGate }: {
  provider: string
  autoTicker: number
  /** Reports this card's gate to the panel, which orders the cards with it.
   *  Must have a stable identity (the panel memoizes it) — it sits in
   *  `fetchCard`'s deps, which the mount effect keys off. */
  onGate: (provider: string, gate: QuotaGate | undefined) => void
}) {
  const [card, setCard] = useState<QuotaCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const inFlight = useRef(0)
  const lastRefreshAt = useRef(0)
  /** The rendered card, readable from the timer effect without making the
   *  effect depend on it (which would restart the interval on every fetch). */
  const cardRef = useRef<QuotaCard | null>(null)

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
        cardRef.current = data
        setCard(data)
        setError(null)
        // Report after the supersede check, so only the response that actually
        // became this card's state can move it in the order. A successful
        // response carrying no gate (a fetch failed server-side, or the key is
        // gone) reports `undefined` and drops the entry: we no longer know the
        // gate, and that card renders as a state panel — not as a retired plan.
        // A *failed* refresh never reaches here, because it deliberately keeps
        // the rendered card, so that card's gate still stands.
        onGate(provider, data.gate)
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
  }, [provider, onGate])

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

  // Auto-refresh tick → force this card's data. A non-subscription card is
  // skipped: nothing it reports moves on a minutes scale, because the rolling
  // windows that would move are not a bound the account is under. Its balance
  // changes only when the user spends or tops up, and both the manual refresh
  // button and the on-open freshness refresh above still re-hit the provider —
  // so a renewal or a top-up is picked up on the next click or open, without
  // polling an API that has nothing new to say.
  const firstTick = useRef(true)
  useEffect(() => {
    if (firstTick.current) { firstTick.current = false; return }
    const gate = cardRef.current?.gate
    if (gate !== undefined && gate !== 'subscription') return
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

/** The card's shell: a header (identity + freshness + gauge/chip + refresh),
 * then either the loading placeholder, an error/hint panel, or the data
 * body. */
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
  const ring = ok && card !== null ? ringPressure(card) : undefined
  const state = card?.state ?? 'loading'
  // One-shot click feedback: re-trigger the pop animation on every press even
  // though the button flips to `disabled` (spinner) immediately after.
  const [popTick, setPopTick] = useState(0)

  const handleRefresh = () => {
    setPopTick((t) => t + 1)
    onRefresh()
  }

  return (
    <article className="dtpl-quota-card" data-plan={provider} data-state={state}>
      <header className="dtpl-quota-head">
        <div className="dtpl-quota-id">
          {ok && card !== null && ring !== undefined ? (
            <QuotaGauge pct={ring.pct} tone={ring.tone} cap={ring.cap} />
          ) : (
            <span className="dtpl-quota-state-gap" aria-hidden="true" />
          )}
          <span className="dtpl-quota-id-text">
            <span className="dtpl-quota-name">{title}</span>
            <span className="dtpl-quota-sub">{ok && card !== null ? `${provider}${ctx !== '' ? ` · ${ctx}` : ''}` : provider}</span>
          </span>
        </div>

        <div className="dtpl-quota-head-side">
          {ok && card !== null && card.fetchedAt !== undefined && (
            <span className="dtpl-quota-updated">更新于 {formatClock(card.fetchedAt)}</span>
          )}
          {card !== null && card.gate !== undefined && card.gate !== 'subscription' && (
            <span className="dtpl-quota-chip dtpl-quota-chip-gate">无生效订阅</span>
          )}
          {card !== null && card.state === 'unconfigured' && (
            <span className="dtpl-quota-chip dtpl-quota-chip-muted">未配置</span>
          )}
          {card !== null && card.state === 'error' && (
            <span className="dtpl-quota-chip dtpl-quota-chip-err">查询失败</span>
          )}
          <button
            type="button"
            className="dtpl-quota-refresh"
            onClick={handleRefresh}
            disabled={loading}
            aria-label={`刷新 ${title} 用量`}
            title="刷新此卡片"
          >
            {/* The wrapper owns the one-shot click pop; remounting it via `key`
                restarts the animation on every press even though the button
                flips to disabled (spinner) in the same render. The glyph
                inside keeps the rotation spinner — separate elements, so the
                two transform animations never fight. */}
            <span key={popTick} className={`dtpl-quota-refresh-anim${popTick > 0 ? ' dtpl-quota-refresh-pop' : ''}`}>
              <RefreshGlyph className={`dtpl-quota-refresh-ico${loading ? ' dtpl-spin' : ''}`} />
            </span>
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
 * (Command Code appends its monthly-allowance meter, plus its top-up balance
 * when it has one), activity strip. The freshness label lives in the header
 * next to the refresh control. A balance-gated card gets a different body. */
function QuotaCardBody({ card }: { card: QuotaCard }) {
  if (card.gate === 'balance') return <QuotaBalanceBody card={card} />
  if (card.gate === 'none') return <QuotaNoSubscriptionBody card={card} />
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
      {card.credits !== undefined && extraCreditsUsd(card.credits) > 0 && (
        <CreditSources credits={card.credits} extraOnly />
      )}
      {card.usage !== undefined && <ActivityStrip usage={card.usage} />}
    </>
  )
}

/** Body of a `none`-gated card: no in-force subscription *and* no balance the
 *  provider's endpoint reports (OpenCode Go exposes window percentages only).
 *  There is nothing this card can put a number on, so it says the state and how
 *  to get out of it — the one thing it must not do is draw the windows, whose
 *  percentages would read as headroom the account does not have. This is the
 *  same instinct as the `unconfigured` / `error` panels, but the state is not a
 *  failure: the key is valid and the provider answered. */
function QuotaNoSubscriptionBody({ card }: { card: QuotaCard }) {
  return (
    <div className="dtpl-quota-msg dtpl-quota-msg-muted">
      <p className="dtpl-quota-msg-title">无生效中的订阅</p>
      {card.gateNote !== undefined && card.gateNote !== '' && (
        <p className="dtpl-quota-msg-body">{card.gateNote}</p>
      )}
    </div>
  )
}

/** Body of a balance-gated card: the account has no in-force subscription, so
 *  the rolling windows are not a bound it is under and are hidden, and the ring
 *  goes with them (no denominator). What replaces them is the number the
 *  provider actually gates on — the credit balance, of which top-up and free
 *  credits survive a lapsed plan and included monthly credits do not — so the
 *  sources are spelled out rather than folded into one amount the user cannot
 *  check against the billing page. */
function QuotaBalanceBody({ card }: { card: QuotaCard }) {
  return (
    <>
      <div className="dtpl-quota-balance">
        <span className="dtpl-quota-balance-v">{money(balanceUsd(card.credits))}</span>
        <span className="dtpl-quota-balance-k">按量余额</span>
      </div>
      {card.gateNote !== undefined && card.gateNote !== '' && (
        <p className="dtpl-quota-balance-note">{card.gateNote}</p>
      )}
      {card.credits !== undefined && <CreditSources credits={card.credits} />}
      {card.usage !== undefined && <ActivityStrip usage={card.usage} />}
    </>
  )
}

/** Sum of the three credit sources the provider reports — the same
 *  `remainingCredits` the reference implementation derives, and the whole of
 *  what bounds an account with no in-force subscription. */
function balanceUsd(credits: QuotaCard['credits']): number {
  if (credits === undefined) return 0
  return (credits.monthlyUsd ?? 0) + (credits.purchasedUsd ?? 0) + (credits.freeUsd ?? 0)
}

/** Top-up + free credits: the part of the balance that outlives a plan and
 *  that the provider spends *first* once a rolling window is hit, so it
 *  explains a card whose monthly pool still reads as untouched. */
function extraCreditsUsd(credits: NonNullable<QuotaCard['credits']>): number {
  return (credits.purchasedUsd ?? 0) + (credits.freeUsd ?? 0)
}

/** The credit sources as one compact line (`月额度 $x · 已购 $y · 赠送 $z`).
 *  These used to be fetched and then never rendered: the balance that decides
 *  whether a lapsed account can still call anything was invisible. On a
 *  balance-gated card all three are named; on an in-force card only the extras
 *  are (the included monthly pool is already the 本月额度 meter). A source the
 *  provider reports as exactly zero is left out — and a line with nothing left
 *  to say is dropped, since the balance above it already reads `$0.00`. */
function CreditSources({ credits, extraOnly = false }: {
  credits: NonNullable<QuotaCard['credits']>
  extraOnly?: boolean
}) {
  const parts: string[] = []
  const add = (label: string, value: number | undefined) => {
    if (value !== undefined && value > 0) parts.push(`${label} ${money(value)}`)
  }
  if (!extraOnly) add('月额度', credits.monthlyUsd)
  add('已购', credits.purchasedUsd)
  add('赠送', credits.freeUsd)
  if (parts.length === 0) return null
  const text = parts.join(' · ')
  return <p className="dtpl-quota-sources">{extraOnly ? `额外余额 ${text}` : text}</p>
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

/** What the header ring summarizes. The ring answers one *fixed* question —
 * how much of the month's budget the account has used — instead of whichever
 * rolling window happens to be tightest. A "worst window" headline made the
 * referent ambiguous (the user could not tell 5 小时 / 本周 / 本月 apart, and
 * the % jumped when a rolling window reset even though nothing was spent).
 *
 * Command Code reports no official monthly window, so its monthly measure is
 * the credit-pool allowance (`allowanceState` — the same 本月额度 the body
 * row draws). OpenCode Go reports an official `monthly` window. Only when a
 * card carries no monthly measure at all does the ring fall back to the
 * tightest rolling window — and `cap` then names that window, so the ring's
 * referent is never implicit. */
function ringPressure(card: QuotaCard): { pct: number; tone: QuotaTone; cap: string } | undefined {
  // Nothing to be a percentage *of*: a non-subscription card is not under its
  // window limits at all, and the body hides or omits those rows — so a ring
  // drawn from one (or from the fallback below) would summarize a number the
  // card does not show. A balance has no denominator, so it is shown as an
  // amount instead (see QuotaBalanceBody); a `none` card has no number at all.
  if (card.gate !== undefined && card.gate !== 'subscription') return undefined
  const monthly = card.windows.find((w) => w.id === 'monthly')
  if (monthly !== undefined) {
    return { pct: monthly.usagePercent, tone: toneOf(monthly.usagePercent), cap: '本月' }
  }
  const allowance = allowanceState(card)
  if (allowance !== null && allowance.spent !== undefined && allowance.total !== undefined) {
    return { pct: allowance.percent, tone: allowance.tone, cap: '本月' }
  }
  let worst: QuotaWindowView | undefined
  for (const w of card.windows) {
    if (worst === undefined || w.usagePercent > worst.usagePercent) worst = w
  }
  if (worst === undefined) return undefined
  return { pct: worst.usagePercent, tone: toneOf(worst.usagePercent), cap: worst.label }
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

/** Ring gauge heading the card's identity row (where the plan monogram used
 * to be). The ring stroke carries the tone and the used-% number is centered
 * *inside* the ring; the budget that % refers to (normally 本月 — see
 * `ringPressure`) is written as a small caption beneath the number, so the
 * ring never silently means a different window. The same text feeds the
 * accessible name / tooltip. */
function QuotaGauge({ pct, tone, cap }: { pct: number; tone: QuotaTone; cap: string }) {
  const p = Math.max(0, Math.min(100, pct))
  const R = 15.5
  const C = 2 * Math.PI * R
  return (
    <span
      className={`dtpl-quota-gauge dtpl-quota-tone-${tone}`}
      role="img"
      aria-label={`${cap} 已用 ${Math.round(p)}%`}
      title={`${cap} 已用 ${Math.round(p)}%`}
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
        <span>{Math.round(p)}<i>%</i></span>
        <span className="dtpl-quota-gauge-cap">{cap}</span>
      </span>
    </span>
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
  if (card.gate !== 'balance' && card.gate !== 'none'
    && card.credits === undefined
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

/** HH:mm of a fetch timestamp, shown next to the card's refresh control. */
function formatClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
