// A RECORD'S FEED — comments and history from a function (feed.js): what a
// screen may say, what an answer becomes, and what posting a comment saves.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import {
  validateDocument, createScreen, addControl, setNodeProperty, nodeFunctions, inputNodes,
  FEED_EVENT, MAX_FEED_ENTRIES, entriesOf, shownEntries, initials, composeValues, convertParams, CONTROLS
} from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const COMPOSE = { screen: 'order_comment_edit', linkField: 'orderId', textField: 'body', fileField: 'attachment' }

function screen(props, source = 'orders') {
  let doc = createScreen({ id: 'order_view', name: 'Order', source })
  const added = addControl(doc, 'feed')
  doc = added.document
  Object.entries({ entriesFrom: 'orderFeed', ...props }).forEach(([k, v]) => { doc = setNodeProperty(doc, added.node.id, 'props.' + k, v) })
  return { doc, node: doc.nodes.find((n) => n.id === added.node.id) }
}

console.log('what a screen may say')
{
  const { doc, node } = screen({ compose: COMPOSE, eventsSwitch: true, order: 'oldest', refreshEvery: 60, empty: 'No comments yet' })
  check('a feed with a compose form: valid', errs(doc).length === 0, errs(doc).join('; '))
  check('it starts titled "Comments", newest first', node.props.title === 'Comments')
  check('its function is listed under "feedEntries", saying where', same(nodeFunctions(doc), [{ event: FEED_EVENT, name: 'orderFeed', at: 'nodes[0].props.entriesFrom' }]))
  check('it is not a field: no column, nothing to save', inputNodes(doc).length === 0)
  check('the designer offers it under Data', CONTROLS.feed.group === 'Data')
  check('text only (no file field): valid', errs(screen({ compose: { screen: 'c', linkField: 'orderId', textField: 'body' } }).doc).length === 0)
  check('read only (no compose): valid', errs(screen({}).doc).length === 0)
}
{
  const e = errs(screen({ entriesFrom: undefined }).doc)
  check('no function: refused, naming the event', e.some((x) => x.startsWith('nodes[0].props.entriesFrom') && x.includes('"feedEntries"')), e.join('; '))
  const nosrc = errs(screen({}, null).doc)
  check('a screen with no table: refused — the feed is about one of its records', nosrc.some((x) => x.includes('needs the screen to have a "source"')), nosrc.join('; '))
  const self = errs(screen({ compose: { ...COMPOSE, screen: 'order_view' } }).doc)
  check('comments saved through the screen itself: refused', self.some((x) => x.startsWith('nodes[0].props.compose.screen')), self.join('; '))
  const half = errs(screen({ compose: { screen: 'order_comment_edit' } }).doc)
  check('a compose form without its link and text fields: both refused', half.some((x) => x.includes('compose.linkField')) && half.some((x) => x.includes('compose.textField')), half.join('; '))
  const twice = errs(screen({ compose: { ...COMPOSE, textField: 'orderId' } }).doc)
  check('the text saved into the link field: refused', twice.some((x) => x.includes('three different fields')), twice.join('; '))
  const extra = errs(screen({ compose: { ...COMPOSE, author: 'me' } }).doc)
  check('a compose key it does not use: refused', extra.some((x) => x.startsWith('nodes[0].props.compose.author')), extra.join('; '))
  const bad = errs(screen({ order: 'random', refreshEvery: 3, eventsSwitch: 'yes' }).doc)
  check('a wrong order, a refresh under 10 s and a switch that is not true/false: each refused',
    ['props.order', 'props.refreshEvery', 'props.eventsSwitch'].every((k) => bad.some((x) => x.startsWith('nodes[0].' + k))), bad.join('; '))
}

console.log('what an answer becomes')
{
  const out = entriesOf({ entries: [
    { id: 1, kind: 'comment', text: 'Gift wrap please', author: { name: 'Riya Shah', badge: 'Packing' }, at: 'Today, 4:00 pm', files: [{ path: 'orders/a1__wrap.jpg', name: 'wrap.jpg' }, { name: 'no path' }] },
    { id: 'e1', kind: 'event', text: 'Status → Packed', author: { name: 'Amit' } },
    { id: 'e1', kind: 'event', text: 'the same id again' },
    { text: 'no id' },
    { id: 'blank', text: '' },
    { id: 'only-file', files: [{ path: 'x/b.pdf' }] },
    { id: 'odd', kind: 'shout', text: 'unknown kind', author: { badge: 'no name' } },
    null, 'text'
  ] })
  check('the entries a renderer can draw, in order; the rest dropped', same(out.map((e) => e.id), ['1', 'e1', 'only-file', 'odd']), JSON.stringify(out.map((e) => e.id)))
  check('a comment keeps its writer, badge, when and files with a path', same(out[0], { id: '1', kind: 'comment', text: 'Gift wrap please', author: { name: 'Riya Shah', badge: 'Packing' }, at: 'Today, 4:00 pm', files: [{ path: 'orders/a1__wrap.jpg', name: 'wrap.jpg' }], sub: null, convert: null, converted: null }), JSON.stringify(out[0]))
  check('an event keeps its kind', out[1].kind === 'event' && out[1].author.name === 'Amit' && out[1].author.badge === null)
  check('an unknown kind is a comment; an author with no name is none', out[3].kind === 'comment' && out[3].author === null)
  check('a bare list is accepted too', entriesOf([{ id: 'a', text: 'x' }]).length === 1)
  check('anything else is no entries, not an error', entriesOf(null).length === 0 && entriesOf({ rows: [] }).length === 0)
  const many = entriesOf(Array.from({ length: MAX_FEED_ENTRIES + 20 }, (_, i) => ({ id: i, text: 't' })))
  check(`at most ${MAX_FEED_ENTRIES} entries`, many.length === MAX_FEED_ENTRIES)
  check('"Comments only" leaves the events out', same(shownEntries(out, true).map((e) => e.id), ['1', 'only-file', 'odd']) && shownEntries(out, false).length === 4)
  check('initials: first and last name; one name; nothing', initials('Amit Kumar Verma') === 'AV' && initials('riya') === 'R' && initials('') === '?')
}

console.log('what posting saves')
{
  const made = composeValues(COMPOSE, '42', '  Called the customer  ', 'orders/a1__note.pdf')
  check('the link, the trimmed text and the file, under the compose form\'s field names',
    same(made.values, { orderId: '42', body: 'Called the customer', attachment: 'orders/a1__note.pdf' }), JSON.stringify(made))
  check('text only: no file field written', same(composeValues(COMPOSE, 7, 'hi').values, { orderId: 7, body: 'hi' }))
  check('a file alone is a comment', composeValues(COMPOSE, 7, '', 'p.jpg').values.attachment === 'p.jpg')
  check('nothing written: refused', /Write something/.test(composeValues(COMPOSE, 7, '   ').error))
  check('no record yet: refused — a comment belongs to a saved one', /Save the record first/.test(composeValues(COMPOSE, null, 'hi').error))
  check('a file where the form takes none: refused', /no files/.test(composeValues({ ...COMPOSE, fileField: undefined }, 7, 'hi', 'p.jpg').error))
  check('too long: refused', /at most/.test(composeValues(COMPOSE, 7, 'x'.repeat(6000)).error))
}

console.log('turning a comment into a task')
{
  const CONVERT = { screen: 'order_task_edit', linkField: 'orderId', label: 'Convert to task', openScreen: 'order_task_view' }
  const { doc } = screen({ compose: COMPOSE, convert: CONVERT })
  check('a feed that converts comments: valid', errs(doc).length === 0, errs(doc).join('; '))
  check('convert without a form: refused, naming it', errs(screen({ convert: { linkField: 'orderId' } }).doc).some((e) => /convert\.screen: is required/.test(e)))
  check('convert without a link field: valid — the new record belongs to nothing', errs(screen({ convert: { screen: 'general_task_edit' } }).doc).length === 0)
  check('a link field that is not a field name: refused', errs(screen({ convert: { screen: 'x_edit', linkField: 'not a field' } }).doc).some((e) => /convert\.linkField: must be/.test(e)))
  check('an unknown convert key: refused', errs(screen({ convert: { ...CONVERT, values: {} } }).doc).some((e) => /convert\.values: is not used/.test(e)))
  check('converting into this very screen: refused', errs(screen({ convert: { ...CONVERT, screen: 'order_view' } }).doc).some((e) => /convert\.screen: cannot be this screen/.test(e)))

  const [can, did, odd] = entriesOf([
    { id: 'oc-1', kind: 'comment', text: 'Call her', convert: { name: 'Call her', details: 'Call her', sourceCommentId: 1, bad: { x: 1 }, 'not a field': 'x' } },
    { id: 'oc-2', kind: 'comment', text: 'Done', converted: { id: 9, text: 'Ship it' } },
    { id: 'oc-3', kind: 'comment', text: 'x', convert: ['no'], converted: { text: 'no id' } }
  ])
  check('an entry keeps the values it converts with — plain values under field names only',
    same(can.convert, { name: 'Call her', details: 'Call her', sourceCommentId: 1 }), JSON.stringify(can.convert))
  check('an entry keeps what it became, the id as text', same(did.converted, { id: '9', text: 'Ship it' }), JSON.stringify(did.converted))
  check('a list, or a "became" with no id: dropped', odd.convert === null && odd.converted === null)
  check('opened with its values and the link back to this record',
    same(convertParams(CONVERT, 'o7', can), { name: 'Call her', details: 'Call her', sourceCommentId: 1, orderId: 'o7' }))
  check('the entry cannot point the task at another record', convertParams(CONVERT, 'o7', entriesOf([{ id: 'a', text: 'x', convert: { orderId: 'other' } }])[0]).orderId === 'o7')
  check('no link field: only the entry\'s values', same(convertParams({ screen: 'general_task_edit' }, 'o7', can), { name: 'Call her', details: 'Call her', sourceCommentId: 1 }))
  check('already converted: not again', convertParams(CONVERT, 'o7', { ...can, converted: { id: '1' } }) === null)
  check('no record, or a feed that does not convert: nothing', convertParams(CONVERT, null, can) === null && convertParams(null, 'o7', can) === null)
  check('an entry the function did not offer: nothing', convertParams(CONVERT, 'o7', did) === null)
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
