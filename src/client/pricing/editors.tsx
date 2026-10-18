/**
 * 价格表 tab 的行原语：一条 (通道, 模型) 的价编辑器与它的详情面。
 *
 * 改价一律走格里的输入框：每个 (通道, 模型) 只有一份**当前价**——四档基准价，加上
 * 叠在它上面的峰谷时段。四档全空 = 这条没有价，它的记录按 ¥0 计并列为价格未知。
 * 谁被选中由面板决定（两个下拉），所以本文件不持有选择状态——只通过小回调下发改动。
 */

import { memo, useEffect, useState } from 'react'
import { DAY_SET_HINTS, DAY_SET_LABELS, DAY_SETS, clockLabel, isHourRange } from '../../price-format.ts'
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

/** 24 小时条的格子与刻度。刻度只标 0/6/12/18/24 五处——24 格各标一次在窄处必然互相压字，
 *  而那五处已经够读出「这一段落在一天里的哪儿」。 */
const HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour)
const HOUR_TICKS: readonly number[] = [0, 6, 12, 18, 24]

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
export function CalendarEditor({ entries, missingYears, dirty, expanded, onExpandedChange, onChange }: {
  entries: CalendarEntries
  /** 账本覆盖到、而这里没有的年份（host 算好的）。 */
  missingYears: readonly string[]
  /** 年历是否还没落盘。 */
  dirty: boolean
  /** 展开与否由调用处持有：这一屏顶部的缺年告警要能把年历打开（它说的就是这里的事）。 */
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  /** 改一年；`null` = 删掉那一年。 */
  onChange: (year: string, next: CalendarDraft | null) => void
}) {
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
    onExpandedChange(true)
    setFocusId(first === null ? null : dateFieldId(first, 'start'))
  }

  return (
    <section className="dtpl-price-cal" id="price-calendar" data-dirty={dirty} data-open={expanded} aria-label="法定节假日年历">
      {/* 头 = 一整条按钮：它既是这一节的名字，也是它的开关。所以给它按钮该有的样子——
          闭合的边、悬停洗色、右端那枚朝向随开合翻转的三角，以及一句「展开 / 收起」。
          这一屏其余的行都是「被读的内容」，只有这一条是「能按的东西」。
          缺年的「补上」是这条带子上的**次要动作**，与开关同高并排，不另起一行。 */}
      <div className="dtpl-price-cal-head">
        <button
          type="button"
          className="dtpl-price-cal-toggle"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
        >
          <span className="dtpl-price-cal-caret" aria-hidden="true" />
          <span className="dtpl-price-cal-title">法定节假日年历</span>
          <span className="dtpl-price-cal-sum">{summarizeCalendar(kept)}</span>
          {broken.length > 0 && (
            <span className="dtpl-price-cal-warn">{broken.join('、')} 年写不出来</span>
          )}
          <span className="dtpl-price-cal-hint" aria-hidden="true">{expanded ? '收起' : '展开'}</span>
        </button>
        {/* 缺年这件事由这一屏顶部的告警**说一遍**（那里离眼睛更近），这里只留动作：
            说两遍同一句话会把一个提醒读成一串噪音。 */}
        {missingYears.length > 0 && gaps.length > 0 && (
          <button type="button" className="dtpl-price-cal-fix" onClick={fillGaps}
            title={`这些年的「法定工作日」时段会按周一至周五全额计，落在法定节假日的工作日被多算高峰价。补上那一年，或展开年历手动加一年。`}>
            <span className="dtpl-price-add-plus" aria-hidden="true">＋</span>
            {gaps.length > 2 ? `补上缺的 ${String(gaps.length)} 年` : `补上 ${gaps.join('、')} 年`}
          </button>
        )}
      </div>
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

/** 一格价。桌面上的格名由 `.dtpl-price-cols` 那行**共用的**列头给（四档重复三遍只会让
 *  这份表读起来像三个表单），所以格名本身只在窄屏出现——那里 2×2 折行，列头不再指向任何一列。 */
function RateCell({ id, label, value, state, context, placeholder, note, onEdit, view }: {
  id: string
  label: string
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
      <label className="dtpl-price-cell-k" htmlFor={id}>{label}</label>
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

/** 这一屏的**主读数**：此刻正在计费的价。读者打开这一屏要知道的是「我现在按多少钱在花」，
 *  而不是「有哪些格子可以填」——所以它在价之上，四档并排、走 24px。
 *
 *  它报的常常与下面第一行一样（没有时段在生效时就是基准价），那**不是**冗余：这两行说的
 *  是两件事——这一行说「此刻计费的是谁」，那一行说「你写进文件的是什么」。有峰谷时段生效
 *  时两者不同，这个读数就是唯一说得出差别的地方，所以它必须在场、而不是被折叠掉。
 *  数值与格子同源（`ratesInForce` 的折叠结果），缓存两档没单独定价时按生效的输入价计
 *  （`inheritedCell` 与宿主 `costOf` 的同一条规则）。它是纯展示：改价仍然只在下面的表里。 */
function LiveRates({ live, records, view }: { live: InForceRates | null; records: number; view: MoneyView }) {
  // 留空的档落到别处取值这件事，只有在这个读数里说得清：它报的是**正在计费**的数。
  const shown = (field: RateField): string => {
    if (live === null) return ''
    const own = live.values[field].trim()
    if (own !== '') return own
    if (field === 'cacheRead' || field === 'cacheWrite') return live.values.input.trim()
    return ''
  }
  return (
    <div className="dtpl-price-live" aria-label="此刻计费的价">
      <div className="dtpl-price-live-head">
        <span className="dtpl-price-live-k">此刻计费</span>
        <span className="dtpl-price-live-unit">{unitOf(view)}</span>
      </div>
      {live === null ? (
        // 「按 ¥0 计」是对**已有记录**说的；一条从没被调用过的模型说这句话是假的。
        <p className="dtpl-price-live-none">
          {records > 0 ? '还没有价：这些记录按 ¥0 计（价格未知）' : '还没有价：它还没有被调用过'}
        </p>
      ) : (
        <>
          <div className="dtpl-price-live-cells">
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
          </div>
          <p className="dtpl-price-live-note">
            {live.slot === null
              ? '按基准价计：没有峰谷时段正在生效'
              : `正在按峰谷时段「${dayLabel(live.slot)}」计`}
          </p>
        </>
      )}
    </div>
  )
}

/** 24 小时上谁在生效：基准价一行铺满（它是**默认**，所以走淡轨），每个**带价的**峰谷时段
 *  各占一行、只把它覆盖的小时点成实心墨。
 *  文字标签说不出「这一天还剩哪几小时没被覆盖」——这条说得出来。
 *  零覆盖的时段不画（`effectiveSlots`）：它们不改写任何档，画出来只会显得有洞。 */
function DayBand({ price }: { price: ModelDraft }) {
  const slots = effectiveSlots(price).map(slot => {
    const { start, end } = slotRange(slot)
    const ok = isHourRange({ start, end })
    return { id: slot.id, label: dayLabel(slot), start: ok ? start : 0, end: ok ? end : 0 }
  })
  // 没成段的时段在表里已经红着报错，这里不画灯。
  const drawn = slots.filter(row => row.end > row.start)
  return (
    <div
      className="dtpl-price-day"
      role="img"
      aria-label={`24 小时生效范围：基准价铺满全天${drawn.length === 0 ? '' : `；${drawn.map(row => `${row.label} 覆盖 ${String(row.start)}–${String(row.end)} 点`).join('；')}`}`}
    >
      <div className="dtpl-price-day-row">
        <span className="dtpl-price-day-k">基准价</span>
        <span className="dtpl-price-day-cells" aria-hidden="true">
          {HOURS.map(hour => <span className="dtpl-price-day-cell" key={hour} data-on="base" />)}
        </span>
      </div>
      {drawn.map(row => (
        <div className="dtpl-price-day-row" key={row.id}>
          <span className="dtpl-price-day-k">{row.label}</span>
          <span className="dtpl-price-day-cells" aria-hidden="true">
            {HOURS.map(hour => (
              <span className="dtpl-price-day-cell" key={hour} data-on={hour >= row.start && hour < row.end ? 'slot' : undefined} />
            ))}
          </span>
        </div>
      ))}
      <div className="dtpl-price-day-row" aria-hidden="true">
        <span className="dtpl-price-day-k" />
        <span className="dtpl-price-day-axis">
          {HOUR_TICKS.map(hour => <span key={hour}>{String(hour).padStart(2, '0')}</span>)}
        </span>
      </div>
    </div>
  )
}

/** 一行读数（基准价或一个峰谷时段）：左边的生效范围，右边四档价。
 *  零覆盖的时段与计价无关（`isBlankSlot`），整行降级并直说这一点——空着不写文件是设计，不是待办。 */
function PriceRow({ slot, index, price, view, onChange, onRemove, onDuplicate }: {
  /** `null` = 基准价那一行（它没有峰谷时段的那些控件）。 */
  slot: SlotDraft | null
  index: number
  /** 这一行自己的基准价：留空的档从它（缓存两档再往下落到它的输入价）沿用。 */
  price: ModelDraft
  view: MoneyView
  /** 整份价的新值：这一行只改自己那一段，替换由它交给调用处（基准价行改的是顶层四档）。 */
  onChange: (next: ModelDraft) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const context = slot === null ? '这条价的基准价' : `第 ${String(index + 1)} 个峰谷时段`
  // 删除要两下：它改的是金额，账本没有撤销。聚焦离开即取消。
  const [confirming, setConfirming] = useState(false)
  const inert = slot !== null && isBlankSlot(slot)
  const hours = slot === null ? null : (() => {
    const range = slotRange(slot)
    return isHourRange(range) ? range.end - range.start : null
  })()
  // 这一行唯一带价的时段：删掉它，这行就没有峰谷时段了，全部小时退回基准价。
  const lastPriced = slot !== null && !inert && effectiveSlots(price).length === 1
  /** 改这一行的某个字段。基准价行改的是顶层四档，时段行只换回自己那一段。 */
  const edit = (field: RateField, text: string): void => {
    if (slot === null) {
      onChange({ ...price, [field]: text })
      return
    }
    replaceSlot({ ...slot, [field]: text })
  }
  /** 换掉自己那一段（时段行的钟点、日档与四档都走这一条）。 */
  const replaceSlot = (next: SlotDraft): void => {
    onChange({ ...price, slots: price.slots.map(item => (item.id === next.id ? next : item)) })
  }

  return (
    <div className="dtpl-price-row" data-inert={inert || undefined}>
      <div className="dtpl-price-scope">
        {slot === null ? (
          <>
            <span className="dtpl-price-scope-k">基准价</span>
            <span className="dtpl-price-scope-sub">全周 · 全天，峰谷时段之外都按它计</span>
          </>
        ) : (
          <>
            <span className="dtpl-price-scope-ctl">
              <select
                className="dtpl-price-select dtpl-price-select-days"
                value={slot.days}
                aria-label={`${context}的适用日`}
                title={DAY_SET_HINTS[slot.days]}
                onChange={(event) => replaceSlot({ ...slot, days: event.target.value as DaySet })}
              >
                {DAY_SETS.map(days => <option key={days} value={days}>{DAY_SET_LABELS[days]}</option>)}
              </select>
              <select
                className="dtpl-price-select dtpl-price-select-hour"
                value={slot.start}
                aria-label={`${context}的开始时间`}
                onChange={(event) => replaceSlot(withSlotStart(slot, event.target.value))}
              >
                {START_HOURS.map(hour => <option key={hour} value={String(hour)}>{clockLabel(hour)}</option>)}
              </select>
              <span className="dtpl-price-scope-dash" aria-hidden="true">–</span>
              <select
                className="dtpl-price-select dtpl-price-select-hour"
                value={slot.end}
                aria-label={`${context}的结束时间`}
                onChange={(event) => replaceSlot(withSlotEnd(slot, event.target.value))}
              >
                {END_HOURS.map(hour => <option key={hour} value={String(hour)}>{clockLabel(hour)}</option>)}
              </select>
            </span>
            <span className="dtpl-price-scope-foot">
              <span className="dtpl-price-scope-sub">
                {inert ? '不改写任何档，不影响计价' : hours === null ? '时段还没成段' : `持续 ${String(hours)} 小时`}
              </span>
              <span className="dtpl-price-rowacts">
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
            </span>
          </>
        )}
      </div>
      {CELLS.map(({ field, label }) => {
        const cell = inheritedCell(price, slot, field)
        return (
          <RateCell
            key={field}
            id={slot === null ? `price-${field}` : `slot-${String(slot.id)}-${field}`}
            label={label}
            value={slot === null ? price[field] : slot[field]}
            state={fieldState(slot === null ? price : slot, field)}
            context={context}
            placeholder={cell.value}
            note={cell.note}
            onEdit={(next) => edit(field, next)}
            view={view}
          />
        )
      })}
    </div>
  )
}

/** 四档价是一张**表**：列头只写一遍，基准价与每个峰谷时段各占一行。
 *  格名重复三遍会让三个生效范围读成三张互不相干的表单，而它们其实是同一个人的同一份价。 */
function PriceTable({ price, view, onChange }: {
  price: ModelDraft
  /** 这条通道的报价币种与汇率。 */
  view: MoneyView
  onChange: (next: ModelDraft) => void
}) {
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
      <div className="dtpl-price-tbl">
        <div className="dtpl-price-cols">
          <span className="dtpl-price-cols-k">生效范围</span>
          {CELLS.map(({ field, label }) => <span className="dtpl-price-cols-n" key={field}>{label}</span>)}
        </div>
        <div className="dtpl-price-rows">
          <PriceRow
            slot={null}
            index={0}
            price={price}
            view={view}
            onChange={onChange}
            onRemove={() => undefined}
            onDuplicate={() => undefined}
          />
          {price.slots.map((slot, slotIndex) => (
            <PriceRow
              key={slot.id}
              slot={slot}
              index={slotIndex}
              price={price}
              view={view}
              onChange={onChange}
              onRemove={() => onChange({ ...price, slots: price.slots.filter(item => item.id !== slot.id) })}
              onDuplicate={() => onChange({ ...price, slots: [...price.slots, duplicateSlot(slot)] })}
            />
          ))}
        </div>
      </div>
      <div className="dtpl-price-addrow">
        <button
          type="button"
          className="dtpl-price-add-ghost dtpl-price-add-slot"
          aria-label="添加峰谷时段"
          onClick={addSlot}
        >
          <span className="dtpl-price-add-plus" aria-hidden="true">＋</span>峰谷时段
        </button>
      </div>
      {effectiveSlots(price).length > 0 && <DayBand price={price} />}
    </>
  )
}

/** 选中模型的详情面：身份 | 报价币种 | 计费性质 | 此刻计费的价 | 这份价的表。
 *
 *  它是这一屏的**主体**（两个下拉在上面选谁），所以没有折叠：四档基准价、峰谷时段、
 *  加时段的按钮常驻。身份行是这一块唯一一行摘要——精确模型串（账本的计费键）与账本
 *  记录数都在这里。 */
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
      <PriceTable price={row} view={view} onChange={(next) => onRowChange(route, row.model, next)} />
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
