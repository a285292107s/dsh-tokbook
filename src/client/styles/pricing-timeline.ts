/**
 * styles.ts fragment: the 调价史 drawer's time axis (`Pricing/Timeline.tsx`).
 *
 * The axis has to read as a *timeline* at a glance, so it borrows the ledger
 * tab's visual language (`.dtpl-trend` / `.dtpl-bar`): a bar per region, a
 * caption row beneath, tabular figures. Three states are told apart by shape,
 * not only by color — 无起点 fades off the left edge, 当前生效 is filled with
 * accent, 未生效 sits past the 今天 tick with a dashed bar.
 *
 * Cascade order is part of the contract (`client/styles.ts`): this fragment
 * follows the pricing one and only adds `.dtpl-tl-*`, so it cannot disturb it.
 */
export const CSS_PRICING_TIMELINE = `
[data-plugin="dsh-tokbook"] .dtpl-tl{
  display:flex;flex-direction:column;gap:6px;padding:2px 0 0;
  /* One 调价 = one node, and every node keeps at least this much room. The
     widest label the axis prints is an hourly boundary (2026-09-10 12:00),
     ~80px in 9px tabular figures — so two 调价 a day apart can never stack their
     dates on top of each other. Measured, not guessed: below ~86px the two
     labels touch. */
  --dtpl-tl-node-w:86px;
  /* Warn TEXT needs 4.5:1, and the skin's warn token measures 4.18:1 on this
     card (it is tuned for icons and fills, not for 9px text). Nudging it toward
     the foreground always moves contrast the right way — darker on a light skin,
     lighter on a dark one — while the hatch, the dot and the fill keep the pure
     token so the warning color itself still matches the rest of the plugin. */
  --tl-warn-text:color-mix(in srgb,var(--dtpl-warn) 78%,var(--dtpl-fg));
}
/* The track: nodes left to right, then the 今天 tick, then anything dated in the
   future. Nodes never compress below the floor above — the strip scrolls
   sideways instead (a dense 调价史 stays legible rather than turning to mush). */
[data-plugin="dsh-tokbook"] .dtpl-tl-track{
  display:flex;align-items:stretch;min-width:0;
  overflow-x:auto;overflow-y:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg{
  appearance:none;border:0;background:transparent;font:inherit;text-align:left;
  flex:1 1 auto;min-width:var(--dtpl-tl-node-w);cursor:pointer;
  display:flex;flex-direction:column;gap:3px;padding:0 0 2px;
  /* The one thing that changes per state is the fill, so the 无起点 gradient
     below can fade whichever fill the state chose instead of duplicating it. */
  --tl-fill:color-mix(in srgb,var(--dtpl-fg) 12%,transparent);
  /* The dot sits ON the bar, so it has to clear the BAR's composite, not the
     card's: fg-3 measured 2.48:1 there, fg-2 gives 3.88:1. */
  --tl-node:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg-k{
  /* fg-2, not fg-3: this label carries the axis's PRIMARY content (when the
     price changed), and 9px text needs 4.5:1 — measured 3.71:1 on fg-3. */
  font-size:9px;line-height:12px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg-bar{
  position:relative;
  display:block;width:100%;height:11px;
  border-radius:3px;corner-shape:round;
  background:var(--tl-fill);
}
/* The node: a dot where this interval begins, so 「几号调的价」 reads as a point
   and 「这段价管多久」 reads as the bar. A boundary that came BEFORE the axis's
   left end keeps one too: at that left end the price WAS in force (that is what
   the cap marks), so leaving its block unmarked made the front of the axis read
   as dead space. Its dot is hollow — that is how "its real date sits off this
   axis" looks. */
[data-plugin="dsh-tokbook"] .dtpl-tl-seg:not([data-open="true"]) .dtpl-tl-seg-bar::before{
  content:'';position:absolute;left:-2.5px;top:3px;
  width:5px;height:5px;border-radius:50%;box-sizing:border-box;
  background:var(--tl-node);
}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg[data-before="true"] .dtpl-tl-seg-bar::before{
  background:transparent;border:1.5px solid var(--tl-node);
}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg-tag{
  font-size:9px;line-height:12px;font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-2);min-height:12px;
}
/* An interval with no start: the bar dissolves into the left edge instead of
   beginning there. This is the whole point of the axis — a boundary that is not
   drawn is a boundary that does not exist. It has to hold for the 当前生效 fill
   too, which is the case where 无起点 actually shows up. */
[data-plugin="dsh-tokbook"] .dtpl-tl-seg[data-open="true"] .dtpl-tl-seg-bar{
  border-top-left-radius:0;border-bottom-left-radius:0;
  background:linear-gradient(to right,transparent 0%,var(--tl-fill) 30%);
}
/* Every block starts with a crisp left edge. For a boundary that predates the
   axis's left end the edge is that left end (the cap marks where this price
   already applied), and the label keeps the 「◀ date」 that says its real date is
   off the axis — having no tick at all is what made the front stretch look
   empty. A block whose boundary IS the left end keeps the edge too, and prints
   no date of its own: the cap above it names that instant. Its date keeps full
   readability; the hollow dot carries the "off the axis" part. */
[data-plugin="dsh-tokbook"] .dtpl-tl-seg:not([data-open="true"]) .dtpl-tl-seg-bar{
  border-left:1px solid color-mix(in srgb,var(--dtpl-fg) 30%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg[data-active="true"]{
  --tl-fill:color-mix(in srgb,var(--dtpl-accent) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg[data-active="true"] .dtpl-tl-seg-bar{
  border-left-color:var(--dtpl-accent);
}
/* Hierarchy by weight, not by dimming: the price in force is the row's answer,
   so its date is the boldest text on the axis while every other date keeps
   passing contrast. The accent stays on the fill and the dot — accent as 9px
   text on the card reaches only 4.33:1, under the 4.5:1 this tag needs. */
[data-plugin="dsh-tokbook"] .dtpl-tl-seg[data-active="true"] .dtpl-tl-seg-k{
  color:var(--dtpl-fg);font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg[data-active="true"] .dtpl-tl-seg-tag{color:var(--dtpl-fg);}
/* On the accent fill the accent dot would measure 2.14:1 — the node reads as a
   point only when it is darker than what it sits on. */
[data-plugin="dsh-tokbook"] .dtpl-tl-seg[data-active="true"]{--tl-node:var(--dtpl-fg);}
/* Written but idle: dashed, washed out, and past the 今天 tick — still a NODE
   (a written 调价), so it keeps its dot. */
[data-plugin="dsh-tokbook"] .dtpl-tl-seg[data-future="true"]{
  --tl-node:var(--dtpl-warn);
}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg[data-future="true"] .dtpl-tl-seg-bar{
  background:transparent;
  border:.5px dashed color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
  border-radius:3px;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg[data-future="true"] .dtpl-tl-seg-tag{color:var(--tl-warn-text);}
/* Hover wakes the bar up rather than recoloring the label only: the bar IS the
   control's visual body, and hover must not be the only cue that it is one
   (the label turns strong, and the fill gains a hairline). */
[data-plugin="dsh-tokbook"] .dtpl-tl-seg:hover .dtpl-tl-seg-k{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg:hover .dtpl-tl-seg-bar{
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-fg) 24%,transparent);
}
/* Focus: a 2px ring with an offset, the size WCAG 2.2's focus-appearance asks
   for — a 1px hairline was too easy to miss on an 11px bar. */
[data-plugin="dsh-tokbook"] .dtpl-tl-seg:focus-visible{outline:none;}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg:focus-visible .dtpl-tl-seg-k{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-tl-seg:focus-visible .dtpl-tl-seg-bar{
  outline:2px solid var(--dtpl-accent);outline-offset:2px;
}
/* 今天: the axis's right end. A tick, so a future segment reads as "to the
   right of now" rather than as one more boundary in the same series. Its label
   rides the DATE row with every other time label — parked at the bottom it left
   the axis's corners blank, which read as a missing label rather than as empty
   space. */
[data-plugin="dsh-tokbook"] .dtpl-tl-now{
  flex:none;display:flex;align-items:flex-start;
  align-self:stretch;padding:0 5px 0 6px;
  border-left:.5px dashed var(--dtpl-border);
  font-size:9px;line-height:12px;color:var(--dtpl-fg-2);white-space:nowrap;
}
/* 首记: the axis's LEFT end — this row's first ledger record at the price file's
   own precision (the hour it falls in), not the earliest boundary the price file
   drew. It is a TICK and nothing else: a label cell here would hold its width in
   the bar row (the track is one flex row of stacked cells, not two rows) and
   read as a gap between the left end and the first bar. The instant it stands
   for is named in the sentence under the axis. 今天 has the matching tick at the
   other end. */
[data-plugin="dsh-tokbook"] .dtpl-tl-cap{
  flex:none;align-self:stretch;
  border-right:.5px dashed var(--dtpl-border);
}
/* Account the price table does not reach: a region of the axis, not a badge —
   it is the money half of this axis, and the only place a PRICED row admits it
   is not pricing its whole history. Neutral when the row has no price at all
   (the 价格未知 badge already owns that). It is NOT a node (no 调价 happened),
   so it carries no dot. */
[data-plugin="dsh-tokbook"] .dtpl-tl-gap{
  flex:1 1 auto;min-width:var(--dtpl-tl-node-w);
  display:flex;flex-direction:column;gap:3px;padding:0 0 2px;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-gap .dtpl-tl-seg-bar{
  background:repeating-linear-gradient(135deg,
    color-mix(in srgb,var(--dtpl-fg) 14%,transparent) 0 4px,
    transparent 4px 8px);
}
[data-plugin="dsh-tokbook"] .dtpl-tl-gap[data-warn="true"] .dtpl-tl-seg-k,
[data-plugin="dsh-tokbook"] .dtpl-tl-gap[data-warn="true"] .dtpl-tl-seg-tag{color:var(--tl-warn-text);}
[data-plugin="dsh-tokbook"] .dtpl-tl-gap[data-warn="true"] .dtpl-tl-seg-bar{
  background:repeating-linear-gradient(135deg,
    color-mix(in srgb,var(--dtpl-warn) 26%,transparent) 0 4px,
    transparent 4px 8px);
}
[data-plugin="dsh-tokbook"] .dtpl-tl-note{
  margin:0;font-size:10px;line-height:15px;color:var(--dtpl-fg-2);
}
/* The one sentence on this axis that costs money. */
[data-plugin="dsh-tokbook"] .dtpl-tl-note [data-warn="true"]{color:var(--tl-warn-text);}
`
