import { useEffect, useRef } from 'react'

// The popup a list's Edit / New opens its edit screen in.
//
// A real dialog: focus moves in, Escape and the backdrop close it, and focus
// returns to whatever opened it. Closing is the host's onClose, which asks
// before dropping unsaved changes (FactoryScreen in pages.jsx).

export default function ScreenModal({ title, width, onClose, children }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const opener = typeof document !== 'undefined' ? document.activeElement : null
    dialogRef.current?.focus()
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener && opener.focus) opener.focus()
    }
  }, [onClose])

  return (
    <div className="xeplr-factory-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={dialogRef}
        className="xeplr-factory-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ width: width ? `min(${width + 48}px, 96vw)` : undefined }}
      >
        <header className="xeplr-factory-modal-head">
          <span className="xeplr-factory-modal-title">{title}</span>
          <button type="button" className="xeplr-factory-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="xeplr-factory-modal-body">{children}</div>
      </div>
    </div>
  )
}
