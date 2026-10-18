import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HolidayRefreshResult, ModelsDevCandidate, PriceCurrency, PriceVerdict, PricingLookupResult, PricingSyncResult, PricingSyncView, PricingView } from '../../types.ts'
import { normalizeModelId } from '../../models-dev.ts'
import { QUERY_FORCE, QUERY_MODEL, QUERY_YEAR, ROUTE_HOLIDAY_SYNC, ROUTE_PRICING, ROUTE_PRICING_LOOKUP, ROUTE_PRICING_SYNC } from '../../route-paths.ts'
import { inverseHint } from './currency.ts'
import {
  baselineOfDraft, baselinesOf, calendarDirty, composePriceBody, draftFromView, fxIssue, fxSignature, fxValue, modelDirty,
  modelOptionLabel,
  routeOptionLabel, rowKey, stagedChanges, withCalendar, withFx, withRouteCurrency, adoptYear,
  type CalendarDraft, type CalendarEntries, type ModelDraft, type PriceBaseline, type PriceState,
} from './draft.ts'
import { CalendarEditor, ModelDetail } from './editors.tsx'
import { formatRelative } from '../format.ts'
import { subscribeLedgerChanges } from '../ledger-clock.ts'

export interface PricingPanelProps {
  onChanged: () => void
  onDirtyChange?: (dirty: boolean) => void
}

const AUTO_SAVE_DELAY_MS = 600

const REFRESH_MERGE_MS = 1000

type SaveState =
  | { kind: 'clean' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'invalid'; message: string }
  | { kind: 'error'; message: string }

interface Staged {
  view: PricingView
  state: PriceState
  baseline: PriceBaseline
}
let staged: Staged | null = null

let lastView: PricingView | null = null

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

const EMPTY_STATE: PriceState = { routes: new Map(), calendar: new Map(), holidays: new Set(), autoYears: new Set(), fx: '' }
const EMPTY_BASELINE: PriceBaseline = { models: new Map(), billing: new Map(), currency: new Map(), calendar: '[]', fx: '' }

interface Picked {
  route: string
  model: string
}

const PICKED_KEY = 'dsh-tokbook.pricing-picked'

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
    return null
  }
}

function rememberPicked(pick: Picked | null): void {
  try {
    if (pick === null) localStorage.removeItem(PICKED_KEY)
    else localStorage.setItem(PICKED_KEY, JSON.stringify(pick))
  } catch {
  }
}

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
      const reason = payload !== null && !payload.ok ? payload.error : ''
      return { ok: false as const, error: reason !== '' ? reason : `HTTP ${String(res.status)}` }
    }
    return { ok: true as const }
  }).catch((error: unknown) => ({
    ok: false as const,
    error: error instanceof Error ? error.message : String(error),
  }))
}

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
  const [view, setView] = useState<PricingView | null>(() => staged?.view ?? lastView)
  const [state, setState] = useState<PriceState>(() => staged?.state ?? (lastView === null ? EMPTY_STATE : draftFromView(lastView)))
  const [baseline, setBaseline] = useState<PriceBaseline>(() =>
    staged?.baseline ?? (lastView === null ? EMPTY_BASELINE : baselinesOf(lastView)))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>({ kind: 'clean' })
  const [sync, setSync] = useState<{ running: boolean; result: PricingSyncResult | null; error: string | null }>({ running: false, result: null, error: null })
  const [lookup, setLookup] = useState<{
    open: boolean
    keyword: string
    loading: boolean
    result: PricingLookupResult | null
    error: string | null
  }>({ open: false, keyword: '', loading: false, result: null, error: null })
  const [holiday, setHoliday] = useState<{ running: boolean; result: HolidayRefreshResult | null; error: string | null }>({ running: false, result: null, error: null })
  const [picked, setPicked] = useState<Picked | null>(readPicked)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const choosePicked = useCallback((pick: Picked) => {
    setPicked(pick)
    rememberPicked(pick)
  }, [])

  const changes = useMemo(() => stagedChanges(state, baseline), [state, baseline])

  const stateRef = useRef(state)
  stateRef.current = state
  const baselineRef = useRef(baseline)
  baselineRef.current = baseline
  const timerRef = useRef<number | null>(null)
  const writingRef = useRef(false)
  const againRef = useRef(false)
  const aliveRef = useRef(true)
  const writeGenRef = useRef(0)
  const committedRef = useRef(false)
  const refreshRef = useRef<number | null>(null)

  const notifyChanged = useCallback(() => {
    if (refreshRef.current !== null) window.clearTimeout(refreshRef.current)
    refreshRef.current = window.setTimeout(() => {
      refreshRef.current = null
      onChanged()
    }, REFRESH_MERGE_MS)
  }, [onChanged])

  const loadViewRef = useRef<(() => Promise<void>) | null>(null)

  const seed = useCallback((next: PricingView) => {
    const nextState = draftFromView(next)
    const nextBaseline = baselineOfDraft(nextState)
    setView(next)
    setState(nextState)
    setBaseline(nextBaseline)
  }, [])

  const loadView = useCallback(async (): Promise<void> => {
    setLoadError(null)
    const gen = writeGenRef.current
    try {
      const res = await fetch(ROUTE_PRICING)
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`)
      const raw = await res.json() as unknown
      if (!aliveRef.current || writeGenRef.current !== gen) return
      const body = readPricingView(raw)
      if (body === null) throw new Error('响应不是一份价格表视图')
      if (staged === null) {
        seed(body)
        return
      }
      const merged = mergeStaged(body, staged)
      setView(body)
      setState(merged.state)
      setBaseline(merged.baseline)
    } catch (err) {
      if (aliveRef.current && writeGenRef.current === gen) setLoadError(err instanceof Error ? err.message : String(err))
    }
  }, [seed])
  loadViewRef.current = loadView

  useEffect(() => {
    if (staged !== null) committedRef.current = true
    void loadView()
  }, [loadView])

  useEffect(() => subscribeLedgerChanges(() => {
    if (document.hidden) return
    void loadViewRef.current?.()
  }), [])
  const syncFromUserRef = useRef(false)
  const runSync = useCallback(async (force: boolean): Promise<void> => {
    syncFromUserRef.current = force
    setSync({ running: true, result: null, error: null })
    try {
      const result = await postPricingSync(force)
      setSync({ running: false, result, error: null })
      if (result.added > 0) await loadViewRef.current?.()
    } catch (err) {
      setSync({ running: false, result: null, error: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  const postLookup = useCallback((keyword: string): Promise<PricingLookupResult> => {
    const query = `?${new URLSearchParams({ [QUERY_MODEL]: keyword }).toString()}`
    return fetch(`${ROUTE_PRICING_LOOKUP}${query}`).then(async (res) => {
      const payload = await res.json().catch(() => null) as (PricingLookupResult & { error?: string }) | null
      if (!res.ok || payload === null) throw new Error(payload?.error ?? `HTTP ${String(res.status)}`)
      return payload
    })
  }, [])

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

  const changeKeyword = useCallback((text: string) => {
    setLookup((current) => ({ ...current, keyword: text, result: null, error: null }))
  }, [])

  const closeLookup = useCallback(() => {
    setLookup((current) => ({ ...current, open: false }))
  }, [])

  const autoSyncedRef = useRef(false)
  useEffect(() => {
    if (autoSyncedRef.current) return
    autoSyncedRef.current = true
    void runSync(false)
  }, [runSync])

  const writeNow = useCallback(async (): Promise<void> => {
    if (stagedChanges(stateRef.current, baselineRef.current) === 0) return
    if (writingRef.current) {
      againRef.current = true
      return
    }
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
    const nextBaseline = baselineOfDraft(snapshot)
    baselineRef.current = nextBaseline
    writeGenRef.current += 1
    committedRef.current = false
    if (staged !== null) {
      staged = stagedChanges(staged.state, nextBaseline) > 0
        ? { ...staged, baseline: nextBaseline }
        : null
    }
    const queued = againRef.current
    againRef.current = false
    if (!aliveRef.current) {
      onDirtyChange?.(stagedChanges(stateRef.current, baselineRef.current) > 0)
      notifyChanged()
      if (queued) void writeNow()
      return
    }
    setBaseline(nextBaseline)
    setSave({ kind: 'saved', at: Date.now() })
    notifyChanged()
    if (queued) void writeNow()
  }, [notifyChanged, onDirtyChange])

  const writeRef = useRef(writeNow)
  writeRef.current = writeNow
  useEffect(() => {
    if (changes === 0) {
      committedRef.current = false
      setSave(current => (current.kind === 'pending' || current.kind === 'invalid' || current.kind === 'error'
        ? { kind: 'clean' }
        : current))
      return
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
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

  useEffect(() => {
    if (view === null) return
    staged = changes > 0 ? { view, state, baseline } : null
    if (changes === 0) lastView = view
  }, [view, state, baseline, changes])

  useEffect(() => { onDirtyChange?.(changes > 0) }, [changes, onDirtyChange])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
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

  const updateCalendar = useCallback((year: string, next: CalendarDraft | null) => {
    setState((current) => {
      const calendar: CalendarEntries = new Map(current.calendar)
      if (next === null) calendar.delete(year)
      else calendar.set(year, next)
      return withCalendar(adoptYear(current, year), calendar)
    })
  }, [])

  const runHolidaySync = useCallback(async (force: boolean, extraYears: readonly string[] = []): Promise<void> => {
    setHoliday({ running: true, result: null, error: null })
    try {
      const query = new URLSearchParams()
      if (force) query.set(QUERY_FORCE, '1')
      for (const year of extraYears) query.append(QUERY_YEAR, year)
      const suffix = query.toString() === '' ? '' : `?${query.toString()}`
      const res = await fetch(`${ROUTE_HOLIDAY_SYNC}${suffix}`, { method: 'POST' })
      const payload = await res.json().catch(() => null) as (HolidayRefreshResult & { error?: string }) | null
      if (!res.ok || payload === null) throw new Error(payload?.error ?? `HTTP ${String(res.status)}`)
      setHoliday({ running: false, result: payload, error: null })
      if (payload.changed || payload.fetched.length > 0) await loadViewRef.current?.()
    } catch (err) {
      setHoliday({ running: false, result: null, error: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  const updateFx = useCallback((text: string) => {
    setState(current => withFx(current, text))
  }, [])

  const changeCurrency = useCallback((route: string, next: 'CNY' | 'USD') => {
    setState(current => withRouteCurrency(current, route, next, fxValue(current.fx)))
  }, [])

  const autoHolidayRef = useRef(false)
  useEffect(() => {
    if (autoHolidayRef.current) return
    if (view === null) return
    autoHolidayRef.current = true
    void runHolidaySync(false, view.calendarMissing)
  }, [view, runHolidaySync])

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

  const routeChoices = useMemo(() => [...state.routes.values()], [state.routes])

  const card = routeChoices.find(item => item.route === picked?.route) ?? routeChoices[0]
  const models = card === undefined ? [] : [...card.models.values()]
  const row = models.find(item => item.model === picked?.model) ?? models[0]

  const stateText = saveStateText(save)
  const syncLine = view === null ? null : describeSync(view.sync, sync, syncFromUserRef.current)
  const syncTone = syncLine === null ? 'quiet' : syncLine.tone
  const syncGapsPrefix = syncLine === null ? '' : syncLine.prefix
  const syncActionText = syncLine === null ? '取价' : syncLine.action
  const rate = fxValue(state.fx)
  const fxProblem = fxIssue(state.fx)

  const openLookup = useCallback(() => {
    if (card === undefined || row === undefined) return
    setLookup({ open: true, keyword: row.model, loading: true, result: null, error: null })
    void doSearch(row.model)
  }, [card, row, doSearch])

  const adopt = useCallback((candidate: ModelsDevCandidate): void => {
    if (card === undefined || row === undefined) return
    if (card.currency !== 'USD') {
      setLookup((current) => ({ ...current, error: '这条通道的价按人民币记，models.dev 只有美元价。要填进来的话，先在详情头把报价币种切成美元——那会把整条通道已有的价按汇率换算一次。' }))
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
      onBlur={(event) => {
        if (event.target instanceof HTMLSelectElement) return
        if (stagedChanges(stateRef.current, baselineRef.current) === 0) return
        committedRef.current = true
        void writeRef.current()
      }}
    >
      {state.routes.size > 0 && card !== undefined && (
        <div className="dtpl-price-pick">
          <div className="dtpl-price-pick-row">
            <span className="dtpl-price-pick-k">通道</span>
            <select
              className="dtpl-price-select dtpl-price-pick-sel"
              value={card.route}
              aria-label="通道"
              onChange={(event) => {
                choosePicked({ route: event.target.value, model: '' })
              }}
            >
              {routeChoices.map(item => (
                <option key={item.route} value={item.route}>{routeOptionLabel(item)}</option>
              ))}
            </select>
          </div>
          <div className="dtpl-price-pick-row">
            <span className="dtpl-price-pick-k">模型</span>
            <select
              className="dtpl-price-select dtpl-price-pick-sel"
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
          </div>
          <div className="dtpl-price-pick-row dtpl-price-pick-fxrow">
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
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
              <span className="dtpl-price-fx-unit">元</span>
              <span className="dtpl-price-fx-note">
                {inverseHint(rate) ?? '填了才能按美元报价'}
              </span>
            </span>
            {fxProblem !== null && <span className="dtpl-price-fx-err" role="alert">{fxProblem}</span>}
          </div>
          <div
            className="dtpl-price-pick-row dtpl-price-pick-state"
            data-quiet={save.kind === 'clean' && changes === 0 ? 'true' : undefined}
          >
            <span className="dtpl-price-pick-k">状态</span>
            <span className="dtpl-price-state-row">
              <span className={`dtpl-price-state is-${save.kind}`} role="status" aria-live="polite">
                {stateText === '' ? '与磁盘一致' : stateText}
              </span>
              {save.kind === 'error' && (
                <button type="button" className="dtpl-price-ghost" onClick={() => void writeNow()}>重试</button>
              )}
            </span>
          </div>
        </div>
      )}

      {view !== null && view.calendarMissing.length > 0 && (() => {
        const missing = view.calendarMissing
        const autoFailed = view.holidaySync !== undefined
          && (view.holidaySync.state === 'failed' || view.holidaySync.state === 'missing')
        return (
          <div className="dtpl-price-calarm" role="status">
            <span className="dtpl-price-calarm-text">
              缺 {missing.join('、')} 年的法定节假日安排：「法定工作日」时段会把那几年的节假日按高峰多算。
              {autoFailed && '自动拉取没成功，可以展开年历手动填（手写永远优先）。'}
              {holiday.error !== null && <b>（自动拉取失败：{holiday.error}）</b>}
            </span>
            <button
              type="button"
              className="dtpl-price-calarm-act"
              aria-controls="price-calendar"
              disabled={holiday.running}
              title="从 holiday-cn 拉这几年的法定节假日安排（它每日抓国务院公告，按年一份 JSON）。手写过的年份不受影响。"
              onClick={() => {
                void runHolidaySync(true, missing)
                setCalendarOpen(true)
                document.getElementById('price-calendar')?.scrollIntoView({ block: 'nearest' })
              }}
            >
              {holiday.running ? '拉取中…' : `↻ 自动拉取 ${missing.length > 2 ? `${String(missing.length)} 年` : `${missing.join('、')} 年`}`}
            </button>
          </div>
        )
      })()}

      {loadError !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">价格表加载失败：{loadError}</p>
          <button type="button" className="dtpl-retry" onClick={() => void loadView()}>重试</button>
        </div>
      )}

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
      {state.routes.size > 0 && view !== null && (
        <div className="dtpl-price-actions">
          <span className="dtpl-price-actions-fill">
            <span className={`dtpl-price-actions-note${syncTone === 'quiet' ? '' : ` is-${syncTone}`}`}>
              {syncGapsPrefix}
            </span>
            <button
              type="button"
              className="dtpl-price-actions-link"
              disabled={sync.running}
              title={`从 ${view.sync.source.label}（公共美元价目录）取一次：只填账本用过、还没有价的美元通道格，你手写的价一格不动。平时每天自动一次；这里是「现在就取」。`}
              onClick={() => void runSync(true)}
            >
              {sync.running ? '正在取价…' : syncActionText}
            </button>
          </span>
          <button
            type="button"
            className="dtpl-price-tool"
            disabled={lookup.loading || card === undefined || row === undefined}
            title="按名字在 models.dev 里搜原厂价，选中一条填进当前这一行的四档（会覆盖这一行已填的数）。只在美元报价的通道上可用。"
            onClick={() => void openLookup()}
          >
            搜索价
          </button>
        </div>
      )}
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
      {view !== null && (
        <CalendarEditor
          entries={state.calendar}
          missingYears={view.calendarMissing}
          autoYears={[...state.autoYears].sort((left, right) => left.localeCompare(right))}
          sync={view.holidaySync}
          dirty={calendarDirty(state, baseline)}
          expanded={calendarOpen}
          onExpandedChange={setCalendarOpen}
          onChange={updateCalendar}
          onAutoRefresh={() => void runHolidaySync(true, view.calendarMissing)}
          syncing={holiday.running}
        />
      )}
    </section>
  )
}

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

function describeSync(
  view: PricingSyncView,
  ui: SyncUiState,
  fromUser: boolean,
): { prefix: string; action: string; tone: 'quiet' | 'warn' | 'err' } | null {
  if (ui.running) return { prefix: '', action: '正在取价…', tone: 'quiet' }
  if (ui.error !== null) return { prefix: `取价失败：${ui.error}（手写的价没动）`, action: '', tone: 'err' }
  if (ui.result !== null && fromUser) {
    if (ui.result.throttled === true) return { prefix: '刚刚已经取过了', action: '', tone: 'quiet' }
    if (ui.result.added === 0 && ui.result.skipped === 0) return { prefix: '没有要填的价', action: '', tone: 'quiet' }
    const parts: string[] = [ui.result.added > 0 ? `填上了 ${String(ui.result.added)} 个模型的价` : '没有要填的价']
    if (ui.result.skipped > 0) parts.push(`跳过 ${String(ui.result.skipped)} 个（目录里没有，或不是美元通道）`)
    return { prefix: parts.join(' · '), action: '', tone: 'quiet' }
  }
  if (view.state === 'failed') {
    return { prefix: `上次取价失败${view.lastError === null ? '' : `（${view.lastError}）`}，`, action: '重试', tone: 'err' }
  }
  if (view.gaps > 0) {
    return { prefix: `${String(view.gaps)} 个用过的模型还没价，`, action: '现在取价', tone: 'warn' }
  }
  if (view.lastAttemptAt === null) return { prefix: '价由 models.dev 每天自动取，', action: '现在取一次', tone: 'quiet' }
  if (view.state === 'stale') return { prefix: '价是上次取的，', action: '现在取价', tone: 'quiet' }
  return { prefix: '价已是最新（models.dev 每天自动取），', action: '重新取', tone: 'quiet' }
}

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="dtpl-price-lookup" role="dialog" aria-label="从 models.dev 选一份价填进这一行">
      <div className="dtpl-price-lookup-head">
        <span className="dtpl-price-lookup-k">在 models.dev 里找这个模型</span>
        <input
          className="dtpl-price-input dtpl-price-lookup-input"
          type="text"
          value={lookup.keyword}
          placeholder="模型名（如 deepseek-v4-flash）"
          aria-label="搜索关键词"
          spellCheck={false}
          autoComplete="off"
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
          这条通道的价按人民币记，而 models.dev 只有美元价。要填进来的话，先在详情头把报价币种切成美元——
          那会把整条通道已有的价按汇率换算一次，是真改价。
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
                没找到与「{lookup.keyword}」相关的模型（只收原厂挂牌价，转售商与价格分裂的条目不列）。
                换个关键词试试：模型串，或者只敲厂商名如 deepseek / qwen。
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
                        {isExact && <span className="dtpl-price-lookup-badge" title="与你搜的关键词是同一个模型">就是搜的这个</span>}
                        {isCurrent && !isExact && <span className="dtpl-price-lookup-badge" title="就是当前这一行正在编辑的模型">当前这一行</span>}
                      </div>
                      <div className="dtpl-price-lookup-name">{candidate.name}</div>
                      <div className="dtpl-price-lookup-cost">{lookupCostText(candidate.cost)}</div>
                      <button
                        type="button"
                        className="dtpl-price-ghost"
                        disabled={!isUsd}
                        title={isUsd
                          ? `把 ${candidate.provider}/${candidate.modelId} 的价填进这一行（覆盖这一行已填的四档）`
                          : '这条通道按人民币报价，models.dev 只有美元价；先在详情头把报价币种切成美元'}
                        onClick={() => onAdopt(candidate)}
                      >
                        填进这一行
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

function lookupCostText(cost: ModelsDevCandidate['cost']): string {
  const parts: string[] = [`$${String(cost.input)}`, `$${String(cost.output)}`]
  if (cost.cacheRead !== undefined) parts.push(`读 $${String(cost.cacheRead)}`)
  if (cost.cacheWrite !== undefined) parts.push(`写 $${String(cost.cacheWrite)}`)
  return `${parts.join(' / ')} / 百万词元`
}
