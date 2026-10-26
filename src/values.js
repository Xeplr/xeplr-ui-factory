// A screen's VALUES: what it starts with, what a keystroke becomes, and whether
// what was entered is acceptable.
//
// The rules come from the controls' props, and formSchema() turns them into a
// @xeplr/schema-handler schema. That is the point of it: the consuming app's
// server can check a submission with
//
//   applySchema(formSchema(document), body)
//
// against the very rules the screen enforced, instead of a second copy of
// them. validateValues() below applies the same rules in the browser, with
// messages written for the person filling the form in rather than for a log.

import { CONTROLS, MULTI_SEPARATOR } from './controls.js'
import { inputNodes } from './document.js'

/** schema-handler field schema for the screen's inputs, in reading order. */
export function formSchema(doc, controls = CONTROLS) {
  return inputNodes(doc, controls).map((node) => {
    const def = controls[node.type]
    const p = node.props
    const field = { name: p.name }
    if (def.valueType) field.type = def.valueType
    if (p.label) field.description = p.label
    if (p.required) field.required = true
    if (p.default !== undefined) field.default = p.default
    // A multi-select's value is an array, so schema-handler's `options` (which
    // compares one value) cannot check it — chooseable(node) does, on both sides.
    if ((node.type === 'dropdown' || node.type === 'radio') && p.data?.source === 'static') {
      field.options = p.data.options.map((o) => o.id)
    }
    const v = p.validation && { ...p.validation }
    if (v) {
      delete v.patternMessage
      // "Not in the future" is today's date AT THE MOMENT OF CHECKING — the
      // server builds this schema per save, so it never goes stale.
      if (v.notFuture) {
        const today = localDay()
        if (!v.max || v.max > today) v.max = today
      }
      delete v.notFuture
      if (Object.keys(v).length) field.validation = v
    }
    return field
  })
}

/** Each input's starting value: the caller's, else the control's default. */
/**
 * A VALUE WITH A TOKEN IS A BINDING; a plain value is a literal.
 *
 * `{params.complaintId}` in a field's default means "whatever this screen was
 * called with" — the same brace this product uses in a workflow step, a
 * condition and a report. Nothing is marked on the field: the brace says it.
 *
 * Unknown, or called with nothing, resolves to undefined — the field is then
 * empty and the person fills it in, which is what the same form does when
 * somebody opens it on its own. A form that will not open is worse than a
 * question nobody expected.
 *
 * Whole-value only. `{params.a}-{params.b}` is not a value a form field takes,
 * and splicing text is a formula's job, not a form's.
 */
export function resolveBinding(value, params, previous) {
  if (typeof value !== 'string') return value
  const v = value.trim()
  const p = PARAM_BINDING.exec(v)
  if (p) return params ? params[p[1]] : undefined
  // WHAT A SCREEN BEFORE THIS ONE SAVED, in a flow — by that screen's key, the
  // saved row as `id`. Handed over as plain JSON with no contract: a screen
  // not reached on this run, or a field it does not have, is simply empty.
  const q = PREVIOUS_BINDING.exec(v)
  if (q) {
    const screen = previous && previous[q[1]]
    return screen && screen.values ? screen.values[q[2]] : undefined
  }
  return value
}

const PARAM_BINDING = /^\{params\.([A-Za-z_][\w]*)\}$/
const PREVIOUS_BINDING = /^\{previous\.([A-Za-z][A-Za-z0-9_]*)\.values\.([A-Za-z_][\w]*)\}$/

/** Is this what somebody typed, or a reference — to an input, or to a screen before this one? */
export function isBinding(value) {
  return typeof value === 'string' && (PARAM_BINDING.test(value.trim()) || PREVIOUS_BINDING.test(value.trim()))
}

/** The binding to a field a screen before this one saved: `{previous.<screen>.values.<field>}`. */
export function previousBinding(screen, field) {
  return `{previous.${screen}.values.${field}}`
}

export function initialValues(doc, provided = {}, controls = CONTROLS, previous = null) {
  const out = {}
  inputNodes(doc, controls).forEach((node) => {
    const name = node.props.name
    if (provided[name] !== undefined) out[name] = provided[name]
    else if (node.props.default !== undefined) {
      // A default may be a binding to one of the screen's own inputs.
      const resolved = resolveBinding(node.props.default, provided, previous)
      if (resolved !== undefined) out[name] = resolved
      else if (!isBinding(node.props.default)) out[name] = node.props.default
      else if (node.type === 'checkbox') out[name] = false
      else if (node.type === 'multiselect') out[name] = []
    }
    else if (node.type === 'checkbox') out[name] = false
    else if (node.type === 'multiselect') out[name] = []
  })
  return out
}

/**
 * What the raw value from an input element becomes. An emptied box is
 * `undefined` — not '' and not 0 — so "required" means the same thing for
 * every type, and a cleared number is not silently saved as zero.
 */
export function parseInput(node, raw) {
  if (node.type === 'checkbox') return Boolean(raw)
  if (node.type === 'multiselect') return Array.isArray(raw) ? raw : fromDbValue(node, raw) || []
  if (raw === undefined || raw === null || raw === '') return undefined
  if (node.type === 'number') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
    return Number.isFinite(n) ? n : raw   // left as typed; validation says why
  }
  if (node.type === 'dropdown' || node.type === 'radio') return raw
  return String(raw)
}

/**
 * @returns {Object<string, string>} field name → message, for the fields that
 *          fail. Empty when everything passes.
 */
export function validateValues(doc, values, controls = CONTROLS, options = {}) {
  const errors = {}
  inputNodes(doc, controls).forEach((node) => {
    const msg = fieldError(node, values ? values[node.props.name] : undefined, options[node.id])
    if (msg) errors[node.props.name] = msg
  })
  return errors
}

/**
 * One field's message, or null.
 * @param loadedOptions for a dropdown whose options are loaded (a table), the
 *        rows — so a stale id is caught here rather than by the server
 */
export function fieldError(node, value, loadedOptions) {
  const p = node.props
  const label = p.label || p.name
  const v = p.validation || {}

  // AN IDENTIFIER IS NOT SOMEBODY'S TO FILL IN. The server assigns a code on
  // first save and the database counts a number, so a rule here would refuse
  // the very save that produces the value.
  if (node.type === 'id') return null

  if (node.type === 'checkbox') {
    return p.required && value !== true ? `${label} must be ticked` : null
  }
  if (node.type === 'multiselect') {
    const chosen = Array.isArray(value) ? value : []
    if (!chosen.length) return p.required ? `${label} is required` : null
    if (v.minItems != null && chosen.length < v.minItems) return `${label}: choose at least ${v.minItems}`
    if (v.maxItems != null && chosen.length > v.maxItems) return `${label}: choose at most ${v.maxItems}`
    const allowed = chooseable(node, loadedOptions)
    if (allowed && chosen.some((c) => !allowed.some((o) => sameId(o.id, c)))) return `${label} has a choice that is no longer offered`
    return null
  }
  if (value === undefined || value === null || value === '') {
    return p.required ? `${label} is required` : null
  }

  switch (node.type) {
    case 'text':
    case 'textarea': {
      const s = String(value)
      if (v.minLength != null && s.length < v.minLength) return `${label} must be at least ${v.minLength} character${v.minLength === 1 ? '' : 's'}`
      if (v.maxLength != null && s.length > v.maxLength) return `${label} must be at most ${v.maxLength} character${v.maxLength === 1 ? '' : 's'}`
      if (v.pattern && !safeRegExp(v.pattern).test(s)) return v.patternMessage || `${label} is not in the expected format`
      return null
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${label} must be a number`
      if (v.integer && !Number.isInteger(value)) return `${label} must be a whole number`
      if (v.min != null && value < v.min) return `${label} must be at least ${v.min}`
      if (v.max != null && value > v.max) return `${label} must be at most ${v.max}`
      return null
    }
    case 'date': {
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return `${label} must be a date`
      // ISO dates compare correctly as strings, and comparing strings avoids a
      // timezone shifting "2026-01-01" into the previous day.
      const day = value.slice(0, 10)
      if (v.min && day < v.min) return `${label} must be on or after ${v.min}`
      if (v.max && day > v.max) return `${label} must be on or before ${v.max}`
      if (v.notFuture && day > localDay()) return `${label} cannot be in the future`
      return null
    }
    case 'datetime': {
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return `${label} must be a date and time`
      // ISO strings compare correctly as text, and comparing text keeps a
      // timezone from shifting the moment that was typed in.
      const at = value.slice(0, 16)
      if (v.min && at < v.min.slice(0, 16)) return `${label} must be at or after ${v.min.replace('T', ' ')}`
      if (v.max && at > v.max.slice(0, 16)) return `${label} must be at or before ${v.max.replace('T', ' ')}`
      return null
    }
    case 'dropdown':
    case 'radio': {
      const opts = chooseable(node, loadedOptions)
      if (Array.isArray(opts) && !opts.some((o) => sameId(o.id, value))) return `${label} must be one of the options`
      return null
    }
    default:
      return null
  }
}

/** The options a choice field offers: its own list, or the loaded rows. */
export function chooseable(node, loadedOptions) {
  const data = node.props.data || {}
  const opts = data.source === 'static' ? data.options : loadedOptions
  return Array.isArray(opts) ? opts : null
}

/**
 * <select> hands back a string, while a table's ids may be numbers. The id is
 * matched loosely and then saved in the OPTION's own type — see optionValue.
 */
export function sameId(a, b) {
  return a === b || String(a) === String(b)
}

/** The option's own id for what a <select> reported. */
export function optionValue(options, raw) {
  const hit = (options || []).find((o) => sameId(o.id, raw))
  return hit ? hit.id : raw
}

/** Today as YYYY-MM-DD, in the local timezone — the day a person means by "today". */
function localDay() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function safeRegExp(pattern) {
  try { return new RegExp(pattern) } catch (_) { return { test: () => true } }
}

// ── can it save? ─────────────────────────────────────────────────────────
// Save (a button, one AJAX call) goes out only when what is entered is
// acceptable. This decides whether it can, and which messages to SHOW: a field
// nobody has touched is not shouted at for being empty until Save is pressed.

/**
 * @param touched   Set of field names the person has changed or left
 * @returns {{ canSave, status, errors, shown }}
 *   status  'ready' | 'incomplete' (only untouched required fields are empty) | 'invalid'
 *   errors  every failing field → message
 *   shown   the ones to display now
 */
export function saveState(doc, values, touched, loadedOptions = {}, controls = CONTROLS) {
  const errors = validateValues(doc, values, controls, loadedOptions)
  const names = Object.keys(errors)
  const shown = {}
  names.forEach((n) => { if (touched && touched.has(n)) shown[n] = errors[n] })
  if (!names.length) return { canSave: true, status: 'ready', errors, shown }
  const onlyUntouched = names.every((n) => !(touched && touched.has(n)))
  return { canSave: false, status: onlyUntouched ? 'incomplete' : 'invalid', errors, shown }
}

/** A saved record → the screen's values, for Edit. Fields the screen does not have are left out. */
export function recordValues(doc, record, controls = CONTROLS) {
  const out = {}
  inputNodes(doc, controls).forEach((node) => {
    const name = node.props.name
    const v = record ? record[name] : undefined
    if (v !== undefined && v !== null) out[name] = fromDbValue(node, v)
    else if (node.type === 'checkbox') out[name] = false
    else if (node.type === 'multiselect') out[name] = []
  })
  return out
}

// ── lists ────────────────────────────────────────────────────────────────

/** The table a list reads: its own, else the one the screen saves to. */
export function listSource(doc, node) {
  return (node && node.props && node.props.source) || doc.source || null
}

/** A list's columns: the ones chosen, else the screen's fields in reading order. */
export function listColumns(doc, node, controls = CONTROLS, rows) {
  if (node && Array.isArray(node.props?.columns) && node.props.columns.length) return node.props.columns

  // A LIST OF ANOTHER TABLE HAS NOTHING TO DO WITH THIS SCREEN'S FIELDS.
  //
  // A sub-table — this material's characteristics — holds rows of a different
  // shape entirely, so falling back to this screen's fields shows four empty
  // columns named after the material. The rows themselves are the only
  // description to hand, so they are what it reads.
  const foreign = node && node.props && node.props.source && doc && node.props.source !== doc.source
  if (foreign) {
    const first = (rows || []).find((r) => r && typeof r === 'object')
    if (first) {
      return Object.keys(first)
        // Neither is a column anybody asked to see: one is the row's handle,
        // the other is the record it belongs to, which is the list itself.
        .filter((k) => k !== 'id' && k !== (node.props.belongsTo || ''))
        .map((k) => ({ field: k, label: k }))
    }
    return []
  }

  return inputNodes(doc, controls).map((n) => ({ field: n.props.name, label: n.props.label || n.props.name }))
}

/** How a stored value reads in a list: a dropdown's name, not its id; Yes/No for a checkbox. */
export function displayValue(node, value, options) {
  if (value === undefined || value === null || value === '') return ''
  if (!node) return typeof value === 'object' ? JSON.stringify(value) : value
  if (node.type === 'checkbox') return value ? 'Yes' : 'No'
  if (node.type === 'file') return fileLabel(value)
  if (node.type === 'datetime') return String(value).replace('T', ' ').slice(0, 16)
  if (node.type === 'dropdown' || node.type === 'radio') return optionName(node, value, options)
  if (node.type === 'multiselect') {
    return (fromDbValue(node, value) || []).map((v) => optionName(node, v, options)).join(', ')
  }
  return value
}

function optionName(node, value, options) {
  const opts = node.props.data?.source === 'static' ? node.props.data.options : options
  const hit = (opts || []).find((o) => sameId(o.id, value))
  return hit ? hit.name : String(value)
}

/** The name at the end of a stored file path, without the id that keeps it apart. */
export function fileLabel(path) {
  const s = String(path)
  const cut = s.slice(s.lastIndexOf('/') + 1)
  const sep = cut.indexOf('__')
  return sep === -1 ? cut : cut.slice(sep + 2)
}

// ── the database boundary ────────────────────────────────────────────────
// Two types do not go into their column as they are read: a multi-select is
// several ids in one text column, and a date-and-time comes back as the
// database wrote it. Both sides of the wire use these, so the conversion is
// written once.

/** A screen value → what its column stores. */
export function toDbValue(node, value) {
  if (value === undefined || value === null) return value
  if (node.type === 'multiselect') {
    const list = Array.isArray(value) ? value : [value]
    return list.length ? list.map((v) => String(v)).join(MULTI_SEPARATOR) : null
  }
  return value
}

/** What a column holds → the screen's value. */
export function fromDbValue(node, value) {
  if (value === undefined || value === null) return value
  if (node.type === 'multiselect') {
    if (Array.isArray(value)) return value
    const s = String(value)
    return s === '' ? [] : s.split(MULTI_SEPARATOR).filter((x) => x !== '')
  }
  if (node.type === 'date') return typeof value === 'string' ? value.slice(0, 10) : value
  if (node.type === 'datetime') {
    // "2026-09-16 14:30:00" or an ISO string → what <input type="datetime-local"> shows.
    const s = value instanceof Date ? value.toISOString() : String(value)
    return s.replace(' ', 'T').slice(0, 16)
  }
  return value
}

// ── a code people can read out ──────────────────────────────────────────
//
// The record's own id is a 25-character key made on save. It is unique,
// stable and completely unquotable: nobody reads one over the phone, writes
// one on a form, or finds a complaint by it. So a field can be marked
// GENERATED, and gets a short code instead — CMP-7K3QF9.
//
// RANDOM, not sequential. A counted number (CMP-0001) needs a counter bumped
// in the same transaction as the insert, or two people saving at once take
// the same one; and it still shows gaps whenever a save fails after the
// number was taken, which somebody then has to explain. A random code has
// neither problem, at the cost of not telling you the fifth from the five
// hundredth — which is what the record's date is for.

/**
 * The alphabet, minus the characters people mistake for each other.
 *
 * ONE OF EACH PAIR SURVIVES, which is the whole trick: O and I and S are
 * gone, so 0, 1 and 5 are unambiguous and can stay. Dropping both halves
 * would cost a third of the alphabet to solve a problem already solved.
 *
 * The point of this code is that it survives being read aloud, written down
 * and typed back in.
 */
var CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRTUVWXYZ'

/** The fields a screen generates a code for. */
export function codeFields(doc, controls = CONTROLS) {
  return inputNodes(doc, controls).filter((n) => n.type === 'id' && (n.props || {}).idKind !== 'auto')
}

/**
 * The identifiers the DATABASE fills in — a counted number. They are never
 * sent on an insert: the column is an identity, so mentioning it at all would
 * be claiming a number nobody chose.
 */
export function countedFields(doc, controls = CONTROLS) {
  return inputNodes(doc, controls).filter((n) => n.type === 'id' && (n.props || {}).idKind === 'auto')
}

/**
 * One code. `prefix` is what makes it recognisable at a glance — a complaint
 * is CMP-…, a purchase order is PO-… — and is optional.
 *
 * Six characters from 31 is about 900 million codes, which is not a
 * guarantee: whoever writes one is expected to check it is free and try
 * again, which is cheap and has to be done in the database anyway.
 */
export function generateCode(prefix, length = 6) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  const head = String(prefix || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')
  return head ? head + '-' + out : out
}
