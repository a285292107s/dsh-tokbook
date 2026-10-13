/**
 * host 与 browser 半区共用的 HTTP 路由词表：路径与 query 键。
 *
 * 两个半区之间只有这一条数据路径（`docs/DESIGN.md` §4）：host 在 `routes.ts` 上按
 * exact path 注册，browser 在各 tab 里 `fetch`。词表放在这里，是为了「路径 / query 键」
 * 只有一处真源——而 exact 路由写错不会报错，只会静默 404。
 *
 * 只放词表，不放 URL 构造器：query 值的编码与省略规则留在各自的调用点（host 侧用
 * `URLSearchParams` 读，client 侧用模版串写）。本模块**零依赖**，因此 browser bundle
 * 可以安全 import（同 `price-format.ts` 的理由）。
 */

/** `GET` 当前聚合概览快照（带成本）。 */
export const ROUTE_OVERVIEW = '/tokbook/overview'
/** `GET` 同步状态探针：只读 host 内存里的调度器状态，**不触碰账本**（≈0 ms）。 */
export const ROUTE_SYNC = '/tokbook/sync'
/** `POST` 强制对全部会话做一轮权威再同步。 */
export const ROUTE_RESCAN = '/tokbook/rescan'
/** `GET` 一个回看窗口的三种切法；需带 `?range=`。 */
export const ROUTE_USAGE = '/tokbook/usage'
/** `GET` 额度：不带 query 答已启用 route 列表，带 `?provider=` 答单卡。 */
export const ROUTE_QUOTA = '/tokbook/quota'
/** `GET` 价表只读视图；`PUT` 写整份价表。 */
export const ROUTE_PRICING = '/tokbook/pricing'
/** `POST` 从 models.dev 补价：账本出现过的 (route, model) × 美元通道 × 缺价格子。
 *  `?force=1` 绕过日节流。 */
export const ROUTE_PRICING_SYNC = '/tokbook/pricing-sync'
/** `GET` 按关键词在 models.dev 目录里查原厂美元价：`?model=` 是关键词（默认取当前
 *  模型名），返回按相关性排序的候选与四档价，供「查价」按钮的选用面板用。只在**原厂
 *  采信条目**里找（同 `parseCatalog` 的边界），不返回转售价。 */
export const ROUTE_PRICING_LOOKUP = '/tokbook/pricing-lookup'
/** `GET` 单个会话的账本视图（按轮次/步骤分组）；需带 `?session=`。 */
export const ROUTE_SESSION = '/tokbook/session'

/** `ROUTE_SESSION` 的会话 id 键。 */
export const QUERY_SESSION = 'session'

/** `ROUTE_USAGE` 的回看窗口键（取值见 `PROVIDER_RANGES`）。 */
export const QUERY_RANGE = 'range'
/** `ROUTE_QUOTA` 的单卡 provider 键。 */
export const QUERY_PROVIDER = 'provider'
/** `ROUTE_QUOTA` 的绕过 TTL 缓存标记：值为 `'1'` 时强制轮询 provider。 */
export const QUERY_REFRESH = 'refresh'
/** `ROUTE_PRICING_SYNC` 的绕过日节流标记：值为 `'1'` 时立即同步一次。 */
export const QUERY_FORCE = 'force'
/** `ROUTE_PRICING_LOOKUP` 的关键词：值就是用户想查的模型串（默认 = 当前选中模型名）。 */
export const QUERY_MODEL = 'model'
