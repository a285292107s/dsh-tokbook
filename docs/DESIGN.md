# dsh-tokbook —— 技术选型与插件框架设计（一期→二期演进）

> **Doc meta** · role: reason · language: zh-CN · status: current · last-reviewed: 2026-09-10 · supersedes: —

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

> 你已选择「先出方案文档」。以下为**脚手架文件清单**，待你确认后按其搭建。

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
`rateRows`（每 (day, model, rate) 一格，便于无重读地过滤与重新计价）/ `recent`。
冻结日前文件从磁盘 `rollup.json` 取，今天热文件实时读；解析后的日文件在进程内存缓存
（冻结文件常驻，今天文件按 size/mtime 重读）。

### 3. 成本计价（新增，覆盖 §1/§5「本期不做成本」）

- `pricing.ts`：¥/M 每模型价目表，**云端镜像（`pricing.ccsa.json`，启动时同步）与手工
  `pricing.json`（整体覆盖、永远优先）**在读取时合并。
- 每条记录按其自身时间解析规则链**时间规则 → 上下文档位 → 高峰时段**（上下文大小近似 =
  input + cacheRead + cacheWrite），得到 `RateKey`（只存身份不存价）；`costOf` 按每桶
  各自单价计费，cache 桶无独立价则回退 input 价。
- `attachCosts` 把 token 聚合加上成本层，`totalCost` / 每模型 `cost` / `unpricedModels`，
  且价格更新无需重建聚合即可重新计价历史。
- **价格维护 UI**（价格表 tab）：浮窗内新增第 5 个 tab，`GET/PUT /tokbook/pricing`。
  入口按「用户的问题」组织，而不是按文件组织：**在用**是默认视图，也是唯一的日常入口——
  账本真正记过的模型**按通道分组**（组头 = 镜像标签 + 路由键 + 计费性质 + 条数，
  通道按用量降序、组内模型按用量降序），每行直接给出**当前生效价**与来源（手工价 / 云端
  分时 / 覆盖层定价）。这里有一个绕不开的事实：**模型层价是全局的**——`pricing.json` 是
  `Record<model, 规则集>`，没有通道维度，同一条串（如 `deepseek-v4-flash`）可能同时被
  按量通道与订阅通道计费。所以按通道分组后**一条串只能有一行可编辑**：优先给按量
  （`metered`，实际支出）通道，其次用量最多的一条，再其次路由键序——其余通道行只读、标
  「全局价」，动作是「改全局价」跳到那条可编辑的行。这样既给了"哪条通道花了多少"的分组，
  又不会让用户在订阅通道里改价、以为只影响这一条通道。
  其余范围是显式筛选：**价格未知**（记过但两表都没有，不知价、暂按 ¥0 计，一键转
  手工价）与**全部**（手工价分组 + 价格未知 + 折叠的**云端基准价表**，限高滚动，几百条参考
  行不撑开浮窗；云端表本身再按 feed 的 `family`（厂商）折叠成组——185 行平铺是这一屏最
  不可扫的形态，而 feed 每个模型本来就带厂商，`coerceCloudPricing` 之前把它丢掉了）。
  账本的通道事实来自 `pricingView()` 的 `channelRows`（每条 （通道，模型） 的记录数 +
  计费性质 + 该通道自己的解析价），模型串事实来自 `UsedModelHint`（记录数 + 覆盖层是否已
  定价 + 该覆盖所在的路由）；镜像的 `providers[].label` 经 `providerLabels` 下发，让组头
  显示「DeepSeek 官方 API」而不是路由键。
- **默认只读，改价是一次显式动作**：这个 tab 绝大多数时候被用来"看"，改价是低频事件，所以
  手工行平时是只读摘要（价格 + 来源 + 生效窗口），点「编辑」才把四档单价变成输入框、展开规则
  编辑器——同一时刻只有一行可写，与通道面一致。这条把"常驻表单"从首屏移除：以前每有
  一条手工价，页面上就多 4 个输入框和一组时段控件。删价也收进编辑态（编辑区的「删除手工价」），
  避免误触。
- **一处编辑，一个入口**：模型层没有条目、但通道覆盖层定价的串（如
  `deepseek/deepseek-v4-flash`）**不能**在模型层编辑——覆盖层优先级更高，写下去也不会被
  读取。这类行因此直接显示覆盖层解析出的当前价，动作是「去覆盖层」：切到通道面
  并展开那条覆盖。用户不需要先判断"该在哪一层改"。
- **时间维度是这套 UI 的主角**：厂商会调价——期限内/永久降价（`timeRules`）与峰谷价
  （`dailySlots`）。引擎一直支持这两层，缺的只是出口。因此：

  - 每行显示**当前生效价**（host 在读取时用 `nowOf()` 走「时间规则 → 峰谷」链算出），
    带生效窗口的名字（如「限时5折」「工作日高峰」）；展开行可看完整时间轴，标出正在生效
    的那一段。旧 UI 只显示云端 `base`，在限时 5 折期间会显示原价——这是错的，因为
    `base` 只是时间轴之外的回退价。
  - 手工条目因此允许两种形状：flat 价，或 `{ base, timeRules?, dailySlots? }` 规则集
    （`pricing.json` 里无规则的条目仍写回 flat，保持文件可读）。**整体替换语义不变**：
    一次「自定义」以云端整套规则为底稿，保存后该模型的云规则被整套替换。
  - 手工层**不做上下文档位**：需求只有调价史与峰谷，分档是云端 feed 的概念；带分档的
    云端模型在被手工覆盖时给出提示（分档不再生效），而不是假装支持。
  - 保存按钮由**脏状态**（暂存草稿签名 vs 载入基线）驱动，而不是「手工行数 > 0」——
    后者让"删掉最后一条覆盖"无法落盘（空表是合法输入：清空手工层），而草稿签名包含
    非法暂存值，所以一行没填完也能按保存、看到具体校验错误。脏草稿还**跨挂载存活**
    （切 tab、关浮窗都不丢；只缓存脏状态，保存或「放弃修改」即清除）。
  - **失败必须看得见**：保存被拒时把错误条滚进视口、展开出错的行；行被提升（去定价 /
    自定义 / 新增）或经深链定位时滚动跟随并闪一下，避免"点完就找不到它了"。
  - **重叠的调价时段是错误，不是惊喜**：引擎取「首个命中」，两段重叠时结果取决于数组
    顺序——所以写路径拒绝重叠（报出是哪两段），读路径按开始时间排序，让文件顺序、展示
    顺序与生效顺序一致。
  - **少填一半也能起步**：新增调价段/峰谷默认用当前价预填（常见场景是改一个差额），星期
    有「工作日 / 周末 / 每天」快捷；搜索同时匹配规则/峰谷标签（搜「限时5折」直达）。
  - **未保存的状态一直可见**：脏草稿跨挂载存活，价格表 tab 上带小圆点，**每一行还各自
    带状态标签**——改过的手工价标「未保存」，被删掉（回到云端/价格未知）的手工价标「待删除」，
    所以"哪一条没保存"不用展开行、也不用靠记忆；脏状态按行签名与逐行基线比对得出（行序
    变化不算改动）。Ctrl/Cmd+S 在可见的那一面直接保存。
  - **窄屏不是缩小的宽屏**：≤640px 时价格表行改为堆叠（模型名 / 2×2 四档价带自解释标签 /
    操作），列头隐藏，时间轴与通道行同样纵向排列，tab 栏横向滚动。
  - 通道覆盖层同理：`segments` 是可多段的自定时间轴（逐段编辑，不再只保留第一段），
    `inheritBase` 行显示跟随后的实际价，并新增「新增覆盖」表单为镜像没有的
    （通道，模型） 建覆盖。
  - **同款套餐买多份 = 一条别名**：每把 key 都是独立路由（用量、额度必须分开），价格却相同。
    与其复制 N 份条目（改一次价要改 N 处），`provider-pricing.json` 的保留键 `$routes` 声明
    「谁跟随谁」；跟随而来的行在 UI 里只读、带 `via`，点「去编辑」跳到那条真正被维护的覆盖。
    路由自己的条目永远优先——某一份套餐单独调价时，给它写一条精确条目即可。
    别名在读取合并时物化进表，解析链与成本层完全不需要知道它存在。

  整表 PUT（absent = 删除该覆盖），host 校验后原子写 `pricing.json` /
  `provider-pricing.json`，返回新 view 与概览刷新联动；计价仍在读取时发生，所以保存后
  全部历史立即按新价重算。

### 4. 前端（保留浮窗形态，内容升级，覆盖 §6.1/§6.2）

仍走 `sidebar.footer.action` 按钮 + `shell.overlay` 浮窗（纯 slot 注册，不受允许列表
限制），但浮窗内容升级为：汇总卡（**今日词元** + 较近 7 天日均涨跌参照 + **今日支出**）、
**今日词元构成**（四桶 + 缓存命中率）、
**按天词元趋势图**、**按模型拆分（词元 + 费用 + 占比条）**、最近记录与价格未知模型提示。
费用显示跟随 `pricingRegion`（domestic=CNY，overseas=USD，按 feed 汇率换算，线上金额
恒为 RMB）。

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
维度时用 3 列网格排成一行，不留半格。另给一个**缓存命中率**（缓存读取 ÷（缓存读取 +
输入））——四桶原始计数与成本权重相反（缓存读占词元 98% 却是最低费率），命中率才是能改变
动作的派生量。

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
