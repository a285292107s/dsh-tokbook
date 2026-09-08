/**
 * 价格表 tab of the token-book floating window: view + maintain the per-model
 * price table (¥ per million tokens) that backs every cost figure.
 *
 * Data comes from `/tokbook/pricing` (the read-only merged view); edits write
 * the hand-edited `pricing.json` through `PUT /tokbook/pricing`, whose entries
 * replace the cloud rules wholesale. The tab therefore only edits FLAT prices
 * (input / output / cache-read / cache-write) — a cloud entry that also
 * carries time-rule / context-tier / peak-slot pricing shows a "分时/分档"
 * hint, and adding a manual entry for that model replaces the whole rule set
 * with flat rates. A cloud row has an explicit 自定义 action that starts a
 * manual entry pre-filled from the cloud base; a manual row is edited in place
 * and can be removed (删除覆盖 → back to the cloud rates).
 *
 * Saving replaces the WHOLE manual file with the current manual rows, so each
 * row edit is staged in local state and one 保存 applies everything; the host
 * answers the fresh view, which replaces the list in place. The overview cost
 * figures re-price on the next overview read, so the tab tells the parent to
 * refresh after a successful save.
 *
 * @module dsh-tokbook/client/PricingPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PricingView, PricingViewRow } from '../types.ts'

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

const BLANK: DraftRates = { input: '', output: '', cacheRead: '', cacheWrite: '' }

/** Render a rate (¥/M) compactly: drop trailing zeros, show at most 4 decimals. */
function fmtRate(value: number | undefined): string {
  if (value === undefined) return '—'
  return String(Math.round(value * 10000) / 10000)
}/** Row state from a wire row: manual rows pre-fill their manual rates, cloud
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

export function PricingPanel({ onChanged }: PricingPanelProps) {
  const [rows, setRows] = useState<readonly EditableRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [query, setQuery] = useState('')
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

  // One combined view: manual rows first, then ledger-billed-but-unpriced
  // seeds, then the cloud table (each group filtered alphabetically).
  const manualRows = useMemo(() => rows === null ? [] : rows.filter(r => r.manual), [rows])
  const unpricedRows = useMemo(() => rows === null ? [] : rows.filter(r => !r.manual && r.unpriced === true), [rows])
  const cloudRows = useMemo(() => rows === null ? [] : rows.filter(r => !r.manual && r.unpriced !== true), [rows])

  const q = query.trim().toLowerCase()
  const matchQ = (r: EditableRow): boolean => q === '' || r.model.toLowerCase().includes(q)
  const visibleUnpriced = unpricedRows.filter(matchQ)
  const visibleCloud = cloudRows.filter(matchQ)
  const filteredTotal = visibleUnpriced.length + visibleCloud.length + manualRows.length

  return (
    <section className="dtpl-pricing-sec" aria-label="价格表">
      <p className="dtpl-pricing-intro">
        金额按本机价格表逐条计价：<b>手工覆盖价优先</b>，云端镜像表只作参考。修改保存后，全部历史按新价重算。
      </p>

      {error !== null && (
        <div className="dtpl-error" role="alert">
          <p className="dtpl-error-text">{error}</p>
          <button type="button" className="dtpl-retry" onClick={() => setError(null)}>忽略</button>
        </div>
      )}

      <div className="dtpl-pricing-bar">
        <div className="dtpl-pricing-filter" role="search">
          <input
            className="dtpl-pricing-search"
            type="search"
            placeholder={`筛选模型…（云表 ${cloudRows.length} 条 · 手工 ${manualRows.length} 条${unpricedRows.length > 0 ? ` · 未定价 ${unpricedRows.length} 条` : ''}）`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="筛选模型"
          />
        </div>
        <span className={`dtpl-pricing-hint${manualRows.length > 0 ? ' dtpl-pricing-hint-on' : ''}`}>
          {manualRows.length > 0 ? `${manualRows.length} 个手工覆盖` : '无手工覆盖'}
        </span>
      </div>

      {/* Column header row (matches PriceRow layout). */}
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

      <div className="dtpl-pricing-list">
        {/* Manual rows: editable in place, removable. */}
        {manualRows.map((row) => (
          <PriceRow
            key={`m:${row.model}`}
            row={row}
            editing
            onPatch={updateDraft}
            onRemove={() => {
              setRows(current => current === null ? current : current.filter(r => r !== row && r.model !== row.model))
            }}
          />
        ))}

        {/* 新增模型 entry: starts an empty manual row. */}
        {rows !== null && (
          <AddRow
            onAdd={(model) => {
              if (model === '') return
              setRows(current => current === null ? current : [rowOf({ model, manual: true }, true), ...current])
            }}
          />
        )}

        {rows === null ? (
          <div className="dtpl-pricing-skeleton dtpl-sk" />
        ) : (
          <>
            {visibleUnpriced.length > 0 && (
              <p className="dtpl-pricing-group-label">账本有记录、但未定价（按 ¥0 计）——点「去定价」设置手工价</p>
            )}
            {visibleUnpriced.map((row) => (
              <PriceRow
                key={`u:${row.model}`}
                row={row}
                editing={false}
                onPatch={updateDraft}
                onCustomize={() => {
                  setRows(current => current === null ? current : current.map(r => r.model === row.model ? rowOf({ model: row.model, manual: true }, true) : r))
                }}
                onRemove={() => {
                  setRows(current => current === null ? current : current.filter(r => r.model !== row.model))
                }}
              />
            ))}
            {visibleCloud.length === 0 && visibleUnpriced.length === 0 && q === '' && rows.length === 0 && (
              <p className="dtpl-pricing-empty">价格表为空（云端镜像可能尚未同步成功）。可以用下方输入框手工添加模型。</p>
            )}
            {visibleCloud.length === 0 && visibleUnpriced.length === 0 && q !== '' && manualRows.length > 0 && (
              <p className="dtpl-pricing-empty">「{query}」只匹配到手写模型，无其他可显示行。</p>
            )}
            {visibleCloud.length === 0 && visibleUnpriced.length === 0 && q !== '' && manualRows.length === 0 && (
              <p className="dtpl-pricing-empty">没有匹配「{query}」的模型。</p>
            )}
            {/* Cloud rows: read-only until 自定义 turns them manual. */}
            {visibleCloud.map((row) => (
              <PriceRow
                key={`c:${row.model}`}
                row={row}
                editing={false}
                onPatch={updateDraft}
                onCustomize={() => {
                  const entry = rowOf({ model: row.model, manual: true, cloudRates: row.cloud }, true)
                  if (row.cloud !== undefined) {
                    entry.draft = {
                      input: String(row.cloud.inputPerMillion),
                      output: String(row.cloud.outputPerMillion),
                      cacheRead: row.cloud.cacheReadPerMillion !== undefined ? String(row.cloud.cacheReadPerMillion) : '',
                      cacheWrite: row.cloud.cacheWritePerMillion !== undefined ? String(row.cloud.cacheWritePerMillion) : '',
                    }
                  }
                  setRows(current => current === null ? current : current.map(r => r.model === row.model ? entry : r))
                }}
                onRemove={() => {
                  setRows(current => current === null ? current : current.filter(r => r.model !== row.model))
                }}
              />
            ))}
          </>
        )}
      </div>

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
    </section>
  )
}

const FIELD_LABELS = { input: '输入', output: '输出', cacheRead: '缓存读', cacheWrite: '缓存写' } as const

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
