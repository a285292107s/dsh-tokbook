import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

export function defaultDataDir(configPath: string | undefined): string {
  if (configPath !== undefined && configPath !== '') return configPath
  const envHome = process.env.DSH_HOME
  const base = typeof envHome === 'string' && envHome.trim() !== ''
    ? envHome
    : join(homedir(), '.dsh')
  return join(base, 'tokbook')
}

export const OWNER_FILE = 'owner.json'

interface OwnerMarker {
  pid: number
  startedAt: number
}

function pidIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export async function warnIfForeignOwner(
  dir: string,
  logger: { warn?(...args: unknown[]): void; info?(...args: unknown[]): void } = console,
): Promise<boolean> {
  try {
    const text = await readFile(join(dir, OWNER_FILE), 'utf8')
    const marker: unknown = JSON.parse(text)
    if (typeof marker !== 'object' || marker === null) return false
    const { pid, startedAt } = marker as OwnerMarker
    if (typeof pid !== 'number' || pid === process.pid) return false
    if (pidIsAlive(pid)) {
      logger.warn?.(
        `[tokbook] data directory ${dir} is owned by live process ${String(pid)} (started ${new Date(startedAt ?? 0).toISOString()}). ` +
        'Two hosts writing one ledger directory are not supported: rollup/cache/refile races can corrupt derived stats. ' +
        'Point the second instance at its own `path`, or stop the first.',
      )
      return true
    }
    logger.info?.(`[tokbook] data directory ${dir} has a stale owner marker (pid ${String(pid)} is gone); this instance takes over.`)
    return false
  } catch {
    return false
  }
}

export async function writeOwnerMarker(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, OWNER_FILE), JSON.stringify({ pid: process.pid, startedAt: Date.now() } satisfies OwnerMarker), 'utf8')
  } catch {
  }
}
