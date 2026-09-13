/** styles.ts 片段：ledger。由 `injectStyles` 按序拼接。 */
export const CSS_LEDGER = `/* 总览英雄区（总词元 + 成本 + meta） */
/* 一块 data-first 的英雄面板：品牌色轻洗底，全图等宽数字。 */
[data-plugin="dsh-tokbook"] .dtpl-hero{
  display:flex;align-items:flex-end;justify-content:space-between;gap:16px;
  padding:14px 16px;margin-bottom:12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:linear-gradient(135deg,
    color-mix(in srgb,var(--dtpl-accent) 9%,transparent),
    color-mix(in srgb,var(--dtpl-accent) 3%,transparent));
}
[data-plugin="dsh-tokbook"] .dtpl-hero-main{display:flex;flex-direction:column;gap:3px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-total-k{color:var(--dtpl-fg-2);font-size:12px;line-height:18px;}
[data-plugin="dsh-tokbook"] .dtpl-total-num{
  font-size:28px;line-height:32px;font-weight:700;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;letter-spacing:-.02em;
}
/* 英雄区的语境行：今天 vs 近7天基线。刻意中性——「比平时多」本身不是坏消息，从不借用 warn 色。方向由 ↑/↓ 字形和字重表达。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-base{
  font-size:12px;line-height:18px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-base b{font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-hero-money{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-hero-cost{
  display:inline-flex;align-items:baseline;gap:4px;
  font-size:14px;line-height:20px;font-weight:600;color:var(--dtpl-accent);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-cost-k{font-style:normal;font-weight:500;font-size:11px;color:var(--dtpl-fg-3);}
/* 零消费是一个答案，不是标题：它占住这一行，但不抢旁边非零数字的视线，也永远不像现金。 */
[data-plugin="dsh-tokbook"] .dtpl-hero-cost.dtpl-hero-cost-zero{color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-hero-value{
  display:inline-flex;align-items:baseline;gap:4px;
  font-size:12px;line-height:18px;color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-value b{color:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;}
/* 模型/通道/工作区行里的订阅价值金额：样式刻意区别于消费，订阅通道的数字永远不像现金。 */
[data-plugin="dsh-tokbook"] .dtpl-sub-amt{color:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;}
[data-plugin="dsh-tokbook"] .dtpl-sub-k{font-style:normal;font-size:10px;line-height:14px;color:var(--dtpl-fg-3);margin-left:3px;}
[data-plugin="dsh-tokbook"] .dtpl-hero-meta{display:flex;flex-direction:column;gap:4px;align-items:flex-end;}
[data-plugin="dsh-tokbook"] .dtpl-meta{
  display:inline-flex;align-items:baseline;gap:4px;
  font-size:12px;line-height:18px;color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-meta-n{font-variant-numeric:tabular-nums;color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-meta-warn .dtpl-meta-n{color:var(--dtpl-warn);}

/* 统计磁贴 */
[data-plugin="dsh-tokbook"] .dtpl-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;}
/* 三个桶刚好填满一行，不留参差的半行。窄屏仍是 3 列——每块约 110px，够放标签和数字。 */
[data-plugin="dsh-tokbook"] .dtpl-grid-3{grid-template-columns:repeat(3,1fr);}
[data-plugin="dsh-tokbook"] .dtpl-stat{
  display:flex;flex-direction:column-reverse;gap:2px;
  padding:10px 12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-stat .dtpl-v{font-size:15px;line-height:20px;font-weight:650;font-variant-numeric:tabular-nums;}
[data-plugin="dsh-tokbook"] .dtpl-k{color:var(--dtpl-fg-3);font-size:12px;line-height:18px;}

/* 日趋势 */
[data-plugin="dsh-tokbook"] .dtpl-sec-title{
  font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
  margin:0 0 8px;
}
/* 节标题右侧挂一个派生指标（如缓存命中率）。 */
[data-plugin="dsh-tokbook"] .dtpl-sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-sec-head .dtpl-sec-title{margin:0 0 8px;}
[data-plugin="dsh-tokbook"] .dtpl-sec-aside{
  font-size:11px;line-height:18px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-trend{margin-bottom:14px;}
[data-plugin="dsh-tokbook"] .dtpl-bars{
  position:relative;
  display:flex;align-items:flex-end;gap:3px;height:76px;
  padding:20px 8px 8px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-bar{position:relative;flex:1 1 0;min-width:0;height:100%;display:flex;align-items:flex-end;}
[data-plugin="dsh-tokbook"] .dtpl-bar-fill{
  width:100%;border-radius:2px 2px 0 0;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 62%,transparent);
  transition:opacity .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-bar-fill.is-peak{background:var(--dtpl-accent);}
[data-plugin="dsh-tokbook"] .dtpl-bar:hover .dtpl-bar-fill{background:var(--dtpl-accent);}
/* 每根柱自带数值：不用悬停也能读图。垂直偏移写成 inline——重复填充高度的表达式，让数字贴在自己的柱顶。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-label{
  position:absolute;left:50%;transform:translateX(-50%);
  font-size:11px;line-height:14px;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
  white-space:nowrap;pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-peak{color:var(--dtpl-fg);font-weight:650;}
/* 零消费那天没有柱，标签落在基线上。 */
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-zero{color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-start{left:0;transform:none;}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-end{left:auto;right:0;transform:none;}
[data-plugin="dsh-tokbook"] .dtpl-trend-axis{
  display:flex;gap:3px;margin-top:4px;padding:0 8px;
  font-size:10px;line-height:16px;color:var(--dtpl-fg-3);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-trend-axis span{flex:1 1 0;min-width:0;text-align:center;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-trend-sum{
  margin:4px 0 0;font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
}

/* 明细切换（按模型 / 按工作区） */
/* 与窗口自己的 tab 同一套 segmented 配方，权重降一级且改为行内。aside 说明当前面板的排序——两个视角不共用排序键。 */
[data-plugin="dsh-tokbook"] .dtpl-bd{margin-bottom:14px;}
[data-plugin="dsh-tokbook"] .dtpl-bd-head{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-bottom:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-bd-tabs{
  display:inline-flex;gap:2px;padding:2px;
  border-radius:8px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab{
  appearance:none;border:0;background:transparent;
  height:22px;padding:0 10px;
  font:inherit;font-size:11px;line-height:16px;font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;
  border-radius:6px;corner-shape:round;cursor:pointer;
  transition:background .15s ease,color .15s ease,box-shadow .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab[aria-selected="true"]{
  color:var(--dtpl-fg);
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border,rgba(0,0,0,.14));
}

/* 模型 / 工作区面板 */
[data-plugin="dsh-tokbook"] .dtpl-models{display:flex;flex-direction:column;gap:10px;}
[data-plugin="dsh-tokbook"] .dtpl-row{display:flex;align-items:center;justify-content:space-between;gap:16px;}
[data-plugin="dsh-tokbook"] .dtpl-model{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;}
[data-plugin="dsh-tokbook"] .dtpl-model-name{
  color:var(--dtpl-fg);font-size:13px;line-height:20px;font-weight:500;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-model-provider{color:var(--dtpl-fg-3);font-size:11px;line-height:16px;}
[data-plugin="dsh-tokbook"] .dtpl-model-bar{
  display:block;width:100%;height:4px;border-radius:999px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);overflow:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-model-bar-fill{
  display:block;height:100%;border-radius:inherit;
  background:linear-gradient(90deg,var(--dtpl-accent),color-mix(in srgb,var(--dtpl-accent) 55%,transparent));
  transition:width .4s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-model-nums{display:flex;flex-direction:column;align-items:flex-end;gap:1px;flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-val{color:var(--dtpl-fg);font-size:13px;line-height:20px;font-variant-numeric:tabular-nums;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-cost{color:var(--dtpl-fg-2);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;white-space:nowrap;}

/* 工作区 */
/* 工作区标题下的身份行：目录，然后是让「最近优先」可读的两个事实。目录在挤压时让步（ellipsis）；事实永不裁。 */
[data-plugin="dsh-tokbook"] .dtpl-ws-meta{
  display:flex;align-items:baseline;gap:6px;min-width:0;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-ws-path{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-ws-sep{flex:none;color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-ws-facts{
  flex:none;font-variant-numeric:tabular-nums;white-space:nowrap;
}

/* 注释 */
[data-plugin="dsh-tokbook"] .dtpl-note{font-size:12px;line-height:18px;color:var(--dtpl-fg-2);margin:0 0 10px;}

/* 窗口底部（同步状态 · 最新记录 + 重扫） */
/* 钉住的 footer 同时回答两个新鲜度问题——重同步状态与最新记录时间——作为一组永远可见的信息。 */
[data-plugin="dsh-tokbook"] .dtpl-foot{
  flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 20px 14px;
  border-top:.5px solid var(--dtpl-border);
  background:color-mix(in srgb,var(--dtpl-fg) 2%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-foot-state{
  display:inline-flex;align-items:baseline;gap:8px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-sync{
  display:inline-flex;align-items:center;gap:6px;min-width:0;
  font-size:12px;line-height:18px;color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-sync-dot{
  flex:none;width:6px;height:6px;border-radius:50%;corner-shape:round;
  background:currentColor;
}
[data-plugin="dsh-tokbook"] .dtpl-sync-done{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-sync-error{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-sync-running{color:var(--dtpl-accent);}
[data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot{animation:dtpl-pulse 1.2s ease-in-out infinite;}
[data-plugin="dsh-tokbook"] .dtpl-foot-sep{color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-foot-latest{
  font-size:12px;line-height:18px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-rescan{
  display:inline-flex;align-items:center;gap:6px;flex:none;
  height:32px;padding:0 14px;border:none;border-radius:999px;corner-shape:round;
  background:var(--dtpl-accent-fill);color:var(--dtpl-on-accent);
  font:inherit;font-size:12px;line-height:18px;font-weight:500;cursor:pointer;
  transition:background .15s ease,opacity .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-rescan:hover:not(:disabled){background:var(--dtpl-accent-hover);}
[data-plugin="dsh-tokbook"] .dtpl-rescan:active:not(:disabled){transform:translateY(.5px);}
[data-plugin="dsh-tokbook"] .dtpl-rescan:disabled{opacity:.4;cursor:not-allowed;}
[data-plugin="dsh-tokbook"] .dtpl-rescan-ico{width:14px;height:14px;flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-spin{animation:dtpl-rotate 1s linear infinite;}

/* 错误 / 重试 */
[data-plugin="dsh-tokbook"] .dtpl-error{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-bottom:12px;padding:10px 12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-err) 8%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-error-text{
  margin:0;font-size:12px;line-height:18px;color:var(--dtpl-err);min-width:0;overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-retry{
  flex:none;height:26px;padding:0 12px;
  border:none;border-radius:999px;corner-shape:round;
  background:transparent;color:var(--dtpl-err);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-err) 45%,transparent);
  font:inherit;font-size:12px;line-height:18px;cursor:pointer;
  transition:background .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-retry:hover{background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);}

/* 骨架屏（加载中） */
[data-plugin="dsh-tokbook"] .dtpl-skeleton{display:flex;flex-direction:column;gap:12px;}
[data-plugin="dsh-tokbook"] .dtpl-sk{
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:linear-gradient(100deg,
    color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 40%,
    color-mix(in srgb,var(--dtpl-fg) 10%,transparent) 50%,
    color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 60%);
  background-size:200% 100%;
  animation:dtpl-shimmer 1.4s ease infinite;
}
[data-plugin="dsh-tokbook"] .dtpl-sk-hero{height:76px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-tile{height:56px;border-radius:var(--dtpl-radius-sm);}
[data-plugin="dsh-tokbook"] .dtpl-sk-chart{height:88px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-row{height:36px;}

/* 空状态 */
[data-plugin="dsh-tokbook"] .dtpl-empty{
  display:flex;flex-direction:column;align-items:center;text-align:center;
  padding:28px 20px;margin:8px 0 12px;
  border:1px dashed var(--dtpl-border);border-radius:var(--dtpl-radius-sm);corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-empty-ico{width:28px;height:28px;margin-bottom:10px;color:var(--dtpl-accent);opacity:.55;}
[data-plugin="dsh-tokbook"] .dtpl-empty-title{font-size:14px;line-height:22px;font-weight:600;color:var(--dtpl-fg);margin:0 0 4px;}
[data-plugin="dsh-tokbook"] .dtpl-empty-sub{font-size:12px;line-height:20px;color:var(--dtpl-fg-2);margin:0;max-width:44ch;}
[data-plugin="dsh-tokbook"] .dtpl-empty-sub code{
  font-family:var(--dtpl-mono);font-size:.9em;
  padding:.1em .35em;border-radius:5px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg);
}
`
