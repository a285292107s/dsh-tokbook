/**
 * 用量明细 tab：**选定窗口**内同一批用量的三种切法——按模型 / 按工作区 / 按通道
 * （三层信息形的分法见 provider 片段页头段）。
 *
 * 数据来自 `GET /tokbook/usage?range=…`（一次拉回三种切法 + 窗口合计）。刻意独立于总览
 * store——总览失败时本 tab 仍可用。
 */

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

/** 窗口 id，按展示顺序。`all` = 全账本，不收窄下界。 */
const RANGE_IDS: ReadonlyArray<ProviderRange> = ['today', 'yesterday', 'last7', 'last30', 'all']

const RANGE_LABELS: Record<ProviderRange, string> = {
  today: '今日',
  yesterday: '昨天',
  last7: '近7天',
  last30: '近30天',
  all: '全部',
}

/** 窗口词 = 分区词的前半（命名规矩见 ledger 片段 .dtpl-bd-head 段）。 */
const RANGE_WORDS: Record<ProviderRange, string> = {
  today: '今天',
  yesterday: '昨天',
  last7: '近 7 天',
  last30: '近 30 天',
  all: '全部账本',
}

/** 切法，按展示顺序（也是子 tab 顺序）。 */
type Slice = 'model' | 'workspace' | 'provider'

const SLICE_IDS: ReadonlyArray<Slice> = ['model', 'workspace', 'provider']

const SLICE_LABELS: Record<Slice, string> = {
  model: '按模型',
  workspace: '按工作区',
  provider: '按通道',
}

/**
 * 各切法的右端旁注：**排序口径 + 占比环的分母**。环心只写读数，「占谁的多少」必须写在旁边。
 */
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

/** 列头一行式的写法（含「甲 · 乙」分隔的理由）见 ledger 片段 .dtpl-bd-cols 段。
 *  按通道那一面没有列头：卡头铭牌就是它的列头，再来一行会与卡头打架。 */
const COLUMNS: Partial<Record<Slice, { id: string; nums: string }>> = {
  model: { id: '模型 · 通道', nums: '词元 · 金额' },
  workspace: { id: '工作区 · 目录', nums: '词元 · 金额' },
}

/** 一个载荷里有行的切法（无行的切法不贡献子 tab）。 */
function cutsOf(view: ProviderUsageView): Slice[] {
  return SLICE_IDS.filter((id) =>
    id === 'model' ? view.byModel.length > 0
      : id === 'workspace' ? view.byWorkspace.length > 0
        : view.providers.length > 0)
}

/** 价表无法计费的 (通道, 模型)：卡头的 unpricedModels 与按模型面的行在此对上键。 */
function unpricedKeysOf(view: ProviderUsageView): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const card of view.providers) {
    for (const model of card.unpricedModels) keys.add(`${card.provider}|${model}`)
  }
  return keys
}

/** 四桶齐全的 totals——渲染对它做算术（`totalsTokens`，src/types.ts:645-650），所以四个桶必须在场且是数。 */
function isBucketTotals(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false
  const totals = raw as Partial<UsageTotals>
  return typeof totals.inputTokens === 'number'
    && typeof totals.cacheReadTokens === 'number'
    && typeof totals.cacheWriteTokens === 'number'
    && typeof totals.outputTokens === 'number'
}

/**
 * 用量明细载荷的形状判定：只盖渲染**真正会解引用**的字段——`cutsOf` / `unpricedKeysOf`
 * 无条件遍历三个数组与卡内的 `models` / `unpricedModels`，页头读四个合计，`RANGE_WORDS[view.range]`
 * 读 `range`，两种行清单对 `totals` 做算术并按 `model` / `provider` 排序。
 * 不合法就走面板已有的错误态（错误条 + 重试），绝不把半成品塞进 state——渲染期抛错会让这一条
 * list 型 slot 被宿主摘掉（浮窗从此打不开）。
 * 判据按 host 现在的组装处与类型：`usageByRange`（src/index.ts:434-459）、
 * `ProviderUsageView`（src/types.ts:404-430，`providerLabels` 缺席由渲染侧 `?? {}` 兜）。
 */
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
    // `model` / `provider` 是排序键（`localeCompare`），缺席会在渲染期抛。
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

/** 用量明细 tab 本体；每个已加载的窗口有缓存，切回来不重新拉取。 */
export function ProviderPanel() {
  const [range, setRange] = useState<ProviderRange>('last7')
  const [slice, setSlice] = useState<Slice>('model')
  const [views, setViews] = useState<ReadonlyMap<ProviderRange, ProviderUsageView>>(() => new Map())
  /** 最近一次**已知**的可用切法。加载中不清空：换窗口时 tab 条因此不闪、也不整块消失。 */
  const [cuts, setCuts] = useState<readonly Slice[]>([])
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef(0)
  // 缓存的 ref 镜像，使 `load` 保持引用稳定（每次成功拉取都换新引用
  // 会重跑 fetch effect）。
  const viewsRef = useRef(views)
  viewsRef.current = views

  const load = useCallback(async (target: ProviderRange, force?: boolean) => {
    // 清错误条在缓存短路之前：命中缓存同样是「这一次读到了」，别的窗口上一轮的失败不该留在屏上。
    setError(null)
    if (!force && viewsRef.current.has(target)) {
      // 命中缓存 = 屏上换了一份数据：在飞请求的成败同样不该落到这一份上（它属于刚离开的那个窗口）。
      activeRef.current += 1
      return
    }
    const token = ++activeRef.current
    try {
      const res = await fetch(`${ROUTE_USAGE}?${QUERY_RANGE}=${target}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json() as unknown
      if (token !== activeRef.current) return // 被更新的切换取代
      const view = readUsageView(raw)
      // 形状不对按一次读失败处理：错误态是重试的入口，而半成品进缓存会让渲染期抛错。
      if (view === null) throw new Error('响应不是一份用量明细视图')
      setViews((current) => {
        const next = new Map(current)
        next.set(target, view)
        return next
      })
      setCuts(cutsOf(view))
    } catch (err) {
      if (token !== activeRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  // 每个选中的窗口拉取一次。
  useEffect(() => {
    void load(range)
  }, [range, load])

  // 面板卸载（tab 切换）时推进 active token，防止在飞的响应更新已卸载面板。
  useEffect(() => () => { activeRef.current += 1 }, [])

  const view = views.get(range)
  const moneyOf = (value: number): string => formatMoney(value)
  // 金额按现价折算，只在够近的窗口里是有效的刻度（见 types 的 `rangeCarriesMoney`）。
  const showMoney = rangeCarriesMoney(range)
  const busy = view === undefined && error === null
  const available = view === undefined ? cuts : cutsOf(view)

  // 切法始终重新推导、绝不直接信任：换窗口可能清空当前选中的那一面，空面板不能对着用户。
  const active: Slice = available.includes(slice) ? slice : available[0] ?? 'model'
  const note = SLICE_NOTES[active]
  const cols = COLUMNS[active]
  // 切法条：窗口没数据可看时（错误态）整条收掉——一条点不动的切法条加一个空面板，
  // 读起来像「这里没有行」，而真相是这一次没读到。
  const showCuts = view !== undefined ? available.length > 0 : busy

  const onTablistKeyDown = (e: ReactKeyboardEvent): void => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    e.preventDefault()
    const order = available.length > 0 ? available : [active]
    const next = order[(order.indexOf(active) + delta + order.length) % order.length]!
    setSlice(next)
    document.getElementById(`dtpl-usage-tab-${next}`)?.focus()
  }

  return (
    <section aria-label="用量明细">
      <div className="dtpl-usage-head">
        <div className="dtpl-usage-head-top">
          <h2 className="dtpl-sec-title dtpl-usage-title">{RANGE_WORDS[range]}用量</h2>
          <div className="dtpl-usage-scope">
            <span className="dtpl-usage-scope-k">窗口</span>
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
            {/* 金额按当前价折算，所以它只在够近的窗口里是有效的刻度。窗口本身要说出这件事：
                否则在「全部」里金额列凭空消失，读起来像坏了。 */}
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
          // 窗口合计与当前切法无关——三种切法加起来就是它。
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
                  onClick={() => setSlice(id)}
                >
                  {SLICE_LABELS[id]}
                </button>
              ))}
            </div>
          ) : (
            // 首次加载：切法还不知道——没有工作区注册表的宿主只有两面。
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
        // 只在切法条真的挂着时才指向它：错误态整条收掉，指向不存在的 id 比不指更糟
        // （同一条判据见 `LedgerOverlay` 的 tab 条注释）。
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

/** 按通道那一面：一张卡一个 provider。 */
function ProviderCards({ cards, labels, money, showMoney }: {
  cards: readonly ProviderUsageCard[]
  labels: Record<string, string>
  money: (value: number) => string
  /** 这个窗口给不给金额（判据同 `ModelRows`）。 */
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

/**
 * 一张 provider 卡：头部命名通道的方式与价格表 tab 一致——settings 的 `displayName` 优先
 * （否则适配器的 provider 名），route key 作为副标题。计费是 route 级事实、两桶口径见
 * CONTRACTS §2。
 */
function ProviderCard({ card, money, labels, showMoney }: {
  card: ProviderUsageCard
  money: (value: number) => string
  labels: Record<string, string>
  /** 这个窗口给不给金额（判据同 `ModelRows`）。 */
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
              {/* 订阅通道的实际支出是结构性的零（计费是 route 级事实，钱全在价值桶）——
                  报「¥0.00」是同义反复，不是读数；按量卡即使为 0 也报，那是量出来的。 */}
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
          // 与按模型面同一条判据：价表计不了费且这个窗口里没有一条已定价的记录。
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
                {/* 这一面没有列头（见 `COLUMNS` 注释），所以读屏文本自带列名；占比环的
                    分母是**这张卡**，环心的读屏前缀也这么念。 */}
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

/** 首次拉取进行中的占位：按**当前切法**的形状占位，数据到达时高度不跳。 */
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
