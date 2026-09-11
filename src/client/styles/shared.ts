/** styles.ts fragment: shared. Concatenated in order by `injectStyles`. */
export const CSS_SHARED = `/* ── dark-skin fallback tuning ──────────────────────────────────────────── */
/* Tokens carry most of the load; these only adjust fallback-adjacent washes
   that need slightly more lift on dark surfaces. */
body[data-ds-dark-theme] [data-plugin="dsh-tokbook"] .dtpl-hero{
  background:linear-gradient(135deg,
    color-mix(in srgb,var(--dtpl-accent) 16%,transparent),
    color-mix(in srgb,var(--dtpl-accent) 6%,transparent));
}
body[data-ds-dark-theme] [data-plugin="dsh-tokbook"] .dtpl-stat,
body[data-ds-dark-theme] [data-plugin="dsh-tokbook"] .dtpl-bars,
body[data-ds-dark-theme] [data-plugin="dsh-tokbook"] .dtpl-provider-card,
body[data-ds-dark-theme] [data-plugin="dsh-tokbook"] .dtpl-quota-card{
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}

/* ── selection ──────────────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-body ::selection{
  background:color-mix(in srgb,var(--dtpl-accent) 25%,transparent);
}

/* ── responsive ─────────────────────────────────────────────────────────── */
@media (max-width:640px){
  /* Bottom sheet: explicit choice instead of a half-centered 94dvh dialog.
     Full-bleed width, anchored to the bottom edge with only the top corners
     rounded (the native mobile sheet idiom), still a fixed height + the same
     single internal scroll region. */
  [data-plugin="dsh-tokbook"].dtpl-overlay{padding:0;align-items:flex-end;}
  [data-plugin="dsh-tokbook"] .dtpl-card{
    width:100%;height:min(94dvh,94vh);
    border-radius:var(--dtpl-radius) var(--dtpl-radius) 0 0;corner-shape:round;
    box-shadow:var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.28)),
      inset 0 0 0 .5px var(--dsw-elevation-stroke-color,var(--dtpl-hairline));
  }
  [data-plugin="dsh-tokbook"] .dtpl-head{padding:14px 16px 10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tabs{margin:0 16px 4px;}
  /* Five tabs do not fit a phone width: let the row scroll instead of clipping
     the last tab off the card edge. */
  [data-plugin="dsh-tokbook"] .dtpl-tabs{overflow-x:auto;scrollbar-width:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tabs::-webkit-scrollbar{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tab{flex:0 0 auto;}
  [data-plugin="dsh-tokbook"] .dtpl-body{padding:12px 16px 14px;}
  [data-plugin="dsh-tokbook"] .dtpl-foot{padding:10px 16px 12px;}
  [data-plugin="dsh-tokbook"] .dtpl-hero{flex-direction:column;align-items:flex-start;gap:8px;}
  /* The meta line turns horizontal on a narrow sheet; let its items wrap as
     units instead of running off the card edge. */
  [data-plugin="dsh-tokbook"] .dtpl-hero-meta{flex-direction:row;flex-wrap:wrap;gap:8px 12px;align-items:baseline;}
  /* Method doc: stack the multi-column groups on narrow sheets. */
  [data-plugin="dsh-tokbook"] .dtpl-doc-facts{grid-template-columns:1fr;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-buckets{grid-template-columns:1fr;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-gap{grid-template-columns:1fr;}

  /* Pricing: four rate columns plus the model identity do not fit a phone.
     Stack the row — identity, then a 2×2 grid of labelled cells, then the
     disclosure — and drop the column header, which no longer lines up. */
  [data-plugin="dsh-tokbook"] .dtpl-price-cols{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-price-row{
    grid-template-columns:minmax(0,1fr) auto;row-gap:4px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-id{grid-column:1;}
  [data-plugin="dsh-tokbook"] .dtpl-price-more{grid-column:2;grid-row:1;}
  [data-plugin="dsh-tokbook"] .dtpl-price-rates{
    grid-column:1 / -1;
    grid-template-columns:repeat(2,minmax(0,1fr));row-gap:4px;
    margin-top:2px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-cell-k{display:block;}
  [data-plugin="dsh-tokbook"] .dtpl-price-input{text-align:left;}
  [data-plugin="dsh-tokbook"] .dtpl-price-seg-rates{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-seg-head{flex-wrap:wrap;}
  [data-plugin="dsh-tokbook"] .dtpl-price-seg-actions{opacity:1;}
}

/* ── motion (shared tokens; respect reduced motion) ─────────────────────── */
@media (prefers-reduced-motion:no-preference){
  [data-plugin="dsh-tokbook"].dtpl-overlay{animation:dtpl-fade .16s ease-out;}
  [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-pop .16s ease-out;}
  [data-plugin="dsh-tokbook"] .dtpl-bar-fill{transform-origin:bottom;}
}
@media (prefers-reduced-motion:no-preference) and (max-width:640px){
  /* Sheet idiom: the pop animation translates a centered dialog up 8px, which
     is meaningless for a full-width sheet pinned to the bottom edge — slide it
     up out of the viewport instead (with a fade riding along). */
  [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-sheet .22s cubic-bezier(.32,.72,0,1);}
}
@keyframes dtpl-fade{from{opacity:0}}
@keyframes dtpl-pop{from{opacity:0;transform:translateY(8px) scale(.98)}}
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
  [data-plugin="dsh-tokbook"] .dtpl-sk,
  [data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot,
  [data-plugin="dsh-tokbook"] .dtpl-price-seg-actions,
  [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{animation:none;transition:none;}
}
`
