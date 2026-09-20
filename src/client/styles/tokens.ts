/**
 * tokens —— 全插件唯一的取值登记处。只做三件事：从宿主取色（`--dsw-alias-*` + 兜底）、
 * 登记插件自有常量、在值旁写"为什么"。某个面长什么样在 `styles/*.ts`，规则与达标线也在这些注释里。
 *
 * 加一条之前三问，都过了才加：
 *   ① 别处是否已经表达过同样的色值 / 圆角 / 名字——是就不加；
 *   ② 是否真有两个使用处——只有一个就写在使用处的类上，别挂根；
 *   ③ 色值是否必须来自宿主——是就走 `--dsw-alias-*` + 兜底，不许抄解析后的具体值。
 * 加完把使用者写进注释；没有使用者 = 死 token，删。
 *
 * 两个前提（别的片段不用管）：
 *   ① 必须挂在插件根上：自定义属性在计算值阶段解析，定义在使用者自己的类里，
 *      别处取不到，整条声明（如 grid-template-columns）会静默失效。
 *   ② 必须同时成立于浅色与深色皮肤；恒定值要自己给出理由。
 */

export const CSS_TOKENS = `[data-plugin="dsh-tokbook"]{

  /* ── 一、文字墨阶：按"要不要读"分档 ────────────────────────────────────────
     要读的文本只许用 fg / fg-2；fg-3 是装饰，dim 是"·"这类行内分隔符。
     三级色压白卡 3.47:1、压浅色卡面 4.12:1，都不是正文色。 */
  --dtpl-fg:var(--dsw-alias-label-primary,#1f2328);      /* 主墨：读数与标题 */
  --dtpl-fg-2:var(--dsw-alias-label-secondary,#59636e);  /* 次级：说明句、标签、未选中项 */
  --dtpl-fg-3:var(--dsw-alias-label-tertiary,#81858c);   /* 只给装饰：插入符、缀点 */
  --dtpl-fg-dim:var(--dsw-alias-label-dimmed,#a0a4a8);   /* 只给行内分隔符 */

  /* ── 二、面与线 ───────────────────────────────────────────────────────────
     card 是卡面，surface 是凹进去的一块（输入框、占位块）。
     border 是分区线（页脚、tab 条、面板轮廓共用），hairline 是 .5px 发丝线。 */
  --dtpl-card:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,#ffffff));
  --dtpl-surface:var(--dsw-alias-bg-layer-1,#ffffff);
  --dtpl-border:var(--dsw-alias-border-l2,rgba(0,0,0,.12));
  --dtpl-hairline:var(--dsw-alias-border-l1,rgba(0,0,0,.08));

  /* ── 三、状态色：只在真的要看一眼时用 ─────────────────────────────────────
     ok 只给价表"已保存"；warn 只作边框与底色，不许直接做正文；err 是错误。
     这一档不外借给分类——需要分类时用形状。 */
  --dtpl-ok:var(--dsw-alias-state-success-primary,#1a7f37);
  --dtpl-warn:var(--dsw-alias-state-warn-primary,#9a6700);    /* 全部非文本 */
  --dtpl-err:var(--dsw-alias-state-error-primary,#cf222e);
  /* 告警文字走这一档：warn 压白卡只有 2.15:1（11px 正文要 4.5:1），混 45% 前景墨才成立；
     比例恒定，警告信息一多就改这一条。 */
  --dtpl-warn-ink:color-mix(in srgb,var(--dtpl-warn) 55%,var(--dtpl-fg));

  /* ── 四、系统信号：跟随宿主，不参与这套视觉语言 ───────────────────────────
     焦点环、输入框聚焦边框、调价史"当前生效"点走它。
     它不可当强调色用：DSH 默认皮肤里这档等于墨色，拿它做分类或状态是空操作，
     换皮肤又会变蓝。兜底取墨色而非某个蓝——端出 DSH 里不存在的强调色更糟。 */
  --dtpl-accent:var(--dsw-alias-brand-primary,#1f2328);

  /* ── 五、品牌黄：它是"料"，不是"线" ───────────────────────────────────────
     恒定黄无法同时当浅底与深底上的线条色（#FFCD00 压白卡 1.57:1），
     所以只以实心块 + 墨边出现，两个主题共用形态，周围面色随主题翻转。 */
  --dtpl-brand:#ffcd00;    /* 当前页标记、峰值牌、工业徽记、草稿点、选区 */
  --dtpl-on-brand:#14150f; /* 黄块上的字与墨边 */

  /* ── 六、材质：面板的两条配方 ─────────────────────────────────────────────
     金属边 = 受光边 + 背光边，固定黑白、只走 1px、≤12%；
     深色面上只有顶亮线读得出，浅色面上只有底暗线读得出，同一套材质两个主题各自成立。
     它叠在 1px 硬边框之内，材质与边界是两件事。 */
  --dtpl-metal:
    inset 0 1px 0 0 color-mix(in srgb,#fff 7%,transparent),
    inset 0 -1px 0 0 color-mix(in srgb,#000 12%,transparent);
  /* 所有"一块读数面"共用的面板底（3% 洗色）；深色不再单独提亮，否则同屏出现两种面板。 */
  --dtpl-panel-bg:color-mix(in srgb,var(--dtpl-fg) 3%,transparent);

  /* ── 七、几何与字体 ───────────────────────────────────────────────────────
     直角是这套形态的判据之一，不是当前偏好；状态点、表盘这类真圆写 50%。
     不做衬线、不做字体文章，只有数字走等宽。 */
  --dtpl-radius:0px; /* 唯一允许的圆角值（footer 按钮基线在用） */
  --dtpl-mono:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace); /* 全部是数字 */

  /* 「一行读数」的右列宽，由跨 tab 共用的 .dtpl-row 使用，故必须挂根（见文件头 ①）。
     它是下限不是定宽，使用处写 minmax(min-content,var(--dtpl-row-nums-w))——金额位数不受控，
     写死会让右列溢出、金额被裁。 */
  --dtpl-row-nums-w:224px;

  /* ⚠️ 两条不在本文件声明的量：
     · --dtpl-hero-art：值是 data URI，由 styles.ts 从 import 的资产拼进去。
     · --dsw-corner-shape：超椭圆形状关键字（superellipse(1.5)），不是长度；
       喂进 border-radius 会让声明失效、圆角塌成 0。半径一律纯长度。 */
}

/* ── 八、独立设备皮（独立悬浮窗口）：不走宿主的一整套色板 ──────────────────
   没有宿主就没有 --dsw-alias-* 可借。前提：根元素带 data-dtpl-device="light|dark"
   （宿主内没人挂这个属性，下面两块永远匹配不上）。窗口按仪器做：casing 是壳面
   （页眉「控制头」与页脚「状态条」坐上去），card / surface 是屏幕；墨阶、黄、材质照旧。
   造型在 styles/device.ts，它只引用这里的名字——硬编码色值除了本文件没有第二处，
   这条禁令对设备皮同样成立。
   文件头的前提②对本节按面自证：浅色块只压屏幕与铝壳，深色块只压屏面与炮铜壳，
   实测值写在数旁。 */
[data-dtpl-device="light"][data-plugin="dsh-tokbook"]{
  /* 墨阶（压屏面 #f5f6f8）：fg 14.61 · fg-2 5.65 · fg-3 3.43（只给装饰）· dim 2.32（行内分隔符）。 */
  --dtpl-fg:#1f2328;
  --dtpl-fg-2:#59636e;
  --dtpl-fg-3:#81858c;
  --dtpl-fg-dim:#a0a4a8;
  /* surface 在浅皮比 card 亮：输入框是凹进屏面的一口白瓷井（宿主 layer-1 / layer-2 同关系）；
     不用纯白：#fcfcfd 与壳面才分得开。 */
  --dtpl-card:#f5f6f8;
  --dtpl-surface:#fcfcfd;
  --dtpl-border:rgba(0,0,0,.12);
  --dtpl-hairline:rgba(0,0,0,.08);
  /* 状态色（压屏面）：ok 4.70 · err 4.95；warn 4.50 仍只作边框与底，正文走 --dtpl-warn-ink 7.87。 */
  --dtpl-ok:#1a7f37;
  --dtpl-warn:#9a6700;
  --dtpl-err:#cf222e;
  --dtpl-accent:#1f2328; /* DSH 浅皮的「身份色」本就等于墨色，焦点环压铝壳 9.82 */
  /* 壳：铝面。casing-ink 9.82 / casing-ink-2 4.80 均为压 #c9ccd2 的实测。 */
  --dtpl-casing:#c9ccd2;
  --dtpl-casing-ink:#1f2328;
  --dtpl-casing-ink-2:#4a545e;
  --dtpl-casing-hover:rgba(0,0,0,.08);
  --dtpl-casing-line:rgba(0,0,0,.28);
  /* 壳与环境：seam 是屏幕压进壳的暗缝，case-edge 是壳外缘一圈，mask 压暗的是桌面。 */
  --dtpl-seam:rgba(0,0,0,.45);
  --dtpl-case-edge:#7e838c;
  --dtpl-case-shadow:rgba(15,17,21,.32);
  --dtpl-device-mask:rgba(20,22,26,.55);
  --dtpl-scrollbar:rgba(0,0,0,.24);
  --dtpl-scrollbar-hover:rgba(0,0,0,.34);
}
[data-dtpl-device="dark"][data-plugin="dsh-tokbook"]{
  /* 墨阶（压屏面 #26272b）：fg 14.28 · fg-2 9.91 · fg-3 6.99（装饰档在深皮读得清，规矩不变）· dim 2.98。 */
  --dtpl-fg:#f9fafb;
  --dtpl-fg-2:#cfd3d6;
  --dtpl-fg-3:#adb2b8;
  --dtpl-fg-dim:#6b7075;
  /* 深皮 surface 压暗成井（#1c1d20），fg-2 压它 11.19：输入字在井里仍然达标。 */
  --dtpl-card:#26272b;
  --dtpl-surface:#1c1d20;
  --dtpl-border:rgba(255,255,255,.14);
  --dtpl-hairline:rgba(255,255,255,.10);
  /* 状态色（压屏面）：ok 5.87 · err 5.35。宿主深皮那枚 #f85149 压 #26272b 只有 4.45，
     设备皮没有宿主可遮羞，换亮一档的 #ff6b61。warn 6.95 仍非文本。 */
  --dtpl-ok:#3fb950;
  --dtpl-warn:#f59e0b;
  --dtpl-err:#ff6b61;
  --dtpl-accent:#f9fafb;
  /* 壳：炮铜面。casing-ink 13.21 / casing-ink-2 7.22 均为压 #2a2d33 的实测。 */
  --dtpl-casing:#2a2d33;
  --dtpl-casing-ink:#f9fafb;
  --dtpl-casing-ink-2:#b6bcc4;
  --dtpl-casing-hover:rgba(255,255,255,.10);
  --dtpl-casing-line:rgba(255,255,255,.22);
  --dtpl-seam:rgba(0,0,0,.70);
  --dtpl-case-edge:#101114;
  --dtpl-case-shadow:rgba(0,0,0,.62);
  --dtpl-device-mask:rgba(8,9,11,.72);
  --dtpl-scrollbar:rgba(255,255,255,.26);
  --dtpl-scrollbar-hover:rgba(255,255,255,.38);
}
`
