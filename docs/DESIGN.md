# dsh-tokbook —— 技术选型与插件框架设计（一期→二期演进）

> **Doc meta** · role: reason · language: zh-CN · status: current · last-reviewed: 2026-09-14 · supersedes: —

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
  `usageUnknown`，概览以「N 次调用没上报用量」报出（未知 ≠ 0，与「价格未知 ≠ 免费」
  同一条原则；金额仍按 ¥0 计，由概览注记说明）。丢行比「未上报用量」更不可查，所以两条
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
`number-tabular`、`elevation-consistent`)。本仓库是桌面 Web 的 DSH 插件,**移动端 App 专章
不适用**(安全区、haptics、Dynamic Type、底部导航一律不引用);无障碍仍按 WCAG 口径查:触摸
目标 ≥44、焦点指示不遮挡控件、颜色不单独承载语义(状态同时有文字徽章)。

### 4. 前端（保留浮窗形态，内容升级，覆盖 §6.1/§6.2）

仍走 `sidebar.footer.action` 按钮 + `shell.overlay` 浮窗（纯 slot 注册，不受允许列表
限制），但浮窗内容升级为：汇总卡（**今日词元** + 较近 7 天日均涨跌参照 + **今日支出**）、
**今日词元构成**（四桶 + 缓存命中率）、**近 14 天趋势图**，以及**一个子 tab 切换的拆分视图**
（`Breakdowns.tsx`）：**按模型**（词元 + 费用 + 占比条）与**按工作区**（每个工作区一行：
累计词元 + 请求数 + 失败数 + 金额 + 占比条，最近有操作的在前面，「未归属」收尾），右上的小字写明
当前那一面自己的排序口径（按模型按词元、按工作区按最近使用），因为同一屏里两种排序键
不说清就容易被当成同一种；其后是价格未知模型提示。
金额恒以人民币（¥）展示。

**清单顺序服从它编码的量。** 模型行按**词元**降序——占比条编码的就是词元，清单若按别的键排
（这里曾按请求数），条长就不是单调的，整列读起来像渲染坏了；而「按请求数排」还得让读者去别处
找那个没显示的数字。`src/by-provider.ts` 早就按词元排，概览这一屏此后与它一致。排序发生在
**展示层**（wire 上的 `byModel` 顺序不是契约），所以预览 harness 里那份乱序 fixture 正好证明
排序真的发生了。

汇总卡的主角是**今日词元**而不是累计：累计单调递增、永不触发任何决策，只在首访时证明
「账本确实在记账」；稳态下的第一眼要回答的是「今天算不算多」，所以主角是今日，并紧贴一条
**较近 7 天日均**的涨跌参照。基准取**不含今日的前 7 个完整日**（含今日会被今天自己拉偏，
涨跌幅失真）；账本历史不足 7 天或前期无用量时**不显示参照**，绝不编造基准；今日为 0 时
改显基线绝对值（百分比在零附近只是噪声）。参照行的涨跌**只靠 ↑/↓ 字形与字重**表达，不染色：
「比平时多」不等于「出事了」（用量是任务驱动的），而 `--dtpl-warn` 要留给真正的失败计数。

**hero 的两区版式（今日 | 累计）。** 主区（上）是今日：`今日词元` 标签、主角数字、以及**同一
基线上紧贴其后**的 7 天参照——参照是这张卡存在的理由，所以不再做数字下方的灰色脚注。今日金额
是主区右侧「标签左、金额右」的双行块：两行共用一个宽度（该块的 max-content），所以标签左端成列、
金额右端成列。此前金额是「金额 + 小字标签」并排、两行字号还不同（14px 现金 / 12px 订阅金额），
并且与右侧的**累计**金额同一条基线并排——读者得把两行都读完才知道哪行是今天。现金与订阅金额
的区分从颜色改成**字重 + 标签**：现金升一档字重并升到主文本色，订阅金额留在次要色并始终带着
「订阅价值」这个名字（理由见下「现金与订阅金额的区分从颜色改成字重」）。零消费仍占住该行，
但用次要色。

**今日出过的事单独一行，且自带口径词。** 失败与「没上报用量」的次数只在**发生的时候**可行动，
而累计值既不及时也没有分母（「累计 7 失败」说明不了现在有没有问题）——所以它们从累计事实带
移到一行 `.dtpl-hero-alert`：只在今天有失败或没上报用量的调用时占行，数字走 `--dtpl-warn-ink`，
前面钉着「今日」这个分区词。它与下面的累计带同处 hero，但读者不需要靠位置去猜这是哪个窗口。

累计区（下）由一条发丝线与主区隔开，靠「累计」这**一个**分区词标明口径，全部事实串成**一条**
次要行（请求 / 词元 / 实际支出 / 订阅价值）——所以它不再逐项占行去和今日
数字争夺首屏，也不必给每个标签都挂一个「累计」前缀。**只留能加总的量**：会话计数取消（它单调
递增、永不触发决策，而 hero 已经用请求数与词元证明账本在记账），失败与未上报用量换到上面那行
按今天报。副作用是 hero 从 156px 降到 **125px**（有今日异常行时约 154px）：累计
数字不做决策，把高度还给趋势图（骨架块同高，首屏不再跳）。窄 sheet（≤640px）上两块改为堆叠，
分隔点让位给间距、每项整体换行（行首不会孤零零出现一个「·」），「累计」仍领着自己那串事实。

**视觉方向：明日方舟：终末地 风格（直角 + 硬边 + 金属 + 品牌黄 + 仪表构件）。** 决策过程见
[`DECISIONS.md`](DECISIONS.md) D-025 与 D-027，**特质检索与出处见本节末尾「风格取自哪里」**。
六条特质落到整扇浮窗——**五个 tab 共用同一套语言**，没有哪个 tab 长出自己的面板或自己的「选中」：

- **直角与硬边。** `--dtpl-radius*` 归零，并把 42 处硬编码圆角一并收敛回 token。hero、四桶回到
  1px 硬边框；卡片四角用 `::before`/`::after` 画 L 形括号，**不用 `clip-path` 切角**——切角会连子元素
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
  - 峰值柱 = 黄填充 + 墨边；
  - 工业徽记 = 节标题前 7×13 的黄牌 + 墨边（**反复出现**的那枚标记——终末地把「终末地工业」的
    Logo 及衍生图形铺在每个系统面板的头部，这里用同一手法；它是**抽象替身，不是鹰角商标的复刻**）。
    「统计口径」的编号小节用同一枚徽记装序号（黄牌 + 墨色数字），所以「第几节」也是这套记号的一部分。
  用量压到这三处。**剩下的颜色继续跟随主题**：底色、文本色、状态色全走 `--dsw-alias-*`，所以插件
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
  所以 hero 换成**天生适合带状空地的母题**：底边一条贯通全宽的**刻度轨**（`1px` 三层刻度 + 一条
  基线，8px / 40px / 200px 三档，全部走墨色），四角里补上左上与右下两枚括号，口径词前补上那枚
  **工业徽记**。最后一条顺手修掉一处真实的不一致：窗口里每个节标题都带黄牌，只有 hero 的「今日词元」
  没有。刻度轨整条落在 hero 的下内边距里（轨顶 = hero 高 − 4 − 9），所以最高的那层刻度也碰不到
  「累计」那一行。**刻度的黄必须省掉**：黄是「料」不是「线」，1px 的黄在白底上只有 1.57:1，做刻度线
  会直接消失——黄在这一屏只留给口径词那枚徽记（仍在「三处」预算之内）。
  等高线本身**整个插件里都不再出现**：它退回到 Logo / 徽记那一层，而面板上用的是括号、刻度与铭牌。
  （另一条备选是把它铺满整块 hero 当低对比度底纹——那能保住签名，代价是纹理从数字底下穿过，
  实测可读性仍可接受；维护者选了结构件这条。）
- **字体保守，不做字体文章。** 终末地的原话是「字体使用太保守，没有使用在字体上下功夫，好处就是
  不像某些使用粗体字的压根看不清」。所以上一版的衬线、拉丁装饰铭牌（`TOKEN LEDGER` / `TODAY` /
  `INPUT`…）与中英混排**全部撤掉**；只有数字走等宽体——那一条留的是工程语境而不是装饰，等宽还附带
  一个实利：位数变化时整块不抖，而且**固定列的可比对性本来就以等宽为前提**（价格表的费率列是这条
  的实际受益者，见上）。上一版「通道用量」的合计数字漏了这条规矩，是全窗口唯一一处比例体数字。
- **仪表构件。** 面板的工业感来自**结构件**，不是贴图：hero 四角补左上/右下两枚括号、底边一条
  贯通全宽的刻度轨（三层刻度 + 一条基线）、口径词前一枚黄牌徽记。三样都是「带状空地天生放得下」
  的东西，所以没有任何一处会读成「孤零零的几根线」。
- **一行数据要么是表，要么是段落——「用量明细」改成了表。** 这一节此前是两个 tab 标签直接接一叠
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
  「订阅价值」改成金额格里一枚**固定宽度的槽位**（现金行留空）⇒ 实测所有行的金额右边缘
  只剩**一个**值。列头是**一行**：「模型 · 通道」/「词元 · 金额」——两列各是一串上下叠起来的
  事实，所以列名也照同样的先后写成一对，分隔符用的是这个窗口里表示「一串事实」的 `·`。
  这里踩过一次：列头最早照数据的**两行**写成两行（模型、通道 各占一行），好处是标签精确
  落在各自数值正上方，代价是四枚孤零零的标签占掉两行、中间大片空白——**表头比它标注的数据
  还高**（41px），维护者一眼看出「这里有双层」。改一行之后剩 27px，牺牲精确对位换回它像
  一行表头。通道仍由列头命名，行内不再重复「通道」两个字。
  **轨道同时取代了行分隔线**：此前每行尾部两条横线（16% 的轨道 + 6% 的发丝线，重量差 2.7 倍）
  读起来像「文字下划线 + 表格线」，现在一行一条线，而这条线承载分母。
  窄屏（≤640px）按价格表 `列头` 的先例**收掉列头**、行改单列堆叠、数字改成身份下面横排一行
  （词元靠左、金额靠右）——两列网格在 ~390px 宽上会把身份列压到 ~130px，模型名与工作区目录
  都没地方站。同一段窄屏规则里还把**两个子 tab 撑到 44px 高**：窄 sheet 是触控形态，而那一行
  是切换这一节视图的**唯一**入口；29px 过得了 WCAG 2.2 的 24px 底线，却离触控的 44px 差得远。
  同一张面板里价格表的展开钮早就在窄屏拿 44px，两种标准并存是漏了、不是取舍。桌面不动
  （实测表头 30px、tab 29px）。

  **两处只限「不可预测的那一半」。** ① 金额格里的「订阅价值」是一段**固定**的字，所以它拿
  `white-space:nowrap` + `min-width`（不是硬 `width`）：宽度在每行里都是同一个 max-content，
  数字右边缘照样对齐，而标签既不会折行也不会被裁；现金行照常渲染同一段字、用 `visibility:hidden`
  藏起来，占位与订阅行一模一样（`visibility` 会一并把它移出无障碍树）。被限宽 + 省略号 + `title`
  兜底的是**数额**——它才是会变的那一个。② 表头在视觉上命名了每一列，但读屏读不到表头与单元格的
  对应关系，所以每个格子自带一枚只给读屏的列名（`.dtpl-sr`：「通道 commandcode」「词元 830.3M」
  「金额 ¥37.75 订阅价值」）。**这是修一处自己引入的回归**：上一版把行内的「通道」两个字连同
  表头一起 `aria-hidden`，等于从无障碍树里删掉了「commandcode 是什么」。

  **行不加 hover 底洗色。** 这些行不是可点的，`hover` 反馈在交互元素上才成立；给静态行加悬停
  底洗色会造出一个假的可点承诺（触屏上也根本触发不了）。

  **这条行组件是跨 tab 的，所以它的度量挂在插件根上。** 通道用量 tab 复用同一套 `.dtpl-row`
  网格，但右列宽原本只定义在用量明细那一节的父元素上，于是那个 tab 取不到它、
  `grid-template-columns` 在计算值阶段整条失效、悄悄回落到单列——实测行高 **75px**（两列时
  **38px**），同一个类在同一个窗口里长得完全不一样，而这一点从截图上只表现为「这一屏的模型行
  比较高」，看不出是失效。变量因此移进 tokens 片段并改名 `--dtpl-row-nums-w`（它约束的是
  「行」，不是「明细」那一节）；通道用量的模型行回到「身份 + 数字并排、轨道在身份列下」的两列
  形态，实测轨道恒为 **424px**（分母不再随行变化，右列格最宽 135px，未溢出 200px 的列）。
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

**一处更正。** D-025 的检索结论写着「② 界面以**亮白**为主，且没有深色模式」——这两句在上述
原文里**没有依据**：原文对面板的描述只有「黑白灰基色 + 一些金属色稍加点缀 + 终末地黄」，没说
底是亮的还是暗的。所以本插件「颜色继续跟随 DSH 主题」不是违背终末地，而是在自己的前提（宿主
有浅色与深色两套皮肤）上做的取舍；把它当成「终末地没有深色模式」的推论就不成立。D-025 的决策
正文不受影响（那条只关乎黄的用法），此处只更正那句检索结论。

**出处。** ①《【笔记】浅谈明日方舟：终末地的设计-vol.01 色彩运用》B 站专栏 `cv40133328`
（平面设计视角：黄黑白的工程血统与全部用法实例）；②《鹰角还是那个鹰角》知乎专栏 · 游戏茶馆
（试玩纪要：画内 / 画外的划分、主 UI 的「内化」、次级界面的留白、跨端输入与动效手感）。

**柱的灰取墨色 45%**（白底 3.04:1、深底 3.97:1）：柱高是这张图的正文，30% 在白底上只有 1.99:1，
过不了 3:1。**峰值不只靠颜色区分**——它有墨边而其余柱没有，形与色各分一层。文字侧同理：标签与
口径注释全部留在 `fg-2`（≈5.8:1），安静由字号、字距与留白做，不靠把字洗淡到读不清。

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
标签**——其余柱值仍在自己的 `title` 里，不是把数值藏起来。节末合计只说合计与「其中 N 天有记录」，
**不再复述峰值**：峰值那根柱已经有黄块 + 加粗标签 + 轴上的日期，而窄屏上唯一留下的标签就是它。

**首屏只有一个窗口（今日）**：四桶与金额都跟随今日，不再混累计口径——`UsageDayRow`
因此带上 `spend`/`subscriptionValue`（`attachCosts` 从 rate rows 按天折叠，wire 契约见
[`CONTRACTS.md`](CONTRACTS.md)）。累计事实（请求/词元/实际支出/订阅价值）与今日异常行同处
hero 发丝线下/上的**那一条**次要行，**不单独占卡**：一张常驻卡会把最不可行动的累计数字抬到首屏，
并把真正可行动的趋势图挤到折叠线以下。金额行**只列非零的桶**（纯订阅日不摆一个抢眼的 ¥0.00
支出；两桶皆零时回退一个次要色零值，行不会无声消失）。

**四桶的加法律就地写一次。** 四桶正下方一条 `.dtpl-buckets-note`：「词元（token）分四类、互不
重复，相加即上方的今日词元；输出含模型的思考过程。缓存命中率＝缓存读取 ÷ 输入侧三类之和。」
它替掉两处要靠读者自行推断的东西——hero 那个数与四桶的关系（此前只写在「统计口径」页），以及
命中率的分母（此前只在 hover 的 `title` 里）。它是这一节的收尾，所以四桶网格的下边距从 20px
收到 8px、由这条注记接管剩下的 20px。

四桶只保留有信息量的格，但判定粒度是**账本**而非当天：`UsageTotals.cacheWriteTokens` 是
必填数字，聚合已无法区分「厂商报了 0」与「厂商没上报」（单条记录的
`UsageFields.cacheWriteTokens` 才是可选的），所以 UI 只该问「这个账本里缓存写入是不是一个
维度」——`byDay.some(cacheWriteTokens > 0)`。按天判定会让同时用多通道的网格随当日通道
反复变形；账本判定只在新增会报该字段的通道时变一次，而那一次变化本身有信号。不是
维度时用 3 列网格排成一行，不留半格。另给一个**缓存命中率**（缓存读取 ÷（未命中输入 + 缓存读取
+ 缓存写入），与 harness 会话统计同分母）——四桶原始计数与成本权重相反（缓存读占词元 98%
却是最低费率），命中率才是能改变动作的派生量。**部分命中不凑整成 100%**：整数位四舍五入会
把 99.5% 印成满命中，而满命中与 99.9% 在动作上是两回事；整数会凑到 100 时改用一位小数
（截断，只低报不高报），只有真正零遗漏才显示 100。

**第一格叫「未命中输入」，不叫「输入」。** 它装的是 `prompt_cache_miss_tokens`——**没命中缓存**
的那部分输入，而不是「我这次发过去的全部文字」。叫「输入」会把一次很长的对话读成很短的一次
提问，是这一屏里唯一会让人把事实读错的标签，所以标签自己把限定词带上（「统计口径」页的桶名与
平台字段对照表同步改名）。

**口径词写在句子里，不靠位置感。** 一屏同时有四个时间窗（今天 / 近 7 天 / 近 14 天 / 全账本），
所以每个窗口都要自己报名：hero 主区是今日（今日异常行再钉一个「今日」），趋势图与拆分面板各自
带窗口词，底部三条注记（自动压缩次数 / 价格未知模型 / 没上报用量的规模）一律以「累计」开头——
它们讲的是整本账，却排在今日口径的内容之下，没有窗口词就会被当成今天的事。钉住的窗口 footer
同理只报**新鲜度**（「最新记录 <时刻>」）：读者要的答案是「屏上这份数据有多新」，插件内部的
同步状态机（待同步 / 已同步）不是他的词汇，所以正常态不占字，只有**正在重新扫描 / 上次扫描
失败**——两者都要他采取行动——才多一句。

**四个节标题必须互相分得开，而「今日词元 / 每日词元」做不到。** 这两个标签只差一个字、又共用
「词元」这个头，读起来像一对兄弟；维护者原话是「太过相近」。它们其实是两种不同的陈述：hero 是
**一个窗口里的一个总量**，趋势图是**一个窗口里逐日的分布**。所以趋势那一节改成用一个完全不同
结构的名字：**「近 14 天趋势」**——由**窗口词**（近 14 天，直接取 `TREND_DAYS`，与柱子数不可能
对不上）领起，再加陈述类型（趋势），与「今日词元」不共享任何字串。这同时把窗口词从下面的合计行
提到了标题里，正是本节开头那条规矩想要的样子。hero 的「今日词元」**保持不变**：它标的是那一个
数字（它旁边就是「今日实际支出 / 今日订阅价值」两个同族的字段名），而且四桶下的注记按名字回指
它（「相加即上方的「今日词元」」）。同理「今日词元构成」与它共用前缀是**有意的**——那是 hero
数字的分解，前缀关系本身就是那句话的意思；意外的是「今日 / 每日」这种一字之差的并列。

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
