// A CHOICE in a button's popup — one of a fixed list, from a dropdown (why an
// order came back) — what a screen may say, what publishing checks, what the
// dialog starts from and what a press may send.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import {
  validateDocument, createScreen, addControl, setNodeProperty,
  askFieldValues, askFieldStart, askChoiceOptions, paramProblems, ASK_FIELD_TYPES
} from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const TYPES = [{ value: 'not_accepted', label: 'Customer did not accept' }, { value: 'broken', label: 'Broken' }, 'other']
const RTO = (field) => ({
  id: 'rto', label: 'RTO', action: 'setOrderStatus', params: { status: 'rto' },
  ask: { title: 'RTO', fields: [field || { name: 'rtoType', label: 'RTO type', type: 'choice', required: true, options: TYPES, fill: 'rtoType' }] }
})
function screen(button) {
  const doc = createScreen({ id: 'order_actions', name: 'Order', source: 'orders' })
  const added = addControl(doc, 'buttons')
  return setNodeProperty(added.document, added.node.id, 'props.buttons', [button])
}
const field = RTO().ask.fields[0]

console.log('what a screen may say')
{
  check('a kind of ask field', ASK_FIELD_TYPES.includes('choice'))
  check('a choice with its options: valid', errs(screen(RTO())).length === 0, errs(screen(RTO())).join('; '))
  check('without options: refused', errs(screen(RTO({ name: 't', label: 'T', type: 'choice' }))).some((e) => /options: must list/.test(e)))
  check('an empty list: refused', errs(screen(RTO({ name: 't', label: 'T', type: 'choice', options: [] }))).some((e) => /options: must list/.test(e)))
  check('a blank or missing value: refused', errs(screen(RTO({ name: 't', label: 'T', type: 'choice', options: ['a', ' '] }))).some((e) => /options: each/.test(e)) &&
    errs(screen(RTO({ name: 't', label: 'T', type: 'choice', options: [{ label: 'No value' }] }))).some((e) => /options: each/.test(e)))
  check('a value twice: refused', errs(screen(RTO({ name: 't', label: 'T', type: 'choice', options: ['a', { value: 'a', label: 'A' }] }))).some((e) => /listed twice/.test(e)))
  check('min, max or unit on a choice: refused', errs(screen(RTO({ name: 't', label: 'T', type: 'choice', options: ['a'], min: 1, unit: 'kg' }))).filter((e) => /is not for a choice/.test(e)).length === 2)
  check('options on a text field: refused', errs(screen(RTO({ name: 't', label: 'T', type: 'text', options: ['a'] }))).some((e) => /options: is for a choice/.test(e)))
}

console.log('the options, the start, and a press')
{
  check('options as { value, label } or plain values', same(askChoiceOptions(field), [
    { value: 'not_accepted', label: 'Customer did not accept' }, { value: 'broken', label: 'Broken' }, { value: 'other', label: 'other' }]))
  check('starts from the record when it is still an option', askFieldStart(field, { rtoType: 'broken' }) === 'broken')
  check('…and empty when it is not, or there is none', askFieldStart(field, { rtoType: 'gone' }) === '' && askFieldStart(field, {}) === '')
  const ok = askFieldValues(RTO(), { rtoType: ' broken ' })
  check('an option: kept, trimmed, as a string', same(ok, { values: { rtoType: 'broken' }, errors: [] }), JSON.stringify(ok))
  const stray = askFieldValues(RTO(), { rtoType: 'lost' })
  check('a value not in the list: refused', stray.errors.length === 1 && /choose one of the list/.test(stray.errors[0].message) && !('rtoType' in stray.values))
  check('required and not chosen: refused', /is required/.test(askFieldValues(RTO(), {}).errors[0].message))
  const optional = RTO(Object.assign({}, field, { required: false }))
  check('optional and not chosen: nothing sent', same(askFieldValues(optional, { rtoType: '' }), { values: {}, errors: [] }))
}

console.log('what publishing checks against the function')
{
  const schema = [{ name: 'status', type: 'string', required: true }, { name: 'rtoType', type: 'string', options: ['not_accepted', 'broken', 'other'] }]
  check('options the function takes: fine', paramProblems(RTO(), schema).length === 0, paramProblems(RTO(), schema).join('; '))
  const more = RTO(Object.assign({}, field, { options: TYPES.concat(['lost']) }))
  check('an option it does not take: said, naming it', paramProblems(more, schema).some((p) => /offers "lost" for "rtoType"/.test(p)))
  check('a function that lists no options takes any', paramProblems(RTO(), [{ name: 'status', type: 'string' }, { name: 'rtoType', type: 'string' }]).length === 0)
  check('a function taking a number: said', paramProblems(RTO(), [{ name: 'status', type: 'string' }, { name: 'rtoType', type: 'number' }]).some((p) => /as text, but it takes number/.test(p)))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
