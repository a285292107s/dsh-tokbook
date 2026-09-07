/**
 * Host→browser data path for dsh-tokbook: exact HTTP routes on the host
 * webserver, registered through `ctx.webServer.register({ kind:'exact', ... })`.
 * The overview (costed summary + per-day trend + per-model + recent) is served
 * as a plain JSON route the browser floating window `fetch`es from; a second
 * route lets the scan button force an authoritative re-sync; a third route
 * serves the Provider-usage tab's per-provider cards for one selectable
 * look-back window (`?range=…` — exact routes match on pathname, so the query
 * is read inside the handler); a fourth serves the 订阅额度 tab's per-plan
 * official account usage (fetched host-side from each provider's own API).
 *
 * Both handlers guard method + same-origin (the reference plugin's hardening:
 * browsers send `Sec-Fetch-Site`; non-browser clients without the header pass)
 * and wrap the snapshot read in a try/catch so an internal error answers a
 * 500 JSON body instead of an unhandled rejection.
 *
 * @module dsh-tokbook/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { PROVIDER_RANGES, type ProviderRange, type ProviderUsageView, type QuotaCard, type QuotaView, type TokBookOverview } from './types.ts'

/** The subset of the host webserver this plugin uses. */
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

/** Whether a request may read the route: same-origin browser fetches only.
 * The header is absent for non-browser clients (curl, tests), which pass. */
export function isSameOriginFetch(req: IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site']
  if (site === undefined) return true
  return site === 'same-origin' || site === 'none'
}

function refuse(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(message)
}

/** Bind the overview route to a fresh-snapshot provider and the rescan route
 * to a forced-sync trigger. Returns the combined disposer. */
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

/** Parse the `range` query of a Provider-usage request. A missing or unknown
 * value answers null; the caller refuses the request (no silent default, so a
 * stale client cannot mislabel a window). */
export function parseProviderRange(req: IncomingMessage): ProviderRange | null {
  const raw = new URL(req.url ?? '/', 'http://tokbook.local').searchParams.get('range')
  if (raw === null) return null
  return (PROVIDER_RANGES as readonly string[]).includes(raw) ? raw as ProviderRange : null
}

/** Bind the Provider-usage route to a ranged view provider. Returns the
 * disposer. */
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

/** Bind the quota route (订阅额度 tab) to a snapshot provider. Returns the
 * disposer. An optional `?provider=` query fetches that single provider's
 * card only, so the client can render each card as soon as it is ready
 * instead of waiting for every provider. An optional `&refresh=1` bypasses
 * the per-card TTL cache (explicit or timed refresh must re-hit the API). */
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
