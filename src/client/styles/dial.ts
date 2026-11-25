export const CSS_DIAL = `
[data-plugin="dsh-tokbook"] .dtpl-dial{
  position:relative;display:block;flex:none;
  width:108px;height:108px;
  color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-dial-ring{display:block;width:100%;height:100%;}
[data-plugin="dsh-tokbook"] .dtpl-dial-ring-track{
  fill:none;
  stroke:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-dial-ring-seg{fill:none;stroke-linecap:butt;}
[data-plugin="dsh-tokbook"] .dtpl-dial-val{
  position:absolute;inset:0;
  display:flex;align-items:center;justify-content:center;
}
[data-plugin="dsh-tokbook"] .dtpl-dial-figure{
  display:inline-flex;align-items:baseline;gap:1px;
  font-family:var(--dtpl-mono);font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-dial-figure b{
  font-size:var(--dtpl-fs-figure);line-height:1;font-weight:700;letter-spacing:-.04em;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-dial-figure span{
  font-size:var(--dtpl-fs-label);line-height:1;font-weight:600;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-dial-note{
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);white-space:nowrap;
}
@media (max-width:380px){
  [data-plugin="dsh-tokbook"] .dtpl-dial{width:92px;height:92px;}
  [data-plugin="dsh-tokbook"] .dtpl-dial-figure b{font-size:var(--dtpl-fs-lead);}
}
`
