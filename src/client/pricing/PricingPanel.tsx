/**
 * 价格表 tab of the token-book floating window.
 *
 * ONE list, ONE axis: every row is a (通道路由, 精确模型串) pair — the only thing
 * the ledger actually bills. Which hand layer prices a row (`pricing.json`'s
 * global model rules or `provider-pricing.json`'s per-channel overlay) is a
 * property OF the row, shown as a source badge and decided in the row's editor,
 * never a separate view the user has to pick before finding the price.
 *
 * Reading order:
 *   · 工具栏 — search (model string, route key, or a 调价/峰谷 label), a 价格未知
 *     quick filter, the mirror's channel-form chips, and the 参考价表 entry;
 *   · 我的价格 — channel groups (most-used route first), one row per (route,
 *     string): source badge + the price in force + the window that decides it;
 *     expanding a row shows its timeline, 改这条价 opens the row's editor;
 *   · 参考价表 — the mirror's ~185-row catalogue, browsable only (a dictionary,
 *     deliberately not a peer of 我的价格);
 *   · 共享保存条 — ONE save for both layers (the overlay file first, then the
 *     model file), reporting exactly which layer was written.
 *
 * Edits write each WHOLE hand file for the layer they touched, so row edits are
 * staged locally and one 保存 applies everything; the host answers a fresh view
 * which replaces the list in place, and the overview re-prices on the next read.
 *
 * @module dsh-tokbook/client/pricing/PricingPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ChannelForm, PricingNow, PricingView, PricingViewRow } from '../../types.ts'
import {
  FORM_LABELS, FORM_ORDER, UNBILLED_GROUP, aliasSignature, baselineOf, buildPriceRows, composeModelTable,
  composeProviderMeta, composeProviderTable, composeRates, cssId, draftNow, draftOf, draftToRates, fmtRate,
  formCounts, groupByFamily, groupRows, metaDeclared, metaSignature, nextId, providerKeyOf, providerDraftOf,
  ratesToDraft, referenceRows, routeMetaOf, ruleLabelsOf, rowStatusOf, segmentIndexNow, segmentNow, signatureOf,
  stagedChangeCount, stagedDirty, validateManualDraft,
  type DraftRates, type ManualDraft, type PriceGroup, type PriceRow, type ProviderDraft, type RouteMetaDraft, type RowStatus,
} from './draft.ts'
import { AddModelForm, AddOverrideForm, AliasSection, PriceEditor, RateCell, RouteMetaEditor, RuleTimeline, StagedTag } from './editors.tsx'

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

/**
 * Dirty staged edits survive a panel unmount (switching tabs, or closing the
 * floating window) so an unsaved draft is never silently dropped: the panel
 * rehydrates it on the next mount and the save button stays dirty until the
 * user saves or discards. Only a DIRTY state is cached — a clean one is dropped
 * so the next mount fetches a fresh view.
 */
interface StagedPricing {
  view: PricingView
  modelDrafts: ReadonlyMap<string, ManualDraft>
  modelBaseline: ReadonlyMap<string, string>
  overlayDrafts: ReadonlyMap<string, ProviderDraft>
  overlayBaseline: ReadonlyMap<string, string>
  aliases: ReadonlyMap<string, string>
  aliasBaseline: string
  metaDrafts: ReadonlyMap<string, RouteMetaDraft>
  metaBaseline: string
}
let stagedPricing: StagedPricing | null = null

/** PUT one hand file and hand back the fresh view the host answered with. */
async function putJson(path: string, body: unknown): Promise<{ ok: true; view: PricingView | null } | { ok: false; error: string }> {
  try {
    const res = await fetch(path, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await res.json().catch(() => null) as { ok?: boolean; error?: string; view?: PricingView } | null
    if (!res.ok || payload === null || payload.ok !== true) {
      const message = payload?.error !== undefined && payload.error !== '' ? payload.error : `HTTP ${String(res.status)}`
      return { ok: false, error: message }
    }
    return { ok: true, view: payload.view ?? null }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function PricingPanel({ onChanged, onDirtyChange, focus, onFocusHandled }: PricingPanelProps) {
  const [view, setView] = useState<PricingView | null>(() => stagedPricing?.view ?? null)
  const [modelDrafts, setModelDrafts] = useState<ReadonlyMap<string, ManualDraft>>(() => stagedPricing?.modelDrafts ?? new Map())
  const [modelBaseline, setModelBaseline] = useState<ReadonlyMap<string, string>>(() => stagedPricing?.modelBaseline ?? new Map())
  const [overlayDrafts, setOverlayDrafts] = useState<ReadonlyMap<string, ProviderDraft>>(() => stagedPricing?.overlayDrafts ?? new Map())
  const [overlayBaseline, setOverlayBaseline] = useState<ReadonlyMap<string, string>>(() => stagedPricing?.overlayBaseline ?? new Map())
  const [aliases, setAliases] = useState<ReadonlyMap<string, string>>(() => stagedPricing?.aliases ?? new Map())
  const [aliasBaseline, setAliasBaseline] = useState<string>(() => stagedPricing?.aliasBaseline ?? aliasSignature(new Map()))
  const [metaDrafts, setMetaDrafts] = useState<ReadonlyMap<string, RouteMetaDraft>>(() => stagedPricing?.metaDrafts ?? new Map())
  const [metaBaseline, setMetaBaseline] = useState<string>(() => stagedPricing?.metaBaseline ?? metaSignature(new Map()))
  const [metaRoute, setMetaRoute] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [query, setQuery] = useState('')
  const [formFilter, setFormFilter] = useState<ChannelForm | null>(null)
  const [unknownOnly, setUnknownOnly] = useState(false)
  const [refOpen, setRefOpen] = useState(false)
  const [openFamilies, setOpenFamilies] = useState<ReadonlySet<string>>(() => new Set())
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const activeRef = useRef(0)
  const errorRef = useRef<HTMLDivElement>(null)

  /** Rebuild every staged layer from a wire view (the seed of a fresh read). */
  const seed = useCallback((next: PricingView) => {
    setView(next)
    const models = new Map<string, ManualDraft>()
    for (const row of next.rows) if (row.manual) models.set(row.model, draftOf(row.manualRules))
    setModelDrafts(models)
    setModelBaseline(baselineOf(models))
    const overlay = new Map<string, ProviderDraft>()
    for (const row of next.providerRows ?? []) {
      if (row.manual) overlay.set(providerKeyOf(row.provider, row.model), providerDraftOf(row))
    }
    setOverlayDrafts(overlay)
    setOverlayBaseline(baselineOf(overlay))
    const aliasMap = new Map(Object.entries(next.providerRoutes ?? {}))
    setAliases(aliasMap)
    setAliasBaseline(aliasSignature(aliasMap))
    const metaMap = routeMetaOf(next.providerMeta)
    setMetaDrafts(metaMap)
    setMetaBaseline(metaSignature(metaMap))
  }, [])

  const load = useCallback(async () => {
    const token = ++activeRef.current
    setError(null)
    try {
      const res = await fetch('/tokbook/pricing')
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`)
      const next = await res.json() as PricingView
      if (token !== activeRef.current) return
      seed(next)
      setOpenKey(null)
      setEditingKey(null)
      setMetaRoute(null)
    } catch (err) {
      if (token !== activeRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [seed])

  useEffect(() => {
    // A rehydrated dirty draft is authoritative until the user saves/discards.
    if (stagedPricing !== null) return
    void load()
    return () => { activeRef.current += 1 }
  }, [load])

  // A refused save must not look like a no-op: bring the reason into view.
  useEffect(() => {
    if (error !== null) errorRef.current?.scrollIntoView({ block: 'center' })
  }, [error])

  // After a row is reached (去编辑 / 改全局价 / 新增), follow it and flash once.
  useEffect(() => {
    if (flashKey === null) return
    const target = [...document.querySelectorAll<HTMLElement>('[data-row-key]')]
      .find(element => element.dataset.rowKey === flashKey)
    target?.scrollIntoView({ block: 'center' })
    const timer = window.setTimeout(() => setFlashKey(null), 1500)
    return () => { window.clearTimeout(timer) }
  }, [flashKey])

  const modelDirty = stagedDirty(modelDrafts, modelBaseline)
  const overlayChanged = stagedDirty(overlayDrafts, overlayBaseline)
  const aliasDirty = aliasSignature(aliases) !== aliasBaseline
  const metaDirty = metaSignature(metaDrafts) !== metaBaseline
  // Both layers' hand files: the alias map and the channel names/forms all live
  // in `provider-pricing.json`, so ONE dirty flag guards its write.
  const overlayFileDirty = overlayChanged || aliasDirty || metaDirty
  const dirty = modelDirty || overlayFileDirty

  // Cache only dirty state; a clean view is re-fetched on the next mount.
  useEffect(() => {
    stagedPricing = dirty && view !== null
      ? { view, modelDrafts, modelBaseline, overlayDrafts, overlayBaseline, aliases, aliasBaseline, metaDrafts, metaBaseline }
      : null
    onDirtyChange?.(dirty)
  }, [dirty, view, modelDrafts, modelBaseline, overlayDrafts, overlayBaseline, aliases, aliasBaseline, metaDrafts, metaBaseline, onDirtyChange])

  // A cross-tab jump (价格未知 note) narrows this surface once, then clears.
  useEffect(() => {
    if (focus === null || focus === undefined) return
    setUnknownOnly(true)
    setRefOpen(false)
    onFocusHandled?.()
  }, [focus, onFocusHandled])

  const nowSec = Math.floor(Date.now() / 1000)
  const labels = view?.providerLabels ?? {}
  const forms = view?.providerForms ?? {}
  const knownNames = useMemo(
    () => [...new Set([...(view?.providerNames ?? []), ...(view?.channelRows ?? []).map(row => row.provider)])]
      .filter(name => name !== '')
      .sort((a, b) => a.localeCompare(b)),
    [view],
  )
  const allModelNames = useMemo(() => (view?.rows ?? []).map(row => row.model), [view])

  const rows = useMemo(
    () => (view === null ? [] : buildPriceRows(view, modelDrafts, overlayDrafts)),
    [view, modelDrafts, overlayDrafts],
  )
  const modelRows = useMemo(
    () => new Map<string, PricingViewRow>((view?.rows ?? []).map(row => [row.model, row])),
    [view],
  )

  const q = query.trim().toLowerCase()
  const matches = useCallback((row: PriceRow): boolean => {
    if (q === '') return true
    if (row.model.toLowerCase().includes(q)) return true
    if (row.provider !== '' && row.provider.toLowerCase().includes(q)) return true
    return ruleLabelsOf(modelRows.get(row.model), modelDrafts.get(row.model)).some(label => label.toLowerCase().includes(q))
  }, [q, modelRows, modelDrafts])

  const searched = useMemo(() => rows.filter(matches), [rows, matches])
  const filtered = useMemo(() => (unknownOnly ? searched.filter(row => row.unpriced) : searched), [searched, unknownOnly])
  const groups = useMemo(() => groupRows(filtered, labels, forms, formFilter), [filtered, labels, forms, formFilter])
  const counts = useMemo(() => formCounts(groupRows(searched, labels, forms, null)), [searched, labels, forms])
  const unknownCount = searched.filter(row => row.unpriced).length
  const hasFilter = q !== '' || formFilter !== null || unknownOnly
  const shownRows = groups.reduce((sum, group) => sum + group.rows.length, 0)

  const refRows = useMemo(() => (view === null ? [] : referenceRows(view)), [view])
  const refFiltered = useMemo(() => {
    if (q === '') return refRows
    return refRows.filter(row => row.model.toLowerCase().includes(q) || (row.family ?? '').toLowerCase().includes(q))
  }, [refRows, q])
  const refGroups = useMemo(() => groupByFamily(refFiltered), [refFiltered])

  // ── staged-edit helpers ────────────────────────────────────────────────────

  const patchManual = useCallback((model: string, patch: (draft: ManualDraft) => ManualDraft) => {
    setModelDrafts(current => {
      const draft = current.get(model)
      if (draft === undefined) return current
      const next = new Map(current)
      next.set(model, patch(draft))
      return next
    })
  }, [])

  const patchOverlay = useCallback((key: string, patch: Partial<ProviderDraft>) => {
    setOverlayDrafts(current => {
      const draft = current.get(key)
      if (draft === undefined) return current
      const next = new Map(current)
      next.set(key, { ...draft, ...patch })
      return next
    })
  }, [])

  /** The staged display facts of one route (a fresh, empty slate when the route
   *  has no hand declaration). */
  const metaOf = useCallback((route: string): RouteMetaDraft => metaDrafts.get(route) ?? { label: '', form: '' }, [metaDrafts])

  /** Whether the user declared something for this route (staged or loaded). */
  const metaStaged = useCallback((route: string): boolean => metaDeclared(metaDrafts.get(route)), [metaDrafts])

  /** Whether the mirror feed leaves this route unnamed or formless — the gap the
   *  hand layer exists to fill. A route the mirror fully names gets no
   *  affordance (renaming it is not what this escape hatch is for). */
  const metaOffered = useCallback(
    (route: string): boolean => route !== '' && (metaStaged(route) || labels[route] === undefined || forms[route] === undefined),
    [metaStaged, labels, forms],
  )

  const patchMeta = useCallback((route: string, patch: RouteMetaDraft) => {
    setMetaDrafts(current => {
      const next = new Map(current)
      next.set(route, patch)
      return next
    })
  }, [])

  /** Rates in force for a row — the seed of a first self-priced window. */
  const seedRates = useCallback((row: PriceRow): DraftRates => ratesToDraft(row.now?.rates), [])

  /** Put a hand entry on the MODEL layer (global), seeded from whatever prices
   *  the string today so the editor starts from a real slate. */
  const startManual = useCallback((row: PriceRow) => {
    if (modelDrafts.has(row.model)) return
    const source = row.modelRow?.manualRules ?? row.modelRow?.cloudRules
    setModelDrafts(current => {
      const next = new Map(current)
      next.set(row.model, draftOf(source))
      return next
    })
  }, [modelDrafts])

  /** Put a hand entry on the OVERLAY layer for this exact channel. A relay
   *  placeholder starts as a self-priced window (that is what it is waiting
   *  for); anything else starts by following the same official price. */
  const startOverride = useCallback((row: PriceRow) => {
    if (overlayDrafts.has(row.key)) return
    const draft = row.overlayRow !== undefined
      ? providerDraftOf(row.overlayRow)
      : {
        key: row.key, provider: row.provider, model: row.model, billing: row.billing,
        source: 'inherit' as const, inheritBase: row.model, segments: [], note: '', placeholder: false,
      }
    if (row.overlayRow?.placeholder === true || row.overlayRow === undefined) {
      draft.source = 'segments'
      draft.placeholder = false
      draft.segments = [{ id: nextId(), from: '', to: '', rates: seedRates(row), note: '' }]
    }
    setOverlayDrafts(current => {
      const next = new Map(current)
      next.set(row.key, draft)
      return next
    })
  }, [overlayDrafts, seedRates])

  /** The editor's layer choice: moving to the overlay stages an entry, moving
   *  back removes it (the price falls back to the model layer / cloud). */
  const setLayer = useCallback((row: PriceRow, layer: 'model' | 'overlay') => {
    if (layer === 'overlay') startOverride(row)
    else {
      setOverlayDrafts(current => {
        if (!current.has(row.key)) return current
        const next = new Map(current)
        next.delete(row.key)
        return next
      })
    }
  }, [startOverride])

  const editRow = useCallback((row: PriceRow) => {
    if (row.layer === 'overlay') startOverride(row)
    else if (!modelDrafts.has(row.model)) startManual(row)
    setOpenKey(row.key)
    setEditingKey(row.key)
  }, [modelDrafts, startManual, startOverride])

  const jumpTo = useCallback((key: string) => {
    setOpenKey(key)
    setEditingKey(key)
    setFlashKey(key)
  }, [])

  /** Focus a row the user just CREATED. An active filter would hide it (a brand
   *  new string matches no search, and it is unpriced by definition), so the
   *  filters are cleared: the user asked for this row, so it must be visible. */
  const revealNew = useCallback((key: string) => {
    setQuery('')
    setFormFilter(null)
    setUnknownOnly(false)
    setRefOpen(false)
    setOpenKey(key)
    setEditingKey(key)
    setFlashKey(key)
  }, [])

  /** The staged state of one row, so an unsaved change is visible in its head. */
  const statusOf = (row: PriceRow): RowStatus => row.layer === 'overlay'
    ? draftRowStatus(overlayBaseline, row.key, overlayDrafts.get(row.key))
    : draftRowStatus(modelBaseline, row.model, modelDrafts.get(row.model))

  /** The price a row shows NOW: a staged draft wins over the wire value, so the
   *  editor's live feedback matches what the save would produce. `rates` is the
   *  slate the row's four cells bind to — null when they are read-only. */
  const liveOf = (row: PriceRow): { now: PricingNow | null | undefined; rates: DraftRates | null } => {
    if (row.layer === 'overlay') {
      const draft = overlayDrafts.get(row.key)
      if (draft !== undefined && draft.source === 'segments') {
        const index = segmentIndexNow(draft.segments, nowSec)
        return { now: segmentNow(draft.segments, nowSec), rates: index >= 0 ? draft.segments[index]!.rates : null }
      }
      return { now: row.now, rates: null }
    }
    const draft = modelDrafts.get(row.model)
    if (draft !== undefined) return { now: draftNow(draft), rates: draft.base }
    return { now: row.now, rates: null }
  }

  // ── save / discard ─────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (view === null) return
    // Client-side validation first: the whole save is refused on the first bad
    // value so the user fixes the visible row (the host re-runs it regardless).
    for (const [model, draft] of modelDrafts) {
      const problem = validateManualDraft(model, draft)
      if (problem !== null) {
        setError(problem)
        const target = rows.find(row => row.model === model && row.layer === 'model' && !row.locked) ?? rows.find(row => row.model === model)
        if (target !== undefined) { setOpenKey(target.key); setEditingKey(target.key); setFlashKey(target.key) }
        return
      }
    }
    const composed = composeProviderTable(overlayDrafts)
    if (!composed.ok) {
      setError(composed.error)
      return
    }
    setSaving(true)
    setError(null)
    let fresh: PricingView | null = null
    // 1) the overlay file first: the writing order must never leave a
    //    (route, string) momentarily unpriced while its entry is on the way in.
    //    Channel names/forms and the alias map ride in this same file.
    if (overlayFileDirty) {
      const body: Record<string, unknown> = { ...composed.table }
      const meta = composeProviderMeta(metaDrafts)
      if (aliases.size > 0) body.$routes = Object.fromEntries(aliases)
      if (Object.keys(meta).length > 0) body.$providers = meta
      const result = await putJson('/tokbook/provider-pricing', body)
      if (!result.ok) {
        setSaving(false)
        setError(`通道覆盖层未保存：${result.error}`)
        return
      }
      fresh = result.view ?? fresh
      // The written layer is clean now — even if the model file fails next.
      setOverlayBaseline(baselineOf(overlayDrafts))
      setAliasBaseline(aliasSignature(aliases))
      setMetaBaseline(metaSignature(metaDrafts))
    }
    if (modelDirty) {
      const result = await putJson('/tokbook/pricing', composeModelTable(modelDrafts))
      if (!result.ok) {
        setSaving(false)
        // Report what actually landed. The view is refreshed but the staged
        // model drafts are KEPT: they are the user's unsaved work.
        if (fresh !== null) setView(fresh)
        setError(`通道覆盖层已保存；模型层未保存：${result.error}`)
        return
      }
      fresh = result.view ?? fresh
      setModelBaseline(baselineOf(modelDrafts))
    }
    setSaving(false)
    if (fresh !== null) {
      seed(fresh)
      setEditingKey(null)
    }
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1600)
    onChanged()
  }, [view, modelDrafts, overlayDrafts, aliases, metaDrafts, modelDirty, overlayFileDirty, rows, seed, onChanged])

  // Ctrl/Cmd+S saves while this tab is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      if (!saving && dirty) void save()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [saving, dirty, save])

  const changedModels = stagedChangeCount(modelDrafts, modelBaseline)
  const changedOverlay = stagedChangeCount(overlayDrafts, overlayBaseline) + (aliasDirty ? 1 : 0) + (metaDirty ? 1 : 0)
  const saveScope = [
    modelDirty ? `模型层 ${String(changedModels)} 条` : null,
    overlayFileDirty ? `覆盖层 ${String(changedOverlay)} 条` : null,
  ].filter((part): part is string => part !== null).join(' · ')

  // ── one row ────────────────────────────────────────────────────────────────

  const renderRow = (row: PriceRow, unbilledGroup: boolean) => {
    const open = openKey === row.key
    const editing = editingKey === row.key
    const staged = statusOf(row)
    const live = liveOf(row)
    const liveRates = live.now?.rates
    const editable = editing && !row.locked && live.rates !== null
    const slate = editable ? live.rates : null
    const cellValue = (field: keyof DraftRates): string => {
      if (slate !== null) return slate[field]
      if (liveRates === undefined) return ''
      return fmtRate(field === 'input' ? liveRates.inputPerMillion
        : field === 'output' ? liveRates.outputPerMillion
          : field === 'cacheRead' ? liveRates.cacheReadPerMillion
            : liveRates.cacheWritePerMillion)
    }
    const onCell = (field: keyof DraftRates, value: string): void => {
      if (!editable) return
      if (row.layer === 'overlay') {
        const draft = overlayDrafts.get(row.key)
        if (draft === undefined || draft.source !== 'segments') return
        const index = segmentIndexNow(draft.segments, nowSec)
        if (index < 0) return
        const rates = { ...draft.segments[index]!.rates, [field]: value }
        patchOverlay(row.key, { segments: draft.segments.map((segment, i) => i === index ? { ...segment, rates } : segment) })
        return
      }
      patchManual(row.model, draft => ({ ...draft, base: { ...draft.base, [field]: value } }))
    }

    // The in-force price needs its own line whenever it is NOT what the cells
    // show: a hand row's cells are its base slate and a window may win; a
    // read-only row's cells already carry the price, so it only names the
    // window that decided it.
    let nowLine: ReactNode = null
    if (!row.unpriced && liveRates !== undefined) {
      const label = live.now?.label !== undefined ? ` · ${live.now.label}` : ''
      const peak = live.now?.peak === true ? ' · 峰时' : ''
      const amount = <b>入 ¥{fmtRate(liveRates.inputPerMillion)} · 出 ¥{fmtRate(liveRates.outputPerMillion)}</b>
      const slate = live.rates !== null ? composeRates(live.rates) : null
      const windowWins = slate !== null
        && (slate.inputPerMillion !== liveRates.inputPerMillion || slate.outputPerMillion !== liveRates.outputPerMillion)
      const named = live.now?.peak === true || live.now?.label !== undefined
      if (windowWins || (editing && row.layer === 'model')) {
        nowLine = <span className="dtpl-pricing-now">当前生效 {amount}{label}{peak}</span>
      } else if (named) {
        nowLine = <span className="dtpl-pricing-now">当前生效 · {live.now?.label ?? '峰谷时段'}{peak}</span>
      }
    }

    const action = row.locked && row.via !== undefined
      ? <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" title={`这条路由跟随「${row.via}」，点这里去那条覆盖编辑`} onClick={() => jumpTo(providerKeyOf(row.via ?? '', row.model))}>去编辑</button>
      : row.locked && row.canonical !== undefined
        ? <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" title={`模型层价是全局的：这条串由 ${row.canonical} 下的那一行编辑，改动对所有通道生效`} onClick={() => jumpTo(providerKeyOf(row.canonical ?? '', row.model))}>改全局价</button>
        : editing
          ? <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={() => setEditingKey(null)}>完成</button>
          : <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" title={row.layer === 'overlay' ? '编辑这条通道的覆盖价' : '编辑这条模型串的全局价'} onClick={() => editRow(row)}>
            {row.layer === 'overlay' ? (overlayDrafts.has(row.key) ? '编辑覆盖' : '设为覆盖') : modelDrafts.has(row.model) ? '编辑' : row.unpriced ? '去定价' : '改这条价'}
          </button>

    const handDraft = row.layer === 'model' ? modelDrafts.get(row.model) : undefined
    const timelineRules = row.layer === 'overlay'
      ? row.overlayRow?.rules
      : handDraft !== undefined ? draftToRates(handDraft) : row.modelRow?.manualRules ?? row.modelRow?.cloudRules
    const emptyHint = row.unpriced
      ? '这个模型串没有任何价格条目，当前按 ¥0 计价 —— 价格未知，不是免费。'
      : row.locked && row.via !== undefined ? `这条路由跟随「${row.via}」，价格由那条覆盖决定。`
        : handDraft !== undefined && handDraft.rules.length === 0 && handDraft.slots.length === 0
          ? '这条手工价只有一个价，没有限时降价或高峰时段。'
          : undefined

    return (
      <div
        className={`dtpl-pricing-item${flashKey === row.key ? ' dtpl-pricing-item-flash' : ''}${row.locked ? ' dtpl-pricing-item-shared' : ''}`}
        key={row.key}
        data-row-key={row.key}
        data-pricing-model={row.model}
        data-pricing-provider={row.provider}
      >
        <div className={`dtpl-pricing-row${row.tone === 'hand' ? ' dtpl-pricing-row-manual' : ''}${row.unpriced ? ' dtpl-pricing-row-unpriced' : ''}${row.layered ? ' dtpl-pricing-row-layered' : ''}`}>
          <div className="dtpl-pricing-model">
            <span className="dtpl-pricing-model-head">
              {unbilledGroup && row.provider !== '' && (
                metaOffered(row.provider)
                  ? (
                    <button
                      type="button"
                      className="dtpl-pricing-chan-route dtpl-pricing-chan-route-btn"
                      aria-expanded={metaRoute === row.provider}
                      title="给这条通道路由起个名字、声明它的形态（只影响分组/排序/筛选）"
                      onClick={() => setMetaRoute(current => current === row.provider ? null : row.provider)}
                    >
                      {labels[row.provider] ?? row.provider}
                      <span aria-hidden="true"> ＋</span>
                    </button>
                  )
                  : <span className="dtpl-pricing-chan-route" title="通道路由键">{labels[row.provider] ?? row.provider}</span>
              )}
              <button
                type="button"
                className="dtpl-pricing-expand"
                aria-expanded={open}
                title={open ? '收起价格时间轴' : '展开价格时间轴'}
                onClick={() => {
                  if (open) { setOpenKey(null); setEditingKey(null) } else { setOpenKey(row.key); setEditingKey(null) }
                }}
              >
                {open ? '▾' : '▸'}
              </button>
              <span className="dtpl-pricing-model-name" title={row.model}>{row.model}</span>
              <span className={`dtpl-pricing-model-tag dtpl-pricing-model-tag-${row.tone}`}>{row.tag}</span>
              <StagedTag staged={staged} />
              {row.records > 0 && <span className="dtpl-pricing-used" title={`账本记过 ${String(row.records)} 条`}>{row.records} 条</span>}
              {row.locked && row.canonical !== undefined && (
                <span className="dtpl-pricing-global-chip" title={`模型层价是全局的：这条串由 ${row.canonical} 下的那一行编辑，改动对所有通道生效`}>全局价</span>
              )}
              {!row.locked && row.layer === 'model' && row.sharedRoutes.length > 0 && (
                <span className="dtpl-pricing-global-chip" title={`这条模型串另有 ${row.sharedRoutes.join('、')} 也按它计费；模型层价改动对所有通道生效`}>全局价 · 另 {row.sharedRoutes.length} 条</span>
              )}
            </span>
            {nowLine}
            {row.detail !== '' && <span className="dtpl-pricing-provider-summary">{row.detail}</span>}
          </div>
          <div className="dtpl-pricing-rates">
            {(['input', 'cacheRead', 'cacheWrite', 'output'] as const).map(field => (
              <RateCell
                key={field}
                field={field}
                editing={slate !== null}
                value={cellValue(field)}
                onChange={value => onCell(field, value)}
              />
            ))}
          </div>
          <div className="dtpl-pricing-actions">{action}</div>
        </div>

        {open && (
          <div className="dtpl-pricing-detail">
            {editing ? (
              <PriceEditor
                key={row.key}
                provider={row.provider}
                overlay={row.layer === 'overlay' ? overlayDrafts.get(row.key) : undefined}
                manual={modelDrafts.get(row.model)}
                unpriced={row.unpriced}
                rules={row.overlayRow?.rules}
                modelNames={allModelNames}
                seedRates={seedRates(row)}
                nowSec={nowSec}
                onManualPatch={patch => patchManual(row.model, patch)}
                onOverlayPatch={patch => patchOverlay(row.key, patch)}
                onSetLayer={target => setLayer(row, target)}
                onStartManual={() => startManual(row)}
                onDeleteManual={() => {
                  setModelDrafts(current => {
                    if (!current.has(row.model)) return current
                    const next = new Map(current)
                    next.delete(row.model)
                    return next
                  })
                  setEditingKey(null)
                }}
                onDeleteOverride={() => {
                  setOverlayDrafts(current => {
                    if (!current.has(row.key)) return current
                    const next = new Map(current)
                    next.delete(row.key)
                    return next
                  })
                  setEditingKey(null)
                }}
              />
            ) : (
              <RuleTimeline rules={timelineRules} now={live.now} nowSec={nowSec} emptyHint={emptyHint} />
            )}
          </div>
        )}

        {/* 未计费 rows have no channel group head, so this is the only place to
            name a route that has prices but no ledger history yet. */}
        {unbilledGroup && metaRoute === row.provider && row.provider !== '' && (
          <div className="dtpl-pricing-detail">
            <RouteMetaEditor route={row.provider} meta={metaOf(row.provider)} onPatch={patch => patchMeta(row.provider, patch)} />
          </div>
        )}
      </div>
    )
  }

  const billingOfGroup = (group: PriceGroup): { tone: string; label: string } => {
    const priced = group.rows.filter(row => !row.unpriced)
    if (priced.length === 0) return { tone: 'unpriced', label: '价格未知' }
    const subscriptions = priced.filter(row => row.billing === 'subscription').length
    if (subscriptions === priced.length) return { tone: 'subscription', label: '订阅价值' }
    if (subscriptions === 0) return { tone: 'metered', label: '实际支出' }
    return { tone: 'mixed', label: '混合' }
  }

  return (
    <section className="dtpl-pricing-sec" aria-label="价格表">
      <div className="dtpl-pricing-bar">
        {!refOpen && (
          <div className="dtpl-pricing-scopes" role="group" aria-label="筛选">
            <button
              type="button"
              className="dtpl-pricing-scope"
              aria-pressed={unknownOnly}
              disabled={unknownCount === 0}
              title="账本记过这些串，但两层都不知道它们的价——暂按 ¥0 计，不是免费"
              onClick={() => setUnknownOnly(value => !value)}
            >
              价格未知<span className="dtpl-pricing-scope-count">{unknownCount}</span>
            </button>
            {FORM_ORDER.filter(form => counts.has(form)).map(form => (
              <button
                key={form}
                type="button"
                className={`dtpl-pricing-formfilter dtpl-pricing-formfilter-${form}`}
                aria-pressed={formFilter === form}
                onClick={() => setFormFilter(current => current === form ? null : form)}
              >
                {FORM_LABELS[form]}<span className="dtpl-pricing-formfilter-count">{counts.get(form)}</span>
              </button>
            ))}
            {hasFilter && (
              <button type="button" className="dtpl-pricing-scope-reset" onClick={() => { setQuery(''); setFormFilter(null); setUnknownOnly(false) }}>
                清除筛选
              </button>
            )}
          </div>
        )}
        <div className="dtpl-pricing-filter" role="search">
          <input
            className="dtpl-pricing-search"
            type="search"
            placeholder={refOpen ? '搜索模型 / 厂商…' : '搜索模型、通道或调价标签…'}
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label="搜索价格表"
          />
        </div>
        <button
          type="button"
          className="dtpl-pricing-refbtn"
          aria-pressed={refOpen}
          onClick={() => setRefOpen(open => !open)}
          title="云端基准价表：只读字典，账本没按它计费的行都在这里"
        >
          {refOpen ? '← 我的价格' : `参考价表 ${String(refRows.length)}`}
        </button>
      </div>

      {error !== null && (
        <div className="dtpl-error" role="alert" ref={errorRef}>
          <p className="dtpl-error-text">{error}</p>
          <button type="button" className="dtpl-retry" onClick={() => setError(null)}>忽略</button>
        </div>
      )}

      <p className="dtpl-pricing-intro">
        {refOpen
          ? <>云端<b>参考价表</b>：镜像 feed 的完整字典，只读；「设为手工价」把它复制成本机的一条全局价。</>
          : <>一行 = 一条<b>通道</b> + 一个精确<b>模型串</b>，四档是<b>现在生效</b>的价。展开看这段价的时间轴，
            点「改这条价」就在这一行里决定它写在<b>模型层（全局）</b>还是<b>这条通道（覆盖层）</b>；保存后全部历史按新价重算。</>}
      </p>

      {view === null ? (
        <div className="dtpl-pricing-skeleton dtpl-sk" />
      ) : refOpen ? (
        <>
          <div className="dtpl-pricing-col-header" aria-hidden="true">
            <span>模型 · 当前生效价</span>
            <span className="dtpl-pricing-rates"><span>输入</span><span>缓存读</span><span>缓存写</span><span>输出</span></span>
            <span className="dtpl-pricing-col-actions">操作</span>
          </div>
          <div className="dtpl-pricing-list">
            {refFiltered.length === 0 && (
              <p className="dtpl-pricing-empty">
                {q !== '' ? `参考价表里没有匹配「${query}」的模型。` : '参考价表为空（云端镜像可能尚未同步成功）。'}
              </p>
            )}
            {refGroups.map(([family, list]) => {
              const key = family === '' ? '__other__' : family
              // A search expands every group that still has matches.
              const open = q !== '' || openFamilies.has(key)
              return (
                <section className="dtpl-pricing-family-group" key={key} data-family={key}>
                  <button
                    type="button"
                    className="dtpl-pricing-family-head"
                    aria-expanded={open}
                    aria-controls={`dtpl-fam-${cssId(key)}`}
                    onClick={() => setOpenFamilies(current => {
                      const next = new Set(current)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      return next
                    })}
                  >
                    <span className="dtpl-pricing-family-head-name">{family === '' ? '未标注厂商' : family}</span>
                    <span className="dtpl-pricing-family-head-meta">{list.length} 个模型</span>
                    <span className="dtpl-pricing-family-head-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                  </button>
                  {open && (
                    <div className="dtpl-pricing-family-rows" id={`dtpl-fam-${cssId(key)}`}>
                      {list.map(row => (
                        <div className="dtpl-pricing-item" key={row.model}>
                          <div className="dtpl-pricing-row">
                            <div className="dtpl-pricing-model">
                              <span className="dtpl-pricing-model-head">
                                <span className="dtpl-pricing-model-name" title={row.model}>{row.model}</span>
                                <span className="dtpl-pricing-model-tag dtpl-pricing-model-tag-cloud">{row.layered === true ? '云端 · 分时' : '云端'}</span>
                              </span>
                              <span className="dtpl-pricing-provider-summary">参考价 · 账本还没按它计费</span>
                            </div>
                            <div className="dtpl-pricing-rates">
                              {(['input', 'cacheRead', 'cacheWrite', 'output'] as const).map(field => (
                                <RateCell
                                  key={field}
                                  field={field}
                                  editing={false}
                                  value={fmtRate(field === 'input' ? row.now?.rates.inputPerMillion ?? row.cloudRates?.inputPerMillion
                                    : field === 'output' ? row.now?.rates.outputPerMillion ?? row.cloudRates?.outputPerMillion
                                      : field === 'cacheRead' ? row.now?.rates.cacheReadPerMillion ?? row.cloudRates?.cacheReadPerMillion
                                        : row.now?.rates.cacheWritePerMillion ?? row.cloudRates?.cacheWritePerMillion)}
                                  onChange={() => {}}
                                />
                              ))}
                            </div>
                            <div className="dtpl-pricing-actions">
                              <button
                                type="button"
                                className="dtpl-pricing-btn dtpl-pricing-custom"
                                title="以这套云端规则为底稿新增本机手工价"
                                onClick={() => {
                                  setModelDrafts(current => {
                                    const next = new Map(current)
                                    next.set(row.model, draftOf(row.manualRules ?? row.cloudRules))
                                    return next
                                  })
                                  revealNew(providerKeyOf('', row.model))
                                }}
                              >
                                设为手工价
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="dtpl-pricing-col-header" aria-hidden="true">
            <span>模型 · 当前生效价</span>
            <span className="dtpl-pricing-rates"><span>输入</span><span>缓存读</span><span>缓存写</span><span>输出</span></span>
            <span className="dtpl-pricing-col-actions">操作</span>
          </div>

          <div className="dtpl-pricing-list">
            {rows.length === 0 && (
              <p className="dtpl-pricing-empty">
                账本还没有记过模型用量，也没有手工价。
                {refRows.length > 0 && <button type="button" className="dtpl-pricing-empty-link" onClick={() => setRefOpen(true)}>浏览参考价表</button>}
              </p>
            )}
            {rows.length > 0 && shownRows === 0 && (
              <p className="dtpl-pricing-empty">
                {unknownOnly && unknownCount === 0 ? '没有价格未知的行。' : q !== '' ? `没有匹配「${query}」的行。` : '这个筛选下没有行。'}
                {hasFilter && <button type="button" className="dtpl-pricing-empty-link" onClick={() => { setQuery(''); setFormFilter(null); setUnknownOnly(false) }}>清除筛选</button>}
              </p>
            )}

            <div className="dtpl-pricing-chan-groups">
              {groups.map(group => {
                const billing = billingOfGroup(group)
                const isUnbilled = group.provider === UNBILLED_GROUP
                return (
                  <section className="dtpl-pricing-chan-group" key={group.provider} data-provider={group.provider}>
                    <div className="dtpl-pricing-chan-head">
                      <span className="dtpl-pricing-chan-name">{group.label}</span>
                      {!isUnbilled && labels[group.provider] !== undefined && group.provider !== '' && (
                        <span className="dtpl-pricing-chan-route" title="通道路由键">{group.provider}</span>
                      )}
                      {group.form !== undefined && (
                        <span className={`dtpl-pricing-provider-form dtpl-pricing-provider-form-${group.form}`}>{FORM_LABELS[group.form]}</span>
                      )}
                      <span className={`dtpl-pricing-chan-billing dtpl-pricing-chan-billing-${billing.tone}`}>{billing.label}</span>
                      {!isUnbilled && metaOffered(group.provider) && (
                        <button
                          type="button"
                          className="dtpl-pricing-btn dtpl-pricing-custom"
                          aria-expanded={metaRoute === group.provider}
                          title="给这条通道路由起个名字、声明它的形态（只影响分组/排序/筛选，不参与计价）"
                          onClick={() => setMetaRoute(current => current === group.provider ? null : group.provider)}
                        >
                          {metaStaged(group.provider) ? '名称/形态' : '＋ 名称/形态'}
                        </button>
                      )}
                      <span className="dtpl-pricing-chan-meta">
                        {isUnbilled
                          ? `${String(group.rows.length)} 条价格 · 账本还没按它们计费`
                          : `${String(group.rows.length)} 个模型 · ${String(group.records)} 条`}
                      </span>
                    </div>
                    {!isUnbilled && metaRoute === group.provider && (
                      <div className="dtpl-pricing-chan-metaedit">
                        <RouteMetaEditor route={group.provider} meta={metaOf(group.provider)} onPatch={patch => patchMeta(group.provider, patch)} />
                      </div>
                    )}
                    <div className="dtpl-pricing-chan-rows">
                      {group.rows.map(row => renderRow(row, isUnbilled))}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>

          {/* 高级：新增入口与同价通道。首屏只有「一张表」，配置类的表单收在这里。 */}
          <div className="dtpl-pricing-advanced">
            <button
              type="button"
              className="dtpl-pricing-advanced-bar"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen(open => !open)}
            >
              <span className="dtpl-pricing-advanced-title">高级：新增手工价 / 新增覆盖 / 同价通道</span>
              {aliases.size > 0 && <span className="dtpl-pricing-advanced-count">同价通道 {aliases.size}</span>}
              <StagedTag staged={aliasDirty ? 'unsaved' : 'clean'} />
              <span className="dtpl-pricing-advanced-cue">{advancedOpen ? '收起' : '展开'}</span>
            </button>

            {advancedOpen && (
              <>
                <AddModelForm onAdd={model => {
                  setModelDrafts(current => {
                    const next = new Map(current)
                    next.set(model, draftOf(undefined))
                    return next
                  })
                  revealNew(providerKeyOf('', model))
                }} />
                <AddOverrideForm providers={knownNames} onAdd={(provider, model) => {
                  const key = providerKeyOf(provider, model)
                  setOverlayDrafts(current => {
                    const next = new Map(current)
                    next.set(key, {
                      key, provider, model, billing: 'metered', source: 'segments',
                      inheritBase: model, segments: [{ id: nextId(), from: '', to: '', rates: { input: '', output: '', cacheRead: '', cacheWrite: '' }, note: '' }],
                      note: '', placeholder: false,
                    })
                    return next
                  })
                  revealNew(key)
                }} />
                <AliasSection
                  names={knownNames}
                  aliases={aliases}
                  forms={forms}
                  onAdd={(route, target) => {
                    setAliases(current => {
                      const next = new Map(current)
                      next.set(route, target)
                      return next
                    })
                  }}
                  onRemove={route => {
                    setAliases(current => {
                      if (!current.has(route)) return current
                      const next = new Map(current)
                      next.delete(route)
                      return next
                    })
                  }}
                />
              </>
            )}
          </div>
        </>
      )}

      <div className="dtpl-pricing-foot">
        <span className={`dtpl-pricing-save-state${savedFlash ? ' dtpl-pricing-saved' : ''}`}>{savedFlash ? '已保存' : ''}</span>
        {dirty && <button type="button" className="dtpl-pricing-btn" onClick={() => void load()} disabled={saving}>放弃修改</button>}
        <button
          type="button"
          className="dtpl-pricing-save"
          onClick={() => void save()}
          disabled={saving || view === null || !dirty}
          title={dirty ? '把两条手工价文件一起写回（先通道覆盖层，再模型层）' : '没有未保存的改动'}
        >
          {saving ? '保存中…' : saveScope === '' ? '保存' : `保存 · ${saveScope}`}
        </button>
      </div>
    </section>
  )
}

/** One row's staged state from a baseline map and the staged map's entry. */
function draftRowStatus<T>(baseline: ReadonlyMap<string, string>, key: string, current: T | undefined): RowStatus {
  const saved = baseline.get(key)
  const signature = current === undefined ? undefined : signatureOf(current)
  return rowStatusOf(saved, signature)
}
