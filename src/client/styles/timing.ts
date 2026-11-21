export const CSS_TIMING = `
[data-plugin="dsh-tokbook"].dtpl-tok-entry[aria-expanded="true"]{
  color:var(--dtpl-fg);border-color:var(--dtpl-fg-3);background:var(--dtpl-wash-on);
}

[data-plugin="dsh-tokbook"] .dtpl-dur-root{display:inline-flex;align-items:center;min-width:0;}

[data-plugin="dsh-tokbook"] .dtpl-dur-panel{
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
}
[data-plugin="dsh-tokbook"] .dtpl-dur-panel:focus{outline:none;}

[data-plugin="dsh-tokbook"] .dtpl-dur-head{
  display:flex;align-items:baseline;gap:10px;flex:none;
  padding:14px 16px 11px;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-dur-title{
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:700;color:var(--dtpl-fg);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-dur-sum{
  margin-left:auto;min-width:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  text-align:right;overflow-wrap:anywhere;
}

[data-plugin="dsh-tokbook"] .dtpl-dur-list{
  display:flex;flex-direction:column;gap:8px;
  flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;
  padding:12px 12px 14px;
  scrollbar-width:thin;
}

[data-plugin="dsh-tokbook"] .dtpl-dur-card{
  border:1px solid var(--dtpl-hairline);
  background:var(--dtpl-card);
  padding:10px 12px 11px;
}
[data-plugin="dsh-tokbook"] .dtpl-dur-card-head{display:flex;align-items:baseline;gap:8px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-dur-card-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:700;color:var(--dtpl-fg);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-dur-card-meta{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-dur-card-time{
  margin-left:auto;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);
  font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--dtpl-fg);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-dur-card-time.is-flat{
  font-family:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  font-weight:400;letter-spacing:normal;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-dur-card-bar{display:block;margin-top:9px;}
[data-plugin="dsh-tokbook"] .dtpl-dur-card .dtpl-tok-reads{margin-top:8px;gap:2px 12px;}
[data-plugin="dsh-tokbook"] .dtpl-dur-gap{
  margin:9px 0 0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-3);
}

[data-plugin="dsh-tokbook"] .dtpl-dur-empty{
  margin:0;padding:10px 2px 14px;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-dur-error{
  margin:0;padding:10px 2px 0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-err);overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-dur-retry{
  align-self:flex-start;margin-top:10px;height:26px;padding:0 12px;
  appearance:none;cursor:pointer;
  border:1px solid var(--dtpl-border);background:transparent;
  font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-dur-retry:hover{
  color:var(--dtpl-fg);border-color:var(--dtpl-fg-3);background:var(--dtpl-wash-hover);
}
[data-plugin="dsh-tokbook"] .dtpl-dur-retry:focus-visible{outline:2px solid var(--dtpl-focus);outline-offset:1px;}
[data-plugin="dsh-tokbook"] .dtpl-dur-sk{
  height:132px;
  background:linear-gradient(90deg,
    color-mix(in srgb,var(--dtpl-fg) 4%,transparent) 0%,
    color-mix(in srgb,var(--dtpl-fg) 9%,transparent) 50%,
    color-mix(in srgb,var(--dtpl-fg) 4%,transparent) 100%);
  background-size:200% 100%;
  animation:dtpl-shimmer 1400ms linear infinite;
}

[data-plugin="dsh-tokbook"] .dtpl-dur-foot{
  display:flex;align-items:center;gap:10px;flex:none;
  padding:10px 14px 12px;
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-dur-note{
  min-width:0;
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-dur-link{
  flex:none;margin-left:auto;padding:0;
  appearance:none;border:0;background:transparent;cursor:pointer;
  font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-dur-link:hover{
  color:var(--dtpl-fg);text-decoration:underline;text-underline-offset:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-dur-link:focus-visible{outline:2px solid var(--dtpl-focus);outline-offset:2px;}

@media (prefers-reduced-motion:reduce){
  [data-plugin="dsh-tokbook"] .dtpl-dur-sk{animation:none;}
}
`
