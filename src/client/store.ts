/**
 * Small shared view store for the trigger button and the overlay window.
 *
 * The button and the overlay are two sibling root-scoped slot entries, so they
 * share state through one handle created in `apply` and passed to both via
 * their register `inject` factories. The store is a minimal
 * subscribe/getSnapshot object the components bind with `useSyncExternalStore`.
 *
 * @module dsh-tokbook/client/store
 */

import type { TokBookOverview } from '../types.ts'

export interface TokBookViewSnapshot {
  readonly open: boolean
  readonly overview: TokBookOverview | null
  readonly error: string | null
  /** True while the 价格表 tab holds unsaved staged edits. The drafts survive
   *  unmount, so this flag outlives the panel and drives the tab's dot. */
  readonly pricingDirty: boolean
  /** Last-known quota 告急 from the host's durable snapshots (no network). */
  readonly quotaAlert: boolean
}

export interface TokBookViewStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): TokBookViewSnapshot
  setOpen(open: boolean): void
  setOverview(overview: TokBookOverview | null): void
  setError(error: string | null): void
  setPricingDirty(dirty: boolean): void
  setQuotaAlert(alert: boolean): void
}

/** Create a fresh root-scoped view store (one per plugin activation). */
export function createTokBookViewStore(): TokBookViewStore {
  const listeners = new Set<() => void>()
  let snapshot: TokBookViewSnapshot = {
    open: false, overview: null, error: null, pricingDirty: false, quotaAlert: false,
  }
  const emit = (): void => {
    for (const listener of [...listeners]) listener()
  }
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot() {
      return snapshot
    },
    setOpen(open) {
      snapshot = { ...snapshot, open }
      emit()
    },
    setOverview(overview) {
      snapshot = { ...snapshot, overview, error: null }
      emit()
    },
    setError(error) {
      snapshot = { ...snapshot, error }
      emit()
    },
    setPricingDirty(pricingDirty) {
      if (snapshot.pricingDirty === pricingDirty) return
      snapshot = { ...snapshot, pricingDirty }
      emit()
    },
    setQuotaAlert(quotaAlert) {
      if (snapshot.quotaAlert === quotaAlert) return
      snapshot = { ...snapshot, quotaAlert }
      emit()
    },
  }
}
