/**
 * 会话词元页的**图表**：每轮两格小图（新增词元 / 缓存读取），外加指着一根柱子时报的那张读数卡。
 *
 * 单独成文件是因为它是一块**自包含的交互**：悬停卡片的定位要量真实 DOM（柱子在哪、图被
 * 滚到哪、卡片会不会被裁），这部分逻辑（useLayoutEffect + scroll/resize 监听）与数据无关，
 * 但与「柱子怎么画」紧耦合。而它要的数据形状（BUCKETS、TurnPreview）与它下面的明细表共用，
 * 那些在 `session-shared`；它要的数字工具（num）在 `session-wire`。混在一起会让这一页的
 * 第一个交互与最后一条明细行同文件。
 */

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { SessionUsageGroup } from '../types.ts'
import { formatMoney, formatShare, formatTokens } from './format.ts'
import { num } from './session-wire.ts'
import { BUCKETS, hasPricedRow, type PreviewMap, type TurnPreview } from './session-shared.ts'

/** 一格图插在 style 上的列数——React 的 CSSProperties 不收 `--*`，在这里开一个口子。 */
type SlotStyle = CSSProperties & Record<'--dtpl-slots', string>

/** 入场时每根柱错开一步的毫秒数（与 shared.ts 里 .dtpl-bars 的 12ms 同一个数，此处只做叙述）。 */
const STAGGER_STEP = 6

/** 两格的身份：悬停卡片里那句「柱高是怎么来的」要按格子说话。 */
type Panel = 'fresh' | 'cache'

/** 指针停在哪根柱子上：哪一列（轮次下标）、指着哪一格、以及那根柱子（卡片拿它定位）。 */
interface HoverTarget {
  index: number
  panel: Panel
  bar: HTMLElement
}

/** 柱高与标签锚点共用这一个函数：两处各写一份，标签就会和柱顶悄悄错开。 */
function columnHeight(value: number, max: number): string {
  return value > 0 ? `max(2px, ${String(Math.round((value / max) * 100))}%)` : '0px'
}

/**
 * 每轮两格小图（small multiples）：上格新增词元、下格缓存读取，共用同一列轮次与同一条轴线。
 *
 * 为什么不是「一列里并排两根柱」——那是上一版的画法，两件事一起读错：
 * 一是**两把尺子并排**，读者会不由自主地比高度，而两根柱的量级差着几十倍；
 * 二是**柱宽跟着列一起撑开**，三轮的会话里每列近 400px 宽，柱形变成一块灰砖，读不出是柱状图。
 * 分成两格后每格只有一把尺子，柱宽有上限（见 session.ts），量级差多少由格头那两个数说。
 *
 * 轮次多到一列装不下自己的柱值标签时，整块图横向滚动（下限与滚动条见 session.ts 的
 * .dtpl-tok-plot）：把几十轮压进一屏，柱与标签都会挤成一团，哪个轮次都读不成一个数。
 *
 * 指针停在一根柱子上就报**那一轮**的读数卡（读数、四桶、提问与回答预览）——柱高只有 68px，
 * 一屏几十列，看图能看出「哪一轮高」，看不出「这一轮花了什么」。
 */
export function TurnChart({ turns, previews }: {
  turns: readonly SessionUsageGroup[]
  /** 轮次预览；投影缺席时是空表，卡片里那两行预览跟着不出（数字部分照常）。 */
  previews: PreviewMap
}) {
  const plot = useRef<HTMLDivElement>(null)
  const figure = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  /** 这块图比它那块地方宽吗——只有真溢出时才给滚动区一条键盘路径、才说那句话。 */
  const [scrollable, setScrollable] = useState(false)
  const [hover, setHover] = useState<HoverTarget | null>(null)
  /** 卡片量完之后的落点（相对 figure）；null = 还没量，这一帧先不画。 */
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null)
  // 一列站得住的最小宽度是 CSS 说了算的常数（--dtpl-slot-w），所以「溢出没有」只能量：
  // CSS 自己说不出「内容比容器宽」，量出来的宽度才是真的。轮数变了重新量一次，窗口或列宽
  // 变了由观察器补上。
  useEffect(() => {
    const element = plot.current
    if (element === null) return
    const read = (): void => { setScrollable(element.scrollWidth - element.clientWidth > 1) }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(element)
    return () => { observer.disconnect() }
  }, [turns.length])
  // 卡片比一根柱子宽得多，贴边那一列必须被拉回图内（不拉回来会被图的滚动区裁掉一截），所以
  // 位置只能**量完再定**：先把它挂上去（这期间不画），useLayoutEffect 赶在这一帧画出来之前摆好，
  // 「先挂后摆」这一步因此看不见。滚动与缩放跟着重摆，卡片才不会和它指的那根柱子走散。
  useLayoutEffect(() => {
    const box = card.current
    const wrap = figure.current
    // 柱子被换掉（换会话、数据重排）之后那根柱子已经不在了，这张卡无处可指。
    if (hover === null || box === null || wrap === null || !hover.bar.isConnected) {
      setSpot(null)
      return
    }
    const place = (): void => {
      const frame = wrap.getBoundingClientRect()
      const bar = hover.bar.getBoundingClientRect()
      const size = box.getBoundingClientRect()
      // 卡片画在图的滚动区**外面**（挂在 figure 上），但仍按滚动区的可见范围夹一次上下：
      // 图被滚到视口顶端时，往上摆的卡片会整块跑到看不见的地方。
      const view = wrap.closest('.dtpl-tok-scroll')?.getBoundingClientRect() ?? frame
      // 20px 是让开柱顶那行柱值标签（14px 行高 + 2px 偏移）。
      const above = bar.top - frame.top - 20 - size.height
      const minTop = view.top - frame.top + 8
      const top = above >= minTop
        ? above
        : clamp(bar.bottom - frame.top + 6, minTop, view.bottom - frame.top - size.height - 8)
      setSpot({
        left: clamp(bar.left - frame.left + bar.width / 2 - size.width / 2, 0, frame.width - size.width),
        top,
      })
    }
    place()
    // 捕获：宿主里滚的是内部那层（.dtpl-tok-scroll），scroll 不冒泡但会被捕获到。
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [hover])
  if (turns.length === 0) return null
  const fresh = turns.map(freshOf)
  const cached = turns.map((group) => group.totals.cacheReadTokens)
  const freshPeak = peakIndexOf(fresh)
  const cachePeak = peakIndexOf(cached)
  const slots: SlotStyle = { '--dtpl-slots': String(turns.length) }
  const notes = [
    // 两格各自归一这件事得说出来：缓存读实测能占四桶 99%，看上去「少画了一半」的正是它。
    // 整会话一次缓存读都没有时不画下面那格，这句解释也跟着不出。
    cachePeak >= 0 ? '两格各自归一：缓存读的量级常是新增的几十倍，同轴会把新增压成一条线。' : null,
    scrollable ? '轮次多到一列放不下柱值，这张图横向滚动（拖滚动条 / Shift + 滚轮）：上下两格与轴线一起走。' : null,
  ].filter((sentence) => sentence !== null)
  const hovered = hover === null ? undefined : turns[hover.index]
  const preview = hovered?.turn == null ? undefined : previews.get(hovered.turn)
  return (
    <section aria-label="每轮新增与缓存读">
      <h2 className="dtpl-sec-title">每轮新增与缓存读</h2>
      {notes.length > 0 && <p className="dtpl-tok-note">{notes.join(' ')}</p>}
      <div className="dtpl-tok-chart" ref={figure}>
        <div
          className="dtpl-tok-plot"
          style={slots}
          ref={plot}
          // 可滚动才进 Tab 序：滚轮是纵轴的事，横向滚动条之外还得有一条键盘路径。
          tabIndex={scrollable ? 0 : undefined}
          aria-label={scrollable ? '按轮次的柱状图，可横向滚动' : undefined}
        >
          <BarPanel
            panel="fresh"
            name="新增词元"
            series={fresh}
            turns={turns}
            peak={freshPeak}
            onHover={(panel, index, bar) => { setHover({ panel, index, bar }) }}
            onLeave={() => { setHover(null) }}
          />
          {cachePeak >= 0 && (
            <BarPanel
              panel="cache"
              name="缓存读取"
              series={cached}
              turns={turns}
              peak={cachePeak}
              offset={STAGGER_STEP}
              onHover={(panel, index, bar) => { setHover({ panel, index, bar }) }}
              onLeave={() => { setHover(null) }}
            />
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
        {/* 读数卡是**图形**、不是可聚焦的东西，所以整块不进无障碍树（aria-hidden）：同一份读数
            下面「按轮次明细」那块里有完整一份，键盘与读屏走那边。 */}
        {hover !== null && hovered !== undefined && (
          <div
            className="dtpl-tok-hover"
            ref={card}
            aria-hidden="true"
            style={spot === null ? { visibility: 'hidden' } : { left: `${String(spot.left)}px`, top: `${String(spot.top)}px` }}
          >
            <p className="dtpl-tok-panel-k">
              第 {String(hovered.turn)} 轮
              <span className="dtpl-tok-panel-v">{hovered.rows.length} 步</span>
              <i aria-hidden="true">·</i>
              <span className="dtpl-tok-panel-v">{formatTokens(hovered.tokens)} 词元</span>
              {/* 与块头同一条判据（见 session-shared 的 `hasPricedRow`）：整轮价格未知时它的 ¥0
                  是占位不是读数，报成「¥0.00 实际支出」就是把未知印成读数。 */}
              {hasPricedRow(hovered.rows)
                ? (hovered.spend > 0 || hovered.subscriptionValue === 0) && (
                  <>
                    <i aria-hidden="true">·</i>
                    <span className="dtpl-tok-panel-v">{formatMoney(hovered.spend)} 实际支出</span>
                  </>
                )
                : (
                  <>
                    <i aria-hidden="true">·</i>
                    <span className="dtpl-tok-panel-v">价格未知</span>
                  </>
                )}
              {hovered.subscriptionValue > 0 && (
                <>
                  <i aria-hidden="true">·</i>
                  <span className="dtpl-tok-panel-v">{formatMoney(hovered.subscriptionValue)} 订阅价值</span>
                </>
              )}
            </p>
            <p className="dtpl-tok-hover-basis">
              {basisOf(hover.panel, hovered, hover.panel === 'fresh' ? fresh[hover.index]! : cached[hover.index]!)}
            </p>
            <p className="dtpl-hero-facts dtpl-tok-hover-buckets">
              {BUCKETS.map((bucket, index) => (
                <Fragment key={bucket.key}>
                  {index > 0 && <i aria-hidden="true">·</i>}
                  <span className="dtpl-hero-fact">
                    {bucket.label} <b>{formatTokens(num(hovered.totals[bucket.key]))}</b>
                  </span>
                </Fragment>
              ))}
            </p>
            {preview !== undefined && (preview.prompt !== '' || preview.response !== '') && (
              <span className="dtpl-tok-turn-preview">
                {preview.prompt !== '' && <span className="dtpl-tok-turn-ask" title={preview.prompt}>{preview.prompt}</span>}
                {preview.response !== '' && <span className="dtpl-tok-turn-reply" title={preview.response}>{preview.response}</span>}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/** 夹在 [low, high] 之间；high 比 low 还小的那几种情形（卡片比图还宽）以 low 为准——宁可溢出
 *  一边，也不把卡片翻到相反的一头去。 */
function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high))
}

/**
 * 卡片里那句「柱高是怎么来的」：柱子指到哪一格就说哪一格的口径。旧版这是原生 title 里的四行
 * 审计（柱高吃掉哪几个桶、缓存读占计费输入多少），现在柱值就写在柱顶、四桶就在卡片里，所以
 * 只留这一句**口径**。
 */
function basisOf(panel: Panel, group: SessionUsageGroup, value: number): string {
  if (panel === 'fresh') return '柱高 = 未缓存输入 + 缓存写入 + 输出'
  const totals = group.totals
  const billedInput = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
  return `柱高 = 缓存读取，占该轮计费输入 ${formatShare(value, billedInput)}`
}

/** 一轮的「新增词元」：这一轮**新产生**的部分（未缓存输入 + 缓存写入 + 输出），缓存读取不进去。 */
function freshOf(group: SessionUsageGroup): number {
  return group.totals.inputTokens + group.totals.cacheWriteTokens + group.totals.outputTokens
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
 *
 * 一列整列都是指针的作用域（柱身只占它 48% 宽），停上去就把那一轮的读数卡报出来——卡片由
 * TurnChart 画在图的滚动区外面，这里只报「哪一格、哪一列、哪根柱」。
 */
function BarPanel({ panel, name, series, turns, peak, offset = 0, onHover, onLeave }: {
  panel: Panel
  name: string
  series: readonly number[]
  turns: readonly SessionUsageGroup[]
  /** 本格峰值所在的下标；-1 表示这一系列整会话都是 0。 */
  peak: number
  /** 入场错峰的起手：下格比上格晚半拍，两格不同时长成一条线（见 session.ts 的 stagger 段）。 */
  offset?: number
  onHover: (panel: Panel, index: number, bar: HTMLElement) => void
  onLeave: () => void
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
      <div
        className="dtpl-bars is-anim"
        role="img"
        aria-label={panelLabel(name, turns, series, peak, sum)}
        style={{ '--dtpl-offset': offset } as CSSProperties}
      >
        {turns.map((group, index) => {
          const value = series[index]!
          const isPeak = index === peak
          const height = columnHeight(value, max)
          return (
            <div
              className={`dtpl-bar${value === 0 ? ' is-zero' : ''}`}
              key={group.turn ?? index}
              style={{ '--dtpl-i': index } as CSSProperties}
              onMouseEnter={(event) => { onHover(panel, index, event.currentTarget) }}
              onMouseLeave={onLeave}
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