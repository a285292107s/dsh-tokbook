/**
 * 价格表 tab 的行原语：价格段编辑器与选中模型的详情面。
 *
 * 改价一律走段卡里的输入框：每一张都是一段从某个时刻起生效的价，段与段互不沿用，
 * 没有被任何段覆盖的日期按 ¥0 计。谁被选中由面板决定（两个下拉），
 * 所以本文件不持有选择状态——只通过小回调下发改动。
 *
 * 四档价的真源是**这条通道报价币种下的文本**（`$currency`，缺席 = 人民币）：格子显示什么、
 * 你敲进去就存什么；另一种货币的读数只挂在悬停提示里（见 `./currency.ts`）。
 */

import { memo, useEffect, useRef, useState } from 'react'
import { DAY_SET_LABELS, DAY_SETS, clockLabel, isHourRange, type HourRange } from '../../price-format.ts'
import type { BillingNature, DaySet, PriceCurrency } from '../../types.ts'
import { counterpartOf, unitOf, type MoneyView } from './currency.ts'
import {
  calendarYearTally, defaultCalendarYear, duplicateSlot, effectiveSlots, fieldState, fromFieldValue,
  inheritedCell, isBlankSlot, dayLabel, modelDirty, newHoliday, newSegment, newSlot, ratesInForce,
  readHolidays, rowIssue, slotRange, sortedSegments, withSegmentFrom, withSlotEnd, withSlotStart,
  type CalendarDraft, type CalendarEntries, type CalendarHolidayDraft, type HolidayRead, type ModelDraft,
  type RateField, type SegmentDraft, type SlotDraft,
} from './draft.ts'
import { PriceTimeline } from './Timeline.tsx'

/** 行的四个价单元格，按所有 surface 的书写顺序（列头 / 行内只读价 / 抽屉里的输入框）。
 *  单位随通道报价币种：¥/百万词元 或 $/百万词元——格子里的数就是文件里的数。 */
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
 * 所以这份数据按年收录；账本覆盖到、而这里没有的年份会自己报出来，并且**一步就能补上**
 * （告警上那颗按钮把缺的年份连第一段假期一起建好，焦点落在那段的开始日期上）。补它是这套
 * 设计里唯一要人记得做的事，不该还要人先想明白该怎么加。放假日的**调休上班日**不必收录：
 * 调休只把周末变成上班，而周末无论上不上班都是闲时。
 *
 * 一年一组，**一段假期一行**：开始与结束两个日期控件。官方通知的每一条本来就是「起 ~ 止 +
 * 共 N 天」，输入的形状照抄通知——不必先把中文翻译成某种文本格式，也写不出非法日期或跨年的
 * 区间（那是控件的事）。控件管不到的是**抄错**（`02-16` 写成 `02-15`），那由每行后面的天数管：
 * 对着通知的「共 N 天」一条一条核。还没写完的（整组没填 / 只填了一头）是占位：不落盘，
 * 也不挡住别的编辑（见 `composeCalendar`）。
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
  /** 加入年份那一格有没有被交代过（失焦 / 回车）：打字途中不报「年份要写四位数字」。 */
  const [addingTouched, setAddingTouched] = useState(false)
  /** 下一次渲染完成后要把焦点搬过去的元素 id（新加的那一段的开始日期）。 */
  const [focusId, setFocusId] = useState<string | null>(null)
  /** 用户在年份格里改过的文本；`null` = 没改过，格子显示默认年。 */
  const [typed, setTyped] = useState<string | null>(null)
  const years = [...entries.keys()].sort((left, right) => left.localeCompare(right))
  const reads = new Map(years.map(year => [year, readHolidays(year, entries.get(year)!.holidays)]))
  /** 不填年份时要加的那一年（今年 / 下一年，见 `defaultCalendarYear`）。 */
  const defaultYear = defaultCalendarYear(entries)
  /** 格子里是**用户改过的**，否则是默认年（今年 / 下一年，见 `defaultCalendarYear`）。
   *
   *  默认年住在格子里——它就是这个格子的值（将要被加入的那一年）。把它挪到别处（占位符、
   *  按钮标签）就会和一个空着的格子对不上：格子空着、别处却在说 2027，读起来自相矛盾，
   *  而且会让这个输入框看起来只是个摆设。清空格子仍然算「用默认年」（见 `submitAdding`），
   *  离开时再把它填回去，于是屏幕上任何时候都看得见将加的是哪一年。 */
  const yearText = typed ?? defaultYear
  /** 摘要说的是**写进文件**的那几年：写不出来的年与还没写的年都不算收录，
   *  否则头里会同时出现「2025 已收录」和「2025 年写不出来」。 */
  const kept = years.filter(year => reads.get(year)!.some(read => read.kind === 'ok'))
  const broken = years.filter(year => reads.get(year)!.some(read => read.kind === 'bad'))
  /** 缺的年份里草稿也还没有的那些：「补上」只补这一组（已经建成组的不必再来一遍）。 */
  const gaps = missingYears.filter(year => !entries.has(year))

  // 新加的一段**自己把焦点搬过去**：焦点留在原处的话，刚加的那一段落在身后
  // （与详情带里那两条「＋」同一条规矩）。
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
      // 每个缺年都建一组，并各带一段空假期；补完第一组的开始日期上就等着光标。
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
        {/* 年报在**头**里说，因为收起时下面那些原因看不到；哪一年、为什么，展开就有。 */}
        {broken.length > 0 && (
          <span className="dtpl-price-cal-warn" role="status">{broken.join('、')} 年写不出来</span>
        )}
      </div>
      {missingYears.length > 0 && (
        <div className="dtpl-price-cal-miss">
          <p className="dtpl-price-cal-miss-text" role="status">
            年历缺 {missingYears.join('、')} 年：这些年的「工作日（不含节假日）」会按周一至周五全额计，
            落在法定节假日的工作日会被多算高峰价。
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
            {/* 默认年就坐在格子里（见 `yearText`）：它是要被加入的那一年，所以别的任何地方都不必
                再替它说话——占位符里写它、按钮标签里报它，都会跟一个空着的格子对不上。
                只有清空的那一刻例外：那算「用默认年」，离开格子时它自己填回来。 */}
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

/** 一段假期两个日期格的 DOM id（加完一段要按它搬焦点）。 */
function dateFieldId(holiday: CalendarHolidayDraft, side: 'start' | 'end'): string {
  return `cal-${String(holiday.id)}-${side}`
}

/** 年历里的一年：组头（年份 + 几段几天 + 删除这一年），下面一段假期一行。 */
function CalendarYearGroup({ entry, reads, onChange, onRemove }: {
  entry: CalendarDraft
  /** 与 `entry.holidays` 一一对应的读数（重叠这类要整组才算得出的问题在里面）。 */
  reads: readonly HolidayRead[]
  onChange: (next: CalendarDraft) => void
  onRemove: () => void
}) {
  // 删除要两下：它抹掉的是一整年的放假安排，而账本没有撤销（与段卡的删除同一条规矩）。
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

/** 一段假期：开始日期 ~ 结束日期，加这一段的读数——几天。 */
function HolidayRow({ year, index, row, read, onEdit, onRemove }: {
  year: string
  index: number
  row: CalendarHolidayDraft
  read: HolidayRead
  onEdit: (next: CalendarHolidayDraft) => void
  onRemove: () => void
}) {
  // 删除要两下：账本没有撤销（与段卡的删除同一条规矩）。
  const [confirming, setConfirming] = useState(false)
  const where = `${year} 年第 ${String(index + 1)} 段假期`
  const startId = dateFieldId(row, 'start')
  const endId = dateFieldId(row, 'end')
  return (
    <div className="dtpl-price-cal-holiday" data-bad={read.kind === 'bad'}>
      {/* 两个日期格都是原生控件：值只可能是空或一个真实日期，写不出非法日期。min/max 把这一年
          之外的日子挡在控件上。原生日历按钮收掉——与段卡的生效时刻同一条规矩（全窗口唯一一个
          浏览器画的按钮会跟这套语言打架），键入与方向键路径写进 title。 */}
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

/** 收起时那行摘要：**写进文件的**是那几年。 */
function summarizeCalendar(years: readonly string[]): string {
  if (years.length === 0) return '未收录：工作日按周一至周五全额算'
  return `${years.join('、')} 已收录`
}

/**
 * 抽屉里的一个数字单元格，原地编辑。
 *
 * `value` 是这条通道**报价币种下的文本**（草稿里唯一的真源）：显示什么就存什么，
 * 不做任何换算——换过来看的那一眼挂在悬停提示里（`counterpartOf`）。所以这一格没有
 * 输入缓冲，也没有「敲美元落人民币」那一层不对称。
 */
function RateCell({ id, label, hint, value, state, context, placeholder, note, onEdit, view }: {
  id: string
  label: string
  /** 该单元格所属的静态表头（无障碍用）。 */
  hint?: string
  /** 草稿里这条通道报价币种下的文本。 */
  value: string
  state: 'ok' | 'empty' | 'bad'
  context: string
  /** 单元格为空时显示的那个数（沿用来的鬼影，同一种货币）；缺省 = `—`，即这一档还没填。 */
  placeholder?: string
  /** 悬停时解释此上下文中空单元格的含义。 */
  note?: string
  onEdit?: (next: string) => void
  /** 这条通道的报价币种与汇率——只用来在提示里报另一种货币的读数。 */
  view: MoneyView
}) {
  const errorId = `${id}-err`
  // 可见消息要短（不撑窄 rate 列）；完整句子挂在 title，行下方的问题行重复第一个问题。
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
function SlotEditor({ slot, index, canRemove, segment, view, onChange, onRemove, onDuplicate }: {
  slot: SlotDraft
  index: number
  /** 是否可删除（未完成的草稿永远可以；最后一个有价时段不行，否则会悄悄丢掉那个窗口）。 */
  canRemove: boolean
  /** 这一个时段所在的那一段：留空的档从它（缓存两档再往下落到它的输入价）沿用。 */
  segment: SegmentDraft
  /** 这条通道的报价币种与汇率。 */
  view: MoneyView
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
                view={view}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** 抽屉里的一张价：一段从某个时刻起生效的价，可改可删。 */
function SegmentEditor({ segment, where, serial, active, view, onChange, onRemove, onDuplicate }: {
  segment: SegmentDraft
  /** 这一张的名分：「第 N 段价」——出现在每个单元格的无障碍名称里。 */
  where: string
  /** 段序（01、02…）——纯视觉的扫读列。 */
  serial: string
  active: boolean
  /** 这条通道的报价币种与汇率。 */
  view: MoneyView
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
                  view={view}
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
                view={view}
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
/** 选中模型的详情面：身份 | 报价币种 | 计费性质 | 调价史直接铺开。
 *
 *  它是这一屏的**主体**（两个下拉在上面选谁），所以不再有折叠：段卡、时段、加段的按钮常驻。
 *  身份行是这一块唯一一行摘要——精确模型串（账本的计费键）与账本记录数都在这里；四档价在读面上
 *  有且只有一处（段卡的输入框），详情里不再复述一遍只读副本。 */
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
        {/* 报价币种 = **这条通道的价用哪种货币记**（`$currency`），所以和「按量 / 订阅」一样
            是这一条的主语，摆在同一个右轨上。切过去会按汇率把**已有**的价换算成另一种货币
            （人民币金额不变），那是一次真正的改价；没有汇率就换算不出来，故停用。 */}
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
            view={view}
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
