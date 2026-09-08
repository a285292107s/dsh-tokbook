# AGENTS.md

dsh-tokbook 是一个面向 DeepSeek Harness(DSH)的**跨会话 Token 用量账本**插件:
host 半区把每次 provider 计费模型调用记成一行、写入按日 JSONL 账本并提供带成本的聚合;
browser 半区用侧边栏 footer 按钮 + shell.overlay 浮窗展示它们(汇总、按 provider、
价格表、订阅额度等 tab)。

本文件让 agent 的行为与本仓库的实际运作方式对齐。更具体的指示优先;当任务进入下面
某一领域时,先读链接的文件再改代码。

## 与维护者的协作方式(常设偏好)

本仓库只有一位维护者——我,以 AI 辅助开发。除非我在具体任务里另行说明,以下三条是
每个任务的默认:

1. **动手前先澄清意图——不要猜测。** 我提出任务时,先分析我的意图:我想要的结果、
   适用的约束。如果有影响实质的不清晰点——范围、目标、取舍、"完成"的样子——直接
   向我提问,确保我们认知同步后再改动任何东西。只有机械、无歧义的工作可以不问直接做。

2. **从第一性原理出发思考。** 从底层目标与本仓库内真实的事实(代码、数据、约束)出发,
   而不是套用熟悉的套路或习惯。说明你的假设;对继承来的选择——包括此前 AI 的决定与
   文档——如果它已不值得保留,敢于质疑并明说,而不是默默照做。

3. **单人维护 + AI 辅助——不做过度防御性设计。** 优先选择满足需求的最简设计。不添加
   投机性结构:为未必到来的未来做的抽象、为没发生过的场景写的防御代码、没人要的配置
   开关、超出需要的测试/检查。因真实原因存在的不变量(账本的单写者与去重)保留;不为
   没人要求的新场景新增。当更简方案只是牺牲投机性防护时,选更简方案。

> 维护者原话:① 先分析意图;不清晰时**不要猜测,向我提问**,确保认知同步;
> ② **从第一性原理出发**思考;③ 单人维护 + AI 辅助开发,**不做过度防御性设计**。

## 包管理器与命令

这是单个 pnpm 包(`pnpm-workspace.yaml` 只固定 esbuild 构建)。用 `pnpm install` 安装。

| 命令            | 执行内容 |
| --------------- | ------------ |
| `pnpm build`    | `tsc -b`(生成 `lib/types/*.d.ts`),再用 esbuild 打包 `lib/index.js`(host)与 `lib/client.js`(browser) |
| `pnpm typecheck`| `tsc --noEmit` — 只查 `src/`;`scripts/` 不参与编译 |
| `pnpm watch`    | `tsc -b --watch` — 只出类型;要刷新产物请跑 `pnpm build` |
| `pnpm smoke` / `pnpm selfcheck` / `pnpm test` | 纯逻辑 + 不变量自检,用 `node --experimental-strip-types` 执行 |

`scripts/*.ts` 直接用 Node 的类型剥离执行、从不由 tsc 编译,所以它们只在真正运行时才被
类型检查。

## 修改源码

- 源码唯一真源在 `src/`:host 半区在 `src/*.ts`,browser 半区在 `src/client/*.tsx`。
  整体文件布局见 README。
- `lib/` 是构建产物且被 gitignore——改 `src/`,然后跑 `pnpm build`。不要手改或提交 `lib/`。
- 构建后,host 改动经 profile 的 `cordis-plugin-hmr` 行热替换;browser 改动在刷新页面后
  生效。确切保证见 README(Dev / HMR)与 `docs/HMR.md`。
- browser bundle 把 DSH 基线模块(react、cordis、`dsh-client-*`)保持 external。若新增
  client 依赖,保持 `scripts/build-client.mjs` 的 `BASELINE_EXTERNALS` 与 DSH 的 client
  platform 模块清单同步(README · Build 一节)。
- client 入口**不能加 `default` 导出**——cordis loader 会因此坏掉(`docs/DESIGN.md` §7.4)。

## 更深上下文(动手前先读对应领域)

- `README.md` — 端到端项目范围、布局、构建/安装/配置、状态。最先读它。
- `docs/INDEX.md` — 本仓库文档树的地图(role · status · 何时读)。在改动有文档契约的
  代码(路由、配置、事件、数据文件)前,先看该领域的条目。

必须与代码一致的契约在 `docs/CONTRACTS.md`,持久架构决策在 `docs/DECISIONS.md`——在
**同一个 commit** 里随代码改动更新它们;`scripts/selfcheck-docs.ts`(属于 `pnpm
selfcheck`)会在它们漂移时失败。

本仓库文档统一为中文;代码、README 中的命令与标识符保留英文原样。文档会过时——当文档
与代码冲突时,以代码为准并修文档。

## 保持本文件精简

本文件每次请求都会载入上下文,所以刻意保持最小。只适用于单一领域的指引应放进上面链接
的文档(或嵌套的 AGENTS.md),而不是这里——加面包屑,不要加规则。
