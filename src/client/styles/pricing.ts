/** styles.ts 片段：pricing。由 `injectStyles` 按序拼接。 */
export const CSS_PRICING = `/* 价格表 tab */
/* 这个 tab 是表格，不是表单：每个 route 一张卡，每个模型一行，四个 ¥/M 桶作为固定右对齐列，数字可以纵向比对。 */

[data-plugin="dsh-tokbook"] .dtpl-price-sec{display:flex;flex-direction:column;gap:14px;}
[data-plugin="dsh-tokbook"] .dtpl-price-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-search{
  flex:1;min-width:0;height:28px;padding:0 10px;
  border:1px solid var(--dtpl-border);background:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:12px;
}
/* 工具栏搜索框是**唯一一处 placeholder-only** 的字段（空间预算，见 UI-SPEC §6.8）：
   正因为它没有持久可见的标签，placeholder 就是它唯一可见的名字，所以墨色走 fg-2 而不是三级色。 */
[data-plugin="dsh-tokbook"] .dtpl-price-search::placeholder{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-chip{
  appearance:none;flex:none;height:28px;padding:0 10px;
  display:inline-flex;align-items:center;gap:6px;
  border:1px solid var(--dtpl-border);background:transparent;
  color:var(--dtpl-fg-2);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-chip:hover{color:var(--dtpl-fg);}
/* 筛选器开着 = 这张表被过滤了，是一件要说出来的事——走 amber 边框 + warn-ink 文字
   （裸 warn 作正文只有 2.15:1）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-chip.is-on{
  color:var(--dtpl-warn-ink);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
  background:color-mix(in srgb,var(--dtpl-warn) 10%,transparent);
}
/* 一次性图例：解释「—」的含义，说一遍，而不是每行都说。 */
[data-plugin="dsh-tokbook"] .dtpl-price-legend{
  margin:0;font-size:11px;line-height:17px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-legend b{color:var(--dtpl-warn-ink);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-price-cards{display:flex;flex-direction:column;gap:8px;}
/* 一张路由卡 = 同一块读数面板。上一版是 .5px 内阴影 + 4% 洗色的无边框卡片，
   边是糊的；现在外轮廓与材质分开给（见 tokens 的 --dtpl-metal）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-card{
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
  overflow:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-price-head{
  display:flex;align-items:center;gap:8px;
  padding:8px 10px 8px 8px;border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-price-card[data-collapsed="true"] .dtpl-price-head{border-bottom:0;}
/* 折叠头作为整体换行，而不是压碎自己的计数：route key 是不可预测的值，所以只有它可以省略号截断，摘要保持完整文本。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fold{
  appearance:none;border:0;background:transparent;text-align:left;
  flex:1;min-width:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  row-gap:2px;
  padding:3px 4px;
  font:inherit;color:inherit;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fold:hover{background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-caret{flex:none;width:10px;color:var(--dtpl-fg-3);font-size:9px;}
[data-plugin="dsh-tokbook"] .dtpl-price-label{flex:none;font-size:13px;line-height:20px;font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-key{
  flex:0 1 auto;min-width:0;
  font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-count{
  flex:none;white-space:nowrap;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
}
/* 计费性质切换：全窗口唯一的「当前项」语言——横排 + 竖发丝分隔 + 底部实条。
   上一版是药丸轨道（灰底 + --dtpl-card 抬起的圆角块 + 投影），与窗口 tab 条、
   总览子 tab、通道时间跨度各说各话，同一个窗口里因此有四种「选中」。 */
[data-plugin="dsh-tokbook"] .dtpl-price-switch{
  flex:none;display:flex;align-self:center;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button{
  position:relative;appearance:none;border:0;background:transparent;
  height:24px;padding:0 11px;
  color:var(--dtpl-fg-2);font:inherit;font-size:11px;line-height:16px;font-weight:500;
  white-space:nowrap;cursor:pointer;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button + button{border-left:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button[aria-pressed="true"]{
  color:var(--dtpl-fg);font-weight:600;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button[aria-pressed="true"]::after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-empty{
  margin:0;padding:10px 11px;font-size:12px;line-height:18px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-rows{display:flex;flex-direction:column;}

/* 费率格的唯一度量，定义在 tab 根上，表格与调价史抽屉不会分家。

   宽度由费率能是什么决定，不是今天的数字。最长的一笔是 8 个字符（0.003625——DeepSeek
   自己的历史缓存命中价——或 123.4567）。**数字必须是等宽**（见下面 .dtpl-price-input）：
   比例体的数字宽度不一，"1.065" 与 "10.65" 的同位数字不会落在同一条竖线上，固定列的
   意义就没有了。等宽之后宽度可以直接算出来：字宽 = 0.55–0.6em（Consolas 0.55、
   SF Mono / JetBrains Mono 0.6），12px 下 8 字符 = **52.8–57.6px**（本机实测 52.78），
   加两侧各 7px 内边距与 2px 边框 = 68.8–73.6px，取 **74px** 覆盖最宽的那档字体。
   （上一版是 64px，而那一版漏了 font-family、实际按比例体渲染，所以「64px 够用」这条
   在真实字形下从来不成立；本条按实测重推。）
   --dtpl-cell-pad-x 有意与列头共享：列头必须和下面的数字结束在同一边缘。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sec{
  --dtpl-cell-pad-x:7px;
  --dtpl-rate-w:74px;
  --dtpl-rate-gap:6px;
  --dtpl-rates-w:calc(4 * var(--dtpl-rate-w) + 3 * var(--dtpl-rate-gap));
}

/* 每行是自己的网格，轨道与上方列头相同：身份（伸展）| 四个固定费率列 | 一个展开槽。

   费率轨道按费率实际是什么来定，而不是按列标签：最窄的安全列宽把剩余宽度留给唯一放不可预测文本的列——模型身份。
   展开槽 32px 由下面 .dtpl-price-more 的命中区决定，两处必须一起改（列宽小于控件会把控件压回去）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cols,
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) var(--dtpl-rates-w) 32px;
  column-gap:10px;align-items:center;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cols{
  padding:6px 10px 4px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-col-id{padding-left:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-cols .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);
}
/* 标签与数值精确共享右边缘：否则列头结束在格子的边框，数字却结束在内侧 7px 处。 */
[data-plugin="dsh-tokbook"] .dtpl-price-col-rate{
  text-align:right;padding-right:var(--dtpl-cell-pad-x);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  min-height:40px;padding:4px 10px;border-top:1px solid var(--dtpl-hairline);
  scroll-margin-block:56px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-row:first-child{border-top:0;}
/* 三种行状态，靠同一条约定区分：墨色侧条 =「未保存」，中性抬升 =「已展开」，环 =「焦点」。
   侧条从不花在脏以外的事情上，而且取墨色不取强调色——「这条还没落盘」是一个**状态**，
   不该借一个在不同 DSH 皮肤下会变蓝的身份色。 */
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-dirty="true"]{
  background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);
  box-shadow:inset 2px 0 0 var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-open="true"]{
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
/* 焦点环继续跟随宿主（--dtpl-accent）——焦点是**系统信号**，不是这套视觉语言的一部分：
   键盘用户看到的是自己皮肤里的那个「焦点色」，这点不跟风格抢。 */
[data-plugin="dsh-tokbook"] .dtpl-price-row:focus-within{
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-accent) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-dirty="true"]:focus-within{
  box-shadow:inset 2px 0 0 var(--dtpl-fg),
    inset 0 0 0 1px color-mix(in srgb,var(--dtpl-accent) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-id{display:flex;flex-direction:column;gap:2px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-name{
  display:flex;align-items:center;gap:5px;min-width:0;flex-wrap:wrap;row-gap:2px;
}
/* 模型选择器的身份拆分，各占一行，互不抢宽度：人读的 NAME 是标签、永不缩没；精确 model 字符串是身份（计费键），占下一行整宽。 */
[data-plugin="dsh-tokbook"] .dtpl-price-title{
  flex:0 1 auto;min-width:0;
  font-size:12px;line-height:16px;font-weight:500;color:var(--dtpl-fg);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 没有名字的行只靠精确字符串站立，所以接过标签的色调和字重，而不是读成被弱化的旁注。 */
[data-plugin="dsh-tokbook"] .dtpl-price-title:only-child{
  color:var(--dtpl-fg);font-family:var(--dtpl-mono);
}
/* 徽章 = 四级**描边芯片**，不是一个色块矩阵：
     默认（仅账本 / 峰谷 N 段）  描边 + 三级文字 —— 只是说明这个值从哪来；
     需要看一眼（价格未知 / 未生效）1px amber 边框 + warn-ink 文字；
     还没落盘（未保存）          实心墨芯片，与「订阅」同一形——它必须从一列灰芯片里跳出来。
   上一版一律是圆角 + --dtpl-accent 染色底：accent 在 DSH 皮肤里等于墨色，于是「峰谷 2 段」
   和「仅账本」在界面上是同一块灰，等于没有层级；换个皮肤又会整片变蓝。
   现在层级只由**边界与填充**表达，色相留给真正要看的状态。 */
[data-plugin="dsh-tokbook"] .dtpl-price-badge{
  flex:none;
  display:inline-flex;align-items:center;height:15px;padding:0 5px;
  border:1px solid var(--dtpl-border);
  font-size:10px;line-height:13px;font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge-unknown{
  color:var(--dtpl-warn-ink);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge-dirty{
  color:var(--dtpl-card);background:var(--dtpl-fg);border-color:var(--dtpl-fg);
}
/* 峰谷标记：这一行可见的四个数字不是全部——它必须一眼读成「里面还有更多定价」。
   它不抢颜色，靠 1px 墨边把自己从「仅账本」那类中性芯片里抬一档。 */
[data-plugin="dsh-tokbook"] .dtpl-price-badge-slot{
  color:var(--dtpl-fg);border-color:color-mix(in srgb,var(--dtpl-fg) 35%,transparent);
}
/* 未生效是提醒，不是警报：价已写上，只是闲着。 */
[data-plugin="dsh-tokbook"] .dtpl-price-badge-idle{
  color:var(--dtpl-warn-ink);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
}
/* 出处行：这个价是什么，以及账本用它计了多少。行的身份不在此重复——上一行已经说过一次。 */
[data-plugin="dsh-tokbook"] .dtpl-price-meta{
  display:flex;align-items:baseline;gap:5px;min-width:0;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-meta-text{
  flex:0 1000 auto;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 这一行哪里不对，紧挨在自己的格子下面。 */
[data-plugin="dsh-tokbook"] .dtpl-price-issue{
  margin:0;padding:2px 10px 6px 10px;
  font-size:10px;line-height:15px;color:var(--dtpl-err);
}

/* 四个格子：平时像文本，聚焦时是真输入框。右对齐等宽数字让整列可纵向比对。
   **等宽不是这里的装饰，是列宽度的前提**：--dtpl-rate-w 的 64px 就是按 12px 等宽数字
   量出来的（最宽的一档 0.003625 是 47.9px + 两侧 7px 内边距 = 62px）。上一版漏了
   font-family，数字实际按比例体渲染，那条度量与真实字形对不上；这里补上。 */
[data-plugin="dsh-tokbook"] .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-cell-k{
  display:none;font-size:9px;line-height:12px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-price-input{
  width:100%;box-sizing:border-box;
  height:26px;padding:0 var(--dtpl-cell-pad-x);
  border:1px solid transparent;
  background:transparent;color:var(--dtpl-fg);
  font-family:var(--dtpl-mono);font-size:12px;line-height:16px;
  font-variant-numeric:tabular-nums;text-align:right;
}
[data-plugin="dsh-tokbook"] .dtpl-price-input::placeholder{color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-price-input:hover{border-color:var(--dtpl-border);}
[data-plugin="dsh-tokbook"] .dtpl-price-input:focus{
  outline:none;border-color:var(--dtpl-accent);
  background:var(--dtpl-surface);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell[data-state="bad"] .dtpl-price-input{
  color:var(--dtpl-err);border-color:color-mix(in srgb,var(--dtpl-err) 55%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell-err{
  font-size:10px;line-height:14px;color:var(--dtpl-err);text-align:right;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
/* 展开槽：一行里唯一的按钮，而且是进入该行调价史的**唯一**入口（行本身不可点，费率格是输入框）。
   所以它必须读成控件而不是装饰。两条规矩分开记：
     · **字形尺寸全窗口一个值**（14px、--dtpl-fg-2）。上一版是 10px 的三级色，压在 40px 高、
       右边还挨着四列 74px 数字的行尾，读起来像排版符号——它当时的对比度 5.67:1 是够的，
       所以问题不在看得清，而在**看不出它可以点**。放大提亮靠大小与字重变响，不靠再画一条边框
       （多一行一条 1px 框与「线有预算」相抵）。
     · **命中区按输入方式分档**（见 shared 的窄屏段：触控给 44px）。桌面 32px 与它同族，
       两档都远在 WCAG 2.2 的 24px 底线之上——底线是下限，不是目标。 */
[data-plugin="dsh-tokbook"] .dtpl-price-more{
  appearance:none;border:0;background:transparent;
  width:32px;height:32px;padding:0;
  color:var(--dtpl-fg-2);font:inherit;font-size:14px;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-more:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-more[aria-expanded="true"]{
  color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
}

[data-plugin="dsh-tokbook"] .dtpl-price-add{
  appearance:none;border:1px solid var(--dtpl-border);background:transparent;
  display:inline-flex;align-items:center;justify-content:center;
  height:26px;padding:0 10px;
  color:var(--dtpl-fg-2);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-add:hover{color:var(--dtpl-fg);border-color:color-mix(in srgb,var(--dtpl-fg) 25%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:disabled{opacity:.45;cursor:not-allowed;}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost{
  appearance:none;border:0;background:transparent;
  height:24px;padding:0 8px;
  color:var(--dtpl-fg-2);font:inherit;font-size:11px;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger:hover{color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 10%,transparent);}

/* ▸ 后面的调价史抽屉——表面阶梯：
     page        （无）
     card         fg 3%                       ← 本 tab 的面板（与全窗口同一块配方）
     open row     fg 7%                       ← 它所属的展开行
     drawer       无填充，实线缝                ← 一个凹槽，不是另一块面板
     .seg         1px 硬边框 + --dtpl-surface  ← 从凹槽里抬出的块
     .slot        fg 3%                        ← 块内的峰谷窗口
   抽屉刻意不加自己的洗色：半透明叠半透明会让抽屉与卡片同调。凹槽靠实线缝和站在上面的块来表现。
   上一版这里用的是虚线缝——全窗口别处没有虚线，虚线会把它读成「还没画完的框」。 */
[data-plugin="dsh-tokbook"] .dtpl-price-history{
  display:flex;flex-direction:column;gap:8px;
  padding:8px 10px 12px;
  border-top:1px solid var(--dtpl-border);
  background:transparent;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg{
  display:flex;flex-direction:column;gap:5px;
  padding:6px 8px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-surface);
}
/* 「当前生效」的那一段：墨色侧条 + 墨色边框。它是一个**身份**（这一段在管现在），
   不是一个分类，所以不借色相；行内四档价与行尾徽章已经把它说清楚了，这里只补定位。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg[data-active="true"]{
  border-color:color-mix(in srgb,var(--dtpl-fg) 35%,transparent);
  box-shadow:inset 2px 0 0 var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-head{display:flex;align-items:center;gap:8px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-date{display:flex;align-items:center;gap:6px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-date-k{font-size:10px;line-height:14px;color:var(--dtpl-fg-2);white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-input-date{
  width:auto;min-width:158px;text-align:left;border-color:var(--dtpl-border);
  background:var(--dtpl-card);padding:0 6px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-tag{
  display:inline-flex;align-items:center;gap:5px;min-width:0;
  font-size:10px;line-height:15px;color:var(--dtpl-fg-3);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-live{
  font-style:normal;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-actions{
  margin-left:auto;display:inline-flex;align-items:center;gap:2px;
  opacity:0;transition:opacity .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg:hover .dtpl-price-seg-actions,
[data-plugin="dsh-tokbook"] .dtpl-price-seg:focus-within .dtpl-price-seg-actions{opacity:1;}
/* 抽屉是表单，所以四个费率字段用它们被给出的宽度（四等分列），而每个输入框仍保持表格的费率度量——限制输入框而不是列。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-rates,
[data-plugin="dsh-tokbook"] .dtpl-price-slot-rates{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
  column-gap:var(--dtpl-rate-gap);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-rates .dtpl-price-input,
[data-plugin="dsh-tokbook"] .dtpl-price-slot-rates .dtpl-price-input{
  max-width:var(--dtpl-rate-w);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-rates .dtpl-price-cell-k{display:block;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg .dtpl-price-input{
  text-align:left;border-color:var(--dtpl-border);background:var(--dtpl-card);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-note{display:block;}
[data-plugin="dsh-tokbook"] .dtpl-price-input-note{text-align:left;font-variant-numeric:normal;font-family:inherit;}

/* 分段的全天价有标签，因为同样的四个桶会在下方再次出现作为例外时段：没有 00:00–24:00 区间，两级会看起来像同一张表的两行。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sub{display:flex;align-items:baseline;gap:6px;}
[data-plugin="dsh-tokbook"] .dtpl-price-sub-k,
[data-plugin="dsh-tokbook"] .dtpl-price-slots-k{
  display:inline-flex;align-items:baseline;gap:5px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-sub-k em,
[data-plugin="dsh-tokbook"] .dtpl-price-slots-k em{
  font-style:normal;font-family:var(--dtpl-mono);color:var(--dtpl-fg-3);
}

/* 峰谷时段：一行一个。上一版把它整块染成 accent——accent 在 DSH 皮肤里是墨色，于是它
   读起来只是一块浅灰；换个皮肤又会变蓝。现在它靠**凹槽**说话：块内一层 3% 洗色 + 1px
   边框，读作「这一段时间有自己的价」，与上面的全天价是两个层次，靠形状分而不是靠色相分。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slots{display:flex;flex-direction:column;gap:5px;margin-top:1px;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot{
  display:flex;flex-direction:column;gap:5px;
  padding:5px 7px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-clock{
  display:inline-flex;align-items:center;gap:4px;
  font-family:var(--dtpl-mono);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-dash{color:var(--dtpl-fg-3);font-size:11px;}
[data-plugin="dsh-tokbook"] .dtpl-price-select{
  appearance:none;height:24px;padding:0 20px 0 7px;
  border:1px solid var(--dtpl-border);background:var(--dtpl-card);color:var(--dtpl-fg);
  font:inherit;font-size:11px;line-height:16px;cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,var(--dtpl-fg-3) 50%),
    linear-gradient(135deg,var(--dtpl-fg-3) 50%,transparent 50%);
  background-position:calc(100% - 11px) 10px,calc(100% - 7px) 10px;
  background-size:4px 4px,4px 4px;background-repeat:no-repeat;
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-select:hover{border-color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-price-select-days{min-width:68px;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-rates .dtpl-price-cell-k{display:block;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot:hover .dtpl-price-seg-actions,
[data-plugin="dsh-tokbook"] .dtpl-price-slot:focus-within .dtpl-price-seg-actions{opacity:1;}
[data-plugin="dsh-tokbook"] .dtpl-price-slots-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-history-foot{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-history-hint{margin:0;font-size:10px;line-height:15px;color:var(--dtpl-fg-2);}

/* 文件的保存状态，放在工具栏里：这是一张会自己写回的表的整个反馈回路，所以失败时要换行，而不是被裁掉。
   「保存中」不借强调色——它既不是成功也不是问题，动静由文字本身给；颜色只留给已保存（ok）与
   未保存 / 失败（warn / err）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-state{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saved{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saving{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-invalid{color:var(--dtpl-warn-ink);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-error{color:var(--dtpl-err);font-weight:600;}
`
