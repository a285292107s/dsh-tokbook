/**
 * The 调价史 drawer's time axis: one row's price timeline anchored to the
 * ledger's FIRST record, ending at 「今天」.
 *
 * Anchoring matters more than it sounds. The price file's own axis is abstract
 * — a segment can say `2026-08-01 起` for a row whose first byte was billed on
 * 08-15 — and an axis drawn from the file alone cannot say where this row's
 * history actually begins, nor where account exists that no price reaches. So
 * the left end is 首记 (this row's first ledger record) whenever the ledger knows
 * one, and everything else is placed against it. It is taken at the PRICE FILE's
 * precision — the hour that record falls in — because that is also where the
 * price table puts an unwritten 生效时间: one fact, one instant on this axis,
 * instead of two left ends a few minutes apart.
 *
 * The track is ONE flex row whose items are columns of stacked cells (date, bar,
 * state) — that is what keeps every date exactly over the bar it belongs to. It
 * also means a label with no bar under it would still hold that width in the bar
 * row and read as a hole, so the left end is a bare tick and the instant it
 * stands for is named in the sentence UNDER the axis instead.
 *
 *   · a boundary EARLIER than that left end is off the axis: its block starts at
 *     the left end and its label carries 「◀ date」 instead of a tick (a tick
 *     there would claim the boundary sits at the axis start);
 *   · a 无起点 segment dissolves into the left edge — there is no boundary to
 *     draw;
 *   · a boundary LATER than the left end opens a 「未覆盖」 region between them —
 *     but only when there is ACCOUNT in it. The ledger's count is what decides:
 *     an empty stretch is not a hole, and the axis has no scale with which to
 *     imply the distance anyway. Those records bill ¥0, and this region is the
 *     only place the 价格表 admits that a PRICED row is not pricing all of its
 *     history;
 *   · a segment dated in the FUTURE sits to the right of the 今天 tick, where
 *     being idle is visible instead of implied (the row's own cells and badges
 *     speak only about the segment in force).
 *
 * No time scale on purpose: an unbounded region has no width, and equal blocks
 * keep every dated segment readable instead of collapsing them into slivers.
 * What IS guaranteed is SPACING: every 调价 is a node on the axis, and each node
 * keeps a minimum width (`--dtpl-tl-node-w`, sized to the widest label the axis
 * prints — an hourly boundary like `2026-09-10 12:00`). Two 调价 a day apart
 * therefore never pile their dates on top of each other; when the nodes stop
 * fitting, the track scrolls sideways instead of compressing. The node itself is
 * a dot where the interval starts, so "几号调的价" and "这段价管多久" are read as
 * two different things.
 *
 * A price block is a button (the axis is navigation, not decoration); a 未覆盖
 * region is not — there is no segment to jump to, it is a hole.
 *
 * @module dsh-tokbook/client/pricing/Timeline
 */

import { dayKeyOf, hourStartMs, instantKey } from '../../price-format.ts'
import {
  effectiveSlots, isBlankSegment, isFutureSegment, segmentInstant, sortedSegments,
  type ModelDraft, type SegmentDraft,
} from './draft.ts'

/** Focus the segment editor block the axis points at. The ids come from
 *  `SegmentEditor`'s own `seg-<id>-from` — an empty 生效时间 field is exactly
 *  where a 无起点 segment gets its date, so landing there is the whole gesture.
 *  The smooth scroll is skipped for users who asked for reduced motion. */
function jumpToSegment(id: number): void {
  const input = document.getElementById(`seg-${String(id)}-from`)
  if (input === null) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  input.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  input.focus()
}

/** One interval of the axis: its left boundary (无起点, a date, or 「◀ date」 for
 *  a boundary that predates the axis's left end) over the bar standing for the
 *  time it covers. The block that begins exactly AT that left end is the one the
 *  left end's tick stands against; the instant itself is named in the sentence
 *  under the axis (see `ledgerNote`), because a label taking width on the track
 *  would hold a bar-sized hole in the row beneath it. */
function AxisSegment({ segment, active, future, beforeAnchor, atStart }: {
  segment: SegmentDraft
  active: boolean
  future: boolean
  /** True when this segment's boundary sits left of the axis's own left end. */
  beforeAnchor: boolean
  /** True when its boundary IS that left end. */
  atStart: boolean
}) {
  const open = segment.from.trim() === ''
  const slots = effectiveSlots(segment).length
  const date = segment.from.replace('T', ' ')
  const boundary = open ? '无起点' : beforeAnchor ? `◀ ${date}` : date
  const what = open
    ? '无起点：这份价自始生效，没有生效日期'
    : beforeAnchor ? `${date} 起生效（早于本轴的左端）`
      : atStart ? `${date} 起生效（本行的首记，也是轴的左端）` : `${date} 起生效`
  const state = active ? '（当前生效）' : future ? '（还没生效）' : ''
  return (
    <button
      type="button"
      className="dtpl-tl-seg"
      data-open={open}
      data-active={active}
      data-future={future}
      data-before={beforeAnchor}
      /* The full sentence the tooltip shows, announced instead of hovered: a
         keyboard user gets the same facts, and 当前生效 becomes a state a screen
         reader can report rather than a color. */
      aria-label={`${what}${state}${slots > 0 ? `，含 ${String(slots)} 个峰谷时段` : ''}。激活后跳到这一段`}
      aria-current={active ? 'true' : undefined}
      title={`${what}${state}${slots > 0 ? `\n含 ${String(slots)} 个峰谷时段` : ''}\n点击跳到这一段`}
      onClick={() => jumpToSegment(segment.id)}
    >
      <span className="dtpl-tl-seg-k" aria-hidden="true">{boundary}</span>
      <span className="dtpl-tl-seg-bar" aria-hidden="true" />
      <span className="dtpl-tl-seg-tag" aria-hidden="true">
        {active ? '当前生效' : future ? '未生效' : ''}
      </span>
    </button>
  )
}

/** The stretch between 首记 and a boundary that arrived later — account no price
 *  segment covers. It occupies the axis instead of floating above it. */
function UncoveredSpan({ count, priced, title }: {
  count: number | undefined
  /** A PRICED row with a hole is the news worth coloring; a row with no price at
   *  all is the 价格未知 badge's business, so it stays neutral. */
  priced: boolean
  title: string
}) {
  return (
    <span className="dtpl-tl-gap" data-warn={priced && count !== undefined && count > 0} title={title}>
      <span className="dtpl-tl-seg-k">未覆盖</span>
      <span className="dtpl-tl-seg-bar" aria-hidden="true" />
      <span className="dtpl-tl-seg-tag">{count === undefined ? '' : `${String(count)} 次`}</span>
    </span>
  )
}

/** One sentence of the strip under the axis. `warn` marks the one that costs
 *  money: records the price table does not reach. */
interface AxisNote {
  text: string
  warn?: boolean
}

/** What the ledger did, as one sentence. 首记 is the axis's own left end, so the
 *  instant belongs here rather than in a label cell on the track: a date cell
 *  with no bar under it would hold width in the bar row and read as a gap. The
 *  line carries what the axis cannot: how many records there are, when this row
 *  was first and last used. Null when the ledger lens is missing. */
function ledgerNote(row: ModelDraft, startLabel: string): AxisNote | null {
  const { records, lastAt } = row
  if (records <= 0) return null
  const first = startLabel === '' ? '' : `，首记 ${startLabel}`
  if (lastAt === undefined) return { text: `账本 ${String(records)} 次${first}。` }
  return { text: `账本 ${String(records)} 次${first}，最后一次 ${dayKeyOf(lastAt)}。` }
}

/** What a hole costs, in words. Only a row that IS priced gets this sentence
 *  (and the warn color): 11 unpriced subscription rows each shouting 「N 次全部
 *  计 ¥0」would be crying wolf and would drain the color of meaning. */
function coverageNote(hole: boolean, row: ModelDraft): AxisNote | null {
  const { unpriced } = row
  const first = row.segments.find(segment => !isBlankSegment(segment))
  if (first === undefined || !hole) return null
  const boundary = first.from.replace('T', ' ')
  if (unpriced === undefined) return { text: `早于 ${boundary} 的账没有价（¥0）。` }
  return { text: `早于 ${boundary} 的 ${String(unpriced)} 次账没有价（¥0）。`, warn: true }
}

/** The axis of one row's 调价史, plus what the ledger says about this row.
 *  Renders nothing when there is neither a price nor a record to talk about —
 *  the row itself already says 「价格未知」 and 「账本没记过」. */
export function PriceTimeline({ row, activeId }: {
  /** The row, for its segments and the ledger facts the host sent with it. */
  row: ModelDraft
  /** The segment the row's four cells edit, marked 当前生效. */
  activeId: number | null
}) {
  // Force order, not array order: editing an 生效时间 moves a segment in time
  // without moving it in the array, and this axis heads the very list it indexes
  // — a block drawn out of order would put 「first」 on the wrong boundary.
  const priced = sortedSegments(row).filter(segment => !isBlankSegment(segment))
  const now = Date.now()
  const cut = priced.findIndex(segment => isFutureSegment(segment, now))
  const past = cut < 0 ? priced : priced.slice(0, cut)
  const future = cut < 0 ? [] : priced.slice(cut)
  // The axis's left end: this row's first ledger record (首记), taken at the
  // PRICE FILE's own precision — the hour it falls in. The price table writes an
  // unwritten 生效时间 at exactly that instant, so the first boundary and the
  // axis's left end are one moment instead of two a few minutes apart. Null when
  // the ledger knows no record: the axis then starts at the earliest boundary
  // the price file drew, and says so.
  const firstAt = row.records > 0 && row.firstAt !== undefined ? row.firstAt : null
  const axisStart = firstAt === null ? null : hourStartMs(firstAt)
  const startLabel = axisStart === null ? '' : instantKey(axisStart).replace('T', ' ')
  const first = priced[0]
  const openStart = first !== undefined && first.from.trim() === ''
  /** The earliest boundary the price file writes, in epoch ms (0 = 无起点). */
  const firstBoundary = first === undefined ? null : segmentInstant(first)
  /** A boundary the axis cannot draw because it happened before its left end. */
  const beforeStart = (segment: SegmentDraft): boolean =>
    axisStart !== null && firstBoundary !== null && segment.id === first?.id && firstBoundary < axisStart
  /** A boundary that IS the left end: the cap names it, the block does not. */
  const atStart = (segment: SegmentDraft): boolean =>
    axisStart !== null && firstBoundary !== null && segment.id === first?.id && firstBoundary === axisStart
  /** A boundary that arrived after the left end AND has account in the gap: the
   *  hole the axis draws. An empty stretch is not a hole — and the axis has no
   *  scale, so drawing one would only add a block nobody can use. */
  const hole = axisStart !== null && !openStart && first !== undefined && firstBoundary !== null
    && firstBoundary > axisStart && (row.unpriced ?? 0) > 0
  /** Nothing prices this row at all: everything from 首记 onward is unpriced. */
  const unpricedWhole = priced.length === 0 && axisStart !== null
  /** The axis drew a left end of its own because the ledger gave it none. Left
   *  unsaid, the missing cap reads as a missing label rather than as a fact. */
  const noAnchor = axisStart === null && first !== undefined && !openStart
  if (priced.length === 0 && axisStart === null) return null
  const label = (segment: SegmentDraft): string =>
    segment.from.trim() === '' ? '无起点段' : `${segment.from.replace('T', ' ')} 起`
  const spoken = [
    axisStart === null ? null : `首记 ${startLabel}`,
    hole ? `未覆盖 ${String(row.unpriced)} 次` : null,
    unpricedWhole ? '整段没有价' : null,
    noAnchor ? '没有首记可锚' : null,
    ...priced.map((segment) => {
      const mark = segment.id === activeId ? '（当前生效）' : isFutureSegment(segment, now) ? '（未生效）' : ''
      return `${beforeStart(segment) ? '早于左端的 ' : ''}${label(segment)}${mark}`
    }),
  ].filter(part => part !== null).join('，然后 ')
  const notes: AxisNote[] = []
  const coverage = coverageNote(hole, row)
  if (coverage !== null) notes.push(coverage)
  if (noAnchor) notes.push({ text: '没有首记可锚（账本没记过，或这次没读到账本）：左端取最早那段价的生效时刻。' })
  const ledger = ledgerNote(row, axisStart === null ? '' : startLabel)
  if (ledger !== null) notes.push(ledger)
  if (future.length > 0) notes.push({ text: `有 ${String(future.length)} 段还没生效，今天仍按上面标着「当前生效」的那段算。` })
  return (
    <div className="dtpl-tl">
      <div className="dtpl-tl-track" role="group" aria-label={`价段时间轴：${spoken}；今天在最右端。`}>
        {/* The left end: a tick, nothing else. Its instant is named in the
            sentence below the track, and the block that starts here carries its
            own boundary date like every other block. */}
        {axisStart !== null && <span className="dtpl-tl-cap" aria-hidden="true" />}
        {hole && (
          <UncoveredSpan
            count={row.unpriced}
            priced
            title={`最早价段之前的这一段有 ${String(row.unpriced)} 次账：价格表管不到，计 ¥0`}
          />
        )}
        {unpricedWhole && (
          <UncoveredSpan count={row.unpriced} priced={false} title="这条模型还没有价：从首记直到今天的账全部计 ¥0" />
        )}
        {past.map(segment => (
          <AxisSegment
            key={segment.id}
            segment={segment}
            active={segment.id === activeId}
            future={false}
            beforeAnchor={beforeStart(segment)}
            atStart={atStart(segment)}
          />
        ))}
        <span className="dtpl-tl-now" title="今天：轴的右端。它右边是你已经写好、但还没生效的价">今天</span>
        {future.map(segment => (
          <AxisSegment
            key={segment.id}
            segment={segment}
            active={segment.id === activeId}
            future
            beforeAnchor={false}
            atStart={false}
          />
        ))}
      </div>
      <p className="dtpl-tl-note">
        {notes.map(note => (
          <span key={note.text} data-warn={note.warn === true}>{note.text}{' '}</span>
        ))}
      </p>
    </div>
  )
}
