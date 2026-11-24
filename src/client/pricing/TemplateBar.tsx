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
  const [notice, setNotice] = useState<{ tone: 'err'; text: string } | null>(null)

  const save = (): void => {
    if (!canSave || name.trim() === '') return
    onSave(name.trim())
    setName('')
    setNotice(null)
  }

  return (
    <div className="dtpl-price-tpl">
      <span className="dtpl-price-tpl-k">价格模板</span>
      <div className="dtpl-price-tpl-chips">
        {templates.length === 0
          ? <span className="dtpl-price-tpl-empty">还没有模板：把当前这组四档价起个名存成模板，以后一键套到别的模型上。</span>
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
        <input
          className="dtpl-price-input dtpl-price-tpl-input"
          type="text"
          value={name}
          placeholder="给这组价起个名"
          aria-label="新模板名称"
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              save()
            }
          }}
        />
        <button
          type="button"
          className="dtpl-price-ghost"
          disabled={!canSave || name.trim() === ''}
          title={canSave
            ? '把当前模型的四档价（按这条通道的币种）存成一个可复用的模板'
            : '先把这一行的输入价、输出价填上，才能存成模板'}
          onClick={save}
        >
          存为模板
        </button>
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
  return `套用「${template.name}」：${parts.join(' / ')}（${unit}）${convert}`
}

function show(value: string): string {
  return value.trim() === '' ? '—' : value
}
