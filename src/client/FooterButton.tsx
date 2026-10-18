import { useSyncExternalStore } from 'react'
import type { TokBookViewStore } from './store.ts'
import { UsageGlyph } from './icons.tsx'

export interface FooterButtonProps {
  wide: boolean
  view: TokBookViewStore
}

export function FooterButton({ wide, view }: FooterButtonProps) {
  const { open, quotaAlert } = useSyncExternalStore(view.subscribe, view.getSnapshot)
  const rail = !wide
  return (
    <button
      type="button"
      className={`dtpl-footer${rail ? ' dtpl-rail' : ''}`}
      data-plugin="dsh-tokbook"
      aria-pressed={open}
      aria-label={quotaAlert ? '词元账本（订阅额度告急）' : '词元账本'}
      title={quotaAlert ? '词元账本 · 订阅额度告急' : '词元账本'}
      onClick={() => view.setOpen(!open)}
    >
      <span className="dtpl-foot-ico-wrap">
        <UsageGlyph className="dtpl-foot-ico" />
        {quotaAlert && (
          <i
            className="dtpl-foot-alert"
            role="img"
            aria-label="订阅额度告急"
            title="最近一次查询的订阅额度已接近或超过窗口上限"
          />
        )}
      </span>
      {wide && <span className="dtpl-foot-label">词元账本</span>}
    </button>
  )
}
