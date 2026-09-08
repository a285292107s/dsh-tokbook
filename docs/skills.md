# dsh-tokbook 中的技能（Skills）

> **Doc meta** · role: reference · language: zh-CN · status: current · last-reviewed: 2026-09-08 · supersedes: —

**技能（skill）** 是插件向 DeepSeek Harness（DSH）会话贡献的一种可复用、面向特定任务的指令。模型在其目录中只看到技能的 `name` 与 `description`，并通过 `skill({ name })` 工具按需加载完整的 Markdown 正文；用户也可直接用 `/name` 调用。技能是可选的指令，而非会话事件。

本文档是 DSH 技能系统的**插件开发者视角**，范围限定于 `dsh-tokbook`：该插件如何贡献一个技能、必须遵循的 `SKILL.md` 契约，以及其技能文件在何处被发现。它改编自 DSH 子系统参考文档，使技术事实保持正确，而叙述框架与链接贴合本仓库。

## 本插件贡献技能的两种方式

| 方式 | 怎么做 | 要求 | 适用 |
|---|---|---|---|
| **随包 / 项目技能文件** | 在可被发现的技能目录中放置 `SKILL.md` | 无需代码；由文件系统提供方（`@deepseek-ai/dsh-skill-filesystem`）发现 | 插件可立即发布的静态指令正文 |
| **运行时注册** | 在 `apply()` 中调用 `ctx.skills.register(...)`（完整技能）或 `ctx.skills.registerProvider(...)`（自定义提供方） | 技能注册表（`@deepseek-ai/dsh-skill`）已挂载到宿主组合，且 `ctx.skills` 在作用域内 | 计算生成的正文、提供方专属资源，或依赖运行时状态的技能 |

- **随包文件**是最简单的路径：在项目的 `.dsh/skills` 或 `.agents/skills` 目录（或已配置的 bundled 根目录）中放一个 `SKILL.md`，它就会出现在会话目录里。无需任何插件代码。
- **运行时注册**让插件以程序方式构造指令正文并注册到 `ctx.skills`。它只在技能注册表被挂载时生效，而这是宿主侧能力——本插件的浏览器/客户端半区无法贡献技能。

## SKILL.md 格式

技能可以是目录包 `<name>/SKILL.md`，也可以是扁平 Markdown 文件 `<name>.md`。名称必须为 kebab-case（`^[a-z0-9]+(?:-[a-z0-9]+)*$`）；不支持嵌套递归的 `**/SKILL.md` 发现。每个技能都带有 YAML frontmatter；`name` 与 `description` 为必填，名称或描述缺失/非法的技能会被忽略。

| Frontmatter 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `name` | string（kebab-case） | 必填 | 技能标识；必须与文件/目录名一致 |
| `description` | string | 必填 | 目录中显示的简短路由文本 |
| `whenToUse` | string | 省略 | 可选的额外路由引导（注意：camelCase） |
| `disable-model-invocation` | boolean | `false`（可被模型调用） | 设为 `true` 则从模型目录与加载器中隐藏 |
| `user-invocable` | boolean | `true` | 设为 `false` 则从用户 `/name` 界面中隐藏 |

frontmatter 之后的正文即模型阅读的 Markdown 指令内容。正文引用的相对资源通过技能的 `resourceBase`（目录、URL 或提供方管理的不透明基址）按需解析；加载结果从不枚举目录。其余任意额外 frontmatter 元数据会被解析并透传，但仅上述键属于领域模型。

`dsh-tool-skill` 会在第一个观察非空完整视图的存活 `agent/pre-step` 上注入初始的持久 user-role `<system-reminder>` 目录，且只转发技能 `name` 与经 XML 转义的 `description`——绝不包含正文、路径、来源或提供方。

## 技能文件在何处被发现

随附的本地提供方按 rank 顺序扫描各根目录；重名时依次按 rank、提供方顺序、本地顺序裁决。对本插件而言，相关的根目录为项目级目录：

| Rank | Source | Root | 是否适用于 dsh-tokbook？ |
|---|---|---|---|
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` | 是——项目级技能 |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` | 是——同样为项目级 |
| 300 | `custom` | `Config.customSkillDirs` | 间接——由 profile 设置 |
| 400 | `user-dsh` | `<dshHome>/skills` | 间接——用户自有技能 |
| 500 | `user-agents` | `<agentsHome>/skills` | 间接——用户自有技能 |
| 600 | `bundled` | `Config.bundledSkillDir` | 是（若 profile 配置了 bundled 目录） |

`projectRoot` 为包含 `.git` 的最近祖先目录；找不到时使用当前 cwd。因此，当 harness 项目根是一个 git 工作树时，随本仓库一起发布的技能会落入 `project-dsh` 或 `project-agents` 根目录。本地提供方**不会**合成内置系统技能；插件通过已配置的 bundled 根目录或专用提供方提供随包技能。

## 调用策略（Invocation Policy）

`SkillInvocationPolicy` 将两个独立控制规范化为布尔值；每个已解析的摘要、候选项与定义都携带它。frontmatter 键 `disable-model-invocation` 与 `user-invocable` 直接映射到它（请保持 kebab-case——camelCase 的旧键会被拒绝）：

- `{ modelInvocable: true, userInvocable: true }` —— 对模型与用户均可见（当两个键均省略时的默认值）。
- `{ modelInvocable: false, userInvocable: true }` —— 仅用户。
- `{ modelInvocable: true, userInvocable: false }` —— 仅模型。
- `{ modelInvocable: false, userInvocable: false }` —— 只能经受信的 `ctx.skills.get()` 调用者访问，不能经模型或用户界面。

## 注册表契约（插件需要触及的部分）

`ctx.skills` 为分层的宿主注册表。注册会落入调用方上下文 scope 对应的层：宿主行与 repository 插件落入全局层，而由 agent preset 常驻组合挂载的插件落入该 preset 的层。读取时会将全局层与观察 scope 的链合并；最近层的条目直接赢得重名，rank 顺序只在单层内裁决重名。

```ts
// 在 apply() 中注册一个完整运行时技能。
const dispose = ctx.skills.register({
  name: 'dsh-tokbook-usage',
  description: '读取并总结 dsh-tokbook 令牌用量账本。',
  content: '...',       // Markdown 正文
  invocation: { modelInvocable: true, userInvocable: true },
  // provider 默认为注册表自有的运行时提供方
})

ctx.on('dispose', dispose) // 或从 effect 中直接 yield 该 disposer
```

```ts
// 或注册一个从自有来源发现/加载技能的提供方。
const disposeProvider = ctx.skills.registerProvider((control) => ({
  name: 'tokbook-provider',
  async list(options) {
    // options.cwd 选择工作区敏感的技能；options.signal 取消工作。
    return [] // 或不完整发现时返回 SkillProviderObservation
  },
  async get(candidate, options) {
    // candidate.locator 是传回给你的不透明提供方状态。
    return undefined
  },
}))
```

其余注册表读取为 `ctx.skills.list(options)`（排序后的、与调用策略无关的摘要）、`ctx.skills.snapshot(options)`（摘要加 `complete` 标志），以及 `ctx.skills.get(name, options)`（完整定义）。提供方与运行时变更会发出不带过滤条件的失效事件 `skills/change`；消费方使用自身查找选项重新获取目录。查找选项为 `{ cwd?, signal? }`，当调用方是 agent 时还可带 `scope`（agent 自身即其 scope key）。

这些类型与方法由运行时技能包（`@deepseek-ai/dsh-skill`、`@deepseek-ai/dsh-skill-filesystem`、`@deepseek-ai/dsh-tool-skill`）提供，而非本仓库内的本地源码。要获取权威的类型签名与完整的提供方/注册表契约，请阅读已安装包的类型声明；它们位于 DSH 运行时中，而非此处。

## 让 tokbook 技能真正有用

技能只有当它告诉模型一些模型本不知道、也无法安全猜测的信息时才有用。对 `dsh-tokbook` 而言，技能适合编码插件的**持久契约**——例如 agent 应如何读取令牌用量概览路由并汇报——而不是复述实现。一个合理的随包 `SKILL.md`：

```markdown
---
name: dsh-tokbook-usage
description: 用于读取并总结 dsh-tokbook 账本的跨会话令牌用量。
whenToUse: 当用户询问跨会话的令牌消耗、成本或用量时。
---

# 读取 dsh-tokbook 用量

抓取 exact-Fetch 的宿主路由 `tokbook.overview` 并总结返回的账本。说明
提供方/模型的粒度、聚合方式与当前的持久化注意事项（见插件 README），
以免用户过度信任数字。不要断言账本中不存在的行。
```

请保持正文稳定且面向契约。仅修改正文会改变后续工具调用，而不会生成新的目录消息或改写先前工具结果。

## 本插件的前置条件与注意事项

- **`ctx.skills` 是宿主侧能力。** 它只在技能注册表挂载到宿主组合时可用。本插件的浏览器/客户端半区无法直接贡献技能。
- **消费方必须被挂载。** 要让模型看到目录，必须存在 `@deepseek-ai/dsh-tool-skill` 消费方；否则不会有 `<system-reminder>` 目录或 `skill` 工具被注入。
- **静态技能优先用随包文件。** 若正文固定，请在可发现的根目录中发布 `SKILL.md`，而非在代码中注册。仅当正文是计算生成、或技能需要自定义提供方时，运行时注册才值得。
- **保持 frontmatter 键精确。** `whenToUse` 为 camelCase；调用键为 kebab-case。camelCase 的调用键会被明确拒绝。
