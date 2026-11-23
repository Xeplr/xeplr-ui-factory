// MENU TILES — a Home page's way to every place in the app (tiles.js): what a
// screen may say, and which tiles the host's menu makes.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { validateDocument, createScreen, addControl, setNodeProperty, tilesOf, MAX_TILES, CONTROLS, nodeFunctions } from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function home(props) {
  let doc = createScreen({ id: 'home_board', name: 'Home' })
  const added = addControl(doc, 'tiles')
  doc = added.document
  Object.entries(props || {}).forEach(([k, v]) => { doc = setNodeProperty(doc, added.node.id, 'props.' + k, v) })
  return doc
}

console.log('what a screen may say')
{
  check('a tiles control is in the palette', CONTROLS.tiles && CONTROLS.tiles.input === false)
  check('tiles with a title and keys to leave out: a screen', errs(home({ title: 'Go to', exclude: ['Home'] })).length === 0, errs(home({ title: 'Go to', exclude: ['Home'] })).join('; '))
  check('exclude must be menu keys', errs(home({ exclude: 'Home' })).some((e) => /exclude: must be a list of menu keys/.test(e)))
  check('a title must be text', errs(home({ title: 3 })).some((e) => /title: must be a string/.test(e)))
  check('it names no function — the menu is the app\'s', nodeFunctions(home({ title: 'Go to' })).length === 0)
}

console.log('the tiles the menu makes')
{
  const menu = [
    { key: 'Home', label: 'Home', path: '/home' },
    { key: 'Orders', label: 'Orders', path: '/orders', icon: '🛒' },
    { key: 'form:movement', label: 'Movements', path: '/forms/movement', description: 'Out of the warehouse and back' },
    { key: 'form:rack' },
    { key: 'Orders', label: 'Orders again' },
    null, { label: 'no key' }
  ]
  const tiles = tilesOf(menu, ['Home'])
  check('in the menu\'s order, without the ones left out', same(tiles.map((t) => t.key), ['Orders', 'form:movement', 'form:rack']))
  check('each key once', tiles.filter((t) => t.key === 'Orders').length === 1)
  check('a label, else the key', tiles[2].label === 'form:rack')
  check('icon, path and description kept', tiles[0].icon === '🛒' && tiles[1].path === '/forms/movement' && tiles[1].description === 'Out of the warehouse and back')
  check('no menu: no tiles', same(tilesOf(undefined, ['Home']), []))
  check('at most MAX_TILES', tilesOf(Array.from({ length: 80 }, (_, i) => ({ key: 'k' + i })), []).length === MAX_TILES)
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
