# dsh-tokbook 设计系统（DESIGN-SYSTEM）

> **Doc meta** · role: reference · language: zh-CN · status: current · last-reviewed: 2026-09-17 · supersedes: —

> 本文是这套界面的**取值真源**：token 的三层架构与命名、每个 token 的取值与用途、每个组件的解剖 /
> 变体 / 尺寸 / 状态矩阵，以及字号 / 间距 / 控件几何 / 动效 / 图标几张量表。
> **数字与形状只写在这里一次**——别的文档引用它，不复制它。
>
> - **什么不许做、必须达到什么、怎么验** → [`UI-SPEC.md`](UI-SPEC.md)（颜色预算是它的、实测对比度、
>   窄屏契约、反模式、自检命令）。
> - **为什么长这样**（风格出处、试过又撤掉的版本）→ [`DESIGN.md`](DESIGN.md) §4；持久决策 →
>   [`DECISIONS.md`](DECISIONS.md)——这套视觉的当前形态由 **D-025 / D-027**（语言）与
>   **D-029、D-033…D-037**（逐轮收口）定。
> - **接口与数据**（路由 / wire JSON / 价格分段语义）→ [`CONTRACTS.md`](CONTRACTS.md)。
>
> **权威顺序：代码 > 本文（取值）> UI-SPEC（禁令与达标线）> DESIGN（推理）。**
> 本文与 `src/client/styles/**` 不符时，是本文过期——**改本文，不是「照文档改代码」**。
> 规范的收益全在能被引用，所以每条都写到可判定的程度：给出类名、数值与所在片段。

---

## 1. Token 架构

### 1.1 三层，各有各的主人

```
L1  primitive   宿主皮肤 + 兜底字面量     --dsw-alias-*  /  #1f2328 之类      DSH 拥有，随皮肤翻转
      ↓
L2  semantic    --dtpl-*（插件根上）      --dtpl-fg / --dtpl-border / …      本插件拥有，全窗口可用
      ↓
L3  component   节内度量与覆盖            --dtpl-rate-w / --dtpl-hero-art    使用它的那一节拥有
```

| 层 | 前缀 | 定义在哪 | 谁可以读 | 什么时候改 |
|---|---|---|---|---|
| L1 primitive | `--dsw-*` / `--ds-*` | DSH 皮肤（`styles.ts` 里不定义） | 只有 L2 的 `var()` 与 §2.3 白名单 | 不归本插件管；皮肤换了，L2 的解析结果随之变 |
| L2 semantic | `--dtpl-*` | `styles/tokens.ts`（+ `styles.ts` 注入 `--dtpl-hero-art`），挂在 `[data-plugin="dsh-tokbook"]` | **全部**片段、全部 tab | 全窗口的取值要一起变时；改这里 = 改整扇窗 |
| L3 component | `--dtpl-*` | 使用它的**节根**上（如 `.dtpl-price-sec`） | 该节（例外见下） | 只有这一节的几何要变时 |

**L3 升至 L2 的唯一判据：这段 CSS 会被另一个 tab 复用吗？**
`--dtpl-row-nums-w` 就是这条的判例：`.dtpl-row` 是跨 tab 的行组件（用量明细的按模型与按通道都走它），
它一度定义在按模型那一节的父元素上，于是通道那一面取不到变量，
`grid-template-columns:minmax(0,1fr) var(…)` 整条在计算值阶段失效、静默回落到单列（实测行高 75px vs 38px）。
**跨 tab 复用的度量必须在 L2；绝不放「使用者」元素上。**

### 1.2 命名与作用域约定

- **token 名**：`--dtpl-{类别}-{项}[-{变体}]`。类别目前只有这几个：`fg`（`fg-2`/`fg-3`/`fg-dim` 是它的档位）、
  `accent`、`card`、`surface`、`border`、`hairline`、`ok`、`warn`（`warn-ink`）、`err`、`brand`（`on-brand`）、
  `radius`（`radius-sm`）、`metal`、`panel-bg`、`row-nums-w`、`mono`、`cell-pad-x`、`rate-w`、`rate-gap`、`rates-w`、`hero-art`。
  **不新增类别名**（`--dtpl-success` / `--dtpl-secondary` 这类同义词一律不许出现）。
- **类名**：`dtpl-{块}[-{元素}][-{修饰}]`，全小写连字符；块按**组件**分（`hero` / `stat` / `row` / `price-*` /
  `quota-*` / `doc-*` / `tl-*`），不按 tab 分（tab 只是装配）。跨 tab 共用的类不许带 tab 名。
- **作用域**：**每一条规则**都以 `[data-plugin="dsh-tokbook"]` 起头（浮层自身那条是
  `[data-plugin="dsh-tokbook"].dtpl-overlay`）。这是插件浮在宿主之上的前提——漏掉前缀就会改到 DSH 自己的界面。
- **不写死**：样式里不出现字面色值（兜底与注释里的实测值除外），也不出现字面 `border-radius`（只许 `0` / `var()` / `50%`）。
  UI-SPEC §反模式列了完整禁令，§自检给了可跑的命令。

### 1.3 状态怎么编码：ARIA 优先，其次 `data-*`，最后才是类

同一个仓库里三种编码都在用，不是随意——按下表选，**能用上面一档就不用下面一档**：

| 档 | 用什么 | 判据 | 现役用例 |
|---|---|---|---|
| 1 | **ARIA 属性** | 状态本身就是语义（选没选中、展没展开、按没按下） | `aria-selected`（`.dtpl-tab` / `.dtpl-bd-tab`）、`aria-pressed`（`.dtpl-price-switch button`、`.dtpl-footer`）、`aria-expanded`（`.dtpl-price-more`、折叠头）、`aria-current`（时间轴节点） |
| 2 | **`data-*`** | 状态由数据算出来，且要和同一个类的其它数据状态并排区分 | `data-dirty` / `data-open`（`.dtpl-price-row`）、`data-state="bad"`（价单元格）、`data-tone`（额度窗口）、`data-billing`（计费性质芯片）、`data-collapsed`（`.dtpl-price-card`）、`data-active`（价段 / 时间轴节点）、`data-cap`（时间轴两端） |
| 3 | **状态类** | 一次性旗标或纯视觉变体，与语义无关 | `is-peak` / `is-zero`（趋势柱）、`is-cash` / `is-zero`（金额）、`is-unattributed`（对账行）、`is-anim`（柱入场，`animationend` 即摘）、`is-on`（筛选芯片）、`dtpl-range-active` / `dtpl-quota-autorefresh-on`（自绘选择器）、`is-saved` / `is-saving` / `is-invalid` / `is-error`（保存状态行） |

**状态样式一律写成 `[属性选择器]` 或 `.{状态类}`，不改基类的规则块**——这样"默认态"永远只有一处定义。
第三档里凡是**能由 ARIA 表达的**（例如 `dtpl-range-active` 其实等价于 `aria-pressed`）都属于历史写法，
改到那里时顺手收编到第一档，**不为此单开一轮**。

### 1.4 为什么没有 `tokens.json`（一条取舍，别再问第二次）

本项目的 token **就是 `styles/tokens.ts` 里的模板字符串**。不引入 `tokens.json` + 生成脚本，理由：

- 数量：L2 二十来个 token、L3 只有 5 个，全部在一个 78 行的文件里肉眼可读可查；
- 产物：样式由 `injectStyles()` 在运行时拼一张 `<style>`，token 与其它 CSS 同属这一张表，
  生成一步只会多出一个"改了 json 忘了 build"的失效面；
- 单人维护：多一层管线的维护成本（脚本、门禁、文档）大于它带来的收益。
  **什么时候该推翻它**：L2 token 超过约 60 个、或出现第二套主题要按块生成时——那时再说，现在不加。

---

## 2. Token 总表

### 2.1 语义层（L2，`styles/tokens.ts`；挂在插件根上，全部片段可用）

| Token | 解析到（浅色兜底值） | 用途 |
|---|---|---|
| `--dtpl-fg` | `--dsw-alias-label-primary` · `#1f2328` | 正文、主读数、当前项 |
| `--dtpl-fg-2` | `label-secondary` · `#59636e` | 次要身份、注记、默认条/表盘填充，以及**一切信息性文本** |
| `--dtpl-fg-3` | `label-tertiary` · `#81858c` | ≤10px 状态短标签与徽章；非文字与关系符号（`·`、caret、`—`、`↔ = + –`、骨架、图标、线与块） |
| `--dtpl-fg-dim` | `label-dimmed` · `#a0a4a8` | 分隔点、输入占位符 |
| `--dtpl-accent` | `brand-primary` · `#4d6bfe` | 焦点环、输入聚焦边框、footer `aria-pressed`、时间轴当前点 |
| `--dtpl-card` | `bg-layer-2` → `bg-layer-1` | 浮窗卡面、抽屉里输入框的面 |
| `--dtpl-surface` | `bg-layer-1` | 抽屉里"抬起的段块"面 |
| `--dtpl-border` | `border-l2` · `rgba(0,0,0,.12)` | 面板外轮廓、分区实线 |
| `--dtpl-hairline` | `border-l1` · `rgba(0,0,0,.08)` | 行内 / 清单发丝线、选择器项之间的竖线 |
| `--dtpl-ok` | `state-success-primary` · `#1a7f37` | **只有**"已保存" |
| `--dtpl-warn` | `state-warn-primary` · `#9a6700` | **只有非文本**：边框、底色、条体 |
| `--dtpl-warn-ink` | `color-mix(warn 55%, fg)` | 一切 warn **文字** |
| `--dtpl-err` | `state-error-primary` · `#cf222e` | 错误文字 / 边框 / 填充 |
| `--dtpl-brand` | `#ffcd00` | 品牌黄：当前页、峰值、徽记 |
| `--dtpl-on-brand` | `#14150f` | 黄块的墨边与墨色内容 |
| `--dtpl-radius` / `--dtpl-radius-sm` | `0px` | 唯一半径 |
| `--dtpl-metal` | `inset 0 1px` 白 7% + `inset 0 -1px` 黑 12% | 面板机加工边（叠在 1px 边框**之内**） |
| `--dtpl-panel-bg` | `color-mix(fg 3%, transparent)` | 面板洗色（唯一配方） |
| `--dtpl-row-nums-w` | `224px` | 跨 tab 共用行组件的右列宽 |
| `--dtpl-mono` | `--ds-font-family-code` + 兜底 | 所有数字、代码、路径、route key |

**每个 token 的取值怎么用、哪些用法被禁**——见 [`UI-SPEC.md`](UI-SPEC.md) §颜色法（含逐 token 的禁令与
实测对比度）。`--dsw-corner-shape` 是超椭圆形状关键字（`superellipse(1.5)`），**不是长度**：
喂进 `border-radius` 会让整条声明失效、圆角在真实皮肤上塌成 0；半径只写长度，全圆形状另配 `corner-shape:round`。

### 2.2 组件层（L3，登记表）

| Token | 定义在 | 值 | 用途 / 为什么是这个值 |
|---|---|---|---|
| `--dtpl-hero-art` | 插件根（`styles.ts` 从资产拼进 `HERO_ART_VAR`） | 图片 data URI | 只被 `.dtpl-hero-art` 那一层背景用。**不在 `tokens.ts` 里声明**：那个文件是静态字符串，拿不到 `import` 进来的资产 |
| `--dtpl-cell-pad-x` | `.dtpl-price-sec` | `7px` | 费率格左右内边距；**列头与数字共享它**，两者右端才对得齐 |
| `--dtpl-rate-w` | `.dtpl-price-sec` | `74px` | 一个费率框的宽。前提是这一列真的走等宽：12px 下 8 字符 = 52.8–57.6px + 两侧 7px + 2px 边框 → 取 74 覆盖最宽字重（推导见 DESIGN §3.1） |
| `--dtpl-rate-gap` | `.dtpl-price-sec` | `6px` | 四个费率格之间的列距 |
| `--dtpl-rates-w` | `.dtpl-price-sec` | `calc(4*rate + 3*gap)` = `314px` | 费率轨道总宽；行的网格第三列固定 `32px` 是展开槽，与 `.dtpl-price-more` 的命中区**必须一起改** |

**新增 L3 的判据**：它只服务一节 → 定义在**那一节的根**上（不是它的使用者元素上——放使用者身上，
另一个使用者就取不到，症状是整条声明静默失效）；跨 tab 复用 → 升 L2（§1.1）。

### 2.3 直连宿主变量（L1 直用）的白名单

有几处**有意不经过 L2**，因为那里要的正是"宿主自己的配方"，套一层反而会与宿主的模态/滚动条不一致。
只有下面这些位置可以直写 `--dsw-*`（且都要带兜底），别处一律走 L2：

| 位置 | 直用的宿主变量 |
|---|---|
| `.dtpl-overlay` 遮罩 | `--dsw-alias-bg-mask-1`、`--dsw-mask-blur` |
| `.dtpl-card` 投影 | `--dsw-elevation-prominent` |
| `.dtpl-body` 滚动条 | `--dsw-alias-scrollbar-bg-l2`、`--dsw-alias-scrollbar-hover-l2` |
| `.dtpl-footer`、`.dtpl-close` 悬停底 | `--dsw-alias-interactive-bg-hover`（active 档：`--dsw-alias-interactive-bg-active`） |
| `.dtpl-footer` 常态色 / pressed 色 | `--dsw-alias-label-primary`、`--dsw-alias-brand-primary` |

理由：遮罩、投影、滚动条、悬停底、以及**宿主 slot 自己的地盘**（侧栏入口）都是宿主语言的一部分，
插件在那里应当"看起来像宿主"。**形状与配色仍按本篇与 UI-SPEC**（宽栏直角、状态色不外借）。

### 2.4 新增一个 token 的规程

1. 先定层（§1.1），再定名（§1.2）——**没有第二个色相，没有新类别名**；
2. 值必须来自实测而不是拍：新增**文本色**要浅/深两套皮肤各量一次对比度，把实测值写进
   `styles/*.ts` 的注释，再进 `tokens.ts`；几何值（宽/高）要写出"按最宽的那档内容量出来"的算式；
3. **同时**更新本文 §2 的表——token 表是登记的账，没登记就是漂移；
4. 死 token（定义了、全仓库没用）直接删，不留"以后可能要用"。`--dtpl-accent-hover` 就是这么删掉的。

---

## 3. 材质与几何（所有组件共用）

### 3.1 面板配方（唯一）

```css
border:1px solid var(--dtpl-border);
background:var(--dtpl-panel-bg);
box-shadow:var(--dtpl-metal);
```

现役于：`.dtpl-hero`、`.dtpl-provider-card`、`.dtpl-quota-card`、`.dtpl-price-card`、`.dtpl-empty`、
`.dtpl-doc-fact`、`.dtpl-doc-bucket`、`.dtpl-doc-gap-card`、`.dtpl-doc-map`、`.dtpl-doc-data`、`.dtpl-doc-quota`。
**材质（`metal`）与边界（`border`）是两件事**：外轮廓永远由 1px 硬边框单独负责，
不许一条半像素内阴影同时充当两者。投影只属于浮层（`.dtpl-card`），面板不加投影。

### 3.2 表面阶梯（层级由填充定，不由投影定）

一处凹陷换一层，改这里的任何一档都是改全窗口的深度感：

| 层 | 填充 | 现役 |
|---|---|---|
| page | 无 | `.dtpl-body` |
| card | `--dtpl-panel-bg`（fg 3%） | §3.1 的面板 |
| open row | fg 7% | `.dtpl-price-row[data-open]` |
| drawer | **无填充**，只留 1px 实线接缝 | `.dtpl-price-history` |
| seg | `--dtpl-surface` + 1px 硬边框 | `.dtpl-price-seg` |
| slot | `--dtpl-panel-bg`（fg 3%） | `.dtpl-price-slot` |

抽屉**刻意不加自己的洗色**：半透明叠半透明会让抽屉与卡片同调，"凹槽"就消失了。

### 3.3 直角与真圆

半径恒为 `0px`（`--dtpl-radius` / `--dtpl-radius-sm`）。**真圆只有三类**：
① 侧栏 rail 按钮（宿主 slot 的地盘）；② "点"——同步状态点、告警角标、芯片前置点、口径页条目圆点；
③ 额度表盘（表盘本来就是个圆，另配 `corner-shape:round`）。
**数据图形的点一律是方的**：趋势柱、趋势零刻度、时间轴节点。灯是灯，刻度是刻度。

### 3.4 角括号

只画**左上 + 右下**两枚（四角补全会读成相框），用 `::before/::after` 画 2px L 形边框，
`pointer-events:none`、`z-index:2`：卡片 `16×16`、hero `14×14`。

| 位置 | 颜色 | 注意 |
|---|---|---|
| `.dtpl-card` 两枚 | `color-mix(fg-2 55%, transparent)` | 底下恒为卡面 |
| `.dtpl-hero::after`（右下） | `color-mix(fg 55%, transparent)` | 底下恒为卡面 |
| `.dtpl-hero::before`（左上） | `color-mix(#fff 62%, transparent)` | **单独取浅墨**：它永远压在卡首那条图上，随 `fg` 走的深墨在浅色皮肤下压深图等于没有（实测角上只剩 1px 卡边框） |

**禁止 `clip-path` 切角**——切角会连子元素的焦点环一起裁掉。

### 3.5 线型与渐变

全窗口只有三种线：`--dtpl-border`（1px 实线，分区/边界）、`--dtpl-hairline`（发丝，行内/清单，可 `.5px`）、
数据图形自己的基线/轨。**禁止虚线**（会被读成"还没画完的框"）。
**渐变只允许两处**：骨架屏 shimmer、`.dtpl-price-select` 的三角箭头。
**分区线与量尺是两件东西**：分区线要中性等宽两端一致（走 `--dtpl-border`），量尺属于数据图形那一类
（现役只有读数行那条 3px 占比轨、额度条、时间轴轨）。

---

## 4. 组件规格

读法：**解剖**说明这个件由哪几块构成；**变体/尺寸**给可选的形；**状态矩阵**给每个状态的视觉变化
（未列出的状态即"无变化"）。窄屏（≤640px）的变形一律见 [`UI-SPEC.md`](UI-SPEC.md) §窄屏契约，
本节只标本组件自己的桌面几何。

### 4.1 浮窗壳（`overlay.ts`）

**解剖**：`.dtpl-overlay`（遮罩）→ `.dtpl-card`（dialog）→ `.dtpl-head`（`.dtpl-title` + `.dtpl-close`）
→ `.dtpl-tabs`（窗口页签）→ `.dtpl-body`（唯一滚动容器，五个 tab 共用）→ `.dtpl-foot`（仅总览 tab）。

| 件 | 几何 | 取值 |
|---|---|---|
| `.dtpl-overlay` | `position:fixed;inset:0;z-index:1000`，居中，`padding:24` | 遮罩 `--dsw-alias-bg-mask-1` + `backdrop-filter:--dsw-mask-blur` |
| `.dtpl-card` | `width:min(720px,100%)`，`height:min(680px,88dvh→88vh)` | `background:--dtpl-card`，`box-shadow:--dsw-elevation-prominent + inset 0 0 0 1px border`，`border-radius:0`，`overflow:hidden` |
| `.dtpl-head` | `padding:14 20 12`，gap 16 | — |
| `.dtpl-title` | 16/24/600，`.02em`，gap 10 | 前置 `.dtpl-title-ico-chip` 22×22（brand + on-brand）、`.dtpl-title-ico` 14×14 |
| `.dtpl-close` | 28×28（窄屏 44×44） | 图标 16×16；**唯一显式退出**（Escape 不算指针手段） |
| `.dtpl-tabs` | `padding:0 20`，下边界 1px `border` | `role="tablist"` |
| `.dtpl-body` | `padding:18 20 20`，`scroll-padding:8px` | `scrollbar-gutter:stable`（窗口一换行数从个位数跳到上千，不留槽整块正文横挪 8px）、`scrollbar-width:thin`、滚动条 8px |
| `.dtpl-foot` | `padding:11 20 14`，上边界 1px `border` | 只在总览 tab 出现 |

**状态矩阵（`.dtpl-tab`，第一层选择器）**

| 状态 | 触发 | 视觉变化 |
|---|---|---|
| default | — | 12/18/500 `fg-2`，透明底 |
| hover | 指针悬停 | `color:fg` + `background:fg 4%` |
| selected | `aria-selected="true"` | `fg` + 600 + `fg 6%` 底 + **底部 5px 黄块 + `inset 0 0 0 1px on-brand`** |
| disabled | `:disabled` | 本组件未使用 |
| 未保存标记 | 价格 tab 挂 `.dtpl-tab-dot` | 6×6 黄方点 + 墨边，`margin-left:5px`，`role="img"` + `aria-label`，直到保存或丢弃 |

浮层交互（键盘 / 焦点 / 点背景关闭）见 §6。

### 4.2 侧栏入口（`footer.ts`）

**两个变体**（由宿主 slot 的 `wide` 决定），几何对齐 DSH 设置入口——**这是宿主 slot 的地盘，
形状与悬停反馈沿用宿主的做法**：

| 变体 | 几何 | 图标 | 半径 |
|---|---|---|---|
| 宽栏 `.dtpl-footer` | 全宽 bar，`height:42`，`padding:0 10 0 8`，gap 8，14/22 文字 | `.dtpl-foot-ico` 16×16 | `--dtpl-radius-sm`（0） |
| rail `.dtpl-footer.dtpl-rail` | 36×36 | 18×18 | `50%` + `corner-shape:round`（§3.3 登记的真圆） |

| 状态 | 视觉变化 |
|---|---|
| hover / active | `--dsw-alias-interactive-bg-hover` / `-bg-active` |
| `aria-pressed="true"`（浮窗开着） | 文字取 `--dsw-alias-brand-primary` |
| 告急 | `.dtpl-foot-alert` 8×8 圆点，`top/right:-1px`，`--dtpl-warn` + `0 0 0 2px --dtpl-surface`；`role="img"` + `aria-label` + `title`，**颜色与文字都在** |
| focus-visible | 2px `--dtpl-accent` + offset 2（全窗口共享规则） |

### 4.3 面板与节标题

**面板**：§3.1 一条配方，没有第二种。卡内**不再套第二只框**——一个陈述只需要一只框
（`.dtpl-grid` 四桶自 D-033 起住在 hero 里，只出格与格之间的竖发丝）。

**节标题** `.dtpl-sec-title`：徽记 + 分区词，`13/20/600`、`.04em`、`margin:0 0 11`；
`::before` 是 **7×13 黄牌 + `inset 1px on-brand`**（工业徽记，反复出现的那枚标记）。
右端旁注 `.dtpl-sec-aside`：`11/16 fg-2`，`tabular-nums`，`nowrap`，
由**它所在那一行**的 `space-between` 推开（没有通用的标题行容器）。

| 徽记尺寸 | 用在 |
|---|---|
| 7×13 | `.dtpl-sec-title::before`、`.dtpl-total-k::before` |
| 4×8 | `.dtpl-bar-label.is-peak::before`（峰值的黄牌，节徽记的 0.6 倍） |
| 18×18 | `.dtpl-doc-idx`（口径页序号，墨色数字居中） |
| 22×22 | `.dtpl-title-ico-chip`（窗口标题） |
| 5px 高实条 / 6px 方点 | `.dtpl-tab[aria-selected]::after` / `.dtpl-tab-dot` |

**每一节都要有分区词**，且分区词优先取**窗口词**（"近 14 天趋势"、"近 7 天用量"）——
它陈述的正是某个窗口的用量，所以窗口自己就是它该有的名字。

### 4.4 今日仪表卡（`.dtpl-hero`）

**解剖**（自上而下）：`.dtpl-hero-art`（卡首一条图，占满卡内容宽）→ `.dtpl-hero-top`
（`.dtpl-hero-lead`：`.dtpl-total-k` + `.dtpl-total-num` + `.dtpl-hero-figure`；右侧 `.dtpl-hero-money`）
→ 1px 分区线（`.dtpl-grid` 的上边框）→ 四桶读数格（§4.5）。

| 件 | 几何 / 取值 |
|---|---|
| `.dtpl-hero` | `padding:16`，flex column gap 12，`margin:0 0 20`，`overflow:hidden` + §3.1 配方；角括号 14×14（§3.4） |
| `.dtpl-hero-art` | `margin:-16 -16 0`（左右上三面抵到卡沿），`aspect-ratio:940/237`，`background:var(--dtpl-hero-art) center/cover`；下缘**直边**，与下面那行数字的距离就是 hero 的 12px gap。**它不是任何一层的背景**，图与字各占一行 |
| `.dtpl-total-k` | 12/18/500，`.06em`，`fg-2` + 7×13 徽记，gap 8 |
| `.dtpl-total-num` | mono 36/42/600，`fg`，`-.02em`，`tabular-nums` |
| `.dtpl-hero-delta` | 11/16 `fg-2`，数字 13/18/600 mono 主墨；基准取**不含今日的前 7 个完整日**，不足 7 天或无用量则不显示参照 |
| `.dtpl-hero-money` | flex column gap 4；每行 `space-between`，标签 11/17 `fg-2`，值 mono 12/17/500 `fg-2` |
| 金额双桶 | 现金 `.is-cash` → `fg` + 600；订阅价值 → `fg-2` + 400 **且永远带着"订阅价值"这个名字**；零值 `.is-zero` → `fg-2` + 400，仍占住该行 |
| `.dtpl-hero-figure` | flex baseline gap 10，`wrap`（数字与参照同一基线） |

### 4.5 读数格（`.dtpl-grid` / `.dtpl-stat`）

| 项 | 取值 |
|---|---|
| `.dtpl-grid` | `grid-template-columns:repeat(4,minmax(0,1fr))`，`gap:0`，**上边框 = 与仪表区之间的分区线** |
| `.dtpl-grid-3` | `repeat(3,…)`——四桶里某一桶不是这个账本的维度时用（判定粒度是账本而非当天），不留半格 |
| `.dtpl-stat` | flex column gap 3，`padding:12 14 13`；`.dtpl-stat + .dtpl-stat` → 左边 1px `border` |
| `.dtpl-k` | 12/18/500，`.05em`，`fg-2`，`nowrap` |
| `.dtpl-stat .dtpl-v` | mono 20/26/600，`-.01em`，`margin-top:3`，`align-items:baseline` |
| `.dtpl-stat-pct` | 12/18 `fg-2`，自带"占"字（份额，分母就是主角数字） |

**每格只说三件事**：桶名、桶值、份额。**占比尺与缓存命中率已撤（D-037）**——尺的量就是旁边那个份额数，
命中率与同格的份额往往只差零点几，并排会被读成一个数印了两遍；两者的定义与分母留在「统计口径」页。

### 4.6 事实带（`.dtpl-hero-facts`）

一串"标签 + 数字"的事实，**跨 tab 共用**（总览 hero 与用量明细的窗口合计走同一组词汇与分隔符，
所以两个 tab 的口径读起来是一句话）。

| 项 | 取值 |
|---|---|
| 容器 | flex wrap baseline，11/18 `fg-2`，`tabular-nums` |
| `.dtpl-hero-fact` | `white-space:nowrap`（**每项整体换行**，分隔点因此永不落在行首） |
| 数字 | mono 600 + 主墨色（层级靠字号与字重，不靠把字洗淡） |
| 分隔 `.dtpl-hero-facts i` | `fg-dim` + `padding:0 5px`，`aria-hidden` |

### 4.7 一行读数（`.dtpl-row`，跨 tab 的行组件）

**解剖**：`.dtpl-bd-cols`（列头）/ `.dtpl-row`（数据行）= 两列网格 = 身份列（伸展）
+ 数字列（`var(--dtpl-row-nums-w)` = 224px）；`.dtpl-model-bar` 横跨整条网格。

| 件 | 取值 |
|---|---|
| 网格 | `grid-template-columns:minmax(0,1fr) var(--dtpl-row-nums-w)`，`column-gap:16`，`align-items:start` |
| 列头 | `padding:8 0 6`，10/14 `fg-2`，**一行**写成"甲 · 乙"；数字列 `text-align:right` |
| 行距 | `.dtpl-row + .dtpl-row{margin-top:16}`；**行之间不另画分隔线——占比轨本身就是那条线** |
| `.dtpl-model-name` | 13/20/500 `fg`，省略号 |
| `.dtpl-model-provider` | mono 10/16 `fg-2`，`.04em` |
| `.dtpl-val` | mono 13/20 `fg`，`tabular-nums` |
| `.dtpl-model-bar` | `grid-column:1/-1`，高 3px，`margin-top:9`，轨道 `fg 16%`、填充 `fg-2`、`transition:width .4s` |
| 金额格 `.dtpl-cost` | mono 12/16 `fg-2`；段内 gap 5；`.dtpl-cost-sep` `fg-dim` + `padding:0 6`；数额 `.dtpl-cost-main` 限宽 + 省略号 + `title`；桶名 `.dtpl-cost-k` `nowrap` + `min-width:44px`（**不许硬 `width`**） |
| 工作区身份行 `.dtpl-ws-meta` | 11/16 `fg-2`；路径 mono 10 可省略；`.dtpl-ws-fail` 600 + `--dtpl-warn-ink` |

| 行变体 | 视觉 |
|---|---|
| 普通行 | 无 hover 底洗色（**静态行不加 hover 反馈**——会造出假的可点承诺） |
| `.dtpl-row.is-unattributed` | `margin-top:22` + `padding-top:14` + 上边 1px 实线，标题降 `fg-2` + 400——它是**对账行**（D-018），行内其余排版一字不动 |
| 按通道面 | 用同一套网格但**没有列头**（通道卡是"铭牌 + 卡身"两段式），模型行自带 `.dtpl-sr` 列名 |

**右列宽按这一列里最宽的那种内容定**：工作区行两段"数额 + 桶名"实测 223px → 224px；
模型行只要 ~90px，按宽的定，窄的那一面只是多留白（反之则金额被裁）。

### 4.8 选择器：两层，共一种"当前项"语言

**横排 + 竖发丝分隔 + 底部实条**，轨道底色一律不要（那会读成"一组按钮"，而这里表达的是
"这台设备当前的页"）。**禁止 pill / 药丸轨道 / 圆角抬起块。**

| 层 | 实条 | 高度 | 文字 | 现役 |
|---|---|---|---|---|
| 第一层（窗口页） | **品牌黄 5px + 墨边** | 30，`padding:0 12`，`flex:1` | 12/18/500 | `.dtpl-tab` |
| 第二层（节内 / 范围） | 墨色 2px | 29（`3 14 8`）/ 24（`0 11`） | 12/18/500 与 11/16/500 | `.dtpl-bd-tab`、`.dtpl-range-tab`、`.dtpl-quota-autorefresh-opt`、`.dtpl-price-switch button` |

| 状态 | 视觉变化（两层共用） |
|---|---|
| default | `fg-2`，透明底 |
| hover | `color:fg` + `background:fg 4%` |
| current | `fg` + 600 + `background:fg 6%` + 底部实条（第一层黄 + 墨边，第二层墨色） |
| 项间分隔 | `.5px --dtpl-hairline` 竖线 |

**"当前项"靠三样一起说**：字重 + 实条 + 洗色。**不靠把没选中的洗淡**（未选中项是控件的字，走 `fg-2`）。
**同一页出现两条第二层选择器时，层级靠形与位分开**：只有一条是全宽带底线的 tab 条（页面主结构），
另一条降为带可见标签的小控件（用量明细的"窗口"就是后者：标签 + 24px 选择器，贴在分区词右端）。

### 4.9 芯片与徽章（四级）

| 级别 | 形 | 高度 | 用在 |
|---|---|---|---|
| 说明 | 1px `border` + `fg-3` | 15 / 18 | 仅账本、峰谷 N 段（`.dtpl-price-badge`）、`.dtpl-doc-chip` |
| 需看一眼 | amber 边框（`warn 45%`）+ `warn-ink` 文字 | 15 / 18 / 20 | 价格未知、未生效（15/18）、额度门控（20）、工具栏筛选芯片开着（`.dtpl-price-chip.is-on`，28——它是工具栏控件，不是这里的四级） |
| 必须跳出 | **实心墨**（`fg` 底 + `card` 字） | 15 | 未保存、订阅（`.dtpl-price-badge-dirty`、`.dtpl-provider-bill[data-billing="subscription"]`） |
| 抬一档 | 1px 墨边（`fg 35%`） | 15 / 18 | 峰谷标记（"里面还有更多定价"）、口径页"记了" |

现役类：`.dtpl-price-badge`（+ `-unknown` / `-idle` / `-dirty` / `-slot`）、`.dtpl-provider-bill`、
`.dtpl-quota-chip`（+ `-muted` / `-err` / `-gate`，带 6×6 前置状态点）、`.dtpl-doc-chip`（+ `-off`）。
细节取值：内边距 `0 5px`（15 高）/ `0 7–8px`（18–20 高），字号 10/13 或 11/16，字重 600（`-off` 为 500），
`.dtpl-quota-chip` 的状态点取 `currentColor`（颜色不单独承载语义——文字与形状一起说）。

### 4.10 按钮与图标钮

| 档 | 形 | 高度 | 现役 |
|---|---|---|---|
| 描边方按钮 | 1px `border` + 透明底；hover `fg 7%` 洗色 + 边框加强（`fg 25–28%`） | 30（`.dtpl-rescan`）/ 26（`.dtpl-price-add`） | 重新扫描、新增价段 |
| ghost | 无边框 + `fg-2`；hover `fg` + `fg 7%` 洗色 | 24，`padding:0 8` | 抽屉里的"复制 / 删除"（`.dtpl-price-ghost`） |
| danger ghost | hover `err` 文字 + `err 10%` 底 | 24 | 删除（`.dtpl-price-ghost-danger`） |
| danger 描边 | `err 45%` 边框 + `err` 文字；hover `err 12%` 底 | 26 | 重试（`.dtpl-retry`） |
| 图标钮 | 方形透明；hover `fg 8%` 洗色 | 28（`.dtpl-close`、`.dtpl-quota-refresh`）/ 32（`.dtpl-price-more`） | 关闭、卡片刷新、展开调价史 |
| 折叠头 | 整行可点，`padding:3 4`；hover `fg 6%` | 内容高 | `.dtpl-price-fold` |

**没有实心主 CTA**：这里没有漏斗，只有查看与维护动作。禁用态 = `opacity:.4–.45` + `cursor:not-allowed`
+ 真 `disabled` 属性。所有可点元素都要 `cursor:pointer`。字形尺寸**全窗口一个值**（`.dtpl-price-more` 恒 14px，
`fg-2`）——命中区按输入方式分档（桌面 / 窄屏），**热区是热区，符号该多大还多大**。

### 4.11 输入与编辑态

| 件 | 取值 |
|---|---|
| `.dtpl-price-input` | `height:26`，`padding:0 var(--dtpl-cell-pad-x)`，mono 12/16，右对齐，`tabular-nums`，`border:1px solid transparent` |
| `.dtpl-price-input-date` | `min-width:158px`，左对齐，常态就带 `border` + `--dtpl-card` 底（它是抽屉里的日期框） |
| `.dtpl-price-select` | `height:24`，`padding:0 20 0 7`，11/16，`--dtpl-card` 底，三角箭头用两段 `linear-gradient`（§3.5 允许的第二处渐变） |
| `.dtpl-price-search` | `height:28`，`padding:0 10`，12px；**全窗口唯一 placeholder-only 的字段** |
| `.dtpl-price-cell-k` | 9/12 `fg-3`；表格里 `display:none`（列头代言），窄屏与抽屉里 `display:block` |
| 说明句 `.dtpl-price-slots-note` | 11/16 `fg-2`，**不借等宽**——「留空的档位沿用上面的全天价」是一句要读的话；抽屉里的 `.dtpl-price-history-hint` 同一档 |

**状态矩阵**

| 状态 | 视觉变化 |
|---|---|
| default | 透明边框、透明底（平常"像文本"） |
| hover | `border-color:var(--dtpl-border)` |
| focus | `outline:none` + `border-color:var(--dtpl-accent)` + `background:var(--dtpl-surface)`（边框承担焦点指示） |
| error | `.dtpl-price-cell[data-state="bad"]` → `err` 文字 + `err 55%` 边框；配 `aria-invalid` + `aria-describedby` → 单元格下一行 `.dtpl-price-cell-err`（`role="alert"`，`title` 给全句，行下再重复首条问题） |
| disabled | 表单字段用真 `disabled` |

**没填完的块是草稿，不是错误**：草稿不参与校验、不进签名、保存时丢掉；只有"填了一半"才报错。
**行状态一态一记号，而且不用身份色**：未保存 = 墨色 2px 侧条（`data-dirty`，另加 `fg 5%` 底）、
展开 = `fg 7%` 中性提亮（`data-open`）、焦点 = `:focus-within` 的 `accent 45%` 内环、
当前生效的价段 = `fg 35%` 墨边 + 墨色侧条（`.dtpl-price-seg[data-active]`）。
抽屉行内动作 `.dtpl-price-seg-actions` 平时 `opacity:0`，`:hover` / `:focus-within` 时 `.12s ease` 淡入。

### 4.12 数据图形

**趋势图**（`.dtpl-bars`）

| 件 | 取值 |
|---|---|
| 图区 | flex align-end，gap 3，`height:92`，`margin-top:24`（给最高那根的标签留白），`padding:0 14`（≥ 半个标签宽，14 列统一居中、防首尾溢出），下边界 1px `border` |
| `.dtpl-bar-fill` | `fg 45%`（白底 3.04:1、深底 3.97:1——30% 过不了 3:1）；`::before` 柱顶 1px 受光边（`fg 22%`） |
| `.dtpl-bar-fill.is-peak` | `fg 70%` + `inset 1px on-brand` 墨边，`::before` 内侧墨色盖片（`top:1px;height:3%`）；**柱身不带任何黄** |
| `.dtpl-bar-label` | mono 10/14 `fg-2`，`left:50%` + `translateX(-50%)`，偏移由 TSX 内联；`is-peak` → `fg` + 600 + 前置 **4×8 黄牌**（`margin-right:5px`，`vertical-align:-1px`） |
| 零日 | 标签整枚撤掉（不写"0"），改由 `.dtpl-bar.is-zero::after` 画基线上一道 **2×3px** 硬刻度（`fg-3`，居中于自己那一列） |
| 轴 | `.dtpl-trend-axis` mono 10/16 `fg-2`，gap 3，`padding:0 14`（与图区同步，否则柱与日期错开） |

**其余图形**

| 件 | 取值 |
|---|---|
| 占比轨 `.dtpl-model-bar` | 高 3px，轨道 `fg 16%`（**轨道必须留着**：去掉后 0.1%–1% 的行只剩碎点，像渲染故障），填充 `fg-2` |
| 额度条 `.dtpl-quota-bar` | 高 7px，轨道 `fg 12%`，填充按 tone（§4.13），`transition:width .4s, background-color .2s` |
| 表盘 `.dtpl-quota-gauge` | 44×44 SVG 环，轨道 `fg 10%`，`stroke-width:4`，`linecap:round`，`transform:rotate(-90deg)`，`stroke-dasharray` `.4s` ease；已用 % 居中在环**内**（mono 11/1/700 + 9px 的 `%` 号），预算名 `.dtpl-quota-gauge-cap`（10px `fg-2`）挂在数字下方——**环从不静默地换含义**，所以这一行是**信息**而不是装饰 |
| 时间轴 `.dtpl-tl-track` | 高 36px（`12 + 5 + 3 + 4 + 12`）；轨 `.dtpl-tl-rail` 3px `fg-3`（1px 读起来像游离的分隔线）；点 `.dtpl-tl-dot` 5×5 `fg-2`，当前节点 6×6 `--dtpl-accent` + 日期 `fg` 600；节点盒占满 36px → **热区就是整条轨道高**；两端节点 `data-cap` 收在轨道内 |

### 4.13 反馈与状态面

| 状态 | 形 | 取值 |
|---|---|---|
| 骨架 `.dtpl-sk` | shimmer 渐变（`fg 5%→10%→5%`，`200% 100%`，1.4s），块高 = **对应真块的实测高** | `.dtpl-sk-hero` 277、`.dtpl-sk-tile` 76、`.dtpl-sk-chart` 159、`.dtpl-sk-row` 48、`.dtpl-sk-card` 132、`.dtpl-quota-sk-card` 150 |
| 空 `.dtpl-empty` | §3.1 面板 + 居中，`padding:36 20`；图标 24px `fg-3`（**有贴切图标时才配**，现只有 `UsageGlyph`），标题 15/22/600，一句引导 12/20 `fg-2` `max-width:44ch` |
| 错误 `.dtpl-error` | `err 45%` 边框 + `err 8%` 底 + `--dtpl-metal`，文字 12/18 `err` + `overflow-wrap:anywhere`，右侧重试钮（§4.10） | `role="alert"`；文案必须**给恢复路径** |
| 卡内消息 `.dtpl-quota-msg` | 1px 硬边框说明面，`padding:10 12`；`-err` 加 `err 45%/7%`，`-muted` 只把标题降 `fg-2` | "未配置"不是错误 |
| 保存状态 `.dtpl-price-state` | 工具栏一行 11/16 | `.is-saved` → `ok`；`.is-saving` → `fg-2`；`.is-invalid` → `warn-ink`；`.is-error` → `err` + 600 |
| 新鲜度 | 等宽小字"最新记录 <时刻>"，`fg-2`，11/18 `.04em` | 正常态 footer **不占字** |
| 同步中 `.dtpl-sync-running` | 6×6 中性点脉冲（`dtpl-pulse 1.2s`）+ 文字，`fg` | **不借黄、不借 warn**；失败态 `.dtpl-sync-error` 取 `err` |
| 单卡加载 | 禁用控件 + `opacity` + 转圈（`dtpl-rotate 1s linear`） | reduced-motion 下转圈停住，反馈由禁用态与随后的"更新于 <时刻>"承担 |
| 过期提示 `.dtpl-quota-stale` | `warn 45%` 边框 + `warn 8%` 底 + `warn-ink` 文字 | 11/16 |

**tone → 视觉的映射（条体与文字分档）**：`ok → fg-2`（**默认状态不染色**）、
`warn → 文字 warn-ink / 条体裸 warn`、`danger → 文字与条体都用 err`。

---

## 5. 量表

### 5.1 字号

| 角色 | 字号/行高/字重 | 例子（类） |
|---|---|---|
| 主角读数 | 36/42/600 mono，`-.02em` | `.dtpl-total-num` |
| 大额余额 | 22/27/600 mono | `.dtpl-quota-balance-v` |
| 面板级读数 | 20/26/600 mono | `.dtpl-stat .dtpl-v` |
| 通道合计 | 19/25/600 mono | `.dtpl-provider-tokens` |
| 口径页大数 | 17/21/600 mono | `.dtpl-doc-fact-big` |
| 窗口标题 | 16/24/600，`.02em` | `.dtpl-title` |
| 空状态标题 | 15/22/600 | `.dtpl-empty-title` |
| 卡片身份 | 14/20/600 | `.dtpl-provider-name`、`.dtpl-quota-name` |
| 节标题 / 价表标签 | 13/20/600 | `.dtpl-sec-title`、`.dtpl-doc-title`、`.dtpl-price-label` |
| 行读数 | 13/20 mono | `.dtpl-val` |
| 参照行数字 | 13/18/600 mono | `.dtpl-hero-delta b` |
| 正文 / 标签 / 按钮 | 12/18–20，500–600 | `.dtpl-tab`、`.dtpl-rescan`、`.dtpl-quota-window-label`、`.dtpl-doc-sub` |
| 份额读数 | 12/18 | `.dtpl-stat-pct` |
| 金额 | 12/16–17 mono | `.dtpl-hero-money-v`、`.dtpl-cost`、`.dtpl-provider-cost` |
| 次要事实 / 注记 / 说明句 | 11/16–18 | `.dtpl-hero-facts`（11/18）、`.dtpl-sec-aside`、芯片文字、`.dtpl-price-state`、`.dtpl-price-history-hint`、`.dtpl-price-slots-note` |
| 口径页正文小节 | 11.5/17–18 | `.dtpl-doc-bucket-desc`、`.dtpl-doc-gap-item-desc`、`.dtpl-doc-map-note` |
| 列头 / 柱值 / 徽章 | 10/13–16 | `.dtpl-bd-cols`、`.dtpl-price-cols`、`.dtpl-bar-label`、`.dtpl-price-badge`、`.dtpl-model-provider` |
| 时间轴标签 / 价单元格名 | 9/12 | `.dtpl-tl-node-k`、`.dtpl-price-cell-k` |
| 表盘说明 | 10/1（`%` 号 9/1） | `.dtpl-quota-gauge-cap`、`.dtpl-quota-gauge-n i` |

**分带用法（2026-09-17 收口，此前同一节里两条互相矛盾）**：**9–10px 只给短标签**（列头、柱值、
芯片、徽章、轴刻度、表盘说明），它装不下一句话；**11–11.5px 是「说明句」的下限**（注释、口径说明、
字段提示）；**12px 起才是正文句**（段落、引导语、按钮文字）。判据是**这句话要不要读**，不是它有多次要：
要读的句子最低 11px，且一律走 `fg-2`（`fg-3` 只承载 ≤10px 短标签与非文字符号）。

### 5.2 间距与容器几何（桌面）

| 容器 | 内边距 / 几何 |
|---|---|
| `.dtpl-card` | 宽 `min(720px,100%)`、高 `min(680px,88dvh)` |
| `.dtpl-overlay` | 24（居中） |
| `.dtpl-head` | `14 20 12` |
| `.dtpl-tabs` | `0 20`（项内 `0 12`） |
| `.dtpl-body` | `18 20 20`，`scroll-padding:8px`，滚动条 8px |
| `.dtpl-foot` | `11 20 14` |
| `.dtpl-hero` | `16`（四边等距），gap 12，下外边距 20 |
| `.dtpl-hero-art` | 宽 = 卡内容宽 + 32（`-16px` 左右外边距顶到卡沿），高按资产比例（940/237）→ 实测 668×168 @1404、376×95 @420 |
| `.dtpl-stat` | `12 14 13` |
| `.dtpl-provider-head` / `-models` | `11 14 10` / `9 14 11` |
| `.dtpl-quota-card` | `13 15 12` |
| `.dtpl-price-head` / `-row` / `-cols` | `8 10 8 8` / `4 10`（`min-height:40`）/ `6 10 4` |
| `.dtpl-doc-fact` / `-bucket` / `-gap-card` | `10 12` / `10 12` / `11 13` |
| `.dtpl-empty` | `36 20` |
| `.dtpl-error` | `10 12`（下外边距 12） |

**窄屏（≤640px）收一档**：`.dtpl-card` 改 `width:100%`、`height:min(94dvh,94vh)`；
`.dtpl-head` `14 16 10`、`.dtpl-tabs` `0 16`、`.dtpl-body` `12 16 14`、`.dtpl-foot` `10 16 12`。
其余窄屏规则（折行、列头、滚动、44px 判据）见 [`UI-SPEC.md`](UI-SPEC.md) §3——那里是契约，这里只是取值。

**节奏**：布局间距取 4 的倍数——**4 / 8 / 12 / 16 / 20 / 24**；`2/3px` 只用于紧贴的一对元素
（图标与文字、标签与数值、徽记与标题）。节内块间距 8–16，节与节 20，节标题下 11。
行与行 `16px`；"未归属"这类对账行用 `22/14 + 1px 实线`分出来。

### 5.3 控件几何与命中区

| 控件 | 几何 | 命中区 |
|---|---|---|
| 侧栏入口（宽 / rail） | 42 高（直角）/ 36×36 圆 | 42 / 36 |
| 窗口 tab、`重新扫描` | 30 | 30 |
| 明细子 tab（切法） | 29（`3 14 8`） | **窄屏 44** |
| 关闭钮 | 28×28 | **窄屏 44×44**（唯一显式退出） |
| 卡片刷新、搜索框、筛选芯片 | 28 | 28 |
| 重试、新增、价输入 | 26 | 26 |
| 小控件（自动刷新 / 计费性质 / 时段钟点选择器、ghost 按钮、用量明细的窗口选择器） | 24 | 24 |
| 价格表展开钮 | 32×32 | **窄屏 44×44** |
| 时间轴节点 | 点 5px、日期 9px | 整条轨道高 36 |

**达标线（何时必须放大命中区）**见 [`UI-SPEC.md`](UI-SPEC.md) §窄屏契约：指针目标 ≥24×24 是全窗口底线；
窄 sheet 上"这一步/这一节的**唯一入口或退出**"必须补到 44。

### 5.4 动效

| 场景 | 时长 / 曲线 |
|---|---|
| hover / 颜色 / 底洗色 | `.15s ease` |
| 抽屉行内动作淡入 | `.12s ease` |
| 浮层遮罩 | `dtpl-fade .16s ease-out` |
| 弹窗入场 | `dtpl-pop .16s ease-out`（8px 上移 + 缩放 .98） |
| 窄 sheet 入场 | `dtpl-sheet .22s cubic-bezier(.32,.72,0,1)`（从视口下方滑入） |
| 柱入场 | `dtpl-bar-grow .18s cubic-bezier(.22,.68,.24,1)`（`scaleY`，origin bottom） |
| 刷新钮反馈 | `dtpl-refresh-pop .35s cubic-bezier(.34,1.56,.64,1)`（一次性） |
| 占比条 / 额度条宽度 | `.4s ease` |
| 表盘 `stroke-dasharray` | `.4s ease` |
| 同步点脉冲 / 骨架 shimmer / 转圈 | `1.2s` / `1.4s` / `1s linear` |

**只动 `transform` / `opacity`**；例外只有两处——占比条与额度条的 `width`、表盘的 `stroke-dasharray`
（它们要表达的正是"量变了"）。这三条填充**也在 reduce 分支里被关掉**：数字本身已经把这个量说清，
reduce 用户连"量在变"的动效都不要。一次性动画用挂载时加类、`animationend` 摘类（`.is-anim`），
**重渲染不重播**。"必须尊重 `prefers-reduced-motion`"与"关掉之后必须还有反馈"两条是达标线，
见 UI-SPEC。

### 5.5 图标与排版记号

- **功能性图标一律内联 SVG**：2px 圆头描边、`currentColor`、尺寸由类控制、
  `aria-hidden="true" focusable="false"`；**禁止 emoji**。现役尺寸：16（`.dtpl-foot-ico`、`.dtpl-close-ico`）、
  18（rail 图标）、14（`.dtpl-title-ico`、`.dtpl-rescan-ico`）、15（`.dtpl-quota-refresh-ico`）、24（`.dtpl-empty-ico`）。
- **排版记号不算图标**：`▸ ▾`（展开/收起）、`＋`（加一段/加时段）、`↔`（字段对应）、`—`（没写价）、
  `·`（一串事实的分隔）是正文里的一类符号，跟随字体，不引入第二套图形语言。
  唯一例外是**价格表行尾那枚 `▸`**：它单独构成一个按钮的全部内容（判据：符号是不是按钮的唯一内容？），
  字形恒 14px、`fg-2`，命中区按输入方式分档——**要改就整条重议，不顺手改**。
- 关系符与占位符（`↔ = + –`、`—`）取 `fg-3`，分隔点 `·` 取 `fg-dim`，都 `aria-hidden`。

---

## 6. 无障碍语义契约

焦点与键盘的实现规则（每个件都要能不用指针完成）：

- **焦点环**：全局 `:focus-visible{outline:2px solid var(--dtpl-accent);outline-offset:2px}`。
  不许在没有替代指示的情况下 `outline:none`——现役的三处替代都有各自的理由：
  卡片容器自身 `:focus{outline:none}`、时间轴节点改用 2px 自绘环 + offset、价格输入用边框 + 底色。
  **焦点色跟随宿主皮肤**：焦点是系统信号，不是这套视觉语言的一部分。
- **不遮挡**：`.dtpl-body` 有 `scroll-padding:8px`；粘性底栏不得压住聚焦控件。
- **键盘**：`Escape` 关闭浮窗；`Tab` 循环困在 dialog 内；tablist 用方向键 + roving tabindex（自动激活）；
  打开时焦点入卡片、关闭后**归还触发按钮**；切 tab 重置 `.dtpl-body` 滚动到顶部；
  `Ctrl/Cmd+S` 立即 flush 待写的价表保存。

**语义清单**（元素 → 必须带什么）：

| 元素 | 语义 |
|---|---|
| 浮窗 | `role=dialog` `aria-modal` `aria-label`，`tabIndex={-1}` |
| 页签 | `role=tablist/tab/tabpanel` + `aria-selected/controls/labelledby` + `id` |
| 分组选择器 | `role=group` + `aria-label`，项用 `aria-pressed` |
| 可折叠卡 / 行 | `aria-expanded` + `aria-controls` |
| 图标钮 / 仅图标元素 | `aria-label`（+ `title` 补充）；内联 SVG 一律 `aria-hidden="true" focusable="false"` |
| 装饰性分隔符 / 占比尺 / 骨架 / 卡首那条图 | `aria-hidden="true"` 且不吃指针 |
| 图 / 表盘 | `role="img"` + 一句能读懂结论的 `aria-label` |
| 进度条 | `role="progressbar"` + `aria-valuemin/max/now` + `aria-label="<窗口> 已用 N%"` |
| 错误 / 保存状态 | `role="alert"` / `role="status" aria-live="polite"` |
| 表格列名 | 列头 `aria-hidden` 时，**每个格子自带 `.dtpl-sr` 列名**（"通道 commandcode"、"词元 830.3M"） |
| 表单字段 | `aria-label`（含上下文）、`aria-invalid`、`aria-describedby` 指向字段级错误 |
| 时间轴当前段 | `aria-current="true"` |
| 只给读屏的文本 | `.dtpl-sr`（`clip-path:inset(50%)`），用于列名与比例（"词元 830.3M，占本窗口 34%"） |

**判据**：颜色不单独承载语义（状态同时有文字或形状）；`title` 只作补充，**信息不能只存在 `title` 里**；
行内的完整审计（四桶、请求/压缩/失败、两个金额桶）进 `title`，但结论必须已经在可见文本里。
本插件是**桌面 Web 的 DSH 插件**，移动端 App 专章（安全区、haptics、Dynamic Type、底部导航）不适用；
窄屏只按 UI-SPEC 的 sheet 契约走。

---

## 7. 新增一面的做法（Recipe）

**加一个窗口 tab**：① 在 `LedgerOverlay` 的 `TAB_IDS` 加 id，写 `role="tab"` 全套属性；
② 面板组件用 `<section aria-label>` 起头；③ 复用 §3.1 面板配方与 §4.3 节标题；
④ 需要滚动就在共享的 `.dtpl-body` 里；⑤ 首屏数据用骨架，块高按 §4.13 对齐真块；
⑥ 窄屏按 UI-SPEC §窄屏契约检查折行与 44px。

**加一节**：节标题（徽记 + 分区词，§4.3）+ 可选右端旁注 → 内容 → 间距 20 收尾。

**加一行读数**：套 `.dtpl-row` + `--dtpl-row-nums-w` 网格（§4.7），给每格补 `.dtpl-sr` 列名，
占比条横跨整条网格。

**加一个价表字段**：先按 §2.4 定 token（L3 放 `.dtpl-price-sec`），再决定它是不是固定列
（是 → 等宽 + `tabular-nums`，宽度按最宽内容量出来），最后补 `aria-label` 上下文（"第 N 段的…"）。

**加一个状态**：按 §1.3 选编码档位（ARIA > `data-*` > 类），并在 §4 对应组件的状态矩阵里加一行。
