/**
 * 用量总览 tab content: today's hero, the four-bucket split, the daily trend,
 * the per-model breakdown and the cumulative per-workspace section. Shell
 * (tabs, dialog chrome, rescan footer) lives in `LedgerOverlay.tsx`.
 *
 * @module dsh-tokbook/client/LedgerView
 */

import type {
  CostedModelRow, TokBookOverview, UsageDayRow, UsageTotals, WorkspaceUsageRow,
} from '../types.ts'
import { totalsTokens } from '../types.ts'
import type { PricingFocus } from './contract.ts'
import { UsageGlyph } from './icons.tsx'
import {
  formatDateTime, formatHitRate, formatMoney, formatRelative, formatTokens,
  localDayKey, share, shiftDayKey, shortDay,
} from './format.ts'

/** Days in the trend window; the window never starts before the first record. */
const TREND_DAYS = 14

/** Complete days compared against today. Today itself is excluded, so a busy
 * day cannot pull its own baseline up. */
const BASELINE_DAYS = 7

/** Today's ledger row when it has one; the zero row otherwise. */
const ZERO_TOTALS: UsageTotals = {
  requests: 0,
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="dtpl-stat">
      <div className="dtpl-v">{value}</div>
      <div className="dtpl-k">{label}</div>
    </div>
  )
}

/** Everything the hero and the bucket tiles need, all in one window (today). */
interface TodayHero {
  totals: UsageTotals
  tokens: number
  spend: number
  subscriptionValue: number
  reference: { label: string; value?: string; title: string } | null
}

function todayHero(overview: TokBookOverview): TodayHero {
  const today = localDayKey()
  const row = overview.byDay.find(entry => entry.day === today)
  const tokens = row === undefined ? 0 : totalsTokens(row.totals)
  return {
    totals: row?.totals ?? ZERO_TOTALS,
    tokens,
    spend: row?.spend ?? 0,
    subscriptionValue: row?.subscriptionValue ?? 0,
    reference: todayReference(overview, today, tokens),
  }
}

/**
 * The one line that turns today's number into a judgement. Withheld rather
 * than approximated: a ledger younger than the baseline window would average
 * missing days in as zero and make a normal day read as a spike, so a young
 * ledger shows no ratio at all.
 */
function todayReference(overview: TokBookOverview, today: string, todayTokens: number): TodayHero['reference'] {
  const byDay = new Map(overview.byDay.map(entry => [entry.day, totalsTokens(entry.totals)]))
  const noRecord = {
    label: '今天还没有记录',
    title: '本机账本今天尚未记录到任何通道计费调用。',
  }
  const young = !overview.byDay.some(entry => entry.day <= shiftDayKey(today, -BASELINE_DAYS))
  if (young) return todayTokens === 0 ? noRecord : null

  let sum = 0
  for (let back = 1; back <= BASELINE_DAYS; back++) sum += byDay.get(shiftDayKey(today, -back)) ?? 0
  const average = sum / BASELINE_DAYS
  if (average <= 0) return todayTokens === 0 ? noRecord : null

  // A zero today needs the baseline as its context; a percentage off zero
  // would be noise dressed up as a signal.
  if (todayTokens === 0) {
    return {
      label: `近${BASELINE_DAYS}天日均`,
      value: formatTokens(average),
      title: `今天还没有记录；近 ${BASELINE_DAYS} 天日均 ${formatTokens(average)} 词元。`,
    }
  }

  const percent = Math.round(Math.abs(todayTokens / average - 1) * 100)
  if (percent === 0) {
    return {
      label: `≈ 近${BASELINE_DAYS}天日均`,
      title: `今日与近 ${BASELINE_DAYS} 天日均持平（${formatTokens(average)} 词元）。`,
    }
  }
  const arrow = todayTokens > average ? '↑' : '↓'
  return {
    label: `较近${BASELINE_DAYS}天日均`,
    value: `${arrow}${percent}%`,
    title: `今日 ${formatTokens(todayTokens)} 词元，近 ${BASELINE_DAYS} 天日均 ${formatTokens(average)} 词元。`,
  }
}

/**
 * Daily total-token column chart over a continuous calendar window. The host's
 * `byDay` only carries days that have records, so the window is rebuilt here:
 * a day without records becomes a zero slot instead of disappearing, which
 * would silently compress the time axis and overstate continuity. Every column
 * carries its own value label, so reading the chart never depends on hovering.
 */
function DailyTrend({ days }: { days: readonly UsageDayRow[] }) {
  if (days.length === 0) return null
  const byDay = new Map(days.map(row => [row.day, totalsTokens(row.totals)]))
  const today = localDayKey()
  const earliest = shiftDayKey(today, -(TREND_DAYS - 1))
  const start = days[0]!.day > earliest ? days[0]!.day : earliest
  const slots: string[] = []
  for (let day = start; day <= today; day = shiftDayKey(day, 1)) slots.push(day)
  if (slots.length === 0) return null
  const values = slots.map(day => byDay.get(day) ?? 0)
  const max = Math.max(...values, 1)
  const sum = values.reduce((acc, value) => acc + value, 0)
  const active = values.filter(value => value > 0).length
  const peak = Math.max(...values)
  const peakIndex = peak > 0 ? values.indexOf(peak) : -1
  return (
    <section className="dtpl-trend">
      <h2 className="dtpl-sec-title">每日词元</h2>
      <div
        className="dtpl-bars"
        role="img"
        aria-label={`每日词元柱状图：${shortDay(slots[0]!)} 至 ${shortDay(slots[slots.length - 1]!)} 共 ${slots.length} 天，合计 ${formatTokens(sum)} 词元${peak > 0 ? `，峰值 ${shortDay(slots[peakIndex]!)} 的 ${formatTokens(peak)}` : ''}。`}
      >
        {slots.map((day, index) => {
          const tokens = values[index]!
          const isPeak = index === peakIndex
          const edge = index === 0 ? ' is-start' : index === slots.length - 1 ? ' is-end' : ''
          // The label rides the column, not the plot: its offset is the same
          // expression that sizes the fill, so the number always sits 2px above
          // its own bar (and on the baseline for a zero day, which has none).
          const columnH = tokens > 0 ? `max(2px, ${String(Math.round((tokens / max) * 100))}%)` : '0px'
          return (
            <div className="dtpl-bar" key={day} title={`${day}\n${formatTokens(tokens)}`}>
              <span
                className={`dtpl-bar-label${isPeak ? ' is-peak' : ''}${tokens === 0 ? ' is-zero' : ''}${edge}`}
                style={{ bottom: `calc(${columnH} + 2px)` }}
              >
                {formatTokens(tokens)}
              </span>
              {tokens > 0 && (
                <div
                  className={`dtpl-bar-fill${isPeak ? ' is-peak' : ''}`}
                  style={{ height: columnH }}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="dtpl-trend-axis">
        {slots.map(day => <span key={day}>{shortDay(day)}</span>)}
      </div>
      <p className="dtpl-trend-sum">
        最近 {slots.length} 天（{active} 天有记录）合计 {formatTokens(sum)} 词元
        {peak > 0 && <>，峰值 {slots[peakIndex]}（{formatTokens(peak)}）</>}。
      </p>
    </section>
  )
}

function ModelBreakdown({ byModel, totalTokens, money }: {
  byModel: readonly CostedModelRow[]
  totalTokens: number
  money: (value: number) => string
}) {
  if (byModel.length === 0) return null
  return (
    <section className="dtpl-models-sec">
      <h2 className="dtpl-sec-title">按模型</h2>
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
    </section>
  )
}

/**
 * Cumulative tokens per workspace, most recently used first. The host joins
 * every ledger row's session against the workspace registry and the session
 * headers (see `src/workspaces.ts`), so this section is a read-time projection
 * of the very ledger the totals above describe — the ¥ of a row is the same
 * amount every other surface bills, split into its two buckets.
 *
 * The 未归属 row closes the list: it holds the records no registered workspace
 * claims, which is what keeps the rows adding back up to 累计词元. It is a
 * reconciliation line, not a project, so "most recent first" does not apply.
 */
function WorkspaceBreakdown({ rows, totalTokens, money }: {
  rows: readonly WorkspaceUsageRow[]
  totalTokens: number
  money: (value: number) => string
}) {
  if (rows.length === 0) return null
  return (
    <section className="dtpl-ws-sec">
      <div className="dtpl-sec-head">
        <h2 className="dtpl-sec-title">按工作区</h2>
        <span
          className="dtpl-sec-aside"
          title="每个工作区的累计词元（全账本）。记录按会话的创建目录归属到工作区；没有工作区目录、或目录未注册为工作区的记录归入「未归属」。"
        >
          全账本累计 · 最近有操作在前
        </span>
      </div>
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
    </section>
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

export function LedgerView({ overview, onOpenPricing }: {
  overview: TokBookOverview
  onOpenPricing: (scope: PricingFocus) => void
}) {
  const money = (value: number): string => formatMoney(value)
  const empty = overview.records === 0
  const hero = todayHero(overview)
  const today = hero.totals
  const hitRate = formatHitRate(
    today.cacheReadTokens,
    today.inputTokens + today.cacheReadTokens + today.cacheWriteTokens,
  )
  // Whether cache-write is a dimension of THIS ledger at all. Decided per
  // install, not per day: the aggregate cannot tell "reported 0" from "not
  // reported" (UsageFields marks it optional, UsageTotals does not), and a
  // per-day decision would make the grid reflow whenever the channel mix
  // changes. A zero bucket therefore means "not a dimension here", not "0
  // tokens today".
  const showCacheWrite = overview.byDay.some(row => row.totals.cacheWriteTokens > 0)

  return (
    <>
      {empty ? (
        <div className="dtpl-empty">
          <UsageGlyph className="dtpl-empty-ico" />
          <p className="dtpl-empty-title">尚未记录到 token 用量</p>
          <p className="dtpl-empty-sub">本插件监听各通道回报的用量并逐条记录。产生对话后点击右下角“重新扫描”即可回填，或用过一段时间后这里会累计出数据。</p>
        </div>
      ) : (
        <>
          <div className="dtpl-hero">
            <div className="dtpl-hero-main">
              <span className="dtpl-total-k">今日词元</span>
              <span className="dtpl-total-num">{formatTokens(hero.tokens)}</span>
              {hero.reference !== null && (
                <span className="dtpl-hero-base" title={hero.reference.title}>
                  {hero.reference.label}
                  {hero.reference.value !== undefined && <> <b>{hero.reference.value}</b></>}
                </span>
              )}
              {/* One line per bucket that has something to say; when neither
                  does, a muted zero holds the row so it never silently
                  disappears. The zero never borrows the accent color: a
                  subscription-only day has no cash spend, and the meaningful
                  number beside it must not read as cash. */}
              <span className="dtpl-hero-money">
                {(hero.spend > 0 || hero.subscriptionValue === 0) && (
                  <span className={`dtpl-hero-cost${hero.spend > 0 ? '' : ' dtpl-hero-cost-zero'}`}>
                    {money(hero.spend)}<em className="dtpl-hero-cost-k">今日实际支出</em>
                  </span>
                )}
                {hero.subscriptionValue > 0 && (
                  <span className="dtpl-hero-value" title="订阅通道按官方价折算的价值——非实际扣款，不加入上方支出">
                    <b>{money(hero.subscriptionValue)}</b> 今日订阅价值
                  </span>
                )}
              </span>
            </div>
            <div className="dtpl-hero-meta">
              <span className="dtpl-meta"><b className="dtpl-meta-n">{overview.sessions}</b> 会话</span>
              <span className="dtpl-meta"><b className="dtpl-meta-n">{overview.total.requests}</b> 请求</span>
              <span className={`dtpl-meta${(overview.total.failures ?? 0) > 0 ? ' dtpl-meta-warn' : ''}`}><b className="dtpl-meta-n">{(overview.total.failures ?? 0)}</b> 失败</span>
              <span className="dtpl-meta"><b className="dtpl-meta-n">{formatTokens(overview.totalTokens)}</b> 累计词元</span>
              <span className="dtpl-meta">
                <b className="dtpl-meta-n">{money(overview.spend)}</b> 累计实际支出
                {overview.subscriptionValue > 0 && <> · <b className="dtpl-meta-n">{money(overview.subscriptionValue)}</b> 累计订阅价值</>}
              </span>
            </div>
          </div>

          {/* One window on the first screen: these tiles break the hero number
              down, so they are today's — not lifetime. */}
          <div className="dtpl-sec-head">
            <h2 className="dtpl-sec-title">今日词元构成</h2>
            {hitRate !== null && (
              <span className="dtpl-sec-aside" title="缓存读取 ÷（输入 + 缓存读取 + 缓存写入）——越高，同样的词元越便宜；部分命中不会凑整成 100%。">
                缓存命中率 {hitRate}%
              </span>
            )}
          </div>
          <div className={`dtpl-grid${showCacheWrite ? '' : ' dtpl-grid-3'}`}>
            <Stat label="输入" value={formatTokens(today.inputTokens)} />
            <Stat label="缓存读取" value={formatTokens(today.cacheReadTokens)} />
            {showCacheWrite && <Stat label="缓存写入" value={formatTokens(today.cacheWriteTokens)} />}
            <Stat label="输出" value={formatTokens(today.outputTokens)} />
          </div>

          <DailyTrend days={overview.byDay} />

          <ModelBreakdown byModel={overview.byModel} totalTokens={overview.totalTokens} money={money} />

          <WorkspaceBreakdown rows={overview.byWorkspace} totalTokens={overview.totalTokens} money={money} />

          {(overview.total.compactions ?? 0) > 0 && (
            <p className="dtpl-note">其中包含 {overview.total.compactions} 次上下文压缩 summarize 调用。</p>
          )}
          {overview.unpricedModels.length > 0 && (
            <p className="dtpl-note">
              价格未知的模型（暂按 ¥0 计，不是免费）：{overview.unpricedModels.join('、')}
              <button type="button" className="dtpl-pricing-empty-link" onClick={() => onOpenPricing('unpriced')}>去定价</button>
            </p>
          )}
        </>
      )}
    </>
  )
}

/** Placeholder blocks while the first fetch is in flight; reserves layout space. */
export function LedgerSkeleton() {
  return (
    <div className="dtpl-skeleton" aria-hidden="true">
      <div className="dtpl-sk dtpl-sk-hero" />
      <div className="dtpl-sk-grid">
        <div className="dtpl-sk dtpl-sk-tile" />
        <div className="dtpl-sk dtpl-sk-tile" />
        <div className="dtpl-sk dtpl-sk-tile" />
        <div className="dtpl-sk dtpl-sk-tile" />
      </div>
      <div className="dtpl-sk dtpl-sk-chart" />
      <div className="dtpl-sk dtpl-sk-row" />
      <div className="dtpl-sk dtpl-sk-row" />
    </div>
  )
}
