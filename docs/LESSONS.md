# dsh-tokbook 开发经验与踩坑记录（LESSONS）

> **Doc meta** · role: lessons · language: zh-CN · status: current · last-reviewed: 2026-09-12 · supersedes: —

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

- CSS 拆在 `src/client/styles/*.ts`（tokens / footer / overlay / ledger / method /
  provider / quota / pricing / shared），由 `styles.ts` 的 `injectStyles()` 按固定顺序
  拼接后在运行时注入 `<style>`——**级联顺序是契约**。
- esbuild 会把这些字符串**编译进 `lib/client.js`**。
- 因此「改一行样式」= 改变了 lazy-CJS bundle 的字节内容，跟改逻辑**没有区别**，同样受下方 `rev`
  不可变缓存约束。**没有"只改样式就自动热更"这回事。**

---

## 3. 客户端 bundle 按 `rev` 不可变缓存 + HMR 的正确姿势

> ⚠️ 本节（「免刷新的 HMR」与「Host 侧与 Client 侧的 HMR」两小节）已按 2026-09-07 的
> **运行中实测**更新。完整机制与本项目接线见 [`HMR.md`](HMR.md)。

### 服务端机制（`packages/client/modules/src/index.ts`）

- 对 `/plugins/<id>/client.js` 用 `IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'`。
- 每个插件的 **`rev`（内容哈希）在宿主启动时算好**，写进 `window.__DSH_BOOT__`；但 `client-hmr`
  会**在运行中**重哈希改写 entry 的 `rev` 并广播（见下），所以宿主并非“永远只服务启动时的 rev”。

### 结论

| 动作 | 结果 |
|------|------|
| 只改代码 + 保存 | 浏览器看到的是旧 bundle（要 `pnpm build` 落盘 `lib/client.js`） |
| `pnpm build`（有 `dsh web` 连着、client-hmr 活着） | client-hmr 活着时 ≤500ms 内免刷新热更（2026-09-07 实测，加分项）；**本项目主路径仍 = `pnpm build` + 刷新浏览器**，不依赖它 |
| `pnpm build` 后重启 `dsh web` + **硬刷新**（`Cmd/Ctrl+Shift+R`） | 永远能取到新 `rev` 的 bundle（兜底，推荐用于首次接线后） |
| 只刷新、不重启 | **只有热更链没生效时才有风险**：宿主已按新内容重哈希（`rebuilt()` 改写 rev 与响应表），而浏览器仍按启动时的旧 `rev` 请求 → `/plugins/<id>/client.js` 按“pathname+rev”精确匹配不到 → **404**（源码注释口径：“mismatched revisions are rejected”），插件可能加载失败（按钮消失） |

> ⚠️ **热更链没生效前不要只刷新**。判定“client-hmr 是否活着”见 [`HMR.md`](HMR.md) §3.2
> （探测 `GET /plugins/events` 的 SSE）。`pnpm build` 后若 graph 里该插件的 `rev` 变了，说明
> 运行中已重哈希，浏览器会免刷新热换。

### 免刷新的 HMR（链路活着时可用；本项目主路径仍 = `pnpm build` + 刷新）

1. 在 dsh-tokbook 里 `pnpm build`（**必须**：让 `lib/client.js` 落盘变化）。
2. **无需**在 DSH 源码跑 `pnpm run dev:web` —— 那个 watcher 只重建 DSH 仓库内包，不会构建外置
   dsh-tokbook。本项目里“重建 bundle”就是自己的 `pnpm build`：
   - `@deepseek-ai/dsh-client-hmr` 由 web-app bundle **常驻挂载**（不是 dev-only）；
   - 它的 node 半区默认每 500ms stat-poll 每个插件 bundle 文件，变化 → 重哈希 → SSE
     `/plugins/events` → 浏览器热换 fiber，**页面无需刷新**。

当前客户端 HMR 链**是活的**（`GET http://127.0.0.1:3080/plugins/events` 可收到 SSE，graph 含
`@deepseek-ai/dsh-client-hmr`，且 `dsh-tokbook` 的 rev 与启动批前缀不同 = 已被运行中重哈希）。

> 口径（2026-09-07 更新）：浏览器刷新成本可接受，**client 改动以 `pnpm build` + 刷新为主路径**，
> 免刷新热更是加分项、不是保证——某次没生效就硬刷新兜底。

### Host 侧与 Client 侧的 HMR 是两套机制，不互通（各管各的产物）

- **Host（Node / Cordis）**：`@deepseek-ai/cordis-plugin-hmr`（`id: hmr`）。base bundle 里这行
  **默认 `disabled: true`**；本项目已在 `$DSH_HOME/profiles/web/cordis.patch.yml` 显式
  `disabled: false` + `base: 'file:///C:/Users/28529/Desktop/dsh-tokbook'` 启用。改 host 源码、
  重建 `lib/index.js` 后触发「卸载旧插件 → 重载 → 重新 `apply`」，注册自动清理；改 `hmr` 行本身
  需重启一次 `dsh web`。官方文档：<https://deepseek-harness.github.io/deepseek-harness/develop/framework/#hmr-热模块替换>。
- **Client（浏览器 bundle）**：走 `client-modules` 的 `rev` 缓存 + `@deepseek-ai/dsh-client-hmr`
  （web-app 常驻挂载）；变化经 `pnpm build` 落盘 `lib/client.js`，**主路径 = 刷新浏览器取新 rev**
  （client-hmr 活着时可能 ≤500ms 免刷新热更，加分项非保证；见 [`HMR.md`](HMR.md) §3.2）。
- **两者互不影响**：host HMR 只重载 host 半区，**不会**热更浏览器端的 `lib/client.js`；反之亦然。

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

- `pnpm build` = `tsc -b tsconfig.json`（产 `lib/types/**/*.d.ts`）+ `node scripts/build-client.mjs`
  （esbuild 产 `lib/index.js`（host）与 `lib/client.js`（client，lazy-CJS factory））。
- `pnpm watch` 只跑 `tsc --watch`（**不重建** esbuild 的 `lib/client.js`）→ 改源码后要手动 `pnpm build`；
  需要自动重建，得改 watch 脚本。
- `build-client.mjs`：client 构建加 `charset: 'utf8'`，让产物保留**字面中文**（默认会转义成 `\uXXXX`，
  不便于排查）。
- client 入口**不要 `export default`**（cordis loader `exports.default ?? exports` 会让 default 掩盖
  `.inject`，报 "cannot get property ... without inject"）；只导出具名 `inject` / `apply`。
- `dsh.client` 必须 `platform:'web'`，且 `./client` 可解析出 `lib/client.js`；`BASELINE_EXTERNALS`
  列表要跟 DSH 的 `PLATFORM_MODULES` 保持一致。
- 安装：`dsh plugin --profile web add <path>` 会做成 **link/junction**（指向仓库，宿主导入实时文件）；
  `$DSH_HOME/profiles/web/cordis.patch.yml` 加一行挂载 host 半区：

  ```yaml
  - insert:
      - id: tokbook
        name: 'dsh-tokbook'
  ```

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
- **预览台要在每次 `pnpm build` 之后重启**:`scripts/preview-overlay.mjs` 在**启动时**就把
  `lib/client.js` 读进内存(`readFileSync`),之后再构建,页面拿到的仍是旧 bundle——看现象会误判成
  "改动没生效"。重启时还要确认端口真的空了:`job_kill` 杀掉的是外层 shell,`node` 子进程可能还占着
  8931,新进程直接 `EADDRINUSE` 退出;用 `Get-NetTCPConnection -LocalPort 8931 -State Listen`
  看 `OwningProcess`,必要时 `Stop-Process`。

---

## 7. `<button>` 会把内容垂直居中——固定高度的绝对定位按钮会踩到

### 现象

时间轴的节点是 `position:absolute; height:100%` 的 `<button>`，里面是「日期」+「圆点」。
同一套 CSS 下，纯 `<span>` 的端点标签停在轨道**上方**，而**有段可点的**那一端（无起点段锚到首记，
折成节点）标签整整低了 12px，跑进中间那排。

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

## 8. 一页速查（Checklist）

- [ ] 选择器：元素自身带 `data-plugin` → 用复合 `[data-plugin].class`；真子元素 → 用后代 `[data-plugin] .class`。
- [ ] 改 UI（client）后：`pnpm build` 落盘 `lib/client.js` → 刷新浏览器取新 rev（client-hmr 活着时可能 ≤500ms 自动热更，加分项非保证）。
- [ ] 改 host 后：`pnpm build` 落盘 `lib/index.js` → host HMR 自动 卸载→重载→重 `apply`（profile 已启用 `hmr`）。
- [ ] 兜底（首次接线 / 没热更上）：`pnpm build` → **重启 `dsh web`** → **硬刷新**（`Cmd/Ctrl+Shift+R`）。
- [ ] `pnpm run dev:web` 只重建 DSH 仓库内包；外置插件的重建 = 自己的 `pnpm build`（详见 [`HMR.md`](HMR.md)）。
- [ ] 只刷新不重启（且热更链没生效时）：会因 `rev` 不符被拒 → 可能插件加载失败，**不要**。
- [ ] 图标用内联 SVG；文案用中文；给可访问名字与 `aria-pressed`/`aria-label`。
- [ ] 对齐 DSH 外观：用 `--dsw-*` 令牌复刻，别 import 私有 CSS module。
- [ ] client 入口无 `export default`；esbuild 加 `charset:'utf8'`。
- [ ] 用 kimi-webbridge 时：先 `snapshot`，再 `evaluate` 读 computed style；**每次调用前先 `find_tab`**（当前标签页会漂）。
- [ ] 用 `scripts/preview-overlay.mjs` 看效果：**每次 `pnpm build` 后重启预览台**（它在启动时读一次 bundle），并确认 8931 端口已释放。
- [ ] 绝对定位 + 固定高度的 `<button>`：内容会被 UA 布局**垂直居中**；要贴顶就 `display:flex;flex-direction:column;justify-content:flex-start`（见 §7）。
