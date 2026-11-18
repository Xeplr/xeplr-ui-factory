// ADD SEVERAL — a list's records typed (or pasted) as a grid, saved in one go.
//
// The grid's columns are the list's EDIT screen's fields, in reading order:
// the same form New opens, one row per record. Each row is saved as New
// saves it — the host's onSave, so the server's checks (beforeSave) refuse a
// row exactly as they would refuse the form, and the row says why.
//
// Pure: which fields a grid can take, what a pasted cell becomes, whether a
// row is blank, and each row's messages. BulkAdd.jsx draws it.
import { CONTROLS } from './controls.js'
import { inputNodes } from './document.js'
import { fieldError, parseInput, sameId, initialValues } from './values.js'
import { isTagField } from './suggest.js'

// A cell holds one value. Files, several choices, tag chips, a ticked table
// and a journey do not fit one — they are filled in afterwards, in Edit.
const GRID_TYPES = ['text', 'textarea', 'number', 'date', 'datetime', 'checkbox', 'dropdown', 'radio', 'autocomplete']

/**
 * The edit screen's fields as grid columns, and the ones left out.
 * A field the list fills itself (a sub-table's link, `given`) is not a column.
 * @returns {{ columns: object[], skipped: object[] }} nodes
 */
export function bulkFields(doc, given = {}, controls = CONTROLS) {
  const columns = []
  const skipped = []
  inputNodes(doc, controls).forEach((n) => {
    if (given && given[n.props.name] !== undefined) return
    if (GRID_TYPES.includes(n.type) && !isTagField(n) && !(n.props && n.props.multiple)) columns.push(n)
    else skipped.push(n)
  })
  return { columns, skipped }
}

/** A blank row: each column's default, and what the list fills itself. */
export function blankRow(doc, columns, given = {}, controls = CONTROLS) {
  const start = initialValues(doc, given || {}, controls)
  const row = {}
  columns.forEach((n) => { row[n.props.name] = start[n.props.name] })
  return row
}

/** Nothing typed in it: every column still at its default. */
export function isBlank(row, blank) {
  return Object.keys(blank).every((k) => {
    const a = row[k], b = blank[k]
    const empty = (v) => v === undefined || v === null || v === '' || v === false
    return a === b || (empty(a) && empty(b))
  })
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n) => String(n).padStart(2, '0')

/**
 * A typed or pasted day → 'YYYY-MM-DD', or the text as it was (validation
 * then says it is not a date). Takes 2026-08-15, 15/08/2026, 15-08-2026,
 * 15.8.26 (day first, as written in India and Europe), and 15 Aug 2026 /
 * Aug 15, 2026 / 15 August.
 */
export function dayFrom(text, year = new Date().getFullYear()) {
  const s = String(text == null ? '' : text).trim()
  if (!s) return undefined
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return ok(+m[1], +m[2], +m[3], s)
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) return ok(fullYear(+m[3]), +m[2], +m[1], s)
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]+)\.?,?(?:[\s-]+(\d{2,4}))?$/i)
  if (m && month(m[2])) return ok(m[3] ? fullYear(+m[3]) : year, month(m[2]), +m[1], s)
  m = s.match(/^([a-z]+)\.?[\s-]+(\d{1,2})(?:st|nd|rd|th)?,?(?:[\s-]+(\d{2,4}))?$/i)
  if (m && month(m[1])) return ok(m[3] ? fullYear(+m[3]) : year, month(m[1]), +m[2], s)
  return s
}
function month(word) { const i = MONTHS.indexOf(String(word).slice(0, 3).toLowerCase()); return i === -1 ? 0 : i + 1 }
function fullYear(y) { return y < 100 ? 2000 + y : y }
function ok(y, mo, d, raw) {
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : raw
}

/**
 * What a cell's text becomes for its field: a dropdown's option by its
 * name or id (any case), Yes/No for a tick, a day for a date — so a column
 * copied from a spreadsheet lands as the form would have it.
 * @param options a dropdown's options ([{ id, name }]) — its own or loaded
 */
export function cellValue(node, text, options) {
  const s = String(text == null ? '' : text).trim()
  if (node.type === 'checkbox') return /^(y|yes|true|1|✓|✔|x|on)$/i.test(s)
  if (!s) return undefined
  if (node.type === 'dropdown' || node.type === 'radio') {
    const opts = options || []
    const hit = opts.find((o) => sameId(o.id, s)) || opts.find((o) => String(o.name || o.label || '').trim().toLowerCase() === s.toLowerCase())
    return hit ? hit.id : s
  }
  if (node.type === 'date') return dayFrom(s)
  if (node.type === 'datetime') {
    const m = s.match(/^(.+?)[\sT]+(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
    if (!m) { const d = dayFrom(s); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T00:00' : s }
    const d = dayFrom(m[1])
    let h = +m[2]
    if (m[4]) h = (h % 12) + (/pm/i.test(m[4]) ? 12 : 0)
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T${pad(h)}:${m[3]}` : s
  }
  if (node.type === 'number') return parseInput(node, s.replace(/[,₹\s]/g, ''))
  return s
}

/**
 * A row's dropdown cells matched again by name, now that their options are
 * here — text pasted before a table's options arrived becomes the option.
 * The same row back when nothing changed.
 */
export function resolveChoices(row, columns, optionsFor) {
  let out = row
  columns.forEach((n) => {
    if (n.type !== 'dropdown' && n.type !== 'radio') return
    const opts = optionsFor(n)
    const v = row[n.props.name]
    if (!opts || v === undefined || v === null || v === '' || opts.some((o) => sameId(o.id, v))) return
    const hit = cellValue(n, v, opts)
    if (hit !== v) out = { ...out, [n.props.name]: hit }
  })
  return out
}

/** Text from a spreadsheet: rows of cells (tabs between, a line each). Blank trailing lines dropped. */
export function pastedRows(text) {
  const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n')
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  return lines.map((l) => l.split('\t'))
}

/** Whether a paste is more than one cell — a grid's worth, filled from where it lands. */
export function isGridPaste(text) {
  return /[\t\n]/.test(String(text == null ? '' : text).replace(/\s+$/, ''))
}

/**
 * Pasted rows laid into the grid from row `at`, column `col` on: new rows
 * added as needed, cells past the last column ignored.
 * @returns {object[]} the rows after it
 */
export function pasteInto(rows, at, col, grid, columns, optionsFor, blank) {
  const out = rows.slice()
  grid.forEach((cells, i) => {
    const r = at + i
    while (out.length <= r) out.push({ ...blank })
    const row = { ...out[r] }
    cells.forEach((text, j) => {
      const node = columns[col + j]
      if (node) row[node.props.name] = cellValue(node, text, optionsFor(node))
    })
    out[r] = row
  })
  return out
}

/**
 * Each row's messages before anything is sent: { rowIndex: { field: message } }.
 * Blank rows are not checked — they are not saved.
 */
export function rowErrors(rows, columns, optionsFor, blank) {
  const out = {}
  rows.forEach((row, i) => {
    if (isBlank(row, blank)) return
    const errs = {}
    columns.forEach((n) => {
      const msg = fieldError(n, row[n.props.name], optionsFor(n))
      if (msg) errs[n.props.name] = msg
    })
    if (Object.keys(errs).length) out[i] = errs
  })
  return out
}
