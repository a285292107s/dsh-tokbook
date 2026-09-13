/** styles.ts 片段：method。由 `injectStyles` 按序拼接。 */
export const CSS_METHOD = `/* 统计口径文档 */
/* 阅读层级：导语 → 三事实条 → 编号小节。事实与结构组做成轻洗面板，让视线先落在摘要。 */
[data-plugin="dsh-tokbook"] .dtpl-doc{max-width:none;}
[data-plugin="dsh-tokbook"] .dtpl-doc code{
  font-family:var(--dtpl-mono);font-size:.9em;
  padding:.1em .35em;border-radius:5px;corner-shape:round;
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
[data-plugin="dsh-tokbook"] .dtpl-doc-lede b{color:var(--dtpl-accent);font-weight:600;}

/* 三事实条：来源 / 精度 / 完整度，最后一项加重。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-facts{
  display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
  margin-bottom:16px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact{
  display:flex;flex-direction:column;gap:3px;
  padding:10px 12px;min-width:0;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-k{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-3);font-weight:500;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-v{
  font-size:12px;line-height:18px;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-key{
  background:linear-gradient(135deg,
    color-mix(in srgb,var(--dtpl-accent) 12%,transparent),
    color-mix(in srgb,var(--dtpl-accent) 5%,transparent));
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--dtpl-accent) 30%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-key .dtpl-doc-fact-k{color:var(--dtpl-accent);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-big{
  font-size:17px;line-height:20px;font-weight:700;color:var(--dtpl-accent);
  font-variant-numeric:tabular-nums;letter-spacing:-.01em;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-fact-tail{color:var(--dtpl-fg-2);font-size:11px;}

/* 编号小节标题：1/2/3/4 装在 accent 色块里。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-sec{margin-bottom:16px;}
[data-plugin="dsh-tokbook"] .dtpl-doc-title{
  display:flex;align-items:center;gap:8px;
  font-size:13px;line-height:20px;font-weight:600;color:var(--dtpl-fg);
  margin:0 0 10px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-idx{
  flex:none;display:inline-flex;align-items:center;justify-content:center;
  width:18px;height:18px;border-radius:6px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 14%,transparent);
  color:var(--dtpl-accent);
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
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket-name{
  font-size:12px;line-height:18px;font-weight:650;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-bucket-desc{
  font-size:11.5px;line-height:17px;color:var(--dtpl-fg-2);
}

/* 累计公式：累计词元 = 输入 + …，做成一行可换行的 pill。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-eq{
  display:flex;align-items:center;flex-wrap:wrap;gap:4px 6px;
  margin:0 0 10px;padding:7px 12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 7%,transparent);
  font-size:12px;line-height:18px;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-eq-lead{font-weight:650;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-doc-eq-term{font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-doc-eq-op{color:var(--dtpl-fg-3);font-weight:600;}

/* 记了哪些调用：chip 引导的行列表。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-scope{
  list-style:none;margin:0;padding:0;
  display:flex;flex-direction:column;
  border-top:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-scope li{
  display:flex;align-items:baseline;gap:8px;
  padding:6px 2px;
  font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
  border-bottom:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-scope li:last-child{border-bottom:none;}
[data-plugin="dsh-tokbook"] .dtpl-doc-chip{
  flex:none;display:inline-flex;align-items:center;
  height:18px;padding:0 7px;margin-top:1px;
  border-radius:999px;corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 13%,transparent);
  color:var(--dtpl-accent);
  font-size:10px;line-height:1;font-weight:600;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-chip-off{
  background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);
  color:var(--dtpl-fg-2);
  font-weight:500;
}

/* 差额从哪来：并排两条原因。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-gap{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-card{
  padding:11px 13px;min-width:0;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-title{
  display:flex;align-items:center;gap:6px;
  margin:0 0 6px;font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-title::before{
  content:"";flex:none;width:3px;height:12px;border-radius:2px;corner-shape:round;
  background:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-warn .dtpl-doc-gap-title{color:var(--dtpl-warn);}
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
  border-top:.5px dashed var(--dtpl-hairline);
  font-size:11.5px;line-height:18px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-gap-sum b{color:var(--dtpl-accent);font-weight:700;}

/* 怎么核对：字段映射，收进一个紧凑面板。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-map{
  display:flex;flex-direction:column;gap:5px;
  margin:2px 0 8px;padding:10px 12px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
  box-shadow:inset 0 0 0 .5px var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-row{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  font-size:12px;line-height:20px;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-row b{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-arrow{color:var(--dtpl-fg-3);flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-note{
  margin:2px 0 0;font-size:11.5px;line-height:17px;color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-map-note:first-of-type{margin-top:2px;}

/* 跨 tab 提示：订阅额度是另一套官方口径。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-quota{
  display:flex;flex-direction:column;gap:3px;
  margin:0 0 14px;padding:10px 13px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-accent) 6%,transparent);
  box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--dtpl-accent) 22%,transparent);
  font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-quota p{margin:0;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-doc-quota b{color:var(--dtpl-accent);font-weight:600;}

/* 数据文件诊断：一个紧凑盒子。 */
[data-plugin="dsh-tokbook"] .dtpl-doc-data{
  display:flex;flex-direction:column;gap:3px;
  margin:2px 0 6px;padding:10px 13px;
  border-radius:var(--dtpl-radius-sm);corner-shape:round;
  background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-line{
  margin:0;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-line b{color:var(--dtpl-fg);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-dir{
  margin:0;font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-doc-data-dir code{
  background:transparent;padding:0;font-size:.92em;
}

[data-plugin="dsh-tokbook"] .dtpl-doc-foot{
  margin-top:12px;padding-top:10px;
  border-top:.5px dashed var(--dtpl-border);
  font-size:11px!important;line-height:16px!important;color:var(--dtpl-fg-3)!important;
}
`
