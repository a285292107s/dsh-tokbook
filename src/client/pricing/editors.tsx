/**
 * 价格表 tab 的行原语：此刻生效的四档价、价格段编辑器、模型行、route 卡。
 *
 * 行**是**表：四个数字只读地报出此刻计费所用的价（生效段叠上此刻生效的峰谷时段），所以它永远说得出出处、
 * 也永远不会被就地改掉历史。改价在展开的抽屉里：第一张是**托底价**（没有生效时刻），往下的每张从某个时刻起生效。
 * 本文件不持有状态：面板持有，通过小回调下发。
 *
 * @module dsh-tokbook/client/pricing/editors
 */

import { memo, useState } from 'react'
import { DAY_SET_LABELS, DAY_SETS, clockLabel } from '../../price-format.ts'
import type { BillingNature, DaySet } from '../../types.ts'
import {
  dayLabel, duplicateSlot, effectiveSlots, fieldState, fmtFrom, fromFieldValue, inheritedRates, isBlankSlot,
  isFloorSegment, isUnpriced, modelDirty, newSegment, newSlot, priceUnknown, ratesInForce, rowIssue,
  sortedSegments, withSegmentFrom, withSlotEnd, withSlotStart,
  type ModelDraft, type RateField, type RateTexts, type RouteDraft, type SegmentDraft, type SlotDraft,
} from './draft.ts'
import { PriceTimeline } from './Timeline.tsx'

/** 四个 ¥/M 桶，按所有 surface 的书写顺序。 */
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

/** 抽屉里的一个数字单元格，原地编辑：聚焦前读作文本，每个值一次点击（或 Tab）即达。行内那个只读的对应物是 {@link RateValue}。 */
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
  // 可见消息保持简短，不撑窄 rate 列；完整句子挂 input 的 title，行下方的问题行以全宽重复第一个问题。
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

/** 行内的一个价：只读。改价一律走展开后的抽屉——就地改这个数字等于改历史。
 *  列名跟着读屏（`.dtpl-sr`），窄屏下同一份文字变成可见的小标签。 */
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

/** 抽屉里的一张价：托底价（没有生效时刻、不可删）或一段调价（生效时刻、可删）。两张共用下面全部内容——
 *  全天价、峰谷时段、备注。操作在 hover 或键盘聚焦时出现（始终可达，非仅 hover）。 */
function SegmentEditor({ segment, where, floor, active, onChange, onRemove, onDuplicate }: {
  segment: SegmentDraft
  /** 这一张的名分：「托底价」或「第 N 段调价」——出现在每个单元格的无障碍名称里。 */
  where: string
  /** 是不是托底价那一张（无生效时刻，且不提供删除）。 */
  floor: boolean
  active: boolean
  onChange: (next: SegmentDraft) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const base = `seg-${String(segment.id)}`
  const slots = effectiveSlots(segment)
  // 删除要两下：它改的是那段时间的历史金额，而账本没有撤销——一次误点不值得付出重填四档价的代价。聚焦离开即取消。
  const [confirming, setConfirming] = useState(false)
  const hint = slots.length === 0
    ? '四档价就是这一天 0–24 点的价。峰谷价用下面的 ＋ 加峰谷时段 加。'
    : `没被这 ${String(slots.length)} 个峰谷时段覆盖的时间，按上面的全天价算。`
  return (
    <div className="dtpl-price-seg" data-active={active}>
      <div className="dtpl-price-seg-head">
        {floor
          ? <span className="dtpl-price-seg-floor-k">托底价</span>
          : (
            <>
              <label className="dtpl-price-seg-date" htmlFor={`${base}-from`}>
                <input
                  id={`${base}-from`}
                  className="dtpl-price-input dtpl-price-input-date"
                  type="datetime-local"
                  step={3600}
                  value={fromFieldValue(segment.from)}
                  aria-label={`${where}的生效时间`}
                  title="生效时间精确到整点，分钟向下取到整点；清空不生效——想要一段管全部时间，改的是第一张托底价"
                  onChange={(event) => onChange(withSegmentFrom(segment, event.target.value))}
                />
                <span className="dtpl-price-seg-date-k">生效时间</span>
              </label>
              <span className="dtpl-price-seg-tag">{fmtFrom(segment.from)}</span>
            </>
          )}
        {active && <em className="dtpl-price-seg-live">当前生效</em>}
        <span className="dtpl-price-seg-actions">
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
      {floor && (
        <p className="dtpl-price-seg-floor-note">
          没有生效时间：没被下面任一段调价覆盖的时间，都按这一张的四档价算。
        </p>
      )}
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
            context={`${where}的全天价`}
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
          aria-label={`${where}的备注`}
          onChange={(event) => onChange({ ...segment, note: event.target.value })}
        />
      </label>
    </div>
  )
}

/** 一个模型行 = **这一行此刻的价目**：身份 | 请求数 | 四档价 | 展开。四样都是定长列（身份那列伸缩、超长只截它自己），
 *  所以整张表可以逐列往下比。价**怎么读**（可信不可信、是不是全部）另起一条整行宽的判定带，只在有话要说时才存在。 */
export const ModelRow = memo(function ModelRow({ route, row, baseline, stuck, open, onToggle, onChange }: {
  route: string
  row: ModelDraft
  /** 上次写入时的行签名：行据此推导「还没落盘」（左侧墨条），未触碰的行保持引用、不 re-render。
   *  「未保存」徽章另需面板的 {@link stuck}——那是整份文件一次写的事实。 */
  baseline: ReadonlyMap<string, string>
  /** 这次写入没能落盘（草稿无效 / 宿主拒绝）。只在这种时候给「未保存」徽章：
   *  正常在飞的瞬态由行左侧那道墨条说，不该用最响的芯片去说一个 0.6 s 的状态。 */
  stuck: boolean
  open: boolean
  onToggle: (route: string, model: string) => void
  onChange: (route: string, model: string, next: ModelDraft) => void
}) {
  const dirty = modelDirty(route, row, baseline)
  const issue = rowIssue(row)
  const unknown = priceUnknown(row)
  // 行内四个数字的来源：此刻生效的那一段叠上此刻生效的峰谷时段。null = 这一刻没有一段在生效。
  const live = ratesInForce(row)
  const ordered = sortedSegments(row)
  // 托底价不是一次调价，所以调价史的编号只数有生效时刻的那些张。
  const changes = ordered.filter(segment => !isFloorSegment(segment))
  // 行的身份只打印一个：有人命名该串时显示展示名，否则精确串本身。精确串仍是账本的计费键，保持可达（hover 标签与单元格无障碍名）。
  // 没人命名时它是精确串，走等宽——这个判断必须落到 DOM（data-exact），不能让样式去猜。
  const named = row.name !== undefined && row.name !== '' && row.name !== row.model
  // 请求数是一**列**（列头「请求」），单位由列头说一次；host 正是按这个数把表排出来的。
  // 「没记过」是 0 的读法：账本是权威，没记过就是没记过，不是「未知」（未知的是**价**，那是判定带的事）。
  const countText = row.records > 0 ? `${String(row.records)} 次` : '没记过'
  // 「未生效」得说得出**什么时候**生效：此刻没有任何一段在生效时，按效力顺序的第一张带生效时刻的段就是那一张。
  const startsAt = live === null ? (ordered.find(segment => segment.from.trim() !== '')?.from ?? null) : null
  // 判定带：**一条 = 一枚芯片 + 一句话**。芯片是可纵向扫读的类，句子是这个类对**这一行**的意思（数量、时刻、后果）。
  // 两者都印在行上，所以任何一个判定都不需要悬停才知道（UI-SPEC §2：信息不能只存在 title 里）。
  // 顺序按**问题域**：钱的诚实性（价格未知 / 未生效）→ 价的结构（峰谷价）→ 身份（不在配置）→ 会话写入（未保存）。
  // 左起第一枚因此永远是最该看的那一枚；「未生效」与「价格未知」构造上互斥，所以现实中最常见的是一两枚。
  const decls: { chip: string; tone: string; text: string }[] = []
  if (unknown) {
    decls.push({
      chip: `价格未知${(row.unpriced ?? 0) > 0 ? ` ${String(row.unpriced!)} 次` : ''}`,
      tone: 'dtpl-price-badge-unknown',
      // 两种行都会落到这里，后果不同：整行没有价（那些请求一个价都没有）vs 有价但覆盖不到最早的记录。
      text: isUnpriced(row)
        ? '这一行还没有价，它的请求都按 ¥0 记'
        : '第一个价段之前记的那些请求按 ¥0 记；补上托底价后自始有价',
    })
  }
  if (live === null && !unknown) {
    decls.push({
      chip: '未生效',
      tone: 'dtpl-price-badge-idle',
      text: startsAt === null ? '价还没到生效时间，此刻按 ¥0 记' : `${fmtFrom(startsAt)}生效，此刻按 ¥0 记`,
    })
  }
  if (live !== null) {
    const slots = effectiveSlots(live.segment).length
    if (slots > 0) {
      decls.push({
        chip: '峰谷价',
        tone: 'dtpl-price-badge-slot',
        // 芯片只说「这一段里有峰谷价」，说不清此刻按的是哪一档，而那是同一件事里读者要看的另一半。
        // 数出来的只是生效这一段里的时段，「生效的这段里」这个限定词不能省。
        text: live.slot === null
          ? `此刻按全天价；生效的这段里另有 ${String(slots)} 个时段价`
          : `此刻按峰谷价计费（${dayLabel(live.slot)}）`,
      })
    }
  }
  // 身份事实，不是钱，两种行都会落到这里（配置删了但账本记得 / 只写在价表里）。「本通道」不能省：
  // 同一个模型串可以在一条通道上不在配、在另一条上正常在配，所以「它已经调不到了」会在那张还活着的卡上说假话。
  if (!row.configured) {
    decls.push({ chip: '不在配置', tone: '', text: '本通道的配置里已没有它，这个价只影响历史金额' })
  }
  if (dirty && stuck) {
    decls.push({ chip: '未保存', tone: 'dtpl-price-badge-dirty', text: '这次改动还没写进文件，原因见上方那条消息' })
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
        {/* 身份：一行一个，也是这一行唯一长度不可预测的值，所以也是唯一让位的值。 */}
        <span
          className="dtpl-price-title"
          data-exact={!named}
          title={named ? `${row.name!}\n${row.model}` : row.model}
        >
          {named ? row.name : row.model}
        </span>
        {/* 请求数是**列**，不是这一行里的一句话。列头是 aria-hidden 的视觉标签（见 .dtpl-price-cols），
            所以这里给读屏一份同样的字：请求 322 次，而不是一个光秃秃的数。 */}
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
          aria-label={`${row.model} 的价段（托底价${changes.length > 0 ? ` + ${String(changes.length)} 段调价` : ''}）`}
          title={changes.length > 0 ? `托底价 + ${String(changes.length)} 段调价` : '托底价、峰谷时段与生效时间'}
          onClick={() => onToggle(route, row.model)}
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
        {/* 判定带整行宽，只在有话要说时才存在——「这一行有第二行」本身就是那个要先看它一眼的信号。
            芯片在带首排成可纵向扫读的类列，句子跟在同一条带上说这一行自己的后果。 */}
        {decls.length > 0 && (
          <p className="dtpl-price-decl">
            {decls.map(decl => (
              <span key={decl.chip} className={`dtpl-price-badge${decl.tone === '' ? '' : ` ${decl.tone}`}`}>
                {decl.chip}
              </span>
            ))}
            <span className="dtpl-price-decl-text">{decls.map(decl => decl.text).join(' · ')}</span>
          </p>
        )}
      </div>
      {open && (
        <div className="dtpl-price-history">
          {/* 轴统领它索引的列表：哪个区间在计费、边界在哪、今天之后是什么、价够不到账本的哪部分。 */}
          <PriceTimeline row={row} activeId={live === null ? null : live.segment.id} />
          {ordered.map(segment => {
            const floor = isFloorSegment(segment)
            const place = changes.indexOf(segment) + 1
            return (
              <SegmentEditor
                key={segment.id}
                segment={segment}
                where={floor ? '托底价' : `第 ${String(place)} 段调价`}
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
                    note: segment.note,
                  })],
                })}
              />
            )
          })}
          <div className="dtpl-price-history-foot">
            <button
              type="button"
              className="dtpl-price-add"
              onClick={() => onChange(route, row.model, {
                ...row,
                segments: [...row.segments, newSegment()],
              })}
            >
              ＋ 加一段调价
            </button>
            <span className="dtpl-price-history-hint">
              {changes.length === 0
                ? '托底价这一张就是全部价。要换价，就从某个时刻起加一段调价。'
                : `${String(changes.length)} 段调价：每一段管到下一段开始为止，其余时间按托底价算。`}
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
export const RouteCard = memo(function RouteCard({ card, baseline, stuck, collapsed, openKey, onToggleCard, onToggleRow, onRowChange, onBilling }: {
  card: RouteDraft
  /** 上次写入时的行签名（见 {@link ModelRow}）。 */
  baseline: ReadonlyMap<string, string>
  /** 整块面板当前的写入状态（见 {@link ModelRow.stuck}）：一整份文件一次写，所以它是面板级事实。 */
  stuck: boolean
  collapsed: boolean
  openKey: string | null
  onToggleCard: (route: string) => void
  onToggleRow: (route: string, model: string) => void
  onRowChange: (route: string, model: string, next: ModelDraft) => void
  onBilling: (route: string, billing: BillingNature) => void
}) {
  const models = [...card.models.values()]
  const priced = models.filter(model => !isUnpriced(model)).length
  const unknown = models.filter(priceUnknown).length
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
            {/* 「其中」不能省：这两个数**不是**一个划分——有价的行也可能有价格未知的历史，
                写成两个并列的类别会让读者以为加法不对。 */}
            {unknown > 0 ? ` · 其中 ${String(unknown)} 个价格未知` : ''}
            {card.records > 0 ? ` · ${String(card.records)} 次请求` : ''}
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
                    stuck={stuck}
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
