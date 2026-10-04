/**
 * 词元 tab 的图表与轮次明细：每轮两格小图（新增词元 / 缓存读取）与按轮次的步骤行。
 * 取数与装配在 `SessionTokens.tsx`，本文件只画——不进任何归属判断，也不读第二个来源。
 */

import { Fragment, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SessionStepRow, SessionUsageGroup, UsageFields, UsageTotals } from '../types.ts'
import { formatDateTime, formatMoney, formatShare, formatTokens, share } from './format.ts'

/** 账本数字一律当**不可信**的 wire 读：缺字段时这一页仍要画出来（空白不报错，也不显示 NaN）。 */
export function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** `turnOutline` 投影里本页用得到的两栏（真源见 `@deepseek-ai/dsh-session-turn-outline`）。 */
export interface TurnPreview {
  turn: number
  prompt: string
  response: string
}

/** 轮次号 → 预览文本；投影拿不到时是空表，预览整块不出。 */
export type PreviewMap = ReadonlyMap<number, TurnPreview>

/**
 * 四桶的展示顺序与名字——与浮窗总览的四个读数格逐字同一套词，两处对得上号。
 * 未缓存输入排最前：它才是「计费输入」里没被复用的那一部分。
 */
export const BUCKETS: ReadonlyArray<{ key: keyof UsageFields; label: string }> = [
  { key: 'inputTokens', label: '未缓存输入' },
  { key: 'cacheReadTokens', label: '缓存读取' },
  { key: 'cacheWriteTokens', label: '缓存写入' },
  { key: 'outputTokens', label: '输出' },
]

/** 柱高与标签锚点共用这一个函数：两处各写一份，标签就会和柱顶悄悄错开。 */
function columnHeight(value: number, max: number): string {
  return value > 0 ? `max(2px, ${String(Math.round((value / max) * 100))}%)` : '0px'
}

/** 词元构成：四桶分段条 + 四个读数格。 */
export function MixSection({ totals, totalTokens }: { totals: UsageTotals; totalTokens: number }) {
  return (
    <section aria-label="词元构成">
      <h2 className="dtpl-sec-title">词元构成</h2>
      <p className="dtpl-tok-note">计费输入 = 未缓存输入 + 缓存读取 + 缓存写入</p>
      <div
        className="dtpl-tok-mix"
        role="img"
        aria-label={`四桶构成：${BUCKETS.map((bucket) => `${bucket.label} ${formatTokens(num(totals[bucket.key]))}，占 ${formatShare(num(totals[bucket.key]), totalTokens)}`).join('；')}。`}
      >
        {BUCKETS.map((bucket) => {
          const value = num(totals[bucket.key])
          if (value <= 0) return null
          return (
            <span
              key={bucket.key}
              className="dtpl-tok-mix-seg"
              data-bucket={bucket.key}
              style={{ width: `${share(value, totalTokens)}%` }}
            />
          )
        })}
      </div>
      <div className="dtpl-grid">
        {BUCKETS.map((bucket) => (
          <div className="dtpl-stat" key={bucket.key}>
            <div className="dtpl-k">{bucket.label}</div>
            <div className="dtpl-v">
              <span>{formatTokens(num(totals[bucket.key]))}</span>
              <span className="dtpl-stat-pct">占 {formatShare(num(totals[bucket.key]), totalTokens)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** 一轮的「新增词元」：这一轮**新产生**的部分（未缓存输入 + 缓存写入 + 输出），缓存读取不进去。 */
function freshOf(group: SessionUsageGroup): number {
  return group.totals.inputTokens + group.totals.cacheWriteTokens + group.totals.outputTokens
}

/** 一格图插在 style 上的列数——React 的 CSSProperties 不收 `--*`，在这里开一个口子。 */
type SlotStyle = CSSProperties & Record<'--dtpl-slots', string>

/**
 * 每轮两格小图（small multiples）：上格新增词元、下格缓存读取，共用同一列轮次与同一条轴线。
 *
 * 为什么不是「一列里并排两根柱」——那是上一版的画法，两件事一起读错：
 * 一是**两把尺子并排**，读者会不由自主地比高度，而两根柱的量级差着几十倍；
 * 二是**柱宽跟着列一起撑开**，三轮的会话里每列近 400px 宽，柱形变成一块灰砖，读不出是柱状图。
 * 分成两格后每格只有一把尺子，柱宽有上限（见 session.ts），量级差多少由格头那两个数说。
 */
export function TurnChart({ turns }: { turns: readonly SessionUsageGroup[] }) {
  if (turns.length === 0) return null
  const fresh = turns.map(freshOf)
  const cached = turns.map((group) => group.totals.cacheReadTokens)
  const freshPeak = peakIndexOf(fresh)
  const cachePeak = peakIndexOf(cached)
  const slots: SlotStyle = { '--dtpl-slots': String(turns.length) }
  return (
    <section aria-label="每轮新增与缓存读">
      <h2 className="dtpl-sec-title">每轮新增与缓存读</h2>
      {/* 两格各自归一这件事得说出来：缓存读实测能占四桶 99%，看上去「少画了一半」的正是它。
          整会话一次缓存读都没有时不画下面那格，这句解释也跟着不出。 */}
      {cachePeak >= 0 && (
        <p className="dtpl-tok-note">两格各自归一：缓存读的量级常是新增的几十倍，同轴会把新增压成一条线。</p>
      )}
      <div className="dtpl-tok-plot" style={slots}>
        <BarPanel name="新增词元" series={fresh} turns={turns} peak={freshPeak} detail={freshDetail} />
        {cachePeak >= 0 && (
          <BarPanel name="缓存读取" series={cached} turns={turns} peak={cachePeak} detail={cacheDetail} />
        )}
        <div className="dtpl-trend-axis" aria-hidden="true">
          {turns.map((group, index) => (
            <span
              key={group.turn ?? index}
              className={index === freshPeak || index === cachePeak ? 'is-peak' : undefined}
            >
              {group.turn}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/** 最大值所在的下标；整列都是 0（或空）时是 -1——**没有峰值可指**，不是峰值在第 0 轮。 */
function peakIndexOf(series: readonly number[]): number {
  let index = -1
  let best = 0
  series.forEach((value, at) => {
    if (value > best) {
      best = value
      index = at
    }
  })
  return index
}

/**
 * 一格：格头（**图例色块** + 系列名 + 合计 + 峰值，就是这一格的纵轴刻度）与它下面那排柱。
 * 柱高按本格自己的最大值归一，所以格与格之间的柱高不可比——两格的合计与峰值都写在格头上。
 */
function BarPanel({ name, series, turns, peak, detail }: {
  name: string
  series: readonly number[]
  turns: readonly SessionUsageGroup[]
  /** 本格峰值所在的下标；-1 表示这一系列整会话都是 0。 */
  peak: number
  detail: (group: SessionUsageGroup, value: number) => string
}) {
  const max = Math.max(...series, 1)
  const sum = series.reduce((total, value) => total + value, 0)
  return (
    <div className="dtpl-tok-panel">
      <p className="dtpl-tok-panel-k">
        <span className="dtpl-tok-swatch" aria-hidden="true" />
        {name}
        <span className="dtpl-tok-panel-v">合计 {formatTokens(sum)}</span>
        <i aria-hidden="true">·</i>
        <span className="dtpl-tok-panel-v">
          {peak < 0
            ? '本会话无读数'
            : `峰值 ${formatTokens(series[peak]!)}（第 ${String(turns[peak]!.turn)} 轮）`}
        </span>
      </p>
      <div className="dtpl-bars" role="img" aria-label={panelLabel(name, turns, series, peak, sum)}>
        {turns.map((group, index) => {
          const value = series[index]!
          const isPeak = index === peak
          const height = columnHeight(value, max)
          return (
            <div
              className={`dtpl-bar${value === 0 ? ' is-zero' : ''}`}
              key={group.turn ?? index}
              title={detail(group, value)}
            >
              {value > 0 && (
                <>
                  <span
                    className={`dtpl-bar-label${isPeak ? ' is-peak' : ''}`}
                    style={{ bottom: `calc(${height} + 2px)` }}
                  >
                    {formatTokens(value)}
                  </span>
                  <div className={`dtpl-bar-fill${isPeak ? ' is-peak' : ''}`} style={{ height }} />
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 一格的无障碍名称。窄屏上柱值标签会被 CSS 收掉（只留峰值那一个），**名称里一个都不少**，
 * 所以这里逐轮列出来；轮次多了逐轮列只成噪音，那时退到合计 / 峰值两个数。
 */
function panelLabel(
  name: string,
  turns: readonly SessionUsageGroup[],
  series: readonly number[],
  peak: number,
  sum: number,
): string {
  const head = `${name}的按轮次柱状图：共 ${String(turns.length)} 轮，合计 ${formatTokens(sum)} 词元`
  if (peak < 0) return `${head}；这个会话没有读数。`
  const tail = `，峰值在第 ${String(turns[peak]!.turn)} 轮 ${formatTokens(series[peak]!)} 词元。`
  if (turns.length > 8) return `${head}${tail}`
  return `${head}；${turns.map((group, index) => `第 ${String(group.turn)} 轮 ${formatTokens(series[index]!)}`).join('、')}${tail}`
}

/** 新增那格一根柱的 hover 审计：这一轮的四个桶各自什么量，柱高吃掉了哪三个。 */
function freshDetail(group: SessionUsageGroup, fresh: number): string {
  const totals = group.totals
  return [
    `第 ${String(group.turn)} 轮 · 新增词元 ${formatTokens(fresh)}（柱高）`,
    `未缓存输入 ${formatTokens(totals.inputTokens)} · 缓存写入 ${formatTokens(totals.cacheWriteTokens)} · 输出 ${formatTokens(totals.outputTokens)}`,
    `缓存读取 ${formatTokens(totals.cacheReadTokens)}（下面那一格）`,
    `该轮四桶合计 ${formatTokens(group.tokens)} 词元 · ${String(group.rows.length)} 步`,
  ].join('\n')
}

/** 缓存那格一根柱的 hover 审计：它在计费输入里占多少——**这一格不画**新增那三个桶。 */
function cacheDetail(group: SessionUsageGroup, cached: number): string {
  const totals = group.totals
  const billedInput = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
  return [
    `第 ${String(group.turn)} 轮 · 缓存读取 ${formatTokens(cached)}（柱高）`,
    `占该轮计费输入 ${formatShare(cached, billedInput)}`,
    `新增词元 ${formatTokens(freshOf(group))}（上面那一格）`,
    `该轮四桶合计 ${formatTokens(group.tokens)} 词元 · ${String(group.rows.length)} 步`,
  ].join('\n')
}

/** 块头那几个数的形状：三轮/轮间/轮次未知共用一套读数，不各自算。 */
interface BlockTotals {
  steps: number
  tokens: number
  spend: number
  subscriptionValue: number
}

function groupTotals(group: SessionUsageGroup): BlockTotals {
  return {
    steps: group.rows.length,
    tokens: group.tokens,
    spend: group.spend,
    subscriptionValue: group.subscriptionValue,
  }
}

/** 「轮次未知」没有分组合计可用（它压根不是一轮），只能从行上加。 */
function rowsTotals(rows: readonly SessionStepRow[]): BlockTotals {
  let tokens = 0
  let spend = 0
  let subscriptionValue = 0
  for (const row of rows) {
    tokens += num(row.tokens)
    if (row.bucket === 'subscription') subscriptionValue += num(row.cost)
    else if (row.bucket !== 'unpriced') spend += num(row.cost)
  }
  return { steps: rows.length, tokens, spend, subscriptionValue }
}

/**
 * 按轮次明细：一轮一块，**默认全部收起**（几十轮的会话里，默认展开哪一块都会把下面的内容整个
 * 推下去；要看步骤自己点）。末尾的「轮间」与「轮次未知」是两块、绝不合并——一个是**知道**它
 * 不属于任何轮次，一个是**不知道**（见 docs/CONTEXT.md）。
 */
export function TurnBlocks({ turns, betweenTurns, unattributed, previews }: {
  turns: readonly SessionUsageGroup[]
  betweenTurns: SessionUsageGroup | null
  unattributed: readonly SessionStepRow[]
  previews: PreviewMap
}) {
  // 只记**被点开**的那几块：默认全收起，轮询重渲染（15s 一次）不改变用户自己翻出来的状态。
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>())
  const toggle = (key: string): void => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  return (
    <section aria-label="按轮次明细">
      <h2 className="dtpl-sec-title">按轮次明细</h2>
      <div className="dtpl-tok-turns">
        {turns.map((group) => (
          <TurnBlock
            key={turnKey(group)}
            blockKey={turnKey(group)}
            label={`第 ${String(group.turn)} 轮`}
            totals={groupTotals(group)}
            rows={group.rows}
            preview={group.turn === null ? undefined : previews.get(group.turn)}
            expanded={expanded}
            onToggle={toggle}
          />
        ))}
      </div>
      {(betweenTurns !== null || unattributed.length > 0) && (
        <div className="dtpl-tok-tail">
          {betweenTurns !== null && (
            <TurnBlock
              blockKey="betweenTurns"
              label="轮间"
              totals={groupTotals(betweenTurns)}
              rows={betweenTurns.rows}
              note="确定不属于任何轮次的计费调用（目前只有压缩 summarize）"
              expanded={expanded}
              onToggle={toggle}
            />
          )}
          {unattributed.length > 0 && (
            <TurnBlock
              blockKey="unattributed"
              label="轮次未知"
              totals={rowsTotals(unattributed)}
              rows={unattributed}
              note="没能拿到轮次/步骤的账本行：会话日志读不到，或这一行没有对应的事件"
              expanded={expanded}
              onToggle={toggle}
            />
          )}
        </div>
      )}
    </section>
  )
}

function turnKey(group: SessionUsageGroup): string {
  return `turn:${String(group.turn)}`
}

/** 一块：块头（可点，收起时仍带预览）+ 展开后的步骤行。 */
function TurnBlock({ blockKey, label, totals, rows, preview, note, expanded, onToggle }: {
  blockKey: string
  label: string
  totals: BlockTotals
  rows: readonly SessionStepRow[]
  preview?: TurnPreview
  note?: string
  expanded: ReadonlySet<string>
  onToggle: (key: string) => void
}) {
  const open = expanded.has(blockKey)
  return (
    <div className="dtpl-tok-turn">
      <button
        type="button"
        className="dtpl-tok-turn-head"
        aria-expanded={open}
        title={note}
        onClick={() => onToggle(blockKey)}
      >
        <span className="dtpl-tok-turn-k">{label}</span>
        <span className="dtpl-hero-facts">
          <span className="dtpl-hero-fact"><b>{totals.steps}</b> 步</span>
          <i aria-hidden="true">·</i>
          <span className="dtpl-hero-fact"><b>{formatTokens(totals.tokens)}</b> 词元</span>
          {(totals.spend > 0 || totals.subscriptionValue === 0) && (
            <>
              <i aria-hidden="true">·</i>
              <span className="dtpl-hero-fact"><b>{formatMoney(totals.spend)}</b> 实际支出</span>
            </>
          )}
          {totals.subscriptionValue > 0 && (
            <>
              <i aria-hidden="true">·</i>
              <span className="dtpl-hero-fact"><b>{formatMoney(totals.subscriptionValue)}</b> 订阅价值</span>
            </>
          )}
        </span>
        <span className="dtpl-tok-turn-cue" aria-hidden="true">▾</span>
        {preview !== undefined && (preview.prompt !== '' || preview.response !== '') && (
          <span className="dtpl-tok-turn-preview">
            {preview.prompt !== '' && (
              <span className="dtpl-tok-turn-ask" title={preview.prompt}>{preview.prompt}</span>
            )}
            {preview.response !== '' && (
              <span className="dtpl-tok-turn-reply" title={preview.response}>{preview.response}</span>
            )}
          </span>
        )}
      </button>
      {open && rows.length > 0 && (
        <div className="dtpl-tok-steps">
          {rows.map((row) => <StepRow key={row.requestId} row={row} />)}
        </div>
      )}
    </div>
  )
}

/** 一步一行：账本行原样（一行就是一次计费调用），它的钱与桶名跟着这一行走。 */
function StepRow({ row }: { row: SessionStepRow }) {
  const usage = row.usage
  const bucket = row.bucket === 'subscription' || row.bucket === 'unpriced' ? row.bucket : 'spend'
  const chip = chipOf(row)
  return (
    <div className="dtpl-row dtpl-tok-step" title={stepDetail(row)}>
      <div className="dtpl-tok-step-id">
        <span className="dtpl-tok-step-no">
          {row.step === undefined ? '步骤未知' : `第 ${String(row.step)} 步`}
        </span>
        <span className="dtpl-tok-step-time">{formatDateTime(num(row.time))}</span>
        <span className="dtpl-tok-step-model">{row.model === '' ? '模型未知' : row.model}</span>
        {chip !== null && <em className="dtpl-tok-chip" data-kind={chip.kind}>{chip.word}</em>}
      </div>
      <div className="dtpl-model-nums">
        <span className="dtpl-hero-facts dtpl-tok-buckets">
          {usage === undefined
            ? '用量未知'
            : BUCKETS.map((bucketOf, index) => (
              <Fragment key={bucketOf.key}>
                {index > 0 && <i aria-hidden="true">·</i>}
                <span className="dtpl-hero-fact">
                  {bucketOf.label} <b>{formatTokens(num(usage[bucketOf.key]))}</b>
                </span>
              </Fragment>
            ))}
        </span>
        <span className="dtpl-cost">
          <span className="dtpl-cost-seg">
            <span className="dtpl-cost-main">
              <span className="dtpl-sr">金额 </span>
              <b className={bucket === 'unpriced' ? 'dtpl-cost-na' : bucket === 'subscription' ? 'dtpl-sub-amt' : 'dtpl-cash-amt'}>
                {bucket === 'unpriced' ? '—' : formatMoney(num(row.cost))}
              </b>
            </span>
            <em className="dtpl-cost-k">
              {/* 价格未知的行金额格是「—」（没有读数可报），但这一行确实按 ¥0 计——所以桶名
                  自己把这句话说完。第二行压在同一个四字宽的名位里，金额各行的右缘因此不错开。 */}
              {bucket === 'unpriced' ? <>价格未知<i>按 ¥0 计</i></> : bucketWord(bucket)}
            </em>
          </span>
        </span>
      </div>
    </div>
  )
}

/** 已定价那一半的桶名（价格未知的行自己说两句，见 StepRow）。两者都是四个汉字：名位等宽，
 *  金额各行的右缘才落在同一条竖线上。 */
function bucketWord(bucket: 'spend' | 'subscription'): string {
  return bucket === 'subscription' ? '订阅价值' : '实际支出'
}

function chipOf(row: SessionStepRow): { kind: string; word: string } | null {
  if (row.kind === 'failure' || row.failureCode !== undefined) return { kind: 'failure', word: '失败' }
  if (row.kind === 'compaction') return { kind: 'compaction', word: '压缩' }
  return null
}

/** 一行步骤的 hover 审计：四桶拆分与失败码在行内放不下，留在这里。 */
function stepDetail(row: SessionStepRow): string {
  const usage = row.usage
  return [
    row.step === undefined ? '步骤未知' : `第 ${String(row.step)} 步`,
    formatDateTime(num(row.time)),
    row.model === '' ? '模型未知' : row.model,
    ...(row.provider === '' ? [] : [`通道 ${row.provider}`]),
    usage === undefined
      ? '用量未知：通道没有上报 usage，这一次调用没有词元可加'
      : BUCKETS.map((bucket) => `${bucket.label} ${formatTokens(num(usage[bucket.key]))}`).join(' · '),
    `合计 ${formatTokens(num(row.tokens))} 词元`,
    row.bucket === 'unpriced'
      ? `价格未知：这一行按 ¥0 计（价表计不了 ${row.provider === '' ? '这条通道' : row.provider} 的这个模型）`
      : `金额 ${formatMoney(num(row.cost))} ${bucketWord(row.bucket)}`,
    ...(row.failureCode === undefined ? [] : [`失败码 ${row.failureCode}`]),
  ].join('\n')
}
