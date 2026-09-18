/**
 * 订阅额度 tab 的持久最近已知快照。
 *
 * 官方额度拉取打的是 provider 自己的账户 API（数秒网络延迟），但返回的数字
 * 按分钟到小时的尺度变化。tab 因此应立即渲染**最近已知**的官方数字，并在
 * 后台刷新，而不是让整轮往返都用骨架屏把卡空白化。这要求最近已知卡跨进程
 * 重启存活，故每次成功的（'ok'）官方拉取后宿主把卡持久化到这里——数据目录中
 * 每 provider 一个小 JSON 文件（`quota-<provider>.json`）。
 *
 * 读严格：缺失、撕裂或畸形的文件读作 null，坏写入永远不能充当假的「最近
 * 已知」。只写 'ok' 卡：`unconfigured`/`error` 卡重推很廉价，且不得遮住稍后
 * 的恢复（把一次瞬时网络失败持久化成「最近已知」会立刻永远渲染）。
 */

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { QuotaCard } from './types.ts'

/** 一个 provider 额度快照的磁盘形状。 */
export interface QuotaSnapshotFile {
  /** 官方拉取产出该卡的时刻，epoch ms。 */
  savedAt: number
  card: QuotaCard
}

function snapshotFileName(provider: string): string {
  return `quota-${provider}.json`
}

/** 解析后的快照是否可信：只接受带合理时间戳的 'ok' 卡。其余读作缺席。 */
function isSnapshotFile(value: unknown): value is QuotaSnapshotFile {
  if (typeof value !== 'object' || value === null) return false
  const raw = value as Record<string, unknown>
  if (typeof raw.savedAt !== 'number' || !Number.isFinite(raw.savedAt)) return false
  const card = raw.card as Record<string, unknown> | undefined
  if (typeof card !== 'object' || card === null) return false
  return card.state === 'ok'
}

/** 读一个 provider 最近已知的 'ok' 额度卡。缺失/撕裂/畸形快照读作 null——
 *  绝非部分或非 'ok' 卡。 */
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

/** 原子持久化一个 provider 的额度卡（临时 + rename；先 unlink 目标——
 *  Windows 覆盖 rename 间歇失败）。调用方只持久化 'ok' 卡；快照写失败非致命，
 *  由调用方记日志。 */
export async function writeQuotaSnapshot(dir: string, provider: string, card: QuotaCard): Promise<void> {
  const target = join(dir, snapshotFileName(provider))
  const tmp = join(dir, `${snapshotFileName(provider)}.tmp`)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(tmp, JSON.stringify({ savedAt: Date.now(), card } satisfies QuotaSnapshotFile), 'utf8')
  await unlink(target).catch(() => undefined)
  await rename(tmp, target)
}
