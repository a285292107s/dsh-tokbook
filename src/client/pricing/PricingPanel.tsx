/**
 * 词元账本浮窗的价格表 tab。
 *
 * 没有保存按钮也没有撤销：变更在停止输入一拍后自动写入，字段失焦则立刻写。草稿写不出来的
 * 时候（半输入的数字）不写也不报，等这个字段交代完才说。磁盘上的内容是
 * 唯一状态，状态栏只报告它。
 *
 * 一屏只面对**一个模型**：两个下拉选通道与模型，下面是它的价（直接铺开，没有折叠）。
 * 下拉的选项文字自己带路标——多少个模型没价、这一行多少次请求、有没有没落盘的改动——
 * 使「这张表有没有洞」不必点到才看得见。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ModelsDevCandidate, PriceCurrency, PriceVerdict, PricingLookupResult, PricingSyncResult, PricingView } from '../../types.ts'
import { normalizeModelId } from '../../models-dev.ts'
import { QUERY_FORCE, QUERY_MODEL, ROUTE_PRICING, ROUTE_PRICING_LOOKUP, ROUTE_PRICING_SYNC } from '../../route-paths.ts'
import { inverseHint } from './currency.ts'
import {
  baselineOfDraft, baselinesOf, calendarDirty, composePriceBody, draftFromView, fxIssue, fxSignature, fxValue, modelDirty,
  modelOptionLabel,
  routeOptionLabel, rowKey, stagedChanges, withCalendar, withFx, withRouteCurrency,
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

/**
 * 把一份尚未落盘的草稿合并到刚读回来的宿主视图上：只有**真正 dirty** 的那几处胜出——
 * 逐 (通道, 模型) 行、通道的计费性质与报价币种、年历、汇率各按自己的签名判。基线同步换成磁盘的，
 * 所以被保留的那几处仍显示「未保存」；其余内容（新增的 route / 模型、账本计数、缺年告警）
 * 一律用磁盘上的新值。视图里没有的通道整个丢弃——**「有哪些通道」由宿主说了算**，
 * 留着一份陈旧整卡只会在下一次写回里把它重新写进文件。
 */
function mergeStaged(fresh: PricingView, saved: Staged): { state: PriceState; baseline: PriceBaseline } {
  let state = draftFromView(fresh)
  const baseline = baselinesOf(fresh)
  for (const [route, card] of saved.state.routes) {
    const freshCard = state.routes.get(route)
    if (freshCard === undefined) continue
    const models = new Map(freshCard.models)
    let billing = freshCard.billing
    let currency = freshCard.currency
    if ((saved.baseline.billing.get(route) ?? 'metered') !== card.billing) {
      billing = card.billing
      baseline.billing.set(route, saved.baseline.billing.get(route) ?? 'metered')
    }
    if ((saved.baseline.currency.get(route) ?? 'CNY') !== card.currency) {
      currency = card.currency
      baseline.currency.set(route, saved.baseline.currency.get(route) ?? 'CNY')
    }
    for (const [model, row] of card.models) {
      if (!modelDirty(route, row, saved.baseline.models)) continue
      models.set(model, row)
      const key = rowKey(route, model)
      baseline.models.set(key, saved.baseline.models.get(key) ?? '')
    }
    state.routes.set(route, { ...freshCard, models, billing, currency })
  }
  if (calendarDirty(saved.state, saved.baseline)) {
    state = withCalendar(state, saved.state.calendar)
    baseline.calendar = saved.baseline.calendar
  }
  if (fxSignature(saved.state.fx) !== saved.baseline.fx) {
    state = withFx(state, saved.state.fx)
    baseline.fx = saved.baseline.fx
  }
  return { state, baseline }
}

const EMPTY_STATE: PriceState = { routes: new Map(), calendar: new Map(), holidays: new Set(), fx: '' }
const EMPTY_BASELINE: PriceBaseline = { models: new Map(), billing: new Map(), currency: new Map(), calendar: '[]', fx: '' }

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
  try {
    const saved = localStorage.getItem(PICKED_KEY)
    if (saved === null) return null
    const parsed = JSON.parse(saved) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const { route, model } = parsed as Partial<Picked>
    if (typeof route !== 'string' || route === '' || typeof model !== 'string') return null
    return { route, model }
  } catch {
    // 隐私模式等拿不到存储：这一屏照常画，只是不记得上次看的是哪一行。
    return null
  }
}

/** 记下当前的选择。`null`（「看第一条通道」）抹掉它：那时用户要的正是列表的第一个，不该留一个
 *  下次回来还会生效的旧选择。 */
function rememberPicked(pick: Picked | null): void {
  try {
    if (pick === null) localStorage.removeItem(PICKED_KEY)
    else localStorage.setItem(PICKED_KEY, JSON.stringify(pick))
  } catch {
    // 存不下不影响这一次选择，只是下次打开回到列表第一个。
  }
}

/**
 * 价格表载荷的形状判定：只盖渲染期**无条件解引用**的那三样——`routes`（`draftFromView`
 * 逐个遍历）、`calendar`（同处 `Object.entries(view.calendar ?? {})`）、`calendarMissing`
 * （`CalendarEditor` 的 `filter`/`join`）。
 * 不合法按一次读失败处理（下方 `loadError` 分支 + 重试），绝不交给 `seed` / `mergeStaged`：
 * 半成品进 state 会让渲染期抛错，而宿主会为一次渲染期异常把这条 slot 摘掉（浮窗从此打不开）。
 * 可选字段（`fx`、模型行的 `name` / `unpriced` / `price`…）一律不收紧。
 * 判据按 host 的组装处与类型：`readPricingView`（`src/pricing-view.ts`）与 `PricingView`
 * （`src/types.ts`）——这里只给符号名，不写行号（行号每改一次就错一次）。
 */
function readPricingView(raw: unknown): PricingView | null {
  if (typeof raw !== 'object' || raw === null) return null
  const source = raw as Partial<PricingView>
  if (!Array.isArray(source.routes)) return null
  if (typeof source.calendar !== 'object' || source.calendar === null) return null
  if (!Array.isArray(source.calendarMissing)) return null
  return source as PricingView
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

/** 触发一次 models.dev 补价。挂载后的自动同步与手动按钮共用：`force` 绕过宿主的日节流。 */
function postPricingSync(force: boolean): Promise<PricingSyncResult> {
  const query = force ? `?${QUERY_FORCE}=1` : ''
  return fetch(`${ROUTE_PRICING_SYNC}${query}`, { method: 'POST' }).then(async (res) => {
    const payload = await res.json().catch(() => null) as (PricingSyncResult & { error?: string }) | null
    if (!res.ok || payload === null) throw new Error(payload?.error ?? `HTTP ${String(res.status)}`)
    return payload
  })
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
  /** models.dev 补价的状态：在飞的那轮与刚落定的判决。状态行据它报"补了 N 条"。 */
  const [sync, setSync] = useState<{ running: boolean; result: PricingSyncResult | null; error: string | null }>({ running: false, result: null, error: null })
  /** 「查价」面板的状态：开关、用户敲的关键词、在飞的那轮与刚落定的候选。 */
  const [lookup, setLookup] = useState<{
    open: boolean
    keyword: string
    loading: boolean
    result: PricingLookupResult | null
    error: string | null
  }>({ open: false, keyword: '', loading: false, result: null, error: null })
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
  /** 成功写入的代数。读路径在发起前记下它、响应落地时对不上就整份丢弃（理由见 `loadView`）。 */
  const writeGenRef = useRef(0)
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

  /** 同步补价后要重读视图，但 `loadView` 声明在后面——经 ref 解耦，避免调换顺序。 */
  const loadViewRef = useRef<(() => Promise<void>) | null>(null)

  /** 把新视图同时采纳为渲染源和基线。**先算完再落 state**：`draftFromView` 万一在这份载荷上抛
   *  （判定没盖到的形状漂移，比如某张卡少了 `models`），异常要在任何 setState 之前发生——
   *  否则会留下「view 已换成新的、state 还是旧的」这种半成品屏。 */
  const seed = useCallback((next: PricingView) => {
    const nextState = draftFromView(next)
    const nextBaseline = baselineOfDraft(nextState)
    setView(next)
    setState(nextState)
    setBaseline(nextBaseline)
  }, [])

  /** 读一次宿主的价格表视图。**读失败是一个可重试的状态**，不是「这张表是空的」——所以它自己
   *  带一次重新读取（与用量明细 / 额度两个 tab 同一形状：错误条 + 重试）。 */
  const loadView = useCallback(async (): Promise<void> => {
    setLoadError(null)
    // 发起这一次读时的写入代数。响应落地时若已经变过，说明这一份读的是**写入之前**的磁盘
    // （GET 在 PUT 之前被处理、却在 PUT 之后才 resolve）——采纳它会把刚写进去的价从屏上抹掉、
    // 让 `changes` 归零（tab 脏点跟着灭），而磁盘其实是新值。所以整份丢弃：不 seed、不 merge、
    // 也不碰 `save` 状态。对账点仍只有重新挂载（会重新 GET 并重新播种，见 docs/CONTRACTS.md:96）。
    const gen = writeGenRef.current
    try {
      const res = await fetch(ROUTE_PRICING)
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`)
      const raw = await res.json() as unknown
      if (!aliveRef.current || writeGenRef.current !== gen) return
      // 形状判定在**任何 setState 之前**：不合法就当一次读失败，绝不把半成品交给 seed / mergeStaged。
      const body = readPricingView(raw)
      if (body === null) throw new Error('响应不是一份价格表视图')
      // 未落盘的草稿只把它真正 dirty 的那几处压上去（见 `mergeStaged`）——于是重读既刷新了
      // 磁盘上的变化，也没有把草稿整份写回去。
      if (staged === null) {
        seed(body)
        return
      }
      const merged = mergeStaged(body, staged)
      setView(body)
      setState(merged.state)
      setBaseline(merged.baseline)
    } catch (err) {
      // 这一次读同样属于被写入取代的那个旧世界：它的失败不该在画着新值的屏上报错。
      if (aliveRef.current && writeGenRef.current === gen) setLoadError(err instanceof Error ? err.message : String(err))
    }
  }, [seed])
  loadViewRef.current = loadView

  // 每次挂载都重读宿主文件：草稿只在自己 dirty 的那几处胜出，不重读就会让期间新增的
  // route / 模型、账本计数与缺年告警一直停在离开那一刻。
  useEffect(() => {
    // 回到面板 = 一次提交点：上次没写完的坏草稿要说出原因，而不是只挂着一句「待保存…」。
    if (staged !== null) committedRef.current = true
    void loadView()
  }, [loadView])

  /**
   * 触发一轮 models.dev 补价并刷新视图。`force`（手动按钮）绕过日节流；挂载的
   * 自动同步不带 force——今天同步过就由宿主直接答 0 格，等于免费。
   */
  const runSync = useCallback(async (force: boolean): Promise<void> => {
    setSync({ running: true, result: null, error: null })
    try {
      const result = await postPricingSync(force)
      setSync({ running: false, result, error: null })
      // 补上的价在磁盘上：重读让下拉的「N 个模型未知」与行内价立即跟上。
      // 同步写（writeGen）已推进的旧世界丢弃规则在这里自然成立——loadView 自己比对。
      if (result.added > 0) await loadViewRef.current?.()
    } catch (err) {
      setSync({ running: false, result: null, error: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  /**
   * 「查价」：按关键词在 models.dev 的**原厂采信目录**里模糊搜索，返回排序后的候选。
   *  与 `runSync` 的分工：那条是自动补洞（账本用过的 × 精确名 × 缺价的），这条是
   *  用户自己挑。候选池里没有转售价，所以不存在「便宜的转售价冒充通道成本」——
   *  用户要做的只是挑哪一家原厂。
   */
  const postLookup = useCallback((keyword: string): Promise<PricingLookupResult> => {
    const query = `?${new URLSearchParams({ [QUERY_MODEL]: keyword }).toString()}`
    return fetch(`${ROUTE_PRICING_LOOKUP}${query}`).then(async (res) => {
      const payload = await res.json().catch(() => null) as (PricingLookupResult & { error?: string }) | null
      if (!res.ok || payload === null) throw new Error(payload?.error ?? `HTTP ${String(res.status)}`)
      return payload
    })
  }, [])

  /** 用给定的关键词跑一轮搜索，并把结果写进面板。在飞期间面板不接受新的搜索。 */
  const doSearch = useCallback(async (keyword: string): Promise<void> => {
    setLookup((current) => ({ ...current, loading: true, error: null }))
    try {
      const result = await postLookup(keyword)
      if (!aliveRef.current) return
      setLookup((current) => current.open ? { ...current, loading: false, result, error: null } : current)
    } catch (err) {
      if (!aliveRef.current) return
      setLookup((current) => current.open ? { ...current, loading: false, result: null, error: err instanceof Error ? err.message : String(err) } : current)
    }
  }, [postLookup])

  /** 改关键词：清掉上一轮的结果，避免旧候选被当成还匹配。真正去搜的是 `doSearch`。 */
  const changeKeyword = useCallback((text: string) => {
    setLookup((current) => ({ ...current, keyword: text, result: null, error: null }))
  }, [])

  const closeLookup = useCallback(() => {
    setLookup((current) => ({ ...current, open: false }))
  }, [])

  // 挂载后自动同步一次：每天首次打开价表 tab 时补价（「手动按钮 + 每天首次打开时
  // 自动同步」）。读先落地再同步，使状态行的"上次同步"有据可依。
  const autoSyncedRef = useRef(false)
  useEffect(() => {
    if (autoSyncedRef.current) return
    autoSyncedRef.current = true
    void runSync(false)
  }, [runSync])

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
    // 写成功了：从这一刻起，任何在它之前发起的读都是旧世界（见 `loadView`）。
    writeGenRef.current += 1
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

  /** 改汇率。它是**唯一的**换算率：只在切换通道报价币种、以及 host 把美元通道折成人民币时被读。
   *  写不写得出去由 `composePriceBody` 说。 */
  const updateFx = useCallback((text: string) => {
    setState(current => withFx(current, text))
  }, [])

  /** 换一条通道的报价币种：按当前汇率把它的价整体重记（一次真正的改价，自动保存）。
   *  没有汇率时原样不动——切过去只会在保存口被 `composePriceBody` 挡住。 */
  const changeCurrency = useCallback((route: string, next: 'CNY' | 'USD') => {
    setState(current => withRouteCurrency(current, route, next, fxValue(current.fx)))
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
  // 汇率：`rate` 是换算能力（null = 未设，美元报价的通道算不出人民币），`fxProblem` 是这一格的问题。
  const rate = fxValue(state.fx)
  const fxProblem = fxIssue(state.fx)
  // 什么都没选过、也没有任何待写的改动：状态栏没有话要说。常驻一个空盒子会在选择带与
  // 那份价之间撑出一道什么也不说的空隙。
  const veiled = picked === null && save.kind === 'clean' && changes === 0

  /** 打开面板：关键词默认就是当前选中的模型名，打开即搜一次。 */
  const openLookup = useCallback(() => {
    if (card === undefined || row === undefined) return
    setLookup({ open: true, keyword: row.model, loading: true, result: null, error: null })
    void doSearch(row.model)
  }, [card, row, doSearch])

  /**
   * 采用一条候选：把它的四档美元价填进当前这一行的四个格子。**只在美元报价的
   *  通道上**做——人民币通道的挂牌价不是美元价的函数（见 CONTRACTS §2），所以那
   *  时按钮是停用的，面板上另说一句该先切币种。已有峰谷时段原样不动，它是一份
   *  独立的细化。填入即一次普通改价，自动保存会接着把它写盘。
   */
  const adopt = useCallback((candidate: ModelsDevCandidate): void => {
    if (card === undefined || row === undefined) return
    if (card.currency !== 'USD') {
      setLookup((current) => ({ ...current, error: '这条通道按人民币报价，models.dev 的价是美元的。请先在详情头把报价币种切成美元，再回来采用。' }))
      return
    }
    const next: ModelDraft = {
      ...row,
      input: String(candidate.cost.input),
      output: String(candidate.cost.output),
      cacheRead: candidate.cost.cacheRead !== undefined ? String(candidate.cost.cacheRead) : '',
      cacheWrite: candidate.cost.cacheWrite !== undefined ? String(candidate.cost.cacheWrite) : '',
    }
    updateModel(card.route, row.model, next)
    closeLookup()
  }, [card, row, updateModel, closeLookup])

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
      {/* 通道来自本机 settings.yaml 与正在运行的适配器；一个都没有时不画两个空下拉——
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
          {/* 汇率是选择带里唯一**不属于任何一行**的输入：它是全表唯一的换算率——把按美元报价的
              通道折成人民币（计价与悬停读数）、以及切换报价币种时换算已有的数。它旁边那句反向
              读数就是「汇率换算」本身。它是价文件的一部分（保留键 `$fx`），所以自动保存、
              状态栏、未保存圆点全套照旧。 */}
          <label className="dtpl-price-pick-row">
            <span className="dtpl-price-pick-k">汇率</span>
            <span className="dtpl-price-fx">
              <span className="dtpl-price-fx-eq">1 美元 =</span>
              <input
                className="dtpl-price-input dtpl-price-fx-in"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={state.fx}
                placeholder="—"
                aria-label="汇率：1 美元等于多少元"
                aria-invalid={fxProblem !== null || undefined}
                title="1 美元等于多少元。它不动价文件里已写的数，但会重算按美元报价的通道的金额——那些价是美元记的，人民币数字本来就是汇率的函数。人民币通道一分不动。"
                onChange={(event) => updateFx(event.target.value)}
                onKeyDown={(event) => {
                  // Enter 离开这一格（值已暂存）。
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
              <span className="dtpl-price-fx-unit">元</span>
              <span className="dtpl-price-fx-note">
                {inverseHint(rate) ?? '填了才能按美元报价'}
              </span>
            </span>
          </label>
          {fxProblem !== null && <span className="dtpl-price-fx-err" role="alert">{fxProblem}</span>}
        </div>
      )}

      {/* models.dev 补价这一行在状态栏之上常驻（挂载即自动同步一次）：同步是这一屏自己的
          事，跟「这次写没写进去」是两句话，不挤同一条状态。没话时按钮也留——它是入口。 */}
      {state.routes.size > 0 && (
        <div className="dtpl-price-syncbar">
          <button
            type="button"
            className="dtpl-price-ghost"
            disabled={lookup.loading || card === undefined || row === undefined}
            title="按当前模型名在 models.dev 上模糊搜索原厂美元价，找到后可一键采用填入；只在美元报价的通道上采用。"
            onClick={() => void openLookup()}
          >
            查价
          </button>
          <span className="dtpl-price-sync-state" role="status" aria-live="polite">
            {syncText(sync, view?.sync.lastError ?? null)}
          </span>
          <button
            type="button"
            className="dtpl-price-ghost"
            disabled={sync.running}
            title="从 models.dev 拉取原厂美元价，补进账本用过的、缺价的美元通道格；手写价不动。"
            onClick={() => void runSync(true)}
          >
            {sync.running ? '同步中…' : '从 models.dev 补价'}
          </button>
        </div>
      )}
      {/* 「查价」面板：开关时挂在补价条之下、状态栏之上。它跟补价是两件事——
          补价说「自动补了多少洞」，这一块说「你选了哪一份价」。没打开时什么都不占。 */}
      {lookup.open && card !== undefined && row !== undefined && (
        <LookupPanel
          lookup={lookup}
          currency={card.currency}
          currentModel={row.model}
          onKeywordChange={changeKeyword}
          onSearch={doSearch}
          onAdopt={adopt}
          onClose={closeLookup}
        />
      )}

      {/* 状态栏在没话要说时让位（见 `veiled`）：常驻一个空盒子会在选择带与那份价之间撑出空隙。 */}
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

      {/* 读不到就是读不到：错误条已经说了原因，下面不再补一句「没有可显示的通道」——
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
              <p className="dtpl-empty-title">没有可显示的通道</p>
              <p className="dtpl-empty-sub">
                通道来自本机 settings.yaml 与正在运行的适配器；账本或价格表里出现过的通道也会列出来。
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
                currency={card.currency}
                rate={rate}
                onCurrency={(next) => changeCurrency(card.route, next)}
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

interface SyncUiState {
  running: boolean
  result: PricingSyncResult | null
  error: string | null
}

/** 补价一行的文字：优先说在飞/刚落定的这轮，其次宿主记下的上次失败；从没有过就说没同步过。
 *  跳过数不逐条念（那是审计），只说还有多少格没补上——它与「N 个模型未知」是同一个洞。 */
function syncText(sync: SyncUiState, lastError: string | null): string {
  if (sync.running) return '正在从 models.dev 拉取价格…'
  if (sync.error !== null) return `同步失败：${sync.error}`
  if (sync.result !== null) {
    if (sync.result.throttled === true) return '今天已同步过 models.dev（按钮可强制再来一次）'
    if (sync.result.added === 0 && sync.result.skipped === 0) return '已检查 models.dev：没有可补的价'
    const parts: string[] = []
    parts.push(sync.result.added > 0 ? `已补 ${String(sync.result.added)} 条` : '没有需要补的价')
    if (sync.result.skipped > 0) parts.push(`跳过 ${String(sync.result.skipped)} 格（无采信条目或非美元通道）`)
    return parts.join(' · ')
  }
  if (lastError !== null) return `上次同步失败：${lastError}`
  return '尚未从 models.dev 同步过'
}

/** 「查价」面板：可编辑的关键词 + 排序后的候选 + 采用按钮。
 *
 *  拆成独立组件是为了让主面板的状态树不被这一块污染——它自己的开关、在飞与落定
 *  都封在这里，主面板只通过 props 关心「有没有打开 / 选了哪条」。候选池是原厂
 *  采信集（见 `models-dev.ts`），所以每一条都是可信价，不存在转售价冒充通道成本；
 *  用户要做的只是挑哪一家原厂。只在**美元报价**的通道上开放采用。
 */
function LookupPanel({ lookup, currency, currentModel, onKeywordChange, onSearch, onAdopt, onClose }: {
  lookup: { open: boolean; keyword: string; loading: boolean; result: PricingLookupResult | null; error: string | null }
  currency: PriceCurrency
  currentModel: string
  onKeywordChange: (text: string) => void
  onSearch: (keyword: string) => void
  onAdopt: (candidate: ModelsDevCandidate) => void
  onClose: () => void
}) {
  const canSearch = lookup.keyword.trim() !== ''
  const exactKey = normalizeModelId(lookup.keyword)
  const isUsd = currency === 'USD'
  const currentKey = normalizeModelId(currentModel)

  // Esc 关掉面板：它是这一块的对话框，关不掉就得去点 ×。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="dtpl-price-lookup" role="dialog" aria-label="从 models.dev 查模型价">
      <div className="dtpl-price-lookup-head">
        <span className="dtpl-price-lookup-k">查 models.dev</span>
        <input
          className="dtpl-price-input dtpl-price-lookup-input"
          type="text"
          value={lookup.keyword}
          placeholder="模型名（如 deepseek-v4-flash）"
          aria-label="搜索关键词"
          spellCheck={false}
          autoComplete="off"
          // 关键词变了就清掉上一轮结果；真正去搜的是下面那个按钮 / Enter。
          onChange={(event) => onKeywordChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSearch) void onSearch(lookup.keyword)
          }}
        />
        <button
          type="button"
          className="dtpl-price-ghost"
          disabled={!canSearch || lookup.loading}
          onClick={() => void onSearch(lookup.keyword)}
        >
          搜索
        </button>
        <button type="button" className="dtpl-price-ghost" aria-label="关闭" onClick={onClose}>
          ×
        </button>
      </div>
      {!isUsd && (
        <p className="dtpl-price-lookup-note">
          这条通道按人民币报价，models.dev 的价是美元的——先在详情头把报价币种切成美元，再回来采用。
        </p>
      )}
      {lookup.loading
        ? <p className="dtpl-price-lookup-empty">搜索中…</p>
        : lookup.error !== null
          ? (
            <p className="dtpl-price-lookup-empty">
              搜索失败：{lookup.error}
              <button type="button" className="dtpl-price-ghost" onClick={() => void onSearch(lookup.keyword)}>重试</button>
            </p>
          )
          : lookup.result !== null && lookup.result.candidates.length === 0
            ? (
              <p className="dtpl-price-lookup-empty">
                models.dev 上没有采信的与「{lookup.keyword}」相关的模型。换个关键词试试（模型串、
                或者只敲厂商名如 deepseek / qwen）。
              </p>
            )
            : lookup.result !== null && (
              <ul className="dtpl-price-lookup-list">
                {lookup.result.candidates.map((candidate) => {
                  const isExact = candidate.key === exactKey
                  const isCurrent = candidate.key === currentKey
                  return (
                    <li
                      key={`${candidate.provider}/${candidate.modelId}`}
                      className={`dtpl-price-lookup-item${isExact ? ' is-exact' : ''}`}
                    >
                      <div className="dtpl-price-lookup-id">
                        <span className="dtpl-price-lookup-provider">{candidate.provider}</span>
                        <span className="dtpl-price-lookup-slash">/</span>
                        <span>{candidate.modelId}</span>
                        {isExact && <span className="dtpl-price-lookup-badge" title="与你搜的关键词完全同一模型">就是这条</span>}
                        {isCurrent && !isExact && <span className="dtpl-price-lookup-badge" title="与当前选中的模型同一模型串">当前这条</span>}
                      </div>
                      <div className="dtpl-price-lookup-name">{candidate.name}</div>
                      <div className="dtpl-price-lookup-cost">{lookupCostText(candidate.cost)}</div>
                      <button
                        type="button"
                        className="dtpl-price-ghost"
                        disabled={!isUsd}
                        title={isUsd
                          ? `把 ${candidate.provider}/${candidate.modelId} 的四档美元价填进这一行`
                          : '这条通道按人民币报价，models.dev 的价是美元的；先在详情头把报价币种切成美元'}
                        onClick={() => onAdopt(candidate)}
                      >
                        采用
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
      }
    </div>
  )
}

/** 一条候选的四档价：美元 / 百万词元，缺的档就不列。 */
function lookupCostText(cost: ModelsDevCandidate['cost']): string {
  const parts: string[] = [`$${String(cost.input)}`, `$${String(cost.output)}`]
  if (cost.cacheRead !== undefined) parts.push(`读 $${String(cost.cacheRead)}`)
  if (cost.cacheWrite !== undefined) parts.push(`写 $${String(cost.cacheWrite)}`)
  return `${parts.join(' / ')} / 百万词元`
}
