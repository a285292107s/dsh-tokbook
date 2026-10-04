/**
 * host 半区：durable 事件流实时记账 + 权威再同步（`sessionPersistence` 日志，
 * request-id 去重）。实时 hook 是新鲜度的**主路径**；权威 walk 只做自愈
 * （折叠失败、插件缺席期间写下的行），排在后台，读路径绝不 await 它——
 * 成本与理由见 {@link TokenUsageBook.ensureFresh}。
 *
 * WIRE NOTES：事件与持久化面是鸭子类型（待 DSH 类型包接入可收紧）。持久化面
 * 0.1.7 起是 `list()`（每会话 header + opaque revision）与 `open(id,'read')`，
 * 旧的 `listSnapshots()` / `inspect()` 仍被 `sync.ts` 接受。
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type {
  BillingMap, HolidayCalendar, PlanConfig, PricingTable, PricingView, ProviderRange, ProviderUsageView, QuotaCard, QuotaView, SessionUsageView, SyncStatusView, TokBookConfig, TokBookOverview, UsageRecord, WorkspaceUsageRow,
} from './types.ts'
import { totalsTokens } from './types.ts'
import { coercePlansConfig, validateConfig } from './config.ts'
import { defaultDataDir, warnIfForeignOwner, writeOwnerMarker } from './ledger.ts'
import { UsageLog } from './usage-log.ts'
import { modelOfEvent, providerOfEvent, recordOfEvent, type SessionEventLike } from './usage-record.ts'
import { autoSyncIfNeeded, listPersistenceSnapshots, syncHistory, type SyncDeps, type SyncPersistence } from './sync.ts'
import { readSyncProgress, writeSyncProgress } from './sync-state.ts'
import {
  attachCosts, buildSummary, listDayFiles, rangeDayWindow, readCachedRecords,
  readRecordsByDayRange, snapshotBaseline, staleSessionIds, warmRecordCache,
  type PersistenceSnapshotLike, type RateResolver,
} from './stats.ts'
import { workspaceRows, type WorkspaceRef } from './workspaces.ts'
import {
  cnyTable, parsePriceInput, rateKeyAt, readPriceFile, writePriceFile,
  type PriceParse,
} from './pricing.ts'
import { dayKeyOf, holidaySet } from './price-format.ts'
import { ledgerUsageOf, readPricingView, type LedgerUsage } from './pricing-view.ts'
import { collectRoutes, routeLabels, type LlmLike, type SettingsLike } from './route-catalog.ts'
import { modelRowsOf, providerCards } from './by-provider.ts'
import { registerTokBookPricingRoutes, registerTokBookQuotaRoute, registerTokBookRoutes, registerTokBookSessionRoute, registerTokBookUsageRoute, type WebServerLike } from './routes.ts'
import { buildSessionUsageView, readSessionJoinEvents } from './session-usage.ts'
import { errorCard, isBuiltinQuotaPlan, isQuotaAlert, COMMAND_CODE_PROVIDER, OPENCODE_GO_PROVIDER } from './quota.ts'
import { fetchOfficialQuota, type CredentialResolver } from './quota-official.ts'
import { readQuotaSnapshot, writeQuotaSnapshot } from './quota-cache.ts'

const BUILTIN_PLAN_KEYS: readonly string[] = [OPENCODE_GO_PROVIDER, COMMAND_CODE_PROVIDER]
const QUOTA_TTL_MS = 30_000
/**
 * 两轮后台权威 walk 之间的最小间隔。walk 只承担自愈，新鲜度由 `session/event`
 * 实时 hook 保证；而当前会话每条消息都会让 revision 漂移，所以节流按「秒」而
 * 不按「次」（walk 的成本见 {@link TokenUsageBook.ensureFresh}）。
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
/** settings 缝是**表单**服务：`describe()` 按 profile entry id 给出每个插件的
 *  活动配置值（只投影可热改的字段）。价表目录要的正是「用户声明了什么」，故在
 *  这里把它收成 route-catalog 认的按命名空间取值。 */
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
  /** host context：价格表 tab 经它读 settings/llm 缝。 */
  private readonly hostCtx: Context
  /** 用户配置的额度计划覆盖，按 provider route 键（已纠错）。 */
  private readonly planConfig: Record<string, PlanConfig>
  /** 进程内官方额度卡缓存（TTL {@link QUOTA_TTL_MS}）。'ok' 卡还会镜像到 durable
   *  快照，重启后 tab 靠它零延迟渲染。 */
  private quotaCardCache = new Map<string, { at: number; card: QuotaCard }>()
  private credentials: CredentialResolver | undefined
  private persistence: SyncPersistence | undefined
  private lastSyncAt = 0
  /** 上一轮 walk **开始**的时刻，用于 {@link SYNC_MIN_INTERVAL_MS} 节流。 */
  private lastWalkAt = 0
  /** 在飞的那轮同步（首装回填或权威 walk），**同步互斥的唯一判据**；占位与归位
   *  都经 {@link startWalk}，冷账本的首次读据它等待。 */
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
    // 模块级 HMR **不 await** 这条处置器，继任者拿到全新的模块级 map；跨该边界的
    // 去重由磁盘重建兜底（docs/HMR.md §4 与 usage-log）。
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

    // 单写者守卫（docs/CONTRACTS.md §3）：别的存活 host 拥有本目录时只告警、
    // 绝不致命——双写者会竞争 rollup/cache。此时**不写**本进程的标记：覆盖掉
    // 活属主的标记，会让它退出后留下的标记被下一进程读成「陈旧」而静默接管。
    void warnIfForeignOwner(this.dir, this.logger).then((foreign) => {
      if (!foreign) return writeOwnerMarker(this.dir)
    })
    // 预热只是优化：数据目录不可读（`path` 指向一个已存在的文件 → readdir 报
    // ENOTDIR）时按需读照样工作，但这条未处理的 rejection 会被 DSH 启动器的
    // `unhandledRejection` 处理接住并 exit(1) —— 插件的一个坏路径不该带走整个宿主。
    void warmRecordCache(this.dir, this.logger).catch((error: unknown) => {
      this.logger.warn?.('[tokbook] cannot warm the ledger record cache (data directory unreadable); reads will load day files on demand:', error)
    })

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
      // 一次性历史回填也在后台跑，并与探针触发的权威 walk 共用同一互斥
      // （`startWalk`）——冷账本上因此不会并行两轮全量 walk。
      this.startWalk(async () => {
        try {
          const result = await autoSyncIfNeeded(this.syncDeps(persistence, failed), this.dir)
          if (this.disposed || result === null) return
          this.logger.info?.(`[tokbook] first-run sync: ${String(result.added)} added, ${String(result.skipped)} skipped, ${String(result.failedSessions)} failed sessions`)
          // 这次一次性回填刚折叠了全部会话；立刻记下签名，使现在到首次概览之间
          // 的重启不重走一切。
          try {
            this.setBaseline(await listPersistenceSnapshots(persistence, this.logger), failed)
          } catch (error) {
            this.logger.warn?.('[tokbook] cannot record baseline after first-run sync:', error)
          }
          // 回填 append 了新行：重读缓存，使首次概览看到它们。
          await warmRecordCache(this.dir, this.logger)
        } catch (error) {
          this.logger.error('[tokbook] first-run sync failed:', error)
        }
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
      // 注册挂在**注入作用域**上：webServer 单独重载时它们随之一并撤销，而不是留在
      // 外层 ctx 上等插件卸载。`register` 撞到同一 (kind, path) 会抛错，所以这条
      // 作用域关系不是整洁问题。
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
    })
  }

  /**
   * 读之前的**廉价**新鲜度探针：列出持久化会话、（用 revision）挑出漂移的，把
   * 需要折的行交给后台的权威 walk，然后立刻把会话清单交回调用方（各会话的 `cwd`，
   * 按工作区一节用它 join）。
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
    // 冷账本（还没有日文件）时等一轮，否则首次安装会把「还没回填完」显示成
    // 「没有记录」；账本一旦有行就不再等（口径见 docs/CONTRACTS.md §2）。
    if (this.walkInFlight !== null && (await listDayFiles(this.dir)).length === 0) {
      await this.walkInFlight
    }
    return snapshots
  }

  /**
   * 把一轮权威 walk 排到后台（或判定这一轮不必走）。
   *
   * - 已有一轮在飞 → 跳过：它结束时写下的基线覆盖同一批快照，重复启动没有收益。
   * - **没有任何基线签名的会话不受节流**：首次安装的回填、以及刚开的新会话都属于
   *   这一类——它们便宜（新会话的日志很短）而且该立刻同步。
   * - 其余（已有基线但 revision 漂移，典型就是当前会话）按 {@link SYNC_MIN_INTERVAL_MS}
   *   节流，避免持续重读那份大日志。
   */
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

  /** 一轮同步的依赖：一次性回填与权威 walk 共用；`failed` 收集读不了日志的会话。 */
  private syncDeps(persistence: SyncPersistence, failed: Set<string>): SyncDeps {
    return {
      persistence,
      log: this.log,
      recordCompaction: this.recordCompaction,
      // 单事件折叠失败的诊断走 ctx logger，而不是 sync.ts 里缺省的回落 console。
      logger: this.logger,
      onSessionFailure: (id, error) => {
        failed.add(id)
        this.logger.error(`[tokbook] cannot fold session ${id}:`, error)
      },
    }
  }

  /**
   * 启动一轮后台同步并占用同步互斥。首装回填与权威 walk 都经这里：并行两轮全量
   * walk 只是 I/O 翻倍，且两条轮次会互相覆盖同步基线。
   *
   * 互斥在**同步段**内占位，故返回时「是否真的跑了起来」已是定论——扫描按钮据此
   * 如实答 running / skipped，不必等整轮 walk 落地。落定后归位 `null`，冷账本上
   * 的第一次读据此判断它是否还在飞。
   */
  private startWalk(run: () => Promise<void>): boolean {
    if (this.walkInFlight !== null) return false
    const tracked = run().finally(() => {
      if (this.walkInFlight === tracked) this.walkInFlight = null
    })
    this.walkInFlight = tracked
    return true
  }

  /** 权威 walk：把（有变化的）持久化日志折叠进账本，再记下同步后的 revision 签名。
   *  @returns 本轮是否真的跑了起来（已有一轮在飞时为 false）。 */
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
        // 时长写进日志：这条路径的成本全在「整份日志重读重折叠」上，它是否拖慢了读路径
        // 只能从这行看出来。
        this.logger.info?.(`[tokbook] sync: ${String(result.added)} added, ${String(result.skipped)} skipped, ${String(result.failedSessions)} failed sessions (${String(sessionIds.length)} of ${String(snapshots.length)} sessions) in ${String(Date.now() - startedAt)} ms`)
      } catch (error) {
        this.syncStatus = 'error'
        this.syncError = error instanceof Error ? error.message : String(error)
        this.logger.error('[tokbook] sync failed:', error)
      }
    })
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
    // 精简 wire 载荷：价表、rateRows、byModel 不过 wire（成本已折进 cost 字段）；
    // byModel / byWorkspace 随用量明细 tab 走窗口载荷，价格未知在用量明细 / 价格表
    // 里报出，unpricedModels 因此也不占 wire。
    const { pricing: _pricing, rateRows: _rateRows, byHour: _byHour, byModel: _byModel, unpricedModels: _unpricedModels, ...slim } = costed
    return {
      ...slim,
      totalTokens: totalsTokens(costed.total),
      updatedAt: Date.now(),
      // 账本行数 = 计费调用 + 失败行（失败不计入 requests）。
      records: costed.total.requests + (costed.total.failures ?? 0),
      lastEventAt: summary.lastEventAt,
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
    const records = await readRecordsByDayRange(this.dir, fromDay, toDay, this.logger)
    const cards = providerCards(records, table, resolve, billing)
    // 通道名走 `routeLabels`（settings displayName 优先于适配器名），使 route 与
    // 价格表 tab 同名。
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

  /**
   * 单个会话的账本视图：token 与钱只取账本（`readCachedRecords` 按 sessionId 过滤），
   * 轮次 / 步骤在请求时 join 该会话的持久化日志——日志读不到时那些行进「轮次未知」，
   * 口径与理由见 docs/adr/0001-turn-attribution-read-time-join.md。
   *
   * `todaySpend` 不再做一份聚合：它直接取概览同一条路径的今日一行，抬头那个参照系
   * 因此与浮窗逐分一致。
   */
  async sessionUsage(sessionId: string): Promise<SessionUsageView> {
    const overview = await this.overview()
    const { table, billing, resolve } = await this.rateContext()
    const records = await readCachedRecords(this.dir, this.logger)
    const events = await readSessionJoinEvents(this.persistence, sessionId, this.logger)
    const now = Date.now()
    return buildSessionUsageView({
      sessionId,
      records,
      events,
      pricing: table,
      billing,
      resolve,
      todaySpend: overview.byDay.find(row => row.day === dayKeyOf(now))?.spend ?? 0,
      updatedAt: now,
    })
  }

  /** host settings 缝（`ctx.settings`），未挂载时 undefined。`ctx.get` 是反射式
   *  访问器：以属性方式读未挂载服务会抛错（without inject），只读视图不得这样做。
   *  读值走 `describe()`——`settings` 服务没有按命名空间的 `get`。 */
  private settings(): SettingsLike | undefined {
    const forms = this.hostCtx.get('settings') as SettingsFormsLike | undefined
    if (forms === undefined || typeof forms.describe !== 'function') return undefined
    try {
      const byNs = new Map(forms.describe().map(row => [row.ns, row.value]))
      return { get: (ns: string) => byNs.get(ns) }
    } catch (error) {
      // 读不到声明不阻塞 tab：目录退化成只有 live 适配器注册表。
      this.logger.warn?.('[tokbook] cannot describe settings namespaces:', error)
      return undefined
    }
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

  /** 读价文件，并造出解到该表上的 rate 解析器——概览 / 用量 / 价格表共用这一读法。
   *  年历一并解成日期集合：`workdays` 时段靠它把法定节假日排除在高峰之外。
   *
   *  返回的 `table` 是**计价用的表**：按美元报价的通道已折成人民币（币种口径见
   *  docs/CONTRACTS.md §2）。`resolve` 用的是原表——换算只改数字、不改段身份，
   *  两表认的 rate 身份完全一样。 */
  private async rateContext(): Promise<{
    table: PricingTable
    billing: BillingMap
    calendar: HolidayCalendar
    revision: string
    resolve: RateResolver
  }> {
    const { table, billing, calendar, revision, currency, fx } = await readPriceFile(this.dir, this.logger)
    const holidays = holidaySet(calendar)
    return {
      table: cnyTable(table, currency, fx),
      billing,
      calendar,
      revision,
      resolve: (record) => rateKeyAt(table, record.provider, record.model, record.time, holidays),
    }
  }

  /**
   * 订阅额度 tab 的清单：只回已启用的内置 provider 与 footer 告急位，**绝不打
   * provider API**——绝不本地估算（订阅 key 跨工具/设备共享，本地账本不可能知道
   * 真实账户花费），拉卡也留给逐卡的 {@link quotaCardOf}。
   */
  async quota(): Promise<QuotaView> {
    // 按展示顺序列出；client 再经 `?provider=` 逐个拉卡，使某个慢/失败的
    // provider 不阻塞其余卡渲染。
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
      // 只为内置计划缓存：`provider` 是调用方给的任意字符串，非内置的集合没有上界，
      // 而这个 Map 从不清理。内置（含被禁用的）计划集合有界，可以缓存。
      if (isBuiltinQuotaPlan(provider)) this.quotaCardCache.set(provider, { at: now, card })
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
    // 只有 'ok' 卡成为 durable 快照（CONTRACTS §2 的门规则）；拉取失败或缺 key
    // 便宜可重推，不得掩盖后续恢复。
    if (card.state === 'ok') {
      void writeQuotaSnapshot(this.dir, provider, card)
        .catch((error: unknown) => {
          this.logger.warn?.(`[tokbook] cannot persist quota snapshot for ${provider}:`, error)
        })
    }
    return card
  }

  /**
   * 同步状态探针的载荷：只读内存里的调度器状态，**不触碰账本**。读路径的廉价观察点
   * ——client 追一轮 walk 落定时读它（≈0 ms），落定后再拉一次概览；反过来拿概览当探针
   * 就是每 500 ms 一次全量聚合，而 tick 次数正比于 walk 耗时。
   */
  syncState(): SyncStatusView {
    return {
      status: this.syncStatus,
      error: this.syncError,
      lastSyncAt: this.lastSyncAt > 0 ? this.lastSyncAt : null,
    }
  }

  /**
   * 强制对全部会话做一次权威再同步（绕过新鲜探针）并报告其启动，供扫描按钮用。
   * 会话清单**先取到**才占互斥：先答 `running` 再被在飞的那轮顶掉，等于用户按了
   * 扫描却什么都没发生。取清单只读每会话元数据，与新鲜度探针同价。
   */
  async rescan(): Promise<{ status: 'running' | 'skipped'; lastSyncAt: number | null }> {
    const persistence = this.persistence
    const lastSyncAt = this.lastSyncAt > 0 ? this.lastSyncAt : null
    if (persistence === undefined) return { status: 'skipped', lastSyncAt }
    let snapshots: readonly PersistenceSnapshotLike[]
    try {
      snapshots = await listPersistenceSnapshots(persistence, this.logger)
    } catch (error) {
      // 没有可信的会话清单就无从 walk；报给日志，下次探针自然接手。
      this.logger.error('[tokbook] rescan cannot list sessions:', error)
      return { status: 'skipped', lastSyncAt }
    }
    const started = this.doSync(snapshots, snapshots.map(snapshot => snapshot.header.id))
    return { status: started ? 'running' : 'skipped', lastSyncAt }
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
      const records = await readCachedRecords(this.dir, this.logger)
      const { table, calendar } = await this.rateContext()
      ledger = ledgerUsageOf(records, table, holidaySet(calendar))
    } catch (error) {
      // 读失败不得阻塞 tab：没有账本用量透镜，价表仍可编辑。
      this.logger.warn?.('[tokbook] cannot read ledger usage for pricing view:', error)
    }
    const catalog = await collectRoutes(this.settings(), this.llm(), this.logger)
    return readPricingView(this.dir, catalog, ledger, this.logger)
  }

  /**
   * 从价格表 tab 校验并持久化一份完整价表。body 是完整的期望文件（`$billing` +
   * route → model → 该模型的当前价），因此写路径整体替换 `pricing.json`，被省略的
   * (route, model) 停止定价（其记录落到价格未知；金额在下次读时重算，见
   * docs/CONTRACTS.md §2）。
   *
   * **不回视图**：自动保存是全程最热的写路径（每次停止输入一拍、或字段失焦就写
   * 一次），而 client 读响应只取 `ok` / `error`——回一份 `pricingView()` 等于每次
   * 白跑一次全表读与一份大载荷。
   */
  async savePricing(body: unknown): Promise<PriceParse> {
    const parsed = parsePriceInput(body)
    if (!parsed.ok) return parsed
    await writePriceFile(this.dir, parsed.file, this.logger)
    return parsed
  }

}

export default TokenUsageBook
