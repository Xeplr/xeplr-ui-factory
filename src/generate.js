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

import { CONTROLS } from './controls.js'
import { createScreen, addControl, MARGIN, GAP, slugify } from './document.js'
import { assertValidDocument } from './validateDocument.js'

/** Heights by control, as page fractions (a page is as tall as it is wide). */
export const SPEC_HEIGHTS = {
  text: 0.08, number: 0.08, date: 0.08, dropdown: 0.08,
  textarea: 0.18,
  checkbox: 0.06,
  button: 0.07,
  label: { heading: 0.07, subheading: 0.055, text: 0.045 }
}

/**
 * Space between ROWS. Wider than the gap between columns: a field's error
 * message is drawn in the space below it, and must not touch the next label.
 */
export const ROW_GAP = 0.04

const FIELD_KEYS = ['type', 'label', 'name', 'required', 'placeholder', 'default', 'validation', 'data', 'options', 'table', 'width', 'text', 'variant']
const SPEC_KEYS = ['name', 'id', 'columns', 'heading', 'fields', 'submit', 'reset', 'aspect']

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
 *   submit?   button label (default 'Save'); false for no submit button
 *   reset?    reset button label; omitted/false for none
 */
export function screenFromSpec(spec, controls = CONTROLS) {
  if (!spec || typeof spec !== 'object') throw new Error('screenFromSpec: spec must be an object')
  unknownKeys(spec, SPEC_KEYS, 'spec')
  if (!spec.name || typeof spec.name !== 'string') throw new Error('screenFromSpec: spec.name is required, e.g. "New employee"')
  if (!Array.isArray(spec.fields)) throw new Error('screenFromSpec: spec.fields must be an array')
  const columns = spec.columns === undefined ? 2 : spec.columns
  if (columns !== 1 && columns !== 2) throw new Error('screenFromSpec: spec.columns must be 1 or 2')

  let doc = createScreen({ name: spec.name, id: spec.id, aspect: spec.aspect })
  const full = 1 - 2 * MARGIN
  const colW = round((full - (columns - 1) * GAP) / columns)
  let y = MARGIN
  let col = 0
  let rowH = 0

  const place = (type, props, width) => {
    const h = heightOf(type, props)
    const isFull = width === 'full' || columns === 1 || type === 'textarea' || type === 'label'
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

  // One row of buttons, left-aligned. Narrow on purpose: a full-width Save
  // reads as a banner, not a button.
  const buttons = []
  if (spec.submit !== false) buttons.push({ label: typeof spec.submit === 'string' ? spec.submit : 'Save', action: 'submit' })
  if (spec.reset) buttons.push({ label: typeof spec.reset === 'string' ? spec.reset : 'Reset', action: 'reset' })
  const buttonW = 0.18
  buttons.forEach((props, i) => {
    const at = { x: round(MARGIN + i * (buttonW + GAP)), y: round(y) }
    ;({ document: doc } = addControl(doc, 'button', { at, size: { w: buttonW, h: SPEC_HEIGHTS.button }, props }, controls))
  })

  return assertValidDocument(doc, controls)
}

function propsFromField(type, field, at) {
  if (type === 'label') {
    return { text: field.text ?? field.label ?? '', variant: field.variant || 'subheading' }
  }
  if (type === 'button') {
    return { label: field.label || 'Save', action: 'submit' }
  }
  if (!field.label) throw new Error(`screenFromSpec: ${at}.label is required`)
  const props = { label: field.label }
  ;['name', 'required', 'placeholder', 'default', 'validation'].forEach((k) => {
    if (field[k] !== undefined) props[k] = field[k]
  })
  if (type === 'dropdown' && props.placeholder === undefined) props.placeholder = 'Select…'
  if (type === 'dropdown') props.data = dataFromField(field, at)
  else if (field.options || field.table || field.data) throw new Error(`screenFromSpec: ${at} — options/table/data only apply to a dropdown`)
  return props
}

function dataFromField(field, at) {
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
  throw new Error(`screenFromSpec: ${at} is a dropdown — give it options: [...] or table: "<name>"`)
}

function heightOf(type, props) {
  const h = SPEC_HEIGHTS[type]
  if (type === 'label') return h[props.variant] || h.text
  return h || 0.08
}

function unknownKeys(obj, allowed, at) {
  const extra = Object.keys(obj).filter((k) => !allowed.includes(k))
  if (extra.length) throw new Error(`screenFromSpec: ${at} has unknown key(s) ${extra.join(', ')} — allowed: ${allowed.join(', ')}`)
}

function round(v) {
  return Math.round(v * 10000) / 10000
}
