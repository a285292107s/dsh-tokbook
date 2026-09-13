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
     [`DECISIONS.md`](DECISIONS.md) **顶部的当前决策索引表**,再读 **D-011**(当前手工价表形态)
     与 [`CONTRACTS.md`](CONTRACTS.md) 的「Host 路由」(wire 要点)与「让数字保持诚实的不变量」
     (计价与费率身份);不要沿用已被 D-011 取代的云端镜像/通道覆盖层决策。

## 2. L3 先落 PLAN,单 commit 直接做

- L3(跨多 commit、或需要维护者分阶段审):先建一份 `role: process` 的 PLAN
  (命名如 `PLAN.<topic>.md`),把实施注记与阶段写清,再开工。**全量落地后**:标
  `superseded` 移入 `docs/archive/`(见 §5)。
- L1/L2 的单 commit 改动:不需要 PLAN,直接实现——不建投机性文档。

## 3. 改代码的同时,按触及面更新文档(同一 commit)

| 触及面 | 必须同步 | 强制方式 |
|---|---|---|
| host 路由(`/tokbook/*`) | `CONTRACTS.md` · Host 路由表 | `selfcheck-docs` 机器双向校验 |
| wire JSON 形状、配置键、消费的会话事件、数据目录文件布局 | `CONTRACTS.md` 相应节 | 人工(`selfcheck-docs` 只查路由 token) |
| 持久架构决策(含取代旧决策) | `DECISIONS.md` 追加 `D-NNN` + 顶部索引表一行,旧条目状态行降级并**双向**链接 | `selfcheck-docs` 机器校验(状态行 / 取代双向 / 索引表) |
| 功能面(范围 / 布局 / 配置示例 / 状态) | `README.md` | 人工 |
| 机制坑 / 教训 / HMR 边界 | `LESSONS.md` / `HMR.md` | 人工 |
| 你确实改了正文的文档 | 顺手刷新它的 `last-reviewed` | 人工(selfcheck 只查格式) |
| 纯 client 样式、纯内部小改(不碰上述面) | **什么都不用动**——不为一次样式改动去碰文档 | — |

原则:**同一 commit**。宁可某份文档的更新小而准,也不要「实现完再回头补文档」——补
文档的 commit 是漂移最容易漏网的地方。

**文档 diff 不得大于代码 diff。** 为一次改动要动 ≥3 份文档时先停下来问:这真的是 L2 吗?
是不是把「顺手」当成了「必须」?宁可少更新一份,也不要为对称而更新。

## 4. 门禁(按改动选最小的那道)

选择表见 `AGENTS.md` · 包管理器与命令;这里只说每条门各自覆盖什么。

- 动了 README / `docs/**` → `pnpm docs:check`:CONTRACTS 路由双向比对、INDEX 链接可达、
  全部受管文档带合法 Doc meta、`DECISIONS.md` 的状态行可解析且取代关系双向、索引表与正文逐格一致。
- 动了 host 逻辑或自检覆盖的纯逻辑(`src/*.ts`、`src/client/pricing/axis.ts`)→ `pnpm test`。
- 只改了 `src/client/styles/**` 或 `.tsx` 的呈现 → `pnpm build` + 刷新页面,不必跑 selfcheck。
- **提交、或合并回主检出之前** → `pnpm test`。红 = 当场修,绿才提交。

## 5. 状态生命周期回顾

- `current` = 描述现状;`superseded` = 已被替换(移入 `docs/archive/` 或原位标注并链接
  取代者);`draft` = 未完成。`DECISIONS.md` 内部多一档 **`partially superseded`** = 条目里
  仍有生效的规则、另一部分已被取代(见 §7)。
- `DECISIONS.md` 的条目状态行是**机器可解析**的(`Status` / `supersedes` / `superseded-by`),
  取代关系双向记录;顶部索引表是正文的投影。三者由 `selfcheck-docs` 强制(见 §3、§4)。
- **已落地**的计划 / 过程文档 → `superseded` + 移入 `docs/archive/`。没有文档可以默默
  滞后于代码:若某份文档无法保持真实,删除或归档它,而不是让它日后毒化上下文。

## 6. 何时新建文档,何时只改现有

判据:**只有出现新的问题类别**(agent 会问的一类新问题、现有叶子都装不下)才新建叶子,
并在 `INDEX.md` 加一行,写清 role / status / 何时读。其余一律改现有文档。

`INDEX.md` 是地图不是日志:单次任务细节、一次性讨论结论不进树。

## 7. 文件体量:别让新功能继续堆进巨石文件

D-011 之后实测的痛点:`LedgerOverlay.tsx` 曾到 ~1300 行(壳 + 五 tab + 趋势图 + 口径文案),
`styles.ts` 曾到 ~1400 行 CSS 字符串——改一个 tab 要滚过整份无关代码。拆完后的约定:

### 判据(何时拆)

| 信号 | 动作 |
|---|---|
| 单一职责源文件 **~400 行** | 审视:是否混了第二个职责/第二个 surface?是 → 拆 |
| **~600+ 行且混多类关注点** | 必须拆,但**另开一轮**——不在功能改动里顺手做 |
| 内聚领域模块(`types.ts`、`pricing.ts`、`stats.ts` 的纯折叠) | **保持整文件**,不为数字拆 |
| 纯搬家会引入新抽象层 | 不拆——单人仓库里导航成本通常低于错误分层 |

### 怎么拆(已用过的模式)

- **浮窗 / tab**:`LedgerOverlay.tsx` = 对话框壳 + tab 装配;每个 tab 一个文件
  (`LedgerView` / `ProviderPanel` / `MethodDoc` / `QuotaPanel` / `pricing/*`);
  纯展示 helper 进 `format.ts`。
- **CSS**:`styles.ts` 只做 `injectStyles()` + **固定顺序**拼接 `styles/*.ts`
  (tokens → footer → overlay → ledger → method → provider → quota → pricing → shared)。
  **级联顺序是契约**,不要重排。
- **host 配置**:`config.ts` 收 `validateConfig` / `coercePlan*`;Service 本体留在 `index.ts`。
- 拆分 commit **不改行为**:同一次 `pnpm typecheck` + `pnpm test` 要绿;README「布局」
  同步新文件名。

### 不要做

- 不要在拆分时顺手加配置开关、事件总线、通用「panel registry」。
- 不要为「可能再长出一个 tab」预留空目录或空模块。
- 不要把一行逻辑切成三层 import。

### 同一把尺子用在文档上:决策条目 ≤ 40 行

`DECISIONS.md` 是**决策日志**,不是设计文档——它自己的契约是「指针 + 要点」。按内容分家:

| 内容 | 去处 |
|---|---|
| 决策本身、迫使它成立的背景、它取代了什么、代价与取舍 | `DECISIONS.md` 条目(**≤ 40 行**) |
| 契约(wire 形状 / 配置键 / 路由 / 数据文件 / 界面词表) | [`CONTRACTS.md`](CONTRACTS.md) |
| 机制推理、当前界面规格、实测出来的尺寸与对比度 | [`DESIGN.md`](DESIGN.md) |
| 踩坑与取舍对照(某个 CSS 写法、某个 loader 行为) | [`LESSONS.md`](LESSONS.md) |

**怎么数。** 从状态行数到条目末尾(含空行);标题与 `---` 分隔线不计。

**为什么是契约而不是口味。** 索引表让读者只为「它需要的那 1–3 条」付钱,而单条体量决定这一跳
有多贵:一条 125 行的条目会把一次 300 行的定点阅读变成 1000 行。2026-09-13 已把两条最大的越界
条目落地:**D-013 112 → 40 行、D-016 125 → 25 行**(界面规格搬进 [`DESIGN.md`](DESIGN.md) §3.1,
已被取代的过程叙述直接删)。

**现有的越界条目(碰到它们时顺手拆,不专门开一轮)。** 拆的方向就是上表那一列:

| 条目 | 行 | 状态 | 越界的是什么 / 该去哪 |
|---|---|---|---|
| D-014 | 84 | current | 官方文档证据与逐通道判定 → 证据进 `DESIGN.md`,判定规则本就在 `CONTRACTS.md` |
| D-019 | 60 | current | 时间轴的界面规格 → `DESIGN.md` §3.1(与 D-013 同源) |
| D-005 | 52 | superseded | 纯历史,只留结论即可压到 ~15 行 |
| D-018 | 50 | current | 「界面修订」一段 → `DESIGN.md` |
| D-008 | 47 | superseded | 纯历史 |
| D-011 | 45 | partially superseded | 「影响与已知取舍」可压 |
| D-009 | 44 | superseded | 纯历史 |
| D-017 / D-020 | 41 | current | 刚越线,再涨就拆 |

**怎么做。** 条目里留 3–5 行摘要 + 指针,细节搬去它该在的文件。搬的**只是仍然生效的规格**;
已被后续决策取代的过程叙述(试了 A、又试了 B 的流水账)直接删——它在 git 历史里,留着就是
`AGENTS.md` 说的「让文档日后毒化上下文」。新条目从写下第一行起就守住 40 行。

## 8. worktree:只在维护者明确要求时

**默认在主检出直接改。** 不判断主检出有没有被别的会话占着,不做预防性 worktree,不为「可能并行」
提前分车道;只有维护者明确要求时才走本节。理由:占用不可观测——你看不到别的会话的意图,
`git status` 干净也不等于没人;而主检出的价值正是唯一的实时反馈环路(`pnpm build` → 刷新浏览器),
为想象中的并行放弃它不划算。

### 本仓库的事实(决定了并行时得接受什么)

- 运行中的 DSH **只认一个路径**:profile 里 `dsh-tokbook` 是指向主检出的 junction,host HMR
  的 `base` 也钉在主检出。`lib/` 是每个检出各自的产物,**只有主检出的那份是线上的**。
- 账本数据目录是全局的(`$DSH_HOME/tokbook`)且假设单写者(`src/ledger.ts` 的 `owner.json`
  告警;README「一个数据目录,一个写入进程」)。
- `tsconfig` 收 `src/**`、host HMR 的 `root` 是主检出——所以 **worktree 建在仓库外**,否则被
  构建与 watch 扫到,还会让「哪份是线上」不可判。

所以 worktree 里没有实时验证:**验证一律回主检出做**。

### 维护者要求时:建、合并、清理

```sh
git worktree add -b feat/<topic> ..\dsh-tokbook-wt\<topic> main   # 分支点 = main 最后一个 commit
cd ..\dsh-tokbook-wt\<topic>
pnpm install   # 只有 pnpm typecheck / pnpm build 需要;pnpm test 不装依赖也能跑
```

合并:worktree 里 `git rebase main` 并解冲突 → 主检出 `git merge --no-ff feat/<topic>` →
**合后门禁在主检出跑**(`pnpm test` + `pnpm build` + 刷新浏览器;红就当场修或 revert)→
`git worktree remove ..\dsh-tokbook-wt\<topic>` + `git branch -d feat/<topic>`。

冲突按语义解,不按「取并集」:`DECISIONS.md` 撞号按 main 尾号重编号(**含顶部索引表那一行**)、
`CONTRACTS.md` 路由表取并集、`src/client/styles.ts` 的分片拼接顺序是级联契约**不重排**;两个改动
改同一个 seam(`src/types.ts` / `src/index.ts` / `src/routes.ts`)时不并行,排队做。

子代理同一条规则:默认在主检出改,维护者要求 worktree 时才开;rebase、合并、合后门禁归父代理。

### 不要做

- 不要为「实时预览 worktree 里的分支」另起第二个 host:那需要独立 `path` 数据目录,而 `--patch`
  overlay 只覆盖 host 半区(README 引用的 `dev/cordis.yml` 目前也不存在)。要看效果就合并到 main。
- 不要为建/删 worktree 养脚本:两条 git 命令,包一层只是多一个维护面。
- 不要为判断车道占用引入锁 / 声明文件:判断本身已经不做了,真踩到再按那次的证据加。

## 参考

- 地图与 role/status 语义:`INDEX.md`;契约:`CONTRACTS.md`;决策日志:`DECISIONS.md`
  (体量与告急点见 **D-012**);设计推理:`DESIGN.md`(顶部阅读指南区分历史与现状);
  教训:`LESSONS.md` / `HMR.md`。
