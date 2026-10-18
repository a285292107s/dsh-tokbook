import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const BASELINE_EXTERNALS = [
  'react',
  'react/jsx-runtime',
]

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const CLIENT_ID = String(pkg.name)

async function main() {
  mkdirSync(resolve(root, 'lib'), { recursive: true })

  await build({
    entryPoints: [resolve(root, 'src/index.ts')],
    outfile: resolve(root, 'lib/index.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
    packages: 'external',
  })

  const client = await build({
    entryPoints: [resolve(root, 'src/client/index.ts')],
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    target: 'es2022',
    charset: 'utf8',
    external: BASELINE_EXTERNALS,
    loader: { '.jpg': 'dataurl' },
    write: false,
  })
  const bundled = client.outputFiles[0].text
  const factory = [
    'var module = { exports: {} }; var exports = module.exports;',
    bundled,
    'return module.exports;',
  ].join('\n')
  const wrapped =
    `window.__ModuleLoader__.load({\n` +
    `  id: ${JSON.stringify(CLIENT_ID)},\n` +
    `  factory: (require) => {\n` +
    factory.split('\n').map((line) => `    ${line}`).join('\n') +
    `\n  },\n` +
    `});\n`
  writeFileSync(resolve(root, 'lib/client.js'), wrapped)
  verifyClientBundle(wrapped)

  console.log('built lib/index.js (host) and lib/client.js (lazy-CJS browser bundle)')
}

function verifyClientBundle(code) {
  const problems = []
  if (!code.startsWith('window.__ModuleLoader__.load(')) problems.push('包裹形状不是 window.__ModuleLoader__.load(...)')
  if (!code.includes(`id: ${JSON.stringify(CLIENT_ID)}`)) problems.push(`入口 id 不是包名 ${CLIENT_ID}`)
  const stub = new Proxy(function () {}, {
    get: (_target, key) => (key === '__esModule' ? false : stub),
    apply: () => stub,
    construct: () => stub,
  })
  const requireStub = (name) => {
    if (!BASELINE_EXTERNALS.includes(name)) problems.push(`client bundle 需要基线模块表里没有的 "${name}"`)
    return stub
  }
  try {
    let entry
    new Function('window', 'require', code)({ __ModuleLoader__: { load: (value) => { entry = value } } }, requireStub)
    const exported = entry.factory(requireStub)
    if (typeof exported.apply !== 'function') problems.push('client 入口没有命名导出 apply')
    if (!Array.isArray(exported.inject)) problems.push('client 入口没有命名导出 inject（数组）')
    if (exported.default !== undefined) problems.push('client 入口不得有 default 导出：它会遮蔽 .inject')
  } catch (error) {
    problems.push(`client bundle 无法自证：${error instanceof Error ? error.message : String(error)}`)
  }
  if (problems.length > 0) {
    throw new Error(`lib/client.js 不满足 DSH 接线契约：\n  - ${problems.join('\n  - ')}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
