/**
 * 词元账本的首次启动 marker 与持久化同步基线。
 *
 * 首次启动 marker（`initialized.marker`）门控一次性自动历史回填。同步基线
 * （`sync-progress.json`）是 host 内存 `syncedBySession` map 的跨进程记忆：
 * 上次权威同步时各持久化会话折叠到了哪个变更 token。基线只在同步成功之后写，
 * 因此签名绝不会跑在它所覆盖的账本内容之前。缺失、撕裂或畸形的基线读作 null，
 * 调用方回落到保守全量走，再重写一份新基线。
 */

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const MARKER = 'initialized.marker'
const PROGRESS_FILE = 'sync-progress.json'
const PROGRESS_TMP = 'sync-progress.json.tmp'

/** 本目录是否已跑过自动历史同步。 */
export async function isInitialized(dir: string): Promise<boolean> {
  try {
    await readFile(join(dir, MARKER), 'utf8')
    return true
  } catch {
    return false
  }
}

/** 持久化 marker（原子：temp + rename；目标先 unlink，因为 Windows 上
 *  rename-over-existing 会间歇失败）。 */
export async function markInitialized(dir: string): Promise<void> {
  const target = join(dir, MARKER)
  const tmp = join(dir, `${MARKER}.tmp`)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(tmp, `${Date.now()}\n`, 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}

/** 落盘同步基线：上次成功权威同步时记下的各会话 revision 签名。 */
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
 * 读持久化同步基线。缺失、畸形或部分不可用的文件读作 null——绝不返回
 * 部分 map，使撕裂写永远无法让探针只信任部分会话的签名。
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

/** 原子持久化同步基线（temp + rename，unlink 在前——同 {@link markInitialized}）。 */
export async function writeSyncProgress(dir: string, progress: SyncProgressFile): Promise<void> {
  const target = join(dir, PROGRESS_FILE)
  const tmp = join(dir, PROGRESS_TMP)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(tmp, JSON.stringify(progress), 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}
