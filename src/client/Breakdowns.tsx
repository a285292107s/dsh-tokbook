/**
 * 用量明细 tab 的两种行清单：按模型与按工作区。两者是**同一份窗口记录**的不同视角，
 * 由 `ProviderPanel` 装配（窗口与切法都在那一层选）。
 *
 * @module dsh-tokbook/client/Breakdowns
 */

import type { CostedModelRow, WorkspaceUsageRow } from '../types.ts'
import { totalsTokens } from '../types.ts'
import { formatDateTime, formatRelative, formatShare, formatTokens, share } from './format.ts'

/** 每 (provider, model) 一行：词元、占比、计费金额——订阅通道显示省下的钱，绝不用现金外观包装。 */
export function ModelRows({ byModel, totalTokens, money }: {
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
        const tokens = totalsTokens(m.totals)
        return (
          <div className="dtpl-row" key={`${m.provider}/${m.model}`} title={modelDetail(m, totalTokens, money)}>
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
              {/* 占比条是这一行唯一的形状，而它的分母（本窗口词元合计）不在行里——所以读屏
                  也在词元后面把比例念出来（只给读屏，不占视觉宽度）。 */}
              <span className="dtpl-val">
                <span className="dtpl-sr">词元 </span>{formatTokens(tokens)}
                <span className="dtpl-sr">，占本窗口 {formatShare(tokens, totalTokens)}</span>
              </span>
              <span className="dtpl-cost" title={costText}>
                <span className="dtpl-cost-seg">
                  <span className="dtpl-cost-main">
                    <span className="dtpl-sr">金额 </span>
                    {showsSub
                      ? <b className="dtpl-sub-amt">{money(m.subscriptionValue)}</b>
                      : <b className="dtpl-cash-amt">{money(m.spend)}</b>}
                  </span>
                  <em className="dtpl-cost-k">{bucket}</em>
                </span>
              </span>
            </div>
            <span className="dtpl-model-bar" role="presentation">
              <span className="dtpl-model-bar-fill" style={{ width: `${share(tokens, totalTokens)}%` }} />
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 每个工作区一行，最近使用在前。未归属行收尾：它持有无注册工作区认领的记录，因此各行才能加回窗口词元。它是对账行、不是项目。
 *
 * 失败数进**行内**而不是只留在 hover 里：它是这一行唯一会改变动作的事实，而 hover
 * 在触屏与键盘上够不着。四桶拆分与精确时刻是补充细节，留在 hover 里没有代价。
 */
export function WorkspaceRows({ rows, totalTokens, money }: {
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
              <span className="dtpl-val">
                <span className="dtpl-sr">词元 </span>{formatTokens(row.tokens)}
                <span className="dtpl-sr">，占本窗口 {formatShare(row.tokens, totalTokens)}</span>
              </span>
              {/* 工作区跨通道，两个金额桶可同时非零——所以一格里有**两段**「数额 + 桶名」，段之间用
                  这个窗口表示「一串事实」的 `·` 分隔（与 hero 的累计事实带同一条写法）。桶名与模型行
                  共用同一条槽位，所以各段数额的右边缘仍然落在同一条竖线上；两者都无话时用一枚零
                  撑住格子：「价格未知」是口径，不是免费。 */}
              <span className="dtpl-cost" title={costText}>
                {(cash || !sub) && (
                  <span className="dtpl-cost-seg">
                    <span className="dtpl-cost-main">
                      <span className="dtpl-sr">金额 </span>
                      <b className="dtpl-cash-amt">{money(row.spend)}</b>
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

/**
 * 工作区行的 hover 审计信息：身份、窗口词元四桶、请求/失败、两个金额桶、最近使用时间。
 * 与模型行同一套写法（`modelDetail`）——两面的 hover 说的是同一类事实。
 */
function workspaceDetail(row: WorkspaceUsageRow, money: (value: number) => string): string {
  const totals = row.totals
  const failed = totals.failures ?? 0
  return [
    row.path === '' ? '未归属用量' : `工作区 ${row.title}`,
    row.path === '' ? '会话没有工作区目录，或目录未注册为工作区。' : `目录 ${row.path}`,
    `窗口 ${formatTokens(row.tokens)} 词元 · ${totals.requests} 请求${failed > 0 ? ` · ${failed} 失败` : ''}`,
    `输入 ${formatTokens(totals.inputTokens)} · 缓存读取 ${formatTokens(totals.cacheReadTokens)}`
    + ` · 缓存写入 ${formatTokens(totals.cacheWriteTokens)} · 输出 ${formatTokens(totals.outputTokens)}`,
    `实际支出 ${money(row.spend)} · 订阅价值 ${money(row.subscriptionValue)}`,
    `最近一次 ${formatDateTime(row.lastAt)}`,
  ].join('\n')
}

/**
 * 模型行的 hover 审计信息：身份（模型 + 通道）、窗口词元与占比、请求 / 压缩 / 失败、
 * 四桶、两个金额桶。行内只放得下身份、词元与一个金额桶，其余留在这里。
 */
function modelDetail(row: CostedModelRow, totalTokens: number, money: (value: number) => string): string {
  const totals = row.totals
  const tokens = totalsTokens(totals)
  const failed = totals.failures ?? 0
  const compactions = totals.compactions ?? 0
  const unknown = totals.usageUnknown ?? 0
  return [
    `模型 ${row.model}`,
    ...(row.provider === '' ? [] : [`通道 ${row.provider}`]),
    `窗口 ${formatTokens(tokens)} 词元（占本窗口 ${formatShare(tokens, totalTokens)}）`
    + ` · ${totals.requests} 请求${compactions > 0 ? ` · ${compactions} 压缩` : ''}`
    + `${failed > 0 ? ` · ${failed} 失败` : ''}${unknown > 0 ? ` · ${unknown} 次没上报用量` : ''}`,
    `输入 ${formatTokens(totals.inputTokens)} · 缓存读取 ${formatTokens(totals.cacheReadTokens)}`
    + ` · 缓存写入 ${formatTokens(totals.cacheWriteTokens)} · 输出 ${formatTokens(totals.outputTokens)}`,
    `实际支出 ${money(row.spend)} · 订阅价值 ${money(row.subscriptionValue)}`,
  ].join('\n')
}
