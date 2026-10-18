/** pricing 片段：必须排在 shared 之前（窄屏段覆盖这里的高度）。 */
export const CSS_PRICING = `
[data-plugin="dsh-tokbook"] .dtpl-price-sec{display:flex;flex-direction:column;gap:14px;}

/* 法定节假日年历：价表里唯一**全局**的一份数据，一年只改一次，而展开后比这一屏的主体还大
   ——所以它收在末尾、默认收起，头上那条缺年告警负责把人带过来。
   这一节的头是**一整条按钮**（见 .dtpl-price-cal-toggle）：它既是名字也是开关，
   所以它带闭合的边与悬停洗色，与这一屏其余「被读的行」明确分开。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal{
  display:flex;flex-direction:column;gap:8px;
  margin-top:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal[data-dirty="true"]{
  box-shadow:inset 2px 0 0 var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-head{
  display:flex;align-items:stretch;gap:6px;flex-wrap:wrap;
}
/* 整条头都是开关。热区 34px 高于这一屏其余控件（WCAG 2.2 SC 2.5.8 的下限是 24px）：
   它是**唯一的**展开入口，值得多给一点。
   **框**给这一条：它是这一屏唯一「能按的行头」，闭合的边让这件事静止可见；
   面用 6% 洗色（与主语行以下的分区带同档），悬停再深一档——按钮该有的三态都齐。
   三角由两段 border 拼成、开放时转 90°，所以开与合是同一个符号的两种朝向，不是两个字符。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle{
  appearance:none;box-sizing:border-box;
  display:flex;align-items:center;gap:8px;
  flex:1 1 260px;min-width:0;min-height:34px;
  padding:6px 10px;
  border:1px solid var(--dtpl-border);border-radius:var(--dtpl-radius);
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
  color:var(--dtpl-fg);font:inherit;cursor:pointer;text-align:left;
  transition:background .12s ease,border-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle:hover{
  background:color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
  border-color:color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle:active{
  background:color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
}
/* 三角：静止指向右（合），展开时朝下。只转这一枚符号，不换字。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-caret{
  flex:none;width:0;height:0;
  border-left:5px solid currentColor;
  border-top:4px solid transparent;border-bottom:4px solid transparent;
  transition:transform .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal[data-open="true"] .dtpl-price-cal-caret{
  transform:rotate(90deg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-title{flex:none;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-sum{
  min-width:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-warn{flex:none;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-warn-ink);font-weight:600;}
/* 右端那句「展开 / 收起」：它是这条按钮的**动作名**，所以推到最后、走 fg-2。
   有它这条才不像一个标题——标题不会在右端写「展开」。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-hint{
  flex:none;margin-left:auto;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
/* 缺年那一句由这一屏**顶部的告警**说（离眼睛更近），告警底走 warn 的 12%、正文走 warn-ink
   （warn 直接做正文只有 2.15:1）。这一节里只说动作，不重复那句话。 */
/* 恢复动作：与开关同一条带子、同高。它是这一节的**次要动作**，所以用框 + 告警底，
   不用下划线——下划线在这一屏已经统一退场（见 .dtpl-price-ghost 的注释）：
   能按的东西靠「面」说话，靠「线」说话的是能填的格。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-fix{
  appearance:none;box-sizing:border-box;flex:none;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  min-height:34px;padding:2px 10px;
  border:1px solid color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
  border-radius:var(--dtpl-radius);
  background:color-mix(in srgb,var(--dtpl-warn) 12%,transparent);
  color:var(--dtpl-warn-ink);
  font:inherit;font-size:var(--dtpl-fs-label);cursor:pointer;white-space:nowrap;
  transition:background .12s ease,border-color .12s ease,color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-fix:hover{
  border-color:var(--dtpl-warn-ink);
  background:color-mix(in srgb,var(--dtpl-warn) 20%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-body{display:flex;flex-direction:column;gap:6px;margin-top:2px;}[data-plugin="dsh-tokbook"] .dtpl-price-cal-note{margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);overflow-wrap:anywhere;}
/* 一年一组：组头是年份与它的读数，下面是这个年的每一段假期。年份换了一个，读的人也换了一件事。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year{display:flex;flex-direction:column;gap:4px;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year + .dtpl-price-cal-year{
  margin-top:4px;padding-top:8px;border-top:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year-num{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year-sum{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year-head .dtpl-price-ghost{margin-left:auto;}
/* 一段假期一行：起 ~ 止。两个日期格是**控件**，所以是盒子（成组重复的填数格那一档）；
   原生日历按钮收掉，宽度由它要装的东西定：一个 ISO 日期。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-date::-webkit-calendar-picker-indicator{display:none;}
/* 选择器带 .dtpl-price-cal 是必需的：后面那段 .dtpl-price-input（width:100% / text-align:right /
   只有一条底边）同权重、写在后面，不带上它就会被压成整行宽的一条底线（见「加一年」那一格）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date{
  width:118px;text-align:left;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);padding:0 6px;
  transition:border-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date:focus{border-color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday[data-bad="true"] .dtpl-price-cal-date{border-color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-tilde{flex:none;font-size:var(--dtpl-fs-label);color:var(--dtpl-fg-dim);}
/* 这一段的读数拿来对通知的「共 N 天」：等宽 + 定宽右对齐，一年里的几段成一条可竖扫的列。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday-tail{
  margin-left:auto;display:inline-flex;align-items:center;gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-days{
  min-width:48px;text-align:right;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-days[data-kind="partial"]{font-family:inherit;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday .dtpl-price-cell-err{
  flex:1 1 100%;text-align:left;white-space:normal;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-add{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year-k{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
/* 这一格是**盒子**不是刻线。选择器必须带上 .dtpl-price-cal，否则后面那段 .dtpl-price-input
   同权重、写在后面，会把这一格压成整行宽的一条底线（与日期格同一处坑）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-newyear{
  width:72px;text-align:center;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);padding:0 6px;
  transition:border-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-newyear:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-newyear:focus{border-color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-newyear[aria-invalid="true"]{border-color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-newyear-err{
  flex:1 1 auto;min-width:0;
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-err);overflow-wrap:anywhere;
}

/* 主语行 = 这一屏正在编辑谁。它是**导航**，不是内容：没有框、没有底色、只占一行高，
   所以打开这一屏第一眼看到的仍是那份价，而不是两个控件。
   两个下拉一行各一个，标签在下拉**左边**同一列——两行因此对齐成一条左缘，
   读起来是一句话（这条通道的 · 这个模型）。
   min-width:0 是必需的——grid 项的自动最小宽度是内容宽度，不给 0 的话长 route key
   会把整个带子顶宽、把原生下拉的插入符挤出浮窗外。 */
[data-plugin="dsh-tokbook"] .dtpl-price-pick{
  display:flex;flex-direction:column;gap:2px;
  border-bottom:1px solid var(--dtpl-border);padding-bottom:8px;
}
/* 主语行 = 这一屏正在编辑谁（哪条通道、哪个模型）。它是**导航**，不是内容：没有框、
   没有底色，所以打开这一屏第一眼看到的仍是那份价。
   两个字段**左右并排**：它们是同一句话的两半（这条通道的 · 这个模型），并排才读得成一句；
   上下摞起来会让它们看起来是两条互不相干的设置。
   窄处折成一列（见 shared 的窄屏段）——两列在手机宽度上会把每条值都截成「deepseek-o…」。 */
[data-plugin="dsh-tokbook"] .dtpl-price-pick{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
  column-gap:16px;row-gap:8px;align-items:start;
  border-bottom:1px solid var(--dtpl-border);padding-bottom:10px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-row{
  display:flex;flex-direction:column;gap:3px;min-width:0;
}
/* 字段名是要读的文本，走 fg-2（fg-3 只承载装饰）。13px：它与下面那张表的「生效范围」
   同档——两者都是「这一列是什么」的标注，同一档才读得成一套。 */
[data-plugin="dsh-tokbook"] .dtpl-price-pick-k{font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg-2);}
/* 下拉承载的是整条 route key / 模型串，而这是这一屏的主语——所以它比正文大一档、走 16px，
   按 36px 的触控热区给高（窄处要靠手指按）。
   选择器必须带上 .dtpl-price-pick 这一层：.dtpl-price-select 是同一份外观语言、同权重、
   写在本文件后面，不带这层就会被它压回 12px / 24px（外观归它，**尺寸不归**）。
   字体刻意**不**改成等宽：模型串与 route key 是身份不是数字，宽度由余量决定，不需要数字对齐。 */
[data-plugin="dsh-tokbook"] .dtpl-price-pick .dtpl-price-pick-sel{
  width:100%;height:36px;font-size:var(--dtpl-fs-lead);font-weight:500;
}
/* 汇率在第二行左边那一格，与「通道」同一列——它是全表共用的一份事实，不属于上面任何一条；
   占一格而不是整行，右边空着，读起来是「这一行还有别的字段」，不是一条另起的设置。 */
[data-plugin="dsh-tokbook"] .dtpl-price-pick > .dtpl-price-pick-row:last-child{grid-column:1;}
[data-plugin="dsh-tokbook"] .dtpl-price-fx{
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx-eq,
[data-plugin="dsh-tokbook"] .dtpl-price-fx-unit{font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);color:var(--dtpl-fg-2);}
/* 这一格是**盒子**不是刻线：它只装一个人写下的汇率。选择器带 .dtpl-price-fx 的理由同「加一年」。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in{
  width:80px;flex:none;text-align:center;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);padding:0 6px;
  font-size:var(--dtpl-fs-lead);
  transition:border-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in:focus{border-color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in[aria-invalid="true"]{border-color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-price-fx-note{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx-err{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-err);overflow-wrap:anywhere;
}

/* 选中模型的详情面。data-dirty 是**面板级**的指示：未落盘的改动只挂这一条墨痕。
   它是这一屏唯一带**框**的块——其余（主语行、汇率、年历）都不带框，因为它们是控件或
   全局数据；这一块是「选中模型的完整编辑面」，框把它与上面的导航区分开。 */
[data-plugin="dsh-tokbook"] .dtpl-price-detail{
  display:flex;flex-direction:column;gap:12px;
  padding:12px 14px 14px;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:var(--dtpl-metal);
}
[data-plugin="dsh-tokbook"] .dtpl-price-detail[data-dirty="true"]{
  box-shadow:
    inset 2px 0 0 var(--dtpl-fg),
    var(--dtpl-metal);
}

/* ── 此刻计费的价：这一屏的**主读数** ────────────────────────────────────────
   它比下面那张表大得多，因为读者打开这一屏要知道的是「我现在按多少钱在花」，
   而不是「有哪些格子可以填」。四档并排、数字走 24px——与总览页的读数格同一档，
   所以两个 tab 里「一个数」长得一样。 */
[data-plugin="dsh-tokbook"] .dtpl-price-live{
  display:flex;flex-direction:column;gap:6px;min-width:0;
  padding:10px 12px;
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-head{
  display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
}
/* 这一屏唯一的色相：前面那枚黄牌是全窗口「当前项」的那套工业徽记（与 .dtpl-sec-title::before、
   .dtpl-total-k::before 同一手法、同一几何），份额给了「此刻计费」——这一屏的当前项。
   黄压白卡只有 1.73:1，所以它只以实心块 + 墨边出现，不做文字色；四档价与峰谷时段读数一律不染黄——
   品牌黄是**身份色**，染到数据上会被读成「这一档更值得看」。 */
[data-plugin="dsh-tokbook"] .dtpl-price-live-k{
  display:inline-flex;align-items:center;gap:8px;
  font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);font-weight:500;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-k::before{
  content:"";flex:none;width:7px;height:13px;
  background:var(--dtpl-brand);
  box-shadow:inset 0 0 0 1px var(--dtpl-on-brand);
}
/* 单位后缀：它说明上面四个数是什么（每百万词元、哪种货币），所以贴在同一行末尾而不是藏进悬停。 */
[data-plugin="dsh-tokbook"] .dtpl-price-live-unit{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-live-cells{
  display:flex;align-items:baseline;gap:24px;flex-wrap:wrap;row-gap:8px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-cell{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-live-label{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-live-v{
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-figure);line-height:var(--dtpl-lh-figure);font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;letter-spacing:-.02em;
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-cell[data-bad="true"] .dtpl-price-live-v{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-price-live-none{
  margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-note{
  margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-detail-head{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;row-gap:4px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-detail-id{
  display:flex;align-items:baseline;gap:8px;flex:1 1 auto;min-width:0;
}
/* 身份是这一块唯一长度不可预测的值，所以也是唯一让位的值。 */
[data-plugin="dsh-tokbook"] .dtpl-price-name{
  flex:0 1 auto;min-width:0;
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 没有名字的行只靠精确串站立，所以不弱化、走等宽。判据是 TSX 上的 data-exact，
   不是 :only-child——否则命名与否会改变字体。 */
[data-plugin="dsh-tokbook"] .dtpl-price-name[data-exact="true"]{
  font-family:var(--dtpl-mono);
}
/* 账本的计费键：命名过才印第二遍，等宽、走 fg-2（它是**要读**的串，不是装饰）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-exact{
  flex:0 1 auto;min-width:0;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-reqs{
  flex:none;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}

/* 费率格的度量。宽度由费率能是什么决定，不是今天的数字：要装下最长的价（8 字符），
   数字必须等宽（比例体让同位数字错开，固定列就失去可比性）。80px = 8 字符价 + 两侧内边距。
   --dtpl-cell-pad-x 与列头共享：列头必须和下面那列数字结束在同一边缘。
   表里所有行（基准价与每个峰谷时段）共用这一个格宽，于是四档价在这一屏里是同一组读数。
   --dtpl-days-w 只由日档那一列用：峰谷时段的日档是下拉，宽度由最长的「法定工作日」定，
   于是所有行的钟点落在同一条竖线上。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sec{
  --dtpl-cell-pad-x:7px;
  --dtpl-rate-w:80px;
  --dtpl-rate-gap:8px;
  --dtpl-days-w:92px;
}

[data-plugin="dsh-tokbook"] .dtpl-price-issue{
  margin:0;padding:2px 10px 6px 10px;
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-err);
}
/* 计费性质切换走全窗口唯一的「当前项」语言（窗口 tab 条、总览子 tab 同款）；
   它是**通道**的属性，摆在选中模型的详情头右轨上（通道名已经进了下拉，它需要这个主语）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-switch{
  flex:none;display:flex;
  border-bottom:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button{
  position:relative;appearance:none;border:0;background:transparent;
  height:24px;padding:0 11px;
  color:var(--dtpl-fg);font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:400;
  white-space:nowrap;cursor:pointer;
  transition:background .15s ease,color .15s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button + button{border-left:.5px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button:hover{background:color-mix(in srgb,var(--dtpl-fg) 8%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button[aria-pressed="true"]{
  color:var(--dtpl-fg);font-weight:600;
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-switch button[aria-pressed="true"]::after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dtpl-fg);
}
/* 货币开关：读写的单位（¥ / $）。共用 .dtpl-price-switch 的样子，只是前面多一个字段名——
   两组紧挨着摆，没有名字就会被读成一条四格的带子。 */
[data-plugin="dsh-tokbook"] .dtpl-price-currency{
  flex:none;display:inline-flex;align-items:center;gap:6px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-currency-k{font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-currency .dtpl-price-switch button:disabled{opacity:.45;cursor:not-allowed;}
[data-plugin="dsh-tokbook"] .dtpl-price-currency .dtpl-price-switch button:disabled:hover{background:transparent;}

/* ── 四档价的**一张表** ─────────────────────────────────────────────────────
   基准价与每个峰谷时段是同一份价的三行（不是三块互不相干的表单），所以列头只写一遍：
   四档价的格名重复三遍，读者读到的是三张表，而它们其实是同一个人的同一份价。
   列宽由四档**读数**决定而不是今天的数字：80px 装得下最长的价（8 字符）＋两侧内边距。 */
[data-plugin="dsh-tokbook"] .dtpl-price-tbl{
  display:flex;flex-direction:column;min-width:0;
  border-top:1px solid var(--dtpl-border);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cols,
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);align-items:start;min-width:0;
}
/* 列头：与下面那几行同一个网格，所以「输入」「输出」精确落在各自那列数字的右缘上。
   它不画线——表头与表身之间那条线由行的上边距与留白给（见 .dtpl-price-row）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cols{
  padding:8px 0 4px;
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cols-n{text-align:right;padding-right:var(--dtpl-cell-pad-x);}
[data-plugin="dsh-tokbook"] .dtpl-price-cols-k{white-space:nowrap;}
/* 表身：行与行之间靠间距与一条发丝线分开（不画满框——那会让每行读成一张小卡片）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-rows{display:flex;flex-direction:column;min-width:0;}
/* 每一行之间靠**间距**分开，不画线（本仓库的规矩：面与面的分界是留白或一档底色）。
   悬停整行洗一层淡色，让它读起来是一行而不是散在四处的四个格子。 */
[data-plugin="dsh-tokbook"] .dtpl-price-row{
  padding:6px 0;
  transition:background .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-row + .dtpl-price-row{border-top:1px solid var(--dtpl-hairline);}
[data-plugin="dsh-tokbook"] .dtpl-price-row:hover{background:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);}
/* 零覆盖的时段与计价无关：整行退到一档，那句「不改写任何档」是它唯一要说的状态。 */
[data-plugin="dsh-tokbook"] .dtpl-price-row[data-inert="true"]{opacity:.75;}
/* 生效范围那一列：基准价是一句话（它没有控件），时段是两个钟点 ＋ 一行脚注。
   脚注那一行放时长与复制/删除——操作贴着它要改的那一行，而不在行尾漂着。
   这一列只占**余量**（四档价的列宽由读数定死），所以它会先让位：长 route 名与长时段说明
   在这里截断，而不是把四档价挤出浮窗。 */
[data-plugin="dsh-tokbook"] .dtpl-price-scope{display:flex;flex-direction:column;gap:3px;min-width:0;padding-right:8px;}
[data-plugin="dsh-tokbook"] .dtpl-price-scope-k{
  font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-scope-sub{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
/* 三个控件排一行，钟点用小号等宽——它们是这一行的**参数**，不该和四档价抢同一档体量。 */
[data-plugin="dsh-tokbook"] .dtpl-price-scope-ctl{
  display:inline-flex;align-items:center;gap:2px;flex-wrap:wrap;min-width:0;
  font-variant-numeric:tabular-nums;
}
/* 区间分隔符。左右两个框各自有 1px 边，破折号夹在中间要两边等距才不歪——
   所以给它对称的外距，而不是只靠 flex 的 gap（那样它会偏向其中一侧）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-scope-dash{
  flex:none;margin:0 2px;color:var(--dtpl-fg-3);font-size:var(--dtpl-fs-label);
}
[data-plugin="dsh-tokbook"] .dtpl-price-scope-foot{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;
}
/* 这一行的动作跟着它的生效范围走：常显（触控没有悬停）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-rowacts{
  display:inline-flex;align-items:center;gap:2px;flex:none;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell{display:flex;flex-direction:column;gap:1px;min-width:0;}
/* 格名在桌面由列头给（四档重复三遍=三张表）；只有窄屏折成 2×2 时它才出现，那时列头不再指向任何一列。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cell-k{
  display:none;font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
}
/* 一个输入格：**闭合的框**，与这一屏的下拉同一套控件语言（见 .dtpl-price-select）。
   以前这里是一条底边——那是「可编辑文本」的记号，但它旁边还坐着下拉框与文字动作，
   三种东西都用下划线表达，读者分不出哪个能展开、哪个能打字、哪个只是动作。
   现在统一：**框 = 能填**，**面 + 洗色 = 能按**，**没有记号 = 只能读**。 */
[data-plugin="dsh-tokbook"] .dtpl-price-input{
  width:100%;box-sizing:border-box;
  height:28px;padding:0 calc(var(--dtpl-cell-pad-x) - 1px);
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  border-radius:var(--dtpl-radius);
  background:transparent;color:var(--dtpl-fg);
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-lead);line-height:var(--dtpl-lh-lead);font-weight:500;
  font-variant-numeric:tabular-nums;text-align:right;
  transition:border-color .12s ease,background-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-input:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 42%,transparent);
  background:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
/* 空 = 继承：占位符报的是它沿用的那个数（缓存两档报的是按输入价算出来的**价**）。
   它是要读的数字，所以走 fg-2——dim 那一档压卡面只有 1.64:1（浅色）/ 2.50:1（深色），
   拿它报一个会被计费的数等于没报。「—」（还没填）跟着同一档，也仍不是数字。 */
[data-plugin="dsh-tokbook"] .dtpl-price-input::placeholder{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-input:focus{
  outline:none;border-color:var(--dtpl-fg);
  background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
/* 四档价那几格与上面同一条配方；留下这层是为了让「成阵列重复的填数格」有自己的注释位置
   （曾在这里单写过边框，现在合并了——同一套控件不该有两份外观规则）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cell .dtpl-price-input:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 42%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell[data-state="bad"] .dtpl-price-input{
  color:var(--dtpl-err);border-color:var(--dtpl-err);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell-err{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-err);text-align:right;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
/* 热区 24px（WCAG 2.2 SC 2.5.8 的下限），与同一行的复制/删除齐平。
   与文字动作同一套可点语言：无下划线，悬停浮出一层洗色。 */
[data-plugin="dsh-tokbook"] .dtpl-price-add{
  appearance:none;background:transparent;
  display:inline-flex;align-items:center;justify-content:center;
  min-height:24px;padding:2px 8px;
  border:0;border-radius:var(--dtpl-radius);
  color:var(--dtpl-fg);font:inherit;font-size:var(--dtpl-fs-label);letter-spacing:.08em;cursor:pointer;white-space:nowrap;
  transition:background-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-add:hover{
  background:color-mix(in srgb,var(--dtpl-fg) 9%,transparent);
}
/* 「＋ 加一段价」与「＋ 峰谷时段」是同一样东西：**幽灵行**——它占的是下一张卡的位置
   （同一个内容列、同一条左缘，一行高 30px）。
   幽灵只住在**盒子**里：边是比卡边更弱的一圈发丝线（8% 对 12%）、底是空的，字走主墨；
   悬停/按下只加**一层透明洗色**（不跟卡面调——段卡自己也在悬停时洗色）+ 一道明显更重的边。
   dashed 在本仓库是静态禁令（selfcheck:ui）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-add-ghost{
  appearance:none;box-sizing:border-box;
  display:flex;align-items:center;justify-content:flex-start;gap:6px;
  min-height:30px;padding:4px 8px;
  border:1px solid var(--dtpl-hairline);border-radius:var(--dtpl-radius);
  background:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:var(--dtpl-fs-label);letter-spacing:.08em;cursor:pointer;white-space:nowrap;
  transition:background .12s ease,border-color .12s ease;
}
/* ＋ 是图标不是文字：占一个固定列（两处幽灵行的标签因此落在同一条左缘，也不随字体回退漂），
   自己不吃标签那份字距。 */
[data-plugin="dsh-tokbook"] .dtpl-price-add-plus{
  flex:none;width:12px;text-align:center;letter-spacing:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-add-ghost:not(:disabled):hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 30%,transparent);
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-add-ghost:not(:disabled):active{
  border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
  background:color-mix(in srgb,var(--dtpl-fg) 11%,transparent);
}
/* 幽灵行也会被停用（年历「加一年」在年份还没写全时就停着）：停用态不接悬停/按下的洗色，
   只留一个「按不动」的样子。 */
[data-plugin="dsh-tokbook"] .dtpl-price-add-ghost:disabled{opacity:.45;cursor:not-allowed;}
/* 文字动作（复制 / 删除 / 查价 / 补价…）：**不带下划线**。
   下划线是「链接」的记号，而这个控件做的是就地动作，不是跳转；它又贴在数据行旁边，
   一条条下划线会让整块读起来像一堆超链接，把数字的注意力抢走。
   可点性改用**面**来说明：平时透明、悬停/聚焦时浮出一层洗色（与幽灵行同一套反馈），
   文字色同时提亮。形状给到 24px 高、4px 横向内边距——热区够，但不画边框，
   所以它不会和旁边的四档价输入框抢「这是个盒子」的意思。 */
[data-plugin="dsh-tokbook"] .dtpl-price-ghost{
  appearance:none;
  border:0;border-radius:var(--dtpl-radius);
  background:transparent;box-sizing:border-box;
  display:inline-flex;align-items:center;
  height:24px;padding:0 6px;
  color:var(--dtpl-fg-2);font:inherit;font-size:var(--dtpl-fs-label);cursor:pointer;
  transition:color .12s ease,background-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:hover{
  color:var(--dtpl-fg);
  background:color-mix(in srgb,var(--dtpl-fg) 9%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:active{
  background:color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger:hover{color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger[data-confirm="true"]{
  color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 12%,transparent);
}

/* 读面的洗色阶梯（一律以 --dtpl-card 为底，不逐层叠乘）：
     0%   窗面
     4%   「此刻计费」那块读数面
     6%   主语行以下的分区带
     11%   —— 这一档留作「比上面再高一档」的余量。 */

/* 「＋ 峰谷时段」是**幽灵行**，见 .dtpl-price-add-ghost。它跟在表的末行后面，
   与生效范围那一列同一条左缘（不对齐的话它读起来像另一张表的脚注）。 */
/* 「＋ 峰谷时段」跟表走同一条网格：它占的正是下一行（生效范围那一列），所以它的宽度
   是表的第一列而不是整张表的宽度。窄屏那张配方把它放回整宽（见 shared）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-addrow{
  display:grid;grid-template-columns:minmax(0,1fr) repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);min-width:0;margin-top:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-add-slot{grid-column:1;min-width:0;justify-self:start;}

/* ── 一天里谁在生效：24 格小时条 ────────────────────────────────────────────
   基准价是**默认**（它铺满全天，所以只走一档淡轨），每个带价的峰谷时段各占一行、
   把覆盖的小时点成实心墨。文字说不清「这一天还剩哪几小时没被覆盖」，这条说得清；
   它也替代了原来的表盘——盘只能编码「哪个窗口」，编码不了「哪一段被覆盖了」。
   一格是**色块**不是线。 */
[data-plugin="dsh-tokbook"] .dtpl-price-day{
  display:flex;flex-direction:column;gap:3px;min-width:0;
  padding-top:8px;border-top:1px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-row{
  display:grid;grid-template-columns:minmax(0,168px) minmax(0,1fr);
  align-items:center;column-gap:12px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-cells{
  display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:1px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-cell{
  height:9px;
  background:color-mix(in srgb,var(--dtpl-fg) 12%,transparent);
}
/* 基准价的轨道：它是底态、不是读数，所以只比空格深一档——满格实心墨会让这行变成一条黑杠。 */
[data-plugin="dsh-tokbook"] .dtpl-price-day-cell[data-on="base"]{
  background:color-mix(in srgb,var(--dtpl-fg) 28%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-day-cell[data-on="slot"]{background:var(--dtpl-fg);}
/* 刻度行：五处（0/6/12/18/24）摊在 24 格上，所以用同一条网格、每 6 格一个标签。 */
[data-plugin="dsh-tokbook"] .dtpl-price-day-axis{
  display:flex;justify-content:space-between;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-3);
  font-variant-numeric:tabular-nums;
}

/* 缺年告警：它是**要读**的一句话（金额会算错），所以留在这一屏最上面、不走折叠；
   但它只负责带路（展开年历），真正的「补上」按钮只有一个，在年历自己那一行里。 */
[data-plugin="dsh-tokbook"] .dtpl-price-calarm{
  display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
  padding:6px 8px;
  background:color-mix(in srgb,var(--dtpl-warn) 12%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-calarm-text{
  flex:1 1 auto;min-width:0;margin:0;
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-warn-ink);overflow-wrap:anywhere;
}
/* 恢复动作走**刻线**那一档，只是墨与边取告警那一档：方框留给幽灵行与成阵列重复的填数格。 */
/* 告警条里的动作：与 .dtpl-price-cal-fix 同形（框 + 告警底），不画下划线。
   它坐在一条告警底色的带子上，下划线在那种底上更难读，而框能立刻说清「这是个按钮」。 */
[data-plugin="dsh-tokbook"] .dtpl-price-calarm-act{
  appearance:none;box-sizing:border-box;flex:none;
  display:inline-flex;align-items:center;gap:6px;
  min-height:26px;padding:2px 10px;
  border:1px solid color-mix(in srgb,var(--dtpl-warn) 45%,transparent);
  border-radius:var(--dtpl-radius);
  background:color-mix(in srgb,var(--dtpl-warn) 14%,transparent);
  color:var(--dtpl-warn-ink);
  font:inherit;font-size:var(--dtpl-fs-label);cursor:pointer;white-space:nowrap;
  transition:background .12s ease,border-color .12s ease,color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-calarm-act:hover{
  border-color:var(--dtpl-warn-ink);
  background:color-mix(in srgb,var(--dtpl-warn) 24%,transparent);
}

/* 下拉：**闭合的框**，不是一条底线。
   一条底线是「可编辑文本」的记号（输入框、下划线链接），它自证不了「这里能展开一个列表」；
   而这个控件恰恰要自证——旁边就是四档价的输入框，用同一种下划线会让两种控件读成同一类。
   框 + 右端那枚向下的小三角，是「能展开」的两条线索，静止就看得见，不靠悬停。
   高 26px 与这一屏其余小控件同档；右内边距留给三角，文字不吃到它下面。 */
[data-plugin="dsh-tokbook"] .dtpl-price-select{
  appearance:none;height:26px;box-sizing:border-box;padding:0 16px 0 6px;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  border-radius:var(--dtpl-radius);
  background-color:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,var(--dtpl-fg-2) 50%),
    linear-gradient(135deg,var(--dtpl-fg-2) 50%,transparent 50%);
  background-position:calc(100% - 8px) 11px,calc(100% - 4px) 11px;
  background-size:4px 4px,4px 4px;background-repeat:no-repeat;
  font-variant-numeric:tabular-nums;
  transition:border-color .12s ease,background-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-select:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 42%,transparent);
  background-color:color-mix(in srgb,var(--dtpl-fg) 4%,transparent);
}
/* 聚焦：边框压到主墨。不用 outline——这一屏的焦点语言是「面 + 边」，不是环（见 footer 的先例）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-select:focus{
  outline:none;border-color:var(--dtpl-fg);
  background-color:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);
}
/* 原生下拉面板：option 继承控件字色，深肤主墨近白、落在浏览器默认白底上读不出。
   面板底与字显式声明成卡面 + 主墨（Chromium 会按 option 底色重绘面板，浏览器蓝随之消失）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-select option{
  background:var(--dtpl-card);color:var(--dtpl-fg);
}
/* 宽度由**闭合框**的实际需要重新定：左右的 1px 边 + 6px 内边距，右端还要让出三角
   （右内边距 18px 已经含它）。所以日档 = 「法定工作日」5 字（14px × 5 ≈ 70）+ 边 2 + 左 6 + 右 18 ≈ 96；
   钟点 = 「09:00」5 字符等宽（≈ 44）+ 边 2 + 左 6 + 右 18 ≈ 70。
   这两个数是**下限**而不是定宽的另一半：下划线时代它们按「底线」算（省掉左右边），
   换闭合框之后不够了——实测出现过「周一至周…」「09:0…」被截断。 */
[data-plugin="dsh-tokbook"] .dtpl-price-select-days{width:var(--dtpl-days-w);}
[data-plugin="dsh-tokbook"] .dtpl-price-select-hour{width:68px;font-family:var(--dtpl-mono);}
/* 这一屏的口径说明：它要读，所以走 fg-2；不缩进，与上面那张表的左缘对齐。 */
[data-plugin="dsh-tokbook"] .dtpl-price-note{margin:0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);}

/* 状态文字出现/换文案/消失都不许推动别的东西：它独占一行（选择带下面那条窄带），
   出现时只把下面的详情推下去一点点；max-width 是长句的保险（在自己盒子里折行）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-state{
  max-width:min(100%,420px);
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saved{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saving{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-invalid{color:var(--dtpl-warn-ink);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-error{color:var(--dtpl-err);font-weight:600;}

/* models.dev 补价条：与保存状态条同宽同调，但它是自己的窄带——同步是这一屏自己的事，
   跟「这次写没写进去」是两句话。文字与按钮两端分开，窄屏折行。 */
[data-plugin="dsh-tokbook"] .dtpl-price-syncbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-sync-state{
  max-width:min(100%,420px);
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);overflow-wrap:anywhere;
}

/* 骨架屏按这一屏真实的排法分段，高度是实测值：任务是首屏别整体下跳，不是预告行数。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sk-pick{height:78px;}
[data-plugin="dsh-tokbook"] .dtpl-price-sk-open{height:214px;}

[data-plugin="dsh-tokbook"] .dtpl-price-empty-act{margin-top:12px;}

/* 「查价」面板：挂在补价条之下的一块独立内容——它跟补价是两句话（补价说「自动补
 *  了多少洞」，这一块说「你选了哪一份价」），所以不挤同一条状态。窄屏下关键词与
 *  按钮会折行，候选列表跟着走。 */
[data-plugin="dsh-tokbook"] .dtpl-price-lookup{
  margin:8px 0 0;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  padding:10px 12px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-head{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-k{
  font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-input{
  flex:1 1 220px;min-width:0;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  padding:0 6px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-input:focus{outline:none;border-color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-list{list-style:none;margin:8px 0 0;padding:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-item{
  display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center;
  padding:6px 0;border-top:1px solid color-mix(in srgb,var(--dtpl-fg) 10%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-item.is-exact{background:color-mix(in srgb,var(--dtpl-fg) 6%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-id{
  display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0;
  font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-body);line-height:var(--dtpl-lh-body);color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-provider{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-slash{color:var(--dtpl-fg-3);}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-name{
  grid-column:1;margin:2px 0 0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-cost{
  grid-column:2;font-family:var(--dtpl-mono);font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg);
  white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-badge{
  font-size:var(--dtpl-fs-micro);line-height:var(--dtpl-lh-micro);color:var(--dtpl-fg-2);
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  padding:0 4px;border-radius:var(--dtpl-radius);
}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-empty{
  margin:8px 0 0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-fg-2);
}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-empty .dtpl-price-ghost{margin-left:4px;}
[data-plugin="dsh-tokbook"] .dtpl-price-lookup-note{
  margin:6px 0 0;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);color:var(--dtpl-warn-ink);
}
`
