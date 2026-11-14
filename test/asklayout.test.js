// A button's popup laid out as a table: `ask.wide`, `ask.columns` and a field's
// `newRow` — what a screen may say.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { validateDocument, createScreen, addControl, setNodeProperty, askFieldValues } from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)

const FIELDS = [
  { name: 'shippingCost', label: 'Shipping', type: 'number', unit: '₹' },
  { name: 'boxCost', label: 'Box', type: 'number', unit: '₹' },
  { name: 'other1Name', label: 'Other 1 — what', type: 'text', newRow: true },
  { name: 'other1Cost', label: 'Other 1 — amount', type: 'number', unit: '₹' }
]
const costs = (ask) => ({ id: 'costs', label: 'Order costs', action: 'setOrderCosts', ask: Object.assign({ title: 'Order costs', fields: FIELDS }, ask) })
function screen(button) {
  const doc = createScreen({ id: 'order_actions', name: 'Order', source: 'orders' })
  const added = addControl(doc, 'buttons')
  return setNodeProperty(added.document, added.node.id, 'props.buttons', [button])
}

console.log('what a screen may say')
{
  check('wide, two columns and a new row: valid', errs(screen(costs({ wide: true, columns: 2 }))).length === 0, errs(screen(costs({ wide: true, columns: 2 }))).join('; '))
  check('wide not true / false: refused', errs(screen(costs({ wide: 'yes' }))).some((e) => /ask\.wide: must be true or false/.test(e)))
  check('columns 0, 5 or 1.5: refused', [0, 5, 1.5].every((n) => errs(screen(costs({ columns: n }))).some((e) => /ask\.columns: must be how many fields to a line, 1 to 4/.test(e))))
  check('a layout with no fields to lay out: refused', errs(screen({ id: 'x', label: 'X', action: 'f', ask: { title: 'X', wide: true } })).some((e) => /lay out the fields — this asks for none/.test(e)))
  const badRow = costs({ fields: [Object.assign({}, FIELDS[0], { newRow: 'yes' })] })
  check('newRow not true / false: refused', errs(screen(badRow)).some((e) => /newRow: must be true or false/.test(e)))
}

console.log('a press is the same, however it is laid out')
{
  const out = askFieldValues(costs({ wide: true, columns: 2 }), { shippingCost: '80', other1Name: ' Bubble wrap ', other1Cost: 25 })
  check('values typed and checked as before', JSON.stringify(out) === JSON.stringify({ values: { shippingCost: 80, other1Name: 'Bubble wrap', other1Cost: 25 }, errors: [] }), JSON.stringify(out))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
