/**
 * styles.ts 片段：调价史抽屉里的时间轴（`Pricing/Timeline.tsx`）。
 *
 * 轨道只是量尺：轨、点、标签都按 JS 量出的宽度定位（最小间距是像素宽度，百分比挡不住两个标签在窄抽屉里叠在一起）。级联顺序是契约：本片段跟在 pricing 之后，只加 `.dtpl-tl-*`。
 */
export const CSS_PRICING_TIMELINE = `
[data-plugin="dsh-tokbook"] .dtpl-tl{padding:1px 0 0;}
/* 轨道只是量尺：轨、点、标签都按 JS 量出的宽度定位（最小间距是像素宽度，百分比挡不住两个标签在窄抽屉里叠在一起）。自上而下三行：括号的两个标签、带点的轨、调价日期——12 + 5 + 3 + 4 + 12 = 36px。 */
[data-plugin="dsh-tokbook"] .dtpl-tl-track{position:relative;height:36px;}
/* 轨用皮肤的三级文字色，而不是前景色的稀释洗色：它必须读成日期挂靠的那条线。3px，不是 hairline：1px 读起来像一条游离分隔线。 */
[data-plugin="dsh-tokbook"] .dtpl-tl-rail{
  position:absolute;left:0;right:0;top:17px;height:3px;
  border-radius:1.5px;background:var(--dtpl-fg-3);
}
/* 一个节点：点在轨上，日期挂在点下方。背后有分段的节点是 button（轴是导航，不是装饰）。盒子占满整个轨道高度——这才让 5px 的点拥有 36px 热区。 */
[data-plugin="dsh-tokbook"] .dtpl-tl-node{
  position:absolute;top:0;left:0;height:100%;
  appearance:none;font:inherit;text-align:center;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] button.dtpl-tl-node{
  border:0;background:transparent;padding:0;margin:0;cursor:pointer;
  /* 有确定高度的 <button> 会把内容盒垂直居中（UA button 布局）——而这盒子占满整个轨道高度，所以在左端带节点的行上首记标签会沉到 12px 低处。把 button 改成 column flex 容器可以取消居中。 */
  display:flex;flex-direction:column;justify-content:flex-start;
}
/* 两端以外的每个节点都以自己所属的点为中心。 */
[data-plugin="dsh-tokbook"] .dtpl-tl-node:not([data-cap]){transform:translateX(-50%);}
/* 调价日期挂在轨下方（24–36px）；括号自己的两个标签留在上方——它们命名的是区间的两端，不是某个点。 */
[data-plugin="dsh-tokbook"] .dtpl-tl-node-k{
  display:block;margin-top:24px;
  font-size:9px;line-height:12px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap] .dtpl-tl-node-k{margin-top:0;}
/* 点落在轨上：5px 在 16px 处、3px 的线在 17px 处，两者中心都在 18.5。fg-2，不是 fg-3：点是非文字物体，需要与所处表面 3:1。 */
[data-plugin="dsh-tokbook"] .dtpl-tl-dot{
  position:absolute;top:16px;left:50%;
  width:5px;height:5px;border-radius:50%;box-sizing:border-box;
  background:var(--dtpl-fg-2);transform:translateX(-50%);
}
/* 两端把标签收在轨道内——第一个从左缘起，最后一个到右缘止。它们本身就是括号，所以没有任何东西往里推。 */
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="start"]{left:0;text-align:left;}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="today"]{left:auto;right:0;text-align:right;}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="start"] .dtpl-tl-dot{left:0;}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-cap="today"] .dtpl-tl-dot{left:100%;}
/* 今日生效价：唯一一个既是状态又不仅是日期的节点。accent 色加更宽的点——提示不单靠颜色，行与分段列表里仍用文字再说一遍。 */
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-active="true"] .dtpl-tl-node-k{
  color:var(--dtpl-fg);font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-tl-node[data-active="true"] .dtpl-tl-dot{
  top:15.5px;width:6px;height:6px;background:var(--dtpl-accent);
}
/* 悬停唤醒节点：日期和点就是这个控件的身体，必须显示「这是一个整体」。焦点：2px 环 + offset，即 WCAG 2.2 focus-appearance 要求的尺寸。 */
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
