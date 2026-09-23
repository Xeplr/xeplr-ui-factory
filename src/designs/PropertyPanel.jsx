import { useEffect, useState } from 'react'
import { getAtPath } from '../propertyPath.js'
import { FIELD_PRESETS, presetFor } from '../presets.js'
import { slugify, inputNodes, paramsText } from '../document.js'
import { FONT_FAMILIES, STYLE_KEYS, SCREEN_STYLE_KEYS, LIST_ACTIONS, FILE_KINDS } from '../controls.js'

// The selected control's properties, GENERATED from its entry in controls.js:
// each field there names a path and an editor type, and this file owns only
// what each editor type looks like. A new property is a line in controls.js.

/**
 * WHAT KIND OF FIELD THIS IS — at the top of every field's panel, and
 * changeable at any time: a plain control (Text, Number…) or a ready-made one
 * (Email, LinkedIn profile, Age…). Changing it keeps the label, name, position
 * and required, and says what did not carry over.
 *
 * Under it, when the label reads like a ready-made field this is not ("LinkedIn
 * URL" on a plain text box), the offer to make it one — or to stop asking.
 */
function FieldType({ node, controls, hint, onConvert, onKeepPlain }) {
  const [note, setNote] = useState(null)
  useEffect(() => { setNote(null) }, [node.id])
  const registry = controls || {}
  const plain = Object.values(registry).filter((c) => c.input)
  const ready = FIELD_PRESETS.filter((p) => registry[p.control] && registry[p.control].input)
  const current = presetFor(node.props && node.props.preset) ? 'preset:' + node.props.preset : node.type
  const change = (target) => {
    if (target === current) return
    const dropped = onConvert(target) || []
    const name = presetFor(target) ? presetFor(target).label : (registry[target] && registry[target].label)
    setNote(dropped.length ? `Now ${name}. Not carried over: ${dropped.join(', ')}.` : `Now ${name}.`)
  }
  const suggested = hint && presetFor(hint.preset)
  return (
    <div className="xeplr-factory-fieldtype">
      <label className="xeplr-factory-prop-label" htmlFor={`xf-type-${node.id}`}>Field type</label>
      <select id={`xf-type-${node.id}`} className="xeplr-factory-prop-input" value={current} onChange={(e) => change(e.target.value)}>
        <optgroup label="Controls">
          {plain.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}
        </optgroup>
        {ready.length > 0 && (
          <optgroup label="Ready-made fields">
            {ready.map((p) => <option key={p.key} value={'preset:' + p.key}>{p.label}</option>)}
          </optgroup>
        )}
      </select>
      {note && <div className="xeplr-factory-prop-help" role="status">{note}</div>}
      {suggested && (
        <div className="xeplr-factory-suggest" role="note">
          <span>{hint.message}.</span>
          <div className="xeplr-factory-suggest-actions">
            <button type="button" className="xeplr-factory-primary" onClick={() => change('preset:' + suggested.key)}>Make it {suggested.label}</button>
            <button type="button" className="xeplr-factory-secondary" onClick={onKeepPlain}>Keep as is</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PropertyPanel({ doc, node, control, controls, errors, tables, screens, lockedNames, onChange, onConvert, hint, onScreenChange, onRemove, onMakeChildTable, selectionCount }) {
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

      {control.input && onConvert && (
        <FieldType node={node} controls={controls} hint={hint} onConvert={onConvert} onKeepPlain={() => onChange('props.preset', false)} />
      )}

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
                  onMakeChildTable={onMakeChildTable}
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
        <Editor
          id={id}
          field={field}
          value={field.path === 'paramsLine' ? paramsText(doc) : getAtPath(doc, field.path)}
          onChange={(v) => onChange(field.path, v)}
          tables={tables}
          errors={[]}
          {...extra}
        />
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
        <legend>About</legend>
        {/* WHAT IT IS FOR. When a lot of people can make forms, a lot of
            people make the same one — and the fields say what a form holds,
            never what it was for or whether this is the one still in use. */}
        {row({
          path: 'description',
          label: 'What this form is for',
          type: 'textarea',
          help: 'One sentence. It is what tells this apart from the other three called the same thing.'
        }, TextareaEditor)}
      </fieldset>
      <fieldset className="xeplr-factory-group">
        <legend>Data</legend>
        {row({ path: 'source', label: 'Saves to', type: 'table', help: 'The table this screen\'s records are saved in' }, TableEditor)}
        {/* A MASTER is a list other forms point at — departments, statuses,
            countries. A flag on an ordinary form, not a kind of its own. */}
        {row({
          path: 'master',
          label: 'This is a master',
          type: 'toggle',
          help: 'A list other forms choose from. Masters are kept together in the admin section.'
        }, EDITORS.toggle || TextEditor)}
        {doc.master && row({
          path: 'labelField',
          label: 'Shown as',
          type: 'select',
          options: [{ value: '', label: '— choose a field —' }].concat(
            inputNodes(doc).map((n) => ({ value: n.props.name, label: n.props.label || n.props.name }))
          ),
          help: 'What a picker shows for a record. Said once here, not on every dropdown.'
        }, EDITORS.select || TextEditor)}
        {/* WHAT THIS FORM IS CALLED WITH. One line, because that is the whole
            question — "this form needs contentId, age, name". A field then
            binds to one with {params.contentId} as its default, the same
            brace used in a workflow step or a report. */}
        {row({
          path: 'paramsLine',
          label: 'Inputs',
          type: 'text',
          help: 'Names, comma separated. A field takes one with {params.name} as its default.'
        }, ListLineEditor)}
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

/**
 * A LIST TYPED AS A LINE — the screen's inputs.
 *
 * Two bugs live here, and this shape is what avoids both.
 *
 * It cannot be a plain TextEditor: what is STORED is a list and what is SHOWN
 * is that list joined again, so a comma is parsed away the moment it is typed
 * ("a," → ["a"] → "a") and the box refuses to let anybody start a second name.
 *
 * And it cannot commit on BLUR, which was the first fix: pressing Publish is
 * one gesture, so the blur and the click race, and a name typed just before
 * publishing was not in the document the publish read. The screen went out
 * with no inputs and nothing said why.
 *
 * So the text is kept HERE for display, and the document is told on every
 * keystroke. Nothing is ever waiting to be committed, and the line somebody
 * is typing is never rewritten under their fingers.
 */
function ListLineEditor({ id, value, onChange }) {
  const [text, setText] = useState(value ?? '')
  const [typing, setTyping] = useState(false)

  // Taken from the document again when it changes underneath — a different
  // screen, an undo — unless the box is being typed in right now, which is
  // the only thing this local copy exists for.
  useEffect(() => { if (!typing) setText(value ?? '') }, [value, typing])

  return (
    <input
      id={id}
      className="xeplr-factory-prop-input"
      type="text"
      value={text}
      onFocus={() => setTyping(true)}
      onChange={(e) => { setText(e.target.value); onChange(e.target.value) }}
      onBlur={(e) => { setTyping(false); onChange(e.target.value) }}
    />
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

function DatetimeEditor({ id, value, onChange }) {
  return <input id={id} className="xeplr-factory-prop-input" type="datetime-local" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

/**
 * Which files a file field takes: one of the everyday sets, or a list typed
 * out. The list is what is saved either way — the sets are a way in, not a
 * second setting to keep in step.
 */
function AcceptEditor({ id, value, onChange }) {
  const kind = Object.keys(FILE_KINDS).find((k) => FILE_KINDS[k].accept === value)
  return (
    <div className="xeplr-factory-prop-stack">
      <select
        id={id}
        className="xeplr-factory-prop-input"
        value={kind || '__custom'}
        onChange={(e) => { const k = e.target.value; if (k !== '__custom') onChange(FILE_KINDS[k].accept) }}
      >
        {Object.entries(FILE_KINDS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
        <option value="__custom">Just these…</option>
      </select>
      <input
        className="xeplr-factory-prop-input"
        type="text"
        value={value ?? ''}
        placeholder=".pdf,.docx"
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      />
    </div>
  )
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
/**
 * WHERE A DROPDOWN'S OPTIONS COME FROM.
 *
 * MASTERS FIRST, by the name a person knows them as — "Departments", not
 * "departments" — because those are the lists that exist to be pointed at. A
 * flat list of thirty raw table names is one nobody can read, and nothing in
 * it says which tables were meant for this.
 *
 * Everything else is still underneath. A dropdown may legitimately read from
 * any table a published screen reads, and hiding those would replace a
 * confusing list with a dead end.
 *
 * Two groups in a plain <select>, not a combobox: typing jumps to an option
 * in every browser, which is the searching somebody actually wants here, and
 * a widget of our own would have to reimplement the keyboard to match.
 */
/**
 * The same picker, plus a way out of the dead end.
 *
 * A sub-table points at a table that usually does not exist yet, and the
 * honest answer to "which table?" at that moment is "the one I am about to
 * make". Without this the designer has to be left, a form built, and the
 * thought recovered on the way back.
 *
 * Only on a LIST, and only when the host can make one: it is a server act.
 */
function ListTableEditor({ id, value, onChange, tables, node, doc, onMakeChildTable }) {
  const [making, setMaking] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const canMake = Boolean(onMakeChildTable && doc && doc.source && node)

  const make = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      await onMakeChildTable(node.id, name.trim())
      setMaking(false)
      setName('')
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (making) {
    return (
      <div>
        <input
          id={id}
          className="xeplr-factory-prop-input"
          autoFocus
          value={name}
          placeholder="Characteristics"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); make() } }}
        />
        <div className="xeplr-factory-prop-help">
          Makes a table of rows belonging to this one, and points this list at it.
        </div>
        {error && <div className="xeplr-factory-prop-error">{error}</div>}
        <button type="button" className="xeplr-factory-primary" disabled={!name.trim() || busy} onClick={make}>
          {busy ? 'Making it…' : 'Make the table'}
        </button>
        <button type="button" className="xeplr-factory-secondary" onClick={() => { setMaking(false); setError(null) }}>Cancel</button>
      </div>
    )
  }

  return (
    <div>
      <TableEditor id={id} value={value} onChange={onChange} tables={tables} />
      {canMake && (
        <button type="button" className="xeplr-factory-secondary" onClick={() => setMaking(true)}>
          New table…
        </button>
      )}
    </div>
  )
}

function TableEditor({ id, value, onChange, tables }) {
  const items = (tables && tables.items) || []
  if (items.length > 0) {
    const masters = items.filter((t) => t.master)
    const rest = items.filter((t) => !t.master)
    const option = (t) => <option key={String(t.id)} value={String(t.id)}>{t.name}</option>

    return (
      <select id={id} className="xeplr-factory-prop-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{tables.loading ? 'Loading tables…' : '—'}</option>
        {masters.length > 0 && <optgroup label="Masters">{masters.map(option)}</optgroup>}
        {/* Named as what they are, so it reads as "the rest" rather than as a
            second list of the same kind of thing. */}
        {rest.length > 0 && (
          <optgroup label={masters.length > 0 ? 'Other tables' : 'Tables'}>{rest.map(option)}</optgroup>
        )}
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

/**
 * The steps, as one line: "Connect, Transform, Review". A step KEEPS ITS KEY
 * while it is renamed — the controls on it point at the key — so editing the
 * line matches by position, and only a step that is added or removed changes
 * which controls are shown.
 */
function StepsEditor({ id, value, onChange }) {
  const steps = Array.isArray(value) ? value : []
  return (
    <input
      id={id}
      className="xeplr-factory-prop-input"
      type="text"
      value={steps.map((s) => s.label).join(', ')}
      placeholder="Connect, Transform, Review"
      onChange={(e) => {
        const labels = e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
        onChange(labels.map((label, i) => ({
          key: steps[i] ? steps[i].key : uniqueStepKey(steps, slugify(label, '_') || `step_${i + 1}`),
          label
        })))
      }}
    />
  )
}

function uniqueStepKey(steps, base) {
  const taken = new Set(steps.map((s) => s.key))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}_${n}`)) n++
  return `${base}_${n}`
}

export const EDITORS = {
  text: TextEditor,
  textarea: TextareaEditor,
  number: NumberEditor,
  date: DateEditor,
  datetime: DatetimeEditor,
  accept: AcceptEditor,
  steps: StepsEditor,
  toggle: ToggleEditor,
  toggleValue: ToggleValueEditor,
  select: SelectEditor,
  font: FontEditor,
  color: ColorEditor,
  table: TableEditor,
  screen: ScreenEditor,
  columns: ColumnsEditor,
  listTable: ListTableEditor,
  actions: ActionsEditor,
  dataSource: DataSourceEditor
}
