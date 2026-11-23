// TILES — a grid of large tiles, each a place in the app to go to: a Home
// page's way to everything ("Orders", "Movements", "Places").
//
//   { "type": "tiles", "props": { "title": "Go to", "exclude": ["Home"] } }
//
// WHAT the tiles are is the APP's, never the document's: who may open what is
// decided by the app's menu (per person), so the host hands it in —
//   <FactoryScreen menu={[{ key, label, icon?, path?, description? }]} onNavigate={(item) => …} />
// — in the menu's order. The document only says where the tiles go, their
// title, and which keys to leave out (the page itself: Home on Home).
//
// Pure: no React. The views are designs/TilesView.jsx and native/NativeTiles.jsx.

/** Most tiles one control shows. */
export const MAX_TILES = 60

const text = (v) => (v === undefined || v === null ? '' : String(v))

/**
 * The tiles to draw from the host's menu: each with a key and a label (the
 * key when it has none), without the ones `exclude` names, at most MAX_TILES,
 * each key once.
 */
export function tilesOf(menu, exclude) {
  const skip = new Set((Array.isArray(exclude) ? exclude : []).map(text))
  const seen = new Set()
  const out = []
  ;(Array.isArray(menu) ? menu : []).forEach((m) => {
    if (out.length >= MAX_TILES || !m || typeof m !== 'object') return
    const key = text(m.key).trim()
    if (!key || skip.has(key) || seen.has(key)) return
    seen.add(key)
    const tile = { key, label: text(m.label).trim() || key }
    if (m.icon !== undefined && m.icon !== null) tile.icon = m.icon
    if (text(m.path).trim()) tile.path = text(m.path).trim()
    if (text(m.description).trim()) tile.description = text(m.description).trim()
    out.push(tile)
  })
  return out
}
