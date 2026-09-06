/**
 * Self-check of the persisted sync-baseline restart semantics (pure logic):
 * after a restart, loading `sync-progress.json` must let the freshness probe
 * skip unchanged sessions and only re-walk drifted/new ones; a missing or
 * torn baseline must read as null (the caller then falls back to the full
 * walk and rewrites one).
 *
 * Run: node --experimental-strip-types scripts/selfcheck-baseline.ts
 *
 * @module dsh-tokbook/selfcheck-baseline
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSyncProgress, writeSyncProgress } from '../src/sync-state.ts'
import { snapshotBaseline, staleSessionIds, type PersistenceSnapshotLike } from '../src/stats.ts'

let failures = 0
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ' — ' + JSON.stringify(detail)}`)
  if (!ok) failures += 1
}

const snap = (id: string, revision: unknown): PersistenceSnapshotLike => ({
  header: { id },
  ...(revision !== undefined ? { revision } : {}),
})

const dir = await mkdtemp(join(tmpdir(), 'tokbook-baseline-'))
try {
  // --- write a baseline as one process would, read it back as a restart ---
  const listing = [snap('a', 'rev-1'), snap('b', 'rev-2'), snap('c', 'rev-3')]
  await writeSyncProgress(dir, {
    syncedAt: Date.now(),
    sessions: Object.fromEntries(snapshotBaseline(listing)),
  })

  const progress = await readSyncProgress(dir)
  check('baseline read back', progress !== null, progress)
  if (progress !== null) {
    const map = new Map(Object.entries(progress.sessions))
    const syncedOnce = true // the host sets this when a baseline loads

    // Unchanged sessions → nothing stale → no walk on first open.
    const unchanged = staleSessionIds(syncedOnce, map, listing)
    check('restart + unchanged sessions walks nothing', unchanged.length === 0, unchanged)

    // One drifted + one brand-new → only those stale.
    const drifted = [snap('a', 'rev-1-changed'), snap('b', 'rev-2'), snap('c', 'rev-3'), snap('d', 'rev-4')]
    const stale = staleSessionIds(syncedOnce, map, drifted)
    check('restart + drift/new walks only those', stale.length === 2 && stale.includes('a') && stale.includes('d'), stale)

    // A session deleted from persistence drops out; the rest unchanged → fresh.
    const deleted = [snap('b', 'rev-2')]
    const afterDelete = staleSessionIds(syncedOnce, map, deleted)
    check('deleted session alone is fresh', afterDelete.length === 0, afterDelete)
  }

  // --- torn / malformed baseline reads as null (caller falls back to full walk) ---
  await writeFile(join(dir, 'sync-progress.json'), '{ "syncedAt": "not-a-number", "sessions": {} }', 'utf8')
  check('malformed baseline reads null', (await readSyncProgress(dir)) === null)

  // --- empty dir → null ---
  const empty = await mkdtemp(join(tmpdir(), 'tokbook-baseline-empty-'))
  try {
    check('missing baseline reads null', (await readSyncProgress(empty)) === null)
  } finally {
    await rm(empty, { recursive: true, force: true })
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`${failures} baseline self-check(s) FAILED`)
  process.exit(1)
}
console.log('all baseline self-checks passed')
