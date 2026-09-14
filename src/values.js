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

import { CONTROLS } from './controls.js'
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
    if (node.type === 'dropdown' && p.data?.source === 'static') {
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
  if (raw === undefined || raw === null || raw === '') return undefined
  if (node.type === 'number') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
    return Number.isFinite(n) ? n : raw   // left as typed; validation says why
  }
  if (node.type === 'dropdown') return raw
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
    case 'dropdown': {
      const opts = p.data?.source === 'static' ? p.data.options : loadedOptions
      if (Array.isArray(opts) && !opts.some((o) => sameId(o.id, value))) return `${label} must be one of the options`
      return null
    }
    default:
      return null
  }
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
