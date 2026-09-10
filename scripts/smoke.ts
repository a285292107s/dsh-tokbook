// Smoke test of the pure aggregation + pricing math (no DSH runtime needed).
// Run with: node --experimental-strip-types scripts/smoke.ts
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { summarizeRecords, mergeSummaries, attachCosts, emptyTotals, totalsTokens, buildSummary, isLedgerStale, staleSessionIds, readRecordsByDayRange, rangeDayWindow, costRecentEntries } from '../src/stats.ts'
import { billingOf, coercePriceFile, costOf, dayKeyOf, dayStartMs, EARLIEST, parsePriceInput, priceAt, priceOfKey, PRICING_BILLING_KEY, PRICING_FILE, rateKeyAt, readPriceFile, readPricingView, writePriceFile } from '../src/pricing.ts'
import { collectRoutes, DEEPSEEK_ROUTE, routeLabels, routesFromSettings } from '../src/route-catalog.ts'
import { parseRecord, serializeRecord, coerceRecord, recordOfEvent, type SessionEventLike } from '../src/usage-record.ts'
import { dayFileNameOf, UsageLog } from '../src/usage-log.ts'
import { syncHistory, listPersistenceSnapshots } from '../src/sync.ts'
import { providerCards, splitByProvider, providerKeyOf } from '../src/by-provider.ts'
import { windowFromCreditsBlock, windowFromUsagePercent, resetEpoch, planInfoFromSubscriptions, unconfiguredCard, errorCard, hasQuotaContent, isBuiltinQuotaPlan, BUILTIN_PLAN_TITLES } from '../src/quota.ts'
import { resolvePlanApiKey, fetchOfficialQuota, fetchOpenCodeGoQuota, fetchCommandCodeQuota, parseOpenCodeGoUsage } from '../src/quota-official.ts'
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

console.log('hand price table: dates, segments, resolution')
{
  // Dates are local calendar days; a date that does not exist is not a date.
  check('dayStartMs round-trips a date', dayKeyOf(dayStartMs('2026-09-01')!) === '2026-09-01')
  check('dayStartMs rejects 2026-02-31', dayStartMs('2026-02-31') === null)
  check('dayStartMs rejects a free-form string', dayStartMs('2026/09/01') === null)

  const file = parsePriceInput({
    [PRICING_BILLING_KEY]: { 'opencode-go': 'subscription' },
    'deepseek-official': {
      'deepseek-v4-flash': [
        { from: '2026-08-01', inputPerMillion: 1.5, outputPerMillion: 4.5, cacheReadPerMillion: 0.15, note: '官方价' },
        { from: '2026-09-01', inputPerMillion: 2, outputPerMillion: 6 },
      ],
    },
  })
  check('parsePriceInput accepts a well-formed body', file.ok === true)
  if (file.ok) {
    check('billing lands on its own route', billingOf(file.file.billing, 'opencode-go') === 'subscription')
    check('an undeclared route is metered', billingOf(file.file.billing, 'deepseek-official') === 'metered' && billingOf(file.file.billing, undefined) === 'metered')
    const table = file.file.table
    const before = dayMillis('2026-08-15', 9)
    const after = dayMillis('2026-09-15', 9)
    const ancient = dayMillis('2026-07-15', 9)
    check('segment in force reads its own rates', priceAt(table, 'deepseek-official', 'deepseek-v4-flash', before)?.rates.inputPerMillion === 1.5)
    check('a later effective date wins after it passes', priceAt(table, 'deepseek-official', 'deepseek-v4-flash', after)?.rates.outputPerMillion === 6)
    check('before the earliest segment nothing is priced', priceAt(table, 'deepseek-official', 'deepseek-v4-flash', ancient) === null)
    check('an unpriced (route, model) is null', priceAt(table, 'deepseek-official', 'never-priced', before) === null)
    check('rate identity is the segment start', rateKeyAt(table, 'deepseek-official', 'deepseek-v4-flash', after)?.from === dayStartMs('2026-09-01'))
    check('unpriced identity is the sentinel', rateKeyAt(table, 'deepseek-official', 'never-priced', after).from === -1)
    // Re-pricing history: a rate row is keyed by its segment start, so a rate
    // edit is picked up by the next read.
    const edited = { 'deepseek-official': { 'deepseek-v4-flash': [
      { from: dayStartMs('2026-08-01')!, rates: { inputPerMillion: 1.2, outputPerMillion: 3.6 } },
      { from: dayStartMs('2026-09-01')!, rates: { inputPerMillion: 2, outputPerMillion: 6 } },
    ] } }
    check('priceOfKey re-reads the current table', priceOfKey(edited, 'deepseek-official', 'deepseek-v4-flash', { from: dayStartMs('2026-08-01')! })?.inputPerMillion === 1.2)
    check('priceOfKey of a dropped segment re-prices to its successor', priceOfKey(edited, 'deepseek-official', 'deepseek-v4-flash', { from: dayStartMs('2026-08-01')! - 1 }) === null)

    const cost = costOf({ requests: 1, inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 200_000, cacheWriteTokens: 100_000, compactions: 0, failures: 0 },
      { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5, cacheWritePerMillion: 1 })
    check('costOf math', Math.abs(cost - (2 + 4 + 0.1 + 0.1)) < 1e-9, `got ${cost}`)
    check('costOf falls back to the input rate', costOf({ requests: 1, inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0, compactions: 0, failures: 0 }, { inputPerMillion: 3, outputPerMillion: 9 }) === 3)
  }

  // The write path refuses what it cannot mean.
  const badDate = parsePriceInput({ r: { m: [{ from: '2026-2-1', inputPerMillion: 1, outputPerMillion: 2 }] } })
  check('parsePriceInput rejects a malformed date', badDate.ok === false && badDate.error.includes('YYYY-MM-DD'))
  const dupes = parsePriceInput({ r: { m: [
    { from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 2 },
    { from: '2026-09-01', inputPerMillion: 3, outputPerMillion: 4 },
  ] } })
  check('parsePriceInput rejects a repeated effective date', dupes.ok === false && dupes.error.includes('生效日期相同'))
  const negative = parsePriceInput({ r: { m: [{ inputPerMillion: -1, outputPerMillion: 2 }] } })
  check('parsePriceInput rejects a negative rate', negative.ok === false && negative.error.includes('inputPerMillion'))
  const unknownKey = parsePriceInput({ $routes: { a: 'b' } })
  check('parsePriceInput rejects an unknown reserved key', unknownKey.ok === false && unknownKey.error.includes('未知保留键'))
  const unknownField = parsePriceInput({ r: { m: [{ inputPerMillion: 1, outputPerMillion: 2, billing: 'metered' }] } })
  check('parsePriceInput rejects an unknown segment field', unknownField.ok === false && unknownField.error.includes('未知字段'))
  const dated = parsePriceInput({ r: { m: [{ from: '', inputPerMillion: 1, outputPerMillion: 2, note: '' }] } })
  check('an empty date means 最早一段', dated.ok === true && dated.file.table.r!.m![0]!.from === EARLIEST)

  // The read path is lenient: a malformed segment is dropped, never fatal.
  const lenient = coercePriceFile({ r: { good: [{ inputPerMillion: 1, outputPerMillion: 2 }], bad: [{ inputPerMillion: 'x' }] } }, { error: () => {} })
  check('lenient read keeps the good model', lenient.table.r?.good?.length === 1)
  check('lenient read drops the malformed model', lenient.table.r?.bad === undefined)
  check('a non-object body reads as empty', Object.keys(coercePriceFile('nope', { error: () => {} }).table).length === 0)

  // Round-trip: what the writer stores is what the reader gets back.
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-price-'))
  try {
    if (file.ok) {
      await writePriceFile(dir, file.file, { error: () => {} })
      const text = await readFile(join(dir, PRICING_FILE), 'utf8')
      check('the file is hand-editable JSON', text.includes('"$billing"') && text.includes('"2026-09-01"'))
      const back = await readPriceFile(dir, { error: () => {} })
      check('file round-trips the timeline', back.table['deepseek-official']?.['deepseek-v4-flash']?.length === 2)
      check('file round-trips billing', billingOf(back.billing, 'opencode-go') === 'subscription')
      check('file round-trips the note', back.table['deepseek-official']?.['deepseek-v4-flash']?.[0]?.note === '官方价')
    }

    // The route cards: catalog ∪ ledger ∪ price file.
    const view = await readPricingView(
      dir,
      [
        { route: 'deepseek-official', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
        { route: 'opencode-go', label: 'OpenCode Go', models: [] },
      ],
      {
        byRouteModel: new Map([['opencode-go', new Map([['mimo-v2.5', 83]])]]),
        byRoute: new Map([['opencode-go', 83]]),
      },
      { error: () => {} },
    )
    check('one card per route', view.routes.length === 2, `got ${view.routes.length}`)
    check('used routes come first', view.routes[0]?.route === 'opencode-go')
    check('ledger-only model is a row', view.routes.find(c => c.route === 'opencode-go')?.models.some(m => m.model === 'mimo-v2.5' && !m.configured && m.records === 83) === true)
    const official = view.routes.find(c => c.route === 'deepseek-official')
    const flash = official?.models.find(m => m.model === 'deepseek-v4-flash')
    check('configured model is marked', flash?.configured === true)
    check('card shows the price in force', flash?.now?.inputPerMillion === 2 && flash.nowFrom === '2026-09-01')
    check('a configured model with no price is 价格未知', official?.models.find(m => m.model === 'deepseek-v4-pro')?.now === undefined)
    check('the price file keeps a route configuration dropped', (await readPricingView(dir, [], { byRouteModel: new Map(), byRoute: new Map() }, { error: () => {} })).routes.some(c => c.route === 'deepseek-official'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

console.log('route catalog (settings ∪ live registry)')
{
  const settings = {
    get(ns: string): unknown {
      if (ns === 'llm-pi-ai') {
        return { providers: {
          'opencode-go': { models: [{ id: 'deepseek-v4-flash' }, { id: 'glm-5.3-flash' }] },
          'dots-ai': { displayName: '小红书', models: [{ id: 'dots3-note-prev' }] },
        } }
      }
      if (ns === 'llm-deepseek') return { models: [{ id: 'deepseek-v4-flash' }] }
      return undefined
    },
  }
  const fromSettings = routesFromSettings(settings)
  check('pi-ai routes come from the document', fromSettings.some(e => e.route === 'opencode-go' && e.models.length === 2))
  check('a profile displayName becomes the label', fromSettings.find(e => e.route === 'dots-ai')?.label === '小红书')
  check('the direct DeepSeek route is added once', fromSettings.filter(e => e.route === DEEPSEEK_ROUTE).length === 1)
  check('a route without a name falls back to its key', fromSettings.find(e => e.route === 'opencode-go')?.label === '')

  const llm = {
    listProviders: () => [
      { id: 'opencode-go', name: 'OpenCode Go' },
      { id: 'modlens-commandcode', name: 'Command Code' },
      { id: DEEPSEEK_ROUTE, name: 'DeepSeek' },
    ],
    listModels: async (route: string) => (route === 'modlens-commandcode' ? [{ id: 'deepseek/deepseek-v4-flash' }] : [{ id: 'ignored' }]),
  }
  const catalog = await collectRoutes(settings, llm, { error: () => {} })
  check('a registered route the document omits becomes a card', catalog.some(e => e.route === 'modlens-commandcode'))
  check('the adapter fills a route with no configured models', catalog.find(e => e.route === 'modlens-commandcode')?.models[0] === 'deepseek/deepseek-v4-flash')
  check('a configured list is not overwritten by the adapter', catalog.find(e => e.route === 'opencode-go')?.models.length === 2)
  check('the registry names a route the document left bare', catalog.find(e => e.route === 'opencode-go')?.label === 'OpenCode Go')
  check('the DeepSeek route keeps its adapter name', catalog.find(e => e.route === DEEPSEEK_ROUTE)?.label === 'DeepSeek')
  const labels = routeLabels(settings, llm, { error: () => {} })
  check('labels prefer the document displayName', labels['dots-ai'] === '小红书' && labels['opencode-go'] === 'OpenCode Go')
}

console.log('costRecentEntries (recent-window per-row cost)')
{
  const pricing = { 'deepseek-official': { 'deepseek-chat': [
    { from: EARLIEST, rates: { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5, cacheWritePerMillion: 1 } },
  ] } }
  const t = dayMillis('2026-01-01', 10)
  const recs: UsageRecord[] = [
    { requestId: 'paid', time: t, sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-chat', usage: { inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 200_000, cacheWriteTokens: 100_000 } },
    { requestId: 'unpriced', time: t, sessionId: 's2', provider: 'deepseek-official', model: 'no-such-model', usage: { inputTokens: 10, outputTokens: 10 } },
    { requestId: 'nousage', time: t, sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-chat' },
    { requestId: 'fail', time: t, sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-chat', kind: 'failure', failureCode: 'RATE_LIMIT' },
    { requestId: 'compact', time: t, sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-chat', kind: 'compaction', usage: { inputTokens: 100_000, outputTokens: 50_000 } },
  ]
  const costed = costRecentEntries(recs, pricing, {})
  check('entries keep request ids + order', costed.map(e => e.requestId).join(',') === 'paid,unpriced,nousage,fail,compact')
  // 2 + 4 + 0.1 + 0.1 = 6.2 (the smoke costOf baseline), compaction 0.2 + 0.4 = 0.6
  const paid = costed.find(e => e.requestId === 'paid')
  check('per-row cost of a full-bucket request', paid !== undefined && Math.abs(paid.cost - 6.2) < 1e-9, `got ${paid?.cost}`)
  const compact = costed.find(e => e.requestId === 'compact')
  check('compaction priced like a request', compact !== undefined && Math.abs(compact.cost - 0.6) < 1e-9, `got ${compact?.cost}`)
  check('unpriced model bills ¥0', costed.find(e => e.requestId === 'unpriced')?.cost === 0)
  check('request without usage bills ¥0', costed.find(e => e.requestId === 'nousage')?.cost === 0)
  check('failure row bills ¥0', costed.find(e => e.requestId === 'fail')?.cost === 0)
  const subscribed = costRecentEntries([recs[0]!], pricing, { 'deepseek-official': 'subscription' })
  check('a subscription route bills 订阅价值, not cash', subscribed[0]?.spend === 0 && Math.abs((subscribed[0]?.subscriptionValue ?? 0) - 6.2) < 1e-9)
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

    // The price table keys on (route, model): the e2e ledger's rows carry the
    // `deepseek` provider, so that is the route the table prices.
    const table = { deepseek: {
      'deepseek-chat': [{ from: EARLIEST, rates: { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5, cacheWritePerMillion: 1 } }],
      'deepseek-reasoner': [{ from: EARLIEST, rates: { inputPerMillion: 4, outputPerMillion: 16, cacheReadPerMillion: 1, cacheWritePerMillion: 2 } }],
    } }
    const summary = await buildSummary(dir, () => new Date('2026-02-02T00:00:00Z'), (r) => rateKeyAt(table, r.provider, r.model, r.time), { error: () => {} })
    const costed = attachCosts(summary, table)
    check('totals: input', summary.total.inputTokens === 2180, `got ${summary.total.inputTokens}`)
    check('totals: output', summary.total.outputTokens === 1000, `got ${summary.total.outputTokens}`)
    check('totals: requests = 3 (2 assistant + 1 compaction)', summary.total.requests === 3, `got ${summary.total.requests}`)
    check('totals: compactions = 1', summary.total.compactions === 1)
    check('totals: failures = 2 (retry + turnEnd)', summary.total.failures === 2, `got ${summary.total.failures}`)
    check('cost is non-zero', costed.totalCost > 0, `got ${costed.totalCost}`)
    check('byDay populated', summary.byDay.length === 1 && totalsTokens(summary.byDay[0]!.totals) === 3780, `got ${totalsTokens(summary.byDay[0]!.totals)}`)
    // Aggregation identity is (provider, model): the two deepseek rows group
    // under their provider, and the two unattributed failure rows (retry +
    // turnEnd carry the last-known model but no provider header) form a third
    // row under the '' provider — never silently merged into the billed rows.
    check('byModel split by (provider, model)',
      summary.byModel.length === 3
        && summary.byModel.some(r => r.provider === 'deepseek' && r.model === 'deepseek-chat' && r.totals.requests === 2)
        && summary.byModel.some(r => r.provider === 'deepseek' && r.model === 'deepseek-reasoner' && r.totals.requests === 1)
        && summary.byModel.some(r => r.provider === '' && r.model === 'deepseek-reasoner' && r.totals.failures === 2),
      `got ${summary.byModel.map(r => `${r.provider}|${r.model}|r${String(r.totals.requests)}f${String(r.totals.failures)}`).join(',')}`)
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

console.log('provider cards (per-provider tab math)')
{
  // The same model id billed by two providers must NOT merge: the card is
  // per provider, so a (provider, model) pair is unique inside its partition.
  const records: UsageRecord[] = [
    { requestId: 'r1', time: dayMillis('2026-03-01', 9), sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-v4-flash', usage: { inputTokens: 1000, outputTokens: 200 } },
    { requestId: 'r2', time: dayMillis('2026-03-01', 9), sessionId: 's2', provider: 'opencode-go', model: 'deepseek-v4-flash', usage: { inputTokens: 500, outputTokens: 50 } },
    { requestId: 'r3', time: dayMillis('2026-03-01', 10), sessionId: 's2', provider: 'opencode-go', model: 'glm-5.3-flash', usage: { inputTokens: 300, outputTokens: 40, cacheReadTokens: 200 } },
    { requestId: 'r4', time: dayMillis('2026-03-01', 10), sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-v4-flash', kind: 'failure', failureCode: 'QUOTA' },
  ]
  const pricing = {
    'deepseek-official': { 'deepseek-v4-flash': [{ from: EARLIEST, rates: { inputPerMillion: 2, outputPerMillion: 8 } }] },
    'opencode-go': {
      'deepseek-v4-flash': [{ from: EARLIEST, rates: { inputPerMillion: 2, outputPerMillion: 8 } }],
      'glm-5.3-flash': [{ from: EARLIEST, rates: { inputPerMillion: 3, outputPerMillion: 10, cacheReadPerMillion: 1 } }],
    },
  }
  const cards = providerCards(records, pricing, (r) => rateKeyAt(pricing, r.provider, r.model, r.time))
  check('two provider cards (no merge)', cards.length === 2, `got ${cards.length}`)
  const deepseek = cards.find(c => c.provider === 'deepseek-official')
  const opencode = cards.find(c => c.provider === 'opencode-go')
  check('provider keys kept', deepseek !== undefined && opencode !== undefined)
  check('requests exclude failures', deepseek?.requests === 1 && opencode?.requests === 2, `deepseek=${deepseek?.requests} opencode=${opencode?.requests}`)
  check('deepseek card tokens = 1200', deepseek?.tokens === 1200, `got ${deepseek?.tokens}`)
  check('opencode card tokens = 1090', opencode?.tokens === 1090, `got ${opencode?.tokens}`)
  check('opencode card cost', opencode !== undefined && Math.abs(opencode.cost - 0.0029) < 1e-12, `got ${opencode?.cost}`)
  check('unpriced none', deepseek?.unpricedModels.length === 0)
  check('same model in both cards', deepseek?.models.length === 1 && opencode?.models.length === 2)
  check('sort: tokens desc', cards[0]?.provider === 'deepseek-official' && cards[1]?.provider === 'opencode-go')

  // Unpriced model surfaces in the card and costs ¥0.
  const unpriced = providerCards([{ requestId: 'r5', time: dayMillis('2026-03-01', 11), sessionId: 's3', provider: 'mystery', model: 'brand-new-x', usage: { inputTokens: 10, outputTokens: 10 } }], pricing, (r) => rateKeyAt(pricing, r.provider, r.model, r.time))
  check('unpriced model flagged', unpriced[0]?.unpricedModels.join() === 'brand-new-x' && unpriced[0]?.cost === 0 && unpriced[0]?.models[0]?.cost === 0)
}

console.log('range day window')
{
  const now = () => new Date('2026-03-05T15:30:00')
  const today = rangeDayWindow('today', now)
  check('today = [2026-03-05, 2026-03-05]', today.fromDay === '2026-03-05' && today.toDay === '2026-03-05', JSON.stringify(today))
  const yesterday = rangeDayWindow('yesterday', now)
  check('yesterday = [2026-03-04, 2026-03-04]', yesterday.fromDay === '2026-03-04' && yesterday.toDay === '2026-03-04', JSON.stringify(yesterday))
  const week = rangeDayWindow('last7', now)
  check('last7 = 7 calendar days ending today', week.fromDay === '2026-02-27' && week.toDay === '2026-03-05', JSON.stringify(week))
  const month = rangeDayWindow('last30', now)
  check('last30 spans 30 days', month.fromDay === '2026-02-04' && month.toDay === '2026-03-05', JSON.stringify(month))
}

console.log('readRecordsByDayRange (windowed day-file reads)')
{
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-range-'))
  try {
    const log = new UsageLog(dir, { error: () => {} })
    // Three day files: 2026-03-01, 2026-03-04, 2026-03-05 (a hole at 02/03).
    const rec = (requestId: string, day: string, hour: number): UsageRecord => ({
      requestId, time: dayMillis(day, hour), sessionId: 's1', model: 'm', provider: 'p', usage: { inputTokens: 1, outputTokens: 1 },
    })
    for (const [id, day, hour] of [['a1', '2026-03-01', 9], ['a2', '2026-03-04', 9], ['a3', '2026-03-05', 9]] as const) {
      await log.record(rec(id, day, hour))
    }
    await log.flush()
    const within = await readRecordsByDayRange(dir, '2026-03-04', '2026-03-05', () => new Date('2026-03-05T10:00:00'), { error: () => {} })
    check('window returns only in-range rows', within.length === 2 && within.every(r => r.requestId !== 'a1'), `got ${within.map(r => r.requestId).join(',')}`)
    const single = await readRecordsByDayRange(dir, '2026-03-05', '2026-03-05', () => new Date('2026-03-05T10:00:00'), { error: () => {} })
    check('single-day window', single.length === 1 && single[0]!.requestId === 'a3')
    const empty = await readRecordsByDayRange(dir, '2026-03-02', '2026-03-03', () => new Date('2026-03-05T10:00:00'), { error: () => {} })
    check('hole reads nothing, not crash', empty.length === 0)
    const inverted = await readRecordsByDayRange(dir, '2026-03-06', '2026-03-05', () => new Date('2026-03-05T10:00:00'), { error: () => {} })
    check('inverted window reads nothing', inverted.length === 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

console.log('quota: window normalization (Command Code credits block)')
{
  const now = new Date(2026, 2, 10, 15, 0, 0).getTime()
  const w = windowFromCreditsBlock('fiveHour', '5 小时',
    { used: 8.4, cap: 14, exceeded: false, resetAt: now + 3 * 3_600_000 }, now)
  check('cc window keeps used/cap', w.usedUsd === 8.4 && w.capUsd === 14, JSON.stringify(w))
  check('cc window percent = used/cap', Math.abs(w.usagePercent - 60) < 1e-9, `got ${w.usagePercent}`)
  check('cc window exceeded false', w.exceeded === false)
  check('cc window resetAt kept as ms', w.resetAt === now + 3 * 3_600_000)
  const over = windowFromCreditsBlock('weekly', '本周',
    { used: 40, cap: 35, exceeded: true, resetAt: now + 86_400_000 }, now)
  check('cc over-cap flags exceeded + 100%', over.exceeded === true && over.usagePercent === 100)
  const missing = windowFromCreditsBlock('fiveHour', '5 小时', undefined, now)
  check('cc missing block yields empty ok row', missing.usedUsd === undefined && missing.capUsd === undefined && missing.exceeded === false && missing.resetAt === null)
  const zero = windowFromCreditsBlock('weekly', '本周', { used: 0, cap: 35, exceeded: false, resetAt: now }, now)
  check('cc zero used percent 0', zero.usagePercent === 0 && zero.exceeded === false)
}

console.log('quota: window normalization (OpenCode Go usage-percent)')
{
  const now = Date.now()
  const w = windowFromUsagePercent('rolling5h', '5 小时', { status: 'ok', resetInSec: 1500, usagePercent: 25 }, now)
  check('go window percent kept', w.usagePercent === 25)
  check('go resetInSec becomes epoch ms', w.resetAt === now + 1500 * 1000, `got ${w.resetAt} (now ${now})`)
  check('go not exceeded', w.exceeded === false)
  check('go has no amounts', w.usedUsd === undefined && w.capUsd === undefined)
  const limited = windowFromUsagePercent('monthly', '本月', { status: 'rate-limited', resetInSec: 100, usagePercent: 60 }, now)
  check('go rate-limited → exceeded + 100%', limited.exceeded === true && limited.usagePercent === 100)
  const missing = windowFromUsagePercent('weekly', '本周', undefined, now)
  check('go missing block yields empty ok row', missing.usagePercent === 0 && missing.resetAt === null && missing.exceeded === false)
}

console.log('quota: resetEpoch heuristics')
{
  const now = 1_800_000_000_000
  // Seconds-until-reset countdown (small, far from now-as-ms).
  const countdown = resetEpoch(5000, now)
  check('small number = seconds until reset', countdown === now + 5_000_000, `got ${countdown}`)
  // An absolute epoch-ms timestamp close to now is left as-is.
  const abs = resetEpoch(now + 10_000, now)
  check('large near-now number = epoch ms', abs === now + 10_000)
  // An ISO date string parses.
  const iso = resetEpoch('2026-03-11T00:00:00Z', now)
  check('ISO string parses to ms', typeof iso === 'number' && Number.isFinite(iso))
  // Garbage → null.
  check('garbage reset → null', resetEpoch('nonsense', now) === null && resetEpoch(undefined, now) === null)
}

console.log('quota: plan normalization helpers')
{
  const info = planInfoFromSubscriptions({ planId: 'individual-goat', status: 'active', currentPeriodEnd: 1_800_000_000_000 })
  check('plan info keeps id/status/period', info?.planId === 'individual-goat' && info?.status === 'active' && info?.periodEnd === 1_800_000_000_000)
  check('plan info omits empties', planInfoFromSubscriptions({}) === undefined)
  const u = unconfiguredCard('opencode-go')
  check('unconfigured card shape', u.state === 'unconfigured' && u.windows.length === 0 && u.message !== undefined)
  const e = errorCard('commandcode', 'boom')
  check('error card shape', e.state === 'error' && e.message === 'boom')
  check('hasQuotaContent negative on empty ok card', hasQuotaContent({ plan: 'x', title: 'x', state: 'ok', windows: [] }) === false)
}

console.log('quota: builtin plan identity')
{
  check('opencode-go is builtin', isBuiltinQuotaPlan('opencode-go') && isBuiltinQuotaPlan('commandcode'))
  check('unknown is not builtin', isBuiltinQuotaPlan('zen') === false)
  check('titles', BUILTIN_PLAN_TITLES['opencode-go'] === 'OpenCode Go' && BUILTIN_PLAN_TITLES['commandcode'] === 'Command Code')
}

console.log('quota: official key resolution (env + config, no network)')
{
  // A fake credentials seam, mapping ref → key.
  const seam = (map: Record<string, string>) => ({ resolve: async (ref: string) => map[ref] })
  // No key anywhere → undefined.
  const none = await resolvePlanApiKey('opencode-go', undefined, seam({}))
  check('no key resolves to undefined', none === undefined)
  // The seam supplies the provider's default ref.
  const viaSeam = await resolvePlanApiKey('opencode-go', undefined, seam({ OPENCODE_GO_API_KEY: 'seam-go' }))
  check('seam default ref key', viaSeam === 'seam-go')
  // config literal wins over the seam.
  const cfg = await resolvePlanApiKey('opencode-go', { apiKey: 'cfg-key' }, seam({ OPENCODE_GO_API_KEY: 'seam-go' }))
  check('config apiKey wins', cfg === 'cfg-key')
  // custom ref via apiKeyEnv.
  const custom = await resolvePlanApiKey('commandcode', { apiKeyEnv: 'MY_CC_KEY' }, seam({ MY_CC_KEY: 'custom-key' }))
  check('apiKeyEnv custom ref', custom === 'custom-key')
  // commandcode default ref name.
  const cc = await resolvePlanApiKey('commandcode', undefined, seam({ COMMANDCODE_API_KEY: 'cc-key' }))
  check('commandcode default ref', cc === 'cc-key')
  // A throwing seam degrades to unconfigured (no throw).
  const broken = await resolvePlanApiKey('opencode-go', undefined, { resolve: async () => { throw new Error('boom') } })
  check('throwing seam → undefined', broken === undefined)
}

console.log('quota: fetcher failure/unconfigured shapes (no live network)')
{
  // A provider with no key in the seam must return an unconfigured card
  // without attempting a network call.
  const card = await fetchOpenCodeGoQuota({ credentials: { resolve: async () => undefined } })
  check('go no-key → unconfigured card', card.state === 'unconfigured' && card.windows.length === 0)
  const cc = await fetchCommandCodeQuota({ credentials: { resolve: async () => undefined } })
  check('commandcode no-key → unconfigured card', cc.state === 'unconfigured' && cc.windows.length === 0)
  const unknown = await fetchOfficialQuota('not-a-provider', {})
  check('unknown provider → error card', unknown.state === 'error')
}

console.log('quota: opencode-go real endpoint parse (usage.rolling/percent/resetsAt)')
{
  // The live shape (verified via cc-switch #6433 and dsh-opencode-go-usage).
  const now = Date.parse('2026-08-14T07:00:00Z')
  const body = {
    usage: {
      rolling: { status: 'ok', percent: 9, resetsAt: '2026-08-14T07:20:04.810Z' },
      weekly: { status: 'ok', percent: 12, resetsAt: '2026-08-17T00:00:00.810Z' },
      monthly: { status: 'ok', percent: 6, resetsAt: '2026-09-09T00:41:03.810Z' },
    },
  }
  const card = parseOpenCodeGoUsage(body as never, now)
  check('go parse: 3 windows in order', card.windows.map((w) => w.id).join(',') === 'rolling5h,weekly,monthly', card.windows.map((w) => w.id).join(','))
  const rolling = card.windows[0]!
  check('go parse: percent kept', rolling.usagePercent === 9)
  check('go parse: ok not exceeded', rolling.exceeded === false)
  check('go parse: resetsAt ISO → epoch', rolling.resetAt === Date.parse('2026-08-14T07:20:04.810Z'), `got ${rolling.resetAt}`)
  check('go parse: no amounts', rolling.usedUsd === undefined && rolling.capUsd === undefined)
  check('go parse: card ok', card.state === 'ok' && card.plan === 'opencode-go')

  // Throttled window: status 'rate-limited' (or any non-ok) → exceeded + 100%.
  const limited = parseOpenCodeGoUsage({
    usage: {
      rolling: { status: 'rate-limited', percent: 60, resetsAt: '2026-08-14T07:20:00Z' },
      weekly: { status: 'ok', percent: 40, resetsAt: '2026-08-17T00:00:00Z' },
    },
  } as never, now)
  check('go parse: rate-limited → exceeded + 100%', limited.windows[0]!.exceeded === true && limited.windows[0]!.usagePercent === 100)
  check('go parse: partial windows (2)', limited.windows.length === 2)

  // Empty body → windows 0 (the fetcher turns this into an error card).
  const empty = parseOpenCodeGoUsage({ usage: {} } as never, now)
  check('go parse: empty usage yields no windows', empty.windows.length === 0)
}

console.log('dual-bucket cost: spend vs subscriptionValue')
{
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-dualbucket-'))
  try {
    // The SAME model string on three routes: the price file's `$billing` is what
    // decides each route's bucket, and a route nothing declares is metered.
    const pricing = {
      'deepseek-official': { 'deepseek-v4-flash': [{ from: EARLIEST, rates: { inputPerMillion: 2, outputPerMillion: 8 } }] },
      'opencode-go': { 'deepseek-v4-flash': [{ from: EARLIEST, rates: { inputPerMillion: 2, outputPerMillion: 8 } }] },
      'commandcode': { 'deepseek/deepseek-v4-flash': [{ from: EARLIEST, rates: { inputPerMillion: 2, outputPerMillion: 8 } }] },
    }
    const billing = { 'opencode-go': 'subscription' as const, 'commandcode': 'subscription' as const }
    const resolve = (r: UsageRecord) => rateKeyAt(pricing, r.provider, r.model, r.time)
    const t = dayMillis('2026-08-17', 9)
    const recs: UsageRecord[] = [
      // metered route, 1M input → ¥2 (spend)
      { requestId: 'official-1', time: t, sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-v4-flash', usage: { inputTokens: 1_000_000, outputTokens: 0 } },
      // subscription route, same model string → ¥2 (value)
      { requestId: 'opencode-1', time: t, sessionId: 's2', provider: 'opencode-go', model: 'deepseek-v4-flash', usage: { inputTokens: 1_000_000, outputTokens: 0 } },
      // its own prefixed string on another subscription route → ¥1 (value)
      { requestId: 'cc-1', time: t, sessionId: 's3', provider: 'commandcode', model: 'deepseek/deepseek-v4-flash', usage: { inputTokens: 500_000, outputTokens: 0 } },
      // no route header at all → nothing prices it, and it bills ¥0
      { requestId: 'direct-1', time: t, sessionId: 's4', model: 'deepseek-v4-flash', usage: { inputTokens: 500_000, outputTokens: 0 } },
    ]
    const summary = summarizeRecords(recs, resolve)
    const costed = attachCosts({ dataDir: dir, ...summary }, pricing, billing)
    check('totalCost = 2 + 2 + 1 (+0) = ¥5', Math.abs(costed.totalCost - 5) < 1e-9, `got ${costed.totalCost}`)
    check('spend = the metered route only = ¥2', Math.abs(costed.spend - 2) < 1e-9, `got ${costed.spend}`)
    check('subscriptionValue = the two subscription routes = ¥3', Math.abs(costed.subscriptionValue - 3) < 1e-9, `got ${costed.subscriptionValue}`)
    // The same model string must not merge across routes.
    check('byModel splits by route: 4 rows', costed.byModel.length === 4, `got ${costed.byModel.length}`)
    const official = costed.byModel.find(r => r.provider === 'deepseek-official' && r.model === 'deepseek-v4-flash')
    const opencode = costed.byModel.find(r => r.provider === 'opencode-go' && r.model === 'deepseek-v4-flash')
    check('metered row: spend only', official !== undefined && Math.abs(official.cost - 2) < 1e-9 && Math.abs(official.spend - 2) < 1e-9 && official.subscriptionValue === 0)
    check('subscription row: value only', opencode !== undefined && Math.abs(opencode.cost - 2) < 1e-9 && Math.abs(opencode.subscriptionValue - 2) < 1e-9 && opencode.spend === 0)
    check('a route nothing prices is listed as 价格未知 and costs ¥0', costed.unpricedModels.includes('deepseek-v4-flash') && costed.byModel.find(r => r.provider === '')?.cost === 0)
    // The per-day cost layer must add up to the totals: the hero reads a day row
    // while the meta line reads the total, so a drift would show two different
    // money numbers on the same screen.
    const daySpend = costed.byDay.reduce((acc, row) => acc + (row.spend ?? 0), 0)
    const dayValue = costed.byDay.reduce((acc, row) => acc + (row.subscriptionValue ?? 0), 0)
    check('byDay spend sums to spend', Math.abs(daySpend - costed.spend) < 1e-9, `got ${daySpend}`)
    check('byDay value sums to subscriptionValue', Math.abs(dayValue - costed.subscriptionValue) < 1e-9, `got ${dayValue}`)
    check('the day row carries ¥2 / ¥3', costed.byDay.length === 1 && costed.byDay[0]!.spend === 2 && costed.byDay[0]!.subscriptionValue === 3)
    const recent = costRecentEntries(recs, pricing, billing)
    const officialRecent = recent.find(r => r.requestId === 'official-1')
    const opencodeRecent = recent.find(r => r.requestId === 'opencode-1')
    check('recent metered row: spend', officialRecent?.cost === 2 && officialRecent?.spend === 2 && officialRecent?.subscriptionValue === 0)
    check('recent subscription row: value', opencodeRecent?.cost === 2 && opencodeRecent?.subscriptionValue === 2 && opencodeRecent?.spend === 0)
    check('recent unattributed row: ¥0', recent.find(r => r.requestId === 'direct-1')?.cost === 0)
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
