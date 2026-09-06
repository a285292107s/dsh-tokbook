/**
 * Sidebar footer trigger for the token book (route A: `sidebar.footer.action`).
 *
 * Receives the slot owner share `{ wide }` (false = 56px rail) plus the shared
 * view store through the register `inject` factory. Clicking toggles the
 * overlay via the store.
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
  const open = useSyncExternalStore(view.subscribe, () => view.getSnapshot().open)
  const rail = !wide
  return (
    <button
      type="button"
      className={`dtpl-footer${rail ? ' dtpl-rail' : ''}`}
      data-plugin="dsh-tokbook"
      aria-pressed={open}
      aria-label="词元账本"
      title="词元账本"
      onClick={() => view.setOpen(!open)}
    >
      <UsageGlyph className="dtpl-foot-ico" />
      {wide && <span className="dtpl-foot-label">词元账本</span>}
    </button>
  )
}
