# AGENTS.md

dsh-tokbook 是一个面向 DeepSeek Harness(DSH)的**跨会话 Token 用量账本**插件:host 半区把
每次通道计费模型调用记成一行、写入按日 JSONL 账本并提供带成本的聚合;browser 半区用侧边栏
footer 按钮 + shell.overlay 浮窗展示它们(汇总、按通道、价格表、订阅额度等 tab)。

## 与维护者的协作方式(常设偏好)

本仓库只有一位维护者——我,以 AI 辅助开发。任务里的另行说明**覆盖**这四条默认。

1. **只在真正值得问的时候问。** **影响实质、且反向成本高**的不清晰点(范围、取舍、"完成"的
   样子)直接问我;只是细节未明 → 说明假设后直接做——一次往返比一次可回退的改动贵。
   **只读 / 分析类任务不需要这一步。**
2. **从第一性原理出发思考。** 从底层目标与本仓库真实的事实(代码、数据、约束)出发,不套用
   熟悉的套路;它体现在**取舍的理由**上,不是长篇论证。对继承来的选择——包括此前 AI 的决定
   与文档——不值得保留就质疑并明说。
3. **不做过度防御性设计,也不做过度流程。** 选满足需求的最简设计:既不加投机结构(为未到来的
   未来做的抽象、没发生过的场景的防御代码、没人要的开关、超出的测试),也不做预防性动作
   (多读文档、多开 worktree、多补文档、为小改动建 PLAN/goal/todo、顺手重构或拆文件)。
   真因存在的不变量(账本单写者与去重)保留。**这条尺子同样适用于流程与文档本身。**
4. **浏览器验证先走无头 `playwright-cli`**(默认无头、独立会话,不干扰我前台那个浏览器);它做不到
   的(需要我的真实登录态 / 浏览器环境)才回落 `kimi-webbridge`。

## 任务分层:默认走最轻的一档

按改动**触到什么**判档,只有确实触到 L2/L3 的判据才升级。优先级:我的任务级说明 > 本节 >
`docs/WORKFLOW.md`。

| 档 | 判据 | 做 | 不做 |
| --- | --- | --- | --- |
| **L0** 只读 / 问答 | 不写文件 | 直接答 | 读 WORKFLOW、跑门禁、改文档、建清单 |
| **L1** 单点改动 | 只改 `src/`,不碰 L2 的任一面 | 改 + 最小那道门(见下) | 读 CONTRACTS / DECISIONS、拆文件、动与本次改动无关的文档 |
| **L2** 契约面 | 路由 / wire JSON / 配置键 / 会话事件 / 数据目录文件 / 价格表与计价规则 / 持久架构决策 | 按 `docs/INDEX.md` 只读那一份叶子,依 `docs/WORKFLOW.md` §1–§4 把 `docs/CONTRACTS.md` / `docs/DECISIONS.md` 随代码**同 commit** 改 | 顺手扩大范围 |
| **L3** 跨 commit / 真并行 | 需要分阶段审,或维护者明确要求 worktree | 先落 PLAN;worktree(`WORKFLOW.md` §8)只在明确要求时才走 | 自行判断主检出忙不忙 |

## 包管理器与命令

单个 pnpm 包(`pnpm-workspace.yaml` 只固定 esbuild 构建),用 `pnpm install` 安装。
**门禁与改动成正比**——按这张表选最小的那道,别对一行样式跑全套:

| 改动 | 门 |
| --- | --- |
| `src/client/styles/**` 或 `.tsx` 的呈现 | `pnpm build` + 刷新页面 + `pnpm selfcheck:ui` |
| 别的 `src/**` | `pnpm typecheck`(只查 `src/`);碰了 host 逻辑或 `src/client/pricing/axis.ts` 再加 `pnpm test` |
| 单独改 README / `docs/**` | 无门禁 |
| 提交、或合并回主检出之前 | `pnpm test`,需要线上产物时再 `pnpm build` |

`pnpm test` = smoke(聚合 / 计价 / 额度)+ selfcheck(账本不变量)+ selfcheck:ui(界面静态禁令)。
`scripts/*.ts` 由 Node 类型剥离运行、**从不由 tsc 编译**,所以只在真正跑起来时才被类型检查;
`pnpm build` 的产物与 `pnpm watch`(只出类型)见 README · 构建 / 对着源码检出开发。

## 修改源码

- 源码唯一真源在 `src/`(host `src/*.ts`,browser `src/client/*.tsx`);`lib/` 是 gitignore 的
  构建产物——改 `src/` 再 `pnpm build`,不要手改或提交 `lib/`。布局见 README。
- host 改动经 profile 的 `cordis-plugin-hmr` 行热替换,browser 改动刷新页面生效;确切保证见
  README(Dev / HMR)与 `docs/HMR.md`。
- 「别养巨型单文件」仍然成立,但**拆分是独立一轮**:判据见 `docs/WORKFLOW.md` §7,
  碰到大文件先修眼前的问题。
- browser bundle 的 external 清单、client 入口**不能加 `default` 导出**(`docs/DESIGN.md`
  §7.4)——改到那里再读。

## 更深上下文(动手前先读对应领域)

**L0 / L1 不需要读本节。** 按 `docs/INDEX.md` 的「何时读」列跳到**那一份**叶子,不整树通读;
`README.md` 在需要全貌时读。文档与代码冲突时以代码为准并修文档。文档统一中文,代码、命令与
标识符保留英文原样。

## 保持本文件精简

本文件每次请求都载入上下文,刻意最小(**含空行 ≤ 80 行——加一条规则就先删一条**):只放**常设偏好 + 分层判据 + 面包屑**,单一领域的规则进它该在的叶子。**也不要在回复里复述这里的流程与门禁**——已经载入上下文了。
