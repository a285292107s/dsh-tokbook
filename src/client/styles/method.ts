/** styles.ts 片段：method。由 `injectStyles` 按序拼接。 */
export const CSS_METHOD = `/* 统计口径文档 */
/* 阅读层级：导语 → 三事实条 → 编号小节。这是一份**文档**，所以它比别的 tab 更安静：
   全篇没有一块染色面板，只有 1px 硬边框的读数框与实发丝线。
   上一版用 --dtpl-accent 铺了一层「重点色」——渐变事实块、染色序号方块、染色公式条、
   染色 chip。accent 在 DSH 皮肤里本就等于墨色，那些染色在界面上读成了同一片浅灰，
   等于没有层级；换个皮肤又会整片变蓝。现在层级由**边框、填充与字重**表达，
   色相只留给真正的状态（warn / err）。 */
[data-plugin="dsh-tokbook"] .dtpl-doc{max-width:none;}
[data-plugin="dsh-tokbook"] .dtpl-doc code{
  font-family:var(--dtpl-mono);font-size:.9em;
  padding:.1em .35em;
  border:1px solid var(--dtpl-hairline);
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg);
  white-space:nowrap;
}

/* 导语：两三行短句，先定调再展开细节。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-lede{
  display:flex;flex-direction:column;gap:3px;
  margin:0 0 12px;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-lede p{margin:0;}
/* 导语里的加重点是**这次要读的那句**，靠字重与墨色，不靠色相。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-lede b{color:var(--dtpl-fg);font-weight:600;}

/* 三事实条：来源 / 精度 / 范围。三条是**同类**的方法事实——都在说「怎么记」，都可由
   §2 的表与 §3 的漏项核对，所以三格等权。最后一格曾按「结论」处理（重边框 + 大字位，
   装一个「完整度」数字）：那是**给产品自评**，而自评一旦是印象，挂在速览里只会先让人
   怀疑整页；同一件事改为按作用域陈述后，它就不再需要一个比别人重的框。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-facts{
  display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
  margin-bottom:16px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact{
  display:flex;flex-direction:column;gap:3px;
  padding:10px 12px;min-width:0;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-k{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);font-weight:500;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-v{
  font-size:12px;line-height:18px;color:var(--dtpl-fg);
}

/* 编号小节标题：1/2/3/4 装在一枚**工业徽记**里——与每个节标题前那枚是同一个记号
   （黄牌 + 墨色数字）。终末地把「终末地工业」的衍生图形铺在每个系统面板的头部，
   这里用同一手法让「第几节」也成为这套记号的一部分；上一版是个 accent 染色的方块。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-sec{margin-bottom:16px;}
[data-plugin="dsh-tokbook"] .dtpl-doc-title{
  display:flex;align-items:center;gap:8px;
  font-size:13px;line-height:20px;font-weight:600;color:var(--dtpl-fg);
  margin:0 0 10px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-idx{
  flex:none;display:inline-flex;align-items:center;justify-content:center;
  width:18px;height:18px;
  background:var(--dtpl-brand);color:var(--dtpl-on-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
  font-family:var(--dtpl-mono);
  font-size:11px;line-height:1;font-weight:700;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-sub{
  margin:0 0 8px;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-sub b{color:var(--dtpl-fg);font-weight:600;}

/* 四桶磁贴：2×2 网格的白话定义。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-buckets{
  display:grid;grid-template-columns:repeat(2,1fr);gap:8px;
  margin-bottom:10px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket{
  display:flex;flex-direction:column;gap:3px;
  padding:10px 12px;min-width:0;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket-name{
  font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket-desc{
  font-size:11.5px;line-height:17px;color:var(--dtpl-fg-2);
}

/* 记了哪些调用：一张判定表。第一列是用户视角的「情况」（行表头），后两列是两个维度的判定。
   判定沿用同一套芯片语言——描边 = 有数、静默 = 无数；色相不参与，层级由边框与字重给。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-judge{
  width:100%;table-layout:fixed;border-collapse:collapse;
  margin:0 0 8px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge th,
[data-plugin="dsh-tokbook"] .dtpl-doc-judge td{
  text-align:left;vertical-align:top;
  padding:7px 8px;
  border-top:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th{
  padding:0 8px 5px;border-top:none;
  font-size:10px;line-height:14px;font-weight:600;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:first-child{width:52%;}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(2),
[data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(3){width:24%;}
/* 行表头在视觉上是正文，不是列头：粗体落在句子自己（-what）身上。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-judge tbody th{font-weight:400;}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-what{
  display:block;font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-detail{
  display:block;font-size:11.5px;line-height:17px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-note{
  margin:0;font-size:11.5px;line-height:18px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-judge-note b{color:var(--dtpl-fg);font-weight:600;}
/* 窄处两列判定各只剩约 53px 内容宽，而最长的芯片（四桶累加）要 56px——实测会挤出格子。
   给判定列多让 3 个百分点、并收紧内边距，而不是让芯片换行或截断。 */
@media (max-width:640px){
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:first-child{width:46%;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(2),
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge thead th:nth-child(3){width:27%;}
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge th,
  [data-plugin="dsh-tokbook"] .dtpl-doc-judge td{padding:6px;}
}
/* 判定芯片不是两种状态色，是两种形状：描边 = 这个维度有数，静默 = 没有数可加。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-chip{
  flex:none;display:inline-flex;align-items:center;
  height:18px;padding:0 7px;margin-top:1px;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 35%,transparent);
  color:var(--dtpl-fg);
  font-size:10px;line-height:1;font-weight:600;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-chip-off{
  border-color:var(--dtpl-border);
  color:var(--dtpl-fg-3);
  font-weight:500;
}

/* 差额从哪来：并排两条原因。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-gap{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-card{
  padding:11px 13px;min-width:0;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-title{
  display:flex;align-items:center;gap:6px;
  margin:0 0 6px;font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-title::before{
  content:"";flex:none;width:3px;height:12px;
  background:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title{color:var(--dtpl-warn-ink);}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title::before{background:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list{
  list-style:none;margin:0;padding:0;
  display:flex;flex-direction:column;gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li{
  position:relative;padding-left:12px;
  display:flex;flex-direction:column;gap:1px;
  font-size:12px;line-height:19px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-list li::before{
  content:"";position:absolute;left:1px;top:7px;
  width:4px;height:4px;border-radius:50%;corner-shape:round;
  background:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-name{
  display:block;color:var(--dtpl-fg);font-weight:600;font-size:12px;line-height:18px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-item-desc{
  display:block;color:var(--dtpl-fg-2);font-size:11.5px;line-height:18px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum{
  margin:8px 0 0;padding-top:7px;
  border-top:1px solid var(--dtpl-hairline);
  font-size:11.5px;line-height:18px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum b{color:var(--dtpl-fg);font-weight:600;}

/* 怎么核对：字段映射，收进一个紧凑面板。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-map{
  display:flex;flex-direction:column;gap:5px;
  margin:2px 0 8px;padding:10px 12px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-row{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  font-size:12px;line-height:20px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-row b{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-arrow{color:var(--dtpl-fg-3);flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-note{
  margin:2px 0 0;font-size:11.5px;line-height:17px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-note:first-of-type{margin-top:2px;}

/* 跨 tab 提示：订阅额度是另一套官方口径。它是一条**旁注**，不是重点色面板——
   1px 边框 + 一条与正文同色的引线。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-quota{
  display:flex;flex-direction:column;gap:3px;
  margin:0 0 14px;padding:10px 13px;
  border:1px solid var(--dtpl-border);
  box-shadow:inset 3px 0 0 var(--dtpl-fg-3);
  background:var(--dtpl-panel-bg);
  font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-quota p{margin:0;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-doc-quota b{color:var(--dtpl-fg);font-weight:600;}

/* 数据文件诊断：一个紧凑盒子。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-data{
  display:flex;flex-direction:column;gap:3px;
  margin:2px 0 6px;padding:10px 13px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-line{
  margin:0;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-line b{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-dir{
  margin:0;font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-dir code{
  background:transparent;border:0;padding:0;font-size:.92em;
}

/* 文档脚注（这一节的最后一行）。三处『!important』：**来源没有记录在案**（LESSONS.md 里没有这一条，
   2026-09-17 审查时也没能从代码里推出是谁需要被压过）——它现在的效果是让这一行的字号/行高/墨色
   无法被任何普通规则覆盖，而本表是运行时 append 到 head 末尾的，同特异度本来就是我们赢。
   撤它之前只差一次实测：在真机上量『.dtpl-doc-foot』的 computed font-size，仍是 11px 就删掉。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-foot{
  margin-top:12px;padding-top:10px;
  border-top:1px solid var(--dtpl-border);
  font-size:11px!important;line-height:16px!important;color:var(--dtpl-fg-2)!important;
}
`
