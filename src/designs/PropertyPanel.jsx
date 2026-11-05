import { useEffect, useState } from 'react'
import { getAtPath } from '../propertyPath.js'
import { FIELD_PRESETS, presetFor } from '../presets.js'
import { slugify, inputNodes, paramsText, screenParams } from '../document.js'
import { isBinding, previousBinding } from '../values.js'
import { FONT_FAMILIES, STYLE_KEYS, SCREEN_STYLE_KEYS, LIST_ACTIONS, FILE_KINDS, FILE_SOURCES, MAX_FILES } from '../controls.js'
import { BUTTON_VARIANTS, COLUMN_DISPLAYS, BADGE_TONES, CONDITION_OPERATORS, NOTE_INPUT, FILES_INPUT, optionValues } from '../buttons.js'

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

export default function PropertyPanel({ doc, node, control, controls, errors, tables, functions, screens, forms, lockedNames, onChange, onConvert, hint, onScreenChange, onRemove, onMakeChildTable, selectionCount }) {
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
            const id = `xf-prop-${node.id}-${field.path.replace(/\W+/g, '-')}-${field.type}`
            // A default that is a BINDING belongs to "Fill in from"; the typed
            // box beside it shows empty rather than the binding's braces.
            const raw = getAtPath(node, field.path)
            const value = field.path === 'props.default' && field.type !== 'fillFrom' && isBinding(raw) ? undefined : raw
            return (
              <div key={field.path + ':' + field.type} className={`xeplr-factory-prop${errs.length ? ' has-error' : ''}`}>
                {!SELF_LABELLED.includes(field.type) && <label className="xeplr-factory-prop-label" htmlFor={id}>{field.label}</label>}
                <Editor
                  id={id}
                  field={field}
                  value={value}
                  onChange={(v) => onChange(field.path, v)}
                  tables={tables}
                  functions={functions}
                  screens={screens}
                  forms={forms}
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
    // A SELECT WHOSE VALUE IS NOT AN OPTION SHOWS NOTHING, which reads as the
    // setting having been lost. It has not: a table made a moment ago is not
    // in a list fetched when the page opened, and a table whose screens were
    // deleted is still what this list names.
    const known = items.some((t) => String(t.id) === String(value || ''))
    const stray = value && !known ? { id: value, name: value } : null
    const option = (t) => <option key={String(t.id)} value={String(t.id)}>{t.name}</option>

    return (
      <select id={id} className="xeplr-factory-prop-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{tables.loading ? 'Loading tables…' : '—'}</option>
        {stray && <option value={String(stray.id)}>{stray.name}</option>}
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
function ColumnsEditor({ value, onChange, doc, node, screens, functions }) {
  // A list fed by a function has no form describing its rows: its columns
  // are written out, each saying what it shows and how.
  if (node && node.props && node.props.rowsFrom) return <FedColumnsEditor value={value} onChange={onChange} functions={functions} />
  const editDoc = node && node.props.editScreen ? (screens || []).find((s) => s.id === node.props.editScreen)?.document : null

  // A LIST OF ANOTHER TABLE IS NOT DESCRIBED BY THIS SCREEN. Pointing a list
  // at material_characteristics and being offered the MATERIAL's fields is
  // worse than being offered nothing: every one of them ticks a column that
  // will be blank in every row.
  //
  // The edit screen for those rows is the only description to hand here — a
  // host that did not provide it leaves this empty, and the list falls back
  // to the columns the rows themselves have (see listColumns).
  const foreign = node && node.props.source && doc && node.props.source !== doc.source
  const from = foreign ? editDoc : (doc && inputNodes(doc).length ? doc : editDoc)
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
  if (!fields.length) {
    // Two different nothings, and saying "add fields to this screen" to
    // somebody pointing a list at another table sends them to fix the wrong
    // thing.
    return (
      <div className="xeplr-factory-prop-help">
        {foreign
          ? 'Every column of ' + node.props.source + '. Set "Edit in" to that table\'s form to choose.'
          : 'Add fields to the screen first — the list shows them as columns.'}
      </div>
    )
  }
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
        {/* A screen not in the list (not loaded, another app's) is still the
            setting — shown by its id, not as if it had been cleared. */}
        {value && !others.some((s) => s.id === value) && <option value={value}>{value}</option>}
        {others.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    )
  }
  return <input id={id} className="xeplr-factory-prop-input xeplr-factory-mono" type="text" placeholder="employee_edit" value={value ?? ''} onChange={(e) => onChange(e.target.value.trim() || undefined)} />
}

/**
 * A form to draw inside this one: the screens with fields of their own (a list
 * screen has nothing to fill in), never this one — a form cannot hold itself.
 */
function FormEditor({ id, value, onChange, screens, doc }) {
  const forms = (screens || []).filter((s) => (!doc || s.id !== doc.id)
    && (!s.document || (s.document.nodes || []).some((n) => n.props && n.props.name)))
  if (forms.length) {
    return (
      <select id={id} className="xeplr-factory-prop-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">— choose a form</option>
        {forms.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    )
  }
  return <input id={id} className="xeplr-factory-prop-input xeplr-factory-mono" type="text" placeholder="bank_details_edit" value={value ?? ''} onChange={(e) => onChange(e.target.value.trim() || undefined)} />
}

/**
 * FILL IN FROM — a field's default as a BINDING, picked, never typed: what
 * this screen is called with ({params.x}), or what a screen before it in a
 * flow saved ({previous.<screen>.values.<field>}). Picking "nothing" clears
 * only a binding; a typed default value is left alone.
 */
function FillFromEditor({ id, value, onChange, doc, forms }) {
  const bound = isBinding(value) ? value : ''
  const inputs = doc ? screenParams(doc) : []
  const others = (forms || []).filter((f) => !doc || f.key !== doc.id)
  const offered = new Set([
    ...inputs.map((p) => `{params.${p.name}}`),
    ...others.flatMap((f) => f.fields.map((x) => previousBinding(f.key, x.name)))
  ])
  return (
    <select
      id={id}
      className="xeplr-factory-prop-input"
      value={bound}
      onChange={(e) => { if (e.target.value || bound) onChange(e.target.value || undefined) }}
    >
      <option value="">Nothing — empty, or the default value</option>
      {inputs.length > 0 && (
        <optgroup label="What this screen is called with">
          {inputs.map((p) => <option key={p.name} value={`{params.${p.name}}`}>{p.label || p.name}</option>)}
        </optgroup>
      )}
      {others.map((f) => (
        <optgroup key={f.key} label={`${f.name} — a screen before this one`}>
          {f.fields.map((x) => <option key={x.name} value={previousBinding(f.key, x.name)}>{f.name} → {x.label}</option>)}
        </optgroup>
      ))}
      {bound && !offered.has(bound) && <option value={bound}>{bound}</option>}
    </select>
  )
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

/** A list's date range: none, or where it starts and what the dates are. */
function DateRangeEditor({ id, field, value, onChange }) {
  const r = value && typeof value === 'object' ? value : null
  return (
    <div className="xeplr-factory-prop-stack">
      <select id={id} className="xeplr-factory-prop-input" value={r ? (r.default || 'all') : ''} onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? undefined : { ...(r || {}), default: v })
      }}>
        <option value="">— none —</option>
        {(field.presets || []).map((o) => <option key={o.value} value={o.value}>Starts at: {o.label}</option>)}
      </select>
      {r && (
        <input className="xeplr-factory-prop-input" type="text" value={r.label || ''} placeholder='What the dates are, e.g. "Placed"'
               onChange={(e) => { const next = { ...r, label: e.target.value }; if (!next.label) delete next.label; onChange(next) }} />
      )}
    </div>
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

/** Editors that draw their own label (a toggle's is beside it; a list of rows has a heading per row). */
const SELF_LABELLED = ['toggle', 'toggleValue', 'columns', 'actions', 'filters', 'buttons']

/**
 * One of the app's registered functions, for one purpose (`field.event`):
 * picked from those registered for it. A name that is no longer registered
 * stays shown, marked — not silently blanked.
 */
function FunctionEditor({ id, field, value, onChange, functions }) {
  const pick = functions && functions.forEvent ? functions.forEvent(field.event) : []
  if (!functions || (!pick.length && !functions.loading)) {
    return (
      <>
        <input id={id} className="xeplr-factory-prop-input" value={value || ''} placeholder="functionName" onChange={(e) => onChange(e.target.value.trim() || undefined)} />
        {functions && !functions.loading && <div className="xeplr-factory-prop-help">No function is registered for “{field.event}” — the app registers one with @xeplr/actions.</div>}
      </>
    )
  }
  const known = !value || pick.some((f) => f.name === value)
  const chosen = pick.find((f) => f.name === value)
  return (
    <>
      <select id={id} className="xeplr-factory-prop-input" value={value || ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">— none —</option>
        {!known && <option value={value}>{value} (not registered)</option>}
        {pick.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
      </select>
      {chosen && chosen.description && <div className="xeplr-factory-prop-help">{chosen.description}</div>}
    </>
  )
}

/** A list's filter chips: key (what the function is asked for) and the chip's text. */
function FiltersEditor({ value, onChange }) {
  const chips = Array.isArray(value) ? value : []
  const set = (next) => onChange(next.length ? next : undefined)
  const edit = (i, patch) => set(chips.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  return (
    <div className="xeplr-factory-rows-editor">
      <div className="xeplr-factory-prop-label">Filter chips</div>
      {chips.map((c, i) => (
        <div key={i} className="xeplr-factory-rows-editor-row">
          <input className="xeplr-factory-prop-input" aria-label={`Chip ${i + 1} text`} placeholder="Packed" value={c.label || ''}
                 onChange={(e) => edit(i, { label: e.target.value, ...(c.key && c.key !== slugify(c.label || '', '-') ? {} : { key: slugify(e.target.value, '-') }) })} />
          <input className="xeplr-factory-prop-input xeplr-factory-prop-input--key" aria-label={`Chip ${i + 1} key`} placeholder="packed" value={c.key || ''}
                 onChange={(e) => edit(i, { key: e.target.value.trim() })} />
          <RowTools i={i} count={chips.length} onMove={(to) => set(move(chips, i, to))} onRemove={() => set(chips.filter((_, j) => j !== i))} />
        </div>
      ))}
      <button type="button" className="xeplr-factory-secondary" onClick={() => set([...chips, { key: chips.length ? `chip-${chips.length + 1}` : 'all', label: chips.length ? '' : 'All' }])}>+ Chip</button>
    </div>
  )
}

/** Each column of a list fed by a function: what it sorts by, what it shows, how. */
function FedColumnsEditor({ value, onChange, functions }) {
  const cols = Array.isArray(value) ? value : []
  const set = (next) => onChange(next.length ? next : undefined)
  const edit = (i, patch) => set(cols.map((c, j) => {
    if (j !== i) return c
    const next = { ...c, ...patch }
    Object.keys(next).forEach((k) => { if (next[k] === undefined || next[k] === '') delete next[k] })
    return next
  }))
  const details = functions && functions.forEvent ? functions.forEvent('rowDetails') : []
  return (
    <div className="xeplr-factory-rows-editor">
      <div className="xeplr-factory-prop-label">Columns</div>
      {cols.map((c, i) => (
        <fieldset key={i} className="xeplr-factory-rows-editor-card">
          <legend>{c.label || `Column ${i + 1}`}</legend>
          <RowTools i={i} count={cols.length} onMove={(to) => set(move(cols, i, to))} onRemove={() => set(cols.filter((_, j) => j !== i))} />
          <MiniField label="Heading"><input className="xeplr-factory-prop-input" value={c.label || ''} onChange={(e) => edit(i, { label: e.target.value })} /></MiniField>
          <MiniField label="Sorts by (field)"><input className="xeplr-factory-prop-input" value={c.field || ''} placeholder="placedAt" onChange={(e) => edit(i, { field: e.target.value.trim() })} /></MiniField>
          <MiniField label="Shows (field)" help="Blank → the value itself"><input className="xeplr-factory-prop-input" value={c.text || ''} placeholder="placedText" onChange={(e) => edit(i, { text: e.target.value.trim() })} /></MiniField>
          <MiniField label="Second line (field)"><input className="xeplr-factory-prop-input" value={c.sub || ''} onChange={(e) => edit(i, { sub: e.target.value.trim() })} /></MiniField>
          <MiniField label="Drawn as">
            <select className="xeplr-factory-prop-input" value={c.display || 'text'} onChange={(e) => edit(i, { display: e.target.value === 'text' ? undefined : e.target.value, ...(e.target.value !== 'images' ? { more: undefined } : {}), ...(e.target.value !== 'activity' ? { details: undefined } : {}) })}>
              {COLUMN_DISPLAYS.map((d) => <option key={d} value={d}>{DISPLAY_LABELS[d]}</option>)}
            </select>
          </MiniField>
          {c.display === 'images' && <MiniField label="How many more (field)"><input className="xeplr-factory-prop-input" value={c.more || ''} onChange={(e) => edit(i, { more: e.target.value.trim() })} /></MiniField>}
          {c.display === 'activity' && (
            <MiniField label="Hover box from">
              <select className="xeplr-factory-prop-input" value={c.details || ''} onChange={(e) => edit(i, { details: e.target.value || undefined })}>
                <option value="">— none —</option>
                {c.details && !details.some((f) => f.name === c.details) && <option value={c.details}>{c.details} (not registered)</option>}
                {details.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
              </select>
            </MiniField>
          )}
          <MiniField label="Badges" help="field:Text:tone, … — shown where the field is true. Tones: accent, success, warning, danger, muted">
            <input className="xeplr-factory-prop-input" value={badgesText(c.badges)} placeholder="isNew:New, cancelled:Cancelled:danger"
                   onChange={(e) => edit(i, { badges: parseBadges(e.target.value) })} />
          </MiniField>
          <label className="xeplr-factory-toggle">
            <input type="checkbox" checked={c.sortable !== false} onChange={(e) => edit(i, { sortable: e.target.checked ? undefined : false })} />
            <span>Sortable</span>
          </label>
        </fieldset>
      ))}
      <button type="button" className="xeplr-factory-secondary" onClick={() => set([...cols, { field: `column${cols.length + 1}`, label: `Column ${cols.length + 1}` }])}>+ Column</button>
    </div>
  )
}

const DISPLAY_LABELS = { text: 'Text', images: 'Pictures', activity: 'Latest activity (with hover box)', items: 'Items — picture, name, detail, how many' }

function badgesText(badges) {
  return (Array.isArray(badges) ? badges : []).map((b) => [b.field, b.label, b.tone].filter(Boolean).join(':')).join(', ')
}

function parseBadges(text) {
  const list = String(text || '').split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [field, label, tone] = part.split(':').map((x) => x.trim())
    const b = { field, label: label || field }
    if (tone && BADGE_TONES.includes(tone)) b.tone = tone
    return b
  })
  return list.length ? list : undefined
}

/**
 * A PANEL'S BUTTONS. Each is a function of the app and the values it is given:
 * picking the function lists the parameters it takes — a dropdown where it
 * names the values allowed. Then what to ask first, and when it shows or is
 * greyed out.
 */
function ButtonsEditor({ value, onChange, functions }) {
  const buttons = Array.isArray(value) ? value : []
  const set = (next) => onChange(next)
  const edit = (i, patch) => set(buttons.map((b, j) => {
    if (j !== i) return b
    const next = { ...b, ...patch }
    Object.keys(next).forEach((k) => { if (next[k] === undefined) delete next[k] })
    return next
  }))
  const pick = functions && functions.forEvent ? functions.forEvent('button') : []
  const takenIds = (except) => new Set(buttons.filter((_, j) => j !== except).map((b) => b.id))
  const add = () => {
    const ids = takenIds(-1)
    let n = buttons.length + 1
    while (ids.has(`button-${n}`)) n += 1
    set([...buttons, { id: `button-${n}`, label: `Button ${n}`, action: pick[0] ? pick[0].name : '' }])
  }
  return (
    <div className="xeplr-factory-rows-editor">
      <div className="xeplr-factory-prop-label">Buttons</div>
      {!pick.length && functions && !functions.loading && (
        <div className="xeplr-factory-prop-help">No function is registered for buttons — the app registers one with @xeplr/actions and event “button”.</div>
      )}
      {buttons.map((b, i) => {
        const fn = pick.find((f) => f.name === b.action) || null
        const schema = (fn && fn.inputSchema) || []
        const takesNote = schema.some((f) => f.name === NOTE_INPUT)
        const takesFiles = schema.some((f) => f.name === FILES_INPUT)
        return (
          <fieldset key={i} className="xeplr-factory-rows-editor-card">
            <legend>{b.label || `Button ${i + 1}`}</legend>
            <RowTools i={i} count={buttons.length} onMove={(to) => set(move(buttons, i, to))} onRemove={() => set(buttons.filter((_, j) => j !== i))} />
            <MiniField label="Label">
              <input className="xeplr-factory-prop-input" value={b.label || ''} onChange={(e) => {
                const label = e.target.value
                const auto = !b.id || /^button-\d+$/.test(b.id) || b.id === slugify(b.label || '', '-')
                const id = auto ? uniqueId(slugify(label, '-') || `button-${i + 1}`, takenIds(i)) : b.id
                edit(i, { label, id })
              }} />
            </MiniField>
            <MiniField label="Runs">
              <select className="xeplr-factory-prop-input" value={b.action || ''} onChange={(e) => edit(i, { action: e.target.value, params: undefined })}>
                <option value="">— choose a function —</option>
                {b.action && !fn && <option value={b.action}>{b.action} (not registered)</option>}
                {pick.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
              </select>
            </MiniField>
            {fn && fn.description && <div className="xeplr-factory-prop-help">{fn.description}</div>}
            {schema.filter((f) => f.name !== NOTE_INPUT && f.name !== FILES_INPUT).map((f) => (
              <MiniField key={f.name} label={(f.label || f.name) + (f.required && f.default === undefined ? ' *' : '')} help={f.description}>
                <ParamInput field={f} value={b.params ? b.params[f.name] : undefined} onChange={(v) => {
                  const params = { ...(b.params || {}) }
                  if (v === undefined || v === '') delete params[f.name]; else params[f.name] = v
                  edit(i, { params: Object.keys(params).length ? params : undefined })
                }} />
              </MiniField>
            ))}
            <label className="xeplr-factory-toggle">
              <input type="checkbox" checked={Boolean(b.ask)} onChange={(e) => edit(i, { ask: e.target.checked ? { title: `${b.label || 'Continue'}?` } : undefined })} />
              <span>Ask first</span>
            </label>
            {b.ask && (
              <>
                <MiniField label="Question"><input className="xeplr-factory-prop-input" value={b.ask.title || ''} onChange={(e) => edit(i, { ask: clean({ ...b.ask, title: e.target.value }) })} /></MiniField>
                <MiniField label="Explanation"><input className="xeplr-factory-prop-input" value={b.ask.message || ''} onChange={(e) => edit(i, { ask: clean({ ...b.ask, message: e.target.value }) })} /></MiniField>
                {takesNote
                  ? <MiniField label="Note box label" help="Blank → no note box"><input className="xeplr-factory-prop-input" value={b.ask.note || ''} placeholder="Reason (optional)" onChange={(e) => edit(i, { ask: clean({ ...b.ask, note: e.target.value }) })} /></MiniField>
                  : fn && <div className="xeplr-factory-prop-help">{fn.name} takes no note.</div>}
                <AskFieldsEditor
                  value={b.ask.fields}
                  inputs={schema.filter((f) => f.name !== NOTE_INPUT && f.name !== FILES_INPUT && !(b.params && Object.prototype.hasOwnProperty.call(b.params, f.name)))}
                  onChange={(fields) => edit(i, { ask: clean({ ...b.ask, fields }) })}
                />
                {takesFiles
                  ? <AskFileEditor value={b.ask.file} onChange={(file) => edit(i, { ask: clean({ ...b.ask, file }) })} />
                  : b.ask.file && <div className="xeplr-factory-prop-help">{fn ? fn.name : 'This function'} takes no files — the picker will be refused when publishing.</div>}
              </>
            )}
            <ConditionsEditor label="Shows when" value={b.when} onChange={(v) => edit(i, { when: v })} />
            <ConditionsEditor label="Greyed out when" value={b.disabledWhen} onChange={(v) => edit(i, { disabledWhen: v })} />
            <ConditionsEditor label="Shown as the current choice when" value={b.pressedWhen} onChange={(v) => edit(i, { pressedWhen: v })} />
            <MiniField label="Look">
              <select className="xeplr-factory-prop-input" value={b.variant || 'default'} onChange={(e) => edit(i, { variant: e.target.value === 'default' ? undefined : e.target.value })}>
                {BUTTON_VARIANTS.map((v) => <option key={v} value={v}>{VARIANT_LABELS[v]}</option>)}
              </select>
            </MiniField>
          </fieldset>
        )
      })}
      <button type="button" className="xeplr-factory-secondary" onClick={add}>+ Button</button>
    </div>
  )
}

const VARIANT_LABELS = { default: 'Ordinary', primary: 'Main', danger: 'Undo / remove' }

/**
 * The values a button's press asks for (`ask.fields`) — a parcel's size before
 * Packed. Each is one of the function's inputs the screen does not give.
 */
function AskFieldsEditor({ value, inputs, onChange }) {
  const fields = Array.isArray(value) ? value : []
  const set = (next) => onChange(next.length ? next : undefined)
  const edit = (j, patch) => set(fields.map((f, k) => {
    if (k !== j) return f
    const next = { ...f, ...patch }
    Object.keys(next).forEach((key) => { if (next[key] === undefined || next[key] === '' || next[key] === false) delete next[key] })
    return next
  }))
  const free = inputs.filter((f) => !fields.some((a) => a.name === f.name))
  const typeOf = (f) => (f && f.type === 'number' ? 'number' : 'text')
  if (!inputs.length && !fields.length) return null
  return (
    <div className="xeplr-factory-rows-editor">
      <div className="xeplr-factory-prop-label">Asks for</div>
      {fields.map((f, j) => (
        <fieldset key={f.name || j} className="xeplr-factory-rows-editor-card">
          <legend>{f.label || f.name}</legend>
          <RowTools i={j} count={fields.length} onMove={(to) => set(move(fields, j, to))} onRemove={() => set(fields.filter((_, k) => k !== j))} />
          <MiniField label="Input"><input className="xeplr-factory-prop-input" value={f.name} readOnly /></MiniField>
          <MiniField label="Label"><input className="xeplr-factory-prop-input" value={f.label || ''} onChange={(e) => edit(j, { label: e.target.value })} /></MiniField>
          <MiniField label="Unit" help='e.g. "in", "kg"'><input className="xeplr-factory-prop-input" value={f.unit || ''} maxLength={12} onChange={(e) => edit(j, { unit: e.target.value })} /></MiniField>
          {f.type === 'number' && (
            <MiniField label="At least"><input className="xeplr-factory-prop-input" type="number" value={f.min ?? ''} onChange={(e) => edit(j, { min: e.target.value === '' ? undefined : Number(e.target.value) })} /></MiniField>
          )}
          <MiniField label="Starts from" help="A field of the record — asked again, it shows the last value"><input className="xeplr-factory-prop-input" value={f.fill || ''} onChange={(e) => edit(j, { fill: e.target.value })} /></MiniField>
          <label className="xeplr-factory-toggle">
            <input type="checkbox" checked={Boolean(f.required)} onChange={(e) => edit(j, { required: e.target.checked })} />
            <span>Required</span>
          </label>
        </fieldset>
      ))}
      {free.length > 0 && (
        <select className="xeplr-factory-prop-input" value="" aria-label="Ask for another input" onChange={(e) => {
          const f = free.find((x) => x.name === e.target.value)
          if (f) set([...fields, { name: f.name, label: f.label || f.name, type: typeOf(f) }])
        }}>
          <option value="">+ Ask for…</option>
          {free.map((f) => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
        </select>
      )}
    </div>
  )
}

/**
 * The file a button's press takes (`ask.file`): a file field's rules, set the
 * same way. Offered only when the function takes "files".
 */
function AskFileEditor({ value, onChange }) {
  const f = value && typeof value === 'object' ? value : null
  const set = (patch) => {
    const next = { ...f, ...patch }
    Object.keys(next).forEach((k) => { if (next[k] === undefined || next[k] === '' || next[k] === false) delete next[k] })
    if (!next.multiple) delete next.maxFiles
    onChange(next)
  }
  return (
    <>
      <label className="xeplr-factory-toggle">
        <input type="checkbox" checked={Boolean(f)} onChange={(e) => onChange(e.target.checked ? { label: 'Photo', accept: FILE_KINDS.image.accept } : undefined)} />
        <span>Asks for a file</span>
      </label>
      {f && (
        <>
          <MiniField label="File box label"><input className="xeplr-factory-prop-input" value={f.label || ''} onChange={(e) => set({ label: e.target.value })} /></MiniField>
          <MiniField label="Allowed types"><AcceptEditor value={f.accept} onChange={(accept) => set({ accept })} /></MiniField>
          <MiniField label="Take from">
            <select className="xeplr-factory-prop-input" value={f.source || 'any'} onChange={(e) => set({ source: e.target.value === 'any' ? undefined : e.target.value })}>
              {FILE_SOURCES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </MiniField>
          <MiniField label="Largest size (MB)"><input className="xeplr-factory-prop-input" type="number" min={1} max={200} value={f.maxSize ?? ''} onChange={(e) => set({ maxSize: e.target.value === '' ? undefined : Number(e.target.value) })} /></MiniField>
          <label className="xeplr-factory-toggle">
            <input type="checkbox" checked={Boolean(f.multiple)} onChange={(e) => set({ multiple: e.target.checked })} />
            <span>Several files</span>
          </label>
          {f.multiple && (
            <MiniField label="At most (files)"><input className="xeplr-factory-prop-input" type="number" min={1} max={MAX_FILES} value={f.maxFiles ?? ''} onChange={(e) => set({ maxFiles: e.target.value === '' ? undefined : Number(e.target.value) })} /></MiniField>
          )}
          <label className="xeplr-factory-toggle">
            <input type="checkbox" checked={Boolean(f.required)} onChange={(e) => set({ required: e.target.checked })} />
            <span>Required</span>
          </label>
        </>
      )}
    </>
  )
}

/** One parameter's value: a dropdown when the function names the values allowed. */
function ParamInput({ field, value, onChange }) {
  const allowed = optionValues(field.options)
  if (allowed.length) {
    const labelOf = (v) => {
      const o = (field.options || []).find((x) => x && typeof x === 'object' && x.value === v)
      return o && o.label ? o.label : String(v)
    }
    return (
      <select className="xeplr-factory-prop-input" value={value === undefined ? '' : String(value)} onChange={(e) => {
        const hit = allowed.find((v) => String(v) === e.target.value)
        onChange(hit === undefined ? undefined : hit)
      }}>
        <option value="">—</option>
        {allowed.map((v) => <option key={String(v)} value={String(v)}>{labelOf(v)}</option>)}
      </select>
    )
  }
  if (field.type === 'boolean') {
    return (
      <select className="xeplr-factory-prop-input" value={value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}>
        <option value="">{field.default === undefined ? '—' : `Default (${field.default ? 'yes' : 'no'})`}</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }
  if (field.type === 'number') {
    return <input type="number" className="xeplr-factory-prop-input" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
  }
  return <input className="xeplr-factory-prop-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

/** Conditions on the record: every one must match. */
function ConditionsEditor({ label, value, onChange }) {
  const rules = Array.isArray(value) ? value : []
  const set = (next) => onChange(next.length ? next : undefined)
  const edit = (i, patch) => set(rules.map((r, j) => {
    if (j !== i) return r
    const next = { ...r, ...patch }
    const op = CONDITION_OPERATORS.find((o) => o.key === next.op)
    if (op && op.noValue) { delete next.value; delete next.value2 }
    if (op && !op.second) delete next.value2
    return next
  }))
  return (
    <div className="xeplr-factory-conditions">
      <div className="xeplr-factory-prop-label">{label}{rules.length > 1 ? ' — all of these' : ''}</div>
      {rules.map((r, i) => {
        const op = CONDITION_OPERATORS.find((o) => o.key === r.op)
        return (
          <div key={i} className="xeplr-factory-rows-editor-row">
            <input className="xeplr-factory-prop-input" aria-label="Field" placeholder="customStatus" value={r.field || ''} onChange={(e) => edit(i, { field: e.target.value.trim() })} />
            <select className="xeplr-factory-prop-input" aria-label="Comparison" value={r.op || 'eq'} onChange={(e) => edit(i, { op: e.target.value })}>
              {CONDITION_OPERATORS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            {!(op && op.noValue) && <input className="xeplr-factory-prop-input" aria-label="Value" value={r.value ?? ''} onChange={(e) => edit(i, { value: e.target.value })} />}
            {op && op.second && <input className="xeplr-factory-prop-input" aria-label="And" value={r.value2 ?? ''} onChange={(e) => edit(i, { value2: e.target.value })} />}
            <button type="button" className="xeplr-factory-link-danger" aria-label="Remove condition" onClick={() => set(rules.filter((_, j) => j !== i))}>×</button>
          </div>
        )
      })}
      <button type="button" className="xeplr-factory-link" onClick={() => set([...rules, { field: '', op: 'eq', value: '' }])}>+ Condition</button>
    </div>
  )
}

function MiniField({ label, help, children }) {
  return (
    <label className="xeplr-factory-mini">
      <span className="xeplr-factory-mini-label">{label}</span>
      {children}
      {help && <span className="xeplr-factory-prop-help">{help}</span>}
    </label>
  )
}

function RowTools({ i, count, onMove, onRemove }) {
  return (
    <span className="xeplr-factory-rows-editor-tools">
      <button type="button" className="xeplr-factory-link" aria-label="Move up" disabled={i === 0} onClick={() => onMove(i - 1)}>↑</button>
      <button type="button" className="xeplr-factory-link" aria-label="Move down" disabled={i === count - 1} onClick={() => onMove(i + 1)}>↓</button>
      <button type="button" className="xeplr-factory-link-danger" aria-label="Remove" onClick={onRemove}>×</button>
    </span>
  )
}

function move(list, from, to) {
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function uniqueId(base, taken) {
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

function clean(obj) {
  const out = {}
  Object.keys(obj).forEach((k) => { if (obj[k] !== undefined && obj[k] !== '') out[k] = obj[k] })
  return out
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
  dateRange: DateRangeEditor,
  font: FontEditor,
  color: ColorEditor,
  table: TableEditor,
  screen: ScreenEditor,
  form: FormEditor,
  fillFrom: FillFromEditor,
  columns: ColumnsEditor,
  listTable: ListTableEditor,
  actions: ActionsEditor,
  dataSource: DataSourceEditor,
  function: FunctionEditor,
  filters: FiltersEditor,
  buttons: ButtonsEditor
}
