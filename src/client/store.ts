/**
 * 触发按钮与浮窗共享的 view store（经 `apply` 创建、`inject` 分发）。
 * pricingDirty 跨 unmount 存活；quotaAlert 来自宿主快照、不走网络。
 *
 * @module dsh-tokbook/client/store
 */

import type { TokBookOverview } from '../types.ts'

export interface TokBookViewSnapshot {
  readonly open: boolean
  readonly overview: TokBookOverview | null
  readonly error: string | null
  /** 未保存的价表改动；跨 unmount 存活，驱动 tab 小圆点。 */
  readonly pricingDirty: boolean
  /** 最近已知的额度告急（宿主持久化快照，无网络）。 */
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
