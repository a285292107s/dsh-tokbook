export const CSS_SESSION = `
[data-plugin="dsh-tokbook"].dtpl-tok{
  --dtpl-col-w:var(--dtpl-tok-width,var(--dsh-chat-content-width,920px));
  display:flex;flex-direction:column;
  flex:1 1 0;min-height:0;overflow:hidden;
  position:relative;
  color:var(--dtpl-fg);
  background:var(--dtpl-paper);
  background-size:var(--dtpl-paper-size);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-timing{
  display:flex;flex-direction:column;gap:12px;
  background:
    linear-gradient(180deg,
      color-mix(in srgb,var(--dtpl-fg) 1.8%,transparent) 0%,
      color-mix(in srgb,var(--dtpl-fg) 0.6%,transparent) 100%);
  border:1px solid var(--dtpl-border);
  padding:18px 20px 16px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-timing-grid{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-timing .dtpl-tok-hero-ratio{margin-top:-6px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-timing .dtpl-hero-facts{margin-top:-2px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub{
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum .dtpl-stat{padding:16px 18px 10px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum .dtpl-stat + .dtpl-stat{border-left:1px solid var(--dtpl-border);}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-list{
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto auto auto;
  grid-template-areas:"name tokens share cost";
  align-items:baseline;gap:4px 16px;
  padding:10px 18px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-row + .dtpl-tok-sub-row{
  border-top:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-name{
  grid-area:name;display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;
  min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-label{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-extra{
  flex:none;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-tokens{
  grid-area:tokens;white-space:nowrap;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;
  font-variant-numeric:tabular-nums;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-share{
  grid-area:share;white-space:nowrap;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost{
  grid-area:cost;white-space:nowrap;justify-self:end;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="spend"]{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="subscription"]{color:var(--dtpl-fg-2);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="unpriced"],
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="none"]{color:var(--dtpl-fg-3);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-note{
  display:flex;flex-wrap:wrap;gap:2px 6px;align-items:baseline;
  margin:0;padding:0 18px 14px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-note i{font-style:normal;color:var(--dtpl-fg-dim);padding:0 5px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-scroll{
  flex:1 1 0;min-height:0;overflow-y:auto;
  position:relative;
  padding-bottom:calc(var(--dsh-composer-height,152px) + 16px);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-col{
  display:flex;flex-direction:column;gap:32px;
  width:100%;max-width:var(--dtpl-col-w);
  margin-inline:auto;
  box-sizing:border-box;
  padding:0 4px;
}
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
[data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-dragging]{z-index:2;}
[data-plugin="dsh-tokbook"] .dtpl-tok-head{
  display:flex;flex-direction:column;gap:10px;
  --dtpl-tok-head-pad:32px;
  padding:28px var(--dtpl-tok-head-pad) 24px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-note{
  margin:-5px 0 10px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-head .dtpl-total-num{
  font-size:72px;line-height:76px;font-weight:700;letter-spacing:-.06em;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-head .dtpl-total-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.08em;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-foot{
  border:1px solid var(--dtpl-border);
  border-top:0;
  margin-top:4px;
  padding:16px 20px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-foot .dtpl-tok-note{margin:6px 0 0;}

[data-plugin="dsh-tokbook"] .dtpl-tok-mix-band{
  margin:10px calc(var(--dtpl-tok-head-pad) * -1) -24px;
  padding:0 var(--dtpl-tok-head-pad);
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-band .dtpl-tok-note{
  display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 16px;
  margin:0;padding:14px 0 0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-hit{white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-hit b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;
}

[data-plugin="dsh-tokbook"] .dtpl-tok-plot{
  --dtpl-slot-w:48px;
  display:flex;flex-direction:column;gap:24px;
  min-width:min(280px,100%);
  max-width:calc(var(--dtpl-slots,4) * 92px + 28px);
  overflow-x:auto;
  scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,var(--dtpl-fg) 30%,transparent) transparent;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-plot > *{
  box-sizing:border-box;
  min-width:calc(var(--dtpl-slots,4) * var(--dtpl-slot-w));
}
[data-plugin="dsh-tokbook"] .dtpl-tok-chart{position:relative;}
[data-plugin="dsh-tokbook"] .dtpl-tok-hover{
  position:absolute;z-index:1;pointer-events:none;
  display:flex;flex-direction:column;gap:5px;
  box-sizing:border-box;
  max-width:min(300px,100%);
  padding:8px 10px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-card);
  box-shadow:var(--dtpl-metal);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-hover-basis{
  margin:0;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-hover-buckets{font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);}
[data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-bars{height:80px;margin-top:22px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-trend-axis{margin-top:-6px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-panel{display:flex;flex-direction:column;}
[data-plugin="dsh-tokbook"] .dtpl-tok-panel-k{
  display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin:0;
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-panel-v,
[data-plugin="dsh-tokbook"] .dtpl-tok-panel-k i{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);font-weight:400;
  font-style:normal;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-bar-fill{
  width:min(52%,48px);margin:0 auto;
  background:linear-gradient(180deg,
    color-mix(in srgb,var(--dtpl-fg) 52%,transparent) 0%,
    color-mix(in srgb,var(--dtpl-fg) 42%,transparent) 100%);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-swatch{
  flex:none;width:8px;height:8px;align-self:center;
  background-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}

[data-plugin="dsh-tokbook"] .dtpl-tok-turns{display:flex;flex-direction:column;gap:14px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn{
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:0 1px 0 0 color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
  transition:box-shadow .2s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn:hover{
  box-shadow:0 2px 0 0 color-mix(in srgb,var(--dtpl-fg) 6%,transparent),
    0 8px 24px -12px color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn:has(.dtpl-tok-turn-head[aria-expanded="true"]){
  box-shadow:0 2px 0 0 color-mix(in srgb,var(--dtpl-fg) 6%,transparent),
    0 8px 24px -12px color-mix(in srgb,var(--dtpl-fg) 18%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn.is-loose{
  background:transparent;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn.is-loose .dtpl-tok-turn-k{
  font-weight:500;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head{
  display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 14px;
  width:100%;margin:0;padding:14px 18px;
  appearance:none;border:0;background:transparent;
  font:inherit;text-align:left;color:var(--dtpl-fg);cursor:pointer;
  transition:background .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head:hover{background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-k{flex:none;font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head .dtpl-hero-facts{
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-cue{
  flex:none;margin-left:auto;align-self:center;
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
  transition:transform .3s cubic-bezier(.22,.68,.24,1);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head[aria-expanded="true"] .dtpl-tok-turn-cue{transform:rotate(180deg);}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-preview{
  flex:1 1 100%;min-width:0;
  display:flex;flex-direction:column;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-ask,
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-reply{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-reply::before{content:"↳ ";color:var(--dtpl-fg-dim);}

[data-plugin="dsh-tokbook"] .dtpl-tok-steps{
  display:grid;grid-template-rows:0fr;overflow:hidden;
  transition:grid-template-rows .3s cubic-bezier(.22,.68,.24,1);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps[data-open="true"]{grid-template-rows:1fr;}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner{padding:0 18px;overflow:hidden;}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner > .dtpl-row:first-child{margin-top:6px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner > .dtpl-row:last-child{margin-bottom:16px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps .dtpl-row + .dtpl-row{
  margin-top:24px;padding-top:8px;
  border-top:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step{
  position:relative;
  grid-template-columns:minmax(0,1fr) auto;
  grid-template-areas:"id cost" "bar bar" "read read";
  row-gap:10px;
  padding-left:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step::before{
  content:"";position:absolute;left:0;top:1px;bottom:0;width:2px;
  background:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-id{grid-area:id;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-cost{grid-area:cost;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-read{grid-area:read;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-bar{
  display:block;min-width:0;grid-area:bar;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-bar{
  flex:1 1 100%;display:block;min-width:0;margin-top:6px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-id{
  display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-no{
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-time{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-model{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-chip{
  flex:none;font-style:normal;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;
  padding:0 5px;
  border:1px solid var(--dtpl-border);
  color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-chip[data-kind="failure"]{border-color:var(--dtpl-err);color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost{
  display:flex;align-items:baseline;gap:7px;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost-k i{
  font-style:normal;font-size:var(--dtpl-fs-micro);color:var(--dtpl-fg-3);margin-left:4px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cash-amt,
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-sub-amt,
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cost-na{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cash-amt{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-sub-amt{color:var(--dtpl-fg-2);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cost-na{color:var(--dtpl-fg-3);font-weight:400;}

[data-plugin="dsh-tokbook"] .dtpl-tok-step-read{
  display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:flex-start;
  gap:8px 18px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metrics{
  display:grid;
  grid-template-columns:repeat(var(--dtpl-tok-cells,5),var(--dtpl-tok-cell-w));
  gap:0 10px;
  min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-tokens{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-tok-cell-w));
  gap:0 10px;
  min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metrics.is-flat{
  display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;
  flex:1 1 100%;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metric{
  display:flex;flex-direction:column;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metric-k{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metric-v{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-untimed{
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metrics.is-flat .dtpl-tok-untimed.is-note{
  flex:1 1 100%;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}

[data-plugin="dsh-tokbook"] .dtpl-tok-bar{
  display:flex;min-width:0;
  align-items:stretch;
  width:100%;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="step"],
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="turn"]{height:16px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="hero"]{height:8px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="turn"],
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="hero"]{
  --dtpl-tok-track:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
  background:var(--dtpl-tok-track);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-fg) 16%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg{
  height:100%;flex:none;
  box-shadow:inset -1px 0 0 0 var(--dtpl-tok-track,color-mix(in srgb,var(--dtpl-fg) 10%,transparent));
}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg:last-child{box-shadow:none;}

[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="wait"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="wait"]{
  background:
    repeating-linear-gradient(90deg,
      color-mix(in srgb,var(--dtpl-fg) 66%,transparent) 0 1.5px,
      transparent 1.5px 4px),
    color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="generate"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="generate"]{background:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="tool"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="tool"]{
  background:
    repeating-linear-gradient(45deg,
      color-mix(in srgb,var(--dtpl-fg) 88%,transparent) 0 1.5px,
      transparent 1.5px 6px),
    color-mix(in srgb,var(--dtpl-fg) 72%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="model"],
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-key[data-kind="model"]{
  background:
    repeating-linear-gradient(90deg,
      var(--dtpl-fg) 0 1.5px,
      transparent 1.5px 5px),
    repeating-linear-gradient(45deg,
      var(--dtpl-fg) 0 1.5px,
      transparent 1.5px 5px),
    color-mix(in srgb,var(--dtpl-fg) 55%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="work"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="work"]{background:color-mix(in srgb,var(--dtpl-fg) 84%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="idle"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="idle"]{background:color-mix(in srgb,var(--dtpl-fg) 26%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-reads{
  display:flex;flex-wrap:wrap;gap:2px 16px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-ratio{
  display:flex;flex-direction:column;gap:6px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-ratio .dtpl-tok-reads{justify-content:space-between;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-head > .dtpl-tok-reads{
  flex:1 1 100%;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-read{
  display:inline-flex;align-items:center;gap:5px;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-read b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark{
  flex:none;width:9px;height:10px;box-shadow:none;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend{
  display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px 10px;margin:0 0 10px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-figure{
  display:flex;flex-direction:column;gap:4px;
  width:232px;flex:none;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-keys{
  display:flex;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-keys > span{
  flex-basis:0;
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-model{
  display:inline-flex;align-items:center;gap:5px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-key{
  display:inline-block;width:9px;height:12px;flex:none;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-say{
  margin-left:auto;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-tail{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-top:10px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-block{display:block;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-sec-title{
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:700;letter-spacing:.02em;
  margin:0 0 14px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-grid{
  gap:0 16px;
  border-top:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-stat + .dtpl-stat{border-left:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-stat{
  padding:16px 18px 14px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-band .dtpl-stat{
  padding:10px 18px 20px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-stat:hover{
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  border-left:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sk{height:220px;}

@media (prefers-reduced-motion:no-preference){
  [data-plugin="dsh-tokbook"] .dtpl-tok-col > *{
    animation:dtpl-rise .26s cubic-bezier(.22,.68,.24,1) both;
    animation-delay:calc(var(--dtpl-tok-i,0) * 40ms);
  }
}

@media (max-width:640px){
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum .dtpl-stat + .dtpl-stat{border-left:0;border-top:1px solid var(--dtpl-border);}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-row{
    grid-template-columns:minmax(0,1fr) auto;
    grid-template-areas:"name name" "tokens share" "cost cost";
  }
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost{justify-self:start;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-tail{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-tok-hero-ratio .dtpl-tok-reads{justify-content:flex-start;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-turn-head{padding-left:10px;padding-right:10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-head{--dtpl-tok-head-pad:10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner{padding-left:10px;padding-right:10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-step{
    grid-template-columns:minmax(0,1fr);
    grid-template-areas:"id" "cost" "bar" "read";
  }
  [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost{justify-content:flex-start;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-step-read{gap:10px 0;}
}
@media (prefers-reduced-motion:reduce){
  [data-plugin="dsh-tokbook"] .dtpl-tok-turn-cue{transition:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-col > *{animation:none;}
}
`
