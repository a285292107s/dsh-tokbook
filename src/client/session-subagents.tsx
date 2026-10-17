/**
 * 会话词元页的「子代理」一段：本会话直接派出的下级会话，每个一行、含它自己的整棵子树。
 *
 * 它**不是**这一页的第五个区块——它回答的是抬头那个问题的一半（这个会话总共花了多少），
 * 所以紧跟在抬头之后。金额跟着走，是因为子代理与主会话共用同一份价表；价格未知的行按 ¥0 计，
 * 与这一页其余口径一致（docs/CONTRACTS.md §2）。
 *
 * 这一页的主合计**不并入**子代理（见 types.ts 的 SessionSubagentsView）：抬头仍是「本会话」，
 * 按轮次明细也只含主会话；两笔账分开写，读者才不会在一个数里同时读到两种范围。
 */

import type { SessionSubagentRow, SessionSubagentsView } from '../types.ts'
import { formatMoney, formatShare, formatTokens } from './format.ts'

/** 标签缺席时用短会话 id 兜底：它仍是「哪个会话」的可核对身份，比「子代理 1」可查。 */
function shortId(sessionId: string): string {
  const bare = sessionId.startsWith('session-') ? sessionId.slice('session-'.length) : sessionId
  return bare.slice(0, 8)
}

function labelOf(row: SessionSubagentRow): string {
  return row.label === '' ? `子代理 ${shortId(row.sessionId)}` : row.label
}

/** 一行子代理的金额读法：整棵子树价格未知时不印 ¥0.00（那是占位，不是读数）。
 *  一次计费调用都没有时也不谈价格——「没有可计价的调用」不是「价格未知」。 */
function costOf(row: SessionSubagentRow): { text: string; kind: 'spend' | 'subscription' | 'unpriced' | 'none' } {
  if (row.requests === 0 && row.failures === 0) return { text: '无计费调用', kind: 'none' }
  if (!row.priced) return { text: '价格未知', kind: 'unpriced' }
  if (row.spend > 0) return { text: `${formatMoney(row.spend)} 实际支出`, kind: 'spend' }
  if (row.subscriptionValue > 0) return { text: `${formatMoney(row.subscriptionValue)} 订阅价值`, kind: 'subscription' }
  return { text: `${formatMoney(0)} 实际支出`, kind: 'spend' }
}

export function SubagentSection({ view, sessionTokens }: { view: SessionSubagentsView; sessionTokens: number }) {
  // 分母只在这一段里成立：本会话 + 全部子代理。「占本会话」会让人以为子代理的行已经并进抬头。
  const share = formatShare(view.totalTokens, sessionTokens + view.totalTokens)
  const nested = view.rows.reduce((sum, row) => sum + row.descendants, 0)
  const priced = view.rows.some((row) => row.priced)
  // 这一段自己的降级事实：用量未知与失败都不产生词元，价格未知的按 ¥0 计——三句都要可见，
  // 否则这一段的合计会被当成「全部调用都有词元、都有价」。
  const notes: string[] = []
  if (view.usageUnknown > 0) notes.push(`其中 ${view.usageUnknown} 次调用没上报用量，词元没有加进任何桶`)
  if (view.failures > 0) notes.push(`失败 ${view.failures} 次（没有产出，不产生词元）`)
  if (view.unpriced.length > 0) notes.push(`价格未知：${view.unpriced.join(' · ')}——这些行按 ¥0 计`)
  return (
    <section aria-label="子代理">
      <h2 className="dtpl-sec-title">子代理</h2>
      <div className="dtpl-tok-sub">
        <div className="dtpl-tok-sub-sum">
          <div className="dtpl-stat" role="listitem">
            <span className="dtpl-stat-k">子代理四桶合计</span>
            <span className="dtpl-stat-v">{formatTokens(view.totalTokens)}</span>
            <span className="dtpl-stat-p">
              {view.count} 个直接子代理{nested > 0 ? ` · 含 ${nested} 个下级` : ''} · 占本会话 + 子代理 {share}
            </span>
          </div>
          <div className="dtpl-stat" role="listitem">
            <span className="dtpl-stat-k">子代理实际支出</span>
            <span className="dtpl-stat-v">{priced ? formatMoney(view.spend) : '—'}</span>
            <span className="dtpl-stat-p">
              {priced
                ? (view.subscriptionValue > 0 ? `另有订阅价值 ${formatMoney(view.subscriptionValue)}` : '按现价折算')
                : '价格未知：这些行按 ¥0 计'}
            </span>
          </div>
        </div>
        <div className="dtpl-tok-sub-list">
          {view.rows.map((row) => {
            const cost = costOf(row)
            return (
              <div className="dtpl-tok-sub-row" key={row.sessionId} title={rowDetail(row)}>
                <span className="dtpl-tok-sub-name">
                  <span className="dtpl-tok-sub-label">{labelOf(row)}</span>
                  {row.descendants > 0 && <span className="dtpl-tok-sub-extra">含 {row.descendants} 个下级</span>}
                </span>
                <span className="dtpl-tok-sub-tokens">{formatTokens(row.tokens)} 词元</span>
                <span className="dtpl-tok-sub-share">占 {formatShare(row.tokens, view.totalTokens)}</span>
                <span className="dtpl-tok-sub-cost" data-kind={cost.kind}>{cost.text}</span>
              </div>
            )
          })}
        </div>
        {notes.length > 0 && (
          <p className="dtpl-tok-note dtpl-tok-sub-note">
            {notes.map((note, index) => (
              <span key={note}>
                {index > 0 && <i aria-hidden="true">·</i>}
                <span>{note}</span>
              </span>
            ))}
          </p>
        )}
      </div>
    </section>
  )
}

/** 一行子代理的 hover 审计：短 id 之外还说清次数、未知量与嵌套数。 */
function rowDetail(row: SessionSubagentRow): string {
  return [
    labelOf(row),
    `会话 ${row.sessionId}`,
    `${row.requests} 次计费调用`,
    ...(row.failures > 0 ? [`${row.failures} 次失败`] : []),
    ...(row.usageUnknown > 0 ? [`其中 ${row.usageUnknown} 次没上报用量`] : []),
    `${formatTokens(row.tokens)} 词元`,
    ...(row.requests === 0 && row.failures === 0
      ? ['没有计费调用']
      : row.priced
        ? [`实际支出 ${formatMoney(row.spend)}`, ...(row.subscriptionValue > 0 ? [`订阅价值 ${formatMoney(row.subscriptionValue)}`] : [])]
        : ['价格未知：按 ¥0 计']),
    ...(row.descendants > 0 ? [`含 ${row.descendants} 个下级子代理（已折进本行）`] : []),
  ].join('\n')
}
