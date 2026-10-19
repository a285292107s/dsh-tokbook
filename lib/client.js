window.__ModuleLoader__.load({
  id: "dsh-tokbook",
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    "use strict";
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    
    // src/client/index.ts
    var client_exports = {};
    __export(client_exports, {
      apply: () => apply,
      inject: () => inject
    });
    module.exports = __toCommonJS(client_exports);
    
    // src/route-paths.ts
    var ROUTE_OVERVIEW = "/tokbook/overview";
    var ROUTE_SYNC = "/tokbook/sync";
    var ROUTE_RESCAN = "/tokbook/rescan";
    var ROUTE_USAGE = "/tokbook/usage";
    var ROUTE_QUOTA = "/tokbook/quota";
    var ROUTE_PRICING = "/tokbook/pricing";
    var ROUTE_PRICING_SYNC = "/tokbook/pricing-sync";
    var ROUTE_PRICING_LOOKUP = "/tokbook/pricing-lookup";
    var ROUTE_HOLIDAY_SYNC = "/tokbook/holiday-sync";
    var ROUTE_SESSION = "/tokbook/session";
    var QUERY_SESSION = "session";
    var QUERY_RANGE = "range";
    var QUERY_PROVIDER = "provider";
    var QUERY_REFRESH = "refresh";
    var QUERY_FORCE = "force";
    var QUERY_MODEL = "model";
    var QUERY_YEAR = "year";
    
    // src/client/store.ts
    function createTokBookViewStore() {
      const listeners2 = /* @__PURE__ */ new Set();
      let snapshot = {
        open: false,
        overview: null,
        error: null,
        pricingDirty: false,
        quotaAlert: false
      };
      const emit = () => {
        for (const listener of [...listeners2]) listener();
      };
      return {
        subscribe(listener) {
          listeners2.add(listener);
          return () => {
            listeners2.delete(listener);
          };
        },
        getSnapshot() {
          return snapshot;
        },
        setOpen(open) {
          snapshot = { ...snapshot, open };
          emit();
        },
        setOverview(overview) {
          snapshot = { ...snapshot, overview, error: null };
          emit();
        },
        setError(error) {
          snapshot = { ...snapshot, error };
          emit();
        },
        setPricingDirty(pricingDirty) {
          if (snapshot.pricingDirty === pricingDirty) return;
          snapshot = { ...snapshot, pricingDirty };
          emit();
        },
        setQuotaAlert(quotaAlert) {
          if (snapshot.quotaAlert === quotaAlert) return;
          snapshot = { ...snapshot, quotaAlert };
          emit();
        }
      };
    }
    
    // src/client/styles/tokens.ts
    var CSS_TOKENS = `[data-plugin="dsh-tokbook"]{
    
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
    `;
    
    // src/client/styles/footer.ts
    var CSS_FOOTER = `
    [data-plugin="dsh-tokbook"].dtpl-footer{
      flex:1;min-width:0;
      display:flex;align-items:center;gap:8px;
      width:auto;height:42px;padding:0 10px 0 8px;box-sizing:border-box;
      border:none;border-radius:var(--dtpl-radius);background:transparent;
      cursor:pointer;overflow:hidden;
      color:var(--dsw-alias-label-primary,#1f2328);
      font-family:inherit;font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);white-space:nowrap;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
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
    [data-plugin="dsh-tokbook"] .dtpl-foot-ico-wrap{position:relative;display:inline-flex;flex:none;align-items:center;justify-content:center;}
    [data-plugin="dsh-tokbook"] .dtpl-foot-alert{
      position:absolute;top:-1px;right:-1px;
      width:8px;height:8px;border-radius:50%;
      background:var(--dtpl-warn,#9a6700);
      box-shadow:0 0 0 2px var(--dtpl-surface,#fff);
    }
    [data-plugin="dsh-tokbook"] .dtpl-foot-label{overflow:hidden;white-space:nowrap;}
    [data-plugin="dsh-tokbook"].dtpl-footer:focus-visible{
      outline:none;
      background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));
      box-shadow:inset 3px 0 0 var(--dtpl-footer-focus);
    }
    
    [data-plugin="dsh-tokbook"] :focus-visible{
      outline:2px solid var(--dtpl-focus);outline-offset:2px;
    }
    `;
    
    // src/client/styles/overlay.ts
    var CSS_OVERLAY = `
    [data-plugin="dsh-tokbook"].dtpl-overlay{
      position:fixed;inset:0;z-index:1000;
      display:flex;align-items:center;justify-content:center;
      padding:24px;
      background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.45));
      backdrop-filter:var(--dsw-mask-blur,blur(2px));
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-card{
      position:relative;
      width:min(720px,100%);height:min(680px,88dvh);height:min(680px,88vh);
      display:flex;flex-direction:column;
      background:var(--dtpl-paper);
      background-color:var(--dtpl-card);
      background-size:var(--dtpl-paper-size);
      color:var(--dtpl-fg);
      border-radius:0;
      box-shadow:
        inset 0 1px 0 0 color-mix(in srgb,#fff 6%,transparent),
        var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.28)),
        inset 0 0 0 1px var(--dtpl-border);
      overflow:hidden;
    }
    [data-plugin="dsh-tokbook"] .dtpl-card::before,
    [data-plugin="dsh-tokbook"] .dtpl-card::after{
      content:"";position:absolute;width:16px;height:16px;pointer-events:none;z-index:2;
      border-color:color-mix(in srgb,var(--dtpl-fg-2) 55%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-card::before{
      top:0;left:0;border-top:2px solid;border-left:2px solid;
    }
    [data-plugin="dsh-tokbook"] .dtpl-card::after{
      right:0;bottom:0;border-right:2px solid;border-bottom:2px solid;
    }
    [data-plugin="dsh-tokbook"] .dtpl-card:focus{outline:none;}
    
    [data-plugin="dsh-tokbook"] .dtpl-head{
      display:flex;align-items:center;justify-content:space-between;gap:16px;
      padding:14px 20px 12px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-title{
      display:flex;align-items:center;gap:10px;min-width:0;
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;letter-spacing:.02em;
    }
    [data-plugin="dsh-tokbook"] .dtpl-title-ico-chip{
      display:inline-flex;align-items:center;justify-content:center;flex:none;
      width:22px;height:22px;
      background:var(--dtpl-brand);
      color:var(--dtpl-on-brand);
      box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
    }
    [data-plugin="dsh-tokbook"] .dtpl-title-ico{width:14px;height:14px;}
    [data-plugin="dsh-tokbook"] .dtpl-close{
      display:inline-flex;align-items:center;justify-content:center;flex:none;
      width:28px;height:28px;border:0;background:transparent;
      color:var(--dtpl-fg-2);
      cursor:pointer;line-height:1;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-close-ico{width:16px;height:16px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-tabs{
      display:flex;gap:0;flex:none;
      margin:0;padding:0 20px;
      border-bottom:1px solid var(--dtpl-border);
      position:relative;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tab{
      position:relative;appearance:none;flex:1;border:0;background:transparent;
      height:30px;padding:0 12px;
      font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;
      color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tab + .dtpl-tab{border-left:.5px solid var(--dtpl-hairline);}
    [data-plugin="dsh-tokbook"] .dtpl-tab:hover{color:var(--dtpl-fg);background:var(--dtpl-wash-hover);}
    [data-plugin="dsh-tokbook"] .dtpl-tab[aria-selected="true"]{
      color:var(--dtpl-fg);font-weight:600;
      background:var(--dtpl-wash-on);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tab[aria-selected="true"]::after{
      content:"";position:absolute;left:0;right:0;bottom:-1px;height:5px;
      background:var(--dtpl-brand);
      box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tab-dot{
      display:inline-block;width:6px;height:6px;margin-left:5px;
      background:var(--dtpl-fg);
      vertical-align:middle;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-body{
      flex:1;min-height:0;
      padding:18px 20px 20px;overflow:auto;overscroll-behavior:contain;
      scrollbar-gutter:stable;
      scrollbar-width:thin;
      scrollbar-color:var(--dsw-alias-scrollbar-bg-l2,rgba(0,0,0,.2)) transparent;
      scroll-padding:8px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-body::-webkit-scrollbar{width:8px;}
    [data-plugin="dsh-tokbook"] .dtpl-body::-webkit-scrollbar-thumb{
      border:2px solid transparent;border-radius:0;background-clip:padding-box;
      background-color:var(--dsw-alias-scrollbar-bg-l2,rgba(0,0,0,.2));
    }
    [data-plugin="dsh-tokbook"] .dtpl-body::-webkit-scrollbar-thumb:hover{
      background-color:var(--dsw-alias-scrollbar-hover-l2,rgba(0,0,0,.3));
    }
    `;
    
    // src/client/styles/ledger.ts
    var CSS_LEDGER = `
    [data-plugin="dsh-tokbook"] .dtpl-hero{
      position:relative;
      display:flex;flex-direction:column;gap:12px;
      padding:16px;margin:0 0 20px;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      box-shadow:
        inset 0 1px 0 0 color-mix(in srgb,#fff 8%,transparent),
        var(--dtpl-metal),
        0 10px 30px -10px rgba(0,0,0,.22);
      overflow:hidden;
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero::before,
    [data-plugin="dsh-tokbook"] .dtpl-hero::after{
      content:"";position:absolute;width:14px;height:14px;pointer-events:none;z-index:2;
      border-color:color-mix(in srgb,var(--dtpl-fg) 55%,transparent);
      transition:border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero::before{
      top:0;left:0;border-top:2px solid;border-left:2px solid;
      border-color:color-mix(in srgb,#fff 62%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero::after{right:0;bottom:0;border-right:2px solid;border-bottom:2px solid;}
    [data-plugin="dsh-tokbook"] .dtpl-hero:hover::before,
    [data-plugin="dsh-tokbook"] .dtpl-hero:hover::after{
      border-color:color-mix(in srgb,var(--dtpl-fg) 78%,transparent);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-hero-top{
      display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero-lead{display:flex;flex-direction:column;gap:7px;min-width:0;flex:1 1 auto;}
    [data-plugin="dsh-tokbook"] .dtpl-hero-head{
      display:flex;align-items:baseline;justify-content:space-between;gap:16px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-total-k{
      display:inline-flex;align-items:center;gap:8px;
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;letter-spacing:.06em;
      color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-total-k::before{
      content:"";flex:none;width:7px;height:13px;
      background:var(--dtpl-brand);
      box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
    }
    [data-plugin="dsh-tokbook"] .dtpl-total-num{
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-hero);line-height:var(--dtpl-lh-hero);font-weight:600;color:var(--dtpl-fg);
      font-variant-numeric:tabular-nums;letter-spacing:-.03em;
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero-figure{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
    [data-plugin="dsh-tokbook"] .dtpl-hero-delta{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero-delta b{
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
      font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero-money{display:flex;flex-direction:column;gap:4px;flex:none;}
    [data-plugin="dsh-tokbook"] .dtpl-hero-money-row{
      display:flex;align-items:baseline;gap:16px;justify-content:space-between;
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero-money-row + .dtpl-hero-money-row{
      border-top:1px solid var(--dtpl-hairline);
      padding-top:2px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero-money-k{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-hero-money-v{
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;color:var(--dtpl-fg-2);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero-money-v.is-cash{color:var(--dtpl-fg);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-hero-money-v.is-zero{color:var(--dtpl-fg-2);font-weight:400;}
    [data-plugin="dsh-tokbook"] .dtpl-hero-facts{
      display:flex;flex-wrap:wrap;align-items:baseline;min-width:0;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero-fact{white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-hero-facts b{
      font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-hero-facts i{font-style:normal;color:var(--dtpl-fg-dim);padding:0 5px;}
    [data-plugin="dsh-tokbook"] .dtpl-cash-amt{
      font-style:normal;
      font-family:var(--dtpl-mono);color:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-sub-amt{
      font-style:normal;
      font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-weight:400;font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-cost-na{
      font-style:normal;
      font-family:var(--dtpl-mono);color:var(--dtpl-fg-3);font-weight:400;font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-cost-k{font-style:normal;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);margin-left:3px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-grid{
      display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;
      border-top:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-grid-3{grid-template-columns:repeat(3,minmax(0,1fr));}
    [data-plugin="dsh-tokbook"] .dtpl-stat{
      display:flex;flex-direction:column;gap:3px;min-width:0;
      padding:10px 14px 11px;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-left-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-stat + .dtpl-stat{border-left:1px solid var(--dtpl-border);}
    [data-plugin="dsh-tokbook"] .dtpl-stat:hover{
      background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
      border-left:2px solid var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-k{
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;letter-spacing:.05em;color:var(--dtpl-fg-2);
      white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-stat .dtpl-v{
      display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-stat-pct{font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-stat-k{
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;letter-spacing:.05em;color:var(--dtpl-fg-2);
      white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-stat-v{
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-stat-p{font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);}
    
    [data-plugin="dsh-tokbook"] .dtpl-sec-title{
      display:flex;align-items:baseline;gap:9px;
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;letter-spacing:.04em;color:var(--dtpl-fg);
      margin:0 0 11px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-sec-title::before{
      content:"";flex:none;align-self:center;
      width:7px;height:13px;
      background:var(--dtpl-brand);
      box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
    }
    [data-plugin="dsh-tokbook"] .dtpl-sec-aside{
      flex:none;margin-bottom:11px;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-trend{margin-bottom:0;}
    [data-plugin="dsh-tokbook"] .dtpl-bars{
      position:relative;
      display:flex;align-items:flex-end;gap:3px;height:92px;
      margin-top:24px;
      padding:0 14px;
      border-bottom:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bars::before,
    [data-plugin="dsh-tokbook"] .dtpl-bars::after{
      content:"";position:absolute;left:14px;right:14px;height:1px;pointer-events:none;
      background:color-mix(in srgb,var(--dtpl-fg-3) 14%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bars::before{top:25%;}
    [data-plugin="dsh-tokbook"] .dtpl-bars::after{top:75%;}
    [data-plugin="dsh-tokbook"] .dtpl-bar{position:relative;flex:1 1 0;min-width:0;height:100%;display:flex;align-items:flex-end;}
    [data-plugin="dsh-tokbook"] .dtpl-bar-fill{
      position:relative;width:100%;overflow:hidden;
      background:linear-gradient(to bottom,
        color-mix(in srgb,var(--dtpl-fg) 52%,transparent) 0%,
        color-mix(in srgb,var(--dtpl-fg) 40%,transparent) 60%,
        color-mix(in srgb,var(--dtpl-fg) 30%,transparent) 100%);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bar-fill::before{
      content:"";position:absolute;left:0;right:0;top:0;height:1px;
      background:color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bar:hover .dtpl-bar-fill:not(.is-peak){
      background:linear-gradient(to bottom,
        color-mix(in srgb,var(--dtpl-fg) 68%,transparent) 0%,
        color-mix(in srgb,var(--dtpl-fg) 52%,transparent) 60%,
        color-mix(in srgb,var(--dtpl-fg) 40%,transparent) 100%);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bar:hover .dtpl-bar-label:not(.is-peak){color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-bar-fill.is-peak{
      background:linear-gradient(to bottom,
        color-mix(in srgb,var(--dtpl-fg) 78%,transparent) 0%,
        color-mix(in srgb,var(--dtpl-fg) 68%,transparent) 50%,
        color-mix(in srgb,var(--dtpl-fg) 58%,transparent) 100%);
      box-shadow:inset 0 0 0 1px var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bar-fill.is-peak::before{
      top:1px;height:3%;background:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bar.is-zero::after{
      content:"";position:absolute;left:calc(50% - 1px);bottom:0;width:2px;height:3px;
      pointer-events:none;background:var(--dtpl-fg-3);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bar-label{
      position:absolute;left:50%;transform:translateX(-50%);
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
      white-space:nowrap;pointer-events:none;
    }
    [data-plugin="dsh-tokbook"] .dtpl-bar-label.is-peak{color:var(--dtpl-fg);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-bar-label.is-peak::before{
      content:"";display:inline-block;width:4px;height:8px;vertical-align:-1px;
      margin-right:5px;background:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bar.is-zero .dtpl-bar-label{display:none;}
    [data-plugin="dsh-tokbook"] .dtpl-trend-axis{
      display:flex;gap:3px;margin-top:6px;padding:0 14px;
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-trend-axis span{flex:1 1 0;min-width:0;text-align:center;white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-trend-axis span.is-peak{color:var(--dtpl-fg);font-weight:600;}
    
    [data-plugin="dsh-tokbook"] .dtpl-bd-head{
      display:flex;align-items:center;gap:16px;flex-wrap:wrap;
      border-bottom:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bd-tabs{display:inline-flex;gap:0;align-self:stretch;align-items:flex-end;}
    [data-plugin="dsh-tokbook"] .dtpl-bd-tab{
      position:relative;appearance:none;border:0;background:transparent;
      padding:3px 14px 8px;
      font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;
      color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
      transition:color var(--dtpl-dur-quick) var(--dtpl-ease-tint),background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bd-tab + .dtpl-bd-tab{border-left:.5px solid var(--dtpl-hairline);}
    [data-plugin="dsh-tokbook"] .dtpl-bd-tab:hover{color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-bd-tab[aria-selected="true"]{
      color:var(--dtpl-fg);font-weight:600;
      background:color-mix(in srgb,var(--dtpl-fg) 5%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bd-tab[aria-selected="true"]::after{
      content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bd-head .dtpl-sec-aside{margin:0 0 0 auto;}
    
    [data-plugin="dsh-tokbook"] .dtpl-bd-cols,
    [data-plugin="dsh-tokbook"] .dtpl-row{
      display:grid;
      grid-template-columns:minmax(0,1fr) minmax(min-content,var(--dtpl-row-nums-w));
      column-gap:16px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-bd-cols{
      padding:8px 0 6px;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bd-col-id,
    [data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    [data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{text-align:right;}
    
    [data-plugin="dsh-tokbook"] .dtpl-models{display:flex;flex-direction:column;}
    [data-plugin="dsh-tokbook"] .dtpl-row{align-items:start;padding:0;}
    [data-plugin="dsh-tokbook"] .dtpl-row + .dtpl-row{margin-top:10px;}
    [data-plugin="dsh-tokbook"] .dtpl-model{display:flex;align-items:flex-start;gap:8px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-model-txt{display:flex;flex-direction:column;gap:3px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-model-name{
      color:var(--dtpl-fg);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:500;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-model-provider{
      font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.04em;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-share-ring{position:relative;flex:none;width:44px;height:44px;}
    [data-plugin="dsh-tokbook"] .dtpl-share-ring svg{display:block;}
    [data-plugin="dsh-tokbook"] .dtpl-share-ring-track{
      fill:none;stroke:color-mix(in srgb,var(--dtpl-fg) 16%,transparent);stroke-width:1;
    }
    [data-plugin="dsh-tokbook"] .dtpl-share-ring-arc{fill:none;stroke:var(--dtpl-fg);stroke-width:2;}
    [data-plugin="dsh-tokbook"] .dtpl-share-ring-num{
      position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:1;color:var(--dtpl-fg);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-share-ring-num i{font-style:normal;font-size:var(--dtpl-fs-micro);}
    [data-plugin="dsh-tokbook"] .dtpl-model-nums{display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-val{
      font-family:var(--dtpl-mono);color:var(--dtpl-fg);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-cost{
      display:flex;align-items:baseline;justify-content:flex-end;gap:0;
      max-width:100%;
      font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-cost-seg{
      display:flex;align-items:baseline;gap:5px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-cost-sep{flex:none;padding:0 6px;color:var(--dtpl-fg-dim);}
    [data-plugin="dsh-tokbook"] .dtpl-cost-main{min-width:0;overflow:hidden;text-overflow:ellipsis;}
    [data-plugin="dsh-tokbook"] .dtpl-cost-k{
      flex:none;min-width:44px;margin-left:0;text-align:left;line-height:16px;white-space:nowrap;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-ws-meta{
      display:flex;align-items:baseline;gap:6px;min-width:0;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-ws-path{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);
      min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-ws-sep{flex:none;color:var(--dtpl-fg-dim);}
    [data-plugin="dsh-tokbook"] .dtpl-ws-facts{
      flex:none;font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-ws-fail{
      font-weight:600;color:var(--dtpl-warn-ink);font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-row.is-unattributed{
      margin-top:22px;padding-top:14px;
      border-top:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-row.is-unattributed .dtpl-model-name{
      color:var(--dtpl-fg-2);font-weight:400;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-foot{
      flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;
      padding:11px 20px 14px;
      border-top:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-foot-state{
      display:inline-flex;align-items:baseline;gap:8px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-sync{
      display:inline-flex;align-items:center;gap:6px;min-width:0;
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-sync-dot{
      flex:none;width:6px;height:6px;border-radius:50%;corner-shape:round;
      background:currentColor;
    }
    [data-plugin="dsh-tokbook"] .dtpl-sync-error{color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-sync-running{color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot{animation:dtpl-pulse 1.2s ease-in-out infinite;}
    [data-plugin="dsh-tokbook"] .dtpl-foot-latest{
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.04em;color:var(--dtpl-fg-2);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-rescan{
      display:inline-flex;align-items:center;gap:6px;flex:none;
      height:30px;padding:0 12px;
      border:1px solid var(--dtpl-border);background:transparent;color:var(--dtpl-fg);
      font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;cursor:pointer;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-rescan:hover:not(:disabled){
      background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
      border-color:color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-rescan:disabled{opacity:.4;cursor:not-allowed;}
    [data-plugin="dsh-tokbook"] .dtpl-rescan-ico{width:14px;height:14px;flex:none;}
    [data-plugin="dsh-tokbook"] .dtpl-spin{animation:dtpl-rotate 1s linear infinite;}
    
    [data-plugin="dsh-tokbook"] .dtpl-error{
      display:flex;align-items:center;justify-content:space-between;gap:12px;
      margin-bottom:12px;padding:10px 12px;
      border:1px solid color-mix(in srgb,var(--dtpl-err) 45%,transparent);
      background:color-mix(in srgb,var(--dtpl-err) 8%,transparent);
      box-shadow:var(--dtpl-metal);
    }
    [data-plugin="dsh-tokbook"] .dtpl-error-text{
      margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-err);min-width:0;overflow-wrap:anywhere;
    }
    [data-plugin="dsh-tokbook"] .dtpl-retry{
      flex:none;height:26px;padding:0 12px;
      border:1px solid color-mix(in srgb,var(--dtpl-err) 45%,transparent);
      background:transparent;color:var(--dtpl-err);
      font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);cursor:pointer;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-retry:hover{background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);}
    
    [data-plugin="dsh-tokbook"] .dtpl-skeleton{display:flex;flex-direction:column;gap:16px;}
    [data-plugin="dsh-tokbook"] .dtpl-sk{
      background:linear-gradient(100deg,
        color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 40%,
        color-mix(in srgb,var(--dtpl-fg) 10%,transparent) 50%,
        color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 60%);
      background-size:200% 100%;
      animation:dtpl-shimmer 1.4s ease infinite;
    }
    [data-plugin="dsh-tokbook"] .dtpl-sk-hero{height:186px;}
    [data-plugin="dsh-tokbook"] .dtpl-sk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;}
    [data-plugin="dsh-tokbook"] .dtpl-sk-tile{height:68px;}
    [data-plugin="dsh-tokbook"] .dtpl-sk-chart{height:159px;}
    [data-plugin="dsh-tokbook"] .dtpl-sk-row{height:44px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-empty{
      display:flex;flex-direction:column;align-items:center;text-align:center;
      padding:36px 20px;margin:0 0 12px;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      box-shadow:var(--dtpl-metal);
    }
    [data-plugin="dsh-tokbook"] .dtpl-empty-ico{width:24px;height:24px;margin-bottom:12px;color:var(--dtpl-fg-3);}
    [data-plugin="dsh-tokbook"] .dtpl-empty-title{
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);margin:0 0 6px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-empty-sub{font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);margin:0;max-width:44ch;}
    [data-plugin="dsh-tokbook"] .dtpl-empty-sub code{
      font-family:var(--dtpl-mono);font-size:.9em;
      padding:.1em .35em;
      background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
      color:var(--dtpl-fg);
    }
    `;
    
    // src/client/styles/method.ts
    var CSS_METHOD = `
    [data-plugin="dsh-tokbook"] .dtpl-doc{max-width:none;}
    [data-plugin="dsh-tokbook"] .dtpl-doc code{
      font-family:var(--dtpl-mono);
      padding:.1em .35em;
      border:1px solid var(--dtpl-hairline);
      background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
      color:var(--dtpl-fg);
      white-space:nowrap;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-lede{
      display:flex;flex-direction:column;gap:3px;
      margin:0 0 12px;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-lede p{margin:0;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-lede b{color:var(--dtpl-fg);font-weight:600;}
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-facts{
      display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
      margin-bottom:16px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-fact{
      display:flex;flex-direction:column;gap:3px;
      padding:10px 12px;min-width:0;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      box-shadow:
        var(--dtpl-sheen),
        var(--dtpl-metal);
      transition:box-shadow var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-fact:hover{
      box-shadow:
        var(--dtpl-sheen-hover),
        var(--dtpl-metal),
        var(--dtpl-lift);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-fact-k{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);font-weight:500;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-fact-v{
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-sec{margin-bottom:16px;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-title{
      display:flex;align-items:center;gap:8px;
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
      margin:0 0 10px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-idx{
      flex:none;display:inline-flex;align-items:center;justify-content:center;
      width:18px;height:18px;
      background:var(--dtpl-brand);color:var(--dtpl-on-brand);
      box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-label);line-height:1;font-weight:700;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-sub{
      margin:0 0 8px;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-sub b{color:var(--dtpl-fg);font-weight:600;}
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-buckets{
      display:grid;grid-template-columns:repeat(2,1fr);gap:8px;
      margin-bottom:10px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-bucket{
      display:flex;flex-direction:column;gap:3px;
      padding:10px 12px;min-width:0;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      box-shadow:
        var(--dtpl-sheen),
        var(--dtpl-metal);
      transition:box-shadow var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-bucket:hover{
      box-shadow:
        var(--dtpl-sheen-hover),
        var(--dtpl-metal),
        var(--dtpl-lift);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-bucket-name{
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-bucket-desc{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge{
      width:100%;table-layout:fixed;border-collapse:collapse;
      margin:0 0 8px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge th,
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge td{
      text-align:left;vertical-align:top;
      padding:7px 8px;
      border-top:1px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th{
      padding:0 8px 5px;border-top:none;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:first-child{width:52%;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(2),
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(3){width:24%;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge tbody th{font-weight:400;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge-what{
      display:block;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge-detail{
      display:block;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge-note{
      margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge-note b{color:var(--dtpl-fg);font-weight:600;}
    @media (max-width:640px){
      [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:first-child{width:46%;}
      [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(2),
      [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(3){width:27%;}
      [data-plugin="dsh-tokbook"] .dtpl-doc-judge th,
      [data-plugin="dsh-tokbook"] .dtpl-doc-judge td{padding:6px;}
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-chip{
      flex:none;display:inline-flex;align-items:center;
      height:18px;padding:0 7px;margin-top:1px;
      border:1px solid color-mix(in srgb,var(--dtpl-fg) 35%,transparent);
      color:var(--dtpl-fg);
      font-size:var(--dtpl-fs-micro);line-height:1;font-weight:600;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-chip-off{
      border-color:var(--dtpl-border);
      color:var(--dtpl-fg-3);
      font-weight:500;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap{
      display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-card{
      padding:11px 13px;min-width:0;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-title{
      display:flex;align-items:center;gap:6px;
      margin:0 0 6px;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-title::before{
      content:"";flex:none;width:3px;height:12px;
      background:var(--dtpl-fg-3);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title{color:var(--dtpl-warn-ink);}
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title::before{background:var(--dtpl-warn);}
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-list{
      list-style:none;margin:0;padding:0;
      display:flex;flex-direction:column;gap:8px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li{
      position:relative;padding-left:12px;
      display:flex;flex-direction:column;gap:1px;
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li::before{
      content:"";position:absolute;left:1px;top:7px;
      width:4px;height:4px;border-radius:50%;corner-shape:round;
      background:var(--dtpl-fg-3);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-name{
      display:block;color:var(--dtpl-fg);font-weight:600;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-desc{
      display:block;color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum{
      margin:8px 0 0;padding-top:7px;
      border-top:1px solid var(--dtpl-hairline);
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum b{color:var(--dtpl-fg);font-weight:600;}
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-map{
      display:flex;flex-direction:column;gap:5px;
      margin:2px 0 8px;padding:10px 12px;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-map-row{
      display:flex;align-items:center;gap:8px;flex-wrap:wrap;
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-map-row b{color:var(--dtpl-fg);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-map-arrow{color:var(--dtpl-fg-3);flex:none;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-map-note{
      margin:2px 0 0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-map-note:first-of-type{margin-top:2px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-quota{
      display:flex;flex-direction:column;gap:3px;
      margin:0 0 14px;padding:10px 13px;
      border:1px solid var(--dtpl-border);
      box-shadow:inset 3px 0 0 var(--dtpl-fg-3);
      background:var(--dtpl-panel-bg);
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-quota p{margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-doc-quota b{color:var(--dtpl-fg);font-weight:600;}
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-data{
      display:flex;flex-direction:column;gap:3px;
      margin:2px 0 6px;padding:10px 13px;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-data-line{
      margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-data-line b{color:var(--dtpl-fg);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-data-dir{
      margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-data-dir code{
      background:transparent;border:0;padding:0;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-foot{
      margin-top:12px;padding-top:10px;
      border-top:1px solid var(--dtpl-border);
      font-size:var(--dtpl-fs-label)!important;line-height:16px!important;color:var(--dtpl-fg-2)!important;
    }
    `;
    
    // src/client/styles/provider.ts
    var CSS_PROVIDER = `
    [data-plugin="dsh-tokbook"] .dtpl-usage-section{
      margin-top:22px;padding-top:20px;
      border-top:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-head{
      display:flex;flex-direction:column;gap:6px;
      margin:0 0 14px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-head-top{
      display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-title{margin:0;}
    [data-plugin="dsh-tokbook"] .dtpl-usage-facts{min-height:19px;}
    [data-plugin="dsh-tokbook"] .dtpl-usage-facts-sk{width:236px;min-height:19px;}
    [data-plugin="dsh-tokbook"] .dtpl-usage-facts-empty{min-height:19px;}
    [data-plugin="dsh-tokbook"] .dtpl-usage-scope{
      display:flex;align-items:center;gap:8px;flex:none;
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-money-note{
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-range-tabs{
      display:flex;flex:none;
      border-bottom:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-range-tab{
      flex:0 0 auto;
      position:relative;appearance:none;border:0;background:transparent;
      height:24px;padding:0 11px;
      font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:500;
      color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-range-tab + .dtpl-range-tab{border-left:.5px solid var(--dtpl-hairline);}
    [data-plugin="dsh-tokbook"] .dtpl-range-tab:hover{color:var(--dtpl-fg);background:var(--dtpl-wash-hover);}
    [data-plugin="dsh-tokbook"] .dtpl-range-tab.dtpl-range-active{
      color:var(--dtpl-fg);font-weight:600;
      background:var(--dtpl-wash-on);
    }
    [data-plugin="dsh-tokbook"] .dtpl-range-tab.dtpl-range-active::after{
      content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-cuts-sk{width:192px;height:29px;}
    [data-plugin="dsh-tokbook"] .dtpl-providers{display:flex;flex-direction:column;gap:10px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-provider-card{
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      box-shadow:
        var(--dtpl-sheen),
        var(--dtpl-metal),
        var(--dtpl-lift);
      transition:box-shadow var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-card:hover{
      box-shadow:
        var(--dtpl-sheen-hover),
        var(--dtpl-metal),
        var(--dtpl-lift-hover);
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-head{
      display:grid;
      grid-template-columns:minmax(0,1fr) minmax(min-content,var(--dtpl-row-nums-w));
      column-gap:16px;
      align-items:end;
      padding:11px 14px 10px;
      border-bottom:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-id{
      display:flex;flex-direction:column;gap:2px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-title{
      display:flex;align-items:center;gap:6px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-name{
      color:var(--dtpl-fg);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-key{
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-micro);
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-bill{
      flex:none;display:inline-flex;align-items:center;
      height:15px;padding:0 5px;
      border:1px solid var(--dtpl-border);
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);font-weight:600;white-space:nowrap;
      color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-bill[data-billing="subscription"]{
      border-color:var(--dtpl-fg);
      background:var(--dtpl-fg);color:var(--dtpl-card);
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-meta{
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-nums{
      display:flex;flex-direction:column;align-items:flex-end;gap:2px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-tokens{
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg);font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);font-weight:600;
      letter-spacing:-.01em;font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-cost{
      display:flex;flex-direction:column;align-items:flex-end;gap:1px;
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:400;
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-spend{font-weight:600;color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-provider-value{color:var(--dtpl-fg-2);font-weight:400;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);}
    [data-plugin="dsh-tokbook"] .dtpl-provider-model-sub{
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-provider-models{
      display:flex;flex-direction:column;
      padding:9px 14px 11px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-sk-card{height:132px;}
    
    @media (max-width:640px){
      [data-plugin="dsh-tokbook"] .dtpl-usage-head-top{justify-content:flex-start;}
      [data-plugin="dsh-tokbook"] .dtpl-usage-scope{flex:0 0 100%;}
      [data-plugin="dsh-tokbook"] .dtpl-usage-facts{
        display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 10px;
      }
    }
    `;
    
    // src/client/styles/session.ts
    var CSS_SESSION = `
    [data-plugin="dsh-tokbook"].dtpl-tok{
      --dtpl-col-w:var(--dtpl-tok-width,var(--dsh-chat-content-width,920px));
      display:flex;flex-direction:column;
      flex:1 1 0;min-height:0;overflow:hidden;
      position:relative;
      color:var(--dtpl-fg);
      background:var(--dtpl-paper);
      background-size:var(--dtpl-paper-size);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-timing{
      display:flex;flex-direction:column;gap:12px;
      background:
        linear-gradient(180deg,
          color-mix(in srgb,var(--dtpl-fg) 1.8%,transparent) 0%,
          color-mix(in srgb,var(--dtpl-fg) 0.6%,transparent) 100%);
      border:1px solid var(--dtpl-border);
      padding:18px 20px 16px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-timing-grid{
      display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-timing .dtpl-tok-hero-ratio{margin-top:-6px;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-timing .dtpl-hero-facts{margin-top:-2px;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub{
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum{
      display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum .dtpl-stat{padding:16px 18px 10px;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum .dtpl-stat + .dtpl-stat{border-left:1px solid var(--dtpl-border);}
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-list{
      border-top:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-row{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto auto auto;
      grid-template-areas:"name tokens share cost";
      align-items:baseline;gap:4px 16px;
      padding:10px 18px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-row + .dtpl-tok-sub-row{
      border-top:.5px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-name{
      grid-area:name;display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;
      min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-label{
      min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-extra{
      flex:none;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-tokens{
      grid-area:tokens;white-space:nowrap;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;
      font-variant-numeric:tabular-nums;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-share{
      grid-area:share;white-space:nowrap;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost{
      grid-area:cost;white-space:nowrap;justify-self:end;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
      font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="spend"]{color:var(--dtpl-fg);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="subscription"]{color:var(--dtpl-fg-2);font-weight:400;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="unpriced"],
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost[data-kind="none"]{color:var(--dtpl-fg-3);font-weight:400;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-note{
      display:flex;flex-wrap:wrap;gap:2px 6px;align-items:baseline;
      margin:0;padding:0 18px 14px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sub-note i{font-style:normal;color:var(--dtpl-fg-dim);padding:0 5px;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-scroll{
      flex:1 1 0;min-height:0;overflow-y:auto;
      position:relative;
      padding-bottom:calc(var(--dsh-composer-height,152px) + 16px);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-col{
      display:flex;flex-direction:column;gap:32px;
      width:100%;max-width:var(--dtpl-col-w);
      margin-inline:auto;
      box-sizing:border-box;
      padding:0 4px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-grip{
      position:absolute;top:0;bottom:0;z-index:1;
      width:min(64px,calc((100% - var(--dtpl-col-w)) / 2 - 24px));
      cursor:col-resize;
      touch-action:none;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-side="left"]{right:calc(50% + var(--dtpl-col-w) / 2 + 24px);}
    [data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-side="right"]{left:calc(50% + var(--dtpl-col-w) / 2 + 24px);}
    [data-plugin="dsh-tokbook"] .dtpl-tok-grip::after{
      content:"";position:absolute;top:0;bottom:0;width:2px;
      border-radius:var(--dtpl-radius);pointer-events:none;
      background:linear-gradient(to bottom,
        transparent calc(var(--dtpl-grip-y,50%) - 36px),
        var(--dtpl-fg-3) calc(var(--dtpl-grip-y,50%) - 8px),
        var(--dtpl-fg-3) calc(var(--dtpl-grip-y,50%) + 8px),
        transparent calc(var(--dtpl-grip-y,50%) + 36px));
      opacity:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-side="left"]::after{right:0;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-side="right"]::after{left:0;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-grip:hover::after,
    [data-plugin="dsh-tokbook"] .dtpl-tok-grip:focus-visible::after,
    [data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-dragging]::after{opacity:1;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-grip[data-dragging]{z-index:2;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-head{
      display:flex;flex-direction:column;gap:10px;
      --dtpl-tok-head-pad:32px;
      padding:28px var(--dtpl-tok-head-pad) 24px;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      box-shadow:var(--dtpl-metal);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-note{
      margin:-5px 0 10px;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      overflow-wrap:anywhere;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-head .dtpl-total-num{
      font-size:72px;line-height:76px;font-weight:700;letter-spacing:-.06em;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-head .dtpl-total-k{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.08em;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-foot{
      border:1px solid var(--dtpl-border);
      border-top:0;
      margin-top:4px;
      padding:16px 20px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-foot .dtpl-tok-note{margin:6px 0 0;}
    
    [data-plugin="dsh-tokbook"] .dtpl-tok-mix-band{
      margin:10px calc(var(--dtpl-tok-head-pad) * -1) -24px;
      padding:0 var(--dtpl-tok-head-pad);
      border-top:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-mix-band .dtpl-tok-note{
      display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 16px;
      margin:0;padding:14px 0 0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-mix-hit{white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-mix-hit b{
      font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
      font-variant-numeric:tabular-nums;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-tok-plot{
      --dtpl-slot-w:48px;
      display:flex;flex-direction:column;gap:24px;
      min-width:min(280px,100%);
      max-width:calc(var(--dtpl-slots,4) * 92px + 28px);
      overflow-x:auto;
      scrollbar-width:thin;
      scrollbar-color:color-mix(in srgb,var(--dtpl-fg) 30%,transparent) transparent;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-plot > *{
      box-sizing:border-box;
      min-width:calc(var(--dtpl-slots,4) * var(--dtpl-slot-w));
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-chart{position:relative;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-hover{
      position:absolute;z-index:1;pointer-events:none;
      display:flex;flex-direction:column;gap:5px;
      box-sizing:border-box;
      max-width:min(300px,100%);
      padding:8px 10px;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-card);
      box-shadow:var(--dtpl-metal);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-hover-basis{
      margin:0;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-hover-buckets{font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);}
    [data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-bars{height:80px;margin-top:22px;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-trend-axis{margin-top:-6px;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-panel{display:flex;flex-direction:column;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-panel-k{
      display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin:0;
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-panel-v,
    [data-plugin="dsh-tokbook"] .dtpl-tok-panel-k i{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);font-weight:400;
      font-style:normal;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-plot .dtpl-bar-fill{
      width:min(52%,48px);margin:0 auto;
      background:linear-gradient(180deg,
        color-mix(in srgb,var(--dtpl-fg) 52%,transparent) 0%,
        color-mix(in srgb,var(--dtpl-fg) 42%,transparent) 100%);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-swatch{
      flex:none;width:8px;height:8px;align-self:center;
      background-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-tok-turns{display:flex;flex-direction:column;gap:14px;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn{
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      box-shadow:0 1px 0 0 color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
      transition:box-shadow var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn:hover{
      box-shadow:0 2px 0 0 color-mix(in srgb,var(--dtpl-fg) 6%,transparent),
        0 8px 24px -12px color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn:has(.dtpl-tok-turn-head[aria-expanded="true"]){
      box-shadow:0 2px 0 0 color-mix(in srgb,var(--dtpl-fg) 6%,transparent),
        0 8px 24px -12px color-mix(in srgb,var(--dtpl-fg) 18%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn.is-loose{
      background:transparent;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn.is-loose .dtpl-tok-turn-k{
      font-weight:500;color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-head{
      display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 14px;
      width:100%;margin:0;padding:14px 18px;
      appearance:none;border:0;background:transparent;
      font:inherit;text-align:left;color:var(--dtpl-fg);cursor:pointer;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-head:hover{background:var(--dtpl-wash-hover);}
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-k{flex:none;font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-head .dtpl-hero-facts{
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-cue{
      flex:none;margin-left:auto;align-self:center;
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
      transition:transform var(--dtpl-dur-move) var(--dtpl-ease-move);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-head[aria-expanded="true"] .dtpl-tok-turn-cue{transform:rotate(180deg);}
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-preview{
      flex:1 1 100%;min-width:0;
      display:flex;flex-direction:column;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-ask,
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-reply{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-reply::before{content:"↳ ";color:var(--dtpl-fg-dim);}
    
    [data-plugin="dsh-tokbook"] .dtpl-tok-steps{
      display:grid;grid-template-rows:0fr;overflow:hidden;
      transition:grid-template-rows var(--dtpl-dur-move) var(--dtpl-ease-move);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-steps[data-open="true"]{grid-template-rows:1fr;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner{padding:0 18px;overflow:hidden;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner > .dtpl-row:first-child{margin-top:6px;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner > .dtpl-row:last-child{margin-bottom:16px;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-steps .dtpl-row + .dtpl-row{
      margin-top:24px;padding-top:8px;
      border-top:.5px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-step{
      position:relative;
      grid-template-columns:minmax(0,1fr) auto;
      grid-template-areas:"id cost" "bar bar" "read read";
      row-gap:10px;
      padding-left:12px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-step::before{
      content:"";position:absolute;left:0;top:1px;bottom:0;width:2px;
      background:var(--dtpl-fg-3);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-id{grid-area:id;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-cost{grid-area:cost;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-step > .dtpl-tok-step-read{grid-area:read;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-bar{
      display:block;min-width:0;grid-area:bar;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-bar{
      flex:1 1 100%;display:block;min-width:0;margin-top:6px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-id{
      display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-no{
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-time{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-model{
      min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-chip{
      flex:none;font-style:normal;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;
      padding:0 5px;
      border:1px solid var(--dtpl-border);
      color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-chip[data-kind="failure"]{border-color:var(--dtpl-err);color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost{
      display:flex;align-items:baseline;gap:7px;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost-k{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost-k i{
      font-style:normal;font-size:var(--dtpl-fs-micro);color:var(--dtpl-fg-3);margin-left:4px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cash-amt,
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-sub-amt,
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cost-na{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cash-amt{color:var(--dtpl-fg);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-sub-amt{color:var(--dtpl-fg-2);font-weight:400;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost .dtpl-cost-na{color:var(--dtpl-fg-3);font-weight:400;}
    
    [data-plugin="dsh-tokbook"] .dtpl-tok-step-read{
      display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:flex-start;
      gap:8px 18px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-metrics{
      display:grid;
      grid-template-columns:repeat(var(--dtpl-tok-cells,5),var(--dtpl-tok-cell-w));
      gap:0 10px;
      min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-tokens{
      display:grid;grid-template-columns:repeat(4,var(--dtpl-tok-cell-w));
      gap:0 10px;
      min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-metrics.is-flat{
      display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;
      flex:1 1 100%;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-metric{
      display:flex;flex-direction:column;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-metric-k{
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);white-space:nowrap;
      overflow:hidden;text-overflow:ellipsis;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-metric-v{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-untimed{
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg-3);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-metrics.is-flat .dtpl-tok-untimed.is-note{
      flex:1 1 100%;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar{
      display:flex;min-width:0;
      align-items:stretch;
      width:100%;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="step"],
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="turn"]{height:16px;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="hero"]{height:8px;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="turn"],
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar[data-tone="hero"]{
      --dtpl-tok-track:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
      background:var(--dtpl-tok-track);
      box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dtpl-fg) 16%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg{
      height:100%;flex:none;
      box-shadow:inset -1px 0 0 0 var(--dtpl-tok-track,color-mix(in srgb,var(--dtpl-fg) 10%,transparent));
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg:last-child{box-shadow:none;}
    
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="wait"],
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="wait"]{
      background:
        repeating-linear-gradient(90deg,
          color-mix(in srgb,var(--dtpl-fg) 66%,transparent) 0 1.5px,
          transparent 1.5px 4px),
        color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="generate"],
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="generate"]{background:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="tool"],
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="tool"]{
      background:
        repeating-linear-gradient(45deg,
          color-mix(in srgb,var(--dtpl-fg) 88%,transparent) 0 1.5px,
          transparent 1.5px 6px),
        color-mix(in srgb,var(--dtpl-fg) 72%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="model"],
    [data-plugin="dsh-tokbook"] .dtpl-tok-legend-key[data-kind="model"]{
      background:
        repeating-linear-gradient(90deg,
          var(--dtpl-fg) 0 1.5px,
          transparent 1.5px 5px),
        repeating-linear-gradient(45deg,
          var(--dtpl-fg) 0 1.5px,
          transparent 1.5px 5px),
        color-mix(in srgb,var(--dtpl-fg) 55%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="work"],
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="work"]{background:color-mix(in srgb,var(--dtpl-fg) 84%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-tok-bar-seg[data-kind="idle"],
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="idle"]{background:color-mix(in srgb,var(--dtpl-fg) 26%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-tok-reads{
      display:flex;flex-wrap:wrap;gap:2px 16px;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-hero-ratio{
      display:flex;flex-direction:column;gap:6px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-hero-ratio .dtpl-tok-reads{justify-content:space-between;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-turn-head > .dtpl-tok-reads{
      flex:1 1 100%;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-read{
      display:inline-flex;align-items:center;gap:5px;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-read b{
      font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
      font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark{
      flex:none;width:9px;height:10px;box-shadow:none;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-legend{
      display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px 10px;margin:0 0 10px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-legend-figure{
      display:flex;flex-direction:column;gap:4px;
      width:232px;flex:none;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-legend-keys{
      display:flex;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-legend-keys > span{
      flex-basis:0;
      min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-legend-model{
      display:inline-flex;align-items:center;gap:5px;color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-legend-key{
      display:inline-block;width:9px;height:12px;flex:none;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-legend-say{
      margin-left:auto;color:var(--dtpl-fg-3);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-tail{
      display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-top:10px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-block{display:block;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-sec-title{
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:700;letter-spacing:.02em;
      margin:0 0 14px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-grid{
      gap:0 16px;
      border-top:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-stat + .dtpl-stat{border-left:0;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-stat{
      padding:16px 18px 14px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-mix-band .dtpl-stat{
      padding:10px 18px 20px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-col .dtpl-stat:hover{
      background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
      border-left:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-sk{height:220px;}
    
    @media (prefers-reduced-motion:no-preference){
      [data-plugin="dsh-tokbook"] .dtpl-tok-col > *{
        animation:dtpl-rise var(--dtpl-dur-enter) var(--dtpl-ease-move) both;
        animation-delay:calc(var(--dtpl-tok-i,0) * 40ms);
      }
    }
    
    @media (max-width:640px){
      [data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum{grid-template-columns:minmax(0,1fr);}
      [data-plugin="dsh-tokbook"] .dtpl-tok-sub-sum .dtpl-stat + .dtpl-stat{border-left:0;border-top:1px solid var(--dtpl-border);}
      [data-plugin="dsh-tokbook"] .dtpl-tok-sub-row{
        grid-template-columns:minmax(0,1fr) auto;
        grid-template-areas:"name name" "tokens share" "cost cost";
      }
      [data-plugin="dsh-tokbook"] .dtpl-tok-sub-cost{justify-self:start;}
      [data-plugin="dsh-tokbook"] .dtpl-tok-tail{grid-template-columns:minmax(0,1fr);}
      [data-plugin="dsh-tokbook"] .dtpl-tok-hero-ratio .dtpl-tok-reads{justify-content:flex-start;}
      [data-plugin="dsh-tokbook"] .dtpl-tok-turn-head{padding-left:10px;padding-right:10px;}
      [data-plugin="dsh-tokbook"] .dtpl-tok-head{--dtpl-tok-head-pad:10px;}
      [data-plugin="dsh-tokbook"] .dtpl-tok-steps-inner{padding-left:10px;padding-right:10px;}
      [data-plugin="dsh-tokbook"] .dtpl-tok-step{
        grid-template-columns:minmax(0,1fr);
        grid-template-areas:"id" "cost" "bar" "read";
      }
      [data-plugin="dsh-tokbook"] .dtpl-tok-step-cost{justify-content:flex-start;}
      [data-plugin="dsh-tokbook"] .dtpl-tok-step-read{gap:10px 0;}
    }
    @media (prefers-reduced-motion:reduce){
      [data-plugin="dsh-tokbook"] .dtpl-tok-turn-cue{transition:none;}
      [data-plugin="dsh-tokbook"] .dtpl-tok-col > *{animation:none;}
    }
    `;
    
    // src/client/styles/quota.ts
    var CSS_QUOTA = `
    [data-plugin="dsh-tokbook"] .dtpl-quota-sec{display:flex;flex-direction:column;gap:16px;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-intro{
      margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh{
      display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-label{
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-seg{
      display:flex;align-self:flex-start;
      border-bottom:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt{
      position:relative;appearance:none;border:0;background:transparent;
      height:24px;padding:0 11px;
      font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:500;
      color:var(--dtpl-fg-2);white-space:nowrap;cursor:pointer;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt + .dtpl-quota-autorefresh-opt{border-left:.5px solid var(--dtpl-hairline);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt:hover{color:var(--dtpl-fg);background:var(--dtpl-wash-hover);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt.dtpl-quota-autorefresh-on{
      color:var(--dtpl-fg);font-weight:600;
      background:var(--dtpl-wash-on);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt.dtpl-quota-autorefresh-on::after{
      content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-state{
      margin-left:auto;color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-quota-cards{display:flex;flex-direction:column;gap:12px;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-card{
      padding:13px 15px 12px;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      box-shadow:
        var(--dtpl-sheen),
        var(--dtpl-metal),
        var(--dtpl-lift);
      transition:box-shadow var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-card:hover{
      box-shadow:
        var(--dtpl-sheen-hover),
        var(--dtpl-metal),
        var(--dtpl-lift-hover);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-head{
      display:flex;align-items:center;justify-content:space-between;gap:12px;
      margin-bottom:12px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-id{
      display:flex;align-items:center;gap:10px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-id-text{display:flex;flex-direction:column;gap:1px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-name{
      color:var(--dtpl-fg);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-sub{
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-head-side{
      display:flex;align-items:center;gap:8px;flex:none;
      min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-refresh{
      display:inline-flex;align-items:center;justify-content:center;
      width:28px;height:28px;padding:0;
      border:none;background:transparent;color:var(--dtpl-fg-2);
      cursor:pointer;transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-refresh:hover:not(:disabled){background:var(--dtpl-wash-hover);color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-refresh:disabled{opacity:.45;cursor:default;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim{
      display:inline-flex;align-items:center;justify-content:center;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{
      animation:dtpl-refresh-pop .35s cubic-bezier(.34,1.56,.64,1);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-ico{width:15px;height:15px;display:block;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-gauge{
      position:relative;flex:none;width:44px;height:44px;
      color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-idle{color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-word{
      font-size:var(--dtpl-fs-micro);line-height:1;font-weight:600;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-svg{width:44px;height:44px;display:block;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-track{
      fill:none;stroke:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
      stroke-width:4;stroke-linecap:round;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-fill{
      fill:none;stroke:currentColor;stroke-width:4;stroke-linecap:round;
      transform:rotate(-90deg);transform-origin:50% 50%;
      transition:stroke-dasharray var(--dtpl-dur-draw) var(--dtpl-ease-move);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-n{
      position:absolute;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:2px;
      color:inherit;font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-label);line-height:1;font-weight:700;
      font-variant-numeric:tabular-nums;white-space:nowrap;
      pointer-events:none;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-n i{
      font-style:normal;font-size:var(--dtpl-fs-micro);line-height:1;font-weight:600;
      color:var(--dtpl-fg-2);margin-left:.5px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-cap{
      font-size:var(--dtpl-fs-micro);line-height:1;font-weight:600;color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-msg{
      display:flex;flex-direction:column;align-items:flex-start;gap:2px;
      padding:10px 12px;margin:2px 0 6px;
      border:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-msg-err{
      border-color:color-mix(in srgb,var(--dtpl-err) 45%,transparent);
      background:color-mix(in srgb,var(--dtpl-err) 7%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-msg-title{margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-msg-err .dtpl-quota-msg-title{color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-msg-muted .dtpl-quota-msg-title{color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-msg-body{
      margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
      overflow-wrap:anywhere;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-msg .dtpl-retry{margin-top:6px;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-stale{
      margin:0 0 8px;padding:6px 10px;
      border:1px solid color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
      background:color-mix(in srgb,var(--dtpl-warn) 8%,transparent);
      color:var(--dtpl-warn-ink);
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-windows{display:flex;flex-direction:column;gap:12px;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-window{display:flex;flex-direction:column;gap:5px;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-window-line1{
      display:flex;align-items:baseline;justify-content:space-between;gap:12px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-window-label{
      color:var(--dtpl-fg);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-window-metric{
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-bar{
      display:block;width:100%;height:7px;
      background:color-mix(in srgb,var(--dtpl-fg) 12%,transparent);overflow:hidden;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill{
      display:block;position:relative;height:100%;
      transition:width var(--dtpl-dur-draw) var(--dtpl-ease-move),background-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill::before{
      content:"";position:absolute;left:0;right:0;top:0;height:1px;
      background:color-mix(in srgb,#fff 22%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-tone-ok{color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-tone-warn{color:var(--dtpl-warn-ink);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-tone-danger{color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-ok{background:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-warn{background:var(--dtpl-warn);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-danger{background:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-window-line2{
      display:flex;align-items:baseline;justify-content:space-between;gap:12px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-remaining{
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-window[data-tone="warn"] .dtpl-quota-remaining{color:var(--dtpl-warn-ink);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-window[data-tone="danger"] .dtpl-quota-remaining{color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-reset{
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-reset-limited{color:var(--dtpl-err);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-balance{display:flex;align-items:baseline;gap:8px;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-balance-v{
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg);font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);font-weight:600;
      font-variant-numeric:tabular-nums;letter-spacing:-.01em;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-balance-k{
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:500;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-balance-note{
      margin:6px 0 0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-sources{
      margin:8px 0 0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-stats{
      display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:0;
      margin-top:12px;
      border:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-stat{
      display:flex;flex-direction:column;gap:2px;min-width:0;
      padding:9px 12px 10px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-stat + .dtpl-quota-stat{border-left:1px solid var(--dtpl-border);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-stat-v{
      display:flex;align-items:baseline;gap:6px;
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-stat-warn{
      font-family:var(--dtpl-mono);
      font-style:normal;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);font-weight:600;color:var(--dtpl-err);
      font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-stat-k{color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);}
    [data-plugin="dsh-tokbook"] .dtpl-quota-updated{
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:400;
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-sk-body{display:flex;flex-direction:column;gap:8px;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-sk-card{height:150px;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-sk-line{height:14px;width:55%;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-sk-line-short{width:35%;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-sk-bar{height:7px;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-note{
      margin:10px 0 0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    
    @media (prefers-reduced-motion:no-preference){
      [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-fill{animation:dtpl-draw var(--dtpl-dur-draw) var(--dtpl-ease-move) both;}
      [data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill{animation:dtpl-width-in var(--dtpl-dur-draw) var(--dtpl-ease-move) both;}
    }
    `;
    
    // src/client/styles/pricing.ts
    var CSS_PRICING = `
    [data-plugin="dsh-tokbook"] .dtpl-price-sec{display:flex;flex-direction:column;gap:14px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-price-cal{
      display:flex;flex-direction:column;gap:8px;
      margin-top:2px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal[data-dirty="true"]{
      box-shadow:inset 2px 0 0 var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-head{
      display:flex;align-items:stretch;gap:6px;flex-wrap:wrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle{
      appearance:none;box-sizing:border-box;
      display:flex;align-items:center;gap:8px;
      flex:1 1 260px;min-width:0;min-height:34px;
      padding:6px 10px;
      border:1px solid var(--dtpl-border);border-radius:var(--dtpl-radius);
      background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
      color:var(--dtpl-fg);font:inherit;cursor:pointer;text-align:left;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle:hover{
      background:var(--dtpl-wash-hover);
      border-color:color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle:active{
      background:color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-caret{
      flex:none;width:0;height:0;
      border-left:5px solid currentColor;
      border-top:4px solid transparent;border-bottom:4px solid transparent;
      transition:transform var(--dtpl-dur-move) var(--dtpl-ease-move);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal[data-open="true"] .dtpl-price-cal-caret{
      transform:rotate(90deg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-title{flex:none;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-sum{
      min-width:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-warn{flex:none;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-warn-ink);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-auto{
      flex:none;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
      border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
      padding:0 4px;border-radius:var(--dtpl-radius);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-hint{
      flex:none;margin-left:auto;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-fix{
      appearance:none;box-sizing:border-box;flex:none;
      display:inline-flex;align-items:center;justify-content:center;gap:6px;
      min-height:34px;padding:2px 10px;
      border:1px solid color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
      border-radius:var(--dtpl-radius);
      background:color-mix(in srgb,var(--dtpl-warn) 12%,transparent);
      color:var(--dtpl-warn-ink);
      font:inherit;font-size:var(--dtpl-fs-label);cursor:pointer;white-space:nowrap;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-fix:hover{
      border-color:var(--dtpl-warn-ink);
      background:color-mix(in srgb,var(--dtpl-warn) 20%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-auto-line{
      margin:0;display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;min-width:0;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      overflow-wrap:anywhere;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-auto-line[data-tone="warn"]{color:var(--dtpl-warn-ink);}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-auto-line[data-tone="err"]{color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-body{display:flex;flex-direction:column;gap:6px;margin-top:2px;}[data-plugin="dsh-tokbook"] .dtpl-price-cal-note{margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);overflow-wrap:anywhere;}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-year{display:flex;flex-direction:column;gap:4px;}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-year + .dtpl-price-cal-year{
      margin-top:4px;padding-top:8px;border-top:.5px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-year-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-year-num{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-year-sum{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-year-head .dtpl-price-ghost{margin-left:auto;}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-date::-webkit-calendar-picker-indicator{display:none;}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date{
      width:118px;text-align:left;
      border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);padding:0 6px;
      transition:border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date:hover{
      border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date:focus{border-color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday[data-bad="true"] .dtpl-price-cal-date{border-color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-tilde{flex:none;font-size:var(--dtpl-fs-label);color:var(--dtpl-fg-dim);}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday-tail{
      margin-left:auto;display:inline-flex;align-items:center;gap:8px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-days{
      min-width:48px;text-align:right;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-days[data-kind="partial"]{font-family:inherit;}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday .dtpl-price-cell-err{
      flex:1 1 100%;text-align:left;white-space:normal;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-add{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-year-k{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-newyear{
      width:72px;text-align:center;
      border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);padding:0 6px;
      transition:border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-newyear:hover{
      border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-newyear:focus{border-color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-newyear[aria-invalid="true"]{border-color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-price-cal-newyear-err{
      flex:1 1 auto;min-width:0;
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-err);overflow-wrap:anywhere;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-pick{
      display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
      column-gap:16px;row-gap:8px;align-items:start;
      border-bottom:1px solid var(--dtpl-border);padding-bottom:10px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-pick-row{
      display:flex;flex-direction:column;gap:3px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-pick-k{font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-pick .dtpl-price-pick-sel{
      width:100%;height:36px;font-size:var(--dtpl-fs-lead);font-weight:500;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-pick > .dtpl-price-pick-fxrow{grid-column:1;}
    [data-plugin="dsh-tokbook"] .dtpl-price-pick-state{grid-column:2;}
    [data-plugin="dsh-tokbook"] .dtpl-price-state-row{
      display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0;min-height:24px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-fx{
      display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-fx-eq,
    [data-plugin="dsh-tokbook"] .dtpl-price-fx-unit{font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in{
      width:80px;flex:none;text-align:center;
      border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);padding:0 6px;
      font-size:var(--dtpl-fs-lead);
      transition:border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in:hover{
      border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in:focus{border-color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in[aria-invalid="true"]{border-color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-price-fx-note{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-fx-err{
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-err);overflow-wrap:anywhere;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-detail{
      display:flex;flex-direction:column;gap:12px;
      padding:12px 14px 14px;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      box-shadow:var(--dtpl-metal);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-detail[data-dirty="true"]{
      box-shadow:
        inset 2px 0 0 var(--dtpl-fg),
        var(--dtpl-metal);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-live{
      display:flex;flex-direction:column;gap:6px;min-width:0;
      padding:10px 12px;
      background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-head{
      display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-k{
      display:inline-flex;align-items:center;gap:8px;
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-k::before{
      content:"";flex:none;width:7px;height:13px;
      background:var(--dtpl-brand);
      box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-unit{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-live-cells{
      display:flex;align-items:baseline;gap:24px;flex-wrap:wrap;row-gap:8px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-cell{display:flex;flex-direction:column;gap:1px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-price-live-label{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-live-v{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);font-weight:600;color:var(--dtpl-fg);
      font-variant-numeric:tabular-nums;letter-spacing:-.02em;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-cell[data-bad="true"] .dtpl-price-live-v{color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-price-live-none{
      margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-note{
      margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-detail-head{
      display:flex;align-items:center;gap:10px;flex-wrap:wrap;row-gap:4px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-detail-id{
      display:flex;align-items:baseline;gap:8px;flex:1 1 auto;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-name{
      flex:0 1 auto;min-width:0;
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-name[data-exact="true"]{
      font-family:var(--dtpl-mono);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-exact{
      flex:0 1 auto;min-width:0;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-reqs{
      flex:none;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-unpriced{
      flex:none;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-warn-ink);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-route-facts{
      flex:none;display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-head-k{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-sec{
      --dtpl-cell-pad-x:7px;
      --dtpl-rate-w:88px;
      --dtpl-rate-gap:8px;
      --dtpl-days-w:92px;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-issue{
      margin:0;padding:2px 10px 6px 10px;
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-err);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-switch{
      flex:none;display:flex;
      border-bottom:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-switch button{
      position:relative;appearance:none;border:0;background:transparent;
      height:24px;padding:0 11px;
      color:var(--dtpl-fg);font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:400;
      white-space:nowrap;cursor:pointer;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-switch button + button{border-left:.5px solid var(--dtpl-hairline);}
    [data-plugin="dsh-tokbook"] .dtpl-price-switch button:hover{background:var(--dtpl-wash-hover);}
    [data-plugin="dsh-tokbook"] .dtpl-price-switch button[aria-pressed="true"]{
      color:var(--dtpl-fg);font-weight:600;
      background:var(--dtpl-wash-on);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-switch button[aria-pressed="true"]::after{
      content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-currency{
      flex:none;display:inline-flex;align-items:center;gap:6px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-currency .dtpl-price-switch button:disabled{opacity:.45;cursor:not-allowed;}
    [data-plugin="dsh-tokbook"] .dtpl-price-currency .dtpl-price-switch button:disabled:hover{background:transparent;}
    
    [data-plugin="dsh-tokbook"] .dtpl-price-tbl{
      display:flex;flex-direction:column;min-width:0;
      border-top:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cols,
    [data-plugin="dsh-tokbook"] .dtpl-price-row{
      display:grid;
      grid-template-columns:minmax(0,1fr) repeat(4,var(--dtpl-rate-w));
      column-gap:var(--dtpl-rate-gap);align-items:start;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cols{
      padding:8px 0 4px;
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cols-n{text-align:right;padding-right:var(--dtpl-cell-pad-x);}
    [data-plugin="dsh-tokbook"] .dtpl-price-cols-k{white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-rows{display:flex;flex-direction:column;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-price-row{
      padding:6px 0;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-row + .dtpl-price-row{border-top:1px solid var(--dtpl-hairline);}
    [data-plugin="dsh-tokbook"] .dtpl-price-row:hover{background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-price-row[data-inert="true"]{opacity:.75;}
    [data-plugin="dsh-tokbook"] .dtpl-price-scope{display:flex;flex-direction:column;gap:3px;min-width:0;padding-right:8px;}
    [data-plugin="dsh-tokbook"] .dtpl-price-scope-k{
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-scope-sub{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-scope-ctl{
      display:inline-flex;align-items:center;gap:2px;flex-wrap:wrap;min-width:0;
      font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-scope-dash{
      flex:none;margin:0 2px;color:var(--dtpl-fg-3);font-size:var(--dtpl-fs-label);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-scope-foot{
      display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-rowacts{
      display:inline-flex;align-items:center;gap:2px;flex:none;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cell{display:flex;flex-direction:column;gap:1px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-price-cell-k{
      display:none;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-input{
      width:100%;box-sizing:border-box;
      height:28px;padding:0 calc(var(--dtpl-cell-pad-x) - 1px);
      border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
      border-radius:var(--dtpl-radius);
      background:transparent;color:var(--dtpl-fg);
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:500;
      font-variant-numeric:tabular-nums;text-align:right;
      transition:border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint),background-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-input:hover{
      border-color:color-mix(in srgb,var(--dtpl-fg) 42%,transparent);
      background:var(--dtpl-wash-hover);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-input::placeholder{color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-input:focus{
      outline:none;border-color:var(--dtpl-fg);
      background:var(--dtpl-wash-on);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cell .dtpl-price-input:hover{
      border-color:color-mix(in srgb,var(--dtpl-fg) 42%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cell[data-state="bad"] .dtpl-price-input{
      color:var(--dtpl-err);border-color:var(--dtpl-err);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-cell-err{
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-err);text-align:right;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-add{
      appearance:none;background:transparent;
      display:inline-flex;align-items:center;justify-content:center;
      min-height:24px;padding:2px 8px;
      border:0;border-radius:var(--dtpl-radius);
      color:var(--dtpl-fg);font:inherit;font-size:var(--dtpl-fs-label);letter-spacing:.08em;cursor:pointer;white-space:nowrap;
      transition:background-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-add:hover{
      background:var(--dtpl-wash-hover);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-add-ghost{
      appearance:none;box-sizing:border-box;
      display:flex;align-items:center;justify-content:flex-start;gap:6px;
      min-height:30px;padding:4px 8px;
      border:1px solid var(--dtpl-hairline);border-radius:var(--dtpl-radius);
      background:transparent;color:var(--dtpl-fg);
      font:inherit;font-size:var(--dtpl-fs-label);letter-spacing:.08em;cursor:pointer;white-space:nowrap;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-add-plus{
      flex:none;width:12px;text-align:center;letter-spacing:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-add-ghost:not(:disabled):hover{
      border-color:color-mix(in srgb,var(--dtpl-fg) 30%,transparent);
      background:var(--dtpl-wash-hover);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-add-ghost:not(:disabled):active{
      border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
      background:color-mix(in srgb,var(--dtpl-fg) 11%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-add-ghost:disabled{opacity:.45;cursor:not-allowed;}
    [data-plugin="dsh-tokbook"] .dtpl-price-ghost{
      appearance:none;
      border:0;border-radius:var(--dtpl-radius);
      background:transparent;box-sizing:border-box;
      display:inline-flex;align-items:center;
      height:24px;padding:0 6px;
      color:var(--dtpl-fg-2);font:inherit;font-size:var(--dtpl-fs-label);cursor:pointer;
      transition:color var(--dtpl-dur-quick) var(--dtpl-ease-tint),background-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-ghost:hover{
      color:var(--dtpl-fg);
      background:var(--dtpl-wash-hover);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-ghost:active{
      background:color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger:hover{color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger[data-confirm="true"]{
      color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-addrow{
      display:grid;grid-template-columns:minmax(0,1fr) repeat(4,var(--dtpl-rate-w));
      column-gap:var(--dtpl-rate-gap);min-width:0;margin-top:2px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-add-slot{grid-column:1;min-width:0;justify-self:start;}
    
    [data-plugin="dsh-tokbook"] .dtpl-price-day{
      display:flex;flex-direction:column;gap:3px;min-width:0;
      padding-top:8px;border-top:1px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-day-row{
      display:grid;grid-template-columns:minmax(0,168px) minmax(0,1fr);
      align-items:center;column-gap:12px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-day-k{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-day-cells{
      display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:1px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-day-cell{
      height:9px;
      background:color-mix(in srgb,var(--dtpl-fg) 12%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-day-cell[data-on="base"]{
      background:color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-day-cell[data-on="slot"]{background:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-price-day-axis{
      display:flex;justify-content:space-between;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
      font-variant-numeric:tabular-nums;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-calarm{
      display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
      padding:6px 8px;
      background:var(--dtpl-panel-bg);
      border:1px solid var(--dtpl-border);
      box-shadow:inset 3px 0 0 var(--dtpl-warn);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calarm-text{
      flex:1 1 auto;min-width:0;margin:0;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg);overflow-wrap:anywhere;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calarm-act{
      appearance:none;box-sizing:border-box;flex:none;
      display:inline-flex;align-items:center;gap:6px;
      min-height:26px;padding:2px 10px;
      border:1px solid var(--dtpl-border);
      border-radius:var(--dtpl-radius);
      background:transparent;
      color:var(--dtpl-fg);
      font:inherit;font-size:var(--dtpl-fs-label);cursor:pointer;white-space:nowrap;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calarm-act:hover{
      border-color:color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
      background:var(--dtpl-wash-hover);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-select{
      appearance:none;height:26px;box-sizing:border-box;padding:0 16px 0 6px;
      border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
      border-radius:var(--dtpl-radius);
      background-color:transparent;color:var(--dtpl-fg);
      font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);cursor:pointer;
      background-image:linear-gradient(45deg,transparent 50%,var(--dtpl-fg-2) 50%),
        linear-gradient(135deg,var(--dtpl-fg-2) 50%,transparent 50%);
      background-position:calc(100% - 8px) 11px,calc(100% - 4px) 11px;
      background-size:4px 4px,4px 4px;background-repeat:no-repeat;
      font-variant-numeric:tabular-nums;
      transition:border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint),background-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-select:hover{
      border-color:color-mix(in srgb,var(--dtpl-fg) 42%,transparent);
      background-color:var(--dtpl-wash-hover);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-select:focus{
      outline:none;border-color:var(--dtpl-fg);
      background-color:var(--dtpl-wash-on);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-select option{
      background:var(--dtpl-card);color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-select-days{width:var(--dtpl-days-w);}
    [data-plugin="dsh-tokbook"] .dtpl-price-select-hour{width:68px;font-family:var(--dtpl-mono);}
    [data-plugin="dsh-tokbook"] .dtpl-price-note{margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
    
    [data-plugin="dsh-tokbook"] .dtpl-price-state{
      max-width:100%;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);overflow-wrap:anywhere;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-state.is-saved{color:var(--dtpl-ok);}
    [data-plugin="dsh-tokbook"] .dtpl-price-state.is-saving{color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-state.is-invalid{color:var(--dtpl-warn-ink);}
    [data-plugin="dsh-tokbook"] .dtpl-price-state.is-error{color:var(--dtpl-err);font-weight:600;}
    
    [data-plugin="dsh-tokbook"] .dtpl-price-actions{
      display:flex;align-items:center;gap:8px 14px;flex-wrap:wrap;min-width:0;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-actions-fill{
      flex:1 1 auto;min-width:0;display:inline-flex;align-items:baseline;gap:4px;flex-wrap:wrap;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-actions-link{
      appearance:none;border:0;background:transparent;
      display:inline-flex;align-items:center;flex:none;
      min-height:24px;padding:0 2px;
      color:var(--dtpl-fg);font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      text-decoration:underline;text-underline-offset:3px;
      text-decoration-color:color-mix(in srgb,currentColor 40%,transparent);
      cursor:pointer;white-space:nowrap;
      transition:text-decoration-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-actions-link:not(:disabled):hover{
      text-decoration-color:currentColor;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-actions-link:disabled{opacity:.45;cursor:not-allowed;text-decoration:none;}
    
    [data-plugin="dsh-tokbook"] .dtpl-price-tool{
      appearance:none;box-sizing:border-box;
      display:inline-flex;align-items:center;justify-content:center;gap:6px;
      flex:none;min-height:30px;padding:4px 12px;
      border:1px solid var(--dtpl-border);border-radius:var(--dtpl-radius);
      background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
      color:var(--dtpl-fg);font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      cursor:pointer;white-space:nowrap;
      transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tool:not(:disabled):hover{
      border-color:color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
      background:var(--dtpl-wash-hover);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tool:not(:disabled):active{
      background:color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tool:focus-visible{
      outline:none;border-color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tool:disabled{opacity:.45;cursor:not-allowed;}
    
    [data-plugin="dsh-tokbook"] .dtpl-price-actions-note{
      min-width:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      color:var(--dtpl-fg-2);overflow-wrap:anywhere;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-actions-note.is-warn{color:var(--dtpl-warn-ink);}
    [data-plugin="dsh-tokbook"] .dtpl-price-actions-note.is-err{color:var(--dtpl-err);}
    
    [data-plugin="dsh-tokbook"] .dtpl-price-sk-pick{height:78px;}
    [data-plugin="dsh-tokbook"] .dtpl-price-sk-open{height:214px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-price-empty-act{margin-top:12px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup{
      margin:8px 0 0;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      padding:10px 12px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-head{
      display:flex;align-items:center;gap:8px;flex-wrap:wrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-k{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-input{
      flex:1 1 220px;min-width:0;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
      border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
      padding:0 6px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-input:focus{outline:none;border-color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-list{list-style:none;margin:8px 0 0;padding:0;}
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-item{
      display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center;
      padding:6px 0;border-top:1px solid color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-item.is-exact{background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-id{
      display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-provider{color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-slash{color:var(--dtpl-fg-3);}
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-name{
      grid-column:1;margin:2px 0 0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-cost{
      grid-column:2;font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg);
      white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-badge{
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
      border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
      padding:0 4px;border-radius:var(--dtpl-radius);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-empty{
      margin:8px 0 0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-empty .dtpl-price-ghost{margin-left:4px;}
    [data-plugin="dsh-tokbook"] .dtpl-price-lookup-note{
      margin:6px 0 0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-warn-ink);
    }
    `;
    
    // src/client/styles/shared.ts
    var CSS_SHARED = `
    [data-plugin="dsh-tokbook"] .dtpl-sr{
      position:absolute;width:1px;height:1px;padding:0;margin:-1px;
      overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-body ::selection{
      background:color-mix(in srgb,var(--dtpl-brand) 22%,transparent);
    }
    
    @media (max-width:640px){
      [data-plugin="dsh-tokbook"].dtpl-overlay{padding:0;align-items:flex-end;}
      [data-plugin="dsh-tokbook"] .dtpl-card{
        width:100%;height:min(94dvh,94vh);
        box-shadow:var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.28)),
          inset 0 0 0 1px var(--dtpl-border);
      }
      [data-plugin="dsh-tokbook"] .dtpl-head{padding:14px 16px 10px;}
      [data-plugin="dsh-tokbook"] .dtpl-tabs{padding:0 16px;}
      [data-plugin="dsh-tokbook"] .dtpl-tabs{overflow-x:auto;scrollbar-width:none;}
      [data-plugin="dsh-tokbook"] .dtpl-tabs::-webkit-scrollbar{display:none;}
      [data-plugin="dsh-tokbook"] .dtpl-tab{flex:0 0 auto;}
      [data-plugin="dsh-tokbook"] .dtpl-body{padding:12px 16px 14px;}
      [data-plugin="dsh-tokbook"] .dtpl-foot{padding:10px 16px 12px;}
      [data-plugin="dsh-tokbook"] .dtpl-hero-top{flex-direction:column;align-items:flex-start;gap:8px;}
      [data-plugin="dsh-tokbook"] .dtpl-hero-facts{flex:1 1 auto;gap:4px 10px;}
      [data-plugin="dsh-tokbook"] .dtpl-hero-facts i{display:none;}
      [data-plugin="dsh-tokbook"] .dtpl-grid,
      [data-plugin="dsh-tokbook"] .dtpl-grid-3{grid-template-columns:repeat(2,minmax(0,1fr));}
      [data-plugin="dsh-tokbook"] .dtpl-stat:nth-child(odd){border-left:0;}
      [data-plugin="dsh-tokbook"] .dtpl-stat:nth-child(n+3){border-top:1px solid var(--dtpl-border);}
      [data-plugin="dsh-tokbook"] .dtpl-bar-label:not(.is-peak){display:none;}
      [data-plugin="dsh-tokbook"] .dtpl-trend-axis span:not(:nth-child(4n+1)):not(.is-peak){visibility:hidden;}
      [data-plugin="dsh-tokbook"] .dtpl-trend-axis span:has(+ .is-peak){visibility:hidden;}
      [data-plugin="dsh-tokbook"] .dtpl-bd-cols{display:none;}
      [data-plugin="dsh-tokbook"] .dtpl-bd-cols,
      [data-plugin="dsh-tokbook"] .dtpl-row{grid-template-columns:minmax(0,1fr);}
      [data-plugin="dsh-tokbook"] .dtpl-model-nums{
        flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:12px;
        margin-top:5px;
      }
      [data-plugin="dsh-tokbook"] .dtpl-val{margin-right:auto;}
      [data-plugin="dsh-tokbook"] .dtpl-bd-tab{
        min-height:44px;padding:13px 16px;
      }
      [data-plugin="dsh-tokbook"] .dtpl-close{
        width:44px;height:44px;
      }
    
      [data-plugin="dsh-tokbook"] .dtpl-doc-facts{grid-template-columns:1fr;}
      [data-plugin="dsh-tokbook"] .dtpl-doc-buckets{grid-template-columns:1fr;}
      [data-plugin="dsh-tokbook"] .dtpl-doc-gap{grid-template-columns:1fr;}
    
      [data-plugin="dsh-tokbook"] .dtpl-quota-stats{grid-template-columns:1fr;}
      [data-plugin="dsh-tokbook"] .dtpl-quota-stat + .dtpl-quota-stat{
        border-left:0;border-top:1px solid var(--dtpl-border);
      }
    
      [data-plugin="dsh-tokbook"] .dtpl-provider-head{
        grid-template-columns:minmax(0,1fr);row-gap:8px;
      }
      [data-plugin="dsh-tokbook"] .dtpl-provider-nums{align-items:flex-start;}
      [data-plugin="dsh-tokbook"] .dtpl-provider-cost{align-items:flex-start;}
    
      [data-plugin="dsh-tokbook"] .dtpl-price-pick{grid-template-columns:minmax(0,1fr);column-gap:0;}
      [data-plugin="dsh-tokbook"] .dtpl-price-pick > .dtpl-price-pick-fxrow,
      [data-plugin="dsh-tokbook"] .dtpl-price-pick-state{grid-column:1;}
      [data-plugin="dsh-tokbook"] .dtpl-price-pick-state[data-quiet="true"]{display:none;}
      [data-plugin="dsh-tokbook"] .dtpl-price-input{text-align:left;}
      [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cols,
      [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-row{
        grid-template-columns:repeat(2,minmax(0,1fr));
        row-gap:8px;
      }
      [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cols{display:none;}
      [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-scope{grid-column:1 / -1;padding-right:0;}
      [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-addrow{grid-template-columns:minmax(0,1fr);}
      [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-add-slot{grid-column:1 / -1;justify-self:stretch;}
      [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cell-k{display:block;}
      [data-plugin="dsh-tokbook"] .dtpl-price-detail .dtpl-price-cell-k{
        text-align:left;padding-left:var(--dtpl-cell-pad-x);padding-right:var(--dtpl-cell-pad-x);
      }
      [data-plugin="dsh-tokbook"] .dtpl-price-day-row{grid-template-columns:minmax(0,88px) minmax(0,1fr);column-gap:8px;}
      [data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date{width:100px;font-size:var(--dtpl-fs-body);}
      [data-plugin="dsh-tokbook"] .dtpl-price-cal-days{min-width:40px;}
    }
    
    @media (prefers-reduced-motion:no-preference){
      [data-plugin="dsh-tokbook"].dtpl-overlay{animation:dtpl-fade var(--dtpl-dur-enter) var(--dtpl-ease-move);}
      [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-pop var(--dtpl-dur-move) var(--dtpl-ease-move);}
      [data-plugin="dsh-tokbook"] .dtpl-bar-fill{transform-origin:bottom;}
      [data-plugin="dsh-tokbook"] .dtpl-bars.is-anim .dtpl-bar-fill{animation:dtpl-bar-grow var(--dtpl-dur-enter) var(--dtpl-ease-move) both;animation-delay:calc((var(--dtpl-offset,0) + var(--dtpl-i,0)) * 12ms);}
      [data-plugin="dsh-tokbook"] .dtpl-bars.is-anim .dtpl-bar.is-zero::after{animation:dtpl-fade var(--dtpl-dur-enter) var(--dtpl-ease-move) both;animation-delay:calc((var(--dtpl-offset,0) + var(--dtpl-i,0)) * 12ms);}
      [data-plugin="dsh-tokbook"] .dtpl-bar-fill{transition:height var(--dtpl-dur-move) var(--dtpl-ease-move),background-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);}
      [data-plugin="dsh-tokbook"] .dtpl-bar-label{transition:bottom var(--dtpl-dur-move) var(--dtpl-ease-move),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);}
      [data-plugin="dsh-tokbook"] .dtpl-body > *{animation:dtpl-rise var(--dtpl-dur-enter) var(--dtpl-ease-move) both;}
      [data-plugin="dsh-tokbook"] .dtpl-hero > *{animation:dtpl-rise var(--dtpl-dur-enter) var(--dtpl-ease-move) both;animation-delay:.06s;}
      [data-plugin="dsh-tokbook"] .dtpl-share-ring-arc{animation:dtpl-draw var(--dtpl-dur-draw) var(--dtpl-ease-move) both;}
    }
    @media (prefers-reduced-motion:no-preference) and (max-width:640px){
      [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-sheet var(--dtpl-dur-move) var(--dtpl-ease-move);}
    }
    @keyframes dtpl-fade{from{opacity:0}}
    @keyframes dtpl-rise{from{opacity:0;transform:translateY(6px)}}
    @keyframes dtpl-bar-grow{from{transform:scaleY(0)}}
    @keyframes dtpl-draw{from{stroke-dashoffset:var(--dtpl-arc,0)}}
    @keyframes dtpl-width-in{from{width:0}}
    @keyframes dtpl-pop{from{opacity:0;transform:translateY(8px) scale(.96)}}
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
      [data-plugin="dsh-tokbook"] .dtpl-bars.is-anim .dtpl-bar-fill,
      [data-plugin="dsh-tokbook"] .dtpl-bars.is-anim .dtpl-bar.is-zero::after,
      [data-plugin="dsh-tokbook"] .dtpl-bar-fill,
      [data-plugin="dsh-tokbook"] .dtpl-bar-label,
      [data-plugin="dsh-tokbook"] .dtpl-body > *,
      [data-plugin="dsh-tokbook"] .dtpl-share-ring-arc,
      [data-plugin="dsh-tokbook"] .dtpl-sk,
      [data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot,
      [data-plugin="dsh-tokbook"] .dtpl-spin,
      [data-plugin="dsh-tokbook"] .dtpl-price-add-ghost,
      [data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill,
      [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-fill,
      [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{animation:none;transition:none;}
    }
    
    [data-plugin="dsh-tokbook"] button:not(:disabled):active{transform:translateY(1px);}
    `;
    
    // src/client/styles/device.ts
    var D = '[data-dtpl-device][data-plugin="dsh-tokbook"]';
    var CSS_DEVICE = `
    ${D}.dtpl-overlay{background:var(--dtpl-device-mask);}
    
    ${D} .dtpl-card{
      box-shadow:
        inset 0 0 0 1px var(--dtpl-seam),
        0 0 0 12px var(--dtpl-casing),
        0 0 0 13px var(--dtpl-case-edge),
        0 28px 72px -8px var(--dtpl-case-shadow);
    }
    ${D} .dtpl-card::before,
    ${D} .dtpl-card::after{display:none;}
    
    ${D} .dtpl-head{
      background:var(--dtpl-casing);color:var(--dtpl-casing-ink);
      box-shadow:inset 0 -1px 0 var(--dtpl-seam);
    }
    ${D} .dtpl-title>span:last-child{
      background:var(--dtpl-brand);color:var(--dtpl-on-brand);
      padding:2px 7px;box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
    }
    ${D} .dtpl-title-ico-chip{background:var(--dtpl-casing-ink);color:var(--dtpl-brand);}
    ${D} .dtpl-close{color:var(--dtpl-casing-ink-2);}
    ${D} .dtpl-close:hover{background:var(--dtpl-casing-hover);color:var(--dtpl-casing-ink);}
    
    ${D} .dtpl-foot{
      background:var(--dtpl-casing);
      border-top:1px solid var(--dtpl-seam);
    }
    ${D} .dtpl-foot .dtpl-sync{color:var(--dtpl-casing-ink-2);}
    ${D} .dtpl-foot .dtpl-sync-running{color:var(--dtpl-casing-ink);}
    ${D} .dtpl-foot .dtpl-sync-error{color:var(--dtpl-casing-ink);}
    ${D} .dtpl-foot .dtpl-sync-error .dtpl-sync-dot{background:var(--dtpl-err);}
    ${D} .dtpl-foot .dtpl-foot-latest{color:var(--dtpl-casing-ink-2);}
    ${D} .dtpl-rescan{border-color:var(--dtpl-casing-line);color:var(--dtpl-casing-ink);}
    ${D} .dtpl-rescan:hover:not(:disabled){
      background:var(--dtpl-casing-hover);border-color:var(--dtpl-casing-line);
    }
    
    ${D} .dtpl-body{scrollbar-color:var(--dtpl-scrollbar) transparent;}
    ${D} .dtpl-body::-webkit-scrollbar-thumb{background-color:var(--dtpl-scrollbar);}
    ${D} .dtpl-body::-webkit-scrollbar-thumb:hover{background-color:var(--dtpl-scrollbar-hover);}
    `;
    
    // src/client/styles.ts
    var CSS = [
      CSS_TOKENS,
      CSS_FOOTER,
      CSS_OVERLAY,
      CSS_LEDGER,
      CSS_METHOD,
      CSS_PROVIDER,
      CSS_SESSION,
      CSS_QUOTA,
      CSS_PRICING,
      CSS_SHARED,
      CSS_DEVICE
    ].join("");
    var active = false;
    function injectStyles() {
      if (active) return () => {
      };
      active = true;
      const style = document.createElement("style");
      style.textContent = CSS;
      document.head.appendChild(style);
      return () => {
        style.remove();
        active = false;
      };
    }
    
    // src/client/FooterButton.tsx
    var import_react = require("react");
    
    // src/client/icons.tsx
    var import_jsx_runtime = require("react/jsx-runtime");
    function UsageGlyph({ className }) {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "svg",
        {
          className,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          focusable: "false",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 3v18h18" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18 17V9" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13 17V5" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 17v-3" })
          ]
        }
      );
    }
    function CloseGlyph({ className }) {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "svg",
        {
          className,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          focusable: "false",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18 6 6 18" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m6 6 12 12" })
          ]
        }
      );
    }
    function RefreshGlyph({ className }) {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "svg",
        {
          className,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          focusable: "false",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18 9a8 8 0 1 0 2 5.3" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18 2v4h-4" })
          ]
        }
      );
    }
    
    // src/client/FooterButton.tsx
    var import_jsx_runtime2 = require("react/jsx-runtime");
    function FooterButton({ wide, view }) {
      const { open, quotaAlert } = (0, import_react.useSyncExternalStore)(view.subscribe, view.getSnapshot);
      const rail = !wide;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          type: "button",
          className: `dtpl-footer${rail ? " dtpl-rail" : ""}`,
          "data-plugin": "dsh-tokbook",
          "aria-pressed": open,
          "aria-label": quotaAlert ? "词元账本（订阅额度告急）" : "词元账本",
          title: quotaAlert ? "词元账本 · 订阅额度告急" : "词元账本",
          onClick: () => view.setOpen(!open),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dtpl-foot-ico-wrap", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(UsageGlyph, { className: "dtpl-foot-ico" }),
              quotaAlert && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "i",
                {
                  className: "dtpl-foot-alert",
                  role: "img",
                  "aria-label": "订阅额度告急",
                  title: "最近一次查询的订阅额度已接近或超过窗口上限"
                }
              )
            ] }),
            wide && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dtpl-foot-label", children: "词元账本" })
          ]
        }
      );
    }
    
    // src/client/LedgerOverlay.tsx
    var import_react7 = require("react");
    
    // src/client/pricing/PricingPanel.tsx
    var import_react3 = require("react");
    
    // src/models-dev.ts
    function normalizeModelId(modelId) {
      const afterSlash = modelId.slice(modelId.lastIndexOf("/") + 1);
      const beforeColon = afterSlash.split(":")[0] ?? "";
      let normalized = beforeColon.trim().replace(/@/g, "-").toLowerCase();
      if (normalized.endsWith("[1m]")) normalized = normalized.slice(0, -"[1m]".length).trim();
      return normalized;
    }
    
    // src/client/pricing/currency.ts
    var DECIMALS = 6;
    var TINY_DECIMALS = 10;
    var AMOUNT_RE = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;
    function parseAmount(text) {
      const raw = text.trim();
      if (raw === "" || !AMOUNT_RE.test(raw)) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }
    function rateOf(view) {
      const rate = view.cnyPerUsd;
      return rate !== null && Number.isFinite(rate) && rate > 0 ? rate : null;
    }
    function fixed(value, decimals) {
      const text = value.toFixed(decimals);
      return text.includes(".") ? text.replace(/0+$/u, "").replace(/\.$/u, "") : text;
    }
    function amountText(value) {
      const six = fixed(value, DECIMALS);
      return six === "0" && value !== 0 ? fixed(value, TINY_DECIMALS) : six;
    }
    function unitOf(view) {
      return view.route === "USD" ? "$/百万词元" : "¥/百万词元";
    }
    function counterpartOf(view, text) {
      const amount = parseAmount(text);
      if (amount === null) return null;
      const rate = rateOf(view);
      if (rate === null) return null;
      return view.route === "USD" ? `= ¥${amountText(amount * rate)}/百万词元` : `≈ $${amountText(amount / rate)}/百万词元`;
    }
    function convertText(view, text, to) {
      if (to === view.route) return text;
      const raw = text.trim();
      if (raw === "") return "";
      const amount = parseAmount(raw);
      if (amount === null) return null;
      const rate = rateOf(view);
      if (rate === null) return null;
      return amountText(to === "USD" ? amount / rate : amount * rate);
    }
    function inverseHint(cnyPerUsd) {
      if (cnyPerUsd === null || !(cnyPerUsd > 0)) return null;
      return `¥1 ≈ $${fixed(1 / cnyPerUsd, 4)}`;
    }
    
    // src/price-format.ts
    var PRICING_BILLING_KEY = "$billing";
    var PRICING_CALENDAR_KEY = "$calendar";
    var PRICING_CURRENCY_KEY = "$currency";
    var PRICING_FX_KEY = "$fx";
    var MAX_ROUTE_LENGTH = 128;
    var MAX_MODEL_LENGTH = 256;
    var DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;
    var DAY_SETS = ["daily", "weekdays", "workdays", "weekends"];
    var DAY_SET_LABELS = {
      daily: "每天",
      weekdays: "周一至周五",
      workdays: "法定工作日",
      weekends: "周末"
    };
    var DAY_SET_HINTS = {
      daily: "每天 00:00–24:00，含周末与节假日",
      weekdays: "按星期一到星期五计，法定节假日也算",
      workdays: "按工作日计；年历收录的法定节假日不生效",
      weekends: "仅星期六与星期日"
    };
    function dayKeyOf(ms) {
      const at = new Date(ms);
      const month = String(at.getMonth() + 1).padStart(2, "0");
      const day = String(at.getDate()).padStart(2, "0");
      return `${String(at.getFullYear())}-${month}-${day}`;
    }
    function hourOfDay(ms) {
      return new Date(ms).getHours();
    }
    function weekdayOf(ms) {
      return new Date(ms).getDay();
    }
    function dayStartMs(date) {
      if (!DATE_RE.test(date)) return null;
      const year = Number(date.slice(0, 4));
      const month = Number(date.slice(5, 7));
      const day = Number(date.slice(8, 10));
      const at = new Date(year, month - 1, day);
      if (at.getFullYear() !== year || at.getMonth() !== month - 1 || at.getDate() !== day) return null;
      return at.getTime();
    }
    function clockLabel(hour) {
      return `${String(hour).padStart(2, "0")}:00`;
    }
    function dayIndex(date) {
      if (dayStartMs(date) === null) return null;
      return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 864e5;
    }
    function dayKeyOfIndex(index) {
      const at = new Date(index * 864e5);
      const month = String(at.getUTCMonth() + 1).padStart(2, "0");
      const day = String(at.getUTCDate()).padStart(2, "0");
      return `${String(at.getUTCFullYear())}-${month}-${day}`;
    }
    function isValidHolidayRange(range) {
      const start = dayIndex(range.start);
      const end = dayIndex(range.end);
      return start !== null && end !== null && start <= end;
    }
    function holidayDates(range) {
      const start = dayIndex(range.start);
      const end = dayIndex(range.end);
      if (start === null || end === null || start > end) return [];
      const dates = [];
      for (let index = start; index <= end; index += 1) dates.push(dayKeyOfIndex(index));
      return dates;
    }
    function holidaySet(calendar) {
      const dates = /* @__PURE__ */ new Set();
      for (const ranges of Object.values(calendar)) {
        for (const range of ranges) {
          if (!isValidHolidayRange(range)) continue;
          for (const date of holidayDates(range)) dates.add(date);
        }
      }
      return dates;
    }
    function isYearKey(year) {
      return /^\d{4}$/u.test(year);
    }
    function rangeLabel(range) {
      return `${clockLabel(range.start)}–${clockLabel(range.end)}`;
    }
    function isHourRange(range) {
      return Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= 0 && range.start < range.end && range.end <= 24;
    }
    function hourRangesOverlap(left, right) {
      return left.start < right.end && right.start < left.end;
    }
    function isWeekend(weekday) {
      return weekday === 0 || weekday === 6;
    }
    function daySetsIntersect(left, right) {
      if (left === "daily" || right === "daily") return true;
      if (left === right) return true;
      const pair = left === "workdays" ? right : right === "workdays" ? left : null;
      return pair === "weekdays";
    }
    function daySetCovers(days, weekday, date, holidays) {
      if (days === "daily") return true;
      if (isWeekend(weekday)) return days === "weekends";
      if (days === "weekends") return false;
      return days === "weekdays" || !holidays.has(date);
    }
    function slotCovers(slot, ms, holidays) {
      const hour = hourOfDay(ms);
      return hour >= slot.start && hour < slot.end && daySetCovers(slot.days, weekdayOf(ms), dayKeyOf(ms), holidays);
    }
    function slotsOverlap(left, right) {
      return hourRangesOverlap(left, right) && daySetsIntersect(left.days, right.days);
    }
    
    // src/client/pricing/draft.ts
    var RATE_FIELD_NAMES = [
      ["input", "inputPerMillion"],
      ["output", "outputPerMillion"],
      ["cacheRead", "cacheReadPerMillion"],
      ["cacheWrite", "cacheWritePerMillion"]
    ];
    var RATE_INPUTS = [
      ["input", "输入价"],
      ["output", "输出价"],
      ["cacheRead", "缓存读价"],
      ["cacheWrite", "缓存写价"]
    ];
    var nextId = 1;
    function takeId() {
      const id = nextId;
      nextId += 1;
      return id;
    }
    function newHoliday(seed = {}) {
      return { start: "", end: "", ...seed, id: takeId() };
    }
    function defaultCalendarYear(entries, now = /* @__PURE__ */ new Date()) {
      const started = [...entries.values()].some((entry) => entry.holidays.some((row) => row.start !== "" || row.end !== ""));
      let year = now.getFullYear() + (started ? 1 : 0);
      while (entries.has(String(year))) year += 1;
      return String(year);
    }
    function missingYearDrafts(calendar, missingYears) {
      const drafts = [];
      for (const year of missingYears) {
        if (calendar.has(year)) continue;
        drafts.push({ year, holidays: [newHoliday()] });
      }
      return drafts;
    }
    function holidaySpan(row, year) {
      if (row.start === "" && row.end === "") return { kind: "empty" };
      if (row.start === "" || row.end === "") return { kind: "partial" };
      const start = dayIndex(row.start);
      const end = dayIndex(row.end);
      if (start === null || end === null) return { kind: "bad", error: "开始与结束都要是真实存在的一天" };
      if (start > end) return { kind: "bad", error: `开始（${row.start}）晚于结束（${row.end}）` };
      if (row.start.slice(0, 4) !== year || row.end.slice(0, 4) !== year) {
        return { kind: "bad", error: `跨出了 ${year} 年：一段假期必须落在它所属的那一年里` };
      }
      return { kind: "ok", days: end - start + 1, span: { start: row.start, end: row.end } };
    }
    function readHolidays(year, rows) {
      const spans = rows.map((row) => holidaySpan(row, year));
      return spans.map((span, index) => {
        if (span.kind !== "ok") return span;
        for (let other = 0; other < index; other += 1) {
          const peer = spans[other];
          if (peer.kind !== "ok") continue;
          if (peer.span.start <= span.span.end && span.span.start <= peer.span.end) {
            return { kind: "bad", error: `与第 ${String(other + 1)} 段假期重叠：同一年里两段假期不能共享一天` };
          }
        }
        return { kind: "ok", days: span.days };
      });
    }
    function writableRanges(year, rows) {
      const reads = readHolidays(year, rows);
      return rows.flatMap((row, index) => reads[index].kind === "ok" ? [{ start: row.start, end: row.end }] : []);
    }
    function calendarYearTally(year, rows) {
      let ranges = 0;
      let days = 0;
      for (const read of readHolidays(year, rows)) {
        if (read.kind !== "ok") continue;
        ranges += 1;
        days += read.days;
      }
      return { ranges, days };
    }
    function composeCalendar(entries, autoYears = /* @__PURE__ */ new Set()) {
      const calendar = {};
      for (const [year, entry] of entries) {
        if (autoYears.has(year)) continue;
        if (!isYearKey(year)) return { ok: false, error: `年历的年份「${year}」必须是四位数字` };
        const reads = readHolidays(year, entry.holidays);
        const bad = reads.findIndex((read) => read.kind === "bad");
        const problem = reads[bad];
        if (problem !== void 0 && problem.kind === "bad") {
          return { ok: false, error: `年历 ${year} 第 ${String(bad + 1)} 段假期：${problem.error}` };
        }
        const ranges = writableRanges(year, entry.holidays);
        if (ranges.length > 0) calendar[year] = ranges;
      }
      return { ok: true, calendar };
    }
    function holidaysOf(entries) {
      const calendar = {};
      for (const [year, entry] of entries) {
        const ranges = writableRanges(year, entry.holidays);
        if (ranges.length > 0) calendar[year] = ranges;
      }
      return holidaySet(calendar);
    }
    function calendarSignature(entries, autoYears) {
      const filled = [...entries].map(([year, entry]) => [
        year,
        entry.holidays.filter((row) => row.start !== "" || row.end !== "").map((row) => [row.start, row.end]),
        autoYears.has(year)
      ]).filter(([, rows]) => rows.length > 0).sort((left, right) => left[0].localeCompare(right[0]));
      return JSON.stringify(filled);
    }
    function withCalendar(state, calendar) {
      return { ...state, calendar, holidays: holidaysOf(calendar) };
    }
    function adoptYear(state, year) {
      if (!state.autoYears.has(year)) return state;
      const autoYears = new Set(state.autoYears);
      autoYears.delete(year);
      return { ...state, autoYears };
    }
    function fxValue(text) {
      const parsed = parseAmount(text);
      return parsed === null || parsed === 0 ? null : parsed;
    }
    function fxIssue(text) {
      const raw = text.trim();
      if (raw === "" || fxValue(raw) !== null) return null;
      return "汇率必须是大于 0 的数字（1 美元等于多少元）";
    }
    function fxSignature(text) {
      const raw = text.trim();
      if (raw === "") return "";
      const rate = fxValue(raw);
      return rate === null ? raw : String(rate);
    }
    function fxSetting(text) {
      const rate = fxValue(text);
      return rate === null ? null : { cnyPerUsd: rate };
    }
    function withFx(state, fx) {
      return { ...state, fx };
    }
    function convertedRates(view, holder, to) {
      const next = { ...holder };
      for (const [field] of RATE_INPUTS) {
        const converted = convertText(view, holder[field], to);
        if (converted !== null) next[field] = converted;
      }
      return next;
    }
    function withRouteCurrency(state, route, to, cnyPerUsd) {
      const card = state.routes.get(route);
      if (card === void 0 || card.currency === to) return state;
      if (cnyPerUsd === null || !(cnyPerUsd > 0)) return state;
      const view = { route: card.currency, cnyPerUsd };
      const models = /* @__PURE__ */ new Map();
      for (const [model, row] of card.models) {
        models.set(model, {
          ...row,
          ...convertedRates(view, row, to),
          slots: row.slots.map((slot) => ({ ...slot, ...convertedRates(view, slot, to) }))
        });
      }
      const routes = new Map(state.routes);
      routes.set(route, { ...card, models, currency: to });
      return { ...state, routes };
    }
    function hourValue(text) {
      const raw = text.trim();
      return /^\d{1,2}$/u.test(raw) ? Number(raw) : Number.NaN;
    }
    function slotRange(slot) {
      return { start: hourValue(slot.start), end: hourValue(slot.end) };
    }
    function isBlankRates(holder) {
      return RATE_INPUTS.every(([field]) => holder[field].trim() === "");
    }
    function isBlankSlot(slot) {
      return isBlankRates(slot);
    }
    function effectiveSlots(price) {
      return price.slots.filter((slot) => !isBlankSlot(slot));
    }
    function hasContent(price) {
      return !isBlankRates(price) || effectiveSlots(price).length > 0;
    }
    function newSlot(seed = {}) {
      return {
        id: takeId(),
        days: seed.days ?? "daily",
        start: seed.start ?? "9",
        end: seed.end ?? "12",
        input: seed.input ?? "",
        output: seed.output ?? "",
        cacheRead: seed.cacheRead ?? "",
        cacheWrite: seed.cacheWrite ?? ""
      };
    }
    function duplicateSlot(slot) {
      const { start, end } = slotRange(slot);
      const length = isHourRange({ start, end }) ? end - start : 1;
      if (isHourRange({ start, end }) && end + length <= 24) {
        return { ...slot, id: takeId(), start: String(end), end: String(end + length) };
      }
      if (isHourRange({ start, end }) && start - length >= 0) {
        return { ...slot, id: takeId(), start: String(start - length), end: String(start) };
      }
      return { ...slot, id: takeId() };
    }
    function withSlotStart(slot, startText) {
      const start = hourValue(startText);
      if (!Number.isFinite(start)) return slot;
      const end = hourValue(slot.end);
      const nextEnd = Number.isFinite(end) && end > start ? end : Math.min(24, start + 1);
      return { ...slot, start: String(start), end: String(nextEnd) };
    }
    function withSlotEnd(slot, endText) {
      const end = hourValue(endText);
      if (!Number.isFinite(end)) return slot;
      const start = hourValue(slot.start);
      const nextStart = Number.isFinite(start) && start < end ? start : Math.max(0, end - 1);
      return { ...slot, start: String(nextStart), end: String(end) };
    }
    function rateText(value) {
      return value === void 0 ? "" : String(value);
    }
    function slotDraft(slot) {
      return {
        id: takeId(),
        days: slot.days,
        start: String(slot.start),
        end: String(slot.end),
        input: rateText(slot.inputPerMillion),
        output: rateText(slot.outputPerMillion),
        cacheRead: rateText(slot.cacheReadPerMillion),
        cacheWrite: rateText(slot.cacheWritePerMillion)
      };
    }
    function priceDraft(price) {
      return {
        input: rateText(price.inputPerMillion),
        output: rateText(price.outputPerMillion),
        cacheRead: rateText(price.cacheReadPerMillion),
        cacheWrite: rateText(price.cacheWritePerMillion),
        slots: (price.slots ?? []).map(slotDraft)
      };
    }
    function draftFromView(view) {
      const draft = /* @__PURE__ */ new Map();
      for (const card of view.routes) {
        const models = /* @__PURE__ */ new Map();
        for (const row of card.models) {
          const price = row.price === void 0 ? { input: "", output: "", cacheRead: "", cacheWrite: "", slots: [] } : priceDraft(row.price);
          models.set(row.model, {
            model: row.model,
            ...row.name !== void 0 ? { name: row.name } : {},
            records: row.records,
            ...row.unpriced !== void 0 ? { unpriced: row.unpriced } : {},
            ...price
          });
        }
        draft.set(card.route, {
          route: card.route,
          label: card.label,
          billing: card.billing,
          currency: card.currency ?? "CNY",
          records: card.records,
          models
        });
      }
      const calendar = /* @__PURE__ */ new Map();
      for (const [year, ranges] of Object.entries(view.calendar ?? {})) {
        calendar.set(year, {
          year,
          holidays: ranges.map((range) => newHoliday({ start: range.start, end: range.end }))
        });
      }
      return {
        routes: draft,
        calendar,
        holidays: holidaysOf(calendar),
        autoYears: new Set(view.calendarAuto ?? []),
        fx: view.fx === void 0 ? "" : String(view.fx.cnyPerUsd)
      };
    }
    function isUnpriced(model) {
      return isBlankRates(model);
    }
    function priceUnknown(model) {
      return isUnpriced(model) || (model.unpriced ?? 0) > 0;
    }
    function activeSlot(price, nowMs, holidays) {
      for (const slot of effectiveSlots(price)) {
        const { start, end } = slotRange(slot);
        if (isHourRange({ start, end }) && slotCovers({ days: slot.days, start, end }, nowMs, holidays)) return slot;
      }
      return null;
    }
    function ratesInForce(model, holidays, nowMs = Date.now()) {
      if (isUnpriced(model)) return null;
      const slot = activeSlot(model, nowMs, holidays);
      if (slot === null) return { slot: null, values: inheritedRates(model) };
      const inherit = (field) => {
        const own = slot[field].trim();
        return own === "" ? model[field] : own;
      };
      return {
        slot,
        values: {
          input: inherit("input"),
          output: inherit("output"),
          cacheRead: inherit("cacheRead"),
          cacheWrite: inherit("cacheWrite")
        }
      };
    }
    function fieldState(holder, field) {
      if (holder === null) return "empty";
      const raw = holder[field].trim();
      if (raw === "") return "empty";
      return parseAmount(raw) === null ? "bad" : "ok";
    }
    function inheritedRates(price) {
      return {
        input: price.input,
        output: price.output,
        cacheRead: price.cacheRead,
        cacheWrite: price.cacheWrite
      };
    }
    function inheritedCell(price, slot, field, show = (cnyText) => cnyText) {
      const wider = slot === null ? "" : price[field].trim();
      if (wider !== "") return { value: show(wider), note: `留空 = 沿用基准价 ${show(wider)}` };
      if (field === "input" || field === "output") {
        return slot === null ? {} : { note: "留空 = 沿用基准价（基准价这档也是空的）" };
      }
      const own = slot === null ? "" : slot.input.trim();
      const input = own !== "" ? own : price.input.trim();
      if (input === "") return { note: "留空 = 按输入价计（输入价还没填）" };
      return { value: show(input), note: `留空 = 按输入价计 ${show(input)}：这一档没有单独定价` };
    }
    function rateIssue(holder, prefix) {
      for (const [field, label] of RATE_INPUTS) {
        const state = fieldState(holder, field);
        if (state === "bad") return `${prefix}${label}「${holder[field].trim()}」不是有效的非负数字`;
        if (state === "empty" && (field === "input" || field === "output")) return `${prefix}${label}还空着`;
      }
      return null;
    }
    function ratesOf(holder) {
      const input = parseAmount(holder.input);
      const output = parseAmount(holder.output);
      if (input === null || output === null) return null;
      const cacheRead = parseAmount(holder.cacheRead);
      const cacheWrite = parseAmount(holder.cacheWrite);
      return {
        input,
        output,
        ...cacheRead !== null ? { cacheRead } : {},
        ...cacheWrite !== null ? { cacheWrite } : {}
      };
    }
    function badRateField(holder) {
      for (const [field, label] of RATE_INPUTS) {
        if (fieldState(holder, field) === "bad") return `${label}「${holder[field].trim()}」不是有效的非负数字`;
      }
      return null;
    }
    function slotRates(slot) {
      const rates = {};
      for (const [field, label] of RATE_INPUTS) {
        const raw = slot[field].trim();
        if (raw === "") continue;
        const parsed = parseAmount(raw);
        if (parsed === null) return { ok: false, error: `${label}「${raw}」不是有效的非负数字` };
        rates[field] = parsed;
      }
      return { ok: true, rates };
    }
    function slotIssue(slot, all, index) {
      const where = `第 ${String(index + 1)} 个峰谷时段`;
      const { start, end } = slotRange(slot);
      if (!isHourRange({ start, end })) {
        return `${where}的时段必须是整点，且 0 ≤ 开始 < 结束 ≤ 24（24 = 当天结束）`;
      }
      const rates = slotRates(slot);
      if (!rates.ok) return `${where}的${rates.error}`;
      for (let other = 0; other < index; other += 1) {
        const peer = all[other];
        if (isBlankSlot(peer)) continue;
        const peerRange = slotRange(peer);
        if (!isHourRange(peerRange)) continue;
        if (slotsOverlap({ days: peer.days, ...peerRange }, { days: slot.days, start, end })) {
          return `${where}（${dayLabel(slot)}）与第 ${String(other + 1)} 个峰谷时段（${dayLabel(peer)}）重叠：同一时刻只能有一个时段价`;
        }
      }
      return null;
    }
    function dayLabel(slot) {
      return `${DAY_SET_LABELS[slot.days]} ${rangeLabel(slotRange(slot))}`;
    }
    function priceIssue(model) {
      if (!hasContent(model)) return null;
      const rates = rateIssue(model, "");
      if (rates !== null) return rates;
      for (let index = 0; index < model.slots.length; index += 1) {
        const slot = model.slots[index];
        if (isBlankSlot(slot)) continue;
        const problem = slotIssue(slot, model.slots, index);
        if (problem !== null) return problem;
      }
      return null;
    }
    function priceSignature(model) {
      if (!hasContent(model)) return null;
      const rates = ratesOf(model);
      return {
        rates: rates === null || badRateField(model) !== null ? null : rates,
        slots: effectiveSlots(model).map((slot) => {
          const rates2 = slotRates(slot);
          return {
            days: slot.days,
            start: hourValue(slot.start),
            end: hourValue(slot.end),
            rates: rates2.ok ? rates2.rates : null
          };
        })
      };
    }
    function modelSignature(model) {
      return JSON.stringify(priceSignature(model));
    }
    function rowKey(route, model) {
      return `${route}\0${model}`;
    }
    function slotBody(slot) {
      const body = {
        days: slot.days,
        start: hourValue(slot.start),
        end: hourValue(slot.end)
      };
      const rates = slotRates(slot);
      if (rates.ok) {
        for (const [draftKey, wireKey] of RATE_FIELD_NAMES) {
          const value = rates.rates[draftKey];
          if (value !== void 0) body[wireKey] = value;
        }
      }
      return body;
    }
    function routeIssue(route) {
      if (route === "") return "存在空通道路由名";
      if (route.startsWith("$")) return `通道路由名不得以「$」开头（「$」是价文件的保留键前缀）：${route}`;
      if (route.length > MAX_ROUTE_LENGTH) return `通道路由名超过 ${String(MAX_ROUTE_LENGTH)} 字：${route.slice(0, 40)}…`;
      return null;
    }
    function modelIssue(model) {
      if (model === "") return "存在空模型串";
      if (model.length > MAX_MODEL_LENGTH) return `模型串超过 ${String(MAX_MODEL_LENGTH)} 字：${model.slice(0, 40)}…`;
      return null;
    }
    function composePriceBody(state) {
      const body = {};
      const billing = {};
      for (const [route, card] of state.routes) {
        if (card.billing !== "metered") billing[route] = card.billing;
        const models = {};
        for (const [model, row] of card.models) {
          if (!hasContent(row)) continue;
          const modelProblem = modelIssue(model);
          if (modelProblem !== null) return { ok: false, error: `「${route}」的${modelProblem}` };
          const where = `「${route}」的「${model}」`;
          const issue = rateIssue(row, "");
          if (issue !== null) return { ok: false, error: `${where}的${issue}` };
          const rates = ratesOf(row);
          if (rates === null) return { ok: false, error: `${where}的输入价 / 输出价必须是非负数字` };
          const out = {};
          for (const [draftKey, wireKey] of RATE_FIELD_NAMES) {
            const value = rates[draftKey];
            if (value !== void 0) out[wireKey] = value;
          }
          const slots = effectiveSlots(row);
          if (slots.length > 0) {
            for (let index = 0; index < row.slots.length; index += 1) {
              const slot = row.slots[index];
              if (isBlankSlot(slot)) continue;
              const problem = slotIssue(slot, row.slots, index);
              if (problem !== null) return { ok: false, error: `${where}的${problem}` };
            }
            out.slots = [...slots].sort((left, right) => hourValue(left.start) - hourValue(right.start) || DAY_SETS.indexOf(left.days) - DAY_SETS.indexOf(right.days)).map(slotBody);
          }
          models[model] = out;
        }
        if (Object.keys(models).length > 0) {
          const routeProblem = routeIssue(route);
          if (routeProblem !== null) return { ok: false, error: routeProblem };
          body[route] = models;
        }
      }
      if (Object.keys(billing).length > 0) body[PRICING_BILLING_KEY] = billing;
      const calendar = composeCalendar(state.calendar, state.autoYears);
      if (!calendar.ok) return { ok: false, error: calendar.error };
      if (Object.keys(calendar.calendar).length > 0) body[PRICING_CALENDAR_KEY] = calendar.calendar;
      const fxProblem = fxIssue(state.fx);
      if (fxProblem !== null) return { ok: false, error: fxProblem };
      const fx = fxSetting(state.fx);
      const currency = {};
      for (const [route, card] of state.routes) {
        if (card.currency !== "USD") continue;
        if (fx === null) {
          return { ok: false, error: `「${route}」按美元报价，但还没有汇率：先在汇率格里填 1 美元等于多少元` };
        }
        currency[route] = "USD";
      }
      if (Object.keys(currency).length > 0) body[PRICING_CURRENCY_KEY] = currency;
      if (fx !== null) body[PRICING_FX_KEY] = fx;
      return { ok: true, body };
    }
    function baselinesOf(view) {
      return baselineOfDraft(draftFromView(view));
    }
    function baselineOfDraft(state) {
      const models = /* @__PURE__ */ new Map();
      const billing = /* @__PURE__ */ new Map();
      const currency = /* @__PURE__ */ new Map();
      for (const [route, card] of state.routes) {
        billing.set(route, card.billing);
        currency.set(route, card.currency);
        for (const [model, row] of card.models) {
          models.set(rowKey(route, model), modelSignature(row));
        }
      }
      return {
        models,
        billing,
        currency,
        calendar: calendarSignature(state.calendar, state.autoYears),
        fx: fxSignature(state.fx)
      };
    }
    function stagedChanges(state, baseline) {
      let count = 0;
      for (const [route, card] of state.routes) {
        if ((baseline.billing.get(route) ?? "metered") !== card.billing) count += 1;
        if ((baseline.currency.get(route) ?? "CNY") !== card.currency) count += 1;
        for (const row of card.models.values()) {
          if (modelDirty(route, row, baseline.models)) count += 1;
        }
      }
      if (calendarSignature(state.calendar, state.autoYears) !== baseline.calendar) count += 1;
      if (fxSignature(state.fx) !== baseline.fx) count += 1;
      return count;
    }
    function calendarDirty(state, baseline) {
      return calendarSignature(state.calendar, state.autoYears) !== baseline.calendar;
    }
    function modelDirty(route, row, baseline) {
      return (baseline.get(rowKey(route, row.model)) ?? "") !== modelSignature(row);
    }
    function routeOptionLabel(card) {
      const models = [...card.models.values()];
      const unknown = models.filter(priceUnknown).length;
      const parts = [card.route];
      if (card.records > 0) parts.push(`${String(card.records)} 次`);
      parts.push(unknown === 0 ? `${String(models.length)} 个模型` : `${String(unknown)} 个模型未知`);
      return parts.join(" · ");
    }
    function modelOptionLabel(row, dirty) {
      const parts = [row.model];
      if (row.records > 0) parts.push(`${String(row.records)} 次`);
      if (priceUnknown(row)) parts.push("价格未知");
      if (dirty) parts.push("未保存");
      return parts.join(" · ");
    }
    
    // src/client/pricing/editors.tsx
    var import_react2 = require("react");
    var import_jsx_runtime3 = require("react/jsx-runtime");
    var CELLS = [
      { field: "input", label: "输入" },
      { field: "output", label: "输出" },
      { field: "cacheRead", label: "缓存读" },
      { field: "cacheWrite", label: "缓存写" }
    ];
    var START_HOURS = Array.from({ length: 24 }, (_, hour) => hour);
    var END_HOURS = Array.from({ length: 24 }, (_, hour) => hour + 1);
    var HOURS = Array.from({ length: 24 }, (_, hour) => hour);
    var HOUR_TICKS = [0, 6, 12, 18, 24];
    function CalendarEditor({ entries, missingYears, autoYears, dirty, expanded, sync, onAutoRefresh, syncing, onExpandedChange, onChange }) {
      const [addingTouched, setAddingTouched] = (0, import_react2.useState)(false);
      const [focusId, setFocusId] = (0, import_react2.useState)(null);
      const [typed, setTyped] = (0, import_react2.useState)(null);
      const years = [...entries.keys()].sort((left, right) => left.localeCompare(right));
      const reads = new Map(years.map((year) => [year, readHolidays(year, entries.get(year).holidays)]));
      const defaultYear = defaultCalendarYear(entries);
      const yearText = typed ?? defaultYear;
      const kept = years.filter((year) => reads.get(year).some((read) => read.kind === "ok"));
      const broken = years.filter((year) => reads.get(year).some((read) => read.kind === "bad"));
      const gaps = missingYears.filter((year) => !entries.has(year));
      (0, import_react2.useEffect)(() => {
        if (focusId === null) return;
        document.getElementById(focusId)?.focus();
        setFocusId(null);
      }, [focusId]);
      const addingProblem = (() => {
        const year = yearText.trim();
        if (year === "") return null;
        if (!/^\d{4}$/u.test(year)) return "年份要写四位数字，例如 2027";
        if (entries.has(year)) return `${year} 年已经在上面了`;
        return null;
      })();
      const leaveYear = () => {
        setAddingTouched(true);
        setTyped((current) => current !== null && current.trim() === "" ? null : current);
      };
      const submitAdding = () => {
        setAddingTouched(true);
        if (addingProblem !== null) return;
        const year = yearText.trim() === "" ? defaultYear : yearText.trim();
        const holiday = newHoliday();
        onChange(year, { year, holidays: [holiday] });
        setFocusId(dateFieldId(holiday, "start"));
        setTyped(null);
        setAddingTouched(false);
      };
      const fillGaps = () => {
        const drafts = missingYearDrafts(entries, gaps);
        for (const draft of drafts) onChange(draft.year, draft);
        onExpandedChange(true);
        const first = drafts[0]?.holidays[0];
        setFocusId(first === void 0 ? null : dateFieldId(first, "start"));
      };
      const autoLine = describeAutoSync(sync, syncing === true);
      const needsManual = sync !== void 0 && (sync.state === "failed" || sync.state === "missing");
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dtpl-price-cal", id: "price-calendar", "data-dirty": dirty, "data-open": expanded, "aria-label": "法定节假日年历", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-cal-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              type: "button",
              className: "dtpl-price-cal-toggle",
              "aria-expanded": expanded,
              onClick: () => onExpandedChange(!expanded),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-cal-caret", "aria-hidden": "true" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-cal-title", children: "法定节假日年历" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-cal-sum", children: summarizeCalendar(kept) }),
                autoYears !== void 0 && autoYears.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                  "span",
                  {
                    className: "dtpl-price-cal-auto",
                    title: "这些年份没写在 pricing.json 里，是从 holiday-cn 自动拉来并缓存到本机的；手写有那一年时以手写的为准。",
                    children: [
                      autoYears.join("、"),
                      " 自动"
                    ]
                  }
                ),
                broken.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-cal-warn", children: [
                  broken.join("、"),
                  " 年写不出来"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-cal-hint", "aria-hidden": "true", children: expanded ? "收起" : "展开" })
              ]
            }
          ),
          missingYears.length > 0 && gaps.length > 0 && (onAutoRefresh === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              type: "button",
              className: "dtpl-price-cal-fix",
              onClick: fillGaps,
              title: "这些年的「法定工作日」时段会按周一至周五全额计，落在法定节假日的工作日被多算高峰价。补上那一年，或展开年历手动加一年。",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-add-plus", "aria-hidden": "true", children: "＋" }),
                gaps.length > 2 ? `补上缺的 ${String(gaps.length)} 年` : `补上 ${gaps.join("、")} 年`
              ]
            }
          ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              type: "button",
              className: "dtpl-price-cal-fix",
              disabled: syncing === true,
              onClick: onAutoRefresh,
              title: "从 holiday-cn 拉这几年的法定节假日安排（它每日抓国务院公告）。手写过的年份不受影响。",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-add-plus", "aria-hidden": "true", children: "↻" }),
                syncing === true ? "拉取中…" : `自动拉取 ${gaps.join("、")} 年`
              ]
            }
          ))
        ] }),
        autoLine !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "dtpl-price-cal-auto-line", "data-tone": autoLine.tone, children: [
          autoLine.text,
          needsManual && onAutoRefresh !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dtpl-price-ghost", onClick: onAutoRefresh, disabled: syncing === true, children: syncing === true ? "重试中…" : "重试" })
        ] }),
        expanded && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-cal-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "dtpl-price-cal-note", children: [
            "一年一组，一段假期一行：填开始与结束日期，含两端。只收录放假日——调休上班日落在周末， 而周末本来就是闲时。每行后面的天数是拿来对通知里「共 N 天」的：对不上就是抄错了。 标着",
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: "「自动」" }),
            "的年份没写在这里，是启动时从 holiday-cn 拉来并缓存的；你手写过哪一年， 哪一年就以你的为准。"
          ] }),
          years.map((year) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            CalendarYearGroup,
            {
              entry: entries.get(year),
              reads: reads.get(year),
              onChange: (next) => onChange(year, next),
              onRemove: () => {
                onChange(year, null);
                setFocusId("cal-newyear");
              }
            },
            year
          )),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-cal-add", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "dtpl-price-cal-year-k", htmlFor: "cal-newyear", children: "年份" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "input",
              {
                id: "cal-newyear",
                className: "dtpl-price-input dtpl-price-cal-newyear",
                type: "text",
                inputMode: "numeric",
                maxLength: 4,
                autoComplete: "off",
                value: yearText,
                "aria-label": "要加入的年份",
                "aria-invalid": addingTouched && addingProblem !== null || void 0,
                "aria-describedby": addingTouched && addingProblem !== null ? "cal-add-err" : void 0,
                onChange: (event) => {
                  setTyped(event.target.value);
                  setAddingTouched(false);
                },
                onBlur: leaveYear,
                onKeyDown: (event) => {
                  if (event.key === "Enter") submitAdding();
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "button",
              {
                type: "button",
                className: "dtpl-price-add-ghost",
                disabled: addingProblem !== null,
                onClick: submitAdding,
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-add-plus", "aria-hidden": "true", children: "＋" }),
                  "加一年"
                ]
              }
            ),
            addingTouched && addingProblem !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { id: "cal-add-err", className: "dtpl-price-cal-newyear-err", role: "alert", children: addingProblem })
          ] })
        ] })
      ] });
    }
    function dateFieldId(holiday, side) {
      return `cal-${String(holiday.id)}-${side}`;
    }
    function CalendarYearGroup({ entry, reads, onChange, onRemove }) {
      const [confirming, setConfirming] = (0, import_react2.useState)(false);
      const tally = calendarYearTally(entry.year, entry.holidays);
      const [pendingFocus, setPendingFocus] = (0, import_react2.useState)(null);
      (0, import_react2.useEffect)(() => {
        if (pendingFocus === null) return;
        document.getElementById(pendingFocus)?.focus();
        setPendingFocus(null);
      }, [pendingFocus]);
      const addHoliday = () => {
        const holiday = newHoliday();
        onChange({ ...entry, holidays: [...entry.holidays, holiday] });
        setPendingFocus(dateFieldId(holiday, "start"));
      };
      const removeHoliday = (index) => {
        const holiday = entry.holidays[index];
        if (holiday === void 0) return;
        onChange({ ...entry, holidays: entry.holidays.filter((item) => item.id !== holiday.id) });
        const next = entry.holidays[index + 1] ?? entry.holidays[index - 1];
        setPendingFocus(next === void 0 ? `cal-${entry.year}-add` : dateFieldId(next, "start"));
      };
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-cal-year", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-cal-year-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-cal-year-num", children: entry.year }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-cal-year-sum", children: tally.ranges === 0 ? "还没写（这一年仍未收录）" : `${String(tally.ranges)} 段假期 · 共 ${String(tally.days)} 天` }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "dtpl-price-ghost dtpl-price-ghost-danger",
              "aria-label": `${confirming ? "确认删除" : "删除"}这一年（${entry.year}）`,
              "data-confirm": confirming,
              onClick: () => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                setConfirming(false);
                onRemove();
              },
              onBlur: () => setConfirming(false),
              title: confirming ? `再点一次：${entry.year} 年的放假安排会被删掉，那一年退回按周一至周五全额算高峰` : `删掉 ${entry.year} 年（需再点一次确认）`,
              children: confirming ? "确认删除" : "删除这一年"
            }
          )
        ] }),
        entry.holidays.map((holiday, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          HolidayRow,
          {
            year: entry.year,
            index,
            row: holiday,
            read: reads[index],
            onEdit: (next) => onChange({
              ...entry,
              holidays: entry.holidays.map((item) => item.id === holiday.id ? next : item)
            }),
            onRemove: () => removeHoliday(index)
          },
          holiday.id
        )),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { type: "button", id: `cal-${entry.year}-add`, className: "dtpl-price-add-ghost", onClick: addHoliday, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-add-plus", "aria-hidden": "true", children: "＋" }),
          "加一段假期"
        ] })
      ] });
    }
    function HolidayRow({ year, index, row, read, onEdit, onRemove }) {
      const [confirming, setConfirming] = (0, import_react2.useState)(false);
      const where = `${year} 年第 ${String(index + 1)} 段假期`;
      const startId = dateFieldId(row, "start");
      const endId = dateFieldId(row, "end");
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-cal-holiday", "data-bad": read.kind === "bad", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "input",
          {
            id: startId,
            className: "dtpl-price-input dtpl-price-cal-date",
            type: "date",
            min: `${year}-01-01`,
            max: `${year}-12-31`,
            value: row.start,
            "aria-label": `${where}的开始日期`,
            "aria-invalid": read.kind === "bad" || void 0,
            title: "点进年 / 月 / 日任一段直接键入，方向键逐步增减；日期只能落在这一年里",
            onChange: (event) => onEdit({ ...row, start: event.target.value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-cal-tilde", "aria-hidden": "true", children: "~" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "input",
          {
            id: endId,
            className: "dtpl-price-input dtpl-price-cal-date",
            type: "date",
            min: `${year}-01-01`,
            max: `${year}-12-31`,
            value: row.end,
            "aria-label": `${where}的结束日期`,
            "aria-invalid": read.kind === "bad" || void 0,
            title: "点进年 / 月 / 日任一段直接键入，方向键逐步增减；日期只能落在这一年里",
            onChange: (event) => onEdit({ ...row, end: event.target.value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-cal-holiday-tail", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-cal-days", "data-kind": read.kind, children: read.kind === "ok" ? `${String(read.days)} 天` : read.kind === "partial" ? "还没填完" : "" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              id: `cal-${String(row.id)}-remove`,
              className: "dtpl-price-ghost dtpl-price-ghost-danger",
              "aria-label": `${confirming ? "确认删除" : "删除"}（${where}）`,
              "data-confirm": confirming,
              onClick: () => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                setConfirming(false);
                onRemove();
              },
              onBlur: () => setConfirming(false),
              title: confirming ? "再点一次：这一段假期会被删掉" : "删掉这一段假期（需再点一次确认）",
              children: confirming ? "确认删除" : "删除"
            }
          )
        ] }),
        read.kind === "bad" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-cell-err", role: "alert", children: read.error })
      ] });
    }
    function summarizeCalendar(years) {
      if (years.length === 0) return "未收录：法定工作日按周一至周五全额算";
      return `${years.join("、")} 已收录`;
    }
    function describeAutoSync(sync, running) {
      if (sync === void 0) return null;
      if (running) return { text: "正在拉取节假日安排…", tone: "ok" };
      if (sync.state === "failed") {
        return {
          text: `上次没拉到${sync.lastError === null ? "" : `（${sync.lastError}）`}，现在用的还是上次的数据；展开年历可以自己填，手写的永远优先。`,
          tone: "err"
        };
      }
      if (sync.state === "missing") {
        return {
          text: sync.uncovered.length > 0 ? `${sync.uncovered.join("、")} 年还没有节假日数据（上游可能还没公布）。展开可以手动填。` : "还没有节假日数据。展开可以手动填。",
          tone: "err"
        };
      }
      return null;
    }
    function RateCell({ id, label, value, state, context, placeholder, note, onEdit, view }) {
      const errorId = `${id}-err`;
      const noteId = `${id}-note`;
      const message = state === "bad" ? "须为非负数字" : void 0;
      const describedBy = [
        message !== void 0 ? errorId : void 0,
        note !== void 0 ? noteId : void 0
      ].filter((ref) => ref !== void 0).join(" ") || void 0;
      const counterpart = counterpartOf(view, value);
      const tip = state === "bad" ? `${label}必须是非负数字（${unitOf(view)}）` : [value.trim() !== "" ? `${label}：${value}` : void 0, note, counterpart].filter((text) => text !== void 0 && text !== null).join(" · ") || void 0;
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-cell", "data-state": state, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "dtpl-price-cell-k", htmlFor: id, children: label }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "input",
          {
            id,
            className: "dtpl-price-input",
            type: "text",
            inputMode: "decimal",
            autoComplete: "off",
            spellCheck: false,
            placeholder: placeholder ?? "—",
            title: tip,
            value,
            "aria-label": `${context} ${label}`,
            "aria-invalid": state === "bad" || void 0,
            "aria-describedby": describedBy,
            onChange: (event) => onEdit?.(event.target.value),
            onKeyDown: (event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }
          }
        ),
        note !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { id: noteId, className: "dtpl-sr", children: note }),
        message !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { id: errorId, className: "dtpl-price-cell-err", role: "alert", children: message })
      ] });
    }
    function LiveRates({ live, records, view }) {
      const shown = (field) => {
        if (live === null) return "";
        const own = live.values[field].trim();
        if (own !== "") return own;
        if (field === "cacheRead" || field === "cacheWrite") return live.values.input.trim();
        return "";
      };
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-live", role: "group", "aria-label": "此刻计费的价", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-live-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-live-k", children: "此刻计费" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-live-unit", children: unitOf(view) })
        ] }),
        live === null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dtpl-price-live-none", children: records > 0 ? "还没有价：这些记录按 ¥0 计（价格未知）" : "还没有价：它还没有被调用过" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dtpl-price-live-cells", children: CELLS.map(({ field, label }) => {
            const text = shown(field);
            const bad = fieldState(live.values, field) === "bad";
            return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-live-cell", "data-bad": bad || void 0, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-live-label", children: label }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-live-v", children: text === "" ? "—" : text })
            ] }, field);
          }) }),
          live.slot !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "dtpl-price-live-note", children: [
            "正在按峰谷时段「",
            dayLabel(live.slot),
            "」计"
          ] })
        ] })
      ] });
    }
    function DayBand({ price }) {
      const slots = effectiveSlots(price).map((slot) => {
        const { start, end } = slotRange(slot);
        const ok = isHourRange({ start, end });
        return { id: slot.id, label: dayLabel(slot), start: ok ? start : 0, end: ok ? end : 0 };
      });
      const drawn = slots.filter((row) => row.end > row.start);
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "div",
        {
          className: "dtpl-price-day",
          role: "img",
          "aria-label": `24 小时生效范围：基准价铺满全天${drawn.length === 0 ? "" : `；${drawn.map((row) => `${row.label} 覆盖 ${String(row.start)}–${String(row.end)} 点`).join("；")}`}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-day-row", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-day-k", children: "基准价" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-day-cells", "aria-hidden": "true", children: HOURS.map((hour) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-day-cell", "data-on": "base" }, hour)) })
            ] }),
            drawn.map((row) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-day-row", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-day-k", children: row.label }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-day-cells", "aria-hidden": "true", children: HOURS.map((hour) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-day-cell", "data-on": hour >= row.start && hour < row.end ? "slot" : void 0 }, hour)) })
            ] }, row.id)),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-day-row", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-day-k" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-day-axis", children: HOUR_TICKS.map((hour) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: String(hour).padStart(2, "0") }, hour)) })
            ] })
          ]
        }
      );
    }
    function PriceRow({ slot, index, price, view, onChange, onRemove, onDuplicate }) {
      const context = slot === null ? "基准价" : `第 ${String(index + 1)} 个峰谷时段`;
      const [confirming, setConfirming] = (0, import_react2.useState)(false);
      const inert = slot !== null && isBlankSlot(slot);
      const hours = slot === null ? null : (() => {
        const range = slotRange(slot);
        return isHourRange(range) ? range.end - range.start : null;
      })();
      const lastPriced = slot !== null && !inert && effectiveSlots(price).length === 1;
      const edit = (field, text) => {
        if (slot === null) {
          onChange({ ...price, [field]: text });
          return;
        }
        replaceSlot({ ...slot, [field]: text });
      };
      const replaceSlot = (next) => {
        onChange({ ...price, slots: price.slots.map((item) => item.id === next.id ? next : item) });
      };
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-row", "data-inert": inert || void 0, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dtpl-price-scope", children: slot === null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-scope-k", children: "基准价" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-scope-sub", children: "全周 · 全天，峰谷时段之外都按它计" })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-scope-ctl", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "select",
              {
                className: "dtpl-price-select dtpl-price-select-days",
                value: slot.days,
                "aria-label": `${context}的适用日`,
                title: DAY_SET_HINTS[slot.days],
                onChange: (event) => replaceSlot({ ...slot, days: event.target.value }),
                children: DAY_SETS.map((days) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: days, children: DAY_SET_LABELS[days] }, days))
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "select",
              {
                className: "dtpl-price-select dtpl-price-select-hour",
                value: slot.start,
                "aria-label": `${context}的开始时间`,
                onChange: (event) => replaceSlot(withSlotStart(slot, event.target.value)),
                children: START_HOURS.map((hour) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: String(hour), children: clockLabel(hour) }, hour))
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-scope-dash", "aria-hidden": "true", children: "–" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "select",
              {
                className: "dtpl-price-select dtpl-price-select-hour",
                value: slot.end,
                "aria-label": `${context}的结束时间`,
                onChange: (event) => replaceSlot(withSlotEnd(slot, event.target.value)),
                children: END_HOURS.map((hour) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: String(hour), children: clockLabel(hour) }, hour))
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-scope-foot", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-scope-sub", children: inert ? "不改写任何档，不影响计价" : hours === null ? "时段还没成段" : `持续 ${String(hours)} 小时` }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-rowacts", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dtpl-price-ghost", "aria-label": `复制（${context}）`, onClick: onDuplicate, children: "复制" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  id: `slot-${String(slot.id)}-remove`,
                  className: "dtpl-price-ghost dtpl-price-ghost-danger",
                  "aria-label": `${confirming ? "确认删除" : "删除"}（${context}）`,
                  "data-confirm": confirming,
                  onClick: () => {
                    if (!confirming) {
                      setConfirming(true);
                      return;
                    }
                    setConfirming(false);
                    onRemove();
                  },
                  onBlur: () => setConfirming(false),
                  title: confirming ? lastPriced ? "再点一次：这个时段会被删掉，这行不再有峰谷时段，全部小时按基准价计" : "再点一次：这个时段会被删掉，它覆盖的小时回到基准价" : lastPriced ? "删除这个峰谷时段：它是这行唯一带价的时段，删掉后按基准价计（需再点一次确认）" : "删除这个峰谷时段（需再点一次确认）",
                  children: confirming ? "确认删除" : "删除"
                }
              )
            ] })
          ] })
        ] }) }),
        CELLS.map(({ field, label }) => {
          const cell = inheritedCell(price, slot, field);
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            RateCell,
            {
              id: slot === null ? `price-${field}` : `slot-${String(slot.id)}-${field}`,
              label,
              value: slot === null ? price[field] : slot[field],
              state: fieldState(slot === null ? price : slot, field),
              context,
              placeholder: cell.value,
              note: cell.note,
              onEdit: (next) => edit(field, next),
              view
            },
            field
          );
        })
      ] });
    }
    function PriceTable({ price, view, onChange }) {
      const [pendingFocus, setPendingFocus] = (0, import_react2.useState)(null);
      (0, import_react2.useEffect)(() => {
        if (pendingFocus === null) return;
        document.getElementById(pendingFocus)?.focus();
        setPendingFocus(null);
      }, [pendingFocus]);
      const addSlot = () => {
        const slot = newSlot();
        onChange({ ...price, slots: [...price.slots, slot] });
        setPendingFocus(`slot-${String(slot.id)}-input`);
      };
      const removeSlot = (index) => {
        const slot = price.slots[index];
        if (slot === void 0) return;
        onChange({ ...price, slots: price.slots.filter((item) => item.id !== slot.id) });
        const next = price.slots[index + 1] ?? price.slots[index - 1];
        setPendingFocus(next === void 0 ? "price-add-slot" : `slot-${String(next.id)}-input`);
      };
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-tbl", role: "group", "aria-label": `四档价（${unitOf(view)}）`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-cols", "aria-hidden": "true", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-cols-k", children: "生效范围" }),
            CELLS.map(({ field, label }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-cols-n", children: label }, field))
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-rows", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              PriceRow,
              {
                slot: null,
                index: 0,
                price,
                view,
                onChange,
                onRemove: () => void 0,
                onDuplicate: () => void 0
              }
            ),
            price.slots.map((slot, slotIndex) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              PriceRow,
              {
                slot,
                index: slotIndex,
                price,
                view,
                onChange,
                onRemove: () => removeSlot(slotIndex),
                onDuplicate: () => onChange({ ...price, slots: [...price.slots, duplicateSlot(slot)] })
              },
              slot.id
            ))
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dtpl-price-addrow", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "button",
          {
            type: "button",
            id: "price-add-slot",
            className: "dtpl-price-add-ghost dtpl-price-add-slot",
            "aria-label": "添加峰谷时段",
            onClick: addSlot,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-add-plus", "aria-hidden": "true", children: "＋" }),
              "峰谷时段"
            ]
          }
        ) }),
        effectiveSlots(price).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(DayBand, { price })
      ] });
    }
    var ModelDetail = (0, import_react2.memo)(function ModelDetail2({ route, row, billing, baseline, holidays, currency, rate, onCurrency, onRowChange, onBilling }) {
      const view = { route: currency, cnyPerUsd: rate };
      const dirty = modelDirty(route, row, baseline);
      const issue = priceIssue(row);
      const live = ratesInForce(row, holidays);
      const named = row.name !== void 0 && row.name !== "" && row.name !== row.model;
      const countText = row.records > 0 ? `${String(row.records)} 次请求` : "没记过";
      const unpriced = row.unpriced !== void 0 && row.unpriced > 0 && live !== null ? row.unpriced : 0;
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dtpl-price-detail", "data-dirty": dirty, "aria-label": `${row.model} 的价格`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-detail-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-detail-id", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-name", "data-exact": !named, children: named ? row.name : row.model }),
            named && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-exact", title: row.model, children: row.model })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-reqs", children: countText }),
          unpriced > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "span",
            {
              className: "dtpl-price-unpriced",
              title: `账本里有 ${String(unpriced)} 条记录按这份价折算不出金额（按美元报价却没设汇率，或那些记录落在没有价的档上）：它们按 ¥0 计入金额，所以金额偏低。`,
              children: [
                "其中 ",
                String(unpriced),
                " 条按 ¥0 计"
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-route-facts", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-head-k", children: "这条通道" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-currency", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-head-k", children: "报价币种" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-switch", role: "group", "aria-label": "报价币种", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    "aria-label": "按人民币报价（¥）",
                    "aria-pressed": currency === "CNY",
                    title: "这条通道的价按人民币记（¥/百万词元）。切过来会把现有价按汇率换算成人民币，金额不变",
                    onClick: () => onCurrency("CNY"),
                    children: "¥"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    "aria-label": "按美元报价（$）",
                    "aria-pressed": currency === "USD",
                    disabled: rate === null,
                    title: rate === null ? "先在上面那格填汇率（1 美元 = ? 元）：美元报价的价没有汇率就算不成人民币" : `按美元记这条通道的价（$/百万词元）：现有价按 1 美元 = ${String(rate)} 元换算成美元，人民币金额不变`,
                    onClick: () => onCurrency("USD"),
                    children: "$"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-currency", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-head-k", children: "计费性质" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                "span",
                {
                  className: "dtpl-price-switch",
                  role: "group",
                  "aria-label": `${route} 的计费性质`,
                  title: "按量 = 金额是实际支出；订阅 = 金额是按此处价格折算的订阅价值（非现金）",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", "aria-pressed": billing === "metered", onClick: () => onBilling(route, "metered"), children: "按量" }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", "aria-pressed": billing === "subscription", onClick: () => onBilling(route, "subscription"), children: "订阅" })
                  ]
                }
              )
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(LiveRates, { live, records: row.records, view }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PriceTable, { price: row, view, onChange: (next) => onRowChange(route, row.model, next) }),
        live === null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dtpl-price-note", children: row.records > 0 ? "四档价全空 = 这条没有价：它的记录按 ¥0 计，并列为价格未知。" : "四档价全空 = 这条没有价。它还没被调用过，所以没有金额受影响。" }),
        issue !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "dtpl-price-issue", role: "status", children: [
          row.model,
          ":",
          issue
        ] })
      ] });
    });
    
    // src/client/ledger-clock.ts
    var PROBE_MS = 3e3;
    var PROBE_RETRY_MS = 15e3;
    var NOTIFY_DELAY_MS = 400;
    var ledger = null;
    var listeners = /* @__PURE__ */ new Set();
    var timer = null;
    var inflight = null;
    var visibilityBound = false;
    function probe() {
      if (inflight !== null) return inflight;
      const pending = fetch(ROUTE_SYNC).then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }).then((state) => {
        const previous = ledger;
        ledger = typeof state.ledger === "number" && Number.isFinite(state.ledger) ? state.ledger : null;
        for (const listener of [...listeners]) listener(ledger, previous);
        return true;
      }).catch(() => {
        return false;
      }).finally(() => {
        if (inflight === pending) inflight = null;
      });
      inflight = pending;
      return pending;
    }
    function schedule(delay) {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (listeners.size === 0) return;
        if (document.hidden) {
          schedule(PROBE_MS);
          return;
        }
        void probe().then((ok) => {
          if (listeners.size > 0) schedule(ok ? PROBE_MS : PROBE_RETRY_MS);
        });
      }, delay);
    }
    function onVisibility() {
      if (document.hidden || listeners.size === 0) return;
      void probe().then((ok) => {
        if (listeners.size > 0) schedule(ok ? PROBE_MS : PROBE_RETRY_MS);
      });
    }
    function subscribeLedgerClock(listener) {
      listeners.add(listener);
      if (!visibilityBound) {
        document.addEventListener("visibilitychange", onVisibility);
        visibilityBound = true;
      }
      if (listeners.size === 1) {
        void probe().then((ok) => {
          if (listeners.size > 0) schedule(ok ? PROBE_MS : PROBE_RETRY_MS);
        });
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      };
    }
    function subscribeLedgerChanges(onChange) {
      let queued = false;
      let pending = null;
      const unsubscribe = subscribeLedgerClock((next, previous) => {
        if (next === null || previous === null || next === previous) return;
        if (queued) return;
        queued = true;
        pending = setTimeout(() => {
          queued = false;
          pending = null;
          onChange();
        }, NOTIFY_DELAY_MS);
      });
      return () => {
        if (pending !== null) clearTimeout(pending);
        pending = null;
        queued = false;
        unsubscribe();
      };
    }
    function ledgerClockSupported() {
      return ledger !== null;
    }
    
    // src/client/pricing/PricingPanel.tsx
    var import_jsx_runtime4 = require("react/jsx-runtime");
    var AUTO_SAVE_DELAY_MS = 600;
    var REFRESH_MERGE_MS = 1e3;
    var staged = null;
    var lastView = null;
    function mergeStaged(fresh, saved) {
      let state = draftFromView(fresh);
      const baseline = baselinesOf(fresh);
      for (const [route, card] of saved.state.routes) {
        const freshCard = state.routes.get(route);
        if (freshCard === void 0) continue;
        const models = new Map(freshCard.models);
        let billing = freshCard.billing;
        let currency = freshCard.currency;
        if ((saved.baseline.billing.get(route) ?? "metered") !== card.billing) {
          billing = card.billing;
          baseline.billing.set(route, saved.baseline.billing.get(route) ?? "metered");
        }
        if ((saved.baseline.currency.get(route) ?? "CNY") !== card.currency) {
          currency = card.currency;
          baseline.currency.set(route, saved.baseline.currency.get(route) ?? "CNY");
        }
        for (const [model, row] of card.models) {
          if (!modelDirty(route, row, saved.baseline.models)) continue;
          models.set(model, row);
          const key = rowKey(route, model);
          baseline.models.set(key, saved.baseline.models.get(key) ?? "");
        }
        state.routes.set(route, { ...freshCard, models, billing, currency });
      }
      if (calendarDirty(saved.state, saved.baseline)) {
        state = withCalendar(state, saved.state.calendar);
        baseline.calendar = saved.baseline.calendar;
      }
      if (fxSignature(saved.state.fx) !== saved.baseline.fx) {
        state = withFx(state, saved.state.fx);
        baseline.fx = saved.baseline.fx;
      }
      return { state, baseline };
    }
    var EMPTY_STATE = { routes: /* @__PURE__ */ new Map(), calendar: /* @__PURE__ */ new Map(), holidays: /* @__PURE__ */ new Set(), autoYears: /* @__PURE__ */ new Set(), fx: "" };
    var EMPTY_BASELINE = { models: /* @__PURE__ */ new Map(), billing: /* @__PURE__ */ new Map(), currency: /* @__PURE__ */ new Map(), calendar: "[]", fx: "" };
    var PICKED_KEY = "dsh-tokbook.pricing-picked";
    function readPicked() {
      try {
        const saved = localStorage.getItem(PICKED_KEY);
        if (saved === null) return null;
        const parsed = JSON.parse(saved);
        if (typeof parsed !== "object" || parsed === null) return null;
        const { route, model } = parsed;
        if (typeof route !== "string" || route === "" || typeof model !== "string") return null;
        return { route, model };
      } catch {
        return null;
      }
    }
    function rememberPicked(pick) {
      try {
        if (pick === null) localStorage.removeItem(PICKED_KEY);
        else localStorage.setItem(PICKED_KEY, JSON.stringify(pick));
      } catch {
      }
    }
    function readPricingView(raw) {
      if (typeof raw !== "object" || raw === null) return null;
      const source = raw;
      if (!Array.isArray(source.routes)) return null;
      if (typeof source.calendar !== "object" || source.calendar === null) return null;
      if (!Array.isArray(source.calendarMissing)) return null;
      return source;
    }
    function putPrice(body) {
      return fetch(ROUTE_PRICING, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok || payload === null || !payload.ok) {
          const reason = payload !== null && !payload.ok ? payload.error : "";
          return { ok: false, error: reason !== "" ? reason : `HTTP ${String(res.status)}` };
        }
        return { ok: true };
      }).catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
    function postPricingSync(force) {
      const query = force ? `?${QUERY_FORCE}=1` : "";
      return fetch(`${ROUTE_PRICING_SYNC}${query}`, { method: "POST" }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok || payload === null) throw new Error(payload?.error ?? `HTTP ${String(res.status)}`);
        return payload;
      });
    }
    function clockOf(epochMs) {
      const at = new Date(epochMs);
      return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}:${String(at.getSeconds()).padStart(2, "0")}`;
    }
    function PricingPanel({ onChanged, onDirtyChange }) {
      const [view, setView] = (0, import_react3.useState)(() => staged?.view ?? lastView);
      const [state, setState] = (0, import_react3.useState)(() => staged?.state ?? (lastView === null ? EMPTY_STATE : draftFromView(lastView)));
      const [baseline, setBaseline] = (0, import_react3.useState)(() => staged?.baseline ?? (lastView === null ? EMPTY_BASELINE : baselinesOf(lastView)));
      const [loadError, setLoadError] = (0, import_react3.useState)(null);
      const [save, setSave] = (0, import_react3.useState)({ kind: "clean" });
      const [sync, setSync] = (0, import_react3.useState)({ running: false, result: null, error: null });
      const [lookup, setLookup] = (0, import_react3.useState)({ open: false, keyword: "", loading: false, result: null, error: null });
      const [holiday, setHoliday] = (0, import_react3.useState)({ running: false, result: null, error: null });
      const [picked, setPicked] = (0, import_react3.useState)(readPicked);
      const [calendarOpen, setCalendarOpen] = (0, import_react3.useState)(false);
      const searchButtonRef = (0, import_react3.useRef)(null);
      const restoreLookupFocusRef = (0, import_react3.useRef)(false);
      const choosePicked = (0, import_react3.useCallback)((pick) => {
        setPicked(pick);
        rememberPicked(pick);
      }, []);
      const changes = (0, import_react3.useMemo)(() => stagedChanges(state, baseline), [state, baseline]);
      const stateRef = (0, import_react3.useRef)(state);
      stateRef.current = state;
      const baselineRef = (0, import_react3.useRef)(baseline);
      baselineRef.current = baseline;
      const timerRef = (0, import_react3.useRef)(null);
      const writingRef = (0, import_react3.useRef)(false);
      const againRef = (0, import_react3.useRef)(false);
      const aliveRef = (0, import_react3.useRef)(true);
      const writeGenRef = (0, import_react3.useRef)(0);
      const committedRef = (0, import_react3.useRef)(false);
      const refreshRef = (0, import_react3.useRef)(null);
      const notifyChanged = (0, import_react3.useCallback)(() => {
        if (refreshRef.current !== null) window.clearTimeout(refreshRef.current);
        refreshRef.current = window.setTimeout(() => {
          refreshRef.current = null;
          onChanged();
        }, REFRESH_MERGE_MS);
      }, [onChanged]);
      const loadViewRef = (0, import_react3.useRef)(null);
      const seed = (0, import_react3.useCallback)((next) => {
        const nextState = draftFromView(next);
        const nextBaseline = baselineOfDraft(nextState);
        setView(next);
        setState(nextState);
        setBaseline(nextBaseline);
      }, []);
      const loadView = (0, import_react3.useCallback)(async () => {
        setLoadError(null);
        const gen = writeGenRef.current;
        try {
          const res = await fetch(ROUTE_PRICING);
          if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
          const raw = await res.json();
          if (!aliveRef.current || writeGenRef.current !== gen) return;
          const body = readPricingView(raw);
          if (body === null) throw new Error("响应不是一份价格表视图");
          if (staged === null) {
            seed(body);
            return;
          }
          const merged = mergeStaged(body, staged);
          setView(body);
          setState(merged.state);
          setBaseline(merged.baseline);
        } catch (err) {
          if (aliveRef.current && writeGenRef.current === gen) setLoadError(err instanceof Error ? err.message : String(err));
        }
      }, [seed]);
      loadViewRef.current = loadView;
      (0, import_react3.useEffect)(() => {
        if (staged !== null) committedRef.current = true;
        void loadView();
      }, [loadView]);
      (0, import_react3.useEffect)(() => subscribeLedgerChanges(() => {
        if (document.hidden) return;
        void loadViewRef.current?.();
      }), []);
      const syncFromUserRef = (0, import_react3.useRef)(false);
      const runSync = (0, import_react3.useCallback)(async (force) => {
        syncFromUserRef.current = force;
        setSync({ running: true, result: null, error: null });
        try {
          const result = await postPricingSync(force);
          setSync({ running: false, result, error: null });
          if (result.added > 0) await loadViewRef.current?.();
        } catch (err) {
          setSync({ running: false, result: null, error: err instanceof Error ? err.message : String(err) });
        }
      }, []);
      const postLookup = (0, import_react3.useCallback)((keyword) => {
        const query = `?${new URLSearchParams({ [QUERY_MODEL]: keyword }).toString()}`;
        return fetch(`${ROUTE_PRICING_LOOKUP}${query}`).then(async (res) => {
          const payload = await res.json().catch(() => null);
          if (!res.ok || payload === null) throw new Error(payload?.error ?? `HTTP ${String(res.status)}`);
          return payload;
        });
      }, []);
      const doSearch = (0, import_react3.useCallback)(async (keyword) => {
        setLookup((current) => ({ ...current, loading: true, error: null }));
        try {
          const result = await postLookup(keyword);
          if (!aliveRef.current) return;
          setLookup((current) => current.open ? { ...current, loading: false, result, error: null } : { ...current, loading: false });
        } catch (err) {
          if (!aliveRef.current) return;
          setLookup((current) => current.open ? { ...current, loading: false, result: null, error: err instanceof Error ? err.message : String(err) } : { ...current, loading: false });
        }
      }, [postLookup]);
      const changeKeyword = (0, import_react3.useCallback)((text) => {
        setLookup((current) => ({ ...current, keyword: text, result: null, error: null }));
      }, []);
      const closeLookup = (0, import_react3.useCallback)(() => {
        restoreLookupFocusRef.current = true;
        setLookup((current) => ({ ...current, open: false }));
      }, []);
      (0, import_react3.useEffect)(() => {
        if (!restoreLookupFocusRef.current || lookup.open || lookup.loading) return;
        restoreLookupFocusRef.current = false;
        searchButtonRef.current?.focus();
      }, [lookup.open, lookup.loading]);
      const autoSyncedRef = (0, import_react3.useRef)(false);
      (0, import_react3.useEffect)(() => {
        if (autoSyncedRef.current) return;
        autoSyncedRef.current = true;
        void runSync(false);
      }, [runSync]);
      const writeNow = (0, import_react3.useCallback)(async () => {
        if (stagedChanges(stateRef.current, baselineRef.current) === 0) return;
        if (writingRef.current) {
          againRef.current = true;
          return;
        }
        const snapshot = stateRef.current;
        const composed = composePriceBody(snapshot);
        if (!composed.ok) {
          if (committedRef.current && aliveRef.current) setSave({ kind: "invalid", message: composed.error });
          return;
        }
        writingRef.current = true;
        if (aliveRef.current) setSave({ kind: "saving" });
        const result = await putPrice(composed.body);
        writingRef.current = false;
        if (!result.ok) {
          if (aliveRef.current) setSave({ kind: "error", message: result.error });
          return;
        }
        const nextBaseline = baselineOfDraft(snapshot);
        baselineRef.current = nextBaseline;
        writeGenRef.current += 1;
        committedRef.current = false;
        if (staged !== null) {
          staged = stagedChanges(staged.state, nextBaseline) > 0 ? { ...staged, baseline: nextBaseline } : null;
        }
        const queued = againRef.current;
        againRef.current = false;
        if (!aliveRef.current) {
          onDirtyChange?.(stagedChanges(stateRef.current, baselineRef.current) > 0);
          notifyChanged();
          if (queued) void writeNow();
          return;
        }
        setBaseline(nextBaseline);
        setSave({ kind: "saved", at: Date.now() });
        notifyChanged();
        if (queued) void writeNow();
      }, [notifyChanged, onDirtyChange]);
      const writeRef = (0, import_react3.useRef)(writeNow);
      writeRef.current = writeNow;
      (0, import_react3.useEffect)(() => {
        if (changes === 0) {
          committedRef.current = false;
          setSave((current) => current.kind === "pending" || current.kind === "invalid" || current.kind === "error" ? { kind: "clean" } : current);
          return;
        }
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        setSave((current) => current.kind === "error" || current.kind === "invalid" ? current : { kind: "pending" });
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          void writeRef.current();
        }, AUTO_SAVE_DELAY_MS);
        return () => {
          if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        };
      }, [changes, state]);
      (0, import_react3.useEffect)(() => {
        if (view === null) return;
        staged = changes > 0 ? { view, state, baseline } : null;
        if (changes === 0) lastView = view;
      }, [view, state, baseline, changes]);
      (0, import_react3.useEffect)(() => {
        onDirtyChange?.(changes > 0);
      }, [changes, onDirtyChange]);
      (0, import_react3.useEffect)(() => {
        aliveRef.current = true;
        return () => {
          aliveRef.current = false;
          if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          if (refreshRef.current !== null) {
            window.clearTimeout(refreshRef.current);
            refreshRef.current = null;
            onChanged();
          }
          if (stagedChanges(stateRef.current, baselineRef.current) > 0) void writeNow();
        };
      }, [writeNow, onChanged]);
      const updateModel = (0, import_react3.useCallback)((route, model, next) => {
        setState((current) => {
          const card2 = current.routes.get(route);
          if (card2 === void 0) return current;
          const models2 = new Map(card2.models);
          models2.set(model, next);
          const routes = new Map(current.routes);
          routes.set(route, { ...card2, models: models2 });
          return { ...current, routes };
        });
      }, []);
      const updateBilling = (0, import_react3.useCallback)((route, billing) => {
        setState((current) => {
          const card2 = current.routes.get(route);
          if (card2 === void 0) return current;
          const routes = new Map(current.routes);
          routes.set(route, { ...card2, billing });
          return { ...current, routes };
        });
      }, []);
      const updateCalendar = (0, import_react3.useCallback)((year, next) => {
        setState((current) => {
          const calendar = new Map(current.calendar);
          if (next === null) calendar.delete(year);
          else calendar.set(year, next);
          return withCalendar(adoptYear(current, year), calendar);
        });
      }, []);
      const runHolidaySync = (0, import_react3.useCallback)(async (force, extraYears = []) => {
        setHoliday({ running: true, result: null, error: null });
        try {
          const query = new URLSearchParams();
          if (force) query.set(QUERY_FORCE, "1");
          for (const year of extraYears) query.append(QUERY_YEAR, year);
          const suffix = query.toString() === "" ? "" : `?${query.toString()}`;
          const res = await fetch(`${ROUTE_HOLIDAY_SYNC}${suffix}`, { method: "POST" });
          const payload = await res.json().catch(() => null);
          if (!res.ok || payload === null) throw new Error(payload?.error ?? `HTTP ${String(res.status)}`);
          setHoliday({ running: false, result: payload, error: null });
          if (payload.changed || payload.fetched.length > 0) await loadViewRef.current?.();
        } catch (err) {
          setHoliday({ running: false, result: null, error: err instanceof Error ? err.message : String(err) });
        }
      }, []);
      const updateFx = (0, import_react3.useCallback)((text) => {
        setState((current) => withFx(current, text));
      }, []);
      const changeCurrency = (0, import_react3.useCallback)((route, next) => {
        setState((current) => withRouteCurrency(current, route, next, fxValue(current.fx)));
      }, []);
      const autoHolidayRef = (0, import_react3.useRef)(false);
      (0, import_react3.useEffect)(() => {
        if (autoHolidayRef.current) return;
        if (view === null) return;
        autoHolidayRef.current = true;
        void runHolidaySync(false, view.calendarMissing);
      }, [view, runHolidaySync]);
      (0, import_react3.useEffect)(() => {
        const onKeyDown = (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (changes > 0) {
              if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
              }
              void writeNow();
            }
          }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
      }, [changes, writeNow]);
      const routeChoices = (0, import_react3.useMemo)(() => [...state.routes.values()], [state.routes]);
      const card = routeChoices.find((item) => item.route === picked?.route) ?? routeChoices[0];
      const models = card === void 0 ? [] : [...card.models.values()];
      const row = models.find((item) => item.model === picked?.model) ?? models[0];
      const stateText = saveStateText(save);
      const syncLine = view === null ? null : describeSync(view.sync, sync, syncFromUserRef.current);
      const syncTone = syncLine === null ? "quiet" : syncLine.tone;
      const syncGapsPrefix = syncLine === null ? "" : syncLine.prefix;
      const syncActionText = syncLine === null ? "取价" : syncLine.action;
      const rate = fxValue(state.fx);
      const fxProblem = fxIssue(state.fx);
      const openLookup = (0, import_react3.useCallback)(() => {
        if (card === void 0 || row === void 0) return;
        restoreLookupFocusRef.current = false;
        setLookup({ open: true, keyword: row.model, loading: true, result: null, error: null });
        void doSearch(row.model);
      }, [card, row, doSearch]);
      const adopt = (0, import_react3.useCallback)((candidate) => {
        if (card === void 0 || row === void 0) return;
        if (card.currency !== "USD") {
          setLookup((current) => ({ ...current, error: "这条通道的价按人民币记，models.dev 只有美元价。要填进来的话，先在详情头把报价币种切成美元——那会把整条通道已有的价按汇率换算一次。" }));
          return;
        }
        const next = {
          ...row,
          input: String(candidate.cost.input),
          output: String(candidate.cost.output),
          cacheRead: candidate.cost.cacheRead !== void 0 ? String(candidate.cost.cacheRead) : "",
          cacheWrite: candidate.cost.cacheWrite !== void 0 ? String(candidate.cost.cacheWrite) : ""
        };
        updateModel(card.route, row.model, next);
        closeLookup();
      }, [card, row, updateModel, closeLookup]);
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "section",
        {
          className: "dtpl-price-sec",
          onBlur: (event) => {
            if (event.target instanceof HTMLSelectElement) return;
            if (stagedChanges(stateRef.current, baselineRef.current) === 0) return;
            committedRef.current = true;
            void writeRef.current();
          },
          children: [
            state.routes.size > 0 && card !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-price-pick", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-price-pick-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-pick-k", children: "通道" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "select",
                  {
                    className: "dtpl-price-select dtpl-price-pick-sel",
                    value: card.route,
                    "aria-label": "通道",
                    onChange: (event) => {
                      choosePicked({ route: event.target.value, model: "" });
                    },
                    children: routeChoices.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: item.route, children: routeOptionLabel(item) }, item.route))
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-price-pick-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-pick-k", children: "模型" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "select",
                  {
                    className: "dtpl-price-select dtpl-price-pick-sel",
                    value: row === void 0 ? "" : row.model,
                    disabled: models.length === 0,
                    "aria-label": `${card.label} 的模型`,
                    onChange: (event) => {
                      choosePicked({ route: card.route, model: event.target.value });
                    },
                    children: models.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: item.model, children: modelOptionLabel(item, modelDirty(card.route, item, baseline.models)) }, item.model))
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-price-pick-row dtpl-price-pick-fxrow", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-pick-k", children: "汇率" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dtpl-price-fx", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-fx-eq", children: "1 美元 =" }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "input",
                    {
                      className: "dtpl-price-input dtpl-price-fx-in",
                      type: "text",
                      inputMode: "decimal",
                      autoComplete: "off",
                      spellCheck: false,
                      value: state.fx,
                      placeholder: "—",
                      "aria-label": "汇率：1 美元等于多少元",
                      "aria-invalid": fxProblem !== null || void 0,
                      title: "1 美元等于多少元。它不动价文件里已写的数，但会重算按美元报价的通道的金额——那些价是美元记的，人民币数字本来就是汇率的函数。人民币通道一分不动。",
                      onChange: (event) => updateFx(event.target.value),
                      onKeyDown: (event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-fx-unit", children: "元" }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-fx-note", children: inverseHint(rate) ?? "填了才能按美元报价" })
                ] }),
                fxProblem !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-fx-err", role: "alert", children: fxProblem })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                "div",
                {
                  className: "dtpl-price-pick-row dtpl-price-pick-state",
                  "data-quiet": save.kind === "clean" && changes === 0 ? "true" : void 0,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-pick-k", children: "状态" }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dtpl-price-state-row", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `dtpl-price-state is-${save.kind}`, role: "status", "aria-live": "polite", children: stateText === "" ? "与磁盘一致" : stateText }),
                      save.kind === "error" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dtpl-price-ghost", onClick: () => void writeNow(), children: "重试" })
                    ] })
                  ]
                }
              )
            ] }),
            view !== null && view.calendarMissing.length > 0 && (() => {
              const missing = view.calendarMissing;
              const autoFailed = view.holidaySync !== void 0 && (view.holidaySync.state === "failed" || view.holidaySync.state === "missing");
              return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-price-calarm", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dtpl-price-calarm-text", role: "status", children: [
                  "缺 ",
                  missing.join("、"),
                  " 年的法定节假日安排：「法定工作日」时段会把那几年的节假日按高峰多算。",
                  autoFailed && "自动拉取没成功，可以展开年历手动填（手写永远优先）。",
                  holiday.error !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("b", { children: [
                    "（自动拉取失败：",
                    holiday.error,
                    "）"
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dtpl-price-calarm-act",
                    "aria-controls": "price-calendar",
                    disabled: holiday.running,
                    title: "从 holiday-cn 拉这几年的法定节假日安排（它每日抓国务院公告，按年一份 JSON）。手写过的年份不受影响。",
                    onClick: () => {
                      void runHolidaySync(true, missing);
                      setCalendarOpen(true);
                      document.getElementById("price-calendar")?.scrollIntoView({ block: "nearest" });
                    },
                    children: holiday.running ? "拉取中…" : `↻ 自动拉取 ${missing.length > 2 ? `${String(missing.length)} 年` : `${missing.join("、")} 年`}`
                  }
                )
              ] });
            })(),
            loadError !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-error", role: "alert", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "dtpl-error-text", children: [
                "价格表加载失败：",
                loadError
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dtpl-retry", onClick: () => void loadView(), children: "重试" })
            ] }),
            view === null ? loadError === null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-skeleton", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dtpl-sk dtpl-price-sk-pick" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dtpl-sk dtpl-price-sk-open" })
            ] }) : null : state.routes.size === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-empty", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dtpl-empty-title", children: "没有可显示的通道" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dtpl-empty-sub", children: "通道来自本机 settings.yaml 与正在运行的适配器；账本或价格表里出现过的通道也会列出来。" })
            ] }) : row === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-empty", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dtpl-empty-title", children: "这条通道没有列出的模型" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dtpl-empty-sub", children: "它的模型目录与账本里都没有模型；账本记过它时这里就会多出一行。" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "button",
                {
                  type: "button",
                  className: "dtpl-price-add dtpl-price-empty-act",
                  onClick: () => {
                    setPicked(null);
                    rememberPicked(null);
                  },
                  children: "看第一条通道"
                }
              )
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              ModelDetail,
              {
                route: card.route,
                row,
                billing: card.billing,
                baseline: baseline.models,
                holidays: state.holidays,
                currency: card.currency,
                rate,
                onCurrency: (next) => changeCurrency(card.route, next),
                onRowChange: updateModel,
                onBilling: updateBilling
              },
              rowKey(card.route, row.model)
            ),
            state.routes.size > 0 && view !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-price-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dtpl-price-actions-fill", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `dtpl-price-actions-note${syncTone === "quiet" ? "" : ` is-${syncTone}`}`, children: syncGapsPrefix }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dtpl-price-actions-link",
                    disabled: sync.running,
                    title: `从 ${view.sync.source.label}（公共美元价目录）取一次：只填账本用过、还没有价的美元通道格，你手写的价一格不动。平时每天自动一次；这里是「现在就取」。`,
                    onClick: () => void runSync(true),
                    children: sync.running ? "正在取价…" : syncActionText
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "button",
                {
                  type: "button",
                  className: "dtpl-price-tool",
                  ref: searchButtonRef,
                  "aria-haspopup": "dialog",
                  "aria-expanded": lookup.open,
                  disabled: lookup.loading || card === void 0 || row === void 0,
                  title: "按名字在 models.dev 里搜原厂价，选中一条填进当前这一行的四档（会覆盖这一行已填的数）。只在美元报价的通道上可用。",
                  onClick: () => void openLookup(),
                  children: "搜索价"
                }
              )
            ] }),
            lookup.open && card !== void 0 && row !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              LookupPanel,
              {
                lookup,
                currency: card.currency,
                currentModel: row.model,
                onKeywordChange: changeKeyword,
                onSearch: doSearch,
                onAdopt: adopt,
                onClose: closeLookup
              }
            ),
            view !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              CalendarEditor,
              {
                entries: state.calendar,
                missingYears: view.calendarMissing,
                autoYears: [...state.autoYears].sort((left, right) => left.localeCompare(right)),
                sync: view.holidaySync,
                dirty: calendarDirty(state, baseline),
                expanded: calendarOpen,
                onExpandedChange: setCalendarOpen,
                onChange: updateCalendar,
                onAutoRefresh: () => void runHolidaySync(true, view.calendarMissing),
                syncing: holiday.running
              }
            )
          ]
        }
      );
    }
    function saveStateText(save) {
      switch (save.kind) {
        case "pending":
          return "待保存…";
        case "saving":
          return "保存中…";
        case "saved":
          return `已保存 ${clockOf(save.at)}`;
        case "invalid":
          return `未保存：${save.message}`;
        case "error":
          return `保存失败：${save.message}`;
        default:
          return "";
      }
    }
    function describeSync(view, ui, fromUser) {
      if (ui.running) return { prefix: "", action: "正在取价…", tone: "quiet" };
      if (ui.error !== null) return { prefix: `取价失败：${ui.error}（手写的价没动）`, action: "", tone: "err" };
      if (ui.result !== null && fromUser) {
        if (ui.result.throttled === true) return { prefix: "刚刚已经取过了", action: "", tone: "quiet" };
        if (ui.result.added === 0 && ui.result.skipped === 0) return { prefix: "没有要填的价", action: "", tone: "quiet" };
        const parts = [ui.result.added > 0 ? `填上了 ${String(ui.result.added)} 个模型的价` : "没有要填的价"];
        if (ui.result.skipped > 0) parts.push(`跳过 ${String(ui.result.skipped)} 个（目录里没有，或不是美元通道）`);
        return { prefix: parts.join(" · "), action: "", tone: "quiet" };
      }
      if (view.state === "failed") {
        return { prefix: `上次取价失败${view.lastError === null ? "" : `（${view.lastError}）`}，`, action: "重试", tone: "err" };
      }
      if (view.gaps > 0) {
        return { prefix: `${String(view.gaps)} 个用过的模型还没价，`, action: "现在取价", tone: "warn" };
      }
      if (view.lastAttemptAt === null) return { prefix: "价由 models.dev 每天自动取，", action: "现在取一次", tone: "quiet" };
      if (view.state === "stale") return { prefix: "价是上次取的，", action: "现在取价", tone: "quiet" };
      return { prefix: "价已是最新（models.dev 每天自动取），", action: "重新取", tone: "quiet" };
    }
    function LookupPanel({ lookup, currency, currentModel, onKeywordChange, onSearch, onAdopt, onClose }) {
      const canSearch = lookup.keyword.trim() !== "";
      const exactKey = normalizeModelId(lookup.keyword);
      const isUsd = currency === "USD";
      const currentKey = normalizeModelId(currentModel);
      const panelRef = (0, import_react3.useRef)(null);
      const inputRef = (0, import_react3.useRef)(null);
      (0, import_react3.useEffect)(() => {
        panelRef.current?.scrollIntoView({ block: "nearest" });
        inputRef.current?.focus({ preventScroll: true });
      }, []);
      (0, import_react3.useEffect)(() => {
        if (lookup.result === null && lookup.error === null) return;
        panelRef.current?.scrollIntoView({ block: "nearest" });
      }, [lookup.result, lookup.error]);
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          className: "dtpl-price-lookup",
          role: "dialog",
          "aria-label": "从 models.dev 选一份价填进这一行",
          ref: panelRef,
          onKeyDown: (event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-price-lookup-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-lookup-k", children: "在 models.dev 里找这个模型" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "input",
                {
                  className: "dtpl-price-input dtpl-price-lookup-input",
                  type: "text",
                  ref: inputRef,
                  value: lookup.keyword,
                  placeholder: "模型名（如 deepseek-v4-flash）",
                  "aria-label": "搜索关键词",
                  spellCheck: false,
                  autoComplete: "off",
                  onChange: (event) => onKeywordChange(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === "Enter" && canSearch) void onSearch(lookup.keyword);
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "button",
                {
                  type: "button",
                  className: "dtpl-price-ghost",
                  disabled: !canSearch || lookup.loading,
                  onClick: () => void onSearch(lookup.keyword),
                  children: "搜索"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dtpl-price-ghost", "aria-label": "关闭搜索价", onClick: onClose, children: "×" })
            ] }),
            !isUsd && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dtpl-price-lookup-note", children: "这条通道的价按人民币记，而 models.dev 只有美元价。要填进来的话，先在详情头把报价币种切成美元—— 那会把整条通道已有的价按汇率换算一次，是真改价。" }),
            lookup.loading ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dtpl-price-lookup-empty", children: "搜索中…" }) : lookup.error !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "dtpl-price-lookup-empty", children: [
              "搜索失败：",
              lookup.error,
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dtpl-price-ghost", onClick: () => void onSearch(lookup.keyword), children: "重试" })
            ] }) : lookup.result !== null && lookup.result.candidates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "dtpl-price-lookup-empty", children: [
              "没找到与「",
              lookup.keyword,
              "」相关的模型（只收原厂挂牌价，转售商与价格分裂的条目不列）。 换个关键词试试：模型串，或者只敲厂商名如 deepseek / qwen。"
            ] }) : lookup.result !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { className: "dtpl-price-lookup-list", children: lookup.result.candidates.map((candidate) => {
              const isExact = candidate.key === exactKey;
              const isCurrent = candidate.key === currentKey;
              return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                "li",
                {
                  className: `dtpl-price-lookup-item${isExact ? " is-exact" : ""}`,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dtpl-price-lookup-id", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-lookup-provider", children: candidate.provider }),
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-lookup-slash", children: "/" }),
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: candidate.modelId }),
                      isExact && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-lookup-badge", title: "与你搜的关键词是同一个模型", children: "就是搜的这个" }),
                      isCurrent && !isExact && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dtpl-price-lookup-badge", title: "就是当前这一行正在编辑的模型", children: "当前这一行" })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dtpl-price-lookup-name", children: candidate.name }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dtpl-price-lookup-cost", children: lookupCostText(candidate.cost) }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                      "button",
                      {
                        type: "button",
                        className: "dtpl-price-ghost",
                        "aria-label": `把 ${candidate.provider}/${candidate.modelId} 的价填进这一行`,
                        disabled: !isUsd,
                        title: isUsd ? `把 ${candidate.provider}/${candidate.modelId} 的价填进这一行（覆盖这一行已填的四档）` : "这条通道按人民币报价，models.dev 只有美元价；先在详情头把报价币种切成美元",
                        onClick: () => onAdopt(candidate),
                        children: "填进这一行"
                      }
                    )
                  ]
                },
                `${candidate.provider}/${candidate.modelId}`
              );
            }) })
          ]
        }
      );
    }
    function lookupCostText(cost) {
      const parts = [`$${String(cost.input)}`, `$${String(cost.output)}`];
      if (cost.cacheRead !== void 0) parts.push(`读 $${String(cost.cacheRead)}`);
      if (cost.cacheWrite !== void 0) parts.push(`写 $${String(cost.cacheWrite)}`);
      return `${parts.join(" / ")} / 百万词元`;
    }
    
    // src/client/quota/QuotaPanel.tsx
    var import_react5 = require("react");
    
    // src/quota.ts
    var OPENCODE_GO_PROVIDER = "opencode-go";
    var COMMAND_CODE_PROVIDER = "commandcode";
    var BUILTIN_PLAN_TITLES = {
      [OPENCODE_GO_PROVIDER]: "OpenCode Go",
      [COMMAND_CODE_PROVIDER]: "Command Code"
    };
    var BUILTIN_KEY_ENV = {
      [OPENCODE_GO_PROVIDER]: "OPENCODE_GO_API_KEY",
      [COMMAND_CODE_PROVIDER]: "COMMANDCODE_API_KEY"
    };
    function orderQuotaProviders(providers, gateOf) {
      const active2 = [];
      const retired = [];
      for (const provider of providers) {
        const gate = gateOf(provider);
        if (gate !== void 0 && gate !== "subscription") retired.push(provider);
        else active2.push(provider);
      }
      return [...active2, ...retired];
    }
    
    // src/client/quota/QuotaCard.tsx
    var import_react4 = require("react");
    
    // src/client/format.ts
    function shiftDayKey(day, delta) {
      const [year, month, date] = day.split("-").map(Number);
      const shifted = new Date(year, month - 1, date + delta);
      const m = String(shifted.getMonth() + 1).padStart(2, "0");
      const d = String(shifted.getDate()).padStart(2, "0");
      return `${shifted.getFullYear()}-${m}-${d}`;
    }
    function localDayKey() {
      const now = /* @__PURE__ */ new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${now.getFullYear()}-${month}-${day}`;
    }
    function shortDay(day) {
      const [, month, date] = day.split("-");
      return `${Number(month)}/${Number(date)}`;
    }
    function share(value, total) {
      if (total <= 0) return 0;
      return Math.max(0, Math.min(100, value / total * 100));
    }
    function formatShare(value, total) {
      const percent = share(value, total);
      if (percent <= 0) return "0%";
      if (percent < 1) return "<1%";
      const rounded = Math.round(percent);
      if (rounded >= 100 && percent < 100) return ">99%";
      return `${rounded}%`;
    }
    function formatRatio(part, whole) {
      if (whole <= 0) return null;
      const percent = Math.min(100, part / whole * 100);
      return (Math.floor(percent * 10) / 10).toFixed(1);
    }
    function formatTokens(value) {
      if (value < 1e3) return String(value);
      if (value < 1e6) return `${Math.round(value / 1e3 * 10) / 10}K`;
      return `${Math.round(value / 1e6 * 10) / 10}M`;
    }
    function formatMoney(value) {
      return `¥${value.toFixed(2)}`;
    }
    function formatDuration(ms) {
      const seconds = ms / 1e3;
      if (seconds < 60) return `${String(Math.round(seconds * 10) / 10)}秒`;
      if (seconds < 3600) {
        const whole2 = Math.round(seconds);
        return `${String(Math.floor(whole2 / 60))}分${String(whole2 % 60)}秒`;
      }
      const whole = Math.round(seconds / 60);
      const minutes = whole % 60;
      return `${String(Math.floor(whole / 60))}时${String(minutes).padStart(2, "0")}分`;
    }
    function formatDateTime(epochMs) {
      const d = new Date(epochMs);
      return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
    }
    function formatRelative(epochMs, now = /* @__PURE__ */ new Date()) {
      const t = new Date(epochMs);
      const elapsed = now.getTime() - epochMs;
      if (elapsed >= 0 && elapsed < 6e4) return "刚刚";
      if (elapsed >= 0 && elapsed < 36e5) return `${Math.floor(elapsed / 6e4)} 分钟前`;
      const sameDay = t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate();
      if (elapsed >= 0 && sameDay) return `${Math.floor(elapsed / 36e5)} 小时前`;
      const hhmm = t.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      const monthDay = `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      if (t.getFullYear() === now.getFullYear()) {
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        if (t.getFullYear() === yesterday.getFullYear() && t.getMonth() === yesterday.getMonth() && t.getDate() === yesterday.getDate()) {
          return `昨天 ${hhmm}`;
        }
        return `${monthDay} ${hhmm}`;
      }
      return `${String(t.getFullYear()).slice(2)}-${monthDay} ${hhmm}`;
    }
    
    // src/client/quota/metrics.ts
    function toneOf(pct) {
      if (pct >= 85) return "danger";
      if (pct >= 60) return "warn";
      return "ok";
    }
    function balanceUsd(credits) {
      if (credits === void 0) return 0;
      return (credits.monthlyUsd ?? 0) + (credits.purchasedUsd ?? 0) + (credits.freeUsd ?? 0);
    }
    function extraCreditsUsd(credits) {
      return (credits.purchasedUsd ?? 0) + (credits.freeUsd ?? 0);
    }
    function allowanceState(card) {
      const monthly = card.credits?.monthlyUsd;
      if (monthly === void 0) return null;
      const remaining = monthly;
      const spent = card.usage?.costUsd;
      const total = spent !== void 0 ? spent + remaining : void 0;
      const percent = total !== void 0 && total > 0 ? Math.min(100, Math.max(0, spent / total * 100)) : 0;
      return {
        remaining,
        spent,
        total,
        percent,
        tone: toneOf(percent)
      };
    }
    function monthlyAllowanceWindow(card) {
      const a = allowanceState(card);
      if (a === null || a.spent === void 0 || a.total === void 0) return null;
      return {
        id: "monthlyAllowance",
        label: "本月额度",
        usagePercent: a.percent,
        exceeded: a.percent >= 100,
        resetAt: card.planInfo?.periodEnd ?? null,
        usedUsd: a.spent,
        capUsd: a.total
      };
    }
    function ringPressure(card) {
      if (card.gate !== void 0 && card.gate !== "subscription") return void 0;
      const monthly = card.windows.find((w) => w.id === "monthly");
      if (monthly !== void 0) {
        return { pct: monthly.usagePercent, tone: toneOf(monthly.usagePercent), cap: "本月" };
      }
      const allowance = allowanceState(card);
      if (allowance !== null && allowance.spent !== void 0 && allowance.total !== void 0) {
        return { pct: allowance.percent, tone: allowance.tone, cap: "本月" };
      }
      let worst;
      for (const w of card.windows) {
        if (worst === void 0 || w.usagePercent > worst.usagePercent) worst = w;
      }
      if (worst === void 0) return void 0;
      return { pct: worst.usagePercent, tone: toneOf(worst.usagePercent), cap: worst.label };
    }
    function headStateWord(card) {
      if (card === null) return { word: "—", alert: false };
      if (card.state === "error") return { word: "失败", alert: true };
      if (card.state === "unconfigured") return { word: "未配置", alert: false };
      if (card.gate !== void 0 && card.gate !== "subscription") {
        const ended = card.planInfo?.periodEnd;
        return ended !== void 0 && ended !== null && ended <= Date.now() ? { word: "过期", alert: false } : { word: "无订阅", alert: false };
      }
      return { word: "无读数", alert: false };
    }
    function resetLabel(window2) {
      if (window2.resetAt === null) return "—";
      const ms = window2.resetAt - Date.now();
      if (ms <= 0) return "即将重置";
      const totalMin = Math.ceil(ms / 6e4);
      if (totalMin < 60) return `${totalMin} 分钟后重置`;
      const totalHours = Math.ceil(totalMin / 60);
      if (totalHours < 24) return `${totalHours} 小时后重置`;
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      return hours > 0 ? `${days} 天 ${hours} 小时后重置` : `${days} 天后重置`;
    }
    function planContext(card) {
      const bits = [];
      const account = card.account?.name;
      if (account !== void 0 && account !== "") bits.push(account);
      const planName = card.planInfo?.name;
      if (planName !== void 0 && planName !== "") {
        const status = card.planInfo?.status;
        bits.push(status !== void 0 && status !== "active" && status !== "" ? `${planName}（${status}）` : planName);
      }
      const periodEnd = card.planInfo?.periodEnd;
      if (card.gate !== "balance" && card.gate !== "none" && card.credits === void 0 && periodEnd !== void 0 && periodEnd !== null && periodEnd > 0) {
        bits.push(`至 ${new Date(periodEnd).toLocaleDateString()}`);
      }
      return bits.join(" · ");
    }
    function money(value) {
      return `$${value.toFixed(2)}`;
    }
    function formatClock(epochMs) {
      return new Date(epochMs).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
    
    // src/client/quota/QuotaCard.tsx
    var import_jsx_runtime5 = require("react/jsx-runtime");
    function QuotaCardView({ provider, card, error, loading, onRefresh }) {
      const title = card?.title ?? provider;
      const ok = card !== null && card.state === "ok";
      const ctx = ok && card !== null ? planContext(card) : "";
      const ring = ok && card !== null ? ringPressure(card) : void 0;
      const idle = headStateWord(card);
      const [popTick, setPopTick] = (0, import_react4.useState)(0);
      const handleRefresh = () => {
        setPopTick((t) => t + 1);
        onRefresh();
      };
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: "dtpl-quota-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { className: "dtpl-quota-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-id", children: [
            card !== null && ring !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(QuotaGauge, { pct: ring.pct, tone: ring.tone, cap: ring.cap }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(QuotaIdleRing, { word: idle.word, alert: idle.alert }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dtpl-quota-id-text", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-name", children: title }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-sub", children: ok && card !== null ? `${provider}${ctx !== "" ? ` · ${ctx}` : ""}` : provider })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-head-side", children: [
            ok && card !== null && card.fetchedAt !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dtpl-quota-updated", children: [
              "更新于 ",
              formatClock(card.fetchedAt)
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "button",
              {
                type: "button",
                className: "dtpl-quota-refresh",
                onClick: handleRefresh,
                disabled: loading,
                "aria-label": `刷新 ${title} 用量`,
                title: "刷新此卡片",
                children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `dtpl-quota-refresh-anim${popTick > 0 ? " dtpl-quota-refresh-pop" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(RefreshGlyph, { className: `dtpl-quota-refresh-ico${loading ? " dtpl-spin" : ""}` }) }, popTick)
              }
            )
          ] })
        ] }),
        card === null && loading ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(QuotaCardSkeleton, {}) : card === null && error !== null ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-msg dtpl-quota-msg-err", role: "alert", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dtpl-quota-msg-title", children: "加载失败" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dtpl-quota-msg-body", children: error }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dtpl-retry", onClick: onRefresh, children: "重试" })
        ] }) : card === null ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dtpl-quota-note", children: "暂无数据" }) : card.state !== "ok" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            className: `dtpl-quota-msg dtpl-quota-msg-${card.state === "unconfigured" ? "muted" : "err"}`,
            role: card.state === "error" ? "alert" : void 0,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dtpl-quota-msg-title", children: card.state === "unconfigured" ? "未配置 API key" : "官方查询失败" }),
              card.message !== void 0 && card.message !== "" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dtpl-quota-msg-body", children: card.message })
            ]
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          error !== null && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { className: "dtpl-quota-stale", role: "status", children: [
            "刷新失败（",
            error,
            "），当前显示上次官方数据"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(QuotaCardBody, { card })
        ] })
      ] });
    }
    function QuotaCardBody({ card }) {
      if (card.gate === "balance") return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(QuotaBalanceBody, { card });
      if (card.gate === "none") return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(QuotaNoSubscriptionBody, { card });
      const rows = [...card.windows];
      const monthly = monthlyAllowanceWindow(card);
      if (monthly !== null) rows.push(monthly);
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        rows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dtpl-quota-windows", children: rows.map((window2) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(QuotaWindowRow, { window: window2 }, window2.id)) }),
        card.credits !== void 0 && extraCreditsUsd(card.credits) > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CreditSources, { credits: card.credits, extraOnly: true }),
        card.usage !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ActivityStrip, { usage: card.usage })
      ] });
    }
    function QuotaNoSubscriptionBody({ card }) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-msg dtpl-quota-msg-muted", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dtpl-quota-msg-title", children: "无生效中的订阅" }),
        card.gateNote !== void 0 && card.gateNote !== "" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dtpl-quota-msg-body", children: card.gateNote })
      ] });
    }
    function QuotaBalanceBody({ card }) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-balance", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-balance-v", children: money(balanceUsd(card.credits)) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-balance-k", children: "按量余额" })
        ] }),
        card.gateNote !== void 0 && card.gateNote !== "" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dtpl-quota-balance-note", children: card.gateNote }),
        card.credits !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CreditSources, { credits: card.credits }),
        card.usage !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ActivityStrip, { usage: card.usage })
      ] });
    }
    function CreditSources({ credits, extraOnly = false }) {
      const parts = [];
      const add = (label, value) => {
        if (value !== void 0 && value > 0) parts.push(`${label} ${money(value)}`);
      };
      if (!extraOnly) add("月额度", credits.monthlyUsd);
      add("已购", credits.purchasedUsd);
      add("赠送", credits.freeUsd);
      if (parts.length === 0) return null;
      const text = parts.join(" · ");
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dtpl-quota-sources", children: extraOnly ? `额外余额 ${text}` : text });
    }
    function QuotaWindowRow({ window: window2 }) {
      const pct = window2.usagePercent;
      const tone = toneOf(pct);
      const hasAmounts = window2.capUsd !== void 0 && window2.usedUsd !== void 0;
      const metric = hasAmounts ? `已用 ${money(window2.usedUsd)} / ${money(window2.capUsd)}` : `已用 ${pct}%`;
      const remaining = hasAmounts ? `剩余 ${money(Math.max(0, (window2.capUsd ?? 0) - (window2.usedUsd ?? 0)))}` : `剩余 ${Math.max(0, Math.round(100 - pct))}%`;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-window", "data-tone": tone, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-window-line1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-window-label", children: window2.label }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-window-metric", children: metric })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            className: "dtpl-quota-bar",
            role: "progressbar",
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            "aria-valuenow": Math.round(pct),
            "aria-label": `${window2.label} 已用 ${Math.round(pct)}%`,
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `dtpl-quota-bar-fill dtpl-quota-tone-${tone}`, style: { width: `${pct}%` } })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-window-line2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-remaining", children: remaining }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `dtpl-quota-reset${window2.exceeded ? " dtpl-quota-reset-limited" : ""}`, children: window2.exceeded ? "已超限" : resetLabel(window2) })
        ] })
      ] });
    }
    function ActivityStrip({ usage }) {
      const cells = [];
      if (usage.completed !== void 0) {
        cells.push({
          value: String(usage.completed),
          key: "完成请求",
          warn: usage.failed !== void 0 && usage.failed > 0 ? `${usage.failed} 失败` : void 0
        });
      }
      if (usage.successRate !== void 0) {
        cells.push({ value: `${usage.successRate}%`, key: "成功率" });
      }
      if (usage.tokensIn !== void 0 || usage.tokensOut !== void 0) {
        cells.push({
          value: `${formatTokens(usage.tokensIn ?? 0)} / ${usage.tokensOut !== void 0 ? formatTokens(usage.tokensOut) : "—"}`,
          key: "词元（入/出）"
        });
      }
      if (cells.length === 0) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dtpl-quota-stats", children: cells.map((cell) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dtpl-quota-stat-v", children: [
          cell.value,
          cell.warn !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: "dtpl-quota-stat-warn", children: cell.warn })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-stat-k", children: cell.key })
      ] }, cell.key)) });
    }
    var GAUGE_R = 15.5;
    var GAUGE_C = 2 * Math.PI * GAUGE_R;
    function GaugeRing({ arc }) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { viewBox: "0 0 40 40", "aria-hidden": "true", className: "dtpl-quota-gauge-svg", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { className: "dtpl-quota-gauge-track", cx: "20", cy: "20", r: GAUGE_R }),
        arc !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "circle",
          {
            className: "dtpl-quota-gauge-fill",
            cx: "20",
            cy: "20",
            r: GAUGE_R,
            strokeDasharray: `${arc} ${GAUGE_C}`,
            style: { "--dtpl-arc": `${arc}px` }
          }
        )
      ] });
    }
    function QuotaIdleRing({ word, alert }) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: `dtpl-quota-gauge dtpl-quota-gauge-idle${alert ? " dtpl-quota-tone-danger" : ""}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GaugeRing, {}),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-gauge-n", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-gauge-word", children: word }) })
      ] });
    }
    function QuotaGauge({ pct, tone, cap }) {
      const p = Math.max(0, Math.min(100, pct));
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "span",
        {
          className: `dtpl-quota-gauge dtpl-quota-tone-${tone}`,
          role: "img",
          "aria-label": `${cap} 已用 ${Math.round(p)}%`,
          title: `${cap} 已用 ${Math.round(p)}%`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GaugeRing, { arc: p / 100 * GAUGE_C }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dtpl-quota-gauge-n", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
                Math.round(p),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { children: "%" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-gauge-cap", children: cap })
            ] })
          ]
        }
      );
    }
    function QuotaCardSkeleton() {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-sk-body", "aria-hidden": "true", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dtpl-quota-sk-line dtpl-sk" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dtpl-quota-sk-bar dtpl-sk" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dtpl-quota-sk-line dtpl-quota-sk-line-short dtpl-sk" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dtpl-quota-sk-bar dtpl-sk" })
      ] });
    }
    
    // src/client/quota/QuotaPanel.tsx
    var import_jsx_runtime6 = require("react/jsx-runtime");
    var AUTO_PRESETS = [
      { min: 0, label: "关闭" },
      { min: 1, label: "1 分" },
      { min: 5, label: "5 分" },
      { min: 15, label: "15 分" },
      { min: 30, label: "30 分" }
    ];
    var DEFAULT_AUTO_MIN = 5;
    var AUTO_MIN_KEY = "dsh-tokbook.quota-auto-min";
    function readAutoMinutes() {
      try {
        const saved = localStorage.getItem(AUTO_MIN_KEY);
        if (saved === null) return DEFAULT_AUTO_MIN;
        const min = Number(saved);
        return AUTO_PRESETS.some((preset) => preset.min === min) ? min : DEFAULT_AUTO_MIN;
      } catch {
        return DEFAULT_AUTO_MIN;
      }
    }
    function readProviderList(raw) {
      if (typeof raw !== "object" || raw === null) return null;
      const { providers } = raw;
      if (!Array.isArray(providers) || !providers.every((item) => typeof item === "string")) return null;
      return providers;
    }
    function readQuotaCard(raw) {
      if (typeof raw !== "object" || raw === null) return null;
      const card = raw;
      if (typeof card.state !== "string") return null;
      if (!Array.isArray(card.windows)) return null;
      for (const window2 of card.windows) {
        if (typeof window2 !== "object" || window2 === null) return null;
      }
      if (card.credits !== void 0 && (typeof card.credits !== "object" || card.credits === null)) return null;
      if (card.usage !== void 0 && (typeof card.usage !== "object" || card.usage === null)) return null;
      return card;
    }
    var QUOTA_FRESH_MS = 6e4;
    var QUOTA_REFRESH_COOLDOWN_MS = 3e4;
    function QuotaPanel() {
      const [providers, setProviders] = (0, import_react5.useState)(null);
      const [listError, setListError] = (0, import_react5.useState)(null);
      const [autoMinutes, setAutoMinutes] = (0, import_react5.useState)(readAutoMinutes);
      const [autoTicker, setAutoTicker] = (0, import_react5.useState)(0);
      const [gates, setGates] = (0, import_react5.useState)({});
      const reportGate = (0, import_react5.useCallback)((provider, gate) => {
        setGates((prev) => {
          if (prev[provider] === gate) return prev;
          const next = { ...prev };
          if (gate === void 0) delete next[provider];
          else next[provider] = gate;
          return next;
        });
      }, []);
      const [reload, setReload] = (0, import_react5.useState)(0);
      (0, import_react5.useEffect)(() => {
        let cancelled = false;
        setListError(null);
        setProviders(null);
        fetch(ROUTE_QUOTA).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }).then((raw) => {
          if (cancelled) return;
          const list = readProviderList(raw);
          if (list === null) throw new Error("响应不是一份额度列表");
          setProviders(list);
        }).catch((err) => {
          if (!cancelled) {
            setListError(err instanceof Error ? err.message : String(err));
            setProviders([]);
          }
        });
        return () => {
          cancelled = true;
        };
      }, [reload]);
      (0, import_react5.useEffect)(() => {
        if (autoMinutes <= 0) return;
        const timer2 = setInterval(() => {
          setAutoTicker((t) => t + 1);
        }, autoMinutes * 6e4);
        return () => clearInterval(timer2);
      }, [autoMinutes]);
      const chooseAutoMinutes = (0, import_react5.useCallback)((min) => {
        setAutoMinutes(min);
        try {
          localStorage.setItem(AUTO_MIN_KEY, String(min));
        } catch {
        }
      }, []);
      const hasProviders = providers !== null && providers.length > 0;
      const ordered = (0, import_react5.useMemo)(
        () => providers === null ? [] : orderQuotaProviders(providers, (provider) => gates[provider]),
        [providers, gates]
      );
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "dtpl-quota-sec", "aria-label": "订阅额度", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "dtpl-quota-intro", children: [
          "各订阅的",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("b", { children: "官方账户用量" }),
          "（由插件用你配置的 key 直接向该通道方查询）。"
        ] }),
        hasProviders && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(AutoRefreshControl, { value: autoMinutes, onChange: chooseAutoMinutes }),
        listError !== null && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dtpl-error", role: "alert", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "dtpl-error-text", children: [
            "额度加载失败：",
            listError
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dtpl-retry", onClick: () => setReload((count) => count + 1), children: "重试" })
        ] }),
        listError !== null ? null : providers === null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dtpl-skeleton", "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dtpl-quota-sk-card dtpl-sk" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dtpl-quota-sk-card dtpl-sk" })
        ] }) : !hasProviders ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dtpl-empty", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(UsageGlyph, { className: "dtpl-empty-ico" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "dtpl-empty-title", children: "尚未配置任何订阅额度查询" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "dtpl-empty-sub", children: [
            "在插件配置的 ",
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { children: "plans" }),
            " 里为 opencode-go / commandcode 提供 API key，或在本机 Models 页填好该通道的 key，这里就会展示官方账户用量。"
          ] })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dtpl-quota-cards", children: ordered.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          QuotaCardController,
          {
            provider,
            autoTicker,
            onGate: reportGate
          },
          provider
        )) })
      ] });
    }
    function AutoRefreshControl({ value, onChange }) {
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dtpl-quota-autorefresh", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dtpl-quota-autorefresh-label", children: "自动刷新" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dtpl-quota-autorefresh-seg", role: "group", "aria-label": "自动刷新间隔", children: AUTO_PRESETS.map((preset) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "button",
          {
            type: "button",
            className: `dtpl-quota-autorefresh-opt${value === preset.min ? " dtpl-quota-autorefresh-on" : ""}`,
            "aria-pressed": value === preset.min,
            onClick: () => onChange(preset.min),
            children: preset.label
          },
          preset.min
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dtpl-quota-autorefresh-state", children: value > 0 ? `每 ${value} 分钟自动刷新` : "不自动刷新" })
      ] });
    }
    function QuotaCardController({ provider, autoTicker, onGate }) {
      const [card, setCard] = (0, import_react5.useState)(null);
      const [error, setError] = (0, import_react5.useState)(null);
      const [loading, setLoading] = (0, import_react5.useState)(true);
      const inFlight = (0, import_react5.useRef)(0);
      const lastRefreshAt = (0, import_react5.useRef)(0);
      const cardRef = (0, import_react5.useRef)(null);
      const fetchCard = (0, import_react5.useCallback)((force) => {
        const token = ++inFlight.current;
        setLoading(true);
        setError(null);
        return fetch(`${ROUTE_QUOTA}?${QUERY_PROVIDER}=${encodeURIComponent(provider)}${force ? `&${QUERY_REFRESH}=1` : ""}`).then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = readQuotaCard(await res.json());
          if (data === null) throw new Error("响应不是一份额度卡");
          return data;
        }).then((data) => {
          if (token !== inFlight.current) return null;
          cardRef.current = data;
          setCard(data);
          setError(null);
          onGate(provider, data.gate);
          return data;
        }).catch((err) => {
          if (token !== inFlight.current) return null;
          setError(err instanceof Error ? err.message : String(err));
          return null;
        }).finally(() => {
          if (token === inFlight.current) setLoading(false);
        });
      }, [provider, onGate]);
      (0, import_react5.useEffect)(() => {
        let cancelled = false;
        void fetchCard(false).then((first) => {
          if (cancelled || first === null || first.state !== "ok" || first.fetchedAt === void 0) return;
          const now = Date.now();
          if (now - first.fetchedAt <= QUOTA_FRESH_MS) return;
          if (now - lastRefreshAt.current < QUOTA_REFRESH_COOLDOWN_MS) return;
          lastRefreshAt.current = Date.now();
          void fetchCard(true);
        });
        return () => {
          cancelled = true;
          inFlight.current += 1;
        };
      }, [fetchCard]);
      const firstTick = (0, import_react5.useRef)(true);
      (0, import_react5.useEffect)(() => {
        if (firstTick.current) {
          firstTick.current = false;
          return;
        }
        const gate = cardRef.current?.gate;
        if (gate !== void 0 && gate !== "subscription") return;
        lastRefreshAt.current = Date.now();
        void fetchCard(true);
      }, [autoTicker, fetchCard]);
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        QuotaCardView,
        {
          provider,
          card,
          error,
          loading,
          onRefresh: () => {
            lastRefreshAt.current = Date.now();
            void fetchCard(true);
          }
        }
      );
    }
    
    // src/types.ts
    var PROVIDER_RANGES = ["today", "yesterday", "last7", "last30", "all"];
    function rangeCarriesMoney(range) {
      return range !== "all";
    }
    function settleTiming(rows) {
      let llmMs = 0;
      let toolMs = 0;
      for (const row of rows) {
        llmMs += row.timing?.llmMs ?? 0;
        toolMs += row.timing?.toolMs ?? 0;
      }
      return { llmMs, toolMs };
    }
    function totalsTokens(totals) {
      return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens;
    }
    
    // src/client/LedgerView.tsx
    var import_jsx_runtime7 = require("react/jsx-runtime");
    var TREND_DAYS = 14;
    var BASELINE_DAYS = 7;
    var ZERO_TOTALS = {
      requests: 0,
      inputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0
    };
    function Stat({ label, value, share: share2 }) {
      const percent = share2 > 0 ? formatRatio(share2, 100) : null;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dtpl-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dtpl-k", children: label }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dtpl-v", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: value }),
          percent !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dtpl-stat-pct", title: `占今日词元（四桶之和）的 ${percent}%`, children: [
            "占 ",
            percent,
            "%"
          ] })
        ] })
      ] });
    }
    function todayHero(overview) {
      const today = localDayKey();
      const row = overview.byDay.find((entry) => entry.day === today);
      const tokens = row === void 0 ? 0 : totalsTokens(row.totals);
      return {
        totals: row?.totals ?? ZERO_TOTALS,
        tokens,
        spend: row?.spend ?? 0,
        subscriptionValue: row?.subscriptionValue ?? 0,
        reference: todayReference(overview, today, tokens)
      };
    }
    function todayReference(overview, today, todayTokens) {
      const byDay = new Map(overview.byDay.map((entry) => [entry.day, totalsTokens(entry.totals)]));
      const noRecord = {
        label: "今天还没有记录",
        title: "本机账本今天尚未记录到任何通道计费调用。"
      };
      const young = !overview.byDay.some((entry) => entry.day <= shiftDayKey(today, -BASELINE_DAYS));
      if (young) return todayTokens === 0 ? noRecord : null;
      let sum = 0;
      for (let back = 1; back <= BASELINE_DAYS; back++) sum += byDay.get(shiftDayKey(today, -back)) ?? 0;
      const average = sum / BASELINE_DAYS;
      if (average <= 0) return todayTokens === 0 ? noRecord : null;
      if (todayTokens === 0) {
        return {
          label: `近${BASELINE_DAYS}天日均（今天还没有记录）`,
          value: formatTokens(average),
          title: `今天还没有记录；近 ${BASELINE_DAYS} 天日均 ${formatTokens(average)} 词元。`
        };
      }
      const percent = Math.round(Math.abs(todayTokens / average - 1) * 100);
      if (percent === 0) {
        return {
          label: `持平于近${BASELINE_DAYS}天日均`,
          value: formatTokens(average),
          title: `今日与近 ${BASELINE_DAYS} 天日均持平（${formatTokens(average)} 词元）。`
        };
      }
      const arrow = todayTokens > average ? "↑" : "↓";
      return {
        label: `较近${BASELINE_DAYS}天日均`,
        value: `${arrow}${percent}%`,
        title: `今日 ${formatTokens(todayTokens)} 词元，近 ${BASELINE_DAYS} 天日均 ${formatTokens(average)} 词元。`
      };
    }
    function columnHeight(tokens, max) {
      return tokens > 0 ? `max(2px, ${String(Math.round(tokens / max * 100))}%)` : "0px";
    }
    function TrendPlot({ slots, values, peak, peakIndex, max, sum }) {
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "div",
        {
          className: "dtpl-bars is-anim",
          role: "img",
          "aria-label": `近 ${String(TREND_DAYS)} 天词元柱状图：${shortDay(slots[0])} 至 ${shortDay(slots[slots.length - 1])} 共 ${String(slots.length)} 天，合计 ${formatTokens(sum)} 词元${peak > 0 ? `，峰值 ${shortDay(slots[peakIndex])} 的 ${formatTokens(peak)}` : ""}。`,
          children: values.map((tokens, index) => {
            const isPeak = index === peakIndex;
            const columnH = columnHeight(tokens, max);
            return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
              "div",
              {
                className: `dtpl-bar${tokens === 0 ? " is-zero" : ""}`,
                title: `${slots[index]}
    ${formatTokens(tokens)}`,
                style: { "--dtpl-i": index },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                    "span",
                    {
                      className: `dtpl-bar-label${isPeak ? " is-peak" : ""}${tokens === 0 ? " is-zero" : ""}`,
                      style: { bottom: `calc(${columnH} + 2px)` },
                      children: formatTokens(tokens)
                    }
                  ),
                  tokens > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                    "div",
                    {
                      className: `dtpl-bar-fill${isPeak ? " is-peak" : ""}`,
                      style: { height: columnH }
                    }
                  )
                ]
              },
              slots[index]
            );
          })
        }
      );
    }
    function DailyTrend({ days }) {
      if (days.length === 0) return null;
      const byDay = new Map(days.map((row) => [row.day, totalsTokens(row.totals)]));
      const today = localDayKey();
      const earliest = shiftDayKey(today, -(TREND_DAYS - 1));
      const start = days[0].day > earliest ? days[0].day : earliest;
      const slots = [];
      for (let day = start; day <= today; day = shiftDayKey(day, 1)) slots.push(day);
      if (slots.length === 0) return null;
      const values = slots.map((day) => byDay.get(day) ?? 0);
      const max = Math.max(...values, 1);
      const sum = values.reduce((acc, value) => acc + value, 0);
      const peak = Math.max(...values);
      const peakIndex = peak > 0 ? values.indexOf(peak) : -1;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { className: "dtpl-trend", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("h2", { className: "dtpl-sec-title", children: [
          "近 ",
          TREND_DAYS,
          " 天趋势"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          TrendPlot,
          {
            slots,
            values,
            peak,
            peakIndex,
            max,
            sum
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dtpl-trend-axis", children: slots.map((day, index) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: index === peakIndex ? "is-peak" : void 0, children: shortDay(day) }, day)) })
      ] });
    }
    function LedgerView({ overview }) {
      const money2 = (value) => formatMoney(value);
      const empty = overview.records === 0;
      const hero = todayHero(overview);
      const today = hero.totals;
      const share2 = (bucket) => hero.tokens > 0 ? bucket / hero.tokens * 100 : 0;
      const showCacheWrite = overview.byDay.some((row) => row.totals.cacheWriteTokens > 0);
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_jsx_runtime7.Fragment, { children: empty ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dtpl-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(UsageGlyph, { className: "dtpl-empty-ico" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "dtpl-empty-title", children: "还没有记录到词元用量" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "dtpl-empty-sub", children: "本插件记录本机每次模型调用的用量。先聊几句就会有数据；安装前的历史记录，点右下角「重新扫描」可以补上。" })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dtpl-hero", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dtpl-hero-top", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dtpl-hero-lead", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dtpl-hero-head", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dtpl-total-k", children: "今日词元" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dtpl-hero-figure", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dtpl-total-num", children: formatTokens(hero.tokens) }),
                hero.reference !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dtpl-hero-delta", title: hero.reference.title, children: [
                  hero.reference.value !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("b", { children: hero.reference.value }),
                    " "
                  ] }),
                  hero.reference.label
                ] })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dtpl-hero-money", children: [
              (hero.spend > 0 || hero.subscriptionValue === 0) && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dtpl-hero-money-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dtpl-hero-money-k", children: "今日实际支出" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("b", { className: `dtpl-hero-money-v${hero.spend > 0 ? " is-cash" : " is-zero"}`, children: money2(hero.spend) })
              ] }),
              hero.subscriptionValue > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dtpl-hero-money-row", title: "订阅通道的这些用量若按量付费本来要花的钱——你没有真的付它，所以它不加入今日实际支出", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dtpl-hero-money-k", children: "今日订阅价值" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("b", { className: "dtpl-hero-money-v", children: money2(hero.subscriptionValue) })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: `dtpl-grid${showCacheWrite ? "" : " dtpl-grid-3"}`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Stat, { label: "未缓存输入", value: formatTokens(today.inputTokens), share: share2(today.inputTokens) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Stat, { label: "缓存读取", value: formatTokens(today.cacheReadTokens), share: share2(today.cacheReadTokens) }),
            showCacheWrite && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Stat, { label: "缓存写入", value: formatTokens(today.cacheWriteTokens), share: share2(today.cacheWriteTokens) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Stat, { label: "输出", value: formatTokens(today.outputTokens), share: share2(today.outputTokens) })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(DailyTrend, { days: overview.byDay })
      ] }) });
    }
    function LedgerSkeleton() {
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dtpl-skeleton", "aria-hidden": "true", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dtpl-sk dtpl-sk-hero" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dtpl-sk-grid", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dtpl-sk dtpl-sk-tile" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dtpl-sk dtpl-sk-tile" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dtpl-sk dtpl-sk-tile" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dtpl-sk dtpl-sk-tile" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dtpl-sk dtpl-sk-chart" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dtpl-sk dtpl-sk-row" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dtpl-sk dtpl-sk-row" })
      ] });
    }
    
    // src/client/ProviderPanel.tsx
    var import_react6 = require("react");
    
    // src/client/ShareRing.tsx
    var import_jsx_runtime8 = require("react/jsx-runtime");
    var R = 11;
    var CIRC = 2 * Math.PI * R;
    var PX = 44;
    function ShareRing({ value, total, denom }) {
      const label = formatShare(value, total);
      const arc = share(value, total) / 100 * CIRC;
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dtpl-share-ring", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("svg", { viewBox: "-13.5 -13.5 27 27", width: PX, height: PX, "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { className: "dtpl-share-ring-track", cx: "0", cy: "0", r: R }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "circle",
            {
              className: "dtpl-share-ring-arc",
              cx: "0",
              cy: "0",
              r: R,
              transform: "rotate(-90)",
              strokeDasharray: `${arc} ${CIRC}`,
              style: { "--dtpl-arc": `${arc}px` }
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dtpl-share-ring-num", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dtpl-sr", children: [
            "占",
            denom,
            " "
          ] }),
          label.endsWith("%") ? label.slice(0, -1) : label,
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("i", { children: "%" })
        ] })
      ] });
    }
    
    // src/client/Breakdowns.tsx
    var import_jsx_runtime9 = require("react/jsx-runtime");
    function isNoPrice(cost, unpriced) {
      return unpriced && cost === 0;
    }
    function ModelRows({ byModel, totalTokens, money: money2, unpriced, showMoney }) {
      const rows = [...byModel].sort((left, right) => totalsTokens(right.totals) - totalsTokens(left.totals) || right.totals.requests - left.totals.requests || left.model.localeCompare(right.model) || left.provider.localeCompare(right.provider));
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "dtpl-models", children: rows.map((m) => {
        const noPrice = isNoPrice(m.cost, unpriced.has(`${m.provider}|${m.model}`));
        const showsSub = m.spend === 0;
        const bucket = noPrice ? "价格未知" : showsSub ? "订阅价值" : "实际支出";
        const costText = noPrice ? "价格未知：按 ¥0 计" : `${showsSub ? money2(m.subscriptionValue) : money2(m.spend)} ${bucket}`;
        const tokens = totalsTokens(m.totals);
        return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "dtpl-row", title: modelDetail(m, totalTokens, money2, noPrice, showMoney), children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "dtpl-model", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ShareRing, { value: tokens, total: totalTokens, denom: "本窗口" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "dtpl-model-txt", children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-model-name", children: m.model }),
              m.provider !== "" && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-model-provider", children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-sr", children: "通道 " }),
                m.provider
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "dtpl-model-nums", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-val", children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-sr", children: "词元 " }),
              formatTokens(tokens)
            ] }),
            showMoney && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-cost", title: costText, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-cost-seg", children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-cost-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-sr", children: "金额 " }),
                noPrice ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("b", { className: "dtpl-cost-na", children: "—" }) : showsSub ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("b", { className: "dtpl-sub-amt", children: money2(m.subscriptionValue) }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("b", { className: "dtpl-cash-amt", children: money2(m.spend) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("em", { className: "dtpl-cost-k", children: bucket })
            ] }) })
          ] })
        ] }, `${m.provider}/${m.model}`);
      }) });
    }
    function WorkspaceRows({ rows, totalTokens, money: money2, showMoney }) {
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "dtpl-models", children: rows.map((row) => {
        const failed = row.totals.failures ?? 0;
        const cash = row.spend > 0;
        const sub = row.subscriptionValue > 0;
        const costText = [
          cash || !sub ? `${money2(row.spend)} 实际支出` : "",
          sub ? `${money2(row.subscriptionValue)} 订阅价值` : ""
        ].filter((part) => part !== "").join(" · ");
        return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
          "div",
          {
            className: `dtpl-row${row.id === "" ? " is-unattributed" : ""}`,
            title: workspaceDetail(row, money2, showMoney),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "dtpl-model", children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ShareRing, { value: row.tokens, total: totalTokens, denom: "本窗口" }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "dtpl-model-txt", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-model-name", children: row.title }),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-ws-meta", children: [
                    row.path !== "" && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-ws-path", title: row.path, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-sr", children: "目录 " }),
                        row.path
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-ws-sep", "aria-hidden": "true", children: "·" })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-ws-facts", children: [
                      row.totals.requests,
                      " 请求",
                      failed > 0 && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
                        " · ",
                        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("b", { className: "dtpl-ws-fail", children: [
                          failed,
                          " 失败"
                        ] })
                      ] }),
                      " ",
                      "· 最近 ",
                      formatRelative(row.lastAt)
                    ] })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "dtpl-model-nums", children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-val", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-sr", children: "词元 " }),
                  formatTokens(row.tokens)
                ] }),
                showMoney && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-cost", title: costText, children: [
                  (cash || !sub) && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-cost-seg", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-cost-main", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-sr", children: "金额 " }),
                      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("b", { className: "dtpl-cash-amt", children: money2(row.spend) })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("em", { className: "dtpl-cost-k", children: "实际支出" })
                  ] }),
                  cash && sub && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-cost-sep", "aria-hidden": "true", children: "·" }),
                  sub && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-cost-seg", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "dtpl-cost-main", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("b", { className: "dtpl-sub-amt", children: money2(row.subscriptionValue) }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("em", { className: "dtpl-cost-k", children: "订阅价值" })
                  ] })
                ] })
              ] })
            ]
          },
          row.id === "" ? "unattributed" : row.id
        );
      }) });
    }
    function workspaceDetail(row, money2, showMoney) {
      const totals = row.totals;
      const failed = totals.failures ?? 0;
      return [
        row.path === "" ? "未归属用量" : `工作区 ${row.title}`,
        row.path === "" ? "会话没有工作区目录，或目录未注册为工作区。" : `目录 ${row.path}`,
        `窗口 ${formatTokens(row.tokens)} 词元 · ${totals.requests} 请求${failed > 0 ? ` · ${failed} 失败` : ""}`,
        `未缓存输入 ${formatTokens(totals.inputTokens)} · 缓存读取 ${formatTokens(totals.cacheReadTokens)} · 缓存写入 ${formatTokens(totals.cacheWriteTokens)} · 输出 ${formatTokens(totals.outputTokens)}`,
        ...showMoney ? [`实际支出 ${money2(row.spend)} · 订阅价值 ${money2(row.subscriptionValue)}`] : [],
        `最近一次 ${formatDateTime(row.lastAt)}`
      ].join("\n");
    }
    function modelDetail(row, totalTokens, money2, noPrice, showMoney) {
      const totals = row.totals;
      const tokens = totalsTokens(totals);
      const failed = totals.failures ?? 0;
      const compactions = totals.compactions ?? 0;
      const unknown = totals.usageUnknown ?? 0;
      return [
        `模型 ${row.model}`,
        ...row.provider === "" ? [] : [`通道 ${row.provider}`],
        `窗口 ${formatTokens(tokens)} 词元（占本窗口 ${formatShare(tokens, totalTokens)}） · ${totals.requests} 请求${compactions > 0 ? ` · ${compactions} 压缩` : ""}${failed > 0 ? ` · ${failed} 失败` : ""}${unknown > 0 ? ` · ${unknown} 次没上报用量` : ""}${showMoney && noPrice ? " · 价格未知" : ""}`,
        `未缓存输入 ${formatTokens(totals.inputTokens)} · 缓存读取 ${formatTokens(totals.cacheReadTokens)} · 缓存写入 ${formatTokens(totals.cacheWriteTokens)} · 输出 ${formatTokens(totals.outputTokens)}`,
        ...showMoney ? [`实际支出 ${money2(row.spend)} · 订阅价值 ${money2(row.subscriptionValue)}`] : []
      ].join("\n");
    }
    
    // src/client/ProviderPanel.tsx
    var import_jsx_runtime10 = require("react/jsx-runtime");
    var RANGE_IDS = ["today", "yesterday", "last7", "last30", "all"];
    var RANGE_LABELS = {
      today: "今日",
      yesterday: "昨天",
      last7: "近7天",
      last30: "近30天",
      all: "全部"
    };
    var RANGE_WORDS = {
      today: "今天",
      yesterday: "昨天",
      last7: "近 7 天",
      last30: "近 30 天",
      all: "全部账本"
    };
    var DEFAULT_RANGE = "last7";
    var RANGE_KEY = "dsh-tokbook.usage-range";
    function readRange() {
      try {
        const saved = localStorage.getItem(RANGE_KEY);
        return saved !== null && RANGE_IDS.includes(saved) ? saved : DEFAULT_RANGE;
      } catch {
        return DEFAULT_RANGE;
      }
    }
    var SLICE_IDS = ["model", "workspace", "provider"];
    var SLICE_LABELS = {
      model: "按模型",
      workspace: "按工作区",
      provider: "按通道"
    };
    var SLICE_NOTES = {
      model: {
        text: "词元从多到少 · 环为占本窗口",
        title: "每个（通道，模型）在该窗口内的词元与费用，按词元从多到少排列；占比环的分母是这个窗口的总词元。"
      },
      workspace: {
        text: "最近有操作在前 · 环为占本窗口",
        title: "每个工作区在该窗口内的词元。记录按会话的创建目录归属到工作区；没有工作区目录、或目录未注册为工作区的记录归入「未归属」。占比环的分母是这个窗口的总词元。"
      },
      provider: {
        text: "词元从多到少 · 环为占本通道",
        title: "每个通道路由在该窗口内计费过的模型、词元与金额。卡内占比环的分母是该通道自己的词元，所以它与卡头的合计对得上。"
      }
    };
    var COLUMNS = {
      model: { id: "模型 · 通道", nums: "词元 · 金额" },
      workspace: { id: "工作区 · 目录", nums: "词元 · 金额" }
    };
    function cutsOf(view) {
      return SLICE_IDS.filter((id) => id === "model" ? view.byModel.length > 0 : id === "workspace" ? view.byWorkspace.length > 0 : view.providers.length > 0);
    }
    function unpricedKeysOf(view) {
      const keys = /* @__PURE__ */ new Set();
      for (const card of view.providers) {
        for (const model of card.unpricedModels) keys.add(`${card.provider}|${model}`);
      }
      return keys;
    }
    function isBucketTotals(raw) {
      if (typeof raw !== "object" || raw === null) return false;
      const totals = raw;
      return typeof totals.inputTokens === "number" && typeof totals.cacheReadTokens === "number" && typeof totals.cacheWriteTokens === "number" && typeof totals.outputTokens === "number";
    }
    function readUsageView(raw) {
      if (typeof raw !== "object" || raw === null) return null;
      const source = raw;
      if (typeof source.range !== "string" || !PROVIDER_RANGES.includes(source.range)) return null;
      if (typeof source.totalTokens !== "number" || typeof source.totalRequests !== "number" || typeof source.totalSpend !== "number" || typeof source.totalSubscriptionValue !== "number") return null;
      if (!Array.isArray(source.byModel) || !Array.isArray(source.byWorkspace) || !Array.isArray(source.providers)) return null;
      for (const row of source.byModel) {
        if (typeof row !== "object" || row === null) return null;
        const model = row;
        if (typeof model.model !== "string" || typeof model.provider !== "string" || !isBucketTotals(model.totals)) return null;
      }
      for (const row of source.byWorkspace) {
        if (typeof row !== "object" || row === null) return null;
        if (!isBucketTotals(row.totals)) return null;
      }
      for (const card of source.providers) {
        if (typeof card !== "object" || card === null) return null;
        const item = card;
        if (!Array.isArray(item.models) || !Array.isArray(item.unpricedModels)) return null;
        for (const model of item.models) {
          if (typeof model !== "object" || model === null) return null;
          if (!isBucketTotals(model.totals)) return null;
        }
      }
      return source;
    }
    var lastViews = /* @__PURE__ */ new Map();
    var lastSlice = "model";
    function ProviderPanel() {
      const [range, setRange] = (0, import_react6.useState)(readRange);
      const [slice, setSlice] = (0, import_react6.useState)(lastSlice);
      const [views, setViews] = (0, import_react6.useState)(() => new Map(lastViews));
      const [cuts, setCuts] = (0, import_react6.useState)([]);
      const [error, setError] = (0, import_react6.useState)(null);
      const activeRef = (0, import_react6.useRef)(0);
      const viewsRef = (0, import_react6.useRef)(views);
      viewsRef.current = views;
      const rangeRef = (0, import_react6.useRef)(range);
      rangeRef.current = range;
      const load = (0, import_react6.useCallback)(async (target, force) => {
        setError(null);
        if (!force && viewsRef.current.has(target)) {
          activeRef.current += 1;
          return;
        }
        const token = ++activeRef.current;
        try {
          const res = await fetch(`${ROUTE_USAGE}?${QUERY_RANGE}=${target}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const raw = await res.json();
          if (token !== activeRef.current) return;
          const view2 = readUsageView(raw);
          if (view2 === null) throw new Error("响应不是一份用量明细视图");
          setViews((current) => {
            const next = new Map(current);
            next.set(target, view2);
            lastViews.set(target, view2);
            return next;
          });
          setCuts(cutsOf(view2));
        } catch (err) {
          if (token !== activeRef.current) return;
          setError(err instanceof Error ? err.message : String(err));
        }
      }, []);
      (0, import_react6.useEffect)(() => {
        void load(range);
      }, [range, load]);
      (0, import_react6.useEffect)(() => subscribeLedgerChanges(() => {
        if (document.hidden) return;
        void load(rangeRef.current, true);
      }), [load]);
      (0, import_react6.useEffect)(() => () => {
        activeRef.current += 1;
      }, []);
      const chooseRange = (0, import_react6.useCallback)((next) => {
        setRange(next);
        try {
          localStorage.setItem(RANGE_KEY, next);
        } catch {
        }
      }, []);
      const chooseSlice = (0, import_react6.useCallback)((next) => {
        lastSlice = next;
        setSlice(next);
      }, []);
      const view = views.get(range);
      const moneyOf = (value) => formatMoney(value);
      const showMoney = rangeCarriesMoney(range);
      const busy = view === void 0 && error === null;
      const available = view === void 0 ? cuts : cutsOf(view);
      const active2 = available.includes(slice) ? slice : available[0] ?? "model";
      const note = SLICE_NOTES[active2];
      const cols = COLUMNS[active2];
      const showCuts = view !== void 0 ? available.length > 0 : busy;
      const onTablistKeyDown = (e) => {
        const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (delta === 0) return;
        e.preventDefault();
        const order = available.length > 0 ? available : [active2];
        const next = order[(order.indexOf(active2) + delta + order.length) % order.length];
        chooseSlice(next);
        document.getElementById(`dtpl-usage-tab-${next}`)?.focus();
      };
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("section", { "aria-label": "用量明细", className: "dtpl-usage-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-usage-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-usage-head-top", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("h2", { className: "dtpl-sec-title dtpl-usage-title", children: [
              RANGE_WORDS[range],
              "用量"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-usage-scope", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-range-tabs", role: "group", "aria-label": "时间跨度", children: RANGE_IDS.map((id) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "button",
                {
                  type: "button",
                  className: `dtpl-range-tab${range === id ? " dtpl-range-active" : ""}`,
                  "aria-pressed": range === id,
                  onClick: () => chooseRange(id),
                  children: RANGE_LABELS[id]
                },
                id
              )) }),
              !showMoney && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "span",
                {
                  className: "dtpl-usage-money-note",
                  title: "金额按当前价折算：全部账本里它既不是历史支出、也不是今天的价值（那些 token 是按各时期的价格花的），所以只给词元。近 30 天及更短的窗口里金额照常给。",
                  children: "全部账本只给词元"
                }
              )
            ] })
          ] }),
          view !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dtpl-hero-facts dtpl-usage-facts", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dtpl-hero-fact", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("b", { children: view.totalRequests }),
              " 请求"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("i", { "aria-hidden": "true", children: "·" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dtpl-hero-fact", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("b", { children: formatTokens(view.totalTokens) }),
              " 词元"
            ] }),
            showMoney && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("i", { "aria-hidden": "true", children: "·" }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dtpl-hero-fact", children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("b", { children: moneyOf(view.totalSpend) }),
                " 实际支出"
              ] }),
              view.totalSubscriptionValue > 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("i", { "aria-hidden": "true", children: "·" }),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dtpl-hero-fact", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("b", { children: moneyOf(view.totalSubscriptionValue) }),
                  " 订阅价值"
                ] })
              ] })
            ] })
          ] }) : busy ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-sk dtpl-usage-facts-sk", "aria-hidden": "true" }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-usage-facts dtpl-usage-facts-empty", "aria-hidden": "true" })
        ] }),
        error !== null && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-error", role: "alert", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("p", { className: "dtpl-error-text", children: [
            "用量明细加载失败：",
            error
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { type: "button", className: "dtpl-retry", onClick: () => void load(range, true), children: "重试" })
        ] }),
        showCuts && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-bd-head", children: [
          available.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-bd-tabs", role: "tablist", "aria-label": "拆分方式", onKeyDown: onTablistKeyDown, children: available.map((id) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "button",
            {
              type: "button",
              role: "tab",
              id: `dtpl-usage-tab-${id}`,
              "aria-selected": active2 === id,
              "aria-controls": "dtpl-usage-panel",
              tabIndex: active2 === id ? 0 : -1,
              className: "dtpl-bd-tab",
              onClick: () => chooseSlice(id),
              children: SLICE_LABELS[id]
            },
            id
          )) }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-sk dtpl-usage-cuts-sk", "aria-hidden": "true" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-sec-aside", title: note.title, children: note.text })
        ] }),
        view !== void 0 && available.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-empty", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(UsageGlyph, { className: "dtpl-empty-ico" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("p", { className: "dtpl-empty-title", children: [
            RANGE_WORDS[view.range],
            "没有计费记录"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "dtpl-empty-sub", children: "这个窗口内没有任何通道计费调用。换一个窗口看看。" })
        ] }) : cols !== void 0 && view !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-bd-cols", "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-bd-col-id", children: cols.id }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-bd-col-nums", children: showMoney ? cols.nums : "词元" })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "div",
          {
            role: "tabpanel",
            id: "dtpl-usage-panel",
            "aria-busy": busy,
            "aria-labelledby": showCuts && available.length > 0 ? `dtpl-usage-tab-${active2}` : void 0,
            children: view === void 0 ? busy && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PanelSkeleton, { slice: active2 }) : active2 === "model" ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ModelRows, { byModel: view.byModel, totalTokens: view.totalTokens, money: moneyOf, unpriced: unpricedKeysOf(view), showMoney }) : active2 === "workspace" ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(WorkspaceRows, { rows: view.byWorkspace, totalTokens: view.totalTokens, money: moneyOf, showMoney }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ProviderCards, { cards: view.providers, labels: view.providerLabels ?? {}, money: moneyOf, showMoney })
          }
        )
      ] });
    }
    function ProviderCards({ cards, labels, money: money2, showMoney }) {
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-providers", children: cards.map((card) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ProviderCard, { card, money: money2, labels, showMoney }, card.provider)) });
    }
    function ProviderCard({ card, money: money2, labels, showMoney }) {
      const cardTokens = card.tokens;
      const label = labels[card.provider];
      const subscription = card.models.some((model) => model.billing === "subscription");
      const billingTag = subscription ? "订阅" : "按量";
      const billingTitle = subscription ? "订阅通道：金额是这些用量按官方价折算的订阅价值，不是实际支出" : "按量通道：金额是实际支出口径";
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("article", { className: "dtpl-provider-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("header", { className: "dtpl-provider-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-provider-id", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dtpl-provider-title", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-provider-name", children: label ?? card.provider }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "span",
                {
                  className: "dtpl-provider-bill",
                  "data-billing": subscription ? "subscription" : "metered",
                  title: billingTitle,
                  children: billingTag
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dtpl-provider-meta", children: [
              label !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-provider-key", children: card.provider }),
                " · "
              ] }),
              card.requests,
              " 请求",
              card.compactions > 0 ? ` · ${card.compactions} 压缩` : "",
              card.usageUnknown > 0 ? ` · ${card.usageUnknown} 次没上报用量` : "",
              card.unpricedModels.length > 0 ? ` · 价格未知 ${card.unpricedModels.join("、")}` : ""
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-provider-nums", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-provider-tokens", children: formatTokens(cardTokens) }),
            showMoney && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dtpl-provider-cost", children: [
              !subscription && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-provider-spend", children: money2(card.spend) }),
              card.subscriptionValue > 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dtpl-provider-value", title: "订阅通道：这些用量按量付费本来要花的钱（非实际扣款）", children: [
                money2(card.subscriptionValue),
                " 订阅价值"
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-provider-models", children: card.models.map((m) => {
          const noPrice = isNoPrice(m.cost, card.unpricedModels.includes(m.model));
          return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-model", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ShareRing, { value: m.tokens, total: cardTokens, denom: "本通道" }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-model-txt", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-model-name", children: m.model }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-model-nums", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dtpl-val", children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-sr", children: "词元 " }),
                formatTokens(m.tokens)
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dtpl-provider-model-sub", children: [
                m.totals.requests,
                " 请求",
                showMoney && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
                  " · ",
                  noPrice ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("em", { className: "dtpl-cost-k", children: "价格未知" }) : m.spend > 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-sr", children: "金额 " }),
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("b", { className: "dtpl-cash-amt", children: money2(m.spend) })
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dtpl-sr", children: "金额 " }),
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("b", { className: "dtpl-sub-amt", children: money2(m.subscriptionValue) }),
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("em", { className: "dtpl-cost-k", children: "订阅价值" })
                  ] })
                ] })
              ] })
            ] })
          ] }, m.model);
        }) })
      ] });
    }
    function PanelSkeleton({ slice }) {
      if (slice === "provider") {
        return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-skeleton", "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-sk dtpl-sk-card" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-sk dtpl-sk-card" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-sk dtpl-sk-card" })
        ] });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dtpl-skeleton", "aria-hidden": "true", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-sk dtpl-sk-row" }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-sk dtpl-sk-row" }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-sk dtpl-sk-row" }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dtpl-sk dtpl-sk-row" })
      ] });
    }
    
    // src/client/MethodDoc.tsx
    var import_jsx_runtime11 = require("react/jsx-runtime");
    var JUDGE_ROWS = [
      {
        what: "你发问、模型回复了",
        detail: "对话里每一次正常问答，一次一记。",
        requests: "计 1 次",
        tokens: "四桶累加"
      },
      {
        what: "对话太长，系统自动压缩上文",
        detail: "这次总结本身也是一次计费调用，所以另记一次「压缩」（可在配置里关掉）。",
        requests: "计 1 次",
        tokens: "四桶累加"
      },
      {
        what: "你中途停止，或这次调用没回报用量",
        detail: "厂商可能照常计费，账本却拿不到数字：计入次数，词元记为未知——不按 0 计，金额也因此按 ¥0 计（不是免费）。",
        requests: "计 1 次",
        tokens: "未知",
        tokensOn: false
      },
      {
        what: "请求失败了（报错、自动重试）",
        detail: "仍留一条失败记录、单独计数，在用量明细里报出「N 失败」；不抬高总量，也不被悄悄丢掉。",
        requests: "不计入",
        tokens: "不计入",
        requestsOn: false,
        tokensOn: false
      }
    ];
    function MethodDoc({ overview }) {
      return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "dtpl-doc", "aria-label": "统计口径", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-lede", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { children: [
            "本插件",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "不估算" }),
            "：每个数字都来自",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "本机保存的对话记录" }),
            "——只存在本机，不上传。"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "通道" }),
            "（代码与文档里写作 provider）是你从哪接入、按什么方式付费的那条路，如 ",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("code", { children: "deepseek-official" }),
            "、",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("code", { children: "commandcode" }),
            "；",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "模型厂商" }),
            "是做出模型、定官方价的那一方。同一家公司可以兼任两者（DeepSeek 官方 API），也可以只是通道（Command Code 卖 DeepSeek 模型，但不是 DeepSeek）。"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { children: [
            "向模型提问时，通道会回报这次消耗了多少词元。本页记的就是这些回报、逐条累加——",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "不是" }),
            "模型厂商官网上的账户数据。"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-facts", role: "group", "aria-label": "口径速览", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-fact", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-fact-k", children: "来源" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-fact-v", children: "本机对话记录，逐条统计" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-fact", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-fact-k", children: "精度" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-fact-v", children: "单条照实记录，无舍入" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-fact", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-fact-k", children: "范围" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-fact-v", children: "只记 DeepSeek Harness 的会话记录" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "dtpl-doc-sec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("h2", { className: "dtpl-doc-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-idx", children: "1" }),
            "词元分四桶"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { className: "dtpl-doc-sub", children: [
            "厂商按 ",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "词元（token）" }),
            "计费——可以理解为模型读写的最小文字单位。一次请求的用量被拆成",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "四类、互不重复" }),
            "，加起来就是「词元合计」："
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-buckets", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Bucket, { name: "未缓存输入", desc: "你发过去、但没命中缓存的文字量。" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Bucket, { name: "缓存读取", desc: "命中了缓存、不必重新计算的文字量，费率更低。" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Bucket, { name: "缓存写入", desc: "写入缓存的文字量；多数厂商不上报，多为 0。" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Bucket, { name: "输出", desc: "模型回复的全部文字（含思考过程）。" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "dtpl-doc-sec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("h2", { className: "dtpl-doc-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-idx", children: "2" }),
            "记了哪些调用"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { className: "dtpl-doc-sub", children: [
            "按",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "你会遇到的情况" }),
            "对照，每一行只回答两件事：算不算一次请求、有没有词元可加。"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("table", { className: "dtpl-doc-judge", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("tr", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("th", { scope: "col", children: "你会遇到的情况" }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("th", { scope: "col", children: "请求次数" }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("th", { scope: "col", children: "词元用量" })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("tbody", { children: JUDGE_ROWS.map((row) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("tr", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("th", { scope: "row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-judge-what", children: row.what }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-judge-detail", children: row.detail })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Judge, { value: row.requests, on: row.requestsOn }) }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Judge, { value: row.tokens, on: row.tokensOn }) })
            ] }, row.what)) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { className: "dtpl-doc-judge-note", children: [
            "安装前的旧对话、以及当时漏记的调用，会按原始记录",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "自动补录" }),
            "，判定口径与上表完全一致。"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "dtpl-doc-sec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("h2", { className: "dtpl-doc-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-idx", children: "3" }),
            "差额从哪来"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-gap", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("article", { className: "dtpl-doc-gap-card dtpl-doc-gap-warn", children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("h3", { className: "dtpl-doc-gap-title", children: "账本会比账单少：没记到的" }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("ul", { className: "dtpl-doc-gap-list", children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "自动生成的会话标题" }),
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-gap-item-desc", children: "给新对话起标题的小请求没有走常规记录通道，本账本拿不到那次用量。每个新会话发生一次，是最大的固定漏项。" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "中途取消 / 出错的请求" }),
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-doc-gap-item-desc", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "中途取消" }),
                    "：文字已经发出去了，厂商可能照常计费，本账本拿不到用量——按上表记为「未知」，并在用量明细的通道卡上单独报出「",
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "N 次没上报用量" }),
                    "」。",
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "最终失败的尝试" }),
                    "：只计失败次数、不计词元；厂商若照样收费，这里也会对不上。"
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "不走会话记录的调用" }),
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-gap-item-desc", children: "其它插件或脚本直接调用模型时，本账本同样看不到。" })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "dtpl-doc-gap-sum", children: "同一请求不会重复计数，可以放心反复扫描——但「重新扫描」只能补齐日志里有的调用，补不回这些根本没进日志的。" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("article", { className: "dtpl-doc-gap-card", children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("h3", { className: "dtpl-doc-gap-title", children: "对不上 ≠ 记错：统计方式不同" }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("ul", { className: "dtpl-doc-gap-list", children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "记账维度不同" }),
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-gap-item-desc", children: "本账本按「这台设备上的会话」记账，账单按「账号」汇总；同一个账号在多台设备 / 多个工具里使用时，两边必然对不齐。" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "金额是现价刻度" }),
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-doc-gap-item-desc", children: [
                    "按你在价格表页写的",
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "当前价" }),
                    "(¥ / 百万词元)逐条折算后累加;同一个模型串在不同",
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "通道" }),
                    "可以是不同的价。一份价管全部历史,所以它衡量的是「最近用掉的词元值多少钱」——",
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "不是" }),
                    "当时那笔账单(厂商改过价,历史那几天的金额就按现价重算)。刻度只在够近的窗口里成立:金额只在近 30 天及更短的窗口里给,",
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "全部账本" }),
                    "只给词元。"
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "两个金额桶，不是一笔支出" }),
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-doc-gap-item-desc", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "实际支出" }),
                    "是按量通道按现价折算的钱；",
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "订阅价值" }),
                    "是订阅通道这些用量若按量付费本来要花的钱，",
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "不是现金" }),
                    "。没定价的记录记 ¥0，并列为",
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "价格未知" }),
                    "——不是免费；改价只影响本机账本，不会回写厂商账单。"
                  ] })
                ] })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "dtpl-doc-sec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("h2", { className: "dtpl-doc-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-idx", children: "4" }),
            "怎么核对"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { className: "dtpl-doc-sub", children: [
            "登录模型厂商的官网（如 DeepSeek 开放平台），",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "按天导出用量" }),
            "， 与「用量总览」的",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "近 14 天趋势" }),
            "逐日对比。"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "dtpl-doc-sub", children: "左侧是本账本，右侧是平台导出的字段：" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-map", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-map-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "未缓存输入" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-map-arrow", children: "↔" }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("code", { children: "prompt_cache_miss_tokens" }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-map-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "缓存读取" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-map-arrow", children: "↔" }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("code", { children: "prompt_cache_hit_tokens" }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-map-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "输出" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-map-arrow", children: "↔" }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("code", { children: "completion_tokens" }) })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "dtpl-doc-map-note", children: "未缓存输入、缓存读取、输出正好对应平台导出的三个字段。" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "dtpl-doc-map-note", children: "除第 3 节列的那几类漏项外，应逐日吻合。" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-quota", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "另一个 tab：「订阅额度」" }),
            "用的是",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "另一套数据" }),
            "。"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { children: [
            "它用你的账号凭据直接向厂商查询",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: "账户级官方用量" }),
            "（含你在其它设备上的消费），与本页的本机账本刻意不混用。"
          ] })
        ] }),
        overview !== null && overview.dataDir !== "" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-data", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { className: "dtpl-doc-data-line", children: [
            "账本已记录 ",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: overview.records }),
            " 次调用，最近一次在 ",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { children: overview.lastEventAt === null ? "—" : formatDateTime(overview.lastEventAt) }),
            "。"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { className: "dtpl-doc-data-dir", children: [
            "数据目录：",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("code", { children: overview.dataDir })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "dtpl-doc-foot", children: "以上口径基于当前 DSH 版本源码核对。" })
      ] });
    }
    function Judge({ value, on = true }) {
      return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: on ? "dtpl-doc-chip" : "dtpl-doc-chip dtpl-doc-chip-off", children: value });
    }
    function Bucket({ name, desc }) {
      return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-doc-bucket", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-bucket-name", children: name }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-doc-bucket-desc", children: desc })
      ] });
    }
    
    // src/client/LedgerOverlay.tsx
    var import_jsx_runtime12 = require("react/jsx-runtime");
    var SYNC_FOLLOW_INTERVAL_MS = 500;
    var SYNC_FOLLOW_ATTEMPTS = 60;
    var OVERVIEW_REFRESH_MIN_GAP_MS = 2e3;
    function isBucketTotals2(raw) {
      if (typeof raw !== "object" || raw === null) return false;
      const totals = raw;
      return typeof totals.inputTokens === "number" && typeof totals.cacheReadTokens === "number" && typeof totals.cacheWriteTokens === "number" && typeof totals.outputTokens === "number";
    }
    function readOverview(raw) {
      if (typeof raw !== "object" || raw === null) return null;
      const source = raw;
      if (!Array.isArray(source.byDay)) return null;
      for (const row of source.byDay) {
        if (typeof row !== "object" || row === null) return null;
        const day = row;
        if (typeof day.day !== "string" || !isBucketTotals2(day.totals)) return null;
      }
      if (source.lastEventAt !== null && typeof source.lastEventAt !== "number") return null;
      if (source.syncError !== null && typeof source.syncError !== "string") return null;
      if (typeof source.records !== "number" || typeof source.dataDir !== "string") return null;
      if (source.syncStatus !== "idle" && source.syncStatus !== "running" && source.syncStatus !== "done" && source.syncStatus !== "error") return null;
      return source;
    }
    function LedgerOverlay({ view }) {
      (0, import_react7.useEffect)(() => injectStyles(), []);
      const { open, overview, error, pricingDirty } = (0, import_react7.useSyncExternalStore)(view.subscribe, view.getSnapshot);
      const [scanning, setScanning] = (0, import_react7.useState)(false);
      const followRef = (0, import_react7.useRef)(null);
      const lastOverviewAt = (0, import_react7.useRef)(0);
      const beginFollow = (0, import_react7.useCallback)(() => {
        followRef.current?.abort();
        const controller = new AbortController();
        followRef.current = controller;
        return controller;
      }, []);
      const fetchOverview = (0, import_react7.useCallback)((signal) => {
        return fetch(ROUTE_OVERVIEW, { signal }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }).then((raw) => {
          if (signal?.aborted === true) return;
          const next = readOverview(raw);
          if (next === null) throw new Error("响应不是一份账本概览");
          lastOverviewAt.current = Date.now();
          view.setOverview(next);
        }).catch((err) => {
          if (signal?.aborted !== true) view.setError(err instanceof Error ? err.message : String(err));
        });
      }, [view]);
      const fetchSyncState = (0, import_react7.useCallback)((signal) => {
        return fetch(ROUTE_SYNC, { signal }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }).then((state) => signal?.aborted === true ? null : state).catch(() => null);
      }, []);
      const followSync = (0, import_react7.useCallback)(async (signal) => {
        for (let attempt = 0; attempt < SYNC_FOLLOW_ATTEMPTS; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, SYNC_FOLLOW_INTERVAL_MS));
          if (signal?.aborted === true) return;
          const state = await fetchSyncState(signal);
          if (state !== null && state.status === "running") continue;
          await fetchOverview(signal);
          if (view.getSnapshot().overview?.syncStatus !== "running") return;
        }
        await fetchOverview(signal);
      }, [fetchOverview, fetchSyncState, view]);
      (0, import_react7.useEffect)(() => {
        if (!open) return;
        const controller = beginFollow();
        void fetchOverview(controller.signal).then(() => {
          if (view.getSnapshot().overview?.syncStatus === "running") return followSync(controller.signal);
        });
        return () => {
          controller.abort();
        };
      }, [open, beginFollow, fetchOverview, followSync, view]);
      (0, import_react7.useEffect)(() => {
        if (!open) {
          followRef.current?.abort();
          setScanning(false);
          return;
        }
        return () => {
          followRef.current?.abort();
        };
      }, [open]);
      const visibleTab = (0, import_react7.useRef)("ledger");
      (0, import_react7.useEffect)(() => {
        if (!open) return;
        const unsubscribe = subscribeLedgerChanges(() => {
          if (visibleTab.current !== "ledger") return;
          if (view.getSnapshot().overview?.syncStatus === "running") return;
          if (Date.now() - lastOverviewAt.current < OVERVIEW_REFRESH_MIN_GAP_MS) return;
          void fetchOverview();
        });
        return unsubscribe;
      }, [open, fetchOverview, view]);
      const onVisibleTab = (0, import_react7.useCallback)((next) => {
        const previous = visibleTab.current;
        visibleTab.current = next;
        if (next !== "ledger" || previous === "ledger") return;
        if (view.getSnapshot().overview?.syncStatus === "running") return;
        if (Date.now() - lastOverviewAt.current < OVERVIEW_REFRESH_MIN_GAP_MS) return;
        void fetchOverview();
      }, [fetchOverview, view]);
      const onRescan = (0, import_react7.useCallback)(async () => {
        const controller = beginFollow();
        setScanning(true);
        try {
          await fetch(ROUTE_RESCAN, { method: "POST", signal: controller.signal }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          });
          await followSync(controller.signal);
        } catch (err) {
          if (!controller.signal.aborted) view.setError(err instanceof Error ? err.message : String(err));
        } finally {
          if (followRef.current === controller) setScanning(false);
        }
      }, [beginFollow, followSync, view]);
      if (!open) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        OverviewCard,
        {
          overview,
          error,
          scanning,
          pricingDirty,
          onDirtyChange: view.setPricingDirty,
          onRescan,
          onRetry: () => {
            view.setError(null);
            void fetchOverview();
          },
          onRefresh: fetchOverview,
          onVisibleTab,
          onClose: () => view.setOpen(false)
        }
      );
    }
    var TAB_IDS = ["ledger", "quota", "pricing", "method"];
    function OverviewCard({ overview, error, scanning, pricingDirty, onDirtyChange, onRescan, onRetry, onRefresh, onVisibleTab, onClose }) {
      const [tab, setTab] = (0, import_react7.useState)("ledger");
      const cardRef = (0, import_react7.useRef)(null);
      const bodyRef = (0, import_react7.useRef)(null);
      const selectTab = (0, import_react7.useCallback)((next) => {
        setTab(next);
        onVisibleTab(next);
      }, [onVisibleTab]);
      (0, import_react7.useEffect)(() => {
        const previous = document.activeElement;
        cardRef.current?.focus();
        return () => previous?.focus();
      }, []);
      (0, import_react7.useEffect)(() => {
        bodyRef.current?.scrollTo(0, 0);
      }, [tab]);
      (0, import_react7.useEffect)(() => {
        const onKey = (e) => {
          if (e.key === "Escape") {
            onClose();
            return;
          }
          if (e.key !== "Tab") return;
          const card = cardRef.current;
          if (card === null) return;
          const focusables = card.querySelectorAll(
            'button:not(:disabled),[href],[tabindex]:not([tabindex="-1"])'
          );
          if (focusables.length === 0) {
            e.preventDefault();
            return;
          }
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
      }, [onClose]);
      const onTablistKeyDown = (0, import_react7.useCallback)((e) => {
        const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (delta === 0) return;
        e.preventDefault();
        const next = TAB_IDS[(TAB_IDS.indexOf(tab) + delta + TAB_IDS.length) % TAB_IDS.length];
        selectTab(next);
        document.getElementById(`dtpl-tab-${next}`)?.focus();
      }, [tab, selectTab]);
      const onBackdropMouseDown = (0, import_react7.useCallback)((e) => {
        if (e.target === e.currentTarget) onClose();
      }, [onClose]);
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-overlay", "data-plugin": "dsh-tokbook", onMouseDown: onBackdropMouseDown, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
        "div",
        {
          ref: cardRef,
          className: "dtpl-card",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "词元账本",
          tabIndex: -1,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("header", { className: "dtpl-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-title", children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-title-ico-chip", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(UsageGlyph, { className: "dtpl-title-ico" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "词元账本" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { type: "button", className: "dtpl-close", onClick: onClose, "aria-label": "关闭", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(CloseGlyph, { className: "dtpl-close-ico" }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-tabs", role: "tablist", "aria-label": "账本视图", onKeyDown: onTablistKeyDown, children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "button",
                {
                  type: "button",
                  role: "tab",
                  id: "dtpl-tab-ledger",
                  "aria-selected": tab === "ledger",
                  "aria-controls": "dtpl-panel",
                  tabIndex: tab === "ledger" ? 0 : -1,
                  className: "dtpl-tab",
                  onClick: () => selectTab("ledger"),
                  children: "用量总览"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "button",
                {
                  type: "button",
                  role: "tab",
                  id: "dtpl-tab-quota",
                  "aria-selected": tab === "quota",
                  "aria-controls": "dtpl-panel",
                  tabIndex: tab === "quota" ? 0 : -1,
                  className: "dtpl-tab",
                  onClick: () => selectTab("quota"),
                  children: "订阅额度"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                "button",
                {
                  type: "button",
                  role: "tab",
                  id: "dtpl-tab-pricing",
                  "aria-selected": tab === "pricing",
                  "aria-controls": "dtpl-panel",
                  tabIndex: tab === "pricing" ? 0 : -1,
                  className: "dtpl-tab",
                  onClick: () => selectTab("pricing"),
                  children: [
                    "价格表",
                    pricingDirty && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("i", { className: "dtpl-tab-dot", role: "img", "aria-label": "有未保存的改动", title: "有未保存的改动" })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "button",
                {
                  type: "button",
                  role: "tab",
                  id: "dtpl-tab-method",
                  "aria-selected": tab === "method",
                  "aria-controls": "dtpl-panel",
                  tabIndex: tab === "method" ? 0 : -1,
                  className: "dtpl-tab",
                  onClick: () => selectTab("method"),
                  children: "统计口径"
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
              "div",
              {
                ref: bodyRef,
                className: "dtpl-body",
                role: "tabpanel",
                id: "dtpl-panel",
                "aria-labelledby": `dtpl-tab-${tab}`,
                children: tab === "method" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MethodDoc, { overview }) : tab === "quota" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(QuotaPanel, {}) : tab === "pricing" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                  PricingPanel,
                  {
                    onChanged: onRefresh,
                    onDirtyChange
                  }
                ) : /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
                  error !== null && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-error", role: "alert", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("p", { className: "dtpl-error-text", children: [
                      "加载失败：",
                      error
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { type: "button", className: "dtpl-retry", onClick: onRetry, children: "重试" })
                  ] }),
                  overview === null ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(LedgerSkeleton, {}) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(LedgerView, { overview }),
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ProviderPanel, {})
                ] })
              }
            ),
            overview !== null && tab === "ledger" && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("footer", { className: "dtpl-foot", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-foot-state", children: [
                overview.syncStatus === "running" && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-sync dtpl-sync-running", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("i", { className: "dtpl-sync-dot", "aria-hidden": "true" }),
                  "正在重新扫描…"
                ] }),
                overview.syncStatus === "error" && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-sync dtpl-sync-error", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("i", { className: "dtpl-sync-dot", "aria-hidden": "true" }),
                  "上次重新扫描失败",
                  overview.syncError !== null ? `：${overview.syncError}` : ""
                ] }),
                overview.lastEventAt !== null && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-foot-latest", children: [
                  "最新记录 ",
                  formatDateTime(overview.lastEventAt)
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("button", { type: "button", className: "dtpl-rescan", onClick: onRescan, disabled: scanning, children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(RefreshGlyph, { className: `dtpl-rescan-ico${scanning ? " dtpl-spin" : ""}` }),
                scanning ? "扫描中…" : "重新扫描"
              ] })
            ] })
          ]
        }
      ) });
    }
    
    // src/client/SessionTokens.tsx
    var import_react11 = require("react");
    
    // src/client/SessionShell.tsx
    var import_react8 = require("react");
    var import_jsx_runtime13 = require("react/jsx-runtime");
    var COLUMN_KEY = "dsh-tokbook.tokens.contentWidth";
    var COLUMN_MIN = 640;
    var COLUMN_EDGE_BUDGET = 176;
    var KEY_STEP = 16;
    var KEY_STEP_COARSE = 64;
    var WHEEL_LINE_PX = 16;
    function readWidth() {
      try {
        const raw = localStorage.getItem(COLUMN_KEY);
        if (raw === null) return null;
        const value = Number(raw);
        return Number.isFinite(value) && value > 0 ? value : null;
      } catch {
        return null;
      }
    }
    function SessionShell({ children }) {
      const [width, setWidth] = (0, import_react8.useState)(readWidth);
      const root = (0, import_react8.useRef)(null);
      const viewport = (0, import_react8.useRef)(null);
      const [metrics, setMetrics] = (0, import_react8.useState)({ drawn: 0, available: 0 });
      (0, import_react8.useEffect)(() => {
        const view = viewport.current;
        const column = view?.firstElementChild;
        if (!(view instanceof HTMLElement) || !(column instanceof HTMLElement)) return;
        const read = () => {
          setMetrics({ drawn: Math.round(column.getBoundingClientRect().width), available: view.clientWidth });
        };
        read();
        const observer = new ResizeObserver(read);
        observer.observe(view);
        observer.observe(column);
        return () => {
          observer.disconnect();
        };
      }, []);
      const apply2 = (0, import_react8.useCallback)((next, persist = true) => {
        setWidth(next);
        if (!persist) return;
        try {
          if (next === null) localStorage.removeItem(COLUMN_KEY);
          else localStorage.setItem(COLUMN_KEY, String(next));
        } catch {
        }
      }, []);
      const style = width === null ? void 0 : { "--dtpl-tok-width": `${String(width)}px` };
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-tok", "data-plugin": "dsh-tokbook", "data-conversation-composer-overlay": "", ref: root, style, children: [
        ["left", "right"].map((side) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(ColumnGrip, { side, viewport, width, metrics, onApply: apply2 }, side)),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "dtpl-tok-scroll", ref: viewport, children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "dtpl-tok-col", children }) })
      ] });
    }
    function ColumnGrip({ side, viewport, width, metrics, onApply }) {
      const [dragging, setDragging] = (0, import_react8.useState)(false);
      const base = (0, import_react8.useRef)(0);
      const origin = (0, import_react8.useRef)(0);
      const latest = (0, import_react8.useRef)(0);
      const frame = (0, import_react8.useRef)(null);
      const ceiling = () => Math.max(COLUMN_MIN, metrics.available - COLUMN_EDGE_BUDGET);
      const clamp2 = (value) => Math.min(Math.max(Math.round(value), COLUMN_MIN), ceiling());
      const startWidth = () => clamp2(metrics.drawn > 0 ? metrics.drawn : metrics.available);
      const draggedWidth = () => {
        const outward = side === "right" ? 1 : -1;
        return clamp2(base.current + outward * (latest.current - origin.current) * 2);
      };
      const stopFrame = () => {
        if (frame.current !== null) {
          cancelAnimationFrame(frame.current);
          frame.current = null;
        }
      };
      (0, import_react8.useEffect)(() => stopFrame, []);
      const onPointerDown = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        origin.current = event.clientX;
        latest.current = event.clientX;
        base.current = startWidth();
        setDragging(true);
      };
      const onPointerMove = (event) => {
        if (!dragging) return;
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const box = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--dtpl-grip-y", `${String(Math.round(event.clientY - box.top))}px`);
        latest.current = event.clientX;
        frame.current ??= requestAnimationFrame(() => {
          frame.current = null;
          onApply(draggedWidth(), false);
        });
      };
      const onPointerUp = (event) => {
        if (!dragging) return;
        stopFrame();
        setDragging(false);
        latest.current = event.clientX;
        if (latest.current !== origin.current) onApply(draggedWidth());
      };
      const onPointerCancel = () => {
        stopFrame();
        setDragging(false);
      };
      const onKeyDown = (event) => {
        const step = event.shiftKey ? KEY_STEP_COARSE : KEY_STEP;
        const outward = side === "right" ? 1 : -1;
        const from = width ?? startWidth();
        let next = null;
        if (event.key === "ArrowRight") next = from + outward * step;
        else if (event.key === "ArrowLeft") next = from - outward * step;
        else if (event.key === "Home") next = COLUMN_MIN;
        else if (event.key === "End") next = ceiling();
        if (next === null) return;
        event.preventDefault();
        onApply(clamp2(next));
      };
      const onWheel = (event) => {
        const element = viewport.current;
        if (element === null || event.ctrlKey || event.deltaY === 0) return;
        const perUnit = event.deltaMode === 1 ? WHEEL_LINE_PX : event.deltaMode === 2 ? element.clientHeight : 1;
        element.scrollTop += event.deltaY * perUnit;
      };
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
        "div",
        {
          className: "dtpl-tok-grip",
          "data-side": side,
          "data-dragging": dragging ? "" : void 0,
          role: "separator",
          "aria-orientation": "vertical",
          "aria-label": "调整内容列宽度",
          "aria-valuemin": COLUMN_MIN,
          "aria-valuemax": ceiling(),
          "aria-valuenow": metrics.drawn > 0 ? metrics.drawn : COLUMN_MIN,
          tabIndex: 0,
          title: "拖动调整内容列宽度（方向键微调，双击恢复为跟随对话正文）",
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel,
          onLostPointerCapture: onPointerCancel,
          onKeyDown,
          onDoubleClick: () => onApply(null),
          onWheel
        }
      );
    }
    
    // src/client/session-subagents.tsx
    var import_jsx_runtime14 = require("react/jsx-runtime");
    function shortId(sessionId) {
      const bare = sessionId.startsWith("session-") ? sessionId.slice("session-".length) : sessionId;
      return bare.slice(0, 8);
    }
    function labelOf(row) {
      return row.label === "" ? `子代理 ${shortId(row.sessionId)}` : row.label;
    }
    function costOf(row) {
      if (row.requests === 0 && row.failures === 0) return { text: "无计费调用", kind: "none" };
      if (!row.priced) return { text: "价格未知", kind: "unpriced" };
      if (row.spend > 0) return { text: `${formatMoney(row.spend)} 实际支出`, kind: "spend" };
      if (row.subscriptionValue > 0) return { text: `${formatMoney(row.subscriptionValue)} 订阅价值`, kind: "subscription" };
      return { text: `${formatMoney(0)} 实际支出`, kind: "spend" };
    }
    function SubagentSection({ view, sessionTokens }) {
      const share2 = formatShare(view.totalTokens, sessionTokens + view.totalTokens);
      const nested = view.rows.reduce((sum, row) => sum + row.descendants, 0);
      const priced = view.rows.some((row) => row.priced);
      const notes = [];
      if (view.usageUnknown > 0) notes.push(`其中 ${view.usageUnknown} 次调用没上报用量，词元没有加进任何桶`);
      if (view.failures > 0) notes.push(`失败 ${view.failures} 次（没有产出，不产生词元）`);
      if (view.unpriced.length > 0) notes.push(`价格未知：${view.unpriced.join(" · ")}——这些行按 ¥0 计`);
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("section", { "aria-label": "子代理", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("h2", { className: "dtpl-sec-title", children: "子代理" }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dtpl-tok-sub", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dtpl-tok-sub-sum", children: [
            /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dtpl-stat", role: "listitem", children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "dtpl-stat-k", children: "子代理四桶合计" }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "dtpl-stat-v", children: formatTokens(view.totalTokens) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "dtpl-stat-p", children: [
                view.count,
                " 个直接子代理",
                nested > 0 ? ` · 含 ${nested} 个下级` : "",
                " · 占本会话 + 子代理 ",
                share2
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dtpl-stat", role: "listitem", children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "dtpl-stat-k", children: "子代理实际支出" }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "dtpl-stat-v", children: priced ? formatMoney(view.spend) : "—" }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "dtpl-stat-p", children: priced ? view.subscriptionValue > 0 ? `另有订阅价值 ${formatMoney(view.subscriptionValue)}` : "按现价折算" : "价格未知：这些行按 ¥0 计" })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dtpl-tok-sub-list", children: view.rows.map((row) => {
            const cost = costOf(row);
            return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dtpl-tok-sub-row", title: rowDetail(row), children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "dtpl-tok-sub-name", children: [
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "dtpl-tok-sub-label", children: labelOf(row) }),
                row.descendants > 0 && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "dtpl-tok-sub-extra", children: [
                  "含 ",
                  row.descendants,
                  " 个下级"
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "dtpl-tok-sub-tokens", children: [
                formatTokens(row.tokens),
                " 词元"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "dtpl-tok-sub-share", children: [
                "占 ",
                formatShare(row.tokens, view.totalTokens)
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "dtpl-tok-sub-cost", "data-kind": cost.kind, children: cost.text })
            ] }, row.sessionId);
          }) }),
          notes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { className: "dtpl-tok-note dtpl-tok-sub-note", children: notes.map((note, index) => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
            index > 0 && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("i", { "aria-hidden": "true", children: "·" }),
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: note })
          ] }, note)) })
        ] })
      ] });
    }
    function rowDetail(row) {
      return [
        labelOf(row),
        `会话 ${row.sessionId}`,
        `${row.requests} 次计费调用`,
        ...row.failures > 0 ? [`${row.failures} 次失败`] : [],
        ...row.usageUnknown > 0 ? [`其中 ${row.usageUnknown} 次没上报用量`] : [],
        `${formatTokens(row.tokens)} 词元`,
        ...row.requests === 0 && row.failures === 0 ? ["没有计费调用"] : row.priced ? [`实际支出 ${formatMoney(row.spend)}`, ...row.subscriptionValue > 0 ? [`订阅价值 ${formatMoney(row.subscriptionValue)}`] : []] : ["价格未知：按 ¥0 计"],
        ...row.descendants > 0 ? [`含 ${row.descendants} 个下级子代理（已折进本行）`] : []
      ].join("\n");
    }
    
    // src/client/session-timing.tsx
    var import_jsx_runtime15 = require("react/jsx-runtime");
    var PHASE_LABEL = {
      wait: "等首 token",
      generate: "生成",
      model: "模型（拆不开）",
      tool: "工具"
    };
    var LEGEND_SHAPE = [
      { kind: "wait", share: 30 },
      { kind: "generate", share: 52 },
      { kind: "tool", share: 32 }
    ].map((phase) => ({ ...phase, label: PHASE_LABEL[phase.kind] }));
    function TimeReads({ reads }) {
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "dtpl-tok-reads", children: reads.map((read) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "dtpl-tok-read", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "dtpl-tok-read-mark", "data-kind": read.kind, "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: read.label }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("b", { children: read.value })
      ] }, read.key)) });
    }
    function TimeBar(props) {
      const total = props.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
      if (!(total > 0)) return null;
      const segPct = (value) => `${String(Math.round(Math.max(0, value) / total * 1e3) / 10)}%`;
      if (props.tone !== "step" && !(props.scale > 0)) return null;
      const width = props.tone === "step" ? "100%" : `max(2px, ${String(Math.round(Math.min(1, total / props.scale) * 1e3) / 10)}%)`;
      const bar = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        "span",
        {
          className: "dtpl-tok-bar",
          "data-tone": props.tone,
          "aria-hidden": "true",
          style: { width },
          children: props.segments.map((segment) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            "span",
            {
              className: "dtpl-tok-bar-seg",
              "data-kind": segment.kind,
              style: { width: `max(${segment.value > 0 ? 2 : 0}px, ${segPct(segment.value)})` }
            },
            segment.key
          ))
        }
      );
      if (props.tone !== "hero") return bar;
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "dtpl-tok-hero-ratio", children: [
        bar,
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(TimeReads, { reads: props.reads })
      ] });
    }
    function sumSegments(rows) {
      const byKind = /* @__PURE__ */ new Map();
      for (const row of rows) {
        for (const segment of stepSegments(row.timing)) {
          byKind.set(segment.kind, (byKind.get(segment.kind) ?? 0) + segment.value);
        }
      }
      return ["wait", "generate", "model", "tool"].filter((kind) => (byKind.get(kind) ?? 0) > 0).map((kind) => ({ key: kind, value: byKind.get(kind) ?? 0, kind }));
    }
    function stepSegments(timing) {
      if (timing === void 0 || timing.llmMs === void 0) return [];
      const segments = [];
      const { ttftMs, decodeMs } = timing;
      if (ttftMs !== void 0 && decodeMs !== void 0 && decodeMs > 0) {
        if (ttftMs > 0) segments.push({ key: "wait", value: ttftMs, kind: "wait" });
        segments.push({ key: "generate", value: decodeMs, kind: "generate" });
      } else {
        segments.push({ key: "model", value: timing.llmMs, kind: "model" });
      }
      if (timing.toolMs !== void 0 && timing.toolMs > 0) {
        segments.push({ key: "tool", value: timing.toolMs, kind: "tool" });
      }
      return segments;
    }
    
    // src/client/session-chart.tsx
    var import_react9 = require("react");
    
    // src/client/session-wire.ts
    function num(value) {
      return typeof value === "number" && Number.isFinite(value) ? value : 0;
    }
    function optionalMs(value) {
      return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : void 0;
    }
    function readSessionView(raw) {
      if (typeof raw !== "object" || raw === null) return null;
      const source = raw;
      return {
        sessionId: typeof source.sessionId === "string" ? source.sessionId : "",
        updatedAt: num(source.updatedAt),
        firstAt: num(source.firstAt),
        lastAt: num(source.lastAt),
        total: readTotals(source.total),
        totalTokens: num(source.totalTokens),
        spend: num(source.spend),
        subscriptionValue: num(source.subscriptionValue),
        unpriced: Array.isArray(source.unpriced) ? source.unpriced.filter((key) => typeof key === "string") : [],
        turns: readGroups(source.turns).filter((group) => group.turn !== null),
        betweenTurns: readGroup(source.betweenTurns),
        unattributed: readRows(source.unattributed),
        todaySpend: num(source.todaySpend),
        spanMs: optionalMs(source.spanMs),
        workMs: optionalMs(source.workMs),
        subagents: readSubagents(source.subagents)
      };
    }
    function readSubagents(raw) {
      if (typeof raw !== "object" || raw === null) return void 0;
      const source = raw;
      const rows = [];
      if (Array.isArray(source.rows)) {
        for (const item of source.rows) {
          if (typeof item !== "object" || item === null) continue;
          const row = item;
          if (typeof row.sessionId !== "string" || row.sessionId === "") continue;
          rows.push({
            sessionId: row.sessionId,
            label: typeof row.label === "string" ? row.label : "",
            tokens: num(row.tokens),
            requests: num(row.requests),
            failures: num(row.failures),
            usageUnknown: num(row.usageUnknown),
            spend: num(row.spend),
            subscriptionValue: num(row.subscriptionValue),
            priced: row.priced === true,
            descendants: num(row.descendants)
          });
        }
      }
      if (rows.length === 0) return void 0;
      return {
        count: num(source.count),
        totalTokens: num(source.totalTokens),
        spend: num(source.spend),
        subscriptionValue: num(source.subscriptionValue),
        usageUnknown: num(source.usageUnknown),
        failures: num(source.failures),
        unpriced: Array.isArray(source.unpriced) ? source.unpriced.filter((key) => typeof key === "string") : [],
        rows
      };
    }
    function readTotals(raw) {
      const source = typeof raw === "object" && raw !== null ? raw : {};
      return {
        requests: num(source.requests),
        inputTokens: num(source.inputTokens),
        outputTokens: num(source.outputTokens),
        cacheReadTokens: num(source.cacheReadTokens),
        cacheWriteTokens: num(source.cacheWriteTokens),
        compactions: num(source.compactions),
        failures: num(source.failures),
        usageUnknown: num(source.usageUnknown)
      };
    }
    function readGroups(raw) {
      if (!Array.isArray(raw)) return [];
      const groups = [];
      for (const item of raw) {
        const group = readGroup(item);
        if (group !== null) groups.push(group);
      }
      return groups;
    }
    function readGroup(raw) {
      if (typeof raw !== "object" || raw === null) return null;
      const source = raw;
      return {
        turn: typeof source.turn === "number" ? source.turn : null,
        totals: readTotals(source.totals),
        tokens: num(source.tokens),
        spend: num(source.spend),
        subscriptionValue: num(source.subscriptionValue),
        rows: readRows(source.rows)
      };
    }
    function readRows(raw) {
      if (!Array.isArray(raw)) return [];
      const rows = [];
      for (const item of raw) {
        if (typeof item !== "object" || item === null) continue;
        const source = item;
        if (typeof source.requestId !== "string") continue;
        const bucket = source.bucket === "subscription" || source.bucket === "unpriced" ? source.bucket : "spend";
        rows.push({
          requestId: source.requestId,
          time: num(source.time),
          model: typeof source.model === "string" ? source.model : "",
          provider: typeof source.provider === "string" ? source.provider : "",
          kind: source.kind,
          failureCode: source.failureCode,
          usage: source.usage,
          tokens: num(source.tokens),
          step: typeof source.step === "number" ? source.step : void 0,
          timing: readTiming(source.timing),
          bucket,
          cost: num(source.cost)
        });
      }
      return rows;
    }
    function readTiming(raw) {
      if (typeof raw !== "object" || raw === null) return void 0;
      const source = raw;
      const timing = {};
      const wall = optionalMs(source.wallMs);
      const llm = optionalMs(source.llmMs);
      const ttft = optionalMs(source.ttftMs);
      const decode = optionalMs(source.decodeMs);
      const tool = optionalMs(source.toolMs);
      if (wall !== void 0) timing.wallMs = wall;
      if (llm !== void 0) timing.llmMs = llm;
      if (ttft !== void 0) timing.ttftMs = ttft;
      if (decode !== void 0) timing.decodeMs = decode;
      if (tool !== void 0) {
        timing.toolMs = tool;
        timing.toolCalls = num(source.toolCalls);
      }
      const slow = readSlowTool(source.slowTool);
      if (slow !== void 0) timing.slowTool = slow;
      return Object.keys(timing).length === 0 ? void 0 : timing;
    }
    function readSlowTool(raw) {
      if (typeof raw !== "object" || raw === null) return void 0;
      const source = raw;
      const ms = optionalMs(source.ms);
      if (ms === void 0) return void 0;
      return { name: typeof source.name === "string" ? source.name : "", ms };
    }
    
    // src/client/session-shared.ts
    function hasPricedRow(rows) {
      return rows.some((row) => row.bucket !== "unpriced");
    }
    var BUCKETS = [
      { key: "inputTokens", label: "未缓存输入" },
      { key: "cacheReadTokens", label: "缓存读取" },
      { key: "cacheWriteTokens", label: "缓存写入" },
      { key: "outputTokens", label: "输出" }
    ];
    
    // src/client/session-chart.tsx
    var import_jsx_runtime16 = require("react/jsx-runtime");
    var STAGGER_STEP = 6;
    function columnHeight2(value, max) {
      return value > 0 ? `max(2px, ${String(Math.round(value / max * 100))}%)` : "0px";
    }
    function TurnChart({ turns, previews }) {
      const plot = (0, import_react9.useRef)(null);
      const figure = (0, import_react9.useRef)(null);
      const card = (0, import_react9.useRef)(null);
      const [scrollable, setScrollable] = (0, import_react9.useState)(false);
      const [hover, setHover] = (0, import_react9.useState)(null);
      const [spot, setSpot] = (0, import_react9.useState)(null);
      (0, import_react9.useEffect)(() => {
        const element = plot.current;
        if (element === null) return;
        const read = () => {
          setScrollable(element.scrollWidth - element.clientWidth > 1);
        };
        read();
        const observer = new ResizeObserver(read);
        observer.observe(element);
        return () => {
          observer.disconnect();
        };
      }, [turns.length]);
      (0, import_react9.useLayoutEffect)(() => {
        const box = card.current;
        const wrap = figure.current;
        if (hover === null || box === null || wrap === null || !hover.bar.isConnected) {
          setSpot(null);
          return;
        }
        const place = () => {
          const frame = wrap.getBoundingClientRect();
          const bar = hover.bar.getBoundingClientRect();
          const size = box.getBoundingClientRect();
          const view = wrap.closest(".dtpl-tok-scroll")?.getBoundingClientRect() ?? frame;
          const above = bar.top - frame.top - 20 - size.height;
          const minTop = view.top - frame.top + 8;
          const top = above >= minTop ? above : clamp(bar.bottom - frame.top + 6, minTop, view.bottom - frame.top - size.height - 8);
          setSpot({
            left: clamp(bar.left - frame.left + bar.width / 2 - size.width / 2, 0, frame.width - size.width),
            top
          });
        };
        place();
        window.addEventListener("scroll", place, true);
        window.addEventListener("resize", place);
        return () => {
          window.removeEventListener("scroll", place, true);
          window.removeEventListener("resize", place);
        };
      }, [hover]);
      if (turns.length === 0) return null;
      const fresh = turns.map(freshOf);
      const cached = turns.map((group) => group.totals.cacheReadTokens);
      const freshPeak = peakIndexOf(fresh);
      const cachePeak = peakIndexOf(cached);
      const slots = { "--dtpl-slots": String(turns.length) };
      const notes = [
        cachePeak >= 0 ? "两格各自归一：缓存读的量级常是新增的几十倍，同轴会把新增压成一条线。" : null,
        scrollable ? "轮次多到一列放不下柱值，这张图横向滚动（拖滚动条 / Shift + 滚轮）：上下两格与轴线一起走。" : null
      ].filter((sentence) => sentence !== null);
      const hovered = hover === null ? void 0 : turns[hover.index];
      const preview = hovered?.turn == null ? void 0 : previews.get(hovered.turn);
      return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("section", { "aria-label": "每轮新增与缓存读", children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("h2", { className: "dtpl-sec-title", children: "每轮新增与缓存读" }),
        notes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: "dtpl-tok-note", children: notes.join(" ") }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "dtpl-tok-chart", ref: figure, children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
            "div",
            {
              className: "dtpl-tok-plot",
              style: slots,
              ref: plot,
              tabIndex: scrollable ? 0 : void 0,
              "aria-label": scrollable ? "按轮次的柱状图，可横向滚动" : void 0,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
                  BarPanel,
                  {
                    panel: "fresh",
                    name: "新增词元",
                    series: fresh,
                    turns,
                    peak: freshPeak,
                    onHover: (panel, index, bar) => {
                      setHover({ panel, index, bar });
                    },
                    onLeave: () => {
                      setHover(null);
                    }
                  }
                ),
                cachePeak >= 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
                  BarPanel,
                  {
                    panel: "cache",
                    name: "缓存读取",
                    series: cached,
                    turns,
                    peak: cachePeak,
                    offset: STAGGER_STEP,
                    onHover: (panel, index, bar) => {
                      setHover({ panel, index, bar });
                    },
                    onLeave: () => {
                      setHover(null);
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "dtpl-trend-axis", "aria-hidden": "true", children: turns.map((group, index) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
                  "span",
                  {
                    className: index === freshPeak || index === cachePeak ? "is-peak" : void 0,
                    children: group.turn
                  },
                  group.turn ?? index
                )) })
              ]
            }
          ),
          hover !== null && hovered !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
            "div",
            {
              className: "dtpl-tok-hover",
              ref: card,
              "aria-hidden": "true",
              style: spot === null ? { visibility: "hidden" } : { left: `${String(spot.left)}px`, top: `${String(spot.top)}px` },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("p", { className: "dtpl-tok-panel-k", children: [
                  "第 ",
                  String(hovered.turn),
                  " 轮",
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { className: "dtpl-tok-panel-v", children: [
                    hovered.rows.length,
                    " 步"
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("i", { "aria-hidden": "true", children: "·" }),
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { className: "dtpl-tok-panel-v", children: [
                    formatTokens(hovered.tokens),
                    " 词元"
                  ] }),
                  hasPricedRow(hovered.rows) ? (hovered.spend > 0 || hovered.subscriptionValue === 0) && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("i", { "aria-hidden": "true", children: "·" }),
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { className: "dtpl-tok-panel-v", children: [
                      formatMoney(hovered.spend),
                      " 实际支出"
                    ] })
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("i", { "aria-hidden": "true", children: "·" }),
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "dtpl-tok-panel-v", children: "价格未知" })
                  ] }),
                  hovered.subscriptionValue > 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("i", { "aria-hidden": "true", children: "·" }),
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { className: "dtpl-tok-panel-v", children: [
                      formatMoney(hovered.subscriptionValue),
                      " 订阅价值"
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: "dtpl-tok-hover-basis", children: basisOf(hover.panel, hovered, hover.panel === "fresh" ? fresh[hover.index] : cached[hover.index]) }),
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: "dtpl-hero-facts dtpl-tok-hover-buckets", children: BUCKETS.map((bucket, index) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_react9.Fragment, { children: [
                  index > 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("i", { "aria-hidden": "true", children: "·" }),
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { className: "dtpl-hero-fact", children: [
                    bucket.label,
                    " ",
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("b", { children: formatTokens(num(hovered.totals[bucket.key])) })
                  ] })
                ] }, bucket.key)) }),
                preview !== void 0 && (preview.prompt !== "" || preview.response !== "") && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { className: "dtpl-tok-turn-preview", children: [
                  preview.prompt !== "" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "dtpl-tok-turn-ask", title: preview.prompt, children: preview.prompt }),
                  preview.response !== "" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "dtpl-tok-turn-reply", title: preview.response, children: preview.response })
                ] })
              ]
            }
          )
        ] })
      ] });
    }
    function clamp(value, low, high) {
      return Math.min(Math.max(value, low), Math.max(low, high));
    }
    function basisOf(panel, group, value) {
      if (panel === "fresh") return "柱高 = 未缓存输入 + 缓存写入 + 输出";
      const totals = group.totals;
      const billedInput = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
      return `柱高 = 缓存读取，占该轮计费输入 ${formatShare(value, billedInput)}`;
    }
    function freshOf(group) {
      return group.totals.inputTokens + group.totals.cacheWriteTokens + group.totals.outputTokens;
    }
    function peakIndexOf(series) {
      let index = -1;
      let best = 0;
      series.forEach((value, at) => {
        if (value > best) {
          best = value;
          index = at;
        }
      });
      return index;
    }
    function BarPanel({ panel, name, series, turns, peak, offset = 0, onHover, onLeave }) {
      const max = Math.max(...series, 1);
      const sum = series.reduce((total, value) => total + value, 0);
      return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "dtpl-tok-panel", children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("p", { className: "dtpl-tok-panel-k", children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "dtpl-tok-swatch", "aria-hidden": "true" }),
          name,
          /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { className: "dtpl-tok-panel-v", children: [
            "合计 ",
            formatTokens(sum)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("i", { "aria-hidden": "true", children: "·" }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "dtpl-tok-panel-v", children: peak < 0 ? "本会话无读数" : `峰值 ${formatTokens(series[peak])}（第 ${String(turns[peak].turn)} 轮）` })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
          "div",
          {
            className: "dtpl-bars is-anim",
            role: "img",
            "aria-label": panelLabel(name, turns, series, peak, sum),
            style: { "--dtpl-offset": offset },
            children: turns.map((group, index) => {
              const value = series[index];
              const isPeak = index === peak;
              const height = columnHeight2(value, max);
              return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
                "div",
                {
                  className: `dtpl-bar${value === 0 ? " is-zero" : ""}`,
                  style: { "--dtpl-i": index },
                  onMouseEnter: (event) => {
                    onHover(panel, index, event.currentTarget);
                  },
                  onMouseLeave: onLeave,
                  children: value > 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
                      "span",
                      {
                        className: `dtpl-bar-label${isPeak ? " is-peak" : ""}`,
                        style: { bottom: `calc(${height} + 2px)` },
                        children: formatTokens(value)
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: `dtpl-bar-fill${isPeak ? " is-peak" : ""}`, style: { height } })
                  ] })
                },
                group.turn ?? index
              );
            })
          }
        )
      ] });
    }
    function panelLabel(name, turns, series, peak, sum) {
      const head = `${name}的按轮次柱状图：共 ${String(turns.length)} 轮，合计 ${formatTokens(sum)} 词元`;
      if (peak < 0) return `${head}；这个会话没有读数。`;
      const tail = `，峰值在第 ${String(turns[peak].turn)} 轮 ${formatTokens(series[peak])} 词元。`;
      if (turns.length > 8) return `${head}${tail}`;
      return `${head}；${turns.map((group, index) => `第 ${String(group.turn)} 轮 ${formatTokens(series[index])}`).join("、")}${tail}`;
    }
    
    // src/client/session-detail.tsx
    var import_react10 = require("react");
    var import_jsx_runtime17 = require("react/jsx-runtime");
    function groupTotals(group) {
      return {
        steps: group.rows.length,
        tokens: group.tokens,
        spend: group.spend,
        subscriptionValue: group.subscriptionValue,
        priced: hasPricedRow(group.rows),
        ...timedTotal(group.rows)
      };
    }
    function rowsTotals(rows) {
      let tokens = 0;
      let spend = 0;
      let subscriptionValue = 0;
      for (const row of rows) {
        tokens += num(row.tokens);
        if (row.bucket === "subscription") subscriptionValue += num(row.cost);
        else if (row.bucket !== "unpriced") spend += num(row.cost);
      }
      return { steps: rows.length, tokens, spend, subscriptionValue, priced: hasPricedRow(rows), ...timedTotal(rows) };
    }
    function timedTotal(rows) {
      if (!rows.some((row) => row.timing !== void 0)) return {};
      const shape = settleTiming(rows);
      return { workMs: shape.llmMs + shape.toolMs };
    }
    function TurnBlocks({ turns, betweenTurns, unattributed, previews }) {
      const [expanded, setExpanded] = (0, import_react10.useState)(() => /* @__PURE__ */ new Set());
      const turnScale = Math.max(1, ...[...turns, ...betweenTurns === null ? [] : [betweenTurns]].map((group) => groupTotals(group).workMs ?? 0));
      const toggle = (key) => {
        setExpanded((current) => {
          const next = new Set(current);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      };
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("section", { "aria-label": "按轮次明细", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("h2", { className: "dtpl-sec-title", children: "按轮次明细" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dtpl-tok-note dtpl-tok-legend", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-tok-legend-figure", children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
              TimeBar,
              {
                tone: "step",
                segments: LEGEND_SHAPE.map((phase) => ({ key: phase.kind, value: phase.share, kind: phase.kind }))
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-legend-keys", children: LEGEND_SHAPE.map((phase) => /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: { flexGrow: phase.share }, children: phase.label }, phase.kind)) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-tok-legend-model", children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-legend-key", "data-kind": "model", "aria-hidden": "true" }),
            "模型（拆不开）：通道没上报流，等与生成分不清"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-legend-say", children: "步骤尺铺满整行；只有轮块头那条的长度说量级" }),
          "      "
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "dtpl-tok-turns", children: turns.map((group) => /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
          TurnBlock,
          {
            blockKey: turnKey(group),
            label: `第 ${String(group.turn)} 轮`,
            totals: groupTotals(group),
            rows: group.rows,
            preview: group.turn === null ? void 0 : previews.get(group.turn),
            expanded,
            onToggle: toggle,
            turnScale
          },
          turnKey(group)
        )) }),
        (betweenTurns !== null || unattributed.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dtpl-tok-tail", children: [
          betweenTurns !== null && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
            TurnBlock,
            {
              blockKey: "betweenTurns",
              label: "轮间",
              loose: true,
              totals: groupTotals(betweenTurns),
              rows: betweenTurns.rows,
              note: "确定不属于任何轮次的计费调用（目前只有压缩 summarize）",
              expanded,
              onToggle: toggle,
              turnScale
            }
          ),
          unattributed.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
            TurnBlock,
            {
              blockKey: "unattributed",
              label: "轮次未知",
              loose: true,
              totals: rowsTotals(unattributed),
              rows: unattributed,
              note: "没能拿到轮次/步骤的账本行：会话日志读不到，或这一行没有对应的事件",
              expanded,
              onToggle: toggle,
              turnScale
            }
          )
        ] })
      ] });
    }
    function turnKey(group) {
      return `turn:${String(group.turn)}`;
    }
    function TurnBlock({ blockKey, label, totals, rows, preview, note, loose, expanded, onToggle, turnScale }) {
      const open = expanded.has(blockKey);
      const columns = timingColumnsOf(rows);
      const phases = sumSegments(rows);
      const phaseReads = phases.map((phase) => ({
        key: phase.key,
        kind: phase.kind,
        label: PHASE_LABEL[phase.kind],
        value: formatDuration(phase.value)
      }));
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: `dtpl-tok-turn${loose === true ? " is-loose" : ""}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
          "button",
          {
            type: "button",
            className: "dtpl-tok-turn-head",
            "aria-expanded": open,
            title: note,
            onClick: () => onToggle(blockKey),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-turn-k", children: label }),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-hero-facts", children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-hero-fact", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("b", { children: totals.steps }),
                  " 步"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("i", { "aria-hidden": "true", children: "·" }),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-hero-fact", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("b", { children: formatTokens(totals.tokens) }),
                  " 词元"
                ] }),
                totals.workMs !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("i", { "aria-hidden": "true", children: "·" }),
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-hero-fact", children: [
                    "用时 ",
                    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("b", { children: formatDuration(totals.workMs) })
                  ] })
                ] }),
                totals.priced ? (totals.spend > 0 || totals.subscriptionValue === 0) && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("i", { "aria-hidden": "true", children: "·" }),
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-hero-fact", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("b", { children: formatMoney(totals.spend) }),
                    " 实际支出"
                  ] })
                ] }) : /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("i", { "aria-hidden": "true", children: "·" }),
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-hero-fact", children: "价格未知" })
                ] }),
                totals.subscriptionValue > 0 && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("i", { "aria-hidden": "true", children: "·" }),
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-hero-fact", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("b", { children: formatMoney(totals.subscriptionValue) }),
                    " 订阅价值"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-turn-cue", "aria-hidden": "true", children: "▾" }),
              phases.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-turn-bar", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(TimeBar, { tone: "turn", scale: turnScale, segments: phases }) }),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(TimeReads, { reads: phaseReads })
              ] }),
              preview !== void 0 && (preview.prompt !== "" || preview.response !== "") && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-tok-turn-preview", children: [
                preview.prompt !== "" && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-turn-ask", title: preview.prompt, children: preview.prompt }),
                preview.response !== "" && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-turn-reply", title: preview.response, children: preview.response })
              ] })
            ]
          }
        ),
        rows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "dtpl-tok-steps", "data-open": open, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "dtpl-tok-steps-inner", children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(StepRow, { row, columns }, row.requestId)) }) })
      ] });
    }
    var TIMING_METRICS = [
      { key: "llmMs", label: "模型" },
      { key: "ttftMs", label: PHASE_LABEL.wait },
      { key: "decodeMs", label: PHASE_LABEL.generate },
      { key: "toolMs", label: PHASE_LABEL.tool }
    ];
    function timingColumnsOf(rows) {
      const metrics = TIMING_METRICS.filter((metric) => rows.some((row) => row.timing?.[metric.key] !== void 0));
      const speed = rows.some((row) => speedOf(row) !== null);
      return { metrics, speed };
    }
    function speedOf(row) {
      return tokensPerSecond(row.usage?.outputTokens, row.timing?.decodeMs);
    }
    function StepRow({ row, columns }) {
      const usage = row.usage;
      const chip = chipOf(row);
      const segments = stepSegments(row.timing);
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dtpl-row dtpl-tok-step", title: stepDetail(row), children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dtpl-tok-step-id", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-step-no", children: row.step === void 0 ? "步骤未知" : `第 ${String(row.step)} 步` }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-step-time", children: formatDateTime(num(row.time)) }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-step-model", children: row.model === "" ? "模型未知" : row.model }),
          chip !== null && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("em", { className: "dtpl-tok-chip", "data-kind": chip.kind, children: chip.word })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(CostCell, { row }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-step-bar", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(TimeBar, { segments, tone: "step" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dtpl-tok-step-read", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(StepTimingTable, { row, columns }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-tokens", children: usage === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-untimed", children: "用量未知" }) : BUCKETS.map((bucketOf) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-tok-metric", children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-metric-k", children: bucketOf.label }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-metric-v", children: formatTokens(num(usage[bucketOf.key])) })
          ] }, bucketOf.key)) })
        ] })
      ] });
    }
    function StepTimingTable({ row, columns }) {
      const timing = row.timing;
      const speed = speedOf(row);
      const cells = Math.max(1, columns.metrics.length + (columns.speed ? 1 : 0));
      const style = { "--dtpl-tok-cells": String(cells) };
      if (timing?.llmMs === void 0) {
        const wall = timing?.wallMs;
        return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-tok-metrics is-flat", style, children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-tok-metric", children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-metric-k", children: "用时" }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: wall === void 0 ? "dtpl-tok-metric-v dtpl-tok-untimed" : "dtpl-tok-metric-v", children: wall === void 0 ? "未计时" : formatDuration(wall) })
          ] }),
          wall !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-untimed is-note", children: "无产出：这段墙钟耗在重试与退避上，没有模型那段可归属" })
        ] });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-tok-metrics", style, children: [
        columns.metrics.map((metric) => {
          const value = timing[metric.key];
          return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-tok-metric", children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-metric-k", children: metric.label }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: value === void 0 ? "dtpl-tok-metric-v dtpl-tok-untimed" : "dtpl-tok-metric-v", children: value === void 0 ? "—" : formatDuration(value) })
          ] }, metric.key);
        }),
        columns.speed && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-tok-metric", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-metric-k", children: "tok/s" }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: speed === null ? "dtpl-tok-metric-v dtpl-tok-untimed" : "dtpl-tok-metric-v", children: speed === null ? "—" : String(speed) })
        ] })
      ] });
    }
    function CostCell({ row }) {
      const bucket = row.bucket === "subscription" || row.bucket === "unpriced" ? row.bucket : "spend";
      const valueClass = bucket === "unpriced" ? "dtpl-cost-na" : bucket === "subscription" ? "dtpl-sub-amt" : "dtpl-cash-amt";
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-tok-step-cost", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-step-cost-k", children: bucket === "unpriced" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
          "价格未知",
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("i", { children: "按 ¥0 计" })
        ] }) : bucketWord(bucket) }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: valueClass, children: bucket === "unpriced" ? "—" : formatMoney(num(row.cost)) })
      ] });
    }
    function bucketWord(bucket) {
      return bucket === "subscription" ? "订阅价值" : "实际支出";
    }
    function tokensPerSecond(outputTokens, decodeMs) {
      if (typeof outputTokens !== "number" || !Number.isFinite(outputTokens) || outputTokens <= 0) return null;
      if (decodeMs === void 0 || decodeMs <= 0) return null;
      const rate = outputTokens / (decodeMs / 1e3);
      return rate >= 10 ? Math.round(rate) : Math.round(rate * 10) / 10;
    }
    function chipOf(row) {
      if (row.kind === "failure" || row.failureCode !== void 0) return { kind: "failure", word: "失败" };
      if (row.kind === "compaction") return { kind: "compaction", word: "压缩" };
      return null;
    }
    function stepDetail(row) {
      const usage = row.usage;
      return [
        row.step === void 0 ? "步骤未知" : `第 ${String(row.step)} 步`,
        formatDateTime(num(row.time)),
        row.model === "" ? "模型未知" : row.model,
        ...row.provider === "" ? [] : [`通道 ${row.provider}`],
        usage === void 0 ? "用量未知：通道没有上报 usage，这一次调用没有词元可加" : BUCKETS.map((bucket) => `${bucket.label} ${formatTokens(num(usage[bucket.key]))}`).join(" · "),
        `合计 ${formatTokens(num(row.tokens))} 词元`,
        row.bucket === "unpriced" ? `价格未知：这一行按 ¥0 计（价表计不了 ${row.provider === "" ? "这条通道" : row.provider} 的这个模型）` : `金额 ${formatMoney(num(row.cost))} ${bucketWord(row.bucket)}`,
        ...row.failureCode === void 0 ? [] : [`失败码 ${row.failureCode}`],
        ...timingDetail(row.timing)
      ].join("\n");
    }
    function timingDetail(timing) {
      if (timing === void 0) return ["未计时：这一步没有可用的起止事件"];
      const wall = timing.wallMs === void 0 ? void 0 : `用时 ${formatDuration(timing.wallMs)}`;
      const model = timing.llmMs === void 0 ? "模型用时未知：这一步没有产出（取消 / 重试耗尽）" : `其中模型 ${formatDuration(timing.llmMs)}`;
      const lines = [
        wall === void 0 ? model : `${wall}（${model}）`
      ];
      if (timing.ttftMs !== void 0) lines.push(`${PHASE_LABEL.wait} ${formatDuration(timing.ttftMs)}`);
      if (timing.decodeMs !== void 0) lines.push(`生成 ${formatDuration(timing.decodeMs)}`);
      if (timing.toolMs !== void 0) {
        const calls = timing.toolCalls ?? 0;
        lines.push(`工具 ${formatDuration(timing.toolMs)}（${String(calls)} 次调用取并集，并行只算一次）`);
        const slow = timing.slowTool;
        if (slow !== void 0) {
          const name = slow.name === "" ? "未具名工具" : slow.name;
          lines.push(`  最慢：${name} ${formatDuration(slow.ms)}${WAITING_TOOLS.has(slow.name) ? "（在等外部输入 / 外部任务，不是它在算）" : ""}`);
        }
      }
      return lines;
    }
    var WAITING_TOOLS = /* @__PURE__ */ new Set(["ask_user_question", "wait_agent", "exit_plan_mode"]);
    
    // src/client/SessionTurns.tsx
    var import_jsx_runtime18 = require("react/jsx-runtime");
    function MixBand({ totals, totalTokens }) {
      const billedInput = num(totals.inputTokens) + num(totals.cacheReadTokens) + num(totals.cacheWriteTokens);
      const hitRate = formatRatio(num(totals.cacheReadTokens), billedInput);
      return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("section", { className: "dtpl-tok-mix-band", "aria-label": "词元构成", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("p", { className: "dtpl-tok-note", children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { children: "计费输入 = 未缓存输入 + 缓存读取 + 缓存写入" }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("span", { className: "dtpl-tok-mix-hit", children: [
            "缓存命中率 ",
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("b", { children: hitRate === null ? "—" : `${hitRate}%` })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "dtpl-grid", children: BUCKETS.map((bucket) => /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "dtpl-stat", role: "listitem", children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "dtpl-stat-k", children: bucket.label }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "dtpl-stat-v", children: formatTokens(num(totals[bucket.key])) }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("span", { className: "dtpl-stat-p", children: [
            "占 ",
            formatShare(num(totals[bucket.key]), totalTokens)
          ] })
        ] }, bucket.key)) })
      ] });
    }
    
    // src/client/SessionTokens.tsx
    var import_jsx_runtime19 = require("react/jsx-runtime");
    var POLL_MS = 15e3;
    var lastViews2 = /* @__PURE__ */ new Map();
    var LAST_VIEWS_MAX = 8;
    function lastViewOf(sessionId) {
      return sessionId === void 0 ? null : lastViews2.get(sessionId) ?? null;
    }
    function rememberView(sessionId, view) {
      lastViews2.delete(sessionId);
      lastViews2.set(sessionId, view);
      for (const oldest of lastViews2.keys()) {
        if (lastViews2.size <= LAST_VIEWS_MAX) break;
        lastViews2.delete(oldest);
      }
    }
    function SessionTokens({ sessionId, useProjection }) {
      const [loaded, setLoaded] = (0, import_react11.useState)(null);
      const [error, setError] = (0, import_react11.useState)(null);
      const [reload, setReload] = (0, import_react11.useState)(0);
      const usable = typeof sessionId === "string" && sessionId !== "";
      const view = loaded !== null && loaded.sessionId === sessionId ? loaded.view : lastViewOf(sessionId);
      (0, import_react11.useEffect)(() => {
        if (!usable) return;
        const target = sessionId;
        const url = `${ROUTE_SESSION}?${QUERY_SESSION}=${encodeURIComponent(target)}`;
        const controller = new AbortController();
        let latest = 0;
        let pending = 0;
        const load = () => {
          if (pending !== 0) return;
          if (document.hidden) return;
          const token = ++latest;
          pending = token;
          fetch(url, { signal: controller.signal }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          }).then((raw) => {
            if (controller.signal.aborted || token !== latest) return;
            const next = readSessionView(raw);
            if (next === null) {
              setError("响应不是一份会话词元视图");
              return;
            }
            setLoaded({ sessionId: target, view: next });
            rememberView(target, next);
            setError(null);
          }).catch((err) => {
            if (controller.signal.aborted || token !== latest) return;
            setError(err instanceof Error ? err.message : String(err));
          }).finally(() => {
            if (pending === token) pending = 0;
          });
        };
        const onVisibility2 = () => {
          if (!document.hidden) load();
        };
        load();
        document.addEventListener("visibilitychange", onVisibility2);
        const unsubscribe = subscribeLedgerChanges(() => {
          load();
        });
        const timer2 = setInterval(() => {
          if (!ledgerClockSupported()) load();
        }, POLL_MS);
        return () => {
          controller.abort();
          clearInterval(timer2);
          unsubscribe();
          document.removeEventListener("visibilitychange", onVisibility2);
        };
      }, [usable, sessionId, reload]);
      const previews = indexPreviews(useProjection?.("turnOutline"));
      if (!usable) {
        return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(SessionShell, { children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          EmptyCard,
          {
            title: "没有拿到会话标识",
            sub: "这一页按会话读账本；宿主没有给出会话标识时，读不到任何东西。"
          }
        ) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(SessionShell, { children: [
        error !== null && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "dtpl-error", role: "alert", children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("p", { className: "dtpl-error-text", children: [
            "本会话词元加载失败：",
            error
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("button", { type: "button", className: "dtpl-retry", onClick: () => setReload((round) => round + 1), children: "重试" })
        ] }),
        view === null ? error === null ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "dtpl-sk dtpl-tok-sk", "aria-hidden": "true" }) : null : isEmptyView(view) ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          EmptyCard,
          {
            title: "这个会话还没有入账的计费调用",
            sub: "账本一行就是一次模型调用。先聊几句就会有记录；安装前的历史记录可以在侧栏的账本浮窗里点「重新扫描」补上。"
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Body, { view, previews })
      ] });
    }
    function EmptyCard({ title, sub }) {
      return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "dtpl-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(UsageGlyph, { className: "dtpl-empty-ico" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: "dtpl-empty-title", children: title }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: "dtpl-empty-sub", children: sub })
      ] });
    }
    function Block({ i, children }) {
      return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "dtpl-tok-block", style: { "--dtpl-tok-i": i }, children });
    }
    function SessionTiming({ workMs, spanMs, firstAt, lastAt }) {
      const idleMs = spanMs - workMs;
      return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("section", { "aria-label": "会话时间", children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("h2", { className: "dtpl-sec-title", children: "会话时间" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "dtpl-tok-timing", children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "dtpl-tok-timing-grid", children: [
            /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "dtpl-stat", role: "listitem", children: [
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-stat-k", children: "引擎工作" }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-stat-v", children: formatDuration(workMs) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "dtpl-stat", role: "listitem", children: [
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-stat-k", children: "会话跨度" }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-stat-v", children: formatDuration(spanMs) })
            ] })
          ] }),
          idleMs > 0 && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
            TimeBar,
            {
              tone: "hero",
              scale: spanMs,
              reads: [
                { key: "work", kind: "work", label: "引擎工作", value: formatDuration(workMs) },
                { key: "idle", kind: "idle", label: "没在算", value: formatDuration(idleMs) }
              ],
              segments: [
                { key: "work", value: workMs, kind: "work" },
                { key: "idle", value: idleMs, kind: "idle" }
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-facts", children: [
            /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-fact", children: [
              "首记 ",
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("b", { children: recordTime(firstAt) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("i", { "aria-hidden": "true", children: "·" }),
            /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-fact", children: [
              "末记 ",
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("b", { children: recordTime(lastAt) })
            ] })
          ] })
        ] })
      ] });
    }
    function CountUp({ value, format }) {
      const [current, setCurrent] = (0, import_react11.useState)(0);
      const raf = (0, import_react11.useRef)(0);
      (0, import_react11.useEffect)(() => {
        if (!(value > 0)) {
          setCurrent(0);
          return;
        }
        const start = performance.now();
        const from = current;
        const tick = (now) => {
          const progress = Math.min((now - start) / 1200, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCurrent(from + (value - from) * eased);
          if (progress < 1) raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf.current);
      }, [value]);
      return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { children: format(current) });
    }
    function Body({ view, previews }) {
      const tokens = view.totalTokens;
      const todayShare = view.todaySpend > 0 ? formatShare(view.spend, view.todaySpend) : null;
      return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_jsx_runtime19.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Block, { i: 0, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "dtpl-tok-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-total-k", children: "本会话四桶合计" }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-hero-figure", children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-total-num", children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(CountUp, { value: tokens, format: formatTokens }) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-facts", children: [
            todayShare !== null && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_jsx_runtime19.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-fact", children: [
                "本会话占今日消费 ",
                /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("b", { children: todayShare })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("i", { "aria-hidden": "true", children: "·" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-fact", children: [
              "实际支出 ",
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("b", { children: formatMoney(view.spend) })
            ] }),
            view.subscriptionValue > 0 && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_jsx_runtime19.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("i", { "aria-hidden": "true", children: "·" }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-fact", children: [
                "订阅价值 ",
                /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("b", { children: formatMoney(view.subscriptionValue) })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("i", { "aria-hidden": "true", children: "·" }),
            /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-fact", children: [
              "共 ",
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("b", { children: view.turns.length }),
              " 轮 / ",
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("b", { children: countSteps(view) }),
              " 步"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MixBand, { totals: view.total, totalTokens: tokens })
        ] }) }),
        view.subagents !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Block, { i: 1, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(SubagentSection, { view: view.subagents, sessionTokens: tokens }) }),
        view.workMs !== void 0 && view.spanMs !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Block, { i: 2, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          SessionTiming,
          {
            workMs: view.workMs,
            spanMs: view.spanMs,
            firstAt: view.firstAt,
            lastAt: view.lastAt
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Block, { i: 3, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(TurnChart, { turns: view.turns, previews }) }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Block, { i: 4, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          TurnBlocks,
          {
            turns: view.turns,
            betweenTurns: view.betweenTurns,
            unattributed: view.unattributed,
            previews
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Block, { i: 5, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Footer, { total: view.total, unpriced: view.unpriced, timing: hasTiming(view) }) })
      ] });
    }
    function Footer({ total, unpriced, timing }) {
      return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "dtpl-tok-foot", children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-facts", children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-fact", children: [
            "用量未知 ",
            /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("b", { children: total.usageUnknown ?? 0 }),
            " 次"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("i", { "aria-hidden": "true", children: "·" }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-fact", children: [
            "失败 ",
            /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("b", { children: total.failures ?? 0 }),
            " 次"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("i", { "aria-hidden": "true", children: "·" }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-hero-fact", children: [
            "价格未知 ",
            /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("b", { children: unpriced.length }),
            " 个 (通道, 模型)"
          ] })
        ] }),
        timing && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: "dtpl-tok-note", children: "用时都来自会话日志的事件时刻（本机墙钟，不是计费时长）：一步的墙钟就是「模型 + 工具」 两段，工具并行时取并集。没量到起止事件的步骤写「未计时」，不折算成 0。" }),
        unpriced.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("p", { className: "dtpl-tok-note", children: [
          "价格未知：",
          unpriced.join(" · "),
          "——这些行按 ¥0 计"
        ] })
      ] });
    }
    function recordTime(epochMs) {
      return epochMs > 0 ? formatDateTime(epochMs) : "—";
    }
    function hasTiming(view) {
      return view.workMs !== void 0 || view.spanMs !== void 0;
    }
    function countSteps(view) {
      let steps = view.unattributed.length;
      if (view.betweenTurns !== null) steps += view.betweenTurns.rows.length;
      for (const group of view.turns) steps += group.rows.length;
      return steps;
    }
    function isEmptyView(view) {
      return view.total.requests === 0 && (view.total.failures ?? 0) === 0 && view.turns.length === 0 && view.betweenTurns === null && view.unattributed.length === 0;
    }
    function indexPreviews(outline) {
      const previews = /* @__PURE__ */ new Map();
      if (!Array.isArray(outline)) return previews;
      for (const entry of outline) {
        if (typeof entry !== "object" || entry === null) continue;
        const { turn, prompt, response } = entry;
        if (typeof turn !== "number") continue;
        previews.set(turn, {
          turn,
          prompt: typeof prompt === "string" ? prompt : "",
          response: typeof response === "string" ? response : ""
        });
      }
      return previews;
    }
    
    // src/client/index.ts
    var inject = ["slots"];
    var QUOTA_ALERT_POLL_MS = 5 * 6e4;
    function refreshQuotaAlert(view) {
      return fetch(ROUTE_QUOTA).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }).then((data) => {
        view.setQuotaAlert(data.alert === true);
      }).catch(() => void 0);
    }
    function apply(ctx) {
      const view = createTokBookViewStore();
      ctx.effect(() => injectStyles());
      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action",
        id: "dsh-tokbook",
        order: 100,
        inject: () => ({ view })
      }, FooterButton));
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "dsh-tokbook",
        order: 200,
        inject: () => ({ view })
      }, LedgerOverlay));
      ctx.slots.inject("conversation.view", () => ctx.slots.register({
        name: "conversation.view",
        id: "dsh-tokbook-tokens",
        order: 20,
        label: "词元",
        inject: (sessionId) => ({ sessionId })
      }, SessionTokens));
      void refreshQuotaAlert(view);
      const poll = setInterval(() => {
        void refreshQuotaAlert(view);
      }, QUOTA_ALERT_POLL_MS);
      ctx.effect(() => () => {
        clearInterval(poll);
      });
      let wasOpen = false;
      const unsubscribe = view.subscribe(() => {
        const open = view.getSnapshot().open;
        if (wasOpen && !open) void refreshQuotaAlert(view);
        wasOpen = open;
      });
      ctx.effect(() => unsubscribe);
    }
    
    return module.exports;
  },
});
