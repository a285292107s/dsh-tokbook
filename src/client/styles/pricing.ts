export const CSS_PRICING = `

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
  padding-block:12px 14px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-controls .dtpl-price-pick{
  border-bottom:0;padding-bottom:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick{
  display:grid;grid-template-columns:minmax(0,1fr) minmax(0,360px);
  align-items:start;column-gap:28px;row-gap:8px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-main{grid-column:1;}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-tools{
  display:flex;align-items:center;justify-content:flex-end;gap:6px 20px;flex-wrap:wrap;
  min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-rate{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;
}
@container (max-width:980px){
  [data-plugin="dsh-tokbook"] .dtpl-price-pick{grid-template-columns:minmax(0,1fr);}
  [data-plugin="dsh-tokbook"] .dtpl-price-pick-tools{grid-column:1;justify-content:flex-start;}
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-main{
  display:grid;grid-template-columns:fit-content(42%) 34px minmax(0,1fr);
  align-items:stretch;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-cell{
  position:relative;display:flex;flex-direction:column;justify-content:center;gap:2px;
  min-width:0;padding:4px 20px 4px 0;
  transition:background-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-cell:hover{background:var(--dtpl-wash-hover);}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-cell:focus-within{
  background:var(--dtpl-wash-on);outline:2px solid var(--dtpl-focus);outline-offset:-2px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-name{
  display:inline-flex;align-items:center;gap:9px;align-self:flex-start;
  max-width:100%;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-caret{
  flex:none;width:0;height:0;margin-top:1px;
  border-left:4px solid transparent;border-right:4px solid transparent;
  border-top:5px solid var(--dtpl-fg-3);
  transition:border-top-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-cell:hover .dtpl-price-pick-caret{border-top-color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-sel{
  position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;
  appearance:none;background:transparent;opacity:0;cursor:pointer;font:inherit;
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-k{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);letter-spacing:.16em;
  font-weight:600;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-v{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:20px;line-height:26px;font-weight:600;letter-spacing:.01em;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-cell[data-kind="model"] .dtpl-price-pick-v{
  font-family:var(--dtpl-mono);font-size:20px;font-weight:500;letter-spacing:-.015em;
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-meta{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-arrow{
  align-self:center;margin-top:-2px;
  display:flex;align-items:center;justify-content:center;
  font-size:22px;line-height:1;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-state{display:flex;justify-content:flex-end;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-board > *{align-self:start;}
[data-plugin="dsh-tokbook"] .dtpl-price-board{row-gap:12px;}
[data-plugin="dsh-tokbook"] .dtpl-price-state-row{
  display:flex;align-items:center;justify-content:flex-end;gap:4px;flex-wrap:wrap;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx{
  display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx-eq,
[data-plugin="dsh-tokbook"] .dtpl-price-fx-unit{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in{
  width:62px;height:26px;flex:none;padding:0 5px;text-align:right;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);
  transition:border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint),background-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in:focus{border-color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in[aria-invalid="true"]{border-color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-price-fx-note{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
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

[data-plugin="dsh-tokbook"] .dtpl-price-meter{
  position:relative;overflow:hidden;min-width:0;
  display:flex;flex-direction:column;gap:18px;
  padding:18px 22px 20px;
  background:var(--dtpl-price-sheet);
  box-shadow:inset 0 0 0 1px var(--dtpl-hairline),inset 0 3px 0 var(--dtpl-brand),var(--dtpl-sheen);
  container-type:inline-size;
}
[data-plugin="dsh-tokbook"] .dtpl-price-meter .dtpl-price-day{
  padding-top:12px;border-top:1px solid color-mix(in srgb,var(--dtpl-fg) 12%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-console{
  display:flex;flex-direction:column;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-console-edit{min-width:0;overflow-x:auto;padding-top:2px;}
[data-plugin="dsh-tokbook"] .dtpl-price-console-edit .dtpl-price-cols,
[data-plugin="dsh-tokbook"] .dtpl-price-console-edit .dtpl-price-row{
  grid-template-columns:minmax(200px,360px) repeat(4,minmax(96px,1fr));
}
[data-plugin="dsh-tokbook"] .dtpl-price-stage{padding-block:18px 20px;}

[data-plugin="dsh-tokbook"] .dtpl-price-live{
  display:flex;flex-direction:column;gap:14px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-head{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-k{
  display:inline-flex;align-items:center;gap:8px;flex:none;
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;letter-spacing:.01em;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-k::before{
  content:"";flex:none;width:7px;height:15px;
  background:var(--dtpl-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-mode{
  display:inline-flex;align-items:center;flex:none;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;
  padding:1px 7px;border-radius:var(--dtpl-radius);
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-mode[data-mode="slot"]{
  color:var(--dtpl-card);background:var(--dtpl-fg);
  border-color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-why{
  flex:0 1 auto;min-width:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-unit{
  margin-left:auto;flex:none;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-cells{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-cell{
  display:flex;flex-direction:column;gap:6px;min-width:0;
  padding:2px 18px 0;border-left:1px solid color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-cell:first-child{padding-left:0;border-left:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-live-label{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);letter-spacing:.02em;
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-v{
  font-family:var(--dtpl-mono);font-size:clamp(34px,6.4cqi,64px);line-height:.98;font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;letter-spacing:-.035em;
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-cell[data-bad="true"] .dtpl-price-live-v{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-price-live-none{
  margin:0;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg-2);
}
@container (max-width:640px){
  [data-plugin="dsh-tokbook"] .dtpl-price-live-cells{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 0;}
  [data-plugin="dsh-tokbook"] .dtpl-price-live-cell:nth-child(3){border-left:0;padding-left:0;}
  [data-plugin="dsh-tokbook"] .dtpl-price-live-v{font-size:clamp(30px,11cqi,48px);}
}

[data-plugin="dsh-tokbook"] .dtpl-price-detail-head{
  display:flex;align-items:flex-end;justify-content:space-between;gap:10px 28px;flex-wrap:wrap;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-detail-main{
  display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px;min-width:0;flex:1 1 auto;
}
[data-plugin="dsh-tokbook"] .dtpl-price-detail-main .dtpl-price-detail-id{flex:0 1 auto;}
[data-plugin="dsh-tokbook"] .dtpl-price-detail-id{
  display:flex;align-items:baseline;gap:10px;flex:1 1 auto;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-name{
  flex:0 1 auto;min-width:0;
  font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);font-weight:600;letter-spacing:.01em;color:var(--dtpl-fg);
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
  display:flex;flex-direction:column;gap:6px;min-width:0;
  --dtpl-day-k:132px;
  --dtpl-day-gap:14px;
  padding-top:8px;border-top:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-tracks{
  position:relative;display:flex;flex-direction:column;gap:6px;min-width:0;
  padding-top:18px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-row{
  display:grid;grid-template-columns:var(--dtpl-day-k) minmax(0,1fr);
  align-items:center;column-gap:var(--dtpl-day-gap);min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-k{
  display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-k-name{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-k-range{
  flex:none;font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);
  letter-spacing:.02em;color:var(--dtpl-fg-2);font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-row[data-active="true"] .dtpl-price-day-k{
  color:var(--dtpl-fg);font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-cells{
  display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-cell{
  height:14px;
  background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-cell[data-on="base"]{
  background:color-mix(in srgb,var(--dtpl-fg) 24%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-cell[data-on="slot"]{background:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-day-now-layer{
  position:absolute;top:0;bottom:0;right:0;
  left:calc(var(--dtpl-day-k) + var(--dtpl-day-gap));
  pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-now{position:absolute;top:0;bottom:0;width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-day-now-tag{
  position:absolute;top:0;left:0;transform:translateX(-50%);
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-micro);font-weight:600;
  letter-spacing:.08em;color:var(--dtpl-fg-2);white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-now[data-edge="start"] .dtpl-price-day-now-tag{transform:none;}
[data-plugin="dsh-tokbook"] .dtpl-price-day-now[data-edge="end"] .dtpl-price-day-now-tag{transform:translateX(-100%);}
[data-plugin="dsh-tokbook"] .dtpl-price-day-now-flag{
  position:absolute;top:15px;left:0;transform:translateX(-50%);
  width:8px;height:8px;background:var(--dtpl-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-now-line{
  position:absolute;top:20px;bottom:0;left:0;width:3px;transform:translateX(-50%);
  background:var(--dtpl-price-sheet);
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-now-line::after{
  content:"";position:absolute;top:0;bottom:0;left:1px;width:1px;
  background:var(--dtpl-fg);transform-origin:top;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-axis{
  display:grid;grid-template-columns:var(--dtpl-day-k) minmax(0,1fr);
  column-gap:var(--dtpl-day-gap);min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-axis-ticks{
  grid-column:2;display:flex;justify-content:space-between;
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
  display:inline-flex;align-items:center;gap:6px;
  max-width:100%;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-price-state-led{
  flex:none;width:5px;height:5px;background:currentColor;
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
  margin-top:10px;padding-top:10px;min-width:0;
  border-top:1px solid color-mix(in srgb,var(--dtpl-fg) 12%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-k{
  display:inline-flex;align-items:center;gap:8px;flex:none;
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);letter-spacing:.16em;
  font-weight:600;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-k::before{
  content:"";flex:none;width:3px;height:12px;
  background:var(--dtpl-brand);box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-chips{
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;flex:1 1 auto;
}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-empty{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-chip{
  display:inline-flex;align-items:center;max-width:240px;overflow:hidden;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 20%,transparent);
  border-radius:var(--dtpl-radius);
  transition:border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint),background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-chip:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 40%,transparent);
  background:var(--dtpl-wash-hover);
}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-apply{
  appearance:none;border:0;background:transparent;
  display:inline-flex;align-items:center;min-width:0;
  height:28px;padding:0 8px 0 0;
  color:var(--dtpl-fg);font:inherit;font-size:var(--dtpl-fs-label);cursor:pointer;
}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-mark{
  display:inline-flex;align-items:center;justify-content:center;
  align-self:stretch;flex:none;width:22px;margin-right:7px;
  background:color-mix(in srgb,var(--dtpl-fg) 9%,transparent);
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-del{
  appearance:none;border:0;border-left:1px solid color-mix(in srgb,var(--dtpl-fg) 16%,transparent);
  background:transparent;width:22px;height:28px;
  color:var(--dtpl-fg-3);font:inherit;font-size:var(--dtpl-fs-lead);line-height:1;cursor:pointer;
  transition:color var(--dtpl-dur-quick) var(--dtpl-ease-tint),background var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-del:hover{color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-save{display:inline-flex;align-items:center;gap:6px;flex:none;margin-left:auto;}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-input{width:168px;height:28px;text-align:left;font-size:var(--dtpl-fs-body);}
[data-plugin="dsh-tokbook"] .dtpl-price-tpl-err{
  flex:1 1 100%;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-err);
}

@media (prefers-reduced-motion:no-preference){
  [data-plugin="dsh-tokbook"] .dtpl-price-meter{animation:dtpl-price-wipe 720ms var(--dtpl-ease-move) both;}
  [data-plugin="dsh-tokbook"] .dtpl-price-live-v{animation:dtpl-price-settle 640ms var(--dtpl-ease-move) both;}
  [data-plugin="dsh-tokbook"] .dtpl-price-live-cell:nth-child(1) .dtpl-price-live-v{animation-delay:80ms;}
  [data-plugin="dsh-tokbook"] .dtpl-price-live-cell:nth-child(2) .dtpl-price-live-v{animation-delay:130ms;}
  [data-plugin="dsh-tokbook"] .dtpl-price-live-cell:nth-child(3) .dtpl-price-live-v{animation-delay:180ms;}
  [data-plugin="dsh-tokbook"] .dtpl-price-live-cell:nth-child(4) .dtpl-price-live-v{animation-delay:230ms;}
  [data-plugin="dsh-tokbook"] .dtpl-price-day-cell[data-on="slot"]{animation:dtpl-price-light 520ms var(--dtpl-ease-move) both;}
  [data-plugin="dsh-tokbook"] .dtpl-price-day-now-line::after{animation:dtpl-price-now 560ms var(--dtpl-ease-move) 240ms both;}
  [data-plugin="dsh-tokbook"] .dtpl-price-day-now-flag{animation:dtpl-price-fade 420ms var(--dtpl-ease-move) 260ms both;}
}
@keyframes dtpl-price-now{from{transform:scaleY(0);}}
@keyframes dtpl-price-fade{from{opacity:0;}}
@keyframes dtpl-price-wipe{from{clip-path:inset(0 100% 0 0);}}
@keyframes dtpl-price-settle{from{opacity:0;transform:translateY(10px);}}
@keyframes dtpl-price-light{from{opacity:.2;}}
`
