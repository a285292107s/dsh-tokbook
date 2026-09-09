# Host 与数据契约 — dsh-tokbook

> **Doc meta** · role: contracts · language: zh-CN · status: current · last-reviewed: 2026-09-08 · supersedes: —

其他代码与 browser 半区必须**分毫不差**依赖的事实的唯一家园:host 路由与 wire JSON、
插件配置、消费的 `session/event` 类型、数据目录文件布局。

**代码是权威。** 来源:`src/routes.ts`、`src/types.ts`、`src/usage-record.ts`、
`src/ledger.ts`、`src/usage-log.ts`、`src/pricing.ts`、`src/quota-cache.ts`。本文件是一张
受检地图:`scripts/selfcheck-docs.ts`(属于 `pnpm selfcheck`)会在下方 host 路由表与
`src/routes.ts` 漂移时失败。若这里的文字与代码冲突,以代码为准、修本文件,并刷新
`last-reviewed`。

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
| `GET` | `/tokbook/quota` | — | `QuotaView` = `{ providers: string[] }` — 仅已启用计划,无网络 |
| `GET` | `/tokbook/quota` | `provider=<路由键>`;可选 `refresh=1` 跳过 TTL 缓存 | 该 provider 的 `QuotaCard` |
| `GET` | `/tokbook/pricing` | — | `PricingView`(含 `providerRows`) |
| `PUT` | `/tokbook/pricing` | JSON body ≤ 256 KiB | `200 { ok: true, view }`;表非法 → `400 { error, view }` |
| `GET` | `/tokbook/provider-pricing` | — | `{ providerRows: ProviderPricingViewRow[], dataDir }`(provider 覆盖层视图) |
| `PUT` | `/tokbook/provider-pricing` | JSON body ≤ 256 KiB | `200 { ok: true, view }`;表非法 → `400 { error, view }` |

Wire 形状要点(权威字段清单见 `src/types.ts`):

- wire 上的金额是人民币(¥),**除非**某 provider 官方 API 以美元上报
  (`QuotaCard.usage / credits / windows.usedUsd / capUsd`)。成本数字通过各载荷的
  `currency` 与 `usdExchangeRate` 字段换算后展示。
- `range` id 是以本地日历天命名的窗口,与它们读取的日文件对应。
- 从未见过 provider 头的行归入 `'(未知)'` 组。
- 未定价模型计 ¥0,并在 `unpricedModels` 中列出。
- `PUT /tokbook/pricing` body:`{ "<精确模型串>": 条目 }`,条目二选一:
  - **flat 价**(旧格式,仍完全支持):`{ "inputPerMillion": number, "outputPerMillion": number, "cacheReadPerMillion"?: number, "cacheWritePerMillion"?: number }`;
  - **规则集**:`{ "base": <flat 价>, "timeRules"?: [{ "startTime": seconds, "endTime"?: seconds,
    "label"?: string, "rates": <flat 价>, "dailySlots"?: [slot] }], "dailySlots"?: [slot] }`,
    其中 `slot` = `{ "windows": [{ "startMinute": 0–1440, "endMinute": 0–1440 }], "rates": <flat 价>,
    "daysOfWeek"?: [1–7], "label"?: string }`(本地分钟窗口,周一=1;`daysOfWeek` 省略 = 每天)。

  缺失的键 = 删除该手工覆盖;整表解析、校验后**整体替换** `pricing.json`。手工条目**整体
  替换**该模型的云规则集(云端调价史/峰谷一起被替换);手工层**不支持上下文档位**
  (`contextTiers` 会被忽略)。`timeRules` 的 `endTime` 省略 = 永久。同一模型的 `timeRules`
  **不得在时间上重叠**(同一时刻只能有一段价)——写路径拒绝并给出具体是哪两段;读路径按
  `startTime` 排序,所以文件顺序、展示顺序与引擎的「首个命中」顺序一致。
- `GET /tokbook/pricing` 每行都带**当前生效价** `now`(`{ rates, label?, peak }`,按读取时刻
  走「时间规则 → 峰谷」链)与完整规则集(模型行 `manualRules` / `cloudRules`、provider 行
  `rules`);`cloudRates` / `manualRates` 只是各自 `base` 的平铺简写(旧客户端兼容)。带
  `records` 的行是账本真正记过的模型串(不只未定价行);`overlayPriced` = 模型层无条目但
  Provider 覆盖层已定价——此时 `now` 就是覆盖层解析出的价,`provider` 是该覆盖所在的路由键
  (UI 用它跳到那条覆盖;给这类串写模型层手工条目不会被读取)。
- `PUT /tokbook/provider-pricing` body:两层级
  `{ "<provider路由键>": { "<精确模型串>": { "billing"?: "metered"|"subscription",
  "inheritBase"?: "<基准modelId>"| "segments"?: [{ "from"?: seconds, "to"?: seconds,
  "rate": { inputPerMillion, outputPerMillion, … }, "note"?: string }], "note"?: string } } }`。
  `segments` 是完整的自定时间轴(可多段);整表解析、校验后**整体替换** `provider-pricing.json`;
  缺失的 (provider, model) = 删除该手工覆盖(回到镜像行)。
- wire 上的金额已拆双桶:`spend`(metered 行,实际支出)与 `subscriptionValue`(subscription 行,
  订阅价值、非现金);`totalCost` 保留为两者之和以兼容旧客户端。
- `byDay` 每行除 token 汇总外还带该日 `spend` / `subscriptionValue`(`attachCosts` 从
  rate rows 按天折叠得出)。token-only 汇总与磁盘 rollup 里没有这两个字段——成本层每次
  读取都从 rate rows 重新推导,所以价格表改动后逐日金额自动跟着变。

## 配置

profile patch 中的 `plugins.tokbook`,类型为 `TokBookConfig` + `PlanConfig`
(见 `src/types.ts`;带注释的 YAML 示例见 README · Configuration):

| 键 | 默认 | 含义 |
|---|---|---|
| `path` | `$DSH_HOME/tokbook`(`~/.dsh/tokbook`) | 数据目录 |
| `pricingUrl` | 未设 | 显式云定价 feed URL;优先于 `pricingRegion` |
| `pricingProviderUrl` | dsh-model-pricing 镜像 raw URL | 显式 provider 覆盖层 feed URL |
| `pricingRegion` | `domestic` | `pricingUrl` 未设时的镜像选择(`domestic`/`overseas`) |
| `recordCompaction` | `true` | 是否记录并计费压缩 summarize 调用 |
| `plans.<provider>.enabled` | 未设 | `false` 关闭某内置计划 |
| `plans.<provider>.apiKey` | 未设 | 字面 key;优先于 credentials 服务 |
| `plans.<provider>.apiKeyEnv` | provider 引用(`OPENCODE_GO_API_KEY` / `COMMANDCODE_API_KEY`) | 经 `ctx.credentials` 解析的凭据名 |

额度计划按 provider 路由(`opencode-go`、`commandcode`)内置,一旦找到可用 key 即启用
——配置字面量优先,其次 provider 的凭据引用——除非 `enabled: false`。无 key → 一张
`unconfigured` 卡;拉取失败 → 一张 `error` 卡;该 tab 绝不回退到本地估算。

## 消费的会话事件

来自持久化的 `session/event` 流(折叠逻辑:`src/usage-record.ts`)。每条 provider 计费
模型调用写一行 JSONL:

| 事件 | 记为 | 说明 |
|---|---|---|
| `assistant/message` | `kind: request` | 成功调用;行 id = message id(去重键);携带 provider 上报的 `usage` 桶 |
| `compaction/summary` | `kind: compaction` | 仅在 `recordCompaction` 开启时;其自身是一次计费调用 |
| `turn/end`(reason `error`) | `kind: failure` | 失败尝试——只进 `failures` 维度,不计 token/费用 |
| `llm/retry` | `kind: failure` | 失败尝试——只进 `failures` 维度 |
| `request/context`(+ `assistant/message`) | 不写行 | 维护会话最后已知的 model/provider,用于给失败行归属 |

## 数据目录

一个数据集一个目录(默认 `$DSH_HOME/tokbook`,可用 `path` 配置);**一个 host 进程写一个
目录**——启动时 host 写 `owner.json` 标记,若检测到存活的异进程已占用则告警。第二个
host 请指向自己的 `path`,不要共享目录。

| 文件 | 用途 | 由谁写 | 说明 |
|---|---|---|---|
| `usage-YYYY-MM-DD.jsonl` | 逐日账本,每行一个 `UsageRecord`,每条 provider 计费调用一行 | host 追加路径 | 追加 + 串行队列;按 `requestId` 去重;行归属于其事件的本地日历日(`src/usage-log.ts` 的 refile 逻辑保证) |
| `rollup.json`(+ `.tmp`) | 冻结日的派生统计折叠,截至 `upto` 日 | host stats 读路径 | 缺失/损坏 → 由日文件重建;同步追加行后删除重建 |
| `sync-progress.json`(+ `.tmp`) | 持久化的逐会话 `revision` 基线,供增量新鲜度探测 | host sync | 严格在同步成功后写;读不到的会话被排除 |
| `owner.json` | 单写者标记 `{ pid, start }` | host 启动 | 崩溃进程留下的陈旧标记被静默接管 |
| `pricing.json`(+ `.tmp`) | 手编手工价覆盖(整表替换;条目永远优先于云) | `PUT /tokbook/pricing` | 条目可以是 flat 价或带 `timeRules`/`dailySlots` 的规则集;缺失 = 无手工层;畸形条目只把对应模型降级为未定价 |
| `pricing.ccsa.json`(+ `.tmp`) | 启动时拉取的云定价镜像(`pricing.ts`) | host 启动 | 只读参考;region/URL 按配置 |
| `provider-pricing.json`(+ `.tmp`) | 手编 provider 覆盖层(整表替换;条目覆盖对应 (provider, model) 的镜像行) | `PUT /tokbook/provider-pricing` | 缺失 = 无手工 provider 层 |
| `provider-pricing.ccsa.json`(+ `.tmp`) | 启动时拉取的 provider 覆盖镜像(`pricing.ts`) | host 启动 | 只读参考;URL 按 `pricingProviderUrl` 配置 |
| `quota-<provider>.json`(+ `.tmp`) | 最近一次官方额度卡快照 `{ savedAt, card }` | host 额度拉取 | 只持久化 `ok` 卡;缺失/撕裂/畸形读作 null |

约定:派生文件原子写入(temp + rename;Windows 上 rename-over-existing 偶发失败处先
unlink 目标)。日文件只追加、绝不重写。

## 让数字保持诚实的不变量

- 去重身份是 `requestId`(`assistant` message id,或合成的
  `compaction:<session>:<seq>` / `failure:<session>:<seq>`);同一进程内重叠写者共享
  同一个去重集与同一条串行追加队列。
- 价格改动在**读取时**重新计价历史——不重写账本/折叠;计价入口是 (provider, model)
  双维解析(`resolvePriced`):provider 覆盖层(手工 > 镜像)先命中,再回落到基准模型价。
- 金额分双桶:`spend` 只含 `billing: metered` 行(实际支出),`subscriptionValue` 只含
  `billing: subscription` 行(订阅价值,非现金);UI 不得把后者当作支出展示。
- rollup 带 `schemaVersion: 2`;旧格式(v1,无版本字段)读作缺失、由日文件重建。
- 额度卡只展示官方 provider 数据;`unconfigured`/`error` 卡便宜地即时重推,从不当作
  "最近已知"持久化。

## 交叉引用

- 事件、同步探测、以及跨模块级重载的去重边界语义:`docs/HMR.md` §4。
- 端到端故事、安装与配置示例:`../README.md`。
- 这些形状为什么存在(数据模型推理):`docs/DESIGN.md`(重构说明一节)与
  `docs/DECISIONS.md`。
