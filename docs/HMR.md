# dsh-tokbook · DSH 热重载（HMR）机制与本项目实况

> **Doc meta** · role: lessons · language: zh-CN · status: current · last-reviewed: 2026-09-23 · supersedes: —

> 面向 DeepSeek Harness（DSH）插件热重载机制的**官方语义 + 本项目实际接线与实测**。
> 官方依据：<https://deepseek-harness.github.io/deepseek-harness/develop/framework/#hmr-热模块替换>（“插件与生命周期”页）。
> 本地核对：运行中的 Web GUI = 全局安装 `@deepseek-ai/dsh@0.1.7-alpha.1`；DSH 源码检出
> `C:\Users\28529\Desktop\deepseek-harness` = `0.1.7-alpha.2`（`00102833df`，2026-09-22，作机制参考，文中已注明出处）。
> 整理时间：2026-09-07（同日修正 §2.1 / §4：模块级 HMR 的卸载**不被等待**、模块级状态**不跨 HMR
> 共享**——早期版本把这两点说反了，详见 §4 结尾说明）。
> **2026-09-23 修订**：模块改名 `cordis-plugin-hmr` → `dsh-hmr`；profile patch 里**重申模块名**的那一行会被
> 启动器按「name mismatch」整行跳过（本项目正是这样静默失去了模块级热更，见 §3.1）。§2.1 / §2.2 / §3.1 /
> §5 / §6 的包名、base 行语义、版本与实测证据均已按 `0.1.7-alpha.1` 重新核对；§3.2 的 client 链本轮只做了
> 一次抽查（SSE graph 与 `dsh-tokbook` 的独立 rev 仍在），其余仍为 2026-09-11 的记录。

---

## 1. 官方文档怎么说（framework 页 · HMR 一节）

> 原文与 fiber 状态机（`PENDING → LOADING → ACTIVE` / `→ UNLOADING → DISPOSED` / `→ FAILED`）
> 逐态含义见官方页,不在此复述:
> <https://deepseek-harness.github.io/deepseek-harness/develop/framework/#hmr-热模块替换>。

**一句话: HMR = 一次受控的「卸载旧插件 → 重载新代码 → 重新 `apply`」**,安全的前提是
「所有注册自动清理、异步清理可被等待」。三条与写代码直接有关的保证:

- 凡经 `ctx` 做的注册在插件卸载时**自动撤销**(`ctx.on` / `ctx.tools.register` /
  `ctx.llm.registerAdapter` / `ctx.effect(() => cleanup)`);处置器按注册顺序的**逆序**开始调用。
- 多个异步处置器**并发**执行、不保证逐个完成 —— 所以**有顺序依赖的清理必须放进同一个
  `ctx.effect()` 返回的处置器里自行串行**。
- `ctx.plugin(...)` 返回的 fiber 可 `await fiber.dispose()`,保证注册被移除、子插件递归卸载、
  Promise 在所有异步清理完成后兑现;`inject` 的服务消失时插件自动卸载,恢复后重新加载。

---

## 2. 这套机制在 DSH 里的实现落点（源码核对）

以下路径相对 DSH 源码检出 `C:\Users\28529\Desktop\deepseek-harness`（`0.1.7-alpha.2`），
行为与运行中的 `0.1.7-alpha.1` 安装一致（已逐条核对安装版 patch/产物）。

### 2.1 host 侧模块级 HMR：`@deepseek-ai/dsh-hmr`

- **模块名**：`0.1.7` 起 DSH 用 `@deepseek-ai/dsh-hmr`（实现 `packages/boot/hmr/src/index.ts`
  + `watch-config.ts`）。同仓库 `vendor/hmr` 仍是上游 `@deepseek-ai/cordis-plugin-hmr@1.0.19`
  的 vendored 副本；dsh-hmr 的 README 对此的说法是 “The vendored package remains available;
  DSH profiles use this package.”——**留着的是 vendored 那份，DSH 用的是 dsh-hmr**，而
  **dsh-base 的依赖就是 `dsh-hmr`**、全局安装里已无 `cordis-plugin-hmr`。README 同时给了迁移口径：
  “Existing configurations replace the module name `@deepseek-ai/cordis-plugin-hmr` with
  `@deepseek-ai/dsh-hmr`.”——所以 profile patch 里**不要再写 `name:`**（§3.1）。
- `Hmr extends Service`。**由 base bundle 插入并启用**：`packages/bundle/base/cordis.patch.yml`
  的 `id: hmr` 行是 `name: '@deepseek-ai/dsh-hmr'` + `disabled: !!js "!ctx.get('profileContext')"`
  + `config.root: []` —— 有 profileContext 的启动器（`web` 就是）拿到的是**已启用但只 watch 配置**
  的行；`headless / sdk-app / acp-app` 各自再 `disabled: true` 把它关掉
  （`apps/cli/tests/profile-hmr.spec.ts` 用 compose 断言这一组语义）。
  模块级 watching 是 profile 级的 opt-in：patch 只覆写 `config`（§3.1）。
- **配置**（`Hmr.Config`，schema 即 Chokidar 选项的超集）：
  - `base?: string` —— 监控根的基础目录；`this.baseDir = fileURLToPath(new URL(config.base || '.', ctx.baseUrl))`。
  - `root: string[]`（默认 `['.']`；base 行显式给 `[]`）—— chokidar 要 watch 的路径（相对 base）。
    `[]` = 只保留显式的配置 watch，不 watch 任何模块树。
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
  （`packages/boot/hmr/src/index.ts` `reload()`）。任何一步抛错走 `rollback()` 还原旧模块。
- **profile patch / manifest 走同一条队列**：HMR 初始化时注册用户 patch（`cordis.patch.yml`、
  home patch）与 profile manifest 的 watch，变化即重组配置（`runExclusive` 串行）。所以**改 patch
  行本身就是热生效的**，包括改 `hmr` 行自己的 `config`（§3.1 实测）。
- **⚠️ 卸载不被等待**：`registry.delete(plugin)` 只同步发起 Cordis 的 fiber 卸载（`fiber.dispose()`），
  **不 `await`** 旧 fiber 的异步 disposer 跑完，紧接着就注册新 fiber、执行新 `apply`。所以旧实例
  的异步清理（如本文 §4 的 `flush()`）与新 `apply` **并发**，不保证先于新实例完成。依赖方不能把
  “旧 disposer 已排空”当作 HMR 的既定顺序。
- 依赖 `ctx.loader.internal`（Node 内部 ESM loader 句柄）：`--expose-internals` 时直取，否则经
  `node-addon-require-builtin`（`packages/boot/hmr/src/index.ts` 的检查、`vendor/loader/src/internal.ts`
  的回落）——两种方式都可达即无需特殊启动参数（本机安装带该 addon，已核对）。

### 2.2 base 行就是 watch-only 兜底：只 watch 配置不需要额外行

`0.1.7` 的 base bundle 已经把 `hmr` 行插进组合（§2.1），`0.1.2-rc.1` 里“组合中没有 hmr 服务时由
启动器另建一个 `root: []` 实例”的兜底已不存在（源码里已无 `patchReload`）。因此：
- base 行（`root: []`）→ 改 `cordis.patch.yml` / home patch 可热生效，**改插件源码不会热更**；
- 再把该行的 `config.root` 覆盖成 `['.']`（§3.1）→ 模块级 HMR 才激活。

### 2.3 client（浏览器 bundle）侧的 reload 链：`@deepseek-ai/dsh-client-hmr`

- **挂载**：`packages/bundle/web-app/cordis.patch.yml` 里 `client-hmr` 行**常驻挂载**
  （注释：“The client-plugin reload chain, always mounted: it is idle until a rebuild watcher
  (pnpm run dev:web) actually rewrites client bundles.”），
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
在 base bundle 之上把 `hmr` 行的 `root` 打开（**只按 id 覆写，不重复模块名**）：

```yaml
- id: hmr
  disabled: false
  config:
    base: 'file:///C:/Users/28529/Desktop/dsh-tokbook'
    root: ['.']
    ignored: ['**/node_modules', '**/.*', 'cache', 'data']
```

**⚠️ 不要写 `name:`**：启动器按 (id, name) 匹配 patch 行，模块名对不上就**整行跳过**（`disabled` /
`config` 一起丢），只在启动输出里留一句。2026-09-23 前的本机配置写的还是改名前的
`name: '@deepseek-ai/cordis-plugin-hmr'`，于是：

```
dsh: [...\cordis.patch.yml] patch: name mismatch for "hmr"
     (expected "@deepseek-ai/dsh-hmr", got "@deepseek-ai/cordis-plugin-hmr"), skipping
```

结果不是报错、而是**静默退回 base 行的 `root: []`**——配置能热载、模块级 HMR 全关，`pnpm build`
之后插件毫无动静。校验组合是否吃到了这一行（只读、不启动服务）：

```sh
dsh --profile web --dump-config | grep -A8 'id: hmr'
# 期望：name 是 @deepseek-ai/dsh-hmr，且 config.root 是 ['.']；出现 "name mismatch" 即没吃到
```

为什么必须这样配（机制见 §2.1）：

- **base 指向本仓库**（`file:///…` URL，HMR 会 `new URL()` 再 `fileURLToPath()`）。
- **为什么 root 要 `['.']` 而 ignored 排除 `node_modules`**：`dsh-tokbook` 是经
  `dsh plugin --profile web add` 以 **junction** 装进 profile（`…\profiles\web\node_modules\dsh-tokbook`
  → `C:\Users\28529\Desktop\dsh-tokbook`）。HMR 默认 ignored 会忽略 `node_modules` 路径；插件实体
  “名义上”在 profile 的 node_modules 里，若不把 base 指向仓库并把仓库树纳入 watch，重建的
  `lib/index.js` 不会被看见。`ignored` 里的 `cache` / `data` 是本仓库不存在的顶层名，保留默认防御即可。

**启用边界（2026-09-23 实测修正）**：base 行在 `web` profile 里**始终挂载**（`root: []`），而
profile patch / manifest 的 watch 与 patch 行本身走 HMR 的同一条重组队列（§2.1）。所以**改这一行不需要
重启**：本机改完 patch 后约 5 s，`GET /tokbook/pricing` 就从 500 变成 200（该次重组把 `tokbook` 行也
重新 apply 了一遍，吃到了刚 build 的产物）。只有“组合里根本没有 hmr 行”的 profile 才需要一次完整
`dsh web` 重启。

**触发条件（本项目）**：HMR 观察的是**产物文件**，不是 `src/*.ts` 本身：

```sh
pnpm build     # scripts/build-client.mjs（esbuild）重写 lib/index.js（host）与 lib/client.js（client）
               # tsc -b 只产 lib/types/**/*.d.ts（tsconfig 为 emitDeclarationOnly）
```

`tsc --watch`（`pnpm watch`）**不会**重写 `lib/index.js`，所以只改源码不 build 不会触发 host 热更。

**实测证据（本机，2026-09-23 运行中）**：`pnpm build` 前 `GET /tokbook/sync` =
`{"status":"done","lastSyncAt":1790096202959}`；build 后同一个 route 立刻变成
`{"status":"idle","lastSyncAt":null}`——`lastSyncAt` 只在 `TokenUsageBook` 构造时归零、同步落定才写，
所以这个翻面证明**实例被卸载并重新 `apply` 了**（不是进程重启）。随后 `/tokbook/pricing` 200、
`/tokbook/sync` 重新走到 `done`，说明新实例正常工作。较老的一版用 `~/.dsh/tokbook/owner.json` 的
mtime 作探针（它只在构造时重写，同样只在 reload 时变），今天仍是有效探针；`lastSyncAt` 的优势是
不用碰数据目录。

### 3.2 Client 侧：链路是活的；本项目主路径 = `pnpm build` + 浏览器刷新

- `@deepseek-ai/dsh-client-hmr` 在 web-app bundle 里**常驻挂载**（§2.3），运行中的 GUI 实测
  `GET http://127.0.0.1:3080/plugins/events` 能收到 SSE：首帧 `: connected` + `{"type":"graph",…}`
  （2026-09-23 实测 64 个 entry，graph rev `88901c1372ed`）。
- **reload 链确实活着（实测）**：graph 里每个 entry 带自己的内容哈希 rev，`dsh-tokbook` 是
  `16c36ea4e189`（独立于其它 entry）——`pnpm build` 之后 `clientModules.rebuilt()` 会在**运行中**
  按新内容哈希改写该插件的 rev 并经 SSE 广播（`rebuilt` 帧是浏览器热换的触发信号）。
- **本项目口径：client 改动以 `pnpm build` + 浏览器刷新为主路径，不依赖免刷新热更**（浏览器刷新
  成本可接受）：

  ```sh
  pnpm build     # 重写 lib/client.js（样式在 client/styles/*.ts，也打进这个 bundle）
  # host 半区：profile 已按 id 覆写 hmr 行（root:['.']）→ 自动 卸载→重载→重 apply（§3.1）
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
| Host（Node/Cordis） | `lib/index.js`（仓库树，经 `base`/`root` 配置） | `@deepseek-ai/dsh-hmr`（base 行 + profile 覆写 `root`，§3.1） | 改 `src/index.ts` 等 host 源码 → `pnpm build` → 自动 卸载→重载→重 `apply` |
| Client（浏览器 bundle） | `lib/client.js`（graph row 的文件路径） | `@deepseek-ai/dsh-client-hmr`（web-app 常驻挂载，§3.2） | 改 `src/client/*` → `pnpm build` → **刷新浏览器取新 rev**（client-hmr 活着时可能 ≤500ms 免刷新，加分项非保证） |

两者互不影响、也不会互相误触发：host HMR 只重载 host 半区，client HMR 只换浏览器 bundle。

---

## 4. dsh-tokbook 为 HMR 做的适配（以及边界：什么才真正保证不双写）

先厘清两个**易被误读的官方保证**，它们直接决定下面哪几条是机制、哪几条只是 best-effort：

- **Cordis 的 `dispose` / 卸载确实“异步可等待”**——但那是对**显式 `fiber.dispose()`**（或依赖驱动
  的 dispose → auto-reload）而言：注册在 fiber 上的处置器会逆序被调用、多个异步处置器并发、返回的
  Promise 等所有异步清理完成。
- **模块级 HMR（dsh-hmr）不走这条可等待路径**：它调 `registry.delete(plugin)` **不 await**
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

- [ ] base bundle 已经插入 `hmr` 行（`@deepseek-ai/dsh-hmr`，有 profileContext 时启用，`root: []` = 只 watch 配置）；模块级 HMR 要 profile patch **按 id** 覆写 `config.root: ['.']`（本项目已配，勿删）。
- [ ] patch 行**绝不写 `name:`**：写成改名前的 `@deepseek-ai/cordis-plugin-hmr` 会被「name mismatch」整行跳过、静默退回 `root: []`；用 `dsh --profile web --dump-config` 核对。
- [ ] 改 host 源码后必须 `pnpm build`（esbuild 落盘 `lib/index.js`）才触发 host HMR；`tsc --watch` 只产 `.d.ts`。
- [ ] 改 client 源码后必须 `pnpm build`（落盘 `lib/client.js`）；主路径 = 刷新浏览器取新 rev；client-hmr 活着时可能 ≤500ms 免刷新热更（加分项，不依赖）。
- [ ] 插件须以 **link/junction** 装进 profile（`node_modules/dsh-tokbook → 本仓库`），否则 profile 读到的是拷贝、重建产物不可见。
- [ ] 改 `hmr` 行的 `config` 不需要重启（patch watch 会重组并热 apply）；只有组合里**没有** hmr 行时才需要重启一次 `dsh web`。
- [ ] 兜底：某次没热更成功 → 重启 `dsh web` + 硬刷新（永远取到当前 rev）。
- [ ] **热更链没生效时不要只刷新**：宿主已按新内容重哈希、浏览器仍按启动时的旧 `rev` 请求 → `/plugins/<id>/client.js` 按「pathname+rev」精确匹配不到（源码注释口径 "mismatched revisions are rejected"）→ **404**，插件可能加载失败（按钮消失）。先按 §3.2 确认链活着再刷新。
- [ ] `dev:web` 只重建 DSH 仓库内包；外置插件的重建 = 仓库自己的 `pnpm build`。
- [ ] 依赖本插件的派生收尾都要查 `disposed`；同一模块副本内的实例共享按数据目录的队列/去重，**跨模块级 HMR 不共享**——双写安全靠磁盘 JSONL + 首写 scan 重建。

---

## 6. 版本与出处（本次核对）

- 运行中的 Web GUI：`@deepseek-ai/dsh@0.1.7-alpha.1`（`C:\Users\28529\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh`）。
- 安装到 web profile 的机制包：`C:\Users\28529\.dsh\profiles\node_modules\@deepseek-ai\` 的 junction 指向
  全局安装；本轮实际生效的是 `dsh-hmr@0.1.7-alpha.1`、`dsh-client-hmr@0.1.7-alpha.1`、
  `dsh-web-app@0.1.7-alpha.1`、`dsh-base@0.1.7-alpha.1`（`dsh-base` 的 `dependencies` 里是
  `@deepseek-ai/dsh-hmr: ^0.1.7-alpha.1`，**不是** `cordis-plugin-hmr`）。该目录里遗留的
  `cordis-plugin-hmr` junction 目标已不存在（悬空链接：DSH 会跳过，不影响启动）。
- 源码检出（`0.1.7-alpha.2`，`00102833df` 2026-09-22，机制参考）：`packages/boot/hmr/src/{index,watch-config}.ts`、
  `vendor/loader/src/{index,internal}.ts`、`packages/client/hmr/src/{index.ts,client/index.ts}`、
  `packages/client/modules/src/index.ts`、`packages/bundle/base/cordis.patch.yml`、
  `packages/bundle/web-app/cordis.patch.yml`、`apps/cli/tests/profile-hmr.spec.ts`、`scripts/dev-web.ts`。
- 官方文档：<https://deepseek-harness.github.io/deepseek-harness/develop/framework/#hmr-热模块替换>

相关本地文档：`docs/LESSONS.md` §3（客户端 `rev` 缓存 + HMR 姿势）、`docs/DESIGN.md` §8
（外置插件接入 `web` profile）。
