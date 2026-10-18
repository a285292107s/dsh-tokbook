export const CSS_PROVIDER = `
[data-plugin="dsh-tokbook"] .dtpl-usage-section{
  margin-top:22px;padding-top:20px;
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-head{
  display:flex;flex-direction:column;gap:6px;
  margin:0 0 14px;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-head-top{
  display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-title{margin:0;}
[data-plugin="dsh-tokbook"] .dtpl-usage-facts{min-height:19px;}
[data-plugin="dsh-tokbook"] .dtpl-usage-facts-sk{width:236px;min-height:19px;}
[data-plugin="dsh-tokbook"] .dtpl-usage-facts-empty{min-height:19px;}
[data-plugin="dsh-tokbook"] .dtpl-usage-scope{
  display:flex;align-items:center;gap:8px;flex:none;
}
[data-plugin="dsh-tokbook"] .dtpl-usage-money-note{
  color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-range-tabs{
  display:flex;flex:none;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab{
  flex:0 0 auto;
  position:relative;appearance:none;border:0;background:transparent;
  height:24px;padding:0 11px;
  font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab + .dtpl-range-tab{border-left:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-range-tab:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-range-tab.dtpl-range-active{
  color:var(--dtpl-fg);font-weight:600;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab.dtpl-range-active::after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-usage-cuts-sk{width:192px;height:29px;}
[data-plugin="dsh-tokbook"] .dtpl-providers{display:flex;flex-direction:column;gap:10px;}

[data-plugin="dsh-tokbook"] .dtpl-provider-card{
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:
    inset 0 1px 0 0 color-mix(in srgb,#fff 6%,transparent),
    var(--dtpl-metal),
    0 4px 14px -6px rgba(0,0,0,.18);
  transition:box-shadow .18s ease,border-color .18s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-card:hover{
  box-shadow:
    inset 0 1px 0 0 color-mix(in srgb,#fff 10%,transparent),
    var(--dtpl-metal),
    0 6px 20px -6px rgba(0,0,0,.24);
}
[data-plugin="dsh-tokbook"] .dtpl-provider-head{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(min-content,var(--dtpl-row-nums-w));
  column-gap:16px;
  align-items:end;
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
  color:var(--dtpl-fg);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-key{
  font-family:var(--dtpl-mono);
  font-size:var(--dtpl-fs-micro);
}
[data-plugin="dsh-tokbook"] .dtpl-provider-bill{
  flex:none;display:inline-flex;align-items:center;
  height:15px;padding:0 5px;
  border:1px solid var(--dtpl-border);
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-provider-bill[data-billing="subscription"]{
  border-color:var(--dtpl-fg);
  background:var(--dtpl-fg);color:var(--dtpl-card);
}
[data-plugin="dsh-tokbook"] .dtpl-provider-meta{
  color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-nums{
  display:flex;flex-direction:column;align-items:flex-end;gap:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-tokens{
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg);font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);font-weight:600;
  letter-spacing:-.01em;font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-cost{
  display:flex;flex-direction:column;align-items:flex-end;gap:1px;
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:400;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-spend{font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-provider-value{color:var(--dtpl-fg-2);font-weight:400;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);}
[data-plugin="dsh-tokbook"] .dtpl-provider-model-sub{
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-models{
  display:flex;flex-direction:column;
  padding:9px 14px 11px;
}
[data-plugin="dsh-tokbook"] .dtpl-sk-card{height:132px;}

@media (max-width:640px){
  [data-plugin="dsh-tokbook"] .dtpl-usage-head-top{justify-content:flex-start;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-scope{flex:0 0 100%;}
  [data-plugin="dsh-tokbook"] .dtpl-usage-facts{
    display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 10px;
  }
}
`
