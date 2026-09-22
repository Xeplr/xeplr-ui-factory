// THE FILES an entity becomes in an app.
//
// Asked for "a form for employees", Claude produces two screens and two
// pages that show them:
//
//   employee-list.screen.json   EmployeeList.jsx   — the list; Edit / New open a popup
//   employee-edit.screen.json   EditEmployee.jsx   — the add / edit form, also a page on its own
//   employee.hooks.js                              — the server's hooks for its records (all empty)
//   employee.model.js                              — the server's model: getters / setters for its values (none yet)
//
// The pages are thin on purpose: a screen document and the app's data calls,
// nothing else. Changing what a screen shows is editing its JSON in the
// designer, never these files.
//
// Pure: returns { path → contents }. Writing them is the caller's (the CLI).

import { screensFromSpec, entityNames } from './generate.js'

/**
 * @param spec  as screensFromSpec
 * @returns {{ files: Object<string, string>, names, list, edit }}
 */
export function scaffoldEntity(spec, controls) {
  const { list, edit } = screensFromSpec(spec, controls)
  const names = entityNames(spec.entity, spec.plural)
  const listJson = `${names.file}-list.screen.json`
  const editJson = `${names.file}-edit.screen.json`

  const files = {
    [listJson]: JSON.stringify(list, null, 2) + '\n',
    [editJson]: JSON.stringify(edit, null, 2) + '\n',
    [`${names.listComponent}.jsx`]: listPage(names, listJson, editJson, list, edit),
    [`${names.editComponent}.jsx`]: editPage(names, editJson, edit),
    [`${names.file}.hooks.js`]: hooksFile(names, edit),
    [`${names.file}.model.js`]: modelFile(names, edit)
  }
  return { files, names, list, edit }
}

function listPage(n, listJson, editJson, list, edit) {
  return `import { FactoryScreen } from '@xeplr/ui-factory'
import listScreen from './${listJson}'
import editScreen from './${editJson}'
import { ${n.hooksInstance} } from './${n.editComponent}.jsx'

// ${n.pluralTitle} — the saved ${list.source}, with New / Edit / Delete.
// Edit and New open "${edit.name}" (${edit.id}) in a popup.
//
// \`api\` is the app's data calls — the factory never touches a database:
//   onSave(values, { id, source })  → the saved record, with its id
//   fetchRecords({ source })        → records
//   onDelete({ id, source, record })
//   fetchOptions({ table })         → [{ id, name }] for dropdowns
//
// Its hooks are ${n.editComponent}.jsx's — the same ones run in the popup.
export default function ${n.listComponent}({ api }) {
  return (
    <FactoryScreen
      document={listScreen}
      screens={{ [editScreen.id]: editScreen }}
      {...api}
      hooks={${n.hooksInstance}}
    />
  )
}
`
}

function hooksFile(n, edit) {
  return `// Server hooks for ${n.singular} records — screen "${edit.id}" (and "${n.key}_list", which edits in it).
//
// Register with @xeplr/factory:
//   factory.init({ knex, hooks: { ${edit.id}: require('./${n.file}.hooks') } })
//
// Each operation has four hooks. Delete the ones you do not need.
//   before(ctx)       first — save: return new values to replace them (they are then checked
//                     against the screen's rules); get: narrow ctx.query; any: ctx.reject(message, { field })
//   after(ctx)        once it succeeded — ctx.id, ctx.result; return a value to replace the result.
//                     If it throws, the operation still happened (and error is told).
//   error(ctx, err)   when the operation failed
//   override(ctx)     does the WHOLE operation instead — no rules, no before / after / error,
//                     no generic query. What it returns is the response.
//
// ctx: op, screenKey, screen, table, id, isNew (save), many (get), input (what the UI sent, read-only),
//      values (save), previous (save / delete: the row before), result, user, tenant, knex, query (get), reject

module.exports = {
  save: {
    // before: async function(ctx) { return ctx.values },
    // after: async function(ctx) {},
    // error: async function(ctx, err) {},
    // override: async function(ctx) { return savedRecord },
  },
  get: {
    // before: async function(ctx) { /* ctx.query.where(...) */ },
    // after: async function(ctx) { return ctx.result },
    // error: async function(ctx, err) {},
    // override: async function(ctx) { return ctx.id ? record : records },
  },
  delete: {
    // before: async function(ctx) {},
    // after: async function(ctx) {},
    // error: async function(ctx, err) {},
    // override: async function(ctx) { return { id: ctx.id } },
  }
}
`
}

function modelFile(n, edit) {
  return `// The model for ${n.singular} records — how values are shaped between your code and
// the "${edit.source}" table, like Sequelize's getters and setters.
//
// Register with @xeplr/factory:  factory.init({ knex, hooks, models: [require('./${n.file}.model')] })
//
// Used everywhere: the screens' routes and factory.table('${edit.source}'). Models shape
// data; the hooks file decides behaviour.

var { FactoryModel } = require('@xeplr/factory');

class ${n.hooksClass.replace(/Hooks$/, 'Model')} extends FactoryModel {
  static table = '${edit.source}';

  // Per field: set(value, values) before it is written, get(value, row) after it is read.
  //   tags: { set: (v) => (Array.isArray(v) ? v.join(',') : v), get: (v) => (v ? v.split(',') : []) }
  static fields = {};

  /** Every value about to be written. Override for more than one field at a time. */
  static toDb(values) {
    return super.toDb(values);
  }

  /** Every row just read. */
  static fromDb(row) {
    return super.fromDb(row);
  }
}

module.exports = ${n.hooksClass.replace(/Hooks$/, 'Model')};
`
}

function editPage(n, editJson, edit) {
  return `import { FactoryScreen, FactoryHooks } from '@xeplr/ui-factory'
import editScreen from './${editJson}'

// ${edit.name} — Save sends it over AJAX (one call; never a form submit).
// Opened in a popup from ${n.listComponent}, or on its own page:
//   <${n.editComponent} api={api} />                 a new ${n.singular}
//   <${n.editComponent} api={api} record={row} />    an existing one

// ── WHAT THE SCREENS DO IN THE BROWSER ──────────────────────────────────
// Every method runs the default (super). Change the ones you need; leave the
// rest as they are. Used by this page, by ${n.listComponent} and by its popup.
//
//   before    change the input, then call super
//   after     call super, then use or change what it returns
//   override  do not call super
//
// ctx.screen says which screen is calling ("${n.key}_list" or "${edit.id}").
// Keep them as methods (save(values, ctx) { … }) — super does not work in
// arrow functions. Rules that must hold belong in the server's hooks.
export class ${n.hooksClass} extends FactoryHooks {
  /** A list's rows (ctx.many), or the record Edit opens (ctx.id). */
  get(ctx) {
    return super.get(ctx)
  }

  /** The Save button. Returns the saved record. */
  save(values, ctx) {
    return super.save(values, ctx)
  }

  /** A list row, after the person confirmed. */
  delete(record, ctx) {
    return super.delete(record, ctx)
  }

  /** Extra row buttons beside Edit / Delete: [{ label, onClick: (record, ctx) => … }]. ctx.refresh() reloads. */
  actions(ctx) {
    return super.actions(ctx)
  }
}

export const ${n.hooksInstance} = new ${n.hooksClass}()

export default function ${n.editComponent}({ api, record }) {
  return <FactoryScreen document={editScreen} record={record} {...api} hooks={${n.hooksInstance}} />
}
`
}
