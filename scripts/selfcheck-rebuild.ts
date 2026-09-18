/**
 * 账本不变量自检(纯逻辑 + 真临时目录,不需要 DSH 运行时):
 *
 *  1. **折叠是派生状态**:删掉或弄坏 `rollup.json` 必须能从日文件无损重建,且与「直接全量
 *     聚合」逐字段相等;`schemaVersion` 不符一律读作缺失;用量未知这类计数必须活过折叠往返。
 *  2. **单写者与去重**:去重身份按数据目录共享——同一目录上的第二个 `UsageLog` 立刻去重,
 *     进程重启后也要能从磁盘行**重新推出**去重集;`refileByEventDay()` 把行搬回它事件的日文件、
 *     幂等、绝不丢畸形行。
 *  3. **价格签名**:`pricing.json` 内容一变签名就变,而费率行身份是从价格表推导的,所以签名
 *     不符 → **整份折叠作废**、由日文件按当前表重建(逐日金额与费率行身份一起跟上)。
 *  4. **重启后的同步基线**:载入 `sync-progress.json` 后未变的会话不该被重走,漂移 / 新增的才走;
 *     缺失或残缺的基线读作 null(调用方退回全量走一遍并重写一份)。
 *  5. **派生态自证有效**:往日被补写之后,折叠(逐文件版本)与解析缓存(逐文件版本)都自己作废,
 *     没有调用方需要「记得」;1970 前的 `from` 写进文件后仍是它自己那一段,不塌成托底价。
 *
 * Run: node --experimental-strip-types scripts/selfcheck-rebuild.ts
 *
 * @module dsh-tokbook/selfcheck-rebuild
 */

import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { UsageLog, dayFileNameOf, resetUsageLogState } from '../src/usage-log.ts'
import { serializeRecord } from '../src/usage-record.ts'
import {
  attachCosts, buildSummary, clearRecordCache, readCachedRecords, readRecordsByDayRange, snapshotBaseline,
  staleSessionIds, summarizeRecords, type PersistenceSnapshotLike, type RateResolver,
} from '../src/stats.ts'
import { readSyncProgress, writeSyncProgress } from '../src/sync-state.ts'
import { EARLIEST, rateKeyAt, readPriceFile, writePriceFile } from '../src/pricing.ts'
import type { PricingTable, UsageRecord } from '../src/types.ts'
import { UNPRICED_KEY } from '../src/types.ts'

let failures = 0
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ' — ' + JSON.stringify(detail)}`)
  if (!ok) failures += 1
}

/** Epoch ms of a local calendar date + hour. */
function dayMs(day: string, hour: number): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!, hour).getTime()
}

/** A ledger row: request/compaction/failure kinds + optional usage. */
function rec(
  requestId: string,
  day: string,
  hour: number,
  model: string,
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens?: number },
): UsageRecord {
  return {
    requestId,
    time: dayMs(day, hour),
    sessionId: 's1',
    model,
    ...(usage !== undefined ? { usage } : {}),
  }
}

const quiet = { error: () => {} } as const
const never = () => new Date('2099-01-01T00:00:00')
/** Match the unpriced default resolver `buildSummary`/`summarizeRecords` share, so both agree on rateRows. */
const resolve: RateResolver = () => UNPRICED_KEY

const cleanDir = async (): Promise<string> => mkdtemp(join(tmpdir(), 'tokbook-rebuild-'))

const rowCount = async (dir: string, name: string): Promise<number> => {
  const text = await readFile(join(dir, name), 'utf8').catch(() => '')
  return text === '' ? 0 : text.trim().split('\n').length
}

const fileExists = async (dir: string, name: string): Promise<boolean> =>
  readFile(join(dir, name), 'utf8').then(() => true, () => false)

/** 折叠结果里值得逐字段比对的那几块。 */
const foldKey = (s: { total: unknown; byDay: unknown; byHour: unknown; byModel: unknown; rateRows: unknown }): string =>
  JSON.stringify({ total: s.total, byDay: s.byDay, byHour: s.byHour, byModel: s.byModel, rateRows: s.rateRows })

// ---------------------------------------------------------------------------
// 1. 折叠是派生状态:删掉 / 弄坏 / 旧版本 → 无损重建
// ---------------------------------------------------------------------------
console.log('rollup: 派生状态无损重建')
{
  const dir = await cleanDir()
  try {
    const rows = [
      rec('m1', '2026-01-02', 9, 'deepseek-chat', { inputTokens: 1200, outputTokens: 300, cacheReadTokens: 400 }),
      rec('m2', '2026-01-02', 10, 'deepseek-reasoner', { inputTokens: 900, outputTokens: 200 }),
      rec('m3', '2026-01-03', 11, 'deepseek-chat', { inputTokens: 800, outputTokens: 500 }),
      { ...rec('c1', '2026-01-03', 12, 'deepseek-chat', { inputTokens: 60, outputTokens: 20 }), kind: 'compaction' as const },
      { ...rec('f1', '2026-01-03', 12, 'deepseek-chat'), kind: 'failure' as const, failureCode: 'RATE_LIMIT' },
      // 通道没上报用量的计费调用(中断的请求、没回报用量的 summarize):计次、不计量。
      rec('m4', '2026-01-04', 9, 'deepseek-chat'),
      { ...rec('c2', '2026-01-04', 10, 'deepseek-chat'), kind: 'compaction' as const },
    ]
    const log = new UsageLog(dir, quiet)
    for (const row of rows) await log.record(row)

    // 全部落在冻结的(非「今天」)日文件里;「今天」设成 2099,于是每个文件都是冷的,折叠一次。
    const first = await buildSummary(dir, never, resolve, quiet)
    await rm(join(dir, 'rollup.json'), { force: true })
    const rebuilt = await buildSummary(dir, never, resolve, quiet)
    await writeFile(join(dir, 'rollup.json'), '{ not json', 'utf8')
    const fromCorrupt = await buildSummary(dir, never, resolve, quiet)
    check('删掉或弄坏 rollup.json 都从日文件无损重建,与第一次读逐字段相等',
      await fileExists(dir, 'rollup.json') && foldKey(first) === foldKey(rebuilt) && foldKey(first) === foldKey(fromCorrupt))

    // v1 折叠(没有 schemaVersion,rateRows 与 byModel 也还没有 provider)是一次格式迁移:
    // 必须读作缺失并按当前形状重建,绝不把跨通道 / 跨时段的行悄悄并起来。
    const v1 = JSON.parse(await readFile(join(dir, 'rollup.json'), 'utf8'))
    delete v1.schemaVersion
    const strip = (r: { provider?: string }): unknown => {
      const { provider: _p, ...rest } = r
      return rest
    }
    v1.rateRows = v1.rateRows.map(strip)
    v1.byModel = v1.byModel.map(strip)
    await writeFile(join(dir, 'rollup.json'), JSON.stringify(v1), 'utf8')
    const fromV1 = await buildSummary(dir, never, resolve, quiet)
    const restamped = JSON.parse(await readFile(join(dir, 'rollup.json'), 'utf8'))
    check('旧版本折叠按当前形状重建并盖上新的 schemaVersion',
      foldKey(first) === foldKey(fromV1) && fromV1.rateRows.every((r: { provider?: string }) => r.provider !== undefined)
      && restamped.schemaVersion === 7, restamped.schemaVersion)
    // 用量未知是冻结折叠的一部分:它必须活过往返,而不是读回来变成 0。
    check('用量未知活过折叠往返', first.total.usageUnknown === 2 && rebuilt.total.usageUnknown === 2 && fromV1.total.usageUnknown === 2,
      [first.total.usageUnknown, rebuilt.total.usageUnknown, fromV1.total.usageUnknown])

    const direct = summarizeRecords(await readRecordsByDayRange(dir, '0000-01-01', '9999-12-31', quiet), resolve)
    check('折叠结果 == 直接全量聚合(派生状态永远只是缓存)', foldKey(direct) === foldKey(first))
  } finally {
    await rm(dir, { recursive: true, force: true })
    clearRecordCache(dir)
  }
}

// ---------------------------------------------------------------------------
// 2. refile:走错门的行搬回它事件的日文件,幂等,畸形行不动
// ---------------------------------------------------------------------------
console.log('refile: 走错门的行搬回事件日')
{
  const dir = await cleanDir()
  try {
    const stray = rec('stray-1', '2026-02-01', 9, 'deepseek-chat', { inputTokens: 10, outputTokens: 10 })
    const right = rec('ok-1', '2026-02-03', 9, 'deepseek-chat', { inputTokens: 20, outputTokens: 20 })
    const parked = 'usage-2026-02-10.jsonl'
    await writeFile(join(dir, parked), `${serializeRecord(stray)}\nthis is not json\n`, 'utf8')
    const log = new UsageLog(dir, quiet)

    check('搬 1 行走错门的行,畸形行原样留在原地',
      await log.refileByEventDay() === 1 && await rowCount(dir, dayFileNameOf(stray.time)) === 1
      && (await readFile(join(dir, parked), 'utf8')).includes('this is not json'))
    await log.record(right)
    check('refile 幂等;record() 直接写进事件日的文件,之后的 refile 不再动它',
      await log.refileByEventDay() === 0 && await rowCount(dir, dayFileNameOf(right.time)) === 1 && await log.refileByEventDay() === 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
    clearRecordCache(dir)
  }
}

// ---------------------------------------------------------------------------
// 3. 单写者:去重集按目录共享,且活过进程重启
// ---------------------------------------------------------------------------
console.log('dedupe: 去重集按目录共享,重启后从磁盘重新推出')
{
  const dir = await cleanDir()
  try {
    const row = rec('dup-1', '2026-03-01', 9, 'deepseek-chat', { inputTokens: 100, outputTokens: 100 })
    const logA = new UsageLog(dir, quiet)
    const first = await logA.record(row)
    // 同一目录上的第二个实例共享去重集:热重载 / 重叠写者也不可能把同一行写两遍。
    const logB = new UsageLog(dir, quiet)
    const second = await logB.record(row)
    check('同一目录的第二个实例立刻去重,文件里只有一行',
      first === true && second === false && await rowCount(dir, dayFileNameOf(row.time)) === 1)

    // 模拟进程重启:先忘掉进程内状态,新的 UsageLog 必须在第一次写之前从磁盘行重建去重集。
    resetUsageLogState(dir)
    const afterRestart = new UsageLog(dir, quiet)
    const refused = await afterRestart.record(row)
    const appended = await afterRestart.record(rec('dup-2', '2026-03-01', 10, 'deepseek-chat', { inputTokens: 50, outputTokens: 50 }))
    check('重启后同样的身份被拒、新身份照写(去重集来自磁盘,不靠内存)', refused === false && appended === true
      && await rowCount(dir, dayFileNameOf(row.time)) === 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
    clearRecordCache(dir)
    resetUsageLogState(dir)
  }
}

// ---------------------------------------------------------------------------
// 4. 价格签名一变,整份折叠作废
// ---------------------------------------------------------------------------
console.log('rollup: pricingRevision 一变,整份折叠作废(日文件重建)')
{
  const dir = await cleanDir()
  try {
    // 2026-09-14 周一、09-15 周二,10:00 都落在 09:00–12:00 的工作时段里,按例外价计费。
    const rows = [
      { ...rec('pr-1', '2026-09-14', 10, 'deepseek-chat', { inputTokens: 1_000_000, outputTokens: 0 }), provider: 'deepseek-official' },
      { ...rec('pr-2', '2026-09-15', 10, 'deepseek-chat', { inputTokens: 1_000_000, outputTokens: 0 }), provider: 'deepseek-official' },
    ]
    const log = new UsageLog(dir, quiet)
    for (const row of rows) await log.record(row)

    // 真实输入是价格文件:折叠记下它文本的 djb2 签名,费率行身份取自同一张表——时段由
    // (start, days) 标识,所以挪动 start 就换了那些键。
    const prices = (slotStart: number, inputPerMillion: number): PricingTable => ({
      'deepseek-official': {
        'deepseek-chat': [{
          from: EARLIEST,
          rates: { inputPerMillion, outputPerMillion: inputPerMillion * 4 },
          slots: [{ days: 'weekdays', start: slotStart, end: 12, rates: { inputPerMillion: inputPerMillion * 2, outputPerMillion: inputPerMillion * 8 } }],
        }],
      },
    })
    const resolverOf = (table: PricingTable) => (row: UsageRecord) => rateKeyAt(table, row.provider, row.model, row.time)
    const foldedRevision = async (): Promise<string> =>
      (JSON.parse(await readFile(join(dir, 'rollup.json'), 'utf8')) as { pricingRevision: string }).pricingRevision
    const daySpend = (costed: ReturnType<typeof attachCosts>): number[] => costed.byDay.map(row => row.spend ?? 0)

    await writePriceFile(dir, { table: prices(9, 2), billing: {}, revision: '' }, quiet)
    const before = await readPriceFile(dir, quiet)
    const firstFold = await buildSummary(dir, never, resolverOf(before.table), quiet, { pricingRevision: before.revision })
    const beforeCost = attachCosts(firstFold, before.table)
    check('价格文件给自己的内容签名,折叠盖上它折叠时用的那个签名,逐日按生效时段计价(¥4/天)',
      before.revision !== '' && await foldedRevision() === before.revision
      && daySpend(beforeCost).length === 2 && daySpend(beforeCost).every(spend => Math.abs(spend - 4) < 1e-9))

    // 价格文件变了:时段 start 挪位(费率行身份跟着变)且费率下降。按旧签名折出来的行指着一个
    // 新表里不再存在的时段,所以整份折叠必须作废。
    await writePriceFile(dir, { table: prices(8, 1), billing: {}, revision: '' }, quiet)
    const after = await readPriceFile(dir, quiet)
    const secondFold = await buildSummary(dir, never, resolverOf(after.table), quiet, { pricingRevision: after.revision })
    const afterCost = attachCosts(secondFold, after.table)
    check('换了签名后重折:盖上新签名,费率行按新时段身份重建,逐日金额跟上新价(¥2/天),没有残留的价格未知',
      after.revision !== before.revision && await foldedRevision() === after.revision
      && secondFold.rateRows.length === 2 && secondFold.rateRows.every(row => row.rate.slot?.start === 8)
      && daySpend(afterCost).length === 2 && daySpend(afterCost).every(spend => Math.abs(spend - 2) < 1e-9)
      && afterCost.unpricedModels.length === 0, afterCost.unpricedModels.join(','))
    const direct = summarizeRecords(await readRecordsByDayRange(dir, '0000-01-01', '9999-12-31', quiet), resolverOf(after.table))
    check('重折的结果来自日文件而不是被丢掉的旧折叠(== 新价下的直接全量聚合)', foldKey(direct) === foldKey(secondFold))
  } finally {
    await rm(dir, { recursive: true, force: true })
    clearRecordCache(dir)
  }
}

// ---------------------------------------------------------------------------
// 5. 同步基线:重启后只走漂移 / 新增的会话
// ---------------------------------------------------------------------------
console.log('baseline: 重启后只走漂移 / 新增的会话')
{
  const snap = (id: string, revision: unknown): PersistenceSnapshotLike => ({ header: { id }, ...(revision !== undefined ? { revision } : {}) })
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-baseline-'))
  try {
    const listing = [snap('a', 'rev-1'), snap('b', 'rev-2'), snap('c', 'rev-3')]
    await writeSyncProgress(dir, { syncedAt: Date.now(), sessions: Object.fromEntries(snapshotBaseline(listing)) })
    const progress = await readSyncProgress(dir)
    const map = new Map(Object.entries(progress?.sessions ?? {}))
    const syncedOnce = true   // 载入基线之后 host 就是这么标记的
    const nothing = staleSessionIds(syncedOnce, map, listing)
    const drift = staleSessionIds(syncedOnce, map, [snap('a', 'rev-1-changed'), snap('b', 'rev-2'), snap('c', 'rev-3'), snap('d', 'rev-4')])
    check('写下的基线读得回来;未变的会话一个都不走,漂移 / 新增的才走,只有会话被删也算干净',
      progress !== null && nothing.length === 0 && drift.length === 2 && drift.includes('a') && drift.includes('d')
      && staleSessionIds(syncedOnce, map, [snap('b', 'rev-2')]).length === 0)

    await writeFile(join(dir, 'sync-progress.json'), '{ "syncedAt": "not-a-number", "sessions": {} }', 'utf8')
    const torn = await readSyncProgress(dir)
    const empty = await mkdtemp(join(tmpdir(), 'tokbook-baseline-empty-'))
    try {
      check('残缺的基线与根本没有基线都读作 null(调用方退回全量走一遍并重写一份)',
        torn === null && await readSyncProgress(empty) === null)
    } finally {
      await rm(empty, { recursive: true, force: true })
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------
// 6. 派生态自证有效:往日被追加后,没有人需要「记得作废」也能看见
// ---------------------------------------------------------------------------
console.log('fold: 往日被追加后自动重折 + 缓存不再把冻结日当不可变')
{
  const dir = await cleanDir()
  try {
    const log = new UsageLog(dir, quiet)
    await log.record(rec('late-1', '2026-04-01', 9, 'deepseek-chat', { inputTokens: 100, outputTokens: 10 }))
    // 先让解析缓存与折叠都把这一天当成「已定」。
    const cachedBefore = await readCachedRecords(dir, quiet)
    const first = await buildSummary(dir, never, resolve, quiet)
    // 权威 walk 补写往日就是这条路径:同一个进程、不清缓存、不删 rollup,直接追加。
    await log.record(rec('late-2', '2026-04-01', 10, 'deepseek-chat', { inputTokens: 200, outputTokens: 20 }))
    const cachedAfter = await readCachedRecords(dir, quiet)
    const after = await buildSummary(dir, never, resolve, quiet)
    check('补写已折过的那一天:聚合与窗口读都看得到新行(不靠 invalidateDerivedState)',
      cachedBefore.length === 1 && cachedAfter.length === 2
      && first.total.requests === 1 && after.total.requests === 2 && after.total.inputTokens === 300)
    const direct = summarizeRecords(await readRecordsByDayRange(dir, '0000-01-01', '9999-12-31', quiet), resolve)
    check('重折后仍等于直接全量聚合(派生状态只是缓存)', foldKey(direct) === foldKey(after))
  } finally {
    await rm(dir, { recursive: true, force: true })
    clearRecordCache(dir)
  }
}

// ---------------------------------------------------------------------------
// 7. 1970 前的生效时刻:写路径必须留成一个**有日期**的身份
// ---------------------------------------------------------------------------
console.log('price: 1970 前的日期段不塌成托底段')
{
  const dir = await cleanDir()
  try {
    const ancient = dayMs('1900-01-01', 0)
    const table: PricingTable = {
      r: { m: [
        { from: EARLIEST, rates: { inputPerMillion: 1, outputPerMillion: 4 } },
        { from: ancient, rates: { inputPerMillion: 2, outputPerMillion: 8 } },
      ] },
    }
    await writePriceFile(dir, { table, billing: {}, revision: '' }, quiet)
    const back = await readPriceFile(dir, quiet)
    const segments = back.table.r?.m ?? []
    check('两段价在盘上是两个身份,读回来还是两段(identity = 「无起点」只有 from 0 一个)',
      ancient < 0 && segments.length === 2 && segments[0]!.from < 0 && segments[1]!.from === EARLIEST)
  } finally {
    await rm(dir, { recursive: true, force: true })
    clearRecordCache(dir)
  }
}

if (failures > 0) {
  console.error(`${failures} ledger self-check(s) FAILED`)
  process.exit(1)
}
console.log('all ledger self-checks passed')
