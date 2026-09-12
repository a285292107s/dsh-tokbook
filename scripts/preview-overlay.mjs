/**
 * Standalone visual preview harness for the dsh-tokbook overlay.
 *
 * Dev-only (never shipped): stubs `window.__ModuleLoader__`, provides the
 * baseline modules (react, jsx-runtime, react-dom/client) the real DSH module
 * table would inject, defines the DSH `--dsw-alias-*` tokens (light + dark),
 * stubs `/tokbook/overview` + `/tokbook/rescan`, then mounts the REAL built
 * bundle (`lib/client.js`) through its real `apply()` path and opens the
 * overlay.
 *
 * Query flags: ?dark=1 dark skin, ?empty=1 empty ledger, ?err=1 fetch error,
 * ?quota=rich|percent|mix|unconfigured|error|balance|payg|nosub|retiredfirst|none quota-tab fixture +
 * auto-switch to the quota tab.
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const clientJs = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

/** Bundle react + react-dom as the "baseline module table" for the loader. */
const baseline = await build({
  stdin: {
    contents: `
      import * as React from 'react'
      import * as JSXRuntime from 'react/jsx-runtime'
      import * as ReactDOMClient from 'react-dom/client'
      const cache = window.__DSH_REQUIRE_CACHE__ = window.__DSH_REQUIRE_CACHE__ ?? {}
      cache['react'] = React
      cache['react/jsx-runtime'] = JSXRuntime
      cache['react-dom'] = ReactDOMClient
      cache['react-dom/client'] = ReactDOMClient
    `,
    resolveDir: root,
    loader: 'js',
  },
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
})
const baselineJs = baseline.outputFiles[0].text

/** Deterministic-ish daily rows for the last 14 days. */
function days(n) {
  const rows = []
  const base = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86_400_000)
    const day = d.toISOString().slice(0, 10)
    const seed = (i * 73) % 100
    rows.push({
      day,
      totals: {
        requests: 8 + (seed % 17),
        inputTokens: 40_000 + seed * 3_100,
        outputTokens: 9_000 + seed * 820,
        cacheReadTokens: 120_000 + seed * 21_000,
        cacheWriteTokens: 0,
        compactions: seed % 5 === 0 ? 1 : 0,
        failures: seed % 7 === 0 ? 1 : 0,
      },
    })
  }
  return rows
}

const mk = (inputTokens, cacheReadTokens, outputTokens, requests = 1) => ({
  requests, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens: 0,
})

const overview = {
  total: { requests: 214, ...mk(1_920_000, 6_310_000, 486_000, 214), compactions: 6, failures: 3 },
  byDay: days(14),
  byHour: [],
  byModel: [
    { provider: 'deepseek', model: 'deepseek-chat', totals: mk(1_510_000, 6_100_000, 402_000, 198), cost: 3.87, spend: 3.87, subscriptionValue: 0 },
    { provider: 'deepseek', model: 'deepseek-reasoner', totals: mk(410_000, 210_000, 84_000, 16), cost: 1.12, spend: 1.12, subscriptionValue: 0 },
    { provider: 'opencode-go', model: 'deepseek-v4-flash', totals: mk(800_000, 900_000, 120_000, 34), cost: 2.4, spend: 0, subscriptionValue: 2.4 },
  ],
  rateRows: [],
  // 按工作区：最近有操作在前，未归属收尾（id ''），tokens = 四桶之和。
  // 第一行故意跨两条计费性质的路由（实际支出 + 订阅价值同时非零），因为工作区
  // 不像模型行那样被限定在单个金额桶里。
  byWorkspace: [
    { id: 'w-harness', title: 'deepseek-harness', path: 'C:\\Users\\28529\\Desktop\\deepseek-harness', totals: mk(1_510_000, 6_100_000, 402_000, 198), tokens: 8_012_000, spend: 3.87, subscriptionValue: 1.2, lastAt: Date.now() - 3 * 60_000 },
    { id: 'w-wiki', title: 'zzz wiki', path: 'C:\\Users\\28529\\Desktop\\zzz wiki', totals: mk(800_000, 900_000, 120_000, 34), tokens: 1_820_000, spend: 0, subscriptionValue: 2.4, lastAt: Date.now() - 5 * 3_600_000 },
    { id: 'w-plugins', title: 'dsh-plugins', path: 'C:\\Users\\28529\\Desktop\\dsh-plugins', totals: mk(410_000, 210_000, 84_000, 16), tokens: 704_000, spend: 1.12, subscriptionValue: 0, lastAt: Date.now() - 26 * 3_600_000 },
    { id: '', title: '未归属', path: '', totals: mk(50_000, 120_000, 8_000, 7), tokens: 178_000, spend: 0, subscriptionValue: 0, lastAt: Date.now() - 40 * 60_000 },
  ],
  dataDir: 'C:\\Users\\28529\\.dsh\\tokbook',
  totalCost: 8.59,
  spend: 4.99,
  subscriptionValue: 3.6,
  unpricedModels: [],
  pricing: {},
  totalTokens: 10_714_000,
  currency: 'CNY',
  usdExchangeRate: 7.2,
  updatedAt: Date.now() - 60_000,
  records: 214,
  files: 9,
  lastEventAt: Date.now() - 3 * 60_000,
  lastSyncAt: Date.now() - 3_600_000,
  syncStatus: 'done',
  syncError: null,
  sessions: 4,
}

const emptyOverview = {
  ...overview,
  total: { ...overview.total, ...mk(0, 0, 0, 0), compactions: 0, failures: 0 },
  byDay: [], byModel: [], byWorkspace: [],
  totalTokens: 0, totalCost: 0, spend: 0, subscriptionValue: 0, records: 0, files: 0,
  lastEventAt: null, lastSyncAt: null, syncStatus: 'idle', sessions: 0,
}

/* ── pricing-tab fixtures ── */
/** Pricing-tab fixture: the route cards the 价格表 tab renders. One card per
 *  route, one row per model, each carrying its price segments (生效时间 +
 *  全天价四档 + 例外时段). The states worth looking at are all here: a priced
 *  row, a 调价史, a 峰谷时段 row, 价格未知, a 仅账本 string (the config no longer
 *  lists it), a 订阅 route, and a route that only exists because the price file
 *  names it. */
const PRICING_FIXTURE = {
  routes: [
    {
      route: 'deepseek-official', label: 'DeepSeek', billing: 'metered', records: 6159,
      models: [
        { model: 'deepseek-v4-flash', configured: true, records: 322,
          // 有账本时间跨度,而且有 40 次账落在最早那段价的起点之前(计 ¥0)。D-019 之后
          // 这条事实不再上轴(轴只画区间内的调价节点),所以这一行是「首记 → 今天 + 三个
          // 节点」的样子,而那 40 次只留在行内与下方列表里。
          firstAt: Date.UTC(2026, 6, 20), lastAt: Date.UTC(2026, 8, 11), unpriced: 40,
          segments: [
          { from: '2026-08-01', inputPerMillion: 1.5, outputPerMillion: 4.5, cacheReadPerMillion: 0.15 },
          { from: '2026-09-01', inputPerMillion: 2, outputPerMillion: 6, note: '官方调价' },
          // 带峰谷时段的一段:工作日高峰另定,其余时间按全天价。
          { from: '2026-09-10T12:00', inputPerMillion: 1, outputPerMillion: 4, cacheReadPerMillion: 0.02,
            note: 'V4.1 Flash 上线,峰谷定价',
            slots: [
              { days: 'weekdays', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.04 },
              { days: 'weekdays', start: 14, end: 18, inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.04 },
            ] },
        ] },
        // 首记 08-25,最早那段却写 08-21:那个边界落在轴的区间之外,按 D-019 不上轴,
        // 所以轴上只有 09-10 一个节点(左端仍是首记,不是价段边界)。
        { model: 'deepseek-v4-flash-vision-exp', configured: true, records: 3092,
          firstAt: Date.UTC(2026, 7, 25), lastAt: Date.UTC(2026, 8, 6), unpriced: 0,
          segments: [
          { from: '2026-08-21', inputPerMillion: 1.5, outputPerMillion: 4.5, cacheWritePerMillion: 0.05 },
          { from: '2026-09-10', inputPerMillion: 1, outputPerMillion: 4, cacheWritePerMillion: 0.02 },
        ] },
        // 密集调价史:8 个节点挤在三周内(含同一天两个),用来看"节点之间的最小
        // 间隔":靠得太近的节点被摊开,8 个仍然排得下(两端钉死,轴不横向滚动)。
        { model: 'deepseek-v4.1-flash', configured: true, records: 899,
          firstAt: Date.UTC(2026, 7, 18, 2), lastAt: Date.UTC(2026, 8, 12, 6), unpriced: 0,
          segments: [
          { from: '2026-08-20', inputPerMillion: 1, outputPerMillion: 4 },
          { from: '2026-08-21', inputPerMillion: 1.2, outputPerMillion: 4.5 },
          { from: '2026-08-25', inputPerMillion: 1.5, outputPerMillion: 5 },
          { from: '2026-09-01', inputPerMillion: 1.8, outputPerMillion: 5.5 },
          { from: '2026-09-02T09:00', inputPerMillion: 2, outputPerMillion: 6 },
          { from: '2026-09-02T18:00', inputPerMillion: 2.2, outputPerMillion: 6.5 },
          { from: '2026-09-08', inputPerMillion: 2.5, outputPerMillion: 7 },
          { from: '2026-09-10', inputPerMillion: 3, outputPerMillion: 8 },
        ] },
        // 首记在生效时间之后:那个边界在区间之外、区间里没有别的调价,所以按 D-019
        // 整条轴都不画(只有首记与今天时,空轨道说不了行内四档价没说过的事)。
        { model: 'deepseek-v4-pro', configured: true, records: 2745,
          firstAt: Date.UTC(2026, 8, 5, 3), lastAt: Date.UTC(2026, 8, 11, 10), unpriced: 0,
          segments: [
          { from: '2026-09-01', inputPerMillion: 4.5, outputPerMillion: 13.5, cacheWritePerMillion: 0.15 },
        ] },
        // 账本没记过这条串(还没调用过):没有首记,轴画不出来(价段仍是无起点,
        // 这一行的时间只在行内与列表中)。
        { model: 'deepseek-flash', configured: true, records: 0, segments: [
          { from: null, inputPerMillion: 1, outputPerMillion: 4, cacheWritePerMillion: 0.02 },
        ] },
        // 有价、但账本没记过:同样没有首记,所以同样不画轴——价段自己的日期只在下方
        // 列表里出现。
        { model: 'deepseek-v4-flash-vision', configured: true, records: 0, segments: [
          { from: '2026-08-18', inputPerMillion: 1.5, outputPerMillion: 4.5 },
        ] },
      ],
    },
    {
      route: 'commandcode', label: 'commandcode', billing: 'subscription', records: 3232,
      models: [
        // 播种时无起点段按首记整点锚上(D-017):行上印「价段自 … 起」,轴上那颗点落在
        // 左端——锚定时刻就是左端本身,所以这个节点折进「首记」那个标签,不再重复一个日期。
        { model: 'deepseek/deepseek-v4-flash', configured: true, records: 2964,
          firstAt: Date.UTC(2026, 8, 6, 11, 3), lastAt: Date.UTC(2026, 8, 8, 11, 2), unpriced: 0,
          segments: [
          { from: null, inputPerMillion: 1.5, outputPerMillion: 4.5 },
        ] },
        { model: 'z-ai/glm-5.3-flash', configured: true, records: 276, segments: [] },
      ],
    },
    {
      route: 'opencode-go', label: 'OpenCode Go', billing: 'subscription', records: 2935,
      models: [
        { model: 'glm-5.3-flash', configured: true, records: 243,
          firstAt: Date.UTC(2026, 8, 5, 8, 5), lastAt: Date.UTC(2026, 8, 6, 0, 54), unpriced: 0,
          segments: [
          { from: null, inputPerMillion: 0.8, outputPerMillion: 2.8 },
        ] },
        // 没有价、但有账:整行没有价,轴上没有可画的调价,所以不画轴——「全部计 ¥0」
        // 是「价格未知」徽标的事,抽屉里也不该动用警示色。
        { model: 'mimo-v2.5', configured: true, records: 83,
          firstAt: Date.UTC(2026, 7, 17, 4), lastAt: Date.UTC(2026, 7, 17, 9), unpriced: 83,
          segments: [] },
        // 配置里已经没有这条串了,只有账本记得它:标「仅账本」,照样可定价。
        { model: 'retired-model', configured: false, records: 41,
          firstAt: Date.UTC(2026, 8, 1, 6), lastAt: Date.UTC(2026, 8, 1, 7, 30), unpriced: 41,
          segments: [] },
      ],
    },
    {
      route: 'dots-ai', label: '小红书', billing: 'metered', records: 560,
      models: [
        // 无起点段 + 完整覆盖:锚到首记整点后,轴上那颗点就落在左端(锚定时刻与左端是
        // 同一刻),不出现第二个日期(D-017 + D-019)。
        { model: 'dots3-note-prev', configured: true, records: 644,
          firstAt: Date.UTC(2026, 7, 19, 3), lastAt: Date.UTC(2026, 7, 27, 9), unpriced: 0,
          segments: [
          { from: null, inputPerMillion: 0, outputPerMillion: 0, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },
        ] },
      ],
    },
    {
      // 配置里已删掉、但账本/价格文件还记得的路由。
      route: 'private-relay', label: 'private-relay', billing: 'metered', records: 42,
      models: [
        { model: 'deepseek-v4-flash', configured: false, records: 42,
          firstAt: Date.UTC(2026, 8, 3, 2), lastAt: Date.UTC(2026, 8, 3, 4), unpriced: 0,
          segments: [
          { from: null, inputPerMillion: 1.2, outputPerMillion: 3.6, note: '自己填的中转价' },
        ] },
      ],
    },
  ],
  dataDir: 'C:\\Users\\28529\\.dsh\\tokbook',
  updatedAt: Date.now(),
}

/* The host sends each row's `now` (the segment in force at read time); the
   fixture above only writes segments, so derive it here — the preview is meant
   to show real numbers, not dashes. */
for (const card of PRICING_FIXTURE.routes) {
  for (const row of card.models) {
    const hit = nowOfSegments(row.segments)
    if (hit !== null) {
      row.now = ratesOfSegment(hit)
      row.nowFrom = hit.from
    }
  }
}

/* ── pricing writes (fixture-level) ─────────────────────────────────────── */
/**
 * The preview accepts the 价格表 tab's whole-file PUT and merges it into the
 * fixture, so the staged save and its re-seed can be exercised in the browser
 * (nothing is persisted, and the merge is a fixture approximation of the host's
 * own read path — not a reimplementation of it).
 */
const pricingState = { routes: PRICING_FIXTURE.routes }

/** The ¥/M numbers of one wire-shape segment, as the row's `now` payload. */
function ratesOfSegment(segment) {
  return {
    inputPerMillion: segment.inputPerMillion,
    outputPerMillion: segment.outputPerMillion,
    ...(segment.cacheReadPerMillion !== undefined ? { cacheReadPerMillion: segment.cacheReadPerMillion } : {}),
    ...(segment.cacheWritePerMillion !== undefined ? { cacheWritePerMillion: segment.cacheWritePerMillion } : {}),
  }
}

/** The price segment in force right now for one row, or null for 价格未知. */
function nowOfSegments(segments) {
  const today = new Date()
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  let hit = null
  for (const segment of [...segments].sort((a, b) => String(a.from ?? '').localeCompare(String(b.from ?? '')))) {
    if (segment.from === null || segment.from === undefined || segment.from <= key) hit = segment
    else break
  }
  return hit
}

function pricingView() {
  return { ...PRICING_FIXTURE, routes: pricingState.routes, updatedAt: Date.now() }
}

/** Merge a `PUT /tokbook/pricing` body (the WHOLE price file). */
function withPricingWrite(body) {
  const billing = body.$billing ?? {}
  const routes = []
  const seen = new Set()
  for (const card of pricingState.routes) {
    const models = card.models.map((row) => {
      const segments = body[card.route]?.[row.model]
      const next = segments === undefined ? [] : segments
      const hit = nowOfSegments(next)
      return {
        ...row,
        segments: next,
        now: hit === null ? undefined : ratesOfSegment(hit),
        nowFrom: hit?.from ?? null,
      }
    })
    routes.push({ ...card, billing: billing[card.route] ?? 'metered', models })
    seen.add(card.route)
  }
  // A route the catalog does not carry but the body prices: it becomes a card
  // of its own, the way the host's own view union does it.
  for (const [route, models] of Object.entries(body)) {
    if (route.startsWith('$') || seen.has(route)) continue
    routes.push({
      route,
      label: route,
      billing: billing[route] ?? 'metered',
      records: 0,
      models: Object.entries(models).map(([model, segments]) => {
        const hit = nowOfSegments(segments)
        return { model, configured: false, records: 0, segments, now: hit === null ? undefined : ratesOfSegment(hit), nowFrom: hit?.from ?? null }
      }),
    })
  }
  pricingState.routes = routes
}

/* ── quota-tab fixtures ─────────────────────────────────────────────────── */
/** Scenarios selected with ?quota=<mode> on the preview URL. */
const QUOTA_MODES = {
  /** commandcode (amount windows + usage + credits) + opencode-go (% only). */
  rich: ['commandcode', 'opencode-go'],
  /** Two ok cards with different window shapes (no usage/credits). */
  percent: ['opencode-go'],
  /** commandcode ok; opencode-go unconfigured (state chip + hint). */
  mix: ['commandcode', 'opencode-go'],
  /** Both providers unconfigured. */
  unconfigured: ['commandcode', 'opencode-go'],
  /** Both providers errored. */
  error: ['commandcode', 'opencode-go'],
  /** commandcode with a lapsed subscription (balance gate: no ring, no windows). */
  balance: ['commandcode'],
  /** commandcode pay-as-you-go (balance gate, no plan identity reported). */
  payg: ['commandcode'],
  /** opencode-go with a valid key but no Go subscription (gate none). */
  nosub: ['opencode-go'],
  /** opencode-go retired *and* first in the host list: it must sink below the
   *  active Command Code card, with the host order otherwise untouched. */
  retiredfirst: ['opencode-go', 'commandcode'],
  /** No configured providers (empty state). */
  none: [],
}
const serverState = { quota: 'rich' }

function now() { return Date.now() }

/** Quota cards keyed by provider for the selected mode. */
function quotaCards(mode) {
  const t = now()
  const commandcode = {
    plan: 'commandcode',
    title: 'GOAT',
    state: 'ok',
    account: { name: 'a285292107s' },
    planInfo: { planId: 'individual-goat', name: 'GOAT', status: 'active', periodEnd: t + 26 * 86_400_000 },
    usage: { completed: 1375, failed: 0, successRate: 100, costUsd: 6.5, tokensIn: 254_077_204, tokensOut: 1_435_790 },
    credits: { monthlyUsd: 63.5, purchasedUsd: 4.25, freeUsd: 0 },
    windows: [
      { id: 'fiveHour', label: '5 小时', usagePercent: 19.5, exceeded: false, resetAt: t + 1.3 * 3_600_000, usedUsd: 2.73, capUsd: 14 },
      { id: 'weekly', label: '本周', usagePercent: 18.6, exceeded: false, resetAt: t + 5 * 86_400_000 + 3 * 3_600_000, usedUsd: 6.5, capUsd: 35 },
    ],
    fetchedAt: t - 42_000,
  }
  const opencode = {
    plan: 'opencode-go',
    title: 'OpenCode Go',
    state: 'ok',
    windows: [
      { id: 'rolling5h', label: '5 小时', usagePercent: 58, exceeded: false, resetAt: t + 50 * 60_000 },
      { id: 'weekly', label: '本周', usagePercent: 33, exceeded: false, resetAt: t + 4 * 86_400_000 },
      { id: 'monthly', label: '本月', usagePercent: 91, exceeded: false, resetAt: t + 17 * 86_400_000 },
    ],
    fetchedAt: t - 15_000,
  }
  const unconfiguredCommand = {
    plan: 'commandcode', title: 'Command Code', state: 'unconfigured',
    message: '未找到该订阅的 API key（可配置 apiKey / apiKeyEnv，或登录官方 CLI）。',
  }
  const unconfiguredOpen = {
    plan: 'opencode-go', title: 'OpenCode Go', state: 'unconfigured',
    message: '未找到该订阅的 API key（可配置 apiKey / apiKeyEnv，或登录官方 CLI）。',
  }
  const errorCommand = {
    plan: 'commandcode', title: 'Command Code', state: 'error',
    message: '官方接口拒绝了该 key（401）——请检查 Command Code API key。',
  }
  const errorOpen = {
    plan: 'opencode-go', title: 'OpenCode Go', state: 'error',
    message: '无法连接官方接口（网络错误）。',
  }
  // A plan that ended: the API still reports the plan identity, but there is no
  // in-force subscription left, so the account is gated by its balance alone.
  const lapsedCommand = {
    plan: 'commandcode',
    title: 'GOAT',
    state: 'ok',
    gate: 'balance',
    gateNote: '订阅已于 2026-10-06 结束，现仅由余额决定可用量——5 小时 / 本周窗口只约束订阅内的月度额度，该账户不再适用。',
    account: { name: 'a285292107s' },
    planInfo: { planId: 'individual-goat', name: 'GOAT', status: 'canceled', periodEnd: t - 6 * 86_400_000 },
    usage: { completed: 1375, failed: 0, successRate: 100, costUsd: 15.14, tokensIn: 254_077_204, tokensOut: 1_435_790 },
    credits: { monthlyUsd: 0, purchasedUsd: 12.4, freeUsd: 3 },
    windows: [],
    fetchedAt: t - 42_000,
  }
  // Pay-as-you-go: no plan identity at all, which is a normal account shape —
  // the provider sells one — not an expired plan.
  const paygCommand = {
    plan: 'commandcode',
    title: 'Command Code',
    state: 'ok',
    gate: 'balance',
    gateNote: '未检测到生效中的订阅——该账户由余额决定可用量（5 小时 / 本周窗口仅约束订阅内的月度额度）。',
    account: { name: 'a285292107s' },
    credits: { monthlyUsd: 0, purchasedUsd: 28.75, freeUsd: 0 },
    windows: [],
    fetchedAt: t - 90_000,
  }
  // OpenCode Go with a valid key and no subscription: the endpoint answers 403
  // ("valid key, no Go subscription"), which is a state, not a failure — and
  // this endpoint reports no balance, so there is no number to show at all.
  const noSubOpen = {
    plan: 'opencode-go',
    title: 'OpenCode Go',
    state: 'ok',
    gate: 'none',
    gateNote: '该 key 有效，但当前没有生效中的 OpenCode Go 订阅（未订阅或已过期）——订阅后点右上角刷新即可恢复显示。',
    windows: [],
    fetchedAt: t - 30_000,
  }
  switch (mode) {
    case 'mix': return { commandcode, 'opencode-go': unconfiguredOpen }
    case 'unconfigured': return { commandcode: unconfiguredCommand, 'opencode-go': unconfiguredOpen }
    case 'error': return { commandcode: errorCommand, 'opencode-go': errorOpen }
    case 'balance': return { commandcode: lapsedCommand }
    case 'payg': return { commandcode: paygCommand }
    case 'nosub': return { 'opencode-go': noSubOpen }
    case 'retiredfirst': return { commandcode, 'opencode-go': noSubOpen }
    case 'percent': return { 'opencode-go': opencode }
    default: return { commandcode, 'opencode-go': opencode }
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/client.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' })
    res.end(clientJs)
    return
  }
  if (url.pathname === '/baseline.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' })
    res.end(baselineJs)
    return
  }
  if (url.pathname === '/tokbook/overview') {
    res.writeHead(200, { 'content-type': 'application/json' })
    const mode = process.env.TOKBOOK_MODE ?? ''
    if (mode === 'err') {
      res.end(JSON.stringify({ error: 'HTTP 500' }))
    } else {
      res.end(JSON.stringify(mode === 'empty' ? emptyOverview : overview))
    }
    return
  }
  if (url.pathname === '/tokbook/rescan') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
    return
  }
  // Pricing tab: the route-card view (GET) + the whole-file write (PUT).
  if (url.pathname === '/tokbook/pricing') {
    if (req.method === 'PUT') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body === '' ? '{}' : body)
          withPricingWrite(parsed)
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: true, view: pricingView() }))
        } catch (error) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: String(error) }))
        }
      })
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(pricingView()))
    return
  }
  // Quota tab: list (no provider) → enabled routes; per-provider → card.
  if (url.pathname === '/tokbook/quota') {
    const provider = url.searchParams.get('provider')
    res.writeHead(200, { 'content-type': 'application/json' })
    if (provider === null) {
      res.end(JSON.stringify({ providers: QUOTA_MODES[serverState.quota] ?? [] }))
    } else {
      const cards = quotaCards(serverState.quota)
      const card = cards[provider]
      if (card === undefined) {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'unknown provider' }))
      } else {
        res.end(JSON.stringify(card))
      }
    }
    return
  }
  res.writeHead(200, { 'content-type': 'text/html' })
  const quotaMode = url.searchParams.get('quota')
  if (quotaMode !== null) serverState.quota = quotaMode
  res.end(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tokbook overlay preview</title>
<style>
  html,body{margin:0;height:100%;}
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
    background:linear-gradient(180deg,#f7f8fa,#eef0f3);
  }
  body.dark{background:linear-gradient(180deg,#151517,#1c1d20);}
  .fake-app{max-width:720px;margin:0 auto;padding:32px 24px;color:#0f1115;}
  body.dark .fake-app{color:#f9fafb;}
  .fake-app h1{font-size:18px;margin:0 0 12px;}
  .fake-app p{font-size:14px;line-height:24px;color:#61666b;margin:0 0 8px;}
  body.dark .fake-app p{color:#cfd3d6;}
  /* ── DSH alias tokens, as the theme service would define them ── */
  :root{
    --dsw-alias-bg-base:#ffffff;
    --dsw-alias-bg-layer-1:#ffffff;
    --dsw-alias-bg-layer-2:#f6f7f8;
    --dsw-alias-bg-mask-1:rgb(0 0 0 / 45%);
    --dsw-alias-border-l1:rgb(0 0 0 / 8%);
    --dsw-alias-border-l2:rgb(0 0 0 / 12%);
    --dsw-alias-border-l3:rgb(0 0 0 / 16%);
    --dsw-alias-border-l4:rgb(0 0 0 / 20%);
    --dsw-alias-label-primary:#0f1115;
    --dsw-alias-label-secondary:#61666b;
    --dsw-alias-label-tertiary:#81858c;
    --dsw-alias-label-dimmed:#b4b8bc;
    --dsw-alias-label-primary-foreground:#ffffff;
    --dsw-alias-label-primary-inverted:#ffffff;
    --dsw-alias-brand-primary:#4d6bfe;
    --dsw-alias-button-primary-fill:#4d6bfe;
    --dsw-alias-button-primary-hover:#3f5ce0;
    --dsw-alias-button-ghost-active-border:rgb(0 0 0 / 14%);
    --dsw-alias-interactive-bg-hover:rgb(0 0 0 / 6%);
    --dsw-alias-interactive-bg-active:rgb(0 0 0 / 10%);
    --dsw-alias-state-success-primary:#1a7f37;
    --dsw-alias-state-warn-primary:#9a6700;
    --dsw-alias-state-error-primary:#cf222e;
    --dsw-alias-scrollbar-bg-l2:rgb(0 0 0 / 20%);
    --dsw-alias-scrollbar-hover-l2:rgb(0 0 0 / 30%);
    --dsw-alias-tooltip-bg:#0f1115;
    --dsw-elevation-prominent:0 8px 40px rgb(0 0 0 / 18%);
    --dsw-elevation-stroke-color:rgb(0 0 0 / 8%);
    --dsw-mask-blur:blur(2px);
    --dsw-corner-shape:20px;
    --ds-font-family-code:"SF Mono","JetBrains Mono",Consolas,"Liberation Mono",monospace;
  }
  body.dark{
    --dsw-alias-bg-base:#151517;
    --dsw-alias-bg-layer-1:#1c1d20;
    --dsw-alias-bg-layer-2:#26272b;
    --dsw-alias-bg-mask-1:rgb(0 0 0 / 60%);
    --dsw-alias-border-l1:rgb(255 255 255 / 10%);
    --dsw-alias-border-l2:rgb(255 255 255 / 14%);
    --dsw-alias-border-l3:rgb(255 255 255 / 18%);
    --dsw-alias-border-l4:rgb(255 255 255 / 22%);
    --dsw-alias-label-primary:#f9fafb;
    --dsw-alias-label-secondary:#cfd3d6;
    --dsw-alias-label-tertiary:#adb2b8;
    --dsw-alias-label-dimmed:#6b7075;
    --dsw-alias-label-primary-foreground:#ffffff;
    --dsw-alias-brand-primary:#7b93ff;
    --dsw-alias-button-primary-fill:#4d6bfe;
    --dsw-alias-button-primary-hover:#5d78ff;
    --dsw-alias-button-ghost-active-border:rgb(255 255 255 / 18%);
    --dsw-alias-interactive-bg-hover:rgb(255 255 255 / 8%);
    --dsw-alias-interactive-bg-active:rgb(255 255 255 / 12%);
    --dsw-alias-state-success-primary:#3fb950;
    --dsw-alias-state-warn-primary:#d29922;
    --dsw-alias-state-error-primary:#f85149;
    --dsw-alias-scrollbar-bg-l2:rgb(255 255 255 / 22%);
    --dsw-alias-scrollbar-hover-l2:rgb(255 255 255 / 32%);
    --dsw-alias-tooltip-bg:#2c2c2e;
    --dsw-elevation-prominent:0 8px 40px rgb(0 0 0 / 55%);
    --dsw-elevation-stroke-color:rgb(255 255 255 / 12%);
  }
</style>
<script>
  // ── Minimal DSH loader + slots host (preview only) ──
  window.__MOUNTED__ = [];
  window.__ModuleLoader__ = {
    load({ factory }) {
      const cache = window.__DSH_REQUIRE_CACHE__ ?? {};
      const exports = factory((name) => {
        const m = cache[name];
        if (m === undefined) throw new Error('missing baseline module: ' + name);
        return m;
      });
      window.__PLUGIN_EXPORTS__ = exports;
    },
  };
</script>
<script src="/baseline.js"></script>
<script src="/client.js"></script>
</head>
<body class="${url.searchParams.has('dark') ? 'dark' : ''}">
  <div class="fake-app">
    <h1>DSH 宿主应用（预览背景）</h1>
    <p>这是模拟的宿主界面，用于预览 dsh-tokbook 悬浮窗口。弹窗打开时这些内容应被遮罩压暗。</p>
    <p>TAB 键在弹窗打开时不应离开弹窗；ESC 或点击遮罩可关闭。</p>
  </div>
  <div id="root"></div>
  <script type="module">
    const params = new URLSearchParams(location.search);
    const mounted = window.__MOUNTED__;
    const ctx = {
      slots: {
        inject(name, callback) { callback(); return () => {}; },
        register(options, component) { mounted.push({ options, component }); return () => {}; },
      },
      // The client entry registers its cleanup hooks through ctx.effect
      // (cordis runs the returned disposer on unload). The preview never
      // unloads, so a no-op registration is all the harness needs — without it
      // apply throws and nothing mounts at all.
      effect() { return () => {}; },
    };
    window.__PLUGIN_EXPORTS__.apply(ctx);
    for (const { options, component } of mounted) {
      const ownerShare = options.name === 'sidebar.footer.action' ? { wide: true } : {};
      const share = { ...ownerShare, ...(options.inject ? options.inject(ownerShare) : {}) };
      const host = document.createElement('div');
      host.dataset.slot = options.name;
      document.getElementById('root').appendChild(host);
      window.__DSH_REQUIRE_CACHE__['react-dom/client'].createRoot(host)
        .render(window.__DSH_REQUIRE_CACHE__['react'].createElement(component, share));
    }
    // React 18 mounts concurrently, so the trigger does not exist yet when this
    // script runs and its listeners attach a beat later: look it up on every
    // attempt, and click it only while the overlay is still absent (the trigger
    // TOGGLES — a second click would close it again).
    const tabFlag = params.has('tab') ? params.get('tab') : (params.has('quota') ? 'quota' : null);
    let tries = 0;
    setTimeout(function open() {
      if (document.querySelector('.dtpl-overlay') === null) {
        const trigger = document.querySelector('[data-plugin="dsh-tokbook"]');
        if (trigger) trigger.click();
      } else if (tabFlag !== null) {
        const tabEl = document.getElementById('dtpl-tab-' + tabFlag);
        if (tabEl) { tabEl.click(); return; }
      }
      if (++tries < 25) setTimeout(open, 100);
    }, 200);
  </script>
</body>
</html>`)
})

const port = Number(process.env.PORT ?? 8931)
server.listen(port, '127.0.0.1', () => {
  console.log(`preview on http://127.0.0.1:${port}/  (?tab=ledger|provider|quota|method, ?dark=1, ?empty=1, ?err=1, ?quota=rich|percent|mix|unconfigured|error|balance|payg|nosub|retiredfirst|none)`)
})

