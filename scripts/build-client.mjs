// Build script for an EXTERNAL DSH plugin (no published `clientBundle` preset).
//
// Produces two artifacts:
//   lib/index.js   — host half, plain node ESM with every bare import external
//                    (they resolve from the profile's node_modules / module table)
//   lib/client.js  — browser half, the lazy-CJS factory `clientBundle()` would emit:
//                    window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
//
// The external list mirrors the DSH baseline (PLATFORM_MODULES in
// packages/client/web/src/platform.ts). Keep it in sync with DSH upgrades.

import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 本插件 client 半区**实际 import** 的基线模块——不是 DSH `PLATFORM_MODULES` 的全集。
// 这份清单还兼一道门禁：列在这里的 specifier 允许留在 bundle 外，其余一律判死
// （`verifyClientBundle`）。client 半区的运行时依赖只能是 DSH 基线模块表里确实有的那几个
// （见 `src/client/contract.ts`）；多列几个看起来无害，但会让一个越界 import 静默构建通过、
// 到运行时才靠宿主的模块表兜住。
const BASELINE_EXTERNALS = [
  'react',
  'react/jsx-runtime',
]

// client 入口 id 必须等于包名：DSH 的 client-modules 用包名去请求 `exports["./client"]`。
// 从 package.json 取而不是写死一份，改名只有一处要改。
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const CLIENT_ID = String(pkg.name)

async function main() {
  mkdirSync(resolve(root, 'lib'), { recursive: true })

  // 1) Host half: node ESM, bare imports left external.
  await build({
    entryPoints: [resolve(root, 'src/index.ts')],
    outfile: resolve(root, 'lib/index.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
    packages: 'external',
  })

  // 2) Browser half: bundle to CJS (write:false), then wrap into the loader factory.
  const client = await build({
    entryPoints: [resolve(root, 'src/client/index.ts')],
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    target: 'es2022',
    // Keep CJK as literal UTF-8 so the shipped browser bundle stays readable
    // (esbuild's default `ascii` charset would escape it to \uXXXX).
    charset: 'utf8',
    external: BASELINE_EXTERNALS,
    // hero 底图是**内联的 data URI**：client 半区只有 `lib/client.js` 一个产物，没有随包的
    // 静态目录，也就不存在一个能挂相对 URL 的位置。所以图必须进 bundle（≈60KB base64）。
    loader: { '.jpg': 'dataurl' },
    write: false,
  })
  const bundled = client.outputFiles[0].text
  const factory = [
    // The loader injects `require`; the plugin bundle uses it for baseline externals.
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

/**
 * 校验写出的 client bundle 与 DSH 的接线契约。这三件事错了都不会让构建失败，只会
 * 表现为「侧栏没有按钮、浮窗打不开」——没有别的发现路径：
 *   1. bundle 里出现的每个 `require(specifier)` 都在 {@link BASELINE_EXTERNALS} 里；
 *   2. client 入口命名导出 `apply` + `inject`，且**没有** `default`（cordis loader 读
 *      `exports.default ?? exports`，一个 default 导出会遮蔽 `.inject`）；
 *   3. 包裹形状与 id 与包名一致。
 * 用只吐自身的 Proxy 冒充基线模块表：bundle 在模块级只 require + 读属性，组件渲染
 * 不在这一层发生。
 */
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
