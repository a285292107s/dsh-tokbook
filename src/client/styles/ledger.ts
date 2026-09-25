export const CSS_LEDGER = `
/* hero = **今日**那一块卡：卡首一条图，其下是被框住的读数仪表（总额 + 参照 + 金额），
   中间一条 1px 分区线，下半是它拆出来的四桶读数格（每桶自带份额——「多少」与「占多少」同处一格）。
   这条配方（1px 硬边框 + --dtpl-panel-bg + --dtpl-metal）就是全窗口的**面板**，五个 tab 共用；
   卡内的读数格因此**不是**第二块面板（见 .dtpl-grid）。 */
[data-plugin="dsh-tokbook"] .dtpl-hero{
  position:relative;
  display:flex;flex-direction:column;gap:12px;
  padding:16px;margin:0 0 20px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
  overflow:hidden;
}
/* 左上那一枚**永远压在卡首那条图上**，故单独取浅墨——墨色在浅色皮肤上落在深色图上就等于没有
   （实测只剩 1px 卡边框）；右下那一枚底下恒为卡面，随 fg 走。两端画法与焦点环那条见 overlay 片段。 */
[data-plugin="dsh-tokbook"] .dtpl-hero::before,
[data-plugin="dsh-tokbook"] .dtpl-hero::after{
  content:"";position:absolute;width:14px;height:14px;pointer-events:none;z-index:2;
  border-color:color-mix(in srgb,var(--dtpl-fg) 55%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-hero::before{
  top:0;left:0;border-top:2px solid;border-left:2px solid;
  border-color:color-mix(in srgb,#fff 62%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-hero::after{right:0;bottom:0;border-right:2px solid;border-bottom:2px solid;}

/* 卡首那条图：hero 的第一行，也是这张卡上唯一的图。
   图**不做任何一层的背景**——独立成行，字才落在干净的卡面上（当背景用会让 36px 的主角数字
   压在图上读不出来）；下缘是一条**直边**，渐隐（mask）在浅色皮肤下会把图的下半糊成灰雾。
   **高度戴一顶帽子（max-height:140px），这个值不是审美数字，是首屏预算算出来的**：这张卡
   存在的理由是「今日读数与近 14 天趋势一屏读完」，改大就会把趋势图挤出可视高度。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-art{
  flex:none;
  /* 左右上三面抵掉 hero 的内边距，图与卡的边框齐平（图因此**是卡的首面**）；下边不留空隙，
     hero 的 flex 间距就是图与下面那行数字之间的距离。 */
  margin:-16px -16px 0;
  aspect-ratio:940/237;
  max-height:140px;
  background-image:var(--dtpl-hero-art);
  background-position:center 40%;
  background-size:cover;
  background-repeat:no-repeat;
}

[data-plugin="dsh-tokbook"] .dtpl-hero-top{
  display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
}
/* 仪表区分两行：口径词一行（身份），主角数字与参照一行（读数），金额块在右端另起一列。
   口径词自成一行是刻意的——别为了省高度把它并进数字那一行。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-lead{display:flex;flex-direction:column;gap:7px;min-width:0;flex:1 1 auto;}
[data-plugin="dsh-tokbook"] .dtpl-hero-head{
  display:flex;align-items:baseline;justify-content:space-between;gap:16px;
}
/* 前面那枚黄牌是节标题那套工业徽记，与 .dtpl-sec-title::before 同一手法。 */
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
/* 主角数字走等宽体：位数变化时整块不抖。 */
[data-plugin="dsh-tokbook"] .dtpl-total-num{
  font-family:var(--dtpl-mono);
  font-size:36px;line-height:42px;font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;letter-spacing:-.02em;
}
/* 参照行与主角数字同行、紧贴其后。
   涨跌刻意中性：方向只由 ↑/↓ 字形与字重表达，品牌黄留给身份，语义色留给告警。
   墨色取 fg-2 而非 fg-3：这一行是**读数**，不是装饰（分档见 tokens 的文字墨阶）。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-figure{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-hero-delta{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-delta b{
  font-family:var(--dtpl-mono);
  font-size:13px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;
}
/* 今日金额：标签左、金额右的双行块，两行共用 max-content 宽度，所以两端各自成列。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-money{display:flex;flex-direction:column;gap:4px;flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-hero-money-row{
  display:flex;align-items:baseline;gap:16px;justify-content:space-between;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-money-k{font-size:11px;line-height:17px;color:var(--dtpl-fg-2);white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-hero-money-v{
  font-family:var(--dtpl-mono);
  font-size:12px;line-height:17px;font-weight:500;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 现金与订阅金额不靠颜色分：DSH 皮肤里 --dtpl-accent 本就等于墨色，颜色区分是空操作；
   而本窗口唯一有色相的 token 是品牌黄，它是身份色、不外借给数据分类。区分由字重 +
   始终在场的「订阅价值」标签承担。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-money-v.is-cash{color:var(--dtpl-fg);font-weight:600;}
/* 零支出仍占住该行，但走 fg-2（不是 fg-3）：它是一枚**读数**。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-money-v.is-zero{color:var(--dtpl-fg-2);font-weight:400;}
/* 「一串事实」的词汇：**跨 tab 共用**——用量明细的窗口合计就是这一串（同一组分隔符、同一档
   字号），所以两个 tab 的口径读起来是一句话。层级靠**字号 + 只在数字上加字重**，文字部分留在
   fg-2。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-facts{
  display:flex;flex-wrap:wrap;align-items:baseline;min-width:0;
  font-size:11px;line-height:18px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
/* 每项整体换行（数字不与自己的标签拆开），分隔点因此永不出现在行首。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-fact{white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-hero-facts b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-hero-facts i{font-style:normal;color:var(--dtpl-fg-dim);padding:0 5px;}
/* 行里的两个金额桶与上面 is-cash 同一口径：字重 + 始终在场的桶名分主次，色相不外借。 */
[data-plugin="dsh-tokbook"] .dtpl-cash-amt{
  font-style:normal;
  font-family:var(--dtpl-mono);color:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-sub-amt{
  font-style:normal;
  font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-weight:400;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-cost-k{font-style:normal;font-size:10px;line-height:14px;color:var(--dtpl-fg-2);margin-left:3px;}

/* 词元构成：**卡内**的一条读数带——工程读数是「框 + 竖分隔」，框由上方的 hero 给，这里只出
   格与格之间的竖发丝（额度页的用量摘要活动条同一配方）。它**不是**第二块面板。
   **上边框就是两个区之间那条分区线**——走注册过的边界 token，与页脚、tab 条、面板轮廓同一种线。 */
[data-plugin="dsh-tokbook"] .dtpl-grid{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-grid-3{grid-template-columns:repeat(3,minmax(0,1fr));}
[data-plugin="dsh-tokbook"] .dtpl-stat{
  display:flex;flex-direction:column;gap:3px;min-width:0;
  padding:10px 14px 11px;
}
[data-plugin="dsh-tokbook"] .dtpl-stat + .dtpl-stat{border-left:1px solid var(--dtpl-border);}
[data-plugin="dsh-tokbook"] .dtpl-k{
  font-size:12px;line-height:18px;font-weight:500;letter-spacing:.05em;color:var(--dtpl-fg-2);
  white-space:nowrap;
}
/* 份额取 fg-2（它是读数），且自己带「占」字——卡上不留裸百分比（一个百分比要么带桶名，
   要么带「占」字）。 */
[data-plugin="dsh-tokbook"] .dtpl-stat .dtpl-v{
  display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
  font-family:var(--dtpl-mono);
  font-size:20px;line-height:26px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-stat-pct{font-size:12px;line-height:18px;color:var(--dtpl-fg-2);}

/* 节标题 = 工业徽记 + 分区词。徽记是**反复出现**的那枚标记，黄牌 + 墨边——见 tokens 第五节。
   右端旁注（.dtpl-sec-aside）由它所在那一行的 space-between 推到边上，不画延伸线。 */
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
[data-plugin="dsh-tokbook"] .dtpl-sec-aside{
  flex:none;margin-bottom:11px;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}

[data-plugin="dsh-tokbook"] .dtpl-trend{margin-bottom:0;}
[data-plugin="dsh-tokbook"] .dtpl-bars{
  position:relative;
  display:flex;align-items:flex-end;gap:3px;height:92px;
  margin-top:24px;
  /* 左右内边距必须 ≥ 半个最宽柱值标签宽，且**轴行（.dtpl-trend-axis）必须写同一个值**——
     否则柱子与日期会错开。 */
  padding:0 14px;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-bar{position:relative;flex:1 1 0;min-width:0;height:100%;display:flex;align-items:flex-end;}
/* 非峰值柱：中性灰取墨色 45%——柱高是这张图的正文，更淡过不了 3:1 非文本对比度。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-fill{
  position:relative;width:100%;overflow:hidden;
  background-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
/* 柱顶 1px 受光边 + 峰值柱内侧的**顶部盖片**：盖片高度与底面都写 %（同一单位），
   所以在任何柱高、柱宽上都按比例成立（2px 柱上被 overflow 裁掉，只剩受光边）。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-fill::before{
  content:"";position:absolute;left:0;right:0;top:0;height:1px;
  background:color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
}
/* 峰值：**更亮的中性块 + 柱值标签前一枚小黄牌**，柱身上不带任何黄
   （满屏唯一的饱和色不进最大的那块面，见 tokens 第五节）。
   70% 是量出来的：再亮则与黄牌明度接近、黄牌读不出来；再暗则与邻柱糊在一起、峰值认不出。
   墨边让峰值边界在两个主题下分别由「深块 + 更深描边」与「清晰墨框」给出。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-fill.is-peak{
  background-color:color-mix(in srgb,var(--dtpl-fg) 70%,transparent);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-bar-fill.is-peak::before{
  top:1px;height:3%;background:var(--dtpl-on-brand);
}
/* 零刻度：挂在 .dtpl-bar 上、贴 bottom:0——柱子的零高度不参与定位。零日**不写「0」**
   （等宽 0 只有 5.5px 宽，读起来是标签而不是测量结果），改由基线上一道 2×3px 硬刻度画。
   刻度**居中于自己那一列**：它量的是这一列。
   取 --dtpl-fg-3（深底上是全图最亮的中性灰）：2px 的块比 1px 线观感弱，再压透明度就会在深色主题里消失。 */
[data-plugin="dsh-tokbook"] .dtpl-bar.is-zero::after{
  content:"";position:absolute;left:calc(50% - 1px);bottom:0;width:2px;height:3px;
  pointer-events:none;background:var(--dtpl-fg-3);
}
/* 每根柱自带数值：不用悬停也能读图。偏移量写成 inline——复用填充高度那个表达式，数字才贴在
   自己的柱顶（见 LedgerView 的 barHeight）。墨色取 fg-2：这是图的正文；峰值仍靠主墨色 + 600
   + 黄牌 + 更亮的柱体区分。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-label{
  position:absolute;left:50%;transform:translateX(-50%);
  font-family:var(--dtpl-mono);
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
  white-space:nowrap;pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-peak{color:var(--dtpl-fg);font-weight:600;}
/* 峰值的黄牌：挂在**数值前面**——标记与它标注的值不走散，且峰值的表达不只靠颜色
   （形状 + 文字 + 明度，三层各自成立）。vertical-align:-1px 让黄牌与等宽数字同基线。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-peak::before{
  content:"";display:inline-block;width:4px;height:8px;vertical-align:-1px;
  margin-right:5px;background:var(--dtpl-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
/* 零日的标签整枚撤掉：量出来的零由基线上那道刻度画（见上 .is-zero::after）。 */
[data-plugin="dsh-tokbook"] .dtpl-bar.is-zero .dtpl-bar-label{display:none;}
[data-plugin="dsh-tokbook"] .dtpl-trend-axis{
  display:flex;gap:3px;margin-top:6px;padding:0 14px;
  font-family:var(--dtpl-mono);
  font-size:10px;line-height:16px;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-trend-axis span{flex:1 1 0;min-width:0;text-align:center;white-space:nowrap;}

/* 明细头部：与其余各节同一套——黄牌 + 分区词，右端旁注；子 tab 挂在这一行上，用「横排 +
   竖分隔 + 底部实条」那套（实条取墨色——「第二层选择器一律墨色」见 provider 片段）。
   分区词是**窗口词**（今天 / 近 7 天 / 全账本累计）：这一页陈述的就是某个窗口的用量，
   窗口自己就是它该有的名字；切法只是它的三种切法。 */
[data-plugin="dsh-tokbook"] .dtpl-bd-head{
  display:flex;align-items:center;gap:16px;flex-wrap:wrap;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-tabs{display:inline-flex;gap:0;align-self:stretch;align-items:flex-end;}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab{
  position:relative;appearance:none;border:0;background:transparent;
  padding:3px 14px 8px;
  font:inherit;font-size:12px;line-height:18px;font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
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

/* 列头 + 行共用同一条网格——两列宽度由网格定死，这一节才是**读数表**而不是一叠段落：
     ① 占比条横跨整条网格（grid-column:1/-1），长度由**区块**决定、与哪一行无关；
     ② 金额列每一行都结束在同一条竖线上。
   右列宽 --dtpl-row-nums-w 的定义、挂根的理由与 minmax 取下限的推导都在 tokens 片段。 */
[data-plugin="dsh-tokbook"] .dtpl-bd-cols,
[data-plugin="dsh-tokbook"] .dtpl-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(min-content,var(--dtpl-row-nums-w));
  column-gap:16px;
}
/* 列头：**一行**。两列各是一串上下叠起来的事实，所以列名写成「甲 · 乙」——与旁注、工作区
   事实行用的是同一个分隔符。精确对位让给「它像一行表头」（两行标签比它标注的数据还高）。 */
[data-plugin="dsh-tokbook"] .dtpl-bd-cols{
  padding:8px 0 6px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-col-id,
[data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{text-align:right;}

/* 行之间不另画分隔线：**轨道本身就是那条线**（一行一条，且它承载分母）。 */
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
/* 占比是 3px 的度量线：轨道 + 平色填充。轨道必须留着——去掉它以后占比 0.1%–1% 的行只剩
   1–5px 的实色碎点，读起来像渲染故障；它是「占谁的多少」这句话里的分母。 */
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
/* 金额格 = 一段或两段「数额 + 桶名」。**只限不可预测的那一半**：值（数额）会被裁，所以它
   限宽 + 省略号 + title 兜底；桶名是固定的一小段字（「实际支出」/「订阅价值」，都是四个汉字），
   给它 nowrap 与 min-width，宽度在每一段里因此都是同一个 max-content——各段数额的右边缘照样
   对齐，标签不换行也不被裁（限一个可预测的宽度会因字体度量被裁或折行）。
   一个工作区跨通道、两个桶同时非零时，是**两段**并排（各带自己的桶名），不是一段里塞两个
   没名字的数。 */
[data-plugin="dsh-tokbook"] .dtpl-cost{
  display:flex;align-items:baseline;justify-content:flex-end;gap:0;
  max-width:100%;
  font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-size:12px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-cost-seg{
  display:flex;align-items:baseline;gap:5px;min-width:0;
}
/* 段之间用这个窗口表示「一串事实」的那个『·』，间距走它自己的 padding 而不是容器的 gap。 */
[data-plugin="dsh-tokbook"] .dtpl-cost-sep{flex:none;padding:0 6px;color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-cost-main{min-width:0;overflow:hidden;text-overflow:ellipsis;}
[data-plugin="dsh-tokbook"] .dtpl-cost-k{
  flex:none;min-width:44px;margin-left:0;text-align:left;line-height:16px;white-space:nowrap;
}


/* 身份行：目录，然后是让「最近优先」可读的两个事实。目录在挤压时让步；事实永不裁。
   走 fg-2 而不是 fg-3：它与「按模型」行的通道行是同一档信息（行的次要身份），不是装饰。 */
[data-plugin="dsh-tokbook"] .dtpl-ws-meta{
  display:flex;align-items:baseline;gap:6px;min-width:0;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-ws-path{
  font-family:var(--dtpl-mono);font-size:10px;
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-ws-sep{flex:none;color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-ws-facts{
  flex:none;font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 失败数染色：它旁边的请求数是读数，失败是**要看一眼**的状态。走 warn-ink 而不是裸 warn。 */
[data-plugin="dsh-tokbook"] .dtpl-ws-fail{
  font-weight:600;color:var(--dtpl-warn-ink);font-variant-numeric:tabular-nums;
}
/* 「未归属」是对账行、不是项目：它不参与「最近有操作在前」，所以用一条实线把它从
   上面的工作区清单里分出来、标题降一档；行内其余排版不动，它照样有词元、金额与占比条。 */
[data-plugin="dsh-tokbook"] .dtpl-row.is-unattributed{
  margin-top:22px;padding-top:14px;
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-row.is-unattributed .dtpl-model-name{
  color:var(--dtpl-fg-2);font-weight:400;
}

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
/* 只有「正在扫 / 上次失败」两种状态会渲染，所以不定义正常态的颜色：正常态的答案由
   「最新记录 <时刻>」给出，内部状态机不占字。 */
[data-plugin="dsh-tokbook"] .dtpl-sync-error{color:var(--dtpl-err);}
/* 「同步中」不借品牌黄也不借 warn：黄是身份色、warn 在浅色下不够正文对比度。
   动静由那颗脉冲的点表达，颜色留在中性。 */
[data-plugin="dsh-tokbook"] .dtpl-sync-running{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot{animation:dtpl-pulse 1.2s ease-in-out infinite;}
[data-plugin="dsh-tokbook"] .dtpl-foot-latest{
  font-family:var(--dtpl-mono);
  font-size:11px;line-height:18px;letter-spacing:.04em;color:var(--dtpl-fg-2);
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

[data-plugin="dsh-tokbook"] .dtpl-skeleton{display:flex;flex-direction:column;gap:16px;}
[data-plugin="dsh-tokbook"] .dtpl-sk{
  background:linear-gradient(100deg,
    color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 40%,
    color-mix(in srgb,var(--dtpl-fg) 10%,transparent) 50%,
    color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 60%);
  background-size:200% 100%;
  animation:dtpl-shimmer 1.4s ease infinite;
}
/* 骨架块高度 = 对应真块的高度，首屏因此不会在数据到达时整体下跳：真块里 hero 与读数格
   同为一张卡，所以 sk-hero + tile 要等于整卡高，chart 对上「近 14 天趋势」那一节。
   **改真块的高度或内边距时必须同步改这里**——这几个数是一组，不各自独立。 */
[data-plugin="dsh-tokbook"] .dtpl-sk-hero{height:250px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;}
[data-plugin="dsh-tokbook"] .dtpl-sk-tile{height:68px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-chart{height:159px;}
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
