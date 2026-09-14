/**
 * 用量总览 tab 的两个拆分角度，共用一个子 tab 切换：按模型与按工作区。两者是**同一份累计账本**的不同视角。切换只展示存在的内容：无行的拆分不贡献 tab。
 *
 * @module dsh-tokbook/client/Breakdowns
 */

import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { CostedModelRow, WorkspaceUsageRow } from '../types.ts'
import { totalsTokens } from '../types.ts'
import { formatDateTime, formatRelative, formatTokens, share } from './format.ts'

/** 当前展示的账本角度。 */
type BreakdownTab = 'model' | 'workspace'

/** 各面板的右侧旁注：覆盖面 + 行排序（两个角度不共享排序键）。 */
const PANEL_NOTES: Record<BreakdownTab, { text: string; title: string }> = {
  model: {
    text: '全账本累计 · 词元从多到少',
    title: '每个模型的累计词元与费用（全账本），按词元从多到少排列。',
  },
  workspace: {
    text: '全账本累计 · 最近有操作在前',
    title: '每个工作区的累计词元（全账本）。记录按会话的创建目录归属到工作区；没有工作区目录、或目录未注册为工作区的记录归入「未归属」。',
  },
}

/**
 * 列头。**一行**写：两列各自是一串上下叠起来的事实（身份两行、数值两行），
 * 所以列名也按同样的先后写成「甲 · 乙」——分隔符用的就是这个窗口里表示「一串事实」的 `·`
 * （旁注与工作区事实行都用它）。
 * 早先这里照数据的两行写成了两行列头（模型 / 通道 各占一行），标签能精确落在各自数值
 * 正上方，但代价是四枚孤零零的标签占掉两行、中间大片空白——**表头比它标注的数据还高**。
 * 一行牺牲的是「精确对位」，换来的是它终于像一行表头。
 */
const COLUMNS: Record<BreakdownTab, { id: string; nums: string }> = {
  model: { id: '模型 · 通道', nums: '词元 · 金额' },
  workspace: { id: '工作区 · 目录', nums: '词元 · 金额' },
}

export function Breakdowns({ byModel, byWorkspace, totalTokens, money }: {
  byModel: readonly CostedModelRow[]
  byWorkspace: readonly WorkspaceUsageRow[]
  totalTokens: number
  money: (value: number) => string
}) {
  const [tab, setTab] = useState<BreakdownTab>('model')
  const hasModel = byModel.length > 0
  const hasWorkspace = byWorkspace.length > 0
  if (!hasModel && !hasWorkspace) return null
  // 活动 tab 始终重新推导、绝不直接信任：再同步可能清空当前选中的面板，空面板不能对着用户。
  const active: BreakdownTab = hasModel && (tab === 'model' || !hasWorkspace) ? 'model' : 'workspace'
  const note = PANEL_NOTES[active]
  const cols = COLUMNS[active]
  const onTablistKeyDown = (e: ReactKeyboardEvent): void => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    e.preventDefault()
    const order: BreakdownTab[] = hasModel && hasWorkspace ? ['model', 'workspace'] : [active]
    const next = order[(order.indexOf(active) + delta + order.length) % order.length]!
    setTab(next)
    document.getElementById(`dtpl-bd-tab-${next}`)?.focus()
  }
  return (
    <section className="dtpl-bd">
      {/* 分区词 + 工业徽记，与「今日词元构成」「近 14 天趋势」同一套头部；子 tab 挂在这一行上。
          此前这里只有两个 tab 标签，而它们说的是**切法**、不是这一节是什么。 */}
      <div className="dtpl-bd-head">
        <h2 className="dtpl-sec-title dtpl-bd-title">用量明细</h2>
        <div className="dtpl-bd-tabs" role="tablist" aria-label="拆分方式" onKeyDown={onTablistKeyDown}>
          {hasModel && (
            <button
              type="button"
              role="tab"
              id="dtpl-bd-tab-model"
              aria-selected={active === 'model'}
              aria-controls="dtpl-bd-panel"
              tabIndex={active === 'model' ? 0 : -1}
              className="dtpl-bd-tab"
              onClick={() => setTab('model')}
            >
              按模型
            </button>
          )}
          {hasWorkspace && (
            <button
              type="button"
              role="tab"
              id="dtpl-bd-tab-workspace"
              aria-selected={active === 'workspace'}
              aria-controls="dtpl-bd-panel"
              tabIndex={active === 'workspace' ? 0 : -1}
              className="dtpl-bd-tab"
              onClick={() => setTab('workspace')}
            >
              按工作区
            </button>
          )}
        </div>
        <span className="dtpl-sec-aside" title={note.title}>{note.text}</span>
      </div>
      <div className="dtpl-bd-cols" aria-hidden="true">
        <span className="dtpl-bd-col-id">{cols.id}</span>
        <span className="dtpl-bd-col-nums">{cols.nums}</span>
      </div>
      <div
        className="dtpl-bd-panel"
        role="tabpanel"
        id="dtpl-bd-panel"
        aria-labelledby={`dtpl-bd-tab-${active}`}
      >
        {active === 'model'
          ? <ModelRows byModel={byModel} totalTokens={totalTokens} money={money} />
          : <WorkspaceRows rows={byWorkspace} totalTokens={totalTokens} money={money} />}
      </div>
    </section>
  )
}

/** 每 (provider, model) 一行：词元、占比、计费金额——订阅通道显示省下的钱，绝不用现金外观包装。 */
function ModelRows({ byModel, totalTokens, money }: {
  byModel: readonly CostedModelRow[]
  totalTokens: number
  money: (value: number) => string
}) {
  // 按**显示出来的**量排序。占比条编码的是词元，清单若按别的键排，条长就不是单调的，
  // 整列读起来像渲染坏了；而「按请求数排」还得让读者去别处找那个没显示的数字。
  const rows = [...byModel].sort((left, right) =>
    totalsTokens(right.totals) - totalsTokens(left.totals)
    || right.totals.requests - left.totals.requests
    || left.model.localeCompare(right.model)
    || left.provider.localeCompare(right.provider))
  return (
    <div className="dtpl-models">
      {rows.map((m) => {
        // 一行只有一个金额桶（计费是 route 事实），但**标明是哪一桶**不是可省的：现金行写
        // 「实际支出」、订阅行写「订阅价值」。两枚标签都是四个汉字、在等宽栈里同宽，
        // 所以数字的右边缘仍然落在同一条竖线上，而标签永远不会换行或被裁掉。
        const showsSub = m.spend === 0
        const bucket = showsSub ? '订阅价值' : '实际支出'
        const costText = `${showsSub ? money(m.subscriptionValue) : money(m.spend)} ${bucket}`
        return (
          <div className="dtpl-row" key={`${m.provider}/${m.model}`}>
            <div className="dtpl-model">
              <span className="dtpl-model-name">{m.model}</span>
              {/* 通道由列头命名，行内不再重复「通道」两个字——但那两个字对读屏是**列的意义**，
                  所以它们换成只给读屏的文本留在格子里（旧版把它们一起删掉，等于从无障碍树里
                  也删掉了「commandcode 是什么」）。 */}
              {m.provider !== '' && (
                <span className="dtpl-model-provider"><span className="dtpl-sr">通道 </span>{m.provider}</span>
              )}
            </div>
            <div className="dtpl-model-nums">
              <span className="dtpl-val"><span className="dtpl-sr">词元 </span>{formatTokens(totalsTokens(m.totals))}</span>
              <span className="dtpl-cost" title={costText}>
                <span className="dtpl-cost-seg">
                  <span className="dtpl-cost-main">
                    <span className="dtpl-sr">金额 </span>
                    {showsSub
                      ? <b className="dtpl-sub-amt">{money(m.subscriptionValue)}</b>
                      : money(m.spend)}
                  </span>
                  <em className="dtpl-cost-k">{bucket}</em>
                </span>
              </span>
            </div>
            <span className="dtpl-model-bar" role="presentation">
              <span className="dtpl-model-bar-fill" style={{ width: `${share(totalsTokens(m.totals), totalTokens)}%` }} />
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 每个工作区一行，最近使用在前。未归属行收尾：它持有无注册工作区认领的记录，因此各行才能加回累计词元。它是对账行、不是项目。
 *
 * 失败数进**行内**而不是只留在 hover 里：它是这一行唯一会改变动作的事实，而 hover
 * 在触屏与键盘上够不着。四桶拆分与精确时刻是补充细节，留在 hover 里没有代价。
 */
function WorkspaceRows({ rows, totalTokens, money }: {
  rows: readonly WorkspaceUsageRow[]
  totalTokens: number
  money: (value: number) => string
}) {
  return (
    <div className="dtpl-models">
      {rows.map((row) => {
        const failed = row.totals.failures ?? 0
        const cash = row.spend > 0
        const sub = row.subscriptionValue > 0
        // 金额这一格的完整文本：格子可能被裁（界面上它是被**限宽**的那一个），
        // 所以同一条串也交给 title——值是不可预测的那部分，只限它、不限标签。
        const costText = [
          cash || !sub ? `${money(row.spend)} 实际支出` : '',
          sub ? `${money(row.subscriptionValue)} 订阅价值` : '',
        ].filter(part => part !== '').join(' · ')
        return (
          <div
            className={`dtpl-row${row.id === '' ? ' is-unattributed' : ''}`}
            key={row.id === '' ? 'unattributed' : row.id}
            title={workspaceDetail(row, money)}
          >
            <div className="dtpl-model">
              <span className="dtpl-model-name">{row.title}</span>
              {/* 目录在压力下截断（省略号）；两个事实不截——被截断的「最近 …」会被读成坏掉的数字。
                  「N 失败」是这一行唯一会改变动作的事实，所以它带色相（与 hero 的今日异常行同一条
                  规矩：色相只给要看一眼的状态），而请求数、最近时刻是读数，不染色。 */}
              <span className="dtpl-ws-meta">
                {row.path !== '' && (
                  <>
                    <span className="dtpl-ws-path" title={row.path}><span className="dtpl-sr">目录 </span>{row.path}</span>
                    <span className="dtpl-ws-sep" aria-hidden="true">·</span>
                  </>
                )}
                <span className="dtpl-ws-facts">
                  {row.totals.requests} 请求
                  {failed > 0 && <> · <b className="dtpl-ws-fail">{failed} 失败</b></>}
                  {' '}· 最近 {formatRelative(row.lastAt)}
                </span>
              </span>
            </div>
            <div className="dtpl-model-nums">
              <span className="dtpl-val"><span className="dtpl-sr">词元 </span>{formatTokens(row.tokens)}</span>
              {/* 工作区跨通道，两个金额桶可同时非零——所以一格里有**两段**「数额 + 桶名」，段之间用
                  这个窗口表示「一串事实」的 `·` 分隔（与 hero 的累计事实带同一条写法）。桶名与模型行
                  共用同一条槽位，所以各段数额的右边缘仍然落在同一条竖线上；两者都无话时用一枚零
                  撑住格子：「价格未知」是口径，不是免费。 */}
              <span className="dtpl-cost" title={costText}>
                {(cash || !sub) && (
                  <span className="dtpl-cost-seg">
                    <span className="dtpl-cost-main">
                      <span className="dtpl-sr">金额 </span>
                      {money(row.spend)}
                    </span>
                    <em className="dtpl-cost-k">实际支出</em>
                  </span>
                )}
                {cash && sub && <span className="dtpl-cost-sep" aria-hidden="true">·</span>}
                {sub && (
                  <span className="dtpl-cost-seg">
                    <span className="dtpl-cost-main"><b className="dtpl-sub-amt">{money(row.subscriptionValue)}</b></span>
                    <em className="dtpl-cost-k">订阅价值</em>
                  </span>
                )}
              </span>
            </div>
            <span className="dtpl-model-bar" role="presentation">
              <span className="dtpl-model-bar-fill" style={{ width: `${share(row.tokens, totalTokens)}%` }} />
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** 工作区行的 hover 审计信息：身份、累计词元四桶、请求/失败、两个金额桶、最近使用时间。 */
function workspaceDetail(row: WorkspaceUsageRow, money: (value: number) => string): string {
  const totals = row.totals
  const failed = totals.failures ?? 0
  return [
    row.path === '' ? '未归属用量' : `工作区 ${row.title}`,
    row.path === '' ? '会话没有工作区目录，或目录未注册为工作区。' : `目录 ${row.path}`,
    `累计 ${formatTokens(row.tokens)} 词元 · ${totals.requests} 请求${failed > 0 ? ` · ${failed} 失败` : ''}`,
    `输入 ${formatTokens(totals.inputTokens)} · 缓存读取 ${formatTokens(totals.cacheReadTokens)}`
    + ` · 缓存写入 ${formatTokens(totals.cacheWriteTokens)} · 输出 ${formatTokens(totals.outputTokens)}`,
    `实际支出 ${money(row.spend)} · 订阅价值 ${money(row.subscriptionValue)}`,
    `最近一次 ${formatDateTime(row.lastAt)}`,
  ].join('\n')
}
