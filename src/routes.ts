/**
 * Host→browser data path for dsh-tokbook: exact HTTP routes on the host
 * webserver, registered through `ctx.webServer.register({ kind:'exact', ... })`.
 * The overview (costed summary + per-day trend + per-model + recent) is served
 * as a plain JSON route the browser floating window `fetch`es from; a second
 * route lets the scan button force an authoritative re-sync.
 *
 * Both handlers guard method + same-origin (the reference plugin's hardening:
 * browsers send `Sec-Fetch-Site`; non-browser clients without the header pass)
 * and wrap the snapshot read in a try/catch so an internal error answers a
 * 500 JSON body instead of an unhandled rejection.
 *
 * @module dsh-tokbook/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TokBookOverview } from './types.ts'

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
