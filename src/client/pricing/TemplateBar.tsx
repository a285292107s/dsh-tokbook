import { useState } from 'react'
import type { PriceCurrency } from '../../types.ts'
import type { PriceTemplate } from './templates.ts'

export interface ApplyResult {
  ok: boolean
  error?: string
}

const CURRENCY_MARK: Record<PriceCurrency, string> = { CNY: '¥', USD: '$' }

export function TemplateBar({ templates, currency, canSave, onApply, onDelete, onSave }: {
  templates: readonly PriceTemplate[]
  currency: PriceCurrency
  canSave: boolean
  onApply: (template: PriceTemplate) => ApplyResult
  onDelete: (id: string) => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState('')
  const [composing, setComposing] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'err'; text: string } | null>(null)

  const close = (): void => {
    setComposing(false)
    setName('')
  }

  const save = (): void => {
    if (!canSave || name.trim() === '') return
    onSave(name.trim())
    close()
    setNotice(null)
  }

  return (
    <div className="dtpl-price-tpl">
      <span className="dtpl-price-tpl-k">价格模板</span>
      <div className="dtpl-price-tpl-chips">
        {templates.length === 0
          ? <span className="dtpl-price-tpl-empty">还没有模板。存下当前这组价，换模型时一键套用。</span>
          : templates.map((template) => (
            <span className="dtpl-price-tpl-chip" key={template.id}>
              <button
                type="button"
                className="dtpl-price-tpl-apply"
                title={describeTemplate(template, currency)}
                onClick={() => {
                  const result = onApply(template)
                  setNotice(result.ok ? null : { tone: 'err', text: result.error ?? '套用失败' })
                }}
              >
                <span className="dtpl-price-tpl-mark" aria-hidden="true">{CURRENCY_MARK[template.currency]}</span>
                <span className="dtpl-price-tpl-name">{template.name}</span>
              </button>
              <button
                type="button"
                className="dtpl-price-tpl-del"
                aria-label={`删除模板 ${template.name}`}
                title="删除这个模板（只删模板，不影响任何已填的价）"
                onClick={() => onDelete(template.id)}
              >
                ×
              </button>
            </span>
          ))}
      </div>
      <div className="dtpl-price-tpl-save">
        {composing
          ? (
            <>
              <input
                className="dtpl-price-input dtpl-price-tpl-input"
                type="text"
                value={name}
                placeholder="给这组价起个名"
                aria-label="新模板名称"
                autoComplete="off"
                spellCheck={false}
                maxLength={40}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    save()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    close()
                  }
                }}
              />
              <button
                type="button"
                className="dtpl-price-tool"
                disabled={!canSave || name.trim() === ''}
                title={canSave
                  ? '把当前模型的四档价与峰谷时段（按这条通道的币种）存成一个可复用的模板'
                  : '先把这一行的输入价、输出价填上，才能存成模板'}
                onClick={save}
              >
                存
              </button>
              <button type="button" className="dtpl-price-ghost" onClick={close}>取消</button>
            </>
          )
          : (
            <button
              type="button"
              className="dtpl-price-tool"
              disabled={!canSave}
              title={canSave
                ? '把当前模型的四档价与峰谷时段（按这条通道的币种）存成一个可复用的模板'
                : '先把这一行的输入价、输出价填上，才能存成模板'}
              onClick={() => {
                setNotice(null)
                setComposing(true)
              }}
            >
              ＋ 存为模板
            </button>
          )}
      </div>
      {notice !== null && <span className="dtpl-price-tpl-err" role="alert">{notice.text}</span>}
    </div>
  )
}

function describeTemplate(template: PriceTemplate, currency: PriceCurrency): string {
  const unit = template.currency === 'USD' ? '$/百万词元' : '¥/百万词元'
  const parts = [`输入 ${show(template.input)}`, `输出 ${show(template.output)}`]
  if (template.cacheRead.trim() !== '') parts.push(`读 ${show(template.cacheRead)}`)
  if (template.cacheWrite.trim() !== '') parts.push(`写 ${show(template.cacheWrite)}`)
  const convert = template.currency !== currency ? '；套用时按汇率换算到这条通道的币种' : ''
  const slots = template.slots.length > 0 ? `，另带 ${String(template.slots.length)} 个峰谷时段` : ''
  return `套用「${template.name}」：${parts.join(' / ')}（${unit}）${slots}${convert}`
}

function show(value: string): string {
  return value.trim() === '' ? '—' : value
}
