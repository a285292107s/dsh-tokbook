/**
 * 通道用量 tab：每个 provider route 一张卡，窗口可选。
 *
 * 数据来自 `GET /tokbook/usage?range=…`。刻意独立于总览 store——
 * 总览失败时本 tab 仍可用。
 *
 * @module dsh-tokbook/client/ProviderPanel
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProviderRange, ProviderUsageCard, ProviderUsageView } from '../types.ts'
import { UsageGlyph } from './icons.tsx'
import { formatMoney, formatTokens, share } from './format.ts'

/** 回看窗口 id，按展示顺序。 */
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
 * 浮窗的通道用量 tab：每个 provider 一张卡，列出该通道在选定回看窗口
 * （今日 / 昨天 / 近7天 / 近30天）内计费过的模型，含词元合计与金额。
 * 数据来自自身路由 `/tokbook/usage?range=…`（总览的 payload 仅按 model id
 * 键控，会合并多个 provider 计费的同名模型）；每个已加载的 range 有缓存，
 * 切换回来不重新拉取。
 */
export function ProviderPanel() {
  const [range, setRange] = useState<ProviderRange>('last7')
  const [views, setViews] = useState<ReadonlyMap<ProviderRange, ProviderUsageView>>(() => new Map())
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef(0)
  // 缓存的 ref 镜像，使 `load` 保持引用稳定（每次成功拉取都换新引用
  // 会重跑 fetch effect）。
  const viewsRef = useRef(views)
  viewsRef.current = views

  const load = useCallback(async (target: ProviderRange, force?: boolean) => {
    if (!force && viewsRef.current.has(target)) return // 已缓存——切换回来免费
    const token = ++activeRef.current
    setError(null)
    try {
      const res = await fetch(`/tokbook/usage?range=${target}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const view = await res.json() as ProviderUsageView
      if (token !== activeRef.current) return // 被更新的切换取代
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

  // 每个选中的 range 拉取一次；切换后的过期响应被丢弃。
  useEffect(() => {
    void load(range)
  }, [range, load])

  // 面板卸载（tab 切换）时推进 active token，防止在飞的响应更新已卸载面板。
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
 * 一张 provider 卡：头部（通道 + 合计）在模型行之上。
 *
 * 头部命名通道的方式与价格表 tab 一致——settings 的 `displayName` 优先
 * （否则适配器的 provider 名），route key 作为副标题。计费标签说明卡上
 * 金额的含义：按量 = 现金支出，订阅 = 按手工价表折算的价值。计费是 route
 * 事实（`$billing`），故卡上所有模型一致。
 */
function ProviderCard({ card, money, labels }: {
  card: ProviderUsageCard
  money: (value: number) => string
  labels: Record<string, string>
}) {
  const cardTokens = card.tokens
  const label = labels[card.provider]
  // 计费是 ROUTE 事实（价表的 `$billing`），卡上所有模型一致；无人声明的
  // route 读作 metered，与 `billingOf` 一致。
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
            {card.usageUnknown > 0 ? ` · 用量未知 ${card.usageUnknown}` : ''}
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

/** 首次拉取进行中的占位。 */
function ProviderSkeleton() {
  return (
    <div className="dtpl-skeleton" aria-hidden="true">
      <div className="dtpl-sk dtpl-sk-card" />
      <div className="dtpl-sk dtpl-sk-card" />
      <div className="dtpl-sk dtpl-sk-card" />
    </div>
  )
}
