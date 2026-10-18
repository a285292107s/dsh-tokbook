export const CSS_METHOD = `
[data-plugin="dsh-tokbook"] .dtpl-doc{max-width:none;}
[data-plugin="dsh-tokbook"] .dtpl-doc code{
  font-family:var(--dtpl-mono);
  padding:.1em .35em;
  border:1px solid var(--dtpl-hairline);
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg);
  white-space:nowrap;
}

[data-plugin="dsh-tokbook"] .dtpl-doc-lede{
  display:flex;flex-direction:column;gap:3px;
  margin:0 0 12px;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-lede p{margin:0;}
[data-plugin="dsh-tokbook"] .dtpl-doc-lede b{color:var(--dtpl-fg);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-doc-facts{
  display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
  margin-bottom:16px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact{
  display:flex;flex-direction:column;gap:3px;
  padding:10px 12px;min-width:0;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:
    inset 0 1px 0 0 color-mix(in srgb,#fff 6%,transparent),
    var(--dtpl-metal);
  transition:box-shadow .18s ease,border-color .18s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact:hover{
  box-shadow:
    inset 0 1px 0 0 color-mix(in srgb,#fff 10%,transparent),
    var(--dtpl-metal),
    0 3px 12px -5px rgba(0,0,0,.18);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);font-weight:500;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-v{
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg);
}

[data-plugin="dsh-tokbook"] .dtpl-doc-sec{margin-bottom:16px;}
[data-plugin="dsh-tokbook"] .dtpl-doc-title{
  display:flex;align-items:center;gap:8px;
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
  margin:0 0 10px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-idx{
  flex:none;display:inline-flex;align-items:center;justify-content:center;
  width:18px;height:18px;
  background:var(--dtpl-brand);color:var(--dtpl-on-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
  font-family:var(--dtpl-mono);
  font-size:var(--dtpl-fs-label);line-height:1;font-weight:700;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-sub{
  margin:0 0 8px;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-sub b{color:var(--dtpl-fg);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-doc-buckets{
  display:grid;grid-template-columns:repeat(2,1fr);gap:8px;
  margin-bottom:10px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket{
  display:flex;flex-direction:column;gap:3px;
  padding:10px 12px;min-width:0;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:
    inset 0 1px 0 0 color-mix(in srgb,#fff 6%,transparent),
    var(--dtpl-metal);
  transition:box-shadow .18s ease,border-color .18s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket:hover{
  box-shadow:
    inset 0 1px 0 0 color-mix(in srgb,#fff 10%,transparent),
    var(--dtpl-metal),
    0 3px 12px -5px rgba(0,0,0,.18);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket-name{
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket-desc{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}

[data-plugin="dsh-tokbook"] .dtpl-doc-judge{
  width:100%;table-layout:fixed;border-collapse:collapse;
  margin:0 0 8px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge th,
[data-plugin="dsh-tokbook"] .dtpl-doc-judge td{
  text-align:left;vertical-align:top;
  padding:7px 8px;
  border-top:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th{
  padding:0 8px 5px;border-top:none;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:first-child{width:52%;}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(2),
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(3){width:24%;}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge tbody th{font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-what{
  display:block;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-detail{
  display:block;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-note{
  margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-note b{color:var(--dtpl-fg);font-weight:600;}
@media (max-width:640px){
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:first-child{width:46%;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(2),
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(3){width:27%;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge th,
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge td{padding:6px;}
}
[data-plugin="dsh-tokbook"] .dtpl-doc-chip{
  flex:none;display:inline-flex;align-items:center;
  height:18px;padding:0 7px;margin-top:1px;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 35%,transparent);
  color:var(--dtpl-fg);
  font-size:var(--dtpl-fs-micro);line-height:1;font-weight:600;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-chip-off{
  border-color:var(--dtpl-border);
  color:var(--dtpl-fg-3);
  font-weight:500;
}

[data-plugin="dsh-tokbook"] .dtpl-doc-gap{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-card{
  padding:11px 13px;min-width:0;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-title{
  display:flex;align-items:center;gap:6px;
  margin:0 0 6px;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-title::before{
  content:"";flex:none;width:3px;height:12px;
  background:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title{color:var(--dtpl-warn-ink);}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title::before{background:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list{
  list-style:none;margin:0;padding:0;
  display:flex;flex-direction:column;gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li{
  position:relative;padding-left:12px;
  display:flex;flex-direction:column;gap:1px;
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li::before{
  content:"";position:absolute;left:1px;top:7px;
  width:4px;height:4px;border-radius:50%;corner-shape:round;
  background:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-name{
  display:block;color:var(--dtpl-fg);font-weight:600;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-desc{
  display:block;color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum{
  margin:8px 0 0;padding-top:7px;
  border-top:1px solid var(--dtpl-hairline);
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum b{color:var(--dtpl-fg);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-doc-map{
  display:flex;flex-direction:column;gap:5px;
  margin:2px 0 8px;padding:10px 12px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-row{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-row b{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-arrow{color:var(--dtpl-fg-3);flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-note{
  margin:2px 0 0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-note:first-of-type{margin-top:2px;}

[data-plugin="dsh-tokbook"] .dtpl-doc-quota{
  display:flex;flex-direction:column;gap:3px;
  margin:0 0 14px;padding:10px 13px;
  border:1px solid var(--dtpl-border);
  box-shadow:inset 3px 0 0 var(--dtpl-fg-3);
  background:var(--dtpl-panel-bg);
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-quota p{margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-doc-quota b{color:var(--dtpl-fg);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-doc-data{
  display:flex;flex-direction:column;gap:3px;
  margin:2px 0 6px;padding:10px 13px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-line{
  margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-line b{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-dir{
  margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-dir code{
  background:transparent;border:0;padding:0;
}

[data-plugin="dsh-tokbook"] .dtpl-doc-foot{
  margin-top:12px;padding-top:10px;
  border-top:1px solid var(--dtpl-border);
  font-size:var(--dtpl-fs-label)!important;line-height:16px!important;color:var(--dtpl-fg-2)!important;
}
`
