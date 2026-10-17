# dsh-tokbook —— 技术选型与插件框架设计（一期→二期演进）

> **Doc meta** · role: reason · language: zh-CN · status: current · last-reviewed: 2026-10-17 · supersedes: —

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

## 4. 总体架构

两个半区，一条单向数据流：**host 拥有全部数据**（持久事件流 → 折叠 → 账本落盘 → 精确 Fetch 路由），
**browser 只注册三个已声明的 slot 并读那条路由**（入口按钮 / 浮窗 / 会话词元页）；浮窗开关是入口组件的私有 React state。**为什么：**

- **数据只过 host**：账本要跨重启、要被别的消费者读，而 browser 半区只活在一个页面里；持久
  `session/event` 流也只有 host 看得到。
- **host→browser 用精确 Fetch 路由**而不是生成式 Remote：外置插件贡献不了 remote namespace（§2）。
- **控制面与数据面分开**：按钮只负责开窗、浮窗只负责读，两者都进**已声明**的槽，所以不动 DSH（§6）。

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

**操作步骤的真源是 [`../README.zh.md`](../README.zh.md)「安装」**——`dsh plugin add`、patch
里那一行，以及「普通插件 vs `dsh.bundle` 包」的取舍都在那里。client 改动怎么生效（`rev` 不可变缓存、
刷新 / 重启 + 硬刷新 / link 安装）见 [`HMR.md`](HMR.md)。

> 本节原有的一遍外置接入走查（与 README 重复）和一段 HMR 复述（与 HMR.md 重复）已于 2026-09-16
> 删除；要追溯读 git 历史。

## 10. 关键设计决策与硬约束汇总

1. **外置 vs in-repo**：运行时无差别；外置的**唯一硬阻点是 build**（无 preset，需自复刻 CJS factory）。
   何时该反悔：一旦需要大量复用 DSH 内部 UI 模块、或走生成式 Remote，in-repo 会明显省力。
2. **host→浏览器数据通路**：`ctx.webServer` 的精确 Fetch 路由，不用生成 Typert Remote；要实时可用 SSE。
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

## 附二：社区/生态参考（GitHub，检索实测）

- **侧边栏原生 slot 权威指南**（路线 A）：[oil-oil/build-deepseek-harness-plugin · client-slots-and-theme.md](https://github.com/oil-oil/build-deepseek-harness-plugin/blob/main/references/client-slots-and-theme.md?plain=1)
- **插件模板**（14 个 UI surface，含 `sidebar.footer.action` + `shell.overlay`）：[kun2-5code/dsh-plugin-template](https://github.com/kun2-5code/dsh-plugin-template)
- **侧边栏生态注册表服务**（路线 B）：[omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) · [external-plugin-guide.md](https://raw.githubusercontent.com/omdsh-dev/DSH-better-sidebar/main/docs/external-plugin-guide.md)
- **官方 client 模块**：`docs/subsystems/client-modules.zh.md`
