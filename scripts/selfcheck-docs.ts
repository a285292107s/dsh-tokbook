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
 *     construction.
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

console.log(failures === 0 ? 'docs selfcheck: all good' : `docs selfcheck: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
