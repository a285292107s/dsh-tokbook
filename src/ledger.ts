/**
 * 数据目录解析与「一目录一写进程」属主标记（所有权口径见 docs/CONTRACTS.md §3）。
 */

import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

/** 空白 `$DSH_HOME` 视为未设。 */
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

/** 尽力而为：畸形 pid 与 EPERM 之外的探测失败读作「不存活」（EPERM 见下方注释）。从不抛。 */
function pidIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // ESRCH = 无此进程。其他（EPERM = 存在但不是我们的）仍意味着进程存活。
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** 外来存活 pid → 告警（rollup/cache/refile 会竞态；JSONL 逐行追加本身安全）。从不抛。 */
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
    // 无标记（首次运行）或不可读：无可警告。
  }
}

/** 把本进程的属主标记写入数据目录，尽力而为。失败从不致命（守卫只是建议性的）。 */
export async function writeOwnerMarker(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, OWNER_FILE), JSON.stringify({ pid: process.pid, startedAt: Date.now() } satisfies OwnerMarker), 'utf8')
  } catch {
    // 仅建议性。
  }
}
