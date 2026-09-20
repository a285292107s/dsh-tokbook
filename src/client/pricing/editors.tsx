/**
 * 价格表 tab 的行原语：此刻生效的四档价、价格段编辑器、模型行、route 卡。
 *
 * 行内四个数字只读（生效段叠上此刻生效的峰谷时段），改价一律走展开的抽屉；抽屉第一张是**托底价**
 * （没有生效时刻），往下的每张从某个时刻起生效。本文件不持有状态：面板持有，通过小回调下发。
 */

import { memo, useEffect, useId, useState } from 'react'
import { DAY_SET_LABELS, DAY_SETS, clockLabel, isHourRange, rangeLabel } from '../../price-format.ts'
import type { BillingNature, DaySet } from '../../types.ts'
import {
  duplicateSlot, effectiveSlots, fieldState, fromFieldValue, inheritedRates, isBlankSlot,
  isFloorSegment, modelDirty, newSegment, newSlot, priceUnknown, ratesInForce, rowIssue, rowKey, slotRange,
  sortedSegments, withSegmentFrom, withSlotEnd, withSlotStart,
  type ModelDraft, type RateField, type RateTexts, type RouteDraft, type SegmentDraft, type SlotDraft,
} from './draft.ts'
import { PriceTimeline } from './Timeline.tsx'

/** 行的四个 ¥/M 单元格，按所有 surface 的书写顺序（列头 / 行内只读价 / 抽屉里的输入框）。 */
const CELLS: ReadonlyArray<{ field: RateField; label: string }> = [
  { field: 'input', label: '输入' },
  { field: 'output', label: '输出' },
  { field: 'cacheRead', label: '缓存读' },
  { field: 'cacheWrite', label: '缓存写' },
]

/** 时段可选的全部开始小时与结束小时（结束不含，`24:00` 关日）。 */
const START_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour)
const END_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour + 1)

/** 抽屉里的一个数字单元格，原地编辑。行内那个只读的对应物是 {@link RateValue}。 */
function RateCell({ id, label, hint, value, state, context, placeholder, note, onEdit }: {
  id: string
  label: string
  /** 该单元格所属的静态表头（无障碍用）。 */
  hint?: string
  value: string
  state: 'ok' | 'empty' | 'bad'
  context: string
  /** 单元格为空时显示。峰谷时段把全天价传到这里，「空 = 继承」可见。 */
  placeholder?: string
  /** 悬停时解释此上下文中空单元格的含义。 */
  note?: string
  onEdit?: (next: string) => void
}) {
  const errorId = `${id}-err`
  // 可见消息要短（不撑窄 rate 列）；完整句子挂在 title，行下方的问题行重复第一个问题。
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

/** 行内的一个价：只读。列名跟着读屏（`.dtpl-sr`），窄屏下同一份文字变成可见的小标签。 */
function RateValue({ label, value }: {
  label: string
  value: string
}) {
  const text = value.trim()
  return (
    <div className="dtpl-price-cell">
      <span className="dtpl-sr dtpl-price-value-k">{`${label} `}</span>
      <span className="dtpl-price-value" data-empty={text === ''}>
        {text === '' ? '—' : text}
      </span>
    </div>
  )
}

/** 24 小时表盘：全天价与峰谷时段共用（全天是满弧，峰谷是它身上被改写的那一段）。
 *  时间不成段（草稿态）时只剩淡环与刻钉，不画半截弧。 */
function ClockRing({ start, end, label }: {
  start: number
  end: number
  /** 读屏与悬停说的覆盖范围；不成段时组件自己换文案。 */
  label: string
}) {
  const valid = isHourRange({ start, end })
  const r = 16
  const c = 2 * Math.PI * r
  return (
    <svg
      className="dtpl-price-slot-ring"
      viewBox="0 0 40 40" width="40" height="40"
      role="img"
      aria-label={valid ? `覆盖 ${label}` : '时间未成段'}
    >
      {valid && <title>{`覆盖 ${label}（${String(end - start)} 小时）`}</title>}
      <circle className="dtpl-price-slot-ring-track" cx="20" cy="20" r={r} />
      {valid && (
        <circle
          className="dtpl-price-slot-ring-arc"
          cx="20" cy="20" r={r}
          strokeDasharray={`${(c * (end - start)) / 24} ${c}`}
          strokeDashoffset={-(c * start) / 24}
          transform="rotate(-90 20 20)"
        />
      )}
      <line className="dtpl-price-slot-ring-zero" x1="20" y1="2" x2="20" y2="6.5" />
    </svg>
  )
}

/** 一个峰谷时段：适用星期、覆盖小时、重写的桶。费率布局与上方全天价行相同——留空的桶显示它沿用的全天价。 */
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
  const { start, end } = slotRange(slot)
  // 删除要两下：它改的是历史金额，账本没有撤销。聚焦离开即取消。
  const [confirming, setConfirming] = useState(false)
  const inherit = (field: RateField): string | undefined => {
    const value = inherited[field].trim()
    return value === '' ? undefined : value
  }
  return (
    <div className="dtpl-price-slot">
      {/* 盘只说得出小时区间；日档进可访问名，不进盘（见 ClockRing）。 */}
      <ClockRing start={start} end={end} label={`${DAY_SET_LABELS[slot.days]} ${rangeLabel({ start, end })}`} />
      <div className="dtpl-price-slot-body">
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
                ? '删掉最后一个有价的时段，这段覆盖的时间回到全天价'
                : confirming
                  ? '再点一次：这个时段会被删掉，它覆盖的小时回到全天价'
                  : '删除这个峰谷时段（需再点一次确认）'}
            >
              {confirming ? '确认删除' : '删除'}
            </button>
          </span>
        </div>
        <div className="dtpl-price-rates dtpl-price-slot-rates">
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
    </div>
  )
}

/** 抽屉里的一张价：托底价（没有生效时刻、不可删）或一段调价（生效时刻、可删）。 */
function SegmentEditor({ segment, where, serial, floor, active, onChange, onRemove, onDuplicate }: {
  segment: SegmentDraft
  /** 这一张的名分：「托底价」或「第 N 段调价」——出现在每个单元格的无障碍名称里。 */
  where: string
  /** 台账序号（托底价是 00）——纯视觉的扫读列。 */
  serial: string
  /** 是不是托底价那一张（无生效时刻，且不提供删除）。 */
  floor: boolean
  active: boolean
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
          {floor
            ? <span className="dtpl-price-seg-floor-k">托底价</span>
            : (
              <label className="dtpl-price-seg-date" htmlFor={`${base}-from`}>
                <input
                  id={`${base}-from`}
                  className="dtpl-price-input dtpl-price-input-date"
                  type="datetime-local"
                  step={3600}
                  value={fromFieldValue(segment.from)}
                  aria-label={`${where}的生效时间`}
                  title="生效时间精确到整点，分钟向下取到整点；点进日期或时间数字段可直接键入，方向键逐步增减；清空不生效——想要一段管全部时间，改的是第一张托底价"
                  onChange={(event) => onChange(withSegmentFrom(segment, event.target.value))}
                />
              </label>
            )}
          {active && <span className="dtpl-price-badge dtpl-price-badge-live">当前生效</span>}
        </span>
        {/* 段的复制/删除挂在身份行的右轨上，常显（不只在悬停时存在）。 */}
        <span className="dtpl-price-seg-tools">
          <button type="button" className="dtpl-price-ghost" onClick={onDuplicate}>复制</button>
          {!floor && (
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
                ? '再点一次：这一段调价会被删掉，它覆盖的时间回到上一段（或托底价）'
                : '删除这一段调价（需再点一次确认）'}
            >
              {confirming ? '确认删除' : '删除'}
            </button>
          )}
        </span>
      </div>
      {/* 全天价行与峰谷子目同构：满弧盘 + 锁死的时间段头 + 四个带戳的读数。 */}
      <div className="dtpl-price-seg-allday">
        <ClockRing start={0} end={24} label="每天 00:00–24:00" />
        <div className="dtpl-price-seg-allday-body">
          <div className="dtpl-price-seg-allday-head">
            <span className="dtpl-price-seg-allday-days">每天</span>
            <span className="dtpl-price-slot-clock">00:00 – 24:00</span>
          </div>
          <div className="dtpl-price-rates dtpl-price-seg-rates">
            {CELLS.map(({ field, label }) => (
              <RateCell
                key={field}
                id={`${base}-${field}`}
                label={label}
                value={segment[field]}
                state={fieldState(segment, field)}
                context={`${where}的全天价`}
                onEdit={(next) => onChange({ ...segment, [field]: next })}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="dtpl-price-seg-detail">
        {slotCount > 0 && (
          <div className="dtpl-price-slots">
            {segment.slots.map((slot, slotIndex) => (
              <SlotEditor
                key={slot.id}
                slot={slot}
                index={slotIndex}
                canRemove={isBlankSlot(slot) || effectiveSlots(segment).length > 1}
                inherited={inheritedRates(segment)}
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
            className="dtpl-price-add dtpl-price-add-slot"
            aria-label="添加峰谷时段"
            onClick={addSlot}
          >
            {/* 幽灵盘与子目同位同径。pathLength=12：共 12 段等距。 */}
            <svg className="dtpl-price-slot-ring" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
              <circle className="dtpl-price-slot-ring-ghost" cx="20" cy="20" r="16" pathLength="12" strokeDasharray="0.6 0.4" />
            </svg>
            <span className="dtpl-price-add-slot-k"><span aria-hidden="true">＋</span> 峰谷时段</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/** 一个模型行 = **这一行此刻的价目**：身份 | 请求数 | 四档价 | 展开。 */
export const ModelRow = memo(function ModelRow({ route, row, baseline, open, onToggle, onChange }: {
  route: string
  row: ModelDraft
  /** 上次写入时的行签名：行据此推导「还没落盘」（左侧墨条），未触碰的行保持引用、不 re-render。 */
  baseline: ReadonlyMap<string, string>
  open: boolean
  onToggle: (route: string, model: string) => void
  onChange: (route: string, model: string, next: ModelDraft) => void
}) {
  // 展开的抽屉与 ▸ 是**一对**：aria-expanded 说开没开，aria-controls 说开出来的是哪一块。抽屉只在
  // 展开时存在，所以这条引用也只在展开时给出——指一个不存在的 id 是静默的无障碍失效。
  // id 用 useId 而不是拼 route/model：行键含 NUL 分隔符（见 rowKey），拿它当 id 是拿数据当锚点。
  const panelId = useId()
  const panelLabel = `${row.model} 的价段`
  const dirty = modelDirty(route, row, baseline)
  const issue = rowIssue(row)
  // 行内四个数字的来源：此刻生效的那一段叠上此刻生效的峰谷时段。null = 这一刻没有一段在生效。
  const live = ratesInForce(row)
  const ordered = sortedSegments(row)
  // 托底价不是一次调价，所以调价史的编号只数有生效时刻的那些张。
  const changes = ordered.filter(segment => !isFloorSegment(segment))
  // 行的身份只打印一个：有人命名该串时显示展示名，否则精确串本身。精确串仍是账本的计费键，保持可达（hover 标签与单元格无障碍名）。
  // 没人命名时它是精确串，走等宽——这个判断必须落到 DOM（data-exact），不能让样式去猜。
  const named = row.name !== undefined && row.name !== '' && row.name !== row.model
  // host 正是按这个数把表排出来的。「没记过」是 0 的读法：账本是权威，没记过就是没记过，
  // 不是「未知」（未知的是**价**）。
  const countText = row.records > 0 ? `${String(row.records)} 次` : '没记过'

  // 「＋ 加一段调价」与「＋ 峰谷时段」同一条规矩：新段插在这颗按钮**前面**（它在详情带末尾），
  // 焦点不搬过去的话 Tab 只会离开抽屉，而刚加的那一张落在身后。落点是它的第一格「输入」。
  const [pendingFocus, setPendingFocus] = useState<number | null>(null)
  useEffect(() => {
    if (pendingFocus === null) return
    document.getElementById(`seg-${String(pendingFocus)}-input`)?.focus()
    setPendingFocus(null)
  }, [pendingFocus])
  const addSegment = (): void => {
    const segment = newSegment()
    onChange(route, row.model, { ...row, segments: [...row.segments, segment] })
    setPendingFocus(segment.id)
  }

  return (
    <>
      <div
        className="dtpl-price-row"
        data-dirty={dirty}
        data-open={open}
        onClick={(event) => {
          // 整行是展开热区；▸ 是它的键盘可达形态，自己处理点击。拖选文字不算「点这一行」。
          if (event.target instanceof Element && event.target.closest('button') !== null) return
          if (window.getSelection()?.isCollapsed === false) return
          onToggle(route, row.model)
        }}
      >
        {/* 身份是这一行唯一长度不可预测的值，所以也是唯一让位的值。 */}
        <span
          className="dtpl-price-title"
          data-exact={!named}
          title={named ? `${row.name!}\n${row.model}` : row.model}
        >
          {named ? row.name : row.model}
        </span>
        {/* 请求数是**列**：列头是 aria-hidden 的视觉标签（见 .dtpl-price-cols），
            所以这里给读屏一份同样的字（请求 322 次，而不是一个光秃秃的数）。 */}
        <span className="dtpl-price-reqs">
          <span className="dtpl-sr">请求 </span>
          {countText}
        </span>
        <div className="dtpl-price-rates">
          {CELLS.map(({ field, label }) => (
            <RateValue
              key={field}
              label={label}
              value={live === null ? '' : live.values[field]}
            />
          ))}
        </div>
        <button
          type="button"
          className="dtpl-price-more"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={`${panelLabel}（托底价${changes.length > 0 ? ` + ${String(changes.length)} 段调价` : ''}）`}
          title={changes.length > 0 ? `托底价 + ${String(changes.length)} 段调价` : '托底价、峰谷时段与生效时间'}
          onClick={() => onToggle(route, row.model)}
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
      </div>
      {open && (
        <div
          className="dtpl-price-history"
          id={panelId}
          /* 抽屉在 DOM 上是行的**兄弟**（行是网格，抽屉要占满整行宽），两层的从属只能靠 aria 说：
             给抽屉一个可被 aria-controls 指到的名字。 */
          role="group"
          aria-label={panelLabel}
        >
          <PriceTimeline row={row} activeId={live === null ? null : live.segment.id} />
          {ordered.map(segment => {
            const floor = isFloorSegment(segment)
            const place = changes.indexOf(segment) + 1
            return (
              <SegmentEditor
                key={segment.id}
                segment={segment}
                where={floor ? '托底价' : `第 ${String(place)} 段调价`}
                serial={floor ? '00' : String(place).padStart(2, '0')}
                floor={floor}
                active={live !== null && segment.id === live.segment.id}
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
                  })],
                })}
              />
            )
          })}
          <div className="dtpl-price-history-foot">
            <button
              type="button"
              className="dtpl-price-add"
              aria-label="添加一段调价"
              onClick={addSegment}
            >
              <span aria-hidden="true">＋</span> 加一段调价
            </button>
            <span className="dtpl-price-history-hint">
              {changes.length === 0
                ? '托底价这一张就是全部价：四个数字是这一天 0–24 点的全天价（¥/百万词元）。'
                : '每段管到下一段开始为止，其余时间按托底价；每行的四个数字是这一天 0–24 点的全天价，峰谷时段只改被它覆盖的小时。'}
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

/** 一张 route 卡：可折叠的头（身份行 + 这条通道自己的读数）盖在模型表上。 */
export const RouteCard = memo(function RouteCard({ card, baseline, collapsed, openKey, onToggleCard, onToggleRow, onRowChange, onBilling }: {
  card: RouteDraft
  /** 上次写入时的行签名（见 {@link ModelRow}）。 */
  baseline: ReadonlyMap<string, string>
  collapsed: boolean
  openKey: string | null
  /** 第二参是**点击前**这一张是不是开着的——折叠态是派生的（第一条默认展开），所以由卡片把当前态交回去。 */
  onToggleCard: (route: string, open: boolean) => void
  onToggleRow: (route: string, model: string) => void
  onRowChange: (route: string, model: string, next: ModelDraft) => void
  onBilling: (route: string, billing: BillingNature) => void
}) {
  const models = [...card.models.values()]
  const unknown = models.filter(priceUnknown).length
  // 请求数报**这一行下面真正列出来的**那些模型：不筛选时它与卡上的 route 合计逐字相等（host 用同一次
  // 折叠算出两者），筛选时它跟着留下的行走——否则「1 个模型 · 367 次请求」会对着一个「没记过」的行说话。
  const records = models.reduce((sum, model) => sum + model.records, 0)
  const panelId = `price-card-${card.route}`
  return (
    <article className="dtpl-price-card" data-collapsed={collapsed}>
      <header className="dtpl-price-head">
        <button
          type="button"
          className="dtpl-price-fold"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={() => onToggleCard(card.route, !collapsed)}
        >
          <span className="dtpl-price-fold-top">
            <span className="dtpl-price-caret" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
            <span className="dtpl-price-label">{card.label}</span>
            {card.label !== card.route && <span className="dtpl-price-key">{card.route}</span>}
          </span>
          <span className="dtpl-hero-facts">
            <span className="dtpl-hero-fact"><b>{String(models.length)}</b> 个模型</span>
            {records > 0 && (
              <>
                <i aria-hidden="true">·</i>
                <span className="dtpl-hero-fact"><b>{String(records)}</b> 次请求</span>
              </>
            )}
            {unknown > 0 && (
              <>
                <i aria-hidden="true">·</i>
                {/* 「其中」不能省，与面板事实带同一条理由：它数的是「有记录落在价外」的模型，
                    不是「没有价」的模型——一条写着价的模型也可能在里面。 */}
                <span className="dtpl-hero-fact dtpl-price-fact-unknown">其中 <b>{String(unknown)}</b> 个价格未知</span>
              </>
            )}
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
                <span className="dtpl-price-col-reqs">请求</span>
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
                    open={openKey === rowKey(card.route, model.model)}
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
