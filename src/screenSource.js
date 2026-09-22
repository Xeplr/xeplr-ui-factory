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

import { inputNodes } from './document.js'

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
    })
  }
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
