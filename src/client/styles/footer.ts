export const CSS_FOOTER = `/* 侧边栏入口按钮 */
/* 对齐设置入口的几何（ui-settings-general SettingsRoot）：宽栏里一条全宽
   42px bar；窄栏里一个 36px 圆形图标钮（rail）。
   圆角**不跟它**——宿主用 --dsw-radius-md（12px），本插件的圆角是直角不变量
   （--dtpl-radius: 0px，见 tokens 第七节）。 */
[data-plugin="dsh-tokbook"].dtpl-footer{
  flex:1;min-width:0;
  display:flex;align-items:center;gap:8px;
  width:auto;height:42px;padding:0 10px 0 8px;box-sizing:border-box;
  border:none;border-radius:var(--dtpl-radius);background:transparent;
  cursor:pointer;overflow:hidden;
  color:var(--dsw-alias-label-primary,#1f2328);
  font-family:inherit;font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);white-space:nowrap;
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
/* 焦点态：**底色 + 左缘一道标记条**，不是一圈框。
   这个按钮平时没有自己的面（透明底、无边框），所以无论把环形画在外侧（outline）还是内侧
   （inset box-shadow），沿按钮轮廓的那一圈线都会直接读成「被框住了」——深色皮肤下那圈是
   近白、浅色下是近黑，两种都像控件坏了。实测四条路线都试过：品牌色、与主墨混、内层外置、
   外层内缩，结论一样——**问题不在颜色，在「环形」这个形状**。
   改用本仓库既有的「当前项」语言（窗口 tab 条的底部实条、节标题的黄牌都是同一套）：
   聚焦时给它一档底色 + 左缘一道实心条。读者看到的是「这一项被选中」，不是「外面套了个盒子」。
   标记条取聚焦色（宿主正文字色：浅皮近黑 / 深皮近白，与侧栏底反向）；
   条贴在左缘是因为这一栏的条目都是左对齐的，条的起点就是条目的起点。 */
[data-plugin="dsh-tokbook"].dtpl-footer:focus-visible{
  outline:none;
  background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));
  box-shadow:inset 3px 0 0 var(--dtpl-footer-focus);
}

/* 焦点环（共享） */
[data-plugin="dsh-tokbook"] :focus-visible{
  outline:2px solid var(--dtpl-accent);outline-offset:2px;
}
`
