// Files: a file field that holds several, a camera-only one, and a button
// whose press takes files (`ask.file`) — the document side: what a screen may
// say, what the checker refuses, how the value is kept, and what a press sends.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import {
  validateDocument, createScreen, addControl, setNodeProperty, tableForScreen,
  filePicker, isImageFile, IMAGE_EXTENSIONS, MAX_FILES, isMultiFile,
  parseInput, fieldError, toDbValue, fromDbValue, displayValue, initialValues, recordValues,
  askFile, askFileProblem, buttonInput, paramProblems, FILES_INPUT
} from '../src/model.js'
import { widening } from '../src/tableSchema.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }

const IMAGES = '.png,.jpg,.jpeg'

/** A form on `orders` with one file field of these props. */
function fileScreen(props) {
  const added = addControl(createScreen({ id: 'order_photos', name: 'Photos', source: 'orders' }), 'file')
  let doc = added.document
  const id = added.node.id
  doc = setNodeProperty(doc, id, 'props.name', 'photos')
  Object.entries(props).forEach(([k, v]) => { doc = setNodeProperty(doc, id, 'props.' + k, v) })
  return { doc, node: doc.nodes.find((n) => n.id === id) }
}
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`).join('\n')

console.log('the picker a field asks for')
{
  check('any source: the device\'s own menu, several when the field holds several', JSON.stringify(filePicker({ accept: IMAGES, multiple: true })) === JSON.stringify({ accept: IMAGES, multiple: true }))
  const cam = filePicker({ accept: IMAGES, multiple: true, source: 'camera' })
  check('camera only: the back camera, one photo at a time', cam.capture === 'environment' && cam.multiple === false)
  check('a picture is known by its extension, as the server checks', isImageFile('orders/k3__Photo.JPG') && !isImageFile('orders/k3__scan.pdf') && !isImageFile('noext'))
  check('the image extensions are the "Images" kind', IMAGE_EXTENSIONS.includes('.jpg') && IMAGE_EXTENSIONS.includes('.webp'))
}

console.log('\nwhat a screen may say about a file field')
{
  check('several files, at most 5, from the camera: fine', errs(fileScreen({ accept: IMAGES, multiple: true, maxFiles: 5, source: 'camera' }).doc) === '')
  check('the camera with PDFs allowed is refused, naming the images it may take', /a camera takes photos/.test(errs(fileScreen({ accept: '.pdf,.jpg', source: 'camera' }).doc)))
  check('an unknown source is refused', /must be one of: any, camera/.test(errs(fileScreen({ accept: IMAGES, source: 'gallery' }).doc)))
  check('a limit on files without "multiple" is refused', /is for several files/.test(errs(fileScreen({ accept: IMAGES, maxFiles: 3 }).doc)))
  check(`more than ${MAX_FILES} files is refused`, /from 1 to 20/.test(errs(fileScreen({ accept: IMAGES, multiple: true, maxFiles: 50 }).doc)))
  check('"multiple" must be true or false', /true or false/.test(errs(fileScreen({ accept: IMAGES, multiple: 'yes' }).doc)))
}

console.log('\nthe value of a field holding several files')
{
  const { doc, node } = fileScreen({ accept: IMAGES, multiple: true, maxFiles: 2, required: true })
  check('it is a list', isMultiFile(node) && Array.isArray(initialValues(doc).photos) && initialValues(doc).photos.length === 0)
  check('kept in one text column, comma separated', toDbValue(node, ['orders/a__1.jpg', 'orders/b__2.jpg']) === 'orders/a__1.jpg,orders/b__2.jpg')
  check('…and read back as the list', JSON.stringify(fromDbValue(node, 'orders/a__1.jpg,orders/b__2.jpg')) === JSON.stringify(['orders/a__1.jpg', 'orders/b__2.jpg']))
  check('one path saved before "several" was on reads as a list of one', JSON.stringify(recordValues(doc, { photos: 'orders/a__1.jpg' }).photos) === JSON.stringify(['orders/a__1.jpg']))
  check('required: none is refused', /is required/.test(fieldError(node, []) || ''))
  check('more than maxFiles is refused', /at most 2 files/.test(fieldError(node, ['a.jpg', 'b.jpg', 'c.jpg']) || ''))
  check('two is fine', fieldError(node, ['orders/a__1.jpg', 'orders/b__2.jpg']) === null)
  check('a list shows the names, not the ids', displayValue(node, 'orders/a__front.jpg,orders/b__back.jpg') === 'front.jpg, back.jpg')
  check('parseInput keeps a list as it is', parseInput(node, ['x']).length === 1)
  const col = tableForScreen(doc).columns.find((c) => c.name === 'photos')
  check('its column is text', col && col.type === 'text', JSON.stringify(col))
  const single = tableForScreen(fileScreen({ accept: IMAGES }).doc).columns.find((c) => c.name === 'photos')
  check('…and turning "several" on is a widening that keeps what is saved', widening(single, col).ok === true)
  const one = fileScreen({ accept: IMAGES }).node
  check('a one-file field is still one path', toDbValue(one, 'orders/a__1.jpg') === 'orders/a__1.jpg' && displayValue(one, 'orders/a__1.jpg') === '1.jpg')
}

console.log('\na button whose press takes files')
{
  const button = { id: 'proof', label: 'Delivered', action: 'markDelivered', ask: { title: 'Proof of delivery', file: { label: 'Photo', accept: IMAGES, multiple: true, maxFiles: 3, source: 'any', required: true } } }
  const added = addControl(createScreen({ id: 'order_actions', name: 'Order actions', source: 'orders' }), 'buttons')
  const doc = setNodeProperty(added.document, added.node.id, 'props.buttons', [button])
  check('a screen saying so is valid', errs(doc) === '', errs(doc))
  const bad = setNodeProperty(added.document, added.node.id, 'props.buttons', [{ ...button, ask: { file: { label: 'Photo', multiple: true } } }])
  check('ask.file without accept is refused — the server must have something to check', /ask\.file\.accept: is required/.test(errs(bad)))
  const odd = setNodeProperty(added.document, added.node.id, 'props.buttons', [{ ...button, ask: { file: { accept: IMAGES, path: '/etc' } } }])
  check('a key ask.file does not use is refused', /remove: path/.test(errs(odd)))
  const cam = setNodeProperty(added.document, added.node.id, 'props.buttons', [{ ...button, ask: { file: { accept: '.pdf', source: 'camera' } } }])
  check('…and the camera rule applies to it too', /a camera takes photos/.test(errs(cam)))

  check('askFile reads it', askFile(button).label === 'Photo' && askFile({ id: 'x' }) === null)
  const input = buttonInput(button, 'left at door', ['orders/_buttons/proof/u1/a__1.jpg'])
  check('the press sends the stored paths as "files"', Array.isArray(input[FILES_INPUT]) && input[FILES_INPUT][0].endsWith('a__1.jpg'))
  check('…but not to a button that takes none', buttonInput({ id: 'x', params: { a: 1 } }, null, ['p']).files === undefined)
  check('required and none given: refused', askFileProblem(button, []) === 'Photo is required')
  check('more than maxFiles: refused', askFileProblem(button, ['a', 'b', 'c', 'd']) === 'Photo: at most 3 files')
  check('two of one: refused', askFileProblem({ ask: { file: { accept: IMAGES } } }, ['a', 'b']) === 'A file: one file only')
  check('files to a button that takes none: refused', askFileProblem({ id: 'x' }, ['a']) === 'This button takes no files')
  check('fine: null', askFileProblem(button, ['a']) === null)

  const schema = [{ name: 'files', type: 'array' }, { name: 'note', type: 'string' }]
  check('a function that takes "files" fits', paramProblems(button, schema).length === 0, paramProblems(button, schema).join())
  check('one that does not is named when publishing', paramProblems(button, [{ name: 'note' }]).some((p) => /asks for a file, but takes no "files"/.test(p)))
  check('a required "files" is the person\'s to give, not the screen\'s', paramProblems(button, [{ name: 'files', type: 'array', required: true }]).length === 0)
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
