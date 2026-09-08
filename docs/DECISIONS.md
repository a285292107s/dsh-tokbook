# 决策记录(ADR 日志)— dsh-tokbook

> **Doc meta** · role: decisions · language: zh-CN · status: current · last-reviewed: 2026-09-08 · supersedes: —

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

---

## 如何追加条目

1. 给下一个 `D-NNN`,今天的日期(或 commit 日期),以及状态。
2. 一段话:背景、决策、取代了什么。指向代码(`docs/CONTRACTS.md`)与更深理由(DESIGN
   的一节),而不是重复它们。
3. 若新决策取代旧条目,把旧条目状态改为 `superseded` 并链接过来——与代码同一 commit。
