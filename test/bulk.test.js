// Add several (a list's bulkAdd): which fields make the grid, what a pasted
// cell becomes, blank rows, each row's messages — and what a screen may say.
import { validateDocument, createScreen, addControl, setNodeProperty } from '../src/model.js'
import { bulkFields, blankRow, isBlank, cellValue, dayFrom, pastedRows, isGridPaste, pasteInto, rowErrors, resolveChoices } from '../src/bulk.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }

// The holiday form: a name, a date, a kind (Fixed / Optional), and a file the grid leaves out.
const edit = {
  kind: 'xeplr-screen', version: 1, id: 'holiday_edit', name: 'Holiday', source: 'holidays', units: 'fraction', aspect: 1, width: 800,
  nodes: [
    { id: 'name', type: 'text', x: 0.04, y: 0.1, w: 0.4, h: 0.08, z: 1, props: { name: 'name', label: 'Name', required: true, validation: { maxLength: 20 } } },
    { id: 'holidayDate', type: 'date', x: 0.5, y: 0.1, w: 0.4, h: 0.08, z: 2, props: { name: 'holidayDate', label: 'Date', required: true } },
    { id: 'holidayKind', type: 'dropdown', x: 0.04, y: 0.2, w: 0.4, h: 0.08, z: 3, props: { name: 'holidayKind', label: 'Kind', required: true, default: 'fixed',
      data: { source: 'static', options: [{ id: 'fixed', label: 'Fixed' }, { id: 'optional', label: 'Optional' }] } } },
    { id: 'paid', type: 'checkbox', x: 0.5, y: 0.2, w: 0.4, h: 0.05, z: 4, props: { name: 'paid', label: 'Paid' } },
    { id: 'notice', type: 'file', x: 0.04, y: 0.3, w: 0.4, h: 0.08, z: 5, props: { name: 'notice', label: 'Notice' } }
  ]
}
const { columns, skipped } = bulkFields(edit)
check('the columns: the form\'s one-value fields, in reading order; a file is left for Edit',
  columns.map((n) => n.props.name).join() === 'name,holidayDate,holidayKind,paid' && skipped.map((n) => n.props.name).join() === 'notice')
check('a sub-table\'s link is not a column', bulkFields(edit, { holidayKind: 'fixed' }).columns.every((n) => n.props.name !== 'holidayKind'))

const blank = blankRow(edit, columns)
check('a blank row has each default', blank.holidayKind === 'fixed' && blank.paid === false && blank.name === undefined)
check('a row still at its defaults is blank; one with a name is not', isBlank({ ...blank }, blank) && !isBlank({ ...blank, name: 'Holi' }, blank))

check('days: ISO, day first (India), and with a month name', dayFrom('2026-08-15') === '2026-08-15' && dayFrom('15/08/2026') === '2026-08-15' &&
  dayFrom('15-8-26') === '2026-08-15' && dayFrom('15 Aug 2026') === '2026-08-15' && dayFrom('Aug 15, 2026') === '2026-08-15' && dayFrom('26 January', 2027) === '2027-01-26')
check('a day that is not one is left as typed (validation then says so)', dayFrom('31/02/2026') === '31/02/2026' && dayFrom('soon') === 'soon')

const kinds = [{ id: 'fixed', name: 'Fixed' }, { id: 'optional', name: 'Optional' }]
check('a dropdown cell: by the option\'s name, any case, or its id', cellValue(columns[2], 'optional', kinds) === 'optional' && cellValue(columns[2], 'FIXED', kinds) === 'fixed' && cellValue(columns[2], 'Other', kinds) === 'Other')
check('a tick: yes / y / 1 / ✓', cellValue(columns[3], 'Yes') === true && cellValue(columns[3], '1') === true && cellValue(columns[3], '') === false && cellValue(columns[3], 'no') === false)
check('a number without the commas and ₹', cellValue({ type: 'number', props: {} }, '₹ 1,250') === 1250)
check('a date and time: day first, with am/pm', cellValue({ type: 'datetime', props: {} }, '15/08/2026 9:30 pm') === '2026-08-15T21:30')

const sheet = 'Independence Day\t15/08/2026\tFixed\nDiwali\t08 Nov 2026\tOptional\nHoli\t4 March 2026\toptional\n\n'
check('a paste of several cells is a grid paste; one word is not', isGridPaste(sheet) && !isGridPaste('Holi'))
check('pasted rows: tabs and lines, trailing blank lines dropped', pastedRows(sheet).length === 3 && pastedRows(sheet)[1][2] === 'Optional')
const optionsFor = (n) => (n.props.name === 'holidayKind' ? kinds : undefined)
let rows = [{ ...blank }, { ...blank }]
rows = pasteInto(rows, 0, 0, pastedRows(sheet), columns, optionsFor, blank)
check('pasted into the first cell: three rows, each value as the form keeps it',
  rows.length === 3 && rows[0].holidayDate === '2026-08-15' && rows[1].holidayKind === 'optional' && rows[2].holidayDate === '2026-03-04', JSON.stringify(rows))
const shifted = pasteInto([{ ...blank }], 0, 1, [['15/08/2026', 'Fixed', 'yes', 'beyond']], columns, optionsFor, blank)
check('pasted from the second column: cells land from there; past the last column ignored', shifted[0].holidayDate === '2026-08-15' && shifted[0].paid === true && shifted[0].name === undefined)

rows.push({ ...blank })
rows[1] = { ...rows[1], name: 'A name that is far too long' }
rows[2] = { ...rows[2], holidayDate: '31/02/2026' }
const errs = rowErrors(rows, columns, optionsFor, blank)
check('each row\'s messages before sending; a blank row is not checked',
  !errs[0] && /at most 20/.test(errs[1].name) && /must be a date/.test(errs[2].holidayDate) && !errs[3], JSON.stringify(errs))

const early = pasteInto([{ ...blank }], 0, 0, [['Diwali', '08/11/2026', 'Optional']], columns, () => undefined, blank)[0]
const later = resolveChoices(early, columns, optionsFor)
check('pasted before the options arrived: matched by name once they do; a settled row is the same row',
  early.holidayKind === 'Optional' && later.holidayKind === 'optional' && resolveChoices(later, columns, optionsFor) === later)

// What a screen may say.
function list(props) {
  const doc = createScreen({ id: 'holiday_list', name: 'Holidays', source: 'holidays' })
  const added = addControl(doc, 'list')
  let d = added.document
  Object.entries(props).forEach(([k, v]) => { d = setNodeProperty(d, added.node.id, 'props.' + k, v) })
  return d
}
const problems = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)
check('bulkAdd with an edit screen: valid', problems(list({ editScreen: 'holiday_edit', bulkAdd: true })).length === 0, problems(list({ editScreen: 'holiday_edit', bulkAdd: true })).join('; '))
check('bulkAdd without an edit screen, without New, or on worked-out rows: refused',
  problems(list({ bulkAdd: true })).some((e) => /bulkAdd: needs "Edit in"/.test(e)) &&
  problems(list({ editScreen: 'holiday_edit', bulkAdd: true, actions: ['edit'] })).some((e) => /needs New/.test(e)) &&
  problems(list({ editScreen: 'holiday_edit', bulkAdd: true, rowsFrom: 'x' })).some((e) => /not rows a function works out/.test(e)))
check('bulkAdd must be true or false', problems(list({ editScreen: 'holiday_edit', bulkAdd: 'yes' })).some((e) => /bulkAdd: must be true or false/.test(e)))

const failed = results.filter(([, ok]) => !ok)
console.log(failed.length ? `\n${failed.length} failed` : `\nall ${results.length} passed`)
if (failed.length) process.exit(1)
