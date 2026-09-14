/** styles.ts 片段：footer。由 `injectStyles` 按序拼接。 */
export const CSS_FOOTER = `/* 侧边栏入口按钮 */
/* 对齐设置入口的几何（ui-settings-general SettingsRoot）：宽栏里一条全宽
   42px bar，56px rail 上一个 36px 圆形图标钮。 */
[data-plugin="dsh-tokbook"].dtpl-footer{
  flex:1;min-width:0;
  display:flex;align-items:center;gap:8px;
  width:auto;height:42px;padding:0 10px 0 8px;box-sizing:border-box;
  border:none;border-radius:var(--dtpl-radius-sm);background:transparent;
  cursor:pointer;overflow:hidden;
  color:var(--dsw-alias-label-primary,#1f2328);
  font-family:inherit;font-size:14px;line-height:22px;white-space:nowrap;
  transition:background .15s ease,color .15s ease;
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
/* 图标容器托着「告急」角标；容器本身只是隐形几何。 */
[data-plugin="dsh-tokbook"] .dtpl-foot-ico-wrap{position:relative;display:inline-flex;flex:none;align-items:center;justify-content:center;}
[data-plugin="dsh-tokbook"] .dtpl-foot-alert{
  position:absolute;top:-1px;right:-1px;
  width:8px;height:8px;border-radius:50%;
  background:var(--dtpl-warn,#9a6700);
  box-shadow:0 0 0 2px var(--dtpl-surface,#fff);
}
[data-plugin="dsh-tokbook"] .dtpl-foot-label{overflow:hidden;white-space:nowrap;}
[data-plugin="dsh-tokbook"].dtpl-footer:focus-visible{outline:2px solid var(--dtpl-accent);outline-offset:2px;}

/* 焦点环（共享） */
[data-plugin="dsh-tokbook"] :focus-visible{
  outline:2px solid var(--dtpl-accent);outline-offset:2px;
}
`
