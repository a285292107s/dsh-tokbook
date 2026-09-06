# dsh-tokbook —— 技术选型与插件框架设计（第一期）

> 面向 DeepSeek Harness（DSH）的跨会话 Token 用量账本插件。
> 本文档是第一期的**调研结论 + 技术选型 + 框架设计**。调研依据仅两个权威来源：
> 官方文档站点 `https://deepseek-harness.github.io/deepseek-harness/` 与 DSH 源码
> `C:\Users\28529\Desktop\deepseek-harness`。文中引用的文件路径均相对该源码根。

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
- 数据可跨重启累计，能按会话 / 模型 / provider / 时间维度汇总。

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
| 数据捕获 | 监听 `session/event` 的 `assistant/message` `usage`；挂载时重放既有会话做回填 | `usage` 是 provider 上报、持久化、可重放的权威来源 |
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

### 5.1 数据来源：权威 = provider 上报的 `usage`

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

上层再按需聚合（可按 session / model / provider / 天）。

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
  并监听 `session/event` 的 `request/header` 更新 provider/model（best-effort）。
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

> ⚠️ **client 改动生效方式（实测坑）**：DSH 的 `/plugins/<id>/client.js` 按 `rev`（内容 hash/非ce）做
> **不可变缓存**，这个 `rev` 在**宿主启动时**写进 `window.__DSH_BOOT__`。所以：
> - 只用普通刷新浏览器 → 拿到的是**旧 rev 的旧 bundle**（被 immutable 缓存住），改动不生效；
> - 让改动生效：**重启 `dsh web`**（宿主重算 rev）+ **硬刷新浏览器**（`Cmd/Ctrl+Shift+R`）；
>   或跑 DSH 源码的 dev HMR watcher（`pnpm run dev:web`，免重启）。
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
└─ docs/DESIGN.zh.md                # 本文件
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
3. **记账权威源**：`assistant/message` 的 `usage`（provider 上报、持久、可重放、exactly-once）；
   不用 `session-telemetry`（可能丢/重）。
4. **UI 槽位**：只填已声明的 `sidebar.footer.action` + `shell.overlay`，**无需改 DSH 仓库**（路线 A，见 §6.0）。
5. **不要看 `dsh-costbook`**（已废弃/有问题的实现），不要照抄它。

---

## 11. 风险与后续

| 项 | 风险 / 说明 |
|---|---|
| 外置 bundle 格式 | 需自己维护基线 external 列表与纯净化纪律；DSH 升级若改 `PLATFORM_MODULES` 需同步。风险可控 |
| client 插件默认导出 | 不可给 client 入口加 `export default`（cordis loader `exports.default ?? exports` 会因 default 掩盖 `.inject`，报 “without inject”）。见 §7.4 |
| client 改动不生效 | bundle 按 `rev` 不可变缓存；改 client 需重启 `dsh web` + 硬刷新（或用 dev HMR watcher），且 profile 需指向本仓库 `lib`。见 §8 |
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
  维护会话最后已知的 model/provider，给失败行归属。
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

### 4. 前端（保留浮窗形态，内容升级，覆盖 §6.1/§6.2）

仍走 `sidebar.footer.action` 按钮 + `shell.overlay` 浮窗（纯 slot 注册，不受允许列表
限制），但浮窗内容升级为：汇总卡（累计词元 + 费用 + 会话/请求/失败数）、四桶拆分、
**按天词元趋势图**、**按模型拆分（词元 + 费用 + 占比条）**、最近记录与未定价模型提示。
费用显示跟随 `pricingRegion`（domestic=CNY，overseas=USD，按 feed 汇率换算，线上金额
恒为 RMB）。

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
