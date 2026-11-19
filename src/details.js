// A RECORD'S DETAILS — what is known about one record, read only, in
// sections: an order's products, its contact and address, its shipping
// updates. Pure: no React, no fetching — used by the controller, by the server
// (@xeplr/factory reads it through ./model) and by any other renderer.
//
// The SECTIONS are worked out by a function of the app, registered with
// @xeplr/actions for event "recordDetails" and named in the control's
// `detailsFrom`. It is given the record the screen is about (ctx.record,
// ctx.id) — so it can add what is not a column: what the shop knows, what a
// courier said — and returns sections. Everything is TEXT THE SERVER WROTE.
//
// A row's `tone` (one of the badge tones: success, warning, danger…) colours it.
//
// Two sections are drawn differently, across the whole width, above the rest:
//   { kind: 'header', title: '#GA3068', sub: 'Naresh, Chennai',
//     badges: [{ text: 'Ordered', tone: 'accent' }], aside: '₹8,883 · COD' }
//                                   the record's own line: big title, pills
//   { kind: 'journey', title: 'Timeline',
//     steps: [{ label: 'Placed', at: '19 Nov', sub: 'Shopify', done: true, tone? }] }
//                                   a dot per step joined by a line — where it is
//
//   { sections: [
//       { title: 'Contact',
//         rows: [{ label: 'Phone', text: '+91 98…', href: 'tel:+9198…' },
//                { label: 'Address', text: '12 MG Road\nBengaluru' }] },
//       { title: 'Products',
//         items: [{ src, name, detail, qty }] } ],
//     more: true }                 ← a "More" button: asked again with ctx.query.more
//
// A row with nothing to say is left out — "shows only what the record has".
// `href` may be a web address, tel: or mailto: — nothing else, so a value can
// never be a script. With `more`, a "More" button asks the function again with
// ctx.query.more = true; what it answers then is drawn under the rest, and is
// never saved anywhere.

import { BADGE_TONES } from './tones.js'
import { journeyOf } from './listRows.js'

export const DETAILS_EVENT = 'recordDetails'

/** Most sections, rows per section and items per section kept from one answer. */
export const MAX_SECTIONS = 20
export const MAX_ROWS = 50
export const MAX_ITEMS = 100
/** Most characters of one value. */
export const MAX_DETAIL_TEXT = 2000

const HREF = /^(https?:\/\/|tel:|mailto:)/i

function text(v) {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

/** A link a value may carry — http(s), tel: or mailto: — or null. */
export function safeHref(v) {
  const s = text(v).trim()
  return s && HREF.test(s) ? s : null
}

/**
 * What a recordDetails function returned, as sections a renderer can draw.
 * Rows with no text and sections with nothing in them are dropped.
 * Accepts { sections, more } or the sections alone.
 */
export function detailsOf(out) {
  const list = Array.isArray(out) ? out : out && Array.isArray(out.sections) ? out.sections : []
  const sections = []
  for (const s of list) {
    if (!s || typeof s !== 'object') continue
    if (s.kind === 'header') {
      if (!text(s.title)) continue
      const badges = (Array.isArray(s.badges) ? s.badges : []).filter((b) => b && text(b.text)).slice(0, 6)
        .map((b) => ({ text: text(b.text), tone: BADGE_TONES.includes(b.tone) ? b.tone : 'muted' }))
      sections.push({ kind: 'header', title: text(s.title), sub: text(s.sub) || null, badges, aside: text(s.aside) || null })
      if (sections.length >= MAX_SECTIONS) break
      continue
    }
    if (s.kind === 'journey') {
      const steps = journeyOf(s.steps).slice(0, MAX_ROWS)
      if (!steps.length) continue
      sections.push({ kind: 'journey', title: text(s.title) || null, steps })
      if (sections.length >= MAX_SECTIONS) break
      continue
    }
    const rows = (Array.isArray(s.rows) ? s.rows : [])
      .filter((r) => r && text(r.text).trim())
      .slice(0, MAX_ROWS)
      .map((r) => ({ label: text(r.label) || null, text: text(r.text).slice(0, MAX_DETAIL_TEXT), href: safeHref(r.href), tone: BADGE_TONES.includes(r.tone) ? r.tone : null }))
    const items = (Array.isArray(s.items) ? s.items : [])
      .filter((i) => i && (text(i.name) || text(i.src)))
      .slice(0, MAX_ITEMS)
      .map((i) => ({ src: safeHref(i.src), name: text(i.name) || null, detail: text(i.detail) || null, qty: Number.isFinite(Number(i.qty)) && i.qty !== null && i.qty !== '' ? Number(i.qty) : null }))
    if (!rows.length && !items.length) continue
    sections.push({ kind: 'facts', title: text(s.title) || null, rows, items })
    if (sections.length >= MAX_SECTIONS) break
  }
  return { sections, more: Boolean(out && !Array.isArray(out) && out.more) }
}

/** Every problem with a details control's props (all but detailsFrom), as [{ path, message }]. */
export function detailsProblems(props, at) {
  const out = []
  const err = (path, message) => out.push({ path, message })
  const p = props || {}
  if (p.title !== undefined && typeof p.title !== 'string') err(`${at}.props.title`, 'must be a string')
  if (p.columns !== undefined && ![1, 2, 3].includes(p.columns)) err(`${at}.props.columns`, 'must be 1, 2 or 3 — how many sections side by side')
  if (p.moreLabel !== undefined && typeof p.moreLabel !== 'string') err(`${at}.props.moreLabel`, 'must be a string — the More button\'s label')
  if (p.empty !== undefined && typeof p.empty !== 'string') err(`${at}.props.empty`, 'must be a string — what shows when there is nothing')
  return out
}
