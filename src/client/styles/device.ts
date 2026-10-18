const D = '[data-dtpl-device][data-plugin="dsh-tokbook"]'

export const CSS_DEVICE = `
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
`
