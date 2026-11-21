export const CSS_METHOD = `
[data-plugin="dsh-tokbook"].dtpl-page[data-tab="method"]{--dtpl-page-col:1000px;}
[data-plugin="dsh-tokbook"] .dtpl-doc{gap:0;max-width:none;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-doc.dtpl-card-pad{padding:20px 22px;}
[data-plugin="dsh-tokbook"] .dtpl-doc code{
  font-family:var(--dtpl-mono);
  padding:.1em .35em;
  border:1px solid var(--dtpl-hairline);
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg);
  white-space:nowrap;
}

[data-plugin="dsh-tokbook"] .dtpl-doc-head,
[data-plugin="dsh-tokbook"] .dtpl-doc-tail{display:flex;flex-direction:column;gap:16px;}

[data-plugin="dsh-tokbook"] .dtpl-doc-lede{
  display:flex;flex-direction:column;gap:8px;margin:0;
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-lede p{margin:0;}
[data-plugin="dsh-tokbook"] .dtpl-doc-lede b{color:var(--dtpl-fg);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-doc-facts{
  display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact{
  display:flex;flex-direction:column;gap:4px;
  padding:10px 12px;min-width:0;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);font-weight:500;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-v{
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg);
}

[data-plugin="dsh-tokbook"] .dtpl-doc-glossary{
  display:flex;flex-direction:column;gap:8px;
  padding-top:14px;border-top:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-glossary dl{
  display:grid;grid-template-columns:max-content minmax(0,1fr);align-items:baseline;gap:8px 16px;
  margin:0;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-glossary dl > div{display:contents;}
[data-plugin="dsh-tokbook"] .dtpl-doc-glossary dt{
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-glossary dd,
[data-plugin="dsh-tokbook"] .dtpl-doc-glossary p{
  margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
}

[data-plugin="dsh-tokbook"] .dtpl-doc-sec{gap:0;}
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
  margin:0 0 14px;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-sub b{color:var(--dtpl-fg);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-doc-buckets{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 28px;
  margin:0;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket{
  display:flex;flex-direction:column;gap:2px;min-width:0;
  padding-left:12px;
  box-shadow:inset 2px 0 0 var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket-name{
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket-desc{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
}

[data-plugin="dsh-tokbook"] .dtpl-doc-table-wrap{
  overflow:auto;max-inline-size:100%;
  container:judge/inline-size;
  scrollbar-width:thin;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-table-wrap:focus-visible{outline:2px solid var(--dtpl-focus);outline-offset:2px;}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge{
  width:100%;table-layout:fixed;border-collapse:collapse;
  margin:0 0 10px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge th,
[data-plugin="dsh-tokbook"] .dtpl-doc-judge td{
  text-align:left;vertical-align:top;
  padding:9px 10px;
  border-top:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th{
  padding:0 10px 6px;border-top:none;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:first-child{width:58%;}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(2),
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(3){width:21%;}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge tbody th{font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-what{
  display:block;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-detail{
  display:block;margin-top:2px;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-note{
  margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-note b{color:var(--dtpl-fg);font-weight:600;}
@container judge (max-width:560px){
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge{min-width:460px;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:first-child{width:46%;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(2),
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(3){width:27%;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge th,
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge td{padding:7px 8px;}
}
[data-plugin="dsh-tokbook"] .dtpl-doc-chip{
  flex:none;display:inline-flex;align-items:center;
  height:20px;padding:0 8px;margin-top:1px;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 35%,transparent);
  color:var(--dtpl-fg);
  font-size:var(--dtpl-fs-label);line-height:1;font-weight:600;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-chip-zero{
  border-color:var(--dtpl-border);
  color:var(--dtpl-fg-2);
  font-weight:500;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-chip-unknown{
  border-color:var(--dtpl-border);
  color:var(--dtpl-fg-3);
  font-weight:500;
}

[data-plugin="dsh-tokbook"] .dtpl-doc-gap{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-card{
  padding:14px 16px;min-width:0;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-title{
  display:flex;align-items:center;gap:8px;
  margin:0 0 10px;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-title::before{
  content:"";flex:none;width:3px;height:13px;
  background:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title{color:var(--dtpl-warn-ink);}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title::before{background:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list{
  list-style:none;margin:0;padding:0;
  display:flex;flex-direction:column;gap:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li{
  position:relative;padding-left:12px;
  display:flex;flex-direction:column;gap:2px;
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li::before{
  content:"";position:absolute;left:1px;top:9px;
  width:4px;height:4px;border-radius:50%;corner-shape:round;
  background:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-name{
  display:block;color:var(--dtpl-fg);font-weight:600;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-desc{
  display:block;color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum{
  margin:14px 0 0;padding-top:12px;
  border-top:1px solid var(--dtpl-hairline);
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum b{color:var(--dtpl-fg);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-doc-map{
  display:grid;grid-template-columns:max-content 16px max-content;align-items:baseline;gap:7px 8px;
  margin:0 0 12px;padding:12px 14px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  overflow-x:auto;scrollbar-width:thin;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-row{display:contents;}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-row b{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-arrow{color:var(--dtpl-fg-3);justify-self:center;}
[data-plugin="dsh-tokbook"] .dtpl-doc-notes{
  display:flex;flex-direction:column;gap:4px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-notes p{
  margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
}

[data-plugin="dsh-tokbook"] .dtpl-doc-quota{
  display:flex;flex-direction:column;gap:4px;
  margin:0;padding:12px 14px;
  border:1px solid var(--dtpl-border);
  box-shadow:inset 3px 0 0 var(--dtpl-fg-3);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-quota p{
  margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-quota b{color:var(--dtpl-fg);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-doc-data{
  display:flex;flex-direction:column;gap:4px;
  margin:0;padding:12px 14px;
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
  margin:0;padding-top:12px;
  border-top:1px solid var(--dtpl-border);
  font-size:var(--dtpl-fs-label)!important;line-height:var(--dtpl-lh-label)!important;color:var(--dtpl-fg-2)!important;
}
`
