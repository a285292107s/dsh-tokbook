/**
 * dsh-tokbook 共享领域类型（纯类型；无运行时 import）。
 *
 * 成本是叠加层：按 (route, model) 解析人工价表（¥ / 百万 token）。金额拆成
 * metered（真实消费）与 subscription（订阅价值）。改价只重算历史计价，不重建聚合。
 */

/** 单次模型调用的 provider token 桶。 */
export interface UsageFields {
  /** 未命中缓存的输入 token。计费输入 = input + cacheRead + cacheWrite。 */
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/** 记录来源：普通请求、compaction summarize、失败尝试。 */
export type UsageRecordKind = 'request' | 'compaction' | 'failure'

/** 一行 JSONL：一次 provider 模型调用（成功或失败）。 */
export interface UsageRecord {
  /** 稳定请求身份（去重键）：assistant message id，或合成的
   * `compaction:<session>:<seq>` / `failure:<session>:<seq>`。 */
  requestId: string
  /** 会话事件墙钟时间，epoch 毫秒。 */
  time: number
  sessionId: string
  /** 产出消息的 provider model id；失败行携带会话最近已知 route model
   * （从未观测到时为 `''`）。 */
  model: string
  provider?: string
  usage?: UsageFields
  kind?: UsageRecordKind
  failureCode?: string
}

/** 一组记录上的聚合 token 计数。 */
export interface UsageTotals {
  /** 计入次数的计费调用数：普通请求 + compaction summarize。失败不计入。 */
  requests: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** 组内 compaction 次数；旧 rollup 省略（读作 0）。 */
  compactions?: number
  failures?: number
  failuresByCode?: Record<string, number>
  /** 组内**用量未知**的计费调用数：通道没回报 `usage`（或回报的桶非法）。
   *  这类调用计入 `requests`，却没有 token 可加——它们对四桶的贡献是**未知**，
   *  不是零消耗，所以单独计数而不是让它们混进 0。`assistant/message` 与
   *  `compaction/summary` 都会走到这里（后者的行在缺 `usage` 时同样落盘）。
   *  旧 rollup 省略（读作 0）。 */
  usageUnknown?: number
}

/** 按日聚合行，本地日期 `YYYY-MM-DD`。 */
export interface UsageDayRow {
  day: string
  totals: UsageTotals
  /** 当日真实消费（¥）；仅成本层跑过（`attachCosts`）后才有。token-only
   * 汇总与落盘 rollup 都不含——读时再由 rateRows 重算。 */
  spend?: number
  /** 当日订阅价值（¥，非现金）；在场条件同 {@link spend}。 */
  subscriptionValue?: number
}

/** 按小时 × 模型行，本地 `YYYY-MM-DDTHH`。 */
export interface UsageHourRow {
  hour: string
  model: string
  totals: UsageTotals
}

/** 按模型聚合行（仅 token；成本稍后叠加）。 */
export interface UsageModelRow {
  /** Provider route key（尽力而为）；未知为 `''`。 */
  provider: string
  model: string
  totals: UsageTotals
}

/** 单个价格段的每百万 token 价格（人民币）。cache 桶省略时回落到 input 价。
 *  文件里的数**永远**是人民币：美元只是价格表读写面的换算（见 {@link FxSetting}）。 */
export interface ModelPricing {
  inputPerMillion: number
  outputPerMillion: number
  cacheReadPerMillion?: number
  cacheWritePerMillion?: number
}

/** 价文件的汇率（保留键 `$fx`）：1 美元值多少元，手填。**只服务价格表的读写面**——
 *  它把人民币价换算成美元显示 / 把美元输入换算回人民币落盘，host 的计价路径不读它，
 *  所以改汇率不动任何历史金额。缺席 = 未设汇率（美元面不可用）。 */
export interface FxSetting {
  /** 每 1 美元的人民币数；必须是正的有限数。 */
  cnyPerUsd: number
}

/** 通道金额如何计：真实消费 vs 订阅价值。route 级事实（价表 `$billing`）；
 * 省略 = metered。 */
export type BillingNature = 'metered' | 'subscription'

/**
 * 例外时段的适用日集合。四档的语义是**逐字**的，其中两档只差在法定节假日的处理上：
 * - `daily` — 每天；
 * - `workdays` — 周一至周五**且**不在法定节假日年历里（官方峰谷价说的「工作日」就是这一档）；
 * - `weekdays` — 周一至周五，含法定节假日；
 * - `weekends` — 周六、周日。
 *
 * 周一至周五以外的调休上班日（把周末调成上班）**不进任何集合**：调休只把周末变成上班，
 * 而周末无论上不上班都是闲时价，所以年历只需收放假日，不必收调休上班日。
 */
export type DaySet = 'daily' | 'workdays' | 'weekdays' | 'weekends'

/**
 * 法定节假日年历：`YYYY` → 该年的放假日区间（`[起, 止]` 闭区间，`YYYY-MM-DD`）。
 * 国家每年底公布一次，因此按年收录；文件里查不到那一年就是**未知**（空集），
 * 而不是「那年没有节假日」——`workdays` 因此退化为按周一至周五全额高峰。
 */
export type HolidayCalendar = Record<string, HolidayRange[]>

/** 一段连续放假日，闭区间。 */
export interface HolidayRange {
  /** 首日（含）。 */
  start: string
  /** 末日（含）。 */
  end: string
}

/** 价格段的例外时段：本地日的小时区间（`[start, end)`，`24` 关日），按星期
 * 集合生效，自带四档人民币/百万词元。生效时叠在段的基准价之上——省略的档沿用基准价。 */
export interface PriceSlot {
  days: DaySet
  /** 覆盖的首小时，0–23。 */
  start: number
  /** 停止覆盖的小时（不含），1–24。 */
  end: number
  rates: ModelPricing
}

/** 单个 (route, model) 的一段价格：从 `from`（epoch ms；整点）到同 (route, model)
 * 下一段开始。列表按 `from` 升序，因此「T 时刻的价」= 最后一个 `from ≤ T` 的段；
 * 没有任何段覆盖的时刻 → 价格未知（金额按 ¥0 计）。`from` 取 {@link EARLIEST}
 * 只出现在读旧文件时，视图层会把它迁移成真实日期。 */
export interface PriceSegment {
  from: number
  rates: ModelPricing
  /** 例外时段，按开始小时升序；空/缺 = 仅基准价。两时段永不重叠（写路径
   * 拒绝可能同时生效的一对；读路径丢弃较晚的那个），故任一时刻至多一个
   * 时段生效。 */
  slots?: PriceSlot[]
}

/** 例外时段的身份：起始小时 + 星期集合。段内唯一——共享两者会在整个公共
 * 区间重叠，写路径拒绝——因此 rate 行可在无价格时仍标明当时计费所依据的
 * 时段。改时段自身费率或结束小时会重算其历史；移动起始小时 / 星期集合
 * （或删除）则让那段历史变成「价格未知」。 */
export interface SlotRef {
  start: number
  days: DaySet
}

/** 手工价表：provider route key → 精确 model 字符串 → 该 (route, model) 的
 * 价格时间轴。空/缺列表 = 价格未知。 */
export type PricingTable = Record<string, Record<string, PriceSegment[]>>

/** route → 计费性质。价表保留键 `$billing`。 */
export type BillingMap = Record<string, BillingNature>

/** 价文件里的法定节假日年历形态（保留键 `$calendar`）。 */
export type PricingCalendarInput = Record<string, HolidayRange[]>

/** 记录计价所依据的身份：生效段的起始时刻 + 段内生效的例外时段
 * （null/缺 = 该段基准价）。只存身份、不存数字，改价后下次读即重算历史。 */
export interface RateKey {
  from: number
  slot?: SlotRef | null
}

export const UNPRICED_KEY: RateKey = { from: -1 }

/** 例外时段在 wire / `pricing.json` 里的形态。 */
export interface PricingSlotInput {
  days: DaySet
  start: number
  end: number
  inputPerMillion: number
  outputPerMillion: number
  cacheReadPerMillion?: number
  cacheWritePerMillion?: number
}

/** 价格段在 wire / `pricing.json` 里的形态：`from` 是本地日（`YYYY-MM-DD`）
 * 或本地日+整点（`YYYY-MM-DDTHH:00`），**必有**——一段价从某一刻起生效，
 * 没有生效时刻的形态只在旧文件里存在，读路径会把它迁移掉。
 * 刻意扁平——文件手写，段直接带四档基准价（及覆盖它们的例外时段）。 */
export interface PricingSegmentInput {
  from: string
  inputPerMillion: number
  outputPerMillion: number
  cacheReadPerMillion?: number
  cacheWritePerMillion?: number
  slots?: PricingSlotInput[]
}

/** route 上可计费的模型：账本记录的精确串 + 来源给出的展示名
 * （settings `models[].name`，否则适配器目录的 `name`）——模型选择器同源。 */
export interface ModelEntry {
  id: string
  /** 展示名；无人命名该串时省略。 */
  name?: string
}

/** 路由目录条目：可计费模型 + 卡片标题。由 `route-catalog.ts` 产出、
 * `pricing-view.ts` 消费，故形状声明在此——产出方不得为自身输出 import
 * 消费方。 */
export interface RouteCatalogEntry {
  route: string
  label: string
  models: readonly ModelEntry[]
}

/** 价格表一张 route 卡的模型行。 */
export interface PricingModelView {
  /** 账本计费所用的精确 model 串。 */
  model: string
  /** 展示名（settings `models[].name`，否则适配器目录 `name`）。配置里没有这一串时
   * 省略（账本记得它，或价表里手写了它）——选择器回落到 `provider/model` 的方式。 */
  name?: string
  /** settings / 适配器目录是否列出该串（即 route 上可调用）。false 有两种来历——
   * 账本记得、配置已删，或只在价表里手写。界面不再播报它，只作 route 卡内的排序键。 */
  configured: boolean
  records: number
  firstAt?: number
  lastAt?: number
  /** 落在所有价格段之外的记录数（按各自时间戳）——这些记 ¥0。省略 =
   * 未知（无账本透镜），**不等于** 0：有价的行仍可能有未定价历史。 */
  unpriced?: number
  /** 按生效序的价格段（空 = 价格未知，计 ¥0）。行内显示的价由 client 从这些段**按当前时刻**
   *  现算（生效段 + 生效时段），所以 wire 上不带一份会过期的「当前价」。 */
  segments: PricingSegmentInput[]
}

/** 价格表 tab 的一张 route 卡。 */
export interface PricingRouteView {
  route: string
  /** 展示名：settings `displayName` → 适配器 provider 名 → route key 本身。 */
  label: string
  /** 计费性质（`$billing`；默认 metered）。 */
  billing: BillingNature
  /** 整条 route 的账本记录数（驱动卡片排序）。 */
  records: number
  models: PricingModelView[]
}

/** 价格表视图的 wire 载荷。 */
export interface PricingView {
  /** 每个 provider route 一卡：有账本用量的在前（用量多的优先），其余按
   * route key。 */
  routes: PricingRouteView[]
  /** 法定节假日年历（价文件 `$calendar` 原样）。`workdays` 时段靠它把节假日
   * 排除在高峰之外；缺一年就是那一年未知。 */
  calendar: PricingCalendarInput
  /** 账本覆盖到、但年历里没有的年份——`workdays` 在那几年会多算高峰。空 = 不用补。 */
  calendarMissing: string[]
  /** 价文件的汇率（`$fx` 原样）。缺席 = 未设汇率，价格表只能按人民币读写（美元面停用）。
   *  它**不参与**任何计价：文件里的价已一律是人民币。 */
  fx?: FxSetting
  dataDir: string
  updatedAt: number
}

/** 价表写路径（`PUT /tokbook/pricing`）的判决。成功只答 `ok`：成功写入即
 *  「磁盘 ≡ 草稿」，client 因此从不用响应回灌草稿（见 `docs/CONTRACTS.md` §2）。 */
export type PriceVerdict = { ok: true } | { ok: false; error: string }

/**
 * 用量明细「按工作区」一行：该工作区会话在**选定窗口内**的账本记录，用与其余
 * 视图相同的汇总 + 成本层折叠。归属是**读时 join**——账本行只存 `sessionId`，
 * 工作区取自会话持久化 header 的 `cwd`（见 `src/workspaces.ts`）——历史可追溯
 * 归属。
 */
export interface WorkspaceUsageRow {
  /** 工作区 id；兜底「未归属」行为 `''`。 */
  id: string
  title: string
  /** 规范目录路径；未归属行为 `''`（其记录跨目录或未命名）。 */
  path: string
  /** 窗口内 totals（含失败，与其余 totals 行一致）。 */
  totals: UsageTotals
  /** 四桶之和。 */
  tokens: number
  /** 窗口内真实消费（¥）；未定价记录计 0。 */
  spend: number
  /** 窗口内订阅价值（¥，非现金）。 */
  subscriptionValue: number
  /** 本行最新记录时间——排序键（最近有操作在前）。 */
  lastAt: number
}

/** 按日 × 模型 × provider × rate 的聚合行。 */
export interface UsageRateRow {
  day: string
  model: string
  provider: string
  rate: RateKey
  totals: UsageTotals
}

/** 纯 token 聚合形状（无货币）。 */
export interface TokenSummary {
  total: UsageTotals
  byDay: UsageDayRow[]
  byHour: UsageHourRow[]
  byModel: UsageModelRow[]
  rateRows: UsageRateRow[]
}

/** 带金额（¥）的模型行。`cost` = spend + subscriptionValue 的兼容合计；
 * `spend` / `subscriptionValue` 按通道计费性质拆开。未定价为 0。 */
export type CostedModelRow = UsageModelRow & {
  /** 兼容合计（¥）= spend + subscriptionValue。 */
  cost: number
  /** 真实消费（¥）：metered 通道金额。 */
  spend: number
  /** 订阅价值（¥，非现金）：subscription 通道金额。 */
  subscriptionValue: number
}

/** Token 聚合 + 成本层。 */
export interface CostedSummary extends TokenSummary {
  dataDir: string
  /** 已记录请求的计费合计（¥）；未定价模型计 0。兼容合计 =
   * spend + subscriptionValue。 */
  totalCost: number
  /** 真实消费（¥）：计费为 `metered` 的行。 */
  spend: number
  /** 订阅价值（¥，非现金）：计费为 `subscription` 的行。 */
  subscriptionValue: number
  /** 当前价表无法计费的模型：(route, model) 完全无价，或部分 rate 行指向
   * 已不存在的价格身份（段日期或例外时段被移动/删除）。这些金额计 ¥0——
   * 是「价格未知」，不是免费。 */
  unpricedModels: string[]
  /** 生效价表（手写；无定价时为空）。 */
  pricing: PricingTable
  byModel: CostedModelRow[]
}

/** 用量明细 tab 的回看窗口，按本地日命名（与账本分日文件一致）。`all` =
 *  全账本：不设下界（见 `rangeDayWindow`），三种切法都有它。 */
export type ProviderRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'all'

/** 全部合法 {@link ProviderRange}；路由校验复用。 */
export const PROVIDER_RANGES: readonly ProviderRange[] = ['today', 'yesterday', 'last7', 'last30', 'all']

/** provider 卡内的一条模型行。 */
export interface ProviderModelUsage {
  model: string
  totals: UsageTotals
  /** 四桶之和。 */
  tokens: number
  /** 窗口内计费 ¥；未定价为 0。兼容合计 = spend + subscriptionValue。 */
  cost: number
  /** 窗口内真实消费（¥）。 */
  spend: number
  /** 窗口内订阅价值（¥，非现金）。 */
  subscriptionValue: number
  /** route 计费性质（`$billing`）；与该模型是否已定价无关。未归属 route
   * 读作 metered。 */
  billing?: BillingNature
}

/** 用量明细「按通道」的一张 provider 卡。 */
export interface ProviderUsageCard {
  /** 账本记录的 route key；无 header 的行归入 `'(未知)'`。 */
  provider: string
  /** 整卡四桶之和。 */
  tokens: number
  /** 整卡计费 ¥；未定价模型计 0。兼容合计 = spend + subscriptionValue。 */
  cost: number
  /** 整卡真实消费（¥）。 */
  spend: number
  /** 整卡订阅价值（¥，非现金）。 */
  subscriptionValue: number
  /** 价表无法计费的模型（完全无价，或 rate 行身份已不存在）；计 ¥0。 */
  unpricedModels: string[]
  models: ProviderModelUsage[]
  requests: number
  compactions: number
  /** 窗口内**用量未知**的计费调用数（通道没上报 `usage`）：计入 `requests` 与
   *  `compactions`，但没有词元可加，金额因此按 ¥0 计——**不是免费**。 */
  usageUnknown: number
}

/** 用量明细路由的 wire 载荷：同一批窗口记录的三种切法——按模型、按工作区、
 *  按通道。三者读同一份窗口记录，所以合计逐分对得上。 */
export interface ProviderUsageView {
  range: ProviderRange
  /** 窗口首日本地日期（含）；`all` 为 `''`——不设下界。 */
  fromDay: string
  /** 窗口末日本地日期（含）。 */
  toDay: string
  updatedAt: number
  /** 各 route 展示名（settings `displayName` → 适配器 provider 名），卡片可
   * 以「DeepSeek」为题、route key 为副。无人命名时省略，只显示 key。 */
  providerLabels?: Record<string, string>
  /** 窗口内四桶之和——三种切法共用的量纲：页头合计、按模型 / 按工作区两种切法里
   *  占比条的分母。 */
  totalTokens: number
  /** 窗口内的计费调用数（各通道卡 `requests` 之和；失败不计入，与其余 totals 一致）。 */
  totalRequests: number
  /** 窗口内真实消费（¥）：metered 通道的金额。 */
  totalSpend: number
  /** 窗口内订阅价值（¥，非现金）。 */
  totalSubscriptionValue: number
  /** 按模型切法。空 = 该窗口没有计费过的模型。 */
  byModel: CostedModelRow[]
  /** 按工作区切法，最近用过的在前、「未归属」收尾；宿主无 workspace
   *  registry 时为空。 */
  byWorkspace: WorkspaceUsageRow[]
  /** 按通道切法。空 = 该窗口没有通道计费记录。 */
  providers: ProviderUsageCard[]
}

/**
 * 浏览器浮窗读取的聚合快照。刻意从 {@link CostedSummary} 瘦身：价表、
 * rateRows、byHour 不过 wire——浮窗不渲染它们，成本已折进 spend /
 * subscriptionValue / totalCost。
 *
 * 按模型 / 按工作区也不在这里：两者是**窗口**的切法，随
 * {@link ProviderUsageView} 走（用量明细 tab，窗口由那一页自己选）。
 * `unpricedModels` 同理不过 wire：概览不再渲染价格未知的模型清单，
 * 该事实在用量明细的通道卡与价格表的筛选里。
 */
export interface TokBookOverview extends Omit<CostedSummary, 'pricing' | 'rateRows' | 'byHour' | 'byModel' | 'unpricedModels'> {
  /** 四桶之和（input + cacheRead + cacheWrite + output）。 */
  totalTokens: number
  updatedAt: number
  records: number
  lastEventAt: number | null
  syncStatus: SyncStatus
  syncError: string | null
}

export type SyncStatus = 'idle' | 'running' | 'done' | 'error'

/**
 * 同步状态探针（`/tokbook/sync`）的载荷：调度器状态的只读投影，**不含任何账本数据**。
 *
 * client 追一轮 walk 落定时读它，而不是反复拉 `TokBookOverview`——后者每次都是全量聚合，
 * 而追的 tick 次数正比于 walk 耗时，等于把负载加在正被 walk 压着的那条路径上。落定之后
 * client 再拉一次概览，新折进来的行就在那一次里。
 */
export interface SyncStatusView {
  status: SyncStatus
  error: string | null
  /** 最近一次 walk 落定的时刻；本进程从未走过则为 null。 */
  lastSyncAt: number | null
}

/** 插件配置（可选旋钮；皆有默认值）。 */
export interface TokBookConfig {
  /** 数据目录；默认 `$DSH_HOME/tokbook`（`~/.dsh/tokbook`）。 */
  path?: string
  /** 是否记录并计费 compaction summarize（默认 true）。 */
  recordCompaction?: boolean
  /** 按 provider route 键的额度计划（`opencode-go`、`commandcode`）。找到
   * 可用 API key（配置、env 或 provider 认证文件）后自动开启，除非
   * `enabled:false`。用量从 provider 官方账户端点拉取——tab 不回落到本地
   * 估算。见 `src/quota.ts` / `src/quota-official.ts`。 */
  plans?: Record<string, PlanConfig>
}

/** 用户配置的额度计划覆盖（见 `src/quota.ts`）。 */
export interface PlanConfig {
  enabled?: boolean
  /** 明文 API key；优先于 credentials 服务。面向测试 / 非 DSH 宿主——
   * DSH Models 页里的 key 在 credentials 服务里，无需此字段。 */
  apiKey?: string
  /** 经 `ctx.credentials` 解析的凭据引用名；默认 provider 引用
   * （`OPENCODE_GO_API_KEY`、`COMMANDCODE_API_KEY`），即适配器自身
   * `apiKeyEnv` 声明的名字。 */
  apiKeyEnv?: string
}

/** 官方额度卡的一个窗口。金额可选：有的 provider 只给百分比 + 重置时间，
 * 有的给 used/cap 美元。 */
export interface QuotaWindowView {
  /** 稳定窗口 id（`rolling5h`、`weekly`、`monthly`、`fiveHour`…）。 */
  id: string
  /** 展示标签（5 小时 / 本周 / 本月 …）。 */
  label: string
  /** 服务端报的 0–100 百分比（或由 used/cap 推出）。 */
  usagePercent: number
  exceeded: boolean
  /** 额度恢复的 epoch ms；未报为 null。 */
  resetAt: number | null
  usedUsd?: number
  capUsd?: number
}

export interface QuotaAccountInfo {
  name?: string
}

export interface QuotaPlanInfo {
  planId?: string
  name?: string
  status?: string
  periodEnd?: number | null
}

/** 官方额度卡的可选用量摘要（Command Code 报；OpenCode Go 不报）。 */
export interface QuotaUsageSummary {
  completed?: number
  failed?: number
  successRate?: number
  costUsd?: number
  tokensIn?: number
  tokensOut?: number
}

/** 官方额度卡的可选余额池（Command Code）。 */
export interface QuotaCreditPool {
  monthlyUsd?: number
  purchasedUsd?: number
  freeUsd?: number
}

export type QuotaCardState = 'ok' | 'unconfigured' | 'error'

/**
 * 此刻约束账户用量的是什么——以 provider 自己的定义为准。
 *
 * `subscription` — 生效中的计划：包含的月度额度 + 限制其节奏的 5 小时/周
 * 滚动窗口。
 * `balance` — 无生效订阅，但 provider 报了余额（故 `balance` 卡必有
 * `credits`；余额接口无响应时走 `none` 门，而不是展示一个没人报过的 0），
 * 且仅余额约束用量。这是 provider 自己的规则，并覆盖两种正常情形：计划已
 * 结束（含文档化的「期末取消」流程），以及从未订过的账户（按量付费）。
 * `none` — 无生效订阅也无余额可展示（OpenCode Go 只暴露窗口百分比）。
 * 本卡无法给账户约束打上数字，渲染方必须只展示状态——不要残留窗口。
 *
 * 省略 = `subscription`：仅带普通窗口数据的卡片沿用此读法。
 */
export type QuotaGate = 'subscription' | 'balance' | 'none'

/** 一张官方额度卡：从 provider 自身端点拉取的账户用量，绝非本地估算。 */
export interface QuotaCard {
  plan: string
  title: string
  state: QuotaCardState
  message?: string
  account?: QuotaAccountInfo
  planInfo?: QuotaPlanInfo
  usage?: QuotaUsageSummary
  credits?: QuotaCreditPool
  /** 此刻约束用量的是什么（见 {@link QuotaGate}）；省略读作 `subscription`。
   * 非 `subscription` 卡的 `windows` **不是**账户当前承受的限额——滚动
   * 窗口只限制生效计划所含的月度额度。省略（而非写成 `subscription`）是
   * 证据源无响应时的产物：门从不由失败调用推断，渲染方在该情形下保持
   * 门之前读法。 */
  gate?: QuotaGate
  /** 解释 `balance` 门的一句话（依据哪条证据、API 报告的日期）。由 host
   * 拼好，client 不重推 provider 订阅状态词汇。 */
  gateNote?: string
  windows: QuotaWindowView[]
  fetchedAt?: number
}

/** 订阅额度路由在未带 `provider` 时的 wire 载荷：不走网络的已启用 route
 * 列表，client 再按 `?provider=` 各自拉卡。`alert` 只由持久化的最近一次
 * 'ok' 快照推出（绝非即时联网），驱动侧栏 footer 的告急点。 */
export interface QuotaView {
  /** 已启用的内置 route，展示顺序（无网络拉取）。 */
  providers: string[]
  /** 任一最近 'ok' 快照的窗口达到/超过告急阈值或已 exceeded。缺/undefined
   * = 无告急。 */
  alert?: boolean
}


/** 聚合 totals 行的四桶之和。 */
export function totalsTokens(totals: UsageTotals): number {
  return totals.inputTokens
    + totals.cacheReadTokens
    + totals.cacheWriteTokens
    + totals.outputTokens
}
