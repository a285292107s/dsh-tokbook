/**
 * Row primitives of the 价格表 tab: the four numeric cells (editable in place),
 * one price segment's editor, one model row, and one route card.
 *
 * The row IS the table: identity on the left, the four ¥/M buckets as aligned
 * tabular cells, and a disclosure that opens the row's 调价史. The cells always
 * edit the segment in force's WHOLE-DAY price, so the table stays a table — 峰谷
 * prices live one level down, on the 峰谷时段 rows inside the drawer. Nothing
 * here owns state: the panel does, and hands down small callbacks.
 *
 * A 峰谷时段 restates only the buckets that differ; the ones it leaves empty
 * show the whole-day rate as their placeholder, so "inherit" is visible instead
 * of being a dash that means the opposite of the dash one level up.
 *
 * @module dsh-tokbook/client/pricing/editors
 */

import { memo } from 'react'
import { DAY_SET_LABELS, DAY_SETS, clockLabel } from '../../price-format.ts'
import type { BillingNature, DaySet } from '../../types.ts'
import {
  blankSegment, duplicateSlot, editableSegment, effectiveSlots, fieldState, fmtFrom, fmtRowFrom, fromFieldInput,
  fromFieldValue, inForceToday, inheritedRates, isBlankSlot, isUnpriced, modelDirty, newSegment, newSlot,
  pendingSegment, rowIssue, sortedSegments, withSlotEnd, withSlotStart,
  type ModelDraft, type RateField, type RateTexts, type RouteDraft, type SegmentDraft, type SlotDraft,
} from './draft.ts'
import { PriceTimeline } from './Timeline.tsx'

/** The four ¥/M buckets, in the order every surface writes them. */
export const RATE_FIELDS = [
  { key: 'input', label: '输入' },
  { key: 'output', label: '输出' },
  { key: 'cacheRead', label: '缓存读' },
  { key: 'cacheWrite', label: '缓存写' },
] as const

/** The row's four cells, in column order. */
const CELLS: ReadonlyArray<{ field: RateField; label: string }> = RATE_FIELDS.map(({ key, label }) => ({ field: key, label }))

/** Every hour a slot may start at, and every hour it may end at (end-exclusive,
 *  so `24:00` closes the day). */
const START_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour)
const END_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour + 1)

/** One numeric cell, edited in place: it reads as text until focused, so 50
 *  rows stay calm while every value is one click (or Tab) away. */
function RateCell({ id, label, hint, value, state, context, placeholder, note, onEdit }: {
  id: string
  label: string
  /** The static header this cell belongs to (for screen readers). */
  hint?: string
  value: string
  state: 'ok' | 'empty' | 'bad' | 'readonly'
  context: string
  /** Shown while the cell is empty. A 峰谷时段 passes the whole-day rate here,
   *  so "empty = inherits" is visible rather than implied. */
  placeholder?: string
  /** Hover text explaining what an empty cell means in this context. */
  note?: string
  onEdit?: (next: string) => void
}) {
  const errorId = `${id}-err`
  // The VISIBLE message stays short so it cannot distort a narrow rate column
  // (a full sentence wraps into a tall thin sliver inside a 68px cell); the
  // full sentence rides the input's title, and the row line below repeats the
  // first problem in full width.
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
        readOnly={state === 'readonly'}
        placeholder={placeholder ?? '—'}
        title={tip}
        value={value}
        aria-label={`${context} ${label}`}
        aria-invalid={state === 'bad' || undefined}
        aria-describedby={message !== undefined ? errorId : undefined}
        onChange={(event) => onEdit?.(event.target.value)}
        onKeyDown={(event) => {
          // Enter leaves the cell (the value is already staged).
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      {message !== undefined && <span id={errorId} className="dtpl-price-cell-err" role="alert">{message}</span>}
    </div>
  )
}

/** One 峰谷时段: the days it applies to, the hours it covers, and the buckets it
 *  restates. Its rates are laid out exactly like the whole-day row above it, so
 *  a peak price reads as "the same four buckets, other numbers" — and a bucket
 *  left empty shows the whole-day rate it keeps. */
function SlotEditor({ slot, index, canRemove, inherited, onChange, onRemove, onDuplicate }: {
  slot: SlotDraft
  index: number
  /** Whether this one may be deleted (an unfinished draft always can; the last
   *  priced slot may not, since that would silently drop the window). */
  canRemove: boolean
  /** The segment's whole-day rates, shown as the placeholders of empty cells. */
  inherited: RateTexts
  onChange: (next: SlotDraft) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const context = `第 ${String(index + 1)} 个峰谷时段`
  const inherit = (field: RateField): string | undefined => {
    const value = inherited[field].trim()
    return value === '' ? undefined : value
  }
  return (
    <div className="dtpl-price-slot">
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
        <span className="dtpl-price-seg-actions">
          <button type="button" className="dtpl-price-ghost" onClick={onDuplicate}>复制</button>
          <button
            type="button"
            className="dtpl-price-ghost dtpl-price-ghost-danger"
            onClick={onRemove}
            disabled={!canRemove}
            title={canRemove ? '删除这个峰谷时段' : '删掉最后一个有价的时段，这段覆盖的时间回到全天价'}
          >
            删除
          </button>
        </span>
      </div>
      <div className="dtpl-price-slot-rates">
        {CELLS.map(({ field, label }) => (
          <RateCell
            key={field}
            id={`slot-${String(slot.id)}-${field}`}
            label={label}
            value={slot[field]}
            state={fieldState(slot, field)}
            context={`${context} ${DAY_SET_LABELS[slot.days]}`}
            placeholder={inherit(field)}
            note={inherit(field) === undefined ? '留空 = 沿用全天价（全天价这档也是空的）' : `留空 = 沿用全天价 ${inherit(field)!}`}
            onEdit={(next) => onChange({ ...slot, [field]: next })}
          />
        ))}
      </div>
    </div>
  )
}

/** One price segment of the 调价史: the instant it takes effect, its whole-day
 *  price, its 峰谷时段 and its note. Actions appear on hover or keyboard focus
 *  (they stay reachable, never hover-only). */
function SegmentEditor({ segment, index, count, active, onChange, onRemove, onDuplicate }: {
  segment: SegmentDraft
  index: number
  count: number
  active: boolean
  onChange: (next: SegmentDraft) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const base = `seg-${String(segment.id)}`
  const slots = effectiveSlots(segment)
  const hint = slots.length === 0
    ? '四档价就是这一天 0–24 点的价。峰谷价用下面的 ＋ 加峰谷时段 加。'
    : `没被这 ${String(slots.length)} 个峰谷时段覆盖的时间，按上面的全天价算。`
  return (
    <div className="dtpl-price-seg" data-active={active}>
      <div className="dtpl-price-seg-head">
        <label className="dtpl-price-seg-date" htmlFor={`${base}-from`}>
          <input
            id={`${base}-from`}
            className="dtpl-price-input dtpl-price-input-date"
            type="datetime-local"
            step={3600}
            value={fromFieldValue(segment.from)}
            aria-label={`第 ${String(index + 1)} 段的生效时间`}
            title="生效时间精确到整点；分钟会向下取到整点。留空会按这条模型的首记整点填上"
            onChange={(event) => onChange({ ...segment, from: fromFieldInput(event.target.value) })}
          />
          <span className="dtpl-price-seg-date-k">生效时间</span>
        </label>
        <span className="dtpl-price-seg-tag">
          {fmtFrom(segment.from)}
          {active && <em className="dtpl-price-seg-live">当前生效</em>}
        </span>
        <span className="dtpl-price-seg-actions">
          <button type="button" className="dtpl-price-ghost" onClick={onDuplicate}>复制</button>
          <button
            type="button"
            className="dtpl-price-ghost dtpl-price-ghost-danger"
            onClick={onRemove}
            disabled={count <= 1}
            title={count <= 1 ? '删掉这一段等于让这条模型回到「价格未知」' : '删除这一段'}
          >
            删除
          </button>
        </span>
      </div>
      <div className="dtpl-price-sub">
        <span className="dtpl-price-sub-k">全天价<em>00:00–24:00</em></span>
      </div>
      <div className="dtpl-price-seg-rates">
        {CELLS.map(({ field, label }) => (
          <RateCell
            key={field}
            id={`${base}-${field}`}
            label={label}
            value={segment[field]}
            state={fieldState(segment, field)}
            context={`第 ${String(index + 1)} 段全天价`}
            onEdit={(next) => onChange({ ...segment, [field]: next })}
          />
        ))}
      </div>
      <div className="dtpl-price-slots">
        <span className="dtpl-price-slots-k">峰谷时段<em>留空的档位沿用上面的全天价</em></span>
        {segment.slots.map((slot, slotIndex) => (
          <SlotEditor
            key={slot.id}
            slot={slot}
            index={slotIndex}
            canRemove={isBlankSlot(slot) || slots.length > 1}
            inherited={inheritedRates(segment)}
            onChange={(next) => onChange({ ...segment, slots: segment.slots.map(item => (item.id === slot.id ? next : item)) })}
            onRemove={() => onChange({ ...segment, slots: segment.slots.filter(item => item.id !== slot.id) })}
            onDuplicate={() => onChange({ ...segment, slots: [...segment.slots, duplicateSlot(slot)] })}
          />
        ))}
        <div className="dtpl-price-slots-foot">
          <button
            type="button"
            className="dtpl-price-add"
            onClick={() => onChange({ ...segment, slots: [...segment.slots, newSlot()] })}
          >
            ＋ 加峰谷时段
          </button>
          <span className="dtpl-price-history-hint">{hint}</span>
        </div>
      </div>
      <label className="dtpl-price-seg-note" htmlFor={`${base}-note`}>
        <input
          id={`${base}-note`}
          className="dtpl-price-input dtpl-price-input-note"
          type="text"
          placeholder="备注（可选）"
          value={segment.note}
          aria-label={`第 ${String(index + 1)} 段的备注`}
          onChange={(event) => onChange({ ...segment, note: event.target.value })}
        />
      </label>
    </div>
  )
}

/** One model row: identity + marks | four editable cells | 调价史 disclosure. */
export const ModelRow = memo(function ModelRow({ route, row, baseline, open, onToggle, onChange }: {
  route: string
  row: ModelDraft
  /** Row signatures at the last write; the row derives its own 未保存 mark, so
   *  an untouched row keeps its identity and never re-renders. */
  baseline: ReadonlyMap<string, string>
  open: boolean
  onToggle: (route: string, model: string) => void
  onChange: (route: string, model: string, next: ModelDraft) => void
}) {
  const unpriced = isUnpriced(row)
  const dirty = modelDirty(route, row, baseline)
  const shown = editableSegment(row)
  const issue = rowIssue(row)
  const live = inForceToday(shown)
  const slots = shown === null ? 0 : effectiveSlots(shown).length
  // The model picker's split, applied to a price row: the human name is the
  // label, the exact string stays the identity (it is the billing key, so it
  // remains on screen rather than living in a tooltip). A string nothing names
  // — a 仅账本 row, or one only the price file mentions — is its own label.
  const named = row.name !== undefined && row.name !== '' && row.name !== row.model
  const meta: string[] = []
  if (shown !== null) meta.push(fmtRowFrom(shown.from))
  meta.push(row.records > 0 ? `账本 ${String(row.records)} 次` : '账本没记过')
  if (shown !== null && shown.note.trim() !== '') meta.push(shown.note.trim())
  // The meta line has no room for a sentence, so the one term it prints without
  // defining rides the hover: which account a 无起点 price reaches back over.
  const metaTitle = shown !== null && shown.from.trim() === ''
    ? `${meta.join(' · ')}｜「无起点」= 定价文件没写这份价的生效时间，这条模型的全部历史都按它算`
    : meta.join(' · ')

  const edit = (field: RateField, next: string): void => {
    if (shown === null) {
      // The first keystroke on an unpriced row writes its 最早一段 — or fills
      // the unfinished segment the user already added, so their choice of
      // effective time is respected instead of being shadowed by a new one.
      const pending = pendingSegment(row)
      if (pending !== null) {
        onChange(route, row.model, {
          ...row,
          segments: row.segments.map(item => (item.id === pending.id ? { ...item, [field]: next } : item)),
        })
        return
      }
      onChange(route, row.model, { ...row, segments: [...row.segments, blankSegment(field, next)] })
      return
    }
    onChange(route, row.model, {
      ...row,
      segments: row.segments.map(item => (item.id === shown.id ? { ...item, [field]: next } : item)),
    })
  }

  return (
    <>
      <div className="dtpl-price-row" data-dirty={dirty} data-unpriced={unpriced} data-open={open}>
        <div className="dtpl-price-id">
          {/* Line 1 is IDENTITY (name, or the exact string when nothing names
              it) plus the flags that change how the four numbers read. Line 2
              is PROVENANCE: the exact billing string, then the facts about the
              price. Splitting them this way is what lets a long model string
              live on the full width of the column instead of sharing one line
              with the name and getting clipped to `deepseek-v4-f…`. */}
          <span className="dtpl-price-name">
            <span
              className="dtpl-price-title"
              title={named ? `${row.name!}\n${row.model}` : row.model}
            >
              {named ? row.name : row.model}
            </span>
            {!row.configured && <span className="dtpl-price-badge">仅账本</span>}
            {unpriced && <span className="dtpl-price-badge dtpl-price-badge-unknown">价格未知</span>}
            {/* The two marks that decide whether the row's four numbers are the
                ones actually billing: both stay outside the truncating meta
                line, so they can never be ellipsized away. */}
            {slots > 0 && <span className="dtpl-price-badge dtpl-price-badge-slot">峰谷 {String(slots)} 段</span>}
            {shown !== null && !live && !unpriced && <span className="dtpl-price-badge dtpl-price-badge-idle">未生效</span>}
            {dirty && <span className="dtpl-price-badge dtpl-price-badge-dirty">未保存</span>}
          </span>
          <span className="dtpl-price-meta">
            {named && <span className="dtpl-price-model" title={row.model}>{row.model}</span>}
            {named && meta.length > 0 && <span className="dtpl-price-sep" aria-hidden="true">·</span>}
            {meta.length > 0 && (
              <span className="dtpl-price-meta-text" title={metaTitle}>{meta.join(' · ')}</span>
            )}
          </span>
        </div>
        <div className="dtpl-price-rates">
          {CELLS.map(({ field, label }) => (
            <RateCell
              key={field}
              id={`cell-${route}-${row.model}-${field}`}
              label={label}
              hint={label}
              value={shown === null ? '' : shown[field]}
              state={fieldState(shown, field)}
              context={row.model}
              onEdit={(next) => edit(field, next)}
            />
          ))}
        </div>
        <button
          type="button"
          className="dtpl-price-more"
          aria-expanded={open}
          aria-label={`${row.model} 的价段（${String(row.segments.length)} 段）`}
          title={row.segments.length > 1 ? `${String(row.segments.length)} 段价（调价史）` : '价格段、生效时间与峰谷时段'}
          onClick={() => onToggle(route, row.model)}
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
      </div>
      {open && (
        <div className="dtpl-price-history">
          <div className="dtpl-price-history-head">
            <span className="dtpl-price-history-model">{row.model}</span>
            <span className="dtpl-price-history-colid">生效时间 → 全天价（¥/百万词元）→ 峰谷时段</span>
          </div>
          {/* The axis heads the list it indexes: which interval is billing now,
              where the boundaries are, what sits past 今天, and how much of the
              ledger the price does not reach. */}
          <PriceTimeline row={row} activeId={shown === null ? null : shown.id} />
          {sortedSegments(row).map((segment, index) => (
            <SegmentEditor
              key={segment.id}
              segment={segment}
              index={index}
              count={row.segments.length}
              active={shown !== null && segment.id === shown.id}
              onChange={(next) => onChange(route, row.model, {
                ...row,
                segments: row.segments.map(item => (item.id === segment.id ? next : item)),
              })}
              onRemove={() => onChange(route, row.model, {
                ...row,
                segments: row.segments.filter(item => item.id !== segment.id),
              })}
              onDuplicate={() => onChange(route, row.model, {
                ...row,
                segments: [...row.segments, newSegment({
                  input: segment.input,
                  output: segment.output,
                  cacheRead: segment.cacheRead,
                  cacheWrite: segment.cacheWrite,
                  slots: segment.slots.map(slot => newSlot(slot)),
                  note: segment.note,
                })],
              })}
            />
          ))}
          <div className="dtpl-price-history-foot">
            <button
              type="button"
              className="dtpl-price-add"
              onClick={() => onChange(route, row.model, {
                ...row,
                segments: [...row.segments, newSegment()],
              })}
            >
              ＋ 加一段价（调价史）
            </button>
            <span className="dtpl-price-history-hint">
              {row.segments.length <= 1
                ? '只有一段时,行内四个数字就是这一段的全天价。加第二段即可做调价史。'
                : `${String(row.segments.length)} 段:行内显示当前生效的那一段,更早/更晚的在这里改。`}
            </span>
          </div>
        </div>
      )}
      {issue !== null && (
        <p className="dtpl-price-issue" role="alert">{row.model}:{issue}</p>
      )}
    </>
  )
})

/** One route card: a collapsible head (name, key, counts, 计费性质) over the
 *  model table. The head's chevron is the only way to fold it, so the switch
 *  beside it stays a switch. */
export const RouteCard = memo(function RouteCard({ card, baseline, collapsed, openKey, onToggleCard, onToggleRow, onRowChange, onBilling }: {
  card: RouteDraft
  /** Row signatures at the last write (see {@link ModelRow}). */
  baseline: ReadonlyMap<string, string>
  collapsed: boolean
  openKey: string | null
  onToggleCard: (route: string) => void
  onToggleRow: (route: string, model: string) => void
  onRowChange: (route: string, model: string, next: ModelDraft) => void
  onBilling: (route: string, billing: BillingNature) => void
}) {
  const models = [...card.models.values()]
  const priced = models.filter(model => !isUnpriced(model)).length
  const unknown = models.length - priced
  const panelId = `price-card-${card.route}`
  return (
    <article className="dtpl-price-card" data-route={card.route} data-collapsed={collapsed}>
      <header className="dtpl-price-head">
        <button
          type="button"
          className="dtpl-price-fold"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={() => onToggleCard(card.route)}
        >
          <span className="dtpl-price-caret" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
          <span className="dtpl-price-label">{card.label}</span>
          {card.label !== card.route && <span className="dtpl-price-key">{card.route}</span>}
          <span className="dtpl-price-count">
            {String(models.length)} 个模型 · 已定价 {String(priced)}
            {unknown > 0 ? ` · 价格未知 ${String(unknown)}` : ''}
            {card.records > 0 ? ` · 账本 ${String(card.records)} 次` : ''}
          </span>
        </button>
        <div
          className="dtpl-price-switch"
          role="group"
          aria-label={`${card.route} 的计费性质`}
          title="按量 = 金额是实际支出；订阅 = 金额是按此处价格折算的订阅价值（非现金）"
        >
          <button type="button" aria-pressed={card.billing === 'metered'} onClick={() => onBilling(card.route, 'metered')}>
            按量
          </button>
          <button type="button" aria-pressed={card.billing === 'subscription'} onClick={() => onBilling(card.route, 'subscription')}>
            订阅
          </button>
        </div>
      </header>
      <div className="dtpl-price-table" id={panelId} hidden={collapsed}>
        {models.length === 0
          ? <p className="dtpl-price-empty">这条通道没有列出可调用的模型，账本也没记过它。</p>
          : (
            <>
              <div className="dtpl-price-cols" aria-hidden="true">
                <span className="dtpl-price-col-id">模型</span>
                <span className="dtpl-price-rates">
                  {CELLS.map(({ field, label }) => <span key={field} className="dtpl-price-col-rate">{label}</span>)}
                </span>
                <span className="dtpl-price-col-more" />
              </div>
              <div className="dtpl-price-rows">
                {models.map(model => (
                  <ModelRow
                    key={model.model}
                    route={card.route}
                    row={model}
                    baseline={baseline}
                    open={openKey === `${card.route}\u0000${model.model}`}
                    onToggle={onToggleRow}
                    onChange={onRowChange}
                  />
                ))}
              </div>
            </>
          )}
      </div>
    </article>
  )
})
