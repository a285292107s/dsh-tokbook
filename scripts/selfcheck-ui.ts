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

async function collect(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) await collect(rel, out)
    else if (entry.isFile()) out.push(rel)
  }
  return out
}

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
    && !tsPrefixes.includes(c))
  .sort()
const anchorNames = new Set(
  [...tsText.matchAll(/(?:id|aria-controls|aria-labelledby|htmlFor)=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
    .flatMap((m) => [...(m[1] ?? m[2] ?? '').matchAll(DTPL_NAME)].map((x) => x[1])),
)
for (const m of tsText.matchAll(/(?:id|aria-controls|aria-labelledby|htmlFor)=\{`[^`]*?(dtpl-[a-z0-9]+(?:-[a-z0-9]+)*)-\$\{/g)) {
  anchorNames.add(m[1])
}

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

const badHex: string[] = []
for (const f of fragments) {
  if (f.name === 'tokens.ts') continue
  for (const line of f.code.split('\n')) {
    const scrubbed = line.replace(/var\([^()]*#[0-9a-fA-F]{3,8}[^()]*\)/g, '').replace(/color-mix\([^()]*\)/g, '')
    for (const m of scrubbed.matchAll(/#[0-9a-fA-F]{3,8}/g)) badHex.push(`${f.name}: ${m[0]} — ${line.trim().slice(0, 72)}`)
  }
}
check('颜色值没有硬编码(只能走宿主变量,或写进 tokens.ts 的兜底与常数)', badHex.length === 0, { badHex })

const dashed = fragments.filter((f) => /dashed|dotted/.test(f.code)).map((f) => f.name)
check('没有虚线(dashed / dotted)', dashed.length === 0, { dashed })

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

const DSW_ALLOWED = new Set(['tokens.ts', 'overlay.ts', 'footer.ts', 'shared.ts'])
const dswFiles = fragments.filter((f) => f.code.includes('--dsw-')).map((f) => f.name)
const dswSpread = dswFiles.filter((n) => !DSW_ALLOWED.has(n))
check('--dsw-* 只在白名单片段里直连', dswSpread.length === 0, { dswSpread })

const hasReduce = fragments.some((f) => f.code.includes('prefers-reduced-motion'))
check('prefers-reduced-motion 分支存在(存在性:不校验覆盖面)', hasReduce)

const hasFocus = fragments.some((f) => f.code.includes(':focus-visible'))
check(':focus-visible 分支存在(存在性:不校验覆盖面)', hasFocus)
const hasNarrow = fragments.some((f) => /@media[^{]*max-width\s*:/.test(f.code))
check('窄屏 @media (max-width) 分支存在(存在性:不校验覆盖面)', hasNarrow)

const tsCode = stripComments(tsText)
const declaredIds = new Set(
  [...tsCode.matchAll(/\bid=(?:"([^"]+)"|\{"([^"]+)"\})/g)].map((m) => m[1] ?? m[2]),
)
const referencedIds = [
  ...tsCode.matchAll(/\b(?:aria-controls|aria-labelledby|aria-describedby|htmlFor)=(?:"([^"]+)"|\{"([^"]+)"\})/g),
].map((m) => (m[1] ?? m[2]).trim().split(/\s+/)).flat()
const danglingRefs = [...new Set(referencedIds.filter((id) => !declaredIds.has(id)))].sort()
check('字面量 aria-controls / labelledby / describedby / htmlFor 都指向已声明的 id', danglingRefs.length === 0, { danglingRefs })

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

const braceFaults = fragments
  .map((f) => ({ name: f.name, fault: braceFault(f.text) }))
  .filter((x) => x.fault !== null)
  .map((x) => `${x.name}: ${x.fault}`)
check('CSS 片段括号配平(多余的 } 会静默吞掉后面一整条规则)', braceFaults.length === 0, { braceFaults })

console.log(failures === 0 ? 'ui selfcheck: all good' : `ui selfcheck: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
