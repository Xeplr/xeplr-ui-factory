import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FactoryBuilder, FactoryScreen } from '../src/index.js'
import example from '../examples/new-employee.screen.json'
import './dev.css'

// A STAND-IN HOST, for trying the package on its own. Everything a real app
// supplies is faked here in memory: the table list, the rows a table dropdown
// reads, and where a saved screen goes. None of this is published.

const TABLES = {
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

const host = {
  listTables: async () => Object.keys(TABLES),
  fetchOptions: async ({ table }) => {
    await new Promise((r) => setTimeout(r, 250))
    if (!TABLES[table]) throw new Error(`No table "${table}"`)
    return TABLES[table]
  }
}

function load() {
  try { return JSON.parse(localStorage.getItem('xeplr-factory-dev')) || example } catch (_) { return example }
}

function App() {
  const [saved, setSaved] = useState(load)
  const [tab, setTab] = useState('build')
  const [submitted, setSubmitted] = useState(null)

  return (
    <div className="dev-shell">
      <nav className="dev-tabs">
        <strong>@xeplr/ui-factory</strong>
        <button type="button" aria-pressed={tab === 'build'} onClick={() => setTab('build')}>Builder</button>
        <button type="button" aria-pressed={tab === 'run'} onClick={() => setTab('run')}>Saved screen</button>
        <button type="button" onClick={() => { localStorage.removeItem('xeplr-factory-dev'); setSaved(example) }}>Reset example</button>
      </nav>

      {tab === 'build' ? (
        <FactoryBuilder
          document={saved}
          listTables={host.listTables}
          fetchOptions={host.fetchOptions}
          onSave={async (doc) => {
            localStorage.setItem('xeplr-factory-dev', JSON.stringify(doc))
            setSaved(doc)
          }}
        />
      ) : (
        <div className="dev-run">
          <FactoryScreen document={saved} fetchOptions={host.fetchOptions} onSubmit={async (values) => setSubmitted(values)} />
          {submitted && <pre className="dev-submitted">{JSON.stringify(submitted, null, 2)}</pre>}
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
