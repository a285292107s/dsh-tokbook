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
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Baseline module-table names the browser may `require` but the plugin must not bundle.
const BASELINE_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

// The plugin's browser entry id must equal the package name.
const CLIENT_ID = 'dsh-tokbook'

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

  console.log('built lib/index.js (host) and lib/client.js (lazy-CJS browser bundle)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
