# dsh-tokbook —— 技术选型与插件框架设计（一期→二期演进）

> **Doc meta** · role: reason · language: zh-CN · status: current · last-reviewed: 2026-10-18 · supersedes: —

> 面向 DeepSeek Harness（DSH）的跨会话 Token 用量账本插件。本文只留**从代码推不出来**的东西：外部
> 系统的机制与事实、为什么是现在这个形状、每条选择的代价。权威来源只有两个——官方文档站点
> `https://deepseek-harness.github.io/deepseek-harness/` 与 DSH 源码
> `C:\Users\28529\Desktop\deepseek-harness`（下文引用其中的路径，均相对该源码根）。

---

## 阅读指南（先读这里，分清时间线）

> 本文是**设计推理与演进记录**，不是当前接口的唯一真相。时间线如下：
>
> - §1–§11 描述**第一期**框架（外置插件 + 浮窗 + 每会话聚合）。**§9 已于 2026-09-16 删除**（一期
>   交付物清单），**号不再复用**；**§8 只剩一句指针**，正文搬去了 [`../README.zh.md`](../README.zh.md)
>   的「安装」与「布局」。旧文字里引用它们的按 git 历史追溯。
> - 「重构说明」与 §3.1 描述**第二期 = 当前代码形态**（逐请求 JSONL 账本 + 成本计价 + 通道/额度），
>   **以此段为准**；§1 的「本期不做成本」与 §11 的预判已被二期推翻。成本语义见
>   [`CONTRACTS.md`](CONTRACTS.md)。
> - **第三期 = 价格表破坏性重构**：删掉云端镜像 / 通道覆盖层 / 双维计价，改成本机唯一一份
>   手工价表（路由 → 模型串 → 价段）。二期关于云端 feed / 覆盖层的长文已删（避免再被当成现状），
>   旧文字按 git 历史追溯。
> - **第四期（当前）= 价表去掉生效时间轴**：每个 (route, model) 只剩一份**当前价** + 峰谷时段，
>   金额收口成「现价刻度」并且只在 30 天及更短的窗口里给（推理见 §5 末「为什么价表只有一份现价」）。
>   「价段」这个词在第三期文字里仍会出现，读到它按第四期理解：那份价就是当前价。
>
> **精确接口** → [`CONTRACTS.md`](CONTRACTS.md)；实现与操作现状 → [`../README.zh.md`](../README.zh.md)；
> HMR → [`HMR.md`](HMR.md)。

---

## 0. 一句话结论

DSH **已经内置**逐会话、逐 turn 的 token 计量与展示（`token-meter` / `session-stats` 投影 + 内置 Web UI）。
所以 `dsh-tokbook` 的增量在**跨会话、可持久化、可回溯**的聚合账本与一个**常驻浮窗**，不重复造逐 turn 的轮子。

## 1. 目标与范围

**目标。** 一个独立外置插件（host 半区 + client 半区）：host 监听持久化 `session/event`，把每次通道
计费模型调用落成可持久化的账本，数据跨重启累计、能按会话 / 模型 / 通道 / 时间维度汇总；client 在
Web UI 左下角（设置按钮上方）加一个入口按钮，点击弹出独立浮窗展示账本。

**范围边界。** 保持纯外置，不改造 DSH 仓库——唯一例外是「左栏常驻入口」：要它才需要 in-repo 改
`ui-sidebar` 声明新子槽（见 §6）。成本折算曾列为「本期不做」并判给 `dsh-costbook`，二期已推翻落地
（见阅读指南）。

## 2. 技术选型（已落定，只记理由）

- **形态**：Cordis 插件，一个 host 包 + 可选 client 半区——DSH 的一切功能都是 Cordis 插件。
- **构建 / 语言**：TypeScript + 自建 bundle——外置包拿不到单仓 `clientBundle()` 预设（§7）。
- **捕获**：`assistant/message` 的 `usage`——通道上报、持久、可重放、exactly-once，是唯一的权威计量；
  `session-telemetry` 可能丢 / 重，不能当账本（§5）。
- **持久化**：自己按日追加 JSONL 到数据目录（`node:fs`）——账本是流水账，不是「几条小状态」，
  所以不吃 base 层那套 schema 校验的 JSON 后端（`storage-domain`）。（§5 有同一条的完整理由。）
- **host→浏览器**：`ctx.webServer` 的精确 Fetch 路由——外置插件难以贡献生成式 Typert Remote。
- **UI**：只填**已声明**的槽——入口按钮 + 浮窗（`sidebar.footer.action` + `shell.overlay`），
  以及后来加的会话词元页（`conversation.view`）。外置插件不能声明新 slot（§6）。

## 3. DSH 插件机制（必要背景）

- **插件** = 实现某个 `ctx.<key>` 服务的对象。要么是带 `name`/`inject`/`apply(ctx)` 的函数，要么是
  `Service` 子类。生命周期由 Cordis 挂载到上下文；`inject` 声明服务依赖决定启动顺序；
  注册副作用用 `ctx.effect()` / `ctx.on()`，reload/teardown 时自动撤销。
- **服务藏在 ctx 键后**：`ctx.tokenMeter`、`ctx.sessions`、`ctx.sessionProjections`、`ctx.webServer`、
  `ctx.slots`、`ctx.storage` 等。插件按 key 取服务，而不是 import 具体实现。
- **事件通信**：`emit`（观察）、`waterfall`（环绕中间件，可短路）、`parallel`、`serial`、`bail`。
  监听器通过 `ctx.on(...)` 注册。
- **扩展点在文档里有一张「feature → mechanism map」**（`docs/cookbook/extension-cookbook.md`）：
  模型流式输出走 `agent/assistant-stream`，持久落账走 `session/event`，UI 走 `slots`。

### 关键：`dsh web` 是怎么组合出来的

- `dsh web` 是 `--profile web` 的别名（`apps/cli/src/args.ts`）。
- `web` profile = bundles `[ @deepseek-ai/dsh-base, @deepseek-ai/dsh-web-app ]`，`patchReload: live`
  （`packages/boot/app-boot/src/profile.ts` 的 `PROFILE_TEMPLATES`）。
- 每层 bundle 通过 `package.json` 的 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` 导出一个
  patch 层；加载顺序 = 各 bundle 层 → profile 的 `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` →
  `--patch` 覆盖层（`apps/cli/src/profile-boot.ts`）。
- `token-meter`、`session-projection`、`storage`、`storage-json`、`storage-domain` 都在 **base 层**默认挂载，
  所以插件要用它们时直接注入即可、不必自己挂。（**本项目只用得上其中的投影类服务**：账本自己写
  JSONL，见 §2 与 §5。）

### 宿主接缝：鸭子类型、能缺席、只读视图不许抛

本插件对 DSH 的每一条接缝都是**鸭子类型**：`session/event` 的事件流、`sessionPersistence` 的持久化面、
`webServer`、`settings`、`llm`、`workspaceRegistry`、`credentials` 各有一份本仓库自己声明的最小接口。
外置包不消费 DSH 的类型包，所以宿主换形状时 TypeScript 不会红——好处是同一个 bundle 能吃下几代宿主，
代价是断链只能在运行时发现：那次 `sessionPersistence` 把 `inspect()` 拿掉，编译期一声不响，症状是
「回填一行不写、`/tokbook/sync` 一路报 done」（[`LESSONS.md`](LESSONS.md) §8）。所以碰这些缝时，默认
要留一条「读不到也照常工作」的降级，而不是把形状押在一个版本上。

`settings` 缝是一件**表单**服务，不是配置仓库：它只有 `describe()`，按 profile entry id 给出每个插件的
**活动配置值**，而且只投影可热改的字段。价格表 tab 要的是「用户声明了哪些通道」，所以代码在这里把
`describe()` 收成一张按命名空间取值的表——没有按 ns 的 `get` 可调。

这些服务还可能根本不在。`ctx.get('x')` 是反射读法，以属性方式读未挂载的服务会抛 `without inject`，
而用它们的全是**只读视图**（概览 / 用量 / 价格表 / 额度），一张读不通的页面不该把整块界面打成错误页。
缺席一律读成 `undefined`，然后各自降级：没有 `workspaceRegistry` 时「按工作区」这一面**不存在**（而不是
把所有记录都算成未归属）；没有 `llm` / `settings` 时通道目录只剩 live 适配器注册表；没有 `credentials`
时额度卡是 `unconfigured`，绝不回落到本地估算。

还有一条宿主行为值得单独记：DSH 启动器接住未处理的 rejection 并 `exit(1)`。所以每一处 fire-and-forget
（账本预热、后台探针、额度快照落盘、年历刷新）都必须自己 catch——这不是防御性设计：一个坏路径
（`path` 指向一个已存在的文件）加一条没人 await 的预热，就能带走整个宿主。

## 4. 总体架构

两个半区，一条单向数据流：**host 拥有全部数据**（持久事件流 → 折叠 → 账本落盘 → 精确 Fetch 路由），
**browser 只注册三个已声明的 slot 并读那条路由**（入口按钮 / 浮窗 / 会话词元页）；浮窗开关是入口组件的私有 React state。**为什么：**

- **数据只过 host**：账本要跨重启、要被别的消费者读，而 browser 半区只活在一个页面里；持久
  `session/event` 流也只有 host 看得到。
- **host→browser 用精确 Fetch 路由**而不是生成式 Remote：外置插件贡献不了 remote namespace（§2）。
- **控制面与数据面分开**：按钮只负责开窗、浮窗只负责读，两者都进**已声明**的槽，所以不动 DSH（§6）。

**路由注册挂在 `ctx.inject(['webServer'])` 的作用域上，不是外层 ctx。** `register` 撞到同一个
`(kind, path)` 会抛错，而 webServer 单独重载时只有注入作用域上的 effect 会跟着撤销——把注册留在外层，
换一次 webServer 就是整片路由重复注册。这条不是整洁问题，是重载能不能活下来的问题。

## 5. 数据模型与持久化（只留不显然的取舍）

形状本身读 `src/types.ts` / `src/usage-log.ts` / `src/stats.ts`；值得写下来的只有下面这些取舍：

- **逐请求一行，而不是每会话聚合。** DSH 自带的每会话投影是折叠后的四桶：粒度粗（答不了「按天 /
  按请求」），而且投影格式一变整份历史就得重建。一行 = 一次通道计费调用，事实不丢、聚合随时重算。
- **账本不能丢，派生的折叠可以丢。** 按日 JSONL 是 append-only 的**真源**；`rollup` 只是冻结日文件的
  缓存，缺了 / 畸形 / 价表签名变了就整份作废重建——所以改价能在读取时重算全部历史而不动账本。
- **按本地日历日切文件，且按事件时间归档（不是写入时刻）。** 切分让「今天」这个热文件小而可增量、
  冻结日只读；按事件时间归档，补写与跨时区的历史才落在它真正发生的那一天。
- **行里只记身份，不记派生归属。** 价格与工作区都是**读时连接**出来的（费率身份 ↔ 价表；会话 header ×
  工作区注册表），所以价表改了、挂载点变了，下一次读取就是新答案，历史一行都不用重写——代价是每次读取重算。
- **真源只有一个写者**：追加走串行队列 + 进程级 request-id 去重，幂等靠从磁盘重建的去重集；多写者会让
  rollup / 缓存 / refile 互踩。
- **持久化自己开文件，不走 `storage-domain`**：账本按日写 JSONL（`src/usage-log.ts` 用 `node:fs`），
  派生文件原子写（temp + rename）。宿主那套 schema 校验的 JSON 后端是为「每条键一份小状态」设计的，
  装不下逐行追加的流水账；**不要用 `session-telemetry` 记账**——官方文档写明它的记录是
  best-effort、可能丢/重。

### 派生文件的原子写：Windows 的 rename 与并发写者

数据目录里的每个派生文件（额度快照、年历缓存、同步基线、`rollup`）都走 temp + rename，但目标已存在
时，Windows 上覆盖 rename 会**间歇**失败，所以落盘前先 `unlink(target)`（`pricing.json` 是另一套：
它先把自己 rename 成 `.bak`，见 [`CONTRACTS.md`](CONTRACTS.md) §3）。代价是那一瞬间磁盘上没有目标文件
——所以这些文件的读法必须把「缺失」读成「还没有」，读成「空」就会在这条缝上出错。这也是它们读得那么
严格的原因：一个被半写的文件只有读成「没有」才安全，读成「最近已知」会永远端出假数字。

**并发落盘的路径上，临时名必须唯一**（pid + UUID）。固定的 `.tmp` 会被两个写者互相覆盖，其中一个的
rename 报 ENOENT 又被 catch 吞掉，结果是磁盘上**一份快照都没有**——唯一那份「最近已知」就这样丢了，
而且没有任何报错。串行写的路径（价表、同步基线）用固定 `.tmp` 就行：它们本来就有锁，或者只在一处写。

调用点也都是 fire-and-forget（额度刷新不 await 落盘），所以同一个目标路径上有一条模块级写入链，让后
一个写等前一个落定。不串行的话，后一个的 `unlink` 会删掉前一个刚 rename 好的快照。

### 为什么价表只有一份现价，以及金额为什么只在 30 天窗口里给（第四期）

第三期的价表是「每个 (route, model) 一个价段数组，每段带生效时刻，记历史金额时按记录**自己的时间戳**
取价」。第四期把那一轴删了。理由是**成本收益比**，不是精度：

- **那个功能要求一份用户拿不到的数据。** 厂商的调价史只存在厂商那里，日志里没有，事后也补不出来。
  默认路径更糟：界面「加一段价」把生效时间填成今天，于是**用户最关心的最近一个月直接变成 ¥0**
  （写下的生效时间静默截断它之前的一切）。维护者本机数据里已经出现过这种行：价填了、界面看着完整，
  前一天 7000 万词元静默计入 ¥0。实测那些 `from` 大多也不是调价时刻，而是**录入那一刻**（一簇
  `2026-09-21T18:00`、一簇 `2026-10-01`）——字段在实践中退化成「我什么时候敲的」。
- **它值多少：1.3%。** 拿维护者真实账本（50 天、11.4B 词元、50 对价、其中 6 对是多段）算过：
  全部账本里由「旧价段」定价的行 12 / 136（词元占 6.3%），金额 ¥297.70 → 按现价折算 ¥305.84（+2.7%）；
  **近 30 天 ¥150.47 → ¥152.37（+1.3%）**；近 7 天 0%。而那套机制带来的界面与不变量（调价史轴、段卡、
  同刻冲突、`EARLIEST` 哨兵迁移、`from` 身份、若干测试节）是一整块复杂度。
- **窗口本身就是口径。** 金额按现价折算 ⇒ 它是「最近用掉的 token 值多少钱」这把刻度，不是历史账单：
  拿今天的价去折算一年前的用量，既不是那笔支出、也不是今天的价值。于是**展示规则**跟着定：
  30 天及更短的窗口给金额，「全部账本」只给词元（词元是事实，放多久都成立）。近 30 天里仍会发生
  厂商调价——那是**已知且接受**的偏差（实测 1–2%），比继续维护一份拿不到的调价史划算得多。
- **保留的东西**：`slots` 峰谷时段（那是**用户行为**的时间轴，闲时折扣就在这里）、`$calendar` 年历
  （公共数据、便宜）、`$billing` / `$currency` / `$fx`。删掉的只有**价格的时间轴**。
- **已知代价**：既有历史金额会一次性变化（本机数据 +2.7%）；旧价段数组只保留生效时刻最晚的那一段
  （读路径迁移，写路径只接受新形态）。这两条都写在 [`CONTRACTS.md`](CONTRACTS.md) §2。

### 两个自动数据源（models.dev / holiday-cn）：外部事实与判定口径

**models.dev 是别人维护的活目录，不是我们发布的格式。** 条目随时增删、形状会漂，所以解析一律宽容：
读不懂的条目跳过、读不懂的整包才算失败。它是**美元单一币种**的目录（每百万 token 四档价，没有币种
字段），所以只有声明 `$currency: USD` 的通道能直接采用；人民币通道的挂牌价不是美元价的函数。采信
边界的规则（原厂 slug 清单、同一 id 分裂价整键弃采、手写价永远赢）在
[`CONTRACTS.md`](CONTRACTS.md) §2——这里只留那句代价：宁可价格未知，也不把转售价冒充通道成本。

**目录里的模型串和账本里的不是同一个写法**（`deepseek/deepseek-v4-flash` 对 `deepseek-v4-flash`，
还带 `:variant` 与 `[1m]` 长上下文标记），所以两边共用一套归一化再比。「查价」的模糊搜索也走同一套：
多词关键词要求**每个词**都命中，否则 `gpt-x` 会搜回一屏 gpt。搜索是用户自己判断的那条路，候选池
已经是采信集，所以排序只看名字、不看价格——池子里根本没有便宜的转售价可比。

**holiday-cn 的边界是「用放假安排，不用调休」。** 上游每天抓国务院公告、一年一个 JSON，我们只收
`isOffDay` 的日子：调休上班日进不进来都不影响本仓库，因为周末无论上不上班都按闲时价。更大的坑在
未公布年份——上游答的是**空数组，不是 404**，所以「拉到了但没有日子」必须读成「还没有数据」；读成
「那一年没有假期」会让 `workdays` 整年按周一至周五算，把假日的峰价全部记成高峰。

**自动年历不进 `pricing.json`，只在读的时候合并。** 那是用户手写、且被 client 整份重写的文件——把
自动数据写进去，等于「用户改一格价就把这些年固化成了手写数据」，此后源头的更正再也进不来。合并规则
也只有一条：**手写有那一年就整年用手写**，逐日取并集会把用户删掉的假期悄悄加回去。它不在价文件里，
所以年历的内容签名必须并进 `pricingRevision`——漏签会让「刚补上的假期」继续沿用旧折叠，金额静默停在
错的数上。

**价表 tab 的状态行说的是「要操心的东西有没有、上次成没成、还新不新」，不是内部状态机。** 所以
models.dev 的「一次都没试过」不能报 `ok`——那会让界面说「已由 models.dev 自动补着」，而实际一次都没
试过；年历那边同理，要的年份一个都没有才劝用户手动填，手写已经覆盖全部年份时什么都不说。

## 6. UI 设计（外置插件即可落地，无需改 DSH 仓库）

**关键外部事实：外置插件不能声明新 slot**，只能注册进宿主**已声明**的槽（`docs/subsystems/slots.md`
+ `packages/client/AGENTS.md`）。要的「左下角入口 + 点击弹浮窗」刚好落到两个已声明的槽，**纯外置可行**：

- `sidebar.footer.action`（侧栏底部的短操作；官方明确「优先于替换整列 sidebar」）——入口按钮。
- `shell.overlay`（壳层浮层，list / additive，位于所有列之上；官方点名「要浮在整个应用之上的框架级
  浮层先查这个槽」）——浮窗本体，注册项自绘并自己接管 pointer events（接管前是 click-through）。

### 6.0 侧边栏植入：社区的两条路线，本项目选 A

- **路线 A（采用）——DSH 官方 slot。** 权威参考
  [build-deepseek-harness-plugin · client-slots-and-theme.md](https://github.com/oil-oil/build-deepseek-harness-plugin/blob/main/references/client-slots-and-theme.md?plain=1)。
  社区 starter [kun2-5code/dsh-plugin-template](https://github.com/kun2-5code/dsh-plugin-template) 把
  浏览器侧 UI 拆成 14 个 surface，其中就有 `sidebar.footer.action` 与 `shell.overlay`——正是「左下角
  入口 + 独立浮窗」的标准做法。**该模板同时证明：纯 slot 注册在任何 harness 上直接生效**（不同于设置
  卡片受 allowlist 限制，见 §11）。优点：不动 DSH、无第三方依赖、不绑版本。
- **路线 B（否）——生态注册表服务。** [DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)
  开放一个 Cordis 服务，供消费插件注册 tab / file viewer，但它自建的是**右侧面板工作台**——位置与
  形态都不是一回事（右侧面板 ≠ 左下角入口 + 浮窗），且带版本墙与 `pnpm approve-builds` 门槛。

> 何时转 B：只有当词元账本想成为「那个侧边栏工作台」里的一等 tab 时，再以 optional peerDependency 引入。

**复核结论：** 两个槽都是 list + root、additive，外置插件可直接填入；**都是「纯 slot 注册」，在任何 harness
上生效**。只有想要「左栏常驻入口」而非 footer 按钮，才需要 in-repo 改 `ui-sidebar`；逐槽 props 与注册写法见 `src/client/index.ts`。

### 6.1 可点元素分两档，判据是位置

价格表 tab 里每个可点的东西都属于下面两档之一，**选错档不会报错，只会让按钮看起来不像按钮**：

| 档 | 用哪个类 | 形状 | 判据 |
|---|---|---|---|
| 行内即时动作（复制 / 删除） | `.dtpl-price-ghost` | 无框、无底色、悬停浮一层洗色 | 它贴在数据行里、**旁边就是输入框**，画框会与输入框抢「这是个盒子」的意思 |
| 独立成行的动作（取价 / 搜索价 / 幽灵行 / 年历开关） | `.dtpl-price-tool` / `.dtpl-price-add-ghost` / `.dtpl-price-cal-toggle` | 1px 框 + 6% 洗色面 + 主墨 | 它自己站一行、旁边没有输入框，必须靠**框与面**自证可点 |

**为什么记在这里**：这条规则曾经只写在 `.dtpl-price-ghost` 的注释里，而那段注释的理由是
「它贴在数据行旁边」——一个不适用于独立按钮的前提。照着它给底部工具条的两个按钮选样式，
结果它们是 0 边框、透明底、fg-2 灰字（实测），在屏幕上就是两段普通文字。判据搬进本文后，
新增可点元素时按「位置」选档，而不是按「看起来像不像链接」。

## 7. 外置包构建（这是最关键的一道坎）

**运行时外置完全支持**：Cordis loader 对每个配置行就是拿包名走 Node 自己的 ESM 解析；client-module
系统扫描启用的 Loader 行、读 `package.json` 的 `dsh.client`，并从该包自己的 `lib/client.js` 提供——
解析不分单仓内外。外置包唯一拿不到的是**构建侧的单仓预设**。

**必须自己复刻懒加载 CJS factory。** `clientBundle()` 预设靠 `globSync('packages/*/*/package.json')`
找 manifest，所以没有发布版；官方原话是外置包“has to reproduce the same output format itself”。要复刻
的契约只有一个：模块体被包进 `window.__ModuleLoader__.load({ id, factory })` 的 **factory 闭包**——加载
时只注册 factory，真正执行（materialize）时才跑模块体。构建脚本细节读 `scripts/build-client.mjs`。

**基线外部依赖取的是 `PLATFORM_MODULES` 的一个子集，不是全等于它**：清单里只列本插件 client
半区**实际 import** 的 specifier（当前只有 `react` 与 `react/jsx-runtime`），因为它们才是允许留在
bundle 外的。多列几个看起来无害，实际会让一个越界的 import 静默通过构建、到运行时才靠宿主的
模块表兜住——所以这份清单**兼一道门禁**（`verifyClientBundle` 判死表外的 require）。真源是
`scripts/build-client.mjs` 的 `BASELINE_EXTERNALS`；**DSH 升级时按它新增的基线模块核对**。
单仓里这些纪律由 verify-client-packages / bundle-purity gate 强制，外置包拿不到那些门，只能自己守：

- 跨包类型一律 `import type`；绝不 runtime-import 另一个 feature 插件的值。
- 非基线的运行时 `require` 必须在 `package.json` 的 `dsh.client.external` 里声明（`inject` 只是信息性依赖边）。
- `dsh.client` 必须 `platform:'web'` 且 `./client` 可解析；发布前要产好 `lib/client.js`，否则激活会因缺
  bundle 而**亮声失败**。

**client 入口的 id 必须等于包名**：DSH 的 client-modules 拿包名去请求 `exports["./client"]`，id 对不上
就是「插件在、按钮不在」。同理，包裹形状、`apply` / `inject` 在不在、有没有 `default`，这三件事错了
**不会让构建失败**，症状仍然是那只消失的按钮——所以构建脚本在写盘之后，用 Proxy 冒充基线模块表、真的
把 bundle 执行一遍，自证这三件事（`verifyClientBundle`）。这是本地最接近宿主那一步的校验：`pnpm typecheck`
不会碰产物。

### 7.4 Client 插件**不可加 default 导出**（cordis loader 行为，实测坑）

- 关键机制：cordis loader 取插件对象时用 `exports.default ?? exports`（`vendor/loader/src/index.ts`
  的 `unwrapExports`）。若 client 入口 `export default` 一个 `apply` 函数，loader 就**拿那个函数当插件**；
  而函数身上没有 `.inject`（它是模块的具名导出），于是 cordis 读出空 inject → 在 `apply` 里访问任何
  `ctx.<service>`（如 `ctx.slots`）抛 `cannot get property "slots" without inject`。
- 结论：client 插件只导出**具名** `inject` 与 `apply`，**不要 `export default`**。官方 client 插件
  （ui-theme、better-sidebar）都是「无 default 导出」，正是为了避开这个 loader 行为。
- 区别 host/client：**host 半区的 `default` 导出是 Service 子类**（靠 `static inject` 声明依赖），host 用
  default 是正确写法；只有 **client 半区必须走具名** `inject`/`apply`。

## 8. 接入 `web` profile 的步骤（外置）

**操作步骤的真源是 [`../README.zh.md`](../README.zh.md)「安装」**——`dsh plugin add`、它自动选中的
bundle 层，以及 client 改动怎么生效（`rev` 不可变缓存、刷新 / 重启 + 硬刷新 / link 安装）见
[`HMR.md`](HMR.md)。

> 本节原有的一遍外置接入走查（与 README 重复）和一段 HMR 复述（与 HMR.md 重复）已于 2026-09-16
> 删除；要追溯读 git 历史。

## 10. 关键设计决策与硬约束汇总

1. **外置 vs in-repo**：运行时无差别；外置的**唯一硬阻点是 build**（无 preset，需自复刻 CJS factory）。
   何时该反悔：一旦需要大量复用 DSH 内部 UI 模块、或走生成式 Remote，in-repo 会明显省力。
2. **host→浏览器数据通路**：`ctx.webServer` 的精确 Fetch 路由，不用生成 Typert Remote；「屏上那份还要
   不要重算」只看账本代数（`/tokbook/sync` 的 `ledger`），不接 SSE、也不盲轮询（口径见
   [`CONTRACTS.md`](CONTRACTS.md) §2）。
3. **记账权威源**：`assistant/message` 的 `usage`；不用 `session-telemetry`（可能丢 / 重）。
4. **UI 槽位**：只填已声明的 `sidebar.footer.action` + `shell.overlay`（+ 后来的 `conversation.view`），**无需改 DSH 仓库**（路线 A，见 §6.0）。
5. **不要看 `dsh-costbook`**（已废弃 / 有问题的实现），不要照抄它。

## 11. 风险与后续

| 项 | 风险 / 说明 |
|---|---|
| 外置 bundle 格式 | 需自己维护基线 external 列表与纯净化纪律（它同时是判死表外 import 的门禁）；DSH 升级若新增本插件用到的基线模块需同步。风险可控 |
| client 插件默认导出 | 不可给 client 入口加 `export default`（cordis loader `exports.default ?? exports` 会掩盖 `.inject`，报 “without inject”）。见 §7.4 |
| 设置卡片（若后续做） | `settings.plugin.item` 卡片在 stock harness 上被 `WEB_SETTINGS_NAMESPACES` allowlist 卡住、显示“not exposed”；需在 DSH 的 api-proxy 加一行，或等官方把声明迁进 `settings.register()`。本项目 UI 走 footer+overlay（**纯 slot 注册，不受影响**），仅当后续加配置卡片时才需注意 |

## 附：参考资料索引（权威）

- Cordis 入门：`docs/cordis-primer.md`（同步版见官方站点）
- 扩展插件形态：`docs/cookbook/extension-cookbook.md`
- 新增 package 清单：`docs/cookbook/adding-a-package.md`
- 新增设置卡片：`docs/cookbook/adding-a-settings-card.md`
- Web Client 架构：`docs/subsystems/web-client.md`
- Client Modules：`docs/subsystems/client-modules.md`
- Web Client Slots：`docs/subsystems/slots.md`
- Token Meter：`docs/subsystems/token-meter.md`（+ `packages/llm/token-meter`）
- Session Telemetry：`docs/subsystems/session-telemetry.md`
- 外部插件装 profile：`packages/boot/app-boot/src/profile.ts`、`apps/cli/src/plugin.ts`、`apps/cli/src/profile-boot.ts`
- client 包约定：`packages/client/AGENTS.md`、`packages/client/tsdown.client.ts`
- 路由注册：`packages/host/webserver/src/index.ts`

## 重构说明：从「每会话聚合」改为「逐请求账本 + 成本」（第二期）

**为什么改。** 每会话聚合的四桶答不了「按天 / 按请求 / 哪个工作区」，而且它就是 DSH 投影的格式，一变
就得整份重建。逐请求行把**事实**留下来，把聚合降级成可丢弃的派生。

**代价（仍在付的）：**

- **回填要重放整份会话日志。** 探针只做廉价部分（列会话 + 比对 revision），需要折叠时排到后台并按
  15 s 节流——把整份日志解码挂在读路径上，就是「打开用量页要等半天」。唯一例外是**冷账本**（一个日
  文件都没有）：那时读等一轮，否则「还没回填完」会被显示成「没有记录」。
- **清单本身也不是免费的。** 「列会话 + 解 header」在本机 775 个会话上要 0.3–0.5 s，所以它按同一个
  15 s 窗口缓存；窗口过了只起一轮后台重取，本次读照旧端出旧的。节流只压 revision 漂移的会话——
  **从没有基线签名的会话不受节流**（首装回填、刚开的新会话），它们便宜，而且不立刻同步就会像没记上。
- **扫描按钮先取到清单才占互斥。** 先答 `running` 再被在飞的那轮顶掉，等于用户按了扫描却什么都没发生。
- **记账开始得比插件早的会话只能靠回填补**，回填幂等（§5 的去重），失败可重跑。
- **每行只记身份，所以每次读取都要连接价格与工作区**（§5）：换价表 / 换挂载点即刻重算，历史不动。
- **丢行比「未上报用量」更不可查。** 没上报 `usage` 的计费调用同样落一行（计入请求次数、桶为未知）：
  未知 ≠ 0——与「价格未知 ≠ 免费」同一条原则。

### 3.1 额度门的证据（外部事实，代码推不出来）

Command Code 的 [定价 / 限额文档](https://commandcode.ai/docs/resources/pricing-limits)
写明：5 小时 / 每周窗口**只约束订阅内含的月度额度**，「no subscription (free or balance-only) …
gated only by their credit balance」「requests skip the window check entirely」；[FAQ](https://commandcode.ai/docs/troubleshooting/faqs)
写明订阅额度到期作废，而「Can I subscribe every other month? Yes.」——**隔月订阅是官方用法**，
「没有订阅」是正当的付费形态。OpenCode Go 只报窗口百分比、不报套餐身份，唯一可用信号是状态码：
**403 = valid key, no Go subscription**（与 401 鉴权失败是两回事——记成「查询失败」会让用户去查网络）。
这些是**外部事实**，代码推不出来；规则见 [`CONTRACTS.md`](CONTRACTS.md)。

**那个 Go 端点在 Cloudflare 后面，默认的 Node UA 会被挡**（error 1010），所以请求带一个浏览器 UA——与
cc-switch / cost-meter 是同一个修法。这是端点行为，不是我们的偏好：换回规范 UA 就过不了那层浏览器
签名检查，而这条路上 403 另有含义（有效的 key、没有订阅），所以收到 403 得先分清是哪一层给的。

**Command Code 的 `/alpha/*` 是 CLI 的私有 API，没有公开文档。** 认证是 Bearer key 加
`x-command-code-version` 与 `x-cli-environment: production` 两个头；端点之间也不是原子的——whoami 圈定
org，credits / subscriptions 并发取，usage/summary 最后取，因为只有订阅记录知道当前周期的起点，摘要
必须拿这个起点作 `since`。「周期花费 + 剩余余额池 ≈ 计划的月度 credits」这条算术要两边同周期才成立
（手工核过）；多花的那一次往返由首屏的 stale-while-revalidate 吸收。

**「端点答了」和「有内容」是两件事。** 调用失败时同样没有计划节点，两者要求相反的读法：门只从真的
答复了的端点推导（[`CONTRACTS.md`](CONTRACTS.md) §2 的 ①）。`whoami` 拿到的账户名只算标题信息、不算
额度内容——把它算进去，一次「whoami 200、其余全挂」就会产出一张既无窗口又无余额的 `ok` 空卡，还会按
「最近已知」落盘，把之后的恢复盖住。

**订阅状态词不可靠，所以门主要按日期判。** provider 自己文档化的取消流程在周期结束前保留访问权，
`canceled` 这种词仍可能意味着「生效至 `periodEnd`」；于是只有 `active` / `trialing` 两个无歧义的词直接
算订阅，其余看 `periodEnd` 是否还在未来。provider 将来加新词，也只是降级到日期规则，不会把还在周期内
的订阅判成按量付费。

**重置时间戳的启发式有一条上限。** 上游可能报「距重置的秒数」、毫秒时间戳或 ISO 串；「小数字是倒计时」
不设上界时，一个秒级的 2025 年 epoch（`1760000000`）会被当成「距重置 17.6 亿秒」外推到 2081 年，
`periodEnd` 落在未来，于是**已经过期的订阅被报成生效中**。所以倒计时只在一年以内的量级上才认。

### 3.2 打开额度 tab 就有数：两层缓存 + 逐卡拉

账户级用量只有一个正确来源：provider 自己的账户 API。订阅 key 在工具与设备之间共享，本机账本看不到
同一把 key 在别处的花费，所以这个 tab **从不本地估算**——估出来的可用量只会比真实的大，而且没有校准
的办法。

一次拉取是数秒的网络往返，而返回的数字按分钟到小时变化，所以卡走 stale-while-revalidate：进程内
TTL 30 秒的内存卡 → 数据目录里最近一张 `ok` 快照（跨重启存活，打开即渲染）→ 两处都没有才打 provider。
「刷新」走 `force`，直接轮询并重写快照；client 收到一张数据已过一分钟的卡会自己跟进一次 `force`，
并带冷却——快速切 tab 不该把 provider API 打爆。

清单路由**一个 provider 请求都不打**，连 footer 的告急点也只从 durable 快照推出来：那枚徽章是「上次
看时某个窗口快满了」的廉价信号，不是实时告警。卡本身也逐张拉（`?provider=`），一个慢或失败的
provider 不该让其余卡一起等。缓存只为内置 provider 建：`provider` 是调用方给的任意字符串，非内置的
集合没有上界，而那个 Map 从不清理。

## 附二：社区/生态参考（GitHub，检索实测）

- **侧边栏原生 slot 权威指南**（路线 A）：[oil-oil/build-deepseek-harness-plugin · client-slots-and-theme.md](https://github.com/oil-oil/build-deepseek-harness-plugin/blob/main/references/client-slots-and-theme.md?plain=1)
- **插件模板**（14 个 UI surface，含 `sidebar.footer.action` + `shell.overlay`）：[kun2-5code/dsh-plugin-template](https://github.com/kun2-5code/dsh-plugin-template)
- **侧边栏生态注册表服务**（路线 B）：[omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) · [external-plugin-guide.md](https://raw.githubusercontent.com/omdsh-dev/DSH-better-sidebar/main/docs/external-plugin-guide.md)
- **官方 client 模块**：`docs/subsystems/client-modules.zh.md`
