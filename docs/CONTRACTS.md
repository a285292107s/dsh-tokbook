# Host 与数据契约 — dsh-tokbook

> **Doc meta** · role: contracts · language: zh-CN · status: current · last-reviewed: 2026-09-11 · supersedes: —

其他代码与 browser 半区必须**分毫不差**依赖的事实的唯一家园:host 路由与 wire JSON、
插件配置、消费的 `session/event` 类型、数据目录文件布局。

**代码是权威。** 来源:`src/routes.ts`、`src/types.ts`、`src/usage-record.ts`、
`src/ledger.ts`、`src/usage-log.ts`、`src/pricing.ts`、`src/price-format.ts`、
`src/quota-cache.ts`。本文件是一张
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
| 价段(生效时间) | `PriceSegment`:`from`(`YYYY-MM-DD` 或整点 `YYYY-MM-DDTHH:00`,省略 = 最早一段)+ 四档全天价 + 可选的峰谷时段 |
| 峰谷时段 | `PriceSlot`(界面词「峰谷时段」,文件里叫 `slots`):`days`(`daily` / `weekdays` / `weekends`,省略 = `daily`)+ `start` / `end`(整点,`[start, end)`,`24` = 当天结束)+ **任意子集**的四档价 |
| 四档价 | `inputPerMillion` / `outputPerMillion` / `cacheReadPerMillion` / `cacheWritePerMillion`(¥/M;价段里 cache 档省略 = 按输入价;**峰谷时段里省略 = 沿用该段全天价**) |
| 计费性质 | `$billing`:路由 → `metered` / `subscription`(省略 = metered) |
| 仅账本 | 卡内模型不在 settings / 适配器目录里,只有账本记过(`configured: false`) |
| 模型名称 | `PricingModelView.name`:settings `models[].name` → 适配器目录的 `name`;没有就只显示精确模型串(与模型选择器一致) |
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
- 额度卡的 `ok` 态还带**门**(`QuotaCard.gate: 'subscription' | 'balance' | 'none'`,缺省 =
  `subscription`,见 D-014):`subscription` = 有生效中的订阅,由月度池 + 5 小时/每周滚动窗口
  约束;`balance` = 没有生效中的订阅(套餐已结束,或 accounts 从未订阅——Provider 按量账户是
  正当形态),**窗口不再是约束,只有余额是**;`none` = 没有生效中的订阅、且该端点**也不报余额**
  (OpenCode Go 只报窗口百分比),这张卡没有任何可以诚实放上屏的数字。
- 判定在 host,按通道各自的**权威信号**,client 不重算。两条共同硬规则:
  - **门只从「真的答复了」的端点推导,绝不从失败推导**。`status`/`periodEnd` 只存在于
    `billing/subscriptions` 响应里,该调用超时/5xx/网络错误是「不知道」而不是「没有订阅」——
    此时**不设门**(缺省 = `subscription`),卡片照旧渲染窗口,而不是对着仍在订阅期的账户说
    「未检测到生效中的订阅」。
  - **`balance` 门保证带 `credits`**。`billing/credits` 同样没答复时,没有数字可以替代窗口
    (渲染出来就是没人上报过的 `$0.00`),于是降级为 `none` 并在文案里注明本次未取到余额。
  - Command Code(`quotaGate`,纯函数)依据 `planInfo`:状态词为 `active`/`trialing` 即在期,
    否则**以 `periodEnd` 为准**(官方口径「取消后仍可用到当期结束」),未知状态词因此退化为
    日期规则。
  - OpenCode Go 依据 HTTP 语义:**401 = key 本身无效**(`error` 卡),**403 = key 有效但没有
    Go 订阅**(Zen 与 Go 共用 workspace key;见 cc-switch #6433)→ `gate: 'none'` 的 `ok` 卡。
    403 是官方给出的**状态**而非故障,所以不记作「查询失败」。
- `gateNote` 是 host 组好的一句话(哪种证据、哪个日期),client 只渲染它,不重算状态词表。
  `gate` 是**读时派生**、不进快照版本:每次拉取按当次响应重算,所以续费后不会被旧值掩盖。
- `unconfigured` / `error` 卡没有 `gate`(它们没有可用数据);`balance` 与 `none` 门**不改变**
  `state`——它们仍是 `ok`,照常持久化为最近已知快照。
- `range` id 是以本地日历天命名的窗口,与它们读取的日文件对应。
- 从未见过通道头的行归入 `'(未知)'` 组。
- 价格未知模型计 ¥0,并在 `unpricedModels` 中列出——口径是**价格未知**,不是免费(费率为 0
  属于已知价,正常计价并显示为 ¥0)。这里同时收两类:当前价格表根本没有该 (路由, 模型) 的价,
  以及**某些记录的费率行身份已经不在表里**(生效时刻或峰谷时段被改掉/删掉)。
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
- 卡内每一行除了**精确模型串**(`model`,账本的计费键)还带**显示名**(`name?`):本机
  settings profile 的 `models[].name` 优先,其次适配器目录(`ctx.llm.listModels()`)的 `name`;
  与精确串相同或两处都没有名字时**省略**——此时该串自己就是标签,与模型选择器的回落一致
  (`provider/model`)。**仅账本**行与只写在价格文件里的串**没有**名字(账本与价格文件不带名),
  所以它们显示精确串,且不会因为别处同名而被误标。
- 每一行还带**账本自己的三个数**(可选,来自下面的「账本 N 次」透镜):`firstAt?` / `lastAt?`
  (该行第一笔与最后一笔记录的时刻)与 **`unpriced?`**——**有多少笔记录在它自己的时刻上不被
  任何价段覆盖**,也就是**计 ¥0** 的那部分。三者**同时省略** = 透镜没读到(无记录或读账本失败),
  **不等于 0**:一行**有价**的行照样可以有**没有价的历史**(给最早那段填上 `from`,它左边的账
  就落进这里)。价格表抽屉的时间轴以 `firstAt` 所在**整点**为**左端**(首记,`hourStartMs`——与
  「没写生效时间的价段锚在哪里」是同一个时刻):它在轨道上**只是一道刻度**,那个整点写在轴下那句
  `账本 N 次，首记 …，最后一次 …。` 里(轨道是一行、每段价是列内三格,只有日期没有条的标签格会
  在条那一排占住同样的宽度,读起来像一道缺口);价段边界早于它的写成 `◀ 日期` 而不画实心刻度
  (手写的 `from` 确实更早时才有金额含义),晚于它且
  **中间有账**的则留出一块「未覆盖」区域——并把 `unpriced` 写进说明句;没有 `firstAt` 时左端取
  最早那段价的边界,说明句里讲明"没有首记可锚"。**每一次调价是轴上一个节点**,节点间距有下限
  (放不下就横向滚动,不压缩),右端是「今天」,
  未来生效的段作为节点画在它右边。判断口径与成本层逐记录计价所用的 `rateKeyAt` **同一条规则**。
- `PUT /tokbook/pricing` body 就是**整个价格文件**:
  `{ "$billing"?: { "<路由>": "metered" | "subscription" }, "<路由>": { "<精确模型串>": [ 价段… ] } }`。
  **价段**是扁平对象:`{ "from"?: "YYYY-MM-DD" | "YYYY-MM-DDTHH:00", "inputPerMillion": number,
  "outputPerMillion": number, "cacheReadPerMillion"?: number, "cacheWritePerMillion"?: number,
  "slots"?: [ 峰谷时段… ], "note"?: string }`;`from` 省略或 `""` = **最早一段**(自始生效,
  界面上写作「无起点」:它是一个左端开放的区间,不是"缺了字段的一段"),
  纯日期 = 当天 0 点。**峰谷时段**同样是扁平对象:`{ "days"?: "daily" | "weekdays" | "weekends",
  "start": number, "end": number, "inputPerMillion"?: number, "outputPerMillion"?: number,
  "cacheReadPerMillion"?: number, "cacheWritePerMillion"?: number }`,`start` / `end` 是整点、
  左闭右开(`0 ≤ start < end ≤ 24`,`24` = 当天结束);四档价是**任意子集**,写了哪档覆盖哪档、
  没写的沿用该段全天价,但**至少要写一档**(整条都沿用的时段等于全天价,写路径拒绝),
  `days` 省略 = `daily`。缺失的 (路由, 模型) = 这条价不存在
  (其记录回落为价格未知)。整表解析、校验后**整体替换** `pricing.json`,所以写坏的 body 绝不会
  半应用。**客户端自动保存**(任何改动停止输入约 0.6 秒后写一次,切 tab / 关窗前先冲刷;
  Ctrl/Cmd+S 立刻冲刷),页面没有保存按钮——那条状态栏只报 保存中 / 已保存 / 未保存+原因 /
  保存失败+重试;草稿里还有非法值时**不写**(文件保持上次成功的样子),补全后自动重试。
  - 写路径**严格**:非负有限数;`from` 必须是真实存在的 `YYYY-MM-DD` 或**整点**
    `YYYY-MM-DDTHH:00`(分钟不是这条时间轴的单位,`T12:30` 一律拒绝);`slots` 里 `days` 必须是
    三个取值之一,`start` / `end` 必须是整点且 `0 ≤ start < end ≤ 24`;同一 (路由, 模型) 内
    **不得有两段同一时刻生效**;**同一段内的两个峰谷时段不得在任何时刻同时生效**(时段区间相交
    **且** `days` 有交集才算冲突,所以「工作日 9–12」与「周末 9–18」可以并存);价段与峰谷时段
    都不许有未知字段;`$billing` 之外不许有其他 `$` 保留键;报错带出事位置(路由 / 模型 / 第几段 /
    第几个峰谷时段)。
  - 读路径**宽容**:畸形路由 / 模型 / 价段被丢弃并按 `from` 升序规范化(同一时刻重复时文件里靠前
    的一段胜出);畸形峰谷时段(小时不合法、`days` 不认识、四档价一个都不能用)整条丢弃——**绝不**用
    猜出来的 `days` 套用,那会把时段价静默铺到每一天;两个可能同时生效的时段按 `start` 升序保留
    靠前的那个。
  - 价格表的草稿把**没写的生效时间**锚在该行的**首记**上:账本计过费的 (路由, 模型),只要它的
    价段 `from` 为空,browser 半区就按 `firstAt` 所在的**整点**填上(`anchoredRow`,
    `src/client/pricing/draft.ts`),随后续的整表 PUT 落盘——界面、时间轴与文件因此说同一句话。
    锚点**不晚于** `firstAt`(整点向下取),覆盖的记录与「最早一段」完全相同;另一段价已经起在
    `firstAt` 之前或同刻时保持为空(段序决定每笔账取哪段价,锚定不得改变它),没有 `firstAt`
    的行同样保持为空。host 的读路径、计价口径与成本层都不参与这条规则。
- 计价口径:**两级**。一条记录先按**它自己的时间戳**取「最后一段 `from ≤ 该时刻` 的价」,再在该段内
  按记录**本地时间**取生效的峰谷时段(星期几落在 `days` 里、小时落在 `[start, end)` 内);没有时段
  生效就用该段的**全天价**。时段未写的档位沿用全天价,缓存档再按最终输入价兜底。早于最早一段、
  或该 (路由, 模型) 没有任何价段 → **价格未知**(¥0)。`$billing` 缺省 = `metered`。
  所以回填一段更早的价会重算历史,不需要重建任何聚合。
- 派生折叠 `rollup.json` 带 **`pricingRevision`**(价格文件内容的 djb2 签名):费率行的身份(生效
  时刻 + 该时刻生效的峰谷时段)是从价格表推导出来的,签名一变整份折叠作废、由日文件重建。价格表
  tab 的「账本 N 次」透镜只读记录缓存,**不写折叠**(它不按价折叠):它在同一次遍历里顺带带上每行
  的首/末记录时刻与 `unpriced` 计数(见上),因此**价格表读一次价文件**供透镜判定覆盖。
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
| `pricing.json`(+ `.tmp` / `.bak`) | 唯一的价格文件:保留键 `$billing` + 路由 → 模型串 → 价段数组(每段 = 生效时间 + 全天价 + 峰谷时段),整表替换 | `PUT /tokbook/pricing` | 缺失 = 什么都没定价(全部价格未知);畸形条目只影响对应的 (路由, 模型);写路径先把上一版挪到 `.bak` 再 rename |
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
  两级解析(`priceAt` 取该时刻生效的价段,`slotAt` 再取该段内该时刻生效的峰谷时段;都没有就是
  价格未知)。费率行的身份是**当时生效的价段的生效时刻 + 那一刻生效的峰谷时段**(时段身份 =
  它的 `start` 与 `days`:同一段内两个时段不会同 `start` 同 `days`,否则它们必然重叠、写路径会拒)。
  编辑时段的**费率或结束小时**就地重算那段历史;改它的**开始小时或 `days`**、或删掉它,那段历史
  就成了**价格未知**(¥0)——这些金额因此浮出在 `unpricedModels` 里,绝不静默按邻近时段计价。
  因为费率行身份是从价格表推导出来的,`rollup.json` 记下价格文件的签名(`pricingRevision`),
  签名一变整份折叠作废并由日文件重建。
- 金额分双桶:`spend` 只含 `billing: metered` 路由(实际支出),`subscriptionValue` 只含
  `billing: subscription` 路由(订阅价值,非现金);UI 不得把后者当作支出展示。
- 计费性质以**通道路由**为单位(`$billing` 的一条),省略 = metered;它作用于该路由的全部
  历史(与旧口径一致:改 `$billing` 会同时改变历史的分桶)。
- rollup 带 `schemaVersion: 4` 与 `pricingRevision`;旧版本(v1/v2/v3)或签名不符读作缺失、
  由日文件重建。
- 额度卡只展示官方通道数据;`unconfigured`/`error` 卡便宜地即时重推,从不当作
  "最近已知"持久化。
- 额度卡**先回答「什么在管这个账户」**(`gate`),再展示数字:窗口只约束订阅内含的月度额度,
  所以非 `subscription` 门的卡**不渲染窗口行也不画表盘**——余额门领读余额 + 三个来源(余额没有
  分母),`none` 门只出状态面板(连数字都没有);告急点(`isQuotaAlert`)对两者静默——残留的
  `exceeded` 不是用户还能处理的信号。两者**都不参与自动刷新**(值不随分钟变化),但仍手动可刷、
  且每次打开 tab 会按新鲜度预算强刷一次(这类卡照常落盘),续费因此在下一次打开或点刷新时被接住。

## 交叉引用

- 事件、同步探测、以及跨模块级重载的去重边界语义:`docs/HMR.md` §4。
- 端到端故事、安装与配置示例:`../README.md`。
- 这些形状为什么存在(数据模型推理):`docs/DESIGN.md`(重构说明一节)与
  `docs/DECISIONS.md`。
