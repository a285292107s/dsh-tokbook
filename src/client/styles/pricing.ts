/** styles.ts 片段：pricing。由 `injectStyles` 按序拼接。 */
export const CSS_PRICING = `/* 价格表 tab */
/* 这个 tab 是表格，不是表单：每个 route 一张卡，每个模型一行，四个 ¥/M 桶作为固定右对齐列，数字可以纵向比对。 */

[data-plugin="dsh-tokbook"] .dtpl-price-sec{display:flex;flex-direction:column;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-price-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-search{
  flex:1;min-width:0;height:28px;padding:0 10px;
  border-radius:8px;corner-shape:round;
  border:.5px solid var(--dtpl-border);background:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-search::placeholder{color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-price-chip{
  appearance:none;flex:none;height:28px;padding:0 10px;
  display:inline-flex;align-items:center;gap:6px;
  border-radius:8px;corner-shape:round;
  border:.5px solid var(--dtpl-border);background:transparent;
  color:var(--dtpl-fg-2);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-chip:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-chip.is-on{
  color:var(--dtpl-warn);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
  background:color-mix(in srgb,var(--dtpl-warn) 10%,transparent);
}
/* 一次性图例：解释「—」的含义，说一遍，而不是每行都说。 */
[data-plugin="dsh-tokbook"] .dtpl-price-legend{
  margin:0;font-size:11px;line-height:17px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-legend b{color:var(--dtpl-warn);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-price-cards{display:flex;flex-direction:column;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-price-card{
  border:.5px solid var(--dtpl-border);border-radius:12px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
  overflow:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-price-head{
  display:flex;align-items:center;gap:8px;
  padding:8px 10px 8px 8px;border-bottom:.5px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-price-card[data-collapsed="true"] .dtpl-price-head{border-bottom:0;}
/* 折叠头作为整体换行，而不是压碎自己的计数：route key 是不可预测的值，所以只有它可以省略号截断，摘要保持完整文本。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fold{
  appearance:none;border:0;background:transparent;text-align:left;
  flex:1;min-width:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  row-gap:2px;
  padding:3px 4px;border-radius:7px;corner-shape:round;
  font:inherit;color:inherit;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fold:hover{background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-caret{flex:none;width:10px;color:var(--dtpl-fg-3);font-size:9px;}
[data-plugin="dsh-tokbook"] .dtpl-price-label{flex:none;font-size:13px;line-height:20px;font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-key{
  flex:0 1 auto;min-width:0;
  font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-count{
  flex:none;white-space:nowrap;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch{
  flex:none;display:inline-flex;align-items:center;gap:2px;padding:2px;
  border-radius:9px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button{
  appearance:none;border:0;background:transparent;
  height:24px;padding:0 9px;border-radius:7px;corner-shape:round;
  color:var(--dtpl-fg-3);font:inherit;font-size:11px;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button[aria-pressed="true"]{
  background:var(--dtpl-card);color:var(--dtpl-fg);font-weight:600;
  box-shadow:0 1px 2px rgba(0,0,0,.08);
}
[data-plugin="dsh-tokbook"] .dtpl-price-empty{
  margin:0;padding:10px 11px;font-size:12px;line-height:18px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-price-rows{display:flex;flex-direction:column;}

/* 费率格的唯一度量，定义在 tab 根上，表格与调价史抽屉不会分家。

   宽度由费率能是什么决定，不是今天的数字。8 字符费率（0.003625——DeepSeek 自己的历史缓存命中价——或 123.4567）是 47.9px。加上两侧 7px 内边距需要 62px，所以 64px 是最紧的安全列宽；~56px 会裁掉第 8 个字符。
   --dtpl-cell-pad-x 有意与列头共享：列头必须和下面的数字结束在同一边缘。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sec{
  --dtpl-cell-pad-x:7px;
  --dtpl-rate-w:64px;
  --dtpl-rate-gap:6px;
  --dtpl-rates-w:calc(4 * var(--dtpl-rate-w) + 3 * var(--dtpl-rate-gap));
}

/* 每行是自己的网格，轨道与上方列头相同：身份（伸展）| 四个固定费率列 | 一个展开槽。

   费率轨道按费率实际是什么来定，而不是按列标签：最窄的安全列宽把剩余宽度留给唯一放不可预测文本的列——模型身份。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cols,
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) var(--dtpl-rates-w) 26px;
  column-gap:10px;align-items:center;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cols{
  padding:6px 10px 4px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-col-id{padding-left:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-cols .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);
}
/* 标签与数值精确共享右边缘：否则列头结束在格子的边框，数字却结束在内侧 7px 处。 */
[data-plugin="dsh-tokbook"] .dtpl-price-col-rate{
  text-align:right;padding-right:var(--dtpl-cell-pad-x);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  min-height:40px;padding:4px 10px;border-top:.5px solid var(--dtpl-border);
  scroll-margin-block:56px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-row:first-child{border-top:0;}
/* 三种行状态，靠同一条约定区分：accent 色侧条 =「未保存」，中性抬升 =「已展开」，环 =「焦点」。侧条从不花在脏以外的事情上。 */
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-dirty="true"]{
  background:color-mix(in srgb,var(--dtpl-accent) 7%,transparent);
  box-shadow:inset 2px 0 0 var(--dtpl-accent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-open="true"]{
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row:focus-within{
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-accent) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-dirty="true"]:focus-within{
  box-shadow:inset 2px 0 0 var(--dtpl-accent),
    inset 0 0 0 1px color-mix(in srgb,var(--dtpl-accent) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-id{display:flex;flex-direction:column;gap:2px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-name{
  display:flex;align-items:center;gap:5px;min-width:0;flex-wrap:wrap;row-gap:2px;
}
/* 模型选择器的身份拆分，各占一行，互不抢宽度：人读的 NAME 是标签、永不缩没；精确 model 字符串是身份（计费键），占下一行整宽。 */
[data-plugin="dsh-tokbook"] .dtpl-price-title{
  flex:0 1 auto;min-width:0;
  font-size:12px;line-height:16px;font-weight:500;color:var(--dtpl-fg);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 没有名字的行只靠精确字符串站立，所以接过标签的色调和字重，而不是读成被弱化的旁注。 */
[data-plugin="dsh-tokbook"] .dtpl-price-title:only-child{
  color:var(--dtpl-fg);font-family:var(--dtpl-mono);
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge{
  flex:none;
  display:inline-flex;align-items:center;height:15px;padding:0 5px;
  border-radius:5px;corner-shape:round;
  font-size:10px;line-height:15px;font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-3);background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge-unknown{
  color:var(--dtpl-warn);background:color-mix(in srgb,var(--dtpl-warn) 14%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge-dirty{
  color:var(--dtpl-accent);background:color-mix(in srgb,var(--dtpl-accent) 15%,transparent);
}
/* 峰谷标记：这一行可见的四个数字不是全部——它必须一眼读成「里面还有更多定价」。 */
[data-plugin="dsh-tokbook"] .dtpl-price-badge-slot{
  color:var(--dtpl-accent);background:color-mix(in srgb,var(--dtpl-accent) 12%,transparent);
}
/* 未生效是提醒，不是警报：价已写上，只是闲着。 */
[data-plugin="dsh-tokbook"] .dtpl-price-badge-idle{
  color:var(--dtpl-warn);background:color-mix(in srgb,var(--dtpl-warn) 12%,transparent);
}
/* 出处行：这个价是什么，以及账本用它计了多少。行的身份不在此重复——上一行已经说过一次。 */
[data-plugin="dsh-tokbook"] .dtpl-price-meta{
  display:flex;align-items:baseline;gap:5px;min-width:0;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-meta-text{
  flex:0 1000 auto;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 这一行哪里不对，紧挨在自己的格子下面。 */
[data-plugin="dsh-tokbook"] .dtpl-price-issue{
  margin:0;padding:2px 10px 6px 10px;
  font-size:10px;line-height:15px;color:var(--dtpl-err);
}

/* 四个格子：平时像文本，聚焦时是真输入框。右对齐等宽数字让整列可纵向比对。 */
[data-plugin="dsh-tokbook"] .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-cell-k{
  display:none;font-size:9px;line-height:12px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-price-input{
  width:100%;box-sizing:border-box;
  height:26px;padding:0 var(--dtpl-cell-pad-x);
  border:.5px solid transparent;border-radius:6px;corner-shape:round;
  background:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:12px;line-height:16px;
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
[data-plugin="dsh-tokbook"] .dtpl-price-more{
  appearance:none;border:0;background:transparent;
  width:26px;height:26px;padding:0;border-radius:7px;corner-shape:round;
  color:var(--dtpl-fg-3);font:inherit;font-size:10px;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-more:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-more[aria-expanded="true"]{color:var(--dtpl-accent);background:color-mix(in srgb,var(--dtpl-accent) 12%,transparent);}

[data-plugin="dsh-tokbook"] .dtpl-price-add{
  appearance:none;border:.5px solid var(--dtpl-border);background:transparent;
  display:inline-flex;align-items:center;justify-content:center;
  height:26px;padding:0 10px;border-radius:8px;corner-shape:round;
  color:var(--dtpl-fg-2);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-add:hover{color:var(--dtpl-fg);border-color:color-mix(in srgb,var(--dtpl-fg) 25%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:disabled{opacity:.45;cursor:not-allowed;}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost{
  appearance:none;border:0;background:transparent;
  height:24px;padding:0 8px;border-radius:7px;corner-shape:round;
  color:var(--dtpl-fg-3);font:inherit;font-size:11px;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger:hover{color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 10%,transparent);}

/* ▸ 后面的调价史抽屉——表面阶梯：
     page        （无）
     card         fg 4%                       ← 本 tab 的面板
     open row     fg 7%                       ← 它所属的展开行
     drawer       无填充，虚线缝              ← 一个凹槽，不是另一块面板
     .seg         --dtpl-surface (layer-1)    ← 从凹槽里抬出的块
     .slot        accent 6%                   ← 块内的峰谷窗口
   抽屉刻意不加自己的洗色：半透明叠半透明会让抽屉与卡片同调。凹槽靠缝线和站在上面的块来表现。 */
[data-plugin="dsh-tokbook"] .dtpl-price-history{
  display:flex;flex-direction:column;gap:8px;
  padding:8px 10px 12px;
  border-top:.5px dashed var(--dtpl-border);
  background:transparent;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg{
  display:flex;flex-direction:column;gap:5px;
  padding:6px 8px;border-radius:9px;corner-shape:round;
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg[data-active="true"]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-accent) 45%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-head{display:flex;align-items:center;gap:8px;min-width:0;}
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
  font-style:normal;font-weight:600;color:var(--dtpl-accent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-actions{
  margin-left:auto;display:inline-flex;align-items:center;gap:2px;
  opacity:0;transition:opacity .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg:hover .dtpl-price-seg-actions,
[data-plugin="dsh-tokbook"] .dtpl-price-seg:focus-within .dtpl-price-seg-actions{opacity:1;}
/* 抽屉是表单，所以四个费率字段用它们被给出的宽度（四等分列），而每个输入框仍保持表格的费率度量——限制输入框而不是列。 */
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
[data-plugin="dsh-tokbook"] .dtpl-price-input-note{text-align:left;font-variant-numeric:normal;}

/* 分段的全天价有标签，因为同样的四个桶会在下方再次出现作为例外时段：没有 00:00–24:00 区间，两级会看起来像同一张表的两行。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sub{display:flex;align-items:baseline;gap:6px;}
[data-plugin="dsh-tokbook"] .dtpl-price-sub-k,
[data-plugin="dsh-tokbook"] .dtpl-price-slots-k{
  display:inline-flex;align-items:baseline;gap:5px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-sub-k em,
[data-plugin="dsh-tokbook"] .dtpl-price-slots-k em{
  font-style:normal;font-family:var(--dtpl-mono);color:var(--dtpl-fg-3);
}

/* 峰谷时段：一行一个，用 accent 色染色，让「这个小时区间有自己的价」读成比上面的全天价更独立的对象。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slots{display:flex;flex-direction:column;gap:5px;margin-top:1px;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot{
  display:flex;flex-direction:column;gap:5px;
  padding:5px 7px;border-radius:8px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 6%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--dtpl-accent) 22%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-clock{
  display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-dash{color:var(--dtpl-fg-3);font-size:11px;}
[data-plugin="dsh-tokbook"] .dtpl-price-select{
  appearance:none;height:24px;padding:0 20px 0 7px;
  border-radius:7px;corner-shape:round;
  border:.5px solid var(--dtpl-border);background:var(--dtpl-card);color:var(--dtpl-fg);
  font:inherit;font-size:11px;line-height:16px;cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,var(--dtpl-fg-3) 50%),
    linear-gradient(135deg,var(--dtpl-fg-3) 50%,transparent 50%);
  background-position:calc(100% - 11px) 10px,calc(100% - 7px) 10px;
  background-size:4px 4px,4px 4px;background-repeat:no-repeat;
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
[data-plugin="dsh-tokbook"] .dtpl-price-history-hint{margin:0;font-size:10px;line-height:15px;color:var(--dtpl-fg-2);}

/* 文件的保存状态，放在工具栏里：这是一张会自己写回的表的整个反馈回路，所以失败时要换行，而不是被裁掉。 */
[data-plugin="dsh-tokbook"] .dtpl-price-state{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saved{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saving{color:var(--dtpl-accent);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-invalid{color:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-error{color:var(--dtpl-err);font-weight:600;}
`
