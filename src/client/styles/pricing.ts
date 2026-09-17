/** styles.ts 片段：pricing。由 `injectStyles` 按序拼接，必须排在 shared 之前（窄屏段覆盖这里的高度）。 */
export const CSS_PRICING = `
[data-plugin="dsh-tokbook"] .dtpl-price-sec{display:flex;flex-direction:column;gap:14px;}
[data-plugin="dsh-tokbook"] .dtpl-price-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-search{
  flex:1;min-width:0;height:28px;padding:0 10px;
  border:1px solid var(--dtpl-border);background:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:12px;
}
/* 工具栏搜索框是全窗口唯一 placeholder-only 的字段：placeholder 就是它唯一可见的名字，所以墨色取 fg-2 而不是三级色。 */
[data-plugin="dsh-tokbook"] .dtpl-price-search::placeholder{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-chip{
  appearance:none;flex:none;height:28px;padding:0 10px;
  display:inline-flex;align-items:center;gap:6px;
  border:1px solid var(--dtpl-border);background:transparent;
  color:var(--dtpl-fg-2);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-chip:hover{color:var(--dtpl-fg);}
/* 筛选器开着 = 这张表被过滤了，走 amber 边框 + warn-ink 文字（裸 warn 作正文对比度不足）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-chip.is-on{
  color:var(--dtpl-warn-ink);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
  background:color-mix(in srgb,var(--dtpl-warn) 10%,transparent);
}
/* 事实带 + 图例同处一小节：带报这张表**现在是什么样**，图例说那四个数字**是什么**。
   带本身走跨 tab 共用的「一串事实」词汇（.dtpl-hero-facts，见 ledger 片段），价格表只多一条：
   「价格未知」那一项染 warn-ink——它是这张表上唯一要动手的地方。
   b 也要单独指一次：.dtpl-hero-facts b 把数字按主墨色给了（那份规则的优先级与本条相同，
   而 pricing 片段在 ledger 之后拼接，所以这里赢）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-read{display:flex;flex-direction:column;gap:6px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-fact-unknown,
[data-plugin="dsh-tokbook"] .dtpl-price-fact-unknown b{color:var(--dtpl-warn-ink);}
/* 一次性图例：解释「—」的含义，说一遍，不每行都说。 */
[data-plugin="dsh-tokbook"] .dtpl-price-legend{
  margin:0;font-size:11px;line-height:17px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-legend b{color:var(--dtpl-warn-ink);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-price-cards{display:flex;flex-direction:column;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-price-card{
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
  overflow:hidden;
}
/* 卡头两行：**身份行**（折叠钮那一块，整块可点）与**事实行**（这条通道自己的读数）。
   默认只有第一条通道展开，所以这个头往往就是读者看到的全部——它得自己说清「多大、有没有洞」。
   hover 洗色只挂在可点的那一块上（.dtpl-price-fold），贴边的内边距留给它。 */
[data-plugin="dsh-tokbook"] .dtpl-price-head{
  display:flex;align-items:flex-start;gap:8px;
  padding:7px 10px 7px 8px;border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-price-card[data-collapsed="true"] .dtpl-price-head{border-bottom:0;}
/* 折叠钮是上下两块：身份行（route key 是唯一不可预测的值，只截它自己）与事实行。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fold{
  appearance:none;border:0;background:transparent;text-align:left;
  flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;
  padding:3px 4px;
  font:inherit;color:inherit;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fold:hover{background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);}
/* 身份行整体换行而不是压碎名字：名字与 key 都留着，放不下时 key 让位到下一行。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fold-top{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;row-gap:2px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-caret{flex:none;width:10px;color:var(--dtpl-fg-3);font-size:9px;}
[data-plugin="dsh-tokbook"] .dtpl-price-label{flex:none;font-size:13px;line-height:20px;font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-key{
  flex:0 1 auto;min-width:0;
  font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 计费性质切换：全窗口唯一的「当前项」语言——横排 + 竖发丝分隔 + 底部实条（窗口 tab 条、总览子 tab 同款）。 */
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

/* 费率格的唯一度量，定义在 tab 根上，表格与抽屉共用。
   --dtpl-rate-w 由费率能是什么决定，不是今天的数字：最长 8 字符（0.003625 这类历史价）在
   12px 等宽下 52.8–57.6px，加两侧 7px 内边距与 2px 边框，取 74px 覆盖最宽的那档字体。
   数字必须等宽（见 .dtpl-price-input / .dtpl-price-value）：比例体让同位数字错开，固定列就失去可比性。
   --dtpl-cell-pad-x 与列头共享：列头必须和下面的数字结束在同一边缘。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sec{
  --dtpl-cell-pad-x:7px;
  --dtpl-rate-w:74px;
  --dtpl-rate-gap:6px;
  --dtpl-rates-w:calc(4 * var(--dtpl-rate-w) + 3 * var(--dtpl-rate-gap));
  --dtpl-reqs-w:44px;
}

/* 每行是自己的网格，轨道与上方列头相同：身份（伸展）| 请求数 | 四个固定费率列 | 展开槽。
   身份是唯一放不可预测文本的列，所以只有它伸缩、只有它会截断。
   展开槽 32px 与 .dtpl-price-more 的命中区必须一起改（列宽小于控件会把控件压回去）。
   请求数是列而不是身份列里的一句话：它是 host 排这张表的键，缩进可截断的文本里就读不到（见 .dtpl-price-reqs）。
   第一格 minmax(32px,auto) 是这一行**唯一的高度来源**（展开钮 32px，窄屏 44px），所以行高与有没有判定带无关。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cols,
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  display:grid;
  /* 请求数列 minmax(44px,max-content)：44px 是常见位数的下限，位数再多也不截断——轨道跟着长，让位的仍是身份列。 */
  grid-template-columns:minmax(0,1fr) minmax(var(--dtpl-reqs-w),max-content) var(--dtpl-rates-w) 32px;
  column-gap:10px;align-items:center;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cols{
  padding:6px 10px 4px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-col-id{padding-left:0;}
/* 列头与它下面那一列结束在同一条竖线上——这是列头存在的全部意义。 */
[data-plugin="dsh-tokbook"] .dtpl-price-col-reqs{text-align:right;}
[data-plugin="dsh-tokbook"] .dtpl-price-cols .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);
}
/* 标签与数值精确共享右边缘：否则列头结束在格子边框，数字却结束在内侧 7px 处。 */
[data-plugin="dsh-tokbook"] .dtpl-price-col-rate{
  text-align:right;padding-right:var(--dtpl-cell-pad-x);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  grid-template-rows:minmax(32px,auto);
  min-height:32px;padding:4px 10px;border-top:1px solid var(--dtpl-hairline);
  row-gap:2px;
  scroll-margin-block:56px;
  cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-row:first-child{border-top:0;}
/* 整行是展开价段的热区（行尾 ▸ 是它的键盘可达形态），所以它给 hover 反馈；行内文字仍可拖选。 */
[data-plugin="dsh-tokbook"] .dtpl-price-row:hover{background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);}
/* 行状态靠同一条约定区分：墨色侧条 =「未保存」、中性抬升 =「已展开」、宿主色环 =「焦点」。
   侧条取墨色不取强调色：未落盘是状态，不该借一个换皮肤会变蓝的身份色。 */
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-dirty="true"]{
  background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);
  box-shadow:inset 2px 0 0 var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-open="true"]{
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
/* 焦点环跟随宿主 --dtpl-accent：焦点是系统信号，不跟这套视觉语言抢风格。 */
[data-plugin="dsh-tokbook"] .dtpl-price-row:focus-within{
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-accent) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-dirty="true"]:focus-within{
  box-shadow:inset 2px 0 0 var(--dtpl-fg),
    inset 0 0 0 1px color-mix(in srgb,var(--dtpl-accent) 45%,transparent);
}
/* 身份 :: overflow:hidden 让这一格在网格里的自动最小宽度变成 0，省略号才是真的
   （否则网格项被内容顶宽、把右边的列挤出卡片）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-title{
  display:block;min-width:0;
  font-size:12px;line-height:16px;font-weight:500;color:var(--dtpl-fg);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 没有名字的行只靠精确串站立，所以不弱化、走等宽。判据是 TSX 上的 data-exact（这一串是不是精确模型串），
   不是 :only-child——否则徽章多少会改变名字的字体。 */
[data-plugin="dsh-tokbook"] .dtpl-price-title[data-exact="true"]{
  color:var(--dtpl-fg);font-family:var(--dtpl-mono);
}
/* 请求数比四个价安静一档，但必须永远完整：host 按它降序排这张表。右对齐 + 等宽数字，位数不同的行落在同一条竖线上，
   且只占 --dtpl-reqs-w 这一条轨道，永远不会被省略号吃掉。 */
[data-plugin="dsh-tokbook"] .dtpl-price-reqs{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
  text-align:right;white-space:nowrap;
}
/* 徽章 = 三级描边芯片，层级只由边界与填充表达，色相留给真正要看的状态：
     默认（不在配置）描边 + 三级文字；要看一眼（价格未知 / 未生效 / 未保存）amber 边 + warn-ink 文字；
     还有更多（峰谷价）1px 墨边，从灰芯片里抬一档。
   flex:none + nowrap 是硬约束：折行会撑高一行，截断会丢状态。 */
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
  color:var(--dtpl-warn-ink);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
}
/* 峰谷价标记：这一行可见的四个数字不是全部。不抢颜色，靠 1px 墨边从「不在配置」那类中性芯片里抬一档。 */
[data-plugin="dsh-tokbook"] .dtpl-price-badge-slot{
  color:var(--dtpl-fg);border-color:color-mix(in srgb,var(--dtpl-fg) 35%,transparent);
}
/* 未生效是提醒，不是警报：价已写上，只是闲着。 */
[data-plugin="dsh-tokbook"] .dtpl-price-badge-idle{
  color:var(--dtpl-warn-ink);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
}
/* 判定带：整行宽（grid-column:1/-1），只在有话要说时存在（TSX 里整段条件渲染）。
   它是一句要读的话，所以走说明句档 11px/16px；9–10px 只给短标签，装不下一句话。
   带首是芯片（可纵向扫读的类列），后面跟着这一行自己的后果——结论不靠悬停。
   间距一律 10px，不写成句子的 margin：换行后那会变成莫名其妙的缩进。 */
[data-plugin="dsh-tokbook"] .dtpl-price-decl{
  grid-column:1 / -1;margin:0;min-width:0;
  display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
}
/* 句子可以换行，但不截断：截掉的判定等于没有判定。 */
[data-plugin="dsh-tokbook"] .dtpl-price-decl-text{
  flex:1 1 auto;min-width:0;overflow-wrap:anywhere;
}
/* 这一行哪里不对，紧挨在自己的格子下面。 */
[data-plugin="dsh-tokbook"] .dtpl-price-issue{
  margin:0;padding:2px 10px 6px 10px;
  font-size:10px;line-height:15px;color:var(--dtpl-err);
}

/* 四个格子：同一套度量给两种形态——抽屉里的输入框与行内只读的此刻价。
   等宽是列宽的前提：--dtpl-rate-w 按 12px 等宽数字量出来，比例体会让同位数字错开。 */
[data-plugin="dsh-tokbook"] .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-cell-k{
  display:none;font-size:9px;line-height:12px;color:var(--dtpl-fg-3);
}
/* 行内的只读价：报的是此刻计费所用的价，所以它不是控件——没有边框、没有焦点、不进 Tab 序。 */
[data-plugin="dsh-tokbook"] .dtpl-price-value{
  display:flex;align-items:center;justify-content:flex-end;
  min-height:26px;padding:0 var(--dtpl-cell-pad-x);
  font-family:var(--dtpl-mono);font-size:12px;line-height:16px;
  font-variant-numeric:tabular-nums;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-value[data-empty="true"]{color:var(--dtpl-fg-dim);}
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
/* 展开槽是进入该行价段的主入口（整行也是热区），所以它必须读成控件：命中区与字形尺寸
   都跟输入方式走——桌面 32px、窄屏 44px（见 shared 的窄屏段），两档都在 WCAG 2.2 的 24px 之上。 */
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
/* 删除的第二下：文字已换成「确认删除」，这里再给一个持续的红——状态由文字承载，颜色只让人在按下前再看一眼。 */
[data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger[data-confirm="true"]{
  color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 10%,transparent);
}

/* 调价史抽屉的表面阶梯：card 3% → open row 7% → drawer 无填充 + 实线缝（凹槽）→ .seg 硬边框抬出 → .slot 3%。
   抽屉刻意不加自己的洗色：半透明叠半透明会让抽屉与卡片同调，凹槽靠实线缝与站在上面的块表现。 */
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
/* 「当前生效」的那一段：墨色侧条 + 墨色边框。它是身份（这一段在管现在），不是分类，所以不借色相。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg[data-active="true"]{
  border-color:color-mix(in srgb,var(--dtpl-fg) 35%,transparent);
  box-shadow:inset 2px 0 0 var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-head{display:flex;align-items:center;gap:8px;min-width:0;}
/* 托底价那一张的名字：它没有生效时刻，所以不给输入框，读起来要像卡片标题而不是待填字段。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-floor-k{
  font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
}
/* 托底价的一句话解释：说明句档、fg-2，不借等宽、不降到三级色。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-floor-note{
  margin:0;font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
}
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
  font-size:10px;line-height:15px;
  font-style:normal;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-actions{
  margin-left:auto;display:inline-flex;align-items:center;gap:2px;
  opacity:0;transition:opacity .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg:hover .dtpl-price-seg-actions,
[data-plugin="dsh-tokbook"] .dtpl-price-seg:focus-within .dtpl-price-seg-actions{opacity:1;}
/* 抽屉是表单：四个费率字段用四等分列，每个输入框仍保持表格的费率度量。 */
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
/* 全时段标记（『00:00–24:00』）是一段时间，所以走等宽；墨色取 fg-2——读它才知道这一段覆盖哪几个小时。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sub-k em{
  font-style:normal;font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);
}
/* 「留空的档位沿用上面的全天价」是一句要读的话，所以走 11px 注释句、fg-2、不借等宽（等宽是工程语境）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slots-note{
  font-style:normal;font-family:inherit;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
}

/* 峰谷时段：一行一个，靠凹槽说话——块内 3% 洗色 + 1px 边框，与上面的全天价靠形状分成两层，不靠色相。 */
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
/* 抽屉里的说明句走 11px（注释句档），不是 10px——10px 只属于列头 / 柱值 / 芯片 / 轴刻度这类短标签。 */
[data-plugin="dsh-tokbook"] .dtpl-price-history-hint{margin:0;font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}

/* 文件的保存状态，放在工具栏里：这是一张会自己写回的表的整个反馈回路，所以失败时要换行而不是被裁掉。
   「保存中」不借强调色——动静由文字本身给；颜色只留给已保存（ok）与未保存 / 失败（warn / err）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-state{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saved{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saving{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-invalid{color:var(--dtpl-warn-ink);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-error{color:var(--dtpl-err);font-weight:600;}

/* 骨架屏：按这一屏**真实的排法**分段——事实带 + 图例那一组、第一条展开的卡、后面跟上来的折叠卡。
   高度是实测值（1440px 宽、预览夹具）：带上那组 59（事实 19 + 6 间距 + 两行图例 34）、
   折叠卡 63。展开的那张没法预料行数（夹具里 7 行实测 449），按四条行量一个中位数 214——
   骨架的任务是「首屏别整体下跳」，不是预告行数。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sk-facts{height:59px;}
[data-plugin="dsh-tokbook"] .dtpl-price-sk-open{height:214px;}
[data-plugin="dsh-tokbook"] .dtpl-price-sk-card{height:63px;}

/* 空态里的出路：筛没筛到东西时，读者要能一键回到整张表（面板上的筛选芯片就在他刚看过的位置上方，
   但空态是「我什么都没找到」那一眼的落点，出路放在这里才是放在他要找的地方）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-empty-act{margin-top:12px;}
`
