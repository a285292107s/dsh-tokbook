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
 * ?quota=rich|percent|mix|unconfigured|error|none quota-tab fixture +
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
  recent: [
    { requestId: 'r-01', time: Date.now() - 3 * 60_000, sessionId: 'session-abc-1234567890', model: 'deepseek-chat', provider: 'deepseek', usage: mk(4_120, 61_300, 1_842), cost: 0.0132, spend: 0.0132, subscriptionValue: 0 },
    { requestId: 'r-02', time: Date.now() - 26 * 60_000, sessionId: 'session-abc-1234567890', model: 'deepseek-reasoner', provider: 'deepseek', usage: mk(9_840, 12_000, 3_310), cost: 0.0412, spend: 0.0412, subscriptionValue: 0 },
    { requestId: 'r-03', time: Date.now() - 70 * 60_000, sessionId: 'session-xyz', model: 'deepseek-chat', provider: 'deepseek', kind: 'compaction', usage: mk(1_260, 0, 4_110), cost: 0.008, spend: 0.008, subscriptionValue: 0 },
    { requestId: 'r-04', time: Date.now() - 140 * 60_000, sessionId: 'session-xyz', model: 'deepseek-chat', provider: 'deepseek', kind: 'failure', failureCode: 'RATE_LIMIT', cost: 0, spend: 0, subscriptionValue: 0 },
    { requestId: 'r-05', time: Date.now() - 3 * 3_600_000, sessionId: 'session-abc-1234567890', model: 'deepseek-chat', provider: 'deepseek', usage: mk(2_270, 44_900, 960), cost: 0.0066, spend: 0.0066, subscriptionValue: 0 },
    { requestId: 'r-06', time: Date.now() - 26 * 3_600_000, sessionId: 'session-old', model: 'deepseek-chat', provider: 'deepseek', usage: mk(3_715, 88_210, 2_204), cost: 0.0109, spend: 0.0109, subscriptionValue: 0 },
    { requestId: 'r-07', time: Date.now() - 40 * 60_000, sessionId: 'session-go', model: 'deepseek-v4-flash', provider: 'opencode-go', usage: mk(6_000, 7_000, 900), cost: 0.021, spend: 0, subscriptionValue: 0.021 },
  ],
  dataDir: 'C:\\Users\\28529\\.dsh\\tokbook',
  totalCost: 7.39,
  spend: 4.99,
  subscriptionValue: 2.4,
  unpricedModels: [],
  pricing: {},
  totalTokens: 8_716_000,
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
  byDay: [], byModel: [], recent: [],
  totalTokens: 0, totalCost: 0, spend: 0, subscriptionValue: 0, records: 0, files: 0,
  lastEventAt: null, lastSyncAt: null, syncStatus: 'idle', sessions: 0,
}

/* ── pricing-tab fixtures (model layer + provider overlay + channel lens) ── */
/** Small but representative pricing view: hand override, unpriced seed, a few
 *  cloud rows (one layered), the provider overlay rows the Provider 覆盖 mode
 *  renders, and `channelRows` — the per-route usage the 在用 view groups by,
 *  including strings billed by two routes (deepseek-v4-flash, glm-5.3-flash,
 *  deepseek/deepseek-v4-flash). */
const PRICING_FIXTURE = {
  rows: [
    { model: 'deepseek-reasoner', manual: true, manualRates: { inputPerMillion: 3.2, outputPerMillion: 12.8, cacheReadPerMillion: 0.8 }, cloudRates: { inputPerMillion: 4, outputPerMillion: 16 } },
    { model: 'deepseek/deepseek-v4-flash', manual: false, overlayPriced: true, provider: 'commandcode', records: 2979, now: { rates: { inputPerMillion: 1.5, outputPerMillion: 4.5 }, peak: false } },
    { model: 'z-ai/glm-5.3-flash', manual: false, overlayPriced: true, provider: 'commandcode', records: 276, now: { rates: { inputPerMillion: 0.8, outputPerMillion: 2.8 }, peak: false } },
    { model: 'mimo-v2.5', manual: false, overlayPriced: true, provider: 'opencode-go', records: 83, now: { rates: { inputPerMillion: 0.6, outputPerMillion: 2.4 }, peak: false } },
    { model: 'dots3-note-prev', manual: false, unpriced: true, records: 644 },
    { model: 'deepseek-chat', manual: false, cloudRates: { inputPerMillion: 2, outputPerMillion: 8, cacheReadPerMillion: 0.5 }, layered: true, family: 'deepseek' },
    { model: 'deepseek-v4-flash', manual: false, cloudRates: { inputPerMillion: 1.5, outputPerMillion: 4.5 }, family: 'deepseek', records: 2913 },
    { model: 'deepseek-v4-flash-vision-exp', manual: false, cloudRates: { inputPerMillion: 1.5, outputPerMillion: 4.5 }, layered: true, family: 'deepseek', records: 3092 },
    { model: 'deepseek-v4-pro', manual: false, cloudRates: { inputPerMillion: 8, outputPerMillion: 32 }, layered: true, family: 'deepseek' },
    { model: 'glm-5.3-flash', manual: false, cloudRates: { inputPerMillion: 0.8, outputPerMillion: 2.8 }, family: 'glm', records: 626 },
    { model: 'gpt-5.6-luna', manual: false, cloudRates: { inputPerMillion: 1.4, outputPerMillion: 8.4 }, layered: true, family: 'gpt', records: 784 },
    { model: 'gpt-5.6-luna-fast', manual: false, cloudRates: { inputPerMillion: 2.8, outputPerMillion: 16.8 }, family: 'gpt' },
    { model: 'grok-4.6', manual: false, cloudRates: { inputPerMillion: 3, outputPerMillion: 12 }, family: 'spacex-ai', records: 322 },
    { model: 'MiniMax-M3', manual: false, cloudRates: { inputPerMillion: 2.1, outputPerMillion: 8.4 }, layered: true, family: 'minimax' },
    { model: 'claude-3-5-sonnet-20241022', manual: false, cloudRates: { inputPerMillion: 22.4, outputPerMillion: 112, cacheReadPerMillion: 2.24 }, family: 'claude' },
    { model: 'claude-3-5-haiku-20241022', manual: false, cloudRates: { inputPerMillion: 5.6, outputPerMillion: 28, cacheReadPerMillion: 0.56 }, family: 'claude' },
    { model: 'gpt-5.6-cyber', manual: false, cloudRates: { inputPerMillion: 87.5, outputPerMillion: 525 }, family: 'gpt' },
    { model: 'commandcode/some-prefixed', manual: false, overlayPriced: true, provider: 'commandcode', cloudRates: { inputPerMillion: 1, outputPerMillion: 2 } },
  ],
  channelRows: [
    { provider: 'deepseek-official', model: 'deepseek-v4-flash', records: 323, billing: 'metered', overlay: true, now: { rates: { inputPerMillion: 1.5, outputPerMillion: 4.5 }, peak: false } },
    { provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp', records: 3092, billing: 'metered', overlay: true, now: { rates: { inputPerMillion: 1.5, outputPerMillion: 4.5 }, peak: false } },
    { provider: 'opencode-go', model: 'deepseek-v4-flash', records: 2590, billing: 'subscription', overlay: true, now: { rates: { inputPerMillion: 1.5, outputPerMillion: 4.5 }, peak: false } },
    { provider: 'opencode-go', model: 'glm-5.3-flash', records: 243, billing: 'subscription', overlay: true, now: { rates: { inputPerMillion: 0.8, outputPerMillion: 2.8 }, peak: false } },
    { provider: 'opencode-go', model: 'mimo-v2.5', records: 83, billing: 'subscription', overlay: true, now: { rates: { inputPerMillion: 0.6, outputPerMillion: 2.4 }, peak: false } },
    { provider: 'commandcode', model: 'deepseek/deepseek-v4-flash', records: 2964, billing: 'subscription', overlay: true, now: { rates: { inputPerMillion: 1.5, outputPerMillion: 4.5 }, peak: false } },
    { provider: 'commandcode', model: 'z-ai/glm-5.3-flash', records: 276, billing: 'subscription', overlay: true, now: { rates: { inputPerMillion: 0.8, outputPerMillion: 2.8 }, peak: false } },
    { provider: 'modlens-commandcode', model: 'deepseek/deepseek-v4-flash', records: 15, billing: 'subscription', overlay: true, now: { rates: { inputPerMillion: 1.5, outputPerMillion: 4.5 }, peak: false } },
    { provider: 'zai', model: 'glm-5.3-flash', records: 383, billing: 'metered', overlay: true, now: { rates: { inputPerMillion: 0.8, outputPerMillion: 2.8 }, peak: false } },
    { provider: 'staryears', model: 'gpt-5.6-luna', records: 784, billing: 'metered', overlay: true, now: { rates: { inputPerMillion: 1.4, outputPerMillion: 8.4 }, peak: false } },
    { provider: 'staryears', model: 'grok-4.6', records: 322, billing: 'metered', overlay: true, now: { rates: { inputPerMillion: 3, outputPerMillion: 12 }, peak: false } },
    { provider: 'dots-ai', model: 'dots3-note-prev', records: 644, billing: 'metered', overlay: false, unpriced: true },
  ],
  providerLabels: {
    'deepseek-official': 'DeepSeek 官方 API',
    'opencode-go': 'OpenCode Go 订阅',
    'commandcode': 'Command Code GOAT 订阅',
    'modlens-commandcode': 'modlens 经 Command Code',
    zai: 'Z.ai（智谱直连）',
    staryears: 'StarYears 中转',
  },
  providerRows: [
    { provider: 'deepseek-official', model: 'deepseek-v4-flash', billing: 'metered', inheritBase: 'deepseek-v4-flash', manual: false, note: '官方按量' },
    { provider: 'opencode-go', model: 'deepseek-v4-flash', billing: 'subscription', inheritBase: 'deepseek-v4-flash', manual: true, note: '订阅价值' },
    { provider: 'opencode-go', model: 'deepseek-v4-flash-vision-exp', billing: 'subscription', inheritBase: 'deepseek-v4-flash-vision-exp', manual: false },
    { provider: 'opencode-go', model: 'glm-5.3-flash', billing: 'subscription', inheritBase: 'glm-5.3-flash', manual: false },
    { provider: 'opencode-go', model: 'mimo-v2.5', billing: 'subscription', inheritBase: 'mimo-v2.5', manual: false },
    { provider: 'commandcode', model: 'deepseek/deepseek-v4-flash', billing: 'subscription', inheritBase: 'deepseek-v4-flash', manual: true, note: '前缀串' },
    { provider: 'commandcode', model: 'z-ai/glm-5.3-flash', billing: 'subscription', inheritBase: 'glm-5.3-flash', manual: false },
    { provider: 'staryears', model: 'gpt-5.6-luna', billing: 'metered', inheritBase: 'gpt-5.6-luna', placeholder: true, manual: false, note: '中转占位' },
    { provider: 'staryears', model: 'grok-4.6', billing: 'metered', inheritBase: 'grok-4.6', placeholder: true, manual: false },
    { provider: 'zai', model: 'glm-5.3-flash', billing: 'metered', inheritBase: 'glm-5.3-flash', manual: false },
    { provider: 'opencode-go-2', model: 'deepseek-v4-flash', billing: 'subscription', inheritBase: 'deepseek-v4-flash', manual: false, via: 'opencode-go', note: '同款套餐的第二份' },
  ],
  providerRoutes: { 'opencode-go-2': 'opencode-go' },
  providerNames: ['commandcode', 'deepseek-official', 'dots-ai', 'opencode-go', 'opencode-go-2', 'opencode-go-3', 'staryears', 'zai'],
  dataDir: 'C:\\Users\\28529\\.dsh\\tokbook',
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
    credits: { monthlyUsd: 63.5, purchasedUsd: 0, freeUsd: 0 },
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
  switch (mode) {
    case 'mix': return { commandcode, 'opencode-go': unconfiguredOpen }
    case 'unconfigured': return { commandcode: unconfiguredCommand, 'opencode-go': unconfiguredOpen }
    case 'error': return { commandcode: errorCommand, 'opencode-go': errorOpen }
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
  // Pricing tab: the merged view (GET) + a silent PUT that echoes the view back.
  if (url.pathname === '/tokbook/pricing') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(PRICING_FIXTURE))
    return
  }
  if (url.pathname === '/tokbook/provider-pricing') {
    const fixture = {
      providerRows: PRICING_FIXTURE.providerRows,
      providerRoutes: PRICING_FIXTURE.providerRoutes,
      providerNames: PRICING_FIXTURE.providerNames,
      dataDir: PRICING_FIXTURE.dataDir,
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(fixture))
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
    const btn = document.querySelector('[data-plugin="dsh-tokbook"]');
    // React 18 mounts concurrently, so delegated listeners are not attached
    // synchronously after render() — wait a beat before opening the overlay.
    const tabFlag = params.has('tab') ? params.get('tab') : (params.has('quota') ? 'quota' : null);
    setTimeout(() => {
      if (btn) btn.click();
      if (tabFlag) {
        const tabEl = document.getElementById('dtpl-tab-' + tabFlag);
        if (tabEl) tabEl.click();
      }
    }, 200);
  </script>
</body>
</html>`)
})

const port = Number(process.env.PORT ?? 8931)
server.listen(port, '127.0.0.1', () => {
  console.log(`preview on http://127.0.0.1:${port}/  (?tab=ledger|provider|quota|method, ?dark=1, ?empty=1, ?err=1, ?quota=rich|percent|mix|unconfigured|error|none)`)
})

