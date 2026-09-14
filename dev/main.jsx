import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FactoryBuilder, FactoryScreen, inputNodes } from '../src/index.js'
import listExample from '../examples/employee-list.screen.json'
import editExample from '../examples/employee-edit.screen.json'
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
  // Creates when there is no id, updates when there is — and returns the saved
  // record, whose id the screen keeps for its next save.
  onSave: async (values, { id, source }) => {
    await wait(200)
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

const designKey = (id) => `dev-screen:${id}`
const loadDesign = (example) => read(designKey(example.id), example)

const MENU = [
  { key: 'screen-list', group: 'Screen', label: 'List' },
  { key: 'screen-edit', group: 'Screen', label: 'Edit' },
  { key: 'design-list', group: 'Designer', label: 'List' },
  { key: 'design-edit', group: 'Designer', label: 'Edit' }
]

function App() {
  const [page, setPage] = useState('screen-list')
  const [designs, setDesigns] = useState(() => ({ [listExample.id]: loadDesign(listExample), [editExample.id]: loadDesign(editExample) }))

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
    { id: editDoc.id, name: editDoc.name, document: editDoc }
  ]

  return (
    <div className="dev-shell">
      <nav className="dev-menu" aria-label="Pages">
        <strong>Employees</strong>
        {['Screen', 'Designer'].map((group) => (
          <span key={group} className="dev-menu-group">
            <span className="dev-menu-label">{group}</span>
            {MENU.filter((m) => m.group === group).map((m) => (
              <button key={m.key} type="button" aria-pressed={page === m.key} onClick={() => setPage(m.key)}>{m.label}</button>
            ))}
          </span>
        ))}
        <button type="button" className="dev-reset" onClick={() => { localStorage.clear(); setPublished({}); setDesigns({ [listExample.id]: listExample, [editExample.id]: editExample }) }}>Reset</button>
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
      {page === 'design-edit' && (
        <FactoryBuilder key="design-edit" {...api} document={editDoc} onSave={saveDesign} onPublish={publish} lockedNames={locked(editDoc)} screens={screenChoices} />
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
