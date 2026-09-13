# dsh-tokbook —— 技术选型与插件框架设计（一期→二期演进）

> **Doc meta** · role: reason · language: zh-CN · status: current · last-reviewed: 2026-09-13 · supersedes: —

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
  （失败尝试，计入 `failures` 维度）。`request/context` / `assistant/message` 用来
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

**费率格与列头。** 费率列宽 **64px**,是全 tab 一条度量(`--dtpl-rate-w` + `--dtpl-cell-pad-x`,
定义在 `.dtpl-price-sec`)。64px 是实测下限:12px 等宽数字下八位费率 `0.003625`(DeepSeek 自己
的历史缓存命中价)宽 47.9px,加左右各 7px 内边距需 62px——56px 就会裁掉第八位。列头与数字
共享 `--dtpl-cell-pad-x`,所以右端对齐(此前每列恒定差 7px)。调价史抽屉里四列**等分可用宽度**
(它是表单,不是数据列),但每个输入框 `max-width:var(--dtpl-rate-w)`——同一个「价」框在抽屉里
与表格里保持同宽,不会出现 156px 的槽放 22px 的数字。

**行状态一态一记号。** 未保存 = accent 竖条、展开 = 中性提亮、聚焦 = 描边环。此前
`focus-within` 与「未保存」共用同一条 accent 竖条,聚焦因此被误读成「有未保存改动」。
面板底色的梯级写在样式分片的一处注释里:卡片 4% → 展开行 7% → 抽屉只留虚线接缝 → 段块不透明
`layer-1` → 时段 accent;卡片与抽屉各叠一层半透明会叠成同一个平面,「段块」就会读成卡片本身。

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

**触摸与无障碍。** 移动端展开 ▸ 给足 **44×44**(此前 26px,而它是进入调价史的唯一入口)。
`ui-ux-pro-max` 数据集里命中的是通用条目(`compact-label-overflow` 只约束长度不可预测的值、
并给键盘与指针用户完整文本;`font-size-scale`、`table-handling`、`truncation-strategy`、
`number-tabular`、`elevation-consistent`)。本仓库是桌面 Web 的 DSH 插件,**移动端 App 专章
不适用**(安全区、haptics、Dynamic Type、底部导航一律不引用);无障碍仍按 WCAG 口径查:触摸
目标 ≥44、焦点指示不遮挡控件、颜色不单独承载语义(状态同时有文字徽章)。

### 4. 前端（保留浮窗形态，内容升级，覆盖 §6.1/§6.2）

仍走 `sidebar.footer.action` 按钮 + `shell.overlay` 浮窗（纯 slot 注册，不受允许列表
限制），但浮窗内容升级为：汇总卡（**今日词元** + 较近 7 天日均涨跌参照 + **今日支出**）、
**今日词元构成**（四桶 + 缓存命中率）、**按天词元趋势图**，以及**一个子 tab 切换的拆分视图**
（`Breakdowns.tsx`）：**按模型**（词元 + 费用 + 占比条）与**按工作区**（每个工作区一行：
累计词元 + 请求数 + 金额 + 占比条，最近有操作的在前面，「未归属」收尾），右上的小字写明
当前那一面自己的排序口径（按模型按请求数，按工作区按最近使用），因为同一屏里两种排序键
不说清就容易被当成同一种；其后是价格未知模型提示。
金额恒以人民币（¥）展示。

汇总卡的主角是**今日词元**而不是累计：累计单调递增、永不触发任何决策，只在首访时证明
「账本确实在记账」；稳态下的第一眼要回答的是「今天算不算多」，所以主角是今日，并紧贴一条
**较近 7 天日均**的涨跌参照。基准取**不含今日的前 7 个完整日**（含今日会被今天自己拉偏，
涨跌幅失真）；账本历史不足 7 天或前期无用量时**不显示参照**，绝不编造基准；今日为 0 时
改显基线绝对值（百分比在零附近只是噪声）。参照行的涨跌**只靠 ↑/↓ 字形与字重**表达，不染色：
「比平时多」不等于「出事了」（用量是任务驱动的），而 `--dtpl-warn` 要留给真正的失败计数。

**首屏只有一个窗口（今日）**：四桶与金额都跟随今日，不再混累计口径——`UsageDayRow`
因此带上 `spend`/`subscriptionValue`（`attachCosts` 从 rate rows 按天折叠，wire 契约见
[`CONTRACTS.md`](CONTRACTS.md)）。累计事实（词元/支出/订阅价值）留在会话/请求/失败同一
行，**不单独占卡**：一张常驻卡会把最不可行动的累计数字抬到首屏，并把真正可行动的趋势图
挤到折叠线以下。金额行**只列非零的桶**（纯订阅日不摆一个抢眼的 ¥0.00 支出；两桶皆零时
回退一个次要色零值，行不会无声消失）。

四桶只保留有信息量的格，但判定粒度是**账本**而非当天：`UsageTotals.cacheWriteTokens` 是
必填数字，聚合已无法区分「厂商报了 0」与「厂商没上报」（单条记录的
`UsageFields.cacheWriteTokens` 才是可选的），所以 UI 只该问「这个账本里缓存写入是不是一个
维度」——`byDay.some(cacheWriteTokens > 0)`。按天判定会让同时用多通道的网格随当日通道
反复变形；账本判定只在新增会报该字段的通道时变一次，而那一次变化本身有信号。不是
维度时用 3 列网格排成一行，不留半格。另给一个**缓存命中率**（缓存读取 ÷（输入 + 缓存读取
+ 缓存写入），与 harness 会话统计同分母）——四桶原始计数与成本权重相反（缓存读占词元 98%
却是最低费率），命中率才是能改变动作的派生量。**部分命中不凑整成 100%**：整数位四舍五入会
把 99.5% 印成满命中，而满命中与 99.9% 在动作上是两回事；整数会凑到 100 时改用一位小数
（截断，只低报不高报），只有真正零遗漏才显示 100。

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
