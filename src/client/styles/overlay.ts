/** styles.ts 片段：overlay。由 `injectStyles` 按序拼接。 */
export const CSS_OVERLAY = `/* 遮罩背景 */
/* 与 DSH 原生 modal 遮罩同一配方：alias mask 色 + mask blur。 */
[data-plugin="dsh-tokbook"].dtpl-overlay{
  position:fixed;inset:0;z-index:1000;
  display:flex;align-items:center;justify-content:center;
  padding:24px;
  background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.45));
  backdrop-filter:var(--dsw-mask-blur,blur(2px));
}

/* 弹窗卡片 */
/* 固定高度，不是 max-height：「对话框里的仪表盘」几何不能跟着数据走。固定高度把 chrome 钉住，滚动永远只在 .dtpl-body 里。 */
[data-plugin="dsh-tokbook"] .dtpl-card{
  width:min(720px,100%);height:min(680px,88dvh);height:min(680px,88vh);
  display:flex;flex-direction:column;
  background:var(--dtpl-card);color:var(--dtpl-fg);
  border-radius:var(--dtpl-radius);corner-shape:round;
  box-shadow:var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.28)),
    inset 0 0 0 .5px var(--dsw-elevation-stroke-color,var(--dtpl-hairline));
  overflow:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-card:focus{outline:none;}

/* 标题栏 */
[data-plugin="dsh-tokbook"] .dtpl-head{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:16px 20px 12px;
}
[data-plugin="dsh-tokbook"] .dtpl-title{
  display:flex;align-items:center;gap:10px;min-width:0;
  font-size:15px;line-height:22px;font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-title-ico-chip{
  display:inline-flex;align-items:center;justify-content:center;flex:none;
  width:28px;height:28px;border-radius:8px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 12%,transparent);
  color:var(--dtpl-accent);
}
[data-plugin="dsh-tokbook"] .dtpl-title-ico{width:16px;height:16px;}
[data-plugin="dsh-tokbook"] .dtpl-close{
  display:inline-flex;align-items:center;justify-content:center;flex:none;
  width:28px;height:28px;border:0;background:transparent;
  color:var(--dtpl-fg-2);border-radius:8px;corner-shape:round;
  cursor:pointer;line-height:1;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-close-ico{width:16px;height:16px;}

/* 分段 tab（用量总览 / 通道用量 / 订阅额度 / 价格表 / 统计口径） */
/* 对齐 DSH 的 pill/segmented 模式：轨道底色，激活段得到 layer 表面 + 内嵌幽灵描边。 */
[data-plugin="dsh-tokbook"] .dtpl-tabs{
  display:flex;gap:2px;flex:none;
  margin:0 20px 4px;padding:3px;
  border-radius:10px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tab{
  appearance:none;flex:1;border:0;background:transparent;
  height:26px;padding:0 12px;
  font:inherit;font-size:12px;line-height:18px;font-weight:500;
  color:var(--dtpl-fg-2);white-space:nowrap;
  border-radius:7px;corner-shape:round;cursor:pointer;
  transition:background .15s ease,color .15s ease,box-shadow .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-tab:hover{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-tab[aria-selected="true"]{
  color:var(--dtpl-fg);
  background:var(--dtpl-surface);
  box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border,rgba(0,0,0,.14));
}
/* 未保存的价格表编辑：草稿跨 tab 存活，所以 tab 上挂一个点，直到保存或丢弃。 */
[data-plugin="dsh-tokbook"] .dtpl-tab-dot{
  display:inline-block;width:5px;height:5px;margin-left:5px;
  border-radius:999px;corner-shape:round;
  background:var(--dtpl-accent);
  vertical-align:middle;
}

/* 滚动主体 */
[data-plugin="dsh-tokbook"] .dtpl-body{
  flex:1;min-height:0;
  padding:14px 20px 16px;overflow:auto;overscroll-behavior:contain;
  scrollbar-width:thin;
  scrollbar-color:var(--dsw-alias-scrollbar-bg-l2,rgba(0,0,0,.2)) transparent;
  scroll-padding:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-body::-webkit-scrollbar{width:8px;}
[data-plugin="dsh-tokbook"] .dtpl-body::-webkit-scrollbar-thumb{
  border:2px solid transparent;border-radius:6px;background-clip:padding-box;
  background-color:var(--dsw-alias-scrollbar-bg-l2,rgba(0,0,0,.2));
}
[data-plugin="dsh-tokbook"] .dtpl-body::-webkit-scrollbar-thumb:hover{
  background-color:var(--dsw-alias-scrollbar-hover-l2,rgba(0,0,0,.3));
}
`
