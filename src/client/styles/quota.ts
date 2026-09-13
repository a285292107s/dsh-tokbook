/** styles.ts 片段：quota。由 `injectStyles` 按序拼接。 */
export const CSS_QUOTA = `/* 订阅额度 tab */
[data-plugin="dsh-tokbook"] .dtpl-quota-sec{display:flex;flex-direction:column;gap:10px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-intro{
  margin:0;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
/* 自动刷新：标签 + pill 选项 + 实时状态。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:6px 10px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-label{
  color:var(--dtpl-fg-2);font-size:12px;line-height:18px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-seg{
  display:inline-flex;gap:2px;padding:2px;
  border-radius:8px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt{
  appearance:none;border:0;background:transparent;
  height:22px;padding:0 9px;
  font:inherit;font-size:11px;line-height:16px;font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;
  border-radius:6px;corner-shape:round;cursor:pointer;
  transition:background .15s ease,color .15s ease,box-shadow .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt.dtpl-quota-autorefresh-on{
  color:var(--dtpl-fg);
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border,rgba(0,0,0,.14));
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-state{
  margin-left:auto;color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-state.dtpl-quota-autorefresh-live{color:var(--dtpl-ok);}

[data-plugin="dsh-tokbook"] .dtpl-quota-cards{display:flex;flex-direction:column;gap:12px;}
/* 单个通道卡片：柔和洗底；正文各节用 hairline 分隔。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-card{
  padding:14px 16px 12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
/* 卡片头：身份（环形量规 + 名称/副行）| 状态 chip + 刷新。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-head{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-bottom:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-id{
  display:flex;align-items:center;gap:10px;min-width:0;
}
/* 月度环形量规的预留槽；加载 / 出错 / 未配置（无环）时标题不位移。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-state-gap{
  flex:none;width:44px;height:44px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-id-text{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-quota-name{
  color:var(--dtpl-fg);font-size:14px;line-height:20px;font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-sub{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-head-side{
  display:flex;align-items:center;gap:8px;flex:none;
  min-width:0;
}
/* 单卡刷新：紧凑图标钮，请求在飞时禁用。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh{
  display:inline-flex;align-items:center;justify-content:center;
  width:28px;height:28px;padding:0;
  border:none;border-radius:8px;corner-shape:round;
  background:transparent;color:var(--dtpl-fg-3);
  cursor:pointer;transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh:hover:not(:disabled){background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh:disabled{opacity:.45;cursor:default;}
/* 外层容器拥有一次性点击「pop」：靠 React key 重挂载。与字形分离，这样下面的加载 spinner（旋转）不会互相抵消。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim{
  display:inline-flex;align-items:center;justify-content:center;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{
  animation:dtpl-refresh-pop .35s cubic-bezier(.34,1.56,.64,1);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh-ico{width:15px;height:15px;display:block;}
/* 状态 chip（未配置 / 拉取失败）。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-chip{
  flex:none;display:inline-flex;align-items:center;gap:6px;
  height:22px;padding:0 10px;
  border-radius:999px;corner-shape:round;
  font-size:11px;line-height:16px;font-weight:500;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-chip::before{
  content:"";width:6px;height:6px;border-radius:50%;corner-shape:round;
  background:currentColor;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-chip-muted{
  color:var(--dtpl-fg-2);
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-chip-err{
  color:var(--dtpl-err);
  background:color-mix(in srgb,var(--dtpl-err) 10%,transparent);
}
/* 余额门控 chip（无生效订阅）：不是错误——账号仍可用，只是不再按套餐滚动窗口节奏。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-chip-gate{
  color:var(--dtpl-warn);
  background:color-mix(in srgb,var(--dtpl-warn) 12%,transparent);
}
/* 月度预算环形量规。环描边带色调，已用 % 数字居中在环*内*，它所指的预算以小号说明挂在数字下方，环从不静默地换含义。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge{
  position:relative;flex:none;width:44px;height:44px;
  color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-svg{width:44px;height:44px;display:block;}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-track{
  fill:none;stroke:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
  stroke-width:4;stroke-linecap:round;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-fill{
  fill:none;stroke:currentColor;stroke-width:4;stroke-linecap:round;
  transform:rotate(-90deg);transform-origin:50% 50%;
  transition:stroke-dasharray .4s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-n{
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:2px;
  color:inherit;font-size:11px;line-height:1;font-weight:700;
  font-variant-numeric:tabular-nums;white-space:nowrap;
  pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-n i{
  font-style:normal;font-size:8px;line-height:1;font-weight:600;
  color:var(--dtpl-fg-3);margin-left:.5px;
}
/* 命名这个环所汇总的预算的小号说明。弱化，让色调数字仍是焦点。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-cap{
  font-size:8px;line-height:1;font-weight:600;color:var(--dtpl-fg-3);
}
/* 卡内消息面板（加载失败 / 未配置 / 拉取失败）。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-msg{
  display:flex;flex-direction:column;align-items:flex-start;gap:2px;
  padding:10px 12px;margin:2px 0 6px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-muted{background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-err{
  background:color-mix(in srgb,var(--dtpl-err) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-title{margin:0;font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-err .dtpl-quota-msg-title{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-body{
  margin:0;font-size:12px;line-height:18px;color:var(--dtpl-fg-2);
  overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg .dtpl-retry{margin-top:6px;}
/* ok 正文上方的 stale-while-revalidate 提示。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-stale{
  margin:0 0 8px;padding:6px 10px;
  border-radius:7px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-warn) 10%,transparent);
  color:var(--dtpl-warn);
  font-size:11px;line-height:16px;
}
/* 用量条：每个预算窗口一行，所有数据形态共用同一骨架。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-windows{display:flex;flex-direction:column;gap:12px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-window{display:flex;flex-direction:column;gap:5px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-line1{
  display:flex;align-items:baseline;justify-content:space-between;gap:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-label{
  color:var(--dtpl-fg);font-size:12px;line-height:18px;font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-metric{
  color:var(--dtpl-fg-2);font-size:11px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar{
  display:block;width:100%;height:7px;border-radius:999px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 9%,transparent);overflow:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill{
  display:block;height:100%;border-radius:inherit;
  transition:width .4s ease,background-color .2s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-tone-ok{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-quota-tone-warn{color:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-quota-tone-danger{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-ok{background:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-warn{background:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-danger{background:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-line2{
  display:flex;align-items:baseline;justify-content:space-between;gap:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-remaining{
  color:var(--dtpl-fg);font-size:12px;line-height:18px;font-weight:650;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-window[data-tone="warn"] .dtpl-quota-remaining{color:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-quota-window[data-tone="danger"] .dtpl-quota-remaining{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-reset{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-reset-limited{color:var(--dtpl-err);font-weight:600;}
/* 余额门控正文：余额顶在用量条该在的位置。余额没有分母，没有百分比可画，也没有环。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-balance{display:flex;align-items:baseline;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-balance-v{
  color:var(--dtpl-fg);font-size:22px;line-height:26px;font-weight:700;
  font-variant-numeric:tabular-nums;letter-spacing:-.01em;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-balance-k{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;font-weight:500;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-balance-note{
  margin:6px 0 0;font-size:11px;line-height:17px;color:var(--dtpl-fg-2);
}
/* 额度来源（月额度 / 已购 / 赠送）：余额下的一行紧凑说明——带加购额度的生效卡则在用量条下方。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-sources{
  margin:8px 0 0;font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;
}
/* 用量摘要活动条：迷你 K/V 格，放在 ok 正文底部，作为用量条下方「这段时间怎么样」的语境。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-stats{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;
  margin-top:12px;padding-top:12px;
  border-top:.5px dashed var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat{
  display:flex;flex-direction:column;gap:1px;
  padding:7px 10px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat-v{
  display:flex;align-items:baseline;gap:6px;
  color:var(--dtpl-fg);font-size:13px;line-height:18px;font-weight:650;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat-warn{
  font-style:normal;font-size:10px;line-height:14px;font-weight:600;color:var(--dtpl-err);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat-k{color:var(--dtpl-fg-3);font-size:11px;line-height:16px;}
/* 卡片头刷新钮前的新鲜度标签：官方数字何时拉回。从原先的脚注尺寸/弱化色调抬上来——它现在坐在卡片洗底面板上、紧挨可交互控件。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-updated{
  color:var(--dtpl-fg-2);font-size:11px;line-height:16px;font-weight:500;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 卡片正文形状的加载占位。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-body{display:flex;flex-direction:column;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-card{height:150px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-line{height:14px;width:55%;border-radius:5px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-line-short{width:35%;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-bar{height:7px;border-radius:999px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-note{
  margin:10px 0 0;font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
}

/* 「价格未知」提示的跨 tab 链接（总览 → 价格表，带着该筛选）。 */
[data-plugin="dsh-tokbook"] .dtpl-pricing-empty-link{
  appearance:none;border:0;background:transparent;padding:0;
  font:inherit;font-size:inherit;color:var(--dtpl-accent);
  cursor:pointer;text-decoration:underline;text-underline-offset:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-empty-link:hover{color:var(--dtpl-accent-hover,var(--dtpl-accent));}
`
