import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type {
  CostedModelRow, ProviderModelUsage, ProviderRange, ProviderUsageCard, ProviderUsageView, WorkspaceUsageRow,
} from '../types.ts'
import { PROVIDER_RANGES, rangeCarriesMoney, totalsTokens } from '../types.ts'
import { QUERY_RANGE, ROUTE_USAGE } from '../route-paths.ts'
import { UsageGlyph } from './icons.tsx'
import { ScrollRail } from './ScrollRail.tsx'
import { formatMoney, formatRelative, formatShare, formatTokens } from './format.ts'
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

type Slice = 'provider' | 'model' | 'workspace'

const SLICE_IDS: ReadonlyArray<Slice> = ['provider', 'model', 'workspace']

const SLICE_LABELS: Record<Slice, string> = {
  provider: '按通道',
  model: '按模型',
  workspace: '按工作区',
}

const SLICE_UNITS: Record<Slice, string> = {
  provider: '条通道',
  model: '个模型',
  workspace: '个工作区',
}

const SLICE_COLUMNS: Record<Slice, string> = {
  provider: '通道 / 模型',
  model: '模型 / 通道',
  workspace: '工作区',
}

const SLICE_NOTES: Record<Slice, { text: string; title: string }> = {
  provider: {
    text: '点通道展开模型 · 占比按本窗口',
    title: '每个通道路由一行小计：请求数、窗口占比、词元与金额；点这一行展开它在该窗口内计费过的模型。占比的分母是本窗口的总词元。',
  },
  model: {
    text: '词元从多到少 · 占比按本窗口',
    title: '每个（通道，模型）在该窗口内的词元与费用，按词元从多到少排列；占比的分母是这个窗口的总词元。',
  },
  workspace: {
    text: '最近有操作在前 · 占比按本窗口',
    title: '每个工作区在该窗口内的词元。记录按会话的创建目录归属到工作区；没有工作区目录、或目录未注册为工作区的记录归入「未归属」。占比的分母是这个窗口的总词元。',
  },
}

const DEFAULT_SLICE: Slice = 'provider'

function cutsOf(view: ProviderUsageView): Slice[] {
  return SLICE_IDS.filter((id) =>
    id === 'provider' ? view.providers.length > 0
      : id === 'model' ? view.byModel.length > 0
        : view.byWorkspace.length > 0)
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
  const totals = raw as Record<string, unknown>
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

let lastSlice: Slice = DEFAULT_SLICE

function monthDay(day: string): string {
  const [, month, date] = day.split('-')
  return `${Number(month)} 月 ${Number(date)} 日`
}

function periodText(view: ProviderUsageView): string {
  if (view.fromDay === '') return '全部账本'
  if (view.fromDay === view.toDay) return monthDay(view.fromDay)
  return `${monthDay(view.fromDay)} — ${monthDay(view.toDay)}`
}

function dayCount(view: ProviderUsageView): number | null {
  if (view.fromDay === '') return null
  const from = Date.parse(`${view.fromDay}T00:00:00`)
  const to = Date.parse(`${view.toDay}T00:00:00`)
  if (Number.isNaN(from) || Number.isNaN(to)) return null
  return Math.round((to - from) / 86_400_000) + 1
}

function noPrice(cost: number, unpriced: boolean): boolean {
  return unpriced && cost === 0
}

function spendText(spend: number, subscriptionValue: number): { text: string; kind: 'actual' | 'subscription' | 'unknown' } {
  if (spend > 0) return { text: formatMoney(spend), kind: 'actual' }
  if (subscriptionValue > 0) return { text: formatMoney(subscriptionValue), kind: 'subscription' }
  return { text: '—', kind: 'unknown' }
}

function modelTitle(model: ProviderModelUsage, provider: string, cardTokens: number, totalTokens: number, showMoney: boolean, unpriced: boolean): string {
  const totals = model.totals
  const failed = totals.failures ?? 0
  const compactions = totals.compactions ?? 0
  const unknown = totals.usageUnknown ?? 0
  return [
    `模型 ${model.model}`,
    ...(provider === '' ? [] : [`通道 ${provider}`]),
    `本通道 ${formatTokens(model.tokens)} 词元（占本通道 ${formatShare(model.tokens, cardTokens)} · 占本窗口 ${formatShare(model.tokens, totalTokens)}）`,
    `${totals.requests} 请求${compactions > 0 ? ` · ${compactions} 压缩` : ''}${failed > 0 ? ` · ${failed} 失败` : ''}${unknown > 0 ? ` · ${unknown} 次没上报用量` : ''}`,
    `未缓存输入 ${formatTokens(totals.inputTokens)} · 缓存读取 ${formatTokens(totals.cacheReadTokens)} · 输出 ${formatTokens(totals.outputTokens)}`,
    ...(showMoney ? [unpriced ? '价格未知：按 ¥0 计' : `实际支出 ${formatMoney(model.spend)} · 订阅价值 ${formatMoney(model.subscriptionValue)}`] : []),
  ].join('\n')
}

function workspaceTitle(row: WorkspaceUsageRow, showMoney: boolean): string {
  const totals = row.totals
  const failed = totals.failures ?? 0
  return [
    row.path === '' ? '未归属用量' : `工作区 ${row.title}`,
    row.path === '' ? '会话没有工作区目录，或目录未注册为工作区。' : `目录 ${row.path}`,
    `窗口 ${formatTokens(row.tokens)} 词元 · ${totals.requests} 请求${failed > 0 ? ` · ${failed} 失败` : ''}`,
    ...(showMoney ? [`实际支出 ${formatMoney(row.spend)} · 订阅价值 ${formatMoney(row.subscriptionValue)}`] : []),
    `最近一次 ${new Date(row.lastAt).toLocaleString('zh-CN')}`,
  ].join('\n')
}

export function ProviderPanel() {
  const [range, setRange] = useState<ProviderRange>(readRange)
  const [slice, setSlice] = useState<Slice>(lastSlice)
  const [views, setViews] = useState<ReadonlyMap<ProviderRange, ProviderUsageView>>(() => new Map(lastViews))
  const [cuts, setCuts] = useState<readonly Slice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
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
    if (next === rangeRef.current) return
    setRange(next)
    setExpanded(new Set())
    try {
      localStorage.setItem(RANGE_KEY, next)
    } catch {
    }
  }, [])

  const chooseSlice = useCallback((next: Slice) => {
    lastSlice = next
    setSlice(next)
  }, [])

  const toggleProvider = useCallback((provider: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }, [])

  const view = views.get(range)
  const showMoney = rangeCarriesMoney(range)
  const busy = view === undefined && error === null
  const available = view === undefined ? cuts : cutsOf(view)
  const active: Slice = available.includes(slice) ? slice : available[0] ?? DEFAULT_SLICE
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => { panelRef.current?.scrollTo({ top: 0 }) }, [range, active])
  const rows = view === undefined
    ? 0
    : active === 'provider' ? view.providers.length : active === 'model' ? view.byModel.length : view.byWorkspace.length
  const visibleRows = view === undefined
    ? 0
    : active === 'provider'
      ? view.providers.reduce((sum, card) => sum + 1 + (expanded.has(card.provider) ? card.models.length : 0), 0)
      : rows
  const scrollable = visibleRows > 8
  const note = SLICE_NOTES[active]
  const empty = view !== undefined && available.length === 0

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
    <section aria-label="用量明细" className="dtpl-card dtpl-span-12 dtpl-usage-section" data-money={showMoney}>
      <div className="dtpl-usage-head">
        <div className="dtpl-usage-head-top">
          <h2 className="dtpl-mod-t">{RANGE_WORDS[range]}用量</h2>
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
      </div>

      {error !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">用量明细加载失败：{error}</p>
          <button type="button" className="dtpl-retry" onClick={() => void load(range, true)}>重试</button>
        </div>
      )}

      {view === undefined ? (busy && <UsageSkeleton />) : (
        <>
          <div className="dtpl-usage-period">
            <b>{periodText(view)}</b>
            <span>
              · {dayCount(view) === null || dayCount(view) === 1 ? '' : `${dayCount(view)} 天 · `}
              {view.providers.length} 条通道 · {view.byModel.length} 个模型
            </span>
          </div>

          <div className="dtpl-usage-figs">
            <div className="dtpl-usage-fig">
              <span className="dtpl-usage-fig-k">词元</span>
              <b className="dtpl-usage-fig-v">{formatTokens(view.totalTokens)}</b>
            </div>
            <div className="dtpl-usage-fig">
              <span className="dtpl-usage-fig-k">请求</span>
              <b className="dtpl-usage-fig-v">{view.totalRequests.toLocaleString('en-US')}</b>
            </div>
            {showMoney && (
              <div className="dtpl-usage-fig">
                <span className="dtpl-usage-fig-k">实际支出</span>
                <b className={`dtpl-usage-fig-v${view.totalSpend === 0 ? ' is-zero' : ''}`}>{formatMoney(view.totalSpend)}</b>
              </div>
            )}
            {showMoney && view.totalSubscriptionValue > 0 && (
              <div className="dtpl-usage-fig is-sub">
                <span className="dtpl-usage-fig-k">订阅价值</span>
                <b className="dtpl-usage-fig-v">{formatMoney(view.totalSubscriptionValue)}</b>
              </div>
            )}
          </div>

          {available.length > 0 && (
            <div className="dtpl-usage-cuts">
              <div className="dtpl-usage-tabs" role="tablist" aria-label="拆分方式" onKeyDown={onTablistKeyDown}>
                {available.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`dtpl-usage-tab-${id}`}
                    aria-selected={active === id}
                    aria-controls="dtpl-usage-panel"
                    tabIndex={active === id ? 0 : -1}
                    className="dtpl-usage-tab"
                    onClick={() => chooseSlice(id)}
                  >
                    {SLICE_LABELS[id]}
                  </button>
                ))}
              </div>
              <span className="dtpl-sec-aside" title={note.title}>
                {note.text}{scrollable ? ' · 列表可滚动' : ''}
              </span>
            </div>
          )}

          {empty ? (
            <div className="dtpl-empty">
              <UsageGlyph className="dtpl-empty-ico" />
              <p className="dtpl-empty-title">{RANGE_WORDS[view.range]}没有计费记录</p>
              <p className="dtpl-empty-sub">这个窗口内没有任何通道计费调用。换一个窗口看看。</p>
            </div>
          ) : (
            <>
              <div className="dtpl-usage-cols" aria-hidden="true">
                <span>{SLICE_COLUMNS[active]}</span>
                <span>请求</span>
                <span>占比</span>
                <span>词元</span>
                {showMoney && <span>金额</span>}
              </div>
              <div className="dtpl-usage-body-wrap">
                <div
                  ref={panelRef}
                  role="tabpanel"
                  id="dtpl-usage-panel"
                  aria-busy={busy}
                  aria-labelledby={available.length > 0 ? `dtpl-usage-tab-${active}` : undefined}
                >
                  {active === 'provider' && (
                    <ProviderGroups
                      cards={view.providers}
                      labels={view.providerLabels ?? {}}
                      totalTokens={view.totalTokens}
                      showMoney={showMoney}
                      expanded={expanded}
                      onToggle={toggleProvider}
                    />
                  )}
                  {active === 'model' && (
                    <ModelLines rows={view.byModel} totalTokens={view.totalTokens} unpriced={unpricedKeysOf(view)} showMoney={showMoney} />
                  )}
                  {active === 'workspace' && (
                    <WorkspaceLines rows={view.byWorkspace} totalTokens={view.totalTokens} showMoney={showMoney} />
                  )}
                </div>
                <ScrollRail targetRef={panelRef} resetKey={active} className="dtpl-usage-rail" />
              </div>
              <div className="dtpl-usage-foot">
                <span>共 {rows} {SLICE_UNITS[active]}{scrollable ? ' · 列表可滚动' : ''}</span>
                <span>{showMoney ? '金额按现价折算 · 订阅价值未实际扣款' : '全部账本不给金额'}</span>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

function ProviderGroups({ cards, labels, totalTokens, showMoney, expanded, onToggle }: {
  cards: readonly ProviderUsageCard[]
  labels: Record<string, string>
  totalTokens: number
  showMoney: boolean
  expanded: ReadonlySet<string>
  onToggle: (provider: string) => void
}) {
  return (
    <div className="dtpl-usage-groups">
      {cards.map((card, index) => (
        <ProviderGroup
          key={card.provider}
          card={card}
          labels={labels}
          totalTokens={totalTokens}
          showMoney={showMoney}
          open={expanded.has(card.provider)}
          bodyId={`dtpl-usage-body-${index}`}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

function ProviderGroup({ card, labels, totalTokens, showMoney, open, bodyId, onToggle }: {
  card: ProviderUsageCard
  labels: Record<string, string>
  totalTokens: number
  showMoney: boolean
  open: boolean
  bodyId: string
  onToggle: (provider: string) => void
}) {
  const label = labels[card.provider]
  const subscription = card.models.some(model => model.billing === 'subscription')
  const money = spendText(card.spend, card.subscriptionValue)
  const billingTitle = subscription
    ? '订阅通道：金额是这些用量按官方价折算的订阅价值，不是实际支出'
    : '按量通道：金额是实际支出口径'
  const meta = [
    `${card.models.length} 个模型`,
    card.usageUnknown > 0 ? `${card.usageUnknown} 次没上报` : '',
    card.unpricedModels.length > 0 ? '含价格未知' : '',
  ].filter(part => part !== '').join(' · ')
  const expandable = card.models.length > 0
  const head = (
    <>
      <span className="dtpl-usage-gname">
        {expandable && (
          <svg className="dtpl-usage-caret" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <i className="dtpl-usage-gmark" aria-hidden="true" />
        <b>{label ?? card.provider}</b>
        {label !== undefined && <span className="dtpl-usage-gkey">{card.provider}</span>}
        <span className="dtpl-usage-bill" data-billing={subscription ? 'subscription' : 'metered'} title={billingTitle}>
          {subscription ? '订阅' : '按量'}
        </span>
        <span className="dtpl-usage-gmeta" title={meta}>{meta}</span>
      </span>
      <span className="dtpl-usage-req">{card.requests.toLocaleString('en-US')}</span>
      <span className="dtpl-usage-share">{formatShare(card.tokens, totalTokens)}</span>
      <span className="dtpl-usage-tok">{formatTokens(card.tokens)}</span>
      {showMoney && (
        <span className="dtpl-usage-mny" title={billingTitle}>
          <b className={money.kind === 'actual' ? '' : 'is-quiet'}>{money.text}</b>
          <span>{money.kind === 'actual' ? '实际' : money.kind === 'subscription' ? '订阅' : '价格未知'}</span>
        </span>
      )}
    </>
  )
  return (
    <section className="dtpl-usage-group">
      {expandable ? (
        <button
          type="button"
          className="dtpl-usage-ghead"
          aria-expanded={open}
          aria-controls={bodyId}
          title={open ? '收起这个通道的模型' : `展开 ${card.models.length} 个模型`}
          onClick={() => onToggle(card.provider)}
        >
          {head}
        </button>
      ) : (
        <div className="dtpl-usage-ghead">{head}</div>
      )}
      {expandable && (
        <div className="dtpl-usage-group-body" id={bodyId} hidden={!open}>
          {card.models.map((model) => {
            const unpriced = card.unpricedModels.includes(model.model)
            const cost = spendText(model.spend, model.subscriptionValue)
            return (
              <div className="dtpl-usage-row" key={model.model} title={modelTitle(model, card.provider, card.tokens, totalTokens, showMoney, unpriced)}>
                <span className="dtpl-usage-model">{model.model}</span>
                <span className="dtpl-usage-req">{model.totals.requests.toLocaleString('en-US')}</span>
                <span className="dtpl-usage-share" aria-hidden="true" />
                <span className="dtpl-usage-tok">{formatTokens(model.tokens)}</span>
                {showMoney && (
                  <span className="dtpl-usage-mny">
                    <b className={cost.kind === 'actual' ? '' : 'is-quiet'}>{cost.text}</b>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ModelLines({ rows, totalTokens, unpriced, showMoney }: {
  rows: readonly CostedModelRow[]
  totalTokens: number
  unpriced: ReadonlySet<string>
  showMoney: boolean
}) {
  const sorted = [...rows].sort((left, right) =>
    totalsTokens(right.totals) - totalsTokens(left.totals)
    || right.totals.requests - left.totals.requests
    || left.model.localeCompare(right.model)
    || left.provider.localeCompare(right.provider))
  return (
    <div className="dtpl-usage-groups">
      {sorted.map((row) => {
        const tokens = totalsTokens(row.totals)
        const noP = noPrice(row.cost, unpriced.has(`${row.provider}|${row.model}`))
        const cost = spendText(row.spend, row.subscriptionValue)
        return (
          <div
            className="dtpl-usage-row"
            key={`${row.provider}/${row.model}`}
            title={modelTitle({ model: row.model, tokens, totals: row.totals, cost: row.cost, spend: row.spend, subscriptionValue: row.subscriptionValue }, row.provider, tokens, totalTokens, showMoney, noP)}
          >
            <span className="dtpl-usage-model">
              {row.model}
              {row.provider !== '' && <em className="dtpl-usage-prov">{row.provider}</em>}
            </span>
            <span className="dtpl-usage-req">{row.totals.requests.toLocaleString('en-US')}</span>
            <span className="dtpl-usage-share">{formatShare(tokens, totalTokens)}</span>
            <span className="dtpl-usage-tok">{formatTokens(tokens)}</span>
            {showMoney && (
              <span className="dtpl-usage-mny">
                <b className={cost.kind === 'actual' ? '' : 'is-quiet'}>{cost.text}</b>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function WorkspaceLines({ rows, totalTokens, showMoney }: {
  rows: readonly WorkspaceUsageRow[]
  totalTokens: number
  showMoney: boolean
}) {
  return (
    <div className="dtpl-usage-groups">
      {rows.map((row) => {
        const failed = row.totals.failures ?? 0
        const cost = spendText(row.spend, row.subscriptionValue)
        return (
          <div
            className={`dtpl-usage-row is-workspace${row.id === '' ? ' is-unattributed' : ''}`}
            key={row.id === '' ? 'unattributed' : row.id}
            title={workspaceTitle(row, showMoney)}
          >
            <span className="dtpl-usage-model">
              {row.title}
              <span className="dtpl-usage-sub">
                {row.path !== '' && <span className="dtpl-usage-path">{row.path}</span>}
                <span className="dtpl-usage-wsmeta">
                  最近 {formatRelative(row.lastAt)}
                  {failed > 0 && <> · <b className="dtpl-usage-fail">{failed} 失败</b></>}
                </span>
              </span>
            </span>
            <span className="dtpl-usage-req">{row.totals.requests.toLocaleString('en-US')}</span>
            <span className="dtpl-usage-share">{formatShare(row.tokens, totalTokens)}</span>
            <span className="dtpl-usage-tok">{formatTokens(row.tokens)}</span>
            {showMoney && (
              <span className="dtpl-usage-mny">
                <b className={cost.kind === 'actual' ? '' : 'is-quiet'}>{cost.text}</b>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function UsageSkeleton() {
  return (
    <div className="dtpl-usage-skeleton" aria-hidden="true">
      <div className="dtpl-sk dtpl-usage-sk-period" />
      <div className="dtpl-usage-sk-figs">
        <div className="dtpl-sk dtpl-usage-sk-fig" />
        <div className="dtpl-sk dtpl-usage-sk-fig" />
        <div className="dtpl-sk dtpl-usage-sk-fig" />
      </div>
      <div className="dtpl-sk dtpl-sk-row" />
      <div className="dtpl-sk dtpl-sk-row" />
      <div className="dtpl-sk dtpl-sk-row" />
      <div className="dtpl-sk dtpl-sk-row" />
    </div>
  )
}
