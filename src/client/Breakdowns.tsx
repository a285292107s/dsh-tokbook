/**
 * The two breakdown angles of the 用量总览 tab, behind one sub-tab switch:
 * 按模型 (which models the ledger billed) and 按工作区 (which project the spend
 * belongs to). Both are views of the SAME cumulative ledger — the host folds it
 * by model in the summary and joins it to workspaces at read time — so one
 * panel at a time is the honest shape: no duplicated money columns, and the
 * second angle costs the first one nothing.
 *
 * Each panel keeps the ordering its own angle actually has: models by request
 * count (`stats.modelRows`), workspaces most-recently-used first. The aside
 * names that order, because two different sort keys inside one view switch are
 * easy to misread.
 *
 * The switch only offers what exists: a breakdown with no rows — an
 * all-unattributed ledger for models, a host mounting no workspace registry for
 * workspaces — contributes no tab.
 *
 * @module dsh-tokbook/client/Breakdowns
 */

import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { CostedModelRow, WorkspaceUsageRow } from '../types.ts'
import { totalsTokens } from '../types.ts'
import { formatDateTime, formatRelative, formatTokens, share } from './format.ts'

/** Which angle of the ledger is on screen. */
type BreakdownTab = 'model' | 'workspace'

/** The right-hand note of each panel: what the panel covers, and how its rows
 *  are ordered (the two angles do not share a sort key). */
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
  // The active tab is RE-DERIVED, never trusted: a rescan can empty the panel
  // that is currently selected (workspaces disappear when the registry stops
  // answering), and an empty panel must not be what stares back.
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

/** One row per (provider, model): tokens, its share of the ledger, and the
 *  billed amount — 订阅价值 when the route's billing is a subscription, never
 *  dressed up as cash. */
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
 * One row per workspace, most recently used first. The 未归属 row closes the
 * list: it holds the records no registered workspace claims, which is what
 * keeps the rows adding back up to 累计词元. It is a reconciliation line, not a
 * project, so "most recent first" does not apply to it.
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
            {/* The directory yields (ellipsis) under pressure; the two facts
                never do — a clipped "最近 …" would read as a broken number. */}
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
            {/* A workspace spans channels, so BOTH money buckets can be
                non-zero at once — unlike a model row, which one route scopes
                to a single bucket. Each non-zero bucket is therefore named,
                and a fully unpriced workspace still shows ¥0.00 (价格未知 is
                a 口径, never a free ride). */}
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

/** The hover audit trail of one workspace row: identity, cumulative token
 * split, requests/failures, both money buckets and when it was last used. */
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
