// Smoke test of the pure aggregation + pricing math (no DSH runtime needed).
// Run with: node --experimental-strip-types scripts/smoke.ts
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { summarizeRecords, mergeSummaries, attachCosts, emptyTotals, totalsTokens, buildSummary, isLedgerStale, staleSessionIds } from '../src/stats.ts'
import { resolveRate, ratesForKey, costOf, coercePricingTable, cloudToTable, coerceCloudPricing } from '../src/pricing.ts'
import { parseRecord, serializeRecord, coerceRecord, recordOfEvent, type SessionEventLike } from '../src/usage-record.ts'
import { dayFileNameOf, UsageLog } from '../src/usage-log.ts'
import { syncHistory, listPersistenceSnapshots } from '../src/sync.ts'
import type { UsageRecord } from '../src/types.ts'

let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ok    ${name}`)
  } else {
    failed += 1
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('round-trip serialise / parse')
{
  const rec: UsageRecord = { requestId: 'req-1', time: 1730000000000, sessionId: 's1', model: 'deepseek-chat', usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50 } }
  const back = coerceRecord(JSON.parse(serializeRecord(rec)))
  check('record round-trips fields', back !== null && back.requestId === 'req-1' && back.usage?.cacheReadTokens === 50 && back.usage?.cacheWriteTokens === undefined)
  const parsed = parseRecord(serializeRecord(rec))
  check('parseRecord returns the row', parsed?.model === 'deepseek-chat')
}

console.log('record projection')
{
  const ev = { type: 'assistant/message', time: 1730000000000, seq: 1, data: { message: { id: 'a1', source: { provider: 'deepseek', model: 'deepseek-chat' } }, usage: { inputTokens: 10, outputTokens: 5 } } }
  const rec = recordOfEvent(ev as never, 's1', 'deepseek-chat', true)
  check('assistant/message projects a request', rec?.kind === undefined && rec?.model === 'deepseek-chat' && rec?.usage?.inputTokens === 10 && rec.provider === 'deepseek')
  const turnEnd = { type: 'turn/end', time: 1730000000000, seq: 7, data: { reason: { kind: 'error', error: { code: 'RATE_LIMIT' } } } }
  const failRec = recordOfEvent(turnEnd as never, 's1', 'deepseek-chat', true)
  check('turn/end error projects a failure', failRec?.kind === 'failure' && failRec.failureCode === 'RATE_LIMIT' && failRec.usage === undefined)
}

console.log('summarize / totals')
{
  const records: UsageRecord[] = [
    { requestId: '1', time: dayMillis('2026-01-01', 10), sessionId: 's1', model: 'deepseek-chat', usage: { inputTokens: 100, outputTokens: 50 } },
    { requestId: '2', time: dayMillis('2026-01-01', 14), sessionId: 's1', model: 'deepseek-chat', usage: { inputTokens: 200, outputTokens: 100 } },
    { requestId: '3', time: dayMillis('2026-01-02', 9), sessionId: 's2', model: 'deepseek-reasoner', usage: { inputTokens: 40, outputTokens: 15, cacheReadTokens: 60 } },
    { requestId: '4', time: dayMillis('2026-01-02', 9), sessionId: 's2', model: 'deepseek-chat', kind: 'failure', failureCode: 'QUOTA' },
  ]
  const sum = summarizeRecords(records)
  check('requests = 3 (failures excluded)', sum.total.requests === 3, `got ${sum.total.requests}`)
  check('failures = 1', sum.total.failures === 1)
  check('input sum', sum.total.inputTokens === 340, `got ${sum.total.inputTokens}`)
  check('output sum', sum.total.outputTokens === 165, `got ${sum.total.outputTokens}`)
  check('cacheRead sum', sum.total.cacheReadTokens === 60)
  check('2 day rows', sum.byDay.length === 2)
  check('2 model rows', sum.byModel.length === 2)
  check('recent capped+desc', sum.recent.length === 4 && sum.recent[0]!.time >= sum.recent[1]!.time && sum.recent[0]!.time >= sum.recent[3]!.time)
  const merged = mergeSummaries(summarizeRecords(records.slice(0, 2)), summarizeRecords(records.slice(2)))
  check('merge equals full', merged.total.requests === 3 && merged.total.inputTokens === 340 && merged.byModel.length === 2)
}

console.log('pricing rule chain + cost')
{
  const table = { 'deepseek-chat': { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5, cacheWritePerMillion: 1 } }
  const r = resolveRate({ base: table['deepseek-chat']!, contextTiers: [], dailySlots: [], timeRules: [] }, dayMillis('2026-01-01', 10), 0)
  check('base rate identity', r.key.tier === 0 && r.key.slot === -1)
  const cost = costOf({ requests: 1, inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 200_000, cacheWriteTokens: 100_000, compactions: 0, failures: 0 }, r.prices)
  check('costOf math', Math.abs(cost - (2 + 4 + 0.1 + 0.1)) < 1e-9, `got ${cost}`)
  const priced = coercePricingTable(table)
  check('coercePricingTable', priced['deepseek-chat']?.inputPerMillion === 2)
}

console.log('day file naming')
{
  check('dayFileNameOf', dayFileNameOf(dayMillis('2026-01-05', 3)) === 'usage-2026-01-05.jsonl')
}

console.log('end-to-end: real-shaped DSH events -> JSONL ledger -> aggregate -> cost')
{
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-'))
  try {
    const log = new UsageLog(dir, { error: () => {} })
    // DSH-shaped session events: request/context, assistant/message (usage),
    // another assistant/message, a compaction/summary, a turn/end failure.
    const events: SessionEventLike[] = [
      { type: 'request/context', time: dayMillis('2026-02-01', 9), seq: 0, data: { provider: 'deepseek', model: 'deepseek-chat' } },
      { type: 'assistant/message', time: dayMillis('2026-02-01', 9), seq: 1, data: { message: { id: 'msg-1', source: { provider: 'deepseek', model: 'deepseek-chat' } }, usage: { inputTokens: 1200, outputTokens: 300, cacheReadTokens: 500 } } },
      { type: 'assistant/message', time: dayMillis('2026-02-01', 10), seq: 2, data: { message: { id: 'msg-2', source: { provider: 'deepseek', model: 'deepseek-reasoner' } }, usage: { inputTokens: 900, outputTokens: 660, cacheWriteTokens: 100 } } },
      { type: 'compaction/summary', time: dayMillis('2026-02-01', 11), seq: 3, data: { provider: 'deepseek', model: 'deepseek-chat', usage: { inputTokens: 80, outputTokens: 40 } } },
      { type: 'llm/retry', time: dayMillis('2026-02-01', 11), seq: 4, data: { provider: 'deepseek', failure: { code: 'RATE_LIMIT', message: 'rate' } } },
      { type: 'turn/end', time: dayMillis('2026-02-01', 11), seq: 5, data: { reason: { kind: 'error', error: { code: 'QUOTA', message: 'q' } } } },
    ]
    let recorded = 0
    let model = ''
    for (const ev of events) {
      const revealed = (ev.type === 'request/context' || ev.type === 'assistant/message') ? (ev.data?.model ?? ev.data?.message?.source.model) : undefined
      if (revealed !== undefined) model = revealed
      const rec = recordOfEvent(ev, 'sess-1', model, true)
      // Dedupe the compaction by a stable seq-derived id; live rows dedupe on request id.
      if (rec !== null && await log.record(rec)) recorded += 1
    }
    check('records landed in the JSONL ledger', recorded === 5, `got ${recorded}`)

    const pricing: Record<string, unknown> = {
      'deepseek-chat': { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5, cacheWritePerMillion: 1 },
      'deepseek-reasoner': { inputPerMillion: 4, outputPerMillion: 16, cacheReadPerMillion: 1, cacheWritePerMillion: 2 },
    }
    // attachCosts expects a ModelRates table; wrap the base ModelPricing like readPricingTable does.
    const table: Record<string, { base: Record<string, number>; contextTiers: unknown[]; dailySlots: unknown[]; timeRules: unknown[] }> = {}
    for (const [model, base] of Object.entries(coercePricingTable(pricing))) {
      table[model] = { base, contextTiers: [], dailySlots: [], timeRules: [] }
    }
    const resolve = (r: UsageRecord) => {
      const rules = table[r.model]
      if (rules === undefined) return { ruleStart: 0, ruleEnd: 0, tier: 0, slot: -1 }
      const usage = r.usage
      const ctx = usage === undefined ? 0 : usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
      return resolveRate(rules, r.time, ctx).key
    }
    const summary = await buildSummary(dir, () => new Date('2026-02-02T00:00:00Z'), resolve, { error: () => {} })
    const costed = attachCosts(summary, table)
    check('totals: input', summary.total.inputTokens === 2180, `got ${summary.total.inputTokens}`)
    check('totals: output', summary.total.outputTokens === 1000, `got ${summary.total.outputTokens}`)
    check('totals: requests = 3 (2 assistant + 1 compaction)', summary.total.requests === 3, `got ${summary.total.requests}`)
    check('totals: compactions = 1', summary.total.compactions === 1)
    check('totals: failures = 2 (retry + turnEnd)', summary.total.failures === 2, `got ${summary.total.failures}`)
    check('cost is non-zero', costed.totalCost > 0, `got ${costed.totalCost}`)
    check('byDay populated', summary.byDay.length === 1 && totalsTokens(summary.byDay[0]!.totals) === 3780, `got ${totalsTokens(summary.byDay[0]!.totals)}`)
    check('byModel populated', summary.byModel.length === 2)
    check('recent has rows', summary.recent.length === 5)
    check('totalTokens matches buckets', totalsTokens(costed.total) === 3780, `got ${totalsTokens(costed.total)}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

console.log('hybrid freshness gate')
{
  const snaps = (ids: string[], revs: string[]): readonly { header: { id: string }; revision: unknown }[] =>
    ids.map((id, i) => ({ header: { id }, revision: revs[i] }))
  // Never synced → stale (first read walks all) — except with no sessions at
  // all, where there is nothing to walk either way.
  check('never synced is stale', isLedgerStale(false, new Map(), snaps(['a'], ['r1'])) === true)
  // Synced + unchanged set → fresh.
  const synced = new Map([['a', 'r1'], ['b', 'r2']])
  check('unchanged is fresh', isLedgerStale(true, synced, snaps(['a', 'b'], ['r1', 'r2'])) === false)
  // A revision drift (an appended event) → stale.
  check('revision drift is stale', isLedgerStale(true, synced, snaps(['a', 'b'], ['r1', 'r9'])) === true)
  // A new session → stale.
  check('new session is stale', isLedgerStale(true, synced, snaps(['a', 'b', 'c'], ['r1', 'r2', 'r3'])) === true)
  // A removed session alone is NOT stale: nothing is left to sync (its ledger
  // rows stay as history; the next sync's signature reset drops the entry).
  check('removed session alone is fresh', isLedgerStale(true, synced, snaps(['a'], ['r1'])) === false)
  // Synced once with zero sessions → fresh afterward (no repeated walk).
  check('zero sessions after sync is fresh', isLedgerStale(true, new Map(), []) === false)

  // The incremental change set: never synced yields every session.
  check('never synced change set = all', JSON.stringify(staleSessionIds(false, new Map(), snaps(['a', 'b'], ['r1', 'r2']))) === JSON.stringify(['a', 'b']))
  // Unchanged → empty change set (skip the walk entirely).
  check('unchanged change set is empty', staleSessionIds(true, synced, snaps(['a', 'b'], ['r1', 'r2'])).length === 0)
  // Only the drifted session is walked.
  const drift = staleSessionIds(true, synced, snaps(['a', 'b'], ['r1', 'r9']))
  check('drift change set names only b', drift.length === 1 && drift[0] === 'b')
  // A removed session contributes no work (nothing to sync), yet new ones do.
  const mixed = staleSessionIds(true, synced, snaps(['b', 'c'], ['r9', 'r3']))
  check('mixed change set = b (drift) + c (new)', mixed.length === 2 && mixed.includes('b') && mixed.includes('c'))
}

console.log('persistence listing shapes')
{
  // A bare-header list() fallback (the shape `SessionPersistence.list()` really
  // returns) must normalize into snapshots with ids — the regression behind the
  // floating window's "HTTP 500: reading 'id'" failure.
  const bare = await listPersistenceSnapshots({ inspect: async () => ({ meta: { id: 'x' }, events: [] }), list: async () => [{ id: 's1' }, { version: 1 }] as never[] })
  check('bare-header list() normalizes', bare.length === 1 && bare[0]!.header.id === 's1')
  // listSnapshots() wins when present, and non-object junk is dropped.
  const snaps = await listPersistenceSnapshots({
    inspect: async () => ({ meta: { id: 'x' }, events: [] }),
    listSnapshots: async () => [{ header: { id: 's1' }, revision: 'r1' }, { header: { id: 's2' }, revision: 'r2' }, null as never],
  })
  check('listSnapshots() preferred', snaps.length === 2 && snaps[0]!.header.id === 's1' && snaps[1]!.revision === 'r2')
  // A no-op revision (undefined) can never compare fresh after a sync.
  const synced = new Map([['s1', 'r1']])
  check('revision-less snapshot stays stale', staleSessionIds(true, synced, [{ header: { id: 's1' } }]).length === 1)
  check('revision-less snapshot keeps others', staleSessionIds(true, synced, [{ header: { id: 's1' }, revision: 'r1' }, { header: { id: 's2' } }]).join(',') === 's2')
}

console.log('syncHistory over a real-shaped sessionPersistence')
{
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-sync-'))
  try {
    const log = new UsageLog(dir, { error: () => {} })
    // The exact DSH event shapes (dsh-session / dsh-compaction / dsh-llm-retry):
    // a request/context, two billed assistant messages, a compaction summary,
    // an llm/retry failure, and a turn/end error.
    const events: SessionEventLike[] = [
      { type: 'request/context', time: dayMillis('2026-02-01', 9), seq: 1, data: { provider: 'deepseek', model: 'deepseek-chat' } },
      { type: 'assistant/message', time: dayMillis('2026-02-01', 9), seq: 2, data: { turn: 1, step: 1, message: { id: 'msg-1', role: 'assistant', content: [], source: { kind: 'model', provider: 'deepseek', model: 'deepseek-chat' } }, usage: { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 300 } } },
      { type: 'assistant/message', time: dayMillis('2026-02-01', 10), seq: 5, data: { turn: 2, step: 1, message: { id: 'msg-2', role: 'assistant', content: [], source: { kind: 'model', provider: 'deepseek', model: 'deepseek-reasoner' } }, usage: { inputTokens: 500, outputTokens: 150 } } },
      { type: 'compaction/summary', time: dayMillis('2026-02-01', 11), seq: 9, data: { compactionId: 'c1', summary: [], shadowedRange: { start: 2, end: 5 }, shadowedSeqs: [2, 5], shadowedTokenCount: 100, provider: 'deepseek', model: 'deepseek-chat', usage: { inputTokens: 90, outputTokens: 30 } } },
      { type: 'llm/retry', time: dayMillis('2026-02-01', 11), seq: 10, data: { retryId: 'r1', turn: 3, step: 1, provider: 'deepseek', mode: 'normal', policyKey: 'p', retry: 1, maxRetries: 3, delayMs: 500, failure: { message: 'rate', code: 'RATE_LIMIT' } } },
      { type: 'turn/end', time: dayMillis('2026-02-01', 12), seq: 12, data: { turn: 3, reason: { kind: 'error', error: { message: 'quota', code: 'QUOTA' } } } },
    ]
    // The real surface: listSnapshots() → {header, revision}; inspect() → {meta, events}.
    const persistence = {
      listSnapshots: async () => [{ header: { id: 'sess-1', version: 1 }, revision: 'rev-1' }],
      inspect: async (id: string) => {
        if (id !== 'sess-1') throw new Error(`not found: ${id}`)
        return { meta: { id: 'sess-1' }, events }
      },
    }
    const result = await syncHistory({ persistence, log, recordCompaction: true })
    check('sync added 5 rows (2 requests + 1 compaction + 2 failures)', result.added === 5, `got ${result.added}`)
    check('sync skipped 0', result.skipped === 0)
    check('no failed sessions', result.failedSessions === 0)
    // Idempotent second run.
    const again = await syncHistory({ persistence, log, recordCompaction: true })
    check('second sync adds nothing', again.added === 0 && again.skipped === 5, `added ${again.added}`)
    // A failing session is skipped and counted, not fatal.
    const broken = {
      listSnapshots: async () => [{ header: { id: 'bad', version: 1 }, revision: 'rev-b' }, { header: { id: 'sess-1', version: 1 }, revision: 'rev-1' }],
      inspect: async (id: string) => {
        if (id === 'bad') throw new Error('corrupt log')
        if (id !== 'sess-1') throw new Error(`not found: ${id}`)
        return { meta: { id }, events }
      },
    }
    const partial = await syncHistory({ persistence: broken, log, recordCompaction: true })
    check('failed session skipped, rest walked', partial.failedSessions === 1 && partial.skipped === 5, JSON.stringify(partial))
    // One unsynced session (new id) against a synced ledger → stale.
    check('new session detected stale', isLedgerStale(true, new Map([['sess-1', 'rev-1']]), [{ header: { id: 'sess-1' }, revision: 'rev-1' }, { header: { id: 'sess-2' }, revision: 'rev-2' }]) === true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
} else {
  console.log('\nall smoke checks passed')
}

function dayMillis(day: string, hour: number): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!, hour, 0, 0).getTime()
}
