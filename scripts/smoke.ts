// 纯逻辑冒烟测试:聚合 / 计价 / 额度。不碰 DSH 运行时,不需要真 host。
//
// 约定:**一条不变量一个断言**——同一条规则不在别处重复;边界用例用表驱动压成一行,
// 表里一行 = 一个用例,不各写一段。需要真数据目录的不变量(折叠重建 / refile / 跨实例
// 去重 / 重启基线)在 `selfcheck-rebuild.ts`,这里不重测。
//
// Run: node --experimental-strip-types scripts/smoke.ts
//      加 `--only <节名子串>` 只跑命中的那几节(改一处计价规则不必跑全 26 节)。
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import {
  summarizeRecords, mergeSummaries, attachCosts, buildSummary, isLedgerStale, staleSessionIds,
  readRecordsByDayRange, rangeDayWindow, rollupIsCurrent, type RollupFile,
} from '../src/stats.ts'
import { pathKey, workspaceRows } from '../src/workspaces.ts'
import {
  billingOf, coercePriceFile, costOf, dayKeyOf, dayStartMs, instantKey, instantMs,
  parsePriceInput, priceAt, priceOfKey, PRICING_BILLING_KEY, PRICING_CALENDAR_KEY, PRICING_FILE, PRICING_FX_KEY,
  rateKeyAt, ratesAt,
  readPriceFile, slotAt, writePriceFile,
} from '../src/pricing.ts'
import { ledgerUsageOf, readPricingView } from '../src/pricing-view.ts'
import {
  baselinesOf, calendarYearTally, composePriceBody, defaultCalendarYear, draftFromView, duplicateSlot,
  effectiveSegments, fxSignature, fxValue, inheritedCell, isBlankSlot, isUnpriced, modelDirty, modelSignature,
  newHoliday, newSegment, newSlot, priceUnknown,
  ratesInForce, readHolidays, rowIssue, slotRange, stagedChanges, withCalendar, withFx, withSegmentFrom,
  withSlotEnd, withSlotStart,
  type CalendarEntries, type CalendarHolidayDraft, type ModelDraft, type PriceDraft, type PriceState,
  type SegmentDraft,
} from '../src/client/pricing/draft.ts'
import {
  CNY_VIEW, isUsd, originOf, storedText, textOf, unitOf,
  type MoneyView,
} from '../src/client/pricing/currency.ts'
import { MAX_MODEL_LENGTH, MAX_ROUTE_LENGTH, holidaySet, hourStartMs, slotsOverlap } from '../src/price-format.ts'
import { axisNodes, labelWidth, placeNodes } from '../src/client/pricing/axis.ts'
import { collectRoutes, DEEPSEEK_ROUTE, routesFromSettings } from '../src/route-catalog.ts'
import { parseRecord, serializeRecord, coerceRecord, recordOfEvent, type SessionEventLike } from '../src/usage-record.ts'
import { dayFileNameOf, UsageLog } from '../src/usage-log.ts'
import { syncHistory, listPersistenceSnapshots } from '../src/sync.ts'
import { modelRowsOf, providerCards } from '../src/by-provider.ts'
import {
  windowFromCreditsBlock, windowFromUsagePercent, resetEpoch, planInfoFromSubscriptions,
  unconfiguredCard, errorCard, noSubscriptionCard, hasQuotaContent, isBuiltinQuotaPlan,
  isQuotaAlert, orderQuotaProviders, quotaGate, balanceGateNote, dayText, BUILTIN_PLAN_TITLES,
} from '../src/quota.ts'
import {
  resolvePlanApiKey, fetchOfficialQuota, fetchOpenCodeGoQuota, fetchCommandCodeQuota, parseOpenCodeGoUsage,
} from '../src/quota-official.ts'
import type { BillingNature, PricingSegmentInput, PricingTable, PricingView, UsageRecord } from '../src/types.ts'
import { totalsTokens } from '../src/types.ts'

let failed = 0
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`  ok    ${name}`)
  } else {
    failed += 1
    console.error(`  FAIL  ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`)
  }
}

/** 只吞日志的 seam:`{ error: () => {} }` 那类。 */
const quiet = { error: () => {} }

// 节过滤。跑全套是**提交门**,不是编辑循环的门:改一条取价规则却要读完整 26 节的输出,
// 那点输出就是白花的 token。`--only` 只筛节,不改任何断言。
const only = ((): string | null => {
  const flag = process.argv.indexOf('--only')
  return flag === -1 ? null : (process.argv[flag + 1] ?? '')
})()

let ranSections = 0
/** 打印节名,并回答这一节该不该跑。 */
function section(name: string): boolean {
  if (only !== null && !name.includes(only)) return false
  ranSections += 1
  console.log(name)
  return true
}

// 「价格表草稿 / 没有价段覆盖的日期 / 价格表写路径」三节说的是同一件事:一条路由、一个模型、几段价。
// 形状只在这里写一遍——三份副本不会各自报错,只会各自**漂**,而漂掉的那一份是静默的。
const modelRow = (segments: SegmentDraft[], over: Partial<ModelDraft> = {}): ModelDraft =>
  ({ model: 'm', configured: true, records: 0, segments, ...over })

/** 把一行装进一份单路由草稿;`ids` 只在要真实路由名 / 模型名 / $billing 时才给。 */
const draftOfRow = (row: ModelDraft, ids: { route?: string; model?: string; billing?: BillingNature } = {}): PriceState => {
  const route = ids.route ?? 'r'
  const model = ids.model ?? row.model
  return {
    routes: new Map([[route, {
      route, label: route, billing: ids.billing ?? 'metered', records: row.records,
      models: new Map([[model, { ...row, model }]]),
    }]]),
    calendar: new Map(),
    holidays: new Set(),
    fx: '',
  }
}

const bodyOfRow = (row: ModelDraft, ids?: Parameters<typeof draftOfRow>[1]) => composePriceBody(draftOfRow(row, ids))

if (section('记录往返 / 事件投影')) {
  const rec: UsageRecord = { requestId: 'req-1', time: 1730000000000, sessionId: 's1', model: 'deepseek-chat', usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50 } }
  const back = coerceRecord(JSON.parse(serializeRecord(rec)))
  check('一行记录 JSONL 往返:字段保留,没上报的桶不凭空出现',
    back !== null && back.requestId === 'req-1' && back.usage?.cacheReadTokens === 50 && back.usage?.cacheWriteTokens === undefined
    && parseRecord(serializeRecord(rec))?.model === 'deepseek-chat')

  const billed = { type: 'assistant/message', time: 1730000000000, seq: 1, data: { message: { id: 'a1', source: { provider: 'deepseek', model: 'deepseek-chat' } }, usage: { inputTokens: 10, outputTokens: 5 } } }
  const billedRec = recordOfEvent(billed as never, 's1', 'deepseek-chat', true)
  const turnEnd = { type: 'turn/end', time: 1730000000000, seq: 7, data: { reason: { kind: 'error', error: { code: 'RATE_LIMIT' } } } }
  const failRec = recordOfEvent(turnEnd as never, 's1', 'deepseek-chat', true)
  check('assistant/message → 一次计费调用,turn/end 错误 → 一行失败(不带用量)',
    billedRec?.kind === undefined && billedRec?.model === 'deepseek-chat' && billedRec?.usage?.inputTokens === 10 && billedRec.provider === 'deepseek'
    && failRec?.kind === 'failure' && failRec.failureCode === 'RATE_LIMIT' && failRec.usage === undefined)

  // 通道没上报用量的计费调用(中途取消的请求 / 没回报用量的 summarize)**仍写一行**:
  // 丢行比「未上报用量」更不可查。
  const interrupted = { type: 'assistant/message', time: 1730000000000, seq: 9, data: { message: { id: 'a2', source: { provider: 'deepseek', model: 'deepseek-chat' } }, interrupted: true } }
  const bareSummary = { type: 'compaction/summary', time: 1730000000000, seq: 11, data: { provider: 'deepseek', model: 'deepseek-chat' } }
  const interruptedRec = recordOfEvent(interrupted as never, 's1', 'deepseek-chat', true)
  const bareSummaryRec = recordOfEvent(bareSummary as never, 's1', 'deepseek-chat', true)
  check('用量未知 ≠ 0:缺 usage 的调用仍落行,只是四个桶一个都不加',
    interruptedRec?.requestId === 'a2' && interruptedRec.kind === undefined && interruptedRec.usage === undefined
    && bareSummaryRec?.requestId === 'compaction:s1:11' && bareSummaryRec.kind === 'compaction' && bareSummaryRec.usage === undefined)
}

if (section('聚合:totals / byDay / byModel')) {
  const records: UsageRecord[] = [
    { requestId: '1', time: dayMillis('2026-01-01', 10), sessionId: 's1', model: 'deepseek-chat', usage: { inputTokens: 100, outputTokens: 50 } },
    { requestId: '2', time: dayMillis('2026-01-01', 14), sessionId: 's1', model: 'deepseek-chat', usage: { inputTokens: 200, outputTokens: 100 } },
    { requestId: '3', time: dayMillis('2026-01-02', 9), sessionId: 's2', model: 'deepseek-reasoner', usage: { inputTokens: 40, outputTokens: 15, cacheReadTokens: 60 } },
    { requestId: '4', time: dayMillis('2026-01-02', 9), sessionId: 's2', model: 'deepseek-chat', kind: 'failure', failureCode: 'QUOTA' },
  ]
  const sum = summarizeRecords(records)
  check('失败不计入 requests,桶各自求和,byDay / byModel 各成行',
    sum.total.requests === 3 && sum.total.failures === 1 && sum.total.inputTokens === 340 && sum.total.outputTokens === 165
    && sum.total.cacheReadTokens === 60 && sum.byDay.length === 2 && sum.byModel.length === 2)
  const merged = mergeSummaries(summarizeRecords(records.slice(0, 2)), summarizeRecords(records.slice(2)))
  check('分两半折叠再合并 == 一次折叠(dashboard 的增量折叠靠这条)',
    merged.total.requests === 3 && merged.total.inputTokens === 340 && merged.byModel.length === 2)
}

if (section('手写价表:日期 / 价段 / 取价')) {
  const file = parsePriceInput({
    [PRICING_BILLING_KEY]: { 'opencode-go': 'subscription' },
    [PRICING_FX_KEY]: { cnyPerUsd: 7.15 },
    'deepseek-official': {
      'deepseek-v4-flash': [
        { from: '2026-08-01', inputPerMillion: 1.5, outputPerMillion: 4.5, cacheReadPerMillion: 0.15 },
        { from: '2026-09-01', inputPerMillion: 2, outputPerMillion: 6 },
      ],
    },
  })
  check('生效日期是本地日历日:往返一致,不存在 / 非法的日期不是日期',
    file.ok && dayKeyOf(dayStartMs('2026-09-01')!) === '2026-09-01' && dayStartMs('2026-02-31') === null && dayStartMs('2026/09/01') === null)
  if (!file.ok) throw new Error(`well-formed body rejected: ${file.error}`)
  const table = file.file.table

  const before = dayMillis('2026-08-15', 9)
  const after = dayMillis('2026-09-15', 9)
  check('取价 = 「最后一段 from ≤ 该时刻」;早于最早一段或这个组合没价段 → null(价格未知)',
    priceAt(table, 'deepseek-official', 'deepseek-v4-flash', before)?.rates.inputPerMillion === 1.5
    && priceAt(table, 'deepseek-official', 'deepseek-v4-flash', after)?.rates.outputPerMillion === 6
    && priceAt(table, 'deepseek-official', 'deepseek-v4-flash', dayMillis('2026-07-15', 9)) === null
    && priceAt(table, 'deepseek-official', 'never-priced', before) === null)
  check('$billing 是通道路由属性(省略 = metered)',
    billingOf(file.file.billing, 'opencode-go') === 'subscription'
    && billingOf(file.file.billing, 'deepseek-official') === 'metered' && billingOf(file.file.billing, undefined) === 'metered')
  check('费率行身份 = 该价段的 from;没价 = 哨兵(-1)',
    rateKeyAt(table, 'deepseek-official', 'deepseek-v4-flash', after)?.from === dayStartMs('2026-09-01')
    && rateKeyAt(table, 'deepseek-official', 'never-priced', after).from === -1)
  // 汇率是价文件里第三个保留键，但它与计价无关：解析出来只是给价格表的读写面用。
  const noFx = parsePriceInput({ r: {} })
  check('$fx 是保留键、只服务读写面:解析得出汇率,省略 = 未设汇率',
    file.file.fx?.cnyPerUsd === 7.15 && noFx.ok && noFx.file.fx === undefined)

  // 金额只存身份、读取时回查当前表 → 一次改价重算全部历史(不改账本行)。
  const edited: PricingTable = { 'deepseek-official': { 'deepseek-v4-flash': [
    { from: dayStartMs('2026-08-01')!, rates: { inputPerMillion: 1.2, outputPerMillion: 3.6 } },
    { from: dayStartMs('2026-09-01')!, rates: { inputPerMillion: 2, outputPerMillion: 6 } },
  ] } }
  check('同一身份回查当前表:改费率就地重算,身份落空 → 价格未知',
    priceOfKey(edited, 'deepseek-official', 'deepseek-v4-flash', { from: dayStartMs('2026-08-01')! })?.inputPerMillion === 1.2
    && priceOfKey(edited, 'deepseek-official', 'deepseek-v4-flash', { from: dayStartMs('2026-08-01')! - 1 }) === null)
  check('costOf:四档各自乘费率,cacheRead/Write 缺价时回落到输入价',
    Math.abs(costOf({ requests: 1, inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 200_000, cacheWriteTokens: 100_000, compactions: 0, failures: 0 },
      { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5, cacheWritePerMillion: 1 }) - 6.2) < 1e-9
    && costOf({ requests: 1, inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0, compactions: 0, failures: 0 }, { inputPerMillion: 3, outputPerMillion: 9 }) === 3)

  // 写路径拒绝它读不懂的表(每类一条代表);读路径反过来:畸形只掉受影响的那一格。
  const refuses: [string, unknown, string][] = [
    ['非 YYYY-MM-DD 的生效日期', { r: { m: [{ from: '2026-2-1', inputPerMillion: 1, outputPerMillion: 2 }] } }, 'YYYY-MM-DD'],
    ['同一生效时刻写两段', { r: { m: [{ from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 2 }, { from: '2026-09-01', inputPerMillion: 3, outputPerMillion: 4 }] } }, '生效时间相同'],
    ['价段里的未知字段', { r: { m: [{ from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 2, billing: 'metered' }] } }, '未知字段'],
    ['两个都会生效的时段', { r: { m: [{ from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 2, slots: [{ days: 'daily', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 }, { days: 'weekdays', start: 11, end: 13, inputPerMillion: 2, outputPerMillion: 4 }] }] } }, '重叠'],
    ['未知的星期几', { r: { m: [{ from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 2, slots: [{ days: 'mondays', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 }] }] } }, 'days'],
    ['非整点的生效时刻(轴是整点的)', { r: { m: [{ from: '2026-09-10T12:30', inputPerMillion: 1, outputPerMillion: 2 }] } }, '整点'],
    ['$fx 不是对象', { [PRICING_FX_KEY]: 7.15, r: {} }, PRICING_FX_KEY],
    ['$fx 的 cnyPerUsd 不是数', { [PRICING_FX_KEY]: { cnyPerUsd: '7.15' }, r: {} }, 'cnyPerUsd'],
    ['$fx 为 0(换算会除零)', { [PRICING_FX_KEY]: { cnyPerUsd: 0 }, r: {} }, '大于 0'],
  ]
  const accepted = refuses.filter(([, body, expected]) => {
    const out = parsePriceInput(body)
    return out.ok || !out.error.includes(expected)
  })
  check('写路径拒绝它读不懂的价格表(每类一条代表)', accepted.length === 0, accepted.map(([label]) => label))
  const lenient = coercePriceFile({ r: { good: [{ inputPerMillion: 1, outputPerMillion: 2 }], bad: [{ inputPerMillion: 'x' }] } }, quiet)
  check('读路径宽容:畸形的 (路由, 模型) 只降级它自己,整份文件仍读得出',
    lenient.table.r?.good?.length === 1 && lenient.table.r?.bad === undefined && Object.keys(coercePriceFile('nope', quiet).table).length === 0)
  // 手写坏了的汇率同样只掉它自己：它不是价,一个数写错不该让整张价表读不出来。
  const lenientFx = coercePriceFile({ [PRICING_FX_KEY]: { cnyPerUsd: -1 }, r: { m: [{ from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 2 }] } }, quiet)
  check('读路径宽容:畸形的 $fx 只掉它自己(读作未设汇率),价照读',
    lenientFx.fx === undefined && lenientFx.table.r?.m?.length === 1)

  const dir = await mkdtemp(join(tmpdir(), 'tokbook-price-'))
  try {
    await writePriceFile(dir, file.file, quiet)
    const back = await readPriceFile(dir, quiet)
    const text = await readFile(join(dir, PRICING_FILE), 'utf8')
    check('价格文件是能手改的 JSON,读写往返不丢(含可选 cache 档、$billing 与 $fx)',
      text.includes('"$billing"') && text.includes('"2026-09-01"') && text.includes('"$fx"')
      && back.table['deepseek-official']?.['deepseek-v4-flash']?.length === 2 && billingOf(back.billing, 'opencode-go') === 'subscription'
      && back.table['deepseek-official']?.['deepseek-v4-flash']?.[0]?.rates.cacheReadPerMillion === 0.15
      && back.fx?.cnyPerUsd === 7.15)

    // 价格表 tab 的卡片 = 路由目录 ∪ 账本 ∪ 价格文件。
    const view = await readPricingView(
      dir,
      [
        { route: 'deepseek-official', label: 'DeepSeek', models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' }, { id: 'deepseek-v4-pro' }] },
        { route: 'opencode-go', label: 'OpenCode Go', models: [] },
      ],
      {
        byRouteModel: new Map([['opencode-go', new Map([['mimo-v2.5', { records: 83, firstAt: Date.UTC(2026, 7, 17), lastAt: Date.UTC(2026, 8, 2), unpriced: 11 }]])]]),
        byRoute: new Map([['opencode-go', 83]]),
      },
      quiet,
    )
    const onlyRow = view.routes.find(c => c.route === 'opencode-go')?.models.find(m => m.model === 'mimo-v2.5')
    check('卡片:用过的路由排前面,没配置的模型也成行并带上账本事实',
      view.routes.length === 2 && view.routes[0]?.route === 'opencode-go'
      && onlyRow?.configured === false && onlyRow.records === 83 && onlyRow.name === undefined
      && onlyRow.firstAt === Date.UTC(2026, 7, 17) && onlyRow.lastAt === Date.UTC(2026, 8, 2) && onlyRow.unpriced === 11)
    const flash = view.routes.find(c => c.route === 'deepseek-official')?.models.find(m => m.model === 'deepseek-v4-flash')
    const pro = view.routes.find(c => c.route === 'deepseek-official')?.models.find(m => m.model === 'deepseek-v4-pro')
    check('卡片:配置过的模型标 configured 并带上名字,价段整份交出去(此刻价由 client 现算);没价的没有价段',
      flash?.configured === true && flash.name === 'DeepSeek V4 Flash' && flash.segments.length === 2
      && pro?.name === undefined && pro.segments.length === 0 && pro.firstAt === undefined)
    check('价格文件里留着一条已被配置删掉的路由(卡片是并集,不是目录)',
      (await readPricingView(dir, [], { byRouteModel: new Map(), byRoute: new Map() }, quiet)).routes.some(c => c.route === 'deepseek-official'))

    // 旧形态(没有生效时刻的那一段,自始生效)在视图层被迁移成真实日期:该模型的首记整点。
    // 金额因此不变(首记之前本来没有任何记录),而界面与写入形态从此只剩有生效时刻的段;
    // 文件要等下一次保存才变。
    await writeFile(join(dir, PRICING_FILE), JSON.stringify({
      'deepseek-official': { 'deepseek-v4-flash': [
        { inputPerMillion: 5, outputPerMillion: 20 },
        { from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 4 },
      ] },
    }), 'utf8')
    const legacyFirst = dayMillis('2026-08-15', 19) + 31 * 60_000
    const migrated = await readPricingView(dir, [], {
      byRouteModel: new Map([['deepseek-official', new Map([['deepseek-v4-flash', {
        records: 3, firstAt: legacyFirst, lastAt: dayMillis('2026-09-02', 9), unpriced: 0,
      }]])]]),
      byRoute: new Map([['deepseek-official', 3]]),
    }, quiet)
    const migratedRow = migrated.routes.find(c => c.route === 'deepseek-official')?.models.find(m => m.model === 'deepseek-v4-flash')
    check('旧文件里没有生效时刻的那一段,视图层把它迁移成该模型的首记整点(金额不变)',
      migratedRow?.segments.length === 2
      && migratedRow.segments[0]!.from === instantKey(hourStartMs(legacyFirst))
      && migratedRow.segments[0]!.inputPerMillion === 5
      && migratedRow.segments[1]!.from === '2026-09-01')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

if (section('账本透镜:价格表说这一行值多少')) {
  const table: PricingTable = {
    'deepseek-official': { 'deepseek-v4-flash': [{ from: dayStartMs('2026-09-01'), rates: { inputPerMillion: 1, outputPerMillion: 4 } }] },
  }
  const billed = (id: string, day: string): UsageRecord => ({
    requestId: id, time: dayMillis(day, 12), sessionId: 's1', provider: 'deepseek-official',
    model: 'deepseek-v4-flash', usage: { inputTokens: 10, outputTokens: 5 },
  })
  const lens = ledgerUsageOf([
    billed('a', '2026-08-15'), billed('b', '2026-09-02'), billed('c', '2026-08-29'),
    { requestId: 'd', time: dayMillis('2026-09-03', 12), sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-v4-flash', kind: 'failure', failureCode: 'QUOTA' },
    { requestId: 'e', time: dayMillis('2026-08-20', 12), sessionId: 's1', model: 'deepseek-v4-flash', usage: { inputTokens: 10, outputTokens: 5 } },
  ], table)
  const row = lens.byRouteModel.get('deepseek-official')?.get('deepseek-v4-flash')
  check('透镜只数被计价的调用(失败行与没归属的行不算),并数出早于最早一段的条数',
    row?.records === 3 && row.firstAt === dayMillis('2026-08-15', 12) && row.lastAt === dayMillis('2026-09-02', 12) && row.unpriced === 2
    && lens.byRoute.get('deepseek-official') === 3)
  const open = ledgerUsageOf([billed('f', '2026-08-15')], {
    'deepseek-official': { 'deepseek-v4-flash': [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 1, outputPerMillion: 4 } }] },
  })
  check('一段早于任何记录的价覆盖全部历史 → 一条都不算价格未知',
    open.byRouteModel.get('deepseek-official')?.get('deepseek-v4-flash')?.unpriced === 0)
}

if (section('调价史轴:左端是最早一段价,无调价史时是空轴')) {
  const segment = (id: number, from: string): SegmentDraft => ({ id, from, input: '1', output: '4', cacheRead: '', cacheWrite: '', slots: [] })
  const row = (over: Partial<ModelDraft>): ModelDraft => ({ model: 'm', configured: true, records: 3, firstAt: dayMillis('2026-08-25', 19), segments: [], ...over })
  const now = dayMillis('2026-09-20', 12)

  // 没有调价史 = 空数组:组件据此画一条暗淡的空轨(轴不隐藏)。
  const empty = axisNodes(row({ segments: [segment(1, '')] }), null, now).length === 0
    && axisNodes(row({ records: 0, firstAt: undefined }), null, now).length === 0
  // 一段价:左端就是它自己(不再是首记),右端仍是今天。
  const one = axisNodes(row({ segments: [segment(1, '2026-08-25T19:00')] }), 1, now)
  // 价定在未来:两端对调,今天成为轴内的一个节点。
  const three = axisNodes(row({ segments: [segment(1, '2026-08-01'), segment(2, '2026-09-05'), segment(3, '2026-09-25')] }), 2, now)
  check('轴的左端是最早一段价、右端是今天;价落在未来时今天退成中间节点,只有当前生效那段标 active',
    empty
    && one.length === 2 && one[0]!.label === '2026-08-25 19:00' && one[0]!.segmentId === 1 && one[0]!.active === true
    && one[0]!.cap === 'start' && one[1]!.label === '今天' && one[1]!.cap === 'today' && one[1]!.ratio === 1
    && three.map(node => node.label).join(' | ') === '2026-08-01 | 2026-09-05 | 今天 | 2026-09-25'
    && three[1]!.segmentId === 2 && three[1]!.active === true
    && three[2]!.segmentId === null && three[3]!.cap === 'today')

  const labels = ['2026-08-25 19:00', '2026-08-26', '2026-08-28', '今天']
  const widths = labels.map(labelWidth)
  const spots = placeNodes([0, 0.02, 0.05, 1], widths, 600)
  const boxes = spots.map((x, index): [number, number] => index === 0
    ? [0, widths[0]!]
    : index === spots.length - 1 ? [x - widths[index]!, x] : [x - widths[index]! / 2, x + widths[index]! / 2])
  const many = placeNodes(Array.from({ length: 8 }, () => 0.5), Array.from({ length: 8 }, () => 86), 600)
  check('轴两端钉死在轨道上;挤在一起的标签按顺序推开,推不开也不许出界或乱序',
    spots[0] === 0 && spots[spots.length - 1] === 600
    && boxes.every((box, index) => index === 0 || box[0]! - boxes[index - 1]![1]! >= 6 - 1e-6)
    && many.every((x, index) => x >= 0 && x <= 600 && (index === 0 || x >= many[index - 1]!)))
}

if (section('峰谷时段:价段内的第二层取价')) {
  // 2026-09-14 是周一,2026-09-20 是周日。
  const parsed = parsePriceInput({
    'deepseek-official': { 'deepseek-v4-flash': [{
      from: '2026-09-10T12:00',
      inputPerMillion: 1, outputPerMillion: 4, cacheReadPerMillion: 0.02,
      slots: [
        { days: 'weekdays', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.04 },
        { days: 'weekdays', start: 14, end: 18, inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.04 },
        { days: 'weekends', start: 0, end: 24, inputPerMillion: 1.5, outputPerMillion: 6 },
      ],
    }] },
  })
  if (!parsed.ok) throw new Error(`slot body rejected: ${parsed.error}`)
  const table = parsed.file.table
  const route = 'deepseek-official'
  const model = 'deepseek-v4-flash'
  const mondayPeak = dayMillis('2026-09-14', 10)
  const mondayTrough = dayMillis('2026-09-14', 20)
  const sunday = dayMillis('2026-09-20', 10)

  check('整点生效:12:00 的段在 11:00 还没生效;段内按本地星期几 + 小时取时段,end 不含,空隙走基准价,时段没写的档继承',
    instantKey(instantMs('2026-09-10T12:00')!) === '2026-09-10T12:00' && instantKey(instantMs('2026-09-10')!) === '2026-09-10'
    && ratesAt(table, route, model, dayMillis('2026-09-10', 11)) === null
    && ratesAt(table, route, model, mondayPeak)?.inputPerMillion === 2
    && ratesAt(table, route, model, dayMillis('2026-09-14', 12))?.inputPerMillion === 1
    && ratesAt(table, route, model, mondayTrough)?.inputPerMillion === 1
    && ratesAt(table, route, model, sunday)?.inputPerMillion === 1.5
    && ratesAt(table, route, model, sunday)?.cacheReadPerMillion === 0.02)

  const slotRefuses: [string, boolean][] = [
    ['会重叠的一组时段被拒', parsePriceInput({ r: { m: [{ from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 2, slots: [{ days: 'daily', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 }, { days: 'weekdays', start: 11, end: 13, inputPerMillion: 2, outputPerMillion: 4 }] }] } }).ok === false],
    ['倒序的小时被拒', parsePriceInput({ r: { m: [{ from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 2, slots: [{ days: 'daily', start: 18, end: 9, inputPerMillion: 2, outputPerMillion: 4 }] }] } }).ok === false],
    ['星期几分家的两组可以共用同一段小时', parsePriceInput({ r: { m: [{ from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 2, slots: [{ days: 'weekdays', start: 9, end: 18, inputPerMillion: 2, outputPerMillion: 4 }, { days: 'weekends', start: 9, end: 18, inputPerMillion: 2, outputPerMillion: 4 }] }] } }).ok === true],
    ['不写 days 读作每天', parsePriceInput({ r: { m: [{ from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 2, slots: [{ start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 }] }] } }).file?.table.r?.m?.[0]?.slots?.[0]?.days === 'daily'],
  ]
  check('时段的写路径:该拒的拒、可共存的放行、缺省写全', slotRefuses.every(([, ok]) => ok), slotRefuses.filter(([, ok]) => !ok).map(([label]) => label))
  const kept = coercePriceFile({ r: { m: [{
    inputPerMillion: 1, outputPerMillion: 2,
    slots: [
      { days: 'weekdays', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 },
      { days: 'mondays', start: 18, end: 20, inputPerMillion: 9, outputPerMillion: 9 },
      { days: 'weekdays', start: 11, end: 13, inputPerMillion: 9, outputPerMillion: 9 },
    ],
  }] } }, quiet).table.r?.m?.[0]?.slots ?? []
  check('时段的读路径:丢掉读不懂的与会撞车的,先写的那个赢', kept.length === 1 && kept[0]!.start === 9 && kept[0]!.end === 12)

  const slotDir = await mkdtemp(join(tmpdir(), 'tokbook-slot-'))
  try {
    await writePriceFile(slotDir, parsed.file, quiet)
    const text = await readFile(join(slotDir, PRICING_FILE), 'utf8')
    const back = await readPriceFile(slotDir, quiet)
    check('整点时刻与时段写进文件后读回来仍按同样的价计费',
      text.includes('"2026-09-10T12:00"') && text.includes('"weekdays"')
      && back.table[route]?.[model]?.[0]?.slots?.length === 3 && back.table[route]?.[model]?.[0]?.from === instantMs('2026-09-10T12:00')
      && ratesAt(back.table, route, model, mondayPeak)?.inputPerMillion === 2)
  } finally {
    await rm(slotDir, { recursive: true, force: true })
  }

  // 按这一段的价计出来的金额走的是时段价,不是基准价。
  const records: UsageRecord[] = [{ requestId: 'peak-1', time: mondayPeak, sessionId: 's1', provider: route, model, usage: { inputTokens: 1_000_000, outputTokens: 0 } }]
  const resolveRate = (record: UsageRecord) => rateKeyAt(table, record.provider, record.model, record.time)
  const costed = attachCosts({ ...summarizeRecords(records, resolveRate), dataDir: 'x' }, table)
  check('按高峰时段计费的记录按高峰价计入(不是基准价)',
    Math.abs(costed.totalCost - 2) < 1e-9 && costed.unpricedModels.length === 0)
}

if (section('法定节假日年历:workdays 把放假日摘出高峰')) {
  // 2026 年国庆：10-01(周四) ~ 10-07(周三)。10-01 与 10-02 是工作日里的放假日，
  // 10-03/10-04 是周末，10-08(周四) 是恢复上班后的第一个工作日。
  const calendar = { 2026: [{ start: '2026-10-01', end: '2026-10-07' }] }
  const holidays = holidaySet(calendar)
  const parsed = parsePriceInput({
    [PRICING_CALENDAR_KEY]: calendar,
    r: { m: [{
      from: '2026-01-01', inputPerMillion: 1, outputPerMillion: 2,
      slots: [
        { days: 'workdays', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 },
        { days: 'weekdays', start: 14, end: 18, inputPerMillion: 3, outputPerMillion: 6 },
      ],
    }] },
  })
  if (!parsed.ok) throw new Error(`calendar body rejected: ${parsed.error}`)
  const table = parsed.file.table
  check('workdays 只在「周一至周五且不是法定节假日」生效;weekdays 照旧含放假日',
    ratesAt(table, 'r', 'm', dayMillis('2026-09-30', 10), holidays)?.inputPerMillion === 2
    && ratesAt(table, 'r', 'm', dayMillis('2026-10-01', 10), holidays)?.inputPerMillion === 1
    && ratesAt(table, 'r', 'm', dayMillis('2026-10-05', 10), holidays)?.inputPerMillion === 1
    && ratesAt(table, 'r', 'm', dayMillis('2026-10-08', 10), holidays)?.inputPerMillion === 2
    && ratesAt(table, 'r', 'm', dayMillis('2026-09-30', 15), holidays)?.inputPerMillion === 3
    && ratesAt(table, 'r', 'm', dayMillis('2026-10-01', 15), holidays)?.inputPerMillion === 3)

  // 年历缺那一年的读法：空集 = 那一年未知，weekdays 与 workdays 收成同一档
  // （法定节假日被按高峰多算，不少算）。
  check('年历查不到那一年时 workdays 退化成周一至周五(安全方向:多算不少算)',
    ratesAt(table, 'r', 'm', dayMillis('2026-10-01', 10), new Set())?.inputPerMillion === 2
    && ratesAt(table, 'r', 'm', dayMillis('2027-10-01', 10), holidays)?.inputPerMillion === 2)

  const calRefuses: [string, boolean][] = [
    ['畸形区间被拒', parsePriceInput({ [PRICING_CALENDAR_KEY]: { 2026: [{ start: '2026-10-07', end: '2026-10-01' }] } }).ok === false],
    ['不是日期的区间被拒', parsePriceInput({ [PRICING_CALENDAR_KEY]: { 2026: [{ start: '2026-02-30', end: '2026-03-01' }] } }).ok === false],
    ['年份键不是四位数字被拒', parsePriceInput({ [PRICING_CALENDAR_KEY]: { '26': [{ start: '2026-01-01', end: '2026-01-03' }] } }).ok === false],
    ['跨年的区间被拒', parsePriceInput({ [PRICING_CALENDAR_KEY]: { 2026: [{ start: '2026-12-30', end: '2027-01-02' }] } }).ok === false],
    ['相邻两段会被合并(不算畸形)', parsePriceInput({ [PRICING_CALENDAR_KEY]: { 2026: [{ start: '2026-01-01', end: '2026-01-02' }, { start: '2026-01-03', end: '2026-01-03' }] } }).ok === true],
  ]
  check('年历的写路径:畸形区间、假日期、跨年都拒;相邻段允许', calRefuses.every(([, ok]) => ok), calRefuses.filter(([, ok]) => !ok).map(([label]) => label))

  const coerced = coercePriceFile({ [PRICING_CALENDAR_KEY]: { 2026: [{ start: '2026-02-01', end: '2026-02-02' }, { start: '2026-02-02', end: '2026-02-03' }, { start: 'nope', end: 'x' }] } }, quiet)
  check('年历的读路径:重叠段合并、畸形段丢弃,绝不因为一段坏数据把整年读空',
    coerced.calendar['2026']?.length === 1 && coerced.calendar['2026']?.[0]?.start === '2026-02-01' && coerced.calendar['2026']?.[0]?.end === '2026-02-03')

  const calDir = await mkdtemp(join(tmpdir(), 'tokbook-cal-'))
  try {
    await writePriceFile(calDir, parsed.file, quiet)
    const back = await readPriceFile(calDir, quiet)
    check('年历与价表写进同一份文件,读回来年历原样、总段数不变',
      back.calendar['2026']?.[0]?.end === '2026-10-07'
      && ratesAt(back.table, 'r', 'm', dayMillis('2026-10-01', 10), holidaySet(back.calendar))?.inputPerMillion === 1
      && ratesAt(back.table, 'r', 'm', dayMillis('2026-09-30', 10), holidaySet(back.calendar))?.inputPerMillion === 2)
  } finally {
    await rm(calDir, { recursive: true, force: true })
  }

  // 草稿侧同一条规则:年历改一段假期,行内「此刻的价」当场跟着走;草稿产出的
  // 年历也必须被宿主接受(client ⊆ host)。
  const draft = draftOfRow(modelRow([
    { ...newSegment({ from: '2026-01-01', input: '1', output: '2' }), slots: [newSlot({ days: 'workdays', start: '9', end: '12', input: '2' })] },
  ]))
  const yearOf = (...holidays: CalendarHolidayDraft[]): CalendarEntries =>
    new Map([['2026', { year: '2026', holidays }]])
  const withYear = withCalendar(draft, yearOf(newHoliday({ start: '2026-10-01', end: '2026-10-07' })))
  const nationalDay = dayMillis('2026-10-01', 10)
  check('草稿里的年历参与此刻取价:放假日按基准价,平日按高峰价',
    ratesInForce(withYear.routes.get('r')!.models.get('m')!, withYear.holidays, nationalDay)?.slot === null
    && ratesInForce(withYear.routes.get('r')!.models.get('m')!, withYear.holidays, dayMillis('2026-09-30', 10))?.values.input === '2')
  const calBody = composePriceBody(withYear)
  const accepted = calBody.ok ? parsePriceInput(calBody.body) : { ok: false as const, error: calBody.ok ? '' : calBody.error }
  check('草稿写出的年历被宿主接受,且落成同一份年历',
    accepted.ok && accepted.file.calendar['2026']?.[0]?.start === '2026-10-01'
    && new Set(Object.keys(accepted.file.calendar)).size === 1)

  // 填完了却错的三条：跨年、起晚于止、两段重叠。它们在草稿这一侧就拒（并说出是第几段）。
  check('年历里填完却错的段在草稿这一侧就被拒:跨年 / 起晚于止 / 两段重叠',
    composePriceBody(withCalendar(draft, yearOf(newHoliday({ start: '2026-12-30', end: '2027-01-02' })))).ok === false
    && composePriceBody(withCalendar(draft, yearOf(newHoliday({ start: '2026-10-07', end: '2026-10-01' })))).ok === false
    && composePriceBody(withCalendar(draft, yearOf(
      newHoliday({ start: '2026-10-01', end: '2026-10-03' }),
      newHoliday({ start: '2026-10-03', end: '2026-10-05' }),
    ))).ok === false)

  // 还没写完的（整组没填 / 只填了一头）是占位：不落盘，也不把同一份文件里的价冻住——
  // 年历与价共用一个文件，为一行占位拒掉整笔写入就是拿错的代价去罚没错的东西。
  const placeholder = composePriceBody(withCalendar(draft, new Map([
    ['2026', { year: '2026', holidays: [
      newHoliday({ start: '2026-10-01', end: '2026-10-07' }),
      newHoliday({ start: '2027-01-01' }),
    ] }],
    ['2027', { year: '2027', holidays: [newHoliday()] }],
  ])))
  check('还没填完的段与整组没填的年不写进文件,也不挡住同一份文件里的价',
    placeholder.ok
    && Object.keys((placeholder.body[PRICING_CALENDAR_KEY] ?? {}) as Record<string, unknown>).join() === '2026'
    && parsePriceInput(placeholder.body).ok)

  // 每段的天数含两端，是拿来对通知里「每条假期共 N 天」的那个数；一年的总数就是各段之和
  // （重叠已经算错，所以不必再去重）。只填一头是「还没写完」，整组没填是「还没写」。
  const rows = [
    newHoliday({ start: '2026-02-15', end: '2026-02-23' }),
    newHoliday({ start: '2026-10-01', end: '2026-10-08' }),
    newHoliday({ start: '2026-05-01' }),
    newHoliday(),
  ]
  const reads = readHolidays('2026', rows)
  const tally = calendarYearTally('2026', rows)
  check('每段天数含两端;只填一头读作「还没写完」,整组没填读作「还没写」',
    reads[0]!.kind === 'ok' && reads[0]!.days === 9
    && reads[1]!.kind === 'ok' && reads[1]!.days === 8
    && reads[2]!.kind === 'partial' && reads[3]!.kind === 'empty'
    && tally.ranges === 2 && tally.days === 17)

  // 不填年份时加哪一年：一年都没填过日期 → 今年（先把眼下这一年记上）；填过 → 下一年
  // （安排提前一年公布）；下一年的安排早记好了 → 再往后找一个空位（不填也得点得动）。
  const today = new Date(2026, 8, 23)
  const blank = (year: string): CalendarEntries => new Map([[year, { year, holidays: [newHoliday()] }]])
  const filled = (year: string, start: string, end: string): CalendarEntries =>
    new Map([[year, { year, holidays: [newHoliday({ start, end })] }]])
  check('不填年份时加哪一年:没填过 → 今年,填过 → 下一年,下一年的安排早记好了就再往后',
    defaultCalendarYear(new Map(), today) === '2026'
    && defaultCalendarYear(blank('2025'), today) === '2026'
    && defaultCalendarYear(filled('2026', '2026-10-01', '2026-10-07'), today) === '2027'
    && defaultCalendarYear(filled('2027', '2027-01-01', '2027-01-03'), today) === '2028')
}


if (section('时段身份:改费率就地重算,改时段 / 删时段 = 价格未知')) {
  const route = 'deepseek-official'
  const model = 'deepseek-v4-flash'
  const inside = dayMillis('2026-09-14', 10)   // 周一 10:00,落在 09:00–12:00 工作时段里
  const slot = (start: number, inputPerMillion: number, days: 'daily' | 'weekdays' = 'weekdays') => ({
    days, start, end: 12, rates: { inputPerMillion, outputPerMillion: inputPerMillion * 4 },
  })
  const table = (slots: ReturnType<typeof slot>[]): PricingTable => ({
    [route]: { [model]: [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 1, outputPerMillion: 4 }, ...(slots.length > 0 ? { slots } : {}) }] },
  })

  const key = rateKeyAt(table([slot(9, 2)]), route, model, inside)
  const segment = priceAt(table([slot(9, 2)]), route, model, inside)
  check('身份 = 价段 from + 那一刻生效的时段(start + days)',
    segment !== null && slotAt(segment, inside)?.start === 9 && key.from === dayStartMs('2020-01-01') && key.slot?.start === 9 && key.slot.days === 'weekdays')
  check('改费率 → 身份不变、就地重算;改 start / 改 days / 删时段 → 那一刻另有一个身份在生效,旧身份回查不到 = 价格未知',
    JSON.stringify(rateKeyAt(table([slot(9, 3)]), route, model, inside)) === JSON.stringify(key)
    && priceOfKey(table([slot(9, 3)]), route, model, key)?.inputPerMillion === 3
    && rateKeyAt(table([slot(8, 2)]), route, model, inside)?.slot?.start === 8 && priceOfKey(table([slot(8, 2)]), route, model, key) === null
    && priceOfKey(table([slot(9, 2, 'daily')]), route, model, key) === null
    && ratesAt(table([]), route, model, inside)?.inputPerMillion === 1 && priceOfKey(table([]), route, model, key) === null)

  // 悬空的身份要在**成本层**现形:那一刻的身份取自旧表(start 9),计价用改过时段的新表
  // (start 8)——旧身份回查不到,那条历史按 ¥0 计并被列为价格未知,绝不静默按邻近时段重算。
  const records: UsageRecord[] = [{ requestId: 'peak-1', time: inside, sessionId: 's1', provider: route, model, usage: { inputTokens: 1_000_000, outputTokens: 0 } }]
  const resolve = (record: UsageRecord) => rateKeyAt(table([slot(9, 2)]), record.provider, record.model, record.time)
  const orphaned = attachCosts({ ...summarizeRecords(records, resolve), dataDir: 'x' }, table([slot(8, 2)]))
  check('悬空身份的历史读作价格未知(¥0)并列进 unpricedModels',
    orphaned.totalCost === 0 && orphaned.unpricedModels.includes(model))
}

if (section('价格表草稿:没写完的不算、不脏、不写')) {
  const model = modelRow
  const bodyOf = (segments: SegmentDraft[]) => bodyOfRow(modelRow(segments))

  const blank = newSegment()
  check('空白价段是草稿:不报错、不脏、不写进请求体,行读作价格未知',
    effectiveSegments(model([blank])).length === 0 && isUnpriced(model([blank])) === true
    && rowIssue(model([blank])) === null && JSON.stringify(bodyOf([blank])) === JSON.stringify({ ok: true, body: {} }))

  const view: PricingView = {
    routes: [{ route: 'r', label: 'r', billing: 'metered', records: 0, models: [
      { model: 'm', configured: true, records: 0, segments: [{ from: '2026-08-01', inputPerMillion: 1, outputPerMillion: 4 }] },
    ] }],
    calendar: {}, calendarMissing: [], dataDir: 'x', updatedAt: 0,
  }
  const baseline = baselinesOf(view)
  const seeded = draftFromView(view)
  const real = seeded.routes.get('r')!.models.get('m')!.segments
  const withDraft = { ...seeded.routes.get('r')!.models.get('m')!, segments: [...real, newSegment()] }
  check('刚种下的行是干净的;＋ 加一段价既不改脏标记也不改请求体',
    modelDirty('r', seeded.routes.get('r')!.models.get('m')!, baseline.models) === false
    && modelDirty('r', withDraft, baseline.models) === false
    && JSON.stringify(bodyOf(withDraft.segments)) === JSON.stringify(bodyOf(real)))

  const seg = newSegment({ from: '2026-09-01', input: '1', output: '4', cacheRead: '0.02' })
  const partial = newSlot({ start: '9', end: '12', input: '2' })
  const partialBody = bodyOf([{ ...seg, slots: [partial] }])
  const written = partialBody.ok ? (partialBody.body.r as Record<string, Record<string, { slots: Record<string, unknown>[] }[]>>).m![0]!.slots[0]! : {}
  check('空白时段同样不写;写了的时段只写它重述的那几档',
    isBlankSlot(newSlot()) === true && JSON.stringify(bodyOf([{ ...seg, slots: [newSlot()] }])) === JSON.stringify(bodyOf([seg]))
    && JSON.stringify(written) === JSON.stringify({ days: 'daily', start: 9, end: 12, inputPerMillion: 2 })
    && rowIssue(model([{ ...seg, slots: [newSlot({ input: 'abc' })] }]))?.includes('输入价') === true)

  const source = newSlot({ start: '9', end: '12', input: '2' })
  const copy = duplicateSlot(source)
  const lateCopy = duplicateSlot(newSlot({ start: '22', end: '24' }))
  check('复制贴在源旁边(不压在它身上),贴到一天末尾时改为往前贴',
    copy.start === '12' && copy.end === '15' && copy.input === '2'
    && slotsOverlap({ days: 'daily', ...slotRange(source) }, { days: 'daily', ...slotRange(copy) }) === false
    && lateCopy.start === '20' && lateCopy.end === '22')

  check('挑小时永远经过合法区间:越过端点就把另一端带着走,没越过就不动它',
    withSlotStart(newSlot({ start: '9', end: '12' }), '14').end === '15'
    && withSlotEnd(newSlot({ start: '14', end: '18' }), '12').start === '11'
    && withSlotStart(newSlot({ start: '9', end: '18' }), '10').end === '18')

  // 行内的四个数字只读,读的是**此刻计费所用的价**:生效段叠上此刻生效的峰谷时段。
  const peakRow = model([{
    ...newSegment({ from: '2026-09-01', input: '1', output: '4', cacheRead: '0.2', cacheWrite: '' }),
    slots: [newSlot({ days: 'weekdays', start: '9', end: '12', input: '2' })],
  }])
  const peak = ratesInForce(peakRow, new Set(), dayMillis('2026-09-14', 10))     // 周一 10:00,落在 09:00–12:00 里
  const offPeak = ratesInForce(peakRow, new Set(), dayMillis('2026-09-14', 13))
  check('此刻价 = 生效段的基准价叠上此刻生效的峰谷时段(留空的档沿用基准价),没生效时段时就是基准价',
    peak?.slot?.start === '9' && peak.values.input === '2' && peak.values.output === '4'
    && peak.values.cacheRead === '0.2' && peak.values.cacheWrite === ''
    && offPeak?.slot === null && offPeak.values.input === '1' && offPeak.values.cacheRead === '0.2')

  // 一段价必须有生效时刻:清空日期不落地(没有「无起点」那张卡可以退回去)。
  const dated = newSegment({ from: '2026-09-20', input: '1', output: '4' })
  check('清空一段价的生效时间不落地;改日期则就地改到那一段上',
    withSegmentFrom(dated, '') === dated && withSegmentFrom(dated, '2026-09-21T13:00').from === '2026-09-21T13:00')
}

if (section('没有价段覆盖的日期:按 ¥0 计,播种不补卡')) {
  const rowView = (firstAt: number | undefined, segments: PricingSegmentInput[]): PricingView => ({
    routes: [{ route: 'r', label: 'r', billing: 'metered', records: 4, models: [
      { model: 'm', configured: true, records: 4, ...(firstAt !== undefined ? { firstAt } : {}), segments },
    ] }],
    calendar: {}, calendarMissing: [], dataDir: 'x', updatedAt: 0,
  })
  const firstAt = dayMillis('2026-08-15', 18) + 47 * 60_000
  const rowOf = modelRow
  const bodyOf = bodyOfRow

  // 播种**不补任何卡**:文件里有几段就是几段,一段都没有就是一段都没有。
  const datedOnly: PricingSegmentInput[] = [{ from: '2026-09-01', inputPerMillion: 2, outputPerMillion: 8 }]
  const seeded = draftFromView(rowView(firstAt, datedOnly)).routes.get('r')!.models.get('m')!
  const bare = draftFromView(rowView(firstAt, [])).routes.get('r')!.models.get('m')!
  check('播种不补卡:有日期的段照旧,没有价的行走径就是空(要价得自己加一段)',
    seeded.segments.length === 1 && seeded.segments[0]!.from === '2026-09-01'
    && bare.segments.length === 0
    && modelDirty('r', seeded, baselinesOf(rowView(firstAt, datedOnly)).models) === false)

  // 一段价必须有生效时刻:日期空着的那张卡写不出去(整行报问题,body 被拒)。
  const undated = { ...seeded, segments: [{ ...seeded.segments[0]!, from: '' }] }
  check('日期空着的一段价写不出去:行报问题,compose 也被拒',
    rowIssue(undated)?.includes('生效时间') === true && bodyOf(undated).ok === false)

  // 一次调价只影响它之后的时刻:之前的时间没有任何段覆盖 → 价格未知(金额按 ¥0 计)。
  const both = rowOf([
    { ...newSegment({ from: '2026-08-01', input: '1', output: '4' }) },
    { ...newSegment({ from: '2026-09-01', input: '2', output: '8' }) },
  ], { records: 9, firstAt })
  check('此刻价取最后一段已生效的;一段都没生效时没有价可报(行内显示「—」,不是 ¥0)',
    ratesInForce(both, new Set(), dayMillis('2026-08-20', 9))?.values.input === '1'
    && ratesInForce(both, new Set(), dayMillis('2026-09-02', 9))?.values.input === '2'
    && ratesInForce(rowOf([{ ...newSegment({ from: '2026-12-01', input: '1', output: '4' }) }]), new Set(), dayMillis('2026-09-02', 9)) === null)

  // 价格未知 = 整行没有价（空白草稿不算价）,或有账本记录早于最早的一段有价段。
  check('价格未知只由「没有价」与「有记录早于最早一段价」两条触发',
    priceUnknown(rowOf([])) === true
    && priceUnknown(rowOf([newSegment({ from: '2026-08-01' })])) === true
    && priceUnknown(rowOf([{ ...newSegment({ from: '2026-08-01', input: '1', output: '4' }) }], { records: 9, firstAt })) === false
    && priceUnknown(rowOf([{ ...newSegment({ from: '2026-09-01', input: '1', output: '4' }) }], { records: 9, firstAt })) === true)
}

if (section('价格表写路径:草稿写出去的 body 一定被宿主接受')) {
  // 不变量:**client 产出 ⊆ host 接受**(`docs/CONTRACTS.md` §2)。规则在两侧各写一份的
  // 代价正是「草稿认为能存、写入被拒」,所以这里不重列规则,而是把
  // 「草稿 → body → host 解析」真的跑一遍——两侧各写各的检查时,只有往返能发现缺口。
  const draftOf = (route: string, model: string, segments: SegmentDraft[], billing: BillingNature = 'metered'): PriceState =>
    draftOfRow(modelRow(segments, { model }), { route, model, billing })
  const roundTrip = (draft: PriceState): ReturnType<typeof parsePriceInput> => {
    const body = composePriceBody(draft)
    return body.ok ? parsePriceInput(body.body) : { ok: false, error: body.error }
  }
  const floor = newSegment({ from: '2026-08-01', input: '1', output: '4', cacheRead: '0.02', cacheWrite: '0.5' })
  const dated = newSegment({
    from: '2026-09-01T13:00', input: '2', output: '8',
    slots: [
      newSlot({ days: 'weekdays', start: '9', end: '12', input: '4' }),
      newSlot({ days: 'weekends', start: '9', end: '12', output: '16' }),
    ],
  })
  const accepted: [string, PriceState][] = [
    ['两段价 + 整点调价 + 两组时段', draftOf('deepseek-official', 'deepseek-chat', [floor, dated])],
    ['订阅通道($billing)', draftOf('commandcode', 'deepseek-chat', [floor], 'subscription')],
    ['整行都是空白草稿(不进 body)', draftOf('r', 'm', [newSegment()])],
    ['1970 前的生效时刻', draftOf('r', 'm', [floor, newSegment({ from: '1900-01-01', input: '3', output: '9' })])],
  ]
  const refused = accepted.filter(([, draft]) => !roundTrip(draft).ok)
  check('每一份草稿产出的 body 都被宿主接受',
    refused.length === 0, refused.map(([label, draft]) => [label, composePriceBody(draft)]))

  // 新写入不再接受「没有生效时刻」的段:`from` 是必填,写路径与宿主一致(草稿那侧由
  // 空日期拒掉,手写的 body 由宿主拒掉)。
  const undated = parsePriceInput({ r: { m: [{ inputPerMillion: 1, outputPerMillion: 4 }] } })
  const emptyFrom = parsePriceInput({ r: { m: [{ from: '', inputPerMillion: 1, outputPerMillion: 4 }] } })
  check('无生效时刻的段写不进去:宿主拒收,草稿那侧同样拒(日期空着 = 行有问题)',
    undated.ok === false && undated.error.includes('缺少 from')
    && emptyFrom.ok === false
    && composePriceBody(draftOf('r', 'm', [{ ...newSegment({ from: '' }), input: '1', output: '4' }])).ok === false)

  // 反向:宿主拒绝的键规则不能是「草稿以为能存」的那种。长度上限与保留键前缀同源于
  // `price-format.ts`,所以草稿这一侧就报得出位置与原因,而不是整份文件被拒。
  const longRoute = 'r'.repeat(MAX_ROUTE_LENGTH + 1)
  const longModel = 'm'.repeat(MAX_MODEL_LENGTH + 1)
  const keyRefusals: [string, PriceState, string][] = [
    ['空通道路由名', draftOf('', 'm', [floor]), '空通道路由名'],
    ['保留键前缀', draftOf('$weird', 'm', [floor]), '「$」'],
    ['过长的通道路由名', draftOf(longRoute, 'm', [floor]), '通道路由名超过'],
    ['过长的模型串', draftOf('r', longModel, [floor]), '模型串超过'],
  ]
  const notRefused = keyRefusals.filter(([, draft, expected]) => {
    const body = composePriceBody(draft)
    return body.ok || !body.error.includes(expected)
  })
  check('草稿自己在本地就报出宿主的键规则与长度上限(带位置与原因)',
    notRefused.length === 0, notRefused.map(([label, draft]) => [label, composePriceBody(draft)]))

  // 写不出去的档必须让这一行保持脏:否则工具栏说「已保存」,而那一格还红着。
  const cacheBaseline = baselinesOf({
    routes: [{
      route: 'r', label: 'r', billing: 'metered', records: 0,
      models: [{ model: 'm', configured: true, records: 0, segments: [{ from: '2026-08-01', inputPerMillion: 1, outputPerMillion: 4, cacheReadPerMillion: 1 }] }],
    }],
    dataDir: 'x', updatedAt: 0,
  })
  const rowWith = (cacheRead: string): ModelDraft =>
    modelRow([{ ...newSegment({ from: '2026-08-01', input: '1', output: '4' }), cacheRead }])
  check('填了却写不出去的缓存档让这一行保持脏(合法的值则与基线一致)',
    modelDirty('r', rowWith('abc'), cacheBaseline.models) === true
    && modelDirty('r', rowWith('1'), cacheBaseline.models) === false
    && composePriceBody(draftOf('r', 'm', rowWith('abc').segments)).ok === false)
}

if (section('价格表币种:换算只改读写面,不改落盘内容')) {
  const USD: MoneyView = { currency: 'USD', cnyPerUsd: 7.15 }

  // 两个方向是同一件事:文件里存人民币,美元只是它除以汇率的样子。人民币面两个函数都恒等,
  // 所以「没设汇率 / 没切过去」时这一屏的行为与引入币种之前逐字一致。
  check('换算:美元面按汇率读写,人民币面恒等(含空串与换算不出来的原文)',
    storedText(USD, '0.28') === '2.002' && textOf(USD, '2.002') === '0.28'
    && textOf(USD, '0.02') === '0.002797' && storedText(USD, '0') === '0'
    && storedText(USD, '') === '' && storedText(USD, 'abc') === null && textOf(USD, 'abc') === 'abc'
    && textOf(CNY_VIEW, '2.002') === '2.002' && storedText(CNY_VIEW, 'abc') === 'abc'
    && isUsd(USD) && !isUsd({ currency: 'USD', cnyPerUsd: null }) && !isUsd(CNY_VIEW))

  // 敲进去一个美元价、看一眼还是那个数:这正是「逐键换算却不跟光标抢」（`RateCell` 的输入缓冲）
  // 成立的前提。一行 = 一个用例;极小价那一行同时挡住「美元价被换算成 ¥0 = 免费」。
  const typed = ['0.28', '0.0028', '1', '2.002', '0.0000000143', '0']
  const drifted = typed.filter((text) => {
    const stored = storedText(USD, text)
    return stored === null || textOf(USD, stored) !== text
  })
  check('美元面敲进去的数看一眼还是它(极小价也不会被换算成 ¥0)', drifted.length === 0, drifted)

  // 汇率是全表共用的一份数据,住在价文件里:有 / 无两种播种都要对,且它只算一处脏——
  // 「只改了汇率」要让状态栏说得出「待保存…」,而 `7.150` 与 `7.15` 写出去的是同一个数。
  const view: PricingView = {
    routes: [{ route: 'r', label: 'r', billing: 'metered', records: 0, models: [
      { model: 'm', configured: true, records: 0, segments: [{ from: '2026-08-01', inputPerMillion: 2, outputPerMillion: 8 }] },
    ] }],
    calendar: {}, calendarMissing: [], fx: { cnyPerUsd: 7.15 }, dataDir: 'x', updatedAt: 0,
  }
  const seeded = draftFromView(view)
  const baseline = baselinesOf(view)
  check('汇率从视图播种;只改汇率算一处脏,播种的汇率与基线一致(切币种本身不是改动)',
    seeded.fx === '7.15' && draftFromView({ ...view, fx: undefined }).fx === ''
    && stagedChanges(seeded, baseline) === 0 && stagedChanges(withFx(seeded, '7.2'), baseline) === 1
    && stagedChanges(withFx(seeded, '7.150'), baseline) === 0
    && fxSignature('7.150') === fxSignature('7.15') && fxValue('') === null && fxValue('0') === null)

  // 汇率随保存 body 出去,并被宿主同一套解析接受;空着就是未设汇率(不是「按 1 算」)。
  const rateBody = composePriceBody(seeded)
  check('$fx 随保存 body 出去且被宿主接受:填了才有这个键,空着就是不写',
    rateBody.ok && rateBody.body[PRICING_FX_KEY] !== undefined && parsePriceInput(rateBody.body).ok
    && composePriceBody(withFx(seeded, '')).body[PRICING_FX_KEY] === undefined)

  // 填了却写不出去的汇率必须挡住这一笔:让它过去就是把用户敲的数**悄悄丢掉**,
  // 而状态栏还会说「已保存」（与四档价里那一格红着是同一条尺子）。
  const badRates = ['abc', '0', '-1'].filter((text) => {
    const body = composePriceBody(withFx(seeded, text))
    return body.ok || !body.error.includes('汇率')
  })
  check('填坏的汇率挡住整笔保存,空着不算坏', badRates.length === 0
    && composePriceBody(withFx(seeded, '')).ok && composePriceBody(withFx(seeded, '  ')).ok)

  // 鬼影与悬停说明里的数跟着货币走:格子里是美元、旁边注解还报人民币是最容易漏的一处。
  const segment = newSegment({ from: '2026-08-01', input: '2.002', output: '8', cacheRead: '' })
  const shown = inheritedCell(segment, null, 'cacheRead', cny => textOf(USD, cny))
  check('留空档的鬼影与说明一起换算(cache 档回落到输入价),人民币面照旧',
    shown.value === '0.28' && shown.note?.includes('0.28') === true
    && inheritedCell(segment, null, 'cacheRead').value === '2.002')

  check('单位与换算原值进提示:美元面报 $/百万词元并附上 ¥ 原值',
    unitOf(USD) === '$/百万词元' && unitOf(CNY_VIEW) === '¥/百万词元'
    && originOf(USD, '2.002') === '= ¥2.002/百万词元' && originOf(CNY_VIEW, '2.002') === null)
}

if (section('折叠自证有效:天级水位线看不见往日的追加')) {
  const rollupOf = (upto: string, files: Record<string, string>): RollupFile => ({
    schemaVersion: 7, upto, pricingRevision: '', files,
    total: { requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    byDay: [], byHour: [], byModel: [], rateRows: [],
  })
  const stamps = new Map([['usage-2026-01-02.jsonl', '10:1'], ['usage-2026-01-03.jsonl', '20:1']])
  const cases: [string, boolean, boolean][] = [
    ['折进去的版本没变 → 仍然有效',
      rollupIsCurrent(rollupOf('2026-01-03', { 'usage-2026-01-02.jsonl': '10:1', 'usage-2026-01-03.jsonl': '20:1' }), stamps), true],
    ['往日被追加(版本变了) → 作废',
      rollupIsCurrent(rollupOf('2026-01-03', { 'usage-2026-01-02.jsonl': '11:2', 'usage-2026-01-03.jsonl': '20:1' }), stamps), false],
    ['折进去的日文件被删掉 → 作废',
      rollupIsCurrent(rollupOf('2026-01-03', { 'usage-2026-01-02.jsonl': '10:1' }), stamps), false],
    ['水位线之内冒出折叠时还不存在的日文件 → 作废',
      rollupIsCurrent(rollupOf('2026-01-03', { 'usage-2026-01-02.jsonl': '10:1', 'usage-2026-01-03.jsonl': '20:1' }), new Map([...stamps, ['usage-2026-01-01.jsonl', '1:1']])), false],
    ['水位线之外的日文件不参与判定(本轮单独折)',
      rollupIsCurrent(rollupOf('2026-01-02', { 'usage-2026-01-02.jsonl': '10:1' }), stamps), true],
  ]
  check('折叠只在「折进去的那批文件逐版本仍在」时才可信',
    cases.every(([, actual, expected]) => actual === expected),
    cases.filter(([, actual, expected]) => actual !== expected).map(([label]) => label))
}

if (section('路由目录:本机设置 ∪ 运行时注册表')) {
  const settings = {
    get(ns: string): unknown {
      if (ns === 'llm-pi-ai') {
        return { providers: {
          'opencode-go': { models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' }, { id: 'glm-5.3-flash', name: 'glm-5.3-flash' }] },
          'dots-ai': { displayName: '小红书', models: [{ id: 'dots3-note-prev' }] },
        } }
      }
      if (ns === 'llm-deepseek') return { models: [{ id: 'deepseek-v4-flash' }] }
      return undefined
    },
  }
  const fromSettings = routesFromSettings(settings)
  check('文档提供的路由:displayName 成为标签,与 id 同名的「名字」丢掉,直连 DeepSeek 只加一次',
    fromSettings.some(e => e.route === 'opencode-go' && e.models.length === 2)
    && fromSettings.find(e => e.route === 'dots-ai')?.label === '小红书'
    && fromSettings.filter(e => e.route === DEEPSEEK_ROUTE).length === 1
    && fromSettings.find(e => e.route === 'opencode-go')?.label === ''
    && fromSettings.find(e => e.route === 'opencode-go')?.models[0]?.name === 'DeepSeek V4 Flash'
    && fromSettings.find(e => e.route === 'opencode-go')?.models[1]?.name === undefined)

  const llm = {
    listProviders: () => [{ id: 'opencode-go', name: 'OpenCode Go' }, { id: 'modlens-commandcode', name: 'Command Code' }, { id: DEEPSEEK_ROUTE, name: 'DeepSeek' }],
    listModels: async (route: string) => (route === 'modlens-commandcode' ? [{ id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash' }] : [{ id: 'ignored' }]),
  }
  const catalog = await collectRoutes(settings, llm, quiet)
  check('注册表补上文档没写的路由与模型、不覆盖已配置的列表,并给出路由名',
    catalog.some(e => e.route === 'modlens-commandcode')
    && catalog.find(e => e.route === 'modlens-commandcode')?.models[0]?.id === 'deepseek/deepseek-v4-flash'
    && catalog.find(e => e.route === 'modlens-commandcode')?.models[0]?.name === 'DeepSeek V4 Flash'
    && catalog.find(e => e.route === 'opencode-go')?.models.length === 2
    && catalog.find(e => e.route === 'opencode-go')?.label === 'OpenCode Go'
    && catalog.find(e => e.route === DEEPSEEK_ROUTE)?.label === 'DeepSeek')
}

if (section('工作区:按目录累计用量')) {
  const pricing = {
    'deepseek-official': { 'deepseek-chat': [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 2, outputPerMillion: 8 } }] },
    'opencode-go': { 'deepseek-chat': [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 2, outputPerMillion: 8 } }] },
  }
  const billing = { 'opencode-go': 'subscription' as const }
  const resolveRate = (r: UsageRecord) => rateKeyAt(pricing, r.provider, r.model, r.time)
  const harness = resolve('tokbook-smoke', 'harness')
  const workspaces = [
    { id: 'w-harness', title: 'harness', path: harness },
    { id: 'w-wiki', title: 'wiki', path: resolve('tokbook-smoke', 'wiki') },
    { id: 'w-cold', title: 'cold', path: resolve('tokbook-smoke', 'cold') },
  ]
  // 同一目录的另一种写法(分隔符 + `.`)算同一个工作区;没注册的目录与日志已消失的会话
  // 落进唯一的「未归属」行;只失败过的已注册工作区不出现。
  const cwd = new Map<string, string>([
    ['s-new', harness + sep + '.'],
    ['s-old', resolve('tokbook-smoke', 'wiki')],
    ['s-loose', resolve('tokbook-smoke', 'loose')],
    ['s-cold', resolve('tokbook-smoke', 'cold')],
  ])
  const t = (day: number): number => dayMillis(`2026-03-0${String(day)}`, 9)
  const recs: UsageRecord[] = [
    { requestId: 'a', time: t(1), sessionId: 's-old', provider: 'deepseek-official', model: 'deepseek-chat', usage: { inputTokens: 1_000_000, outputTokens: 0 } },
    { requestId: 'b', time: t(2), sessionId: 's-new', provider: 'opencode-go', model: 'deepseek-chat', usage: { inputTokens: 1_000_000, outputTokens: 0 } },
    { requestId: 'f', time: t(2), sessionId: 's-new', provider: 'deepseek-official', model: 'deepseek-chat', usage: { inputTokens: 500_000, outputTokens: 0 } },
    { requestId: 'c', time: t(3), sessionId: 's-loose', provider: 'deepseek-official', model: 'deepseek-chat', usage: { inputTokens: 500_000, outputTokens: 0 } },
    { requestId: 'd', time: t(4), sessionId: 's-gone', provider: 'deepseek-official', model: 'deepseek-chat', usage: { inputTokens: 250_000, outputTokens: 0 } },
    { requestId: 'e', time: t(5), sessionId: 's-cold', provider: 'deepseek-official', model: 'deepseek-chat', kind: 'failure', failureCode: 'QUOTA' },
  ]
  const rows = workspaceRows(recs, workspaces, id => cwd.get(id), pricing, resolveRate, billing)
  check('行按最近使用降序、未归属收尾,只失败过的工作区不成行;另一种写法的 cwd 归位,跨通道的工作区两个钱桶都在',
    rows.map(r => r.id).join(',') === 'w-harness,w-wiki,'
    && rows[0]?.tokens === 1_500_000 && Math.abs((rows[0]?.spend ?? -1) - 1) < 1e-9 && Math.abs((rows[0]?.subscriptionValue ?? -1) - 2) < 1e-9
    && Math.abs((rows[1]?.spend ?? 0) - 2) < 1e-9 && Math.abs(rows[1]?.subscriptionValue ?? -1) < 1e-9
    && rows.length === 3)
  check('唯一的未归属行装着所有没被认领的记录,失败行不会被改嫁到它名下;各行合计与账本总量对得上',
    rows[2]?.title === '未归属' && rows[2]?.path === '' && rows[2]?.tokens === 750_000 && Math.abs((rows[2]?.spend ?? -1) - 1.5) < 1e-9
    && rows[2]?.lastAt === t(4) && rows[2]?.totals.failures === 0
    && rows.reduce((sum, row) => sum + row.tokens, 0) === totalsTokens(summarizeRecords(recs, resolveRate).total)
    && pathKey(harness + sep + '.') === pathKey(harness)
    && dayFileNameOf(dayMillis('2026-01-05', 3)) === 'usage-2026-01-05.jsonl')
}

if (section('端到端:真形状的 DSH 事件 → JSONL 账本 → 聚合 → 成本')) {
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-'))
  try {
    const log = new UsageLog(dir, quiet)
    // request/context → 两条计费 assistant/message → 一条通道没上报用量的 → summarize
    // → llm/retry 与 turn/end 两次失败 → 又一次没上报用量的 summarize。
    const events: SessionEventLike[] = [
      { type: 'request/context', time: dayMillis('2026-02-01', 9), seq: 0, data: { provider: 'deepseek', model: 'deepseek-chat' } },
      { type: 'assistant/message', time: dayMillis('2026-02-01', 9), seq: 1, data: { message: { id: 'msg-1', source: { provider: 'deepseek', model: 'deepseek-chat' } }, usage: { inputTokens: 1200, outputTokens: 300, cacheReadTokens: 500 } } },
      { type: 'assistant/message', time: dayMillis('2026-02-01', 10), seq: 2, data: { message: { id: 'msg-2', source: { provider: 'deepseek', model: 'deepseek-reasoner' } }, usage: { inputTokens: 900, outputTokens: 660, cacheWriteTokens: 100 } } },
      { type: 'assistant/message', time: dayMillis('2026-02-01', 10), seq: 3, data: { message: { id: 'msg-3', source: { provider: 'deepseek', model: 'deepseek-reasoner' } }, interrupted: true } },
      { type: 'compaction/summary', time: dayMillis('2026-02-01', 11), seq: 4, data: { provider: 'deepseek', model: 'deepseek-chat', usage: { inputTokens: 80, outputTokens: 40 } } },
      { type: 'llm/retry', time: dayMillis('2026-02-01', 11), seq: 5, data: { provider: 'deepseek', failure: { code: 'RATE_LIMIT', message: 'rate' } } },
      { type: 'turn/end', time: dayMillis('2026-02-01', 11), seq: 6, data: { reason: { kind: 'error', error: { code: 'QUOTA', message: 'q' } } } },
      { type: 'compaction/summary', time: dayMillis('2026-02-01', 12), seq: 7, data: { provider: 'deepseek', model: 'deepseek-chat' } },
    ]
    let recorded = 0
    let model = ''
    for (const ev of events) {
      const revealed = (ev.type === 'request/context' || ev.type === 'assistant/message') ? (ev.data?.model ?? ev.data?.message?.source.model) : undefined
      if (revealed !== undefined) model = revealed
      const rec = recordOfEvent(ev, 'sess-1', model, true)
      if (rec !== null && await log.record(rec)) recorded += 1
    }
    check('事件流折成 7 行落进按日 JSONL(去重后)', recorded === 7, `got ${recorded}`)

    const table: PricingTable = { deepseek: {
      'deepseek-chat': [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5, cacheWritePerMillion: 1 } }],
      'deepseek-reasoner': [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 4, outputPerMillion: 16, cacheReadPerMillion: 1, cacheWritePerMillion: 2 } }],
    } }
    const summary = await buildSummary(dir, () => new Date('2026-02-02T00:00:00Z'), (r) => rateKeyAt(table, r.provider, r.model, r.time), quiet)
    const costed = attachCosts(summary, table)
    check('totals:2 条 assistant + 1 条中断 + 2 次 summarize = 5 请求,2 次压缩,2 次失败,2 条用量未知',
      summary.total.inputTokens === 2180 && summary.total.outputTokens === 1000 && summary.total.requests === 5
      && summary.total.compactions === 2 && summary.total.failures === 2 && summary.total.usageUnknown === 2
      && costed.totalCost > 0 && summary.byDay.length === 1 && totalsTokens(summary.byDay[0]!.totals) === 3780)
    // 聚合身份是 (通道, 模型):没归属的失败行(带着最后已知的模型、却没有 provider 头)自成一
    // 行,绝不并进计费行。
    check('聚合身份是 (通道, 模型):同一模型经两条通道不合并,没归属的失败行自成一格',
      summary.byModel.length === 3
      && summary.byModel.some(r => r.provider === 'deepseek' && r.model === 'deepseek-chat' && r.totals.requests === 3 && r.totals.usageUnknown === 1)
      && summary.byModel.some(r => r.provider === 'deepseek' && r.model === 'deepseek-reasoner' && r.totals.requests === 2 && r.totals.usageUnknown === 1)
      && summary.byModel.some(r => r.provider === '' && r.model === 'deepseek-reasoner' && r.totals.failures === 2)
      && totalsTokens(costed.total) === 3780)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

if (section('新鲜度门:什么时候值得重走历史')) {
  const snaps = (ids: string[], revs: string[]): readonly { header: { id: string }; revision: unknown }[] =>
    ids.map((id, i) => ({ header: { id }, revision: revs[i] }))
  const synced = new Map([['a', 'r1'], ['b', 'r2']])
  const dirtyCases: [string, boolean, boolean][] = [
    ['从没同步过', isLedgerStale(false, new Map(), snaps(['a'], ['r1'])), true],
    ['集合与签名都没变', isLedgerStale(true, synced, snaps(['a', 'b'], ['r1', 'r2'])), false],
    ['签名漂移(追加过事件)', isLedgerStale(true, synced, snaps(['a', 'b'], ['r1', 'r9'])), true],
    ['多了个会话', isLedgerStale(true, synced, snaps(['a', 'b', 'c'], ['r1', 'r2', 'r3'])), true],
    ['只有会话被删', isLedgerStale(true, synced, snaps(['a'], ['r1'])), false],
    ['同步过之后零会话', isLedgerStale(true, new Map(), []), false],
  ]
  check('只有签名漂移与新会话算脏:删会话不算(没有东西可同步),同步过之后空集合也不算',
    dirtyCases.every(([, actual, want]) => actual === want), dirtyCases.filter(([, a, w]) => a !== w).map(([label]) => label))
  const changeSets: [string, string, string][] = [
    ['从没同步过 → 全部', JSON.stringify(staleSessionIds(false, new Map(), snaps(['a', 'b'], ['r1', 'r2']))), JSON.stringify(['a', 'b'])],
    ['没变 → 空(整个 walk 都省掉)', JSON.stringify(staleSessionIds(true, synced, snaps(['a', 'b'], ['r1', 'r2']))), JSON.stringify([])],
    ['漂移 → 只有它', JSON.stringify(staleSessionIds(true, synced, snaps(['a', 'b'], ['r1', 'r9']))), JSON.stringify(['b'])],
    ['删一个 + 多一个 → 删掉的不算,新的立刻算', JSON.stringify(staleSessionIds(true, synced, snaps(['b', 'c'], ['r2', 'r3']))), JSON.stringify(['c'])],
  ]
  check('增量变更集:没同步过 = 全部,没变 = 空,删掉的不算工作量,新的立刻算', changeSets.every(([, a, w]) => a === w), changeSets.filter(([, a, w]) => a !== w).map(([label]) => label))
}

if (section('持久化列表与历史回填')) {
  const inspect = async () => ({ meta: { id: 'x' }, events: [] })
  // `list()` 只回带 header 的裸快照,是真实形状;调用方必须归一化(浮窗那次 HTTP 500 的成因)。
  const bare = await listPersistenceSnapshots({ inspect, list: async () => [{ id: 's1' }, { version: 1 }] as never[] })
  const preferred = await listPersistenceSnapshots({
    inspect,
    listSnapshots: async () => [{ header: { id: 's1' }, revision: 'r1' }, { header: { id: 's2' }, revision: 'r2' }, null as never],
  })
  check('list() 优先;只有旧名 listSnapshots() 时也能归一化,垃圾条目丢掉',
    bare.length === 1 && bare[0]!.header.id === 's1' && preferred.length === 2 && preferred[1]!.revision === 'r2')
  check('没有 revision 的快照永远读不成新鲜(它没法与同步签名比对)',
    staleSessionIds(true, new Map([['s1', 'r1']]), [{ header: { id: 's1' } }]).length === 1
    && staleSessionIds(true, new Map([['s1', 'r1']]), [{ header: { id: 's1' }, revision: 'r1' }, { header: { id: 's2' } }]).join(',') === 's2')
}

if (section('历史回填 syncHistory')) {
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-sync-'))
  try {
    const log = new UsageLog(dir, quiet)
    const events: SessionEventLike[] = [
      { type: 'request/context', time: dayMillis('2026-02-01', 9), seq: 1, data: { provider: 'deepseek', model: 'deepseek-chat' } },
      { type: 'assistant/message', time: dayMillis('2026-02-01', 9), seq: 2, data: { turn: 1, step: 1, message: { id: 'msg-1', role: 'assistant', content: [], source: { kind: 'model', provider: 'deepseek', model: 'deepseek-chat' } }, usage: { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 300 } } },
      { type: 'assistant/message', time: dayMillis('2026-02-01', 10), seq: 5, data: { turn: 2, step: 1, message: { id: 'msg-2', role: 'assistant', content: [], source: { kind: 'model', provider: 'deepseek', model: 'deepseek-reasoner' } }, usage: { inputTokens: 500, outputTokens: 150 } } },
      { type: 'compaction/summary', time: dayMillis('2026-02-01', 11), seq: 9, data: { compactionId: 'c1', summary: [], shadowedRange: { start: 2, end: 5 }, shadowedSeqs: [2, 5], shadowedTokenCount: 100, provider: 'deepseek', model: 'deepseek-chat', usage: { inputTokens: 90, outputTokens: 30 } } },
      { type: 'llm/retry', time: dayMillis('2026-02-01', 11), seq: 10, data: { retryId: 'r1', turn: 3, step: 1, provider: 'deepseek', mode: 'normal', policyKey: 'p', retry: 1, maxRetries: 3, delayMs: 500, failure: { message: 'rate', code: 'RATE_LIMIT' } } },
      { type: 'turn/end', time: dayMillis('2026-02-01', 12), seq: 12, data: { turn: 3, reason: { kind: 'error', error: { message: 'quota', code: 'QUOTA' } } } },
    ]
    const persistence = {
      listSnapshots: async () => [{ header: { id: 'sess-1', version: 1 }, revision: 'rev-1' }],
      inspect: async (id: string) => {
        if (id !== 'sess-1') throw new Error(`not found: ${id}`)
        return { meta: { id: 'sess-1' }, events }
      },
    }
    const result = await syncHistory({ persistence, log, recordCompaction: true })
    const again = await syncHistory({ persistence, log, recordCompaction: true })
    check('回填把 2 条请求 + 1 次压缩 + 2 次失败记成 5 行,再跑一次不重复写(幂等)',
      result.added === 5 && result.skipped === 0 && result.failedSessions === 0 && again.added === 0 && again.skipped === 5)
    // 格式迁移会稠密重排信封 seq:压缩/失败行的身份必须取自事件自带的 id,
    // 否则同一事件会被记成两行(压缩成本与失败计数都会偏)。
    const shifted = events.map(event => ({ ...event, seq: event.seq + 4096 }))
    const afterMigration = await syncHistory({
      persistence: {
        listSnapshots: async () => [{ header: { id: 'sess-1', version: 1 }, revision: 'rev-1-migrated' }],
        inspect: async () => ({ meta: { id: 'sess-1' }, events: shifted }),
      },
      log,
      recordCompaction: true,
    })
    check('信封 seq 被格式迁移重排后回填不重复写(身份取自事件自带 id)',
      afterMigration.added === 0 && afterMigration.skipped === 5 && afterMigration.failedSessions === 0)
    // 一个会话读不动时跳过它并计数,不弄坏其余会话。
    const partial = await syncHistory({
      persistence: {
        listSnapshots: async () => [{ header: { id: 'bad', version: 1 }, revision: 'rev-b' }, { header: { id: 'sess-1', version: 1 }, revision: 'rev-1' }],
        inspect: async (id: string) => {
          if (id === 'bad') throw new Error('corrupt log')
          if (id !== 'sess-1') throw new Error(`not found: ${id}`)
          return { meta: { id }, events }
        },
      },
      log,
      recordCompaction: true,
    })
    check('读不动的会话被跳过并计数,其余照常走完', partial.failedSessions === 1 && partial.skipped === 5)
    // 0.1.7 起的持久化面没有 inspect/listSnapshots:`list()` 给快照,
    // `open(id,'read')` 给只读句柄。回填必须走这条路,且句柄读完就关。
    const accesses: string[] = []
    const handles: string[] = []
    const v4 = {
      list: async () => [{ header: { id: 'sess-1', cwd: '/w' }, revision: 'rev-1' }],
      open: async (id: string, access: 'read') => {
        accesses.push(`${id}:${access}`)
        return {
          read: async () => ({ eventState: 'owned' as const, events }),
          close: async () => { handles.push(id) },
        }
      },
    }
    const viaHandles = await syncHistory({ persistence: v4, log, recordCompaction: true })
    check('新持久化面(list + open/read、无 inspect)照样回填,句柄只读且读完即关',
      viaHandles.added === 0 && viaHandles.skipped === 5 && viaHandles.failedSessions === 0
      && accesses.join(',') === 'sess-1:read' && handles.join(',') === 'sess-1')
    // 两条读法都没有时,该会话计失败而不是把整轮 walk 掀掉。
    const neither = await syncHistory({
      persistence: { list: async () => [{ header: { id: 'sess-1' }, revision: 'rev-1' }] },
      log,
      recordCompaction: true,
    })
    check('既没有 inspect 也没有 open:会话计失败,walk 不抛', neither.failedSessions === 1 && neither.added === 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

if (section('通道卡片与按模型切法')) {
  // 同一个模型串经两条通道计费必须分开:卡片按通道分区,(通道, 模型) 在卡内唯一。
  const records: UsageRecord[] = [
    { requestId: 'r1', time: dayMillis('2026-03-01', 9), sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-v4-flash', usage: { inputTokens: 1000, outputTokens: 200 } },
    { requestId: 'r2', time: dayMillis('2026-03-01', 9), sessionId: 's2', provider: 'opencode-go', model: 'deepseek-v4-flash', usage: { inputTokens: 500, outputTokens: 50 } },
    { requestId: 'r3', time: dayMillis('2026-03-01', 10), sessionId: 's2', provider: 'opencode-go', model: 'glm-5.3-flash', usage: { inputTokens: 300, outputTokens: 40, cacheReadTokens: 200 } },
    { requestId: 'r4', time: dayMillis('2026-03-01', 10), sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-v4-flash', kind: 'failure', failureCode: 'QUOTA' },
  ]
  const pricing: PricingTable = {
    'deepseek-official': { 'deepseek-v4-flash': [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 2, outputPerMillion: 8 } }] },
    'opencode-go': {
      'deepseek-v4-flash': [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 2, outputPerMillion: 8 } }],
      'glm-5.3-flash': [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 3, outputPerMillion: 10, cacheReadPerMillion: 1 } }],
    },
  }
  const cards = providerCards(records, pricing, (r) => rateKeyAt(pricing, r.provider, r.model, r.time))
  const deepseek = cards.find(c => c.provider === 'deepseek-official')
  const opencode = cards.find(c => c.provider === 'opencode-go')
  check('两条通道两张卡(不合并),失败不计请求数,按词元降序',
    cards.length === 2 && cards[0]?.provider === 'deepseek-official' && cards[1]?.provider === 'opencode-go'
    && deepseek?.requests === 1 && opencode?.requests === 2 && deepseek?.tokens === 1200 && opencode?.tokens === 1090
    && deepseek?.models.length === 1 && opencode?.models.length === 2 && deepseek?.unpricedModels.length === 0)
  // 按模型切法就是各卡模型行摊平:两种切法同源,同一窗口的两个合计数必然相等。
  const modelRows = modelRowsOf(cards)
  const four = (t: { inputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; outputTokens: number }): number =>
    t.inputTokens + t.cacheReadTokens + t.cacheWriteTokens + t.outputTokens
  check('按模型切法 = 摊平卡片,键与金额逐行保留,合计与卡片那一面相等',
    modelRows.length === 3 && modelRows.some(r => r.provider === 'opencode-go' && r.model === 'glm-5.3-flash' && r.totals.requests === 1)
    && modelRows.reduce((sum, r) => sum + four(r.totals), 0) === cards.reduce((sum, c) => sum + c.tokens, 0))
  const unpriced = providerCards([{ requestId: 'r5', time: dayMillis('2026-03-01', 11), sessionId: 's3', provider: 'mystery', model: 'brand-new-x', usage: { inputTokens: 10, outputTokens: 10 } }], pricing, (r) => rateKeyAt(pricing, r.provider, r.model, r.time))
  check('没定价的模型按 ¥0 计,并在卡上列出来', unpriced[0]?.unpricedModels.join() === 'brand-new-x' && unpriced[0]?.cost === 0 && unpriced[0]?.models[0]?.cost === 0)
}

if (section('窗口 → 日界,以及按窗口读账本')) {
  const now = () => new Date('2026-03-05T15:30:00')
  const windows = JSON.stringify([
    rangeDayWindow('today', now), rangeDayWindow('yesterday', now), rangeDayWindow('last7', now),
    rangeDayWindow('last30', now), rangeDayWindow('all', now),
  ])
  check('窗口按本地日历日算:today / yesterday 各一天,last7 / last30 都含今天,all 不设下界',
    windows === JSON.stringify([
      { fromDay: '2026-03-05', toDay: '2026-03-05' }, { fromDay: '2026-03-04', toDay: '2026-03-04' },
      { fromDay: '2026-02-27', toDay: '2026-03-05' }, { fromDay: '2026-02-04', toDay: '2026-03-05' },
      { fromDay: '', toDay: '2026-03-05' },
    ]), windows)

  const dir = await mkdtemp(join(tmpdir(), 'tokbook-range-'))
  try {
    const log = new UsageLog(dir, quiet)
    const rec = (requestId: string, day: string): UsageRecord => ({
      requestId, time: dayMillis(day, 9), sessionId: 's1', model: 'm', provider: 'p', usage: { inputTokens: 1, outputTokens: 1 },
    })
    for (const [id, day] of [['a1', '2026-03-01'], ['a2', '2026-03-04'], ['a3', '2026-03-05']] as const) await log.record(rec(id, day))
    await log.flush()
    const read = (from: string, to: string) => readRecordsByDayRange(dir, from, to, quiet)
    const within = await read('2026-03-04', '2026-03-05')
    check('只读范围内的日文件:空档与倒序窗口读作空,不崩',
      within.length === 2 && within.every(r => r.requestId !== 'a1')
      && (await read('2026-03-05', '2026-03-05')).length === 1
      && (await read('2026-03-02', '2026-03-03')).length === 0
      && (await read('2026-03-06', '2026-03-05')).length === 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

if (section('额度:窗口归一化')) {
  const now = new Date(2026, 2, 10, 15, 0, 0).getTime()
  const cc = windowFromCreditsBlock('fiveHour', '5 小时', { used: 8.4, cap: 14, exceeded: false, resetAt: now + 3 * 3_600_000 }, now)
  const over = windowFromCreditsBlock('weekly', '本周', { used: 40, cap: 35, exceeded: true, resetAt: now + 86_400_000 }, now)
  const missing = windowFromCreditsBlock('fiveHour', '5 小时', undefined, now)
  check('额度窗口带金额的那一路:占比 = used/cap 并夹在 100,缺块给一行空的 ok',
    Math.abs(cc.usagePercent - 60) < 1e-9 && cc.resetAt === now + 3 * 3_600_000 && cc.exceeded === false
    && over.exceeded === true && over.usagePercent === 100
    && missing.usedUsd === undefined && missing.resetAt === null && missing.exceeded === false)

  const goNow = Date.now()
  const go = windowFromUsagePercent('rolling5h', '5 小时', { status: 'ok', resetInSec: 1500, usagePercent: 25 }, goNow)
  const limited = windowFromUsagePercent('monthly', '本月', { status: 'rate-limited', resetInSec: 100, usagePercent: 60 }, goNow)
  check('额度窗口只带百分比的那一路:resetInSec 折成绝对时刻,非 ok 状态读作已超限',
    go.usagePercent === 25 && go.resetAt === goNow + 1500 * 1000 && go.exceeded === false && go.usedUsd === undefined
    && limited.exceeded === true && limited.usagePercent === 100
    && windowFromUsagePercent('weekly', '本周', undefined, goNow).resetAt === null)

  const epoch = 1_800_000_000_000
  check('重置时刻的启发式:小数字是倒计时秒数,近处的大数字是 epoch ms,ISO 串能解析,垃圾 = null',
    resetEpoch(5000, epoch) === epoch + 5_000_000 && resetEpoch(epoch + 10_000, epoch) === epoch + 10_000
    && typeof resetEpoch('2026-03-11T00:00:00Z', epoch) === 'number'
    && resetEpoch('nonsense', epoch) === null && resetEpoch(undefined, epoch) === null)
  const info = planInfoFromSubscriptions({ planId: 'individual-goat', status: 'active', currentPeriodEnd: epoch })
  check('计划身份:保留 id / 状态 / 周期末,空对象不产出计划',
    info?.planId === 'individual-goat' && info?.status === 'active' && info?.periodEnd === epoch && planInfoFromSubscriptions({}) === undefined)
}

if (section('额度:门只从答复推导,绝不从失败推导')) {
  const now = 1_800_000_000_000
  const gates: [string, string, string][] = [
    ['答复在订阅期内', quotaGate({ status: 'active' }, now), 'subscription'],
    ['试用期同样在期内', quotaGate({ status: 'trialing' }, now), 'subscription'],
    ['状态词带空格大小写照样认', quotaGate({ status: ' Active ' }, now), 'subscription'],
    ['已取消但还没到周期末 → 仍在期内', quotaGate({ status: 'canceled', periodEnd: now + 86_400_000 }, now), 'subscription'],
    ['已取消且过了周期末 → 看余额', quotaGate({ status: 'canceled', periodEnd: now - 1 }, now), 'balance'],
    ['没给状态词但周期末在未来 → 在期内', quotaGate({ periodEnd: now + 1 }, now), 'subscription'],
    ['不认识的状态词一律以是否在期为准', quotaGate({ status: 'some-new-word', periodEnd: now - 1 }, now), 'balance'],
    ['欠费且没有周期末 → 看余额', quotaGate({ status: 'past_due' }, now), 'balance'],
    ['没答复计划身份 → 看余额(出口只有这两个)', quotaGate(undefined, now), 'balance'],
  ]
  check('门函数把答复过的计划身份翻成 subscription / balance,从不产出 none', gates.every(([, a, w]) => a === w), gates.filter(([, a, w]) => a !== w).map(([label]) => label))
  check('余额门的说明带上失效日期或那个不认识的词;没有依据时只说余额',
    (balanceGateNote({ status: 'canceled', periodEnd: Date.parse('2026-10-06T12:00:00') }, Date.parse('2026-10-09T12:00:00')) ?? '').includes('2026-10-06')
    && (balanceGateNote({ status: 'past_due' }, now) ?? '').includes('past_due')
    && (balanceGateNote(undefined, now) ?? '').includes('余额')
    && dayText(new Date(2026, 0, 5).getTime()) === '2026-01-05')

  // 端点没答复:卡上没有门,也就没有一句关于订阅状态的话——绝不对着订阅期的账户说「没订阅」。
  const failed = errorCard('commandcode', '官方接口返回 HTTP 500。')
  check('失败的卡不设门、不谈订阅状态;没配置的卡同理;「没有订阅」是答复出来的状态(门 + 说明一起给)',
    failed.gate === undefined && failed.gateNote === undefined && !(failed.message ?? '').includes('未检测到生效中的订阅')
    && unconfiguredCard('opencode-go').gate === undefined && unconfiguredCard('opencode-go').state === 'unconfigured'
    && hasQuotaContent({ plan: 'x', title: 'x', state: 'ok', windows: [] }) === false
    && noSubscriptionCard('opencode-go', '该 key 有效,但当前没有生效中的 OpenCode Go 订阅。').gate === 'none')

  const alertCases: [string, boolean][] = [
    ['没有卡', isQuotaAlert(null)],
    ['没配置的卡', isQuotaAlert(unconfiguredCard('opencode-go', 'no key'))],
    ['失败的卡', isQuotaAlert(errorCard('opencode-go', 'boom'))],
    ['舒适的窗口', isQuotaAlert(okCard([{ exceeded: false, usagePercent: 40 }]))],
    ['快满的窗口', isQuotaAlert(okCard([{ exceeded: false, usagePercent: 90 }]))],
    ['已超限但占比 0', isQuotaAlert(okCard([{ exceeded: true, usagePercent: 0 }]))],
    ['卡里只要有一个窗口紧就告急', isQuotaAlert(okCard([{ exceeded: false, usagePercent: 10 }, { exceeded: false, usagePercent: 95 }]))],
    ['余额门的卡从不告急(那是旧值,不是此刻的约束)', isQuotaAlert(okCard([{ exceeded: true, usagePercent: 100 }], 'balance'))],
    ['没有订阅的卡从不告急', isQuotaAlert(okCard([{ exceeded: true, usagePercent: 100 }], 'none'))],
  ]
  const expected = [false, false, false, false, true, true, true, false, false]
  check('告急点只看有门约束的 ok 卡里任何一个窗口 ≥ 阈值或已超限',
    alertCases.every(([, a], i) => a === expected[i]), alertCases.filter(([, a], i) => a !== expected[i]).map(([label]) => label))
}

if (section('额度:卡片排序与计划身份')) {
  const gateOf = (p: string): 'subscription' | 'balance' | 'none' | undefined => ({ live: 'subscription', lapsed: 'balance', nosub: 'none' } as const)[p]
  const order = (providers: string[]) => orderQuotaProviders(providers, gateOf).join(',')
  const input = ['lapsed', 'live']
  orderQuotaProviders(input, gateOf)
  check('失效 / 没有订阅的计划沉到后面,但各自组内的原顺序不动(是稳定分区,不是排序);未知门当活跃;不改入参',
    order(['lapsed', 'live']) === 'live,lapsed' && order(['nosub', 'live']) === 'live,nosub'
    && order(['live', 'nosub', 'lapsed']) === 'live,nosub,lapsed' && order(['unknown', 'lapsed']) === 'unknown,lapsed'
    && order(['lapsed', 'nosub']) === 'lapsed,nosub' && order([]) === '' && input.join(',') === 'lapsed,live')
  check('内置计划身份与标题',
    isBuiltinQuotaPlan('opencode-go') && isBuiltinQuotaPlan('commandcode') && isBuiltinQuotaPlan('zen') === false
    && BUILTIN_PLAN_TITLES['opencode-go'] === 'OpenCode Go' && BUILTIN_PLAN_TITLES['commandcode'] === 'Command Code')
}

if (section('额度:key 解析(env + 配置,不打网络)')) {
  const seam = (map: Record<string, string>) => ({ resolve: async (ref: string) => map[ref] })
  const cases: [string, string | undefined, string | undefined][] = [
    ['哪儿都没有 key', await resolvePlanApiKey('opencode-go', undefined, seam({})), undefined],
    ['凭据缝给通道的默认引用名', await resolvePlanApiKey('opencode-go', undefined, seam({ OPENCODE_GO_API_KEY: 'seam-go' })), 'seam-go'],
    ['配置里的字面量优先', await resolvePlanApiKey('opencode-go', { apiKey: 'cfg-key' }, seam({ OPENCODE_GO_API_KEY: 'seam-go' })), 'cfg-key'],
    ['apiKeyEnv 换引用名', await resolvePlanApiKey('commandcode', { apiKeyEnv: 'MY_CC_KEY' }, seam({ MY_CC_KEY: 'custom-key' })), 'custom-key'],
    ['commandcode 自己的默认名', await resolvePlanApiKey('commandcode', undefined, seam({ COMMANDCODE_API_KEY: 'cc-key' })), 'cc-key'],
    ['凭据缝抛错时降级为未配置,不抛', await resolvePlanApiKey('opencode-go', undefined, { resolve: async () => { throw new Error('boom') } }), undefined],
  ]
  check('key 解析:字面量 > 引用名(apiKeyEnv > 通道默认名),缝抛错降级为未配置', cases.every(([, a, w]) => a === w), cases.filter(([, a, w]) => a !== w).map(([label]) => label))
  const noKey = await fetchOpenCodeGoQuota({ credentials: { resolve: async () => undefined } })
  const ccNoKey = await fetchCommandCodeQuota({ credentials: { resolve: async () => undefined } })
  check('没有 key 的通道直接给未配置卡,不试图联网;不认识的通道给错误卡',
    noKey.state === 'unconfigured' && noKey.windows.length === 0 && ccNoKey.state === 'unconfigured'
    && (await fetchOfficialQuota('not-a-provider', {})).state === 'error')
}

if (section('额度:Command Code 的门只从答复的端点读(桩 HTTP)')) {
  const originalFetch = globalThis.fetch
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  const boom = () => new Response('boom', { status: 500 })
  const mock = (opts: { subscriptions: 'active' | 'lapsed' | 'fail'; credits: 'ok' | 'fail' }) => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/alpha/whoami')) return ok({ user: { userName: 'tester' } })
      if (url.includes('/alpha/billing/credits')) {
        if (opts.credits === 'fail') return boom()
        return ok({
          credits: { monthlyCredits: opts.subscriptions === 'active' ? 54.8 : 0, purchasedCredits: 12.4, freeCredits: 3, planId: 'individual-goat' },
          windowLimits: { fiveHour: { used: 1, cap: 14, exceeded: false, resetAt: Date.now() + 3_600_000 } },
        })
      }
      if (url.includes('/alpha/billing/subscriptions')) {
        if (opts.subscriptions === 'fail') return boom()
        return ok({ data: { planId: 'individual-goat', status: opts.subscriptions === 'active' ? 'active' : 'canceled', currentPeriodEnd: Date.now() + (opts.subscriptions === 'active' ? 26 : -6) * 86_400_000 } })
      }
      return ok({ completedCount: 3, totalCost: 5 })
    }) as typeof fetch
  }
  try {
    // 订阅端点 500 = 「不知道」,不是「没订阅」:窗口照旧渲染,一个字的计划断言都不许说。
    mock({ subscriptions: 'fail', credits: 'ok' })
    const unknown = await fetchCommandCodeQuota({ plan: { apiKey: 'k' } })
    check('订阅端点失败 → 不设门、不宣称套餐状态,但保留窗口与计划名',
      unknown.gate === undefined && unknown.gateNote === undefined && unknown.windows.length === 1 && unknown.planInfo?.planId === 'individual-goat')
    // `balance` 门承诺一个余额;余额没取到时不能印 `$0.00`,降级成和 Go 一样的「没什么可画」。
    mock({ subscriptions: 'lapsed', credits: 'fail' })
    const noBalance = await fetchCommandCodeQuota({ plan: { apiKey: 'k' } })
    mock({ subscriptions: 'lapsed', credits: 'ok' })
    const lapsed = await fetchCommandCodeQuota({ plan: { apiKey: 'k' } })
    mock({ subscriptions: 'active', credits: 'ok' })
    const live = await fetchCommandCodeQuota({ plan: { apiKey: 'k' } })
    check('两个端点都答复时按答复设门:失效 → balance 且带余额与日期说明;在期 → subscription 且无说明;余额缺失 → none',
      noBalance.gate === 'none' && noBalance.credits === undefined && (noBalance.gateNote ?? '').includes('未取到余额') && isQuotaAlert(noBalance) === false
      && lapsed.gate === 'balance' && lapsed.credits !== undefined && (lapsed.gateNote ?? '').includes('订阅已于')
      && live.gate === 'subscription' && live.gateNote === undefined)
  } finally {
    globalThis.fetch = originalFetch
  }
}

if (section('额度:OpenCode Go 的权益状态(桩 HTTP)')) {
  const originalFetch = globalThis.fetch
  const respond = (status: number, body: unknown = {}) => {
    globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch
  }
  const key = { resolve: async () => 'test-key' }
  try {
    // 403 = key 有效但没有 Go 订阅:通道答复了,所以是一个状态,不是「查询失败」,也不该重试。
    respond(403, { error: 'no subscription' })
    const noSub = await fetchOpenCodeGoQuota({ credentials: key })
    respond(401, { error: 'invalid-key' })
    const badKey = await fetchOpenCodeGoQuota({ credentials: key })
    check('403(有 key 没订阅)→ ok 卡 + none 门 + 一句理由,不进告急;401(key 本身不对)→ 错误卡',
      noSub.state === 'ok' && noSub.gate === 'none' && noSub.windows.length === 0 && (noSub.gateNote ?? '').length > 0
      && noSub.fetchedAt !== undefined && isQuotaAlert(noSub) === false
      && badKey.state === 'error' && badKey.gate === undefined)

    // 真实形状:usage.rolling / weekly / monthly,percent + resetsAt(ISO)→ 三个窗口按顺序。
    const now = Date.parse('2026-08-14T07:00:00Z')
    const parsed = parseOpenCodeGoUsage({
      usage: {
        rolling: { status: 'ok', percent: 9, resetsAt: '2026-08-14T07:20:04.810Z' },
        weekly: { status: 'ok', percent: 12, resetsAt: '2026-08-17T00:00:00.810Z' },
        monthly: { status: 'ok', percent: 6, resetsAt: '2026-09-09T00:41:03.810Z' },
      },
    } as never, now)
    const limited = parseOpenCodeGoUsage({ usage: { rolling: { status: 'rate-limited', percent: 60, resetsAt: '2026-08-14T07:20:00Z' }, weekly: { status: 'ok', percent: 40, resetsAt: '2026-08-17T00:00:00Z' } } } as never, now)
    check('真实载荷解析成窗口:id 与顺序固定,percent 保留,resetsAt 从 ISO 折成 epoch,非 ok 状态读作已超限',
      parsed.windows.map(w => w.id).join(',') === 'rolling5h,weekly,monthly' && parsed.windows[0]!.usagePercent === 9
      && parsed.windows[0]!.resetAt === Date.parse('2026-08-14T07:20:04.810Z') && parsed.windows[0]!.usedUsd === undefined
      && parsed.state === 'ok' && parsed.plan === 'opencode-go'
      && limited.windows[0]!.exceeded === true && limited.windows[0]!.usagePercent === 100
      && parseOpenCodeGoUsage({ usage: {} } as never, now).windows.length === 0)
  } finally {
    globalThis.fetch = originalFetch
  }
}

if (section('双桶金额:spend vs subscriptionValue')) {
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-dualbucket-'))
  try {
    // 同一个模型串经三条通道:分桶由价格文件的 $billing 决定,什么也没声明的通道按 metered。
    const pricing: PricingTable = {
      'deepseek-official': { 'deepseek-v4-flash': [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 2, outputPerMillion: 8 } }] },
      'opencode-go': { 'deepseek-v4-flash': [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 2, outputPerMillion: 8 } }] },
      commandcode: { 'deepseek/deepseek-v4-flash': [{ from: dayStartMs('2020-01-01')!, rates: { inputPerMillion: 2, outputPerMillion: 8 } }] },
    }
    const billing = { 'opencode-go': 'subscription' as const, commandcode: 'subscription' as const }
    const resolve = (r: UsageRecord) => rateKeyAt(pricing, r.provider, r.model, r.time)
    const t = dayMillis('2026-08-17', 9)
    const recs: UsageRecord[] = [
      { requestId: 'official-1', time: t, sessionId: 's1', provider: 'deepseek-official', model: 'deepseek-v4-flash', usage: { inputTokens: 1_000_000, outputTokens: 0 } },
      { requestId: 'opencode-1', time: t, sessionId: 's2', provider: 'opencode-go', model: 'deepseek-v4-flash', usage: { inputTokens: 1_000_000, outputTokens: 0 } },
      { requestId: 'cc-1', time: t, sessionId: 's3', provider: 'commandcode', model: 'deepseek/deepseek-v4-flash', usage: { inputTokens: 500_000, outputTokens: 0 } },
      { requestId: 'direct-1', time: t, sessionId: 's4', model: 'deepseek-v4-flash', usage: { inputTokens: 500_000, outputTokens: 0 } },
    ]
    const costed = attachCosts({ dataDir: dir, ...summarizeRecords(recs, resolve) }, pricing, billing)
    check('金额分两桶:metered 通道进 spend,subscription 通道进 subscriptionValue;没通道头的行没价可计',
      Math.abs(costed.totalCost - 5) < 1e-9 && Math.abs(costed.spend - 2) < 1e-9 && Math.abs(costed.subscriptionValue - 3) < 1e-9
      && costed.unpricedModels.includes('deepseek-v4-flash'))
    const official = costed.byModel.find(r => r.provider === 'deepseek-official' && r.model === 'deepseek-v4-flash')
    const opencode = costed.byModel.find(r => r.provider === 'opencode-go' && r.model === 'deepseek-v4-flash')
    check('同一模型串不跨通道合并:每行的金额只落一个桶,没价的通道成本为 0',
      costed.byModel.length === 4
      && official !== undefined && Math.abs(official.cost - 2) < 1e-9 && Math.abs(official.spend - 2) < 1e-9 && official.subscriptionValue === 0
      && opencode !== undefined && Math.abs(opencode.cost - 2) < 1e-9 && Math.abs(opencode.subscriptionValue - 2) < 1e-9 && opencode.spend === 0
      && costed.byModel.find(r => r.provider === '')?.cost === 0)
    const daySpend = costed.byDay.reduce((acc, row) => acc + (row.spend ?? 0), 0)
    const dayValue = costed.byDay.reduce((acc, row) => acc + (row.subscriptionValue ?? 0), 0)
    check('逐日金额与总计对得上(同一屏上的两个金额不许各说各话)',
      Math.abs(daySpend - costed.spend) < 1e-9 && Math.abs(dayValue - costed.subscriptionValue) < 1e-9
      && costed.byDay.length === 1 && costed.byDay[0]!.spend === 2 && costed.byDay[0]!.subscriptionValue === 3)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// 过滤后一节都没命中,是这里最坏的一种结果:它一条断言都没跑,却和「全绿」长得一模一样。
if (only !== null && ranSections === 0) {
  console.error(`\nno section matches --only ${JSON.stringify(only)}`)
  process.exit(1)
} else if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
} else {
  console.log(only === null
    ? '\nall smoke checks passed'
    : `\n${ranSections} section(s) passed (--only ${JSON.stringify(only)})`)
}

/** 额度卡的 ok 主体:告急判定只读这些窗口与门。 */
function okCard(windows: { exceeded: boolean; usagePercent: number }[], gate?: 'subscription' | 'balance' | 'none') {
  return {
    plan: 'opencode-go', title: 'OpenCode Go', state: 'ok' as const,
    windows: windows.map((w, i) => ({ id: `w${i}`, label: '窗', resetAt: null, ...w })),
    ...(gate !== undefined ? { gate } : {}),
  }
}

function dayMillis(day: string, hour: number): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!, hour, 0, 0).getTime()
}
