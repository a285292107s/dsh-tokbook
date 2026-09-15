/**
 * 词元账本浮窗的价格表 tab。
 *
 * 没有保存按钮也没有撤销：任何变更在停止输入一拍后自动写入。磁盘上的内容是唯一状态，工具栏只报告它。账本已计费过的行绝不留下无日期的价（`anchoredRow`）。
 *
 * @module dsh-tokbook/client/pricing/PricingPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PricingView } from '../../types.ts'
import {
  anchoredRow, baselineOfDraft, baselinesOf, composePriceBody, draftFromView, isUnpriced, stagedChanges, rowKey,
  type ModelDraft, type PriceDraft, type RouteDraft,
} from './draft.ts'
import { RouteCard } from './editors.tsx'

export interface PricingPanelProps {
  /** 保存成功后通知父级刷新总览。 */
  onChanged: () => void
  /** 报告 tab 当前是否有未保存的暂存改动（驱动 tab 圆点）。不在 unmount
   *  时清除：草稿跨面板存活。 */
  onDirtyChange?: (dirty: boolean) => void
}

/** 最后一次按键后 tab 等待多久才写入。足够长以合并一行的四个数字，足够短以感觉即时。 */
const AUTO_SAVE_DELAY_MS = 600

/** footer 关于磁盘文件的状态。 */
type SaveState =
  | { kind: 'clean' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  /** 草稿本身尚不可写（必填数字为空）。文件仍持有最后的好状态；下次编辑重试。 */
  | { kind: 'invalid'; message: string }
  /** 宿主拒绝或请求失败；未写入任何内容。 */
  | { kind: 'error'; message: string }

/**
 * 尚未到达磁盘的草稿在面板 unmount 后存活（切 tab、关浮窗），使尚未触发的自动保存——或被宿主拒绝的保存——绝不被悄悄丢弃。
 */
interface Staged {
  view: PricingView
  draft: PriceDraft
  baseline: { models: Map<string, string>; billing: Map<string, 'metered' | 'subscription'> }
}
let staged: Staged | null = null

function putPrice(body: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  return fetch('/tokbook/pricing', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const payload = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null
    if (!res.ok || payload === null || payload.ok !== true) {
      const message = payload?.error !== undefined && payload.error !== '' ? payload.error : `HTTP ${String(res.status)}`
      return { ok: false as const, error: message }
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
  const [draft, setDraft] = useState<PriceDraft>(() => staged?.draft ?? new Map())
  const [baseline, setBaseline] = useState<Staged['baseline']>(() => staged?.baseline ?? { models: new Map(), billing: new Map() })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>({ kind: 'clean' })
  const [query, setQuery] = useState('')
  const [unknownOnly, setUnknownOnly] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)
  // 通道卡默认收纳：这里记的是**被点开过**的路由，空集 = 全部收起。
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())

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

  /** 把新视图同时采纳为渲染源和基线。 */
  const seed = useCallback((next: PricingView) => {
    setView(next)
    setDraft(draftFromView(next))
    setBaseline(baselinesOf(next))
  }, [])

  // 首次挂载：从未到达磁盘的草稿优先于宿主文件。
  useEffect(() => {
    if (staged !== null) return
    let alive = true
    void (async () => {
      try {
        const res = await fetch('/tokbook/pricing')
        if (!res.ok) throw new Error(`HTTP ${String(res.status)}`)
        const body = await res.json() as PricingView
        if (alive) seed(body)
      } catch (err) {
        if (alive) setLoadError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => { alive = false }
  }, [seed])

  /**
   * 写入整个文件。草稿尚无效时拒绝（不写入），使半输入的数字不能阻塞或破坏其余内容；防抖 effect 在草稿再次变化时重试。保存串行化：在飞的写入期间发生的变更排队一次。
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
      if (aliveRef.current) setSave({ kind: 'invalid', message: composed.error })
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
    if (staged !== null) {
      staged = stagedChanges(staged.draft, nextBaseline) > 0
        ? { ...staged, baseline: nextBaseline }
        : null
    }
    if (!aliveRef.current) {
      if (againRef.current) {
        againRef.current = false
        void writeNow()
      }
      return
    }
    // 本地草稿保持为唯一真源——从响应重新播种会 remount 用户可能仍在输入的输入框。
    setBaseline(nextBaseline)
    setSave({ kind: 'saved', at: Date.now() })
    onChanged()
    if (againRef.current) {
      againRef.current = false
      void writeNow()
    }
  }, [onChanged])

  // 自动保存：任何变更重置短计时器；最后一次变更胜出。写入器经 ref 读取，使父级 re-render 绝不会饿死防抖。
  const writeRef = useRef(writeNow)
  writeRef.current = writeNow
  useEffect(() => {
    if (changes === 0) {
      setSave(current => (current.kind === 'pending' || current.kind === 'invalid' ? { kind: 'clean' } : current))
      return
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    setSave(current => (current.kind === 'error' ? current : { kind: 'pending' }))
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

  // 离开 tab（或关闭浮窗）不能搁浅一次待写的保存。
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (stagedChanges(draftRef.current, baselineRef.current) > 0) void writeNow()
    }
  }, [writeNow])

  const updateModel = useCallback((route: string, model: string, next: ModelDraft) => {
    setDraft((current) => {
      const card = current.get(route)
      if (card === undefined) return current
      const models = new Map(card.models)
      models.set(model, anchoredRow(next))
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

  /** 打开/关闭一行的调价史（一次只开一个：列表不铺开）。 */
  const toggleRow = useCallback((route: string, model: string) => {
    setOpenKey(current => (current === rowKey(route, model) ? null : rowKey(route, model)))
  }, [])

  const toggleCard = useCallback((route: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(route)) next.delete(route)
      else next.add(route)
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

  const pricedCount = useMemo(() => {
    let count = 0
    for (const card of draft.values()) {
      for (const row of card.models.values()) if (!isUnpriced(row)) count += 1
    }
    return count
  }, [draft])

  const unknownCount = useMemo(() => {
    let count = 0
    for (const card of draft.values()) {
      for (const row of card.models.values()) if (isUnpriced(row)) count += 1
    }
    return count
  }, [draft])

  /** 卡收起时关闭其抽屉，避免内容藏在收纳后面。 */
  useEffect(() => {
    if (openKey === null) return
    const route = openKey.split('\u0000')[0] ?? ''
    if (!expanded.has(route)) setOpenKey(null)
  }, [expanded, openKey])

  const cards = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const out: RouteDraft[] = []
    for (const card of draft.values()) {
      const routeHit = needle !== '' && (card.route.toLowerCase().includes(needle) || card.label.toLowerCase().includes(needle))
      const models = new Map<string, ModelDraft>()
      for (const [model, row] of card.models) {
        if (unknownOnly && !isUnpriced(row)) continue
        // 搜索覆盖行显示的内容：展示名、精确模型串，以及整个 route 匹配时其下所有行。
        if (needle !== '' && !routeHit
          && !model.toLowerCase().includes(needle)
          && !(row.name ?? '').toLowerCase().includes(needle)) continue
        models.set(model, row)
      }
      // 有筛选时卡片显示筛选保留的行，忽略折叠状态：把匹配藏在折叠后面会被读成「无结果」。
      if (models.size === 0) continue
      out.push(needle !== '' || unknownOnly ? { ...card, models } : card)
    }
    return out
  }, [draft, query, unknownOnly])

  const filtering = query.trim() !== '' || unknownOnly
  const stateText = saveStateText(save, pricedCount)

  return (
    <section className="dtpl-price-sec" aria-label="价格表">
      <div className="dtpl-price-bar">
        <input
          className="dtpl-price-search"
          type="search"
          placeholder="搜索模型串 / 通道路由"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="搜索模型串或通道路由"
        />
        <button
          type="button"
          className={`dtpl-price-chip${unknownOnly ? ' is-on' : ''}`}
          aria-pressed={unknownOnly}
          onClick={() => setUnknownOnly(value => !value)}
        >
          {unknownOnly ? '只看价格未知' : '价格未知'} {String(unknownCount)} 个模型
        </button>
        <span className={`dtpl-price-state is-${save.kind}`} role="status" aria-live="polite">
          {stateText}
        </span>
        {save.kind === 'error' && (
          <button type="button" className="dtpl-price-ghost" onClick={() => void writeNow()}>重试</button>
        )}
      </div>

      {cards.length > 0 && (
        <p className="dtpl-price-legend">
          <b>—</b> 表示还没写价（暂按 ¥0 计，<b>不是免费</b>）。行内四个数字改的是
          <b>当前生效那一段的全天价</b>——改它就是重算用这段价计费的历史；
          要从现在起调价、或给某个时段单独定价，点行尾的 ▸。
        </p>
      )}

      {loadError !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">{loadError}</p>
          <button type="button" className="dtpl-retry" onClick={() => setLoadError(null)}>知道了</button>
        </div>
      )}

      {view === null && loadError === null
        ? <div className="dtpl-skeleton" aria-hidden="true"><div className="dtpl-sk dtpl-sk-card" /><div className="dtpl-sk dtpl-sk-card" /></div>
        : cards.length === 0
          ? (
            <div className="dtpl-empty">
              <p className="dtpl-empty-title">{unknownOnly ? '没有价格未知的模型' : '没有可显示的路由'}</p>
              <p className="dtpl-empty-sub">
                卡片来自本机 settings.yaml 的路由与正在运行的适配器；账本或价格表里出现过的路由也会列出来。
              </p>
            </div>
          )
          : (
            <div className="dtpl-price-cards">
              {cards.map(card => (
                <RouteCard
                  key={card.route}
                  card={card}
                  baseline={baseline.models}
                  collapsed={!filtering && !expanded.has(card.route)}
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

/** footer 关于文件的说法：先报保存状态，无可报告时显示表自身的规模。 */
function saveStateText(save: SaveState, priced: number): string {
  switch (save.kind) {
    case 'pending': return '待保存…'
    case 'saving': return '保存中…'
    case 'saved': return `已保存 ${clockOf(save.at)}`
    case 'invalid': return `未保存：${save.message}`
    case 'error': return `保存失败：${save.message}`
    default: return `已定价 ${String(priced)} 条模型`
  }
}

export { rowKey }
