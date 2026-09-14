# dsh-tokbook 界面规范（UI-SPEC）

> **Doc meta** · role: reference · language: zh-CN · status: current · last-reviewed: 2026-09-15 · supersedes: —

> 本文是**呈现层的规范**：侧栏入口按钮与 `shell.overlay` 浮窗里，一切长相、交互与无障碍的取值与禁令。
> 写给下一个动 UI 的人（或 AI）——照它做就不会破坏现有风格，也不必把理由重推一遍。
>
> - **为什么长这样**（风格出处、每条规则的推理与被否掉的版本）→ [`DESIGN.md`](DESIGN.md) §4；
>   持久决策 → [`DECISIONS.md`](DECISIONS.md) **D-023…D-029**。
> - **接口与数据**（路由 / wire JSON / 价格分段语义）→ [`CONTRACTS.md`](CONTRACTS.md)。
> - **踩坑与验证手法**（选择器作用域、bundle rev、预览台）→ [`LESSONS.md`](LESSONS.md)。
>
> **权威顺序：代码 > 本文 > DESIGN。** 本文与 `src/client/styles/**` 不符时，是本文过期——改本文，
> 不是"照文档改代码"。规范的收益全在**能被引用**，所以每条都写到可判定的程度。

---

## 0. 三条不可协商的不变量

1. **形状跟着风格，颜色跟着宿主。** 直角 + 硬边 + 金属 + 品牌黄是这套语言；底色、文本色、
   状态色一律走 `--dsw-alias-*`（插件必须同时成立于浅色与深色皮肤）。**不许**把 `--dsw-*`
   解析出的具体色值抄进样式，也**不许**让形态跟着宿主走（圆角按钮、pill 分段器都是被否掉的方向）。
2. **品牌黄是"料"，不是"线"。** 恒定黄只在**实心块 + 墨边**这个形态上出现（唯一例外是文本选区的
   洗色），且只有 §2.2 表里那几类用法；黄做 1px 线、做文字、做大面积填充一律禁止
   （`#FFCD00` 压白卡只有 **1.57:1**）。
3. **全窗口只有一份配方。** 一块面板、一种"当前项"、一档数字等宽（§3.1 / §6.4 / §4.2）。
   任何一面要长得不一样，都得先在本文里写出理由并登记，否则就是漂移。

---

## 1. Token 总表（唯一取值来源）

根 token 定义在 `styles/tokens.ts`（挂在 `[data-plugin="dsh-tokbook"]` 上），**所有**片段可用。

| Token | 解析到（浅色兜底） | 用途 | 禁令 |
|---|---|---|---|
| `--dtpl-fg` | `--dsw-alias-label-primary` · `#1f2328` | 正文、主读数、当前项 | — |
| `--dtpl-fg-2` | `label-secondary` · `#59636e` | 次要身份、注记、**默认条/表盘填充**，以及**一切信息性文本**（读数、标签、身份、旁注、说明） | 不得当"视觉噪声"随手用（见 `fg-dim`） |
| `--dtpl-fg-3` | `label-tertiary` · `#81858c` | **只有两类**：① ≤10px 的状态短标签与徽章；② 纯装饰（分隔点、caret、占位符符号、骨架、非文字的线与块） | **不承载任何要读的文本**：≥11px 正文、读数、身份、标签、旁注、列头、轴日期、**未选中的选项**都走 `fg-2`——对卡面实测 3.47:1，过不了 4.5:1 |
| `--dtpl-fg-dim` | `label-dimmed` · `#a0a4a8` | 分隔点 `·`、输入占位符 | 只承载装饰与重复信息，不承载读数 |
| `--dtpl-accent` | `brand-primary` · `#4d6bfe` | 焦点环、输入聚焦边框、footer `aria-pressed`、时间轴当前点 | **不外借给分类、可点、强调**（DSH 皮肤里它就等于墨色，换皮肤又变蓝） |
| `--dtpl-card` | `bg-layer-2` → `bg-layer-1` | 浮窗卡面、抽屉里输入框的面 | — |
| `--dtpl-surface` | `bg-layer-1` | 抽屉里"抬起的段块"面 | — |
| `--dtpl-border` | `border-l2` · `rgba(0,0,0,.12)` | 面板外轮廓、分区实线 | 不许用半像素内阴影冒充它 |
| `--dtpl-hairline` | `border-l1` · `rgba(0,0,0,.08)` | 行内/清单发丝线、tab 之间竖线 | 不用于分区（那是 `border` 的事） |
| `--dtpl-ok` | `state-success-primary` | **只有**"已保存" | 不许当健康态的默认色（§2.3） |
| `--dtpl-warn` | `state-warn-primary` · `#9a6700` | **只有非文本**：边框、底色、条体 | 不许做正文（浅色实测 2.15:1） |
| `--dtpl-warn-ink` | `color-mix(warn 55%, fg)` | 一切 warn **文字**（实测 5.57:1 / 深色 8.91:1） | 不许做条体填充（那是裸 warn 的活） |
| `--dtpl-err` | `state-error-primary` | 错误文字 / 边框 / 填充 | 不许当"删除按钮"以外的强调色 |
| `--dtpl-brand` | `#ffcd00` | 品牌黄：当前页、峰值、徽记（§2.2） | 见不变量 2 |
| `--dtpl-on-brand` | `#14150f` | 黄块的墨边与墨色内容 | 不许拿它当"深色主题的正文色" |
| `--dtpl-radius` / `--dtpl-radius-sm` | `0px` | 唯一半径 | 不许出现字面 `border-radius:2px` 之类 |
| `--dtpl-metal` | `inset 0 1px` 白 7% + `inset 0 -1px` 黑 12% | 面板机加工边（**叠在 1px 边框之内**） | 只走 1px、≤12%；不许同时充当边界 |
| `--dtpl-panel-bg` | `color-mix(fg 3%, transparent)` | 面板洗色（唯一配方） | 不许为深色皮肤另加提亮层 |
| `--dtpl-row-nums-w` | `224px` | **跨 tab 共用**的行组件右列宽 | 定义在根上；挪进某一节会让另一个 tab 静默失效（DESIGN §4 有过一次） |
| `--dtpl-mono` | `--ds-font-family-code` + 兜底 | 所有数字、代码、路径、route key | 不许给正文/标题用 |

**只属于一个节的度量留在该节根上**（例：价格表的 `--dtpl-cell-pad-x:7px`、`--dtpl-rate-w:74px`、
`--dtpl-rate-gap:6px`、`--dtpl-rates-w:calc(4*rate+3*gap)` 定义在 `.dtpl-price-sec`）。
判据：**这段 CSS 会被另一个 tab 复用吗？** 会 → 根 token；不会 → 本节根。**绝不放"使用者"元素上。**

**墨色三档的判据（2026-09-15 审计后收紧）。** 三级色对卡面只有 **3.47:1**，所以
`fg-3` 只给"不是信息"的东西与 ≤10px 的状态短标签；**任何要读的文本都走 `fg-2`（≈5.4:1）**，
**包括未被选中的选项**——"当前项"由字重 + 实条 + 洗色说，不靠把没选中的洗淡。这是 DESIGN §4
那句"标签与口径注释全部留在 fg-2，安静由字号、字距与留白做，不靠把字洗淡到读不清"的落地。
三档里只有 `fg` 与 `fg-2` 承载正文；`fg-dim` 连短标签都不给。
`--dtpl-accent-hover` 曾是死 token（定义了、全仓库没用），已删除。

`--dsw-corner-shape` 是超椭圆形状关键字（`superellipse(1.5)`），**不是长度**：喂进 `border-radius`
会让整条声明失效、圆角在真实皮肤上塌成 0。半径只写长度；全圆形状另配 `corner-shape:round`。

---

## 2. 颜色法：色相是一笔预算

### 2.1 三层结构

| 层 | 来源 | 数量 |
|---|---|---|
| 主题色 | `--dsw-alias-*`（随皮肤翻转） | 全部底色 / 文本 / 边框 |
| 中性墨色 | `color-mix(fg N%, transparent)` | 面板洗色 3%、表头列头 6–7%、轨道 12–16%、柱体 45%、峰值柱 70% |
| 状态色 | `ok` / `warn` / `err` | **只在真的要看一眼时** |

### 2.2 品牌黄的预算（处数 **与** 面积）

黄只出现在下面这几类地方，全部是**实心块 + `inset 0 0 0 1px var(--dtpl-on-brand)` 墨边**：

| 类别 | 几何 | 实现 |
|---|---|---|
| 当前页标记 | 5px 高实条（压 tab 行下边界）；未保存标记 6px 方点 | `.dtpl-tab[aria-selected]::after`、`.dtpl-tab-dot` |
| 峰值标记 | 4×8px 牌，挂在峰值柱值标签**前面** | `.dtpl-bar-label.is-peak::before` |
| 工业徽记 | 7×13px 牌（节标题 / hero 口径词）、18×18px 牌（口径页序号）、22×22px chip（窗口标题） | `.dtpl-sec-title::before`、`.dtpl-total-k::before`、`.dtpl-doc-idx`、`.dtpl-title-ico-chip` |
| 文本选中 | `color-mix(brand 55%, transparent)` 洗色 | `.dtpl-body ::selection`（**唯一不带墨边的用法**：它不画边界，只当选区底，字仍是墨色） |

- **面积也是预算**：这些用法里最大的一处曾独占全 UI 黄面积 ≈97%（满高峰值柱曾是整块黄），
  已改掉（D-029）。新增黄块前先问：**它会不会成为全屏最大的那块饱和面？** 会 → 不批。
- 黄**不做**：线（1px 刻度、分隔线、柱脚条）、文字、柱体/柱顶盖片、大面积底。
  刻度轨、趋势柱、时间轴点一律墨色。
- 不引入第二个色相。需要"分类"时用形状，不用色（§2.4）。

### 2.3 默认状态不染色

占比条、额度条、额度表盘的默认填充是 `--dtpl-fg-2`（健康态**中性**）。若默认就是绿的，
绿只是"条的颜色"、不是信息，三根绿条还会成为整屏最响的东西。**屏幕上出现的每一处色相
都意味着"这里看一眼"**，而唯一恒定的色相是品牌黄。

映射：`tone-ok → fg-2`、`tone-warn → warn-ink`（文字）/ `warn`（条体）、
`tone-danger → err`（文字与条体都用 err）。

### 2.4 分类靠形状，金额靠字重

- **分类**（按量/订阅、仅账本/峰谷 N 段、记了/没记、价格未知/未生效/未保存）：
  描边芯片 = 一类，**实心墨芯片** = 需要跳出来的那一类（订阅、未保存），amber 边框 + `warn-ink`
  = 需要看一眼（价格未知、未生效、筛选器开着）。**不留 accent 染色底**。
- **金额双桶（hero 与每一行同一套口径）**：`spend` 走 `fg` + `600`，`subscriptionValue` 走
  `fg-2` + `400` 并**永远带着"订阅价值"这个名字**。区分由字重 + 标签承担，不借颜色。
  **行内也适用**：`.dtpl-cash-amt` / `.dtpl-sub-amt` 一对类就是这条的实现。
  2026-09-15 审计发现行内曾整体反过来（订阅金额拿主墨色 600、现金金额是次要色裸字），
  于是同一扇窗里 hero 说"现金最重要"、行里却把没花的钱写成最响的那个数——已按本条改正。
- **可点**由下划线 + 悬停底洗色说明（`.dtpl-pricing-empty-link`），不由 accent。

### 2.5 对比度底线

文本 4.5:1、非文本（边框/条/图形）3:1、焦点指示 3:1。已量过并写进样式注释的几档：

| 项 | 浅色 | 深色 | 结论 |
|---|---|---|---|
| `fg-2` 正文 | ≈5.4:1 | — | **信息性文本与 ≤10px 短标签都用它** |
| `fg-3` 正文 | 3.47:1 | ≈6.9:1 | **不可**承载信息性文本（浅色下连 10px 列头都偏淡）；只留给未选中项与装饰 |
| `warn` 正文 | 2.15:1 | — | 必须换 `warn-ink`（5.57 / 8.91） |
| 柱体 `fg 45%` | 3.04:1 | 3.97:1 | 过非文本底线 |
| 峰值柱 `fg 70%` | — | ≈6.9:1 | 与其余柱（3.9:1）拉开明度差 |
| 黄块 | 1.57:1 | 9.28:1 | 必须有墨边（≈18:1） |

**新增文本色必须先在浅/深两套皮肤下各量一次**，把实测值写进样式注释，再进 tokens。

---

## 3. 形态与几何

### 3.1 面板配方（唯一）

```css
border:1px solid var(--dtpl-border);
background:var(--dtpl-panel-bg);
box-shadow:var(--dtpl-metal);
```

用于 `.dtpl-hero`、`.dtpl-grid`、`.dtpl-provider-card`、`.dtpl-quota-card`、`.dtpl-price-card`、
`.dtpl-empty`、`.dtpl-doc-fact`。**不许**：半像素内阴影、4% 洗色当边界、为某个 tab 单独提亮、
面板再加投影（投影只属于浮层）。

### 3.2 直角与真圆

半径恒为 0。**真圆只有两类**，且都在这里登记清楚：

1. 侧栏 rail 按钮（宿主 slot 的地盘，插件不越界改它的形状）；
2. "点"：同步状态点、告警角标、芯片前置点、口径页条目圆点，以及额度表盘（表盘本来就是个圆）。

**数据图形的点一律是方的**：趋势柱、趋势零刻度、时间轴节点。灯是灯，刻度是刻度。

### 3.3 角括号

只画**左上 + 右下**两枚（四角补全会读成相框），用 `::before/::after` 画 2px L 形边框：
卡片 16×16、hero 14×14。**禁止 `clip-path` 切角**——切角会连子元素的焦点环一起裁掉。

### 3.4 线的预算

全窗口只有三种线：`--dtpl-border`（1px 实线，分区/边界）、`--dtpl-hairline`（发丝，行内/清单，
可 `.5px`）、数据图形自己的基线/轨。**禁止虚线**（会被读成"还没画完的框"）。

**渐变只允许四处**：骨架屏 shimmer、select 的三角箭头、hero 底边刻度轨、hero 刻度轨的
`mask-image` 淡出。面板自己不加戏：没有警戒条纹、网点、斜线影、渐变。

---

## 4. 字体与数字

### 4.1 字体保守

中文回无衬线；**不做字体文章**——不引衬线、不引拉丁装饰铭牌、不做中英混排标题。
层级靠字号、字距、字重与留白。字距只用于两处：口径词/节标题的 `.04em–.06em`，与大数字的
`-.01em/-.02em`（等宽数字收紧一点更像仪表面）。

### 4.2 数字

- **所有读数**加 `font-variant-numeric:tabular-nums`（位数变化时整块不抖）。
- **固定列的数字必须等宽**：价格的费率列（`--dtpl-rate-w:74px`）是按 12px 等宽数字量出来的，
  漏 `font-family` 会让度量与真实字形对不上、整列失去可纵向比对的前提。
- 数字、代码、路径、route key 走 `--dtpl-mono`；**其余一律不借等宽**（那是"工程语境"，不是装饰）。
- 金额恒为人民币 `¥`；单位缩写与格式化统一走 `client/format.ts`，不在组件里手拼。

### 4.3 字号量表

| 角色 | 字号/行高/字重 | 例子（类） |
|---|---|---|
| 主角读数 | 36/42/600 mono，`-.02em` | `.dtpl-total-num` |
| 大额余额 | 22/27/600 mono | `.dtpl-quota-balance-v` |
| 面板级读数 | 20/26/600 mono | `.dtpl-stat .dtpl-v` |
| 通道合计 | 19/25/600 mono | `.dtpl-provider-tokens` |
| 口径页大数 | 17/21/600 mono | `.dtpl-doc-fact-big` |
| 窗口标题 | 16/24/600 `.02em` | `.dtpl-title` |
| 空状态标题 | 15/22/600 | `.dtpl-empty-title` |
| 卡片身份 | 14/20/600 | `.dtpl-provider-name`、`.dtpl-quota-name` |
| 节标题 | 13/20/600 `.04em` | `.dtpl-sec-title`、`.dtpl-doc-title` |
| 行读数 | 13/20 mono | `.dtpl-val`、`.dtpl-model-name`(500) |
| 正文 / 标签 / 按钮 | 12/18–20，500–600 | `.dtpl-tab`、`.dtpl-rescan`、`.dtpl-doc-sub` |
| 参照行数字 | 13/18/600 mono | `.dtpl-hero-delta b` |
| 次要事实 / 注记 | 11/16–18 | `.dtpl-note`、`.dtpl-hero-facts`、芯片文字 |
| 金额 | 12/16–17 mono | `.dtpl-hero-money-v`、`.dtpl-cost` |
| 列头 / 柱值 / 徽章 | 10/13–14 | `.dtpl-bd-cols`、`.dtpl-bar-label`、`.dtpl-price-badge` |
| 时间轴标签 | 9/12 | `.dtpl-tl-node-k` |
| 表盘说明 | 8/1 | `.dtpl-quota-gauge-cap` |

**不得**出现 <12px 的正文句（注释、说明、按钮文字）；9–10px 只给列头、柱值、芯片、时间轴刻度
这类**短标签**。

---

## 5. 间距与尺寸

### 5.1 容器内边距（桌面）

| 容器 | 内边距 / 几何 |
|---|---|
| `.dtpl-card` | 宽 `min(720px,100%)`、高 `min(680px,88dvh)` |
| `.dtpl-overlay` | 24（居中） |
| `.dtpl-head` | `14 20 12` |
| `.dtpl-tabs` | `0 20`（项内 `0 12`） |
| `.dtpl-body` | `18 20 20`，`scroll-padding:8px`，滚动条 8px |
| `.dtpl-foot` | `11 20 14` |
| `.dtpl-hero` | 16（gap 12，下外边距 20） |
| `.dtpl-stat` | `12 14 13` |
| `.dtpl-provider-head` / `-models` | `11 14 10` / `9 14 11` |
| `.dtpl-quota-card` | `13 15 12` |
| `.dtpl-price-head` / `-row` / `-cols` | `8 10 8 8` / `4 10`（min-height 40）/ `6 10 4` |
| `.dtpl-doc-fact` / `-bucket` / `-gap-card` | `10 12` / `10 12` / `11 13` |
| `.dtpl-empty` | `36 20` |
| `.dtpl-error` | `10 12`（下外边距 12） |

### 5.2 节奏

- 布局间距取 4 的倍数：**4 / 8 / 12 / 16 / 20 / 24**；`2/3px` 只用于紧贴的一对元素
  （图标与文字、标签与数值、徽记与标题）。
- 节内块间距 8–16，节与节 20，节标题下 11。
- 行与行 `16px`（`.dtpl-row + .dtpl-row`）；"未归属"这类对账行用 `22/14 + 1px 实线`分出来。

### 5.3 控件高度与命中区

| 控件 | 几何 | 命中区 |
|---|---|---|
| 侧栏入口（宽/rail） | 42 高（直角）/ 36×36 圆 | 42 / 36 |
| 窗口 tab、`重新扫描` | 30 | 30 |
| 明细子 tab | 29（`3 14 8`） | **窄屏 44** |
| 关闭钮 | 28×28 | **窄屏 44×44**（唯一显式退出） |
| 时间跨度、卡片刷新、搜索框、筛选芯片 | 28 | 28 |
| 重试、新增、价格输入 | 26 | 26 |
| 四档小选择器（自动刷新/计费性质/时段钟点/ghost） | 24 | 24 |
| 价格表展开钮 | 32×32 | **窄屏 44×44** |
| 时间轴节点 | 点 5px、日期 9px | 整条轨道高 36 |

判据：**指针目标 ≥24×24**（WCAG 2.2 AA 底线，全窗口都过）；**窄 sheet 上「这一步/这一节的
唯一入口或退出」必须补到 44**（已做：价格表展开钮、明细子 tab、**关闭钮**、抽屉里的行内控件）。
其余紧凑控件保持桌面几何——**那是有意的现状，不是遗漏**；下次评审要推翻它，请带着"它是唯一入口"
的证据来（§12 末尾列了当前未补的清单）。字形尺寸不随命中区变：热区是热区，符号该多大还多大。

---

## 6. 组件规范

### 6.1 浮窗壳（`overlay.ts`）

- `.dtpl-overlay`：`position:fixed;inset:0;z-index:1000`，遮罩用宿主配方
  （`--dsw-alias-bg-mask-1` + `--dsw-mask-blur`）；**点背景（`e.target === e.currentTarget`）关闭**。
- `.dtpl-card`：`role="dialog" aria-modal="true" aria-label="词元账本" tabIndex={-1}`；
  打开时把焦点移进卡片，关闭时**归还触发按钮**；`Escape` 关闭；`Tab` 困在卡片内。
- `.dtpl-tabs` 是 `role="tablist"`，`←/→` 走 roving-tabindex（自动激活）；每个 tab
  `role="tab"` + `aria-selected` + `aria-controls` + `id`，面板 `role="tabpanel"` + `aria-labelledby`。
  切 tab 时 `.dtpl-body` **重置滚动到顶部**（body 是所有 tab 共享的持久滚动容器）。
- 未保存标记：价格 tab 上挂 `.dtpl-tab-dot`（`role="img"` + `aria-label`），直到保存或丢弃。
- 底部 `.dtpl-foot` 只在总览 tab 出现，正常态**不占字**：只报"最新记录 <时刻>"；
  只有"正在重新扫描 / 上次失败"（要用户采取行动）才多一句。

### 6.2 侧栏入口（`footer.ts`）

**尺寸**沿用宿主设置入口的几何：宽栏 42px 全宽 bar（`padding:0 10px 0 8px`、gap 8、14/22 文字），
rail 36×36 圆（图标 18px、`corner-shape:round`）——这说的是高度、内边距与图标尺寸，
**形状与配色仍按本文**（宽栏直角；rail 的圆是 §3.2 登记过的例外）。状态用 `aria-pressed`；告急角标
`.dtpl-foot-alert` 是 8px 圆点 + `role="img"` + `aria-label` + `title`，**颜色与文字都在**
（颜色不单独承载语义）。**这是宿主 slot 的地盘**：形状与悬停反馈沿用宿主的做法
（透明底 + `interactive-bg-hover`），不要在这里发明新的视觉。

### 6.3 节标题与旁注

`.dtpl-sec-head`（`space-between`）里放 `.dtpl-sec-title`（徽记 + 分区词）与 `.dtpl-sec-aside`
（右端旁注：窗口词/排序口径，11px `fg-3`，不画延伸线）。**每一节都要有分区词**——
只有子 tab 而没有节名的头部曾被判为"全窗口唯一没有分区词的一节"。

### 6.4 选择器：全窗口只有一种"当前项"语言

**横排 + 竖发丝分隔 + 底部实条**。轨道底色一律不要（那会读成"一组按钮"，而这里表达的是
"这台设备当前的页"）。两层：

| 层 | 实条 | 高度 | 用在 |
|---|---|---|---|
| 第一层（窗口页） | **品牌黄 5px + 墨边** | 30 | `.dtpl-tab` |
| 第二层（节内/范围） | 墨色 2px | 29 / 28 / 24 | `.dtpl-bd-tab`、`.dtpl-range-tab`、`.dtpl-quota-autorefresh-opt`、`.dtpl-price-switch` |

两层都用 `aria-selected`（tab/tablist）或 `aria-pressed`（`role="group"` 里的按钮）。
**禁止** pill / 药丸轨道 / 圆角抬起块——同一个窗口里出现过四种"选中"，已被收敛。

**"当前项"靠三样一起说，不靠把没选中的洗淡。** 未选中项的文字是 `fg-2`（它是控件的字，
浅色下三级色只有 3.47:1）；当前项 = `fg` + 600 + 底部实条 + 6% 洗色。这条覆盖**全部五处**
第二层选择器（窗口 tab、明细子 tab、时间跨度、计费性质、自动刷新档位）——它们共用一种语言，
所以也共用一套墨色。

### 6.5 一行读数（跨 tab 的行组件）

- 列头与数据行**共用同一条网格**：`grid-template-columns:minmax(0,1fr) var(--dtpl-row-nums-w)`，
  `column-gap:16px`。这样 ① 占比条分母恒定（条横跨 `grid-column:1/-1`，长度只由区块决定）、
  ② 金额列落在同一条竖线上。**右列宽按这一列里最宽的那种内容定**（工作区行两段实测 223px → 224px）。
- 列头**一行**，写成"甲 · 乙"（两列各是一串事实）；**列头 `aria-hidden` 时，每个格子必须自带
  `.dtpl-sr` 列名**（"通道 commandcode"、"词元 830.3M"、"金额 ¥3.87 实际支出"）——
  否则等于从无障碍树里删掉"这一列是什么"。
- 金额格 = 一段或两段「数额 + 桶名」。两个桶的墨色与字重按 §2.4：现金 `.dtpl-cash-amt`
  （`fg` + 600）、订阅 `.dtpl-sub-amt`（`fg-2` + 400）——**行里与 hero 同一套口径**。
  **只限不可预测的那一半**：数额限宽 + 省略号 + `title`；
  桶名是固定的一小段字，给 `nowrap` + `min-width`（不许硬 `width`）。
- **静态行不加 hover 底洗色**（会造出假的可点承诺，触屏也触发不了）。
- 行之间不另画分隔线：**轨道本身就是那条线**（它承载分母）。
- 分隔符 `·` 用 `.dtpl-cost-sep` / `.dtpl-hero-facts i`（`fg-dim`，`aria-hidden`）。

### 6.6 芯片与徽章（四级）

| 级别 | 形 | 用在 |
|---|---|---|
| 说明 | 描边 + `fg-3` | 仅账本、峰谷 N 段 |
| 需看一眼 | amber 边框 + `warn-ink` | 价格未知、未生效、筛选器开着 |
| 必须跳出 | **实心墨**（`fg` 底 + `card` 字） | 未保存、订阅 |
| 抬一档 | 1px 墨边（35%） | 峰谷标记（"里面还有更多定价"） |

高度 15（价格表/通道）/ 18（口径页）/ 20（额度状态，带前置状态点）。
`title` 只作补充说明，**信息不能只存在 `title` 里**。

### 6.7 按钮四档

| 档 | 形 | 用在 |
|---|---|---|
| 描边方按钮 | 1px `border` 底透明，hover 7% 洗色 + 边框加强 | `重新扫描`、`新增价段` |
| ghost | 无边框、`fg-3`，hover 墨色 + 7% 洗色 | 抽屉里的"删除/复制"等行内动作 |
| 图标钮 | 方形透明，hover 8% 洗色 | 关闭、卡片刷新、价格表展开钮 |
| danger ghost | hover 用 `err` 文字 + 10% `err` 底 | 删除 |

**没有实心主 CTA**：这里没有漏斗，只有查看与维护动作。禁用态 = `opacity:.4–.45` +
`cursor:not-allowed/default` + 真 `disabled` 属性。所有可点元素都要 `cursor:pointer`。

### 6.8 输入与编辑态

- `.dtpl-price-input`：平时像文本（`border:1px solid transparent`、透明底），**hover 才出边框**，
  `:focus` 用 accent 边框 + `--dtpl-surface` 底（此时 `outline:none`，由边框承担焦点指示）。
- 表格里右对齐、等宽、`tabular-nums`；抽屉里（表单）改左对齐，但 `max-width:var(--dtpl-rate-w)`
  保持与表格同宽——同一个"价"框不出现两种尺寸。
- 错误：`.dtpl-price-cell[data-state="bad"]` + `aria-invalid` + `aria-describedby` →
  单元格下一行 `role="alert"` 短提示，`title` 给全句，行下再重复首条问题。
- **没填完的块是草稿，不是错误**：草稿不参与校验、不进签名、保存时丢掉；只有"填了一半"才报错。
- 行状态一态一记号，而且**不用身份色**：未保存 = 墨色 2px 侧条；展开 = 中性提亮 7%；
  焦点 = `:focus-within` 的 accent 内环；当前生效的价段 = 墨边 35% + 墨色侧条。
- **placeholder-only 的唯一例外是工具栏的搜索框**：它空间预算最紧，没有持久可见的标签，
  因此 ①`aria-label` 必须给全名（已有）②placeholder 墨色走 `fg-2`——它是这个字段唯一可见的名字，
  不能只有 3.47:1。其余字段一律「可见标签 + 输入框」或抽屉里的 `label`（`.dtpl-price-cell-k`）。
- ghost 按钮（复制 / 删除等行内动作）的文字也是文字：`fg-2`，hover 才升 `fg`。

### 6.9 数据可视化

- **趋势图**：柱高是读数，直接站在卡面上，脚下只有基线；每柱带 `title`（日期 + 数值），
  柱值标签**直接标在柱顶**（小数据集不靠悬停）；峰值 = 更亮的柱体（`fg 70%`）+ 墨边 +
  值标签前的黄牌 + 加粗标签（形 / 明度 / 文字三层各自成立）；零日**不写"0"**，用基线上
  2×3px 居中的硬刻度；首尾列统一居中，靠图区左右各 14px 内边距防溢出；整图 `role="img"` +
  一句可读的 `aria-label`（含合计与峰值）；入场动画只让**读数长出来**（`scaleY`），
  标签全程不动，且只在挂载时播一次（`is-anim` + `animationend` 摘掉）。
  柱值与轴日期都走 `fg-2`——它们是这张图的正文，不是刻度装饰。
- **窄屏（≤640px）**：只留峰值那一个柱值标签（§8），轴日期隔一格留一个、**峰值那天永远留下**。
- **占比轨**：轨道必须留（去掉后 0.1%–1% 的行只剩碎点，像渲染故障）；填充 `fg-2`；
  分组条数少时给 `title` 说明口径。
- **额度条**：7px 高，track 12%，tone 映射见 §2.3；配 `role="progressbar"` + `aria-valuemin/max/now`
  + `aria-label="<窗口> 已用 N%"`。
- **表盘**：44×44 SVG 环，`stroke-width:4`、`linecap:round`，已用 % 居中在环**内**，
  环所指的预算以小号说明挂在数字下方——**环从不静默地换含义**；整体 `role="img"` + `aria-label`。
- **时间轴**：轨只是量尺（3px、`fg-3`），节点按**JS 量出的像素**定位（百分比挡不住窄抽屉里标签叠字）；
  有分段可跳的节点是 `button`（`aria-current` + `aria-label` + `title`），热区占满 36px 轨道高；
  点 5px 墨色、当前点 6px accent（同时有文字再说一遍，不靠颜色单独承载）。

### 6.10 反馈

| 状态 | 形 | 语义 |
|---|---|---|
| 骨架 | shimmer，块高 **= 对应真块实测高**（首屏不跳） | `aria-hidden="true"` |
| 空 | 方框 + 标题 + 一句引导（`max-width:44ch`）；**有贴切图标时才配图标**——现只有用量形状的 `UsageGlyph`，所以用量/额度三处用它、价格表那处不配（不为了凑格式换一个语义不对的图形） | 正常渲染 |
| 错误 | `err` 45% 边框 + 8% 底 + 重试钮，文字 `overflow-wrap:anywhere` | `role="alert"` |
| 保存状态 | 工具栏一行：`is-saved`(ok) / `is-saving`(中性) / `is-invalid`(warn-ink) / `is-error`(err, 600) | `role="status" aria-live="polite"` |
| 新鲜度 | 等宽小字"最新记录 <时刻>"（`fg-2`） | — |
| 同步中 | 中性点脉冲 + 文字（不借黄、不借 warn） | — |
| 加载中（单卡） | 禁用控件 + `opacity` + 转圈；**reduced-motion 下转圈停住**，反馈由禁用态与随后的"更新于 <时刻>"承担 | `disabled` |

错误文案必须**给恢复路径**（重试/去哪改），不是"出错了"。

---

## 7. 动效

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

规则：

- **只动 `transform` / `opacity`**。例外只有两处：占比条与额度条的 `width`、表盘
  `stroke-dasharray`——它们要表达的正是"量变了"。
- 动效必须表达**因果**（"因为发生了这件事"），不做装饰；**退出快于进入**；不阻塞输入。
- **`prefers-reduced-motion` 必须关掉全部动画**（`@media (prefers-reduced-motion:reduce)`
  里 `animation:none;transition:none`）。分两类写法：入场类写在
  `no-preference` 分支里，常驻类（脉冲/骨架/**转圈**）在 reduce 分支里逐个关。
  **关掉之后必须还有反馈**：转圈停住时控件仍是 `disabled` + 降透明，随后的"更新于 <时刻>"
  与"扫描中…"文案继续说明状态——没有哪一处只靠动画传达"正在进行"。
- **一次性动画**用挂载时加类、`animationend` 摘类（`.is-anim`）——重渲染不重播，
  重挂载才再播一次。

---

## 8. 窄屏（≤640px）契约

- `.dtpl-overlay` 改贴底全宽；`.dtpl-card` `width:100%`、`height:min(94dvh,94vh)`，
  入场改从下方滑入。**直角语言里没有"只圆上角"这条移动端习语**。
- 内边距整体收一档：head `14 16 10`、tabs `0 16`、body `12 16 14`、foot `10 16 12`。
- 五个窗口 tab 排不下 → **横向滚动**（隐藏滚动条、`flex:0 0 auto`），不是把最后一个裁掉。
- 网格折行时**分隔线要跟着折**：四桶/三事实条折成 2×2（第二行补横分隔、行首格去竖分隔），
  额度摘要格折成单列（竖线换横线）。否则线会漂在格子外面。
- **列头收掉**（它在窄处不再指向任何一列），行改单列堆叠，数字从"右上竖排"改为"身份下面横排一行"
  ——但 `.dtpl-sr` 列名保留。
- 趋势图**只留峰值那一个柱值标签**（每根柱只剩约 22px，而 `298.5M` 要 34px）：不是把数值藏起来，
  是不让它叠成一团；其余柱值仍在自己的 `title` 里。
- **轴日期隔一格留一个**（14 格每格约 21px，而 `9/10` 要 24px，后半段会连成一片）：
  收掉的是重复的位置信息，不是日期；**峰值那一天的日期永远留下**（`.is-peak`），
  否则"哪天最多"在窄屏上就没有答案。
- 唯一入口/退出类控件补到 **44px**（§5.3 判据）。
- 长路由键、路径这类不可预测的值可以省略，**摘要与计数保持完整**。

---

## 9. 无障碍底线

- **焦点**：全局 `:focus-visible{outline:2px solid var(--dtpl-accent);outline-offset:2px}`。
  不许在没有替代指示的情况下 `outline:none`（例外：卡片容器自身 `:focus{outline:none}`、
  时间轴节点改用 2px 自绘环 + offset、价格输入用边框 + 底色）。**焦点色跟随宿主皮肤**——
  焦点是系统信号，不是这套视觉语言的一部分。
- **焦点不被遮挡**：`.dtpl-body` 有 `scroll-padding:8px`；粘性底栏不得压住聚焦控件。
- **键盘**：`Escape` 关闭浮窗；`Tab` 循环困在 dialog 内；tablist 用方向键 + roving tabindex；
  打开时焦点入卡片、关闭后回到触发按钮；切 tab 重置滚动；`Ctrl/Cmd+S` 立即 flush 待写的价表保存。
  **每个动作都要能不用指针完成。**
- **语义清单**：

| 元素 | 语义 |
|---|---|
| 浮窗 | `role=dialog` `aria-modal` `aria-label` |
| 页签 | `role=tablist/tab/tabpanel` + `aria-selected/controls/labelledby` |
| 分组选择器 | `role=group` + `aria-label`，项用 `aria-pressed` |
| 可折叠卡 / 行 | `aria-expanded` + `aria-controls` |
| 图标钮 / 仅图标元素 | `aria-label`（+ `title` 补充）；内联 SVG 一律 `aria-hidden="true" focusable="false"` |
| 装饰性分隔符/刻度轨/骨架 | `aria-hidden="true"` 且不吃指针 |
| 图 / 表盘 | `role="img"` + 一句能读懂结论的 `aria-label` |
| 进度条 | `role="progressbar"` + `aria-valuemin/max/now` |
| 错误 / 保存状态 | `role="alert"` / `role="status" aria-live="polite"` |
| 表格列名 | 列头 `aria-hidden` + 每格 `.dtpl-sr` 自带列名 |
| 表单字段 | `aria-label`（含上下文）、`aria-invalid`、`aria-describedby` 指向字段级错误 |
| 时间轴当前段 | `aria-current="true"` |

- **颜色不单独承载语义**：状态同时有文字/形状（失败数染色 + "失败"标签、当前页黄条 + 字重、
  峰值黄牌 + 加粗数值）。`title` 只作补充。
- **触控与指针**：可点元素 `cursor:pointer`；静态行不加 hover 反馈；禁用态用真 `disabled`；
  **功能性图标**（关闭、刷新、用量）一律用内联 SVG，2px 圆头描边、`currentColor`、尺寸由类控制，
  **禁止 emoji**。**排版记号不算图标**：`▸ ▾`（展开/收起）、`＋`（加一段/加时段）、`↔`（字段对应）、
  `—`（没写价）、`·`（一串事实的分隔）是正文里的一类符号，跟随字体，不引入第二套图形语言。
  例外的只有**价格表行尾那枚 `▸`**：它单独构成一个按钮的全部内容（判据：符号是不是按钮的唯一内容？），
  但它是本窗口评审过的形态（字形 14px 全窗口一个值、命中区按输入方式分档，见 §6.8），
  换成 SVG 要连同那两条一起动——**不顺手改**，要改就整条重议。
- 本插件是**桌面 Web 的 DSH 插件**，移动端 App 专章（安全区、haptics、Dynamic Type、
  底部导航）**不适用**；窄屏只按本文 §8 的 sheet 契约走。

---

## 10. 新增一面的做法（Recipe）

**加一个窗口 tab**：① 在 `LedgerOverlay` 的 `TAB_IDS` 加 id，写 `role="tab"` 全套属性；
② 面板组件用 `<section aria-label>` 起头；③ 复用 §3.1 面板配方与 §6.3 节标题；
④ 需要滚动就在共享的 `.dtpl-body` 里；⑤ 首屏数据用骨架，块高按 §6.10 对齐真块；
⑥ 窄屏按 §8 检查折行与 44px。

**加一节**：节标题（徽记 + 分区词）+ 可选右端旁注 → 内容 → 间距 20 收尾。
**加一行读数**：套 `.dtpl-row` + `--dtpl-row-nums-w` 网格，给每格补 `.dtpl-sr` 列名，
占比条横跨整条网格。
**加一个价表字段**：先在 tokens/本节根上加度量，再决定它是不是固定列（等宽 + `tabular-nums`），
最后补 `aria-label` 上下文（"第 N 段的…"）。

---

## 11. 反模式清单（看到就是错）

1. emoji 当图标；图标按钮没有可访问名字。
2. 黄做线 / 文字 / 柱体 / 大面积；引入第二个色相。
3. 默认状态染色（绿的健康条、蓝的"重点"底）；把 `--dtpl-accent` 当分类色或强调色。
4. `warn` 直接做正文；`fg-3` 承载**要读的文本**（读数、身份、标签、旁注、列头、轴日期、
   **未选中的选项**）——它只管 ≤10px 短标签与装饰。
5. pill 分段器 / 圆角按钮 / 新的"选中"样式——同一个窗口第二种"当前项"语言。
6. 面板用半像素内阴影 + 洗色当边界；面板加投影；为某个 tab 单独提亮面板。
7. 虚线；面板上的渐变；`clip-path` 切角。
8. 硬编码色值/圆角（除 tokens 里的兜底与注释）。
9. 静态行 hover 底洗色；只有 `title` 才能读到的信息；颜色单独表达状态。
10. 固定列数字用比例体；读数漏 `tabular-nums`。
11. 列头 `aria-hidden` 却没有 `.dtpl-sr` 列名补偿。
12. 只给 pointer 的交互（拖拽/悬停）没有键盘替代。
13. 动画在 `prefers-reduced-motion` 下照播；逐帧改 `width/height/top/left`（这类改用 `transform`）。
14. 跨 tab 复用的度量放进某一节的元素里（另一个 tab 取不到变量 → 整条声明静默失效）。
15. **死类**：TSX 里挂着、样式表里没有任何规则的类（读者会以为它有样式），或样式表里定义了、
    全仓库没人用的类。结构锚点（`aria-controls` 的目标、网格占位）除外——但那种情况也别配一个
    空类名，留 `id` 就够。

---

## 12. 自检与待办

**提交前**（按改动面选最小那道门）：

```bash
pnpm build      # 改了 styles/** 或 .tsx：构建后刷新页面看真实渲染
pnpm typecheck  # 改了别的 src/**
pnpm docs:check # 改了本文
```

**人工审计命令**（没有加进 CI——单人维护，先靠规范引用；真要变成门禁再加脚本。
下面的 `Select-String` 直接在仓库根跑，等价的 `grep -rn` / `rg` 同样可用）：

```powershell
Select-String src/client/styles/*.ts -Pattern '#[0-9a-fA-F]{3,8}'   # 只应命中 tokens/footer 的兜底与注释里的实测值；#000/#fff 只许出现在 color-mix 与 mask
Select-String src/client/styles/*.ts -Pattern 'border-radius'      # 只应有 0 / var() / 50%（真圆）
Select-String src/client/styles/*.ts -Pattern 'dashed|dotted'      # 应为空
Select-String src/client/styles/*.ts -Pattern 'var\(--dtpl-brand\)'   # 每处都必须是实心块 + 墨边
Select-String src/client/styles/*.ts -Pattern 'var\(--dtpl-accent\)'  # 只应是焦点/输入聚焦/pressed/时间轴当前点
Select-String src/client/styles/*.ts -Pattern 'animation:'         # 每条都要能被 reduce 分支关掉
Select-String src/client/styles/*.ts -Pattern 'color:var\(--dtpl-fg-3\)'  # 逐条对 §1：只许出现在未选中项 / ≤10px 短标签 / 装饰上
```

**类名交叉检查**（找死类与没样式的类；§11 第 15 条）：把 TSX 里出现的 `dtpl-*` 与样式表里定义的
比一遍——两个方向都要看。整段脚本见 git 历史里 2026-09-15 那次审计用的临时脚本；
一句版：

```powershell
# 样式表里定义、但全仓库 TSX 里一次都没出现的类（结构性 hook 除外）
$css = Select-String src/client/styles/*.ts -Pattern '\.(dtpl-[a-z0-9-]+)' -AllMatches | ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$tsx = Get-Content (Get-ChildItem src/client -Recurse -Filter *.tsx).FullName -Raw
$css | Where-Object { $tsx -notmatch [regex]::Escape($_) }
```

**渲染验证**：`scripts/preview-overlay.mjs` 预览台（每次 `pnpm build` 后**重启**；端口被占时先
`Get-NetTCPConnection -LocalPort <port> -State Listen` 找 pid 再停——`job_kill` 只杀外层 shell）。
空态 / 错态由 **`TOKBOOK_MODE=empty|err` 环境变量**选（一个进程一种形状，不是 query flag），
`?dark=1` 切深色皮肤、`?tab=` 与 `?quota=` 直达各面。
或浏览器桥接读 `getComputedStyle`（先 `snapshot` 再 `evaluate`，见 [`LESSONS.md`](LESSONS.md) §6）。

> **截图有个坑**：遮罩带 `backdrop-filter` 时，Chromium 的**整页**截图会把深色卡拍成浅色
> （元素截图与 `getComputedStyle` 都正常）。判断颜色一律以 computed / 元素截图为准，
> 或临时 `overlay.style.backdropFilter='none'` 再整页拍——别据此判定"深色模式坏了"。

**2026-09-15 第一轮（本文落地那轮）修掉的不合规项**：`fg-3` 承载信息性文本（通道卡元信息行、
旁注、柱值、轴日期、列头、额度副行/重置时刻/来源、口径页标签与注释、价格表空态、footer 新鲜度）；
行内金额双桶层级反转（订阅 600 主墨 / 现金次要 → 现金 `fg` 600、订阅 `fg-2` 400）；
`.dtpl-spin` 未进 reduce 分支；窄 sheet 关闭钮 28px；窄屏趋势轴日期叠字；`.dtpl-quota-msg-muted`
是没有规则的死类；口径页根节点不是 landmark、`aria-label` 挂在无角色的 div 上；未用 token
与两处死类；预览台的 err fixture 回了 200（真 host 是 500），于是"错误态"根本预览不到。

**2026-09-15 第二轮（全覆盖复核 + 状态墨色收口）**：窄屏 × {通道用量, 订阅额度, 价格表, 统计口径}
的折行与命中区、额度四个 gate（未配置 / 查询失败 / 按量余额 / 无生效订阅）、按工作区子 tab
（「未归属」对账行、失败数 warn-ink）、价格表的未保存 + 保存失败态、深色下的通道与账本、
侧栏 rail 几何（探针）、`prefers-reduced-motion` 下的转圈——全部核对通过。
**并修掉最后一类不合规**：状态文字仍有用 `fg-3` 的（未选中的窗口 tab / 子 tab / 时间跨度 /
计费性质 / 自动刷新档位、`未配置` 芯片、ghost 按钮文字、零金额、搜索框 placeholder、自动刷新
状态行）——全部升到 `fg-2`；「当前项」改由字重 + 实条 + 洗色承担；顺手删掉因此失效的
`.dtpl-quota-autorefresh-live`。至此**全部要读的文本都在 4.5:1 以上**，`fg-3` 只剩
≤10px 短标签与非文字装饰。

**仍未做 / 留待评审**：

- 窄 sheet 上未补 44px 的控件：窗口 tab(30)、`重新扫描`(30)、卡片刷新(28)、时间跨度(28)、
  计费性质(24)、自动刷新档位(24)。**按 §5.3 的判据**它们都不是"唯一入口/退出"，故未动；
  要推翻就带着"它是唯一入口"的证据来。
- 五个窗口 tab 在窄屏走横向滚动，没有溢出提示；如果以后 tab 变多，需要一个可操作的溢出披露。
- `dtpl-price-table` / `dtpl-price-col-more` 两个类没有样式规则（前者是 `aria-controls` 的目标，
  后者是网格第三格的占位）——按 §11 第 15 条它们算结构锚点，留着；如果哪天要清干净，
  删类留 `id` / 留空 span 即可。
- 侧栏 **rail（56px 窄栏）** 的形状只在预览台用探针验过（harness 固定传 `wide: true`）：
  36×36、`border-radius:50%`、图标 18px 成立；真实 rail 下的 label 由宿主不渲染。

---

## 13. 依据与检索

- 风格与每条形制的推理、被否掉的版本、实测对比度 → [`DESIGN.md`](DESIGN.md) §4
  （含"D-025/D-027/D-028/D-029 为什么这么改"），决策正文 → [`DECISIONS.md`](DECISIONS.md)。
- 本次用 `ui-ux-pro-max` 数据集交叉核对：命中的风格类别是 **Data-Dense Dashboard**
  （多图表/数据表/KPI 卡/最小内边距/浅深双模式），与本浮窗一致；本文编码的是它那批
  **可判定的通用项**（对比度 4.5:1、可见焦点、键盘可达、`prefers-reduced-motion`、目标尺寸、
  直接标注优于只靠悬停、颜色不单独承载语义、数字格式化）。
  **它的配色与字体建议未采用**：本插件的颜色必须跟随宿主 `--dsw-alias-*`、字体按 §4.1 保持保守，
  换成数据集里的蓝/amber 板与 Fira 字对会直接破坏不变量 1。数据集的桌面/移动 App 专章同样不适用。
