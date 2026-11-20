export const CSS_GRID = `
[data-plugin="dsh-tokbook"] .dtpl-grid{
  display:grid;
  grid-template-columns:repeat(12,minmax(0,1fr));
  gap:var(--dtpl-grid-gap);
  align-items:stretch;
}
[data-plugin="dsh-tokbook"] .dtpl-grid > *{min-width:0;}
[data-plugin="dsh-tokbook"] .dtpl-grid > .dtpl-error{margin:0;}

[data-plugin="dsh-tokbook"] .dtpl-span-5{grid-column:span 5;}
[data-plugin="dsh-tokbook"] .dtpl-span-7{grid-column:span 7;}
[data-plugin="dsh-tokbook"] .dtpl-span-12{grid-column:1/-1;}

[data-plugin="dsh-tokbook"] .dtpl-card{
  display:flex;flex-direction:column;min-width:0;
  border:1px solid var(--dtpl-border);
  background:var(--dtpl-panel-bg);
  box-shadow:
    var(--dtpl-sheen),
    var(--dtpl-metal),
    var(--dtpl-lift);
  transition:box-shadow var(--dtpl-dur-quick) var(--dtpl-ease-tint),border-color var(--dtpl-dur-quick) var(--dtpl-ease-tint);
}
[data-plugin="dsh-tokbook"] .dtpl-card:hover{
  box-shadow:
    var(--dtpl-sheen-hover),
    var(--dtpl-metal),
    var(--dtpl-lift-hover);
}
[data-plugin="dsh-tokbook"] .dtpl-card-pad{padding:16px;}

@container (max-width:1239px){
  [data-plugin="dsh-tokbook"] .dtpl-span-5,
  [data-plugin="dsh-tokbook"] .dtpl-span-7{grid-column:1/-1;}
}
`
