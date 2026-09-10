# 决策记录(ADR 日志)— dsh-tokbook

> **Doc meta** · role: decisions · language: zh-CN · status: current · last-reviewed: 2026-09-10 · supersedes: —

持久架构决策,最新的在最后。每条记录:决策本身、迫使它成立的背景、以及它取代了什么。
像维护契约一样维护本日志:**落地的决策与代码在同一个 commit 追加条目**。完整推理见
`docs/DESIGN.md`;这里放指针 + 要点。

日期是决策落地的 commit / 开发日期(git 历史);只存在于工作区的条目标注「工作区」。

---

### D-001 · 2026-09-06 · 以外部双半区 Cordis 插件形态发布

**Status: current**

**背景。** dsh-tokbook 必须不改 DSH 仓库就扩展 `web` profile。DSH 的功能都是 Cordis
插件,可带 client 半区;外部包无法使用单仓 `clientBundle()` 预设,也无法贡献生成的
Typert Remote。

**决策。** 一个包,两个半区:

- host 半区(`src/*.ts`)——监听持久化 `session/event` 流,拥有全部数据;
- browser 半区(`src/client/*.tsx`)——纯 slot 注册:`sidebar.footer.action` 触发按钮 +
  `shell.overlay` 浮窗;
- host→browser 数据走 feature-owned 精确 Fetch 路由
  (`ctx.webServer.register({ kind: 'exact', ... })`);
- client bundle 复刻懒加载 CJS factory,**绝不**在 client 入口加 `default` 导出
  (cordis loader 的 `exports.default ?? exports` 会掩盖 `.inject`,报 "without inject" 坏掉)。

理由与 DSH 机制背景:`docs/DESIGN.md` §3–§8。

---

### D-002 · 2026-09-06/07 · 逐请求账本行,而非每会话聚合

**Status: current。Supersedes:** `docs/DESIGN.md` §5 第一期的"每会话聚合"框架(该文件
的「重构说明」一节记录了这次变更)。

**背景。** DSH 内置的每会话投影太粗:回答不了按天/按请求的问题,格式一变就得重建。
参考项目 `dsh-token-usage` 按请求建行。

**决策。**

- 每条 **通道计费模型调用记一行 JSONL**——`assistant/message` 行以 message id 为
  去重键,外加 `compaction/summary` 与失败尝试(`turn/end` error、`llm/retry`)记成
  `kind: failure`(只计数、不计费)。
- 按**本地日历日**持久化:`usage-YYYY-MM-DD.jsonl`,追加 + 串行队列 + 进程级
  `requestId` 去重。
- **每个数据目录一个写入进程**,用 `owner.json` 标记强制(单写者守卫——风险在
  rollup/cache/refile 竞争)。
- 首次启动回填 + 手动重扫 = 重放 `sessionPersistence` 快照(幂等、去重安全),跨重启用
  持久化的 `sync-progress.json` 基线做增量探测。

现状形状:`docs/CONTRACTS.md`。跨模块级 HMR 重载的确切去重边界:`docs/HMR.md` §4。

---

### D-003 · 2026-09-07/08 · 成本层 + 价格表;额度只从官方 API 取

**Status: partially superseded by D-011**(云端合并计价与规则链部分;**额度只从官方
API 取**仍 current)。**Supersedes:** `docs/DESIGN.md` §1 与 §11 中第一期的
"不做成本 / 成本属后续阶段"(「成本折算」风险行)。

**背景。** 账本要回答"这花了多少钱"——DSH 从不算钱;订阅额度 tab 要反映跨工具共享的
订阅价值——本地账本做不到。

**决策。**

- 计价 = ¥/M 每模型价目表,合并**云端镜像**(`pricing.ccsa.json`,启动时按
  `pricingRegion`/`pricingUrl` 同步)与手编 **`pricing.json`**(条目整体优先)。
- 每条记录按规则链 **时间规则 → 上下文档位 → 高峰时段**(上下文 ≈ input +
  cacheRead + cacheWrite)解析成 `RateKey`——只存身份、不存价格——所以改价在读取时
  重计价历史,无需重建账本/折叠。
- 价格表 tab 经 `GET/PUT /tokbook/pricing` 编辑手工层。
- 额度卡拉取各通道的**官方账户用量**(Command Code 的 CLI account 端点;OpenCode
  Go 的 `/zen/go/v1/usage`)——绝不本地估算;`quota-<provider>.json` 持久化最近已知
  `ok` 卡;`unconfigured`/`error` 卡即时重推、从不持久化。

落地:通道用量 + 额度的 commit `5e2c86f`(2026-09-07);pricing 手工编辑 tab 截至
2026-09-08 在工作区。

### D-004 · 2026-09-08 · （通道，模型） 双维计价 + 时间维度 + 双桶统计

**Status: superseded** by D-011(价格表整体重构:双维/覆盖层/云端全部作废;**双桶统计**
(`spend` / `subscriptionValue`)继续有效,只是计费性质改为路由级手工声明)。
**Supersedes:** D-003 的"单 model 计价"部分(通道用量/额度与手工
价格表本体仍在,承接其成本层语义)。

**背景。** 同一 model 串可能同时出现在官方 API 通道与订阅通道,计费性质与价格都不同;
前缀串(`deepseek/deepseek-v4-flash`)在基准价表查不到;厂商按记录时间调价。旧聚合身份
`(day, model, rate)` 会把两个通道的相同 (model, rate) 错并。

**决策。**

- 计价入口改为 `resolvePriced(provider, model, timeMs, context)`:
  该 record 的通道精确串在通道覆盖层命中(镜像 `provider-pricing.ccsa.json` +
  手工 `provider-pricing.json`,手工赢)→ `inheritBase` 走基准价表该 modelId 完整规则链,
  或 `segments` 按时间取段;否则回落基准价表 model 行;再没有 → unpriced(¥0)。
- 金额分双桶:`spend`(仅 `billing: 'metered'`,实际支出)与 `subscriptionValue`(仅
  `'subscription'`,订阅价值,非现金);`totalCost` 保留 = 两者之和,兼容旧 wire/旧 client。
- 聚合身份升级为 `(day, model, provider, rate)`;`byModel` 键改为 （通道，模型）;
  rollup 带 `schemaVersion: 2`,旧 v1 读作缺失 → 由日文件重建(不静默误并)。
- 价格表 tab 增加通道维度:查看 + 手工覆盖写回(PUT `/tokbook/provider-pricing`)。
- 镜像仓库(dsh-model-pricing)只负责云端两层数据;tokbook 只消费 + 本地覆盖,不做社区化维护。

落地:`PLAN.provider-pricing.md`(Phase 1–4)。完整推理见该计划与 `docs/DESIGN.md`。

---

### D-005 · 2026-09-09 · 手工价带时间维度;价格表 tab 显示"当前生效价"

**Status: superseded** by D-011(价格表不再有"手工层时间规则/峰谷"与层级概念;剩下的正是本条
想要的**生效日期**,只是简化为一条价段数组)。**Supersedes:** D-004 中"价格表 tab 只维护 flat 手工价"的 UI 部分
(双维计价与双桶语义不变)。

**背景。** 厂商会调价:期限内/永久降价(云 feed 里 `deepseek-v4-pro` 的
"原价 → 第一次长期降价"、`glm-5.3-flash` 的"限时 5 折")与峰谷价(`deepseek-*` 的
"工作日高峰时段")。引擎一直支持 `timeRules` / `dailySlots`,但手工层只能写 flat 价,
价格表 tab 只显示云端的 `base`——于是带规则的模型在 UI 上显示的是**并不生效的价**
(如限时 5 折期间显示原价),而一次"自定义"保存就把整套调价史/峰谷静默抹平。

**决策。**

- `pricing.json` 条目允许两种形状:flat 价(旧格式)或规则集
  `{ base, timeRules?, dailySlots? }`。写回时无规则的条目仍序列化为 flat,保持文件可读、
  向后兼容。**整体替换语义不变**:手工条目替换该模型整套云规则。
- 手工层**不做上下文档位**(`contextTiers` 被忽略、UI 不编辑):需求只有调价史与峰谷,
  分档是云端 feed 的概念;云端带分档的模型在手工覆盖时会提示分档不再生效。
- 价格表 tab 的每行显示**当前生效价**(`PricingViewRow.now`,host 按读取时刻走
  「时间规则 → 峰谷」链算出),行可展开看完整时间轴;手工行可就地编辑调价时段与峰谷
  时段(含"该时段自己的峰谷"),保存前不生效、保存后全部历史按新价重算。
- 通道覆盖层:`segments` 支持**多段**时间轴(UI 逐段编辑),`inheritBase` 行显示
  跟随后的实际价;新增「新增覆盖」表单,可为镜像里没有的 （通道，模型） 建立覆盖。
- **同价通道(一跳路由别名)**:同一个套餐买多份时,每把 key 是独立路由(用量/额度必须
  分开),但价格与 `billing` 相同——复制 N 份条目会漂移,所以在 `provider-pricing.json` 的
  保留键 `$routes` 里声明一次 `{ "<路由>": "<被跟随路由>" }`。语义:**别名路由继承目标条目,
  自己的条目仍然优先**(显式条目 = 单独给这条路由调价的逃逸舱);只允许一跳,目标不能再是
  别名源(链/环在写路径拒绝),镜像 feed 不携带该键。实现上别名在读取合并时**物化**进表
  (`applyProviderAliases`),所以解析链仍是纯 （通道，模型）,UI 里继承行带 `via` 且只读。
  别名与条目共用同一次整表 PUT 与同一份脏状态。
- 保存按钮由**脏状态**(暂存草稿签名 vs 载入基线)驱动,而不是行数——删除最后一条手工
  覆盖是合法编辑(空表 = 清空手工层);脏草稿跨挂载存活(切 tab / 关浮窗不丢)。
- **入口按用户的问题组织**:默认视图是「在用」——账本记过的模型串平铺一张表(按用量降序),
  每行给当前生效价与来源,编辑时不会跳分组;「价格未知」「全部」是另外两档筛选(手工价/云端
  是「全部」里的分组,不再各占一个筛选)。模型层没有条目但覆盖层定价的串,直接显示覆盖层
  解析出的价,动作是「去覆盖层」(深链到那条覆盖)——给这类串写模型层条目永远不会被读取。
  保存被拒时滚动定位到错误条与出错行。
- **默认只读,改价是显式动作**:这个 tab 主要被用来"看",改价是低频事件——所以手工行平时是
  只读摘要(价格 + 来源 + 生效窗口),点「编辑」才把四档单价变成输入框并展开规则编辑器,
  同一时刻只有一行可写(与通道面一致);删价收进编辑态的「删除手工价」。同时把低频的
  「同价通道」「新增覆盖」收进列表下方的「高级」折叠。目的:首屏只剩「搜索 + 一张表」,
  而不是"报表与表单同屏"。术语也向用户语言收敛(跟随基准/自定时间轴/占位 → 跟随官方价/
  自己填价/先按官方价),「跟随官方价」的模型 id 改为带候选列表的输入(可手填,但不必凭记忆)。
- 同一模型的 `timeRules` **不得重叠**(写路径拒绝、读路径按 `startTime` 排序):引擎取首个
  命中,重叠会让"看到的"与"生效的"不一致。未保存草稿在价格表 tab 上以小圆点提示,**并且
  逐行标出**:改过的行标「未保存」、被删掉的手工价标「待删除」——脏状态由逐行签名与基线
  比对得出(行序变化不算改动,暂存删除也不会因为行消失而不可见);Ctrl/Cmd+S 在可见的那
  一面保存;窄屏(≤640px)价格表行改为堆叠布局,四档价各自带标签。

落地:`src/pricing.ts`、`src/types.ts`、`src/client/PricingPanel.tsx`、`src/client/store.ts`、
`scripts/smoke.ts`;契约见 `docs/CONTRACTS.md`,推理见 `docs/DESIGN.md` §3。

---

### D-006 · 2026-09-09 · 价格表云端参考表按厂商分组;通道维度留在覆盖层

**Status: superseded** by D-011(云端参考表与厂商分组随云端一并删除)。
**Supersedes:** D-005 中「全部」视图里云端基准价表平铺展示的 UI 部分
（双维计价、双桶统计与编辑语义都不变）。

**背景。** 「全部」里的云端基准价表是 185 行平铺的模型串（真实数据），是这个 tab 最不可扫的
一屏——用户要"理解"的不只是价格，还有"这是谁家的模型"。而 feed 的每个模型本来就带
`family`（厂商：gpt 38 / claude 17 / qwen 17 / deepseek 9 / glm 9 / …），
`coerceCloudPricing` 之前把它丢掉了。

**决策。**

- 云端 feed 的 `family` 透传到 `PricingViewRow.family`（别名行带其所属模型的 `family`；
  feed 没命名的串没有该字段）。**只作展示元数据，不参与计价链**。
- 「全部」的云端参考表按 `family` 折叠分组：模型数降序、未标注厂商的串最后，组默认折叠，
  搜索自动展开命中的组。分组只是折叠一层，不改变任何行的定价与编辑动作。（未标注桶刻意叫
  「未标注厂商」而不是「其他」——`other` 是 feed 里一个真实的 `family` 值。）
- 两个角色轴（模型厂商 / 通道）**不混进同一棵树**：厂商（`family`）用于云端参考表的浏览分组；通道
  路由的展示与编辑归属留在既有的 **通道覆盖层**与通道用量 tab。原因：
  模型层价格是**全局**的（`pricing.json` 是 `Record<model, 规则集>`），同一个串可能被多条
  路由计费（本机：`deepseek-v4-flash` 在 deepseek-official 与 opencode-go、`glm-5.3-flash`
  在 opencode-go 与 zai），按路由分组会让同一行在多组里重复出现、而编辑只影响那份全局价。
- 「在用」列表按通道路由分组是**紧随其后的第二步**（已与维护者确认：共享串只在主通道
  可编辑，其余通道只读并标「全局价」）。它需要先把 `pricingView()` 的 `UsedModelHint`
  键从模型串改成 `(provider, model)`，所以与本次展示分组分开落地。

落地：`src/pricing.ts`、`src/types.ts`、`src/client/PricingPanel.tsx`、`src/client/styles.ts`、
`scripts/smoke.ts`；契约见 [`docs/CONTRACTS.md`](CONTRACTS.md)，推理见 `docs/DESIGN.md` §3。

---

### D-007 · 2026-09-09 · 在用视图按通道分组;全局价只在一条"主通道"行可编辑

**Status: superseded** by D-011(「在用 / 全局价」的层级区分消失:一个 (路由, 模型) 一份价)。
**Supersedes:** D-006 中「在用按通道分组是紧随其后的第二步」的过渡安排
（云端参考表按厂商分组不变）。

**背景。** D-006 把「全部」的云端参考表按厂商折叠了,但默认视图「在用」仍是模型串平铺——
同一条串被多条通道计费时（本机：`deepseek-v4-flash` 在 deepseek-official 与 opencode-go、
`glm-5.3-flash` 在 opencode-go 与 zai），行里看不出"哪条通道花的钱",通道信息在
`used`（按模型串键控）里被结构性丢掉。

**决策。**

- host 新增 **`channelRows`**（每条账本计费过的 （通道，模型）：记录数、通道计费性质、
  该通道自己的解析价 `now`、是否 `overlay` 定价 / `unpriced`）与 **`providerLabels`**
  （镜像 feed 的 `providers[].label`）。两者都是**增量** wire 字段;旧 host 不发时客户端
  退回平铺模型列表。
- 「在用」按通道路由分组：组头 = 标签 + 路由键 + 计费性质 + 模型数/条数;通道按用量
  降序,组内模型按用量降序。**组不可折叠**——它是主内容,不是参考表。
- **模型层价是全局的**（`pricing.json` 一条串一份）,所以一条被多条通道计费的串**只有一行
  可编辑**。主通道 = 优先 `metered`（实际支出,价格在这里是真金白银）,其次记录数最多,
  再其次路由键序;其余通道行只读、标「全局价」,动作「改全局价」跳到主通道那行（滚动 + 闪一下）。
  这是维护者选定的语义（"只在主通道可编辑,其他通道只读并标「全局价」"）。
- 通道行不再重复路由名（组头已经说了）,把宽度留给模型名;被截断的长串以 title 给出全名。

落地：`src/types.ts`、`src/index.ts`、`src/pricing.ts`（`coerceProviderLabels`）、
`src/client/PricingPanel.tsx`、`src/client/styles.ts`、`scripts/smoke.ts`、
`scripts/preview-overlay.mjs`;契约见 [`docs/CONTRACTS.md`](CONTRACTS.md),推理见
`docs/DESIGN.md` §3。

---

### D-008 · 2026-09-10 · 通道形态显式化;包装路由改由镜像别名承载,不单独定价

**Status: superseded** by D-011(形态维度与镜像承载的包装路由别名随云端一起删除;通道用量
卡片的名字改由设置里的 `displayName` 提供)。

**背景。** 维护者问:价格表 tab 的两个子视图(模型价 / 通道覆盖层)是否应按通道的四种形态
(官方通道 / 中转转售商 / 订阅套餐 / 包装路由)重新拆分?从第一性原理看**不该**:两个视图
切的是**计价层**(模型串的全局基准价 vs (通道,模型) 覆盖层),对应两个文件、两个写回路由、
两种条目形状,正是 `resolvePriced` 的两级;而四种形态是**通道覆盖层这一层内部**的分类,且
按形态拆会把它整成跨层——同一个模型串常被多种形态的通道同时计费(本机:`deepseek-v4-flash`
同时在 deepseek-official、opencode-go、modlens-commandcode),那行全局价无家可归。而「在用 /
价格未知 / 手工价 / 云端参考表」这些范围也落不进任何单一形态。真问题在别处:

1. 形态在覆盖层里**不可扫**:组头只印裸路由键,连镜像 `label` 都没显示;`modlens-commandcode`
   与 `commandcode` 都只显示「订阅价值」,二元芯片区分不出包装;
2. **形态推不出来**:`dots-ai` 是官方通道(小红书自家接口)却用 `segments`,`staryears` 是
   中转却用 `inheritBase`+`placeholder` —— 从 `(billing, 取价方式)` 反推会把 `dots-ai`
   误标成中转;
3. **包装路由被当成一等可编辑通道**:`modlens-commandcode` 有自己的组、行上有「设为覆盖」,
   能改 `billing`、能填 `segments`,正面违反「绝不单独定价」;而镜像侧靠**复制上游条目**
   表达包装(镜像 README/AGENTS 早已预留:「条目多到复制不划算时再考虑加别名字段(需消费方
   配合)」),`modlens-commandcode` 41 条要抄、新插件 mint 一个孪生就得再抄一遍。

**决策(经维护者逐项确认)。**

- **顶层两个子视图不拆**,保持按计价层切分。形态降级为**通道覆盖层内部的展示与筛选维度**:
  组头 = 镜像 `label` + 路由键 + **形态芯片**,组**按形态排序**(官方 → 中转 → 订阅 → 包装),
  列表上方一行**形态筛选 chips**(带组数)。模型价视图不动(它的「在用」已按通道分组 + 计费
  芯片表达了金额性质)。
- **形态是镜像声明的显式事实**:镜像 feed 新增 `providers[].form`
  (`official` / `relay` / `subscription` / `wrapper`),与 `billing` 由镜像 build 强制一致;
  消费方**只透传显示**,绝不从 `billing`/取价方式猜(见背景 2)。读路径对未知/缺失的 `form`
  宽容(忽略该值),因为形态写错不会算错金额——与 `billing` 非法即丢组的处理刻意不同。
- **包装路由 = 镜像层一跳别名**:镜像 feed 新增 `providers[].aliasOf`(仅 `form: wrapper`),
  包装组**不写 `billing`、不写 `entries`**;消费方把它与手工层「同价通道」`$routes` 合进同一张
  一跳别名表后物化(手工层对同名路由优先)。于是包装路由的价格与计费性质完全来自被包装通道,
  新插件 mint 孪生只需在镜像加一行;覆盖层里包装组的行全部是 `via` 行(只读,动作「去编辑」
  指向目标)。`providerRoutes` 仍只回手工层那半边(客户端拥有并写回它),镜像别名以
  `providerForms` + `via` 行表达。
- 跨仓库落地:**dsh-model-pricing**(镜像 `providers.source.json` 加 `form`/`aliasOf`、
  schema、build 校验、README/AGENTS,`version` 5 → 6)与**本仓库**(`src/pricing.ts` 的
  `coerceProviderFeed` / `mergeProviderAliases`、`src/types.ts` 的 `ChannelForm` 与
  `providerForms`、`src/routes.ts`、`PricingPanel.tsx`、`styles.ts`)同批改动。

**取代/影响。** 不取代 D-006/D-007(它们关于模型价/在用视图的分组,语义不变);镜像
README「包装路由靠复制上游条目表达」一段及其 AGENTS 判据被本次改动取代(镜像侧同 commit
更新)。契约见 [`docs/CONTRACTS.md`](CONTRACTS.md),落地清单见那次 commit。

---

### D-009 · 2026-09-10 · 价格表 tab 收敛为单表:层级降为行属性,参考价表独立,两层共享一条保存条

**Status: superseded** by D-011(层级概念、参考价表、共享保存条的对象都随重构改变;保住的是
「一屏看清、一次保存」这条体验)。**Supersedes:** D-008 第 1 条里「顶层两个子视图不拆,保持按计价层切分」的
**视图切分本身**(形态维度与包装路由别名那两条决策继续有效);继承 D-006/D-007 的
「(通道, 模型) 分组 + 全局价单一编辑入口」。

**背景。** 维护者提出重构价格表 tab 的「编排与展示」。现状两个平级子视图(模型价 / 通道覆盖层)
加三个范围 chip(在用 / 价格未知 / 全部),摩擦是结构性的:① 分层的轴 ≠ 找价的轴——账本里唯一
真实的事实是 (通道, 模型串, 时间) 的解析价,「价写在哪一层」只是它的元数据,却成了必须先选对的
地方;② 同一个列表在不同范围下组头语义漂移(在用=通道,全部=层→厂商,覆盖层=路由→形态);
③ 云端基准表(~185 行、多数从未使用、只读)与「我的价格」同权,还拖着一整套折叠与吸顶列头;
④ 「在用」chip 的计数(模型数)与渲染行数(通道行数)对不上;⑤ 编辑保真度 = 镜像 schema 保真度,
高频的「四档价」与深水的「调价史/峰谷/多段自定价」平铺在同一屏;⑥ 两个 pane 各自 dirty、
各自保存,而 tab 只有一个小圆点。

**决策(经维护者逐项确认)。**

- **一张表、一条轴**:主列表每行 = 一条通道路由 + 一个精确模型串(账本真正计费的东西),按通道
  分组(记录数降序 → 形态 → 路由键),组头 = 镜像标签 + 路由键 + 形态芯片 + 计费芯片 + 计数;
  没有账本记录但有价的路由收进末尾的**未计费**组。
- **层级降为行属性**:行头一枚**来源徽章**(手工价 / 手工覆盖 / 跟随官方价 / 自己填价 /
  先按官方价 / 云端 · 分时 / 云端 / 价格未知),行内编辑器第一项是**层级选择**
  (全局 · 模型层 / 这条通道 · 覆盖层):切到覆盖层就地建一条覆盖,切回模型层则删掉它、价回落
  ——**不**顺手新增全局价(新增要显式点「新增全局手工价」)。D-007 的「全局价只有一个可编辑
  入口(主通道,`metered` 优先 → 记录数 → 路由键)」保留,其余通道行只读并标「全局价」。
- **参考价表独立**:镜像字典(账本未计费的云端行)移出主列表,由工具栏一个次级按钮进入、按
  `family` 折叠浏览,行上「设为手工价」把它复制成本机的一条全局价;被账本用到的云端行留在主表
  带「云端」徽章,两边不重复。
- **两层共享一条保存条**:底部一次保存、写明范围(如 `保存 · 模型层 2 条 · 覆盖层 1 条`),先
  `PUT /tokbook/provider-pricing`、后 `PUT /tokbook/pricing` 顺序写回——中间态永远不会让某条
  (通道, 模型) 短暂掉成价格未知;失败时报出**哪一层没写成**,并按实际写成的结果刷新(未写成的
  那一层保留暂存)。逐行「未保存 / 待删除」与 tab 圆点语义不变,但从此与唯一的保存范围一致。
- **常用在前,深水区收进行内「高级」**:四档价与计费方式常驻;`timeRules` / `dailySlots` /
  多段 `segments` 与新增表单(新增手工价 / 新增覆盖 / 同价通道)全部折叠。
- **client 代码随之拆分**:`src/client/PricingPanel.tsx`(2770 行)→ `src/client/pricing/draft.ts`
  (纯逻辑:草稿 ↔ wire、校验、行模型/分组/参考行)+ `editors.tsx`(行原语、时间轴、行内编辑器、
  新增表单)+ `PricingPanel.tsx`(外壳)。**host 与 wire 契约零改动**。

**取代/影响。** D-006/D-007 的分组与「全局价」语义被继承并扩展到单表;D-008 的形态芯片、排序、
筛选与 `aliasOf` 一跳别名照旧(形态现在是单表里的组芯片与筛选维度)。D-006/D-007/D-008 里写的
客户端落地路径 `src/client/PricingPanel.tsx` 已迁到 `src/client/pricing/` 下,那三条作为历史
落地记录保留原文、不再逐一回改。预览台 `scripts/preview-overlay.mjs` 同步支持两层 PUT 的
fixture 合并(写入在预览里内存生效),便于在浏览器里核对整条编辑—保存链。

---

### D-010 · 2026-09-10 · 手工层可自己声明通道名称与形态(`$providers`),补上镜像没命名的通道

**Status: superseded**(价格表的形态/云端部分) by D-011。(其在用视图与手工声明通道名称的
诉求仍在,只是改由设置里的 `displayName` 提供。)

**背景。** 维护者问:导入了一个云端镜像没有数据的通道方,怎么给它打「中转转售」这类标签?
现状是**没有任何入口**:`providerLabels` / `providerForms` 只来自镜像 feed
(`readProviderPricingView` 直接取 `synced.labels/forms`),手工层 schema 只有
`provider → model → 条目` + `$routes`,而写路径会把任何非 `$routes` 的顶层键当 provider 处理
(自造 `$providers` 会报「必须给出 inheritBase 或 segments」)。于是私有中转、新订阅这类
**不该/没法进公共镜像**的通道,在 tab 里只能显示裸路由键、没有形态芯片,也不进形态筛选。

**决策(经维护者确认)。**

- 手工层新增保留顶层键 **`$providers`**:`{ "<路由>": { "label"?, "form"? } }`,与 `$routes`
  同文件、同一次 `PUT /tokbook/provider-pricing`——**不新增文件、不新增路由、wire 形状不变**
  (`providerLabels` / `providerForms` 仍是那两个字段,只是读取时把手工声明并进去)。
- 合并语义:**手工赢镜像**(与 `$routes` 对同名路由优先一致),删掉该路由即回落镜像、再没有
  就用裸路由键。既能补镜像没命名的通道,也能把「StarYears 中转」改成自己的叫法。
- **`form` 不收 `wrapper`**:包装路由是镜像为另一条路由 mint 的孪生,手工层表达"跟随"已经有
  `$routes`;收下这个词只会画一枚没有机制的芯片。写路径拒绝,读路径忽略该值。
- **纯展示**:只参与分组、排序、筛选,不进计价链;写路径严格(label 非空 ≤64 字、form 三选一、
  两项都空拒绝),读路径宽容(畸形值丢弃,绝不致命)——与 `form` 的一贯处理一致。
- **UI 两处入口,同一个编辑器**:① 组头——镜像没给名字或没给形态的路由(以及已手工声明的
  路由)显示「＋ 名称/形态」;② **未计费**组的行——那条路由没有组头,路由键芯片本身就是入口。
  镜像已把两者都给全的路由不给入口(这不是给它们改名的功能)。镜像声明之后才出现的路由,
  下次同步若被命名,手工声明仍然优先(可清空回镜像)。

**取代/影响。** D-008 的「形态必须由镜像声明、消费方绝不从 `billing`/取价方式猜」不变——本
决策不给**推断**开口子,只给**用户声明**开口子。契约见 [`docs/CONTRACTS.md`](CONTRACTS.md)
的 `$providers` 段与界面词表;`providerMeta` 作为增量 wire 字段与新 `$providers` 键同 commit
落地。

---

### D-011 · 2026-09-10 · 价格表破坏性重构:删掉云端,一张手工表,每路由一卡

**Status: current。Supersedes:** D-008 与 D-010 的镜像形态部分、以及全部
provider-overlay(通道覆盖层 / `$routes` / `$providers` / `inheritBase` / `segments` /
峰谷 / 上下文档位)相关决策。

**背景(维护者原话)。** 「破坏性重构价格表。首先是精简,先移除云端数据读取功能,后期作为一个
独立任务重构。现在以本地 `~/.dsh/settings.yaml` 为核心,编排价格表页面内容。每个路由键一张
卡片,显示当前可调用模型。定价完全由用户自行编写,主要填写 4 桶价格以及生效日期。」

**决策(经维护者逐项确认)。**

- **云端定价整体删除**,不留半吊子:不再拉取 / 解析 / 回落 `pricing.ccsa.json` 与
  `provider-pricing.ccsa.json`,删掉配置键 `pricingUrl` / `pricingProviderUrl` /
  `pricingRegion`、参考价表、`family` 厂商分组、镜像 label / form / `aliasOf`(包装路由)。
  后期任务的两个镜像地址(留档在此,便于重做时取回):
  `https://gitee.com/oyw125/model-price-table/raw/master/model_pricing.json`、
  `https://raw.githubusercontent.com/LaoYueHanNi/model-price-table/master/model_pricing.json`、
  `https://raw.githubusercontent.com/a285292107s/dsh-model-pricing/master/provider_pricing.json`。
- **唯一价格文件 `pricing.json`**:路由 → 精确模型串 → **价段数组**。价段 = 四档 ¥/M 单价
  (`inputPerMillion` / `outputPerMillion` / `cacheReadPerMillion` / `cacheWritePerMillion`)
  + **生效日期**(`YYYY-MM-DD`,省略 = 最早一段)。保留键只有一个 **`$billing`**:路由 →
  `metered` / `subscription`(省略 = metered)。写路径严格并整表替换,读路径宽容。
- **计价只看记录自己的时间戳**:取最后一段 `from ≤ 记录时刻` 的价;早于最早一段或没有价段 =
  **价格未知**(¥0)。回填更早的价即重算历史。
- **卡片 = 路由目录 ∪ 账本 ∪ 价格文件**。路由目录 = 本机设置文档(`llm-pi-ai.providers` 的键
  + `llm-deepseek` 的唯一路由 `deepseek-official`)∪ 正在运行的适配器注册表
  (`ctx.llm.listProviders()`,所以运行时铸出的路由也有卡);卡内模型 = 配置的 `models` 列表
  (profile 没列就回落到 `ctx.llm.listModels()`)**∪** 账本计费过的串(标「仅账本」),所以历史
  金额永远有可定价入口。**通道名称**取设置里的 `displayName`,其次适配器名,再其次路由键。
- **折叠与计价解耦**:费率行的身份是从价格表推导的,所以 `rollup.json` 记 `pricingRevision`
  (价格文件内容的签名),签名一变整份折叠作废重建;价格表 tab 的「账本 N 次」透镜只读记录缓存、
  **不写折叠**(它不按价折叠,写进去会把全库金额毒成 ¥0)。
- **旧数据一律不迁移**(维护者选择「全部丢弃、重填」):旧格式的 `pricing.json`、
  `provider-pricing.json`、两个 `.ccsa.json` 都不再被读取,也不由插件删除。

**影响与已知取舍。**

- 在填价之前,全部历史金额是 ¥0(口径仍是「价格未知」,不是免费)。
- 计费性质是**路由级**、且作用于全部历史:订阅路由必须手工标成 `subscription`,否则它的钱
  会记成实际支出;代价是「混合通道」(一卡内两种性质)不再可表达——旧镜像里只有条目级
  `billing` 才需要它。
- 形态(`official`/`relay`/`subscription`/`wrapper`)、厂商分组、参考价表、包装路由跟随
  (`aliasOf`)与同价通道(`$routes`)都消失;通道用量卡片的名来自配置。
- 契约见 [`docs/CONTRACTS.md`](CONTRACTS.md) 的「术语」「Host 路由」「数据目录」三段;
  数据形状见 `src/pricing.ts` 顶部模块注释。

---

## 如何追加条目

1. 给下一个 `D-NNN`,今天的日期(或 commit 日期),以及状态。
2. 一段话:背景、决策、取代了什么。指向代码(`docs/CONTRACTS.md`)与更深理由(DESIGN
   的一节),而不是重复它们。
3. 若新决策取代旧条目,把旧条目状态改为 `superseded` 并链接过来——与代码同一 commit。
