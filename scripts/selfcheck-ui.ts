/**
 * 界面禁令里**静态可判定那部分**的强制版（纯静态检查，不构建、不起服务）。
 *
 * "看到就是错"的散文清单不阻止任何事，而且会漂；搬到这里之后它们不读也生效。
 * 不问审美就能判的归这里，其余（「这一处的 `outline:none` 有没有替代指示」
 * 「这一句是不是重复编码」）留给人看。
 *
 *  1. 死类双向比对：样式表里定义了却没人用的 `dtpl-*` 类，以及 TSX 里挂着却没有样式规则的
 *     `dtpl-*`（两者都必须是空的——没有例外表）；
 *  2. 硬编码色值：只许出现在 `var(--宿主变量, #兜底)` 的兜底里，或 `color-mix()` 内的
 *     `#000` / `#fff`（全窗口的颜色必须跟着宿主皮肤走）；
 *  3. 虚线：`dashed` / `dotted` 必须为 0；
 *  4. 圆角：`border-radius` 只许 `0` / `50%`（真圆）/ `var(...)`；
 *  5. 直连宿主变量：`--dsw-*` 只许出现在 `DSW_ALLOWED` 白名单涉及的那几个片段里，其余片段一律走
 *     `--dtpl-*`；
 *  6. `prefers-reduced-motion` 分支必须存在；
 *  7. `:focus-visible` 与窄屏 `@media (max-width)` 分支必须存在；
 *  8. 字面量 `aria-controls` / `aria-labelledby` / `aria-describedby` / `htmlFor` 指向的 id 必须已声明；
 *  9. CSS 括号配平：一个多余的 `}` 会让解析器静默吞掉紧随其后的一整条规则，而那条规则里的
 *     类名、颜色、圆角全都合规——第 1-8 项因此全绿，浏览器里那个元素却拿着全默认值。
 *
 * Run: node --experimental-strip-types scripts/selfcheck-ui.ts
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
// 两侧都取**完整的**类名：`-` 在类名里合法，所以 `\.(dtpl-[\w-]+)` 会把
// `dtpl-price-history-foot` 截成 `dtpl-price-history`，凭空造出一个没人用的类。
// 动态拼出来的那一半（样式侧 `.dtpl-quota-tone-ok` / TS 侧 `` `dtpl-quota-tone-${tone}` ``）
// 只可能以前缀的形式被静态看到，所以两侧各另收一遍「以 `-` 收尾」的前缀。
const DTPL_NAME = /\b(dtpl-[a-z0-9]+(?:-[a-z0-9]+)*)/g

const cssText = fragments.map((f) => f.code).join('\n')
const cssClasses = new Set([...cssText.matchAll(/\.(dtpl-[a-z0-9]+(?:-[a-z0-9]+)*)(?![\w-])/g)].map((m) => m[1]))
const cssPrefixes = [...cssText.matchAll(/\.(dtpl-[a-z0-9]+(?:-[a-z0-9]+)*)-/g)].map((m) => m[1])

const tsFiles = (await collect('src/client'))
  .filter((rel) => /\.tsx?$/.test(rel) && !rel.startsWith('src/client/styles/') && rel !== 'src/client/styles.ts')
const tsText = (await Promise.all(tsFiles.map((rel) => readFile(join(root, rel), 'utf8')))).join('\n')
const tsTokens = new Set([...tsText.matchAll(DTPL_NAME)].map((m) => m[1]))
const tsPrefixes = [...tsText.matchAll(/\b(dtpl-[a-z0-9]+(?:-[a-z0-9]+)*)-\$\{/g)].map((m) => m[1])

const deadInCss = [...cssClasses]
  .filter((c) => !tsTokens.has(c)
    && !tsPrefixes.some((p) => c.startsWith(`${p}-`))
    && !cssPrefixes.some((p) => tsTokens.has(p)))
  .sort()
// `id="dtpl-tab-ledger"` / `aria-controls="dtpl-usage-panel"` 里的名字是**结构性锚点**，不是类：
// 它们本来就不需要样式规则，所以自动排除，不靠手工白名单。属性值可能是模板串
// （`` id={`dtpl-usage-tab-${id}`} ``），所以两侧都取：字面量的完整名，加上模板串里那个**前缀**。
const anchorNames = new Set(
  [...tsText.matchAll(/(?:id|aria-controls|aria-labelledby|htmlFor)=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
    .flatMap((m) => [...(m[1] ?? m[2] ?? '').matchAll(DTPL_NAME)].map((x) => x[1])),
)
for (const m of tsText.matchAll(/(?:id|aria-controls|aria-labelledby|htmlFor)=\{`[^`]*?(dtpl-[a-z0-9]+(?:-[a-z0-9]+)*)-\$\{/g)) {
  anchorNames.add(m[1])
}

// TS 侧的动态拼接（`` `dtpl-quota-tone-${tone}` `` → 只留下前缀 `dtpl-quota-tone`）与样式侧的
// 静态全名互为镜像：一个 token 只要**是某条样式规则名字的前缀**，它就有人用。
// （例外表曾在这里，只剩一个「结构性钩子」条目；两个下拉取代模型行网格之后那个钩子也没了，
// 所以整张表跟着删——留一张空表只会让人觉得还有例外。）
//
// 自定义属性（`style={{ '--dtpl-slots': … }}`）也不是类：它挂在 `--` 之后，样式侧写在
// `calc(var(--dtpl-slots,4) * 92px)` 里、从来不带 `.`，所以跟锚点一样**按上下文**排除，
// 不往例外表里塞名字。
const cssVarNames = new Set(
  [...tsText.matchAll(/--(dtpl-[a-z0-9]+(?:-[a-z0-9]+)*)/g)].map((m) => m[1]),
)
const unstyledInTs = [...tsTokens]
  .filter((t) => !cssClasses.has(t)
    && ![...cssClasses].some((c) => c.startsWith(`${t}-`))
    && !anchorNames.has(t)
    && !cssVarNames.has(t))
  .sort()

check('样式表里没有无人使用的 dtpl-* 类', deadInCss.length === 0, { deadInCss })
check('TSX 里的 dtpl-* 类都有样式规则', unstyledInTs.length === 0, { unstyledInTs })

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
// 遮罩、投影、滚动条、悬停底、侧栏入口自己的地盘——那几处要的正是"宿主自己的配方"。
const DSW_ALLOWED = new Set(['tokens.ts', 'overlay.ts', 'footer.ts', 'shared.ts'])
const dswFiles = fragments.filter((f) => f.code.includes('--dsw-')).map((f) => f.name)
const dswSpread = dswFiles.filter((n) => !DSW_ALLOWED.has(n))
check('--dsw-* 只在白名单片段里直连', dswSpread.length === 0, { dswSpread })

// --- 6. reduced motion -----------------------------------------------------
// 6/7/8 三项是**存在性**断言：任意一个分片里有那段规则就为真，不校验它覆盖了哪个面。
// 与 1-5 项的逐类 / 逐行判定不是一个强度，别读成「每个面都有」。
const hasReduce = fragments.some((f) => f.code.includes('prefers-reduced-motion'))
check('prefers-reduced-motion 分支存在(存在性:不校验覆盖面)', hasReduce)

// --- 7. 焦点与窄屏分支必须存在 ---------------------------------------------
// §1.4「焦点必须可见」与 §2「窄屏是一整段独立配方」落成的就是那几段规则——整段被删掉时
// 页面照常渲染。「某一处的 outline:none 有没有替代指示」仍是人的判断，这里不冒充。
const hasFocus = fragments.some((f) => f.code.includes(':focus-visible'))
check(':focus-visible 分支存在(存在性:不校验覆盖面)', hasFocus)
const hasNarrow = fragments.some((f) => /@media[^{]*max-width\s*:/.test(f.code))
check('窄屏 @media (max-width) 分支存在(存在性:不校验覆盖面)', hasNarrow)

// --- 8. 字面量 ARIA / label 引用必须解析得到 --------------------------------
// `aria-controls` 指到一个不存在的 id 是静默的无障碍失效:读数正常、键盘焦点跳空,
// 页面上看不出任何异常(见 LedgerOverlay 里「每格写死一个自己的 id」那条陷阱)。
// 只比对**字面量**一侧:模板串与变量目标在静态里无从判定,交给渲染验证。
const tsCode = stripComments(tsText)
const declaredIds = new Set(
  [...tsCode.matchAll(/\bid=(?:"([^"]+)"|\{"([^"]+)"\})/g)].map((m) => m[1] ?? m[2]),
)
const referencedIds = [
  ...tsCode.matchAll(/\b(?:aria-controls|aria-labelledby|aria-describedby|htmlFor)=(?:"([^"]+)"|\{"([^"]+)"\})/g),
].map((m) => (m[1] ?? m[2]).trim().split(/\s+/)).flat()
const danglingRefs = [...new Set(referencedIds.filter((id) => !declaredIds.has(id)))].sort()
check('字面量 aria-controls / labelledby / describedby / htmlFor 都指向已声明的 id', danglingRefs.length === 0, { danglingRefs })

// --- 9. CSS 良构：括号必须配平 ---------------------------------------------
// 一个多余的 `}` 会让解析器进入错误恢复，**静默吞掉紧随其后的一条规则**：那条规则里的
// 类名还在 TSX 里、颜色与圆角也都合规，于是第 1-8 项全绿，而浏览器里那个元素拿到的是
// 全默认值。实测过一次：`.dtpl-tok-scroll` 整条被吞，滚动区退回 `overflow:visible` +
// `flex-grow:0`，整页从此不能滚 —— 症状是「滚不动」，而所有检查都说没问题。
//
// 按 CSS 的括号语义数一遍。注释与字符串不参与计数（`content:"}"` 是合法值，不是括号）。
// 两个方向都要报：多出来的 `}`（depth 探负）与没闭上的 `{`（收尾非零）。
// 逐片段判而不是拼起来判：片段在 styles.ts 里是**分别**注入的，拼起来数会把一个片段的
// 缺口平摊到邻居头上，报出来的位置就是错的。
function braceFault(css: string): string | null {
  let depth = 0
  let stray = -1
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i]
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 1
      continue
    }
    if (ch === '"' || ch === "'") {
      i += 1
      while (i < css.length && css[i] !== ch) {
        if (css[i] === '\\') i += 1
        i += 1
      }
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth < 0 && stray === -1) stray = i
    }
  }
  const lineAt = (index: number): number => css.slice(0, index).split('\n').length
  if (stray !== -1) return `第 ${lineAt(stray)} 行多出一个 }`
  if (depth !== 0) return `结尾有 ${depth} 个 { 没闭上`
  return null
}

// 片段里的模板串可能带 `${...}` 插值（样式侧目前没有，但别让将来的一个人踩空）：
// 插值对括号计数是透明的，原样当文本数即可，这里不额外剥。
const braceFaults = fragments
  .map((f) => ({ name: f.name, fault: braceFault(f.text) }))
  .filter((x) => x.fault !== null)
  .map((x) => `${x.name}: ${x.fault}`)
check('CSS 片段括号配平(多余的 } 会静默吞掉后面一整条规则)', braceFaults.length === 0, { braceFaults })

console.log(failures === 0 ? 'ui selfcheck: all good' : `ui selfcheck: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
