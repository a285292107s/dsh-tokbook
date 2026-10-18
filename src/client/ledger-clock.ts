import type { SyncStatusView } from '../types.ts'
import { ROUTE_SYNC } from '../route-paths.ts'

const PROBE_MS = 3_000

const PROBE_RETRY_MS = 15_000

const NOTIFY_DELAY_MS = 400

type Ledger = number | null

type Listener = (ledger: Ledger, previous: Ledger) => void

let ledger: Ledger = null
const listeners = new Set<Listener>()
let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<boolean> | null = null
let visibilityBound = false

function probe(): Promise<boolean> {
  if (inflight !== null) return inflight
  const pending = fetch(ROUTE_SYNC)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as Partial<SyncStatusView>
    })
    .then((state) => {
      const previous = ledger
      ledger = typeof state.ledger === 'number' && Number.isFinite(state.ledger) ? state.ledger : null
      for (const listener of [...listeners]) listener(ledger, previous)
      return true
    })
    .catch(() => {
      return false
    })
    .finally(() => {
      if (inflight === pending) inflight = null
    })
  inflight = pending
  return pending
}

function schedule(delay: number): void {
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    if (listeners.size === 0) return
    if (document.hidden) { schedule(PROBE_MS); return }
    void probe().then((ok) => {
      if (listeners.size > 0) schedule(ok ? PROBE_MS : PROBE_RETRY_MS)
    })
  }, delay)
}

function onVisibility(): void {
  if (document.hidden || listeners.size === 0) return
  void probe().then((ok) => {
    if (listeners.size > 0) schedule(ok ? PROBE_MS : PROBE_RETRY_MS)
  })
}

function subscribeLedgerClock(listener: Listener): () => void {
  listeners.add(listener)
  if (!visibilityBound) {
    document.addEventListener('visibilitychange', onVisibility)
    visibilityBound = true
  }
  if (listeners.size === 1) {
    void probe().then((ok) => { if (listeners.size > 0) schedule(ok ? PROBE_MS : PROBE_RETRY_MS) })
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
}

export function subscribeLedgerChanges(onChange: () => void): () => void {
  let queued = false
  let pending: ReturnType<typeof setTimeout> | null = null
  const unsubscribe = subscribeLedgerClock((next, previous) => {
    if (next === null || previous === null || next === previous) return
    if (queued) return
    queued = true
    pending = setTimeout(() => {
      queued = false
      pending = null
      onChange()
    }, NOTIFY_DELAY_MS)
  })
  return () => {
    if (pending !== null) clearTimeout(pending)
    pending = null
    queued = false
    unsubscribe()
  }
}

export function ledgerClockSupported(): boolean {
  return ledger !== null
}
