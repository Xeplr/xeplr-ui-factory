// A ROW'S "…" ENTRY THAT RUNS A FUNCTION — rowMenu { action: "run" }: a
// button on that row's record (Receive on a movement, from the list). What a
// screen may say, that the server finds it as any button, what publishing
// checks, and which rows offer it.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { validateDocument, createScreen, addControl, setNodeProperty, nodeFunctions, buttonById, screenButtons, menuItemsFor, rowMenuButton } from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)

const RECEIVE = { label: 'Receive', action: 'run', id: 'receive', run: 'receiveMovementItems',
  ask: { title: 'Products back', fields: [{ name: 'back', label: 'Came back fine', type: 'checklist', optionsFrom: 'movementItemsOut' }] },
  when: [{ field: 'status', op: 'eq', value: 'open' }] }

function list(menu, props) {
  let doc = createScreen({ id: 'movement_list', name: 'Movements', source: 'movements' })
  const added = addControl(doc, 'list')
  doc = added.document
  Object.entries({ title: 'Movements', rowsFrom: 'movementList', actions: [], columns: [{ field: 'number', label: 'Movement' }], rowMenu: menu, ...(props || {}) })
    .forEach(([k, v]) => { doc = setNodeProperty(doc, added.node.id, 'props.' + k, v) })
  return doc
}

console.log('what a screen may say')
{
  check('a run entry beside link and copy: a screen', errs(list([RECEIVE, { label: 'Copy number', action: 'copy', field: 'number' }])).length === 0, errs(list([RECEIVE])).join('; '))
  check('run needs rows a function works out', errs(list([RECEIVE], { rowsFrom: undefined, source: 'movements' })).some((e) => /"run" is for rows a function works out/.test(e)))
  check('run must name a function', errs(list([{ ...RECEIVE, run: 'not a name' }])).some((e) => /rowMenu\[0\]\.run: must be the name of a registered function/.test(e)))
  check('its id must be unique on the screen', (() => {
    let doc = list([RECEIVE])
    const b = addControl(doc, 'buttons'); doc = setNodeProperty(b.document, b.node.id, 'props.buttons', [{ id: 'receive', label: 'R', action: 'x' }])
    return errs(doc).some((e) => /"receive" is already the id/.test(e))
  })())
  check('a key a run entry does not use: refused', errs(list([{ ...RECEIVE, field: 'number' }])).some((e) => /field: is for link and copy|remove: field/.test(e)))
  check('its ask is checked as a button\'s', errs(list([{ ...RECEIVE, ask: { fields: [{ name: 'x', label: 'X', type: 'nope' }] } }])).some((e) => /rowMenu\[0\]\.ask\.fields\[0\]\.type/.test(e)))
}

console.log('the server finds it, and publishing checks its functions')
{
  const doc = list([RECEIVE])
  const found = buttonById(doc, 'receive')
  check('found by its id, as a button', found && found.button.action === 'receiveMovementItems' && found.button.ask && found.button.when)
  check('one of the screen\'s buttons', screenButtons(doc).length === 1)
  const fns = nodeFunctions(doc).map((f) => f.event + ':' + f.name)
  check('its function and its checklist\'s are asked for at publish', fns.includes('button:receiveMovementItems') && fns.includes('buttonOptions:movementItemsOut'), fns.join(', '))
  check('the entry as a button', JSON.stringify(rowMenuButton(RECEIVE).when) === JSON.stringify(RECEIVE.when) && rowMenuButton({ action: 'copy' }) === null)
}

console.log('which rows offer it')
{
  check('an open movement: offered', menuItemsFor({ id: 'm1', status: 'open' }, [RECEIVE], false).length === 1)
  check('a closed one: not', menuItemsFor({ id: 'm2', status: 'closed' }, [RECEIVE], false).length === 0)
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
