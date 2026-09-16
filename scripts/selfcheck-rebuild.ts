/**
 * Self-check of the ledger's rebuild / dedupe invariants (pure logic, real
 * temp directories):
 *
 *  1. The rollup is derived state — deleting or corrupting `rollup.json`
 *     must rebuild losslessly from the raw day files (the overview numbers
 *     before and after are identical to a direct full aggregation).
 *  2. `refileByEventDay()` moves rows onto the day file their event time
 *     names, is idempotent, and never drops malformed lines.
 *  3. Request-id dedupe is shared per data directory across UsageLog
 *     instances (a host reload / second instance can never double-write the
 *     same row), and survives a process restart: a fresh UsageLog re-derives
 *     the dedupe set from the on-disk rows before its first write.
 *  4. A changed price file invalidates the WHOLE rollup: the fold records the
 *     price-file signature (`pricingRevision`), mismatch reads as absent, and
 *     the days are re-read with the current table — per-day money follows the
 *     new prices and the rate-row identities are re-derived.
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
  attachCosts, buildSummary, clearRecordCache, readRecordsByDayRange, summarizeRecords,
  type RateResolver,
} from '../src/stats.ts'
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

/** A ledger row factory: request/compaction/failure kinds + optional usage. */
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
// Match the unpriced default resolver `buildSummary`/`summarizeRecords` share
// when no resolver is given, so both paths agree on rateRows.
const resolve: RateResolver = () => UNPRICED_KEY

const cleanDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-rebuild-'))
  await mkdir(dir, { recursive: true })
  return dir
}

const rowCount = async (dir: string, name: string): Promise<number> => {
  const text = await readFile(join(dir, name), 'utf8').catch(() => '')
  return text === '' ? 0 : text.trim().split('\n').length
}

const fileExists = async (dir: string, name: string): Promise<boolean> =>
  readFile(join(dir, name), 'utf8').then(() => true, () => false)

/** The day-file name a record's event time belongs to. */
const fileOf = (r: UsageRecord): string => dayFileNameOf(r.time)

// ---------------------------------------------------------------------------
// 1. Rollup is derived state: delete / corrupt → lossless rebuild
// ---------------------------------------------------------------------------
console.log('rollup: derived-state lossless rebuild')
{
  const dir = await cleanDir()
  try {
    const rows = [
      rec('m1', '2026-01-02', 9, 'deepseek-chat', { inputTokens: 1200, outputTokens: 300, cacheReadTokens: 400 }),
      rec('m2', '2026-01-02', 10, 'deepseek-reasoner', { inputTokens: 900, outputTokens: 200 }),
      rec('m3', '2026-01-03', 11, 'deepseek-chat', { inputTokens: 800, outputTokens: 500 }),
      { ...rec('c1', '2026-01-03', 12, 'deepseek-chat', { inputTokens: 60, outputTokens: 20 }), kind: 'compaction' as const },
      { ...rec('f1', '2026-01-03', 12, 'deepseek-chat'), kind: 'failure' as const, failureCode: 'RATE_LIMIT' },
      // A billed call the channel never reported usage for (an interrupted
      // request), and a summarize call likewise missing usage: both are counted
      // in requests/usageUnknown and contribute no tokens.
      rec('m4', '2026-01-04', 9, 'deepseek-chat'),
      { ...rec('c2', '2026-01-04', 10, 'deepseek-chat'), kind: 'compaction' as const },
    ]
    const log = new UsageLog(dir, quiet)
    for (const row of rows) await log.record(row)

    // All rows land in frozen (pre-"today") files; "today" is 2099 so every
    // file is cold and buildSummary rolls it up once, then serves from disk.
    const first = await buildSummary(dir, never, resolve, quiet)
    check('cold rows rolled into a rollup', await fileExists(dir, 'rollup.json'))

    // Delete the rollup → rebuild must match the first read exactly.
    await rm(join(dir, 'rollup.json'), { force: true })
    const rebuilt = await buildSummary(dir, never, resolve, quiet)
    const key = (s: typeof first) => JSON.stringify({
      total: s.total, byDay: s.byDay, byHour: s.byHour, byModel: s.byModel, rateRows: s.rateRows,
    })
    check('deleted rollup rebuilds losslessly', key(first) === key(rebuilt))

    // Corrupt the rollup → reads as absent → same lossless rebuild.
    await writeFile(join(dir, 'rollup.json'), '{ not json', 'utf8')
    const fromCorrupt = await buildSummary(dir, never, resolve, quiet)
    check('corrupt rollup rebuilds losslessly', key(first) === key(fromCorrupt))

    // A v1 rollup (no `schemaVersion`) is a format-change migration: it must
    // read as absent and rebuild under the current shape (v4 rate rows carry the
    // effective instant of the segment that applied AND the exception slot that
    // applied inside it; v5 dropped the cached recent window), never silently
    // merge rows across providers or slots.
    const v1 = JSON.parse(await readFile(join(dir, 'rollup.json'), 'utf8'))
    delete v1.schemaVersion
    // The stored rateRows lack `provider`; strip it to simulate a real v1 file.
    v1.rateRows = v1.rateRows.map((r: { provider?: string; day: string; model: string; rate: unknown; totals: unknown }) => {
      const { provider: _p, ...rest } = r
      return rest
    })
    v1.byModel = v1.byModel.map((r: { provider?: string; model: string; totals: unknown }) => {
      const { provider: _p, ...rest } = r
      return rest
    })
    await writeFile(join(dir, 'rollup.json'), JSON.stringify(v1), 'utf8')
    const fromV1 = await buildSummary(dir, never, resolve, quiet)
    check('v1 rollup rebuilds losslessly to the current shape', key(first) === key(fromV1) && fromV1.rateRows.every((r: { provider?: string }) => r.provider !== undefined))
    // The rebuilt file carries the current schema version.
    const afterV1 = JSON.parse(await readFile(join(dir, 'rollup.json'), 'utf8'))
    check('rebuilt rollup is stamped schemaVersion 6', afterV1.schemaVersion === 6)
    // The unknown-usage counter is part of the frozen fold: it must survive the
    // rollup round-trip, not silently read back as 0.
    check('用量未知 survives the rollup round-trip',
      first.total.usageUnknown === 2 && rebuilt.total.usageUnknown === 2 && fromV1.total.usageUnknown === 2,
      `first=${String(first.total.usageUnknown)} rebuilt=${String(rebuilt.total.usageUnknown)} v1=${String(fromV1.total.usageUnknown)}`)

    // And both agree with a direct full aggregation of the raw day files.
    const all = await readRecordsByDayRange(dir, '0000-01-01', '9999-12-31', never, quiet)
    const direct = summarizeRecords(all, resolve)
    const eqDirect = JSON.stringify(direct) === key(first)
    if (!eqDirect) {
      for (const field of ['byDay', 'byHour', 'byModel', 'rateRows'] as const) {
        const a = JSON.stringify(direct[field])
        const b = JSON.stringify(first[field])
        if (a !== b) {
          console.log(`    field ${field} differs:`)
          console.log('      direct:', a)
          console.log('      first :', b)
        }
      }
    }
    check('rebuild == direct full aggregation', eqDirect)
  } finally {
    await rm(dir, { recursive: true, force: true })
    clearRecordCache(dir)
  }
}

// ---------------------------------------------------------------------------
// 2. refileByEventDay moves stray rows and is idempotent
// ---------------------------------------------------------------------------
console.log('refile: stray rows land on their event day')
{
  const dir = await cleanDir()
  try {
    const wrongDay = rec('stray-1', '2026-02-01', 9, 'deepseek-chat', { inputTokens: 10, outputTokens: 10 })
    const right = rec('ok-1', '2026-02-03', 9, 'deepseek-chat', { inputTokens: 20, outputTokens: 20 })
    // Write the stray row into a file that is NOT its event day (its event
    // time is 2026-02-01; park it in a wrong-day file), plus a malformed line
    // that must survive untouched.
    const parkedName = 'usage-2026-02-10.jsonl'
    await writeFile(
      join(dir, parkedName),
      `${serializeRecord(wrongDay)}\nthis is not json\n`,
      'utf8',
    )
    const strayTarget = fileOf(wrongDay)
    const correctName = fileOf(right)
    const log = new UsageLog(dir, quiet)

    const moved = await log.refileByEventDay()
    check('one row moved to its event day', moved === 1, moved)
    check('stray row now in correct file', await rowCount(dir, strayTarget) === 1, strayTarget)
    check('malformed line kept in parked file', (await readFile(join(dir, parkedName), 'utf8')).includes('this is not json'))

    // Idempotent: a second pass moves nothing.
    check('refile is idempotent', (await log.refileByEventDay()) === 0)

    // A record appended through the log lands on its own event-day file and is
    // not touched by a later refile.
    await log.record(right)
    check('record() writes to event-day file', await rowCount(dir, correctName) === 1, correctName)
    check('later refile still moves nothing', (await log.refileByEventDay()) === 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
    clearRecordCache(dir)
  }
}

// ---------------------------------------------------------------------------
// 3. Dedupe is per-directory shared: two instances, and a "restart"
// ---------------------------------------------------------------------------
console.log('dedupe: shared per directory, survives restart')
{
  const dir = await cleanDir()
  try {
    const logA = new UsageLog(dir, quiet)
    const row = rec('dup-1', '2026-03-01', 9, 'deepseek-chat', { inputTokens: 100, outputTokens: 100 })
    check('first instance appends', await logA.record(row) === true)

    // A second instance over the same directory shares the dedupe set — the
    // host-reload / overlapping-writer scenario can never double-write.
    const logB = new UsageLog(dir, quiet)
    check('second instance dedupes immediately', await logB.record(row) === false)
    check('file holds exactly one row', await rowCount(dir, fileOf(row)) === 1)

    // Simulate a process restart: forget the in-process state, then a fresh
    // UsageLog must re-derive the dedupe set from the on-disk rows before its
    // first write — the same id is refused, a new id is appended.
    resetUsageLogState(dir)
    const afterRestart = new UsageLog(dir, quiet)
    check('restarted host refuses re-appending existing row', await afterRestart.record(row) === false)
    const row2 = rec('dup-2', '2026-03-01', 10, 'deepseek-chat', { inputTokens: 50, outputTokens: 50 })
    check('restarted host appends new row', await afterRestart.record(row2) === true)
    check('file holds exactly two rows', await rowCount(dir, fileOf(row)) === 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
    clearRecordCache(dir)
    resetUsageLogState(dir)
  }
}

// ---------------------------------------------------------------------------
// 4. A changed price file invalidates the whole rollup (pricingRevision)
// ---------------------------------------------------------------------------
console.log('rollup: a changed pricingRevision discards the whole rollup')
{
  const dir = await cleanDir()
  try {
    // 2026-09-14 is a Monday, 2026-09-15 a Tuesday: hour 10 falls inside a
    // 09:00–12:00 weekday slot, so the exception rate is the one that bills.
    const rows = [
      { ...rec('pr-1', '2026-09-14', 10, 'deepseek-chat', { inputTokens: 1_000_000, outputTokens: 0 }), provider: 'deepseek-official' },
      { ...rec('pr-2', '2026-09-15', 10, 'deepseek-chat', { inputTokens: 1_000_000, outputTokens: 0 }), provider: 'deepseek-official' },
    ]
    const log = new UsageLog(dir, quiet)
    for (const row of rows) await log.record(row)

    // The real input is the price file: rollup records the djb2 signature of
    // its TEXT, and the rate-row identity comes from the same table — the slot
    // is identified by (start, days), so moving the start changes those keys.
    const prices = (slotStart: number, inputPerMillion: number): PricingTable => ({
      'deepseek-official': {
        'deepseek-chat': [{
          from: EARLIEST,
          rates: { inputPerMillion, outputPerMillion: inputPerMillion * 4 },
          slots: [{
            days: 'weekdays',
            start: slotStart,
            end: 12,
            rates: { inputPerMillion: inputPerMillion * 2, outputPerMillion: inputPerMillion * 8 },
          }],
        }],
      },
    })
    const resolverOf = (table: PricingTable) =>
      (row: UsageRecord) => rateKeyAt(table, row.provider, row.model, row.time)
    const foldedRevision = async (): Promise<string> =>
      (JSON.parse(await readFile(join(dir, 'rollup.json'), 'utf8')) as { pricingRevision: string }).pricingRevision
    const daySpend = (costed: ReturnType<typeof attachCosts>): number[] =>
      costed.byDay.map(row => row.spend ?? 0)

    await writePriceFile(dir, { table: prices(9, 2), billing: {}, revision: '' }, quiet)
    const first = await readPriceFile(dir, quiet)
    check('the price file signs its own content', first.revision !== '', first.revision)

    const before = await buildSummary(dir, never, resolverOf(first.table), quiet, { pricingRevision: first.revision })
    check('the fold is stamped with the signature it folded under', await foldedRevision() === first.revision)
    const beforeCost = attachCosts(before, first.table)
    check('each day bills the slot in force (¥4/day)',
      daySpend(beforeCost).length === 2 && daySpend(beforeCost).every(spend => Math.abs(spend - 4) < 1e-9),
      JSON.stringify(daySpend(beforeCost)))

    // The price file changes: the slot's start moves (its rate-row identity
    // changes) and the rate drops. Rows folded under the old signature name a
    // slot the new table no longer holds, so the whole rollup must go.
    await writePriceFile(dir, { table: prices(8, 1), billing: {}, revision: '' }, quiet)
    const second = await readPriceFile(dir, quiet)
    check('a changed price file is a different signature', second.revision !== first.revision)

    const after = await buildSummary(dir, never, resolverOf(second.table), quiet, { pricingRevision: second.revision })
    const afterCost = attachCosts(after, second.table)
    check('the rollup is restamped with the new signature', await foldedRevision() === second.revision)
    check('rate rows are rebuilt with the new slot identity',
      after.rateRows.length === 2 && after.rateRows.every(row => row.rate.slot?.start === 8),
      JSON.stringify(after.rateRows.map(row => row.rate)))
    check('per-day money follows the new prices (¥2/day)',
      daySpend(afterCost).length === 2 && daySpend(afterCost).every(spend => Math.abs(spend - 2) < 1e-9),
      JSON.stringify(daySpend(afterCost)))
    check('nothing is left reading as 价格未知', afterCost.unpricedModels.length === 0, afterCost.unpricedModels.join(','))

    // And it came from the day files, not from the discarded fold: identical to
    // a direct full aggregation under the new table.
    const all = await readRecordsByDayRange(dir, '0000-01-01', '9999-12-31', never, quiet)
    const direct = summarizeRecords(all, resolverOf(second.table))
    check('rebuild == direct full aggregation under the new prices',
      JSON.stringify(direct) === JSON.stringify({
        total: after.total, byDay: after.byDay, byHour: after.byHour, byModel: after.byModel, rateRows: after.rateRows,
      }))
  } finally {
    await rm(dir, { recursive: true, force: true })
    clearRecordCache(dir)
  }
}

if (failures > 0) {
  console.error(`${failures} rebuild self-check(s) FAILED`)
  process.exit(1)
}
console.log('all rebuild self-checks passed')
