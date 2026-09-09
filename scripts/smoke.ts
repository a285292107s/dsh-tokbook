// Smoke test of the pure aggregation + pricing math (no DSH runtime needed).
// Run with: node --experimental-strip-types scripts/smoke.ts
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { summarizeRecords, mergeSummaries, attachCosts, emptyTotals, totalsTokens, buildSummary, isLedgerStale, staleSessionIds, readRecordsByDayRange, rangeDayWindow, costRecentEntries } from '../src/stats.ts'
import { resolveRate, ratesForKey, costOf, coercePricingTable, cloudToTable, coerceCloudPricing, parseManualPricingInput, writeManualPricing, readManualPricing, readPricingTable, readPricingView, PRICING_CCSA_FILE, PRICING_FILE, coerceProviderPricing, coerceProviderLabels, readProviderPricing, resolvePriced, syncProviderPricing, PROVIDER_PRICING_CCSA_FILE, PROVIDER_PRICING_FILE, PROVIDER_ROUTES_KEY, applyProviderAliases, coerceProviderAliases, parseManualProviderPricingInput, readManualProviderOverlay, readProviderPricingView, writeManualProviderOverlay } from '../src/pricing.ts'
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

console.log('pricing rule chain + cost')
{  const table = { 'deepseek-chat': { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5, cacheWritePerMillion: 1 } }
  const r = resolveRate({ base: table['deepseek-chat']!, contextTiers: [], dailySlots: [], timeRules: [] }, dayMillis('2026-01-01', 10), 0)
  check('base rate identity', r.key.tier === 0 && r.key.slot === -1)
  const cost = costOf({ requests: 1, inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 200_000, cacheWriteTokens: 100_000, compactions: 0, failures: 0 }, r.prices)
  check('costOf math', Math.abs(cost - (2 + 4 + 0.1 + 0.1)) < 1e-9, `got ${cost}`)
  const priced = coercePricingTable(table)
  check('coercePricingTable', priced['deepseek-chat']?.inputPerMillion === 2)
}

console.log('manual pricing file write/read/merge/view')
{
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-pricing-'))
  try {
    // Simulate a synced cloud mirror: deepseek-chat (with a peak slot, i.e.
    // layered), deepseek-reasoner (flat), gpt-5.6-luna with an alias.
    const feed = {
      version: 1,
      updatedAt: 0,
      currency: 'RMB',
      models: [
        { modelId: 'deepseek-chat', inputCostPerMillion: 2, outputCostPerMillion: 8, cacheReadCostPerMillion: 0.5, cacheCreationCostPerMillion: 0,
          family: 'deepseek',
          dailySlots: [{ label: 'peak', windows: [{ startMinute: 540, endMinute: 720 }], inputCostPerMillion: 4, outputCostPerMillion: 16 }],
          contextTiers: [], timeRules: [], aliases: ['deepseek-chat-v3'] },
        { modelId: 'deepseek-reasoner', inputCostPerMillion: 4, outputCostPerMillion: 16, cacheReadCostPerMillion: 1, cacheCreationCostPerMillion: 0,
          family: 'deepseek',
          dailySlots: [], contextTiers: [], timeRules: [], aliases: [] },
        { modelId: 'gpt-5.6-luna', inputCostPerMillion: 3, outputCostPerMillion: 12, cacheReadCostPerMillion: 0, cacheCreationCostPerMillion: 0,
          dailySlots: [], contextTiers: [], timeRules: [], aliases: [] },
      ],
    }
    // Persist the feed as the synced mirror (what `readSyncedPricing` reads).
    await writeFile(join(dir, PRICING_CCSA_FILE), JSON.stringify(feed), 'utf8')
    const view0 = await readPricingView(dir, new Map(), { error: () => {} })
    check('empty manual file → view has only cloud rows', view0.rows.length === 4, `got ${view0.rows.length}`)
    // The cloud feed's vendor grouping rides along on every cloud key, aliases
    // included; a model the feed does not name carries no family at all.
    check('cloud row carries its family', view0.rows.find(r => r.model === 'deepseek-chat')?.family === 'deepseek')
    check('alias carries its model\'s family', view0.rows.find(r => r.model === 'deepseek-chat-v3')?.family === 'deepseek')
    check('unnamed cloud row has no family', view0.rows.find(r => r.model === 'gpt-5.6-luna')?.family === undefined)
    // Write a manual entry for one flat cloud model and one brand-new model.
    const parsed = parseManualPricingInput({
      'deepseek-reasoner': { inputPerMillion: 4.5, outputPerMillion: 18 },
      'brand-new-x': { inputPerMillion: 9, outputPerMillion: 36, cacheReadPerMillion: 1 },
    })
    check('parse ok', parsed.ok === true)
    if (parsed.ok) {
      await writeManualPricing(dir, parsed.table, { error: () => {} })
      const manual = await readManualPricing(dir, { error: () => {} })
      check('manual file round-trips', manual['deepseek-reasoner']?.base.inputPerMillion === 4.5 && manual['brand-new-x']?.base.cacheReadPerMillion === 1)
      const merged = await readPricingTable(dir, { error: () => {} })
      check('manual wins wholesale', merged['deepseek-reasoner']?.base.inputPerMillion === 4.5 && merged['deepseek-reasoner']?.timeRules.length === 0)
      check('manual-only model added', merged['brand-new-x']?.base.inputPerMillion === 9)
      check('cloud model still present', merged['deepseek-chat']?.base.inputPerMillion === 2)
      const view1 = await readPricingView(dir, new Map([['deepseek-v4-pro', { records: 3, overlayPriced: false }]]), { error: () => {} })
      // 6 = manual-only brand-new-x + deepseek-reasoner (manual now covers a
      //     cloud row, merged view still lists it once) + 3 remaining cloud rows
      //     + 1 unpriced ledger model (deepseek-v4-pro).
      check('view lists manual + cloud', view1.rows.length === 6, `got ${view1.rows.length}`)
      check('unpriced ledger model surfaces', view1.rows.some(r => r.model === 'deepseek-v4-pro' && r.unpriced === true && r.records === 3))
      const manualRow = view1.rows.find(r => r.model === 'deepseek-reasoner')
      check('manual row flagged with both rates', manualRow?.manual === true && manualRow.manualRates?.inputPerMillion === 4.5 && manualRow.cloudRates?.inputPerMillion === 4)
      check('manual row carries full rules + now', manualRow?.manualRules?.base.inputPerMillion === 4.5 && manualRow.now?.rates.inputPerMillion === 4.5)
      const cloudRow = view1.rows.find(r => r.model === 'deepseek-chat')
      check('layered cloud row flagged', cloudRow?.manual === false && cloudRow.layered === true)
      check('layered cloud row carries rules + now', cloudRow?.cloudRules?.dailySlots.length === 1 && cloudRow.now !== undefined)
      // Manual entry for a layered model replaces the whole rule set (flat).
      const parse2 = parseManualPricingInput({ 'deepseek-chat': { inputPerMillion: 1.9, outputPerMillion: 7.6 } })
      check('parse replaces layered', parse2.ok === true)
      if (parse2.ok) {
        await writeManualPricing(dir, parse2.table, { error: () => {} })
        const merged2 = await readPricingTable(dir, { error: () => {} })
        check('layered replaced wholesale', merged2['deepseek-chat']?.timeRules.length === 0 && merged2['deepseek-chat']?.dailySlots.length === 0 && merged2['deepseek-chat']?.base.inputPerMillion === 1.9)
      }
    }
    check('parse rejects junk', parseManualPricingInput([1, 2]).ok === false)
    check('parse rejects missing output', (() => { const r = parseManualPricingInput({ m: { inputPerMillion: 1 } }); return r.ok === false && 'error' in r && (r as { error: string }).error !== '' })())
    check('parse rejects negative', parseManualPricingInput({ m: { inputPerMillion: -1, outputPerMillion: 2 } }).ok === false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

console.log('manual rule sets: price timeline + peak windows')
{
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-manual-rules-'))
  try {
    const body = {
      'deepseek-v4-flash': {
        base: { inputPerMillion: 1.5, outputPerMillion: 4.5, cacheReadPerMillion: 0.05 },
        dailySlots: [{
          label: '工作日高峰',
          daysOfWeek: [1, 2, 3, 4, 5],
          windows: [{ startMinute: 540, endMinute: 720 }],
          rates: { inputPerMillion: 3, outputPerMillion: 9 },
        }],
        timeRules: [
          { label: '原价', startTime: 0, endTime: 1786895999, rates: { inputPerMillion: 1, outputPerMillion: 2 } },
          { label: '限时5折', startTime: 1787760000, endTime: 1788969599, rates: { inputPerMillion: 0.4, outputPerMillion: 1.4 } },
        ],
      },
    }
    const parsed = parseManualPricingInput(body)
    check('parse layered ok', parsed.ok === true, parsed.ok ? '' : (parsed as { error: string }).error)
    if (parsed.ok) {
      await writeManualPricing(dir, parsed.table, { error: () => {} })
      const fileText = await readFile(join(dir, 'pricing.json'), 'utf8')
      check('layered file keeps both rule lists', fileText.includes('"timeRules"') && fileText.includes('"dailySlots"'))
      const reread = await readManualPricing(dir, { error: () => {} })
      check('layered round-trips', reread['deepseek-v4-flash']?.timeRules.length === 2
        && reread['deepseek-v4-flash']?.dailySlots.length === 1
        && reread['deepseek-v4-flash']?.timeRules[1]?.label === '限时5折'
        && reread['deepseek-v4-flash']?.base.inputPerMillion === 1.5)
      const merged = await readPricingTable(dir, { error: () => {} })
      // Inside the discount window the rule's flat rate wins — even on a
      // weekday morning, because a rule without its own slots replaces the
      // root slots (the engine's documented chain).
      const discount = resolvePriced(merged, {}, undefined, 'deepseek-v4-flash', dayMillis('2026-08-28', 10), 0)
      check('timeline wins inside its window', discount.prices.inputPerMillion === 0.4 && discount.key.ruleStart === 1787760000, JSON.stringify(discount.prices))
      // Outside every rule the base container applies, and its peak window
      // still bites on a weekday morning.
      const peak = resolvePriced(merged, {}, undefined, 'deepseek-v4-flash', dayMillis('2026-09-15', 10), 0)
      check('peak window applies outside the timeline', peak.prices.inputPerMillion === 3 && peak.key.slot === 0, JSON.stringify(peak.key))
      const offPeak = resolvePriced(merged, {}, undefined, 'deepseek-v4-flash', dayMillis('2026-09-15', 13), 0)
      check('off-peak falls back to base', offPeak.prices.inputPerMillion === 1.5 && offPeak.key.slot === -1)
      const weekend = resolvePriced(merged, {}, undefined, 'deepseek-v4-flash', dayMillis('2026-09-19', 10), 0)
      check('weekend is never peak', weekend.prices.inputPerMillion === 1.5 && weekend.key.slot === -1)
      const view = await readPricingView(dir, new Map(), { error: () => {} })
      const row = view.rows.find(r => r.model === 'deepseek-v4-flash')
      check('view carries rules + now', row?.manualRules?.timeRules.length === 2 && row.now !== undefined && row.layered === true)
      // Flat entries stay flat on disk (backward-compatible file shape).
      const flat = parseManualPricingInput({ m: { inputPerMillion: 1, outputPerMillion: 2 } })
      if (flat.ok) {
        await writeManualPricing(dir, flat.table, { error: () => {} })
        check('flat entry stays a bare slate', (await readFile(join(dir, 'pricing.json'), 'utf8')).trim() === '{\n  "m": {\n    "inputPerMillion": 1,\n    "outputPerMillion": 2\n  }\n}')
      }
    }
    check('parse rejects unknown rule field', parseManualPricingInput({ m: { base: { inputPerMillion: 1, outputPerMillion: 2 }, tiers: [] } }).ok === false)
    check('parse rejects missing base', parseManualPricingInput({ m: { timeRules: [] } }).ok === false)
    check('parse rejects inverted window', parseManualPricingInput({ m: { base: { inputPerMillion: 1, outputPerMillion: 2 }, dailySlots: [{ windows: [{ startMinute: 720, endMinute: 540 }], rates: { inputPerMillion: 1, outputPerMillion: 2 } }] } }).ok === false)
    check('parse rejects empty windows', parseManualPricingInput({ m: { base: { inputPerMillion: 1, outputPerMillion: 2 }, dailySlots: [{ windows: [], rates: { inputPerMillion: 1, outputPerMillion: 2 } }] } }).ok === false)
    check('parse rejects inverted rule', parseManualPricingInput({ m: { base: { inputPerMillion: 1, outputPerMillion: 2 }, timeRules: [{ startTime: 10, endTime: 5, rates: { inputPerMillion: 1, outputPerMillion: 2 } }] } }).ok === false)
    check('parse rejects bad weekday', parseManualPricingInput({ m: { base: { inputPerMillion: 1, outputPerMillion: 2 }, dailySlots: [{ windows: [{ startMinute: 0, endMinute: 60 }], daysOfWeek: [0], rates: { inputPerMillion: 1, outputPerMillion: 2 } }] } }).ok === false)
    check('empty table clears everything', (() => { const r = parseManualPricingInput({}); return r.ok === true && Object.keys(r.table).length === 0 })())
    // Overlapping price windows are ambiguous (the engine takes the first
    // match) — the write path refuses them.
    check('parse rejects overlapping rules', parseManualPricingInput({
      m: {
        base: { inputPerMillion: 1, outputPerMillion: 2 },
        timeRules: [
          { startTime: 0, endTime: 100, rates: { inputPerMillion: 1, outputPerMillion: 2 } },
          { startTime: 50, endTime: 200, rates: { inputPerMillion: 3, outputPerMillion: 6 } },
        ],
      },
    }).ok === false)
    // A hand-written file with out-of-order windows is read sorted, so the
    // resolution order (first match) is deterministic.
    await writeFile(join(dir, PRICING_FILE), JSON.stringify({
      m: {
        base: { inputPerMillion: 1, outputPerMillion: 2 },
        timeRules: [
          { startTime: 200, endTime: 300, rates: { inputPerMillion: 3, outputPerMillion: 6 }, label: 'late' },
          { startTime: 100, endTime: 150, rates: { inputPerMillion: 4, outputPerMillion: 8 }, label: 'early' },
        ],
      },
    }), 'utf8')
    const sortedRead = await readManualPricing(dir, { error: () => {} })
    check('read sorts the hand timeline by start', sortedRead['m']?.timeRules[0]?.label === 'early' && sortedRead['m']?.timeRules[1]?.label === 'late')
    // An omitted endTime means "permanent": it resolves far in the future and
    // is written back without an endTime (so the file stays readable).
    const openEnded = parseManualPricingInput({
      m: { base: { inputPerMillion: 1, outputPerMillion: 2 }, timeRules: [{ startTime: 0, rates: { inputPerMillion: 3, outputPerMillion: 6 }, label: '永久价' }] },
    })
    check('parse accepts omitted endTime', openEnded.ok === true)
    if (openEnded.ok) {
      check('open-ended rule still applies in 2030', resolvePriced(openEnded.table, {}, undefined, 'm', dayMillis('2030-01-01', 10), 0).prices.inputPerMillion === 3)
      await writeManualPricing(dir, openEnded.table, { error: () => {} })
      const text = await readFile(join(dir, 'pricing.json'), 'utf8')
      check('open-ended rule writes no endTime', text.includes('"startTime"') && !text.includes('"endTime"'), text)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

console.log('costRecentEntries (recent-window per-row cost)')
{
  const table = {
    'deepseek-chat': { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5, cacheWritePerMillion: 1 },
  }
  const pricing = tableOf(table)
  const resolve = (r: UsageRecord) => {
    const rules = pricing[r.model]
    if (rules === undefined) return { ruleStart: 0, ruleEnd: 0, tier: 0, slot: -1 }
    const usage = r.usage
    const ctx = usage === undefined ? 0 : usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
    return resolveRate(rules, r.time, ctx).key
  }
  const t = dayMillis('2026-01-01', 10)
  const recs: UsageRecord[] = [
    { requestId: 'paid', time: t, sessionId: 's1', model: 'deepseek-chat', usage: { inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 200_000, cacheWriteTokens: 100_000 } },
    { requestId: 'unpriced', time: t, sessionId: 's2', model: 'no-such-model', usage: { inputTokens: 10, outputTokens: 10 } },
    { requestId: 'nousage', time: t, sessionId: 's1', model: 'deepseek-chat' },
    { requestId: 'fail', time: t, sessionId: 's1', model: 'deepseek-chat', kind: 'failure', failureCode: 'RATE_LIMIT' },
    { requestId: 'compact', time: t, sessionId: 's1', model: 'deepseek-chat', kind: 'compaction', usage: { inputTokens: 100_000, outputTokens: 50_000 } },
  ]
  const costed = costRecentEntries(recs, pricing, resolve)
  check('entries keep request ids + order', costed.map(e => e.requestId).join(',') === 'paid,unpriced,nousage,fail,compact')
  // 2 + 4 + 0.1 + 0.1 = 6.2 (the smoke costOf baseline), compaction 0.2 + 0.4 = 0.6
  const paid = costed.find(e => e.requestId === 'paid')
  check('per-row cost of a full-bucket request', paid !== undefined && Math.abs(paid.cost - 6.2) < 1e-9, `got ${paid?.cost}`)
  const compact = costed.find(e => e.requestId === 'compact')
  check('compaction priced like a request', compact !== undefined && Math.abs(compact.cost - 0.6) < 1e-9, `got ${compact?.cost}`)
  check('unpriced model bills ¥0', costed.find(e => e.requestId === 'unpriced')?.cost === 0)
  check('request without usage bills ¥0', costed.find(e => e.requestId === 'nousage')?.cost === 0)
  check('failure row bills ¥0', costed.find(e => e.requestId === 'fail')?.cost === 0)
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
  const pricing = tableOf({
    'deepseek-v4-flash': { inputPerMillion: 2, outputPerMillion: 8 },
    'glm-5.3-flash': { inputPerMillion: 3, outputPerMillion: 10, cacheReadPerMillion: 1 },
  })
  const resolve = (r: UsageRecord) => {
    const rules = pricing[r.model]
    if (rules === undefined) return { ruleStart: 0, ruleEnd: 0, tier: 0, slot: -1 }
    const usage = r.usage
    const ctx = usage === undefined ? 0 : usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
    return resolveRate(rules, r.time, ctx).key
  }
  const cards = providerCards(records, pricing, resolve)
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
  const unpriced = providerCards([{ requestId: 'r5', time: dayMillis('2026-03-01', 11), sessionId: 's3', provider: 'mystery', model: 'brand-new-x', usage: { inputTokens: 10, outputTokens: 10 } }], pricing, resolve)
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

console.log('dual-dimension pricing: provider overlay resolution')
{
  // Base table: deepseek-v4-flash carries an official time-rule history
  // (old price until 2026-08-16, new peak price after).
  const base: Record<string, { base: Record<string, number>; contextTiers: unknown[]; dailySlots: unknown[]; timeRules: unknown[] }> = {}
  const dsBase = { inputPerMillion: 2, outputPerMillion: 8 }
  const dsOld = dayMillis('2026-08-16', 0) / 1000
  const dsEnd = dayMillis('2026-08-20', 0) / 1000
  base['deepseek-v4-flash'] = {
    base: dsBase,
    contextTiers: [],
    dailySlots: [],
    timeRules: [{ startTime: dsOld, endTime: dsEnd - 1, rates: { inputPerMillion: 1, outputPerMillion: 4 } }],
  }
  // Provider overlay mirrors the real dsh-model-pricing shape: a channel-level
  // `billing` covering its entries (a metered official channel, subscription
  // channels, a relay placeholder with an explicit ¥0 segments timeline), plus
  // an entry-level override for a mixed channel and a malformed channel billing.
  const overlay = coerceProviderPricing({
    currency: 'RMB',
    providers: [
      {
        provider: 'deepseek-official',
        billing: 'metered',
        entries: [{ model: 'deepseek-v4-flash', inheritBase: 'deepseek-v4-flash' }],
      },
      {
        provider: 'opencode-go',
        billing: 'subscription',
        entries: [{ model: 'deepseek-v4-flash', inheritBase: 'deepseek-v4-flash' }],
      },
      {
        provider: 'commandcode',
        billing: 'subscription',
        entries: [{ model: 'deepseek/deepseek-v4-flash', inheritBase: 'deepseek-v4-flash' }],
      },
      {
        provider: 'relay',
        billing: 'metered',
        entries: [{ model: 'unknown-relay-model', segments: [{ from: 0, rate: { inputPerMillion: 0, outputPerMillion: 0 } }] }],
      },
      {
        provider: 'mixed',
        billing: 'subscription',
        entries: [
          { model: 'deepseek-v4-flash', inheritBase: 'deepseek-v4-flash' },
          { model: 'deepseek-v4-flash-metered', billing: 'metered', inheritBase: 'deepseek-v4-flash' },
        ],
      },
      {
        provider: 'broken',
        billing: 'free',
        entries: [{ model: 'deepseek-v4-flash', inheritBase: 'deepseek-v4-flash' }],
      },
    ],
  })
  check('provider overlay coerces', overlay !== null && overlay!['commandcode']!['deepseek/deepseek-v4-flash']?.billing === 'subscription')
  if (overlay === null) throw new Error('overlay coerce failed')
  check('channel-level billing covers its entries', overlay['opencode-go']?.['deepseek-v4-flash']?.billing === 'subscription' && overlay['deepseek-official']?.['deepseek-v4-flash']?.billing === 'metered')
  check('entry-level billing overrides the channel default', overlay['mixed']?.['deepseek-v4-flash']?.billing === 'subscription' && overlay['mixed']?.['deepseek-v4-flash-metered']?.billing === 'metered')
  check('malformed channel billing drops the group', overlay['broken'] === undefined)
  const baseTable = base as never as Record<string, { base: Record<string, number>; contextTiers: unknown[]; dailySlots: unknown[]; timeRules: unknown[] }>

  // inheritBase follows the base model's full rule set (time rules included).
  const officialBefore = resolvePriced(baseTable, overlay, 'deepseek-official', 'deepseek-v4-flash', dayMillis('2026-08-15', 9), 0)
  const officialAfter = resolvePriced(baseTable, overlay, 'deepseek-official', 'deepseek-v4-flash', dayMillis('2026-08-17', 9), 0)
  check('inheritBase: old price before the time-rule window', officialBefore.prices.inputPerMillion === 2 && officialBefore.source === 'inheritBase', JSON.stringify(officialBefore.prices))
  check('inheritBase: rule price inside the time-rule window', officialAfter.prices.inputPerMillion === 1 && officialAfter.key.ruleStart === dsOld, JSON.stringify(officialAfter.prices))

  // Same model string, two providers → different billing natures.
  const opencode = resolvePriced(baseTable, overlay, 'opencode-go', 'deepseek-v4-flash', dayMillis('2026-08-17', 9), 0)
  check('same model on subscription provider is billed subscription', opencode.billing === 'subscription' && officialAfter.billing === 'metered')

  // Prefixed model string hits the provider entry via inheritBase.
  const cc = resolvePriced(baseTable, overlay, 'commandcode', 'deepseek/deepseek-v4-flash', dayMillis('2026-08-17', 9), 0)
  check('prefixed string resolves through its provider entry', cc.source === 'inheritBase' && cc.billing === 'subscription' && cc.prices.inputPerMillion === 1, JSON.stringify(cc))

  // Segments: ¥0 placeholder; a record with no provider overlay and no base
  // row stays unpriced.
  const relay = resolvePriced(baseTable, overlay, 'relay', 'unknown-relay-model', dayMillis('2026-08-17', 9), 0)
  check('segments entry resolves to its flat ¥0', relay.source === 'segments' && relay.prices.inputPerMillion === 0 && relay.billing === 'metered', JSON.stringify(relay))
  const ghost = resolvePriced(baseTable, overlay, 'mystery', 'ghost-model', dayMillis('2026-08-17', 9), 0)
  check('unknown provider + unknown model stays unpriced', ghost.source === 'unpriced' && ghost.prices.inputPerMillion === 0)
}

console.log('dual-bucket cost: spend vs subscriptionValue')
{
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-dualbucket-'))
  try {
    // Reuse the pricing overlay from the previous block, but compact: base
    // table has deepseek-v4-flash; the official channel bills metered, the
    // opencode-go channel bills subscription for the SAME model string.
    const base: Record<string, { base: Record<string, number>; contextTiers: unknown[]; dailySlots: unknown[]; timeRules: unknown[] }> = {
      'deepseek-v4-flash': { base: { inputPerMillion: 2, outputPerMillion: 8 }, contextTiers: [], dailySlots: [], timeRules: [] },
    }
    const overlay = coerceProviderPricing({
      currency: 'RMB',
      providers: [
        { provider: 'deepseek-official', entries: [{ model: 'deepseek-v4-flash', billing: 'metered', inheritBase: 'deepseek-v4-flash' }] },
        { provider: 'opencode-go', entries: [{ model: 'deepseek-v4-flash', billing: 'subscription', inheritBase: 'deepseek-v4-flash' }] },
        { provider: 'commandcode', entries: [{ model: 'deepseek/deepseek-v4-flash', billing: 'subscription', inheritBase: 'deepseek-v4-flash' }] },
      ],
    })
    if (overlay === null) throw new Error('overlay coerce failed')
    const resolve: (r: UsageRecord) => { ruleStart: number; ruleEnd: number; tier: number; slot: number } = (r) => {
      const usage = r.usage
      const ctx = usage === undefined ? 0 : usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
      return resolvePriced(base, overlay, r.provider, r.model, r.time, ctx).key
    }
    const t = dayMillis('2026-08-17', 9)
    const recs: UsageRecord[] = [
      // metered official channel, 1M input → ¥2 (spend)
      { requestId: 'official-1', time: t, sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-v4-flash', usage: { inputTokens: 1_000_000, outputTokens: 0 } },
      // subscription channel, same model string, 1M input → ¥2 (value)
      { requestId: 'opencode-1', time: t, sessionId: 's2', provider: 'opencode-go', model: 'deepseek-v4-flash', usage: { inputTokens: 1_000_000, outputTokens: 0 } },
      // prefixed string under commandcode subscription → value, priced via inheritBase
      { requestId: 'cc-1', time: t, sessionId: 's3', provider: 'commandcode', model: 'deepseek/deepseek-v4-flash', usage: { inputTokens: 500_000, outputTokens: 0 } },
      // unattributed model with base price → metered (spend)
      { requestId: 'direct-1', time: t, sessionId: 's4', model: 'deepseek-v4-flash', usage: { inputTokens: 500_000, outputTokens: 0 } },
    ]
    const summary = summarizeRecords(recs, resolve)
    const costed = attachCosts({ dataDir: dir, ...summary }, base, overlay)
    check('totalCost = 2 + 2 + 1 + 1 = ¥6', Math.abs(costed.totalCost - 6) < 1e-9, `got ${costed.totalCost}`)
    check('spend = official 2 + direct 1 = ¥3', Math.abs(costed.spend - 3) < 1e-9, `got ${costed.spend}`)
    check('subscriptionValue = opencode 2 + commandcode 1 = ¥3', Math.abs(costed.subscriptionValue - 3) < 1e-9, `got ${costed.subscriptionValue}`)
    // Three distinct (provider, model) rows — the same model string must not
    // merge across providers; the prefixed string is its own row too.
    check('byModel split by provider: 4 rows', costed.byModel.length === 4, `got ${costed.byModel.length}`)
    const official = costed.byModel.find(r => r.provider === 'deepseek-official' && r.model === 'deepseek-v4-flash')
    const opencode = costed.byModel.find(r => r.provider === 'opencode-go' && r.model === 'deepseek-v4-flash')
    check('official row: spend only', official !== undefined && Math.abs(official!.cost - 2) < 1e-9 && Math.abs(official!.spend - 2) < 1e-9 && official!.subscriptionValue === 0)
    check('opencode row: value only', opencode !== undefined && Math.abs(opencode!.cost - 2) < 1e-9 && Math.abs(opencode!.subscriptionValue - 2) < 1e-9 && opencode!.spend === 0)
    // The per-day cost layer must add up to the totals: the hero reads a day
    // row while the meta line reads the total, so a drift would show two
    // different money numbers on the same screen.
    const daySpend = costed.byDay.reduce((acc, row) => acc + (row.spend ?? 0), 0)
    const dayValue = costed.byDay.reduce((acc, row) => acc + (row.subscriptionValue ?? 0), 0)
    check('byDay spend sums to spend', Math.abs(daySpend - costed.spend) < 1e-9, `got ${daySpend}`)
    check('byDay value sums to subscriptionValue', Math.abs(dayValue - costed.subscriptionValue) < 1e-9, `got ${dayValue}`)
    check('the day row carries ¥3 / ¥3', costed.byDay.length === 1 && costed.byDay[0]!.spend === 3 && costed.byDay[0]!.subscriptionValue === 3)
    // recent entries split too
    const recent = costRecentEntries(recs, base, overlay)
    const officialRecent = recent.find(r => r.requestId === 'official-1')
    const opencodeRecent = recent.find(r => r.requestId === 'opencode-1')
    check('recent official: spend', officialRecent?.cost === 2 && officialRecent?.spend === 2 && officialRecent?.subscriptionValue === 0)
    check('recent opencode: value', opencodeRecent?.cost === 2 && opencodeRecent?.subscriptionValue === 2 && opencodeRecent?.spend === 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

console.log('provider overlay file round-trip')
{
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-provider-'))
  try {
    const feed = {
      version: 4,
      updatedAt: 1788810809,
      currency: 'RMB',
      providers: [
        {
          provider: 'commandcode',
          billing: 'subscription',
          entries: [{ model: 'deepseek/deepseek-v4-flash', inheritBase: 'deepseek-v4-flash', note: '订阅价值' }],
        },
        { provider: 'dots-ai', billing: 'metered', entries: [{ model: 'dots3-note-prev', segments: [{ from: 0, rate: { inputPerMillion: 0, outputPerMillion: 0 } }] }] },
      ],
    }
    const synced = join(dir, PROVIDER_PRICING_CCSA_FILE)
    await writeFile(synced, JSON.stringify(feed), 'utf8')
    const table = await readProviderPricing(dir, { error: () => {} })
    check('readProviderPricing loads the mirror', table['commandcode']?.['deepseek/deepseek-v4-flash']?.billing === 'subscription' && table['dots-ai']?.['dots3-note-prev']?.segments?.[0]?.rate.inputPerMillion === 0)
    check('unknown provider absent', table['nope'] === undefined)
    // A provider entry with neither inheritBase nor segments is dropped.
    const junk = coerceProviderPricing({ currency: 'RMB', providers: [{ provider: 'p', entries: [{ model: 'm', note: 'nothing' }] }] })
    check('bare provider entry rejected', junk !== null && junk['p'] === undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

console.log('provider route aliases (同价通道)')
{
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-alias-'))
  try {
    // The base table prices the two models the overlay follows.
    await writeFile(join(dir, PRICING_CCSA_FILE), JSON.stringify({
      version: 1,
      updatedAt: 0,
      currency: 'RMB',
      models: [
        { modelId: 'deepseek-v4-flash', inputCostPerMillion: 1, outputCostPerMillion: 4 },
        { modelId: 'glm-5.3-flash', inputCostPerMillion: 0.8, outputCostPerMillion: 2.8 },
      ],
    }), 'utf8')
    // Mirror: the canonical subscription route, plus a second route of the same
    // plan the feed happens to name itself (its explicit entry must keep winning).
    await writeFile(join(dir, PROVIDER_PRICING_CCSA_FILE), JSON.stringify({
      version: 1,
      updatedAt: 0,
      currency: 'RMB',
      providers: [
        {
          provider: 'opencode-go',
          label: 'OpenCode Go 订阅',
          billing: 'subscription',
          entries: [
            { model: 'deepseek-v4-flash', inheritBase: 'deepseek-v4-flash' },
            { model: 'glm-5.3-flash', inheritBase: 'glm-5.3-flash' },
          ],
        },
        { provider: 'opencode-go-2', entries: [{ model: 'deepseek-v4-flash', billing: 'metered', inheritBase: 'deepseek-v4-flash' }] },
      ],
    }), 'utf8')

    // Write path: strict validation, one hop only.
    const okParse = parseManualProviderPricingInput({ [PROVIDER_ROUTES_KEY]: { 'opencode-go-3': 'opencode-go' } })
    check('alias body parses', okParse.ok && okParse.routes['opencode-go-3'] === 'opencode-go' && Object.keys(okParse.table).length === 0)
    check('self alias rejected', !parseManualProviderPricingInput({ [PROVIDER_ROUTES_KEY]: { a: 'a' } }).ok)
    check('alias chain rejected (one hop)', !parseManualProviderPricingInput({ [PROVIDER_ROUTES_KEY]: { a: 'b', b: 'c' } }).ok)
    check('non-string alias target rejected', !parseManualProviderPricingInput({ [PROVIDER_ROUTES_KEY]: { a: 42 } }).ok)
    check('lenient read drops self/invalid pairs', JSON.stringify(coerceProviderAliases({ a: 'b', c: 'c', d: 1, '': 'x' })) === '{"a":"b"}')

    // Materialization precedence: exact entry > inherited; one hop by construction.
    const applied = applyProviderAliases(
      { A: { m1: { inheritBase: 'm1' }, m2: { inheritBase: 'm2' } }, B: { m1: { inheritBase: 'own' } } },
      { B: 'A', C: 'B' },
    )
    check('alias inherits the target entries', applied['C']?.['m1']?.inheritBase === 'own')
    check('exact route entry beats the alias', applied['B']?.['m1']?.inheritBase === 'own' && applied['B']?.['m2']?.inheritBase === 'm2')
    check('one hop only: C follows B, never A through B', applied['C']?.['m2'] === undefined)

    // File round-trip: `$routes` survives the atomic write.
    await writeManualProviderOverlay(dir, {
      table: { 'opencode-go-3': { 'deepseek-v4-flash': { billing: 'subscription', inheritBase: 'deepseek-v4-flash' } } },
      routes: { 'opencode-go-3': 'opencode-go' },
    }, { error: () => {} })
    const file = JSON.parse(await readFile(join(dir, PROVIDER_PRICING_FILE), 'utf8')) as Record<string, unknown>
    check('hand file keeps $routes', JSON.stringify(file[PROVIDER_ROUTES_KEY]) === '{"opencode-go-3":"opencode-go"}')
    const overlay = await readManualProviderOverlay(dir, { error: () => {} })
    check('overlay reads both halves', overlay.routes['opencode-go-3'] === 'opencode-go' && overlay.table['opencode-go-3']?.['deepseek-v4-flash']?.billing === 'subscription')

    // Effective table: the aliased route prices like its target, its own entry
    // still wins, and the mirror's explicit second-route entry is untouched.
    const effective = await readProviderPricing(dir, { error: () => {} })
    check('alias route inherits the mirror entry', effective['opencode-go-3']?.['glm-5.3-flash']?.inheritBase === 'glm-5.3-flash')
    check('alias route keeps its own entry', effective['opencode-go-3']?.['deepseek-v4-flash']?.billing === 'subscription')
    check('a mirror entry for the route itself still wins', effective['opencode-go-2']?.['deepseek-v4-flash']?.billing === 'metered')
    const priced = resolvePriced(await readPricingTable(dir, { error: () => {} }), effective, 'opencode-go-3', 'glm-5.3-flash', dayMillis('2026-08-17', 9), 0)
    check('aliased route bills like the canonical route', priced.source === 'inheritBase' && priced.billing === 'subscription' && priced.prices.inputPerMillion === 0.8, JSON.stringify(priced))

    // View: inherited rows are marked, and every known route is offered.
    const view = await readProviderPricingView(dir, ['opencode-go-2'], { error: () => {} })
    check('view echoes the aliases', view.routes['opencode-go-3'] === 'opencode-go')
    check('view names the ledger route too', view.names.includes('opencode-go-2') && view.names.includes('opencode-go-3'))
    check('view carries the mirror labels', view.labels['opencode-go'] === 'OpenCode Go 订阅' && view.labels['opencode-go-2'] === undefined)
    check('labels coerce leniently', JSON.stringify(coerceProviderLabels({
      providers: [{ provider: 'a', label: 'A' }, { provider: '', label: 'x' }, { provider: 'b' }, { provider: 'c', label: '' }],
    })) === '{"a":"A"}')
    const inherited = view.rows.find(row => row.provider === 'opencode-go-3' && row.model === 'glm-5.3-flash')
    check('inherited row carries via + a resolved price', inherited?.via === 'opencode-go' && inherited.now?.rates.inputPerMillion === 0.8, JSON.stringify(inherited))
    const ownRow = view.rows.find(row => row.provider === 'opencode-go-3' && row.model === 'deepseek-v4-flash')
    check('own row is not marked via', ownRow !== undefined && ownRow.via === undefined)
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

/** Wrap flat ModelPricing entries into the ModelRates shape readPricingTable
 * returns (base + empty rule lists), the shape providerCards expects. */
function tableOf(pricing: Record<string, Record<string, number>>): Record<string, { base: Record<string, number>; contextTiers: unknown[]; dailySlots: unknown[]; timeRules: unknown[] }> {
  const table: Record<string, { base: Record<string, number>; contextTiers: unknown[]; dailySlots: unknown[]; timeRules: unknown[] }> = {}
  for (const [model, base] of Object.entries(coercePricingTable(pricing))) {
    table[model] = { base, contextTiers: [], dailySlots: [], timeRules: [] }
  }
  return table
}
