import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FactoryBuilder, FactoryScreen, inputNodes } from '../src/index.js'
import listExample from '../examples/employee-list.screen.json'
import editExample from '../examples/employee-edit.screen.json'
import boardExample from '../examples/orders-board.screen.json'
import actionsExample from '../examples/order-actions.screen.json'
import './dev.css'

// A STAND-IN HOST, for trying the package on its own — laid out the way an app
// using it is: one entity ("employee") as TWO screens, each with a page to use
// it and a page to design it. Everything a real app supplies is faked here, in
// localStorage: the tables, the lookup rows, the saved records, and where the
// screen designs go. None of this is published.

const LOOKUPS = {
  departments: [
    { id: 1, name: 'Engineering' },
    { id: 2, name: 'Finance' },
    { id: 3, name: 'People' }
  ],
  locations: [
    { id: 'blr', name: 'Bengaluru' },
    { id: 'lon', name: 'London' }
  ]
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch (_) { return fallback } }
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value))

// What an app's API would be: one AJAX call per operation.
const api = {
  listTables: async () => [...Object.keys(LOOKUPS), 'employees'],
  fetchOptions: async ({ table }) => {
    await wait(120)
    if (!LOOKUPS[table]) throw new Error(`No table "${table}"`)
    return LOOKUPS[table]
  },
  fetchRecords: async ({ source }) => {
    await wait(120)
    return read('dev-records', {})[source] || []
  },
  // One record, as Edit opens it — @xeplr/factory runs the get hooks here.
  fetchRecord: async ({ id }) => {
    await wait(120)
    const row = (read('dev-records', {}).employees || []).find((r) => r.id === id)
    if (!row) throw new Error(`No record ${id}`)
    return row
  },
  // Creates when there is no id, updates when there is — and returns the saved
  // record, whose id the screen keeps for its next save.
  onSave: async (values, { id, source }) => {
    await wait(200)
    // Stands in for a save.before hook's ctx.reject(message, { field }) — a 422 with fields.
    if (values.firstName === 'Blocked') {
      throw Object.assign(new Error('Could not save'), { fields: [{ field: 'firstName', message: 'This name is not allowed' }] })
    }
    const store = read('dev-records', {})
    const rows = store[source] || []
    let saved
    if (id === null || id === undefined) {
      saved = { ...values, id: rows.reduce((m, r) => Math.max(m, r.id), 0) + 1 }
      rows.push(saved)
    } else {
      saved = { ...values, id }
      const i = rows.findIndex((r) => r.id === id)
      if (i === -1) rows.push(saved); else rows[i] = saved
    }
    store[source] = rows
    write('dev-records', store)
    return saved
  },
  onDelete: async ({ id, source }) => {
    await wait(120)
    const store = read('dev-records', {})
    store[source] = (store[source] || []).filter((r) => r.id !== id)
    write('dev-records', store)
  }
}

// ── the app's FUNCTIONS, as @xeplr/factory would run them ─────────────────
// Rows a function works out (with counts per chip), a cell's hover box, and a
// button's press — the server's half, faked over a few orders in localStorage.
const STATUSES = [{ value: 'ordered', label: 'Ordered' }, { value: 'packed', label: 'Packed' }, { value: 'shipped', label: 'Shipped' }, { value: 'delivered', label: 'Delivered' }]
const PIC = (hue) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="hsl(${hue},55%,62%)"/></svg>`)}`
const seedOrders = () => Array.from({ length: 14 }, (_, i) => ({
  id: 'o' + (i + 1), name: 'GA' + (1025 + i), customerName: ['Asha Rao', 'Vikram Shetty', 'Meera Iyer', 'Rohan Das'][i % 4],
  city: ['Pune', 'Mumbai', 'Delhi', 'Bengaluru'][i % 4], amount: 1200 + i * 375, customStatus: STATUSES[i % 3].value,
  paymentMethod: i % 3 === 0 ? 'COD' : 'Prepaid', placedHoursAgo: 3 + i * 7, seen: i > 3, cancelled: i === 6,
  items: Array.from({ length: 1 + (i % 5) }, (_, k) => ({ src: PIC((i * 40 + k * 70) % 360), name: 'Item ' + (k + 1) })),
  log: [{ text: 'Order placed', at: (3 + i * 7) + 'h ago' }]
}))
const orders = () => read('dev-orders', null) || seedOrders()
const statusLabel = (v) => (STATUSES.find((x) => x.value === v) || { label: v }).label
const ago = (h) => (h < 24 ? `${h}h` : `${Math.floor(h / 24)}d ${h % 24}h`)
const asRow = (o) => ({
  id: o.id, orderNumber: o.name, orderLabel: '#' + o.name, isNew: !o.seen, cancelled: o.cancelled,
  customerName: o.customerName, city: o.city, images: o.items.slice(0, 3), moreImages: Math.max(0, o.items.length - 3),
  customStatus: o.customStatus, statusLabel: statusLabel(o.customStatus), amount: o.amount, amountText: '₹' + o.amount.toLocaleString('en-IN'),
  ageMs: o.placedHoursAgo * 3600000, agingText: ago(o.placedHoursAgo), paymentMethod: o.paymentMethod,
  lastActivityAt: o.log[0].at, lastActivityText: o.log[0].text + ' · ' + o.log[0].at
})
const functionsApi = {
  listFunctions: async () => [
    { name: 'orderList', event: 'listRows', description: 'Every order, most urgent first', inputSchema: [] },
    { name: 'orderActivity', event: 'rowDetails', description: 'The order\'s latest timeline entries', inputSchema: [] },
    { name: 'setOrderStatus', event: 'button', description: 'Sets the order\'s status and posts who changed it', inputSchema: [{ name: 'status', type: 'string', required: true, options: STATUSES }, { name: 'note', type: 'string', required: false }] },
    { name: 'confirmCod', event: 'button', description: 'Confirms (or undoes) cash on delivery', inputSchema: [{ name: 'undo', type: 'boolean', required: false, default: false }, { name: 'note', type: 'string', required: false }] }
  ],
  fetchRows: async ({ q, filter }) => {
    await wait(150)
    const all = orders().filter((o) => !q || (o.name + ' ' + o.customerName + ' ' + o.city).toLowerCase().includes(q.toLowerCase().replace(/^#/, '')))
    const counts = Object.fromEntries([['all', all.length], ...STATUSES.map((s) => [s.value, all.filter((o) => o.customStatus === s.value).length])])
    const shown = filter && filter !== 'all' ? all.filter((o) => o.customStatus === filter) : all
    return { rows: shown.map(asRow), counts }
  },
  fetchRowDetails: async ({ id }) => {
    await wait(200)
    const o = orders().find((x) => x.id === id)
    return o ? o.log.map((e) => ({ text: e.text, at: e.at, open: { tab: 'comments' } })) : []
  },
  pressButton: async ({ button, id, note }) => {
    await wait(250)
    const all = orders()
    const o = all.find((x) => x.id === id)
    const doc = actionsExample
    const b = doc.nodes.flatMap((n) => n.props.buttons || []).find((x) => x.id === button)
    if (!o || !b) throw new Error('Not found')
    if (b.action === 'setOrderStatus') o.customStatus = b.params.status
    if (b.action === 'confirmCod') o.paymentMethod = b.params.undo ? 'COD' : 'COD Confirmed'
    o.log.unshift({ text: `${b.label}${note ? ' — ' + note : ''}`, at: 'Just now' })
    write('dev-orders', all)
    return { message: `#${o.name}: ${b.label}` }
  }
}

const designKey = (id) => `dev-screen:${id}`
const loadDesign = (example) => read(designKey(example.id), example)

const MENU = [
  { key: 'screen-list', group: 'Screen', label: 'List' },
  { key: 'screen-edit', group: 'Screen', label: 'Edit' },
  { key: 'design-list', group: 'Designer', label: 'List' },
  { key: 'design-edit', group: 'Designer', label: 'Edit' },
  { key: 'screen-orders', group: 'Screen', label: 'Orders' },
  { key: 'design-orders', group: 'Designer', label: 'Orders' },
  { key: 'design-buttons', group: 'Designer', label: 'Buttons' }
]

/** Orders: the board, and the order a row opens with its buttons — as an app would lay them out. */
function OrdersPage({ board, actions }) {
  const [open, setOpen] = useState(null)
  const [round, setRound] = useState(0)
  const order = open ? orders().find((o) => o.id === open) : null
  return (
    <div className="dev-run">
      {order && (
        <section className="dev-order" aria-label={'Order ' + order.name}>
          <header><strong>#{order.name}</strong> {order.customerName} · {statusLabel(order.customStatus)} · {order.paymentMethod}
            <button type="button" onClick={() => setOpen(null)}>Close</button></header>
          <FactoryScreen key={open} document={actions} record={asRow(order)} {...functionsApi} onButtonDone={() => setRound((r) => r + 1)} />
        </section>
      )}
      <FactoryScreen document={board} {...functionsApi} urlKey="orders" reloadKey={round}
                     onOpenRecord={({ id }) => { setOpen(id); const all = orders(); const o = all.find((x) => x.id === id); if (o) { o.seen = true; write('dev-orders', all) } setRound((r) => r + 1) }} />
    </div>
  )
}

function App() {
  const [page, setPage] = useState('screen-list')
  const [designs, setDesigns] = useState(() => ({ [listExample.id]: loadDesign(listExample), [editExample.id]: loadDesign(editExample), [boardExample.id]: loadDesign(boardExample), [actionsExample.id]: loadDesign(actionsExample) }))

  const listDoc = designs[listExample.id]
  const editDoc = designs[editExample.id]
  const saveDesign = async (doc) => {
    await wait(150)
    write(designKey(doc.id), doc)
    setDesigns((d) => ({ ...d, [doc.id]: doc }))
  }
  // Stand-in for @xeplr/factory's publish: a version number, and the fields
  // that are now "columns" — which the designer then shows as locked.
  const [published, setPublished] = useState(() => read('dev-published', {}))
  const publish = async (doc, { confirmDrop = [] } = {}) => {
    await wait(200)
    // Like @xeplr/factory: a field that was a column and is gone would drop it —
    // asked first, with how many saved values it holds.
    const had = (published[doc.id] && published[doc.id].columns) || []
    const fields = inputNodes(doc).map((n) => n.props.name)
    const dropping = had.filter((c) => !fields.includes(c))
    const unconfirmed = dropping.filter((c) => !confirmDrop.includes(c))
    if (unconfirmed.length) {
      const rows = read('dev-records', {})[doc.source] || []
      const err = new Error(`Publishing removes ${dropping.length} column(s) with all their data`)
      err.confirm = dropping.map((c) => ({ column: c, records: rows.filter((r) => r[c] !== undefined && r[c] !== null && r[c] !== '').length }))
      throw err
    }
    const next = { ...published, [doc.id]: { version: ((published[doc.id] && published[doc.id].version) || 0) + 1, columns: inputNodes(doc).map((n) => n.props.name) } }
    write('dev-published', next)
    setPublished(next)
    return { version: next[doc.id].version }
  }
  const locked = (doc) => (published[doc.id] ? published[doc.id].columns : [])
  const screenChoices = [
    { id: listDoc.id, name: listDoc.name, document: listDoc },
    { id: editDoc.id, name: editDoc.name, document: editDoc },
    { id: actionsExample.id, name: actionsExample.name, document: designs[actionsExample.id] }
  ]

  return (
    <div className="dev-shell">
      <nav className="dev-menu" aria-label="Pages">
        <strong>Employees · Orders</strong>
        {['Screen', 'Designer'].map((group) => (
          <span key={group} className="dev-menu-group">
            <span className="dev-menu-label">{group}</span>
            {MENU.filter((m) => m.group === group).map((m) => (
              <button key={m.key} type="button" aria-pressed={page === m.key} onClick={() => setPage(m.key)}>{m.label}</button>
            ))}
          </span>
        ))}
        <button type="button" className="dev-reset" onClick={() => { localStorage.clear(); setPublished({}); setDesigns({ [listExample.id]: listExample, [editExample.id]: editExample, [boardExample.id]: boardExample, [actionsExample.id]: actionsExample }) }}>Reset</button>
      </nav>

      {page === 'screen-list' && (
        <div className="dev-run">
          <FactoryScreen document={listDoc} screens={{ [editDoc.id]: editDoc }} {...api} />
        </div>
      )}
      {page === 'screen-edit' && (
        <div className="dev-run">
          <FactoryScreen document={editDoc} {...api} />
        </div>
      )}
      {page === 'design-list' && (
        // {...api} FIRST: its onSave saves records; a builder's onSave saves the design.
        <FactoryBuilder key="design-list" {...api} document={listDoc} onSave={saveDesign} onPublish={publish} screens={screenChoices} />
      )}
      {page === 'screen-orders' && <OrdersPage board={designs[boardExample.id]} actions={designs[actionsExample.id]} />}
      {page === 'design-orders' && (
        <FactoryBuilder key="design-orders" {...functionsApi} document={designs[boardExample.id]} onSave={saveDesign} onPublish={publish} screens={screenChoices} />
      )}
      {page === 'design-buttons' && (
        <FactoryBuilder key="design-buttons" {...functionsApi} document={designs[actionsExample.id]} onSave={saveDesign} onPublish={publish} screens={screenChoices} />
      )}
      {page === 'design-edit' && (
        <FactoryBuilder key="design-edit" {...api} document={editDoc} onSave={saveDesign} onPublish={publish} lockedNames={locked(editDoc)} screens={screenChoices} />
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
