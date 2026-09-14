/**
 * host 半区：durable 事件流实时记账 + 权威再同步（`sessionPersistence` 日志，
 * request-id 去重）。概览读前先同步，实时 hook 只是两次打开间的快路径。
 *
 * WIRE NOTES：事件与持久化面是鸭子类型（待 DSH 类型包接入可收紧）。单个
 * `list()` 只有裸 header，故新鲜度探针走 `listSnapshots()`（带变更令牌）。
 *
 * @module dsh-tokbook
 */

import { join } from 'node:path'
import { unlink } from 'node:fs/promises'
import { Context, Service } from '@deepseek-ai/cordis'
import type {
  BillingMap, PlanConfig, PricingTable, PricingView, ProviderRange, ProviderUsageView, QuotaCard, QuotaView, TokBookConfig, TokBookOverview, UsageRecord, WorkspaceUsageRow,
} from './types.ts'
import { totalsTokens } from './types.ts'
import { coercePlansConfig, validateConfig } from './config.ts'
import { defaultDataDir, warnIfForeignOwner, writeOwnerMarker } from './ledger.ts'
import { UsageLog } from './usage-log.ts'
import { modelOfEvent, providerOfEvent, recordOfEvent, type SessionEventLike } from './usage-record.ts'
import { autoSyncIfNeeded, listPersistenceSnapshots, syncHistory, type SyncDeps, type SyncPersistence } from './sync.ts'
import { readSyncProgress, writeSyncProgress } from './sync-state.ts'
import {
  attachCosts, buildSummary, clearRecordCache, listDayFiles, rangeDayWindow, readCachedRecords,
  readRecordsByDayRange, ROLLUP_FILE_NAME, snapshotBaseline, staleSessionIds, warmRecordCache,
  type PersistenceSnapshotLike, type RateResolver,
} from './stats.ts'
import { workspaceRows, type WorkspaceRef } from './workspaces.ts'
import {
  parsePriceInput, rateKeyAt, readPriceFile, writePriceFile,
  type PriceParse,
} from './pricing.ts'
import { ledgerUsageOf, readPricingView, type LedgerUsage } from './pricing-view.ts'
import { collectRoutes, routeLabels, type LlmLike, type SettingsLike } from './route-catalog.ts'
import { providerCards } from './by-provider.ts'
import { registerTokBookPricingRoutes, registerTokBookQuotaRoute, registerTokBookRoutes, registerTokBookUsageRoute, type WebServerLike } from './routes.ts'
import { errorCard, isBuiltinQuotaPlan, isQuotaAlert, COMMAND_CODE_PROVIDER, OPENCODE_GO_PROVIDER } from './quota.ts'
import { fetchOfficialQuota, type CredentialResolver } from './quota-official.ts'
import { readQuotaSnapshot, writeQuotaSnapshot } from './quota-cache.ts'

const BUILTIN_PLAN_KEYS: readonly string[] = [OPENCODE_GO_PROVIDER, COMMAND_CODE_PROVIDER]
const QUOTA_TTL_MS = 30_000

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
  /** host context：价格表 tab 经它读 settings/llm 缝。 */
  private readonly hostCtx: Context
  /** 用户配置的额度计划覆盖，按 provider route 键（已纠错）。 */
  private readonly planConfig: Record<string, PlanConfig>
  /** 进程内官方额度卡缓存（TTL {@link QUOTA_TTL_MS}）。'ok' 卡还会镜像到 durable
   *  快照，重启后 tab 靠它零延迟渲染。 */
  private quotaCardCache = new Map<string, { at: number; card: QuotaCard }>()
  private credentials: CredentialResolver | undefined
  private persistence: SyncPersistence | undefined
  private syncing = false
  private lastSyncAt = 0
  private syncStatus: 'idle' | 'running' | 'done' | 'error' = 'idle'
  private syncError: string | null = null
  /** 上次同步时各会话的 opaque revision；探针以此对比检出未同步工作。从持久化
   *  基线（`sync-progress.json`）播种，重启后不必重走全部会话。 */
  private syncedBySession = new Map<string, string>()
  /** 当前内存签名是否可信（本进程同步落定，或继承自持久化基线）。守卫探针：
   *  可信时才只走漂移会话，否则每个会话都算 stale。 */
  private syncedOnce = false
  /** 恰好载入一次持久化基线；调用方在首次探针前 await 它，使重启继承上一进程的签名。 */
  private readonly baselineReady: Promise<void>
  /** 本 fiber 已卸载（HMR reload 或依赖 dispose）。fire-and-forget 续体在派生
   *  副作用之前检查它。 */
  private disposed = false

  constructor(ctx: Context, config: TokBookConfig = {}) {
    super(ctx, 'tokbook')
    validateConfig(config)
    // 卸载清理：标记 disposed 并 settle 已入队的 append。HMR reload 不 await
    // fiber disposal，继任者拿到全新的模块级 map；跨该边界的去重由磁盘重建
    // （见 usage-log）。
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

    // 「一个数据目录、一个写进程」守卫：发现别的存活 host 拥有本目录时告警（双写者
    // 会竞争 rollup/cache），然后把本进程记为当前 owner。只建议，绝不致命。
    void warnIfForeignOwner(this.dir, this.logger).then(() => writeOwnerMarker(this.dir))
    void warmRecordCache(this.dir, undefined, this.logger)

    // 继承上一进程的同步基线。缺失/撕裂读作 null：探针随后走一遍全量（幂等）并重写。
    this.baselineReady = readSyncProgress(this.dir)
      .then((progress) => {
        if (progress === null) return
        this.syncedBySession = new Map(Object.entries(progress.sessions))
        this.syncedOnce = true
        this.logger.info?.(`[tokbook] loaded sync baseline: ${String(this.syncedBySession.size)} sessions (synced ${new Date(progress.syncedAt).toISOString()})`)
      })
      .catch((error: unknown) => {
        // 基线读失败不得阻塞记账：回落到保守全量走（探针视作无基线）。
        this.logger.warn?.('[tokbook] cannot read sync baseline; will re-sync from scratch:', error)
      })

    // 从 durable 会话事件流实时记账（快路径；request-id 去重与权威再同步同源）。
    // 每个会话记住最近看到的 model / provider——turn/end 与失败行不带它们。
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

    // 权威再同步需要 session persistence 服务；懒接线，使不挂 persistence 的
    // host 仍能实时记账。
    ctx.inject(['sessionPersistence'], (persistenceCtx: Context) => {
      const persistence = persistenceCtx.get('sessionPersistence') as SyncPersistence
      this.persistence = persistence
      const failed = new Set<string>()
      void autoSyncIfNeeded(this.syncDeps(persistence, failed), this.dir)
        .then(async (result) => {
          if (this.disposed || result === null) return
          this.logger.info?.(`[tokbook] first-run sync: ${String(result.added)} added, ${String(result.skipped)} skipped, ${String(result.failedSessions)} failed sessions`)
          if (result.added > 0) invalidateDerivedState(this.dir)
          // 这次一次性回填刚折叠了全部会话；立刻记下签名，使现在到首次概览之间
          // 的重启不重走一切。
          try {
            this.setBaseline(await listPersistenceSnapshots(persistence, this.logger), failed)
          } catch (error) {
            this.logger.warn?.('[tokbook] cannot record baseline after first-run sync:', error)
          }
          // 回填 append 了新行：重读缓存，使首次概览看到它们。
          await warmRecordCache(this.dir, undefined, this.logger)
        })
        .catch((error: unknown) => {
          this.logger.error('[tokbook] first-run sync failed:', error)
        })
    })

    // 额度 tab 经 DSH credentials 缝（`ctx.credentials`）解析 provider key。没有
    // 它，额度拉取找不到 key，显示 `unconfigured` 卡。
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
   * 概览读之前保证账本新鲜，并把该读所需的会话 header 列表交回去（各会话的
   * `cwd`，按工作区一节用它 join）。签名集从持久化基线播种，重启后只走变更的会话。
   * 没有可用基线时每个会话走一次，再写一份新基线。幂等（request-id 去重）；已在
   * 飞的 run 不会再启动。
   */
  async ensureFresh(): Promise<readonly PersistenceSnapshotLike[]> {
    const persistence = this.persistence
    if (persistence === undefined) return []
    await this.baselineReady
    let snapshots: readonly PersistenceSnapshotLike[]
    try {
      // snapshot 列表（每会话 header + 变更 token），裸 header 列表可回落。
      snapshots = await listPersistenceSnapshots(persistence, this.logger)
    } catch (error) {
      // 探针失败：新鲜度不可判断，也挑不出漂移会话——本次读照常端出已入账的记录，
      // 交给下次探针（实时 hook 仍在记账）。
      this.logger.error('[tokbook] persistence list probe failed:', error)
      snapshots = []
    }
    const stale = staleSessionIds(this.syncedOnce, this.syncedBySession, snapshots)
    if (stale.length === 0) {
      this.syncStatus = 'done'
      return snapshots
    }
    await this.doSync(snapshots, stale)
    return snapshots
  }

  /** 一轮同步的依赖：一次性回填与权威 walk 共用；`failed` 收集读不了日志的会话。 */
  private syncDeps(persistence: SyncPersistence, failed: Set<string>): SyncDeps {
    return {
      persistence,
      log: this.log,
      recordCompaction: this.recordCompaction,
      onSessionFailure: (id) => { failed.add(id) },
    }
  }

  /** 权威 walk：把（有变化的）持久化日志折叠进账本，再记下同步后的 revision 签名。 */
  private async doSync(snapshots: readonly PersistenceSnapshotLike[], sessionIds: readonly string[]): Promise<void> {
    const persistence = this.persistence
    if (persistence === undefined || this.syncing) return
    this.syncing = true
    this.syncStatus = 'running'
    this.syncError = null
    const failed = new Set<string>()
    try {
      const result = await syncHistory(
        this.syncDeps(persistence, failed),
        { snapshots, sessionIds },
      )
      this.lastSyncAt = Date.now()
      this.syncStatus = 'done'
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

  /** 把一次已完成同步的签名收为当前内存基线并置 `syncedOnce`，再持久化为跨进程
   *  基线。`failed` 是读不了日志的会话：其签名被排除，下轮探针会重走它们。持久化
   *  失败只让未来多一次全量走——内存签名已保证本进程内的增量。 */
  private setBaseline(snapshots: readonly PersistenceSnapshotLike[], failed: ReadonlySet<string>): void {
    const baseline = snapshotBaseline(snapshots)
    for (const id of failed) baseline.delete(id)
    this.syncedBySession = baseline
    this.syncedOnce = true
    // fire-and-forget：绝不为元数据写阻塞读路径。
    if (this.disposed) return
    writeSyncProgress(this.dir, {
      syncedAt: Date.now(),
      sessions: Object.fromEntries(baseline),
    }).catch((error: unknown) => {
      this.logger.warn?.('[tokbook] cannot persist sync baseline:', error)
    })
  }

  /** 当前聚合概览快照（带成本，含按日趋势与按工作区累计）。 */
  async overview(): Promise<TokBookOverview> {
    const snapshots = await this.ensureFresh()
    const { table, billing, revision, resolve } = await this.rateContext()
    const summary = await buildSummary(this.dir, () => new Date(), resolve, this.logger, { pricingRevision: revision })
    const costed = attachCosts(summary, table, billing)
    const records = await readCachedRecords(this.dir, () => new Date(), this.logger)
    const files = (await listDayFiles(this.dir)).length
    let lastEventAt: number | null = null
    for (const record of records) {
      if (lastEventAt === null || record.time > lastEventAt) lastEventAt = record.time
    }
    // 按工作区累计，读时 join 会话 header 的 cwd。宿主未挂工作区注册表时为空。
    const byWorkspace = this.workspaceUsage(records, snapshots, table, billing, resolve)
    // 精简 wire 载荷：价表与 rateRows 不过 wire，成本已折进 cost 字段。
    const { pricing: _pricing, rateRows: _rateRows, byHour: _byHour, ...slim } = costed
    return {
      ...slim,
      byWorkspace,
      totalTokens: totalsTokens(costed.total),
      updatedAt: Date.now(),
      records: records.length,
      files,
      lastEventAt,
      syncStatus: this.syncStatus,
      syncError: this.syncError,
    }
  }

  /**
   * 一次概览读的按工作区行：账本记录按其会话所属工作区折叠。该 join 需要两条
   * live host 缝——工作区注册表（title + 规范 path）与会话 header（`cwd`）。
   * 列表中缺席的会话（其日志已消失）贡献不了 `cwd`，其记录落入未归属。
   */
  private workspaceUsage(
    records: readonly UsageRecord[],
    snapshots: readonly PersistenceSnapshotLike[],
    pricing: PricingTable,
    billing: BillingMap,
    resolve: RateResolver,
  ): WorkspaceUsageRow[] {
    const registry = this.workspaceRegistry()
    if (registry === undefined) return []
    const cwdBySession = new Map<string, string>()
    for (const snap of snapshots) {
      const cwd = snap.header.cwd
      if (typeof cwd === 'string' && cwd !== '') cwdBySession.set(snap.header.id, cwd)
    }
    const workspaces: WorkspaceRef[] = registry.list().map(workspace => ({
      id: String(workspace.id),
      title: workspace.title,
      path: workspace.path,
    }))
    return workspaceRows(records, workspaces, id => cwdBySession.get(id), pricing, resolve, billing)
  }

  /** 一个回看窗口的按 provider 视图，Provider 用量 tab 的载荷。复用概览的
   *  权威新鲜门与价表；只读窗口内的日文件。 */
  async usageByRange(range: ProviderRange): Promise<ProviderUsageView> {
    await this.ensureFresh()
    const { table, billing, resolve } = await this.rateContext()
    const { fromDay, toDay } = rangeDayWindow(range)
    const records = await readRecordsByDayRange(this.dir, fromDay, toDay, () => new Date(), this.logger)
    const cards = providerCards(records, table, resolve, billing)
    // 卡片的通道名：settings profile 的 displayName，否则适配器 provider 名，
    // 使 route 与价格表 tab 同名。
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

  /** host settings 缝（`ctx.settings`），未挂载时 undefined。`ctx.get` 是反射式
   *  访问器：以属性方式读未挂载服务会抛错（without inject），只读视图不得这样做。 */
  private settings(): SettingsLike | undefined {
    return this.hostCtx.get('settings') as SettingsLike | undefined
  }

  /** host LLM 缝（`ctx.llm`），未挂载时 undefined。 */
  private llm(): LlmLike | undefined {
    return this.hostCtx.get('llm') as LlmLike | undefined
  }

  /** host 工作区注册表（`ctx.workspaceRegistry`），未挂载时 undefined。与
   *  `settings`/`llm` 同因，反射读取：服务缺席时本只读视图不得抛。 */
  private workspaceRegistry(): WorkspaceRegistryLike | undefined {
    return this.hostCtx.get('workspaceRegistry') as WorkspaceRegistryLike | undefined
  }

  /** 读价文件，并造出解到该表上的 rate 解析器——概览 / 用量 / 价格表共用这一读法。 */
  private async rateContext(): Promise<{ table: PricingTable; billing: BillingMap; revision: string; resolve: RateResolver }> {
    const { table, billing, revision } = await readPriceFile(this.dir, this.logger)
    return {
      table,
      billing,
      revision,
      resolve: (record) => rateKeyAt(table, record.provider, record.model, record.time),
    }
  }

  /**
   * 订阅额度 tab 的快照：拉取每个内置 provider 的*官方*账户用量（绝不本地估算
   * ——订阅 key 跨工具/设备共享，本地账本不可能知道真实账户花费）。结果按短 TTL
   * 缓存，重复打开不 hammer provider API。
   */
  async quota(): Promise<QuotaView> {
    // 快、无网络：按展示顺序列出已启用的内置 provider。client 再经 `?provider=`
    // 逐个拉卡，使某个慢/失败的 provider 不阻塞其余卡渲染。
    const providers = BUILTIN_PLAN_KEYS.filter((key) => this.planConfig[key]?.enabled !== false)
    // footer 告急点：只从 durable 的最近 'ok' 快照推出。打开本路由绝不能打
    // provider API——该徽章是「上次看时某个窗口快满了」的廉价信号。
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

  /** 单个内置 provider 的官方额度卡，stale-while-revalidate：
   *  - `force` 总是轮询 provider 并重新持久化。
   *  - 非 force 读先复用新鲜内存卡（TTL），再回落到 durable 最近 'ok' 卡，
   *    只在一无所知时才打 provider API。
   *  因此 tab 打开即渲染上次已知数字，client 在数字过旧时跟进 force 刷新。 */
  async quotaCardOf(provider: string, force = false): Promise<QuotaCard> {
    const now = Date.now()
    const config = this.planConfig[provider]
    const enabled = config === undefined || config.enabled !== false
    // 禁用/未知的 provider 是终态：绝不端出过期快照，也不去刷新它。
    if (!enabled || !isBuiltinQuotaPlan(provider)) {
      const card = errorCard(provider, '该 provider 已禁用或没有内置的官方额度查询。')
      this.quotaCardCache.set(provider, { at: now, card })
      return card
    }

    if (!force) {
      const cached = this.quotaCardCache.get(provider)
      if (cached !== undefined && now - cached.at < QUOTA_TTL_MS) return cached.card
      // 没有新鲜内存卡：瞬时端出 durable 的最近 'ok' 卡。它会镜像进 TTL 缓存，
      // 其 fetchedAt 告诉 client 它已过期、该刷新了。
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
    // 只有 'ok' 卡成为 durable 的最近快照；拉取失败或缺 key 便宜可重推，不得掩盖
    // 后续恢复。
    if (card.state === 'ok') {
      void writeQuotaSnapshot(this.dir, provider, card)
        .catch((error: unknown) => {
          this.logger.warn?.(`[tokbook] cannot persist quota snapshot for ${provider}:`, error)
        })
    }
    return card
  }

  /** 强制对全部会话做一次权威再同步（绕过新鲜探针）并报告其启动，供扫描按钮用。 */
  async rescan(): Promise<{ status: 'running' | 'skipped'; lastSyncAt: number | null }> {
    const persistence = this.persistence
    const lastSyncAt = this.lastSyncAt > 0 ? this.lastSyncAt : null
    if (persistence === undefined || this.syncing) return { status: 'skipped', lastSyncAt }
    void listPersistenceSnapshots(persistence, this.logger)
      .then((snapshots) => this.doSync(snapshots, snapshots.map(snapshot => snapshot.header.id)))
      .catch((error: unknown) => {
        // 没有可信的会话清单就无从 walk；报给日志，下次探针自然接手。
        this.logger.error('[tokbook] rescan cannot list sessions:', error)
      })
    return { status: 'running', lastSyncAt }
  }

  /**
   * 价格表视图：每个 provider route 一张卡，每行是该 route 上可计费的模型。
   *
   * route 集合是路由目录（settings 文档的 profiles ∪ live 适配器注册表）经
   * `readPricingView` 与账本计费过的、以及价表写过的每个 route 合并——因此
   * 已离开配置、或只手写了价格的 route 仍可见、可编辑。
   *
   * 账本透镜读的是记录缓存（只计数），因此本 tab 不会为自己铺设让带成本路径
   * 信任的 rate 行。`ensureFresh` 仍先跑——与概览 / 用量 tab 同价的新鲜门。
   */
  async pricingView(): Promise<PricingView> {
    await this.ensureFresh()
    let ledger: LedgerUsage = { byRouteModel: new Map(), byRoute: new Map() }
    try {
      // 账本透镜要的是记录数不是价格：读已预热的记录缓存，而不是折叠 rollup。
      const records = await readCachedRecords(this.dir, () => new Date(), this.logger)
      const { table } = await this.rateContext()
      ledger = ledgerUsageOf(records, table)
    } catch (error) {
      // 读失败不得阻塞 tab：没有账本用量透镜，价表仍可编辑。
      this.logger.warn?.('[tokbook] cannot read ledger usage for pricing view:', error)
    }
    const catalog = await collectRoutes(this.settings(), this.llm(), this.logger)
    return readPricingView(this.dir, catalog, ledger, this.logger)
  }

  /**
   * 从价格表 tab 校验并持久化一份完整价表。body 是完整的期望文件（`$billing` +
   * route → model → 价格段），因此写路径整体替换 `pricing.json`，被省略的
   * (route, model) 停止定价（其记录落到价格未知）。读时成本层在下次读时重算历史
   * ——不重写账本或 rollup。
   */
  async savePricing(body: unknown): Promise<PriceParse & { view: PricingView }> {
    const parsed = parsePriceInput(body)
    if (!parsed.ok) return { ok: false, error: parsed.error, view: await this.pricingView() }
    await writePriceFile(this.dir, parsed.file, this.logger)
    return { ok: true, file: parsed.file, view: await this.pricingView() }
  }

}

/** 同步 append 了新行之后丢掉派生态（`upto` 已覆盖该日的 rollup 会跳过新内容；
 *  缓存可能持有过期 parse）。下次读时两者都无损重建。 */
function invalidateDerivedState(dir: string): void {
  clearRecordCache(dir)
  const rollup = join(dir, ROLLUP_FILE_NAME)
  void unlink(rollup).catch(() => undefined)
  void unlink(`${rollup}.tmp`).catch(() => undefined)
}

export default TokenUsageBook
