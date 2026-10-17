/**
 * 会话词元页的**明细表**：按轮次的步骤行（默认全部收起），外加末尾那两块（轮间 / 轮次未知）。
 *
 * 单独成文件是因为它是一块**自包含的交互**（折叠状态的本地记忆、整节唯一分母的算式、用时表
 * 列集合的取法），而它要复用的**设计语言**——尺（TimeBar）、分段（stepSegments / sumSegments）、
 * 图例形状（LEGEND_SHAPE）——在 `session-timing`；它要的常量与类型
 * （BUCKETS / TurnPreview / PreviewMap）在 `session-shared`；它要的数字工具（num）在
 * `session-wire`。混在一个文件里，折叠逻辑与柱状图的悬停定位会互相牵制。
 */

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { settleTiming } from '../types.ts'
import type { SessionStepRow, SessionUsageGroup, StepTiming } from '../types.ts'
import { formatDateTime, formatDuration, formatMoney, formatTokens } from './format.ts'
import { num } from './session-wire.ts'
import { BUCKETS, hasPricedRow, type PreviewMap, type TurnPreview } from './session-shared.ts'
import {
  LEGEND_SHAPE, PHASE_LABEL, TimeBar, TimeReads, stepSegments, sumSegments, type TimeBarRead,
} from './session-timing.tsx'

/** 块头那几个数的形状：三轮/轮间/轮次未知共用一套读数，不各自算。 */
interface BlockTotals {
  steps: number
  tokens: number
  spend: number
  subscriptionValue: number
  /** 这一块里有没有一行**走到过计价路径**（见 `hasPricedRow`）。整块价格未知时为 false：
   *  那块的 `spend` 是未知的 ¥0，块头不许把它印成「¥0.00 实际支出」。 */
  priced: boolean
  /** 这一块的引擎工作总时长 = 各步模型用时 + 工具用时。**块头这个数就是展开后各步那些数
   *  的和**，不是另算一个 turn/start→turn/end 的墙钟——那样两个数会在读者眼皮底下对不上。
   *  一块里**一步都没计时**时为 undefined（不是 0）：那块的用时是「量不到」，不是「没花时间」。 */
  workMs?: number
}

function groupTotals(group: SessionUsageGroup): BlockTotals {
  return {
    steps: group.rows.length,
    tokens: group.tokens,
    spend: group.spend,
    subscriptionValue: group.subscriptionValue,
    priced: hasPricedRow(group.rows),
    ...timedTotal(group.rows),
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
  return { steps: rows.length, tokens, spend, subscriptionValue, priced: hasPricedRow(rows), ...timedTotal(rows) }
}

/** 这一块的引擎工作（`settleTiming` 是唯一的加法）。一步都没计时时不报这个数——「用时 0秒」
 *  会把「量不到」印成「没花时间」（同「用量未知 ≠ 0」，见 docs/CONTRACTS.md §2）。 */
function timedTotal(rows: readonly SessionStepRow[]): { workMs?: number } {
  if (!rows.some((row) => row.timing !== undefined)) return {}
  const shape = settleTiming(rows)
  return { workMs: shape.llmMs + shape.toolMs }
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
  // 块头那条尺的共同分母：所有轮里最重的那个。轮与轮之间比的是「哪一轮更重」，所以分母要
  // 跨轮一致——各轮各自归一的话，每一轮看上去都一样重。
  const turnScale = Math.max(1, ...[...turns, ...(betweenTurns === null ? [] : [betweenTurns])]
    .map((group) => groupTotals(group).workMs ?? 0))
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
      {/* 三段尺的**图例**。它画的是一条**真的示例尺**——直接复用 `TimeBar`，所以灰阶与段间
          断开不可能与真尺脱节。三枚标签对齐在各自那一段下面，顺序 / 明度 / 纹路 / 断开四件事
          一次说完。孤立的三枚小方块做不到这件事：读过真尺之后，读者不会知道那三块灰的先后与归属。
          「模型（拆不开）」单列一行、带交叉网格：它**不是第四种相位**，是「相位分不出来」。它与
          「生成」同明度，不给记号就会被读成「生成」。 */}
      <div className="dtpl-tok-note dtpl-tok-legend">
        <span className="dtpl-tok-legend-figure">
          <TimeBar
            tone="step"
            segments={LEGEND_SHAPE.map((phase) => ({ key: phase.kind, value: phase.share, kind: phase.kind }))}
          />
          <span className="dtpl-tok-legend-keys">
            {LEGEND_SHAPE.map((phase) => (
              <span key={phase.kind} style={{ flexGrow: phase.share }}>{phase.label}</span>
            ))}
          </span>
        </span>
        <span className="dtpl-tok-legend-model">
          <span className="dtpl-tok-legend-key" data-kind="model" aria-hidden="true" />
          模型（拆不开）：通道没上报流，等与生成分不清
        </span>
        <span className="dtpl-tok-legend-say">步骤尺铺满整行；只有轮块头那条的长度说量级</span>      </div>
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
            turnScale={turnScale}
          />
        ))}
      </div>
      {(betweenTurns !== null || unattributed.length > 0) && (
        <div className="dtpl-tok-tail">
          {betweenTurns !== null && (
            <TurnBlock
              blockKey="betweenTurns"
              label="轮间"
              loose
              totals={groupTotals(betweenTurns)}
              rows={betweenTurns.rows}
              note="确定不属于任何轮次的计费调用（目前只有压缩 summarize）"
              expanded={expanded}
              onToggle={toggle}
              turnScale={turnScale}
            />
          )}
          {unattributed.length > 0 && (
            <TurnBlock
              blockKey="unattributed"
              label="轮次未知"
              loose
              totals={rowsTotals(unattributed)}
              rows={unattributed}
              note="没能拿到轮次/步骤的账本行：会话日志读不到，或这一行没有对应的事件"
              expanded={expanded}
              onToggle={toggle}
              turnScale={turnScale}
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
function TurnBlock({ blockKey, label, totals, rows, preview, note, loose, expanded, onToggle, turnScale }: {
  blockKey: string
  label: string
  totals: BlockTotals
  rows: readonly SessionStepRow[]
  preview?: TurnPreview
  note?: string
  /** 末尾那两块（轮间 / 轮次未知）不是「一轮」：它们与编号轮次并排时会被读成第 13、14 轮。
      这个标记把它们从轮次序列里摘出来——块身与块头一起降一档（见 session.ts 的 .is-loose）。 */
  loose?: boolean
  expanded: ReadonlySet<string>
  onToggle: (key: string) => void
  /** 整节**唯一**的分母（所有轮里最重的那一轮）。块头与步骤尺共用它，见 scale 的注释。 */
  turnScale: number
}) {
  const open = expanded.has(blockKey)
  // 用时表有哪些列，由**整块**决定（见 TIMING_METRICS）。
  const columns = timingColumnsOf(rows)
  // 块头那条尺与它下面那串读数共用这一份分段：形状与数字同源，改一处两处一起动。
  const phases = sumSegments(rows)
  const phaseReads: TimeBarRead[] = phases.map((phase) => ({
    key: phase.key,
    kind: phase.kind,
    label: PHASE_LABEL[phase.kind],
    value: formatDuration(phase.value),
  }))
  return (
    <div className={`dtpl-tok-turn${loose === true ? ' is-loose' : ''}`}>
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
          {/* 「用时」是这一块各步模型 + 工具的和。收起时它是唯一能让异常轮浮出来的读数：
              一轮二十步里卡了十分钟的那一步，只有这个数会替你把它指出来。一块里一步都没
              量到时干脆不出这一项——见 timedTotal。 */}
          {totals.workMs !== undefined && (
            <>
              <i aria-hidden="true">·</i>
              <span className="dtpl-hero-fact">用时 <b>{formatDuration(totals.workMs)}</b></span>
            </>
          )}
          {/* 整块价格未知时**不报这个数**：那一块的 ¥0 是占位不是读数，印成「¥0.00 实际支出」
              就是替价表宣称「这些调用不要钱」——而契约说的是 ¥0 = 未知（docs/CONTRACTS.md §2）。
              改报「价格未知」，与展开后每一行那个桶名逐字一致。 */}
          {totals.priced
            ? (totals.spend > 0 || totals.subscriptionValue === 0) && (
              <>
                <i aria-hidden="true">·</i>
                <span className="dtpl-hero-fact"><b>{formatMoney(totals.spend)}</b> 实际支出</span>
              </>
            )
            : (
              <>
                <i aria-hidden="true">·</i>
                <span className="dtpl-hero-fact">价格未知</span>
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
        {/* 收起时这一块只有这串数与一条尺：尺说的正是「这一轮的时间花在哪」——展开要看的是细节，
            收起时想看的是形状。一段都量不到（未计时）时它整条不出。
            `scale` 由外部给：轮与轮之间比的是「哪一轮更重」，所以分母是**所有轮里最长的那个**。
            分段与下面那列步骤尺同源（`sumSegments`），所以形状上这一条正是那几条的合成（各步的
            段边界按时间加权平均）；但**长度只有这一条有**——步骤尺铺满车道，量级由这里独担。 */}
        {phases.length > 0 && (
          <>
            <span className="dtpl-tok-turn-bar">
              <TimeBar tone="turn" scale={turnScale} segments={phases} />
            </span>
            {/* 尺只给形状，数得写在下面：要知道「这一轮等首 token 花了多少、工具花了多少」，
                只有条没有数字就得点开逐行加。这串读数让收起状态也答得出那两件事——读者扫一列
                轮块头就能找到那个卡住的轮。名字与步骤表、图例同取 `PHASE_LABEL`，
                三处说的是同一批词；分段同取 `phases`，所以条与数不可能对不上。 */}
            <TimeReads reads={phaseReads} />
          </>
        )}
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
      {rows.length > 0 && (
        <div className="dtpl-tok-steps" data-open={open}>
          <div className="dtpl-tok-steps-inner">
            {rows.map((row) => <StepRow key={row.requestId} row={row} columns={columns} />)}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 一步的用时**表**：模型 / 等首 token / 生成 / 工具 / 速度，标签在上值在下，一列一个量。
 *
 * 为什么排成表而不是那串「甲 X · 乙 Y · 丙 Z」：这一步的用时要和**别的步**比才有意义（哪一步
 * 慢、慢在哪一段），而一串折行的读数里每个数的横坐标都不一样，眼睛没法上下对——同一串里
 * 「3.8秒」和下一行的「3.6秒」差着几十像素，比一次要重新找一次。排成等宽列之后，一列就是一个
 * 量，竖着扫下去就是趋势。
 *
 * **列集合由整块决定，不由这一行决定**：某一步缺首 token（通道没上报流）时它那一格报「—」
 * 而不是把这列抽掉——抽掉的话这一块里其余行的列宽全会跟着变，对齐就没了，而「对齐」正是
 * 这张表存在的理由。
 */
const TIMING_METRICS: ReadonlyArray<{ key: 'llmMs' | 'ttftMs' | 'decodeMs' | 'toolMs'; label: string }> = [
  { key: 'llmMs', label: '模型' },
  { key: 'ttftMs', label: PHASE_LABEL.wait },
  { key: 'decodeMs', label: PHASE_LABEL.generate },
  { key: 'toolMs', label: PHASE_LABEL.tool },
]

/** 这一块的步骤里，哪几列真的有读数（含速度）。整块共用一份，见 TIMING_METRICS 的注释。 */
function timingColumnsOf(rows: readonly SessionStepRow[]): { metrics: typeof TIMING_METRICS[number][]; speed: boolean } {
  const metrics = TIMING_METRICS.filter((metric) => rows.some((row) => row.timing?.[metric.key] !== undefined))
  const speed = rows.some((row) => speedOf(row) !== null)
  return { metrics, speed }
}

/** 一步的输出速度（tok/s）。两个数有一个不可信就不报——分母是 0 的「速度」不是速度。 */
function speedOf(row: SessionStepRow): number | null {
  return tokensPerSecond(row.usage?.outputTokens, row.timing?.decodeMs)
}

/**
 * 一步一行：账本行原样（一行就是一次计费调用），它的钱与桶名跟着这一行走。
 *
 * 排成**三段带**，每段各占整行——身份与钱 ｜ 尺 ｜ 读数：
 *  - 第一段左起身份、右端是这一行的钱。钱放这里因为它和身份是同一个问句的两半
 *    （「哪一步、花了多少」），而读数带问的是「这段时间与这些词元长什么样」；
 *    两者混在一条带里，读者会把金额读成第十个用时。
 *  - 第二段只有尺。它**不给分母**（步骤尺只说花在哪三段，量级归读数里那些数，理由见 TimeBar），
 *    所以它不需要与谁并排比长短——独立成行之后车道就是整行宽，三段里最窄的一段也不会掉到
 *    4.4px 那种读不出比例的地步；每一行的段边界还落在同一组横坐标上，竖着扫一列就是趋势。
 *  - 第三段是读数：用时一簇（等宽列，缺读数的格子报「—」）+ 四桶一簇。两簇各自成网格，
 *    一个量一列，竖着扫下去就是趋势。
 */
function StepRow({ row, columns }: {
  row: SessionStepRow
  columns: { metrics: typeof TIMING_METRICS[number][]; speed: boolean }
}) {
  const usage = row.usage
  const chip = chipOf(row)
  const segments = stepSegments(row.timing)
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
      <CostCell row={row} />
      <span className="dtpl-tok-step-bar">
        {/* 一段都分不出来时（未计时 / 只有墙钟）尺不出，这一段就空着——它本来也是空的。 */}
        <TimeBar segments={segments} tone="step" />
      </span>
      <div className="dtpl-tok-step-read">
        <StepTimingTable row={row} columns={columns} />
        <span className="dtpl-tok-tokens">
          {usage === undefined
            ? <span className="dtpl-tok-untimed">用量未知</span>
            : BUCKETS.map((bucketOf) => (
              <span className="dtpl-tok-metric" key={bucketOf.key}>
                <span className="dtpl-tok-metric-k">{bucketOf.label}</span>
                <span className="dtpl-tok-metric-v">{formatTokens(num(usage[bucketOf.key]))}</span>
              </span>
            ))}
        </span>
      </div>
    </div>
  )
}

/**
 * 一步的读数表：模型 / 首 token / 生成 / 工具 / tok/s 各一列。标签在上、值在下，一列一个量。
 *
 * 三种形态各占自己的那一段（不参与列对齐，因为没有数可以对齐）：
 * - 一段都量不到 → 「未计时」；
 * - 只有墙钟（重试耗尽 / 取消）→ 「用时 X」，并说明为什么没有模型那段。
 * 其余走 `columns` 那一组等宽列，缺读数的格子报「—」（那是「没量到」，同本页其余口径）。
 */
function StepTimingTable({ row, columns }: {
  row: SessionStepRow
  columns: { metrics: typeof TIMING_METRICS[number][]; speed: boolean }
}) {
  const timing = row.timing
  const speed = speedOf(row)
  const cells = Math.max(1, columns.metrics.length + (columns.speed ? 1 : 0))
  const style = { '--dtpl-tok-cells': String(cells) } as CSSProperties
  if (timing?.llmMs === undefined) {
    const wall = timing?.wallMs
    return (
      <span className="dtpl-tok-metrics is-flat" style={style}>
        <span className="dtpl-tok-metric">
          <span className="dtpl-tok-metric-k">用时</span>
          <span className={wall === undefined ? 'dtpl-tok-metric-v dtpl-tok-untimed' : 'dtpl-tok-metric-v'}>
            {wall === undefined ? '未计时' : formatDuration(wall)}
          </span>
        </span>
        {wall !== undefined && (
          <span className="dtpl-tok-untimed is-note">无产出：这段墙钟耗在重试与退避上，没有模型那段可归属</span>
        )}
      </span>
    )
  }
  return (
    <span className="dtpl-tok-metrics" style={style}>
      {columns.metrics.map((metric) => {
        const value = timing[metric.key]
        return (
          <span className="dtpl-tok-metric" key={metric.key}>
            <span className="dtpl-tok-metric-k">{metric.label}</span>
            <span className={value === undefined ? 'dtpl-tok-metric-v dtpl-tok-untimed' : 'dtpl-tok-metric-v'}>
              {value === undefined ? '—' : formatDuration(value)}
            </span>
          </span>
        )
      })}
      {columns.speed && (
        <span className="dtpl-tok-metric">
          {/* 标签就是单位「tok/s」：值配上它自己读成一句「156 tok/s」，不必再有「速度」两个字
              占宽。 */}
          <span className="dtpl-tok-metric-k">tok/s</span>
          <span className={speed === null ? 'dtpl-tok-metric-v dtpl-tok-untimed' : 'dtpl-tok-metric-v'}>
            {speed === null ? '—' : String(speed)}
          </span>
        </span>
      )}
    </span>
  )
}

/**
 * 这一行的钱：桶名 + 数额，排在身份那一段的右端，与块头那串事实同一个词序（「¥0.86 订阅价值」）。
 *
 * 主次不靠颜色靠字重（现金 600 主墨 / 订阅 400 次墨 / 未知「—」三档），与浮窗明细的
 * is-cash / is-zero 同一口径。「价格未知」后面缀一句「按 ¥0 计」：数额格是「—」（没有读数可报），
 * 但这一行确实按 ¥0 计，桶名自己把这句话说完。
 */
function CostCell({ row }: { row: SessionStepRow }) {
  const bucket = row.bucket === 'subscription' || row.bucket === 'unpriced' ? row.bucket : 'spend'
  const valueClass = bucket === 'unpriced' ? 'dtpl-cost-na' : bucket === 'subscription' ? 'dtpl-sub-amt' : 'dtpl-cash-amt'
  return (
    <span className="dtpl-tok-step-cost">
      <span className="dtpl-tok-step-cost-k">
        {bucket === 'unpriced' ? <>价格未知<i>按 ¥0 计</i></> : bucketWord(bucket)}
      </span>
      <span className={valueClass}>
        {bucket === 'unpriced' ? '—' : formatMoney(num(row.cost))}
      </span>
    </span>
  )
}

/** 已定价那一半的桶名（价格未知的行自己说两句，见 CostCell）。 */
function bucketWord(bucket: 'spend' | 'subscription'): string {
  return bucket === 'subscription' ? '订阅价值' : '实际支出'
}

/** 输出速度（tok/s）。两个数有一个不可信就不报——分母是 0 的「速度」不是速度。 */
function tokensPerSecond(outputTokens: unknown, decodeMs: number | undefined): number | null {
  if (typeof outputTokens !== 'number' || !Number.isFinite(outputTokens) || outputTokens <= 0) return null
  if (decodeMs === undefined || decodeMs <= 0) return null
  const rate = outputTokens / (decodeMs / 1000)
  return rate >= 10 ? Math.round(rate) : Math.round(rate * 10) / 10
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
    ...timingDetail(row.timing),
  ].join('\n')
}

/**
 * 用时的审计行。步骤墙钟 = 模型 + 工具（本机 12.6 万步实测残差中位数 2ms），所以这几个数
 * 就是分解本身；工具那段再报一步里最慢的那次调用——整步卡住通常就是它。
 *
 * `ask_user_question` / `wait_agent` 这种等待**不该**与真正的执行混为一谈：它们记的是
 * 「代理在等外面」，不是「外面在算」。这里在名字后面明说，免得把它们读成慢工具。
 */
function timingDetail(timing: StepTiming | undefined): string[] {
  if (timing === undefined) return ['未计时：这一步没有可用的起止事件']
  const wall = timing.wallMs === undefined ? undefined : `用时 ${formatDuration(timing.wallMs)}`
  const model = timing.llmMs === undefined
    ? '模型用时未知：这一步没有产出（取消 / 重试耗尽）'
    : `其中模型 ${formatDuration(timing.llmMs)}`
  const lines = [
    wall === undefined ? model : `${wall}（${model}）`,
  ]
  if (timing.ttftMs !== undefined) lines.push(`${PHASE_LABEL.wait} ${formatDuration(timing.ttftMs)}`)
  if (timing.decodeMs !== undefined) lines.push(`生成 ${formatDuration(timing.decodeMs)}`)
  if (timing.toolMs !== undefined) {
    const calls = timing.toolCalls ?? 0
    lines.push(`工具 ${formatDuration(timing.toolMs)}（${String(calls)} 次调用取并集，并行只算一次）`)
    const slow = timing.slowTool
    if (slow !== undefined) {
      const name = slow.name === '' ? '未具名工具' : slow.name
      lines.push(`  最慢：${name} ${formatDuration(slow.ms)}${WAITING_TOOLS.has(slow.name) ? '（在等外部输入 / 外部任务，不是它在算）' : ''}`)
    }
  }
  return lines
}

/** 记的是「代理在等外面」而不是「外面在算」的那几个工具（见 timingDetail）。 */
const WAITING_TOOLS = new Set(['ask_user_question', 'wait_agent', 'exit_plan_mode'])