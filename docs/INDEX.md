# 文档索引 — dsh-tokbook

> **Doc meta** · role: index · language: zh-CN · status: current · last-reviewed: 2026-10-17 · supersedes: —

本仓库所有文档文件的地图。动手前先读你要触及领域的条目,然后**只读那一份**。本文件
的存在是为了让 [`AGENTS.md`](../AGENTS.md) 与你的第一跳保持精简:根文件只放面包屑,
本文件放整棵树,叶子才放细节。

## 文档树

| 文件 | 角色 | 状态 | 何时读 |
|---|---|---|---|
| [`AGENTS.md`](../AGENTS.md) | identity(身份) | current | 每个任务——自动载入上下文 |
| [`README.md`](../README.md) | entry(入口) | current | 公开门面(**英文**):这是什么、装它、配置、四个 tab、已知缺口。给第一次来的访客看,不放开发细节 |
| [`README.zh.md`](../README.zh.md) | entry(入口)+ operations(操作) | current | 维护者的那一份(中文,`README.md` 的镜像):范围、安装、配置,外加 `src/` 布局树、构建与开发回路 |
| `docs/INDEX.md` | index(地图,本文件) | current | 在文档间导航 |
| [`docs/CONTRACTS.md`](CONTRACTS.md) | contracts(契约) | current | **改 host 行为前读这一份**:术语与口径、**让数字保持诚实的不变量**、单写者与数据目录、不显然的默认值——只写**代码里读不出来、违反后不会报错但会把钱算错**的规则。路由 / wire 形状 / 配置键 / 数据文件清单都是代码(见它的指针表);路由路径**不得**在这份文档里复述 |
| [`docs/DESIGN.md`](DESIGN.md) | reason(推理 / 背景) | current | 改架构、价格/计价、额度或界面结构前先读这一份。**只留从代码推不出来的抽象**:DSH 插件机制与 `dsh web` 的组合方式、**外置包契约与坑**(CJS factory / 禁 `default` 导出 / external 基线)、插槽语义与社区两条路线、**为什么是这个形状**(逐请求行 / 派生折叠可丢 / 本地日历日 / 单写者 / 精确 Fetch 路由)与每条的代价、额度门的外部证据(§3.1)、参考坐标。逐文件、逐字段、路由路径、尺寸数字都不在这里。顶部「阅读指南」区分历史与现状——**§9 已删,§8 只剩指针** |
| [`docs/HMR.md`](HMR.md) | lessons(教训)/ reference(参考) | current | HMR 机制与模块级重载的去重边界——改账本 / 去重路径前先读 |
| [`docs/LESSONS.md`](LESSONS.md) | lessons(教训) | current | 改 client 样式、client bundle、构建或浏览器验证时对照的踩坑记录 |
| [`docs/COMMENTS.md`](COMMENTS.md) | reference(参考,注释规范) | current | **写或改 `src/**` 的注释前读这一份**:一条尺子(代码里读不出来 + 改了必须同步改)、四不写(改动史 / 代码已说的 / 数值推导 / 规则的第二份副本)、形态(一句话优先、文件头只写前提、解释名字=改名信号)与落笔前三问。一次全库注释审核的产物 |
| [`docs/CONTEXT.md`](CONTEXT.md) | reference(参考,词汇表) | current | 用到本插件的词汇、或要新增术语时。**只收新词**——既有词(通道 / 用量未知 / 价格未知 …)一律指向 CONTRACTS,不在这里重复 |
| [`docs/adr/`](adr/) | reason(推理,决策记录) | current | 改**难逆转**的决定前(读路径 / 数据归属 / 归属口径)。ADR 只收「难逆转 + 没有上下文会令人惊讶 + 真权衡」三项同时成立的决策,其余理由进 DESIGN.md。**逐份看 `status`**:`0002` 是 `draft`(已定案但代码里还没有),别把它读成现状 |

## Doc meta 约定

每份受管文档在 H1 正下方带一行引用块:

```
> **Doc meta** · role: <identity|entry|index|contracts|reason|lessons|reference|process> · language: zh-CN · status: <current|superseded|draft> · last-reviewed: <YYYY-MM-DD> · supersedes: <文件 | —>
```

- `role` = 该文件属于文档体系的哪一层(见上表)。这一行**只写英文 token**(上表「角色」列
  括号里的中文只是给中文读者的注解,别写进 meta 行)。
- `status` = 描述的是现状(`current`)、已被替换的事物(`superseded`)、还是未完成
  (`draft`)。**已落地的计划 / 过程文档直接删**——它的内容要么已经在代码里,要么已经在
`DESIGN.md` 的推理里,git 本身就是归档;只有确实还会被人反复查的才值得留一份。
- `last-reviewed` = 上次把该文件与当前代码树核对一致的日期。**改了它的正文就顺手刷新**;
  没有文档面要动的小改动不要为一个日期去碰它。**它是自制提示,不是新鲜度的权威**——一次真的
  核对过没过,只有 `git log -1 --format=%cs <文件>` 说得准。

## 语言政策

**内部文档统一为中文**——唯一的真人读者是中文维护者,AI 读者语言无关,双语镜像只会
带来漂移成本。代码标识符、命令、路由名、JSON 字段等在文中保留英文原样。

**两个例外是两份 README**,它们按**读者**分工,而不是互为翻译:

| 文件 | 语言 | 读者 |
|---|---|---|
| [`README.md`](../README.md) | 英文 | 来 GitHub 仓库页的陌生人:安装、配置、它能报什么数 |
| [`README.zh.md`](../README.zh.md) | 中文 | 维护者本人:上面那些,外加布局树与开发回路 |

`README.md` 是**门面**,所以它**故意不含** `src/` 布局树;开发那一段也只给命令、不给内部机制
(预览台的形状开关、设备皮、重载边界都不在门面里)——那些只活在 `README.zh.md` 里,一处真源。
两边都改的只有「用户会照做的那部分」(安装命令、配置键、口径);门面说什么,`README.zh.md` 就得能对上。

两份文件的 meta 行里 `language` 分别写 `en` 与 `zh-CN`——这是 `role: entry` 的那对
唯一允许偏离中文的地方。

## 文档生命周期规则

改接口的代码与 `docs/CONTRACTS.md` **同 commit**;推理与取舍进 `docs/DESIGN.md`,只有满足 ADR 三项判据的决定才单开一份 `docs/adr/NNNN-*.md`。唯一的原则:
**没有文档可以默默滞后于代码**:一份文档无法保持真实,就删除或归档它,而不是让它日后毒化上下文。
