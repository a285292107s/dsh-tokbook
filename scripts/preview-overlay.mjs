/**
 * dsh-tokbook 浮窗的两种开发载体（dev-only，never shipped）。
 *
 * **预览模式（默认）**—— fixture 台：stubs `window.__ModuleLoader__`, provides the
 * baseline modules (react, jsx-runtime, react-dom/client) the real DSH module
 * table would inject, defines the DSH `--dsw-alias-*` tokens (light + dark),
 * stubs every route the client fetches — `/tokbook/overview`、`/tokbook/rescan`、
 * `/tokbook/usage`、`/tokbook/quota`、`/tokbook/pricing` — then mounts the REAL
 * built bundle (`lib/client.js`) through its real `apply()` path and opens the
 * overlay.
 *
 * **独立查看器模式（`--ledger [dir]`）**—— 同一个页面壳、同一份 client bundle，但
 * `/tokbook/*` 由**真的 host 插件**作答：`lib/index.js` 的 `TokenUsageBook` 挂在本
 * 进程的 cordis 根 context 上（DSH 自己的测试也这么起根 ctx），经一个 5 行的
 * `webServer` shim 注册路由，直接读本机账本目录（省略 `dir` 用插件自己的默认值：
 * `$DSH_HOME/tokbook`，否则 `~/.dsh/tokbook`）。不提供 `sessionPersistence`，所以它
 * **只看已入账的历史**——「重新扫描」回报 skipped，不摄取新会话。
 *
 * **fixture 清单要跟着 client 一起改。** client 换数据源时（例如通道用量 tab 从总览
 * payload 改成自己的 `/tokbook/usage`），漏掉一路 fixture 不会报错——那一 tab 会
 * 落到 HTML 兜底、以「加载失败：Unexpected token '<'」的形式出现在界面上。这条只在
 * 预览模式成立：独立查看器不看 fixture。
 *
 * Query flags: ?dark=1 dark skin, ?tab=ledger|provider|quota|method,
 * ?quota=rich|percent|mix|unconfigured|error|balance|payg|nosub|retiredfirst|none quota-tab
 * fixture + auto-switch to the quota tab.
 *
 * The overview fixture shape is picked by the **TOKBOOK_MODE env var** (`empty` / `err`), not
 * by a query flag: the payload is served by the same process that renders the page, so one
 * server = one mode. Restart with the env set to look at those two states.
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/** `--ledger [dir]` 切到独立查看器模式（见文件头）；省略 dir 用插件自己的默认数据目录。 */
const argv = process.argv.slice(2)
const ledgerIndex = argv.findIndex((arg) => arg === '--ledger' || arg.startsWith('--ledger='))
const LEDGER = ledgerIndex !== -1
const ledgerValue = !LEDGER
  ? undefined
  : argv[ledgerIndex].startsWith('--ledger=')
    ? argv[ledgerIndex].slice('--ledger='.length)
    : argv[ledgerIndex + 1]
const ledgerDir = ledgerValue === undefined || ledgerValue === '' || ledgerValue.startsWith('--')
  ? undefined
  : ledgerValue

/** lib/ 是构建产物：两个半区都在启动时读一次（`pnpm build` 之后要重启本进程）。 */
let clientJs
try {
  clientJs = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
} catch {
  console.error('缺少 lib/client.js —— 先跑 pnpm build')
  process.exit(1)
}

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

/* ── 独立查看器：真 host 插件挂在真 cordis 根 context 上 ───────────────────── */

/**
 * 独立查看器不用 fixture：把 `lib/index.js` 的 `TokenUsageBook` 挂在根 context 上，
 * 只补它要的 `webServer` 服务。本插件把那个缝缩成了 `register({kind,path,handler})`
 * （`src/routes.ts` 的 `WebServerLike`），所以 shim 就是一张 path → handler 的表，
 * node:http 按 pathname 派发。缺席的 `sessionPersistence` 让 `ensureFresh()` 立即
 * 返回、`rescan()` 回报 skipped——只看已入账的历史，不摄取新会话。
 */
const ledgerRoutes = new Map()
if (LEDGER) {
  let host
  try {
    host = await import(pathToFileURL(join(root, 'lib', 'index.js')).href)
  } catch (error) {
    console.error(`无法载入 lib/index.js（${String(error)}）—— 先跑 pnpm build`)
    process.exit(1)
  }
  const { Context } = await import('@deepseek-ai/cordis')
  const ctx = new Context()
  ctx.provide('webServer', {
    register(route) {
      ledgerRoutes.set(route.path, route.handler)
      return () => { ledgerRoutes.delete(route.path) }
    },
  })
  ctx.plugin(host.default, ledgerDir === undefined ? {} : { path: ledgerDir })
}

/** Deterministic-ish daily rows for the last 14 days. */
function days(n) {
  const rows = []
  const base = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86_400_000)
    const day = d.toISOString().slice(0, 10)
    const seed = (i * 73) % 100
    const inputTokens = 40_000 + seed * 3_100
    const outputTokens = 9_000 + seed * 820
    const cacheReadTokens = 120_000 + seed * 21_000
    const tokens = inputTokens + cacheReadTokens + outputTokens
    rows.push({
      day,
      totals: {
        requests: 8 + (seed % 17),
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens: 0,
        compactions: seed % 5 === 0 ? 1 : 0,
        failures: seed % 7 === 0 ? 1 : 0,
        usageUnknown: seed % 3 === 0 ? 1 : 0,
      },
      // 今日（最后一行）两个桶都非零，所以 hero 的两条金额行都能看到；其余日子
      // 有一部分是纯按量日（订阅桶为 0），用来看「只列非零桶」那条规则。
      spend: Math.round((tokens / 2_400_000) * 100) / 100,
      subscriptionValue: seed % 3 === 0 ? Math.round((tokens / 6_000_000) * 100) / 100 : 0,
    })
  }
  return rows
}

const mk = (inputTokens, cacheReadTokens, outputTokens, requests = 1) => ({
  requests, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens: 0,
})

const overview = {
  total: { requests: 214, ...mk(1_920_000, 6_310_000, 486_000, 214), compactions: 6, failures: 3, usageUnknown: 5 },
  byDay: days(14),
  byHour: [],
  // 按模型 / 按工作区**不在这里**：两者是窗口的切法，随 `/tokbook/usage` 走
  // （见下面的 USAGE_CARDS）——用量明细 tab 的三种切法读的是同一批窗口记录。
  rateRows: [],
  dataDir: 'C:\\Users\\28529\\.dsh\\tokbook',
  totalCost: 8.59,
  spend: 4.99,
  subscriptionValue: 3.6,
  // 非空：这条注记（含「去定价」入口）是概览的口径声明之一，预览要能看到它。
  unpricedModels: ['mimo-v2.5', 'retired-model'],
  pricing: {},
  totalTokens: 10_714_000,
  currency: 'CNY',
  usdExchangeRate: 7.2,
  updatedAt: Date.now() - 60_000,
  records: 214,
  files: 9,
  lastEventAt: Date.now() - 3 * 60_000,
  syncStatus: 'done',
  syncError: null,
}

const emptyOverview = {
  ...overview,
  total: { ...overview.total, ...mk(0, 0, 0, 0), compactions: 0, failures: 0, usageUnknown: 0 },
  byDay: [],
  totalTokens: 0, totalCost: 0, spend: 0, subscriptionValue: 0, records: 0, files: 0,
  lastEventAt: null, syncStatus: 'idle', syncError: null,
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

/* ── 用量明细 tab fixtures ─────────────────────────────────────────────── */
/**
 * `GET /tokbook/usage?range=…` —— 同一批窗口记录的**三种切法**：按模型（各卡模型
 * 行摊平）、按工作区、按通道（卡）。窗口边界是 host 侧的事实，预览不复刻，只让五个
 * 窗口落在**看得见差别**的状态上：今日是一张小按量卡，昨天多一张订阅卡，两个长窗口
 * 才是全集——外加卡片能报的两种降级事实（价格未知模型、没上报用量的调用）。
 */
const usageModel = (model, tokens, { spend = 0, value = 0, requests = 1, billing } = {}) => ({
  model,
  totals: {
    requests, compactions: 0, failures: 0, usageUnknown: 0,
    inputTokens: Math.round(tokens * 0.18), outputTokens: Math.round(tokens * 0.07),
    cacheReadTokens: Math.round(tokens * 0.75), cacheWriteTokens: 0,
  },
  tokens,
  cost: spend + value,
  spend,
  subscriptionValue: value,
  ...(billing === undefined ? {} : { billing }),
})

const usageCard = (provider, models, extra = {}) => ({
  provider,
  tokens: models.reduce((sum, m) => sum + m.tokens, 0),
  cost: models.reduce((sum, m) => sum + m.cost, 0),
  spend: models.reduce((sum, m) => sum + m.spend, 0),
  subscriptionValue: models.reduce((sum, m) => sum + m.subscriptionValue, 0),
  unpricedModels: [],
  models,
  requests: models.reduce((sum, m) => sum + m.totals.requests, 0),
  compactions: 0,
  usageUnknown: 0,
  ...extra,
})

/** 合法的 `range` 值，与 host 的 `PROVIDER_RANGES` 一致（预览是独立 .mjs，不能 import src 的 .ts）。 */
const RANGE_IDS = ['today', 'yesterday', 'last7', 'last30', 'all']

/** 按工作区那一面的 fixture 行（tokens = 四桶之和）。第一行故意跨两条计费性质的路由
 *  （实际支出 + 订阅价值同时非零），因为工作区不像模型行那样被限定在单个金额桶里；
 *  收尾的「未归属」（id ''）是对账行。窗口越短，可见的行越少。 */
const WORKSPACE_ROWS = [
  { id: 'w-harness', title: 'deepseek-harness', path: 'C:\\Users\\28529\\Desktop\\deepseek-harness', totals: { ...mk(1_510_000, 6_100_000, 402_000, 198), failures: 2 }, tokens: 8_012_000, spend: 3.87, subscriptionValue: 1.2, lastAt: Date.now() - 3 * 60_000 },
  { id: 'w-wiki', title: 'zzz wiki', path: 'C:\\Users\\28529\\Desktop\\zzz wiki', totals: mk(800_000, 900_000, 120_000, 34), tokens: 1_820_000, spend: 0, subscriptionValue: 2.4, lastAt: Date.now() - 5 * 3_600_000 },
  { id: 'w-plugins', title: 'dsh-plugins', path: 'C:\\Users\\28529\\Desktop\\dsh-plugins', totals: mk(410_000, 210_000, 84_000, 16), tokens: 704_000, spend: 1.12, subscriptionValue: 0, lastAt: Date.now() - 26 * 3_600_000 },
  { id: '', title: '未归属', path: '', totals: mk(50_000, 120_000, 8_000, 7), tokens: 178_000, spend: 0, subscriptionValue: 0, lastAt: Date.now() - 40 * 60_000 },
]

const USAGE_CARDS = {
  today: [
    usageCard('deepseek', [
      usageModel('deepseek-v4-flash', 1_420_000, { spend: 0.68, requests: 34 }),
      usageModel('deepseek-reasoner', 96_000, { spend: 0.15, requests: 4 }),
    ]),
  ],
  yesterday: [
    usageCard('deepseek', [
      usageModel('deepseek-v4-flash', 2_180_000, { spend: 1.04, requests: 51 }),
    ]),
    usageCard('commandcode', [
      usageModel('deepseek/deepseek-v4-flash', 1_640_000, { value: 1.22, requests: 62, billing: 'subscription' }),
    ]),
  ],
  last7: [
    usageCard('deepseek', [
      usageModel('deepseek-v4-flash', 8_012_000, { spend: 3.87, requests: 198 }),
      usageModel('deepseek-reasoner', 704_000, { spend: 1.12, requests: 16 }),
    ]),
    usageCard('commandcode', [
      usageModel('deepseek/deepseek-v4-flash', 6_840_000, { value: 5.1, requests: 240, billing: 'subscription' }),
      usageModel('z-ai/glm-5.3-flash', 412_000, { value: 0.31, requests: 22, billing: 'subscription' }),
    ], { usageUnknown: 2 }),
    // 这张卡同时带「价格未知」与「没上报用量」两种降级事实，因为一条 route 上
    // 两者可以并存（未定价的新模型 + 中途取消的请求）。
    usageCard('opencode-go', [
      usageModel('glm-5.3-flash', 1_820_000, { value: 2.4, requests: 34, billing: 'subscription' }),
      usageModel('mimo-v2.5', 178_000, { requests: 7, billing: 'subscription' }),
    ], { unpricedModels: ['mimo-v2.5'], usageUnknown: 1 }),
  ],
}
USAGE_CARDS.last30 = USAGE_CARDS.last7
/** 全账本：与近 30 天同一批卡（fixture 不造第五份数据），窗口词仍不同。 */
USAGE_CARDS.all = USAGE_CARDS.last30

const USAGE_LABELS = { deepseek: 'DeepSeek', commandcode: 'Command Code', 'opencode-go': 'OpenCode Go' }

/** 窗口 → 可见的工作区行数（越短的窗口越少行——与卡片那一面同步收窄）。 */
const WORKSPACES_BY_RANGE = { today: 2, yesterday: 2, last7: 4, last30: 4, all: 4 }

/** 按模型那一面 = 各卡模型行摊平（与 host 的 `modelRowsOf` 同源），所以三种切法的合计相等。
 *  **故意倒着摊**（不按任何键排）：模型清单按词元降序是**展示层**的事，这份乱序 fixture 正好
 *  证明排序真的发生在那里。 */
function modelRows(cards) {
  return cards.slice().reverse().flatMap((card) => card.models.map((model) => ({
    provider: card.provider,
    model: model.model,
    totals: model.totals,
    cost: model.cost,
    spend: model.spend,
    subscriptionValue: model.subscriptionValue,
  })))
}

function usageView(range) {
  const providers = USAGE_CARDS[range] ?? []
  return {
    range,
    fromDay: range === 'all' ? '' : '2026-08-16',
    toDay: '2026-09-14',
    updatedAt: Date.now(),
    providerLabels: USAGE_LABELS,
    // 页头「窗口合计」四个数：与按模型 / 按通道同源（host 侧就是各卡求和）。
    totalTokens: providers.reduce((sum, card) => sum + card.tokens, 0),
    totalRequests: providers.reduce((sum, card) => sum + card.requests, 0),
    totalSpend: providers.reduce((sum, card) => sum + card.spend, 0),
    totalSubscriptionValue: providers.reduce((sum, card) => sum + card.subscriptionValue, 0),
    byModel: modelRows(providers),
    byWorkspace: WORKSPACE_ROWS.slice(0, WORKSPACES_BY_RANGE[range] ?? 0),
    providers,
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
  // 独立查看器：`/tokbook/*` 一律由真插件注册的 handler 作答；真插件没注册的
  // `/tokbook/*` 显式 404，免得 client 拿到 HTML 兜底、把「Unexpected token '<'」
  // 报成加载失败。
  if (LEDGER) {
    const handler = ledgerRoutes.get(url.pathname)
    if (handler !== undefined) {
      Promise.resolve(handler(req, res)).catch((error) => {
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end(String(error))
      })
      return
    }
    if (url.pathname.startsWith('/tokbook/')) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: `no host route for ${url.pathname}` }))
      return
    }
  }

  /* ── fixture 路由：只服务预览模式（独立查看器在上面就返回了，走不到这里） ── */
  if (url.pathname === '/tokbook/overview') {
    const mode = process.env.TOKBOOK_MODE ?? ''
    if (mode === 'err') {
      /* 真 host 的失败是 **500 + 错误体**（`src/routes.ts` 的 catch）。这里必须跟着回 500：
         回 200 + `{error}` 会让客户端把它当成一份合法总览去渲染（`byDay.find` 抛错、整个浮窗
         消失），而那个形状真 host 从不发送——预览台的 err 模式反而看不见真正的错误界面。 */
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'HTTP 500' }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(mode === 'empty' ? emptyOverview : overview))
    return
  }
  if (url.pathname === '/tokbook/rescan') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
    return
  }
  // 通道用量 tab：`?range=` 是唯一入参，非法/缺失就照 host 的 400 回。
  if (url.pathname === '/tokbook/usage') {
    const range = url.searchParams.get('range')
    const ok = RANGE_IDS.includes(range)
    res.writeHead(ok ? 200 : 400, { 'content-type': 'application/json' })
    res.end(JSON.stringify(ok ? usageView(range) : { error: 'unknown or missing "range"' }))
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
  // 独立查看器的背景文字直说这个进程在读什么——免得把真账本当预览 fixture 看。
  const backdrop = LEDGER
    ? `<h1>dsh-tokbook — 独立查看器</h1>
    <p>直接读本机账本目录（不摄取会话日志）。数据目录见浮窗的「统计口径」tab。</p>
    <p>ESC 或点击遮罩关闭浮窗；关闭后点左下角的按钮可重新打开。</p>`
    : `<h1>DSH 宿主应用（预览背景）</h1>
    <p>这是模拟的宿主界面，用于预览 dsh-tokbook 悬浮窗口。弹窗打开时这些内容应被遮罩压暗。</p>
    <p>TAB 键在弹窗打开时不应离开弹窗；ESC 或点击遮罩可关闭。</p>`
  res.end(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${LEDGER ? 'tokbook 账本查看器' : 'tokbook overlay preview'}</title>
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
    ${backdrop}
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
  if (LEDGER) {
    console.log(`tokbook 独立查看器 on http://127.0.0.1:${port}/ —— 账本目录：${ledgerDir ?? '默认（$DSH_HOME/tokbook，否则 ~/.dsh/tokbook）'}`)
    return
  }
  console.log(`preview on http://127.0.0.1:${port}/  (?tab=ledger|provider|quota|method, ?dark=1, ?quota=rich|percent|mix|unconfigured|error|balance|payg|nosub|retiredfirst|none)`)
  console.log(`  总览的空 / 错两种形状由 **环境变量** 选（一个服务 = 一种形状）：TOKBOOK_MODE=empty|err；账本目录同样由 PORT / TOKBOOK_MODE 所在的进程定。`)
})

