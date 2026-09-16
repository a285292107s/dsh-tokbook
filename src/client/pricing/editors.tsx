/**
 * 价格表 tab 的行原语：四个数字单元格、价格段编辑器、模型行、route 卡。
 *
 * 行**就是**表：单元格始终编辑当前生效段的**全天价**，峰谷价住在抽屉内。本文件不持有状态：面板持有，通过小回调下发。峰谷时段只重写有差异的桶，留空的桶显示段的全天价作 placeholder——使「继承」可见。
 *
 * @module dsh-tokbook/client/pricing/editors
 */

import { memo } from 'react'
import { DAY_SET_LABELS, DAY_SETS, clockLabel } from '../../price-format.ts'
import type { BillingNature, DaySet } from '../../types.ts'
import {
  blankSegment, duplicateSlot, editableSegment, effectiveSlots, fieldState, fmtFrom, fromFieldInput,
  fromFieldValue, inForceToday, inheritedRates, isBlankSlot, isUnpriced, modelDirty, newSegment, newSlot,
  pendingSegment, rowIssue, sortedSegments, withSlotEnd, withSlotStart,
  type ModelDraft, type RateField, type RateTexts, type RouteDraft, type SegmentDraft, type SlotDraft,
} from './draft.ts'
import { PriceTimeline } from './Timeline.tsx'

/** 四个 ¥/M 桶，按所有 surface 书写顺序。 */
export const RATE_FIELDS = [
  { key: 'input', label: '输入' },
  { key: 'output', label: '输出' },
  { key: 'cacheRead', label: '缓存读' },
  { key: 'cacheWrite', label: '缓存写' },
] as const

/** 行的四个单元格，按列顺序。 */
const CELLS: ReadonlyArray<{ field: RateField; label: string }> = RATE_FIELDS.map(({ key, label }) => ({ field: key, label }))

/** 时段可选的全部开始小时与结束小时（结束不含，`24:00` 关日）。 */
const START_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour)
const END_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour + 1)

/** 一个数字单元格，原地编辑：聚焦前读作文本，50 行保持平静，而每个值一次点击（或 Tab）即达。 */
function RateCell({ id, label, hint, value, state, context, placeholder, note, onEdit }: {
  id: string
  label: string
  /** 该单元格所属的静态表头（无障碍用）。 */
  hint?: string
  value: string
  state: 'ok' | 'empty' | 'bad' | 'readonly'
  context: string
  /** 单元格为空时显示。峰谷时段把全天价传到这里，「空 = 继承」可见。 */
  placeholder?: string
  /** 悬停时解释此上下文中空单元格的含义。 */
  note?: string
  onEdit?: (next: string) => void
}) {
  const errorId = `${id}-err`
  // 可见消息保持简短，不撑窄 rate 列；完整句子挂在 input 的 title 上，行下方的问题行以全宽重复第一个问题。
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
          // Enter 离开单元格（值已暂存）。
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      {message !== undefined && <span id={errorId} className="dtpl-price-cell-err" role="alert">{message}</span>}
    </div>
  )
}

/** 一个峰谷时段：适用星期、覆盖小时、重写的桶。费率布局与上方全天价行完全相同——留空的桶显示它沿用的全天价。 */
function SlotEditor({ slot, index, canRemove, inherited, onChange, onRemove, onDuplicate }: {
  slot: SlotDraft
  index: number
  /** 是否可删除（未完成的草稿永远可以；最后一个有价时段不行，否则会悄悄丢掉那个窗口）。 */
  canRemove: boolean
  /** 段的全天价，作为空单元格的 placeholder。 */
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

/** 调价史中的一个价格段：生效时刻、全天价、峰谷时段、备注。操作在 hover 或键盘聚焦时出现（始终可达，非仅 hover）。 */
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
        <span className="dtpl-price-slots-k">峰谷时段<em className="dtpl-price-slots-note">留空的档位沿用上面的全天价</em></span>
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

/** 一个模型行：身份 + 标记 | 四个可编辑单元格 | 调价史展开。 */
export const ModelRow = memo(function ModelRow({ route, row, baseline, open, onToggle, onChange }: {
  route: string
  row: ModelDraft
  /** 上次写入时的行签名；行自己推导未保存标记，未触碰的行保持引用、不 re-render。 */
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
  // 行的身份**只打印一个**：有人命名该串时显示展示名，否则显示精确串本身。精确串仍是账本的计费键，保持可达：hover 标签与每个单元格的无障碍名称。
  const named = row.name !== undefined && row.name !== '' && row.name !== row.model
  // 第二行只放这段价的来龙去脉：账本次数与备注。生效时间**不在行上**——四格编辑的是当前生效那一段
  // （工具栏图例说过一次），而它的起点在抽屉的段编辑器与时间轴上比半行字说得更完整。
  const meta: string[] = []
  meta.push(row.records > 0 ? `账本 ${String(row.records)} 次` : '账本没记过')
  if (shown !== null && shown.note.trim() !== '') meta.push(shown.note.trim())
  const metaText = meta.join(' · ')

  const edit = (field: RateField, next: string): void => {
    if (shown === null) {
      // 无定价行上的第一次按键写入最早一段——或填充用户已加的未完成段，使其选择的生效时间被尊重。
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
      <div className="dtpl-price-row" data-dirty={dirty} data-open={open}>
        <div className="dtpl-price-id">
          {/* 第 1 行是身份（有人命名时显示展示名，否则精确串）加上标记。第 2 行是出处。一个身份一行：打印名称**和**精确串等于说两遍。 */}
          <span className="dtpl-price-name">
            <span
              className="dtpl-price-title"
              title={named ? `${row.name!}\n${row.model}` : row.model}
            >
              {named ? row.name : row.model}
            </span>
            {!row.configured && <span className="dtpl-price-badge">仅账本</span>}
            {unpriced && <span className="dtpl-price-badge dtpl-price-badge-unknown">价格未知</span>}
            {/* 两个决定行内四个数字是否真正在计费的标记：始终在会截断的 meta 行之外。 */}
            {slots > 0 && <span className="dtpl-price-badge dtpl-price-badge-slot">峰谷 {String(slots)} 段</span>}
            {shown !== null && !live && !unpriced && <span className="dtpl-price-badge dtpl-price-badge-idle">未生效</span>}
            {dirty && <span className="dtpl-price-badge dtpl-price-badge-dirty">未保存</span>}
          </span>
          <span className="dtpl-price-meta">
            {/* 这一行会被压缩截断尾部，title 兜住全文。 */}
            <span className="dtpl-price-meta-text" title={metaText}>{metaText}</span>
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
          {/* 轴统领它索引的列表：哪个区间在计费、边界在哪、今天之后是什么、价够不到账本的哪部分。 */}
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
                ? '只有一段时，行内四个数字就是这一段的全天价。加第二段即可做调价史。'
                : `${String(row.segments.length)} 段：行内显示当前生效的那一段，更早/更晚的在这里改。`}
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

/** 一张 route 卡：可折叠的头（名称、key、计数、计费性质）盖在模型表上。头上的 chevron 是唯一的折叠方式，旁边保持为开关。 */
export const RouteCard = memo(function RouteCard({ card, baseline, collapsed, openKey, onToggleCard, onToggleRow, onRowChange, onBilling }: {
  card: RouteDraft
  /** 上次写入时的行签名（见 {@link ModelRow}）。 */
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
    <article className="dtpl-price-card" data-collapsed={collapsed}>
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
