export const CSS_SESSION = `/* 会话词元页（对话视图环的第三个视图「词元」） */
/* 这一页是**单会话 · 全生命周期**的视角（跨会话 · 按窗口的视角在浮窗的用量总览/用量明细，
   见 docs/CONTEXT.md）。宿主把它渲染在对话正文里，宽高由视图环给，所以这里没有浮窗那套面板几何。
   根选择器是**复合**的：整页的根自己带 data-plugin（宿主不会替插件挂它），而其余规则都按那个
   属性选子孙——.dtpl-tok 是根本身，不是根的子孙。 */
/* 根：撑满宿主给的视图区并**自己裁切**。带 data-conversation-composer-overlay 之后宿主的
   :has() 规则把 viewArea 夹成 flex:1 1 0 / min-height:0 / overflow:hidden（见
   dsh-client-ui-conversation 的 views 片段），我们的根就是它的 flex 子项，于是整页有了确定高度，
   滚动的只有里面那层——对话的滚动容器不再被这一页撑开，输入框也不再是压着内容的 sticky。 */
[data-plugin="dsh-tokbook"].dtpl-tok{
  /* 阅读宽度只有这一个名字：调过就是这一页存下的 px（--dtpl-tok-width 由 SessionShell 挂在
     style 上），没调过就跟着宿主给对话正文的那条列（--dsh-chat-content-width）。列与手柄的
     几何都按它算。 */
  --dtpl-col-w:var(--dtpl-tok-width,var(--dsh-chat-content-width,920px));
  display:flex;flex-direction:column;
  flex:1 1 0;min-height:0;overflow:hidden;
  position:relative; /* 手柄绝对定位在这个**不滚动**的盒子里 */
  color:var(--dtpl-fg);
  /* 一页的底色：不走宿主那张平的灰，给一层极淡的暖向渐变——它不参与任何读数，
     只是让这一页从「嵌在对话里的灰块」变成「一块有自己气质的面」。
     深色皮下这层会翻成井，浅色皮下是肉眼几乎看不见的暖移（实测 ΔE<1）。 */
  background:
    /* 底纸：极淡的暖向渐变 + 点阵，让底色不与任何一块同族 */
    linear-gradient(180deg,
      color-mix(in srgb,var(--dtpl-fg) 1.2%,transparent) 0%,
      color-mix(in srgb,var(--dtpl-fg) 0.4%,transparent) 100%),
    radial-gradient(color-mix(in srgb,var(--dtpl-fg) 3%,transparent) 1px, transparent 1px);
  background-size:100%, 3px 3px;
}
/* 会话时间那一块：底色再暖一档——它是「时间」不是「钱」，该与用量块有温度差，
   否则 14 小时的跨度与 1.5M 的词元在视觉上是一个温度。
   也给它一圈硬边与 18px 的内白：它不再是一串浮在底色上的事实，
   而是这一页的第二块**有边的面**——与抬头那块、词元构成那块同级。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-timing{
  display:flex;flex-direction:column;gap:12px;
  background:
    linear-gradient(180deg,
      color-mix(in srgb,var(--dtpl-fg) 1.8%,transparent) 0%,
      color-mix(in srgb,var(--dtpl-fg) 0.6%,transparent) 100%);
  border:1px solid var(--dtpl-border);
  padding:18px 20px 16px;
}
/* 引擎工作 / 会话跨度两个主角：与「词元构成」那四格同一个读数规格（标签 + 24px / 700
   等宽数），时间因此与钱在这一页是同级读数，而不是主读数旁边的一行小字。
   两格**并排**是内容决定的：单看哪个都不说明问题，差额才是这一页要说的事。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-timing-grid{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;
}
/* 比值尺画的就是上面那两个数之间的关系，压在它们下面：块间距 12px 收回 6px，贴着但不粘上。
   条与它的两枚段名是**一个整块**（.dtpl-tok-hero-ratio 自己带内部间距），所以这条负边距挂在整块上，
   而不是像从前只挂在条上——否则段名会被推到 12px 那一档去，与它描述的那条尺分家。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-timing .dtpl-tok-hero-ratio{margin-top:-6px;}
/* 首记 / 末记是事件**锚点**，不是用量读数：留在事实带那一档，与两个主角差两级。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-timing .dtpl-hero-facts{margin-top:-2px;}
/* 子代理那一段：与抬头、会话时间同级的一块有边的面。它回答的是抬头那个问题的另一半
   （下级会话花了多少），所以紧跟在抬头之后；主合计**不并入**它，两笔账分开放。
   面板与抬头同配方（硬边框 + 卡面 + 材质），但**不含**材质：一页里材质只给第一读数，
   第二块再上材质就与抬头抢。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-sub{
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
/* 两个读数格：合计与钱。它们不是抬头那个 72px 主的同级，用这一页通用的 24px 读数格，
   但**去掉** .dtpl-tok-col 给四桶那排的 16px 内白——这段的格贴在面板上，内白由面板自己给。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum .dtpl-stat{padding:16px 18px 10px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum .dtpl-stat + .dtpl-stat{border-left:1px solid var(--dtpl-border);}
/* 子代理逐行：名称在左，词元 / 份额 / 钱在右。份额是**这个子代理占全部子代理**的比例，
   与上面那格「占本会话 + 子代理」不是同一个分母——两个分母都写在各自旁边。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-list{
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto auto auto;
  grid-template-areas:"name tokens share cost";
  align-items:baseline;gap:4px 16px;
  padding:10px 18px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-row + .dtpl-tok-sub-row{
  border-top:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-name{
  grid-area:name;display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;
  min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-label{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
}
/* 「含 N 个下级」是这一行的**范围**说明，不是读数：小一档、走次级墨色。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-extra{
  flex:none;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-tokens{
  grid-area:tokens;white-space:nowrap;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;
  font-variant-numeric:tabular-nums;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-share{
  grid-area:share;white-space:nowrap;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost{
  grid-area:cost;white-space:nowrap;justify-self:end;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="spend"]{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="subscription"]{color:var(--dtpl-fg-2);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="unpriced"],
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="none"]{color:var(--dtpl-fg-3);font-weight:400;}
/* 一段的两句降级事实（用量未知 / 价格未知）走这一页的脚注口径：它们是读法，不是错误。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-note{
  display:flex;flex-wrap:wrap;gap:2px 6px;align-items:baseline;
  margin:0;padding:0 18px 14px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-note i{font-style:normal;color:var(--dtpl-fg-dim);padding:0 5px;}
/* 这一页自己的滚动区：高度由外面给（根是它的 flex 容器），滚动归自己。底部那块是给飘浮的
   输入框让位——输入框高由宿主发布在滚动容器上（实测 128px），不留的话最后一段内容永远压在
   它下面、滚不出来。轨迹页用的是同一个算式。
   position:relative 不是排版需要，是**挡住溢出往上算**：这一页的内容比视图区高得多，而
   Blink 会把它的排版溢出一路算进祖先的 scrollHeight——对话那个滚动容器因此变成「可滚」（实测
   2255 > 904），滚到本页底部再滚一下，整页就被外层滚走了（实测根元素 top 从 76 变 -424）。
   加一个定位盒就断在这里（实测 2255 → 904）；轨迹页那层 ledger 同样带 position:relative。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-scroll{
  flex:1 1 0;min-height:0;overflow-y:auto;
  position:relative;
  padding-bottom:calc(var(--dsh-composer-height,152px) + 16px);
}
/* 阅读宽度。这一页跟着宿主给对话正文的那条列宽走（--dsh-chat-content-width，宿主按用户的
   列宽设置在 .wSkVaW_body 上算出这条列；本机实测 742px，而视图区有 1158px）——不跟的话面板与
   图表铺满到两边，比对话正文宽 56%，读起来费劲。列居中，滚动条留在这条列**外面**（滚动区仍
   占满宽度），于是本页与对话/轨迹两页的滚动条落在同一条竖线上。
   左右各 4px 是给 :focus-visible 那圈描边留的（2px 线 + 2px 偏移，写在 footer.ts 里）：列宽
   等于可用宽度时（窄窗口、嵌入形态）环会被滚动区裁平，留出这 4px 就够。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-col{
  display:flex;flex-direction:column;gap:32px;
  width:100%;max-width:var(--dtpl-col-w);
  margin-inline:auto;
  box-sizing:border-box;
  padding:0 4px;
}
/* 列宽手柄：宿主的手柄挂在它自己的视图根上，非对话视图一激活就被
   .wSkVaW_root:has([data-conversation-composer-overlay]) .wSkVaW_widthHandle{display:none} 一起藏了，
   所以这一页补一对（拖法见 SessionShell）。
   条带**宽一些**（贴住列边往外 64px，按留白宽度收缩）：抓取范围大、光标也早一步变成 col-resize，
   这就是它唯一的提示；而那条 2px 线只在指针压到这条带子上时出现——「指针在这一页上就一直亮」
   那种做法不算提示，因为读这一页时它永远亮着，而且左右各一条固定在中点的短线只会读成装饰。
   线锚在带子**朝列的那一边**（左带 right:0、右带 left:0），两条因此都正好离列 24px，左右对称。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-grip{
  position:absolute;top:0;bottom:0;z-index:1;
  width:min(64px,calc((100% - var(--dtpl-col-w)) / 2 - 24px));
  cursor:col-resize;
  touch-action:none;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-side="left"]{right:calc(50% + var(--dtpl-col-w) / 2 + 24px);}
[data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-side="right"]{left:calc(50% + var(--dtpl-col-w) / 2 + 24px);}
[data-plugin="dsh-tokbook"] .dtpl-tok-grip::after{
  content:"";position:absolute;top:0;bottom:0;width:2px;
  border-radius:var(--dtpl-radius);pointer-events:none;
  background:linear-gradient(to bottom,
    transparent calc(var(--dtpl-grip-y,50%) - 36px),
    var(--dtpl-fg-3) calc(var(--dtpl-grip-y,50%) - 8px),
    var(--dtpl-fg-3) calc(var(--dtpl-grip-y,50%) + 8px),
    transparent calc(var(--dtpl-grip-y,50%) + 36px));
  opacity:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-side="left"]::after{right:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-side="right"]::after{left:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-grip:hover::after,
[data-plugin="dsh-tokbook"] .dtpl-tok-grip:focus-visible::after,
[data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-dragging]::after{opacity:1;}
/* 拖动中要压在滚动区之上（两者都是定位盒，靠层号分先后），但仍在输入框那条飘浮带之下。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-dragging]{z-index:2;}
/* 抬头 = 一块读数面板（1px 硬边框 + 3% 洗色 + 材质，与浮窗那块「读数面」同一配方），
   面板里没有分区词：它自己就是这一页的主读数（四桶合计）。
   它的下半段是「词元构成」（见 .dtpl-tok-mix-band）——合计与它的四桶在同一个框里，
   一条横贯的分区线把「多少」与「由什么组成」分开。这与浮窗那张「今日词元」卡同一配方。
   面板的下内白由构成那块收回去（它自带 padding），所以这里的 padding 只管上半区。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-head{
  display:flex;flex-direction:column;gap:10px;
  /* 左右内白发布成一条变量：构成带要靠它的负值把分区线抵到外框，再靠自己的 padding 把
     文字推回同一条左边缘。窄屏整条边白收窄时，两处才不会各自漂开（见 @media 640px）。 */
  --dtpl-tok-head-pad:32px;
  padding:28px var(--dtpl-tok-head-pad) 24px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
}
/* 旁注单独成行：分区词右端那条旁注是 nowrap 的，而这一页的两句都长、窄屏放不下。
   负的上边距是把分区词那 11px 的下边距收回来一点，句与标题仍是一组。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-note{
  margin:-5px 0 10px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  overflow-wrap:anywhere;
}
/* 这一页的主角数字：比浮窗那格（38px / 600）大一截、重一档。
   它是这一页的**第一读数**——四桶合计，不是仪表盘上的一条参照。浮窗那格是「今日总额」，
   周围还有趋势图与四桶格在分注意力；这一页它周围没有别的读数，所以它该抢眼。
   72px / 700 是量出来的：再大就顶到下面那行事实带、再小就退回「又一个读数格」。
   字重 700 不是标题——它仍是读数，但它是**主角**读数，600 在这个字号下不够撑住场面。
   letter-spacing 压到 -.06em：等宽数字天生有缝，不压就读成「一串格子」而不是一个数。
   字号刻度外的**唯一**一处：它是整页的主角读数，而这一页不在 720px 浮窗里（见 tokens 的 fs-hero）。
   不再新开档——要改这一屏的层级就改这个值本身，别拿它当中转站。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-head .dtpl-total-num{
  font-size:72px;line-height:76px;font-weight:700;letter-spacing:-.06em;
}
/* 口径词在主角数字上方，留出呼吸：它不再与数字抢同一行（浮窗那格是并排的），
   而是整行压在上面，像报表的栏头。字号收到 11px——它是**身份**不是标题，小一号才不与数字争。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-head .dtpl-total-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.08em;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-foot{
  /* 页脚不是「底部那串小字」，是这一页的**收口**——与抬头、会话时间、词元构成同级，
     所以给它一圈硬边 + 内白，而不是一条发丝线就完了。 */
  border:1px solid var(--dtpl-border);
  border-top:0;
  margin-top:4px;
  padding:16px 20px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-foot .dtpl-tok-note{margin:6px 0 0;}

/* 词元构成带 = 抬头面板的**下半段**。它不是浮窗里那种「框内读数带」——同一配方只借形状：
   这里的分区线**横贯整块面板**，面板于是被切成「读数」与「它的分解」两区，比一条浮在
   面板里、两头不到边的线清楚。它自己不出边框、也不带分区词：框归抬头那块面板。
   整块面板因此只说一件事：这个会话用了多少、由什么组成。取舍见 SessionTurns 的 MixBand。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-band{
  /* 负边距抵掉面板那 32px 内白：分区线因此两边都抵到面板外框；文字边缘再由本块的 padding
     补回同一档，所以命中率、四个读数格与上面的合计数字共用**同一条左边缘**
     （改之前是 217 / 202 / 184 三条，量过）。
     下边那 -24px 收回面板的下内白，改由读数格自己的下内白给这一块呼吸——面板底部因此
     不是空出 24px，而是收到 20px，与四格那排读数贴得更紧。 */
  margin:10px calc(var(--dtpl-tok-head-pad) * -1) -24px;
  padding:0 var(--dtpl-tok-head-pad);
  border-top:1px solid var(--dtpl-border);
}
/* 构成这一行的**读法**：命中率是读数（等宽加粗），计费输入的口径是定义（退到右端）。
   命中率从抬头的参照带搬到这里——它是「缓存读取占计费输入多少」，与下面那四个格说的
   正是同一件事；而混在「实际支出 / 订阅价值 / 轮数」那串里，它是一个换了单位的例外。
   这一条下面**不放分段条**：比例由四个格自己的「占 X%」承担，横贯整行的实心条只会把
   抬头的 72px 数字压下去（取舍见 SessionTurns 的 MixBand）。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-band .dtpl-tok-note{
  display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 16px;
  margin:0;padding:14px 0 0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-hit{white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-hit b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;
}

/* 每轮两格小图（small multiples）：上格新增词元、下格缓存读取，共用同一列轮次与同一条轴线。
   两格各自归一（理由见 SessionTurns），所以**一格只有一把尺子**——两把不同刻度的柱并排在同一
   列里，读者会不由自主地比高度。
   整块图按轮数定宽：轮数少时是一张紧凑的小图（每列 92px 是它的自然宽度），轮数多到一列装不下
   自己的标签（见 --dtpl-slot-w）时**整块图横向滚动**，不再把柱与标签压成一团。滚动区就是这一块，
   所以上下两格与那条轴线一起走，柱子与它正下方的轮次号永远同屏。宽度有下限，一轮的会话里格头那句
   「合计 / 峰值」比图还宽，柱子不该缩到它下面去。
   柱形自己有宽度上限（见下 .dtpl-bar-fill）：柱宽不承载数据，轮数少时让它跟着列一起撑开，
   一列就成了 400px 宽的灰砖。整块图靠左——它跟分区词、旁注同一条左边缘，居中会从版面里飘出去。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-plot{
  /* 一列**不被邻居压字**的下限：柱值标签最长 5 个等宽字符（12.3M）约 30px，峰值那根前面还挂
     一枚 4px 黄牌与 5px 间隔（约 39px），同一列里邻柱各让出一半——34.5px 是「刚好不叠」。两枚
     数字贴在一起仍读不成两个数，所以取 48px。轮数不到这条线时它只是个下限（列跟着列宽摊开，
     柱宽另有上限）；越过去整块图就横向滚动。 */
  --dtpl-slot-w:48px;
  display:flex;flex-direction:column;gap:24px;
  min-width:min(280px,100%);
  max-width:calc(var(--dtpl-slots,4) * 92px + 28px);
  overflow-x:auto;
  /* 横向滚动条是这里唯一「还能往右看」的提示，所以给它一条插件自己的墨色配方（宿主那条
     --dsw-alias-scrollbar-* 不许在这个片段里直连，见 scripts/selfcheck-ui.ts §5）。 */
  scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,var(--dtpl-fg) 30%,transparent) transparent;
}
/* 三块（上格 / 下格 / 轴线）同宽：柱子是 flex:1 摊开的，只有三块等宽，柱与它的轮次号才不错开。
   下限写在这三块上而不是柱上——滚动的是这一整块图，不是某一根柱。
   box-sizing 必须写：轴线自己带 14px 的内边距，不让下限算进边框盒的话它会比两格宽出 28px，
   越往右越偏（40 轮时最后一列与它的轮次号差 27.6px，量出来的）。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-plot > *{
  box-sizing:border-box;
  min-width:calc(var(--dtpl-slots,4) * var(--dtpl-slot-w));
}
/* 图表外层：只做悬停读数卡的定位父级。卡片必须画在图**之外**——.dtpl-tok-plot 自己是个横向
   滚动区，画在里面的浮层会被它裁掉，还会被算进它的滚动宽度；挂在这一层就没有这两个问题，
   按柱子与滚动区的实测矩形摆位（算法见 SessionTurns 的 TurnChart）。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-chart{position:relative;}
/* 悬停读数卡：指着一根柱子，报那一轮的全部读数、四桶与提问 / 回答预览（内容见 TurnChart）。
   面与线用面板那套配方（硬边框 + 卡面 + 材质），不另投影子——它压在图上，一轮的边界由那圈
   硬边给出就够了。
   pointer-events 必须 none：卡片就压在柱子上，吃掉指针的话柱子立刻 mouseleave，卡片自己闪掉。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-hover{
  position:absolute;z-index:1;pointer-events:none;
  display:flex;flex-direction:column;gap:5px;
  box-sizing:border-box;
  max-width:min(300px,100%);
  padding:8px 10px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-card);
  box-shadow:var(--dtpl-metal);
}
/* 卡里那句「柱高是怎么来的」：它是口径说明、不是读数，所以走次级墨色，字号与四桶那行同档。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-hover-basis{
  margin:0;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
}
/* 四桶在卡里排成一条事实带：卡片只有 300px 宽，字号比页面上的读数带再收一档。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-hover-buckets{font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);}
[data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-bars{height:80px;margin-top:22px;}
/* 轴线贴着自己上面那格：16px 的格间距对「轴属于谁」太远，收回去 6px。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-trend-axis{margin-top:-6px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-panel{display:flex;flex-direction:column;}
/* 格头 = 这一格的纵轴：系列名（图例色块 + 名）+ 合计 + 峰值。三个数都在这，柱上不再画刻度。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-panel-k{
  display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin:0;
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-panel-v,
[data-plugin="dsh-tokbook"] .dtpl-tok-panel-k i{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);font-weight:400;
  font-style:normal;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
}
/* 柱宽 = 列宽的 48%，并封顶 44px：柱与缝因此始终约 1:1。百分比管住「列被挤窄」（轮数多），
   44px 的硬上限管住「列很宽」——一轮的会话里那列有 250px 宽（图有 280px 的宽度下限），
   只有百分比的话柱会撑成一块 120px 宽的砖。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-bar-fill{
  width:min(52%,48px);margin:0 auto;
  /* 柱身给一层极淡的纵向渐变：顶深底浅，是「墨在纸上的落笔」而不是「一块平涂的灰」。
     两档只差 8%，肉眼看是同一块灰，但光线扫过去的时候它有体积——
     一屏十几根柱子全是平的，读起来就是一堆栅栏；有体积的柱子读起来是**数据**。 */
  background:linear-gradient(180deg,
    color-mix(in srgb,var(--dtpl-fg) 52%,transparent) 0%,
    color-mix(in srgb,var(--dtpl-fg) 42%,transparent) 100%);
}
/* 图例：格头那枚色块与它下面那格的柱子同色，两格**都取浮窗那张图的 45%**（柱高是这张图的正文，
   更淡过不了 3:1 非文本对比度——浅色主题下比 45% 更淡的灰根本到不了 3:1，所以这里不做「缓存那格
   更淡」那套：两格的区分靠格头那句名字，不靠明度）。峰值仍由 ledger 那套的 70% + 黄牌给出。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-swatch{
  flex:none;width:8px;height:8px;align-self:center;
  background-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}

/* 一轮一块。块身只给边框与洗色，**不给材质**：材质是页面级面板的配方，一屏几十块叠着上
   材质就成一片噪声。但给一条极淡的底影——它是**面与面之间的分界**，不是装饰：
   一屏十几块没有影，它们就糊成一片，读者分不出「第 3 轮」与「第 4 轮」的界在哪。
   1px 的硬边在浅色皮下只有 1.2:1，压不住相邻两块；底影把界线交给光而不是交给线。
   收起状态：只给顶缘那条 1px 的压光，块与块之间清清楚楚。
   展开状态：整块浮起——它从「列表里的一项」变成「被选中的那一项」，
   靠底影加深而不是加边框（那会与已有的 1px 硬边打架）。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turns{display:flex;flex-direction:column;gap:14px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn{
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:0 1px 0 0 color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
  transition:box-shadow .2s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn:hover{
  box-shadow:0 2px 0 0 color-mix(in srgb,var(--dtpl-fg) 6%,transparent),
    0 8px 24px -12px color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
}
/* 展开那一轮：整块浮起一层——它从「列表里的一项」变成「被选中的那一项」。
   不是加边框（那会与已有的 1px 硬边打架），是交给底影：影加深 = 面抬高。
   这条只能出现**一次**：同一条选择器写两遍时后一条赢，改其中一条会静默失效。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turn:has(.dtpl-tok-turn-head[aria-expanded="true"]){
  box-shadow:0 2px 0 0 color-mix(in srgb,var(--dtpl-fg) 6%,transparent),
    0 8px 24px -12px color-mix(in srgb,var(--dtpl-fg) 18%,transparent);
}
/* 末尾那两块（轮间 / 轮次未知）**不在轮次序列里**：和编号轮次并排、一样宽、一样有边框时，
   「轮间」「轮次未知」会被读成第 13、14 轮。把它从序列里摘出来：块身去面（不占轮次那条
   硬边），块头的名字降一档墨色与字重——层级低了，但仍可点、仍可展开、读数一点不减。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turn.is-loose{
  background:transparent;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn.is-loose .dtpl-tok-turn-k{
  font-weight:500;color:var(--dtpl-fg-2);
}
/* 块头整块可点；右端那枚箭头是唯一的开关提示。预览本来就长在块头上，收起时它仍在。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head{
  display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 14px;
  width:100%;margin:0;padding:14px 18px;
  appearance:none;border:0;background:transparent;
  font:inherit;text-align:left;color:var(--dtpl-fg);cursor:pointer;
  transition:background .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head:hover{background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-k{flex:none;font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;}
/* 块头那串事实在这一页比浮窗那档（11px）大一档：它是这一节的**摘要**，而展开后每一步的读数
   是 13px——摘要比明细还小，层级就反了（理由同 .dtpl-tok-col .dtpl-sec-title）。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head .dtpl-hero-facts{
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-cue{
  flex:none;margin-left:auto;align-self:center;
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
  transition:transform .3s cubic-bezier(.22,.68,.24,1);
}
/* 展开时箭头转 180°：它不只是一个状态指示，是「这块翻开了」的形态语言。
   0.3s 与步骤区的 0fr 过渡同拍，转与展开同时落定，不先转后展。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head[aria-expanded="true"] .dtpl-tok-turn-cue{transform:rotate(180deg);}
/* 预览占满块头的第二行：提问一行、回答一行，都是单行省略（全文在 title 里）。
   颜色分档：预览文本是读数走 fg-2，只有回答前面那枚「↳」是装饰，走 fg-dim。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-preview{
  flex:1 1 100%;min-width:0;
  display:flex;flex-direction:column;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-ask,
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-reply{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-reply::before{content:"↳ ";color:var(--dtpl-fg-dim);}

/* 展开后的步骤区：默认 0 高度，收起时整块不占位。
   用 grid-template-rows 而不是 max-height：max-height 需要一个猜的「够大」值，
   轮次多时猜不够会截断；0fr → 1fr 是**内容自己决定高度**，几轮还是几十步都装得下，
   而且过渡的是同一个属性（rows），不会出现「先撑到一个假高度再弹回来」的错觉。
   缓动用 ease-out：展开时开头快（内容一下涌出来）、末尾减速（停稳）；
   收起时也是末尾减速（不是戛然而止），否则读者会觉得「被切了一刀」。

   overflow:hidden **必须写在内层那个格子上**（.dtpl-tok-steps-inner），只写在容器上不够：
   格子的自动最小尺寸取的是它**内容**的高度，而格子 overflow 为 visible 时那个下限就是内容的
   min-content 高度——实测容器已拿到 grid/overflow:hidden，14 块收起后仍各占 166~259px。
   格子自己裁切之后内容不再计入，166 掉到 22（只剩内白）。

   所以**竖向内白不能挂在这个格子上**：格子自身的 padding 不算「内容」，overflow:hidden 裁不掉
   它，22px 会一直留着。竖向那点呼吸改由首尾两行的外边距给（那是内容，收起时被裁掉），
   横向内白留在格子上（它不参与高度）。这样收起才真的是 0 高度。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-steps{
  display:grid;grid-template-rows:0fr;overflow:hidden;
  transition:grid-template-rows .3s cubic-bezier(.22,.68,.24,1);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps[data-open="true"]{grid-template-rows:1fr;}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner{padding:0 18px;overflow:hidden;}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner > .dtpl-row:first-child{margin-top:6px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner > .dtpl-row:last-child{margin-bottom:16px;}
/* 步骤与步骤之间：一条规则线，线上下共 32px 的空白（下 24px、上 8px，所以线**贴着下一步**，
   它是「这一步从这开始」的记号，不是「上一步到这就完了」）。
   人眼靠「靠近的东西是一组」分组，所以这条通道要 2.5~3 倍于**步内**的带间距（8px）才稳：
   1.75 倍时眼睛算不出哪边更近，一屏读下来就是「一片均匀的读数，分不出哪几行属于同一步」。
   整条阶梯是 10 / 18 / 32（都按「内容到内容」量）：同一簇内的列间 10px → 两簇之间 18px
   → 步与步之间 32px，两跳各是上一跳的 1.8 倍。
   **步与步之间那一跳必须是整条阶梯里最大的一跳**：它承载的正是「这是另一步」这条判断。
   反过来（行中间的缝比步与步之间还大）读者会先把一行读成两半，步的界限就更没戏了。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-steps .dtpl-row + .dtpl-row{
  margin-top:24px;padding-top:8px;
  border-top:.5px solid var(--dtpl-hairline);
}
/* 步骤行是**三段带**，每段各占整行：身份与钱 ｜ 尺 ｜ 读数（见 session-detail 的 StepRow）。
   三段纵向排开，所以它不再借用浮窗明细那条两列网格，只要一列。

   尺独占一行而不是只占左列：它要说清三段时间，车道越短越读不出比例（实测最窄的一段会落到
   4.4px——「等首 token 占一成」画成一根发丝）；铺满整行之后每一条尺都占同一组横坐标，竖着扫
   一列步骤就是趋势。尺上不去压金额：钱在第一段，不在读数里。

   读数那一段里两簇并排：用时（等宽列）｜四桶。两簇各自成网格、各自按内容摊开，中间那条缝让
   「时间」与「词元」在版面上是两件事，而不是十个并列的量。

   左脊：每一步一条 2px 的竖线，从身份行顶到读数带底，外加 12px 的内白。
   二十步的读数里，九个标签-值对长得一模一样，读者没有一个「这一步从哪开始」的锚；脊线就是那个
   锚——它把一步圈成一个竖块，步号挂在它的上端。有了它之后，步与步之间那条 1.2:1 的发丝线
   不必再独自承担「这是另一步」的全部责任（那条线按本仓库自己的门槛根本不达标，见上一条注释）。
   用 ::before 而不是加一层 DOM：这条线是**版面上的记号**、不承载数据（步号才是），
   不该进无障碍树，也不该多一个节点。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-step{
  position:relative;
  grid-template-columns:minmax(0,1fr) auto;
  grid-template-areas:"id cost" "bar bar" "read read";
  row-gap:10px;
  padding-left:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step::before{
  content:"";position:absolute;left:0;top:1px;bottom:0;width:2px;
  background:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-id{grid-area:id;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-cost{grid-area:cost;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-read{grid-area:read;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-bar{
  display:block;min-width:0;grid-area:bar;
}
/* 一行里两段都没有时（未计时 / 只量到墙钟）尺不出，这一段就空着——它本来也是空的。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-bar{
  flex:1 1 100%;display:block;min-width:0;margin-top:6px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-id{
  display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-no{
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-time{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-model{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
/* 失败 / 压缩芯片：用**形**（描边小片）区分它们，色相只给真要看一眼的那一种（失败）。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-chip{
  flex:none;font-style:normal;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;
  padding:0 5px;
  border:1px solid var(--dtpl-border);
  color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-chip[data-kind="failure"]{border-color:var(--dtpl-err);color:var(--dtpl-err);}
/* 这一行的钱：桶名 + 数额，排在身份那一段的右端（词序与块头那串事实一致），右缘每行成列。
   三档主次与浮窗 is-cash / is-zero 同一口径：字重 + 墨色分档，色相不参与。
   「价格未知」后面缀的「按 ¥0 计」是口径说明、不是数额，所以小一档走 fg-3。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost{
  display:flex;align-items:baseline;gap:7px;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost-k i{
  font-style:normal;font-size:var(--dtpl-fs-micro);color:var(--dtpl-fg-3);margin-left:4px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cash-amt,
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-sub-amt,
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cost-na{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cash-amt{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-sub-amt{color:var(--dtpl-fg-2);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cost-na{color:var(--dtpl-fg-3);font-weight:400;}

/* 读数那一段：两簇并排——用时 ｜ 四桶。两簇各自是网格，**各自按内容定宽**（不摊满整行）：
   摊满的话五个用时格与四个桶格会被拉到相隔几百像素，两组读数在版面上就散了——而它们是一句话
   的两半（这段时间、这些词元）。中间那条 32px 的缝是这两半之间唯一的界。
   计时那簇的宽度按它自己的列数给：只量到模型那一段时不至于把一格撑成半行宽。 */
/* 两簇之间 18px：缝要清楚，但**不能大过步与步之间的距离**——否则读者先把一行读成两半，
   步的界限就无从谈起（见 .dtpl-tok-step 那条注释里的阶梯）。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-step-read{
  display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:flex-start;
  gap:8px 18px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metrics{
  display:grid;
  /* 列宽是**定值**（--dtpl-tok-cell-w），不是 1fr 也不是 auto：
     · 1fr 会让这一簇摊满整行，五个用时格被拉到与四桶相隔几百像素——两组读数在版面上就散了；
     · auto 让列宽跟着这一行的内容走，「3.8秒」那行与「10.3秒」那行的列边界对不上，
       而「竖着扫一列就是趋势」正是这张表存在的理由（见 TIMING_METRICS）。
     62px 装得下最宽的标签与值（「等首 token」10px 约 50px、「10.3秒」13px 等宽约 45px）。
     列数由**整块**决定（缺读数的格子报「—」而不是抽掉那一列），故走 --dtpl-tok-cells。 */
  grid-template-columns:repeat(var(--dtpl-tok-cells,5),var(--dtpl-tok-cell-w));
  gap:0 10px;
  min-width:0;
}
/* 四桶那簇：**一桶一列**，与计时那簇同一套「标签在上、值在下」的语法，列宽同一条常数。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-tokens{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-tok-cell-w));
  gap:0 10px;
  min-width:0;
}
/* 非表形态（未计时 / 无产出）：没有数可以对齐，整段让给这一条读数 + 那句口径说明。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-metrics.is-flat{
  display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;
  flex:1 1 100%;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metric{
  display:flex;flex-direction:column;min-width:0;
}
/* 标签那一行是这一档的最小字号，值那行是等宽数字——两行一起把「哪个量」与「多少」分开。
   字号从 11px 收到 10px：标签在二十步里要重复二十遍，它**是底噪**，读者看的是下面那行值；
   一行里只有「值」这一种质地的，步与步之间的比较才立得住。
   退的是**字号，不是墨色**：这里仍走 fg-2。fg-2 在 tokens 里写明的职责就是「标签」（fg-3 那档
   是「只给装饰」，浅皮实测 3.5:1，给 10px 的正文标签用会掉到 AA 以下）——「首 token」是要读的
   字，不是装饰。层级靠 10px : 13px 与 fg-2 : fg 这两条拉开，不靠把字调淡。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-metric-k{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metric-v{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 没有读数的格子（「—」）与「未计时」同档：都是**没有数**，不是 0。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-untimed{
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg-3);
}
/* 「无产出」那句口径说明是解释、不是读数：整句独占一行，走次级墨色。
   它**不能**跟着 .dtpl-tok-untimed 走 fg-3——那一档是「这里没有数」的记号，而这是一句要读
   的话（解释这一步为什么没有模型那段）。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-metrics.is-flat .dtpl-tok-untimed.is-note{
  flex:1 1 100%;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}

/* ── 构成尺：一页里唯一的「比例」语言 ──────────────────────────────────────────
   用时那几条尺共用同一套灰阶词汇：**同一页里只有一套比例尺**，读者不必学第二遍。
   区别只在高度、长度与位置——步骤尺 / 块头尺都是 16px 高（都是「一条里分成几段」，
   同一族），抬头那条 8px（它是两段之比，不是组成）。
   这里**不放四桶分段条**：它的比例四个格里的「占 X%」已经说完，而一条横贯 912px 的实心黑条
   压在抬头的 72px 数字下面，读者先看到的是条不是数（理由见 SessionTurns 的 MixBand）。
   段与段之间不画缝：缝要靠 margin 或 border 占宽度，而最低 2px 的那一段会被它吃掉；相邻两档
   同色的问题在这里不存在（相邻的相位明度差约 2:1，分得开）。
   尺自身**不画轨道**——除了带长度通道的那两条（turn / hero）：几段之和就是整条宽度，画轨道等于
   给一个并不存在的分母留位。步骤尺没有长度通道，所以它是唯一不画轨道的一条。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-bar{
  display:flex;min-width:0;
  /* 三段**平齐**：高度不编码相位（按高度分档在 16px 上读出来是「三根长短不齐的柱子拼在一起」）。
     相位改由明度与段间断开认，见下面各 data-kind 与
     .dtpl-tok-bar-seg 的 inset 描边。 */
  align-items:stretch;
  /* 宽度由调用方给出：turn / hero 按量级算（行内 style），step 就是 100%（它没有长度通道）。
     这条兜底是给内联值缺席时（旧载荷 / 手写 fixture）留的，免得条塌成 0 宽。 */
  width:100%;
}
/* 三段尺**一律满高**：16px 装得下 1px 的断开，也让三段各有足够的面积承载明度差。
   块头那条与步骤尺同族（分解与整体的关系），所以同高、同灰阶、同断开配方。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="step"],
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="turn"]{height:16px;}
/* 抬头那条（hero）是另一族：「引擎工作 vs 没在算」，两段等高、只有长度。
   它的**长度不能说谎**——「14 小时里只算了 5 分钟」正是这一条要说的事，把那一段加宽到看得见
   就等于把它说长了。所以看得见的责任交给**厚度**：8px 高的一小块在 870px 的车道上是一段
   明确的实心记号。比率仍然逐像素是真值，只是这一段的横截面从 6×6 变成 6×8。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="hero"]{height:8px;}
/* 带长度通道的两条尺**画轨道**：不画的话，一段 145ms 的工作与一段 5 分钟的工作都只是一小截灰，
   读者读不出「它只占这么一点」，而那正是这两条尺存在的理由（步骤尺没有这条通道，所以也没有轨道）。
   轨道得**看得出是条凹槽**：底取 10% 洗色（压面板实测约 1.6:1，一眼能看见这是一条槽），
   再压 1px 内描边把上缘勾出来。轨道底色**不能更浅**：5% 压 3% 的面板只差两个百分点，实机里
   读成一片空白，于是轻的那几轮又是一块**没有参照的浮块**，量级那件事等于没说。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="turn"],
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="hero"]{
  --dtpl-tok-track:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
  background:var(--dtpl-tok-track);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-fg) 16%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg{
  height:100%;flex:none;
  /* 段之间的**断开**走内描边、不吃宽度——那条 2px 的下限是「占比再小也看得见」的全部依据。
     断开色取**轨道色**：带轨道的那两条尺里，缝读作「轨道露出来的一条」；步骤尺没有轨道，
     取同一档洗色（它落在面板上，效果就是「这里被切开了」）。取 --dtpl-panel-bg 是错的——
     那是个 3% 的透明色，压在段上等于没画，相邻两段会糊成一块（实测 generate→tool 就是这么糊的）。 */
  box-shadow:inset -1px 0 0 0 var(--dtpl-tok-track,color-mix(in srgb,var(--dtpl-fg) 10%,transparent));
}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg:last-child{box-shadow:none;}
/* 相位（用于步骤尺与轮块头尺，见 SessionTurns 的 stepSegments）。三段是**真实先后**：
   等首 token → 生成 → 工具。明度由这里给，且**三档都要压得过面板 3:1**（非文本对比度）。
   52 / 72 / 100 是量出来的**唯一解**：浅色主题里最浅那档要到 52% 才够 3:1（50% 是 3.11，
   再浅就不达标），最深那档已经贴着满墨，所以三档能拉开的全部空间只有中间那一段——
   实测 3.29 / 6.06 / 14.63（浅色）、5.14 / 8.53 / 15.28（深色）。
   注意**不要**为了「拉开明度」把最浅那档往下压：30/62/96 相邻确实更开（约 2.4:1），
   但 wait 掉到 1.87:1（浅色）——它就从「一档数据」变成了「一条看不见的轨道」，
   而这一页的口径是「量不到 ≠ 0」，最浅那档必须仍然看得见。

   **明度之外再加一条纹路通道**：那三档已经挤到极限，而纹路是**局部**的记号——真实步骤行里
   一段常常只有二三十像素宽，跨段比明度需要一个共同参照，单看一段时纹路比明度可靠。
   四类各一条纹路，按语义挑而不是按角度轮着来：
     · 等首 token ——**竖细线**：垂直于时间轴、细而密，读作「空转」；
     · 生成 ——**实心**：整页唯一一块「满」，它是参考，其余三类都带纹路；
     · 工具 ——**45° 斜纹**：另一个东西在跑；
     · 模型（拆不开）——**交叉网格**：竖线与斜纹叠在一起，正是「这两类分不出来」。
   纹路的两档**都要压过面板 3:1**（同上面那条：它是这一段的一部分，不是缝隙），所以每类
   只在自己的明度上往上取一档，最浅那条永远不低于该类原本的底色。
   底色一律走 --dtpl-fg 的透明度，深浅两皮因此自动成立，没有一个写死的灰。

   前三条**同时给尺下那串读数里的段记号**（.dtpl-tok-read-mark）：段名摊在整条下面、不在段的正下方，
   记号是它与灰阶之间唯一的桥，两处分家就等于教错。选择器写在一起是这件事的**唯一**保证——
   记号自己不带任何色值。抬头那条只有 work / idle 两段（「两个时长之比」，不分相位），
   这三条相位纹路真正命中的是**轮块头那串读数**；两处共用同一个组件与同一组选择器，所以不会分家。
   **模型**那张给的是图例里那枚小方块与轮块头读数里的记号，那些地方才有模型这一段，同源的理由一样。 */

[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="wait"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="wait"]{
  background:
    repeating-linear-gradient(90deg,
      color-mix(in srgb,var(--dtpl-fg) 66%,transparent) 0 1.5px,
      transparent 1.5px 4px),
    color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="generate"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="generate"]{background:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="tool"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="tool"]{
  background:
    repeating-linear-gradient(45deg,
      color-mix(in srgb,var(--dtpl-fg) 88%,transparent) 0 1.5px,
      transparent 1.5px 6px),
    color-mix(in srgb,var(--dtpl-fg) 72%,transparent);
}
/* 拆不开的模型段（通道没上报流，量不到首 token）：**交叉网格**。
   它整段都是模型时间、只是分不出等与生成；若只靠明度，读者会把它读成「生成」——而「生成」
   断言了「没有等待」。网格 = 竖线（等）+ 斜纹（工具）叠在一起，是「这两类分不出来」最直白的
   画法，而且它**独一份**：四类里只有它两个方向叠加，扫一眼不必比明度就能认出来。

   底色取 55% 而不是最深那档：**这是承重的**。纹路与底色是同一族的墨，若底色也是满墨，
   66% 的纹路压上去合成出来仍是满墨——整段读成一块实心，与「生成」一模一样（实测过）。
   底色留浅，深色的网格才画得出来；55% 压面板同样过 3:1。
     · 竖线与斜纹都取满墨：两向都要看得见，而它们相交处与单向处同色，网格才成其为网格。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="model"],
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-key[data-kind="model"]{
  background:
    repeating-linear-gradient(90deg,
      var(--dtpl-fg) 0 1.5px,
      transparent 1.5px 5px),
    repeating-linear-gradient(45deg,
      var(--dtpl-fg) 0 1.5px,
      transparent 1.5px 5px),
    color-mix(in srgb,var(--dtpl-fg) 55%,transparent);
}
/* 抬头那条：实心那段是「引擎工作」，浅的那段是没在算的时间（等输入、等外部、会话挂起）。
   浅档是**轨道里的一档数据**、不是轨道本身——它的职责是标出「工作之外那段时间有多长」，
   所以照占比环那枚轨道（16%）的先例取一档看得见的浅灰，而不按「数据段」的 3:1 要求它
   （那会让它重到与实心段抢眼）。12% 压面板只有 1.23:1，实测下来读成一条空白——
   「工作只占这么一点」这句话也就没了。
   **这两段不带纹路**：它们是「两个时长之比」，与上面那四类相位不是一族——抬头这条上没有相位
   可分，平涂才是它该有的样子。纹路一进来，读者就会去条上找「哪一段是等首 token」。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="work"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="work"]{background:color-mix(in srgb,var(--dtpl-fg) 84%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="idle"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="idle"]{background:color-mix(in srgb,var(--dtpl-fg) 26%,transparent);}
/* 尺下面的段名与数（TimeReads）。**这一段是承重的，不是装饰**：没有它，一条横贯整宽、大半是
   浅灰的条只能读成进度条（「进行到几成」），而这两段都是终值；轮块头那条没有它就只有形状没有数，
   「这一轮等了几秒、工具花了几秒」正是读者要拿去判断的两个数。
   名字**摊在整条下面**而不是对齐到各自那一段的正下方：两段的比例动辄 1:100（实测工作 6px /
   没在算 864px），段名塞不进自己那一段下面——图例那条示例尺能对齐，是因为它的份额是手写的
   3:5:3。抬头那条左端一项、右端一项：深的那段从左边起，浅的那段到右边止，位置本身也带一点指向。
   轮块头那条按先后从左排起（等首 token → 生成 → 工具）：几项是同一个问题的分解，摊到两端
   会被读成两件事。
   记号（.dtpl-tok-read-mark）是标签与灰阶之间唯一的桥：段名不在段下面，就得靠这枚小方块说
   「我说的是哪一条」。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-reads{
  display:flex;flex-wrap:wrap;gap:2px 16px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-ratio{
  display:flex;flex-direction:column;gap:6px;min-width:0;
}
/* 抬头那条只有两段、比例悬殊：一左一右摊开。轮块头那条不摊——它的几项是同一个问题的分解。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-ratio .dtpl-tok-reads{justify-content:space-between;}
/* 轮块头那串读数是尺的第二行：占满整行、紧贴尺下（行间距由块头那条 4px 的 row-gap 给）。
   它是标尺的读数，不是预览的同类——预览走 .dtpl-tok-turn-preview，字号与墨色都另有一档。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head > .dtpl-tok-reads{
  flex:1 1 100%;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-read{
  display:inline-flex;align-items:center;gap:5px;white-space:nowrap;
}
/* 段值走等宽 + 主墨：它与这一块其余读数同一个质地（标签 11px / 值等宽加粗），
   而**不**另起一套——段名说的就是上面那几个数，读者不该在这里学第二种字。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-read b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;
}
/* 段记号：几何与「一段」无关（尺上的段是满高的一块，记号是 9×10 的一小枚，与图例那枚同尺寸），
   所以两样都自己给。灰阶不在这里——见上面那四条 data-kind 规则。
   那条 1px 的段间断开（box-shadow）在 9px 的小块上只有害无益，一并关掉。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark{
  flex:none;width:9px;height:10px;box-shadow:none;
}
/* 三段尺的图例。形状编码没有图例就不是信息、是花纹，所以它必须挨着尺。
   它画的是一条**真的示例尺**——直接复用 TimeBar 那个组件，于是灰阶、纹路与段间断开都不可能与
   真尺脱节；三枚标签摊在各自那一段下面（flexGrow = 那一段的份额），顺序 / 明度 / 纹路 / 断开
   四件事一次说完。
   「模型（拆不开）」单列一行、带交叉网格：它**不是第四种相位**，是「相位分不出来」。它与「生成」
   同明度那一半若不给记号，读者会把它读成「生成」。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-legend{
  display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px 10px;margin:0 0 10px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-figure{
  display:flex;flex-direction:column;gap:4px;
  /* 示例尺自己一个宽度：它不表达量级（份额之和就是分母），只表达形状与顺序。
     宽度是**按最长的那个标签反推**出来的：标签要落在各自那一段正下方（见下），
     所以最窄的一段也得容得下「等首 token」。占比 30/114 的列在 232px 下是 61px，
     而那个标签实测约 48px——留出余量；再窄就只能截断标签，那就白标了。 */
  width:232px;flex:none;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-keys{
  display:flex;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
}
/* flex-basis:0 是**承重的**：只给 flexGrow 的话，摊的是**剩余**空间，而各标签的文字
   宽度本来就不一样，于是列宽不等于段宽——实测「生成」那个标签会偏到 15px 外，正好压在
   等首 token 与生成的分界线上，读起来像在说前一段。basis 归零后列宽就只由份额决定，
   标签中心才真的落在它那一段的下面。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-keys > span{
  flex-basis:0;
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 「模型（拆不开）」那一行。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-model{
  display:inline-flex;align-items:center;gap:5px;color:var(--dtpl-fg-2);
}
/* 「模型（拆不开）」那一枚小方块：**几何自己给，纹路不自己写**——它挂 data-kind="model"，
   取的是上面那条四类纹路里模型那一条（竖线 + 斜纹交叉），与真尺逐字同源。
   纹路自带底色，所以这里一个 background 都不写：写过一次就有第二份副本，改真尺时会漏掉这枚。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-key{
  display:inline-block;width:9px;height:12px;flex:none;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-say{
  margin-left:auto;color:var(--dtpl-fg-3);
}
/* 末尾两块分列：「轮间」与「轮次未知」是两件不同的事实（知道 vs 不知道），绝不并成一块；
   只剩一块时 auto-fit 让那一块占满整行。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-tail{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-top:10px;
}
/* 版面上的一层（SessionTokens 的 <Block>）：它就是 .dtpl-tok-col 的一个 flex 子项，自己不带
   任何盒模型——存在的理由是给整块一个落点，入场错峰的序号挂在这上面（见下面的 .dtpl-tok-col > *）。
   min-width:0 让里面的长模型名能折行，而不是把这条 flex 子项撑宽。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-block{display:block;min-width:0;}
/* 这一页的分区词：比浮窗那档（13px / 600）大一号、重一档。
   浮窗里它是卡片内部的小标题，周围有卡面与趋势图；这一页里它是**整块的名**，
   上下都是空白，该撑住场面。15px / 700 是量出来的：再大就与主角数字抢，
   再小就退回「又一个标签」。字重从 600 提到 700——分区词不是正文，是题，题该重。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-sec-title{
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:700;letter-spacing:.02em;
  margin:0 0 14px;
}
/* 这一页的四桶读数格：比浮窗那格（10px 14px 11px + 竖发丝分隔）宽松一档，
   且**去掉格与格之间的竖线**——四格是并排的四个独立读数（各自有标签 / 值 / 份额），
   被线连成一条带反而读成一组连续的量。去掉线之后靠间距分格（16px 的 gap）。
   它们仍住在抬头面板里，但**不是靠竖线连着面板**：把它们与上面的合计数字连起来的是
   那条横贯的分区线（见 .dtpl-tok-mix-band）。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-grid{
  gap:0 16px;
  border-top:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-stat + .dtpl-stat{border-left:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-stat{
  padding:16px 18px 14px;
}
/* 构成带里那四格的上下白另算：它们在面板内，上边接着命中率那一行（10px 就够），下边撑起
   面板的底缘，所以比通用那档再厚一点。会话时间那两个格不在面板里，维持上面那档。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-band .dtpl-stat{
  padding:10px 18px 20px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-stat:hover{
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  border-left:0;
}
/* 首次拉取的占位：与真内容同域（一页读数），高度给够，数据到达时页面不整体上跳。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-sk{height:220px;}

/* 入场：这一页的每个顶层块（抬头 / 构成 / 图表 / 明细 / 末尾两块）依次升起，错开半拍。
   配方就是浮窗正文用的那支 dtpl-rise，节奏统一；每块自己带 --dtpl-tok-i（见 SessionTokens 装配），
   块**重挂**才播（切会话 / 骨架换真块），15s 轮询刷新不重挂，所以不会反复重播。
   柱子另有自己的错峰（shared.ts 的 .dtpl-bars.is-anim），两支错峰叠起来是「先铺版、再上柱」。 */
@media (prefers-reduced-motion:no-preference){
  [data-plugin="dsh-tokbook"] .dtpl-tok-col > *{
    animation:dtpl-rise .26s cubic-bezier(.22,.68,.24,1) both;
    animation-delay:calc(var(--dtpl-tok-i,0) * 40ms);
  }
}

@media (max-width:640px){
  /* 子代理两格与逐行读数在窄处各改单列/两行：四列在窄屏会把名称压到只剩几个字。 */
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum .dtpl-stat + .dtpl-stat{border-left:0;border-top:1px solid var(--dtpl-border);}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-row{
    grid-template-columns:minmax(0,1fr) auto;
    grid-template-areas:"name name" "tokens share" "cost cost";
  }
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost{justify-self:start;}
  /* 窄屏：末尾两块改上下排列——并排时每块只剩半屏，四桶读数会折成一团。 */
  [data-plugin="dsh-tokbook"] .dtpl-tok-tail{grid-template-columns:minmax(0,1fr);}
  /* 两枚段名不再一左一右：窄处那一行放不下「引擎工作 5分55秒 没在算 14时00分」，
     space-between 会把它们推到两端各自折行，读成四项而不是两项。 */
  [data-plugin="dsh-tokbook"] .dtpl-tok-hero-ratio .dtpl-tok-reads{justify-content:flex-start;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-turn-head{padding-left:10px;padding-right:10px;}
  /* 抬头不改 padding（它从变量算），只把变量本身收窄——构成带那两条负边距跟着一起收。 */
  [data-plugin="dsh-tokbook"] .dtpl-tok-head{--dtpl-tok-head-pad:10px;}
  /* 内白住在 inner 上（见上面那条注释：竖向内白不能挂在格子上），所以窄屏也要改在它上面——
     写在外层 .dtpl-tok-steps 上只会再加 10px，两边合起来 28px。 */
  [data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner{padding-left:10px;padding-right:10px;}
  /* 步骤行的第一段改单列：身份一行、钱另起一行靠左。「第 N 步 + 时间 + 模型 + 金额」在窄处
     排不进一行，硬排的结果是身份被挤着折行、钱压在它上面。 */
  [data-plugin="dsh-tokbook"] .dtpl-tok-step{
    grid-template-columns:minmax(0,1fr);
    grid-template-areas:"id" "cost" "bar" "read";
  }
  [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost{justify-content:flex-start;}
  /* 读数那两簇在窄处自然上下堆叠（两簇加起来 660px，放不进窄屏那一行，flex 自己会折）。
     折了之后两簇各占整行、各自靠左，中间那条缝从 32px 收到 10px——竖着排的时候它与行距同义。 */
  [data-plugin="dsh-tokbook"] .dtpl-tok-step-read{gap:10px 0;}
}
/* 箭头翻转只是状态指示，reduce 下不要那 0.15s 的转动；整页的入场升起同理。 */
@media (prefers-reduced-motion:reduce){
  [data-plugin="dsh-tokbook"] .dtpl-tok-turn-cue{transition:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-col > *{animation:none;}
}
`
