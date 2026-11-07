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
[data-plugin="dsh-tokbook"] .dtpl-tok-scroll{
  flex:1 1 0;min-height:0;overflow-y:auto;
  position:relative;
  padding-bottom:calc(var(--dsh-composer-height,152px) + 16px);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-col{
  position:relative;
  display:flex;flex-direction:column;gap:58px;
  width:100%;max-width:var(--dtpl-col-w);
  margin-inline:auto;
  box-sizing:border-box;
  padding:46px 4px 0 72px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-col::before{
  content:"";position:absolute;left:6px;top:14px;bottom:0;width:1px;
  background:var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-block{display:block;min-width:0;}

[data-plugin="dsh-tokbook"] .dtpl-tok-error{
  display:flex;align-items:center;gap:14px;
  margin:0 0 20px;padding:12px 14px;
  border:1px solid color-mix(in srgb,var(--dtpl-err) 38%,transparent);
  background:color-mix(in srgb,var(--dtpl-err) 5%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-error-text{
  margin:0;min-width:0;
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg);
  overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-retry{
  flex:none;margin-left:auto;height:28px;padding:0 12px;
  appearance:none;border:1px solid var(--dtpl-border);background:transparent;
  font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg);
  cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-retry:hover{background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-empty{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  min-height:300px;padding:48px 24px;text-align:center;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-empty-ico{width:24px;height:24px;color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-tok-empty-title{
  margin:0;font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-empty-sub{
  margin:0;max-width:44ch;
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sk{
  height:260px;
  background:
    linear-gradient(90deg,
      color-mix(in srgb,var(--dtpl-fg) 4%,transparent) 0%,
      color-mix(in srgb,var(--dtpl-fg) 9%,transparent) 50%,
      color-mix(in srgb,var(--dtpl-fg) 4%,transparent) 100%);
  background-size:200% 100%;
  animation:dtpl-tok-shimmer 1400ms linear infinite;
}

[data-plugin="dsh-tokbook"] .dtpl-tok-sec{position:relative;display:block;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sec::before{
  content:"";position:absolute;left:-66px;top:8px;width:7px;height:7px;
  background:var(--dtpl-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sec-h{
  display:flex;align-items:baseline;gap:14px;
  margin:0 0 24px;padding-bottom:11px;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sec-k{
  margin:0;font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);
  font-weight:700;letter-spacing:.02em;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sec-aside{
  margin-left:auto;min-width:0;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-note{
  margin:0 0 14px;
  font-size:var(--dtpl-fs-label);line-height:18px;color:var(--dtpl-fg-2);
  overflow-wrap:anywhere;
}

[data-plugin="dsh-tokbook"] .dtpl-tok-hero{display:flex;flex-direction:column;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-k{
  margin:0 0 8px;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  color:var(--dtpl-fg-2);letter-spacing:.12em;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-row{display:flex;align-items:flex-start;gap:48px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-lead{display:flex;flex-direction:column;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-num{
  font-family:var(--dtpl-mono);font-size:72px;line-height:76px;font-weight:700;letter-spacing:-.04em;
  font-variant-numeric:tabular-nums;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-sub{
  margin-top:10px;
  font-size:var(--dtpl-fs-label);line-height:18px;color:var(--dtpl-fg-2);
  overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-facts{
  margin:6px 0 0 auto;padding-left:26px;
  border-left:1px solid var(--dtpl-hairline);
  display:flex;flex-direction:column;gap:12px;min-width:236px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-fact{display:flex;align-items:baseline;justify-content:space-between;gap:18px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-fact-k{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-fact-v{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);
  font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dtpl-fg);
}

[data-plugin="dsh-tokbook"] .dtpl-tok-mix{margin-top:36px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-bar{
  display:flex;align-items:stretch;height:16px;min-width:0;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-seg{
  flex:none;height:100%;
  box-shadow:inset -2px 0 0 0 var(--dtpl-surface);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-seg:last-child{box-shadow:none;}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-mark{flex:none;width:9px;height:10px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-seg[data-bucket="inputTokens"],
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-mark[data-bucket="inputTokens"]{
  background:color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-seg[data-bucket="cacheReadTokens"],
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-mark[data-bucket="cacheReadTokens"]{
  background:color-mix(in srgb,var(--dtpl-fg) 68%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-seg[data-bucket="cacheWriteTokens"],
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-mark[data-bucket="cacheWriteTokens"]{
  background:
    repeating-linear-gradient(90deg,var(--dtpl-fg) 0 1.5px,transparent 1.5px 5px),
    color-mix(in srgb,var(--dtpl-fg) 84%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-seg[data-bucket="outputTokens"],
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-mark[data-bucket="outputTokens"]{
  background:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-cells{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-cell{
  min-width:0;padding:16px 0 0 18px;
  border-left:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-cell:first-child{padding-left:0;border-left:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-k{
  display:flex;align-items:center;gap:7px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-v{
  margin-top:6px;display:block;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);
  font-weight:600;font-variant-numeric:tabular-nums;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-p{
  margin-top:2px;display:block;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-note{
  display:flex;align-items:baseline;justify-content:space-between;gap:20px;
  margin:18px 0 0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-hit{white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-tok-mix-hit b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;
}

[data-plugin="dsh-tokbook"] .dtpl-tok-time-k{
  margin:0 0 4px;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  color:var(--dtpl-fg-2);letter-spacing:.1em;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-lead{display:flex;align-items:baseline;gap:18px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-num{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-hero);line-height:var(--dtpl-lh-hero);
  font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-pct{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-track{margin-top:20px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-track .dtpl-tok-bar[data-tone="hero"]{height:12px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-eq{
  margin:22px 0 0;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:18px;
  color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-marks{
  display:flex;flex-wrap:wrap;gap:10px 34px;min-width:0;
  margin:20px 0 0;padding-top:16px;
  border-top:1px solid var(--dtpl-hairline);
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-mark{display:inline-flex;align-items:baseline;gap:8px;white-space:nowrap;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-where{color:var(--dtpl-fg-3);overflow:hidden;text-overflow:ellipsis;}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-mark b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-gap{
  margin:14px 0 0;
  font-size:var(--dtpl-fs-label);line-height:18px;color:var(--dtpl-fg-3);
  overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-time-gap b{font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg-2);}

[data-plugin="dsh-tokbook"] .dtpl-tok-chart{position:relative;min-width:0;}
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
[data-plugin="dsh-tokbook"] .dtpl-tok-swatch{
  flex:none;width:8px;height:8px;align-self:center;
  background-color:color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-bars{
  display:flex;align-items:flex-end;position:relative;
  height:76px;margin-top:22px;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-slot{
  position:relative;flex:1 1 0;min-width:0;height:100%;
  display:flex;align-items:flex-end;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-slot-fill{
  display:block;width:min(52%,34px);margin:0 auto;
  background:color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
  transform-origin:bottom;
  transition:height var(--dtpl-dur-move) var(--dtpl-ease-move);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-slot-fill[data-peak]{background:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-tok-slot-label{
  position:absolute;left:50%;transform:translateX(-50%);
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);
  color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-slot-label[data-peak]{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-tok-axis{display:flex;margin-top:8px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-axis span{
  flex:1 1 0;min-width:0;text-align:center;white-space:nowrap;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-axis span[data-peak]{color:var(--dtpl-fg);font-weight:600;}
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

[data-plugin="dsh-tokbook"] .dtpl-tok-legend{
  display:flex;flex-wrap:wrap;align-items:center;gap:6px 22px;
  margin:0 0 6px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-read{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-mark{width:9px;height:10px;flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-model{display:inline-flex;align-items:center;gap:6px;color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-say{margin-left:auto;color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-mark[data-kind="wait"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="wait"]{
  background:
    repeating-linear-gradient(90deg,
      color-mix(in srgb,var(--dtpl-fg) 66%,transparent) 0 1.5px,
      transparent 1.5px 4px),
    color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-mark[data-kind="generate"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="generate"]{background:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-mark[data-kind="tool"],
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="tool"]{
  background:
    repeating-linear-gradient(45deg,
      color-mix(in srgb,var(--dtpl-fg) 88%,transparent) 0 1.5px,
      transparent 1.5px 6px),
    color-mix(in srgb,var(--dtpl-fg) 72%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-legend-mark[data-kind="model"],
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="model"]{
  background:
    repeating-linear-gradient(90deg,var(--dtpl-fg) 0 1.5px,transparent 1.5px 5px),
    repeating-linear-gradient(45deg,var(--dtpl-fg) 0 1.5px,transparent 1.5px 5px),
    color-mix(in srgb,var(--dtpl-fg) 55%,transparent);
}

[data-plugin="dsh-tokbook"] .dtpl-tok-order{
  display:flex;flex:none;align-items:center;align-self:center;
  margin-left:auto;
  border:1px solid var(--dtpl-border);
  font-weight:400;letter-spacing:normal;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-order .dtpl-range-tab{border-bottom:0;height:22px;padding:0 9px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-order .dtpl-range-tab.dtpl-range-active::after{display:none;}

[data-plugin="dsh-tokbook"] .dtpl-tok-turns{display:flex;flex-direction:column;min-width:0;border-top:1px solid var(--dtpl-border);}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn{
  display:block;min-width:0;
  border-bottom:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn[data-open]{
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  margin:0 -18px;padding:0 18px;
  border-bottom-color:var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-h{
  display:grid;
  grid-template-columns:104px minmax(0,1fr) auto 14px;
  grid-template-areas:
    "k reads money cue"
    "bar bar bar bar"
    "reads2 reads2 reads2 reads2"
    "preview preview preview preview";
  gap:0 18px;
  width:100%;margin:0;padding:15px 0;
  appearance:none;border:0;background:transparent;
  font:inherit;text-align:left;color:var(--dtpl-fg);cursor:pointer;
  transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-h:hover{background:var(--dtpl-wash-hover);}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-k{
  grid-area:k;font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:700;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-reads{
  grid-area:reads;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 18px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-reads b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-bad{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-bad b{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-model{
  min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-money{
  grid-area:money;justify-self:end;white-space:nowrap;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
  font-weight:600;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-money[data-kind="subscription"]{color:var(--dtpl-fg-2);font-weight:500;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-money[data-kind="unpriced"]{color:var(--dtpl-fg-3);font-weight:400;font-size:var(--dtpl-fs-label);}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-bar{grid-area:bar;display:block;min-width:0;margin-top:11px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-bar .dtpl-tok-bar[data-tone="turn"]{height:14px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-h > .dtpl-tok-reads{grid-area:reads2;margin-top:9px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-preview{
  grid-area:preview;display:flex;flex-direction:column;min-width:0;margin-top:10px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-ask,
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-reply{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-reply::before{content:"\\21b3 ";color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-note{
  grid-area:preview;margin-top:10px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-3);
  overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-cue{
  grid-area:cue;align-self:center;justify-self:end;
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
  transition:transform var(--dtpl-dur-move) var(--dtpl-ease-move);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-turn-h[aria-expanded="true"] .dtpl-tok-turn-cue{transform:rotate(180deg);}

[data-plugin="dsh-tokbook"] .dtpl-tok-steps{
  display:grid;grid-template-rows:0fr;overflow:hidden;
  transition:grid-template-rows var(--dtpl-dur-move) var(--dtpl-ease-move);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps[data-open="true"]{grid-template-rows:1fr;}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner{
  padding:0 0 0 20px;margin:0 0 0 20px;overflow:hidden;
  border-left:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner > .dtpl-tok-step:first-child{padding-top:6px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner > .dtpl-tok-step:last-child{padding-bottom:18px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step + .dtpl-tok-step{
  margin-top:14px;padding-top:14px;
  border-top:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  grid-template-areas:"id cost" "read read" "timing timing";
  gap:0 18px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-id{grid-area:id;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-cost{grid-area:cost;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-read{grid-area:read;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-timing{grid-area:timing;display:block;margin-top:9px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-id{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-no{
  font-size:13px;line-height:18px;font-weight:600;color:var(--dtpl-fg);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-time{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-model{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-chip{
  flex:none;font-style:normal;font-size:var(--dtpl-fs-label);line-height:16px;font-weight:600;
  padding:0 5px;
  border:1px solid var(--dtpl-border);
  color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-chip[data-kind="failure"]{border-color:var(--dtpl-err);color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost{display:flex;align-items:baseline;gap:7px;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost-k{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-cost-k i{font-style:normal;font-size:var(--dtpl-fs-micro);color:var(--dtpl-fg-3);margin-left:4px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-amt,
[data-plugin="dsh-tokbook"] .dtpl-tok-amt-sub,
[data-plugin="dsh-tokbook"] .dtpl-tok-amt-na{
  font-family:var(--dtpl-mono);font-size:13px;line-height:18px;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-amt{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-tok-amt-sub{color:var(--dtpl-fg-2);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-tok-amt-na{color:var(--dtpl-fg-3);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-read{
  display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:0 20px;
  min-width:0;margin-top:9px;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-buckets{display:grid;grid-template-columns:repeat(4,62px);gap:0 10px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-bk{display:flex;flex-direction:column;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-bk-k{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-bk-v{
  font-family:var(--dtpl-mono);font-size:13px;line-height:18px;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-bar{display:block;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-bar .dtpl-tok-bar[data-tone="step"]{height:14px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-step-flat{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-tok-untimed{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-3);}

[data-plugin="dsh-tokbook"] .dtpl-tok-metrics{
  display:grid;
  grid-template-columns:repeat(var(--dtpl-tok-cells,5),var(--dtpl-tok-cell-w));
  gap:0 10px;
  min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metrics.is-flat{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;}
[data-plugin="dsh-tokbook"] .dtpl-tok-metric{display:flex;flex-direction:column;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-metric-k{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metric-v{
  font-family:var(--dtpl-mono);font-size:13px;line-height:18px;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-metrics.is-flat .dtpl-tok-untimed.is-note{
  flex:1 1 100%;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}

[data-plugin="dsh-tokbook"] .dtpl-tok-bar{display:flex;min-width:0;align-items:stretch;width:100%;}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="step"],
[data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="turn"]{height:16px;}
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
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="wait"]{
  background:
    repeating-linear-gradient(90deg,
      color-mix(in srgb,var(--dtpl-fg) 66%,transparent) 0 1.5px,
      transparent 1.5px 4px),
    color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="generate"]{background:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="tool"]{
  background:
    repeating-linear-gradient(45deg,
      color-mix(in srgb,var(--dtpl-fg) 88%,transparent) 0 1.5px,
      transparent 1.5px 6px),
    color-mix(in srgb,var(--dtpl-fg) 72%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-reads{
  display:flex;flex-wrap:wrap;gap:2px 16px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-ratio{display:flex;flex-direction:column;gap:6px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-hero-ratio .dtpl-tok-reads{justify-content:space-between;}
[data-plugin="dsh-tokbook"] .dtpl-tok-read{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-tok-read[data-over]{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-tok-read[data-over] b{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-tok-read b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark{flex:none;width:9px;height:10px;box-shadow:none;}
[data-plugin="dsh-tokbook"] .dtpl-tok-read[data-over] .dtpl-tok-read-mark[data-kind="wait"]{
  background:
    repeating-linear-gradient(90deg,
      color-mix(in srgb,var(--dtpl-err) 72%,transparent) 0 1.5px,
      transparent 1.5px 4px),
    color-mix(in srgb,var(--dtpl-err) 58%,transparent);
}

[data-plugin="dsh-tokbook"] .dtpl-tok-sub{display:block;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cell{display:flex;flex-direction:column;min-width:0;padding:0 0 18px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cell + .dtpl-tok-sub-cell{padding-left:26px;border-left:1px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-k{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-v{
  margin-top:6px;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-hero);line-height:var(--dtpl-lh-hero);
  font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-p{margin-top:4px;font-size:var(--dtpl-fs-label);line-height:18px;color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-rows{margin-top:6px;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-row{
  display:grid;
  grid-template-columns:20px minmax(0,1fr) 116px 62px 84px 122px;
  gap:0 14px;align-items:center;
  padding:13px 0;
  border-bottom:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-i{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-name{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-label{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:13px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-extra{flex:none;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-track{display:block;height:6px;background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-track i{display:block;height:100%;background:color-mix(in srgb,var(--dtpl-fg) 58%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-share{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  color:var(--dtpl-fg-2);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-tokens{
  font-family:var(--dtpl-mono);font-size:13px;line-height:18px;font-weight:600;
  text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost{
  font-family:var(--dtpl-mono);font-size:13px;line-height:18px;
  text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="spend"]{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="subscription"]{color:var(--dtpl-fg-2);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="unpriced"],
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="none"]{color:var(--dtpl-fg-3);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-note{
  display:flex;flex-wrap:wrap;gap:2px 6px;align-items:baseline;
  margin:12px 0 0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-sub-note i{font-style:normal;color:var(--dtpl-fg-dim);padding:0 5px;}

[data-plugin="dsh-tokbook"] .dtpl-tok-foot{
  display:flex;flex-direction:column;gap:10px;
  border-top:1px solid var(--dtpl-border);
  padding:20px 0 0;
}
[data-plugin="dsh-tokbook"] .dtpl-tok-foot-facts{
  display:flex;flex-wrap:wrap;gap:6px 22px;margin:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-foot-facts b{font-family:var(--dtpl-mono);color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-tok-foot .dtpl-tok-note{margin:0;max-width:64ch;color:var(--dtpl-fg-3);}

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

@keyframes dtpl-tok-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}

@media (prefers-reduced-motion:no-preference){
  [data-plugin="dsh-tokbook"] .dtpl-tok-col > .dtpl-tok-block{
    animation:dtpl-rise var(--dtpl-dur-enter) var(--dtpl-ease-move) both;
    animation-delay:calc(var(--dtpl-tok-i,0) * 40ms);
  }
}

@media (max-width:640px){
  [data-plugin="dsh-tokbook"] .dtpl-tok-col{padding:28px 2px 0 30px;gap:40px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-col::before{left:4px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sec::before{left:-26px;top:6px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sec-h{flex-wrap:wrap;gap:8px 12px;padding-bottom:9px;margin-bottom:18px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sec-aside{margin-left:0;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-hero-row{flex-direction:column;gap:22px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-hero-num{font-size:var(--dtpl-fs-hero);line-height:var(--dtpl-lh-hero);letter-spacing:-.03em;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-hero-facts{
    margin:0;padding:16px 0 0;border-left:0;border-top:1px solid var(--dtpl-hairline);
    min-width:0;width:100%;
  }
  [data-plugin="dsh-tokbook"] .dtpl-tok-mix-cells{grid-template-columns:repeat(2,minmax(0,1fr));}
  [data-plugin="dsh-tokbook"] .dtpl-tok-mix-cell{padding:14px 0 0;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-mix-cell:nth-child(even){padding-left:16px;border-left:1px solid var(--dtpl-hairline);}
  [data-plugin="dsh-tokbook"] .dtpl-tok-mix-cell:nth-child(n+3){margin-top:16px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-mix-note{flex-direction:column;gap:6px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-time-num{font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);}
  [data-plugin="dsh-tokbook"] .dtpl-tok-time-marks{gap:8px 20px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-turn-h{
    grid-template-columns:minmax(0,1fr) auto 14px;
    grid-template-areas:
      "k money cue" "reads reads reads" "bar bar bar" "reads2 reads2 reads2" "preview preview preview";
  }
  [data-plugin="dsh-tokbook"] .dtpl-tok-turn[data-open]{margin:0 -10px;padding:0 10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner{padding-left:12px;margin-left:10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-step{grid-template-columns:minmax(0,1fr);grid-template-areas:"id" "cost" "read" "timing";}
  [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost{margin-top:6px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-step-read{grid-template-columns:minmax(0,1fr);gap:10px 0;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-step-buckets{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-metrics{grid-template-columns:repeat(var(--dtpl-tok-cells,5),minmax(0,1fr));}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-cell + .dtpl-tok-sub-cell{
    padding-left:0;padding-top:16px;border-left:0;border-top:1px solid var(--dtpl-hairline);
  }
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-v{font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-row{
    grid-template-columns:20px minmax(0,1fr) auto;
    grid-template-areas:"i name name" "i track track" "i share cost" "i tokens tokens";
    row-gap:6px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-i{grid-area:i;align-self:start;padding-top:3px;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-name{grid-area:name;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-track{grid-area:track;width:100%;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-share{grid-area:share;text-align:left;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-tokens{grid-area:tokens;text-align:left;font-weight:400;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost{grid-area:cost;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-legend-say{margin-left:0;flex:1 1 100%;}
}
@media (prefers-reduced-motion:reduce){
  [data-plugin="dsh-tokbook"] .dtpl-tok-turn-cue{transition:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-steps{transition:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-col > .dtpl-tok-block{animation:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-sk{animation:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tok-slot-fill{transition:none;}
}
`
