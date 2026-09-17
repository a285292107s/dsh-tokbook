/**
 * host 半区：durable 事件流实时记账 + 权威再同步（`sessionPersistence` 日志，
 * request-id 去重）。实时 hook 是新鲜度的**主路径**；权威 walk 是自愈路径
 * （折叠失败、插件缺席期间写下的行），**排在后台，读路径绝不 await 它**——
 * 当前会话每来一条消息就变一次 revision，await 它等于每次打开都重读那份
 * 完整会话日志（实测单份可达 8.6 MB 压缩，秒级）。
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
import { modelRowsOf, providerCards } from './by-provider.ts'
import { registerTokBookPricingRoutes, registerTokBookQuotaRoute, registerTokBookRoutes, registerTokBookUsageRoute, type WebServerLike } from './routes.ts'
import { errorCard, isBuiltinQuotaPlan, isQuotaAlert, COMMAND_CODE_PROVIDER, OPENCODE_GO_PROVIDER } from './quota.ts'
import { fetchOfficialQuota, type CredentialResolver } from './quota-official.ts'
import { readQuotaSnapshot, writeQuotaSnapshot } from './quota-cache.ts'

const BUILTIN_PLAN_KEYS: readonly string[] = [OPENCODE_GO_PROVIDER, COMMAND_CODE_PROVIDER]
const QUOTA_TTL_MS = 30_000
/**
 * 两轮后台权威 walk 之间的最小间隔。walk 对漂移会话**整份日志重读重折叠**，
 * 而当前会话每条消息都会漂移——不节流就是每次打开（概览 / 通道用量 / 价格表）
 * 都重读那份日志。它只承担自愈（折叠失败、别的进程写下的行），新鲜度由
 * `session/event` 实时 hook 保证，所以间隔按「秒」而不按「次」。
 */
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
  /** 上一轮 walk **开始**的时刻，用于 {@link SYNC_MIN_INTERVAL_MS} 节流。 */
  private lastWalkAt = 0
  /** 在飞的那轮 walk（含启动时的一次性回填）。只在冷账本时被读路径 await。 */
  private walkInFlight: Promise<void> | null = null
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
      // 一次性历史回填也在后台跑；它被记进 `walkInFlight`，使冷账本上的第一次读
      // 能等它（只有那时等待才有意义：账本一条记录都没有，没什么可显示的）。
      this.walkInFlight = autoSyncIfNeeded(this.syncDeps(persistence, failed), this.dir)
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
   * 读之前的**廉价**新鲜度探针：列出持久化会话、（用 revision）挑出漂移的，把
   * 需要折的行交给后台的权威 walk，然后立刻把会话清单交回调用方（各会话的 `cwd`，
   * 按工作区一节用它 join）。签名集从持久化基线播种，重启后只走变更的会话。
   *
   * **读路径不 await walk。** 理由是实测出来的：当前会话的消息一落日志 revision
   * 就变，探针因此永远报它 stale，而 walk 会把它整份日志重读重折叠（单份日志
   * 可达 8.6 MB 压缩 / 数万事件），于是「打开概览 / 通道用量 / 价格表」= 秒级等待。
   * 那些行其实早已由 `session/event` 实时 hook 记进账本，读路径要的是「账本当前
   * 内容」，不是「此刻再走一遍历史」。
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
    this.scheduleSync(snapshots, staleSessionIds(this.syncedOnce, this.syncedBySession, snapshots))
    // 冷账本（本目录还没有任何日文件）时等一轮：否则首次安装 / 换数据目录后
    // 打开，会把「还没回填完」显示成「没有记录」。账本一旦有行就不再等。
    if (this.walkInFlight !== null && (await listDayFiles(this.dir)).length === 0) {
      await this.walkInFlight
    }
    return snapshots
  }

  /**
   * 把一轮权威 walk 排到后台（或判定这一轮不必走）。
   *
   * - 没有漂移会话 → 什么都不做，状态归位 `done`。
   * - 已有一轮在飞 → 跳过：它结束时写下的基线覆盖同一批快照，重复启动没有收益。
   * - **没有任何基线签名的会话不受节流**：首次安装的回填、以及刚开的新会话都属于
   *   这一类——它们便宜（新会话的日志很短）而且该立刻同步。
   * - 其余（已有基线但 revision 漂移，典型就是当前会话）按 {@link SYNC_MIN_INTERVAL_MS}
   *   节流，避免持续重读那份大日志。
   */
  private scheduleSync(snapshots: readonly PersistenceSnapshotLike[], stale: readonly string[]): void {
    if (stale.length === 0) {
      if (!this.syncing) this.syncStatus = 'done'
      return
    }
    if (this.syncing) return
    const neverSynced = stale.some((id) => !this.syncedBySession.has(id))
    if (!neverSynced && Date.now() - this.lastWalkAt < SYNC_MIN_INTERVAL_MS) return
    void this.doSync(snapshots, stale)
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
    const startedAt = Date.now()
    this.lastWalkAt = startedAt
    const failed = new Set<string>()
    const run = (async (): Promise<void> => {
      try {
        const result = await syncHistory(
          this.syncDeps(persistence, failed),
          { snapshots, sessionIds },
        )
        this.lastSyncAt = Date.now()
        this.syncStatus = 'done'
        this.setBaseline(snapshots, failed)
        if (result.added > 0) invalidateDerivedState(this.dir)
        // 时长写进日志：这条路径的成本全在「整份日志重读重折叠」上，而它是否
        // 拖慢了读路径，只能从这行看出来（2026-09-15 那次卡顿排查就是靠它）。
        this.logger.info?.(`[tokbook] sync: ${String(result.added)} added, ${String(result.skipped)} skipped, ${String(result.failedSessions)} failed sessions (${String(sessionIds.length)} of ${String(snapshots.length)} sessions) in ${String(Date.now() - startedAt)} ms`)
      } catch (error) {
        this.syncStatus = 'error'
        this.syncError = error instanceof Error ? error.message : String(error)
        this.logger.error('[tokbook] sync failed:', error)
      } finally {
        this.syncing = false
      }
    })()
    this.walkInFlight = run
    await run
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

  /** 当前聚合概览快照（带成本，含按日趋势）。 */
  async overview(): Promise<TokBookOverview> {
    await this.ensureFresh()
    const { table, billing, revision, resolve } = await this.rateContext()
    const summary = await buildSummary(this.dir, () => new Date(), resolve, this.logger, { pricingRevision: revision })
    const costed = attachCosts(summary, table, billing)
    const records = await readCachedRecords(this.dir, () => new Date(), this.logger)
    let lastEventAt: number | null = null
    for (const record of records) {
      if (lastEventAt === null || record.time > lastEventAt) lastEventAt = record.time
    }
    // 精简 wire 载荷：价表、rateRows、byModel 不过 wire（成本已折进 cost 字段）；
    // byModel / byWorkspace 随用量明细 tab 走窗口载荷，不在这里；unpricedModels 自
    // D-032 起概览不再渲染（价格未知在用量明细 / 价格表里），也不占 wire。
    const { pricing: _pricing, rateRows: _rateRows, byHour: _byHour, byModel: _byModel, unpricedModels: _unpricedModels, ...slim } = costed
    return {
      ...slim,
      totalTokens: totalsTokens(costed.total),
      updatedAt: Date.now(),
      records: records.length,
      lastEventAt,
      syncStatus: this.syncStatus,
      syncError: this.syncError,
    }
  }

  /**
   * 用量明细「按工作区」一行：账本记录按其会话所属工作区折叠。该 join 需要两条
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

  /**
   * 一个回看窗口的三种切法（按模型 / 按工作区 / 按通道），用量明细 tab 的载荷。
   * 复用概览的权威新鲜门与价表；只读窗口内的日文件（`all` 不设下界）。
   */
  async usageByRange(range: ProviderRange): Promise<ProviderUsageView> {
    const snapshots = await this.ensureFresh()
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
      // 页头那句「窗口合计」的四个数。与按模型 / 按通道同源（见 modelRowsOf），
      // 所以三种切法的合计逐分相等。
      totalTokens: cards.reduce((sum, card) => sum + card.tokens, 0),
      totalRequests: cards.reduce((sum, card) => sum + card.requests, 0),
      totalSpend: cards.reduce((sum, card) => sum + card.spend, 0),
      totalSubscriptionValue: cards.reduce((sum, card) => sum + card.subscriptionValue, 0),
      byModel: modelRowsOf(cards),
      byWorkspace: this.workspaceUsage(records, snapshots, table, billing, resolve),
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
