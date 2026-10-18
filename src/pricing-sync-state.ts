import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { dayKeyOf } from './price-format.ts'

export const PRICING_SYNC_STATE_FILE = 'models-dev-sync.json'

export interface PricingSyncState {
  lastSyncDay: string | null
  lastAttemptAt: number | null
  lastError: string | null
  nextAttemptAt: number | null
  lastAdded: number | null
}

const EMPTY: PricingSyncState = {
  lastSyncDay: null, lastAttemptAt: null, lastError: null, nextAttemptAt: null, lastAdded: null,
}

function isState(value: unknown): value is PricingSyncState {
  if (typeof value !== 'object' || value === null) return false
  const raw = value as Record<string, unknown>
  return (raw.lastSyncDay === null || typeof raw.lastSyncDay === 'string')
    && (raw.lastError === null || typeof raw.lastError === 'string')
    && (raw.lastAttemptAt === undefined || raw.lastAttemptAt === null || typeof raw.lastAttemptAt === 'number')
    && (raw.nextAttemptAt === undefined || raw.nextAttemptAt === null || typeof raw.nextAttemptAt === 'number')
    && (raw.lastAdded === undefined || raw.lastAdded === null || typeof raw.lastAdded === 'number')
}

export const PRICING_SYNC_RETRY_MS = 60 * 60 * 1000

export function shouldSyncNow(state: PricingSyncState, nowMs: number, force: boolean): boolean {
  if (force) return true
  if (state.lastSyncDay !== null && state.lastSyncDay === dayKeyOf(nowMs)) return false
  return state.nextAttemptAt === null || nowMs >= state.nextAttemptAt
}

export async function readPricingSyncState(dir: string): Promise<PricingSyncState> {
  let text: string
  try {
    text = await readFile(join(dir, PRICING_SYNC_STATE_FILE), 'utf8')
  } catch {
    return EMPTY
  }
  try {
    const value: unknown = JSON.parse(text)
    if (!isState(value)) return EMPTY
    return {
      lastSyncDay: value.lastSyncDay,
      lastError: value.lastError,
      lastAttemptAt: value.lastAttemptAt ?? null,
      nextAttemptAt: value.nextAttemptAt ?? null,
      lastAdded: value.lastAdded ?? null,
    }
  } catch {
    return EMPTY
  }
}

async function writeStateFile(dir: string, state: PricingSyncState): Promise<void> {
  const target = join(dir, PRICING_SYNC_STATE_FILE)
  const tmp = `${target}.${String(process.pid)}.${randomUUID()}.tmp`
  await mkdir(dirname(target), { recursive: true })
  try {
    await writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
    await unlink(target).catch(() => undefined)
    await rename(tmp, target)
  } catch (error) {
    await unlink(tmp).catch(() => undefined)
    throw error
  }
}

export async function writePricingSyncState(dir: string, state: PricingSyncState): Promise<void> {
  await writeStateFile(dir, state)
}
