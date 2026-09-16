# dsh-tokbook 界面规范（UI-SPEC）

> **Doc meta** · role: reference · language: zh-CN · status: current · last-reviewed: 2026-09-17 · supersedes: —

> 本文是这扇浮窗的**禁令与达标线**：什么不许做、必须达到什么、怎么验。写给下一个动 UI 的人（或 AI）
> ——照它做就不会破坏现有风格，也不必把理由重推一遍。
>
> - **取值**（三层 token 总表、组件规格与状态矩阵、字号 / 间距 / 控件几何 / 动效量表、无障碍语义）→
>   [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md)。**本文不再复制那张表**：它只写"不许怎么用"与"必须到哪条线"。
> - **为什么长这样**（风格出处、每条规则的推理与被否掉的版本）→ [`DESIGN.md`](DESIGN.md) §4；
>   持久决策 → [`DECISIONS.md`](DECISIONS.md) **D-023…D-037**。
> - **接口与数据**（路由 / wire JSON / 价格分段语义）→ [`CONTRACTS.md`](CONTRACTS.md)。
> - **踩坑与验证手法**（选择器作用域、bundle rev、预览台）→ [`LESSONS.md`](LESSONS.md)。
>
> **权威顺序：代码 > DESIGN-SYSTEM（取值）> 本文（禁令与达标线）> DESIGN（推理）。**
> 本文与 `src/client/styles/**` 不符时，是本文过期——**改本文，不是"照文档改代码"**。
> 规范的收益全在**能被引用**，所以每条都写到可判定的程度。

---

## 1. 三条不可协商的不变量

1. **形状跟着风格，颜色跟着宿主。** 直角 + 硬边 + 金属 + 品牌黄是这套语言；底色、文本色、
   状态色一律走 `--dsw-alias-*`（插件必须同时成立于浅色与深色皮肤）。**不许**把 `--dsw-*`
   解析出的具体色值抄进样式，也**不许**让形态跟着宿主走（圆角按钮、pill 分段器都是被否掉的方向）。
2. **品牌黄是"料"，不是"线"。** 恒定黄只在**实心块 + 墨边**这个形态上出现（唯一例外是文本选区的
   洗色），且只有 §2.2 表里那几类用法；黄做 1px 线、做文字、做大面积填充一律禁止
   （`#FFCD00` 压白卡只有 **1.57:1**）。
3. **全窗口只有一份配方。** 一块面板、一种"当前项"、一档数字等宽、一套表面阶梯
   （取值分别在 DESIGN-SYSTEM §3.1 / §4.8 / §5.1 / §3.2）。任何一面要长得不一样，
   都得先在规范里写出理由并登记，否则就是漂移。

---

## 2. 颜色法：色相是一笔预算

### 2.1 预算的三个来源

| 层 | 来源 | 数量 |
|---|---|---|
| 主题色 | `--dsw-alias-*`（随皮肤翻转，经 L2 别名为 `--dtpl-*`） | 全部底色 / 文本 / 边框 |
| 中性墨色 | `color-mix(fg N%, transparent)` | 面板洗色 3%、表头列头 6–7%、轨道 12–16%、柱体 45%、峰值柱 70% |
| 状态色 | `ok` / `warn` / `err` | **只在真的要看一眼时** |

**这三层怎么落到 token、每个 token 归哪一层**——见 [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) §1–§2。

### 2.2 品牌黄的预算（处数 **与** 面积）

黄只出现在下面这几类地方，全部是**实心块 + `inset 0 0 0 1px var(--dtpl-on-brand)` 墨边**：

| 类别 | 几何 | 实现 |
|---|---|---|
| 当前页标记 | 5px 高实条（压 tab 行下边界）；未保存标记 6px 方点 | `.dtpl-tab[aria-selected]::after`、`.dtpl-tab-dot` |
| 峰值标记 | 4×8px 牌，挂在峰值柱值标签**前面** | `.dtpl-bar-label.is-peak::before` |
| 工业徽记 | 7×13px 牌（节标题 / hero 口径词）、18×18px 牌（口径页序号）、22×22px chip（窗口标题） | `.dtpl-sec-title::before`、`.dtpl-total-k::before`、`.dtpl-doc-idx`、`.dtpl-title-ico-chip` |
| 文本选中 | `color-mix(brand 55%, transparent)` 洗色 | `.dtpl-body ::selection`（**唯一不带墨边的用法**：它不画边界，只当选区底，字仍是墨色） |

- **面积也是预算。** 这些用法里最大的一处曾独占全 UI 黄面积 ≈97%（满高峰值柱曾是整块黄），
  已改掉（D-029，实测 3709px² → 67px²）。新增黄块前先问：**它会不会成为全屏最大的那块饱和面？** 会 → 不批。
- 黄**不做**：线（1px 刻度、分隔线、柱脚条）、文字、柱体/柱顶盖片、大面积底。
  趋势柱、时间轴点、占比尺一律墨色。
- 不引入第二个色相。需要"分类"时用形状，不用色（§2.4）。
  **唯一的例外是 hero 卡首那条图**（`.dtpl-hero-art`）里插画自带的颜色（角色那双红眼睛）：
  它是**一张图**，不是界面用来分类的颜色，也没有第二个用途可以混（D-035 登记）。

### 2.3 默认状态不染色

占比条、额度条、额度表盘的默认填充是 `fg-2`（健康态**中性**）。若默认就是绿的，
绿只是"条的颜色"、不是信息，三根绿条还会成为整屏最响的东西。**屏幕上出现的每一处色相
都意味着"这里看一眼"**，而唯一恒定的色相是品牌黄。

映射：`tone-ok → fg-2`、`tone-warn → warn-ink`（文字）/ `warn`（条体）、
`tone-danger → err`（文字与条体都用 err）。

### 2.4 分类靠形状，金额靠字重

- **分类**（按量/订阅、仅账本/峰谷 N 段、记了/没记、价格未知/未生效/未保存）：
  描边芯片 = 一类，**实心墨芯片** = 需要跳出来的那一类（订阅、未保存），amber 边框 + `warn-ink`
  = 需要看一眼（价格未知、未生效、筛选器开着）。**不留 accent 染色底**。
- **金额双桶（hero 与每一行同一套口径）**：`spend` 走 `fg` + `600`，`subscriptionValue` 走
  `fg-2` + `400` 并**永远带着"订阅价值"这个名字**。区分由字重 + 标签承担，不借颜色
  （DSH 皮肤里 `--dtpl-accent` 本就等于墨色，颜色区分是空操作）。
  **行内也适用**：`.dtpl-cash-amt` / `.dtpl-sub-amt` 一对类就是这条的实现。
  2026-09-15 审计发现行内曾整体反过来（订阅金额拿主墨色 600、现金金额是次要色裸字），
  于是同一扇窗里 hero 说"现金最重要"、行里却把没花的钱写成最响的那个数——已按本条改正。

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

**墨色三档的判据（2026-09-15 审计后收紧）。** 三级色对卡面只有 **3.47:1**，所以
`fg-3` 只给"不是信息"的东西与 ≤10px 的状态短标签；**任何要读的文本都走 `fg-2`（≈5.4:1）**，
**包括未被选中的选项**——"当前项"由字重 + 实条 + 洗色说，不靠把没选中的洗淡。这是 DESIGN §4
那句"标签与口径注释全部留在 fg-2，安静由字号、字距与留白做，不靠把字洗淡到读不清"的落地。
三档里只有 `fg` 与 `fg-2` 承载正文；`fg-dim` 连短标签都不给。

**新增文本色必须先在浅/深两套皮肤下各量一次**，把实测值写进样式注释，再进 tokens。

---

## 3. 窄屏（≤640px）契约

- `.dtpl-overlay` 改贴底全宽；`.dtpl-card` `width:100%`、`height:min(94dvh,94vh)`，
  入场改从下方滑入。**直角语言里没有"只圆上角"这条移动端习语。**
- 内边距整体收一档——各容器两档（桌面 / 窄屏）的取值见
  [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) §5.2。
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
- **唯一入口/退出类控件补到 44px**：现役是价格表展开钮、明细子 tab、关闭钮（它是浮窗唯一的
  显式退出）。判据与桌面几何见 DESIGN-SYSTEM §5.3；**"是不是唯一入口/退出"是唯一的加宽理由**，
  不因为"窄屏"两个字就统一放大。
- 长路由键、路径这类不可预测的值可以省略，**摘要与计数保持完整**。
- **页头行数不随内容变**：会随数据变宽变窄的那一块（如用量明细的窗口合计，实测 308–339px）
  **单独占一整行**，绝不与选择器挤在同一行——挤在一起时它一变宽就把选择器挤到下一行，
  下面整块跟着上下跳（实测一次跳 33px）。

---

## 4. 无障碍底线

每个元素**必须带什么语义**（`role` / ARIA / focus / 键盘）逐条列在
[`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) §6。这一节只放底线与禁令：

- **焦点必须可见**：不许在没有替代指示的情况下 `outline:none`（三处例外见 DESIGN-SYSTEM §6）。
  **焦点不被遮挡**：`.dtpl-body` 有 `scroll-padding`；粘性底栏不得压住聚焦控件。
- **每个动作都要能不用指针完成**，且只给 pointer 的交互（拖拽 / 悬停）必须有键盘替代。
- **颜色不单独承载语义**：状态同时要有文字或形状（失败数染色 + "失败"标签、当前页黄条 + 字重、
  峰值黄牌 + 加粗数值）。`title` 只作补充，**信息不能只存在 `title` 里**。
- **触控与指针**：可点元素 `cursor:pointer`；静态行不加 hover 反馈；禁用态用真 `disabled`；
  **功能性图标**一律用内联 SVG（要求见 DESIGN-SYSTEM §5.5），**禁止 emoji**。
- **动效**：`prefers-reduced-motion` 下**必须关掉全部动画**，且**关掉之后必须还有反馈**
  （例：转圈停住时控件仍是 `disabled` + 降透明，随后的"更新于 <时刻>"继续说明状态）——
  没有哪一处只靠动画传达"正在进行"。**要关的清单见 DESIGN-SYSTEM §5.4**（入场类 + 常驻类 +
  占比条 / 额度条 / 表盘那三条"量在变"的填充），漏一条就是这一条违规。
- 本插件是**桌面 Web 的 DSH 插件**，移动端 App 专章（安全区、haptics、Dynamic Type、
  底部导航）**不适用**；窄屏只按 §3 的 sheet 契约走。

---

## 5. 反模式清单（看到就是错）

1. emoji 当图标；图标按钮没有可访问名字。
2. 黄做线 / 文字 / 柱体 / 大面积；引入第二个色相。
3. 默认状态染色（绿的健康条、蓝的"重点"底）；把 `--dtpl-accent` 当分类色或强调色。
4. `warn` 直接做正文；`fg-3` 承载**要读的文本**（读数、身份、标签、旁注、列头、轴日期、
   **未选中的选项**）——它只管 ≤10px 短标签与装饰。
5. **说明句排到 11px 以下、正文句排到 12px 以下**，或把 9–10px 用到要读的句子上（那一档只属于
   列头 / 柱值 / 芯片 / 轴刻度 / 表盘说明这类短标签）。分带判据见 DESIGN-SYSTEM §5.1。
6. pill 分段器 / 圆角按钮 / 新的"选中"样式——同一个窗口第二种"当前项"语言。
7. 面板用半像素内阴影 + 洗色当边界；面板加投影；为某个 tab 单独提亮面板；卡内再套第二只框。
8. 虚线；面板上的渐变（全窗口只有骨架 shimmer 与 select 箭头两处）；`clip-path` 切角。
9. 硬编码色值 / 圆角（除 tokens 里的兜底与注释里的实测值）。
10. 静态行 hover 底洗色；只有 `title` 才能读到的信息；颜色单独表达状态。
11. 固定列数字用比例体；读数漏 `tabular-nums`。
12. 列头 `aria-hidden` 却没有 `.dtpl-sr` 列名补偿。
13. 只给 pointer 的交互（拖拽/悬停）没有键盘替代。
14. 动画在 `prefers-reduced-motion` 下照播；逐帧改 `width/height/top/left`（这类改用 `transform`）。
15. **跨 tab 复用的度量**放进某一节的元素里（另一个 tab 取不到变量 → 整条声明静默失效）。
16. **死类与死钩子**：TSX 里挂着、样式表里没有任何规则的类（读者会以为它有样式），样式表里定义了、
    全仓库没人用的类，以及**没有任何消费者的 `data-*` 状态钩子**（同一病症，只是长在属性上——
    删掉它，或者给它一个真的消费者）。结构锚点（`aria-controls` 的目标、网格占位）除外——
    但那种情况也别配一个空类名，留 `id` 就够。
17. **重复编码**：把已经印在旁边的数再画一遍形状（读数格每格那条 2px 占比尺 D-037 撤掉就是这条），
    或把两个几乎相等的百分比并排（缓存命中率与旁边那个"占 x%"）。

---

## 6. 自检与待办

**提交前**（按改动面选最小那道门）：

```bash
pnpm build      # 改了 styles/** 或 .tsx：构建后刷新页面看真实渲染
pnpm typecheck  # 改了别的 src/**
pnpm docs:check # 改了本文或 DESIGN-SYSTEM
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
Select-String src/client/styles/*.ts -Pattern 'color:var\(--dtpl-fg-3\)'  # 逐条对 DESIGN-SYSTEM §2.1：只许出现在未选中项 / ≤10px 短标签 / 装饰上
Select-String src/client/styles/*.ts -Pattern '--dsw-'             # 只许出现在 DESIGN-SYSTEM §2.3 的白名单五处（+ tokens 的 var() 兜底）
```

**类名交叉检查**（找死类与没样式的类；§5 第 16 条）：把 TSX 里出现的 `dtpl-*` 与样式表里定义的
比一遍——两个方向都要看。一句版：

```powershell
# 双向比对：样式表定义但没人用的类 / TS 里挂着但样式表里没有的类（结构性 hook 除外）
# ⚠ 必须先把多个文件的内容 join 成一个字符串：`Get-Content -Raw` 传多个路径返回的是**数组**，
#   而「数组 -notmatch 'x'」返回的是"不匹配的那些元素"（非空数组恒为真），于是每个类都会被误报成死类。
$cssText = (Get-ChildItem src/client/styles/*.ts, src/client/styles.ts | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
$tsText  = (Get-ChildItem src/client -Recurse -Include *.tsx,*.ts | Where-Object { $_.DirectoryName -notlike '*\styles' -and $_.Name -ne 'styles.ts' } | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
$css = [regex]::Matches($cssText,'\.(dtpl-[a-z0-9-]+)') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$ts  = [regex]::Matches($tsText,'(dtpl-[a-z0-9-]+)')  | ForEach-Object { $_.Value }          | Sort-Object -Unique
'死类（CSS 有、TS 无）:';     $css | Where-Object { $ts  -notcontains $_ }
'没样式的类（TS 有、CSS 无）:'; $ts  | Where-Object { $css -notcontains $_ }
```

模板字符串拼出来的类名（`` `dtpl-quota-tone-${tone}` ``）在两边都只会留下前缀，比对结果里
那一截前缀是**正常的**，不是死类。

**渲染验证**：`scripts/preview-overlay.mjs` 预览台（每次 `pnpm build` 后**重启**；端口被占时先
`Get-NetTCPConnection -LocalPort <port> -State Listen` 找 pid 再停——`job_kill` 只杀外层 shell）。
空态 / 错态由 **`TOKBOOK_MODE=empty|err` 环境变量**选（一个进程一种形状，不是 query flag），
`?dark=1` 切深色皮肤、`?tab=` 与 `?quota=` 直达各面。
或浏览器桥接读 `getComputedStyle`（先 `snapshot` 再 `evaluate`，见 [`LESSONS.md`](LESSONS.md) §6）。

> **截图有个坑**：遮罩带 `backdrop-filter` 时，Chromium 的**整页**截图会把深色卡拍成浅色
> （元素截图与 `getComputedStyle` 都正常）。判断颜色一律以 computed / 元素截图为准，
> 或临时 `overlay.style.backdropFilter='none'` 再整页拍——别据此判定"深色模式坏了"。

### 审计历史

**2026-09-17 第四轮（按规范全文审查后的整改）**：对 `src/client/**` 做了一次逐条的规范审查，改掉：

- **分带收口**：§5 第 5 条此前与 DESIGN-SYSTEM §5.1 的「11–11.5px 给注释句」互相矛盾。现在两条
  对齐成**9–10px 短标签 / 11–11.5px 说明句 / 12px 起正文句**，判据是"这句话要不要读"。
  随之：`.dtpl-price-slots-k em` 的说明句（10px + `fg-3` + 强制等宽，三种读法都不合格）拆成独立的
  `.dtpl-price-slots-note`（11px + `fg-2` + 不借等宽），`.dtpl-price-sub-k em` 那枚时间范围留等宽、
  墨色升 `fg-2`；`.dtpl-price-history-hint` 10px → 11px（它装的是一句完整的说明）。
- **`.dtpl-quota-gauge-cap` 8px → 10px 且 `fg-3` → `fg-2`**：它是"这个环说的是哪个预算"的唯一可见出处
  （环靠它才不静默换含义），却只有 3.47:1；`%` 号 8px → 9px（仍走 `fg-3`，它是符号不是文本）。
- **五个窗口 tab 的 `aria-controls` 悬空**：panel 的 id 曾随当前 tab 变（`` `dtpl-panel-${tab}` ``），
  于是任意时刻只有当前那个指得到实体。现在五个 tab 共指一个稳定的 `#dtpl-panel`——与
  `ProviderPanel` 的切法条同一判据。
- **卡内错误面补 `role="alert"`**：`QuotaCard` 的"官方查询失败"那一支此前没有（它的兄弟"加载失败"有）；
  只给真出错那支，`未配置` 仍是提示、不当告警播报。
- **死规则 / 死钩子清掉**：`.dtpl-bd-title`、`.dtpl-note`（消费者随 D-032/D-033 撤走）两条样式规则，
  以及六个没有消费者的 `data-*`（`data-plan` / `data-state`（额度卡）/ `data-window` / `data-provider` /
  `data-route` / `data-unpriced`）。反模式第 16 条随之扩到"类**与**状态钩子"。
- **reduce 漏关三条"量在变"的填充**：`.dtpl-model-bar-fill` / `.dtpl-quota-bar-fill` /
  `.dtpl-quota-gauge-fill` 此前在 `prefers-reduced-motion:reduce` 下照播 0.4s，现已列入。
- **本文 §6 的类名交叉检查一行版是坏的**（`Get-Content -Raw` 传多路径返回数组，`-notmatch` 恒真，
  于是每个类都被误报成死类）——已改成双向比对并注明这个坑。

**未改（判定为可接受 / 需维护者裁决）**：`method.ts` 三处 `!important` 只补了注释说明来源不明与
撤销它的实测方法（缺一次真机量值，不盲删）；趋势图那 14 个轴日期仍是普通文本节点（图区 `aria-label`
已含合计与峰值，但收掉它们等于让读屏失去逐日日期，两可）；模型行的「请求 / 压缩 / 失败」仍在
`title` 里（工作区行把「N 失败」放进行内，两行判据不对称，属 D-036 的既有取舍）。

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
≤10px 短标签与非文字/关系符号。

**2026-09-17 第三轮（拆成两份 + D-036/D-037 残留清除）**：原 UI-SPEC 同时装着"取值"与"禁令"两类
内容（token 表、字号量表、间距表、组件规格混在一起）。现按 `DESIGN-SYSTEM.md`（取值真源）/
本文（禁令与达标线）分开，取值只写一次，两边互相引用。同时清掉 D-034…D-037 落地后在本文留下的
四处失效描述：hero 卡下沿的刻度轨（D-034 撤）、读数格内那根 2px 占比尺与派生读数 `.dtpl-stat-rate`
（D-037 撤）、"命中率挂在「缓存读取」格标签行右端"（D-037 起整条不再显示）、"四桶那一档两侧收
12px 给派生读数让位"。逐条按 `src/client/styles/**` 核对。

### 仍未做 / 留待评审

- 窄 sheet 上未补 44px 的控件：窗口 tab(30)、`重新扫描`(30)、卡片刷新(28)、时间跨度(28)、
  计费性质(24)、自动刷新档位(24)。**按 §3 的判据**它们都不是"唯一入口/退出"，故未动；
  要推翻就带着"它是唯一入口"的证据来。
- 五个窗口 tab 在窄屏走横向滚动，没有溢出提示；如果以后 tab 变多，需要一个可操作的溢出披露。
- `dtpl-price-table` / `dtpl-price-col-more` 两个类没有样式规则（前者是 `aria-controls` 的目标，
  后者是网格第三格的占位）——按 §5 第 16 条它们算结构锚点，留着；如果哪天要清干净，
  删类留 `id` / 留空 span 即可。
- 侧栏 **rail（56px 窄栏）** 的形状只在预览台用探针验过（harness 固定传 `wide: true`）：
  36×36、`border-radius:50%`、图标 18px 成立；真实 rail 下的 label 由宿主不渲染。
- **两处"能由 ARIA 表达却用了状态类"的历史写法**：`.dtpl-range-active`、`.dtpl-quota-autorefresh-on`
  （等价于 `aria-pressed`）。按 DESIGN-SYSTEM §1.3 改到那里时顺手收编，**不为此单开一轮**。

---

## 7. 依据与检索

- 风格与每条形制的推理、被否掉的版本、实测对比度 → [`DESIGN.md`](DESIGN.md) §4
  （含"D-025/D-027/D-028/D-029 为什么这么改"），决策正文 → [`DECISIONS.md`](DECISIONS.md)。
- 逐条核对沿用的是 `ui-ux-pro-max` 数据集交叉核对的结论：命中的风格类别是
  **Data-Dense Dashboard**（多图表/数据表/KPI 卡/最小内边距/浅深双模式），本文编码的是它那批
  **可判定的通用项**（对比度 4.5:1、可见焦点、键盘可达、`prefers-reduced-motion`、目标尺寸、
  直接标注优于只靠悬停、颜色不单独承载语义、数字格式化）。
  **它的配色与字体建议未采用**：本插件的颜色必须跟随宿主 `--dsw-alias-*`、字体保持保守
  （DESIGN-SYSTEM §5.1），换成数据集里的蓝/amber 板与 Fira 字对会直接破坏不变量 1。
  数据集的桌面/移动 App 专章同样不适用。
