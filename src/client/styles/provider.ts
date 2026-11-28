export const CSS_PROVIDER = `
[data-plugin="dsh-tokbook"] .dtpl-usage-section{
  margin:0;padding:0;
  max-height:640px;overflow:hidden;
  container-type:inline-size;
  --dtpl-usage-cols:minmax(220px,2.4fr) minmax(70px,0.9fr) minmax(56px,0.7fr) minmax(80px,1fr) minmax(96px,1.2fr);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-section[data-money="false"]{
  --dtpl-usage-cols:minmax(220px,2.4fr) minmax(70px,0.9fr) minmax(56px,0.7fr) minmax(80px,1fr);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-head{
  display:flex;flex-direction:column;
  margin:0;border-bottom:2px solid var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-head-top{
  display:flex;align-items:center;justify-content:space-between;gap:12px 16px;flex-wrap:wrap;
  padding:10px 18px;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-scope{
  display:flex;align-items:center;gap:10px;flex:none;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-money-note{
  color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-range-tabs{display:flex;flex:none;gap:2px;}
[data-plugin="dsh-tokbook"] .dtpl-range-tab{
  flex:0 0 auto;
  appearance:none;border:0;background:transparent;
  height:24px;padding:0 10px;
  font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
  transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab:hover{color:var(--dtpl-fg);background:var(--dtpl-wash-hover);}
[data-plugin="dsh-tokbook"] .dtpl-range-tab.dtpl-range-active{
  background:var(--dtpl-fg);color:var(--dtpl-card);font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-period{
  display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px;
  padding:11px 18px 0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-period b{font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-usage-figs{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  column-gap:24px;row-gap:10px;
  padding:6px 18px 12px;
  border-bottom:2px solid var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-fig{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-usage-fig-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);letter-spacing:.04em;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-fig-v{
  font-family:var(--dtpl-serif);
  font-size:clamp(26px,2.8cqi,34px);line-height:1.12;font-weight:600;letter-spacing:-.01em;
  font-variant-numeric:lining-nums tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-fig.is-sub .dtpl-usage-fig-v{color:var(--dtpl-fg-2);font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-usage-fig.is-sub .dtpl-usage-fig-k{color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-usage-fig-v.is-zero{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-usage-cuts{
  display:flex;align-items:flex-end;justify-content:space-between;gap:6px 12px;flex-wrap:wrap;
  padding:8px 18px 0;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-tabs{display:inline-flex;align-items:flex-end;gap:0;align-self:stretch;}
[data-plugin="dsh-tokbook"] .dtpl-usage-tab{
  position:relative;appearance:none;border:0;background:transparent;
  padding:3px 0 8px;margin-right:20px;
  font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
  transition:color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-tab:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-usage-tab[aria-selected="true"]{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-usage-tab[aria-selected="true"]::after{
  content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-cuts .dtpl-sec-aside{margin:0 0 9px auto;}
[data-plugin="dsh-tokbook"] .dtpl-usage-cols{
  display:grid;grid-template-columns:var(--dtpl-usage-cols);column-gap:16px;
  padding:8px 18px 6px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-cols span{
  min-width:0;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-cols span:first-child{text-align:left;}
[data-plugin="dsh-tokbook"] .dtpl-usage-body-wrap{
  position:relative;display:flex;flex-direction:column;flex:1;min-height:0;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-body-wrap > [role="tabpanel"]{
  display:block;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:none;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-body-wrap > [role="tabpanel"]::-webkit-scrollbar{width:0;height:0;}
[data-plugin="dsh-tokbook"] .dtpl-usage-rail{
  position:absolute;top:0;right:0;bottom:0;width:10px;z-index:1;
  opacity:0;pointer-events:none;
  transition:opacity var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-rail[data-visible="true"]{opacity:1;}
[data-plugin="dsh-tokbook"] .dtpl-usage-groups{display:flex;flex-direction:column;}
[data-plugin="dsh-tokbook"] .dtpl-usage-group{border-bottom:1px solid var(--dtpl-border);}
[data-plugin="dsh-tokbook"] .dtpl-usage-group:last-child{border-bottom:0;}
[data-plugin="dsh-tokbook"] .dtpl-usage-ghead{
  position:sticky;top:0;z-index:1;
  appearance:none;border:0;width:100%;text-align:left;font:inherit;color:inherit;
  display:grid;grid-template-columns:var(--dtpl-usage-cols);column-gap:16px;align-items:center;
  padding:8px 18px;
  background:color-mix(in srgb,var(--dtpl-fg) 7%,var(--dtpl-card));
}
button.dtpl-usage-ghead{cursor:pointer;}
button.dtpl-usage-ghead:hover{background:color-mix(in srgb,var(--dtpl-fg) 11%,var(--dtpl-card));}
button.dtpl-usage-ghead:active{background:color-mix(in srgb,var(--dtpl-fg) 14%,var(--dtpl-card));}
[data-plugin="dsh-tokbook"] .dtpl-usage-caret{
  flex:none;align-self:center;width:10px;height:10px;
  color:var(--dtpl-fg-2);
  transition:transform var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-ghead[aria-expanded="true"] .dtpl-usage-caret{transform:rotate(90deg);}
[data-plugin="dsh-tokbook"] .dtpl-usage-group-body{display:block;}
[data-plugin="dsh-tokbook"] .dtpl-usage-group-body[hidden]{display:none;}
[data-plugin="dsh-tokbook"] .dtpl-usage-gname{display:flex;align-items:baseline;gap:7px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-usage-gname > b{
  flex:none;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;
  white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-gmark{flex:none;align-self:center;width:6px;height:6px;background:var(--dtpl-brand);}
[data-plugin="dsh-tokbook"] .dtpl-usage-gkey{
  flex:none;font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);
  color:var(--dtpl-fg-3);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-bill{
  flex:none;display:inline-flex;align-items:center;
  height:15px;padding:0 5px;
  border:1px solid var(--dtpl-border);
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-bill[data-billing="subscription"]{
  border-color:var(--dtpl-fg);background:var(--dtpl-fg);color:var(--dtpl-card);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-gmeta{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-req,
[data-plugin="dsh-tokbook"] .dtpl-usage-share{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  color:var(--dtpl-fg-2);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-tok{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
  text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-mny{display:flex;flex-direction:column;align-items:flex-end;gap:0;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-usage-mny b{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-mny b.is-quiet{color:var(--dtpl-fg-2);font-weight:500;}
[data-plugin="dsh-tokbook"] .dtpl-usage-mny > span{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-row{
  display:grid;grid-template-columns:var(--dtpl-usage-cols);column-gap:16px;align-items:center;
  padding:6px 18px;border-top:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-row:hover{background:var(--dtpl-wash-hover);}
[data-plugin="dsh-tokbook"] .dtpl-usage-model{
  display:flex;align-items:baseline;gap:8px;min-width:0;
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-prov{
  flex:none;font-style:normal;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-row.is-workspace{padding-top:7px;padding-bottom:7px;}
[data-plugin="dsh-tokbook"] .dtpl-usage-row.is-workspace .dtpl-usage-model{
  flex-direction:column;align-items:flex-start;gap:0;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-sub{
  display:flex;align-items:baseline;gap:6px;min-width:0;max-width:100%;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-path{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-label);
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-wsmeta{flex:none;font-variant-numeric:tabular-nums;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-usage-fail{color:var(--dtpl-warn-ink);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-usage-row.is-unattributed .dtpl-usage-model{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-usage-foot{
  display:flex;align-items:center;justify-content:space-between;gap:4px 16px;flex-wrap:wrap;
  padding:9px 18px;border-top:1px solid var(--dtpl-border);
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-section .dtpl-empty{
  margin:0;border:0;background:transparent;box-shadow:none;padding:28px 20px;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-skeleton{display:flex;flex-direction:column;gap:10px;padding:14px 18px 18px;}
[data-plugin="dsh-tokbook"] .dtpl-usage-sk-period{width:220px;height:16px;}
[data-plugin="dsh-tokbook"] .dtpl-usage-sk-figs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin:4px 0 8px;}
[data-plugin="dsh-tokbook"] .dtpl-usage-sk-fig{height:46px;}

@media (max-width:900px){
  [data-plugin="dsh-tokbook"] .dtpl-usage-head-top,
  [data-plugin="dsh-tokbook"] .dtpl-usage-period,
  [data-plugin="dsh-tokbook"] .dtpl-usage-figs,
  [data-plugin="dsh-tokbook"] .dtpl-usage-cuts,
  [data-plugin="dsh-tokbook"] .dtpl-usage-cols,
  [data-plugin="dsh-tokbook"] .dtpl-usage-ghead,
  [data-plugin="dsh-tokbook"] .dtpl-usage-row,
  [data-plugin="dsh-tokbook"] .dtpl-usage-foot{
    padding-left:14px;padding-right:14px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-usage-gmeta{display:none;}
}

@media (max-width:640px){
  [data-plugin="dsh-tokbook"] .dtpl-usage-section{--dtpl-usage-cols:minmax(0,1fr) auto;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-scope{flex:0 0 100%;justify-content:flex-start;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-figs{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-cols{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-tab{margin-right:16px;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-cuts .dtpl-sec-aside{margin-left:0;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-ghead{grid-template-columns:minmax(0,1fr) auto;row-gap:2px;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-ghead .dtpl-usage-req,
  [data-plugin="dsh-tokbook"] .dtpl-usage-ghead .dtpl-usage-share{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-ghead .dtpl-usage-tok{
    grid-column:1;grid-row:2;text-align:left;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
    color:var(--dtpl-fg-2);
  }
  [data-plugin="dsh-tokbook"] .dtpl-usage-ghead .dtpl-usage-mny{grid-column:2;grid-row:1 / span 2;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-row{grid-template-columns:minmax(0,1fr) auto;row-gap:3px;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-row .dtpl-usage-req,
  [data-plugin="dsh-tokbook"] .dtpl-usage-row .dtpl-usage-share{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-row .dtpl-usage-tok{
    grid-column:1;grid-row:2;text-align:left;
    font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  }
  [data-plugin="dsh-tokbook"] .dtpl-usage-row .dtpl-usage-mny{grid-column:2;grid-row:1 / span 2;align-self:center;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-foot{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);}
}
`
