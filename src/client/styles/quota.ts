/** styles.ts fragment: quota. Concatenated in order by `injectStyles`. */
export const CSS_QUOTA = `/* ── quota tab (订阅额度) ────────────────────────────────────────────────── */
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
/* Balance-gate chip (无生效订阅): not an error — the account still works, it is
   just no longer paced by a plan's rolling windows — so it reads as a caution
   rather than a failure. */
[data-plugin="dsh-tokbook"] .dtpl-quota-chip-gate{
  color:var(--dtpl-warn);
  background:color-mix(in srgb,var(--dtpl-warn) 12%,transparent);
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
/* Balance-gated body: the credit balance leads where the meters would be. A
   balance has no denominator, so there is no percentage to draw and no ring. */
[data-plugin="dsh-tokbook"] .dtpl-quota-balance{display:flex;align-items:baseline;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-balance-v{
  color:var(--dtpl-fg);font-size:22px;line-height:26px;font-weight:700;
  font-variant-numeric:tabular-nums;letter-spacing:-.01em;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-balance-k{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;font-weight:500;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-balance-note{
  margin:6px 0 0;font-size:11px;line-height:17px;color:var(--dtpl-fg-2);
}
/* Credit sources (月额度 / 已购 / 赠送): one compact line under the balance —
   and under the meters for an in-force card that carries top-up credits. */
[data-plugin="dsh-tokbook"] .dtpl-quota-sources{
  margin:8px 0 0;font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;
}
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

/* 价格未知 note's cross-tab link (overview → 价格表 with that filter on). */
[data-plugin="dsh-tokbook"] .dtpl-pricing-empty-link{
  appearance:none;border:0;background:transparent;padding:0;
  font:inherit;font-size:inherit;color:var(--dtpl-accent);
  cursor:pointer;text-decoration:underline;text-underline-offset:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-empty-link:hover{color:var(--dtpl-accent-hover,var(--dtpl-accent));}
`
