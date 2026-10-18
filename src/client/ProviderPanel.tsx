import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type {
  CostedModelRow, ProviderModelUsage, ProviderRange, ProviderUsageCard, ProviderUsageView, UsageTotals, WorkspaceUsageRow,
} from '../types.ts'
import { PROVIDER_RANGES, rangeCarriesMoney } from '../types.ts'
import { QUERY_RANGE, ROUTE_USAGE } from '../route-paths.ts'
import { UsageGlyph } from './icons.tsx'
import { formatMoney, formatTokens } from './format.ts'
import { isNoPrice, ModelRows, WorkspaceRows } from './Breakdowns.tsx'
import { ShareRing } from './ShareRing.tsx'
import { subscribeLedgerChanges } from './ledger-clock.ts'

const RANGE_IDS: ReadonlyArray<ProviderRange> = ['today', 'yesterday', 'last7', 'last30', 'all']

const RANGE_LABELS: Record<ProviderRange, string> = {
  today: '今日',
  yesterday: '昨天',
  last7: '近7天',
  last30: '近30天',
  all: '全部',
}

const RANGE_WORDS: Record<ProviderRange, string> = {
  today: '今天',
  yesterday: '昨天',
  last7: '近 7 天',
  last30: '近 30 天',
  all: '全部账本',
}

const DEFAULT_RANGE: ProviderRange = 'last7'

const RANGE_KEY = 'dsh-tokbook.usage-range'

function readRange(): ProviderRange {
  try {
    const saved = localStorage.getItem(RANGE_KEY)
    return saved !== null && (RANGE_IDS as readonly string[]).includes(saved)
      ? saved as ProviderRange
      : DEFAULT_RANGE
  } catch {
    return DEFAULT_RANGE
  }
}

type Slice = 'model' | 'workspace' | 'provider'

const SLICE_IDS: ReadonlyArray<Slice> = ['model', 'workspace', 'provider']

const SLICE_LABELS: Record<Slice, string> = {
  model: '按模型',
  workspace: '按工作区',
  provider: '按通道',
}

const SLICE_NOTES: Record<Slice, { text: string; title: string }> = {
  model: {
    text: '词元从多到少 · 环为占本窗口',
    title: '每个（通道，模型）在该窗口内的词元与费用，按词元从多到少排列；占比环的分母是这个窗口的总词元。',
  },
  workspace: {
    text: '最近有操作在前 · 环为占本窗口',
    title: '每个工作区在该窗口内的词元。记录按会话的创建目录归属到工作区；没有工作区目录、或目录未注册为工作区的记录归入「未归属」。占比环的分母是这个窗口的总词元。',
  },
  provider: {
    text: '词元从多到少 · 环为占本通道',
    title: '每个通道路由在该窗口内计费过的模型、词元与金额。卡内占比环的分母是该通道自己的词元，所以它与卡头的合计对得上。',
  },
}

const COLUMNS: Partial<Record<Slice, { id: string; nums: string }>> = {
  model: { id: '模型 · 通道', nums: '词元 · 金额' },
  workspace: { id: '工作区 · 目录', nums: '词元 · 金额' },
}

function cutsOf(view: ProviderUsageView): Slice[] {
  return SLICE_IDS.filter((id) =>
    id === 'model' ? view.byModel.length > 0
      : id === 'workspace' ? view.byWorkspace.length > 0
        : view.providers.length > 0)
}

function unpricedKeysOf(view: ProviderUsageView): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const card of view.providers) {
    for (const model of card.unpricedModels) keys.add(`${card.provider}|${model}`)
  }
  return keys
}

function isBucketTotals(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false
  const totals = raw as Partial<UsageTotals>
  return typeof totals.inputTokens === 'number'
    && typeof totals.cacheReadTokens === 'number'
    && typeof totals.cacheWriteTokens === 'number'
    && typeof totals.outputTokens === 'number'
}

function readUsageView(raw: unknown): ProviderUsageView | null {
  if (typeof raw !== 'object' || raw === null) return null
  const source = raw as Partial<ProviderUsageView>
  if (typeof source.range !== 'string' || !PROVIDER_RANGES.includes(source.range as ProviderRange)) return null
  if (typeof source.totalTokens !== 'number' || typeof source.totalRequests !== 'number'
    || typeof source.totalSpend !== 'number' || typeof source.totalSubscriptionValue !== 'number') return null
  if (!Array.isArray(source.byModel) || !Array.isArray(source.byWorkspace) || !Array.isArray(source.providers)) return null
  for (const row of source.byModel) {
    if (typeof row !== 'object' || row === null) return null
    const model = row as Partial<CostedModelRow>
    if (typeof model.model !== 'string' || typeof model.provider !== 'string' || !isBucketTotals(model.totals)) return null
  }
  for (const row of source.byWorkspace) {
    if (typeof row !== 'object' || row === null) return null
    if (!isBucketTotals((row as Partial<WorkspaceUsageRow>).totals)) return null
  }
  for (const card of source.providers) {
    if (typeof card !== 'object' || card === null) return null
    const item = card as Partial<ProviderUsageCard>
    if (!Array.isArray(item.models) || !Array.isArray(item.unpricedModels)) return null
    for (const model of item.models) {
      if (typeof model !== 'object' || model === null) return null
      if (!isBucketTotals((model as Partial<ProviderModelUsage>).totals)) return null
    }
  }
  return source as ProviderUsageView
}

const lastViews = new Map<ProviderRange, ProviderUsageView>()

let lastSlice: Slice = 'model'

export function ProviderPanel() {
  const [range, setRange] = useState<ProviderRange>(readRange)
  const [slice, setSlice] = useState<Slice>(lastSlice)
  const [views, setViews] = useState<ReadonlyMap<ProviderRange, ProviderUsageView>>(() => new Map(lastViews))
  const [cuts, setCuts] = useState<readonly Slice[]>([])
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef(0)
  const viewsRef = useRef(views)
  viewsRef.current = views
  const rangeRef = useRef(range)
  rangeRef.current = range

  const load = useCallback(async (target: ProviderRange, force?: boolean) => {
    setError(null)
    if (!force && viewsRef.current.has(target)) {
      activeRef.current += 1
      return
    }
    const token = ++activeRef.current
    try {
      const res = await fetch(`${ROUTE_USAGE}?${QUERY_RANGE}=${target}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json() as unknown
      if (token !== activeRef.current) return
      const view = readUsageView(raw)
      if (view === null) throw new Error('响应不是一份用量明细视图')
      setViews((current) => {
        const next = new Map(current)
        next.set(target, view)
        lastViews.set(target, view)
        return next
      })
      setCuts(cutsOf(view))
    } catch (err) {
      if (token !== activeRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load(range)
  }, [range, load])

  useEffect(() => subscribeLedgerChanges(() => {
    if (document.hidden) return
    void load(rangeRef.current, true)
  }), [load])

  useEffect(() => () => { activeRef.current += 1 }, [])

  const chooseRange = useCallback((next: ProviderRange) => {
    setRange(next)
    try {
      localStorage.setItem(RANGE_KEY, next)
    } catch {
    }
  }, [])

  const chooseSlice = useCallback((next: Slice) => {
    lastSlice = next
    setSlice(next)
  }, [])

  const view = views.get(range)
  const moneyOf = (value: number): string => formatMoney(value)
  const showMoney = rangeCarriesMoney(range)
  const busy = view === undefined && error === null
  const available = view === undefined ? cuts : cutsOf(view)

  const active: Slice = available.includes(slice) ? slice : available[0] ?? 'model'
  const note = SLICE_NOTES[active]
  const cols = COLUMNS[active]
  const showCuts = view !== undefined ? available.length > 0 : busy

  const onTablistKeyDown = (e: ReactKeyboardEvent): void => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    e.preventDefault()
    const order = available.length > 0 ? available : [active]
    const next = order[(order.indexOf(active) + delta + order.length) % order.length]!
    chooseSlice(next)
    document.getElementById(`dtpl-usage-tab-${next}`)?.focus()
  }

  return (
    <section aria-label="用量明细" className="dtpl-usage-section">
      <div className="dtpl-usage-head">
        <div className="dtpl-usage-head-top">
          <h2 className="dtpl-sec-title dtpl-usage-title">{RANGE_WORDS[range]}用量</h2>
          <div className="dtpl-usage-scope">
            <div className="dtpl-range-tabs" role="group" aria-label="时间跨度">
              {RANGE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`dtpl-range-tab${range === id ? ' dtpl-range-active' : ''}`}
                  aria-pressed={range === id}
                  onClick={() => chooseRange(id)}
                >
                  {RANGE_LABELS[id]}
                </button>
              ))}
            </div>
            {!showMoney && (
              <span
                className="dtpl-usage-money-note"
                title="金额按当前价折算：全部账本里它既不是历史支出、也不是今天的价值（那些 token 是按各时期的价格花的），所以只给词元。近 30 天及更短的窗口里金额照常给。"
              >
                全部账本只给词元
              </span>
            )}
          </div>
        </div>
        {view !== undefined ? (
          <span className="dtpl-hero-facts dtpl-usage-facts">
            <span className="dtpl-hero-fact"><b>{view.totalRequests}</b> 请求</span>
            <i aria-hidden="true">·</i>
            <span className="dtpl-hero-fact"><b>{formatTokens(view.totalTokens)}</b> 词元</span>
            {showMoney && (
              <>
                <i aria-hidden="true">·</i>
                <span className="dtpl-hero-fact"><b>{moneyOf(view.totalSpend)}</b> 实际支出</span>
                {view.totalSubscriptionValue > 0 && (
                  <>
                    <i aria-hidden="true">·</i>
                    <span className="dtpl-hero-fact"><b>{moneyOf(view.totalSubscriptionValue)}</b> 订阅价值</span>
                  </>
                )}
              </>
            )}
          </span>
        ) : busy ? (
          <span className="dtpl-sk dtpl-usage-facts-sk" aria-hidden="true" />
        ) : (
          <span className="dtpl-usage-facts dtpl-usage-facts-empty" aria-hidden="true" />
        )}
      </div>

      {error !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">用量明细加载失败：{error}</p>
          <button type="button" className="dtpl-retry" onClick={() => void load(range, true)}>重试</button>
        </div>
      )}

      {showCuts && (
        <div className="dtpl-bd-head">
          {available.length > 0 ? (
            <div className="dtpl-bd-tabs" role="tablist" aria-label="拆分方式" onKeyDown={onTablistKeyDown}>
              {available.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`dtpl-usage-tab-${id}`}
                  aria-selected={active === id}
                  aria-controls="dtpl-usage-panel"
                  tabIndex={active === id ? 0 : -1}
                  className="dtpl-bd-tab"
                  onClick={() => chooseSlice(id)}
                >
                  {SLICE_LABELS[id]}
                </button>
              ))}
            </div>
          ) : (
            <span className="dtpl-sk dtpl-usage-cuts-sk" aria-hidden="true" />
          )}
          <span className="dtpl-sec-aside" title={note.title}>{note.text}</span>
        </div>
      )}

      {view !== undefined && available.length === 0 ? (
        <div className="dtpl-empty">
          <UsageGlyph className="dtpl-empty-ico" />
          <p className="dtpl-empty-title">{RANGE_WORDS[view.range]}没有计费记录</p>
          <p className="dtpl-empty-sub">这个窗口内没有任何通道计费调用。换一个窗口看看。</p>
        </div>
      ) : cols !== undefined && view !== undefined ? (
        <div className="dtpl-bd-cols" aria-hidden="true">
          <span className="dtpl-bd-col-id">{cols.id}</span>
          <span className="dtpl-bd-col-nums">{showMoney ? cols.nums : '词元'}</span>
        </div>
      ) : null}

      <div
        role="tabpanel"
        id="dtpl-usage-panel"
        aria-busy={busy}
        aria-labelledby={showCuts && available.length > 0 ? `dtpl-usage-tab-${active}` : undefined}
      >
        {view === undefined
          ? (busy && <PanelSkeleton slice={active} />)
          : active === 'model'
            ? <ModelRows byModel={view.byModel} totalTokens={view.totalTokens} money={moneyOf} unpriced={unpricedKeysOf(view)} showMoney={showMoney} />
            : active === 'workspace'
              ? <WorkspaceRows rows={view.byWorkspace} totalTokens={view.totalTokens} money={moneyOf} showMoney={showMoney} />
              : <ProviderCards cards={view.providers} labels={view.providerLabels ?? {}} money={moneyOf} showMoney={showMoney} />}
      </div>
    </section>
  )
}

function ProviderCards({ cards, labels, money, showMoney }: {
  cards: readonly ProviderUsageCard[]
  labels: Record<string, string>
  money: (value: number) => string
  showMoney: boolean
}) {
  return (
    <div className="dtpl-providers">
      {cards.map((card) => (
        <ProviderCard key={card.provider} card={card} money={money} labels={labels} showMoney={showMoney} />
      ))}
    </div>
  )
}

function ProviderCard({ card, money, labels, showMoney }: {
  card: ProviderUsageCard
  money: (value: number) => string
  labels: Record<string, string>
  showMoney: boolean
}) {
  const cardTokens = card.tokens
  const label = labels[card.provider]
  const subscription = card.models.some(model => model.billing === 'subscription')
  const billingTag = subscription ? '订阅' : '按量'
  const billingTitle = subscription
    ? '订阅通道：金额是这些用量按官方价折算的订阅价值，不是实际支出'
    : '按量通道：金额是实际支出口径'
  return (
    <article className="dtpl-provider-card">
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
            {card.usageUnknown > 0 ? ` · ${card.usageUnknown} 次没上报用量` : ''}
            {card.unpricedModels.length > 0 ? ` · 价格未知 ${card.unpricedModels.join('、')}` : ''}
          </span>
        </div>
        <div className="dtpl-provider-nums">
          <span className="dtpl-provider-tokens">{formatTokens(cardTokens)}</span>
          {showMoney && (
            <span className="dtpl-provider-cost">
              {!subscription && <span className="dtpl-provider-spend">{money(card.spend)}</span>}
              {card.subscriptionValue > 0 && (
                <span className="dtpl-provider-value" title="订阅通道：这些用量按量付费本来要花的钱（非实际扣款）">{money(card.subscriptionValue)} 订阅价值</span>
              )}
            </span>
          )}
        </div>
      </header>
      <div className="dtpl-provider-models">
        {card.models.map((m) => {
          const noPrice = isNoPrice(m.cost, card.unpricedModels.includes(m.model))
          return (
            <div className="dtpl-row" key={m.model}>
              <div className="dtpl-model">
                <ShareRing value={m.tokens} total={cardTokens} denom="本通道" />
                <div className="dtpl-model-txt">
                  <span className="dtpl-model-name">{m.model}</span>
                </div>
              </div>
              <div className="dtpl-model-nums">
                <span className="dtpl-val">
                  <span className="dtpl-sr">词元 </span>{formatTokens(m.tokens)}
                </span>
                <span className="dtpl-provider-model-sub">
                  {m.totals.requests} 请求
                  {showMoney && (
                    <>
                      {' · '}
                      {noPrice
                        ? <em className="dtpl-cost-k">价格未知</em>
                        : m.spend > 0
                          ? <><span className="dtpl-sr">金额 </span><b className="dtpl-cash-amt">{money(m.spend)}</b></>
                          : <><span className="dtpl-sr">金额 </span><b className="dtpl-sub-amt">{money(m.subscriptionValue)}</b><em className="dtpl-cost-k">订阅价值</em></>}
                    </>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}

function PanelSkeleton({ slice }: { slice: Slice }) {
  if (slice === 'provider') {
    return (
      <div className="dtpl-skeleton" aria-hidden="true">
        <div className="dtpl-sk dtpl-sk-card" />
        <div className="dtpl-sk dtpl-sk-card" />
        <div className="dtpl-sk dtpl-sk-card" />
      </div>
    )
  }
  return (
    <div className="dtpl-skeleton" aria-hidden="true">
      <div className="dtpl-sk dtpl-sk-row" />
      <div className="dtpl-sk dtpl-sk-row" />
      <div className="dtpl-sk dtpl-sk-row" />
      <div className="dtpl-sk dtpl-sk-row" />
    </div>
  )
}
