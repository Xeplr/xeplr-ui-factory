// ROWS in a button's popup — the same few fields once per thing, as many as
// there are (the packets an order went out in): what a screen may say, what
// the dialog starts with, what a press sends.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { validateDocument, createScreen, addControl, setNodeProperty, askFieldValues, askFieldStart, paramProblems, nodeFunctions, startRowsOf, emptyRow, ASK_FIELD_TYPES, MAX_ASK_ROWS } from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const SIZE = [
  { name: 'lengthCm', label: 'Length', type: 'number', unit: 'cm', required: true, min: 0.1 },
  { name: 'weightKg', label: 'Weight', type: 'number', unit: 'kg', required: true, min: 0.01 },
  { name: 'note', label: 'Note', type: 'text' }
]
const PACKETS = { name: 'parcels', label: 'Packets', type: 'rows', rowLabel: 'Packet', addLabel: 'Add packet', required: true, min: 1, max: 5, startFrom: 'orderParcels', fields: SIZE }
const packed = (field) => ({ id: 'packed', label: 'Packed', action: 'setOrderStatus', params: { status: 'packed' }, ask: { title: 'Packed', fields: [field || PACKETS] } })
function screen(button) {
  const doc = createScreen({ id: 'order_actions', name: 'Order', source: 'orders' })
  const added = addControl(doc, 'buttons')
  return setNodeProperty(added.document, added.node.id, 'props.buttons', [button])
}

console.log('what a screen may say')
{
  check('a kind of ask field', ASK_FIELD_TYPES.includes('rows'))
  check('packets with a size each: valid', errs(screen(packed())).length === 0, errs(screen(packed())).join('; '))
  check('its startFrom is listed under "buttonOptions", saying where', nodeFunctions(screen(packed())).some((f) => f.event === 'buttonOptions' && f.name === 'orderParcels' && f.at.endsWith('.ask.fields[0].startFrom')))
  const none = errs(screen(packed({ ...PACKETS, fields: [] })))
  check('rows with no fields: refused', none.some((e) => e.includes('.fields') && e.includes('must list')), none.join('; '))
  const odd = errs(screen(packed({ ...PACKETS, fields: [{ name: 'when', label: 'When', type: 'date' }] })))
  check('a date (or anything but number and text) in a row: refused', odd.some((e) => e.includes('fields[0].type')), odd.join('; '))
  const bad = errs(screen(packed({ ...PACKETS, min: 6, max: 5, unit: 'cm', startFrom: 'not a name' })))
  check('min over max, a unit on the rows, a bad startFrom: each refused', ['.min', '.unit', '.startFrom'].every((k) => bad.some((e) => e.includes(k))), bad.join('; '))
  check('rowLabel on a number field: refused', errs(screen(packed({ name: 'x', label: 'X', type: 'number', rowLabel: 'P' }))).some((e) => e.includes('is for a rows field')))
}

console.log('the start')
{
  check('min empty rows (at least one), each field blank', same(askFieldStart(PACKETS), [{ lengthCm: '', weightKg: '', note: '' }]) && askFieldStart({ ...PACKETS, min: 2 }).length === 2)
  check('an empty row', same(emptyRow(PACKETS), { lengthCm: '', weightKg: '', note: '' }))
  check('what was given before, as text; other keys dropped', same(startRowsOf(PACKETS, [{ lengthCm: 30, weightKg: 1.2, x: 1 }, 'junk', { lengthCm: 20 }]), [{ lengthCm: '30', weightKg: '1.2', note: '' }, { lengthCm: '20', weightKg: '', note: '' }]))
  check('nothing given before: the empty start', same(startRowsOf(PACKETS, []), askFieldStart(PACKETS)))
}

console.log('what a press sends')
{
  const ok = askFieldValues(packed(), { parcels: [{ lengthCm: '30', weightKg: '1.2', note: ' fragile ' }, { lengthCm: '', weightKg: '', note: '' }, { lengthCm: '20', weightKg: '0.6' }] })
  check('typed rows, blank ones dropped, numbers as numbers', ok.errors.length === 0 && same(ok.values.parcels, [{ lengthCm: 30, weightKg: 1.2, note: 'fragile' }, { lengthCm: 20, weightKg: 0.6 }]), JSON.stringify(ok))
  const missing = askFieldValues(packed(), { parcels: [{ lengthCm: '30' }, { lengthCm: 'x', weightKg: '1' }] })
  check('a problem names its row', same(missing.errors.map((e) => e.message), ['Packet 1: Weight is required', 'Packet 2: Length must be a number']) && missing.values.parcels === undefined, JSON.stringify(missing.errors))
  check('none given: at least one packet', /give at least one packet/.test(askFieldValues(packed(), { parcels: [] }).errors[0].message))
  check('more than max: refused', /at most 5/.test(askFieldValues(packed(), { parcels: Array.from({ length: 6 }, () => ({ lengthCm: 1, weightKg: 1 })) }).errors[0].message))
  check('not a list: refused', /must be a list/.test(askFieldValues(packed(), { parcels: 'x' }).errors[0].message))
  check(`never more than ${MAX_ASK_ROWS}`, askFieldValues(packed({ ...PACKETS, max: undefined }), { parcels: Array.from({ length: MAX_ASK_ROWS + 1 }, () => ({ lengthCm: 1, weightKg: 1 })) }).errors.length === 1)
}

console.log('the function takes them')
{
  const takes = (type) => paramProblems(packed(), [{ name: 'status', type: 'string', options: [{ value: 'packed' }] }, { name: 'parcels', type }])
  check('a function taking parcels as an array: fine', takes('array').length === 0, takes('array').join('; '))
  check('as anything else: refused at publish', takes('string').some((p) => /as a list of rows/.test(p)), takes('string').join('; '))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
