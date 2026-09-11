/**
 * 通道用量 tab: one card per provider route over a selectable window.
 *
 * Data comes from `GET /tokbook/usage?range=…`. Deliberately independent of
 * the overview store — the tab stays usable even while the overview failed.
 *
 * @module dsh-tokbook/client/ProviderPanel
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProviderRange, ProviderUsageCard, ProviderUsageView } from '../types.ts'
import { UsageGlyph } from './icons.tsx'
import { formatMoney, formatTokens, share } from './format.ts'

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

/**
 * The 通道用量 tab of the floating window: one card per provider, each
 * listing the models that provider billed inside the selected look-back
 * window (今日 / 昨天 / 近7天 / 近30天), with token totals and cost. Data
 * comes from its own exact route `/tokbook/usage?range=…` (the overview's
 * payload keys models by model id alone, which would merge one model billed by
 * several providers); each loaded range is cached so switching back costs no
 * refetch.
 */
export function ProviderPanel() {
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
  const moneyOf = (value: number): string => formatMoney(value)

  return (
    <section className="dtpl-provider-sec" aria-label="按通道查看用量">
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
          <p className="dtpl-error-text">通道用量加载失败：{error}</p>
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
                <p className="dtpl-empty-sub">{RANGE_DAY_LABELS[view.range]}没有通道计费记录。换个时间跨度，或点击右下角“重新扫描”回填历史。</p>
              </div>
            )
            : (
              <div className="dtpl-providers">
                {view.providers.map((card) => (
                  <ProviderCard key={card.provider} card={card} money={moneyOf} labels={view.providerLabels ?? {}} />
                ))}
              </div>
            )}
    </section>
  )
}

/**
 * One provider card: header (channel + totals) over its model rows.
 *
 * The header names the channel the way the 价格表 tab does — the settings
 * profile's `displayName` first (else the adapter's provider name), with the
 * route key beneath it. The billing chip states what the card's money means:
 * 按量 = cash spend, 订阅 = value folded at hand-written rates. Billing is a
 * route fact (`$billing`), so every model on the card agrees.
 */
function ProviderCard({ card, money, labels }: {
  card: ProviderUsageCard
  money: (value: number) => string
  labels: Record<string, string>
}) {
  const cardTokens = card.tokens
  const label = labels[card.provider]
  // Billing is a ROUTE fact (the price table's `$billing`), so every model of a
  // card agrees; a route nothing declares is metered, like `billingOf` reads it.
  const subscription = card.models.some(model => model.billing === 'subscription')
  const billingTag = subscription ? '订阅' : '按量'
  const billingTitle = subscription
    ? '订阅通道：金额是按官方价折算的订阅价值，不是实际支出'
    : '按量通道：金额是实际支出口径'
  return (
    <article className="dtpl-provider-card" data-provider={card.provider}>
      <header className="dtpl-provider-head">
        <div className="dtpl-provider-id">
          <span className="dtpl-provider-title">
            <span className="dtpl-provider-name">{label ?? card.provider}</span>
            <span
              className="dtpl-provider-bill"
              data-billing={subscription ? 'subscription' : 'metered'}
              title={billingTitle}
            >
              {billingTag}
            </span>
          </span>
          <span className="dtpl-provider-meta">
            {label !== undefined && <><span className="dtpl-provider-key">{card.provider}</span> · </>}
            {card.requests} 请求{card.compactions > 0 ? ` · ${card.compactions} 压缩` : ''}
            {card.unpricedModels.length > 0 ? ` · 价格未知 ${card.unpricedModels.join('、')}` : ''}
          </span>
        </div>
        <div className="dtpl-provider-nums">
          <span className="dtpl-provider-tokens">{formatTokens(cardTokens)}</span>
          <span className="dtpl-provider-cost">
            <span className="dtpl-provider-spend">{money(card.spend)}</span>
            {card.subscriptionValue > 0 && (
              <span className="dtpl-provider-value" title="订阅通道价值（非实际扣款）">{money(card.subscriptionValue)} 订阅价值</span>
            )}
          </span>
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
              <span className="dtpl-provider-model-sub">
                {m.totals.requests} 请求 ·{' '}
                {m.spend > 0
                  ? money(m.spend)
                  : <><b className="dtpl-sub-amt">{money(m.subscriptionValue)}</b><em className="dtpl-sub-k">订阅价值</em></>}
              </span>
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
