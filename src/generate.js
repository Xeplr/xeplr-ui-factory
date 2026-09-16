// FROM A REQUEST TO A SCREEN.
//
// Screens are usually started by Claude from a plain-English request — "a form
// for a new employee with name, email, department…" — and then adjusted by a
// person in the builder. Writing fractional coordinates for every control by
// hand is exactly the part of that an assistant gets subtly wrong (overlaps, a
// field running off the edge), so this takes a SPEC — what is on the screen,
// in order — and does the layout: a tidy one- or two-column form.
//
//   screenFromSpec({
//     name: 'New employee',
//     fields: [
//       { label: 'First name', required: true },
//       { label: 'Last name', required: true },
//       { label: 'Email', validation: { pattern: '^\\S+@\\S+$', patternMessage: 'Enter a valid email' } },
//       { label: 'Department', type: 'dropdown', table: 'departments', required: true },
//       { label: 'Employment type', type: 'dropdown', options: ['Full time', 'Part time'] },
//       { label: 'Start date', type: 'date' },
//       { label: 'Notes', type: 'textarea' }
//     ]
//   })
//
// The result is an ordinary document, checked before it is returned; from
// there it is edited like any other.

import { CONTROLS, CHOICE_TYPES } from './controls.js'
import { createScreen, addControl, MARGIN, GAP, slugify, camelName } from './document.js'
import { assertValidDocument } from './validateDocument.js'

/** Heights by control, as page fractions (a page is as tall as it is wide). */
export const SPEC_HEIGHTS = {
  text: 0.08, number: 0.08, date: 0.08, datetime: 0.08, dropdown: 0.08,
  file: 0.1,
  textarea: 0.18,
  // A group is as tall as its options make it — see heightOf().
  radio: 0.14, multiselect: 0.18,
  checkbox: 0.05,
  list: 0.42,
  label: { heading: 0.07, subheading: 0.055, text: 0.045 }
}

/**
 * Space between ROWS. Wider than the gap between columns: a field's error
 * message is drawn in the space below it, and must not touch the next label.
 */
export const ROW_GAP = 0.04

const FIELD_KEYS = ['type', 'label', 'name', 'required', 'placeholder', 'default', 'validation', 'data', 'options', 'table', 'layout', 'accept', 'maxSize', 'width', 'text', 'variant', 'style']
const SPEC_KEYS = ['name', 'id', 'source', 'columns', 'heading', 'fields', 'list', 'aspect', 'width', 'style']
const LIST_KEYS = ['title', 'source', 'columns', 'pageSize', 'actions', 'style']

/**
 * @param spec
 *   name      screen title (required)
 *   id?       document id — defaults to the name, snake_cased
 *   columns?  1 or 2 (default 2)
 *   heading?  true (default) puts the name at the top; a string uses that text; false for none
 *   fields    in reading order. Each: { label, type?='text', name?, required?, placeholder?,
 *             default?, validation?, width?: 'half'|'full' }
 *             dropdown: options: ['Full time', …] or [{ id, name }]  —or—  table: 'departments'
 *             section heading: { type: 'label', text, variant?: 'subheading' }
 *   source?   the table records are saved to, e.g. 'employees'
 *   width?    design width in px (default 800) — style sizes are px at this width
 *   style?    screen-wide defaults: { fontFamily, fontSize, color, background }
 *   list?     true, or { title, source, columns: [{ field, label }], pageSize, actions } —
 *             a list of the saved records below the fields, with New / Edit / Delete
 *
 * There is no submit button: a screen saves itself as it is filled in.
 */
export function screenFromSpec(spec, controls = CONTROLS) {
  if (!spec || typeof spec !== 'object') throw new Error('screenFromSpec: spec must be an object')
  unknownKeys(spec, SPEC_KEYS, 'spec')
  if (!spec.name || typeof spec.name !== 'string') throw new Error('screenFromSpec: spec.name is required, e.g. "New employee"')
  if (!Array.isArray(spec.fields)) throw new Error('screenFromSpec: spec.fields must be an array')
  const columns = spec.columns === undefined ? 2 : spec.columns
  if (columns !== 1 && columns !== 2) throw new Error('screenFromSpec: spec.columns must be 1 or 2')

  let doc = createScreen({ name: spec.name, id: spec.id, aspect: spec.aspect, width: spec.width, source: spec.source, style: spec.style })
  const full = 1 - 2 * MARGIN
  const colW = round((full - (columns - 1) * GAP) / columns)
  let y = MARGIN
  let col = 0
  let rowH = 0

  const place = (type, props, width) => {
    const h = heightOf(type, props)
    const isFull = width === 'full' || columns === 1 || type === 'textarea' || type === 'label' || type === 'list'
    if (isFull) {
      if (col > 0) { y += rowH + ROW_GAP; col = 0; rowH = 0 }
      ;({ document: doc } = addControl(doc, type, { at: { x: MARGIN, y: round(y) }, size: { w: round(full), h }, props }, controls))
      y += h + ROW_GAP
      return
    }
    const x = MARGIN + col * (colW + GAP)
    ;({ document: doc } = addControl(doc, type, { at: { x: round(x), y: round(y) }, size: { w: colW, h }, props }, controls))
    rowH = Math.max(rowH, h)
    col++
    if (col === columns) { y += rowH + ROW_GAP; col = 0; rowH = 0 }
  }

  if (spec.heading !== false) {
    place('label', { text: typeof spec.heading === 'string' ? spec.heading : spec.name, variant: 'heading' }, 'full')
  }

  spec.fields.forEach((field, i) => {
    const at = `spec.fields[${i}]`
    if (!field || typeof field !== 'object') throw new Error(`screenFromSpec: ${at} must be an object`)
    unknownKeys(field, FIELD_KEYS, at)
    const type = field.type || 'text'
    if (!controls[type]) throw new Error(`screenFromSpec: ${at}.type "${type}" is not a control — one of: ${Object.keys(controls).join(', ')}`)
    if (field.width !== undefined && field.width !== 'half' && field.width !== 'full') throw new Error(`screenFromSpec: ${at}.width must be "half" or "full"`)
    place(type, propsFromField(type, field, at), field.width)
  })

  if (col > 0) { y += rowH + ROW_GAP; col = 0; rowH = 0 }

  if (spec.list) {
    const list = spec.list === true ? {} : spec.list
    if (typeof list !== 'object') throw new Error('screenFromSpec: spec.list must be true or an object')
    unknownKeys(list, LIST_KEYS, 'spec.list')
    const props = { title: 'Saved records', pageSize: 10, actions: ['new', 'edit', 'delete'], ...list }
    place('list', props, 'full')
  }

  return assertValidDocument(doc, controls)
}

function propsFromField(type, field, at) {
  if (type === 'label') {
    const props = { text: field.text ?? field.label ?? '', variant: field.variant || 'subheading' }
    if (field.style) props.style = field.style
    return props
  }
  if (!field.label) throw new Error(`screenFromSpec: ${at}.label is required`)
  const props = { label: field.label }
  ;['name', 'required', 'placeholder', 'default', 'validation', 'style'].forEach((k) => {
    if (field[k] !== undefined) props[k] = field[k]
  })
  if (type === 'dropdown' && props.placeholder === undefined) props.placeholder = 'Select…'
  if (CHOICE_TYPES.includes(type)) {
    props.data = dataFromField(field, at, type)
    if (field.layout !== undefined && type !== 'dropdown') props.layout = field.layout
    // A field reading another table stores that row's id: name the column
    // for what it holds — "Department" → departmentId, a foreign key.
    if (props.data.source === 'table' && props.name === undefined && type !== 'multiselect') props.name = camelName(field.label) + 'Id'
  }
  else if (field.options || field.table || field.data) throw new Error(`screenFromSpec: ${at} — options/table/data only apply to ${CHOICE_TYPES.join(', ')}`)
  if (type === 'file') {
    ;['accept', 'maxSize'].forEach((k) => { if (field[k] !== undefined) props[k] = field[k] })
  } else if (field.accept !== undefined || field.maxSize !== undefined) {
    throw new Error(`screenFromSpec: ${at} — accept/maxSize only apply to a file`)
  }
  return props
}

function dataFromField(field, at, type) {
  if (field.data) return field.data
  if (field.table) return { source: 'table', table: field.table }
  if (Array.isArray(field.options)) {
    return {
      source: 'static',
      options: field.options.map((o) => (typeof o === 'string'
        ? { id: slugify(o, '_') || o, name: o }
        : o))
    }
  }
  throw new Error(`screenFromSpec: ${at} is a ${type} — give it options: [...] or table: "<name>"`)
}

function heightOf(type, props) {
  const h = SPEC_HEIGHTS[type]
  if (type === 'label') return h[props.variant] || h.text
  // A group of options grows with them: the label, then a line per option
  // (or one line for all of them, side by side).
  if (type === 'radio' || type === 'multiselect') {
    const n = props.data?.source === 'static' ? (props.data.options || []).length : 4
    const lines = props.layout === 'horizontal' ? 1 : Math.max(n, 1)
    return round(LABEL_H + lines * OPTION_H)
  }
  return h || 0.08
}

/** A field's label, and one option, as page fractions. */
const LABEL_H = 0.035
const OPTION_H = 0.03

function unknownKeys(obj, allowed, at) {
  const extra = Object.keys(obj).filter((k) => !allowed.includes(k))
  if (extra.length) throw new Error(`screenFromSpec: ${at} has unknown key(s) ${extra.join(', ')} — allowed: ${allowed.join(', ')}`)
}

function round(v) {
  return Math.round(v * 10000) / 10000
}

// ── an entity: a LIST screen and an EDIT screen ──────────────────────────
//
// "Create a form for employees" is two screens, not one:
//
//   employee_list  — the saved employees, in a list; Edit and New open…
//   employee_edit  — …the add / edit form, in a popup (or on its own page)
//
// The list names the edit screen (`editScreen`), which is the only link
// between them; both save to and read from the same table.

const ENTITY_KEYS = ['entity', 'plural', 'source', 'fields', 'columns', 'listColumns', 'pageSize', 'actions', 'width', 'style', 'aspect']

/**
 * @param spec
 *   entity       singular name, e.g. "employee" (required)
 *   plural?      e.g. "employees" (default: entity + "s")
 *   source?      table records are saved in (default: plural, snake_cased)
 *   fields       the edit form's fields — exactly as screenFromSpec
 *   columns?     1 or 2 — the edit form's layout (default 2)
 *   listColumns? [{ field, label }] or ["firstName", …] — the list's columns
 *                (default: up to the first 5 fields)
 *   pageSize?, actions?, width?, style?
 * @returns {{ list, edit }} two checked screen documents
 */
export function screensFromSpec(spec, controls = CONTROLS) {
  if (!spec || typeof spec !== 'object') throw new Error('screensFromSpec: spec must be an object')
  unknownKeys(spec, ENTITY_KEYS, 'spec')
  if (!spec.entity || typeof spec.entity !== 'string') throw new Error('screensFromSpec: spec.entity is required, e.g. "employee"')
  const names = entityNames(spec.entity, spec.plural)
  const source = spec.source || names.table

  const edit = screenFromSpec({
    name: `Add / edit ${names.singular}`,
    id: `${names.key}_edit`,
    source,
    columns: spec.columns,
    fields: spec.fields,
    width: spec.width,
    style: spec.style,
    aspect: spec.aspect
  }, controls)

  const fieldNodes = edit.nodes.filter((n) => controls[n.type]?.input)
  const byName = Object.fromEntries(fieldNodes.map((n) => [n.props.name, n]))
  let listColumns
  if (Array.isArray(spec.listColumns) && spec.listColumns.length) {
    listColumns = spec.listColumns.map((c, i) => {
      const field = typeof c === 'string' ? c : c && c.field
      if (!byName[field]) throw new Error(`screensFromSpec: spec.listColumns[${i}] "${field}" is not a field of the edit form — one of: ${Object.keys(byName).join(', ')}`)
      return { field, label: (typeof c === 'object' && c.label) || byName[field].props.label }
    })
  } else {
    listColumns = fieldNodes.slice(0, 5).map((n) => ({ field: n.props.name, label: n.props.label }))
  }

  let list = createScreen({ name: names.pluralTitle, id: `${names.key}_list`, source, width: spec.width, style: spec.style, aspect: spec.aspect })
  ;({ document: list } = addControl(list, 'list', {
    at: { x: MARGIN, y: MARGIN },
    size: { w: round(1 - 2 * MARGIN), h: 0.8 },
    props: {
      title: names.pluralTitle,
      editScreen: edit.id,
      columns: listColumns,
      pageSize: spec.pageSize || 10,
      actions: spec.actions || ['new', 'edit', 'delete']
    }
  }, controls))

  return { list: assertValidDocument(list, controls), edit }
}

/**
 * "employee" → the names the pair uses everywhere, so the ids, files, table and
 * components always agree.
 */
export function entityNames(entity, plural) {
  const words = String(entity).trim().replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!words.length) throw new Error('entity must contain letters or digits')
  const pluralWords = plural
    ? String(plural).trim().replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)
    : [...words.slice(0, -1), pluralise(words[words.length - 1])]
  const lower = (ws) => ws.map((w) => w.toLowerCase())
  const pascal = (ws) => ws.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
  return {
    singular: lower(words).join(' '),                     // "employee"
    pluralTitle: capitalise(lower(pluralWords).join(' ')), // "Employees"
    key: lower(words).join('_'),                          // "employee"  → ids employee_list / employee_edit
    file: lower(words).join('-'),                         // "employee"  → employee-list.screen.json
    table: lower(pluralWords).join('_'),                  // "employees"
    listComponent: `${pascal(words)}List`,                // "EmployeeList"
    editComponent: `Edit${pascal(words)}`,                // "EditEmployee"
    hooksClass: `${pascal(words)}Hooks`,                  // "EmployeeHooks" — in EditEmployee.jsx
    hooksInstance: `${lowerFirst(pascal(words))}Hooks`    // "employeeHooks"
  }
}

function pluralise(word) {
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies'
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + 'es'
  return word + 's'
}

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
