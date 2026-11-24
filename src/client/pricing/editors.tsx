import { memo, useEffect, useState } from 'react'
import { DAY_SET_HINTS, DAY_SET_LABELS, DAY_SETS, clockLabel, holidayDates, isHourRange } from '../../price-format.ts'
import type { BillingNature, DaySet, HolidaySyncView, PriceCurrency } from '../../types.ts'
import { counterpartOf, unitOf, type MoneyView } from './currency.ts'
import {
  calendarYearTally, duplicateSlot, effectiveSlots, fieldState,
  inheritedCell, isBlankSlot, dayLabel, missingYearDrafts, modelDirty, newHoliday, newSlot,
  priceIssue, ratesInForce,
  readHolidays, slotRange, withSlotEnd, withSlotStart,
  type CalendarDraft, type CalendarEntries, type CalendarHolidayDraft, type HolidayRead, type InForceRates, type ModelDraft,
  type RateField, type SlotDraft,
} from './draft.ts'

const CELLS: ReadonlyArray<{ field: RateField; label: string }> = [
  { field: 'input', label: '输入' },
  { field: 'output', label: '输出' },
  { field: 'cacheRead', label: '缓存读' },
  { field: 'cacheWrite', label: '缓存写' },
]

const START_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour)
const END_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour + 1)

const HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour)
const HOUR_TICKS: readonly number[] = [0, 6, 12, 18, 24]

const WEEK_LABELS: readonly string[] = ['一', '二', '三', '四', '五', '六', '日']

interface CalendarDay {
  key: string
  day: number
  weekend: boolean
  holiday: boolean
  blank: boolean
}

function monthDays(year: number, month: number, holidays: ReadonlySet<string>): CalendarDay[] {
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const total = new Date(year, month, 0).getDate()
  const cells: CalendarDay[] = []
  for (let index = 0; index < offset; index += 1) {
    cells.push({ key: `b-${month}-${index}`, day: 0, weekend: false, holiday: false, blank: true })
  }
  for (let day = 1; day <= total; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const weekday = (new Date(year, month - 1, day).getDay() + 6) % 7
    cells.push({ key, day, weekend: weekday >= 5, holiday: holidays.has(key), blank: false })
  }
  return cells
}

function HolidayCalendar({ year, holidays, pickStart, hoverDate, onPick, onHover }: {
  year: string
  holidays: ReadonlySet<string>
  pickStart: string | null
  hoverDate: string | null
  onPick: (date: string) => void
  onHover: (date: string | null) => void
}) {
  const yearNum = Number(year)
  const months = Array.from({ length: 12 }, (_, index) => index + 1)
  const previewFrom = pickStart === null || hoverDate === null ? null : pickStart <= hoverDate ? pickStart : hoverDate
  const previewTo = previewFrom === null ? null : pickStart! <= hoverDate! ? hoverDate : pickStart
  return (
    <div className="dtpl-cal-grid" role="group" aria-label={`${year} 年节假日日历：点一天选开始，再点一天选结束`} onMouseLeave={() => onHover(null)}>
      {months.map(month => (
        <div className="dtpl-cal-month" key={month}>
          <div className="dtpl-cal-month-name">{month} 月</div>
          <div className="dtpl-cal-weekheads" aria-hidden="true">
            {WEEK_LABELS.map((label, index) => <span key={label} data-weekend={index >= 5 || undefined}>{label}</span>)}
          </div>
          <div className="dtpl-cal-days">
            {monthDays(yearNum, month, holidays).map(cell => cell.blank
              ? <span className="dtpl-cal-day is-blank" key={cell.key} aria-hidden="true" />
              : (
                <button
                  type="button"
                  className="dtpl-cal-day"
                  key={cell.key}
                  data-holiday={cell.holiday || undefined}
                  data-weekend={!cell.holiday && cell.weekend || undefined}
                  data-preview={previewFrom !== null && cell.key >= previewFrom && cell.key <= previewTo! || undefined}
                  data-pick={pickStart === cell.key || undefined}
                  aria-label={`${cell.key}${cell.holiday ? ' 法定节假日' : cell.weekend ? ' 周末' : ''}${pickStart === cell.key ? '，已选为开始' : ''}`}
                  title={`${cell.key}${cell.holiday ? ' 法定节假日' : cell.weekend ? ' 周末' : ''}`}
                  onClick={() => onPick(cell.key)}
                  onMouseEnter={() => onHover(cell.key)}
                  onFocus={() => onHover(cell.key)}
                >
                  <span className="dtpl-cal-day-num">{cell.day}</span>
                  <span className="dtpl-cal-day-mark" aria-hidden="true">{cell.holiday ? '假' : cell.weekend ? '休' : ''}</span>
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}


export function CalendarEditor({ entries, missingYears, autoYears, dirty, sync, syncing, onChange, className }: {
  entries: CalendarEntries
  missingYears: readonly string[]
  autoYears?: readonly string[]
  dirty: boolean
  onChange: (year: string, next: CalendarDraft | null) => void
  sync?: HolidaySyncView
  syncing?: boolean
  className?: string
}) {
  const entryOf = (year: string): CalendarDraft => entries.get(year) ?? { year, holidays: [] }
  const years = entries.size > 0
    ? [...entries.keys()].sort((left, right) => left.localeCompare(right))
    : [String(new Date().getFullYear())]
  const reads = new Map(years.map(year => [year, readHolidays(year, entryOf(year).holidays)]))
  const kept = years.filter(year => reads.get(year)!.some(read => read.kind === 'ok'))
  const broken = years.filter(year => reads.get(year)!.some(read => read.kind === 'bad'))
  const gaps = missingYears.filter(year => !entries.has(year))

  const fillGaps = (): void => {
    const drafts = missingYearDrafts(entries, gaps)
    for (const draft of drafts) onChange(draft.year, draft)
  }

  const autoLine = describeAutoSync(sync, syncing === true)

  return (
    <section className={`dtpl-price-cal ${className ?? ''}`} id="price-calendar" data-dirty={dirty} aria-label="法定节假日年历">
      <div className="dtpl-price-cal-head-row">
        <span className="dtpl-price-cal-title">法定节假日年历</span>
        <span className="dtpl-price-cal-sum">{summarizeCalendar(kept)}</span>
        {autoYears !== undefined && autoYears.length > 0 && (
          <span
            className="dtpl-price-cal-auto"
            title="这些年份没写在 pricing.json 里，是从 holiday-cn 自动拉来并缓存到本机的；手写有那一年时以手写的为准。"
          >
            {autoYears.join('、')} 自动
          </span>
        )}
        {broken.length > 0 && (
          <span className="dtpl-price-cal-warn">{broken.join('、')} 年写不出来</span>
        )}
        {missingYears.length > 0 && gaps.length > 0 && (
          <button type="button" className="dtpl-price-cal-fix" onClick={fillGaps}
            title="这些年的「法定工作日」时段会按周一至周五全额计，落在法定节假日的工作日被多算高峰价。点这里把那几年加进年历，再用日历圈出假期。">
            <span className="dtpl-price-add-plus" aria-hidden="true">＋</span>
            {gaps.length > 2 ? `补上缺的 ${String(gaps.length)} 年` : `补上 ${gaps.join('、')} 年`}
          </button>
        )}
      </div>
      {autoLine !== null && (
        <p className="dtpl-price-cal-auto-line" data-tone={autoLine.tone}>{autoLine.text}</p>
      )}
      <div className="dtpl-price-cal-body">
        <p className="dtpl-price-cal-note">
          一年一组，一段假期一行。点日历上的开始日和结束日就能加一段假期——年份由这一组决定，不用填。
          只收录放假日（调休上班日落在周末，而周末本来就是闲时）；天数要能对上通知里「共 N 天」。
          标着<b>「自动」</b>的年份是从 holiday-cn 拉来缓存的，你手写过哪一年，哪一年就以你的为准。
        </p>
        {years.map(year => (
          <CalendarYearGroup
            key={year}
            entry={entryOf(year)}
            reads={reads.get(year)!}
            onChange={(next) => onChange(year, next)}
          />
        ))}
      </div>
    </section>
  )
}

function sortRows(rows: readonly CalendarHolidayDraft[]): CalendarHolidayDraft[] {
  return [...rows].sort((left, right) => {
    if (left.start === '' && right.start === '') return 0
    if (left.start === '') return 1
    if (right.start === '') return -1
    return left.start.localeCompare(right.start)
  })
}

function CalendarYearGroup({ entry, reads, onChange }: {
  entry: CalendarDraft
  reads: readonly HolidayRead[]
  onChange: (next: CalendarDraft) => void
}) {
  const [pickStart, setPickStart] = useState<string | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'err' | 'hint' } | null>(null)
  const [undoRows, setUndoRows] = useState<CalendarHolidayDraft[] | null>(null)
  const tally = calendarYearTally(entry.year, entry.holidays)
  const marked = new Set<string>()
  for (const row of entry.holidays) {
    if (row.id === editingId) continue
    for (const date of holidayDates({ start: row.start, end: row.end })) marked.add(date)
  }

  const busy = pickStart !== null || editingId !== null

  useEffect(() => {
    if (!busy) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setPickStart(null)
      setHoverDate(null)
      setEditingId(null)
      setNotice(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy])

  const resetPick = (): void => {
    setPickStart(null)
    setHoverDate(null)
    setEditingId(null)
  }

  const apply = (rows: CalendarHolidayDraft[], text: string): void => {
    setUndoRows(entry.holidays)
    setNotice({ text, tone: 'ok' })
    onChange({ ...entry, holidays: sortRows(rows) })
    resetPick()
  }

  const undo = (): void => {
    if (undoRows === null) return
    onChange({ ...entry, holidays: undoRows })
    setUndoRows(null)
    setNotice(null)
    resetPick()
  }

  const rangeAt = (date: string): CalendarHolidayDraft | undefined =>
    entry.holidays.find(row => row.id !== editingId && row.start !== '' && row.end !== '' && row.start <= date && date <= row.end)

  const commit = (start: string, end: string): void => {
    const days = String(holidayDates({ start, end }).length)
    if (editingId === null) {
      apply([...entry.holidays, newHoliday({ start, end })], `已加入 ${start} ~ ${end}（${days} 天）`)
      return
    }
    apply(
      entry.holidays.map(row => (row.id === editingId ? { ...row, start, end } : row)),
      `已改成 ${start} ~ ${end}（${days} 天）`,
    )
  }

  const removeRange = (id: number, label: string): void => {
    apply(entry.holidays.filter(row => row.id !== id), `已删掉 ${label}`)
  }

  const onPick = (date: string): void => {
    setNotice(current => (current !== null && current.tone === 'ok' ? current : null))
    if (pickStart === null) {
      const hit = rangeAt(date)
      if (hit !== undefined) {
        setNotice({ text: `这一天已经在「${hit.start} ~ ${hit.end}」里了：点那一行的「改」重选，或用「删除」去掉。`, tone: 'hint' })
        return
      }
      setPickStart(date)
      return
    }
    const start = pickStart <= date ? pickStart : date
    const end = pickStart <= date ? date : pickStart
    const taken = entry.holidays.find(row => row.id !== editingId
      && row.start !== '' && row.end !== ''
      && row.start <= end && start <= row.end)
    if (taken !== undefined) {
      setNotice({ text: `和「${taken.start} ~ ${taken.end}」重叠了：同一年里两段假期不能共享一天。`, tone: 'err' })
      return
    }
    commit(start, end)
  }

  const beginEdit = (id: number): void => {
    setEditingId(id)
    setPickStart(null)
    setHoverDate(null)
    setNotice(null)
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
      </div>
      <p className="dtpl-price-cal-pick" data-active={busy || undefined}>
        <span role="status">
          {editingId !== null
            ? pickStart === null
              ? '正在改这一段：点一天重新选开始'
              : `正在改这一段：已选开始 ${pickStart}，再点一天选结束`
            : pickStart === null
              ? '点一天选开始。想删假期就点它那一行右侧的「删除」'
              : `已选开始 ${pickStart}，再点一天选结束`}
        </span>
        {busy && (
          <button type="button" className="dtpl-price-ghost" onClick={resetPick}>取消</button>
        )}
      </p>
      <div className="dtpl-cal-panel">
        {notice !== null && (
          <p
            className="dtpl-price-cal-notice"
            data-tone={notice.tone}
            role={notice.tone === 'err' ? 'alert' : 'status'}
          >
            <span className="dtpl-price-cal-notice-mark" aria-hidden="true">
              {notice.tone === 'ok' ? '✓' : notice.tone === 'err' ? '!' : 'i'}
            </span>
            <span className="dtpl-price-cal-notice-text">{notice.text}</span>
            {notice.tone === 'ok' && undoRows !== null && (
              <button type="button" className="dtpl-price-cal-notice-act" onClick={undo}>撤销</button>
            )}
          </p>
        )}
        <div className="dtpl-cal-toolbar">
          <span className="dtpl-cal-legend">
            <span className="dtpl-cal-legend-item" data-kind="holiday"><i aria-hidden="true">假</i>法定节假日</span>
            <span className="dtpl-cal-legend-item" data-kind="weekend"><i aria-hidden="true">休</i>周末</span>
          </span>
        </div>
        <HolidayCalendar year={entry.year} holidays={marked} pickStart={pickStart} hoverDate={hoverDate} onPick={onPick} onHover={setHoverDate} />
      </div>
      {entry.holidays.length > 0 && (
        <div className="dtpl-price-cal-holidays">
          {entry.holidays.map((holiday, index) => (
            <HolidayRow
              key={holiday.id}
              index={index}
              row={holiday}
              read={reads[index]!}
              editing={editingId === holiday.id}
              onEdit={() => beginEdit(holiday.id)}
              onRemove={() => removeRange(holiday.id, holiday.start === '' && holiday.end === '' ? '这一段空白假期' : `${holiday.start} ~ ${holiday.end}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}


function HolidayRow({ index, row, read, editing, onEdit, onRemove }: {
  index: number
  row: CalendarHolidayDraft
  read: HolidayRead
  editing: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const where = `第 ${String(index + 1)} 段假期`
  return (
    <div className="dtpl-price-cal-holiday" data-bad={read.kind === 'bad'} data-editing={editing || undefined}>
      <span className="dtpl-price-cal-range">{row.start === '' && row.end === '' ? '还没选' : `${row.start} ~ ${row.end}`}</span>
      <span className="dtpl-price-cal-holiday-tail">
        <span className="dtpl-price-cal-days" data-kind={read.kind}>
          {read.kind === 'ok' ? `${String(read.days)} 天` : read.kind === 'partial' ? '还没填完' : ''}
        </span>
        <button
          type="button"
          className="dtpl-price-ghost"
          aria-label={`改（${where}）`}
          title="重新选这一段的开始与结束"
          onClick={onEdit}
        >
          {editing ? '正在改' : '改'}
        </button>
        <button
          type="button"
          className="dtpl-price-ghost dtpl-price-ghost-danger"
          aria-label={`删除（${where}）`}
          title="删掉这一段假期（可以撤销）"
          onClick={onRemove}
        >
          删除
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

function describeAutoSync(
  sync: HolidaySyncView | undefined,
  running: boolean,
): { text: string; tone: 'ok' | 'warn' | 'err' } | null {
  if (sync === undefined) return null
  if (running) return { text: '正在拉取节假日安排…', tone: 'ok' }
  if (sync.state === 'failed') {
    return {
      text: `上次没拉到${sync.lastError === null ? '' : `（${sync.lastError}）`}，现在用的还是上次的数据；已有的年份可以自己填，手写的永远优先。`,
      tone: 'err',
    }
  }
  if (sync.state === 'missing') {
    return {
      text: sync.uncovered.length > 0
        ? `${sync.uncovered.join('、')} 年还没有节假日数据（上游可能还没公布）；写进 pricing.json 或拉取成功后再填。`
        : '还没有节假日数据；写进 pricing.json 或拉取成功后再填。',
      tone: 'err',
    }
  }
  return null
}

function RateCell({ id, label, value, state, context, placeholder, note, onEdit, view }: {
  id: string
  label: string
  value: string
  state: 'ok' | 'empty' | 'bad'
  context: string
  placeholder?: string
  note?: string
  onEdit?: (next: string) => void
  view: MoneyView
}) {
  const errorId = `${id}-err`
  const noteId = `${id}-note`
  const message = state === 'bad' ? '须为非负数字' : undefined
  const describedBy = [
    message !== undefined ? errorId : undefined,
    note !== undefined ? noteId : undefined,
  ].filter((ref): ref is string => ref !== undefined).join(' ') || undefined
  const counterpart = counterpartOf(view, value)
  const tip = state === 'bad'
    ? `${label}必须是非负数字（${unitOf(view)}）`
    : [value.trim() !== '' ? `${label}：${value}` : undefined, note, counterpart]
      .filter((text): text is string => text !== undefined && text !== null).join(' · ') || undefined
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
        aria-describedby={describedBy}
        onChange={(event) => onEdit?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      {note !== undefined && <span id={noteId} className="dtpl-sr">{note}</span>}
      {message !== undefined && <span id={errorId} className="dtpl-price-cell-err" role="alert">{message}</span>}
    </div>
  )
}

function LiveRates({ live, records, view, hasSlots }: { live: InForceRates | null; records: number; view: MoneyView; hasSlots: boolean }) {
  const shown = (field: RateField): string => {
    if (live === null) return ''
    const own = live.values[field].trim()
    if (own !== '') return own
    if (field === 'cacheRead' || field === 'cacheWrite') return live.values.input.trim()
    return ''
  }
  return (
    <div className="dtpl-price-live" role="group" aria-label="此刻计费的价" data-ui>
      <div className="dtpl-price-live-head">
        <span className="dtpl-price-live-k">此刻计费</span>
        <span className="dtpl-price-live-unit">{unitOf(view)}</span>
      </div>
      {live === null ? (
        <p className="dtpl-price-live-none">
          {records > 0 ? '还没有价：这些记录按 ¥0 计（价格未知）' : '还没有价：它还没有被调用过'}
        </p>
      ) : live.slot !== null ? (
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
          <p className="dtpl-price-live-note">正在按峰谷时段「{dayLabel(live.slot)}」计</p>
        </>
      ) : (
        <>
          <p className="dtpl-price-live-status">此刻按基准价计</p>
          <p className="dtpl-price-live-hint">
            {hasSlots
              ? '现在不在任何峰谷时段内；时段生效时，这里报实际计费的四档价。'
              : '全周 · 全天；加峰谷时段后，时段内的实际价会显示在这里。'}
          </p>
        </>
      )}
    </div>
  )
}

function DayBand({ price }: { price: ModelDraft }) {
  const slots = effectiveSlots(price).map(slot => {
    const { start, end } = slotRange(slot)
    const ok = isHourRange({ start, end })
    return { id: slot.id, label: DAY_SET_LABELS[slot.days], start: ok ? start : 0, end: ok ? end : 0 }
  })
  const drawn = slots.filter(row => row.end > row.start)
  return (
    <div
      className="dtpl-price-day"
      role="img"
      aria-label={`24 小时生效范围：基准价铺满全天${drawn.length === 0 ? '' : `；${drawn.map(row => `${row.label} 覆盖 ${String(row.start)}–${String(row.end)} 点`).join('；')}`}`}
      data-ui
    >
      <div className="dtpl-price-day-row" aria-hidden="true">
        <span className="dtpl-price-day-k">基准价</span>
        <span className="dtpl-price-day-cells" aria-hidden="true">
          {HOURS.map(hour => <span className="dtpl-price-day-cell" key={hour} data-on="base" />)}
        </span>
      </div>
      {drawn.map(row => (
        <div className="dtpl-price-day-row" key={row.id} aria-hidden="true">
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

function PriceRow({ slot, index, price, view, onChange, onRemove, onDuplicate }: {
  slot: SlotDraft | null
  index: number
  price: ModelDraft
  view: MoneyView
  onChange: (next: ModelDraft) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const context = slot === null ? '基准价' : `第 ${String(index + 1)} 个峰谷时段`
  const [confirming, setConfirming] = useState(false)
  const inert = slot !== null && isBlankSlot(slot)
  const hours = slot === null ? null : (() => {
    const range = slotRange(slot)
    return isHourRange(range) ? range.end - range.start : null
  })()
  const lastPriced = slot !== null && !inert && effectiveSlots(price).length === 1
  const edit = (field: RateField, text: string): void => {
    if (slot === null) {
      onChange({ ...price, [field]: text })
      return
    }
    replaceSlot({ ...slot, [field]: text })
  }
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
                <button type="button" className="dtpl-price-ghost" aria-label={`复制（${context}）`} onClick={onDuplicate}>复制</button>
                <button
                  type="button"
                  id={`slot-${String(slot.id)}-remove`}
                  className="dtpl-price-ghost dtpl-price-ghost-danger"
                  aria-label={`${confirming ? '确认删除' : '删除'}（${context}）`}
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

function PriceTable({ price, view, onChange }: {
  price: ModelDraft
  view: MoneyView
  onChange: (next: ModelDraft) => void
}) {
  const [pendingFocus, setPendingFocus] = useState<string | null>(null)
  useEffect(() => {
    if (pendingFocus === null) return
    document.getElementById(pendingFocus)?.focus()
    setPendingFocus(null)
  }, [pendingFocus])
  const addSlot = (): void => {
    const slot = newSlot()
    onChange({ ...price, slots: [...price.slots, slot] })
    setPendingFocus(`slot-${String(slot.id)}-input`)
  }
  const removeSlot = (index: number): void => {
    const slot = price.slots[index]
    if (slot === undefined) return
    onChange({ ...price, slots: price.slots.filter(item => item.id !== slot.id) })
    const next = price.slots[index + 1] ?? price.slots[index - 1]
    setPendingFocus(next === undefined ? 'price-add-slot' : `slot-${String(next.id)}-input`)
  }
  return (
    <>
      <div className="dtpl-price-tbl" role="group" aria-label={`四档价（${unitOf(view)}）`}>
        <div className="dtpl-price-cols" aria-hidden="true">
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
              onRemove={() => removeSlot(slotIndex)}
              onDuplicate={() => onChange({ ...price, slots: [...price.slots, duplicateSlot(slot)] })}
            />
          ))}
        </div>
      </div>
      <div className="dtpl-price-addrow">
        <button
          type="button"
          id="price-add-slot"
          className="dtpl-price-add-ghost dtpl-price-add-slot"
          aria-label="添加峰谷时段"
          onClick={addSlot}
        >
          <span className="dtpl-price-add-plus" aria-hidden="true">＋</span>峰谷时段
        </button>
      </div>
    </>
  )
}

export const ModelDetail = memo(function ModelDetail({ route, row, billing, baseline, holidays, currency, rate, onCurrency, onRowChange, onBilling }: {
  route: string
  row: ModelDraft
  billing: BillingNature
  baseline: ReadonlyMap<string, string>
  holidays: ReadonlySet<string>
  currency: PriceCurrency
  rate: number | null
  onCurrency: (currency: PriceCurrency) => void
  onRowChange: (route: string, model: string, next: ModelDraft) => void
  onBilling: (route: string, billing: BillingNature) => void
}) {
  const view: MoneyView = { route: currency, cnyPerUsd: rate }
  const dirty = modelDirty(route, row, baseline)
  const issue = priceIssue(row)
  const live = ratesInForce(row, holidays)
  const named = row.name !== undefined && row.name !== '' && row.name !== row.model
  const hasSlots = effectiveSlots(row).length > 0
  const countText = row.records > 0 ? `${String(row.records)} 次请求` : '没记过'
  const unpriced = row.unpriced !== undefined && row.unpriced > 0 && live !== null ? row.unpriced : 0

  return (
    <section className="dtpl-price-detail" data-dirty={dirty} aria-label={`${row.model} 的价格`}>
      <div className="dtpl-price-detail-head">
        <div className="dtpl-price-detail-main">
          <span className="dtpl-price-detail-id">
          <span className="dtpl-price-name" data-exact={!named}>{named ? row.name : row.model}</span>
          {named && <span className="dtpl-price-exact" title={row.model}>{row.model}</span>}
        </span>
        <span className="dtpl-price-reqs">{countText}</span>
        {unpriced > 0 && (
          <span
            className="dtpl-price-unpriced"
            title={`账本里有 ${String(unpriced)} 条记录按这份价折算不出金额（按美元报价却没设汇率，或那些记录落在没有价的档上）：它们按 ¥0 计入金额，所以金额偏低。`}
          >
            其中 {String(unpriced)} 条按 ¥0 计
          </span>
        )}
        </div>
        <span className="dtpl-price-route-facts">
          <span className="dtpl-price-head-k">这条通道</span>
          <span className="dtpl-price-currency">
            <span className="dtpl-price-head-k">报价币种</span>
            <span className="dtpl-price-switch" role="group" aria-label="报价币种">
              <button
                type="button"
                aria-label="按人民币报价（¥）"
                aria-pressed={currency === 'CNY'}
                title="这条通道的价按人民币记（¥/百万词元）。切过来会把现有价按汇率换算成人民币，金额不变"
                onClick={() => onCurrency('CNY')}
              >
                ¥
              </button>
              <button
                type="button"
                aria-label="按美元报价（$）"
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
          <span className="dtpl-price-currency">
            <span className="dtpl-price-head-k">计费性质</span>
            <span
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
            </span>
          </span>
        </span>
      </div>
      <div className="dtpl-price-console">
        <div className="dtpl-price-console-edit">
          <PriceTable price={row} view={view} onChange={(next) => onRowChange(route, row.model, next)} />
        </div>
        <div className="dtpl-price-console-live">
          <LiveRates live={live} records={row.records} view={view} hasSlots={hasSlots} />
          {hasSlots && <DayBand price={row} />}
        </div>
      </div>
      {live === null && (
        <p className="dtpl-price-note">
          {row.records > 0
            ? '四档价全空 = 这条没有价：它的记录按 ¥0 计，并列为价格未知。'
            : '四档价全空 = 这条没有价。它还没被调用过，所以没有金额受影响。'}
        </p>
      )}
      {issue !== null && (
        <p className="dtpl-price-issue" role="status">{row.model}:{issue}</p>
      )}
    </section>
  )
})
