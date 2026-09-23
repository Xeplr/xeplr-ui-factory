// WHAT A FLOW NEEDS TO KNOW ABOUT THIS APP'S SCREENS.
//
// @xeplr/ui-workflow's designer offers a Screen step, and asks its host two
// things: which screens exist, and what each one hands back when somebody
// submits it. It cannot answer either itself — it carries a screen key and
// knows nothing else about forms, on purpose, so that an app with a different
// screen system is not locked out.
//
// This is @xeplr/factory's answer, ONCE. It used to be written out in the app:
// list the screens, load each document, filter the nodes that hold a value,
// map them to names and types. That is the same twenty lines in every app the
// CLI scaffolds, hand-copied, drifting apart the first time a control type is
// added here — which is exactly the kind of code that should not be in an
// application at all.
//
// Pure: no React. The hook around it is useScreenSource.js.

import { inputNodes, screenParams } from './document.js'

/**
 * A screen document → what the designer needs.
 *
 * `inputNodes` is this package's own answer to "which nodes hold a value", so
 * a label, a stepper or a divider is never offered as a field — and a control
 * type added later is included here without anybody editing an app.
 */
export function describeScreen(doc) {
  if (!doc || !doc.id) return null
  return {
    key: doc.id,
    name: doc.name || doc.id,
    fields: inputNodes(doc).map(function (n) {
      return { name: n.id, type: n.type }
    }),
    // WHAT THIS SCREEN IS CALLED WITH — the inputs it declares, the way an
    // action declares its inputSchema. A flow's Screen step asks for exactly
    // these; a screen that declares none is asked for nothing.
    inputs: screenParams(doc).map(function (p) {
      return { name: p.name, label: p.label || p.name, type: p.type || 'string', required: Boolean(p.required) }
    }),
    // A MASTER is a list other forms point at. Reported here so a picker can
    // offer "Departments" before it offers thirty raw table names, and so the
    // admin section can gather them without reading every document again.
    master: Boolean(doc.master),
    labelField: doc.labelField || null,
    source: doc.source || null
  }
}

/** The form a screen belongs to: task_edit and task_list are one form. */
export function formKeyOf(screenKey) {
  var m = /^(.*)_(edit|list)$/.exec(String(screenKey || ''))
  return m ? m[1] : String(screenKey || '')
}

/**
 * THE MASTERS, gathered from the screens an app has.
 *
 * A master is a property of the FORM, and a form is two screens — the edit
 * screen is where it is declared, because that is the one that describes the
 * record. The list screen is what the admin section opens, because looking at
 * a master means looking at its rows.
 *
 * Returns [{ key, name, labelField, edit, list, source }], by name.
 */
export function masterForms(screens) {
  var byForm = {}
  ;(screens || []).forEach(function (sc) {
    if (!sc || !sc.key) return
    var form = formKeyOf(sc.key)
    var entry = byForm[form] || (byForm[form] = { key: form, name: null, labelField: null, edit: null, list: null, source: null })
    if (/_list$/.test(sc.key)) entry.list = sc.key
    else entry.edit = sc.key
    if (sc.master) {
      entry.master = true
      entry.name = entry.name || sc.name
      entry.labelField = entry.labelField || sc.labelField
      entry.source = entry.source || sc.source
    }
    // A name to show even when the flag is on the other half of the pair.
    if (!entry.name && !/_list$/.test(sc.key)) entry.name = sc.name
  })

  return Object.keys(byForm)
    .map(function (k) { return byForm[k] })
    .filter(function (f) { return f.master })
    .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)) })
}

/** A listing row → the same shape, before its document has been read. */
export function screenStub(row) {
  if (!row) return null
  var key = row.screenKey || row.id || row.key
  if (!key) return null
  return { key: key, name: row.name || key }
}

/**
 * Every screen, with its fields.
 *
 * TWO PASSES, because the second is slow and the first is what makes the menu
 * usable: `onList` is called with the names as soon as they arrive, and the
 * result resolves once each document has been read. A document that will not
 * load leaves its screen in the list WITHOUT fields — choosable, with its
 * output typed by hand, rather than missing.
 *
 * @param api     a createFactoryApi() instance
 * @param onList  optional, called with the names-only list first
 */
export async function loadScreens(api, onList) {
  var rows = await api.listScreens()
  var stubs = (rows || []).map(screenStub).filter(Boolean)
  if (onList) onList(stubs)

  return Promise.all(stubs.map(async function (stub) {
    try {
      return describeScreen(await api.loadScreen(stub.key)) || stub
    } catch (err) {
      return stub
    }
  }))
}

/**
 * DELETE A FORM — both of its screens.
 *
 * The list first, then the edit screen: while the list still exists the table
 * is still described, so the edit screen's delete is the one that can find
 * the table unused and empty. The other order leaves the table behind.
 *
 * @returns what became of the table: { table, tableDropped, records }
 */
export async function deleteForm(api, form) {
  if (!form || !form.key) throw new Error('Which form?')

  // A HALF OF A FORM IS A KEY OR THE ROW THAT CARRIES ONE. Callers group
  // screens for their own listing and hold whatever was convenient — a key
  // here, a listing row there — and a row put into a URL reads as
  // "[object Object]", which is a 404 naming a screen nobody could have
  // asked for.
  var half = function (x) {
    if (!x) return null
    return typeof x === 'string' ? x : (x.screenKey || x.id || x.key || null)
  }

  var list = half(form.list)
  var edit = half(form.edit) || form.key

  if (list) await api.deleteScreen(list)
  var last = await api.deleteScreen(edit)
  return last || { table: null, tableDropped: false, records: null }
}

/** "Leave request" → "leave_request": what a new form is keyed by. */
export function keyFromName(label) {
  return String(label == null ? '' : label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * The screen a new entity's FORM half is, from what createEntity answered.
 *
 * Read off the response rather than spelled out here: the naming is this
 * package's and may not stay "<key>_edit", and an app guessing it would break
 * quietly the day it changes.
 */
export function editScreenOf(made, fallbackKey) {
  var edit = made && made.edit
  if (edit && typeof edit === 'object') return edit.id || edit.screenKey || fallbackKey
  return edit || fallbackKey
}
