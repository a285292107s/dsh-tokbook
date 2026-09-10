/**
 * 价格表 tab of the token-book floating window.
 *
 * ONE card per provider route, ONE row per model the route can be billed for —
 * the two things the ledger actually names. Every price is hand-written: four
 * ¥/M buckets plus the date they take effect (several dated segments make a
 * 调价史). A row with no segment is 价格未知 and bills ¥0.
 *
 * There is no save button and no revert: any change — a rate, an effective
 * date, a segment, the 按量 / 订阅 switch — is written automatically a beat
 * after you stop typing, and a write that cannot go through is retried by the
 * next edit. What is on disk is therefore the only state, so the toolbar just
 * reports it (保存中 / 已保存 / 未保存+原因 / 保存失败+原因 with 重试).
 *
 * Reading order:
 *   · 工具栏 — search (model string / route key / route label), a 价格未知
 *     filter, and the save state of the file;
 *   · 路由卡片 — the route's display name and key, its 计费性质 switch (按量 /
 *     订阅), and one row per model: where the string came from (配置 / 仅账本),
 *     账本次数, the price in force, and 定价 / 改价 to open its segments.
 *
 * @module dsh-tokbook/client/pricing/PricingPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PricingView } from '../../types.ts'
import {
  baselineOfDraft, baselinesOf, composePriceBody, draftFromView, isUnpriced, stagedChanges, rowKey,
  type ModelDraft, type PriceDraft, type RouteDraft,
} from './draft.ts'
import { RouteCard } from './editors.tsx'

/** A cross-tab request (the overview's 价格未知 note) to open on that filter. */
export type PricingFocus = 'unpriced' | null

export interface PricingPanelProps {
  /** Called after a successful save so the parent can refresh the overview. */
  onChanged: () => void
  /** Reports whether the tab currently holds unsaved staged edits (drives the
   *  tab dot). Not cleared on unmount: the drafts outlive the panel. */
  onDirtyChange?: (dirty: boolean) => void
  /** A cross-tab request (the overview's 价格未知 note) to open on one filter. */
  focus?: PricingFocus | null
  /** Called once `focus` has been applied. */
  onFocusHandled?: () => void
}

/** How long the tab waits after the last keystroke before writing. Long enough
 *  to coalesce one row's four numbers, short enough to feel immediate. */
const AUTO_SAVE_DELAY_MS = 600

/** What the footer says about the file on disk. */
type SaveState =
  | { kind: 'clean' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  /** The draft itself is not writable yet (a required number is empty). The
   *  file still holds the last good state; the next edit retries. */
  | { kind: 'invalid'; message: string }
  /** The host refused or the request failed; nothing was written. */
  | { kind: 'error'; message: string }

/**
 * A draft that has not reached disk survives a panel unmount (switching tabs,
 * or closing the floating window), so an auto-save that has not fired yet — or
 * one the host refused — is never silently dropped.
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

export function PricingPanel({ onChanged, onDirtyChange, focus, onFocusHandled }: PricingPanelProps) {
  const [view, setView] = useState<PricingView | null>(() => staged?.view ?? null)
  const [draft, setDraft] = useState<PriceDraft>(() => staged?.draft ?? new Map())
  const [baseline, setBaseline] = useState<Staged['baseline']>(() => staged?.baseline ?? { models: new Map(), billing: new Map() })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>({ kind: 'clean' })
  const [query, setQuery] = useState('')
  const [unknownOnly, setUnknownOnly] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  const changes = useMemo(() => stagedChanges(draft, baseline), [draft, baseline])

  // Refs the debounced writer reads, so a save never captures a stale draft.
  const draftRef = useRef(draft)
  draftRef.current = draft
  const baselineRef = useRef(baseline)
  baselineRef.current = baseline
  const timerRef = useRef<number | null>(null)
  const writingRef = useRef(false)
  const againRef = useRef(false)
  const aliveRef = useRef(true)

  /** Adopt a fresh view as both the render source and the baseline. */
  const seed = useCallback((next: PricingView) => {
    setView(next)
    setDraft(draftFromView(next))
    setBaseline(baselinesOf(next))
  }, [])

  // First mount: a draft that never reached disk wins over the host's file.
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

  // The overview's 价格未知 note jumps straight to the filter.
  useEffect(() => {
    if (focus !== 'unpriced') return
    setUnknownOnly(true)
    onFocusHandled?.()
  }, [focus, onFocusHandled])

  /**
   * Write the whole file. Refuses (without writing) while the draft is not yet
   * valid, so a half-typed number cannot block or corrupt the rest; the debounce
   * effect retries as soon as the draft changes again. Saves are serialized:
   * a change made while a write is in flight queues one more, newest last.
   */
  const writeNow = useCallback(async (): Promise<void> => {
    if (stagedChanges(draftRef.current, baselineRef.current) === 0) return
    if (writingRef.current) {
      againRef.current = true
      return
    }
    // Freeze the draft this PUT writes. The live ref may already hold later
    // keystrokes by the time the response lands; advancing the baseline to
    // those would mark unsent edits as saved and skip the queued rewrite.
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
    // Baseline always moves to what was just written, even after unmount —
    // the flush-on-leave write must leave `staged` clean or the next mount
    // re-saves the same body and shows a false dirty mark.
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
    // Keep the local draft as the source of truth — re-seeding from the response
    // would remount the inputs the user may still be typing in.
    setBaseline(nextBaseline)
    setSave({ kind: 'saved', at: Date.now() })
    onChanged()
    if (againRef.current) {
      againRef.current = false
      void writeNow()
    }
  }, [onChanged])

  // Auto-save: any change re-arms a short timer; the last change wins. The
  // writer is read through a ref so a parent re-render (which hands down a new
  // callback identity) can never starve the debounce. Editing back to the state
  // on disk drops a pending/invalid report — a `saved` or `error` report stays
  // until something actually happens.
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

  // A draft that never reached disk is kept for the next mount; a clean one is
  // dropped so the next mount reads the host's file.
  useEffect(() => {
    if (view === null) return
    staged = changes > 0 ? { view, draft, baseline } : null
  }, [view, draft, baseline, changes])

  useEffect(() => { onDirtyChange?.(changes > 0) }, [changes, onDirtyChange])

  // Leaving the tab (or closing the window) must not strand a pending write.
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

  /** Open/close one row's 调价史 (one at a time: the list never sprawls). */
  const toggleRow = useCallback((route: string, model: string) => {
    setOpenKey(current => (current === rowKey(route, model) ? null : rowKey(route, model)))
  }, [])

  const toggleCard = useCallback((route: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(route)) next.delete(route)
      else next.add(route)
      return next
    })
  }, [])

  // Ctrl/Cmd+S flushes a pending write immediately (the file saves anyway).
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

  /** Close a row's drawer when its card folds, so nothing hides unfolded. */
  useEffect(() => {
    if (openKey === null) return
    const route = openKey.split('\u0000')[0] ?? ''
    if (collapsed.has(route)) setOpenKey(null)
  }, [collapsed, openKey])

  const cards = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const out: RouteDraft[] = []
    for (const card of draft.values()) {
      const routeHit = needle !== '' && (card.route.toLowerCase().includes(needle) || card.label.toLowerCase().includes(needle))
      const models = new Map<string, ModelDraft>()
      for (const [model, row] of card.models) {
        if (unknownOnly && !isUnpriced(row)) continue
        if (needle !== '' && !routeHit && !model.toLowerCase().includes(needle)) continue
        models.set(model, row)
      }
      // A filtered card shows the rows the filter kept, whatever its fold
      // state: hiding a match behind a fold would read as "no result".
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
          {unknownOnly ? '只看未定价' : '未定价'} {String(unknownCount)} 个模型
        </button>
        <span className={`dtpl-price-state is-${save.kind}`} role="status" aria-live="polite">
          {stateText}
        </span>
        {save.kind === 'error' && (
          <button type="button" className="dtpl-price-ghost" onClick={() => void writeNow()}>重试</button>
        )}
      </div>

      {unknownCount > 0 && (
        <p className="dtpl-price-legend">
          <b>—</b> 表示还没写价（暂按 ¥0 计，<b>不是免费</b>）；点上任意一格即可就地填写四档价，
          需要调价史时点行尾的 ▸。
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
                  collapsed={!filtering && collapsed.has(card.route)}
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

/** What the footer says about the file: the save state first, the table's own
 *  size when there is nothing to report. */
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
