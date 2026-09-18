/**
 * token-book 的按工作区聚合——概览「按工作区」节背后的纯数学。
 *
 * 账本行只命名其会话，因此归属是对 workspace registry 与会话 header `cwd`
 * 的**读时 join**。没有 workspace 认领的记录折进「未归属」行，使本节始终
 * 加总回账本自身的 totals。
 */

import { resolve as resolvePath } from 'node:path'
import type {
  BillingMap, PricingTable, UsageRecord, WorkspaceUsageRow,
} from './types.ts'
import { totalsTokens } from './types.ts'
import type { RateResolver } from './stats.ts'
import { attachCosts, summarizeRecords } from './stats.ts'

/** 无人认领的兜底行的行 id。 */
export const UNATTRIBUTED_ID = ''

/** 兜底行的展示标题。 */
export const UNATTRIBUTED_TITLE = '未归属'

/** 本聚合所需的 workspace 事实，由宿主从 workspace registry 读出。保持
 *  结构性而不是 import DSH 的 `Workspace`（宿主包只针对
 *  `@deepseek-ai/cordis` 编译）。 */
export interface WorkspaceRef {
  id: string
  title: string
  /** 规范目录路径（注册目录的 `fs.realpath`）。 */
  path: string
}

/**
 * 目录路径的比较键。会话 header 带着创建时的 cwd，registry 带着解析后的
 * 路径：两者指同一目录但不必字节相同（分隔符写法、尾斜杠、`..`，以及
 * Windows 上盘符/文件夹大小写）。`resolve` 归一写法；大小写折叠只在文件系统
 * 大小写不敏感时应用——在 POSIX 上折叠会把两个真正不同的项目合并。
 */
export function pathKey(path: string): string {
  const normalized = resolvePath(path)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

/**
 * 把每条记录折入其工作区行，最近用过的在前。
 *
 * `cwdOf` 是宿主的会话 header 查找（实时或已持久化）。没有 provider usage 的
 * 记录仍计入请求；失败行只计入 `failures` 维度，与概览自身的 totals 一致。
 * 从未计费过请求的工作区（只有失败行）跳过，而不是显示为零行。
 */
export function workspaceRows(
  records: readonly UsageRecord[],
  workspaces: readonly WorkspaceRef[],
  cwdOf: (sessionId: string) => string | undefined,
  pricing: PricingTable,
  resolveRate: RateResolver,
  billing: BillingMap = {},
): WorkspaceUsageRow[] {
  const byPath = new Map<string, WorkspaceRef>()
  const byId = new Map<string, WorkspaceRef>()
  for (const workspace of workspaces) {
    byId.set(workspace.id, workspace)
    if (workspace.path !== '') byPath.set(pathKey(workspace.path), workspace)
  }
  // sessionId → 其 workspace（未归属为 null）：一个会话贡献多条记录，但只有
  // 一个 header。
  const owner = new Map<string, WorkspaceRef | null>()
  const groups = new Map<string, UsageRecord[]>()
  const lastAt = new Map<string, number>()
  for (const record of records) {
    let hit = owner.get(record.sessionId)
    if (hit === undefined) {
      const cwd = cwdOf(record.sessionId)
      hit = cwd === undefined || cwd === '' ? null : byPath.get(pathKey(cwd)) ?? null
      owner.set(record.sessionId, hit)
    }
    const key = hit?.id ?? UNATTRIBUTED_ID
    const group = groups.get(key)
    if (group === undefined) groups.set(key, [record])
    else group.push(record)
    const newest = lastAt.get(key)
    if (newest === undefined || record.time > newest) lastAt.set(key, record.time)
  }
  const named: WorkspaceUsageRow[] = []
  let unattributed: WorkspaceUsageRow | null = null
  for (const [key, group] of groups) {
    const summary = summarizeRecords(group, resolveRate)
    if (summary.total.requests === 0) continue
    const workspace = byId.get(key)
    // `dataDir` 只是经 CostedSummary 回传；没有行渲染它。
    const costed = attachCosts({ dataDir: '', ...summary }, pricing, billing)
    const row: WorkspaceUsageRow = {
      id: key,
      title: workspace?.title ?? UNATTRIBUTED_TITLE,
      path: workspace?.path ?? '',
      totals: summary.total,
      tokens: totalsTokens(summary.total),
      spend: costed.spend,
      subscriptionValue: costed.subscriptionValue,
      lastAt: lastAt.get(key) ?? 0,
    }
    if (key === UNATTRIBUTED_ID) unattributed = row
    else named.push(row)
  }
  named.sort((left, right) =>
    right.lastAt - left.lastAt || right.tokens - left.tokens
    || left.title.localeCompare(right.title))
  return unattributed === null ? named : [...named, unattributed]
}
