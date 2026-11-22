// BUTTONS AND FUNCTION-FED LISTS — the parts of a screen that run the app's
// own code, named in the document and registered on the server.
//
// A button is an ACTION NAME PLUS PARAMETERS. Eight status buttons are one
// registered function, setOrderStatus, and eight buttons that give it a
// different `status`:
//
//   { id: 'packed', label: 'Packed', action: 'setOrderStatus', params: { status: 'packed' },
//     ask: { title: 'Change status to Packed', note: 'Reason (optional)' },
//     pressedWhen:  [{ field: 'customStatus', op: 'eq', value: 'packed' }],
//     disabledWhen: [{ field: 'customStatus', op: 'eq', value: 'packed' }] }
//
// The function lives in the app, registered with @xeplr/actions and an
// `event` saying what it is for:
//
//   button      a button's press. Its inputSchema says which parameters it
//               takes — and, with `options`, which values each may have — so
//               the designer offers them and publishing checks them.
//   listRows    the rows of a list that are worked out rather than read from
//               one table: { rows, counts } for a search and a filter chip.
//   rowDetails  what a list cell's hover box lists for one row.
//   suggest     an autocomplete field's suggestions as the person types (suggest.js).
//   feedEntries a record's comments and history, for a feed (feed.js).
//   recordDetails  what is known about a record, for a details panel (details.js).
//   buttonOptions  what a button's checklist offers, worked out for the record
//               it is pressed on: the products still out on this movement.
//
// Nothing here runs code. A document holds names and values only, so the same
// screen can be drawn by anything that reads it, and what a button may do is
// decided on the server, where nobody can skip it.
//
// Conditions — when a button shows, when it is disabled — are @xeplr/rules
// rules, the same condition language as the rest of xeplr, read from the
// record the screen is about. Every rule must match.

import { matches, OPERATORS } from '@xeplr/rules'
import { SUGGEST_EVENT as SUGGEST, MAX_CODE, sameCode, missMessage } from './suggest.js'
import { FEED_EVENT } from './feed.js'
import { DETAILS_EVENT } from './details.js'
import { rowMenuButton, rowMenuButtons } from './listRows.js'

export const BUTTON_EVENT = 'button'
export const LIST_ROWS_EVENT = 'listRows'
export const ROW_DETAILS_EVENT = 'rowDetails'
export const BUTTON_OPTIONS_EVENT = 'buttonOptions'

/** Most entries a checklist offers. */
export const MAX_CHECKLIST_OPTIONS = 200
export { SUGGEST_EVENT } from './suggest.js'

/** How a button looks: an ordinary one, the main one, or one that undoes or removes. */
export const BUTTON_VARIANTS = ['default', 'primary', 'danger']

/**
 * What a list column can be drawn as. Every one shows text the server wrote.
 * "items" is a row's things, each a picture with its name, a detail line and
 * how many: [{ src, name, detail, qty }] — on a card, the pictures are large.
 * "chip" is the text as a rounded pill in the column's tone (or the cell's,
 * toneFrom) — a neutral grey one when it is 0 or empty; with iconFrom, an icon
 * in it. "steps" is a journey, [{ label, at, done, tone? }], as a stepper.
 */
export const COLUMN_DISPLAYS = ['text', 'images', 'activity', 'items', 'chip', 'steps']

/**
 * How a function-fed list lays its rows out: a table, or a card each — for
 * people who look rather than compare, on a phone above all: the first column
 * is the card's heading, an "items" column its pictures, the rest lines.
 */
export const LIST_LAYOUTS = ['table', 'cards']

export { BADGE_TONES } from './tones.js'

/** The icons a list column's header may show before its label (designs/icons.jsx draws them). */
export const COLUMN_ICONS = ['file', 'clock', 'box', 'layers', 'truck', 'check-circle', 'return', 'warehouse', 'x-circle', 'rupee', 'calendar', 'user']

/** The name a button's note reaches its function under. */
export const NOTE_INPUT = 'note'

/**
 * The name a button's files reach its function under: the stored paths, as a
 * list, when the button's `ask.file` takes them. The function reads the bytes
 * through `system.files` (each with its full path on disk).
 */
export const FILES_INPUT = 'files'

/** Operators a button's condition can use: every one that compares a single value. */
export const CONDITION_OPERATORS = OPERATORS.filter((o) => !o.needsRows)

/** Whether every rule matches the record. No rules: true. */
export function conditionMet(rules, record) {
  if (!Array.isArray(rules) || !rules.length) return true
  const rec = record || {}
  return rules.every((r) => matches(r, rec[r.field]))
}

/** Whether a button shows for this record. */
export function buttonShown(button, record) {
  return conditionMet(button && button.when, record)
}

/** Whether a shown button is greyed out for this record. No disabledWhen: never. */
export function buttonDisabled(button, record) {
  const rules = button && button.disabledWhen
  return Array.isArray(rules) && rules.length > 0 && conditionMet(rules, record)
}

/**
 * Whether a button is drawn as the CURRENT choice — the status an order is
 * at, filled in. Usually also its disabledWhen: choosing it again changes
 * nothing. No pressedWhen: never.
 */
export function buttonPressed(button, record) {
  const rules = button && button.pressedWhen
  return Array.isArray(rules) && rules.length > 0 && conditionMet(rules, record)
}

/** Every button on a screen, with the panel it is on. */
export function screenButtons(doc) {
  return ((doc && doc.nodes) || []).flatMap((node) => nodeButtons(node).map((button) => ({ node, button })))
}

/** A node's buttons: a panel's, or a list's row menu entries that run a function (listRows.js). */
export function nodeButtons(node) {
  if (!node) return []
  if (node.type === 'buttons') return (node.props && node.props.buttons) || []
  if (node.type === 'list') return rowMenuButtons(node)
  return []
}

/** One button by its id — what a press names. Null when the screen has none of that id. */
export function buttonById(doc, id) {
  return screenButtons(doc).find((b) => b.button && b.button.id === id) || null
}

/** The file a button's press takes (`ask.file`), or null when it takes none. */
export function askFile(button) {
  const f = button && button.ask && button.ask.file
  return f && typeof f === 'object' ? f : null
}

/**
 * What a press sends the function: the document's parameters, the person's
 * note when it asks for one, the stored files when it takes them, and the
 * values its `ask.fields` asked for (already checked: askFieldValues).
 */
export function buttonInput(button, note, files, values) {
  // The person's answers first: the document's own parameters always win.
  const input = { ...((values && typeof values === 'object') ? values : {}), ...((button && button.params) || {}) }
  if (button && button.ask && button.ask.note && note !== undefined && note !== null && String(note).trim() !== '') {
    input[NOTE_INPUT] = String(note).trim()
  }
  if (askFile(button) && Array.isArray(files) && files.length) input[FILES_INPUT] = files.slice()
  return input
}

/** The kinds of value a button's `ask.fields` can ask for. */
export const ASK_FIELD_TYPES = ['number', 'text', 'date', 'checklist', 'choice', 'checkbox', 'rows']

/**
 * A `rows` field: the same small set of fields once per thing, as many as
 * there are — the packets an order went out in, each with its size:
 *
 *   { name: 'parcels', label: 'Packets', type: 'rows', rowLabel: 'Packet',
 *     addLabel: 'Add packet', min: 1, max: 10, startFrom: 'orderParcels',
 *     fields: [{ name: 'lengthCm', label: 'Length', type: 'number', unit: 'cm', required: true, min: 0.1 }, …] }
 *
 * Its value is a list of { name: value }, one per row, each row's fields
 * checked as a number or text field is. `startFrom` (optional) is a function
 * (event "buttonOptions") that answers the rows to start with — what was given
 * last time — for the record pressed on; without it the dialog starts with
 * `min` empty rows (at least one).
 */
export const ROW_FIELD_TYPES = ['number', 'text']
/** Most rows one rows field may hold. */
export const MAX_ASK_ROWS = 50

/**
 * A CHECKLIST in a button's popup: a tick per entry, the entries worked out
 * for the record by a function (event "buttonOptions", named in `optionsFrom`):
 *
 *   { "name": "back", "label": "Came back fine", "type": "checklist", "optionsFrom": "movementItemsOut" }
 *
 * The function returns [{ id, label?, sub?, image?, codes? }]. The value is the ids
 * ticked; `required` is at least one, `min` / `max` how many. The server asks
 * the function again on the press and refuses an id it did not offer.
 *
 * `"scan": true` ticks by code: a Scan button on a phone (the app's
 * host.scanCode — its camera), and on a computer a box a handheld scanner (or
 * a person) types the code into. The entry whose `codes` hold it is ticked
 * (tickByCode) — a product's barcode and SKU, say.
 */
/** Most codes one checklist entry carries. */
export const MAX_OPTION_CODES = 10

/**
 * A code scanned (or typed) into a checklist: { ticked, option, options, message }.
 * EVERY entry whose codes hold it is ticked — a box's label covers several
 * products — `message` says what happened (ticked, already ticked, or no
 * entry has that code); `options` are the entries newly ticked, `option` the first.
 */
export function tickByCode(options, ticked, code, scanMiss) {
  const list = Array.isArray(options) ? options : []
  const now = Array.isArray(ticked) ? ticked : []
  const c = String(code === undefined || code === null ? '' : code).trim()
  if (!c) return { ticked: now, option: null, options: [], message: null }
  // EVERY entry holding the code: a box's label covers several products.
  const all = list.filter((o) => o && Array.isArray(o.codes) && o.codes.some((x) => sameCode(x, c)))
  if (!all.length) return { ticked: now, option: null, options: [], message: missMessage(scanMiss, c, 'Nothing here has the code {code}') }
  const fresh = all.filter((o) => !now.includes(o.id))
  if (!fresh.length) return { ticked: now, option: all[0], options: all, message: all.length === 1 ? `${all[0].label} is ticked already` : `All ${all.length} are ticked already` }
  const message = fresh.length === 1 ? `Ticked ${fresh[0].label}` : `Ticked ${fresh.length}: ${fresh.map((o) => o.label).join(', ')}`
  return { ticked: [...now, ...fresh.map((o) => o.id)], option: fresh[0], options: fresh, message }
}

/** The entry whose codes hold `code`, or null. */
function optionWithCode(list, code) {
  return (Array.isArray(list) ? list : []).find((o) => o && Array.isArray(o.codes) && o.codes.some((x) => sameCode(x, code))) || null
}

/**
 * A code scanned (or typed) into a CHOICE its function lists (`optionsFrom`,
 * `scan: true`) — a rack by its label: { value, option, message }. The entry
 * whose codes hold it is chosen; none, and `message` says so (scanMiss).
 */
export function chooseByCode(options, code, scanMiss) {
  const c = String(code === undefined || code === null ? '' : code).trim()
  if (!c) return { value: null, option: null, message: null }
  const option = optionWithCode(options, c)
  if (!option) return { value: null, option: null, message: missMessage(scanMiss, c, 'Nothing here has the code {code}') }
  return { value: option.id, option, message: `Chose ${option.label}` }
}

export function checklistOptionsOf(out) {
  if (!Array.isArray(out)) return []
  const list = []
  const seen = new Set()
  out.forEach((o) => {
    if (list.length >= MAX_CHECKLIST_OPTIONS || !o || typeof o !== 'object') return
    const id = o.id === undefined || o.id === null ? '' : String(o.id).trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    const one = { id, label: (o.label === undefined || o.label === null ? '' : String(o.label).trim()) || id }
    if (o.sub !== undefined && o.sub !== null && String(o.sub).trim()) one.sub = String(o.sub).trim()
    if (typeof o.image === 'string' && o.image.trim()) one.image = o.image.trim()
    const codes = (Array.isArray(o.codes) ? o.codes : [])
      .map((c) => (c === undefined || c === null || typeof c === 'object' ? '' : String(c).trim().slice(0, MAX_CODE)))
      .filter(Boolean).slice(0, MAX_OPTION_CODES)
    if (codes.length) one.codes = codes
    list.push(one)
  })
  return list
}

/**
 * A CHOICE in a button's popup: one of a fixed list, picked from a dropdown —
 * why an order came back:
 *
 *   { "name": "rtoType", "label": "RTO type", "type": "choice",
 *     "options": [{ "value": "not_accepted", "label": "Customer did not accept" }, "Other"] }
 *
 * `options` are plain values or { value, label }; the value reaches the
 * function as a string, and one not in the list is refused on both sides.
 *
 * Or the list is worked out for the record by a function (`optionsFrom`,
 * event "buttonOptions", answering [{ id, label?, sub? }] as a checklist's
 * does) — the other customers this one may be merged with.
 * @returns {{ value: string, label: string }[]}
 */
export function askChoiceOptions(field) {
  return (Array.isArray(field && field.options) ? field.options : []).map((o) => {
    const value = o && typeof o === 'object' ? o.value : o
    const label = o && typeof o === 'object' && o.label !== undefined && o.label !== null && String(o.label).trim() ? String(o.label).trim() : String(value)
    return { value: value === undefined || value === null ? '' : String(value), label }
  }).filter((o) => o.value !== '')
}

/**
 * The fields whose entries a function works out for the record (optionsFrom):
 * every checklist, and a choice fed by one — the customer to merge into this
 * one. The server asks the function again on the press and refuses what it
 * did not offer.
 */
export function checklistFields(button) {
  return askFields(button).filter((f) => f.type === 'checklist' || isFedChoice(f))
}

/** A choice whose options a function gives (optionsFrom), not the screen. */
export function isFedChoice(f) {
  return Boolean(f && f.type === 'choice' && typeof f.optionsFrom === 'string' && f.optionsFrom)
}

/** The rows fields whose starting rows a function gives (startFrom). */
export function startedRowsFields(button) {
  return askFields(button).filter((f) => f.type === 'rows' && typeof f.startFrom === 'string' && f.startFrom)
}

/** One empty row of a rows field: each of its fields blank. */
export function emptyRow(field) {
  const row = {}
  ;(Array.isArray(field.fields) ? field.fields : []).forEach((c) => { if (c && c.name) row[c.name] = '' })
  return row
}

/**
 * What a startFrom function answered, as rows the dialog can show: each a
 * { name: value } of the field's own fields (as text, as typed), at most
 * MAX_ASK_ROWS; anything else dropped. None → the field's empty start.
 */
export function startRowsOf(field, out) {
  const cols = (Array.isArray(field.fields) ? field.fields : []).filter((c) => c && c.name)
  const rows = (Array.isArray(out) ? out : []).filter((r) => r && typeof r === 'object' && !Array.isArray(r)).slice(0, MAX_ASK_ROWS)
    .map((r) => {
      const row = {}
      cols.forEach((c) => { const v = r[c.name]; row[c.name] = v === undefined || v === null ? '' : String(v) })
      return row
    })
  return rows.length ? rows : askFieldStart(field)
}

const ASK_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Whether `s` is a real calendar day, "YYYY-MM-DD". */
function isAskDay(s) {
  if (typeof s !== 'string' || !ASK_DAY.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Today where this runs, "YYYY-MM-DD". */
function localDay(now) {
  const d = now || new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** A date field's `min` / `max` as a day: "today" is today where it runs; a day is itself. */
export function askDayLimit(limit, now) {
  if (limit === 'today') return localDay(now)
  return isAskDay(limit) ? limit : undefined
}

/** Whether a date field's `min` / `max` is one it takes: "today" or a real day. */
export function isAskDayLimit(limit) {
  return limit === 'today' || isAskDay(limit)
}

/** Longest text an ask field takes. */
export const MAX_ASK_TEXT = 500

/**
 * The values a button's press asks the person for (`ask.fields`) — a parcel's
 * length, width, height and weight before Packed:
 *
 *   "ask": { "fields": [
 *     { "name": "lengthIn", "label": "Length", "type": "number", "unit": "in", "required": true, "min": 0.1, "fill": "parcelLengthIn" } ] }
 *
 * A `date` field is a day, "YYYY-MM-DD", picked from a calendar; its `min` /
 * `max` are days too, or "today" — `"max": "today"` for something that has
 * already happened.
 *
 * Each reaches the function under its `name`, which its inputSchema must take.
 * `fill` names a field of the record the dialog starts from, so asking again
 * shows what was given last time.
 */
export function askFields(button) {
  const f = button && button.ask && button.ask.fields
  return Array.isArray(f) ? f.filter((x) => x && typeof x === 'object' && x.name) : []
}

/** What the dialog starts each field with: the record's `fill` field, or empty. A date field takes the day of a date-and-time. */
export function askFieldStart(field, record) {
  if (field.type === 'checklist') return []
  if (field.type === 'rows') return Array.from({ length: Math.max(1, Number.isInteger(field.min) ? field.min : 1) }, () => emptyRow(field))
  const v = field.fill && record ? record[field.fill] : undefined
  // A CHECKBOX: ticked or not — from the record's field when it says so.
  if (field.type === 'checkbox') return v === true || v === 'true' || v === 1 || v === '1'
  if (v === undefined || v === null) return ''
  // A choice starts from the record's value only when it is still one of the options.
  if (field.type === 'choice') return !isFedChoice(field) && askChoiceOptions(field).some((o) => o.value === String(v)) ? String(v) : ''
  if (field.type === 'date') {
    const day = v instanceof Date ? localDay(v) : String(v).slice(0, 10)
    return isAskDay(day) ? day : ''
  }
  return String(v)
}

/**
 * The values given for a button's `ask.fields`, checked and typed:
 * { values: { name: value }, errors: [{ field, message }] }. Typed text is
 * what both sides receive — "12.5" from a box — and a number field's value is
 * a number. Anything not asked for is dropped. Both the dialog and the server
 * use it, so a value refused in one is refused in the other.
 */
export function askFieldValues(button, given, now, offered) {
  const values = {}
  const errors = []
  const raw = given && typeof given === 'object' && !Array.isArray(given) ? given : {}
  askFields(button).forEach((f) => {
    const label = f.label || f.name
    const v = raw[f.name]
    // A CHECKLIST: the ids ticked, each one the function offered (`offered`:
    // { field: [ids] }, when known — always on the server).
    // A CHECKBOX: always sent, true or false; `required` means it must be ticked.
    if (f.type === 'checkbox') {
      const on = v === true || v === 'true' || v === 1 || v === '1' || v === 'on'
      if (f.required && !on) { errors.push({ field: f.name, message: `${label} must be ticked` }); return }
      values[f.name] = on
      return
    }
    if (f.type === 'checklist') {
      if (v !== undefined && v !== null && !Array.isArray(v)) { errors.push({ field: f.name, message: `${label} must be a list` }); return }
      const ids = [...new Set((v || []).map((x) => (x === undefined || x === null ? '' : String(x).trim())).filter(Boolean))]
      if (!ids.length) { if (f.required) errors.push({ field: f.name, message: `${label}: tick at least one` }); values[f.name] = []; return }
      const allowed = offered && Array.isArray(offered[f.name]) ? offered[f.name].map(String) : null
      const stray = allowed ? ids.filter((x) => !allowed.includes(x)) : []
      if (stray.length) { errors.push({ field: f.name, message: `${label}: ${stray.length === 1 ? 'one ticked entry is' : `${stray.length} ticked entries are`} no longer offered — reopen to see them as they are` }); return }
      if (Number.isInteger(f.min) && ids.length < f.min) { errors.push({ field: f.name, message: `${label}: tick at least ${f.min}` }); return }
      if (Number.isInteger(f.max) && ids.length > f.max) { errors.push({ field: f.name, message: `${label}: tick at most ${f.max}` }); return }
      values[f.name] = ids
      return
    }
    // ROWS: the same fields once per thing. Rows left wholly blank are
    // dropped; each kept row's fields are checked as a field of their type,
    // and a problem names its row: "Packet 2: Weight is required".
    if (f.type === 'rows') {
      if (v !== undefined && v !== null && !Array.isArray(v)) { errors.push({ field: f.name, message: `${label} must be a list of rows` }); return }
      const cols = (Array.isArray(f.fields) ? f.fields : []).filter((c) => c && c.name)
      const blank = (r) => cols.every((c) => r[c.name] === undefined || r[c.name] === null || String(r[c.name]).trim() === '')
      const given = (v || []).filter((r) => r && typeof r === 'object' && !Array.isArray(r) && !blank(r))
      const min = Number.isInteger(f.min) ? f.min : (f.required ? 1 : 0)
      const max = Math.min(Number.isInteger(f.max) ? f.max : MAX_ASK_ROWS, MAX_ASK_ROWS)
      const what = (f.rowLabel || 'row').toLowerCase()
      if (given.length < min) { errors.push({ field: f.name, message: min === 1 ? `${label}: give at least one ${what}` : `${label}: give at least ${min}` }); return }
      if (given.length > max) { errors.push({ field: f.name, message: `${label}: at most ${max}` }); return }
      const rows = []
      let bad = false
      given.forEach((r, i) => {
        const out = askFieldValues({ ask: { fields: cols } }, r, now)
        out.errors.forEach((e) => { bad = true; errors.push({ field: f.name, row: i, message: `${f.rowLabel || 'Row'} ${i + 1}: ${e.message}` }) })
        rows.push(out.values)
      })
      if (!bad) values[f.name] = rows
      return
    }
    const empty = v === undefined || v === null || String(v).trim() === ''
    if (empty) {
      if (f.required) errors.push({ field: f.name, message: `${label} is required` })
      return
    }
    if (f.type === 'number') {
      const n = typeof v === 'number' ? v : Number(String(v).trim())
      if (!Number.isFinite(n)) { errors.push({ field: f.name, message: `${label} must be a number` }); return }
      if (f.min !== undefined && n < f.min) { errors.push({ field: f.name, message: `${label} must be at least ${f.min}` }); return }
      if (f.max !== undefined && n > f.max) { errors.push({ field: f.name, message: `${label} must be at most ${f.max}` }); return }
      values[f.name] = n
      return
    }
    if (f.type === 'choice') {
      const picked = String(v).trim()
      // Fed by a function: one it offered (`offered`, when known — always on the server).
      const allowed = isFedChoice(f)
        ? (offered && Array.isArray(offered[f.name]) ? offered[f.name].map(String) : null)
        : askChoiceOptions(f).map((o) => o.value)
      if (allowed && !allowed.includes(picked)) { errors.push({ field: f.name, message: isFedChoice(f) ? `${label}: that one is no longer offered — reopen to see the list as it is` : `${label}: choose one of the list` }); return }
      values[f.name] = picked
      return
    }
    if (f.type === 'date') {
      const day = String(v).trim()
      if (!isAskDay(day)) { errors.push({ field: f.name, message: `${label} must be a date` }); return }
      const min = askDayLimit(f.min, now), max = askDayLimit(f.max, now)
      if (min && day < min) { errors.push({ field: f.name, message: f.min === 'today' ? `${label} cannot be before today` : `${label} must be on or after ${min}` }); return }
      if (max && day > max) { errors.push({ field: f.name, message: f.max === 'today' ? `${label} cannot be in the future` : `${label} must be on or before ${max}` }); return }
      values[f.name] = day
      return
    }
    const t = String(v).trim()
    if (t.length > MAX_ASK_TEXT) { errors.push({ field: f.name, message: `${label} can be at most ${MAX_ASK_TEXT} characters` }); return }
    values[f.name] = t
  })
  return { values, errors }
}

/** Why the files given to a press are not what its `ask.file` takes — or null. */
export function askFileProblem(button, files) {
  const f = askFile(button)
  const list = Array.isArray(files) ? files : []
  if (!f) return list.length ? 'This button takes no files' : null
  const label = f.label || 'A file'
  if (!list.length) return f.required ? `${label} is required` : null
  if (!f.multiple && list.length > 1) return `${label}: one file only`
  if (f.multiple && f.maxFiles && list.length > f.maxFiles) return `${label}: at most ${f.maxFiles} files`
  return null
}

/**
 * The functions a screen's CONTROLS name, as [{ event, name, at }] — a list's
 * rows, a column's hover box, an autocomplete's suggestions, each button. `at` is where in the document, so
 * a refusal says which one.
 */
export function nodeFunctions(doc) {
  const out = []
  ;((doc && doc.nodes) || []).forEach((node, i) => {
    const p = node.props || {}
    if (node.type === 'list') {
      if (typeof p.rowsFrom === 'string' && p.rowsFrom) out.push({ event: LIST_ROWS_EVENT, name: p.rowsFrom, at: `nodes[${i}].props.rowsFrom` })
      ;(Array.isArray(p.columns) ? p.columns : []).forEach((c, j) => {
        if (c && typeof c.details === 'string' && c.details) out.push({ event: ROW_DETAILS_EVENT, name: c.details, at: `nodes[${i}].props.columns[${j}].details` })
      })
    }
    if (node.type === 'details' && typeof p.detailsFrom === 'string' && p.detailsFrom) {
      out.push({ event: DETAILS_EVENT, name: p.detailsFrom, at: `nodes[${i}].props.detailsFrom` })
    }
    if (node.type === 'feed' && typeof p.entriesFrom === 'string' && p.entriesFrom) {
      out.push({ event: FEED_EVENT, name: p.entriesFrom, at: `nodes[${i}].props.entriesFrom` })
    }
    if (node.type === 'autocomplete' && typeof p.suggestFrom === 'string' && p.suggestFrom) {
      out.push({ event: SUGGEST, name: p.suggestFrom, at: `nodes[${i}].props.suggestFrom` })
    }
    if (node.type === 'buttons' || node.type === 'list') {
      const where = node.type === 'list' ? 'rowMenu' : 'buttons'
      // A list's run entries, at their place in its rowMenu.
      const placed = node.type === 'list'
        ? (Array.isArray(p.rowMenu) ? p.rowMenu : []).map((m, j) => ({ b: rowMenuButton(m), j, key: 'run' })).filter((x) => x.b)
        : (Array.isArray(p.buttons) ? p.buttons : []).map((b, j) => ({ b, j, key: 'action' }))
      placed.forEach(({ b, j, key }) => {
        if (b && typeof b.action === 'string' && b.action) out.push({ event: BUTTON_EVENT, name: b.action, at: `nodes[${i}].props.${where}[${j}].${key}`, button: b })
        if (!b) return
        askFields(b).forEach((f, k) => {
          if ((f.type === 'checklist' || f.type === 'choice') && typeof f.optionsFrom === 'string' && f.optionsFrom) {
            out.push({ event: BUTTON_OPTIONS_EVENT, name: f.optionsFrom, at: `nodes[${i}].props.${where}[${j}].ask.fields[${k}].optionsFrom` })
          }
          if (f.type === 'rows' && typeof f.startFrom === 'string' && f.startFrom) {
            out.push({ event: BUTTON_OPTIONS_EVENT, name: f.startFrom, at: `nodes[${i}].props.${where}[${j}].ask.fields[${k}].startFrom` })
          }
        })
      })
    }
  })
  return out
}

/**
 * What stops a button's parameters reaching its function: one it does not
 * take, a required one missing, a value outside its options, a note it has no
 * input for. Read from the function's inputSchema, as the server lists it.
 */
export function paramProblems(button, inputSchema) {
  const schema = Array.isArray(inputSchema) ? inputSchema : []
  const byName = new Map(schema.filter((f) => f && f.name).map((f) => [f.name, f]))
  const params = (button && button.params) || {}
  const problems = []
  Object.keys(params).forEach((k) => {
    const f = byName.get(k)
    if (!f) { problems.push(`takes no parameter "${k}"${byName.size ? ` — it takes: ${[...byName.keys()].join(', ')}` : ''}`); return }
    const allowed = optionValues(f.options)
    if (allowed.length && !allowed.includes(params[k])) problems.push(`"${k}" must be one of: ${allowed.join(', ')}`)
  })
  schema.forEach((f) => {
    if (!f || !f.name || !f.required || f.default !== undefined) return
    if (f.name === NOTE_INPUT && button && button.ask && button.ask.note) return
    if (f.name === FILES_INPUT && askFile(button)) return
    if (askFields(button).some((a) => a.name === f.name && a.required)) return
    if (params[f.name] === undefined || params[f.name] === null || params[f.name] === '') problems.push(`needs "${f.name}"`)
  })
  if (button && button.ask && button.ask.note && !byName.has(NOTE_INPUT)) problems.push(`asks for a note, but takes no "${NOTE_INPUT}"`)
  if (askFile(button) && !byName.has(FILES_INPUT)) problems.push(`asks for a file, but takes no "${FILES_INPUT}"`)
  askFields(button).forEach((a) => {
    const f = byName.get(a.name)
    if (!f) { problems.push(`asks for "${a.name}", but takes no "${a.name}"`); return }
    const want = a.type === 'number' ? 'number' : a.type === 'checklist' || a.type === 'rows' ? 'array' : a.type === 'checkbox' ? 'boolean' : 'string'
    if (f.type && f.type !== want) problems.push(`asks for "${a.name}" as ${a.type === 'number' ? 'a number' : a.type === 'date' ? 'a date' : a.type === 'checklist' ? 'a list of ticked ids' : a.type === 'rows' ? 'a list of rows' : a.type === 'checkbox' ? 'a tick (true or false)' : 'text'}, but it takes ${f.type}`)
    // A choice offers only what the function takes, when it lists what it takes.
    const takes = optionValues(f.options).map(String)
    if (a.type === 'choice' && takes.length) {
      const stray = askChoiceOptions(a).map((o) => o.value).filter((v) => !takes.includes(v))
      if (stray.length) problems.push(`offers ${stray.map((v) => `"${v}"`).join(', ')} for "${a.name}", but it takes only: ${takes.join(', ')}`)
    }
  })
  return problems
}

/** A schema field's allowed values: `options` as plain values or { value, label }. */
export function optionValues(options) {
  return (Array.isArray(options) ? options : []).map((o) => (o && typeof o === 'object' && 'value' in o ? o.value : o))
}
