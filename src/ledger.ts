/**
 * Data-directory resolution for dsh-tokbook.
 *
 * The durable per-day token ledger lives under the resolved data directory
 * (default `$DSH_HOME/tokbook`, else `~/.dsh/tokbook`). The dir can be
 * overridden through the `path` config key so a user can point the book at an
 * existing `dsh-token-usage`-style store.
 *
 * @module dsh-tokbook/ledger
 */

import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

/** Resolve the data directory: an explicit `path` wins; otherwise
 * `$DSH_HOME/tokbook` (a blank `$DSH_HOME` counts as unset), else
 * `~/.dsh/tokbook`. */
export function defaultDataDir(configPath: string | undefined): string {
  if (configPath !== undefined && configPath !== '') return configPath
  const envHome = process.env.DSH_HOME
  const base = typeof envHome === 'string' && envHome.trim() !== ''
    ? envHome
    : join(homedir(), '.dsh')
  return join(base, 'tokbook')
}

/** The owner marker file inside a data directory. Its presence records which
 * host process last wrote the ledger; a second live process pointing at the
 * same directory is warned on startup (see {@link warnIfForeignOwner}). */
export const OWNER_FILE = 'owner.json'

interface OwnerMarker {
  pid: number
  startedAt: number
}

/** Whether a pid is a live process on this host. Best-effort: any failure
 * reading the process (permission, exotic platform) reads as "not alive". */
function pidIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // ESRCH = no such process. Anything else (EPERM = exists but not ours)
    // still means the process IS alive.
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Startup guard for the "one data directory, one writing process" assumption.
 * Reads the directory's owner marker; when it names a LIVE foreign pid, logs a
 * warning that two hosts are writing the same ledger (JSONL appends would be
 * safe per-row, but rollup/cache/refile races are not). A marker from a dead
 * process (a crash) is stale and only logged as info. Never throws.
 */
export async function warnIfForeignOwner(
  dir: string,
  logger: { warn?(...args: unknown[]): void; info?(...args: unknown[]): void } = console,
): Promise<void> {
  try {
    const text = await readFile(join(dir, OWNER_FILE), 'utf8')
    const marker: unknown = JSON.parse(text)
    if (typeof marker !== 'object' || marker === null) return
    const { pid, startedAt } = marker as OwnerMarker
    if (typeof pid !== 'number' || pid === process.pid) return
    if (pidIsAlive(pid)) {
      logger.warn?.(
        `[tokbook] data directory ${dir} is owned by live process ${String(pid)} (started ${new Date(startedAt ?? 0).toISOString()}). ` +
        'Two hosts writing one ledger directory are not supported: rollup/cache/refile races can corrupt derived stats. ' +
        'Point the second instance at its own `path`, or stop the first.',
      )
    } else {
      logger.info?.(`[tokbook] data directory ${dir} has a stale owner marker (pid ${String(pid)} is gone); this instance takes over.`)
    }
  } catch {
    // No marker (first run) or unreadable: nothing to warn about.
  }
}

/** Write this process's owner marker into the data directory, best-effort.
 * Failure is never fatal (the guard is advisory). */
export async function writeOwnerMarker(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, OWNER_FILE), JSON.stringify({ pid: process.pid, startedAt: Date.now() } satisfies OwnerMarker), 'utf8')
  } catch {
    // Advisory only.
  }
}
