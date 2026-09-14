// THE FILES an entity becomes in an app.
//
// Asked for "a form for employees", Claude produces two screens and two
// pages that show them:
//
//   employee-list.screen.json   EmployeeList.jsx   — the list; Edit / New open a popup
//   employee-edit.screen.json   EditEmployee.jsx   — the add / edit form, also a page on its own
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
    [`${names.editComponent}.jsx`]: editPage(names, editJson, edit)
  }
  return { files, names, list, edit }
}

function listPage(n, listJson, editJson, list, edit) {
  return `import { FactoryScreen } from '@xeplr/ui-factory'
import listScreen from './${listJson}'
import editScreen from './${editJson}'

// ${n.pluralTitle} — the saved ${list.source}, with New / Edit / Delete.
// Edit and New open "${edit.name}" (${edit.id}) in a popup.
//
// \`api\` is the app's data calls — the factory never touches a database:
//   onSave(values, { id, source })  → the saved record, with its id
//   fetchRecords({ source })        → records
//   onDelete({ id, source, record })
//   fetchOptions({ table })         → [{ id, name }] for dropdowns
export default function ${n.listComponent}({ api }) {
  return (
    <FactoryScreen
      document={listScreen}
      screens={{ [editScreen.id]: editScreen }}
      {...api}
    />
  )
}
`
}

function editPage(n, editJson, edit) {
  return `import { FactoryScreen } from '@xeplr/ui-factory'
import editScreen from './${editJson}'

// ${edit.name} — saves itself as it is filled in; there is no submit.
// Opened in a popup from ${n.listComponent}, or on its own page:
//   <${n.editComponent} api={api} />                 a new ${n.singular}
//   <${n.editComponent} api={api} record={row} />    an existing one
export default function ${n.editComponent}({ api, record }) {
  return <FactoryScreen document={editScreen} record={record} {...api} />
}
`
}
