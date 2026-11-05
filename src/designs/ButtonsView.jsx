import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { boxStyle, fieldStyle } from './styles.js'
import FileField from './FileField.jsx'

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
          onConfirm={async (typed, files) => { if (await panel.press(asking, typed, files)) setAsking(null) }}
        />
      )}
    </div>
  )
}

/** "Change status to Packed?" — the button's message, a note and files when it takes them. */
function AskDialog({ button, busy, error, onCancel, onConfirm, upload, readFile }) {
  const ask = button.ask || {}
  const file = ask.file && typeof ask.file === 'object' ? ask.file : null
  const [typed, setTyped] = useState('')
  const [files, setFiles] = useState([])
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
          <button type="button" className={button.variant === 'danger' ? 'xeplr-factory-danger' : 'xeplr-factory-primary'} onClick={() => onConfirm(typed, files)} disabled={busy || missing}>
            {busy ? 'Working…' : button.label}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
