// createFactoryApi with both kinds of fetch an app has: window.fetch (a
// Response) and @xeplr/ui-account's authFetch (the parsed body; throws with
// err.status and err.body).
import { createFactoryApi } from '../src/remote.js'

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }

const REPLIES = {
  'GET /factory/records/task_list': [200, { dataArray: [{ id: 'a', title: 'One' }] }],
  'POST /factory/records/task_edit/save': [422, { message: 'Title is required', error: { fields: [{ field: 'title', message: 'Title is required' }] }, dataArray: [] }],
  'POST /factory/entities': [200, { dataArray: [{ entity: 'crop', name: 'Crops', source: 'crops', edit: 'crop_edit', list: 'crop_list' }] }],
  'POST /factory/screens/task_edit/publish': [409, { message: 'Confirm', dataArray: [{ confirm: [{ column: 'notes', records: 2 }], keep: [] }] }],
  'GET /factory/rows/orders_board?node=list1&q=GA%2010&filter=packed': [200, { dataArray: [{ rows: [{ id: 'o1' }], counts: { all: 1 } }] }],
  'GET /factory/rows/orders_board/details?node=list1&column=lastActivityAt&id=o1': [200, { dataArray: [{ text: 'Packed' }] }],
  'POST /factory/buttons/order_actions/packed': [200, { dataArray: [{ button: 'packed', message: 'Order GA1 is now packed' }] }]
}
const sent = []
const reply = (url, opts) => { sent.push(opts && opts.body); return REPLIES[`${(opts && opts.method) || 'GET'} ${url.replace(/^\/api/, '')}`] }

// window.fetch-like
const responseFetch = async (url, opts) => {
  const [status, body] = reply(url, opts)
  return { ok: status < 400, status, json: async () => body }
}
// authFetch-like: parsed body; throws an Error with status and body
const authFetchLike = async (url, opts) => {
  const [status, body] = reply(url, opts)
  if (status >= 400) throw Object.assign(new Error(body.message), { status, body })
  return body
}

for (const [label, doFetch] of [['a Response fetch', responseFetch], ['authFetch', authFetchLike]]) {
  console.log(`\n${label}`)
  const api = createFactoryApi({ fetch: doFetch, base: '/api' })
  check('a new form comes back with its screen ids', (await api.createEntity({ entity: 'crop' })).edit === 'crop_edit')
  const fed = await api.fetchRows({ screen: 'orders_board', node: 'list1', q: 'GA 10', filter: 'packed' })
  check('a function-fed list: rows and counts, with only the search and chip sent', fed.rows[0].id === 'o1' && fed.counts.all === 1)
  check('a hover box\'s entries', (await api.fetchRowDetails({ screen: 'orders_board', node: 'list1', column: 'lastActivityAt', id: 'o1' }))[0].text === 'Packed')
  const pressed = await api.pressButton({ screen: 'order_actions', button: 'packed', id: 'o1', note: 'late' })
  check('a press: the message, and only the id and the note sent', pressed.message === 'Order GA1 is now packed' && sent[sent.length - 1] === JSON.stringify({ id: 'o1', note: 'late' }))
  await api.pressButton({ screen: 'order_actions', button: 'packed', id: 'o1' })
  check('...no note: none sent', sent[sent.length - 1] === JSON.stringify({ id: 'o1' }))
  check('the screen gets the three calls, the builder the function list', typeof api.screenProps.fetchRows === 'function' && typeof api.screenProps.pressButton === 'function' && typeof api.screenProps.fetchRowDetails === 'function' && typeof api.builderProps.listFunctions === 'function')
  const rows = await api.fetchRecords({ screen: 'task_list' })
  check('records come back as rows', rows.length === 1 && rows[0].title === 'One')
  try {
    await api.onSave({}, { id: null, screen: 'task_edit' })
    check('a refused save throws', false)
  } catch (err) {
    check('a refused save throws with the fields for the form', err.status === 422 && err.fields[0].field === 'title' && err.message === 'Title is required')
  }
  try {
    await api.publish({ id: 'task_edit' })
    check('a publish that would drop a column throws', false)
  } catch (err) {
    check('...with the columns to confirm', err.status === 409 && err.confirm[0].column === 'notes')
  }
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
