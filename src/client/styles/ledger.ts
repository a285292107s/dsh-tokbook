/** styles.ts 片段：ledger。由 `injectStyles` 按序拼接。 */
export const CSS_LEDGER = `/* 用量总览 · 明日方舟：终末地 风格 */
/* 三条线：直角与硬边（工程感）、黄只作"料"、构件而非贴图。字体保持保守，不做字体文章。 */

/* hero = 一块被框住的读数仪表：1px 硬边框 + 受光边的金属反光，四角补左上/右下两枚括号，
   底边一条贯通全宽的刻度轨。
   没有别的装饰——终末地的气质是克制，面板自己不需要加戏。
   这条配方（边框 + --dtpl-panel-bg + --dtpl-metal）就是全窗口的**面板**，五个 tab 共用；
   任何一块面要长得不一样，都得有理由。 */
[data-plugin="dsh-tokbook"] .dtpl-hero{
  position:relative;
  display:flex;flex-direction:column;gap:12px;
  padding:16px;margin:0 0 20px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
  overflow:hidden;
}
/* 四角括号：只画左上与右下两端，其余两角留空——「方框的四角都补全」会读成相框。
   括号画在 ::before/::after 上，所以控件与焦点环都不受影响。hero 因此读成一台
   被框住的仪表，而不是一张卡片。 */
[data-plugin="dsh-tokbook"] .dtpl-hero::before,
[data-plugin="dsh-tokbook"] .dtpl-hero::after{
  content:"";position:absolute;width:14px;height:14px;pointer-events:none;z-index:2;
  border-color:color-mix(in srgb,var(--dtpl-fg) 55%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-hero::before{top:0;left:0;border-top:2px solid;border-left:2px solid;}
[data-plugin="dsh-tokbook"] .dtpl-hero::after{right:0;bottom:0;border-right:2px solid;border-bottom:2px solid;}

/* 底边刻度轨。hero 是一块仪表，这条轨就是它的量尺——**带状元素天生适合带状空地**，
   所以它贯通全宽、不占信息位、也不存在「孤零零」的问题。
   三层刻度 + 一条基线：细 8px / 主 40px / 长主 200px，分别 3px、6px、9px 高。
   全部走墨色，**不掺品牌黄**：黄是「料」不是「线」，1px 的黄在白底上只有 1.57:1，
   做刻度线会直接消失；黄在这一屏只留给口径词那枚徽记。
   它整条落在 hero 的**下内边距**里（那 16px 的下留白就是给它留的），所以最高的那层刻度
   也不会碰到「累计」那一行的字——实测轨顶 = hero 高 − 4 − 9，而内容底边在下内边距之上。
   向左淡出，免得刻度在左端硬生生截断。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-rail{
  position:absolute;left:16px;right:16px;bottom:4px;height:9px;pointer-events:none;
  background-image:
    repeating-linear-gradient(to right, color-mix(in srgb,var(--dtpl-fg) 28%,transparent) 0 1px, transparent 1px 8px),
    repeating-linear-gradient(to right, color-mix(in srgb,var(--dtpl-fg) 50%,transparent) 0 1px, transparent 1px 40px),
    repeating-linear-gradient(to right, color-mix(in srgb,var(--dtpl-fg) 72%,transparent) 0 1px, transparent 1px 200px),
    linear-gradient(to top, color-mix(in srgb,var(--dtpl-fg) 28%,transparent) 0 1px, transparent 1px);
  background-size:8px 3px, 40px 6px, 200px 9px, 100% 1px;
  background-position:left bottom, left bottom, left bottom, left bottom;
  background-repeat:repeat-x;
  -webkit-mask-image:linear-gradient(to left, transparent 0, #000 16%);
  mask-image:linear-gradient(to left, transparent 0, #000 16%);
}

[data-plugin="dsh-tokbook"] .dtpl-hero-top{
  position:relative;z-index:1;
  display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-lead{display:flex;flex-direction:column;gap:7px;min-width:0;}
/* 口径词：普通无衬线，靠字号与字距区分层级，不靠字体换家族。
   前面那枚黄牌是**工业徽记**——窗口里每个节标题都带着它，只有 hero 的口径词原先没有，
   这是补上那处不一致（不是给 hero 新增装饰）。黄牌 + 墨边，与 .dtpl-sec-title::before 同一手法。 */
[data-plugin="dsh-tokbook"] .dtpl-total-k{
  display:inline-flex;align-items:center;gap:8px;
  font-size:12px;line-height:18px;font-weight:500;letter-spacing:.06em;
  color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-total-k::before{
  content:"";flex:none;width:7px;height:13px;
  background:var(--dtpl-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
/* 主角数字走等宽体——这是工程语境，不是字体装饰：等宽在这里还有一层实利，
   位数变化时整块不抖。 */
[data-plugin="dsh-tokbook"] .dtpl-total-num{
  font-family:var(--dtpl-mono);
  font-size:36px;line-height:42px;font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;letter-spacing:-.02em;
}
/* 参照行与主角数字同行、紧贴其后——它是这张面板存在的理由（今天算不算多）。
   涨跌仍刻意中性：方向只由 ↑/↓ 字形与字重表达，品牌黄留给身份，语义色留给告警。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-figure{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-hero-delta{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-3);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-delta b{
  font-family:var(--dtpl-mono);
  font-size:13px;line-height:18px;font-weight:600;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
/* 今日金额：标签左、金额右的双行块，两行共用 max-content 宽度，所以两端各自成列。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-money{display:flex;flex-direction:column;gap:4px;flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-hero-money-row{
  display:flex;align-items:baseline;gap:16px;justify-content:space-between;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-money-k{font-size:11px;line-height:17px;color:var(--dtpl-fg-3);white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-hero-money-v{
  font-family:var(--dtpl-mono);
  font-size:12px;line-height:17px;font-weight:500;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 现金与订阅金额不靠颜色分：DSH 皮肤里 --dtpl-accent 本就等于墨色，颜色区分是空操作；
   而这里唯一有色相的 token 是品牌黄，它是身份色、不外借给数据分类。区分由字重 +
   始终在场的「订阅价值」标签承担，换任何皮肤都成立。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-money-v.is-cash{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-hero-money-v.is-zero{color:var(--dtpl-fg-3);font-weight:400;}
/* 累计事实带：累计单调递增、永不触发决策，所以它只证明「账本在记账」——一条次要行读完。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-foot{
  position:relative;z-index:1;
  display:flex;align-items:baseline;gap:10px;
  padding-top:11px;border-top:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-hero-foot-k{
  flex:none;font-size:12px;line-height:18px;font-weight:600;letter-spacing:.06em;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-hero-facts{
  display:flex;flex-wrap:wrap;align-items:baseline;min-width:0;
  font-size:11px;line-height:18px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;
}
/* 每项整体换行（数字不与自己的标签拆开），分隔点因此永不出现在行首。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-fact{white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-hero-facts b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-hero-facts i{font-style:normal;color:var(--dtpl-fg-dim);padding:0 5px;}
/* 今日出过的事：与下面的累计事实带同处 hero，但口径是「今天」，所以自带分区词，
   且只在有事时占行。数字走 warn-ink 而不是裸 warn——DSH 的浅色 warn 是 #F59E0B，11px
   正文上只有 2.15:1，混一档墨之后才够 4.5:1（实测见 DESIGN）。这里确实在报告需要处理的
   事，与参照行的涨跌（中性、不染色）不同。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-alert{
  position:relative;z-index:1;
  display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
  margin:0;
  font-size:11px;line-height:17px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-hero-alert-k{
  flex:none;font-weight:600;letter-spacing:.06em;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-hero-alert b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-warn-ink);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-alert i{font-style:normal;color:var(--dtpl-fg-dim);}
/* 模型/通道/工作区行里的订阅金额：刻意区别于消费，订阅通道的数字永远不像现金。 */
[data-plugin="dsh-tokbook"] .dtpl-sub-amt{
  font-family:var(--dtpl-mono);color:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-sub-k{font-style:normal;font-size:10px;line-height:14px;color:var(--dtpl-fg-3);margin-left:3px;}

/* 词元构成：一只带分隔的方框——工程读数正是「框 + 竖分隔」。与 hero 同一块面板配方。 */
[data-plugin="dsh-tokbook"] .dtpl-grid{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;
  margin:0 0 8px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
}
/* 三个桶刚好填满一行，不留参差的半格。 */
[data-plugin="dsh-tokbook"] .dtpl-grid-3{grid-template-columns:repeat(3,minmax(0,1fr));}
[data-plugin="dsh-tokbook"] .dtpl-stat{
  display:flex;flex-direction:column;gap:3px;min-width:0;
  padding:12px 14px 13px;
}
[data-plugin="dsh-tokbook"] .dtpl-stat + .dtpl-stat{border-left:1px solid var(--dtpl-border);}
[data-plugin="dsh-tokbook"] .dtpl-k{
  font-size:12px;line-height:18px;font-weight:500;letter-spacing:.05em;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-stat .dtpl-v{
  margin-top:3px;
  font-family:var(--dtpl-mono);
  font-size:20px;line-height:26px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums;
}

/* 节标题 = 工业徽记 + 分区词。徽记是**反复出现**的那枚标记（终末地把「终末地工业」的
   Logo 及衍生图形铺在每个系统面板的头部，这里用同一手法）。它是黄牌 + 墨边——见 tokens
   里「黄是料不是线」那条。右端旁注靠 space-between 推到边上，不画延伸线。 */
[data-plugin="dsh-tokbook"] .dtpl-sec-title{
  display:flex;align-items:baseline;gap:9px;
  font-size:13px;line-height:20px;font-weight:600;letter-spacing:.04em;color:var(--dtpl-fg);
  margin:0 0 11px;
}
[data-plugin="dsh-tokbook"] .dtpl-sec-title::before{
  content:"";flex:none;align-self:center;
  width:7px;height:13px;
  background:var(--dtpl-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-sec-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;}
[data-plugin="dsh-tokbook"] .dtpl-sec-head .dtpl-sec-title{margin:0 0 11px;}
[data-plugin="dsh-tokbook"] .dtpl-sec-aside{
  flex:none;margin-bottom:11px;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}

/* 日趋势 */
[data-plugin="dsh-tokbook"] .dtpl-trend{margin-bottom:20px;}
/* 图不是一块面板：柱直接站在卡面上，脚下只有一条基线。 */
[data-plugin="dsh-tokbook"] .dtpl-bars{
  position:relative;
  display:flex;align-items:flex-end;gap:3px;height:92px;
  padding:24px 4px 0;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-bar{position:relative;flex:1 1 0;min-width:0;height:100%;display:flex;align-items:flex-end;}
/* 非峰值柱：中性灰。灰取墨色 45%——柱高是这张图的正文，30% 在白底上只有 1.99:1，
   过不了 3:1 非文本对比度。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-fill{
  width:100%;
  background-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
  transition:background-color .15s ease;
}
/* 峰值：黄牌 + 墨边。**墨边同时解决两件事**——恒定黄对白底只有 1.57:1，边界由墨边给到
   18:1；而且峰值因此是「形」上的不同（带框的块 vs 无框的块），不再是只靠颜色区分。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-fill.is-peak{
  background-color:var(--dtpl-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-bar:hover .dtpl-bar-fill{background-color:color-mix(in srgb,var(--dtpl-fg) 62%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-bar:hover .dtpl-bar-fill.is-peak{background-color:var(--dtpl-brand);}
/* 每根柱自带数值：不用悬停也能读图。偏移量写成 inline——重复填充高度的表达式，让数字贴在自己的柱顶。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-label{
  position:absolute;left:50%;transform:translateX(-50%);
  font-family:var(--dtpl-mono);
  font-size:10px;line-height:14px;color:var(--dtpl-fg-3);font-variant-numeric:tabular-nums;
  white-space:nowrap;pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-peak{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-zero{color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-start{left:0;transform:none;}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-end{left:auto;right:0;transform:none;}
[data-plugin="dsh-tokbook"] .dtpl-trend-axis{
  display:flex;gap:3px;margin-top:6px;padding:0 4px;
  font-family:var(--dtpl-mono);
  font-size:10px;line-height:16px;color:var(--dtpl-fg-3);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-trend-axis span{flex:1 1 0;min-width:0;text-align:center;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-trend-sum{
  margin:6px 0 0;font-size:11px;line-height:17px;color:var(--dtpl-fg-3);
}

/* 明细（按模型 / 按工作区）：这一节此前只有两个 tab 标签，而它们说的是**切法**、不是这一节
   是什么——所以它成了全窗口唯一没有分区词与工业徽记的一节。现在头部与其余两节同一套：
   黄牌 + 分区词，右端旁注；两个子 tab 挂在这一行上，用「横排 + 竖分隔 + 底部实条」那套
   （实条取墨色——品牌黄这一屏只留给当前页、峰值、徽记三处）。 */
[data-plugin="dsh-tokbook"] .dtpl-bd{margin-bottom:20px;}
[data-plugin="dsh-tokbook"] .dtpl-bd-head{
  display:flex;align-items:center;gap:16px;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-title{margin:0;}
[data-plugin="dsh-tokbook"] .dtpl-bd-tabs{display:inline-flex;gap:0;align-self:stretch;align-items:flex-end;}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab{
  position:relative;appearance:none;border:0;background:transparent;
  padding:3px 14px 8px;
  font:inherit;font-size:12px;line-height:18px;font-weight:500;
  color:var(--dtpl-fg-3);white-space:nowrap;cursor:pointer;
  transition:color .15s ease,background .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab + .dtpl-bd-tab{border-left:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab[aria-selected="true"]{
  color:var(--dtpl-fg);font-weight:600;
  background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab[aria-selected="true"]::after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-head .dtpl-sec-aside{margin:0 0 0 auto;}

/* 列头 + 行共用同一条网格。这是这一节从「一叠两列段落」变成**读数表**的关键：
   两列的宽度由网格定死，于是
     ① 占比条每一行都一样宽 —— 它横跨整条网格（『grid-column:1/-1』，见下），长度由**区块**
        决定、与哪一行无关；此前轨道宽 = 区块宽 − 该行金额文字宽，实测在 511–577px 之间
        摆动，802.4M 那行的条比 813.4M 那行还长；
     ② 金额列每一行都结束在同一条竖线上 —— 此前「订阅价值」是数字后面的行内后缀，
        有订阅的行把数字推左，整列读不成一列。
   列头也照数据的**两行**写，行高与行内两行一致，标签因此落在对应数值正上方。
   右列宽 --dtpl-row-nums-w 定义在 tokens 片段：『.dtpl-row』是**跨 tab 共用**的行组件
   （通道用量也走它），度量挂在插件根上，否则另一个 tab 取不到变量、整条声明静默失效。 */
[data-plugin="dsh-tokbook"] .dtpl-bd-cols,
[data-plugin="dsh-tokbook"] .dtpl-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) var(--dtpl-row-nums-w);
  column-gap:16px;
}
/* 列头：**一行**。两列各是一串上下叠起来的事实，所以列名写成「甲 · 乙」，与旁注、工作区
   事实行用的是同一个分隔符。早先照数据的两行写成两行（模型 / 通道 各占一行），标签能精确
   落在各自数值正上方，但四枚孤零零的标签占两行、中间大片空白——表头比它标注的数据还高；
   一行牺牲精确对位，换回它像一行表头。 */
[data-plugin="dsh-tokbook"] .dtpl-bd-cols{
  padding:8px 0 6px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-col-id,
[data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{text-align:right;}

/* 行之间不再另画一条分隔线：**轨道本身就是那条线**。此前每行尾部有两条横线
   （墨色 16% 的轨道 + 6% 的发丝线），重量差 2.7 倍，读起来像「文字下划线 + 表格线」；
   现在只剩轨道一条，而它承载分母——一行一条线，且这条线有意义。 */
[data-plugin="dsh-tokbook"] .dtpl-models{display:flex;flex-direction:column;}
[data-plugin="dsh-tokbook"] .dtpl-row{align-items:start;padding:0;}
[data-plugin="dsh-tokbook"] .dtpl-row + .dtpl-row{margin-top:16px;}
[data-plugin="dsh-tokbook"] .dtpl-model{display:flex;flex-direction:column;gap:5px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-model-name{
  color:var(--dtpl-fg);font-size:13px;line-height:20px;font-weight:500;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-model-provider{
  font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-size:10px;line-height:16px;letter-spacing:.04em;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 占比是 3px 的度量线：轨道 + 平色填充。轨道必须留着——去掉它以后占比 0.1%–1% 的行
   只剩 1–5px 的实色碎点，读起来像渲染故障；它是「占谁的多少」这句话里的分母。
   它横跨整条网格（grid-column:1/-1），所以轨道长度由**区块**决定、与哪一行无关。 */
[data-plugin="dsh-tokbook"] .dtpl-model-bar{
  grid-column:1 / -1;
  display:block;width:100%;height:3px;margin-top:9px;
  background:color-mix(in srgb,var(--dtpl-fg) 16%,transparent);overflow:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-model-bar-fill{
  display:block;height:100%;
  background:var(--dtpl-fg-2);
  transition:width .4s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-model-nums{display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-val{
  font-family:var(--dtpl-mono);color:var(--dtpl-fg);font-size:13px;line-height:20px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 金额格 = 「数值」+ 一枚「订阅价值」槽位。**只限不可预测的那一半**：
   值（数额）是会被裁的那一个，所以它限宽 + 省略号 + title 兜底；
   标签是**固定的一小段字**（永远是「订阅价值」），所以给它 nowrap 与一个 min-width，
   宽度在每一行里因此都是同一个 max-content —— 数字右边缘照样对齐，而标签既不会换行、
   也不会被裁。上一版给标签硬写 width:44px（等于「限一个可预测的值」），换个字体宽一点
   就会被裁或折行。现金行不写死空元素，而是照常渲染同一段字、用 .is-blank 藏起来：
   这样它的占位与订阅行**一模一样**。 */
[data-plugin="dsh-tokbook"] .dtpl-cost{
  display:flex;align-items:baseline;justify-content:flex-end;gap:5px;
  max-width:100%;
  font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-size:12px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-cost-main{min-width:0;overflow:hidden;text-overflow:ellipsis;}
[data-plugin="dsh-tokbook"] .dtpl-sub-k{
  flex:none;min-width:44px;margin-left:0;text-align:left;line-height:16px;white-space:nowrap;
}
/* 藏在视觉里、留在无障碍树外（visibility 会一并移出 AT）：换行与裁切都不可能发生。 */
[data-plugin="dsh-tokbook"] .dtpl-sub-k.is-blank{visibility:hidden;}


/* 工作区 */
/* 身份行：目录，然后是让「最近优先」可读的两个事实。目录在挤压时让步；事实永不裁。 */
[data-plugin="dsh-tokbook"] .dtpl-ws-meta{
  display:flex;align-items:baseline;gap:6px;min-width:0;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-ws-path{
  font-family:var(--dtpl-mono);font-size:10px;
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-ws-sep{flex:none;color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-ws-facts{
  flex:none;font-variant-numeric:tabular-nums;white-space:nowrap;
}

/* 注释：装着口径的去处（价格未知 = 不是免费、没上报用量 = 不是 0），是要读的正文。 */
[data-plugin="dsh-tokbook"] .dtpl-note{font-size:11px;line-height:17px;color:var(--dtpl-fg-2);margin:0 0 8px;}
/* 四桶底下那条加法律与词表：它是那一节的收尾，所以拿走那一节剩下的下边距。 */
[data-plugin="dsh-tokbook"] .dtpl-buckets-note{margin:0 0 20px;}

/* 窗口底部（新鲜度 · 重扫） */
/* 分区靠实线，不靠底色。 */
[data-plugin="dsh-tokbook"] .dtpl-foot{
  flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:11px 20px 14px;
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-foot-state{
  display:inline-flex;align-items:baseline;gap:8px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-sync{
  display:inline-flex;align-items:center;gap:6px;min-width:0;
  font-size:12px;line-height:18px;color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-sync-dot{
  flex:none;width:6px;height:6px;border-radius:50%;corner-shape:round;
  background:currentColor;
}
/* 只有「正在扫 / 上次失败」两种状态会渲染，所以这里不定义正常态的颜色：
   正常态的答案由「最新记录 <时刻>」给出，内部状态机不占字。 */
[data-plugin="dsh-tokbook"] .dtpl-sync-error{color:var(--dtpl-err);}
/* 「同步中」不借品牌黄也不借 warn：黄是身份色、warn 在浅色下不够正文对比度。
   动静由那颗脉冲的点表达，颜色留在中性。 */
[data-plugin="dsh-tokbook"] .dtpl-sync-running{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot{animation:dtpl-pulse 1.2s ease-in-out infinite;}
[data-plugin="dsh-tokbook"] .dtpl-foot-latest{
  font-family:var(--dtpl-mono);
  font-size:11px;line-height:18px;letter-spacing:.04em;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 重扫是偶尔用的维护动作，不是这一屏的主行动：描边式方按钮，不是实心 CTA。 */
[data-plugin="dsh-tokbook"] .dtpl-rescan{
  display:inline-flex;align-items:center;gap:6px;flex:none;
  height:30px;padding:0 12px;
  border:1px solid var(--dtpl-border);background:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:12px;line-height:18px;font-weight:500;cursor:pointer;
  transition:background .15s ease,border-color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-rescan:hover:not(:disabled){
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
  border-color:color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-rescan:disabled{opacity:.4;cursor:not-allowed;}
[data-plugin="dsh-tokbook"] .dtpl-rescan-ico{width:14px;height:14px;flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-spin{animation:dtpl-rotate 1s linear infinite;}

/* 错误 / 重试 */
[data-plugin="dsh-tokbook"] .dtpl-error{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-bottom:12px;padding:10px 12px;
  border:1px solid color-mix(in srgb,var(--dtpl-err) 45%,transparent);
  background:color-mix(in srgb,var(--dtpl-err) 8%,transparent);
  box-shadow:var(--dtpl-metal);
}
[data-plugin="dsh-tokbook"] .dtpl-error-text{
  margin:0;font-size:12px;line-height:18px;color:var(--dtpl-err);min-width:0;overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-retry{
  flex:none;height:26px;padding:0 12px;
  border:1px solid color-mix(in srgb,var(--dtpl-err) 45%,transparent);
  background:transparent;color:var(--dtpl-err);
  font:inherit;font-size:12px;line-height:18px;cursor:pointer;
  transition:background .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-retry:hover{background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);}

/* 骨架屏（加载中） */
[data-plugin="dsh-tokbook"] .dtpl-skeleton{display:flex;flex-direction:column;gap:16px;}
[data-plugin="dsh-tokbook"] .dtpl-sk{
  background:linear-gradient(100deg,
    color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 40%,
    color-mix(in srgb,var(--dtpl-fg) 10%,transparent) 50%,
    color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 60%);
  background-size:200% 100%;
  animation:dtpl-shimmer 1.4s ease infinite;
}
/* 骨架块高度 = 对应真块的实测高度，首屏因此不会在数据到达时整体下跳。 */
[data-plugin="dsh-tokbook"] .dtpl-sk-hero{height:145px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;}
[data-plugin="dsh-tokbook"] .dtpl-sk-tile{height:78px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-chart{height:130px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-row{height:48px;}

/* 空状态：一只方框，不是虚线占位。 */
[data-plugin="dsh-tokbook"] .dtpl-empty{
  display:flex;flex-direction:column;align-items:center;text-align:center;
  padding:36px 20px;margin:0 0 12px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
}
[data-plugin="dsh-tokbook"] .dtpl-empty-ico{width:24px;height:24px;margin-bottom:12px;color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-empty-title{
  font-size:15px;line-height:22px;font-weight:600;color:var(--dtpl-fg);margin:0 0 6px;
}
[data-plugin="dsh-tokbook"] .dtpl-empty-sub{font-size:12px;line-height:20px;color:var(--dtpl-fg-2);margin:0;max-width:44ch;}
[data-plugin="dsh-tokbook"] .dtpl-empty-sub code{
  font-family:var(--dtpl-mono);font-size:.9em;
  padding:.1em .35em;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg);
}
`
