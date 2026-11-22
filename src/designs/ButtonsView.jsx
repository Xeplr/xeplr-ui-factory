import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { boxStyle, fieldStyle } from './styles.js'
import FileField from './FileField.jsx'
import { askFields, askFieldStart, askFieldValues, askDayLimit, checklistOptionsOf, askChoiceOptions, isFedChoice, emptyRow, startRowsOf, MAX_ASK_ROWS, tickByCode, chooseByCode } from '../buttons.js'

// A PANEL OF BUTTONS. Each runs a function of the app on the server, with the
// parameters the screen gives it; which ones show, and which are greyed out,
// the controller works out from the record (useFactoryScreen.buttonsFor).
//
// A button that asks first opens a small dialog: its message, a note box when
// it takes a note, and a file picker when it takes files (`ask.file` — on a
// phone, the gallery or the camera). Presentation only — the press, and the
// upload, are the controller's.
//
// On the canvas (design) the buttons are drawn as they will look, inert.

export default function ButtonsView({ node, design, panel }) {
  const p = node.props || {}
  const style = { ...fieldStyle(p.style), ...boxStyle(p.style) }
  const [asking, setAsking] = useState(null)       // the button whose dialog is open

  if (design || !panel) {
    const all = p.buttons || []
    return (
      <div className="xeplr-factory-buttons xeplr-factory-buttons--design" style={style}>
        {p.title && <span className="xeplr-factory-buttons-title">{p.title}</span>}
        {all.length === 0 && <span className="xeplr-factory-hint">No buttons yet — add them in Properties.</span>}
        {all.map((b) => <span key={b.id} className={`xeplr-factory-button xeplr-factory-button--${b.variant || 'default'}`}>{b.label}</span>)}
      </div>
    )
  }

  const run = (b) => (b.ask ? setAsking(b) : panel.press(b))
  const note = panel.note

  return (
    <div className="xeplr-factory-buttons" style={style} role="group" aria-label={p.title || 'Actions'}>
      {p.title && <span className="xeplr-factory-buttons-title">{p.title}</span>}
      {panel.buttons.map((b) => (
        <button
          key={b.id}
          type="button"
          className={`xeplr-factory-button xeplr-factory-button--${b.variant || 'default'}${b.pressed ? ' xeplr-factory-button--pressed' : ''}`}
          aria-pressed={b.pressedWhen ? Boolean(b.pressed) : undefined}
          disabled={b.disabled || Boolean(panel.pressing)}
          aria-busy={panel.pressing === b.id}
          onClick={() => run(b)}
        >
          {panel.pressing === b.id ? `${b.label}…` : b.label}
        </button>
      ))}
      {note && !asking && (
        <span className={`xeplr-factory-buttons-note xeplr-factory-buttons-note--${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
          {note.text}
          <button type="button" className="xeplr-factory-buttons-note-close" aria-label="Dismiss" onClick={panel.clearNote}>×</button>
        </span>
      )}
      {asking && (
        <AskDialog
          button={asking}
          busy={panel.pressing === asking.id}
          error={note && note.kind === 'error' && note.button === asking.id ? note.text : null}
          onCancel={() => { setAsking(null); panel.clearNote() }}
          upload={(file) => panel.upload(file, asking)}
          options={panel.options ? (field) => panel.options(asking, field) : null}
          readFile={panel.readFile}
          record={panel.record}
          onConfirm={async (typed, files, values) => { if (await panel.press(asking, typed, files, values)) setAsking(null) }}
        />
      )}
    </div>
  )
}

/**
 * ONE button pressed on its own — a row's "…" entry: its dialog when it asks
 * first, else pressed at once. `onClose` when it is done or cancelled.
 */
export function RunButton({ button, panel, onClose }) {
  const started = useRef(false)
  useEffect(() => {
    if (button.ask || started.current) return
    started.current = true
    Promise.resolve(panel.press(button)).finally(onClose)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!button.ask) return null
  const note = panel.note
  return (
    <AskDialog
      button={button}
      busy={panel.pressing === button.id}
      error={note && note.kind === 'error' && note.button === button.id ? note.text : null}
      onCancel={() => { panel.clearNote(); onClose() }}
      upload={(file) => panel.upload(file, button)}
      options={panel.options ? (field) => panel.options(button, field) : null}
      readFile={panel.readFile}
      record={panel.record}
      onConfirm={async (typed, files, values) => { if (await panel.press(button, typed, files, values)) onClose() }}
    />
  )
}

/** "Change status to Packed?" — the button's message, its fields, a note and files when it takes them. */

/** How many fields to a line in a button's popup (`ask.columns`), or none: as many as fit. */
function askColumns(ask) {
  return Number.isInteger(ask && ask.columns) && ask.columns >= 1 && ask.columns <= 4 ? ask.columns : 0
}

/** A field that starts a new line of the popup (`newRow`). */
function rowStart(f) {
  return f && f.newRow ? { gridColumnStart: 1 } : undefined
}

function AskDialog({ button, busy, error, onCancel, onConfirm, upload, readFile, record, options }) {
  const ask = button.ask || {}
  const file = ask.file && typeof ask.file === 'object' ? ask.file : null
  const fields = askFields(button)
  const [typed, setTyped] = useState('')
  const [files, setFiles] = useState([])
  // Each asked value starts from the record (`fill`): asked again, it shows what was given last.
  const [given, setGiven] = useState(() => Object.fromEntries(fields.map((f) => [f.name, askFieldStart(f, record)])))
  const [shown, setShown] = useState({})          // field → message, after a try
  const [codes, setCodes] = useState({})          // a scan checklist's code box: field → { typed, said, bad }
  // A CHECKLIST's entries, asked for when the dialog opens: field → { loading, list, error }.
  const [offered, setOffered] = useState({})
  useEffect(() => {
    let live = true
    fields.filter((f) => f.type === 'checklist' || isFedChoice(f)).forEach((f) => {
      if (!options) { setOffered((o) => ({ ...o, [f.name]: { list: [], error: 'No buttonOptions was provided, so this list cannot be loaded' } })); return }
      setOffered((o) => ({ ...o, [f.name]: { loading: true, list: [] } }))
      Promise.resolve(options(f.name))
        .then((list) => { if (live) setOffered((o) => ({ ...o, [f.name]: { list: checklistOptionsOf(list) } })) })
        .catch((err) => { if (live) setOffered((o) => ({ ...o, [f.name]: { list: [], error: err.message || 'Could not load the list' } })) })
    })
    // ROWS that start from what was given last time (startFrom), asked for
    // the record now; until they come, the field's empty start.
    fields.filter((f) => f.type === 'rows' && f.startFrom && options).forEach((f) => {
      setOffered((o) => ({ ...o, [f.name]: { loading: true, list: [] } }))
      Promise.resolve(options(f.name))
        .then((list) => { if (live) { setGiven((g) => ({ ...g, [f.name]: startRowsOf(f, list) })); setOffered((o) => ({ ...o, [f.name]: { list: [] } })) } })
        .catch((err) => { if (live) setOffered((o) => ({ ...o, [f.name]: { list: [], error: err.message || 'Could not load what was given before' } })) })
    })
    return () => { live = false }
  }, [button.id])                                                    // eslint-disable-line react-hooks/exhaustive-deps
  const setRow = (name, i, key, v) => {
    setGiven((g) => ({ ...g, [name]: (g[name] || []).map((r, j) => (j === i ? { ...r, [key]: v } : r)) }))
    setShown((m) => ({ ...m, [name]: undefined }))
  }
  const addRow = (f) => setGiven((g) => ({ ...g, [f.name]: [...(g[f.name] || []), emptyRow(f)] }))
  const dropRow = (name, i) => setGiven((g) => ({ ...g, [name]: (g[name] || []).filter((_, j) => j !== i) }))
  const tick = (name, id, on) => {
    setGiven((g) => {
      const now = Array.isArray(g[name]) ? g[name] : []
      return { ...g, [name]: on ? [...now, id] : now.filter((x) => x !== id) }
    })
    setShown((m) => ({ ...m, [name]: undefined }))
  }
  const confirm = () => {
    const offeredIds = Object.fromEntries(fields.filter((f) => f.type === 'checklist' || isFedChoice(f)).map((f) => [f.name, ((offered[f.name] || {}).list || []).map((o) => o.id)]))
    const out = askFieldValues(button, given, undefined, offeredIds)
    if (out.errors.length) { setShown(Object.fromEntries(out.errors.map((e) => [e.field, e.message]))); return }
    setShown({})
    onConfirm(typed, files, out.values)
  }
  const missing = Boolean(file && file.required && !files.length)
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])
  const titleId = `xf-ask-${button.id}`
  // At the page's root: inside the screen, a control's own box could clip it.
  return createPortal(
    <div className="xeplr-factory-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}>
      <div ref={ref} className={`xeplr-factory-modal xeplr-factory-ask${ask.wide ? ' xeplr-factory-ask-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="xeplr-factory-modal-head">
          <span className="xeplr-factory-modal-title" id={titleId}>{ask.title || `${button.label}?`}</span>
          <button type="button" className="xeplr-factory-modal-close" onClick={onCancel} disabled={busy} aria-label="Close">×</button>
        </header>
        <div className="xeplr-factory-modal-body">
          {ask.message && <p className="xeplr-factory-ask-message">{ask.message}</p>}
          {fields.length > 0 && (
            <div className="xeplr-factory-ask-fields" style={askColumns(ask) ? { '--xf-ask-columns': askColumns(ask) } : undefined} data-columns={askColumns(ask) || undefined}>
              {fields.map((f) => {
                const fid = `${titleId}-${f.name}`
                if (f.type === 'checklist') {
                  const o = offered[f.name] || { loading: true, list: [] }
                  const ticked = Array.isArray(given[f.name]) ? given[f.name] : []
                  return (
                    <fieldset key={f.name} style={rowStart(f)} className="xeplr-factory-ask-field xeplr-factory-ask-checklist" aria-describedby={shown[f.name] ? `${fid}-error` : undefined}>
                      <legend className="xeplr-factory-ask-label">{f.label}{f.required ? ' *' : ''}</legend>
                      {f.scan && o.list.length > 0 && (
                        <div className="xeplr-factory-ask-scan">
                          <input
                            className="xeplr-factory-ask-input"
                            type="text"
                            autoComplete="off"
                            placeholder="Scan or type a code, then Enter"
                            aria-label={`${f.label}: tick by code`}
                            value={(codes[f.name] || {}).typed || ''}
                            disabled={busy}
                            onChange={(e) => setCodes((c) => ({ ...c, [f.name]: { ...(c[f.name] || {}), typed: e.target.value } }))}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return
                              e.preventDefault()
                              const out = tickByCode(o.list, given[f.name], e.target.value, f.scanMiss)
                              if (out.option) setGiven((g) => ({ ...g, [f.name]: out.ticked }))
                              setCodes((c) => ({ ...c, [f.name]: { typed: out.option ? '' : e.target.value, said: out.message, bad: !out.option } }))
                            }}
                          />
                          {(codes[f.name] || {}).said && <span className={(codes[f.name] || {}).bad ? 'xeplr-factory-ask-field-error' : 'xeplr-factory-hint'} role={(codes[f.name] || {}).bad ? 'alert' : 'status'}>{codes[f.name].said}</span>}
                        </div>
                      )}
                      {o.loading && <span className="xeplr-factory-hint">Loading…</span>}
                      {o.error && <span className="xeplr-factory-ask-field-error" role="alert">{o.error}</span>}
                      {!o.loading && !o.error && !o.list.length && <span className="xeplr-factory-hint">Nothing to choose</span>}
                      {o.list.length > 0 && (
                        <ul className="xeplr-factory-ask-checks">
                          {o.list.map((opt) => (
                            <li key={opt.id}>
                              <label className="xeplr-factory-ask-check">
                                <input type="checkbox" checked={ticked.includes(opt.id)} disabled={busy} onChange={(e) => tick(f.name, opt.id, e.target.checked)} />
                                {opt.image && <img className="xeplr-factory-ask-check-image" src={opt.image} alt="" loading="lazy" />}
                                <span className="xeplr-factory-ask-check-text">
                                  <span className="xeplr-factory-ask-check-label">{opt.label}</span>
                                  {opt.sub && <span className="xeplr-factory-ask-check-sub">{opt.sub}</span>}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                      {shown[f.name] && <span className="xeplr-factory-ask-field-error" id={`${fid}-error`} role="alert">{shown[f.name]}</span>}
                    </fieldset>
                  )
                }
                if (f.type === 'rows') {
                  const rows = Array.isArray(given[f.name]) ? given[f.name] : []
                  const cols = (f.fields || []).filter((c) => c && c.name)
                  const o = offered[f.name] || {}
                  const max = Math.min(Number.isInteger(f.max) ? f.max : MAX_ASK_ROWS, MAX_ASK_ROWS)
                  const keep = Math.max(1, Number.isInteger(f.min) ? f.min : 1)
                  return (
                    <fieldset key={f.name} className="xeplr-factory-ask-field xeplr-factory-ask-rows" aria-describedby={shown[f.name] ? `${fid}-error` : undefined}>
                      <legend className="xeplr-factory-ask-label">{f.label}{f.required ? ' *' : ''}</legend>
                      {o.loading && <span className="xeplr-factory-hint">Loading what was given before…</span>}
                      {o.error && <span className="xeplr-factory-ask-field-error" role="alert">{o.error}</span>}
                      {rows.map((r, i) => (
                        <div key={i} className="xeplr-factory-ask-row" role="group" aria-label={`${f.rowLabel || 'Row'} ${i + 1}`}>
                          <span className="xeplr-factory-ask-row-name">{f.rowLabel || 'Row'} {i + 1}</span>
                          {cols.map((c) => (
                            <label key={c.name} className="xeplr-factory-ask-row-cell">
                              <span className="xeplr-factory-ask-row-label">{c.label}{c.required ? ' *' : ''}</span>
                              <span className="xeplr-factory-ask-value">
                                <input
                                  className="xeplr-factory-ask-input"
                                  type={c.type === 'number' ? 'number' : 'text'}
                                  inputMode={c.type === 'number' ? 'decimal' : undefined}
                                  step={c.type === 'number' ? 'any' : undefined}
                                  min={c.min} max={c.max}
                                  value={r[c.name] ?? ''}
                                  disabled={busy}
                                  onChange={(e) => setRow(f.name, i, c.name, e.target.value)}
                                />
                                {c.unit && <span className="xeplr-factory-ask-unit">{c.unit}</span>}
                              </span>
                            </label>
                          ))}
                          {rows.length > keep && (
                            <button type="button" className="xeplr-factory-ask-row-remove" aria-label={`Remove ${(f.rowLabel || 'row').toLowerCase()} ${i + 1}`} disabled={busy} onClick={() => dropRow(f.name, i)}>×</button>
                          )}
                        </div>
                      ))}
                      {rows.length < max && (
                        <button type="button" className="xeplr-factory-secondary xeplr-factory-ask-row-add" disabled={busy} onClick={() => addRow(f)}>+ {f.addLabel || `Add ${(f.rowLabel || 'row').toLowerCase()}`}</button>
                      )}
                      {shown[f.name] && <span className="xeplr-factory-ask-field-error" id={`${fid}-error`} role="alert">{shown[f.name]}</span>}
                    </fieldset>
                  )
                }
                if (f.type === 'checkbox') {
                  return (
                    <div key={f.name} style={rowStart(f)} className="xeplr-factory-ask-field xeplr-factory-ask-checkbox">
                      <label className="xeplr-factory-ask-check" htmlFor={fid}>
                        <input id={fid} type="checkbox" checked={given[f.name] === true} disabled={busy}
                          aria-invalid={shown[f.name] ? true : undefined} aria-describedby={shown[f.name] ? `${fid}-error` : undefined}
                          onChange={(e) => { const on = e.target.checked; setGiven((g) => ({ ...g, [f.name]: on })); setShown((m) => ({ ...m, [f.name]: undefined })) }} />
                        <span className="xeplr-factory-ask-label">{f.label}{f.required ? ' *' : ''}</span>
                      </label>
                      {shown[f.name] && <span className="xeplr-factory-ask-field-error" id={`${fid}-error`} role="alert">{shown[f.name]}</span>}
                    </div>
                  )
                }
                if (f.type === 'choice') {
                  const fed = isFedChoice(f) ? (offered[f.name] || { loading: true, list: [] }) : null
                  const choices = fed ? fed.list.map((o) => ({ value: o.id, label: o.sub ? `${o.label} · ${o.sub}` : o.label })) : askChoiceOptions(f)
                  return (
                    <div key={f.name} style={rowStart(f)} className="xeplr-factory-ask-field">
                      <label className="xeplr-factory-ask-label" htmlFor={fid}>{f.label}{f.required ? ' *' : ''}</label>
                      <select
                        id={fid}
                        className="xeplr-factory-ask-input"
                        value={given[f.name] ?? ''}
                        disabled={busy}
                        aria-invalid={shown[f.name] ? true : undefined}
                        aria-describedby={shown[f.name] ? `${fid}-error` : undefined}
                        onChange={(e) => { const v = e.target.value; setGiven((g) => ({ ...g, [f.name]: v })); setShown((m) => ({ ...m, [f.name]: undefined })) }}
                      >
                        <option value="">{fed && fed.loading ? 'Loading…' : fed && !fed.list.length && !fed.error ? 'Nothing to choose' : 'Choose…'}</option>
                        {choices.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {f.scan && fed && fed.list.length > 0 && (
                        <div className="xeplr-factory-ask-scan">
                          <input
                            className="xeplr-factory-ask-input"
                            type="text"
                            autoComplete="off"
                            placeholder="Or scan / type its code, then Enter"
                            aria-label={`${f.label}: choose by code`}
                            value={(codes[f.name] || {}).typed || ''}
                            disabled={busy}
                            onChange={(e) => setCodes((c) => ({ ...c, [f.name]: { ...(c[f.name] || {}), typed: e.target.value } }))}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return
                              e.preventDefault()
                              const out = chooseByCode(fed.list, e.target.value, f.scanMiss)
                              if (out.option) { const v = String(out.value); setGiven((g) => ({ ...g, [f.name]: v })); setShown((m) => ({ ...m, [f.name]: undefined })) }
                              setCodes((c) => ({ ...c, [f.name]: { typed: out.option ? '' : e.target.value, said: out.message, bad: !out.option } }))
                            }}
                          />
                          {(codes[f.name] || {}).said && <span className={(codes[f.name] || {}).bad ? 'xeplr-factory-ask-field-error' : 'xeplr-factory-hint'} role={(codes[f.name] || {}).bad ? 'alert' : 'status'}>{codes[f.name].said}</span>}
                        </div>
                      )}
                      {fed && fed.error && <span className="xeplr-factory-ask-field-error" role="alert">{fed.error}</span>}
                      {shown[f.name] && <span className="xeplr-factory-ask-field-error" id={`${fid}-error`} role="alert">{shown[f.name]}</span>}
                    </div>
                  )
                }
                return (
                  <div key={f.name} style={rowStart(f)} className="xeplr-factory-ask-field">
                    <label className="xeplr-factory-ask-label" htmlFor={fid}>{f.label}{f.required ? ' *' : ''}</label>
                    <span className="xeplr-factory-ask-value">
                      <input
                        id={fid}
                        className="xeplr-factory-ask-input"
                        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                        inputMode={f.type === 'number' ? 'decimal' : undefined}
                        step={f.type === 'number' ? 'any' : undefined}
                        min={f.type === 'date' ? askDayLimit(f.min) : f.min} max={f.type === 'date' ? askDayLimit(f.max) : f.max}
                        value={given[f.name] ?? ''}
                        aria-invalid={shown[f.name] ? true : undefined}
                        aria-describedby={shown[f.name] ? `${fid}-error` : undefined}
                        onChange={(e) => { const v = e.target.value; setGiven((g) => ({ ...g, [f.name]: v })); setShown((m) => ({ ...m, [f.name]: undefined })) }}
                      />
                      {f.unit && <span className="xeplr-factory-ask-unit">{f.unit}</span>}
                    </span>
                    {shown[f.name] && <span className="xeplr-factory-ask-field-error" id={`${fid}-error`} role="alert">{shown[f.name]}</span>}
                  </div>
                )
              })}
            </div>
          )}
          {ask.note && (
            <label className="xeplr-factory-ask-field" htmlFor={`${titleId}-note`}>
              <span className="xeplr-factory-ask-label">{ask.note}</span>
              <textarea id={`${titleId}-note`} className="xeplr-factory-ask-note" rows={3} maxLength={1000} value={typed} onChange={(e) => setTyped(e.target.value)} />
            </label>
          )}
          {file && (
            <div className="xeplr-factory-ask-field">
              <span className="xeplr-factory-ask-label" id={`${titleId}-file`}>{file.label || (file.multiple ? 'Files' : 'File')}{file.required ? ' *' : ''}</span>
              <FileField
                id={`${titleId}-files`}
                rules={file}
                files={files}
                onChange={setFiles}
                upload={upload}
                readFile={readFile}
                disabled={busy}
                inputProps={{ 'aria-labelledby': `${titleId}-file`, 'aria-required': file.required ? true : undefined }}
              />
            </div>
          )}
          {error && <p className="xeplr-factory-ask-error" role="alert">{error}</p>}
        </div>
        <footer className="xeplr-factory-ask-foot">
          <button type="button" className="xeplr-factory-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={button.variant === 'danger' ? 'xeplr-factory-danger' : 'xeplr-factory-primary'} onClick={confirm} disabled={busy || missing}>
            {busy ? 'Working…' : button.label}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
