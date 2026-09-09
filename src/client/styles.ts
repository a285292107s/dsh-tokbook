/**
 * One injected stylesheet for dsh-tokbook's two surfaces.
 *
 * Values use DSH `--dsw-alias-*` tokens (no hard-coded colors, so the plugin
 * follows every skin); each var carries a safe light-mode fallback. Dark-mode
 * fallbacks (where translucency alone is not enough) are tuned under
 * `body[data-ds-dark-theme]`, the attribute DSH itself uses for dark skins.
 * Injected once at materialize time and removed by the returned disposer.
 *
 * The overlay mirrors the DSH native dialog language: large radius (20px),
 * hairline strokes (0.5px), bg-mask-1 + mask-blur backdrop, elevation-prominent
 * shadow, pill buttons, and a segmented pill tab control (four tabs today:
 * 用量总览 / Provider 用量 / 订阅额度 / 统计口径; the Provider tab carries its
 * own range switcher and per-provider cards, the quota tab per-plan budget
 * cards, styled in this same sheet).
 *
 * Chinese UI: labels use normal text (no `text-transform: uppercase`, which is
 * meaningless for CJK) with a small secondary type style for hierarchy.
 *
 * @module dsh-tokbook/client/styles
 */

const CSS = `
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

/* ── sidebar footer trigger ─────────────────────────────────────────────── */
/* Mirrors the settings trigger geometry (ui-settings-general SettingsRoot):
   a full-width 42px bar in the wide column, and a 36px round icon control on
   the 56px rail. */
[data-plugin="dsh-tokbook"].dtpl-footer{
  flex:1;min-width:0;
  display:flex;align-items:center;gap:8px;
  width:auto;height:42px;padding:0 10px 0 8px;box-sizing:border-box;
  border:none;border-radius:12px;background:transparent;
  cursor:pointer;overflow:hidden;
  color:var(--dsw-alias-label-primary,#1f2328);
  font-family:inherit;font-size:14px;line-height:22px;white-space:nowrap;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"].dtpl-footer:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));}
[data-plugin="dsh-tokbook"].dtpl-footer:active{background:var(--dsw-alias-interactive-bg-active,rgba(0,0,0,.1));}
[data-plugin="dsh-tokbook"].dtpl-footer.dtpl-rail{
  flex:none;width:36px;height:36px;padding:0;gap:0;
  justify-content:center;border-radius:50%;corner-shape:round;
}
[data-plugin="dsh-tokbook"].dtpl-footer[aria-pressed="true"]{color:var(--dsw-alias-brand-primary,#4d6bfe);}
[data-plugin="dsh-tokbook"] .dtpl-foot-ico{width:16px;height:16px;flex:none;}
[data-plugin="dsh-tokbook"].dtpl-footer.dtpl-rail .dtpl-foot-ico{width:18px;height:18px;}
[data-plugin="dsh-tokbook"] .dtpl-foot-label{overflow:hidden;white-space:nowrap;}
[data-plugin="dsh-tokbook"].dtpl-footer:focus-visible{outline:2px solid var(--dtpl-accent);outline-offset:2px;}

/* ── focus ring (shared) ────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] :focus-visible{
  outline:2px solid var(--dtpl-accent);outline-offset:2px;
}

/* ── overlay backdrop ───────────────────────────────────────────────────── */
/* Same recipe as the DSH native modal mask: alias mask color + mask blur. */
[data-plugin="dsh-tokbook"].dtpl-overlay{
  position:fixed;inset:0;z-index:1000;
  display:flex;align-items:center;justify-content:center;
  padding:24px;
  background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.45));
  backdrop-filter:var(--dsw-mask-blur,blur(2px));
}

/* ── modal card ─────────────────────────────────────────────────────────── */
/* Native dialog scale: 20px radius, hairline stroke + prominent elevation.
   FIXED height, not just max-height: this is a "dashboard in a dialog" (three
   tabs + pinned CTA footer + one internal scroll region), so the geometry must
   not follow the data. Without a height the card is content-height up to the
   cap and the whole centered dialog vertically re-flows between the skeleton,
   the three panels and growing data (each panel has a very different natural
   height). A fixed height pins the chrome (head/tabs/footer) and makes the
   scroll always live in .dtpl-body alone; the dvh cap keeps it inside short
   viewports. */
[data-plugin="dsh-tokbook"] .dtpl-card{
  width:min(720px,100%);height:min(680px,88dvh);height:min(680px,88vh);
  display:flex;flex-direction:column;
  background:var(--dtpl-card);color:var(--dtpl-fg);
  border-radius:var(--dtpl-radius);corner-shape:round;
  box-shadow:var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.28)),
    inset 0 0 0 .5px var(--dsw-elevation-stroke-color,var(--dtpl-hairline));
  overflow:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-card:focus{outline:none;}

/* ── head ───────────────────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-head{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:16px 20px 12px;
}
[data-plugin="dsh-tokbook"] .dtpl-title{
  display:flex;align-items:center;gap:10px;min-width:0;
  font-size:15px;line-height:22px;font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-title-ico-chip{
  display:inline-flex;align-items:center;justify-content:center;flex:none;
  width:28px;height:28px;border-radius:8px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 12%,transparent);
  color:var(--dtpl-accent);
}
[data-plugin="dsh-tokbook"] .dtpl-title-ico{width:16px;height:16px;}
[data-plugin="dsh-tokbook"] .dtpl-close{
  display:inline-flex;align-items:center;justify-content:center;flex:none;
  width:28px;height:28px;border:0;background:transparent;
  color:var(--dtpl-fg-2);border-radius:8px;corner-shape:round;
  cursor:pointer;line-height:1;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-close-ico{width:16px;height:16px;}

/* ── segmented tabs (用量总览 / 统计口径) ────────────────────────────────── */
/* Mirrors the DSH pill/segmented pattern: track fill, active segment gets a
   layer surface + inset ghost border. */
[data-plugin="dsh-tokbook"] .dtpl-tabs{
  display:flex;gap:2px;flex:none;
  margin:0 20px 4px;padding:3px;
  border-radius:10px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tab{
  appearance:none;flex:1;border:0;background:transparent;
  height:26px;padding:0 12px;
  font:inherit;font-size:12px;line-height:18px;font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;
  border-radius:7px;corner-shape:round;cursor:pointer;
  transition:background .15s ease,color .15s ease,box-shadow .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-tab:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-tab[aria-selected="true"]{
  color:var(--dtpl-fg);
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border,rgba(0,0,0,.14));
}
/* Unsaved pricing edits: the drafts survive tab switches, so the tab carries a
   dot until they are saved or discarded. */
[data-plugin="dsh-tokbook"] .dtpl-tab-dot{
  display:inline-block;width:5px;height:5px;margin-left:5px;
  border-radius:999px;corner-shape:round;
  background:var(--dtpl-accent);
  vertical-align:middle;
}

/* ── scroll body ────────────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-body{
  flex:1;min-height:0;
  padding:14px 20px 16px;overflow:auto;overscroll-behavior:contain;
  scrollbar-width:thin;
  scrollbar-color:var(--dsw-alias-scrollbar-bg-l2,rgba(0,0,0,.2)) transparent;
  scroll-padding:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-body::-webkit-scrollbar{width:8px;}
[data-plugin="dsh-tokbook"] .dtpl-body::-webkit-scrollbar-thumb{
  border:2px solid transparent;border-radius:6px;background-clip:padding-box;
  background-color:var(--dsw-alias-scrollbar-bg-l2,rgba(0,0,0,.2));
}
[data-plugin="dsh-tokbook"] .dtpl-body::-webkit-scrollbar-thumb:hover{
  background-color:var(--dsw-alias-scrollbar-hover-l2,rgba(0,0,0,.3));
}

/* ── hero (total tokens + cost + meta) ──────────────────────────────────── */
/* One data-first hero: brand-washed panel, tabular figures throughout. */
[data-plugin="dsh-tokbook"] .dtpl-hero{
  display:flex;align-items:flex-end;justify-content:space-between;gap:16px;
  padding:14px 16px;margin-bottom:12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:linear-gradient(135deg,
    color-mix(in srgb,var(--dtpl-accent) 9%,transparent),
    color-mix(in srgb,var(--dtpl-accent) 3%,transparent));
}
[data-plugin="dsh-tokbook"] .dtpl-hero-main{display:flex;flex-direction:column;gap:3px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-total-k{color:var(--dtpl-fg-2);font-size:12px;line-height:18px;}
[data-plugin="dsh-tokbook"] .dtpl-total-num{
  font-size:28px;line-height:32px;font-weight:700;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;letter-spacing:-.02em;
}
/* The hero's context line: today vs the 近7天 baseline. Neutral by design —
   "more than usual" is not inherently bad, so it never borrows the warn color
   (that stays reserved for failures). Direction is carried by the ↑/↓ glyph
   and by weight, not by hue. */
[data-plugin="dsh-tokbook"] .dtpl-hero-base{
  font-size:12px;line-height:18px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-base b{font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-hero-money{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-hero-cost{
  display:inline-flex;align-items:baseline;gap:4px;
  font-size:14px;line-height:20px;font-weight:600;color:var(--dtpl-accent);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-cost-k{font-style:normal;font-weight:500;font-size:11px;color:var(--dtpl-fg-3);}
/* A zero spend is an answer, not a headline: it holds the row without pulling
   the eye off the non-zero figure beside it (and never reads as cash). */
[data-plugin="dsh-tokbook"] .dtpl-hero-cost.dtpl-hero-cost-zero{color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-hero-value{
  display:inline-flex;align-items:baseline;gap:4px;
  font-size:12px;line-height:18px;color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-value b{color:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;}
/* 订阅价值 amount used inside model/provider/recent rows: value styled
   distinctly from spend so a subscription-channel amount never reads as cash. */
[data-plugin="dsh-tokbook"] .dtpl-sub-amt{color:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;}
[data-plugin="dsh-tokbook"] .dtpl-sub-k{font-style:normal;font-size:10px;line-height:14px;color:var(--dtpl-fg-3);margin-left:3px;}
[data-plugin="dsh-tokbook"] .dtpl-hero-meta{display:flex;flex-direction:column;gap:4px;align-items:flex-end;}
[data-plugin="dsh-tokbook"] .dtpl-meta{
  display:inline-flex;align-items:baseline;gap:4px;
  font-size:12px;line-height:18px;color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-meta-n{font-variant-numeric:tabular-nums;color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-meta-warn .dtpl-meta-n{color:var(--dtpl-warn);}

/* ── stat tiles (4 buckets) ─────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;}
/* Three buckets (cache-write is not a dimension of this ledger) fill one row
   instead of leaving a ragged half-row. Still 3 columns on narrow sheets —
   each tile keeps ~110px, enough for its label and figure. */
[data-plugin="dsh-tokbook"] .dtpl-grid-3{grid-template-columns:repeat(3,1fr);}
[data-plugin="dsh-tokbook"] .dtpl-stat{
  display:flex;flex-direction:column-reverse;gap:2px;
  padding:10px 12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-stat .dtpl-v{font-size:15px;line-height:20px;font-weight:650;font-variant-numeric:tabular-nums;}
[data-plugin="dsh-tokbook"] .dtpl-k{color:var(--dtpl-fg-3);font-size:12px;line-height:18px;}

/* ── daily trend ────────────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-sec-title{
  font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
  margin:0 0 8px;
}
/* Section title with a right-aligned derived metric (e.g. the cache hit rate). */
[data-plugin="dsh-tokbook"] .dtpl-sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-sec-head .dtpl-sec-title{margin:0 0 8px;}
[data-plugin="dsh-tokbook"] .dtpl-sec-aside{
  font-size:11px;line-height:18px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-trend{margin-bottom:14px;}
[data-plugin="dsh-tokbook"] .dtpl-bars{
  position:relative;
  display:flex;align-items:flex-end;gap:3px;height:76px;
  padding:20px 8px 8px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-bar{position:relative;flex:1 1 0;min-width:0;height:100%;display:flex;align-items:flex-end;}
[data-plugin="dsh-tokbook"] .dtpl-bar-fill{
  width:100%;border-radius:2px 2px 0 0;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 62%,transparent);
  transition:opacity .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-bar-fill.is-peak{background:var(--dtpl-accent);}
[data-plugin="dsh-tokbook"] .dtpl-bar:hover .dtpl-bar-fill{background:var(--dtpl-accent);}
/* Every column carries its own value: the chart reads without hovering. */
[data-plugin="dsh-tokbook"] .dtpl-bar-label{
  position:absolute;bottom:calc(100% + 2px);left:50%;transform:translateX(-50%);
  font-size:11px;line-height:14px;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
  white-space:nowrap;pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-peak{color:var(--dtpl-fg);font-weight:650;}
/* A zero day has no column, so its label sits on the baseline instead of
   floating at the top of the plot. */
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-zero{bottom:2px;color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-start{left:0;transform:none;}
[data-plugin="dsh-tokbook"] .dtpl-bar-label.is-end{left:auto;right:0;transform:none;}
[data-plugin="dsh-tokbook"] .dtpl-trend-axis{
  display:flex;gap:3px;margin-top:4px;padding:0 8px;
  font-size:10px;line-height:16px;color:var(--dtpl-fg-3);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-trend-axis span{flex:1 1 0;min-width:0;text-align:center;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-trend-sum{
  margin:4px 0 0;font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
}

/* ── models ─────────────────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-models-sec{margin-bottom:14px;}
[data-plugin="dsh-tokbook"] .dtpl-models{display:flex;flex-direction:column;gap:10px;}
[data-plugin="dsh-tokbook"] .dtpl-row{display:flex;align-items:center;justify-content:space-between;gap:16px;}
[data-plugin="dsh-tokbook"] .dtpl-model{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;}
[data-plugin="dsh-tokbook"] .dtpl-model-name{
  color:var(--dtpl-fg);font-size:13px;line-height:20px;font-weight:500;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-model-provider{color:var(--dtpl-fg-3);font-size:11px;line-height:16px;}
[data-plugin="dsh-tokbook"] .dtpl-model-bar{
  display:block;width:100%;height:4px;border-radius:999px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);overflow:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-model-bar-fill{
  display:block;height:100%;border-radius:inherit;
  background:linear-gradient(90deg,var(--dtpl-accent),color-mix(in srgb,var(--dtpl-accent) 55%,transparent));
  transition:width .4s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-model-nums{display:flex;flex-direction:column;align-items:flex-end;gap:1px;flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-val{color:var(--dtpl-fg);font-size:13px;line-height:20px;font-variant-numeric:tabular-nums;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-cost{color:var(--dtpl-fg-2);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;white-space:nowrap;}

/* ── recent records ─────────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-recent-sec{margin-bottom:14px;}
[data-plugin="dsh-tokbook"] .dtpl-recent-head{
  display:flex;align-items:baseline;justify-content:space-between;gap:12px;
  margin:0 0 6px;
}
[data-plugin="dsh-tokbook"] .dtpl-recent-head .dtpl-sec-title{margin:0;}
[data-plugin="dsh-tokbook"] .dtpl-recent-head-sum{
  flex:none;font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-recent{
  list-style:none;margin:0;padding:0;
  display:flex;flex-direction:column;
  border-top:.5px solid var(--dtpl-hairline);
}
/* One row: time | body (model+badges / meta) | tokens | cost. Two visible
   lines per record carry the "what/where" story; the hover holds the audit. */
[data-plugin="dsh-tokbook"] .dtpl-recent-row{
  display:grid;
  grid-template-columns:minmax(52px,auto) minmax(0,1fr) auto auto;
  align-items:center;column-gap:10px;
  min-height:44px;padding:5px 6px;
  border-bottom:.5px solid var(--dtpl-hairline);
  cursor:default;
}
[data-plugin="dsh-tokbook"] .dtpl-recent-row:last-child{border-bottom:none;}
[data-plugin="dsh-tokbook"] .dtpl-recent-time{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-recent-body{
  display:flex;flex-direction:column;gap:2px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-recent-main{
  display:flex;align-items:center;gap:6px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-recent-model{
  color:var(--dtpl-fg);font-size:12px;line-height:18px;font-weight:500;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-recent-meta{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-recent-badge{
  flex:none;font-size:10px;line-height:14px;font-weight:500;
  padding:0 5px;border-radius:5px;corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-badge-compact{
  color:var(--dtpl-accent);
  background:color-mix(in srgb,var(--dtpl-accent) 12%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-badge-fail{
  color:var(--dtpl-err);
  background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-recent-tokens{
  color:var(--dtpl-fg);font-size:12px;line-height:18px;
  font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;
}
[data-plugin="dsh-tokbook"] .dtpl-recent-cost{
  color:var(--dtpl-accent);font-size:12px;line-height:18px;font-weight:600;
  font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;
  min-width:52px;
}
[data-plugin="dsh-tokbook"] .dtpl-recent-fail .dtpl-recent-model{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-recent-fail .dtpl-recent-meta{color:color-mix(in srgb,var(--dtpl-err) 70%,var(--dtpl-fg-3));}
[data-plugin="dsh-tokbook"] .dtpl-recent-fail .dtpl-recent-tokens,
[data-plugin="dsh-tokbook"] .dtpl-recent-fail .dtpl-recent-cost{color:var(--dtpl-fg-3);font-weight:400;}

/* ── notes ──────────────────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-note{font-size:12px;line-height:18px;color:var(--dtpl-fg-2);margin:0 0 10px;}

/* ── window footer (sync state · latest + rescan) ───────────────────────── */
/* The pinned footer holds both freshness answers — the re-sync state and the
   newest-record time — as one always-visible group; the scroll body below is
   pure usage content. */
[data-plugin="dsh-tokbook"] .dtpl-foot{
  flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 20px 14px;
  border-top:.5px solid var(--dtpl-border);
  background:color-mix(in srgb,var(--dtpl-fg) 2%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-foot-state{
  display:inline-flex;align-items:baseline;gap:8px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-sync{
  display:inline-flex;align-items:center;gap:6px;min-width:0;
  font-size:12px;line-height:18px;color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-sync-dot{
  flex:none;width:6px;height:6px;border-radius:50%;corner-shape:round;
  background:currentColor;
}
[data-plugin="dsh-tokbook"] .dtpl-sync-done{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-sync-error{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-sync-running{color:var(--dtpl-accent);}
[data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot{animation:dtpl-pulse 1.2s ease-in-out infinite;}
[data-plugin="dsh-tokbook"] .dtpl-foot-sep{color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-foot-latest{
  font-size:12px;line-height:18px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-rescan{
  display:inline-flex;align-items:center;gap:6px;flex:none;
  height:32px;padding:0 14px;border:none;border-radius:999px;corner-shape:round;
  background:var(--dtpl-accent-fill);color:var(--dtpl-on-accent);
  font:inherit;font-size:12px;line-height:18px;font-weight:500;cursor:pointer;
  transition:background .15s ease,opacity .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-rescan:hover:not(:disabled){background:var(--dtpl-accent-hover);}
[data-plugin="dsh-tokbook"] .dtpl-rescan:active:not(:disabled){transform:translateY(.5px);}
[data-plugin="dsh-tokbook"] .dtpl-rescan:disabled{opacity:.4;cursor:not-allowed;}
[data-plugin="dsh-tokbook"] .dtpl-rescan-ico{width:14px;height:14px;flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-spin{animation:dtpl-rotate 1s linear infinite;}

/* ── error / retry ──────────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-error{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-bottom:12px;padding:10px 12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-err) 8%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-error-text{
  margin:0;font-size:12px;line-height:18px;color:var(--dtpl-err);min-width:0;overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-retry{
  flex:none;height:26px;padding:0 12px;
  border:none;border-radius:999px;corner-shape:round;
  background:transparent;color:var(--dtpl-err);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-err) 45%,transparent);
  font:inherit;font-size:12px;line-height:18px;cursor:pointer;
  transition:background .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-retry:hover{background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);}

/* ── skeleton (loading) ─────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-skeleton{display:flex;flex-direction:column;gap:12px;}
[data-plugin="dsh-tokbook"] .dtpl-sk{
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:linear-gradient(100deg,
    color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 40%,
    color-mix(in srgb,var(--dtpl-fg) 10%,transparent) 50%,
    color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 60%);
  background-size:200% 100%;
  animation:dtpl-shimmer 1.4s ease infinite;
}
[data-plugin="dsh-tokbook"] .dtpl-sk-hero{height:76px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-tile{height:56px;border-radius:var(--dtpl-radius-sm);}
[data-plugin="dsh-tokbook"] .dtpl-sk-chart{height:88px;}
[data-plugin="dsh-tokbook"] .dtpl-sk-row{height:36px;}

/* ── empty state ────────────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-empty{
  display:flex;flex-direction:column;align-items:center;text-align:center;
  padding:28px 20px;margin:8px 0 12px;
  border:1px dashed var(--dtpl-border);border-radius:var(--dtpl-radius-sm);corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-empty-ico{width:28px;height:28px;margin-bottom:10px;color:var(--dtpl-accent);opacity:.55;}
[data-plugin="dsh-tokbook"] .dtpl-empty-title{font-size:14px;line-height:22px;font-weight:600;color:var(--dtpl-fg);margin:0 0 4px;}
[data-plugin="dsh-tokbook"] .dtpl-empty-sub{font-size:12px;line-height:20px;color:var(--dtpl-fg-2);margin:0;max-width:44ch;}
[data-plugin="dsh-tokbook"] .dtpl-empty-sub code{
  font-family:var(--dtpl-mono);font-size:.9em;
  padding:.1em .35em;border-radius:5px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg);
}

/* ── method doc (统计口径 tab) ──────────────────────────────────────────── */
/* Reading hierarchy: lede → 3-fact strip → numbered sections. Facts and
   structural groups are washed panels so the eye lands on the summary
   (来源/精度/完整度, ≈95%) before any caveat. */
[data-plugin="dsh-tokbook"] .dtpl-doc{max-width:none;}
[data-plugin="dsh-tokbook"] .dtpl-doc code{
  font-family:var(--dtpl-mono);font-size:.9em;
  padding:.1em .35em;border-radius:5px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg);
  white-space:nowrap;
}

/* Lede: two or three short stacked lines setting the mode before detail. */
[data-plugin="dsh-tokbook"] .dtpl-doc-lede{
  display:flex;flex-direction:column;gap:3px;
  margin:0 0 12px;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-lede p{margin:0;}
[data-plugin="dsh-tokbook"] .dtpl-doc-lede b{color:var(--dtpl-accent);font-weight:600;}

/* 3-fact strip: 来源 / 精度 / 完整度, the last one emphasized. */
[data-plugin="dsh-tokbook"] .dtpl-doc-facts{
  display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
  margin-bottom:16px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact{
  display:flex;flex-direction:column;gap:3px;
  padding:10px 12px;min-width:0;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-k{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-3);font-weight:500;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-v{
  font-size:12px;line-height:18px;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-key{
  background:linear-gradient(135deg,
    color-mix(in srgb,var(--dtpl-accent) 12%,transparent),
    color-mix(in srgb,var(--dtpl-accent) 5%,transparent));
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--dtpl-accent) 30%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-key .dtpl-doc-fact-k{color:var(--dtpl-accent);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-big{
  font-size:17px;line-height:20px;font-weight:700;color:var(--dtpl-accent);
  font-variant-numeric:tabular-nums;letter-spacing:-.01em;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-tail{color:var(--dtpl-fg-2);font-size:11px;}

/* Numbered section titles: 1/2/3/4 in accent chips. */
[data-plugin="dsh-tokbook"] .dtpl-doc-sec{margin-bottom:16px;}
[data-plugin="dsh-tokbook"] .dtpl-doc-title{
  display:flex;align-items:center;gap:8px;
  font-size:13px;line-height:20px;font-weight:600;color:var(--dtpl-fg);
  margin:0 0 10px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-idx{
  flex:none;display:inline-flex;align-items:center;justify-content:center;
  width:18px;height:18px;border-radius:6px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 14%,transparent);
  color:var(--dtpl-accent);
  font-size:11px;line-height:1;font-weight:700;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-sub{
  margin:0 0 8px;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-sub b{color:var(--dtpl-fg);font-weight:600;}

/* 4-bucket tiles: 2×2 grid of plain-language definitions. */
[data-plugin="dsh-tokbook"] .dtpl-doc-buckets{
  display:grid;grid-template-columns:repeat(2,1fr);gap:8px;
  margin-bottom:10px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket{
  display:flex;flex-direction:column;gap:3px;
  padding:10px 12px;min-width:0;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket-name{
  font-size:12px;line-height:18px;font-weight:650;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket-desc{
  font-size:11.5px;line-height:17px;color:var(--dtpl-fg-2);
}

/* Sum equation: 累计词元 = 输入 + … as one wrapped pill row. */
[data-plugin="dsh-tokbook"] .dtpl-doc-eq{
  display:flex;align-items:center;flex-wrap:wrap;gap:4px 6px;
  margin:0 0 10px;padding:7px 12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 7%,transparent);
  font-size:12px;line-height:18px;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-eq-lead{font-weight:650;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-doc-eq-term{font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-doc-eq-op{color:var(--dtpl-fg-3);font-weight:600;}

/* 记了哪些调用: chip-led rows. */
[data-plugin="dsh-tokbook"] .dtpl-doc-scope{
  list-style:none;margin:0;padding:0;
  display:flex;flex-direction:column;
  border-top:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-scope li{
  display:flex;align-items:baseline;gap:8px;
  padding:6px 2px;
  font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
  border-bottom:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-scope li:last-child{border-bottom:none;}
[data-plugin="dsh-tokbook"] .dtpl-doc-chip{
  flex:none;display:inline-flex;align-items:center;
  height:18px;padding:0 7px;margin-top:1px;
  border-radius:999px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 13%,transparent);
  color:var(--dtpl-accent);
  font-size:10px;line-height:1;font-weight:600;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-chip-off{
  background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);
  color:var(--dtpl-fg-2);
  font-weight:500;
}

/* 差额从哪来: two side-by-side reasons. */
[data-plugin="dsh-tokbook"] .dtpl-doc-gap{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-card{
  padding:11px 13px;min-width:0;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-title{
  display:flex;align-items:center;gap:6px;
  margin:0 0 6px;font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-title::before{
  content:"";flex:none;width:3px;height:12px;border-radius:2px;corner-shape:round;
  background:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title{color:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title::before{background:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list{
  list-style:none;margin:0;padding:0;
  display:flex;flex-direction:column;gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li{
  position:relative;padding-left:12px;
  display:flex;flex-direction:column;gap:1px;
  font-size:12px;line-height:19px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li::before{
  content:"";position:absolute;left:1px;top:7px;
  width:4px;height:4px;border-radius:50%;corner-shape:round;
  background:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-name{
  display:block;color:var(--dtpl-fg);font-weight:600;font-size:12px;line-height:18px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-desc{
  display:block;color:var(--dtpl-fg-2);font-size:11.5px;line-height:18px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum{
  margin:8px 0 0;padding-top:7px;
  border-top:.5px dashed var(--dtpl-hairline);
  font-size:11.5px;line-height:18px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum b{color:var(--dtpl-accent);font-weight:700;}

/* 怎么核对: the field map in one compact panel. */
[data-plugin="dsh-tokbook"] .dtpl-doc-map{
  display:flex;flex-direction:column;gap:5px;
  margin:2px 0 8px;padding:10px 12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-row{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  font-size:12px;line-height:20px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-row b{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-arrow{color:var(--dtpl-fg-3);flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-note{
  margin:2px 0 0;font-size:11.5px;line-height:17px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-note:first-of-type{margin-top:2px;}

/* Cross-tab callout: 订阅额度 is a different, official caliber. */
[data-plugin="dsh-tokbook"] .dtpl-doc-quota{
  display:flex;flex-direction:column;gap:3px;
  margin:0 0 14px;padding:10px 13px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 6%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--dtpl-accent) 22%,transparent);
  font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-quota p{margin:0;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-doc-quota b{color:var(--dtpl-accent);font-weight:600;}

/* Live data-file diagnostics: one compact box. */
[data-plugin="dsh-tokbook"] .dtpl-doc-data{
  display:flex;flex-direction:column;gap:3px;
  margin:2px 0 6px;padding:10px 13px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-line{
  margin:0;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-line b{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-dir{
  margin:0;font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-dir code{
  background:transparent;padding:0;font-size:.92em;
}

[data-plugin="dsh-tokbook"] .dtpl-doc-foot{
  margin-top:12px;padding-top:10px;
  border-top:.5px dashed var(--dtpl-border);
  font-size:11px!important;line-height:16px!important;color:var(--dtpl-fg-3)!important;
}

/* ── provider-usage tab ─────────────────────────────────────────────────── */
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
[data-plugin="dsh-tokbook"] .dtpl-provider-name{
  color:var(--dtpl-fg);font-size:14px;line-height:20px;font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
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

/* ── quota tab (订阅额度) ────────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-quota-sec{display:flex;flex-direction:column;gap:10px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-intro{
  margin:0;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
/* Segmented auto-refresh control: label + pill options + live state. */
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:6px 10px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-label{
  color:var(--dtpl-fg-2);font-size:12px;line-height:18px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-seg{
  display:inline-flex;gap:2px;padding:2px;
  border-radius:8px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt{
  appearance:none;border:0;background:transparent;
  height:22px;padding:0 9px;
  font:inherit;font-size:11px;line-height:16px;font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;
  border-radius:6px;corner-shape:round;cursor:pointer;
  transition:background .15s ease,color .15s ease,box-shadow .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt.dtpl-quota-autorefresh-on{
  color:var(--dtpl-fg);
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border,rgba(0,0,0,.14));
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-state{
  margin-left:auto;color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-state.dtpl-quota-autorefresh-live{color:var(--dtpl-ok);}

[data-plugin="dsh-tokbook"] .dtpl-quota-cards{display:flex;flex-direction:column;gap:12px;}
/* One provider card: a soft washed panel; body sections separated by hairlines. */
[data-plugin="dsh-tokbook"] .dtpl-quota-card{
  padding:14px 16px 12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
/* Card header: identity (ring gauge + name/sub) | state chip + refresh. */
[data-plugin="dsh-tokbook"] .dtpl-quota-head{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-bottom:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-id{
  display:flex;align-items:center;gap:10px;min-width:0;
}
/* Reserved slot for the leading monthly ring gauge; keeps the title from
   shifting when a card is loading / errored / unconfigured (no ring). */
[data-plugin="dsh-tokbook"] .dtpl-quota-state-gap{
  flex:none;width:44px;height:44px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-id-text{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-quota-name{
  color:var(--dtpl-fg);font-size:14px;line-height:20px;font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-sub{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-head-side{
  display:flex;align-items:center;gap:8px;flex:none;
  min-width:0;
}
/* Per-card refresh: compact icon button, disabled while a fetch is in flight. */
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh{
  display:inline-flex;align-items:center;justify-content:center;
  width:28px;height:28px;padding:0;
  border:none;border-radius:8px;corner-shape:round;
  background:transparent;color:var(--dtpl-fg-3);
  cursor:pointer;transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh:hover:not(:disabled){background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh:disabled{opacity:.45;cursor:default;}
/* The wrapper owns the one-shot click "pop": remounting it (via React key)
   restarts the animation on every press. Separate from the glyph so the
   loading spinner (rotation) below never cancels it. */
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim{
  display:inline-flex;align-items:center;justify-content:center;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{
  animation:dtpl-refresh-pop .35s cubic-bezier(.34,1.56,.64,1);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh-ico{width:15px;height:15px;display:block;}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh-ico.dtpl-spin{animation:dtpl-rotate 1s linear infinite;}
/* State chips (unconfigured / fetch error). */
[data-plugin="dsh-tokbook"] .dtpl-quota-chip{
  flex:none;display:inline-flex;align-items:center;gap:6px;
  height:22px;padding:0 10px;
  border-radius:999px;corner-shape:round;
  font-size:11px;line-height:16px;font-weight:500;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-chip::before{
  content:"";width:6px;height:6px;border-radius:50%;corner-shape:round;
  background:currentColor;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-chip-muted{
  color:var(--dtpl-fg-2);
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-chip-err{
  color:var(--dtpl-err);
  background:color-mix(in srgb,var(--dtpl-err) 10%,transparent);
}
/* Monthly-budget ring gauge. Sits in the header identity slot on the card's
   leading edge (where the plan monogram used to be): the ring stroke carries
   the tone and the used-% number is centered *inside* the ring, with the
   budget it refers to (本月 by default — see ringPressure) as a small
   caption beneath the number, so the ring never silently means a different
   window. */
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge{
  position:relative;flex:none;width:44px;height:44px;
  color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-svg{width:44px;height:44px;display:block;}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-track{
  fill:none;stroke:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
  stroke-width:4;stroke-linecap:round;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-fill{
  fill:none;stroke:currentColor;stroke-width:4;stroke-linecap:round;
  transform:rotate(-90deg);transform-origin:50% 50%;
  transition:stroke-dasharray .4s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-n{
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:2px;
  color:inherit;font-size:11px;line-height:1;font-weight:700;
  font-variant-numeric:tabular-nums;white-space:nowrap;
  pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-n i{
  font-style:normal;font-size:8px;line-height:1;font-weight:600;
  color:var(--dtpl-fg-3);margin-left:.5px;
}
/* Small caption naming the budget the ring summarizes (本月 / a fallback
   window label). Muted so the tone-colored number stays the focal point. */
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-cap{
  font-size:8px;line-height:1;font-weight:600;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge.dtpl-quota-tone-ok{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge.dtpl-quota-tone-warn{color:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge.dtpl-quota-tone-danger{color:var(--dtpl-err);}
/* In-card message panel (load failure / unconfigured / fetch error). */
[data-plugin="dsh-tokbook"] .dtpl-quota-msg{
  display:flex;flex-direction:column;align-items:flex-start;gap:2px;
  padding:10px 12px;margin:2px 0 6px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-muted{background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-err{
  background:color-mix(in srgb,var(--dtpl-err) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-title{margin:0;font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-err .dtpl-quota-msg-title{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-body{
  margin:0;font-size:12px;line-height:18px;color:var(--dtpl-fg-2);
  overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg .dtpl-retry{margin-top:6px;}
/* Stale-while-revalidate note above an ok body. */
[data-plugin="dsh-tokbook"] .dtpl-quota-stale{
  margin:0 0 8px;padding:6px 10px;
  border-radius:7px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-warn) 10%,transparent);
  color:var(--dtpl-warn);
  font-size:11px;line-height:16px;
}
/* Meter rows: one per budget window, on one skeleton for every data shape. */
[data-plugin="dsh-tokbook"] .dtpl-quota-windows{display:flex;flex-direction:column;gap:12px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-window{display:flex;flex-direction:column;gap:5px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-line1{
  display:flex;align-items:baseline;justify-content:space-between;gap:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-label{
  color:var(--dtpl-fg);font-size:12px;line-height:18px;font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-metric{
  color:var(--dtpl-fg-2);font-size:11px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar{
  display:block;width:100%;height:7px;border-radius:999px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 9%,transparent);overflow:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill{
  display:block;height:100%;border-radius:inherit;
  transition:width .4s ease,background-color .2s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-tone-ok{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-quota-tone-warn{color:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-quota-tone-danger{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-ok{background:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-warn{background:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-danger{background:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-line2{
  display:flex;align-items:baseline;justify-content:space-between;gap:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-remaining{
  color:var(--dtpl-fg);font-size:12px;line-height:18px;font-weight:650;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-window[data-tone="warn"] .dtpl-quota-remaining{color:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-quota-window[data-tone="danger"] .dtpl-quota-remaining{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-reset{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-reset-limited{color:var(--dtpl-err);font-weight:600;}
/* Usage-summary activity strip (Command Code): mini K/V cells, at the bottom
   of an ok body as the "how was this period" context under the meter rows. */
[data-plugin="dsh-tokbook"] .dtpl-quota-stats{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;
  margin-top:12px;padding-top:12px;
  border-top:.5px dashed var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat{
  display:flex;flex-direction:column;gap:1px;
  padding:7px 10px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat-v{
  display:flex;align-items:baseline;gap:6px;
  color:var(--dtpl-fg);font-size:13px;line-height:18px;font-weight:650;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat-warn{
  font-style:normal;font-size:10px;line-height:14px;font-weight:600;color:var(--dtpl-err);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat-k{color:var(--dtpl-fg-3);font-size:11px;line-height:16px;}
/* Freshness label in the card header, before the refresh button: when the
   official numbers were fetched (honesty for cached renders). Raised from the
   footnote size/dim tone it used to have — it now sits on the card's washed
   panel next to an interactive control, so it must be plainly legible. */
[data-plugin="dsh-tokbook"] .dtpl-quota-updated{
  color:var(--dtpl-fg-2);font-size:11px;line-height:16px;font-weight:500;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* Loading placeholder shaped like a card body. */
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-body{display:flex;flex-direction:column;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-card{height:150px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-line{height:14px;width:55%;border-radius:5px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-line-short{width:35%;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-bar{height:7px;border-radius:999px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-note{
  margin:10px 0 0;font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
}

/* ── pricing tab (价格表) ───────────────────────────────────────────────── */
/* Two editing surfaces behind one segmented switch. Everything below reuses
   the modal's tokens; the intent is data-dense but navigable: cloud reference
   rows live in a bounded fold, provider rows are compact until edited. */

/* Segmented mode switch (模型价 / Provider 覆盖层). */
[data-plugin="dsh-tokbook"] .dtpl-pricing-sec{display:flex;flex-direction:column;gap:10px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-modes{
  display:inline-flex;gap:2px;align-self:flex-start;flex:none;
  padding:2px;border-radius:9px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-mode{
  appearance:none;border:0;background:transparent;
  height:24px;padding:0 12px;
  font:inherit;font-size:12px;line-height:18px;font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;
  border-radius:7px;corner-shape:round;cursor:pointer;
  transition:background .15s ease,color .15s ease,box-shadow .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-mode:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-mode[aria-pressed="true"]{
  color:var(--dtpl-fg);
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border,rgba(0,0,0,.14));
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-pane{display:flex;flex-direction:column;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-pane[hidden]{display:none;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-intro{
  margin:0;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-intro b{color:var(--dtpl-fg);font-weight:600;}

/* Surface containers. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-model-view,
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider{
  display:flex;flex-direction:column;gap:10px;min-width:0;
}

/* Toolbar: scope chips (with live counts) + search. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-bar{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-scopes{
  display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;
  padding:2px;border-radius:9px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-scope{
  appearance:none;border:0;background:transparent;
  display:inline-flex;align-items:center;gap:6px;
  height:24px;padding:0 9px;
  font:inherit;font-size:12px;line-height:18px;font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
  border-radius:7px;corner-shape:round;
  transition:background .15s ease,color .15s ease,box-shadow .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-scope:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-scope[aria-pressed="true"]{
  color:var(--dtpl-fg);
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border,rgba(0,0,0,.14));
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-scope-count{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:16px;height:16px;padding:0 5px;
  border-radius:999px;corner-shape:round;
  font-size:10px;line-height:1;font-weight:600;color:var(--dtpl-fg-2);
  background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-scope[aria-pressed="true"] .dtpl-pricing-scope-count{
  color:var(--dtpl-on-accent);
  background:var(--dtpl-accent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-scope-reset{
  appearance:none;border:0;background:transparent;
  height:24px;padding:0 8px;
  font:inherit;font-size:11px;line-height:16px;cursor:pointer;
  color:var(--dtpl-accent);border-radius:7px;corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-scope-reset:hover{background:color-mix(in srgb,var(--dtpl-accent) 10%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-filter{flex:1;min-width:160px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-search{
  width:100%;box-sizing:border-box;
  height:30px;padding:0 10px;
  border:1px solid var(--dtpl-hairline);border-radius:8px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
  color:var(--dtpl-fg);font:inherit;font-size:12px;line-height:18px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-search::placeholder{color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-search:focus{outline:none;border-color:var(--dtpl-accent);}

/* Section headers of the model groups: label + count + context hint. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-sec-head{
  display:flex;align-items:baseline;gap:8px;
  margin:10px 6px 2px;padding-top:6px;
  border-top:.5px dashed var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-sec-head:first-child{
  margin-top:4px;padding-top:0;border-top:none;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-sec-title{
  font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-sec-count{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:16px;height:16px;padding:0 5px;
  border-radius:999px;corner-shape:round;
  font-size:10px;line-height:1;font-weight:600;
  color:var(--dtpl-fg-2);
  background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-sec-head-accent .dtpl-pricing-sec-title{color:var(--dtpl-accent);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-sec-head-accent .dtpl-pricing-sec-count{
  color:var(--dtpl-on-accent);
  background:var(--dtpl-accent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-sec-head-warn .dtpl-pricing-sec-title{color:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-sec-head-warn .dtpl-pricing-sec-count{
  color:#fff;
  background:var(--dtpl-warn);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-sec-hint{
  margin-left:auto;color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  text-align:right;
}

/* Column header + rows share one grid: model (grows) | 4 rates (fixed) |
   actions (fixed). Both right-hand tracks are FIXED lengths, never "auto":
   each row is its own grid, so a content-sized track would let one row's longer
   button decide that row's geometry — its numbers would shift sideways and its
   model name would be squeezed. --dtpl-actions-w is the column's copy budget:
   the longest label any row uses must fit it, and anything longer truncates
   instead of pushing (see .dtpl-pricing-btn). Header and rows must also share
   the same horizontal padding, or the sticky header names the wrong columns. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-col-header,
[data-plugin="dsh-tokbook"] .dtpl-pricing-row{
  --dtpl-rate-w:56px;
  --dtpl-rate-gap:6px;
  --dtpl-rates-w:calc(4 * var(--dtpl-rate-w) + 3 * var(--dtpl-rate-gap));
  --dtpl-actions-w:68px;
  display:grid;
  grid-template-columns:minmax(0,1fr) var(--dtpl-rates-w) var(--dtpl-actions-w);
  align-items:center;column-gap:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-col-header{
  padding:0 10px 2px;
  font-size:10px;line-height:14px;color:var(--dtpl-fg-3);letter-spacing:.02em;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  gap:var(--dtpl-rate-gap);min-width:0;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;white-space:nowrap;
  text-align:right;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-col-header .dtpl-pricing-rates{text-align:right;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-col-actions{
  text-align:right;
}

/* The list itself: rows separated by hairlines. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-list{
  display:flex;flex-direction:column;
  border-top:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-item{border-bottom:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-item:last-child{border-bottom:none;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-row{
  min-height:40px;padding:6px 10px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-row-manual{
  background:color-mix(in srgb,var(--dtpl-accent) 5%,transparent);
  box-shadow:inset 2px 0 0 var(--dtpl-accent);
  border-radius:4px 0 0 4px;corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-row-layered{opacity:.88;}

/* Model identity: expand caret + name + source tag, with the "price in force"
   line underneath when a window/peak decides it. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-model{
  display:flex;flex-direction:column;gap:2px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-model-head{
  display:flex;align-items:center;gap:7px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-expand{
  appearance:none;flex:none;width:18px;height:18px;padding:0;
  border:0;border-radius:5px;corner-shape:round;background:transparent;
  color:var(--dtpl-fg-3);font:inherit;font-size:10px;line-height:18px;cursor:pointer;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-expand:hover{
  color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-used{
  flex:none;font-size:10px;line-height:16px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-now{
  font-size:10px;line-height:15px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-now b{color:var(--dtpl-fg-2);font-weight:600;}
/* One-shot highlight after a row is promoted (去定价 / 自定义 / 新增) or reached
   by a deep link, so the eye can follow where it went. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-item-flash{
  animation:dtpl-pricing-flash 1.4s ease-out;
}
@keyframes dtpl-pricing-flash{
  0%{background:color-mix(in srgb,var(--dtpl-accent) 20%,transparent);}
  100%{background:transparent;}
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-model-name{
  flex:1 1 auto;min-width:0;
  font-size:12px;line-height:18px;font-weight:500;color:var(--dtpl-fg);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-model-tag{
  flex:none;height:16px;padding:0 6px;
  display:inline-flex;align-items:center;
  border-radius:999px;corner-shape:round;
  font-size:9px;line-height:1;font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-3);
  background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-row-manual .dtpl-pricing-model-tag{
  color:var(--dtpl-accent);
  background:color-mix(in srgb,var(--dtpl-accent) 14%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-model-tag-new{
  color:var(--dtpl-accent);
  background:color-mix(in srgb,var(--dtpl-accent) 14%,transparent);
}
/* A row carrying staged changes (未保存 / 待删除): it must stay visible while
   the row is collapsed, and must not be tinted like the 手工 tag it sits next
   to — hence the doubled class, which outranks .dtpl-pricing-row-manual .tag. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-model-tag.dtpl-pricing-model-tag-staged{
  color:var(--dtpl-warn);
  background:color-mix(in srgb,var(--dtpl-warn) 16%,transparent);
}

/* Rate cells: values are right-aligned tabular text; manual rows swap in
   small number inputs with the same geometry (their width is 100% of the
   fixed 56px track above). */
[data-plugin="dsh-tokbook"] .dtpl-pricing-rate{
  justify-self:end;color:var(--dtpl-fg);font-size:11px;line-height:18px;
  font-variant-numeric:tabular-nums;
}
/* One rate cell. The label is hidden while the four columns are named by the
   sticky column header, and shown when the row stacks on a narrow screen. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-cell{
  display:flex;flex-direction:column;gap:1px;min-width:0;text-align:right;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-cell-label{
  display:none;font-size:9px;line-height:12px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-input{
  width:100%;box-sizing:border-box;justify-self:end;
  height:26px;padding:0 6px;
  border:1px solid var(--dtpl-hairline);border-radius:6px;corner-shape:round;
  background:var(--dtpl-surface);
  color:var(--dtpl-fg);font:inherit;font-size:11px;line-height:16px;
  font-variant-numeric:tabular-nums;text-align:right;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-input:focus{outline:none;border-color:var(--dtpl-accent);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-input::placeholder{color:var(--dtpl-fg-dim);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-select{
  appearance:auto;text-align:left;cursor:pointer;
}

/* Actions column: one compact secondary/ghost button, bounded by the fixed
   track above. A label longer than the budget ellipsizes (the title attribute
   still carries it) instead of widening the column. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-actions{
  display:flex;justify-content:flex-end;gap:6px;align-items:center;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-btn{
  flex:none;max-width:100%;height:24px;padding:0 10px;
  border:none;border-radius:999px;corner-shape:round;
  font:inherit;font-size:11px;line-height:16px;cursor:pointer;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  transition:background .15s ease,color .15s ease,box-shadow .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-custom{
  color:var(--dtpl-accent);
  background:color-mix(in srgb,var(--dtpl-accent) 10%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-custom:hover:not(:disabled){
  background:color-mix(in srgb,var(--dtpl-accent) 18%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-custom:disabled{opacity:.45;cursor:default;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-remove{
  color:var(--dtpl-err);
  background:transparent;
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-err) 40%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-remove:hover{
  background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);
}

/* 新增模型 row: the name input fills the model column's first line, the 新增
   tag sits beside it (the input shrinks; .dtpl-pricing-search is width:100%
   for the toolbar, so it must be released here). */
[data-plugin="dsh-tokbook"] .dtpl-pricing-row-add{
  background:color-mix(in srgb,var(--dtpl-fg) 2%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-name-input{flex:1 1 auto;min-width:0;width:auto;height:28px;}

/* Empty + skeleton states. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-empty{
  margin:12px 0;text-align:center;font-size:12px;line-height:18px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-skeleton{height:60px;border-radius:var(--dtpl-radius-sm);}
/* Unpriced (ledger-billed, no table entry) rows: warning-tinted so the ¥0 gap
   is visible, with a dashed leading edge distinct from manual's solid accent. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-empty-link{
  appearance:none;border:0;background:transparent;
  margin-left:8px;padding:0;
  font:inherit;font-size:12px;line-height:18px;cursor:pointer;
  color:var(--dtpl-accent);text-decoration:underline;text-underline-offset:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-empty-link:hover{color:var(--dtpl-accent-hover,var(--dtpl-accent));}
[data-plugin="dsh-tokbook"] .dtpl-pricing-row-unpriced{
  background:color-mix(in srgb,var(--dtpl-warn) 7%,transparent);
  box-shadow:inset 2px 0 0 var(--dtpl-warn);
  border-radius:4px 0 0 4px;corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-row-unpriced .dtpl-pricing-model-tag{
  color:var(--dtpl-warn);
  background:color-mix(in srgb,var(--dtpl-warn) 15%,transparent);
}

/* Cloud mirror fold: a bar toggling a bounded scroll region. Rows inside the
   region keep their own sticky column header so rates stay aligned. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-cloud{
  display:flex;flex-direction:column;margin-top:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-cloud-bar{
  appearance:none;border:0;background:transparent;
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  width:100%;padding:6px 8px;border-radius:8px;corner-shape:round;
  font:inherit;font-size:12px;line-height:18px;cursor:pointer;
  color:var(--dtpl-fg);
  transition:background .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-cloud-bar:hover{background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-cloud-bar-title{
  display:inline-flex;align-items:center;gap:8px;font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-cloud-bar-count{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:18px;height:16px;padding:0 6px;
  border-radius:999px;corner-shape:round;
  font-size:10px;line-height:1;font-weight:600;color:var(--dtpl-fg-3);
  background:color-mix(in srgb,var(--dtpl-fg) 9%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-cloud-bar-cue{color:var(--dtpl-fg-3);font-size:11px;line-height:16px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-cloud-scroll{
  max-height:min(320px,38vh);overflow:auto;overscroll-behavior:contain;
  border:.5px solid var(--dtpl-hairline);border-radius:8px;corner-shape:round;
  scrollbar-width:thin;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-col-header-sticky{
  position:sticky;top:0;z-index:1;
  padding:6px 10px;background:var(--dtpl-surface);
  border-bottom:.5px solid var(--dtpl-hairline);
}

/* Footer: save state + primary save button (mirrors the rescan pill). */
[data-plugin="dsh-tokbook"] .dtpl-pricing-foot{
  display:flex;align-items:center;justify-content:flex-end;gap:10px;
  margin-top:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-save-state{
  color:var(--dtpl-ok);font-size:11px;line-height:16px;font-weight:600;
  visibility:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-saved{visibility:visible;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-save{
  height:32px;padding:0 14px;
  border:none;border-radius:999px;corner-shape:round;
  background:var(--dtpl-accent-fill);color:var(--dtpl-on-accent);
  font:inherit;font-size:12px;line-height:18px;font-weight:500;cursor:pointer;
  transition:background .15s ease,opacity .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-save:hover:not(:disabled){background:var(--dtpl-accent-hover);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-save:disabled{opacity:.45;cursor:default;}

/* ── pricing tab · provider overlay surface ─────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-intro{
  margin:0;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-intro b{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-intro code{
  font-size:11px;color:var(--dtpl-fg);
  background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);
  padding:1px 4px;border-radius:4px;corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-list{display:flex;flex-direction:column;gap:10px;}
/* ── 同价通道 (route aliases) ──────────────────────────────────────────────
   One plan bought several times is several provider routes that price the
   same; this box declares the following once instead of editing each route. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias{
  display:flex;flex-direction:column;gap:8px;
  padding:8px 10px 10px;
  border:1px solid var(--dtpl-hairline);
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias-head{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias-title{
  font-size:12px;line-height:18px;font-weight:650;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias-hint{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias-list{display:flex;flex-wrap:wrap;gap:6px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias-item{
  display:inline-flex;align-items:center;gap:6px;
  padding:2px 4px 2px 8px;
  border-radius:999px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 9%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--dtpl-accent) 30%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias-route{
  font-size:11px;line-height:16px;font-weight:600;color:var(--dtpl-fg);
  max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias-arrow{
  color:var(--dtpl-fg-3);font-size:10px;line-height:14px;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias-remove{
  appearance:none;border:0;background:transparent;cursor:pointer;
  color:var(--dtpl-fg-3);font-size:10px;line-height:1;
  padding:2px 4px;border-radius:999px;corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias-remove:hover{
  color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias-add{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-alias-add .dtpl-pricing-input{max-width:220px;}
/* 高级 fold: the provider tab's first screen stays "one table"; the alias map
   and the add-override form live behind one disclosure. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-advanced{display:flex;flex-direction:column;gap:10px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-advanced-bar{
  appearance:none;border:1px solid var(--dtpl-hairline);background:transparent;
  display:flex;align-items:center;gap:8px;width:100%;
  padding:7px 10px;font:inherit;cursor:pointer;color:var(--dtpl-fg-3);
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-advanced-bar:hover{
  color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-advanced-title{font-size:11px;line-height:16px;font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-advanced-count{
  font-size:10px;line-height:14px;color:var(--dtpl-fg-3);
  padding:0 6px;border-radius:999px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-advanced-cue{margin-left:auto;font-size:11px;line-height:16px;}
/* The rule editor's own footer (删除手工价 lives here, not on the row). */
[data-plugin="dsh-tokbook"] .dtpl-pricing-detail-actions{
  display:flex;justify-content:flex-end;gap:6px;margin-top:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-group,
[data-plugin="dsh-tokbook"] .dtpl-pricing-family-group,
[data-plugin="dsh-tokbook"] .dtpl-pricing-chan-group{
  border:1px solid var(--dtpl-hairline);
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  overflow:hidden;
}
/* 在用 view: one static (non-collapsible) header per billing channel — this is
   the tab's primary content, so it is read, not folded away. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-chan-groups{display:flex;flex-direction:column;gap:6px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-chan-head{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:8px 10px;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-chan-name{font-size:12px;line-height:18px;font-weight:650;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-chan-route{color:var(--dtpl-fg-3);font-size:11px;line-height:16px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-chan-billing{
  font-size:9px;line-height:14px;font-weight:600;
  padding:0 6px;border-radius:999px;corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-chan-meta{margin-left:auto;color:var(--dtpl-fg-3);font-size:11px;line-height:16px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-chan-rows{display:flex;flex-direction:column;}
/* The chip that says a row's price is the model-layer (global) one: shared by
   every channel billing the same string. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-global-chip{
  font-size:9px;line-height:14px;font-weight:600;white-space:nowrap;
  padding:0 6px;border-radius:999px;corner-shape:round;
  color:var(--dtpl-fg-3);background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);
}
/* The cloud reference list stacks one collapsible group per vendor inside its
   bounded scroll region. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-family-group{margin:6px 6px 0;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-family-group:last-child{margin-bottom:6px;}
/* Group head is a full-width button: name + meta counts + caret. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-head,
[data-plugin="dsh-tokbook"] .dtpl-pricing-family-head{
  appearance:none;border:0;background:transparent;
  display:flex;align-items:center;gap:10px;width:100%;
  padding:8px 10px;font:inherit;cursor:pointer;color:var(--dtpl-fg);
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
  transition:background .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-head:hover,
[data-plugin="dsh-tokbook"] .dtpl-pricing-family-head:hover{background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-head-name,
[data-plugin="dsh-tokbook"] .dtpl-pricing-family-head-name{
  font-size:12px;line-height:18px;font-weight:650;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-head-meta,
[data-plugin="dsh-tokbook"] .dtpl-pricing-family-head-meta{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-head-caret,
[data-plugin="dsh-tokbook"] .dtpl-pricing-family-head-caret{
  margin-left:auto;color:var(--dtpl-fg-3);font-size:10px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-rows,
[data-plugin="dsh-tokbook"] .dtpl-pricing-family-rows{display:flex;flex-direction:column;}
/* One provider row: compact summary line (name/tags/billing/summary | actions). */
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-row{
  display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
  padding:6px 10px;border-top:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-row-hand{
  background:color-mix(in srgb,var(--dtpl-accent) 5%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-model{
  display:flex;flex-direction:column;gap:2px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-model-name{
  font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-billing{
  font-size:9px;line-height:14px;font-weight:600;
  padding:0 6px;border-radius:999px;corner-shape:round;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-billing-subscription,
[data-plugin="dsh-tokbook"] .dtpl-pricing-chan-billing-subscription{
  color:var(--dtpl-ok);
  background:color-mix(in srgb,var(--dtpl-ok) 15%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-billing-metered,
[data-plugin="dsh-tokbook"] .dtpl-pricing-chan-billing-metered{
  color:var(--dtpl-accent);
  background:color-mix(in srgb,var(--dtpl-accent) 15%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-chan-billing-unpriced{
  color:var(--dtpl-warn);
  background:color-mix(in srgb,var(--dtpl-warn) 15%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-summary{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;
}

/* The one-row-at-a-time inline editor. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-prov-editor{
  display:flex;flex-direction:column;gap:8px;
  padding:8px 10px 10px;
  background:color-mix(in srgb,var(--dtpl-fg) 2%,transparent);
  border-top:.5px dashed var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-prov-editor-grid{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
  gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-field{
  display:flex;flex-direction:column;gap:2px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-field > span{
  font-size:10px;line-height:14px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-provider-field-wide{grid-column:1/-1;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-prov-editor .dtpl-pricing-input{text-align:left;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-prov-editor-actions{
  display:flex;justify-content:flex-end;gap:8px;
}

/* ── pricing tab · expanded row body (timeline + staged rule editor) ────── */
[data-plugin="dsh-tokbook"] .dtpl-pricing-detail{
  padding:8px 10px 12px 28px;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  border-top:.5px dashed var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-detail-hint{
  margin:0 0 8px;font-size:11px;line-height:17px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-detail-hint b{color:var(--dtpl-fg);font-weight:600;}

/* Read-only price timeline: one card per window, the live one outlined. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-timeline{display:flex;flex-direction:column;gap:4px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-tl-row{
  display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:2px 10px;
  padding:5px 8px;border-radius:7px;corner-shape:round;
  font-size:11px;line-height:17px;
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 1px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-tl-active{box-shadow:inset 0 0 0 1px var(--dtpl-accent);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-tl-label{font-weight:600;color:var(--dtpl-fg);white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-tl-span{
  color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-tl-rates{
  color:var(--dtpl-fg);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-tl-badge{
  grid-column:1/-1;justify-self:start;
  font-size:9px;line-height:14px;font-weight:700;color:var(--dtpl-accent);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-tl-note,
[data-plugin="dsh-tokbook"] .dtpl-pricing-tl-slot{
  grid-column:1/-1;color:var(--dtpl-fg-3);font-size:10px;line-height:16px;
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-tl-base{
  background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);box-shadow:none;
}

/* Staged rule editor: price windows, their peak windows, and the root peaks. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-rules,
[data-plugin="dsh-tokbook"] .dtpl-pricing-rule-list,
[data-plugin="dsh-tokbook"] .dtpl-pricing-segments{display:flex;flex-direction:column;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-rule,
[data-plugin="dsh-tokbook"] .dtpl-pricing-slot{
  display:flex;flex-direction:column;gap:8px;
  padding:8px;border-radius:9px;corner-shape:round;
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 1px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-slot{background:color-mix(in srgb,var(--dtpl-fg) 3%,var(--dtpl-surface));}
[data-plugin="dsh-tokbook"] .dtpl-pricing-rule-head{display:flex;align-items:center;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-rule-index{
  flex:none;font-size:11px;line-height:16px;font-weight:600;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-label-input{flex:1 1 auto;min-width:0;text-align:left;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-rule-grid{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-fields{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-field{display:flex;flex-direction:column;gap:3px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-field > span{font-size:10px;line-height:14px;color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-field .dtpl-pricing-input{text-align:left;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-field-wide{grid-column:1/-1;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-slot-block{display:flex;flex-direction:column;gap:6px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-slot-block-nested{
  padding-top:6px;border-top:.5px dashed var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-slot-title{font-size:10px;line-height:15px;color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-days{display:flex;align-items:center;gap:4px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-day{
  appearance:none;width:24px;height:22px;padding:0;
  border:0;border-radius:6px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
  color:var(--dtpl-fg-2);font:inherit;font-size:11px;line-height:22px;cursor:pointer;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-day[aria-pressed="true"]{
  background:var(--dtpl-accent-fill);color:var(--dtpl-on-accent);font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-days-hint{margin-left:4px;font-size:10px;color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-day-preset{
  width:auto;padding:0 8px;font-size:10px;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
  box-shadow:inset 0 0 0 1px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-day-preset:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 9%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-pricing-days-gap{width:6px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-windows{display:flex;flex-direction:column;gap:5px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-window{display:flex;align-items:center;gap:6px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-clock{width:auto;flex:none;text-align:left;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-window-sep{color:var(--dtpl-fg-3);font-size:11px;}
[data-plugin="dsh-tokbook"] .dtpl-pricing-add{
  appearance:none;align-self:flex-start;
  height:24px;padding:0 10px;
  border:0;border-radius:999px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg-2);font:inherit;font-size:11px;line-height:24px;cursor:pointer;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-add:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 11%,transparent);}

/* New (provider, model) override form. */
[data-plugin="dsh-tokbook"] .dtpl-pricing-add-override{
  display:flex;flex-direction:column;gap:6px;
  padding:8px;border-radius:9px;corner-shape:round;
  border:.5px dashed var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-add-override-row{
  display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) auto;gap:8px;align-items:center;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-add-override-row .dtpl-pricing-input{text-align:left;}

/* ── dark-skin fallback tuning ──────────────────────────────────────────── */
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

  /* Pricing: the four fixed 56px rate columns leave no room for the model name
     on a phone. Stack each row instead — name, then a 2×2 rate grid with its
     own visible labels, then the actions. The column header goes away because
     it no longer lines up with anything. */
  [data-plugin="dsh-tokbook"] .dtpl-pricing-col-header{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-pricing-row{
    grid-template-columns:minmax(0,1fr);row-gap:8px;padding:8px 10px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-pricing-rates{
    grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;width:100%;
  }
  [data-plugin="dsh-tokbook"] .dtpl-pricing-cell-label{display:block;}
  [data-plugin="dsh-tokbook"] .dtpl-pricing-model-name{white-space:normal;overflow:visible;}
  [data-plugin="dsh-tokbook"] .dtpl-pricing-actions{width:auto;justify-content:flex-end;}
  [data-plugin="dsh-tokbook"] .dtpl-pricing-cloud-scroll{max-height:min(50vh,420px);}
  /* Timeline rows: three columns do not fit either. */
  [data-plugin="dsh-tokbook"] .dtpl-pricing-tl-row{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-pricing-tl-rates{text-align:left;white-space:normal;}
  [data-plugin="dsh-tokbook"] .dtpl-pricing-tl-span{white-space:normal;}
  /* Provider rows and the new-override form. */
  [data-plugin="dsh-tokbook"] .dtpl-pricing-provider-row{flex-direction:column;align-items:stretch;gap:8px;}
  [data-plugin="dsh-tokbook"] .dtpl-pricing-add-override-row{grid-template-columns:minmax(0,1fr);}
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
  [data-plugin="dsh-tokbook"] .dtpl-pricing-item-flash,
  [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{animation:none;}
}
`

let active = false

/** Inject the stylesheet; returns a disposer removing it. Idempotent. */
export function injectStyles(): () => void {
  if (active) return () => {}
  active = true
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)
  return () => {
    style.remove()
    active = false
  }
}
