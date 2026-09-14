import { getAtPath } from '../propertyPath.js'
import { slugify } from '../document.js'

// The selected control's properties, GENERATED from its entry in controls.js:
// each field there names a path and an editor type, and this file owns only
// what each editor type looks like. A new property is a line in controls.js.

export default function PropertyPanel({ node, control, errors, tables, onChange, onRemove, selectionCount }) {
  if (selectionCount > 1) {
    return (
      <aside className="xeplr-factory-panel">
        <p className="xeplr-factory-panel-empty">{selectionCount} controls selected</p>
        <button type="button" className="xeplr-factory-danger" onClick={onRemove}>Delete them</button>
      </aside>
    )
  }
  if (!node || !control) {
    return (
      <aside className="xeplr-factory-panel">
        <p className="xeplr-factory-panel-empty">
          Select a control to set its label, validation and options — or drag one in from the left.
        </p>
      </aside>
    )
  }

  const nodeErrors = errors || []
  const errorsFor = (path) => nodeErrors.filter((e) => e.field === path || e.field.startsWith(path + '.') || e.field.startsWith(path + '['))
  const shown = new Set()

  return (
    <aside className="xeplr-factory-panel" aria-label={`${control.label} properties`}>
      <header className="xeplr-factory-panel-head">
        <span className="xeplr-factory-panel-type">{control.label}</span>
        <button type="button" className="xeplr-factory-link-danger" onClick={onRemove} title="Delete (Del)">Delete</button>
      </header>

      {control.properties.map((group) => (
        <fieldset key={group.key} className="xeplr-factory-group">
          <legend>{group.title}</legend>
          {group.fields.map((field) => {
            const errs = errorsFor(field.path)
            errs.forEach((e) => shown.add(e))
            const Editor = EDITORS[field.type] || TextEditor
            const id = `xf-prop-${node.id}-${field.path.replace(/\W+/g, '-')}`
            return (
              <div key={field.path} className={`xeplr-factory-prop${errs.length ? ' has-error' : ''}`}>
                {field.type !== 'toggle' && <label className="xeplr-factory-prop-label" htmlFor={id}>{field.label}</label>}
                <Editor
                  id={id}
                  field={field}
                  value={getAtPath(node, field.path)}
                  onChange={(v) => onChange(field.path, v)}
                  tables={tables}
                  node={node}
                  errors={errs}
                />
                {field.help && <div className="xeplr-factory-prop-help">{field.help}</div>}
                {errs.filter((e) => e.field === field.path).map((e, i) => (
                  <div key={i} className="xeplr-factory-prop-error">{e.message}</div>
                ))}
              </div>
            )
          })}
        </fieldset>
      ))}

      {/* Anything the checker found that no editor above owns — geometry, a
          property the panel does not offer. Shown rather than dropped: a save
          that fails for a reason nowhere on screen is the worst kind. */}
      {nodeErrors.filter((e) => !shown.has(e)).length > 0 && (
        <div className="xeplr-factory-panel-errors" role="alert">
          {nodeErrors.filter((e) => !shown.has(e)).map((e, i) => (
            <div key={i}><code>{e.field || e.path}</code> {e.message}</div>
          ))}
        </div>
      )}
    </aside>
  )
}

function TextEditor({ id, value, onChange }) {
  return <input id={id} className="xeplr-factory-prop-input" type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

function TextareaEditor({ id, value, onChange }) {
  return <textarea id={id} className="xeplr-factory-prop-input" rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

function NumberEditor({ id, value, onChange }) {
  return (
    <input
      id={id}
      className="xeplr-factory-prop-input"
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value
        onChange(raw === '' ? undefined : Number(raw))
      }}
    />
  )
}

function DateEditor({ id, value, onChange }) {
  return <input id={id} className="xeplr-factory-prop-input" type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

function ToggleEditor({ id, field, value, onChange }) {
  return (
    <label className="xeplr-factory-toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked ? true : undefined)} />
      <span>{field.label}</span>
    </label>
  )
}

function SelectEditor({ id, field, value, onChange }) {
  return (
    <select id={id} className="xeplr-factory-prop-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/**
 * A dropdown's options: typed in here, or read from a table. Either way each
 * option is { id, name } — the id is saved, the name is shown.
 */
function DataSourceEditor({ id, value, onChange, tables, errors }) {
  const data = value || { source: 'static', options: [] }
  const setSource = (source) => {
    if (source === data.source) return
    onChange(source === 'table' ? { source: 'table', table: '' } : { source: 'static', options: [] })
  }
  const errorAt = (suffix) => errors.filter((e) => e.field.endsWith(suffix)).map((e) => e.message)[0]

  return (
    <div className="xeplr-factory-datasource" id={id}>
      <div className="xeplr-factory-segment" role="radiogroup" aria-label="Options come from">
        <button type="button" role="radio" aria-checked={data.source === 'static'} className={data.source === 'static' ? 'is-on' : ''} onClick={() => setSource('static')}>Fixed list</button>
        <button type="button" role="radio" aria-checked={data.source === 'table'} className={data.source === 'table' ? 'is-on' : ''} onClick={() => setSource('table')}>From a table</button>
      </div>

      {data.source === 'table' ? (
        <div className="xeplr-factory-table-pick">
          {tables && tables.items.length > 0 ? (
            <select
              className="xeplr-factory-prop-input"
              value={data.table || ''}
              onChange={(e) => onChange({ source: 'table', table: e.target.value })}
              aria-label="Table"
            >
              <option value="">{tables.loading ? 'Loading tables…' : 'Choose a table…'}</option>
              {tables.items.map((t) => <option key={String(t.id)} value={String(t.id)}>{t.name}</option>)}
            </select>
          ) : (
            <input
              className="xeplr-factory-prop-input"
              type="text"
              placeholder={tables?.loading ? 'Loading tables…' : 'Table name'}
              value={data.table || ''}
              onChange={(e) => onChange({ source: 'table', table: e.target.value })}
              aria-label="Table"
            />
          )}
          {tables?.error && <div className="xeplr-factory-prop-error">{tables.error}</div>}
          {errorAt('.table') && <div className="xeplr-factory-prop-error">{errorAt('.table')}</div>}
          <div className="xeplr-factory-prop-help">Rows are read as <code>id</code> (saved) and <code>name</code> (shown).</div>
        </div>
      ) : (
        <StaticOptions data={data} onChange={onChange} errors={errors} />
      )}
    </div>
  )
}

function StaticOptions({ data, onChange, errors }) {
  const options = data.options || []
  const set = (next) => onChange({ source: 'static', options: next })
  const update = (i, patch) => set(options.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  const rowError = (i) => errors.filter((e) => e.field.includes(`options[${i}]`)).map((e) => e.message)[0]

  return (
    <div className="xeplr-factory-options">
      {options.length > 0 && (
        <div className="xeplr-factory-options-head"><span>Shown as</span><span>Saved as</span><span /></div>
      )}
      {options.map((o, i) => (
        <div key={i} className="xeplr-factory-option-row">
          <input
            className="xeplr-factory-prop-input"
            type="text"
            placeholder="Full time"
            value={o.name ?? ''}
            aria-label={`Option ${i + 1} name`}
            onChange={(e) => update(i, { name: e.target.value })}
            // An id nobody typed follows the name, so a list can be made by
            // typing names alone. Once an id is set it is left alone — it is
            // what saved records point at.
            onBlur={(e) => { if (o.id === '' || o.id === undefined) update(i, { id: slugify(e.target.value, '_') }) }}
          />
          <input
            className="xeplr-factory-prop-input xeplr-factory-mono"
            type="text"
            placeholder="full_time"
            value={o.id ?? ''}
            aria-label={`Option ${i + 1} id`}
            onChange={(e) => update(i, { id: e.target.value })}
          />
          <button type="button" className="xeplr-factory-icon-button" aria-label={`Remove option ${i + 1}`} onClick={() => set(options.filter((_, j) => j !== i))}>×</button>
          {rowError(i) && <div className="xeplr-factory-prop-error xeplr-factory-option-error">{rowError(i)}</div>}
        </div>
      ))}
      <button type="button" className="xeplr-factory-add" onClick={() => set([...options, { id: '', name: '' }])}>+ Add option</button>
    </div>
  )
}

export const EDITORS = {
  text: TextEditor,
  textarea: TextareaEditor,
  number: NumberEditor,
  date: DateEditor,
  toggle: ToggleEditor,
  select: SelectEditor,
  dataSource: DataSourceEditor
}
