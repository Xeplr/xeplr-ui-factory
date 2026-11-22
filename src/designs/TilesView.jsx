// MENU TILES on the web (tiles.js): a grid of large tiles, each a place in the
// app — its icon, its name, a line under it when the app gives one. A tile is
// a link when it has a path (opens in a new tab with the usual keys), and a
// press is the app's (onNavigate). In the designer: three sample tiles.
import { boxStyle, fieldStyle } from './styles.js'

export default function TilesView({ node, design, tiles }) {
  const p = node.props || {}
  const style = { ...fieldStyle(p.style), ...boxStyle(p.style) }
  if (design) {
    return (
      <div className="xeplr-factory-tiles xeplr-factory-tiles--design" style={style}>
        {p.title ? <div className="xeplr-factory-tiles-title">{p.title}</div> : null}
        <div className="xeplr-factory-tiles-grid">
          {['Orders', 'Movements', 'Places'].map((t) => <span key={t} className="xeplr-factory-tile"><span className="xeplr-factory-tile-label">{t}</span></span>)}
        </div>
        <span className="xeplr-factory-hint">The app's menu — each person sees what they may open</span>
      </div>
    )
  }
  const items = (tiles && tiles.items) || []
  if (!items.length) return null
  const open = tiles && tiles.open
  return (
    <nav className="xeplr-factory-tiles" style={style} aria-label={p.title || 'Go to'}>
      {p.title ? <div className="xeplr-factory-tiles-title">{p.title}</div> : null}
      <div className="xeplr-factory-tiles-grid">
        {items.map((t) => {
          const body = (
            <>
              {t.icon ? <span className="xeplr-factory-tile-icon" aria-hidden="true">{t.icon}</span> : null}
              <span className="xeplr-factory-tile-label">{t.label}</span>
              {t.description ? <span className="xeplr-factory-tile-sub">{t.description}</span> : null}
            </>
          )
          // A real link when there is a path — ctrl/⌘-click and middle-click open a tab;
          // a plain click is the app's own navigation.
          return t.path
            ? <a key={t.key} className="xeplr-factory-tile" href={t.path}
                 onClick={(e) => { if (!open || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); open(t) }}>{body}</a>
            : <button key={t.key} type="button" className="xeplr-factory-tile" onClick={() => open && open(t)} disabled={!open}>{body}</button>
        })}
      </div>
    </nav>
  )
}
