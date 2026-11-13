// A CHECKLIST in a button's popup — entries worked out for the record by a
// function (event "buttonOptions") — what a screen may say, what publishing
// checks, what a function's answer becomes and what a press may send.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import {
  validateDocument, createScreen, addControl, setNodeProperty, functionProblems, nodeFunctions,
  askFieldValues, askFieldStart, checklistOptionsOf, checklistFields, paramProblems,
  BUTTON_OPTIONS_EVENT, MAX_CHECKLIST_OPTIONS, ASK_FIELD_TYPES
} from '../src/model.js'
import { createFactoryApi } from '../src/remote.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const RECEIVE = (fields) => ({
  id: 'receive', label: 'Receive', action: 'receiveMovementItems',
  ask: { title: 'Products back', note: 'Note (optional)', fields: fields || [
    { name: 'back', label: 'Came back fine', type: 'checklist', optionsFrom: 'movementItemsOut' },
    { name: 'broken', label: 'Came back broken', type: 'checklist', optionsFrom: 'movementItemsOut', max: 3 }
  ] }
})
function screen(button) {
  let doc = createScreen({ id: 'movement_actions', name: 'Movement', source: 'movements' })
  const added = addControl(doc, 'buttons')
  return setNodeProperty(added.document, added.node.id, 'props.buttons', [button])
}

console.log('what a screen may say')
{
  check('a kind of ask field', ASK_FIELD_TYPES.includes('checklist'))
  check('two checklists from one function: valid', errs(screen(RECEIVE())).length === 0, errs(screen(RECEIVE())).join('; '))
  check('without optionsFrom: refused, saying which event', errs(screen(RECEIVE([{ name: 'back', label: 'Back', type: 'checklist' }]))).some((e) => /optionsFrom: .*buttonOptions/.test(e)))
  check('min / max: whole numbers, min not above max', errs(screen(RECEIVE([{ name: 'b', label: 'B', type: 'checklist', optionsFrom: 'f', min: 1.5 }]))).some((e) => /min/.test(e)) &&
    errs(screen(RECEIVE([{ name: 'b', label: 'B', type: 'checklist', optionsFrom: 'f', min: 3, max: 2 }]))).some((e) => /min: is more than max/.test(e)))
  check('unit or fill on a checklist: refused', errs(screen(RECEIVE([{ name: 'b', label: 'B', type: 'checklist', optionsFrom: 'f', unit: 'kg', fill: 'x' }]))).filter((e) => /unit|fill/.test(e)).length >= 2)
  check('optionsFrom on a number: refused', errs(screen(RECEIVE([{ name: 'b', label: 'B', type: 'number', optionsFrom: 'f' }]))).some((e) => /optionsFrom: is for a checklist/.test(e)))
}

console.log('what publishing checks')
{
  const doc = screen(RECEIVE())
  const named = nodeFunctions(doc).filter((f) => f.event === BUTTON_OPTIONS_EVENT)
  check('each checklist names its function, under buttonOptions', named.length === 2 && named[0].name === 'movementItemsOut' && /ask\.fields\[0\]\.optionsFrom/.test(named[0].at))
  const takes = [{ name: 'back', type: 'array' }, { name: 'broken', type: 'array' }, { name: 'note', type: 'string' }]
  const ok = [{ name: 'receiveMovementItems', event: 'button', inputSchema: takes }, { name: 'movementItemsOut', event: 'buttonOptions' }]
  check('registered as they should be: nothing to say', functionProblems(doc, ok).length === 0, JSON.stringify(functionProblems(doc, ok)))
  check('optionsFrom not registered: refused', functionProblems(doc, [ok[0]]).some((p) => /movementItemsOut" is not a registered function/.test(p.problem)))
  check('registered for another event: refused', functionProblems(doc, [ok[0], { name: 'movementItemsOut', event: 'listRows' }]).some((p) => /not "buttonOptions"/.test(p.problem)))
  check('the button\'s function must take it as a list', paramProblems(RECEIVE(), [{ name: 'back', type: 'string' }, { name: 'broken', type: 'array' }, { name: 'note', type: 'string' }]).some((p) => /"back" as a list of ticked ids, but it takes string/.test(p)))
}

console.log('what a function answers')
{
  const list = checklistOptionsOf([{ id: 'i1', label: ' Silver Horse ', sub: '×2', image: 'https://cdn/h.jpg' }, { id: 7 }, { id: 'i1', label: 'again' }, { label: 'no id' }, null, { id: ' ' }])
  check('entries with an id, once each; label falls back to the id', same(list, [{ id: 'i1', label: 'Silver Horse', sub: '×2', image: 'https://cdn/h.jpg' }, { id: '7', label: '7' }]))
  check('not a list: none', same(checklistOptionsOf(null), []) && same(checklistOptionsOf({}), []))
  check('at most ' + MAX_CHECKLIST_OPTIONS, checklistOptionsOf(Array.from({ length: 250 }, (_, i) => ({ id: i }))).length === MAX_CHECKLIST_OPTIONS)
  check('which fields are checklists', same(checklistFields(RECEIVE()).map((f) => f.name), ['back', 'broken']))
  check('a checklist starts with nothing ticked', same(askFieldStart(RECEIVE().ask.fields[0], { back: 'x' }), []))
}

console.log('what a press may send')
{
  const offered = { back: ['i1', 'i2'], broken: ['i1', 'i2'] }
  const out = askFieldValues(RECEIVE(), { back: ['i1', 'i1', ' i2 '], broken: [] }, undefined, offered)
  check('the ids ticked, once each', same(out.values, { back: ['i1', 'i2'], broken: [] }) && !out.errors.length, JSON.stringify(out))
  const stray = askFieldValues(RECEIVE(), { back: ['i9'] }, undefined, offered)
  check('an id the function did not offer: refused', stray.errors.length === 1 && /no longer offered/.test(stray.errors[0].message))
  check('not a list: refused', /must be a list/.test(askFieldValues(RECEIVE(), { back: 'i1' }, undefined, offered).errors[0].message))
  const req = RECEIVE([{ name: 'back', label: 'Back', type: 'checklist', optionsFrom: 'f', required: true, min: 2 }])
  check('required: at least one', /tick at least one/.test(askFieldValues(req, {}, undefined, { back: ['a'] }).errors[0].message))
  check('min', /tick at least 2/.test(askFieldValues(req, { back: ['a'] }, undefined, { back: ['a', 'b'] }).errors[0].message))
  check('max', /tick at most 3/.test(askFieldValues(RECEIVE(), { broken: ['a', 'b', 'c', 'd'] }, undefined, { broken: ['a', 'b', 'c', 'd'] }).errors[0].message))
  check('offers unknown (in the dialog before they load): only the shape is checked', same(askFieldValues(RECEIVE(), { back: ['z'] }).values.back, ['z']))
}

console.log('the host')
{
  const asked = []
  const api = createFactoryApi({ base: '/api', fetch: async (url) => { asked.push(url); return { dataArray: [{ id: 'i1', label: 'Horse' }] } } })
  const got = await api.buttonOptions({ screen: 'movement_actions', button: 'receive', id: 'm1', field: 'back' })
  check('GET /factory/buttons/<screen>/<button>/options with the record and the field', asked[0] === '/api/factory/buttons/movement_actions/receive/options?id=m1&field=back', asked[0])
  check('answers the entries', got.length === 1 && got[0].id === 'i1')
  check('a FactoryScreen gets it', typeof api.screenProps.buttonOptions === 'function')
  const empty = createFactoryApi({ fetch: async () => ({ dataArray: null }) })
  check('nothing back: none', same(await empty.buttonOptions({ screen: 's', button: 'b', id: '1', field: 'f' }), []))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
