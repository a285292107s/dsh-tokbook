import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import type { QuotaCard } from './types.ts'

export interface QuotaSnapshotFile {
  savedAt: number
  card: QuotaCard
}

function snapshotFileName(provider: string): string {
  return `quota-${provider}.json`
}

function isSnapshotFile(value: unknown): value is QuotaSnapshotFile {
  if (typeof value !== 'object' || value === null) return false
  const raw = value as Record<string, unknown>
  if (typeof raw.savedAt !== 'number' || !Number.isFinite(raw.savedAt)) return false
  const card = raw.card as Record<string, unknown> | undefined
  if (typeof card !== 'object' || card === null) return false
  return card.state === 'ok' && Array.isArray(card.windows)
}

export async function readQuotaSnapshot(dir: string, provider: string): Promise<QuotaCard | null> {
  let text: string
  try {
    text = await readFile(join(dir, snapshotFileName(provider)), 'utf8')
  } catch {
    return null
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  return isSnapshotFile(value) ? value.card : null
}

const writeChains = new Map<string, Promise<void>>()

async function writeQuotaSnapshotFile(dir: string, provider: string, card: QuotaCard): Promise<void> {
  const target = join(dir, snapshotFileName(provider))
  const tmp = `${target}.${String(process.pid)}.${randomUUID()}.tmp`
  await mkdir(dirname(target), { recursive: true })
  try {
    await writeFile(tmp, JSON.stringify({ savedAt: Date.now(), card } satisfies QuotaSnapshotFile), 'utf8')
    await unlink(target).catch(() => undefined)
    await rename(tmp, target)
  } catch (error) {
    await unlink(tmp).catch(() => undefined)
    throw error
  }
}

export function writeQuotaSnapshot(dir: string, provider: string, card: QuotaCard): Promise<void> {
  const target = join(dir, snapshotFileName(provider))
  const previous = writeChains.get(target) ?? Promise.resolve()
  const next = previous.then(() => writeQuotaSnapshotFile(dir, provider, card))
  const settled = next.then(() => undefined, () => undefined)
  writeChains.set(target, settled)
  void settled.then(() => {
    if (writeChains.get(target) === settled) writeChains.delete(target)
  })
  return next
}
