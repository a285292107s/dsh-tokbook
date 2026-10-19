export const CSS_OVERLAY = `
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
`
