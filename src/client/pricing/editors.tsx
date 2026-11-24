import { memo, useEffect, useState } from 'react'
import { DAY_SET_HINTS, DAY_SET_LABELS, DAY_SETS, clockLabel, holidayDates, isHourRange } from '../../price-format.ts'
import type { BillingNature, DaySet, HolidaySyncView, PriceCurrency } from '../../types.ts'
import { counterpartOf, unitOf, type MoneyView } from './currency.ts'
import {
  duplicateSlot, effectiveSlots, fieldState,
  inheritedCell, isBlankSlot, dayLabel, modelDirty, newSlot,
  priceIssue, ratesInForce,
  readHolidays, slotRange, withSlotEnd, withSlotStart,
  type CalendarEntries, type InForceRates, type ModelDraft,
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

const MONTH_NAMES: readonly string[] = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const MONTH_EN: readonly string[] = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const HOLIDAY_NAMES: Readonly<Record<string, readonly string[]>> = {
  2025: ['春节', '国庆'],
  2026: ['元旦', '春节', '清明', '劳动节', '端午', '中秋', '国庆'],
}

interface CalendarDay {
  key: string
  day: number
  weekend: boolean
  holiday: boolean
  today: boolean
  blank: boolean
}

const WEEKDAY_CN: readonly string[] = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

type DayKind = 'work' | 'weekend' | 'holiday'

interface TodayStatus {
  weekday: string
  dateLabel: string
  kind: DayKind
  typeLabel: string
  priceTone: 'peak' | 'rest'
  priceLabel: string
  unknown: boolean
}

function dayKeyOf(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayKeyToDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 2000, (month ?? 1) - 1, day ?? 1)
}

function holidayDaySet(entries: CalendarEntries): ReadonlySet<string> {
  const days = new Set<string>()
  for (const year of entries.keys()) {
    for (const span of spansOf(entries, year)) {
      for (const day of holidayDates({ start: span.start, end: span.end })) days.add(day)
    }
  }
  return days
}

function todayStatus(days: ReadonlySet<string>, now: Date, covered: boolean): TodayStatus {
  const weekday = WEEKDAY_CN[now.getDay()] ?? ''
  const dateLabel = `${now.getMonth() + 1}/${now.getDate()}`
  if (days.has(dayKeyOf(now))) {
    return { weekday, dateLabel, kind: 'holiday', typeLabel: '法定节假日', priceTone: 'rest', priceLabel: '闲时', unknown: false }
  }
  if (now.getDay() === 0 || now.getDay() === 6) {
    return { weekday, dateLabel, kind: 'weekend', typeLabel: '周末', priceTone: 'rest', priceLabel: '闲时', unknown: false }
  }
  return { weekday, dateLabel, kind: 'work', typeLabel: '法定工作日', priceTone: 'peak', priceLabel: '高峰', unknown: !covered }
}

function nextHoliday(entries: CalendarEntries, now: Date): { label: string; gap: number } | null {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const fromKey = dayKeyOf(from)
  let best: { start: string; year: string; index: number } | null = null
  for (const year of [...entries.keys()].sort((left, right) => left.localeCompare(right))) {
    const spans = spansOf(entries, year)
    for (let index = 0; index < spans.length; index += 1) {
      const span = spans[index]!
      if (span.start <= fromKey) continue
      if (best === null || span.start < best.start) best = { start: span.start, year, index }
    }
  }
  if (best === null) return null
  const picked = best
  const gap = Math.round((dayKeyToDate(picked.start).getTime() - from.getTime()) / 86_400_000)
  if (gap <= 0) return null
  const label = HOLIDAY_NAMES[picked.year]?.[picked.index] ?? '假期'
  return { label, gap }
}

function monthDays(year: number, month: number, holidays: ReadonlySet<string>, today: string): CalendarDay[] {
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const total = new Date(year, month, 0).getDate()
  const cells: CalendarDay[] = []
  for (let index = 0; index < offset; index += 1) {
    cells.push({ key: `b-${month}-${index}`, day: 0, weekend: false, holiday: false, today: false, blank: true })
  }
  for (let day = 1; day <= total; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const weekday = (new Date(year, month - 1, day).getDay() + 6) % 7
    cells.push({ key, day, weekend: weekday >= 5, holiday: holidays.has(key), today: key === today, blank: false })
  }
  return cells
}

function shortDate(key: string): string {
  return key.slice(5).replace('-', '/')
}

function HolidayCalendar({ year, holidays }: { year: string; holidays: ReadonlySet<string> }) {
  const yearNum = Number(year)
  const months = Array.from({ length: 12 }, (_, index) => index + 1)
  return (
    <div className="dtpl-price-calmons" role="group" aria-label={`${year} 年节假日日历（只读）`}>
      {months.map(month => (
        <div className="dtpl-price-calmon" key={month}>
          <div className="dtpl-price-calmon-head">
            <span className="dtpl-price-calmon-cn">{MONTH_NAMES[month - 1]}</span>
            <span className="dtpl-price-calmon-en" aria-hidden="true">{MONTH_EN[month - 1]}</span>
          </div>
          <div className="dtpl-price-calmon-week" aria-hidden="true">
            {WEEK_LABELS.map((label, index) => <span key={label} data-weekend={index >= 5 || undefined}>{label}</span>)}
          </div>
          <div className="dtpl-price-calmon-days">
            {monthDays(yearNum, month, holidays, '').map(cell => cell.blank
              ? <span className="dtpl-price-calday is-blank" key={cell.key} aria-hidden="true" />
              : (
                <span
                  className="dtpl-price-calday"
                  key={cell.key}
                  data-holiday={cell.holiday || undefined}
                  data-weekend={!cell.holiday && cell.weekend || undefined}
                  data-today={cell.today || undefined}
                  title={`${cell.key}${cell.holiday ? ' 法定节假日' : cell.weekend ? ' 周末' : ''}`}
                >
                  <span className="dtpl-price-calday-num">{cell.day}</span>
                </span>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CalendarEditor({ entries, missingYears, autoYears, sync, syncing, className }: {
  entries: CalendarEntries
  missingYears: readonly string[]
  autoYears?: readonly string[]
  sync?: HolidaySyncView
  syncing?: boolean
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const now = new Date()
  const nowYear = String(now.getFullYear())
  const years = entries.size > 0
    ? [...entries.keys()].sort((left, right) => right.localeCompare(left))
    : [nowYear]
  const kept = years.filter(year => (entries.get(year)?.holidays.length ?? 0) > 0)
  const gaps = missingYears.filter(year => !entries.has(year))
  const totalDays = kept.reduce((sum, year) => sum + spansOf(entries, year).reduce((acc, span) => acc + span.days, 0), 0)
  const autoLine = describeAutoSync(sync, syncing === true)
  const status = todayStatus(holidayDaySet(entries), now, gaps.length === 0)
  const next = nextHoliday(entries, now)
  const panelId = 'price-calendar-body'

  return (
    <section className={`dtpl-price-cal ${className ?? ''}`} id="price-calendar" data-expanded={expanded || undefined} aria-label="法定节假日年历">
      <div className="dtpl-price-calbar">
        <span className="dtpl-price-calbar-mark" data-kind={status.kind} aria-hidden="true" />
        <span className="dtpl-price-calbar-date">今天 · {status.weekday} {status.dateLabel}</span>
        <span className="dtpl-price-calbar-sep" aria-hidden="true" />
        <span className="dtpl-price-calbar-type" data-kind={status.kind}>{status.typeLabel}</span>
        <span className="dtpl-price-calbar-price" data-tone={status.priceTone}>{status.priceLabel}</span>
        {status.unknown && <span className="dtpl-price-calbar-note">{nowYear} 年放假安排未收录，暂按工作日高峰价</span>}
        <span className="dtpl-price-calbar-spacer" aria-hidden="true" />
        {next !== null && (
          <span className="dtpl-price-calbar-next">{next.label} · {String(next.gap)} 天后</span>
        )}
        <button
          type="button"
          className="dtpl-price-calbar-toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded(value => !value)}
        >
          {expanded ? '收起' : '展开年历'}
          <span className="dtpl-price-calbar-chev" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
        </button>
      </div>
      {expanded && (
        <div className="dtpl-price-calbody" id={panelId}>
          <header className="dtpl-price-calmast">
            <div className="dtpl-price-calmast-main">
              <span className="dtpl-price-calkicker">法定节假日年历</span>
              <span className="dtpl-price-caltitle">节假日年鉴</span>
            </div>
            <div className="dtpl-price-calfacts">
              {kept.length > 0
                ? (
                  <span className="dtpl-price-calfact">
                    <span className="dtpl-price-calfact-k">已收录</span>
                    <span className="dtpl-price-calfact-v">{kept.join(' · ')}</span>
                  </span>
                )
                : <span className="dtpl-price-calfact"><span className="dtpl-price-calfact-v">未收录</span></span>}
              {kept.length > 0 && (
                <span className="dtpl-price-calfact">
                  <span className="dtpl-price-calfact-k">合计</span>
                  <span className="dtpl-price-calfact-v">{String(totalDays)} 天</span>
                </span>
              )}
              {gaps.length > 0 && (
                <span className="dtpl-price-calfact" data-tone="warn">
                  <span className="dtpl-price-calfact-k">待补</span>
                  <span className="dtpl-price-calfact-v">{gaps.join('、')}</span>
                </span>
              )}
            </div>
          </header>
          <p className="dtpl-price-calauto" data-tone={autoLine?.tone ?? 'ok'}>
            <i aria-hidden="true" />
            {autoLine !== null ? autoLine.text : '放假安排由 holiday-cn 自动同步，也可写进 pricing.json；此处只读。'}
          </p>
          <p className="dtpl-price-calpurpose">决定「法定工作日」时段在哪几天生效——缺了哪一年，那一年的假期会被当成工作日，按高峰价多算。只记放假日：调休上班日多落在周末，周末本来按闲时算。</p>
          <div className="dtpl-price-calyears">
            {years.map(year => (
              <CalendarYearView
                key={year}
                year={year}
                auto={autoYears?.includes(year) ?? false}
                spans={spansOf(entries, year)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function spansOf(entries: CalendarEntries, year: string): readonly { start: string; end: string; days: number }[] {
  const entry = entries.get(year)
  if (entry === undefined) return []
  return readHolidays(year, entry.holidays).flatMap((read, index) => {
    const row = entry.holidays[index]
    return read.kind === 'ok' && row !== undefined ? [{ start: row.start, end: row.end, days: read.days }] : []
  })
}

function CalendarYearView({ year, auto, spans }: {
  year: string
  auto: boolean
  spans: readonly { start: string; end: string; days: number }[]
}) {
  const marked = new Set<string>()
  for (const span of spans) for (const day of holidayDates({ start: span.start, end: span.end })) marked.add(day)
  const totalDays = spans.reduce((sum, span) => sum + span.days, 0)
  const names = HOLIDAY_NAMES[year] ?? []
  return (
    <div className="dtpl-price-calyear">
      <div className="dtpl-price-calspine">
        <span className="dtpl-price-calyearnum">{year}</span>
        <span className="dtpl-price-calyearsum">
          {spans.length === 0
            ? '尚未收录'
            : <><b>{String(spans.length)}</b> 段假期 · 共 <b>{String(totalDays)}</b> 天</>}
        </span>
        {auto && (
          <span className="dtpl-price-calchip" title="从 holiday-cn 自动拉取并缓存；这一年的放假安排来自上游。">holiday-cn 同步</span>
        )}
        {spans.length > 0 && (
          <ol className="dtpl-price-calspans" aria-label={`${year} 年假期清单`}>
            {spans.map((span, index) => (
              <li className="dtpl-price-calspan" key={`${span.start}-${String(index)}`}>
                <span className="dtpl-price-calspan-name">{names[index] ?? `假期 ${String(index + 1)}`}</span>
                <span className="dtpl-price-calspan-days">{String(span.days)} 天</span>
                <span className="dtpl-price-calspan-range">{shortDate(span.start)} — {shortDate(span.end)}</span>
              </li>
            ))}
          </ol>
        )}
        <span className="dtpl-price-callegend">
          <span className="dtpl-price-callegend-item" data-kind="holiday"><i aria-hidden="true" />法定节假日</span>
          <span className="dtpl-price-callegend-item" data-kind="weekend"><i aria-hidden="true" />周末</span>
        </span>
      </div>
      <HolidayCalendar year={year} holidays={marked} />
    </div>
  )
}


function describeAutoSync(
  sync: HolidaySyncView | undefined,
  running: boolean,
): { text: string; tone: 'ok' | 'warn' | 'err' } | null {
  if (sync === undefined) return null
  if (running) return { text: '正在拉取节假日安排…', tone: 'ok' }
  if (sync.state === 'failed') {
    return {
      text: `上次没拉到${sync.lastError === null ? '' : `（${sync.lastError}）`}，现在用的还是上一次的数据；缺的年份可以写进 pricing.json，或等下次拉取补上。`,
      tone: 'err',
    }
  }
  if (sync.state === 'missing') {
    return {
      text: sync.uncovered.length > 0
        ? `${sync.uncovered.join('、')} 年还没有节假日数据（上游可能还没公布）；可以先写进 pricing.json，或等拉取成功后自动补上。`
        : '还没有节假日数据；可以先写进 pricing.json，或等拉取成功后自动补上。',
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
  const mode = live === null ? 'none' : live.slot !== null ? 'slot' : 'base'
  const modeName = live === null ? '' : live.slot !== null ? '峰谷时段' : '基准价'
  const modeNote = live === null
    ? ''
    : live.slot !== null
      ? dayLabel(live.slot)
      : hasSlots ? '现在不在时段内' : '全天'
  return (
    <div className="dtpl-price-live" data-mode={mode} role="group" aria-label="此刻计费的价" data-ui>
      <div className="dtpl-price-live-head">
        <span className="dtpl-price-live-k">此刻计费</span>
        {live !== null && (
          <>
            <span className="dtpl-price-live-mode" data-mode={mode}>{modeName}</span>
            <span className="dtpl-price-live-why">{modeNote}</span>
          </>
        )}
        <span className="dtpl-price-live-unit">{unitOf(view)}</span>
      </div>
      {live === null ? (
        <p className="dtpl-price-live-none">
          {records > 0 ? '还没有价：这些记录按 ¥0 计（价格未知）' : '还没有价：它还没有被调用过'}
        </p>
      ) : (
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
      )}
    </div>
  )
}

function DayBand({ price, active, now }: { price: ModelDraft; active: SlotDraft | null | undefined; now: number }) {
  const slots = effectiveSlots(price).map(slot => {
    const range = slotRange(slot)
    const ok = isHourRange(range)
    return {
      id: slot.id,
      label: DAY_SET_LABELS[slot.days],
      range: ok ? `${String(range.start).padStart(2, '0')}–${String(range.end).padStart(2, '0')}` : '',
      start: ok ? range.start : 0,
      end: ok ? range.end : 0,
    }
  })
  const drawn = slots.filter(row => row.end > row.start)
  const at = new Date(now)
  const nowPercent = (at.getHours() + at.getMinutes() / 60) / 24 * 100
  const coverage = drawn.map(row => `${row.label} 覆盖 ${String(row.start)}–${String(row.end)} 点`).join('；')
  return (
    <div
      className="dtpl-price-day"
      role="img"
      aria-label={`24 小时生效范围：基准价铺满全天${drawn.length === 0 ? '' : `；${coverage}`}${active === undefined ? '' : `；${active === null ? '现在按基准价' : `现在按 ${dayLabel(active)} 的价`}`}`}
      data-ui
    >
      <div className="dtpl-price-day-tracks">
        <div className="dtpl-price-day-row" data-active={active === null || undefined}>
          <span className="dtpl-price-day-k">
            <span className="dtpl-price-day-k-name">基准价</span>
            <span className="dtpl-price-day-k-range">全天</span>
          </span>
          <span className="dtpl-price-day-cells" aria-hidden="true">
            {HOURS.map(hour => <span className="dtpl-price-day-cell" key={hour} data-on="base" />)}
          </span>
        </div>
        {drawn.map(row => (
          <div className="dtpl-price-day-row" key={row.id} data-active={active?.id === row.id || undefined}>
            <span className="dtpl-price-day-k">
              <span className="dtpl-price-day-k-name">{row.label}</span>
              <span className="dtpl-price-day-k-range">{row.range}</span>
            </span>
            <span className="dtpl-price-day-cells" aria-hidden="true">
              {HOURS.map(hour => (
                <span className="dtpl-price-day-cell" key={hour} data-on={hour >= row.start && hour < row.end ? 'slot' : undefined} />
              ))}
            </span>
          </div>
        ))}
        <span className="dtpl-price-day-now-layer" aria-hidden="true">
          <span
            className="dtpl-price-day-now"
            style={{ left: `${String(nowPercent)}%` }}
            data-edge={nowPercent < 4 ? 'start' : nowPercent > 88 ? 'end' : undefined}
          >
            <span className="dtpl-price-day-now-tag">现在</span>
            <i className="dtpl-price-day-now-flag" />
            <i className="dtpl-price-day-now-line" />
          </span>
        </span>
      </div>
      <div className="dtpl-price-day-axis">
        <span className="dtpl-price-day-axis-ticks">
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
  const now = Date.now()
  const live = ratesInForce(row, holidays, now)
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
      <div className="dtpl-price-meter">
        <LiveRates live={live} records={row.records} view={view} hasSlots={hasSlots} />
        {hasSlots && <DayBand price={row} active={live === null ? undefined : live.slot} now={now} />}
      </div>
      <div className="dtpl-price-console">
        <div className="dtpl-price-console-edit">
          <PriceTable price={row} view={view} onChange={(next) => onRowChange(route, row.model, next)} />
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
