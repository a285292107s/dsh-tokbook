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
    
      --dtpl-brand:#c99a2e;
      --dtpl-on-brand:#24211e;
    
      --dtpl-holiday:color-mix(in srgb,var(--dtpl-err) 80%,#8f3a22);
      --dtpl-paper-bg:color-mix(in srgb,var(--dtpl-brand) 5%,var(--dtpl-card));
      --dtpl-serif:"Iowan Old Style","Palatino Linotype","Songti SC","Noto Serif SC","Source Han Serif SC",Georgia,serif;
    
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
      --dtpl-lh-read:1.6;
      --dtpl-row-nums-w:224px;
      --dtpl-grid-gap:12px;
    }
    `;
    
    // src/client/styles/page.ts
    var CSS_PAGE = `
    [data-plugin="dsh-tokbook"].dtpl-page{
      flex:1;min-height:0;
      display:flex;flex-direction:column;
      position:relative;
      background:var(--dtpl-paper);
      background-color:var(--dtpl-card);
      background-size:var(--dtpl-paper-size);
      color:var(--dtpl-fg);
      overflow:hidden;
      --dtpl-page-pad:clamp(20px,3.6vw,40px);
      --dtpl-page-col:1280px;
    }
    
    [data-plugin="dsh-tokbook"].dtpl-page > .dtpl-head,
    [data-plugin="dsh-tokbook"].dtpl-page > .dtpl-tabs,
    [data-plugin="dsh-tokbook"].dtpl-page > .dtpl-body-wrap,
    [data-plugin="dsh-tokbook"].dtpl-page > .dtpl-foot{
      box-sizing:border-box;
      width:100%;max-width:var(--dtpl-page-col);margin-inline:auto;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-head{
      display:flex;align-items:center;justify-content:space-between;gap:16px;
      flex:none;
      padding:26px var(--dtpl-page-pad) 14px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-head-meta{
      display:flex;align-items:center;gap:12px;flex:none;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-head-meta b{font-weight:600;color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-head-meta i{font-style:normal;color:var(--dtpl-fg-dim);}
    @media (max-width:760px){
      [data-plugin="dsh-tokbook"] .dtpl-head-meta{display:none;}
    }
    html[data-platform="darwin"] [data-plugin="dsh-tokbook"] .dtpl-head{
      padding-top:calc(26px + var(--dsh-frame-top-clearance,0px));
    }
    [data-plugin="dsh-tokbook"] .dtpl-title{
      display:flex;align-items:center;gap:10px;min-width:0;
      margin:0;
      font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);font-weight:600;letter-spacing:.02em;
    }
    [data-plugin="dsh-tokbook"] .dtpl-title-ico-chip{
      display:inline-flex;align-items:center;justify-content:center;flex:none;
      width:24px;height:24px;
      background:var(--dtpl-brand);
      color:var(--dtpl-on-brand);
      box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
    }
    [data-plugin="dsh-tokbook"] .dtpl-title-ico{width:15px;height:15px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-tabs{
      display:flex;gap:0;flex:none;
      margin:0;padding:0 var(--dtpl-page-pad);
      border-bottom:1px solid var(--dtpl-border);
      position:relative;
      overflow-x:auto;scrollbar-width:none;
    }
    [data-plugin="dsh-tokbook"] .dtpl-tabs::-webkit-scrollbar{display:none;}
    [data-plugin="dsh-tokbook"] .dtpl-tab{
      position:relative;appearance:none;flex:none;border:0;background:transparent;
      height:34px;padding:0 16px;box-sizing:border-box;
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
    
    [data-plugin="dsh-tokbook"] .dtpl-body-wrap{position:relative;flex:1;min-height:0;}
    [data-plugin="dsh-tokbook"] .dtpl-body{
      position:absolute;inset:0;box-sizing:border-box;
      container-type:inline-size;
      padding:20px var(--dtpl-page-pad) 28px;overflow:auto;overscroll-behavior:contain;
      scrollbar-width:none;
      scroll-padding:8px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-body::-webkit-scrollbar{width:0;height:0;}
    [data-plugin="dsh-tokbook"] .dtpl-scroll-rail{
      position:absolute;top:0;right:0;bottom:0;width:10px;z-index:1;
      opacity:0;pointer-events:none;
      transform:translateX(5px);
      transition:opacity var(--dtpl-dur-move) var(--dtpl-ease-tint), transform var(--dtpl-dur-move) var(--dtpl-ease-move);
    }
    [data-plugin="dsh-tokbook"] .dtpl-scroll-rail[data-visible="true"]{opacity:1;transform:translateX(0);transition-duration:var(--dtpl-dur-enter);}
    [data-plugin="dsh-tokbook"] .dtpl-scroll-thumb{
      position:absolute;left:2px;width:5px;
      background:color-mix(in srgb,var(--dtpl-fg) 30%,transparent);
    }
    
    [data-plugin="dsh-tokbook"] :focus-visible{
      outline:2px solid var(--dtpl-focus);outline-offset:2px;
    }
    
    .dtpl-nav-ico-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center;}
    .dtpl-nav-ico{width:100%;height:100%;}
    .dtpl-nav-alert{
      position:absolute;top:-2px;right:-2px;
      width:8px;height:8px;border-radius:50%;
      background:var(--dsw-alias-state-warn-primary,#9a6700);
      box-shadow:0 0 0 2px var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-layer-1,#ffffff));
    }
    `;
    
    // src/client/styles/grid.ts
    var CSS_GRID = `
    [data-plugin="dsh-tokbook"] .dtpl-grid{
      display:grid;
      grid-template-columns:repeat(12,minmax(0,1fr));
      gap:var(--dtpl-grid-gap);
      align-items:stretch;
    }
    [data-plugin="dsh-tokbook"] .dtpl-grid > *{min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-grid > .dtpl-error{margin:0;}
    
    [data-plugin="dsh-tokbook"] .dtpl-span-12{grid-column:1/-1;}
    [data-plugin="dsh-tokbook"] .dtpl-card{
      display:flex;flex-direction:column;min-width:0;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      box-shadow:
        var(--dtpl-sheen),
        var(--dtpl-metal),
        var(--dtpl-lift);
      transition:box-shadow var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-card:hover{
      box-shadow:
        var(--dtpl-sheen-hover),
        var(--dtpl-metal),
        var(--dtpl-lift-hover);
    }
    [data-plugin="dsh-tokbook"] .dtpl-card-pad{padding:16px;}
    
    `;
    
    // src/client/styles/ledger.ts
    var CSS_LEDGER = `
    [data-plugin="dsh-tokbook"] .dtpl-grid > .dtpl-empty{margin:0;}
    [data-plugin="dsh-tokbook"] .dtpl-mod-h{
      display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:2px 12px;
      padding:7px 14px;
      border-bottom:1px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-mod-t{
      display:flex;align-items:center;gap:8px;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;letter-spacing:.14em;
      color:var(--dtpl-fg-2);margin:0;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-mod-t::before{
      content:"";flex:none;width:6px;height:6px;background:var(--dtpl-brand);
    }
    [data-plugin="dsh-tokbook"] .dtpl-mod-aux{
      flex:none;
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.06em;
      color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-card-today{
      position:relative;overflow:hidden;
      container-type:inline-size;
    }
    [data-plugin="dsh-tokbook"] .dtpl-card-today::before{
      content:"";position:absolute;left:0;right:0;top:0;height:3px;
      background:linear-gradient(90deg,var(--dtpl-brand),color-mix(in srgb,var(--dtpl-brand) 30%,transparent));
    }
    [data-plugin="dsh-tokbook"] .dtpl-today{
      display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;
      padding:18px 18px 0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-today-top{
      display:grid;grid-template-columns:minmax(240px,1fr) minmax(0,1.8fr) 250px;
      grid-template-areas:"hero mix money";
      column-gap:24px;align-items:stretch;
    }
    [data-plugin="dsh-tokbook"] .dtpl-today-hero{grid-area:hero;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-today-k{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);letter-spacing:.08em;color:var(--dtpl-fg-2);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-today-v{
      font-family:var(--dtpl-mono);
      font-size:clamp(52px,8.4cqi,92px);line-height:.98;font-weight:600;letter-spacing:-.05em;
      color:var(--dtpl-fg);font-variant-numeric:tabular-nums;white-space:nowrap;
      margin-top:2px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-today-sub{
      display:flex;align-items:baseline;gap:6px;min-width:0;
      margin-top:6px;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    [data-plugin="dsh-tokbook"] .dtpl-today-sub b{
      font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-today-money{
      grid-area:money;display:flex;flex-direction:column;min-width:0;
      padding-left:24px;border-left:1px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-money-row{
      display:flex;align-items:baseline;justify-content:space-between;gap:12px;
      padding:7px 0;border-top:1px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-money-row:first-child{border-top:0;padding-top:0;}
    [data-plugin="dsh-tokbook"] .dtpl-money-k{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-money-v{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;
      color:var(--dtpl-fg);font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-money-v.is-muted{color:var(--dtpl-fg-2);font-weight:400;}
    [data-plugin="dsh-tokbook"] .dtpl-money-note{
      margin-top:auto;padding-top:10px;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-today-mix{
      grid-area:mix;display:flex;flex-direction:column;min-width:0;min-height:0;
      padding-left:24px;border-left:1px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-today-mix-h{
      display:flex;align-items:baseline;justify-content:space-between;gap:12px;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);letter-spacing:.04em;
    }
    [data-plugin="dsh-tokbook"] .dtpl-today-hit{white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-today-hit b{
      font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-today-mix .dtpl-compose{margin-top:11px;}
    [data-plugin="dsh-tokbook"] .dtpl-today-foot{
      display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 18px;
      margin-top:12px;padding:10px 0 12px;border-top:1px solid var(--dtpl-hairline);
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-today-foot b{
      font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);
    }
    @container (max-width:1100px){
      [data-plugin="dsh-tokbook"] .dtpl-today-top{
        grid-template-columns:minmax(0,1fr) 250px;
        grid-template-areas:"hero money" "mix mix";
        row-gap:16px;
      }
      [data-plugin="dsh-tokbook"] .dtpl-today-mix{
        padding-left:0;padding-top:14px;border-left:0;border-top:1px solid var(--dtpl-hairline);
      }
    }
    @container (max-width:700px){
      [data-plugin="dsh-tokbook"] .dtpl-today-top{
        grid-template-columns:minmax(0,1fr);
        grid-template-areas:"hero" "mix" "money";
      }
      [data-plugin="dsh-tokbook"] .dtpl-today-money{
        padding-left:0;padding-top:14px;border-left:0;border-top:1px solid var(--dtpl-hairline);
      }
    }
    [data-plugin="dsh-tokbook"] .dtpl-chart{display:flex;flex-direction:column;flex:1;min-height:0;padding:10px 14px 8px;}
    [data-plugin="dsh-tokbook"] .dtpl-chart-key{
      display:flex;align-items:center;gap:16px;flex-wrap:wrap;flex:none;
      padding:0 2px 4px;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-chart-key span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-chart-key i{display:inline-block;flex:none;}
    [data-plugin="dsh-tokbook"] .dtpl-key-bar{width:10px;height:10px;background:color-mix(in srgb,var(--dtpl-fg) 18%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-key-today{width:10px;height:10px;background:var(--dtpl-brand);box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);}
    [data-plugin="dsh-tokbook"] .dtpl-key-line{width:18px;height:2px;background:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-chart-svg{display:block;width:100%;height:auto;}
    [data-plugin="dsh-tokbook"] .dtpl-chart-grid{stroke:var(--dtpl-hairline);stroke-width:1;}
    [data-plugin="dsh-tokbook"] .dtpl-chart-base{stroke:var(--dtpl-border);stroke-width:1;}
    [data-plugin="dsh-tokbook"] .dtpl-chart-tick{
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-micro);fill:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-chart-tick.is-peak{fill:var(--dtpl-fg);font-weight:600;paint-order:stroke;stroke:var(--dtpl-card);stroke-width:3px;stroke-linejoin:round;}
    [data-plugin="dsh-tokbook"] .dtpl-chart-tick.is-now{fill:var(--dtpl-fg);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-chart-tick.is-money{fill:var(--dtpl-fg-3);}
    [data-plugin="dsh-tokbook"] .dtpl-chart-num{
      font-family:var(--dtpl-mono);
      font-size:var(--dtpl-fs-micro);fill:var(--dtpl-fg);font-weight:600;font-variant-numeric:tabular-nums;
      paint-order:stroke;stroke:var(--dtpl-card);stroke-width:3px;stroke-linejoin:round;
    }
    [data-plugin="dsh-tokbook"] .dtpl-chart-bar{fill:color-mix(in srgb,var(--dtpl-fg) 18%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-chart-bar.is-today{fill:var(--dtpl-brand);stroke:var(--dtpl-on-brand);stroke-width:1;}
    [data-plugin="dsh-tokbook"] .dtpl-chart-line{fill:none;stroke:var(--dtpl-fg);stroke-width:1.5;}
    [data-plugin="dsh-tokbook"] .dtpl-chart-dot{fill:var(--dtpl-card);stroke:var(--dtpl-fg);stroke-width:1.5;}
    [data-plugin="dsh-tokbook"] .dtpl-chart-dot.is-peak{fill:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-chart-dot.is-today{fill:var(--dtpl-brand);stroke:var(--dtpl-on-brand);}
    [data-plugin="dsh-tokbook"] .dtpl-chart-foot{
      display:flex;flex-wrap:wrap;align-items:center;gap:8px 22px;
      padding:10px 14px 12px;border-top:1px solid var(--dtpl-hairline);
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-chart-mix-h{
      display:flex;align-items:center;gap:8px;flex:none;white-space:nowrap;
      font-weight:600;letter-spacing:.04em;color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-chart-mix{
      display:flex;flex-wrap:wrap;align-items:center;gap:6px 24px;flex:1;
      font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-chart-mix-item{
      display:grid;grid-template-columns:9px auto auto 40px;
      align-items:center;column-gap:8px;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-chart-mix-item > .dtpl-compose-key{margin:0;}
    [data-plugin="dsh-tokbook"] .dtpl-chart-mix-k{color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-chart-mix-v{
      font-family:var(--dtpl-mono);font-weight:600;color:var(--dtpl-fg);text-align:right;
    }
    [data-plugin="dsh-tokbook"] .dtpl-chart-mix-p{
      font-style:normal;font-weight:400;color:var(--dtpl-fg-2);text-align:right;
    }
    [data-plugin="dsh-tokbook"] .dtpl-compose{display:flex;flex-direction:column;gap:9px;margin-top:11px;}
    [data-plugin="dsh-tokbook"] .dtpl-compose-row{
      display:grid;grid-template-columns:84px minmax(0,1fr) 100px;
      align-items:center;column-gap:12px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-compose-k{
      display:flex;align-items:center;gap:7px;min-width:0;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    [data-plugin="dsh-tokbook"] .dtpl-compose-key{display:inline-block;flex:none;width:9px;height:9px;}
    [data-plugin="dsh-tokbook"] .dtpl-compose-key.is-empty{opacity:.35;}
    [data-plugin="dsh-tokbook"] .dtpl-compose-key[data-k="input"]{background:color-mix(in srgb,var(--dtpl-fg) 52%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-compose-key[data-k="cache-read"]{background:color-mix(in srgb,var(--dtpl-fg) 18%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-compose-key[data-k="cache-write"]{
      background:
        repeating-linear-gradient(90deg,var(--dtpl-fg) 0 1.5px,transparent 1.5px 5px),
        color-mix(in srgb,var(--dtpl-fg) 84%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-compose-key[data-k="output"]{background:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-compose-track{
      display:block;position:relative;height:6px;min-width:0;
      background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-compose-fill{display:block;height:100%;}
    [data-plugin="dsh-tokbook"] .dtpl-compose-fill[data-k="input"]{background:color-mix(in srgb,var(--dtpl-fg) 52%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-compose-fill[data-k="cache-read"]{background:color-mix(in srgb,var(--dtpl-fg) 18%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-compose-fill[data-k="cache-write"]{
      background:
        repeating-linear-gradient(90deg,var(--dtpl-fg) 0 1.5px,transparent 1.5px 5px),
        color-mix(in srgb,var(--dtpl-fg) 84%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-compose-fill[data-k="output"]{background:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-compose-n{
      display:grid;grid-template-columns:minmax(0,1fr) 48px;align-items:baseline;column-gap:6px;justify-items:end;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;
      color:var(--dtpl-fg);font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-compose-p{
      font-style:normal;font-weight:400;color:var(--dtpl-fg-2);text-align:right;
    }
    [data-plugin="dsh-tokbook"] .dtpl-sk-today{height:250px;}
    [data-plugin="dsh-tokbook"] .dtpl-sk-quota{height:300px;}
    [data-plugin="dsh-tokbook"] .dtpl-sk-trend{height:380px;}
    [data-plugin="dsh-tokbook"] .dtpl-sk-detail{height:300px;}
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
      grid-template-columns:minmax(220px,300px) minmax(160px,1fr) minmax(min-content,var(--dtpl-row-nums-w));
      padding:8px 0 6px;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-bd-col-id,
    [data-plugin="dsh-tokbook"] .dtpl-bd-col-share,
    [data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    [data-plugin="dsh-tokbook"] .dtpl-bd-col-nums{text-align:right;}
    
    [data-plugin="dsh-tokbook"] .dtpl-models{display:flex;flex-direction:column;}
    [data-plugin="dsh-tokbook"] .dtpl-models > .dtpl-row{
      grid-template-columns:minmax(220px,300px) minmax(160px,1fr) minmax(min-content,var(--dtpl-row-nums-w));
    }
    [data-plugin="dsh-tokbook"] .dtpl-row{align-items:start;padding:0;}
    [data-plugin="dsh-tokbook"] .dtpl-row-share{display:flex;align-items:center;gap:8px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-row-share-track{flex:1;min-width:0;height:5px;background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-row-share-track i{display:block;height:100%;background:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-row-share-p{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
      width:30px;text-align:right;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-section .dtpl-empty{
      margin:0;border:0;background:transparent;box-shadow:none;padding:28px 20px;
    }
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
      padding:11px var(--dtpl-page-pad) 14px;
      border-top:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-sync{
      display:flex;align-items:flex-start;gap:6px;flex:1 1 auto;min-width:0;
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-sync-text{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;}
    [data-plugin="dsh-tokbook"] .dtpl-sync-dot{
      flex:none;width:6px;height:6px;border-radius:50%;corner-shape:round;
      margin-top:calc((var(--dtpl-lh-body) - 6px) / 2);
      background:currentColor;
    }
    [data-plugin="dsh-tokbook"] .dtpl-sync-error{color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-sync-running{color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot{animation:dtpl-pulse 1.2s ease-in-out infinite;}
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
    [data-plugin="dsh-tokbook"] .dtpl-rescan-retry{
      color:var(--dtpl-err);
      border-color:color-mix(in srgb,var(--dtpl-err) 45%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-rescan-retry:hover:not(:disabled){
      background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);
      border-color:color-mix(in srgb,var(--dtpl-err) 60%,transparent);
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
    
    [data-plugin="dsh-tokbook"] .dtpl-skeleton{display:flex;flex-direction:column;gap:10px;}
    [data-plugin="dsh-tokbook"] .dtpl-sk{
      background:linear-gradient(100deg,
        color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 40%,
        color-mix(in srgb,var(--dtpl-fg) 10%,transparent) 50%,
        color-mix(in srgb,var(--dtpl-fg) 5%,transparent) 60%);
      background-size:200% 100%;
      animation:dtpl-shimmer 1.4s ease infinite;
    }
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
    [data-plugin="dsh-tokbook"] .dtpl-empty-act{margin-top:16px;}
    [data-plugin="dsh-tokbook"] .dtpl-empty-sub code{
      font-family:var(--dtpl-mono);font-size:.9em;
      padding:.1em .35em;
      background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
      color:var(--dtpl-fg);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-sec-aside{
      flex:none;margin-bottom:11px;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    `;
    
    // src/client/styles/method.ts
    var CSS_METHOD = `
    [data-plugin="dsh-tokbook"] .dtpl-grid-doc{max-width:1000px;margin-inline:auto;}
    [data-plugin="dsh-tokbook"] .dtpl-doc{gap:0;max-width:none;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-doc.dtpl-card-pad{padding:20px 22px;}
    [data-plugin="dsh-tokbook"] .dtpl-doc code{
      font-family:var(--dtpl-mono);
      padding:.1em .35em;
      border:1px solid var(--dtpl-hairline);
      background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
      color:var(--dtpl-fg);
      white-space:nowrap;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-head,
    [data-plugin="dsh-tokbook"] .dtpl-doc-tail{display:flex;flex-direction:column;gap:16px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-lede{
      display:flex;flex-direction:column;gap:8px;margin:0;
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-lede p{margin:0;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-lede b{color:var(--dtpl-fg);font-weight:600;}
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-facts{
      display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-fact{
      display:flex;flex-direction:column;gap:4px;
      padding:10px 12px;min-width:0;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-fact-k{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);font-weight:500;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-fact-v{
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-glossary{
      display:flex;flex-direction:column;gap:8px;
      padding-top:14px;border-top:1px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-glossary dl{
      display:grid;grid-template-columns:max-content minmax(0,1fr);align-items:baseline;gap:8px 16px;
      margin:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-glossary dl > div{display:contents;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-glossary dt{
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-glossary dd,
    [data-plugin="dsh-tokbook"] .dtpl-doc-glossary p{
      margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-sec{gap:0;}
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
      margin:0 0 14px;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-sub b{color:var(--dtpl-fg);font-weight:600;}
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-buckets{
      display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 28px;
      margin:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-bucket{
      display:flex;flex-direction:column;gap:2px;min-width:0;
      padding-left:12px;
      box-shadow:inset 2px 0 0 var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-bucket-name{
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-bucket-desc{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-table-wrap{
      overflow:auto;max-inline-size:100%;
      container:judge/inline-size;
      scrollbar-width:thin;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-table-wrap:focus-visible{outline:2px solid var(--dtpl-focus);outline-offset:2px;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge{
      width:100%;table-layout:fixed;border-collapse:collapse;
      margin:0 0 10px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge th,
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge td{
      text-align:left;vertical-align:top;
      padding:9px 10px;
      border-top:1px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th{
      padding:0 10px 6px;border-top:none;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:first-child{width:58%;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(2),
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(3){width:21%;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge tbody th{font-weight:400;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge-what{
      display:block;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge-detail{
      display:block;margin-top:2px;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge-note{
      margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-judge-note b{color:var(--dtpl-fg);font-weight:600;}
    @container judge (max-width:560px){
      [data-plugin="dsh-tokbook"] .dtpl-doc-judge{min-width:460px;}
      [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:first-child{width:46%;}
      [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(2),
      [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(3){width:27%;}
      [data-plugin="dsh-tokbook"] .dtpl-doc-judge th,
      [data-plugin="dsh-tokbook"] .dtpl-doc-judge td{padding:7px 8px;}
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-chip{
      flex:none;display:inline-flex;align-items:center;
      height:20px;padding:0 8px;margin-top:1px;
      border:1px solid color-mix(in srgb,var(--dtpl-fg) 35%,transparent);
      color:var(--dtpl-fg);
      font-size:var(--dtpl-fs-label);line-height:1;font-weight:600;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-chip-zero{
      border-color:var(--dtpl-border);
      color:var(--dtpl-fg-2);
      font-weight:500;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-chip-unknown{
      border-color:var(--dtpl-border);
      color:var(--dtpl-fg-3);
      font-weight:500;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap{
      display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-card{
      padding:14px 16px;min-width:0;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-title{
      display:flex;align-items:center;gap:8px;
      margin:0 0 10px;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-title::before{
      content:"";flex:none;width:3px;height:13px;
      background:var(--dtpl-fg-3);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title{color:var(--dtpl-warn-ink);}
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title::before{background:var(--dtpl-warn);}
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-list{
      list-style:none;margin:0;padding:0;
      display:flex;flex-direction:column;gap:12px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li{
      position:relative;padding-left:12px;
      display:flex;flex-direction:column;gap:2px;
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li::before{
      content:"";position:absolute;left:1px;top:9px;
      width:4px;height:4px;border-radius:50%;corner-shape:round;
      background:var(--dtpl-fg-3);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-name{
      display:block;color:var(--dtpl-fg);font-weight:600;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-desc{
      display:block;color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum{
      margin:14px 0 0;padding-top:12px;
      border-top:1px solid var(--dtpl-hairline);
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum b{color:var(--dtpl-fg);font-weight:600;}
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-map{
      display:grid;grid-template-columns:max-content 16px max-content;align-items:baseline;gap:7px 8px;
      margin:0 0 12px;padding:12px 14px;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-panel-bg);
      overflow-x:auto;scrollbar-width:thin;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-map-row{display:contents;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-map-row b{color:var(--dtpl-fg);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-map-arrow{color:var(--dtpl-fg-3);justify-self:center;}
    [data-plugin="dsh-tokbook"] .dtpl-doc-notes{
      display:flex;flex-direction:column;gap:4px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-notes p{
      margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-quota{
      display:flex;flex-direction:column;gap:4px;
      margin:0;padding:12px 14px;
      border:1px solid var(--dtpl-border);
      box-shadow:inset 3px 0 0 var(--dtpl-fg-3);
      background:var(--dtpl-panel-bg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-quota p{
      margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-read);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-doc-quota b{color:var(--dtpl-fg);font-weight:600;}
    
    [data-plugin="dsh-tokbook"] .dtpl-doc-data{
      display:flex;flex-direction:column;gap:4px;
      margin:0;padding:12px 14px;
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
      margin:0;padding-top:12px;
      border-top:1px solid var(--dtpl-border);
      font-size:var(--dtpl-fs-label)!important;line-height:var(--dtpl-lh-label)!important;color:var(--dtpl-fg-2)!important;
    }
    `;
    
    // src/client/styles/provider.ts
    var CSS_PROVIDER = `
    [data-plugin="dsh-tokbook"] .dtpl-usage-section{
      margin:0;padding:0;
      max-height:560px;overflow:hidden;
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-head{
      display:flex;flex-direction:column;
      margin:0;border-bottom:1px solid var(--dtpl-hairline);
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-head-top{
      display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
      padding:7px 14px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-facts{
      min-height:19px;padding:8px 14px 9px;border-top:1px solid var(--dtpl-hairline);
    }
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
    [data-plugin="dsh-tokbook"] .dtpl-usage-body-wrap{
      position:relative;display:flex;flex-direction:column;flex:1;min-height:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-body-wrap > [role="tabpanel"]{
      display:block;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:none;
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-body-wrap > [role="tabpanel"]::-webkit-scrollbar{width:0;height:0;}
    [data-plugin="dsh-tokbook"] .dtpl-usage-rail{
      position:absolute;top:0;right:0;bottom:0;width:10px;z-index:1;
      opacity:0;pointer-events:none;
      transition:opacity var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-rail[data-visible="true"]{opacity:1;}
    [data-plugin="dsh-tokbook"] .dtpl-bd-head{
      display:flex;align-items:flex-end;justify-content:space-between;gap:6px 12px;flex-wrap:wrap;
      padding:8px 14px 0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-count{
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);letter-spacing:.04em;font-weight:400;color:var(--dtpl-fg-3);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-usage-section .dtpl-bd-cols{padding:8px 14px 6px;}
    [data-plugin="dsh-tokbook"] .dtpl-usage-section .dtpl-models > .dtpl-row{
      align-items:center;padding:8px 14px;border-top:1px solid var(--dtpl-hairline);margin-top:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-models .dtpl-model-name{
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
    }
    [data-plugin="dsh-tokbook"] .dtpl-models .dtpl-model-txt{gap:2px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-providers{
      display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr));
      gap:10px;align-items:start;
    }
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
    [data-plugin="dsh-tokbook"].dtpl-tok-entry{
      display:inline-flex;align-items:center;gap:5px;
      height:24px;padding:0 8px;margin:0;
      appearance:none;cursor:pointer;
      border:1px solid var(--dtpl-border);background:transparent;
      font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      color:var(--dtpl-fg-2);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"].dtpl-tok-entry:hover{
      color:var(--dtpl-fg);border-color:var(--dtpl-fg-3);background:var(--dtpl-wash-hover);
    }
    [data-plugin="dsh-tokbook"].dtpl-tok-entry:focus-visible{outline:2px solid var(--dtpl-focus);outline-offset:1px;}
    [data-plugin="dsh-tokbook"].dtpl-tok-entry[aria-expanded="true"]{
      color:var(--dtpl-fg);border-color:var(--dtpl-fg-3);background:var(--dtpl-wash-on);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-entry-ico{width:13px;height:13px;flex:none;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-entry-label{display:block;}
    
    
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark{flex:none;width:9px;height:10px;box-shadow:none;}
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="wait"]{
      background:
        repeating-linear-gradient(90deg,
          color-mix(in srgb,var(--dtpl-fg) 66%,transparent) 0 1.5px,
          transparent 1.5px 4px),
        color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="generate"]{background:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="tool"]{
      background:
        repeating-linear-gradient(45deg,
          color-mix(in srgb,var(--dtpl-fg) 88%,transparent) 0 1.5px,
          transparent 1.5px 6px),
        color-mix(in srgb,var(--dtpl-fg) 72%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="model"]{
      background:
        repeating-linear-gradient(90deg,var(--dtpl-fg) 0 1.5px,transparent 1.5px 5px),
        repeating-linear-gradient(45deg,var(--dtpl-fg) 0 1.5px,transparent 1.5px 5px),
        color-mix(in srgb,var(--dtpl-fg) 55%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="input"]{
      background:
        repeating-linear-gradient(90deg,
          color-mix(in srgb,var(--dtpl-fg) 66%,transparent) 0 1.5px,
          transparent 1.5px 4px),
        color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="cache-read"]{
      background:
        repeating-linear-gradient(0deg,
          color-mix(in srgb,var(--dtpl-fg) 88%,transparent) 0 1.5px,
          transparent 1.5px 6px),
        color-mix(in srgb,var(--dtpl-fg) 72%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="cache-write"]{
      background:
        repeating-linear-gradient(45deg,
          color-mix(in srgb,var(--dtpl-fg) 88%,transparent) 0 1.5px,
          transparent 1.5px 6px),
        color-mix(in srgb,var(--dtpl-fg) 72%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="output"]{background:var(--dtpl-fg);}
    `;
    
    // src/client/styles/overlay.ts
    var CSS_OVERLAY = `
    [data-plugin="dsh-tokbook"].dtpl-ov-group{display:inline-flex;align-items:center;gap:8px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-ov-root{display:inline-flex;align-items:center;min-width:0;}
    
    [data-plugin="dsh-tokbook"] .dtpl-ov-panel{
      position:fixed;inset:auto;z-index:200;margin:0;
      display:flex;flex-direction:column;
      width:min(360px,calc(100vw - 24px));
      max-height:min(60vh,520px);
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-surface);
      box-shadow:var(--dtpl-lift-hover);
      color:var(--dtpl-fg);
      font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
      text-align:left;
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-panel:focus{outline:none;}
    
    [data-plugin="dsh-tokbook"] .dtpl-ov-head{
      display:flex;align-items:baseline;gap:10px;flex:none;
      padding:14px 16px 11px;
      border-bottom:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-title{
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:700;color:var(--dtpl-fg);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-sum{
      margin-left:auto;min-width:0;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
      text-align:right;overflow-wrap:anywhere;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-ov-list{
      display:flex;flex-direction:column;gap:8px;
      flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;
      padding:12px 12px 14px;
      scrollbar-width:thin;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-ov-card{
      display:grid;
      grid-template-columns:108px minmax(0,1fr);
      align-items:center;column-gap:14px;
      border:1px solid var(--dtpl-hairline);
      background:var(--dtpl-card);
      padding:12px;
      min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-body{display:flex;flex-direction:column;gap:9px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-ov-card-head{display:flex;align-items:baseline;gap:8px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-ov-card-k{
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:700;color:var(--dtpl-fg);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-card-meta{
      margin-left:auto;min-width:0;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);white-space:nowrap;
      overflow:hidden;text-overflow:ellipsis;
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-card-route{
      min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-gap{
      margin:0;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-ov-empty{
      margin:0;padding:10px 2px 14px;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-error{
      margin:0;padding:10px 2px 0;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-err);overflow-wrap:anywhere;
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-retry{
      align-self:flex-start;margin-top:10px;height:26px;padding:0 12px;
      appearance:none;cursor:pointer;
      border:1px solid var(--dtpl-border);background:transparent;
      font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-retry:hover{
      color:var(--dtpl-fg);border-color:var(--dtpl-fg-3);background:var(--dtpl-wash-hover);
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-retry:focus-visible{outline:2px solid var(--dtpl-focus);outline-offset:1px;}
    [data-plugin="dsh-tokbook"] .dtpl-ov-sk{
      height:132px;
      background:linear-gradient(90deg,
        color-mix(in srgb,var(--dtpl-fg) 4%,transparent) 0%,
        color-mix(in srgb,var(--dtpl-fg) 9%,transparent) 50%,
        color-mix(in srgb,var(--dtpl-fg) 4%,transparent) 100%);
      background-size:200% 100%;
      animation:dtpl-shimmer 1400ms linear infinite;
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-ov-foot{
      display:flex;align-items:center;gap:10px;flex:none;
      padding:10px 14px 12px;
      border-top:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-ov-note{
      min-width:0;
      font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
    }
    @media (prefers-reduced-motion:reduce){
      [data-plugin="dsh-tokbook"] .dtpl-ov-sk{animation:none;}
    }
    @media (max-width:380px){
      [data-plugin="dsh-tokbook"] .dtpl-ov-card{grid-template-columns:92px minmax(0,1fr);column-gap:12px;padding:10px;}
      [data-plugin="dsh-tokbook"] .dtpl-ov-card-k{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);}
    }
    `;
    
    // src/client/styles/dial.ts
    var CSS_DIAL = `
    [data-plugin="dsh-tokbook"] .dtpl-dial{
      position:relative;display:block;flex:none;
      width:108px;height:108px;
      color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-dial-ring{display:block;width:100%;height:100%;}
    [data-plugin="dsh-tokbook"] .dtpl-dial-ring-track{
      fill:none;
      stroke:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-dial-ring-seg{fill:none;}
    [data-plugin="dsh-tokbook"] .dtpl-dial-val{
      position:absolute;inset:0;
      display:flex;align-items:center;justify-content:center;
    }
    [data-plugin="dsh-tokbook"] .dtpl-dial-figure{
      display:inline-flex;align-items:baseline;gap:1px;
      font-family:var(--dtpl-mono);font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-dial-figure b{
      font-size:var(--dtpl-fs-figure);line-height:1;font-weight:700;letter-spacing:-.03em;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-dial-figure span{
      font-size:var(--dtpl-fs-label);line-height:1;font-weight:600;color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-dial-note{
      font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);white-space:nowrap;
    }
    @media (max-width:380px){
      [data-plugin="dsh-tokbook"] .dtpl-dial{width:92px;height:92px;}
      [data-plugin="dsh-tokbook"] .dtpl-dial-figure b{font-size:var(--dtpl-fs-lead);}
    }
    `;
    
    // src/client/styles/timing.ts
    var CSS_TIMING = `
    [data-plugin="dsh-tokbook"] .dtpl-dur-phases{display:flex;flex-direction:column;gap:2px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-dur-phase{
      display:grid;grid-template-columns:9px minmax(0,1fr) auto 34px;
      align-items:center;column-gap:8px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-dur-phase-name{
      min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-dur-phase-value{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      font-weight:700;font-variant-numeric:tabular-nums;color:var(--dtpl-fg);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-dur-phase-share{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      font-variant-numeric:tabular-nums;color:var(--dtpl-fg-2);text-align:right;white-space:nowrap;
    }
    @media (max-width:340px){
      [data-plugin="dsh-tokbook"] .dtpl-dur-phase{grid-template-columns:9px minmax(0,1fr) auto;}
      [data-plugin="dsh-tokbook"] .dtpl-dur-phase-share{display:none;}
    }
    `;
    
    // src/client/styles/token-overlay.ts
    var CSS_TOKEN_OVERLAY = `
    [data-plugin="dsh-tokbook"] .dtpl-ttk-sk{height:150px;}
    [data-plugin="dsh-tokbook"] .dtpl-ttk-buckets{display:flex;flex-direction:column;gap:2px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-ttk-bucket{
      display:grid;grid-template-columns:9px minmax(0,1fr) auto 34px;
      align-items:center;column-gap:8px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-ttk-bucket-name{
      min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-ttk-bucket-value{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      font-weight:700;font-variant-numeric:tabular-nums;color:var(--dtpl-fg);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-ttk-bucket-share{
      font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      font-variant-numeric:tabular-nums;color:var(--dtpl-fg-2);text-align:right;white-space:nowrap;
    }
    @media (max-width:380px){
      [data-plugin="dsh-tokbook"] .dtpl-ttk-sk{height:142px;}
    }
    @media (max-width:340px){
      [data-plugin="dsh-tokbook"] .dtpl-ttk-bucket{grid-template-columns:9px minmax(0,1fr) auto;}
      [data-plugin="dsh-tokbook"] .dtpl-ttk-bucket-share{display:none;}
    }
    `;
    
    // src/client/styles/quota.ts
    var CSS_QUOTA = `
    [data-plugin="dsh-tokbook"] .dtpl-quota-panel{padding:0;overflow:hidden;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-strip{
      display:flex;align-items:center;justify-content:space-between;gap:4px 16px;flex-wrap:wrap;
      padding:10px 14px 8px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-strip-id{
      display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-strip-t{
      display:flex;align-items:center;gap:8px;min-width:0;margin:0;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;letter-spacing:.14em;
      color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-strip-t::before{
      content:"";flex:none;width:6px;height:6px;background:var(--dtpl-brand);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-strip-note{
      margin:0;
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));
      gap:8px;align-content:start;
      padding:0 14px 14px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh{
      display:flex;align-items:center;gap:8px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-label{
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-seg{
      display:flex;align-items:center;
      border-bottom:1px solid var(--dtpl-border);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt{
      position:relative;appearance:none;border:0;background:transparent;
      height:22px;padding:0 8px;
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
    
    [data-plugin="dsh-tokbook"] .dtpl-quota-card{
      padding:11px 13px 10px;
      border:1px solid var(--dtpl-border);
      background:var(--dtpl-surface);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-head{
      display:flex;align-items:center;justify-content:space-between;gap:10px;
      margin-bottom:8px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-id{
      display:flex;align-items:center;gap:9px;min-width:0;
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
      display:flex;align-items:center;gap:6px;flex:none;
      min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-refresh{
      display:inline-flex;align-items:center;justify-content:center;
      width:24px;height:24px;padding:0;
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
    [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-ico{width:14px;height:14px;display:block;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-gauge{
      position:relative;flex:none;width:40px;height:40px;
      color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-svg{width:40px;height:40px;display:block;}
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
      align-items:center;justify-content:center;gap:1px;
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
      padding:9px 11px;margin:2px 0 4px;
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
    [data-plugin="dsh-tokbook"] .dtpl-quota-windows{display:flex;flex-direction:column;gap:9px;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-window{display:flex;flex-direction:column;gap:4px;}
    [data-plugin="dsh-tokbook"] .dtpl-quota-window-line1{
      display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:baseline;gap:10px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-window-label{
      color:var(--dtpl-fg);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-window-metric{
      justify-self:end;
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;
      font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-quota-bar{
      display:block;width:100%;height:6px;
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
    [data-plugin="dsh-tokbook"] .dtpl-quota-reset{
      font-family:var(--dtpl-mono);
      color:var(--dtpl-fg-2);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
      font-variant-numeric:tabular-nums;white-space:nowrap;justify-self:end;
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
    [data-plugin="dsh-tokbook"] .dtpl-quota-sk-body{
      display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:10px;
      padding:0 16px 16px;
    }
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
    
    [data-plugin="dsh-tokbook"] .dtpl-price-cal{
      display:flex;flex-direction:column;
      min-width:0;padding:0;
      background:var(--dtpl-paper-bg);color:var(--dtpl-fg);
      box-shadow:0 0 0 1px var(--dtpl-hairline);
      container-type:inline-size;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar{display:flex;align-items:center;gap:12px;min-width:0;padding:13px 18px;flex-wrap:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-mark{flex:none;width:3px;height:22px;border-radius:var(--dtpl-radius);background:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-mark[data-kind="holiday"]{background:var(--dtpl-holiday);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-mark[data-kind="weekend"]{background:var(--dtpl-fg-3);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-date{flex:none;font-size:12px;line-height:1.3;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-sep{flex:none;width:1px;height:13px;background:var(--dtpl-border);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-type{flex:none;font-family:var(--dtpl-serif);font-size:14px;line-height:1.2;font-weight:700;color:var(--dtpl-fg);white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-price{flex:none;font-size:11.5px;line-height:1;letter-spacing:.02em;padding:3px 7px;border-radius:var(--dtpl-radius);border:1px solid var(--dtpl-border);color:var(--dtpl-fg-2);white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-price[data-tone="peak"]{color:var(--dtpl-warn-ink);border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-note{flex:0 1 auto;min-width:0;font-size:11.5px;line-height:1.3;color:var(--dtpl-warn-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-spacer{flex:1 1 auto;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-next{flex:none;font-size:11.5px;line-height:1.3;color:var(--dtpl-fg-3);font-variant-numeric:tabular-nums;white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-toggle{flex:none;appearance:none;border:0;background:transparent;color:var(--dtpl-fg-2);font:inherit;font-size:12px;line-height:1.3;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;padding:2px 0;transition:color var(--dtpl-dur-quick) var(--dtpl-ease-tint);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-toggle:hover{color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-toggle:focus-visible{outline:none;box-shadow:inset 0 -2px 0 var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbar-chev{font-size:9px;line-height:1;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calbody{padding:4px 34px 36px;border-top:1px solid var(--dtpl-hairline);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calmast{
      display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap;
      border-bottom:2px solid var(--dtpl-fg);padding-bottom:13px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calmast-main{display:flex;flex-direction:column;gap:8px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calkicker{
      font-size:11px;line-height:1.2;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-caltitle{
      font-family:var(--dtpl-serif);font-size:30px;line-height:1.02;font-weight:700;letter-spacing:.02em;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calfacts{display:inline-flex;align-items:flex-end;gap:22px;flex-wrap:wrap;padding-bottom:3px;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calfact{display:flex;flex-direction:column;gap:3px;text-align:right;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calfact-k{font-size:11px;line-height:1.2;letter-spacing:.08em;color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calfact-v{font-family:var(--dtpl-serif);font-size:15px;line-height:1.2;font-weight:600;color:var(--dtpl-fg);font-variant-numeric:tabular-nums;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calfact[data-tone="warn"] .dtpl-price-calfact-k,
    [data-plugin="dsh-tokbook"] .dtpl-price-calfact[data-tone="warn"] .dtpl-price-calfact-v{color:var(--dtpl-warn-ink);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calauto{
      margin:14px 0 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;
      font-size:12.5px;line-height:1.4;color:var(--dtpl-fg-2);overflow-wrap:anywhere;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calauto i{
      flex:none;width:6px;height:6px;border-radius:50%;background:var(--dtpl-ok);
      box-shadow:0 0 0 3px color-mix(in srgb,var(--dtpl-ok) 16%,transparent);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calauto[data-tone="warn"]{color:var(--dtpl-warn-ink);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calauto[data-tone="warn"] i{background:var(--dtpl-warn);box-shadow:0 0 0 3px color-mix(in srgb,var(--dtpl-warn) 18%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calauto[data-tone="err"]{color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calauto[data-tone="err"] i{background:var(--dtpl-err);box-shadow:0 0 0 3px color-mix(in srgb,var(--dtpl-err) 18%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calpurpose{
      margin:13px 0 0;font-family:var(--dtpl-serif);font-size:15px;line-height:1.66;color:var(--dtpl-fg);max-width:62ch;overflow-wrap:anywhere;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calyears{display:flex;flex-direction:column;margin-top:30px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calyear{display:grid;grid-template-columns:216px minmax(0,1fr);gap:36px;align-items:start;min-width:0;padding-top:4px;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calyear + .dtpl-price-calyear{margin-top:34px;padding-top:32px;border-top:1px solid var(--dtpl-hairline);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calspine{display:flex;flex-direction:column;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calyearnum{
      font-family:var(--dtpl-serif);font-size:60px;line-height:.86;font-weight:700;letter-spacing:-.01em;color:var(--dtpl-fg);font-variant-numeric:tabular-nums;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calyearsum{margin-top:10px;font-size:13px;line-height:1.4;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calyearsum b{color:var(--dtpl-fg);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calchip{
      align-self:flex-start;margin-top:9px;font-size:10.5px;line-height:1.5;letter-spacing:.05em;color:var(--dtpl-ok);
      border:1px solid color-mix(in srgb,var(--dtpl-ok) 45%,transparent);padding:1px 7px;border-radius:var(--dtpl-radius);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calspans{list-style:none;margin:18px 0 0;padding:0;border-top:1px solid var(--dtpl-border);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calspan{display:grid;grid-template-columns:1fr auto;column-gap:10px;row-gap:1px;padding:8px 0 7px;border-bottom:1px solid var(--dtpl-hairline);min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calspan-name{font-family:var(--dtpl-serif);font-size:14.5px;line-height:1.3;font-weight:600;color:var(--dtpl-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calspan-days{text-align:right;font-size:12px;line-height:1.3;font-weight:600;color:var(--dtpl-holiday);font-variant-numeric:tabular-nums;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calspan-range{grid-column:1 / -1;font-size:11px;line-height:1.3;letter-spacing:.02em;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;}
    [data-plugin="dsh-tokbook"] .dtpl-price-callegend{margin-top:15px;display:flex;gap:15px;flex-wrap:wrap;font-size:11.5px;line-height:1.4;color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-callegend-item{display:inline-flex;align-items:center;gap:5px;}
    [data-plugin="dsh-tokbook"] .dtpl-price-callegend-item i{flex:none;width:9px;height:9px;border-radius:50%;display:inline-block;}
    [data-plugin="dsh-tokbook"] .dtpl-price-callegend-item[data-kind="holiday"] i{background:var(--dtpl-holiday);}
    [data-plugin="dsh-tokbook"] .dtpl-price-callegend-item[data-kind="weekend"] i{background:var(--dtpl-fg-3);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calmons{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px 22px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calmon{display:flex;flex-direction:column;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calmon-head{display:flex;align-items:baseline;gap:6px;border-bottom:1px solid var(--dtpl-border);padding-bottom:6px;margin-bottom:7px;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calmon-cn{font-family:var(--dtpl-serif);font-size:15px;line-height:1.2;font-weight:700;color:var(--dtpl-fg);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calmon-en{margin-left:auto;font-size:9px;line-height:1.2;letter-spacing:.18em;color:var(--dtpl-fg-3);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calmon-week,
    [data-plugin="dsh-tokbook"] .dtpl-price-calmon-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));}
    [data-plugin="dsh-tokbook"] .dtpl-price-calmon-week span{text-align:center;font-size:9px;line-height:1.4;color:var(--dtpl-fg-3);padding-bottom:4px;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calmon-week span[data-weekend]{color:var(--dtpl-holiday);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calmon-days{row-gap:2px;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calday{
      position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center;min-width:0;
      font-size:11.5px;line-height:1;font-variant-numeric:tabular-nums;color:var(--dtpl-fg);border-radius:50%;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calday-num{position:relative;z-index:1;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calday.is-blank{visibility:hidden;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calday[data-weekend]{color:var(--dtpl-fg-3);}
    [data-plugin="dsh-tokbook"] .dtpl-price-calday[data-holiday]{color:var(--dtpl-card);font-weight:600;}
    [data-plugin="dsh-tokbook"] .dtpl-price-calday[data-holiday]::before{
      content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:0;
      width:min(26px,calc(100% - 2px));height:min(26px,calc(100% - 2px));border-radius:50%;background:var(--dtpl-holiday);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calday[data-today]::after{
      content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:0;
      width:min(28px,calc(100% - 1px));height:min(28px,calc(100% - 1px));border-radius:50%;border:1.5px solid var(--dtpl-ok);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-calday[data-holiday][data-today]::after{border-color:var(--dtpl-card);}
    @container (max-width:1000px){
      [data-plugin="dsh-tokbook"] .dtpl-price-calmons{grid-template-columns:repeat(3,minmax(0,1fr));}
    }
    @container (max-width:900px){
      [data-plugin="dsh-tokbook"] .dtpl-price-calyear{grid-template-columns:minmax(0,1fr);gap:24px;}
      [data-plugin="dsh-tokbook"] .dtpl-price-calyearnum{font-size:52px;}
    }
    @container (max-width:620px){
      [data-plugin="dsh-tokbook"] .dtpl-price-calbar{padding:12px 14px;gap:10px;row-gap:6px;flex-wrap:wrap;}
      [data-plugin="dsh-tokbook"] .dtpl-price-calbar-spacer{display:none;}
      [data-plugin="dsh-tokbook"] .dtpl-price-calbar-toggle{margin-left:auto;}
      [data-plugin="dsh-tokbook"] .dtpl-price-calbar-note{flex-basis:100%;}
      [data-plugin="dsh-tokbook"] .dtpl-price-calbody{padding:4px 18px 26px;}
      [data-plugin="dsh-tokbook"] .dtpl-price-calmast{flex-direction:column;align-items:flex-start;gap:14px;}
      [data-plugin="dsh-tokbook"] .dtpl-price-calfacts{align-items:flex-start;}
      [data-plugin="dsh-tokbook"] .dtpl-price-calmons{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 16px;}
      [data-plugin="dsh-tokbook"] .dtpl-price-caltitle{font-size:25px;}
      [data-plugin="dsh-tokbook"] .dtpl-price-calyearnum{font-size:46px;}
    }
    
    [data-plugin="dsh-tokbook"] .dtpl-price-controls{
      padding-block:10px 12px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-controls .dtpl-price-pick{
      border-bottom:0;padding-bottom:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-pick{
      max-width:none;
      display:grid;grid-template-columns:1.3fr 1.3fr 1.2fr 1fr;
      column-gap:16px;row-gap:8px;align-items:end;
      border-bottom:1px solid var(--dtpl-border);padding-bottom:10px;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-pick-row{
      display:flex;flex-direction:column;gap:3px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-pick-k{font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-pick .dtpl-price-pick-sel{
      width:100%;height:36px;font-size:var(--dtpl-fs-lead);font-weight:500;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-board > *{align-self:start;}
    [data-plugin="dsh-tokbook"] .dtpl-price-board{row-gap:12px;}
    @container (max-width:1050px){
      [data-plugin="dsh-tokbook"] .dtpl-price-pick{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;}
    }
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
      display:flex;flex-direction:column;gap:18px;
      min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-detail[data-dirty="true"]{
      box-shadow:inset 2px 0 0 var(--dtpl-fg),var(--dtpl-metal);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-console{
      display:grid;grid-template-columns:minmax(0,1fr) minmax(0,280px);
      gap:20px;align-items:start;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-console-live{
      display:flex;flex-direction:column;gap:12px;min-width:0;
      padding:16px;
      background:color-mix(in srgb,var(--dtpl-brand) 8%,var(--dtpl-card));
      box-shadow:inset 0 4px 0 var(--dtpl-brand);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-console-edit{min-width:0;overflow-x:auto;padding-top:2px;}
    [data-plugin="dsh-tokbook"] .dtpl-price-console-edit .dtpl-price-cols,
    [data-plugin="dsh-tokbook"] .dtpl-price-console-edit .dtpl-price-row{
      grid-template-columns:minmax(180px,320px) repeat(4,minmax(80px,1fr));
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-console-live .dtpl-price-day-row{
      grid-template-columns:minmax(0,80px) minmax(0,1fr);column-gap:8px;
    }
    @container (max-width:1180px){
      [data-plugin="dsh-tokbook"] .dtpl-price-console{grid-template-columns:minmax(0,1fr);gap:16px;}
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-stage{padding-block:18px 20px;}
    
    [data-plugin="dsh-tokbook"] .dtpl-price-live{
      display:flex;flex-direction:column;gap:10px;min-width:0;
      padding:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-head{
      display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-k{
      display:inline-flex;align-items:center;gap:8px;
      font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-k::before{
      content:"";flex:none;width:7px;height:13px;
      background:var(--dtpl-brand);
      box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-unit{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-live-cells{
      display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px 18px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-cell{display:flex;flex-direction:column;gap:1px;min-width:0;}
    [data-plugin="dsh-tokbook"] .dtpl-price-live-label{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-live-v{
      font-family:var(--dtpl-mono);font-size:clamp(22px,2vw,30px);line-height:1.08;font-weight:600;color:var(--dtpl-fg);
      font-variant-numeric:tabular-nums;letter-spacing:-.03em;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-cell[data-bad="true"] .dtpl-price-live-v{color:var(--dtpl-err);}
    [data-plugin="dsh-tokbook"] .dtpl-price-live-none{
      margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-note{
      margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-status{
      margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg);font-weight:500;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-live-hint{
      margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-detail-head{
      display:flex;flex-direction:column;align-items:stretch;gap:6px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-detail-main{
      display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-detail-main .dtpl-price-detail-id{flex:0 1 auto;}
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
    
    [data-plugin="dsh-tokbook"] .dtpl-price-board{
      display:contents;
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
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl{
      display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;
      padding-top:10px;min-width:0;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-k{
      flex:none;font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-chips{
      display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;flex:1 1 auto;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-empty{
      font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-chip{
      display:inline-flex;align-items:center;max-width:220px;overflow:hidden;
      border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
      border-radius:var(--dtpl-radius);
      transition:border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint),background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-chip:hover{
      border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
      background:var(--dtpl-wash-hover);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-apply{
      appearance:none;border:0;background:transparent;
      display:inline-flex;align-items:center;gap:5px;min-width:0;
      height:26px;padding:0 8px;
      color:var(--dtpl-fg);font:inherit;font-size:var(--dtpl-fs-label);cursor:pointer;
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-mark{flex:none;font-family:var(--dtpl-mono);color:var(--dtpl-fg-2);}
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-del{
      appearance:none;border:0;border-left:1px solid color-mix(in srgb,var(--dtpl-fg) 16%,transparent);
      background:transparent;width:22px;height:26px;
      color:var(--dtpl-fg-2);font:inherit;font-size:var(--dtpl-fs-lead);line-height:1;cursor:pointer;
      transition:color var(--dtpl-dur-quick) var(--dtpl-ease-tint),background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
    }
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-del:hover{color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);}
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-save{display:inline-flex;align-items:center;gap:6px;flex:none;}
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-input{width:150px;height:26px;text-align:left;}
    [data-plugin="dsh-tokbook"] .dtpl-price-tpl-err{
      flex:1 1 100%;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-err);
    }
    
    @media (prefers-reduced-motion:no-preference){
      [data-plugin="dsh-tokbook"] .dtpl-price-console-live{animation:dtpl-price-wipe 720ms var(--dtpl-ease-move) both;}
      [data-plugin="dsh-tokbook"] .dtpl-price-live-v{animation:dtpl-price-settle 640ms var(--dtpl-ease-move) both;}
      [data-plugin="dsh-tokbook"] .dtpl-price-live-v:nth-child(1){animation-delay:80ms;}
      [data-plugin="dsh-tokbook"] .dtpl-price-live-v:nth-child(2){animation-delay:130ms;}
      [data-plugin="dsh-tokbook"] .dtpl-price-live-v:nth-child(3){animation-delay:180ms;}
      [data-plugin="dsh-tokbook"] .dtpl-price-live-v:nth-child(4){animation-delay:230ms;}
      [data-plugin="dsh-tokbook"] .dtpl-price-day-cell[data-on="slot"]{animation:dtpl-price-light 520ms var(--dtpl-ease-move) both;}
    }
    @keyframes dtpl-price-wipe{from{clip-path:inset(0 100% 0 0);}}
    @keyframes dtpl-price-settle{from{opacity:0;transform:translateY(10px);}}
    @keyframes dtpl-price-light{from{opacity:.2;}}
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
      [data-plugin="dsh-tokbook"] .dtpl-head{padding:18px 16px 10px;}
      [data-plugin="dsh-tokbook"] .dtpl-tabs{padding:0 16px;}
      [data-plugin="dsh-tokbook"] .dtpl-tab{padding:0 12px;}
      [data-plugin="dsh-tokbook"] .dtpl-body{padding:14px 16px 20px;}
      [data-plugin="dsh-tokbook"] .dtpl-foot{padding:10px 16px 12px;}
      [data-plugin="dsh-tokbook"] .dtpl-chart{overflow-x:auto;scrollbar-width:thin;}
      [data-plugin="dsh-tokbook"] .dtpl-chart-svg{min-width:640px;}
      [data-plugin="dsh-tokbook"] .dtpl-hero-facts{flex:1 1 auto;gap:4px 10px;}
      [data-plugin="dsh-tokbook"] .dtpl-hero-facts i{display:none;}
      [data-plugin="dsh-tokbook"] .dtpl-bd-cols{display:none;}
      [data-plugin="dsh-tokbook"] .dtpl-bd-cols,
      [data-plugin="dsh-tokbook"] .dtpl-row{grid-template-columns:minmax(0,1fr);}
      [data-plugin="dsh-tokbook"] .dtpl-models > .dtpl-row{grid-template-columns:minmax(0,1fr);}
      [data-plugin="dsh-tokbook"] .dtpl-row-share{display:none;}
      [data-plugin="dsh-tokbook"] .dtpl-model-nums{
        flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:12px;
        margin-top:5px;
      }
      [data-plugin="dsh-tokbook"] .dtpl-val{margin-right:auto;}
      [data-plugin="dsh-tokbook"] .dtpl-bd-tab{
        min-height:44px;padding:13px 16px;
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
    }
    
    @media (prefers-reduced-motion:no-preference){
      [data-plugin="dsh-tokbook"] .dtpl-body > *{animation:dtpl-rise var(--dtpl-dur-enter) var(--dtpl-ease-move) both;}
      [data-plugin="dsh-tokbook"] .dtpl-grid > *,
      [data-plugin="dsh-tokbook"] .dtpl-price-board > *{animation:dtpl-rise var(--dtpl-dur-enter) var(--dtpl-ease-move) both;animation-delay:.06s;}
      [data-plugin="dsh-tokbook"] .dtpl-share-ring-arc{animation:dtpl-draw var(--dtpl-dur-draw) var(--dtpl-ease-move) both;}
    }
    @keyframes dtpl-rise{from{opacity:0;transform:translateY(6px)}}
    @keyframes dtpl-draw{from{stroke-dashoffset:var(--dtpl-arc,0)}}
    @keyframes dtpl-width-in{from{width:0}}
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
      [data-plugin="dsh-tokbook"] .dtpl-body > *,
      [data-plugin="dsh-tokbook"] .dtpl-grid > *,
      [data-plugin="dsh-tokbook"] .dtpl-price-board > *,
      [data-plugin="dsh-tokbook"] .dtpl-share-ring-arc,
      [data-plugin="dsh-tokbook"] .dtpl-sk,
      [data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot,
      [data-plugin="dsh-tokbook"] .dtpl-spin,
      [data-plugin="dsh-tokbook"] .dtpl-price-add-ghost,
      [data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill,
      [data-plugin="dsh-tokbook"] .dtpl-quota-gauge-fill,
      [data-plugin="dsh-tokbook"] .dtpl-scroll-rail,
      [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{animation:none;transition:none;}
    }
    
    [data-plugin="dsh-tokbook"] button:not(:disabled):active{transform:translateY(1px);}
    `;
    
    // src/client/styles.ts
    var CSS = [
      CSS_TOKENS,
      CSS_PAGE,
      CSS_GRID,
      CSS_LEDGER,
      CSS_METHOD,
      CSS_PROVIDER,
      CSS_SESSION,
      CSS_OVERLAY,
      CSS_DIAL,
      CSS_TIMING,
      CSS_TOKEN_OVERLAY,
      CSS_QUOTA,
      CSS_PRICING,
      CSS_SHARED
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
    
    // src/client/TokBookPanel.tsx
    var import_react8 = require("react");
    
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
            return { kind: "bad", error: `与第 ${String(other + 1)} 段假期重叠：同一年里两段假期不能重叠` };
          }
        }
        return { kind: "ok", days: span.days };
      });
    }
    function writableRanges(year, rows) {
      const reads = readHolidays(year, rows);
      return rows.flatMap((row, index) => reads[index].kind === "ok" ? [{ start: row.start, end: row.end }] : []);
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
    function inheritedCell(price, slot, field, show2 = (cnyText) => cnyText) {
      const wider = slot === null ? "" : price[field].trim();
      if (wider !== "") return { value: show2(wider), note: `留空 = 沿用基准价 ${show2(wider)}` };
      if (field === "input" || field === "output") {
        return slot === null ? {} : { note: "留空 = 沿用基准价（基准价这档也是空的）" };
      }
      const own = slot === null ? "" : slot.input.trim();
      const input = own !== "" ? own : price.input.trim();
      if (input === "") return { note: "留空 = 按输入价计（输入价还没填）" };
      return { value: show2(input), note: `留空 = 按输入价计 ${show2(input)}：这一档没有单独定价` };
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
    var import_react = require("react");
    var import_jsx_runtime = require("react/jsx-runtime");
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
    var WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
    var MONTH_NAMES = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    var MONTH_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    var HOLIDAY_NAMES = {
      2025: ["春节", "国庆"],
      2026: ["元旦", "春节", "清明", "劳动节", "端午", "中秋", "国庆"]
    };
    var WEEKDAY_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    function dayKeyOf2(date) {
      return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    function dayKeyToDate(key) {
      const [year, month, day] = key.split("-").map(Number);
      return new Date(year ?? 2e3, (month ?? 1) - 1, day ?? 1);
    }
    function holidayDaySet(entries) {
      const days = /* @__PURE__ */ new Set();
      for (const year of entries.keys()) {
        for (const span of spansOf(entries, year)) {
          for (const day of holidayDates({ start: span.start, end: span.end })) days.add(day);
        }
      }
      return days;
    }
    function todayStatus(days, now, covered) {
      const weekday = WEEKDAY_CN[now.getDay()] ?? "";
      const dateLabel = `${now.getMonth() + 1}/${now.getDate()}`;
      if (days.has(dayKeyOf2(now))) {
        return { weekday, dateLabel, kind: "holiday", typeLabel: "法定节假日", priceTone: "rest", priceLabel: "闲时", unknown: false };
      }
      if (now.getDay() === 0 || now.getDay() === 6) {
        return { weekday, dateLabel, kind: "weekend", typeLabel: "周末", priceTone: "rest", priceLabel: "闲时", unknown: false };
      }
      return { weekday, dateLabel, kind: "work", typeLabel: "法定工作日", priceTone: "peak", priceLabel: "高峰", unknown: !covered };
    }
    function nextHoliday(entries, now) {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const fromKey = dayKeyOf2(from);
      let best = null;
      for (const year of [...entries.keys()].sort((left, right) => left.localeCompare(right))) {
        const spans = spansOf(entries, year);
        for (let index = 0; index < spans.length; index += 1) {
          const span = spans[index];
          if (span.start <= fromKey) continue;
          if (best === null || span.start < best.start) best = { start: span.start, year, index };
        }
      }
      if (best === null) return null;
      const picked = best;
      const gap = Math.round((dayKeyToDate(picked.start).getTime() - from.getTime()) / 864e5);
      if (gap <= 0) return null;
      const label = HOLIDAY_NAMES[picked.year]?.[picked.index] ?? "假期";
      return { label, gap };
    }
    function monthDays(year, month, holidays, today) {
      const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
      const total = new Date(year, month, 0).getDate();
      const cells = [];
      for (let index = 0; index < offset; index += 1) {
        cells.push({ key: `b-${month}-${index}`, day: 0, weekend: false, holiday: false, today: false, blank: true });
      }
      for (let day = 1; day <= total; day += 1) {
        const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const weekday = (new Date(year, month - 1, day).getDay() + 6) % 7;
        cells.push({ key, day, weekend: weekday >= 5, holiday: holidays.has(key), today: key === today, blank: false });
      }
      return cells;
    }
    function shortDate(key) {
      return key.slice(5).replace("-", "/");
    }
    function HolidayCalendar({ year, holidays }) {
      const yearNum = Number(year);
      const months = Array.from({ length: 12 }, (_, index) => index + 1);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dtpl-price-calmons", role: "group", "aria-label": `${year} 年节假日日历（只读）`, children: months.map((month) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-calmon", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-calmon-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calmon-cn", children: MONTH_NAMES[month - 1] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calmon-en", "aria-hidden": "true", children: MONTH_EN[month - 1] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dtpl-price-calmon-week", "aria-hidden": "true", children: WEEK_LABELS.map((label, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "data-weekend": index >= 5 || void 0, children: label }, label)) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dtpl-price-calmon-days", children: monthDays(yearNum, month, holidays, "").map((cell) => cell.blank ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calday is-blank", "aria-hidden": "true" }, cell.key) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            className: "dtpl-price-calday",
            "data-holiday": cell.holiday || void 0,
            "data-weekend": !cell.holiday && cell.weekend || void 0,
            "data-today": cell.today || void 0,
            title: `${cell.key}${cell.holiday ? " 法定节假日" : cell.weekend ? " 周末" : ""}`,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calday-num", children: cell.day })
          },
          cell.key
        )) })
      ] }, month)) });
    }
    function CalendarEditor({ entries, missingYears, autoYears, sync, syncing, className }) {
      const [expanded, setExpanded] = (0, import_react.useState)(false);
      const now = /* @__PURE__ */ new Date();
      const nowYear = String(now.getFullYear());
      const years = entries.size > 0 ? [...entries.keys()].sort((left, right) => right.localeCompare(left)) : [nowYear];
      const kept = years.filter((year) => (entries.get(year)?.holidays.length ?? 0) > 0);
      const gaps = missingYears.filter((year) => !entries.has(year));
      const totalDays = kept.reduce((sum, year) => sum + spansOf(entries, year).reduce((acc, span) => acc + span.days, 0), 0);
      const autoLine = describeAutoSync(sync, syncing === true);
      const status = todayStatus(holidayDaySet(entries), now, gaps.length === 0);
      const next = nextHoliday(entries, now);
      const panelId = "price-calendar-body";
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: `dtpl-price-cal ${className ?? ""}`, id: "price-calendar", "data-expanded": expanded || void 0, "aria-label": "法定节假日年历", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-calbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calbar-mark", "data-kind": status.kind, "aria-hidden": "true" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-calbar-date", children: [
            "今天 · ",
            status.weekday,
            " ",
            status.dateLabel
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calbar-sep", "aria-hidden": "true" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calbar-type", "data-kind": status.kind, children: status.typeLabel }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calbar-price", "data-tone": status.priceTone, children: status.priceLabel }),
          status.unknown && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-calbar-note", children: [
            nowYear,
            " 年放假安排未收录，暂按工作日高峰价"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calbar-spacer", "aria-hidden": "true" }),
          next !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-calbar-next", children: [
            next.label,
            " · ",
            String(next.gap),
            " 天后"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "button",
            {
              type: "button",
              className: "dtpl-price-calbar-toggle",
              "aria-expanded": expanded,
              "aria-controls": panelId,
              onClick: () => setExpanded((value) => !value),
              children: [
                expanded ? "收起" : "展开年历",
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calbar-chev", "aria-hidden": "true", children: expanded ? "▴" : "▾" })
              ]
            }
          )
        ] }),
        expanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-calbody", id: panelId, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "dtpl-price-calmast", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-calmast-main", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calkicker", children: "法定节假日年历" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-caltitle", children: "节假日年鉴" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-calfacts", children: [
              kept.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-calfact", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calfact-k", children: "已收录" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calfact-v", children: kept.join(" · ") })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calfact", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calfact-v", children: "未收录" }) }),
              kept.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-calfact", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calfact-k", children: "合计" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-calfact-v", children: [
                  String(totalDays),
                  " 天"
                ] })
              ] }),
              gaps.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-calfact", "data-tone": "warn", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calfact-k", children: "待补" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calfact-v", children: gaps.join("、") })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "dtpl-price-calauto", "data-tone": autoLine?.tone ?? "ok", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { "aria-hidden": "true" }),
            autoLine !== null ? autoLine.text : "放假安排由 holiday-cn 自动同步，也可写进 pricing.json；此处只读。"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dtpl-price-calpurpose", children: "决定「法定工作日」时段在哪几天生效——缺了哪一年，那一年的假期会被当成工作日，按高峰价多算。只记放假日：调休上班日多落在周末，周末本来按闲时算。" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dtpl-price-calyears", children: years.map((year) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            CalendarYearView,
            {
              year,
              auto: autoYears?.includes(year) ?? false,
              spans: spansOf(entries, year)
            },
            year
          )) })
        ] })
      ] });
    }
    function spansOf(entries, year) {
      const entry = entries.get(year);
      if (entry === void 0) return [];
      return readHolidays(year, entry.holidays).flatMap((read, index) => {
        const row = entry.holidays[index];
        return read.kind === "ok" && row !== void 0 ? [{ start: row.start, end: row.end, days: read.days }] : [];
      });
    }
    function CalendarYearView({ year, auto, spans }) {
      const marked = /* @__PURE__ */ new Set();
      for (const span of spans) for (const day of holidayDates({ start: span.start, end: span.end })) marked.add(day);
      const totalDays = spans.reduce((sum, span) => sum + span.days, 0);
      const names = HOLIDAY_NAMES[year] ?? [];
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-calyear", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-calspine", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calyearnum", children: year }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calyearsum", children: spans.length === 0 ? "尚未收录" : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: String(spans.length) }),
            " 段假期 · 共 ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: String(totalDays) }),
            " 天"
          ] }) }),
          auto && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calchip", title: "从 holiday-cn 自动拉取并缓存；这一年的放假安排来自上游。", children: "holiday-cn 同步" }),
          spans.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", { className: "dtpl-price-calspans", "aria-label": `${year} 年假期清单`, children: spans.map((span, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "dtpl-price-calspan", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-calspan-name", children: names[index] ?? `假期 ${String(index + 1)}` }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-calspan-days", children: [
              String(span.days),
              " 天"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-calspan-range", children: [
              shortDate(span.start),
              " — ",
              shortDate(span.end)
            ] })
          ] }, `${span.start}-${String(index)}`)) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-callegend", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-callegend-item", "data-kind": "holiday", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { "aria-hidden": "true" }),
              "法定节假日"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-callegend-item", "data-kind": "weekend", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { "aria-hidden": "true" }),
              "周末"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HolidayCalendar, { year, holidays: marked })
      ] });
    }
    function describeAutoSync(sync, running) {
      if (sync === void 0) return null;
      if (running) return { text: "正在拉取节假日安排…", tone: "ok" };
      if (sync.state === "failed") {
        return {
          text: `上次没拉到${sync.lastError === null ? "" : `（${sync.lastError}）`}，现在用的还是上一次的数据；缺的年份可以写进 pricing.json，或等下次拉取补上。`,
          tone: "err"
        };
      }
      if (sync.state === "missing") {
        return {
          text: sync.uncovered.length > 0 ? `${sync.uncovered.join("、")} 年还没有节假日数据（上游可能还没公布）；可以先写进 pricing.json，或等拉取成功后自动补上。` : "还没有节假日数据；可以先写进 pricing.json，或等拉取成功后自动补上。",
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
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-cell", "data-state": state, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dtpl-price-cell-k", htmlFor: id, children: label }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
        note !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { id: noteId, className: "dtpl-sr", children: note }),
        message !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { id: errorId, className: "dtpl-price-cell-err", role: "alert", children: message })
      ] });
    }
    function LiveRates({ live, records, view, hasSlots }) {
      const shown = (field) => {
        if (live === null) return "";
        const own = live.values[field].trim();
        if (own !== "") return own;
        if (field === "cacheRead" || field === "cacheWrite") return live.values.input.trim();
        return "";
      };
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-live", role: "group", "aria-label": "此刻计费的价", "data-ui": true, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-live-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-live-k", children: "此刻计费" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-live-unit", children: unitOf(view) })
        ] }),
        live === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dtpl-price-live-none", children: records > 0 ? "还没有价：这些记录按 ¥0 计（价格未知）" : "还没有价：它还没有被调用过" }) : live.slot !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dtpl-price-live-cells", children: CELLS.map(({ field, label }) => {
            const text = shown(field);
            const bad = fieldState(live.values, field) === "bad";
            return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-live-cell", "data-bad": bad || void 0, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-live-label", children: label }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-live-v", children: text === "" ? "—" : text })
            ] }, field);
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "dtpl-price-live-note", children: [
            "正在按峰谷时段「",
            dayLabel(live.slot),
            "」计"
          ] })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dtpl-price-live-status", children: "此刻按基准价计" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dtpl-price-live-hint", children: hasSlots ? "现在不在任何峰谷时段内；时段生效时，这里报实际计费的四档价。" : "全周 · 全天；加峰谷时段后，时段内的实际价会显示在这里。" })
        ] })
      ] });
    }
    function DayBand({ price }) {
      const slots = effectiveSlots(price).map((slot) => {
        const { start, end } = slotRange(slot);
        const ok = isHourRange({ start, end });
        return { id: slot.id, label: DAY_SET_LABELS[slot.days], start: ok ? start : 0, end: ok ? end : 0 };
      });
      const drawn = slots.filter((row) => row.end > row.start);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          className: "dtpl-price-day",
          role: "img",
          "aria-label": `24 小时生效范围：基准价铺满全天${drawn.length === 0 ? "" : `；${drawn.map((row) => `${row.label} 覆盖 ${String(row.start)}–${String(row.end)} 点`).join("；")}`}`,
          "data-ui": true,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-day-row", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-day-k", children: "基准价" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-day-cells", "aria-hidden": "true", children: HOURS.map((hour) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-day-cell", "data-on": "base" }, hour)) })
            ] }),
            drawn.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-day-row", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-day-k", children: row.label }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-day-cells", "aria-hidden": "true", children: HOURS.map((hour) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-day-cell", "data-on": hour >= row.start && hour < row.end ? "slot" : void 0 }, hour)) })
            ] }, row.id)),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-day-row", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-day-k" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-day-axis", children: HOUR_TICKS.map((hour) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: String(hour).padStart(2, "0") }, hour)) })
            ] })
          ]
        }
      );
    }
    function PriceRow({ slot, index, price, view, onChange, onRemove, onDuplicate }) {
      const context = slot === null ? "基准价" : `第 ${String(index + 1)} 个峰谷时段`;
      const [confirming, setConfirming] = (0, import_react.useState)(false);
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
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-row", "data-inert": inert || void 0, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dtpl-price-scope", children: slot === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-scope-k", children: "基准价" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-scope-sub", children: "全周 · 全天，峰谷时段之外都按它计" })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-scope-ctl", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "select",
              {
                className: "dtpl-price-select dtpl-price-select-days",
                value: slot.days,
                "aria-label": `${context}的适用日`,
                title: DAY_SET_HINTS[slot.days],
                onChange: (event) => replaceSlot({ ...slot, days: event.target.value }),
                children: DAY_SETS.map((days) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: days, children: DAY_SET_LABELS[days] }, days))
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "select",
              {
                className: "dtpl-price-select dtpl-price-select-hour",
                value: slot.start,
                "aria-label": `${context}的开始时间`,
                onChange: (event) => replaceSlot(withSlotStart(slot, event.target.value)),
                children: START_HOURS.map((hour) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: String(hour), children: clockLabel(hour) }, hour))
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-scope-dash", "aria-hidden": "true", children: "–" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "select",
              {
                className: "dtpl-price-select dtpl-price-select-hour",
                value: slot.end,
                "aria-label": `${context}的结束时间`,
                onChange: (event) => replaceSlot(withSlotEnd(slot, event.target.value)),
                children: END_HOURS.map((hour) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: String(hour), children: clockLabel(hour) }, hour))
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-scope-foot", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-scope-sub", children: inert ? "不改写任何档，不影响计价" : hours === null ? "时段还没成段" : `持续 ${String(hours)} 小时` }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-rowacts", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dtpl-price-ghost", "aria-label": `复制（${context}）`, onClick: onDuplicate, children: "复制" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
          return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
      const [pendingFocus, setPendingFocus] = (0, import_react.useState)(null);
      (0, import_react.useEffect)(() => {
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
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-tbl", role: "group", "aria-label": `四档价（${unitOf(view)}）`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-cols", "aria-hidden": "true", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-cols-k", children: "生效范围" }),
            CELLS.map(({ field, label }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-cols-n", children: label }, field))
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-rows", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
            price.slots.map((slot, slotIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dtpl-price-addrow", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            type: "button",
            id: "price-add-slot",
            className: "dtpl-price-add-ghost dtpl-price-add-slot",
            "aria-label": "添加峰谷时段",
            onClick: addSlot,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-add-plus", "aria-hidden": "true", children: "＋" }),
              "峰谷时段"
            ]
          }
        ) })
      ] });
    }
    var ModelDetail = (0, import_react.memo)(function ModelDetail2({ route, row, billing, baseline, holidays, currency, rate, onCurrency, onRowChange, onBilling }) {
      const view = { route: currency, cnyPerUsd: rate };
      const dirty = modelDirty(route, row, baseline);
      const issue = priceIssue(row);
      const live = ratesInForce(row, holidays);
      const named = row.name !== void 0 && row.name !== "" && row.name !== row.model;
      const hasSlots = effectiveSlots(row).length > 0;
      const countText = row.records > 0 ? `${String(row.records)} 次请求` : "没记过";
      const unpriced = row.unpriced !== void 0 && row.unpriced > 0 && live !== null ? row.unpriced : 0;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dtpl-price-detail", "data-dirty": dirty, "aria-label": `${row.model} 的价格`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-detail-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-detail-main", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-detail-id", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-name", "data-exact": !named, children: named ? row.name : row.model }),
              named && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-exact", title: row.model, children: row.model })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-reqs", children: countText }),
            unpriced > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
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
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-route-facts", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-head-k", children: "这条通道" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-currency", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-head-k", children: "报价币种" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-switch", role: "group", "aria-label": "报价币种", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtpl-price-currency", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtpl-price-head-k", children: "计费性质" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "span",
                {
                  className: "dtpl-price-switch",
                  role: "group",
                  "aria-label": `${route} 的计费性质`,
                  title: "按量 = 金额是实际支出；订阅 = 金额是按此处价格折算的订阅价值（非现金）",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "aria-pressed": billing === "metered", onClick: () => onBilling(route, "metered"), children: "按量" }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "aria-pressed": billing === "subscription", onClick: () => onBilling(route, "subscription"), children: "订阅" })
                  ]
                }
              )
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-console", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dtpl-price-console-edit", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceTable, { price: row, view, onChange: (next) => onRowChange(route, row.model, next) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtpl-price-console-live", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveRates, { live, records: row.records, view, hasSlots }),
            hasSlots && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DayBand, { price: row })
          ] })
        ] }),
        live === null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dtpl-price-note", children: row.records > 0 ? "四档价全空 = 这条没有价：它的记录按 ¥0 计，并列为价格未知。" : "四档价全空 = 这条没有价。它还没被调用过，所以没有金额受影响。" }),
        issue !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "dtpl-price-issue", role: "status", children: [
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
    
    // src/client/pricing/templates.ts
    var TEMPLATES_KEY = "dsh-tookbook.price-templates";
    var MAX_TEMPLATES = 50;
    var MAX_TEMPLATE_SLOTS = 50;
    var MAX_NAME_LENGTH = 40;
    var MAX_RATE_LENGTH = 64;
    function isRecord(value) {
      return typeof value === "object" && value !== null;
    }
    function cleanRate(value) {
      if (typeof value !== "string") return "";
      const text = value.trim();
      return text.length > MAX_RATE_LENGTH ? "" : text;
    }
    function cleanName(value) {
      return typeof value === "string" ? value.trim().slice(0, MAX_NAME_LENGTH) : "";
    }
    function cleanCurrency(value) {
      return value === "USD" ? "USD" : "CNY";
    }
    function cleanHour(value) {
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      if (typeof value !== "string") return "";
      return value.trim();
    }
    function cleanSlot(raw) {
      if (!isRecord(raw)) return null;
      const days = DAY_SETS.includes(raw.days) ? raw.days : null;
      const start = cleanHour(raw.start);
      const end = cleanHour(raw.end);
      if (days === null || start === "" || end === "") return null;
      return {
        days,
        start,
        end,
        input: cleanRate(raw.input),
        output: cleanRate(raw.output),
        cacheRead: cleanRate(raw.cacheRead),
        cacheWrite: cleanRate(raw.cacheWrite)
      };
    }
    function cleanSlots(raw) {
      if (!Array.isArray(raw)) return [];
      const slots = [];
      for (const item of raw) {
        const slot = cleanSlot(item);
        if (slot === null) continue;
        slots.push(slot);
        if (slots.length >= MAX_TEMPLATE_SLOTS) break;
      }
      return slots;
    }
    function makeId() {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
    function normalizeTemplate(raw) {
      if (!isRecord(raw)) return null;
      const id = typeof raw.id === "string" ? raw.id : "";
      const name = cleanName(raw.name);
      if (id === "" || name === "") return null;
      return {
        id,
        name,
        input: cleanRate(raw.input),
        output: cleanRate(raw.output),
        cacheRead: cleanRate(raw.cacheRead),
        cacheWrite: cleanRate(raw.cacheWrite),
        currency: cleanCurrency(raw.currency),
        slots: cleanSlots(raw.slots)
      };
    }
    function parseTemplates(raw) {
      if (!Array.isArray(raw)) return [];
      const seen = /* @__PURE__ */ new Set();
      const templates = [];
      for (const item of raw) {
        const template = normalizeTemplate(item);
        if (template === null || seen.has(template.id)) continue;
        seen.add(template.id);
        templates.push(template);
        if (templates.length >= MAX_TEMPLATES) break;
      }
      return templates;
    }
    function readTemplates() {
      try {
        const saved = localStorage.getItem(TEMPLATES_KEY);
        if (saved === null) return [];
        return parseTemplates(JSON.parse(saved));
      } catch {
        return [];
      }
    }
    function writeTemplates(templates) {
      try {
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.slice(-MAX_TEMPLATES)));
      } catch {
      }
    }
    function makeTemplate(name, rates, slots, currency) {
      return {
        id: makeId(),
        name: cleanName(name),
        input: cleanRate(rates.input),
        output: cleanRate(rates.output),
        cacheRead: cleanRate(rates.cacheRead),
        cacheWrite: cleanRate(rates.cacheWrite),
        currency,
        slots: cleanSlots(slots)
      };
    }
    function convertRateSet(view, holder, to) {
      const input = convertText(view, holder.input, to);
      const output = convertText(view, holder.output, to);
      const cacheRead = convertText(view, holder.cacheRead, to);
      const cacheWrite = convertText(view, holder.cacheWrite, to);
      if (input === null || output === null || cacheRead === null || cacheWrite === null) return null;
      return { input, output, cacheRead, cacheWrite };
    }
    function applyTemplate(template, targetCurrency, cnyPerUsd) {
      const view = { route: template.currency, cnyPerUsd };
      const rates = convertRateSet(view, template, targetCurrency);
      if (rates === null) return null;
      const slots = [];
      for (const slot of template.slots) {
        const slotRates2 = convertRateSet(view, slot, targetCurrency);
        if (slotRates2 === null) return null;
        slots.push({ days: slot.days, start: slot.start, end: slot.end, ...slotRates2 });
      }
      return { rates, slots };
    }
    
    // src/client/pricing/TemplateBar.tsx
    var import_react2 = require("react");
    var import_jsx_runtime2 = require("react/jsx-runtime");
    var CURRENCY_MARK = { CNY: "¥", USD: "$" };
    function TemplateBar({ templates, currency, canSave, onApply, onDelete, onSave }) {
      const [name, setName] = (0, import_react2.useState)("");
      const [notice, setNotice] = (0, import_react2.useState)(null);
      const save = () => {
        if (!canSave || name.trim() === "") return;
        onSave(name.trim());
        setName("");
        setNotice(null);
      };
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dtpl-price-tpl", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dtpl-price-tpl-k", children: "价格模板" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dtpl-price-tpl-chips", children: templates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dtpl-price-tpl-empty", children: "还没有模板：把当前这组四档价起个名存成模板，以后一键套到别的模型上。" }) : templates.map((template) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dtpl-price-tpl-chip", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              type: "button",
              className: "dtpl-price-tpl-apply",
              title: describeTemplate(template, currency),
              onClick: () => {
                const result = onApply(template);
                setNotice(result.ok ? null : { tone: "err", text: result.error ?? "套用失败" });
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dtpl-price-tpl-mark", "aria-hidden": "true", children: CURRENCY_MARK[template.currency] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dtpl-price-tpl-name", children: template.name })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "dtpl-price-tpl-del",
              "aria-label": `删除模板 ${template.name}`,
              title: "删除这个模板（只删模板，不影响任何已填的价）",
              onClick: () => onDelete(template.id),
              children: "×"
            }
          )
        ] }, template.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dtpl-price-tpl-save", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              className: "dtpl-price-input dtpl-price-tpl-input",
              type: "text",
              value: name,
              placeholder: "给这组价起个名",
              "aria-label": "新模板名称",
              autoComplete: "off",
              spellCheck: false,
              maxLength: 40,
              onChange: (event) => setName(event.target.value),
              onKeyDown: (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  save();
                }
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "dtpl-price-ghost",
              disabled: !canSave || name.trim() === "",
              title: canSave ? "把当前模型的四档价与峰谷时段（按这条通道的币种）存成一个可复用的模板" : "先把这一行的输入价、输出价填上，才能存成模板",
              onClick: save,
              children: "存为模板"
            }
          )
        ] }),
        notice !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dtpl-price-tpl-err", role: "alert", children: notice.text })
      ] });
    }
    function describeTemplate(template, currency) {
      const unit = template.currency === "USD" ? "$/百万词元" : "¥/百万词元";
      const parts = [`输入 ${show(template.input)}`, `输出 ${show(template.output)}`];
      if (template.cacheRead.trim() !== "") parts.push(`读 ${show(template.cacheRead)}`);
      if (template.cacheWrite.trim() !== "") parts.push(`写 ${show(template.cacheWrite)}`);
      const convert = template.currency !== currency ? "；套用时按汇率换算到这条通道的币种" : "";
      const slots = template.slots.length > 0 ? `，另带 ${String(template.slots.length)} 个峰谷时段` : "";
      return `套用「${template.name}」：${parts.join(" / ")}（${unit}）${slots}${convert}`;
    }
    function show(value) {
      return value.trim() === "" ? "—" : value;
    }
    
    // src/client/pricing/PricingPanel.tsx
    var import_jsx_runtime3 = require("react/jsx-runtime");
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
      const [templates, setTemplates] = (0, import_react3.useState)(readTemplates);
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
      const applyTemplateToRow = (template) => {
        if (card === void 0 || row === void 0) return { ok: false, error: "先选一条通道和模型，再套用模板" };
        const applied = applyTemplate(template, card.currency, rate);
        if (applied === null) {
          if (template.currency !== card.currency && rate === null) {
            const from = template.currency === "USD" ? "美元" : "人民币";
            const to = card.currency === "USD" ? "美元" : "人民币";
            return { ok: false, error: `「${template.name}」按${from}记，这条通道按${to}记，套用要先换算：先在汇率格填 1 美元等于多少元。` };
          }
          return { ok: false, error: `「${template.name}」里有档不是有效的非负数字，套用会把它写成无效价，已拒绝。` };
        }
        const slots = applied.slots.map((slot) => newSlot({ days: slot.days, start: slot.start, end: slot.end, input: slot.input, output: slot.output, cacheRead: slot.cacheRead, cacheWrite: slot.cacheWrite }));
        updateModel(card.route, row.model, { ...row, ...applied.rates, slots });
        return { ok: true };
      };
      const saveTemplateFromRow = (name) => {
        if (card === void 0 || row === void 0) return;
        const slots = effectiveSlots(row).map((slot) => ({
          days: slot.days,
          start: slot.start,
          end: slot.end,
          input: slot.input,
          output: slot.output,
          cacheRead: slot.cacheRead,
          cacheWrite: slot.cacheWrite
        }));
        const template = makeTemplate(name, {
          input: row.input,
          output: row.output,
          cacheRead: row.cacheRead,
          cacheWrite: row.cacheWrite
        }, slots, card.currency);
        if (template.name === "") return;
        const next = [...readTemplates(), template].slice(-MAX_TEMPLATES);
        writeTemplates(next);
        setTemplates(next);
      };
      const deleteTemplate = (id) => {
        const next = readTemplates().filter((template) => template.id !== id);
        writeTemplates(next);
        setTemplates(next);
      };
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
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-board", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "section",
          {
            className: "dtpl-card dtpl-span-12 dtpl-card-pad dtpl-price-controls",
            onBlur: (event) => {
              if (event.target instanceof HTMLSelectElement) return;
              if (stagedChanges(stateRef.current, baselineRef.current) === 0) return;
              committedRef.current = true;
              void writeRef.current();
            },
            children: [
              state.routes.size > 0 && card !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-pick", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-pick-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-pick-k", children: "通道" }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      "select",
                      {
                        className: "dtpl-price-select dtpl-price-pick-sel",
                        value: card.route,
                        "aria-label": "通道",
                        onChange: (event) => {
                          choosePicked({ route: event.target.value, model: "" });
                        },
                        children: routeChoices.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: item.route, children: routeOptionLabel(item) }, item.route))
                      }
                    )
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-pick-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-pick-k", children: "模型" }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      "select",
                      {
                        className: "dtpl-price-select dtpl-price-pick-sel",
                        value: row === void 0 ? "" : row.model,
                        disabled: models.length === 0,
                        "aria-label": `${card.label} 的模型`,
                        onChange: (event) => {
                          choosePicked({ route: card.route, model: event.target.value });
                        },
                        children: models.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: item.model, children: modelOptionLabel(item, modelDirty(card.route, item, baseline.models)) }, item.model))
                      }
                    )
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-pick-row dtpl-price-pick-fxrow", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-pick-k", children: "汇率" }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-fx", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-fx-eq", children: "1 美元 =" }),
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-fx-unit", children: "元" }),
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-fx-note", children: inverseHint(rate) ?? "填了才能按美元报价" })
                    ] }),
                    fxProblem !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-fx-err", role: "alert", children: fxProblem })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                    "div",
                    {
                      className: "dtpl-price-pick-row dtpl-price-pick-state",
                      "data-quiet": save.kind === "clean" && changes === 0 ? "true" : void 0,
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-pick-k", children: "状态" }),
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-state-row", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: `dtpl-price-state is-${save.kind}`, role: "status", "aria-live": "polite", children: stateText === "" ? "与磁盘一致" : stateText }),
                          save.kind === "error" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dtpl-price-ghost", onClick: () => void writeNow(), children: "重试" })
                        ] })
                      ]
                    }
                  )
                ] }),
                row !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  TemplateBar,
                  {
                    templates,
                    currency: card.currency,
                    canSave: row.input.trim() !== "" && row.output.trim() !== "",
                    onApply: applyTemplateToRow,
                    onDelete: deleteTemplate,
                    onSave: saveTemplateFromRow
                  }
                )
              ] }),
              view !== null && view.calendarMissing.length > 0 && (() => {
                const missing = view.calendarMissing;
                const autoFailed = view.holidaySync !== void 0 && (view.holidaySync.state === "failed" || view.holidaySync.state === "missing");
                return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-calarm", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-calarm-text", role: "status", children: [
                    "缺 ",
                    missing.join("、"),
                    " 年的法定节假日安排：「法定工作日」时段会把那几年的节假日当成工作日，照高峰价多算。",
                    autoFailed && "自动拉取没成功；点「补上」把缺的年份加进年历，再自己填放假日子。",
                    holiday.error !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("b", { children: [
                      "（自动拉取失败：",
                      holiday.error,
                      "）"
                    ] })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "dtpl-price-calarm-act",
                      "aria-controls": "price-calendar",
                      disabled: holiday.running,
                      title: "从 holiday-cn 拉取这几年的法定节假日安排（它每天抓取国务院公告，每年一份 JSON）。你手写过的年份不受影响。",
                      onClick: () => {
                        void runHolidaySync(true, missing);
                        document.getElementById("price-calendar")?.scrollIntoView({ block: "nearest" });
                      },
                      children: holiday.running ? "拉取中…" : `↻ 自动拉取 ${missing.length > 2 ? `${String(missing.length)} 年` : `${missing.join("、")} 年`}`
                    }
                  )
                ] });
              })(),
              loadError !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-error", role: "alert", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "dtpl-error-text", children: [
                  "价格表加载失败：",
                  loadError
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dtpl-retry", onClick: () => void loadView(), children: "重试" })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dtpl-card dtpl-span-12 dtpl-card-pad dtpl-price-stage", children: [
          view === null ? loadError === null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-skeleton", "aria-hidden": "true", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dtpl-sk dtpl-price-sk-pick" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dtpl-sk dtpl-price-sk-open" })
          ] }) : null : state.routes.size === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-empty", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dtpl-empty-title", children: "没有可显示的通道" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dtpl-empty-sub", children: "通道来自本机 settings.yaml 与正在运行的适配器；账本或价格表里出现过的通道也会列出来。" })
          ] }) : row === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-empty", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dtpl-empty-title", children: "这条通道没有列出的模型" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dtpl-empty-sub", children: "它的模型目录与账本里都没有模型；账本记过它时这里就会多出一行。" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
          state.routes.size > 0 && view !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dtpl-price-actions-fill", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: `dtpl-price-actions-note${syncTone === "quiet" ? "" : ` is-${syncTone}`}`, children: syncGapsPrefix }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
          lookup.open && card !== void 0 && row !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
          )
        ] }),
        view !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          CalendarEditor,
          {
            className: "dtpl-span-12",
            entries: state.calendar,
            missingYears: view.calendarMissing,
            autoYears: [...state.autoYears].sort((left, right) => left.localeCompare(right)),
            sync: view.holidaySync,
            syncing: holiday.running
          }
        )
      ] });
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
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-lookup-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-lookup-k", children: "在 models.dev 里找这个模型" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: "dtpl-price-ghost",
                  disabled: !canSearch || lookup.loading,
                  onClick: () => void onSearch(lookup.keyword),
                  children: "搜索"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dtpl-price-ghost", "aria-label": "关闭搜索价", onClick: onClose, children: "×" })
            ] }),
            !isUsd && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dtpl-price-lookup-note", children: "这条通道的价按人民币记，而 models.dev 只有美元价。要填进来的话，先在详情头把报价币种切成美元—— 那会把整条通道已有的价按汇率换算一次，是真改价。" }),
            lookup.loading ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dtpl-price-lookup-empty", children: "搜索中…" }) : lookup.error !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "dtpl-price-lookup-empty", children: [
              "搜索失败：",
              lookup.error,
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dtpl-price-ghost", onClick: () => void onSearch(lookup.keyword), children: "重试" })
            ] }) : lookup.result !== null && lookup.result.candidates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "dtpl-price-lookup-empty", children: [
              "没找到与「",
              lookup.keyword,
              "」相关的模型（只收原厂挂牌价，转售商与价格分裂的条目不列）。 换个关键词试试：模型串，或者只敲厂商名如 deepseek / qwen。"
            ] }) : lookup.result !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "dtpl-price-lookup-list", children: lookup.result.candidates.map((candidate) => {
              const isExact = candidate.key === exactKey;
              const isCurrent = candidate.key === currentKey;
              return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                "li",
                {
                  className: `dtpl-price-lookup-item${isExact ? " is-exact" : ""}`,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dtpl-price-lookup-id", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-lookup-provider", children: candidate.provider }),
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-lookup-slash", children: "/" }),
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: candidate.modelId }),
                      isExact && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-lookup-badge", title: "与你搜的关键词是同一个模型", children: "就是搜的这个" }),
                      isCurrent && !isExact && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dtpl-price-lookup-badge", title: "就是当前这一行正在编辑的模型", children: "当前这一行" })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dtpl-price-lookup-name", children: candidate.name }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dtpl-price-lookup-cost", children: lookupCostText(candidate.cost) }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
    
    // src/client/quota/QuotaSection.tsx
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
    
    // src/client/icons.tsx
    var import_jsx_runtime4 = require("react/jsx-runtime");
    function UsageGlyph({ className }) {
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M3 3v18h18" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M18 17V9" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M13 17V5" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8 17v-3" })
          ]
        }
      );
    }
    function RefreshGlyph({ className }) {
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M18 9a8 8 0 1 0 2 5.3" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M18 2v4h-4" })
          ]
        }
      );
    }
    function ClockGlyph({ className }) {
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "12", cy: "12", r: "9" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M12 7v5l3 2" })
          ]
        }
      );
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
      const [popTick, setPopTick] = (0, import_react4.useState)(0);
      const handleRefresh = () => {
        setPopTick((t) => t + 1);
        onRefresh();
      };
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: "dtpl-quota-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { className: "dtpl-quota-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-id", children: [
            card !== null && ring !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(QuotaGauge, { pct: ring.pct, tone: ring.tone, cap: ring.cap }),
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
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-window", "data-tone": tone, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dtpl-quota-window-line1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-window-label", children: window2.label }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dtpl-quota-window-metric", children: metric }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `dtpl-quota-reset${window2.exceeded ? " dtpl-quota-reset-limited" : ""}`, children: window2.exceeded ? "已超限" : resetLabel(window2) })
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
        )
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
    
    // src/client/quota/QuotaSection.tsx
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
    function QuotaSection() {
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
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "dtpl-card dtpl-span-12 dtpl-quota-panel", "aria-label": "订阅额度", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dtpl-quota-strip", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dtpl-quota-strip-id", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { className: "dtpl-quota-strip-t", children: "订阅额度" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dtpl-quota-strip-note", children: "官方账户数据（用你的 key 查询），与本机账本分开" })
          ] }),
          hasProviders && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(AutoRefreshControl, { value: autoMinutes, onChange: chooseAutoMinutes })
        ] }),
        listError !== null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dtpl-error", role: "alert", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "dtpl-error-text", children: [
            "额度加载失败：",
            listError
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dtpl-retry", onClick: () => setReload((count) => count + 1), children: "重试" })
        ] }) : providers === null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dtpl-quota-sk-body", "aria-hidden": "true", children: [
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
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dtpl-quota-grid", children: ordered.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
        )) })
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
    
    // src/client/RescanButton.tsx
    var import_jsx_runtime7 = require("react/jsx-runtime");
    function RescanButton({ busy, retry, onRescan }) {
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
        "button",
        {
          type: "button",
          className: `dtpl-rescan${retry ? " dtpl-rescan-retry" : ""}`,
          onClick: onRescan,
          disabled: busy,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(RefreshGlyph, { className: `dtpl-rescan-ico${busy ? " dtpl-spin" : ""}` }),
            busy ? "扫描中…" : retry ? "重试" : "重新扫描"
          ]
        }
      );
    }
    
    // src/client/LedgerView.tsx
    var import_jsx_runtime8 = require("react/jsx-runtime");
    var TREND_DAYS = 14;
    var BASELINE_DAYS = 7;
    var CHART = { w: 1320, h: 260, left: 46, right: 62, top: 30, bottom: 24 };
    var ZERO_TOTALS = {
      requests: 0,
      inputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0
    };
    function niceMax(value) {
      if (!(value > 0)) return 1;
      const power = 10 ** Math.floor(Math.log10(value));
      const norm = value / power;
      const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
      return step * power;
    }
    function spendMax(value) {
      if (!(value > 0)) return 0.2;
      return Math.ceil(value / 0.2) * 0.2;
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
        weekSpend: weekSpendOf(overview.byDay, today),
        reference: todayReference(overview, today, tokens)
      };
    }
    function weekSpendOf(days, today) {
      const young = !days.some((entry) => entry.day <= shiftDayKey(today, -BASELINE_DAYS));
      if (young) return null;
      const byDay = new Map(days.map((entry) => [entry.day, entry]));
      let sum = 0;
      for (let back = 0; back < BASELINE_DAYS; back++) sum += byDay.get(shiftDayKey(today, -back))?.spend ?? 0;
      return sum;
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
    function TodayModule({ hero, today, showCacheWrite }) {
      const cells = mixCells(hero.totals, showCacheWrite);
      const denominator = hero.totals.inputTokens + hero.totals.cacheReadTokens;
      const hit = denominator > 0 ? formatShare(hero.totals.cacheReadTokens, denominator) : "—";
      const minor = [
        ...hero.subscriptionValue > 0 ? [{ key: "sub", label: "订阅价值", value: formatMoney(hero.subscriptionValue), muted: true }] : [],
        {
          key: "week",
          label: `近 ${BASELINE_DAYS} 天支出`,
          value: hero.weekSpend === null ? "—" : formatMoney(hero.weekSpend),
          muted: false
        }
      ];
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("section", { className: "dtpl-card dtpl-span-12 dtpl-card-today", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("header", { className: "dtpl-mod-h", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("h2", { className: "dtpl-mod-t", children: [
            "今日 · ",
            today.slice(5)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dtpl-mod-aux", children: [
            hero.totals.requests,
            " 次请求"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-today", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-today-top", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-today-hero", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dtpl-today-k", children: "今日词元" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dtpl-today-v", children: formatTokens(hero.tokens) }),
              hero.reference !== null && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-today-sub", title: hero.reference.title, children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: hero.reference.label }),
                hero.reference.value !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("b", { children: hero.reference.value })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-today-mix", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-today-mix-h", children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "词元构成" }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dtpl-today-hit", children: [
                  "缓存命中率 ",
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("b", { children: hit })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dtpl-compose", role: "list", "aria-label": "今日词元构成", children: cells.map((cell) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-compose-row", role: "listitem", children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dtpl-compose-k", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("i", { className: `dtpl-compose-key${cell.value > 0 ? "" : " is-empty"}`, "data-k": cell.key }),
                  cell.label
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dtpl-compose-track", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("i", { className: "dtpl-compose-fill", "data-k": cell.key, style: { width: cell.value > 0 ? `max(2px, ${share(cell.value, hero.tokens)}%)` : "0%" } }) }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dtpl-compose-n", children: [
                  formatTokens(cell.value),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("em", { className: "dtpl-compose-p", children: formatShare(cell.value, hero.tokens) })
                ] })
              ] }, cell.key)) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-today-money", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-money-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dtpl-money-k", children: "实际支出" }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("b", { className: `dtpl-money-v${hero.spend === 0 ? " is-muted" : ""}`, children: formatMoney(hero.spend) })
              ] }),
              minor.map((fact) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-money-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dtpl-money-k", children: fact.label }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `dtpl-money-v${fact.muted ? " is-muted" : ""}`, children: fact.value })
              ] }, fact.key)),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dtpl-money-note", children: "金额按现价折算" })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-today-foot", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
              "缓存读 ",
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("b", { children: formatTokens(hero.totals.cacheReadTokens) }),
              " / 计费输入 ",
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("b", { children: formatTokens(denominator) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
              "失败 ",
              hero.totals.failures ?? 0,
              " · 压缩 ",
              hero.totals.compactions ?? 0,
              " · 用量未知 ",
              hero.totals.usageUnknown ?? 0
            ] })
          ] })
        ] })
      ] });
    }
    function TrendModule({ days }) {
      if (days.length === 0) return null;
      const byDay = new Map(days.map((row) => [row.day, row]));
      const today = localDayKey();
      const earliest = shiftDayKey(today, -(TREND_DAYS - 1));
      const start = days[0].day > earliest ? days[0].day : earliest;
      const slots = [];
      for (let day = start; day <= today; day = shiftDayKey(day, 1)) slots.push(day);
      if (slots.length === 0) return null;
      const values = slots.map((day) => {
        const row = byDay.get(day);
        return row === void 0 ? 0 : totalsTokens(row.totals);
      });
      const spends = slots.map((day) => byDay.get(day)?.spend ?? 0);
      const peak = Math.max(...values);
      const peakIndex = peak > 0 ? values.indexOf(peak) : -1;
      const total = values.reduce((acc, value) => acc + value, 0);
      const spendTotal = spends.reduce((acc, value) => acc + value, 0);
      const maxTokens = niceMax(peak);
      const maxSpend = spendMax(Math.max(...spends));
      const innerW = CHART.w - CHART.left - CHART.right;
      const innerH = CHART.h - CHART.top - CHART.bottom;
      const step = innerW / slots.length;
      const barW = Math.min(46, Math.max(10, step * 0.42));
      const barX = (index) => CHART.left + step * (index + 0.5);
      const tokenY = (value) => CHART.top + innerH * (1 - value / maxTokens);
      const spendY = (value) => CHART.top + innerH * (1 - value / maxSpend);
      const last = slots.length - 1;
      const recent = windowTotals(days);
      const recentTokens = totalsTokens(recent);
      const recentCells = mixCells(recent, recent.cacheWriteTokens > 0);
      const bars = slots.map((day, index) => {
        const value = values[index];
        const x = barX(index) - barW / 2;
        const top = tokenY(value);
        const height = Math.max(0, CHART.top + innerH - top);
        return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "rect",
          {
            className: `dtpl-chart-bar${index === last ? " is-today" : ""}`,
            x,
            y: top,
            width: barW,
            height,
            children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("title", { children: `${shortDay(day)} 词元 ${formatTokens(value)} · 支出 ${formatMoney(spends[index] ?? 0)}` })
          },
          `bar-${day}`
        );
      });
      const points = slots.map((_, index) => ({ x: barX(index), y: spendY(spends[index] ?? 0) }));
      const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
      const ticks = [0, 0.5, 1];
      const peakX = peakIndex >= 0 ? barX(peakIndex) : 0;
      const peakY = peakIndex >= 0 ? tokenY(values[peakIndex]) : 0;
      const peakAnchor = peakX < CHART.left + 70 ? "start" : peakX > CHART.w - CHART.right - 70 ? "end" : "middle";
      const peakLabelX = peakAnchor === "start" ? peakX + 24 : peakAnchor === "end" ? peakX - 24 : peakX;
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("section", { className: "dtpl-card dtpl-span-12", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("header", { className: "dtpl-mod-h", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("h2", { className: "dtpl-mod-t", children: [
            "近 ",
            TREND_DAYS,
            " 天 · 每日词元与支出"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dtpl-mod-aux", children: [
            "合计 ",
            formatTokens(total),
            peak > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
              " · 峰值 ",
              formatTokens(peak)
            ] }),
            spendTotal > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
              " · 支出 ",
              formatMoney(spendTotal)
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-chart", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-chart-key", "aria-hidden": "true", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("i", { className: "dtpl-key-bar" }),
              "每日词元（左轴）"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("i", { className: "dtpl-key-today" }),
              "今天"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("i", { className: "dtpl-key-line" }),
              "每日支出（右轴）"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            "svg",
            {
              className: "dtpl-chart-svg",
              viewBox: `0 0 ${CHART.w} ${CHART.h}`,
              role: "img",
              "aria-label": `近 ${TREND_DAYS} 天每日词元与支出：${shortDay(slots[0])} 至 ${shortDay(slots[last])} 共 ${slots.length} 天，合计 ${formatTokens(total)} 词元${peak > 0 ? `，峰值 ${shortDay(slots[peakIndex])} 的 ${formatTokens(peak)}` : ""}。`,
              children: [
                ticks.map((t) => {
                  const gy = CHART.top + innerH * (1 - t);
                  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("g", { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                      "line",
                      {
                        className: t === 0 ? "dtpl-chart-base" : "dtpl-chart-grid",
                        x1: CHART.left,
                        x2: CHART.w - CHART.right,
                        y1: gy,
                        y2: gy
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("text", { className: "dtpl-chart-tick", x: CHART.left - 6, y: gy + 3, textAnchor: "end", children: t === 0 ? "0" : formatTokens(maxTokens * t) }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("text", { className: "dtpl-chart-tick is-money", x: CHART.w - CHART.right + 6, y: gy + 3, children: t === 0 ? formatMoney(0) : formatMoney(maxSpend * t) })
                  ] }, t);
                }),
                bars,
                points.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { className: "dtpl-chart-line", d: line }),
                points.map((point, index) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                  "circle",
                  {
                    className: `dtpl-chart-dot${index === last ? " is-today" : ""}${index === peakIndex ? " is-peak" : ""}`,
                    cx: point.x,
                    cy: point.y,
                    r: index === last || index === peakIndex ? 3.5 : 2.5
                  },
                  `dot-${slots[index]}`
                )),
                peakIndex >= 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("g", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("text", { className: "dtpl-chart-num", x: peakLabelX, y: peakY - 22, textAnchor: peakAnchor, children: formatTokens(values[peakIndex]) }),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("text", { className: "dtpl-chart-tick is-peak", x: peakLabelX, y: peakY - 10, textAnchor: peakAnchor, children: peakIndex === last ? "今天峰值" : `${shortDay(slots[peakIndex])} 峰值` })
                ] }),
                slots.map((day, index) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                  "text",
                  {
                    className: `dtpl-chart-tick${index === peakIndex ? " is-peak" : ""}${index === last ? " is-now" : ""}`,
                    x: barX(index),
                    y: CHART.h - 6,
                    textAnchor: "middle",
                    children: shortDay(day)
                  },
                  `tick-${day}`
                ))
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-chart-foot", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-chart-mix-h", children: [
            "近 ",
            TREND_DAYS,
            " 天构成"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dtpl-chart-mix", role: "list", "aria-label": `近 ${TREND_DAYS} 天词元构成`, children: recentCells.map((cell) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dtpl-chart-mix-item", role: "listitem", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("i", { className: `dtpl-compose-key${cell.value > 0 ? "" : " is-empty"}`, "data-k": cell.key }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dtpl-chart-mix-k", children: cell.label }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("b", { className: "dtpl-chart-mix-v", children: formatTokens(cell.value) }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("em", { className: "dtpl-chart-mix-p", children: formatShare(cell.value, recentTokens) })
          ] }, cell.key)) })
        ] })
      ] });
    }
    function mixCells(totals, showCacheWrite) {
      return [
        { key: "input", label: "未缓存输入", value: totals.inputTokens },
        { key: "cache-read", label: "缓存读取", value: totals.cacheReadTokens },
        ...showCacheWrite ? [{ key: "cache-write", label: "缓存写入", value: totals.cacheWriteTokens }] : [],
        { key: "output", label: "输出", value: totals.outputTokens }
      ];
    }
    function windowTotals(days) {
      const earliest = shiftDayKey(localDayKey(), -(TREND_DAYS - 1));
      const totals = { ...ZERO_TOTALS };
      for (const row of days) {
        if (row.day < earliest) continue;
        totals.requests += row.totals.requests;
        totals.inputTokens += row.totals.inputTokens;
        totals.cacheReadTokens += row.totals.cacheReadTokens;
        totals.cacheWriteTokens += row.totals.cacheWriteTokens;
        totals.outputTokens += row.totals.outputTokens;
      }
      return totals;
    }
    function LedgerView({ overview, busy, retry, onRescan, quota }) {
      const hero = todayHero(overview);
      const today = localDayKey();
      const showCacheWrite = overview.byDay.some((row) => row.totals.cacheWriteTokens > 0);
      if (overview.records === 0) {
        return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dtpl-empty dtpl-span-12", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(UsageGlyph, { className: "dtpl-empty-ico" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "dtpl-empty-title", children: "还没有记录到词元用量" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "dtpl-empty-sub", children: "本插件记录本机每次模型调用的用量。先聊几句就会有数据；安装前的历史记录可以扫回来。" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dtpl-empty-act", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(RescanButton, { busy, retry, onRescan }) })
        ] });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(TodayModule, { hero, today, showCacheWrite }),
        quota,
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(TrendModule, { days: overview.byDay })
      ] });
    }
    function LedgerSkeleton() {
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dtpl-sk dtpl-sk-today dtpl-span-12" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dtpl-sk dtpl-sk-quota dtpl-span-12" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dtpl-sk dtpl-sk-trend dtpl-span-12" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dtpl-sk dtpl-sk-detail dtpl-span-12" })
      ] });
    }
    
    // src/client/ProviderPanel.tsx
    var import_react7 = require("react");
    
    // src/client/ShareRing.tsx
    var import_jsx_runtime9 = require("react/jsx-runtime");
    var R = 11;
    var CIRC = 2 * Math.PI * R;
    var PX = 44;
    function ShareRing({ value, total, denom }) {
      const label = formatShare(value, total);
      const arc = share(value, total) / 100 * CIRC;
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-share-ring", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("svg", { viewBox: "-13.5 -13.5 27 27", width: PX, height: PX, "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("circle", { className: "dtpl-share-ring-track", cx: "0", cy: "0", r: R }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
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
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-share-ring-num", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "dtpl-sr", children: [
            "占",
            denom,
            " "
          ] }),
          label.endsWith("%") ? label.slice(0, -1) : label,
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("i", { children: "%" })
        ] })
      ] });
    }
    
    // src/client/ScrollRail.tsx
    var import_react6 = require("react");
    var import_jsx_runtime10 = require("react/jsx-runtime");
    var HIDE_AFTER_MS = 900;
    var MIN_THUMB_PX = 28;
    function ScrollRail({ targetRef, resetKey, className = "dtpl-scroll-rail" }) {
      const [visible, setVisible] = (0, import_react6.useState)(false);
      const [thumb, setThumb] = (0, import_react6.useState)({ height: 0, top: 0 });
      (0, import_react6.useEffect)(() => {
        const el = targetRef.current;
        if (el === null) return;
        let hide = null;
        const measure = () => {
          const max = el.scrollHeight - el.clientHeight;
          const height = max > 0 ? Math.min(el.clientHeight, Math.max(MIN_THUMB_PX, el.clientHeight * el.clientHeight / el.scrollHeight)) : 0;
          const top = max > 0 ? el.scrollTop / max * (el.clientHeight - height) : 0;
          setThumb({ height, top });
        };
        const onScroll = () => {
          measure();
          setVisible(true);
          if (hide !== null) window.clearTimeout(hide);
          hide = window.setTimeout(() => setVisible(false), HIDE_AFTER_MS);
        };
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        const content = el.firstElementChild;
        if (content !== null) observer.observe(content);
        el.addEventListener("scroll", onScroll, { passive: true });
        setVisible(false);
        measure();
        return () => {
          el.removeEventListener("scroll", onScroll);
          observer.disconnect();
          if (hide !== null) window.clearTimeout(hide);
        };
      }, [targetRef, resetKey]);
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className, "aria-hidden": "true", "data-visible": visible && thumb.height > 0 ? "true" : void 0, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        "div",
        {
          className: "dtpl-scroll-thumb",
          style: { height: `${String(thumb.height)}px`, transform: `translateY(${String(thumb.top)}px)` }
        }
      ) });
    }
    
    // src/client/Breakdowns.tsx
    var import_jsx_runtime11 = require("react/jsx-runtime");
    function isNoPrice(cost, unpriced) {
      return unpriced && cost === 0;
    }
    function ModelRows({ byModel, totalTokens, money: money2, unpriced, showMoney }) {
      const rows = [...byModel].sort((left, right) => totalsTokens(right.totals) - totalsTokens(left.totals) || right.totals.requests - left.totals.requests || left.model.localeCompare(right.model) || left.provider.localeCompare(right.provider));
      return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dtpl-models", children: rows.map((m) => {
        const noPrice = isNoPrice(m.cost, unpriced.has(`${m.provider}|${m.model}`));
        const showsSub = m.spend === 0;
        const bucket = noPrice ? "价格未知" : showsSub ? "订阅价值" : "实际支出";
        const costText = noPrice ? "价格未知：按 ¥0 计" : `${showsSub ? money2(m.subscriptionValue) : money2(m.spend)} ${bucket}`;
        const tokens = totalsTokens(m.totals);
        return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-row", title: modelDetail(m, totalTokens, money2, noPrice, showMoney), children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dtpl-model", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-model-txt", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-model-name", children: m.model }),
            m.provider !== "" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-model-provider", children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-sr", children: "通道 " }),
              m.provider
            ] })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-row-share", "aria-hidden": "true", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-row-share-track", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("i", { style: { width: `${share(tokens, totalTokens)}%` } }) }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-row-share-p", children: formatShare(tokens, totalTokens) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-model-nums", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-val", children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-sr", children: "词元 " }),
              formatTokens(tokens)
            ] }),
            showMoney && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-cost", title: costText, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-cost-seg", children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-cost-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-sr", children: "金额 " }),
                noPrice ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { className: "dtpl-cost-na", children: "—" }) : showsSub ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { className: "dtpl-sub-amt", children: money2(m.subscriptionValue) }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { className: "dtpl-cash-amt", children: money2(m.spend) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("em", { className: "dtpl-cost-k", children: bucket })
            ] }) })
          ] })
        ] }, `${m.provider}/${m.model}`);
      }) });
    }
    function WorkspaceRows({ rows, totalTokens, money: money2, showMoney }) {
      return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dtpl-models", children: rows.map((row) => {
        const failed = row.totals.failures ?? 0;
        const cash = row.spend > 0;
        const sub = row.subscriptionValue > 0;
        const costText = [
          cash || !sub ? `${money2(row.spend)} 实际支出` : "",
          sub ? `${money2(row.subscriptionValue)} 订阅价值` : ""
        ].filter((part) => part !== "").join(" · ");
        return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
          "div",
          {
            className: `dtpl-row${row.id === "" ? " is-unattributed" : ""}`,
            title: workspaceDetail(row, money2, showMoney),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dtpl-model", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-model-txt", children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-model-name", children: row.title }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-ws-meta", children: [
                  row.path !== "" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-ws-path", title: row.path, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-sr", children: "目录 " }),
                      row.path
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-ws-sep", "aria-hidden": "true", children: "·" })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-ws-facts", children: [
                    row.totals.requests,
                    " 请求",
                    failed > 0 && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
                      " · ",
                      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("b", { className: "dtpl-ws-fail", children: [
                        failed,
                        " 失败"
                      ] })
                    ] }),
                    " ",
                    "· 最近 ",
                    formatRelative(row.lastAt)
                  ] })
                ] })
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-row-share", "aria-hidden": "true", children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-row-share-track", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("i", { style: { width: `${share(row.tokens, totalTokens)}%` } }) }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-row-share-p", children: formatShare(row.tokens, totalTokens) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dtpl-model-nums", children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-val", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-sr", children: "词元 " }),
                  formatTokens(row.tokens)
                ] }),
                showMoney && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-cost", title: costText, children: [
                  (cash || !sub) && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-cost-seg", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-cost-main", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-sr", children: "金额 " }),
                      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { className: "dtpl-cash-amt", children: money2(row.spend) })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("em", { className: "dtpl-cost-k", children: "实际支出" })
                  ] }),
                  cash && sub && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-cost-sep", "aria-hidden": "true", children: "·" }),
                  sub && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dtpl-cost-seg", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dtpl-cost-main", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("b", { className: "dtpl-sub-amt", children: money2(row.subscriptionValue) }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("em", { className: "dtpl-cost-k", children: "订阅价值" })
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
    var import_jsx_runtime12 = require("react/jsx-runtime");
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
    var SLICE_UNITS = {
      model: "个模型",
      workspace: "个工作区",
      provider: "个通道"
    };
    var SLICE_NOTES = {
      model: {
        text: "词元从多到少 · 占比按本窗口",
        title: "每个（通道，模型）在该窗口内的词元与费用，按词元从多到少排列；占比的分母是这个窗口的总词元。"
      },
      workspace: {
        text: "最近有操作在前 · 占比按本窗口",
        title: "每个工作区在该窗口内的词元。记录按会话的创建目录归属到工作区；没有工作区目录、或目录未注册为工作区的记录归入「未归属」。占比的分母是这个窗口的总词元。"
      },
      provider: {
        text: "词元从多到少 · 环为占本通道",
        title: "每个通道路由在该窗口内计费过的模型、词元与金额。卡内占比环的分母是该通道自己的词元，所以它与卡头的合计对得上。"
      }
    };
    var COLUMNS = {
      model: { id: "模型 · 通道", share: "占本窗口", nums: "词元 · 金额" },
      workspace: { id: "工作区 · 目录", share: "占本窗口", nums: "词元 · 金额" }
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
      const [range, setRange] = (0, import_react7.useState)(readRange);
      const [slice, setSlice] = (0, import_react7.useState)(lastSlice);
      const [views, setViews] = (0, import_react7.useState)(() => new Map(lastViews));
      const [cuts, setCuts] = (0, import_react7.useState)([]);
      const [error, setError] = (0, import_react7.useState)(null);
      const activeRef = (0, import_react7.useRef)(0);
      const viewsRef = (0, import_react7.useRef)(views);
      viewsRef.current = views;
      const rangeRef = (0, import_react7.useRef)(range);
      rangeRef.current = range;
      const load = (0, import_react7.useCallback)(async (target, force) => {
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
      (0, import_react7.useEffect)(() => {
        void load(range);
      }, [range, load]);
      (0, import_react7.useEffect)(() => subscribeLedgerChanges(() => {
        if (document.hidden) return;
        void load(rangeRef.current, true);
      }), [load]);
      (0, import_react7.useEffect)(() => () => {
        activeRef.current += 1;
      }, []);
      const chooseRange = (0, import_react7.useCallback)((next) => {
        setRange(next);
        try {
          localStorage.setItem(RANGE_KEY, next);
        } catch {
        }
      }, []);
      const chooseSlice = (0, import_react7.useCallback)((next) => {
        lastSlice = next;
        setSlice(next);
      }, []);
      const view = views.get(range);
      const moneyOf = (value) => formatMoney(value);
      const showMoney = rangeCarriesMoney(range);
      const busy = view === void 0 && error === null;
      const available = view === void 0 ? cuts : cutsOf(view);
      const active2 = available.includes(slice) ? slice : available[0] ?? "model";
      const panelRef = (0, import_react7.useRef)(null);
      (0, import_react7.useEffect)(() => {
        panelRef.current?.scrollTo({ top: 0 });
      }, [range, active2]);
      const total = view === void 0 ? 0 : active2 === "model" ? view.byModel.length : active2 === "workspace" ? view.byWorkspace.length : view.providers.length;
      const scrollable = active2 === "provider" ? total > 3 : total > 7;
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
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("section", { "aria-label": "用量明细", className: "dtpl-card dtpl-span-12 dtpl-usage-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-usage-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-usage-head-top", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("h2", { className: "dtpl-mod-t", children: [
              RANGE_WORDS[range],
              "用量",
              view !== void 0 && total > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-usage-count", children: [
                "· ",
                total,
                " ",
                SLICE_UNITS[active2]
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-usage-scope", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-range-tabs", role: "group", "aria-label": "时间跨度", children: RANGE_IDS.map((id) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
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
              !showMoney && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "span",
                {
                  className: "dtpl-usage-money-note",
                  title: "金额按当前价折算：全部账本里它既不是历史支出、也不是今天的价值（那些 token 是按各时期的价格花的），所以只给词元。近 30 天及更短的窗口里金额照常给。",
                  children: "全部账本只给词元"
                }
              )
            ] })
          ] }),
          view !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-hero-facts dtpl-usage-facts", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-hero-fact", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("b", { children: view.totalRequests }),
              " 请求"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("i", { "aria-hidden": "true", children: "·" }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-hero-fact", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("b", { children: formatTokens(view.totalTokens) }),
              " 词元"
            ] }),
            showMoney && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("i", { "aria-hidden": "true", children: "·" }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-hero-fact", children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("b", { children: moneyOf(view.totalSpend) }),
                " 实际支出"
              ] }),
              view.totalSubscriptionValue > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("i", { "aria-hidden": "true", children: "·" }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-hero-fact", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("b", { children: moneyOf(view.totalSubscriptionValue) }),
                  " 订阅价值"
                ] })
              ] })
            ] })
          ] }) : busy ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-sk dtpl-usage-facts-sk", "aria-hidden": "true" }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-usage-facts dtpl-usage-facts-empty", "aria-hidden": "true" })
        ] }),
        error !== null && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-error", role: "alert", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("p", { className: "dtpl-error-text", children: [
            "用量明细加载失败：",
            error
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { type: "button", className: "dtpl-retry", onClick: () => void load(range, true), children: "重试" })
        ] }),
        showCuts && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-bd-head", children: [
          available.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-bd-tabs", role: "tablist", "aria-label": "拆分方式", onKeyDown: onTablistKeyDown, children: available.map((id) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
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
          )) }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-sk dtpl-usage-cuts-sk", "aria-hidden": "true" }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-sec-aside", title: note.title, children: [
            note.text,
            scrollable ? " · 列表可滚动" : ""
          ] })
        ] }),
        view !== void 0 && available.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-empty", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(UsageGlyph, { className: "dtpl-empty-ico" }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("p", { className: "dtpl-empty-title", children: [
            RANGE_WORDS[view.range],
            "没有计费记录"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { className: "dtpl-empty-sub", children: "这个窗口内没有任何通道计费调用。换一个窗口看看。" })
        ] }) : cols !== void 0 && view !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-bd-cols", "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-bd-col-id", children: cols.id }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-bd-col-share", children: cols.share }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-bd-col-nums", children: showMoney ? cols.nums : "词元" })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-usage-body-wrap", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
            "div",
            {
              ref: panelRef,
              role: "tabpanel",
              id: "dtpl-usage-panel",
              "aria-busy": busy,
              "aria-labelledby": showCuts && available.length > 0 ? `dtpl-usage-tab-${active2}` : void 0,
              children: view === void 0 ? busy && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(PanelSkeleton, { slice: active2 }) : active2 === "model" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ModelRows, { byModel: view.byModel, totalTokens: view.totalTokens, money: moneyOf, unpriced: unpricedKeysOf(view), showMoney }) : active2 === "workspace" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(WorkspaceRows, { rows: view.byWorkspace, totalTokens: view.totalTokens, money: moneyOf, showMoney }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ProviderCards, { cards: view.providers, labels: view.providerLabels ?? {}, money: moneyOf, showMoney })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ScrollRail, { targetRef: panelRef, resetKey: active2, className: "dtpl-usage-rail" })
        ] })
      ] });
    }
    function ProviderCards({ cards, labels, money: money2, showMoney }) {
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-providers", children: cards.map((card) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ProviderCard, { card, money: money2, labels, showMoney }, card.provider)) });
    }
    function ProviderCard({ card, money: money2, labels, showMoney }) {
      const cardTokens = card.tokens;
      const label = labels[card.provider];
      const subscription = card.models.some((model) => model.billing === "subscription");
      const billingTag = subscription ? "订阅" : "按量";
      const billingTitle = subscription ? "订阅通道：金额是这些用量按官方价折算的订阅价值，不是实际支出" : "按量通道：金额是实际支出口径";
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("article", { className: "dtpl-provider-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("header", { className: "dtpl-provider-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-provider-id", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-provider-title", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-provider-name", children: label ?? card.provider }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "span",
                {
                  className: "dtpl-provider-bill",
                  "data-billing": subscription ? "subscription" : "metered",
                  title: billingTitle,
                  children: billingTag
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-provider-meta", children: [
              label !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-provider-key", children: card.provider }),
                " · "
              ] }),
              card.requests,
              " 请求",
              card.compactions > 0 ? ` · ${card.compactions} 压缩` : "",
              card.usageUnknown > 0 ? ` · ${card.usageUnknown} 次没上报用量` : "",
              card.unpricedModels.length > 0 ? ` · 价格未知 ${card.unpricedModels.join("、")}` : ""
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-provider-nums", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-provider-tokens", children: formatTokens(cardTokens) }),
            showMoney && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-provider-cost", children: [
              !subscription && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-provider-spend", children: money2(card.spend) }),
              card.subscriptionValue > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-provider-value", title: "订阅通道：这些用量按量付费本来要花的钱（非实际扣款）", children: [
                money2(card.subscriptionValue),
                " 订阅价值"
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-provider-models", children: card.models.map((m) => {
          const noPrice = isNoPrice(m.cost, card.unpricedModels.includes(m.model));
          return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-model", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ShareRing, { value: m.tokens, total: cardTokens, denom: "本通道" }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-model-txt", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-model-name", children: m.model }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-model-nums", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-val", children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-sr", children: "词元 " }),
                formatTokens(m.tokens)
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dtpl-provider-model-sub", children: [
                m.totals.requests,
                " 请求",
                showMoney && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
                  " · ",
                  noPrice ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("em", { className: "dtpl-cost-k", children: "价格未知" }) : m.spend > 0 ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-sr", children: "金额 " }),
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("b", { className: "dtpl-cash-amt", children: money2(m.spend) })
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dtpl-sr", children: "金额 " }),
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("b", { className: "dtpl-sub-amt", children: money2(m.subscriptionValue) }),
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("em", { className: "dtpl-cost-k", children: "订阅价值" })
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
        return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-skeleton", "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-sk dtpl-sk-card" }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-sk dtpl-sk-card" }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-sk dtpl-sk-card" })
        ] });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dtpl-skeleton", "aria-hidden": "true", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-sk dtpl-sk-row" }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-sk dtpl-sk-row" }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-sk dtpl-sk-row" }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dtpl-sk dtpl-sk-row" })
      ] });
    }
    
    // src/client/MethodDoc.tsx
    var import_jsx_runtime13 = require("react/jsx-runtime");
    var JUDGE_ROWS = [
      {
        what: "你发问、模型回复",
        detail: "每次模型调用记一次——一轮里模型连着调工具，就会记好几次。",
        requests: { text: "计 1 次", tone: "on" },
        tokens: { text: "四桶累加", tone: "on" }
      },
      {
        what: "对话太长，系统自动压缩上文",
        detail: "这次总结本身也是一次计费调用，所以另记一次「压缩」（可在配置里关掉）。",
        requests: { text: "计 1 次", tone: "on" },
        tokens: { text: "四桶累加", tone: "on" }
      },
      {
        what: "你中途停止，或这次调用没回报用量",
        detail: "厂商可能照常计费，账本却拿不到数字：计入次数，词元记为未知——不按 0 计，金额也因此按 ¥0 计（不是免费）。",
        requests: { text: "计 1 次", tone: "on" },
        tokens: { text: "未知", tone: "unknown" }
      },
      {
        what: "请求失败了（报错、自动重试）",
        detail: "仍留一条失败记录、单独计数，在用量明细里报出「N 失败」；不抬高总量，也不被悄悄丢掉。",
        requests: { text: "不计入", tone: "zero" },
        tokens: { text: "不计入", tone: "zero" }
      }
    ];
    function MethodDoc({ overview }) {
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("section", { className: "dtpl-card dtpl-span-12 dtpl-card-pad dtpl-doc dtpl-doc-head", "aria-label": "统计口径导言", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-lede", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { children: [
              "本插件",
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "不估算" }),
              "：每个数字都来自",
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "本机保存的对话记录" }),
              "——只存在本机，不上传。"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { children: [
              "向模型提问时，通道会回报这次消耗了多少词元。本页记的就是这些回报、逐条累加——",
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "不是" }),
              "模型厂商官网上的账户数据。"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-facts", role: "group", "aria-label": "口径速览", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-fact", children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-fact-k", children: "来源" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-fact-v", children: "本机对话记录，逐条统计" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-fact", children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-fact-k", children: "精度" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-fact-v", children: "单条照实记录，无舍入" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-fact", children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-fact-k", children: "范围" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-fact-v", children: "只记 DeepSeek Harness 的会话记录" })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-glossary", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("dl", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("dt", { children: "通道" }),
                /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("dd", { children: [
                  "你从哪接入、按什么方式付费的那条路；代码与文档里写作 provider，如 ",
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("code", { children: "deepseek-official" }),
                  "、",
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("code", { children: "commandcode" }),
                  "。"
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("dt", { children: "模型厂商" }),
                /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("dd", { children: "做出模型、定官方价的那一方。" })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { children: "同一家公司可以兼任两者（DeepSeek 官方 API），也可以只是通道（Command Code 卖 DeepSeek 模型，但不是 DeepSeek）。" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("section", { className: "dtpl-card dtpl-span-12 dtpl-card-pad dtpl-doc dtpl-doc-sec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("h2", { className: "dtpl-doc-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-idx", children: "1" }),
            "词元分四桶"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { className: "dtpl-doc-sub", children: [
            "厂商按 ",
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "词元（token）" }),
            "计费——可以理解为模型读写的最小文字单位。一次请求的用量被拆成",
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "四类、互不重复" }),
            "，加起来就是「词元合计」："
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-buckets", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Bucket, { name: "未缓存输入", desc: "你发过去、但没命中缓存的文字量。" }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Bucket, { name: "缓存读取", desc: "命中了缓存、不必重新计算的文字量，费率更低。" }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Bucket, { name: "缓存写入", desc: "写入缓存的文字量；多数厂商不上报，多为 0。" }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Bucket, { name: "输出", desc: "模型回复的全部文字（含思考过程）。" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("section", { className: "dtpl-card dtpl-span-12 dtpl-card-pad dtpl-doc dtpl-doc-sec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("h2", { className: "dtpl-doc-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-idx", children: "2" }),
            "记了哪些调用"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { className: "dtpl-doc-sub", children: [
            "按",
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "你会遇到的情况" }),
            "对照，每一行只回答两件事：算不算一次请求、有没有词元可加。"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "dtpl-doc-table-wrap", role: "region", "aria-label": "记了哪些调用", tabIndex: 0, children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("table", { className: "dtpl-doc-judge", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("tr", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { scope: "col", children: "你会遇到的情况" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { scope: "col", children: "请求次数" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { scope: "col", children: "词元用量" })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("tbody", { children: JUDGE_ROWS.map((row) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("tr", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("th", { scope: "row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-judge-what", children: row.what }),
                /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-judge-detail", children: row.detail })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(JudgeChip, { chip: row.requests }) }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(JudgeChip, { chip: row.tokens }) })
            ] }, row.what)) })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { className: "dtpl-doc-judge-note", children: [
            "安装前的旧对话、以及当时漏记的调用，会按原始记录",
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "自动补录" }),
            "，判定口径与上表完全一致。"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("section", { className: "dtpl-card dtpl-span-12 dtpl-card-pad dtpl-doc dtpl-doc-sec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("h2", { className: "dtpl-doc-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-idx", children: "3" }),
            "差额从哪来"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { className: "dtpl-doc-sub", children: [
            "账本与账单对不上，通常不是记错：要么是本账本",
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "没记到" }),
            "的部分，要么是两边的",
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "统计方式" }),
            "本来就不同。"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-gap", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("article", { className: "dtpl-doc-gap-card dtpl-doc-gap-warn", children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("h3", { className: "dtpl-doc-gap-title", children: "账本会比账单少：没记到的" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("ul", { className: "dtpl-doc-gap-list", children: [
                /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "自动生成的会话标题" }),
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-desc", children: "给对话起标题的小请求没有走常规记录通道，本账本拿不到那次用量。会话每有新发言都可能再生成一次，是最大的固定漏项。" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "中途取消" }),
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: "dtpl-doc-gap-item-desc", children: [
                    "文字已经发出去了，厂商可能照常计费，本账本拿不到用量——按上表记为「未知」，并在用量明细的通道卡上单独报出「",
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "N 次没上报用量" }),
                    "」。"
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "最终失败的尝试" }),
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-desc", children: "只计失败次数、不计词元；厂商若照样收费，这里也会对不上。" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "没有收尾的失败尝试" }),
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-desc", children: "流结束时没有产出可见消息、也没有以报错收尾或安排重试。这种尝试可能只在上报流里带了用量，账本拿不到——失败次数与词元都不会记。" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "不走会话记录的调用" }),
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-desc", children: "其它插件或脚本直接调用模型时，本账本同样看不到。" })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { className: "dtpl-doc-gap-sum", children: "同一请求不会重复计数，可以放心反复扫描——但「重新扫描」只能补齐日志里有的调用，补不回这些根本没进日志的。" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("article", { className: "dtpl-doc-gap-card", children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("h3", { className: "dtpl-doc-gap-title", children: "对不上 ≠ 记错：统计方式不同" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("ul", { className: "dtpl-doc-gap-list", children: [
                /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "记账维度不同" }),
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-desc", children: "本账本按「这台设备上的会话」记账，账单按「账号」汇总；同一个账号在多台设备 / 多个工具里使用时，两边必然对不齐。" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "金额是现价刻度" }),
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: "dtpl-doc-gap-item-desc", children: [
                    "按你在价格表页写的",
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "当前价" }),
                    "（¥ 或 $ / 百万词元，美元报价按汇率折成人民币）逐条折算后累加；同一个模型串在不同",
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "通道" }),
                    "可以是不同的价。一份价管全部历史，所以它衡量的是「最近用掉的词元值多少钱」——",
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "不是" }),
                    "当时那笔账单（厂商改过价，历史那几天的金额就按现价重算）。刻度只在够近的窗口里成立：账本页的用量明细只在近 30 天及更短的窗口里给金额，",
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "全部账本" }),
                    "只给词元；会话「词元」页不按窗口切，它按整场会话给金额。"
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-gap-item-name", children: "两个金额桶，不是一笔支出" }),
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: "dtpl-doc-gap-item-desc", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "实际支出" }),
                    "是按量通道按现价折算的钱；",
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "订阅价值" }),
                    "是订阅通道这些用量若按量付费本来要花的钱，",
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "不是现金" }),
                    "。没定价的记录记 ¥0，并列为",
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "价格未知" }),
                    "——不是免费；改价只影响本机账本，不会回写厂商账单。"
                  ] })
                ] })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("section", { className: "dtpl-card dtpl-span-12 dtpl-card-pad dtpl-doc dtpl-doc-sec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("h2", { className: "dtpl-doc-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-idx", children: "4" }),
            "怎么核对"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { className: "dtpl-doc-sub", children: [
            "登录模型厂商的官网（如 DeepSeek 开放平台），",
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "按天导出用量" }),
            "， 与「用量总览」的",
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "近 14 天趋势" }),
            "逐日对比。"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { className: "dtpl-doc-sub", children: "左侧是本账本，右侧是平台导出的字段：" }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-map", role: "region", "aria-label": "本账本与平台导出的字段对应", tabIndex: 0, children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-map-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "未缓存输入" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-map-arrow", children: "↔" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("code", { children: "prompt_cache_miss_tokens" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-map-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "缓存读取" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-map-arrow", children: "↔" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("code", { children: "prompt_cache_hit_tokens" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-map-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "输出" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-map-arrow", children: "↔" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("code", { children: "completion_tokens" })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-notes", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { children: "未缓存输入、缓存读取、输出正好对应平台导出的三个字段。" }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { children: "除第 3 节列的那几类漏项外，应逐日吻合。" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("section", { className: "dtpl-card dtpl-span-12 dtpl-card-pad dtpl-doc dtpl-doc-tail", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-quota", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "总览下方那排「订阅额度」卡" }),
              "用的是",
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "另一套数据" }),
              "。"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { children: [
              "它们用你的账号凭据直接向厂商查询",
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: "账户级官方用量" }),
              "（含你在其它设备上的消费），与本页的本机账本刻意不混用。"
            ] })
          ] }),
          overview !== null && overview.dataDir !== "" && /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-data", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { className: "dtpl-doc-data-line", children: [
              "账本里已有 ",
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: overview.records }),
              " 条记录，最近一次在 ",
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("b", { children: overview.lastEventAt === null ? "—" : formatDateTime(overview.lastEventAt) }),
              "。"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { className: "dtpl-doc-data-dir", children: [
              "数据目录：",
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("code", { children: overview.dataDir })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { className: "dtpl-doc-foot", children: "以上口径基于当前 DSH 版本源码核对。" })
        ] })
      ] });
    }
    function JudgeChip({ chip }) {
      const tone = chip.tone === "on" ? "" : ` dtpl-doc-chip-${chip.tone}`;
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: `dtpl-doc-chip${tone}`, children: chip.text });
    }
    function Bucket({ name, desc }) {
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dtpl-doc-bucket", children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-bucket-name", children: name }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "dtpl-doc-bucket-desc", children: desc })
      ] });
    }
    
    // src/client/TokBookPanel.tsx
    var import_jsx_runtime14 = require("react/jsx-runtime");
    var SYNC_FOLLOW_INTERVAL_MS = 500;
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
    var TAB_IDS = ["ledger", "pricing", "method"];
    function describeScanResult(result) {
      const added = result.added === 0 ? "扫描没有新记录" : `扫描补上 ${result.added} 条记录`;
      return result.failedSessions === 0 ? added : `${added}，${result.failedSessions} 个会话读取失败`;
    }
    function TokBookPanel({ view }) {
      const { overview, error, pricingDirty } = (0, import_react8.useSyncExternalStore)(view.subscribe, view.getSnapshot);
      const [tab, setTab] = (0, import_react8.useState)("ledger");
      const [sync, setSync] = (0, import_react8.useState)(null);
      const [scanResult, setScanResult] = (0, import_react8.useState)(null);
      const [scanNotice, setScanNotice] = (0, import_react8.useState)(null);
      const lastOverviewAt = (0, import_react8.useRef)(0);
      const visibleTab = (0, import_react8.useRef)("ledger");
      const followRun = (0, import_react8.useRef)(0);
      const busy = sync?.status === "running";
      const busyRef = (0, import_react8.useRef)(busy);
      (0, import_react8.useEffect)(() => {
        busyRef.current = busy;
      }, [busy]);
      const fetchOverview = (0, import_react8.useCallback)((signal) => {
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
      const probeSync = (0, import_react8.useCallback)((signal) => {
        return fetch(ROUTE_SYNC, { signal }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }).catch(() => null).then((state) => {
          if (state === null || signal?.aborted === true) return null;
          setSync(state);
          return state;
        });
      }, []);
      const refresh = (0, import_react8.useCallback)(async (signal) => {
        await fetchOverview(signal);
        if (signal?.aborted === true) return null;
        return probeSync(signal);
      }, [fetchOverview, probeSync]);
      (0, import_react8.useEffect)(() => {
        const controller = new AbortController();
        void refresh(controller.signal);
        return () => {
          controller.abort();
        };
      }, [refresh]);
      (0, import_react8.useEffect)(() => {
        if (!busy) return;
        const run = followRun.current + 1;
        followRun.current = run;
        const stopped = () => followRun.current !== run;
        setScanResult(null);
        setScanNotice(null);
        void (async () => {
          while (!stopped()) {
            await new Promise((resolve) => setTimeout(resolve, SYNC_FOLLOW_INTERVAL_MS));
            if (stopped()) return;
            const state = await probeSync();
            if (state === null) continue;
            if (state.status === "running") continue;
            setScanResult(state.lastResult ?? null);
            const next = await refresh();
            if (next?.status === "running") continue;
            return;
          }
        })();
        return () => {
          if (followRun.current === run) followRun.current += 1;
        };
      }, [busy, probeSync, refresh]);
      (0, import_react8.useEffect)(() => {
        const unsubscribe = subscribeLedgerChanges(() => {
          if (visibleTab.current !== "ledger") return;
          if (busyRef.current) return;
          if (Date.now() - lastOverviewAt.current < OVERVIEW_REFRESH_MIN_GAP_MS) return;
          void refresh();
        });
        return unsubscribe;
      }, [refresh]);
      const onVisibleTab = (0, import_react8.useCallback)((next) => {
        setTab(next);
        const previous = visibleTab.current;
        visibleTab.current = next;
        if (next !== "ledger" || previous === "ledger") return;
        if (busyRef.current) return;
        if (Date.now() - lastOverviewAt.current < OVERVIEW_REFRESH_MIN_GAP_MS) return;
        void refresh();
      }, [refresh]);
      const onRescan = (0, import_react8.useCallback)(async () => {
        setScanNotice(null);
        setScanResult(null);
        try {
          const started = await fetch(ROUTE_RESCAN, { method: "POST" }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          }).then((body) => body.status !== "skipped");
          const state = await probeSync();
          if (state?.status === "running") return;
          if (!started) setScanNotice("扫描没有启动，请稍后再试");
          setScanResult(state?.lastResult ?? null);
          await refresh();
        } catch (err) {
          view.setError(err instanceof Error ? err.message : String(err));
        }
      }, [probeSync, refresh, view]);
      const syncFailure = sync?.status === "error" ? sync.error ?? "原因不明" : null;
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dtpl-page", "data-plugin": "dsh-tokbook", "data-tab": tab, children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        TokBookPage,
        {
          tab,
          overview,
          error,
          busy,
          syncFailure,
          scanResult,
          scanNotice,
          pricingDirty,
          onDirtyChange: view.setPricingDirty,
          onRescan,
          onRetry: () => {
            view.setError(null);
            void refresh();
          },
          onRefresh: () => {
            void refresh();
          },
          onVisibleTab
        }
      ) });
    }
    function LedgerHeadMeta({ overview }) {
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dtpl-head-meta", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
        "账本 ",
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("b", { children: overview.records }),
        " 条"
      ] }) });
    }
    function TokBookPage({ tab, overview, error, busy, syncFailure, scanResult, scanNotice, pricingDirty, onDirtyChange, onRescan, onRetry, onRefresh, onVisibleTab }) {
      const bodyRef = (0, import_react8.useRef)(null);
      const selectTab = (0, import_react8.useCallback)((next) => {
        onVisibleTab(next);
      }, [onVisibleTab]);
      (0, import_react8.useEffect)(() => {
        bodyRef.current?.scrollTo(0, 0);
      }, [tab]);
      const onTablistKeyDown = (0, import_react8.useCallback)((e) => {
        const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (delta === 0) return;
        e.preventDefault();
        const next = TAB_IDS[(TAB_IDS.indexOf(tab) + delta + TAB_IDS.length) % TAB_IDS.length];
        selectTab(next);
        document.getElementById(`dtpl-tab-${next}`)?.focus();
      }, [tab, selectTab]);
      const failedText = busy ? null : syncFailure !== null ? `扫描失败：${syncFailure}` : scanNotice;
      const footText = busy ? "正在扫描记录…" : failedText ?? [
        overview !== null && overview.lastEventAt !== null ? `数据截至 ${formatRelative(overview.lastEventAt)}` : "",
        scanResult !== null ? describeScanResult(scanResult) : ""
      ].filter((part) => part !== "").join(" · ");
      const footTitle = busy || failedText !== null ? "" : [
        overview !== null && overview.lastEventAt !== null ? `最新记录 ${formatDateTime(overview.lastEventAt)}` : "",
        scanResult !== null ? `扫描完成于 ${formatDateTime(scanResult.at)}` : ""
      ].filter((part) => part !== "").join("；");
      const footTone = busy ? " dtpl-sync-running" : failedText !== null ? " dtpl-sync-error" : "";
      const emptyLedger = overview !== null && overview.records === 0;
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_jsx_runtime14.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("header", { className: "dtpl-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("h1", { className: "dtpl-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "dtpl-title-ico-chip", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(UsageGlyph, { className: "dtpl-title-ico" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: "词元账本" })
          ] }),
          tab === "ledger" && overview !== null && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(LedgerHeadMeta, { overview })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dtpl-tabs", role: "tablist", "aria-label": "账本视图", onKeyDown: onTablistKeyDown, children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
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
          /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
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
                pricingDirty && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("i", { className: "dtpl-tab-dot", role: "img", "aria-label": "有未保存的改动", title: "有未保存的改动" })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
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
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dtpl-body-wrap", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
            "div",
            {
              ref: bodyRef,
              className: "dtpl-body",
              role: "tabpanel",
              id: "dtpl-panel",
              "aria-labelledby": `dtpl-tab-${tab}`,
              children: tab === "method" ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dtpl-grid dtpl-grid-doc", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(MethodDoc, { overview }) }) : tab === "pricing" ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dtpl-grid", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
                PricingPanel,
                {
                  onChanged: onRefresh,
                  onDirtyChange
                }
              ) }) : /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dtpl-grid", children: [
                error !== null && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dtpl-error dtpl-span-12", role: "alert", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("p", { className: "dtpl-error-text", children: [
                    "加载失败：",
                    error
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", className: "dtpl-retry", onClick: onRetry, children: "重试" })
                ] }),
                overview === null ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(LedgerSkeleton, {}) : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
                  LedgerView,
                  {
                    overview,
                    busy,
                    retry: failedText !== null,
                    onRescan,
                    quota: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(QuotaSection, {})
                  }
                ),
                !(overview !== null && overview.records === 0) && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(ProviderPanel, {})
              ] })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(ScrollRail, { targetRef: bodyRef, resetKey: tab })
        ] }),
        overview !== null && tab === "ledger" && (!emptyLedger || footText !== "") && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("footer", { className: "dtpl-foot", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: `dtpl-sync${footTone}`, role: "status", "aria-live": "polite", children: [
            footTone === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("i", { className: "dtpl-sync-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "dtpl-sync-text", title: footTitle === "" ? void 0 : footTitle, children: footText })
          ] }),
          !emptyLedger && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(RescanButton, { busy, retry: failedText !== null, onRescan })
        ] })
      ] });
    }
    
    // src/client/TokBookPanelIcon.tsx
    var import_react9 = require("react");
    var import_jsx_runtime15 = require("react/jsx-runtime");
    function TokBookPanelIcon({ size, view }) {
      const { quotaAlert } = (0, import_react9.useSyncExternalStore)(view.subscribe, view.getSnapshot);
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "dtpl-nav-ico-wrap", style: { width: size, height: size }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(UsageGlyph, { className: "dtpl-nav-ico" }),
        quotaAlert && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "i",
          {
            className: "dtpl-nav-alert",
            role: "img",
            "aria-label": "订阅额度告急",
            title: "最近一次查询的订阅额度已接近或超过窗口上限"
          }
        )
      ] });
    }
    
    // src/client/SessionTokensEntry.tsx
    var import_react11 = require("react");
    
    // src/client/dial.tsx
    var import_jsx_runtime16 = require("react/jsx-runtime");
    var DIAL = 108;
    var RING_RADIUS = 42;
    var RING_STROKE = 9;
    var SEGMENT_GAP = 2;
    var SEGMENT_MIN = 3;
    var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
    function arcLengths(values, usable) {
      const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
      if (!(total > 0) || !(usable > 0)) return values.map(() => 0);
      const raw = values.map((value) => Math.max(0, value) / total * usable);
      const pinned = raw.map((arc) => arc < SEGMENT_MIN);
      const fixed2 = pinned.reduce((sum, isPinned) => sum + (isPinned ? SEGMENT_MIN : 0), 0);
      const flexible = raw.reduce((sum, arc, index) => sum + (pinned[index] ? 0 : arc), 0);
      const rest = usable - fixed2;
      if (!(flexible > 0) || rest <= 0) return values.map(() => SEGMENT_MIN);
      return raw.map((arc, index) => pinned[index] ? SEGMENT_MIN : arc / flexible * rest);
    }
    function polar(cx, cy, radius, angle) {
      const radians = (angle - 90) * Math.PI / 180;
      return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
    }
    function arcPath(cx, cy, radius, startAngle, endAngle) {
      const start = polar(cx, cy, radius, endAngle);
      const end = polar(cx, cy, radius, startAngle);
      const large = endAngle - startAngle <= 180 ? 0 : 1;
      return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${String(radius)} ${String(radius)} 0 ${String(large)} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
    }
    function Dial({ title, segments, defs, center }) {
      const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
      const arcs = total > 0 ? arcLengths(segments.map((segment) => segment.value), RING_CIRCUMFERENCE - segments.length * SEGMENT_GAP) : [];
      let cursor = 0;
      return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { className: "dtpl-dial", title, children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
          "svg",
          {
            className: "dtpl-dial-ring",
            viewBox: `0 0 ${String(DIAL)} ${String(DIAL)}`,
            width: DIAL,
            height: DIAL,
            "aria-hidden": "true",
            focusable: "false",
            children: [
              defs !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("defs", { children: defs }),
              /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
                "circle",
                {
                  className: "dtpl-dial-ring-track",
                  cx: DIAL / 2,
                  cy: DIAL / 2,
                  r: RING_RADIUS,
                  strokeWidth: RING_STROKE
                }
              ),
              segments.map((segment, index) => {
                const arc = arcs[index] ?? 0;
                const start = cursor;
                cursor += arc + SEGMENT_GAP;
                return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
                  "path",
                  {
                    className: "dtpl-dial-ring-seg",
                    d: arcPath(DIAL / 2, DIAL / 2, RING_RADIUS, start / RING_CIRCUMFERENCE * 360, (start + arc) / RING_CIRCUMFERENCE * 360),
                    strokeWidth: RING_STROKE,
                    stroke: segment.fill
                  },
                  segment.key
                );
              })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "dtpl-dial-val", children: center })
      ] });
    }
    function DialFigure({ text }) {
      const parts = text.split(/(\d+(?:\.\d+)?)/).filter((part) => part !== "");
      return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "dtpl-dial-figure", children: parts.map((part, index) => /^\d/.test(part) ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("b", { children: part }, `${part}-${String(index)}`) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: part }, `${part}-${String(index)}`)) });
    }
    
    // src/client/SessionOverlay.tsx
    var import_react10 = require("react");
    
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
        providerLabels: readLabels(source.providerLabels)
      };
    }
    function readLabels(raw) {
      if (typeof raw !== "object" || raw === null) return void 0;
      const labels = {};
      for (const [route, label] of Object.entries(raw)) {
        if (route !== "" && typeof label === "string" && label !== "") labels[route] = label;
      }
      return Object.keys(labels).length === 0 ? void 0 : labels;
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
    
    // src/client/SessionOverlay.tsx
    var import_jsx_runtime17 = require("react/jsx-runtime");
    var POLL_MS = 15e3;
    var PANEL_GAP = 6;
    var VIEW_MARGIN = 8;
    function routeWord(provider, labels) {
      if (provider === "") return "通道未知";
      return labels[provider] ?? provider;
    }
    function modelPairOf(row, labels) {
      return `${routeWord(row.provider, labels)} / ${row.model === "" ? "模型未知" : row.model}`;
    }
    function modelLabelOf(rows, labels) {
      const pairs = /* @__PURE__ */ new Set();
      for (const row of rows) pairs.add(modelPairOf(row, labels));
      if (pairs.size === 0) return { text: "模型未知", count: 0, title: "" };
      const [first] = pairs;
      if (pairs.size === 1) return { text: first, count: 1, title: first };
      return { text: first, count: pairs.size, title: [...pairs].join(" · ") };
    }
    function placePanel(panel, trigger) {
      const anchor = trigger.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const right = Math.min(
        Math.max(VIEW_MARGIN, window.innerWidth - anchor.right),
        Math.max(VIEW_MARGIN, window.innerWidth - width - VIEW_MARGIN)
      );
      const below = anchor.bottom + PANEL_GAP;
      const above = anchor.top - PANEL_GAP - height;
      const top = below + height <= window.innerHeight - VIEW_MARGIN || above < VIEW_MARGIN ? Math.min(below, Math.max(VIEW_MARGIN, window.innerHeight - VIEW_MARGIN - height)) : above;
      panel.style.top = `${String(Math.round(top))}px`;
      panel.style.right = `${String(Math.round(right))}px`;
      panel.style.left = "auto";
      panel.style.bottom = "auto";
    }
    function SessionOverlay({
      sessionId,
      triggerTitle,
      triggerLabel,
      triggerIcon,
      panelTitle,
      panelLabel,
      emptyText,
      footnote,
      skeletonClass,
      cards
    }) {
      const [open, setOpen] = (0, import_react10.useState)(false);
      const [view, setView] = (0, import_react10.useState)(null);
      const [error, setError] = (0, import_react10.useState)(null);
      const [reload, setReload] = (0, import_react10.useState)(0);
      const triggerRef = (0, import_react10.useRef)(null);
      const panelRef = (0, import_react10.useRef)(null);
      const panelId = `dtpl-ov-${(0, import_react10.useId)().replaceAll(":", "")}`;
      const close = (0, import_react10.useCallback)((restoreFocus) => {
        setOpen(false);
        if (restoreFocus) triggerRef.current?.focus();
      }, []);
      (0, import_react10.useEffect)(() => {
        if (!open || sessionId === void 0 || sessionId === "") return;
        const controller = new AbortController();
        const url = `${ROUTE_SESSION}?${QUERY_SESSION}=${encodeURIComponent(sessionId)}`;
        let pending = false;
        const load = () => {
          if (pending || document.hidden) return;
          pending = true;
          fetch(url, { signal: controller.signal }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          }).then((raw) => {
            if (controller.signal.aborted) return;
            const next = readSessionView(raw);
            if (next === null) {
              setError("响应不是一份会话视图");
              return;
            }
            setView(next);
            setError(null);
          }).catch((err) => {
            if (controller.signal.aborted) return;
            setError(err instanceof Error ? err.message : String(err));
          }).finally(() => {
            pending = false;
          });
        };
        load();
        const unsubscribe = subscribeLedgerChanges(load);
        const timer2 = setInterval(() => {
          if (!ledgerClockSupported()) load();
        }, POLL_MS);
        return () => {
          controller.abort();
          unsubscribe();
          clearInterval(timer2);
        };
      }, [open, sessionId, reload]);
      (0, import_react10.useLayoutEffect)(() => {
        if (!open || sessionId === void 0 || sessionId === "") return;
        const panel = panelRef.current;
        const trigger = triggerRef.current;
        if (panel === null || trigger === null) return;
        panel.setAttribute("popover", "manual");
        try {
          panel.showPopover();
        } catch {
        }
        placePanel(panel, trigger);
        const onResize = () => {
          placePanel(panel, trigger);
        };
        window.addEventListener("resize", onResize);
        return () => {
          window.removeEventListener("resize", onResize);
          try {
            panel.hidePopover();
          } catch {
          }
        };
      }, [open, sessionId]);
      (0, import_react10.useEffect)(() => {
        if (!open || sessionId === void 0 || sessionId === "") return;
        panelRef.current?.focus();
        const onPointerDown = (event) => {
          const target = event.target;
          if (!(target instanceof Node)) return;
          if (panelRef.current?.contains(target) === true) return;
          if (triggerRef.current?.contains(target) === true) return;
          close(false);
        };
        const onKeyDown = (event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          close(true);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
          document.removeEventListener("pointerdown", onPointerDown);
          document.removeEventListener("keydown", onKeyDown);
        };
      }, [open, close, sessionId]);
      if (sessionId === void 0 || sessionId === "") return null;
      const current = view !== null && view.sessionId === sessionId ? view : null;
      const list = current === null ? [] : cards(current);
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dtpl-ov-root", "data-plugin": "dsh-tokbook", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
          "button",
          {
            ref: triggerRef,
            type: "button",
            className: "dtpl-tok-entry",
            "data-plugin": "dsh-tokbook",
            title: triggerTitle,
            "aria-haspopup": "dialog",
            "aria-expanded": open,
            "aria-controls": panelId,
            onClick: () => setOpen((value) => !value),
            children: [
              triggerIcon,
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-tok-entry-label", children: triggerLabel })
            ]
          }
        ),
        open && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
          "div",
          {
            ref: panelRef,
            id: panelId,
            className: "dtpl-ov-panel",
            role: "dialog",
            "aria-label": panelLabel,
            tabIndex: -1,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dtpl-ov-head", children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-ov-title", children: panelTitle }),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-ov-sum", children: current !== null ? `共 ${String(list.length)} 轮` : error === null ? "读取中" : "读取失败" })
              ] }),
              current === null ? error === null ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "dtpl-ov-list", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: skeletonClass === void 0 ? "dtpl-ov-sk" : `dtpl-ov-sk ${skeletonClass}` }) }) : /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dtpl-ov-list", children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("p", { className: "dtpl-ov-error", children: [
                  "读取失败：",
                  error
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("button", { type: "button", className: "dtpl-ov-retry", onClick: () => setReload((value) => value + 1), children: "重试" })
              ] }) : list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "dtpl-ov-list", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("p", { className: "dtpl-ov-empty", children: emptyText }) }) : /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "dtpl-ov-list", children: list.map((card) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("article", { className: "dtpl-ov-card", children: [
                card.leading,
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dtpl-ov-body", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dtpl-ov-card-head", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-ov-card-k", children: [
                      "第 ",
                      String(card.turn),
                      " 轮"
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-ov-card-meta", title: card.meta, children: card.meta })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-ov-card-route", title: card.model.title === "" ? void 0 : card.model.title, children: [
                    card.model.text,
                    card.model.count > 1 && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "dtpl-sr", children: [
                      "；全部：",
                      card.model.title
                    ] })
                  ] }),
                  card.body
                ] })
              ] }, card.key)) }),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "dtpl-ov-foot", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dtpl-ov-note", children: footnote }) })
            ]
          }
        )
      ] });
    }
    
    // src/client/SessionTokensEntry.tsx
    var import_jsx_runtime18 = require("react/jsx-runtime");
    var BUCKETS = [
      { key: "inputTokens", label: "未缓存输入", kind: "input" },
      { key: "cacheReadTokens", label: "缓存读取", kind: "cache-read" },
      { key: "cacheWriteTokens", label: "缓存写入", kind: "cache-write" },
      { key: "outputTokens", label: "输出", kind: "output" }
    ];
    function tokenSegments(totals) {
      return BUCKETS.filter((bucket) => totals[bucket.key] > 0);
    }
    function TokenDial({ tokens, totals }) {
      const fillKey = `dtpl-ttk-${(0, import_react11.useId)().replaceAll(":", "")}`;
      const segments = tokens === void 0 ? [] : tokenSegments(totals);
      const breakdown = BUCKETS.map((bucket) => `${bucket.label} ${formatTokens(totals[bucket.key])}`).join(" · ");
      return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        Dial,
        {
          title: tokens === void 0 ? "用量未知：这一轮的计费调用都没有上报词元" : `词元合计：${formatTokens(tokens)}（${breakdown}）`,
          segments: segments.map((bucket) => ({
            key: bucket.key,
            value: totals[bucket.key],
            fill: bucket.kind === "output" ? "currentColor" : `url(#${fillKey}-${bucket.kind})`
          })),
          defs: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("pattern", { id: `${fillKey}-input`, width: "4", height: "4", patternUnits: "userSpaceOnUse", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("rect", { width: "4", height: "4", fill: "currentColor", fillOpacity: "0.52" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("rect", { width: "1.5", height: "4", fill: "currentColor", fillOpacity: "0.66" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("pattern", { id: `${fillKey}-cache-read`, width: "6", height: "6", patternUnits: "userSpaceOnUse", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("rect", { width: "6", height: "6", fill: "currentColor", fillOpacity: "0.72" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("rect", { width: "6", height: "1.5", fill: "currentColor", fillOpacity: "0.88" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("pattern", { id: `${fillKey}-cache-write`, width: "6", height: "6", patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("rect", { width: "6", height: "6", fill: "currentColor", fillOpacity: "0.72" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("rect", { width: "1.5", height: "6", fill: "currentColor", fillOpacity: "0.88" })
            ] })
          ] }),
          center: tokens === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "dtpl-dial-note", children: "用量未知" }) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(DialFigure, { text: formatTokens(tokens) })
        }
      );
    }
    function TokenLedger({ totals }) {
      const total = totalsTokens(totals);
      return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "dtpl-ttk-buckets", children: BUCKETS.map((bucket) => /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "dtpl-ttk-bucket", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "dtpl-tok-read-mark", "data-kind": bucket.kind, "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "dtpl-ttk-bucket-name", children: bucket.label }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("b", { className: "dtpl-ttk-bucket-value", children: formatTokens(totals[bucket.key]) }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "dtpl-ttk-bucket-share", children: formatShare(totals[bucket.key], total) })
      ] }, bucket.key)) });
    }
    function tokenCards(view) {
      const labels = view.providerLabels ?? {};
      const cards = [];
      for (const group of view.turns) {
        if (group.turn === null) continue;
        const totals = group.totals;
        const unknown = totals.usageUnknown ?? 0;
        const failed = totals.failures ?? 0;
        const tokens = group.rows.some((row) => row.usage !== void 0) ? totalsTokens(totals) : void 0;
        const model = modelLabelOf(group.rows, labels);
        cards.push({
          key: `turn:${String(group.turn)}`,
          turn: group.turn,
          meta: `${String(group.rows.length)} 步${unknown === 0 ? "" : ` · ${String(unknown)} 步用量未知`}${failed === 0 ? "" : ` · 含 ${String(failed)} 次失败`}${model.count > 1 ? ` · ${String(model.count)} 个模型` : ""}`,
          model,
          leading: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(TokenDial, { tokens, totals }),
          body: tokens === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("p", { className: "dtpl-ov-gap", children: "用量未知：这一轮的计费调用都没有上报词元。" }) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(TokenLedger, { totals })
        });
      }
      return cards.reverse();
    }
    function SessionTokensEntry({ sessionId }) {
      return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        SessionOverlay,
        {
          sessionId,
          triggerTitle: "查看本会话每轮词元",
          triggerLabel: "词元",
          triggerIcon: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(UsageGlyph, { className: "dtpl-tok-entry-ico" }),
          panelTitle: "每轮词元",
          panelLabel: "每轮词元",
          emptyText: "这个会话还没有可归属轮次的计费调用。",
          footnote: "只计上报用量的步 · 最新在前 · 不含轮间/轮次未知/子代理",
          skeletonClass: "dtpl-ttk-sk",
          cards: tokenCards
        }
      );
    }
    
    // src/client/session-timing.tsx
    var import_react12 = require("react");
    var import_jsx_runtime19 = require("react/jsx-runtime");
    var PHASE_LABEL = {
      wait: "等首 token",
      generate: "生成",
      model: "模型·拆不开",
      tool: "工具"
    };
    function phaseFill(kind, key) {
      if (kind === "generate") return "currentColor";
      return `url(#${key}-${kind})`;
    }
    function TimeDial({ workMs, segments }) {
      const fillKey = `dtpl-dur-${(0, import_react12.useId)().replaceAll(":", "")}`;
      return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
        Dial,
        {
          title: workMs === void 0 ? "未计时：没有量到模型与工具的起止事件" : `引擎工作（模型用时 + 工具用时）：${formatDuration(workMs)}`,
          segments: segments.map((segment) => ({
            key: segment.key,
            value: segment.value,
            fill: phaseFill(segment.kind, fillKey)
          })),
          defs: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_jsx_runtime19.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("pattern", { id: `${fillKey}-wait`, width: "4", height: "4", patternUnits: "userSpaceOnUse", children: [
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("rect", { width: "4", height: "4", fill: "currentColor", fillOpacity: "0.52" }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("rect", { width: "1.5", height: "4", fill: "currentColor", fillOpacity: "0.66" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("pattern", { id: `${fillKey}-tool`, width: "6", height: "6", patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)", children: [
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("rect", { width: "6", height: "6", fill: "currentColor", fillOpacity: "0.72" }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("rect", { width: "1.5", height: "6", fill: "currentColor", fillOpacity: "0.88" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("pattern", { id: `${fillKey}-model`, width: "5", height: "5", patternUnits: "userSpaceOnUse", children: [
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("rect", { width: "5", height: "5", fill: "currentColor", fillOpacity: "0.55" }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("rect", { width: "1.5", height: "5", fill: "currentColor" }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("path", { d: "M0 5L5 0", stroke: "currentColor", strokeWidth: "1.5" })
            ] })
          ] }),
          center: workMs === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-dial-note", children: "未计时" }) : /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(DialFigure, { text: formatDuration(workMs) })
        }
      );
    }
    function PhaseLedger({ segments }) {
      const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
      return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-dur-phases", children: segments.map((segment) => /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { className: "dtpl-dur-phase", children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-tok-read-mark", "data-kind": segment.kind, "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-dur-phase-name", title: PHASE_LABEL[segment.kind], children: PHASE_LABEL[segment.kind] }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("b", { className: "dtpl-dur-phase-value", children: formatDuration(segment.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "dtpl-dur-phase-share", children: formatShare(segment.value, total) })
      ] }, segment.key)) });
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
    
    // src/client/SessionTimingEntry.tsx
    var import_jsx_runtime20 = require("react/jsx-runtime");
    function workOf(rows) {
      if (!rows.some((row) => row.timing !== void 0)) return void 0;
      const { llmMs, toolMs } = settleTiming(rows);
      return llmMs + toolMs;
    }
    function timingCards(view) {
      const labels = view.providerLabels ?? {};
      const cards = [];
      for (const group of view.turns) {
        if (group.turn === null) continue;
        const untimed = group.rows.filter((row) => row.timing?.llmMs === void 0).length;
        const workMs = workOf(group.rows);
        const phases = sumSegments(group.rows);
        const model = modelLabelOf(group.rows, labels);
        cards.push({
          key: `turn:${String(group.turn)}`,
          turn: group.turn,
          meta: `${String(group.rows.length)} 步${untimed === 0 ? "" : ` · ${String(untimed)} 步未计时`}${model.count > 1 ? ` · ${String(model.count)} 个模型` : ""}`,
          model,
          leading: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(TimeDial, { workMs, segments: phases }),
          body: workMs === void 0 ? null : phases.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PhaseLedger, { segments: phases }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { className: "dtpl-ov-gap", children: "拆不开：这一轮没有量到模型与工具的起止事件。" })
        });
      }
      return cards.reverse();
    }
    function SessionTimingEntry({ sessionId }) {
      return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        SessionOverlay,
        {
          sessionId,
          triggerTitle: "查看本会话每轮耗时",
          triggerLabel: "耗时",
          triggerIcon: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(ClockGlyph, { className: "dtpl-tok-entry-ico" }),
          panelTitle: "每轮耗时",
          panelLabel: "每轮耗时",
          emptyText: "这个会话还没有可归属轮次的计费调用。",
          footnote: "本机墙钟 · 最新在前 · 不含轮间/轮次未知/子代理",
          cards: timingCards
        }
      );
    }
    
    // src/client/SessionHeaderEntries.tsx
    var import_jsx_runtime21 = require("react/jsx-runtime");
    function SessionHeaderEntries({ sessionId }) {
      if (sessionId === void 0 || sessionId === "") return null;
      return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "dtpl-ov-group", "data-plugin": "dsh-tokbook", children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(SessionTokensEntry, { sessionId }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(SessionTimingEntry, { sessionId })
      ] });
    }
    
    // src/client/index.ts
    var inject = ["slots"];
    var PANEL_ID = "tokbook";
    var PANEL_ENTRY_ORDER = 30;
    var SESSION_ENTRY_ORDER = -4;
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
      ctx.slots.inject("main", () => ctx.slots.register({
        name: "main",
        key: PANEL_ID,
        inject: () => ({ view })
      }, TokBookPanel));
      ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
        name: "sidebar.panellist",
        id: PANEL_ID,
        order: PANEL_ENTRY_ORDER,
        label: "词元账本",
        inject: () => ({ view })
      }, TokBookPanelIcon));
      ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
        name: "conversation.session.header.utilities",
        id: "tokbook-session",
        order: SESSION_ENTRY_ORDER
      }, SessionHeaderEntries));
      void refreshQuotaAlert(view);
      const poll = setInterval(() => {
        void refreshQuotaAlert(view);
      }, QUOTA_ALERT_POLL_MS);
      ctx.effect(() => () => {
        clearInterval(poll);
      });
    }
    
    return module.exports;
  },
});
