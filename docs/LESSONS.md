# dsh-tokbook 开发经验与踩坑记录（LESSONS）

> **Doc meta** · role: lessons · language: zh-CN · status: current · last-reviewed: 2026-09-16 · supersedes: —

> 本文件整理本次「UI 优化 + 全中文 + 对齐 DSH 官方设置按钮样式」迭代中踩过的坑与结论，
> 供后续维护 / 继续开发时对照。结构统一按 **现象 → 根因 → 修复 / 正确做法** 组织。
> 整理时间：2026-09。涉及的所有 DSH 源码路径均相对 `C:\Users\28529\Desktop\deepseek-harness`。

---

## 1. CSS 作用域选择器：`data-plugin` 与插件类放在同一元素上的坑（最重要）

### 现象

- token 账本按钮呈现**浏览器默认 button 样式**：`background-color: rgb(107,107,107)`（灰底）、
  `border: 2px outset white`、`border-radius: 0`、高度约 `25.5px`、`padding: 1px 6px`。
- 用户看到的是一个"灰色方框"，跟下面"设置"按钮（透明、纯图标+文字）完全不一致。
- 关键点：**注入的样式一条都没生效**，按钮被浏览器 UA 样式兜底。

### 根因

组件里把两个标记放在了**同一个元素**上：

```tsx
<button type="button"
        className="dtpl-footer"
        data-plugin="dsh-tokbook" ...>   ← 同一元素同时有 data-plugin 和 dtpl-footer
```

而 `styles.ts` 里写的是**后代选择器**（中间有空格）：

```css
[data-plugin="dsh-tokbook"] .dtpl-footer{ ... }   /* 需要 "外层 data-plugin" + "内层 .dtpl-footer" */
```

后代选择器要求 `[data-plugin]` 是 **祖先**、`.dtpl-footer` 是 **后代**；但这里是**同一个元素**，
所以永远匹配不上 → 所有 `.dtpl-footer` 规则失效 → 落到 UA 默认样式。弹窗容器 `.dtpl-overlay` 同样中招。

### 修复

凡是「**自身携带 `data-plugin` 的元素**」，选择器要用**复合**（无空格）：

```css
[data-plugin="dsh-tokbook"].dtpl-footer{ display:flex; ... background:transparent; ... }
[data-plugin="dsh-tokbook"].dtpl-overlay{ position:fixed; inset:0; ... }
```

以及这些根元素的状态/修饰也改用复合形式：

```css
[data-plugin="dsh-tokbook"].dtpl-footer:hover{ background:var(--dsw-alias-interactive-bg-hover); }
[data-plugin="dsh-tokbook"].dtpl-footer:active{ ... }
[data-plugin="dsh-tokbook"].dtpl-footer.dtpl-rail{ width:36px;height:36px;border-radius:50%; }
[data-plugin="dsh-tokbook"].dtpl-footer[aria-pressed="true"]{ color:var(--dsw-alias-brand-primary); }
[data-plugin="dsh-tokbook"].dtpl-footer:focus-visible{ outline:2px solid var(--dtpl-accent); }
```

**真正的子元素**（`[data-plugin]` 的子孙）保持后代选择器即可：

```css
[data-plugin="dsh-tokbook"] .dtpl-foot-ico{ width:16px;height:16px; }     /* svg 在按钮内 */
[data-plugin="dsh-tokbook"] .dtpl-card{ ... }                              /* 卡片是 .dtpl-overlay 的后代 */
```

### 口诀 / 判别

- **口诀**：`data-plugin` 只是"作用域标记"。
  - 它和插件根类在**同一元素** → 用 `[data-plugin].类`（复合，无空格）。
  - 它只是**祖先**（根类在它内部）→ 用 `[data-plugin] .类`（后代，有空格）。
- **判别**：DevTools 选元素看 computed style，若出现 UA 默认值（`background-color: rgb(107,107,107)`、
  `border: 2px outset`、`border-radius: 0`），就是选择器没匹配上。

---

## 2. 此插件的"样式"就是 JS bundle 的一部分，不是独立 CSS

- CSS 拆在 `src/client/styles/*.ts`，由 `styles.ts` 的 `injectStyles()` 按**固定顺序**拼接后
  在运行时注入 `<style>`——**级联顺序是契约**，顺序以 `styles.ts` 的 import 为准(不在此处抄
  一份清单:抄的那份漏过 `pricing-timeline`)。
- esbuild 会把这些字符串**编译进 `lib/client.js`**。
- 因此「改一行样式」= 改变了 lazy-CJS bundle 的字节内容，跟改逻辑**没有区别**，同样受下方 `rev`
  不可变缓存约束。**没有"只改样式就自动热更"这回事。**

### 陷阱：分片里的注释不能出现反引号（2026-09-16）

每个分片都是 `export const CSS_X = ` + 一个**模板字符串**。所以在 CSS 注释里写 Markdown 风格的
反引号（`` `00:00–24:00` ``、`` `aria-label` ``、`` `!important` ``）会**提前闭合模板串**：后面的
CSS 变成 JS 语法错误，`pnpm typecheck` / `pnpm build` 当场红。

- **现象**：`src/client/styles/quota.ts(152,62): error TS1005: ',' expected`、`TS1121: Octal
  literals are not allowed` 之类，报的行号指向**注释那一行**，看代码却毫无问题。
- **正确做法**：分片里的注释用中文引号（『』「」），或干脆不加反引号；模板串里也不要出现 `${`。
- **快速自检**：每个分片应恰好 4 个反引号（JSDoc 里一对 + 模板串首尾一对；
  `pricing-timeline.ts` 是 6 个——它的 JSDoc 里另有一对）：

  ```powershell
  Get-ChildItem src/client/styles/*.ts | ForEach-Object {
    $t = Get-Content $_.FullName -Raw
    "{0,-22} {1}" -f $_.Name, ([regex]::Matches($t,'`').Count)
  }
  ```

---

## 3. 客户端 bundle 按 `rev` 不可变缓存 + HMR 的正确姿势

> **机制与接线的真源是 [`HMR.md`](HMR.md)**（§2 源码落点、§3 本项目实况与判定方法、§5 一页
> Checklist）。本节只留动手时最容易踩错的那条判断。

| 动作 | 结果 |
|------|------|
| 只改代码 + 保存 | 浏览器看到的是旧 bundle（要 `pnpm build` 落盘 `lib/client.js`） |
| `pnpm build`（client-hmr 活着） | ≤500ms 内免刷新热更——**加分项,不是保证**;主路径仍 = `pnpm build` + 刷新浏览器 |
| `pnpm build` 后重启 `dsh web` + **硬刷新**（`Cmd/Ctrl+Shift+R`） | 永远取到新 `rev` 的 bundle（兜底） |
| 只刷新、不重启 | **危险**:宿主已重哈希 `rev`,浏览器仍按启动时的旧 `rev` 请求 → `/plugins/<id>/client.js` 按「pathname+rev」精确匹配不到 → **404**,插件可能加载失败（按钮消失）。判定热更链是否活着见 HMR.md §3.2 |

改动时的完整清单（`disabled: false`、junction 安装、跨模块重载的双写边界）见
[`HMR.md`](HMR.md) §5。

---

## 4. 外观对齐「官方设置按钮」：外置插件的正确做法

### 官方按钮在哪里、能不能复用

- 官方侧栏脚部设置按钮：`packages/client/ui-settings-general/src/client/SettingsRoot.module.css`
  的 `.trigger` / `.trigger.rail`（由 `SettingsRoot.tsx` + `chrome.tsx` 的 `TriggerContent` 渲染）。
- 它是**模块私有 CSS**，**没有导出**可复用组件。
- `@deepseek-ai/dsh-client-ui-primitives` 只有通用 `Button`（胶囊形 `h36/r18`，变体
  `primary | ghost | outline | toolbar`），**不是**侧栏脚部控件。
- 外置插件**不能 import** 别的插件私有 CSS module（bundle purity 门槛 + 未导出）。

### 正确做法：用同一套 `--dsw-*` 令牌复刻几何/颜色

关键令牌 / 几何（对齐 `SettingsRoot.module.css`）：

| 状态 | 几何 / 颜色 |
|------|------------|
| 宽侧栏 | `flex:1` 满宽、`height:42px`、`border-radius:12px`、`border:none`、`background:transparent`、`padding:0 10px 0 8px`、`gap:8px`、`font-size:14px / line-height:22px`、`color:var(--dsw-alias-label-primary)`；hover=`--dsw-alias-interactive-bg-hover` |
| 折叠 rail | 36×36 圆、`border-radius:50%` + `corner-shape:round`、居中、图标 18px、主墨色 |
| 按压态 | 用 `aria-pressed` 承载状态；`color:var(--dsw-alias-brand-primary)`（注意别只靠颜色传达状态） |

### 图标

- 用**内联描边 SVG**（如 `icons.tsx` 里的 `UsageGlyph`/`CloseGlyph`，2px 圆头、`currentColor`）；
  **不要**用「∑」「✕」文本符号或 emoji。
- 给 SVG 加 `aria-hidden="true"` + `focusable="false"`；图标按钮要有可访问名字（`aria-label`）。
- 插件**不能 runtime-import 非基线图标包**（bundle purity gate），所以内联 SVG 是外置插件的首选。

---

## 5. 构建与安装要点

命令清单与产物见 [`../README.md`](../README.md)「构建」。这里只留会踩的三条:

- **`pnpm watch` 只跑 `tsc --watch`,不重建 `lib/client.js`**——改了源码要手动 `pnpm build`;
  想要自动重建得改 watch 脚本。
- `build-client.mjs` 给 client 构建加了 `charset:'utf8'`,让产物保留**字面中文**(默认会转义成
  `\uXXXX`,不便于排查)。
- **client 入口不要 `export default`**(cordis loader 的 `exports.default ?? exports` 会让它掩盖
  `.inject`);`dsh.client` 必须 `platform:'web'`、`./client` 能解析到 `lib/client.js`,且
  `BASELINE_EXTERNALS` 要跟 DSH 的 `PLATFORM_MODULES` 保持一致(随 DSH 升级同步)。

---

## 6. 用浏览器桥接（kimi-webbridge）验证真实渲染

### 为什么需要

宿主 Web 在 `http://127.0.0.1:3080` 需要登录（未认证请求返回 **401**），`curl` 拿不到真实页面。
用 kimi-webbridge 借用用户当前标签页（`find_tab {active:true}`，`session` 每任务一个），即可在真实
页面里 `snapshot` / `evaluate` / `screenshot`。

### 坑与做法

- **选择器**：元素自身同时带 `data-plugin` 和插件类时，`document.querySelector('[data-plugin] .class')`
  会 **not found**——应直接用 `.class` 或复合 `[data-plugin].class`（对应 §1）。
- 先 `snapshot`（无障碍树）确认元素存在（按钮名，如 "词元账本" / "设置"），再 `evaluate` 读
  `getComputedStyle`。
- `evaluate` 每次用 **IIFE** 包变量，避免 `const` 重声明冲突。
- Windows 上发请求：**非 ASCII 走文件体 POST**（`curl.exe --data-binary @file`），避免 PowerShell 破坏中文；
  每个请求用独立随机文件名。
- 判"选择器是否命中"：读 computed `background-color` / `border` / `height`，若为 UA 默认值
  （`rgb(107,107,107)` / `2px outset` / 25.5px），就是样式没命中。
- **「当前标签页」会漂**:用户自己在浏览时,桥接的 current tab 可能已经不是宿主页——`evaluate`
  会落到别的页面上,表现是"什么都查不到"（返回 `null` 或空值）而不是报错。**每次 evaluate /
  screenshot 前先 `find_tab`**(拿完整 URL,如 `http://127.0.0.1:3080/`)。
- **预览台的 bundle 是热的,端口不是**:`/client.js` 现在**按请求读盘**(并带 `cache-control: no-store`),
  所以 `pnpm build` 之后刷一次页面就够——2026-09-20 之前它在启动时快照一次,那时「改动没生效」的
  误判多半来自这里。(仍然只读一次的是 `TOKBOOK_MODE`:换形状要换进程。)
- **端口被占时先换端口、别急着杀**:同一台机器上可能留着上次会话的预览台(2026-09-15 实测
  8931/8932/8941 三个都活着)。用 `PORT=8955 node --experimental-strip-types scripts/preview-overlay.ts`
  换一个空端口最省事;真要复用原端口,`job_kill` 杀掉的是外层 shell,`node` 子进程可能还占着——
  用 `Get-NetTCPConnection -LocalPort 8931 -State Listen` 看 `OwningProcess`,确认是 `node` 再
  `Stop-Process`。
- **`TOKBOOK_MODE` 决定整台的形状,不是 query flag**:`?empty=1` / `?err=1` 是**旧提示**,
  实际读的是环境变量,一个进程一种形状——`empty`(四路都空)/ `err`(四路都 500)/
  `sync` / `syncerr`(诊断带的两态);`?dark=1` / `?tab=` / `?quota=` 才是 query flag。
  要同时看两种形状就起两个进程、两个端口。
- **整页截图在 `backdrop-filter` 下会说谎**:遮罩(`.dtpl-overlay`)带 `backdrop-filter` 时,
  Chromium 的**整页**截图会把深色卡片拍成浅色(实测同一页面:整页截图浅、元素截图与
  `getComputedStyle` 都是 `rgb(38,39,43)`)。判断颜色一律以 computed style 或**元素截图**
  (`screenshot '.dtpl-card'`)为准,或临时 `overlay.style.backdropFilter='none'` 再整页拍——
  别据此判定"深色模式坏了"。
- **独立查看器模式**看不见同步路径**的成本**:`--ledger` 模式刻意不挂 `sessionPersistence`
  (它只读已入账的历史),所以 `ensureFresh()` 的探针与权威 walk **一次都不跑**。2026-09-15
  那次「打开通道用量 / 价格表要加载半天」正是因此长期没被发现:harness 里一切都在几十毫秒内。
  要复现这类问题,要么自己挂一个 `inspect()` 很慢的 persistence 桩,要么读 host 日志里的
  `[tokbook] sync: … in <ms> ms` 那一行(该行现在带耗时与会话数)。

---

## 7. `<button>` 会把内容垂直居中——固定高度的绝对定位按钮会踩到

### 现象

时间轴的节点是 `position:absolute; height:100%` 的 `<button>`，里面是「日期」+「圆点」。
同一套 CSS 下，纯 `<span>` 的端点标签停在轨道**上方**，而**有段可点的**那一端（一次调价的生效
时刻正好落在首记，折成节点）标签整整低了 12px，跑进中间那排。

### 根因

`<button>` 的 UA 布局会把**内容盒垂直居中**——Chrome 里 `display:block` 也一样居中，
`align-items:flex-start`、`padding-top` 都改不动。盒子是整条轨道高（36px），内容只有 12px，
于是被居中到 12–24px：CSS 写的 `margin-top` 没有被违反，只是它不再是位置的决定者。

### 修复

把按钮变成**列向 flex 容器**，UA 的居中就不再介入：

```css
[data-plugin="dsh-tokbook"] button.dtpl-tl-node{
  display:flex;flex-direction:column;justify-content:flex-start;
}
```

三种候选实测：`display:flex;flex-direction:column;justify-content:flex-start` ✅ 标签回到
0–12px；`align-items:flex-start` ❌（不是 flex 容器，无效果）；`box-sizing:border-box;
padding-top:24px` ❌（居中照旧）。**判据**：固定高度 + 绝对定位 + 靠 margin/padding 定位内容的
按钮，先量内容盒的实际 y，别相信 margin。

---

## 8. DSH 会话持久化面换 API：`inspect()` → `open(id,'read')` + `read()`（2026-09-23）

### 现象
账本只涨 live hook 记下的行；历史回填一行不写，而 `/tokbook/sync` 一路报 `done`（`error: null`），
`sync-progress.json` 的 `sessions` 还被写成 `{}`——于是**每次重启后都重走一遍全部会话**（本机 329 个、
上百秒），却什么也没回填。

### 根因
DSH 0.1.7 的 `sessionPersistence` 只剩 `create/open/stat/list/flush`：旧的整份读取 `inspect(id)` 与旧
列表名 `listSnapshots()` 都没了。`syncHistory` 每会话调 `inspect` → TypeError → 按设计计入
`failedSessions` 并继续；`doSync` 随后把这一批 id 从基线里删掉（`setBaseline(snapshots, failed)`），
**全部失败 = 基线清空**。两个症状因此叠在一起，且都不冒错。

### 修复
`src/sync.ts` 的 `SyncPersistence` 同时吃两代形状：列表走 `list()`（回 `{header, revision}` 快照），
日志走 `open(id,'read')` → `read()`（默认给到日志末尾）→ `close()`；旧名 `inspect()` /
`listSnapshots()` 仍在，新宿主上缺席就自动走新路。只读句柄不取写所有权，可与在写的宿主并行。

### 连带：信封 `seq` 不是行身份（2026-09-23 已清账）
walk 一通就暴露出第二件事：V4 迁移会**稠密重排信封 `seq`**，而 `compaction:` / `failure:` 两类行的
requestId 当时绑在 `seq` 上——同一事件被记成两个身份、各占一行。存量账本实测：31,796 行里
**229 行是重复**（113 行同一 requestId 逐字节重复 + 116 个事件两个 seq 键；失败行 465 行对应 353 个
事件）。修法：

- 身份改成**跨格式稳定的事实**：压缩用 `compactionId`，失败用 `turn`（一个回合只关一次）或
  `retryId` + 第几次；只有畸形/旧形态缺这些字段才回落到 `seq`（`src/usage-record.ts`）。
- 存量按当前日志重算身份、就地重写日文件并去重（一次性脚本，先备份到 `~/.dsh/tokbook/.ledger-migrate-backup-*`）：
  31,796 → 31,588 行、0 重复、0 歧义，3 行无源日志保留；再跑一轮 walk `added = 0`。
- 注意 `~/.dsh/tokbook` 是**宿主在写**的目录：重写前先备份、落地前复核文件大小/mtime 未变，否则跳过。

### 口诀
**host 缝“没抛错”不等于“在干活”**：任何能把失败整段吞掉、又把失败者从基线里剔除的 walk，都必须让
失败可观察——否则它会以“成功且无事发生”的样子长期空转。
另一句：**派生账本的行身份必须是事件自带的事实，不是它在日志里的坐标**（seq 只是坐标）。

---

## 9. 一页速查（Checklist）

- [ ] 选择器：元素自身带 `data-plugin` → 用复合 `[data-plugin].class`；真子元素 → 用后代 `[data-plugin] .class`。
- [ ] 改 UI（client）后：`pnpm build` 落盘 `lib/client.js` → 刷新浏览器取新 rev（client-hmr 活着时可能 ≤500ms 自动热更，加分项非保证）。
- [ ] 改 host 后：`pnpm build` 落盘 `lib/index.js` → host HMR 自动 卸载→重载→重 `apply`（profile 已启用 `hmr`）。
- [ ] 会话持久化面按两代写：当前 `list()` + `open(id,'read')`，旧 `listSnapshots()` / `inspect()` 作为回落（见 §8）。
- [ ] 派生账本的行身份只能用事件自带的事实（`message.id` / `compactionId` / `turn` / `retryId`），不用日志坐标 `seq`（见 §8）。
- [ ] 兜底（首次接线 / 没热更上）：`pnpm build` → **重启 `dsh web`** → **硬刷新**（`Cmd/Ctrl+Shift+R`）。
- [ ] `pnpm run dev:web` 只重建 DSH 仓库内包；外置插件的重建 = 自己的 `pnpm build`（详见 [`HMR.md`](HMR.md)）。
- [ ] 只刷新不重启（且热更链没生效时）：会因 `rev` 不符被拒 → 可能插件加载失败，**不要**。
- [ ] 图标用内联 SVG；文案用中文；给可访问名字与 `aria-pressed`/`aria-label`。
- [ ] 对齐 DSH 外观：用 `--dsw-*` 令牌复刻，别 import 私有 CSS module。
- [ ] client 入口无 `export default`；esbuild 加 `charset:'utf8'`。
- [ ] 用 kimi-webbridge 时：先 `snapshot`，再 `evaluate` 读 computed style；**每次调用前先 `find_tab`**（当前标签页会漂）。
- [ ] 验**焦点交互**（失焦保存 / blur 重置 / 焦点环）前先 `cdp` → `Emulation.setFocusEmulationEnabled`：
  `Page.bringToFront` 只把标签页置前，**窗口自己没被聚焦时 `document.hasFocus()` 仍是 false**，此时
  `focus()` / `blur()` 一个 focus 事件都不派发——测试会"跑通"却什么都没测（`focusout` 监听器可以
  先自证：真触发才有事件）。开完先确认 `hasFocus: true` 再下断言。
- [ ] 用 `scripts/preview-overlay.ts` 看效果：**刷新页面即可**（`/client.js` 按请求读盘），并确认 8931 端口已释放。
- [ ] 预览台端口被占：换 `PORT=8955`，别急着杀（`job_kill` 只杀外层 shell，`node` 子进程会留在端口上）；空 / 错 / 同步态用 `TOKBOOK_MODE=empty|err|sync|syncerr` 环境变量。
- [ ] 判断颜色别用整页截图：`backdrop-filter` 会让深色卡拍成浅色；用元素截图或 `getComputedStyle`。
- [ ] 绝对定位 + 固定高度的 `<button>`：内容会被 UA 布局**垂直居中**；要贴顶就 `display:flex;flex-direction:column;justify-content:flex-start`（见 §7）。
- [ ] **动自动保存链（`PricingPanel`）时记住它的隐含前提：draft 永不原地 mutate。** 成功路径必须用
  **compose 前冻结的 snapshot** 推进 baseline，而不是 await 之后的 live draft——否则 PUT 在途的键入
  会被标成「已保存」、重写被跳过，**静默丢字**。这是那轮审查里唯一的 critical。
