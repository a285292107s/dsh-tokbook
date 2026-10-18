export const CSS_PRICING = `
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
  transition:background .12s ease,border-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle:hover{
  background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
  border-color:color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle:active{
  background:color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-caret{
  flex:none;width:0;height:0;
  border-left:5px solid currentColor;
  border-top:4px solid transparent;border-bottom:4px solid transparent;
  transition:transform .15s ease;
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
  transition:background .12s ease,border-color .12s ease,color .12s ease;
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
  transition:border-color .12s ease;
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
  transition:border-color .12s ease;
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
  transition:border-color .12s ease;
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
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button + button{border-left:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button:hover{background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button[aria-pressed="true"]{
  color:var(--dtpl-fg);font-weight:600;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
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
  transition:background .12s ease;
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
  transition:border-color .12s ease,background-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-input:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 42%,transparent);
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-input::placeholder{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-input:focus{
  outline:none;border-color:var(--dtpl-fg);
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
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
  transition:background-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-add:hover{
  background:color-mix(in srgb,var(--dtpl-fg) 9%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-add-ghost{
  appearance:none;box-sizing:border-box;
  display:flex;align-items:center;justify-content:flex-start;gap:6px;
  min-height:30px;padding:4px 8px;
  border:1px solid var(--dtpl-hairline);border-radius:var(--dtpl-radius);
  background:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:var(--dtpl-fs-label);letter-spacing:.08em;cursor:pointer;white-space:nowrap;
  transition:background .12s ease,border-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-add-plus{
  flex:none;width:12px;text-align:center;letter-spacing:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-add-ghost:not(:disabled):hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 30%,transparent);
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
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
  transition:color .12s ease,background-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:hover{
  color:var(--dtpl-fg);
  background:color-mix(in srgb,var(--dtpl-fg) 9%,transparent);
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
  background:color-mix(in srgb,var(--dtpl-warn) 12%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-calarm-text{
  flex:1 1 auto;min-width:0;margin:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-warn-ink);overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-price-calarm-act{
  appearance:none;box-sizing:border-box;flex:none;
  display:inline-flex;align-items:center;gap:6px;
  min-height:26px;padding:2px 10px;
  border:1px solid color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
  border-radius:var(--dtpl-radius);
  background:color-mix(in srgb,var(--dtpl-warn) 14%,transparent);
  color:var(--dtpl-warn-ink);
  font:inherit;font-size:var(--dtpl-fs-label);cursor:pointer;white-space:nowrap;
  transition:background .12s ease,border-color .12s ease,color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-calarm-act:hover{
  border-color:var(--dtpl-warn-ink);
  background:color-mix(in srgb,var(--dtpl-warn) 24%,transparent);
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
  transition:border-color .12s ease,background-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-select:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 42%,transparent);
  background-color:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-select:focus{
  outline:none;border-color:var(--dtpl-fg);
  background-color:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
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
  transition:text-decoration-color .12s ease;
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
  transition:background .12s ease,border-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-tool:not(:disabled):hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
  background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
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
`
