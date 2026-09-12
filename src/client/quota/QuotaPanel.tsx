/**
 * 订阅额度 tab of the token-book floating window: the enabled-provider list,
 * one card per provider, and the refresh policy that keeps them current.
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
 * The markup is in `QuotaCard.tsx` and the card arithmetic in `metrics.ts`.
 *
 * @module dsh-tokbook/client/quota/QuotaPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QuotaCard, QuotaGate, QuotaView } from '../../types.ts'
import { orderQuotaProviders } from '../../quota.ts'
import { UsageGlyph } from '../icons.tsx'
import { QuotaCardView } from './QuotaCard.tsx'

/** Auto-refresh presets offered by the segmented control (0 = off). */
const AUTO_PRESETS: ReadonlyArray<{ min: number; label: string }> = [
  { min: 0, label: '关闭' },
  { min: 1, label: '1 分' },
  { min: 5, label: '5 分' },
  { min: 15, label: '15 分' },
  { min: 30, label: '30 分' },
]

/** How old served 'ok' data may be before the controller refreshes it in
 * place on tab entry. Quota windows move on a minutes scale, so anything
 * within this budget is shown as-is. */
const QUOTA_FRESH_MS = 60_000

/** Minimum gap between automatic follow-up refreshes, so rapid tab toggling
 * does not hammer the provider API. */
const QUOTA_REFRESH_COOLDOWN_MS = 30_000

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
