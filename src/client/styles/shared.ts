export const CSS_SHARED = `/* 只给读屏的文本：视觉上不占位，但留在无障碍树里。
   用途是**列的意义**——读屏读不到表头与单元格的对应关系，所以每个格子自己把列名带上
   （「通道 commandcode」「词元 830.3M」），读出来才是一句说得通的话。 */
[data-plugin="dsh-tokbook"] .dtpl-sr{
  position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;
}

/* 选中态：品牌黄——选中本身就带墨色文字压在上面，所以恒定黄在这里成立。 */
[data-plugin="dsh-tokbook"] .dtpl-body ::selection{
  background:color-mix(in srgb,var(--dtpl-brand) 55%,transparent);
}

/* 窄屏 */
@media (max-width:640px){
  [data-plugin="dsh-tokbook"].dtpl-overlay{padding:0;align-items:flex-end;}
  [data-plugin="dsh-tokbook"] .dtpl-card{
    width:100%;height:min(94dvh,94vh);
    box-shadow:var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.28)),
      inset 0 0 0 1px var(--dtpl-border);
  }
  [data-plugin="dsh-tokbook"] .dtpl-head{padding:14px 16px 10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tabs{padding:0 16px;}
  /* 四个 tab 塞不进手机宽度：让行横向滚动，而不是把最后一个裁出卡片。 */
  [data-plugin="dsh-tokbook"] .dtpl-tabs{overflow-x:auto;scrollbar-width:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tabs::-webkit-scrollbar{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tab{flex:0 0 auto;}
  [data-plugin="dsh-tokbook"] .dtpl-body{padding:12px 16px 14px;}
  [data-plugin="dsh-tokbook"] .dtpl-foot{padding:10px 16px 12px;}
  /* hero 上下两块在窄 sheet 上改为堆叠。金额块整块靠左，但块内不被拉伸：两行仍按最宽那行的宽度
     对齐，所以金额右端依然成列。 */
  [data-plugin="dsh-tokbook"] .dtpl-hero-top{flex-direction:column;align-items:flex-start;gap:8px;}
  /* 事实带在窄处换行：分隔点让位给间距——行首不会孤零零出现一个「·」。 */
  [data-plugin="dsh-tokbook"] .dtpl-hero-facts{flex:1 1 auto;gap:4px 10px;}
  [data-plugin="dsh-tokbook"] .dtpl-hero-facts i{display:none;}
  /* 词元构成：四个桶在手机宽度上排不下，折成 2×2。框与分隔线跟着折：第二行补一条横向分隔，
     行首那一格去掉竖分隔——否则分隔线会漂在格子外面。 */
  [data-plugin="dsh-tokbook"] .dtpl-grid,
  [data-plugin="dsh-tokbook"] .dtpl-grid-3{grid-template-columns:repeat(2,minmax(0,1fr));}
  [data-plugin="dsh-tokbook"] .dtpl-stat:nth-child(odd){border-left:0;}
  [data-plugin="dsh-tokbook"] .dtpl-stat:nth-child(n+3){border-top:1px solid var(--dtpl-border);}
  /* 趋势图的每柱数值标签在手机宽度上必然互相压字。窄处只留峰值那一个标签（它是这张图的信息点），
     其余柱值仍在自己的 title 里，节末那行合计照旧说明总量与峰值——不是把数值藏起来，
     是不让它叠成一团。 */
  [data-plugin="dsh-tokbook"] .dtpl-bar-label:not(.is-peak){display:none;}
  /* 轴上的日期比柱子还挤：14 格摊下来每格只有约 20px，而「10/10」要 28px——所以窄处隔 4 格
     留一个（每 4 格因此有约 80px，宽裕）。**峰值那一天永远留下**（它是这张图的信息点，
     位置本身说不清是哪一天）。
     收掉的是重复的位置信息，不是日期：留下的那几个仍然等距，读得出「哪一段是几号」。
     峰值紧邻的那一格必须让位：保留格恰好落在峰值前一天时，两个日期会叠在一起（实测踩到过）。 */
  [data-plugin="dsh-tokbook"] .dtpl-trend-axis span:not(:nth-child(4n+1)):not(.is-peak){visibility:hidden;}
  [data-plugin="dsh-tokbook"] .dtpl-trend-axis span:has(+ .is-peak){visibility:hidden;}
  /* 明细表：窄处一张两列的表塞不下（数字列会把身份列压到放不下模型名与目录）。按价格表的先例：
     **列头收掉**（它在窄处不再指向任何一列），行改成单列堆叠，数字从「右上竖排」改为
     「身份下面横排一行」。 */
  [data-plugin="dsh-tokbook"] .dtpl-bd-cols{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-bd-cols,
  [data-plugin="dsh-tokbook"] .dtpl-row{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-model-nums{
    flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:12px;
    margin-top:5px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-val{margin-right:auto;}
  /* 明细的两个子 tab：窄 sheet 是触控形态，而这一行是切换这一节视图的**唯一**入口，
     所以给足 44px——与价格表展开钮同一条规矩。 */
  [data-plugin="dsh-tokbook"] .dtpl-bd-tab{
    min-height:44px;padding:13px 16px;
  }
  /* 关闭钮是浮窗**唯一**的显式退出（Escape 不算指针手段），所以窄 sheet 上给足 44px 热区。
     字形不动（仍是 16px 的 ✕）——触控与鼠标的差别是热区，不是这个符号该画多大。 */
  [data-plugin="dsh-tokbook"] .dtpl-close{
    width:44px;height:44px;
  }

  [data-plugin="dsh-tokbook"] .dtpl-doc-facts{grid-template-columns:1fr;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-buckets{grid-template-columns:1fr;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-gap{grid-template-columns:1fr;}

  /* 订阅额度的用量摘要格：窄处改单列并让分隔线跟着折（竖线换横线），
     否则行首那格的左边框会贴在框的左边线上。 */
  [data-plugin="dsh-tokbook"] .dtpl-quota-stats{grid-template-columns:1fr;}
  [data-plugin="dsh-tokbook"] .dtpl-quota-stat + .dtpl-quota-stat{
    border-left:0;border-top:1px solid var(--dtpl-border);
  }

  /* 通道卡头在窄处改堆叠：合计数字不再和通道名抢同一行。金额两行也跟着改左对齐——
     堆叠之后它们不再与右侧的模型数字成列，右对齐就只剩「缩在后面」这一种效果。 */
  [data-plugin="dsh-tokbook"] .dtpl-provider-head{
    grid-template-columns:minmax(0,1fr);row-gap:8px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-provider-nums{align-items:flex-start;}
  [data-plugin="dsh-tokbook"] .dtpl-provider-cost{align-items:flex-start;}

  /* 价格表：主语行在窄处折成**一列**——两列会把 route key 与模型串都截成「deepseek-o…」，
     而这一行存在的全部意义就是把那两条完整读出来。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-pick{grid-template-columns:minmax(0,1fr);column-gap:0;}
  [data-plugin="dsh-tokbook"] .dtpl-price-input{text-align:left;}
  /* 价的那张表在窄处折成**一段一块**：四档价并排塞不进窄 sheet 的内容列，所以生效范围
     独占一行、四档价落到它下面两行两列（2×2）。这里必须带上 .dtpl-price-detail 这一层，
     否则压不住 pricing 片段里那条只带 [data-plugin] 的基规则。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cols,
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-row{
    grid-template-columns:repeat(2,minmax(0,1fr));
    row-gap:8px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cols-k{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cols{display:none;}
  /* 生效范围那一格横跨两列，四档价因此从它的下一行起排。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-scope{grid-column:1 / -1;padding-right:0;}
  /* 幽灵行在窄处回到整宽：表已经折成一列，网格的第一列不再是「生效范围」那一格。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-addrow{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-add-slot{grid-column:1 / -1;justify-self:stretch;}
  /* 列头在窄处不再指向任何一列（它们被上面那条 display:none 收掉了），所以格名自己回来。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cell-k{display:block;}
  /* 窄处数字改左对齐（上面那条），格名也要跟着左对齐才守在同一条左缘上。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cell-k{
    text-align:left;padding-left:var(--dtpl-cell-pad-x);padding-right:var(--dtpl-cell-pad-x);
  }
  /* 一天里谁在生效：窄处标签那一列收窄（最长的是「周一至周五 09:00–12:00」，截断即可，
     它是索引不是读数），把宽度让给 24 格。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-day-row{grid-template-columns:minmax(0,88px) minmax(0,1fr);column-gap:8px;}
  /* 年历的一段假期在窄处要留在**一行**里：两个日期格与字号收窄、天数那一列也收窄——
     这样「8 天 删除」不必折到第二行去，一年七八段不至于变成十四五行的长条。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date{width:100px;font-size:var(--dtpl-fs-body);}
  [data-plugin="dsh-tokbook"] .dtpl-price-cal-days{min-width:40px;}
}

/* 动效（共享 keyframes；尊重 reduced motion） */
@media (prefers-reduced-motion:no-preference){
  [data-plugin="dsh-tokbook"].dtpl-overlay{animation:dtpl-fade .2s ease-out;}
  /* 卡片弹入：先缩到 96% 再回弹——比纯 translateY 多一层「被按了一下」的质感，
     与按钮的沉 1px 是同一套机件语言（按下去、弹回来）。 */
  [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-pop .24s cubic-bezier(.26,.7,.24,1);}
  [data-plugin="dsh-tokbook"] .dtpl-bar-fill{transform-origin:bottom;}
  /* 柱子入场：柱高本身就是这张图的读数，所以只让**读数长出来**，数值标签一律不动。
     .is-anim 静态挂在图区上（数据刷新不重挂元素，CSS 动画不会因重渲染重播；
     重挂只发生在「这一屏刚打开」，那时重播正是想要的）。错峰由柱上的 --dtpl-i 给出：
     从左往右按 12ms 一步扫过去，像仪表逐列上电；--dtpl-offset 是**整格**的起手（词元页的
     缓存读那格晚半拍，两格不同时长成一条线），没给就是 0。 */
  [data-plugin="dsh-tokbook"] .dtpl-bars.is-anim .dtpl-bar-fill{animation:dtpl-bar-grow .2s cubic-bezier(.26,.7,.24,1) both;animation-delay:calc((var(--dtpl-offset,0) + var(--dtpl-i,0)) * 12ms);}
  /* 零刻度与自己的柱同拍出现：基线上那一排刻度也是读数的一部分。 */
  [data-plugin="dsh-tokbook"] .dtpl-bars.is-anim .dtpl-bar.is-zero::after{animation:dtpl-fade .2s both;animation-delay:calc((var(--dtpl-offset,0) + var(--dtpl-i,0)) * 12ms);}
  /* 数据变化时柱高滑到新值（rescan 补进来的天、当天数字长大），标签锚点同拍跟住；
     悬停的明度/墨色反馈也走这条过渡。入场那下靠动画，不靠这条过渡。 */
  [data-plugin="dsh-tokbook"] .dtpl-bar-fill{transition:height .28s cubic-bezier(.26,.7,.24,1),background-color .12s ease;}
  [data-plugin="dsh-tokbook"] .dtpl-bar-label{transition:bottom .28s cubic-bezier(.26,.7,.24,1),color .12s ease;}
  /* tab 切换 / 数据到达：正文整块升起一层——壳（卡片）弹一下，内容跟着落定，两者错半拍。
     只在子元素**重挂**时播（tab 切换、骨架换真块）；轮询刷新不重挂，不会重播。 */
  [data-plugin="dsh-tokbook"] .dtpl-body > *{animation:dtpl-rise .24s cubic-bezier(.26,.7,.24,1) both;}
  /* hero 内容：数字与读数格比壳晚半拍落——壳先弹出来，内容再落定，
     读的人看到的是「卡片出现了，数据跟着进来」而不是一起闪。 */
  [data-plugin="dsh-tokbook"] .dtpl-hero > :not(.dtpl-hero-art){animation:dtpl-rise .26s cubic-bezier(.26,.7,.24,1) both;animation-delay:.06s;}
  /* 描边环的指针扫入：弧从 12 点起算画到自己的读数，弧长由 TSX 以 --dtpl-arc 随元素给出。 */
  [data-plugin="dsh-tokbook"] .dtpl-share-ring-arc{animation:dtpl-draw .45s cubic-bezier(.3,.6,.3,1) both;}
}
@media (prefers-reduced-motion:no-preference) and (max-width:640px){
  /* sheet 习语：居中弹窗的 pop 动画是向上平移 8px，对贴底全宽 sheet 无意义——改为从视口下方滑入。 */
  [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-sheet .22s cubic-bezier(.32,.72,0,1);}
}
@keyframes dtpl-fade{from{opacity:0}}
@keyframes dtpl-rise{from{opacity:0;transform:translateY(6px)}}
@keyframes dtpl-bar-grow{from{transform:scaleY(0)}}
@keyframes dtpl-draw{from{stroke-dashoffset:var(--dtpl-arc,0)}}
@keyframes dtpl-width-in{from{width:0}}
@keyframes dtpl-pop{from{opacity:0;transform:translateY(8px) scale(.96)}}
@keyframes dtpl-sheet{from{transform:translateY(100%)}}
@keyframes dtpl-rotate{to{transform:rotate(360deg)}}
@keyframes dtpl-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes dtpl-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes dtpl-refresh-pop{
  0%{transform:scale(1)}
  40%{transform:scale(.82) rotate(-12deg)}
  70%{transform:scale(1.12) rotate(4deg)}
  100%{transform:scale(1)}
}
/* 常驻类动画在 reduce 分支里逐个关。**两条「量在变」的填充也在内**（额度条、表盘）：
   它们是唯一允许的宽度 / 描边动画，但「量变了」这件事数字本身已经说清，reduce 用户不该看到。 */
@media (prefers-reduced-motion:reduce){
  [data-plugin="dsh-tokbook"] .dtpl-bars.is-anim .dtpl-bar-fill,
  [data-plugin="dsh-tokbook"] .dtpl-bars.is-anim .dtpl-bar.is-zero::after,
  [data-plugin="dsh-tokbook"] .dtpl-bar-fill,
  [data-plugin="dsh-tokbook"] .dtpl-bar-label,
  [data-plugin="dsh-tokbook"] .dtpl-body > *,
  [data-plugin="dsh-tokbook"] .dtpl-share-ring-arc,
  [data-plugin="dsh-tokbook"] .dtpl-sk,
  [data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot,
  [data-plugin="dsh-tokbook"] .dtpl-spin,
  [data-plugin="dsh-tokbook"] .dtpl-price-add-ghost,
  [data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill,
  [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-fill,
  [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{animation:none;transition:none;}
}

/* 触感：所有按钮按下一律沉 1px——机件的手感，不借动画（无过渡，瞬时状态）。
   停用的按钮不参与。 */
[data-plugin="dsh-tokbook"] button:not(:disabled):active{transform:translateY(1px);}
`
