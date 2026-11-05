import { useState } from 'react'
import { filePicker, isImageFile } from '../controls.js'
import { fileLabel } from '../values.js'
import { useFilePreview } from '../useFilePreview.js'

// THE FILES A FIELD HOLDS, AND THE PICKER THAT ADDS ONE — a file field's, and
// a button's `ask.file`. Presentation only: what an upload is, and how a
// stored picture is read back, are handed in.
//
// On a phone the picker is the phone's own: "Files, gallery or camera" opens
// its menu (Photos, Camera, Files), "Camera only" opens the camera.

/**
 * @param rules     { accept, maxSize, multiple, maxFiles, source }
 * @param files     the stored paths, as a list
 * @param onChange  (paths) → void
 * @param upload    async (File) → { path }
 * @param readFile  async (path) → Blob — a picture's preview; names only without it
 */
export default function FileField({ id, rules, files, onChange, onBlur, upload, readFile, disabled, design, inputProps, style }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)
  const r = rules || {}
  const picker = filePicker(r)
  const several = Boolean(r.multiple)
  const list = Array.isArray(files) ? files : []
  const full = several ? Boolean(r.maxFiles) && list.length >= r.maxFiles : list.length >= 1

  // One at a time, in the order chosen: each answer is added as it lands, so a
  // refusal of the third keeps the first two.
  const choose = async (chosen) => {
    if (!chosen.length || !upload) return
    setFailed(null)
    setBusy(true)
    let next = list
    try {
      const room = several ? (r.maxFiles ? Math.max(r.maxFiles - list.length, 0) : chosen.length) : 1
      if (chosen.length > room) setFailed(`At most ${r.maxFiles} files — the first ${room} were added`)
      for (const file of chosen.slice(0, room)) {
        const out = await upload(file)
        if (out && out.path) { next = several ? [...next, out.path] : [out.path]; onChange(next) }
      }
    } catch (e) {
      setFailed(e && e.message ? e.message : 'The file could not be uploaded')
    } finally {
      setBusy(false)
      if (onBlur) onBlur()
    }
  }

  const remove = (path) => { onChange(list.filter((p) => p !== path)); if (onBlur) onBlur() }
  const hint = [r.accept || 'any file', r.maxSize ? `up to ${r.maxSize} MB` : null, several && r.maxFiles ? `at most ${r.maxFiles} files` : null].filter(Boolean).join(' · ')

  return (
    <div className="xeplr-factory-files">
      {list.length > 0 && (
        <ul className="xeplr-factory-files-list">
          {list.map((path) => (
            <FileItem key={path} path={path} readFile={readFile} disabled={disabled || busy} onRemove={() => remove(path)} />
          ))}
        </ul>
      )}
      {!full && (
        <label className={`xeplr-factory-files-add${disabled || busy ? ' xeplr-factory-files-add--off' : ''}`} style={style}>
          <input
            className="xeplr-factory-files-input"
            type="file"
            accept={picker.accept || undefined}
            multiple={picker.multiple || undefined}
            capture={picker.capture}
            disabled={disabled || busy}
            onChange={(e) => { const chosen = Array.from(e.target.files || []); e.target.value = ''; choose(chosen) }}
            {...(inputProps || {})}
            id={id}
          />
          <span className="xeplr-factory-files-add-label">
            {busy ? 'Uploading…' : r.source === 'camera' ? (list.length ? 'Take another photo' : 'Take a photo') : list.length ? 'Add another' : several ? 'Choose files' : 'Choose a file'}
          </span>
        </label>
      )}
      {failed && <div className="xeplr-factory-files-error" role="alert">{failed}</div>}
      {!busy && !list.length && (design || r.accept) && <div className="xeplr-factory-hint">{hint}</div>}
    </div>
  )
}

function FileItem({ path, readFile, disabled, onRemove }) {
  const preview = useFilePreview(path, readFile)
  const picture = isImageFile(path)
  return (
    <li className="xeplr-factory-files-item">
      {picture && preview.url
        ? <img className="xeplr-factory-files-thumb" src={preview.url} alt="" />
        : <span className="xeplr-factory-files-icon" aria-hidden="true">{picture ? '🖼' : '📄'}</span>}
      <span className="xeplr-factory-files-name" title={fileLabel(path)}>{fileLabel(path)}</span>
      <button type="button" className="xeplr-factory-files-remove" disabled={disabled} onClick={onRemove} aria-label={`Remove ${fileLabel(path)}`}>Remove</button>
    </li>
  )
}
