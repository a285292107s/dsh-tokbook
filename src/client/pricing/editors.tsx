/**
 * 价格表 tab 的行原语：价格段编辑器与选中模型的详情面。
 *
 * 改价一律走段卡里的输入框；第一张是**托底价**（没有生效时刻），往下的每张从某个时刻起生效。
 * 谁被选中由面板决定（两个下拉），所以本文件不持有选择状态——只通过小回调下发改动。
 */

import { memo, useEffect, useState } from 'react'
import { DAY_SET_LABELS, DAY_SETS, clockLabel, isHourRange } from '../../price-format.ts'
import type { BillingNature, DaySet } from '../../types.ts'
import {
  duplicateSlot, effectiveSlots, fieldState, fromFieldValue, inheritedRates, isBlankSlot,
  dayLabel, isFloorSegment, modelDirty, newSegment, newSlot, rowIssue, segmentInForce, slotRange,
  sortedSegments, withSegmentFrom, withSlotEnd, withSlotStart,
  type ModelDraft, type RateField, type RateTexts, type SegmentDraft, type SlotDraft,
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

/** 一个峰谷时段：适用星期、覆盖小时、重写的桶。费率布局与上方全天价行相同——留空的桶显示它沿用的全天价。
 *  **不画盘**：星期进不了盘，而盘要说的两件事（覆盖哪几个小时、共几小时）三个下拉与一行时长已经说完。
 *  零覆盖的时段与计价无关（`isBlankSlot`），所以整条降级并直说这一点——空着不写文件是设计，不是待办。 */
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
  // 时长是派生的，不进 state：窗口的事实仍然只有三个下拉。
  const hours = isHourRange({ start, end }) ? end - start : null
  // 删除要两下：它改的是历史金额，账本没有撤销。聚焦离开即取消。
  const [confirming, setConfirming] = useState(false)
  const inert = isBlankSlot(slot)
  const inherit = (field: RateField): string | undefined => {
    const value = inherited[field].trim()
    return value === '' ? undefined : value
  }
  return (
    <div className="dtpl-price-slot" data-inert={inert}>
      {/* 左栅栏：圆点与上面的盘同轴，横线把这条子目接回盘上。两者都不带信息，
          只回答「这条窗口挂在哪儿」——所以是空的 span，竖轨由整组子目共用一条（见 SegmentEditor）。 */}
      <span className="dtpl-price-slot-rail" aria-hidden="true">
        <span className="dtpl-price-slot-dot" />
        <span className="dtpl-price-slot-stub" />
      </span>
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
          {/* 时长是派生的：钟点已经说了窗口，这三个字只省一次心算，所以走 dim 档、退到钟点右侧。 */}
          {hours !== null && (
            <span className="dtpl-price-slot-span" aria-hidden="true">{`· ${String(hours)} 小时`}</span>
          )}
          {inert && <span className="dtpl-price-slot-inert">未改写任何档：不影响计价</span>}
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
          {/* 读名只有桶名：四格与上方的全天价落在同一组竖线上，谁覆盖了谁一望即知；
              序号进可见读名会把格子撑宽，四格就散开了——「第 N 个峰谷时段」在 aria-label
              （context）里已经说全。 */}
          {CELLS.map(({ field, label }) => (
            <RateCell
              key={field}
              id={`slot-${String(slot.id)}-${field}`}
              label={label}
              value={slot[field]}
              state={fieldState(slot, field)}
              context={context}
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
            {/* 整组子目共用一条竖轨：它只在这组有子目时才有意义，且不必知道有几条。 */}
            <span className="dtpl-price-slots-spine" aria-hidden="true" />
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
            {/* 没有幽灵盘可对位了（盘已从子目删掉），所以这里只用与「＋ 加一段调价」同一枚字形。 */}
            <span className="dtpl-price-add-slot-k"><span aria-hidden="true">＋</span> 峰谷时段</span>
          </button>
        </div>
      </div>
    </div>
  )
}
/** 选中模型的详情面：身份 | 计费性质 | 调价史直接铺开。
 *
 *  它是这一屏的**主体**（两个下拉在上面选谁），所以不再有折叠：段卡、时段、加段的按钮常驻。
 *  身份行是这一块唯一一行摘要——精确模型串（账本的计费键）与账本记录数都在这里；四档价在读面上
 *  有且只有一处（段卡的输入框），详情里不再复述一遍只读副本。 */
export const ModelDetail = memo(function ModelDetail({ route, row, billing, baseline, onRowChange, onBilling }: {
  route: string
  row: ModelDraft
  billing: BillingNature
  /** 上次写入时的行签名：据此推导「还没落盘」（整块的左侧墨条）。 */
  baseline: ReadonlyMap<string, string>
  onRowChange: (route: string, model: string, next: ModelDraft) => void
  onBilling: (route: string, billing: BillingNature) => void
}) {
  const dirty = modelDirty(route, row, baseline)
  const issue = rowIssue(row)
  // 此刻生效的那一段叠上此刻生效的峰谷时段——null = 这一刻没有一段在生效，轴上的「当前生效」钉就没有落点。
  const live = segmentInForce(row)
  const ordered = sortedSegments(row)
  // 托底价不是一次调价，所以调价史的编号只数有生效时刻的那些张。
  const changes = ordered.filter(segment => !isFloorSegment(segment))
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
        <PriceTimeline row={row} activeId={live === null ? null : live.id} />
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
            active={live !== null && segment.id === live.id}
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
      {/* 行级问题报在让位层之外：它说的是这一行能不能写出去，与竖轨的让位无关。 */}
      {issue !== null && (
        <p className="dtpl-price-issue" role="alert">{row.model}:{issue}</p>
      )}
    </section>
  )
})
