/** styles.ts fragment: overlay. Concatenated in order by `injectStyles`. */
export const CSS_OVERLAY = `/* ── overlay backdrop ───────────────────────────────────────────────────── */
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

/* ── segmented tabs (用量总览 / 通道用量 / 订阅额度 / 价格表 / 统计口径) ── */
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
`
