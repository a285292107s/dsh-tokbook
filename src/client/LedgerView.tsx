import type { ReactNode } from 'react'

import type { TokBookOverview, UsageDayRow, UsageTotals } from '../types.ts'
import { totalsTokens } from '../types.ts'
import { UsageGlyph } from './icons.tsx'
import { RescanButton } from './RescanButton.tsx'
import {
  formatMoney, formatShare, formatTokens,
  localDayKey, share, shiftDayKey, shortDay,
} from './format.ts'

const TREND_DAYS = 14

const BASELINE_DAYS = 7

const CHART = { w: 1092, h: 246, left: 46, right: 62, top: 30, bottom: 24 }

const ZERO_TOTALS: UsageTotals = {
  requests: 0,
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
}

interface TodayHero {
  totals: UsageTotals
  tokens: number
  spend: number
  subscriptionValue: number
  weekSpend: number | null
  reference: { label: string; value?: string; title: string } | null
}

function niceMax(value: number): number {
  if (!(value > 0)) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const norm = value / power
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return step * power
}

function spendMax(value: number): number {
  if (!(value > 0)) return 0.2
  return Math.ceil(value / 0.2) * 0.2
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
    weekSpend: weekSpendOf(overview.byDay, today),
    reference: todayReference(overview, today, tokens),
  }
}

function weekSpendOf(days: readonly UsageDayRow[], today: string): number | null {
  const young = !days.some(entry => entry.day <= shiftDayKey(today, -BASELINE_DAYS))
  if (young) return null
  const byDay = new Map(days.map(entry => [entry.day, entry]))
  let sum = 0
  for (let back = 0; back < BASELINE_DAYS; back++) sum += byDay.get(shiftDayKey(today, -back))?.spend ?? 0
  return sum
}

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

  if (todayTokens === 0) {
    return {
      label: `近${BASELINE_DAYS}天日均（今天还没有记录）`,
      value: formatTokens(average),
      title: `今天还没有记录；近 ${BASELINE_DAYS} 天日均 ${formatTokens(average)} 词元。`,
    }
  }

  const percent = Math.round(Math.abs(todayTokens / average - 1) * 100)
  if (percent === 0) {
    return {
      label: `持平于近${BASELINE_DAYS}天日均`,
      value: formatTokens(average),
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

function TodayModule({ hero, today }: { hero: TodayHero; today: string }) {
  const denominator = hero.totals.inputTokens + hero.totals.cacheReadTokens
  const minor = [
    ...(hero.subscriptionValue > 0
      ? [{ key: 'sub', label: '订阅价值', value: formatMoney(hero.subscriptionValue), muted: true }]
      : []),
    {
      key: 'week',
      label: `近 ${BASELINE_DAYS} 天支出`,
      value: hero.weekSpend === null ? '—' : formatMoney(hero.weekSpend),
      muted: false,
    },
    {
      key: 'hit',
      label: '缓存命中率',
      value: denominator > 0 ? formatShare(hero.totals.cacheReadTokens, denominator) : '—',
      muted: false,
    },
  ]
  return (
    <section className="dtpl-card dtpl-span-5 dtpl-card-today">
      <header className="dtpl-mod-h">
        <h2 className="dtpl-mod-t">今日 · {today.slice(5)}</h2>
        <span className="dtpl-mod-aux">{hero.totals.requests} 次请求</span>
      </header>
      <div className="dtpl-today">
        <div className="dtpl-today-k">今日词元</div>
        <div className="dtpl-today-v">{formatTokens(hero.tokens)}</div>
        {hero.reference !== null && (
          <div className="dtpl-today-sub" title={hero.reference.title}>
            <span>{hero.reference.label}</span>
            {hero.reference.value !== undefined && <b>{hero.reference.value}</b>}
          </div>
        )}
        <div className="dtpl-today-spend">
          <div className="dtpl-today-spend-k">实际支出</div>
          <div className={`dtpl-today-spend-v${hero.spend === 0 ? ' is-muted' : ''}`}>{formatMoney(hero.spend)}</div>
        </div>
        <div className="dtpl-today-facts">
          {minor.map(fact => (
            <div className="dtpl-today-fact" key={fact.key}>
              <div className="dtpl-today-fact-k">{fact.label}</div>
              <div className={`dtpl-today-fact-v${fact.muted ? ' is-muted' : ''}`}>{fact.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TrendModule({ days }: { days: readonly UsageDayRow[] }) {
  if (days.length === 0) return null
  const byDay = new Map(days.map(row => [row.day, row]))
  const today = localDayKey()
  const earliest = shiftDayKey(today, -(TREND_DAYS - 1))
  const start = days[0]!.day > earliest ? days[0]!.day : earliest
  const slots: string[] = []
  for (let day = start; day <= today; day = shiftDayKey(day, 1)) slots.push(day)
  if (slots.length === 0) return null
  const values = slots.map(day => {
    const row = byDay.get(day)
    return row === undefined ? 0 : totalsTokens(row.totals)
  })
  const spends = slots.map(day => byDay.get(day)?.spend ?? 0)
  const peak = Math.max(...values)
  const peakIndex = peak > 0 ? values.indexOf(peak) : -1
  const total = values.reduce((acc, value) => acc + value, 0)
  const maxTokens = niceMax(peak)
  const maxSpend = spendMax(Math.max(...spends))
  const innerW = CHART.w - CHART.left - CHART.right
  const innerH = CHART.h - CHART.top - CHART.bottom
  const step = innerW / slots.length
  const barW = Math.min(30, Math.max(8, step * 0.34))
  const barX = (index: number): number => CHART.left + step * (index + 0.5)
  const tokenY = (value: number): number => CHART.top + innerH * (1 - value / maxTokens)
  const spendY = (value: number): number => CHART.top + innerH * (1 - value / maxSpend)
  const last = slots.length - 1
  const bars = slots.map((day, index) => {
    const value = values[index]!
    const x = barX(index) - barW / 2
    const top = tokenY(value)
    const height = Math.max(0, CHART.top + innerH - top)
    return (
      <rect
        key={`bar-${day}`}
        className={`dtpl-chart-bar${index === last ? ' is-today' : ''}`}
        x={x}
        y={top}
        width={barW}
        height={height}
      >
        <title>{`${shortDay(day)} 词元 ${formatTokens(value)} · 支出 ${formatMoney(spends[index] ?? 0)}`}</title>
      </rect>
    )
  })
  const points = slots.map((_, index) => ({ x: barX(index), y: spendY(spends[index] ?? 0) }))
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const ticks = [0, 0.5, 1]
  const peakX = peakIndex >= 0 ? barX(peakIndex) : 0
  const peakY = peakIndex >= 0 ? tokenY(values[peakIndex]!) : 0
  const peakAnchor = peakX < CHART.left + 70 ? 'start' : peakX > CHART.w - CHART.right - 70 ? 'end' : 'middle'
  const peakLabelX = peakAnchor === 'start' ? peakX + 24 : peakAnchor === 'end' ? peakX - 24 : peakX
  const showTodayLabel = peakIndex !== last && values[last]! > 0
  return (
    <section className="dtpl-card dtpl-span-7">
      <header className="dtpl-mod-h">
        <h2 className="dtpl-mod-t">近 {TREND_DAYS} 天 · 每日词元与支出</h2>
        <span className="dtpl-mod-aux">
          合计 {formatTokens(total)}
          {peak > 0 && <> · 峰值 {formatTokens(peak)}</>}
        </span>
      </header>
      <div className="dtpl-chart">
        <div className="dtpl-chart-key" aria-hidden="true">
          <span><i className="dtpl-key-bar" />每日词元（左轴）</span>
          <span><i className="dtpl-key-today" />今天</span>
          <span><i className="dtpl-key-line" />每日支出（右轴）</span>
        </div>
        <svg
          className="dtpl-chart-svg"
          viewBox={`0 0 ${CHART.w} ${CHART.h}`}
          role="img"
          aria-label={`近 ${TREND_DAYS} 天每日词元与支出：${shortDay(slots[0]!)} 至 ${shortDay(slots[last]!)} 共 ${slots.length} 天，合计 ${formatTokens(total)} 词元${peak > 0 ? `，峰值 ${shortDay(slots[peakIndex]!)} 的 ${formatTokens(peak)}` : ''}。`}
        >
          {ticks.map(t => {
            const gy = CHART.top + innerH * (1 - t)
            return (
              <g key={t}>
                <line
                  className={t === 0 ? 'dtpl-chart-base' : 'dtpl-chart-grid'}
                  x1={CHART.left}
                  x2={CHART.w - CHART.right}
                  y1={gy}
                  y2={gy}
                />
                <text className="dtpl-chart-tick" x={CHART.left - 6} y={gy + 3} textAnchor="end">
                  {t === 0 ? '0' : formatTokens(maxTokens * t)}
                </text>
                <text className="dtpl-chart-tick is-money" x={CHART.w - CHART.right + 6} y={gy + 3}>
                  {t === 0 ? formatMoney(0) : formatMoney(maxSpend * t)}
                </text>
              </g>
            )
          })}
          {bars}
          {points.length > 1 && <path className="dtpl-chart-line" d={line} />}
          {points.map((point, index) => (
            <circle
              key={`dot-${slots[index]}`}
              className={`dtpl-chart-dot${index === last ? ' is-today' : ''}${index === peakIndex ? ' is-peak' : ''}`}
              cx={point.x}
              cy={point.y}
              r={index === last || index === peakIndex ? 3.5 : 2.5}
            />
          ))}
          {peakIndex >= 0 && (
            <g>
              <text className="dtpl-chart-num" x={peakLabelX} y={peakY - 22} textAnchor={peakAnchor}>
                {formatTokens(values[peakIndex]!)}
              </text>
              <text className="dtpl-chart-tick is-peak" x={peakLabelX} y={peakY - 10} textAnchor={peakAnchor}>
                {peakIndex === last ? '今天峰值' : `${shortDay(slots[peakIndex]!)} 峰值`}
              </text>
            </g>
          )}
          {showTodayLabel && (
            <text className="dtpl-chart-num" x={CHART.w - CHART.right - 4} y={CHART.top + 12} textAnchor="end">
              今天 {formatTokens(values[last]!)}
            </text>
          )}
          {slots.map((day, index) => (
            <text
              key={`tick-${day}`}
              className={`dtpl-chart-tick${index === peakIndex ? ' is-peak' : ''}${index === last ? ' is-now' : ''}`}
              x={barX(index)}
              y={CHART.h - 6}
              textAnchor="middle"
            >
              {shortDay(day)}
            </text>
          ))}
        </svg>
      </div>
    </section>
  )
}

interface MixCell {
  key: string
  label: string
  value: number
}

function mixCells(totals: UsageTotals, showCacheWrite: boolean): MixCell[] {
  return [
    { key: 'input', label: '未缓存输入', value: totals.inputTokens },
    { key: 'cache-read', label: '缓存读取', value: totals.cacheReadTokens },
    ...(showCacheWrite ? [{ key: 'cache-write', label: '缓存写入', value: totals.cacheWriteTokens }] : []),
    { key: 'output', label: '输出', value: totals.outputTokens },
  ]
}

function MixBar({ cells, total, slim }: { cells: readonly MixCell[]; total: number; slim?: boolean }) {
  return (
    <div className={`dtpl-mix${slim === true ? ' is-slim' : ''}`}>
      {cells.map(cell => (
        <i
          key={cell.key}
          className="dtpl-mix-seg"
          data-k={cell.key}
          style={{ width: `${share(cell.value, total)}%` }}
        />
      ))}
    </div>
  )
}

function windowTotals(days: readonly UsageDayRow[]): UsageTotals {
  const earliest = shiftDayKey(localDayKey(), -(TREND_DAYS - 1))
  const totals: UsageTotals = { ...ZERO_TOTALS }
  for (const row of days) {
    if (row.day < earliest) continue
    totals.requests += row.totals.requests
    totals.inputTokens += row.totals.inputTokens
    totals.cacheReadTokens += row.totals.cacheReadTokens
    totals.cacheWriteTokens += row.totals.cacheWriteTokens
    totals.outputTokens += row.totals.outputTokens
  }
  return totals
}

function BucketModule({ totals, tokens, days, showCacheWrite }: {
  totals: UsageTotals
  tokens: number
  days: readonly UsageDayRow[]
  showCacheWrite: boolean
}) {
  const cells = mixCells(totals, showCacheWrite)
  const recent = windowTotals(days)
  const recentTokens = totalsTokens(recent)
  const recentCells = mixCells(recent, recent.cacheWriteTokens > 0)
  const denominator = totals.inputTokens + totals.cacheReadTokens
  return (
    <section className="dtpl-card dtpl-span-5">
      <header className="dtpl-mod-h">
        <h2 className="dtpl-mod-t">今日词元构成</h2>
        <span className="dtpl-mod-aux">{formatTokens(tokens)} · {totals.requests} 次请求</span>
      </header>
      <div className="dtpl-comp">
        <MixBar cells={cells} total={tokens} />
        <div className="dtpl-mix-rows">
          {cells.map(cell => (
            <div className="dtpl-mix-row" key={cell.key}>
              <i className={`dtpl-mix-key${cell.value > 0 ? '' : ' is-empty'}`} data-k={cell.key} />
              <span className="dtpl-mix-k">{cell.label}</span>
              <span className="dtpl-mix-v">{formatTokens(cell.value)}</span>
              <span className="dtpl-mix-p">{formatShare(cell.value, tokens)}</span>
            </div>
          ))}
        </div>
        <div className="dtpl-comp-14">
          <div className="dtpl-comp-14-h">
            <span>近 {TREND_DAYS} 天累计</span>
            <b>{formatTokens(recentTokens)}</b>
          </div>
          <MixBar cells={recentCells} total={recentTokens} slim />
          <div className="dtpl-comp-14-l">
            {recentCells.map(cell => (
              <span key={cell.key}>{cell.label} <b>{formatTokens(cell.value)}</b> {formatShare(cell.value, recentTokens)}</span>
            ))}
          </div>
        </div>
        <div className="dtpl-comp-hit">
          <div>
            <div className="dtpl-comp-hit-k">缓存命中率</div>
            <div className="dtpl-comp-hit-v">{denominator > 0 ? formatShare(totals.cacheReadTokens, denominator) : '—'}</div>
          </div>
          <div className="dtpl-comp-hit-aside">
            缓存读 <b>{formatTokens(totals.cacheReadTokens)}</b> / 计费输入 <b>{formatTokens(denominator)}</b>
          </div>
        </div>
        <div className="dtpl-comp-facts">
          <div className="dtpl-comp-fact"><div className="dtpl-comp-fact-k">请求</div><div className="dtpl-comp-fact-v">{totals.requests}</div></div>
          <div className="dtpl-comp-fact"><div className="dtpl-comp-fact-k">失败</div><div className={`dtpl-comp-fact-v${totals.failures ? '' : ' is-muted'}`}>{totals.failures ?? 0}</div></div>
          <div className="dtpl-comp-fact"><div className="dtpl-comp-fact-k">压缩</div><div className={`dtpl-comp-fact-v${totals.compactions ? '' : ' is-muted'}`}>{totals.compactions ?? 0}</div></div>
          <div className="dtpl-comp-fact"><div className="dtpl-comp-fact-k">用量未知</div><div className={`dtpl-comp-fact-v${totals.usageUnknown ? '' : ' is-muted'}`}>{totals.usageUnknown ?? 0}</div></div>
        </div>
      </div>
    </section>
  )
}

export function LedgerView({ overview, busy, retry, onRescan, quota }: {
  overview: TokBookOverview
  busy: boolean
  retry: boolean
  onRescan: () => void
  quota: ReactNode
}) {
  const hero = todayHero(overview)
  const today = localDayKey()
  const showCacheWrite = overview.byDay.some(row => row.totals.cacheWriteTokens > 0)
  if (overview.records === 0) {
    return (
      <div className="dtpl-empty dtpl-span-12">
        <UsageGlyph className="dtpl-empty-ico" />
        <p className="dtpl-empty-title">还没有记录到词元用量</p>
        <p className="dtpl-empty-sub">本插件记录本机每次模型调用的用量。先聊几句就会有数据；安装前的历史记录可以扫回来。</p>
        <div className="dtpl-empty-act">
          <RescanButton busy={busy} retry={retry} onRescan={onRescan} />
        </div>
      </div>
    )
  }
  return (
    <>
      <TodayModule hero={hero} today={today} />
      {quota}
      <TrendModule days={overview.byDay} />
      <BucketModule totals={hero.totals} tokens={hero.tokens} days={overview.byDay} showCacheWrite={showCacheWrite} />
    </>
  )
}

export function LedgerSkeleton() {
  return (
    <>
      <div className="dtpl-sk dtpl-sk-today dtpl-span-5" />
      <div className="dtpl-sk dtpl-sk-quota dtpl-span-7" />
      <div className="dtpl-sk dtpl-sk-trend dtpl-span-7" />
      <div className="dtpl-sk dtpl-sk-comp dtpl-span-5" />
      <div className="dtpl-sk dtpl-sk-detail dtpl-span-12" />
    </>
  )
}
