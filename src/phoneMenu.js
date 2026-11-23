// A PHONE APP'S MENU — no React. Read from what the server says this person may
// see (@xeplr/ui-account's access: `menus`, the keys allowed, and `menuItems`,
// [{ name, label, sortOrder }] in the order set in Configure UI → Menu), so a
// form added to the menu there is on the phone too, renamed and reordered with
// it, and a role that loses it loses it on the phone as well.
//
//   phoneMenu(access)                    → [{ key, label, kind: 'form', form } | { key, label, kind: 'flows' }]
//   phoneMenu(access, { pages: { Home: { label: 'Today' } } })   an app's own page, by its menu key
//
// What is on the phone: every form added to the menu (key "form:<form>"),
// Flows when the person may open it, and the app's own pages it names. Never
// the designers (Configure UI) or the admin screens — those are for a computer.
export const FORM_PREFIX = 'form:'

export function phoneMenu(access, { flows = true, pages = {} } = {}) {
  const allowed = new Set((access && access.menus) || [])
  const items = (access && access.menuItems) || []
  const out = []
  items.forEach((m) => {
    if (!m || !m.name || !allowed.has(m.name) || m.isHidden) return
    const label = m.label || m.name
    if (m.name.startsWith(FORM_PREFIX)) out.push({ key: m.name, label, kind: 'form', form: m.name.slice(FORM_PREFIX.length) })
    else if (m.name === 'Flows' && flows) out.push({ key: m.name, label, kind: 'flows' })
    else if (pages[m.name]) out.push({ ...pages[m.name], key: m.name, label: pages[m.name].label || label, kind: 'page' })
  })
  return out
}
