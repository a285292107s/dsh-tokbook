# 迭代维护工作流 — dsh-tokbook

> **Doc meta** · role: process · language: zh-CN · status: current · last-reviewed: 2026-09-14 · supersedes: —

> **用法**:本文件只服务 **L2/L3**(契约面 / 跨 commit / 维护者要求 worktree)。L0/L1 按
> [`AGENTS.md`](../AGENTS.md) 的分层表做,**不要往下读**。L2/L3 的目标:功能不断演进时,文档与
> 代码在**同一 commit** 保持同步,契约不漂移,文档永不明目张胆滞后于代码。它与 `AGENTS.md`
> 的常设偏好互补——那里管「怎么与维护者协作」,这里管「哪些文档必须一起动」。本文档是常驻
> 规则,不因某次功能落地而归档。

## 1. 澄清与定位(开工前)

1. 澄清意图——**只在影响实质且反向成本高时问**(AGENTS.md 偏好 1);能说明假设就继续做。
2. 定位:读 [`INDEX.md`](INDEX.md) 里你要触及领域的行,**只读那一份**叶子,不整树通读。
   - 改契约性代码(路由 / wire / 配置 / 事件 / 数据文件)前:先读
     [`CONTRACTS.md`](CONTRACTS.md);
   - 改账本 / 去重 / 折叠路径前:先读 [`HMR.md`](HMR.md);
   - 改 `src/pricing.ts` / `stats.ts` / 价格相关 wire 前:先读
     [`DECISIONS.md`](DECISIONS.md) **顶部的当前决策索引表**,再读 **D-011 / D-013**(手工价表与
     两级时间轴的当前形态)与 [`CONTRACTS.md`](CONTRACTS.md) 的「让数字保持诚实的不变量」
     (计价与费率身份);不要沿用已被 D-011 取代的云端镜像/通道覆盖层决策。

## 2. L3 先落 PLAN,单 commit 直接做

- L3(跨多 commit、或需要维护者分阶段审):先建一份 `role: process` 的 PLAN
  (命名如 `PLAN.<topic>.md`),把实施注记与阶段写清,再开工。**全量落地后**:标
  `superseded` 并归档——**但没人会再读的直接删更省事**(git 就是归档),见 §5。
- L1/L2 的单 commit 改动:不需要 PLAN,直接实现——不建投机性文档。

## 3. 改代码的同时,按触及面更新文档(同一 commit)

| 触及面 | 必须同步 | 强制方式 |
|---|---|---|
| host 路由(`/tokbook/*`) | **不进文档**——真源是 `src/routes.ts` | `selfcheck-docs` **反向**守卫:CONTRACTS 里出现路由路径即失败 |
| 新增 / 删除 / 改名 `src/**`、`scripts/**` 的文件 | `README.md` · 布局 | `selfcheck-docs` 机器双向校验(写了不存在的路径、或漏掉文件都会红) |
| wire JSON 形状、配置键、消费的会话事件、数据目录文件布局 | **什么都不用动**——它们是代码(`src/types.ts` / `src/usage-record.ts` / `src/ledger.ts`) | — |
| **不变量**本身变了(去重身份 / 「未知」的语义 / 计价身份 / 单写者与数据目录) | `CONTRACTS.md` §2 / §3 | 人工(机器只守结构:不复述路由、ADR 体量、meta、链接) |
| 持久架构决策(含取代旧决策) | `DECISIONS.md` 追加 `D-NNN` + 顶部索引表一行,旧条目状态行降级并**双向**链接 | `selfcheck-docs` 机器校验(状态行 / 取代双向 / 索引表) |
| 功能面(范围 / 布局 / 配置示例 / 状态) | `README.md` | 人工 |
| **界面口径文案**(「用量未知 ≠ 0」「价格未知 ≠ 免费」双桶措辞等) | `README.md` 对应段 + `src/client/MethodDoc.tsx`(统计口径页) | 人工——口径的**契约**在 CONTRACTS,这两处是给读者/用户看的复述,改口径时一起改 |
| 机制坑 / 教训 / HMR 边界 | `LESSONS.md` / `HMR.md` | 人工 |
| 你确实改了正文的文档 | 顺手刷新它的 `last-reviewed` | 人工(selfcheck 只查格式与「不是未来日期」) |
| 纯 client 样式、纯内部小改(不碰上述面) | **什么都不用动**——不为一次样式改动去碰文档 | — |

原则:**同一 commit**。宁可某份文档的更新小而准,也不要「实现完再回头补文档」——补
文档的 commit 是漂移最容易漏网的地方。

**文档 diff 不得大于代码 diff。** 为一次改动要动 ≥3 份文档时先停下来问:这真的是 L2 吗?
是不是把「顺手」当成了「必须」?宁可少更新一份,也不要为对称而更新。

## 4. 门禁(按改动选最小的那道)

选择表见 `AGENTS.md` · 包管理器与命令;这里只说每条门各自覆盖什么。

- 动了 README / `docs/**` → `pnpm docs:check`:CONTRACTS 路由双向比对、INDEX 链接可达、
  全部受管文档带合法 Doc meta 且 `last-reviewed` 不是未来日期、README「布局」与 `src/` +
  `scripts/` 的磁盘内容互相覆盖(既不许写不存在的路径,也不许漏文件)、`DECISIONS.md` 的状态行
  可解析且取代关系双向、索引表与正文逐格一致、条目体量超 40 行打印 / 超 80 行失败。
- 动了 host 逻辑或自检覆盖的纯逻辑(`src/*.ts`、`src/client/pricing/axis.ts`)→ `pnpm test`。
- 只改了 `src/client/styles/**` 或 `.tsx` 的呈现 → `pnpm build` + 刷新页面,不必跑 selfcheck。
- **提交、或合并回主检出之前** → `pnpm test`。红 = 当场修,绿才提交。

## 5. 状态生命周期回顾

- `current` = 描述现状;`superseded` = 已被替换(原位标注并链接取代者,或直接删);`draft` = 未完成。`DECISIONS.md` 内部多一档 **`partially superseded`** = 条目里
  仍有生效的规则、另一部分已被取代(见 §7)。
- `DECISIONS.md` 的条目状态行是**机器可解析**的(`Status` / `supersedes` / `superseded-by`),
  取代关系双向记录;顶部索引表是正文的投影。三者由 `selfcheck-docs` 强制(见 §3、§4)。
- **已落地**的计划 / 过程文档 → **直接删**(git 就是归档);只有确实还会被人反复查的才标
  `superseded` 留一份。没有文档可以默默滞后于代码:一份文档无法保持真实,就删除它,
  而不是让它日后毒化上下文。

## 6. 何时新建文档,何时只改现有

判据:**只有出现新的问题类别**(agent 会问的一类新问题、现有叶子都装不下)才新建叶子,
并在 `INDEX.md` 加一行,写清 role / status / 何时读。其余一律改现有文档。

`INDEX.md` 是地图不是日志:单次任务细节、一次性讨论结论不进树。

## 7. 文件体量:别让新功能继续堆进巨石文件

### 判据(何时拆)

| 信号 | 动作 |
|---|---|
| 单一职责源文件 **~400 行** | 审视:是否混了第二个职责 / 第二个 surface?是 → 拆 |
| **~600+ 行且混多类关注点** | 必须拆,但**另开一轮**——不在功能改动里顺手做 |
| 内聚领域模块(`types.ts` / `pricing.ts` / `stats.ts` 的纯折叠) | **保持整文件**,不为数字拆 |
| 纯搬家会引入新抽象层 | 不拆——单人仓库里导航成本通常低于错误分层 |

### 怎么拆 / 不要做

- **一个 surface 一个文件**:浮窗壳只做壳 + tab 装配,每个 tab 一个文件,纯展示 helper 进
  `format.ts`;host 配置校验进 `config.ts`、Service 本体留 `index.ts`。
- **样式分片只按 `styles.ts` 的 import 顺序拼接**——级联顺序是契约,顺序以代码为唯一真源。
- 拆分 commit **不改行为**:同一次 `typecheck` + `test` 要绿;README「布局」同步新文件名。
- **不要**顺手加配置开关 / 事件总线 / 通用 registry;不要为「以后可能多一个 tab」预留空目录;
  不要把一行逻辑切成三层 import。

### 同一把尺子用在文档上:内容按「谁能读出来」分家

| 内容 | 去处 |
|---|---|
| **代码里读不出来**的:不变量、为什么这么定、代价与取舍 | `DECISIONS.md` 条目(**≤ 40 行**);机制推理 → [`DESIGN.md`](DESIGN.md) |
| **代码里读得出来**的:路由 / wire 形状 / 配置键 / 数据文件 / 取值与规格 / 逐文件布局 | **不进文档**——直接读 `src/`(界面那批可判定的禁令由 `pnpm selfcheck:ui` 强制) |
| 入口与操作(是什么 / 怎么装 / 怎么配 / 怎么跑 / 当前缺口) | [`README.md`](../README.md) |
| 外部系统的机制与事实(推不出来的那部分) | [`HMR.md`](HMR.md)、[`DESIGN.md`](DESIGN.md) §3 / §6 / §7 |
| 踩过的坑:现象 → 根因 → 做法 | [`LESSONS.md`](LESSONS.md) |

**怎么数。** 从状态行数到条目末尾(含空行);标题与 `---` 分隔线不计。`pnpm docs:check` 每次打印
`info DECISIONS 条目 > 40 行:…`,并在任一条超过 **80 行**时失败——**别再手工维护「越界条目」表**
(那张表漏过三处、还留着过时行数),清单交给脚本算,它不会过期。

**新条目从写下第一行起就守住 40 行。** 已被取代的过程叙述(试了 A、又试了 B 的流水账)直接删
——它在 git 历史里,留着就是 `AGENTS.md` 说的「让文档日后毒化上下文」。

## 8. worktree:只在维护者明确要求时

**默认在主检出直接改。** 不判断主检出有没有被别的会话占着,不做预防性 worktree;只有维护者明确
要求时才走本节。理由:占用不可观测(`git status` 干净也不等于没人),而主检出的价值正是唯一的
实时反馈环路(`pnpm build` → 刷新浏览器)。

**本仓库的事实(决定了并行时得接受什么)。** 运行中的 DSH **只认一个路径**(profile 里
`dsh-tokbook` 是指向主检出的 junction,host HMR 的 `base` 也钉在主检出),`lib/` 只有主检出那份
是线上的;账本数据目录是全局的且假设单写者(`owner.json`);`tsconfig` 与 watch 都收 `src/**`。
所以 **worktree 建在仓库外**,而且 **worktree 里没有实时验证——验证一律回主检出做**。

```sh
git worktree add -b feat/<topic> ..\dsh-tokbook-wt\<topic> main
cd ..\dsh-tokbook-wt\<topic> && pnpm install   # 只有 typecheck / build 需要
```

合并:worktree 里 `git rebase main` 解冲突 → 主检出 `git merge --no-ff feat/<topic>` →
**合后门禁在主检出跑**(`pnpm test` + `pnpm build` + 刷新)→ `git worktree remove` +
`git branch -d`。冲突按语义解,不按「取并集」:`DECISIONS.md` 撞号按 main 尾号重编号(**含索引表
那一行**)、styles 分片顺序**不重排**;两个改动改同一个 seam(`src/types.ts` / `src/index.ts` /
`src/routes.ts`)时不并行,排队做。子代理同一条规则:默认在主检出改,rebase / 合并 / 合后门禁归父代理。

**不要做**:不要为预览 worktree 里的分支另起第二个 host(那需要独立 `path` 数据目录,而 `--patch`
只覆盖 host 半区);不要为建 / 删 worktree 养脚本(两条 git 命令);不要为判断车道占用引入锁——
判断本身就不做。

## 参考

- 地图与 role/status 语义:`INDEX.md`;契约:`CONTRACTS.md`;决策日志:`DECISIONS.md`
  (体量与告急点见 **D-012**);设计推理:`DESIGN.md`(顶部阅读指南区分历史与现状);
  教训:`LESSONS.md` / `HMR.md`。
