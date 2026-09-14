import { FactoryScreen } from '@xeplr/ui-factory'
import editScreen from './employee-edit.screen.json'

// Add / edit employee — saves itself as it is filled in; there is no submit.
// Opened in a popup from EmployeeList, or on its own page:
//   <EditEmployee api={api} />                 a new employee
//   <EditEmployee api={api} record={row} />    an existing one
export default function EditEmployee({ api, record }) {
  return <FactoryScreen document={editScreen} record={record} {...api} />
}
