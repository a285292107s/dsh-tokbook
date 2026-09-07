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
[data-plugin="dsh-tokbook"] .dtpl-hero-cost{
  font-size:14px;line-height:20px;font-weight:600;color:var(--dtpl-accent);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-hero-meta{display:flex;flex-direction:column;gap:4px;align-items:flex-end;}
[data-plugin="dsh-tokbook"] .dtpl-meta{
  display:inline-flex;align-items:baseline;gap:4px;
  font-size:12px;line-height:18px;color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-meta-n{font-variant-numeric:tabular-nums;color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-meta-warn .dtpl-meta-n{color:var(--dtpl-warn);}

/* ── stat tiles (4 buckets) ─────────────────────────────────────────────── */
[data-plugin="dsh-tokbook"] .dtpl-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;}
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
[data-plugin="dsh-tokbook"] .dtpl-trend{margin-bottom:14px;}
[data-plugin="dsh-tokbook"] .dtpl-bars{
  display:flex;align-items:flex-end;gap:3px;height:64px;
  padding:8px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-bar{flex:1 1 0;min-width:0;height:100%;display:flex;align-items:flex-end;}
[data-plugin="dsh-tokbook"] .dtpl-bar-fill{
  width:100%;border-radius:2px 2px 0 0;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 62%,transparent);
  transition:opacity .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-bar:hover .dtpl-bar-fill{background:var(--dtpl-accent);}
[data-plugin="dsh-tokbook"] .dtpl-trend-axis{
  display:flex;justify-content:space-between;margin-top:4px;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-3);font-variant-numeric:tabular-nums;
}
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
[data-plugin="dsh-tokbook"] .dtpl-doc{max-width:none;}
[data-plugin="dsh-tokbook"] .dtpl-doc-title{
  font-size:13px;line-height:20px;font-weight:600;color:var(--dtpl-fg);
  margin:18px 0 6px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-title:first-child{margin-top:0;}
[data-plugin="dsh-tokbook"] .dtpl-doc p{
  font-size:12px;line-height:20px;color:var(--dtpl-fg-2);margin:0 0 8px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc p b{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc ul{
  margin:0 0 10px;padding-left:18px;
  display:flex;flex-direction:column;gap:5px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc li{
  font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc li b{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc li::marker{color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-doc code{
  font-family:var(--dtpl-mono);font-size:.9em;
  padding:.1em .4em;border-radius:5px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-foot{
  margin-top:14px;padding-top:10px;
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
  color:var(--dtpl-accent);font-size:12px;line-height:18px;font-weight:600;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
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
/* Reserved slot for the leading worst-window ring gauge; keeps the title
   from shifting when a card is loading / errored / unconfigured (no ring). */
[data-plugin="dsh-tokbook"] .dtpl-quota-state-gap{
  flex:none;width:38px;height:38px;
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
  display:flex;align-items:center;gap:12px;flex:none;
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
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh-ico{width:15px;height:15px;}
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
/* Worst-window ring gauge. Sits in the header identity slot on the card's
   leading edge (where the plan monogram used to be): a fixed 38px square,
   the ring fills it, and the used-% number is centered *inside* the ring.
   The summarized window lives in the accessible name / tooltip, not a
   visible caption, so the identity row stays compact. */
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge{
  position:relative;flex:none;width:38px;height:38px;
  color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-svg{width:38px;height:38px;display:block;}
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
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  color:inherit;font-size:11px;line-height:1;font-weight:700;
  font-variant-numeric:tabular-nums;white-space:nowrap;
  pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-n i{
  font-style:normal;font-size:8px;line-height:1;font-weight:600;
  color:var(--dtpl-fg-3);margin-left:.5px;
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
/* Footnote: when the official numbers were fetched (honesty for cached renders). */
[data-plugin="dsh-tokbook"] .dtpl-quota-updated{
  margin:10px 0 0;font-size:10px;line-height:14px;color:var(--dtpl-fg-dim);
  font-variant-numeric:tabular-nums;text-align:right;
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
  [data-plugin="dsh-tokbook"] .dtpl-body{padding:12px 16px 14px;}
  [data-plugin="dsh-tokbook"] .dtpl-foot{padding:10px 16px 12px;}
  [data-plugin="dsh-tokbook"] .dtpl-hero{flex-direction:column;align-items:flex-start;gap:8px;}
  [data-plugin="dsh-tokbook"] .dtpl-hero-meta{flex-direction:row;gap:12px;align-items:baseline;}
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
@media (prefers-reduced-motion:reduce){
  [data-plugin="dsh-tokbook"] .dtpl-sk,
  [data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot{animation:none;}
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
