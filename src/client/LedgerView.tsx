import type { CSSProperties } from 'react'
import type { TokBookOverview, UsageDayRow, UsageTotals } from '../types.ts'
import { totalsTokens } from '../types.ts'
import { UsageGlyph } from './icons.tsx'
import {
  formatMoney, formatRatio, formatTokens,
  localDayKey, shiftDayKey, shortDay,
} from './format.ts'

const TREND_DAYS = 14

const BASELINE_DAYS = 7

const ZERO_TOTALS: UsageTotals = {
  requests: 0,
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
}

function Stat({ label, value, share }: {
  label: string
  value: string
  share: number
}) {
  const percent = share > 0 ? formatRatio(share, 100) : null
  return (
    <div className="dtpl-stat">
      <div className="dtpl-k">{label}</div>
      <div className="dtpl-v">
        <span>{value}</span>
        {percent !== null && (
          <span className="dtpl-stat-pct" title={`占今日词元（四桶之和）的 ${percent}%`}>
            占 {percent}%
          </span>
        )}
      </div>
    </div>
  )
}

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

function columnHeight(tokens: number, max: number): string {
  return tokens > 0 ? `max(2px, ${String(Math.round((tokens / max) * 100))}%)` : '0px'
}

function TrendPlot({ slots, values, peak, peakIndex, max, sum }: {
  slots: readonly string[]
  values: readonly number[]
  peak: number
  peakIndex: number
  max: number
  sum: number
}) {
  return (
    <div
      className="dtpl-bars is-anim"
      role="img"
      aria-label={`近 ${String(TREND_DAYS)} 天词元柱状图：${shortDay(slots[0]!)} 至 ${shortDay(slots[slots.length - 1]!)} 共 ${String(slots.length)} 天，合计 ${formatTokens(sum)} 词元${peak > 0 ? `，峰值 ${shortDay(slots[peakIndex]!)} 的 ${formatTokens(peak)}` : ''}。`}
    >
      {values.map((tokens, index) => {
        const isPeak = index === peakIndex
        const columnH = columnHeight(tokens, max)
        return (
          <div
            className={`dtpl-bar${tokens === 0 ? ' is-zero' : ''}`}
            key={slots[index]!}
            title={`${slots[index]!}\n${formatTokens(tokens)}`}
            style={{ '--dtpl-i': index } as CSSProperties}
          >
            <span
              className={`dtpl-bar-label${isPeak ? ' is-peak' : ''}${tokens === 0 ? ' is-zero' : ''}`}
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
  )
}

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
  const peak = Math.max(...values)
  const peakIndex = peak > 0 ? values.indexOf(peak) : -1
  return (
    <section className="dtpl-trend">
      <h2 className="dtpl-sec-title">近 {TREND_DAYS} 天趋势</h2>
      <TrendPlot
        slots={slots}
        values={values}
        peak={peak}
        peakIndex={peakIndex}
        max={max}
        sum={sum}
      />
      <div className="dtpl-trend-axis">
        {slots.map((day, index) => (
          <span key={day} className={index === peakIndex ? 'is-peak' : undefined}>
            {shortDay(day)}
          </span>
        ))}
      </div>
    </section>
  )
}

export function LedgerView({ overview }: { overview: TokBookOverview }) {
  const money = (value: number): string => formatMoney(value)
  const empty = overview.records === 0
  const hero = todayHero(overview)
  const today = hero.totals
  const share = (bucket: number): number => (hero.tokens > 0 ? (bucket / hero.tokens) * 100 : 0)
  const showCacheWrite = overview.byDay.some(row => row.totals.cacheWriteTokens > 0)
  return (
    <>
      {empty ? (
        <div className="dtpl-empty">
          <UsageGlyph className="dtpl-empty-ico" />
          <p className="dtpl-empty-title">还没有记录到词元用量</p>
          <p className="dtpl-empty-sub">本插件记录本机每次模型调用的用量。先聊几句就会有数据；安装前的历史记录，点右下角「重新扫描」可以补上。</p>
        </div>
      ) : (
        <>
          <div className="dtpl-hero">
            <div className="dtpl-hero-art" aria-hidden="true" />
            <div className="dtpl-hero-top">
              <div className="dtpl-hero-lead">
                <span className="dtpl-hero-head">
                  <span className="dtpl-total-k">今日词元</span>
                </span>
                <span className="dtpl-hero-figure">
                  <span className="dtpl-total-num">{formatTokens(hero.tokens)}</span>
                  {hero.reference !== null && (
                    <span className="dtpl-hero-delta" title={hero.reference.title}>
                      {hero.reference.value !== undefined && <><b>{hero.reference.value}</b>{' '}</>}
                      {hero.reference.label}
                    </span>
                  )}
                </span>
              </div>
              <div className="dtpl-hero-money">
                {(hero.spend > 0 || hero.subscriptionValue === 0) && (
                  <span className="dtpl-hero-money-row">
                    <span className="dtpl-hero-money-k">今日实际支出</span>
                    <b className={`dtpl-hero-money-v${hero.spend > 0 ? ' is-cash' : ' is-zero'}`}>{money(hero.spend)}</b>
                  </span>
                )}
                {hero.subscriptionValue > 0 && (
                  <span className="dtpl-hero-money-row" title="订阅通道的这些用量若按量付费本来要花的钱——你没有真的付它，所以它不加入今日实际支出">
                    <span className="dtpl-hero-money-k">今日订阅价值</span>
                    <b className="dtpl-hero-money-v">{money(hero.subscriptionValue)}</b>
                  </span>
                )}
              </div>
            </div>
            <div className={`dtpl-grid${showCacheWrite ? '' : ' dtpl-grid-3'}`}>
              <Stat label="未缓存输入" value={formatTokens(today.inputTokens)} share={share(today.inputTokens)} />
              <Stat label="缓存读取" value={formatTokens(today.cacheReadTokens)} share={share(today.cacheReadTokens)} />
              {showCacheWrite && <Stat label="缓存写入" value={formatTokens(today.cacheWriteTokens)} share={share(today.cacheWriteTokens)} />}
              <Stat label="输出" value={formatTokens(today.outputTokens)} share={share(today.outputTokens)} />
            </div>
          </div>

          <DailyTrend days={overview.byDay} />
        </>
      )}
    </>
  )
}

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
