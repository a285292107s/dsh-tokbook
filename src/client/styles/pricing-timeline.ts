/**
 * styles.ts fragment: the 调价史 drawer's axis (`Pricing/Timeline.tsx`).
 *
 * The axis is a rail with dated nodes on it: 首记 and 今天 label the two ends
 * ABOVE the rail, one dot per 调价 sits on it with its date UNDER it. Nothing
 * else — the bar-per-segment, the state tags and the note under the axis are gone
 * (the module doc in `Timeline.tsx` says why), so this fragment no longer borrows
 * the ledger trend chart's language: all it has to make legible is one horizontal
 * line, N dots and N dates.
 *
 * Cascade order is part of the contract (`client/styles.ts`): this fragment
 * follows the pricing one and only adds `.dtpl-tl-*`, so it cannot disturb it.
 */
export const CSS_PRICING_TIMELINE = `
[data-plugin="dsh-tokbook"] .dtpl-tl{padding:1px 0 0;}
/* The track is only a measuring box: the rail, the dots and the labels are all
   placed against the width JS measured (a minimum gap is a px width, and a
   percentage cannot keep two labels from piling up in a narrow drawer). Three
   rows, top to bottom: the bracket's two labels (首记 / 今天), the rail with its
   dots, and the 调价 dates — 12 + 5 + 3 + 4 + 12 = 36px. */
[data-plugin="dsh-tokbook"] .dtpl-tl-track{position:relative;height:36px;}
/* The rail is the skin's tertiary label color, not a wash of the foreground: it
   has to READ as the line the dates hang from (a 22% mix measured ~2:1 on the
   card and all but vanished), while staying subordinate to the dots. fg-3 is the
   token for exactly that — 3.18:1 on a light card (D-016) and 6.2:1 on this dark
   one. 3px, not a hairline: at 1px it read as a stray rule rather than as the
   axis the nodes are threaded on (2px still read thin beside the 5px dots). */
[data-plugin="dsh-tokbook"] .dtpl-tl-rail{
  position:absolute;left:0;right:0;top:17px;height:3px;
  border-radius:1.5px;background:var(--dtpl-fg-3);
}
/* One node: its dot on the rail, its date UNDER it. A node with a segment behind
   it is a button (the axis is navigation, not decoration); an end with no 调价 on
   it is a plain element, so the pointer never promises a jump that does not
   exist. The box is the whole track high, which is what makes a 5px dot a 36px
   target. */
[data-plugin="dsh-tokbook"] .dtpl-tl-node{
  position:absolute;top:0;left:0;height:100%;
  appearance:none;font:inherit;text-align:center;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] button.dtpl-tl-node{
  border:0;background:transparent;padding:0;margin:0;cursor:pointer;
  /* A <button> with a definite height centres its content box vertically (UA
     button layout) — and this box is the whole track high, so on the rows whose
     left end carries a node (the 无起点 segment anchored at 首记) the 首记 label
     landed 12px low, in the middle row, while the plain <span> ends stayed on
     top. Making the button a column flex container takes that centring away:
     justify-content:flex-start puts the label back at the box's top. */
  display:flex;flex-direction:column;justify-content:flex-start;
}
/* Every node but the two ends is centred on the dot it belongs to. */
[data-plugin="dsh-tokbook"] .dtpl-tl-node:not([data-cap]){transform:translateX(-50%);}
/* A 调价 date hangs BELOW the rail (24–36px); the bracket's own two labels stay
   ABOVE it (0–12px, the node box's natural top) — they name the range's ends, not
   one of the dots, so they read as the axis's caps rather than as two more
   nodes. */
[data-plugin="dsh-tokbook"] .dtpl-tl-node-k{
  display:block;margin-top:24px;
  font-size:9px;line-height:12px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap] .dtpl-tl-node-k{margin-top:0;}
/* The dot sits ON the rail: 5px at 16px over a 3px line at 17px centres both at
   18.5. fg-2, not fg-3: the dot is a non-text object and needs 3:1 against what
   it sits on (D-016 measured fg-3 at 2.48:1 here). */
[data-plugin="dsh-tokbook"] .dtpl-tl-dot{
  position:absolute;top:16px;left:50%;
  width:5px;height:5px;border-radius:50%;box-sizing:border-box;
  background:var(--dtpl-fg-2);transform:translateX(-50%);
}
/* The two ends hold their labels inside the track — the first one starts at its
   left edge, the last one ends at its right edge — and their dots sit on those
   very edges. They ARE the bracket, so nothing pushes them inward. */
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="start"]{left:0;text-align:left;}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="today"]{left:auto;right:0;text-align:right;}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="start"] .dtpl-tl-dot{left:0;}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="today"] .dtpl-tl-dot{left:100%;}
/* The price in force today: the one node that is a state and not only a date.
   Accent (3.72:1 on the card, D-016) plus a wider dot — the cue is not carried
   by color alone, and the row and the segment list still say it in words. */
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-active="true"] .dtpl-tl-node-k{
  color:var(--dtpl-fg);font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-active="true"] .dtpl-tl-dot{
  top:15.5px;width:6px;height:6px;background:var(--dtpl-accent);
}
/* Hover wakes the node up: the date and the dot ARE the control's body, so they
   have to show it is one. Focus: a 2px ring with an offset, the size WCAG 2.2's
   focus-appearance asks for; a 1px hairline was too easy to miss on a 5px dot.
   Nothing here animates, so there is no reduced-motion branch to take. */
[data-plugin="dsh-tokbook"] button.dtpl-tl-node:hover .dtpl-tl-node-k{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] button.dtpl-tl-node:hover .dtpl-tl-dot{
  box-shadow:0 0 0 2px color-mix(in srgb,var(--dtpl-fg) 18%,transparent);
}
[data-plugin="dsh-tokbook"] button.dtpl-tl-node:focus-visible{outline:none;}
[data-plugin="dsh-tokbook"] button.dtpl-tl-node:focus-visible .dtpl-tl-node-k{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] button.dtpl-tl-node:focus-visible .dtpl-tl-dot{
  outline:2px solid var(--dtpl-accent);outline-offset:2px;
}
`
