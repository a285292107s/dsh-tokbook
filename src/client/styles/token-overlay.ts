export const CSS_TOKEN_OVERLAY = `
[data-plugin="dsh-tokbook"] .dtpl-ttk-sk{height:150px;}
[data-plugin="dsh-tokbook"] .dtpl-ttk-buckets{display:flex;flex-direction:column;gap:2px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-ttk-bucket{
  display:grid;grid-template-columns:9px minmax(0,1fr) auto 34px;
  align-items:center;column-gap:8px;min-width:0;padding:2px 0;
}
[data-plugin="dsh-tokbook"] .dtpl-ttk-bucket-name{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-ttk-bucket-value{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  font-weight:700;font-variant-numeric:tabular-nums;color:var(--dtpl-fg);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-ttk-bucket-share{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  font-variant-numeric:tabular-nums;color:var(--dtpl-fg-2);text-align:right;white-space:nowrap;
}
@media (max-width:380px){
  [data-plugin="dsh-tokbook"] .dtpl-ttk-sk{height:142px;}
}
@media (max-width:340px){
  [data-plugin="dsh-tokbook"] .dtpl-ttk-bucket{grid-template-columns:9px minmax(0,1fr) auto;}
  [data-plugin="dsh-tokbook"] .dtpl-ttk-bucket-share{display:none;}
}
`
