/**
 * dsh-tokbook host half: a per-request token-usage ledger service.
 *
 * The host listens to the durable `session/event` stream and folds each
 * provider-billed model call (`assistant/message` usage, plus compaction
 * summarize calls and failed attempts) into one JSONL row persisted per local
 * day. To stay correct even when the live hook misses events, every overview
 * read first re-syncs from the authoritative `sessionPersistence` log
 * (idempotent via request-id dedupe), then aggregates the ledger; the live
 * hook is the fast path that keeps the ledger current between opens.
 *
 * The authoritative refresh is incremental across restarts: after each
 * successful sync the per-session change tokens (`revision`) are persisted
 * (`sync-progress.json` in the data directory). A restarted process loads
 * that baseline and only re-walks sessions whose persisted log changed since
 * — so the first overview after a restart does not decode every session log,
 * only the ones that actually gained events while the process was down.
 *
 * WIRE NOTES (tighten against real DSH types when the type packages are wired
 * as devDependencies): `session/event`, `sessionPersistence`, `webServer` and
 * the event payloads are typed loosely here so the external package compiles
 * with only `@deepseek-ai/cordis` on the type graph. The event shapes
 * (`assistant/message`·usage, `turn/end`·reason, `request/context`,
 * `llm/retry`, `compaction/summary`) and the persistence surface
 * (`listSnapshots()` with a plain `list()` fallback, plus `inspect(id)` →
 * `{ meta, events }`) have been verified against the real DSH source:
 * `list()` alone returns bare headers, so the freshness probe needs the
 * snapshot listing to cheaply detect changed logs.
 *
 * @module dsh-tokbook
 */

import { join } from 'node:path'
import { unlink } from 'node:fs/promises'
import { Context, Service } from '@deepseek-ai/cordis'
import type {
  PricingTable, RateKey, TokBookConfig, TokBookOverview, UsageRecord,
} from './types.ts'
import { currencyOfRegion, UNPRICED_KEY, totalsTokens } from './types.ts'
import { defaultDataDir } from './ledger.ts'
import { UsageLog } from './usage-log.ts'
import { modelOfEvent, providerOfEvent, recordOfEvent, type SessionEventLike } from './usage-record.ts'
import { autoSyncIfNeeded, listPersistenceSnapshots, syncHistory, type SyncPersistence } from './sync.ts'
import { readSyncProgress, writeSyncProgress } from './sync-state.ts'
import {
  attachCosts, buildSummary, clearRecordCache, listDayFiles, readCachedRecords, snapshotBaseline,
  staleSessionIds, warmRecordCache,
  type PersistenceSnapshotLike, type RateResolver,
} from './stats.ts'
import {
  readPricingTable, readUsdExchangeRate, resolvePricingUrl, resolveRate as resolveRateFor, syncCloudPricing,
  type PricingSourceInput, type PricingRegion,
} from './pricing.ts'
import { registerTokBookRoutes, type WebServerLike } from './routes.ts'

/** Minimal face of the durable session-event stream. */
interface SessionLike { readonly id: string }
interface EventStream {
  on(event: 'session/event', listener: (session: SessionLike, event: SessionEventLike) => void): void
}
/** Minimal face of the host logger service (absent on some hosts → console). */
interface LoggerLike {
  error(...args: unknown[]): void
  info?(...args: unknown[]): void
  warn?(...args: unknown[]): void
}

export const name = 'dsh-tokbook'

/** Reject stale or misspelled config keys before defaults can hide them. */
export function validateConfig(config: TokBookConfig): void {
  const unknown = Object.keys(config).find(key =>
    key !== 'path' && key !== 'pricingUrl' && key !== 'pricingRegion' && key !== 'recordCompaction')
  if (unknown !== undefined) {
    throw new Error(`TokBookConfig: unknown key "${unknown}"`)
  }
  if (config.path !== undefined && typeof config.path !== 'string') {
    throw new Error('TokBookConfig: "path" must be a string')
  }
  if (config.pricingUrl !== undefined && (typeof config.pricingUrl !== 'string' || config.pricingUrl.length === 0)) {
    throw new Error('TokBookConfig: "pricingUrl" must be a non-empty string')
  }
  if (config.pricingRegion !== undefined && config.pricingRegion !== 'domestic' && config.pricingRegion !== 'overseas') {
    throw new Error('TokBookConfig: "pricingRegion" must be "domestic" or "overseas"')
  }
  if (config.recordCompaction !== undefined && typeof config.recordCompaction !== 'boolean') {
    throw new Error('TokBookConfig: "recordCompaction" must be a boolean')
  }
}

function resolveLogger(ctx: Context): LoggerLike {
  const maybe = ctx as unknown as { logger?: (namespace: string) => LoggerLike }
  return typeof maybe.logger === 'function' ? maybe.logger('tokbook') : console
}

/**
 * The token-book service. Owns the durable per-day JSONL ledger and the
 * costed overview, registered under `ctx.tokbook`.
 */
export class TokenUsageBook extends Service {
  static inject = []

  private readonly logger: LoggerLike
  private readonly dir: string
  private readonly log: UsageLog
  private readonly recordCompaction: boolean
  private readonly pricing: PricingSourceInput
  private lastModel = new Map<string, string>()
  private persistence: SyncPersistence | undefined
  private syncing = false
  private lastSyncAt = 0
  private syncStatus: 'idle' | 'running' | 'done' | 'error' = 'idle'
  private syncError: string | null = null
  /** Per-session opaque revision recorded at the last sync; the cheap probe
   * compares `list()` snapshot revisions to this to detect un-synced work.
   * Seeded from the persisted baseline (`sync-progress.json`) so a restart
   * does not re-walk every session; rewritten after every successful sync. */
  private syncedBySession = new Map<string, string>()
  /** Whether an authoritative sync has settled for the current signature set.
   * True once a persisted baseline loaded, or once a sync settles in this
   * process. Guards the probe: with a trustworthy signature the probe only
   * re-walks drifted sessions. */
  private syncedOnce = false
  /** Loads the persisted baseline exactly once; callers await it before the
   * first probe so a restart inherits the previous process's signature. */
  private readonly baselineReady: Promise<void>

  constructor(ctx: Context, config: TokBookConfig = {}) {
    super(ctx, 'tokbook')
    validateConfig(config)
    this.logger = resolveLogger(ctx)
    this.recordCompaction = config.recordCompaction !== false
    this.dir = defaultDataDir(config.path)
    this.log = new UsageLog(this.dir, this.logger)
    this.pricing = {
      pricingUrl: config.pricingUrl,
      pricingRegion: config.pricingRegion as PricingRegion | undefined,
    }

    // Inherit the previous process's sync baseline (which session logs were
    // folded through which revision), so a restart does not re-walk every
    // session on the first overview. A missing/torn baseline reads as null:
    // the probe then walks everything once (idempotent) and rewrites one.
    this.baselineReady = readSyncProgress(this.dir)
      .then((progress) => {
        if (progress === null) return
        this.syncedBySession = new Map(Object.entries(progress.sessions))
        this.syncedOnce = true
        this.logger.info?.(`[tokbook] loaded sync baseline: ${String(this.syncedBySession.size)} sessions (synced ${new Date(progress.syncedAt).toISOString()})`)
      })
      .catch((error: unknown) => {
        // A baseline read failure must not block recording: fall back to the
        // conservative full walk (the probe treats it as no baseline).
        this.logger.warn?.('[tokbook] cannot read sync baseline; will re-sync from scratch:', error)
      })

    // Live recording from the durable session-event stream (fast path). Each
    // recorded event is projected into a row and appended; dedupe by request
    // id keeps the authoritative re-sync from double-counting. Per-session
    // last-known model/provider mirror the sync walk, so a failure row (which
    // names neither) is attributed the same way on both paths.
    const lastProvider = new Map<string, string>()
    const eventStream = ctx as unknown as EventStream
    eventStream.on('session/event', (session, event) => {
      try {
        const revealedModel = modelOfEvent(event)
        if (revealedModel !== undefined) this.lastModel.set(session.id, revealedModel)
        const revealedProvider = providerOfEvent(event)
        if (revealedProvider !== undefined) lastProvider.set(session.id, revealedProvider)
        const record = recordOfEvent(event, session.id, this.lastModel.get(session.id) ?? '', this.recordCompaction)
        if (record === null) return
        if (record.provider === undefined) {
          const p = lastProvider.get(session.id)
          if (p !== undefined) record.provider = p
        }
        void this.log.record(record)
      } catch (error) {
        this.logger.error('[tokbook] event fold failed:', error)
      }
    })

    // Warm the parse cache. The authoritative re-sync needs the session
    // persistence service; wire it lazily so a host that mounts no persistence
    // still records live requests (it just cannot backfill history).
    void warmRecordCache(this.dir, undefined, this.logger)
    ctx.inject(['sessionPersistence'], (persistenceCtx: Context) => {
      const persistence = persistenceCtx.get('sessionPersistence') as SyncPersistence
      this.persistence = persistence
      // Sessions whose log failed to fold are excluded from the baseline
      // written after this first-run sync, so the next process re-tries them.
      const failed = new Set<string>()
      void autoSyncIfNeeded(
        {
          persistence,
          log: this.log,
          recordCompaction: this.recordCompaction,
          onSessionFailure: (id) => { failed.add(id) },
        },
        this.dir,
      )
        .then(async (result) => {
          if (result !== null) {
            this.logger.info?.(`[tokbook] first-run sync: ${String(result.added)} added, ${String(result.skipped)} skipped, ${String(result.failedSessions)} failed sessions`)
            if (result.added > 0) invalidateDerivedState(this.dir)
            // The one-shot backfill just folded every session; record its
            // signature so a restart between now and the first overview does
            // not re-walk everything (no baseline exists until here).
            try {
              const snapshots = await listPersistenceSnapshots(persistence, this.logger)
              this.setBaseline(snapshots, failed)
            } catch (error) {
              this.logger.warn?.('[tokbook] cannot record baseline after first-run sync:', error)
            }
          }
          return warmRecordCache(this.dir, undefined, this.logger)
        })
        .catch((error: unknown) => {
          this.logger.error('[tokbook] first-run sync failed:', error)
        })
    })

    // Refresh the cloud pricing mirror at the resolved feed URL (best-effort;
    // a failed fetch keeps the previous mirror). Then the route.
    this.syncPricing()
    ctx.inject(['webServer'], (injectedCtx: Context) => {
      const webServer = injectedCtx.get('webServer') as WebServerLike | undefined
      ctx.effect(() => registerTokBookRoutes(
        webServer,
        () => this.overview(),
        () => this.rescan(),
      ))
    })
  }

  /**
   * Ensure the ledger is current before an overview read. A cheap metadata
   * probe decides what needs syncing. The signature set is seeded from the
   * persisted baseline (this process's own previous syncs, or an earlier
   * process's), so after a restart only sessions whose persisted log changed
   * since the recorded signature are walked — the common "nothing changed
   * while the web server was down" case walks nothing. Without a usable
   * baseline (first install, torn file) every session is walked once
   * (history backfill + post-restart catch-up), then a fresh baseline is
   * written. Idempotent (request-id dedupe); a run in flight is skipped.
   */
  async ensureFresh(): Promise<void> {
    const persistence = this.persistence
    if (persistence === undefined || this.syncing) return
    await this.baselineReady
    let snapshots: readonly PersistenceSnapshotLike[]
    try {
      // Snapshot listing (header + change token per session) with a plain
      // header-list fallback; `normalizeSnapshot` accepts either shape.
      snapshots = await listPersistenceSnapshots(persistence, this.logger)
    } catch (error) {
      // A failing probe means we cannot tell; try the walk rather than serve stale.
      this.logger.error('[tokbook] persistence list probe failed:', error)
      snapshots = []
    }
    const stale = staleSessionIds(this.syncedOnce, this.syncedBySession, snapshots)
    if (stale.length === 0) {
      this.syncStatus = 'done'
      return
    }
    await this.doSync(snapshots, stale)
  }

  /** The authoritative walk: fold the (changed) persisted logs into the
   * ledger, then record the post-sync revision signature so the next read
   * only walks what has changed by then. */
  private async doSync(snapshots: readonly PersistenceSnapshotLike[], sessionIds: readonly string[]): Promise<void> {
    const persistence = this.persistence
    if (persistence === undefined || this.syncing) return
    this.syncing = true
    this.syncStatus = 'running'
    this.syncError = null
    // Sessions whose log failed to fold are excluded from the baseline
    // written after this run, so the next process re-tries them.
    const failed = new Set<string>()
    try {
      const result = await syncHistory(
        {
          persistence,
          log: this.log,
          recordCompaction: this.recordCompaction,
          onSessionFailure: (id) => { failed.add(id) },
        },
        { snapshots, sessionIds },
      )
      this.lastSyncAt = Date.now()
      this.syncStatus = 'done'
      this.syncedOnce = true
      this.setBaseline(snapshots, failed)
      if (result.added > 0) invalidateDerivedState(this.dir)
      this.logger.info?.(`[tokbook] sync: ${String(result.added)} added, ${String(result.skipped)} skipped, ${String(result.failedSessions)} failed sessions (${String(sessionIds.length)} of ${String(snapshots.length)} sessions)`)
    } catch (error) {
      this.syncStatus = 'error'
      this.syncError = error instanceof Error ? error.message : String(error)
      this.logger.error('[tokbook] sync failed:', error)
    } finally {
      this.syncing = false
    }
  }

  /** Adopt the signature of a completed sync as the current in-memory
   * baseline and persist it as the cross-process baseline. `failed` holds the
   * sessions this run could not fold (unreadable logs): their signatures are
   * excluded, so the next process re-walks them. A persist failure only costs
   * one future full walk — the in-memory signature already keeps this process
   * incremental. */
  private setBaseline(snapshots: readonly PersistenceSnapshotLike[], failed: ReadonlySet<string>): void {
    const baseline = snapshotBaseline(snapshots)
    for (const id of failed) baseline.delete(id)
    this.syncedBySession = baseline
    // Fire-and-forget: never block the read path on a metadata write.
    writeSyncProgress(this.dir, {
      syncedAt: Date.now(),
      sessions: Object.fromEntries(baseline),
    }).catch((error: unknown) => {
      this.logger.warn?.('[tokbook] cannot persist sync baseline:', error)
    })
  }

  /** Current aggregated overview snapshot (costed, with per-day trend). */
  async overview(): Promise<TokBookOverview> {
    // Authoritative refresh first, so the ledger reflects persisted sessions.
    await this.ensureFresh()
    const pricing = await readPricingTable(this.dir, this.logger)
    const resolve: RateResolver = (record) => this.resolveRate(record, pricing)
    const summary = await buildSummary(this.dir, () => new Date(), resolve, this.logger)
    const costed = attachCosts(summary, pricing)
    const records = await readCachedRecords(this.dir, () => new Date(), this.logger)
    const files = (await listDayFiles(this.dir)).length
    let sessions = 0
    let lastEventAt: number | null = null
    const seen = new Set<string>()
    for (const record of records) {
      if (!seen.has(record.sessionId)) {
        seen.add(record.sessionId)
        sessions += 1
      }
      if (lastEventAt === null || record.time > lastEventAt) lastEventAt = record.time
    }
    const region = this.pricing.pricingRegion ?? 'domestic'
    const rate = await readUsdExchangeRate(this.dir, this.logger)
    // Slim wire payload: the pricing table / rateRows / byHour rows are host-
    // side concerns the floating window never renders, and a cloud mirror can
    // be large — the cost layer has already been folded into the cost fields.
    const { pricing: _pricing, rateRows: _rateRows, byHour: _byHour, ...slim } = costed
    void _pricing; void _rateRows; void _byHour
    return {
      ...slim,
      sessions,
      totalTokens: totalsTokens(costed.total),
      currency: currencyOfRegion(region),
      usdExchangeRate: rate,
      updatedAt: Date.now(),
      records: records.length,
      files,
      lastEventAt,
      lastSyncAt: this.lastSyncAt > 0 ? this.lastSyncAt : null,
      syncStatus: this.syncStatus,
      syncError: this.syncError,
    }
  }

  /** Force an authoritative re-sync of every session (bypassing the freshness
   * probe) and report its start, for the scan button. */
  async rescan(): Promise<{ status: 'running' | 'skipped'; lastSyncAt: number | null }> {
    const persistence = this.persistence
    if (persistence === undefined) return { status: 'skipped', lastSyncAt: this.lastSyncAt > 0 ? this.lastSyncAt : null }
    const already = this.syncing
    void listPersistenceSnapshots(persistence, this.logger)
      .then((snapshots) => this.doSync(snapshots, snapshots.map(s => s.header.id)))
      .catch(() => this.doSync([], []))
    return { status: already ? 'skipped' : 'running', lastSyncAt: this.lastSyncAt > 0 ? this.lastSyncAt : null }
  }

  /** Resolve the rate identity one record was billed at, under the merged table. */
  private resolveRate(record: UsageRecord, pricing: PricingTable): RateKey {
    const rules = pricing[record.model]
    if (rules === undefined) return UNPRICED_KEY
    const usage = record.usage
    const contextTokens = usage === undefined ? 0
      : usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
    return resolveRateFor(rules, record.time, contextTokens).key
  }

  /** Refresh the cloud pricing mirror (fire-and-forget; never fatal). */
  private syncPricing(): void {
    const url = resolvePricingUrl(this.pricing)
    void syncCloudPricing(this.dir, url)
      .then((result) => {
        this.logger.info?.(`[tokbook] pricing sync (${url}): version ${String(result.version)} (${String(result.models)} models, ${String(result.aliases)} aliases, USD rate ${String(result.usdExchangeRate)})`)
      })
      .catch((error: unknown) => {
        this.logger.warn?.('[tokbook] pricing sync failed:', error)
      })
  }
}

/** Drop the derived stats state after a sync appended rows (a rollup whose
 * `upto` already covers that day would skip the new contents; the cache may
 * hold a stale parse). Both rebuild losslessly on the next read. */
function invalidateDerivedState(dir: string): void {
  clearRecordCache(dir)
  void unlink(join(dir, 'rollup.json')).catch(() => undefined)
  void unlink(join(dir, 'rollup.json.tmp')).catch(() => undefined)
}

export default TokenUsageBook
