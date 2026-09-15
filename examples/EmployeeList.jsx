import { FactoryScreen } from '@xeplr/ui-factory'
import listScreen from './employee-list.screen.json'
import editScreen from './employee-edit.screen.json'
import { employeeHooks } from './EditEmployee.jsx'

// Employees — the saved employees, with New / Edit / Delete.
// Edit and New open "Add / edit employee" (employee_edit) in a popup.
//
// `api` is the app's data calls — the factory never touches a database:
//   onSave(values, { id, source })  → the saved record, with its id
//   fetchRecords({ source })        → records
//   onDelete({ id, source, record })
//   fetchOptions({ table })         → [{ id, name }] for dropdowns
//
// Its hooks are EditEmployee.jsx's — the same ones run in the popup.
export default function EmployeeList({ api }) {
  return (
    <FactoryScreen
      document={listScreen}
      screens={{ [editScreen.id]: editScreen }}
      {...api}
      hooks={employeeHooks}
    />
  )
}
