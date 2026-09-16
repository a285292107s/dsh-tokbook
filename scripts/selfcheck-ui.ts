/**
 * UI 规范里**可判定的那部分**的强制版（纯静态检查，不构建、不起服务）。
 *
 * 这些条目原本是 `docs/UI-SPEC.md` 里"看到就是错"的散文清单——散文不阻止任何事，
 * 而且会漂；搬到这里之后它们不读也生效。规范本体只留真正需要人判断的东西：
 * 不变量、达标线、陷阱。
 *
 *  1. 死类双向比对：样式表里定义了却没人用的 `dtpl-*` 类，以及 TSX 里挂着却没有样式规则的
 *     `dtpl-*`（结构性钩子是例外，例外表必须仍然存在，否则它自己会腐烂成遮羞布）；
 *  2. 硬编码色值：只许出现在 `var(--宿主变量, #兜底)` 的兜底里，或 `color-mix()` 内的
 *     `#000` / `#fff`（全窗口的颜色必须跟着宿主皮肤走）；
 *  3. 虚线：`dashed` / `dotted` 必须为 0；
 *  4. 圆角：`border-radius` 只许 `0` / `50%`（真圆）/ `var(...)`；
 *  5. 直连宿主变量：`--dsw-*` 只许出现在 §9.3 白名单涉及的那几个片段里，其余片段一律走
 *     `--dtpl-*`；
 *  6. `prefers-reduced-motion` 分支必须存在。
 *
 * Run: node --experimental-strip-types scripts/selfcheck-ui.ts
 *
 * @module dsh-tokbook/selfcheck-ui
 */

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

let failures = 0
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ' — ' + JSON.stringify(detail)}`)
  if (!ok) failures += 1
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const styleDir = join(root, 'src', 'client', 'styles')

/** 递归收集文件（相对 root，正斜杠）。 */
async function collect(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) await collect(rel, out)
    else if (entry.isFile()) out.push(rel)
  }
  return out
}

/** 去掉 JS 注释与 CSS 注释：注释里的实测值不算硬编码。 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

const styleNames = (await readdir(styleDir)).filter((n) => n.endsWith('.ts')).sort()
const fragments: { name: string; text: string; code: string }[] = []
for (const name of styleNames) {
  const text = await readFile(join(styleDir, name), 'utf8')
  fragments.push({ name, text, code: stripComments(text) })
}
const entryName = 'styles.ts'
const entryText = await readFile(join(root, 'src', 'client', entryName), 'utf8')
fragments.push({ name: entryName, text: entryText, code: stripComments(entryText) })

// --- 1. 死类双向比对 -------------------------------------------------------
const cssText = fragments.map((f) => f.code).join('\n')
const cssClasses = new Set([...cssText.matchAll(/\.(dtpl-[a-z0-9-]+)/g)].map((m) => m[1]))

const tsFiles = (await collect('src/client'))
  .filter((rel) => /\.tsx?$/.test(rel) && !rel.startsWith('src/client/styles/') && rel !== 'src/client/styles.ts')
const tsText = (await Promise.all(tsFiles.map((rel) => readFile(join(root, rel), 'utf8')))).join('\n')
const tsTokens = new Set([...tsText.matchAll(/(dtpl-[a-z0-9-]+)/g)].map((m) => m[1]))
// `dtpl-quota-tone-${tone}` 这类模板串在 TS 侧只留下前缀，带尾连字符的按前缀处理。
const tsPrefixes = [...tsTokens].filter((t) => t.endsWith('-'))
// `id="dtpl-tab-ledger"` / `aria-controls="dtpl-usage-panel"` 里的名字是**结构性锚点**，不是类：
// 它们本来就不需要样式规则，所以自动排除，不靠手工白名单。
const anchorNames = new Set(
  [...tsText.matchAll(/(?:id|aria-controls|aria-labelledby|htmlFor)="([^"]*)"/g)]
    .flatMap((m) => [...m[1].matchAll(/(dtpl-[a-z0-9-]+)/g)].map((x) => x[1])),
)

const deadInCss = [...cssClasses].filter((c) => !tsTokens.has(c) && !tsPrefixes.some((p) => c.startsWith(p))).sort()

// 结构性钩子：**挂着类名**、但本来就不该有样式规则的锚点——
// `dtpl-price-table` 是 `aria-controls` 指过来的那个面板（真正起作用的是它的 `id`），
// `dtpl-price-col-more` 是网格补位。真要清干净也行：留空 span / 留 `id` 就够。
// 这张表必须仍然存在——条目消失了就说明钩子没了，表本身也要跟着删，否则它会遮住真的死类。
const STRUCTURAL_HOOKS = ['dtpl-price-table', 'dtpl-price-col-more']
const staleHooks = STRUCTURAL_HOOKS.filter((h) => !tsTokens.has(h))
const unstyledInTs = [...tsTokens]
  .filter((t) => !t.endsWith('-') && !cssClasses.has(t) && !anchorNames.has(t) && !STRUCTURAL_HOOKS.includes(t))
  .sort()

check('样式表里没有无人使用的 dtpl-* 类', deadInCss.length === 0, { deadInCss })
check('TSX 里的 dtpl-* 类都有样式规则(结构性钩子除外)', unstyledInTs.length === 0, { unstyledInTs })
check('结构性钩子例外表没有失效条目', staleHooks.length === 0, { staleHooks })

// --- 2. 硬编码色值 ---------------------------------------------------------
const badHex: string[] = []
for (const f of fragments) {
  // `tokens.ts` 是唯一登记处：宿主变量的兜底、以及**插件自己的两个常数**
  // （品牌黄与压在其上的墨色——它们不跟皮肤翻转，所以不是宿主变量）。
  if (f.name === 'tokens.ts') continue
  for (const line of f.code.split('\n')) {
    // 别处只允许两种：`var(--宿主变量, #兜底)` 的兜底，以及 `color-mix(...)` 里的 #000 / #fff。
    const scrubbed = line.replace(/var\([^()]*#[0-9a-fA-F]{3,8}[^()]*\)/g, '').replace(/color-mix\([^()]*\)/g, '')
    for (const m of scrubbed.matchAll(/#[0-9a-fA-F]{3,8}/g)) badHex.push(`${f.name}: ${m[0]} — ${line.trim().slice(0, 72)}`)
  }
}
check('颜色值没有硬编码(只能走宿主变量,或写进 tokens.ts 的兜底与常数)', badHex.length === 0, { badHex })

// --- 3. 虚线 ---------------------------------------------------------------
const dashed = fragments.filter((f) => /dashed|dotted/.test(f.code)).map((f) => f.name)
check('没有虚线(dashed / dotted)', dashed.length === 0, { dashed })

// --- 4. 圆角 ---------------------------------------------------------------
const badRadius: string[] = []
for (const f of fragments) {
  for (const m of f.code.matchAll(/border-radius:\s*([^;]+);/g)) {
    const value = m[1].trim()
    if (value !== '0' && value !== '0px' && value !== '50%' && !value.startsWith('var(')) {
      badRadius.push(`${f.name}: ${value}`)
    }
  }
}
check('圆角只走 0 / 50% / var()', badRadius.length === 0, { badRadius })

// --- 5. 直连宿主变量 -------------------------------------------------------
// 白名单见 docs/UI-SPEC.md「达标线 · 直连宿主变量的位置」：遮罩、投影、滚动条、悬停底、
// 侧栏入口自己的地盘——那几处要的正是"宿主自己的配方"。
const DSW_ALLOWED = new Set(['tokens.ts', 'overlay.ts', 'footer.ts', 'shared.ts'])
const dswFiles = fragments.filter((f) => f.code.includes('--dsw-')).map((f) => f.name)
const dswSpread = dswFiles.filter((n) => !DSW_ALLOWED.has(n))
check('--dsw-* 只在白名单片段里直连', dswSpread.length === 0, { dswSpread })

// --- 6. reduced motion -----------------------------------------------------
const hasReduce = fragments.some((f) => f.code.includes('prefers-reduced-motion'))
check('prefers-reduced-motion 分支存在', hasReduce)

console.log(failures === 0 ? 'ui selfcheck: all good' : `ui selfcheck: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
