// A list's dropdown (props.pick) — the year a holiday list shows: what a
// screen may say, and which option is shown from what the function answered.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { validateDocument, createScreen, addControl, setNodeProperty } from '../src/model.js'
import { pickOf } from '../src/listRows.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`).join('\n')

function list(props) {
  const added = addControl(createScreen({ id: 'holidays', name: 'Holidays' }), 'list')
  let doc = added.document
  Object.entries({ actions: [], ...props }).forEach(([k, v]) => { doc = setNodeProperty(doc, added.node.id, 'props.' + k, v) })
  return doc
}

console.log('what a screen may say')
check('a dropdown on a function-fed list', !errs(list({ rowsFrom: 'holidayList', pick: { label: 'Year' } })), errs(list({ rowsFrom: 'holidayList', pick: { label: 'Year' } })))
check('…not on a table\'s records', /pick.*needs "rowsFrom"/.test(errs(list({ pick: { label: 'Year' } }))))
check('…only a label', /only "label"/.test(errs(list({ rowsFrom: 'holidayList', pick: { label: 'Year', options: [] } }))))
check('…a label is text', /pick\.label/.test(errs(list({ rowsFrom: 'holidayList', pick: { label: 3 } }))))

console.log('which option shows')
const p = { pick: { label: 'Year' } }
const out = { pick: { options: [{ key: '2026', label: '2026' }, { key: 2027 }, { key: '' }, null], value: '2026' } }
const a = pickOf(p, out, {})
check('the function\'s options; blanks dropped; a key is text; no label → the key', JSON.stringify(a.options) === JSON.stringify([{ key: '2026', label: '2026' }, { key: '2027', label: '2027' }]))
check('nothing asked: the function\'s value', a.value === '2026')
check('asked for one it offers: that one', pickOf(p, out, { pick: '2027' }).value === '2027')
check('asked for one it does not: the function\'s value', pickOf(p, out, { pick: '1999' }).value === '2026')
check('no value from the function: the first', pickOf(p, { pick: { options: [{ key: 'a' }, { key: 'b' }] } }, {}).value === 'a')
check('the list has no pick: nothing', pickOf({}, out, {}).options.length === 0)
check('the function gave none: nothing', pickOf(p, { rows: [] }, {}).options.length === 0)

const failed = results.filter(([, ok]) => !ok)
console.log(failed.length ? `\n${failed.length} FAILED` : `\nall ${results.length} passed`)
process.exit(failed.length ? 1 : 0)
