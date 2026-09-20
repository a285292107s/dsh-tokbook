/**
 * 词元账本浮窗的价格表 tab。
 *
 * 没有保存按钮也没有撤销：变更在停止输入一拍后自动写入，字段失焦则立刻写。草稿写不出来的
 * 时候（半输入的数字）不写也不报，等这个字段交代完才说——口径与理由见 D-040。磁盘上的内容是
 * 唯一状态，工具栏只报告它。行内四个数字只读，改价在展开的抽屉里（第一张是托底价）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PriceVerdict, PricingView } from '../../types.ts'
import { ROUTE_PRICING } from '../../route-paths.ts'
import {
  baselineOfDraft, baselinesOf, composePriceBody, draftFromView, priceUnknown, stagedChanges, rowKey,
  type ModelDraft, type PriceDraft, type RouteDraft,
} from './draft.ts'
import { RouteCard } from './editors.tsx'

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

/** 工具栏那条状态文字。 */
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
  draft: PriceDraft
  baseline: { models: Map<string, string>; billing: Map<string, 'metered' | 'subscription'> }
}
let staged: Staged | null = null

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

/** 整张表的规模与缺口——**不受筛选影响**，所以它报的永远是这张表本身。 */
interface PriceStats {
  routes: number
  models: number
  /** 价格未知的模型数（同一个判定见 `priceUnknown`）。 */
  unknown: number
  /** 这些模型名下有多少条账本请求计 ¥0。与 `unknown` 用**同一个判定**取，所以补上托底价之后
   *  两者一起归零，屏幕上不会出现「0 个模型未知、却还有 N 次请求没价」这种自相矛盾的读数。 */
  unpricedRequests: number
}

function priceStats(draft: PriceDraft): PriceStats {
  let models = 0
  let unknown = 0
  let unpricedRequests = 0
  for (const card of draft.values()) {
    for (const row of card.models.values()) {
      models += 1
      if (priceUnknown(row)) {
        unknown += 1
        unpricedRequests += row.unpriced ?? 0
      }
    }
  }
  return { routes: draft.size, models, unknown, unpricedRequests }
}

export function PricingPanel({ onChanged, onDirtyChange }: PricingPanelProps) {
  const [view, setView] = useState<PricingView | null>(() => staged?.view ?? null)
  const [draft, setDraft] = useState<PriceDraft>(() => staged?.draft ?? new Map())
  const [baseline, setBaseline] = useState<Staged['baseline']>(() => staged?.baseline ?? { models: new Map(), billing: new Map() })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>({ kind: 'clean' })
  const [query, setQuery] = useState('')
  const [unknownOnly, setUnknownOnly] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)
  /** 通道卡的展开态：只记**被手动改过**的通道，其余走默认（第一条展开，见 `openRoutes`）。 */
  const [folds, setFolds] = useState<ReadonlyMap<string, boolean>>(() => new Map())

  const changes = useMemo(() => stagedChanges(draft, baseline), [draft, baseline])

  // 防抖写入器读的 ref，保存绝不捕获过期草稿。
  const draftRef = useRef(draft)
  draftRef.current = draft
  const baselineRef = useRef(baseline)
  baselineRef.current = baseline
  const timerRef = useRef<number | null>(null)
  const writingRef = useRef(false)
  const againRef = useRef(false)
  const aliveRef = useRef(true)
  /** 用户是否已经「交代过」某个字段（失焦 / 重新回到面板）。打字途中的失败保持沉默——
   *  半输入的数字不是错误，只有离开这个字段之后它才是（见 D-040）。 */
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
    setDraft(draftFromView(next))
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
   * 那一刻报错只会把「还没打完」读成「你错了」（见 D-040）。
   */
  const writeNow = useCallback(async (): Promise<void> => {
    if (stagedChanges(draftRef.current, baselineRef.current) === 0) return
    if (writingRef.current) {
      againRef.current = true
      return
    }
    // 冻结本次 PUT 写入的草稿。响应落地时 live ref 可能已持有更晚的按键。
    const snapshot = draftRef.current
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
      staged = stagedChanges(staged.draft, nextBaseline) > 0
        ? { ...staged, baseline: nextBaseline }
        : null
    }
    // 在飞期间又攒了改动：接上下一笔，别让这一笔之后的重写被跳过。
    const queued = againRef.current
    againRef.current = false
    if (!aliveRef.current) {
      // 卸载后的补写：状态栏已经不在了，但 tab 圆点与父级屏上的金额都还活着——两样都得同步。
      onDirtyChange?.(stagedChanges(draftRef.current, baselineRef.current) > 0)
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
  }, [changes, draft])

  // 从未到达磁盘的草稿留给下次挂载；干净的丢弃，使下次挂载读宿主文件。
  useEffect(() => {
    if (view === null) return
    staged = changes > 0 ? { view, draft, baseline } : null
  }, [view, draft, baseline, changes])

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
      if (stagedChanges(draftRef.current, baselineRef.current) > 0) void writeNow()
    }
  }, [writeNow, onChanged])

  const updateModel = useCallback((route: string, model: string, next: ModelDraft) => {
    setDraft((current) => {
      const card = current.get(route)
      if (card === undefined) return current
      const models = new Map(card.models)
      models.set(model, next)
      const copy = new Map(current)
      copy.set(route, { ...card, models })
      return copy
    })
  }, [])

  const updateBilling = useCallback((route: string, billing: 'metered' | 'subscription') => {
    setDraft((current) => {
      const card = current.get(route)
      if (card === undefined) return current
      const copy = new Map(current)
      copy.set(route, { ...card, billing })
      return copy
    })
  }, [])

  /** 打开/关闭一行的调价史（一次只开一个）。 */
  const toggleRow = useCallback((route: string, model: string) => {
    setOpenKey(current => (current === rowKey(route, model) ? null : rowKey(route, model)))
  }, [])

  const toggleCard = useCallback((route: string, open: boolean) => {
    setFolds((current) => {
      const next = new Map(current)
      next.set(route, !open)
      return next
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

  const stats = useMemo(() => priceStats(draft), [draft])

  /** 筛选态：搜索词或「只看价格未知」任一在场。 */
  const filtering = query.trim() !== '' || unknownOnly

  const cards = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const out: RouteDraft[] = []
    for (const card of draft.values()) {
      const routeHit = needle !== '' && (card.route.toLowerCase().includes(needle) || card.label.toLowerCase().includes(needle))
      const models = new Map<string, ModelDraft>()
      for (const [model, row] of card.models) {
        if (unknownOnly && !priceUnknown(row)) continue
        // 搜索覆盖行显示的内容：展示名、精确模型串，以及整个 route 匹配时其下所有行。
        if (needle !== '' && !routeHit
          && !model.toLowerCase().includes(needle)
          && !(row.name ?? '').toLowerCase().includes(needle)) continue
        models.set(model, row)
      }
      // 有筛选时卡片显示筛选保留的行，忽略折叠状态：匹配不能藏在折叠后面。
      if (models.size === 0) continue
      out.push(needle !== '' || unknownOnly ? { ...card, models } : card)
    }
    return out
  }, [draft, query, unknownOnly])

  /** 这一刻哪些通道是展开的：**默认第一条**（host 正按请求数排序，所以就是第一张）；筛选时全部展开。 */
  const openRoutes = useMemo(() => {
    const out = new Set<string>()
    cards.forEach((card, index) => {
      if (filtering || (folds.get(card.route) ?? index === 0)) out.add(card.route)
    })
    return out
  }, [cards, filtering, folds])

  /** 卡收起时关闭其抽屉。 */
  useEffect(() => {
    if (openKey === null) return
    const route = openKey.split('\u0000')[0]
    if (!openRoutes.has(route)) setOpenKey(null)
  }, [openRoutes, openKey])

  const clearFilter = useCallback(() => {
    setQuery('')
    setUnknownOnly(false)
  }, [])

  const stateText = saveStateText(save)
  /** 写不进去（草稿无效 / 宿主或磁盘拒绝）：行上那枚「未保存」徽章只在这种时候出现。 */
  const writeStuck = save.kind === 'invalid' || save.kind === 'error'

  return (
    <section
      className="dtpl-price-sec"
      aria-label="价格表"
      // 任一字段失焦 = 提交点：立刻写一次（不必再等防抖），并让此后写不进去的失败说话。
      // **没有待写的改动就不算一次交代**——否则在这里随便点一下，下一次打字的中途报错就被放行了。
      onBlur={() => {
        if (stagedChanges(draftRef.current, baselineRef.current) === 0) return
        committedRef.current = true
        void writeRef.current()
      }}
    >
      <div className="dtpl-price-bar">
        <input
          className="dtpl-price-search"
          type="search"
          placeholder="搜索模型串 / 通道路由"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="搜索模型串或通道路由"
        />
        <span className={`dtpl-price-state is-${save.kind}`} role="status" aria-live="polite">
          {stateText}
        </span>
        {save.kind === 'error' && (
          <button type="button" className="dtpl-price-ghost" onClick={() => void writeNow()}>重试</button>
        )}
        <button
          type="button"
          className={`dtpl-price-chip${unknownOnly ? ' is-on' : ''}`}
          aria-pressed={unknownOnly}
          title="整行没有价，或账本里有早于最早一段价的记录（那些按 ¥0 计）"
          onClick={() => setUnknownOnly(value => !value)}
        >
          {unknownOnly ? '只看价格未知' : '价格未知'}
        </button>
      </div>

      {(draft.size > 0 || cards.length > 0) && (
        <div className="dtpl-price-read">
          {/* 「其中」不能省：这个数**不是**「没有价的模型数」，而是「有账本记录落在价外」的模型数
              ——它可能已经写着价（写下的生效时间静默截断了它之前的一切），所以它与上面那个总数
              之间不是「有价 / 无价」的划分。写成并列的两个类别会让读者以为这里面有一批模型压根没价。 */}
          <span className="dtpl-hero-facts">
            <span className="dtpl-hero-fact"><b>{String(stats.routes)}</b> 条通道</span>
            <i aria-hidden="true">·</i>
            <span className="dtpl-hero-fact"><b>{String(stats.models)}</b> 个模型</span>
            <i aria-hidden="true">·</i>
            {stats.unknown === 0
              ? <span className="dtpl-hero-fact">全部有价</span>
              : (
                <span className="dtpl-hero-fact dtpl-price-fact-unknown">
                  其中 <b>{String(stats.unknown)}</b> 个价格未知
                  {stats.unpricedRequests > 0 && <>（<b>{String(stats.unpricedRequests)}</b> 次请求按 ¥0 记）</>}
                </span>
              )}
          </span>
          {cards.length > 0 && (
            <p className="dtpl-price-legend">
              四个数字是此刻计费所用的价（¥/百万词元），只读；<b>「—」</b>= 这一刻还没有价，
              暂按 ¥0 计（不是免费）。改价点开这一行，改动自动写进文件。
            </p>
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
              <div className="dtpl-sk dtpl-price-sk-facts" />
              <div className="dtpl-sk dtpl-price-sk-open" />
              <div className="dtpl-sk dtpl-price-sk-card" />
            </div>
          )
          : null)
        : cards.length === 0
          ? (
            <div className="dtpl-empty">
              {filtering && draft.size > 0
                ? (
                  <>
                    <p className="dtpl-empty-title">
                      {unknownOnly && query.trim() === '' ? '没有价格未知的模型' : '没有匹配的模型'}
                    </p>
                    <p className="dtpl-empty-sub">
                      {`这张表里有 ${String(stats.models)} 个模型${stats.unknown > 0 ? `，其中 ${String(stats.unknown)} 个价格未知` : ''}；当前筛选一个都没留下。`}
                    </p>
                    <button type="button" className="dtpl-price-add dtpl-price-empty-act" onClick={clearFilter}>
                      清除筛选
                    </button>
                  </>
                )
                : (
                  <>
                    <p className="dtpl-empty-title">没有可显示的路由</p>
                    <p className="dtpl-empty-sub">
                      卡片来自本机 settings.yaml 的路由与正在运行的适配器；账本或价格表里出现过的路由也会列出来。
                    </p>
                  </>
                )}
            </div>
          )
          : (
            <div className="dtpl-price-cards">
              {cards.map(card => (
                <RouteCard
                  key={card.route}
                  card={card}
                  baseline={baseline.models}
                  stuck={writeStuck}
                  collapsed={!openRoutes.has(card.route)}
                  openKey={openKey}
                  onToggleCard={toggleCard}
                  onToggleRow={toggleRow}
                  onRowChange={updateModel}
                  onBilling={updateBilling}
                />
              ))}
            </div>
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
