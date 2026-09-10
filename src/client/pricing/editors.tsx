/**
 * The editing widgets of the 价格表 tab: the shared row/rate primitives, the
 * read-only price timeline, the one editor that adapts to whichever layer prices
 * the row, and the 高级-only creation forms (新增手工价 / 新增覆盖 / 同价通道).
 *
 * The editor's first control is the LAYER choice — 全局 · 模型层 vs 这条通道 ·
 * 覆盖层 — which replaces the old cross-surface jump buttons: the user decides
 * where a price lives inside the row they are already looking at.
 *
 * @module dsh-tokbook/client/pricing/editors
 */

import { useState, type ReactNode } from 'react'
import type { BillingNature, ChannelForm, ModelRates, PricingNow } from '../../types.ts'
import {
  BLANK_RATES, FIELD_LABELS, FIELD_ORDER, WEEKDAY_LABELS, clockToMinute, draftNow,
  draftToRates, fmtRate, minuteToClock, nextId, ruleStartSec, segmentIndexNow, spanText,
  type DraftRates, type DraftRule, type DraftSegment, type DraftSlot, type ManualDraft, type ProviderDraft, type RowStatus,
} from './draft.ts'

/** The per-row staged marker, shown in the row header so an unsaved change is
 *  visible without expanding the row. */
export function StagedTag({ staged }: { staged: RowStatus }) {
  if (staged === 'clean') return null
  return (
    <span
      className="dtpl-pricing-model-tag dtpl-pricing-model-tag-staged"
      title={staged === 'pending-delete' ? '保存后这条改动会被删除' : '这条改动还没有保存'}
    >
      {staged === 'pending-delete' ? '待删除' : '未保存'}
    </span>
  )
}

/** A collapsed deep-water section: the common fields stay visible, the full
 *  rule/timeline machinery waits behind this bar. */
export function Fold({ label, count, hint, children }: {
  label: string
  count?: number
  hint?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="dtpl-pricing-fold">
      <button type="button" className="dtpl-pricing-fold-bar" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span className="dtpl-pricing-fold-cue" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="dtpl-pricing-fold-label">{label}</span>
        {count !== undefined && count > 0 && <span className="dtpl-pricing-fold-count">{count}</span>}
        {hint !== undefined && <span className="dtpl-pricing-fold-hint">{hint}</span>}
      </button>
      {open && <div className="dtpl-pricing-fold-body">{children}</div>}
    </div>
  )
}

/** One rate cell: an editable <input> while the row is being edited, a plain
 *  value otherwise. The label is hidden on wide layouts (the column header names
 *  the column) and shown when the row stacks on a narrow screen. */
export function RateCell({ field, editing, value, onChange }: {
  field: keyof DraftRates
  editing: boolean
  value: string
  onChange: (value: string) => void
}) {
  return (
    <span className="dtpl-pricing-cell">
      <span className="dtpl-pricing-cell-label">{FIELD_LABELS[field]}</span>
      {editing ? (
        <input
          className="dtpl-pricing-input"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={value}
          title={`${FIELD_LABELS[field]}（¥/百万词元）`}
          aria-label={`${FIELD_LABELS[field]}单价（¥/百万词元）`}
          placeholder="—"
          onChange={event => onChange(event.target.value)}
        />
      ) : (
        <span className="dtpl-pricing-rate" title={`${FIELD_LABELS[field]}（¥/百万词元）`}>{value === '' ? '—' : value}</span>
      )}
    </span>
  )
}

/** Four staged rate inputs (输入 / 缓存读 / 缓存写 / 输出). */
export function RateFields({ rates, onChange }: {
  rates: DraftRates
  onChange: (rates: DraftRates) => void
}) {
  return (
    <div className="dtpl-pricing-fields">
      {FIELD_ORDER.map(field => (
        <label className="dtpl-pricing-field" key={field}>
          <span>{FIELD_LABELS[field]} ¥/M</span>
          <input
            className="dtpl-pricing-input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={rates[field]}
            aria-label={`${FIELD_LABELS[field]}单价（¥/百万词元）`}
            placeholder="—"
            onChange={event => onChange({ ...rates, [field]: event.target.value })}
          />
        </label>
      ))}
    </div>
  )
}

/** The staged rule-set editor of one model-layer hand row: the base slate lives
 *  in the row above, so this edits the price timeline and its peak windows. */
export function DraftRulesEditor({ draft, onPatch }: {
  draft: ManualDraft
  onPatch: (patch: (draft: ManualDraft) => ManualDraft) => void
}) {
  const patchRule = (id: string, patch: Partial<DraftRule>): void => {
    onPatch(current => ({ ...current, rules: current.rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule) }))
  }
  const patchSlotList = (ruleId: string | null, patch: (slots: DraftSlot[]) => DraftSlot[]): void => {
    onPatch(current => ruleId === null
      ? { ...current, slots: patch(current.slots) }
      : { ...current, rules: current.rules.map(rule => rule.id === ruleId ? { ...rule, slots: patch(rule.slots) } : rule) })
  }
  const addRule = (): void => {
    onPatch(current => {
      // Pre-fill the window with the base slate: the common case is a discount
      // on the normal price, so the user only edits what changes.
      const rule: DraftRule = { id: nextId(), label: '', from: '', to: '', rates: { ...current.base }, slots: [] }
      return { ...current, rules: [...current.rules, rule].sort((a, b) => ruleStartSec(a) - ruleStartSec(b)) }
    })
  }
  const addSlot = (ruleId: string | null): void => {
    onPatch(current => {
      // Same idea for a peak window: start from the price it applies to.
      const source = ruleId === null ? current.base : current.rules.find(rule => rule.id === ruleId)?.rates ?? current.base
      const slot: DraftSlot = { id: nextId(), label: '', days: [], windows: [{ start: '09:00', end: '12:00' }], rates: { ...source } }
      return ruleId === null
        ? { ...current, slots: [...current.slots, slot] }
        : { ...current, rules: current.rules.map(rule => rule.id === ruleId ? { ...rule, slots: [...rule.slots, slot] } : rule) }
    })
  }
  const removeSlot = (ruleId: string | null, id: string): void => {
    patchSlotList(ruleId, slots => slots.filter(slot => slot.id !== id))
  }
  const patchSlot = (ruleId: string | null, id: string, patch: Partial<DraftSlot>): void => {
    patchSlotList(ruleId, slots => slots.map(slot => slot.id === id ? { ...slot, ...patch } : slot))
  }

  return (
    <div className="dtpl-pricing-rules">
      <p className="dtpl-pricing-detail-hint">基础价 = 上方四档单价。下面可以加<b>限时/长期降价</b>和<b>高峰时段</b>（按本机时区）。</p>

      <div className="dtpl-pricing-rule-list">
        {draft.rules.map((rule, index) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            index={index}
            onPatch={patch => patchRule(rule.id, patch)}
            onRemove={() => onPatch(current => ({ ...current, rules: current.rules.filter(candidate => candidate.id !== rule.id) }))}
            onAddSlot={() => addSlot(rule.id)}
            onPatchSlot={(id, patch) => patchSlot(rule.id, id, patch)}
            onRemoveSlot={id => removeSlot(rule.id, id)}
          />
        ))}
      </div>
      <button type="button" className="dtpl-pricing-add" onClick={addRule}>+ 新增调价时段</button>

      <div className="dtpl-pricing-slot-block">
        <span className="dtpl-pricing-slot-title">峰谷时段（基础价之上，工作日/周末可分别设置）</span>
        {draft.slots.map((slot, index) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            index={index}
            onPatch={patch => patchSlot(null, slot.id, patch)}
            onRemove={() => removeSlot(null, slot.id)}
          />
        ))}
        <button type="button" className="dtpl-pricing-add" onClick={() => addSlot(null)}>+ 新增峰谷时段</button>
      </div>
    </div>
  )
}

/** One staged price window card: label, span and four rates. */
function RuleCard({ rule, index, onPatch, onRemove, onAddSlot, onPatchSlot, onRemoveSlot }: {
  rule: DraftRule
  index: number
  onPatch: (patch: Partial<DraftRule>) => void
  onRemove: () => void
  onAddSlot: () => void
  onPatchSlot: (id: string, patch: Partial<DraftSlot>) => void
  onRemoveSlot: (id: string) => void
}) {
  return (
    <div className="dtpl-pricing-rule">
      <div className="dtpl-pricing-rule-head">
        <span className="dtpl-pricing-rule-index">调价时段 {index + 1}</span>
        <input
          className="dtpl-pricing-input dtpl-pricing-label-input"
          type="text"
          value={rule.label}
          placeholder="标签（如 限时5折 / 第一次长期降价）"
          aria-label={`调价时段 ${String(index + 1)} 标签`}
          onChange={event => onPatch({ label: event.target.value })}
        />
        <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={onRemove}>删除</button>
      </div>
      <div className="dtpl-pricing-rule-grid">
        <label className="dtpl-pricing-field">
          <span>开始日期</span>
          <input className="dtpl-pricing-input" type="date" value={rule.from} aria-label="开始日期" onChange={event => onPatch({ from: event.target.value })} />
        </label>
        <label className="dtpl-pricing-field">
          <span>结束日期（空 = 永久）</span>
          <input className="dtpl-pricing-input" type="date" value={rule.to} aria-label="结束日期" onChange={event => onPatch({ to: event.target.value })} />
        </label>
      </div>
      <RateFields rates={rule.rates} onChange={rates => onPatch({ rates })} />

      <div className="dtpl-pricing-slot-block dtpl-pricing-slot-block-nested">
        <span className="dtpl-pricing-slot-title">该时段的峰谷（不设则整段一个价）</span>
        {rule.slots.map((slot, slotIndex) => (
          <SlotCard key={slot.id} slot={slot} index={slotIndex} onPatch={patch => onPatchSlot(slot.id, patch)} onRemove={() => onRemoveSlot(slot.id)} />
        ))}
        <button type="button" className="dtpl-pricing-add" onClick={onAddSlot}>+ 峰谷时段</button>
      </div>
    </div>
  )
}

/** One staged peak window card: label, weekdays, windows and four rates. */
function SlotCard({ slot, index, onPatch, onRemove }: {
  slot: DraftSlot
  index: number
  onPatch: (patch: Partial<DraftSlot>) => void
  onRemove: () => void
}) {
  const toggleDay = (day: number): void => {
    onPatch({ days: slot.days.includes(day) ? slot.days.filter(value => value !== day) : [...slot.days, day].sort((a, b) => a - b) })
  }
  const patchWindow = (windowIndex: number, patch: Partial<{ start: string; end: string }>): void => {
    onPatch({ windows: slot.windows.map((window, i) => i === windowIndex ? { ...window, ...patch } : window) })
  }
  return (
    <div className="dtpl-pricing-slot">
      <div className="dtpl-pricing-rule-head">
        <span className="dtpl-pricing-rule-index">峰谷 {index + 1}</span>
        <input
          className="dtpl-pricing-input dtpl-pricing-label-input"
          type="text"
          value={slot.label}
          placeholder="标签（如 工作日高峰）"
          aria-label={`峰谷时段 ${String(index + 1)} 标签`}
          onChange={event => onPatch({ label: event.target.value })}
        />
        <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={onRemove}>删除</button>
      </div>
      <div className="dtpl-pricing-days" role="group" aria-label="生效星期">
        <button type="button" className="dtpl-pricing-day dtpl-pricing-day-preset" onClick={() => onPatch({ days: [1, 2, 3, 4, 5] })}>工作日</button>
        <button type="button" className="dtpl-pricing-day dtpl-pricing-day-preset" onClick={() => onPatch({ days: [6, 7] })}>周末</button>
        <button type="button" className="dtpl-pricing-day dtpl-pricing-day-preset" onClick={() => onPatch({ days: [] })}>每天</button>
        <span className="dtpl-pricing-days-gap" aria-hidden="true" />
        {WEEKDAY_LABELS.map(([day, label]) => (
          <button
            key={day}
            type="button"
            className="dtpl-pricing-day"
            aria-pressed={slot.days.includes(day)}
            onClick={() => toggleDay(day)}
          >
            {label}
          </button>
        ))}
        <span className="dtpl-pricing-days-hint">{slot.days.length === 0 ? '每天' : ''}</span>
      </div>
      <div className="dtpl-pricing-windows">
        {slot.windows.map((window, windowIndex) => (
          <div className="dtpl-pricing-window" key={windowIndex}>
            <input className="dtpl-pricing-input dtpl-pricing-clock" type="time" value={window.start} aria-label="开始时间" onChange={event => patchWindow(windowIndex, { start: event.target.value })} />
            <span className="dtpl-pricing-window-sep">→</span>
            <input className="dtpl-pricing-input dtpl-pricing-clock" type="time" value={window.end} aria-label="结束时间" onChange={event => patchWindow(windowIndex, { end: event.target.value })} />
            <button
              type="button"
              className="dtpl-pricing-btn dtpl-pricing-remove"
              disabled={slot.windows.length <= 1}
              title={slot.windows.length <= 1 ? '至少保留一个窗口' : '删除这个窗口'}
              onClick={() => onPatch({ windows: slot.windows.filter((_, i) => i !== windowIndex) })}
            >
              删
            </button>
          </div>
        ))}
        <button type="button" className="dtpl-pricing-add" onClick={() => onPatch({ windows: [...slot.windows, { start: '14:00', end: '18:00' }] })}>+ 时间窗口</button>
      </div>
      <RateFields rates={slot.rates} onChange={rates => onPatch({ rates })} />
    </div>
  )
}

/** Read-only price timeline of one rule set (cloud mirror or a saved hand
 *  entry), with the window in force now highlighted. */
export function RuleTimeline({ rules, now, nowSec, emptyHint }: {
  rules: ModelRates | undefined
  now: PricingNow | null | undefined
  nowSec: number
  emptyHint?: string
}) {
  if (rules === undefined) {
    return <p className="dtpl-pricing-detail-hint">{emptyHint ?? '没有可显示的规则。'}</p>
  }
  const sorted = [...rules.timeRules].sort((a, b) => a.startTime - b.startTime)
  const covering = sorted.find(rule => rule.startTime <= nowSec && nowSec <= rule.endTime)
  const hasRules = sorted.length > 0 || rules.dailySlots.length > 0 || rules.contextTiers.length > 0
  return (
    <div className="dtpl-pricing-timeline">
      {emptyHint !== undefined && <p className="dtpl-pricing-detail-hint">{emptyHint}</p>}
      {!hasRules && <p className="dtpl-pricing-detail-hint">单一价格，没有调价时段或峰谷时段。</p>}
      {rules.contextTiers.length > 0 && (
        <p className="dtpl-pricing-detail-hint">云端此模型按上下文长度分档（≥{fmtRate(rules.contextTiers[0]!.threshold)} 词元起）；手工覆盖后分档不再生效。</p>
      )}

      {sorted.map(rule => {
        const active = covering === rule
        const flat = rule.dailySlots === undefined || rule.dailySlots.length === 0
        return (
          <div className={`dtpl-pricing-tl-row${active ? ' dtpl-pricing-tl-active' : ''}`} key={`${String(rule.startTime)}:${String(rule.endTime)}`}>
            <span className="dtpl-pricing-tl-label">{rule.label ?? '调价时段'}</span>
            <span className="dtpl-pricing-tl-span">{spanText(rule.startTime, rule.endTime)}</span>
            <span className="dtpl-pricing-tl-rates">
              入 ¥{fmtRate(rule.rates.inputPerMillion)} · 缓读 ¥{fmtRate(rule.rates.cacheReadPerMillion)} · 缓写 ¥{fmtRate(rule.rates.cacheWritePerMillion)} · 出 ¥{fmtRate(rule.rates.outputPerMillion)}
            </span>
            {active && <span className="dtpl-pricing-tl-badge">现在生效</span>}
            {flat && rule.startTime !== 0 && <span className="dtpl-pricing-tl-note">该时段无峰谷，整段一个价</span>}
            {(rule.dailySlots ?? []).map((slot, index) => (
              <span className="dtpl-pricing-tl-slot" key={index}>
                ↳ {slot.label ?? '峰谷'} · {slot.daysOfWeek === undefined || slot.daysOfWeek.length === 0 ? '每天' : slot.daysOfWeek.map(day => WEEKDAY_LABELS.find(([value]) => value === day)?.[1] ?? String(day)).join('')}
                {' '}{slot.windows.map(window => `${minuteToClock(window.startMinute)}–${minuteToClock(window.endMinute)}`).join('、')}
                {' '}入 ¥{fmtRate(slot.rates.inputPerMillion)} · 出 ¥{fmtRate(slot.rates.outputPerMillion)}
                {now?.peak === true && now.label === slot.label && <b className="dtpl-pricing-tl-badge">现在生效</b>}
              </span>
            ))}
          </div>
        )
      })}

      <div className={`dtpl-pricing-tl-row dtpl-pricing-tl-base${covering === undefined ? ' dtpl-pricing-tl-active' : ''}`}>
        <span className="dtpl-pricing-tl-label">基础价</span>
        <span className="dtpl-pricing-tl-span">以上时段之外</span>
        <span className="dtpl-pricing-tl-rates">
          入 ¥{fmtRate(rules.base.inputPerMillion)} · 缓读 ¥{fmtRate(rules.base.cacheReadPerMillion)} · 缓写 ¥{fmtRate(rules.base.cacheWritePerMillion)} · 出 ¥{fmtRate(rules.base.outputPerMillion)}
        </span>
        {covering === undefined && <span className="dtpl-pricing-tl-badge">现在生效</span>}
        {rules.dailySlots.map((slot, index) => (
          <span className="dtpl-pricing-tl-slot" key={index}>
            ↳ {slot.label ?? '峰谷'} · {slot.daysOfWeek === undefined || slot.daysOfWeek.length === 0 ? '每天' : slot.daysOfWeek.map(day => WEEKDAY_LABELS.find(([value]) => value === day)?.[1] ?? String(day)).join('')}
            {' '}{slot.windows.map(window => `${minuteToClock(window.startMinute)}–${minuteToClock(window.endMinute)}`).join('、')}
            {' '}入 ¥{fmtRate(slot.rates.inputPerMillion)} · 出 ¥{fmtRate(slot.rates.outputPerMillion)}
            {now?.peak === true && now.label === slot.label && <b className="dtpl-pricing-tl-badge">现在生效</b>}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * The ONE editor of a (通道, 模型串) row. Its first control is the layer the
 * price is written to; the body then edits that layer with its common fields up
 * front and the full rule machinery behind 高级.
 */
export function PriceEditor({ provider, overlay, manual, unpriced, rules, modelNames, seedRates, nowSec, onManualPatch, onOverlayPatch, onSetLayer, onStartManual, onDeleteManual, onDeleteOverride }: {
  provider: string
  /** Present when the overlay layer prices this row (i.e. the editor is on it). */
  overlay: ProviderDraft | undefined
  /** Present when the model layer holds a hand entry for this string. */
  manual: ManualDraft | undefined
  /** Nothing prices this row today (billed ¥0) — the editor says so. */
  unpriced: boolean
  /** The rule container the overlay follows (for the read-only timeline). */
  rules: ModelRates | undefined
  /** Base-table model ids offered by the 跟随官方价 field. */
  modelNames: readonly string[]
  /** Rates in force now — the seed for the first self-priced segment. */
  seedRates: DraftRates
  nowSec: number
  onManualPatch: (patch: (draft: ManualDraft) => ManualDraft) => void
  onOverlayPatch: (patch: Partial<ProviderDraft>) => void
  onSetLayer: (layer: 'model' | 'overlay') => void
  /** Start a model-layer hand entry for this string (nothing writes one until
   *  the user asks — switching layers must not invent a global price). */
  onStartManual: () => void
  onDeleteManual: () => void
  onDeleteOverride: () => void
}) {
  const layer: 'model' | 'overlay' = overlay !== undefined ? 'overlay' : 'model'
  const segmentIndex = overlay !== undefined && overlay.source === 'segments' ? segmentIndexNow(overlay.segments, nowSec) : -1

  const layerNote = layer === 'overlay'
    ? `只影响这条通道${provider === '' ? '' : `（${provider}）`}`
    : '全局：这条模型串的所有通道都按它计价'

  return (
    <div className="dtpl-pricing-editor">
      <div className="dtpl-pricing-layer" role="radiogroup" aria-label="这份价写在哪一层">
        <span className="dtpl-pricing-layer-lead">这份价写在</span>
        <button
          type="button"
          role="radio"
          aria-checked={layer === 'model'}
          className="dtpl-pricing-layer-opt"
          disabled={provider === ''}
          title={provider === '' ? '这条行没有通道路由，只能写在模型层' : '写在模型层：这条模型串的所有通道共用'}
          onClick={() => onSetLayer('model')}
        >
          全局 · 模型层
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={layer === 'overlay'}
          className="dtpl-pricing-layer-opt"
          disabled={provider === ''}
          title={provider === '' ? '这条行没有通道路由，无法写通道覆盖' : '写在这条通道：只改这一条路由的价'}
          onClick={() => onSetLayer('overlay')}
        >
          这条通道 · 覆盖层
        </button>
        <span className="dtpl-pricing-layer-note">{layerNote}</span>
      </div>

      {layer === 'overlay' && overlay !== undefined ? (
        <>
          <div className="dtpl-pricing-prov-editor-grid">
            <label className="dtpl-pricing-field">
              <span>计费方式</span>
              <select
                className="dtpl-pricing-input dtpl-pricing-select"
                value={overlay.billing}
                aria-label="计费性质"
                onChange={event => onOverlayPatch({ billing: event.target.value as BillingNature })}
              >
                <option value="metered">按量（实际支出）</option>
                <option value="subscription">订阅（算作价值）</option>
              </select>
            </label>
            <label className="dtpl-pricing-field">
              <span>价格从哪来</span>
              <select
                className="dtpl-pricing-input dtpl-pricing-select"
                value={overlay.source}
                aria-label="价格来源"
                onChange={event => {
                  const source = event.target.value as ProviderDraft['source']
                  // Switching to a self-priced timeline starts from ONE open
                  // segment carrying today's price, so the row's four cells have
                  // something to edit right away.
                  if (source === 'segments' && overlay.segments.length === 0) {
                    onOverlayPatch({ source, segments: [{ id: nextId(), from: '', to: '', rates: { ...seedRates }, note: '' }] })
                  } else {
                    onOverlayPatch({ source })
                  }
                }}
              >
                <option value="inherit">跟随官方价（含调价史/峰谷）</option>
                <option value="segments">自己填价（逐段固定价）</option>
              </select>
            </label>
          </div>

          {overlay.source === 'inherit' ? (
            <>
              <label className="dtpl-pricing-field dtpl-pricing-field-wide">
                <span>跟随哪个模型的价</span>
                <input
                  className="dtpl-pricing-input"
                  type="text"
                  list="dtpl-pricing-model-ids"
                  value={overlay.inheritBase}
                  aria-label="跟随基准模型"
                  onChange={event => onOverlayPatch({ inheritBase: event.target.value })}
                />
                <datalist id="dtpl-pricing-model-ids">
                  {modelNames.map(name => <option key={name} value={name} />)}
                </datalist>
              </label>
              <RuleTimeline
                rules={rules}
                now={undefined}
                nowSec={nowSec}
                emptyHint={rules === undefined ? '云端基准价表里没有这个模型，跟随不会生效。' : undefined}
              />
            </>
          ) : (
            <>
              <p className="dtpl-pricing-detail-hint">
                {segmentIndex >= 0
                  ? '上方四档单价编辑的是「现在生效」的那一段；更长的调价史收在下面。'
                  : '现在没有生效的价格时段（上方四档只读）：在下面加一段覆盖此刻的时段。'}
              </p>
              <Fold label="价格时段" count={overlay.segments.length} hint="多段自定时间轴">
                <SegmentEditor draft={overlay} onPatch={onOverlayPatch} />
              </Fold>
            </>
          )}

          <div className="dtpl-pricing-detail-actions">
            <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={onDeleteOverride} title="删除这条通道覆盖，回到模型层/云端">删除覆盖</button>
          </div>
        </>
      ) : manual !== undefined ? (
        <>
          <p className="dtpl-pricing-detail-hint">
            基础价 = 上方四档单价，对所有通道生效。展开下面可以加限时/长期降价与高峰时段。
          </p>
          <RuleTimeline
            rules={draftToRates(manual)}
            now={draftNow(manual)}
            nowSec={nowSec}
            emptyHint="这条手工价只有一个价，没有限时降价或高峰时段。"
          />
          <Fold
            label="调价时段与峰谷"
            count={manual.rules.length + manual.slots.length}
            hint="限时降价 / 工作日高峰"
          >
            <DraftRulesEditor draft={manual} onPatch={onManualPatch} />
          </Fold>
          <div className="dtpl-pricing-detail-actions">
            <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={onDeleteManual} title="删除这条手工价，回到云端/价格未知">删除手工价</button>
          </div>
        </>
      ) : (
        <div className="dtpl-pricing-detail-hint dtpl-pricing-start">
          <span>模型层还没有这条串的条目，现在{unpriced ? '价格未知（暂按 ¥0 计，不是免费）' : '按云端基准价表计价'}。</span>
          <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={onStartManual}>新增全局手工价</button>
        </div>
      )}
    </div>
  )
}

/** The staged segment timeline of one overlay draft. */
function SegmentEditor({ draft, onPatch }: {
  draft: ProviderDraft
  onPatch: (patch: Partial<ProviderDraft>) => void
}) {
  const patchSegment = (id: string, patch: Partial<DraftSegment>): void => {
    onPatch({ segments: draft.segments.map(segment => segment.id === id ? { ...segment, ...patch } : segment) })
  }
  return (
    <div className="dtpl-pricing-segments">
      {draft.segments.map((segment, index) => (
        <div className="dtpl-pricing-rule" key={segment.id}>
          <div className="dtpl-pricing-rule-head">
            <span className="dtpl-pricing-rule-index">价格时段 {index + 1}</span>
            <input
              className="dtpl-pricing-input dtpl-pricing-label-input"
              type="text"
              value={segment.note}
              placeholder="备注（如 中转真实价）"
              aria-label={`价格时段 ${String(index + 1)} 备注`}
              onChange={event => patchSegment(segment.id, { note: event.target.value })}
            />
            <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={() => onPatch({ segments: draft.segments.filter(candidate => candidate.id !== segment.id) })}>删除</button>
          </div>
          <div className="dtpl-pricing-rule-grid">
            <label className="dtpl-pricing-field">
              <span>开始日期（空 = 自始）</span>
              <input className="dtpl-pricing-input" type="date" value={segment.from} aria-label="时段开始日期" onChange={event => patchSegment(segment.id, { from: event.target.value })} />
            </label>
            <label className="dtpl-pricing-field">
              <span>结束日期（空 = 永久）</span>
              <input className="dtpl-pricing-input" type="date" value={segment.to} aria-label="时段结束日期" onChange={event => patchSegment(segment.id, { to: event.target.value })} />
            </label>
          </div>
          <RateFields rates={segment.rates} onChange={rates => patchSegment(segment.id, { rates })} />
        </div>
      ))}
      <button
        type="button"
        className="dtpl-pricing-add"
        onClick={() => onPatch({ segments: [...draft.segments, { id: nextId(), from: '', to: '', rates: { ...BLANK_RATES }, note: '' }] })}
      >
        + 新增价格时段
      </button>
    </div>
  )
}

/** 新增手工价: name a model string the ledger may not have billed yet and write
 *  a hand price for it (deep water — the common path is 改这条价 on a row). */
export function AddModelForm({ onAdd }: { onAdd: (model: string) => void }) {
  const [name, setName] = useState('')
  const submit = (): void => {
    const model = name.trim()
    if (model === '') return
    onAdd(model)
    setName('')
  }
  return (
    <div className="dtpl-pricing-add-model">
      <span className="dtpl-pricing-slot-title">新增手工价（模型层，全局）</span>
      <div className="dtpl-pricing-add-override-row">
        <input
          className="dtpl-pricing-input"
          type="text"
          placeholder="账本里的精确模型串"
          value={name}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
          aria-label="新增模型名"
        />
        <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" disabled={name.trim() === ''} onClick={submit}>添加</button>
      </div>
    </div>
  )
}

/** 新增覆盖: create an overlay entry for a (route, model) pair the mirror never
 *  named (a private relay, a new subscription channel). */
export function AddOverrideForm({ providers, onAdd }: {
  providers: readonly string[]
  onAdd: (provider: string, model: string) => void
}) {
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const ready = provider.trim() !== '' && model.trim() !== ''
  return (
    <div className="dtpl-pricing-add-override">
      <span className="dtpl-pricing-slot-title">新增覆盖（通道 + 精确模型串）</span>
      <div className="dtpl-pricing-add-override-row">
        <input
          className="dtpl-pricing-input"
          type="text"
          list="dtpl-provider-names"
          value={provider}
          placeholder="通道路由键"
          aria-label="通道路由键"
          onChange={event => setProvider(event.target.value)}
        />
        <datalist id="dtpl-provider-names">
          {providers.map(name => <option value={name} key={name} />)}
        </datalist>
        <input
          className="dtpl-pricing-input"
          type="text"
          value={model}
          placeholder="精确模型串"
          aria-label="精确模型串"
          onChange={event => setModel(event.target.value)}
        />
        <button
          type="button"
          className="dtpl-pricing-btn dtpl-pricing-custom"
          disabled={!ready}
          onClick={() => { onAdd(provider.trim(), model.trim()); setModel('') }}
        >
          添加
        </button>
      </div>
    </div>
  )
}

/** 同价通道: one route follows another's prices (the same plan bought twice,
 *  where each imported key is its own route). */
export function AliasSection({ names, aliases, forms, onAdd, onRemove }: {
  names: readonly string[]
  aliases: ReadonlyMap<string, string>
  forms: Record<string, ChannelForm>
  onAdd: (route: string, target: string) => void
  onRemove: (route: string) => void
}) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const targeted = new Set(aliases.values())
  // A route already following something is not a source, and a route someone
  // already follows is not a source either (that would make a chain). A mirror
  // wrapper is excluded from both sides: it already follows its target, and it
  // owns no entries of its own for a hand route to inherit.
  const sourceCandidates = names.filter(name => !aliases.has(name) && !targeted.has(name) && forms[name] !== 'wrapper')
  const targetCandidates = names.filter(name => !aliases.has(name) && forms[name] !== 'wrapper')
  return (
    <section className="dtpl-pricing-alias" aria-label="同价通道">
      <div className="dtpl-pricing-alias-head">
        <span className="dtpl-pricing-alias-title">同价通道</span>
        <span className="dtpl-pricing-alias-hint">一条路由跟随另一条的价格；同款套餐买多份时只维护一处</span>
      </div>
      {aliases.size > 0 && (
        <div className="dtpl-pricing-alias-list">
          {[...aliases].map(([route, canonical]) => (
            <span className="dtpl-pricing-alias-item" key={route}>
              <span className="dtpl-pricing-alias-route" title={route}>{route}</span>
              <span className="dtpl-pricing-alias-arrow" aria-hidden="true">跟随</span>
              <span className="dtpl-pricing-alias-route" title={canonical}>{canonical}</span>
              <button
                type="button"
                className="dtpl-pricing-alias-remove"
                onClick={() => onRemove(route)}
                title="取消跟随"
                aria-label={`取消「${route}」跟随「${canonical}」`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="dtpl-pricing-alias-add">
        <select
          className="dtpl-pricing-input dtpl-pricing-select"
          value={source}
          onChange={event => setSource(event.target.value)}
          aria-label="要跟随别的价格的路由"
        >
          <option value="">选择路由…</option>
          {sourceCandidates.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <span className="dtpl-pricing-alias-arrow" aria-hidden="true">跟随</span>
        <select
          className="dtpl-pricing-input dtpl-pricing-select"
          value={target}
          onChange={event => setTarget(event.target.value)}
          aria-label="被跟随的路由"
        >
          <option value="">选择被跟随的路由…</option>
          {targetCandidates.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <button
          type="button"
          className="dtpl-pricing-btn"
          onClick={() => { onAdd(source, target); setSource(''); setTarget('') }}
          disabled={source === '' || target === '' || source === target}
        >
          添加
        </button>
      </div>
    </section>
  )
}
