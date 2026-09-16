/**
 * Self-check that the documentation layer stays honest (pure file checks, no
 * harness or data-directory access):
 *
 *  1. `docs/CONTRACTS.md` does **not** re-list host routes: routes are code
 *     (`src/routes.ts`), so the old route↔doc comparison was guarding a mirror
 *     that should not exist. The check is inverted — a `/tokbook/...` path
 *     appearing in CONTRACTS is now the failure;
 *  2. every relative markdown link in `docs/INDEX.md` resolves to an existing
 *     file (the map must never point into the void);
 *  3. every tracked markdown doc (README + all of docs/, including archive/)
 *     carries a `> **Doc meta**` line near the top with `role:` and `status:`,
 *     so every file is classifiable and stale/unclassified docs are visible by
 *     construction; `last-reviewed` must be a real, non-future date;
 *  4. every entry in `docs/DECISIONS.md` carries a machine-parsable `Status`
 *     line, its supersession edges exist and are recorded on BOTH entries, the
 *     status agrees with those edges, and the index table at the top is a
 *     row-for-row projection of the entries (id / date / title / status) — so
 *     the "what is in force now" table can never drift from the body.
 *  5. the tree in `README.md` · 布局 names only files that exist and names
 *     every file under `src/` and `scripts/` — it is the code map, so it may
 *     neither invent paths nor silently omit them (a directory line such as
 *     `styles/` covers everything below it);
 *  6. no `docs/DECISIONS.md` entry exceeds 80 lines, and the entries over the
 *     40-line 判据 are printed as `info` — the 「越界条目」 list used to be a
 *     hand-maintained table in `docs/WORKFLOW.md`, i.e. a mirror that rotted;
 *     it is derived here instead.
 *  7. `docs/UI-SPEC.md` stays under 200 lines. It is the only UI document left
 *     (取值与规格的真源是 `src/client/styles/**`,可判定的禁令在
 *     `scripts/selfcheck-ui.ts`), so it must stay a checklist rather than grow
 *     back into a spec — same brake `AGENTS.md` has at 80 lines.
 *
 * Run: node --experimental-strip-types scripts/selfcheck-docs.ts
 *
 * @module dsh-tokbook/selfcheck-docs
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

let failures = 0
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ' — ' + JSON.stringify(detail)}`)
  if (!ok) failures += 1
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Recursively collect every `.md` file under a directory. */
async function collectMarkdown(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await collectMarkdown(full))
    else if (entry.isFile() && extname(entry.name) === '.md') out.push(full)
  }
  return out
}

// --- 1. CONTRACTS 不复述路由(路由是代码) ------------------------------------
// 路由真源是 `src/routes.ts`,读它比读文档直接。所以这里反过来守:文档里**不该**出现路由路径。
const contractsPath = join(root, 'docs', 'CONTRACTS.md')
const contractsText = await readFile(contractsPath, 'utf8')
const contractRoutes = [...new Set([...contractsText.matchAll(/(\/tokbook\/[\w-]+)/g)].map((m) => m[1]))].sort()
check('docs/CONTRACTS.md 不复述路由路径(真源是 src/routes.ts)', contractRoutes.length === 0, { contractRoutes })

// --- 2. every relative link in docs/INDEX.md resolves ---
const indexPath = join(root, 'docs', 'INDEX.md')
const indexText = await readFile(indexPath, 'utf8')
const broken: string[] = []
for (const m of indexText.matchAll(/\]\(([^)]+)\)/g)) {
  let target = m[1]
  if (/^(https?:|mailto:)/.test(target) || target.startsWith('#')) continue
  const hash = target.indexOf('#')
  if (hash >= 0) target = target.slice(0, hash)
  if (target === '') continue
  try {
    await stat(resolve(dirname(indexPath), target))
  } catch {
    broken.push(target)
  }
}
check('every relative link in docs/INDEX.md resolves', broken.length === 0, { broken })

// --- 3. every tracked doc carries a `> **Doc meta**` line (role + status) ---
const ALLOWED_STATUS = new Set(['current', 'superseded', 'draft'])
const docs = [join(root, 'README.md'), ...await collectMarkdown(join(root, 'docs'))]
const missingMeta: string[] = []
const badReviewDates: string[] = []
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
for (const file of docs) {
  const text = await readFile(file, 'utf8')
  const head = text.split('\n').slice(0, 15).join('\n')
  const line = head.split('\n').find((l) => /^>\s*\*\*Doc meta\*\*/.test(l))
  const role = line?.match(/role:\s*(\S+)/)?.[1]
  const status = line?.match(/status:\s*(\S+)/)?.[1]
  if (line === undefined || role === undefined || status === undefined || !ALLOWED_STATUS.has(status)) {
    missingMeta.push(relative(root, file))
  }
  // `last-reviewed` is a self-declared hint, not a freshness authority (git
  // is) — but a malformed or future date is still a lie worth failing on.
  const reviewed = line?.match(/last-reviewed:\s*(\S+)/)?.[1]
  if (reviewed === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(reviewed) || reviewed > today) {
    badReviewDates.push(`${relative(root, file)}: ${reviewed ?? '(缺)'}`)
  }
}
check('every tracked doc carries a valid Doc meta line', missingMeta.length === 0, { missingMeta })
check('every Doc meta last-reviewed is a real, non-future date', badReviewDates.length === 0, { badReviewDates })

// --- 4. docs/DECISIONS.md: status lines, two-way supersession, index = projection ---
const decisionsText = await readFile(join(root, 'docs', 'DECISIONS.md'), 'utf8')

const HEADING = /^### (D-\d{3}) · (\S+) · (.+)$/
const STATUS_LINE = /^\*\*Status: (current|partially superseded|superseded)\*\* · supersedes: (.*) · superseded-by: (.*)$/
const INDEX_ROW = /^\| (D-\d{3}) \| (.+) \| (.+) \| (current|partially superseded|superseded) \|$/

interface Decision {
  id: string
  date: string
  title: string
  status: string
  supersedes: string[]
  supersededBy: string[]
}
const decisions: Decision[] = []
const indexRows: { id: string; date: string; title: string; status: string }[] = []
const badStatus: string[] = []

/** Read the `D-NNN` list out of an edge field; anything else but a dash is noise. */
function edgeIds(field: string): string[] | undefined {
  const ids = [...field.matchAll(/D-\d{3}/g)].map((m) => m[0])
  const residue = field.replace(/D-\d{3}/g, '').replace(/[,\s]/g, '')
  return residue === '' || residue === '—' || residue === '-' ? ids : undefined
}

let fenced = false
for (const line of decisionsText.split('\n')) {
  if (/^\s*```/.test(line)) fenced = !fenced
  else if (fenced) continue
  else {
    const h = HEADING.exec(line)
    const row = INDEX_ROW.exec(line)
    if (h !== null) {
      decisions.push({ id: h[1], date: h[2], title: h[3], status: '', supersedes: [], supersededBy: [] })
    } else if (row !== null) {
      indexRows.push({ id: row[1], date: row[2], title: row[3], status: row[4] })
    } else if (line.startsWith('**Status:')) {
      const current = decisions.at(-1)
      const m = STATUS_LINE.exec(line)
      const supersedes = m === null ? undefined : edgeIds(m[2])
      const supersededBy = m === null ? undefined : edgeIds(m[3])
      if (current === undefined || m === null || supersedes === undefined || supersededBy === undefined || current.status !== '') {
        badStatus.push(`${current?.id ?? '(表头之前)'}: ${line}`)
      } else {
        current.status = m[1]
        current.supersedes = supersedes
        current.supersededBy = supersededBy
      }
    }
  }
}
check('every DECISIONS entry has one parsable Status line', badStatus.length === 0, { badStatus })

const byId = new Map(decisions.map((d) => [d.id, d]))
const edgeProblems: string[] = []
for (const d of decisions) {
  if ((d.status === 'current') !== (d.supersededBy.length === 0)) {
    edgeProblems.push(`${d.id}: status「${d.status}」与 superseded-by 不符`)
  }
  for (const target of [...d.supersedes, ...d.supersededBy]) {
    if (target === d.id) edgeProblems.push(`${d.id}: 自引用`)
    else if (!byId.has(target)) edgeProblems.push(`${d.id}: 引用了不存在的 ${target}`)
  }
  for (const t of d.supersedes) {
    if (!byId.get(t)?.supersededBy.includes(d.id)) edgeProblems.push(`${d.id} supersedes ${t},但 ${t} 没写 superseded-by`)
  }
  for (const t of d.supersededBy) {
    if (!byId.get(t)?.supersedes.includes(d.id)) edgeProblems.push(`${d.id} superseded-by ${t},但 ${t} 没写 supersedes`)
  }
}
check('DECISIONS supersession edges exist, are two-way, and match status', edgeProblems.length === 0, { edgeProblems })

const expected = decisions
  .filter((d) => d.status !== 'superseded')
  .map((d) => `${d.id} | ${d.date} | ${d.title} | ${d.status}`)
const actual = indexRows.map((r) => `${r.id} | ${r.date} | ${r.title} | ${r.status}`)
const indexProblems = [
  ...expected.filter((e) => !actual.includes(e)).map((e) => `表里缺/不符: ${e}`),
  ...actual.filter((a) => !expected.includes(a)).map((a) => `表里多/不符: ${a}`),
]
check('DECISIONS index table is a projection of the entries', indexProblems.length === 0, { indexProblems })

// --- 5. the README · 布局 tree == what is actually under src/ and scripts/ ---
const readmeLines = (await readFile(join(root, 'README.md'), 'utf8')).split('\n')
const layoutAt = readmeLines.findIndex((l) => /^##\s+布局\s*$/.test(l))
const fenceAt = layoutAt < 0 ? -1 : readmeLines.findIndex((l, i) => i > layoutAt && /^```/.test(l))
const fenceEnd = fenceAt < 0 ? -1 : readmeLines.findIndex((l, i) => i > fenceAt && /^```/.test(l))

const layoutFiles = new Set<string>()
const layoutDirs = new Set<string>()
const inventedPaths: string[] = []
if (fenceAt < 0 || fenceEnd < 0) {
  inventedPaths.push('README.md:找不到 `## 布局` 下的代码块')
} else {
  const stack: { indent: number; path: string }[] = []
  for (const raw of readmeLines.slice(fenceAt + 1, fenceEnd)) {
    if (raw.trim() === '') continue
    const indent = raw.length - raw.trimStart().length
    const name = raw.trim().split(/\s+/)[0]
    if (!/^[\w.-]+\/?$/.test(name)) continue
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop()
    const parent = stack.length > 0 ? `${stack[stack.length - 1].path}/` : ''
    const path = parent + name.replace(/\/$/, '')
    if (name.endsWith('/')) {
      stack.push({ indent, path })
      layoutDirs.add(path)
    } else {
      layoutFiles.add(path)
    }
  }
  for (const p of [...layoutDirs, ...layoutFiles]) {
    try {
      await stat(join(root, p))
    } catch {
      inventedPaths.push(p)
    }
  }
}
check('every path in README · 布局 exists', inventedPaths.length === 0, { inventedPaths })

async function collectAll(rel: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(join(root, rel), { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`
    if (entry.isDirectory()) out.push(...await collectAll(child))
    else if (entry.isFile()) out.push(child)
  }
  return out
}

const missingFromLayout: string[] = []
// 只有**叶子**目录行才表示「这里整片不逐项列出」(如 `styles/`);带子项的目录
// (如 `src/`、`client/`)只是树的骨架,不提供覆盖 —— 否则根行 `src/` 会让这条
// 检查恒真,漏掉的文件再也抓不到。
const groups = [...layoutDirs].filter((d) => ![...layoutFiles, ...layoutDirs].some((p) => p.startsWith(`${d}/`)))
for (const base of ['src', 'scripts']) {
  for (const rel of await collectAll(base)) {
    const covered = layoutFiles.has(rel) || groups.some((d) => rel.startsWith(`${d}/`))
    if (!covered) missingFromLayout.push(rel)
  }
}
check('README · 布局 lists every file under src/ and scripts/', missingFromLayout.length === 0, { missingFromLayout })

// --- 6. DECISIONS entry size: 40 行是判据(只打印),80 行是硬顶 ---
const ADR_SOFT = 40
const ADR_HARD = 80
const entrySizes: { id: string; lines: number }[] = []
{
  const all = decisionsText.split('\n')
  const starts: number[] = []
  let fence = false
  for (let i = 0; i < all.length; i += 1) {
    if (/^\s*```/.test(all[i])) fence = !fence
    // `## ` 也算边界:条目之后的章节(「如何追加条目」)不该被算进最后一条的体量。
    else if (!fence && /^#{2,3} /.test(all[i])) starts.push(i)
  }
  for (let k = 0; k < starts.length; k += 1) {
    const heading = HEADING.exec(all[starts[k]])
    if (heading === null) continue
    const to = k + 1 < starts.length ? starts[k + 1] : all.length
    const from = all.findIndex((l, i) => i > starts[k] && i < to && l.startsWith('**Status:'))
    if (from < 0) continue
    const body = all.slice(from, to)
    let end = body.length
    // 计数规则(见 docs/WORKFLOW.md §7):从状态行到条目末尾、含空行;
    // 标题与 `---` 分隔线不计。
    while (end > 0 && (body[end - 1].trim() === '' || /^---\s*$/.test(body[end - 1]))) end -= 1
    entrySizes.push({ id: heading[1], lines: end })
  }
}
const oversized = entrySizes.filter((e) => e.lines > ADR_SOFT)
console.log(`  info DECISIONS 条目 > ${ADR_SOFT} 行:${oversized.map((e) => `${e.id} ${e.lines}`).join(' · ') || '(无)'}`)
const overHard = entrySizes.filter((e) => e.lines > ADR_HARD).map((e) => `${e.id} ${e.lines}`)
check(`no DECISIONS entry exceeds ${ADR_HARD} lines`, overHard.length === 0, { overHard })

// --- 7. 两份「只写规则」的文档各装一道体量闸门 -------------------------------
// UI-SPEC(不变量 / 达标线 / 陷阱)与 CONTRACTS(读不出来的规则)都是**不该复述代码**的文件:
// 取值与规格的真源是 `src/client/styles/**`,路由与 wire 的真源是 `src/`。
// 它们一旦重新长成规格,就说明有人又开始抄代码了 —— 给它们与 `AGENTS.md` 同样的刹车。
async function sizeBrake(file: string, max: number): Promise<void> {
  const lines = (await readFile(join(root, file), 'utf8')).split('\n').length
  console.log(`  info ${file} ${lines} 行(体量闸门 ${max})`)
  check(`${file} stays under ${max} lines`, lines <= max, { lines })
}
await sizeBrake('docs/UI-SPEC.md', 200)
await sizeBrake('docs/CONTRACTS.md', 120)

console.log(failures === 0 ? 'docs selfcheck: all good' : `docs selfcheck: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
