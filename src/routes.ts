/**
 * host→browser 数据路径：在 host webserver 上注册 exact HTTP route。
 *
 * 所有 handler 守 method + same-origin（浏览器带 `Sec-Fetch-Site`；无该 header
 * 的非浏览器客户端放行），内部错误以 500 JSON body 作答，而不是未处理 rejection。
 * exact route 按 pathname 匹配，query 在 handler 内读。
 *
 * @module dsh-tokbook/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { PROVIDER_RANGES, type PricingView, type ProviderRange, type ProviderUsageView, type QuotaCard, type QuotaView, type TokBookOverview } from './types.ts'
import type { PriceParse } from './pricing.ts'

/** 本插件用到的 host webserver 子集。 */
export interface WebServerLike {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

export interface RescanView {
  status: 'running' | 'skipped'
  lastSyncAt: number | null
}

export function isSameOriginFetch(req: IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site']
  if (site === undefined) return true
  return site === 'same-origin' || site === 'none'
}

function refuse(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(message)
}

/** 把概览 route 绑到新鲜快照提供方、扫描 route 绑到强制同步触发器。返回
 *  合并 disposer。 */
export function registerTokBookRoutes(
  webServer: WebServerLike | undefined,
  overview: () => TokBookOverview | Promise<TokBookOverview>,
  rescan: () => RescanView | Promise<RescanView>,
): () => void {
  if (webServer === undefined) return () => {}

  const handleOverview = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') return refuse(res, 405, 'method not allowed')
    if (!isSameOriginFetch(req)) return refuse(res, 403, 'forbidden')
    try {
      const snapshot = await overview()
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(snapshot))
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
  }

  const handleRescan = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST') return refuse(res, 405, 'method not allowed')
    if (!isSameOriginFetch(req)) return refuse(res, 403, 'forbidden')
    try {
      const view = await rescan()
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(view))
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
  }

  const disposeOverview = webServer.register({
    kind: 'exact',
    path: '/tokbook/overview',
    handler: handleOverview,
  })
  const disposeRescan = webServer.register({
    kind: 'exact',
    path: '/tokbook/rescan',
    handler: handleRescan,
  })
  return () => {
    disposeOverview()
    disposeRescan()
  }
}

export function parseProviderRange(req: IncomingMessage): ProviderRange | null {
  const raw = new URL(req.url ?? '/', 'http://tokbook.local').searchParams.get('range')
  if (raw === null) return null
  return (PROVIDER_RANGES as readonly string[]).includes(raw) ? raw as ProviderRange : null
}

export function registerTokBookUsageRoute(
  webServer: WebServerLike | undefined,
  usageView: (range: ProviderRange) => ProviderUsageView | Promise<ProviderUsageView>,
): () => void {
  if (webServer === undefined) return () => {}

  const handleUsage = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') return refuse(res, 405, 'method not allowed')
    if (!isSameOriginFetch(req)) return refuse(res, 403, 'forbidden')
    const range = parseProviderRange(req)
    if (range === null) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({
        error: 'unknown or missing "range"; expected one of ' + PROVIDER_RANGES.join(', '),
      }))
      return
    }
    try {
      const snapshot = await usageView(range)
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(snapshot))
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
  }

  return webServer.register({
    kind: 'exact',
    path: '/tokbook/usage',
    handler: handleUsage,
  })
}

/** 把额度 route 绑到快照提供方。返回 disposer。可选 `?provider=` 只取该
 *  provider 的卡；可选 `&refresh=1` 绕过单卡 TTL 缓存。 */
export function registerTokBookQuotaRoute(
  webServer: WebServerLike | undefined,
  quotaView: () => QuotaView | Promise<QuotaView>,
  quotaCardOf: (provider: string, force?: boolean) => Promise<QuotaCard>,
): () => void {
  if (webServer === undefined) return () => {}

  const handleQuota = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') return refuse(res, 405, 'method not allowed')
    if (!isSameOriginFetch(req)) return refuse(res, 403, 'forbidden')
    try {
      const params = new URL(req.url ?? '/', 'http://tokbook.local').searchParams
      const provider = params.get('provider')
      if (provider !== null && provider !== '') {
        const force = params.get('refresh') === '1'
        const card = await quotaCardOf(provider, force)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(card))
        return
      }
      const snapshot = await quotaView()
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(snapshot))
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
  }

  return webServer.register({
    kind: 'exact',
    path: '/tokbook/quota',
    handler: handleQuota,
  })
}

/** 读一个小 JSON 请求体（价格写路径会发一个）。有界，使恶意或破损 client
 *  无法让 host 无界缓冲；答 `{ ok, body }` / `{ ok: false, tooLarge }` 判决。 */
function readJsonBody(req: IncomingMessage): Promise<{ ok: true; body: unknown } | { ok: false; tooLarge: boolean }> {
  return new Promise((resolveBody) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    req.on('data', (chunk: Buffer) => {
      if (settled) return
      size += chunk.length
      if (size > 256 * 1024) {
        settled = true
        // 排空剩余，handler 仍能写 413；destroy 会在响应落地前拆掉 socket。
        req.resume()
        resolveBody({ ok: false, tooLarge: true })
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      if (chunks.length === 0) { resolveBody({ ok: false, tooLarge: false }); return }
      try {
        resolveBody({ ok: true, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) })
      } catch {
        resolveBody({ ok: false, tooLarge: false })
      }
    })
    req.on('error', () => {
      if (settled) return
      settled = true
      resolveBody({ ok: false, tooLarge: false })
    })
  })
}

/** 把价格表 route 绑到视图提供方与保存路径。返回 disposer。`/tokbook/pricing`
 *  上一条 exact route 按 method 分发（同一 path 注册两次会撞）：GET 答只读
 *  route 卡视图；PUT 接受完整的期望价表，持久化，并返回解析判决加新鲜视图。 */
export function registerTokBookPricingRoutes(
  webServer: WebServerLike | undefined,
  pricingView: () => PricingView | Promise<PricingView>,
  savePricing: (body: unknown) => Promise<PriceParse & { view: PricingView }>,
): () => void {
  if (webServer === undefined) return () => {}

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!isSameOriginFetch(req)) return refuse(res, 403, 'forbidden')
    if (req.method === 'GET') {
      try {
        const snapshot = await pricingView()
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(snapshot))
      } catch (error) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      }
      return
    }
    if (req.method === 'PUT') {
      const read = await readJsonBody(req)
      if (!read.ok && read.tooLarge) {
        res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'body 超过 256 KiB' }))
        return
      }
      const body = read.ok ? read.body : null
      try {
        const result = await savePricing(body)
        if (!result.ok) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: result.error, view: result.view }))
          return
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: true, view: result.view }))
      } catch (error) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      }
      return
    }
    return refuse(res, 405, 'method not allowed')
  }

  return webServer.register({
    kind: 'exact',
    path: '/tokbook/pricing',
    handler: handle,
  })
}
