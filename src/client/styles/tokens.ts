export const CSS_TOKENS = `[data-plugin="dsh-tokbook"]{

  --dtpl-fg:var(--dsw-alias-label-primary,#24211e);
  --dtpl-fg-2:var(--dsw-alias-label-secondary,#6b6560);
  --dtpl-fg-3:var(--dsw-alias-label-tertiary,#8e8882);
  --dtpl-fg-dim:var(--dsw-alias-label-dimmed,#a8a29c);

  --dtpl-card:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,#ffffff));
  --dtpl-surface:var(--dsw-alias-bg-layer-1,#ffffff);
  --dtpl-border:var(--dsw-alias-border-l2,rgba(0,0,0,.12));
  --dtpl-hairline:var(--dsw-alias-border-l1,rgba(0,0,0,.08));

  --dtpl-ok:var(--dsw-alias-state-success-primary,#1a7f37);
  --dtpl-warn:var(--dsw-alias-state-warn-primary,#9a6700);
  --dtpl-err:var(--dsw-alias-state-error-primary,#cf222e);
  --dtpl-warn-ink:color-mix(in srgb,var(--dtpl-warn) 55%,var(--dtpl-fg));

  --dtpl-focus:var(--dsw-alias-brand-primary,#1f2328);

  --dtpl-footer-focus:var(--dsw-alias-label-primary,#1f2328);

  --dtpl-brand:#c99a2e;
  --dtpl-on-brand:#24211e;

  --dtpl-metal:
    inset 0 1px 0 0 color-mix(in srgb,#fff 7%,transparent),
    inset 0 -1px 0 0 color-mix(in srgb,#000 12%,transparent);
  --dtpl-sheen:inset 0 1px 0 0 color-mix(in srgb,#fff 6%,transparent);
  --dtpl-sheen-hover:inset 0 1px 0 0 color-mix(in srgb,#fff 10%,transparent);
  --dtpl-lift:0 4px 14px -6px rgba(0,0,0,.18);
  --dtpl-lift-hover:0 6px 20px -6px rgba(0,0,0,.24);
  --dtpl-panel-bg:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  --dtpl-wash-hover:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
  --dtpl-wash-on:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  --dtpl-paper:
    linear-gradient(180deg,
      color-mix(in srgb,var(--dtpl-fg) 1.2%,transparent) 0%,
      color-mix(in srgb,var(--dtpl-fg) 0.4%,transparent) 100%),
    radial-gradient(color-mix(in srgb,var(--dtpl-fg) 3%,transparent) 1px, transparent 1px);
  --dtpl-paper-size:100%,3px 3px;

  --dtpl-radius:0px;
  --dtpl-mono:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);

  --dtpl-ease-tint:var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1));
  --dtpl-ease-move:cubic-bezier(.05,.7,.1,1);
  --dtpl-dur-quick:100ms;
  --dtpl-dur-enter:200ms;
  --dtpl-dur-move:300ms;
  --dtpl-dur-draw:450ms;

  --dtpl-fs-micro:10px;
  --dtpl-fs-label:12px;
  --dtpl-fs-body:14px;
  --dtpl-fs-lead:16px;
  --dtpl-fs-figure:20px;
  --dtpl-fs-hero:38px;

  --dtpl-lh-micro:14px;
  --dtpl-lh-label:16px;
  --dtpl-lh-body:20px;
  --dtpl-lh-lead:22px;
  --dtpl-lh-figure:26px;
  --dtpl-lh-hero:44px;
  --dtpl-row-nums-w:224px;

  --dtpl-tok-cell-w:62px;

}

[data-dtpl-device="light"][data-plugin="dsh-tokbook"]{
  --dtpl-fg:#24211e;
  --dtpl-fg-2:#6b6560;
  --dtpl-fg-3:#8e8882;
  --dtpl-fg-dim:#a8a29c;
  --dtpl-card:#f5f6f8;
  --dtpl-surface:#fcfcfd;
  --dtpl-border:rgba(0,0,0,.12);
  --dtpl-hairline:rgba(0,0,0,.08);
  --dtpl-ok:#1a7f37;
  --dtpl-warn:#b45309;
  --dtpl-err:#c0242c;
  --dtpl-focus:#1f2328;
  --dtpl-footer-focus:#1f2328;
  --dtpl-casing:#c9c5bf;
  --dtpl-casing-ink:#24211e;
  --dtpl-casing-ink-2:#5a5550;
  --dtpl-casing-hover:rgba(0,0,0,.08);
  --dtpl-casing-line:rgba(0,0,0,.28);
  --dtpl-seam:rgba(0,0,0,.45);
  --dtpl-case-edge:#7e838c;
  --dtpl-case-shadow:rgba(15,17,21,.32);
  --dtpl-device-mask:rgba(20,22,26,.55);
  --dtpl-scrollbar:rgba(0,0,0,.24);
  --dtpl-scrollbar-hover:rgba(0,0,0,.34);
}
[data-dtpl-device="dark"][data-plugin="dsh-tokbook"]{
  --dtpl-fg:#f9fafb;
  --dtpl-fg-2:#d4d0cb;
  --dtpl-fg-3:#b0aba5;
  --dtpl-fg-dim:#7a7570;
  --dtpl-card:#26272b;
  --dtpl-surface:#1c1d20;
  --dtpl-border:rgba(255,255,255,.14);
  --dtpl-hairline:rgba(255,255,255,.10);
  --dtpl-ok:#3fb950;
  --dtpl-warn:#f97316;
  --dtpl-err:#ff6b61;
  --dtpl-focus:#f9fafb;
  --dtpl-footer-focus:#f9fafb;
  --dtpl-casing:#2a2d33;
  --dtpl-casing-ink:#f9fafb;
  --dtpl-casing-ink-2:#b0aba5;
  --dtpl-casing-hover:rgba(255,255,255,.10);
  --dtpl-casing-line:rgba(255,255,255,.22);
  --dtpl-seam:rgba(0,0,0,.70);
  --dtpl-case-edge:#101114;
  --dtpl-case-shadow:rgba(0,0,0,.62);
  --dtpl-device-mask:rgba(8,9,11,.72);
  --dtpl-scrollbar:rgba(255,255,255,.26);
  --dtpl-scrollbar-hover:rgba(255,255,255,.38);
}
`
