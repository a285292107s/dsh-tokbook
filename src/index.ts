import { Context, Service } from '@deepseek-ai/cordis'
import type {
  BillingMap, HolidayCalendar, HolidayRefreshResult, HolidaySyncView, PlanConfig, PricingLookupResult, PricingSyncResult, PricingSyncView, PricingTable, PricingView, ProviderRange, ProviderUsageView, QuotaCard, QuotaView, SessionUsageView, SyncStatusView, TokBookConfig, TokBookOverview, UsageRecord, WorkspaceUsageRow,
} from './types.ts'
import { totalsTokens } from './types.ts'
import { coercePlansConfig, validateConfig } from './config.ts'
import { defaultDataDir, warnIfForeignOwner, writeOwnerMarker } from './ledger.ts'
import { UsageLog, ledgerGeneration } from './usage-log.ts'
import { modelOfEvent, providerOfEvent, recordOfEvent, type SessionEventLike } from './usage-record.ts'
import { autoSyncIfNeeded, listPersistenceSnapshots, syncHistory, type SyncDeps, type SyncPersistence } from './sync.ts'
import { readSyncProgress, writeSyncProgress } from './sync-state.ts'
import {
  attachCosts, buildSummary, listDayFiles, rangeDayWindow, readCachedRecords,
  readRecordsByDayRange, snapshotBaseline, staleSessionIds, summarizeRecords, warmRecordCache,
  type PersistenceSnapshotLike, type RateResolver,
} from './stats.ts'
import { aggregateWindow, type WorkspaceRef } from './window-usage.ts'
import {
  cnyTable, parsePriceInput, rateKeyAt, readPriceFile, writePriceFile,
  type PriceFile, type PriceParse,
} from './pricing.ts'
import { dayKeyOf, holidaySet } from './price-format.ts'
import {
  autoHolidayState, autoOnly, calendarSignature, fetchHolidayYear, isFresh, mergeHolidayCalendars,
  readHolidayCache, writeHolidayCache, HOLIDAY_CN_BASE, HOLIDAY_REFRESH_DAYS, type HolidayCache,
} from './holiday-cn.ts'
import { fetchCatalog, MODELS_DEV_URL, searchCatalog, type ModelsDevCatalog } from './models-dev.ts'
import { billedRouteModels, mergeCatalogIntoTable } from './pricing-sync.ts'
import { PRICING_SYNC_RETRY_MS, readPricingSyncState, shouldSyncNow, writePricingSyncState } from './pricing-sync-state.ts'
import { ledgerUsageOf, readPricingView, type LedgerUsage } from './pricing-view.ts'
import { collectRoutes, routeLabels, type LlmLike, type SettingsLike } from './route-catalog.ts'
import { registerTokBookHolidaySyncRoute, registerTokBookPricingLookupRoute, registerTokBookPricingRoutes, registerTokBookPricingSyncRoute, registerTokBookQuotaRoute, registerTokBookRoutes, registerTokBookSessionRoute, registerTokBookUsageRoute, type WebServerLike } from './routes.ts'
import { buildSessionUsageView, sessionJoin } from './session-usage.ts'
import { errorCard, isBuiltinQuotaPlan, isQuotaAlert, COMMAND_CODE_PROVIDER, OPENCODE_GO_PROVIDER } from './quota.ts'
import { fetchOfficialQuota, type CredentialResolver } from './quota-official.ts'
import { readQuotaSnapshot, writeQuotaSnapshot } from './quota-cache.ts'

const BUILTIN_PLAN_KEYS: readonly string[] = [OPENCODE_GO_PROVIDER, COMMAND_CODE_PROVIDER]
const QUOTA_TTL_MS = 30_000
const SYNC_MIN_INTERVAL_MS = 15_000

interface SessionLike { readonly id: string }
interface EventStream {
  on(event: 'session/event', listener: (session: SessionLike, event: SessionEventLike) => void): void
}
interface WorkspaceLike {
  readonly id: string
  readonly title: string
  readonly path: string
}
interface WorkspaceRegistryLike {
  list(): readonly WorkspaceLike[]
}
interface SettingsFormsLike {
  describe(): readonly { ns: string; value: unknown }[]
}
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

export class TokenUsageBook extends Service {
  static inject = []

  private readonly logger: LoggerLike
  private readonly dir: string
  private readonly log: UsageLog
  private readonly recordCompaction: boolean
  private readonly hostCtx: Context
  private readonly planConfig: Record<string, PlanConfig>
  private quotaCardCache = new Map<string, { at: number; card: QuotaCard }>()
  private credentials: CredentialResolver | undefined
  private persistence: SyncPersistence | undefined
  private lastSyncAt = 0
  private lastWalkAt = 0
  private walkInFlight: Promise<void> | null = null
  private probeCache: { at: number; snapshots: readonly PersistenceSnapshotLike[] } | null = null
  private probeInFlight: Promise<readonly PersistenceSnapshotLike[]> | null = null
  private syncStatus: 'idle' | 'running' | 'done' | 'error' = 'idle'
  private syncError: string | null = null
  private syncedBySession = new Map<string, string>()
  private syncedOnce = false
  private readonly baselineReady: Promise<void>
  private disposed = false
  private pricingSyncInFlight: Promise<PricingSyncResult> | null = null
  private catalogCache: { catalog: ModelsDevCatalog; at: number } | null = null

  constructor(ctx: Context, config: TokBookConfig = {}) {
    super(ctx, 'tokbook')
    validateConfig(config)
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

    void warnIfForeignOwner(this.dir, this.logger).then((foreign) => {
      if (!foreign) return writeOwnerMarker(this.dir)
    })
    void warmRecordCache(this.dir, this.logger).catch((error: unknown) => {
      this.logger.warn?.('[tokbook] cannot warm the ledger record cache (data directory unreadable); reads will load day files on demand:', error)
    })

    this.baselineReady = readSyncProgress(this.dir)
      .then((progress) => {
        if (progress === null) return
        this.syncedBySession = new Map(Object.entries(progress.sessions))
        this.syncedOnce = true
        this.logger.info?.(`[tokbook] loaded sync baseline: ${String(this.syncedBySession.size)} sessions (synced ${new Date(progress.syncedAt).toISOString()})`)
      })
      .catch((error: unknown) => {
        this.logger.warn?.('[tokbook] cannot read sync baseline; will re-sync from scratch:', error)
      })

    this.bootHolidays()

    const lastModel = new Map<string, string>()
    const lastProvider = new Map<string, string>()
    const eventStream = ctx as unknown as EventStream
    eventStream.on('session/event', (session, event) => {
      try {
        const revealedModel = modelOfEvent(event)
        if (revealedModel !== undefined) lastModel.set(session.id, revealedModel)
        const revealedProvider = providerOfEvent(event)
        if (revealedProvider !== undefined) lastProvider.set(session.id, revealedProvider)
        const record = recordOfEvent(event, session.id, lastModel.get(session.id) ?? '', this.recordCompaction)
        if (record === null) return
        if (record.provider === undefined) {
          const provider = lastProvider.get(session.id)
          if (provider !== undefined) record.provider = provider
        }
        void this.log.record(record)
      } catch (error) {
        this.logger.error('[tokbook] event fold failed:', error)
      }
    })

    ctx.inject(['sessionPersistence'], (persistenceCtx: Context) => {
      const persistence = persistenceCtx.get('sessionPersistence') as SyncPersistence
      this.persistence = persistence
      const failed = new Set<string>()
      this.startWalk(async () => {
        try {
          const result = await autoSyncIfNeeded(this.syncDeps(persistence, failed), this.dir)
          if (this.disposed || result === null) return
          this.logger.info?.(`[tokbook] first-run sync: ${String(result.added)} added, ${String(result.skipped)} skipped, ${String(result.failedSessions)} failed sessions`)
          try {
            this.setBaseline(await listPersistenceSnapshots(persistence, this.logger), failed)
          } catch (error) {
            this.logger.warn?.('[tokbook] cannot record baseline after first-run sync:', error)
          }
          await warmRecordCache(this.dir, this.logger)
        } catch (error) {
          this.logger.error('[tokbook] first-run sync failed:', error)
        }
      })
    })

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
      injectedCtx.effect(() => registerTokBookRoutes(
        webServer,
        () => this.overview(),
        () => this.syncState(),
        () => this.rescan(),
      ))
      injectedCtx.effect(() => registerTokBookUsageRoute(
        webServer,
        (range) => this.usageByRange(range),
      ))
      injectedCtx.effect(() => registerTokBookSessionRoute(
        webServer,
        (sessionId) => this.sessionUsage(sessionId),
      ))
      injectedCtx.effect(() => registerTokBookQuotaRoute(
        webServer,
        () => this.quota(),
        (provider, force) => this.quotaCardOf(provider, force),
      ))
      injectedCtx.effect(() => registerTokBookPricingRoutes(
        webServer,
        () => this.pricingView(),
        (body) => this.savePricing(body),
      ))
      injectedCtx.effect(() => registerTokBookPricingSyncRoute(
        webServer,
        (force) => this.syncPricing(force),
      ))
      injectedCtx.effect(() => registerTokBookPricingLookupRoute(
        webServer,
        (keyword) => this.lookupPricing(keyword),
      ))
      injectedCtx.effect(() => registerTokBookHolidaySyncRoute(
        webServer,
        (options) => this.refreshHolidays(options),
      ))
    })
  }

  async ensureFresh(): Promise<readonly PersistenceSnapshotLike[]> {
    const persistence = this.persistence
    if (persistence === undefined) return []
    await this.baselineReady
    const snapshots = this.probeSnapshots(persistence)
    if (this.walkInFlight !== null && (await listDayFiles(this.dir)).length === 0) {
      await this.walkInFlight
    }
    return snapshots
  }

  private probeSnapshots(persistence: SyncPersistence): Promise<readonly PersistenceSnapshotLike[]> {
    const cached = this.probeCache
    if (cached === null) return this.refreshProbe(persistence)
    if (Date.now() - cached.at >= SYNC_MIN_INTERVAL_MS) {
      void this.refreshProbe(persistence).catch((error: unknown) => {
        this.logger.error('[tokbook] background probe refresh failed:', error)
      })
    }
    this.scheduleSync(cached.snapshots, staleSessionIds(this.syncedOnce, this.syncedBySession, cached.snapshots))
    return Promise.resolve(cached.snapshots)
  }

  private refreshProbe(persistence: SyncPersistence): Promise<readonly PersistenceSnapshotLike[]> {
    if (this.probeInFlight !== null) return this.probeInFlight
    const pending = listPersistenceSnapshots(persistence, this.logger)
      .catch((error: unknown) => {
        this.logger.error('[tokbook] persistence list probe failed:', error)
        return [] as readonly PersistenceSnapshotLike[]
      })
      .then((snapshots) => {
        this.probeCache = { at: Date.now(), snapshots }
        this.scheduleSync(snapshots, staleSessionIds(this.syncedOnce, this.syncedBySession, snapshots))
        return snapshots
      })
      .finally(() => {
        if (this.probeInFlight === pending) this.probeInFlight = null
      })
    this.probeInFlight = pending
    return pending
  }

  private scheduleSync(snapshots: readonly PersistenceSnapshotLike[], stale: readonly string[]): void {
    if (stale.length === 0) {
      if (this.walkInFlight === null) this.syncStatus = 'done'
      return
    }
    if (this.walkInFlight !== null) return
    const neverSynced = stale.some((id) => !this.syncedBySession.has(id))
    if (!neverSynced && Date.now() - this.lastWalkAt < SYNC_MIN_INTERVAL_MS) return
    this.doSync(snapshots, stale)
  }

  private syncDeps(persistence: SyncPersistence, failed: Set<string>): SyncDeps {
    return {
      persistence,
      log: this.log,
      recordCompaction: this.recordCompaction,
      logger: this.logger,
      onSessionFailure: (id, error) => {
        failed.add(id)
        this.logger.error(`[tokbook] cannot fold session ${id}:`, error)
      },
    }
  }

  private startWalk(run: () => Promise<void>): boolean {
    if (this.walkInFlight !== null) return false
    const tracked = run().finally(() => {
      if (this.walkInFlight === tracked) this.walkInFlight = null
    })
    this.walkInFlight = tracked
    return true
  }

  private doSync(snapshots: readonly PersistenceSnapshotLike[], sessionIds: readonly string[]): boolean {
    const persistence = this.persistence
    if (persistence === undefined) return false
    const startedAt = Date.now()
    return this.startWalk(async () => {
      this.syncStatus = 'running'
      this.syncError = null
      this.lastWalkAt = startedAt
      const failed = new Set<string>()
      try {
        const result = await syncHistory(
          this.syncDeps(persistence, failed),
          { snapshots, sessionIds },
        )
        this.lastSyncAt = Date.now()
        this.syncStatus = 'done'
        this.setBaseline(snapshots, failed)
        this.logger.info?.(`[tokbook] sync: ${String(result.added)} added, ${String(result.skipped)} skipped, ${String(result.failedSessions)} failed sessions (${String(sessionIds.length)} of ${String(snapshots.length)} sessions) in ${String(Date.now() - startedAt)} ms`)
      } catch (error) {
        this.syncStatus = 'error'
        this.syncError = error instanceof Error ? error.message : String(error)
        this.logger.error('[tokbook] sync failed:', error)
      }
    })
  }

  private setBaseline(snapshots: readonly PersistenceSnapshotLike[], failed: ReadonlySet<string>): void {
    const baseline = snapshotBaseline(snapshots)
    for (const id of failed) baseline.delete(id)
    this.syncedBySession = baseline
    this.syncedOnce = true
    if (this.disposed) return
    writeSyncProgress(this.dir, {
      syncedAt: Date.now(),
      sessions: Object.fromEntries(baseline),
    }).catch((error: unknown) => {
      this.logger.warn?.('[tokbook] cannot persist sync baseline:', error)
    })
  }

  async overview(): Promise<TokBookOverview> {
    await this.ensureFresh()
    const { table, billing, revision, resolve } = await this.rateContext()
    const summary = await buildSummary(this.dir, () => new Date(), resolve, this.logger, { pricingRevision: revision })
    const costed = attachCosts(summary, table, billing)
    const { pricing: _pricing, rateRows: _rateRows, byHour: _byHour, byModel: _byModel, unpricedModels: _unpricedModels, ...slim } = costed
    return {
      ...slim,
      totalTokens: totalsTokens(costed.total),
      updatedAt: Date.now(),
      records: costed.total.requests + (costed.total.failures ?? 0),
      lastEventAt: summary.lastEventAt,
      syncStatus: this.syncStatus,
      syncError: this.syncError,
    }
  }

  private workspaceRefs(): WorkspaceRef[] | null {
    const registry = this.workspaceRegistry()
    if (registry === undefined) return null
    return registry.list().map(workspace => ({
      id: String(workspace.id),
      title: workspace.title,
      path: workspace.path,
    }))
  }

  async usageByRange(range: ProviderRange): Promise<ProviderUsageView> {
    const snapshots = await this.ensureFresh()
    const { table, billing, resolve } = await this.rateContext()
    const { fromDay, toDay } = rangeDayWindow(range)
    const records = await readRecordsByDayRange(this.dir, fromDay, toDay, this.logger)
    const cwdBySession = new Map<string, string>()
    for (const snap of snapshots) {
      const cwd = snap.header.cwd
      if (typeof cwd === 'string' && cwd !== '') cwdBySession.set(snap.header.id, cwd)
    }
    const aggregate = aggregateWindow(
      records, this.workspaceRefs(), id => cwdBySession.get(id), table, resolve, billing,
    )
    const providerLabels = routeLabels(this.settings(), this.llm(), this.logger)
    return {
      range,
      fromDay,
      toDay,
      updatedAt: Date.now(),
      providerLabels,
      totalTokens: aggregate.providers.reduce((sum, card) => sum + card.tokens, 0),
      totalRequests: aggregate.providers.reduce((sum, card) => sum + card.requests, 0),
      totalSpend: aggregate.providers.reduce((sum, card) => sum + card.spend, 0),
      totalSubscriptionValue: aggregate.providers.reduce((sum, card) => sum + card.subscriptionValue, 0),
      byModel: aggregate.byModel,
      byWorkspace: aggregate.byWorkspace,
      providers: aggregate.providers,
    }
  }

  async sessionUsage(sessionId: string): Promise<SessionUsageView> {
    const snapshots = await this.ensureFresh()
    const { table, billing, resolve } = await this.rateContext()
    const records = await readCachedRecords(this.dir, this.logger)
    const join = await sessionJoin(this.persistence, sessionId, this.logger)
    const now = Date.now()
    return buildSessionUsageView({
      sessionId,
      records,
      join,
      sessions: snapshots,
      pricing: table,
      billing,
      resolve,
      todaySpend: this.todaySpendOf(records, now, table, billing, resolve),
      updatedAt: now,
    })
  }

  private todaySpendOf(
    records: readonly UsageRecord[],
    now: number,
    table: PricingTable,
    billing: BillingMap,
    resolve: RateResolver,
  ): number {
    const today = dayKeyOf(now)
    const costed = attachCosts(
      { ...summarizeRecords(records.filter(record => dayKeyOf(record.time) === today), resolve), dataDir: this.dir },
      table,
      billing,
    )
    return costed.byDay.find(row => row.day === today)?.spend ?? 0
  }

  private settings(): SettingsLike | undefined {
    const forms = this.hostCtx.get('settings') as SettingsFormsLike | undefined
    if (forms === undefined || typeof forms.describe !== 'function') return undefined
    try {
      const byNs = new Map(forms.describe().map(row => [row.ns, row.value]))
      return { get: (ns: string) => byNs.get(ns) }
    } catch (error) {
      this.logger.warn?.('[tokbook] cannot describe settings namespaces:', error)
      return undefined
    }
  }

  private llm(): LlmLike | undefined {
    return this.hostCtx.get('llm') as LlmLike | undefined
  }

  private workspaceRegistry(): WorkspaceRegistryLike | undefined {
    return this.hostCtx.get('workspaceRegistry') as WorkspaceRegistryLike | undefined
  }

  private async rateContext(): Promise<{
    table: PricingTable
    billing: BillingMap
    calendar: HolidayCalendar
    revision: string
    resolve: RateResolver
  }> {
    const { table, billing, calendar, revision, currency, fx } = await readPriceFile(this.dir, this.logger)
    const auto = await this.autoCalendar()
    const merged = mergeHolidayCalendars(calendar, auto)
    const holidays = holidaySet(merged)
    return {
      table: cnyTable(table, currency, fx),
      billing,
      calendar: merged,
      revision: `${revision}#${calendarSignature(merged)}`,
      resolve: (record) => rateKeyAt(table, record.provider, record.model, record.time, holidays),
    }
  }

  private async manualCalendar(): Promise<HolidayCalendar> {
    return (await readPriceFile(this.dir, this.logger)).calendar
  }

  private async autoCalendar(): Promise<HolidayCalendar> {
    const cache = await readHolidayCache(this.dir)
    const calendar: HolidayCalendar = {}
    for (const [year, entry] of Object.entries(cache.years)) {
      if (entry.ranges.length > 0) calendar[year] = entry.ranges
    }
    return calendar
  }

  async quota(): Promise<QuotaView> {
    const providers = BUILTIN_PLAN_KEYS.filter((key) => this.planConfig[key]?.enabled !== false)
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

  async quotaCardOf(provider: string, force = false): Promise<QuotaCard> {
    const now = Date.now()
    const config = this.planConfig[provider]
    const enabled = config === undefined || config.enabled !== false
    if (!enabled || !isBuiltinQuotaPlan(provider)) {
      const card = errorCard(provider, '该 provider 已禁用或没有内置的官方额度查询。')
      if (isBuiltinQuotaPlan(provider)) this.quotaCardCache.set(provider, { at: now, card })
      return card
    }

    if (!force) {
      const cached = this.quotaCardCache.get(provider)
      if (cached !== undefined && now - cached.at < QUOTA_TTL_MS) return cached.card
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
      card = errorCard(provider, error instanceof Error ? error.message : String(error))
    }
    this.quotaCardCache.set(provider, { at: now, card })
    if (card.state === 'ok') {
      void writeQuotaSnapshot(this.dir, provider, card)
        .catch((error: unknown) => {
          this.logger.warn?.(`[tokbook] cannot persist quota snapshot for ${provider}:`, error)
        })
    }
    return card
  }

  syncState(): SyncStatusView {
    return {
      status: this.syncStatus,
      error: this.syncError,
      lastSyncAt: this.lastSyncAt > 0 ? this.lastSyncAt : null,
      ledger: ledgerGeneration(this.dir),
    }
  }

  async rescan(): Promise<{ status: 'running' | 'skipped'; lastSyncAt: number | null }> {
    const persistence = this.persistence
    const lastSyncAt = this.lastSyncAt > 0 ? this.lastSyncAt : null
    if (persistence === undefined) return { status: 'skipped', lastSyncAt }
    let snapshots: readonly PersistenceSnapshotLike[]
    try {
      snapshots = await listPersistenceSnapshots(persistence, this.logger)
    } catch (error) {
      this.logger.error('[tokbook] rescan cannot list sessions:', error)
      return { status: 'skipped', lastSyncAt }
    }
    const started = this.doSync(snapshots, snapshots.map(snapshot => snapshot.header.id))
    return { status: started ? 'running' : 'skipped', lastSyncAt }
  }

  async pricingView(): Promise<PricingView> {
    await this.ensureFresh()
    let ledger: LedgerUsage = { byRouteModel: new Map(), byRoute: new Map() }
    let holidays: { calendar: HolidayCalendar; autoOnly: string[]; sync: HolidaySyncView } | undefined
    try {
      const records = await readCachedRecords(this.dir, this.logger)
      const { table, calendar } = await this.rateContext()
      ledger = ledgerUsageOf(records, table, holidaySet(calendar))
      const manual = await this.manualCalendar()
      const auto = await this.autoCalendar()
      holidays = {
        calendar,
        autoOnly: Object.keys(autoOnly(manual, auto)).sort(),
        sync: await this.holidaySyncView(manual, auto),
      }
    } catch (error) {
      this.logger.warn?.('[tokbook] cannot read ledger usage for pricing view:', error)
    }
    const catalog = await collectRoutes(this.settings(), this.llm(), this.logger)
    return readPricingView(this.dir, catalog, ledger, this.logger, holidays, await this.pricingSyncView())
  }

  private async holidaySyncView(manual: HolidayCalendar, auto: HolidayCalendar): Promise<HolidaySyncView> {
    const cache = await readHolidayCache(this.dir)
    const now = Date.now()
    const currentYear = new Date(now).getFullYear()
    const earliest = await this.earliestLedgerYear()
    const wanted: string[] = []
    if (earliest !== null) {
      for (let year = earliest; year <= currentYear; year += 1) wanted.push(String(year))
    }
    if (wanted.length === 0) wanted.push(String(currentYear))
    const needed = wanted.filter(year => manual[year] === undefined)
    const verdict = autoHolidayState(cache, needed, now)
    return {
      source: { label: 'holiday-cn', url: HOLIDAY_CN_BASE },
      refreshDays: HOLIDAY_REFRESH_DAYS,
      state: verdict.state,
      covered: verdict.covered,
      uncovered: verdict.uncovered,
      lastAttemptAt: cache.lastAttemptAt ?? null,
      lastError: cache.lastError ?? null,
    }
  }

  async savePricing(body: unknown): Promise<PriceParse> {
    const parsed = parsePriceInput(body)
    if (!parsed.ok) return parsed
    return this.withPriceFileLock(async () => {
      await writePriceFile(this.dir, parsed.file, this.logger)
      return parsed
    })
  }

  async syncPricing(force = false): Promise<PricingSyncResult> {
    if (this.pricingSyncInFlight !== null) return this.pricingSyncInFlight
    const started = (async (): Promise<PricingSyncResult> => {
      const state = await readPricingSyncState(this.dir)
      const now = Date.now()
      if (!shouldSyncNow(state, now, force)) {
        return { added: 0, skipped: 0, syncedAt: now, throttled: true, reasons: {} }
      }
      const today = dayKeyOf(now)
      try {
        const [catalog, records] = await Promise.all([
          fetchCatalog(),
          readCachedRecords(this.dir, this.logger),
        ])
        const report = await this.withPriceFileLock(async () => {
          const file = await readPriceFile(this.dir, this.logger)
          const { table, report } = mergeCatalogIntoTable(
            file.table, file.currency, billedRouteModels(records), catalog,
          )
          if (report.added > 0) {
            const next: PriceFile = { ...file, table }
            await writePriceFile(this.dir, next, this.logger)
          }
          return report
        })
        await writePricingSyncState(this.dir, {
          lastSyncDay: today,
          lastAdded: report.added,
          lastAttemptAt: now,
          lastError: null,
          nextAttemptAt: null,
        })
        return { ...report, syncedAt: Date.now() }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await writePricingSyncState(this.dir, {
          lastSyncDay: state.lastSyncDay,
          lastAdded: state.lastAdded,
          lastAttemptAt: now,
          lastError: message.slice(0, 300),
          nextAttemptAt: now + PRICING_SYNC_RETRY_MS,
        }).catch(() => undefined)
        throw error
      }
    })()
    this.pricingSyncInFlight = started
    try {
      return await started
    } finally {
      if (this.pricingSyncInFlight === started) this.pricingSyncInFlight = null
    }
  }

  private async pricingSyncView(): Promise<PricingSyncView> {
    const now = Date.now()
    const state = await readPricingSyncState(this.dir)
    let gaps = 0
    try {
      const [records, file] = await Promise.all([
        readCachedRecords(this.dir, this.logger),
        readPriceFile(this.dir, this.logger),
      ])
      for (const [route, models] of billedRouteModels(records)) {
        if (file.currency[route] !== 'USD') continue
        const priced = file.table[route] ?? {}
        for (const model of models) if (priced[model] === undefined) gaps += 1
      }
    } catch (error) {
      this.logger.warn?.('[tokbook] cannot count unpriced USD cells for the pricing sync view:', error)
    }
    const verdict: PricingSyncView['state'] = state.lastError !== null
      ? 'failed'
      : state.lastAttemptAt === null
        ? (gaps > 0 ? 'missing' : 'stale')
        : state.lastSyncDay === dayKeyOf(now)
          ? 'ok'
          : 'stale'
    return {
      source: { label: 'models.dev', url: MODELS_DEV_URL },
      refreshDays: 1,
      retryMinutes: Math.round(PRICING_SYNC_RETRY_MS / 60_000),
      state: verdict,
      gaps,
      lastSuccessDay: state.lastSyncDay,
      lastAdded: state.lastAdded,
      lastAttemptAt: state.lastAttemptAt,
      lastError: state.lastError,
      nextAttemptAt: state.nextAttemptAt,
    }
  }

  async lookupPricing(keyword: string): Promise<PricingLookupResult> {
    const catalog = await this.loadCatalog()
    return {
      keyword,
      candidates: searchCatalog(catalog, keyword).map((match) => ({
        provider: match.entry.provider,
        modelId: match.entry.modelId,
        name: match.entry.name,
        key: match.key,
        cost: match.entry.cost,
      })),
    }
  }

  private static readonly CATALOG_TTL_MS = 6 * 60 * 60 * 1000

  async refreshHolidays(options: { force?: boolean; extraYears?: readonly string[] } = {}): Promise<HolidayRefreshResult> {
    const now = Date.now()
    const currentYear = new Date(now).getFullYear()
    const cache = await readHolidayCache(this.dir)
    const years = new Set<string>()
    const earliest = await this.earliestLedgerYear()
    if (earliest !== null) {
      for (let year = earliest; year <= currentYear; year += 1) years.add(String(year))
    }
    years.add(String(currentYear))
    for (const year of options.extraYears ?? []) years.add(year)

    const wanted = [...years].sort((left, right) => left.localeCompare(right))
    const fetched: string[] = []
    const unpublished: string[] = []
    const failed: Record<string, string> = {}
    let changed = false
    const next: HolidayCache = { years: { ...cache.years } }
    for (const year of wanted) {
      if (options.force !== true && isFresh(cache.years[year], now)) continue
      try {
        const ranges = await fetchHolidayYear(year)
        fetched.push(year)
        if (ranges.length === 0) {
          unpublished.push(year)
          if (next.years[year] === undefined) next.years[year] = { ranges: [], fetchedAt: now }
          else next.years[year] = { ...next.years[year]!, fetchedAt: now }
          continue
        }
        const before = JSON.stringify(next.years[year]?.ranges ?? [])
        next.years[year] = { ranges, fetchedAt: now }
        if (before !== JSON.stringify(ranges)) changed = true
      } catch (error) {
        failed[year] = error instanceof Error ? error.message : String(error)
      }
    }
    const attempted = fetched.length > 0 || Object.keys(failed).length > 0
    if (attempted) {
      next.lastAttemptAt = now
      const firstFailure = Object.values(failed)[0] ?? null
      next.lastError = firstFailure
      await writeHolidayCache(this.dir, next).catch((error: unknown) => {
        this.logger.warn?.('[tokbook] cannot persist holiday cache:', error)
      })
    }
    return {
      fetched,
      unpublished,
      failed,
      changed,
      refreshedAt: now,
    }
  }

  private async earliestLedgerYear(): Promise<number | null> {
    try {
      const records = await readCachedRecords(this.dir, this.logger)
      let earliest: number | null = null
      for (const record of records) {
        if (earliest === null || record.time < earliest) earliest = record.time
      }
      return earliest === null ? null : new Date(earliest).getFullYear()
    } catch {
      return null
    }
  }

  private holidayBootstrapped = false

  private bootHolidays(): void {
    if (this.holidayBootstrapped) return
    this.holidayBootstrapped = true
    void this.refreshHolidays().catch((error: unknown) => {
      this.logger.warn?.('[tokbook] holiday-cn refresh failed; keeping whatever is cached:', error)
    })
  }

  private async loadCatalog(): Promise<ModelsDevCatalog> {
    const now = Date.now()
    const cached = this.catalogCache
    if (cached !== null && now - cached.at < TokenUsageBook.CATALOG_TTL_MS) return cached.catalog
    const catalog = await fetchCatalog()
    this.catalogCache = { catalog, at: now }
    return catalog
  }

  private async withPriceFileLock<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.priceFileChain
    const next = previous.then(work, work)
    this.priceFileChain = next.then(() => undefined, () => undefined)
    return next
  }
  private priceFileChain: Promise<unknown> = Promise.resolve()

}

export default TokenUsageBook
