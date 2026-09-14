/**
 * 读路径不被权威同步拖住的回归自检（2026-09-15「通道用量 / 价格表打开要加载半天」）。
 *
 * 背景：新鲜度探针在**当前会话**上永远报 stale（它每来一条消息就换一次 revision），
 * 而权威 walk 会把该会话的**整份日志**重读重折叠——实测单份会话日志可达 8.6 MB
 * （压缩）/ 数万事件，于是「打开概览 / 通道用量 / 价格表」变成秒级等待，而账本本身
 * 只要 11–77 ms。行其实早已由 `session/event` 实时 hook 记进账本：读路径要的是
 * 「账本当前内容」，不是「此刻再走一遍历史」。
 *
 * 本自检用一个 `inspect()` 很慢（400 ms）的 persistence 桩钉住四条不变量：
 *   1. 三个读（overview / usageByRange / pricingView）在后台 walk 还没结束时就已经返回；
 *   2. walk 仍然会真的跑完 —— 自愈路径不能因为这条修复被弄丢；
 *   3. 已有基线但 revision 漂移的会话受节流，不会被每次读重复重读；
 *   4. 没有任何基线签名的会话不受节流（首次回填 / 全新会话要立刻同步）；
 *   5. 例外只有冷账本（一个日文件都没有）：那时读路径**等**一轮，否则会把
 *      「还没回填完」显示成「没有记录」。
 *
 * Run: node --experimental-strip-types scripts/selfcheck-readpath.ts
 *
 * @module dsh-tokbook/selfcheck-readpath
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import TokenUsageBook from '../src/index.ts'
import { markInitialized } from '../src/sync-state.ts'
import { UsageLog } from '../src/usage-log.ts'
import type { UsageRecord } from '../src/types.ts'

let failures = 0
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ' — ' + JSON.stringify(detail)}`)
  if (!ok) failures += 1
}

const SLOW_MS = 400
/** 读路径的预算：远小于 walk 的 400 ms，又足够容纳一次冷读（实测 11–77 ms）。 */
const FAST_BUDGET_MS = 150
const quiet = { error: () => {}, info: () => {}, warn: () => {} }

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** 挂一个 host 服务实例，配一个可调 revision、inspect 很慢的持久化桩。 */
function mount(dir: string, slowMs: number): {
  book: TokenUsageBook
  /** 等 `sessionPersistence` 缝接上：`ctx.inject` 在构造之后才回调，接上之前的读走
   *  「没有持久化」的早退分支（不调度、也不等待），那是另一条语义。 */
  ready: () => Promise<void>
  inspects: () => number
  drift: (revision: string) => void
  addSession: (id: string, revision: string) => void
  dispose: () => Promise<void>
} {
  const sessions = new Map<string, string>([['s1', 'rev-1']])
  let inspects = 0
  const ctx = new Context()
  ctx.provide('sessionPersistence', {
    listSnapshots: async () => [...sessions].map(([id, revision]) => ({ header: { id, cwd: 'C:/work' }, revision })),
    inspect: async (id: string) => {
      inspects += 1
      await sleep(slowMs)
      // 空事件日志：这正是真实情况——当前会话的行已由实时 hook 记下，
      // walk 重读整份日志后新增 0 行，但读的代价已经付掉了。
      return { meta: { id }, events: [] }
    },
  })
  const book = new TokenUsageBook(ctx, { path: dir })
  return {
    book,
    ready: async () => {
      const wired = (): boolean => (book as unknown as { persistence?: unknown }).persistence !== undefined
      for (let i = 0; i < 100 && !wired(); i++) await sleep(5)
      if (!wired()) throw new Error('sessionPersistence seam never wired')
    },
    inspects: () => inspects,
    drift: (revision) => { sessions.set('s1', revision) },
    addSession: (id, revision) => { sessions.set(id, revision) },
    dispose: async () => { await ctx.fiber.dispose() },
  }
}

/** 预置 initialized.marker：跳过启动时的一次性回填，让读路径的调度成为唯一变量。 */
async function seedDir(sessionsHaveRows: boolean): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-readpath-'))
  await markInitialized(dir)
  if (sessionsHaveRows) {
    const log = new UsageLog(dir, quiet)
    const record: UsageRecord = {
      requestId: 'req-1',
      time: Date.now(),
      sessionId: 's1',
      model: 'deepseek-chat',
      usage: { inputTokens: 100, outputTokens: 20 },
    }
    await log.record(record)
    await log.flush()
  }
  return dir
}

async function elapsed<T>(run: () => Promise<T>): Promise<number> {
  const started = process.hrtime.bigint()
  await run()
  return Number(process.hrtime.bigint() - started) / 1e6
}

// ── 1/2/4. 有行的账本：读不等 walk；walk 仍会跑完；无基线签名的会话不节流 ──────────
{
  const dir = await seedDir(true)
  const host = mount(dir, SLOW_MS)
  try {
    await host.ready()
    const usageMs = await elapsed(() => host.book.usageByRange('last7'))
    check('usageByRange returns while the walk is still running', usageMs < FAST_BUDGET_MS, { usageMs: Math.round(usageMs) })
    const pricingMs = await elapsed(() => host.book.pricingView())
    check('pricingView returns while the walk is still running', pricingMs < FAST_BUDGET_MS, { pricingMs: Math.round(pricingMs) })
    const overviewMs = await elapsed(() => host.book.overview())
    check('overview returns while the walk is still running', overviewMs < FAST_BUDGET_MS, { overviewMs: Math.round(overviewMs) })

    await sleep(SLOW_MS + 250)
    check('the walk still completes (self-healing path intact)', host.inspects() === 1, { inspects: host.inspects() })
  } finally {
    await host.dispose()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

// ── 3. 漂移但已有基线 → 节流（每 15 s 至多一轮），读依旧快 ────────────────────────
{
  const dir = await seedDir(true)
  const host = mount(dir, 20)
  try {
    await host.ready()
    // 第一次读：没有基线签名 → 不受节流，walk 跑完并写下基线。
    await host.book.usageByRange('last7')
    await sleep(SLOW_MS)
    const first = host.inspects()
    check('the first read walked the unsynced session', first === 1, { inspects: first })

    host.drift('rev-2')
    const reads = await elapsed(async () => {
      await host.book.usageByRange('last7')
      await host.book.pricingView()
      await host.book.overview()
    })
    check('three reads after a drift stay fast', reads < FAST_BUDGET_MS * 3, { reads: Math.round(reads) })
    await sleep(150)
    check('a drifted session is throttled, not re-walked per read', host.inspects() === first, { inspects: host.inspects(), first })
  } finally {
    await host.dispose()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

// ── 4. 全新会话（没有基线签名）不受节流：该立刻同步 ───────────────────────────────
{
  const dir = await seedDir(true)
  const host = mount(dir, 20)
  try {
    await host.ready()
    // 先让 s1 走一轮并写下基线，使 s1 之后的漂移落在节流窗口内。
    await host.book.usageByRange('last7')
    await sleep(SLOW_MS)
    const before = host.inspects()
    host.drift('rev-2')            // 漂移会话本身会被节流
    host.addSession('s2', 'new')   // 新会话没有基线签名 → 不受节流
    await host.book.usageByRange('last7')
    await sleep(150)
    check('a never-synced session is walked immediately', host.inspects() > before, { inspects: host.inspects(), before })
  } finally {
    await host.dispose()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

// ── 5. 例外：冷账本（没有日文件）时读路径等一轮 ───────────────────────────────────
{
  const dir = await seedDir(false)
  const host = mount(dir, SLOW_MS)
  try {
    await host.ready()
    const ms = await elapsed(() => host.book.overview())
    check('a cold ledger still waits for the backfill', ms >= SLOW_MS, { ms: Math.round(ms) })
  } finally {
    await host.dispose()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

if (failures > 0) {
  console.error(`${failures} read-path self-check(s) FAILED`)
  process.exit(1)
}
console.log('all read-path self-checks passed')
