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
//
// Nothing here runs code. A document holds names and values only, so the same
// screen can be drawn by anything that reads it, and what a button may do is
// decided on the server, where nobody can skip it.
//
// Conditions — when a button shows, when it is disabled — are @xeplr/rules
// rules, the same condition language as the rest of xeplr, read from the
// record the screen is about. Every rule must match.

import { matches, OPERATORS } from '@xeplr/rules'

export const BUTTON_EVENT = 'button'
export const LIST_ROWS_EVENT = 'listRows'
export const ROW_DETAILS_EVENT = 'rowDetails'

/** How a button looks: an ordinary one, the main one, or one that undoes or removes. */
export const BUTTON_VARIANTS = ['default', 'primary', 'danger']

/** What a list column can be drawn as. Every one shows text the server wrote. */
export const COLUMN_DISPLAYS = ['text', 'images', 'activity']

/** A badge's colour. */
export const BADGE_TONES = ['accent', 'success', 'warning', 'danger', 'muted']

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
  return ((doc && doc.nodes) || [])
    .filter((n) => n.type === 'buttons')
    .flatMap((node) => ((node.props && node.props.buttons) || []).map((button) => ({ node, button })))
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
 * note when it asks for one, and the stored files when it takes them.
 */
export function buttonInput(button, note, files) {
  const input = { ...((button && button.params) || {}) }
  if (button && button.ask && button.ask.note && note !== undefined && note !== null && String(note).trim() !== '') {
    input[NOTE_INPUT] = String(note).trim()
  }
  if (askFile(button) && Array.isArray(files) && files.length) input[FILES_INPUT] = files.slice()
  return input
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
 * rows, a column's hover box, each button. `at` is where in the document, so
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
    if (node.type === 'buttons') {
      ;(Array.isArray(p.buttons) ? p.buttons : []).forEach((b, j) => {
        if (b && typeof b.action === 'string' && b.action) out.push({ event: BUTTON_EVENT, name: b.action, at: `nodes[${i}].props.buttons[${j}].action`, button: b })
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
    if (params[f.name] === undefined || params[f.name] === null || params[f.name] === '') problems.push(`needs "${f.name}"`)
  })
  if (button && button.ask && button.ask.note && !byName.has(NOTE_INPUT)) problems.push(`asks for a note, but takes no "${NOTE_INPUT}"`)
  if (askFile(button) && !byName.has(FILES_INPUT)) problems.push(`asks for a file, but takes no "${FILES_INPUT}"`)
  return problems
}

/** A schema field's allowed values: `options` as plain values or { value, label }. */
export function optionValues(options) {
  return (Array.isArray(options) ? options : []).map((o) => (o && typeof o === 'object' && 'value' in o ? o.value : o))
}
