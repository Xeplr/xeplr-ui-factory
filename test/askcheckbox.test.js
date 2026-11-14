// A CHECKBOX in a button's popup — a tick, true or false — what a screen may
// say, what the dialog starts from and what a press sends.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { validateDocument, createScreen, addControl, setNodeProperty, askFieldValues, askFieldStart, paramProblems, ASK_FIELD_TYPES } from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const TICK = { name: 'localDelivery', label: 'Local delivery', type: 'checkbox', fill: 'localDelivery' }
const packed = (field) => ({ id: 'packed', label: 'Packed', action: 'setOrderStatus', params: { status: 'packed' },
  ask: { title: 'Packed', fields: [field || TICK, { name: 'lengthCm', label: 'Length', type: 'number', unit: 'cm' }] } })
function screen(button) {
  const doc = createScreen({ id: 'order_actions', name: 'Order', source: 'orders' })
  const added = addControl(doc, 'buttons')
  return setNodeProperty(added.document, added.node.id, 'props.buttons', [button])
}

console.log('what a screen may say')
{
  check('a kind of ask field', ASK_FIELD_TYPES.includes('checkbox'))
  check('a checkbox: valid', errs(screen(packed())).length === 0, errs(screen(packed())).join('; '))
  check('min, unit or options on a checkbox: refused', errs(screen(packed(Object.assign({}, TICK, { min: 1, unit: 'x', options: ['a'] })))).filter((e) => /is not for a checkbox/.test(e)).length === 3)
}

console.log('the start, and a press')
{
  check('starts from the record', askFieldStart(TICK, { localDelivery: true }) === true && askFieldStart(TICK, { localDelivery: false }) === false && askFieldStart(TICK, {}) === false)
  check('ticked: true', same(askFieldValues(packed(), { localDelivery: true, lengthCm: 2 }).values, { localDelivery: true, lengthCm: 2 }))
  check('not ticked, or not sent: false — always sent', same(askFieldValues(packed(), {}).values, { localDelivery: false }))
  check('"on" / "true" from a form: true', askFieldValues(packed(), { localDelivery: 'on' }).values.localDelivery === true)
  const must = packed(Object.assign({}, TICK, { required: true }))
  check('required and not ticked: refused', /must be ticked/.test((askFieldValues(must, {}).errors[0] || {}).message))
}

console.log('what publishing checks against the function')
{
  check('a function taking a boolean: fine', paramProblems(packed(), [{ name: 'status', type: 'string' }, { name: 'localDelivery', type: 'boolean' }, { name: 'lengthCm', type: 'number' }]).length === 0)
  check('a function taking text: said', paramProblems(packed(), [{ name: 'status', type: 'string' }, { name: 'localDelivery', type: 'string' }, { name: 'lengthCm', type: 'number' }]).some((p) => /as a tick \(true or false\), but it takes string/.test(p)))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
