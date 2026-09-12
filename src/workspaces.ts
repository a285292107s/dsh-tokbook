/**
 * Per-workspace aggregation of the token-book: the pure math behind the
 * overview's 按工作区 section.
 *
 * A ledger row names only its session, so "which project did this cost belong
 * to" is a READ-TIME join against two live host sources — the workspace
 * registry (id / title / canonical path) and each stored session's header
 * `cwd`. A record joins the workspace whose path equals its session's `cwd`:
 * that is exactly the membership rule the registry itself applies, and it is
 * deliberately wider than the registry's manually owned session account — a
 * session that was never attached (a subagent child, a session resumed from
 * elsewhere) still carries the directory it was created in, and its usage
 * belongs to that project.
 *
 * Records no workspace claims — a session with no `cwd`, or a directory that
 * is not a registered workspace — fold into one 未归属 row, so the section
 * always adds back up to the ledger's own totals. Each partition then runs the
 * regular summary + cost layer (the overview's exact math, so both the token
 * counts and the ¥ figures agree with every other surface); this module owns
 * no arithmetic of its own.
 *
 * @module dsh-tokbook/workspaces
 */

import { resolve as resolvePath } from 'node:path'
import type {
  BillingMap, PricingTable, UsageRecord, WorkspaceUsageRow,
} from './types.ts'
import { totalsTokens } from './types.ts'
import type { RateResolver } from './stats.ts'
import { attachCosts, summarizeRecords } from './stats.ts'

/** Row id of the catch-all row no workspace claims. */
export const UNATTRIBUTED_ID = ''

/** Display title of the catch-all row. */
export const UNATTRIBUTED_TITLE = '未归属'

/** The workspace facts this aggregation needs, as the host reads them off the
 *  workspace registry. Kept structural rather than importing DSH's `Workspace`
 *  (the host package compiles against `@deepseek-ai/cordis` only). */
export interface WorkspaceRef {
  id: string
  title: string
  /** Canonical directory path (`fs.realpath` of the registered directory). */
  path: string
}

/**
 * Comparison key of a directory path. Session headers carry the cwd they were
 * created with, the registry carries a resolved path: the two agree on the
 * same directory but not necessarily byte-for-byte (separator spelling,
 * trailing slash, `..`, and on Windows the drive/folder case). `resolve`
 * normalizes the spelling; the case fold applies only where the filesystem is
 * case-insensitive, because folding on POSIX would merge two genuinely
 * different projects. Anything the keys still fail to match stays 未归属 —
 * never silently billed to a neighbouring project.
 */
export function pathKey(path: string): string {
  const normalized = resolvePath(path)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

/**
 * Fold every record into its workspace row, most recently used first.
 *
 * `cwdOf` is the host's session-header lookup (live or persisted). A record
 * without provider usage still counts a request; a failure row counts only the
 * `failures` dimension, exactly as the overview's own totals do. A workspace
 * that never billed a request (failure rows only) is skipped rather than shown
 * as a zero row — the rule the provider cards already apply. The single
 * 未归属 row closes the list: it is a reconciliation line, not a project, so
 * "most recent first" does not apply to it.
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
  // sessionId → its workspace (or null for 未归属): a session contributes many
  // records but has one header.
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
    // `dataDir` is only echoed through CostedSummary; no row renders it.
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
