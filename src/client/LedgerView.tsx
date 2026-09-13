/**
 * 用量总览 tab 内容：今日 hero、四桶构成、每日趋势，以及按模型 / 按工作区的拆分切换（拆分体在 `Breakdowns.tsx`）。
 *
 * @module dsh-tokbook/client/LedgerView
 */

import type { TokBookOverview, UsageDayRow, UsageTotals } from '../types.ts'
import { totalsTokens } from '../types.ts'
import type { PricingFocus } from './contract.ts'
import { UsageGlyph } from './icons.tsx'
import { Breakdowns } from './Breakdowns.tsx'
import {
  formatHitRate, formatMoney, formatTokens,
  localDayKey, shiftDayKey, shortDay,
} from './format.ts'

/** 趋势窗口天数；窗口不早于首条记录。 */
const TREND_DAYS = 14

/** 与今天对比的完整天数。排除今天本身，避免忙碌的一天拉高自己的基线。 */
const BASELINE_DAYS = 7

/** 今天有账本行时用它；否则用零行。 */
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

/** hero 和桶瓦片所需的一切，都在今天这一个窗口内。 */
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
 * 把今日数字变成判断的那一行。宁可不给也不近似：账本短于基线窗口时，平均会把缺失的天当作零拉进来，让正常的一天看起来像尖峰。
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
 * 连续日历窗口内的每日词元柱状图。宿主的 `byDay` 只带有点记录的天，故窗口在此重建：无记录的天变成零柱而不是消失——否则时间轴会被悄悄压缩。每根柱自带数值标签，读图不依赖 hover。
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
          // 标签骑在柱上而非图区上：偏移量与填充高度同表达式，数字永远停在自己的柱上方 2px。
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
  // 缓存写入是否是本账本的维度。按安装决定而非按天：聚合无法区分「上报了 0」与「未上报」，按天决定会让通道组合变化时网格 reflow。零桶因此表示「本安装不关心这一维」。
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
              {/* 有话可说的桶各占一行；两者都无话时用一个灰色零撑住行。零从不借强调色：纯订阅日没有现金支出。 */}
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
              {/* 只在有这类调用时占行：它限定的是下面那个「累计词元」数字——那几次调用的用量未知，所以累计值比实际略少。 */}
              {(overview.total.usageUnknown ?? 0) > 0 && (
                <span
                  className="dtpl-meta dtpl-meta-warn"
                  title={`${String(overview.total.usageUnknown)} 次计费调用没有拿到通道上报的用量（多为中途取消的请求）：计入请求次数，但没有词元可加——是「未知」，不是 0。所以「累计词元」比实际略少。原因见「统计口径」。`}
                >
                  <b className="dtpl-meta-n">{overview.total.usageUnknown}</b> 用量未知
                </span>
              )}
              <span className="dtpl-meta"><b className="dtpl-meta-n">{formatTokens(overview.totalTokens)}</b> 累计词元</span>
              <span className="dtpl-meta">
                <b className="dtpl-meta-n">{money(overview.spend)}</b> 累计实际支出
                {overview.subscriptionValue > 0 && <> · <b className="dtpl-meta-n">{money(overview.subscriptionValue)}</b> 累计订阅价值</>}
              </span>
            </div>
          </div>

          {/* 首屏只有一个窗口：这些瓦片拆解的是 hero 数字，所以是今天的——不是累计的。 */}
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

          <Breakdowns
            byModel={overview.byModel}
            byWorkspace={overview.byWorkspace}
            totalTokens={overview.totalTokens}
            money={money}
          />

          {(overview.total.compactions ?? 0) > 0 && (
            <p className="dtpl-note">其中包含 {overview.total.compactions} 次上下文压缩 summarize 调用。</p>
          )}
          {overview.unpricedModels.length > 0 && (
            <p className="dtpl-note">
              价格未知的模型（暂按 ¥0 计，不是免费）：{overview.unpricedModels.join('、')}
              <button type="button" className="dtpl-pricing-empty-link" onClick={() => onOpenPricing('unpriced')}>去定价</button>
            </p>
          )}
          {/* 金额侧的同一个口径问题：用量未知的调用无从计价，所以它们按 ¥0 进入支出——
              与「价格未知」同形地说明，而不是让那个 0 冒充真实花费。 */}
          {(overview.total.usageUnknown ?? 0) > 0 && (
            <p className="dtpl-note">
              其中 {overview.total.usageUnknown} 次调用用量未知（通道没上报）：只计次数、不计词元，
              金额也按 ¥0 计——是「不知道」，不是免费。
            </p>
          )}
        </>
      )}
    </>
  )
}

/** 首次拉取进行中的占位块；预留布局空间。 */
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
