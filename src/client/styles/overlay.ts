export const CSS_OVERLAY = `
[data-plugin="dsh-tokbook"].dtpl-ov-group{display:inline-flex;align-items:center;gap:8px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-ov-root{display:inline-flex;align-items:center;min-width:0;}

[data-plugin="dsh-tokbook"] .dtpl-ov-panel{
  position:fixed;inset:auto;z-index:200;margin:0;
  display:flex;flex-direction:column;
  width:min(360px,calc(100vw - 24px));
  max-height:min(60vh,520px);
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-surface);
  box-shadow:var(--dtpl-lift-hover);
  color:var(--dtpl-fg);
  font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
  text-align:left;
  transform-origin:top center;
}
[data-plugin="dsh-tokbook"] .dtpl-ov-panel:focus{outline:none;}

[data-plugin="dsh-tokbook"] .dtpl-ov-head{
  display:flex;align-items:baseline;gap:10px;flex:none;
  padding:14px 16px 11px;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-ov-title{
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:700;color:var(--dtpl-fg);white-space:nowrap;
  letter-spacing:.02em;
}
@media (prefers-reduced-motion:no-preference){
  [data-plugin="dsh-tokbook"] .dtpl-ov-panel{animation:dtpl-pop var(--dtpl-dur-enter) var(--dtpl-ease-move) both;}
  [data-plugin="dsh-tokbook"] .dtpl-ov-card{animation:dtpl-rise var(--dtpl-dur-enter) var(--dtpl-ease-move) both;}
  [data-plugin="dsh-tokbook"] .dtpl-ov-card:nth-child(2){animation-delay:.05s;}
  [data-plugin="dsh-tokbook"] .dtpl-ov-card:nth-child(n+3){animation-delay:.1s;}
}
@keyframes dtpl-pop{from{opacity:0;transform:translateY(-4px) scale(.98)}}
[data-plugin="dsh-tokbook"] .dtpl-ov-sum{
  margin-left:auto;min-width:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  text-align:right;overflow-wrap:anywhere;
}

[data-plugin="dsh-tokbook"] .dtpl-ov-list{
  display:flex;flex-direction:column;gap:8px;
  flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;
  padding:12px 12px 14px;
  scrollbar-width:thin;
}

[data-plugin="dsh-tokbook"] .dtpl-ov-card{
  display:flex;flex-direction:column;gap:10px;
  border:1px solid var(--dtpl-hairline);
  background:var(--dtpl-card);
  padding:12px;
  min-width:0;
  transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-ov-card:hover{border-color:var(--dtpl-border);background:color-mix(in srgb,var(--dtpl-fg) 2%,var(--dtpl-card));}
[data-plugin="dsh-tokbook"] .dtpl-ov-card-top{display:flex;flex-direction:column;gap:2px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-ov-card-main{display:flex;align-items:center;gap:14px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-ov-card-head{display:flex;align-items:baseline;gap:8px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-ov-body{display:flex;flex-direction:column;gap:9px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-ov-card-k{
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:700;color:var(--dtpl-fg);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-ov-card-meta{
  margin-left:auto;min-width:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;
}
[data-plugin="dsh-tokbook"] .dtpl-ov-card-route{
  min-width:0;white-space:normal;overflow-wrap:anywhere;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-ov-gap{
  margin:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}

[data-plugin="dsh-tokbook"] .dtpl-ov-empty{
  margin:0;padding:10px 2px 14px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-ov-error{
  margin:0;padding:10px 2px 0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-err);overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-ov-retry{
  align-self:flex-start;margin-top:10px;height:26px;padding:0 12px;
  appearance:none;cursor:pointer;
  border:1px solid var(--dtpl-border);background:transparent;
  font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-ov-retry:hover{
  color:var(--dtpl-fg);border-color:var(--dtpl-fg-3);background:var(--dtpl-wash-hover);
}
[data-plugin="dsh-tokbook"] .dtpl-ov-retry:focus-visible{outline:2px solid var(--dtpl-focus);outline-offset:1px;}
[data-plugin="dsh-tokbook"] .dtpl-ov-sk{
  height:132px;
  background:linear-gradient(90deg,
    color-mix(in srgb,var(--dtpl-fg) 4%,transparent) 0%,
    color-mix(in srgb,var(--dtpl-fg) 9%,transparent) 50%,
    color-mix(in srgb,var(--dtpl-fg) 4%,transparent) 100%);
  background-size:200% 100%;
  animation:dtpl-shimmer 1400ms linear infinite;
}

[data-plugin="dsh-tokbook"] .dtpl-ov-foot{
  display:flex;align-items:center;gap:10px;flex:none;
  padding:10px 14px 12px;
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-ov-note{
  min-width:0;
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
}
@media (prefers-reduced-motion:reduce){
  [data-plugin="dsh-tokbook"] .dtpl-ov-sk{animation:none;}
}
@media (max-width:380px){
  [data-plugin="dsh-tokbook"] .dtpl-ov-card{padding:10px;}
  [data-plugin="dsh-tokbook"] .dtpl-ov-card-main{gap:10px;}
  [data-plugin="dsh-tokbook"] .dtpl-ov-card-k{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);}
}
`
