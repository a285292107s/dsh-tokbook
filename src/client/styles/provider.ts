export const CSS_PROVIDER = `/* 用量明细 tab */
/* 这一页有三层，从上到下各管一件事：**分区词**（窗口 + 「用量」）领起并报出该窗口的**合计**；
   **窗口**是贴在分区词右端的作用域控件；**切法**（按模型 / 按工作区 / 按通道）是这一页**唯一**
   那条 tab 条，它下面才是数据。
   选择器语言全窗口共用（横排 + 竖发丝分隔 + 底部实条，见 overlay 片段）。**层级靠形与位**分开：
   切法是横贯全宽、带底线的 tab 条（页面的主结构），窗口是带「窗口」标签、贴在标题右端的小控件
   （与额度页「自动刷新」同形）——两条一模一样的 tab 条叠着会分不出哪个是「这一页」、哪个是「范围」。 */
/* 页头**固定两行**：第一行分区词 + 窗口控件，第二行窗口合计。合计单独占一整行是关键——
   它随窗口变宽变窄（四位数的词元更长），挤进第一行就会把窗口控件推来推去、并在「一行 / 两行」
   之间来回折行，下面整块跟着上下跳。固定两行之后页头高度与任何数字无关。 */
[data-plugin="dsh-tokbook"] .dtpl-usage-head{
  display:flex;flex-direction:column;gap:6px;
  margin:0 0 14px;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-head-top{
  display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-title{margin:0;}
/* 合计沿用总览 hero 的「事实带」词汇（同一串分隔符、同一档字号），两个 tab 的口径因此读起来
   是一句话；这里只补自己的行高与占位高度。 */
[data-plugin="dsh-tokbook"] .dtpl-usage-facts{min-height:19px;}
/* 合计的占位：与真事实带同高（骨架不画文字，所以给一条定宽的底）。
   换窗口时它顶在同一格上，页头因此不重排。 */
[data-plugin="dsh-tokbook"] .dtpl-usage-facts-sk{width:236px;min-height:19px;}
/* 错误态合计那一行的高度：留空比收掉好——收掉会让下面的错误块与切法条整体上移。 */
[data-plugin="dsh-tokbook"] .dtpl-usage-facts-empty{min-height:19px;}
/* 窗口控件：可见标签 + 24px 小选择器，不画自己的底线延伸。 */
[data-plugin="dsh-tokbook"] .dtpl-usage-scope{
  display:flex;align-items:center;gap:8px;flex:none;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-scope-k{
  color:var(--dtpl-fg-2);font-size:11px;line-height:16px;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-range-tabs{
  display:flex;flex:none;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab{
  flex:0 0 auto;
  position:relative;appearance:none;border:0;background:transparent;
  height:24px;padding:0 11px;
  font:inherit;font-size:11px;line-height:16px;font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab + .dtpl-range-tab{border-left:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-range-tab:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);}
/* 实条取墨色，不取品牌黄：黄这一屏只留给当前页、峰值与节徽记三处，第二层选择器一律墨色。 */
[data-plugin="dsh-tokbook"] .dtpl-range-tab.dtpl-range-active{
  color:var(--dtpl-fg);font-weight:600;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab.dtpl-range-active::after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
}
/* 切法还不知道时的占位条：与 .dtpl-bd-tab 同高，数据到达时这一行不跳。 */
[data-plugin="dsh-tokbook"] .dtpl-usage-cuts-sk{width:192px;height:29px;}
[data-plugin="dsh-tokbook"] .dtpl-providers{display:flex;flex-direction:column;gap:10px;}

/* 一张通道卡 = 一块读数面板，与总览的 hero / 四桶同源：外轮廓由 --dtpl-border 给、
   材质由 --dtpl-metal 给。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-card{
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
}
/* 卡头是一段**铭牌**：一条实线把它与卡身分开。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-head{
  display:flex;align-items:flex-end;justify-content:space-between;gap:16px;
  padding:11px 14px 10px;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-provider-id{
  display:flex;flex-direction:column;gap:2px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-title{
  display:flex;align-items:center;gap:6px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-name{
  color:var(--dtpl-fg);font-size:14px;line-height:20px;font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 标签下的 route key：账本的计费键，走等宽。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-key{
  font-family:var(--dtpl-mono);
  font-size:10px;
}
/* 计费性质：**用形区分，不用色相**。按量 = 描边芯片（一条通道的分类），订阅 = 实心墨芯片
   （这个数不是现金）。分类从不该由颜色承担——DSH 皮肤里 accent 本就等于墨色、换个皮肤又会变蓝；
   而这两个桶永远不许被混成一个「支出」。
   文字取 fg-2 不是 fg-3：它是一枚**要读的词**（这个数是按量还是订阅）。层级由**形**给
   （描边 vs 实心），不由墨色深浅给。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-bill{
  flex:none;display:inline-flex;align-items:center;
  height:15px;padding:0 5px;
  border:1px solid var(--dtpl-border);
  font-size:10px;line-height:13px;font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-provider-bill[data-billing="subscription"]{
  border-color:var(--dtpl-fg);
  background:var(--dtpl-fg);color:var(--dtpl-card);
}
/* 卡头这一段是**信息**（请求 / 压缩 / 没上报用量 / 价格未知的模型），不是装饰：墨色取 fg-2。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-meta{
  color:var(--dtpl-fg-2);font-size:11px;line-height:16px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-nums{
  display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:none;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-tokens{
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg);font-size:19px;line-height:25px;font-weight:600;
  letter-spacing:-.01em;font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 金额：与总览同一套口径——实际支出走墨色 + 600，订阅价值走次要色 + 400。
   区分由字重与「订阅价值」这个名字承担，不借颜色。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-cost{
  display:flex;flex-direction:column;align-items:flex-end;gap:1px;
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg-2);font-size:12px;line-height:18px;font-weight:400;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-spend{font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-provider-value{color:var(--dtpl-fg-2);font-weight:400;font-size:10px;line-height:15px;}
/* 模型行副行（请求数 · 金额）是读数：fg-2，现金金额另走主墨色 600（见 ledger 的 dtpl-cash-amt）。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-model-sub{
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg-2);font-size:11px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 模型行自带「发丝线 + 上下间距」（.dtpl-row + .dtpl-row，见 ledger 片段），这里**不再**叠
   gap、也不再补 border-top——两处都算间距会让卡内行距翻倍，两条线会挨在一起。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-models{
  display:flex;flex-direction:column;
  padding:9px 14px 11px;
}
[data-plugin="dsh-tokbook"] .dtpl-sk-card{height:132px;}

/* 窄 sheet：页头那两块各占一行且**行数不随内容变**——窗口控件在宽屏贴右端，窄处必然放不下
   （标题 + 控件 > 正文宽），所以直接钉成整行，而不是随窗口词长短时而折、时而不折。
   合计改两列网格：四个事实恒定两行，字与字之间靠 gap 分开（窄处那枚分隔点已被撤掉，见 shared），
   所以不会出现空格子。 */
@media (max-width:640px){
  [data-plugin="dsh-tokbook"] .dtpl-usage-head-top{justify-content:flex-start;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-scope{flex:0 0 100%;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-facts{
    display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 10px;
  }
}
`
