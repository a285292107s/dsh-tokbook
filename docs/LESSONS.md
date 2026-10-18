# dsh-tokbook 开发经验与踩坑记录（LESSONS）

> **Doc meta** · role: lessons · language: zh-CN · status: current · last-reviewed: 2026-10-18 · supersedes: —

> 本文件是**踩坑记录的累积**，供后续维护 / 继续开发时对照；条目按 **现象 → 根因 → 修复 / 正确做法**
> 组织。**DSH 源码路径均相对同一处检出**——那台机器上 `C:\Users\28529\Desktop\deepseek-harness`，
> 换机器时把前缀换掉即可（文中不再逐条重复绝对路径）。
> 每条记录的是**当时**的实测；判据（怎么判断、哪里会静默出错）留着，具体数字与版本会随升级漂移。

---

## 1. CSS 作用域选择器：`data-plugin` 与插件类放在同一元素上的坑（最重要）

### 现象

- 词元账本按钮呈现**浏览器默认 button 样式**：`background-color: rgb(107,107,107)`（灰底）、
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
  一份清单:抄的那份会漏)。
- esbuild 会把这些字符串**编译进 `lib/client.js`**。
- 因此「改一行样式」= 改变了 lazy-CJS bundle 的字节内容，跟改逻辑**没有区别**，同样受下方 `rev`
  不可变缓存约束。**没有"只改样式就自动热更"这回事。**

### 陷阱：样式表的所有权（谁注入、谁持有 disposer）

**现象**：把样式注入从 `apply` 挪进浮窗组件、或让 `injectStyles()` 每次都返回一个真会撤表的 disposer，
就会出现两种相反的坏法——关掉浮窗之后，宿主里那个**词元页**样式全掉（它的根还在，只是规则没了）；
或者反过来，浮窗从未打开过，词元页从头到尾没有样式。

**根因**：`apply` 里那次注入由 `ctx.effect` 持有，是**唯一**真正会移除这张表的 disposer；浮窗里那句
`useEffect(() => injectStyles(), [])` 拿到的只是空操作（注入是幂等的）。而词元页是宿主渲染的视图，
它跟浮窗**没有任何挂载关系**——「等某个面挂载再注入」这个想法在这里不成立。

**正确做法**：在插件装载时注入一次；浮窗那次调用只保证"打开的时候一定有"。任何"按面注入 / 按面撤销"
的改法都会把另一面的样式当陪葬。

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
- `@deepseek-ai/dsh-client-ui-primitives` 只有通用 `Button`（`h36`，`border-radius` 走
  `--dsw-radius-md`，变体 `primary | ghost | outline | toolbar`），**不是**侧栏脚部控件。
- 外置插件**不能 import** 别的插件私有 CSS module（bundle purity 门槛 + 未导出）。

### 正确做法：用同一套 `--dsw-*` 令牌复刻几何/颜色

**抄几何，不抄圆角。** 宿主的 `.trigger` 用 `border-radius: var(--dsw-radius-md)`（12px），而本插件的
圆角是**直角不变量**（`--dtpl-radius: 0px`，`selfcheck:ui` 强制只许 `0` / `50%` / `var()`）——所以
只对齐高度、内距、间距、字号与墨色，圆角照自己的规矩来。其余几何（对齐 `SettingsRoot.module.css`）：

| 状态 | 几何 / 颜色 |
|------|------------|
| 宽侧栏 | `flex:1` 满宽、`height:42px`、`border:none`、`background:transparent`、`padding:0 10px 0 8px`、`gap:8px`、`font-size:14px / line-height:22px`、`color:var(--dsw-alias-label-primary)`；hover=`--dsw-alias-interactive-bg-hover` |
| 折叠 rail | 36×36 圆、`border-radius:50%` + `corner-shape:round`、居中、图标 18px、主墨色 |
| 按压态 | 用 `aria-pressed` 承载状态；`color:var(--dsw-alias-brand-primary)`（注意别只靠颜色传达状态） |

### 图标

- 用**内联描边 SVG**（如 `icons.tsx` 里的 `UsageGlyph`/`CloseGlyph`，2px 圆头、`currentColor`）；
  **不要**用「∑」「✕」文本符号或 emoji。
- 给 SVG 加 `aria-hidden="true"` + `focusable="false"`；图标按钮要有可访问名字（`aria-label`）。
- 插件**不能 runtime-import 非基线图标包**（bundle purity gate），所以内联 SVG 是外置插件的首选。

---

## 5. 构建与安装要点

命令清单与产物见 [`../README.zh.md`](../README.zh.md)「构建」。这里只留会踩的三条:

- **`pnpm watch` 只跑 `tsc --watch`,不重建 `lib/client.js`**——改了源码要手动 `pnpm build`;
  想要自动重建得改 watch 脚本。
- `build-client.mjs` 给 client 构建加了 `charset:'utf8'`,让产物保留**字面中文**(默认会转义成
  `\uXXXX`,不便于排查)。
- **client 入口不要 `export default`**(cordis loader 的 `exports.default ?? exports` 会让它掩盖
  `.inject`);`dsh.client` 必须 `platform:'web'`、`./client` 能解析到 `lib/client.js`,且
  `BASELINE_EXTERNALS` 要是 DSH `PLATFORM_MODULES` 的**子集**——只列本插件真的 import 的那几个
  (它同时是一道判死表外 import 的门禁,照全集抄会把这道门关掉)。细节见 DESIGN §7。

---

## 6. 在真实渲染里验证界面（先无头 `playwright-cli`）

### 用哪一个

**默认走无头 `playwright-cli`**（默认无头、独立会话，不干扰维护者前台那个浏览器）——大多数验证
（截图、量 computed style、读无障碍树）它都做得到。它做不到的才回落 **kimi-webbridge**：需要维护者
**真实登录态**或他那套浏览器环境时——宿主 Web 在 `http://127.0.0.1:3080` 需要登录（未认证请求返回
**401**），无头会话拿不到那个页面，桥接则可以借用他当前标签页（`find_tab {active:true}`，`session`
每任务一个）。

下面这些坑大多与工具无关（选择器、截图口径、预览台端口）；只有 `find_tab` 那条是桥接独有的，
已单独标注。

- **选择器**：元素自身同时带 `data-plugin` 和插件类时，`document.querySelector('[data-plugin] .class')`
  会 **not found**——应直接用 `.class` 或复合 `[data-plugin].class`（对应 §1）。
- **（仅桥接）** 先 `snapshot`（无障碍树）确认元素存在（按钮名，如 "词元账本" / "设置"），再
  `evaluate` 读 `getComputedStyle`。
- **（仅桥接）** `evaluate` 每次用 **IIFE** 包变量，避免 `const` 重声明冲突。
- Windows 上发请求：**非 ASCII 走文件体 POST**（`curl.exe --data-binary @file`），避免 PowerShell 破坏中文；
  每个请求用独立随机文件名。
- 判"选择器是否命中"：读 computed `background-color` / `border` / `height`，若为 UA 默认值
  （`rgb(107,107,107)` / `2px outset` / 25.5px），就是样式没命中。
- **（仅桥接）「当前标签页」会漂**:用户自己在浏览时,桥接的 current tab 可能已经不是宿主页——`evaluate`
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

## 8. DSH 会话持久化面换 API：`inspect()` → `open(id,'read')` + `read()`

### 现象
账本只涨 live hook 记下的行；历史回填一行不写，而 `/tokbook/sync` 一路报 `done`（`error: null`），
`sync-progress.json` 的 `sessions` 还被写成 `{}`——于是**每次重启后都重走一遍全部会话**（本机 329 个、
上百秒），却什么也没回填。

### 根因
那一版 DSH 的 `sessionPersistence` 只剩 `create/open/stat/list/flush`：旧的整份读取 `inspect(id)` 与旧
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

## 9. ARIA 引用必须真的落地：三种不会报错的失效

### 现象

- 一种写法是四个 tab 各写一个自己的 `aria-controls`（比如 `dtpl-panel-<tab>`），只有第一个 panel 存在：
  读屏按「关联面板」跳过去是空的，键盘焦点走到 tab 上之后没有可落的地方。代码读起来更"对"，因为它
  看起来每个 tab 都有自己的面板。
- `<div aria-label="口径速览">` 这种写法：标签在，读屏从不念它。
- 额度卡的 `unconfigured`（「未配置 API key」）用了 `role="alert"`，于是每次打开 tab 都播报一次"告警"。

三种情况下屏幕上都看不出异常：数字、颜色、布局全对。

### 根因

面板是**同一个**滚动容器、内容随 tab 换，所以只能有一个 tabpanel。四个 `aria-controls` 指向同一个 id
是对的，各写一个自己的才是错的——**指向一个不存在的 id 比不指更糟**：不指是"没声明关系"，
指向空是"声明了一条假关系"。

ARIA 的可访问名字只挂在**支持命名的角色**上。`div` 是 generic，给它 `aria-label` 浏览器不会暴露给读屏；
要名字就得先给角色（这份事实在 `MethodDoc` 用 `role="group"` 落成）。

`role="alert"` 是一件事**正在发生**，不是一种样式：它让读屏立刻播报。「未配置」是提示，不是错误——
把两者放进同一个角色，等于每次都说一次假警报。

这三件都不破坏渲染，所以"页面看起来对不对"这类验证一个都抓不到；`selfcheck:ui` 第 8 项只比对
**字面量** id，模板串与变量目标在静态里无从判定。

### 正确做法

- 一个 tablist 一个 tabpanel，`aria-labelledby` 指向当前 tab 的 id（动态那半截由渲染保证）。
- 引用前先确认目标会渲染：错误态把切法条整条收掉时，`aria-labelledby` 必须跟着撤
  （`ProviderPanel` 就是这么做的）。同一条判据在两处出现过，不是巧合。
- 要命名先给角色；`role="alert"` 只给真的出错。
- 图形（柱状图、悬停读数卡）可以 `aria-hidden`，但同一份读数在键盘够得着的地方必须有一份完整的。

---

## 10. 样式里多一个 `}`，浏览器会静默吞掉下一条规则

### 现象

某天页面"滚不动"：浮窗里那一屏内容溢出、滚轮不动，`overflow` 在 DevTools 里是 `visible`、
`flex-grow` 是 `0`——样式表里却明明白白写着 `overflow:auto`。查选择器、查类名、查作用域全都对，
`pnpm selfcheck:ui` 前八项也全绿。

### 根因

CSS 解析器遇到多余的 `}` 不会停：它进入错误恢复，把紧随其后的**一整条规则**丢掉，然后照常解析
剩下的。实测被吞掉的是 `.dtpl-tok-scroll`，于是滚动区退回默认值。

这条规则里的类名还在 TSX 里（死类检查绿）、颜色与圆角都合规（色值与圆角两项绿），拼接后数括号
还会把一个片段的缺口平摊到邻居头上。它是"一串连锁里最后才暴露的那个"：多出来的括号通常来自一次
手工删改，改的人不会看到报错。

### 正确做法

- `selfcheck:ui` 第 9 项**逐片段**数括号：注释与字符串先跳过（`content:"}"` 是合法值，不是括号），
  两个方向都报（多一个 `}`、少一个 `}`）。逐片段判出的行号才是真位置。
- 改完样式要去真实渲染里量那个元素（`overflow`、`flex-grow`、`getBoundingClientRect`），别只看 diff。
  静态检查能证明的只是"文本没坏"。

---

## 11. 静态禁令拦得住哪一半

### 现象

"看到就是错"的清单若只写在文档里，既没人读、又会随改动漂；搬进 `selfcheck:ui` 之后它不读也生效。
但九项**不是同一个强度**：前五项是逐类 / 逐行判定，第 6–8 项只是"存在性"，第 9 项是逐片段括号配平。
把它们当同一道门，很容易把"全绿"读成"这一屏没问题"。

### 这九项各自在防的静默错

- **死类双向比对**：样式里定义了没人用的类，以及 TSX 里挂着却没有规则的类。后者在浏览器里就是
  "这个元素拿默认样式"，是最难靠眼睛发现的一类。
- **硬编码色值**：只许出现在 `var(--宿主变量, #兜底)` 的兜底里或 `color-mix()` 里——否则宿主换皮肤时
  这一处不跟。
- **虚线**、**非 `0` / `50%` / `var()` 的圆角**：视觉语言被悄悄换掉。
- **`--dsw-*` 直连白名单**：宿主变量的作用域假设变了，别的片段也开始依赖它。
- **`prefers-reduced-motion` / `:focus-visible` / 窄屏 `@media`**：整段被删掉时页面照常渲染，
  所以只能断言"它还在"。
- **字面量 ARIA / `htmlFor` 引用**：见 §9。
- **括号配平**：见 §10。

### 正确做法

- 记住强度差别：第 6–8 项只证明"某处有"，**不校验覆盖面**；"这一处的 `outline:none` 有没有替代
  指示"、"这句话是不是重复编码"仍是人的判断，脚本不冒充。
- 死类比对必须取**完整**类名：`-` 在类名里合法，把 `dtpl-price-history-foot` 截成
  `dtpl-price-history` 会凭空造出一个"没人用的类"。动态拼出来的那一半只可能以**前缀**形式被静态看到，
  所以两侧各另收一遍前缀，互为镜像。
- `id` / `aria-controls` 里的名字是结构性锚点，`--dtpl-*` 是自定义属性，两者都**按上下文排除**，
  不往例外表里塞名字——一张空例外表只会让人以为还有例外。
- 这一份脚本用 `node --experimental-strip-types` 直接跑，**从不由 tsc 编译**：脚本里的类型错误只有
  真的跑它时才现形；它也不构建、不起服务，验的是文本而不是界面。

---

## 12. 渲染期抛错会摘掉 slot——载荷先验形，别把半成品塞进 store

### 现象

- 一次载荷形状漂移（host 改了字段，或某张卡少了 `models`），浮窗**再也打不开**：footer 按钮还在、
  点得动，但什么都不出现。关掉重开、刷新页面都没用。
- 或者只有某一块消失（用量明细整块没了），其余 tab 正常。

### 根因

渲染期抛错时，宿主会为这次异常把这条 **list 型 slot** 的挂载点摘掉。于是 `open` 还是 true、按钮还是
活的，浮窗却没有地方可挂——不是"数据没到"，是"容器没了"。

半成品一旦进了 store / 缓存，下一次渲染还会在同一处抛；错误条那条"重试"路径永远走不到，因为渲染
先炸了。而这类载荷往往 JSON 合法、`fetch` 成功，缺的是渲染会**无条件解引用**的字段
（`byDay` 里的 `day` / `totals`、`records`、`dataDir`、`syncStatus`）。

### 正确做法

- 每个载荷入口一个 `readXxx(raw): T | null`（`LedgerOverlay` 的 `readOverview`、`PricingPanel` 的
  `readPricingView`、`ProviderPanel` 的 `readUsageView`、`QuotaPanel` 的两个判定）。**只盖渲染会无条件
  解引用的字段**：可选字段与细节一律不收紧，否则一次正常演进也会被判死。
- 判定放在**任何 setState 之前**：不合法就当一次读失败，走错误态（错误条 + 重试）——那是唯一的恢复入口。
- 反过来的一面是词元页：它没有"重试就有一份完整数据"的假设，于是 `session-wire` 走另一条路——
  逐字段补中性值，把缺口显式印成"用量未知 / 未计时 / 价格未知"，而**整段缺席且无法想象**的东西
  （子代理血缘）返回 `undefined`，绝不填成"0 个子代理"。判据不是"严好还是松好"，是**这份坏了能不能
  重试**：能，就拒绝半成品；不能，就在界面上把缺口说出来。

---

## 13. 账本变了，得有人告诉界面——但别拿全量载荷当探针

### 现象

- 会话还在跑，浮窗里的数字停在打开那一刻；词元页更糟：每 15 秒盲轮询一次，每一跳宿主都要把该会话
  日志整份读来 join，会话停下了也照跳。
- 追「重新扫描」时最容易被读成"扫描很慢"：walk 其实已经落定，界面还在等。

### 根因

写侧每落一行只推进自己的内存计数，读侧没有任何通知。而能当探针的东西很窄：概览是一次全量聚合
（本机约 0.1 s），拿它轮询等于把负载压在正被 walk 压着的路径上；把"读不到"当"没变化"，界面就永久冻住。

### 正确做法

- 用一个**只读内存**的凭证：宿主端出 `SyncStatusView.ledger`（目录代数，每落一行 +1，实测一次 2–6 ms）。
  时钟按它探，订阅者只在代数**真的变了**之后才拉自己那份载荷——那才是贵的那一步。
  - **只比相等，不比大小**：它是进程内计数器，重启 / HMR 会归零。
  - **读不到 ≠ 没变化**：旧宿主不给这一格时 `ledgerClockSupported()` 为 false，调用方保留自己的定时轮询，
    否则这一页永久冻住。
  - **没有订阅者就不探**；页面在后台整段停，回到可见立刻补探一次；一串变化合并成一跳（一轮对话落三行
    不该重载三次）。
- 贵的那个面才订阅：浮窗只在总览页跟账本（概览为 hero 与页脚服务），切走不跟、切回来补一次并节流；
  词元页与用量明细各自订阅同一口时钟。
- 追一轮 walk 的**退出条件看屏上那份快照，不看探针**：`rescan` 的 walk 是 fire-and-forget 起跑的，
  探针完全可能在你第一次问的时候还答 `done`。所以"探针说落定"之后仍要拉一次概览，它自己报 `running`
  就继续追。
- 两条 follow 循环（打开浮窗那条、重新扫描那条）必须登记在同一个 `AbortController` 上：新一轮开始先
  中止上一轮，关窗也中止——否则两条循环同时每 500 ms 打同一场 walk。**被中止不算失败**，别把"关掉了"
  报成"扫不动"。
- 词元页的轮询是兜底而不是主路径：请求带单调请求号（只有最新一次允许落屏）、卸载/换会话要中止、
  一次比轮询间隔还慢时跳过该 tick、失败**不清屏**（一次抖动不该把已读到的账本换成一页空白）。

---

## 14. 预览台是一份契约，不是一堆假数据

### 现象

- 预览台里一切正常，到真宿主才炸：client 读了一个**只在 fixture 里存在**的键，或者某个形状被 fixture
  顺手"修好"了。
- 反过来：预览台里根本看不到"正在重新扫描…"、"上次重新扫描失败：…"、空态、错误态，于是这些句子
  长期没人读过。
- 最气人的一种：预览台说"加载失败"，理由是 `Unexpected token '<'`——它在说 client 解析错了，其实是
  缺了一路 fixture。

### 根因

fixture 的**路径**不会错（`ROUTE_*` 与 `QUERY_*` 全部从 `route-paths.ts` import），但**载荷是手写的**。
手写的东西会漂：多一个键、少一路、编一个 host 产不出的形状，都不报错。多一个键尤其危险——它会把
"client 依赖了 host 不发的字段"这一整类 bug 藏起来。

### 正确做法

- **键集合与 host 的组装处逐字对齐**。overview 里 host 不发的那些键一个都不要带；预览台端不出的形状，
  宁可缺，不要补。
- **只端 host 端得出来的形状**：卡片头上的 `records` 必须等于它各行之和（host 用同一次折叠同时算这
  两个数）；查价 fixture 不放**同键异价**（`parseCatalog` 遇到会整键弃采，fixture 放两条只会造出"两条
  都标着就是搜的这个"）；错误的形状是 **500 + 错误体**，不是 200 + `{error}`（后者会被 client 当一份
  合法总览去渲染，然后炸掉整个浮窗）。
- **状态要够得着**：`TOKBOOK_MODE`（empty / err / sync / syncerr）是环境变量，一个进程一种形状；
  额度那十种形状走 `?quota=`；词元页形状走 `TOKBOOK_SESSION_SCENARIO`。进程只读一次 env，所以
  "换形状"= 换端口/换进程，不是换 URL。看不到的状态等于没有。
- **日期键用本地日**：fixture 若用 `toISOString()` 生成 `YYYY-MM-DD`，UTC+8 的凌晨那几小时里"今天"会落到
  前一天——hero 整块归零，而你会以为预览台没数据。
- **未知的 `/tokbook/*` 显式 404**：落到页面 HTML 会让 client 报 `Unexpected token '<'`，既不说缺的是
  哪一路，也不说缺在预览台。独立查看器（`--ledger`）由真 host 作答，那一路的坑换成另一条（见 §6）。
- **无头校验前先设 `window.__PREVIEW_NO_AUTO = true`**：auto-open 循环每 100 ms 点一次、只认 URL 上的
  `?tab=`，会和校验脚本自己的点击抢。

---

## 15. 动画只在元素重挂时重播

### 现象

- 数据刷新了，柱子 / 块不动——以为入场动画坏了；于是给元素摘 class 再挂回去想重播，结果首帧闪一下，
  或者和轮询打架。
- 计数（`CountUp`）在轮询刷新时反复数，读者每次看都在跳。

### 根因

CSS 动画由**元素的挂载**触发；React 重渲染不重挂 DOM，动画不会重播。反过来，只要元素真的换了
（`key` 变了、块被卸载再挂），动画就重新开始——你不需要任何"播完摘类"的监听。

### 正确做法

- 入场类静态挂着（`is-anim`），把"只播一次"当默认：数据刷新不重播正是想要的。
- 想重播就显式制造重挂（刷新按钮用 `key={tick}` 让内层图标每次按下都是新元素），而不是清 class。
- 别把动画挂在会频繁重挂的父级上：面板整块重挂发生在切 tab、骨架换真块——那时重播是对的；轮询刷新
  不重挂，所以不会反复数、反复升起。

---

## 16. 卸载边界：偏好、上一份视图、未落盘草稿各放哪儿

### 现象

- 切走再切回：从骨架屏重来；刚选的窗口 / 模型回到第一个。
- 价表草稿还在，但"未保存"的提示没了；或者一次还没触发的自动保存连同草稿一起消失。
- 或者相反：把草稿当磁盘状态画出来，看起来"已经保存了"。

### 根因

面板随 tab 切换 / 浮窗关闭**整块卸载**，组件 state 活不过那一刻；而宿主的往返（读价文件 + 账本透镜 +
路由目录，本机 0.2–0.5 s）不能每次重来。宿主只渲染活动视图，所以切走再切回是整块重挂。

### 正确做法

- **视图偏好**（看哪个窗口、自动刷新多久、价格表选中哪一行、词元页列宽）进 `localStorage`：它们是每台
  浏览器自己的选择，不是账本数据，也活不过卸载。读回时只认合法值，坏值一律回落默认——别让一个记不住的
  旧值决定控件显示什么。
- **上一份干净视图**进模块级缓存（`lastView` / `lastViews`），只为"先画出来"，挂载后那次读照常覆盖它。
  **只在视图干净时存**：有未落盘草稿时那份 `view` 是"读磁盘那一刻"的快照，拿它当首帧会让人以为磁盘上
  已经是草稿的样子。
- **未落盘草稿**进模块级 `staged`（含它 rely 的基线）：卸载时既不丢、也不假装已保存；重新挂载时只把
  真正 dirty 的那几处压到新读回的视图上（`mergeStaged`），"有哪些通道"永远由宿主说了算——留着一份陈旧
  整卡只会在下一次写回里把它重新写进文件。
- 缓存要有上界（按窗口数 / 按会话条数）；命中缓存也要**推进请求号**，否则上一个窗口的在飞响应会落到
  这一份上（错误条同理）；清错误条要在缓存短路**之前**做。
- `localStorage` 两个真实陷阱：`Number(null)` 是 `0`，而 `0` 是合法预设（自动刷新"关闭"）——缺键必须先判
  `null`；隐私模式下读 / 写都可能抛，两处都要兜，回落到默认而不是让这一屏挂掉。

---

## 17. 自动保存链的前提：草稿永不原地 mutate

### 现象

改一格价，马上接着改下一格，回来发现后改的那几个字"没了"：状态栏说"已保存"，文件里是前一次的值。
没有报错，没有提示。这是那轮审查里唯一的 critical。

### 根因

一次 PUT 在途时用户继续键入，`state` 已经更新；响应落地时若按 **live draft** 推进基线，那几个还没写出去
的字就被算成"已落盘"。于是脏标记归零、下一次防抖发现没有改动就不写——**静默丢字**。

同一类问题还有两个方向：PUT 之前发起的 GET 在 PUT 之后才 resolve（采纳它会把刚写进去的价从屏上抹掉，
脏点跟着灭）；写成功后用响应重新播种（会 remount 正在输入的输入框，焦点丢）。

### 正确做法

- `writeNow` 在 compose **之前**冻结一份 snapshot，成功时只用这份 snapshot 的签名推进基线；await 之后的
  live ref 只用来判断"期间又攒了改动没有"。
- 写入器串行化：在飞期间的新改动排队一次，成功之后立刻接上下一笔，别让这一笔之后的重写被跳过。
- 每次成功写入推进一个**写入代数**；`loadView` 发起前记下它，响应落地时对不上就整份丢弃——不 seed、
  不 merge、也不碰保存状态。
- 本地草稿保持唯一真源，不要从响应重新播种。
- 报错只在**提交点**说：字段失焦、或回到面板。打字途中的失败必然是半输入造成的，那一刻报错只会把
  "还没打完"读成"你错了"。两个细节：没有待写改动时这次 blur 不算一次"交代"（否则随便点一下就把下一次
  打字途中的报错放行）；下拉换人的 blur 也不算（弹层里没有字段可交代）。
- 离开 tab / 关浮窗不能搁浅：待写的立刻写，还没发出的"已更新"通知立刻发（别的 tab 正拿它算金额）。

---

## 18. 数一取整、单位一猜，界面就在说谎

### 现象

- 一个占 0.4% 的桶显示"占 0%"——读者读成"没有"。
- 99.95% 被印成 100%（"满"与"几乎满"是两回事）。
- 价格格里敲 `0x10`，被读成 16；换算一次之后文件里出现 `1.0050000000000001`。

### 根因

"顺手 `Math.round`"和"顺手 `Number()`"都是不报错的近似：前者把"有一点"说成"没有"，后者接受十六进制；
浮点乘法不取整会把噪声写进磁盘，而磁盘是唯一真源。

### 正确做法

- 占比：不足 1% 写 `<1%`，99.x 不凑成 100；比率恒定一位小数并**截断**（展示只会低估）。
- 解析金额只收十进制（可带指数），拒绝 `0x` / `0b` / `0o`；空串是"未填"不是 0。
- 换算结果按固定小数位取整再写文件；显示时去掉尾零并避免指数记法（`1.4e-8` 塞进格子既读不出也写不回）。
- 时间同理：`0 秒` 与"未计时"是两件事，`0 个子代理` 与"读不到血缘"是两件事——缺席必须留在缺席状态，
  别在中性化时抹成 0。

---

## 19. 热区是给指针不可靠的设备的

### 现象

桌面上鼠标点得中，触屏 / 窄屏上点不中；或者窄屏上关闭按钮成了"唯一出口但很难点"。

### 根因

命中区由 CSS 尺寸决定，视觉尺寸与可点区域不一定一样；拿鼠标点一遍、截一张图都验证不出来。窄屏的
sheet 尤其糟：它整块贴底，关闭钮是**唯一**的显式退出（Escape 不算指针手段）。

### 正确做法

- 高频控件（窄屏关闭钮、价格表展开钮、额度刷新）按 **44px** 这一档给热区——视觉 24 也行，热区补到 44。
- 骨架屏要与实际块同高：否则数据到达时高度跳一次，热区也跟着跳。
- 验证时量 computed 尺寸或开触屏仿真，别靠"我点到了"——鼠标在 16px 的图标上也能点中。

---

## 20. 一页速查（Checklist）

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
- [ ] 浏览器验证**先走无头 `playwright-cli`**；要真实登录态才回落 kimi-webbridge（那时先 `find_tab`，当前标签页会漂）。先 `snapshot` 确认元素存在，再读 computed style。
- [ ] 验**焦点交互**（失焦保存 / blur 重置 / 焦点环）前先 `cdp` → `Emulation.setFocusEmulationEnabled`：
  `Page.bringToFront` 只把标签页置前，**窗口自己没被聚焦时 `document.hasFocus()` 仍是 false**，此时
  `focus()` / `blur()` 一个 focus 事件都不派发——测试会"跑通"却什么都没测（`focusout` 监听器可以
  先自证：真触发才有事件）。开完先确认 `hasFocus: true` 再下断言。
- [ ] 用 `scripts/preview-overlay.ts` 看效果：**刷新页面即可**（`/client.js` 按请求读盘），并确认 8931 端口已释放。
- [ ] 预览台端口被占：换 `PORT=8955`，别急着杀（`job_kill` 只杀外层 shell，`node` 子进程会留在端口上）；空 / 错 / 同步态用 `TOKBOOK_MODE=empty|err|sync|syncerr` 环境变量。
- [ ] 判断颜色别用整页截图：`backdrop-filter` 会让深色卡拍成浅色；用元素截图或 `getComputedStyle`。
- [ ] 绝对定位 + 固定高度的 `<button>`：内容会被 UA 布局**垂直居中**；要贴顶就 `display:flex;flex-direction:column;justify-content:flex-start`（见 §7）。
- [ ] ARIA：一个 tablist 一个 tabpanel（共享容器），错误态收掉 tab 条时 `aria-labelledby` 一起撤；要命名先给角色；`role="alert"` 只给真错误（见 §9）。
- [ ] 改样式后量真实盒子；括号配平交给 `pnpm selfcheck:ui`，别人工数（见 §10）。
- [ ] 记住静态禁令的强度：前五项逐类判、第 6–8 项只证明"存在"、第 9 项逐片段（见 §11）。
- [ ] 载荷先验形再进 store：渲染期抛错会让宿主摘掉 list 型 slot，浮窗从此打不开（见 §12）。
- [ ] 新鲜度用 `ledger` 探针，别拿全量概览轮询；追 walk 落定看屏上快照、不看探针；中止不算失败（见 §13）。
- [ ] 预览台 fixture 与 host 的键集合逐字对齐，不造生产里没有的形状；`TOKBOOK_MODE` 一个进程一种形状；无头校验前设 `__PREVIEW_NO_AUTO`（见 §14）。
- [ ] 动画只在元素重挂时播：入场类静态挂着，想重播就换 `key`（见 §15）。
- [ ] 面板随 tab 卸载：偏好进 `localStorage`、上一份干净视图进模块缓存、未落盘草稿进 `staged`（见 §16）。
- [ ] **动自动保存链（`PricingPanel`）前读 §17：draft 永不原地 mutate，成功只在 compose 前冻结的 snapshot 上推进基线。**
  否则 PUT 在途的键入会被标成「已保存」、重写被跳过，**静默丢字**。
- [ ] 数字：不足 1% 不取整成 0、99.x 不凑成 100、金额解析只收十进制、换算结果写盘前取整（见 §18）。
- [ ] 触屏热区按 44px 档给；验证靠量尺寸或触屏仿真，别靠鼠标点得中（见 §19）。
