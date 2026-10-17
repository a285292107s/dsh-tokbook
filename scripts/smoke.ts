// 纯逻辑冒烟测试:聚合 / 计价 / 额度。不碰 DSH 运行时,不需要真 host。
//
// 约定:**一条不变量一个断言**——同一条规则不在别处重复;边界用例用表驱动压成一行,
// 表里一行 = 一个用例,不各写一段。需要真数据目录的不变量(折叠重建 / refile / 跨实例
// 去重 / 重启基线)在 `selfcheck-rebuild.ts`,这里不重测。
//
// Run: node --experimental-strip-types scripts/smoke.ts
//      加 `--only <节名子串>` 只跑命中的那几节(改一处计价规则不必读完整套输出)。
import { mkdir, mkdtemp, rename, rm, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import {
  summarizeRecords, mergeSummaries, attachCosts, buildSummary, isLedgerStale, staleSessionIds,
  readRecordsByDayRange, rangeDayWindow, readRollup, rollupIsCurrent, ROLLUP_SCHEMA_VERSION, type RollupFile,
} from '../src/stats.ts'
import { aggregateWindow, pathKey } from '../src/window-usage.ts'
import {
  billingOf, cnyTable, coercePriceFile, costOf, dayKeyOf, dayStartMs,
  entryAt, parsePriceInput, priceOfKey, PRICING_BILLING_KEY, PRICING_CALENDAR_KEY, PRICING_CURRENCY_KEY,
  PRICING_FILE, PRICING_FX_KEY,
  rateKeyAt, ratesAt,
  readPriceFile, slotAt, writePriceFile, type PricingTable,
} from '../src/pricing.ts'
import { ledgerUsageOf, readPricingView } from '../src/pricing-view.ts'
import { normalizeModelId, parseCatalog, searchCatalog } from '../src/models-dev.ts'
import { mergeCatalogIntoTable } from '../src/pricing-sync.ts'
import { readPricingSyncState, writePricingSyncState } from '../src/pricing-sync-state.ts'
import {
  baselinesOf, calendarYearTally, composePriceBody, defaultCalendarYear, draftFromView, duplicateSlot,
  fxSignature, fxValue, inheritedCell, isBlankSlot, isUnpriced, modelDirty,
  newHoliday, newSlot, priceIssue, priceUnknown,
  ratesInForce, readHolidays, slotRange, stagedChanges, withCalendar, withFx, withRouteCurrency,
  withSlotEnd, withSlotStart,
  type CalendarEntries, type CalendarHolidayDraft, type ModelDraft, type PriceState,
} from '../src/client/pricing/draft.ts'
import {
  convertText, counterpartOf, parseAmount, unitOf,
  type MoneyView,
} from '../src/client/pricing/currency.ts'
import { MAX_MODEL_LENGTH, MAX_ROUTE_LENGTH, dayIndex, dayKeyOfIndex, holidaySet, slotsOverlap } from '../src/price-format.ts'
import { collectRoutes, DEEPSEEK_ROUTE, routesFromSettings } from '../src/route-catalog.ts'
import { parseRecord, serializeRecord, coerceRecord, recordOfEvent, recordFromRetry, type SessionEventLike } from '../src/usage-record.ts'
import { dayFileNameOf, UsageLog } from '../src/usage-log.ts'
import { syncHistory, listPersistenceSnapshots } from '../src/sync.ts'

import {
  windowFromCreditsBlock, windowFromUsagePercent, resetEpoch, planInfoFromSubscriptions,
  unconfiguredCard, errorCard, noSubscriptionCard, hasQuotaContent, isBuiltinQuotaPlan,
  isQuotaAlert, orderQuotaProviders, quotaGate, balanceGateNote, dayText, BUILTIN_PLAN_TITLES,
} from '../src/quota.ts'
import {
  resolvePlanApiKey, fetchOfficialQuota, fetchOpenCodeGoQuota, fetchCommandCodeQuota, parseOpenCodeGoUsage,
} from '../src/quota-official.ts'
import type { BillingNature, PricingEntryInput, PricingTable, PricingView, UsageRecord } from '../src/types.ts'
import { settleTiming, totalsTokens, UNPRICED_KEY } from '../src/types.ts'
import { buildSessionUsageView, joinOfEvents, type SessionJoin } from '../src/session-usage.ts'

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

// 节过滤。跑全套是**提交门**,不是编辑循环的门:改一条取价规则却要读完整套输出,
// 那点输出就是白花的 token。`--only` 只筛节,不改任何断言。
const only = ((): string | null => {
  const flag = process.argv.indexOf('--only')
  if (flag === -1) return null
  const value = process.argv[flag + 1]
  // 缺值时空串会让 `name.includes('')` 恒真、静默跑全套——那与「只跑这一节」相反,直接报错。
  if (value === undefined || value === '') {
    console.error('--only 需要一个节名子串:node scripts/smoke.ts --only <节名子串>')
    process.exit(1)
  }
  return value
})()

let ranSections = 0
/** 打印节名,并回答这一节该不该跑。 */
function section(name: string): boolean {
  if (only !== null && !name.includes(only)) return false
  ranSections += 1
  console.log(name)
  return true
}

// 「价格表草稿 / 没有价的行 / 价格表写路径」三节说的是同一件事:一条路由、一个模型、一份价。
// 形状只在这里写一遍——三份副本不会各自报错,只会各自**漂**,而漂掉的那一份是静默的。
const modelRow = (price: Partial<ModelDraft> = {}): ModelDraft =>
  ({ model: 'm', configured: true, records: 0, input: '', output: '', cacheRead: '', cacheWrite: '', slots: [], ...price })

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

if (section('手写价表:取价 / 费率身份 / 容错')) {
  const file = parsePriceInput({
    [PRICING_BILLING_KEY]: { 'opencode-go': 'subscription' },
    [PRICING_FX_KEY]: { cnyPerUsd: 7.15 },
    'deepseek-official': {
      'deepseek-v4-flash': { inputPerMillion: 1.5, outputPerMillion: 4.5, cacheReadPerMillion: 0.15 },
    },
  })
  check('日期轴只剩年历:本地日历日往返一致,不存在 / 非法的日期不是日期',
    file.ok && dayKeyOf(dayStartMs('2026-09-01')!) === '2026-09-01' && dayStartMs('2026-02-31') === null && dayStartMs('2026/09/01') === null)
  if (!file.ok) throw new Error(`well-formed body rejected: ${file.error}`)
  const table = file.file.table

  const before = dayMillis('2026-08-15', 9)
  const after = dayMillis('2026-09-15', 9)
  check('取价与记录时刻无关:一份价覆盖全部历史;这个组合没有价 → null(价格未知)',
    ratesAt(table, 'deepseek-official', 'deepseek-v4-flash', before)?.inputPerMillion === 1.5
    && ratesAt(table, 'deepseek-official', 'deepseek-v4-flash', after)?.outputPerMillion === 4.5
    && ratesAt(table, 'deepseek-official', 'deepseek-v4-flash', dayMillis('2015-07-15', 9))?.inputPerMillion === 1.5
    && ratesAt(table, 'deepseek-official', 'never-priced', before) === null)
  check('$billing 是通道路由属性(省略 = metered)',
    billingOf(file.file.billing, 'opencode-go') === 'subscription'
    && billingOf(file.file.billing, 'deepseek-official') === 'metered' && billingOf(file.file.billing, undefined) === 'metered')
  check('费率行身份 = 那一刻生效的时段身份(null = 基准价);没价 = 显式哨兵',
    rateKeyAt(table, 'deepseek-official', 'deepseek-v4-flash', after)?.unpriced === undefined
    && rateKeyAt(table, 'deepseek-official', 'deepseek-v4-flash', after)?.slot === null
    && rateKeyAt(table, 'deepseek-official', 'never-priced', after).unpriced === true)
  // 汇率是价文件里第三个保留键，但它与计价无关：解析出来只是给价格表的读写面用。
  const noFx = parsePriceInput({ r: {} })
  check('$fx 是保留键、只服务读写面:解析得出汇率,省略 = 未设汇率',
    file.file.fx?.cnyPerUsd === 7.15 && noFx.ok && noFx.file.fx === undefined)

  // 金额只存身份、读取时回查当前表 → 一次改价重算全部历史(不改账本行)。
  const edited: PricingTable = {
    'deepseek-official': { 'deepseek-v4-flash': { rates: { inputPerMillion: 1.2, outputPerMillion: 3.6 } } },
  }
  check('同一身份回查当前表:改费率就地重算,身份落空 → 价格未知',
    priceOfKey(edited, 'deepseek-official', 'deepseek-v4-flash', { slot: null })?.inputPerMillion === 1.2
    && priceOfKey(edited, 'deepseek-official', 'deepseek-v4-flash', { slot: { start: 9, days: 'daily' } }) === null
    && priceOfKey(edited, 'deepseek-official', 'never-priced', UNPRICED_KEY) === null)
  check('costOf:四档各自乘费率,cacheRead/Write 缺价时回落到输入价',
    Math.abs(costOf({ requests: 1, inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 200_000, cacheWriteTokens: 100_000, compactions: 0, failures: 0 },
      { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5, cacheWritePerMillion: 1 }) - 6.2) < 1e-9
    && costOf({ requests: 1, inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0, compactions: 0, failures: 0 }, { inputPerMillion: 3, outputPerMillion: 9 }) === 3)

  // 写路径拒绝它读不懂的表(每类一条代表);读路径反过来:畸形只掉受影响的那一格。
  const refuses: [string, unknown, string][] = [
    ['价里的未知字段(旧文件的 from)', { r: { m: { inputPerMillion: 1, outputPerMillion: 2, from: '2026-09-01' } } }, '未知字段'],
    ['旧的价段数组形态(写路径只接受一份现价)', { r: { m: [{ inputPerMillion: 1, outputPerMillion: 2 }] } }, '必须是对象'],
    ['两个都会生效的时段', { r: { m: { inputPerMillion: 1, outputPerMillion: 2, slots: [{ days: 'daily', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 }, { days: 'weekdays', start: 11, end: 13, inputPerMillion: 2, outputPerMillion: 4 }] } } }, '重叠'],
    ['未知的星期几', { r: { m: { inputPerMillion: 1, outputPerMillion: 2, slots: [{ days: 'mondays', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 }] } } }, 'days'],
    ['$fx 不是对象', { [PRICING_FX_KEY]: 7.15, r: {} }, PRICING_FX_KEY],
    ['$fx 的 cnyPerUsd 不是数', { [PRICING_FX_KEY]: { cnyPerUsd: '7.15' }, r: {} }, 'cnyPerUsd'],
    ['$fx 为 0(换算会除零)', { [PRICING_FX_KEY]: { cnyPerUsd: 0 }, r: {} }, '大于 0'],
  ]
  const accepted = refuses.filter(([, body, expected]) => {
    const out = parsePriceInput(body)
    return out.ok || !out.error.includes(expected)
  })
  check('写路径拒绝它读不懂的价格表(每类一条代表)', accepted.length === 0, accepted.map(([label]) => label))
  const lenient = coercePriceFile({ r: {
    good: { inputPerMillion: 1, outputPerMillion: 2 },
    bad: { inputPerMillion: 'x' },
  } }, quiet)
  check('读路径宽容:畸形的 (路由, 模型) 只降级它自己,整份文件仍读得出',
    lenient.table.r?.good?.rates.inputPerMillion === 1 && lenient.table.r?.bad === undefined
    && Object.keys(coercePriceFile('nope', quiet).table).length === 0)
  // 旧文件的价段数组仍读得进来:取生效时刻最晚的那一段——它就是今天仍在生效的价,更早的段
  // 不再参与计价。日期串定宽且逐位可比,所以字典序就是时间序;缺 from 的兜底段排最前。
  const legacy = coercePriceFile({ r: { m: [
    { from: '2026-08-01', inputPerMillion: 5, outputPerMillion: 20 },
    { inputPerMillion: 4, outputPerMillion: 16 },
    { from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 4, cacheReadPerMillion: 0.02 },
  ] } }, quiet).table.r?.m
  check('旧价段数组读作「最后一段」(缺 from 的兜底段排最前)',
    legacy?.rates.inputPerMillion === 1 && legacy.rates.cacheReadPerMillion === 0.02)
  // 手写坏了的汇率同样只掉它自己：它不是价,一个数写错不该让整张价表读不出来。
  const lenientFx = coercePriceFile({ [PRICING_FX_KEY]: { cnyPerUsd: -1 }, r: { m: { inputPerMillion: 1, outputPerMillion: 2 } } }, quiet)
  check('读路径宽容:畸形的 $fx 只掉它自己(读作未设汇率),价照读',
    lenientFx.fx === undefined && lenientFx.table.r?.m?.rates.inputPerMillion === 1)
  // 但「一段读不懂」不能只丢掉那一段:我们无从知道坏的哪一段是不是最晚的那一段
  // (它的 from 也读不出来),所以整个 (路由, 模型) 降级为价格未知,并留 error 日志。
  const brokenLogs: string[] = []
  const broken = coercePriceFile({ r: {
    good: [{ from: '2026-01-01', inputPerMillion: 1, outputPerMillion: 4 }, { from: 'nope', inputPerMillion: 9, outputPerMillion: 9 }],
    ok: { inputPerMillion: 3, outputPerMillion: 6 },
  } }, { error: (...args: unknown[]) => brokenLogs.push(args.map(String).join(' ')) })
  check('旧数组里任何一段读不懂 → 整个 (路由, 模型) 读作价格未知,绝不猜哪一段是最新的',
    broken.table.r?.good === undefined && ratesAt(broken.table, 'r', 'good', dayMillis('2027-05-01', 9)) === null)
  check('畸形的同一条不影响别的 (路由, 模型),且日报出路由与模型',
    ratesAt(broken.table, 'r', 'ok', dayMillis('2027-05-01', 9))?.inputPerMillion === 3
    && brokenLogs.length === 1 && brokenLogs[0]!.includes('「r」') && brokenLogs[0]!.includes('「good」'))

  const dir = await mkdtemp(join(tmpdir(), 'tokbook-price-'))
  try {
    await writePriceFile(dir, file.file, quiet)
    const back = await readPriceFile(dir, quiet)
    const text = await readFile(join(dir, PRICING_FILE), 'utf8')
    check('价格文件是能手改的 JSON,读写往返不丢(含可选 cache 档、$billing 与 $fx),且不再写出生效时刻',
      text.includes('"$billing"') && text.includes('"$fx"') && !text.includes('"from"')
      && back.table['deepseek-official']?.['deepseek-v4-flash']?.rates.inputPerMillion === 1.5
      && billingOf(back.billing, 'opencode-go') === 'subscription'
      && back.table['deepseek-official']?.['deepseek-v4-flash']?.rates.cacheReadPerMillion === 0.15
      && back.fx?.cnyPerUsd === 7.15)

    // 价格表 tab 的卡片 = 路由目录 ∪ 账本 ∪ 价格文件。
    const view = await readPricingView(
      dir,
      [
        { route: 'deepseek-official', label: 'DeepSeek', models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' }, { id: 'deepseek-v4-pro' }] },
        { route: 'opencode-go', label: 'OpenCode Go', models: [] },
      ],
      {
        byRouteModel: new Map([['opencode-go', new Map([['mimo-v2.5', { records: 83, firstAt: Date.UTC(2026, 7, 17), unpriced: 11 }]])]]),
        byRoute: new Map([['opencode-go', 83]]),
      },
      quiet,
    )
    const onlyRow = view.routes.find(c => c.route === 'opencode-go')?.models.find(m => m.model === 'mimo-v2.5')
    check('卡片:用过的路由排前面,没配置的模型也成行并带上账本事实',
      view.routes.length === 2 && view.routes[0]?.route === 'opencode-go'
      && onlyRow?.configured === false && onlyRow.records === 83 && onlyRow.name === undefined && onlyRow.unpriced === 11)
    const flash = view.routes.find(c => c.route === 'deepseek-official')?.models.find(m => m.model === 'deepseek-v4-flash')
    const pro = view.routes.find(c => c.route === 'deepseek-official')?.models.find(m => m.model === 'deepseek-v4-pro')
    check('卡片:配置过的模型标 configured 并带上名字,价整份交出去(此刻价由 client 现算);没价的没有价',
      flash?.configured === true && flash.name === 'DeepSeek V4 Flash'
      && flash.price?.inputPerMillion === 1.5 && flash.price?.cacheReadPerMillion === 0.15
      && pro?.name === undefined && pro.price === undefined)
    check('价格文件里留着一条已被配置删掉的路由(卡片是并集,不是目录)',
      (await readPricingView(dir, [], { byRouteModel: new Map(), byRoute: new Map() }, quiet)).routes.some(c => c.route === 'deepseek-official'))

    // 旧文件的价段数组在视图层就收敛成一份现价:取生效时刻最晚的那一段(今天仍在生效的价),
    // 更早的段不再参与计价。视图与写入形态从此只剩一份价,文件要等下一次保存才变。
    await writeFile(join(dir, PRICING_FILE), JSON.stringify({
      'deepseek-official': { 'deepseek-v4-flash': [
        { inputPerMillion: 5, outputPerMillion: 20 },
        { from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 4 },
      ] },
    }), 'utf8')
    const legacyView = await readPricingView(dir, [], {
      byRouteModel: new Map([['deepseek-official', new Map([['deepseek-v4-flash', {
        records: 3, firstAt: dayMillis('2026-08-15', 19), unpriced: 0,
      }]])]]),
      byRoute: new Map([['deepseek-official', 3]]),
    }, quiet)
    const legacyRow = legacyView.routes.find(c => c.route === 'deepseek-official')?.models.find(m => m.model === 'deepseek-v4-flash')
    const legacySave = legacyRow?.price === undefined ? null : parsePriceInput({ 'deepseek-official': { 'deepseek-v4-flash': legacyRow.price } })
    check('旧价段数组在视图层收敛成「最后一段」:wire 上不再有任何生效时刻,写回去存得进',
      legacyRow?.price?.inputPerMillion === 1
      && legacySave !== null && legacySave.ok
      && ratesAt(legacySave.file.table, 'deepseek-official', 'deepseek-v4-flash', dayMillis('2026-01-01', 9))?.inputPerMillion === 1,
      legacySave !== null && !legacySave.ok ? legacySave.error : undefined)

    // 只出现在 $billing / $currency 里的路由也要有卡片:保存是整表重写、以卡片为真源,
    // 没有卡片的那两条键会在下一次自动保存时静默消失(「磁盘 ≡ 草稿」对手写文件也成立)。
    await writeFile(join(dir, PRICING_FILE), JSON.stringify({
      [PRICING_BILLING_KEY]: { 'ghost-route': 'subscription' },
      [PRICING_CURRENCY_KEY]: { 'usd-ghost': 'USD' },
      [PRICING_FX_KEY]: { cnyPerUsd: 7 },
    }), 'utf8')
    const ghosts = await readPricingView(dir, [], { byRouteModel: new Map(), byRoute: new Map() }, quiet)
    const ghostCard = ghosts.routes.find(c => c.route === 'ghost-route')
    const usdCard = ghosts.routes.find(c => c.route === 'usd-ghost')
    check('孤儿 $billing / $currency 路由进卡片(空行,带各自的键值)',
      ghostCard?.billing === 'subscription' && ghostCard.models.length === 0
      && usdCard?.currency === 'USD' && usdCard.models.length === 0)
    const ghostBody = composePriceBody(draftFromView(ghosts))
    const ghostBack = ghostBody.ok ? parsePriceInput(ghostBody.body) : null
    check('这样的卡片过一遍草稿写回后键还在(草稿产出 ⊇ 手写事实)',
      ghostBack !== null && ghostBack.ok
      && ghostBack.file.billing['ghost-route'] === 'subscription' && ghostBack.file.currency['usd-ghost'] === 'USD',
      ghostBody.ok ? undefined : ghostBody.error)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

if (section('日历日轴与价文件读入:UTC 日号互逆、BOM 不是畸形')) {
  // 日号与日键必须互逆;轴定在 UTC 日,所以这条对任何时区都成立——本地零点除以一天只在
  // UTC 以东恰好落对日号,UTC 以西(如 America/Los_Angeles)会让整份年历错一天。
  const days = ['1969-12-31', '1970-01-01', '1970-01-02', '2000-02-29', '2026-02-15', '2026-12-31', '2100-01-01']
  const drifted = days.filter(day => dayKeyOfIndex(dayIndex(day)!) !== day)
  check('日号与日键互逆(含 1970 前后、闰年与世纪年)', drifted.length === 0, drifted)
  check('epoch 日号 0 是 1970-01-01(轴是一个具体的 UTC 日,不是「本地零点的时刻」)', dayKeyOfIndex(0) === '1970-01-01')

  // 手写工具链会给 UTF-8 加 BOM(PowerShell 5.1 的 Set-Content -Encoding utf8、编辑器的
  // 「UTF-8 with BOM」):那一个字符不该把整张价表读成空表。
  const bomDir = await mkdtemp(join(tmpdir(), 'tokbook-bom-'))
  try {
    const body = JSON.stringify({ r: { m: { inputPerMillion: 1, outputPerMillion: 2 } } })
    await writeFile(join(bomDir, PRICING_FILE), body, 'utf8')
    const plain = await readPriceFile(bomDir, quiet)
    await writeFile(join(bomDir, PRICING_FILE), `\uFEFF${body}`, 'utf8')
    const withBom = await readPriceFile(bomDir, quiet)
    check('带 BOM 的 pricing.json 读成与不带时相同的价表(不是空表)',
      withBom.table.r?.m?.rates.inputPerMillion === 1 && JSON.stringify(withBom.table) === JSON.stringify(plain.table))
  } finally {
    await rm(bomDir, { recursive: true, force: true })
  }

  // 价文件缺失 = writePriceFile 的两步 rename(先挪成 .bak、再落新文件)之间崩了。
  // 主文件**确实不存在**(ENOENT)而 .bak 在时从备份恢复——否则界面显示「全部价格未知」,
  // 用户随手改一格就把空表整表写回,历史价全丢。只有 ENOENT 才算「文件没了」。
  const bakDir = await mkdtemp(join(tmpdir(), 'tokbook-bak-'))
  try {
    const body = JSON.stringify({ r: { m: { inputPerMillion: 1, outputPerMillion: 4 } } })
    await writeFile(join(bakDir, PRICING_FILE), body, 'utf8')
    await rename(join(bakDir, PRICING_FILE), join(bakDir, `${PRICING_FILE}.bak`))
    const warns: string[] = []
    const bakLog = { error: () => {}, warn: (...args: unknown[]) => warns.push(args.map(String).join(' ')) }
    const recovered = await readPriceFile(bakDir, bakLog)
    check('主文件不存在而备份在:从 .bak 恢复整张价表(不是空表),并留一条 warn 说明是恢复来的',
      recovered.table.r?.m?.rates.inputPerMillion === 1 && recovered.revision !== ''
      && warns.length === 1 && warns[0]!.includes(`${PRICING_FILE}.bak`))
    await writeFile(join(bakDir, PRICING_FILE), '{ 坏 JSON', 'utf8')
    const brokenJson = await readPriceFile(bakDir, quiet)
    check('主文件在但 JSON 坏了:按既有语义读空表,不回退备份(文件在,内容坏)',
      brokenJson.table.r === undefined && brokenJson.revision !== '')
    // 主文件名在磁盘上做成目录:stat 成功、readFile 报 EISDIR——这是「存在但读不到」,
    // 不是「不存在」,绝不拿备份盖一份还在的文件。
    await rm(join(bakDir, PRICING_FILE), { force: true })
    await mkdir(join(bakDir, PRICING_FILE))
    const unreadable = await readPriceFile(bakDir, quiet)
    check('主文件存在却读不到时不走备份回退:只有 ENOENT 才算「文件没了」',
      unreadable.table.r === undefined && unreadable.revision === '')
  } finally {
    await rm(bakDir, { recursive: true, force: true })
  }
}

if (section('账本透镜:价格表说这一行值多少')) {
  const table: PricingTable = {
    'deepseek-official': { 'deepseek-v4-flash': { rates: { inputPerMillion: 1, outputPerMillion: 4 } } },
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
  check('透镜只数被计价的调用(失败行与没归属的行不算);有价的行一条都不算价格未知',
    row?.records === 3 && row.firstAt === dayMillis('2026-08-15', 12) && row.unpriced === 0
    && lens.byRoute.get('deepseek-official') === 3)
  const noPrice = ledgerUsageOf([billed('f', '2026-08-15')], {})
  check('表里没有这一条 (路由, 模型) → 它的记录全算价格未知(读数与计价同一条判据)',
    noPrice.byRouteModel.get('deepseek-official')?.get('deepseek-v4-flash')?.unpriced === 1)
}

if (section('峰谷时段:基准价之上的第二层取价')) {
  // 2026-09-14 是周一,2026-09-20 是周日。
  const parsed = parsePriceInput({
    'deepseek-official': { 'deepseek-v4-flash': {
      inputPerMillion: 1, outputPerMillion: 4, cacheReadPerMillion: 0.02,
      slots: [
        { days: 'weekdays', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.04 },
        { days: 'weekdays', start: 14, end: 18, inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.04 },
        { days: 'weekends', start: 0, end: 24, inputPerMillion: 1.5, outputPerMillion: 6 },
      ],
    } },
  })
  if (!parsed.ok) throw new Error(`slot body rejected: ${parsed.error}`)
  const table = parsed.file.table
  const route = 'deepseek-official'
  const model = 'deepseek-v4-flash'
  const mondayPeak = dayMillis('2026-09-14', 10)
  const mondayTrough = dayMillis('2026-09-14', 20)
  const sunday = dayMillis('2026-09-20', 10)

  check('按记录本地星期几 + 小时取时段,end 不含,空隙走基准价,时段没写的档继承',
    ratesAt(table, route, model, mondayPeak)?.inputPerMillion === 2
    && ratesAt(table, route, model, dayMillis('2026-09-14', 12))?.inputPerMillion === 1
    && ratesAt(table, route, model, mondayTrough)?.inputPerMillion === 1
    && ratesAt(table, route, model, sunday)?.inputPerMillion === 1.5
    && ratesAt(table, route, model, sunday)?.cacheReadPerMillion === 0.02
    // 同一条价的时段轴与记录时刻无关:换一年同一天同小时仍按同一时段
    && ratesAt(table, route, model, dayMillis('2027-09-13', 10))?.inputPerMillion === 2)

  const slotRefuses: [string, boolean][] = [
    ['会重叠的一组时段被拒', parsePriceInput({ r: { m: { inputPerMillion: 1, outputPerMillion: 2, slots: [{ days: 'daily', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 }, { days: 'weekdays', start: 11, end: 13, inputPerMillion: 2, outputPerMillion: 4 }] } } }).ok === false],
    ['倒序的小时被拒', parsePriceInput({ r: { m: { inputPerMillion: 1, outputPerMillion: 2, slots: [{ days: 'daily', start: 18, end: 9, inputPerMillion: 2, outputPerMillion: 4 }] } } }).ok === false],
    ['星期几分家的两组可以共用同一段小时', parsePriceInput({ r: { m: { inputPerMillion: 1, outputPerMillion: 2, slots: [{ days: 'weekdays', start: 9, end: 18, inputPerMillion: 2, outputPerMillion: 4 }, { days: 'weekends', start: 9, end: 18, inputPerMillion: 2, outputPerMillion: 4 }] } } }).ok === true],
    ['不写 days 读作每天', parsePriceInput({ r: { m: { inputPerMillion: 1, outputPerMillion: 2, slots: [{ start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 }] } } }).file?.table.r?.m?.slots?.[0]?.days === 'daily'],
  ]
  check('时段的写路径:该拒的拒、可共存的放行、缺省写全', slotRefuses.every(([, ok]) => ok), slotRefuses.filter(([, ok]) => !ok).map(([label]) => label))
  const kept = coercePriceFile({ r: { m: {
    inputPerMillion: 1, outputPerMillion: 2,
    slots: [
      { days: 'weekdays', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 },
      { days: 'mondays', start: 18, end: 20, inputPerMillion: 9, outputPerMillion: 9 },
      { days: 'weekdays', start: 11, end: 13, inputPerMillion: 9, outputPerMillion: 9 },
    ],
  } } }, quiet).table.r?.m?.slots ?? []
  check('时段的读路径:丢掉读不懂的与会撞车的,先写的那个赢', kept.length === 1 && kept[0]!.start === 9 && kept[0]!.end === 12)

  const slotDir = await mkdtemp(join(tmpdir(), 'tokbook-slot-'))
  try {
    await writePriceFile(slotDir, parsed.file, quiet)
    const text = await readFile(join(slotDir, PRICING_FILE), 'utf8')
    const back = await readPriceFile(slotDir, quiet)
    check('时段写进文件后读回来仍按同样的价计费',
      text.includes('"weekdays"') && !text.includes('"from"')
      && back.table[route]?.[model]?.slots?.length === 3
      && ratesAt(back.table, route, model, mondayPeak)?.inputPerMillion === 2)
  } finally {
    await rm(slotDir, { recursive: true, force: true })
  }

  // 按这一条价的时段计出来的金额走的是时段价,不是基准价。
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
    r: { m: {
      inputPerMillion: 1, outputPerMillion: 2,
      slots: [
        { days: 'workdays', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 4 },
        { days: 'weekdays', start: 14, end: 18, inputPerMillion: 3, outputPerMillion: 6 },
      ],
    } },
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

    // 手写的跨年区间:写路径拒它,client 又把写规则用在读结果上——读路径放行一个跨年区间,
    // 就等于让整份价文件存不进去(任何价格改动都被整表 PUT 拒掉),并让节假日集合为空,
    // `workdays` 在节假日当天照高峰算(显示价 ≠ 计费价)。所以读路径把它夹回自己的年。
    await writeFile(join(calDir, PRICING_FILE), JSON.stringify({
      [PRICING_CALENDAR_KEY]: {
        2026: [{ start: '2025-12-31', end: '2026-01-02' }],
        2027: [{ start: '2026-01-01', end: '2026-01-02' }], // 整段都不在它标称的 2027 里
      },
      r: { m: { inputPerMillion: 1, outputPerMillion: 4 } },
    }), 'utf8')
    const clampLogs: string[] = []
    const clampLog = { error: () => {}, warn: (...args: unknown[]) => clampLogs.push(args.map(String).join(' ')) }
    const clampedView = await readPricingView(calDir, [], { byRouteModel: new Map(), byRoute: new Map() }, clampLog)
    const clampHolidays = holidaySet(clampedView.calendar)
    check('跨年 $calendar 读回后夹到它自己的年:放假日 = 区间 ∩ 2026,2025-12-31 不进来,区间都在年内',
      JSON.stringify(clampedView.calendar['2026']) === JSON.stringify([{ start: '2026-01-01', end: '2026-01-02' }])
      && [...clampHolidays].sort().join() === '2026-01-01,2026-01-02'
      && (clampedView.calendar['2026'] ?? []).every(range => range.start.slice(0, 4) === '2026' && range.end.slice(0, 4) === '2026')
      && clampLogs.some(text => text.includes('夹')))
    check('整段都不在它标称的年份里的区间被丢掉(不静默:留一条 warn)',
      clampedView.calendar['2027'] === undefined && clampLogs.some(text => text.includes('2027') && text.includes('丢掉')))
    const clampBody = composePriceBody(draftFromView(clampedView))
    check('夹取后的年历过一遍草稿写回整表:不再被「跨年」拒掉(价格改动存得进去)',
      clampBody.ok && parsePriceInput(clampBody.body).ok,
      clampBody.ok ? undefined : clampBody.error)
  } finally {
    await rm(calDir, { recursive: true, force: true })
  }

  // 草稿侧同一条规则:年历改一段假期,行内「此刻的价」当场跟着走;草稿产出的
  // 年历也必须被宿主接受(client ⊆ host)。
  const draft = draftOfRow(modelRow({
    input: '1', output: '2', slots: [newSlot({ days: 'workdays', start: '9', end: '12', input: '2' })],
  }))
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


if (section('费率身份:改时段就地重算;悬空身份只在成本层现形')) {
  const route = 'deepseek-official'
  const model = 'deepseek-v4-flash'
  const inside = dayMillis('2026-09-14', 10)   // 周一 10:00,落在 09:00–12:00 工作时段里
  const slot = (start: number, inputPerMillion: number, days: 'daily' | 'weekdays' = 'weekdays') => ({
    days, start, end: 12, rates: { inputPerMillion, outputPerMillion: inputPerMillion * 4 },
  })
  const table = (slots: ReturnType<typeof slot>[]): PricingTable => ({
    [route]: { [model]: { rates: { inputPerMillion: 1, outputPerMillion: 4 }, ...(slots.length > 0 ? { slots } : {}) } },
  })

  const key = rateKeyAt(table([slot(9, 2)]), route, model, inside)
  const entry = entryAt(table([slot(9, 2)]), route, model)
  check('身份 = 那一刻生效的时段(start + days);基准价那一档的身份是 null',
    entry !== null && slotAt(entry, inside)?.start === 9
    && key.slot?.start === 9 && key.slot.days === 'weekdays'
    && rateKeyAt(table([]), route, model, inside)?.slot === null)
  check('改费率 → 身份不变、就地按新价重算;改 start / 改 days / 删时段 → 那一刻另有一个身份在生效,旧身份回查不到',
    JSON.stringify(rateKeyAt(table([slot(9, 3)]), route, model, inside)) === JSON.stringify(key)
    && priceOfKey(table([slot(9, 3)]), route, model, key)?.inputPerMillion === 3
    && rateKeyAt(table([slot(8, 2)]), route, model, inside)?.slot?.start === 8 && priceOfKey(table([slot(8, 2)]), route, model, key) === null
    && priceOfKey(table([slot(9, 2, 'daily')]), route, model, key) === null
    && ratesAt(table([]), route, model, inside)?.inputPerMillion === 1 && priceOfKey(table([]), route, model, key) === null)

  // 回查落空要在**成本层**现形:身份取自旧表(start 9),计价用改过时段的新表(start 8)——
  // 那条历史按 ¥0 计并列进 unpricedModels。生产里折叠与计价读同一张表,所以这条路径只为
  // 「按美元报价却没设汇率」的通道现形(`cnyTable` 整条丢掉,见「价格表币种」一节);
  // 改了时段之后仍是就地重算:旧的费率行随签名作废重建,由新表按记录时刻重新解身份。
  const records: UsageRecord[] = [{ requestId: 'peak-1', time: inside, sessionId: 's1', provider: route, model, usage: { inputTokens: 1_000_000, outputTokens: 0 } }]
  const resolve = (record: UsageRecord) => rateKeyAt(table([slot(9, 2)]), record.provider, record.model, record.time)
  const orphaned = attachCosts({ ...summarizeRecords(records, resolve), dataDir: 'x' }, table([slot(8, 2)]))
  check('悬空身份的历史读作价格未知(¥0)并列进 unpricedModels',
    orphaned.totalCost === 0 && orphaned.unpricedModels.includes(model))
}

if (section('价格表草稿:没写完的不算、不脏、不写')) {
  check('空白价是草稿:不报错、不脏、不写进请求体,行读作价格未知',
    isUnpriced(modelRow()) === true && priceIssue(modelRow()) === null
    && JSON.stringify(bodyOfRow(modelRow())) === JSON.stringify({ ok: true, body: {} }))

  const view: PricingView = {
    routes: [{ route: 'r', label: 'r', billing: 'metered', records: 0, models: [
      { model: 'm', configured: true, records: 0, price: { inputPerMillion: 1, outputPerMillion: 4 } },
    ] }],
    calendar: {}, calendarMissing: [], dataDir: 'x', updatedAt: 0,
  }
  const baseline = baselinesOf(view)
  const seeded = draftFromView(view).routes.get('r')!.models.get('m')!
  check('刚种下的行是干净的,视图里的价照进四格',
    seeded.input === '1' && seeded.output === '4' && modelDirty('r', seeded, baseline.models) === false)

  const price = { input: '1', output: '4', cacheRead: '0.02' } as const
  const partial = newSlot({ start: '9', end: '12', input: '2' })
  const partialBody = bodyOfRow({ ...modelRow(price), slots: [partial] })
  const written = partialBody.ok ? (partialBody.body.r as Record<string, Record<string, { slots: Record<string, unknown>[] }>>).m!.slots[0]! : {}
  check('空白时段不写;写了的时段只写它重述的那几档',
    isBlankSlot(newSlot()) === true
    && JSON.stringify(bodyOfRow({ ...modelRow(price), slots: [newSlot()] })) === JSON.stringify(bodyOfRow(modelRow(price)))
    && JSON.stringify(written) === JSON.stringify({ days: 'daily', start: 9, end: 12, inputPerMillion: 2 })
    && priceIssue(modelRow({ ...price, slots: [newSlot({ input: 'abc' })] }))?.includes('输入价') === true)

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

  // 行头的四个数字只读,读的是**此刻计费所用的价**:基准价叠上此刻生效的峰谷时段。
  const peakRow = modelRow({
    input: '1', output: '4', cacheRead: '0.2', cacheWrite: '',
    slots: [newSlot({ days: 'weekdays', start: '9', end: '12', input: '2' })],
  })
  const peak = ratesInForce(peakRow, new Set(), dayMillis('2026-09-14', 10))     // 周一 10:00,落在 09:00–12:00 里
  const offPeak = ratesInForce(peakRow, new Set(), dayMillis('2026-09-14', 13))
  check('此刻价 = 基准价叠上此刻生效的峰谷时段(留空的档沿用基准价),没生效时段时就是基准价',
    peak?.slot?.start === '9' && peak.values.input === '2' && peak.values.output === '4'
    && peak.values.cacheRead === '0.2' && peak.values.cacheWrite === ''
    && offPeak?.slot === null && offPeak.values.input === '1' && offPeak.values.cacheRead === '0.2')

  // 四档全空 = 这条没有价:清空就是删掉它(那份价不进 body,它的记录回到价格未知)。
  // 只填了一半的行**不是**没有价:它是「填了却写不出去」,照旧算脏并挡住这一笔。
  check('清空四档 = 删掉这条价(不写进 body);只填一半的行照旧算脏、写不出去',
    isUnpriced(modelRow()) === true && priceUnknown(modelRow()) === true
    && isUnpriced(modelRow({ input: '1' })) === false
    && modelDirty('r', modelRow({ input: '1' }), new Map()) === true
    && bodyOfRow(modelRow({ input: '1' })).ok === false)
}

if (section('没有价的行:按 ¥0 计,播种不补价')) {
  const rowView = (price: PricingEntryInput | undefined): PricingView => ({
    routes: [{ route: 'r', label: 'r', billing: 'metered', records: 4, models: [
      { model: 'm', configured: true, records: 4, ...(price !== undefined ? { price } : {}), unpriced: price === undefined ? 4 : 0 },
    ] }],
    calendar: {}, calendarMissing: [], dataDir: 'x', updatedAt: 0,
  })

  // 播种**不补价**:视图里有价就照抄,没有价就是空行。
  const priced = draftFromView(rowView({ inputPerMillion: 2, outputPerMillion: 8 })).routes.get('r')!.models.get('m')!
  const bare = draftFromView(rowView(undefined)).routes.get('r')!.models.get('m')!
  check('播种不补价:视图里有价就落进四格,没有价就是空(要价得自己填)',
    priced.input === '2' && priced.output === '8' && isUnpriced(bare) === true
    && modelDirty('r', priced, baselinesOf(rowView({ inputPerMillion: 2, outputPerMillion: 8 })).models) === false)

  // 价格未知 = 草稿里没有价,或账本透镜报出有记录按当前价折算不出金额(按美元报价却没设汇率那种)。
  check('价格未知只由「草稿里没有价」与「host 报出折算不出的记录」两条触发',
    priceUnknown(modelRow()) === true
    && priceUnknown(modelRow({ input: '1', output: '4' })) === false
    && priceUnknown(modelRow({ input: '1', output: '4', unpriced: 3 })) === true)
}

if (section('价格表写路径:草稿写出去的 body 一定被宿主接受')) {
  // 不变量:**client 产出 ⊆ host 接受**(`docs/CONTRACTS.md` §2)。规则在两侧各写一份的
  // 代价正是「草稿认为能存、写入被拒」,所以这里不重列规则,而是把
  // 「草稿 → body → host 解析」真的跑一遍——两侧各写各的检查时,只有往返能发现缺口。
  const draftOf = (route: string, model: string, price: Partial<ModelDraft>, billing: BillingNature = 'metered'): PriceState =>
    draftOfRow(modelRow({ ...price, model }), { route, model, billing })
  const roundTrip = (draft: PriceState): ReturnType<typeof parsePriceInput> => {
    const body = composePriceBody(draft)
    return body.ok ? parsePriceInput(body.body) : { ok: false, error: body.error }
  }
  const floor: Partial<ModelDraft> = { input: '1', output: '4', cacheRead: '0.02', cacheWrite: '0.5' }
  const peaked: Partial<ModelDraft> = {
    input: '2', output: '8',
    slots: [
      newSlot({ days: 'weekdays', start: '9', end: '12', input: '4' }),
      newSlot({ days: 'weekends', start: '9', end: '12', output: '16' }),
    ],
  }
  const accepted: [string, PriceState][] = [
    ['一份价 + 两组时段', draftOf('deepseek-official', 'deepseek-chat', peaked)],
    ['订阅通道($billing)', draftOf('commandcode', 'deepseek-chat', floor, 'subscription')],
    ['整行都是空白草稿(不进 body)', draftOf('r', 'm', {})],
  ]
  const refused = accepted.filter(([, draft]) => !roundTrip(draft).ok)
  check('每一份草稿产出的 body 都被宿主接受',
    refused.length === 0, refused.map(([label, draft]) => [label, composePriceBody(draft)]))

  // 旧文件的形态写不进去:生效时刻那一轴已经没了。宿主说的原因必须能让人找到那一步——
  // `from` 报「未知字段」并直说价表没有生效时间了,数组报「必须是对象」。
  const withFrom = parsePriceInput({ r: { m: { inputPerMillion: 1, outputPerMillion: 4, from: '2026-09-01' } } })
  const asArray = parsePriceInput({ r: { m: [{ from: '2026-09-01', inputPerMillion: 1, outputPerMillion: 4 }] } })
  check('旧形态的 body 被拒,而且报错说得出它为什么不是一份价',
    withFrom.ok === false && withFrom.error.includes('未知字段') && withFrom.error.includes('生效时间')
    && asArray.ok === false && asArray.error.includes('必须是对象'))

  // 反向:宿主拒绝的键规则不能是「草稿以为能存」的那种。长度上限与保留键前缀同源于
  // `price-format.ts`,所以草稿这一侧就报得出位置与原因,而不是整份文件被拒。
  const longRoute = 'r'.repeat(MAX_ROUTE_LENGTH + 1)
  const longModel = 'm'.repeat(MAX_MODEL_LENGTH + 1)
  const keyRefusals: [string, PriceState, string][] = [
    ['空通道路由名', draftOf('', 'm', floor), '空通道路由名'],
    ['保留键前缀', draftOf('$weird', 'm', floor), '「$」'],
    ['过长的通道路由名', draftOf(longRoute, 'm', floor), '通道路由名超过'],
    ['过长的模型串', draftOf('r', longModel, floor), '模型串超过'],
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
      models: [{ model: 'm', configured: true, records: 0, price: { inputPerMillion: 1, outputPerMillion: 4, cacheReadPerMillion: 1 } }],
    }],
    dataDir: 'x', updatedAt: 0,
  })
  const rowWith = (cacheRead: string): ModelDraft => modelRow({ input: '1', output: '4', cacheRead })
  check('填了却写不出去的缓存档让这一行保持脏(合法的值则与基线一致)',
    modelDirty('r', rowWith('abc'), cacheBaseline.models) === true
    && modelDirty('r', rowWith('1'), cacheBaseline.models) === false
    && composePriceBody(draftOf('r', 'm', { input: '1', output: '4', cacheRead: 'abc' })).ok === false)
}

if (section('价格表币种:按通道报价币种记,汇率只用来折成人民币')) {
  const USD: MoneyView = { route: 'USD', cnyPerUsd: 7.15 }
  const CNY: MoneyView = { route: 'CNY', cnyPerUsd: 7.15 }
  const NO_RATE: MoneyView = { route: 'USD', cnyPerUsd: null }

  // 格子里的数就是文件里的数:没有透镜,所以敲什么存什么。半输入(`1.`)与极小价的指数写法
  // 都算数;十六进制不算——`Number('0x10')` 是 16,一个「必须是数字」的格子不该把它读成 16。
  check('价的写法:十进制与指数收,半输入收,十六进制 / 负数 / 千分位不收',
    parseAmount('0.28') === 0.28 && parseAmount('1.') === 1 && parseAmount('.5') === 0.5
    && parseAmount('1e-7') === 1e-7 && parseAmount('') === null && parseAmount('abc') === null
    && parseAmount('-1') === null && parseAmount('0x10') === null && parseAmount('1_000') === null)

  // 悬停那一眼:美元通道报人民币(那是**计入金额**的数,等号),人民币通道报美元(只是给你读,约等号)。
  // 没有汇率 / 原文不是数 → 什么也不报,绝不按 1 算。
  check('提示里的另一种货币:美元→人民币是等号,人民币→美元是约等号,换不出来就不报',
    counterpartOf(USD, '0.15') === '= ¥1.0725/百万词元'
    && counterpartOf(CNY, '1.005') === '≈ $0.140559/百万词元'
    && counterpartOf(NO_RATE, '0.15') === null && counterpartOf(USD, 'abc') === null
    && unitOf(USD) === '$/百万词元' && unitOf(CNY) === '¥/百万词元')

  // 切换报价币种换算**已有的**数:人民币金额(6 位小数内)不变,而且换得回来。
  check('切换报价币种换算已有的数,来回一趟回到原值;换不出来(没汇率)就不动',
    convertText(USD, '0.15', 'CNY') === '1.0725' && convertText(CNY, '1.0725', 'USD') === '0.15'
    && convertText(USD, '', 'CNY') === '' && convertText(USD, 'abc', 'CNY') === null
    && convertText(NO_RATE, '0.15', 'CNY') === null
    && convertText(USD, '0.15', 'USD') === '0.15')

  // 计价那一步:美元通道乘汇率进人民币表,人民币通道原样;**没有汇率就丢掉美元通道**
  // (读作价格未知),绝不把美元数当人民币——那会差一个数量级,而账本会当真金白银算。
  const table: PricingTable = {
    'usd-route': { m: { rates: { inputPerMillion: 0.15, outputPerMillion: 0.6, cacheReadPerMillion: 0.02 } } },
    'cny-route': { m: { rates: { inputPerMillion: 1, outputPerMillion: 4 } } },
  }
  const money = cnyTable(table, { 'usd-route': 'USD' }, { cnyPerUsd: 7.15 })
  check('计价把美元通道乘汇率,人民币通道原样;时段身份不受换算影响',
    Math.abs(money['usd-route']!.m!.rates.inputPerMillion - 1.0725) < 1e-12
    && money['usd-route']!.m!.rates.cacheReadPerMillion === 0.02 * 7.15
    && money['cny-route'] === table['cny-route']
    && cnyTable(table, {}, { cnyPerUsd: 7.15 }) === table)
  check('没有汇率的美元通道按价格未知(丢掉),不按 1 算、也不当人民币',
    cnyTable(table, { 'usd-route': 'USD' }, undefined)['usd-route'] === undefined
    && cnyTable(table, { 'usd-route': 'USD' }, undefined)['cny-route'] !== undefined)

  // 草稿这一侧:报价币种从视图播种,换币种算一处脏(价跟着换),只改汇率不弄脏任何一行。
  const view: PricingView = {
    routes: [
      { route: 'usd-route', label: 'u', billing: 'subscription', currency: 'USD', records: 3, models: [
        { model: 'm', configured: true, records: 3, price: { inputPerMillion: 0.15, outputPerMillion: 0.6 } },
      ] },
      { route: 'cny-route', label: 'c', billing: 'metered', currency: 'CNY', records: 0, models: [
        { model: 'm', configured: true, records: 0, price: { inputPerMillion: 2, outputPerMillion: 8 } },
      ] },
    ],
    calendar: {}, calendarMissing: [], fx: { cnyPerUsd: 7.15 }, dataDir: 'x', updatedAt: 0,
  }
  const seeded = draftFromView(view)
  const baseline = baselinesOf(view)
  const switched = withRouteCurrency(seeded, 'cny-route', 'USD', 7.15)
  check('报价币种随视图播种;换币种算一处脏(整条通道的价一起换),只改汇率不弄脏任何一行',
    seeded.routes.get('usd-route')?.currency === 'USD'
    && seeded.routes.get('cny-route')?.models.get('m')?.input === '2'
    && stagedChanges(seeded, baseline) === 0
    && stagedChanges(switched, baseline) === 2
    && switched.routes.get('cny-route')?.models.get('m')?.input === '0.27972'
    && stagedChanges(withFx(seeded, '7.2'), baseline) === 1
    && stagedChanges(withFx(seeded, '7.150'), baseline) === 0
    && draftFromView({ ...view, fx: undefined }).fx === ''
    && fxSignature('7.150') === fxSignature('7.15') && fxValue('') === null && fxValue('0') === null
    && withRouteCurrency(seeded, 'cny-route', 'USD', null) === seeded)

  // wire:美元通道写进 `$currency`、人民币通道不写;汇率照旧。宿主同一套解析收下它。
  const body = composePriceBody(seeded)
  check('$currency 随保存 body 出去且被宿主接受:只写美元那几条,人民币不写',
    body.ok && JSON.stringify(body.body[PRICING_CURRENCY_KEY]) === JSON.stringify({ 'usd-route': 'USD' })
    && body.body[PRICING_FX_KEY] !== undefined && parsePriceInput(body.body).ok
    && JSON.stringify(parsePriceInput(body.body).file.currency) === JSON.stringify({ 'usd-route': 'USD' }))

  // 美元报价**必须有汇率**:清掉汇率那条路被挡住,而不是写下去之后金额整条读作未知。
  const noRate = composePriceBody(withFx(seeded, ''))
  const rateFreeState = withFx(withRouteCurrency(seeded, 'usd-route', 'CNY', 7.15), '')
  check('有美元通道时清空汇率挡住整笔保存(理由指到汇率与那条通道)',
    !noRate.ok && noRate.error.includes('汇率')
    && composePriceBody(rateFreeState).ok
    && composePriceBody(rateFreeState).body[PRICING_FX_KEY] === undefined)

  // 填了却写不出去的汇率照旧挡住整笔(与四档价里那一格红着是同一条尺子)。
  const badRates = ['abc', '0', '-1'].filter((text) => {
    const composed = composePriceBody(withFx(seeded, text))
    return composed.ok || !composed.error.includes('汇率')
  })
  check('填坏的汇率挡住整笔保存;没有美元通道时,空着 / 空白都不算坏', badRates.length === 0
    && composePriceBody(withFx(rateFreeState, '  ')).ok
    && composePriceBody(withFx(rateFreeState, '')).body[PRICING_FX_KEY] === undefined)

  // 宿主侧的严格解析:坏 `$currency` 与「美元但没有汇率」各自以出错位置拒绝。
  const usdOnly = { 'usd-route': { m: { inputPerMillion: 0.15, outputPerMillion: 0.6 } } }
  const malformed: [Record<string, unknown>, string][] = [
    [{ [PRICING_CURRENCY_KEY]: 7.15 }, PRICING_CURRENCY_KEY],
    [{ [PRICING_CURRENCY_KEY]: { r: 'EUR' } }, 'CNY'],
    [{ [PRICING_CURRENCY_KEY]: { '': 'USD' } }, '空路由名'],
    [{ [PRICING_CURRENCY_KEY]: { '$x': 'USD' } }, '不能以「$」开头'],
  ]
  check('宿主拒绝畸形 $currency(非对象 / 未知值 / 空路由名 / 键以 $ 开头)',
    malformed.every(([extra, expect]) => {
      const parsed = parsePriceInput({ ...usdOnly, ...extra })
      return !parsed.ok && parsed.error.includes(expect)
    })
    && parsePriceInput({ ...usdOnly, [PRICING_CURRENCY_KEY]: { 'usd-route': 'USD' }, [PRICING_FX_KEY]: { cnyPerUsd: 7.15 } }).ok
    && parsePriceInput({ ...usdOnly, [PRICING_CURRENCY_KEY]: { 'usd-route': 'CNY' } }).ok)
  const noFx = parsePriceInput({ ...usdOnly, [PRICING_CURRENCY_KEY]: { 'usd-route': 'USD' } })
  check('美元报价没有汇率 → 宿主拒绝整笔(而不是写进去让金额变成未知)',
    !noFx.ok && noFx.error.includes('汇率'))

  // 读路径宽容:畸形的 `$currency` 只掉它自己,价照读(与 `$fx` 同一条尺子)。
  const lenient = coercePriceFile({ [PRICING_CURRENCY_KEY]: { r: 'EUR', ok: 'USD' } }, quiet)
  check('读路径宽容:坏币种只掉那条,合法的那条留着',
    lenient.currency.ok === 'USD' && lenient.currency.r === undefined)

  // 美元通道的数**原样**落盘、原样读回来:它不是人民币,写路径上也不该被换算。
  const usdDir = await mkdtemp(join(tmpdir(), 'tokbook-fx-'))
  try {
    const body = composePriceBody(seeded)
    if (!body.ok) throw new Error(`usd draft not composable: ${body.error}`)
    const parsed = parsePriceInput(body.body)
    if (!parsed.ok) throw new Error(`usd body rejected by host: ${parsed.error}`)
    await writePriceFile(usdDir, parsed.file, quiet)
    const back = await readPriceFile(usdDir, quiet)
    const text = await readFile(join(usdDir, PRICING_FILE), 'utf8')
    check('美元报价的价原样写在文件里($currency 只记美元那条),读回来还是那个数',
      text.includes('"$currency"')
      && back.currency['usd-route'] === 'USD' && back.currency['cny-route'] === undefined
      && back.table['usd-route']?.m?.rates.inputPerMillion === 0.15
      && back.table['cny-route']?.m?.rates.inputPerMillion === 2)
  } finally {
    await rm(usdDir, { recursive: true, force: true })
  }

  // 鬼影与说明里的数:留空的档报的是**同一种货币**下的沿用量,与格子同一单位。
  const showRow = modelRow({ input: '0.15', output: '0.6', cacheRead: '' })
  const shown = inheritedCell(showRow, null, 'cacheRead')
  check('留空档的鬼影与说明用同一种货币(不换算),cache 档回落到输入价',
    shown.value === '0.15' && shown.note?.includes('0.15') === true)
}

if (section('折叠自证有效:天级水位线看不见往日的追加')) {
  const rollupOf = (upto: string, files: Record<string, string>): RollupFile => ({
    schemaVersion: ROLLUP_SCHEMA_VERSION, upto, pricingRevision: '', files, lastEventAt: null,
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

  // 一次瞬时读失败(EMFILE/EBUSY/EACCES)不能让那一天永久少算:读不到 ≠ 这天没有记录。
  // 降级为空但**不记下版本戳**,于是折叠的 `files` 里没有这一天,而它在 `upto` 水位线之内
  // ——下一次读就据第二段判据整份作废重折,文件恢复可读后自愈。
  const readDir = await mkdtemp(join(tmpdir(), 'tokbook-unreadable-'))
  const dayA = 'usage-2026-03-01.jsonl'
  const dayB = 'usage-2026-03-02.jsonl'
  try {
    await writeFile(join(readDir, dayA), `${serializeRecord({ requestId: 'r-a', time: dayMillis('2026-03-01', 9), sessionId: 's', provider: 'p', model: 'm', usage: { inputTokens: 1000, outputTokens: 10 } })}\n`, 'utf8')
    await mkdir(join(readDir, dayB)) // 同名目录:stat 成功、readFile 报 EISDIR
    const first = await buildSummary(readDir, () => new Date(2026, 2, 3), () => UNPRICED_KEY, quiet)
    const written = await readRollup(readDir, quiet, '')
    const liveStamps = new Map<string, string>()
    for (const name of [dayA, dayB]) {
      const info = await stat(join(readDir, name))
      liveStamps.set(name, `${String(info.size)}:${String(info.mtimeMs)}`)
    }
    check('读不到的日文件降级为空,但折叠不把它记进 files —— 那一天的量少算,而折叠不自称最新(下次读会作废重折)',
      first.total.requests === 1 && first.total.inputTokens === 1000
      && written !== null && written.files[dayA] !== undefined && written.files[dayB] === undefined
      && rollupIsCurrent(written, liveStamps) === false,
      written === null ? 'rollup 没写出来' : { files: written.files, current: rollupIsCurrent(written, liveStamps) })
    await rm(join(readDir, dayB), { recursive: true, force: true })
    await writeFile(join(readDir, dayB), `${serializeRecord({ requestId: 'r-b', time: dayMillis('2026-03-02', 9), sessionId: 's', provider: 'p', model: 'm', usage: { inputTokens: 500, outputTokens: 5 } })}\n`, 'utf8')
    const second = await buildSummary(readDir, () => new Date(2026, 2, 3), () => UNPRICED_KEY, quiet)
    check('那一天恢复可读后数值自愈(走折叠作废 → 重折),不是永久 0',
      second.total.requests === 2 && second.total.inputTokens === 1500,
      { requests: second.total.requests, inputTokens: second.total.inputTokens })
  } finally {
    await rm(readDir, { recursive: true, force: true })
  }
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
    'deepseek-official': { 'deepseek-chat': { rates: { inputPerMillion: 2, outputPerMillion: 8 } } },
    'opencode-go': { 'deepseek-chat': { rates: { inputPerMillion: 2, outputPerMillion: 8 } } },
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
  const rows = aggregateWindow(recs, workspaces, id => cwd.get(id), pricing, resolveRate, billing).byWorkspace
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
      'deepseek-chat': { rates: { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5, cacheWritePerMillion: 1 } },
      'deepseek-reasoner': { rates: { inputPerMillion: 4, outputPerMillion: 16, cacheReadPerMillion: 1, cacheWritePerMillion: 2 } },
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
    'deepseek-official': { 'deepseek-v4-flash': { rates: { inputPerMillion: 2, outputPerMillion: 8 } } },
    'opencode-go': {
      'deepseek-v4-flash': { rates: { inputPerMillion: 2, outputPerMillion: 8 } },
      'glm-5.3-flash': { rates: { inputPerMillion: 3, outputPerMillion: 10, cacheReadPerMillion: 1 } },
    },
  }
  const window = aggregateWindow(records, null, () => undefined, pricing, (r) => rateKeyAt(pricing, r.provider, r.model, r.time))
  const cards = window.providers
  const deepseek = cards.find(c => c.provider === 'deepseek-official')
  const opencode = cards.find(c => c.provider === 'opencode-go')
  check('两条通道两张卡(不合并),失败不计请求数,按词元降序',
    cards.length === 2 && cards[0]?.provider === 'deepseek-official' && cards[1]?.provider === 'opencode-go'
    && deepseek?.requests === 1 && opencode?.requests === 2 && deepseek?.tokens === 1200 && opencode?.tokens === 1090
    && deepseek?.models.length === 1 && opencode?.models.length === 2 && deepseek?.unpricedModels.length === 0)
  // 按模型切法就是各卡模型行摊平:两种切法同源,同一窗口的两个合计数必然相等。
  const modelRows = window.byModel
  const four = (t: { inputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; outputTokens: number }): number =>
    t.inputTokens + t.cacheReadTokens + t.cacheWriteTokens + t.outputTokens
  check('按模型切法 = 摊平卡片,键与金额逐行保留,合计与卡片那一面相等',
    modelRows.length === 3 && modelRows.some(r => r.provider === 'opencode-go' && r.model === 'glm-5.3-flash' && r.totals.requests === 1)
    && modelRows.reduce((sum, r) => sum + four(r.totals), 0) === cards.reduce((sum, c) => sum + c.tokens, 0))
  const unpriced = aggregateWindow([{ requestId: 'r5', time: dayMillis('2026-03-01', 11), sessionId: 's3', provider: 'mystery', model: 'brand-new-x', usage: { inputTokens: 10, outputTokens: 10 } }], null, () => undefined, pricing, (r) => rateKeyAt(pricing, r.provider, r.model, r.time)).providers
  check('没定价的模型按 ¥0 计,并在卡上列出来', unpriced[0]?.unpricedModels.join() === 'brand-new-x' && unpriced[0]?.cost === 0 && unpriced[0]?.models[0]?.cost === 0)
  // 没有工作区注册表的宿主:按工作区这一面**不存在**(空),不是「全部未归属」。
  check('没有工作区注册表时按工作区是空的,而不是把记录全塞进未归属',
    window.byWorkspace.length === 0 && window.providers.reduce((sum, c) => sum + c.requests, 0) === 3)
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
  // 「小数字是倒计时秒数」需要上限:1_760_000_000 是 2025 年的秒级 epoch,不设上限会被
  // 当成「距重置 1.76e9 秒」外推到 2081 年,于是一个**已经过期**的订阅被 quotaGate 报成
  // 生效中(门决定告急点与卡片正文)。
  const secondsEpoch = 1_760_000_000
  check('秒级 epoch 原样当毫秒读(不倒计时外推),过期订阅因此不再被报成生效中',
    resetEpoch(secondsEpoch, epoch) === secondsEpoch
    && resetEpoch(31_536_000, epoch) === epoch + 31_536_000_000
    && resetEpoch(31_536_001, epoch) === 31_536_001
    && quotaGate(planInfoFromSubscriptions({ planId: 'x', status: 'canceled', currentPeriodEnd: secondsEpoch }), epoch) === 'balance')
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
      'deepseek-official': { 'deepseek-v4-flash': { rates: { inputPerMillion: 2, outputPerMillion: 8 } } },
      'opencode-go': { 'deepseek-v4-flash': { rates: { inputPerMillion: 2, outputPerMillion: 8 } } },
      commandcode: { 'deepseek/deepseek-v4-flash': { rates: { inputPerMillion: 2, outputPerMillion: 8 } } },
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

if (section('models.dev 同步:归一化 / 门槛 / 手写价保护')) {
  // --- 归一化:models.dev 与账本各写各的,落到同一个键 ---
  check('归一化剥 vendor/ 前缀、:变体、[1m] 与 @,转小写',
    normalizeModelId('deepseek/deepseek-v4-flash') === 'deepseek-v4-flash'
    && normalizeModelId('Qwen/Qwen3.8-Max-0902:free') === 'qwen3.8-max-0902'
    && normalizeModelId('xai/grok-4.6[1m]') === 'grok-4.6'
    && normalizeModelId('z-ai/glm-5.3@preview') === 'glm-5.3-preview')

  // --- 目录解析:只采信原厂 slug;畸形条目跳过 ---
  const catalogValue = {
    deepseek: { models: { 'deepseek-v4-flash': { name: 'DeepSeek V4 Flash', modalities: { input: ['text'], output: ['text'] }, cost: { input: 0.15, output: 0.6, cache_read: 0.003 } } } },
    'alibaba-cn': { models: { 'deepseek-v4-flash': { name: '转售价', modalities: { output: ['text'] }, cost: { input: 0.14, output: 0.28 } } } },
    openai: { models: { 'gpt-5.6-luna': { name: 'GPT-5.6 Luna', modalities: { output: ['text'] }, cost: { input: 0.2, output: 1.2, cache_write: 0.25 } }, 'text-embedding-3-small': { modalities: { output: ['text'] }, cost: { input: 0.02, output: 0 } } } },
    google: { models: { 'gemini-3.8-flash': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } }, 'gemini-old': { modalities: { output: ['text'] }, status: 'deprecated', cost: { input: 1, output: 2 } } } },
    crossmodel: { models: { 'gemini-3.8-flash': { modalities: { output: ['text'] }, cost: { input: 0.75, output: 3.75 } } } },
  }
  const catalog = parseCatalog(catalogValue)
  check('只采信原厂 slug,转售商条目不进目录;deprecated 与无 cost 的条目不进',
    catalog.size === 3 && catalog.has('deepseek-v4-flash') && catalog.has('gpt-5.6-luna') && catalog.has('gemini-3.8-flash')
    && !catalog.has('text-embedding-3-small') && !catalog.has('gemini-old'))
  check('多原厂条目一致价收一条', parseCatalog({
    moonshotai: { models: { 'kimi-k3': { modalities: { output: ['text'] }, cost: { input: 3, output: 15 } } } },
    'moonshotai-cn': { models: { 'kimi-k3': { modalities: { output: ['text'] }, cost: { input: 3, output: 15 } } } },
  }).get('kimi-k3')?.cost.input === 3)
  check('多原厂条目分裂价整键弃采(无法替它选边,不猜)', parseCatalog({
    openai: { models: { 'gpt-x': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } } } },
    anthropic: { models: { 'gpt-x': { modalities: { output: ['text'] }, cost: { input: 1, output: 3 } } } },
  }).has('gpt-x') === false)

  // --- 合并:四道门槛 ---
  const table: PricingTable = {
    commandcode: { 'gpt-5.6-luna': { rates: { inputPerMillion: 0.2, outputPerMillion: 1.2 } } },
    zai: { 'glm-5.3-flash': { rates: { inputPerMillion: 1.065, outputPerMillion: 3.55 } } },
  }
  const currency = { commandcode: 'USD' as const }
  const ledger = new Map([
    ['commandcode', new Set(['deepseek/deepseek-v4-flash', 'gpt-5.6-luna', 'absent-model'])],
    ['zai', new Set(['glm-5.3-flash'])],
    ['loneroute', new Set(['kimi-k3'])],
  ])
  const { table: merged, report } = mergeCatalogIntoTable(table, currency, ledger, catalog)
  check('补缺价:归一化命中、美元通道、格子上无价 → 按 6 位小数落盘',
    merged.commandcode?.['deepseek/deepseek-v4-flash']?.rates.inputPerMillion === 0.15
    && merged.commandcode?.['deepseek/deepseek-v4-flash']?.rates.cacheReadPerMillion === 0.003
    && report.added === 1)
  check('手写价永远赢:已有价的格子(哪怕价不同)一个字不动',
    merged.commandcode?.['gpt-5.6-luna']?.rates.outputPerMillion === 1.2
    && merged.zai?.['glm-5.3-flash']?.rates.inputPerMillion === 1.065)
  check('非美元通道整条跳过(人民币挂牌价不是美元价的函数,换算即估算)',
    merged.zai !== undefined && merged.zai['glm-5.3-flash'] !== undefined
    && report.reasons['zai/glm-5.3-flash'] !== undefined)
  check('目录没有采信条目的模型跳过,继续价格未知', report.reasons['commandcode/absent-model'] !== undefined)
  check('跳过数 = 非美元 + 无条目 + 空目录通道 = 3,added 只数真写进去的',
    report.skipped === 3 && report.added === 1)

  // --- 状态文件:日节流的持久化 ---
  const dir = await mkdtemp(join(tmpdir(), 'tokbook-modelsdev-'))
  try {
    check('状态读:缺失/畸形读作「从未同步」(最坏是多同步一次)',
      (await readPricingSyncState(dir)).lastSyncDay === null)
    await writePricingSyncState(dir, { lastSyncDay: '2026-10-05', lastError: null })
    const state = await readPricingSyncState(dir)
    check('状态写后读回原样', state.lastSyncDay === '2026-10-05' && state.lastError === null)
    await writeFile(join(dir, 'models-dev-sync.json'), '{broken', 'utf8')
    check('撕裂的状态文件读作「从未同步」,不抛错', (await readPricingSyncState(dir)).lastSyncDay === null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

if (section('models.dev 查价:模糊搜索 / 排序 / 采信边界')) {
  // --- 采信目录(与「同步」一节同一份) ---
  const catalog = parseCatalog({
    deepseek: { models: { 'deepseek-v4-flash': { name: 'DeepSeek V4 Flash', modalities: { output: ['text'] }, cost: { input: 0.15, output: 0.6, cache_read: 0.003 } } } },
    openai: { models: { 'gpt-x': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } } } },
    anthropic: { models: { 'gpt-x': { modalities: { output: ['text'] }, cost: { input: 1, output: 3 } } } },
    google: { models: {
      'gpt-5.6-luna': { name: 'GPT-5.6 Luna', modalities: { output: ['text'] }, cost: { input: 0.2, output: 1.2, cache_write: 0.25 } },
      'gemini-3.8-flash': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } },
    } },
    // 转售商与分裂价:与同步一节同一批,这里应同样搜不到
    'alibaba-cn': { models: { 'deepseek-v4-flash': { name: '转售价', modalities: { output: ['text'] }, cost: { input: 0.14, output: 0.28 } } } },
    crossmodel: { models: { 'gemini-3.8-flash': { modalities: { output: ['text'] }, cost: { input: 0.75, output: 3.75 } } } },
  })

  // --- 关键词同样走 normalizeModelId:vendor/前缀、:变体、[1m]、@ 都能落到候选集 ---
  check('带 vendor 前缀与长上下文标记的关键词搜到同一条',
    searchCatalog(catalog, 'deepseek/deepseek-v4-flash[1m]').map((m) => m.key).join(',') === 'deepseek-v4-flash'
    && searchCatalog(catalog, 'z-ai/glm-5.3@preview').length === 0)

  // --- 排序:精确命中 > 前缀 > 词级包含 > 名字兜底 ---
  const ranked = searchCatalog(catalog, 'deepseek-v4-flash')
  check('精确命中排第一', ranked[0]?.key === 'deepseek-v4-flash' && ranked.length === 1)
  check('候选带四档价与原厂身份', ranked[0]?.entry.provider === 'deepseek'
    && ranked[0]?.entry.cost.input === 0.15 && ranked[0]?.entry.cost.cacheRead === 0.003)

  const v4 = searchCatalog(catalog, 'v4')
  check('短词只靠词级命中,不污染无关模型', v4.map((m) => m.key).join(',') === 'deepseek-v4-flash')

  const qwen = searchCatalog(catalog, 'qwen')
  check('搜不到就返回空(不返回转售价)', qwen.length === 0)

  // --- 采信边界:转售价 / 分裂价 / 已弃用条目同样搜不到 ---
  const reseller = searchCatalog(catalog, 'deepseek-v4-flash')
  check('候选池里没有转售价条目', reseller.every((m) => m.entry.provider !== 'alibaba-cn'))
  const split = searchCatalog(catalog, 'gpt-x')
  check('分裂价整键弃采,搜不到', split.length === 0)

  // --- 空关键词 / 上限 ---
  check('空关键词不搜', searchCatalog(catalog, '').length === 0 && searchCatalog(catalog, '   ').length === 0)
  const many = parseCatalog({
    openai: { models: {
      'a-1': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } },
      'a-2': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } },
      'a-3': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } },
      'a-4': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } },
      'a-5': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } },
      'a-6': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } },
      'a-7': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } },
      'a-8': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } },
      'a-9': { modalities: { output: ['text'] }, cost: { input: 1, output: 2 } },
    } },
  })
  check('上限截断,不爆屏', searchCatalog(many, 'a-').length === 8)
}

if (section('会话用时:一步的墙钟就是模型 + 工具,量不到不算 0')) {
  /** 一组事件 → `buildSessionUsageView` 要的 join 资料。生产里它由 `sessionJoin` 按日志
   *  revision 缓存（读一次日志、算一次索引），这里只有事件、没有持久化面，所以就地算。 */
  const joinOf = (events: readonly SessionEventLike[] | null, sessionId = 'sess-t'): SessionJoin =>
    (events === null
      ? { turn: null, timing: null, span: null, labels: new Map() }
      : joinOfEvents(sessionId, events))

  /** 一条打包的文本流(messages.dev 那种「首段 + 相邻差值」的紧凑形状)。 */
  const packed = (time0: number, texts: string[], dt: number[]) =>
    ({ type: 'text-chunks', time0, index: 0, dt, texts })

  /** 三步的会话,每步各压一种形态:
   *  1) 正常一步 —— 首 token、生成、一次工具调用俱全;
   *  2) 并行两个工具 —— 逐对相加会超过墙钟,取并集才对;
   *  3) 重试耗尽 —— 有 step/end 没有 assistant/message,所以只有墙钟,没有模型段。 */
  const base = dayMillis('2026-03-01', 9)
  const events: SessionEventLike[] = [
    { type: 'turn/start', time: base, seq: 0, data: { turn: 1 } },
    { type: 'step/start', time: base, seq: 1, data: { turn: 1, step: 1 } },
    // 首个 token 在 +1000ms:stream 里第一条是块起止(不算 token),打包段从 time0 累加 dt。
    {
      type: 'assistant/message', time: base + 5_000, seq: 2, data: {
        turn: 1, step: 1, usage: { inputTokens: 100, outputTokens: 80 },
        message: { id: 'm1', source: { provider: 'deepseek', model: 'deepseek-chat' } },
        stream: [{ type: 'chunk', time: base, chunk: { type: 'block-start', index: 0, blockType: 'reasoning' } }, packed(base + 1_000, ['', '你', '好'], [0, 4_000])],
      },
    },
    { type: 'tool/call', time: base + 5_100, seq: 3, data: { turn: 1, step: 1, callId: 'c1', name: 'read', arguments: {} } },
    { type: 'tool/result', time: base + 6_000, seq: 4, data: { turn: 1, step: 1, message: { source: { kind: 'tool', callId: 'c1' } } } },
    { type: 'step/end', time: base + 6_000, seq: 5, data: { turn: 1, step: 1 } },

    { type: 'step/start', time: base + 10_000, seq: 6, data: { turn: 1, step: 2 } },
    { type: 'assistant/message', time: base + 12_000, seq: 7, data: { turn: 1, step: 2, usage: { inputTokens: 50, outputTokens: 20 }, message: { id: 'm2', source: { provider: 'deepseek', model: 'deepseek-chat' } } } },
    { type: 'tool/call', time: base + 12_100, seq: 8, data: { turn: 1, step: 2, callId: 'c2', name: 'grep', arguments: {} } },
    { type: 'tool/call', time: base + 12_200, seq: 9, data: { turn: 1, step: 2, callId: 'c3', name: 'glob', arguments: {} } },
    // 两个调用并行:第一个结束早、第二个结束晚,并集 = 12_100 → 15_000 = 2.9s(逐对相加是 4.9s)。
    { type: 'tool/result', time: base + 14_000, seq: 10, data: { turn: 1, step: 2, message: { source: { kind: 'tool', callId: 'c2' } } } },
    { type: 'tool/result', time: base + 15_000, seq: 11, data: { turn: 1, step: 2, message: { source: { kind: 'tool', callId: 'c3' } } } },
    { type: 'step/end', time: base + 15_000, seq: 12, data: { turn: 1, step: 2 } },

    { type: 'step/start', time: base + 20_000, seq: 13, data: { turn: 1, step: 3 } },
    { type: 'llm/retry', time: base + 21_000, seq: 14, data: { retryId: 'r1', turn: 1, step: 3, provider: 'deepseek', retry: 1, maxRetries: 3, delayMs: 500, failure: { code: 'TRANSPORT' } } },
    { type: 'step/end', time: base + 30_000, seq: 15, data: { turn: 1, step: 3 } },
    { type: 'turn/end', time: base + 31_000, seq: 16, data: { turn: 1, reason: { kind: 'done' } } },
    // 会话在末事件之后挂起几小时:跨度要含这一段,「引擎工作」不含。
    { type: 'session/title', time: base + 4 * 3_600_000, seq: 17, data: {} },
  ]
  // 账本行由事件投影而来(与写入侧同一条规则):m1 / m2 两次产出 + 一条重试失败行。
  const records = events
    .map((event) => recordOfEvent(event, 'sess-t', 'deepseek-chat', false))
    .filter((record): record is UsageRecord => record !== null)
  const view = buildSessionUsageView({
    sessionId: 'sess-t', records, join: joinOf(events),
    pricing: {}, billing: {}, resolve: () => UNPRICED_KEY, todaySpend: 0, updatedAt: base,
  })
  const rows = view.turns[0]?.rows ?? []
  const [one, two, three] = rows

  check('一步一行,三步都在同一轮下', rows.length === 3 && view.turns.length === 1)
  // 墙钟 = step/start → step/end;模型 = step/start → assistant/message。
  check('步骤 1:墙钟 6s、模型 5s、首 token 1s(块起止不算 token)、生成 4s',
    one?.timing?.wallMs === 6_000 && one?.timing?.llmMs === 5_000
    && one?.timing?.ttftMs === 1_000 && one?.timing?.decodeMs === 4_000)
  check('步骤 1:一次工具调用 0.9s', one?.timing?.toolMs === 900 && one?.timing?.toolCalls === 1)
  // 并集而不是逐对相加:相加会得到 4.9s,越过了那一步 5s 的墙钟。
  check('步骤 2:并行两个工具取并集 2.9s(相加会是 4.9s)',
    two?.timing?.toolMs === 2_900 && two?.timing?.toolCalls === 2)
  check('步骤 2:最慢的那次是 2.8s 的 glob', two?.timing?.slowTool?.name === 'glob' && two?.timing?.slowTool?.ms === 2_800)
  // 重试耗尽的步没有产出:墙钟还在,模型那一段**缺席**——它不是 0,是没得可量。
  check('步骤 3(重试耗尽):只有墙钟 10s,没有模型段、没有首 token',
    three?.timing?.wallMs === 10_000 && three?.timing?.llmMs === undefined
    && three?.timing?.ttftMs === undefined && three?.timing?.toolMs === undefined)
  check('墙钟不小于各段之和(并集 + 不含产出段的步都推不出反例)',
    rows.every((row) => {
      const t = row.timing
      if (t?.wallMs === undefined) return true
      return t.wallMs >= (t.llmMs ?? 0) + (t.toolMs ?? 0)
    }))

  // 会话级:跨度取日志首末事件(含挂起那几小时),工作量只数模型 + 工具。
  check('会话跨度含挂起时间(4 小时)',
    view.spanMs === 4 * 3_600_000)
  // 引擎工作只数模型 5s + 2s 与工具 0.9s + 2.9s = 10.8s:第 3 步那 10s 花在重试与退避上,
  // 没有产出可归属,所以它进跨度、不进工作量——这正是两个数并排要让人看见的差额。
  check('引擎工作不含重试退避那 10s(5 + 2 + 0.9 + 2.9 = 10.8s)', view.workMs === 10_800)
  check('分组用时不另存一份,settleTiming 现加等于逐行相加',
    settleTiming(rows).llmMs + settleTiming(rows).toolMs === view.workMs)

  // 日志读不到:跨度与用时都缺席,但账本读数照出——不猜、不用账本首末记录顶替。
  const blind = buildSessionUsageView({
    sessionId: 'sess-t', records, join: joinOf(null),
    pricing: {}, billing: {}, resolve: () => UNPRICED_KEY, todaySpend: 0, updatedAt: base,
  })
  check('日志读不到:用时与跨度都缺席(不报 0——那是「量不到」),行仍进 unattributed',
    blind.spanMs === undefined && blind.workMs === undefined
    && blind.unattributed.every((row) => row.timing === undefined))

  // 压缩行的用时取自 compaction/start → summary 那一段,报成模型用时(它就是那次调用)。
  const compBase = dayMillis('2026-03-02', 9)
  const compEvents: SessionEventLike[] = [
    { type: 'compaction/start', time: compBase, seq: 0, data: { compactionId: 'c1', turn: null } },
    { type: 'compaction/summary', time: compBase + 20_000, seq: 1, data: { compactionId: 'c1', summary: [], provider: 'deepseek', model: 'deepseek-chat', usage: { inputTokens: 9, outputTokens: 3 } } },
    { type: 'compaction/end', time: compBase + 20_500, seq: 2, data: { compactionId: 'c1', turn: null } },
  ]
  const compView = buildSessionUsageView({
    sessionId: 'sess-c',
    records: [{ requestId: 'compaction:sess-c:c1', time: compBase + 20_000, sessionId: 'sess-c', model: 'deepseek-chat', kind: 'compaction', usage: { inputTokens: 9, outputTokens: 3 } }],
    join: joinOf(compEvents, 'sess-c'), pricing: {}, billing: {}, resolve: () => UNPRICED_KEY, todaySpend: 0, updatedAt: compBase,
  })
  const compRow = compView.betweenTurns?.rows[0]
  check('压缩归轮间,用时是 start → summary 那 20s(报成模型用时,不另记墙钟)',
    compView.betweenTurns !== null && compRow?.timing?.llmMs === 20_000 && compRow.timing.wallMs === undefined)

  // 重试过的步在账本里有**两行**(那次重试的失败行 + 最终产出那行),而 (turn, step) 只有一个、
  // step/start → step/end 也只有一个区间。按行各报一次就会把同一步的用时加两遍,
  // 「引擎工作」于是可能超过「会话跨度」(本机 163 个会话有这种重复行)。
  const retryEvents: SessionEventLike[] = [
    { type: 'turn/start', time: base, seq: 0, data: { turn: 1 } },
    { type: 'step/start', time: base, seq: 1, data: { turn: 1, step: 1 } },
    { type: 'llm/retry', time: base + 2_000, seq: 2, data: { retryId: 'r9', turn: 1, step: 1, provider: 'deepseek', retry: 1, maxRetries: 3, delayMs: 500, failure: { code: 'TRANSPORT' } } },
    { type: 'assistant/message', time: base + 8_000, seq: 3, data: { turn: 1, step: 1, usage: { inputTokens: 10, outputTokens: 5 }, message: { id: 'm9', source: { provider: 'deepseek', model: 'deepseek-chat' } } } },
    { type: 'step/end', time: base + 9_000, seq: 4, data: { turn: 1, step: 1 } },
  ]
  const retryView = buildSessionUsageView({
    sessionId: 'sess-r',
    // 两行都 join 到 1:1:失败行(重试投影出来的身份)与产出行(消息 id)。
    records: [
      { requestId: recordFromRetry(retryEvents[2]!, 'sess-r', '').requestId, time: base + 2_000, sessionId: 'sess-r', model: 'deepseek-chat', kind: 'failure', failureCode: 'TRANSPORT' },
      { requestId: 'm9', time: base + 8_000, sessionId: 'sess-r', model: 'deepseek-chat', provider: 'deepseek', usage: { inputTokens: 10, outputTokens: 5 } },
    ],
    join: joinOf(retryEvents, 'sess-r'), pricing: {}, billing: {}, resolve: () => UNPRICED_KEY, todaySpend: 0, updatedAt: base,
  })
  const retryRows = retryView.turns[0]?.rows ?? []
  check('同一步的两行只报一次用时(报在有产出的那行),另行为「未计时」',
    retryRows.length === 2 && retryRows.filter((row) => row.timing !== undefined).length === 1
    && retryRows.find((row) => row.usage !== undefined)?.timing?.wallMs === 9_000)
  check('同一步的用时不被加两遍:引擎工作 8s(模型)≤ 跨度 9s',
    retryView.workMs === 8_000 && retryView.spanMs === 9_000)
}

// 子代理：按会话血缘把下级折成一段，每个**直接**子代理一行、含自己的整棵子树；主合计不并入。
if (section('会话子代理:整棵子树归一个直接子代理,fork 不算子代理')) {
  const base = dayMillis('2026-03-03', 9)
  const sessions = [
    { header: { id: 'sess-p' } },
    { header: { id: 'sub-a', parentSession: 'sess-p', origin: 'subagent' } },
    { header: { id: 'sub-a-1', parentSession: 'sub-a', origin: 'subagent' } },
    { header: { id: 'sub-b', parentSession: 'sess-p', origin: 'subagent' } },
    // 用户手动 fork 的会话也带 parentSession，但 origin 缺席——它不是子代理。
    { header: { id: 'fork-x', parentSession: 'sess-p' } },
    { header: { id: 'other' } },
  ]
  const record = (sessionId: string, inputTokens: number) => ({
    requestId: `${sessionId}:m1`, time: base, sessionId, model: 'm', provider: 'p',
    usage: { inputTokens, outputTokens: 0 },
  })
  const records = [
    record('sess-p', 100),
    record('sub-a', 200),
    record('sub-a-1', 300),
    record('sub-b', 50),
    record('fork-x', 999),
    record('other', 999),
  ]
  const parentEvents: SessionEventLike[] = [
    { type: 'assistant/message', time: base, seq: 0, data: { turn: 1, step: 1, message: { id: 'sess-p:m1', source: { provider: 'p', model: 'm' } } } },
    { type: 'subagent/catalog', time: base, seq: 1, data: { childId: 'sub-a', label: '审查计价' } },
  ]
  const view = buildSessionUsageView({
    sessionId: 'sess-p', records, sessions,
    join: joinOfEvents('sess-p', parentEvents),
    pricing: {}, billing: {}, resolve: () => UNPRICED_KEY, todaySpend: 0, updatedAt: base,
  })
  const subagents = view.subagents
  check('主合计仍是本会话自己的 100 词元,不并入子代理', view.totalTokens === 100)
  check('两个直接子代理各自一行', subagents?.count === 2 && subagents.rows.length === 2)
  // sub-a 的 200 与它派出的 sub-a-1 的 300 折进同一行；sub-a-1 不单独占行。
  check('整棵子树折进直接子代理:sub-a 500 = 200 + 300,子代理合计 550',
    subagents?.rows[0]?.sessionId === 'sub-a' && subagents.rows[0].tokens === 500
    && subagents?.totalTokens === 550)
  check('「含 N 个下级」只数它自己的后代', subagents?.rows[0]?.descendants === 1 && subagents?.rows[1]?.descendants === 0)
  check('两个直接子代理按词元降序排列', subagents?.rows[1]?.sessionId === 'sub-b' && subagents?.rows[1]?.tokens === 50)
  // fork 的 999 与无关会话都不进这一段:只认 origin === 'subagent'。
  check('fork 与无关会话都不算子代理', subagents?.rows.every((row) => row.sessionId !== 'fork-x' && row.sessionId !== 'other') === true)
  check('父会话目录里的创建标签随行到达,缺席时留空', subagents?.rows[0]?.label === '审查计价' && subagents?.rows[1]?.label === '')
  check('整段价格未知时行不报 ¥0 读数', subagents?.rows.every((row) => row.priced === false) === true)
  // 读不到会话血缘(独立查看器没有持久化面)时整段缺席,不能填成「0 个子代理」。
  const noLineage = buildSessionUsageView({
    sessionId: 'sess-p', records, join: joinOfEvents('sess-p', parentEvents),
    pricing: {}, billing: {}, resolve: () => UNPRICED_KEY, todaySpend: 0, updatedAt: base,
  })
  check('没有会话清单时子代理一段缺席(不知道 ≠ 没有)', noLineage.subagents === undefined)
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
