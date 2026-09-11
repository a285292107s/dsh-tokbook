/**
 * Sidebar footer trigger for the token book (route A: `sidebar.footer.action`).
 *
 * Receives the slot owner share `{ wide }` (false = 56px rail) plus the shared
 * view store through the register `inject` factory. Clicking toggles the
 * overlay via the store. A small warn-colored dot rides the icon when the
 * last-known quota snapshot says a subscription window is 告急 — the badge
 * never itself polls provider APIs; the client entry refreshes it from
 * `GET /tokbook/quota` (disk-only list + alert).
 *
 * Styled to match the DSH web sidebar foot (same geometry as the settings
 * trigger): a full-width 42px bar when wide, a 36px round icon control on the
 * 56px rail.
 *
 * @module dsh-tokbook/client/FooterButton
 */

import { useSyncExternalStore } from 'react'
import type { TokBookViewStore } from './store.ts'
import { UsageGlyph } from './icons.tsx'

export interface FooterButtonProps {
  /** Sidebar column state: false = collapsed rail. */
  wide: boolean
  /** Shared view store (injected). */
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
