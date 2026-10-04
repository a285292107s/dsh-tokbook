/**
 * 用量总览 tab 内容：今日仪表卡 + 近 14 天趋势。本页只陈述今天与近 14 天——**累计事实不在
 * 这里**，去处是用量明细的「全部」窗口（`ProviderPanel`）。卡的构成与排版理由在 ledger 片段。
 */

import type { CSSProperties } from 'react'
import type { TokBookOverview, UsageDayRow, UsageTotals } from '../types.ts'
import { totalsTokens } from '../types.ts'
import { UsageGlyph } from './icons.tsx'
import {
  formatMoney, formatRatio, formatTokens,
  localDayKey, shiftDayKey, shortDay,
} from './format.ts'

/** 趋势窗口天数。 */
const TREND_DAYS = 14

/** 与今天对比的完整天数。排除今天本身，避免忙碌的一天拉高自己的基线。 */
const BASELINE_DAYS = 7

/** 今天有账本行时用它。 */
const ZERO_TOTALS: UsageTotals = {
  requests: 0,
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
}

/**
 * 一格读数：标签 + 值 + **份额**，分母是今日四桶之和（与「今日词元」同源）。
 * 比率走 `formatRatio`（恒定一位小数、向下截断）：0.1% 而不是「0%」，量到的零永远不出现。
 */
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

/**
 * 把今日数字变成判断的那一行。账本短于基线窗口时不给参照：平均会把缺失的天当作零拉进来，
 * 让正常的一天看起来像尖峰。
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

  // 零天需要基线做上下文；从零算出的百分比只是噪音披上了信号的外衣。
  // 「今天还没记录」写进标签而不是只写进 title：这一行的三个状态都要在原地读得懂，
  // 否则读者要么悬停，要么把基线数字当成今天的数字。
  if (todayTokens === 0) {
    return {
      label: `近${BASELINE_DAYS}天日均（今天还没有记录）`,
      value: formatTokens(average),
      title: `今天还没有记录；近 ${BASELINE_DAYS} 天日均 ${formatTokens(average)} 词元。`,
    }
  }

  const percent = Math.round(Math.abs(todayTokens / average - 1) * 100)
  // 持平这一档也要给出数字：它正是读者此刻最想知道的「平均水平是多少」。
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

/**
 * 一根柱的填充高度表达式。柱高与标签锚点**共用这一个函数**：两处若各写一份，标签就会和柱顶
 * 悄悄错开。
 */
function columnHeight(tokens: number, max: number): string {
  return tokens > 0 ? `max(2px, ${String(Math.round((tokens / max) * 100))}%)` : '0px'
}

/**
 * 图区本体。`is-anim` 静态挂着：错峰入场动画只在元素重挂时播一次，而数据刷新不重挂柱子，
 * CSS 动画不因重渲染重播——所以不需要「播完摘类」的监听。错峰步长由每根柱的 `--dtpl-i` 给出
 * （见 shared 片段的动效段）。
 */
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
        // 这一类必须挂在**柱**上：柱脚的零刻度（`::after`）与「零日撤标签」都由 `.dtpl-bar.is-zero`
        // 选中，只挂在标签上这两条规则都是死的。峰值的样式分挂标签与填充，不挂柱。
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

/**
 * 连续日历窗口内按日的词元柱状图（图区本体在 `TrendPlot`）。宿主的 `byDay` 只带有点记录的
 * 天，故窗口在此重建：无记录的天变成零柱而不是消失——否则时间轴会被悄悄压缩。
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
          // 峰值的日期永远留下（窄屏收偶数格的规则见 `shared`，它豁免 `.is-peak`）。
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
  // 缓存写入是否是本账本的维度。按安装决定而非按天：聚合无法区分「上报了 0」与「未上报」，按天决定会让通道组合变化时网格 reflow。零桶因此表示「本安装不关心这一维」。
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
                {/* 派生比值不挂在口径词那一行上：读者还得回头找它的分母。 */}
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
              {/* 零从不借强调色：纯订阅日没有现金支出。 */}
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
              {/* 「输入」不是「我发过去的全部文字」，而是其中**没命中缓存**的那部分；
                  标签必须自己说清这一点，否则这一格会把一次很长的对话读成很短。 */}
              <Stat label="未命中输入" value={formatTokens(today.inputTokens)} share={share(today.inputTokens)} />
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

/** 首次拉取进行中的占位块；与真块同高（耦合见 styles/ledger.ts 骨架段）。 */
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
