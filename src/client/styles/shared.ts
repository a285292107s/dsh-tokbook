export const CSS_SHARED = `
[data-plugin="dsh-tokbook"] .dtpl-sr{
  position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;
}

[data-plugin="dsh-tokbook"] .dtpl-body ::selection{
  background:color-mix(in srgb,var(--dtpl-brand) 22%,transparent);
}

@media (max-width:640px){
  [data-plugin="dsh-tokbook"].dtpl-overlay{padding:0;align-items:flex-end;}
  [data-plugin="dsh-tokbook"] .dtpl-card{
    width:100%;height:min(94dvh,94vh);
    box-shadow:var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.28)),
      inset 0 0 0 1px var(--dtpl-border);
  }
  [data-plugin="dsh-tokbook"] .dtpl-head{padding:14px 16px 10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tabs{padding:0 16px;}
  [data-plugin="dsh-tokbook"] .dtpl-tabs{overflow-x:auto;scrollbar-width:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tabs::-webkit-scrollbar{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tab{flex:0 0 auto;}
  [data-plugin="dsh-tokbook"] .dtpl-body{padding:12px 16px 14px;}
  [data-plugin="dsh-tokbook"] .dtpl-foot{padding:10px 16px 12px;}
  [data-plugin="dsh-tokbook"] .dtpl-kpis,
  [data-plugin="dsh-tokbook"] .dtpl-kpis-2{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-kpi + .dtpl-kpi{
    border-left:0;border-top:1px solid var(--dtpl-hairline);
  }
  [data-plugin="dsh-tokbook"] .dtpl-chart{overflow-x:auto;scrollbar-width:thin;}
  [data-plugin="dsh-tokbook"] .dtpl-chart-svg{min-width:640px;}
  [data-plugin="dsh-tokbook"] .dtpl-hero-facts{flex:1 1 auto;gap:4px 10px;}
  [data-plugin="dsh-tokbook"] .dtpl-hero-facts i{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-buckets,
  [data-plugin="dsh-tokbook"] .dtpl-buckets-3{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-bucket:nth-child(2n){border-left:0;}
  [data-plugin="dsh-tokbook"] .dtpl-bucket:nth-child(n+2){border-top:1px solid var(--dtpl-hairline);}
  [data-plugin="dsh-tokbook"] .dtpl-buckets-3 > .dtpl-bucket:nth-child(2n){border-left:0;}
  [data-plugin="dsh-tokbook"] .dtpl-buckets-3 > .dtpl-bucket:nth-child(n+2){border-top:1px solid var(--dtpl-hairline);}
  [data-plugin="dsh-tokbook"] .dtpl-bd-cols{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-bd-cols,
  [data-plugin="dsh-tokbook"] .dtpl-row{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-model-nums{
    flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:12px;
    margin-top:5px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-val{margin-right:auto;}
  [data-plugin="dsh-tokbook"] .dtpl-bd-tab{
    min-height:44px;padding:13px 16px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-close{
    width:44px;height:44px;
  }

  [data-plugin="dsh-tokbook"] .dtpl-doc-facts{grid-template-columns:1fr;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-buckets{grid-template-columns:1fr;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-gap{grid-template-columns:1fr;}

  [data-plugin="dsh-tokbook"] .dtpl-quota-stats{grid-template-columns:1fr;}
  [data-plugin="dsh-tokbook"] .dtpl-quota-stat + .dtpl-quota-stat{
    border-left:0;border-top:1px solid var(--dtpl-border);
  }

  [data-plugin="dsh-tokbook"] .dtpl-provider-head{
    grid-template-columns:minmax(0,1fr);row-gap:8px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-provider-nums{align-items:flex-start;}
  [data-plugin="dsh-tokbook"] .dtpl-provider-cost{align-items:flex-start;}

  [data-plugin="dsh-tokbook"] .dtpl-price-pick{grid-template-columns:minmax(0,1fr);column-gap:0;}
  [data-plugin="dsh-tokbook"] .dtpl-price-pick > .dtpl-price-pick-fxrow,
  [data-plugin="dsh-tokbook"] .dtpl-price-pick-state{grid-column:1;}
  [data-plugin="dsh-tokbook"] .dtpl-price-pick-state[data-quiet="true"]{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-price-input{text-align:left;}
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cols,
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-row{
    grid-template-columns:repeat(2,minmax(0,1fr));
    row-gap:8px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cols{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-scope{grid-column:1 / -1;padding-right:0;}
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-addrow{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-add-slot{grid-column:1 / -1;justify-self:stretch;}
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cell-k{display:block;}
  [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cell-k{
    text-align:left;padding-left:var(--dtpl-cell-pad-x);padding-right:var(--dtpl-cell-pad-x);
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-day-row{grid-template-columns:minmax(0,88px) minmax(0,1fr);column-gap:8px;}
  [data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date{width:100px;font-size:var(--dtpl-fs-body);}
  [data-plugin="dsh-tokbook"] .dtpl-price-cal-days{min-width:40px;}
}

@media (prefers-reduced-motion:no-preference){
  [data-plugin="dsh-tokbook"].dtpl-overlay{animation:dtpl-fade var(--dtpl-dur-enter) var(--dtpl-ease-move);}
  [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-pop var(--dtpl-dur-move) var(--dtpl-ease-move);}
  [data-plugin="dsh-tokbook"] .dtpl-body > *{animation:dtpl-rise var(--dtpl-dur-enter) var(--dtpl-ease-move) both;}
  [data-plugin="dsh-tokbook"] .dtpl-inst > *{animation:dtpl-rise var(--dtpl-dur-enter) var(--dtpl-ease-move) both;animation-delay:.06s;}
  [data-plugin="dsh-tokbook"] .dtpl-share-ring-arc{animation:dtpl-draw var(--dtpl-dur-draw) var(--dtpl-ease-move) both;}
}
@media (prefers-reduced-motion:no-preference) and (max-width:640px){
  [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-sheet var(--dtpl-dur-move) var(--dtpl-ease-move);}
}
@keyframes dtpl-fade{from{opacity:0}}
@keyframes dtpl-rise{from{opacity:0;transform:translateY(6px)}}
@keyframes dtpl-draw{from{stroke-dashoffset:var(--dtpl-arc,0)}}
@keyframes dtpl-width-in{from{width:0}}
@keyframes dtpl-pop{from{opacity:0;transform:translateY(8px) scale(.96)}}
@keyframes dtpl-sheet{from{transform:translateY(100%)}}
@keyframes dtpl-rotate{to{transform:rotate(360deg)}}
@keyframes dtpl-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes dtpl-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes dtpl-refresh-pop{
  0%{transform:scale(1)}
  40%{transform:scale(.82) rotate(-12deg)}
  70%{transform:scale(1.12) rotate(4deg)}
  100%{transform:scale(1)}
}
@media (prefers-reduced-motion:reduce){
  [data-plugin="dsh-tokbook"] .dtpl-body > *,
  [data-plugin="dsh-tokbook"] .dtpl-inst > *,
  [data-plugin="dsh-tokbook"] .dtpl-share-ring-arc,
  [data-plugin="dsh-tokbook"] .dtpl-sk,
  [data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot,
  [data-plugin="dsh-tokbook"] .dtpl-spin,
  [data-plugin="dsh-tokbook"] .dtpl-price-add-ghost,
  [data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill,
  [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-fill,
  [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{animation:none;transition:none;}
}

[data-plugin="dsh-tokbook"] button:not(:disabled):active{transform:translateY(1px);}
`
