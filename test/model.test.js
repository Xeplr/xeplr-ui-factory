// The screen model — documents, the checker, values, and spec → screen.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { createRequire } from 'node:module'
import {
  CONTROLS, createScreen, addControl, moveNode, setNodeProperty, removeNodes, inputNodes,
  camelName, uniqueFieldName, validateDocument, assertValidDocument, formSchema, initialValues,
  parseInput, validateValues, fieldError, optionValue, screenFromSpec, getAtPath, setAtPath,
  saveState, recordValues, displayValue, listColumns, listSource, setScreenProperty,
  screensFromSpec, entityNames, scaffoldEntity,
  tableForScreen, columnForField, migrationFor, nextMigrationName, planTableChange, columnFromDatabase
} from '../src/model.js'
import { normaliseOptions } from '../src/useFactoryScreen.js'

const require = createRequire(import.meta.url)
const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }
const throws = (fn, re) => { try { fn(); return false } catch (e) { return re ? re.test(e.message) : true } }

const EMPLOYEE = {
  name: 'New employee',
  fields: [
    { label: 'First name', required: true },
    { label: 'Last name', required: true },
    { label: 'Email', validation: { pattern: '^\\S+@\\S+$', patternMessage: 'Enter a valid email' } },
    { label: 'Department', type: 'dropdown', table: 'departments', required: true },
    { label: 'Employment type', type: 'dropdown', options: ['Full time', 'Part time'] },
    { label: 'Start date', type: 'date', validation: { min: '2020-01-01' } },
    { label: 'Salary', type: 'number', validation: { min: 0, integer: true } },
    { label: 'Remote', type: 'checkbox' },
    { label: 'Notes', type: 'textarea', validation: { maxLength: 10 } }
  ],
  source: 'employees',
  list: { title: 'Employees' }
}

console.log('\na new screen')
{
  const doc = createScreen({ name: 'New employee' })
  check('is named', doc.name === 'New employee')
  check('gets an id from its name', doc.id === 'new_employee')
  check('is proportional, a page as tall as it is wide', doc.units === 'fraction' && doc.aspect === 1)
  check('is designed at 800px unless told otherwise', doc.width === 800)
  check('starts empty and valid', doc.nodes.length === 0 && validateDocument(doc).ok)
  check('an empty name still makes a valid screen', validateDocument(createScreen({ name: '   ' })).ok)
}

console.log('\nadding controls')
{
  let doc = createScreen({ name: 'X' })
  let r = addControl(doc, 'text'); doc = r.document
  check('the first control lands at the top-left margin', r.node.x === 0.04 && r.node.y === 0.04)
  check('an input gets a field name from its label', r.node.props.name === 'text')
  r = addControl(doc, 'text'); doc = r.document
  check('a second one gets a unique name', r.node.props.name === 'text2')
  check('...and a unique id', r.node.id !== doc.nodes[0].id)
  check('...and goes below the first, not on top of it', r.node.y > doc.nodes[0].y + doc.nodes[0].h)
  r = addControl(doc, 'dropdown', { at: { x: 0.9, y: -1 } }); doc = r.document
  check('a drop near the right edge is pulled back onto the screen', r.node.x + r.node.w <= 1)
  check('...and a negative y clamps to the top', r.node.y === 0)
  check('adding never mutates the input', createScreen({ name: 'X' }).nodes.length === 0)
  check('an unknown type is refused', throws(() => addControl(doc, 'slider'), /Unknown control/))
  check('the result is valid', validateDocument(doc).ok)
  check('a label control has no field name', addControl(doc, 'label').node.props.name === undefined)
}

console.log('\nediting')
{
  let doc = createScreen({ name: 'X' })
  doc = addControl(doc, 'text', { props: { label: 'Email' } }).document
  const id = doc.nodes[0].id
  doc = moveNode(doc, id, { x: 0.123456789, y: 0.5, w: 0.3, junk: 5 })
  check('a move rounds to 4 decimals', doc.nodes[0].x === 0.1235)
  check('...and ignores anything that is not geometry', doc.nodes[0].junk === undefined)
  doc = setNodeProperty(doc, id, 'props.validation.maxLength', 50)
  check('a nested property is set by path', doc.nodes[0].props.validation.maxLength === 50)
  doc = setNodeProperty(doc, id, 'props.validation.maxLength', undefined)
  check('clearing the last rule removes the empty validation object', doc.nodes[0].props.validation === undefined)
  doc = setNodeProperty(doc, id, 'props.placeholder', '')
  check('a blank string removes the key rather than saving ""', !('placeholder' in doc.nodes[0].props))
  doc = setNodeProperty(doc, id, 'props.required', false)
  check('false is a value, kept', doc.nodes[0].props.required === false)
  const labelDoc = addControl(createScreen({}), 'label').document
  const emptied = setNodeProperty(setNodeProperty(labelDoc, labelDoc.nodes[0].id, 'props.text', undefined), labelDoc.nodes[0].id, 'props.variant', undefined)
  check('emptying every prop still leaves props: {}', emptied.nodes[0].props && Object.keys(emptied.nodes[0].props).length === 0)
  check('removing drops the node', removeNodes(doc, [id]).nodes.length === 0)

  let dd = addControl(createScreen({}), 'dropdown').document
  const ddId = dd.nodes[0].id
  dd = setNodeProperty(dd, ddId, 'props.label', 'Office location')
  check('relabelling a fresh control renames its field to match', dd.nodes[0].props.name === 'officeLocation')
  dd = setNodeProperty(dd, ddId, 'props.label', 'Site')
  check('...and keeps following while the name is still generated', dd.nodes[0].props.name === 'site')
  dd = setNodeProperty(dd, ddId, 'props.name', 'site_id')
  dd = setNodeProperty(dd, ddId, 'props.label', 'Branch')
  check('a name someone typed is left alone', dd.nodes[0].props.name === 'site_id')
  let two = addControl(addControl(createScreen({}), 'text', { props: { label: 'Email' } }).document, 'text').document
  two = setNodeProperty(two, two.nodes[1].id, 'props.label', 'Email')
  check('a followed name never collides with another field', two.nodes[1].props.name === 'email2' && validateDocument(two).ok)
  check('an unknown id changes nothing', moveNode(doc, 'nope', { x: 0.5 }) === doc)
}

console.log('\nnames')
check('"Date of birth" → dateOfBirth', camelName('Date of birth') === 'dateOfBirth')
check('accents and punctuation are dropped', camelName('Café — Name!') === 'cafeName')
check('a name cannot start with a digit', camelName('2nd line') === '_2ndLine')
check('uniqueFieldName counts past taken names', uniqueFieldName({ nodes: [{ props: { name: 'a' } }, { props: { name: 'a2' } }] }, 'a') === 'a3')

console.log('\npaths')
check('getAtPath reads nested', getAtPath({ a: { b: { c: 1 } } }, 'a.b.c') === 1)
check('...and is safe on a missing branch', getAtPath({}, 'a.b.c') === undefined)
{
  const src = { a: { b: 1 }, keep: { x: 1 } }
  const out = setAtPath(src, 'a.b', 2)
  check('setAtPath copies only along the path', out.keep === src.keep && src.a.b === 1 && out.a.b === 2)
}

console.log('\nthe checker says exactly what is wrong')
{
  const bad = {
    kind: 'xeplr-screen', version: 1, id: 's', name: 'S', units: 'fraction', aspect: 1,
    nodes: [
      { id: 'a', type: 'text', x: 0.7, y: 0, w: 0.5, h: 0.1, props: { name: 'email', label: 'Email', colour: 'red' } },
      { id: 'a', type: 'number', x: 0, y: 0.2, w: 0.4, h: 0.1, props: { name: 'email', label: 'Age', validation: { min: 10, max: 5, maxLength: 3 } } },
      { id: 'c', type: 'dropdown', x: 0, y: 0.4, w: 0.4, h: 0.1, props: { name: '1st', label: 'Dept', data: { source: 'static', options: [{ id: 'x', name: 'X' }, { id: 'x', name: '' }] } } },
      { id: 'd', type: 'dropdown', x: 0, y: 0.6, w: 0.4, h: 0.1, props: { name: 'dept', label: 'Dept', data: { source: 'sql', query: 'select *' } } },
      { id: 'e', type: 'slider', x: 0, y: 0.8, w: 0.4, h: 0.1, props: {} },
      { id: 'f', type: 'date', x: 0, y: 0.9, w: 0.4, h: 0.1, props: { name: 'start', label: 'Start', default: '14/09/2026' } }
    ]
  }
  const { ok, errors } = validateDocument(bad)
  const has = (path, re) => errors.some((e) => e.path === path && (!re || re.test(e.message)))
  check('not ok', ok === false)
  check('runs off the right edge', has('nodes[0].w', /right edge/))
  check('an unknown property is named, with the allowed list', has('nodes[0].props.colour', /allowed: name, label/))
  check('a duplicate id points at the first use', has('nodes[1].id', /nodes\[0\]/))
  check('two fields saving to one key', has('nodes[1].props.name', /cannot save to one key/))
  check('min above max', has('nodes[1].props.validation', /min is greater than max/))
  check('a rule that does not belong to the type', has('nodes[1].props.validation.maxLength', /not a rule for "number"/))
  check('a field name that is not an identifier', has('nodes[2].props.name', /must start with a letter/))
  check('a repeated option id', has('nodes[2].props.data.options[1].id', /twice/))
  check('an option with no name', has('nodes[2].props.data.options[1].name'))
  check('a source that is not static or table', has('nodes[3].props.data.source', /"static" or "table"/))
  check('an unknown control lists the real ones', has('nodes[4].type', /one of: text, textarea/))
  check('a date default in the wrong format', has('nodes[5].props.default', /YYYY-MM-DD/))
  check('assertValidDocument throws with every problem listed', throws(() => assertValidDocument(bad), /nodes\[0\]\.w[\s\S]*nodes\[5\]/))
  check('a non-object is refused outright', !validateDocument(null).ok && !validateDocument([]).ok)
}

console.log('\nspec → screen')
{
  const doc = screenFromSpec(EMPLOYEE)
  const byName = Object.fromEntries(doc.nodes.filter((n) => n.props.name).map((n) => [n.props.name, n]))
  check('is valid', validateDocument(doc).ok)
  check('a heading with the screen name comes first', doc.nodes[0].type === 'label' && doc.nodes[0].props.text === 'New employee')
  check('two columns: first and last name share a row', byName.firstName.y === byName.lastName.y && byName.lastName.x > byName.firstName.x)
  check('a textarea takes the full width', byName.notes.w > 0.9)
  check('a table dropdown', byName.departmentId.props.data.source === 'table' && byName.departmentId.props.data.table === 'departments')
  check('string options become { id, name }', JSON.stringify(byName.employmentType.props.data.options[0]) === '{"id":"full_time","name":"Full time"}')
  check('no control overlaps another', noOverlaps(doc.nodes))
  check('nothing runs off the right edge', doc.nodes.every((n) => n.x + n.w <= 1.0001))
  check('there are no buttons — the screen saves itself', !doc.nodes.some((n) => n.type === 'button') && !CONTROLS.button)
  const list = doc.nodes.find((n) => n.type === 'list')
  check('a list of saved records goes below the fields, full width', list && list.y > byName.notes.y && list.w > 0.9)
  check('...reading the table the screen saves to', listSource(doc, list) === 'employees')
  check('submit/reset in a spec are refused now', throws(() => screenFromSpec({ ...EMPLOYEE, submit: 'Save' }), /unknown key\(s\) submit/))
  check('one column stacks every field', noOverlaps(screenFromSpec({ ...EMPLOYEE, columns: 1 }).nodes) &&
    screenFromSpec({ ...EMPLOYEE, columns: 1 }).nodes.filter((n) => n.props.name).every((n) => n.x === 0.04))
  check('an unknown key is refused with the allowed list', throws(() => screenFromSpec({ name: 'X', fields: [{ label: 'A', colour: 'red' }] }), /unknown key\(s\) colour — allowed/))
  check('a dropdown without options or table is refused', throws(() => screenFromSpec({ name: 'X', fields: [{ label: 'A', type: 'dropdown' }] }), /options: \[\.\.\.\] or table/))
  check('options on a non-dropdown are refused', throws(() => screenFromSpec({ name: 'X', fields: [{ label: 'A', options: ['a'] }] }), /only apply to a dropdown/))
  check('no name is refused', throws(() => screenFromSpec({ fields: [] }), /name is required/))
  check('heading: false leaves it out', screenFromSpec({ ...EMPLOYEE, heading: false }).nodes[0].type !== 'label')
}

console.log('\nvalues')
{
  const doc = screenFromSpec(EMPLOYEE)
  const node = (name) => doc.nodes.find((n) => n.props.name === name)
  check('a checkbox starts unticked', initialValues(doc).remote === false)
  check('provided values win', initialValues(doc, { firstName: 'Ada' }).firstName === 'Ada')
  check('an emptied box is undefined, not ""', parseInput(node('firstName'), '') === undefined)
  check('a cleared number is undefined, not 0', parseInput(node('salary'), '') === undefined)
  check('a number box gives a number', parseInput(node('salary'), '42') === 42)
  check('a <select> string maps back to a numeric table id', optionValue([{ id: 7, name: 'Ops' }], '7') === 7)

  const errs = validateValues(doc, { email: 'nope', salary: 1.5, startDate: '2019-12-31', notes: 'far too long for ten', employmentType: 'freelance' })
  check('required fields are reported by label', errs.firstName === 'First name is required')
  check('a pattern uses its own message', errs.email === 'Enter a valid email')
  check('whole numbers only', errs.salary === 'Salary must be a whole number')
  check('an early date', errs.startDate === 'Start date must be on or after 2020-01-01')
  check('too long', errs.notes === 'Notes must be at most 10 characters')
  check('a static dropdown value that is not an option', errs.employmentType === 'Employment type must be one of the options')
  check('a table dropdown is checked against its loaded rows', fieldError(node('departmentId'), 9, [{ id: 1, name: 'A' }]) === 'Department must be one of the options')
  check('...and a string id matches a numeric row', fieldError(node('departmentId'), '1', [{ id: 1, name: 'A' }]) === null)
  const good = { firstName: 'Ada', lastName: 'L', email: 'a@b', departmentId: 3, employmentType: 'part_time', startDate: '2026-09-14', salary: 100, remote: true, notes: 'ok' }
  check('a good record passes', Object.keys(validateValues(doc, good)).length === 0)

  // PARITY: the screen's rules, as a schema, are what the host's server can
  // enforce with @xeplr/schema-handler — and it must agree with the browser.
  const { applySchema } = require('@xeplr/schema-handler')
  const schema = formSchema(doc)
  check('the form schema covers every input, in reading order', schema.map((f) => f.name).join() === inputNodes(doc).map((n) => n.props.name).join())
  check('patternMessage is a UI detail, not sent to the schema', !schema.some((f) => f.validation && 'patternMessage' in f.validation))
  check('server accepts what the screen accepts', !throws(() => applySchema(schema, good)))
  const serverRejects = (values) => throws(() => applySchema(schema, values))
  check('server rejects a missing required field too', serverRejects({ ...good, firstName: undefined }))
  check('...a static option that is not listed', serverRejects({ ...good, employmentType: 'freelance' }))
  check('...a fraction where whole numbers are required', serverRejects({ ...good, salary: 1.5 }))
  check('...a pattern mismatch', serverRejects({ ...good, email: 'nope' }))
  check('...text over maxLength', serverRejects({ ...good, notes: 'far too long for ten' }))
}

console.log('\nstyles')
{
  let doc = addControl(createScreen({ name: 'S' }), 'text', { props: { label: 'Email' } }).document
  const id = doc.nodes[0].id
  doc = setNodeProperty(doc, id, 'props.style.fontSize', 18)
  doc = setNodeProperty(doc, id, 'props.style.color', '#1d4ed8')
  doc = setNodeProperty(doc, id, 'props.style.fontFamily', 'Georgia, serif')
  doc = setNodeProperty(doc, id, 'props.style.labelFontWeight', 700)
  check('a text box takes font, size, colour and label weight', validateDocument(doc).ok && doc.nodes[0].props.style.fontSize === 18)
  doc = setNodeProperty(doc, id, 'props.style.fontSize', undefined)
  check('clearing a style returns it to the default', doc.nodes[0].props.style.fontSize === undefined)
  const bad = setNodeProperty(setNodeProperty(setNodeProperty(doc, id, 'props.style.fontSize', 400), id, 'props.style.color', 'blue'), id, 'props.style.shadow', '1px')
  const errs = validateDocument(bad).errors
  check('a size out of range is refused with the range', errs.some((e) => e.path === 'nodes[0].props.style.fontSize' && /8 to 96/.test(e.message)))
  check('a colour must be #hex', errs.some((e) => e.path === 'nodes[0].props.style.color' && /#rgb/.test(e.message)))
  check('an unknown style lists the allowed ones', errs.some((e) => e.path === 'nodes[0].props.style.shadow' && /allowed: fontFamily/.test(e.message)))
  const lbl = addControl(createScreen({}), 'label').document
  check('a label has no label-styles (it IS the text)', !validateDocument(setNodeProperty(lbl, lbl.nodes[0].id, 'props.style.labelColor', '#000')).ok)
  check('a font with CSS injection is refused', !validateDocument(setNodeProperty(doc, id, 'props.style.fontFamily', 'x; } body { display:none')).ok)
  let screen = setScreenProperty(createScreen({ name: 'S' }), 'style.fontSize', 16)
  screen = setScreenProperty(screen, 'source', 'employees')
  check('the screen has its own font size and target table', validateDocument(screen).ok && screen.style.fontSize === 16 && screen.source === 'employees')
  check('a screen width out of range is refused', !validateDocument(setScreenProperty(screen, 'width', 100)).ok)
  check('an unknown screen property is refused', validateDocument({ ...screen, theme: 'dark' }).errors.some((e) => e.path === 'theme'))
  check('setScreenProperty will not touch nodes', throws(() => setScreenProperty(screen, 'nodes', [])))
}

console.log('\nlists')
{
  const doc = screenFromSpec(EMPLOYEE)
  const list = doc.nodes.find((n) => n.type === 'list')
  check('with no columns chosen, a list shows every field in reading order', listColumns(doc, list).map((c) => c.field).join() === inputNodes(doc).map((n) => n.props.name).join())
  const picked = { ...list, props: { ...list.props, columns: [{ field: 'lastName', label: 'Surname' }] } }
  check('chosen columns win', listColumns(doc, picked)[0].label === 'Surname')
  const noSource = { ...doc, source: undefined }
  delete noSource.source
  check('a list with no table anywhere is refused', validateDocument(noSource).errors.some((e) => /props\.source/.test(e.path)))
  check('an unknown action is refused', validateDocument({ ...doc, nodes: doc.nodes.map((n) => (n.type === 'list' ? { ...n, props: { ...n.props, actions: ['edit', 'archive'] } } : n)) }).errors.some((e) => /actions\[1\]/.test(e.path)))
  const node = (name) => doc.nodes.find((n) => n.props.name === name)
  check('a static dropdown shows its name in a list', displayValue(node('employmentType'), 'part_time') === 'Part time')
  check('a table dropdown shows the loaded name', displayValue(node('departmentId'), 2, [{ id: 2, name: 'Finance' }]) === 'Finance')
  check('a checkbox reads Yes / No', displayValue(node('remote'), true) === 'Yes' && displayValue(node('remote'), false) === 'No')
  const rec = recordValues(doc, { id: 9, firstName: 'Ada', startDate: '2026-10-01T00:00:00Z', unknownColumn: 1 })
  check('Edit takes the screen\'s fields from a record', rec.firstName === 'Ada' && rec.startDate === '2026-10-01')
  check('...leaves out columns the screen does not have', !('unknownColumn' in rec) && !('id' in rec))
  check('...and an absent checkbox is unticked', rec.remote === false)
}

console.log('\nan entity is two screens')
{
  const { list, edit } = screensFromSpec({ entity: 'employee', fields: EMPLOYEE.fields, listColumns: ['firstName', { field: 'departmentId', label: 'Dept' }] })
  check('both are valid', validateDocument(list).ok && validateDocument(edit).ok)
  check('ids follow the entity', list.id === 'employee_list' && edit.id === 'employee_edit')
  check('both use one table, named from the plural', list.source === 'employees' && edit.source === 'employees')
  const l = list.nodes[0]
  check('the list screen is one list that opens the edit screen', list.nodes.length === 1 && l.type === 'list' && l.props.editScreen === 'employee_edit')
  check('list columns by name or { field, label }', l.props.columns.map((c) => c.label).join() === 'First name,Dept')
  check('the edit screen has the fields and no list', inputNodes(edit).length === EMPLOYEE.fields.length && !edit.nodes.some((n) => n.type === 'list'))
  check('a list column must be a field of the edit form', throws(() => screensFromSpec({ entity: 'x', fields: [{ label: 'A' }], listColumns: ['nope'] }), /not a field of the edit form/))
  check('no entity is refused', throws(() => screensFromSpec({ fields: [] }), /entity is required/))
  check('without listColumns, the first five fields', screensFromSpec({ entity: 'x', fields: EMPLOYEE.fields }).list.nodes[0].props.columns.length === 5)
  const names = entityNames('leave request')
  check('names agree everywhere', names.table === 'leave_requests' && names.file === 'leave-request' && names.listComponent === 'LeaveRequestList' && names.editComponent === 'EditLeaveRequest')
  check('plurals: company → companies, box → boxes', entityNames('company').table === 'companies' && entityNames('box').table === 'boxes')
  check('an explicit plural wins', entityNames('person', 'people').table === 'people')
  const { files } = scaffoldEntity({ entity: 'employee', fields: [{ label: 'Name' }] })
  check('scaffold writes both screens, both pages and a hooks stub', Object.keys(files).sort().join() === 'EditEmployee.jsx,EmployeeList.jsx,employee-edit.screen.json,employee-list.screen.json,employee.hooks.js')
  check('the hooks stub has save, get and delete, registered by the edit screen id', /save: \{/.test(files['employee.hooks.js']) && /get: \{/.test(files['employee.hooks.js']) && /delete: \{/.test(files['employee.hooks.js']) && /employee_edit: require\('\.\/employee\.hooks'\)/.test(files['employee.hooks.js']))
  check('the edit page holds the hooks: every method calling super', /export class EmployeeHooks extends FactoryHooks/.test(files['EditEmployee.jsx']) && ['get(ctx)', 'save(values, ctx)', 'delete(record, ctx)', 'actions(ctx)'].every((m) => files['EditEmployee.jsx'].includes('  ' + m + ' {')) && (files['EditEmployee.jsx'].match(/return super\./g) || []).length === 4)
  check('the list page uses the edit page\'s hooks, so its popup does too', /import \{ employeeHooks \} from '\.\/EditEmployee\.jsx'/.test(files['EmployeeList.jsx']) && /hooks=\{employeeHooks\}/.test(files['EmployeeList.jsx']))
  check('the edit page takes a record for Edit', /export default function EditEmployee\(\{ api, record \}\)/.test(files['EditEmployee.jsx']))
  const bad = { ...list, nodes: [{ ...l, props: { ...l.props, editScreen: 'no spaces allowed' } }] }
  check('an editScreen must be a screen id', validateDocument(bad).errors.some((e) => /editScreen/.test(e.path)))
}

console.log('\na form is a real table')
{
  const { edit } = screensFromSpec({ entity: 'employee', fields: EMPLOYEE.fields })
  const { table, columns } = tableForScreen(edit)
  const col = Object.fromEntries(columns.map((c) => [c.name, c]))
  check('the table is the screen source', table === 'employees')
  check('one column per field, named as the field', columns.map((c) => c.name).join() === inputNodes(edit).map((n) => n.props.name).join())
  check('a table dropdown is a foreign key column named …Id', col.departmentId && col.departmentId.references === 'departments' && col.departmentId.length === 25)
  check('types: date, numeric, integer, boolean, text', col.startDate.type === 'date' && col.salary.type === 'integer' && col.remote.type === 'boolean' && col.notes.type === 'text')
  check('a text maxLength becomes the varchar length', col.notes.type === 'text' && columnForField({ type: 'text', props: { name: 'a', validation: { maxLength: 80 } } }).length === 80)
  const create = migrationFor(null, edit)
  check('first migration creates the table with standard columns', /CREATE TABLE IF NOT EXISTS "employees"/.test(create.sql) && /"isActive"/.test(create.sql) && /"mtId1"/.test(create.sql) && /"recordCreatedBy"/.test(create.sql))
  check('...a foreign key and its index', /"departmentId"\s+varchar\(25\) REFERENCES "departments"\("id"\)/.test(create.sql) && /employees_departmentId_index/.test(create.sql))
  check('no JSON columns', !/json/i.test(create.sql))

  let v2 = addControl(edit, 'text', { props: { label: 'Employee code', validation: { maxLength: 12 } } }).document
  v2 = setNodeProperty(v2, 'firstName', 'props.validation.maxLength', 300)
  v2 = removeNodes(v2, ['notes'])
  const upd = migrationFor(edit, v2)
  check('a new field is ADD COLUMN', /ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "employeeCode" varchar\(12\)/.test(upd.sql))
  check('a wider text is ALTER TYPE', /ALTER COLUMN "firstName" TYPE varchar\(300\)/.test(upd.sql))
  check('a removed field keeps its column, and says so', !/^\s*(ALTER TABLE[^;]*DROP|DROP )/im.test(upd.sql) && /Kept[^\n]*"notes"/.test(upd.sql))
  check('no change, no migration', migrationFor(edit, edit).empty)
  check('narrowing is refused', throws(() => migrationFor(setNodeProperty(edit, 'firstName', 'props.validation.maxLength', 80), setNodeProperty(edit, 'firstName', 'props.validation.maxLength', 10)), /would cut longer values/))
  check('integer → numeric is allowed (wider)', /TYPE numeric/.test(migrationFor(edit, setNodeProperty(edit, 'salary', 'props.validation.integer', undefined)).sql))
  check('numeric → integer is refused', throws(() => migrationFor(setNodeProperty(edit, 'salary', 'props.validation.integer', undefined), edit), /different kind of value/))
  check('pointing a dropdown at another table is refused', throws(() => migrationFor(edit, setNodeProperty(edit, 'departmentId', 'props.data', { source: 'table', table: 'teams' })), /points at "departments"/))
  check('a screen with no fields has no table', throws(() => tableForScreen(screensFromSpec({ entity: 'x', fields: [{ label: 'A' }] }).list), /no fields/))
  check('migration files continue the app numbering', nextMigrationName(['0066_dashboard_groups.sql', 'readme.txt'], 'employees', true) === '0067_factory_employees_create.sql')
  check('a field may not take a standard column name', validateDocument(setNodeProperty(edit, 'firstName', 'props.name', 'isActive')).errors.some((e) => /standard column/.test(e.message)))

  const locked = setNodeProperty(edit, 'firstName', 'props.name', 'givenName', undefined, { lockedNames: ['firstName'] })
  check('a locked field name cannot be renamed', locked === edit)
  const relabelled = setNodeProperty(edit, 'firstName', 'props.label', 'Given name', undefined, { lockedNames: ['firstName'] })
  check('...nor follow its label', relabelled.nodes.find((n) => n.id === 'firstName').props.name === 'firstName')
}

console.log('\npublish changes the table directly')
{
  const { edit } = screensFromSpec({ entity: 'employee', fields: EMPLOYEE.fields })
  const created = planTableChange(null, edit)
  check('no table: CREATE TABLE and indexes', created.create && /CREATE TABLE IF NOT EXISTS "employees"/.test(created.statements[0]) && created.statements.length === 3)

  // The table as the database describes it after that create.
  const db = (doc) => ({ table: 'employees', columns: [
    { name: 'id', udtName: 'varchar', maxLength: 25 },
    ...tableForScreen(doc).columns.map((c) => ({ name: c.name, udtName: { varchar: 'varchar', text: 'text', integer: 'int4', numeric: 'numeric', date: 'date', boolean: 'bool' }[c.type], maxLength: c.length || null, references: c.references })),
    { name: 'isActive', udtName: 'bool' }, { name: 'mtId1', udtName: 'varchar', maxLength: 25 }
  ] })
  check('the database description reads back as the same columns', planTableChange(db(edit), edit).statements.length === 0)
  check('columnFromDatabase maps pg types', columnFromDatabase({ name: 'a', udtName: 'int4' }).type === 'integer' && columnFromDatabase({ name: 'b', udtName: 'varchar', maxLength: 12 }).length === 12)

  let v2 = addControl(edit, 'text', { props: { label: 'Employee code', validation: { maxLength: 12 } } }).document
  v2 = removeNodes(v2, ['salary'])
  const current = db(edit)
  current.columns.push({ name: 'legacyCode', udtName: 'varchar', maxLength: 10 })   // made by hand

  const asking = planTableChange(current, v2, { managed: ['salary', 'firstName'] })
  check('a removed field that was a screen field is offered for dropping', asking.drop.map((d) => d.name).join() === 'salary')
  check('...and nothing runs until it is confirmed', asking.unconfirmed.join() === 'salary' && asking.statements.length === 0)
  check('a column no screen made is kept, with the reason', asking.keep.some((k) => k.name === 'legacyCode' && /not created by a screen/.test(k.reason)))

  const confirmed = planTableChange(current, v2, { managed: ['salary'], confirmDrop: ['salary'] })
  check('confirmed: add, then drop', confirmed.statements.some((x) => /ADD COLUMN IF NOT EXISTS "employeeCode" varchar\(12\)/.test(x)) && confirmed.statements.some((x) => /DROP COLUMN IF EXISTS "salary"/.test(x)))
  check('confirming another name confirms nothing', planTableChange(current, v2, { managed: ['salary'], confirmDrop: ['notes'] }).statements.length === 0)

  const shared = planTableChange(current, v2, { managed: ['salary'], inUse: ['salary'] })
  check('a column another screen still uses is kept, not asked about', shared.drop.length === 0 && shared.keep.some((k) => k.name === 'salary') && shared.statements.length > 0)

  const narrowed = planTableChange(db(setNodeProperty(edit, 'firstName', 'props.validation.maxLength', 300)), edit)
  check('narrowing is refused and nothing runs', narrowed.refused.length === 1 && narrowed.statements.length === 0)
  const hand = { table: 'employees', columns: [...db(edit).columns.filter((c) => c.name !== 'startDate'), { name: 'startDate', udtName: 'timestamp' }] }
  check('a column of a type no field makes is never changed', planTableChange(hand, edit).refused.some((r) => r.column === 'startDate'))
}

console.log('\nautosave')
{
  const doc = screenFromSpec(EMPLOYEE)
  const empty = saveState(doc, initialValues(doc), new Set())
  check('an untouched empty form does not save, and shows no errors', !empty.canSave && empty.status === 'incomplete' && Object.keys(empty.shown).length === 0)
  const typed = saveState(doc, { firstName: 'Ada', salary: 1.5 }, new Set(['firstName', 'salary']))
  check('a touched field that is wrong is shown and blocks saving', !typed.canSave && typed.status === 'invalid' && typed.shown.salary && !typed.shown.lastName)
  const good = { firstName: 'Ada', lastName: 'L', email: 'a@b', departmentId: 3, employmentType: 'part_time', startDate: '2026-09-14', remote: false }
  const ready = saveState(doc, good, new Set(['firstName']))
  check('a complete, valid form is ready to save', ready.canSave && ready.status === 'ready')
}

console.log('\noptions from the host')
check('rows are reduced to { id, name }', JSON.stringify(normaliseOptions([{ id: 1, name: 'A', extra: true }])) === '[{"id":1,"name":"A"}]')
check('a row with no id is dropped', normaliseOptions([{ name: 'x' }, { id: 0, name: 'zero' }]).length === 1)
check('a missing name falls back to the id', normaliseOptions([{ id: 5 }])[0].name === '5')
check('garbage is an empty list', normaliseOptions(null).length === 0)

check('every control declares what the panel and checker need',
  Object.values(CONTROLS).every((c) => c.type && c.label && c.defaultSize && Array.isArray(c.props) && Array.isArray(c.properties) && Array.isArray(c.validation)))

function noOverlaps(nodes) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      if (a.x < b.x + b.w - 1e-6 && a.x + a.w > b.x + 1e-6 && a.y < b.y + b.h - 1e-6 && a.y + a.h > b.y + 1e-6) return false
    }
  }
  return true
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
