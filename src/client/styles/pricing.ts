/** pricing 片段：必须排在 shared 之前（窄屏段覆盖这里的高度）。 */
export const CSS_PRICING = `
[data-plugin="dsh-tokbook"] .dtpl-price-sec{display:flex;flex-direction:column;gap:14px;}

/* 法定节假日年历：价比表里唯一**全局**的一份数据，所以它挂在这一屏的最上面、
   与选择带同一档的框，缺年时它自己报出来（workdays 的准确性全靠它）。 */
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
/* 整条头都是开关：年历平时只是个注脚，展开才是一份数据。热区 24px——与这一屏其余控件
   同一个下限（WCAG 2.2 SC 2.5.8）：它是**唯一的**展开入口，靠住一行 16px 高的字不够。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle{
  appearance:none;background:transparent;border:0;cursor:pointer;padding:0;
  display:inline-flex;align-items:center;gap:5px;min-height:24px;
  font-size:11px;line-height:16px;font-weight:600;color:var(--dtpl-fg);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-toggle:hover{color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-caret{font-size:9px;color:var(--dtpl-fg-2);}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-sum{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
/* 年报指名到年、摆在头里：收起时下面那些原因看不到，只说「有年份写不出来」等于把地点藏起来。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-warn{font-size:11px;line-height:16px;color:var(--dtpl-warn-ink);font-weight:600;}
/* 缺年告警：它是**要读**的一句话（与状态条同档），而它说的那件事有且只有一个动作——
   补上国家公布的安排。那颗按钮因此住进这一框、共用同一条左缘，而不是让人先想清楚该怎么加。
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
/* 恢复动作走**刻线**（一次性动作的那一档，与 .dtpl-price-add / .dtpl-price-ghost 同记），
   只是墨与边取告警那一档：方框在本仓库留给幽灵行与成阵列重复的填数格，动作不吃框。 */
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
/* 一年一组：组头是年份与它的读数（几段假期、共几天），下面是这个年的每一段假期。
   组与组之间用一道发丝线分开——年份换了一个，读的人也换了一件事。 */
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
   原生日历按钮收掉（与段卡的生效时刻同一条规矩），宽度由它要装的东西定：一个 ISO 日期。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-date::-webkit-calendar-picker-indicator{display:none;}
/* 选择器带 .dtpl-price-cal 是必需的：后面那段 .dtpl-price-input（width:100% / text-align:right /
   只有一条底边）同权重、写在后面，不带上它就会被压成整行宽的一条底线（见「加一年」那一格）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date{
  width:118px;text-align:left;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);padding:0 6px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date:hover{
  border-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-date:focus{border-color:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday[data-bad="true"] .dtpl-price-cal-date{border-color:var(--dtpl-err);}
/* 起止之间那条 ~：行内分隔符，走 dim 那一档（全表最弱的墨，只够当分隔符）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-tilde{flex:none;font-size:11px;color:var(--dtpl-fg-dim);}
/* 这一段的读数：几天。它是**拿来对通知的**那个数（「共 N 天」），所以等宽 + 定宽右对齐，
   一年里的几段成一条可以竖着扫下来的列。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday-tail{
  margin-left:auto;display:inline-flex;align-items:center;gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-days{
  min-width:48px;text-align:right;
  font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 「还没填完」是一句话，不是读数：不吃等宽。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-days[data-kind="partial"]{font-family:inherit;}
/* 行内的问题独占一行（它比这一行的三个控件都长）：左对齐、可折行，与其余填数格同一档。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-holiday .dtpl-price-cell-err{
  flex:1 1 100%;text-align:left;white-space:normal;
}
[data-plugin="dsh-tokbook"] .dtpl-price-cal-add{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
/* 「加一年」那一行的字段名：跟选择带同款（那条带子也是「字段名 + 原生控件」），
   走 fg-2——它是要读的文本，不是装饰。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal-year-k{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
/* 这一格是**盒子**不是刻线：四个数字，宽度由它能是什么定（72px）。选择器必须带上 .dtpl-price-cal，
   否则后面那段 .dtpl-price-input（width:100% / text-align:right / 只有一条底边）同权重、写在后面，
   会把这一格压成整行宽的一条底线——「加一年」那格因此看起来像别的填数格。 */
[data-plugin="dsh-tokbook"] .dtpl-price-cal .dtpl-price-cal-newyear{
  width:72px;text-align:center;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);padding:0 6px;
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
/* 字段名是要读的文本，走 fg-2（fg-3 只承载装饰）；与调价史里同名的格子同一档。 */
[data-plugin="dsh-tokbook"] .dtpl-price-pick-k{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
/* 下拉占满余量：选择带只有这两行，值得把宽度给足。26px 高与体积里的下拉同档，
   但文字走 12px 而不是 11px——它承载的是整条 route key，不是「工作日」。
   字体刻意**不**改成等宽：模型串与 route key 是身份不是数字，这两个盒子的宽度由余量决定，
   不需要数字对齐；原生 select 的字体在这里正合适。 */
[data-plugin="dsh-tokbook"] .dtpl-price-pick-sel{
  width:100%;height:26px;font-size:12px;
}
/* 汇率那一行：1 美元 = [ 7.15 ] 元，句尾跟一句反向读数（¥1 ≈ $0.14）。它是**全表共用的
   一份事实**（不属于任何一行），所以和两个下拉同住这条带子、同一档的「字段名 + 控件」形状；
   句尾那句反向读数是要读的文本，走 fg-2（dim 那一档在浅色卡面上读不出）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fx{
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-fx-eq,
[data-plugin="dsh-tokbook"] .dtpl-price-fx-unit{font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}
/* 这一格是**盒子**不是刻线：它只装一个人写下的汇率。选择器必须带上 .dtpl-price-fx，
   否则后面那段 .dtpl-price-input（width:100% / text-align:right / 只有一条底边）同权重、
   写在后面，会把这一格压成整行宽的一条底线（与年历「加一年」同一处坑）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fx .dtpl-price-fx-in{
  width:72px;flex:none;text-align:center;
  border:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);padding:0 6px;
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
/* 汇率写不出去时那句话独占一行：它与这一行的控件都不同长，挤在一起会把选择带顶歪。 */
[data-plugin="dsh-tokbook"] .dtpl-price-fx-err{
  font-size:10px;line-height:14px;color:var(--dtpl-err);overflow-wrap:anywhere;
}

/* 选中模型的详情面：身份行在最上，下面整块是让位层 .dtpl-price-rail（竖轨与段卡都在那一层里）。
   data-dirty 是**面板级**的指示：未落盘的改动只挂着这一条墨痕，
   没有它，改完不离开输入框时屏幕上没有任何东西说「还没写进去」。 */
[data-plugin="dsh-tokbook"] .dtpl-price-detail{
  display:flex;flex-direction:column;gap:8px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-detail[data-dirty="true"]{
  box-shadow:inset 2px 0 0 var(--dtpl-fg);
}
/* 调价史那一叠段卡：左内缩 30px 让它们落在轨的右边，8px 间距代替段与段之间的发丝线。 */
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
/* 没有名字的行只靠精确串站立，所以不弱化、走等宽。判据是 TSX 上的 data-exact
   （这一串是不是精确模型串），不是 :only-child——否则命名与否会改变字体。 */
[data-plugin="dsh-tokbook"] .dtpl-price-name[data-exact="true"]{
  font-family:var(--dtpl-mono);
}
/* 账本的计费键：命名过才印第二遍，等宽、走 fg-2（它是**要读**的串，不是装饰——
   dim 那一档在浅色卡面上只有 1.64:1）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-exact{
  flex:0 1 auto;min-width:0;
  font-family:var(--dtpl-mono);font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-plugin="dsh-tokbook"] .dtpl-price-reqs{
  flex:none;font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}

/* 费率格的度量。宽度由费率能是什么决定，不是今天的数字：要装下最长的那种历史价（8 字符），
   数字必须等宽（比例体让同位数字错开，固定列就失去可比性）。80px = 8 字符价 + 两侧内边距。
   --dtpl-cell-pad-x 与单元格的标签共享：标签必须和下面的数字结束在同一边缘。
   整张卡的四处费率带（段卡基准价、每个峰谷时段）共用这一个格宽，于是四档价在整张卡里是同一组
   读数；基准价那一带在自己的栅格里居中（它头顶只有一枚居中的满弧盘，见 .dtpl-price-seg-allday），
   峰谷子目仍在卡内容盒的左缘起排——留空的桶报的正是它上面那个数（留空 = 沿用），这件事由
   占位符与悬停说明说出来，不再由上下对齐说出来。
   --dtpl-days-w 只由日档那一列用：峰谷时段的日档是下拉，宽度由最长的「工作日」定，
   于是所有子目的钟点落在同一条竖线上。
   --dtpl-slot-indent 是时段卡那一列的左让位（栅栏占掉的那一列）：**两个用户**——时段卡自己的
   左内边距，和「＋ 峰谷时段」那条幽灵行（它占的正是下一张时段卡的位置）。一处改、两处跟，
   窄屏那份配方（shared 的 29px）也只需要改这一个数。 */
[data-plugin="dsh-tokbook"] .dtpl-price-sec{
  --dtpl-cell-pad-x:7px;
  --dtpl-rate-w:80px;
  --dtpl-rate-gap:8px;
  --dtpl-days-w:52px;
  --dtpl-slot-indent:41px;
}

/* 硬约束：flex:none + nowrap——折行会撑高一行，截断会丢状态。 */
[data-plugin="dsh-tokbook"] .dtpl-price-badge{
  flex:none;
  display:inline-flex;align-items:center;height:15px;padding:0 5px;
  border:1px solid var(--dtpl-border);
  font-size:10px;line-height:13px;font-weight:600;white-space:nowrap;
  color:var(--dtpl-fg-2);
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
/* 货币开关：读写的单位（¥ / $）。它与计费性质同一档「当前项」，所以共用 .dtpl-price-switch
   的样子，只是前面多一个字段名——两组紧挨着摆，没有名字就会被读成一条四格的带子。
   停用态（汇率还没填）只降不透明度：理由写在上面那格汇率里，这里不重复。 */
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
  /* 字段名是要读的文本，走 fg-2（fg-3 只承载装饰）。 */
  display:none;font-size:9px;line-height:12px;letter-spacing:.2em;color:var(--dtpl-fg-2);
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
}
[data-plugin="dsh-tokbook"] .dtpl-price-add:hover{
  border-bottom-color:var(--dtpl-fg);
  background:color-mix(in srgb,var(--dtpl-fg) 7%,transparent);
}
/* 「＋ 加一段价」与「＋ 峰谷时段」是同一样东西：**幽灵行**——它占的是下一张卡的位置
   （同一个内容列、同一条左缘，一行高 30px，不假装自己是一张卡）。
   幽灵只住在**盒子**里：边是比卡边更弱的一圈发丝线（8% 对 12%）、底是空的；字走主墨、
   不吃次级那一档——它上面/下面就是同为 11px 的说明文字，跟说明同一个墨量的话，这颗控件会
   被读成「还没做完的占位」而不是「能按的东西」。悬停/按下只加**一层透明洗色**（不跟卡面调，
   段卡自己也在悬停时洗色，跟卡面调会让这一行在洗过的卡上读成一个更亮的洞）+ 一道明显更重的边，
   于是「这一行能按」用手就能确认，而它仍然不是一张卡。
   强弱只能靠墨量与填色说：dashed 在本仓库是静态禁令（selfcheck:ui）。 */
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
[data-plugin="dsh-tokbook"] .dtpl-price-ghost:disabled{opacity:.45;cursor:not-allowed;}
[data-plugin="dsh-tokbook"] .dtpl-price-ghost{
  appearance:none;
  border:0;border-bottom:1px solid color-mix(in srgb,var(--dtpl-fg) 22%,transparent);
  background:transparent;box-sizing:border-box;
  height:24px;padding:0 8px;
  color:var(--dtpl-fg-2);font:inherit;font-size:11px;cursor:pointer;
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
     6%   选择带 / 段卡面
     11%   —— 这一档留作「比段卡再高一档」的余量（此前是展开卡的横梁）。 */
/* 调价史那一叠：竖轨画在这一层上，左内缩 30px 把段卡放在轨的右边。
   **这一层只为一件事存在**：给轨一个与段卡同宽的坐标原点——把轨画在详情面那一层上
   会让它落在卡片左缘以内，直接从卡面上穿过去。身份行不在这一层里：它是这一块的头，
   左缘必须与上面的选择带对齐。 */
[data-plugin="dsh-tokbook"] .dtpl-price-rail{
  position:relative;
  display:flex;flex-direction:column;gap:8px;
  padding:0 0 6px 30px;
}
/* 竖轨：调价史从头贯到尾（首记 → 今天），段卡的钉与孔落在它上面。左端 12px、内缩 30px
   与轴上的钉（段卡左缘 -21.5px）是同一组几何——改一处就要一起改。 */
[data-plugin="dsh-tokbook"] .dtpl-price-rail::before{
  content:"";position:absolute;left:12px;top:6px;bottom:6px;width:1px;
  background:color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
}
/* 一张价 = 一张卡：面与选择带同档（6% 洗色），于是段与段的分隔不再要发丝线，由 8px 间隙说。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg{
  position:relative;
  display:flex;flex-direction:column;gap:5px;
  padding:6px 8px;
  border:1px solid var(--dtpl-border);border-radius:var(--dtpl-radius);
  background:color-mix(in srgb,var(--dtpl-fg) 6%,var(--dtpl-card));
  /* 同一块「金属」材质（受光边 / 背光边），不另立一种卡。 */
  box-shadow:var(--dtpl-metal);
}
/* 钉的圆心钉在**整条身份区块**的竖中线上（卡顶 21.5px：1px 边框 + 6px 上垫 + 28px 日期盒的一半，
   已按截图逐像素核对），不是它的底线——钉属于这一张卡，报的是「这一段」而不是那个输入框的下边。
   「top」是盒顶，圆心还要 +5.5px（8px 盒的一半 + 1px 环），所以这里写 17px 而不是 21px。
   每一张的身份行都是同一个 28px 的日期盒，所以这条中线对每一张都成立。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg::before{
  content:"";position:absolute;left:-21.5px;top:17px;width:8px;height:8px;border-radius:50%;
  background:color-mix(in srgb,#000 35%,transparent);
  box-shadow:0 0 0 1px color-mix(in srgb,var(--dtpl-fg) 16%,transparent);
  pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg:hover{
  background:color-mix(in srgb,var(--dtpl-fg) 9%,var(--dtpl-card));
}
/* 钉与孔同径同形同位（改 ::before 的几何要一起改）；这是全抽屉唯一允许色相的地方。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg[data-active="true"]::after{
  content:"";position:absolute;left:-21.5px;top:17px;width:8px;height:8px;z-index:1;border-radius:50%;
  background:var(--dtpl-brand);box-shadow:0 0 0 1px var(--dtpl-on-brand);
  pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-price-badge-live{
  background:var(--dtpl-brand);color:var(--dtpl-on-brand);
  border-color:var(--dtpl-on-brand);letter-spacing:.1em;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-line{
  display:flex;align-items:center;gap:10px;min-width:0;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-id{display:flex;align-items:center;gap:8px;min-width:0;}
/* 序号 = 这一行第几段价，纯视觉的扫读列。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-serial{
  flex:none;width:1.5em;font-family:var(--dtpl-mono);font-size:10px;line-height:16px;
  letter-spacing:.12em;font-variant-numeric:tabular-nums;color:var(--dtpl-fg-2);
}
/* 生效时刻是这一块的标题：等宽、左对齐、比读数大一档；刻线只铺到戳的宽度。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-date{display:flex;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-input-date{
  flex:0 1 auto;min-width:160px;text-align:left;padding:0 6px 0 0;
  font-size:15px;letter-spacing:.05em;font-weight:600;
}
/* 原生日历按钮是全窗口唯一的浏览器控件，收掉；键入与方向键路径写进字段的 title。 */
[data-plugin="dsh-tokbook"] .dtpl-price-input-date::-webkit-calendar-picker-indicator{display:none;}
/* 右轨 = 段自己的复制/删除（常显）；峰谷时段那一对挂在时段卡的头行（.dtpl-price-slot-actions，聚焦时现身）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-tools{
  margin-left:auto;flex:none;
  display:flex;align-items:center;justify-content:flex-end;
  gap:6px;min-width:0;
}

/* 详情带不缩进、不画自己的上边线：缩进会让跨行的四档价错开，补上边线会与上一行的刻线相距 7px。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-detail{
  display:flex;flex-direction:column;gap:6px;
  padding:2px 0 1px;
}
/* 幽灵行站在它要添的那一行的**位置**上：「＋ 加一段价」占着下一张段卡那一格，
   所以它不再是一条刻线按钮，也不再和旁边的说明挤同一行。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-band{display:flex;min-width:0;margin-top:4px;}
[data-plugin="dsh-tokbook"] .dtpl-price-add-slot{flex:1 1 auto;min-width:0;}
/* 上面有时段组时让位到时段卡那一列（它占的是下一张时段卡的位置，那张卡被栅栏让位过）；
   没有时段组时不让位——那时它对齐的是上方的基准价行。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slots + .dtpl-price-seg-band .dtpl-price-add-slot{
  margin-left:var(--dtpl-slot-indent);
}

/* 基准价行：满弧盘居中打头，四档价落在盘下方——基准价是这一段价的抬头，盘与它那四档读数
   因此成一个居中的竖列，没有戳也没有说明（它是谁由下面那条分界行说）。
   四档价在**整宽**的栅格里居中（justify-content）——包着它的那一层不缩到内容宽：窄屏那份配方把它
   折成 2×2 时需要一条撑满的栅格，缩到内容宽会让两列塌回内容宽度。
   行与行之间不画横线：四档价各自成框，一行到哪儿为止由框说，间距留给子目自己的上内边距。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-allday{
  display:flex;flex-direction:column;align-items:center;gap:10px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-allday-body{width:100%;min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-rates{justify-content:center;}
/* 分界行：基准价与峰谷子目之间那一行，**同时是说明与那条线**。那句话居中，左右各一段等长的
   发丝线把它托在中间——盘居中之后这一行没有首列可让，整行就是横在卡上的一道界。
   两段线各留 24px 的底：窄处先折行的永远是那句话（note 是 flex:0 1 auto），线不会被抽干。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-split{
  display:flex;align-items:center;gap:8px;margin:2px 0 1px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-split::before,
[data-plugin="dsh-tokbook"] .dtpl-price-seg-split::after{
  content:"";flex:1 1 24px;height:1px;
  background:color-mix(in srgb,var(--dtpl-fg) 14%,transparent);
}
/* 这句话是要读的（它替掉了原来那枚戳与那句说明），所以走 fg-2 而不是 dim；
   min-width:0 让它在窄处真的能折行（自动最小宽度是内容宽度，不给 0 就把这张卡顶宽），
   折成两行时居中也仍然成立——它自己也是一段居中排的文本。 */
[data-plugin="dsh-tokbook"] .dtpl-price-seg-split-note{
  flex:0 1 auto;min-width:0;text-align:center;
  font-size:11px;line-height:16px;color:var(--dtpl-fg-2);
}
/* 峰谷时段是段卡里的**一层卡**：整条子目自己成一张（边框 + 半径 + 内凹的边），
   叠在段卡面上再降一档——与「段卡比窗面高一档」同一个方向，所以两层的远近一读就分得出。
   左边那一列让给栅栏（轨 + 圆点 + 桩线），卡片从这一列之后（41px）开始——栅栏与卡片因此
   共用同一个坐标系（几何见 .dtpl-price-slot-rail）。
   竖轨是**一条**、贯穿整组（逐条分段会在每个点上留一处断口，正好像轨被点打断了），两端渐隐；
   它在圆点那几行被挖掉一个洞——1px 的轨从 7px 的实心点里穿过去会画出一条深色竖纹，
   点就不再是一枚点了。洞按点的直径挖（圆心在轨上 20px，所以是 16.5 到 22.5px），
   两端各留 1px 抗锯齿的余地。 */
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
/* 卡片：叠在段卡面上再降一档（那圈内凹的边），与「段卡比窗面高一档」同一个方向。
   上内边距 5px 比下边的 6px 少 1px：栅栏的桩线要落的那条中线按 5px 算，
   而卡片整体不妨矮一档——多出来的 1px 让在下方。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-card{
  box-sizing:border-box;display:flex;flex-direction:column;gap:5px;
  padding:5px 8px 6px;
  border:1px solid var(--dtpl-border);border-radius:var(--dtpl-radius);
  background:color-mix(in srgb,var(--dtpl-fg) 6%,var(--dtpl-card));
  box-shadow:inset 0 1px 0 0 color-mix(in srgb,#000 7%,transparent),
    inset 0 -1px 0 0 color-mix(in srgb,#fff 5%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-card:hover{
  background:color-mix(in srgb,var(--dtpl-fg) 9%,var(--dtpl-card));
}
/* 栅栏：圆点 + 桩线，都绝对定位（基准是**本槽**，和竖轨同一个坐标系）——点的圆心按算术钉在
   竖轨上（本槽左缘 + 20），桩线从点的右缘接到卡片的左边框（本槽左缘 + 50）。栅栏要接的是
   卡内首行那个下拉盒的中线，不是整行的中心：头行在窄处会折成两行，锚点只能是第一行。
   值为实测：槽顶 + 28px（= 10px 上垫 + 1px 卡边框 + 5px 卡上垫 + 12px 下拉盒的一半）时圆心正落
   在那条中线上——纸上推算差 4px，以渲染为准。z-index 把点压在共用的那条轨之上
   （1px 的轨穿心会画出一道深色竖纹）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-rail{
  position:absolute;left:0;top:0;bottom:0;width:50px;pointer-events:none;
}
[data-plugin="dsh-tokbook"] .dtpl-price-slot-dot{
  position:absolute;left:16.5px;top:28px;transform:translateY(-50%);
  width:7px;height:7px;border-radius:50%;background:var(--dtpl-fg);
  z-index:1;
}
/* 桩线取 27.5px：1px 的线落在半像素上时会被摊成两行，钉在整像素上才是一条实线。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-stub{
  position:absolute;left:23.5px;top:27.5px;width:26.5px;height:1px;
  background:var(--dtpl-rail-ink);z-index:1;
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
   所以比任何一段弧都轻：圈一多，读角度靠的就是它，而抢眼的仍然是弧。 */
[data-plugin="dsh-tokbook"] .dtpl-price-slot-ring-zero{
  stroke:color-mix(in srgb,var(--dtpl-fg) 30%,transparent);stroke-width:1;
}
/* 时长是派生的读数：走 fg-2、钟点右侧留 2px，不参与那一簇发丝线的定位。
   它是读出来的**数**（这条窗口覆盖几小时），不是分隔符，所以不吃 dim 那一档。 */
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
/* 日档与钟点之间坐一道 .5px 竖发丝线（与计费性质切换同一词汇）；这簇只有 165px 宽，
   折行时容器先挤掉的是右轨那对操作。 */
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
  font:inherit;font-size:11px;line-height:16px;cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,var(--dtpl-fg-2) 50%),
    linear-gradient(135deg,var(--dtpl-fg-2) 50%,transparent 50%);
  background-position:calc(100% - 8px) 10px,calc(100% - 4px) 10px;
  background-size:4px 4px,4px 4px;background-repeat:no-repeat;
  font-variant-numeric:tabular-nums;
}
[data-plugin="dsh-tokbook"] .dtpl-price-select:hover{border-bottom-color:color-mix(in srgb,var(--dtpl-fg) 45%,transparent);}
[data-plugin="dsh-tokbook"] .dtpl-price-select:focus{outline:none;border-bottom-color:var(--dtpl-fg);}
/* 原生下拉面板：option 继承控件字色，深肤主墨近白、落在浏览器默认白底上读不出。
   面板底与字显式声明成卡面 + 主墨（Chromium 会按 option 底色重绘面板，浏览器蓝随之消失）。 */
[data-plugin="dsh-tokbook"] .dtpl-price-select option{
  background:var(--dtpl-card);color:var(--dtpl-fg);
}
/* 列宽给到「工作日」(33px) + 两侧 2px/8px + 三角 8px；一行里三个下拉的三角到各自值的距离必须一致。 */
[data-plugin="dsh-tokbook"] .dtpl-price-select-days{width:var(--dtpl-days-w);padding-right:8px;}
[data-plugin="dsh-tokbook"] .dtpl-price-seg-rates .dtpl-price-cell-k,
[data-plugin="dsh-tokbook"] .dtpl-price-slot-rates .dtpl-price-cell-k{display:block;text-align:right;padding-right:var(--dtpl-cell-pad-x);}
[data-plugin="dsh-tokbook"] .dtpl-price-slot:hover .dtpl-price-slot-actions,
[data-plugin="dsh-tokbook"] .dtpl-price-slot:focus-within .dtpl-price-slot-actions{opacity:1;}
/* 段列表的页脚：幽灵行独占一行（它得站满段卡那一个内容列），口径说明退到它下面。 */
[data-plugin="dsh-tokbook"] .dtpl-price-history-foot{
  display:flex;flex-direction:column;align-items:stretch;gap:6px;margin-top:2px;
}
[data-plugin="dsh-tokbook"] .dtpl-price-history-hint{margin:0;font-size:11px;line-height:16px;color:var(--dtpl-fg-2);}

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
