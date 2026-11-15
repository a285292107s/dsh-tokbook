export const CSS_PAGE = `
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
  --dtpl-page-col:1060px;
}

[data-plugin="dsh-tokbook"].dtpl-page > .dtpl-head,
[data-plugin="dsh-tokbook"].dtpl-page > .dtpl-tabs,
[data-plugin="dsh-tokbook"].dtpl-page > .dtpl-body,
[data-plugin="dsh-tokbook"].dtpl-page > .dtpl-foot{
  box-sizing:border-box;
  width:100%;max-width:var(--dtpl-page-col);margin-inline:auto;
}

[data-plugin="dsh-tokbook"] .dtpl-head{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  flex:none;
  padding:26px var(--dtpl-page-pad) 14px;
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

[data-plugin="dsh-tokbook"] .dtpl-body{
  flex:1;min-height:0;
  padding:20px var(--dtpl-page-pad) 28px;overflow:auto;overscroll-behavior:contain;
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
`
