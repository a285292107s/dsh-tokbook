/** pricing 片段：必须排在 shared 之前（窄屏段覆盖这里的高度）。 */
export const CSS_PRICING = `
[data-plugin="dsh-tokbook"] .dtpl-price-sec{display:flex;flex-direction:column;gap:14px;}
/* 顺序：搜索 | 保存状态 | 重试 | 筛选芯片——芯片必须最后一个，否则它会被状态文字推着横移。 */
[data-plugin="dsh-tokbook"] .dtpl-price-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-search{
  flex:1;min-width:0;height:28px;padding:0 10px;
  border:1px solid var(--dtpl-border);background:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:12px;
}
/* placeholder 是这个字段唯一可见的名字，所以墨色取 fg-2（可读文本档）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-search::placeholder{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-chip{
  appearance:none;flex:none;height:28px;padding:0 10px;
  display:inline-flex;align-items:center;gap:6px;
  border:1px solid var(--dtpl-border);background:transparent;
  color:var(--dtpl-fg-2);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-chip:hover{color:var(--dtpl-fg);}
/* 筛选开着：amber 边框 + warn-ink 文字（裸 warn 作正文对比度不足）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-chip.is-on{
  color:var(--dtpl-warn-ink);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
  background:color-mix(in srgb,var(--dtpl-warn) 10%,transparent);
}
/* 事实带走跨 tab 共用的 .dtpl-hero-facts（见 ledger 片段）。
   b 必须单独指一次：.dtpl-hero-facts b 的优先级与本条相同，pricing 片段拼在 ledger 之后，所以这里赢。 */
[data-plugin="dsh-tokbook"] .dtpl-price-read{display:flex;flex-direction:column;gap:6px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-fact-unknown,
[data-plugin="dsh-tokbook"] .dtpl-price-fact-unknown b{color:var(--dtpl-warn-ink);}
[data-plugin="dsh-tokbook"] .dtpl-price-legend{
  margin:0;font-size:11px;line-height:17px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-legend b{color:var(--dtpl-warn-ink);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-price-cards{display:flex;flex-direction:column;gap:8px;}
/* 卡面 = 洗色阶梯第 1 档（6% 压窗面，见 .dtpl-price-history）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-card{
  border:1px solid var(--dtpl-border);
  background:color-mix(in srgb,var(--dtpl-fg) 6%,var(--dtpl-card));
  box-shadow:var(--dtpl-metal);
  overflow:hidden;
}
/* 卡头 = 阶梯第 2 档（11%）：这一档起 fg-2 压不住 4.5:1，梁上一切走主墨。 */
[data-plugin="dsh-tokbook"] .dtpl-price-head{
  display:flex;align-items:flex-start;gap:8px;
  padding:7px 10px 7px 8px;border-bottom:1px solid var(--dtpl-border);
  background:color-mix(in srgb,var(--dtpl-fg) 11%,var(--dtpl-card));
}
[data-plugin="dsh-tokbook"] .dtpl-price-head .dtpl-hero-facts{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-card[data-collapsed="true"] .dtpl-price-head{border-bottom:0;}
/* route key 是唯一不可预测的值，只有它截断。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fold{
  appearance:none;border:0;background:transparent;text-align:left;
  flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;
  padding:3px 4px;
  font:inherit;color:inherit;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fold:hover{background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);}
/* 身份行整体换行而不是压碎名字：名字与 key 都留着，放不下时 key 让位到下一行。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fold-top{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;row-gap:2px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-caret{flex:none;width:10px;color:var(--dtpl-fg-3);font-size:9px;}
[data-plugin="dsh-tokbook"] .dtpl-price-label{flex:none;font-size:14px;line-height:20px;font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-key{
  flex:0 1 auto;min-width:0;
  /* 横梁上不能用 fg-2。 */
  font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 计费性质切换走全窗口唯一的「当前项」语言（窗口 tab 条、总览子 tab 同款）；横梁上未选中项也是主墨。 */
[data-plugin="dsh-tokbook"] .dtpl-price-switch{
  flex:none;display:flex;align-self:center;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button{
  position:relative;appearance:none;border:0;background:transparent;
  height:24px;padding:0 11px;
  color:var(--dtpl-fg);font:inherit;font-size:11px;line-height:16px;font-weight:400;
  white-space:nowrap;cursor:pointer;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button + button{border-left:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button:hover{background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);}
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

/* 费率格的度量。--dtpl-rate-w 由费率能是什么决定，不是今天的数字：它要装下最长的那种历史价（8 字符），
   数字必须等宽（比例体让同位数字错开，固定列就失去可比性）。
   --dtpl-cell-pad-x 与列头共享：列头必须和下面的数字结束在同一边缘。
   抽屉走自己的 --dtpl-seg-rate-w：账带上的数字是主角（14px 等宽），列表那侧是 12px 读数——
   两处字号不同，列宽就不可能再共用一个值；抽屉内全天价与峰谷价共用这一档，跨段落在同一组竖线上。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sec{
  --dtpl-cell-pad-x:7px;
  --dtpl-rate-w:74px;
  --dtpl-rate-gap:6px;
  --dtpl-rates-w:calc(4 * var(--dtpl-rate-w) + 3 * var(--dtpl-rate-gap));
  --dtpl-seg-rate-w:80px;
  --dtpl-reqs-w:44px;
  /* 日档列宽必须由同一个值给出：时段头是下拉（自身 8px 插入符），全天价那行是锁死的文字——
     盒子同宽，两行的钟点才落在同一条竖线上。 */
  --dtpl-days-w:52px;
}

/* 每行网格的轨道与上方列头相同。硬约束：展开槽宽与 .dtpl-price-more 的命中区必须一起改
   （列宽小于控件会把控件压回去）；第一格 minmax(32px,auto) 是这一行唯一的高度来源。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cols,
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  display:grid;
  /* 请求数列 minmax(44px,max-content)：44px 是常见位数的下限，位数再多也不截断。 */
  grid-template-columns:minmax(0,1fr) minmax(var(--dtpl-reqs-w),max-content) var(--dtpl-rates-w) 32px;
  column-gap:10px;align-items:center;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cols{
  padding:6px 10px 4px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-col-id{padding-left:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-col-reqs{text-align:right;}
[data-plugin="dsh-tokbook"] .dtpl-price-cols .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);
}
/* 标签与数值共享右边缘：内边距必须与数字格一致。 */
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
/* 整行是展开热区（行尾 ▸ 是它的键盘可达形态）；行内文字仍可拖选。 */
[data-plugin="dsh-tokbook"] .dtpl-price-row:hover{background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);}
/* 未保存那张的侧条取墨色不取强调色：强调色随宿主皮肤变。 */
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-dirty="true"]{
  background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);
  box-shadow:inset 2px 0 0 var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-open="true"]{
  /* 与抽屉同面（--dtpl-surface），两者之间不画缝。 */
  background:var(--dtpl-surface);
}
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
/* 请求数必须永远完整（host 按它降序排表），只占 --dtpl-reqs-w 这一条轨道；等宽数字 + 右对齐。 */
[data-plugin="dsh-tokbook"] .dtpl-price-reqs{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
  text-align:right;white-space:nowrap;
}
/* 硬约束：flex:none + nowrap——折行会撑高一行，截断会丢状态。 */
[data-plugin="dsh-tokbook"] .dtpl-price-badge{
  flex:none;
  display:inline-flex;align-items:center;height:15px;padding:0 5px;
  border:1px solid var(--dtpl-border);
  font-size:10px;line-height:13px;font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge-unknown{
  color:var(--dtpl-warn-ink);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge-dirty{
  color:var(--dtpl-warn-ink);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge-idle{
  color:var(--dtpl-warn-ink);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
}
/* 判定带整行宽（grid-column:1/-1），只在有话要说时渲染（TSX 条件渲染）。
   间距一律 10px，不写成句子的 margin（换行后那会变成缩进）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-decl{
  grid-column:1 / -1;margin:0;min-width:0;
  display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
}
/* 判定句可以换行，但不截断。 */
[data-plugin="dsh-tokbook"] .dtpl-price-decl-text{
  flex:1 1 auto;min-width:0;overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-price-issue{
  margin:0;padding:2px 10px 6px 10px;
  font-size:10px;line-height:15px;color:var(--dtpl-err);
}

/* 四个格子：抽屉输入框与行内只读价共用同一套度量；等宽是列宽的前提。 */
[data-plugin="dsh-tokbook"] .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-cell-k{
  /* 字段名是要读的文本，走 fg-2（fg-3 只承载装饰）。 */
  display:none;font-size:9px;line-height:12px;letter-spacing:.2em;color:var(--dtpl-fg-2);
}
/* 行内价是只读读数，不是控件：不进 Tab 序。 */
[data-plugin="dsh-tokbook"] .dtpl-price-value{
  display:flex;align-items:center;justify-content:flex-end;
  min-height:26px;padding:0 var(--dtpl-cell-pad-x);
  font-family:var(--dtpl-mono);font-size:12px;line-height:16px;
  font-variant-numeric:tabular-nums;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-value[data-empty="true"]{color:var(--dtpl-fg-dim);}
/* 不变量：坐刻线的才可触（静止 22% → hover 45% → 聚焦墨线，焦点指示就是这条线，outline 关掉），
   纯展示文字不坐线且一律 fg-2。四档价四格例外：静止不画线，线归整行所有
   （见 .dtpl-price-seg-allday / .dtpl-price-slot 的 border-bottom），单格的线只在 hover 与聚焦时现身。 */
[data-plugin="dsh-tokbook"] .dtpl-price-input{
  width:100%;box-sizing:border-box;
  height:28px;padding:0 var(--dtpl-cell-pad-x);
  border:0;border-bottom:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  background:transparent;color:var(--dtpl-fg);
  font-family:var(--dtpl-mono);font-size:14px;line-height:18px;font-weight:500;
  font-variant-numeric:tabular-nums;text-align:right;
}
[data-plugin="dsh-tokbook"] .dtpl-price-input:hover{
  border-bottom-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
/* 空 = 继承：占位符报的是它沿用的那个数，走 dim 档。 */
[data-plugin="dsh-tokbook"] .dtpl-price-input::placeholder{color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-price-input:focus{
  outline:none;border-bottom-color:var(--dtpl-fg);
}
/* 费率格静止无刻线：那道线归整行所有。 */
[data-plugin="dsh-tokbook"] .dtpl-price-rates .dtpl-price-input{border-bottom-color:transparent;}
[data-plugin="dsh-tokbook"] .dtpl-price-rates .dtpl-price-input:hover{
  border-bottom-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-rates .dtpl-price-input:focus{border-bottom-color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-cell[data-state="bad"] .dtpl-price-input{
  color:var(--dtpl-err);border-bottom-color:var(--dtpl-err);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell-err{
  font-size:10px;line-height:14px;color:var(--dtpl-err);text-align:right;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
/* 命中区桌面 32px、窄屏 44px（见 shared 窄屏段），两档都在 WCAG 2.2 的 24px 之上。 */
[data-plugin="dsh-tokbook"] .dtpl-price-more{
  appearance:none;border:0;background:transparent;
  width:32px;height:32px;padding:0;
  color:var(--dtpl-fg-2);font:inherit;font-size:14px;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-more:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-more[aria-expanded="true"]{
  color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
}

/* 热区 24px（WCAG 2.2 SC 2.5.8 的下限），与同一行的复制/删除齐平。 */
[data-plugin="dsh-tokbook"] .dtpl-price-add{
  appearance:none;background:transparent;
  display:inline-flex;align-items:center;justify-content:center;
  min-height:24px;padding:1px 2px;
  border:0;border-bottom:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  color:var(--dtpl-fg);font:inherit;font-size:11px;letter-spacing:.08em;cursor:pointer;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-add:hover{
  border-bottom-color:var(--dtpl-fg);
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:disabled{opacity:.45;cursor:not-allowed;}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost{
  appearance:none;
  border:0;border-bottom:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  background:transparent;box-sizing:border-box;
  height:24px;padding:0 8px;
  color:var(--dtpl-fg-2);font:inherit;font-size:11px;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:hover{
  color:var(--dtpl-fg);border-bottom-color:var(--dtpl-fg);
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger:hover{color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 10%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger[data-confirm="true"]{
  color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 10%,transparent);
}

/* 读面的洗色阶梯（一律以 --dtpl-card 为底，不逐层叠乘）：
     0%   窗面
     6%   通道卡面
     11%  卡头横梁 —— 这一档起 fg-2 禁上（浅肤 fg-2 压 11% 面只剩 4.29:1）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-history{
  position:relative;
  display:flex;flex-direction:column;gap:8px;
  padding:10px 10px 14px 30px;
  /* 与展开行同面，不画缝；抽屉的结束由下一条行的上边线说。 */
  border-top:0;
  background:var(--dtpl-surface);
}
[data-plugin="dsh-tokbook"] .dtpl-price-history::before{
  content:"";position:absolute;left:12px;top:6px;bottom:6px;width:1px;
  background:color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
}
/* 分行用 1px 发丝线：.5px 在深色下会整条消失。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg{
  position:relative;
  display:flex;flex-direction:column;gap:5px;
  padding:5px 8px;
  border-top:1px solid var(--dtpl-hairline);
  background:transparent;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg::before{
  content:"";position:absolute;left:-21.5px;top:15px;width:8px;height:8px;border-radius:50%;
  background:color-mix(in srgb,#000 35%,transparent);
  box-shadow:0 0 0 1px color-mix(in srgb,var(--dtpl-fg) 16%,transparent);
  pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg:hover{
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
/* 钉与孔同径同形同位（改 ::before 的几何要一起改）；这是全抽屉唯一允许色相的地方。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg[data-active="true"]::after{
  content:"";position:absolute;left:-21.5px;top:15px;width:8px;height:8px;z-index:1;border-radius:50%;
  background:var(--dtpl-brand);box-shadow:0 0 0 1px var(--dtpl-on-brand);
  pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge-live{
  background:var(--dtpl-brand);color:var(--dtpl-on-brand);
  border-color:var(--dtpl-on-brand);letter-spacing:.1em;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-line{
  display:flex;align-items:center;gap:10px;min-width:0;
}
/* 两条带子各自横跨整行。四档价是定宽格子（80px = 8 字符价 + 两侧内边距），宽度不能让，
   余量摊到格子之间（space-between）——跨行仍落在同一组竖线上。 */
[data-plugin="dsh-tokbook"] .dtpl-price-history .dtpl-price-rates{
  grid-template-columns:repeat(4,var(--dtpl-seg-rate-w));
  justify-content:space-between;
}
/* 托底价的戳与生效时刻同档（区块标题档），只是没有时刻。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-floor-k{
  font-size:15px;line-height:20px;font-weight:600;letter-spacing:.22em;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-id{display:flex;align-items:center;gap:8px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-serial{
  flex:none;font-family:var(--dtpl-mono);font-size:10px;line-height:16px;
  letter-spacing:.12em;font-variant-numeric:tabular-nums;color:var(--dtpl-fg-2);
}
/* 生效时刻是这一块的标题：等宽、左对齐、比读数大一档；刻线只铺到戳的宽度。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-date{display:flex;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-input-date{
  flex:0 1 auto;min-width:160px;text-align:left;padding:0 6px 0 0;
  font-size:15px;letter-spacing:.05em;font-weight:600;
}
/* 原生日历按钮是全窗口唯一的浏览器控件，收掉；键入与方向键路径写进字段的 title。 */
[data-plugin="dsh-tokbook"] .dtpl-price-input-date::-webkit-calendar-picker-indicator{display:none;}
/* 右轨 = 段自己的复制/删除（常显）；峰谷时段那一对挂在时段头行（.dtpl-price-seg-actions，hover/聚焦现身）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-tools{
  margin-left:auto;flex:none;
  display:flex;align-items:center;justify-content:flex-end;
  gap:6px;min-width:0;
}

/* 详情带不缩进、不画自己的上边线：缩进会让跨行的四档价错开，补上边线会与上一行的刻线相距 7px。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-detail{
  display:flex;flex-direction:column;gap:6px;
  padding:2px 0 1px;
}
/* 幽灵行与子目同高（81px = 10px 上垫 + 70 内容 + 1px 刻线，与 .dtpl-price-slot 的度量绑死）；
   margin-top 4px 与详情带 6px gap 合出子目之间的 10px 节奏。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-band{display:flex;min-width:0;margin-top:4px;}
[data-plugin="dsh-tokbook"] .dtpl-price-add-slot{
  width:100%;min-height:81px;box-sizing:border-box;
  display:flex;align-items:center;gap:10px;
  padding:10px 2px 0;justify-content:flex-start;
}
/* 名分与真实时段的「日档」落在同一条左缘（盘 40 + 间隙 10）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-add-slot-k{
  flex:1;display:flex;align-items:center;justify-content:flex-start;gap:4px;
}

/* 全天价行与峰谷子目同构：满弧盘 + 锁死的时间段头（不给刻线、不给插入符，整行退到 fg-2）+ 四档价。
   四档价共用数字底下那一条刻线——它同时是行与行之间唯一的分隔。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-allday{
  display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-allday-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-allday-head{display:flex;align-items:center;gap:6px;min-width:0;font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
/* 锁定头的日档与上面的下拉同盒（border-box + --dtpl-days-w），钟点列才对齐。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-allday-days{
  box-sizing:border-box;min-width:var(--dtpl-days-w);padding-left:2px;
}
/* 峰谷时段是账带条目下的子目：与全天价同面、同起点、同一条刻线（各画在自己数字底下）；
   不画自己的上边线（会与上一道相距 7px），不缩进。「留空 = 沿用全天价」由占位数字与 title 说。
   上内边距就是子目之间的全部间距（.dtpl-price-slots 因此不留 gap）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slots{display:flex;flex-direction:column;margin-top:1px;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot{
  display:flex;align-items:center;gap:10px;
  padding:10px 0 0;
  border:0;border-bottom:1px solid var(--dtpl-hairline);
  background:transparent;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;}
/* 颜色只活在样式里（组件不写 var() 描边——selfcheck 会把它误读成类）；弧长与起点是几何，留在属性上。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-ring{flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-ring-track{
  fill:none;stroke:color-mix(in srgb,var(--dtpl-fg) 16%,transparent);stroke-width:1;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-ring-arc{fill:none;stroke:var(--dtpl-fg);stroke-width:2;}
/* 幽灵环比淡轨亮一档（40% / 1.5px vs 16% / 1px）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-ring-ghost{
  fill:none;stroke:color-mix(in srgb,var(--dtpl-fg) 40%,transparent);stroke-width:1.5;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-ring-zero{stroke:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);stroke-width:1.5;}
/* 时段头上的复制/删除：hover 或聚焦现身（始终可达，非仅 hover）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-actions{
  margin-left:auto;display:inline-flex;align-items:center;gap:2px;
  opacity:0;transition:opacity .12s ease;
}
/* 日档与钟点之间坐一道 .5px 竖发丝线（与计费性质切换同一词汇）；这簇只有 165px 宽，
   折行时容器先挤掉的是右轨那对操作。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-clock{
  display:inline-flex;align-items:center;gap:4px;
  margin-left:2px;padding-left:8px;border-left:.5px solid var(--dtpl-hairline);
  font-family:var(--dtpl-mono);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-dash{color:var(--dtpl-fg-3);font-size:11px;}
[data-plugin="dsh-tokbook"] .dtpl-price-select{
  appearance:none;height:24px;box-sizing:border-box;padding:0 16px 0 2px;
  border:0;border-bottom:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  background-color:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:11px;line-height:16px;cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,var(--dtpl-fg-2) 50%),
    linear-gradient(135deg,var(--dtpl-fg-2) 50%,transparent 50%);
  background-position:calc(100% - 8px) 10px,calc(100% - 4px) 10px;
  background-size:4px 4px,4px 4px;background-repeat:no-repeat;
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-select:hover{border-bottom-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-select:focus{outline:none;border-bottom-color:var(--dtpl-fg);}
/* 原生下拉面板：option 继承控件字色，深肤主墨近白、落在浏览器默认白底上读不出。
   面板底与字显式声明成卡面 + 主墨（Chromium 会按 option 底色重绘面板，浏览器蓝随之消失）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-select option{
  background:var(--dtpl-card);color:var(--dtpl-fg);
}
/* 列宽给到「工作日」(33px) + 两侧 2px/8px + 三角 8px；一行里三个下拉的三角到各自值的距离必须一致。 */
[data-plugin="dsh-tokbook"] .dtpl-price-select-days{width:var(--dtpl-days-w);padding-right:8px;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-rates .dtpl-price-cell-k,
[data-plugin="dsh-tokbook"] .dtpl-price-slot-rates .dtpl-price-cell-k{display:block;text-align:right;padding-right:var(--dtpl-cell-pad-x);}
[data-plugin="dsh-tokbook"] .dtpl-price-slot:hover .dtpl-price-seg-actions,
[data-plugin="dsh-tokbook"] .dtpl-price-slot:focus-within .dtpl-price-seg-actions{opacity:1;}
[data-plugin="dsh-tokbook"] .dtpl-price-history-foot{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-history-hint{margin:0;font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}

/* 状态文字出现/换文案/消失都不许推动别的东西：右对齐贴着芯片，余量由搜索框让出；
   max-width 是这条规矩的保险（长句在自己盒子里折行，不把芯片挤到第二行）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-state{
  max-width:min(100%,420px);text-align:right;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saved{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saving{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-invalid{color:var(--dtpl-warn-ink);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-error{color:var(--dtpl-err);font-weight:600;}

/* 骨架屏按这一屏真实的排法分段，高度是实测值：任务是首屏别整体下跳，不是预告行数。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sk-facts{height:59px;}
[data-plugin="dsh-tokbook"] .dtpl-price-sk-open{height:214px;}
[data-plugin="dsh-tokbook"] .dtpl-price-sk-card{height:63px;}

[data-plugin="dsh-tokbook"] .dtpl-price-empty-act{margin-top:12px;}
`
