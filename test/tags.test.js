// An autocomplete in TAG MODE: several values as chips, each with a quantity,
// adding no column (suggest.js) — what a screen may say, what the chips
// become, what the form checks and what the spec generates.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import {
  validateDocument, createScreen, addControl, setNodeProperty, columnForField, storedNodes, tableForScreen,
  fieldError, parseInput, formSchema, initialValues, recordValues, screensFromSpec, screenFromSpec,
  isTagField, tagLimit, addTag, setTagQty, removeTag, tagsOf, MAX_TAGS, MAX_TAG_QTY
} from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function screen(props) {
  let doc = createScreen({ id: 'movement_edit', name: 'Movement', source: 'movements' })
  const name = addControl(doc, 'text'); doc = setNodeProperty(setNodeProperty(name.document, name.node.id, 'props.name', 'number'), name.node.id, 'props.label', 'Number')
  const added = addControl(doc, 'autocomplete')
  doc = added.document
  Object.entries({ name: 'addProducts', label: 'Add products', suggestFrom: 'productSuggestions', ...props }).forEach(([k, v]) => { doc = setNodeProperty(doc, added.node.id, 'props.' + k, v) })
  return { doc, node: doc.nodes.find((n) => n.id === added.node.id) }
}

console.log('what a screen may say')
{
  const { doc, node } = screen({ multiple: true, quantity: true, maxTags: 50 })
  check('several, with a quantity, at most 50: valid', errs(doc).length === 0, errs(doc).join('; '))
  check('a tag field', isTagField(node) && !isTagField(screen({}).node))
  check('quantity without several: refused', errs(screen({ quantity: true }).doc).some((e) => /quantity: .*multiple/.test(e)))
  check('maxTags without several: refused', errs(screen({ maxTags: 5 }).doc).some((e) => /maxTags: .*multiple/.test(e)))
  check('maxTags 1–100', errs(screen({ multiple: true, maxTags: 0 }).doc).some((e) => /maxTags/.test(e)) && errs(screen({ multiple: true, maxTags: 101 }).doc).some((e) => /maxTags/.test(e)))
  check('multiple / quantity are true or false', errs(screen({ multiple: 'yes' }).doc).some((e) => /multiple/.test(e)) && errs(screen({ multiple: true, quantity: 1 }).doc).some((e) => /quantity/.test(e)))
  check('several start empty: no default', errs(screen({ multiple: true, default: 'x' }).doc).some((e) => /default/.test(e)))
}

console.log('no column')
{
  const { doc, node } = screen({ multiple: true, quantity: true })
  check('columnForField: none', columnForField(node) === null)
  check('the table has the other fields only', same(tableForScreen(doc).columns.map((c) => c.name), ['number']))
  check('storedNodes: without it', same(storedNodes(doc).map((n) => n.props.name), ['number']))
  check('one value still a column', columnForField(screen({}).node).type === 'varchar')
}

console.log('the chips')
{
  let tags = addTag([], { value: 'Silver Horse', label: 'Silver Horse', image: 'https://cdn/h.jpg', fill: { sku: 'GAD631' } }, true)
  check('a pick adds a chip with qty 1', same(tags, [{ value: 'Silver Horse', label: 'Silver Horse', image: 'https://cdn/h.jpg', fill: { sku: 'GAD631' }, qty: 1 }]))
  tags = addTag(tags, { value: 'Silver Horse' }, true)
  check('the same value again: one more, not a second chip', tags.length === 1 && tags[0].qty === 2)
  check('without quantity: the same value again changes nothing', same(addTag([{ value: 'a', label: 'a' }], { value: 'a' }, false), [{ value: 'a', label: 'a' }]))
  check('typed text is a chip', same(addTag([], { value: ' Vase ' }, false), [{ value: 'Vase', label: 'Vase' }]))
  check('nothing typed adds nothing', addTag(tags, { value: '  ' }, true) === tags && same(addTag(null, null, true), []))
  check('qty is capped', addTag([{ value: 'a', qty: MAX_TAG_QTY }], { value: 'a' }, true)[0].qty === MAX_TAG_QTY)
  check('setTagQty / removeTag', setTagQty(tags, 0, 5)[0].qty === 5 && removeTag(tags, 0).length === 0 && same(removeTag(null, 0), []) && same(setTagQty(null, 0, 1), []))
  check('tagLimit: the field\'s, else the most', tagLimit({ maxTags: 3 }) === 3 && tagLimit({}) === MAX_TAGS && tagLimit({ maxTags: 500 }) === MAX_TAGS && tagLimit(null) === MAX_TAGS)
}

console.log('checked — the same on both sides')
{
  const { node } = screen({ multiple: true, quantity: true, maxTags: 2, required: true })
  check('clean: trimmed, qty a number', same(tagsOf(node, [{ value: ' a ', qty: '3' }]).tags, [{ value: 'a', label: 'a', qty: 3 }]))
  check('no qty: 1', tagsOf(node, [{ value: 'a' }]).tags[0].qty === 1)
  check('required: at least one', /add at least one/.test(tagsOf(node, []).error) && /add at least one/.test(tagsOf(node, null).error))
  check('not a list', /must be a list/.test(tagsOf(node, 'a').error))
  check('more than maxTags', /at most 2/.test(tagsOf(node, [{ value: 'a' }, { value: 'b' }, { value: 'c' }]).error))
  check('an entry that is no object', /entry 1 is not a value/.test(tagsOf(node, ['a']).error))
  check('an entry without a value', /entry 1 has no value/.test(tagsOf(node, [{ value: ' ' }]).error))
  check('a value too long', /longer than 255/.test(tagsOf(node, [{ value: 'x'.repeat(256) }]).error))
  check('qty 0, 1.5 or too many: refused', [0, 1.5, MAX_TAG_QTY + 1, 'two'].every((q) => /whole number/.test(tagsOf(node, [{ value: 'a', qty: q }]).error)))
  check('fill with an object in it: refused', /not a plain value/.test(tagsOf(node, [{ value: 'a', fill: { x: { y: 1 } } }]).error) && /not a plain value/.test(tagsOf(node, [{ value: 'a', fill: [1] }]).error))
  check('fill plain: kept', same(tagsOf(node, [{ value: 'a', fill: { sku: 'S', n: 2, none: null } }]).tags[0].fill, { sku: 'S', n: 2, none: null }))
  const plain = screen({ multiple: true }).node
  check('without quantity: no qty kept', same(tagsOf(plain, [{ value: 'a', qty: 9 }]).tags, [{ value: 'a', label: 'a' }]))
  check('not required: none is fine', tagsOf(plain, []).error === null && tagsOf({}, undefined).error === null)
  check('fieldError says the same', /at most 2/.test(fieldError(node, [{ value: 'a' }, { value: 'b' }, { value: 'c' }])) && fieldError(node, [{ value: 'a' }]) === null)
}

console.log('the form')
{
  const { doc, node } = screen({ multiple: true, quantity: true })
  check('starts as no chips', same(initialValues(doc).addProducts, []))
  check('a record shows no chips (it has no column)', same(recordValues(doc, { number: 'MV-1' }).addProducts, []))
  check('what the box hands over is kept as a list', same(parseInput(node, [{ value: 'a' }]), [{ value: 'a' }]) && same(parseInput(node, 'x'), []))
  const field = formSchema(doc).find((f) => f.name === 'addProducts')
  check('the schema: a list, its rules left to tagsOf', field.type === 'array' && !field.validation && !field.required && field.description === 'Add products')
}

console.log('the spec')
{
  const { edit, list } = screensFromSpec({ entity: 'movement', fields: [
    { label: 'Sent on', type: 'datetime' },
    { label: 'Add products', name: 'addProducts', type: 'autocomplete', suggestFrom: 'productSuggestions', multiple: true, quantity: true, maxTags: 40 },
    { label: 'Photos', type: 'file', accept: '.jpg', multiple: true, maxFiles: 10 }
  ] })
  const tag = edit.nodes.find((n) => n.props && n.props.name === 'addProducts')
  check('generated with multiple, quantity, maxTags', tag.props.multiple === true && tag.props.quantity === true && tag.props.maxTags === 40)
  check('taller than one line, for its chips', tag.h > 0.1)
  const photos = edit.nodes.find((n) => n.props && n.props.name === 'photos')
  check('a file with several, at most 10', photos.props.multiple === true && photos.props.maxFiles === 10)
  const listNode = list.nodes.find((n) => n.type === 'list')
  check('the list has no column for the chips', !listNode.props.columns.some((c) => c.field === 'addProducts'))
  const refuses = (f, re) => { try { screenFromSpec({ name: 'X', fields: [f] }); return false } catch (e) { return re.test(e.message) } }
  check('quantity on a text field: refused', refuses({ label: 'A', quantity: true }, /quantity/))
  check('multiple on a text field: refused', refuses({ label: 'A', multiple: true }, /multiple only applies/))
  check('maxFiles on a text field: refused', refuses({ label: 'A', maxFiles: 2 }, /maxFiles only applies/))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
