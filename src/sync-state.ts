import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const MARKER = 'initialized.marker'
const PROGRESS_FILE = 'sync-progress.json'
const PROGRESS_TMP = 'sync-progress.json.tmp'

export async function isInitialized(dir: string): Promise<boolean> {
  try {
    await readFile(join(dir, MARKER), 'utf8')
    return true
  } catch {
    return false
  }
}

export async function markInitialized(dir: string): Promise<void> {
  const target = join(dir, MARKER)
  const tmp = join(dir, `${MARKER}.tmp`)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(tmp, `${Date.now()}\n`, 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}

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

export async function writeSyncProgress(dir: string, progress: SyncProgressFile): Promise<void> {
  const target = join(dir, PROGRESS_FILE)
  const tmp = join(dir, PROGRESS_TMP)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(tmp, JSON.stringify(progress), 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}
