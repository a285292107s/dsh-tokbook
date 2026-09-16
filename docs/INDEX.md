# 文档索引 — dsh-tokbook

> **Doc meta** · role: index · language: zh-CN · status: current · last-reviewed: 2026-09-16 · supersedes: —

本仓库所有文档文件的地图。动手前先读你要触及领域的条目,然后**只读那一份**。本文件
的存在是为了让 [`AGENTS.md`](../AGENTS.md) 与你的第一跳保持精简:根文件只放面包屑,
本文件放整棵树,叶子才放细节。

## 文档树

| 文件 | 角色 | 状态 | 何时读 |
|---|---|---|---|
| [`AGENTS.md`](../AGENTS.md) | identity(身份) | current | 每个任务——自动载入上下文 |
| [`README.md`](../README.md) | entry(入口)+ operations(操作) | current | 第一站:范围、布局、构建、安装、配置 |
| `docs/INDEX.md` | index(地图,本文件) | current | 在文档间导航 |
| [`docs/CONTRACTS.md`](CONTRACTS.md) | contracts(契约) | current | **改 host 行为前读这一份**(约 83 行):术语与口径、**让数字保持诚实的不变量**、单写者与数据目录、不显然的默认值——只写**代码里读不出来、违反后不会报错但会把钱算错**的规则。路由 / wire 形状 / 配置键 / 数据文件清单都是代码(见它的指针表);路由路径**不得**在这份文档里复述 |
| [`docs/DECISIONS.md`](DECISIONS.md) | decisions(决策,ADR 日志) | current | 改架构、价格/计价、额度或界面结构,或落下任何持久决策时——**先读顶部索引表**,再定点读 1–3 条,不要整份通读;在同一 commit 追加条目 |
| [`docs/DESIGN.md`](DESIGN.md) | reason(推理 / 背景) | current | **只留从代码推不出来的抽象**(约 277 行):DSH 插件机制与 `dsh web` 的组合方式、**外置包契约与坑**(CJS factory / 禁 `default` 导出 / external 基线)、插槽语义与社区两条路线、**为什么是这个形状**(逐请求行 / 派生折叠可丢 / 本地日历日 / 单写者 / 精确 Fetch 路由)与每条的代价、界面取舍理由(§3.1)、参考坐标。逐文件、逐字段、路由路径、尺寸数字都不在这里。顶部「阅读指南」区分历史与现状——**§8 / §9 已删** |
| [`docs/HMR.md`](HMR.md) | lessons(教训)/ reference(参考) | current | HMR 机制与模块级重载的去重边界——改账本 / 去重路径前先读 |
| [`docs/LESSONS.md`](LESSONS.md) | lessons(教训) | current | 改 client 样式、client bundle、构建或浏览器验证时对照的踩坑记录 |
| [`docs/UI-SPEC.md`](UI-SPEC.md) | reference(参考,界面规范) | current | 改 `src/client/**` 的呈现层前**读这一份**(约 120 行):§1 不变量、§2 达标线(对比度 / 字号分带 / 直连宿主变量白名单 / 窄屏 / 无障碍)、§3 陷阱速查、§4 自检;**UI 大调整时只受 §1 约束**。**取值与逐 tab 规格不在文档里**——真源是 `src/client/styles/**`(用法写在 `tokens.ts` 的注释里),可判定的禁令见 §3 的自查清单。2026-09-16 起原 `DESIGN-SYSTEM.md` 的取值表、本文的审计历史与全部实测数字已删;**行数上限 200** 人工量 |
| [`docs/WORKFLOW.md`](WORKFLOW.md) | process(流程) | current | L2/L3(契约面 / 跨 commit / 维护者要求 worktree)对照的「代码 + 文档同 commit」循环;新建文档前先看判据 |

## Doc meta 约定

每份受管文档在 H1 正下方带一行引用块:

```
> **Doc meta** · role: <identity|entry|index|contracts|decisions|reason|lessons|reference|process> · language: zh-CN · status: <current|superseded|draft> · last-reviewed: <YYYY-MM-DD> · supersedes: <文件 | —>
```

- `role` = 该文件属于文档体系的哪一层(见上表)。这一行**只写英文 token**(上表「角色」列
  括号里的中文只是给中文读者的注解,别写进 meta 行)。
- `status` = 描述的是现状(`current`)、已被替换的事物(`superseded`)、还是未完成
  (`draft`)。**已落地的计划 / 过程文档直接删**——它的内容要么已经在代码里,要么已经在
`DECISIONS.md` 的取舍里,git 本身就是归档;只有确实还会被人反复查的才值得留一份。
- `last-reviewed` = 上次把该文件与当前代码树核对一致的日期。**改了它的正文就顺手刷新**;
  没有文档面要动的小改动不要为一个日期去碰它。**它是自制提示,不是新鲜度的权威**——一次真的
  核对过没过,只有 `git log -1 --format=%cs <文件>` 说得准。

## 语言政策

**本仓库文档统一为中文**——唯一的真人读者是中文维护者,AI 读者语言无关,双语镜像只会
带来漂移成本。代码标识符、命令、路由名、JSON 字段等在文中保留英文原样。

若将来要公开发布,届时**再**补一份英文 `README.md` 作门面即可(单个文件、可推迟的
决定),内部文档无需英文版,也不维护常驻双语。

## 文档生命周期规则

改接口的代码与 `docs/CONTRACTS.md` **同 commit**;持久决策追加进 `docs/DECISIONS.md`;已落地的
计划归档为 `superseded`。**细则与门禁在 [`WORKFLOW.md`](WORKFLOW.md) §3 / §5**——那里是真源,
本节不复述。唯一的原则:**没有文档可以默默滞后于代码**:一份文档无法保持真实,就删除或归档它,
而不是让它日后毒化上下文。
