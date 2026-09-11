# 迭代维护工作流 — dsh-tokbook

> **Doc meta** · role: process · language: zh-CN · status: current · last-reviewed: 2026-09-10 · supersedes: —

> **用法**:接到任何功能迭代 / 修复任务时,按本文件走一遍。目标:功能不断演进时,文档与
> 代码在**同一 commit** 保持同步,契约不漂移,文档永不明目张胆滞后于代码。它与
> [`AGENTS.md`](../AGENTS.md) 的常设偏好互补——那里管「怎么与维护者协作」,这里管
> 「每次改代码,哪些文档必须一起动」。本文档是常驻规则,不因某次功能落地而归档。

## 1. 澄清与定位(开工前)

1. 澄清意图(范围、取舍、「完成」的样子)——AGENTS.md 常设偏好 1:不猜测。
2. 定位:读 [`INDEX.md`](INDEX.md) 里你要触及领域的行,**只读那一份**叶子,不整树通读。
   - 改契约性代码(路由 / wire / 配置 / 事件 / 数据文件)前:先读
     [`CONTRACTS.md`](CONTRACTS.md);
   - 改账本 / 去重 / 折叠路径前:先读 [`HMR.md`](HMR.md);
   - 改 `src/pricing.ts` / `stats.ts` / 价格相关 wire 前:先读
     [`DECISIONS.md`](DECISIONS.md) **D-011**(当前手工价表形态)与
     [`CONTRACTS.md`](CONTRACTS.md) 的价格/计价段;不要沿用已被 D-011 取代的
     云端镜像/通道覆盖层决策。

## 2. 大功能先落 PLAN,小改动直接做

- 跨多 commit、或需要维护者分阶段审的实现:先建一份 `role: process` 的 PLAN
  (命名如 `PLAN.<topic>.md`),把实施注记与阶段写清,再开工。**全量落地后**:标
  `superseded` 移入 `docs/archive/`(见 §5)。
- 单 commit 改动:不需要 PLAN,直接实现——不建投机性文档。

## 3. 改代码的同时,按触及面更新文档(同一 commit)

| 触及面 | 必须同步 | 强制方式 |
|---|---|---|
| host 路由(`/tokbook/*`) | `CONTRACTS.md` · Host 路由表 | `selfcheck-docs` 机器双向校验 |
| wire JSON 形状、配置键、消费的会话事件、数据目录文件布局 | `CONTRACTS.md` 相应节 | 人工(`selfcheck-docs` 只查路由 token) |
| 持久架构决策(含取代旧决策) | `DECISIONS.md` 追加 `D-NNN`,旧条目标 `superseded` | 人工 |
| 功能面(范围 / 布局 / 配置示例 / 状态) | `README.md` | 人工 |
| 机制坑 / 教训 / HMR 边界 | `LESSONS.md` / `HMR.md` | 人工 |
| 被编辑过的任何文档 | 刷新 `last-reviewed` 日期 | 人工(selfcheck 只查格式) |
| 纯 client 样式、纯内部重构(不碰上述面) | 无契约文档要动;核对 README 布局注释里的文件名;刷新 `last-reviewed` | 人工 |

原则:**同一 commit**。宁可某份文档的更新小而准,也不要「实现完再回头补文档」——补
文档的 commit 是漂移最容易漏网的地方。

## 4. 门禁

提交前跑 `pnpm selfcheck`(含 docs 自检):路由双向比对、INDEX 链接可达、全部受管文档带
合法 Doc meta。红 = 当场修文档再重跑,绿才提交。

## 5. 状态生命周期回顾

- `current` = 描述现状;`superseded` = 已被替换(移入 `docs/archive/` 或原位标注并链接
  取代者);`draft` = 未完成。
- **已落地**的计划 / 过程文档 → `superseded` + 移入 `docs/archive/`。没有文档可以默默
  滞后于代码:若某份文档无法保持真实,删除或归档它,而不是让它日后毒化上下文。

## 6. 何时新建文档,何时只改现有

判据:**只有出现新的问题类别**(agent 会问的一类新问题、现有叶子都装不下)才新建叶子,
并在 `INDEX.md` 加一行,写清 role / status / 何时读。其余一律改现有文档。

`INDEX.md` 是地图不是日志:单次任务细节、一次性讨论结论不进树。

## 参考

- 地图与 role/status 语义:`INDEX.md`;契约:`CONTRACTS.md`;决策日志:`DECISIONS.md`;
  设计推理:`DESIGN.md`(顶部阅读指南区分历史与现状);教训:`LESSONS.md` / `HMR.md`。
