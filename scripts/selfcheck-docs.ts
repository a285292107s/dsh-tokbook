/**
 * Self-check that the documentation layer stays honest (pure file checks, no
 * harness or data-directory access):
 *
 *  1. every host route path registered in `src/routes.ts` is documented in
 *     `docs/CONTRACTS.md`, and every `/tokbook/*` token there exists in code
 *     (a contract doc may not drift from the code, and may not invent routes);
 *  2. every relative markdown link in `docs/INDEX.md` resolves to an existing
 *     file (the map must never point into the void);
 *  3. every tracked markdown doc (README + all of docs/, including archive/)
 *     carries a `> **Doc meta**` line near the top with `role:` and `status:`,
 *     so every file is classifiable and stale/unclassified docs are visible by
 *     construction;
 *  4. every entry in `docs/DECISIONS.md` carries a machine-parsable `Status`
 *     line, its supersession edges exist and are recorded on BOTH entries, the
 *     status agrees with those edges, and the index table at the top is a
 *     row-for-row projection of the entries (id / date / title / status) — so
 *     the "what is in force now" table can never drift from the body.
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

// --- 1. host routes in src/routes.ts == /tokbook/* tokens in docs/CONTRACTS.md ---
const routesSource = await readFile(join(root, 'src', 'routes.ts'), 'utf8')
const codeRoutes = new Set<string>()
for (const m of routesSource.matchAll(/path:\s*'(\/tokbook\/[\w-]+)'/g)) codeRoutes.add(m[1])

const contractsPath = join(root, 'docs', 'CONTRACTS.md')
const contractsText = await readFile(contractsPath, 'utf8')
const docRoutes = new Set<string>()
for (const m of contractsText.matchAll(/(\/tokbook\/[\w-]+)/g)) docRoutes.add(m[1])

const notDocumented = [...codeRoutes].filter((r) => !docRoutes.has(r)).sort()
const invented = [...docRoutes].filter((r) => !codeRoutes.has(r)).sort()
check('docs/CONTRACTS.md documents every host route', notDocumented.length === 0, { notDocumented })
check('docs/CONTRACTS.md lists no route absent from code', invented.length === 0, { invented })

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
for (const file of docs) {
  const text = await readFile(file, 'utf8')
  const head = text.split('\n').slice(0, 15).join('\n')
  const line = head.split('\n').find((l) => /^>\s*\*\*Doc meta\*\*/.test(l))
  const role = line?.match(/role:\s*(\S+)/)?.[1]
  const status = line?.match(/status:\s*(\S+)/)?.[1]
  if (line === undefined || role === undefined || status === undefined || !ALLOWED_STATUS.has(status)) {
    missingMeta.push(relative(root, file))
  }
}
check('every tracked doc carries a valid Doc meta line', missingMeta.length === 0, { missingMeta })

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

console.log(failures === 0 ? 'docs selfcheck: all good' : `docs selfcheck: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
