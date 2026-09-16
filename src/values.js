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
      if (Object.keys(v).length) field.validation = v
    }
    return field
  })
}

/** Each input's starting value: the caller's, else the control's default. */
export function initialValues(doc, provided = {}, controls = CONTROLS) {
  const out = {}
  inputNodes(doc, controls).forEach((node) => {
    const name = node.props.name
    if (provided[name] !== undefined) out[name] = provided[name]
    else if (node.props.default !== undefined) out[name] = node.props.default
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

function safeRegExp(pattern) {
  try { return new RegExp(pattern) } catch (_) { return { test: () => true } }
}

// ── autosave ─────────────────────────────────────────────────────────────
// There is no submit. A screen saves itself a moment after a change, as long
// as what is entered is acceptable. This decides whether it can, and which
// messages to SHOW: a field nobody has touched is not shouted at for being
// empty — it only holds the save back.

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
export function listColumns(doc, node, controls = CONTROLS) {
  if (node && Array.isArray(node.props?.columns) && node.props.columns.length) return node.props.columns
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
