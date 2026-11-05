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

import { SCREEN_EVENT_KEYS, FUNCTION_NAME } from './events.js'
import { CONTROLS, LABEL_VARIANTS, LIST_ACTIONS, STYLE_KEYS, SCREEN_STYLE_KEYS, LAYOUTS, MULTI_SEPARATOR, MAX_FILE_MB, STEP_LIMIT, acceptList, FILE_SOURCES, IMAGE_EXTENSIONS, MAX_FILES } from './controls.js'
import { DOCUMENT_KIND, DOCUMENT_VERSION } from './document.js'
import { DATE_PRESET_VALUES } from './listRange.js'
import { RESERVED_COLUMNS, MAX_IDENTIFIER } from './tableSchema.js'
import { FIELD_PRESETS, INPUT_TYPES, presetFor } from './presets.js'
import { isBinding } from './values.js'
import { BUTTON_VARIANTS, COLUMN_DISPLAYS, LIST_LAYOUTS, BADGE_TONES, CONDITION_OPERATORS, ASK_FIELD_TYPES, NOTE_INPUT, FILES_INPUT } from './buttons.js'

const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_.$-]*$/
const SCREEN_ID = /^[A-Za-z0-9_-]+$/
const DOCUMENT_KEYS = ['kind', 'version', 'id', 'name', 'source', 'units', 'aspect', 'width', 'style', 'description', 'master', 'labelField', 'params', 'events', 'nodes']
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

  // WHAT THIS FORM IS FOR, in the maker's own words. Three forms called
  // "Inspection" are told apart by this and by who made them — never by their
  // fields, which say what a form holds and not what it was for.
  if (doc.description !== undefined && doc.description !== null && doc.description !== '') {
    if (typeof doc.description !== 'string') err('description', 'must be a sentence about what this form is for')
    else if (doc.description.length > 500) err('description', 'must be under 500 characters — a sentence, not the manual')
  }

  // A MASTER is a form whose records other forms point at — departments,
  // statuses, countries. It is a FLAG on an ordinary form, not a kind of its
  // own: a master has a table, a list, an edit screen and permissions like
  // anything else, and a separate type would be two things that behave the
  // same until they do not, with every later feature asking which it has.
  if (doc.master !== undefined && typeof doc.master !== 'boolean') {
    err('master', 'must be true or false — whether other forms pick from this one')
  }
  // What a picker SHOWS for a record. Said once here rather than on every
  // dropdown that points at this form.
  if (doc.labelField !== undefined) {
    if (!nonEmptyString(doc.labelField)) err('labelField', 'must name a field of this screen, e.g. "name"')
    else if (!(doc.nodes || []).some((n) => n.props && n.props.name === doc.labelField)) {
      err('labelField', `"${doc.labelField}" is not a field on this screen`)
    }
  }

  // WHAT THIS SCREEN IS CALLED WITH. Names only — a field binds to one with
  // {params.<name>} as its default, so a name that is not a plain identifier
  // could never be referenced, and a duplicate would make the reference mean
  // two things.
  // EVENTS — functions picked by name, one per event (see events.js). Whether
  // each is REGISTERED is the server's to say, at publish and at run time:
  // this checks only that the screen asks for something that could exist.
  if (doc.events !== undefined) {
    if (!doc.events || typeof doc.events !== 'object' || Array.isArray(doc.events)) err('events', `must be { ${SCREEN_EVENT_KEYS.join(', ')} } — each the name of a registered function`)
    else Object.keys(doc.events).forEach((k) => {
      const v = doc.events[k]
      if (!SCREEN_EVENT_KEYS.includes(k)) err(`events.${k}`, `is not an event — one of: ${SCREEN_EVENT_KEYS.join(', ')}`)
      else if (v !== null && v !== '' && !(typeof v === 'string' && FUNCTION_NAME.test(v))) err(`events.${k}`, 'must be the name of a registered function, e.g. "checkSalaryBand"')
    })
  }
  if (doc.params !== undefined) {
    if (!Array.isArray(doc.params)) err('params', 'must be a list of inputs this screen is called with')
    else {
      const seen = new Set()
      doc.params.forEach((p, i) => {
        const name = p && p.name
        if (!nonEmptyString(name)) err(`params.${i}.name`, 'must be a name, e.g. "complaintId"')
        else if (!/^[A-Za-z_][\w]*$/.test(name)) err(`params.${i}.name`, `"${name}" must be letters, digits and _, starting with a letter`)
        else if (seen.has(name)) err(`params.${i}.name`, `"${name}" is declared twice — a field binding to it would mean two things`)
        else seen.add(name)
      })
    }
  }
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
  // A press names its button by id, so an id is unique on the whole screen.
  const buttonIds = new Map()

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
      // Where the field came from (a ready-made field's key), or false: plain on purpose.
      if (props.preset !== undefined && props.preset !== false && !presetFor(props.preset)) err(`${at}.props.preset`, `"${props.preset}" is not a ready-made field — one of: ${FIELD_PRESETS.map((p) => p.key).join(', ')}, or false`)
      if (props.inputType !== undefined && !INPUT_TYPES.includes(props.inputType)) err(`${at}.props.inputType`, `must be one of: ${INPUT_TYPES.join(', ')}`)

      // AN IDENTIFIER — the number or code this record is known by. How it is
      // made decides the column, so it is checked here rather than discovered
      // at publish time.
      if (props.idKind !== undefined && props.idKind !== 'code' && props.idKind !== 'auto') {
        err(`${at}.props.idKind`, 'must be "code" (CMP-7K3QF9, assigned on save) or "auto" (a number the database counts)')
      }
      if (props.codePrefix !== undefined && props.codePrefix !== '') {
        if (typeof props.codePrefix !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(props.codePrefix)) {
          err(`${at}.props.codePrefix`, 'must be up to 8 letters or digits, e.g. "CMP" — it is what the code starts with')
        }
      }
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
    if (node.type === 'buttons') checkButtons(props, at, err, buttonIds)
    if (node.type === 'subform') checkSubform(props, doc, at, err)
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
  // A BINDING fills the field when the screen opens — {params.x} or
  // {previous.<screen>.values.<field>} — so it is text whatever the field
  // holds. A date or number field may be filled from one as well.
  if (isBinding(v)) return
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
  checkFileRules(props, `${at}.props`, err)
}

/**
 * A file's rules — a file field's props, or a button's `ask.file`: what it
 * takes, how large, how many, and from where. `at` is where they sit.
 */
function checkFileRules(rules, at, err) {
  if (rules.accept !== undefined) {
    if (typeof rules.accept !== 'string') err(`${at}.accept`, 'must be a string of extensions, e.g. ".pdf,.docx"')
    else {
      const list = acceptList(rules.accept)
      if (!list.length) err(`${at}.accept`, 'names no extension — ".pdf,.docx", or leave it out for any file')
      list.forEach((x) => {
        if (!EXTENSION.test(x)) err(`${at}.accept`, `"${x}" is not an extension — letters and digits after a dot, e.g. ".xlsx"`)
      })
    }
  }
  if (rules.maxSize !== undefined) {
    if (!(Number.isFinite(rules.maxSize) && rules.maxSize > 0 && rules.maxSize <= MAX_FILE_MB)) {
      err(`${at}.maxSize`, `must be a number of megabytes from 1 to ${MAX_FILE_MB}`)
    }
  }
  if (rules.multiple !== undefined && typeof rules.multiple !== 'boolean') err(`${at}.multiple`, 'must be true or false')
  if (rules.maxFiles !== undefined) {
    if (!(Number.isInteger(rules.maxFiles) && rules.maxFiles >= 1 && rules.maxFiles <= MAX_FILES)) err(`${at}.maxFiles`, `must be a whole number of files from 1 to ${MAX_FILES}`)
    else if (!rules.multiple) err(`${at}.maxFiles`, 'is for several files — turn on "multiple", or remove it')
  }
  if (rules.source !== undefined) {
    const sources = FILE_SOURCES.map((s) => s.value)
    if (!sources.includes(rules.source)) err(`${at}.source`, `must be one of: ${sources.join(', ')}`)
    else if (rules.source === 'camera') {
      // A camera takes pictures: a field that also takes PDFs could never be
      // filled the way it says, and one that takes no images at all is wrong.
      const list = typeof rules.accept === 'string' ? acceptList(rules.accept) : []
      if (!list.length || list.some((x) => !IMAGE_EXTENSIONS.includes(x))) {
        err(`${at}.accept`, `a camera takes photos — with "source": "camera", the allowed types must be images only (${IMAGE_EXTENSIONS.join(',')})`)
      }
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
    } else if (key === 'integer' || key === 'notFuture') {
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
  // ROWS A FUNCTION WORKS OUT need no table — but everything that only a
  // function can answer (a search, chips and their counts, a hover box)
  // needs the function.
  const fed = props.rowsFrom !== undefined
  if (fed && !(nonEmptyString(props.rowsFrom) && FUNCTION_NAME.test(props.rowsFrom))) err(`${at}.props.rowsFrom`, 'must be the name of a registered function (event "listRows"), e.g. "orderList"')
  if (!fed && props.source === undefined && doc.source === undefined) err(`${at}.props.source`, 'is required when the screen has no "source" — which table should the list read? (or "rowsFrom": a function that works the rows out)')
  checkFedList(props, fed, at, err)
  if (props.grow !== undefined && typeof props.grow !== 'boolean') err(`${at}.props.grow`, 'must be true or false')
  // The page grows with it, so nothing can be placed beside or under it.
  if (props.grow && doc.nodes.length !== 1) err(`${at}.props.grow`, 'only for a list that is the screen\'s one control — the page grows with it, so nothing else has a place')
  if (props.editScreen !== undefined && !(nonEmptyString(props.editScreen) && SCREEN_ID.test(props.editScreen))) err(`${at}.props.editScreen`, 'must be the id of the screen that edits a record, e.g. "employee_edit"')

  // THE LINK BACK, for a sub-table on a form: this material's
  // characteristics. A column name, checked as one — a value that could never
  // be a column is a list that is always empty and nobody knows why.
  if (props.belongsTo !== undefined && props.belongsTo !== '') {
    if (!(nonEmptyString(props.belongsTo) && /^[A-Za-z_][\w]*$/.test(props.belongsTo))) {
      err(`${at}.props.belongsTo`, 'must be a column name, e.g. "materialId"')
    } else if (!props.source) {
      err(`${at}.props.belongsTo`, 'only means something with "Records from" set — a list of this screen\'s own table already belongs to this record')
    }
  }
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
      const allowed = fed ? FED_COLUMN_KEYS : ['field', 'label']
      const extra = Object.keys(c).filter((k) => !allowed.includes(k))
      if (extra.length) err(p, fed ? `has keys a column does not use — remove: ${extra.join(', ')}` : `only "field" and "label" are used — remove: ${extra.join(', ')} (the rest need "rowsFrom")`)
      if (fed) checkFedColumn(c, p, err)
    })
  }
}

// What a column of a function-fed list may say: the value it sorts by
// (`field`), the text shown for it (`text`, else the value), a second line,
// how it is drawn, badges after it, how many more pictures, and the function
// its hover box lists from.
const FED_COLUMN_KEYS = ['field', 'label', 'text', 'sub', 'display', 'badges', 'more', 'details', 'sortable']

/** The settings only a function-fed list has. */
function checkFedList(props, fed, at, err) {
  const need = (key, what) => { if (props[key] !== undefined && !fed) err(`${at}.props.${key}`, `${what} needs "rowsFrom" — a table's records have no function to ask`) }
  need('search', 'a search box')
  need('filters', 'filter chips')
  need('refreshEvery', 'refreshing')
  if (props.search !== undefined) {
    const sp = props.search
    if (!sp || typeof sp !== 'object' || Array.isArray(sp)) err(`${at}.props.search`, 'must be { placeholder } — the hint in the search box')
    else if (sp.placeholder !== undefined && typeof sp.placeholder !== 'string') err(`${at}.props.search.placeholder`, 'must be a string')
  }
  if (props.filters !== undefined) {
    if (!Array.isArray(props.filters)) err(`${at}.props.filters`, 'must be an array of { key, label }')
    else {
      const keys = new Set()
      props.filters.forEach((f, j) => {
        const p = `${at}.props.filters[${j}]`
        if (!f || typeof f !== 'object') { err(p, 'must be { key, label }'); return }
        if (!(nonEmptyString(f.key) && /^[A-Za-z0-9_-]+$/.test(f.key))) err(`${p}.key`, 'must be letters, digits, _ or - — what the function is asked for, e.g. "packed"')
        else if (keys.has(f.key)) err(`${p}.key`, `"${f.key}" appears twice`)
        else keys.add(f.key)
        if (!nonEmptyString(f.label)) err(`${p}.label`, 'must be the chip\'s text, e.g. "Packed"')
        const extra = Object.keys(f).filter((k) => k !== 'key' && k !== 'label')
        if (extra.length) err(p, `only "key" and "label" are used — remove: ${extra.join(', ')}`)
      })
    }
  }
  need('kpis', 'KPI cards')
  need('dateRange', 'a date range')
  need('layout', 'a layout')
  if (props.layout !== undefined && !LIST_LAYOUTS.includes(props.layout)) err(`${at}.props.layout`, `must be one of: ${LIST_LAYOUTS.join(', ')}`)
  if (props.kpis !== undefined) {
    if (!Array.isArray(props.kpis)) err(`${at}.props.kpis`, 'must be an array of { key, label, tone? }')
    else {
      const keys = new Set()
      props.kpis.forEach((k, j) => {
        const p = `${at}.props.kpis[${j}]`
        if (!k || typeof k !== 'object') { err(p, 'must be { key, label, tone? }'); return }
        if (!(nonEmptyString(k.key) && /^[A-Za-z0-9_-]+$/.test(k.key))) err(`${p}.key`, 'must be letters, digits, _ or - — what the function is asked for, e.g. "open"')
        else if (keys.has(k.key)) err(`${p}.key`, `"${k.key}" appears twice`)
        else keys.add(k.key)
        if (!nonEmptyString(k.label)) err(`${p}.label`, 'must be the card\'s text, e.g. "Open"')
        if (k.tone !== undefined && !BADGE_TONES.includes(k.tone)) err(`${p}.tone`, `must be one of: ${BADGE_TONES.join(', ')}`)
        const extra = Object.keys(k).filter((x) => !['key', 'label', 'tone'].includes(x))
        if (extra.length) err(p, `only "key", "label" and "tone" are used — remove: ${extra.join(', ')}`)
      })
    }
  }
  if (props.dateRange !== undefined) {
    const d = props.dateRange
    if (!d || typeof d !== 'object' || Array.isArray(d)) err(`${at}.props.dateRange`, 'must be { label?, default?, presets? } — the range the function is asked for')
    else {
      const extra = Object.keys(d).filter((x) => !['label', 'default', 'presets'].includes(x))
      if (extra.length) err(`${at}.props.dateRange`, `only "label", "default" and "presets" are used — remove: ${extra.join(', ')}`)
      if (d.presets !== undefined) {
        const ps = d.presets
        if (!Array.isArray(ps) || !ps.length) err(`${at}.props.dateRange.presets`, 'must be a list of the ranges the picker offers, e.g. ["today", "last7"] — or left out for all of them')
        else {
          const unknown = ps.filter((v) => !DATE_PRESET_VALUES.includes(v))
          if (unknown.length) err(`${at}.props.dateRange.presets`, `unknown: ${unknown.join(', ')} — each must be one of: ${DATE_PRESET_VALUES.join(', ')}`)
          if (new Set(ps).size !== ps.length) err(`${at}.props.dateRange.presets`, 'lists a range twice')
          if (d.default !== undefined && !ps.includes(d.default)) err(`${at}.props.dateRange.default`, `"${d.default}" is not one of the presets the picker offers`)
        }
      }
      if (d.label !== undefined && typeof d.label !== 'string') err(`${at}.props.dateRange.label`, 'must be a string, e.g. "Placed"')
      if (d.default !== undefined && !DATE_PRESET_VALUES.includes(d.default)) err(`${at}.props.dateRange.default`, `must be one of: ${DATE_PRESET_VALUES.join(', ')}`)
    }
  }
  if (props.refreshEvery !== undefined && !(Number.isInteger(props.refreshEvery) && props.refreshEvery >= 10 && props.refreshEvery <= 3600)) {
    err(`${at}.props.refreshEvery`, 'must be a whole number of seconds from 10 to 3600')
  }
  if (props.rowOpen !== undefined && typeof props.rowOpen !== 'boolean') err(`${at}.props.rowOpen`, 'must be true or false')
  if (props.rowOpen && !props.editScreen) err(`${at}.props.rowOpen`, 'needs "Edit in" (editScreen) — the screen a row opens in')
  // A worked-out row is not a record of one table: nothing to delete it from,
  // and Edit or New only with a screen to do it in.
  if (fed && Array.isArray(props.actions)) {
    if (props.actions.includes('delete')) err(`${at}.props.actions`, 'cannot include "delete" — rows from a function are not one table\'s records')
    if ((props.actions.includes('edit') || props.actions.includes('new')) && !props.editScreen) err(`${at}.props.actions`, 'Edit and New need "Edit in" (editScreen) — the screen they open')
  }
  if (props.highlight !== undefined && !(nonEmptyString(props.highlight) && FIELD_NAME.test(props.highlight))) err(`${at}.props.highlight`, 'must be a field of the row, e.g. "isNew"')
}

function checkFedColumn(c, p, err) {
  ;['text', 'sub', 'more'].forEach((k) => {
    if (c[k] !== undefined && !(nonEmptyString(c[k]) && FIELD_NAME.test(c[k]))) err(`${p}.${k}`, 'must be a field of the row — letters, digits and _')
  })
  if (c.display !== undefined && !COLUMN_DISPLAYS.includes(c.display)) err(`${p}.display`, `must be one of: ${COLUMN_DISPLAYS.join(', ')}`)
  if (c.more !== undefined && c.display !== 'images') err(`${p}.more`, 'only means something on an "images" column')
  if (c.details !== undefined) {
    if (!(nonEmptyString(c.details) && FUNCTION_NAME.test(c.details))) err(`${p}.details`, 'must be the name of a registered function (event "rowDetails")')
    else if (c.display !== 'activity') err(`${p}.details`, 'is what an "activity" column\'s hover box lists — set display to "activity"')
  }
  if (c.sortable !== undefined && typeof c.sortable !== 'boolean') err(`${p}.sortable`, 'must be true or false')
  if (c.badges !== undefined) {
    if (!Array.isArray(c.badges)) { err(`${p}.badges`, 'must be an array of { field, label, tone? }'); return }
    c.badges.forEach((b, k) => {
      const bp = `${p}.badges[${k}]`
      if (!b || typeof b !== 'object') { err(bp, 'must be { field, label, tone? }'); return }
      if (!(nonEmptyString(b.field) && FIELD_NAME.test(b.field))) err(`${bp}.field`, 'must be a field of the row — the badge shows where it is true')
      if (!nonEmptyString(b.label)) err(`${bp}.label`, 'must be the badge\'s text, e.g. "New"')
      if (b.tone !== undefined && !BADGE_TONES.includes(b.tone)) err(`${bp}.tone`, `must be one of: ${BADGE_TONES.join(', ')}`)
      const extra = Object.keys(b).filter((x) => !['field', 'label', 'tone'].includes(x))
      if (extra.length) err(bp, `only "field", "label" and "tone" are used — remove: ${extra.join(', ')}`)
    })
  }
}

const BUTTON_KEYS = ['id', 'label', 'action', 'params', 'ask', 'when', 'disabledWhen', 'pressedWhen', 'variant']
const ASK_KEYS = ['title', 'message', 'note']
// A button's `ask.file`: the file a press takes — a file field's rules, plus its label and required.
const ASK_FILE_KEYS = ['label', 'required', 'accept', 'maxSize', 'multiple', 'maxFiles', 'source']

/**
 * A panel of buttons. Each names a function and the values it is given; the
 * server checks the names against what is registered when the screen is
 * published (functionProblems). Here: the shape.
 */
const ASK_FIELD_KEYS = ['name', 'label', 'type', 'unit', 'required', 'min', 'max', 'fill']

/** A button's `ask.fields`: the values a press asks for, each reaching the function under its name. */
function checkAskFields(fields, params, at, err) {
  if (!Array.isArray(fields)) { err(at, 'must be a list of { name, label, type, unit?, required?, min?, max?, fill? }'); return }
  const seen = new Set()
  fields.forEach((f, i) => {
    const p = `${at}[${i}]`
    if (!f || typeof f !== 'object' || Array.isArray(f)) { err(p, 'must be { name, label, type, … }'); return }
    const bad = Object.keys(f).filter((k) => !ASK_FIELD_KEYS.includes(k))
    if (bad.length) err(p, `only ${ASK_FIELD_KEYS.map((k) => `"${k}"`).join(', ')} are used — remove: ${bad.join(', ')}`)
    if (!(nonEmptyString(f.name) && /^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(f.name))) err(`${p}.name`, 'must be letters, digits or _ — what the function receives it as, e.g. "lengthIn"')
    else if (seen.has(f.name)) err(`${p}.name`, `"${f.name}" is asked twice`)
    else if (f.name === NOTE_INPUT || f.name === FILES_INPUT) err(`${p}.name`, `"${f.name}" is the note's or the files' own name — use ask.note or ask.file`)
    else if (params && Object.prototype.hasOwnProperty.call(params, f.name)) err(`${p}.name`, `"${f.name}" is already one of the button's parameters — the screen gives it, so nobody should be asked`)
    else seen.add(f.name)
    if (!nonEmptyString(f.label)) err(`${p}.label`, 'must be what the person sees, e.g. "Length"')
    if (!ASK_FIELD_TYPES.includes(f.type)) err(`${p}.type`, `must be one of: ${ASK_FIELD_TYPES.join(', ')}`)
    if (f.unit !== undefined && !(typeof f.unit === 'string' && f.unit.length <= 12)) err(`${p}.unit`, 'must be a short text, e.g. "in" or "kg"')
    if (f.required !== undefined && typeof f.required !== 'boolean') err(`${p}.required`, 'must be true or false')
    ;['min', 'max'].forEach((k) => {
      if (f[k] === undefined) return
      if (f.type !== 'number') err(`${p}.${k}`, 'is for a number field')
      else if (!Number.isFinite(f[k])) err(`${p}.${k}`, 'must be a number')
    })
    if (Number.isFinite(f.min) && Number.isFinite(f.max) && f.min > f.max) err(`${p}.min`, 'is more than max')
    if (f.fill !== undefined && !(nonEmptyString(f.fill) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(f.fill))) err(`${p}.fill`, 'must be a field of the record, e.g. "parcelLengthIn"')
  })
}

function checkAskFile(f, at, err) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) { err(at, 'must be { label?, accept, maxSize?, multiple?, maxFiles?, source?, required? } — the file a press takes'); return }
  const bad = Object.keys(f).filter((k) => !ASK_FILE_KEYS.includes(k))
  if (bad.length) err(at, `only ${ASK_FILE_KEYS.map((k) => `"${k}"`).join(', ')} are used — remove: ${bad.join(', ')}`)
  if (f.label !== undefined && typeof f.label !== 'string') err(`${at}.label`, 'must be a string')
  if (f.required !== undefined && typeof f.required !== 'boolean') err(`${at}.required`, 'must be true or false')
  // The server checks an upload against these, so there must be something to check.
  if (f.accept === undefined) err(`${at}.accept`, 'is required — the extensions it takes, e.g. ".png,.jpg,.jpeg" (the server refuses anything else)')
  checkFileRules(f, at, err)
}

function checkButtons(props, at, err, ids) {
  if (props.title !== undefined && typeof props.title !== 'string') err(`${at}.props.title`, 'must be a string')
  if (!Array.isArray(props.buttons)) { err(`${at}.props.buttons`, 'must be an array of buttons — { id, label, action, params? }'); return }
  props.buttons.forEach((b, j) => {
    const p = `${at}.props.buttons[${j}]`
    if (!b || typeof b !== 'object' || Array.isArray(b)) { err(p, 'must be { id, label, action, params? }'); return }
    const extra = Object.keys(b).filter((k) => !BUTTON_KEYS.includes(k))
    if (extra.length) err(p, `has keys a button does not use — remove: ${extra.join(', ')}`)
    if (!(nonEmptyString(b.id) && /^[A-Za-z0-9_-]{1,60}$/.test(b.id))) err(`${p}.id`, 'must be letters, digits, _ or - — what a press names this button by, e.g. "packed"')
    else if (ids.has(b.id)) err(`${p}.id`, `"${b.id}" is already the id of ${ids.get(b.id)} — every button on a screen needs its own`)
    else ids.set(b.id, p)
    if (!nonEmptyString(b.label)) err(`${p}.label`, 'must be the button\'s text, e.g. "Packed"')
    if (!(nonEmptyString(b.action) && FUNCTION_NAME.test(b.action))) err(`${p}.action`, 'must be the name of a registered function (event "button"), e.g. "setOrderStatus"')
    if (b.params !== undefined) {
      if (!b.params || typeof b.params !== 'object' || Array.isArray(b.params)) err(`${p}.params`, 'must be { name: value } — what the function is given')
      else Object.keys(b.params).forEach((k) => {
        const v = b.params[k]
        if (!(v === null || ['string', 'number', 'boolean'].includes(typeof v))) err(`${p}.params.${k}`, 'must be a plain value — text, a number, true or false')
      })
    }
    if (b.ask !== undefined) {
      if (!b.ask || typeof b.ask !== 'object' || Array.isArray(b.ask)) err(`${p}.ask`, 'must be { title?, message?, note? } — what the person is asked before it runs')
      else {
        const bad = Object.keys(b.ask).filter((k) => !ASK_KEYS.includes(k) && k !== 'file' && k !== 'fields')
        if (bad.length) err(`${p}.ask`, `only ${[...ASK_KEYS, 'file', 'fields'].map((k) => `"${k}"`).join(', ')} are used — remove: ${bad.join(', ')}`)
        ASK_KEYS.forEach((k) => { if (b.ask[k] !== undefined && typeof b.ask[k] !== 'string') err(`${p}.ask.${k}`, 'must be a string') })
        if (b.ask.file !== undefined) checkAskFile(b.ask.file, `${p}.ask.file`, err)
        if (b.ask.fields !== undefined) checkAskFields(b.ask.fields, b.params, `${p}.ask.fields`, err)
      }
    }
    if (b.variant !== undefined && !BUTTON_VARIANTS.includes(b.variant)) err(`${p}.variant`, `must be one of: ${BUTTON_VARIANTS.join(', ')}`)
    ;['when', 'disabledWhen', 'pressedWhen'].forEach((k) => { if (b[k] !== undefined) checkRules(b[k], `${p}.${k}`, err) })
  })
}

/** Conditions on the record: @xeplr/rules rules, every one of which must match. */
function checkRules(rules, at, err) {
  if (!Array.isArray(rules)) { err(at, 'must be an array of { field, op, value } — every one must match'); return }
  rules.forEach((r, k) => {
    const p = `${at}[${k}]`
    if (!r || typeof r !== 'object') { err(p, 'must be { field, op, value }'); return }
    if (!(nonEmptyString(r.field) && FIELD_NAME.test(r.field))) err(`${p}.field`, 'must be a field of the record, e.g. "customStatus"')
    const op = CONDITION_OPERATORS.find((o) => o.key === r.op)
    if (!op) { err(`${p}.op`, `must be one of: ${CONDITION_OPERATORS.map((o) => o.key).join(', ')}`); return }
    if (!op.noValue && (r.value === undefined || r.value === null || r.value === '')) err(`${p}.value`, 'needs a value to compare with')
    if (op.second && (r.value2 === undefined || r.value2 === null || r.value2 === '')) err(`${p}.value2`, 'needs the other end of the range')
    const extra = Object.keys(r).filter((x) => !['field', 'op', 'value', 'value2'].includes(x))
    if (extra.length) err(p, `only "field", "op", "value" and "value2" are used — remove: ${extra.join(', ')}`)
  })
}

/**
 * A form inside this one. Both halves are required: a form with no link saves
 * a record belonging to nothing, and a link with no form is nothing. Itself is
 * refused — a form containing itself draws forever.
 */
function checkSubform(props, doc, at, err) {
  if (props.title !== undefined && typeof props.title !== 'string') err(`${at}.props.title`, 'must be a string')
  if (!(nonEmptyString(props.screen) && SCREEN_ID.test(props.screen))) err(`${at}.props.screen`, 'is required — the id of the form drawn here, e.g. "bank_details_edit"')
  else if (props.screen === doc.id) err(`${at}.props.screen`, 'cannot be this screen — a form cannot contain itself')
  if (!(nonEmptyString(props.belongsTo) && /^[A-Za-z_][\w]*$/.test(props.belongsTo))) {
    err(`${at}.props.belongsTo`, 'is required — the field on that form pointing back at this record, e.g. "employeeId"')
  }
}

function nonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== ''
}

function round(v) {
  return Math.round(v * 10000) / 10000
}
