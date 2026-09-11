/** styles.ts fragment: provider. Concatenated in order by `injectStyles`. */
export const CSS_PROVIDER = `/* ── provider-usage tab ─────────────────────────────────────────────────── */
/* Range switcher: a compact segmented control above the cards. */
[data-plugin="dsh-tokbook"] .dtpl-provider-sec{display:flex;flex-direction:column;gap:10px;}
[data-plugin="dsh-tokbook"] .dtpl-range-tabs{
  display:inline-flex;gap:2px;align-self:flex-start;flex:none;
  padding:2px;border-radius:9px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab{
  appearance:none;border:0;background:transparent;
  height:24px;padding:0 12px;
  font:inherit;font-size:12px;line-height:18px;font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;
  border-radius:7px;corner-shape:round;cursor:pointer;
  transition:background .15s ease,color .15s ease,box-shadow .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-range-tab:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-range-tab.dtpl-range-active{
  color:var(--dtpl-fg);
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border,rgba(0,0,0,.14));
}
[data-plugin="dsh-tokbook"] .dtpl-providers{display:flex;flex-direction:column;gap:10px;}

/* One provider card: a washed panel with its own head row. */
[data-plugin="dsh-tokbook"] .dtpl-provider-card{
  padding:12px 14px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-provider-head{
  display:flex;align-items:flex-end;justify-content:space-between;gap:16px;
  margin-bottom:10px;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-id{
  display:flex;flex-direction:column;gap:2px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-title{
  display:flex;align-items:center;gap:6px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-name{
  color:var(--dtpl-fg);font-size:14px;line-height:20px;font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* The route key under a label: the mirror's name leads, the ledger's key follows. */
[data-plugin="dsh-tokbook"] .dtpl-provider-key{
  font-family:var(--dtpl-mono,ui-monospace,SFMono-Regular,Menlo,monospace);
  font-size:10px;
}
/* What this card's money means: 按量 (cash) / 订阅 (value) / 混合. */
[data-plugin="dsh-tokbook"] .dtpl-provider-bill{
  flex:none;padding:1px 5px;border-radius:999px;
  font-size:10px;line-height:14px;font-weight:600;
  color:var(--dtpl-fg-3);
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-provider-bill[data-billing="subscription"]{
  color:var(--dtpl-accent);background:color-mix(in srgb,var(--dtpl-accent) 10%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-provider-meta{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-nums{
  display:flex;flex-direction:column;align-items:flex-end;gap:1px;flex:none;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-tokens{
  color:var(--dtpl-fg);font-size:18px;line-height:24px;font-weight:700;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-cost{
  display:flex;flex-direction:column;align-items:flex-end;gap:1px;
  color:var(--dtpl-accent);font-size:12px;line-height:18px;font-weight:600;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-spend{font-weight:600;color:var(--dtpl-accent);}
[data-plugin="dsh-tokbook"] .dtpl-provider-value{color:var(--dtpl-fg-3);font-weight:400;font-size:10px;line-height:14px;}
[data-plugin="dsh-tokbook"] .dtpl-provider-model-sub{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-provider-models{
  display:flex;flex-direction:column;gap:9px;
  padding-top:10px;
  border-top:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-sk-card{height:132px;}
`
