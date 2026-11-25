export const CSS_SESSION = `
[data-plugin="dsh-tokbook"].dtpl-tok-entry{
  display:inline-flex;align-items:center;gap:5px;
  height:24px;padding:0 8px;margin:0;
  appearance:none;cursor:pointer;
  border:1px solid var(--dtpl-border);background:transparent;
  font:inherit;font-size:var(--dtpl-fs-label);line-height:var(--dtpl-lh-label);
  color:var(--dtpl-fg-2);white-space:nowrap;
  transition:background var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint),color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"].dtpl-tok-entry:hover{
  color:var(--dtpl-fg);border-color:var(--dtpl-fg-3);background:var(--dtpl-wash-hover);
}
[data-plugin="dsh-tokbook"].dtpl-tok-entry:focus-visible{outline:2px solid var(--dtpl-focus);outline-offset:1px;}
[data-plugin="dsh-tokbook"].dtpl-tok-entry[aria-expanded="true"]{
  color:var(--dtpl-fg);border-color:var(--dtpl-fg-3);background:var(--dtpl-wash-on);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-entry-ico{width:13px;height:13px;flex:none;}
[data-plugin="dsh-tokbook"] .dtpl-tok-entry-label{display:block;}


[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark{flex:none;width:9px;height:10px;box-shadow:none;}
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="wait"]{
  background:
    repeating-linear-gradient(90deg,
      color-mix(in srgb,var(--dtpl-fg) 66%,transparent) 0 1.5px,
      transparent 1.5px 4px),
    color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="generate"]{background:var(--dtpl-fg);}
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="tool"]{
  background:
    repeating-linear-gradient(45deg,
      color-mix(in srgb,var(--dtpl-fg) 88%,transparent) 0 1.5px,
      transparent 1.5px 6px),
    color-mix(in srgb,var(--dtpl-fg) 72%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="model"]{
  background:
    repeating-linear-gradient(90deg,var(--dtpl-fg) 0 1.5px,transparent 1.5px 5px),
    repeating-linear-gradient(45deg,var(--dtpl-fg) 0 1.5px,transparent 1.5px 5px),
    color-mix(in srgb,var(--dtpl-fg) 55%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="input"]{
  background:
    repeating-linear-gradient(90deg,
      color-mix(in srgb,var(--dtpl-fg) 66%,transparent) 0 1.5px,
      transparent 1.5px 4px),
    color-mix(in srgb,var(--dtpl-fg) 52%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="cache-read"]{
  background:
    repeating-linear-gradient(0deg,
      color-mix(in srgb,var(--dtpl-fg) 88%,transparent) 0 1.5px,
      transparent 1.5px 6px),
    color-mix(in srgb,var(--dtpl-fg) 72%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="cache-write"]{
  background:
    repeating-linear-gradient(45deg,
      color-mix(in srgb,var(--dtpl-fg) 88%,transparent) 0 1.5px,
      transparent 1.5px 6px),
    color-mix(in srgb,var(--dtpl-fg) 72%,transparent);
}
[data-plugin="dsh-tokbook"] .dtpl-tok-read-mark[data-kind="output"]{background:var(--dtpl-fg);}
`
