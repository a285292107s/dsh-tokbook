export const CSS_SHARED = `/* 面板材质是**一条**配方（--dtpl-panel-bg + --dtpl-metal），不为深色皮肤单独补一层提亮
   ——那样会让同一块面板在两个 tab 里深浅不同。 */

/* 只给读屏的文本：视觉上不占位，但留在无障碍树里。
   用途是**列的意义**——读屏读不到表头与单元格的对应关系，所以每个格子自己把列名带上
   （「通道 commandcode」「词元 830.3M」），读出来才是一句说得通的话。 */
[data-plugin="dsh-tokbook"] .dtpl-sr{
  position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;
}

/* 选中态：品牌黄。它是"料"——选中本身就带墨色文字压在上面，所以恒定黄在这里成立。 */
[data-plugin="dsh-tokbook"] .dtpl-body ::selection{
  background:color-mix(in srgb,var(--dtpl-brand) 55%,transparent);
}

/* 窄屏 */
@media (max-width:640px){
  /* 底部抽屉：主动选择，而不是半吊子的居中 94dvh 对话框。全宽、贴底——方舟语言里没有
     圆角，所以这里也不再有「只圆上角」这条移动端习语。 */
  [data-plugin="dsh-tokbook"].dtpl-overlay{padding:0;align-items:flex-end;}
  [data-plugin="dsh-tokbook"] .dtpl-card{
    width:100%;height:min(94dvh,94vh);
    box-shadow:var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.28)),
      inset 0 0 0 1px var(--dtpl-border);
  }
  [data-plugin="dsh-tokbook"] .dtpl-head{padding:14px 16px 10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tabs{padding:0 16px;}
  /* 五个 tab 塞不进手机宽度：让行横向滚动，而不是把最后一个裁出卡片。 */
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
  /* 轴上的日期同样挤（14 格每格放不下「9/10」）。窄处隔一格留一个（偶数格收掉），
     **峰值那一天永远留下**（它是这张图的信息点，位置本身说不清是哪一天）。
     收掉的是重复的位置信息，不是日期。 */
  [data-plugin="dsh-tokbook"] .dtpl-trend-axis span:nth-child(even):not(.is-peak){visibility:hidden;}
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
     所以给足 44px——与价格表展开钮同一条规矩，同一张面板里不该有两种标准。 */
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
    flex-direction:column;align-items:stretch;gap:8px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-provider-nums{align-items:flex-start;}
  [data-plugin="dsh-tokbook"] .dtpl-provider-cost{align-items:flex-start;}

  /* 价格表：选择带在窄处把标签压窄一点，下拉多留一点宽度给 route key 与模型串。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-pick{padding:8px;}
  [data-plugin="dsh-tokbook"] .dtpl-price-pick-row{column-gap:8px;}
  [data-plugin="dsh-tokbook"] .dtpl-price-input{text-align:left;}
  /* 费率列在桌面是四格定宽、紧挨成一簇，窄处折成 2×2：四格并排塞不进窄 sheet 的内容列。
     这里必须带上 .dtpl-price-seg 这一层，否则压不住 pricing 片段里那条只带 [data-plugin] 的基规则。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-seg .dtpl-price-rates{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
  /* 窄处数字改左对齐（上面那条），格名也要跟着左对齐才守在同一条左缘上：桌面那套是
     「格名与数字结束在同一边缘」，在这里两个都反过来。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-seg-rates .dtpl-price-cell-k,
  [data-plugin="dsh-tokbook"] .dtpl-price-slot-rates .dtpl-price-cell-k{
    text-align:left;padding-left:var(--dtpl-cell-pad-x);padding-right:var(--dtpl-cell-pad-x);
  }
  /* 卡片缩进（--dtpl-slot-indent，时段卡与那条幽灵行共用）收到 29px：桌面那一列是 41px 时，
     卡的内容盒正好落在基准价四档价的左缘上；窄处四档价折成 2×2 撑满整宽，这条对齐不再成立，
     让位只剩它的另一个用途——给栅栏（轨 + 圆点）那一列留位置，所以收到能容下栅栏的 29px。
     窄处轨与 7px 实心点已经贴在一起，挖洞只会把轨咬掉一截、露出卡边的亮缝，所以窄屏不用那条挖洞渐变。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-sec{--dtpl-slot-indent:29px;}
  [data-plugin="dsh-tokbook"] .dtpl-price-slot-rail{width:6.5px;}
  [data-plugin="dsh-tokbook"] .dtpl-price-slots-spine{
    left:6.5px;
    background:linear-gradient(180deg,transparent,var(--dtpl-rail-ink) 16px,
      var(--dtpl-rail-ink) calc(100% - 20px),transparent);
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-slot-dot{left:4.5px;}
  [data-plugin="dsh-tokbook"] .dtpl-price-slot-stub{left:11.5px;width:0;}
  /* 时段卡上的复制/删除不再靠悬停（触控没有悬停）。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-slot-actions{opacity:1;}
  /* 段的身份行要折行：右轨现在装着「当前生效」芯片 + 段自己的复制/删除，而左边是序号 +
     最小 150px 的生效时刻——窄 sheet 一行放不下。折行后右轨（margin-left:auto）自己落第二行靠右。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-seg-line{flex-wrap:wrap;row-gap:4px;}
}

/* 动效（共享 keyframes；尊重 reduced motion） */
@media (prefers-reduced-motion:no-preference){
  [data-plugin="dsh-tokbook"].dtpl-overlay{animation:dtpl-fade .16s ease-out;}
  [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-pop .16s ease-out;}
  [data-plugin="dsh-tokbook"] .dtpl-bar-fill{transform-origin:bottom;}
  /* 柱子入场：柱高本身就是这张图的读数，所以只让**读数长出来**，数值标签一律不动。
     .is-anim 由 TrendPlot 挂载时加上、animationend 一到就摘掉——此后重渲染不再有动画
     （真实数据切换时重播会让「数据变了」和「这一屏刚打开」混成同一件事）。 */
  [data-plugin="dsh-tokbook"] .dtpl-bars.is-anim .dtpl-bar-fill{animation:dtpl-bar-grow .18s cubic-bezier(.22,.68,.24,1) both;}
}
@media (prefers-reduced-motion:no-preference) and (max-width:640px){
  /* sheet 习语：居中弹窗的 pop 动画是向上平移 8px，对贴底全宽 sheet 无意义——改为从视口下方滑入。 */
  [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-sheet .22s cubic-bezier(.32,.72,0,1);}
}
@keyframes dtpl-fade{from{opacity:0}}
@keyframes dtpl-bar-grow{from{transform:scaleY(0)}}
@keyframes dtpl-pop{from{opacity:0;transform:translateY(8px) scale(.98)}}
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
/* 常驻类动画在 reduce 分支里逐个关。**三条「量在变」的填充也在内**（占比条、额度条、表盘）：
   它们是唯一允许的宽度 / 描边动画，但「量变了」这件事数字本身已经说清，reduce 用户不该看到。 */
@media (prefers-reduced-motion:reduce){
  [data-plugin="dsh-tokbook"] .dtpl-bars.is-anim .dtpl-bar-fill,
  [data-plugin="dsh-tokbook"] .dtpl-sk,
  [data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot,
  [data-plugin="dsh-tokbook"] .dtpl-spin,
  [data-plugin="dsh-tokbook"] .dtpl-price-slot-actions,
  [data-plugin="dsh-tokbook"] .dtpl-price-add-ghost,
  [data-plugin="dsh-tokbook"] .dtpl-model-bar-fill,
  [data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill,
  [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-fill,
  [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{animation:none;transition:none;}
}
`
