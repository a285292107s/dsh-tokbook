import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SessionUsageGroup } from '../types.ts'
import { formatMoney, formatShare, formatTokens } from './format.ts'
import { num } from './session-wire.ts'
import { BUCKETS, hasPricedRow, type PreviewMap } from './session-shared.ts'

type SlotStyle = CSSProperties & Record<'--dtpl-slots', string>

const STAGGER_STEP = 6

type Panel = 'fresh' | 'cache'

interface HoverTarget {
  index: number
  panel: Panel
  bar: HTMLElement
}

function columnHeight(value: number, max: number): string {
  return value > 0 ? `max(2px, ${String(Math.round((value / max) * 100))}%)` : '0px'
}

export function TurnChart({ turns, previews }: {
  turns: readonly SessionUsageGroup[]
  previews: PreviewMap
}) {
  const plot = useRef<HTMLDivElement>(null)
  const figure = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [scrollable, setScrollable] = useState(false)
  const [hover, setHover] = useState<HoverTarget | null>(null)
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null)
  useEffect(() => {
    const element = plot.current
    if (element === null) return
    const read = (): void => { setScrollable(element.scrollWidth - element.clientWidth > 1) }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(element)
    return () => { observer.disconnect() }
  }, [turns.length])
  useLayoutEffect(() => {
    const box = card.current
    const wrap = figure.current
    if (hover === null || box === null || wrap === null || !hover.bar.isConnected) {
      setSpot(null)
      return
    }
    const place = (): void => {
      const frame = wrap.getBoundingClientRect()
      const bar = hover.bar.getBoundingClientRect()
      const size = box.getBoundingClientRect()
      const view = wrap.closest('.dtpl-tok-scroll')?.getBoundingClientRect() ?? frame
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

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high))
}

function basisOf(panel: Panel, group: SessionUsageGroup, value: number): string {
  if (panel === 'fresh') return '柱高 = 未缓存输入 + 缓存写入 + 输出'
  const totals = group.totals
  const billedInput = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
  return `柱高 = 缓存读取，占该轮计费输入 ${formatShare(value, billedInput)}`
}

function freshOf(group: SessionUsageGroup): number {
  return group.totals.inputTokens + group.totals.cacheWriteTokens + group.totals.outputTokens
}

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

function BarPanel({ panel, name, series, turns, peak, offset = 0, onHover, onLeave }: {
  panel: Panel
  name: string
  series: readonly number[]
  turns: readonly SessionUsageGroup[]
  peak: number
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
