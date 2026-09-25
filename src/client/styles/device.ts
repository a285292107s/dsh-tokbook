/**
 * 设备皮（独立悬浮窗口）—— 仪器外壳。色板在 tokens.ts 第八节，这里只引用 `--dtpl-*` 名字。
 *
 * 全部规则都以根元素 `[data-dtpl-device]` 为前提：宿主里没人挂这个属性，整段静默。
 * 窗口按仪器做：屏幕外是一圈壳（接缝 / 壳厚 / 外缘 / 投影四层 box-shadow 环），
 * 页眉是壳上的控制头（铭牌压铝面），页脚是壳上的状态条。禁令照身：不直连 `--dsw-*`、
 * 不写字面色值、圆角只有 0。
 */

const D = '[data-dtpl-device][data-plugin="dsh-tokbook"]'

export const CSS_DEVICE = `
/* 遮罩压的是桌面不是宿主页面：比宿主 modal 更深一档。 */
${D}.dtpl-overlay{background:var(--dtpl-device-mask);}

/* 外壳：box-shadow 环自外向内叠——先画的覆盖后画的，inset 接缝把屏幕压进壳里；
   投影带负扩散，贴地不炸开。 */
${D} .dtpl-card{
  box-shadow:
    inset 0 0 0 1px var(--dtpl-seam),
    0 0 0 12px var(--dtpl-casing),
    0 0 0 13px var(--dtpl-case-edge),
    0 28px 72px -8px var(--dtpl-case-shadow);
}
/* 四角括号是浮窗贴在宿主上的身份记号；壳立起来之后它就是多余的。 */
${D} .dtpl-card::before,
${D} .dtpl-card::after{display:none;}

/* 控制头：页眉属于壳，不属于屏幕。 */
${D} .dtpl-head{
  background:var(--dtpl-casing);color:var(--dtpl-casing-ink);
  box-shadow:inset 0 -1px 0 var(--dtpl-seam);
}
/* 铭牌：黄换到铝壳上形态不变（tokens 第五节的「料」）；徽记反成墨底黄图，
   两块并排就是机身上的商标区。 */
${D} .dtpl-title>span:last-child{
  background:var(--dtpl-brand);color:var(--dtpl-on-brand);
  padding:2px 7px;box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
${D} .dtpl-title-ico-chip{background:var(--dtpl-casing-ink);color:var(--dtpl-brand);}
${D} .dtpl-close{color:var(--dtpl-casing-ink-2);}
${D} .dtpl-close:hover{background:var(--dtpl-casing-hover);color:var(--dtpl-casing-ink);}

/* 状态条：「最新记录」这类读数理应刻在机身而非屏幕里。 */
${D} .dtpl-foot{
  background:var(--dtpl-casing);
  border-top:1px solid var(--dtpl-seam);
}
${D} .dtpl-foot .dtpl-sync{color:var(--dtpl-casing-ink-2);}
${D} .dtpl-foot .dtpl-sync-running{color:var(--dtpl-casing-ink);}
/* err 的红外壳上只有 3.33:1（浅皮实测），「上次重新扫描失败」的字退回壳主墨；
   危险信号让给那颗点——它是真语义状态，不跟 currentColor 走。 */
${D} .dtpl-foot .dtpl-sync-error{color:var(--dtpl-casing-ink);}
${D} .dtpl-foot .dtpl-sync-error .dtpl-sync-dot{background:var(--dtpl-err);}
${D} .dtpl-foot .dtpl-foot-latest{color:var(--dtpl-casing-ink-2);}
${D} .dtpl-rescan{border-color:var(--dtpl-casing-line);color:var(--dtpl-casing-ink);}
${D} .dtpl-rescan:hover:not(:disabled){
  background:var(--dtpl-casing-hover);border-color:var(--dtpl-casing-line);
}

/* 屏幕滚动条：基础配方从宿主 alias 取色，独立场景无源可取。 */
${D} .dtpl-body{scrollbar-color:var(--dtpl-scrollbar) transparent;}
${D} .dtpl-body::-webkit-scrollbar-thumb{background-color:var(--dtpl-scrollbar);}
${D} .dtpl-body::-webkit-scrollbar-thumb:hover{background-color:var(--dtpl-scrollbar-hover);}
`
