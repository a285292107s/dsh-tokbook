# dsh-tokbook · DSH 热重载（HMR）机制与本项目实况

> **Doc meta** · role: lessons · language: zh-CN · status: current · last-reviewed: 2026-09-08 · supersedes: —

> 面向 DeepSeek Harness（DSH）插件热重载机制的**官方语义 + 本项目实际接线与实测**。
> 官方依据：<https://deepseek-harness.github.io/deepseek-harness/develop/framework/#hmr-热模块替换>（“插件与生命周期”页）。
> 本地核对：运行中的 Web GUI = 全局安装 `@deepseek-ai/dsh@0.1.2-rc.1`；DSH 源码检出
> `C:\Users\28529\Desktop\deepseek-harness` = `0.1.3-alpha.1`（较新，作机制参考，文中已注明出处）。
> 整理时间：2026-09-07（同日修正 §2.1 / §4：模块级 HMR 的卸载**不被等待**、模块级状态**不跨 HMR
> 共享**——早期版本把这两点说反了，详见 §4 结尾说明）。

---

## 1. 官方文档怎么说（framework 页 · HMR 一节）

DSH 的插件模型（Cordis 派生）把每个被加载的插件放进一个 **Fiber 作用域**，状态机为：

```
PENDING → LOADING → ACTIVE
                 ↘ FAILED
ACTIVE → UNLOADING → DISPOSED
```

| 状态 | 含义 |
| --- | --- |
| PENDING | 已声明，但所需依赖未就绪 |
| LOADING | 依赖就绪，正在执行 `apply` |
| ACTIVE | 插件运行中 |
| FAILED | `apply` 抛出异常 |
| UNLOADING | 插件正在卸载并释放资源 |
| DISPOSED | 已完全卸载 |

关于 **HMR（热模块替换）**，官方原话的机制是：

> 通过 `cordis.yml` 加载 `@deepseek-ai/cordis-plugin-hmr` 后，修改插件源文件会触发：
> 1. **卸载旧插件**（清理所有注册）
> 2. **重新加载新代码**
> 3. **执行新的 `apply`**
>
> 因为插件注册会被自动清理，所以热替换不会保留旧实例的注册。

配套的生命周期保证（HMR 正确性依赖它们）：

- **依赖驱动的加载**：声明 `inject` 的插件等待所需服务就绪；若依赖的服务消失（例如提供方被替换），
  插件被自动卸载（ACTIVE → DISPOSED），服务恢复后重新加载。
- **自动清理机制**：凡经 `ctx` 做的注册在插件卸载时自动撤销——`ctx.on(event, handler)` 事件监听、
  `ctx.tools.register(tool)`、`ctx.llm.registerAdapter(...)`、`ctx.effect(() => cleanup)` 自定义资源。
  处置器按注册顺序的**逆序**开始调用；多个异步处置器**并发**执行、不保证逐个完成，所以有顺序依赖的
  清理必须放进**同一个** `ctx.effect()` 返回的处置器里自行串行。
- **`dispose` 语义**：`ctx.plugin(...)` 返回的 fiber 可手动 `await fiber.dispose()`，保证：
  ① 该插件所有注册被移除；② 子插件被递归卸载；③ 返回的 Promise 在所有异步清理完成后兑现。
- **嵌套上下文**：`ctx.plugin()` 创建子 Fiber，继承父上下文但有独立生命周期，随父一起卸载。

> 一句总结官方语义：**HMR = 一次受控的卸载 + 重载 + 重新 `apply`**，安全的前提是“所有注册自动清理、
> 异步清理可被等待”，即 `Fiber.UNLOADING → DISPOSED` 是**干净**的。

---

## 2. 这套机制在 DSH 里的实现落点（源码核对）

以下路径相对 DSH 源码检出 `C:\Users\28529\Desktop\deepseek-harness`（`0.1.3-alpha.1`），
行为与运行中的 `0.1.2-rc.1` 安装一致（已逐条核对安装版 patch/产物）。

### 2.1 host 侧模块级 HMR：`@deepseek-ai/cordis-plugin-hmr`

- 实现：`vendor/hmr/src/index.ts`。`Hmr extends Service`，`inject = ['loader','timer']`。
  - **默认不启用**：`packages/bundle/base/cordis.patch.yml` 里 `id: hmr` 这一行是
    `disabled: true`（注释：module reload 是 profile 级别的 opt-in）。`web-app / headless / sdk-app / acp-app`
    都没有覆盖它（`apps/cli/tests/profile-hmr.spec.ts` 用 compose 断言了“继承 base 的 disabled 行”）。
  - **配置**（`Hmr.Config`，schema 即 Chokidar 选项的超集）：
    - `base?: string` —— 监控根的基础目录；`this.baseDir = fileURLToPath(new URL(config.base || '.', ctx.baseUrl))`。
    - `root: string[]`（默认 `['.']`）—— chokidar 要 watch 的路径（相对 base）。
    - `ignored`（默认 `['**/node_modules','**/.*','cache','data']`）。
    - `debounce`（默认 100ms）。
  - **变化分类**（`analyzeChanges` / `partialReload`）：
    - 属于框架依赖树（`externals`）的文件 → `loader.exit()`（整体重启，不叫“热更”）。
    - 在 Node ESM `loadCache` 里的文件（含经 `import()` 的 CJS）→ stash + debounce 后做 **partial reload**。
    - 其它 → 只发 `hmr/change` 事件。
  - **partial reload 的落地**：把 accepted 文件从 ESM `loadCache` 与 CJS `Module._cache` 中清出
    （先备份、失败可 rollback）→ 重新 `loader.import` 每个受影响的插件入口（**同一文件 URL 重新
    import 会得到全新的模块对象，模块级状态随之重置**）→ `registry.delete(旧插件)` → 用**新模块对象**
    按旧 fiber 的 config 重新 `registry.plugin` → 旧注册被 Cordis 自动清理，新 `apply` 生效
    （`vendor/hmr/src/index.ts` `reload()`）。任何一步抛错走 `rollback()` 还原旧模块。
  - **⚠️ 卸载不被等待**：`registry.delete(plugin)` 只同步发起 Cordis 的 fiber 卸载（`fiber.dispose()`），
    **不 `await`** 旧 fiber 的异步 disposer 跑完，紧接着就注册新 fiber、执行新 `apply`。所以旧实例
    的异步清理（如本文 §4 的 `flush()`）与新 `apply` **并发**，不保证先于新实例完成。依赖方不能把
    “旧 disposer 已排空”当作 HMR 的既定顺序。
  - 依赖 `ctx.loader.internal`（Node 内部 ESM loader 句柄）：`--expose-internals` 时直取，否则经
    `node-addon-require-builtin`（`vendor/loader/src/internal.ts`）——两种方式都可达即无需特殊启动参数。

### 2.2 live profile 的兜底：只 watch 用户 patch 层

`apps/cli/src/profile-boot.ts`：当 profile `patchReload: 'live'`（`web` profile 就是 live）且组合里
**没有 hmr 服务**时，启动器会创建一个 `root: []` 的 watch-only HMR 实例来热载用户
`cordis.patch.yml` / home patch（**只改配置、不替换源码模块**）。这与“模块级 HMR”是两回事：
- 没有显式 `hmr` 行 → 改 `cordis.patch.yml` 可热生效，但**改插件源码不会热更**。
- 显式 `hmr` 行 `disabled:false` → 模块级 HMR 激活（见 §3.1）。

### 2.3 client（浏览器 bundle）侧的 reload 链：`@deepseek-ai/dsh-client-hmr`

- **挂载**：`packages/bundle/web-app/cordis.patch.yml` 里 `client-hmr` 行**常驻挂载**
  （注释：“always mounted: it is idle until a rebuild watcher actually rewrites client bundles”），
  且 `@deepseek-ai/dsh-client-modules`（`id: modules`）提供 `/plugins/<id>/client.js` 与 `rev`。
- **node 半区**（`packages/client/hmr/src/index.ts`）：默认每 **500ms** stat-poll **每个 graph row**
  的 client bundle 文件（mtime+size），变化 → `clientModules.rebuilt(id)` 重哈希（**哈希没变就不广播**）
  → 经 `GET /plugins/events` 的 SSE 通道广播 `{ type:'rebuilt', id, rev }`。
- **浏览器半区**（`packages/client/hmr/src/client/index.ts`）：订阅该 SSE；收到 `rebuilt` 帧 →
  失效旧 factory → 预取新 bundle → registry-first 卸载旧 fiber（等其 disposer drain、删 owned
  `<style data-plugin>`）→ `entry.refresh()` 物化新 factory。**无需整页刷新**；数据层插件被替换会
  级联刷新其 UI 依赖（fiber `_refresh` 按 provider uid 级联）。
- **`rev` / immutable 缓存**：`/plugins/<id>/client.js?rev=…` 按内容哈希寻址，`rev` 在宿主启动时算好
  写入 `window.__DSH_BOOT__`；`client-hmr` 的 `rebuilt()` 会在**运行中**改写 entry 的 `rev` 并广播，
  所以宿主不是“永远只服务启动时的 rev”（见 §3.2 实测）。

---

## 3. 本项目实况（已逐条核对本机）

### 3.1 Host 侧：模块级 HMR **已启用**（不是默认状态）

`$DSH_HOME/profiles/web/cordis.patch.yml`（本机 = `C:\Users\28529\.dsh\profiles\web\cordis.patch.yml`）
在 base bundle 之上显式启用了 `hmr`：

```yaml
- id: hmr
  name: '@deepseek-ai/cordis-plugin-hmr'
  disabled: false
  config:
    base: 'file:///C:/Users/28529/Desktop/dsh-tokbook'
    root: ['.']
    ignored: ['**/node_modules', '**/.*', 'cache', 'data']
```

为什么必须这样配（注释已写，机制见 §2.1）：

- **base 指向本仓库**（`file:///…` URL，HMR 会 `new URL()` 再 `fileURLToPath()`）。
- **为什么 root 要 `['.']` 而 ignored 排除 `node_modules`**：`dsh-tokbook` 是经
  `dsh plugin --profile web add` 以 **junction** 装进 profile（`…\profiles\web\node_modules\dsh-tokbook`
  → `C:\Users\28529\Desktop\dsh-tokbook`）。HMR 默认 ignored 会忽略 `node_modules` 路径；插件实体
  “名义上”在 profile 的 node_modules 里，若不把 base 指向仓库并把仓库树纳入 watch，重建的
  `lib/index.js` 不会被看见。`ignored` 里的 `cache` / `data` 是本仓库不存在的顶层名，保留默认防御即可。

**启用边界**：`hmr` 行是启动时组合进 loader 的，**改动后需要一次完整的 `dsh web` 重启**才挂载；
挂载之后（进程不重启）改 host 源码即可热更。§2.2 的 watch-only 兜底不会出现——组合里已有显式 hmr 行。

**触发条件（本项目）**：HMR 观察的是**产物文件**，不是 `src/*.ts` 本身：

```sh
pnpm build     # scripts/build-client.mjs（esbuild）重写 lib/index.js（host）与 lib/client.js（client）
               # tsc -b 只产 lib/types/**/*.d.ts（tsconfig 为 emitDeclarationOnly）
```

`tsc --watch`（`pnpm watch`）**不会**重写 `lib/index.js`，所以只改源码不 build 不会触发 host 热更。

**实测证据（本机，运行中）**：`lib/index.js` 于 18:22:31 重建；数据目录
`~/.dsh/tokbook/owner.json` 的时间戳恰好是 **18:22:31** —— `owner.json` 只在 `TokenUsageBook`
构造时写，时间戳与重建产物落盘一致，说明**重建后该插件做了一次 module reload、重新 `apply`**
（而非进程重启）。注意：`owner.json` 里的 `pid` 是**写 owner 那一刻的宿主进程**，不是“此后永不
重启”的宿主 PID —— 它只能作为“这次 reload 发生过”的探针（每次 reload 都会重写该文件），不能
当作当前宿主进程的身份。其后 quota 快照 / `sync-progress.json` / 当日 `usage-*.jsonl` 持续更新，
证明 reload 后的实例正常工作。

### 3.2 Client 侧：链路是活的；本项目主路径 = `pnpm build` + 浏览器刷新

- `@deepseek-ai/dsh-client-hmr` 在 web-app bundle 里**常驻挂载**（§2.3），运行中的 GUI 实测
  `GET http://127.0.0.1:3080/plugins/events` 能收到 SSE：首帧 `: connected` + `{"type":"graph",…}`，
  graph 中同时存在 `@deepseek-ai/dsh-client-hmr` 与 `dsh-tokbook` 两个 entry。
- **reload 链确实活着（实测）**：graph 里其它 entry 的 rev 都带启动批前缀 `87866ab28633ef1e-N`，而
  `dsh-tokbook` 的 rev 是独立的 `56d79160f1b0` —— 即 18:22:31 那次 `pnpm build` 之后，
  `clientModules.rebuilt()` 已在**运行中**按新内容哈希改写该插件的 rev 并经 SSE 广播（`rebuilt`
  帧是浏览器热换的触发信号）。
- **本项目口径：client 改动以 `pnpm build` + 浏览器刷新为主路径，不依赖免刷新热更**（浏览器刷新
  成本可接受）：

  ```sh
  pnpm build     # 重写 lib/client.js（样式在 styles.ts，也打进这个 bundle）
  # host 半区：profile 已启用 cordis-plugin-hmr → 自动 卸载→重载→重 apply（§3.1）
  # client 半区：刷新浏览器取新 rev 的 bundle；client-hmr 活着时也可能 ≤500ms 免刷新热换，
  #              但那是加分项不是保证——没生效就硬刷新兜底（永远能取到新 rev）
  ```

- 这与 **DSH 仓库内的 `pnpm run dev:web`** 无关：`scripts/dev-web.ts` 的 watcher 只扫描 DSH 仓库
  `packages/*/*`（tsc+tsdown+vite 三段），**不会构建外置的 dsh-tokbook**。对本项目而言，
  “重建 bundle” 这一步就是仓库自己的 `pnpm build`；`dev:web` 只在你要同时改 DSH 仓库内 client
  包或 shell 本身时才需要（shell 变化仍要整页刷新）。
- 源码保存本身不触发：`src/client/*` 改动必须 `pnpm build` 落盘 `lib/client.js`，轮询才看得到。
- 兜底：某次没生效时（连接中断、页面在重建期间未打开等），重启 `dsh web` + 硬刷新
  （`Cmd/Ctrl+Shift+R`）一定能取到新 rev。

### 3.3 两套链各管各的（都以“产物变化”为触发）

| 半区 | 观察对象 | 热更执行者 | 本项目触发方式 |
| --- | --- | --- | --- |
| Host（Node/Cordis） | `lib/index.js`（仓库树，经 `base`/`root` 配置） | `@deepseek-ai/cordis-plugin-hmr`（profile 显式启用，§3.1） | 改 `src/index.ts` 等 host 源码 → `pnpm build` → 自动 卸载→重载→重 `apply` |
| Client（浏览器 bundle） | `lib/client.js`（graph row 的文件路径） | `@deepseek-ai/dsh-client-hmr`（web-app 常驻挂载，§3.2） | 改 `src/client/*` → `pnpm build` → **刷新浏览器取新 rev**（client-hmr 活着时可能 ≤500ms 免刷新，加分项非保证） |

两者互不影响、也不会互相误触发：host HMR 只重载 host 半区，client HMR 只换浏览器 bundle。

---

## 4. dsh-tokbook 为 HMR 做的适配（以及边界：什么才真正保证不双写）

先厘清两个**易被误读的官方保证**，它们直接决定下面哪几条是机制、哪几条只是 best-effort：

- **Cordis 的 `dispose` / 卸载确实“异步可等待”**——但那是对**显式 `fiber.dispose()`**（或依赖驱动
  的 dispose → auto-reload）而言：注册在 fiber 上的处置器会逆序被调用、多个异步处置器并发、返回的
  Promise 等所有异步清理完成。
- **模块级 HMR（cordis-plugin-hmr）不走这条可等待路径**：它调 `registry.delete(plugin)` **不 await**
  fiber 的异步卸载，随即重新 import 并 `apply` 新实例（§2.1 已注明）。因此：
  - 旧实例的 disposer 与新实例的启动**并发**，没有“旧先排空、新再写”的顺序保证；
  - hmr 清 cache 后重新 import，**同一文件 URL 得到全新模块对象** —— `usage-log.ts` / `stats.ts` 的
    模块级 `dirs` Map 也随之**重置为空**，新实例**不会继承**旧实例在途的队列与去重集合。

基于以上，本项目做的适配与真实边界是：

- **Fiber 卸载即停写（best-effort）**：`TokenUsageBook` 构造时
  `ctx.effect(() => () => { this.disposed = true; return this.log.flush() })`。这条 disposer 在
  **依赖 dispose → auto-reload / service-isolation teardown**（Cordis 会等待）时是可靠排空；在
  **模块级 HMR** 下只是并发地“尽量排空”。无论哪种路径，fire-and-forget 的续体（rollup 失效、
  `sync-progress.json` / quota 快照持久化）检查 `this.disposed` 后放弃收尾——旧实例不会替“已经换代”
  的世界写派生状态，这是**确实成立**的（只读 `disposed` 标志，不依赖卸载顺序）。
- **同一模块副本内：按数据目录共享去重/队列（真实机制，但不跨 HMR）**：`UsageLog` 的去重集合与
  串行 append 队列按 `data dir` 存放在模块级 `Map`（`src/usage-log.ts` `dirs`）。同一进程内凡是
  **共用同一份模块对象**的实例（依赖 dispose → auto-reload 后的新实例、service isolation 下的第二
  实例、重叠写入期的旧/新实例）都共享一套队列与去重，不会对同一 request id 双写。
- **跨模块级 HMR：真正兜底的是磁盘，不是内存 Map**：HMR 重载后新模块的 `dirs` 是空的，但
  `UsageLog.record()` 在**该目录的首次写之前**会先 `scan()`——从磁盘所有 day 文件重建 `seen` 去重集
  ——所以旧实例已经落盘的行不会被新实例重放。残余风险窗口只有一个：某个 request id 在旧实例
  flush 尚未落盘、而新实例 scan 已完成**之后**再次被投递（同一 id 在事件流里极少重放），此时双写
  可能发生。这是**概率窗口**，不是被机制消除的。
- **单一写进程标记**：`owner.json`（pid + 启动时间）每次构造重写。模块级 HMR 重建实例会重写它，
  所以它是“reload 发生过”的可靠探针（§3.1），但它记录的是**写 owner 那一刻的进程**，不是当前
  宿主进程的身份。

> 一句话：**“按目录共享队列/去重”只覆盖同一模块副本内的实例；跨模块级 HMR 的双写安全由“磁盘
> JSONL + 首次写 scan 重建 + request id 不重放”兜住，残余窗口极小但存在。** 文档早期版本把这些
> 说成“disposer 被等待 / 新实例继承旧队列”，与源码不符——已在 2026-09-07 修正。

---

## 5. 易错点 / 一页 Checklist

- [ ] base bundle 里 `hmr` 默认 `disabled: true`——模块级 HMR 要 profile patch 显式 `disabled: false`（本项目已配，勿删）。
- [ ] 改 host 源码后必须 `pnpm build`（esbuild 落盘 `lib/index.js`）才触发 host HMR；`tsc --watch` 只产 `.d.ts`。
- [ ] 改 client 源码后必须 `pnpm build`（落盘 `lib/client.js`）；主路径 = 刷新浏览器取新 rev；client-hmr 活着时可能 ≤500ms 免刷新热更（加分项，不依赖）。
- [ ] 插件须以 **link/junction** 装进 profile（`node_modules/dsh-tokbook → 本仓库`），否则 profile 读到的是拷贝、重建产物不可见。
- [ ] 启用/修改 `hmr` 行本身需要重启一次 `dsh web`；挂载后才是免重启热更。
- [ ] 兜底：某次没热更成功 → 重启 `dsh web` + 硬刷新（永远取到当前 rev）。
- [ ] `dev:web` 只重建 DSH 仓库内包；外置插件的重建 = 仓库自己的 `pnpm build`。
- [ ] 依赖本插件的派生收尾都要查 `disposed`；同一模块副本内的实例共享按数据目录的队列/去重，**跨模块级 HMR 不共享**——双写安全靠磁盘 JSONL + 首写 scan 重建。

---

## 6. 版本与出处（本次核对）

- 运行中的 Web GUI：`@deepseek-ai/dsh@0.1.2-rc.1`（`C:\Users\28529\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh`）。
- 安装到 web profile 的机制包：`C:\Users\28529\.dsh\profiles\node_modules\@deepseek-ai\`
  `cordis-plugin-hmr@1.0.17`、`dsh-client-hmr@0.1.2-rc.1`、`dsh-web-app@0.1.2-rc.1`、`dsh-base@0.1.2-rc.1`。
- 源码检出（`0.1.3-alpha.1`，机制参考）：`vendor/hmr/src/index.ts`、`vendor/loader/src/{index,internal}.ts`、
  `packages/client/hmr/src/{index.ts,client/index.ts}`、`packages/client/modules/src/index.ts`、
  `packages/bundle/base/cordis.patch.yml`、`packages/bundle/web-app/cordis.patch.yml`、
  `apps/cli/src/profile-boot.ts`、`scripts/dev-web.ts`。
- 官方文档：<https://deepseek-harness.github.io/deepseek-harness/develop/framework/#hmr-热模块替换>

相关本地文档：`docs/LESSONS.zh.md` §3（客户端 `rev` 缓存 + HMR 姿势）、`docs/DESIGN.zh.md` §8
（外置插件接入 `web` profile）。
