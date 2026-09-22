// The controls you can put on a screen. Drag one onto the canvas to place it
// where it lands, or click it to add it below everything else.

export const DRAG_TYPE = 'application/x-xeplr-factory-control'

export default function Palette({ groups, onAdd }) {
  return (
    <nav className="xeplr-factory-palette" aria-label="Controls">
      {groups.map((g) => (
        <section key={g.title} className="xeplr-factory-palette-group">
          <h4 className="xeplr-factory-palette-title">{g.title}</h4>
          {g.controls.map((c) => (
            <button
              key={c.type}
              type="button"
              className="xeplr-factory-palette-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, c.type)
                e.dataTransfer.setData('text/plain', c.type)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => onAdd(c.type)}
              title={`Drag onto the screen, or click to add ${c.label.toLowerCase()} at the bottom`}
            >
              {/* A ready-made field wears the icon of the control it is made of. */}
              <span className={`xeplr-factory-palette-icon xeplr-factory-palette-icon--${c.icon || c.type}`} aria-hidden="true" />
              {c.label}
            </button>
          ))}
        </section>
      ))}
    </nav>
  )
}
