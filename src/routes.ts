import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  QUERY_FORCE, QUERY_MODEL, QUERY_PROVIDER, QUERY_RANGE, QUERY_REFRESH, QUERY_SESSION, QUERY_YEAR,
  ROUTE_HOLIDAY_SYNC, ROUTE_OVERVIEW, ROUTE_PRICING, ROUTE_PRICING_LOOKUP, ROUTE_PRICING_SYNC, ROUTE_QUOTA, ROUTE_RESCAN, ROUTE_SESSION, ROUTE_SYNC, ROUTE_USAGE,
} from './route-paths.ts'
import { PROVIDER_RANGES, type HolidayRefreshResult, type PriceVerdict, type PricingLookupResult, type PricingSyncResult, type PricingView, type ProviderRange, type ProviderUsageView, type QuotaCard, type QuotaView, type SessionUsageView, type SyncStatusView, type TokBookOverview } from './types.ts'
import type { PriceParse } from './pricing.ts'

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

export function registerTokBookRoutes(
  webServer: WebServerLike | undefined,
  overview: () => TokBookOverview | Promise<TokBookOverview>,
  syncState: () => SyncStatusView | Promise<SyncStatusView>,
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

  const handleSyncState = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') return refuse(res, 405, 'method not allowed')
    if (!isSameOriginFetch(req)) return refuse(res, 403, 'forbidden')
    try {
      const state = await syncState()
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(state))
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
    path: ROUTE_OVERVIEW,
    handler: handleOverview,
  })
  const disposeSyncState = webServer.register({
    kind: 'exact',
    path: ROUTE_SYNC,
    handler: handleSyncState,
  })
  const disposeRescan = webServer.register({
    kind: 'exact',
    path: ROUTE_RESCAN,
    handler: handleRescan,
  })
  return () => {
    disposeOverview()
    disposeSyncState()
    disposeRescan()
  }
}

export function parseProviderRange(req: IncomingMessage): ProviderRange | null {
  const raw = new URL(req.url ?? '/', 'http://tokbook.local').searchParams.get(QUERY_RANGE)
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
    path: ROUTE_USAGE,
    handler: handleUsage,
  })
}

export function registerTokBookSessionRoute(
  webServer: WebServerLike | undefined,
  sessionView: (sessionId: string) => SessionUsageView | Promise<SessionUsageView>,
): () => void {
  if (webServer === undefined) return () => {}

  const handleSession = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') return refuse(res, 405, 'method not allowed')
    if (!isSameOriginFetch(req)) return refuse(res, 403, 'forbidden')
    const sessionId = new URL(req.url ?? '/', 'http://tokbook.local').searchParams.get(QUERY_SESSION)
    if (sessionId === null || sessionId === '') {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: `missing "${QUERY_SESSION}"` }))
      return
    }
    try {
      const snapshot = await sessionView(sessionId)
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(snapshot))
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
  }

  return webServer.register({
    kind: 'exact',
    path: ROUTE_SESSION,
    handler: handleSession,
  })
}

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
      const provider = params.get(QUERY_PROVIDER)
      if (provider !== null && provider !== '') {
        const force = params.get(QUERY_REFRESH) === '1'
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
    path: ROUTE_QUOTA,
    handler: handleQuota,
  })
}

export function registerTokBookPricingSyncRoute(
  webServer: WebServerLike | undefined,
  syncPricing: (force: boolean) => Promise<PricingSyncResult>,
): () => void {
  if (webServer === undefined) return () => {}

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST') return refuse(res, 405, 'method not allowed')
    if (!isSameOriginFetch(req)) return refuse(res, 403, 'forbidden')
    const force = new URL(req.url ?? '/', 'http://tokbook.local').searchParams.get(QUERY_FORCE) === '1'
    try {
      const result = await syncPricing(force)
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(result))
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
  }

  return webServer.register({
    kind: 'exact',
    path: ROUTE_PRICING_SYNC,
    handler: handle,
  })
}

export function registerTokBookHolidaySyncRoute(
  webServer: WebServerLike | undefined,
  refreshHolidays: (options: { force?: boolean; extraYears?: readonly string[] }) => Promise<HolidayRefreshResult>,
): () => void {
  if (webServer === undefined) return () => {}

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST') return refuse(res, 405, 'method not allowed')
    if (!isSameOriginFetch(req)) return refuse(res, 403, 'forbidden')
    const query = new URL(req.url ?? '/', 'http://tokbook.local').searchParams
    const force = query.get(QUERY_FORCE) === '1'
    const extraYears = query.getAll(QUERY_YEAR).filter(year => /^\d{4}$/u.test(year))
    try {
      const result = await refreshHolidays({ force, extraYears })
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(result))
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
  }

  return webServer.register({
    kind: 'exact',
    path: ROUTE_HOLIDAY_SYNC,
    handler: handle,
  })
}

export function registerTokBookPricingLookupRoute(
  webServer: WebServerLike | undefined,
  lookup: (keyword: string) => Promise<PricingLookupResult>,
): () => void {
  if (webServer === undefined) return () => {}

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') return refuse(res, 405, 'method not allowed')
    if (!isSameOriginFetch(req)) return refuse(res, 403, 'forbidden')
    const keyword = new URL(req.url ?? '/', 'http://tokbook.local').searchParams.get(QUERY_MODEL)
    if (keyword === null || keyword.trim() === '') {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: `missing "${QUERY_MODEL}"` }))
      return
    }
    try {
      const result = await lookup(keyword)
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(result))
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
  }

  return webServer.register({
    kind: 'exact',
    path: ROUTE_PRICING_LOOKUP,
    handler: handle,
  })
}

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

export function registerTokBookPricingRoutes(
  webServer: WebServerLike | undefined,
  pricingView: () => PricingView | Promise<PricingView>,
  savePricing: (body: unknown) => Promise<PriceParse>,
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
          const verdict: PriceVerdict = { ok: false, error: result.error }
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify(verdict))
          return
        }
        const verdict: PriceVerdict = { ok: true }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(verdict))
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
    path: ROUTE_PRICING,
    handler: handle,
  })
}
