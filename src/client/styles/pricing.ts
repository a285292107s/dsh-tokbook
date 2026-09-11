/** styles.ts fragment: pricing. Concatenated in order by `injectStyles`. */
export const CSS_PRICING = `/* ── pricing tab (价格表) ───────────────────────────────────────────────── */
/* The tab is a TABLE, not a form: one card per route, one row per model, the
   four ¥/M buckets as fixed right-aligned columns so numbers compare down the
   list. Cells read as text and become inputs on focus, the row's own line
   carries its issue, and the drawer behind ▸ holds the 调价史. */

[data-plugin="dsh-tokbook"] .dtpl-price-sec{display:flex;flex-direction:column;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-price-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-search{
  flex:1;min-width:0;height:28px;padding:0 10px;
  border-radius:8px;corner-shape:round;
  border:.5px solid var(--dtpl-border);background:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-search::placeholder{color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-price-chip{
  appearance:none;flex:none;height:28px;padding:0 10px;
  display:inline-flex;align-items:center;gap:6px;
  border-radius:8px;corner-shape:round;
  border:.5px solid var(--dtpl-border);background:transparent;
  color:var(--dtpl-fg-2);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-chip:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-chip.is-on{
  color:var(--dtpl-warn);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
  background:color-mix(in srgb,var(--dtpl-warn) 10%,transparent);
}
/* The one-time legend: what 「—」 means, said once instead of on every row. */
[data-plugin="dsh-tokbook"] .dtpl-price-legend{
  margin:0;font-size:11px;line-height:17px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-legend b{color:var(--dtpl-warn);font-weight:600;}

[data-plugin="dsh-tokbook"] .dtpl-price-cards{display:flex;flex-direction:column;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-price-card{
  border:.5px solid var(--dtpl-border);border-radius:12px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
  overflow:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-price-head{
  display:flex;align-items:center;gap:8px;
  padding:6px 10px 6px 6px;border-bottom:.5px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-price-card[data-collapsed="true"] .dtpl-price-head{border-bottom:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-fold{
  appearance:none;border:0;background:transparent;text-align:left;
  flex:1;min-width:0;display:flex;align-items:center;gap:8px;
  padding:3px 4px;border-radius:7px;corner-shape:round;
  font:inherit;color:inherit;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fold:hover{background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-caret{flex:none;width:10px;color:var(--dtpl-fg-3);font-size:9px;}
[data-plugin="dsh-tokbook"] .dtpl-price-label{flex:none;font-size:13px;line-height:20px;font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-key{
  flex:none;font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-price-count{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch{
  flex:none;display:inline-flex;align-items:center;gap:2px;padding:2px;
  border-radius:9px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button{
  appearance:none;border:0;background:transparent;
  height:24px;padding:0 9px;border-radius:7px;corner-shape:round;
  color:var(--dtpl-fg-3);font:inherit;font-size:11px;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button[aria-pressed="true"]{
  background:var(--dtpl-card);color:var(--dtpl-fg);font-weight:600;
  box-shadow:0 1px 2px rgba(0,0,0,.08);
}
[data-plugin="dsh-tokbook"] .dtpl-price-empty{
  margin:0;padding:10px 11px;font-size:12px;line-height:18px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-price-rows{display:flex;flex-direction:column;}

/* Every row is its own grid on the SAME tracks as the column header above it:
   identity (grows) | four fixed rate columns | one disclosure slot. */
[data-plugin="dsh-tokbook"] .dtpl-price-cols,
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  --dtpl-rate-w:84px;
  --dtpl-rate-gap:6px;
  --dtpl-rates-w:calc(4 * var(--dtpl-rate-w) + 3 * var(--dtpl-rate-gap));
  display:grid;
  grid-template-columns:minmax(0,1fr) var(--dtpl-rates-w) 26px;
  column-gap:10px;align-items:center;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cols{
  padding:5px 10px 3px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-col-id{padding-left:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-cols .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);
}
[data-plugin="dsh-tokbook"] .dtpl-price-col-rate{text-align:right;}
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  min-height:36px;padding:2px 10px;border-top:.5px solid var(--dtpl-border);
  scroll-margin-block:56px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-row:first-child{border-top:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-dirty="true"],
[data-plugin="dsh-tokbook"] .dtpl-price-row:focus-within{
  background:color-mix(in srgb,var(--dtpl-accent) 7%,transparent);
  box-shadow:inset 2px 0 0 var(--dtpl-accent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-open="true"]{
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-id{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-name{display:flex;align-items:center;gap:5px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-model{
  min-width:0;flex:0 1 auto;
  font-family:var(--dtpl-mono);font-size:12px;line-height:16px;color:var(--dtpl-fg);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge{
  flex:none;
  display:inline-flex;align-items:center;height:15px;padding:0 5px;
  border-radius:5px;corner-shape:round;
  font-size:10px;line-height:15px;font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-3);background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge-unknown{
  color:var(--dtpl-warn);background:color-mix(in srgb,var(--dtpl-warn) 14%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge-dirty{
  color:var(--dtpl-accent);background:color-mix(in srgb,var(--dtpl-accent) 15%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-meta{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
}
/* What is wrong with THIS row, right under its own cells. */
[data-plugin="dsh-tokbook"] .dtpl-price-issue{
  margin:0;padding:2px 10px 4px 10px;
  font-size:10px;line-height:15px;color:var(--dtpl-err);
}

/* The four cells: text until focused, real inputs always (so Tab walks them).
   Right-aligned tabular figures keep a column comparable down the whole list. */
[data-plugin="dsh-tokbook"] .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-cell-k{
  display:none;font-size:9px;line-height:12px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-price-input{
  width:100%;box-sizing:border-box;
  height:26px;padding:0 7px;
  border:.5px solid transparent;border-radius:6px;corner-shape:round;
  background:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:12px;line-height:16px;
  font-variant-numeric:tabular-nums;text-align:right;
}
[data-plugin="dsh-tokbook"] .dtpl-price-input::placeholder{color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-price-input:hover{border-color:var(--dtpl-border);}
[data-plugin="dsh-tokbook"] .dtpl-price-input:focus{
  outline:none;border-color:var(--dtpl-accent);
  background:var(--dtpl-surface);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell[data-state="bad"] .dtpl-price-input{
  color:var(--dtpl-err);border-color:color-mix(in srgb,var(--dtpl-err) 55%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell-err{
  font-size:9px;line-height:13px;color:var(--dtpl-err);text-align:right;
}
[data-plugin="dsh-tokbook"] .dtpl-price-more{
  appearance:none;border:0;background:transparent;
  width:26px;height:26px;padding:0;border-radius:7px;corner-shape:round;
  color:var(--dtpl-fg-3);font:inherit;font-size:10px;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-more:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-more[aria-expanded="true"]{color:var(--dtpl-accent);background:color-mix(in srgb,var(--dtpl-accent) 12%,transparent);}

[data-plugin="dsh-tokbook"] .dtpl-price-add{
  appearance:none;border:.5px solid var(--dtpl-border);background:transparent;
  display:inline-flex;align-items:center;justify-content:center;
  height:26px;padding:0 10px;border-radius:8px;corner-shape:round;
  color:var(--dtpl-fg-2);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-add:hover{color:var(--dtpl-fg);border-color:color-mix(in srgb,var(--dtpl-fg) 25%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:disabled{opacity:.45;cursor:not-allowed;}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost{
  appearance:none;border:0;background:transparent;
  height:24px;padding:0 8px;border-radius:7px;corner-shape:round;
  color:var(--dtpl-fg-3);font:inherit;font-size:11px;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger:hover{color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 10%,transparent);}

/* The 调价史 drawer behind ▸: the row's own model string, then one block per
   segment (date + four labelled rates + note). Segment actions stay reachable
   by keyboard and appear on hover/focus, so a long history reads as data. */
[data-plugin="dsh-tokbook"] .dtpl-price-history{
  display:flex;flex-direction:column;gap:6px;
  padding:8px 10px 10px;
  border-top:.5px dashed var(--dtpl-border);
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-history-head{
  display:flex;justify-content:space-between;gap:10px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-price-history-model{
  min-width:0;font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);
  overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-price-history-colid{flex:none;font-variant-numeric:tabular-nums;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg{
  display:flex;flex-direction:column;gap:5px;
  padding:6px 8px;border-radius:9px;corner-shape:round;
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg[data-active="true"]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-accent) 45%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-head{display:flex;align-items:center;gap:8px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-date{display:flex;align-items:center;gap:6px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-date-k{font-size:10px;line-height:14px;color:var(--dtpl-fg-2);white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-input-date{
  width:auto;min-width:132px;text-align:left;border-color:var(--dtpl-border);
  background:var(--dtpl-card);padding:0 6px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-tag{
  display:inline-flex;align-items:center;gap:5px;min-width:0;
  font-size:10px;line-height:15px;color:var(--dtpl-fg-3);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-live{
  font-style:normal;font-weight:600;color:var(--dtpl-accent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-actions{
  margin-left:auto;display:inline-flex;align-items:center;gap:2px;
  opacity:0;transition:opacity .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg:hover .dtpl-price-seg-actions,
[data-plugin="dsh-tokbook"] .dtpl-price-seg:focus-within .dtpl-price-seg-actions{opacity:1;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-rates{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-rates .dtpl-price-cell-k{display:block;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg .dtpl-price-input{
  text-align:left;border-color:var(--dtpl-border);background:var(--dtpl-card);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-note{display:block;}
[data-plugin="dsh-tokbook"] .dtpl-price-input-note{text-align:left;font-variant-numeric:normal;}
[data-plugin="dsh-tokbook"] .dtpl-price-history-foot{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-history-hint{margin:0;font-size:10px;line-height:15px;color:var(--dtpl-fg-2);}

/* The save state of the file, in the toolbar: it is the whole feedback loop for
   a table that writes itself, so a failure wraps instead of being clipped. */
[data-plugin="dsh-tokbook"] .dtpl-price-state{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saved{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saving{color:var(--dtpl-accent);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-invalid{color:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-error{color:var(--dtpl-err);font-weight:600;}
`
