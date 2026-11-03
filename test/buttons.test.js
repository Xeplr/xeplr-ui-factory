// Buttons, and lists whose rows a function works out — the document side:
// what a screen may say, what the checker refuses, and what publishing asks
// of the registry.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import {
  validateDocument, createScreen, addControl, setNodeProperty,
  conditionMet, buttonShown, buttonDisabled, buttonPressed, buttonById, buttonInput, screenButtons,
  nodeFunctions, paramProblems, functionProblems, CONTROLS, webOnlyMenus, routesIn
} from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }

const STATUSES = [{ value: 'packed', label: 'Packed' }, { value: 'shipped', label: 'Shipped' }]
const REGISTRY = [
  { name: 'setOrderStatus', event: 'button', inputSchema: [{ name: 'status', type: 'string', required: true, options: STATUSES }, { name: 'note', type: 'string' }] },
  { name: 'confirmCod', event: 'button', inputSchema: [{ name: 'undo', type: 'boolean', default: false }, { name: 'note', type: 'string' }] },
  { name: 'orderList', event: 'listRows', inputSchema: [] },
  { name: 'orderActivity', event: 'rowDetails', inputSchema: [] },
  { name: 'notifyHR', event: 'afterSave' }
]

/** A screen with one panel of these buttons. */
function panel(buttons, extra = {}) {
  const added = addControl(createScreen({ id: 'order_actions', name: 'Order actions', source: 'orders' }), 'buttons')
  let doc = added.document
  const id = added.node.id
  doc = setNodeProperty(doc, id, 'props.buttons', buttons)
  Object.entries(extra).forEach(([k, v]) => { doc = setNodeProperty(doc, id, 'props.' + k, v) })
  return doc
}

/** A screen with one list fed by a function. */
function fedList(props) {
  const added = addControl(createScreen({ id: 'orders_board', name: 'Orders' }), 'list')
  let doc = added.document
  const id = added.node.id
  Object.entries(props).forEach(([k, v]) => { doc = setNodeProperty(doc, id, 'props.' + k, v) })
  return doc
}

const errs = (doc) => validateDocument(doc).errors.map((e) => e.path + ' ' + e.message).join(' | ')

const PACKED = { id: 'packed', label: 'Packed', action: 'setOrderStatus', params: { status: 'packed' },
  ask: { title: 'Change status to Packed', note: 'Reason (optional)' },
  disabledWhen: [{ field: 'customStatus', op: 'eq', value: 'packed' }] }
const COD = { id: 'cod', label: 'Confirm COD', action: 'confirmCod', ask: { note: 'Note (optional)' },
  when: [{ field: 'paymentMethod', op: 'neq', value: 'COD Confirmed' }] }

console.log('a panel of buttons')
{
  check('Buttons is a control, not a field', CONTROLS.buttons && CONTROLS.buttons.input === false)
  const doc = panel([PACKED, COD])
  check('a panel with an action and its parameters is valid', validateDocument(doc).ok, errs(doc))
  check('an empty panel is valid — the designer starts there', validateDocument(panel([])).ok)
  check('a button needs an id', /buttons\[0\]\.id must be/.test(errs(panel([{ ...PACKED, id: undefined }]))))
  check('two buttons with one id are refused, naming the first', /"packed" is already the id of/.test(errs(panel([PACKED, { ...COD, id: 'packed' }]))))
  check('ids are unique across panels too', (() => {
    let d = panel([PACKED])
    const two = addControl(d, 'buttons'); d = setNodeProperty(two.document, two.node.id, 'props.buttons', [{ ...COD, id: 'packed' }])
    return /already the id/.test(errs(d))
  })())
  check('a button needs a label', /label must be/.test(errs(panel([{ ...PACKED, label: '' }]))))
  check('code in place of an action name is refused', /action must be the name/.test(errs(panel([{ ...PACKED, action: 'return fetch(x)' }]))))
  check('a parameter must be a plain value', /params\.status must be a plain value/.test(errs(panel([{ ...PACKED, params: { status: { $where: 1 } } }]))))
  check('a key a button does not use is refused', /remove: onClick/.test(errs(panel([{ ...PACKED, onClick: 'x' }]))))
  check('ask takes only title, message and note', /remove: html/.test(errs(panel([{ ...PACKED, ask: { html: '<b>' } }]))))
  check('a condition with an unknown operator is refused, listing them', /disabledWhen\[0\]\.op must be one of: lt/.test(errs(panel([{ ...PACKED, disabledWhen: [{ field: 'customStatus', op: '==', value: 'x' }] }]))))
  check('a condition comparing with nothing is refused', /needs a value/.test(errs(panel([{ ...PACKED, when: [{ field: 'customStatus', op: 'eq' }] }]))))
  check('"is blank" needs no value', validateDocument(panel([{ ...PACKED, when: [{ field: 'customStatus', op: 'isEmpty' }] }])).ok)
  check('a variant outside the three is refused', /variant must be one of: default, primary, danger/.test(errs(panel([{ ...PACKED, variant: 'huge' }]))))
}

console.log('\nwhen a button shows, and when it is greyed out')
{
  check('no conditions: shown', buttonShown({ label: 'x' }, {}))
  check('every rule must match', conditionMet([{ field: 'a', op: 'eq', value: 1 }, { field: 'b', op: 'eq', value: 'x' }], { a: 1, b: 'x' }) &&
    !conditionMet([{ field: 'a', op: 'eq', value: 1 }, { field: 'b', op: 'eq', value: 'x' }], { a: 1, b: 'y' }))
  check('Confirm COD shows until it is confirmed', buttonShown(COD, { paymentMethod: 'COD' }) && !buttonShown(COD, { paymentMethod: 'COD Confirmed' }))
  check('the current status\'s button is disabled', buttonDisabled(PACKED, { customStatus: 'packed' }) && !buttonDisabled(PACKED, { customStatus: 'shipped' }))
  check('a button with no disabledWhen is never disabled', !buttonDisabled(COD, { paymentMethod: 'COD Confirmed' }))
  check('the current choice is drawn pressed', buttonPressed({ pressedWhen: [{ field: 'customStatus', op: 'eq', value: 'packed' }] }, { customStatus: 'packed' }) && !buttonPressed(PACKED, { customStatus: 'packed' }))
  check('pressedWhen is checked like the others', /pressedWhen\[0\]\.op must be one of/.test(errs(panel([{ ...PACKED, pressedWhen: [{ field: 'a', op: 'is' }] }]))))
  check('a missing field reads as blank', conditionMet([{ field: 'customStatus', op: 'isEmpty' }], {}))
}

console.log('\nwhat a press sends')
{
  const doc = panel([PACKED, COD])
  check('a button is found by its id, with its panel', buttonById(doc, 'cod').button.label === 'Confirm COD' && buttonById(doc, 'cod').node.type === 'buttons')
  check('an id the screen does not have is nothing', buttonById(doc, 'delete-everything') === null)
  check('every button on the screen', screenButtons(doc).map((b) => b.button.id).join() === 'packed,cod')
  check('the parameters come from the document', JSON.stringify(buttonInput(PACKED)) === '{"status":"packed"}')
  check('the note is added when the button asks for one', buttonInput(PACKED, '  late courier ').note === 'late courier')
  check('a blank note is not sent', !('note' in buttonInput(PACKED, '   ')))
  check('a note to a button that asks for none is dropped', !('note' in buttonInput({ ...PACKED, ask: undefined }, 'hi')))
  check('a note cannot replace a parameter', buttonInput({ ...PACKED, params: { status: 'packed' } }, 'x').status === 'packed')
}

console.log('\nchecked against the registry, at publish')
{
  check('the right parameters: no problems', paramProblems(PACKED, REGISTRY[0].inputSchema).length === 0)
  check('a parameter the function does not take is named, with what it takes', /takes no parameter "colour" — it takes: status, note/.test(paramProblems({ ...PACKED, params: { status: 'packed', colour: 'red' } }, REGISTRY[0].inputSchema).join()))
  check('a value outside the options is named, with the options', /"status" must be one of: packed, shipped/.test(paramProblems({ ...PACKED, params: { status: 'lost' } }, REGISTRY[0].inputSchema).join()))
  check('a required one missing is named', /needs "status"/.test(paramProblems({ ...PACKED, params: {} }, REGISTRY[0].inputSchema).join()))
  check('one with a default is not required', paramProblems(COD, REGISTRY[1].inputSchema).length === 0)
  check('asking for a note the function cannot take is refused', /takes no "note"/.test(paramProblems(PACKED, [{ name: 'status', options: ['packed'] }]).join()))

  const doc = panel([PACKED, COD])
  check('a panel whose functions are registered can run', functionProblems(doc, REGISTRY).length === 0, JSON.stringify(functionProblems(doc, REGISTRY)))
  const gone = functionProblems(doc, REGISTRY.filter((f) => f.name !== 'confirmCod'))
  check('a button whose function is not registered is refused, saying where', gone.length === 1 && /nodes\[0\]\.props\.buttons\[1\]\.action/.test(gone[0].at) && /"confirmCod" is not a registered function/.test(gone[0].problem))
  const wrong = functionProblems(panel([{ ...PACKED, action: 'notifyHR' }]), REGISTRY)
  check('a function written for something else is refused', /written for "afterSave", not "button"/.test(wrong[0].problem))
  const params = functionProblems(panel([{ ...PACKED, params: { status: 'lost' } }]), REGISTRY)
  check('wrong parameters refuse the publish, naming the button', /button "Packed": "setOrderStatus" "status" must be one of/.test(params[0].problem))
  check('the screen\'s events are still checked beside them', functionProblems({ ...doc, events: { afterSave: 'nobody' } }, REGISTRY).some((p) => p.event === 'afterSave'))
}

console.log('\na list whose rows a function works out')
{
  const columns = [
    { field: 'orderNumber', label: 'Order', badges: [{ field: 'isNew', label: 'New', tone: 'accent' }, { field: 'cancelled', label: 'Cancelled', tone: 'danger' }] },
    { field: 'customerName', label: 'Customer', sub: 'city' },
    { field: 'images', label: 'Items', display: 'images', more: 'moreImages', sortable: false },
    { field: 'ageMs', label: 'Aging', text: 'agingText' },
    { field: 'lastActivityAt', label: 'Last activity', text: 'lastActivityText', display: 'activity', details: 'orderActivity', sortable: false }
  ]
  const ok = fedList({ rowsFrom: 'orderList', search: { placeholder: 'Search orders' }, filters: [{ key: 'all', label: 'All' }, { key: 'packed', label: 'Packed' }],
    refreshEvery: 60, highlight: 'isNew', columns, actions: [], editScreen: 'order_edit', rowOpen: true, openIn: 'page' })
  check('a function-fed list needs no table', validateDocument(ok).ok, errs(ok))
  check('the functions it names, by what they are for', JSON.stringify(nodeFunctions(ok).map((f) => f.event + ':' + f.name)) === '["listRows:orderList","rowDetails:orderActivity"]')
  check('…and they are checked at publish', functionProblems(ok, REGISTRY).length === 0 && functionProblems(ok, []).length === 2)
  check('a list with neither a table nor a function is refused', /props\.source is required/.test(errs(fedList({}))))
  check('a search box without a function is refused', /a search box needs "rowsFrom"/.test(errs(fedList({ source: 'orders', search: { placeholder: 'x' } }))))
  check('chips without a function are refused', /filter chips needs "rowsFrom"/.test(errs(fedList({ source: 'orders', filters: [{ key: 'a', label: 'A' }] }))))
  check('a chip key used twice is refused', /"all" appears twice/.test(errs(fedList({ rowsFrom: 'orderList', actions: [], filters: [{ key: 'all', label: 'All' }, { key: 'all', label: 'Again' }] }))))
  check('a column of a table list still takes field and label only', /the rest need "rowsFrom"/.test(errs(fedList({ source: 'orders', columns: [{ field: 'a', label: 'A', sub: 'b' }] }))))
  check('a hover box needs an activity column', /set display to "activity"/.test(errs(fedList({ rowsFrom: 'orderList', actions: [], columns: [{ field: 'a', label: 'A', details: 'orderActivity' }] }))))
  check('"more" is for pictures', /only means something on an "images" column/.test(errs(fedList({ rowsFrom: 'orderList', actions: [], columns: [{ field: 'a', label: 'A', more: 'b' }] }))))
  check('a badge tone outside the list is refused', /tone must be one of/.test(errs(fedList({ rowsFrom: 'orderList', actions: [], columns: [{ field: 'a', label: 'A', badges: [{ field: 'x', label: 'X', tone: 'neon' }] }] }))))
  check('worked-out rows cannot be deleted', /cannot include "delete"/.test(errs(fedList({ rowsFrom: 'orderList', actions: ['delete'] }))))
  check('Edit on worked-out rows needs a screen to open', /Edit and New need "Edit in"/.test(errs(fedList({ rowsFrom: 'orderList', actions: ['edit'] }))))
  check('a row that opens on click needs a screen to open', /rowOpen needs "Edit in"/.test(errs(fedList({ rowsFrom: 'orderList', actions: [], rowOpen: true }))))
  check('a list may grow with its rows when it is the screen\'s one control', validateDocument(fedList({ rowsFrom: 'orderList', actions: [], grow: true })).ok)
  check('…and not beside anything else', (() => { const d = fedList({ rowsFrom: 'orderList', actions: [], grow: true }); return /only for a list that is the screen's one control/.test(errs(addControl(d, 'label').document)) })())
  check('refreshing more often than every 10 seconds is refused', /from 10 to 3600/.test(errs(fedList({ rowsFrom: 'orderList', actions: [], refreshEvery: 2 }))))
}

console.log('\nweb-only pages, for a menu to tag')
{
  const inv = { webOnly: [{ path: '/orders/:id', menu: 'Orders', reason: 'Tasks are hand-written' }, { path: '/orders/:id/x', menu: 'Orders', reason: 'second' }, { path: '/x' }] }
  const tags = webOnlyMenus(inv)
  check('a menu item whose page is web only is tagged with the first reason', tags.Orders === 'Tasks are hand-written' && Object.keys(tags).length === 1)
  check('routes in single quotes and braces are read too', routesIn(`<Route path='/a' element={<A />} /><Route path={"/b"} element={<B />} />`).join() === '/a,/b')
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
