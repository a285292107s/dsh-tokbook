# dsh-tokbook —— 技术选型与插件框架设计（一期→二期演进）

> **Doc meta** · role: reason · language: zh-CN · status: current · last-reviewed: 2026-09-16 · supersedes: —

> 面向 DeepSeek Harness（DSH）的跨会话 Token 用量账本插件。
> 本文档是第一期的**调研结论 + 技术选型 + 框架设计**。调研依据仅两个权威来源：
> 官方文档站点 `https://deepseek-harness.github.io/deepseek-harness/` 与 DSH 源码
> `C:\Users\28529\Desktop\deepseek-harness`。文中引用的文件路径均相对该源码根。

---

## 阅读指南（先读这里，分清时间线）

> 本文是**设计推理与演进记录**,不是当前接口的唯一真相。时间线如下:
>
> - §1–§11 主体描述**第一期**框架(外置插件 + 浮窗 + 每会话聚合,不折算成本);
> - 「重构说明」(自 §428「重构说明:从「每会话聚合」改为「逐请求账本 + 成本」」起)描述
>   **第二期 = 当前代码形态**(逐请求 JSONL 账本 + 成本计价 + 通道/额度)。**以此段为准**;
> - §1 的「本期不做成本」与 §11 的「成本折算…后续二期或独立 costbook」预判**已被二期推翻并落地**;
>   通道/额度/pricing 升级的原始计划见 [`archive/PLAN.provider-pricing.md`](archive/PLAN.provider-pricing.md)(已归档,superseded)。
> - **第三期(当前)= 价格表破坏性重构**:删掉云端镜像/通道覆盖层/双维计价,改成本机唯一的一份
>   手工价表(路由 → 模型串 → 价段),由 [`DECISIONS.md`](DECISIONS.md) **D-011** 记录。本文
>   「重构说明」§3 只保留**当前**成本语义;二期关于云端 feed / 覆盖层 / `inheritBase` 的长文
>   已从本文件删除(避免再被当成现状),要追溯请读 D-003…D-010 与
>   [`archive/PLAN.provider-pricing.md`](archive/PLAN.provider-pricing.md)。
>
> **精确接口**(路由/配置/事件/数据文件)→ [`CONTRACTS.md`](CONTRACTS.md);**持久决策** →
> [`DECISIONS.md`](DECISIONS.md);实现/操作现状 → [`../README.md`](../README.md)。

---

## 0. 一句话结论

DSH 本身**已经内置**了逐会话、逐 turn 的 token 计量与展示（`@deepseek-ai/dsh-token-meter`
+ `@deepseek-ai/dsh-session-stats` + 内置 Web UI 的 `StatsLine` / `TurnUsagePanel`）。
所以 `dsh-tokbook` 的增量价值，落在**跨会话、可持久化、可回溯**的聚合账本，以及
一个**常驻浮窗总览**，而不是重复造逐 turn 的轮子。

---

## 1. 目标与范围

**目标（第一期）**：

- 建立 `dsh-tokbook` 独立外置插件框架（host 半区 + client 半区）。
- host 半区：监听持久化 `session/event`，聚合每个会话的 `TokenUsage`，落一条可持久化的账本。
- client 半区：在 Web UI 左下角（设置按钮上方）加一个入口按钮；点击弹出独立浮窗，展示账本内容。
- 数据可跨重启累计，能按会话 / 模型 / 通道 / 时间维度汇总。

**范围边界**（第一期不做）：

- 不做成本（金额）折算 —— DSH 的 `token-meter` 只算 token 数、不算钱；成本属于
  `dsh-costbook` 的职责，本期仅把 token 数字记清楚，成本留到后续阶段。
- 不改造 DSH 仓库 —— 保持纯外置（除非确认要改动 `ui-sidebar`，见 §6）。

---

## 2. 技术选型（已落定）

| 决策点 | 选择 | 依据 / 理由 |
|---|---|---|
| 插件形态 | Cordis 插件，一个 host 包 + 可选 client 半区 | DSH 所有功能都是 Cordis 插件（`docs/cordis-primer.md`） |
| 语言 / 构建 | TypeScript，Node，`tsconfig` + 自建 bundle | 外置包无法使用单仓 `clientBundle()` 预设（见 §7） |
| 插件位置 | 独立外置包（`dsh-tokbook`），挂进 `web` profile | 你已选定；运行时完全支持外置（见 §7） |
| 数据捕获 | 监听 `session/event` 的 `assistant/message` `usage`；挂载时重放既有会话做回填 | `usage` 是通道上报、持久化、可重放的权威来源 |
| 持久化 | `@deepseek-ai/dsh-storage` 的 `storage-domain`（JSON 后端） | base 层默认挂载；schema 校验、可查询、稳定 |
| host→浏览器数据通路 | `ctx.webServer.register({ kind:'exact', path, handler })` 的精确 HTTP 路由 | 外置插件无法方便地贡献生成的 Typert Remote；这是官方「feature-owned 精确 Fetch 路由」的路径（`docs/subsystems/web-client.md`） |
| UI 入口 | `sidebar.footer.action`（list / root，owner `{ wide }`） | `packages/client/ui-sidebar/src/client/contract/slots.ts`；外置插件可 `slots.inject+register` 填入 |
| UI 浮窗 | `shell.overlay`（list / root） | `packages/client/ui-layout/src/client/index.ts`；官方注释明确「要一个浮在整个应用之上的自有界面，注册进 shell.overlay」 |
| 触发浮窗 | local React state（由 footer action 组件持有 `open`），浮窗组件注册进 `shell.overlay` | 组件私有状态；无需跨入口 store（见 §6） |

---

## 3. DSH 插件机制（必要背景）

- **插件** = 实现某个 `ctx.<key>` 服务的对象。要么是带 `name`/`inject`/`apply(ctx)` 的函数，要么是
  `Service` 子类。生命周期由 Cordis 挂载到上下文；`inject` 声明服务依赖决定启动顺序；
  注册副作用用 `ctx.effect()` / `ctx.on()`，reload/teardown 时自动撤销。
- **服务藏在 ctx 键后**：`ctx.tokenMeter`、`ctx.sessions`、`ctx.sessionProjections`、`ctx.webServer`、
  `ctx.slots`、`ctx.storage` 等。插件按 key 取服务，而不是 import 具体实现。
- **事件通信**：`emit`（观察）、`waterfall`（环绕中间件，可短路）、`parallel`、`serial`、`bail`。
  监听器通过 `ctx.on(...)` 注册。
- **扩展点在文档里有一张「feature → mechanism map」**（`docs/cookbook/extension-cookbook.md`）：
  模型流式输出走 `agent/assistant-stream`，持久落账走 `session/event`，UI 走 `slots`。

### 关键：`dsh web` 是怎么组合出来的

- `dsh web` 是 `--profile web` 的别名（`apps/cli/src/args.ts`）。
- `web` profile = bundles `[ @deepseek-ai/dsh-base, @deepseek-ai/dsh-web-app ]`，`patchReload: live`
  （`packages/boot/app-boot/src/profile.ts` 的 `PROFILE_TEMPLATES`）。
- 每层 bundle 通过 `package.json` 的 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` 导出一个
  patch 层；加载顺序 = 各 bundle 层 → profile 的 `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` →
  `--patch` 覆盖层（`apps/cli/src/profile-boot.ts`）。
- `token-meter`、`session-projection`、`storage`、`storage-json`、`storage-domain` 都在 **base 层**默认挂载，
  所以你的插件无需自己挂 token-meter / storage，直接注入读取即可。

---

## 4. 总体架构

```
┌───────────────────────────── dsh web (host) ─────────────────────────────┐
│                                                                          │
│  session/event (durable, seq-ordered, exactly-once)                      │
│         │  assistant/message: usage: TokenUsage                          │
│         ▼                                                                │
│  dsh-tokbook host half  (TokenUsageBook service)                         │
│   ├─ 挂载回填：扫描既有会话，重放 / 读 tokenUsage 投影                     │
│   ├─ 实时：ctx.on('session/event', fold+persist)                          │
│   └─ ctx.storage (storage-domain 'tokbook')  ← 持久化                     │
│         │                                                                │
│         ▼ register({ kind:'exact', path:'/tokbook/*', handler })         │
│  ctx.webServer  ──── GET /tokbook/overview ─────────┐                     │
└─────────────────────────────────────────────────────┼───────────────────┘
                                                      │ HTTP fetch / SSE
┌───────────────────────────── Web Client (browser) ───────────────────────┐
│   dsh-tokbook client half (dsh.client + ./client bundle)                 │
│   ├─ inject: [slots, connection/remote, ...]                            │
│   ├─ 触发按钮 → ctx.slots.inject('sidebar.footer.action', register)      │
│   │      ↓ click 置 open                                                │
│   ├─ 浮窗组件 → ctx.slots.inject('shell.overlay', register)              │
│   │      ↓ useStore / inject 读 /tokbook/overview 数据                    │
│   └─ fetch('/tokbook/overview') or SSE                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 数据模型与持久化

### 5.1 数据来源：权威 = 通道上报的 `usage`

看 `packages/llm/token-meter/src/usage-projection.ts`：

- 每个 `assistant/message` / `assistant/attempt` 携带 `usage`（`TokenUsage`）：
  `inputTokens / outputTokens / cacheReadTokens / cacheWriteTokens`。
- DSH 已把这四桶在**整段会话**内做成 `tokenUsage` 投影：
  `uncachedInputTokens / outputTokens / cacheReadTokens / cacheWriteTokens`。

### 5.2 账本聚合粒度（tokbook 自己算）

建议以此作为账本行：

```ts
interface TokBookEntry {
  sessionId: string
  provider: string      // 由 request/header 的 envelope 解析
  model: string
  turn: number
  step: number
  time: number          // assistant/message 的 append time
  uncachedInputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
  totalTokens: number   // 四桶之和
}
```

上层再按需聚合（可按 session / model / 通道 / 天）。

### 5.3 持久化：`storage-domain`

base 层默认挂载了 `storage` / `storage-json` / `storage-domain`，且 `storage-json` 的 root 在
`dshHomePath('storages')`。你的插件：

- 声明一个 schema 校验的 domain（如 `tokbook`）。
- 每个会话存一份计数文档（per-session），外加一个全局/滚动汇总（或读时聚合）。
- 参考 `packages/bundle/base/cordis.patch.yml` 第 158-164 行：`session-projection-cache` 就是
  「每会话一个版本戳 checkpoint 文档」的现成样例。

> **不要用 `session-telemetry` 做记账**：`docs/subsystems/session-telemetry.md` 明确说明其记录
> 可能**丢失/重复**（best-effort handoff），且 dedupe 依赖 `(session.id, format_version, seq)`。
> 它适合监控上报，不适合权威记账。

### 5.4 回填与实时（读 DSH 权威投影，已按此实现）

- **已实现**：每会话总量直接读 DSH 自带的权威计量——`tokenUsage` 投影（四桶）+ `sessionStats`
  投影（turn 数），经 `ctx.sessionProjections.snapshot(session, ['tokenUsage','sessionStats'])` 读取；
  账本**不重复实现折叠、不会重复计数**。
- **实时**：订阅 `sessionProjections.onChanged`（`tokenUsage`/`sessionStats` key 变化时重读该会话），
  并监听 `session/event` 的 `request/header` 更新 `provider`/`model`（best-effort）。
- **回填**：挂载初始化遍历 `ctx.sessions.list()`，对每个会话 `_refresh` 一次，把挂载前历史即刻补进账本。
- **持久化**：`LedgerStore`（当前 `JsonLedgerStore` → `$DSH_HOME/storages/tokbook.json`），生产期望换
  `@deepseek-ai/dsh-storage-domain`。

---

## 6. UI 设计（外置插件即可落地，无需改 DSH 仓库）

这是本方案的关键点：**外置插件不能声明新 slot**（`Declare a new child slot only in the component that
owns and renders that location. Other packages wait with ctx.slots.inject() and contribute through
ctx.slots.register().` —— `docs/subsystems/slots.md` + `packages/client/AGENTS.md`），只能注册进**已声明**的槽。

### 6.0 侧边栏植入：两种主流方案对照（检索 GitHub 结论）

热门 DSH 插件往侧边栏放组件，主流是**两条路**，本项目选 **路线 A**。

#### 路线 A —— 走 DSH 官方 slot（“原生侧边栏”，本项目采用）

- 权威参考：[build-deepseek-harness-plugin / client-slots-and-theme.md](https://github.com/oil-oil/build-deepseek-harness-plugin/blob/main/references/client-slots-and-theme.md?plain=1)。
- 用 **已声明的 slot**：`sidebar.footer.action`（侧栏底部短操作，官方明确“优先于替换整列 sidebar”）+
  `shell.overlay`（壳层浮层，list/可叠加/位于所有列之上；官方点名“要浮在整个应用之上的框架级浮层先查这个槽”）。
- 社区 starter 模板 [kun2-5code/dsh-plugin-template](https://github.com/kun2-5code/dsh-plugin-template) 把浏览器侧 UI 拆成
  **14 个 surface**，其中就有 `src/client/sidebar-action.ts`（→ `sidebar.footer.action`）与
  `src/client/shell-overlay.ts`（→ `shell.overlay` 浮窗 pill）——正是「左下角入口 + 独立浮窗」的标准做法。
  - 该模板同时证明：这类“**纯 slot 注册**”在任何 harness 上直接生效（不同于设置卡片受 allowlist 限制，见 §11）。
- 优点：无需动 DSH、无第三方依赖、不绑版本、外置包即可落地。

#### 路线 B —— 走生态“注册表服务” `ctx.betterSidebar`（右侧工作台面板）

- 权威参考：[DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)（3.3k star，明确标
  「开放的侧边栏底座，支持三方拓展注册新侧边栏页面」，生态 28+ 插件）。
- 它**自建右侧栏 + 底部面板工作台**，开放一个 Cordis 服务 `ctx.betterSidebar`，消费插件声明
  `inject: ['betterSidebar']` 后用 `ctx.betterSidebar.registerTab({...})` / `registerFileViewer({...})`
  注册页面；`dsh-better-sidebar` 作为 **optional peerDependency**。
- **注意它的位置和形态与你要的不同**：这是**右侧面板**，不是「左下角入口 + 浮窗」；且有版本墙
  （v0.18.0 仅支持 DSH 0.1.2-rc.1+，旧 stable 锁 v0.17.1）和 `pnpm approve-builds --all` 门槛。

> **选型**：本项目采用 **路线 A**（`sidebar.footer.action` 按钮 + `shell.overlay` 浮窗）。何时转路线 B：
> 若未来想让 token 账本成为「那个侧边栏工作台」里的一等 tab，再以 optional peerDep 引入更好侧边栏。

**目标落点**（路线 A）：你要的「左下角设置按钮上方 + 点击弹出浮窗」刚好落到两个已声明的槽，**纯外置可行**：

### 6.1 触发按钮 → `sidebar.footer.action`

- 槽位：`sidebar.footer.action`，`{ kind:'list', scope:'root' }`，owner props `{ wide: boolean }`
  （`packages/client/ui-sidebar/src/client/contract/slots.ts`）。SidebarRoot 在 footer 里
  `renderSlot('sidebar.footer.action', { wide })`。
- 注册方式：`ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({...}, FooterButton))`。
  - `inject` 等待「声明已存在」，用 `slots.inject` 而非裸 `register`（裸 register 进未声明槽会报错）。
  - 组件收到 `wide`（false = 56px rail，true = 宽侧栏），据此渲染图标或 图标+文案。
- 点击：置本地 `open` state → 打开浮窗。

### 6.2 浮窗 → `shell.overlay`

- 槽位：`shell.overlay`，`{ kind:'list', scope:'root' }`（`packages/client/ui-layout/src/client/index.ts`）。
  `ui-renderer` 官方注释：**「要一个浮在整个应用之上的自有界面，就注册进 shell.overlay（list，additive，
  且在你的 entry 主动 opt-in pointer events 之前是 click-through）」**（`packages/client/ui-renderer/src/client/registry.ts`）。
- 浮窗是一个 `shell.overlay` 的 list 注册项，自绘卡片/弹窗样式，主动接管 pointer events。
- 数据：浮窗组件通过其注册 `inject` factory 拿到「从 /tokbook/overview 读到的账本数据 + 回调」，
  或用 register 声明的 `createStore()` 存浮窗开关/选中维度等共享视图状态。

> 复核结论：`sidebar.footer.action` 与 `shell.overlay` 都是 **list + root**，additive，外置插件可直接填入，
> 不必改 DSH。若未来想要「左栏常驻入口」而非 footer 按钮，才需要 in-repo 改 `ui-sidebar` 声明新子槽。
>
> **两个都是“纯 slot 注册”，在任何 harness 上直接生效**——不受下方 §11 那条「设置卡片 allowlist」限制
> （那是 `settings.plugin.item` 卡片的数据链路问题，与 footer 按钮/浮窗无关）。

---

## 7. 外置包构建（这是最关键的一道坎）

### 7.1 运行时——外置完全支持

- Cordis Loader 对每个配置行就是拿 `name` 走 **Node 自己的 ESM 解析**：
  ```ts
  // vendor/loader/src/config/tree.ts
  else { return await import(name) }   // 裸包名 → Node 按 ctx.baseUrl 向上找 node_modules
  ```
- client-module 系统（`packages/client/modules`）扫描启用的 Loader 行，读 `package.json` 的 `dsh.client`，
  并从该包自己的 `lib/client.js` 经 `/plugins/<id>/client.js` 提供。解析同样走 Node，**不分单仓内外**。

### 7.2 构建——外置包必须自己复刻懒加载 CJS factory

`clientBundle()` 预设只能在单仓用（它用 `globSync('packages/*/*/package.json')` 找 manifest），
**没有发布的 preset**（`docs/cookbook/adding-a-settings-card.md` 原话：*"No published preset exposes this
package, so a package outside this repository has to reproduce the same output format itself."*）。

`packages/client/tsdown.client.ts` 产出的格式是（你在 dsh-tokbook 里用一个自包含的 esbuild/rollup 脚本产出同样形状）：

```js
// intro
var module = { exports: {} }; var exports = module.exports;
// banner
window.__ModuleLoader__.load({
  id: 'dsh-tokbook',
  factory: (require) => {
    // ... 你的模块体（含 CSS 注入）。整包被包装在 factory 闭包里，
    // 加载时只注册 factory，materialize（真正执行模块体）时才运行。
    return module.exports;
  }
});
```

**基线外部依赖**必须与 `packages/client/web/src/platform.ts` 的 `PLATFORM_MODULES` 完全一致：

```
react, react/jsx-runtime, react-dom, react-dom/client,
@deepseek-ai/cordis,
@deepseek-ai/dsh-client-store,
@deepseek-ai/dsh-client-ui-slots,
@deepseek-ai/dsh-client-ui-primitives
```

**外置包必须自己维护的纪律**（单仓里由 `verify-client-packages` / bundle-purity gate 强制，外置拿不到）：

- 跨包类型一律 `import type`；绝不 runtime-import 另一个 feature 插件的值。
- 任何非基线运行时 `require` 请求，用 `package.json` 的 `dsh.client.external` 声明（`inject` 是信息性依赖边，
  不决定激活顺序）。
- `dsh.client` 必须 `platform:'web'` 且 `./client` 可解析（否则扫描要么静默跳过、要么对“声明了却没 bundle”的包抛错）。
- 发布前必须产好 `lib/client.js`（及 `lib/client.js.map` 便于排查），否则激活会因缺 bundle 而**亮声失败**。

### 7.3 也要有的 `package.json`（外置 client 包要点）

仿 `packages/client/ui-theme/package.json`：

```jsonc
{
  "name": "dsh-tokbook",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".":        { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./package.json": "./package.json"
  },
  "dsh": { "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-ui-slots", ...] } },
  "files": [ "lib/index.js", "lib/client.js", "lib/types/**/*.d.ts" ],
  "peerDependencies": { "@deepseek-ai/cordis": "workspace:^" },
  "devDependencies": { "@deepseek-ai/cordis": "workspace:^", ... }
}
```

### 7.4 Client 插件**不可加 default 导出**（cordis loader 行为，实测坑）

- 关键机制：cordis loader 取插件对象时用 `exports.default ?? exports`（
  `vendor/loader/src/index.ts` 的 `unwrapExports`）。若 client 入口有 `export default` 且
  default 指向 `apply` 函数，loader 就**拿那个函数当插件**；而函数身上**没有 `.inject` 属性**
  （`inject` 是模块的具名导出），于是 cordis 读出空 inject → 在 `apply` 里访问任何
  `ctx.<service>`（如 `ctx.slots`）抛 `cannot get property "slots" without inject`。
- 结论：client 插件只导出**具名** `inject` 与 `apply`，**不要 `export default`**。官方 DSH client 插件
  （ui-theme、better-sidebar）都是“无 default 导出”，正是为了避开这个 loader 行为。
- 验证：构建后可用 `scripts` 里的临时 Node 脚本物化 factory（stub `window.__ModuleLoader__`），
  断言返回值 `Object.keys(module)` = `['apply','inject']` 且**无** `default`。
- 区别 host/client：**host 半区的 `default` 导出是 Service 子类**（靠 `static inject` 声明依赖），
  host 用 default 是正确写法；只有 **client 半区必须走具名** `inject`/`apply`。

---

## 8. 接入 `web` profile 的步骤（外置）

1. 构建/发布 `dsh-tokbook`，确保含 `lib/index.js` 与 `lib/client.js`。
2. 安装进 web profile：`dsh plugin --profile web add <path-or-npm-specifier>`（会把包装进
   `$DSH_HOME/profiles/web/node_modules`；若它声明了 `dsh.bundle` 会追加进 `dsh.profile.bundles`，
   否则作为普通 profile 依赖——见 `apps/cli/src/plugin.ts` 与 `packages/boot/app-boot/src/profile.ts`）。
3. 在 `$DSH_HOME/profiles/web/cordis.patch.yml` 加一行（或 `dsh web --patch <overlay>`）：
   ```yaml
   - insert:
       - id: tokbook
         name: 'dsh-tokbook'
   ```
4. host 半区此时被 Loader 导入；client 半区因 `dsh.client` 被 `packages/client/modules` 扫描进
   `window.__DSH_BOOT__`，浏览器浮窗 + 入口按钮即出现。

> 注：为避免手工改 `cordis.patch.yml`，也可以把 `dsh-tokbook` 做成一个 bundle 包（声明 `dsh.bundle.patch`），
> 但那需要你把 patch 层也打进包里；两者见 §7 取舍。

> ⚠️ **client 改动生效方式（实测更新 2026-09-07，详见 [`HMR.md`](HMR.md)）**：DSH 的
> `/plugins/<id>/client.js` 按 `rev`（内容 hash）做**不可变缓存**，`rev` 启动时写进
> `window.__DSH_BOOT__`；但 `@deepseek-ai/dsh-client-hmr`（web-app 常驻挂载）会在运行中重哈希改写
> `rev` 并广播。所以（本机实测）：
> - `pnpm build` 落盘 `lib/client.js` 后，**刷新浏览器**即可取到新 rev 的 bundle（**主路径**）；
>   client-hmr 活着时也可能 ≤500ms 免刷新热更（加分项，非保证）；
> - 兜底/首次接线：**重启 `dsh web`** + **硬刷新浏览器**（`Cmd/Ctrl+Shift+R`）；
> - `pnpm run dev:web` 只重建 DSH 仓库内包，外置 dsh-tokbook 的重建 = 自己的 `pnpm build`；
> - 若当初是**打成 tarball/复制**装进 profile，profile 里的 `lib/client.js` 是旧的——改为**路径/link** 安装
>   （`dsh plugin --profile web add <abs path>`，或 profile package.json 写
>   `"dsh-tokbook": "link:<abs path>"` 后 `pnpm install`）。

---

## 9. 第一期（Phase 1）交付物清单

> **历史脚手架**，不是当前布局。现状文件树见 [`../README.md`](../README.md)「布局」——
> 二期/三期后 host 侧已拆出 `config.ts` / `usage-log.ts` / `stats.ts` / `pricing.ts` 等,
> client 侧浮窗拆成 `LedgerOverlay` + 各 tab 模块,样式在 `client/styles/*.ts`。

```
dsh-tokbook/
├─ package.json                     # 见 §7.3
├─ tsconfig.json                    # extends DSH tsconfig.base 风格；rootDir src, outDir lib/types
├─ tsconfig.client.json             # 若无；见 §10 说明
├─ scripts/
│  └─ build-client.mjs              # 自包含 esbuild/rollup，产懒加载 CJS factory（§7.2）
├─ src/
│  ├─ index.ts                      # host: TokenUsageBook service apply(ctx)
│  ├─ routes.ts                     # webServer.register exact routes (/tokbook/overview)
│  ├─ ledger.ts                     # 折叠 + 持久化逻辑（storage-domain）
│  ├─ types.ts                      # TokBookEntry / Config / 投影类型
│  └─ client/
│     ├─ index.ts                   # client: apply(ctx)，slots.inject+register 两处
│     ├─ FooterButton.tsx           # sidebar.footer.action 触发按钮（owner: { wide })
│     ├─ LedgerOverlay.tsx          # shell.overlay 浮窗
│     └─ store.ts                   # createTokBookStore()（若需跨入口共享视图状态）
├─ styles/                          # 若用 CSS Modules；外置需自编译
└─ docs/DESIGN.md                # 本文件
```

**第一期验证点**

- `dsh web` 启动后，左下角设置按钮上方出现 token-book 入口按钮。
- 点击弹出浮窗，显示跨会话累计 token（可先只做简单总览：input/cacheRead/cacheWrite/output）。
- 已发生过的会话在挂载后能被回填进账本（§5.4）。
- 重启后累计值不丢（storage-domain 持久化）。

---

## 10. 关键设计决策与硬约束汇总

1. **外置 vs in-repo**：运行时无差别；外置的**唯一硬阻点是 build**（无 preset，需自复刻 CJS factory）。
   若未来需要大量 UI 复用 DSH 内部模块或走生成 Remote，in-repo 会明显省力；本方案默认外置。
2. **host→浏览器数据通路**：用 `ctx.webServer.register({ kind:'exact', path, handler })`，不用生成 Typert
   Remote（外置插件难以贡献生成式 remote namespace）。实时可用 SSE（handler 可 `res.write` 保持长连接）。
3. **记账权威源**：`assistant/message` 的 `usage`（通道上报、持久、可重放、exactly-once）；
   不用 `session-telemetry`（可能丢/重）。
4. **UI 槽位**：只填已声明的 `sidebar.footer.action` + `shell.overlay`，**无需改 DSH 仓库**（路线 A，见 §6.0）。
5. **不要看 `dsh-costbook`**（已废弃/有问题的实现），不要照抄它。

---

## 11. 风险与后续

| 项 | 风险 / 说明 |
|---|---|
| 外置 bundle 格式 | 需自己维护基线 external 列表与纯净化纪律；DSH 升级若改 `PLATFORM_MODULES` 需同步。风险可控 |
| client 插件默认导出 | 不可给 client 入口加 `export default`（cordis loader `exports.default ?? exports` 会因 default 掩盖 `.inject`，报 “without inject”）。见 §7.4 |
| client 改动不生效 | bundle 按 `rev` 不可变缓存，但 `client-hmr`（web-app 常驻）运行中会重哈希广播；本项目 `pnpm build` 后**刷新浏览器**取新 rev（client-hmr 活着时可能 ≤500ms 免刷新热更，加分项非保证），兜底才重启 + 硬刷新。见 §8 / [`HMR.md`](HMR.md) |
| 跨重启幂等 | 用 DSH 权威投影（`tokenUsage`/`sessionStats`，见 §5.4），无自定义折叠、无重复计数问题 |
| 成本折算 | 本期不做；DSH `token-meter` 不算钱，需自建价格表（后续二期或独立 costbook） |
| 左栏常驻入口 | 本期用 footer 按钮 + 浮窗；若要「常驻左栏列表项」需 in-repo 给 `ui-sidebar` 声明新子槽 |
| 设置卡片（若后续做） | `settings.plugin.item` 卡片在 stock harness 上被 `WEB_SETTINGS_NAMESPACES` allowlist 卡住、显示“not exposed”；需在 `packages/host/apiproxy/src/api-proxy.ts` 加一行，或等官方把声明迁进 `settings.register()`。本项目 UI 走 footer+overlay（**纯 slot 注册，不受影响**），仅当后续加配置卡片时才需注意 |

---

## 附：参考资料索引（权威）

- Cordis 入门：`docs/cordis-primer.md`（同步版见官方站点）
- 扩展插件形态：`docs/cookbook/extension-cookbook.md`
- 新增 package 清单：`docs/cookbook/adding-a-package.md`
- 新增设置卡片：`docs/cookbook/adding-a-settings-card.md`
- Web Client 架构：`docs/subsystems/web-client.md`
- Client Modules：`docs/subsystems/client-modules.md`
- Web Client Slots：`docs/subsystems/slots.md`
- Token Meter：`docs/subsystems/token-meter.md`（+ `packages/llm/token-meter`）
- Session Telemetry：`docs/subsystems/session-telemetry.md`
- 外部插件装 profile：`packages/boot/app-boot/src/profile.ts`、`apps/cli/src/plugin.ts`、`apps/cli/src/profile-boot.ts`
- client 包约定：`packages/client/AGENTS.md`、`packages/client/tsdown.client.ts`
- 路由注册：`packages/host/webserver/src/index.ts`

## 重构说明：从「每会话聚合」改为「逐请求账本 + 成本」（第二期）

> 第 §5、§6 描述的是第一期（每会话聚合、不折算成本）的框架设计。第二期按
> `dsh-token-usage` 参考项目重构了 token 用量统计，**与第一期的差异如下**：

### 1. 数据源与粒度（覆盖 §5.2 / §5.4）

- **不再读 DSH 的 `tokenUsage` / `sessionStats` 投影做账本**（那是每会话聚合后的
  四桶，粒度粗、无法按天/条回溯）。
- 改为**监听 `session/event` 的 `assistant/message` provider `usage`**，每条付费
  模型调用记**一行** JSONL（`requestId` = assistant message id，去重键）；并额外记录
  `compaction/summary`（压缩 summarize 调用）、`turn/end`(error) 与 `llm/retry`
  （失败尝试，计入 `failures` 维度）。**没上报 `usage`** 的计费调用（中途取消的请求、
  没回报用量的 summarize）同样记一行、计入请求次数，但不加任何桶——它计入
  `usageUnknown`，用量明细的通道卡以「N 次没上报用量」报出（未知 ≠ 0，与「价格未知 ≠ 免费」
  同一条原则；金额仍按 ¥0 计，道理写在「统计口径」页）。丢行比「未上报用量」更不可查，所以两条
  路径都落行。`request/context` / `assistant/message` 用来
  维护会话最后已知的 `model`/`provider`，给失败行归属。
- 存储：**按本地日期的 `usage-YYYY-MM-DD.jsonl`**（`~/.dsh/tokbook/` 可配 `path`），
  追加式 + 串行队列 + 进程级 request-id 去重；`refileByEventDay()` 修正放错日的行。
- 回填：首次启动经 `ctx.sessionPersistence` 回放既有会话日志（幂等，注入缺失则优雅
  跳过回填、仍实时记录）；`initialized.marker` 门控，崩溃后可重跑（去重保证 no-op）。
  已对 `dsh` v11.9.0 实装源码核对：**当前 DSH 的 `sessionPersistence` 用
  `listSnapshots()`（返回 `{ header, revision }` 快照，revision 为 stat 派生的不透明
  变更令牌）做轻量列表；`list()` 只返回裸 `SessionHeader[]`（没有 `.header` 包装）；
  会话事件经 `inspect(id)` 读取，返回 `{ meta, events }`**（`dsh-session-persistence`
  的 `SessionPersistence` 抽象类 + `dsh-session-persistence-jsonl` 后端实现）。
  `assistant/message`、`turn/end`、`llm/retry`、`compaction/summary`、
  `request/context` 均为当前已知 `session/event` 类型（`core/session/src/known-event-types.ts`）。
- **读路径不 await 这次回放**（D-030，2026-09-15 实测后改）。探针只做廉价部分（列会话 +
  比对 revision），需要折叠时把 walk 排到后台并按 15 s 节流；`inspect(id)` 会把该会话的
  **整份日志**读回并解码（本机 `~/.dsh/sessions` 251 份 / 208 MB，最大单份 8.6 MB 压缩），
  而当前会话每条消息都会漂移——把它挂在读路径上就是「打开通道用量 / 价格表要加载半天」。
  账本本身的读只要 11–77 ms（真实账本 5.6 MB / 20.6k 行实测），那些行早已由实时 hook 记下。
  唯一例外是**冷账本**（一个日文件都没有）：那时读等一轮，否则「还没回填完」会被显示成
  「没有记录」。回归测试见 `scripts/selfcheck-readpath.ts`。

### 2. 统计聚合（新增）

`stats.ts` 在读取时把记录折叠为 `totals` / `byDay` / `byHour` / `byModel` /
`rateRows`（每 (day, model, rate) 一格，便于无重读地过滤与重新计价）。
冻结日前文件从磁盘 `rollup.json` 取，今天热文件实时读；解析后的日文件在进程内存缓存
（冻结文件常驻，今天文件按 size/mtime 重读）。

**按工作区不在折叠里**：账本行只记 `sessionId`，工作区是**读时连接**出来的（会话 header
的 `cwd` ↔ 工作区注册表的规范路径，见 `src/workspaces.ts`），因此它既不进 `rollup.json`
也不进 token-only 汇总——挂载点变了、注册表改了，下一次读取就是新的归属，历史一行都不用
重写（与价格层同一条思路）。

### 3. 成本计价（第三期 = 当前）

> 二期曾引入云端镜像 + 通道覆盖层 + 规则链;**2026-09-10 D-011 已整体删除**。
> 现状只有一份本机手工价表,本节只保留当前语义;完整推理与被取代的决策见
> [`DECISIONS.md`](DECISIONS.md) **D-011**(以及已 superseded 的 D-003…D-010),
> 接口见 [`CONTRACTS.md`](CONTRACTS.md),代码见 `src/pricing.ts`。

- **唯一价格文件 `pricing.json`**:路由 → 精确模型串 → **价段数组**。价段 = 四档 ¥/M
  (`inputPerMillion` / `outputPerMillion` / `cacheReadPerMillion` / `cacheWritePerMillion`)
  + **生效时刻** `from`(本地 `YYYY-MM-DD`,或**整点** `YYYY-MM-DDTHH:00`;省略 = 最早一段)
  + 可选的**峰谷时段**数组 `slots`(段内的第二级时间轴,**D-013**)。保留键只有 **`$billing`**
  (路由 → `metered` | `subscription`)。两级的语义与界面规格见 §3.1。
- **计价只看记录自己的时间戳**:取最后一段 `from ≤ 记录时刻` 的价;早于最早一段或没有价段
  = **价格未知**(¥0,不是免费)。`RateKey` 只存身份(价段生效日),`costOf` 按每桶单价计费,
  cache 桶无独立价则回退 input 价。改价在读取时重算全部历史,账本与折叠都不重建
  (`rollup.json` 带价格文件签名 `pricingRevision`,签名一变整份折叠作废)。
- **金额双桶**:`spend`(metered,实际支出)与 `subscriptionValue`(subscription,订阅价值、
  非现金);`totalCost` = 两者之和,兼容旧 wire。
- **价格表 tab**:每条通道路由一张卡(卡源 = 设置文档 ∪ 运行时适配器 ∪ 账本 ∪ 价格文件),
  卡内每模型一行:四档价 + 生效日期 + 调价史抽屉;没写的生效时间按该行**首记**(账本第一条记录)
  的整点锚定(`anchoredRow`,见 D-017),改动后约 0.6s 自动整表 `PUT /tokbook/pricing`。

### 3.1 价段时间轴与价格表界面规格（当前）

> 时间轴的**规则**由 [`DECISIONS.md`](DECISIONS.md) **D-013** 定、**画法**由 **D-019** 定,
> 字段与不变量见 [`CONTRACTS.md`](CONTRACTS.md)。本节收的是**界面规格与量出来的依据**——
> 它属于设计推理,不是决策记录,所以不放在决策日志里(否则每次查一条决策都要读一遍这些数字)。

**为什么价段是两级的。** 时间轴的单位是**整点**,因为官方调价公告本身就发生在 12:00 这种整点
上;而日内的峰谷价(DeepSeek「闲时价 + 工作日 9–12 / 14–18 高峰翻倍」)是**同一段价内部**的
第二级。所以价段 = 生效时刻 + 全天价 + 可选的峰谷时段数组,而不是把时段铺满 0–24:后者必须给
「有空隙」写一条校验,而「全天价 + 覆盖它的时段」让空隙的含义天然唯一(按全天价算),普通调价
也因此只填一个数字。代价写在 D-013:时段按本地时区判定、不跨日、分钟不是单位(向下取整到整点)。

**费率格与列头。** 费率列宽 **74px**,是全 tab 一条度量(`--dtpl-rate-w` + `--dtpl-cell-pad-x`,
定义在 `.dtpl-price-sec`)。**74px 的前提是这一列真的走等宽**——上一版漏了 `font-family`,数字按
比例体渲染,于是「64px 够用」这条按实测等宽数字推出的度量在真实字形下从来不成立,而且比例体把
`1.065` 与 `10.65` 的同位数字错开,固定列的可比对性也没了。补上等宽后按最宽的一档字体重推:
字宽 0.55–0.6em(本机 Consolas 实测八位 `0.003625` = 52.8px),加两侧各 7px 内边距与 1px 边框
= 68.8–73.6px,所以取 **74px** 覆盖最宽的一档。列头与数字共享 `--dtpl-cell-pad-x`,所以右端对齐。
调价史抽屉里四列**等分可用宽度**(它是表单,不是数据列),但每个输入框 `max-width:var(--dtpl-rate-w)`
——同一个「价」框在抽屉里与表格里保持同宽,不会出现 156px 的槽放 22px 的数字。

**行状态一态一记号,而且不用身份色。** 未保存 = **墨色**竖条、展开 = 中性提亮、聚焦 = 描边环。
未保存原本用 `--dtpl-accent`,但 accent 在 DSH 皮肤里等于墨色、换个皮肤又会变蓝——「这条还没落盘」
是一个**状态**,不该由在不同皮肤下会换色的身份色承担。聚焦仍然跟随 accent:焦点是**系统信号**,
不是这套视觉语言的一部分,键盘用户该看到自己皮肤里的那个焦点色。
面板底色的梯级写在样式分片的一处注释里:卡片 3%(与全窗口同一块面板配方)→ 展开行 7% → 抽屉只留
**实线**接缝 → 段块不透明 `layer-1` → 时段 3% 凹槽;卡片与抽屉各叠一层半透明会叠成同一个平面,
「段块」就会读成卡片本身。抽屉的接缝原本是虚线,而全窗口别处没有虚线——虚线会把它读成「还没画完
的框」,所以改回实线。

**峰谷时段的编辑态。** ① 时段可以**只写要覆盖的档位**(任意子集,至少一档),留空 = 沿用该段
全天价,而且格子里直接显示会沿用的那个数字——比「预填全天价」更省事也更不易腐坏(预填会把当前
全天价复制成显式值,日后改全天价不会跟着走),同时消掉了「`—` 一行表示没写价、下一行表示跟随」
的同符号反义。写入路径因此放宽:不再要求同时给输入价与输出价。② **没填完的块是草稿,不是错误**
:新增的价段 / 时段在写入前不参与校验、不进签名、保存时丢掉;只有**填了一半**(缺输入价或输出价、
小时不合法)才报错。③ 两个整点下拉**永远保持合法**(改一端则另一端跟随),「复制」按原时长挪到
旁边,而不是原地叠一个必然冲突的副本。

**信息的优先序(什么不许被截断)。** 「峰谷 N 段」「未生效」从会被省略号吃掉的信息行挪到徽章位,
与「价格未知 / 未保存」并列;峰谷时段行改用 accent 底以区别于全天价那一格;卡片头让**路由键**
(用户自定、长度不可预测)去省略,`已定价 N · 账本 N 次` 整个保留;单元格错误文案不逐字换行成
细长条(单元格内短提示 + `title` 全句 + 行下整行重复首条问题);行内四格的语义写在工具栏图例里
(「改行内四格 = 改写当前生效那一段的历史」),口径页同步补上两级计价——此前用户按「改价」直觉
敲进去的其实是**历史改写**。

**触摸与无障碍。** 展开 ▸ 是进入调价史的唯一入口(行本身不可点,费率格是输入框),它此前在
桌面是 **26×26、字形 10px 的三级色**,在窄屏才被撑到 44×44——同一个控件两套标准,而「唯一入口」
这个理由在桌面同样成立,所以那是漏了。现在把两件事分开:**字形尺寸全窗口一个值**(14px、
`--dtpl-fg-2`),只有**命中区按输入方式分档**(桌面 32×32,触控 44×44)。放大提亮而不加边框,
是因为每行一条新 1px 框会与「线有预算」相抵。它当时的对比度 **5.67:1** 本来就够,所以这不是
对比度问题——是「看不出它可以点」。
`ui-ux-pro-max` 数据集里命中的是通用条目(`compact-label-overflow` 只约束长度不可预测的值、
并给键盘与指针用户完整文本;`font-size-scale`、`table-handling`、`truncation-strategy`、
`number-tabular`、`elevation-consistent`)。四档价单元格是四个**真正的输入框**(Tab 依次走过),
折叠与「按量 / 订阅」开关是带 `aria-expanded` / `aria-pressed` 的真按钮;状态文本只留在顶部
工具栏里报,不遮挡任何控件。本仓库是桌面 Web 的 DSH 插件,**移动端 App 专章不适用**(安全区、
haptics、Dynamic Type、底部导航一律不引用);无障碍仍按 WCAG 口径查:触摸目标 ≥44、
焦点指示不遮挡控件、颜色不单独承载语义(状态同时有文字徽章)。

### 4. 前端（保留浮窗形态，内容升级，覆盖 §6.1/§6.2）

仍走 `sidebar.footer.action` 按钮 + `shell.overlay` 浮窗（纯 slot 注册，不受允许列表
限制），但浮窗内容升级为：一张**今日仪表卡**（卡首一条**角色插画**——占满卡宽、高度封顶、
下缘直边，D-035 / D-038；其下是**今日词元** + 较近 7 天日均涨跌参照 + **今日支出**，
再由一条 1px 分区线接**四桶**——每桶自带份额，四格相加就是主角数字，而占比尺与缓存命中率已由
D-037 撤掉）、**近 14 天趋势图**——
**用量总览只陈述今日**，累计事实的去处是用量明细的「全部」档（D-033）。

**三种切法在「用量明细」tab（D-031）。** 原「通道用量」tab 更名**用量明细**，页内是
**窗口 × 切法**。窗口作用于全部三面，所以换窗口时三面一起换、合计逐分对得上（host 侧三面读
同一批窗口记录，按模型与按通道更是同源）。**无行的切法不出现在子 tab 上**（没有工作区注册表时
「按工作区」整面不出现），**按通道那一面没有列头**（通道卡是「铭牌 + 卡身」两段式，列头会与
卡头打架，所以它的模型行自带 `.dtpl-sr` 列名）。累计视角由**全部**那一档给——搬走概览里
「累计的按模型 / 按工作区」因此不是丢功能。
金额恒以人民币（¥）展示。

**这一页的层级：分区词 → 合计 → 窗口 → 切法（2026-09-15 第二轮）。** 首版把窗口做成**另一条
tab 条**叠在切法条上面：两条 28/29px、都带底线实条、长得一模一样，读者分不出哪个是「这一页」、
哪个是「范围」（`DESIGN-SYSTEM.md` §4.8 本来把选择器分成两层，页内两条第二层把它抹平了）。现在三层各管
一件事：

- **分区词**＝`${窗口词}用量`（「近 7 天用量」/「全部账本用量」，与「近 14 天趋势」同一写法）——
  这一页陈述的就是某个窗口的用量，所以窗口自己就是它该有的名字；
- **窗口合计**紧贴标题**下面一整行**，用**事实带**的词汇与分隔符（请求 /
  词元 / 实际支出 / 订阅价值，11px，数字走等宽；这一串词汇原出总览 hero 那条累计带，D-033 之后
  概览不再有它，**它的家就是这一页**）。它同时替
  这一页回答了「这个窗口总共花了多少」——三种切法都只给逐行数字，读者本来要自己相加；
- **窗口**是贴在标题右端的**作用域控件**：「窗口」这枚可见标签 + 24px 小选择器（与额度页
  「自动刷新」同一档几何），不再是第二条 tab 条；
- **切法**是这一页**唯一**那条 tab 条（29px，横贯全宽、带底线），它下面才是数据。

**换窗口不跳屏（页头固定两行）。** 页头（分区词 / 合计 / 窗口）常驻：分区词立刻换成新窗口词，
合计位显示同高骨架条（不做「先显示旧数字再换」——那会让两块不同口径的数字在同一行上先后出现），
切法条沿用**上一次已知**的切法集，只有面板区换成骨架。切法还不知道时（首次加载）用一条与真
tab 条同高的占位条；**错误态**则把切法条整条收掉——一条点不动的切法条加一个空面板，读起来像
「这里没有行」，而真相是这一次没读到（错误块自己带重试）。
**合计单独占一整行是这里的关键**：它随窗口变宽变窄（实测 308–339px，四位数词元还更长），挤进
标题那一行就会把窗口控件推来推去，并在「一行 / 两行」之间来回折——实测那一次折行让切法条与整张
列表上下跳 **33px**（`layout-shift` 的源头正是页头与窗口控件）。固定两行之后，页头高度与任何数字
无关、窗口控件的右边缘永远落在同一个位置；另加 `.dtpl-body` 的 `scrollbar-gutter:stable`
（行数从个位数跳到上千时滚动条出现/消失，不留槽就是整块正文横向挪 8px）。实测五个窗口 ×
缓存/未缓存/加载中三种状态：页头、合计、窗口控件、切法条、列头、面板的 `getBoundingClientRect`
**逐值相同**，`layout-shift` 条目为空。窄屏同理：窗口控件钉成整行、合计改**两列网格**
（四个事实恒定两行，缺订阅价值时 2+1 仍是两行）。

**占比条的分母写在旁注里，比例读给读屏。** 条是这一页唯一没有数字的形状，它量的是「占谁的
多少」：按模型 / 按工作区归一到一个窗口（分母 = `totalTokens`），**按通道的条归一在各自卡内**
（分母 = 该卡词元，所以它才与卡头的合计对得上）。两处分母不同，旁注就分两句写
（「条为占本窗口」/「条为占本通道」）；比例本身进只给读屏的文本（`formatShare`，不足 1% 写
`<1%`、99.x% 不凑整成 100%，与份额读数（`formatHitRate`）同一条诚实规则），行内完整审计（四桶、请求/压缩/失败、
两个金额桶）进 `title`——与工作区行同一套写法。

**清单顺序服从它编码的量。** 模型行按**词元**降序——占比条编码的就是词元，清单若按别的键排
（这里曾按请求数），条长就不是单调的，整列读起来像渲染坏了；而「按请求数排」还得让读者去别处
找那个没显示的数字。`src/by-provider.ts` 早就按词元排，三种切法此后与它一致。排序发生在
**展示层**（wire 上的行顺序不是契约），所以预览 harness 里那份刻意乱序的 fixture 正好证明
排序真的发生了。

汇总卡的主角是**今日词元**：稳态下的第一眼要回答的是「今天算不算多」，所以主角是今日，并紧贴一条
**较近 7 天日均**的涨跌参照。基准取**不含今日的前 7 个完整日**（含今日会被今天自己拉偏，
涨跌幅失真）；账本历史不足 7 天或前期无用量时**不显示参照**，绝不编造基准；今日为 0 时
改显基线绝对值（百分比在零附近只是噪声）。参照行的涨跌**只靠 ↑/↓ 字形与字重**表达，不染色：
「比平时多」不等于「出事了」（用量是任务驱动的），而 `--dtpl-warn` 要留给真正的失败计数。

**卡内两区版式（总额 | 分解）。** 仪表区（上）是今日的总额，分两行：口径词一行（`今日词元` —
身份），主角数字与**同一基线上紧贴其后**的 7 天参照一行（参照是这张卡存在的理由，所以不再做数字
下方的灰色脚注）。D-038 试过把口径词并进数字那一行（省 25px，单行也确实更紧凑），但那一屏里最
便宜的就是这 25px，代价却是「这个数是谁」不再自成一行——首屏预算付得起，于是按维护者的意思还给
版式（见下「hero 首行是一条图」那段的预算表）。今日金额
是仪表区右侧「标签左、金额右」的双行块：两行共用一个宽度（该块的 max-content），所以标签左端成列、
金额右端成列。现金与订阅金额的区分从颜色改成**字重 + 标签**：现金升一档字重并升到主文本色，
订阅金额留在次要色并始终带着「订阅价值」这个名字（理由见下「现金与订阅金额的区分从颜色改成字重」）。
零消费仍占住该行，但用次要色。口径词那一行**只留身份**：命中率先前挂在这一行右端（一个比值挂在
口径词上，读者还得回头找它的分母），D-034 移到「缓存读取」那一格的标签行，D-037 起卡上不再显示它
（见下「四桶各自带份额」）。

**hero 首行是一条图，不是任何一层的背景（D-035），且高度封顶（D-038）。** 图是角色插画，
资产已裁到人物（940×237）。它占满卡的内容宽、比例由资产给（`aspect-ratio:940/237`），但戴一顶
`max-height:140px` 的帽子：宽处自然高度 168px，帽子削掉 28px——上下各切掉一点空边（焦点
`center 40%`），人物与构图仍是整幅；窄处自然高度不到 140px 时**整幅取景原样落地**、两边都不裁
（@420 的 95px 正在此列），左右上三面用 `-16px` 外边距抵掉卡的 16px 内边距、与卡沿齐平：它因此是
**卡的首面**，不是卡里的一张插图。下缘是**一条直边**——试过给最后
两成做渐隐（mask 落到卡面），浅色皮肤下那条淡出带把图的下半糊成灰雾、人物也散掉，所以撤回了渐隐。
它排在仪表区**之前**：图与字各自完整，互不重叠。先前把图当仪表区那一层的背景时，浅色皮肤下
36px 的主角数字正压在图的深底与人物白发上，`169K` 与『今日词元』读不出来（六版对比：退到 35%
才勉强能读，那时图也没剩多少）；卡中、紧接仪表区下方、卡尾三种位置也都试过，都被否决。
图不铺到四桶读数格那一行——那里四个数字与四份份额都要读。
**为什么封顶、封在哪：** 这张卡存在的理由是「今日词元与近 14 天趋势在一屏里读完」，而读数窗的
可视高度只有 539px（卡 680 − 标题 − tab − 页脚）。把这份预算逐项摆开——页内上下余白 38 + 图带
140 + 两处 12px 间距 24 + 仪表区两行 67 + 读数格 69 + hero 自己的下内边距与上下边框 18 + hero 的
下外边距 20 + 趋势 159 = **535 ≤ 539**。
168px 的图带让这个和溢出 24px，被裁掉的正是趋势图；把趋势节末那条不指向任何东西的 20px 外边距
归零之后，图带还能留 140px（再多就没有余量了）。**帽子的值由这份预算定，不由审美定**：装饰没有
被要求最小化，被要求的是**两件都完整**。
卡高因此 233 → 397px（D-035 实测）→ **318px**（1404px 预览台实测；@420 是 390px）：
D-036 撤掉今日异常行 −29px，D-037 撤掉每格那条占比尺 −14px，D-038 压图带 −28px、读数格 −7px、
趋势节末外边距 −20px，而口径词那一行（+25px）回来了。骨架屏随之 307 → 277 → 250px、读数格那一格
90 → 76 → 68px——两张骨架块相加仍等于实物卡高（250 + 68 = 318）。
代价（明说）：① 图的深灰底是两个主题下它自己的底色，浅色皮肤下就是一条清楚的深色块（不融进卡面）
——直边是有意的；② 资产内联进 browser bundle（≈63KB base64，bundle 315KB → 378KB）——client 半区
只有一个产物、没有静态目录，这是「图跟插件走」唯一不引新机制的做法；③ 卡左上那枚角括号现在恒压在
图上，所以它单独取浅墨（随 `fg` 走的深墨在浅色皮肤下压在深图上等于没有），右下那枚底下仍是卡面、
照旧随 `fg`；④ 宽处的取景少了上下各一点空边（28px，人物与构图仍完整），@420 那类窄处没有这笔代价
（整幅落地）；⑤ 趋势节末那 20px 外边距此后为 0——本 tab 的最后一节不再与「下一节」拉开距离，
页内那 20px 下余白就是它全部的呼吸，**换图或改首屏内容时这 20px 是第一个要重算的数**。

**四桶各自带份额，而那排格子就是主角数字的构成。** 每格是两件事：桶值（20px 等宽）与**份额**
（占今日词元——分母就是上面那个主角数字，`hero.tokens`，与它严格同源）。这不是给读数格加装饰，
而是修掉一处口径缺陷：`totalsTokens()` 把四个桶加成**一个标量**印在主角位，于是「今日词元」这个
名字（我发过去了多少）与这个数（通道计费了多少词元，含同一段上下文的每一次重读）不同义，而四格
里有一格（缓存读取）常年与主角数字重合——读者看不出这个数是怎么来的。份额把这层构成放回卡上：
`40K 占 23.6%` / `120K 占 71.0%` / `9K 占 5.3%` 相加就是主角数字，**量的零与精确值仍由数字给**
（份额走 `formatHitRate` 截断到一位小数，0.1% 而不是 0%），而份额自己带「占」字：它是值行里唯一
的百分比，这个「占多少」原先只有一个 `title` 在解释。

**每格那条 2px 占比尺与缓存命中率都已撤掉（D-037）。** 尺的臂长就是它旁边那个份额数：它不承载
任何独有信息，只是在同一个数上再画一遍形状；而这张卡的份额分布**天生退化**——缓存读取常年 95%
以上，另外两三根臂只有一两像素，一屏看下来是「一条长尺 + 两粒噪声」。它占的也不是白来的位置：
每格 9px 外边距 + 2px 尺 + 一条恒为 100% 的轨，四格就是四条一模一样的底衬。要读构成，卡上的份额
数已经说全了。**命中率同理**：它在缓存密集的账本里与同一格的「缓存读取 占 x%」往往只差零点几，
两个百分比并排（`.dtpl-stat-rate` 曾挂在那一格的标签行右端）只会被读成一个数印了两遍——那正是
D-034 把份额写成「占 71.0%」想解决的毛病，只是换到了格子内部。定义与分母留在「统计口径」页，
卡上不再复述。

两区之间只隔一条 **1px 分区线**（`--dtpl-border`，四桶读数格的上边框），线下是**读数格**（四桶）。
分区线走注册过的边界 token，与页脚、tab 条、面板轮廓是同一种线。
两区同处一只框，因为它们本来就是**一个陈述**——总额与它的分解；分开时是「一个事实两只卡」，
而**另一个窗口**（累计）反倒挤在 hero 里，正是「两个窗口一只卡」。D-033 之后反过来：
一个陈述一只卡、一个窗口一块内容。

**概览不再有「今日异常行」（D-036）。** 失败与「没上报用量」的次数此前占一行 `.dtpl-hero-alert`：
只在今天有失败或未上报用量的调用时占行，数字走 `--dtpl-warn-ink`，前面钉着「今日」这个分区词，
判据是「它们只在**发生的时候**可行动，累计值既不及时也没有分母」。2026-09-16 整行撤出概览——它讲
的是一天里出过的事，而这两件事各自另有**按行 / 按卡**的去处：失败数在用量明细的工作区行内
（`.dtpl-ws-fail`，同一档 `--dtpl-warn-ink`），未上报用量在通道卡的请求行。
代价（明说）：概览不再就地报今天的失败与未上报用量，要判断「今天出没出事」得切到用量明细
（窗口选今天，那里按行报）。

**累计事实整条撤出概览（D-033）。** 累计请求 / 词元 / 实际支出 / 订阅价值此前占 hero 发丝线下
一条次要行，理由是「只在首访时证明账本确实在记账」；但它天天占位，而它**永不触发决策**，同一个
窗口在**用量明细**的「全部」档里本来就有（同一组词、同一条事实带，D-031）。所以这条行整条删除
（wire 仍带 `total` / `totalTokens` / `spend` / `subscriptionValue`，宿主载荷的瘦身是独立一轮）。
代价（明说）：今日为 0 且账本历史不足 7 天时，概览只剩「今日词元 0」加一句「今天还没有记录」，
要与「账本坏了」分开就得切到用量明细。窄 sheet（≤640px）的堆叠规则不变。

**视觉方向：明日方舟：终末地 风格（直角 + 硬边 + 金属 + 品牌黄 + 仪表构件）。** 决策过程见
[`DECISIONS.md`](DECISIONS.md) D-025 与 D-027，**特质检索与出处见本节末尾「风格取自哪里」**。
六条特质落到整扇浮窗——**五个 tab 共用同一套语言**，没有哪个 tab 长出自己的面板或自己的「选中」：

- **直角与硬边。** `--dtpl-radius*` 归零，并把 42 处硬编码圆角一并收敛回 token。hero 回到
  1px 硬边框（四桶自 D-033 起是它卡内的读数带，不再自带边框）；卡片四角用 `::before`/`::after` 画 L 形括号，**不用 `clip-path` 切角**——切角会连子元素
  的焦点环一起裁掉，而括号只画边框，控件与焦点环都不受影响。例外只有三处**真圆**：侧栏按钮（宿主
  slot 的地盘，插件不越界改它的形状）、状态灯（同步点、告警角标、芯片前置点）、额度表盘。轴上的
  刻度点**不是**灯，所以它是方的——它和趋势图的柱同属数据图形。
- **金属，走 1px 的机加工边。** 终末地的底材是「金属、管线」，所以面板的边不是一条印刷线，而是
  一块机加工面在**受光边的反光**加**背光边的投影**（`--dtpl-metal`：`inset 0 1px` 白 7% +
  `inset 0 -1px` 黑 12%）。两个方向都用固定黑白，于是深色面上只有顶部那道亮线读得出来、浅色面上
  只有底部那道暗线读得出来——同一套材质，两个主题各自成立，不需要为深色补第二条规则。它**叠在
  1px 硬边框之内**：外轮廓由 `--dtpl-border` 单独负责，材质与边界是两件事，不许一条半像素阴影
  同时充当两者（上一版四个 tab 用的正是 `.5px` 内阴影 + 4% 洗色，边是糊的，整屏读起来像一叠卡片）。
  强度压在 ≤12%：要的是「金属」，不是高光。
- **品牌黄是「料」，不是「线」。** 这是这一版最关键的一条工程约束：一个**恒定**的黄在物理上无法
  同时当浅底与深底上的线条色——`#FFCD00` 压在白卡上只有 **1.57:1**，做 1px 分隔线、做浅底上的文字、
  做细柱都会糊掉。所以恒定只落在**实心块**上，凡是出现黄的地方都自带墨边或墨色内容（工业标识本来
  就这么画：黄牌 + 黑字/黑边）：
  - 当前页标记 = 5px 黄块 + `inset 0 0 0 1px` 墨边（边界由墨边给到 ≈18:1）；
  - 峰值柱 = 70% 前景墨的高亮块 + 墨边（柱身无黄），黄是它旁边那枚 4×8px 黄牌；
  - 工业徽记 = 节标题前 7×13 的黄牌 + 墨边（**反复出现**的那枚标记——终末地把「终末地工业」的
    Logo 及衍生图形铺在每个系统面板的头部，这里用同一手法；它是**抽象替身，不是鹰角商标的复刻**）。
    「统计口径」的编号小节用同一枚徽记装序号（黄牌 + 墨色数字），所以「第几节」也是这套记号的一部分。
  用量压到这三处。**这条预算管的是面积，不只是处数**——三处里最大的那一处曾独占全 UI 黄面积的
  ≈97%，见下文「黄的面积预算」（D-029）。**剩下的颜色继续跟随主题**：底色、文本色、状态色全走 `--dsw-alias-*`，所以插件
  在浅色与深色皮肤下都成立，而黄的形态在两个主题里是同一套。
- **母题要匹配它占的那块地方——hero 的等高线因此撤掉了。** 原先 hero 右上角铺一片等高线底纹
  （D-025 选的签名图形）。它试过两版：CSS 同心环，和一条真正的等值线 SVG 路径。第二版技术上
  是对的——同一个 h 只有一个水平集，所以线永不相交、线宽恒定、疏密随坡度自己变；放大到 4× 看，
  它确实是一张地形图。**问题不在形状，在于那块地方放不下这个母题。**
  hero 里唯一空着的是右上角一条带子，而它被金额块顶死：金额块**有两行**（实际支出 + 订阅价值）、
  底对齐在口径词那一块，实测两行时它的顶边落在 hero 的 45px 处（一行时 63px）——所以带子最多
  38px 高。把等高线硬解到 240×38 里，曲线就退化成几根近乎平行的短弧。**等高线地图只在「线足够
  多、能围出闭合的圈」时才读成地形**；几条互相不搭界的弧读起来就是「孤零零的几条线」，比不画更糟。
  改参数救不了——那是母题与位置的错配。
  所以 hero 换上**放得下的结构件**：一条贯通全宽的**刻度轨**（`1px` 三层刻度 + 一条
  基线，8px / 40px / 200px 三档，全部走墨色）、四角里补上左上与右下两枚括号、口径词前补上那枚
  **工业徽记**。最后一条顺手修掉一处真实的不一致：窗口里每个节标题都带黄牌，只有 hero 的「今日词元」
  没有。**刻度轨本身在 D-034 又撤掉了**：它没有量程、不承载任何读数，却占掉卡最底一条信息位与
  10px 的下内边距，而它能提供的仪表感已由 1px 硬边框 + 对角两枚括号给足（那句「向左淡出与右下角
  括号合成一条边」只在论证一条装饰线如何自洽，不构成它值得占位的理由）；腾出的高度回给读数格。
  括号与徽记两样留下——**每格那条 2px 占比尺此后也在 D-037 撤掉**：它编码的数就印在旁边，
   是重复编码而不是量尺。
  **刻度的黄必须省掉**：黄是「料」不是「线」，1px 的黄在白底上只有 1.57:1，
  做刻度线会直接消失——黄在这一屏只留给口径词那枚徽记（仍在「三处」预算之内）。
  等高线本身**整个插件里都不再出现**：它退回到 Logo / 徽记那一层，而面板上用的是括号、份额数与铭牌。
  （另一条备选是把它铺满整块 hero 当低对比度底纹——那能保住签名，代价是纹理从数字底下穿过，
  实测可读性仍可接受；维护者选了结构件这条。）
- **字体保守，不做字体文章。** 终末地的原话是「字体使用太保守，没有使用在字体上下功夫，好处就是
  不像某些使用粗体字的压根看不清」。所以上一版的衬线、拉丁装饰铭牌（`TOKEN LEDGER` / `TODAY` /
  `INPUT`…）与中英混排**全部撤掉**；只有数字走等宽体——那一条留的是工程语境而不是装饰，等宽还附带
  一个实利：位数变化时整块不抖，而且**固定列的可比对性本来就以等宽为前提**（价格表的费率列是这条
  的实际受益者，见上）。上一版「通道用量」的合计数字漏了这条规矩，是全窗口唯一一处比例体数字。
- **仪表构件。** 面板的工业感来自**结构件**，不是贴图：hero 四角补左上/右下两枚括号、
  口径词前一枚黄牌徽记。两样都编码了形状或量，没有一处是纯装饰——另两样各有被撤掉的理由：
  卡下沿的贯通刻度轨**没有量程**（D-034），读数格里的 2px 占比尺**重复编码**了旁边那个数（D-037）。
- **一行数据要么是表，要么是段落——「用量明细」改成了表。** 它的按模型那一面此前是两个 tab 标签直接接一叠
  两列段落：没有分区词与徽记（全窗口唯一一节），也没有列头，靠逐行重复的「通道」「订阅价值」
  说明列是什么。两个**实测出来的缺陷**是把它推向表的原因：

  1. **占比条的分母逐行在变。** 身份格是 `flex:1`、右边数字格 `flex:none`，于是每行的轨道宽度
     = 区块宽 − **该行金额文字的宽度**。实测轨道在 **511–577px** 之间摆动（13%），后果是
     `deepseek-v4.1-flash-expires-on-0910`（806.4M）的条比 `deepseek/deepseek-v4.1-flash`
     （830.3M）**更长**。DESIGN 早就写过这条轨道是「占谁的多少」这句话里的分母；分母自己每行
     不一样，占比条就失去了它唯一的存在理由。
  2. **金额列读不成一列。** 「订阅价值」是数字**后面的行内后缀**，有订阅的行把数字推左、没订阅的
     行顶到右边缘，实测两行的 `¥` 数字右边缘差约 55px。

  做法：列头（模型 / 通道 · 词元 / 金额）与数据行**共用同一条两列网格**
  （`grid-template-columns:minmax(0,1fr) var(--dtpl-row-nums-w)`），于是两列宽度由网格定死，
  轨道改为横跨整条网格（`grid-column:1/-1`）⇒ 每行 657px / 670px，实测**只有一个值**；
  「订阅价值」改成金额格里一枚**固定宽度的槽位** ⇒ 实测所有行的金额右边缘
  只剩**一个**值。这枚槽位后来**永远填着该行金额的桶名**（现金行写「实际支出」，不再用
  `visibility:hidden` 藏一枚「订阅价值」占位——占位可以藏，名字不能：同一格里一个数有名字、
  另一个没有，读者就无从判断后者是哪个桶）。工作区跨通道、两桶可同时非零，那是金额格里的
  **两段**「数额 + 桶名」并排（段之间用这个窗口表示「一串事实」的 `·`），不是一段里塞两个
  没名字的数；一段或两段都右对齐、共用同一条桶名槽位，所以**最右那一段的数额**与单桶行
  落在同一条竖线上；两者都无话时用一枚零撑住格子（「价格未知」是口径，不是免费）。
  金额列因此按**这一列里最宽的那种内容**定宽（`--dtpl-row-nums-w: 224px`）——工作区行的
  两段实测 223px，按模型行只要 ~90px，按宽的定，窄的那一面只是多留白。
  列头是**一行**：「模型 · 通道」/「词元 · 金额」——两列各是一串上下叠起来的
  事实，所以列名也照同样的先后写成一对，分隔符用的是这个窗口里表示「一串事实」的 `·`。
  这里踩过一次：列头最早照数据的**两行**写成两行（模型、通道 各占一行），好处是标签精确
  落在各自数值正上方，代价是四枚孤零零的标签占掉两行、中间大片空白——**表头比它标注的数据
  还高**（41px），维护者一眼看出「这里有双层」。改一行之后剩 27px，牺牲精确对位换回它像
  一行表头。通道仍由列头命名，行内不再重复「通道」两个字。
  **轨道同时取代了行分隔线**：此前每行尾部两条横线（16% 的轨道 + 6% 的发丝线，重量差 2.7 倍）
  读起来像「文字下划线 + 表格线」，现在一行一条线，而这条线承载分母。
  窄屏（≤640px）按价格表 `列头` 的先例**收掉列头**、行改单列堆叠、数字改成身份下面横排一行
  （词元靠左、金额靠右）——两列网格在 ~390px 宽上会把身份列压到 ~130px，模型名与工作区目录
  都没地方站。同一段窄屏规则里还把**子 tab 撑到 44px 高**：窄 sheet 是触控形态，而那一行
  是切换这一页视图的**唯一**入口；29px 过得了 WCAG 2.2 的 24px 底线，却离触控的 44px 差得远。
  同一张面板里价格表的展开钮早就在窄屏拿 44px，两种标准并存是漏了、不是取舍。桌面不动
  （实测表头 30px、tab 29px）。窄屏上分区词那一行**允许换行**（`flex-wrap`）：徽记 + 窗口词 +
  三枚子 tab + 旁注在 360px 上挤不进一行，旁注落到自己那一行右对齐，而不是顶出卡片。

  **两处只限「不可预测的那一半」。** ① 金额格里的桶名是一段**固定**的字（「实际支出」/「订阅价值」，
  四个汉字、同宽），所以它拿 `white-space:nowrap` + `min-width`（不是硬 `width`）：宽度在每行里都是
  同一个 max-content，数字右边缘照样对齐，而标签既不会折行也不会被裁。被限宽 + 省略号 + `title`
  兜底的是**数额**——它才是会变的那一个。② 表头在视觉上命名了每一列，但读屏读不到表头与单元格的
  对应关系，所以每个格子自带一枚只给读屏的列名（`.dtpl-sr`：「通道 commandcode」「词元 830.3M」
  「金额 ¥3.87 实际支出」）。**这是修一处自己引入的回归**：上一版把行内的「通道」两个字连同
  表头一起 `aria-hidden`，等于从无障碍树里删掉了「commandcode 是什么」。

  **行不加 hover 底洗色。** 这些行不是可点的，`hover` 反馈在交互元素上才成立；给静态行加悬停
  底洗色会造出一个假的可点承诺（触屏上也根本触发不了）。

  **这条行组件是跨面共享的，所以它的度量挂在插件根上。** 用量明细的按通道那一面复用同一套
  `.dtpl-row` 网格，但右列宽原本只定义在按模型那一节的父元素上，于是那一面取不到它、
  `grid-template-columns` 在计算值阶段整条失效、悄悄回落到单列——实测行高 **75px**（两列时
  **38px**），同一个类在同一个窗口里长得完全不一样，而这一点从截图上只表现为「这一屏的模型行
  比较高」，看不出是失效。变量因此移进 tokens 片段并改名 `--dtpl-row-nums-w`（它约束的是
  「行」，不是「明细」那一节）；通道卡的模型行回到「身份 + 数字并排、轨道在身份列下」的两列
  形态，实测轨道恒为 **410px**（分母不再随行变化，右列格最宽 135px，未溢出 224px 的列）。

  **工作区那一面有两处行内落差，都被当成状态而不是排版噪声处理。** ①**失败数染色**：请求数是
  读数、失败是「这里看一眼」的状态，所以只有它拿 `--dtpl-warn-ink` + 600（裸 `--dtpl-warn`
  在 11px 正文上只有 2.15:1）。②**「未归属」
  用一条发丝线从上面的工作区清单里分出来、标题降到次要色**：它是对账行不是项目（D-018），
  既不参与「最近有操作在前」，也不该读成一个工作区；行内其余排版（词元 / 金额 / 占比条）
  一字不动，因为它的量本来就要能加回累计。
- **克制，而且色相是一笔预算。** 面板自己不加戏：hero 只有一条边框加那三样构件，
  没有警戒条纹、没有网点、没有斜线影、没有渐变。**默认状态不染色**：占比条、额度条与额度表盘的默认填充都是墨色
  （`--dtpl-fg-2`），只有 warn / danger 才带色相——如果默认状态就是绿的，绿只是「条的颜色」不是
  信息，三根绿条还会成为整屏最响的东西。同理，分类（按量 / 订阅、仅账本 / 峰谷 N 段、记了 / 没记）
  一律由**边界与填充**表达，色相只留给真正要看的状态。屏幕上的每一处色相因此都意味着「这里看
  一眼」，而唯一恒定的色相是品牌黄。

**风格取自哪里（检索记录与出处）。** 上面六条逐条追得到原文。两篇原始分析所在站点都有反爬，
本轮用本地浏览器读的正文：

- **黄 / 黑 / 白是工程机械的配色传统，不是审美偏好。** 黑白灰为基色、黄只做点缀，这个组合的
  源头是卡特彼勒（Caterpillar）的「卡特黄」：黄与土色相近、耐脏，黄黑相间辨识度高且**带警戒
  意味**，作用是在大量颜色里脱颖而出、让人保持距离。原文举的用例全在**信号位**上——干员选择
  界面顶部高亮当前选中、左侧标出该干员最高的一项能力值、小地图用黄外发光标出玩家自己、任务用
  黄高亮待办项、装置面板的「全部收取」按钮。**这就是黄被压到「当前页 / 峰值 / 徽记」三处的
  依据**：它在这套语言里本来就不是装饰色。
- **小面积点缀是防视觉疲劳的手段，而第二个色相没有位置。** 右侧大面积用黄是为避免与左侧排版
  雷同造成的视觉疲劳；黄也可以反用作**背景**，把黑 / 灰主体从背景里拉出来。本插件取前半条
  （用黄打破重复），没取后半条（浮窗里没有整块黄底的位置，大面积黄底在窄窗上会吃掉可读性）。
  终末地另用品红、绿的小色块提活力，原文判定它们是**印刷色标（Color Bars / CMYK）的抽象化**
  ——一个具体的「工业感」来源；本插件**不引入第二个色相**，那层意思改由工业徽记与刻度承担。
- **UI 的理念是「内化」，不是「操作菜单」。** 主菜单在设定上是「管理员调用的协议菜单栏」，
  打开它不该产生「我在操作游戏菜单」的疏离感。手法是三条：次级界面**极其干净冷静**，不用光效
  与繁复装饰填满屏幕，**大面积留白、只保留最必要的信息和按钮**；动效要**符合逻辑**——切换与
  点击的过渡是「因为发生了这件事」，而不是「为了好看」；跨端（触摸 / 键鼠 / 手柄）三套输入各有
  自己的布局逻辑与反馈机制。本插件取前两条：它们就是这套面板「不加戏、色相是一笔预算」的来源。
- **字体保守是终末地的自觉。** 原话是「字体使用太保守，没有使用在字体上下功夫，好处就是不像
  某些使用粗体字的压根看不清」——所以上一版的衬线、拉丁装饰铭牌与中英混排全部撤掉，只留数字
  等宽。
- **金属和品牌黄同级，都只做点缀。** 原文对面板配色的一句是「以黑、白、灰基色，以及用一些
  金属色稍加点缀，以及终末地特有的黄色」——所以「金属」不是修辞；本插件把它落成 1px 的机加工
  边，而不是把面板刷成金属色（见上）。
- **分区线与量尺是两件东西（第三轮检索）。** 社区按终末地风格实现的那套组件库
  （ReEnd-Components，MIT，把「Endfield aesthetic」逐条落成 CSS 原语）里，**分区**的原语是
  `gradient-line-h`——一条 1px、**两端对称淡出、中间最亮**的线；而刻度 / 量尺这类东西只出现在
  数据图形构件里（`FrequencyBars`、`MatrixGrid`、`StatusBar`、`CoordinateTag`），没有任何一处
  拿刻度去当两个内容区的边界。本插件把「分区线」（1px `--dtpl-border`）与「刻度轨」（数据图形
  那一类）分开正是这条的落地——D-033 初版把两者合并过一次，同一轮就否决了（见上「仪表构件」）。
  同一份原语还独立印证了两条既有判断：它的角括号 `.corner-brackets` 也只画**对角两枚**
  （`clip-corner` 切的是右上 + 左下），与「四角补全会读成相框」同一条；它的主色 `--ef-yellow`
  在深底是 `48 100% 58%`、浅底是 `42 90% 42%`——**同一套设计系统自己给了两个黄**，正是本插件
  「恒定的黄不能同时当浅底与深底的线」的旁证。**它做而本插件不做的**：`clip-path` 切角（会裁掉
  子元素焦点环）、发光、毛玻璃、扫描线底纹与一整推动效——不是「终末地没有」，而是本插件的前提
  （跟随 DSH 两套皮肤、浮在宿主之上、不自作动效）不允许，逐条理由见上。

**一处更正。** D-025 的检索结论写着「② 界面以**亮白**为主，且没有深色模式」——这两句在上述
原文里**没有依据**：原文对面板的描述只有「黑白灰基色 + 一些金属色稍加点缀 + 终末地黄」，没说
底是亮的还是暗的。所以本插件「颜色继续跟随 DSH 主题」不是违背终末地，而是在自己的前提（宿主
有浅色与深色两套皮肤）上做的取舍；把它当成「终末地没有深色模式」的推论就不成立。D-025 的决策
正文不受影响（那条只关乎黄的用法），此处只更正那句检索结论。

**出处。** ①《【笔记】浅谈明日方舟：终末地的设计-vol.01 色彩运用》B 站专栏 `cv40133328`
（平面设计视角：黄黑白的工程血统与全部用法实例）；②《鹰角还是那个鹰角》知乎专栏 · 游戏茶馆（试玩纪要：画内 / 画外的划分、主 UI 的「内化」、次级界面的留白、跨端输入与动效手感）；
③ [VBeatDead/ReEnd-Components](https://github.com/VBeatDead/ReEnd-Components)（把「Endfield aesthetic」
落成 CSS 原语与 token 的社区组件库，`src/styles/utilities.css` 与 README 的 token 表——「分区线 vs
量尺」那条判据的出处，也是「两个黄」的独立旁证）；④《终末地是怎么把界面做出工业高级感的？》
（什么值得买转载，源自小红书：高级灰 + 少量黄点缀、点线面几何装饰、克制的动效）。

**柱的灰取墨色 45%**（白底 3.04:1、深底 3.97:1）：柱高是这张图的正文，30% 在白底上只有 1.99:1，
过不了 3:1。**峰值柱取 70%**（D-029）：峰值最亮的那一层从此由**明度差**给，不再由色相给。文字侧同理：标签与
口径注释全部留在 `fg-2`（≈5.8:1），安静由字号、字距与留白做，不靠把字洗淡到读不清。

**趋势图补上了「构件」，它此前只是一组纯色块。** 这张图是全窗口唯一的**数据图形**，而它此前连柱子
本身都是裸矩形。补的两件结构件，与 hero 那套语言同一手法：

- **柱顶盖片 + 峰值黄牌**：柱顶 1px 受光边（墨 22%）对应面板 `--dtpl-metal` 那道机加工受光边，
  峰值柱再加一枚内侧墨色顶部盖片；盖片按 3% 高度写，2px 柱上被 `overflow` 裁掉、只剩受光边，
  不会缩成一团。峰值那枚**黄牌**（4×8px，节徽记的 0.6 倍，实心黄 + 墨边）挂在**柱值标签前面**
  ——柱身上不带任何黄，理由见下（D-029 试过三版柱身黄，全被否掉）。
- **零刻度**：零日不再写「0」（等宽 0 只有 5.5px 宽，读起来是标签而不是测量结果），改由基线上
  一道 2×3px 的硬刻度画「量出来的零」，取 `fg-3`（2px 的块比 1px 线观感弱，再压透明度会在深色
  主题里消失），并**居中于自己那一列**——它量的是这一列，左右两角没有含义（贴左角同样是枚
  「不知从哪来的块」，居中后还与柱值标签同轴）。零日因此既没有柱子也没有数字，只有一枚刻度。

**峰值参考线做过一版，被撤掉了（D-028）。** 它是一条 45% 墨的 1px 虚线 + 左端黄牌「峰值」，
本意是补上"这算不算多"那条参照（hero 有参照行、四桶有占比轨道）。但它在**每根柱上方都成为一条
横线**：线在峰值那个高度横贯全宽，柱顶恰在这一带的柱都被它压过，维护者连问三次"这条横线能不能
移除"——量程这点收益抵不过它对整张图的视觉打扰。撤掉之后峰值仍由墨边 + 加粗标签表达（黄块那一版
也已在 D-029 换掉），这张图回到"只有柱与基线"。**教训**：参照类装饰若横贯全宽，就会与每一列发生
关系；在这张只有 92px 高、柱子占满宽度的图里，它没有自己的车道。

**黄的面积预算：峰值柱不再是整块黄（D-029）。** 维护者拿着一张深色主题的截图问：「使用最多的那一天，
黄色高亮是否有点过头，太抢眼？」——答案是「过头」，但问题不在用了黄，而在**黄的面积**。D-025 / D-027
那条「黄只出现在当前页 / 峰值 / 徽记三处」的预算管的是**处数**，没管**大小**：徽记 7×13px、当前页
标记 5px 宽，而峰值柱恒为满高（峰值就是量程 max，柱高永远 92px），一根 ≈43×92px 的实心黄把全 UI 的
黄面积吃掉了 ≈97%。满屏唯一的饱和色因此落在最大的那块**面**上，而这张图要读的是**分布的形状**；
它同时是冗余编码——「哪天最多」柱高已经说明，标签又已经加粗提亮，黄只贡献了「报警」的语气。最后一层
是**主题不对称**：`#FFCD00` 对深底 9.28:1，是全屏最响的东西；对白卡只有 1.57:1，只是一块淡黄——
同一套 CSS 在深色皮肤下重得多，这也解释了它为什么在深色主题下才显得过头。

**黄在柱身上试过三版，全被否掉，最后一版还错在原则上。** ① 6×3px 贴左下角——一枚不知从哪来的
黄块（维护者：「黄底座，只有立柱的左下角有，看起来很奇怪」）。② 改成贯通柱宽的柱脚黄条——又成了
「上下各有一条黄线」（维护者）。③ 病根是**柱顶 3% 的压边与柱脚 3px 的条都是「线」**：tokens 那条
「它是"料"，不是"线"」本就禁止黄以线条出现（恒定的黄做细线，在浅底上只有 1.57:1），而我把它画成了
两根细线；两条平行线贴着同一个矩形的上下边，读起来是一圈取景框，不是一枚件。

所以黄从柱身**整个撤掉**，回到它唯一站得住的形态：**实心小黄牌（4×8px，节徽记的 0.6 倍）+ 墨边**，
挂在峰值那个数值前面（`.dtpl-bar-label.is-peak::before`）。挂在数字上，标记与它标注的值就不会走散；
而且它同时是**形状**——数据图形的峰值不该只靠颜色说出来（形状 / 文字 / 明度三层各自成立，与「用
形状 + 文字标注、不要只靠颜色」那条无障碍结论同向）。柱身因此只剩形与明度。

改法是**把黄从「面」降回「件」**：柱体换成 70% 前景墨的高亮块，墨边保留；峰值现在由明度差（70% vs
45%，两个主题都成立）+ 墨边 + 那枚黄牌 + 加粗标签承担，黄回到 tokens 里「它是"料"，不是"线"」的位置，
品牌语言没丢。**同一窗口、同一量法**（真机截屏里数 `#FFCD00` 像素）：整块黄填充 **3709px²** → 最终
**67px²**（−98%），其中 55px² 还是节徽记自己的边缘——峰值柱身上那根黄，被那枚黄牌整个替代，牌面自己
只剩 12px²（4×8 的牌子被 1px 墨边吃掉一大半）。
**70% 而不是更高的那一档是量出来的**：82% 时深色主题下柱体是 `#D4D5D6`，与黄 `#FFCD00` 的明度几乎
相同（对深底 9.4:1 vs 9.0:1），黄牌挨着浅块也读不出来——留着黄却看不见它，等于白留；70% 时柱体约
`#B7B8B9`（对深底 ≈6.9:1），仍是全图最亮的一根（其余柱 3.9:1）。
**这条尺子 D-028 已经用过一次**（峰值参考线的收益抵不过打扰）；若哪天要恢复更强的峰值信号，正确方向是
**回收别处的黄**（节徽记降为墨块，让黄在整屏只出现一次），而不是把黄重新铺满这根柱。

**撤销参考线的那次改动同时拆掉了 `.dtpl-plot` 基准层。** 那一层是为参考线做绝对定位用的
（绝对定位元素的 `top/bottom` 百分比按包含块 **padding box** 解析，而柱高按 **content box** 解析，
两者差一个垂直 padding）；参考线一走，这一层就没有存在理由。`.dtpl-bars` 仍保持**垂直 padding 为 0**
（图上方那 24px 留白继续由 `margin-top` 承担）——这条现在就只是"留白写在哪"的偏好，不再是硬约束。

**再补一次「首尾列居中」的收口**：值标签比列宽（`298.5M` 实测 33px vs 列宽 41px），居中后首尾两列
各向外探出约 4px。此前是把首尾标签钉在列边缘（`is-start` / `is-end`）来防溢出——代价是那两根柱和
数字对不上。现在改成图区左右各留 14px（与本卡正文内缩同值），14 列统一居中，最宽的字体度量也还剩
约 10px 余量。

**入场只让读数长出来。** 柱子用 `scaleY` 从基线起长（180ms，`transform-origin:bottom`，只在
`prefers-reduced-motion:no-preference` 下），数值标签全程不动——数字先停在它最终的高度上，
柱子是长到数字那里去。动画类由 `TrendPlot` 挂载时加上、`animationend` 一到就摘掉：轮询重渲染
不重播，只有切 tab 回来（重新挂载）才再播一次。

**告警文字单有一档 `--dtpl-warn-ink`。** 这是顺手修掉的一个既有缺陷：DSH 的浅色 warn 是 `#F59E0B`，
混 45% 前景墨之前，11px 的「失败 / 没上报用量」数字只有 **2.15:1**（正文要 4.5:1）。现在实测
**5.57:1**（深色 8.91:1）。`--dtpl-warn` 本身仍留给非文本用途（边框、底色），那里只要 3:1。

**占比的轨道不能删**（D-023 实测保留）：去掉它以后，占比 0.1%–1% 的行只剩 1–5px 的实色碎点，读起来
像渲染故障而不是「这一行很少」——轨道是「占谁的多少」这句话里的分母。

**现金与订阅金额的区分靠字重，不靠颜色。** 实测 DSH 皮肤里 `--dsw-alias-brand-primary` 解析成
**墨色**（浅色 `#0f1115` / 深色 `#f9fafb`），所以「现金借强调色」一直是空操作；而这里唯一有**色相**
的 token 是品牌黄，它是身份色、不外借给数据分类。区分由字重 + 始终在场的「订阅价值」名字承担。
（这一轮曾按「第一次读到它的人」的判据把它改成「相当于省了」，维护者判定那个说法更啰嗦、不如
原名直观，遂保留原名——桶名 `subscriptionValue` 与界面词「订阅价值」继续一一对应。）

**形态不再跟随宿主，颜色仍然跟随。** 上一版（D-023）把 `重新扫描` 改成 DSH 原生的 12px 圆角按钮、
并保持窗口自己的 pill 分段器不动，理由是「跟着宿主才叫一致」；D-024/D-025 反过来——这套风格的
价值就在于它**不是** DSH 的样子，所以按钮改描边方按钮、五个 tab 从 pill 轨道改成「横排 + 竖分隔 +
底部实条」。仍然跟随宿主的只有**颜色与主题**，见上。

**窄屏（≤640px）**：四桶折成 2×2，边框与分隔线跟着折（第二行补横分隔、行首格去掉竖分隔，否则线会
漂在格子外面）；14 根柱每根只剩约 22px，而「298.5M」这样的标签要 34px，所以**只留峰值那一个数值
标签**——其余柱值仍在自己的 `title` 里，不是把数值藏起来。峰值那根柱已经有更亮的柱体 + 数值前那枚
黄牌 + 加粗标签 + 轴上的日期（D-029），窄屏上唯一留下的标签就是它；节末那行文字合计已随概览底部
注记一并删除（D-032），不再复述峰值的问题也就不存在了。

**首屏只有一个窗口（今日）**：四桶与金额都跟随今日，不再混累计口径——`UsageDayRow`
因此带上 `spend`/`subscriptionValue`（`attachCosts` 从 rate rows 按天折叠，wire 契约见
[`CONTRACTS.md`](CONTRACTS.md)）。**概览里没有累计**（D-033）：累计那张账只由用量明细的「全部」
档陈述，而它本来就不该与今日数字争夺首屏（它单调递增、永不触发决策）。金额行**只列非零的桶**
（纯订阅日不摆一个抢眼的 ¥0.00 支出；两桶皆零时回退一个次要色零值，行不会无声消失）。

**概览不写加法律。** D-033 初版在读数格下挂过一条 `.dtpl-buckets-note`（四桶的加法律 + 词表 +
命中率的分母），随后**整条删除**：一屏只陈述今日的卡上，一段 11px、两行、讲口径的正文是全卡
唯一的「读的文字」，而它讲的三件事各自另有去处——四类互不重复且相加即今日词元、以及输出含
思考过程，都在**统计口径**页的四桶表与合计式里写着；命中率的分母写在该页里。
概览因此回到「只有读数、没有段落」。**代价（明说）**：卡上不再就地说明「四类相加等于上面那个数」，
读者要核对这条得切到统计口径。

**缓存命中率不再显示（D-037）；它此前换过四次位置（历史）。** 节标题右端一条 11px 旁注 → 并进卡底
那条注记的句首 → `今日词元` 同一行的右端 → 读数格内。进格之后**又挪过一次**：先与份额同处值行，
维护者读到的是「命中率重复显示了」——`120K 71.0% │ 75.0% 命中率` 里两个百分比并排、只有后一个
报名，于是前一个被读成同一个数的第二遍；随后改挂**标签行**（`.dtpl-k`）右端，格子名在左、派生读数
在右，`title` 里带分母与「截断」两条。2026-09-16 整条不再显示：它在缓存密集的账本里与同一格的
「缓存读取 占 x%」往往只差零点几（维护者截图里是 `占 98.9%` 与 `99.3% 命中率`），并排仍会被读成
一个数印了两遍——位置换了四次，回避的都是同一个事实：**这个比值与它旁边的份额常常是同一个数**，
而卡上原先要解决的问题（四桶相加即今日词元）已由份额说清。定义、分母与读法留在「统计口径」页；
输入侧三桶都在卡上，需要时按上式自己算。
代价（明说）：概览不再就地给出「缓存省了多少」这个判据——它是这张卡上唯一能改变动作的派生量。

四桶只保留有信息量的格，但判定粒度是**账本**而非当天：`UsageTotals.cacheWriteTokens` 是
必填数字，聚合已无法区分「厂商报了 0」与「厂商没上报」（单条记录的
`UsageFields.cacheWriteTokens` 才是可选的），所以 UI 只该问「这个账本里缓存写入是不是一个
维度」——`byDay.some(cacheWriteTokens > 0)`。按天判定会让同时用多通道的网格随当日通道
反复变形；账本判定只在新增会报该字段的通道时变一次，而那一次变化本身有信号。不是
维度时用 3 列网格排成一行，不留半格。每格另给**份额**（该桶 ÷ 今日词元，分母就是主角数字本身）：
四桶之和＝主角数字这件事因此在卡上自己成立，不必读者在脑内相加（构成与理由见上「四桶各自带
份额」）。**缓存命中率自 D-037 起不再显示**：它是这张卡上唯一能改变动作的派生量（四桶原始计数与
成本权重相反——缓存读占词元 98% 却是最低费率），但它与同一格的「占 x%」往往只差零点几，并排会被
读成一个数印了两遍。**份额的读法**恒为一位小数且向下截断：四舍五入会把 99.95% 印成 100.0%，而
「满」与「几乎满」在动作上是两回事；截断只低报不高报，所以只有真正零遗漏才走得到 100.0%（早先的
写法是「整数优先、会凑到 100 时才退到一位小数」，那会让同一个读数在 99.4% 与 99.5% 上跳一个字长，
也不利于等宽列对齐）。

**第一格叫「未命中输入」，不叫「输入」。** 它装的是 `prompt_cache_miss_tokens`——**没命中缓存**
的那部分输入，而不是「我这次发过去的全部文字」。叫「输入」会把一次很长的对话读成很短的一次
提问，是这一屏里唯一会让人把事实读错的标签，所以标签自己把限定词带上（「统计口径」页的桶名与
平台字段对照表同步改名）。

**口径词写在句子里，不靠位置感。** 一屏同时有四个时间窗（今天 / 近 7 天 / 近 14 天 / 全账本），
所以每个窗口都要自己报名：hero 主区是今日（口径词「今日词元」自带「今日」；原今日异常行钉的那个
分区词随该行撤出，D-036），趋势图与拆分面板各自
带窗口词。钉住的窗口 footer
同理只报**新鲜度**（「最新记录 <时刻>」）：读者要的答案是「屏上这份数据有多新」，插件内部的
同步状态机（待同步 / 已同步）不是他的词汇，所以正常态不占字，只有**正在重新扫描 / 上次扫描
失败**——两者都要他采取行动——才多一句。

**这一屏的节标题必须互相分得开，而「今日词元 / 每日词元」做不到。** 这两个标签只差一个字、又共用
「词元」这个头，读起来像一对兄弟；维护者原话是「太过相近」。它们其实是两种不同的陈述：hero 是
**一个窗口里的一个总量**，趋势图是**一个窗口里逐日的分布**。所以趋势那一节改成用一个完全不同
结构的名字：**「近 14 天趋势」**——由**窗口词**（近 14 天，直接取 `TREND_DAYS`，与柱子数不可能
对不上）领起，再加陈述类型（趋势），与「今日词元」不共享任何字串。标题由窗口词领起
（它下面那行合计已随底部注记一并删除，见 D-032），正是本节开头那条规矩想要的样子。
hero 的「今日词元」**保持不变**：它标的是那一个
数字（它旁边就是「今日实际支出 / 今日订阅价值」两个同族的字段名），而且四桶下的注记按名字回指
它（「相加即上方的「今日词元」」）。而**「今日词元构成」这个节标题自 D-033 起没有了**——分解
并进了 hero 那张卡，位置本身就说明了父子关系，一个标题只是把同一件事再说一遍；「共用前缀是有意的」
那条理由（那是 hero 数字的分解）改由**空间**承担，比字串更直接。意外的是「今日 / 每日」这种
一字之差的并列，不是「今日词元 / 今日词元构成」这种父子关系。

**概览底部不留注记。** 趋势图下那行合计（「最近 14 天合计 …（其中 N 天有记录）」）与紧跟的
三条累计注记（自动压缩次数 / 价格未知模型 / 没上报用量的规模）已删除（D-032）：它们排在今日
口径的内容之下、却各自讲整本账，是这一屏最占纵向空间的一段文字；而同样的事实各自另有去处——
压缩次数在用量明细的通道卡头，价格未知在通道卡与价格表的筛选里，未上报用量的规模在通道卡与
「统计口径」页。代价（明说）：概览里的 ¥0 不再就地声明「价格未知 ≠ 免费」「未上报用量 ≠ 0」，
核对口径要切到那两处。

### 5. 工具链（保持不变）

沿用第一期 `tsc` + 自建 `scripts/build-client.mjs`（esbuild，产物 `lib/index.js` +
懒加载 CJS 的 `lib/client.js`）；client 不 runtime-import 非基线包，**不 export default**
（cordis loader 的 `exports.default ?? exports` 会掩盖 `.inject`）。新增 `pnpm smoke`
纯逻辑冒烟测试（`scripts/smoke.ts`，`node --experimental-strip-types`）。

## 附二：社区/生态参考（GitHub，检索实测）

- **侧边栏原生 slot 权威指南**（路线 A）：[oil-oil/build-deepseek-harness-plugin · client-slots-and-theme.md](https://github.com/oil-oil/build-deepseek-harness-plugin/blob/main/references/client-slots-and-theme.md?plain=1)
- **插件模板**（14 个 UI surface，含 `sidebar.footer.action` + `shell.overlay`）：[kun2-5code/dsh-plugin-template](https://github.com/kun2-5code/dsh-plugin-template)
- **侧边栏生态注册表服务**（路线 B）：[omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) · [external-plugin-guide.md](https://raw.githubusercontent.com/omdsh-dev/DSH-better-sidebar/main/docs/external-plugin-guide.md)
- **官方 client 模块**：`docs/subsystems/client-modules.zh.md`
