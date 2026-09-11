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
  BillingMap, PlanConfig, PricingTable, PricingView, ProviderRange, ProviderUsageView, QuotaCard, QuotaView, RateKey, TokBookConfig, TokBookOverview, TokenSummary, UsageRecord,
} from './types.ts'
import { UNPRICED_KEY, totalsTokens } from './types.ts'
import { coercePlansConfig, validateConfig } from './config.ts'
import { defaultDataDir, warnIfForeignOwner, writeOwnerMarker } from './ledger.ts'
import { UsageLog } from './usage-log.ts'
import { modelOfEvent, providerOfEvent, recordOfEvent, type SessionEventLike } from './usage-record.ts'
import { autoSyncIfNeeded, listPersistenceSnapshots, syncHistory, type SyncPersistence } from './sync.ts'
import { readSyncProgress, writeSyncProgress } from './sync-state.ts'
import {
  attachCosts, buildSummary, clearRecordCache, costRecentEntries, listDayFiles, rangeDayWindow, readCachedRecords,
  readRecordsByDayRange, snapshotBaseline, staleSessionIds, warmRecordCache,
  type PersistenceSnapshotLike, type RateResolver,
} from './stats.ts'
import {
  parsePriceInput, rateKeyAt, readPriceFile, readPricingView, writePriceFile,
  type LedgerUsage, type PriceParse,
} from './pricing.ts'
import { collectRoutes, routeLabels, type LlmLike, type SettingsLike } from './route-catalog.ts'
import { providerCards } from './by-provider.ts'
import { registerTokBookPricingRoutes, registerTokBookQuotaRoute, registerTokBookRoutes, registerTokBookUsageRoute, type WebServerLike } from './routes.ts'
import { isBuiltinQuotaPlan, isQuotaAlert, COMMAND_CODE_PROVIDER, OPENCODE_GO_PROVIDER } from './quota.ts'
import { fetchOfficialQuota, type CredentialResolver } from './quota-official.ts'
import { readQuotaSnapshot, writeQuotaSnapshot } from './quota-cache.ts'

/** Built-in providers with an official quota fetch, in display order. */
const BUILTIN_PLAN_KEYS: readonly string[] = [OPENCODE_GO_PROVIDER, COMMAND_CODE_PROVIDER]

/** How long a quota snapshot is reused before the providers are re-polled. */
const QUOTA_TTL_MS = 30_000

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
  /** The host context, kept for the two optional seams the 价格表 tab reads:
   *  the settings document (which routes/profiles exist) and the live LLM
   *  registry (which routes are actually serving). */
  private readonly hostCtx: Context
  /** User-configured quota-plan overrides keyed by provider route (coerced). */
  private readonly planConfig: Record<string, PlanConfig>
  /** In-process official quota card cache (see {@link QUOTA_TTL_MS}), so a
   * `?provider=` request does not re-hit the provider API on every open. This
   * is a thin freshness layer only: 'ok' cards are also mirrored to a durable
   * snapshot (see {@link readQuotaSnapshot}) that survives restarts, which is
   * what lets the tab render last-known data with zero latency. */
  private quotaCardCache = new Map<string, { at: number; card: QuotaCard }>()
  /** The DSH credentials seam (`ctx.credentials`), wired when present. The
   * quota fetchers resolve provider keys through it. */
  private credentials: CredentialResolver | undefined
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
  /** True once this fiber has been unloaded (HMR reload, or a dependency's
   * dispose → auto-reload). Fire-and-forget continuations that outlive the
   * fiber check it before their final side effect, so a disposed instance
   * never schedules derived-state writes (rollup invalidation, baseline
   * persistence) on behalf of a world that already moved on. */
  private disposed = false

  constructor(ctx: Context, config: TokBookConfig = {}) {
    super(ctx, 'tokbook')
    validateConfig(config)
    // Fiber-unload cleanup: mark this instance disposed and settle whatever
    // append work it already queued. Cordis runs disposers in reverse order
    // when the owning fiber unloads — service-isolation teardown or a
    // dependency's dispose → auto-reload — and awaits each fiber's disposers
    // before the fiber is gone.
    //
    // IMPORTANT scope note for a module-level HMR reload (cordis-plugin-hmr):
    // that path calls `registry.delete(plugin)` WITHOUT awaiting fiber
    // disposal, then immediately re-imports the plugin entry. The successor
    // module gets a FRESH module-level state map (see UsageLog), so it neither
    // "inherits" this instance's queue nor waits for this flush — dedupe safety
    // across that boundary is re-derived from the on-disk rows before the
    // successor's first write. Marking `disposed` here only stops THIS
    // instance's own fire-and-forget continuations; it does not gate the
    // successor. The flush is best-effort under module HMR, awaited under the
    // in-process teardown paths.
    ctx.effect(() => {
      return () => {
        this.disposed = true
        return this.log.flush()
      }
    })
    this.logger = resolveLogger(ctx)
    this.recordCompaction = config.recordCompaction !== false
    this.dir = defaultDataDir(config.path)
    this.log = new UsageLog(this.dir, this.logger)
    this.hostCtx = ctx
    this.planConfig = coercePlansConfig(config.plans)

    // "One data directory, one writing process" guard: warn when a live
    // foreign host owns this directory (two writers race the rollup/cache),
    // then record this process as the current owner. Advisory, never fatal.
    void warnIfForeignOwner(this.dir, this.logger).then(() => writeOwnerMarker(this.dir))
    void warmRecordCache(this.dir, undefined, this.logger)

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

    // The authoritative re-sync needs the session persistence service; wire
    // it lazily so a host that mounts no persistence still records live
    // requests (it just cannot backfill history).
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
          if (this.disposed) return
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

    // The quota tab resolves provider keys through the DSH credentials seam
    // (`ctx.credentials`), the same place the Models/settings page stores a
    // provider's API key. Wire it when the host mounts the service; without
    // it the quota fetch finds no key and shows an `unconfigured` card.
    ctx.inject(['credentials'], (credentialsCtx: Context) => {
      const service = credentialsCtx.get('credentials') as { resolve(ref: string): Promise<{ value: string } | undefined> } | undefined
      if (service === undefined) return
      this.credentials = {
        resolve: async (ref) => {
          const hit = await service.resolve(ref)
          return hit?.value !== undefined && hit.value !== '' ? hit.value : undefined
        },
      }
    })
    ctx.inject(['webServer'], (injectedCtx: Context) => {
      const webServer = injectedCtx.get('webServer') as WebServerLike | undefined
      ctx.effect(() => registerTokBookRoutes(
        webServer,
        () => this.overview(),
        () => this.rescan(),
      ))
      ctx.effect(() => registerTokBookUsageRoute(
        webServer,
        (range) => this.usageByRange(range),
      ))
      ctx.effect(() => registerTokBookQuotaRoute(
        webServer,
        () => this.quota(),
        (provider, force) => this.quotaCardOf(provider, force),
      ))
      ctx.effect(() => registerTokBookPricingRoutes(
        webServer,
        () => this.pricingView(),
        (body) => this.savePricing(body),
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
    // Fire-and-forget: never block the read path on a metadata write. A
    // disposed instance stops persisting (its successor will write its own
    // baseline after the next sync; an in-memory signature already covers this
    // process's remaining reads).
    if (this.disposed) return
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
    const { table, billing, revision } = await readPriceFile(this.dir, this.logger)
    const resolve: RateResolver = (record) => rateKeyAt(table, record.provider, record.model, record.time)
    const summary = await buildSummary(this.dir, () => new Date(), resolve, this.logger, { pricingRevision: revision })
    const costed = attachCosts(summary, table, billing)
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
    // The recent window resolves each row at its own timestamp, the same rule
    // the totals folded in, so a single row's ¥ in the 最近记录 list is exactly
    // the amount the aggregates counted — split into its two buckets.
    // Read-time + additive: no ledger/rollup change, and a price edit re-prices
    // the list on the next overview read.
    const recent = costRecentEntries(costed.recent, table, billing)
    // Slim wire payload: the price table, the rateRows and the byHour rows are
    // host-side concerns the floating window never renders; the cost layer has
    // already been folded into the cost fields.
    const { pricing: _pricing, rateRows: _rateRows, byHour: _byHour, recent: _recent, ...slim } = costed
    void _pricing; void _rateRows; void _byHour; void _recent
    return {
      ...slim,
      sessions,
      recent,
      totalTokens: totalsTokens(costed.total),
      updatedAt: Date.now(),
      records: records.length,
      files,
      lastEventAt,
      lastSyncAt: this.lastSyncAt > 0 ? this.lastSyncAt : null,
      syncStatus: this.syncStatus,
      syncError: this.syncError,
    }
  }

  /** Per-provider view of one look-back window, the payload of the
   * Provider-usage tab. Reuses the overview's authoritative freshness gate
   * and pricing; only the window's day files are read. */
  async usageByRange(range: ProviderRange): Promise<ProviderUsageView> {
    await this.ensureFresh()
    const { table, billing } = await readPriceFile(this.dir, this.logger)
    const resolve: RateResolver = (record) => rateKeyAt(table, record.provider, record.model, record.time)
    const { fromDay, toDay } = rangeDayWindow(range)
    const records = await readRecordsByDayRange(this.dir, fromDay, toDay, () => new Date(), this.logger)
    const cards = providerCards(records, table, resolve, billing)
    // Channel names for the cards: the settings profile's displayName, else the
    // adapter's provider name, so a route reads the way the 价格表 tab names it.
    const providerLabels = routeLabels(this.settings(), this.llm(), this.logger)
    return {
      range,
      fromDay,
      toDay,
      updatedAt: Date.now(),
      providerLabels,
      providers: cards,
    }
  }

  /** The host settings seam (`ctx.settings`), or undefined when unmounted.
   *  `ctx.get` is the reflective accessor: reading an unmounted service as a
   *  property throws ("without inject"), which a read-only view must not do. */
  private settings(): SettingsLike | undefined {
    return this.hostCtx.get('settings') as SettingsLike | undefined
  }

  /** The host LLM seam (`ctx.llm`), or undefined when unmounted. */
  private llm(): LlmLike | undefined {
    return this.hostCtx.get('llm') as LlmLike | undefined
  }

  /**
   * Quota snapshot for the 订阅额度 tab: fetch each built-in provider's
   * *official* account usage (never a local estimate — a subscription key is
   * shared across tools/devices, so the local ledger cannot know the true
   * account spend). Providers without a usable key yield an `unconfigured`
   * card; a failed fetch yields an `error` card. Results are cached for a
   * short TTL so repeated opens do not hammer the provider APIs.
   */
  async quota(): Promise<QuotaView> {
    // Fast, non-network: the list of enabled built-in providers in display
    // order. The client fetches each provider's card via `?provider=` so a
    // slow/failing provider never blocks the others from rendering.
    const providers = BUILTIN_PLAN_KEYS.filter((key) => this.planConfig[key]?.enabled !== false)
    // Footer 告急 dot: derived only from durable last-known 'ok' snapshots.
    // Opening this route must never hit a provider API — the badge is a
    // cheap signal for "the last time we looked, a window was nearly full".
    let alert = false
    for (const key of providers) {
      const cached = this.quotaCardCache.get(key)
      const snapshot = cached?.card.state === 'ok'
        ? cached.card
        : await readQuotaSnapshot(this.dir, key)
      if (isQuotaAlert(snapshot)) {
        alert = true
        break
      }
    }
    return { providers, alert }
  }

  /** Official quota card for one built-in provider, stale-while-revalidate:
   *
   *  - `force` (client refresh button / auto-refresh timer) always polls the
   *    provider and re-persists the result.
   *  - A non-forced read first reuses the fresh in-memory card (TTL), then
   *    falls back to the provider's *durable last-known 'ok' card* (disk
   *    snapshot, instant — no provider round trip), and only hits the
   *    provider API when nothing is known yet (first-ever open of the tab).
   *
   * The tab therefore renders content immediately on open (the last known
   * numbers) and the client follows up with a forced refresh when those
   * numbers are old, updating the card in place — the provider latency is
   * never in the way of first paint.
   *
   * A provider disabled in config yields an error card; an enabled provider
   * without a usable key yields an `unconfigured` card. Never throws. */
  async quotaCardOf(provider: string, force = false): Promise<QuotaCard> {
    const now = Date.now()
    const config = this.planConfig[provider]
    const enabled = config === undefined || config.enabled !== false
    // A disabled/unknown provider is terminal: never serve a stale snapshot
    // or refresh it. (Cached like any card so repeated opens are consistent.)
    if (!enabled || !isBuiltinQuotaPlan(provider)) {
      const card: QuotaCard = {
        plan: provider,
        title: provider,
        state: 'error',
        message: '该 provider 已禁用或没有内置的官方额度查询。',
        windows: [],
      }
      this.quotaCardCache.set(provider, { at: now, card })
      return card
    }

    if (!force) {
      const cached = this.quotaCardCache.get(provider)
      if (cached !== undefined && now - cached.at < QUOTA_TTL_MS) return cached.card
      // No fresh in-memory card: serve the durable last-known 'ok' card
      // instantly (never block an open on the provider round trip). It is
      // mirrored into the TTL cache so repeated opens within the TTL do not
      // even re-read disk; its own fetchedAt still tells the client it is
      // stale and a refresh is due.
      const snapshot = await readQuotaSnapshot(this.dir, provider)
      if (snapshot !== null) {
        this.quotaCardCache.set(provider, { at: now, card: snapshot })
        return snapshot
      }
    }

    let card: QuotaCard
    try {
      card = await fetchOfficialQuota(provider, {
        plan: config,
        logger: this.logger,
        credentials: this.credentials,
      })
    } catch (error) {
      this.logger.error(`[tokbook] official quota fetch for ${provider} threw:`, error)
      card = {
        plan: provider,
        title: provider,
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
        windows: [],
      }
    }
    this.quotaCardCache.set(provider, { at: now, card })
    // Only 'ok' cards become durable last-known snapshots; a fetch failure or
    // missing key is cheap to re-derive and must not mask a later recovery.
    if (card.state === 'ok') {
      void writeQuotaSnapshot(this.dir, provider, card)
        .catch((error: unknown) => {
          this.logger.warn?.(`[tokbook] cannot persist quota snapshot for ${provider}:`, error)
        })
    }
    return card
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

  /**
   * The 价格表 view: one card per provider route, one row per model the route
   * can be billed for.
   *
   * The route set is the route catalog (the settings document's profiles ∪ the
   * live adapter registry) merged by `readPricingView` with every route the
   * ledger billed and every route the price file names — so a route that left
   * the configuration, or that only carries a hand-written price, stays visible
   * and editable. Model rows come from the same catalog plus each route's own
   * ledger strings, so a 仅账本 string keeps an editable price.
   *
   * The ledger lens reads the record cache (counts only), so this tab never
   * stages rate rows of its own for the costed paths to trust. `ensureFresh`
   * still runs first — the same freshness the overview / usage tabs pay — so
   * 「账本 N 次」 is not stuck on a stale cache when the overlay opens here first.
   */
  async pricingView(): Promise<PricingView> {
    await this.ensureFresh()
    let ledger: LedgerUsage = { byRouteModel: new Map(), byRoute: new Map() }
    try {
      // The ledger lens needs record counts, not prices: read the warmed record
      // cache rather than folding a rollup, so this tab never stages rate rows
      // of its own for the costed paths to trust.
      const records = await readCachedRecords(this.dir, () => new Date(), this.logger)
      ledger = ledgerUsageOf(records)
    } catch (error) {
      // A failing read must not block the tab: the price file is still editable
      // without the ledger's usage lens.
      this.logger.warn?.('[tokbook] cannot read ledger usage for pricing view:', error)
    }
    const catalog = await collectRoutes(this.settings(), this.llm(), this.logger)
    return readPricingView(this.dir, catalog, ledger, this.logger)
  }

  /**
   * Validate + persist a complete price table from the 价格表 tab. The body is
   * the COMPLETE desired file (`$billing` + route → model → price segments), so
   * the write replaces `pricing.json` wholesale and an omitted (route, model)
   * stops being priced (its records fall to 价格未知). The read-time cost layer
   * re-prices history on the next read — no ledger or rollup rewrite.
   */
  async savePricing(body: unknown): Promise<PriceParse & { view: PricingView }> {
    const parsed = parsePriceInput(body)
    if (!parsed.ok) return { ok: false, error: parsed.error, view: await this.pricingView() }
    await writePriceFile(this.dir, parsed.file, this.logger)
    return { ok: true, file: parsed.file, view: await this.pricingView() }
  }

}

/** Fold the ledger's rows into the pricing view's usage lens: recorded requests
 *  per (route, model). Failed attempts name a route but no billed call, so they
 *  stay out — the card's 「账本 N 次」 means the same thing the 通道用量 tab's
 *  request count does. Unattributed rows (no route header was ever seen) cannot
 *  be priced and stay out of the 价格表 cards. */
function ledgerUsageOf(records: readonly UsageRecord[]): LedgerUsage {
  const byRouteModel = new Map<string, Map<string, number>>()
  const byRoute = new Map<string, number>()
  for (const record of records) {
    if (record.kind === 'failure') continue
    const route = record.provider ?? ''
    if (route === '' || record.model === '') continue
    let models = byRouteModel.get(route)
    if (models === undefined) {
      models = new Map()
      byRouteModel.set(route, models)
    }
    models.set(record.model, (models.get(record.model) ?? 0) + 1)
    byRoute.set(route, (byRoute.get(route) ?? 0) + 1)
  }
  return { byRouteModel, byRoute }
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
