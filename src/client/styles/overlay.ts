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

/* 弹窗卡片：方舟的「设备读数窗」——直角、一条硬边、四角括号，外加一层网点底纹。
   括号画在 ::before/::after 上而不是用 clip-path 切角：切角会连子元素的焦点环一起裁掉，
   而这两个角只画 L 形边框，控件与焦点环都不受影响。 */
[data-plugin="dsh-tokbook"] .dtpl-card{
  position:relative;
  width:min(720px,100%);height:min(680px,88dvh);height:min(680px,88vh);
  display:flex;flex-direction:column;
  background:var(--dtpl-card);color:var(--dtpl-fg);
  border-radius:0;
  box-shadow:var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.28)),
    inset 0 0 0 1px var(--dtpl-border);
  overflow:hidden;
}
/* 四角括号：只画左上与右下两端，其余两角留空——「方框的四角都补全」会读成相框。 */
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

/* 标题栏 */
/* 字体保守：不做衬线/等宽的字体文章（终末地的原话就是「字体使用太保守…好处是不像某些
   使用粗体字的压根看不清」）。标题回普通无衬线，只保留一点字距。 */
[data-plugin="dsh-tokbook"] .dtpl-head{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:14px 20px 12px;
}
[data-plugin="dsh-tokbook"] .dtpl-title{
  display:flex;align-items:center;gap:10px;min-width:0;
  font-size:16px;line-height:24px;font-weight:600;letter-spacing:.02em;
}
/* 工业徽记（第一处出现）：黄底 + 墨色图形。这是**抽象替身**，不是鹰角商标的复刻。 */
[data-plugin="dsh-tokbook"] .dtpl-title-ico-chip{
  display:inline-flex;align-items:center;justify-content:center;flex:none;
  width:22px;height:22px;
  background:var(--dtpl-brand);
  color:var(--dtpl-on-brand);
}
[data-plugin="dsh-tokbook"] .dtpl-title-ico{width:14px;height:14px;}
[data-plugin="dsh-tokbook"] .dtpl-close{
  display:inline-flex;align-items:center;justify-content:center;flex:none;
  width:28px;height:28px;border:0;background:transparent;
  color:var(--dtpl-fg-2);
  cursor:pointer;line-height:1;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-close-ico{width:16px;height:16px;}

/* 分段 tab（用量总览 / 通道用量 / 订阅额度 / 价格表 / 统计口径） */
/* 不做药丸轨道：方舟的选择器是一条横排、项与项之间用竖发丝线分隔，当前项由**底部一条
   警戒色实条**标出。轨道底色会把它读成「一组按钮」，而这里表达的是「这台设备当前的页」。 */
[data-plugin="dsh-tokbook"] .dtpl-tabs{
  display:flex;gap:0;flex:none;
  margin:0;padding:0 20px;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-tab{
  position:relative;appearance:none;flex:1;border:0;background:transparent;
  height:30px;padding:0 12px;
  font:inherit;font-size:12px;line-height:18px;font-weight:500;
  color:var(--dtpl-fg-3);white-space:nowrap;cursor:pointer;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-tab + .dtpl-tab{border-left:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-tab:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-tab[aria-selected="true"]{
  color:var(--dtpl-fg);font-weight:600;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
/* 当前页标记：一条 5px 的黄块压在 tab 行的下边界上，**四条边都带 1px 墨边**。
   那条墨边不是装饰：恒定的黄在白底上只有 1.57:1，边界靠墨边给到 18:1；深底上墨边看不见
   也无所谓（黄本身对深底有 12:1）。黄以「料」出现，两个主题因此共用一套形态。 */
[data-plugin="dsh-tokbook"] .dtpl-tab[aria-selected="true"]::after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:5px;
  background:var(--dtpl-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
/* 未保存的价格表编辑：草稿跨 tab 存活，所以 tab 上挂一个点，直到保存或丢弃。 */
[data-plugin="dsh-tokbook"] .dtpl-tab-dot{
  display:inline-block;width:6px;height:6px;margin-left:5px;
  background:var(--dtpl-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
  vertical-align:middle;
}

/* 滚动主体 */
/* 上下留白比横向大一档：首屏第一个元素（hero）因此不贴着 tab 条。 */
[data-plugin="dsh-tokbook"] .dtpl-body{
  flex:1;min-height:0;
  padding:18px 20px 20px;overflow:auto;overscroll-behavior:contain;
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
