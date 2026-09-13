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
    text: '全账本累计 · 请求数从多到少',
    title: '每个模型的累计词元与费用（全账本），按请求数从多到少排列。',
  },
  workspace: {
    text: '全账本累计 · 最近有操作在前',
    title: '每个工作区的累计词元（全账本）。记录按会话的创建目录归属到工作区；没有工作区目录、或目录未注册为工作区的记录归入「未归属」。',
  },
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
      <div className="dtpl-bd-head">
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

/** 每 (provider, model) 一行：词元、占比、计费金额——订阅通道显示订阅价值，绝不用现金外观包装。 */
function ModelRows({ byModel, totalTokens, money }: {
  byModel: readonly CostedModelRow[]
  totalTokens: number
  money: (value: number) => string
}) {
  return (
    <div className="dtpl-models">
      {byModel.map((m) => (
        <div className="dtpl-row" key={`${m.provider}/${m.model}`}>
          <div className="dtpl-model">
            <span className="dtpl-model-name">{m.model}</span>
            {m.provider !== '' && <span className="dtpl-model-provider">{m.provider}</span>}
            <span className="dtpl-model-bar" role="presentation">
              <span className="dtpl-model-bar-fill" style={{ width: `${share(totalsTokens(m.totals), totalTokens)}%` }} />
            </span>
          </div>
          <div className="dtpl-model-nums">
            <span className="dtpl-val">{formatTokens(totalsTokens(m.totals))}</span>
            <span className="dtpl-cost">
              {m.spend > 0
                ? money(m.spend)
                : <><b className="dtpl-sub-amt">{money(m.subscriptionValue)}</b><em className="dtpl-sub-k">订阅价值</em></>}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * 每个工作区一行，最近使用在前。未归属行收尾：它持有无注册工作区认领的记录，因此各行才能加回累计词元。它是对账行、不是项目。
 */
function WorkspaceRows({ rows, totalTokens, money }: {
  rows: readonly WorkspaceUsageRow[]
  totalTokens: number
  money: (value: number) => string
}) {
  return (
    <div className="dtpl-models">
      {rows.map(row => (
        <div
          className="dtpl-row"
          key={row.id === '' ? 'unattributed' : row.id}
          title={workspaceDetail(row, money)}
        >
          <div className="dtpl-model">
            <span className="dtpl-model-name">{row.title}</span>
            {/* 目录在压力下截断（省略号）；两个事实不截——被截断的「最近 …」会被读成坏掉的数字。 */}
            <span className="dtpl-ws-meta">
              {row.path !== '' && (
                <>
                  <span className="dtpl-ws-path" title={row.path}>{row.path}</span>
                  <span className="dtpl-ws-sep" aria-hidden="true">·</span>
                </>
              )}
              <span className="dtpl-ws-facts">
                {row.totals.requests} 请求 · 最近 {formatRelative(row.lastAt)}
              </span>
            </span>
            <span className="dtpl-model-bar" role="presentation">
              <span className="dtpl-model-bar-fill" style={{ width: `${share(row.tokens, totalTokens)}%` }} />
            </span>
          </div>
          <div className="dtpl-model-nums">
            <span className="dtpl-val">{formatTokens(row.tokens)}</span>
            {/* 工作区跨通道，两个金额桶可同时非零——因此每个非零桶各自标明，全未定价的工作区仍显示 ¥0.00（价格未知是口径，不是免费）。 */}
            <span className="dtpl-cost">
              {row.spend > 0 && <span>{money(row.spend)}</span>}
              {row.spend > 0 && row.subscriptionValue > 0 && <span aria-hidden="true"> · </span>}
              {row.subscriptionValue > 0 && (
                <><b className="dtpl-sub-amt">{money(row.subscriptionValue)}</b><em className="dtpl-sub-k">订阅价值</em></>
              )}
              {row.spend === 0 && row.subscriptionValue === 0 && <span>{money(0)}</span>}
            </span>
          </div>
        </div>
      ))}
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
