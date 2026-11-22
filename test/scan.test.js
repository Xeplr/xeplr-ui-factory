// SCANNING A CODE — an autocomplete with `scan` (the suggestion whose code was
// scanned is picked) and a checklist with `scan` (the entry whose codes hold
// it is ticked): what a screen may say, what a function's answer keeps, and
// what a code does.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import {
  validateDocument, createScreen, addControl, setNodeProperty, screenFromSpec,
  suggestionsOf, suggestionForCode, sameCode, checklistOptionsOf, tickByCode, chooseByCode, missMessage, MAX_OPTION_CODES, MAX_CODE
} from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function products(props) {
  let doc = createScreen({ id: 'movement_edit', name: 'Movement', source: 'movements' })
  const added = addControl(doc, 'autocomplete')
  doc = added.document
  Object.entries({ name: 'addProducts', label: 'Add products', suggestFrom: 'productSuggestions', multiple: true, quantity: true, ...props })
    .forEach(([k, v]) => { doc = setNodeProperty(doc, added.node.id, 'props.' + k, v) })
  return doc
}
function receive(field) {
  let doc = createScreen({ id: 'movement_actions', name: 'Movement', source: 'movements' })
  const added = addControl(doc, 'buttons')
  return setNodeProperty(added.document, added.node.id, 'props.buttons', [{
    id: 'receive', label: 'Receive', action: 'receiveMovementItems',
    ask: { title: 'Products back', fields: [{ name: 'back', label: 'Came back fine', type: 'checklist', optionsFrom: 'movementItemsOut', ...field }] }
  }])
}

console.log('a screen saying scan')
{
  check('an autocomplete with scan: true is a screen', errs(products({ scan: true })).length === 0, errs(products({ scan: true })).join('; '))
  check('scan must be true or false', errs(products({ scan: 'yes' })).some((e) => /props\.scan: must be true or false/.test(e)))
  check('a checklist with scan: true is a screen', errs(receive({ scan: true })).length === 0, errs(receive({ scan: true })).join('; '))
  check('a checklist\'s scan must be true or false', errs(receive({ scan: 1 })).some((e) => /scan: must be true or false/.test(e)))
  let doc = createScreen({ id: 'x', name: 'X', source: 'xs' })
  const b = addControl(doc, 'buttons')
  doc = setNodeProperty(b.document, b.node.id, 'props.buttons', [{ id: 'b', label: 'B', action: 'doIt', ask: { fields: [{ name: 'n', label: 'N', type: 'number', scan: true }] } }])
  check('scan on a number: refused, it is for a checklist', errs(doc).some((e) => /scan: is for a checklist/.test(e)))
  const spec = screenFromSpec({ name: 'Movement', source: 'movements', fields: [{ label: 'Add products', name: 'addProducts', type: 'autocomplete', suggestFrom: 'productSuggestions', multiple: true, scan: true }] })
  const node = spec.nodes.find((n) => n.props && n.props.name === 'addProducts')
  check('an entity spec carries scan to the field', node && node.props.scan === true)
  let threw = null
  try { screenFromSpec({ name: 'X', fields: [{ label: 'Name', scan: true }] }) } catch (e) { threw = e.message }
  check('scan on a plain text field in a spec: refused', /scan\/scanMiss only apply to an autocomplete/.test(threw || ''), threw)
}

console.log('a suggestion\'s code')
{
  const list = suggestionsOf([
    { value: 'Saguaro Splendor Vase', sub: 'SKU GAD456', code: ' 22292500 ' },
    { value: 'Altura Vista Vase', code: 32312084 },
    { value: 'No code', code: '  ' },
    { value: 'Long', code: 'x'.repeat(100) }
  ])
  check('kept, trimmed, as text', list[0].code === '22292500' && list[1].code === '32312084')
  check('a blank code: none', !('code' in list[2]))
  check('a long code: cut to MAX_CODE', list[3].code.length === MAX_CODE)
  check('the one with the code scanned', suggestionForCode(list, '32312084').value === 'Altura Vista Vase')
  check('case and spaces ignored', sameCode(' gad456 ', 'GAD456') && !sameCode('', ''))
  check('a code nothing has: null — never the only suggestion by default', suggestionForCode([{ value: 'A', code: '1' }], '2') === null)
  check('not a list: null', suggestionForCode(null, '1') === null)
}

console.log('a checklist entry\'s codes')
{
  const opts = checklistOptionsOf([
    { id: 'a', label: 'Saguaro Splendor Vase ×2', codes: ['22292500', 'GAD456', null, { x: 1 }, ' '] },
    { id: 'b', label: 'Bloom Vase', codes: 'GAD001' },
    { id: 'c', label: 'Many', codes: Array.from({ length: 20 }, (_, i) => 'C' + i) }
  ])
  check('codes kept as text, blanks and objects dropped', same(opts[0].codes, ['22292500', 'GAD456']))
  check('codes that are not a list: none', !('codes' in opts[1]))
  check('at most MAX_OPTION_CODES', opts[2].codes.length === MAX_OPTION_CODES)
  let out = tickByCode(opts, [], 'gad456')
  check('a code ticks its entry, saying so', same(out.ticked, ['a']) && out.option.id === 'a' && out.message === 'Ticked Saguaro Splendor Vase ×2')
  out = tickByCode(opts, ['a'], '22292500')
  check('again: ticked already, nothing changes', same(out.ticked, ['a']) && /ticked already/.test(out.message))
  out = tickByCode(opts, ['a'], '999')
  check('a code nothing has: said, nothing ticked', same(out.ticked, ['a']) && out.option === null && out.message === 'Nothing here has the code 999')
  out = tickByCode(opts, undefined, '  ')
  check('nothing scanned: nothing happens', same(out.ticked, []) && out.message === null)
}

console.log('a choice its function lists, by code — a rack by its label')
{
  const place = (field) => {
    let doc = createScreen({ id: 'movement_edit', name: 'Movement', source: 'movements' })
    const added = addControl(doc, 'buttons')
    return setNodeProperty(added.document, added.node.id, 'props.buttons', [{ id: 'place', label: 'Place in rack', action: 'placeMovementItems',
      ask: { fields: [{ name: 'rackId', label: 'Rack', type: 'choice', optionsFrom: 'rackOptions', ...field }] } }])
  }
  check('a fed choice with scan and scanMiss is a screen', errs(place({ scan: true, scanMiss: 'Not a rack: {code}' })).length === 0, errs(place({ scan: true, scanMiss: 'x' })).join('; '))
  let doc = createScreen({ id: 'x', name: 'X', source: 'xs' })
  const b = addControl(doc, 'buttons')
  doc = setNodeProperty(b.document, b.node.id, 'props.buttons', [{ id: 'b', label: 'B', action: 'doIt', ask: { fields: [{ name: 'c', label: 'C', type: 'choice', options: ['a'], scan: true }] } }])
  check('scan on a choice of fixed options: refused', errs(doc).some((e) => /scan: is for a checklist, or a choice its function lists/.test(e)))
  check('scanMiss without scan: refused', errs(place({ scanMiss: 'Not a rack' })).some((e) => /scanMiss: is for a field that scans/.test(e)))
  check('scanMiss on an autocomplete without scan: refused', errs(products({ scanMiss: 'x' })).some((e) => /props\.scanMiss: is for a field that scans/.test(e)))
  check('scanMiss on an autocomplete with scan: a screen', errs(products({ scan: true, scanMiss: 'Not a product: {code}' })).length === 0)
  const racks = checklistOptionsOf([{ id: 'r1', label: 'Shelf A1', codes: ['RK-7K3QF9'] }, { id: 'r2', label: 'Shelf B2', codes: ['RK-22AB4C'] }])
  let out = chooseByCode(racks, 'rk-22ab4c')
  check('the rack with that code is chosen', out.value === 'r2' && out.message === 'Chose Shelf B2')
  out = chooseByCode(racks, '22292500', 'Not a rack — {code} is not on any rack\'s label')
  check('a code no rack has: the field\'s own words, with the code', out.value === null && out.message === 'Not a rack — 22292500 is not on any rack\'s label')
  check('…or the general words', chooseByCode(racks, '9').message === 'Nothing here has the code 9')
  check('a checklist takes scanMiss too', tickByCode(racks, [], 'X1', 'Not here: {code}').message === 'Not here: X1')
  check('missMessage: own words, else the fallback, else the default', missMessage('A {code} B {code}', 'Z') === 'A Z B Z' && missMessage('', 'Z', 'F {code}') === 'F Z' && missMessage(null, ' Z ') === 'Nothing has the code Z')
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
