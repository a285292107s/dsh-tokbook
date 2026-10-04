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
}
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
  display:flex;flex-direction:column;gap:18px;
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
/* 抬头 = 一块读数面板（1px 硬边框 + 3% 洗色 + 材质，与浮窗那块「读数面」同一配方）。
   面板里没有分区词：它自己就是这一页的主读数（四桶合计），下面那行才是它的参照带。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-head{
  display:flex;flex-direction:column;gap:8px;
  padding:14px 16px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
}
/* 旁注单独成行：分区词右端那条旁注是 nowrap 的，而这一页的两句都长、窄屏放不下。
   负的上边距是把分区词那 11px 的下边距收回来一点，句与标题仍是一组。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-note{
  margin:-5px 0 10px;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-foot{
  border-top:1px solid var(--dtpl-hairline);
  padding-top:10px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-foot .dtpl-tok-note{margin:6px 0 0;}

/* 四桶分段条：**同一条灰的四个明度档**（淡 = 复用，深 = 新产生），分类不借色相——本插件
   唯一的色相是品牌黄，它不外借给数据（见 tokens 第五节）。四段各自的名字与数就在它下面那
   四个读数格里，条只承担比例。
   条的下边框接上读数格的上边框：同一处不叠两条线，所以那一格不再画顶线。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-mix{
  display:flex;height:12px;
  border:1px solid var(--dtpl-border);
  background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix + .dtpl-grid{border-top:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-seg{height:100%;}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-seg[data-bucket="inputTokens"]{background:color-mix(in srgb,var(--dtpl-fg) 84%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-seg[data-bucket="cacheReadTokens"]{background:color-mix(in srgb,var(--dtpl-fg) 26%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-seg[data-bucket="cacheWriteTokens"]{background:color-mix(in srgb,var(--dtpl-fg) 58%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-seg[data-bucket="outputTokens"]{background:var(--dtpl-fg);}

/* 每轮两格小图（small multiples）：上格新增词元、下格缓存读取，共用同一列轮次与同一条轴线。
   两格各自归一（理由见 SessionTurns），所以**一格只有一把尺子**——上一版把两根不同刻度的柱并排
   在同一列里，读者会不由自主地比高度。
   整块图按轮数定宽：3 轮时是一张紧凑的小图，40 轮时铺满并退化成浮窗里那条细柱带。宽度有下限，
   一轮的会话里格头那句「合计 / 峰值」比图还宽，柱子不该缩到它下面去。
   柱形自己有宽度上限（见下 .dtpl-bar-fill）：柱宽不承载数据，轮数少时让它跟着列一起撑开，
   一列就成了 400px 宽的灰砖。整块图靠左——它跟分区词、旁注同一条左边缘，居中会从版面里飘出去。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-plot{
  display:flex;flex-direction:column;gap:16px;
  min-width:min(280px,100%);
  max-width:calc(var(--dtpl-slots,4) * 92px + 28px);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-bars{height:68px;margin-top:20px;}
/* 轴线贴着自己上面那格：16px 的格间距对「轴属于谁」太远，收回去 6px。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-trend-axis{margin-top:-6px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-panel{display:flex;flex-direction:column;}
/* 格头 = 这一格的纵轴：系列名（图例色块 + 名）+ 合计 + 峰值。三个数都在这，柱上不再画刻度。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-panel-k{
  display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;margin:0;
  font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-panel-v,
[data-plugin="dsh-tokbook"] .dtpl-tok-panel-k i{
  font-family:var(--dtpl-mono);font-size:10px;line-height:16px;font-weight:400;
  font-style:normal;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
}
/* 柱宽 = 列宽的 48%，并封顶 44px：柱与缝因此始终约 1:1。百分比管住「列被挤窄」（轮数多），
   44px 的硬上限管住「列很宽」——一轮的会话里那列有 250px 宽（图有 280px 的宽度下限），
   只有百分比的话柱会撑成一块 120px 宽的砖。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-bar-fill{width:min(48%,44px);margin:0 auto;}
/* 图例：格头那枚色块与它下面那格的柱子同色，两格**都取浮窗那张图的 45%**（柱高是这张图的正文，
   更淡过不了 3:1 非文本对比度——浅色主题下比 45% 更淡的灰根本到不了 3:1，所以这里不做「缓存那格
   更淡」那套：两格的区分靠格头那句名字，不靠明度）。峰值仍由 ledger 那套的 70% + 黄牌给出。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-swatch{
  flex:none;width:8px;height:8px;align-self:center;
  background-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}

/* 一轮一块。块身只给边框与洗色，**不给材质**：材质是页面级面板的配方，一屏几十块叠着上
   材质就成一片噪声。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turns{display:flex;flex-direction:column;gap:10px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn{
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
/* 块头整块可点；右端那枚箭头是唯一的开关提示。预览本来就长在块头上，收起时它仍在。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head{
  display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;
  width:100%;margin:0;padding:9px 12px;
  appearance:none;border:0;background:transparent;
  font:inherit;text-align:left;color:var(--dtpl-fg);cursor:pointer;
  transition:background .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head:hover{background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-k{flex:none;font-size:13px;line-height:20px;font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-cue{
  flex:none;margin-left:auto;align-self:center;
  font-size:10px;line-height:16px;color:var(--dtpl-fg-3);
  transition:transform .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head[aria-expanded="true"] .dtpl-tok-turn-cue{transform:rotate(180deg);}
/* 预览占满块头的第二行：提问一行、回答一行，都是单行省略（全文在 title 里）。
   颜色分档：预览文本是读数走 fg-2，只有回答前面那枚「↳」是装饰，走 fg-dim。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-preview{
  flex:1 1 100%;min-width:0;
  display:flex;flex-direction:column;
  font-size:11px;line-height:17px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-ask,
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-reply{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-reply::before{content:"↳ ";color:var(--dtpl-fg-dim);}

/* 步骤行沿用浮窗明细那条两列网格（左身份、右读数，金额各行的右缘落在同一条竖线上），
   只在行间补一条发丝线：一轮几十步时，光靠间距分行读不出「一步一行」。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-steps{padding:2px 12px 11px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps .dtpl-row + .dtpl-row{
  margin-top:0;padding-top:9px;
  border-top:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-id{
  display:flex;align-items:baseline;flex-wrap:wrap;gap:3px 8px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-no{
  font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-time{
  font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-model{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
}
/* 失败 / 压缩芯片：用**形**（描边小片）区分它们，色相只给真要看一眼的那一种（失败）。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-chip{
  flex:none;font-style:normal;font-size:10px;line-height:14px;font-weight:600;
  padding:0 4px;
  border:1px solid var(--dtpl-border);
  color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-chip[data-kind="failure"]{border-color:var(--dtpl-err);color:var(--dtpl-err);}
/* 「价格未知」的桶名是两行：「按 ¥0 计」压在名位里（同一个四字宽），所以它不吃金额列的对齐。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-step .dtpl-cost-k i{
  display:block;font-style:normal;font-size:9px;line-height:12px;
}
/* 一行的四桶：右列里的一条事实带（与块头那句同源，字号再收一档），允许折行。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-buckets{justify-content:flex-end;font-size:10px;line-height:15px;}
/* 末尾两块分列：「轮间」与「轮次未知」是两件不同的事实（知道 vs 不知道），绝不并成一块；
   只剩一块时 auto-fit 让那一块占满整行。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-tail{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-top:10px;
}
/* 首次拉取的占位：与真内容同域（一页读数），高度给够，数据到达时页面不整体上跳。 */
[data-plugin="dsh-tokbook"] .dtpl-tok-sk{height:220px;}

@media (max-width:640px){
  /* 窄屏：末尾两块改上下排列——并排时每块只剩半屏，四桶读数会折成一团。 */
  [data-plugin="dsh-tokbook"] .dtpl-tok-tail{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-tok-head,
  [data-plugin="dsh-tokbook"] .dtpl-tok-turn-head{padding-left:10px;padding-right:10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-steps{padding-left:10px;padding-right:10px;}
}
/* 箭头翻转只是状态指示，reduce 下不要那 0.15s 的转动。 */
@media (prefers-reduced-motion:reduce){
  [data-plugin="dsh-tokbook"] .dtpl-tok-turn-cue{transition:none;}
}
`
