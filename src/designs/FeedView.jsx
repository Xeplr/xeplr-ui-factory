import { useRef, useState } from 'react'
import { boxStyle, fieldStyle } from './styles.js'
import { filePicker, isImageFile } from '../controls.js'
import { initials } from '../feed.js'
import { fileLabel as fileName } from '../values.js'
import { useFilePreview } from '../useFilePreview.js'

// A RECORD'S FEED, DRAWN — comments as full rows (avatar, name, badge, when,
// what was said, its file), the record's history as quiet one-line rows
// between them, and the box to write a comment. Presentation only: the
// entries, the switch and the posting are the controller's (useFeeds.js).
//
// On the canvas (design) it shows what it will look like, with no entries.

export default function FeedView({ node, design, feed }) {
  const p = node.props || {}
  const style = { ...fieldStyle(p.style), ...boxStyle(p.style) }

  if (design || !feed) {
    return (
      <div className="xeplr-factory-feed xeplr-factory-feed--design" style={style}>
        {p.title && <div className="xeplr-factory-feed-head"><span className="xeplr-factory-feed-title">{p.title}</span></div>}
        <span className="xeplr-factory-hint">
          {p.entriesFrom ? `Comments and history from “${p.entriesFrom}”` : 'Pick the function its entries come from, in Properties.'}
        </span>
        {p.compose && p.compose.screen && <div className="xeplr-factory-feed-compose"><span className="xeplr-factory-feed-input xeplr-factory-feed-input--design">{p.compose.placeholder || 'Write a comment…'}</span></div>}
      </div>
    )
  }

  return (
    <div className="xeplr-factory-feed" style={style}>
      {(p.title || (p.eventsSwitch && feed.hasEvents)) && (
        <div className="xeplr-factory-feed-head">
          {p.title && <span className="xeplr-factory-feed-title">{p.title}</span>}
          {p.eventsSwitch && feed.hasEvents && (
            <label className="xeplr-factory-feed-switch">
              <input type="checkbox" checked={feed.commentsOnly} onChange={(e) => feed.setCommentsOnly(e.target.checked)} />
              Comments only
            </label>
          )}
        </div>
      )}
      {feed.compose && p.order !== 'oldest' && <Compose node={node} compose={feed.compose} />}
      <div className="xeplr-factory-feed-entries" aria-busy={feed.loading || undefined}>
        {feed.waiting && <span className="xeplr-factory-hint">Save first — comments belong to a saved record.</span>}
        {feed.error && <span className="xeplr-factory-feed-error" role="alert">{feed.error}</span>}
        {!feed.waiting && !feed.error && !feed.loading && feed.entries.length === 0 && (
          <span className="xeplr-factory-hint">{p.empty || 'Nothing here yet.'}</span>
        )}
        {feed.entries.map((e) => (e.kind === 'event'
          ? <EventRow key={e.id} entry={e} />
          : <CommentRow key={e.id} entry={e} readFile={feed.readFile} />))}
      </div>
      {feed.compose && p.order === 'oldest' && <Compose node={node} compose={feed.compose} />}
    </div>
  )
}

function CommentRow({ entry, readFile }) {
  const name = entry.author ? entry.author.name : ''
  return (
    <div className="xeplr-factory-feed-comment">
      <span className="xeplr-factory-feed-avatar" aria-hidden="true">{initials(name)}</span>
      <div className="xeplr-factory-feed-body">
        <div className="xeplr-factory-feed-meta">
          {name && <strong>{name}</strong>}
          {entry.author && entry.author.badge && <span className="xeplr-factory-feed-badge">{entry.author.badge}</span>}
          {entry.at && <span className="xeplr-factory-feed-at">{entry.at}</span>}
        </div>
        {entry.sub && <div className="xeplr-factory-feed-sub">{entry.sub}</div>}
        {entry.text && <div className="xeplr-factory-feed-text">{entry.text}</div>}
        {entry.files.length > 0 && (
          <div className="xeplr-factory-feed-files">
            {entry.files.map((f) => <Attachment key={f.path} file={f} readFile={readFile} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function EventRow({ entry }) {
  return (
    <div className="xeplr-factory-feed-event">
      <span className="xeplr-factory-feed-dot" aria-hidden="true" />
      <span className="xeplr-factory-feed-event-text">
        {entry.text}
        {entry.author && <> · {entry.author.name}</>}
        {entry.sub && <> · {entry.sub}</>}
      </span>
      {entry.at && <span className="xeplr-factory-feed-at">{entry.at}</span>}
    </div>
  )
}

/** A picture as a thumbnail; anything else as a chip that downloads it. */
function Attachment({ file, readFile }) {
  const name = file.name || fileName(file.path)
  const picture = isImageFile(file.path)
  const preview = useFilePreview(picture ? file.path : null, readFile)
  const [failed, setFailed] = useState(false)
  const download = async () => {
    if (!readFile) return
    try {
      const blob = await readFile(file.path)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = name
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setFailed(true)
    }
  }
  if (picture && preview.url) {
    return (
      <a className="xeplr-factory-feed-thumb" href={preview.url} target="_blank" rel="noreferrer" title={name}>
        <img src={preview.url} alt={name} />
      </a>
    )
  }
  return (
    <button type="button" className="xeplr-factory-feed-file" onClick={download} disabled={!readFile} title={failed ? 'Could not download' : 'Download'}>
      {name}{failed ? ' — could not download' : ''}
    </button>
  )
}

function Compose({ node, compose }) {
  const input = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState(null)
  const picker = compose.fileRules ? filePicker(compose.fileRules) : null
  const choose = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file || !compose.upload) return
    setFileError(null)
    setUploading(true)
    try { await compose.upload(file) } catch (err) { setFileError(err.message || 'Could not attach') } finally { setUploading(false) }
  }
  const busy = compose.posting || uploading
  const id = `xeplr-factory-feed-${node.id}`
  return (
    <div className="xeplr-factory-feed-compose">
      <textarea
        id={id}
        className="xeplr-factory-feed-input"
        rows={2}
        placeholder={compose.placeholder}
        aria-label={compose.placeholder}
        value={compose.text}
        disabled={compose.posting}
        onChange={(e) => compose.setText(e.target.value)}
        // Ctrl/⌘ + Enter posts; Enter alone is a new line.
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); compose.post() } }}
      />
      <div className="xeplr-factory-feed-compose-bar">
        {compose.upload && (
          <>
            <input ref={input} type="file" hidden accept={picker ? picker.accept : undefined} capture={picker ? picker.capture : undefined} onChange={choose} />
            {compose.file
              ? <span className="xeplr-factory-feed-file xeplr-factory-feed-file--chosen">
                  {compose.file.name || fileName(compose.file.path)}
                  <button type="button" className="xeplr-factory-feed-unattach" aria-label="Remove the file" onClick={compose.removeFile} disabled={busy}>×</button>
                </span>
              : <button type="button" className="xeplr-factory-secondary" onClick={() => input.current && input.current.click()} disabled={busy}>
                  {uploading ? 'Attaching…' : 'Attach'}
                </button>}
          </>
        )}
        {(compose.error || fileError) && <span className="xeplr-factory-feed-error" role="alert">{compose.error || fileError}</span>}
        <button type="button" className="xeplr-factory-primary xeplr-factory-feed-post" onClick={() => compose.post()} disabled={busy}>
          {compose.posting ? 'Posting…' : compose.button}
        </button>
      </div>
    </div>
  )
}
