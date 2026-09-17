/**
 * 用量明细 tab：**选定窗口**内同一批用量的三种切法——按模型 / 按工作区 / 按通道。
 *
 * 三层信息，从上到下各管一件事：**分区词**说明这一页是什么（窗口 + 用量）并报出该窗口的
 * **合计**；**窗口**是贴在分区词右端的作用域控件（它约束整页，不是第二排页签）；
 * **切法**是这一页唯一那条 tab 条（底下才是数据）。窗口作用于三种切法，换窗口时三面一起换、
 * 合计逐分对得上。
 *
 * 数据来自 `GET /tokbook/usage?range=…`（一次拉回三种切法 + 窗口合计）。刻意独立于总览
 * store——总览失败时本 tab 仍可用。
 *
 * @module dsh-tokbook/client/ProviderPanel
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ProviderRange, ProviderUsageCard, ProviderUsageView } from '../types.ts'
import { QUERY_RANGE, ROUTE_USAGE } from '../route-paths.ts'
import { UsageGlyph } from './icons.tsx'
import { formatMoney, formatShare, formatTokens, share } from './format.ts'
import { ModelRows, WorkspaceRows } from './Breakdowns.tsx'

/** 窗口 id，按展示顺序。`all` = 全账本，不收窄下界。 */
const RANGE_IDS: ReadonlyArray<ProviderRange> = ['today', 'yesterday', 'last7', 'last30', 'all']

const RANGE_LABELS: Record<ProviderRange, string> = {
  today: '今日',
  yesterday: '昨天',
  last7: '近7天',
  last30: '近30天',
  all: '全部',
}

/**
 * 窗口词（分区词的前半）。这一页陈述的就是「某个窗口的用量」，所以窗口自己就是它该有的
 * 名字（与「近 14 天趋势」同一写法）：`${窗口词}用量`。
 */
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
 * 各切法的右端旁注：**排序口径 + 占比条的分母**。条是这一页唯一没有数字的形状，所以它量的
 * 是「占谁的多少」必须写在旁边——按模型 / 按工作区归一到一个窗口，按通道的条归一在各自卡内
 * （卡是「一条通道」这块面板，条跟着卡走才对得上卡头的合计）。
 */
const SLICE_NOTES: Record<Slice, { text: string; title: string }> = {
  model: {
    text: '词元从多到少 · 条为占本窗口',
    title: '每个（通道，模型）在该窗口内的词元与费用，按词元从多到少排列；占比条的分母是这个窗口的总词元。',
  },
  workspace: {
    text: '最近有操作在前 · 条为占本窗口',
    title: '每个工作区在该窗口内的词元。记录按会话的创建目录归属到工作区；没有工作区目录、或目录未注册为工作区的记录归入「未归属」。占比条的分母是这个窗口的总词元。',
  },
  provider: {
    text: '词元从多到少 · 条为占本通道',
    title: '每个通道路由在该窗口内计费过的模型、词元与金额。卡内占比条的分母是该通道自己的词元，所以它与卡头的合计对得上。',
  },
}

/** 列头。**一行**写：两列各自是一串上下叠起来的事实（身份两行、数值两行），
 *  所以列名也按同样的先后写成「甲 · 乙」——分隔符用的就是这个窗口里表示「一串事实」的 `·`
 *  （旁注与工作区事实行都用它）。早先这里照数据的两行写成了两行列头（模型 / 通道 各占一行），
 *  标签能精确落在各自数值正上方，但代价是四枚孤零零的标签占掉两行、中间大片空白——**表头比
 *  它标注的数据还高**。一行牺牲的是「精确对位」，换来的是它终于像一行表头。
 *  按通道那一面没有列头：通道卡是「铭牌 + 卡身」的两段式，列头会与卡头打架。 */
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

/**
 * 浮窗的用量明细 tab。数据来自自身路由 `/tokbook/usage?range=…`（一次拉回三种切法）；
 * 每个已加载的窗口有缓存，切回来不重新拉取。
 */
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
    if (!force && viewsRef.current.has(target)) return // 已缓存——切换回来免费
    const token = ++activeRef.current
    setError(null)
    try {
      const res = await fetch(`${ROUTE_USAGE}?${QUERY_RANGE}=${target}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const view = await res.json() as ProviderUsageView
      if (token !== activeRef.current) return // 被更新的切换取代
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

  // 每个选中的窗口拉取一次；切换后的过期响应被丢弃。
  useEffect(() => {
    void load(range)
  }, [range, load])

  // 面板卸载（tab 切换）时推进 active token，防止在飞的响应更新已卸载面板。
  useEffect(() => () => { activeRef.current += 1 }, [])

  const view = views.get(range)
  const moneyOf = (value: number): string => formatMoney(value)
  const busy = view === undefined && error === null
  const available = view === undefined ? cuts : cutsOf(view)

  // 切法始终重新推导、绝不直接信任：换窗口可能清空当前选中的那一面，空面板不能对着用户。
  const active: Slice = available.includes(slice) ? slice : available[0] ?? 'model'
  const note = SLICE_NOTES[active]
  const cols = COLUMNS[active]
  // 切法条：加载中留着上一次的切法集（不闪、也不整块消失）；窗口没数据可看时（错误态）整条收掉
  // ——一条点不动的切法条加一个空面板，读起来像「这里没有行」，而真相是这一次没读到。
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
      {/* 页头常驻，且**行数固定**：第一行是分区词 + 窗口控件，第二行是窗口合计。合计单独占一整行
          （而不是挤在标题与控件之间）是这里的关键——它随窗口变宽变窄，挤在同一行就会把窗口控件
          推来推去、在「一行 / 两行」之间来回折行；实测那一次折行让切法条与整张列表上下跳 33px。
          固定成两行之后，页头高度与任何数字无关，窗口控件的右边缘也永远在同一个位置。 */}
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
          </div>
        </div>
        {view !== undefined ? (
          // 事实带与总览 hero 的「累计」那条同一套词汇（请求 / 词元 / 实际支出 / 订阅价值），
          // 所以两个 tab 的口径读起来是一句话。窗口合计与当前切法无关——三面加起来就是它。
          <span className="dtpl-hero-facts dtpl-usage-facts">
            <span className="dtpl-hero-fact"><b>{view.totalRequests}</b> 请求</span>
            <i aria-hidden="true">·</i>
            <span className="dtpl-hero-fact"><b>{formatTokens(view.totalTokens)}</b> 词元</span>
            <i aria-hidden="true">·</i>
            <span className="dtpl-hero-fact"><b>{moneyOf(view.totalSpend)}</b> 实际支出</span>
            {view.totalSubscriptionValue > 0 && (
              <>
                <i aria-hidden="true">·</i>
                <span className="dtpl-hero-fact"><b>{moneyOf(view.totalSubscriptionValue)}</b> 订阅价值</span>
              </>
            )}
          </span>
        ) : busy ? (
          // 合计的占位：与真事实带同高，数据到达时这一行不重排。
          <span className="dtpl-sk dtpl-usage-facts-sk" aria-hidden="true" />
        ) : (
          // 错误态：这一行留空而不是收掉——收掉会让下面的错误块与切法条整体上移。
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
            // 首次加载：切法还不知道（无工作区注册表的宿主只有两面）。占位条与真 tab 条同高，
            // 数据到达时这一行不跳。
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
          <span className="dtpl-bd-col-nums">{cols.nums}</span>
        </div>
      ) : null}

      <div
        role="tabpanel"
        id="dtpl-usage-panel"
        aria-busy={busy}
        // 只在切法条真的挂着时才指向它：错误态整条收掉，指向一个不存在的 id 比不指更糟。
        aria-labelledby={showCuts && available.length > 0 ? `dtpl-usage-tab-${active}` : undefined}
      >
        {view === undefined
          ? (busy && <PanelSkeleton slice={active} />)
          : active === 'model'
            ? <ModelRows byModel={view.byModel} totalTokens={view.totalTokens} money={moneyOf} />
            : active === 'workspace'
              ? <WorkspaceRows rows={view.byWorkspace} totalTokens={view.totalTokens} money={moneyOf} />
              : <ProviderCards cards={view.providers} labels={view.providerLabels ?? {}} money={moneyOf} />}
      </div>
    </section>
  )
}

/** 按通道那一面：一张卡一个 provider。 */
function ProviderCards({ cards, labels, money }: {
  cards: readonly ProviderUsageCard[]
  labels: Record<string, string>
  money: (value: number) => string
}) {
  return (
    <div className="dtpl-providers">
      {cards.map((card) => (
        <ProviderCard key={card.provider} card={card} money={money} labels={labels} />
      ))}
    </div>
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
          <span className="dtpl-provider-cost">
            <span className="dtpl-provider-spend">{money(card.spend)}</span>
            {card.subscriptionValue > 0 && (
              <span className="dtpl-provider-value" title="订阅通道：这些用量按量付费本来要花的钱（非实际扣款）">{money(card.subscriptionValue)} 订阅价值</span>
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
              {/* 每一格自带列名（`.dtpl-sr`）：这一面没有列头（通道卡的模型行是「身份 + 数字」
                  两列形态），读屏听到「830.3M」时得知道那是词元还是金额——与用量明细同一套补偿。
                  占比条同理：它的分母是**这张卡**，所以读屏也这么念。 */}
              <span className="dtpl-val">
                <span className="dtpl-sr">词元 </span>{formatTokens(m.tokens)}
                <span className="dtpl-sr">，占本通道 {formatShare(m.tokens, cardTokens)}</span>
              </span>
              <span className="dtpl-provider-model-sub">
                {m.totals.requests} 请求 ·{' '}
                {m.spend > 0
                  ? <><span className="dtpl-sr">金额 </span><b className="dtpl-cash-amt">{money(m.spend)}</b></>
                  : <><span className="dtpl-sr">金额 </span><b className="dtpl-sub-amt">{money(m.subscriptionValue)}</b><em className="dtpl-cost-k">订阅价值</em></>}
              </span>
            </div>
          </div>
        ))}
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
