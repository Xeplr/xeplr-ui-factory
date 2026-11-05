// A dashboard on a function-fed list — a date range and KPI cards — and a
// button that asks for values (a parcel's size before Packed): what a screen
// may say, how a range becomes days, and what a press checks and sends.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import {
  validateDocument, createScreen, addControl, setNodeProperty,
  askFields, askFieldStart, askFieldValues, buttonInput, paramProblems
} from '../src/model.js'
import { resolveRange, customRange, isDay, rangePresets, DATE_PRESET_VALUES } from '../src/listRange.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`).join('\n')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function board(props) {
  const added = addControl(createScreen({ id: 'orders_board', name: 'Orders' }), 'list')
  let doc = added.document
  Object.entries({ rowsFrom: 'orderList', actions: [], ...props }).forEach(([k, v]) => { doc = setNodeProperty(doc, added.node.id, 'props.' + k, v) })
  return doc
}

console.log('a range, as days')
{
  const today = '2026-11-05'
  check('last 30 days: today and the 29 before', same(resolveRange('last30', today), { from: '2026-10-07', to: today, preset: 'last30' }))
  check('last 7 days', resolveRange('last7', today).from === '2026-10-30')
  check('today and yesterday', resolveRange('today', today).from === today && resolveRange('yesterday', today).to === '2026-11-04')
  check('this month: from the 1st', same(resolveRange('thisMonth', today), { from: '2026-11-01', to: today, preset: 'thisMonth' }))
  check('last month: the whole of it', same(resolveRange('lastMonth', today), { from: '2026-10-01', to: '2026-10-31', preset: 'lastMonth' }))
  check('…across a year', same(resolveRange('lastMonth', '2027-01-15'), { from: '2026-12-01', to: '2026-12-31', preset: 'lastMonth' }))
  check('all time: no days', same(resolveRange('all', today), { from: '', to: '', preset: 'all' }))
  check('two days typed', same(resolveRange(customRange('2026-10-01', '2026-10-15'), today), { from: '2026-10-01', to: '2026-10-15', preset: null }))
  check('…one end open', same(resolveRange('2026-10-01..', today), { from: '2026-10-01', to: '', preset: null }))
  check('backwards, or not a day: the list\'s own range instead', resolveRange('2026-10-15..2026-10-01', today, 'last7').preset === 'last7' && resolveRange('2026-02-30..', today, 'last7').preset === 'last7' && resolveRange('nonsense', today, 'last30').preset === 'last30')
  check('a real day', isDay('2026-02-28') && !isDay('2026-02-30') && !isDay('26-1-1'))
  check('the presets', DATE_PRESET_VALUES.join() === 'today,yesterday,last2,last3,last4,last5,last7,last30,thisMonth,lastMonth,all')
check('last 2 days is today and yesterday', JSON.stringify(resolveRange('last2', '2026-11-05')) === JSON.stringify({ from: '2026-11-04', to: '2026-11-05', preset: 'last2' }))
check('last 5 days', resolveRange('last5', '2026-11-05').from === '2026-11-01')
check('a list offers its own presets, in its order', rangePresets({ presets: ['last3', 'today'] }).map((p) => p.value).join() === 'last3,today')
check('none chosen: all of them', rangePresets({}).length === DATE_PRESET_VALUES.length && rangePresets(undefined).length === DATE_PRESET_VALUES.length)
check('a preset the list does not offer (an old link) opens its default', resolveRange('last30', '2026-11-05', 'last7', ['today', 'last7']).preset === 'last7')
check('...and two days typed are still kept', resolveRange('2026-10-01..2026-10-31', '2026-11-05', 'last7', ['today', 'last7']).from === '2026-10-01')
}

console.log('\nwhat a screen may say')
{
  const kpis = [{ key: 'ordered', label: 'Not started', tone: 'warning' }, { key: 'open', label: 'Open' }, { key: 'delivered', label: 'Delivered', tone: 'success' }, { key: 'all', label: 'Total' }]
  check('KPI cards and a range: fine', errs(board({ kpis, dateRange: { label: 'Placed', default: 'last30' } })) === '')
  check('a KPI key twice is refused', /appears twice/.test(errs(board({ kpis: [kpis[0], kpis[0]] }))))
  check('an unknown tone is refused', /tone: must be one of/.test(errs(board({ kpis: [{ key: 'a', label: 'A', tone: 'pink' }] }))))
  check('an unknown default range is refused, naming the ones there are', /default: must be one of: today,/.test(errs(board({ dateRange: { default: 'fortnight' } }))))
  check('a key a range does not use is refused', /remove: field/.test(errs(board({ dateRange: { field: 'placedAt' } }))))
  check('presets the picker offers: fine', errs(board({ dateRange: { default: 'last7', presets: ['today', 'yesterday', 'last2', 'last7'] } })) === '')
  check('an unknown preset is refused', /unknown: fortnight/.test(errs(board({ dateRange: { presets: ['today', 'fortnight'] } }))))
  check('an empty list of presets is refused', /presets/.test(errs(board({ dateRange: { presets: [] } }))))
  check('a default the picker does not offer is refused', /not one of the presets/.test(errs(board({ dateRange: { default: 'last30', presets: ['today', 'last7'] } }))))
  const plain = addControl(createScreen({ id: 'staff', name: 'Staff', source: 'staff' }), 'list')
  check('a list of a table\'s records has no function to count: refused', /KPI cards needs "rowsFrom"/.test(errs(setNodeProperty(plain.document, plain.node.id, 'props.kpis', kpis))))
}

console.log('\na button that asks for values')
{
  const SIZE = [
    { name: 'lengthIn', label: 'Length', type: 'number', unit: 'in', required: true, min: 0.1, fill: 'parcelLengthIn' },
    { name: 'weightKg', label: 'Weight', type: 'number', unit: 'kg', required: true, min: 0.01, max: 100, fill: 'parcelWeightKg' },
    { name: 'ref', label: 'Courier ref', type: 'text' }
  ]
  const packed = { id: 'packed', label: 'Packed', action: 'setOrderStatus', params: { status: 'packed' }, ask: { title: 'Packed', fields: SIZE } }
  const panel = (buttons) => { const a = addControl(createScreen({ id: 'order_actions', name: 'Order actions', source: 'orders' }), 'buttons'); return setNodeProperty(a.document, a.node.id, 'props.buttons', buttons) }
  check('a screen saying so is valid', errs(panel([packed])) === '', errs(panel([packed])))
  check('asking for one of the button\'s own parameters is refused', /already one of the button's parameters/.test(errs(panel([{ ...packed, ask: { fields: [{ name: 'status', label: 'Status', type: 'text' }] } }]))))
  check('asking for "note" is refused: that is ask.note', /use ask.note or ask.file/.test(errs(panel([{ ...packed, ask: { fields: [{ name: 'note', label: 'N', type: 'text' }] } }]))))
  check('an unknown type is refused', /type: must be one of: number, text/.test(errs(panel([{ ...packed, ask: { fields: [{ name: 'x', label: 'X', type: 'date' }] } }]))))
  check('min on a text field is refused', /is for a number field/.test(errs(panel([{ ...packed, ask: { fields: [{ name: 'x', label: 'X', type: 'text', min: 1 } ] } }]))))
  check('the same name twice is refused', /is asked twice/.test(errs(panel([{ ...packed, ask: { fields: [SIZE[0], SIZE[0]] } }]))))

  check('askFields reads them', askFields(packed).length === 3 && askFields({ id: 'x' }).length === 0)
  check('a field starts from the record', askFieldStart(SIZE[0], { parcelLengthIn: 12 }) === '12' && askFieldStart(SIZE[0], {}) === '')
  const ok = askFieldValues(packed, { lengthIn: '12.5', weightKg: 1.2, ref: '  AWB9 ', status: 'shipped' })
  check('typed text becomes numbers; text is trimmed', same(ok, { values: { lengthIn: 12.5, weightKg: 1.2, ref: 'AWB9' }, errors: [] }))
  check('…and anything not asked for is dropped', ok.values.status === undefined)
  const bad = askFieldValues(packed, { lengthIn: 'abc', weightKg: '500' })
  check('not a number, over max, and a missing required one: each said', same(bad.errors.map((e) => e.field), ['lengthIn', 'weightKg']) && /must be a number/.test(bad.errors[0].message) && /at most 100/.test(bad.errors[1].message))
  check('required and empty', askFieldValues(packed, { lengthIn: '', weightKg: '1' }).errors[0].message === 'Length is required')
  check('below min', /at least 0.1/.test(askFieldValues(packed, { lengthIn: '0', weightKg: '1' }).errors[0].message))
  check('the press sends them, and the screen\'s parameters always win', same(buttonInput(packed, null, null, { lengthIn: 3, status: 'cancelled' }), { lengthIn: 3, status: 'packed' }))

  const schema = [{ name: 'status', type: 'string', required: true }, { name: 'lengthIn', type: 'number' }, { name: 'weightKg', type: 'number', required: true }, { name: 'ref', type: 'string' }]
  check('a function that takes them fits — a required one is the person\'s to give', paramProblems(packed, schema).length === 0, paramProblems(packed, schema).join())
  check('one it does not take is named', paramProblems(packed, schema.slice(0, 3)).some((p) => /asks for "ref", but takes no "ref"/.test(p)))
  check('a number asked for text is named', paramProblems(packed, [...schema.slice(0, 3), { name: 'ref', type: 'number' }]).some((p) => /as text, but it takes number/.test(p)))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
