/**
 * First-run marker and the persisted sync baseline of the token-book.
 *
 * The first-run marker (`initialized.marker`) gates the one-shot automatic
 * history backfill exactly like before: it runs once per data directory
 * (when the marker is absent), then persists the marker so later startups
 * skip the walk. A crash between the sync and the marker write leaves the
 * marker absent, so the next startup re-runs the sync — a no-op thanks to
 * request-id dedupe.
 *
 * The sync baseline (`sync-progress.json`) is the cross-process memory of the
 * host's in-memory `syncedBySession` map: which persisted session had been
 * folded through which change token (`revision`) at the last authoritative
 * sync. Persisting it lets a restarted process trust the previous run's
 * signature instead of re-walking every session log on the first read — the
 * freshness probe then only re-walks sessions whose revision drifted since.
 * The baseline is written only AFTER a successful sync, so a signature never
 * outruns the ledger contents it covers; a session that changed while the
 * process was down carries an older signature and is re-walked (idempotent
 * via request-id dedupe). A missing, torn, or malformed baseline reads as
 * null and the caller falls back to the conservative full walk, then rewrites
 * a fresh baseline.
 *
 * @module dsh-tokbook/sync-state
 */

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const MARKER = 'initialized.marker'
const PROGRESS_FILE = 'sync-progress.json'
const PROGRESS_TMP = 'sync-progress.json.tmp'

/** Whether the automatic history sync has already run for this directory. */
export async function isInitialized(dir: string): Promise<boolean> {
  try {
    await readFile(join(dir, MARKER), 'utf8')
    return true
  } catch {
    return false
  }
}

/** Persist the marker (atomically: temp + rename; the target is unlinked
 * first because Windows rename-over-existing fails intermittently). */
export async function markInitialized(dir: string): Promise<void> {
  const target = join(dir, MARKER)
  const tmp = join(dir, `${MARKER}.tmp`)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(tmp, `${Date.now()}\n`, 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}

/** On-disk sync baseline: per-session revision signatures recorded at the
 * last successful authoritative sync. `syncedAt` is informational (debugging,
 * data-status); `sessions` maps a persisted session id to the opaque change
 * token (`revision`) the snapshot listing reported when that session's log
 * was last folded into the ledger. */
export interface SyncProgressFile {
  syncedAt: number
  sessions: Record<string, string>
}

function isProgressFile(value: unknown): value is SyncProgressFile {
  if (typeof value !== 'object' || value === null) return false
  const raw = value as Record<string, unknown>
  if (typeof raw.syncedAt !== 'number' || !Number.isFinite(raw.syncedAt)) return false
  const sessions = raw.sessions
  if (typeof sessions !== 'object' || sessions === null || Array.isArray(sessions)) return false
  return Object.entries(sessions as Record<string, unknown>).every(([id, rev]) =>
    id !== '' && typeof rev === 'string' && rev !== '')
}

/**
 * Read the persisted sync baseline. A missing, malformed, or partially
 * unusable file reads as null — never a partial map, so a torn write can
 * never make the probe trust signatures for only some sessions. A null
 * baseline means "no trustworthy cross-process memory": the caller walks
 * everything once (idempotent) and then rewrites a fresh baseline.
 */
export async function readSyncProgress(dir: string): Promise<SyncProgressFile | null> {
  let text: string
  try {
    text = await readFile(join(dir, PROGRESS_FILE), 'utf8')
  } catch {
    return null
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  return isProgressFile(value) ? value : null
}

/** Persist the sync baseline atomically (temp + rename; the target is
 * unlinked first for Windows rename-over-existing). */
export async function writeSyncProgress(dir: string, progress: SyncProgressFile): Promise<void> {
  const target = join(dir, PROGRESS_FILE)
  const tmp = join(dir, PROGRESS_TMP)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(tmp, JSON.stringify(progress), 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}
