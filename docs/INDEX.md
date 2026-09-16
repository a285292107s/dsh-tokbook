# 文档索引 — dsh-tokbook

> **Doc meta** · role: index · language: zh-CN · status: current · last-reviewed: 2026-09-14 · supersedes: —

本仓库所有文档文件的地图。动手前先读你要触及领域的条目,然后**只读那一份**。本文件
的存在是为了让 [`AGENTS.md`](../AGENTS.md) 与你的第一跳保持精简:根文件只放面包屑,
本文件放整棵树,叶子才放细节。

## 文档树

| 文件 | 角色 | 状态 | 何时读 |
|---|---|---|---|
| [`AGENTS.md`](../AGENTS.md) | identity(身份) | current | 每个任务——自动载入上下文 |
| [`README.md`](../README.md) | entry(入口)+ operations(操作) | current | 第一站:范围、布局、构建、安装、配置 |
| `docs/INDEX.md` | index(地图,本文件) | current | 在文档间导航 |
| [`docs/CONTRACTS.md`](CONTRACTS.md) | contracts(契约) | current | 改动 host 路由、wire JSON 形状、配置键、会话事件或数据目录文件时——在同一 commit 更新它;`scripts/selfcheck-docs.ts` 会强制路由表同步 |
| [`docs/DECISIONS.md`](DECISIONS.md) | decisions(决策,ADR 日志) | current | 改架构、价格/计价、额度或界面结构,或落下任何持久决策时——**先读顶部索引表**,再定点读 1–3 条,不要整份通读;在同一 commit 追加条目 |
| [`docs/DESIGN.md`](DESIGN.md) | reason(推理 / 背景) | current | "为什么":DSH 机制背景、一期框架、二期重构说明、硬约束。顶部「阅读指南」区分历史与现状 |
| [`docs/HMR.md`](HMR.md) | lessons(教训)/ reference(参考) | current | HMR 机制与模块级重载的去重边界——改账本 / 去重路径前先读 |
| [`docs/LESSONS.md`](LESSONS.md) | lessons(教训) | current | 改 client 样式、client bundle、构建或浏览器验证时对照的踩坑记录 |
| [`docs/UI-SPEC.md`](UI-SPEC.md) | reference(参考,界面规范) | current | 改 `src/client/**` 的呈现层前对照的**禁令与达标线**——颜色预算与实测对比度、窄屏契约、无障碍底线、反模式、自检命令与审计历史;**取值**在 DESIGN-SYSTEM,"为什么"仍去 DESIGN §4 |
| [`docs/DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) | reference(参考,设计系统) | current | 改呈现层前查**取值**——三层 token 架构与命名、token 总表、组件规格与状态矩阵、字号/间距/控件/动效量表、无障碍语义契约;"不许怎么做"去 UI-SPEC |
| [`docs/WORKFLOW.md`](WORKFLOW.md) | process(流程) | current | L2/L3(契约面 / 跨 commit / 维护者要求 worktree)对照的「代码 + 文档同 commit」循环;新建文档前先看判据 |
| [`docs/archive/code-review.md`](archive/code-review.md) | process(流程,归档) | superseded | 追溯 D-011 落地前那轮全面审查的结论与修复时;**不描述此后重构后的文件布局** |
| [`docs/archive/PLAN.provider-pricing.md`](archive/PLAN.provider-pricing.md) | process(流程,归档) | superseded | 只想追溯当期实施计划与推理时读;**不描述现状**——现状看 README / CONTRACTS / DECISIONS |

## Doc meta 约定

每份受管文档在 H1 正下方带一行引用块:

```
> **Doc meta** · role: <identity|entry|index|contracts|decisions|reason|lessons|reference|process> · language: zh-CN · status: <current|superseded|draft> · last-reviewed: <YYYY-MM-DD> · supersedes: <文件 | —>
```

- `role` = 该文件属于文档体系的哪一层(见上表)。这一行**只写英文 token**(上表「角色」列
  括号里的中文只是给中文读者的注解,别写进 meta 行)。
- `status` = 描述的是现状(`current`)、已被替换的事物(`superseded`)、还是未完成
  (`draft`)。已落地的计划/过程文档应标 `superseded` 并移入 `docs/archive/`。
- `last-reviewed` = 上次把该文件与当前代码树核对一致的日期。**改了它的正文就顺手刷新**;
  没有文档面要动的小改动不要为一个日期去碰它。

`scripts/selfcheck-docs.ts`(属于 `pnpm selfcheck`)会在文档缺 meta 行、CONTRACTS
路由表与 `src/routes.ts` 漂移、或本文件里的链接指向不存在的文件时失败。

## 语言政策

**本仓库文档统一为中文**——唯一的真人读者是中文维护者,AI 读者语言无关,双语镜像只会
带来漂移成本。代码标识符、命令、路由名、JSON 字段等在文中保留英文原样。

若将来要公开发布,届时**再**补一份英文 `README.md` 作门面即可(单个文件、可推迟的
决定),内部文档无需英文版,也不维护常驻双语。

## 文档生命周期规则

改动接口的代码(路由、配置键、事件、数据文件名、定价规则)与 `docs/CONTRACTS.md` 的
更新**落在同一 commit**;持久架构决策追加进 `docs/DECISIONS.md`;已落地的计划归档为
`superseded`。没有文档可以默默滞后于代码:如果一份文档无法保持真实,就删除或归档它,
而不是让它日后毒化上下文。
