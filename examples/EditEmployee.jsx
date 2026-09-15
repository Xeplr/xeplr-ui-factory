import { FactoryScreen, FactoryHooks } from '@xeplr/ui-factory'
import editScreen from './employee-edit.screen.json'

// Add / edit employee — saves itself as it is filled in; there is no submit.
// Opened in a popup from EmployeeList, or on its own page:
//   <EditEmployee api={api} />                 a new employee
//   <EditEmployee api={api} record={row} />    an existing one

// ── WHAT THE SCREENS DO IN THE BROWSER ──────────────────────────────────
// Every method runs the default (super). Change the ones you need; leave the
// rest as they are. Used by this page, by EmployeeList and by its popup.
//
//   before    change the input, then call super
//   after     call super, then use or change what it returns
//   override  do not call super
//
// ctx.screen says which screen is calling ("employee_list" or "employee_edit").
// Keep them as methods (save(values, ctx) { … }) — super does not work in
// arrow functions. Rules that must hold belong in the server's hooks.
export class EmployeeHooks extends FactoryHooks {
  /** A list's rows (ctx.many), or the record Edit opens (ctx.id). */
  get(ctx) {
    return super.get(ctx)
  }

  /** Every autosave — keep it quick. Returns the saved record. */
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

export const employeeHooks = new EmployeeHooks()

export default function EditEmployee({ api, record }) {
  return <FactoryScreen document={editScreen} record={record} {...api} hooks={employeeHooks} />
}
