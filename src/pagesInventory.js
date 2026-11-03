// WHICH PAGES WORK EVERYWHERE, AND WHICH ARE WEB ONLY.
//
// A page drawn from screen documents (a form's list, a flow's screens, a list
// fed by a function, a panel of buttons) can be drawn by anything that reads
// a document — a phone app included. A page written by hand in React cannot:
// it is the browser's alone.
//
// Writing one is allowed. Doing it without anyone knowing is what this file
// is for. Each app keeps an inventory, ui/pages.json:
//
//   {
//     "routes": ["src/App.jsx"],
//     "documents": [{ "path": "/orders", "menu": "Orders", "screen": "orders_board" }],
//     "webOnly":   [{ "path": "/home", "menu": "Home", "reason": "The dashboard's cards are hand-written" }]
//   }
//
// and `xeplr-factory pages` WARNS — it never refuses — about every web-only
// page, and about every route the inventory does not mention. The menu key
// lets a settings screen tag that menu item "Web only".
//
// Pure: no React, no file system. The CLI reads the files.

/** Whatever is wrong with the inventory itself, as [{ path, message }]. */
export function checkInventory(inv) {
  const errors = []
  const err = (path, message) => errors.push({ path, message })
  if (!inv || typeof inv !== 'object' || Array.isArray(inv)) { err('', 'must be an object: { routes, documents, webOnly }'); return errors }
  if (inv.routes !== undefined && !(Array.isArray(inv.routes) && inv.routes.every((r) => typeof r === 'string' && r))) err('routes', 'must be the files that declare the routes, e.g. ["src/App.jsx"]')
  ;['documents', 'webOnly'].forEach((list) => {
    if (inv[list] === undefined) return
    if (!Array.isArray(inv[list])) { err(list, 'must be an array of { path, … }'); return }
    inv[list].forEach((p, i) => {
      const at = `${list}[${i}]`
      if (!p || typeof p !== 'object') { err(at, 'must be { path, … }'); return }
      if (typeof p.path !== 'string' || !p.path.startsWith('/')) err(`${at}.path`, 'must be a route path, e.g. "/orders/:orderId"')
      if (p.menu !== undefined && (typeof p.menu !== 'string' || !p.menu)) err(`${at}.menu`, 'must be the menu key it is under, e.g. "Orders"')
      if (list === 'webOnly' && !(typeof p.reason === 'string' && p.reason.trim())) err(`${at}.reason`, 'is required — say why it is hand-written, so the next person knows what it would take to make it a document')
    })
  })
  const seen = new Map()
  ;[...(inv.documents || []), ...(inv.webOnly || [])].forEach((p) => {
    if (!p || typeof p.path !== 'string') return
    if (seen.has(p.path)) err('', `"${p.path}" is listed twice`)
    seen.set(p.path, true)
  })
  return errors
}

/**
 * The route paths a routes file declares: every <Route path="…">, except
 * redirects (an element that is a <Navigate>) and the catch-all "*".
 */
export function routesIn(source) {
  const out = []
  const re = /<Route\b[^>]*?\bpath=(?:"([^"]+)"|'([^']+)'|\{\s*["'`]([^"'`]+)["'`]\s*\})[^>]*>/g
  let m
  while ((m = re.exec(String(source || '')))) {
    const path = m[1] || m[2] || m[3]
    if (!path || path === '*') continue
    if (/element=\{\s*<Navigate\b/.test(m[0])) continue
    out.push(path)
  }
  return [...new Set(out)]
}

/**
 * The warnings for an app: each web-only page, and each route nobody
 * listed. [{ kind: 'webOnly' | 'unlisted' | 'gone' | 'inventory', path, message }]
 */
export function pageWarnings(inv, routes) {
  const warnings = checkInventory(inv).map((e) => ({ kind: 'inventory', path: e.path, message: `pages.json ${e.path ? e.path + ' ' : ''}${e.message}` }))
  const docs = new Set(((inv && inv.documents) || []).map((p) => p && p.path))
  const web = ((inv && inv.webOnly) || []).filter((p) => p && p.path)
  web.forEach((p) => warnings.push({ kind: 'webOnly', path: p.path, message: `${p.path} is web only — it will not be in a phone app. ${p.reason || ''}`.trim() }))
  const listed = new Set([...docs, ...web.map((p) => p.path)])
  ;(routes || []).forEach((r) => {
    if (!listed.has(r)) warnings.push({ kind: 'unlisted', path: r, message: `${r} is not in pages.json — say whether it is drawn from documents ("documents") or hand-written ("webOnly", with the reason)` })
  })
  // A listed page the routes no longer have: the inventory is out of date.
  if (routes) listed.forEach((p) => { if (!routes.includes(p)) warnings.push({ kind: 'gone', path: p, message: `${p} is in pages.json but no route declares it any more — remove it` }) })
  return warnings
}

/** { menu key → why } for the menu items whose page is web only — a settings screen tags them. */
export function webOnlyMenus(inv) {
  const out = {}
  ;((inv && inv.webOnly) || []).forEach((p) => {
    if (p && p.menu && !out[p.menu]) out[p.menu] = p.reason || 'Hand-written for the browser'
  })
  return out
}
