/**
 * dsh-tokbook 浮窗的两种开发载体（dev-only，never shipped）。
 *
 * **预览模式（默认）**—— fixture 台：stubs `window.__ModuleLoader__`, provides the
 * baseline modules (react, jsx-runtime, react-dom/client) the real DSH module
 * table would inject, defines the DSH `--dsw-alias-*` tokens (light + dark),
 * stubs every route the client fetches（六个 `ROUTE_*`，路径从 `src/route-paths.ts` 取）,
 * then mounts the REAL
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
 * **fixture 清单要跟着 client 一起改。** 路径不是手抄的（六个 `ROUTE_*` 从
 * `src/route-paths.ts` import，路径写错这件事因此不存在），但**每一路载荷**是手写的：
 * client 换数据源时（例如通道用量 tab 从总览 payload 改成自己的 `ROUTE_USAGE`），漏掉
 * 一路 fixture 不会报错。为了让它别报成一句指错方向的话，未知的 `/tokbook/*` 在这里
 * **显式 404**——落到页面 HTML 会让 client 报「Unexpected token '<'」，既不说缺的是
 * 哪一路，也不说缺在预览台。这条只在预览模式成立：独立查看器由真 host 作答。
 *
 * Query flags: ?dark=1 dark skin, ?tab=ledger|quota|pricing|method（值就是 tab 的 id
 * 后缀，见 LedgerOverlay 的 `dtpl-tab-*`）,
 * ?quota=rich|percent|mix|unconfigured|error|balance|payg|nosub|retiredfirst|none quota-tab
 * fixture + auto-switch to the quota tab.
 *
 * 无头校验（playwright 等）在导航前设 `window.__PREVIEW_NO_AUTO = true` 可关掉那个
 * auto-open 循环：它每 100ms 点一次，会跟校验脚本自己的点击抢，而且只认 URL 上的 ?tab=，
 * 顺序点好几个面时对不上。
 *
 * 整台的形状由 **TOKBOOK_MODE 环境变量**选（不是 query flag），一个进程 = 一种形状：
 * `empty` 四路都空（概览 / 用量明细 / 订阅额度 / 价格表各自的空态），`err` 四路都回
 * 500（照 host 的 catch 形状），`sync` / `syncerr` 是诊断带的两态——屏上停在
 * 「正在重新扫描…」与「上次重新扫描失败：…」。要看另一种就换 env 重启。
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { QUERY_PROVIDER, QUERY_RANGE, ROUTE_OVERVIEW, ROUTE_PRICING, ROUTE_QUOTA, ROUTE_RESCAN, ROUTE_SYNC, ROUTE_USAGE } from '../src/route-paths.ts'
import { PROVIDER_RANGES } from '../src/types.ts'

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

/** 整台的形状（`empty` / `err` / `sync` / `syncerr`，见文件头）：一个进程一种形状，
 *  所以在这里读一次而不是按请求读。 */
const MODE = process.env.TOKBOOK_MODE ?? ''

/** `lib/` 是构建产物。client 半区**按请求读盘**（见下），这里读一次只为在没构建时
 *  给出那句有用的报错，并作为读盘失败时的退路。 */
const clientPath = join(root, 'lib', 'client.js')
let clientJs
try {
  clientJs = readFileSync(clientPath, 'utf8')
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

/** `YYYY-MM-DD`，**本地日**：与 `localDayKey()` 同源。此前这里走 `toISOString()`（UTC 日），
 *  于是 UTC+8 的凌晨那几小时里「今天」那一行会落到前一天——hero 因此整块归零，
 *  预览看不到有数据的样子。日期键是 UI 的口径，fixture 必须照它算。 */
function localDay(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Deterministic-ish daily rows for the last 14 days. */
function days(n) {
  const rows = []
  const base = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86_400_000)
    const day = localDay(d)
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

/**
 * 概览载荷。**键集合与 `TokBookOverview`（`src/types.ts`）逐字对齐**：host 发的是
 * `src/index.ts` 那次瘦身后的形状（omit 掉 pricing / rateRows / byHour / byModel /
 * unpricedModels）。这里此前多带了几个 host 从不发的键（byHour、rateRows、pricing、
 * currency、usdExchangeRate）——多一个键听着无害，实际是把一整类 bug 藏起来：client 若
 * 读了一个**只在 preview 里存在**的键，这里一切正常，到真宿主才炸。fixture 只端 host
 * 端得出来的形状。
 *
 * 按模型 / 按工作区**不在这里**：两者是窗口的切法，随 `ROUTE_USAGE` 走（见下面的
 * USAGE_CARDS）；价格未知同理只在用量明细的通道卡与价格表里可见。
 */
const overview = {
  total: { requests: 214, ...mk(1_920_000, 6_310_000, 486_000, 214), compactions: 6, failures: 3, usageUnknown: 5 },
  byDay: days(14),
  dataDir: 'C:\\Users\\28529\\.dsh\\tokbook',
  totalCost: 8.59,
  spend: 4.99,
  subscriptionValue: 3.6,
  totalTokens: 10_714_000,
  updatedAt: Date.now() - 60_000,
  records: 214,
  lastEventAt: Date.now() - 3 * 60_000,
  syncStatus: 'done',
  syncError: null,
}

const emptyOverview = {
  ...overview,
  total: { ...overview.total, ...mk(0, 0, 0, 0), compactions: 0, failures: 0, usageUnknown: 0 },
  byDay: [],
  totalTokens: 0, totalCost: 0, spend: 0, subscriptionValue: 0, records: 0,
  lastEventAt: null, syncStatus: 'idle', syncError: null,
}

/** 诊断带的两态（`TOKBOOK_MODE=sync|syncerr`）。此前这四处界面分支在预览台里
 *  **完全够不着**：概览恒报 `done`，探针也恒答 `done`——而「正在重新扫描…」与
 *  「上次重新扫描失败：…」正是数据变旧时用户唯一会读到的两句话。 */
const runningOverview = { ...overview, syncStatus: 'running' }
const syncErrorText = 'EACCES: permission denied, scandir C:\\Users\\28529\\.dsh\\sessions'
const syncErrOverview = { ...overview, syncStatus: 'error', syncError: syncErrorText }

/* ── pricing-tab fixtures ── */
/** Pricing-tab fixture: the route cards the 价格表 tab renders. One card per
 *  route, one row per model, each carrying its **current price** (基准价四档 +
 *  例外时段). The states worth looking at are all here: 有价（含峰谷时段）,
 *  价格未知（整行没有价）, 有价但 host 报出折算不出的记录（按美元报价却没设汇率
 *  那种，行上带「价格未知」）, a configured:false string (the config no longer
 *  lists it), a 订阅 route, a 0 价 route, and a route that only exists because
 *  the price file names it.
 *
 *  每张卡的 `records` 必须**等于该卡各行之和**：host 用同一次折叠同时算出这两个
 *  数（`ledgerUsageOf`），单独编一个总量会端出 host 产不出的形状——卡片头上写着
 *  「N 次请求」，下面各行的数加起来却是另一个数。 */
const PRICING_FIXTURE = {
  routes: [
    {
      route: 'deepseek-official', label: 'DeepSeek', billing: 'metered', records: 7058,
      models: [
        // 带峰谷时段的一条：工作日高峰另定，其余时间按基准价。
        { model: 'deepseek-v4-flash', configured: true, records: 322, unpriced: 0,
          price: { inputPerMillion: 1, outputPerMillion: 4, cacheReadPerMillion: 0.02,
            slots: [
              { days: 'weekdays', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.04 },
              { days: 'workdays', start: 14, end: 18, inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.04 },
            ] } },
        // 只重述输出价的一条时段（留空的档沿用基准价）。
        { model: 'deepseek-v4-flash-vision-exp', configured: true, records: 3092, unpriced: 0,
          price: { inputPerMillion: 1.5, outputPerMillion: 4.5, cacheWritePerMillion: 0.05,
            slots: [{ days: 'weekends', start: 0, end: 24, outputPerMillion: 6 }] } },
        // **有价、行上仍带「价格未知」**：host 报出这些记录折算不出金额——生产里唯一的来路是
        // 「按美元报价却没设汇率」的通道（换算表里整条被丢）。价位仍在，读作 ¥0 的那些记录不算在内。
        { model: 'deepseek-v4.1-flash', configured: true, records: 899, unpriced: 12,
          price: { inputPerMillion: 3, outputPerMillion: 8 } },
        // 目录给了展示名:身份行随之走比例体(精确串才走等宽),而且它**没有徽标**——
        // 正是「有没有名字」与「有没有徽章」必须分开判的那一格(见 styles/pricing 的 [data-exact])。
        { model: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', configured: true, records: 2745, unpriced: 0,
          price: { inputPerMillion: 4.5, outputPerMillion: 13.5, cacheWritePerMillion: 0.15 } },
        // 账本没记过这条串(还没调用过):有价就有四个数字,记录数为「没记过」。
        { model: 'deepseek-flash', configured: true, records: 0, unpriced: 0,
          price: { inputPerMillion: 1, outputPerMillion: 4, cacheWritePerMillion: 0.02 } },
        // 有价、但账本没记过。
        { model: 'deepseek-v4-flash-vision', configured: true, records: 0, unpriced: 0,
          price: { inputPerMillion: 1.5, outputPerMillion: 4.5 } },
        // 没有价:四格是「—」,行读作价格未知(它的记录按 ¥0 计)。
        { model: 'deepseek-v4.2-flash-preview', configured: true, records: 0, unpriced: 0 },
      ],
    },
    {
      // **按美元报价的通道**（`$currency`）：价里的数就是厂商给的美元价，人民币金额由 `$fx`
      // 折出来。这一条让「美元报价 + 人民币计价」两件事同时可看、可点。
      route: 'commandcode', label: 'commandcode', billing: 'subscription', currency: 'USD', records: 3240,
      models: [
        // **最长的一个身份串**（命名空间前缀 + 长版本串）：上一版在这种行上会把徽章挤到第二行。
        // 现在身份行只有名字（整列宽都归它）；这行本身已无判定可说（峰谷与不在配置都不再上模型行）。
        { model: 'deepseek/deepseek-v4-flash', configured: false, records: 2964, unpriced: 0,
          price: { inputPerMillion: 0.14, outputPerMillion: 0.56, cacheReadPerMillion: 0.0028,
            slots: [
              { days: 'weekdays', start: 9, end: 12, inputPerMillion: 0.28, outputPerMillion: 1.12, cacheReadPerMillion: 0.0056 },
            ] } },
        { model: 'z-ai/glm-5.3-flash', configured: true, records: 276, unpriced: 276 },
      ],
    },
    {
      route: 'dots-ai', label: '小红书', billing: 'metered', records: 644,
      models: [
        // 一条 0 价的价:金额量出来就是 0.00,不是「价格未知」。
        { model: 'dots3-note-prev', configured: true, records: 644, unpriced: 0,
          price: { inputPerMillion: 0, outputPerMillion: 0, cacheReadPerMillion: 0, cacheWritePerMillion: 0 } },
      ],
    },
    {
      route: 'opencode-go', label: 'OpenCode Go', billing: 'subscription', records: 367,
      models: [
        { model: 'glm-5.3-flash', configured: true, records: 243, unpriced: 0,
          price: { inputPerMillion: 0.8, outputPerMillion: 2.8 } },
        // 没有价、但有账:整行没有价,写不出去的记录按 ¥0 计——「全部计 ¥0」是「价格未知」
        // 徽标的事,界面里也不该动用警示色。
        { model: 'mimo-v2.5', configured: true, records: 83, unpriced: 83 },
        // 配置里已经没有这条串了,只有账本记得它:界面上不再播报这个身份事实,照样可定价。
        { model: 'retired-model', configured: false, records: 41, unpriced: 41 },
        // 没有价、账本也从没调用过它:刚加进配置、还没定价的一条串。行上四个格子是「—」,
        // 判定带说的是「还没有价」——而不是「它的请求都按 ¥0 记」(那些请求不存在,那是一句假话)。
        { model: 'glm-5.4-air', configured: true, records: 0, unpriced: 0 },
      ],
    },
    {
      // 配置里已删掉、但账本/价格文件还记得的路由。
      route: 'private-relay', label: 'private-relay', billing: 'metered', records: 42,
      models: [
        { model: 'deepseek-v4-flash', configured: false, records: 42, unpriced: 0,
          price: { inputPerMillion: 1.2, outputPerMillion: 3.6 } },
      ],
    },
  ],
  // 年历只收录了去年：今年的安排还没公布——**缺年**是这套数据唯一要人记得补的状态，
  // 所以 fixture 默认就停在它上面（头里那句告警 + 一颗「补上」都看得见）。
  calendar: {
    2025: [
      { start: '2025-01-28', end: '2025-02-04' },
      { start: '2025-10-01', end: '2025-10-08' },
    ],
  },
  calendarMissing: ['2026'],
  // 汇率（`$fx`）：价格表的美元读写面靠它换算。默认给一个真值，好让「切到美元看四档价」
  // 这条路径一打开就在；把它清空就是「未设汇率」那一态（美元开关停用）。
  fx: { cnyPerUsd: 7.15 },
  dataDir: 'C:\\Users\\28529\\.dsh\\tokbook',
  updatedAt: Date.now(),
}

/* ── pricing writes (fixture-level) ─────────────────────────────────────── */
/**
 * The preview accepts the 价格表 tab's whole-file PUT and merges it into the
 * fixture, so the staged save and its re-seed can be exercised in the browser
 * (nothing is persisted, and the merge is a fixture approximation of the host's
 * own read path — not a reimplementation of it).
 */
const pricingState = {
  routes: PRICING_FIXTURE.routes,
  calendar: PRICING_FIXTURE.calendar,
  // 汇率与年历同档：PUT 整体替换它（清空 → `$fx` 被省掉 → 这里成为 undefined，正是
  // 「未设汇率」在 wire 上的样子）。
  fx: PRICING_FIXTURE.fx,
}

function pricingView() {
  return {
    ...PRICING_FIXTURE,
    // 报价币种在 host 的 wire 上逐卡必有（缺席 = 人民币）；fixture 里只给美元那条标出来，
    // 其余的在这里补默认，端出的形状与 host 一致。
    routes: pricingState.routes.map((card) => ({ currency: 'CNY', ...card })),
    calendar: pricingState.calendar,
    fx: pricingState.fx,
    // 年历写进来的年份就不再是缺的（host 那条「账本覆盖到而年历没有」的规则，这里按同一形状答）。
    calendarMissing: PRICING_FIXTURE.calendarMissing.filter((year) => pricingState.calendar[year] === undefined),
    updatedAt: Date.now(),
  }
}

/** Merge a `PUT /tokbook/pricing` body (the WHOLE price file). */
function withPricingWrite(body) {
  const billing = body.$billing ?? {}
  const currency = body.$currency ?? {}
  const usd = (route) => (currency[route] === 'USD' ? 'USD' : 'CNY')
  const routes = []
  const seen = new Set()
  for (const card of pricingState.routes) {
    const models = card.models.map((row) => {
      const price = body[card.route]?.[row.model]
      // 没写这份价的那些行在 host 上就是「没有价」——wire 上省略 `price`。
      return { ...row, price: price === undefined ? undefined : price }
    })
    routes.push({ ...card, billing: billing[card.route] ?? 'metered', currency: usd(card.route), models })
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
      currency: usd(route),
      records: 0,
      models: Object.entries(models).map(([model, price]) => ({ model, configured: false, records: 0, price })),
    })
  }
  pricingState.routes = routes
  // 年历随同一笔 PUT 整体替换（空 = 客户端把 `$calendar` 省了，此时年历真的空了）。
  pricingState.calendar = body.$calendar ?? {}
  // 汇率同理：客户端只在汇率可写时才带上 `$fx`，省掉就是「未设汇率」。
  pricingState.fx = body.$fx
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

/** 空窗口（`TOKBOOK_MODE=empty`）：三种切法一行都没有 → 用量明细自己的空态。 */
function emptyUsageView(range) {
  return {
    ...usageView(range),
    totalTokens: 0, totalRequests: 0, totalSpend: 0, totalSubscriptionValue: 0,
    byModel: [], byWorkspace: [], providers: [],
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/client.js') {
    /* **按请求读盘**：此前在启动时快照一次，于是 `pnpm build` 之后必须重启本进程才看得见
       新 bundle——这条坑曾被读成「改动没生效」，还额外被浏览器缓存放大过一次。读失败
       （build 正在写那个文件）就沿用上一次的好副本，不拿一个读到一半的 bundle 去糊页面。 */
    try {
      const fresh = readFileSync(clientPath, 'utf8')
      if (fresh !== clientJs) console.log('[preview] lib/client.js 变了，已在服务新构建产物')
      clientJs = fresh
    } catch { /* build 正在写：沿用上一次的好副本 */ }
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' })
    res.end(clientJs)
    return
  }
  if (url.pathname === '/baseline.js') {
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' })
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

  /* ── fixture 路由：只服务预览模式（独立查看器在上面就返回了，走不到这里） ──
     路径全部从 `src/route-paths.ts` 取，所以「host / client 换了路径、预览台还在照着旧
     字符串 stub」这件事不可能发生。`MODE` 的四种形状在这里同时作用在四路上。 */
  if (url.pathname === ROUTE_OVERVIEW) {
    if (MODE === 'err') {
      /* 真 host 的失败是 **500 + 错误体**（`src/routes.ts` 的 catch）。这里必须跟着回 500：
         回 200 + `{error}` 会让客户端把它当成一份合法总览去渲染（`byDay.find` 抛错、整个浮窗
         消失），而那个形状真 host 从不发送——预览台的 err 模式反而看不见真正的错误界面。 */
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'HTTP 500' }))
      return
    }
    const body = MODE === 'empty' ? emptyOverview
      : MODE === 'sync' ? runningOverview
        : MODE === 'syncerr' ? syncErrOverview
          : overview
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
    return
  }
  if (url.pathname === ROUTE_SYNC) {
    // 预览台没有真的在跑的 walk：探针照 host 的形状答。`sync` / `syncerr` 让它答
    // running / error——client 的追同步循环（500ms × 60 次后放弃）与诊断带因此可达。
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      status: MODE === 'sync' ? 'running' : MODE === 'syncerr' ? 'error' : 'done',
      error: MODE === 'syncerr' ? syncErrorText : null,
      lastSyncAt: null,
    }))
    return
  }
  if (url.pathname === ROUTE_RESCAN) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
    return
  }
  // 通道用量 tab：`?range=` 是唯一入参，非法/缺失就照 host 的 400 回。
  if (url.pathname === ROUTE_USAGE) {
    const range = url.searchParams.get(QUERY_RANGE)
    if (!(PROVIDER_RANGES as readonly string[]).includes(range ?? '')) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'unknown or missing "range"; expected one of ' + PROVIDER_RANGES.join(', ') }))
      return
    }
    if (MODE === 'err') {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'HTTP 500' }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(MODE === 'empty' ? emptyUsageView(range) : usageView(range)))
    return
  }
  // Pricing tab: the route-card view (GET) + the whole-file write (PUT).
  if (url.pathname === ROUTE_PRICING) {
    if (req.method === 'PUT') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body === '' ? '{}' : body)
          withPricingWrite(parsed)
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch (error) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: String(error) }))
        }
      })
      return
    }
    if (MODE === 'err') {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'HTTP 500' }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(MODE === 'empty' ? { ...pricingView(), routes: [] } : pricingView()))
    return
  }
  // Quota tab: list (no provider) → enabled routes; per-provider → card.
  if (url.pathname === ROUTE_QUOTA) {
    if (MODE === 'err') {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'HTTP 500' }))
      return
    }
    const provider = url.searchParams.get(QUERY_PROVIDER)
    // 一次只写一次头：此前先 writeHead(200) 再按需 writeHead(404)，那个 200 是个
    // 已经作废却留在代码里的状态（读到它的人会以为找不到 provider 也回 200）。
    const payload = provider === null
      ? { providers: MODE === 'empty' ? [] : (QUOTA_MODES[serverState.quota] ?? []) }
      : quotaCards(serverState.quota)[provider]
    if (payload === undefined) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'unknown provider' }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(payload))
    return
  }
  /* 没有任何一路 fixture 认领这个 `/tokbook/*`。这必须是**显式 404**：落到下面的页面
     HTML 会让 client 把「Unexpected token '<'」报成加载失败——既指错方向，也不说缺的是
     哪一路。这一段就是把「fixture 清单要跟着 client 一起改」那条从静默变成一句话。 */
  if (url.pathname.startsWith('/tokbook/')) {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      error: `预览台没有这一路 fixture：${url.pathname}`,
      hint: '在本文件的路由里补一路，或用 pnpm ledger 直接看真账本',
    }))
    return
  }
  res.writeHead(200, { 'content-type': 'text/html' })
  const quotaMode = url.searchParams.get('quota')
  if (quotaMode !== null) serverState.quota = quotaMode
  // 独立查看器的背景文字直说这个进程在读什么——免得把真账本当预览 fixture 看。
  const backdrop = LEDGER
    ? `<h1>dsh-tokbook — 独立查看器</h1>
    <p>直接读本机账本目录（不摄取会话日志）。数据目录见浮窗的「统计口径」tab。</p>
    <p>浮窗穿着设备皮（无宿主色板，自带明暗双色）：默认浅面，?dark=1 换深面。</p>
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
    /* 品牌强调色按 **DSH 的真实取值**给：浅色皮肤 = neutral-bluish-1000（等于墨色），
       深色皮肤 = neutral-bluish-50。DSH 里这一档是「身份色」，恰好等于主文字色——预览台此前
       填的是 #4d6bfe（那只存在于插件自己的 CSS 兜底里），于是焦点环、侧栏入口那点
       在预览里是蓝的、在真宿主里是墨的：拿预览验颜色会得出相反的结论（accent 不是自由强调色）。
       宿主另有一个还在推的 -new-color 蓝（#4176e6）。 */
    --dsw-alias-brand-primary:#0f1115;
    --dsw-alias-button-primary-fill:#4d6bfe;
    --dsw-alias-button-primary-hover:#3f5ce0;
    --dsw-alias-button-ghost-active-border:rgb(0 0 0 / 14%);
    --dsw-alias-interactive-bg-hover:rgb(0 0 0 / 6%);
    --dsw-alias-interactive-bg-active:rgb(0 0 0 / 10%);
    --dsw-alias-state-success-primary:#1a7f37;
    --dsw-alias-state-warn-primary:#f59e0b;
    --dsw-alias-state-error-primary:#cf222e;
    --dsw-alias-scrollbar-bg-l2:rgb(0 0 0 / 20%);
    --dsw-alias-scrollbar-hover-l2:rgb(0 0 0 / 30%);
    --dsw-alias-tooltip-bg:#0f1115;
    --dsw-elevation-prominent:0 8px 40px rgb(0 0 0 / 18%);
    --dsw-elevation-stroke-color:rgb(0 0 0 / 8%);
    --dsw-mask-blur:blur(2px);
    /* 形状关键字（超椭圆），不是长度：DSH 真实给的是 superellipse(1.5)。填一个长度会让人
       以为 --dsw-corner-shape 是半径（tokens 片段那条注释正是为这个坑写的）。 */
    --dsw-corner-shape:superellipse(1.5);
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
    --dsw-alias-brand-primary:#f9fafb;
    --dsw-alias-button-primary-fill:#4d6bfe;
    --dsw-alias-button-primary-hover:#5d78ff;
    --dsw-alias-button-ghost-active-border:rgb(255 255 255 / 18%);
    --dsw-alias-interactive-bg-hover:rgb(255 255 255 / 8%);
    --dsw-alias-interactive-bg-active:rgb(255 255 255 / 12%);
    --dsw-alias-state-success-primary:#3fb950;
    --dsw-alias-state-warn-primary:#f59e0b;
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
    // 独立查看器 = 独立悬浮窗口的真实场景（没有宿主皮肤）：给浮窗根挂设备皮属性
    // （styles/device.ts + tokens.ts 第八节），主题跟 ?dark。浮窗关掉会重开、元素会换，
    // 所以挂观察器而不是找一次。
    if (${LEDGER}) {
      const deviceTheme = params.has('dark') ? 'dark' : 'light';
      const tagDevice = () => {
        const el = document.querySelector('.dtpl-overlay');
        if (el !== null && el.getAttribute('data-dtpl-device') !== deviceTheme) {
          el.setAttribute('data-dtpl-device', deviceTheme);
        }
      };
      new MutationObserver(tagDevice).observe(document.body, { childList: true, subtree: true });
      tagDevice();
    }
    // React 18 mounts concurrently, so the trigger does not exist yet when this
    // script runs and its listeners attach a beat later: look it up on every
    // attempt, and click it only while the overlay is still absent (the trigger
    // TOGGLES — a second click would close it again).
    const tabFlag = params.has('tab') ? params.get('tab') : (params.has('quota') ? 'quota' : null);
    // 无头校验（playwright）用 window.__PREVIEW_NO_AUTO=true 关掉这个自动循环：
    // 它每 100ms 点一次，会跟校验脚本自己的点击抢（先开浮窗、再切 tab），
    // 而且它只认 URL 上的 ?tab=——校验要顺序点好几个面时根本对不上。
    // 注意：这是普通 <script>（不是 module），顶层的 return 是语法错误。
    if (window.__PREVIEW_NO_AUTO !== true) {
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
    }
  </script>
</body>
</html>`)
})

const port = Number(process.env.PORT ?? 8931)
server.listen(port, '127.0.0.1', () => {
  if (LEDGER) {
    console.log(`tokbook 独立查看器 on http://127.0.0.1:${port}/ —— 账本目录：${ledgerDir ?? '默认（$DSH_HOME/tokbook，否则 ~/.dsh/tokbook）'}（浮窗带设备皮，?dark=1 换深面）`)
    return
  }
  console.log(`preview on http://127.0.0.1:${port}/  (?tab=ledger|quota|pricing|method, ?dark=1, ?quota=rich|percent|mix|unconfigured|error|balance|payg|nosub|retiredfirst|none)`)
  console.log(`  整台的形状由 **环境变量** 选（一个进程 = 一种形状）：TOKBOOK_MODE=empty|err|sync|syncerr（当前：${MODE === '' ? '有数据' : MODE}）。`)
  console.log(`  lib/client.js 按请求读盘：pnpm build 之后刷新页面即可，不用重启本进程。`)
})

