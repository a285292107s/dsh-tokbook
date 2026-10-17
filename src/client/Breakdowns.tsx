/**
 * 用量明细的两种行清单：按模型与按工作区。两者是**同一份窗口记录**的不同视角，
 * 由 `ProviderPanel` 装配（窗口与切法都在那一层选）。
 */

import type { CostedModelRow, WorkspaceUsageRow } from '../types.ts'
import { totalsTokens } from '../types.ts'
import { formatDateTime, formatRelative, formatShare, formatTokens } from './format.ts'
import { ShareRing } from './ShareRing.tsx'

/** 价表计不了费、且这个窗口里没有任何已定价的记录——金额格无读数可报。 */
export function isNoPrice(cost: number, unpriced: boolean): boolean {
  return unpriced && cost === 0
}

export function ModelRows({ byModel, totalTokens, money, unpriced, showMoney }: {
  byModel: readonly CostedModelRow[]
  totalTokens: number
  money: (value: number) => string
  /** 价表无法计费（按 ¥0 计）的 (通道, 模型) 键，`${provider}|${model}`。 */
  unpriced: ReadonlySet<string>
  /** 这个窗口给不给金额。「全部账本」不给——按现价折算的刻度只对最近的窗口成立。 */
  showMoney: boolean
}) {
  // 按**显示出来的**量排序：占比环编码的是词元，清单若按别的键排，弧长就不是单调的，
  // 整列读起来像渲染坏了。
  const rows = [...byModel].sort((left, right) =>
    totalsTokens(right.totals) - totalsTokens(left.totals)
    || right.totals.requests - left.totals.requests
    || left.model.localeCompare(right.model)
    || left.provider.localeCompare(right.provider))
  return (
    <div className="dtpl-models">
      {rows.map((m) => {
        // 一行只有一个金额桶（计费是 route 事实，CONTRACTS §2），但**标明是哪一桶**不是可省的。
        // 各段数额右缘对齐依赖三枚桶名等宽（都是四个汉字）——改名要重量。
        const noPrice = isNoPrice(m.cost, unpriced.has(`${m.provider}|${m.model}`))
        const showsSub = m.spend === 0
        const bucket = noPrice ? '价格未知' : showsSub ? '订阅价值' : '实际支出'
        const costText = noPrice ? '价格未知：按 ¥0 计'
          : `${showsSub ? money(m.subscriptionValue) : money(m.spend)} ${bucket}`
        const tokens = totalsTokens(m.totals)
        return (
          <div className="dtpl-row" key={`${m.provider}/${m.model}`} title={modelDetail(m, totalTokens, money, noPrice, showMoney)}>
            <div className="dtpl-model">
              <ShareRing value={tokens} total={totalTokens} denom="本窗口" />
              <div className="dtpl-model-txt">
                <span className="dtpl-model-name">{m.model}</span>
                {/* 通道由列头命名，行内不重复「通道」两个字；但列头对读屏是 aria-hidden 的，
                    列的意义得靠格子里这枚只给读屏的「通道」。 */}
                {m.provider !== '' && (
                  <span className="dtpl-model-provider"><span className="dtpl-sr">通道 </span>{m.provider}</span>
                )}
              </div>
            </div>
            <div className="dtpl-model-nums">
              <span className="dtpl-val">
                <span className="dtpl-sr">词元 </span>{formatTokens(tokens)}
              </span>
              {showMoney && (
                <span className="dtpl-cost" title={costText}>
                  <span className="dtpl-cost-seg">
                    <span className="dtpl-cost-main">
                      <span className="dtpl-sr">金额 </span>
                      {noPrice
                        ? <b className="dtpl-cost-na">—</b>
                        : showsSub
                          ? <b className="dtpl-sub-amt">{money(m.subscriptionValue)}</b>
                          : <b className="dtpl-cash-amt">{money(m.spend)}</b>}
                    </span>
                    <em className="dtpl-cost-k">{bucket}</em>
                  </span>
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 每个工作区一行，最近使用在前。未归属行收尾：它持有无注册工作区认领的记录，因此各行才能
 * 加回窗口词元。
 *
 * 失败数进**行内**而不是只留在 hover 里：它是这一行唯一会改变动作的事实，而 hover
 * 在触屏与键盘上够不着。四桶拆分与精确时刻是补充细节，留在 hover 里没有代价。
 */
export function WorkspaceRows({ rows, totalTokens, money, showMoney }: {
  rows: readonly WorkspaceUsageRow[]
  totalTokens: number
  money: (value: number) => string
  /** 这个窗口给不给金额（判据同 `ModelRows`）。 */
  showMoney: boolean
}) {
  return (
    <div className="dtpl-models">
      {rows.map((row) => {
        const failed = row.totals.failures ?? 0
        const cash = row.spend > 0
        const sub = row.subscriptionValue > 0
        // 数额这一格被限宽、可能被裁（见 ledger 片段的 .dtpl-cost），所以 title 带同一条
        // 完整文本——只限不可预测的数额，不限标签。
        const costText = [
          cash || !sub ? `${money(row.spend)} 实际支出` : '',
          sub ? `${money(row.subscriptionValue)} 订阅价值` : '',
        ].filter(part => part !== '').join(' · ')
        return (
          <div
            className={`dtpl-row${row.id === '' ? ' is-unattributed' : ''}`}
            key={row.id === '' ? 'unattributed' : row.id}
            title={workspaceDetail(row, money, showMoney)}
          >
            <div className="dtpl-model">
              <ShareRing value={row.tokens} total={totalTokens} denom="本窗口" />
              <div className="dtpl-model-txt">
                <span className="dtpl-model-name">{row.title}</span>
                {/* 目录在压力下截断（省略号）；事实串永不截——被截断的「最近 …」会被读成
                    坏掉的数字。 */}
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
            </div>
            <div className="dtpl-model-nums">
              <span className="dtpl-val">
                <span className="dtpl-sr">词元 </span>{formatTokens(row.tokens)}
              </span>
              {/* 工作区可跨通道、两个金额桶同时非零——不像模型行的单段，这里是两段
                  「数额 + 桶名」；桶名与模型行共用同一条槽位，各段数额的右边缘仍在同一条
                  竖线上。 */}
              {showMoney && (
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
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 工作区行的 hover 审计信息；与模型行的 `modelDetail` 同一套写法——两面的 hover 说的是同一类事实。 */
function workspaceDetail(row: WorkspaceUsageRow, money: (value: number) => string, showMoney: boolean): string {
  const totals = row.totals
  const failed = totals.failures ?? 0
  return [
    row.path === '' ? '未归属用量' : `工作区 ${row.title}`,
    row.path === '' ? '会话没有工作区目录，或目录未注册为工作区。' : `目录 ${row.path}`,
    `窗口 ${formatTokens(row.tokens)} 词元 · ${totals.requests} 请求${failed > 0 ? ` · ${failed} 失败` : ''}`,
    `未缓存输入 ${formatTokens(totals.inputTokens)} · 缓存读取 ${formatTokens(totals.cacheReadTokens)}`
    + ` · 缓存写入 ${formatTokens(totals.cacheWriteTokens)} · 输出 ${formatTokens(totals.outputTokens)}`,
    ...(showMoney ? [`实际支出 ${money(row.spend)} · 订阅价值 ${money(row.subscriptionValue)}`] : []),
    `最近一次 ${formatDateTime(row.lastAt)}`,
  ].join('\n')
}

/** 模型行的 hover 审计信息：行内只放得下身份、词元与一个金额桶，其余留在这里。 */
function modelDetail(
  row: CostedModelRow,
  totalTokens: number,
  money: (value: number) => string,
  noPrice: boolean,
  showMoney: boolean,
): string {
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
    + `${failed > 0 ? ` · ${failed} 失败` : ''}${unknown > 0 ? ` · ${unknown} 次没上报用量` : ''}`
    + `${showMoney && noPrice ? ' · 价格未知' : ''}`,
    `未缓存输入 ${formatTokens(totals.inputTokens)} · 缓存读取 ${formatTokens(totals.cacheReadTokens)}`
    + ` · 缓存写入 ${formatTokens(totals.cacheWriteTokens)} · 输出 ${formatTokens(totals.outputTokens)}`,
    ...(showMoney ? [`实际支出 ${money(row.spend)} · 订阅价值 ${money(row.subscriptionValue)}`] : []),
  ].join('\n')
}
