/** styles.ts fragment: tokens. Concatenated in order by `injectStyles`. */
export const CSS_TOKENS = `
[data-plugin="dsh-tokbook"]{
  --dtpl-fg:var(--dsw-alias-label-primary,#1f2328);
  --dtpl-fg-2:var(--dsw-alias-label-secondary,#59636e);
  --dtpl-fg-3:var(--dsw-alias-label-tertiary,#81858c);
  --dtpl-fg-dim:var(--dsw-alias-label-dimmed,#a0a4a8);
  --dtpl-on-accent:var(--dsw-alias-label-primary-foreground,#ffffff);
  --dtpl-accent:var(--dsw-alias-brand-primary,#4d6bfe);
  --dtpl-accent-hover:var(--dsw-alias-button-primary-hover,#3f5ce0);
  --dtpl-accent-fill:var(--dsw-alias-button-primary-fill,#4d6bfe);
  --dtpl-card:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,#ffffff));
  --dtpl-surface:var(--dsw-alias-bg-layer-1,#ffffff);
  --dtpl-border:var(--dsw-alias-border-l2,rgba(0,0,0,.12));
  --dtpl-hairline:var(--dsw-alias-border-l1,rgba(0,0,0,.08));
  /* --dsw-corner-shape is a superellipse SHAPE keyword (superellipse(1.5)),
     never a length - feeding it into border-radius makes the declaration
     invalid and the radius collapse to 0 on real DSH skins. Keep radius as a
     plain length; DSH's own 'corner-shape' universal rule adds the curvature
     on top, and full-round shapes pair 'corner-shape:round' locally. */
  --dtpl-radius:20px;
  --dtpl-radius-sm:9px;
  --dtpl-ok:var(--dsw-alias-state-success-primary,#1a7f37);
  --dtpl-warn:var(--dsw-alias-state-warn-primary,#9a6700);
  --dtpl-err:var(--dsw-alias-state-error-primary,#cf222e);
  --dtpl-mono:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);
}
`
