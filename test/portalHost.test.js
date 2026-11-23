// WHERE POPUPS GO (portalHost.js): inside the app's theme wrapper, so a dark
// app's ask dialog, hover box and row menu are dark too — <body> otherwise.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { portalHost } from '../src/portalHost.js'

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }

check('no document (server, tests): nothing to portal into', portalHost() === null)

const body = { tag: 'body' }
const wrapper = { tag: 'div', className: 'xeplr-theme-dark' }
globalThis.document = { body, querySelector: (sel) => (sel === '[class*="xeplr-theme-"]' ? wrapper : null) }
check('a themed app: into the theme wrapper, where the --xeplr-* colours are', portalHost() === wrapper)

globalThis.document = { body, querySelector: () => null }
check('no theme wrapper: into <body>, as before', portalHost() === body)
delete globalThis.document

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
