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
//             empty on a row is not offered on that row
import { BADGE_TONES } from './buttons.js'

export const ROW_MENU_ACTIONS = ['open', 'link', 'copy']

/** A steps value as drawn: each with a label, its time ('' when none), done or not, and a known tone. */
export function journeyOf(value) {
  return (Array.isArray(value) ? value : []).filter((s) => s && typeof s === 'object' && s.label !== undefined && s.label !== null && s.label !== '')
    .map((s) => {
      const done = Boolean(s.done)
      const tone = BADGE_TONES.includes(s.tone) ? s.tone : (done ? 'success' : 'muted')
      return { label: String(s.label), at: s.at === undefined || s.at === null ? '' : String(s.at), done, tone }
    })
}

/** The menu entries one row offers: those it has a value for; open only when the row can open. */
export function menuItemsFor(row, menu, canOpen) {
  return (Array.isArray(menu) ? menu : []).filter((m) => {
    if (!m || !ROW_MENU_ACTIONS.includes(m.action)) return false
    if (m.action === 'open') return Boolean(canOpen)
    const v = row ? row[m.field] : undefined
    return v !== undefined && v !== null && v !== ''
  })
}
