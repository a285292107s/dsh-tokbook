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
  padding:8px 10px 8px 8px;border-bottom:.5px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-price-card[data-collapsed="true"] .dtpl-price-head{border-bottom:0;}
/* The fold wraps as a UNIT rather than crushing its own counts: the route key
   is the unpredictable value (it is whatever the user configured), so it is the
   one allowed to ellipsize, while the summary keeps its whole text. */
[data-plugin="dsh-tokbook"] .dtpl-price-fold{
  appearance:none;border:0;background:transparent;text-align:left;
  flex:1;min-width:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  row-gap:2px;
  padding:3px 4px;border-radius:7px;corner-shape:round;
  font:inherit;color:inherit;cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fold:hover{background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-caret{flex:none;width:10px;color:var(--dtpl-fg-3);font-size:9px;}
[data-plugin="dsh-tokbook"] .dtpl-price-label{flex:none;font-size:13px;line-height:20px;font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-key{
  flex:0 1 auto;min-width:0;
  font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-count{
  flex:none;white-space:nowrap;
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

/* ONE rate-cell metric, defined at the tab root so the table and the 调价史
   drawer cannot drift apart: a ¥/M cell is the same size wherever it appears.

   The width is set by what a rate can BE, not by today's numbers. Measured in
   the real font at 12px tabular figures: 0.02 / 13.5 are 22px, 0.0028 is 35px,
   and an 8-character rate (0.003625 — DeepSeek's own historical cache-hit
   price — or 123.4567) is 47.9px. With 7px of side padding that needs 62px, so
   64px is the tightest safe column; ~56px would clip the 8th character.
   Shrinking further trades a cosmetic gain for silently unreadable prices, so
   the floor is written down here instead.
   --dtpl-cell-pad-x is shared with the column header on purpose: the header
   must end on the same edge as the numbers under it (see .dtpl-price-col-rate). */
[data-plugin="dsh-tokbook"] .dtpl-price-sec{
  --dtpl-cell-pad-x:7px;
  --dtpl-rate-w:64px;
  --dtpl-rate-gap:6px;
  --dtpl-rates-w:calc(4 * var(--dtpl-rate-w) + 3 * var(--dtpl-rate-gap));
}

/* Every row is its own grid on the SAME tracks as the column header above it:
   identity (grows) | four fixed rate columns | one disclosure slot.

   The rate track is sized to what a rate actually IS, not to the column's
   label: a ¥/M rate is a handful of characters, so the narrowest safe column
   (see the metric above) leaves the remaining width to the only column holding
   unpredictable text — the model identity, which used to be squeezed to 258px
   and clip its billing string while four 84px columns sat mostly empty. */
[data-plugin="dsh-tokbook"] .dtpl-price-cols,
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) var(--dtpl-rates-w) 26px;
  column-gap:10px;align-items:center;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cols{
  padding:6px 10px 4px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-col-id{padding-left:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-cols .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);
}
/* The label shares the value's right edge exactly: without this the header ends
   at the cell's border while the number ends 7px inside it, so every column
   reads as two edges that almost line up. */
[data-plugin="dsh-tokbook"] .dtpl-price-col-rate{
  text-align:right;padding-right:var(--dtpl-cell-pad-x);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  min-height:40px;padding:4px 10px;border-top:.5px solid var(--dtpl-border);
  scroll-margin-block:56px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-row:first-child{border-top:0;}
/* Three row states, told apart by ONE convention: an accent BAR means
   "unsaved", a neutral lift means "expanded", a ring means "focus".
   The bar is never spent on anything but dirt, so it cannot be misread. */
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-dirty="true"]{
  background:color-mix(in srgb,var(--dtpl-accent) 7%,transparent);
  box-shadow:inset 2px 0 0 var(--dtpl-accent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-open="true"]{
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row:focus-within{
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-accent) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-dirty="true"]:focus-within{
  box-shadow:inset 2px 0 0 var(--dtpl-accent),
    inset 0 0 0 1px color-mix(in srgb,var(--dtpl-accent) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-id{display:flex;flex-direction:column;gap:2px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-name{
  display:flex;align-items:center;gap:5px;min-width:0;flex-wrap:wrap;row-gap:2px;
}
/* The model picker's identity split, given its own line each so neither half
   has to fight the other for width: the human NAME is the label and never
   shrinks away; the exact model string is the identity (the billing key) and
   gets the full column on the line below. */
[data-plugin="dsh-tokbook"] .dtpl-price-title{
  flex:0 1 auto;min-width:0;
  font-size:12px;line-height:16px;font-weight:500;color:var(--dtpl-fg);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* A row nothing names stands on its exact string alone, so it takes the
   label's tone and weight rather than reading as a de-emphasized aside. */
[data-plugin="dsh-tokbook"] .dtpl-price-title:only-child{
  color:var(--dtpl-fg);font-family:var(--dtpl-mono);
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
/* 峰谷 marks the row whose four visible numbers are NOT the whole story — it
   has to read as "there is more pricing inside" at a glance. */
[data-plugin="dsh-tokbook"] .dtpl-price-badge-slot{
  color:var(--dtpl-accent);background:color-mix(in srgb,var(--dtpl-accent) 12%,transparent);
}
/* 未生效 is a caution, not an alarm: the price is written but idle. */
[data-plugin="dsh-tokbook"] .dtpl-price-badge-idle{
  color:var(--dtpl-warn);background:color-mix(in srgb,var(--dtpl-warn) 12%,transparent);
}
/* Provenance line: what the price is and how much the ledger billed with it. The
   row's identity is NOT repeated here — it is on the line above, once. */
[data-plugin="dsh-tokbook"] .dtpl-price-meta{
  display:flex;align-items:baseline;gap:5px;min-width:0;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-meta-text{
  flex:0 1000 auto;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* What is wrong with THIS row, right under its own cells. */
[data-plugin="dsh-tokbook"] .dtpl-price-issue{
  margin:0;padding:2px 10px 6px 10px;
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
  height:26px;padding:0 var(--dtpl-cell-pad-x);
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
  font-size:10px;line-height:14px;color:var(--dtpl-err);text-align:right;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
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

/* The 调价史 drawer behind ▸ — the surface ladder, spelled out once:
     page        (nothing)
     card         fg 4%                       ← this tab's panel
     open row     fg 7%                       ← the row it belongs to
     drawer       NO fill, dashed seam        ← a recess, not another panel
     .seg         --dtpl-surface (layer-1)    ← a block raised out of the recess
     .slot        accent 6%                   ← the peak window inside the block
   The drawer deliberately adds no wash of its own: stacking one translucent
   fill inside another made the drawer and the card the same tone, which is why
   a segment block used to read as the card itself. A recess is shown by the
   seam and by the blocks standing on it. */
[data-plugin="dsh-tokbook"] .dtpl-price-history{
  display:flex;flex-direction:column;gap:8px;
  padding:8px 10px 12px;
  border-top:.5px dashed var(--dtpl-border);
  background:transparent;
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
  width:auto;min-width:158px;text-align:left;border-color:var(--dtpl-border);
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
/* The drawer is a FORM, so its four rate fields use the width they are given
   (four equal columns) while every input keeps the table's rate metric — the
   box a rate is typed into is one size across the whole tab. Capping the input
   rather than the column is what stops a 156px trough around a 22px number. */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-rates,
[data-plugin="dsh-tokbook"] .dtpl-price-slot-rates{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
  column-gap:var(--dtpl-rate-gap);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-rates .dtpl-price-input,
[data-plugin="dsh-tokbook"] .dtpl-price-slot-rates .dtpl-price-input{
  max-width:var(--dtpl-rate-w);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-rates .dtpl-price-cell-k{display:block;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg .dtpl-price-input{
  text-align:left;border-color:var(--dtpl-border);background:var(--dtpl-card);
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-note{display:block;}
[data-plugin="dsh-tokbook"] .dtpl-price-input-note{text-align:left;font-variant-numeric:normal;}

/* The whole-day price of one segment is labelled, because the same four buckets
   appear again below as exception slots: without the 00:00–24:00 range the two
   levels would look like two rows of the same table. */
[data-plugin="dsh-tokbook"] .dtpl-price-sub{display:flex;align-items:baseline;gap:6px;}
[data-plugin="dsh-tokbook"] .dtpl-price-sub-k,
[data-plugin="dsh-tokbook"] .dtpl-price-slots-k{
  display:inline-flex;align-items:baseline;gap:5px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-sub-k em,
[data-plugin="dsh-tokbook"] .dtpl-price-slots-k em{
  font-style:normal;font-family:var(--dtpl-mono);color:var(--dtpl-fg-3);
}

/* 峰谷时段 (peak/off-peak windows): one bordered row each, tinted with the
   accent so "this hour range has its own price" reads as a separate, weightier
   object than the whole-day price above it — not as a second row of the same
   table. */
[data-plugin="dsh-tokbook"] .dtpl-price-slots{display:flex;flex-direction:column;gap:5px;margin-top:1px;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot{
  display:flex;flex-direction:column;gap:5px;
  padding:5px 7px;border-radius:8px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 6%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--dtpl-accent) 22%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-clock{
  display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-dash{color:var(--dtpl-fg-3);font-size:11px;}
[data-plugin="dsh-tokbook"] .dtpl-price-select{
  appearance:none;height:24px;padding:0 20px 0 7px;
  border-radius:7px;corner-shape:round;
  border:.5px solid var(--dtpl-border);background:var(--dtpl-card);color:var(--dtpl-fg);
  font:inherit;font-size:11px;line-height:16px;cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,var(--dtpl-fg-3) 50%),
    linear-gradient(135deg,var(--dtpl-fg-3) 50%,transparent 50%);
  background-position:calc(100% - 11px) 10px,calc(100% - 7px) 10px;
  background-size:4px 4px,4px 4px;background-repeat:no-repeat;
}
[data-plugin="dsh-tokbook"] .dtpl-price-select:hover{border-color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-price-select-days{min-width:68px;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-rates .dtpl-price-cell-k{display:block;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot:hover .dtpl-price-seg-actions,
[data-plugin="dsh-tokbook"] .dtpl-price-slot:focus-within .dtpl-price-seg-actions{opacity:1;}
[data-plugin="dsh-tokbook"] .dtpl-price-slots-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
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
