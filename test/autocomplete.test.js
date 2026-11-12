// An autocomplete field: text with suggestions an app function works out as
// the person types (suggest.js) — what a screen may say, what it stores, what
// publishing checks, what a function's answer becomes and what picking writes.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import {
  validateDocument, createScreen, addControl, setNodeProperty, functionProblems, nodeFunctions,
  columnForField, fieldError, screenFromSpec, parseInput, formSchema, CONTROLS,
  suggestionsOf, shouldSuggest, pickValues, SUGGEST_EVENT, MAX_SUGGESTIONS, DEFAULT_MIN_CHARS
} from '../src/model.js'
import { createFactoryApi } from '../src/remote.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function screen(props) {
  let doc = createScreen({ id: 'movement_item_edit', name: 'Movement item', source: 'movement_items' })
  const added = addControl(doc, 'autocomplete')
  doc = added.document
  Object.entries({ name: 'name', label: 'Product', ...props }).forEach(([k, v]) => { doc = setNodeProperty(doc, added.node.id, 'props.' + k, v) })
  const sku = addControl(doc, 'text'); doc = setNodeProperty(setNodeProperty(sku.document, sku.node.id, 'props.name', 'sku'), sku.node.id, 'props.label', 'SKU')
  const qty = addControl(doc, 'number'); doc = setNodeProperty(setNodeProperty(qty.document, qty.node.id, 'props.name', 'quantity'), qty.node.id, 'props.label', 'Quantity')
  return { doc, node: doc.nodes.find((n) => n.id === added.node.id) }
}

console.log('what a screen may say')
{
  check('a control of its own, an input, stored as text', CONTROLS.autocomplete.input && CONTROLS.autocomplete.valueType === 'string')
  const { doc } = screen({ suggestFrom: 'productSuggestions', minChars: 2, required: true })
  check('with its function: valid', errs(doc).length === 0, errs(doc).join('; '))
  check('without one: refused, saying which event', errs(screen({}).doc).some((e) => /suggestFrom: .*event "suggest"/.test(e)))
  check('a name that is no function name: refused', errs(screen({ suggestFrom: 'two words' }).doc).some((e) => /suggestFrom/.test(e)))
  check('minChars: a whole number 1–10', errs(screen({ suggestFrom: 'f', minChars: 0 }).doc).some((e) => /minChars/.test(e)) &&
    errs(screen({ suggestFrom: 'f', minChars: 1.5 }).doc).some((e) => /minChars/.test(e)) && !errs(screen({ suggestFrom: 'f', minChars: 10 }).doc).length)
}

console.log('what publishing checks')
{
  const { doc } = screen({ suggestFrom: 'productSuggestions' })
  check('the screen names it, for "suggest"', nodeFunctions(doc).some((f) => f.event === SUGGEST_EVENT && f.name === 'productSuggestions' && /props\.suggestFrom$/.test(f.at)))
  check('registered for "suggest": fine', functionProblems(doc, [{ name: 'productSuggestions', event: 'suggest' }]).length === 0)
  check('not registered: refused', functionProblems(doc, []).some((p) => /not a registered function/.test(p.problem)))
  check('registered for something else: refused', functionProblems(doc, [{ name: 'productSuggestions', event: 'listRows' }]).some((p) => /"listRows", not "suggest"/.test(p.problem)))
}

console.log('what it stores and checks')
{
  const { node } = screen({ suggestFrom: 'f' })
  check('a varchar(255) column, like text', same(columnForField(node), { name: 'name', label: 'Product', type: 'varchar', length: 255 }))
  const capped = { ...node, props: { ...node.props, validation: { maxLength: 80 } } }
  check('its max length: the column\'s', columnForField(capped).length === 80)
  check('too long: said like text', /at most 80/.test(fieldError(capped, 'x'.repeat(81))))
  check('required and empty: said', /is required/.test(fieldError({ ...node, props: { ...node.props, required: true } }, '')))
  check('typed text is a string', parseInput(node, 'Silver horse') === 'Silver horse')
  check('the server checks it as a string', formSchema(screen({ suggestFrom: 'f' }).doc)[0].type === 'string')
}

console.log('from an entity spec')
{
  const doc = screenFromSpec({ name: 'Movement item', source: 'movement_items', fields: [
    { label: 'Product', name: 'name', type: 'autocomplete', suggestFrom: 'productSuggestions', required: true },
    { label: 'SKU', name: 'sku' }
  ] })
  const ac = doc.nodes.find((n) => n.type === 'autocomplete')
  check('makes the node, with its function', ac && ac.props.suggestFrom === 'productSuggestions' && ac.props.name === 'name' && ac.props.required === true)
  let said = ''
  try { screenFromSpec({ name: 'X', fields: [{ label: 'Product', type: 'autocomplete' }] }) } catch (e) { said = e.message }
  check('without suggestFrom: says so', /give it suggestFrom/.test(said))
  said = ''
  try { screenFromSpec({ name: 'X', fields: [{ label: 'Name', suggestFrom: 'f' }] }) } catch (e) { said = e.message }
  check('suggestFrom on a text field: refused', /only apply to an autocomplete/.test(said))
}

console.log('what a function answers')
{
  const out = suggestionsOf([
    { value: ' Silver Gallop Horse ', sub: 'GA-HR-01', image: 'https://cdn/x.jpg', fill: { sku: 'GA-HR-01', quantity: 1, bad: { x: 1 }, gone: undefined } },
    { value: '' }, null, 'text', { label: 'no value' },
    { value: 42, label: 'Forty-two', sub: '  ' }
  ])
  check('only those with a value; label falls back to it', out.length === 2 && out[0].value === 'Silver Gallop Horse' && out[0].label === 'Silver Gallop Horse')
  check('sub and image kept; a blank sub dropped', out[0].sub === 'GA-HR-01' && out[0].image === 'https://cdn/x.jpg' && out[1].sub === undefined)
  check('fill keeps plain values only', same(out[0].fill, { sku: 'GA-HR-01', quantity: 1 }))
  check('a number becomes text', out[1].value === '42' && out[1].label === 'Forty-two')
  check('not a list: none', same(suggestionsOf({ rows: [] }), []))
  check(`at most ${MAX_SUGGESTIONS}`, suggestionsOf(Array.from({ length: 50 }, (_, i) => ({ value: 'v' + i }))).length === MAX_SUGGESTIONS)
  check('an empty fill is left off', suggestionsOf([{ value: 'a', fill: { x: {} } }])[0].fill === undefined)
}

console.log('when it asks, and what picking writes')
{
  check(`${DEFAULT_MIN_CHARS} letters by default`, !shouldSuggest({}, ' a ') && shouldSuggest({}, 'ab'))
  check('its own minChars', !shouldSuggest({ minChars: 3 }, 'ab') && shouldSuggest({ minChars: 3 }, 'abc') && shouldSuggest({ minChars: 1 }, 'a'))
  const { doc, node } = screen({ suggestFrom: 'f' })
  const writes = pickValues(doc, node, { value: 'Silver Gallop Horse', fill: { sku: 'GA-HR-01', quantity: 2, productImage: 'https://x', name: 'ignored' } })
  check('the field, and the fields on the screen it fills — never another name, never itself again', same(writes, { name: 'Silver Gallop Horse', sku: 'GA-HR-01', quantity: 2 }))
  check('no fill: the field alone', same(pickValues(doc, node, { value: 'Vase' }), { name: 'Vase' }))
}

console.log('the API')
{
  const asked = []
  const api = createFactoryApi({ base: '/api', fetch: async (url) => { asked.push(url); return { dataArray: [{ value: 'Horse' }] } } })
  const got = await api.suggest({ screen: 'movement_item_edit', node: 'n3', q: 'hor se' })
  check('GET /factory/suggest/<screen> with the node and the text only', asked[0] === '/api/factory/suggest/movement_item_edit?node=n3&q=hor%20se', asked[0])
  check('answers the suggestions', got.length === 1 && got[0].value === 'Horse')
  check('a FactoryScreen gets it', typeof api.screenProps.suggest === 'function')
  const empty = createFactoryApi({ fetch: async () => ({ dataArray: null }) })
  check('nothing back: none', same(await empty.suggest({ screen: 's', node: 'n', q: 'ab' }), []))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
