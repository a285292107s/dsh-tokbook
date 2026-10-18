import { memo, useEffect, useState } from 'react'
import { DAY_SET_HINTS, DAY_SET_LABELS, DAY_SETS, clockLabel, isHourRange } from '../../price-format.ts'
import type { BillingNature, DaySet, HolidaySyncView, PriceCurrency } from '../../types.ts'
import { counterpartOf, unitOf, type MoneyView } from './currency.ts'
import {
  calendarYearTally, defaultCalendarYear, duplicateSlot, effectiveSlots, fieldState,
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

export function CalendarEditor({ entries, missingYears, autoYears, dirty, expanded, sync, onAutoRefresh, syncing, onExpandedChange, onChange }: {
  entries: CalendarEntries
  missingYears: readonly string[]
  autoYears?: readonly string[]
  dirty: boolean
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onChange: (year: string, next: CalendarDraft | null) => void
  sync?: HolidaySyncView
  onAutoRefresh?: () => void
  syncing?: boolean
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
  const gaps = missingYears.filter(year => !entries.has(year))

  useEffect(() => {
    if (focusId === null) return
    document.getElementById(focusId)?.focus()
    setFocusId(null)
  }, [focusId])

  const addingProblem = ((): string | null => {
    const year = yearText.trim()
    if (year === '') return null
    if (!/^\d{4}$/u.test(year)) return '年份要写四位数字，例如 2027'
    if (entries.has(year)) return `${year} 年已经在上面了`
    return null
  })()

  const leaveYear = (): void => {
    setAddingTouched(true)
    setTyped(current => (current !== null && current.trim() === '' ? null : current))
  }

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

  const fillGaps = (): void => {
    const drafts = missingYearDrafts(entries, gaps)
    for (const draft of drafts) onChange(draft.year, draft)
    onExpandedChange(true)
    const first = drafts[0]?.holidays[0]
    setFocusId(first === undefined ? null : dateFieldId(first, 'start'))
  }

  const autoLine = describeAutoSync(sync, syncing === true)
  const needsManual = sync !== undefined && (sync.state === 'failed' || sync.state === 'missing')

  return (
    <section className="dtpl-price-cal" id="price-calendar" data-dirty={dirty} data-open={expanded} aria-label="法定节假日年历">
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
          <span className="dtpl-price-cal-hint" aria-hidden="true">{expanded ? '收起' : '展开'}</span>
        </button>
        {missingYears.length > 0 && gaps.length > 0 && (
          onAutoRefresh === undefined
            ? (
              <button type="button" className="dtpl-price-cal-fix" onClick={fillGaps}
                title="这些年的「法定工作日」时段会按周一至周五全额计，落在法定节假日的工作日被多算高峰价。补上那一年，或展开年历手动加一年。">
                <span className="dtpl-price-add-plus" aria-hidden="true">＋</span>
                {gaps.length > 2 ? `补上缺的 ${String(gaps.length)} 年` : `补上 ${gaps.join('、')} 年`}
              </button>
            )
            : (
              <button
                type="button"
                className="dtpl-price-cal-fix"
                disabled={syncing === true}
                onClick={onAutoRefresh}
                title="从 holiday-cn 拉这几年的法定节假日安排（它每日抓国务院公告）。手写过的年份不受影响。"
              >
                <span className="dtpl-price-add-plus" aria-hidden="true">↻</span>
                {syncing === true ? '拉取中…' : `自动拉取 ${gaps.join('、')} 年`}
              </button>
            )
        )}
      </div>
      {autoLine !== null && (
        <p className="dtpl-price-cal-auto-line" data-tone={autoLine.tone}>
          {autoLine.text}
          {needsManual && onAutoRefresh !== undefined && (
            <button type="button" className="dtpl-price-ghost" onClick={onAutoRefresh} disabled={syncing === true}>
              {syncing === true ? '重试中…' : '重试'}
            </button>
          )}
        </p>
      )}
      {expanded && (
        <div className="dtpl-price-cal-body">
          <p className="dtpl-price-cal-note">
            一年一组，一段假期一行：填开始与结束日期，含两端。只收录放假日——调休上班日落在周末，
            而周末本来就是闲时。每行后面的天数是拿来对通知里「共 N 天」的：对不上就是抄错了。
            标着<b>「自动」</b>的年份没写在这里，是启动时从 holiday-cn 拉来并缓存的；你手写过哪一年，
            哪一年就以你的为准。
          </p>
          {years.map(year => (
            <CalendarYearGroup
              key={year}
              entry={entries.get(year)!}
              reads={reads.get(year)!}
              onChange={(next) => onChange(year, next)}
              onRemove={() => {
                onChange(year, null)
                setFocusId('cal-newyear')
              }}
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
  reads: readonly HolidayRead[]
  onChange: (next: CalendarDraft) => void
  onRemove: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const tally = calendarYearTally(entry.year, entry.holidays)
  const [pendingFocus, setPendingFocus] = useState<string | null>(null)
  useEffect(() => {
    if (pendingFocus === null) return
    document.getElementById(pendingFocus)?.focus()
    setPendingFocus(null)
  }, [pendingFocus])
  const addHoliday = (): void => {
    const holiday = newHoliday()
    onChange({ ...entry, holidays: [...entry.holidays, holiday] })
    setPendingFocus(dateFieldId(holiday, 'start'))
  }
  const removeHoliday = (index: number): void => {
    const holiday = entry.holidays[index]
    if (holiday === undefined) return
    onChange({ ...entry, holidays: entry.holidays.filter(item => item.id !== holiday.id) })
    const next = entry.holidays[index + 1] ?? entry.holidays[index - 1]
    setPendingFocus(next === undefined ? `cal-${entry.year}-add` : dateFieldId(next, 'start'))
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
          aria-label={`${confirming ? '确认删除' : '删除'}这一年（${entry.year}）`}
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
          onRemove={() => removeHoliday(index)}
        />
      ))}
      <button type="button" id={`cal-${entry.year}-add`} className="dtpl-price-add-ghost" onClick={addHoliday}>
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
          id={`cal-${String(row.id)}-remove`}
          className="dtpl-price-ghost dtpl-price-ghost-danger"
          aria-label={`${confirming ? '确认删除' : '删除'}（${where}）`}
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

function describeAutoSync(
  sync: HolidaySyncView | undefined,
  running: boolean,
): { text: string; tone: 'ok' | 'warn' | 'err' } | null {
  if (sync === undefined) return null
  if (running) return { text: '正在拉取节假日安排…', tone: 'ok' }
  if (sync.state === 'failed') {
    return {
      text: `上次没拉到${sync.lastError === null ? '' : `（${sync.lastError}）`}，现在用的还是上次的数据；展开年历可以自己填，手写的永远优先。`,
      tone: 'err',
    }
  }
  if (sync.state === 'missing') {
    return {
      text: sync.uncovered.length > 0
        ? `${sync.uncovered.join('、')} 年还没有节假日数据（上游可能还没公布）。展开可以手动填。`
        : '还没有节假日数据。展开可以手动填。',
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

function LiveRates({ live, records, view }: { live: InForceRates | null; records: number; view: MoneyView }) {
  const shown = (field: RateField): string => {
    if (live === null) return ''
    const own = live.values[field].trim()
    if (own !== '') return own
    if (field === 'cacheRead' || field === 'cacheWrite') return live.values.input.trim()
    return ''
  }
  return (
    <div className="dtpl-price-live" role="group" aria-label="此刻计费的价">
      <div className="dtpl-price-live-head">
        <span className="dtpl-price-live-k">此刻计费</span>
        <span className="dtpl-price-live-unit">{unitOf(view)}</span>
      </div>
      {live === null ? (
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
          {live.slot !== null && (
            <p className="dtpl-price-live-note">正在按峰谷时段「{dayLabel(live.slot)}」计</p>
          )}
        </>
      )}
    </div>
  )
}

function DayBand({ price }: { price: ModelDraft }) {
  const slots = effectiveSlots(price).map(slot => {
    const { start, end } = slotRange(slot)
    const ok = isHourRange({ start, end })
    return { id: slot.id, label: dayLabel(slot), start: ok ? start : 0, end: ok ? end : 0 }
  })
  const drawn = slots.filter(row => row.end > row.start)
  return (
    <div
      className="dtpl-price-day"
      role="img"
      aria-label={`24 小时生效范围：基准价铺满全天${drawn.length === 0 ? '' : `；${drawn.map(row => `${row.label} 覆盖 ${String(row.start)}–${String(row.end)} 点`).join('；')}`}`}
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
      {effectiveSlots(price).length > 0 && <DayBand price={price} />}
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
  const countText = row.records > 0 ? `${String(row.records)} 次请求` : '没记过'
  const unpriced = row.unpriced !== undefined && row.unpriced > 0 && live !== null ? row.unpriced : 0

  return (
    <section className="dtpl-price-detail" data-dirty={dirty} aria-label={`${row.model} 的价格`}>
      <div className="dtpl-price-detail-head">
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
      <LiveRates live={live} records={row.records} view={view} />
      <PriceTable price={row} view={view} onChange={(next) => onRowChange(route, row.model, next)} />
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
