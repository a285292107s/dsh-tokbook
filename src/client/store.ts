import type { TokBookOverview } from '../types.ts'

export interface TokBookViewSnapshot {
  readonly open: boolean
  readonly overview: TokBookOverview | null
  readonly error: string | null
  readonly pricingDirty: boolean
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
