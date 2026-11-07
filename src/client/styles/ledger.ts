export const CSS_LEDGER = `
[data-plugin="dsh-tokbook"] .dtpl-inst{display:flex;flex-direction:column;gap:10px;}
[data-plugin="dsh-tokbook"] .dtpl-mod{
  border:1px solid var(--dtpl-border);background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-mod:first-child{box-shadow:var(--dtpl-metal);}
[data-plugin="dsh-tokbook"] .dtpl-mod-h{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:7px 14px;
  border-bottom:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-mod-t{
  display:flex;align-items:center;gap:8px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;letter-spacing:.14em;
  color:var(--dtpl-fg-2);margin:0;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-mod-t::before{
  content:"";flex:none;width:6px;height:6px;background:var(--dtpl-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-mod-aux{
  flex:none;
  font-family:var(--dtpl-mono);
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.06em;
  color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;white-space:nowrap;
}

[data-plugin="dsh-tokbook"] .dtpl-kpis{display:grid;grid-template-columns:1.3fr 1fr 1fr;}
[data-plugin="dsh-tokbook"] .dtpl-kpis-2{grid-template-columns:1.3fr 1fr;}
[data-plugin="dsh-tokbook"] .dtpl-kpi{position:relative;min-width:0;padding:14px 16px 13px;}
[data-plugin="dsh-tokbook"] .dtpl-kpi + .dtpl-kpi{border-left:1px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-kpi-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:500;letter-spacing:.06em;
  color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-kpi-v{
  font-family:var(--dtpl-mono);
  font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);font-weight:600;letter-spacing:-.02em;
  color:var(--dtpl-fg);font-variant-numeric:tabular-nums;white-space:nowrap;
  margin-top:5px;
}
[data-plugin="dsh-tokbook"] .dtpl-kpi:first-child .dtpl-kpi-v{
  font-size:var(--dtpl-fs-hero);line-height:var(--dtpl-lh-hero);letter-spacing:-.03em;
}
[data-plugin="dsh-tokbook"] .dtpl-kpi-v.is-zero{color:var(--dtpl-fg-2);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-kpi.is-sub .dtpl-kpi-v{color:var(--dtpl-fg-2);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-kpi-sub{
  display:flex;align-items:baseline;gap:6px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
  margin-top:6px;
}
[data-plugin="dsh-tokbook"] .dtpl-kpi-sub b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
}

[data-plugin="dsh-tokbook"] .dtpl-chart{padding:12px 14px 8px;}
[data-plugin="dsh-tokbook"] .dtpl-chart-svg{display:block;width:100%;height:auto;}
[data-plugin="dsh-tokbook"] .dtpl-chart-grid{stroke:var(--dtpl-hairline);stroke-width:1;}
[data-plugin="dsh-tokbook"] .dtpl-chart-base{stroke:var(--dtpl-border);stroke-width:1;}
[data-plugin="dsh-tokbook"] .dtpl-chart-tick{
  font-family:var(--dtpl-mono);
  font-size:var(--dtpl-fs-micro);fill:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-chart-tick.is-peak{fill:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-chart-tick.is-now{fill:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-chart-num{
  font-family:var(--dtpl-mono);
  font-size:var(--dtpl-fs-micro);fill:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-chart-area{fill:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-chart-line{fill:none;stroke:var(--dtpl-fg);stroke-width:1.5;}
[data-plugin="dsh-tokbook"] .dtpl-chart-dot{fill:var(--dtpl-card);stroke:var(--dtpl-fg);stroke-width:1.5;}
[data-plugin="dsh-tokbook"] .dtpl-chart-dot.is-peak{fill:var(--dtpl-fg);}

[data-plugin="dsh-tokbook"] .dtpl-buckets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));}
[data-plugin="dsh-tokbook"] .dtpl-buckets-3{grid-template-columns:repeat(3,minmax(0,1fr));}
[data-plugin="dsh-tokbook"] .dtpl-bucket{padding:11px 16px 13px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-bucket:nth-child(2n){border-left:1px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-bucket:nth-child(n+3){border-top:1px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-buckets-3 > .dtpl-bucket:nth-child(2n){border-left:1px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-buckets-3 > .dtpl-bucket:nth-child(n+3){border-top:0;}
[data-plugin="dsh-tokbook"] .dtpl-bucket-r{display:flex;align-items:baseline;justify-content:space-between;gap:10px;}
[data-plugin="dsh-tokbook"] .dtpl-bucket-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.1em;
  color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-bucket-p{
  font-family:var(--dtpl-mono);
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-bucket-v{
  font-family:var(--dtpl-mono);
  font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);font-weight:600;letter-spacing:-.01em;
  color:var(--dtpl-fg);font-variant-numeric:tabular-nums;white-space:nowrap;
  margin-top:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-bucket-bar{
  position:relative;height:5px;margin-top:8px;
  background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-bucket-bar i{
  position:absolute;left:0;top:0;bottom:0;
  background:var(--dtpl-fg);
}

[data-plugin="dsh-tokbook"] .dtpl-sk-mod-a{height:148px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-mod-b{height:201px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-mod-c{height:115px;}

[data-plugin="dsh-tokbook"] .dtpl-hero-facts{
  display:flex;flex-wrap:wrap;align-items:baseline;min-width:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-fact{white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-hero-facts b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-hero-facts i{font-style:normal;color:var(--dtpl-fg-dim);padding:0 5px;}
[data-plugin="dsh-tokbook"] .dtpl-cash-amt{
  font-style:normal;
  font-family:var(--dtpl-mono);color:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-sub-amt{
  font-style:normal;
  font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-weight:400;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-cost-na{
  font-style:normal;
  font-family:var(--dtpl-mono);color:var(--dtpl-fg-3);font-weight:400;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-cost-k{font-style:normal;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);margin-left:3px;}

[data-plugin="dsh-tokbook"] .dtpl-bd-tabs{display:inline-flex;gap:0;align-self:stretch;align-items:flex-end;}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab{
  position:relative;appearance:none;border:0;background:transparent;
  padding:3px 14px 8px;
  font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
  transition:color var(--dtpl-dur-quick) var(--dtpl-ease-tint),background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab + .dtpl-bd-tab{border-left:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab[aria-selected="true"]{
  color:var(--dtpl-fg);font-weight:600;
  background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab[aria-selected="true"]::after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-head .dtpl-sec-aside{margin:0 0 0 auto;}

[data-plugin="dsh-tokbook"] .dtpl-bd-cols,
[data-plugin="dsh-tokbook"] .dtpl-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(min-content,var(--dtpl-row-nums-w));
  column-gap:16px;
}
[data-plugin="dsh-tokbook"] .dtpl-bd-cols{
  padding:8px 0 6px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-col-id,
[data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{text-align:right;}

[data-plugin="dsh-tokbook"] .dtpl-models{display:flex;flex-direction:column;}
[data-plugin="dsh-tokbook"] .dtpl-row{align-items:start;padding:0;}
[data-plugin="dsh-tokbook"] .dtpl-row + .dtpl-row{margin-top:10px;}
[data-plugin="dsh-tokbook"] .dtpl-model{display:flex;align-items:flex-start;gap:8px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-model-txt{display:flex;flex-direction:column;gap:3px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-model-name{
  color:var(--dtpl-fg);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:500;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-model-provider{
  font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.04em;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-share-ring{position:relative;flex:none;width:44px;height:44px;}
[data-plugin="dsh-tokbook"] .dtpl-share-ring svg{display:block;}
[data-plugin="dsh-tokbook"] .dtpl-share-ring-track{
  fill:none;stroke:color-mix(in srgb,var(--dtpl-fg) 16%,transparent);stroke-width:1;
}
[data-plugin="dsh-tokbook"] .dtpl-share-ring-arc{fill:none;stroke:var(--dtpl-fg);stroke-width:2;}
[data-plugin="dsh-tokbook"] .dtpl-share-ring-num{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:1;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-share-ring-num i{font-style:normal;font-size:var(--dtpl-fs-micro);}
[data-plugin="dsh-tokbook"] .dtpl-model-nums{display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-val{
  font-family:var(--dtpl-mono);color:var(--dtpl-fg);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-cost{
  display:flex;align-items:baseline;justify-content:flex-end;gap:0;
  max-width:100%;
  font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-cost-seg{
  display:flex;align-items:baseline;gap:5px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-cost-sep{flex:none;padding:0 6px;color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-cost-main{min-width:0;overflow:hidden;text-overflow:ellipsis;}
[data-plugin="dsh-tokbook"] .dtpl-cost-k{
  flex:none;min-width:44px;margin-left:0;text-align:left;line-height:16px;white-space:nowrap;
}

[data-plugin="dsh-tokbook"] .dtpl-ws-meta{
  display:flex;align-items:baseline;gap:6px;min-width:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-ws-path{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-ws-sep{flex:none;color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-ws-facts{
  flex:none;font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-ws-fail{
  font-weight:600;color:var(--dtpl-warn-ink);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-row.is-unattributed{
  margin-top:22px;padding-top:14px;
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-row.is-unattributed .dtpl-model-name{
  color:var(--dtpl-fg-2);font-weight:400;
}

[data-plugin="dsh-tokbook"] .dtpl-foot{
  flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:11px 20px 14px;
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-foot-state{
  display:inline-flex;align-items:baseline;gap:8px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-sync{
  display:inline-flex;align-items:center;gap:6px;min-width:0;
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-sync-dot{
  flex:none;width:6px;height:6px;border-radius:50%;corner-shape:round;
  background:currentColor;
}
[data-plugin="dsh-tokbook"] .dtpl-sync-error{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-sync-running{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot{animation:dtpl-pulse 1.2s ease-in-out infinite;}
[data-plugin="dsh-tokbook"] .dtpl-foot-latest{
  font-family:var(--dtpl-mono);
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.04em;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-rescan{
  display:inline-flex;align-items:center;gap:6px;flex:none;
  height:30px;padding:0 12px;
  border:1px solid var(--dtpl-border);background:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;cursor:pointer;
  transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-rescan:hover:not(:disabled){
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
  border-color:color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-rescan:disabled{opacity:.4;cursor:not-allowed;}
[data-plugin="dsh-tokbook"] .dtpl-rescan-ico{width:14px;height:14px;flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-spin{animation:dtpl-rotate 1s linear infinite;}

[data-plugin="dsh-tokbook"] .dtpl-error{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-bottom:12px;padding:10px 12px;
  border:1px solid color-mix(in srgb,var(--dtpl-err) 45%,transparent);
  background:color-mix(in srgb,var(--dtpl-err) 8%,transparent);
  box-shadow:var(--dtpl-metal);
}
[data-plugin="dsh-tokbook"] .dtpl-error-text{
  margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-err);min-width:0;overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-retry{
  flex:none;height:26px;padding:0 12px;
  border:1px solid color-mix(in srgb,var(--dtpl-err) 45%,transparent);
  background:transparent;color:var(--dtpl-err);
  font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);cursor:pointer;
  transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-retry:hover{background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);}

[data-plugin="dsh-tokbook"] .dtpl-skeleton{display:flex;flex-direction:column;gap:10px;}
[data-plugin="dsh-tokbook"] .dtpl-sk{
  background:linear-gradient(100deg,
    color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 40%,
    color-mix(in srgb,var(--dtpl-fg) 10%,transparent) 50%,
    color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 60%);
  background-size:200% 100%;
  animation:dtpl-shimmer 1.4s ease infinite;
}
[data-plugin="dsh-tokbook"] .dtpl-sk-row{height:44px;}

[data-plugin="dsh-tokbook"] .dtpl-empty{
  display:flex;flex-direction:column;align-items:center;text-align:center;
  padding:36px 20px;margin:0 0 12px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
}
[data-plugin="dsh-tokbook"] .dtpl-empty-ico{width:24px;height:24px;margin-bottom:12px;color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-empty-title{
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);margin:0 0 6px;
}
[data-plugin="dsh-tokbook"] .dtpl-empty-sub{font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);margin:0;max-width:44ch;}
[data-plugin="dsh-tokbook"] .dtpl-empty-sub code{
  font-family:var(--dtpl-mono);font-size:.9em;
  padding:.1em .35em;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg);
}

[data-plugin="dsh-tokbook"] .dtpl-sec-title{
  display:flex;align-items:baseline;gap:9px;
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;letter-spacing:.04em;color:var(--dtpl-fg);
  margin:0 0 11px;
}
[data-plugin="dsh-tokbook"] .dtpl-sec-title::before{
  content:"";flex:none;align-self:center;
  width:7px;height:13px;
  background:var(--dtpl-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-sec-aside{
  flex:none;margin-bottom:11px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
`
