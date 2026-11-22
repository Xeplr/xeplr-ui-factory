// What a function-fed list row carries for two column kinds and its menu.
// Pure: no React — the designs draw them (designs/FedList.jsx, listExtras.jsx).
//
//   steps     a column whose value is a journey: [{ label, at, done, tone? }],
//             drawn as a stepper — a dot per step (filled when done), joined
//             by a line, the label and its time under it. tone: success when
//             done (danger for a late step), muted when not
//   rowMenu   the "…" at the end of each row: [{ label, action, field? }] —
//             open (the row, as a click on it), link (the URL in `field`, in a
//             new tab) or copy (the text in `field`). An entry whose field is
//             empty on a row is not offered on that row.
//             run: a BUTTON on that row's record — { label, action: "run", id,
//             run: "<function>", params?, ask?, when?, variant? } — pressed
//             as a buttons panel's are (buttons.js), offered when its `when`
//             holds for the row
import { BADGE_TONES } from './tones.js'
import { buttonShown } from './buttons.js'

export const ROW_MENU_ACTIONS = ['open', 'link', 'copy', 'run']

/** The keys a "run" entry may carry besides label, action and id. */
export const ROW_RUN_KEYS = ['run', 'params', 'ask', 'when', 'disabledWhen', 'variant']

/** A "run" entry as the button it is: { id, label, action: <function>, params?, ask?, when?, … }. */
export function rowMenuButton(m) {
  if (!m || m.action !== 'run') return null
  const b = { id: m.id, label: m.label, action: m.run }
  ;['params', 'ask', 'when', 'disabledWhen', 'variant'].forEach((k) => { if (m[k] !== undefined) b[k] = m[k] })
  return b
}

/** A list's "run" entries, as buttons. */
export function rowMenuButtons(node) {
  const menu = node && node.type === 'list' && node.props && Array.isArray(node.props.rowMenu) ? node.props.rowMenu : []
  return menu.map(rowMenuButton).filter(Boolean)
}

/** A steps value as drawn: each with a label, its time ('' when none), done or not, and a known tone. */
export function journeyOf(value) {
  return (Array.isArray(value) ? value : []).filter((s) => s && typeof s === 'object' && s.label !== undefined && s.label !== null && s.label !== '')
    .map((s) => {
      const done = Boolean(s.done)
      const tone = BADGE_TONES.includes(s.tone) ? s.tone : (done ? 'success' : 'muted')
      // sub: a second line under the time — who did it, a note. Optional.
      return { label: String(s.label), at: s.at === undefined || s.at === null ? '' : String(s.at), sub: s.sub === undefined || s.sub === null ? '' : String(s.sub), done, tone }
    })
}

/** The menu entries one row offers: those it has a value for; open only when the row can open. */
export function menuItemsFor(row, menu, canOpen) {
  return (Array.isArray(menu) ? menu : []).filter((m) => {
    if (!m || !ROW_MENU_ACTIONS.includes(m.action)) return false
    if (m.action === 'open') return Boolean(canOpen)
    if (m.action === 'run') return buttonShown(rowMenuButton(m), row || {})
    const v = row ? row[m.field] : undefined
    return v !== undefined && v !== null && v !== ''
  })
}
