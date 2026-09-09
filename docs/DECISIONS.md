# 决策记录(ADR 日志)— dsh-tokbook

> **Doc meta** · role: decisions · language: zh-CN · status: current · last-reviewed: 2026-09-09 · supersedes: —

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

- 每条 **provider 计费模型调用记一行 JSONL**——`assistant/message` 行以 message id 为
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

**Status: current**(部分在工作区)。**Supersedes:** `docs/DESIGN.md` §1 与 §11 中第一期的
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
- 额度卡拉取各 provider 的**官方账户用量**(Command Code 的 CLI account 端点;OpenCode
  Go 的 `/zen/go/v1/usage`)——绝不本地估算;`quota-<provider>.json` 持久化最近已知
  `ok` 卡;`unconfigured`/`error` 卡即时重推、从不持久化。

落地:provider 用量 + 额度的 commit `5e2c86f`(2026-09-07);pricing 手工编辑 tab 截至
2026-09-08 在工作区。

### D-004 · 2026-09-08 · (provider, model) 双维计价 + 时间维度 + 双桶统计

**Status: current。Supersedes:** D-003 的"单 model 计价"部分(provider 用量/额度与手工
价格表本体仍在,承接其成本层语义)。

**背景。** 同一 model 串可能同时出现在官方 API 通道与订阅通道,计费性质与价格都不同;
前缀串(`deepseek/deepseek-v4-flash`)在基准价表查不到;厂商按记录时间调价。旧聚合身份
`(day, model, rate)` 会把两个 provider 的相同 (model, rate) 错并。

**决策。**

- 计价入口改为 `resolvePriced(provider, model, timeMs, context)`:
  该 record 的 provider 精确串在 provider 覆盖层命中(镜像 `provider-pricing.ccsa.json` +
  手工 `provider-pricing.json`,手工赢)→ `inheritBase` 走基准价表该 modelId 完整规则链,
  或 `segments` 按时间取段;否则回落基准价表 model 行;再没有 → unpriced(¥0)。
- 金额分双桶:`spend`(仅 `billing: 'metered'`,实际支出)与 `subscriptionValue`(仅
  `'subscription'`,订阅价值,非现金);`totalCost` 保留 = 两者之和,兼容旧 wire/旧 client。
- 聚合身份升级为 `(day, model, provider, rate)`;`byModel` 键改为 (provider, model);
  rollup 带 `schemaVersion: 2`,旧 v1 读作缺失 → 由日文件重建(不静默误并)。
- 价格表 tab 增加 provider 维度:查看 + 手工覆盖写回(PUT `/tokbook/provider-pricing`)。
- 镜像仓库(dsh-model-pricing)只负责云端两层数据;tokbook 只消费 + 本地覆盖,不做社区化维护。

落地:`PLAN.provider-pricing.md`(Phase 1–4)。完整推理见该计划与 `docs/DESIGN.md`。

---

### D-005 · 2026-09-09 · 手工价带时间维度;价格表 tab 显示"当前生效价"

**Status: current。Supersedes:** D-004 中"价格表 tab 只维护 flat 手工价"的 UI 部分
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
- Provider 覆盖层:`segments` 支持**多段**时间轴(UI 逐段编辑),`inheritBase` 行显示
  跟随后的实际价;新增「新增覆盖」表单,可为镜像里没有的 (provider, model) 建立覆盖。
- 保存按钮由**脏状态**(暂存草稿签名 vs 载入基线)驱动,而不是行数——删除最后一条手工
  覆盖是合法编辑(空表 = 清空手工层);脏草稿跨挂载存活(切 tab / 关浮窗不丢)。
- **入口按用户的问题组织**:默认视图是「在用」——账本记过的模型串平铺一张表(按用量降序),
  每行给当前生效价与来源,编辑时不会跳分组;「手工价 / 未定价 / 云端」是显式筛选。模型层
  没有条目但覆盖层定价的串,直接显示覆盖层解析出的价,动作是「到覆盖层编辑」(深链到那条
  覆盖)——给这类串写模型层条目永远不会被读取。保存被拒时滚动定位到错误条与出错行。
- 同一模型的 `timeRules` **不得重叠**(写路径拒绝、读路径按 `startTime` 排序):引擎取首个
  命中,重叠会让"看到的"与"生效的"不一致。未保存草稿在价格表 tab 上以小圆点提示,
  Ctrl/Cmd+S 在可见的那一面保存;窄屏(≤640px)价格表行改为堆叠布局,四档价各自带标签。

落地:`src/pricing.ts`、`src/types.ts`、`src/client/PricingPanel.tsx`、`src/client/store.ts`、
`scripts/smoke.ts`;契约见 `docs/CONTRACTS.md`,推理见 `docs/DESIGN.md` §3。

---

## 如何追加条目

1. 给下一个 `D-NNN`,今天的日期(或 commit 日期),以及状态。
2. 一段话:背景、决策、取代了什么。指向代码(`docs/CONTRACTS.md`)与更深理由(DESIGN
   的一节),而不是重复它们。
3. 若新决策取代旧条目,把旧条目状态改为 `superseded` 并链接过来——与代码同一 commit。
