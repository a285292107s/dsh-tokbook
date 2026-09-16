/** styles.ts 片段：tokens。由 `injectStyles` 按序拼接。 */
export const CSS_TOKENS = `
[data-plugin="dsh-tokbook"]{
  --dtpl-fg:var(--dsw-alias-label-primary,#1f2328);
  --dtpl-fg-2:var(--dsw-alias-label-secondary,#59636e);
  --dtpl-fg-3:var(--dsw-alias-label-tertiary,#81858c);
  --dtpl-fg-dim:var(--dsw-alias-label-dimmed,#a0a4a8);
  --dtpl-accent:var(--dsw-alias-brand-primary,#4d6bfe);
  --dtpl-card:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,#ffffff));
  --dtpl-surface:var(--dsw-alias-bg-layer-1,#ffffff);
  --dtpl-border:var(--dsw-alias-border-l2,rgba(0,0,0,.12));
  --dtpl-hairline:var(--dsw-alias-border-l1,rgba(0,0,0,.08));
  /* --dsw-corner-shape 是超椭圆形状关键字（superellipse(1.5)），绝不是长度——
     喂进 border-radius 会让声明失效、在真实 DSH 皮肤上圆角塌成 0。半径保持
     纯长度；曲率由 DSH 自己的 'corner-shape' 通用规则叠加，全圆形状再在
     局部配 'corner-shape:round'。 */
  --dtpl-ok:var(--dsw-alias-state-success-primary,#1a7f37);
  --dtpl-warn:var(--dsw-alias-state-warn-primary,#9a6700);
  --dtpl-err:var(--dsw-alias-state-error-primary,#cf222e);
  /* 告警**文字**用的一档。DSH 的浅色 warn 实测是 #F59E0B，压在白卡上只有 2.15:1——
     作为 11px 正文严重不足（正文要 4.5:1）。混 45% 前景墨之后才成立；warn 本身仍留给
     非文本用途（边框、底色），那里只要 3:1。 */
  --dtpl-warn-ink:color-mix(in srgb,var(--dtpl-warn) 55%,var(--dtpl-fg));
  --dtpl-mono:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);

  /* ── 明日方舟：终末地 风格层 ───────────────────────────────────────────────
     依据：终末地的配色围绕「黄 / 黑 / 白」，黄与浅灰是「终末地工业」的品牌色（罗德岛才是
     蓝黑）；气质是克制、清晰、**不在字体上下功夫**；底材是金属与管线。特质的检索与出处见
     docs/DESIGN.md §4「风格取自哪里」，决策见 DECISIONS D-025 / D-027。
     以下几组 token 就是这些特质的载体。 */

  /* 1. 品牌黄。**它是"料"，不是"线"。**
     一个恒定的黄在物理上无法同时当浅底与深底上的线条色：#FFCD00 压在白卡上只有
     1.57:1，做 1px 分隔线、做浅底上的文字、做细柱子都会糊掉。所以恒定只落在**实心块**
     上——凡是出现黄的地方，它都自带墨色描边或墨色内容（工业标识本来就这么画：
     黄牌 + 黑字/黑边）。这样两个主题共用一套形态，只有它周围的面色随主题翻转。 */
  --dtpl-brand:#ffcd00;
  --dtpl-on-brand:#14150f;

  /* 2. 直角。圆角在这套语言里不存在。状态点、表盘这类真圆不走这两个 token。 */
  --dtpl-radius:0px;
  --dtpl-radius-sm:0px;

  /* 3. 字体：**保守**。终末地的原话是「字体使用太保守，没有使用在字体上下功夫，好处就是
     不像某些使用粗体字的压根看不清」——所以这里不做衬线/等宽的字体文章：中文回无衬线，
     只有数字走等宽（那一条留的是工程语境，不是装饰）。 */

  /* 4. 金属色点缀。终末地的底材是「金属、管线」，所以面板的边不是一条印刷线，而是
     一块机加工面在**受光边的反光**加**背光边的投影**。两个方向都用固定黑白、极低透明度：
     深色面上只有顶部那道亮线读得出来，浅色面上只有底部那道暗线读得出来——同一套材质，
     两个主题各自成立，不需要为深色再补一条规则。
     只走 1px、≤12%：要的是「金属」，不是高光；这条预算和黄一样是刻意的。
     它叠在 1px 硬边框之内（外轮廓 + 内倒角），所以面板的边界仍由 --dtpl-border 单独负责——
     材质与边界是两件事，不许一条半像素阴影同时充当两者。 */
  --dtpl-metal:
    inset 0 1px 0 0 color-mix(in srgb,#fff 7%,transparent),
    inset 0 -1px 0 0 color-mix(in srgb,#000 12%,transparent);

  /* 5. 面板：这一屏所有「一块读数面」共用的一条配方（1px 硬边框 + 这一档洗色 + 金属边）。
     改这里就是改全窗口的材质，所以没有哪个 tab 能长出自己的面板。 */
  --dtpl-panel-bg:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);

  /* 5b. 今日仪表卡的底图『--dtpl-hero-art』**不在这里声明**：它的值是一串 data URI，
     由 styles.ts 从 import 的资产直接拼进去（本文件是静态字符串，拿不到 import）。
     它只被『.dtpl-hero-art』那一层背景用，见 ledger 片段的 hero 段。 */

  /* 6. 「一行读数」的右列宽。『.dtpl-row』是**跨 tab 共用**的行组件（用量明细与通道用量
     都走它），所以这条度量必须挂在插件根上，不能挂在使用者身上。此前它叫 --dtpl-bd-nums-w
     并定义在『.dtpl-bd』（用量明细那一节）里：通道用量 tab 用了同一个类，变量取不到，
     『grid-template-columns:minmax(0,1fr) var(...)』整条在计算值阶段失效、回落到单列
     ——实测行高 75px（两列时 38px），同一个类在两个 tab 里长得完全不一样。
     名字随之改掉：它约束的是「行」，不是「明细」那一节。
      宽度按**这一列里最宽的那种内容**定：工作区行跨通道，一格里有**两段**「数额 + 桶名」
     （『¥1234.56 实际支出 · ¥1234.56 订阅价值』实测 222px），所以它比按模型行（一段，~90px）
     需要的宽——按它定，模型行只是多留白，反之则金额被裁。 */
  --dtpl-row-nums-w:224px;
}
`
