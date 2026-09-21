/**
 * 价格表 tab 的行原语：价格段编辑器与选中模型的详情面。
 *
 * 改价一律走段卡里的输入框：每一张都是一段从某个时刻起生效的价，段与段互不沿用，
 * 没有被任何段覆盖的日期按 ¥0 计。谁被选中由面板决定（两个下拉），
 * 所以本文件不持有选择状态——只通过小回调下发改动。
 */

import { memo, useEffect, useRef, useState } from 'react'
import { DAY_SET_LABELS, DAY_SETS, clockLabel, holidayRangeLabel, isHourRange, type HourRange } from '../../price-format.ts'
import type { BillingNature, DaySet } from '../../types.ts'
import {
  duplicateSlot, effectiveSlots, fieldState, fromFieldValue, inheritedCell, isBlankSlot,
  dayLabel, modelDirty, newSegment, newSlot, parseCalendarText, ratesInForce, rowIssue, slotRange,
  sortedSegments, withSegmentFrom, withSlotEnd, withSlotStart,
  type CalendarDraft, type CalendarEntries, type ModelDraft, type RateField, type SegmentDraft, type SlotDraft,
} from './draft.ts'
import { PriceTimeline } from './Timeline.tsx'

/** 行的四个 ¥/M 单元格，按所有 surface 的书写顺序（列头 / 行内只读价 / 抽屉里的输入框）。 */
const CELLS: ReadonlyArray<{ field: RateField; label: string }> = [
  { field: 'input', label: '输入' },
  { field: 'output', label: '输出' },
  { field: 'cacheRead', label: '缓存读' },
  { field: 'cacheWrite', label: '缓存写' },
]

/** 时段可选的全部开始小时与结束小时（结束不含，`24:00` 关日）。 */
const START_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour)
const END_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour + 1)

/**
 * 法定节假日年历：价表里唯一**全局**的一份数据（不属于任何 route / model）。
 *
 * 它只服务一件事——把 `workdays` 时段里的法定节假日摘出去。国家每年底公布一次安排，
 * 所以这份数据是按年收录的；账本覆盖到、而这里没有的年份会自己报出来（那年会按
 * 周一至周五全额算高峰，节假日被多算）。放假日的**调休上班日**不必收录：调休只把
 * 周末变成上班，而周末无论上不上班都是闲时。
 *
 * 一年一条：年份 + 该年的区间文本，一行一段（`2026-02-15 ~ 2026-02-23`）。
 */
export function CalendarEditor({ entries, missingYears, dirty, onChange }: {
  entries: CalendarEntries
  /** 账本覆盖到、而这里没有的年份（host 算好的）。 */
  missingYears: readonly string[]
  /** 年历是否还没落盘。 */
  dirty: boolean
  /** 改一年；`null` = 删掉那一年。 */
  onChange: (year: string, next: CalendarDraft | null) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState('')
  const years = [...entries.keys()].sort((left, right) => left.localeCompare(right))
  const issues = years
    .map(year => ({ year, problem: parseCalendarProblem(entries.get(year)!) }))
    .filter((item): item is { year: string; problem: string } => item.problem !== null)

  const addYear = (): void => {
    const year = adding.trim()
    if (!/^\d{4}$/u.test(year) || entries.has(year)) return
    onChange(year, { year, text: '' })
    setAdding('')
  }

  return (
    <section className="dtpl-price-cal" data-dirty={dirty} aria-label="法定节假日年历">
      <div className="dtpl-price-cal-head">
        <button
          type="button"
          className="dtpl-price-cal-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded(current => !current)}
        >
          <span className="dtpl-price-cal-caret" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          法定节假日年历
        </button>
        <span className="dtpl-price-cal-sum">{summarizeCalendar(years)}</span>
        {issues.length > 0 && (
          <span className="dtpl-price-cal-warn" role="alert">有年份写不出来（见下）</span>
        )}
      </div>
      {missingYears.length > 0 && (
        <p className="dtpl-price-cal-miss" role="status">
          年历缺 {missingYears.join('、')} 年：这些年的「工作日（不含节假日）」会按周一至周五全额计，
          落在法定节假日的工作日会被多算高峰价。补上国家公布的放假安排即可。
        </p>
      )}
      {expanded && (
        <div className="dtpl-price-cal-body">
          <p className="dtpl-price-cal-note">
            每年一行一个放假日区间（`2026-02-15 ~ 2026-02-23`，单日可只写一个日期，多个用逗号或换行分隔）。
            只收录**放假日**：调休上班日落在周末，而周末本来就是闲时，不必写。
          </p>
          {years.map((year) => {
            const entry = entries.get(year)!
            const problem = parseCalendarProblem(entry)
            const parsed = parseCalendarText(entry.text, year)
            return (
              <div key={year} className="dtpl-price-cal-row" data-bad={problem !== null}>
                <label className="dtpl-price-cal-year" htmlFor={`cal-${year}`}>{year}</label>
                <textarea
                  id={`cal-${year}`}
                  className="dtpl-price-cal-text"
                  rows={2}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="2026-02-15 ~ 2026-02-23"
                  value={entry.text}
                  aria-label={`${year} 年的法定节假日`}
                  aria-invalid={problem !== null || undefined}
                  onChange={(event) => onChange(year, { year, text: event.target.value })}
                />
                <span className="dtpl-price-cal-read" aria-hidden="true">
                  {parsed.ok ? parsed.ranges.map(holidayRangeLabel).join('、') : ''}
                </span>
                <button
                  type="button"
                  className="dtpl-price-ghost dtpl-price-ghost-danger"
                  title={`删掉 ${year} 年：那一年会退回按周一至周五全额算高峰`}
                  onClick={() => onChange(year, null)}
                >
                  删除
                </button>
                {problem !== null && <span className="dtpl-price-cell-err" role="alert">{problem}</span>}
              </div>
            )
          })}
          <div className="dtpl-price-cal-add">
            <input
              className="dtpl-price-input dtpl-price-cal-newyear"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={String(new Date().getFullYear() + 1)}
              value={adding}
              aria-label="要加入的年份"
              onChange={(event) => setAdding(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addYear()
              }}
            />
            <button type="button" className="dtpl-price-add-ghost" onClick={addYear}>
              <span className="dtpl-price-add-plus" aria-hidden="true">＋</span>年
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** 一年年历的首个问题，或 null。空文本不算问题：那一年还没写，写出去也只是空年。 */
function parseCalendarProblem(entry: CalendarDraft): string | null {
  if (entry.text.trim() === '') return null
  const parsed = parseCalendarText(entry.text, entry.year)
  return parsed.ok ? null : parsed.error
}

/** 收起时那行摘要：收录了哪几年、各几天。 */
function summarizeCalendar(years: readonly string[]): string {
  if (years.length === 0) return '未收录：工作日按周一至周五全额算'
  return `${years.join('、')} 已收录`
}

/** 抽屉里的一个数字单元格，原地编辑。 */
function RateCell({ id, label, hint, value, state, context, placeholder, note, onEdit }: {
  id: string
  label: string
  /** 该单元格所属的静态表头（无障碍用）。 */
  hint?: string
  value: string
  state: 'ok' | 'empty' | 'bad'
  context: string
  /** 单元格为空时显示的那个数（沿用来的鬼影）；缺省 = `—`，即这一档还没填。 */
  placeholder?: string
  /** 悬停时解释此上下文中空单元格的含义。 */
  note?: string
  onEdit?: (next: string) => void
}) {
  const errorId = `${id}-err`
  // 可见消息要短（不撑窄 rate 列）；完整句子挂在 title，行下方的问题行重复第一个问题。
  const message = state === 'bad' ? '须为非负数字' : undefined
  const tip = state === 'bad' ? `${label}必须是非负数字（¥/百万词元）` : note
  return (
    <div className="dtpl-price-cell" data-state={state}>
      <label className="dtpl-price-cell-k" htmlFor={id}>{hint ?? label}</label>
      <input
        id={id}
        className="dtpl-price-input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder ?? '—'}
        title={tip}
        value={value}
        aria-label={`${context} ${label}`}
        aria-invalid={state === 'bad' || undefined}
        aria-describedby={message !== undefined ? errorId : undefined}
        onChange={(event) => onEdit?.(event.target.value)}
        onKeyDown={(event) => {
          // Enter 离开单元格（值已暂存）。
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      {message !== undefined && <span id={errorId} className="dtpl-price-cell-err" role="alert">{message}</span>}
    </div>
  )
}

/** 表盘的几何，单位是 viewBox 单位（1 单位 = 1.8px）。**像素尺度固定**：圈多了盘就长大，
 *  而不是把每圈压小——基准价那一圈因此在所有段卡里一样大，段与段的差别只在外面多了几圈。
 *  DIAL_MAX_R 是外圈的顶：时段多到撑满它之后间距自己收窄（圈多到这个地步本来也只剩「有几圈」
 *  这一件事可看），盘不会长到把整张卡顶宽。 */
const DIAL_BASE_R = 16
const DIAL_STEP = 4.5
const DIAL_MAX_R = 30
const DIAL_PX_PER_UNIT = 1.8
/** 弧与零点刻钉之外还要留的边距（弧最粗 2 单位，刻钉还要探到外圈之外，取 3.5）。 */
const DIAL_MARGIN = 3.5

/** 盘上的一圈：半径 + 它覆盖的小时（`null` = 时刻还没成段，只剩淡轨）。 */
interface DialRing {
  r: number
  hours: HourRange | null
  /** 这一圈是谁——进 aria-label，也挂在它自己的 title 上。 */
  label: string
}

/** 24 小时表盘：最里面一圈是**基准价**（满弧——它管每天全天），每个峰谷时段在它外面各占一圈，
 *  弧就是那个窗口覆盖的小时；星期进不了盘（它只说小时），所以每圈的 title 把「工作日 09:00–12:00」
 *  这样的整句带上，盘与下面的时段卡因此对得上号（由内向外 = 时段卡的先后）。
 *  圈数随时段数长：没有时段时它就是一枚标准圆环。 */
function DayDial({ slots }: { slots: readonly SlotDraft[] }) {
  const step = Math.min(DIAL_STEP, (DIAL_MAX_R - DIAL_BASE_R) / Math.max(1, slots.length))
  const rings: DialRing[] = [
    { r: DIAL_BASE_R, hours: { start: 0, end: 24 }, label: '基准价 每天 全天' },
    ...slots.map((slot, index) => {
      const { start, end } = slotRange(slot)
      const place = `第 ${String(index + 1)} 个峰谷时段`
      return {
        r: DIAL_BASE_R + step * (index + 1),
        hours: isHourRange({ start, end }) ? { start, end } : null,
        label: `${place} ${dayLabel(slot)}`,
      }
    }),
  ]
  const outer = DIAL_BASE_R + step * slots.length
  const half = outer + DIAL_MARGIN
  const size = Math.round(half * 2 * DIAL_PX_PER_UNIT)
  return (
    <svg
      className="dtpl-price-slot-ring"
      viewBox={`${String(-half)} ${String(-half)} ${String(half * 2)} ${String(half * 2)}`}
      width={size} height={size}
      role="img"
      aria-label={rings.map(ring => ring.label).join('；')}
    >
      {rings.map((ring, index) => {
        const c = 2 * Math.PI * ring.r
        // 满弧就是一整圈：走整圆而不是一段 dash——一整天没有起点，dash 会在 12 点钟留一道接缝。
        const full = ring.hours !== null && ring.hours.end - ring.hours.start >= 24
        return (
          <g key={ring.r}>
            <title>{ring.label}</title>
            <circle className="dtpl-price-slot-ring-track" r={ring.r} />
            {ring.hours !== null && (full
              ? <circle className="dtpl-price-slot-ring-arc" r={ring.r} />
              : (
                <circle
                  className="dtpl-price-slot-ring-arc"
                  r={ring.r}
                  strokeDasharray={`${String((c * (ring.hours.end - ring.hours.start)) / 24)} ${String(c)}`}
                  strokeDashoffset={-(c * ring.hours.start) / 24}
                  transform="rotate(-90)"
                />
              ))}
            {/* 零点刻钉跟着**内圈**画：它压在基准价那一圈上（同色，那里本来看不见），从内圈一直
                探到外圈之外——它是「几点钟」这一个读法的索引，所有圈共用它。它排在其余各圈之前，
                所以任何一段跨过零点的弧都照样完整。 */}
            {index === 0 && (
              <line className="dtpl-price-slot-ring-zero" y1={-(DIAL_BASE_R - 2.5)} y2={-(outer + 2)} />
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** 一个峰谷时段：适用星期、覆盖小时、重写的桶。费率布局与上方基准价行相同——留空的桶显示它沿用的那个数
 *  （基准价，缓存两档在基准价也空时继续落到输入价）。
 *  **不画盘**：这一条的窗口由上方那圈表盘上说过了（星期除外，它进不了盘），盘要说的另一件事
 *  （共几小时）由头行那行时长说完。
 *  零覆盖的时段与计价无关（`isBlankSlot`），所以整条降级并直说这一点——空着不写文件是设计，不是待办。 */
function SlotEditor({ slot, index, canRemove, segment, onChange, onRemove, onDuplicate }: {
  slot: SlotDraft
  index: number
  /** 是否可删除（未完成的草稿永远可以；最后一个有价时段不行，否则会悄悄丢掉那个窗口）。 */
  canRemove: boolean
  /** 这一个时段所在的那一段：留空的档从它（缓存两档再往下落到它的输入价）沿用。 */
  segment: SegmentDraft
  onChange: (next: SlotDraft) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const context = `第 ${String(index + 1)} 个峰谷时段`
  const { start, end } = slotRange(slot)
  // 时长是派生的，不进 state：窗口的事实仍然只有三个下拉。
  const hours = isHourRange({ start, end }) ? end - start : null
  // 删除要两下：它改的是历史金额，账本没有撤销。聚焦离开即取消。
  const [confirming, setConfirming] = useState(false)
  const inert = isBlankSlot(slot)
  return (
    <div className="dtpl-price-slot" data-inert={inert}>
      {/* 栅栏：圆点 + 桩线，都相对**本槽**定位（本盒的 padding-left 就是卡片与栅栏的让位）。
          圆点的圆心钉在竖轨上（槽左缘 + 20，与卡片那一列差 42px），桩线把点接到卡片的左边框。 */}
      <span className="dtpl-price-slot-rail" aria-hidden="true">
        <span className="dtpl-price-slot-dot" />
        <span className="dtpl-price-slot-stub" />
      </span>
      <div className="dtpl-price-slot-card">
        <div className="dtpl-price-slot-head">
          <select
            className="dtpl-price-select dtpl-price-select-days"
            value={slot.days}
            aria-label={`${context}的适用日`}
            onChange={(event) => onChange({ ...slot, days: event.target.value as DaySet })}
          >
            {DAY_SETS.map(days => <option key={days} value={days}>{DAY_SET_LABELS[days]}</option>)}
          </select>
          <span className="dtpl-price-slot-clock">
            <select
              className="dtpl-price-select"
              value={slot.start}
              aria-label={`${context}的开始时间`}
              onChange={(event) => onChange(withSlotStart(slot, event.target.value))}
            >
              {START_HOURS.map(hour => <option key={hour} value={String(hour)}>{clockLabel(hour)}</option>)}
            </select>
            <span className="dtpl-price-slot-dash" aria-hidden="true">–</span>
            <select
              className="dtpl-price-select"
              value={slot.end}
              aria-label={`${context}的结束时间`}
              onChange={(event) => onChange(withSlotEnd(slot, event.target.value))}
            >
              {END_HOURS.map(hour => <option key={hour} value={String(hour)}>{clockLabel(hour)}</option>)}
            </select>
          </span>
          {/* 时长是派生的：钟点已经说了窗口，这三个字只省一次心算，所以走 dim 档、退到钟点右侧。 */}
          {hours !== null && (
            <span className="dtpl-price-slot-span" aria-hidden="true">{`· ${String(hours)} 小时`}</span>
          )}
          {inert && <span className="dtpl-price-slot-inert">未改写任何档：不影响计价</span>}
          <span className="dtpl-price-slot-actions">
            <button type="button" className="dtpl-price-ghost" onClick={onDuplicate}>复制</button>
            <button
              type="button"
              className="dtpl-price-ghost dtpl-price-ghost-danger"
              data-confirm={confirming}
              onClick={() => {
                if (!confirming) {
                  setConfirming(true)
                  return
                }
                setConfirming(false)
                onRemove()
              }}
              onBlur={() => setConfirming(false)}
              disabled={!canRemove}
              title={!canRemove
                ? '删掉最后一个有价的时段，这段覆盖的时间回到基准价'
                : confirming
                  ? '再点一次：这个时段会被删掉，它覆盖的小时回到基准价'
                  : '删除这个峰谷时段（需再点一次确认）'}
            >
              {confirming ? '确认删除' : '删除'}
            </button>
          </span>
        </div>
        <div className="dtpl-price-rates dtpl-price-slot-rates">
          {/* 读名只有桶名：四格与上方的基准价落在同一组竖线上，谁覆盖了谁一望即知；
              序号进可见读名会把格子撑宽，四格就散开了——「第 N 个峰谷时段」在 aria-label
              （context）里已经说全。 */}
          {CELLS.map(({ field, label }) => {
            const cell = inheritedCell(segment, slot, field)
            return (
              <RateCell
                key={field}
                id={`slot-${String(slot.id)}-${field}`}
                label={label}
                value={slot[field]}
                state={fieldState(slot, field)}
                context={context}
                placeholder={cell.value}
                note={cell.note}
                onEdit={(next) => onChange({ ...slot, [field]: next })}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** 抽屉里的一张价：一段从某个时刻起生效的价，可改可删。 */
function SegmentEditor({ segment, where, serial, active, onChange, onRemove, onDuplicate }: {
  segment: SegmentDraft
  /** 这一张的名分：「第 N 段价」——出现在每个单元格的无障碍名称里。 */
  where: string
  /** 段序（01、02…）——纯视觉的扫读列。 */
  serial: string
  active: boolean
  onChange: (next: SegmentDraft) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const base = `seg-${String(segment.id)}`
  const slotCount = segment.slots.length
  // 删除要两下：它改的是那段时间的历史金额，而账本没有撤销。聚焦离开即取消。
  const [confirming, setConfirming] = useState(false)
  // 加时段**自己把焦点搬过去**：新时段插在这颗按钮前面（详情带的 DOM 顺序是 slots → band），
  // 焦点留在按钮上的话 Tab 只会继续往右走，刚加的那一条落在身后。落点是它的第一格「输入」。
  const [pendingFocus, setPendingFocus] = useState<number | null>(null)
  useEffect(() => {
    if (pendingFocus === null) return
    document.getElementById(`slot-${String(pendingFocus)}-input`)?.focus()
    setPendingFocus(null)
  }, [pendingFocus])
  const addSlot = (): void => {
    const slot = newSlot()
    onChange({ ...segment, slots: [...segment.slots, slot] })
    setPendingFocus(slot.id)
  }
  return (
    <div className="dtpl-price-seg" data-active={active}>
      <div className="dtpl-price-seg-line">
        <span className="dtpl-price-seg-id">
          <span className="dtpl-price-seg-serial" aria-hidden="true">{serial}</span>
          {/* 每段价的第一件事是「从哪一刻起生效」——它就是这张卡的身份。 */}
          <label className="dtpl-price-seg-date" htmlFor={`${base}-from`}>
            <input
              id={`${base}-from`}
              className="dtpl-price-input dtpl-price-input-date"
              type="datetime-local"
              step={3600}
              value={fromFieldValue(segment.from)}
              aria-label={`${where}的生效时间`}
              title="生效时间精确到整点，分钟向下取到整点；点进日期或时间数字段可直接键入，方向键逐步增减；清空不生效——一段价必须有生效时刻"
              onChange={(event) => onChange(withSegmentFrom(segment, event.target.value))}
            />
          </label>
          {active && <span className="dtpl-price-badge dtpl-price-badge-live">当前生效</span>}
        </span>
        {/* 段的复制/删除挂在身份行的右轨上，常显（不只在悬停时存在）。 */}
        <span className="dtpl-price-seg-tools">
          <button type="button" className="dtpl-price-ghost" onClick={onDuplicate}>复制</button>
          <button
            type="button"
            className="dtpl-price-ghost dtpl-price-ghost-danger"
            data-confirm={confirming}
            onClick={() => {
              if (!confirming) {
                setConfirming(true)
                return
              }
              setConfirming(false)
              onRemove()
            }}
            onBlur={() => setConfirming(false)}
            title={confirming
              ? '再点一次：这一段价会被删掉，它覆盖的时间回到上一段（没有上一段就是价格未知）'
              : '删除这一段价（需再点一次确认）'}
          >
            {confirming ? '确认删除' : '删除'}
          </button>
        </span>
      </div>
      {/* 基准价行：表盘居中打头（里面那圈是基准价，外面每圈是一个峰谷时段），四档价落在盘下方，
          **不带标签也不带说明**——它是什么由下面那条分界行交代，这一行自己只摆读数。
          范围也不摆：表盘与它每一圈的悬停已经把窗口说完了。 */}
      <div className="dtpl-price-seg-allday">
        <DayDial slots={segment.slots} />
        <div className="dtpl-price-seg-allday-body">
          <div className="dtpl-price-rates dtpl-price-seg-rates">
            {CELLS.map(({ field, label }) => {
              const cell = inheritedCell(segment, null, field)
              return (
                <RateCell
                  key={field}
                  id={`${base}-${field}`}
                  label={label}
                  value={segment[field]}
                  state={fieldState(segment, field)}
                  context={`${where}的基准价`}
                  placeholder={cell.value}
                  note={cell.note}
                  onEdit={(next) => onChange({ ...segment, [field]: next })}
                />
              )
            })}
          </div>
        </div>
      </div>
      {/* 分界行：一句话说清上下是两样东西（上面那四档是基准价，下面是被它兜住的例外时段），
          同时它就是那两组之间的那道线——那句话居中，两侧的发丝线等长，所以不再另画一条横线。
          两侧的 ↑ 指着上方那四档价这一行。 */}
      <div className="dtpl-price-seg-split">
        <span className="dtpl-price-seg-split-note">
          ↑↑↑未被「峰谷时段」改写的小时都按基准价计费↑↑↑
        </span>
      </div>
      <div className="dtpl-price-seg-detail">
        {slotCount > 0 && (
          <div className="dtpl-price-slots">
            {/* 整组子目共用一条竖轨：它只在这组有子目时才有意义，且不必知道有几条。 */}
            <span className="dtpl-price-slots-spine" aria-hidden="true" />
            {segment.slots.map((slot, slotIndex) => (
              <SlotEditor
                key={slot.id}
                slot={slot}
                index={slotIndex}
                canRemove={isBlankSlot(slot) || effectiveSlots(segment).length > 1}
                segment={segment}
                onChange={(next) => onChange({ ...segment, slots: segment.slots.map(item => (item.id === slot.id ? next : item)) })}
                onRemove={() => onChange({ ...segment, slots: segment.slots.filter(item => item.id !== slot.id) })}
                onDuplicate={() => onChange({ ...segment, slots: [...segment.slots, duplicateSlot(slot)] })}
              />
            ))}
          </div>
        )}
        <div className="dtpl-price-seg-band">
          <button
            type="button"
            className="dtpl-price-add-ghost dtpl-price-add-slot"
            aria-label="添加峰谷时段"
            onClick={addSlot}
          >
            <span className="dtpl-price-add-plus" aria-hidden="true">＋</span>峰谷时段
          </button>
        </div>
      </div>
    </div>
  )
}
/** 选中模型的详情面：身份 | 计费性质 | 调价史直接铺开。
 *
 *  它是这一屏的**主体**（两个下拉在上面选谁），所以不再有折叠：段卡、时段、加段的按钮常驻。
 *  身份行是这一块唯一一行摘要——精确模型串（账本的计费键）与账本记录数都在这里；四档价在读面上
 *  有且只有一处（段卡的输入框），详情里不再复述一遍只读副本。 */
export const ModelDetail = memo(function ModelDetail({ route, row, billing, baseline, holidays, onRowChange, onBilling }: {
  route: string
  row: ModelDraft
  billing: BillingNature
  /** 上次写入时的行签名：据此推导「还没落盘」（整块的左侧墨条）。 */
  baseline: ReadonlyMap<string, string>
  /** 年历当前的放假日集合：`workdays` 时段在节假日那天不生效，行内「当前价」据此现算。 */
  holidays: ReadonlySet<string>
  onRowChange: (route: string, model: string, next: ModelDraft) => void
  onBilling: (route: string, billing: BillingNature) => void
}) {
  const dirty = modelDirty(route, row, baseline)
  const issue = rowIssue(row)
  // 此刻生效的那一段叠上此刻生效的峰谷时段——null = 这一刻没有一段在生效，轴上的「当前生效」钉就没有落点。
  const live = ratesInForce(row, holidays)
  const ordered = sortedSegments(row)
  // 有人命名该串时显示展示名，精确串跟在后面（它仍是账本的计费键，必须可达）；没人命名时它就是精确串。
  // 这个判断必须落到 DOM（data-exact），不能让样式去猜（见 styles/pricing 的 [data-exact]）。
  const named = row.name !== undefined && row.name !== '' && row.name !== row.model
  // 「没记过」是 0 的读法：账本是权威，没记过就是没记过，不是「未知」（未知的是**价**）。
  const countText = row.records > 0 ? `${String(row.records)} 次请求` : '没记过'

  // 「＋ 加一段调价」与「＋ 峰谷时段」同一条规矩：新段插在这颗按钮**前面**（它在详情带末尾），
  // 焦点不搬过去的话 Tab 只会离开这一块，而刚加的那一张落在身后。落点是它的第一格「输入」。
  const [pendingFocus, setPendingFocus] = useState<number | null>(null)
  useEffect(() => {
    if (pendingFocus === null) return
    document.getElementById(`seg-${String(pendingFocus)}-input`)?.focus()
    setPendingFocus(null)
  }, [pendingFocus])
  const addSegment = (): void => {
    const segment = newSegment()
    onRowChange(route, row.model, { ...row, segments: [...row.segments, segment] })
    setPendingFocus(segment.id)
  }

  return (
    <section className="dtpl-price-detail" data-dirty={dirty} aria-label={`${row.model} 的价格`}>
      <div className="dtpl-price-detail-head">
        <span className="dtpl-price-detail-id">
          <span className="dtpl-price-name" data-exact={!named}>{named ? row.name : row.model}</span>
          {/* 命名过才印第二遍：它说的是这个展示名对着账本里的哪个串。 */}
          {named && <span className="dtpl-price-exact" title={row.model}>{row.model}</span>}
        </span>
        <span className="dtpl-price-reqs">{countText}</span>
        {/* 计费性质是**通道**的属性，而通道名已经进了下拉，所以它跟着选中的这一条摆在详情头上当主语。 */}
        <div
          className="dtpl-price-switch"
          role="group"
          aria-label={`${route} 的计费性质`}
          title="按量 = 金额是实际支出；订阅 = 金额是按此处价格折算的订阅价值（非现金）"
        >
          <button type="button" aria-pressed={billing === 'metered'} onClick={() => onBilling(route, 'metered')}>
            按量
          </button>
          <button type="button" aria-pressed={billing === 'subscription'} onClick={() => onBilling(route, 'subscription')}>
            订阅
          </button>
        </div>
      </div>
      {/* 调价史 + 段卡 + 页脚共用一条左让位层：竖轨画在它上面，段卡的钉正好坐上去。
          身份行**不在**里面——它是这一块的头，左缘必须和上面的选择带对齐。 */}
      <div className="dtpl-price-rail">
        <PriceTimeline row={row} activeId={live === null ? null : live.segment.id} />
      {ordered.map((segment, index) => {
        const place = index + 1
        return (
          <SegmentEditor
            key={segment.id}
            segment={segment}
            where={`第 ${String(place)} 段价`}
            serial={String(place).padStart(2, '0')}
            active={live !== null && segment.id === live.segment.id}
            onChange={(next) => onRowChange(route, row.model, {
              ...row,
              segments: row.segments.map(item => (item.id === segment.id ? next : item)),
            })}
            onRemove={() => onRowChange(route, row.model, {
              ...row,
              segments: row.segments.filter(item => item.id !== segment.id),
            })}
            onDuplicate={() => onRowChange(route, row.model, {
              ...row,
              segments: [...row.segments, newSegment({
                input: segment.input,
                output: segment.output,
                cacheRead: segment.cacheRead,
                cacheWrite: segment.cacheWrite,
                slots: segment.slots.map(slot => newSlot(slot)),
              })],
            })}
          />
        )
      })}
      <div className="dtpl-price-history-foot">
        <button
          type="button"
          className="dtpl-price-add-ghost"
          aria-label="添加一段价"
          onClick={addSegment}
        >
          <span className="dtpl-price-add-plus" aria-hidden="true">＋</span>加一段价
        </button>
        <span className="dtpl-price-history-hint">
          {ordered.length === 0
            ? '还没有价：没有被任何一段价覆盖的日期按 ¥0 计（并列为价格未知）。加一段就有价了。'
            : '每段从它那一刻起生效、管到下一段开始；没有价段覆盖的日期按 ¥0 计。段卡各写各的四档（互不沿用），卡里没被峰谷时段覆盖的小时按基准价，峰谷时段只写变化的那几档。'}
        </span>
      </div>
      </div>
      {/* 行级问题报在让位层之外：它说的是这一行能不能写出去，与竖轨的让位无关。 */}
      {issue !== null && (
        <p className="dtpl-price-issue" role="alert">{row.model}:{issue}</p>
      )}
    </section>
  )
})
