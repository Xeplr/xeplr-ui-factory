import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FactoryBuilder, FactoryScreen } from '../src/index.js'
import example from '../examples/new-employee.screen.json'
import './dev.css'

// A STAND-IN HOST, for trying the package on its own. Everything a real app
// supplies is faked here, in memory and localStorage: the tables, the rows a
// dropdown reads, the records a screen saves, and where a screen design goes.
// None of this is published.

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
const readStore = () => { try { return JSON.parse(localStorage.getItem('xeplr-factory-dev-records')) || {} } catch (_) { return {} } }
const writeStore = (s) => localStorage.setItem('xeplr-factory-dev-records', JSON.stringify(s))

// What an app's API would be: AJAX calls, one per operation.
const api = {
  listTables: async () => [...Object.keys(LOOKUPS), 'employees'],
  fetchOptions: async ({ table }) => {
    await wait(150)
    if (!LOOKUPS[table]) throw new Error(`No table "${table}"`)
    return LOOKUPS[table]
  },
  fetchRecords: async ({ source }) => {
    await wait(150)
    return readStore()[source] || []
  },
  // Creates when there is no id yet, updates when there is — and returns the
  // saved record, whose id the screen keeps for the next save.
  saveRecord: async (values, { id, source }) => {
    await wait(250)
    const store = readStore()
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
    writeStore(store)
    return saved
  },
  deleteRecord: async ({ id, source }) => {
    await wait(150)
    const store = readStore()
    store[source] = (store[source] || []).filter((r) => r.id !== id)
    writeStore(store)
  }
}

function loadDesign() {
  try { return JSON.parse(localStorage.getItem('xeplr-factory-dev')) || example } catch (_) { return example }
}

function App() {
  const [design, setDesign] = useState(loadDesign)
  const [tab, setTab] = useState('build')
  const [saves, setSaves] = useState(0)

  return (
    <div className="dev-shell">
      <nav className="dev-tabs">
        <strong>@xeplr/ui-factory</strong>
        <button type="button" aria-pressed={tab === 'build'} onClick={() => setTab('build')}>Builder</button>
        <button type="button" aria-pressed={tab === 'run'} onClick={() => setTab('run')}>Screen</button>
        <button type="button" onClick={() => { localStorage.removeItem('xeplr-factory-dev'); localStorage.removeItem('xeplr-factory-dev-records'); setDesign(example) }}>Reset example</button>
        <span className="dev-note">design saves: {saves}</span>
      </nav>

      {tab === 'build' ? (
        <FactoryBuilder
          document={design}
          listTables={api.listTables}
          fetchOptions={api.fetchOptions}
          fetchRecords={api.fetchRecords}
          onSave={async (doc) => {
            await wait(200)
            localStorage.setItem('xeplr-factory-dev', JSON.stringify(doc))
            setSaves((n) => n + 1)
          }}
        />
      ) : (
        <div className="dev-run">
          <FactoryScreen
            document={loadDesign()}
            fetchOptions={api.fetchOptions}
            fetchRecords={api.fetchRecords}
            onSave={api.saveRecord}
            onDelete={api.deleteRecord}
          />
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
