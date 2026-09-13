/** styles.ts 片段：shared。由 `injectStyles` 按序拼接。 */
export const CSS_SHARED = `/* 深色皮肤兜底微调 */
/* Token 已承担大部分配色；这里只抬高深色表面上需要多一点提亮的邻近洗色。 */
body[data-ds-dark-theme] [data-plugin="dsh-tokbook"] .dtpl-hero{
  background:linear-gradient(135deg,
    color-mix(in srgb,var(--dtpl-accent) 16%,transparent),
    color-mix(in srgb,var(--dtpl-accent) 6%,transparent));
}
body[data-ds-dark-theme] [data-plugin="dsh-tokbook"] .dtpl-stat,
body[data-ds-dark-theme] [data-plugin="dsh-tokbook"] .dtpl-bars,
body[data-ds-dark-theme] [data-plugin="dsh-tokbook"] .dtpl-provider-card,
body[data-ds-dark-theme] [data-plugin="dsh-tokbook"] .dtpl-quota-card{
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}

/* 选中态 */
[data-plugin="dsh-tokbook"] .dtpl-body ::selection{
  background:color-mix(in srgb,var(--dtpl-accent) 25%,transparent);
}

/* 窄屏 */
@media (max-width:640px){
  /* 底部抽屉：主动选择，而不是半吊子的居中 94dvh 对话框。全宽、贴底，只圆上角（原生移动端 sheet 习惯）。 */
  [data-plugin="dsh-tokbook"].dtpl-overlay{padding:0;align-items:flex-end;}
  [data-plugin="dsh-tokbook"] .dtpl-card{
    width:100%;height:min(94dvh,94vh);
    border-radius:var(--dtpl-radius) var(--dtpl-radius) 0 0;corner-shape:round;
    box-shadow:var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.28)),
      inset 0 0 0 .5px var(--dsw-elevation-stroke-color,var(--dtpl-hairline));
  }
  [data-plugin="dsh-tokbook"] .dtpl-head{padding:14px 16px 10px;}
  [data-plugin="dsh-tokbook"] .dtpl-tabs{margin:0 16px 4px;}
  /* 五个 tab 塞不进手机宽度：让行横向滚动，而不是把最后一个裁出卡片。 */
  [data-plugin="dsh-tokbook"] .dtpl-tabs{overflow-x:auto;scrollbar-width:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tabs::-webkit-scrollbar{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-tab{flex:0 0 auto;}
  [data-plugin="dsh-tokbook"] .dtpl-body{padding:12px 16px 14px;}
  [data-plugin="dsh-tokbook"] .dtpl-foot{padding:10px 16px 12px;}
  [data-plugin="dsh-tokbook"] .dtpl-hero{flex-direction:column;align-items:flex-start;gap:8px;}
  /* meta 行在窄 sheet 上改横排；按单元换行，而不是溢出卡片边缘。 */
  [data-plugin="dsh-tokbook"] .dtpl-hero-meta{flex-direction:row;flex-wrap:wrap;gap:8px 12px;align-items:baseline;}
  /* 统计口径文档：窄 sheet 上多列组改单列。 */
  [data-plugin="dsh-tokbook"] .dtpl-doc-facts{grid-template-columns:1fr;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-buckets{grid-template-columns:1fr;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-gap{grid-template-columns:1fr;}

  /* 价格表：四列费率加模型身份塞不进手机。整行改为堆叠——身份、再 2×2 带标签的格子、再展开钮——并去掉已对不齐的列头。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-cols{display:none;}
  [data-plugin="dsh-tokbook"] .dtpl-price-row{
    grid-template-columns:minmax(0,1fr) auto;row-gap:6px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-id{grid-column:1;}
  /* 展开钮是进入一行调价史的唯一入口，触控 sheet 上给完整 44px 热区。 */
  [data-plugin="dsh-tokbook"] .dtpl-price-more{
    grid-column:2;grid-row:1;width:44px;height:44px;font-size:12px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-rates{
    grid-column:1 / -1;
    grid-template-columns:repeat(2,minmax(0,1fr));row-gap:6px;
    margin-top:2px;
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-cell-k{display:block;}
  [data-plugin="dsh-tokbook"] .dtpl-price-input{text-align:left;}
  [data-plugin="dsh-tokbook"] .dtpl-price-seg-rates{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-slot-rates{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
  [data-plugin="dsh-tokbook"] .dtpl-price-seg-head{flex-wrap:wrap;}
  [data-plugin="dsh-tokbook"] .dtpl-price-seg-actions{opacity:1;}
}

/* 动效（共享 keyframes；尊重 reduced motion） */
@media (prefers-reduced-motion:no-preference){
  [data-plugin="dsh-tokbook"].dtpl-overlay{animation:dtpl-fade .16s ease-out;}
  [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-pop .16s ease-out;}
  [data-plugin="dsh-tokbook"] .dtpl-bar-fill{transform-origin:bottom;}
}
@media (prefers-reduced-motion:no-preference) and (max-width:640px){
  /* sheet 习语：居中弹窗的 pop 动画是向上平移 8px，对贴底全宽 sheet 无意义——改为从视口下方滑入。 */
  [data-plugin="dsh-tokbook"] .dtpl-card{animation:dtpl-sheet .22s cubic-bezier(.32,.72,0,1);}
}
@keyframes dtpl-fade{from{opacity:0}}
@keyframes dtpl-pop{from{opacity:0;transform:translateY(8px) scale(.98)}}
@keyframes dtpl-sheet{from{transform:translateY(100%)}}
@keyframes dtpl-rotate{to{transform:rotate(360deg)}}
@keyframes dtpl-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes dtpl-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes dtpl-refresh-pop{
  0%{transform:scale(1)}
  40%{transform:scale(.82) rotate(-12deg)}
  70%{transform:scale(1.12) rotate(4deg)}
  100%{transform:scale(1)}
}
@media (prefers-reduced-motion:reduce){
  [data-plugin="dsh-tokbook"] .dtpl-sk,
  [data-plugin="dsh-tokbook"] .dtpl-sync-running .dtpl-sync-dot,
  [data-plugin="dsh-tokbook"] .dtpl-price-seg-actions,
  [data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{animation:none;transition:none;}
}
`
