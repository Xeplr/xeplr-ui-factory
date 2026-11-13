// A fed list's stepper column (display "steps") and the "…" menu at the end of
// each row (the list's rowMenu). What they hold is listRows.js's.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { journeyOf, menuItemsFor } from '../listRows.js'

/**
 * A journey across the cell: a dot per step joined by a line, its label and
 * time under it. On a narrow screen the stepper scrolls sideways inside its
 * cell rather than wrapping, so the steps stay in one line, in order.
 */
export function Steps({ value, marker }) {
  const steps = journeyOf(value)
  if (!steps.length) return <span className="xeplr-factory-cell" {...marker}>—</span>
  return (
    <div className="xeplr-factory-journey" {...marker}>
      <ol>
        {steps.map((s, i) => (
          <li key={i} className={'xeplr-factory-journey-step is-' + s.tone + (s.done ? ' is-done' : '')}>
            <span className="xeplr-factory-journey-dot" aria-hidden="true">
              {s.done ? <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : null}
            </span>
            <span className="xeplr-factory-journey-label">{s.label}</span>
            <span className="xeplr-factory-journey-at">{s.done ? (s.at || '—') : ''}</span>
            <span className="xeplr-factory-sr">{s.done ? ' — done' : ' — not yet'}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** The "…" at the end of a row: its menu's entries this row has. Opening it never opens the row. */
export function RowMenu({ row, menu, onOpen }) {
  const btn = useRef(null)
  const [at, setAt] = useState(null)
  const [copied, setCopied] = useState(null)
  const items = menuItemsFor(row, menu, Boolean(onOpen))

  useEffect(() => {
    if (!at) return undefined
    const close = (e) => { if (e.type === 'keydown' && e.key !== 'Escape') return; setAt(null) }
    const t = setTimeout(() => { document.addEventListener('click', close); document.addEventListener('keydown', close) })
    return () => { clearTimeout(t); document.removeEventListener('click', close); document.removeEventListener('keydown', close) }
  }, [at])

  if (!items.length) return null

  function toggle(e) {
    e.stopPropagation()
    if (at) { setAt(null); return }
    const r = btn.current.getBoundingClientRect()
    setAt({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) })
  }

  function choose(e, m) {
    e.stopPropagation()
    if (m.action === 'open') { setAt(null); onOpen(row); return }
    if (m.action === 'link') { setAt(null); window.open(String(row[m.field]), '_blank', 'noopener,noreferrer'); return }
    const done = () => { setCopied(m.label); setTimeout(() => { setCopied(null); setAt(null) }, 900) }
    if (navigator.clipboard) navigator.clipboard.writeText(String(row[m.field])).then(done, done)
    else done()
  }

  return (
    <>
      <button ref={btn} type="button" className="xeplr-factory-rowmenu-btn" aria-haspopup="menu" aria-expanded={Boolean(at)} aria-label="More" onClick={toggle}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {at && typeof document !== 'undefined' && createPortal(
        <div className="xeplr-factory-rowmenu" role="menu" style={{ top: at.top, right: at.right }} onClick={(e) => e.stopPropagation()}>
          {items.map((m) => (
            <button key={m.label} type="button" role="menuitem" className="xeplr-factory-rowmenu-item" onClick={(e) => choose(e, m)}>
              {copied === m.label ? 'Copied' : m.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
