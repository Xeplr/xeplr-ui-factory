// Checks a screen document BEFORE anything renders it, and says exactly what
// is wrong and where.
//
// Two readers matter. A person saving from the builder needs to know which
// control to fix. And Claude, which writes these documents from a plain-English
// request, needs errors precise enough to correct its own output without
// guessing — so every error names a path (`nodes[3].props.data.table`) and
// what was expected there.
//
// Loud by design: a screen that half-renders — a dropdown with no options, two
// fields writing the same key — looks like a data problem to whoever uses it.

import { CONTROLS, LABEL_VARIANTS, LIST_ACTIONS, STYLE_KEYS, SCREEN_STYLE_KEYS, LAYOUTS, MULTI_SEPARATOR, MAX_FILE_MB, STEP_LIMIT, acceptList } from './controls.js'
import { DOCUMENT_KIND, DOCUMENT_VERSION } from './document.js'
import { RESERVED_COLUMNS, MAX_IDENTIFIER } from './tableSchema.js'

const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_.$-]*$/
const SCREEN_ID = /^[A-Za-z0-9_-]+$/
const DOCUMENT_KEYS = ['kind', 'version', 'id', 'name', 'source', 'units', 'aspect', 'width', 'style', 'nodes']
const COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * @returns {{ ok: boolean, errors: Array<{ path: string, message: string }> }}
 */
export function validateDocument(doc, controls = CONTROLS) {
  const errors = []
  const err = (path, message) => errors.push({ path, message })

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    err('', 'A screen document must be an object')
    return { ok: false, errors }
  }
  if (doc.kind !== DOCUMENT_KIND) err('kind', `must be "${DOCUMENT_KIND}"`)
  if (doc.version !== DOCUMENT_VERSION) err('version', `must be ${DOCUMENT_VERSION}`)
  if (!nonEmptyString(doc.id)) err('id', 'must be a non-empty string')
  else if (!SCREEN_ID.test(doc.id)) err('id', `"${doc.id}" must contain only letters, digits, _ and -`)
  if (!nonEmptyString(doc.name)) err('name', 'must be a non-empty string — the screen\'s title, e.g. "New employee"')
  if (doc.units !== 'fraction') err('units', 'must be "fraction"')
  if (!(typeof doc.aspect === 'number' && doc.aspect > 0)) err('aspect', 'must be a number greater than 0 (1 = page as tall as it is wide)')
  if (!(Number.isInteger(doc.width) && doc.width >= 320 && doc.width <= 1920)) err('width', 'must be a whole number of pixels from 320 to 1920 — the width the screen is designed at')
  if (doc.source !== undefined && !(nonEmptyString(doc.source) && TABLE_NAME.test(doc.source))) err('source', 'must name the table records are saved to, e.g. "employees"')
  checkStyle(doc.style, SCREEN_STYLE_KEYS, 'style', err, 'the screen')
  Object.keys(doc).forEach((k) => {
    if (!DOCUMENT_KEYS.includes(k)) err(k, `is not a screen property — allowed: ${DOCUMENT_KEYS.join(', ')}`)
  })
  if (!Array.isArray(doc.nodes)) {
    err('nodes', 'must be an array of controls')
    return { ok: false, errors }
  }

  const ids = new Map()
  const names = new Map()

  doc.nodes.forEach((node, i) => {
    const at = `nodes[${i}]`
    if (!node || typeof node !== 'object') { err(at, 'must be an object'); return }

    if (!nonEmptyString(node.id)) err(`${at}.id`, 'must be a non-empty string')
    else if (ids.has(node.id)) err(`${at}.id`, `"${node.id}" is already used by nodes[${ids.get(node.id)}]`)
    else ids.set(node.id, i)

    const def = controls[node.type]
    if (!def) {
      err(`${at}.type`, `unknown control "${node.type}" — one of: ${Object.keys(controls).join(', ')}`)
      return
    }

    checkGeometry(node, at, err)

    const props = node.props
    if (!props || typeof props !== 'object' || Array.isArray(props)) {
      err(`${at}.props`, 'must be an object')
      return
    }
    Object.keys(props).forEach((key) => {
      if (!def.props.includes(key)) err(`${at}.props.${key}`, `is not a property of "${node.type}" — allowed: ${def.props.join(', ')}`)
    })

    if (def.input) {
      if (!nonEmptyString(props.name)) err(`${at}.props.name`, 'is required — the key the value is saved under')
      else if (!FIELD_NAME.test(props.name)) err(`${at}.props.name`, `"${props.name}" must start with a letter or _ and contain only letters, digits and _`)
      else if (names.has(props.name)) err(`${at}.props.name`, `"${props.name}" is already used by nodes[${names.get(props.name)}] — two fields cannot save to one key`)
      else if (RESERVED_COLUMNS.includes(props.name)) err(`${at}.props.name`, `"${props.name}" is a standard column of every table — choose another name`)
      else if (props.name.length > MAX_IDENTIFIER) err(`${at}.props.name`, `is ${props.name.length} characters — a column name can be at most ${MAX_IDENTIFIER}`)
      else names.set(props.name, i)

      if (!nonEmptyString(props.label)) err(`${at}.props.label`, 'is required — the text shown above the field')
      if (props.required !== undefined && typeof props.required !== 'boolean') err(`${at}.props.required`, 'must be true or false')
      if (props.placeholder !== undefined && typeof props.placeholder !== 'string') err(`${at}.props.placeholder`, 'must be a string')
      checkDefault(node, def, at, err)
      checkValidation(node, def, at, err)
    }

    checkStyle(props.style, def.styles || [], `${at}.props.style`, err, `"${node.type}"`)
    if (node.type === 'dropdown' || node.type === 'radio' || node.type === 'multiselect') {
      checkDataSource(props.data, `${at}.props.data`, err, node.type === 'multiselect')
    }
    if (node.type === 'radio' || node.type === 'multiselect') {
      if (props.layout !== undefined && !LAYOUTS.includes(props.layout)) err(`${at}.props.layout`, `must be one of: ${LAYOUTS.join(', ')}`)
    }
    if (node.type === 'file') checkFile(props, at, err)
    if (node.type === 'stepper') checkSteps(props, at, err)
    checkStep(node, doc, at, err)
    if (node.type === 'list') checkList(props, doc, at, err)
    if (node.type === 'label') {
      if (typeof props.text !== 'string') err(`${at}.props.text`, 'must be a string')
      if (props.variant !== undefined && !LABEL_VARIANTS.includes(props.variant)) err(`${at}.props.variant`, `must be one of: ${LABEL_VARIANTS.join(', ')}`)
    }
  })

  return { ok: errors.length === 0, errors }
}

/** Throws with every error listed. For code that must not continue with a bad document. */
export function assertValidDocument(doc, controls) {
  const { ok, errors } = validateDocument(doc, controls)
  if (!ok) {
    const e = new Error('Invalid screen document:\n' + errors.map((x) => `  ${x.path || '(document)'}: ${x.message}`).join('\n'))
    e.errors = errors
    throw e
  }
  return doc
}

function checkGeometry(node, at, err) {
  ;['x', 'y', 'w', 'h'].forEach((k) => {
    if (typeof node[k] !== 'number' || !Number.isFinite(node[k])) err(`${at}.${k}`, 'must be a number (a fraction — see "units")')
  })
  if (typeof node.x === 'number' && (node.x < 0 || node.x > 1)) err(`${at}.x`, 'must be between 0 and 1 (fraction of the width)')
  if (typeof node.w === 'number' && (node.w <= 0 || node.w > 1)) err(`${at}.w`, 'must be greater than 0 and at most 1 (fraction of the width)')
  if (typeof node.x === 'number' && typeof node.w === 'number' && node.x + node.w > 1.0001) err(`${at}.w`, `x + w is ${round(node.x + node.w)} — the control runs off the right edge (must be ≤ 1)`)
  if (typeof node.y === 'number' && node.y < 0) err(`${at}.y`, 'must be 0 or more (fraction of a page)')
  if (typeof node.h === 'number' && node.h <= 0) err(`${at}.h`, 'must be greater than 0 (fraction of a page)')
  if (node.z !== undefined && !Number.isInteger(node.z)) err(`${at}.z`, 'must be a whole number')
}

function checkDefault(node, def, at, err) {
  const v = node.props.default
  if (v === undefined) return
  const isDatetime = node.type === 'datetime'
  const ok = {
    string: () => typeof v === 'string',
    number: () => typeof v === 'number' && Number.isFinite(v),
    boolean: () => typeof v === 'boolean',
    array: () => Array.isArray(v),
    date: () => typeof v === 'string' && (isDatetime ? ISO_DATETIME.test(v) : ISO_DATE.test(v))
  }[def.valueType]
  if (ok && !ok()) err(`${at}.props.default`, `must be ${dateWord(def.valueType, isDatetime)}`)
}

function dateWord(valueType, isDatetime) {
  if (valueType === 'date') return isDatetime ? 'a date and time as "YYYY-MM-DDTHH:MM"' : 'a date as "YYYY-MM-DD"'
  if (valueType === 'array') return 'an array'
  return `a ${valueType}`
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/

/**
 * A stepper's steps: at least two, each with a key of its own, so a control can
 * be tied to one and stay tied to it when the others are renamed.
 */
function checkSteps(props, at, err) {
  const steps = props.steps
  if (!Array.isArray(steps)) { err(`${at}.props.steps`, 'must be an array of { key, label }'); return }
  if (steps.length < 2) err(`${at}.props.steps`, 'needs at least two steps — one step is not a journey')
  if (steps.length > STEP_LIMIT) err(`${at}.props.steps`, `has ${steps.length} steps — at most ${STEP_LIMIT}`)
  const seen = new Set()
  steps.forEach((s, j) => {
    const p = `${at}.props.steps[${j}]`
    if (!s || typeof s !== 'object') { err(p, 'must be { key, label }'); return }
    if (!nonEmptyString(s.key)) err(`${p}.key`, 'must be a non-empty string — what the controls on this step point at')
    else if (seen.has(s.key)) err(`${p}.key`, `"${s.key}" appears twice`)
    else seen.add(s.key)
    if (!nonEmptyString(s.label)) err(`${p}.label`, 'must be a non-empty string — what the person reads')
    const extra = Object.keys(s).filter((k) => k !== 'key' && k !== 'label')
    if (extra.length) err(p, `only "key" and "label" are used — remove: ${extra.join(', ')}`)
  })
  if (props.showNumbers !== undefined && typeof props.showNumbers !== 'boolean') err(`${at}.props.showNumbers`, 'must be true or false')
}

/** A node's `step`: a stepper that exists, and one of its steps. */
function checkStep(node, doc, at, err) {
  if (node.step === undefined) return
  const step = node.step
  if (!step || typeof step !== 'object' || Array.isArray(step)) { err(`${at}.step`, 'must be { of, index } — the stepper, and which step'); return }
  const extra = Object.keys(step).filter((k) => k !== 'of' && k !== 'index')
  if (extra.length) err(`${at}.step`, `only "of" and "index" are used — remove: ${extra.join(', ')}`)
  if (!nonEmptyString(step.of)) { err(`${at}.step.of`, 'must be the id of a stepper on this screen'); return }
  if (step.of === node.id) { err(`${at}.step.of`, 'a stepper cannot be a step of itself'); return }
  const owner = (doc.nodes || []).find((n) => n && n.id === step.of)
  if (!owner || owner.type !== 'stepper') { err(`${at}.step.of`, `"${step.of}" is not a stepper on this screen`); return }
  const count = Array.isArray(owner.props?.steps) ? owner.props.steps.length : 0
  if (!Number.isInteger(step.index) || step.index < 0 || step.index >= count) {
    err(`${at}.step.index`, `must be a step of "${step.of}" — it has ${count}`)
  }
}

/** A file field: which extensions it takes, and how big a file may be. */
function checkFile(props, at, err) {
  if (props.accept !== undefined) {
    if (typeof props.accept !== 'string') err(`${at}.props.accept`, 'must be a string of extensions, e.g. ".pdf,.docx"')
    else {
      const list = acceptList(props.accept)
      if (!list.length) err(`${at}.props.accept`, 'names no extension — ".pdf,.docx", or leave it out for any file')
      list.forEach((x) => {
        if (!EXTENSION.test(x)) err(`${at}.props.accept`, `"${x}" is not an extension — letters and digits after a dot, e.g. ".xlsx"`)
      })
    }
  }
  if (props.maxSize !== undefined) {
    if (!(Number.isFinite(props.maxSize) && props.maxSize > 0 && props.maxSize <= MAX_FILE_MB)) {
      err(`${at}.props.maxSize`, `must be a number of megabytes from 1 to ${MAX_FILE_MB}`)
    }
  }
}

const EXTENSION = /^\.[a-z0-9]{1,12}$/

function checkValidation(node, def, at, err) {
  const v = node.props.validation
  if (v === undefined) return
  if (!v || typeof v !== 'object' || Array.isArray(v)) { err(`${at}.props.validation`, 'must be an object'); return }
  Object.keys(v).forEach((key) => {
    const path = `${at}.props.validation.${key}`
    if (!def.validation.includes(key)) {
      err(path, def.validation.length
        ? `is not a rule for "${node.type}" — allowed: ${def.validation.join(', ')}`
        : `"${node.type}" takes no validation rules`)
      return
    }
    const val = v[key]
    if (key === 'minLength' || key === 'maxLength') {
      if (!(Number.isInteger(val) && val >= 0)) err(path, 'must be a whole number, 0 or more')
    } else if (key === 'integer') {
      if (typeof val !== 'boolean') err(path, 'must be true or false')
    } else if (key === 'pattern') {
      try { new RegExp(val) } catch (_) { err(path, `"${val}" is not a valid regular expression`) }
      if (typeof val !== 'string') err(path, 'must be a string')
    } else if (key === 'minItems' || key === 'maxItems') {
      if (!(Number.isInteger(val) && val >= 0)) err(path, 'must be a whole number, 0 or more')
    } else if (key === 'patternMessage') {
      if (typeof val !== 'string') err(path, 'must be a string')
    } else if (def.valueType === 'number') {
      if (!(typeof val === 'number' && Number.isFinite(val))) err(path, 'must be a number')
    } else if (def.valueType === 'date') {
      const re = node.type === 'datetime' ? ISO_DATETIME : ISO_DATE
      if (!(typeof val === 'string' && re.test(val))) err(path, `must be ${dateWord('date', node.type === 'datetime')}`)
    }
  })
  if (v.minItems != null && v.maxItems != null && v.minItems > v.maxItems) err(`${at}.props.validation`, 'minItems is greater than maxItems — nothing could pass')
  if (v.minLength != null && v.maxLength != null && v.minLength > v.maxLength) err(`${at}.props.validation`, 'minLength is greater than maxLength — nothing could pass')
  if (typeof v.min === 'number' && typeof v.max === 'number' && v.min > v.max) err(`${at}.props.validation`, 'min is greater than max — nothing could pass')
  if (typeof v.min === 'string' && typeof v.max === 'string' && v.min > v.max) err(`${at}.props.validation`, 'min is after max — no date could pass')
}

/**
 * A dropdown's options: typed in, or read from a table. Either way each option
 * is { id, name } — the id is what is saved, the name is what is shown.
 */
function checkDataSource(data, at, err, multi) {
  if (!data || typeof data !== 'object') {
    err(at, 'is required — { "source": "static", "options": [{ "id", "name" }] } or { "source": "table", "table": "<name>" }')
    return
  }
  if (data.source === 'static') {
    if (!Array.isArray(data.options)) { err(`${at}.options`, 'must be an array of { id, name }'); return }
    const seen = new Set()
    data.options.forEach((o, j) => {
      const p = `${at}.options[${j}]`
      if (!o || typeof o !== 'object') { err(p, 'must be { id, name }'); return }
      if (!(typeof o.id === 'string' || typeof o.id === 'number') || o.id === '') err(`${p}.id`, 'must be a non-empty string or a number')
      else if (multi && String(o.id).includes(MULTI_SEPARATOR)) err(`${p}.id`, `"${o.id}" contains "${MULTI_SEPARATOR}" — several choices are stored in one column, separated by it`)
      else if (seen.has(o.id)) err(`${p}.id`, `"${o.id}" appears twice`)
      else seen.add(o.id)
      if (!nonEmptyString(o.name)) err(`${p}.name`, 'must be a non-empty string — what the user sees')
      const extra = Object.keys(o).filter((k) => k !== 'id' && k !== 'name')
      if (extra.length) err(p, `only "id" and "name" are used — remove: ${extra.join(', ')}`)
    })
  } else if (data.source === 'table') {
    if (!nonEmptyString(data.table)) err(`${at}.table`, 'must name the table to read { id, name } rows from')
    const extra = Object.keys(data).filter((k) => k !== 'source' && k !== 'table')
    if (extra.length) err(at, `a table source takes only "table" — remove: ${extra.join(', ')}`)
  } else {
    err(`${at}.source`, 'must be "static" or "table"')
  }
}

/** `props.style` / the screen's `style`: only known keys, each in range. */
function checkStyle(style, allowed, at, err, owner) {
  if (style === undefined) return
  if (!style || typeof style !== 'object' || Array.isArray(style)) { err(at, 'must be an object'); return }
  Object.keys(style).forEach((key) => {
    const path = `${at}.${key}`
    const spec = STYLE_KEYS[key]
    if (!spec || !allowed.includes(key)) {
      err(path, `is not a style of ${owner} — allowed: ${allowed.join(', ')}`)
      return
    }
    const v = style[key]
    let ok
    switch (spec.type) {
      case 'number': ok = typeof v === 'number' && Number.isFinite(v) && v >= spec.min && v <= spec.max; break
      case 'select': ok = spec.options.some((o) => o.value === v); break
      case 'toggleValue': ok = v === 'normal' || v === spec.on; break
      case 'color': ok = typeof v === 'string' && (COLOR.test(v) || (key !== 'color' && key !== 'labelColor' && v === 'transparent')); break
      case 'font': ok = typeof v === 'string' && v.trim() !== '' && v.length <= 200 && !/[;{}<>]/.test(v); break
      default: ok = true
    }
    if (!ok) err(path, `must be ${spec.hint}`)
  })
}

/**
 * A list of saved records: where they come from, which columns, which actions.
 * With no `source` it reads the table the screen saves to, so one of the two
 * must be set.
 */
function checkList(props, doc, at, err) {
  if (props.openIn !== undefined && props.openIn !== 'popup' && props.openIn !== 'page') {
    err(`${at}.props.openIn`, 'must be "popup" or "page"')
  }
  if (props.title !== undefined && typeof props.title !== 'string') err(`${at}.props.title`, 'must be a string')
  if (props.source !== undefined && !(nonEmptyString(props.source) && TABLE_NAME.test(props.source))) err(`${at}.props.source`, 'must name the table to list records from')
  if (props.source === undefined && doc.source === undefined) err(`${at}.props.source`, 'is required when the screen has no "source" — which table should the list read?')
  if (props.editScreen !== undefined && !(nonEmptyString(props.editScreen) && SCREEN_ID.test(props.editScreen))) err(`${at}.props.editScreen`, 'must be the id of the screen that edits a record, e.g. "employee_edit"')
  if (props.pageSize !== undefined && !(Number.isInteger(props.pageSize) && props.pageSize >= 1 && props.pageSize <= 200)) err(`${at}.props.pageSize`, 'must be a whole number from 1 to 200')
  if (props.actions !== undefined) {
    if (!Array.isArray(props.actions)) err(`${at}.props.actions`, `must be an array of: ${LIST_ACTIONS.join(', ')}`)
    else props.actions.forEach((a, j) => { if (!LIST_ACTIONS.includes(a)) err(`${at}.props.actions[${j}]`, `must be one of: ${LIST_ACTIONS.join(', ')}`) })
  }
  if (props.columns !== undefined) {
    if (!Array.isArray(props.columns)) { err(`${at}.props.columns`, 'must be an array of { field, label }'); return }
    const seen = new Set()
    props.columns.forEach((c, j) => {
      const p = `${at}.props.columns[${j}]`
      if (!c || typeof c !== 'object') { err(p, 'must be { field, label }'); return }
      if (!(nonEmptyString(c.field) && FIELD_NAME.test(c.field))) err(`${p}.field`, 'must be a field name — letters, digits and _')
      else if (seen.has(c.field)) err(`${p}.field`, `"${c.field}" appears twice`)
      else seen.add(c.field)
      if (!nonEmptyString(c.label)) err(`${p}.label`, 'must be a non-empty string — the column heading')
      const extra = Object.keys(c).filter((k) => k !== 'field' && k !== 'label')
      if (extra.length) err(p, `only "field" and "label" are used — remove: ${extra.join(', ')}`)
    })
  }
}

function nonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== ''
}

function round(v) {
  return Math.round(v * 10000) / 10000
}
