export const CSS_LEDGER = `
[data-plugin="dsh-tokbook"] .dtpl-grid > .dtpl-empty{margin:0;}
[data-plugin="dsh-tokbook"] .dtpl-mod-h{
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:2px 12px;
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

[data-plugin="dsh-tokbook"] .dtpl-card-today{
  position:relative;overflow:hidden;
  container-type:inline-size;
}
[data-plugin="dsh-tokbook"] .dtpl-card-today::before{
  content:"";position:absolute;left:0;right:0;top:0;height:3px;
  background:var(--dtpl-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-today{
  display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;
  padding:18px 18px 0;
}
[data-plugin="dsh-tokbook"] .dtpl-today-top{
  display:grid;grid-template-columns:minmax(240px,1fr) minmax(0,1.8fr) 250px;
  grid-template-areas:"hero mix money";
  column-gap:24px;align-items:stretch;
}
[data-plugin="dsh-tokbook"] .dtpl-today-hero{grid-area:hero;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-today-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.08em;color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-today-v{
  font-family:var(--dtpl-mono);
  font-size:clamp(52px,8.4cqi,92px);line-height:.98;font-weight:600;letter-spacing:-.05em;
  color:var(--dtpl-fg);font-variant-numeric:tabular-nums;white-space:nowrap;
  margin-top:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-today-sub{
  display:flex;align-items:baseline;gap:6px;min-width:0;
  margin-top:6px;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
[data-plugin="dsh-tokbook"] .dtpl-today-sub b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-today-money{
  grid-area:money;display:flex;flex-direction:column;min-width:0;
  padding-left:24px;border-left:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-money-row{
  display:flex;align-items:baseline;justify-content:space-between;gap:12px;
  padding:7px 0;border-top:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-money-row:first-child{border-top:0;padding-top:0;}
[data-plugin="dsh-tokbook"] .dtpl-money-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-money-v{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;
  color:var(--dtpl-fg);font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-money-v.is-muted{color:var(--dtpl-fg-2);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-money-note{
  margin-top:auto;padding-top:10px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-today-mix{
  grid-area:mix;display:flex;flex-direction:column;min-width:0;min-height:0;
  padding-left:24px;border-left:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-today-mix-h{
  display:flex;align-items:baseline;justify-content:space-between;gap:12px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);letter-spacing:.04em;
}
[data-plugin="dsh-tokbook"] .dtpl-today-hit{white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-today-hit b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-today-mix .dtpl-compose{margin-top:11px;}
[data-plugin="dsh-tokbook"] .dtpl-today-foot{
  display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 18px;
  margin-top:12px;padding:10px 0 12px;border-top:1px solid var(--dtpl-hairline);
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-today-foot b{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
}
@container (max-width:1100px){
  [data-plugin="dsh-tokbook"] .dtpl-today-top{
    grid-template-columns:minmax(0,1fr) 250px;
    grid-template-areas:"hero money" "mix mix";
    row-gap:16px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-today-mix{
    padding-left:0;padding-top:14px;border-left:0;border-top:1px solid var(--dtpl-hairline);
  }
}
@container (max-width:700px){
  [data-plugin="dsh-tokbook"] .dtpl-today-top{
    grid-template-columns:minmax(0,1fr);
    grid-template-areas:"hero" "mix" "money";
  }
  [data-plugin="dsh-tokbook"] .dtpl-today-money{
    padding-left:0;padding-top:14px;border-left:0;border-top:1px solid var(--dtpl-hairline);
  }
}
[data-plugin="dsh-tokbook"] .dtpl-chart{display:flex;flex-direction:column;flex:1;min-height:0;padding:10px 14px 8px;}
[data-plugin="dsh-tokbook"] .dtpl-chart-key{
  display:flex;align-items:center;gap:16px;flex-wrap:wrap;flex:none;
  padding:0 2px 4px;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-chart-key span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-chart-key i{display:inline-block;flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-key-bar{width:10px;height:10px;background:color-mix(in srgb,var(--dtpl-fg) 18%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-key-today{width:10px;height:10px;background:var(--dtpl-brand);box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);}
[data-plugin="dsh-tokbook"] .dtpl-key-line{width:18px;height:2px;background:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-chart-svg{display:block;width:100%;height:auto;}
[data-plugin="dsh-tokbook"] .dtpl-chart-grid{stroke:var(--dtpl-hairline);stroke-width:1;}
[data-plugin="dsh-tokbook"] .dtpl-chart-base{stroke:var(--dtpl-border);stroke-width:1;}
[data-plugin="dsh-tokbook"] .dtpl-chart-tick{
  font-family:var(--dtpl-mono);
  font-size:var(--dtpl-fs-micro);fill:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-chart-tick.is-peak{fill:var(--dtpl-fg);font-weight:600;paint-order:stroke;stroke:var(--dtpl-card);stroke-width:3px;stroke-linejoin:round;}
[data-plugin="dsh-tokbook"] .dtpl-chart-tick.is-now{fill:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-chart-tick.is-money{fill:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-chart-num{
  font-family:var(--dtpl-mono);
  font-size:var(--dtpl-fs-micro);fill:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;
  paint-order:stroke;stroke:var(--dtpl-card);stroke-width:3px;stroke-linejoin:round;
}
[data-plugin="dsh-tokbook"] .dtpl-chart-bar{fill:color-mix(in srgb,var(--dtpl-fg) 18%,transparent);transition:fill var(--dtpl-dur-quick) var(--dtpl-ease-tint);}
[data-plugin="dsh-tokbook"] .dtpl-chart-bar.is-today{fill:var(--dtpl-brand);stroke:var(--dtpl-on-brand);stroke-width:1;}
[data-plugin="dsh-tokbook"] .dtpl-chart-bar:not(.is-today):hover{fill:color-mix(in srgb,var(--dtpl-fg) 32%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-chart-line{fill:none;stroke:var(--dtpl-fg);stroke-width:1.5;}
[data-plugin="dsh-tokbook"] .dtpl-chart-dot{fill:var(--dtpl-card);stroke:var(--dtpl-fg);stroke-width:1.5;}
[data-plugin="dsh-tokbook"] .dtpl-chart-dot.is-peak{fill:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-chart-dot.is-today{fill:var(--dtpl-brand);stroke:var(--dtpl-on-brand);}
[data-plugin="dsh-tokbook"] .dtpl-chart-foot{
  display:flex;flex-wrap:wrap;align-items:center;gap:8px 22px;
  padding:10px 14px 12px;border-top:1px solid var(--dtpl-hairline);
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-chart-mix-h{
  display:flex;align-items:center;gap:8px;flex:none;white-space:nowrap;
  font-weight:600;letter-spacing:.04em;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-chart-mix{
  display:flex;flex-wrap:wrap;align-items:center;gap:6px 24px;flex:1;
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-chart-mix-item{
  display:grid;grid-template-columns:9px auto auto 40px;
  align-items:center;column-gap:8px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-chart-mix-item > .dtpl-compose-key{margin:0;}
[data-plugin="dsh-tokbook"] .dtpl-chart-mix-k{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-chart-mix-v{
  font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);text-align:right;
}
[data-plugin="dsh-tokbook"] .dtpl-chart-mix-p{
  font-style:normal;font-weight:400;color:var(--dtpl-fg-2);text-align:right;
}
[data-plugin="dsh-tokbook"] .dtpl-compose{display:flex;flex-direction:column;gap:9px;margin-top:11px;}
[data-plugin="dsh-tokbook"] .dtpl-compose-row{
  display:grid;grid-template-columns:84px minmax(0,1fr) 100px;
  align-items:center;column-gap:12px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-compose-k{
  display:flex;align-items:center;gap:7px;min-width:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
[data-plugin="dsh-tokbook"] .dtpl-compose-key{display:inline-block;flex:none;width:9px;height:9px;}
[data-plugin="dsh-tokbook"] .dtpl-compose-key.is-empty{opacity:.35;}
[data-plugin="dsh-tokbook"] .dtpl-compose-key[data-k="input"]{background:color-mix(in srgb,var(--dtpl-fg) 52%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-compose-key[data-k="cache-read"]{background:color-mix(in srgb,var(--dtpl-fg) 18%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-compose-key[data-k="cache-write"]{
  background:
    repeating-linear-gradient(90deg,var(--dtpl-fg) 0 1.5px,transparent 1.5px 5px),
    color-mix(in srgb,var(--dtpl-fg) 84%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-compose-key[data-k="output"]{background:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-compose-track{
  display:block;position:relative;height:6px;min-width:0;
  background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-compose-fill{display:block;height:100%;}
[data-plugin="dsh-tokbook"] .dtpl-compose-fill[data-k="input"]{background:color-mix(in srgb,var(--dtpl-fg) 52%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-compose-fill[data-k="cache-read"]{background:color-mix(in srgb,var(--dtpl-fg) 18%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-compose-fill[data-k="cache-write"]{
  background:
    repeating-linear-gradient(90deg,var(--dtpl-fg) 0 1.5px,transparent 1.5px 5px),
    color-mix(in srgb,var(--dtpl-fg) 84%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-compose-fill[data-k="output"]{background:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-compose-n{
  display:grid;grid-template-columns:minmax(0,1fr) 48px;align-items:baseline;column-gap:6px;justify-items:end;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;
  color:var(--dtpl-fg);font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-compose-p{
  font-style:normal;font-weight:400;color:var(--dtpl-fg-2);text-align:right;
}
[data-plugin="dsh-tokbook"] .dtpl-sk-today{height:250px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-quota{height:300px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-trend{height:380px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-detail{height:300px;}
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
[data-plugin="dsh-tokbook"] .dtpl-cost-k{font-style:normal;font-size:var(--dtpl-fs-label);color:var(--dtpl-fg-2);}

[data-plugin="dsh-tokbook"] .dtpl-bd-tabs{display:inline-flex;gap:0;align-self:stretch;align-items:flex-end;}
[data-plugin="dsh-tokbook"] .dtpl-bd-tab{
  position:relative;appearance:none;border:0;background:transparent;
  padding:3px 14px 8px;
  font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
  transition:color var(--dtpl-dur-quick) var(--dtpl-ease-tint),background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
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
  grid-template-columns:minmax(220px,300px) minmax(160px,1fr) minmax(min-content,var(--dtpl-row-nums-w));
  padding:8px 0 6px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-bd-col-id,
[data-plugin="dsh-tokbook"] .dtpl-bd-col-share,
[data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{text-align:right;}

[data-plugin="dsh-tokbook"] .dtpl-models{display:flex;flex-direction:column;}
[data-plugin="dsh-tokbook"] .dtpl-models > .dtpl-row{
  grid-template-columns:minmax(220px,300px) minmax(160px,1fr) minmax(min-content,var(--dtpl-row-nums-w));
}
[data-plugin="dsh-tokbook"] .dtpl-row{align-items:start;padding:0;}
[data-plugin="dsh-tokbook"] .dtpl-row-share{display:flex;align-items:center;gap:8px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-row-share-track{flex:1;min-width:0;height:5px;background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-row-share-track i{display:block;height:100%;background:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-row-share-p{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
  width:30px;text-align:right;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-section .dtpl-empty{
  margin:0;border:0;background:transparent;box-shadow:none;padding:28px 20px;
}
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
  padding:11px var(--dtpl-page-pad) 14px;
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-sync{
  display:flex;align-items:flex-start;gap:6px;flex:1 1 auto;min-width:0;
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-sync-text{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;}
[data-plugin="dsh-tokbook"] .dtpl-sync-dot{
  flex:none;width:6px;height:6px;border-radius:50%;corner-shape:round;
  margin-top:calc((var(--dtpl-lh-body) - 6px) / 2);
  background:currentColor;
}
[data-plugin="dsh-tokbook"] .dtpl-sync-error{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-sync-running{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot{animation:dtpl-pulse 1.2s ease-in-out infinite;}
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
[data-plugin="dsh-tokbook"] .dtpl-rescan-retry{
  color:var(--dtpl-err);
  border-color:color-mix(in srgb,var(--dtpl-err) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-rescan-retry:hover:not(:disabled){
  background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);
  border-color:color-mix(in srgb,var(--dtpl-err) 60%,transparent);
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
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);margin:0 0 6px;text-wrap:balance;
}
[data-plugin="dsh-tokbook"] .dtpl-empty-sub{font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);margin:0;max-width:44ch;text-wrap:pretty;}
[data-plugin="dsh-tokbook"] .dtpl-empty-act{margin-top:16px;}
[data-plugin="dsh-tokbook"] .dtpl-empty-sub code{
  font-family:var(--dtpl-mono);font-size:.9em;
  padding:.1em .35em;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg);
}

[data-plugin="dsh-tokbook"] .dtpl-sec-aside{
  flex:none;margin-bottom:11px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
`
