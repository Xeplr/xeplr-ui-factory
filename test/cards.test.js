// A function-fed list as cards (layout "cards") and an "items" column — what a
// screen may say about them. How they are drawn is checked in a real browser
// (test/phone.check.js, the Packing page of the dev app).
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { readFileSync } from 'node:fs'
import { validateDocument, createScreen, addControl, setNodeProperty, LIST_LAYOUTS, COLUMN_DISPLAYS, BADGE_TONES, COLUMN_ICONS, journeyOf, menuItemsFor } from '../src/model.js'

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

console.log('\na cell\'s tone')
check('a column may take its tone from the row', errs(list({ columns: [{ field: 'shippedAt', label: 'Shipped', text: 'shippedText', toneFrom: 'shippedTone' }] })) === '')
check('toneFrom must be a field name', /toneFrom: must be a field of the row/.test(errs(list({ columns: [{ field: 'shippedAt', label: 'Shipped', toneFrom: 'red tone' }] }))))

console.log('\nicons, chips, tones, bold')
const STAGES = [
  { field: 'day', label: 'Placed on', icon: 'calendar' },
  { field: 'placed', label: 'Orders', icon: 'file', bold: true },
  { field: 'packed', label: 'Packed', icon: 'box', display: 'chip', tone: 'info' },
  { field: 'rto', label: 'RTO', icon: 'return', display: 'chip', tone: 'danger', toneFrom: 'rtoTone' }
]
check('a column may have an icon, a tone, be bold, be drawn as chips', errs(list({ columns: STAGES })) === '', errs(list({ columns: STAGES })))
check('"chip" is a display, info and violet are tones', COLUMN_DISPLAYS.includes('chip') && BADGE_TONES.includes('info') && BADGE_TONES.includes('violet'))
check('an unknown icon is refused, naming the ones there are', new RegExp('icon: must be one of: ' + COLUMN_ICONS.join(', ')).test(errs(list({ columns: [{ field: 'a', label: 'A', icon: 'rocket' }] }))))
check('an unknown tone is refused', /tone: must be one of/.test(errs(list({ columns: [{ field: 'a', label: 'A', tone: 'pink' }] }))))
check('bold is true or false', /bold: must be true or false/.test(errs(list({ columns: [{ field: 'a', label: 'A', bold: 'yes' }] }))))

console.log('\na journey (steps), a chip\'s icon, the row menu')
const sameJ = (a, b) => JSON.stringify(a) === JSON.stringify(b)
check('"steps" is a display', COLUMN_DISPLAYS.includes('steps'))
check('steps: done is success unless it says (late: danger), not done is muted; no label, no step', sameJ(journeyOf([{ label: 'Placed', at: '13 Nov', done: true }, { label: 'Shipped', at: '15 Nov', done: true, tone: 'danger' }, { label: 'Delivered', done: false }, { at: 'x' }, null]),
  [{ label: 'Placed', at: '13 Nov', done: true, tone: 'success' }, { label: 'Shipped', at: '15 Nov', done: true, tone: 'danger' }, { label: 'Delivered', at: '', done: false, tone: 'muted' }]))
check('steps: not a list, none', sameJ(journeyOf('x'), []))
const STATUS = [{ field: 'statusLabel', label: 'Status', display: 'chip', toneFrom: 'statusTone', iconFrom: 'statusIcon' }, { field: 'progress', label: 'Progress', display: 'steps', sortable: false }]
check('a chip may take its icon from the row; a steps column', errs(list({ columns: STATUS })) === '', errs(list({ columns: STATUS })))
check('iconFrom is for chips', /iconFrom: is the icon in a chip/.test(errs(list({ columns: [{ field: 'a', label: 'A', iconFrom: 'aIcon' }] }))))
const MENU = [{ label: 'Open order', action: 'open' }, { label: 'Open in Shopify', action: 'link', field: 'shopifyUrl' }, { label: 'Copy order number', action: 'copy', field: 'orderLabel' }]
check('a row menu: open (rows that open), link and copy a row field', errs(list({ rowOpen: true, editScreen: 'order_actions', rowMenu: MENU })) === '', errs(list({ rowOpen: true, editScreen: 'order_actions', rowMenu: MENU })))
check('open needs rows that open', /"open" needs rows that open/.test(errs(list({ rowMenu: [{ label: 'Open', action: 'open' }] }))))
check('link needs its field; an unknown action is refused', /field: must be a field of the row — the address it opens/.test(errs(list({ rowMenu: [{ label: 'x', action: 'link' }] }))) && /action: must be one of: open, link, copy/.test(errs(list({ rowMenu: [{ label: 'x', action: 'delete' }] }))))
check('a row is offered only what it has', sameJ(menuItemsFor({ orderLabel: '#GA1', shopifyUrl: '' }, MENU, true).map((m) => m.label), ['Open order', 'Copy order number'])
  && sameJ(menuItemsFor({ orderLabel: '#GA1', shopifyUrl: 'https://x' }, MENU, false).map((m) => m.label), ['Open in Shopify', 'Copy order number']))

console.log('\nfaded rows')
check('dim names a field of the row', errs(list({ dim: 'isCancelled' })) === '')
check('dim that is not a field name is refused', /dim: must be a field of the row/.test(errs(list({ dim: 'is cancelled' }))))

console.log('\nthe example screens')
for (const file of ['packing-board', 'packing-actions']) {
  const doc = JSON.parse(readFileSync(new URL(`../examples/${file}.screen.json`, import.meta.url)))
  check(`${file} is valid`, errs(doc) === '', errs(doc))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
