/** styles.ts 片段：quota。由 `injectStyles` 按序拼接。 */
export const CSS_QUOTA = `/* 订阅额度 tab */
[data-plugin="dsh-tokbook"] .dtpl-quota-sec{display:flex;flex-direction:column;gap:16px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-intro{
  margin:0;font-size:12px;line-height:20px;color:var(--dtpl-fg-2);
}
/* 自动刷新：标签 + 选择器 + 实时状态。选择器与窗口 tab、总览子 tab、通道时间跨度共用
   同一条「横排 + 竖发丝分隔 + 底部实条」——全窗口只有一种「当前项」。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh{
  display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-label{
  color:var(--dtpl-fg-2);font-size:12px;line-height:18px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-seg{
  display:flex;align-self:flex-start;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt{
  position:relative;appearance:none;border:0;background:transparent;
  height:24px;padding:0 11px;
  font:inherit;font-size:11px;line-height:16px;font-weight:500;
  color:var(--dtpl-fg-3);white-space:nowrap;cursor:pointer;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt + .dtpl-quota-autorefresh-opt{border-left:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt:hover{color:var(--dtpl-fg);background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt.dtpl-quota-autorefresh-on{
  color:var(--dtpl-fg);font-weight:600;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-opt.dtpl-quota-autorefresh-on::after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-state{
  margin-left:auto;color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
}
/* 「每 N 分钟自动刷新」是**正在生效的机制**，不是健康状态：绿只留给真正的 ok，
   所以这条留在中性色——它旁边那颗实条已经说明选中的是哪一档。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-autorefresh-state.dtpl-quota-autorefresh-live{color:var(--dtpl-fg-2);}

[data-plugin="dsh-tokbook"] .dtpl-quota-cards{display:flex;flex-direction:column;gap:12px;}
/* 一张订阅卡 = 同一块读数面板（1px 硬边框 + 3% 洗色 + 金属反光）。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-card{
  padding:13px 15px 12px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
}
/* 卡片头：身份（环形量规 + 名称/副行）| 状态 chip + 刷新。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-head{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-bottom:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-id{
  display:flex;align-items:center;gap:10px;min-width:0;
}
/* 月度环形量规的预留槽；加载 / 出错 / 未配置（无环）时标题不位移。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-state-gap{
  flex:none;width:44px;height:44px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-id-text{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-quota-name{
  color:var(--dtpl-fg);font-size:14px;line-height:20px;font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-sub{
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-head-side{
  display:flex;align-items:center;gap:8px;flex:none;
  min-width:0;
}
/* 单卡刷新：紧凑图标钮，请求在飞时禁用。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh{
  display:inline-flex;align-items:center;justify-content:center;
  width:28px;height:28px;padding:0;
  border:none;background:transparent;color:var(--dtpl-fg-3);
  cursor:pointer;transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh:hover:not(:disabled){background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh:disabled{opacity:.45;cursor:default;}
/* 外层容器拥有一次性点击「pop」：靠 React key 重挂载。与字形分离，这样下面的加载 spinner（旋转）不会互相抵消。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim{
  display:inline-flex;align-items:center;justify-content:center;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh-anim.dtpl-quota-refresh-pop{
  animation:dtpl-refresh-pop .35s cubic-bezier(.34,1.56,.64,1);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-refresh-ico{width:15px;height:15px;display:block;}
/* 状态 chip（未配置 / 查询失败 / 无生效订阅）。上一版是纯色块（圆角 + 染色底 + 无边框），
   和总览的「黄牌 + 墨边」是两套语言；现在统一成**描边芯片 + 前置状态点**：
   边界由 1px 线给，色相只留给真正需要看的状态。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-chip{
  flex:none;display:inline-flex;align-items:center;gap:6px;
  height:20px;padding:0 8px;
  border:1px solid var(--dtpl-border);
  font-size:11px;line-height:16px;font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-chip::before{
  content:"";width:6px;height:6px;border-radius:50%;corner-shape:round;
  background:currentColor;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-chip-muted{
  color:var(--dtpl-fg-3);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-chip-err{
  color:var(--dtpl-err);
  border-color:color-mix(in srgb,var(--dtpl-err) 45%,transparent);
}
/* 余额门控 chip（无生效订阅）：不是错误——账号仍可用，只是不再按套餐滚动窗口节奏。
   文字走 --dtpl-warn-ink：裸 warn 在浅色下作 11px 正文只有 2.15:1（见 tokens 那条实测），
   混一档墨之后 5.57:1；边框这类非文本用途才用裸 warn（那里只要 3:1）。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-chip-gate{
  color:var(--dtpl-warn-ink);
  border-color:color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
}
/* 月度预算环形量规。环描边带色调，已用 % 数字居中在环*内*，它所指的预算以小号说明挂在数字下方，环从不静默地换含义。
   （真圆是这套直角语言里**写明的一处例外**——表盘本来就是个圆。） */
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge{
  position:relative;flex:none;width:44px;height:44px;
  color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-svg{width:44px;height:44px;display:block;}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-track{
  fill:none;stroke:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
  stroke-width:4;stroke-linecap:round;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-fill{
  fill:none;stroke:currentColor;stroke-width:4;stroke-linecap:round;
  transform:rotate(-90deg);transform-origin:50% 50%;
  transition:stroke-dasharray .4s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-n{
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:2px;
  color:inherit;font-family:var(--dtpl-mono);
  font-size:11px;line-height:1;font-weight:700;
  font-variant-numeric:tabular-nums;white-space:nowrap;
  pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-n i{
  font-style:normal;font-size:8px;line-height:1;font-weight:600;
  color:var(--dtpl-fg-3);margin-left:.5px;
}
/* 命名这个环所汇总的预算的小号说明。弱化，让色调数字仍是焦点。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-gauge-cap{
  font-size:8px;line-height:1;font-weight:600;color:var(--dtpl-fg-3);
}
/* 卡内消息面板（加载失败 / 未配置 / 拉取失败）：1px 硬边框，凹进去的一块说明面，
   不是又一层染色洗色块。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-msg{
  display:flex;flex-direction:column;align-items:flex-start;gap:2px;
  padding:10px 12px;margin:2px 0 6px;
  border:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-err{
  border-color:color-mix(in srgb,var(--dtpl-err) 45%,transparent);
  background:color-mix(in srgb,var(--dtpl-err) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-title{margin:0;font-size:12px;line-height:18px;font-weight:600;color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-err .dtpl-quota-msg-title{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg-body{
  margin:0;font-size:12px;line-height:18px;color:var(--dtpl-fg-2);
  overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-msg .dtpl-retry{margin-top:6px;}
/* ok 正文上方的 stale-while-revalidate 提示。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-stale{
  margin:0 0 8px;padding:6px 10px;
  border:1px solid color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
  background:color-mix(in srgb,var(--dtpl-warn) 8%,transparent);
  color:var(--dtpl-warn-ink);
  font-size:11px;line-height:16px;
}
/* 用量条：每个预算窗口一行，所有数据形态共用同一骨架。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-windows{display:flex;flex-direction:column;gap:12px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-window{display:flex;flex-direction:column;gap:5px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-line1{
  display:flex;align-items:baseline;justify-content:space-between;gap:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-label{
  color:var(--dtpl-fg);font-size:12px;line-height:18px;font-weight:600;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-metric{
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg-2);font-size:11px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar{
  display:block;width:100%;height:7px;
  background:color-mix(in srgb,var(--dtpl-fg) 12%,transparent);overflow:hidden;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill{
  display:block;height:100%;
  transition:width .4s ease,background-color .2s ease;
}
/* 健康态**不染色**：条与表盘的默认填充是次要墨色（与总览的占比条同一条）。
   这条很直接——如果默认状态就是绿的，绿只是「条的颜色」，不是信息；三根绿条还会成为整屏
   最响的东西，把「克制」花在一个不需要决策的状态上。收回中性之后，屏幕上出现的每一处
   色相都意味着「这里要看一眼」。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-tone-ok{color:var(--dtpl-fg-2);}
/* 告急/超限是**状态数字**，不是装饰——文字一律走 warn-ink（裸 warn 过不了 11px 正文的
   4.5:1）；条体这类非文本填充才用裸 warn，那里只要 3:1。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-tone-warn{color:var(--dtpl-warn-ink);}
[data-plugin="dsh-tokbook"] .dtpl-quota-tone-danger{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-ok{background:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-warn{background:var(--dtpl-warn);}
[data-plugin="dsh-tokbook"] .dtpl-quota-bar-fill.dtpl-quota-tone-danger{background:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-window-line2{
  display:flex;align-items:baseline;justify-content:space-between;gap:12px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-remaining{
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg);font-size:12px;line-height:18px;font-weight:600;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-window[data-tone="warn"] .dtpl-quota-remaining{color:var(--dtpl-warn-ink);}
[data-plugin="dsh-tokbook"] .dtpl-quota-window[data-tone="danger"] .dtpl-quota-remaining{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-quota-reset{
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-reset-limited{color:var(--dtpl-err);font-weight:600;}
/* 余额门控正文：余额顶在用量条该在的位置。余额没有分母，没有百分比可画，也没有环。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-balance{display:flex;align-items:baseline;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-balance-v{
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg);font-size:22px;line-height:27px;font-weight:600;
  font-variant-numeric:tabular-nums;letter-spacing:-.01em;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-balance-k{
  color:var(--dtpl-fg-3);font-size:11px;line-height:16px;font-weight:500;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-balance-note{
  margin:6px 0 0;font-size:11px;line-height:17px;color:var(--dtpl-fg-2);
}
/* 额度来源（月额度 / 已购 / 赠送）：余额下的一行紧凑说明——带加购额度的生效卡则在用量条下方。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-sources{
  margin:8px 0 0;font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;
}
/* 用量摘要活动条：**与总览的「今日词元构成」同一只框**——1px 硬边框 + 竖发丝分隔的读数格。
   上一版是一排各自染色的小圆角块，一块卡里因此有「面板 + 面板」两层盒子；
   现在它是一块面板里的分隔格，视线横着走一遍就够。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-stats{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:0;
  margin-top:12px;
  border:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat{
  display:flex;flex-direction:column;gap:2px;min-width:0;
  padding:9px 12px 10px;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat + .dtpl-quota-stat{border-left:1px solid var(--dtpl-border);}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat-v{
  display:flex;align-items:baseline;gap:6px;
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg);font-size:13px;line-height:19px;font-weight:600;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat-warn{
  font-family:var(--dtpl-mono);
  font-style:normal;font-size:10px;line-height:14px;font-weight:600;color:var(--dtpl-err);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-quota-stat-k{color:var(--dtpl-fg-2);font-size:11px;line-height:16px;}
/* 卡片头刷新钮前的新鲜度标签：官方数字何时拉回。它坐在卡片面板上、紧挨可交互控件，
   所以留在 fg-2 而不是降到三级色。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-updated{
  font-family:var(--dtpl-mono);
  color:var(--dtpl-fg-2);font-size:11px;line-height:16px;font-weight:400;
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 卡片正文形状的加载占位。 */
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-body{display:flex;flex-direction:column;gap:8px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-card{height:150px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-line{height:14px;width:55%;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-line-short{width:35%;}
[data-plugin="dsh-tokbook"] .dtpl-quota-sk-bar{height:7px;}
[data-plugin="dsh-tokbook"] .dtpl-quota-note{
  margin:10px 0 0;font-size:11px;line-height:16px;color:var(--dtpl-fg-3);
}

/* 「价格未知」提示的跨 tab 链接（总览 → 价格表，带着该筛选）。左边距自带：它紧跟在
   一串模型名之后，而 JSX 在标签边界上不会留下空格，靠源码里的空白对齐是脆的。
   链接不借强调色：这套语言里唯一有色相的 token 是品牌黄，它是身份色、不外借给「可点」
   ——可点由下划线 + 悬停底洗色说明，换任何皮肤都成立。 */
[data-plugin="dsh-tokbook"] .dtpl-pricing-empty-link{
  appearance:none;border:0;background:transparent;padding:0 1px;margin-left:6px;
  font:inherit;font-size:inherit;color:var(--dtpl-fg);
  cursor:pointer;text-decoration:underline;text-underline-offset:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-pricing-empty-link:hover{background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);}
`
