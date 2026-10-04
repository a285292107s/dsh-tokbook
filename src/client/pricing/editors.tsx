/**
 * 价格表 tab 的行原语：一条 (通道, 模型) 的价编辑器与它的详情面。
 *
 * 改价一律走格里的输入框：每个 (通道, 模型) 只有一份**当前价**——四档基准价，加上
 * 叠在它上面的峰谷时段。四档全空 = 这条没有价，它的记录按 ¥0 计并列为价格未知。
 * 谁被选中由面板决定（两个下拉），所以本文件不持有选择状态——只通过小回调下发改动。
 */

import { memo, useEffect, useRef, useState } from 'react'
import { DAY_SET_HINTS, DAY_SET_LABELS, DAY_SETS, clockLabel, isHourRange, type HourRange } from '../../price-format.ts'
import type { BillingNature, DaySet, PriceCurrency } from '../../types.ts'
import { counterpartOf, unitOf, type MoneyView } from './currency.ts'
import {
  calendarYearTally, defaultCalendarYear, duplicateSlot, effectiveSlots, fieldState,
  inheritedCell, isBlankSlot, dayLabel, modelDirty, newHoliday, newSlot, priceIssue, ratesInForce,
  readHolidays, slotRange, withSlotEnd, withSlotStart,
  type CalendarDraft, type CalendarEntries, type CalendarHolidayDraft, type HolidayRead, type InForceRates, type ModelDraft,
  type RateField, type SlotDraft,
} from './draft.ts'

/** 行的四个价单元格。单位随通道报价币种——格子里的数就是文件里的数。 */
const CELLS: ReadonlyArray<{ field: RateField; label: string }> = [
  { field: 'input', label: '输入' },
  { field: 'output', label: '输出' },
  { field: 'cacheRead', label: '缓存读' },
  { field: 'cacheWrite', label: '缓存写' },
]

const START_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour)
const END_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour + 1)

/**
 * 法定节假日年历：价表里唯一**全局**的一份数据（不属于任何 route / model）。
 *
 * 它只服务一件事——把 `workdays` 时段里的法定节假日摘出去。国家每年底公布一次安排，
 * 所以这份数据按年收录；缺年告警会自己报出来并一步补上。放假日的**调休上班日**不必收录：
 * 调休只把周末变成上班，而周末无论上不上班都是闲时。
 *
 * 一年一组、**一段假期一行**，输入的形状照抄官方通知（「起 ~ 止 + 共 N 天」）——
 * 非法日期与跨年区间由控件挡住，抄错由每行后面的天数对着通知核。
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
  const [addingTouched, setAddingTouched] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [typed, setTyped] = useState<string | null>(null)
  const years = [...entries.keys()].sort((left, right) => left.localeCompare(right))
  const reads = new Map(years.map(year => [year, readHolidays(year, entries.get(year)!.holidays)]))
  const defaultYear = defaultCalendarYear(entries)
  const yearText = typed ?? defaultYear
  const kept = years.filter(year => reads.get(year)!.some(read => read.kind === 'ok'))
  const broken = years.filter(year => reads.get(year)!.some(read => read.kind === 'bad'))
  /** 缺的年份里草稿也还没有的那些：「补上」只补这一组（已经建成组的不必再来一遍）。 */
  const gaps = missingYears.filter(year => !entries.has(year))

  useEffect(() => {
    if (focusId === null) return
    document.getElementById(focusId)?.focus()
    setFocusId(null)
  }, [focusId])

  /** 年份格里的问题，或 null。清空不是问题——那一刻的读数是默认年。 */
  const addingProblem = ((): string | null => {
    const year = yearText.trim()
    if (year === '') return null
    if (!/^\d{4}$/u.test(year)) return '年份要写四位数字，例如 2027'
    if (entries.has(year)) return `${year} 年已经在上面了`
    return null
  })()

  /** 离开年份格：把清空掉的格子填回默认年——屏幕上任何时候都看得见将加的是哪一年。 */
  const leaveYear = (): void => {
    setAddingTouched(true)
    setTyped(current => (current !== null && current.trim() === '' ? null : current))
  }

  /** 加一年 = 建一组，并先给一段空假期，好让人直接开始填日期。清空 = 用默认年。 */
  const submitAdding = (): void => {
    setAddingTouched(true)
    if (addingProblem !== null) return
    const year = yearText.trim() === '' ? defaultYear : yearText.trim()
    const holiday = newHoliday()
    onChange(year, { year, holidays: [holiday] })
    setFocusId(dateFieldId(holiday, 'start'))
    setTyped(null)
    setAddingTouched(false)
  }

  /** 缺的年份一次补齐并展开：告警喊的那件事，本来就是这个动作。 */
  const fillGaps = (): void => {
    const first = gaps.length > 0 ? newHoliday() : null
    for (const year of gaps) {
      const holiday = year === gaps[0] && first !== null ? first : newHoliday()
      onChange(year, { year, holidays: [holiday] })
    }
    setExpanded(true)
    setFocusId(first === null ? null : dateFieldId(first, 'start'))
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
        <span className="dtpl-price-cal-sum">{summarizeCalendar(kept)}</span>
        {broken.length > 0 && (
          <span className="dtpl-price-cal-warn" role="status">{broken.join('、')} 年写不出来</span>
        )}
      </div>
      {missingYears.length > 0 && (
        <div className="dtpl-price-cal-miss">
          <p className="dtpl-price-cal-miss-text" role="status"
            title={`这些年的「法定工作日」时段会按周一至周五全额计，落在法定节假日的工作日被多算高峰价。补上那一年，或展开年历手动加一年。`}>
            缺 {missingYears.join('、')} 年：节假日会按高峰多算
          </p>
          {gaps.length > 0 && (
            <button type="button" className="dtpl-price-cal-fix" onClick={fillGaps}>
              <span className="dtpl-price-add-plus" aria-hidden="true">＋</span>
              {gaps.length > 2 ? `补上这 ${String(gaps.length)} 年` : `补上 ${gaps.join('、')} 年`}
            </button>
          )}
        </div>
      )}
      {expanded && (
        <div className="dtpl-price-cal-body">
          <p className="dtpl-price-cal-note">
            一年一组，一段假期一行：填开始与结束日期，含两端。只收录放假日——调休上班日落在周末，
            而周末本来就是闲时。每行后面的天数是拿来对通知里「共 N 天」的：对不上就是抄错了。
          </p>
          {years.map(year => (
            <CalendarYearGroup
              key={year}
              entry={entries.get(year)!}
              reads={reads.get(year)!}
              onChange={(next) => onChange(year, next)}
              onRemove={() => onChange(year, null)}
            />
          ))}
          <div className="dtpl-price-cal-add">
            <label className="dtpl-price-cal-year-k" htmlFor="cal-newyear">年份</label>
            <input
              id="cal-newyear"
              className="dtpl-price-input dtpl-price-cal-newyear"
              type="text"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              value={yearText}
              aria-label="要加入的年份"
              aria-invalid={(addingTouched && addingProblem !== null) || undefined}
              aria-describedby={addingTouched && addingProblem !== null ? 'cal-add-err' : undefined}
              onChange={(event) => {
                setTyped(event.target.value)
                setAddingTouched(false)
              }}
              onBlur={leaveYear}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitAdding()
              }}
            />
            <button
              type="button"
              className="dtpl-price-add-ghost"
              disabled={addingProblem !== null}
              onClick={submitAdding}
            >
              <span className="dtpl-price-add-plus" aria-hidden="true">＋</span>加一年
            </button>
            {addingTouched && addingProblem !== null && (
              <span id="cal-add-err" className="dtpl-price-cal-newyear-err" role="alert">{addingProblem}</span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function dateFieldId(holiday: CalendarHolidayDraft, side: 'start' | 'end'): string {
  return `cal-${String(holiday.id)}-${side}`
}

function CalendarYearGroup({ entry, reads, onChange, onRemove }: {
  entry: CalendarDraft
  /** 与 `entry.holidays` 一一对应的读数（重叠这类要整组才算得出的问题在里面）。 */
  reads: readonly HolidayRead[]
  onChange: (next: CalendarDraft) => void
  onRemove: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const tally = calendarYearTally(entry.year, entry.holidays)
  const [pendingFocus, setPendingFocus] = useState<CalendarHolidayDraft | null>(null)
  useEffect(() => {
    if (pendingFocus === null) return
    document.getElementById(dateFieldId(pendingFocus, 'start'))?.focus()
    setPendingFocus(null)
  }, [pendingFocus])
  const addHoliday = (): void => {
    const holiday = newHoliday()
    onChange({ ...entry, holidays: [...entry.holidays, holiday] })
    setPendingFocus(holiday)
  }
  return (
    <div className="dtpl-price-cal-year">
      <div className="dtpl-price-cal-year-head">
        <span className="dtpl-price-cal-year-num">{entry.year}</span>
        <span className="dtpl-price-cal-year-sum">
          {tally.ranges === 0
            ? '还没写（这一年仍未收录）'
            : `${String(tally.ranges)} 段假期 · 共 ${String(tally.days)} 天`}
        </span>
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
            ? `再点一次：${entry.year} 年的放假安排会被删掉，那一年退回按周一至周五全额算高峰`
            : `删掉 ${entry.year} 年（需再点一次确认）`}
        >
          {confirming ? '确认删除' : '删除这一年'}
        </button>
      </div>
      {entry.holidays.map((holiday, index) => (
        <HolidayRow
          key={holiday.id}
          year={entry.year}
          index={index}
          row={holiday}
          read={reads[index]!}
          onEdit={(next) => onChange({
            ...entry,
            holidays: entry.holidays.map(item => (item.id === holiday.id ? next : item)),
          })}
          onRemove={() => onChange({ ...entry, holidays: entry.holidays.filter(item => item.id !== holiday.id) })}
        />
      ))}
      <button type="button" className="dtpl-price-add-ghost" onClick={addHoliday}>
        <span className="dtpl-price-add-plus" aria-hidden="true">＋</span>加一段假期
      </button>
    </div>
  )
}

function HolidayRow({ year, index, row, read, onEdit, onRemove }: {
  year: string
  index: number
  row: CalendarHolidayDraft
  read: HolidayRead
  onEdit: (next: CalendarHolidayDraft) => void
  onRemove: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const where = `${year} 年第 ${String(index + 1)} 段假期`
  const startId = dateFieldId(row, 'start')
  const endId = dateFieldId(row, 'end')
  return (
    <div className="dtpl-price-cal-holiday" data-bad={read.kind === 'bad'}>
      <input
        id={startId}
        className="dtpl-price-input dtpl-price-cal-date"
        type="date"
        min={`${year}-01-01`}
        max={`${year}-12-31`}
        value={row.start}
        aria-label={`${where}的开始日期`}
        aria-invalid={read.kind === 'bad' || undefined}
        title="点进年 / 月 / 日任一段直接键入，方向键逐步增减；日期只能落在这一年里"
        onChange={(event) => onEdit({ ...row, start: event.target.value })}
      />
      <span className="dtpl-price-cal-tilde" aria-hidden="true">~</span>
      <input
        id={endId}
        className="dtpl-price-input dtpl-price-cal-date"
        type="date"
        min={`${year}-01-01`}
        max={`${year}-12-31`}
        value={row.end}
        aria-label={`${where}的结束日期`}
        aria-invalid={read.kind === 'bad' || undefined}
        title="点进年 / 月 / 日任一段直接键入，方向键逐步增减；日期只能落在这一年里"
        onChange={(event) => onEdit({ ...row, end: event.target.value })}
      />
      <span className="dtpl-price-cal-holiday-tail">
        <span className="dtpl-price-cal-days" data-kind={read.kind}>
          {read.kind === 'ok' ? `${String(read.days)} 天` : read.kind === 'partial' ? '还没填完' : ''}
        </span>
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
          title={confirming ? '再点一次：这一段假期会被删掉' : '删掉这一段假期（需再点一次确认）'}
        >
          {confirming ? '确认删除' : '删除'}
        </button>
      </span>
      {read.kind === 'bad' && <span className="dtpl-price-cell-err" role="alert">{read.error}</span>}
    </div>
  )
}

function summarizeCalendar(years: readonly string[]): string {
  if (years.length === 0) return '未收录：法定工作日按周一至周五全额算'
  return `${years.join('、')} 已收录`
}

function RateCell({ id, label, hint, value, state, context, placeholder, note, onEdit, view }: {
  id: string
  label: string
  hint?: string
  value: string
  state: 'ok' | 'empty' | 'bad'
  context: string
  /** 为空时显示的沿用鬼影（同一种货币）；缺省 = `—`（还没填）。 */
  placeholder?: string
  note?: string
  onEdit?: (next: string) => void
  /** 只用来在提示里报另一种货币的读数。 */
  view: MoneyView
}) {
  const errorId = `${id}-err`
  const message = state === 'bad' ? '须为非负数字' : undefined
  // 美元通道附上人民币读数（那是计入金额的数），人民币通道附上美元读数（只是给你看）。
  const counterpart = counterpartOf(view, value)
  const tip = state === 'bad'
    ? `${label}必须是非负数字（${unitOf(view)}）`
    : [note, counterpart].filter((text): text is string => text !== undefined && text !== null).join(' · ') || undefined
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

/** 只读的「当前生效」读数：与格子里的编辑面同源（`ratesInForce` 的折叠结果），缓存两档没单独
 *  定价时按生效的输入价计（`inheritedCell` 与宿主 `costOf` 的同一条规则）。
 *  它是纯展示——不带框、不坐刻线；改价仍然只在格子里。 */
function LiveRates({ live, records, view }: { live: InForceRates | null; records: number; view: MoneyView }) {
  const title = live === null
    ? undefined
    : live.slot === null
      ? unitOf(view)
      : `${unitOf(view)} · 此刻在峰谷时段内：${dayLabel(live.slot)}`
  const shown = (field: RateField): string => {
    if (live === null) return ''
    const own = live.values[field].trim()
    if (own !== '') return own
    if (field === 'cacheRead' || field === 'cacheWrite') return live.values.input.trim()
    return ''
  }
  return (
    <div className="dtpl-price-live" title={title} aria-label="当前生效的价">
      <span className="dtpl-price-live-k">当前生效</span>
      {live === null ? (
        // 「按 ¥0 计」是对**已有记录**说的；一条从没被调用过的模型说这句话是假的。
        <span className="dtpl-price-live-none">
          {records > 0 ? '还没有价：这些记录按 ¥0 计（价格未知）' : '还没有价：它还没有被调用过'}
        </span>
      ) : (
        <>
          {CELLS.map(({ field, label }) => {
            const text = shown(field)
            const bad = fieldState(live.values, field) === 'bad'
            return (
              <span className="dtpl-price-live-cell" key={field} data-bad={bad || undefined}>
                <span className="dtpl-price-live-label">{label}</span>
                <span className="dtpl-price-live-v">{text === '' ? '—' : text}</span>
              </span>
            )
          })}
        </>
      )}
    </div>
  )
}

/** 表盘几何按**像素尺度**固定，并小到能坐在基准价那一行的行首：
 *  圈多了盘长大，而不是把每圈压小；外圈顶到 DIAL_MAX_R 后间距自己收窄。 */
const DIAL_BASE_R = 11
const DIAL_STEP = 3
const DIAL_MAX_R = 24
const DIAL_PX_PER_UNIT = 1.25
/** 弧最粗 2 单位，零点刻钉还要探到外圈之外。 */
const DIAL_MARGIN = 2.5

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

/** 一个峰谷时段：适用星期、覆盖小时、重写的桶。它与上方的基准价行同构——行首一枚标记，
 *  四档价从标记右缘起排。
 *  零覆盖的时段与计价无关（`isBlankSlot`），整条降级并直说这一点——空着不写文件是设计，不是待办。 */
function SlotEditor({ slot, index, price, view, onChange, onRemove, onDuplicate }: {
  slot: SlotDraft
  index: number
  /** 这一行自己的基准价：留空的档从它（缓存两档再往下落到它的输入价）沿用。 */
  price: ModelDraft
  view: MoneyView
  onChange: (next: SlotDraft) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const context = `第 ${String(index + 1)} 个峰谷时段`
  const { start, end } = slotRange(slot)
  const hours = isHourRange({ start, end }) ? end - start : null
  // 删除要两下：它改的是金额，账本没有撤销。聚焦离开即取消。
  const [confirming, setConfirming] = useState(false)
  const inert = isBlankSlot(slot)
  // 这行唯一带价的时段：删掉它，这行就没有峰谷时段了，全部小时退回基准价。
  const lastPriced = !inert && effectiveSlots(price).length === 1
  return (
    <div className="dtpl-price-slot" data-inert={inert}>
      <span className="dtpl-price-slot-rail" aria-hidden="true">
        <span className="dtpl-price-slot-dot" />
      </span>
      <div className="dtpl-price-slot-card">
        <div className="dtpl-price-slot-head">
          <select
            className="dtpl-price-select dtpl-price-select-days"
            value={slot.days}
            aria-label={`${context}的适用日`}
            title={DAY_SET_HINTS[slot.days]}
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
          {hours !== null && (
            <span className="dtpl-price-slot-span" aria-hidden="true">{`· 持续 ${String(hours)} 小时`}</span>
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
              title={confirming
                ? lastPriced
                  ? '再点一次：这个时段会被删掉，这行不再有峰谷时段，全部小时按基准价计'
                  : '再点一次：这个时段会被删掉，它覆盖的小时回到基准价'
                : lastPriced
                  ? '删除这个峰谷时段：它是这行唯一带价的时段，删掉后按基准价计（需再点一次确认）'
                  : '删除这个峰谷时段（需再点一次确认）'}
            >
              {confirming ? '确认删除' : '删除'}
            </button>
          </span>
        </div>
        <div className="dtpl-price-rates dtpl-price-slot-rates">
          {CELLS.map(({ field, label }) => {
            const cell = inheritedCell(price, slot, field)
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
                view={view}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** 一条 (通道, 模型) 的价：四档基准价一行（行首是它的 24 小时表盘），下面是它的峰谷时段。
 *  四档全空 = 这条没有价，它的记录按 ¥0 计并列为价格未知。 */
function PriceEditor({ price, view, onChange }: {
  price: ModelDraft
  /** 这条通道的报价币种与汇率。 */
  view: MoneyView
  onChange: (next: ModelDraft) => void
}) {
  const slotCount = price.slots.length
  const [pendingFocus, setPendingFocus] = useState<number | null>(null)
  useEffect(() => {
    if (pendingFocus === null) return
    document.getElementById(`slot-${String(pendingFocus)}-input`)?.focus()
    setPendingFocus(null)
  }, [pendingFocus])
  const addSlot = (): void => {
    const slot = newSlot()
    onChange({ ...price, slots: [...price.slots, slot] })
    setPendingFocus(slot.id)
  }
  return (
    <>
      <div className="dtpl-price-allday">
        <div className="dtpl-price-dial-col">
          <DayDial slots={price.slots} />
        </div>
        <div className="dtpl-price-allday-body">
          <div className="dtpl-price-rates dtpl-price-base-rates">
            {CELLS.map(({ field, label }) => {
              const cell = inheritedCell(price, null, field)
              return (
                <RateCell
                  key={field}
                  id={`price-${field}`}
                  label={label}
                  value={price[field]}
                  state={fieldState(price, field)}
                  context="这条价的基准价"
                  placeholder={cell.value}
                  note={cell.note}
                  onEdit={(next) => onChange({ ...price, [field]: next })}
                  view={view}
                />
              )
            })}
          </div>
        </div>
      </div>
      <div className="dtpl-price-body">
        {slotCount > 0 && (
          <div className="dtpl-price-slots">
            <span className="dtpl-price-slots-spine" aria-hidden="true" />
            {price.slots.map((slot, slotIndex) => (
              <SlotEditor
                key={slot.id}
                slot={slot}
                index={slotIndex}
                price={price}
                view={view}
                onChange={(next) => onChange({ ...price, slots: price.slots.map(item => (item.id === slot.id ? next : item)) })}
                onRemove={() => onChange({ ...price, slots: price.slots.filter(item => item.id !== slot.id) })}
                onDuplicate={() => onChange({ ...price, slots: [...price.slots, duplicateSlot(slot)] })}
              />
            ))}
          </div>
        )}
        <div className="dtpl-price-band">
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
    </>
  )
}
/** 选中模型的详情面：身份 | 报价币种 | 计费性质 | 当前生效读数 | 这份价直接铺开。
 *
 *  它是这一屏的**主体**（两个下拉在上面选谁），所以没有折叠：四档基准价、峰谷时段、
 *  加时段的按钮常驻。身份行是这一块唯一一行摘要——精确模型串（账本的计费键）与账本
 *  记录数都在这里。此刻在效的四档价在详情头有一行只读读数（`ratesInForce`）——这一屏
 *  被读得最多的数不该等滚动；改价仍然只在格子里。 */
export const ModelDetail = memo(function ModelDetail({ route, row, billing, baseline, holidays, currency, rate, onCurrency, onRowChange, onBilling }: {
  route: string
  row: ModelDraft
  billing: BillingNature
  /** 上次写入时的行签名：据此推导「还没落盘」（整块的左侧墨条）。 */
  baseline: ReadonlyMap<string, string>
  /** 年历当前的放假日集合：`workdays` 时段在节假日那天不生效，行内「当前价」据此现算。 */
  holidays: ReadonlySet<string>
  /** 这条通道的报价币种（`$currency`）：四档价格子里的数就是它。 */
  currency: PriceCurrency
  /** 价文件的汇率；null = 未设，美元价换算不成人民币（因此也切不过去）。 */
  rate: number | null
  onCurrency: (currency: PriceCurrency) => void
  onRowChange: (route: string, model: string, next: ModelDraft) => void
  onBilling: (route: string, billing: BillingNature) => void
}) {
  const view: MoneyView = { route: currency, cnyPerUsd: rate }
  const dirty = modelDirty(route, row, baseline)
  const issue = priceIssue(row)
  const live = ratesInForce(row, holidays)
  // 这个判断必须落到 DOM（data-exact），不能让样式去猜（见 styles/pricing 的 [data-exact]）。
  const named = row.name !== undefined && row.name !== '' && row.name !== row.model
  const countText = row.records > 0 ? `${String(row.records)} 次请求` : '没记过'

  return (
    <section className="dtpl-price-detail" data-dirty={dirty} aria-label={`${row.model} 的价格`}>
      <div className="dtpl-price-detail-head">
        <span className="dtpl-price-detail-id">
          <span className="dtpl-price-name" data-exact={!named}>{named ? row.name : row.model}</span>
          {named && <span className="dtpl-price-exact" title={row.model}>{row.model}</span>}
        </span>
        <span className="dtpl-price-reqs">{countText}</span>
        <span className="dtpl-price-currency">
          <span className="dtpl-price-currency-k">报价币种</span>
          <span className="dtpl-price-switch" role="group" aria-label="报价币种">
            <button
              type="button"
              aria-pressed={currency === 'CNY'}
              title="这条通道的价按人民币记（¥/百万词元）。切过来会把现有价按汇率换算成人民币，金额不变"
              onClick={() => onCurrency('CNY')}
            >
              ¥
            </button>
            <button
              type="button"
              aria-pressed={currency === 'USD'}
              disabled={rate === null}
              title={rate === null
                ? '先在上面那格填汇率（1 美元 = ? 元）：美元报价的价没有汇率就算不成人民币'
                : `按美元记这条通道的价（$/百万词元）：现有价按 1 美元 = ${String(rate)} 元换算成美元，人民币金额不变`}
              onClick={() => onCurrency('USD')}
            >
              $
            </button>
          </span>
        </span>
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
      <LiveRates live={live} records={row.records} view={view} />
      <PriceEditor price={row} view={view} onChange={(next) => onRowChange(route, row.model, next)} />
      <p className="dtpl-price-note">
        {live !== null
          ? '留空 = 沿用基准价；没被峰谷时段覆盖的小时按基准价计。清空四档 = 删掉这条价。'
          : row.records > 0
            ? '四档价全空 = 这条没有价：它的记录按 ¥0 计，并列为价格未知。'
            : '四档价全空 = 这条没有价。它还没被调用过，所以没有金额受影响。'}
      </p>
      {issue !== null && (
        <p className="dtpl-price-issue" role="alert">{row.model}:{issue}</p>
      )}
    </section>
  )
})
