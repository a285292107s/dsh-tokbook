/**
 * 词元账本浮窗的价格表 tab。
 *
 * 没有保存按钮也没有撤销：变更在停止输入一拍后自动写入，字段失焦则立刻写。草稿写不出来的
 * 时候（半输入的数字）不写也不报，等这个字段交代完才说。磁盘上的内容是
 * 唯一状态，状态栏只报告它。
 *
 * 一屏只面对**一个模型**：两个下拉选通道与模型，下面是它的调价史（直接铺开，没有折叠）。
 * 下拉的选项文字自己带路标——多少个模型没价、这一行多少次请求、有没有没落盘的改动——
 * 使「这张表有没有洞」不必点到才看得见。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PriceVerdict, PricingView } from '../../types.ts'
import { ROUTE_PRICING } from '../../route-paths.ts'
import {
  baselineOfDraft, baselinesOf, calendarDirty, composePriceBody, draftFromView, modelDirty, modelOptionLabel,
  routeOptionLabel, rowKey, stagedChanges, withCalendar,
  type CalendarDraft, type CalendarEntries, type ModelDraft, type PriceBaseline, type PriceState,
} from './draft.ts'
import { CalendarEditor, ModelDetail } from './editors.tsx'

export interface PricingPanelProps {
  /** 保存成功后通知父级刷新总览。 */
  onChanged: () => void
  /** 报告 tab 当前是否有未保存的暂存改动（驱动 tab 圆点）。不在 unmount 时清除：草稿跨面板存活。 */
  onDirtyChange?: (dirty: boolean) => void
}

/** 最后一次按键后 tab 等待多久才写入——**不是唯一的写入时机**：字段失焦会立刻写一次。
 *  要长到能合并一行的四个数字。 */
const AUTO_SAVE_DELAY_MS = 600

/** 一次写成功之后隔多久才通知父级刷新。父级收到后会跑一次**全量**概览聚合，而失焦提交让
 *  「离开一个字段 = 一次写」——连改几档就是连着写几次，所以合并窗给得宽；离开面板时把还没发出的那次立刻补上。 */
const REFRESH_MERGE_MS = 1000

/** 状态栏那条文字。 */
type SaveState =
  | { kind: 'clean' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  /** 草稿本身尚不可写（必填数字为空）。文件仍持有最后的好状态；下次编辑重试。 */
  | { kind: 'invalid'; message: string }
  /** 宿主拒绝或请求失败；未写入任何内容。 */
  | { kind: 'error'; message: string }

/** 尚未到达磁盘的草稿在面板 unmount 后存活（切 tab、关浮窗），使尚未触发的自动保存——或被宿主拒绝的保存——绝不被悄悄丢弃。 */
interface Staged {
  view: PricingView
  state: PriceState
  baseline: PriceBaseline
}
let staged: Staged | null = null

/** 还没读到宿主视图之前的空状态。 */
const EMPTY_STATE: PriceState = { routes: new Map(), calendar: new Map(), holidays: new Set() }
const EMPTY_BASELINE: PriceBaseline = { models: new Map(), billing: new Map(), calendar: '[]' }

/** 选中的 (通道, 模型)。`model` 为空串 = 「这条通道里请求最多的那一个」，即换通道时的中间态。 */
interface Picked {
  route: string
  model: string
}

/**
 * 选中的那一份存放处。这是**视图偏好**（每台浏览器自己上次看的是哪一行），不是账本数据，
 * 所以进 localStorage 而不是宿主配置——同一个理由见 `QuotaPanel` 的自动刷新间隔。
 *
 * 面板 unmount 就带走的组件状态活不过关浮窗，而这一屏的意图恰恰是「下次打开还是这个选项」。
 */
const PICKED_KEY = 'dsh-tokbook.pricing-picked'

/** 读回上次选的那一行。只认形状对的值，坏值一律当作「没选过」——一个记不住的选择回落到
 *  列表第一个，比让下拉显示一个不存在的选择要好。 */
function readPicked(): Picked | null {
  const saved = localStorage.getItem(PICKED_KEY)
  if (saved === null) return null
  try {
    const parsed = JSON.parse(saved) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const { route, model } = parsed as Partial<Picked>
    if (typeof route !== 'string' || route === '' || typeof model !== 'string') return null
    return { route, model }
  } catch {
    return null
  }
}

/** 记下当前的选择。`null`（「看第一条通道」）抹掉它：那时用户要的正是列表的第一个，不该留一个
 *  下次回来还会生效的旧选择。 */
function rememberPicked(pick: Picked | null): void {
  if (pick === null) localStorage.removeItem(PICKED_KEY)
  else localStorage.setItem(PICKED_KEY, JSON.stringify(pick))
}

function putPrice(body: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  return fetch(ROUTE_PRICING, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const payload = await res.json().catch(() => null) as PriceVerdict | null
    if (!res.ok || payload === null || !payload.ok) {
      // 宿主的拒绝理由优先于状态码：它说的是哪一段价、错在哪儿。
      const reason = payload !== null && !payload.ok ? payload.error : ''
      return { ok: false as const, error: reason !== '' ? reason : `HTTP ${String(res.status)}` }
    }
    return { ok: true as const }
  }).catch((error: unknown) => ({
    ok: false as const,
    error: error instanceof Error ? error.message : String(error),
  }))
}

function clockOf(epochMs: number): string {
  const at = new Date(epochMs)
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}:${String(at.getSeconds()).padStart(2, '0')}`
}

export function PricingPanel({ onChanged, onDirtyChange }: PricingPanelProps) {
  const [view, setView] = useState<PricingView | null>(() => staged?.view ?? null)
  const [state, setState] = useState<PriceState>(() => staged?.state ?? EMPTY_STATE)
  const [baseline, setBaseline] = useState<PriceBaseline>(() => staged?.baseline ?? EMPTY_BASELINE)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>({ kind: 'clean' })
  /** 手动选过的那一份；null = 还没选过，一切走「列表里的第一个」。 */
  const [picked, setPicked] = useState<Picked | null>(readPicked)

  /** 记下一次选择：组件状态（这一屏立刻跟手）与 localStorage（下次打开还认它）。 */
  const choosePicked = useCallback((pick: Picked) => {
    setPicked(pick)
    rememberPicked(pick)
  }, [])

  const changes = useMemo(() => stagedChanges(state, baseline), [state, baseline])

  // 防抖写入器读的 ref，保存绝不捕获过期草稿。
  const stateRef = useRef(state)
  stateRef.current = state
  const baselineRef = useRef(baseline)
  baselineRef.current = baseline
  const timerRef = useRef<number | null>(null)
  const writingRef = useRef(false)
  const againRef = useRef(false)
  const aliveRef = useRef(true)
  /** 用户是否已经「交代过」某个字段（失焦 / 重新回到面板）。打字途中的失败保持沉默——
   *  半输入的数字不是错误，只有离开这个字段之后它才是。 */
  const committedRef = useRef(false)
  const refreshRef = useRef<number | null>(null)

  /** 合并通知：连着几笔写只在最后一笔之后再让父级刷新一次（见 `REFRESH_MERGE_MS`）。 */
  const notifyChanged = useCallback(() => {
    if (refreshRef.current !== null) window.clearTimeout(refreshRef.current)
    refreshRef.current = window.setTimeout(() => {
      refreshRef.current = null
      onChanged()
    }, REFRESH_MERGE_MS)
  }, [onChanged])

  /** 把新视图同时采纳为渲染源和基线。 */
  const seed = useCallback((next: PricingView) => {
    setView(next)
    setState(draftFromView(next))
    setBaseline(baselinesOf(next))
  }, [])

  /** 读一次宿主的价格表视图。**读失败是一个可重试的状态**，不是「这张表是空的」——所以它自己
   *  带一次重新读取（与用量明细 / 额度两个 tab 同一形状：错误条 + 重试）。 */
  const loadView = useCallback(async (): Promise<void> => {
    setLoadError(null)
    try {
      const res = await fetch(ROUTE_PRICING)
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`)
      const body = await res.json() as PricingView
      if (aliveRef.current) seed(body)
    } catch (err) {
      if (aliveRef.current) setLoadError(err instanceof Error ? err.message : String(err))
    }
  }, [seed])

  // 首次挂载：从未到达磁盘的草稿优先于宿主文件。
  useEffect(() => {
    // 回到面板 = 一次提交点：上次没写完的坏草稿要说出原因，而不是只挂着一句「待保存…」。
    if (staged !== null) {
      committedRef.current = true
      return
    }
    void loadView()
  }, [loadView])

  /**
   * 写入整个文件。草稿尚无效时拒绝（不写入），使半输入的数字不能阻塞或破坏其余内容；
   * 防抖 effect 在草稿再次变化时重试。保存串行化：在飞的写入期间发生的变更排队一次。
   * **写不进去这件事只在提交点说出来**（字段失焦 / 回到面板）：打字途中它必然是无效的，
   * 那一刻报错只会把「还没打完」读成「你错了」。
   */
  const writeNow = useCallback(async (): Promise<void> => {
    if (stagedChanges(stateRef.current, baselineRef.current) === 0) return
    if (writingRef.current) {
      againRef.current = true
      return
    }
    // 冻结本次 PUT 写入的草稿。响应落地时 live ref 可能已持有更晚的按键。
    const snapshot = stateRef.current
    const composed = composePriceBody(snapshot)
    if (!composed.ok) {
      if (committedRef.current && aliveRef.current) setSave({ kind: 'invalid', message: composed.error })
      return
    }
    writingRef.current = true
    if (aliveRef.current) setSave({ kind: 'saving' })
    const result = await putPrice(composed.body)
    writingRef.current = false
    if (!result.ok) {
      if (aliveRef.current) setSave({ kind: 'error', message: result.error })
      return
    }
    // 基线始终推进到刚写入的内容，即使已 unmount——离场前的 flush 写入必须让 `staged` 保持干净。
    const nextBaseline = baselineOfDraft(snapshot)
    baselineRef.current = nextBaseline
    // 写成功了：下一次编辑重新从「安静」开始，直到它自己被交代出去。
    committedRef.current = false
    if (staged !== null) {
      staged = stagedChanges(staged.state, nextBaseline) > 0
        ? { ...staged, baseline: nextBaseline }
        : null
    }
    // 在飞期间又攒了改动：接上下一笔，别让这一笔之后的重写被跳过。
    const queued = againRef.current
    againRef.current = false
    if (!aliveRef.current) {
      // 卸载后的补写：状态栏已经不在了，但 tab 圆点与父级屏上的金额都还活着——两样都得同步。
      onDirtyChange?.(stagedChanges(stateRef.current, baselineRef.current) > 0)
      notifyChanged()
      if (queued) void writeNow()
      return
    }
    // 本地草稿保持为唯一真源——从响应重新播种会 remount 用户可能仍在输入的输入框。
    setBaseline(nextBaseline)
    setSave({ kind: 'saved', at: Date.now() })
    notifyChanged()
    if (queued) void writeNow()
  }, [notifyChanged, onDirtyChange])

  // 自动保存：任何变更重置短计时器；最后一次变更胜出。写入器经 ref 读取，使父级 re-render 绝不会饿死防抖。
  const writeRef = useRef(writeNow)
  writeRef.current = writeNow
  useEffect(() => {
    if (changes === 0) {
      // 改动被撤回到与磁盘一致：没有问题可报，也没有东西待写——回到「安静」的起点。
      // 「保存失败」也一起清掉：草稿与基线一致，就确实没有哪一处内容没落盘。
      committedRef.current = false
      setSave(current => (current.kind === 'pending' || current.kind === 'invalid' || current.kind === 'error'
        ? { kind: 'clean' }
        : current))
      return
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    // 已经报出来的问题不因为继续打字而撤回：它说的地点与原因仍然成立。它由**写成功**或**改动归零**清掉。
    setSave(current => (current.kind === 'error' || current.kind === 'invalid' ? current : { kind: 'pending' }))
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void writeRef.current()
    }, AUTO_SAVE_DELAY_MS)
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [changes, state])

  // 从未到达磁盘的草稿留给下次挂载；干净的丢弃，使下次挂载读宿主文件。（选中的那一行不走这里：
  // 它在 localStorage 里，与草稿的生死无关。）
  useEffect(() => {
    if (view === null) return
    staged = changes > 0 ? { view, state, baseline } : null
  }, [view, state, baseline, changes])

  useEffect(() => { onDirtyChange?.(changes > 0) }, [changes, onDirtyChange])

  // 离开 tab（或关闭浮窗）不能搁浅一次待写的保存，也不能丢掉一次还没发出的刷新通知。
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      // 那次刷新说的是**已经落盘**的价，别的 tab 正拿它算金额：跟着面板一起丢掉会让它们停在旧数。
      if (refreshRef.current !== null) {
        window.clearTimeout(refreshRef.current)
        refreshRef.current = null
        onChanged()
      }
      if (stagedChanges(stateRef.current, baselineRef.current) > 0) void writeNow()
    }
  }, [writeNow, onChanged])

  const updateModel = useCallback((route: string, model: string, next: ModelDraft) => {
    setState((current) => {
      const card = current.routes.get(route)
      if (card === undefined) return current
      const models = new Map(card.models)
      models.set(model, next)
      const routes = new Map(current.routes)
      routes.set(route, { ...card, models })
      return { ...current, routes }
    })
  }, [])

  const updateBilling = useCallback((route: string, billing: 'metered' | 'subscription') => {
    setState((current) => {
      const card = current.routes.get(route)
      if (card === undefined) return current
      const routes = new Map(current.routes)
      routes.set(route, { ...card, billing })
      return { ...current, routes }
    })
  }, [])

  /** 改 / 加 / 删一年年历。放假日集合跟着一起换（见 `withCalendar`）。 */
  const updateCalendar = useCallback((year: string, next: CalendarDraft | null) => {
    setState((current) => {
      const calendar: CalendarEntries = new Map(current.calendar)
      if (next === null) calendar.delete(year)
      else calendar.set(year, next)
      return withCalendar(current, calendar)
    })
  }, [])

  // Ctrl/Cmd+S 立即 flush 待写的保存（文件本来也会自动保存）。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (changes > 0) {
          if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current)
            timerRef.current = null
          }
          void writeNow()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [changes, writeNow])

  // 两个下拉的候选就是宿主给的全部通道与全部模型；「这张表有没有洞」由选项文字自己说（见
  // `routeOptionLabel` / `modelOptionLabel`），不另设筛选。
  const routeChoices = useMemo(() => [...state.routes.values()], [state.routes])

  // 选中的是谁：手动选过、且此刻仍在选项里才作数；其余一律回落到「列表里的第一个」（host 已按
  // 请求数排序，所以「第一个」就是最该看的那一个）。
  const card = routeChoices.find(item => item.route === picked?.route) ?? routeChoices[0]
  const models = card === undefined ? [] : [...card.models.values()]
  const row = models.find(item => item.model === picked?.model) ?? models[0]

  const stateText = saveStateText(save)
  // 什么都没选过、也没有任何待写的改动：状态栏没有话要说。常驻一个空盒子会在选择带与
  // 调价史之间撑出一道什么也不说的空隙。
  const veiled = picked === null && save.kind === 'clean' && changes === 0

  return (
    <section
      className="dtpl-price-sec"
      aria-label="价格表"
      // 任一字段失焦 = 提交点：立刻写一次（不必再等防抖），并让此后写不进去的失败说话。
      // **没有待写的改动就不算一次交代**——否则在这里随便点一下，下一次打字的中途报错就被放行了。
      onBlur={(event) => {
        // 下拉换人不是一次「交代」：弹层里没有字段可交代，而这一次 blur 会被读成「用户离开了
        // 某个没写完的字段」，于是切一下下拉就报一句「未保存」。
        if (event.target instanceof HTMLSelectElement) return
        if (stagedChanges(stateRef.current, baselineRef.current) === 0) return
        committedRef.current = true
        void writeRef.current()
      }}
    >
      {/* 年历是**全局**的一份数据（不属于任何一行），所以它挂在选择带之上、跟着这一屏常驻：
          `workdays` 时段的生效判定靠它，缺一年就会把法定节假日按高峰多算——它自己会报出来。 */}
      {view !== null && (
        <CalendarEditor
          entries={state.calendar}
          missingYears={view.calendarMissing}
          dirty={calendarDirty(state, baseline)}
          onChange={updateCalendar}
        />
      )}
      {/* 路由来自本机 settings.yaml 与正在运行的适配器；一个都没有时不画两个空下拉——
          没有选项的控件只会把「这里本来没有内容」说成「你选不了」。 */}
      {state.routes.size > 0 && card !== undefined && (
        <div className="dtpl-price-pick">
          <label className="dtpl-price-pick-row">
            <span className="dtpl-price-pick-k">通道</span>
            <select
              className="dtpl-price-select dtpl-price-pick-sel"
              value={card.route}
              onChange={(event) => {
                // 模型先落到空串：换通道时沿用上一条通道的模型名没有意义，下一帧的回落会
                // 挑出这条通道里请求最多的那一个。
                choosePicked({ route: event.target.value, model: '' })
              }}
            >
              {routeChoices.map(item => (
                <option key={item.route} value={item.route}>{routeOptionLabel(item)}</option>
              ))}
            </select>
          </label>
          <label className="dtpl-price-pick-row">
            <span className="dtpl-price-pick-k">模型</span>
            <select
              className="dtpl-price-select dtpl-price-pick-sel"
              /* value 必须落在选项集合里：row 是 undefined（这条通道一个模型都没有）时给空串，
                 它不在任何 option 的 value 上，React 便让浏览器显示第一个选项。 */
              value={row === undefined ? '' : row.model}
              disabled={models.length === 0}
              aria-label={`${card.label} 的模型`}
              onChange={(event) => {
                choosePicked({ route: card.route, model: event.target.value })
              }}
            >
              {models.map(item => (
                <option key={item.model} value={item.model}>
                  {modelOptionLabel(item, modelDirty(card.route, item, baseline.models))}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* 状态栏在没话要说时让位（见 `veiled`）：常驻一个空盒子会在选择带与调价史之间撑出空隙。 */}
      {(state.routes.size > 0 || loadError !== null) && !veiled && (
        <div className="dtpl-price-bar">
          <span className={`dtpl-price-state is-${save.kind}`} role="status" aria-live="polite">
            {stateText}
          </span>
          {save.kind === 'error' && (
            <button type="button" className="dtpl-price-ghost" onClick={() => void writeNow()}>重试</button>
          )}
        </div>
      )}

      {loadError !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">价格表加载失败：{loadError}</p>
          <button type="button" className="dtpl-retry" onClick={() => void loadView()}>重试</button>
        </div>
      )}

      {/* 读不到就是读不到：错误条已经说了原因，下面不再补一句「没有可显示的路由」——
          那句话在说「这里本来就没有内容」，而真相是这一份没读到。 */}
      {view === null
        ? (loadError === null
          ? (
            <div className="dtpl-skeleton" aria-hidden="true">
              <div className="dtpl-sk dtpl-price-sk-pick" />
              <div className="dtpl-sk dtpl-price-sk-open" />
            </div>
          )
          : null)
        : state.routes.size === 0
          ? (
            <div className="dtpl-empty">
              <p className="dtpl-empty-title">没有可显示的路由</p>
              <p className="dtpl-empty-sub">
                路由来自本机 settings.yaml 与正在运行的适配器；账本或价格表里出现过的路由也会列出来。
              </p>
            </div>
          )
          : row === undefined
            ? (
              <div className="dtpl-empty">
                <p className="dtpl-empty-title">这条通道没有列出的模型</p>
                <p className="dtpl-empty-sub">
                  它的模型目录与账本里都没有模型；账本记过它时这里就会多出一行。
                </p>
                <button
                  type="button"
                  className="dtpl-price-add dtpl-price-empty-act"
                  onClick={() => {
                    setPicked(null)
                    rememberPicked(null)
                  }}
                >
                  看第一条通道
                </button>
              </div>
            )
            : (
              <ModelDetail
                key={rowKey(card.route, row.model)}
                route={card.route}
                row={row}
                billing={card.billing}
                baseline={baseline.models}
                holidays={state.holidays}
                onRowChange={updateModel}
                onBilling={updateBilling}
              />
            )}
    </section>
  )
}

/** 状态文字只说**这次写没写进去**。 */
function saveStateText(save: SaveState): string {
  switch (save.kind) {
    case 'pending': return '待保存…'
    case 'saving': return '保存中…'
    case 'saved': return `已保存 ${clockOf(save.at)}`
    case 'invalid': return `未保存：${save.message}`
    case 'error': return `保存失败：${save.message}`
    default: return ''
  }
}
