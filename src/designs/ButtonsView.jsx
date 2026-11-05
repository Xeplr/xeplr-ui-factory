import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { boxStyle, fieldStyle } from './styles.js'
import FileField from './FileField.jsx'
import { askFields, askFieldStart, askFieldValues } from '../buttons.js'

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
          readFile={panel.readFile}
          record={panel.record}
          onConfirm={async (typed, files, values) => { if (await panel.press(asking, typed, files, values)) setAsking(null) }}
        />
      )}
    </div>
  )
}

/** "Change status to Packed?" — the button's message, its fields, a note and files when it takes them. */
function AskDialog({ button, busy, error, onCancel, onConfirm, upload, readFile, record }) {
  const ask = button.ask || {}
  const file = ask.file && typeof ask.file === 'object' ? ask.file : null
  const fields = askFields(button)
  const [typed, setTyped] = useState('')
  const [files, setFiles] = useState([])
  // Each asked value starts from the record (`fill`): asked again, it shows what was given last.
  const [given, setGiven] = useState(() => Object.fromEntries(fields.map((f) => [f.name, askFieldStart(f, record)])))
  const [shown, setShown] = useState({})          // field → message, after a try
  const confirm = () => {
    const out = askFieldValues(button, given)
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
      <div ref={ref} className="xeplr-factory-modal xeplr-factory-ask" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="xeplr-factory-modal-head">
          <span className="xeplr-factory-modal-title" id={titleId}>{ask.title || `${button.label}?`}</span>
          <button type="button" className="xeplr-factory-modal-close" onClick={onCancel} disabled={busy} aria-label="Close">×</button>
        </header>
        <div className="xeplr-factory-modal-body">
          {ask.message && <p className="xeplr-factory-ask-message">{ask.message}</p>}
          {fields.length > 0 && (
            <div className="xeplr-factory-ask-fields">
              {fields.map((f) => {
                const fid = `${titleId}-${f.name}`
                return (
                  <div key={f.name} className="xeplr-factory-ask-field">
                    <label className="xeplr-factory-ask-label" htmlFor={fid}>{f.label}{f.required ? ' *' : ''}</label>
                    <span className="xeplr-factory-ask-value">
                      <input
                        id={fid}
                        className="xeplr-factory-ask-input"
                        type={f.type === 'number' ? 'number' : 'text'}
                        inputMode={f.type === 'number' ? 'decimal' : undefined}
                        step={f.type === 'number' ? 'any' : undefined}
                        min={f.min} max={f.max}
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
