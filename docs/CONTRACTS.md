# Host 与数据契约 — dsh-tokbook

> **Doc meta** · role: contracts · language: zh-CN · status: current · last-reviewed: 2026-09-10 · supersedes: —

其他代码与 browser 半区必须**分毫不差**依赖的事实的唯一家园:host 路由与 wire JSON、
插件配置、消费的 `session/event` 类型、数据目录文件布局。

**代码是权威。** 来源:`src/routes.ts`、`src/types.ts`、`src/usage-record.ts`、
`src/ledger.ts`、`src/usage-log.ts`、`src/pricing.ts`、`src/quota-cache.ts`。本文件是一张
受检地图:`scripts/selfcheck-docs.ts`(属于 `pnpm selfcheck`)会在下方 host 路由表与
`src/routes.ts` 漂移时失败。若这里的文字与代码冲突,以代码为准、修本文件,并刷新
`last-reviewed`。

**术语。** 正文用**通道**指代 wire 与代码里的 `provider`——字段名、JSON 键、路由键与 URL
一律保持原文,不翻译;`model` 对应「模型」。做模型、定官方价的一方是**模型厂商**,
不是通道:同一个模型可以经多条通道计费,同一家公司也可能兼任厂商与通道。

界面词与代码/契约的对应(界面一律中文,代码一律原文):

| 界面 | 代码 / 契约 |
|---|---|
| 通道用量 | Provider-usage tab,`GET /tokbook/usage` |
| 价格表 | pricing tab,`pricing.json`,`GET`/`PUT /tokbook/pricing` |
| 路由卡片 | `PricingRouteView`(`routes[]`)——一条通道路由一张卡 |
| 价段(生效日期) | `PriceSegment`:`from`(`YYYY-MM-DD`,省略 = 最早一段)+ 四档价 |
| 四档价 | `inputPerMillion` / `outputPerMillion` / `cacheReadPerMillion` / `cacheWritePerMillion`(¥/M;cache 档省略 = 按输入价) |
| 计费性质 | `$billing`:路由 → `metered` / `subscription`(省略 = metered) |
| 仅账本 | 卡内模型不在 settings / 适配器目录里,只有账本记过(`configured: false`) |
| 价格未知 | 该 (路由, 模型) 没有价段(暂按 ¥0,**不是免费**) |
| 实际支出 / 订阅价值 | `billing: metered` / `subscription` 两个桶(`spend` / `subscriptionValue`) |
| 通道路由键 | provider route key(账本里的通道标识) |
| 通道名称 | 卡头显示名:settings profile 的 `displayName` → 适配器给的名字 → 路由键 |
| 按量 / 订阅 | 卡片计费芯片,由该路由的 `$billing` 推出 |

## Host 路由

经 `ctx.webServer.register({ kind: 'exact', path, handler })` 注册在 DSH host webserver
上的精确路由。每个 handler 都:

- 校验方法(方法不对 → `405` text/plain),
- 校验同源(`Sec-Fetch-Site` 缺失、`same-origin`、`none` 通过;其余 → `403` text/plain),
- 以 `application/json; charset=utf-8` 应答,带 `cache-control: no-store`,
- 内部错误包装成 `500 { "error": <消息> }`——绝不让 unhandled rejection 外泄,
- 在 handler 内部读取 query(exact 路由只在 pathname 上匹配)。

| 方法 | 路径 | Query / body | 成功载荷(类型见 `src/types.ts`) |
|---|---|---|---|
| `GET` | `/tokbook/overview` | — | `TokBookOverview`(带成本的汇总 + 趋势 + 按模型 + 最近记录 + 新鲜度) |
| `POST` | `/tokbook/rescan` | — | `RescanView` = `{ status: 'running'\|'skipped', lastSyncAt: number\|null }` |
| `GET` | `/tokbook/usage` | `range` ∈ `today` \| `yesterday` \| `last7` \| `last30`(缺失/未知 → `400 {error}`) | `ProviderUsageView` |
| `GET` | `/tokbook/quota` | — | `QuotaView` = `{ providers: string[], alert?: boolean }` — 仅已启用计划;`alert` 只读持久化快照,无网络 |
| `GET` | `/tokbook/quota` | `provider=<路由键>`;可选 `refresh=1` 跳过 TTL 缓存 | 该通道的 `QuotaCard` |
| `GET` | `/tokbook/pricing` | — | `PricingView` = `{ routes: PricingRouteView[], dataDir, updatedAt }` |
| `PUT` | `/tokbook/pricing` | JSON body ≤ 256 KiB | `200 { ok: true, view }`;表非法 → `400 { error, view }` |

Wire 形状要点(权威字段清单见 `src/types.ts`):

- wire 上的金额是人民币(¥);**除非**某通道官方 API 以美元上报
  (`QuotaCard.usage / credits / windows.usedUsd / capUsd`,额度 tab 自己按美元展示)。
- `range` id 是以本地日历天命名的窗口,与它们读取的日文件对应。
- 从未见过通道头的行归入 `'(未知)'` 组。
- 价格未知模型计 ¥0,并在 `unpricedModels` 中列出——口径是**价格未知**,不是免费(费率为 0
  属于已知价,正常计价并显示为 ¥0)。
- `GET /tokbook/usage` 的载荷带 **`providerLabels`**:路由键 → 显示名,来源是本机配置
  (settings profile 的 `displayName`,其次适配器注册的名字)。卡片头用它做主标题、路由键做
  次要小字,与价格表 tab 命名一致;卡片的计费芯片(按量 / 订阅)由该路由的 `$billing` 推出
  (计费性质是**通道路由**属性,所以一张卡内不会出现两种),说明该卡的金额是实际支出（现金）
  还是订阅价值（折算）。
- `GET /tokbook/pricing` 的路由卡片由**三个来源求并**:
  1. **路由目录**——本机设置文档(`llm-pi-ai.providers` 的键,以及 `llm-deepseek` 所拥有的
     唯一路由 `deepseek-official`)∪ **正在运行的适配器注册表**(`ctx.llm.listProviders()`,
     所以插件在运行时铸出的路由也有卡);卡内模型 = 各 profile 的 `models` 列表,profile 没列
     模型的路由回落到适配器自己的目录(`ctx.llm.listModels()`,不联网)。
  2. **账本**按该路由计费过的模型串(`records > 0`、`configured: false`,UI 标「仅账本」)
     ——历史金额因此始终有可定价的入口。
  3. **价格文件**里出现过的路由与模型串(即使配置与账本都不再提它)。
  路由顺序:有账本用量的在前(记录数降序),其余按路由键;卡内模型:记录数降序 → 配置在前的
  优先 → 模型串升序。
- `PUT /tokbook/pricing` body 就是**整个价格文件**:
  `{ "$billing"?: { "<路由>": "metered" | "subscription" }, "<路由>": { "<精确模型串>": [ 价段… ] } }`。
  **价段**是扁平对象:`{ "from"?: "YYYY-MM-DD", "inputPerMillion": number,
  "outputPerMillion": number, "cacheReadPerMillion"?: number, "cacheWritePerMillion"?: number,
  "note"?: string }`。`from` 省略或 `""` = **最早一段**(自始生效);缺失的
  (路由, 模型) = 这条价不存在(其记录回落为价格未知)。整表解析、校验后**整体替换**
  `pricing.json`,所以写坏的 body 绝不会半应用。**客户端自动保存**(任何改动停止输入约
  0.6 秒后写一次,切 tab / 关窗前先冲刷;Ctrl/Cmd+S 立刻冲刷),页面没有保存按钮——那条状态栏
  只报 保存中 / 已保存 / 未保存+原因 / 保存失败+重试;草稿里还有非法值时**不写**(文件保持上次
  成功的样子),补全后自动重试。
  - 写路径**严格**:非负有限数、`from` 必须是真实存在的 `YYYY-MM-DD`、同一 (路由, 模型) 内
    **不得有两段同一天生效**(同一时刻只能有一段价)、价段不许有未知字段、`$billing` 之外不许有
    其他 `$` 保留键;报错带出事位置(路由 / 模型 / 第几段)。
  - 读路径**宽容**:畸形路由 / 模型 / 价段被丢弃并按 `from` 升序规范化(同一天重复时文件里靠前
    的一段胜出),绝不致命。
- 计价口径:一条记录按**它自己的时间戳**取「最后一段 `from ≤ 该时刻` 的价」;早于最早一段、
  或该 (路由, 模型) 没有任何价段 → **价格未知**(¥0)。`$billing` 缺省 = `metered`。
  所以回填一段更早的价会重算历史,不需要重建任何聚合。
- 派生折叠 `rollup.json` 带 **`pricingRevision`**(价格文件内容的 djb2 签名):费率行的身份是从
  价格表推导出来的,签名一变整份折叠作废、由日文件重建。价格表 tab 的「账本 N 次」透镜只读
  记录缓存,**不写折叠**(它不按价折叠)。
- wire 上的金额拆双桶:`spend`(metered 路由,实际支出)与 `subscriptionValue`(subscription
  路由,订阅价值、非现金);`totalCost` 保留为两者之和以兼容旧客户端。
- `byDay` 每行除 token 汇总外还带该日 `spend` / `subscriptionValue`(`attachCosts` 从
  rate rows 按天折叠得出)。token-only 汇总与磁盘 rollup 里没有这两个字段——成本层每次
  读取都从 rate rows 重新推导,所以价格表改动后逐日金额自动跟着变。

## 配置

profile patch 中的 `plugins.tokbook`,类型为 `TokBookConfig` + `PlanConfig`
(见 `src/types.ts`;带注释的 YAML 示例见 README · Configuration):

| 键 | 默认 | 含义 |
|---|---|---|
| `path` | `$DSH_HOME/tokbook`(`~/.dsh/tokbook`) | 数据目录 |
| `recordCompaction` | `true` | 是否记录并计费压缩 summarize 调用 |
| `plans.<provider>.enabled` | 未设 | `false` 关闭某内置计划 |
| `plans.<provider>.apiKey` | 未设 | 字面 key;优先于 credentials 服务 |
| `plans.<provider>.apiKeyEnv` | 通道引用(`OPENCODE_GO_API_KEY` / `COMMANDCODE_API_KEY`) | 经 `ctx.credentials` 解析的凭据名 |

额度计划按通道路由(`opencode-go`、`commandcode`)内置,一旦找到可用 key 即启用
——配置字面量优先,其次通道的凭据引用——除非 `enabled: false`。无 key → 一张
`unconfigured` 卡;拉取失败 → 一张 `error` 卡;该 tab 绝不回退到本地估算。

## 消费的会话事件

来自持久化的 `session/event` 流(折叠逻辑:`src/usage-record.ts`)。每条通道计费
模型调用写一行 JSONL:

| 事件 | 记为 | 说明 |
|---|---|---|
| `assistant/message` | `kind: request` | 成功调用;行 id = message id(去重键);携带通道上报的 `usage` 桶 |
| `compaction/summary` | `kind: compaction` | 仅在 `recordCompaction` 开启时;其自身是一次计费调用 |
| `turn/end`(reason `error`) | `kind: failure` | 失败尝试——只进 `failures` 维度,不计 token/费用 |
| `llm/retry` | `kind: failure` | 失败尝试——只进 `failures` 维度 |
| `request/context`(+ `assistant/message`) | 不写行 | 维护会话最后已知的 `model`/`provider`,用于给失败行归属 |

## 数据目录

一个数据集一个目录(默认 `$DSH_HOME/tokbook`,可用 `path` 配置);**一个 host 进程写一个
目录**——启动时 host 写 `owner.json` 标记,若检测到存活的异进程已占用则告警。第二个
host 请指向自己的 `path`,不要共享目录。

| 文件 | 用途 | 由谁写 | 说明 |
|---|---|---|---|
| `usage-YYYY-MM-DD.jsonl` | 逐日账本,每行一个 `UsageRecord`,每条通道计费调用一行 | host 追加路径 | 追加 + 串行队列;按 `requestId` 去重;行归属于其事件的本地日历日(`src/usage-log.ts` 的 refile 逻辑保证) |
| `rollup.json`(+ `.tmp`) | 冻结日的派生统计折叠,截至 `upto` 日,带 `pricingRevision` | host stats 读路径 | 缺失/损坏/版本不符/签名与当前价格文件不符 → 由日文件重建;同步追加行后删除重建 |
| `sync-progress.json`(+ `.tmp`) | 持久化的逐会话 `revision` 基线,供增量新鲜度探测 | host sync | 严格在同步成功后写;读不到的会话被排除 |
| `owner.json` | 单写者标记 `{ pid, startedAt }` | host 启动 | 崩溃进程留下的陈旧标记被静默接管 |
| `pricing.json`(+ `.tmp` / `.bak`) | 唯一的价格文件:保留键 `$billing` + 路由 → 模型串 → 价段数组(整表替换) | `PUT /tokbook/pricing` | 缺失 = 什么都没定价(全部价格未知);畸形条目只影响对应的 (路由, 模型);写路径先把上一版挪到 `.bak` 再 rename |
| `quota-<provider>.json`(+ `.tmp`) | 最近一次官方额度卡快照 `{ savedAt, card }` | host 额度拉取 | 只持久化 `ok` 卡;缺失/撕裂/畸形读作 null |

> 历史遗留:`pricing.ccsa.json` / `provider-pricing.ccsa.json` / `provider-pricing.json`
> 是已移除的云端镜像与通道覆盖层的文件,插件**不再读取也不删除**它们;删掉即可(见
> `docs/DECISIONS.md` D-011)。

约定:派生文件原子写入(temp + rename;Windows 上 rename-over-existing 偶发失败处先
unlink 目标)。**例外**:`pricing.json` 先把上一版 rename 成 `.bak` 再落新文件——它是唯一
用户手写文件,崩溃窗口内缺失会被读成空表并可能被自动保存整表写掉。日文件只追加、绝不重写。

## 让数字保持诚实的不变量

- 去重身份是 `requestId`(`assistant` message id,或合成的
  `compaction:<session>:<seq>` / `failure:<session>:<seq>`);同一进程内重叠写者共享
  同一个去重集与同一条串行追加队列。
- 价格改动在**读取时**重新计价历史——不重写账本;计价入口是 (路由, 模型, 记录时间戳)
  单维解析(`priceAt`):取该时刻生效的价段,没有就是价格未知。费率行的身份是**当时生效的
  价段的生效日**;因为它是从价格表推导出来的,`rollup.json` 记下价格文件的签名
  (`pricingRevision`),签名一变整份折叠作废并由日文件重建。
- 金额分双桶:`spend` 只含 `billing: metered` 路由(实际支出),`subscriptionValue` 只含
  `billing: subscription` 路由(订阅价值,非现金);UI 不得把后者当作支出展示。
- 计费性质以**通道路由**为单位(`$billing` 的一条),省略 = metered;它作用于该路由的全部
  历史(与旧口径一致:改 `$billing` 会同时改变历史的分桶)。
- rollup 带 `schemaVersion: 3` 与 `pricingRevision`;旧版本(v1/v2)或签名不符读作缺失、
  由日文件重建。
- 额度卡只展示官方通道数据;`unconfigured`/`error` 卡便宜地即时重推,从不当作
  "最近已知"持久化。

## 交叉引用

- 事件、同步探测、以及跨模块级重载的去重边界语义:`docs/HMR.md` §4。
- 端到端故事、安装与配置示例:`../README.md`。
- 这些形状为什么存在(数据模型推理):`docs/DESIGN.md`(重构说明一节)与
  `docs/DECISIONS.md`。
