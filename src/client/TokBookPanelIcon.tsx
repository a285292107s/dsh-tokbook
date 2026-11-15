import { useSyncExternalStore } from 'react'
import type { TokBookViewStore } from './store.ts'
import { UsageGlyph } from './icons.tsx'

export interface TokBookPanelIconProps {
  size: number
  active: boolean
  view: TokBookViewStore
}

export function TokBookPanelIcon({ size, view }: TokBookPanelIconProps) {
  const { quotaAlert } = useSyncExternalStore(view.subscribe, view.getSnapshot)
  return (
    <span className="dtpl-nav-ico-wrap" style={{ width: size, height: size }}>
      <UsageGlyph className="dtpl-nav-ico" />
      {quotaAlert && (
        <i
          className="dtpl-nav-alert"
          role="img"
          aria-label="订阅额度告急"
          title="最近一次查询的订阅额度已接近或超过窗口上限"
        />
      )}
    </span>
  )
}
