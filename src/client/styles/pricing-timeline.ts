/**
 * 调价史抽屉里的时间轴（`pricing/Timeline.tsx`）：轨、点、标签的位置由 JS 量出的像素宽度给出——
 * 最小间距是像素值，百分比挡不住两个标签在窄抽屉里叠在一起。排在 pricing 之后。
 */
export const CSS_PRICING_TIMELINE = `
[data-plugin="dsh-tokbook"] .dtpl-tl{padding:1px 0 0;}
[data-plugin="dsh-tokbook"] .dtpl-tl-track{position:relative;height:36px;}
[data-plugin="dsh-tokbook"] .dtpl-tl-rail{
  position:absolute;left:0;right:0;top:17px;height:3px;
  border-radius:0;background:var(--dtpl-fg-3);
}
/* 盒子占满轨道高度：5px 的点的热区靠它。 */
[data-plugin="dsh-tokbook"] .dtpl-tl-node{
  position:absolute;top:0;left:0;height:100%;
  appearance:none;font:inherit;text-align:center;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] button.dtpl-tl-node{
  border:0;background:transparent;padding:0;margin:0;cursor:pointer;
  /* 有确定高度的 <button> 会把内容盒垂直居中（UA button 布局），而这盒子占满轨道高度——首记标签会因此沉到 12px 低处。column flex 取消居中。 */
  display:flex;flex-direction:column;justify-content:flex-start;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-node:not([data-cap]){transform:translateX(-50%);}
[data-plugin="dsh-tokbook"] .dtpl-tl-node-k{
  display:block;margin-top:24px;
  font-size:9px;line-height:12px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap] .dtpl-tl-node-k{margin-top:0;}
/* 点是非文字物体，需与所处表面 3:1，所以走 fg-2 而非 fg-3。 */
[data-plugin="dsh-tokbook"] .dtpl-tl-dot{
  position:absolute;top:16px;left:50%;
  width:5px;height:5px;box-sizing:border-box;
  background:var(--dtpl-fg-2);transform:translateX(-50%);
}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="start"]{left:0;text-align:left;}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="today"]{left:auto;right:0;text-align:right;}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="start"] .dtpl-tl-dot{left:0;}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="today"] .dtpl-tl-dot{left:100%;}
/* 当前生效节点用 accent 色 + 更宽的点；状态另有文字，不单靠颜色。 */
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-active="true"] .dtpl-tl-node-k{
  color:var(--dtpl-fg);font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-active="true"] .dtpl-tl-dot{
  top:15.5px;width:6px;height:6px;background:var(--dtpl-accent);
}
/* 焦点给 2px 环 + 2px offset（WCAG 2.2 focus-appearance 的尺寸）。 */
[data-plugin="dsh-tokbook"] button.dtpl-tl-node:hover .dtpl-tl-node-k{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] button.dtpl-tl-node:hover .dtpl-tl-dot{
  box-shadow:0 0 0 2px color-mix(in srgb,var(--dtpl-fg) 18%,transparent);
}
[data-plugin="dsh-tokbook"] button.dtpl-tl-node:focus-visible{outline:none;}
[data-plugin="dsh-tokbook"] button.dtpl-tl-node:focus-visible .dtpl-tl-node-k{color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] button.dtpl-tl-node:focus-visible .dtpl-tl-dot{
  outline:2px solid var(--dtpl-accent);outline-offset:2px;
}
`
