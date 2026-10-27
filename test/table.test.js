// A table on a screen: rows the workflow hands it, a tick per row, and the
// ticked rows as its value — and a run's buttons reaching the workflow.
import { CONTROLS, createScreen, addControl, setNodeProperty, initialValues, parseInput, validateValues, columnForField, tableForScreen, resolveBinding } from '../src/model.js'
import { tableColumns } from '../src/controls.js'
import { createFlowsApi } from '../src/flows.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + JSON.stringify(detail) : '')) }

console.log('\na table on a screen')
check('a Data control that takes input, as a list', CONTROLS.table.group === 'Data' && CONTROLS.table.input === true && CONTROLS.table.valueType === 'array')
let doc = createScreen({ name: 'Review the unmatched' })
const added = addControl(doc, 'table')
doc = added.document
const node = doc.nodes.find((n) => n.type === 'table')
doc = setNodeProperty(doc, node.id, 'props.name', 'selected')
doc = setNodeProperty(doc, node.id, 'props.rows', '{params.lines}')
const tableNode = doc.nodes.find((n) => n.type === 'table')
const lines = [{ ref: 'A1', amount: 500 }, { ref: 'A2', amount: 20 }]
check('its rows are a binding to the screen\'s inputs', JSON.stringify(resolveBinding(tableNode.props.rows, { lines })) === JSON.stringify(lines))
check('nothing is ticked to begin with', JSON.stringify(initialValues(doc, {})) .includes('"selected":[]'), initialValues(doc, {}))
check('the value is the rows ticked', JSON.stringify(parseInput(tableNode, [lines[0]])) === JSON.stringify([lines[0]]) && JSON.stringify(parseInput(tableNode, 'x')) === '[]')
check('columns: its own list, in order, else every key of the first row',
  tableColumns({ columns: 'amount, ref' }, lines).join() === 'amount,ref' && tableColumns({}, lines).join() === 'ref,amount' && tableColumns({}, []).length === 0)
check('it adds no column to a table', columnForField(tableNode) === null)
const required = setNodeProperty(doc, tableNode.id, 'props.required', true)
check('required means at least one ticked', Boolean(validateValues(required, { selected: [] }).selected) && !validateValues(required, { selected: [lines[0]] }).selected, validateValues(required, { selected: [] }))
const atMost = setNodeProperty(doc, tableNode.id, 'props.validation.maxItems', 1)
check('...and "tick at most" holds', Boolean(validateValues(atMost, { selected: lines }).selected))

console.log('\nthe button pressed reaches the workflow')
const sent = []
const fetchImpl = async (url, init) => { sent.push({ url, body: init && init.body ? JSON.parse(init.body) : null }); return { ok: true, status: 200, json: async () => ({ status: 'done' }), text: async () => '{"status":"done"}' } }
const api = createFlowsApi({ base: '/workflow', fetch: fetchImpl })
await api.submitRun('r1', { selected: [lines[0]] }, null, 'approve')
check('submit carries the action with the values', sent[0] && sent[0].url.endsWith('/runs/r1/submit') && sent[0].body.action === 'approve' && sent[0].body.values.selected.length === 1, sent[0])
await api.submitRun('r2', { a: 1 })
check('...and none when there are no buttons', sent[1] && !('action' in sent[1].body), sent[1])
await api.waiting()
check('the waiting list is asked of /waiting', sent[2] && sent[2].url.endsWith('/flows/waiting'), sent[2])

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
