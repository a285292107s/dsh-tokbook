/** styles.ts 片段：ledger。由 `injectStyles` 按序拼接。 */
export const CSS_LEDGER = `/* 用量总览 · 明日方舟：终末地 风格 */
/* 三条线：直角与硬边（工程感）、黄只作"料"、构件而非贴图。字体保持保守，不做字体文章。
   末尾那一节（列头 + 一行读数）是**跨 tab 的行组件**词汇：用量明细 tab 的三种切法共用它。 */

/* hero = **今日**那一块卡：卡首一条图，其下是被框住的读数仪表（总额 + 参照 + 金额），
   中间一条 1px 分区线，下半是它拆出来的四桶读数格（每桶自带份额——「多少」与「占多少」同处一格）。
   1px 硬边框 + 受光边的金属反光，四角补左上/右下两枚括号，没有别的装饰——终末地的气质是
   克制，面板自己不需要加戏。这条配方（边框 + --dtpl-panel-bg + --dtpl-metal）就是全窗口的
   **面板**，五个 tab 共用；任何一块面要长得不一样，都得有理由。
   卡内的读数格因此**不是**第二块面板（见 .dtpl-grid）：一个陈述只需要一只框。
   卡的下沿曾有一条刻度轨（D-034 撤）、每格下方曾有一条 2px 占比尺（D-037 撤）——两样都是
   「已经有一个数印在它上面」的重复编码，撤掉不欠任何信息。 */
[data-plugin="dsh-tokbook"] .dtpl-hero{
  position:relative;
  display:flex;flex-direction:column;gap:12px;
  /* 四边等距：底边原先厚出 10px，是给刻度轨让位的（轨落在下内边距里）。轨撤掉之后
     那道留白就只是失衡的留白，所以收到 16px——腾出来的高度回给读数格。 */
  padding:16px;margin:0 0 20px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
  overflow:hidden;
}
/* 底图 = **卡首独立的一条**（见下方 .dtpl-hero-art 规则）：它占满卡的内容宽、按图片自己的
   比例定高，排在仪表区之前。图不碰读数格（四桶）那一行——那里四个数字、四份份额都要读。 */

/* 四角括号：只画左上与右下两端，其余两角留空——「方框的四角都补全」会读成相框。
   括号画在 ::before/::after 上，所以控件与焦点环都不受影响。hero 因此读成一台
   被框住的仪表，而不是一张卡片。
   左下与右上留空的另一个缘由现在更实在：左上那一枚**永远压在卡首那条图上**。墨色取 fg 的
   55% 在深色皮肤上是浅墨、压得住图，但在浅色皮肤上它是深墨——深墨落在深色图上就等于没有，
   两枚括号只剩一枚（实测角上只剩 1px 卡边框）。所以左上这一枚单独取浅墨：它底下恒为图，
   与皮肤无关；右下那一枚底下恒为卡面，照旧随 fg 走。 */
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

/* 底边刻度轨（.dtpl-hero-rail）已撤：它是纯装饰（三层 repeating-linear-gradient + 一条基线），
   没有量程、不承载任何读数，却占掉卡最底一条信息位与 10px 的下内边距。仪表感的身份由 1px 硬边框
   与左上/右下两枚角括号承担，这两样已经够；空出来的高度回给读数格。
   原来那句「向左淡出与右下角括号合成一条边」的理由随之作废——它论证的是一条装饰线该如何自洽，
   而这条线本身不值得占位。 */

/* 卡首那条图：hero 的第一行，也是这张卡上唯一的图。
   图**不做任何一层的背景**，就是独立的一行：占满卡的内容宽，随后才是数字与金额。
   前一版把图当仪表区的背景，那个做法必然要求字与图共处同一块地方——实测在那一层的高度上，
   36px 的主角数字会压在人物的白发上，浅色皮肤里「今日词元」与 169K 直接读不出来；
   把图退到几乎看不见才勉强能读，那时图也没剩多少。独立成行之后两件事各自完整：图完整，
   字落在干净的卡面上。图不留内衬——它与卡的边框齐平，左右上三面都抵到卡的边。
   下缘是一条**直边**：试过给最后两成做渐隐（mask 落到卡面），浅色皮肤下那条淡出带把图的下半
   糊成一片灰雾，人物也散掉了——一张取景完整的插画，边界就该是清楚的。
   **高度戴一顶帽子（max-height:140px）。** 比例仍由资产给（940×237），所以窄处图带自然高度
   不到 140px 时照旧是整幅取景、两边都不裁（@420 的 95px 正在此列）；宽处自然高度 168px，帽子
   削掉 28px——上下各切掉一点空边，人物与构图仍是整幅。
   **帽子的值不是一个审美数字，是首屏预算算出来的：** 这张卡存在的理由是「今日词元（口径词
   自成一行 + 读数一行）与近 14 天趋势一屏读完」，而读数窗可视高度只有 539px（卡 680 − 标题 −
   tab − 页脚）。把这份预算逐项摆开——页内上下余白 38 + 图带 140 + 两处 12px 间距 24 + 仪表区
   两行 67 + 读数格 69 + hero 自己的下内边距与上下边框 18 + hero 的下外边距 20 + 趋势 159 =
   **535 ≤ 539**。168px 的图带让这个和溢出 24px，被裁掉的正是趋势图；再矮就是白压（装饰没有被
   要求最小化，被要求的是**两件都完整**）。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-art{
  flex:none;
  /* 左右上三面抵掉 hero 的内边距：图与卡的边框齐平（卡自己 overflow:hidden，
     不必再为圆角做处理）。图因此**是卡的首面**，而不是卡里的一张插图；
     下边不另外加空隙，hero 的 flex 间距（12px）就是图与下面那行数字之间的距离。 */
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
   曾把口径词并进数字那一行（省 25px），装得下，单行也确实更紧凑——但它省下的是这一屏里
   **最便宜**的那 25px，代价是「这个数是谁」不再自成一行。首屏预算付得起，于是还给版式
   （见 .dtpl-hero-art 那段：帽子的值就是为了让这两样都成立）。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-lead{display:flex;flex-direction:column;gap:7px;min-width:0;flex:1 1 auto;}
/* 口径词那一行只有身份：派生读数不挂在这里。曾经挂过缓存命中率，它后来移到读数格、
   又自 D-037 起整条不再显示——一个比值挂在口径词上，读者还得回头找它的分母。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-head{
  display:flex;align-items:baseline;justify-content:space-between;gap:16px;
}
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
   涨跌仍刻意中性：方向只由 ↑/↓ 字形与字重表达，品牌黄留给身份，语义色留给告警。
   墨色取 fg-2 而不是三级色：这一行是**读数**（口径词 + 数字），而浅色皮肤的三级色对卡面只有
   3.47:1，11px 正文过不了 4.5:1。数字因此升到主墨色——参照的层级靠字号与字重，不靠洗淡。 */
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
   而这里唯一有色相的 token 是品牌黄，它是身份色、不外借给数据分类。区分由字重 +
   始终在场的「订阅价值」标签承担，换任何皮肤都成立。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-money-v.is-cash{color:var(--dtpl-fg);font-weight:600;}
/* 零支出仍占住该行，但走 fg-2（不是三级色）：它是一枚**读数**，12px 正文不能只有 3.47:1；
   「金额为 0」这件事由墨色与字重降一档表达，不靠洗淡。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-money-v.is-zero{color:var(--dtpl-fg-2);font-weight:400;}
/* 「一串事实」的词汇：**跨 tab 共用**——用量明细的窗口合计就是这一串（同一组分隔符、同一档
   字号），所以两个 tab 的口径读起来是一句话。层级靠**字号 + 只在数字上加字重**：文字部分留在
   fg-2（11px 正文要 4.5:1，三级色不够），数字升到主墨色。安静由字号、字距与留白做，
   不靠把字洗淡到读不清。 */
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
/* 行里的两个金额桶按**同一套口径**分主次：现金升到主墨色 + 600，订阅价值留在次要色 + 400
   （并永远带着「订阅价值」这个名字）。此前这里反了——订阅金额拿的是主墨色 600，而现金金额
   是 dtpl-cost 的次要色裸字，于是同一扇窗里 hero 说「现金最重要」、行里却把没花的钱写成
   最响的那个数（DESIGN §4：现金升一档、订阅留在次要色）。桶名与数字的区分由字重 + 名字承担，
   色相不外借（这里唯一有色相的 token 是品牌黄）。 */
[data-plugin="dsh-tokbook"] .dtpl-cash-amt{
  font-style:normal;
  font-family:var(--dtpl-mono);color:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-sub-amt{
  font-style:normal;
  font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-weight:400;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-cost-k{font-style:normal;font-size:10px;line-height:14px;color:var(--dtpl-fg-2);margin-left:3px;}

/* 词元构成：**卡内**的一条读数带——工程读数正是「框 + 竖分隔」，框由上方的 hero 给，
   这里只出格与格之间的竖发丝（额度页的用量摘要活动条同一配方）。
   它不再是一只独立的面板：一个陈述（今日词元）配一只框。
   **上边框就是两个区之间那条分区线**——1px、等宽、两端一致，走注册过的边界 token，
   与页脚、tab 条、面板轮廓是同一种线。分区线不借图形：那是数据的东西。 */
[data-plugin="dsh-tokbook"] .dtpl-grid{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;
  border-top:1px solid var(--dtpl-border);
}
/* 三个桶刚好填满一行，不留参差的半格。 */
[data-plugin="dsh-tokbook"] .dtpl-grid-3{grid-template-columns:repeat(3,minmax(0,1fr));}
/* 四桶那一排：内边距收到 10/11（原先 12/13），标签与值之间的间隔只由父级那 3px gap 给
   （.dtpl-v 原先另加 3px margin-top，等于同一处间隔付了两遍）。读数格因此 76 → 69px
   （每格 75 → 68px）；读数本身一个没动——这一档压的是空白，不是字号。 */
[data-plugin="dsh-tokbook"] .dtpl-stat{
  display:flex;flex-direction:column;gap:3px;min-width:0;
  padding:10px 14px 11px;
}
[data-plugin="dsh-tokbook"] .dtpl-stat + .dtpl-stat{border-left:1px solid var(--dtpl-border);}
/* 标签行：一格的名字。它曾与右端的**派生读数**（缓存读取那一格的命中率）两端分开，
   自 D-037 起那一枚不再显示，这一行回到只有名字。 */
[data-plugin="dsh-tokbook"] .dtpl-k{
  font-size:12px;line-height:18px;font-weight:500;letter-spacing:.05em;color:var(--dtpl-fg-2);
  white-space:nowrap;
}
/* 一格里的两件东西同行：值（20px 主角）与份额（12px 次级）。
   对齐走 baseline——20px 与 12px 的等宽数字因此坐在同一条基线上，而不是被行高推得参差。
   份额取 fg-2 而非三级色：它是**读数**（12px 正文），浅色皮肤的三级色对卡面只有 3.47:1，
   过不了 4.5:1；值的层级靠字号与字重给，不靠把份额洗淡。
   份额自己带「占」字：它是值行里唯一的百分比，而这个「占多少」原先只有一个 title 在解释。 */
[data-plugin="dsh-tokbook"] .dtpl-stat .dtpl-v{
  display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
  font-family:var(--dtpl-mono);
  font-size:20px;line-height:26px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-stat-pct{font-size:12px;line-height:18px;color:var(--dtpl-fg-2);}

/* 节标题 = 工业徽记 + 分区词。徽记是**反复出现**的那枚标记（终末地把「终末地工业」的
   Logo 及衍生图形铺在每个系统面板的头部，这里用同一手法）。它是黄牌 + 墨边——见 tokens
   里「黄是料不是线」那条。右端旁注（.dtpl-sec-aside）由它所在那一行的 space-between 推到边上，
   不画延伸线。 */
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

/* 日趋势 */
/* 这一节是本 tab 的最后一节，所以那条 20px 的节末外边距在这里不指向任何东西——它只是
   首屏预算表上一行白占的高度（页内那 20px 下余白已经给了同一处呼吸）。归零，把高度还给
   仪表区那一行口径词（见 .dtpl-hero-lead）。 */
[data-plugin="dsh-tokbook"] .dtpl-trend{margin-bottom:0;}
/* 图不是一块面板：柱直接站在卡面上，脚下只有一条基线。 */
[data-plugin="dsh-tokbook"] .dtpl-bars{
  position:relative;
  display:flex;align-items:flex-end;gap:3px;height:92px;
  /* 图上方那 24px 留白给最高那根柱的数值标签。 */
  margin-top:24px;
  /* 左右内边距必须 ≥ 半个标签宽。列宽约 40px，而最宽的标签是等宽 10px 的六字（517.3M）实测 33px，
     居中后每侧探出约 4px；此前留的 4px 不够，所以首尾两列曾被单独钉在列边缘（is-start / is-end）
     来防溢出——代价是那两根柱和数字对不上。这里留 14px（与本卡正文的 14px 内缩一致），
     14 列统一居中，字体度量最宽的浏览器也还剩 ~10px 余量。轴行同步，否则柱子与日期会错开。 */
  padding:0 14px;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-bar{position:relative;flex:1 1 0;min-width:0;height:100%;display:flex;align-items:flex-end;}
/* 非峰值柱：中性灰。灰取墨色 45%——柱高是这张图的正文，30% 在白底上只有 1.99:1，
   过不了 3:1 非文本对比度。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-fill{
  position:relative;width:100%;overflow:hidden;
  background-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
/* 柱顶 1px 受光边 + 峰值柱内侧的**顶部盖片**：面板有 --dtpl-metal 那道机加工受光边，
   柱子此前是纯色块。盖片高度与底面都写 3%，所以它在 68px、2px 柱上都按比例成立（2px 柱上
   盖片被 overflow 裁掉，只剩受光边——不会缩成一团）。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-fill::before{
  content:"";position:absolute;left:0;right:0;top:0;height:1px;
  background:color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
}
/* 峰值：**更亮的中性块 + 柱值标签前一枚黄牌**，柱身上不带任何黄。
   缘由是黄的面积预算——黄只出现在当前页 / 峰值 / 徽记三处，这条规则管的是「几处」而没管
   「多大」。徽记 7×13px、当前页标记 5px 宽，而峰值柱恒为满高（峰值就是量程 max，柱高永远
   92px），一根约 43×92px 的实心黄把全 UI 的黄面积吃掉了约 97%。于是「黄 = 小件」的稀缺性
   失效：满屏唯一的饱和色落在最大的那块面上，视线被钉在这里，而这张图要读的是分布的形状。
   且它是冗余编码——「哪天最多」柱高已经说明，标签又已经加粗提亮（见下 .is-peak 标签），
   黄只贡献了「报警」的语气。恒定的黄还有个主题不对称：#FFCD00 对深底 9.28:1 是全屏最响的
   东西，对白卡只有 1.57:1 只是块淡黄——同一套 CSS 在深色主题下重得多。这也是 D-028 撤掉
   峰值参考线用过的同一把尺子（收益抵不过打扰）。
   **黄在柱身上试过三版，全被否掉，最后一版还错在原则上。** ① 6×3px 贴左下角：一枚不知从哪
   来的黄块（「只有立柱的左下角有,看起来很奇怪」）。② 改成贯通柱宽的柱脚黄条：又成了「上下
   各有一条黄线」。③ 病根在于**柱顶 3% 的压边与柱脚 3px 的黄条都是"线"**——tokens 那条
   「它是"料"，不是"线"」本来就禁止黄以线条出现（恒定的黄做细线在浅底上是 1.57:1 的糊线），
   而我把它画成了两根细线；两条平行线贴着同一个矩形的上下边，读起来是一圈「取景框」，不是
   一枚件。所以黄从柱身**整个撤掉**，回到它唯一站得住的形态：**一枚实心小黄牌（4×8px，节徽记
   的 0.6 倍）+ 墨边**，挂在峰值那个数值前面（.dtpl-bar-label.is-peak::before）——「黄牌 + 黑
   边」正是工业标识的写法，也是本窗口「当前页标记 = 黄块 + 墨边」「口径词前一枚徽记」同一套
   记号；挂在数字上，标记与它标注的值就不会走散（这也是数据图形该有的做法：用形状 + 文字标注
   峰值，而不是只靠颜色）。柱身因此只剩形与明度：墨边（形）+ 70% vs 45%（明度）。
   **70% 是量出来的，不是拍的**：82% 时峰值柱体是 #D4D5D6，与黄 #FFCD00 的明度几乎相同（9.4:1
   vs 9.0:1 对深底），黄牌挨着浅块也读不出来——留着黄却看不见它，等于白留。70% 时柱体约
   #B7B8B9（对深底 ≈6.9:1），仍是全图最亮的一根（其余柱 3.9:1）。再往下压就会和邻柱糊在一起，
   峰值也认不出。
   墨边仍照旧：恒定黄对白底只有 1.57:1 的老问题不再存在，但它让峰值的边界在浅色主题下由
   「深块 + 更深的描边」给出，深色主题下则是一道清晰的墨框。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-fill.is-peak{
  background-color:color-mix(in srgb,var(--dtpl-fg) 70%,transparent);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
/* 峰值柱顶那 3% 回到墨色：柱身不承担黄，这枚盖片只做「机加工件的顶边」。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-fill.is-peak::before{
  top:1px;height:3%;background:var(--dtpl-on-brand);
}
/* 零刻度：挂在 .dtpl-bar 上、贴 bottom:0——柱子的零高度不参与定位。
   零日**不写「0」**（等宽 0 只有 5.5px 宽，读起来是标签而不是测量结果）：基线上一道 2×3px 的
   硬刻度，取 --dtpl-fg-3（在深底上是那枚全图最亮的中性灰）：2px 的块比 1px 线的观感弱，
   再压透明度就会在深色主题里消失。这枚刻度**居中于自己那一列**——它量的是这一列，左右两角
   没有含义，贴左角同样是一枚「不知从哪来的块」（它由此也和柱值标签同轴）。 */
[data-plugin="dsh-tokbook"] .dtpl-bar.is-zero::after{
  content:"";position:absolute;left:calc(50% - 1px);bottom:0;width:2px;height:3px;
  pointer-events:none;background:var(--dtpl-fg-3);
}
/* 每根柱自带数值：不用悬停也能读图。偏移量写成 inline——重复填充高度的表达式，让数字贴在自己的柱顶。
   墨色取 fg-2：这是图的正文（读数），三级色对卡面只有 3.47:1，10px 也不该这么淡；
   峰值仍靠主墨色 + 600 + 黄牌 + 更亮的柱体区分。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-label{
  position:absolute;left:50%;transform:translateX(-50%);
  font-family:var(--dtpl-mono);
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
  white-space:nowrap;pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-peak{color:var(--dtpl-fg);font-weight:600;}
/* 峰值的黄牌：4×8px（节徽记的 0.6 倍）+ 墨边，挂在**数值前面**——黄在这一屏的唯一形态是
   「实心块 + 墨边」，而它挂在数字上，标记与它标注的值就不会走散。柱身那三版失败的黄
   （角块 / 通宽柱脚 / 上下两条线）都长在几何上，说的却不是数据；这枚说的是「这一根是峰值」，
   而且它同时是形状：数据图形的峰值不该只靠颜色说出来（形状 + 文字 + 明度，三层各自成立）。
   内联块 + vertical-align:-1px，与 10px 等宽数字的基线对齐；标签整体仍由 left:50% +
   translateX(-50%) 居中，于是「黄牌 + 数字」作为一组居中在柱顶，而不是把数字单独推偏。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-peak::before{
  content:"";display:inline-block;width:4px;height:8px;vertical-align:-1px;
  margin-right:5px;background:var(--dtpl-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
/* 零日的数不由标签承担：柱高为 0 时「0」只是一个字符的噪声（等宽 0 只有 5.5px 宽），
   它说的是基线自己就能说的事。量出来的零改由基线上那道 2×3px 刻度画（见上 .is-zero::after），
   所以标签在零日整枚撤掉，而不是挪个位置接着写。 */
[data-plugin="dsh-tokbook"] .dtpl-bar.is-zero .dtpl-bar-label{display:none;}
[data-plugin="dsh-tokbook"] .dtpl-trend-axis{
  display:flex;gap:3px;margin-top:6px;padding:0 14px;
  font-family:var(--dtpl-mono);
  font-size:10px;line-height:16px;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-trend-axis span{flex:1 1 0;min-width:0;text-align:center;white-space:nowrap;}

/* 明细头部（用量明细 tab 的分区词 + 切法子 tab + 右端旁注）。这一节此前只有两个 tab 标签，
   而它们说的是**切法**、不是这一节是什么——所以它成了全窗口唯一没有分区词与工业徽记的一节。
   现在头部与其余各节同一套：黄牌 + 分区词，右端旁注；子 tab 挂在这一行上，用「横排 +
   竖分隔 + 底部实条」那套（实条取墨色——品牌黄这一屏只留给当前页、峰值、徽记三处）。
   分区词是**窗口词**（今天 / 近 7 天 / 全账本累计）：这一页陈述的就是某个窗口的用量，
   所以窗口自己就是它该有的名字（与「近 14 天趋势」同一写法）；切法是它的三种切法。 */
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

/* 列头 + 行共用同一条网格。这是这一节从「一叠两列段落」变成**读数表**的关键：
   两列的宽度由网格定死，于是
     ① 占比条每一行都一样宽 —— 它横跨整条网格（『grid-column:1/-1』，见下），长度由**区块**
        决定、与哪一行无关；此前轨道宽 = 区块宽 − 该行金额文字宽，实测在 511–577px 之间
        摆动，802.4M 那行的条比 813.4M 那行还长；
     ② 金额列每一行都结束在同一条竖线上 —— 此前「订阅价值」是数字后面的行内后缀，
        有订阅的行把数字推左，整列读不成一列。
   列头也照数据的**两行**写，行高与行内两行一致，标签因此落在对应数值正上方。
   右列宽 --dtpl-row-nums-w 定义在 tokens 片段：『.dtpl-row』是**跨 tab 共用**的行组件
   （通道用量、按工作区也走它），度量挂在插件根上，否则另一个 tab 取不到变量、整条声明静默失效。
   它取 minmax 的**下限**：224px 是按当前这种金额量出来的，位数不受控，写死会让金额在轨道里被裁。 */
[data-plugin="dsh-tokbook"] .dtpl-bd-cols,
[data-plugin="dsh-tokbook"] .dtpl-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(min-content,var(--dtpl-row-nums-w));
  column-gap:16px;
}
/* 列头：**一行**。两列各是一串上下叠起来的事实，所以列名写成「甲 · 乙」，与旁注、工作区
   事实行用的是同一个分隔符。早先照数据的两行写成两行（模型 / 通道 各占一行），标签能精确
   落在各自数值正上方，但四枚孤零零的标签占两行、中间大片空白——表头比它标注的数据还高；
   一行牺牲精确对位，换回它像一行表头。 */
[data-plugin="dsh-tokbook"] .dtpl-bd-cols{
  padding:8px 0 6px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
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
/* 金额格 = 一段或两段「数额 + 桶名」。**只限不可预测的那一半**：
   值（数额）是会被裁的那一个，所以它限宽 + 省略号 + title 兜底；
   桶名是**固定的一小段字**（「实际支出」/「订阅价值」，都是四个汉字），所以给它 nowrap 与一个
   min-width，宽度在每一段里因此都是同一个 max-content —— 各段数额的右边缘照样对齐，而标签
   既不会换行、也不会被裁。上一版给标签硬写 width:44px（等于「限一个可预测的值」），换个字体
   宽一点就会被裁或折行。
   一个工作区跨通道，两个桶可同时非零 —— 那是**两段**并排（各带自己的桶名），不是一段里塞两个
   没名字的数；两者都无话时仍用一枚零撑住格子。 */
[data-plugin="dsh-tokbook"] .dtpl-cost{
  display:flex;align-items:baseline;justify-content:flex-end;gap:0;
  max-width:100%;
  font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-size:12px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-cost-seg{
  display:flex;align-items:baseline;gap:5px;min-width:0;
}
/* 段之间用这个窗口表示「一串事实」的那个『·』（与 hero 累计带、工作区元信息行同一个符号），
   间距走它自己的 padding 而不是容器的 gap——两段之间因此只留 6+6.6+6，好把宽度让给数额。 */
[data-plugin="dsh-tokbook"] .dtpl-cost-sep{flex:none;padding:0 6px;color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-cost-main{min-width:0;overflow:hidden;text-overflow:ellipsis;}
[data-plugin="dsh-tokbook"] .dtpl-cost-k{
  flex:none;min-width:44px;margin-left:0;text-align:left;line-height:16px;white-space:nowrap;
}


/* 工作区 */
/* 身份行：目录，然后是让「最近优先」可读的两个事实。目录在挤压时让步；事实永不裁。
   这一行走『--dtpl-fg-2』而不是三级色：它与「按模型」行的通道行是同一档信息（行的次要身份），
   而三级色在浅色皮肤上是 #81858c —— 压在白卡上实测 3.45:1，11px 正文不够 4.5:1。 */
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
/* 失败数染色，因为它与旁边的请求数不是一类事实：请求数是读数，失败是**要看一眼**的状态。
   走 warn-ink 而不是裸 warn（裸 warn 在 11px 正文上只有 2.15:1，warn-ink 才够）。 */
[data-plugin="dsh-tokbook"] .dtpl-ws-fail{
  font-weight:600;color:var(--dtpl-warn-ink);font-variant-numeric:tabular-nums;
}
/* 「未归属」是对账行、不是项目（D-018）：它不参与「最近有操作在前」，所以用一条发丝线把它从
   上面的工作区清单里分出来，标题降一档到次要色——行内其余排版不动，它照样有词元、金额与占比条，
   因为它的量本来就要能加回累计。 */
[data-plugin="dsh-tokbook"] .dtpl-row.is-unattributed{
  margin-top:22px;padding-top:14px;
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-row.is-unattributed .dtpl-model-name{
  color:var(--dtpl-fg-2);font-weight:400;
}

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
/* 骨架块高度 = 对应真块的**实测**高度，首屏因此不会在数据到达时整体下跳。
   骨架是按真块的排法分段的（hero / 读数格 / 趋势图），而真块里 hero 与读数格同为一张卡：
   所以 sk-hero + tile 要等于整卡高（318 = 250 + 68），chart 对上「近 14 天趋势」那一节（159）。
   1404px 宽下量的（预览台 fixture）。卡首那条图占高的 140px 都在 sk-hero 里——它是卡的一面，
   不是背景。这一串数字被历次改动推着走：D-036 撤掉今日异常行（sk-hero 307 → 277）、
   D-037 撤掉每格那条占比尺（tile 90 → 76）、本轮按首屏预算压 hero（图带封顶 140px，
   sk-hero 277 → 250；tile 76 → 68：内边距收 2px + 去掉重复的 3px margin-top）。 */
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
