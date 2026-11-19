// THE PHONE'S VIEWS (src/native) — what they may and may not bring with them.
// A phone app bundles them with Metro for Hermes: nothing of the web's (its
// designs, CSS, react-dom, ui-table) may be reached from @xeplr/ui-factory/native,
// and the stand-in for react-router answers "no router" so URL state stays in
// memory. Drawing them is checked in the app itself (Expo).
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../src')

// Every file @xeplr/ui-factory/native reaches, by its relative imports, and every package it names.
const seen = new Set()
const packages = new Set()
function visit(file) {
  if (seen.has(file)) return
  seen.add(file)
  // Comments name packages in examples; only code counts.
  const text = readFileSync(file, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
  for (const m of text.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1] || m[2]
    if (!spec.startsWith('.')) { packages.add(spec); continue }
    const base = resolve(dirname(file), spec)
    const hit = [base, base + '.js', base + '.jsx'].find((c) => existsSync(c) && !c.endsWith('/'))
    if (hit) visit(hit)
  }
}
visit(resolve(src, 'native/index.js'))
const files = [...seen].map((f) => f.slice(src.length + 1))

console.log('what the phone\'s views bring with them')
check('nothing from the web\'s designs', !files.some((f) => f.startsWith('designs/')), files.filter((f) => f.startsWith('designs/')).join(', '))
check('no stylesheet', !files.some((f) => f.endsWith('.css')))
check('the web controller and model, shared — not copied', files.includes('useFactoryScreen.js') && files.includes('buttons.js') && files.includes('feed.js'))
const web = ['react-dom', '@xeplr/ui-table', '@xeplr/ui-canvas', '@tanstack/react-table']
check('no browser-only package', !web.some((p) => packages.has(p) || [...packages].some((x) => x.startsWith(p + '/'))), [...packages].join(', '))
check('react-native and the URL helper are the only other packages, with @xeplr/rules',
  [...packages].every((p) => ['react', 'react-native', '@xeplr/rules', '@xeplr/ui-utils/src/url/useUrlState.js'].includes(p)), [...packages].join(', '))

console.log('the stand-in for react-router')
{
  const noRouter = await import('../src/native/noRouter.js')
  check('says it is never in a router', noRouter.useInRouterContext() === false)
  let threw = false
  try { noRouter.useSearchParams() } catch (e) { threw = /No router/.test(e.message) }
  check('and refuses to be asked for search params', threw)
  const pkg = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8'))
  check('both entries are in the package\'s exports', pkg.exports['./native'] === './src/native/index.js' && pkg.exports['./native/noRouter'] === './src/native/noRouter.js')
  check('react-native is an optional peer — web apps need not install it', pkg.peerDependenciesMeta && pkg.peerDependenciesMeta['react-native'] && pkg.peerDependenciesMeta['react-native'].optional === true)
}

console.log('the controller in an app without a browser')
{
  const ctrl = readFileSync(resolve(src, 'useFactoryScreen.js'), 'utf8')
  check('window.confirm only when there is one', /typeof window\.confirm !== 'function'/.test(ctrl))
  check('window.alert only when there is one', /typeof window\.alert === 'function'/.test(ctrl))
  check('beforeunload only when the window can listen', /typeof window\.addEventListener !== 'function'/.test(ctrl))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
