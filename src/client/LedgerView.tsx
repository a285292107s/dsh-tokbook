import type { TokBookOverview, UsageDayRow, UsageTotals } from '../types.ts'
import { totalsTokens } from '../types.ts'
import { UsageGlyph } from './icons.tsx'
import {
  formatMoney, formatShare, formatTokens,
  localDayKey, share, shiftDayKey, shortDay,
} from './format.ts'

const TREND_DAYS = 14

const BASELINE_DAYS = 7

const CHART = { w: 648, h: 150, left: 40, right: 54, top: 30, bottom: 24 }

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
  const money = (value: number): string => formatMoney(value)
  return (
    <section className="dtpl-mod">
      <header className="dtpl-mod-h">
        <h2 className="dtpl-mod-t">今日 · {today.slice(5)}</h2>
        <span className="dtpl-mod-aux">{hero.totals.requests} 次请求</span>
      </header>
      <div className={`dtpl-kpis${hero.subscriptionValue > 0 ? '' : ' dtpl-kpis-2'}`}>
        <div className="dtpl-kpi">
          <div className="dtpl-kpi-k">今日词元</div>
          <div className="dtpl-kpi-v">{formatTokens(hero.tokens)}</div>
          {hero.reference !== null && (
            <div className="dtpl-kpi-sub" title={hero.reference.title}>
              {hero.reference.label}
              {hero.reference.value !== undefined && <b>{hero.reference.value}</b>}
            </div>
          )}
        </div>
        <div className="dtpl-kpi">
          <div className="dtpl-kpi-k">今日实际支出</div>
          <div className={`dtpl-kpi-v${hero.spend > 0 ? '' : ' is-zero'}`}>{money(hero.spend)}</div>
          {hero.weekSpend !== null && (
            <div className="dtpl-kpi-sub">近{BASELINE_DAYS}天 <b>{money(hero.weekSpend)}</b></div>
          )}
        </div>
        {hero.subscriptionValue > 0 && (
          <div
            className="dtpl-kpi is-sub"
            title="订阅通道的这些用量若按量付费本来要花的钱——你没有真的付它，所以它不加入今日实际支出"
          >
            <div className="dtpl-kpi-k">今日订阅价值</div>
            <div className="dtpl-kpi-v">{money(hero.subscriptionValue)}</div>
            <div className="dtpl-kpi-sub">按量等价 · 未实付</div>
          </div>
        )}
      </div>
    </section>
  )
}

function TrendModule({ days }: { days: readonly UsageDayRow[] }) {
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
  const last = slots.length - 1
  const innerW = CHART.w - CHART.left - CHART.right
  const innerH = CHART.h - CHART.top - CHART.bottom
  const points = values.map((value, index) => ({
    x: CHART.left + (slots.length === 1 ? innerW / 2 : index * (innerW / (slots.length - 1))),
    y: CHART.top + innerH * (1 - value / max),
    value,
    day: slots[index]!,
  }))
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = points.length > 1
    ? `${line} L${points[last]!.x.toFixed(1)} ${(CHART.top + innerH).toFixed(1)} L${points[0]!.x.toFixed(1)} ${(CHART.top + innerH).toFixed(1)} Z`
    : null
  const peakPoint = peakIndex >= 0 ? points[peakIndex]! : null
  return (
    <section className="dtpl-mod">
      <header className="dtpl-mod-h">
        <h2 className="dtpl-mod-t">近 {TREND_DAYS} 天趋势</h2>
        <span className="dtpl-mod-aux">
          合计 {formatTokens(sum)}
          {peak > 0 && <> · 峰值 {formatTokens(peak)}</>}
        </span>
      </header>
      <div className="dtpl-chart">
        <svg
          className="dtpl-chart-svg"
          viewBox={`0 0 ${CHART.w} ${CHART.h}`}
          role="img"
          aria-label={`近 ${TREND_DAYS} 天词元折线图：${shortDay(slots[0]!)} 至 ${shortDay(slots[last]!)} 共 ${slots.length} 天，合计 ${formatTokens(sum)} 词元${peak > 0 ? `，峰值 ${shortDay(slots[peakIndex]!)} 的 ${formatTokens(peak)}` : ''}。`}
        >
          {[1, 0.5, 0].map(t => {
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
                  {t === 0 ? '0' : formatTokens(max * t)}
                </text>
              </g>
            )
          })}
          {area !== null && <path className="dtpl-chart-area" d={area} />}
          {points.length > 1 && <path className="dtpl-chart-line" d={line} />}
          {points.map((p, i) => (
            <circle
              key={p.day}
              className={`dtpl-chart-dot${i === peakIndex ? ' is-peak' : ''}`}
              cx={p.x}
              cy={p.y}
              r={i === peakIndex || i === last ? 3.5 : 2.5}
            >
              <title>{`${shortDay(p.day)}\n${formatTokens(p.value)}`}</title>
            </circle>
          ))}
          {peakPoint !== null && (
            <g>
              <text className="dtpl-chart-num" x={peakPoint.x} y={peakPoint.y - 20} textAnchor="middle">
                {formatTokens(peak)}
              </text>
              <text className="dtpl-chart-tick is-peak" x={peakPoint.x} y={peakPoint.y - 8} textAnchor="middle">
                {shortDay(slots[peakIndex]!)} 峰值
              </text>
            </g>
          )}
          {last !== peakIndex && (
            <text className="dtpl-chart-num" x={points[last]!.x + 7} y={points[last]!.y + 3}>
              {formatTokens(values[last]!)}
            </text>
          )}
          {slots.map((day, i) => (
            <text
              key={day}
              className={`dtpl-chart-tick${i === peakIndex ? ' is-peak' : ''}${i === last ? ' is-now' : ''}`}
              x={points[i]!.x}
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

function BucketModule({ totals, tokens, showCacheWrite }: {
  totals: UsageTotals
  tokens: number
  showCacheWrite: boolean
}) {
  const cells = [
    { key: 'input', label: '未缓存输入', value: totals.inputTokens },
    { key: 'cache-read', label: '缓存读取', value: totals.cacheReadTokens },
    ...(showCacheWrite ? [{ key: 'cache-write', label: '缓存写入', value: totals.cacheWriteTokens }] : []),
    { key: 'output', label: '输出', value: totals.outputTokens },
  ]
  return (
    <section className="dtpl-mod">
      <header className="dtpl-mod-h">
        <h2 className="dtpl-mod-t">今日词元构成</h2>
      </header>
      <div className={`dtpl-buckets${showCacheWrite ? '' : ' dtpl-buckets-3'}`}>
        {cells.map(cell => {
          const percent = tokens > 0 ? Math.round(share(cell.value, tokens)) : 0
          return (
            <div className="dtpl-bucket" key={cell.key}>
              <div className="dtpl-bucket-r">
                <span className="dtpl-bucket-k">{cell.label}</span>
                <span className="dtpl-bucket-p">{formatShare(cell.value, tokens)}</span>
              </div>
              <div className="dtpl-bucket-v">{formatTokens(cell.value)}</div>
              <div className="dtpl-bucket-bar" aria-hidden="true">
                <i style={{ width: cell.value > 0 ? `max(1px, ${percent}%)` : '0' }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function LedgerView({ overview }: { overview: TokBookOverview }) {
  const hero = todayHero(overview)
  const today = localDayKey()
  const showCacheWrite = overview.byDay.some(row => row.totals.cacheWriteTokens > 0)
  if (overview.records === 0) {
    return (
      <div className="dtpl-empty">
        <UsageGlyph className="dtpl-empty-ico" />
        <p className="dtpl-empty-title">还没有记录到词元用量</p>
        <p className="dtpl-empty-sub">本插件记录本机每次模型调用的用量。先聊几句就会有数据；安装前的历史记录，点右下角「重新扫描」可以补上。</p>
      </div>
    )
  }
  return (
    <div className="dtpl-inst">
      <TodayModule hero={hero} today={today} />
      <TrendModule days={overview.byDay} />
      <BucketModule totals={hero.totals} tokens={hero.tokens} showCacheWrite={showCacheWrite} />
    </div>
  )
}

export function LedgerSkeleton() {
  return (
    <div className="dtpl-skeleton" aria-hidden="true">
      <div className="dtpl-sk dtpl-sk-mod-a" />
      <div className="dtpl-sk dtpl-sk-mod-b" />
      <div className="dtpl-sk dtpl-sk-mod-c" />
    </div>
  )
}
