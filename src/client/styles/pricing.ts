/** pricing 片段：必须排在 shared 之前（窄屏段覆盖这里的高度）。 */
export const CSS_PRICING = `
[data-plugin="dsh-tokbook"] .dtpl-price-sec{display:flex;flex-direction:column;gap:14px;}

/* 法定节假日年历：价表里唯一**全局**的一份数据，所以挂在这一屏的最上面，缺年时它自己报出来。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal{
  display:flex;flex-direction:column;gap:6px;
  padding:8px 10px;
  border:1px solid var(--dtpl-border);
  background:color-mix(in srgb,var(--dtpl-fg) 4%,var(--dtpl-card));
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal[data-dirty="true"]{
  box-shadow:inset 2px 0 0 var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
/* 整条头都是开关。热区 24px 与这一屏其余控件同一个下限（WCAG 2.2 SC 2.5.8）：它是**唯一的**展开入口。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle{
  appearance:none;background:transparent;border:0;cursor:pointer;padding:0;
  display:inline-flex;align-items:center;gap:5px;min-height:24px;
  font-size:11px;line-height:16px;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle:hover{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-caret{font-size:9px;color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-sum{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-warn{font-size:11px;line-height:16px;color:var(--dtpl-warn-ink);font-weight:600;}
/* 缺年告警：它是**要读**的一句话（与状态条同档），它说的那件事有且只有一个动作——补上。
   底走 warn 的 12%、正文走 warn-ink（warn 直接做正文只有 2.15:1）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-miss{
  display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
  padding:6px 8px;
  background:color-mix(in srgb,var(--dtpl-warn) 12%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-miss-text{
  flex:1 1 auto;min-width:0;margin:0;
  font-size:11px;line-height:16px;color:var(--dtpl-warn-ink);overflow-wrap:anywhere;
}
/* 恢复动作走**刻线**那一档，只是墨与边取告警那一档：方框留给幽灵行与成阵列重复的填数格。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-fix{
  appearance:none;box-sizing:border-box;flex:none;
  display:inline-flex;align-items:center;gap:6px;
  min-height:24px;padding:2px 8px;
  border:0;border-bottom:1px solid color-mix(in srgb,var(--dtpl-warn) 55%,transparent);
  background:transparent;color:var(--dtpl-warn-ink);
  font:inherit;font-size:11px;letter-spacing:.08em;cursor:pointer;white-space:nowrap;
  transition:background .12s ease,border-color .12s ease,color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-fix:hover{
  border-bottom-color:var(--dtpl-warn-ink);
  background:color-mix(in srgb,var(--dtpl-warn-ink) 12%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-body{display:flex;flex-direction:column;gap:6px;margin-top:2px;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-note{margin:0;font-size:11px;line-height:16px;color:var(--dtpl-fg-2);overflow-wrap:anywhere;}
/* 一年一组：组头是年份与它的读数，下面是这个年的每一段假期。年份换了一个，读的人也换了一件事。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year{display:flex;flex-direction:column;gap:4px;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year + .dtpl-price-cal-year{
  margin-top:4px;padding-top:8px;border-top:.5px solid var(--dtpl-hairline);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year-num{
  font-family:var(--dtpl-mono);font-size:12px;line-height:16px;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year-sum{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
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
[data-plugin="dsh-tokbook"] .dtpl-price-cal-tilde{flex:none;font-size:11px;color:var(--dtpl-fg-dim);}
/* 这一段的读数拿来对通知的「共 N 天」：等宽 + 定宽右对齐，一年里的几段成一条可竖扫的列。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday-tail{
  margin-left:auto;display:inline-flex;align-items:center;gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-days{
  min-width:48px;text-align:right;
  font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-days[data-kind="partial"]{font-family:inherit;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday .dtpl-price-cell-err{
  flex:1 1 100%;text-align:left;white-space:normal;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-add{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year-k{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
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
  font-size:10px;line-height:14px;color:var(--dtpl-err);overflow-wrap:anywhere;
}

/* 选择带 = 这一屏的**唯一**导航面：两个下拉，一行一个。
   min-width:0 是必需的——grid 项的自动最小宽度是内容宽度，不给 0 的话长 route key
   会把整个带子顶宽、把原生下拉的插入符挤出浮窗外。 */
[data-plugin="dsh-tokbook"] .dtpl-price-pick{
  display:flex;flex-direction:column;gap:8px;
  padding:10px;
  border:1px solid var(--dtpl-border);
  background:color-mix(in srgb,var(--dtpl-fg) 6%,var(--dtpl-card));
  box-shadow:var(--dtpl-metal);
}
[data-plugin="dsh-tokbook"] .dtpl-price-pick-row{
  display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;column-gap:10px;
}
/* 字段名是要读的文本，走 fg-2（fg-3 只承载装饰）；与下面四档价格子里的格名同一档。 */
[data-plugin="dsh-tokbook"] .dtpl-price-pick-k{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
/* 下拉占满余量：选择带只有这两行，值得把宽度给足。26px 高与体积里的下拉同档，
   但文字走 12px 而不是 11px——它承载的是整条 route key，不是「工作日」。
   字体刻意**不**改成等宽：模型串与 route key 是身份不是数字，这两个盒子的宽度由余量决定，
   不需要数字对齐；外观走 .dtpl-price-select 那条语言（同文件在后面，同权重下它赢）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-pick-sel{
  width:100%;height:26px;font-size:12px;
}
/* 汇率那一行：1 美元 = [ 7.15 ] 元，句尾跟一句反向读数。它是**全表共用的一份事实**，
   所以和两个下拉同住这条带子；句尾那句是要读的文本，走 fg-2。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fx{
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx-eq,
[data-plugin="dsh-tokbook"] .dtpl-price-fx-unit{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
/* 这一格是**盒子**不是刻线：它只装一个人写下的汇率。选择器带 .dtpl-price-fx 的理由同「加一年」。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in{
  width:72px;flex:none;text-align:center;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);padding:0 6px;
  transition:border-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in:focus{border-color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in[aria-invalid="true"]{border-color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-price-fx-note{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx-err{
  font-size:10px;line-height:14px;color:var(--dtpl-err);overflow-wrap:anywhere;
}

/* 选中模型的详情面。data-dirty 是**面板级**的指示：未落盘的改动只挂这一条墨痕。 */
[data-plugin="dsh-tokbook"] .dtpl-price-detail{
  display:flex;flex-direction:column;gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-detail[data-dirty="true"]{
  box-shadow:inset 2px 0 0 var(--dtpl-fg);
}
/* 只读的「当前生效」读数：纯展示——不带框、不坐刻线；数字与格子里的编辑面同源（draft 的 ratesInForce）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-live{
  display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;row-gap:2px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-k{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-live-cell{display:inline-flex;align-items:baseline;gap:5px;}
[data-plugin="dsh-tokbook"] .dtpl-price-live-label{font-size:10px;line-height:14px;letter-spacing:.15em;color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-live-v{
  font-family:var(--dtpl-mono);font-size:14px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-live-cell[data-bad="true"] .dtpl-price-live-v{color:var(--dtpl-err);}
[data-plugin="dsh-tokbook"] .dtpl-price-live-none{
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
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
  font-size:13px;line-height:18px;font-weight:600;color:var(--dtpl-fg);
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
  font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-reqs{
  flex:none;font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}

/* 费率格的度量。宽度由费率能是什么决定，不是今天的数字：要装下最长的价（8 字符），
   数字必须等宽（比例体让同位数字错开，固定列就失去可比性）。80px = 8 字符价 + 两侧内边距。
   --dtpl-cell-pad-x 与单元格的标签共享：标签必须和下面的数字结束在同一边缘。
   两处费率带（基准价、每个峰谷时段）共用这一个格宽，于是四档价在这一屏里是同一组
   读数；基准价与峰谷子目同构——都是「行首一枚盘/一个点，四档价从它右缘起排」。
   --dtpl-days-w 只由日档那一列用：峰谷时段的日档是下拉，宽度由最长的「法定工作日」定，
   于是所有子目的钟点落在同一条竖线上。
   --dtpl-slot-indent 是时段卡那一列的左让位（栅栏占掉的那一列）：**两个用户**——时段卡自己的
   左内边距，和「＋ 峰谷时段」那条幽灵行（它占的正是下一张时段卡的位置）。它的值 = 盘列宽 +
   基准价行间距（40+14），于是子目的四档价与基准价的四档价落在同一组竖线上——改盘列或间距
   任何一边都要重量这条对齐；窄屏那份配方（shared 的 29px）也只需要改这一个数。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sec{
  --dtpl-cell-pad-x:7px;
  --dtpl-rate-w:80px;
  --dtpl-rate-gap:8px;
  --dtpl-days-w:80px;
  --dtpl-slot-indent:54px;
}

[data-plugin="dsh-tokbook"] .dtpl-price-issue{
  margin:0;padding:2px 10px 6px 10px;
  font-size:10px;line-height:15px;color:var(--dtpl-err);
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
  color:var(--dtpl-fg);font:inherit;font-size:11px;line-height:16px;font-weight:400;
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
[data-plugin="dsh-tokbook"] .dtpl-price-currency-k{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-currency .dtpl-price-switch button:disabled{opacity:.45;cursor:not-allowed;}
[data-plugin="dsh-tokbook"] .dtpl-price-currency .dtpl-price-switch button:disabled:hover{background:transparent;}

/* 四个格子：段卡的基准价与峰谷时段共用同一套度量（等宽是列宽的前提）与同一个左缘。
   四格**紧挨成一簇**，不摊到整行——摊开后相邻两个数之间空出一大段，四档价就不再是一组可比
   读数，成了四个孤立的数；留白归行尾，不塞进格与格之间。 */
[data-plugin="dsh-tokbook"] .dtpl-price-rates{
  display:grid;grid-template-columns:repeat(4,var(--dtpl-rate-w));
  column-gap:var(--dtpl-rate-gap);min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell{display:flex;flex-direction:column;gap:1px;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-cell-k{
  display:none;font-size:10px;line-height:14px;letter-spacing:.2em;color:var(--dtpl-fg-2);
}
/* 可触物静止就带记：**刻线**给一次性的值、菜单与动作（静止 22% → hover 45% → 聚焦主墨，
   outline 关掉），**框**给四档价那几格——成阵列重复的填数格，闭合的边让「哪儿能填」静止可见；
   纯展示文字不带记，一律 fg-2。 */
[data-plugin="dsh-tokbook"] .dtpl-price-input{
  width:100%;box-sizing:border-box;
  height:28px;padding:0 var(--dtpl-cell-pad-x);
  border:0;border-bottom:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  background:transparent;color:var(--dtpl-fg);
  font-family:var(--dtpl-mono);font-size:14px;line-height:18px;font-weight:500;
  font-variant-numeric:tabular-nums;text-align:right;
  transition:border-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-input:hover{
  border-bottom-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
/* 空 = 继承：占位符报的是它沿用的那个数（缓存两档报的是按输入价算出来的**价**）。
   它是要读的数字，所以走 fg-2——dim 那一档压卡面只有 1.64:1（浅色）/ 2.50:1（深色），
   拿它报一个会被计费的数等于没报。「—」（还没填）跟着同一档，也仍不是数字。 */
[data-plugin="dsh-tokbook"] .dtpl-price-input::placeholder{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-input:focus{
  outline:none;border-bottom-color:var(--dtpl-fg);
}
/* 四档价的格子成框：内边距减掉那 1px 边，数字与格名仍结束在同一边缘。 */
[data-plugin="dsh-tokbook"] .dtpl-price-rates .dtpl-price-input{
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  padding:0 calc(var(--dtpl-cell-pad-x) - 1px);
}
[data-plugin="dsh-tokbook"] .dtpl-price-rates .dtpl-price-input:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-rates .dtpl-price-input:focus{border-color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-cell[data-state="bad"] .dtpl-price-input{
  color:var(--dtpl-err);border-color:var(--dtpl-err);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cell-err{
  font-size:10px;line-height:14px;color:var(--dtpl-err);text-align:right;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
/* 热区 24px（WCAG 2.2 SC 2.5.8 的下限），与同一行的复制/删除齐平。 */
[data-plugin="dsh-tokbook"] .dtpl-price-add{
  appearance:none;background:transparent;
  display:inline-flex;align-items:center;justify-content:center;
  min-height:24px;padding:1px 2px;
  border:0;border-bottom:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  color:var(--dtpl-fg);font:inherit;font-size:11px;letter-spacing:.08em;cursor:pointer;white-space:nowrap;
  transition:border-color .12s ease,background-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-add:hover{
  border-bottom-color:var(--dtpl-fg);
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
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
  font:inherit;font-size:11px;letter-spacing:.08em;cursor:pointer;white-space:nowrap;
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
[data-plugin="dsh-tokbook"] .dtpl-price-ghost{
  appearance:none;
  border:0;border-bottom:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  background:transparent;box-sizing:border-box;
  height:24px;padding:0 8px;
  color:var(--dtpl-fg-2);font:inherit;font-size:11px;cursor:pointer;
  transition:color .12s ease,border-color .12s ease,background-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:hover{
  color:var(--dtpl-fg);border-bottom-color:var(--dtpl-fg);
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger:hover{color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 10%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost-danger[data-confirm="true"]{
  color:var(--dtpl-err);background:color-mix(in srgb,var(--dtpl-err) 10%,transparent);
}

/* 读面的洗色阶梯（一律以 --dtpl-card 为底，不逐层叠乘）：
     0%   窗面
     6%   选择带
     11%   —— 这一档留作「比选择带再高一档」的余量。 */

/* 价的主体：基准价一行 + 它下面的峰谷时段。与详情头隔开 8px（.dtpl-price-detail 的 gap）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-body{
  display:flex;flex-direction:column;gap:6px;
  padding:2px 0 1px;
}
/* 「＋ 峰谷时段」是**幽灵行**，见 .dtpl-price-add-ghost。 */
[data-plugin="dsh-tokbook"] .dtpl-price-band{display:flex;min-width:0;margin-top:4px;}
[data-plugin="dsh-tokbook"] .dtpl-price-add-slot{flex:1 1 auto;min-width:0;}
/* 上面有时段组时让位到时段卡那一列（它占的正是下一张时段卡的位置）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slots + .dtpl-price-band .dtpl-price-add-slot{
  margin-left:var(--dtpl-slot-indent);
}

/* 基准价是**一行**：满弧盘坐在行首当这一行的索引（它的尺寸随时段数长，见 editors 的 DayDial），
   四档价从盘右起排。峰谷子目与这一行同构。
   间距给到盘的最大右缘（盘心 20 + 半宽 33.5）之外：圈数再多也不压第一格。 */
[data-plugin="dsh-tokbook"] .dtpl-price-allday{
  display:flex;align-items:center;gap:14px;min-width:0;
}
/* 盘心钉在 x=20——与下方峰谷子目的竖轨（脊线 20px、圆点中心 20px）同一条线。
   定宽列 + 居中让盘无论几圈都以此为心：超出列宽的大圈对称溢出，中心不随圈数漂移。 */
[data-plugin="dsh-tokbook"] .dtpl-price-dial-col{
  flex:none;width:40px;display:flex;align-items:center;justify-content:center;
}
[data-plugin="dsh-tokbook"] .dtpl-price-allday-body{flex:1 1 auto;min-width:0;}
/* 峰谷时段是段卡里的**一层**：直接坐在段卡面上，条目身份由脊线上的圆点说。
   左边那一列让给栅栏（--dtpl-slot-indent）。
   竖轨是**一条**、贯穿整组（逐条分段会在每个点上留一处断口），两端渐隐；
   它在圆点那几行被挖掉一个洞——1px 的轨从 7px 的实心点里穿过去会画出深色竖纹；
   洞按点的直径挖，两端各留 1px 抗锯齿。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slots{
  --dtpl-rail-ink:color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  position:relative;display:flex;flex-direction:column;margin-top:1px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slots-spine{
  position:absolute;left:20px;top:0;bottom:0;width:1px;
  background:linear-gradient(180deg,transparent,var(--dtpl-rail-ink) 16px,
      var(--dtpl-rail-ink) calc(100% - 20px),transparent),
    linear-gradient(90deg,transparent 16.5px,var(--dtpl-card) 16.5px 22.5px,transparent 22.5px);
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot{
  /* 让位 --dtpl-slot-indent 交给本盒的内边距：栅栏按它定位，卡片按它缩进。
     这条让位同时是「＋ 峰谷时段」幽灵行的 margin-left，所以它写在变量里（见 .dtpl-price-sec 的度量块）。 */
  padding:10px 0 0 var(--dtpl-slot-indent);
  position:relative;
}
/* 子目没有自己的壳：它是一行内容，身份由脊线上的圆点说。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-card{
  display:flex;flex-direction:column;gap:5px;min-width:0;
}
/* 栅栏：圆点绝对定位（基准是**本槽**，和竖轨同一个坐标系）——点的圆心按算术钉在
   竖轨上，锚点是头行那个下拉盒的中线（头行在窄处会折成两行，所以不能锚整行中心）。
   z-index 把点压在共用的那条轨之上。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-rail{
  position:absolute;left:0;top:0;bottom:0;width:50px;pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-dot{
  position:absolute;left:16.5px;top:22px;transform:translateY(-50%);
  width:7px;height:7px;border-radius:50%;background:var(--dtpl-fg);
  z-index:1;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-head{
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;
}
/* 基准价那一行的表盘。颜色只活在样式里（组件不写 var() 描边——selfcheck 会把它误读成类）；
   半径、弧长与起点都是几何，留在属性上。
   **宽高也留在属性上**：盘的尺寸随时段数长（见 editors 的 DayDial），一份 CSS 宽度写不死它——
   窄屏不另给尺寸，盘本来就比一行字大得多，窄 sheet 那点宽度容得下它最长的那一档。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-ring{flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-ring-track{
  fill:none;stroke:color-mix(in srgb,var(--dtpl-fg) 16%,transparent);stroke-width:1;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-ring-arc{fill:none;stroke:var(--dtpl-fg);stroke-width:2;}
/* 零点刻钉：一条贯穿整个环带的细索引（1 单位，弧的一半），走 fg 的 30%——它是**索引**不是数据，
   所以比任何一段弧都轻。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-ring-zero{
  stroke:color-mix(in srgb,var(--dtpl-fg) 30%,transparent);stroke-width:1;
}
/* 时长是派生的读数：它是读出来的**数**，不是分隔符，所以不吃 dim 那一档、走 fg-2。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-span{
  margin-left:2px;font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
}
/* 零覆盖的时段与计价无关：整条退到一档（四格降不透明度），那句「未改写任何档」是它唯一要说的状态——
   它是要读的一句话，所以同样是 fg-2。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot[data-inert="true"] .dtpl-price-rates{opacity:.75;}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-inert{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
/* 时段头上的复制/删除：focus-within 常显（触控没有悬停，可达性不靠 hover）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-actions{
  margin-left:auto;display:inline-flex;align-items:center;gap:2px;
  opacity:0;transition:opacity .12s ease;
}
/* 日档与钟点之间坐一道 .5px 竖发丝线（与计费性质切换同一词汇）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-clock{
  display:inline-flex;align-items:center;gap:4px;
  margin-left:2px;padding-left:8px;border-left:.5px solid var(--dtpl-hairline);
  font-family:var(--dtpl-mono);
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-dash{color:var(--dtpl-fg-3);font-size:11px;}
[data-plugin="dsh-tokbook"] .dtpl-price-select{
  appearance:none;height:24px;box-sizing:border-box;padding:0 16px 0 2px;
  border:0;border-bottom:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  background-color:transparent;color:var(--dtpl-fg);
  font:inherit;font-size:12px;line-height:18px;cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,var(--dtpl-fg-2) 50%),
    linear-gradient(135deg,var(--dtpl-fg-2) 50%,transparent 50%);
  background-position:calc(100% - 8px) 10px,calc(100% - 4px) 10px;
  background-size:4px 4px,4px 4px;background-repeat:no-repeat;
  font-variant-numeric:tabular-nums;
  transition:border-color .12s ease;
}
[data-plugin="dsh-tokbook"] .dtpl-price-select:hover{border-bottom-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-select:focus{outline:none;border-bottom-color:var(--dtpl-fg);}
/* 原生下拉面板：option 继承控件字色，深肤主墨近白、落在浏览器默认白底上读不出。
   面板底与字显式声明成卡面 + 主墨（Chromium 会按 option 底色重绘面板，浏览器蓝随之消失）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-select option{
  background:var(--dtpl-card);color:var(--dtpl-fg);
}
/* 列宽给到「法定工作日」(12px × 5 字) + 左 2px + 右 16px（三角）；一行里三个下拉的三角到各自值的距离必须一致。 */
[data-plugin="dsh-tokbook"] .dtpl-price-select-days{width:var(--dtpl-days-w);padding-right:8px;}
[data-plugin="dsh-tokbook"] .dtpl-price-base-rates .dtpl-price-cell-k,
[data-plugin="dsh-tokbook"] .dtpl-price-slot-rates .dtpl-price-cell-k{display:block;text-align:right;padding-right:var(--dtpl-cell-pad-x);}
[data-plugin="dsh-tokbook"] .dtpl-price-slot:hover .dtpl-price-slot-actions,
[data-plugin="dsh-tokbook"] .dtpl-price-slot:focus-within .dtpl-price-slot-actions{opacity:1;}
/* 这一屏的口径说明：它要读，所以走 fg-2；不缩进，与上面那行基准价的四档价左缘对齐。 */
[data-plugin="dsh-tokbook"] .dtpl-price-note{margin:0;font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}

/* 状态文字出现/换文案/消失都不许推动别的东西：它独占一行（选择带下面那条窄带），
   出现时只把下面的详情推下去一点点；max-width 是长句的保险（在自己盒子里折行）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-state{
  max-width:min(100%,420px);
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);overflow-wrap:anywhere;
}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saved{color:var(--dtpl-ok);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-saving{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-invalid{color:var(--dtpl-warn-ink);}
[data-plugin="dsh-tokbook"] .dtpl-price-state.is-error{color:var(--dtpl-err);font-weight:600;}

/* 骨架屏按这一屏真实的排法分段，高度是实测值：任务是首屏别整体下跳，不是预告行数。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sk-pick{height:78px;}
[data-plugin="dsh-tokbook"] .dtpl-price-sk-open{height:214px;}

[data-plugin="dsh-tokbook"] .dtpl-price-empty-act{margin-top:12px;}
`
