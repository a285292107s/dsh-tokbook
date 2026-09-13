---
feature: code-review
status: delivered
updated: 2026-09-11
branch: main
commits: # uncommitted working tree on main; range not applicable
---

# 全面代码审查（D-011 + 全仓库）

> **Doc meta** · role: process · language: zh-CN · status: superseded · last-reviewed: 2026-09-11 · supersedes: —

## Report

**What was built** — 对 main 工作树上未提交的 D-011 价格表破坏性重构做了 host / client / 全库三层审查。Host 计价、双桶、`pricingRevision`、三源求并与 CONTRACTS 对齐良好，无 critical。Client 侧发现 1 条 critical：自动保存成功路径用 await 后的 live draft 推进 baseline，PUT 在途键入会被标「已保存」且队列重写被跳过（静默丢字）。文档层发现 README 首段、D-003 status、CONTRACTS `owner.json` 字段三处 major 漂移。critical/major 与若干便宜 minor 已修复；独立 reviewer 对 10 项修复逐条核实，Verdict PASS。

**Verification** — `pnpm typecheck` PASS · `pnpm smoke` PASS · `pnpm selfcheck` PASS（修复后重跑；审查前基线亦全绿）。

**Journey log** —

1. 审查对象是**未提交工作树**而非 HEAD diff 切片——D-011 的正确性要按现状代码读，不能只看 diff 行。
2. Client 自动保存的竞态（compose 快照 vs live draft）是本轮唯一 critical；「draft 永不原地 mutate」是它正确的隐含前提。
3. 文档漂移比 host 逻辑缺陷更容易漏：selfcheck 只查路由表与 Doc meta，语义仍靠人审。
4. `pricing.json` 写路径改为 `.bak` rename 是有意与其它 JSON 的 unlink 策略分叉——手写文件更金贵。
5. 三路并行子代理 + 一轮独立 reviewer 对「报告并尽量修完」节奏合适；不凑数 finding 保持了信号。

## [S1] Problem

维护者在 main 工作树上留下了一整块未提交的 D-011 价格表破坏性重构（约 -6500/+2400 行，含未跟踪 `src/route-catalog.ts`），需要：

1. 深挖该未提交 diff：正确性、契约一致性、client/host 衔接、文档漂移；
2. 对整仓库已提交部分（账本/同步/额度/聚合）做一轮架构与一致性扫描；
3. 按 critical/major/minor 分级，尽量修完 critical 与 major。

不做：功能新增、风格性大重构、投机性防护。

## [S2] Design

审查以**当前工作树相对 HEAD 的全量现状**为对象（含未提交改动），分三层：

1. **D-011 host**：`pricing.ts` / `route-catalog.ts` / `types.ts` / `stats.ts` / `routes.ts` / `index.ts` / `by-provider.ts` 与 `docs/CONTRACTS.md`、`DECISIONS.md` D-011 的对齐。
2. **D-011 client**：`src/client/pricing/*`、`styles.ts`、`LedgerOverlay.tsx` 对 wire 的消费、自动保存链、与 host 路由的一致。
   （审查后 2026-09-11 起 client 再拆：`LedgerView`/`ProviderPanel`/`MethodDoc`/`format.ts`，样式在 `styles/*.ts`；本节按当时工作树路径记录。）
3. **整库一致性**：已提交模块（usage-log / sync / quota* / ledger）是否仍与重构后的契约、类型、文档一致；遗留死代码；明显边界缺陷。

分级标准（对齐维护者「单人维护 + 不做过度防御」）：

- **critical**：契约错误、数据损坏、计价/聚合错误、路由与文档漂移会导致误导用户、安全边界破口。
- **major**：行为与文档/决策不符、明显可复现缺陷、会静默丢数据或错误归类的逻辑。
- **minor**：命名/结构不一致、可维护性、冗余。

修复策略：critical/major 尽量本轮回修并回归验证；minor 列出不强制修。

验证基线：`pnpm typecheck` / `pnpm smoke` / `pnpm selfcheck`。

### 审查发现与修复

**已修（critical / major）**

| 级别 | 位置 | 问题 | 修复 |
|---|---|---|---|
| critical | `src/client/pricing/PricingPanel.tsx` `writeNow` | 成功路径用 await 后的 live draft 推进 baseline，PUT 在途键入被标「已保存」且 `againRef` 跳过重写 → 静默丢字 | compose 前冻结 `snapshot`；baseline 只跟 snapshot；unmount 成功也更新 `staged`/`baselineRef` |
| major | 同上 unmount 冲刷 | 成功后 `aliveRef=false` 早退，staged 仍脏 → 重复 PUT / 假 dirty | 成功路径与 `aliveRef` 解耦 |
| major | `draft.ts` `composePriceBody` | note 超长只在 rowIssue 拦，compose 仍 PUT，host 400 | compose 同样拒绝 |
| major | `editors.tsx` 加段/复制 | 默认 `from:''` 撞已有最早一段 | 改用 `newSegment()`（今日） |
| major | `README.md` 首段 | 仍写已删的规则链计价 | 改为价段+生效日期 |
| major | `docs/DECISIONS.md` D-003 | 云端合并计价仍标 current | 标 partially superseded by D-011 |
| major | `docs/CONTRACTS.md` | `owner.json` 写成 `{pid,start}`，代码是 `{pid,startedAt}` | 改文档 |

**顺带修复（原 minor）**：`pricing.json` 写路径 `.bak` 防崩溃窗口；PUT 超限 413；`pricingView` 补 `ensureFresh`；删死 `persist` 选项 / 死 import；若干过时注释。

**未修 minor（记录）**：client `DATE_RE` 不验真实日历日（host 仍闸）；`editors` 残留无 CSS 的 class/data 属性；加载失败清 error 后空态文案；preview 其它说明粒度；selfcheck 未测「pricingRevision 变 → rollup 重建」。

## [S3] Out of Scope

- 重建云端镜像（D-011 已明确后期独立任务）
- 大规模风格重写、补测试框架（仓库用 smoke/selfcheck）
- 提交 commit（除非维护者明确要求）

## Tasks

- [x] T1: 深审 D-011 host 侧 diff 与契约 — acceptance: 产出带 file:line 证据的 finding 列表 (covers: S2)
- [x] T2: 深审 D-011 client 侧 — acceptance: 同上 (covers: S2)
- [x] T3: 全仓库一致性扫描 — acceptance: 遗留/漂移/边界 finding 列表 (covers: S2)
- [x] T4: 汇总分级并修复 critical/major — acceptance: 每条修复可对应 finding；关键回归命令绿 (covers: S2)
- [x] T5: 重新验证 + 独立 reviewer 复核 — acceptance: typecheck/smoke/selfcheck 绿；reviewer 给出通过或剩余 critical (covers: S2)
