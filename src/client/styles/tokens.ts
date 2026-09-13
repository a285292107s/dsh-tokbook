/** styles.ts 片段：tokens。由 `injectStyles` 按序拼接。 */
export const CSS_TOKENS = `
[data-plugin="dsh-tokbook"]{
  --dtpl-fg:var(--dsw-alias-label-primary,#1f2328);
  --dtpl-fg-2:var(--dsw-alias-label-secondary,#59636e);
  --dtpl-fg-3:var(--dsw-alias-label-tertiary,#81858c);
  --dtpl-fg-dim:var(--dsw-alias-label-dimmed,#a0a4a8);
  --dtpl-on-accent:var(--dsw-alias-label-primary-foreground,#ffffff);
  --dtpl-accent:var(--dsw-alias-brand-primary,#4d6bfe);
  --dtpl-accent-hover:var(--dsw-alias-button-primary-hover,#3f5ce0);
  --dtpl-accent-fill:var(--dsw-alias-button-primary-fill,#4d6bfe);
  --dtpl-card:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,#ffffff));
  --dtpl-surface:var(--dsw-alias-bg-layer-1,#ffffff);
  --dtpl-border:var(--dsw-alias-border-l2,rgba(0,0,0,.12));
  --dtpl-hairline:var(--dsw-alias-border-l1,rgba(0,0,0,.08));
  /* --dsw-corner-shape 是超椭圆形状关键字（superellipse(1.5)），绝不是长度——
     喂进 border-radius 会让声明失效、在真实 DSH 皮肤上圆角塌成 0。半径保持
     纯长度；曲率由 DSH 自己的 'corner-shape' 通用规则叠加，全圆形状再在
     局部配 'corner-shape:round'。 */
  --dtpl-radius:20px;
  --dtpl-radius-sm:9px;
  --dtpl-ok:var(--dsw-alias-state-success-primary,#1a7f37);
  --dtpl-warn:var(--dsw-alias-state-warn-primary,#9a6700);
  --dtpl-err:var(--dsw-alias-state-error-primary,#cf222e);
  --dtpl-mono:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);
}
`
