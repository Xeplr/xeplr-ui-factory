// A column's "action" in a list of a table — what a screen may say.
import { validateDocument, createScreen, addControl, setNodeProperty } from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
function list(columns) {
  const doc = createScreen({ id: 'shipping_update_list', name: 'Shipping updates', source: 'shipping_updates' })
  const added = addControl(doc, 'list')
  return setNodeProperty(added.document, added.node.id, 'props.columns', columns)
}
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)

check('a column naming a row action: valid', errs(list([{ field: 'customOrderId', label: 'Order number', action: 'open-order' }, { field: 'status', label: 'Status' }])).length === 0,
  errs(list([{ field: 'customOrderId', label: 'Order number', action: 'open-order' }])).join('; '))
check('"edit": valid', errs(list([{ field: 'customOrderId', label: 'Order', action: 'edit' }])).length === 0)
check('a blank or odd action: refused', errs(list([{ field: 'a', label: 'A', action: '' }])).some((e) => /action: must be "edit" or the id/.test(e)) &&
  errs(list([{ field: 'a', label: 'A', action: 'open order!' }])).some((e) => /action: must be/.test(e)))
check('anything else on a column: still refused, saying action is allowed', errs(list([{ field: 'a', label: 'A', bold: true }])).some((e) => /only "field", "label" and "action" are used — remove: bold/.test(e)))

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
