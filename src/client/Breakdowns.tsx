import type { CostedModelRow, WorkspaceUsageRow } from '../types.ts'
import { totalsTokens } from '../types.ts'
import { formatDateTime, formatRelative, formatShare, formatTokens } from './format.ts'
import { ShareRing } from './ShareRing.tsx'

export function isNoPrice(cost: number, unpriced: boolean): boolean {
  return unpriced && cost === 0
}

export function ModelRows({ byModel, totalTokens, money, unpriced, showMoney }: {
  byModel: readonly CostedModelRow[]
  totalTokens: number
  money: (value: number) => string
  unpriced: ReadonlySet<string>
  showMoney: boolean
}) {
  const rows = [...byModel].sort((left, right) =>
    totalsTokens(right.totals) - totalsTokens(left.totals)
    || right.totals.requests - left.totals.requests
    || left.model.localeCompare(right.model)
    || left.provider.localeCompare(right.provider))
  return (
    <div className="dtpl-models">
      {rows.map((m) => {
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

export function WorkspaceRows({ rows, totalTokens, money, showMoney }: {
  rows: readonly WorkspaceUsageRow[]
  totalTokens: number
  money: (value: number) => string
  showMoney: boolean
}) {
  return (
    <div className="dtpl-models">
      {rows.map((row) => {
        const failed = row.totals.failures ?? 0
        const cash = row.spend > 0
        const sub = row.subscriptionValue > 0
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
