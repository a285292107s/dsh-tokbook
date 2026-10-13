/**
 * models.dev 价同步的日节流状态（数据目录中独立的小 JSON 文件）。
 *
 * **不放进 `pricing.json`**：那是整文件替换的文件，client 的 `composePriceBody`
 * 只会写它认识的保留键，混进来的状态会在下一次自动保存时被静默丢掉。
 * 仿 `quota-cache.ts` 的形状：只在自己成功落定时写，读严格。
 */

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

export const PRICING_SYNC_STATE_FILE = 'models-dev-sync.json'

export interface PricingSyncState {
  /** 最近一次**成功**同步的本地日（`YYYY-MM-DD`）；null = 从未成功过。 */
  lastSyncDay: string | null
  /** 最近一次失败的原因（限长），成功同步时清空；给状态行一句人话。 */
  lastError: string | null
}

const EMPTY: PricingSyncState = { lastSyncDay: null, lastError: null }

function isState(value: unknown): value is PricingSyncState {
  if (typeof value !== 'object' || value === null) return false
  const raw = value as Record<string, unknown>
  return (raw.lastSyncDay === null || typeof raw.lastSyncDay === 'string')
    && (raw.lastError === null || typeof raw.lastError === 'string')
}

/** 读状态：缺失 / 撕裂 / 畸形一律读作「从未同步」——最坏结果是多同步一次。 */
export async function readPricingSyncState(dir: string): Promise<PricingSyncState> {
  let text: string
  try {
    text = await readFile(join(dir, PRICING_SYNC_STATE_FILE), 'utf8')
  } catch {
    return EMPTY
  }
  try {
    const value: unknown = JSON.parse(text)
    return isState(value) ? value : EMPTY
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
    // 先 unlink 目标：Windows 覆盖 rename 间歇失败。
    await unlink(target).catch(() => undefined)
    await rename(tmp, target)
  } catch (error) {
    await unlink(tmp).catch(() => undefined)
    throw error
  }
}

/** 原子落盘状态。写失败只由调用方记日志：节流丢失 = 多同步一次，不致命。 */
export async function writePricingSyncState(dir: string, state: PricingSyncState): Promise<void> {
  await writeStateFile(dir, state)
}
