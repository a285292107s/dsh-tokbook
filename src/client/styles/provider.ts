/** styles.ts 片段：provider。由 `injectStyles` 按序拼接。 */
export const CSS_PROVIDER = `/* 通道用量 tab */
/* 时间范围切换：与窗口 tab 条、总览的「按模型 / 按工作区」用**同一套**选择器语言——
   横排 + 竖发丝分隔 + 当前项底部实条。上一版这里是药丸轨道（灰底 + 抬起的圆角块），
   同一个窗口里就出现了两种「当前项」，读者得学两遍。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-sec{display:flex;flex-direction:column;gap:16px;}
[data-plugin="dsh-tokbook"] .dtpl-range-tabs{
  display:flex;align-self:flex-start;flex:none;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab{
  position:relative;appearance:none;border:0;background:transparent;
  height:28px;padding:0 14px;
  font:inherit;font-size:12px;line-height:18px;font-weight:500;
  color:var(--dtpl-fg-3);white-space:nowrap;cursor:pointer;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab + .dtpl-range-tab{border-left:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-range-tab:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);}
/* 实条取墨色，不取品牌黄：黄这一屏只留给当前页、峰值与节徽记三处，窗口内的第二层选择器
   跟着总览的子 tab 走墨色，两层选择器因此读起来是「同一台设备的两个层级」。 */
[data-plugin="dsh-tokbook"] .dtpl-range-tab.dtpl-range-active{
  color:var(--dtpl-fg);font-weight:600;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab.dtpl-range-active::after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-providers{display:flex;flex-direction:column;gap:10px;}

/* 一张通道卡 = 一块读数面板：1px 硬边框 + 3% 洗色 + 受光边的金属反光。
   上一版是无边框 + .5px 内阴影 + 4% 洗色，边是糊的，整屏读起来像一叠卡片；
   现在外轮廓由 --dtpl-border 给，材质由 --dtpl-metal 给，与总览的 hero/四桶同源。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-card{
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
}
/* 卡头是一段**铭牌**，不是浮在正文上的一行字：一条实线把它与卡身分开。
   通道身份与这张卡的钱因此有一个明确的归属区。 */
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
/* 标签下的 route key：账本的计费键，走等宽——它是代码里的标识，不是给人念的词。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-key{
  font-family:var(--dtpl-mono);
  font-size:10px;
}
/* 计费性质：**用形区分，不用色相**。按量 = 描边芯片（一条通道的分类），
   订阅 = 实心墨芯片（这个数不是现金）。上一版把它染成 --dtpl-accent，而 DSH 皮肤里
   accent 本就等于墨色、换个皮肤又会变成蓝——分类从不该由颜色承担，何况这两个桶
   永远不许被混成一个「支出」。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-bill{
  flex:none;display:inline-flex;align-items:center;
  height:15px;padding:0 5px;
  border:1px solid var(--dtpl-border);
  font-size:10px;line-height:13px;font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-provider-bill[data-billing="subscription"]{
  border-color:var(--dtpl-fg);
  background:var(--dtpl-fg);color:var(--dtpl-card);
}
[data-plugin="dsh-tokbook"] .dtpl-provider-meta{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-nums{
  display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:none;
}
/* 数字走等宽。上一版这里是唯一漏掉那条规矩的地方——同一屏的「今日词元」是等宽、
   通道合计却是比例体，两处数字的字形对不上；等宽在这里还附一层实利：位数变化不抖。 */
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
[data-plugin="dsh-tokbook"] .dtpl-provider-value{color:var(--dtpl-fg-3);font-weight:400;font-size:10px;line-height:15px;}
[data-plugin="dsh-tokbook"] .dtpl-provider-model-sub{
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 模型行自带「发丝线 + 上下间距」（.dtpl-row + .dtpl-row，见 ledger 片段），
   这里不再叠一层 gap——两处都算间距会让卡内行距翻倍，也不再补一条 border-top
   （卡头已经用实线收过尾了，两条线会挨在一起）。 */
[data-plugin="dsh-tokbook"] .dtpl-provider-models{
  display:flex;flex-direction:column;
  padding:9px 14px 11px;
}
[data-plugin="dsh-tokbook"] .dtpl-sk-card{height:132px;}
`
