// MAKING A MASTER — the one form shape every application repeats.
//
// Departments, statuses, countries, categories, reasons, priorities. They are
// all the same three things, and designing them one by one is drawing the same
// form over and over:
//
//   name         what it is called — what every picker shows
//   sortOrder    the order somebody wants to see them in, which is almost
//                never alphabetical: Low / Medium / High, not High / Low /
//                Medium
//   parent       the master it belongs to, when there is one — a state in a
//                country, a sub-category in a category
//
// So a master is MADE, not designed: name it, say what it belongs to, and it
// exists. It is still an ordinary form afterwards — its design opens in the
// builder like any other, and a fourth field can be added to it — because a
// master is a flag on a form and not a kind of form (see screenSource.js).
//
// Pure except for `createMaster`, which is the one place that talks to the
// server; the spec it builds is a plain object anything can check.

import { screensFromSpec, entityNames } from './generate.js'
import { describeScreen, formKeyOf } from './screenSource.js'

/** The field every master is shown by. Said once, here and in labelField. */
export var MASTER_LABEL = 'name'

/** The field every master is ordered by. */
export var MASTER_ORDER = 'sortOrder'

/**
 * "Departments" → "department": what the ENTITY is called.
 *
 * A master is named in the plural, because it is a list — and an entity is
 * named in the singular, because it is one row. entityNames does not know
 * that, so "Departments" straight through makes a `departmentses` table and a
 * screen called department**s**_edit. Nobody notices until the table is
 * created, and then it cannot be renamed.
 *
 * Crude on purpose: enough for the words masters are actually called, and
 * wrong quietly rather than cleverly — the key is shown before anything is
 * made, and can be typed over.
 */
export function singularOf(label) {
  var words = String(label || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  var last = words[words.length - 1]
  words[words.length - 1] = /ies$/i.test(last) ? last.slice(0, -3) + 'y'
    : /(ss|us|is)$/i.test(last) ? last
    : /s$/i.test(last) ? last.slice(0, -1)
    : last
  return words.join(' ')
}

/**
 * The entity spec for a master.
 *
 * @param name    what it is called, as a person writes it — "Departments"
 * @param parent  optional { table, label } — the master this one belongs to
 * @param plural  optional, when the plural is not name + s
 */
export function masterSpec({ name, parent, plural }) {
  var label = String(name || '').trim()
  if (!label) throw new Error('A master needs a name, e.g. "Departments"')

  var fields = [
    // Required, because a master row with no name is a blank line in every
    // dropdown that points at it.
    { label: 'Name', type: 'text', required: true },
    // Not required: most lists are fine alphabetical, and a number somebody
    // is forced to invent for every row is a tax on adding one.
    { label: 'Sort order', type: 'number' }
  ]

  if (parent && parent.table) {
    fields.push({
      label: parent.label || 'Belongs to',
      type: 'dropdown',
      table: parent.table,
      required: true
    })
  }

  return { entity: entityNames(singularOf(label), plural).singular, plural: plural, fields: fields }
}

/**
 * Make one: both screens, marked as a master, published.
 *
 * PUBLISHED, because a master that is a draft has no table, so nothing can
 * point at it and nobody can add a row — which is the whole of what a master
 * is for. The one case where publishing on somebody's behalf is right: there
 * is no design decision left to make.
 *
 * @param api     a createFactoryApi() instance
 * @param spec    { name, parent, plural } — see masterSpec
 * @returns the new master, as describeScreen reports it
 */
export async function createMaster(api, spec) {
  var pair = screensFromSpec(masterSpec(spec))

  // The FLAG goes on the edit screen: it is the one that describes the
  // record, and labelField can only name a field that exists there.
  var edit = Object.assign({}, pair.edit, { master: true, labelField: MASTER_LABEL })
  var list = Object.assign({}, pair.list, { master: true })

  // Drafts first, then published — the same two steps the builder takes, so a
  // master is not a second way of writing a screen.
  await api.saveDraft(edit)
  await api.saveDraft(list)
  await api.publish(edit)
  await api.publish(list)

  return describeScreen(edit)
}

/**
 * A CHILD TABLE — rows that belong to one record of another form.
 *
 * This material's characteristics, this order's lines. Two fields and a link,
 * which is the whole of what a sub-table is before somebody designs it:
 *
 *   name     what the row is
 *   value    what it says — optional, but it is why most sub-tables exist
 *   <link>   the record it belongs to, DECLARED AS AN INPUT so the list that
 *            opens it can supply it (see screenParams). Bound with
 *            {params.<link>} rather than typed, hidden when given and asked
 *            when not — the same field, whether it is opened from a material
 *            or on its own.
 *
 * @param name    what the child is called — "Material characteristics"
 * @param parent  { table, label, link } — the form it belongs to, and the
 *                column pointing back at it
 */
export function childSpec({ name, parent, plural }) {
  var label = String(name || '').trim()
  if (!label) throw new Error('A table needs a name, e.g. "Characteristics"')
  if (!parent || !parent.table || !parent.link) throw new Error('A child table needs the record it belongs to')

  return {
    entity: entityNames(singularOf(label), plural).singular,
    plural: plural,
    fields: [
      // The link first, because it is what the row IS before it is anything
      // else — and hidden in practice, since the list supplies it.
      { label: parent.linkLabel || parent.label || 'Belongs to', name: parent.link,
        type: 'dropdown', table: parent.table, required: true, default: '{params.' + parent.link + '}' },
      { label: 'Name', type: 'text', required: true },
      { label: 'Value', type: 'text' }
    ]
  }
}

/**
 * Make one, published, with the link declared as an input.
 *
 * Published for the same reason a master is: a draft has no table, so the
 * list that is about to point at it would have nothing to read.
 *
 * @returns { key, edit, list, link } — what the List control needs to be
 *          pointed at it.
 */
export async function createChildTable(api, spec) {
  var pair = screensFromSpec(childSpec(spec))
  var link = spec.parent.link

  // The link is what this screen is CALLED WITH. Declared here rather than
  // left as an ordinary field so the form knows not to ask for it when the
  // list already said.
  var edit = Object.assign({}, pair.edit, { params: [{ name: link }] })

  await api.saveDraft(edit)
  await api.saveDraft(pair.list)
  await api.publish(edit)
  await api.publish(pair.list)

  return { key: formKeyOf(edit.id), edit: edit.id, list: pair.list.id, source: edit.source, link: link }
}

/**
 * The masters another master may belong to: every one except itself.
 *
 * A master that is its own parent is a row that can never be filled in, and
 * the dropdown would offer the record being created.
 */
export function possibleParents(masters, exceptKey) {
  return (masters || []).filter(function (m) { return m && m.key && m.key !== exceptKey })
}
