# 迭代维护工作流 — dsh-tokbook

> **Doc meta** · role: process · language: zh-CN · status: current · last-reviewed: 2026-09-11 · supersedes: —

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

## 7. 文件体量:别让新功能继续堆进巨石文件

D-011 之后实测的痛点:`LedgerOverlay.tsx` 曾到 ~1300 行(壳 + 五 tab + 趋势图 + 口径文案),
`styles.ts` 曾到 ~1400 行 CSS 字符串——改一个 tab 要滚过整份无关代码。拆完后的约定:

### 判据(何时拆)

| 信号 | 动作 |
|---|---|
| 单一职责源文件 **~400 行** | 审视:是否混了第二个职责/第二个 surface?是 → 拆 |
| **~600+ 行且混多类关注点** | 必须拆(或本次功能顺手拆) |
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

## 参考

- 地图与 role/status 语义:`INDEX.md`;契约:`CONTRACTS.md`;决策日志:`DECISIONS.md`
  (体量与告急点见 **D-012**);设计推理:`DESIGN.md`(顶部阅读指南区分历史与现状);
  教训:`LESSONS.md` / `HMR.md`。
