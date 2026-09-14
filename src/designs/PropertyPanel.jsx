import { getAtPath } from '../propertyPath.js'
import { slugify, inputNodes } from '../document.js'
import { FONT_FAMILIES, STYLE_KEYS, SCREEN_STYLE_KEYS, LIST_ACTIONS } from '../controls.js'

// The selected control's properties, GENERATED from its entry in controls.js:
// each field there names a path and an editor type, and this file owns only
// what each editor type looks like. A new property is a line in controls.js.

export default function PropertyPanel({ doc, node, control, errors, tables, screens, lockedNames, onChange, onScreenChange, onRemove, selectionCount }) {
  if (selectionCount > 1) {
    return (
      <aside className="xeplr-factory-panel">
        <p className="xeplr-factory-panel-empty">{selectionCount} controls selected</p>
        <button type="button" className="xeplr-factory-danger" onClick={onRemove}>Delete them</button>
      </aside>
    )
  }
  if (!node || !control) {
    return <ScreenPanel doc={doc} errors={errors || []} tables={tables} onChange={onScreenChange} />
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
            // A field name that is already a column cannot change — see setNodeProperty.
            const locked = field.path === 'props.name' && (lockedNames || []).includes(node.props?.name)
            const Editor = locked ? LockedEditor : (EDITORS[field.type] || TextEditor)
            const id = `xf-prop-${node.id}-${field.path.replace(/\W+/g, '-')}`
            return (
              <div key={field.path} className={`xeplr-factory-prop${errs.length ? ' has-error' : ''}`}>
                {field.type !== 'toggle' && field.type !== 'toggleValue' && field.type !== 'columns' && field.type !== 'actions' && <label className="xeplr-factory-prop-label" htmlFor={id}>{field.label}</label>}
                <Editor
                  id={id}
                  field={field}
                  value={getAtPath(node, field.path)}
                  onChange={(v) => onChange(field.path, v)}
                  tables={tables}
                  screens={screens}
                  node={node}
                  doc={doc}
                  errors={errs}
                />
                {locked
                  ? <div className="xeplr-factory-prop-help">Saved as a column of <code>{doc?.source}</code> — renaming it would leave its data behind. A rename is a migration.</div>
                  : field.help && <div className="xeplr-factory-prop-help">{field.help}</div>}
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

/**
 * Nothing selected: the SCREEN's own properties — where records are saved,
 * how wide it is designed, and the font and colours every control inherits.
 */
function ScreenPanel({ doc, errors, tables, onChange }) {
  const errorFor = (path) => errors.filter((e) => e.path === path || e.path.startsWith(path + '.')).map((e) => e.message)[0]
  const styleFields = SCREEN_STYLE_KEYS.map((k) => ({ path: `style.${k}`, label: k === 'fontSize' ? 'Base font size (px)' : STYLE_KEYS[k].label, ...STYLE_KEYS[k] }))
  const row = (field, Editor, extra) => {
    const id = `xf-screen-${field.path.replace(/\W+/g, '-')}`
    const msg = errorFor(field.path)
    return (
      <div key={field.path} className={`xeplr-factory-prop${msg ? ' has-error' : ''}`}>
        {field.type !== 'toggle' && field.type !== 'toggleValue' && <label className="xeplr-factory-prop-label" htmlFor={id}>{field.label}</label>}
        <Editor id={id} field={field} value={getAtPath(doc, field.path)} onChange={(v) => onChange(field.path, v)} tables={tables} errors={[]} {...extra} />
        {field.help && <div className="xeplr-factory-prop-help">{field.help}</div>}
        {msg && <div className="xeplr-factory-prop-error">{msg}</div>}
      </div>
    )
  }
  return (
    <aside className="xeplr-factory-panel" aria-label="Screen properties">
      <header className="xeplr-factory-panel-head">
        <span className="xeplr-factory-panel-type">Screen</span>
      </header>
      <p className="xeplr-factory-panel-empty">Select a control to change it, or drag one in from the left.</p>
      <fieldset className="xeplr-factory-group">
        <legend>Data</legend>
        {row({ path: 'source', label: 'Saves to', type: 'table', help: 'The table this screen\'s records are saved in' }, TableEditor)}
      </fieldset>
      <fieldset className="xeplr-factory-group">
        <legend>Size</legend>
        {row({ path: 'width', label: 'Width (px)', type: 'number', help: 'The width it is designed at. Narrower screens scale it down; wider ones never stretch it.' }, NumberEditor)}
      </fieldset>
      <fieldset className="xeplr-factory-group">
        <legend>Text</legend>
        {styleFields.map((f) => row(f, EDITORS[f.type] || TextEditor))}
      </fieldset>
    </aside>
  )
}

function LockedEditor({ id, value }) {
  return <input id={id} className="xeplr-factory-prop-input xeplr-factory-mono" type="text" value={value ?? ''} readOnly aria-readonly="true" />
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

/** A font family: the common ones, or anything typed. */
function FontEditor({ id, value, onChange }) {
  const known = FONT_FAMILIES.some((f) => f.value === value)
  return (
    <select id={id} className="xeplr-factory-prop-input" value={value == null ? '' : known ? value : '__custom'} onChange={(e) => {
      const v = e.target.value
      if (v === '__custom') return
      onChange(v === '' ? undefined : v)
    }} style={{ fontFamily: value || undefined }}>
      <option value="">Same as the screen</option>
      {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
      {!known && value && <option value="__custom">{value}</option>}
    </select>
  )
}

/** A colour: a swatch, and the hex beside it. Clearing it goes back to the default. */
function ColorEditor({ id, value, onChange }) {
  const hex = typeof value === 'string' && /^#([0-9a-f]{6})$/i.test(value) ? value
    : typeof value === 'string' && /^#([0-9a-f]{3})$/i.test(value) ? '#' + value.slice(1).split('').map((c) => c + c).join('')
    : '#000000'
  return (
    <div className="xeplr-factory-color">
      <input type="color" aria-label="Pick colour" value={hex} onChange={(e) => onChange(e.target.value)} />
      <input id={id} className="xeplr-factory-prop-input xeplr-factory-mono" type="text" placeholder="default" value={value ?? ''} onChange={(e) => onChange(e.target.value.trim())} />
      {value && <button type="button" className="xeplr-factory-icon-button" aria-label="Reset colour" onClick={() => onChange(undefined)}>×</button>}
    </div>
  )
}

/** A style that is either on (e.g. italic) or not set. */
function ToggleValueEditor({ id, field, value, onChange }) {
  return (
    <label className="xeplr-factory-toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={value === field.on} onChange={(e) => onChange(e.target.checked ? field.on : undefined)} />
      <span>{field.label}</span>
    </label>
  )
}

/** A table name: picked from the app's tables when it lists them, typed otherwise. */
function TableEditor({ id, value, onChange, tables }) {
  if (tables && tables.items.length > 0) {
    return (
      <select id={id} className="xeplr-factory-prop-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{tables.loading ? 'Loading tables…' : '—'}</option>
        {tables.items.map((t) => <option key={String(t.id)} value={String(t.id)}>{t.name}</option>)}
      </select>
    )
  }
  return <input id={id} className="xeplr-factory-prop-input" type="text" placeholder={tables?.loading ? 'Loading tables…' : 'table name'} value={value ?? ''} onChange={(e) => onChange(e.target.value.trim() || undefined)} />
}

/**
 * A list's columns: tick which fields to show, in reading order. The fields
 * are this screen's own — or, for a list screen, those of the screen it edits
 * in. Nothing ticked means all of them.
 */
function ColumnsEditor({ value, onChange, doc, node, screens }) {
  const editDoc = node && node.props.editScreen ? (screens || []).find((s) => s.id === node.props.editScreen)?.document : null
  const from = doc && inputNodes(doc).length ? doc : editDoc
  const fields = from
    ? inputNodes(from).map((n) => ({ field: n.props.name, label: n.props.label || n.props.name }))
    : (Array.isArray(value) ? value : [])
  const chosen = Array.isArray(value) ? value : null
  const isOn = (f) => (chosen ? chosen.some((c) => c.field === f.field) : true)
  const toggle = (f) => {
    const current = chosen || fields
    const next = isOn(f) ? current.filter((c) => c.field !== f.field) : fields.filter((x) => x.field === f.field || current.some((c) => c.field === x.field))
    // All of them again is the same as "not set" — keep the document clean.
    onChange(next.length === fields.length || next.length === 0 ? undefined : next.map((c) => ({ field: c.field, label: (current.find((x) => x.field === c.field) || c).label })))
  }
  if (!fields.length) return <div className="xeplr-factory-prop-help">Add fields to the screen first — the list shows them as columns.</div>
  return (
    <div className="xeplr-factory-checklist">
      {fields.map((f) => (
        <label key={f.field} className="xeplr-factory-toggle">
          <input type="checkbox" checked={isOn(f)} onChange={() => toggle(f)} />
          <span>{f.label}</span>
        </label>
      ))}
    </div>
  )
}

/** Another screen, by id: picked from the ones the app lists, typed otherwise. */
function ScreenEditor({ id, value, onChange, screens, doc }) {
  const others = (screens || []).filter((s) => !doc || s.id !== doc.id)
  if (others.length) {
    return (
      <select id={id} className="xeplr-factory-prop-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">— open rows in this screen's fields</option>
        {others.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    )
  }
  return <input id={id} className="xeplr-factory-prop-input xeplr-factory-mono" type="text" placeholder="employee_edit" value={value ?? ''} onChange={(e) => onChange(e.target.value.trim() || undefined)} />
}

const ACTION_LABELS = { new: 'New — add a record', edit: 'Edit — open a row for editing', delete: 'Delete — remove a row' }

function ActionsEditor({ value, onChange }) {
  const on = Array.isArray(value) ? value : LIST_ACTIONS
  return (
    <div className="xeplr-factory-checklist">
      {LIST_ACTIONS.map((a) => (
        <label key={a} className="xeplr-factory-toggle">
          <input type="checkbox" checked={on.includes(a)} onChange={(e) => onChange(e.target.checked ? LIST_ACTIONS.filter((x) => x === a || on.includes(x)) : on.filter((x) => x !== a))} />
          <span>{ACTION_LABELS[a]}</span>
        </label>
      ))}
    </div>
  )
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
  // Style selects may be unset ("inherit"); numeric option values stay numbers.
  const optional = String(field.path || '').includes('.style.') || String(field.path || '').startsWith('style.')
  return (
    <select id={id} className="xeplr-factory-prop-input" value={value ?? ''} onChange={(e) => {
      const hit = field.options.find((o) => String(o.value) === e.target.value)
      onChange(hit ? hit.value : undefined)
    }}>
      {optional && <option value="">Default</option>}
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
  toggleValue: ToggleValueEditor,
  select: SelectEditor,
  font: FontEditor,
  color: ColorEditor,
  table: TableEditor,
  screen: ScreenEditor,
  columns: ColumnsEditor,
  actions: ActionsEditor,
  dataSource: DataSourceEditor
}
