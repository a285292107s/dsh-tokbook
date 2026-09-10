/**
 * Row primitives of the 价格表 tab: the four numeric cells (editable in place),
 * one price segment's editor, one model row, and one route card.
 *
 * The row IS the table: identity on the left, the four ¥/M buckets as aligned
 * tabular cells, and a disclosure that opens the row's 调价史. Nothing here
 * owns state — the panel does, and hands down small callbacks.
 *
 * @module dsh-tokbook/client/pricing/editors
 */

import { memo } from 'react'
import type { BillingNature } from '../../types.ts'
import {
  editableSegment, fieldState, inForceToday, isUnpriced, modelDirty, newSegment, rowIssue, sortedSegments,
  type ModelDraft, type RateField, type RouteDraft, type SegmentDraft,
} from './draft.ts'

/** The four ¥/M buckets, in the order every surface writes them. */
export const RATE_FIELDS = [
  { key: 'input', label: '输入' },
  { key: 'output', label: '输出' },
  { key: 'cacheRead', label: '缓存读' },
  { key: 'cacheWrite', label: '缓存写' },
] as const

/** The row's four cells, in column order. */
const CELLS: ReadonlyArray<{ field: RateField; label: string }> = RATE_FIELDS.map(({ key, label }) => ({ field: key, label }))

/** One numeric cell, edited in place: it reads as text until focused, so 50
 *  rows stay calm while every value is one click (or Tab) away. */
function RateCell({ id, label, hint, value, state, context, onEdit }: {
  id: string
  label: string
  /** The static header this cell belongs to (for screen readers). */
  hint?: string
  value: string
  state: 'ok' | 'empty' | 'bad' | 'readonly'
  context: string
  onEdit?: (next: string) => void
}) {
  const errorId = `${id}-err`
  const message = state === 'bad' ? `${label}必须是非负数字（¥/百万词元）` : undefined
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
        placeholder="—"
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

/** One price segment of the 调价史: date + four rates + note. Actions appear on
 *  hover or keyboard focus (they stay reachable, never hover-only). */
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
  return (
    <div className="dtpl-price-seg" data-active={active}>
      <div className="dtpl-price-seg-head">
        <label className="dtpl-price-seg-date" htmlFor={`${base}-from`}>
          <input
            id={`${base}-from`}
            className="dtpl-price-input dtpl-price-input-date"
            type="date"
            value={segment.from}
            aria-label={`第 ${String(index + 1)} 段的生效日期`}
            onChange={(event) => onChange({ ...segment, from: event.target.value })}
          />
          <span className="dtpl-price-seg-date-k">生效日期</span>
        </label>
        <span className="dtpl-price-seg-tag">
          {segment.from === '' ? '最早一段' : `${segment.from} 起`}
          {active && <em className="dtpl-price-seg-live">当前生效</em>}
        </span>
        <span className="dtpl-price-seg-actions">
          <button type="button" className="dtpl-price-ghost" onClick={onDuplicate}>复制</button>
          <button
            type="button"
            className="dtpl-price-ghost dtpl-price-ghost-danger"
            onClick={onRemove}
            disabled={count <= 1}
            title={count <= 1 ? '删掉这一段等于让这条模型回到「未定价」' : '删除这一段'}
          >
            删除
          </button>
        </span>
      </div>
      <div className="dtpl-price-seg-rates">
        {CELLS.map(({ field, label }) => (
          <RateCell
            key={field}
            id={`${base}-${field}`}
            label={label}
            value={segment[field]}
            state={fieldState(segment, field)}
            context={`第 ${String(index + 1)} 段`}
            onEdit={(next) => onChange({ ...segment, [field]: next })}
          />
        ))}
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
  const meta: string[] = []
  if (shown !== null) meta.push(shown.from === '' ? '最早一段起' : `${shown.from} 起`)
  meta.push(row.records > 0 ? `账本 ${String(row.records)} 次` : '账本没记过')
  if (shown !== null && !live && !unpriced) meta.push('未生效')
  if (shown !== null && shown.note.trim() !== '') meta.push(shown.note.trim())

  const edit = (field: RateField, next: string): void => {
    if (shown === null) {
      // The first keystroke on an unpriced row writes its 最早一段.
      onChange(route, row.model, {
        ...row,
        segments: [{ id: Math.max(0, ...row.segments.map(item => item.id)) + 1, from: '', input: '', output: '', cacheRead: '', cacheWrite: '', note: '', [field]: next }],
      })
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
          <span className="dtpl-price-name">
            <span className="dtpl-price-model" title={row.model}>{row.model}</span>
            {!row.configured && <span className="dtpl-price-badge">仅账本</span>}
            {unpriced && <span className="dtpl-price-badge dtpl-price-badge-unknown">未定价</span>}
            {dirty && <span className="dtpl-price-badge dtpl-price-badge-dirty">未保存</span>}
          </span>
          <span className="dtpl-price-meta">{meta.join(' · ')}</span>
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
          title={row.segments.length > 1 ? `${String(row.segments.length)} 段价（调价史）` : '价格段与生效日期'}
          onClick={() => onToggle(route, row.model)}
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
      </div>
      {open && (
        <div className="dtpl-price-history">
          <div className="dtpl-price-history-head">
            <span className="dtpl-price-history-model">{row.model}</span>
            <span className="dtpl-price-history-colid">生效日期 → 输入 / 输出 / 缓存读 / 缓存写（¥/百万词元）</span>
          </div>
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
                ? '只有一段时,行内四个数字就是这一段。加第二段即可做调价史。'
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
            {unknown > 0 ? ` · 未定价 ${String(unknown)}` : ''}
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
