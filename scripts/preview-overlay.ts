import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { QUERY_MODEL, QUERY_PROVIDER, QUERY_RANGE, QUERY_SESSION, QUERY_YEAR, ROUTE_HOLIDAY_SYNC, ROUTE_OVERVIEW, ROUTE_PRICING, ROUTE_PRICING_LOOKUP, ROUTE_PRICING_SYNC, ROUTE_QUOTA, ROUTE_RESCAN, ROUTE_SESSION, ROUTE_SYNC, ROUTE_USAGE } from '../src/route-paths.ts'
import { MODELS_DEV_URL } from '../src/models-dev.ts'
import { PROVIDER_RANGES } from '../src/types.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

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

const MODE = process.env.TOKBOOK_MODE ?? ''

const clientPath = join(root, 'lib', 'client.js')
let clientJs
try {
  clientJs = readFileSync(clientPath, 'utf8')
} catch {
  console.error('缺少 lib/client.js —— 先跑 pnpm build')
  process.exit(1)
}

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

function localDay(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

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
  total: { ...mk(1_920_000, 6_310_000, 486_000, 214), compactions: 6, failures: 3, usageUnknown: 5 },
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

const runningOverview = { ...overview, syncStatus: 'running' }
const syncErrorText = 'EACCES: permission denied, scandir C:\\Users\\28529\\.dsh\\sessions'
const syncErrOverview = { ...overview, syncStatus: 'error', syncError: syncErrorText }

const PRICING_FIXTURE = {
  routes: [
    {
      route: 'deepseek-official', label: 'DeepSeek', billing: 'metered', records: 7058,
      models: [
        { model: 'deepseek-v4-flash', configured: true, records: 322, unpriced: 0,
          price: { inputPerMillion: 1, outputPerMillion: 4, cacheReadPerMillion: 0.02,
            slots: [
              { days: 'weekdays', start: 9, end: 12, inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.04 },
              { days: 'workdays', start: 14, end: 18, inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.04 },
            ] } },
        { model: 'deepseek-v4-flash-vision-exp', configured: true, records: 3092, unpriced: 0,
          price: { inputPerMillion: 1.5, outputPerMillion: 4.5, cacheWritePerMillion: 0.05,
            slots: [{ days: 'weekends', start: 0, end: 24, outputPerMillion: 6 }] } },
        { model: 'deepseek-v4.1-flash', configured: true, records: 899, unpriced: 12,
          price: { inputPerMillion: 3, outputPerMillion: 8 } },
        { model: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', configured: true, records: 2745, unpriced: 0,
          price: { inputPerMillion: 4.5, outputPerMillion: 13.5, cacheWritePerMillion: 0.15 } },
        { model: 'deepseek-flash', configured: true, records: 0, unpriced: 0,
          price: { inputPerMillion: 1, outputPerMillion: 4, cacheWritePerMillion: 0.02 } },
        { model: 'deepseek-v4-flash-vision', configured: true, records: 0, unpriced: 0,
          price: { inputPerMillion: 1.5, outputPerMillion: 4.5 } },
        { model: 'deepseek-v4.2-flash-preview', configured: true, records: 0, unpriced: 0 },
      ],
    },
    {
      route: 'commandcode', label: 'commandcode', billing: 'subscription', currency: 'USD', records: 3240,
      models: [
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
        { model: 'dots3-note-prev', configured: true, records: 644, unpriced: 0,
          price: { inputPerMillion: 0, outputPerMillion: 0, cacheReadPerMillion: 0, cacheWritePerMillion: 0 } },
      ],
    },
    {
      route: 'opencode-go', label: 'OpenCode Go', billing: 'subscription', records: 367,
      models: [
        { model: 'glm-5.3-flash', configured: true, records: 243, unpriced: 0,
          price: { inputPerMillion: 0.8, outputPerMillion: 2.8 } },
        { model: 'mimo-v2.5', configured: true, records: 83, unpriced: 83 },
        { model: 'retired-model', configured: false, records: 41, unpriced: 41 },
        { model: 'glm-5.4-air', configured: true, records: 0, unpriced: 0 },
      ],
    },
    {
      route: 'private-relay', label: 'private-relay', billing: 'metered', records: 42,
      models: [
        { model: 'deepseek-v4-flash', configured: false, records: 42, unpriced: 0,
          price: { inputPerMillion: 1.2, outputPerMillion: 3.6 } },
      ],
    },
  ],
  calendar: {
    2025: [
      { start: '2025-01-28', end: '2025-02-04' },
      { start: '2025-10-01', end: '2025-10-08' },
    ],
  },
  calendarMissing: ['2026'],
  fx: { cnyPerUsd: 7.15 },
  dataDir: 'C:\\Users\\28529\\.dsh\\tokbook',
  updatedAt: Date.now(),
}

const pricingState = {
  routes: PRICING_FIXTURE.routes,
  calendar: PRICING_FIXTURE.calendar,
  auto: {},
  autoFetched: [],
  autoAttemptAt: null,
  autoError: null,
  syncDay: null,
  syncLastAdded: null,
  syncLastAttemptAt: null,
  syncLastError: null,
  syncNextAttemptAt: null,
  fx: PRICING_FIXTURE.fx,
}

function pricingView() {
  const calendar = { ...pricingState.auto, ...pricingState.calendar }
  const manualYears = new Set(Object.keys(pricingState.calendar))
  const autoOnly = Object.keys(pricingState.auto).filter((year) => !manualYears.has(year)).sort()
  const wanted = PRICING_FIXTURE.calendarMissing.filter((year) => !manualYears.has(year))
  const covered = wanted.filter((year) => (pricingState.auto[year]?.length ?? 0) > 0)
  const uncovered = wanted.filter((year) => !covered.includes(year))
  return {
    ...PRICING_FIXTURE,
    routes: pricingState.routes.map((card) => ({ currency: 'CNY', ...card })),
    calendar,
    ...(autoOnly.length > 0 ? { calendarAuto: autoOnly } : {}),
    holidaySync: {
      source: { label: 'holiday-cn', url: `${HOLIDAY_CN_BASE}/` },
      refreshDays: 1,
      state: wanted.length === 0
        ? 'ok'
        : covered.length === 0
          ? 'missing'
          : pricingState.autoError !== null
            ? 'failed'
            : 'ok',
      covered,
      uncovered,
      lastAttemptAt: pricingState.autoAttemptAt,
      lastError: pricingState.autoError,
    },
    fx: pricingState.fx,
    sync: {
      source: { label: 'models.dev', url: MODELS_DEV_URL },
      refreshDays: 1,
      retryMinutes: 60,
      state: pricingState.syncLastError !== null
        ? 'failed'
        : pricingState.syncLastAttemptAt === null
          ? 'missing'
          : pricingState.syncDay === localDay(new Date())
            ? 'ok'
            : 'stale',
      lastSuccessDay: pricingState.syncDay,
      lastAdded: pricingState.syncLastAdded,
      gaps: pricingState.routes
        .filter((card) => card.currency === 'USD')
        .reduce((sum, card) => sum + card.models.filter((row) => row.price === undefined).length, 0),
      lastAttemptAt: pricingState.syncLastAttemptAt,
      lastError: pricingState.syncLastError,
      nextAttemptAt: pricingState.syncNextAttemptAt,
    },
    calendarMissing: PRICING_FIXTURE.calendarMissing.filter((year) => calendar[year] === undefined),
    updatedAt: Date.now(),
  }
}

function withPricingWrite(body) {
  const billing = body.$billing ?? {}
  const currency = body.$currency ?? {}
  const usd = (route) => (currency[route] === 'USD' ? 'USD' : 'CNY')
  const routes = []
  const seen = new Set()
  for (const card of pricingState.routes) {
    const models = card.models.map((row) => {
      const price = body[card.route]?.[row.model]
      return { ...row, price: price === undefined ? undefined : price }
    })
    routes.push({ ...card, billing: billing[card.route] ?? 'metered', currency: usd(card.route), models })
    seen.add(card.route)
  }
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
  pricingState.calendar = { ...pricingState.auto, ...(body.$calendar ?? {}) }
  pricingState.fx = body.$fx
}

const LOOKUP_FIXTURE = [
  { provider: 'deepseek', modelId: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', cost: { input: 0.14, output: 0.56, cacheRead: 0.0028 } },
  { provider: 'deepseek', modelId: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', cost: { input: 0.2, output: 0.8 } },
  { provider: 'deepseek', modelId: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', cost: { input: 0.6, output: 2.4, cacheWrite: 0.04 } },
  { provider: 'deepseek', modelId: 'deepseek-reasoner', name: 'DeepSeek Reasoner', cost: { input: 0.55, output: 2.19 } },
  { provider: 'alibaba', modelId: 'qwen3-max', name: 'Qwen3 Max', cost: { input: 0.35, output: 1.4 } },
  { provider: 'alibaba', modelId: 'qwen3-coder', name: 'Qwen3 Coder', cost: { input: 0.3, output: 1.2 } },
  { provider: 'moonshotai', modelId: 'kimi-k3', name: 'Kimi K3', cost: { input: 0.5, output: 2 } },
  { provider: 'zai', modelId: 'glm-5.3-flash', name: 'GLM 5.3 Flash', cost: { input: 0.09, output: 0.36 } },
  { provider: 'zai', modelId: 'glm-5.3', name: 'GLM 5.3', cost: { input: 0.6, output: 2.2 } },
]

function normalizeKey(modelId) {
  const afterSlash = modelId.slice(modelId.lastIndexOf('/') + 1)
  const beforeColon = afterSlash.split(':')[0] ?? ''
  const trimmed = beforeColon.trim().replace(/@/g, '-').toLowerCase()
  return trimmed.endsWith('[1m]') ? trimmed.slice(0, -'[1m]'.length).trim() : trimmed
}

function lookupCandidates(keyword) {
  const kw = normalizeKey(keyword)
  if (kw === '') return []
  const scored = []
  for (const item of LOOKUP_FIXTURE) {
    const key = normalizeKey(item.modelId)
    let score = 0
    if (key === kw) score += 1000
    else if (key.startsWith(kw)) score += 700
    else if (key.includes(kw)) score += 500
    if (item.name.toLowerCase().includes(kw)) score += 200
    if (score > 0) scored.push({ item, key, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 8).map(({ item, key }) => ({ ...item, key }))
}

const HOLIDAY_CN_BASE = 'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master'

async function fetchHolidayYear(year) {
  const response = await fetch(`${HOLIDAY_CN_BASE}/${year}.json`, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`holiday-cn/${year}.json 答 HTTP ${String(response.status)}`)
  const body = await response.json()
  const days = Array.isArray(body.days) ? body.days : []
  const dates = days
    .filter((day) => day && day.isOffDay === true && typeof day.date === 'string' && day.date.slice(0, 4) === year)
    .map((day) => day.date)
    .sort()
  const ranges = []
  for (const date of dates) {
    const last = ranges[ranges.length - 1]
    if (last !== undefined) {
      const next = new Date(`${last.end}T00:00:00`)
      next.setDate(next.getDate() + 1)
      const expected = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
      if (expected === date) { last.end = date; continue }
    }
    ranges.push({ start: date, end: date })
  }
  return ranges
}

const QUOTA_MODES = {
  rich: ['commandcode', 'opencode-go'],
  percent: ['opencode-go'],
  mix: ['commandcode', 'opencode-go'],
  unconfigured: ['commandcode', 'opencode-go'],
  error: ['commandcode', 'opencode-go'],
  balance: ['commandcode'],
  payg: ['commandcode'],
  nosub: ['opencode-go'],
  retiredfirst: ['opencode-go', 'commandcode'],
  none: [],
}
const serverState = { quota: 'rich' }

function now() { return Date.now() }

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
    message: '未找到该订阅的 API key（可配置 apiKey / apiKeyEnv，或在本机 Models 页填好该通道的 key）。',
  }
  const unconfiguredOpen = {
    plan: 'opencode-go', title: 'OpenCode Go', state: 'unconfigured',
    message: '未找到该订阅的 API key（可配置 apiKey / apiKeyEnv，或在本机 Models 页填好该通道的 key）。',
  }
  const errorCommand = {
    plan: 'commandcode', title: 'Command Code', state: 'error',
    message: '官方接口拒绝了该 key（401）——请检查 Command Code API key。',
  }
  const errorOpen = {
    plan: 'opencode-go', title: 'OpenCode Go', state: 'error',
    message: '无法连接官方接口（网络错误）。',
  }
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
    usageCard('opencode-go', [
      usageModel('glm-5.3-flash', 1_820_000, { value: 2.4, requests: 34, billing: 'subscription' }),
      usageModel('mimo-v2.5', 178_000, { requests: 7, billing: 'subscription' }),
    ], { unpricedModels: ['mimo-v2.5'], usageUnknown: 1 }),
  ],
}
USAGE_CARDS.last30 = USAGE_CARDS.last7
USAGE_CARDS.all = USAGE_CARDS.last30

const USAGE_LABELS = { deepseek: 'DeepSeek', commandcode: 'Command Code', 'opencode-go': 'OpenCode Go' }

const WORKSPACES_BY_RANGE = { today: 2, yesterday: 2, last7: 4, last30: 4, all: 4 }

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
    totalTokens: providers.reduce((sum, card) => sum + card.tokens, 0),
    totalRequests: providers.reduce((sum, card) => sum + card.requests, 0),
    totalSpend: providers.reduce((sum, card) => sum + card.spend, 0),
    totalSubscriptionValue: providers.reduce((sum, card) => sum + card.subscriptionValue, 0),
    byModel: modelRows(providers),
    byWorkspace: WORKSPACE_ROWS.slice(0, WORKSPACES_BY_RANGE[range] ?? 0),
    providers,
  }
}

function emptyUsageView(range) {
  return {
    ...usageView(range),
    totalTokens: 0, totalRequests: 0, totalSpend: 0, totalSubscriptionValue: 0,
    byModel: [], byWorkspace: [], providers: [],
  }
}

const SESSION_SCENARIO = process.env.TOKBOOK_SESSION_SCENARIO ?? 'rich'

const t0 = Date.now()
const minute = 60_000

function step(turn, step, model, provider, ageMinutes, usage, extra = {}) {
  const { timing, ...rest } = extra
  const base = {
    requestId: `m${String(turn)}-${String(step)}-${model}`,
    time: t0 - ageMinutes * minute,
    model,
    provider,
    step,
    ...rest,
  }
  const seed = turn * 10 + step
  if (usage === null) {
    return {
      ...base,
      usage: undefined,
      tokens: 0,
      bucket: extra.bucket ?? 'spend',
      cost: 0,
      timing: timing !== undefined ? timing : fixtureTiming(300, seed),
    }
  }
  const tokens = usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + usage.outputTokens
  return {
    ...base,
    usage,
    tokens,
    bucket: extra.bucket ?? 'spend',
    cost: extra.cost ?? Math.round(tokens / 3_000_000 * 100) / 100,
    timing: timing !== undefined ? timing : fixtureTiming(usage.outputTokens, seed),
  }
}

function workOf(rows) {
  return rows.reduce((sum, row) => sum + (row.timing?.llmMs ?? 0) + (row.timing?.toolMs ?? 0), 0)
}

function fixtureTiming(outputTokens, seed) {
  const decodeMs = Math.round(outputTokens / 190 * 1000) + (seed % 7) * 130
  const ttftMs = 900 + (seed % 11) * 420
  const toolMs = seed % 3 === 0 ? 0 : 180 + (seed % 9) * 1_450
  const result = {
    wallMs: ttftMs + decodeMs + toolMs,
    llmMs: ttftMs + decodeMs,
    ttftMs,
    decodeMs,
    toolMs: undefined,
    toolCalls: undefined,
    slowTool: undefined,
  }
  if (toolMs > 0) {
    result.toolMs = toolMs
    result.toolCalls = seed % 4 === 0 ? 2 : 1
    result.slowTool = { name: seed % 4 === 0 ? 'grep' : 'read', ms: toolMs }
  }
  return result
}

const M_FAST = 'deepseek-v4-flash'
const M_DEEP = 'deepseek-v4.1-flash'
const M_SPEEULESS = 'z-ai/glm-5.3-flash'

const SESSIONS = {
  empty: {
    sessionId: 'sess-empty',
    updatedAt: t0,
    firstAt: 0,
    lastAt: 0,
    total: { requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, compactions: 0, failures: 0, usageUnknown: 0 },
    totalTokens: 0,
    spend: 0,
    subscriptionValue: 0,
    unpriced: [],
    turns: [],
    betweenTurns: null,
    unattributed: [],
    todaySpend: 4.99,
  },
  one: (() => {
    const rows = [
      step(1, 1, M_FAST, 'deepseek', 6, { inputTokens: 2_100, outputTokens: 480, cacheReadTokens: 8_400 }, { cost: 0.04 }),
      step(1, 2, M_FAST, 'deepseek', 5, { inputTokens: 1_400, outputTokens: 520, cacheReadTokens: 12_600 }, { cost: 0.03 }),
    ]
    const total = { requests: 2, inputTokens: 3_500, outputTokens: 1_000, cacheReadTokens: 21_000, cacheWriteTokens: 0, compactions: 0, failures: 0, usageUnknown: 0 }
    return {
      sessionId: 'sess-one',
      updatedAt: t0,
      firstAt: t0 - 6 * minute,
      lastAt: t0 - 5 * minute,
      total,
      totalTokens: 25_500,
      spend: 0.07,
      subscriptionValue: 0,
      unpriced: [],
      turns: [groupOf(1, rows)],
      betweenTurns: null,
      unattributed: [],
      todaySpend: 4.99,
      spanMs: 9 * minute,
      workMs: workOf(rows),
    }
  })(),
  rich: (() => {
    const turns = []
    const shape = [
      { n: 1, cache: 9_800, fresh: 1_900 },
      { n: 2, cache: 21_400, fresh: 2_600 },
      { n: 3, cache: 44_100, fresh: 3_400 },
      { n: 4, cache: 88_300, fresh: 5_100 },
      { n: 5, cache: 152_000, fresh: 7_200 },
      { n: 6, cache: 214_000, fresh: 12_400 },
      { n: 7, cache: 186_000, fresh: 6_800 },
      { n: 8, cache: 141_000, fresh: 4_900 },
      { n: 9, cache: 98_000, fresh: 3_600 },
      { n: 10, cache: 76_000, fresh: 2_900 },
      { n: 11, cache: 132_000, fresh: 5_400 },
      { n: 12, cache: 61_000, fresh: 2_200 },
    ]
    for (const turn of shape) {
      const age = (13 - turn.n) * 11 + 3
      const rows = [
        step(turn.n, 1, M_FAST, 'deepseek', age, {
          inputTokens: Math.round(turn.fresh * 0.32),
          outputTokens: Math.round(turn.fresh * 0.24),
          cacheReadTokens: Math.round(turn.cache * 0.62),
        }),
        step(turn.n, 2, M_FAST, 'deepseek', age - 1, {
          inputTokens: Math.round(turn.fresh * 0.18),
          outputTokens: Math.round(turn.fresh * 0.16),
          cacheReadTokens: Math.round(turn.cache * 0.38),
        }),
      ]
      if (turn.n === 4) {
        rows.push(step(4, 3, M_DEEP, 'deepseek', age - 2, { inputTokens: 1_200, outputTokens: 2_900, cacheReadTokens: 40_000 }, { cost: 0.12 }))
      }
      if (turn.n === 3) {
        rows.push(step(3, 3, M_FAST, 'deepseek', age - 2, null, {
          kind: 'failure', failureCode: 'rate_limited', usage: undefined, timing: { wallMs: 42_000 },
        }))
      }
      const group = groupOf(turn.n, rows)
      turns.push(group)
    }
    const betweenRows = [step(0, 0, M_FAST, 'deepseek', 6, { inputTokens: 34_000, outputTokens: 1_800, cacheReadTokens: 120_000 }, { kind: 'compaction', cost: 0.08, bucket: 'spend', timing: { llmMs: 20_600 } })]
    const betweenTurns = groupOf(null, betweenRows)
    const unattributed = [step(0, 0, M_SPEEULESS, 'opencode-go', 20, { inputTokens: 1_200, outputTokens: 300, cacheReadTokens: 0 }, { bucket: 'unpriced', cost: 0, timing: null })]
    const total = { requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, compactions: 1, failures: 1, usageUnknown: 1 }
    for (const g of [...turns, betweenTurns]) {
      total.requests += g.totals.requests
      total.inputTokens += g.totals.inputTokens
      total.outputTokens += g.totals.outputTokens
      total.cacheReadTokens += g.totals.cacheReadTokens
      total.cacheWriteTokens += g.totals.cacheWriteTokens
    }
    total.inputTokens += 1_200
    total.outputTokens += 300
    const times = [...turns.flatMap((g) => g.rows), ...betweenRows, ...unattributed].map((row) => row.time)
    const workMs = workOf([...turns.flatMap((g) => g.rows), ...betweenRows])
    return {
      sessionId: 'sess-rich',
      updatedAt: t0,
      firstAt: Math.min(...times),
      lastAt: Math.max(...times),
      total,
      totalTokens: total.inputTokens + total.outputTokens + total.cacheReadTokens + total.cacheWriteTokens,
      spend: 1.42,
      subscriptionValue: 0.86,
      unpriced: ['opencode-go|z-ai/glm-5.3-flash'],
      turns,
      betweenTurns,
      unattributed,
      todaySpend: 4.99,
      spanMs: 14 * 60 * minute,
      workMs,
    }
  })(),
}

function groupOf(turn, rows) {
  const totals = { requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, compactions: 0, failures: 0, usageUnknown: 0 }
  let tokens = 0
  let spend = 0
  let subscriptionValue = 0
  for (const row of rows) {
    totals.requests += 1
    if (row.usage === undefined) totals.usageUnknown += 1
    else {
      totals.inputTokens += row.usage.inputTokens
      totals.outputTokens += row.usage.outputTokens
      totals.cacheReadTokens += row.usage.cacheReadTokens ?? 0
      totals.cacheWriteTokens += row.usage.cacheWriteTokens ?? 0
    }
    if (row.kind === 'compaction') totals.compactions += 1
    if (row.kind === 'failure') totals.failures += 1
    tokens += row.tokens
    if (row.bucket === 'subscription') subscriptionValue += row.cost
    else if (row.bucket !== 'unpriced') spend += row.cost
  }
  return { turn, totals, tokens, spend, subscriptionValue, rows }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/client.js') {
    try {
      const fresh = readFileSync(clientPath, 'utf8')
      if (fresh !== clientJs) console.log('[preview] lib/client.js 变了，已在服务新构建产物')
      clientJs = fresh
    } catch { }
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' })
    res.end(clientJs)
    return
  }
  if (url.pathname === '/baseline.js') {
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' })
    res.end(baselineJs)
    return
  }
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

  if (url.pathname === ROUTE_OVERVIEW) {
    if (MODE === 'err') {
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
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      status: MODE === 'sync' ? 'running' : MODE === 'syncerr' ? 'error' : 'done',
      error: MODE === 'syncerr' ? syncErrorText : null,
      lastSyncAt: null,
      ledger: 0,
    }))
    return
  }
  if (url.pathname === ROUTE_RESCAN) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
    return
  }
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
  if (url.pathname === ROUTE_PRICING_SYNC) {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'method not allowed' }))
      return
    }
    const force = url.searchParams.get('force') === '1'
    if (!force && pricingState.syncDay === localDay(new Date())) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ added: 0, skipped: 0, syncedAt: Date.now(), throttled: true, reasons: {} }))
      return
    }
    const added = 2
    const skipped = 1
    pricingState.syncDay = localDay(new Date())
    pricingState.syncLastAdded = added
    pricingState.syncLastAttemptAt = Date.now()
    pricingState.syncLastError = null
    pricingState.syncNextAttemptAt = null
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      added, skipped, syncedAt: Date.now(), reasons: { 'opencode-go/mimo-v2.5': '通道不是美元报价' },
    }))
    return
  }
  if (url.pathname === ROUTE_PRICING_LOOKUP) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'method not allowed' }))
      return
    }
    const keyword = url.searchParams.get(QUERY_MODEL)
    if (keyword === null || keyword.trim() === '') {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: `missing "${QUERY_MODEL}"` }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ keyword, candidates: lookupCandidates(keyword) }))
    return
  }
  if (url.pathname === ROUTE_HOLIDAY_SYNC) {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'method not allowed' }))
      return
    }
    const asked = url.searchParams.getAll(QUERY_YEAR).filter((year) => /^\d{4}$/u.test(year))
    const targets = asked.length > 0 ? asked : PRICING_FIXTURE.calendarMissing
    void (async () => {
      const fetched = []
      const unpublished = []
      const failed = {}
      let changed = false
      for (const year of targets) {
        try {
          const ranges = await fetchHolidayYear(year)
          fetched.push(year)
          if (ranges.length === 0) {
            unpublished.push(year)
            continue
          }
          const before = JSON.stringify(pricingState.auto[year] ?? [])
          pricingState.auto[year] = ranges
          if (before !== JSON.stringify(ranges)) changed = true
        } catch (error) {
          failed[year] = error instanceof Error ? error.message : String(error)
        }
      }
      pricingState.autoFetched.push(...fetched)
      pricingState.autoAttemptAt = Date.now()
      const failures = Object.values(failed)
      pricingState.autoError = failures.length > 0 ? failures[0] : null
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ fetched, unpublished, failed, changed, refreshedAt: Date.now() }))
    })()
    return
  }
  if (url.pathname === ROUTE_SESSION) {
    if (url.searchParams.get(QUERY_SESSION) === null) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'unknown or missing "session"' }))
      return
    }
    if (MODE === 'err') {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'HTTP 500' }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(SESSIONS[SESSION_SCENARIO]))
    return
  }
  if (url.pathname === ROUTE_QUOTA) {
    if (MODE === 'err') {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'HTTP 500' }))
      return
    }
    const provider = url.searchParams.get(QUERY_PROVIDER)
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

  .dsh-view-host{position:fixed;inset:0;display:flex;flex-direction:column;z-index:2;}
  .dsh-view-host[hidden]{display:none;}
  .dsh-view-ring{
    display:flex;gap:2px;align-items:center;
    padding:8px 16px;border-bottom:1px solid var(--dsw-alias-border-l1,rgb(0 0 0 / 8%));
    background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#61666b);
    font-size:13px;
  }
  body.dark .dsh-view-ring{background:var(--dsw-alias-bg-base,#151517);}
  .dsh-view-tab{
    appearance:none;border:0;background:transparent;cursor:pointer;
    padding:6px 12px;font:inherit;color:inherit;
  }
  .dsh-view-tab[data-active="true"]{color:var(--dsw-alias-label-primary,#0f1115);font-weight:600;box-shadow:inset 0 -2px 0 currentColor;}
  .dsh-view-body{position:relative;flex:1 1 0;min-height:0;--dsh-chat-content-width:920px;--dsh-composer-height:152px;}

  .dsh-view-area{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;}
  .dsh-view-area > [data-slot="conversation.view"]{flex:1 1 0;min-height:0;display:flex;flex-direction:column;}
  .dsh-composer{
    position:absolute;left:50%;bottom:16px;transform:translateX(-50%);
    width:min(var(--dsh-chat-content-width),calc(100% - 48px));
    padding:14px 16px;box-sizing:border-box;
    background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-tertiary,#81858c);
    border:1px solid var(--dsw-alias-border-l1,rgb(0 0 0 / 8%));font-size:13px;
  }
  body.dark .dsh-composer{background:var(--dsw-alias-bg-layer-1,#1c1d20);}

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

  <div class="dsh-view-host" id="view-host" hidden>
    <div class="dsh-view-ring">
      <button type="button" class="dsh-view-tab">对话</button>
      <button type="button" class="dsh-view-tab">轨迹</button>
      <button type="button" class="dsh-view-tab" data-active="true">词元</button>
    </div>
    <div class="dsh-view-body">
      <div class="dsh-view-area" data-conversation-composer-overlay=""></div>
      <div class="dsh-composer">按 Enter 发送 · Shift+Enter 换行</div>
    </div>
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

      effect() { return () => {}; },
    };
    window.__PLUGIN_EXPORTS__.apply(ctx);

    const root = document.getElementById('root');
    const viewHost = document.getElementById('view-host');

    const viewArea = viewHost === null ? null : viewHost.querySelector('.dsh-view-area');
    for (const { options, component } of mounted) {
      const isView = options.name === 'conversation.view';

      const ownerShare = options.name === 'sidebar.footer.action'
        ? { wide: true }
        : isView ? 'preview-session-1' : {};
      const share = { ...(typeof ownerShare === 'string' ? {} : ownerShare), ...(options.inject ? options.inject(ownerShare) : {}) };
      const host = document.createElement('div');
      host.dataset.slot = options.name;
      (isView && viewArea !== null ? viewArea : root).appendChild(host);
      window.__DSH_REQUIRE_CACHE__['react-dom/client'].createRoot(host)
        .render(window.__DSH_REQUIRE_CACHE__['react'].createElement(component, share));
    }

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

    const tabFlag = params.has('tab') ? params.get('tab') : (params.has('quota') ? 'quota' : null);

    if (params.get('view') === 'tokens') {
      viewHost.hidden = false;
      for (const el of [document.querySelector('.fake-app'), root]) {
        if (el !== null) el.style.display = 'none';
      }
    }
    if (window.__PREVIEW_NO_AUTO !== true && params.get('view') !== 'tokens') {
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
  console.log(`  词元页：http://127.0.0.1:${port}/?view=tokens（宿主式对话正文容器；形状 TOKBOOK_SESSION_SCENARIO=${SESSION_SCENARIO}）`)
  console.log(`  整台的形状由 **环境变量** 选（一个进程 = 一种形状）：TOKBOOK_MODE=empty|err|sync|syncerr（当前：${MODE === '' ? '有数据' : MODE}）。`)
  console.log(`  lib/client.js 按请求读盘：pnpm build 之后刷新页面即可，不用重启本进程。`)
})
