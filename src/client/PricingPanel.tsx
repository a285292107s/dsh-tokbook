/**
 * 价格表 tab of the token-book floating window: two editing surfaces behind
 * one segmented switch —
 *
 *  · 「模型价」 — the per-model base price table (¥ / million tokens). A hand
 *    override (`pricing.json`) beats the synced cloud mirror wholesale; the
 *    cloud table is reference-only and folded into a bounded scroll by default,
 *    so the tab never becomes a wall of hundreds of rows.
 *  · 「Provider 覆盖层」 — per (provider, exact model string) overrides of the
 *    billing nature and price source (`provider-pricing.json`), grouped by
 *    provider route. Rows are compact summaries; the editor for one row opens
 *    only while that row is being edited.
 *
 * Edits write the WHOLE hand file for the active surface (`PUT /tokbook/pricing`
 * for the model layer, `PUT /tokbook/provider-pricing` for the overlay), so
 * each row edit is staged in local state and one 保存 applies everything. The
 * host answers a fresh view which replaces the list in place; the overview
 * figures re-price on the next read, so a successful save asks the parent to
 * refresh.
 *
 * @module dsh-tokbook/client/PricingPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BillingNature, PricingView, PricingViewRow, ProviderPricingTable, ProviderPricingViewRow } from '../types.ts'

/** Blank editable rate slate (undefined = leave the field out on save). */
interface DraftRates {
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

interface EditableRow {
  model: string
  manual: boolean
  /** Cloud base rates behind the row, when the cloud names this model. */
  cloud?: PricingViewRow['cloudRates']
  /** True when the cloud entry carries time/context/peak rules. */
  layered?: boolean
  /** True when the ledger billed this model but nothing prices it (¥0 today). */
  unpriced?: boolean
  /** Ledger record count, present on unpriced rows. */
  records?: number
  /** Staged manual rates for this row ('' = field omitted on save). */
  draft: DraftRates
}

export interface PricingPanelProps {
  /** Called after a successful save so the parent can refresh the overview. */
  onChanged: () => void
}

/** Which editing surface the tab shows. */
type PricingMode = 'model' | 'provider'

const BLANK: DraftRates = { input: '', output: '', cacheRead: '', cacheWrite: '' }

/** Render a rate (¥/M) compactly: drop trailing zeros, show at most 4 decimals. */
function fmtRate(value: number | undefined): string {
  if (value === undefined) return '—'
  return String(Math.round(value * 10000) / 10000)
}

/** Row state from a wire row: manual rows pre-fill their manual rates, cloud
 *  rows start empty (editing begins when the user presses 自定义). */
function rowOf(view: PricingViewRow, manualOnly = false): EditableRow {
  return {
    model: view.model,
    manual: view.manual || manualOnly,
    cloud: view.cloudRates,
    layered: view.layered,
    unpriced: view.unpriced,
    records: view.records,
    draft: view.manualRates !== undefined
      ? {
          input: String(view.manualRates.inputPerMillion),
          output: String(view.manualRates.outputPerMillion),
          cacheRead: view.manualRates.cacheReadPerMillion !== undefined ? String(view.manualRates.cacheReadPerMillion) : '',
          cacheWrite: view.manualRates.cacheWritePerMillion !== undefined ? String(view.manualRates.cacheWritePerMillion) : '',
        }
      : { ...BLANK },
  }
}

/** Parse one staged rate cell: empty → undefined (field omitted); else a
 *  non-negative finite number, or NaN for a validation error. */
function parseRate(value: string): number | undefined | typeof NaN {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return NaN
  return n
}

/**
 * The 价格表 tab shell: a segmented switch between the model layer and the
 * provider overlay. Both sub-panels stay mounted (hidden, not unmounted) so
 * switching modes never discards staged-but-unsaved edits.
 */
export function PricingPanel({ onChanged }: PricingPanelProps) {
  const [mode, setMode] = useState<PricingMode>('model')

  const switchMode = (next: PricingMode): void => setMode(next)

  return (
    <section className="dtpl-pricing-sec" aria-label="价格表">
      <div className="dtpl-pricing-modes" role="group" aria-label="价格表视图">
        <button
          type="button"
          className={`dtpl-pricing-mode${mode === 'model' ? ' dtpl-pricing-mode-active' : ''}`}
          aria-pressed={mode === 'model'}
          onClick={() => switchMode('model')}
        >
          模型价
        </button>
        <button
          type="button"
          className={`dtpl-pricing-mode${mode === 'provider' ? ' dtpl-pricing-mode-active' : ''}`}
          aria-pressed={mode === 'provider'}
          onClick={() => switchMode('provider')}
        >
          Provider 覆盖层
        </button>
      </div>

      <div hidden={mode !== 'model'} className="dtpl-pricing-pane">
        <ModelPriceEditor onChanged={onChanged} />
      </div>
      <div hidden={mode !== 'provider'} className="dtpl-pricing-pane">
        <ProviderOverlayEditor onChanged={onChanged} />
      </div>
    </section>
  )
}

const FIELD_LABELS = { input: '输入', output: '输出', cacheRead: '缓存读', cacheWrite: '缓存写' } as const

/**
 * 模型价 surface: the flat per-model table. Hand rows are edited in place;
 * unpriced ledger models (¥0 today) sit right under them as one-click seeds;
 * the cloud mirror is folded behind a fold bar and, once opened, lives in a
 * bounded scroll region with a sticky column header so hundreds of reference
 * rows never stretch the whole dialog.
 *
 * Information hierarchy: a top row of count-bearing scope chips (手工价 /
 * 未定价 / 云端) narrows what the table shows; group headers carry their own
 * counts; the outer rate column header is shown only while rate-bearing rows
 * (manual/unpriced) are on screen, so a cloud-only scope never renders two
 * competing headers.
 */
type ModelScope = 'manual' | 'unpriced' | 'cloud' | null

function ModelPriceEditor({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<readonly EditableRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [query, setQuery] = useState('')
  const [cloudOpen, setCloudOpen] = useState(false)
  const [scope, setScope] = useState<ModelScope>(null)
  const activeRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++activeRef.current
    setError(null)
    try {
      const res = await fetch('/tokbook/pricing')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const view = await res.json() as PricingView
      if (token !== activeRef.current) return
      setRows(view.rows.map(row => rowOf(row)))
    } catch (err) {
      if (token !== activeRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load()
    return () => { activeRef.current += 1 }
  }, [load])

  /** Apply the host's fresh view after a save (replaces the staged list, so
   *  an edit the user just saved is authoritative). */
  const applyView = useCallback((view: PricingView) => {
    setRows(view.rows.map(row => rowOf(row)))
  }, [])

  const updateDraft = useCallback((model: string, patch: Partial<DraftRates>) => {
    setRows(current => current === null ? current : current.map(r => r.model === model ? { ...r, draft: { ...r.draft, ...patch } } : r))
  }, [])

  const save = useCallback(async () => {
    if (rows === null) return
    // Validate every staged manual row first; the whole save is refused on the
    // first bad number so the user fixes the visible row (host-side validation
    // re-runs regardless — this is only for immediate feedback).
    for (const row of rows) {
      if (!row.manual) continue
      const cells: Array<[string, string]> = [
        ['input', row.draft.input],
        ['output', row.draft.output],
      ]
      if (row.draft.cacheRead !== '') cells.push(['cacheRead', row.draft.cacheRead])
      if (row.draft.cacheWrite !== '') cells.push(['cacheWrite', row.draft.cacheWrite])
      for (const [field, raw] of cells) {
        if (Number.isNaN(parseRate(raw))) {
          setError(`「${row.model}」的${FIELD_LABELS[field as keyof typeof FIELD_LABELS]}不是有效价格（非负数字）`)
          return
        }
      }
      const input = parseRate(row.draft.input)
      const output = parseRate(row.draft.output)
      if (input === undefined || output === undefined) {
        setError(`「${row.model}」至少需要填写 输入 与 输出 单价`)
        return
      }
    }
    // Compose the COMPLETE desired manual table from every manual row
    // (a removed manual row simply is not in this list → host drops it).
    const table: Record<string, Record<string, number>> = {}
    for (const row of rows) {
      if (!row.manual) continue
      const input = parseRate(row.draft.input)
      const output = parseRate(row.draft.output)
      if (input === undefined || output === undefined) continue
      const entry: Record<string, number> = { inputPerMillion: input, outputPerMillion: output }
      const cacheRead = parseRate(row.draft.cacheRead)
      if (cacheRead !== undefined && !Number.isNaN(cacheRead)) entry.cacheReadPerMillion = cacheRead
      const cacheWrite = parseRate(row.draft.cacheWrite)
      if (cacheWrite !== undefined && !Number.isNaN(cacheWrite)) entry.cacheWritePerMillion = cacheWrite
      table[row.model] = entry
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/tokbook/pricing', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(table),
      })
      const payload = await res.json().catch(() => null) as { ok?: boolean; error?: string; view?: PricingView } | null
      if (!res.ok || payload === null || payload.ok !== true) {
        const message = payload?.error !== undefined && payload.error !== '' ? payload.error : `HTTP ${res.status}`
        throw new Error(message)
      }
      if (payload.view !== undefined) applyView(payload.view)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1600)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [rows, onChanged, applyView])

  // Derive the three model groups from the flat list.
  const manualRows = useMemo(() => rows === null ? [] : rows.filter(r => r.manual), [rows])
  const unpricedRows = useMemo(() => rows === null ? [] : rows.filter(r => !r.manual && r.unpriced === true), [rows])
  const cloudRows = useMemo(() => rows === null ? [] : rows.filter(r => !r.manual && r.unpriced !== true), [rows])

  const q = query.trim().toLowerCase()
  const matchQ = (r: EditableRow): boolean => q === '' || r.model.toLowerCase().includes(q)
  // A typed query narrows every group; a scope chip narrows to one group.
  const manualShown = scope !== 'unpriced' && scope !== 'cloud'
  const unpricedShown = scope !== 'manual' && scope !== 'cloud'
  const cloudShown = cloudRows.length > 0 && (scope === 'cloud' || scope === null)
  const manualVisible = manualShown ? manualRows.filter(matchQ) : []
  const unpricedVisible = unpricedShown ? unpricedRows.filter(matchQ) : []
  const cloudVisible = cloudShown ? cloudRows.filter(matchQ) : []
  // The outer rate header lines up with manual/unpriced rows; a cloud-only
  // scope shows the cloud region's own sticky header instead.
  const showOuterHeader = manualVisible.length > 0 || unpricedVisible.length > 0
  const cloudPaneOpen = scope === 'cloud' || (scope === null && (cloudOpen || q !== ''))

  const customize = useCallback((row: EditableRow) => {
    setRows(current => current === null ? current : current.map(r => r.model === row.model
      ? { ...rowOf({ model: row.model, manual: true, cloudRates: row.cloud }, true), draft: prefillFromCloud(row.cloud) }
      : r))
  }, [])

  const removeManual = useCallback((model: string) => {
    setRows(current => current === null ? current : current.filter(r => r.model !== model))
  }, [])

  const toggleScope = useCallback((next: Exclude<ModelScope, null>) => {
    setScope(current => {
      if (current === next) return null
      if (next === 'cloud') setCloudOpen(true)
      return next
    })
  }, [])

  const hasSearch = q !== ''
  const hasScope = scope !== null
  const nothingVisible = manualVisible.length === 0 && unpricedVisible.length === 0 && cloudVisible.length === 0

  return (
    <div className="dtpl-pricing-model-view">
      <p className="dtpl-pricing-intro">
        金额按本机价格表逐条计价：<b>手工覆盖价优先</b>，云端基准表只作参考。
        修改保存后，全部历史按新价重算。
      </p>

      {error !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">{error}</p>
          <button type="button" className="dtpl-retry" onClick={() => setError(null)}>忽略</button>
        </div>
      )}

      {/* Toolbar: scope chips with live counts + a search input. */}
      <div className="dtpl-pricing-bar">
        <div className="dtpl-pricing-scopes" role="group" aria-label="显示范围">
          <button
            type="button"
            className="dtpl-pricing-scope"
            aria-pressed={scope === 'manual'}
            onClick={() => toggleScope('manual')}
          >
            手工价
            <span className="dtpl-pricing-scope-count">{manualRows.length}</span>
          </button>
          <button
            type="button"
            className="dtpl-pricing-scope"
            aria-pressed={scope === 'unpriced'}
            onClick={() => toggleScope('unpriced')}
          >
            未定价
            <span className="dtpl-pricing-scope-count">{unpricedRows.length}</span>
          </button>
          <button
            type="button"
            className="dtpl-pricing-scope"
            aria-pressed={scope === 'cloud'}
            onClick={() => toggleScope('cloud')}
          >
            云端
            <span className="dtpl-pricing-scope-count">{cloudRows.length}</span>
          </button>
          {(hasSearch || hasScope) && (
            <button
              type="button"
              className="dtpl-pricing-scope-reset"
              onClick={() => { setQuery(''); setScope(null); setCloudOpen(false) }}
            >
              清除筛选
            </button>
          )}
        </div>
        <div className="dtpl-pricing-filter" role="search">
          <input
            className="dtpl-pricing-search"
            type="search"
            placeholder="搜索模型名…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜索模型名"
          />
        </div>
      </div>

      {/* ── group headers + rows ── */}
      {rows === null ? (
        <div className="dtpl-pricing-skeleton dtpl-sk" />
      ) : (
        <>
          {showOuterHeader && (
            <div className="dtpl-pricing-col-header" aria-hidden="true">
              <span>模型</span>
              <span className="dtpl-pricing-rates">
                <span>输入</span>
                <span>缓存读</span>
                <span>缓存写</span>
                <span>输出</span>
              </span>
              <span className="dtpl-pricing-col-actions">操作</span>
            </div>
          )}

          <div className="dtpl-pricing-list">
            {/* ── hand overrides: edited in place ── */}
            {manualShown && manualRows.length > 0 && (
              <SectionHead
                title="手工价"
                count={manualRows.length}
                shown={manualVisible.length}
                tone="accent"
                hint="本机覆盖，保存后生效"
              />
            )}
            {manualVisible.map((row) => (
              <PriceRow
                key={`m:${row.model}`}
                row={row}
                editing
                onPatch={updateDraft}
                onRemove={() => removeManual(row.model)}
              />
            ))}
            {manualShown && manualRows.length === 0 && !hasSearch && (
              <p className="dtpl-pricing-empty">还没有手工价。在下方输入框填一个账本模型串后点「添加」，或展开云端 / 未定价去「自定义 / 去定价」。</p>
            )}

            {/* ── 新增模型 entry: starts an empty manual row. ── */}
            {manualShown && (
              <AddRow
                onAdd={(model) => {
                  if (model === '') return
                  setRows(current => current === null ? current : [rowOf({ model, manual: true }, true), ...current])
                  setScope(null)
                }}
              />
            )}

            {/* ── ledger-billed but unpriced seeds ── */}
            {unpricedShown && unpricedRows.length > 0 && (
              <SectionHead
                title="账本未定价"
                count={unpricedRows.length}
                shown={unpricedVisible.length}
                tone="warn"
                hint="按 ¥0 计，点「去定价」设置手工价"
              />
            )}
            {unpricedVisible.map((row) => (
              <PriceRow
                key={`u:${row.model}`}
                row={row}
                editing={false}
                onPatch={updateDraft}
                onCustomize={() => customize(row)}
                onRemove={() => removeManual(row.model)}
              />
            ))}

            {/* ── cloud mirror ── */}
            {cloudShown && (
              <div className="dtpl-pricing-cloud">
                <button
                  type="button"
                  className="dtpl-pricing-cloud-bar"
                  aria-expanded={cloudPaneOpen}
                  onClick={() => {
                    // In cloud scope the pane is pinned open; the fold only
                    // toggles in the unfiltered view.
                    if (scope === null && q === '') setCloudOpen(open => !open)
                  }}
                >
                  <span className="dtpl-pricing-cloud-bar-title">
                    云端基准价表
                    <span className="dtpl-pricing-cloud-bar-count">{q === '' ? cloudRows.length : cloudVisible.length}</span>
                  </span>
                  <span className="dtpl-pricing-cloud-bar-cue">
                    {cloudPaneOpen ? '收起' : '展开浏览'}
                  </span>
                </button>

                {cloudPaneOpen && (
                  <div className="dtpl-pricing-cloud-scroll">
                    {/* Inner column header (sticky inside the bounded cloud
                        region), so cloud rows stay aligned while scrolling. */}
                    <div className="dtpl-pricing-col-header dtpl-pricing-col-header-sticky" aria-hidden="true">
                      <span>模型</span>
                      <span className="dtpl-pricing-rates">
                        <span>输入</span>
                        <span>缓存读</span>
                        <span>缓存写</span>
                        <span>输出</span>
                      </span>
                      <span className="dtpl-pricing-col-actions">操作</span>
                    </div>
                    {cloudVisible.length === 0 ? (
                      <p className="dtpl-pricing-empty">没有匹配「{query}」的云端模型。</p>
                    ) : cloudVisible.map((row) => (
                      <PriceRow
                        key={`c:${row.model}`}
                        row={row}
                        editing={false}
                        onPatch={updateDraft}
                        onCustomize={() => customize(row)}
                        onRemove={() => removeManual(row.model)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── global empty states ── */}
            {rows.length === 0 && (
              <p className="dtpl-pricing-empty">价格表为空（云端镜像可能尚未同步成功）。可以用下方输入框手工添加模型。</p>
            )}
            {rows.length > 0 && hasSearch && nothingVisible && (
              <p className="dtpl-pricing-empty">没有匹配「{query}」的模型。</p>
            )}
            {rows.length > 0 && !hasSearch && hasScope && scope !== 'cloud' && manualVisible.length === 0 && unpricedVisible.length === 0 && (
              <p className="dtpl-pricing-empty">
                {scope === 'manual' ? '还没有手工价。' : '没有未定价的账本模型。'}
                <button type="button" className="dtpl-pricing-empty-link" onClick={() => setScope(null)}>查看全部</button>
              </p>
            )}
            {rows.length > 0 && !hasSearch && scope === 'cloud' && cloudRows.length > 0 && cloudVisible.length === 0 && (
              <p className="dtpl-pricing-empty">云端基准表为空（镜像可能尚未同步成功）。</p>
            )}
          </div>
        </>
      )}

      <div className="dtpl-pricing-foot">
        <span className={`dtpl-pricing-save-state${savedFlash ? ' dtpl-pricing-saved' : ''}`}>
          {savedFlash ? '已保存' : ''}
        </span>
        <button
          type="button"
          className="dtpl-pricing-save"
          onClick={() => void save()}
          disabled={saving || rows === null || manualRows.length === 0}
        >
          {saving ? '保存中…' : manualRows.length > 0 ? `保存 ${manualRows.length} 条手工价` : '保存'}
        </button>
      </div>
    </div>
  )
}

/** A section header for one model group: label + total count, plus a subtle
 *  hint of how many rows are actually shown after filtering. */
function SectionHead({ title, count, shown, tone, hint }: {
  title: string
  count: number
  shown: number
  tone: 'accent' | 'warn' | 'neutral'
  hint: string
}) {
  return (
    <div className={`dtpl-pricing-sec-head dtpl-pricing-sec-head-${tone}`}>
      <span className="dtpl-pricing-sec-title">{title}</span>
      <span className="dtpl-pricing-sec-count">{count}</span>
      <span className="dtpl-pricing-sec-hint">
        {shown !== count ? `显示 ${shown} 条 · ` : ''}{hint}
      </span>
    </div>
  )
}

/** Prefill a manual row's rate fields from the cloud base (used by 自定义). */
function prefillFromCloud(cloud: PricingViewRow['cloudRates']): DraftRates {
  return {
    input: cloud?.inputPerMillion !== undefined ? String(cloud.inputPerMillion) : '',
    output: cloud?.outputPerMillion !== undefined ? String(cloud.outputPerMillion) : '',
    cacheRead: cloud?.cacheReadPerMillion !== undefined ? String(cloud.cacheReadPerMillion) : '',
    cacheWrite: cloud?.cacheWritePerMillion !== undefined ? String(cloud.cacheWritePerMillion) : '',
  }
}

/** One row of the price list. `editing` = a manual row with live inputs;
 *  a cloud row shows its cloud base rates + a 自定义 action that turns it
 *  into a manual (pre-filled) row. */
function PriceRow({ row, editing, onPatch, onCustomize, onRemove }: {
  row: EditableRow
  editing: boolean
  onPatch: (model: string, patch: Partial<DraftRates>) => void
  onCustomize?: () => void
  onRemove: () => void
}) {
  const showValue = (key: 'input' | 'output' | 'cacheRead' | 'cacheWrite') => {
    if (editing) return row.draft[key]
    const rate = row.cloud?.[key === 'input' ? 'inputPerMillion' : key === 'output' ? 'outputPerMillion' : key === 'cacheRead' ? 'cacheReadPerMillion' : 'cacheWritePerMillion']
    return rate === undefined ? '—' : fmtRate(rate)
  }
  const tag = editing ? '手工'
    : row.unpriced === true ? `未定价${row.records !== undefined && row.records > 0 ? ` · ${row.records} 条` : ''}`
      : row.layered === true ? '分时/分档' : '云端'
  return (
    <div className={`dtpl-pricing-row${editing ? ' dtpl-pricing-row-manual' : ''}${row.unpriced === true ? ' dtpl-pricing-row-unpriced' : ''}${row.layered === true ? ' dtpl-pricing-row-layered' : ''}`}>
      <div className="dtpl-pricing-model">
        <span className="dtpl-pricing-model-name" title={row.model}>{row.model}</span>
        <span className="dtpl-pricing-model-tag">{tag}</span>
      </div>
      <div className="dtpl-pricing-rates">
        <RateInput editing={editing} value={showValue('input')} aria="输入" onChange={(v) => onPatch(row.model, { input: v })} />
        <RateInput editing={editing} value={showValue('cacheRead')} aria="缓存读" onChange={(v) => onPatch(row.model, { cacheRead: v })} />
        <RateInput editing={editing} value={showValue('cacheWrite')} aria="缓存写" onChange={(v) => onPatch(row.model, { cacheWrite: v })} />
        <RateInput editing={editing} value={showValue('output')} aria="输出" onChange={(v) => onPatch(row.model, { output: v })} />
      </div>
      <div className="dtpl-pricing-actions">
        {editing ? (
          <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={onRemove} title="删除手工覆盖，回到云端价">删除覆盖</button>
        ) : row.unpriced === true ? (
          <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={onCustomize} title="此模型账本有记录但未定价，现按 ¥0 计。点击为它设置手工价">去定价</button>
        ) : (
          <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={onCustomize} title="以云端价为参考新增手工覆盖">自定义</button>
        )}
      </div>
    </div>
  )
}

/** A number cell: an editable <input> for a manual row, a plain value for a
 *  cloud row. The rate unit (¥/M) is implied by the column header. */
function RateInput({ editing, value, aria, onChange }: {
  editing: boolean
  value: string
  aria: string
  onChange: (v: string) => void
}) {
  if (!editing) {
    return <span className="dtpl-pricing-rate" title={`${aria}（¥/百万词元）`}>{value}</span>
  }
  return (
    <input
      className="dtpl-pricing-input"
      type="number"
      min="0"
      step="any"
      inputMode="decimal"
      value={value}
      aria-label={`${aria}单价（¥/百万词元）`}
      placeholder="—"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** The 新增模型 row: a model-name field + add button at the top of the list. */
function AddRow({ onAdd }: { onAdd: (model: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="dtpl-pricing-row dtpl-pricing-row-add">
      <div className="dtpl-pricing-model">
        <input
          className="dtpl-pricing-search dtpl-pricing-name-input"
          type="text"
          placeholder="新增模型：输入账本里的精确模型串…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="新增模型名"
        />
        <span className="dtpl-pricing-model-tag dtpl-pricing-model-tag-new">新增</span>
      </div>
      <div className="dtpl-pricing-rates" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <div className="dtpl-pricing-actions">
        <button
          type="button"
          className="dtpl-pricing-btn dtpl-pricing-custom"
          disabled={name.trim() === ''}
          onClick={() => { onAdd(name.trim()); setName('') }}
        >
          添加
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Provider overlay layer (provider 维度)：read + hand-edit provider-pricing.json
// ---------------------------------------------------------------------------

/** One editable draft of a (provider, model) hand entry. */
interface ProviderDraft {
  key: string
  provider: string
  model: string
  billing: BillingNature
  /** 'inherit' follows a base model's full rules; 'segments' is a flat price
   * (a single open segment from epoch 0). */
  source: 'inherit' | 'segments'
  /** inherit source: the base model id to follow. */
  inheritBase: string
  /** segments source: flat ¥/M rates for the open timeline. */
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

/** The key identifying one (provider, model) row across the layer. */
type ProviderKey = string

const providerKeyOf = (p: string, m: string): ProviderKey => `${p}\n${m}`

/** Seed a draft from a mirror/hand row so the user can edit it in place. */
function providerDraftOf(row: ProviderPricingViewRow): ProviderDraft {
  const segment = row.segments?.[0]
  return {
    key: providerKeyOf(row.provider, row.model),
    provider: row.provider,
    model: row.model,
    billing: row.billing ?? 'metered',
    source: row.segments !== undefined ? 'segments' : 'inherit',
    inheritBase: row.inheritBase ?? row.model,
    input: segment?.rate.inputPerMillion !== undefined ? String(segment.rate.inputPerMillion) : '',
    output: segment?.rate.outputPerMillion !== undefined ? String(segment.rate.outputPerMillion) : '',
    cacheRead: segment?.rate.cacheReadPerMillion !== undefined ? String(segment.rate.cacheReadPerMillion) : '',
    cacheWrite: segment?.rate.cacheWritePerMillion !== undefined ? String(segment.rate.cacheWritePerMillion) : '',
  }
}

function isRateText(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return false
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 0
}

/** A one-line human summary of a provider row's price source. */
function providerSourceSummary(row: ProviderPricingViewRow): string {
  if (row.manual) {
    if (row.segments !== undefined) {
      const seg = row.segments[0]
      return seg === undefined ? '手工分段价'
        : `自定价 入 ¥${fmtRate(seg.rate.inputPerMillion)} · 出 ¥${fmtRate(seg.rate.outputPerMillion)}`
    }
    return row.inheritBase !== undefined ? `手工跟随基准 ${row.inheritBase}` : '手工覆盖'
  }
  if (row.segments !== undefined) return `镜像分段价 ×${row.segments.length}`
  if (row.placeholder === true) return '占位 = 官方价（待填真实价）'
  if (row.inheritBase !== undefined) return `跟随基准 ${row.inheritBase}（含调价史）`
  return '云端覆盖'
}

/**
 * Provider 覆盖层 surface: one compact row per (provider, model) grouped by
 * provider route. Rows are read-only summaries until the user opens the row's
 * editor (one row at a time), which stages changes into a drafts map; the
 * footer 保存 writes the WHOLE desired manual overlay.
 */
function ProviderOverlayEditor({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<readonly ProviderPricingViewRow[] | null>(null)
  const [drafts, setDrafts] = useState<ReadonlyMap<ProviderKey, ProviderDraft>>(() => new Map())
  const [editingKey, setEditingKey] = useState<ProviderKey | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const activeRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++activeRef.current
    setError(null)
    try {
      const res = await fetch('/tokbook/provider-pricing')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const payload = await res.json() as { providerRows?: ProviderPricingViewRow[] }
      if (token !== activeRef.current) return
      const providerRows = payload.providerRows ?? []
      setRows(providerRows)
      // Seed drafts from the hand rows so untouched overrides survive a save.
      setDrafts(new Map(
        providerRows.filter(r => r.manual).map(r => [providerKeyOf(r.provider, r.model), providerDraftOf(r)]),
      ))
      // Every provider group starts expanded (the rows are compact); the user
      // collapses groups they don't care about.
      setCollapsed(new Set())
    } catch (err) {
      if (token !== activeRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load()
    return () => { activeRef.current += 1 }
  }, [load])

  const patchDraft = useCallback((key: ProviderKey, patch: Partial<ProviderDraft>) => {
    setDrafts(current => {
      const next = new Map(current)
      const draft = next.get(key)
      if (draft !== undefined) next.set(key, { ...draft, ...patch })
      return next
    })
  }, [])

  const upsertDraft = useCallback((draft: ProviderDraft) => {
    setDrafts(current => {
      const next = new Map(current)
      next.set(draft.key, draft)
      return next
    })
  }, [])

  const deleteDraft = useCallback((key: ProviderKey) => {
    setDrafts(current => {
      const next = new Map(current)
      next.delete(key)
      return next
    })
    setEditingKey(current => current === key ? null : current)
  }, [])

  const toggleGroup = useCallback((provider: string) => {
    setCollapsed(current => {
      const next = new Set(current)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }, [])

  const save = useCallback(async () => {
    // Compose the COMPLETE desired manual overlay from the drafts.
    const table: ProviderPricingTable = {}
    for (const draft of drafts.values()) {
      const entry: { billing: BillingNature; inheritBase?: string; segments?: unknown[]; note?: string } = { billing: draft.billing }
      if (draft.source === 'inherit') {
        const base = draft.inheritBase.trim()
        if (base === '') {
          setError(`「${draft.provider}/${draft.model}」的跟随基准模型名不能为空`)
          return
        }
        entry.inheritBase = base
      } else {
        const input = Number(draft.input.trim())
        const output = Number(draft.output.trim())
        if (!isRateText(draft.input) || !isRateText(draft.output)) {
          setError(`「${draft.provider}/${draft.model}」的自定价需要非负的 输入/输出 单价`)
          return
        }
        const rate: Record<string, number> = { inputPerMillion: input, outputPerMillion: output }
        if (isRateText(draft.cacheRead)) rate.cacheReadPerMillion = Number(draft.cacheRead.trim())
        if (isRateText(draft.cacheWrite)) rate.cacheWritePerMillion = Number(draft.cacheWrite.trim())
        entry.segments = [{ from: 0, rate, note: '手工覆盖' }]
      }
      const provider = (table[draft.provider] ?? {}) as Record<string, unknown>
      provider[draft.model] = entry
      table[draft.provider] = provider as ProviderPricingTable[string]
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/tokbook/provider-pricing', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(table),
      })
      const payload = await res.json().catch(() => null) as { ok?: boolean; error?: string; view?: PricingView } | null
      if (!res.ok || payload === null || payload.ok !== true) {
        const message = payload?.error !== undefined && payload.error !== '' ? payload.error : `HTTP ${res.status}`
        throw new Error(message)
      }
      await load()
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1600)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [drafts, onChanged, load])

  // Group rows by provider; hand rows first within each group.
  const grouped = useMemo(() => {
    const byProvider = new Map<string, ProviderPricingViewRow[]>()
    for (const row of rows ?? []) {
      const list = byProvider.get(row.provider) ?? []
      list.push(row)
      byProvider.set(row.provider, list)
    }
    const out: Array<[string, ProviderPricingViewRow[]]> = []
    for (const [provider, list] of byProvider) {
      list.sort((a, b) => {
        if (a.manual !== b.manual) return a.manual ? -1 : 1
        return a.model < b.model ? -1 : a.model > b.model ? 1 : 0
      })
      out.push([provider, list])
    }
    out.sort((a, b) => a[0].localeCompare(b[0]))
    return out
  }, [rows])

  const draftCount = drafts.size

  return (
    <div className="dtpl-pricing-provider">
      {error !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">{error}</p>
          <button type="button" className="dtpl-retry" onClick={() => setError(null)}>忽略</button>
        </div>
      )}

      <p className="dtpl-pricing-provider-intro">
        按「路由 Provider + 精确模型串」定价——订阅通道标「订阅价值」、跟随官方价的写「跟随基准」，
        前缀串（如 <code>deepseek/deepseek-v4-flash</code>）在这里命中。点行内「编辑」展开覆盖编辑器。
      </p>

      {rows === null ? (
        <div className="dtpl-pricing-skeleton dtpl-sk" />
      ) : grouped.length === 0 ? (
        <p className="dtpl-pricing-empty">Provider 覆盖层为空（云端镜像可能尚未同步）。开通订阅/中转通道后，这里会列出每条通道的覆盖规则。</p>
      ) : (
        <div className="dtpl-pricing-provider-list">
          {grouped.map(([provider, list]) => {
            const isCollapsed = collapsed.has(provider)
            const handCount = list.filter(r => drafts.has(providerKeyOf(r.provider, r.model))).length
            return (
              <section className="dtpl-pricing-provider-group" key={provider} data-provider={provider}>
                <button
                  type="button"
                  className="dtpl-pricing-provider-head"
                  aria-expanded={!isCollapsed}
                  aria-controls={`dtpl-prov-${cssId(provider)}`}
                  onClick={() => toggleGroup(provider)}
                >
                  <span className="dtpl-pricing-provider-head-name">{provider}</span>
                  <span className="dtpl-pricing-provider-head-meta">
                    {list.length} 条{handCount > 0 ? ` · 手工 ${handCount}` : ''}
                  </span>
                  <span className="dtpl-pricing-provider-head-caret" aria-hidden="true">
                    {isCollapsed ? '▸' : '▾'}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="dtpl-pricing-provider-rows" id={`dtpl-prov-${cssId(provider)}`}>
                    {list.map((row) => {
                      const key = providerKeyOf(row.provider, row.model)
                      const draft = drafts.get(key)
                      const isEditing = editingKey === key
                      // A draft IS the hand override: rows only behave as
                      // "手工" while a draft exists. Deleting the draft returns
                      // the row to mirror behavior until the next reload.
                      const isHand = draft !== undefined
                      const summary = draft !== undefined
                        ? (draft.source === 'inherit'
                          ? `跟随基准 ${draft.inheritBase || '—'}`
                          : `自定价 入 ${draft.input || '—'} · 出 ${draft.output || '—'}`)
                        : providerSourceSummary(row)
                      const tag = draft !== undefined
                        ? '手工'
                        : row.segments !== undefined ? '分段价'
                          : row.placeholder === true ? '占位(官方)'
                            : row.inheritBase !== undefined ? '跟随基准' : '覆盖'
                      return (
                        <div key={key}>
                          <div className={`dtpl-pricing-provider-row${isHand ? ' dtpl-pricing-provider-row-hand' : ''}`}>
                            <div className="dtpl-pricing-provider-model">
                              <span className="dtpl-pricing-provider-model-name" title={row.model}>{row.model}</span>
                              <span className="dtpl-pricing-model-tag">{tag}</span>
                              <span className={`dtpl-pricing-provider-billing dtpl-pricing-provider-billing-${(draft ?? row).billing}`}>
                                {(draft ?? row).billing === 'subscription' ? '订阅价值' : '按量支出'}
                              </span>
                              <span className="dtpl-pricing-provider-summary">{summary}</span>
                            </div>
                            <div className="dtpl-pricing-actions">
                              {isEditing ? (
                                <button
                                  type="button"
                                  className="dtpl-pricing-btn dtpl-pricing-custom"
                                  onClick={() => setEditingKey(null)}
                                >
                                  收起
                                </button>
                              ) : isHand ? (
                                <>
                                  <button
                                    type="button"
                                    className="dtpl-pricing-btn dtpl-pricing-custom"
                                    onClick={() => setEditingKey(key)}
                                  >
                                    编辑
                                  </button>
                                  <button
                                    type="button"
                                    className="dtpl-pricing-btn dtpl-pricing-remove"
                                    onClick={() => deleteDraft(key)}
                                    title="删除手工覆盖，回到云端镜像行"
                                  >
                                    删除覆盖
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="dtpl-pricing-btn dtpl-pricing-custom"
                                  onClick={() => {
                                    const seeded = providerDraftOf(row)
                                    upsertDraft(seeded)
                                    setEditingKey(key)
                                  }}
                                  title="以镜像行为参考新增手工覆盖"
                                >
                                  设为覆盖
                                </button>
                              )}
                            </div>
                          </div>

                          {isEditing && draft !== undefined && (
                            <ProviderRowEditor
                              draft={draft}
                              onPatch={(patch) => patchDraft(key, patch)}
                              onDone={() => setEditingKey(null)}
                              onDelete={() => deleteDraft(key)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <div className="dtpl-pricing-foot">
        <span className={`dtpl-pricing-save-state${savedFlash ? ' dtpl-pricing-saved' : ''}`}>
          {savedFlash ? '已保存' : ''}
        </span>
        <button type="button" className="dtpl-pricing-save" onClick={() => void save()} disabled={saving || rows === null}>
          {saving ? '保存中…' : draftCount > 0 ? `保存 ${draftCount} 条 Provider 覆盖` : '保存 Provider 覆盖'}
        </button>
      </div>
    </div>
  )
}

/** The inline editor of ONE provider row, shown only while that row is being
 *  edited. Every change stages into the row's draft; the group footer 保存
 *  persists all drafts at once. */
function ProviderRowEditor({ draft, onPatch, onDone, onDelete }: {
  draft: ProviderDraft
  onPatch: (patch: Partial<ProviderDraft>) => void
  onDone: () => void
  onDelete: () => void
}) {
  return (
    <div className="dtpl-pricing-prov-editor" role="group" aria-label={`编辑 ${draft.provider}/${draft.model} 覆盖`}>
      <div className="dtpl-pricing-prov-editor-grid">
        <label className="dtpl-pricing-provider-field">
          <span>计费</span>
          <select
            className="dtpl-pricing-input dtpl-pricing-select"
            value={draft.billing}
            aria-label="计费性质"
            onChange={(e) => onPatch({ billing: e.target.value as BillingNature })}
          >
            <option value="metered">按量（实际支出）</option>
            <option value="subscription">订阅（价值）</option>
          </select>
        </label>
        <label className="dtpl-pricing-provider-field">
          <span>价格来源</span>
          <select
            className="dtpl-pricing-input dtpl-pricing-select"
            value={draft.source}
            aria-label="价格来源"
            onChange={(e) => onPatch({ source: e.target.value as ProviderDraft['source'] })}
          >
            <option value="inherit">跟随基准价表（含调价史）</option>
            <option value="segments">手工固定价（覆盖调价史）</option>
          </select>
        </label>

        {draft.source === 'inherit' ? (
          <label className="dtpl-pricing-provider-field dtpl-pricing-provider-field-wide">
            <span>跟随基准模型</span>
            <input
              className="dtpl-pricing-input"
              type="text"
              value={draft.inheritBase}
              aria-label="跟随基准模型"
              onChange={(e) => onPatch({ inheritBase: e.target.value })}
            />
          </label>
        ) : (
          <>
            <label className="dtpl-pricing-provider-field">
              <span>输入 ¥/M</span>
              <input className="dtpl-pricing-input" type="number" min="0" step="any" inputMode="decimal"
                aria-label="输入单价" value={draft.input}
                onChange={(e) => onPatch({ input: e.target.value })} />
            </label>
            <label className="dtpl-pricing-provider-field">
              <span>输出 ¥/M</span>
              <input className="dtpl-pricing-input" type="number" min="0" step="any" inputMode="decimal"
                aria-label="输出单价" value={draft.output}
                onChange={(e) => onPatch({ output: e.target.value })} />
            </label>
            <label className="dtpl-pricing-provider-field">
              <span>缓存读 ¥/M</span>
              <input className="dtpl-pricing-input" type="number" min="0" step="any" inputMode="decimal"
                aria-label="缓存读单价" value={draft.cacheRead}
                onChange={(e) => onPatch({ cacheRead: e.target.value })} />
            </label>
            <label className="dtpl-pricing-provider-field">
              <span>缓存写 ¥/M</span>
              <input className="dtpl-pricing-input" type="number" min="0" step="any" inputMode="decimal"
                aria-label="缓存写单价" value={draft.cacheWrite}
                onChange={(e) => onPatch({ cacheWrite: e.target.value })} />
            </label>
          </>
        )}
      </div>

      <div className="dtpl-pricing-prov-editor-actions">
        <button type="button" className="dtpl-pricing-btn dtpl-pricing-custom" onClick={onDone}>完成</button>
        <button type="button" className="dtpl-pricing-btn dtpl-pricing-remove" onClick={onDelete}>删除覆盖</button>
      </div>
    </div>
  )
}

/** Provider route keys can contain characters invalid in an HTML id. */
function cssId(provider: string): string {
  return provider.replace(/[^a-zA-Z0-9_-]/g, '-')
}
