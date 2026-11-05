// A function-fed list as cards (layout "cards") and an "items" column — what a
// screen may say about them. How they are drawn is checked in a real browser
// (test/phone.check.js, the Packing page of the dev app).
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { readFileSync } from 'node:fs'
import { validateDocument, createScreen, addControl, setNodeProperty, LIST_LAYOUTS, COLUMN_DISPLAYS } from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`).join('\n')

function list(props, fed = true) {
  const added = addControl(createScreen({ id: 'packing_board', name: 'Packing', source: fed ? undefined : 'orders' }), 'list')
  let doc = added.document
  Object.entries({ ...(fed ? { rowsFrom: 'packingList' } : {}), actions: [], ...props }).forEach(([k, v]) => { doc = setNodeProperty(doc, added.node.id, 'props.' + k, v) })
  return doc
}

const ITEMS = [{ field: 'orderNumber', label: 'Order', text: 'orderLabel' }, { field: 'items', label: 'Items', display: 'items', sortable: false }]

console.log('layouts')
check('a table or cards', LIST_LAYOUTS.join() === 'table,cards')
check('"items" is a column display', COLUMN_DISPLAYS.includes('items'))
check('cards with an items column: fine', errs(list({ layout: 'cards', columns: ITEMS })) === '', errs(list({ layout: 'cards', columns: ITEMS })))
check('a table may say so too', errs(list({ layout: 'table' })) === '')
check('an unknown layout is refused, naming the ones there are', /layout: must be one of: table, cards/.test(errs(list({ layout: 'grid' }))), errs(list({ layout: 'grid' })))
check('a table\'s records have no layout to choose: refused', /a layout needs "rowsFrom"/.test(errs(list({ layout: 'cards' }, false))), errs(list({ layout: 'cards' }, false)))
check('"more" is for pictures, not items', /only means something on an "images" column/.test(errs(list({ columns: [{ field: 'items', display: 'items', more: 'moreItems' }] }))))

console.log('\nthe example screens')
for (const file of ['packing-board', 'packing-actions']) {
  const doc = JSON.parse(readFileSync(new URL(`../examples/${file}.screen.json`, import.meta.url)))
  check(`${file} is valid`, errs(doc) === '', errs(doc))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
