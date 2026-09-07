/**
 * Durable last-known quota snapshots for the 订阅额度 tab.
 *
 * The official quota fetch hits a provider's own account API (seconds of
 * network latency), but the number it returns changes on a minutes-to-hours
 * scale. The tab should therefore render the *last known* official numbers
 * immediately and freshen them in the background, rather than blank the card
 * behind a skeleton for the whole round trip. That needs the last-known card
 * to survive process restarts, so after every successful ('ok') official
 * fetch the host persists the card here — one small JSON file per provider
 * (`quota-<provider>.json`) in the data directory.
 *
 * Reads are strict: a missing, torn, or malformed file reads as null, so a
 * broken write can never serve as a fake "last known" value. Only 'ok' cards
 * are ever written: an `unconfigured`/`error` card is cheap to re-derive and
 * must not mask a later recovery (a transient network failure persisted as
 * "last known" would render instantly forever).
 *
 * @module dsh-tokbook/quota-cache
 */

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { QuotaCard } from './types.ts'

/** On-disk shape of one provider's quota snapshot. */
export interface QuotaSnapshotFile {
  /** When the official fetch produced this card, epoch ms. */
  savedAt: number
  card: QuotaCard
}

function snapshotFileName(provider: string): string {
  return `quota-${provider}.json`
}

/** Whether a parsed snapshot is trustworthy: only 'ok' cards with a sane
 * timestamp are accepted. Anything else reads as absent. */
function isSnapshotFile(value: unknown): value is QuotaSnapshotFile {
  if (typeof value !== 'object' || value === null) return false
  const raw = value as Record<string, unknown>
  if (typeof raw.savedAt !== 'number' || !Number.isFinite(raw.savedAt)) return false
  const card = raw.card as Record<string, unknown> | undefined
  if (typeof card !== 'object' || card === null) return false
  return card.state === 'ok'
}

/** Read a provider's last-known 'ok' quota card. A missing/torn/malformed
 * snapshot reads as null — never a partial or non-'ok' card. */
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

/** Persist a provider's quota card atomically (temp + rename; the target is
 * unlinked first because Windows rename-over-existing fails intermittently).
 * Callers persist 'ok' cards only; a snapshot write failure is non-fatal and
 * is logged by the caller. */
export async function writeQuotaSnapshot(dir: string, provider: string, card: QuotaCard): Promise<void> {
  const target = join(dir, snapshotFileName(provider))
  const tmp = join(dir, `${snapshotFileName(provider)}.tmp`)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(tmp, JSON.stringify({ savedAt: Date.now(), card } satisfies QuotaSnapshotFile), 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}
