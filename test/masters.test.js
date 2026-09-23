// MAKING A MASTER — the one form shape every application repeats.
//
// Departments, statuses, countries, categories. Designing them one at a time
// is drawing the same form over and over, so a master is MADE rather than
// designed: a name, and what it belongs to.
import { masterSpec, createMaster, possibleParents, singularOf } from '../src/masters.js'
import { entityNames } from '../src/generate.js'
import { validateDocument } from '../src/validateDocument.js'

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }

console.log('\nthe three things a master is')
{
  const spec = masterSpec({ name: 'Departments' })
  check('it is named, and that is what pickers show', spec.fields[0].label === 'Name')
  check('...and a name is required — a blank row is a blank line in every dropdown',
    spec.fields[0].required === true)
  check('it has an order of its own', spec.fields[1].label === 'Sort order')

  // Low / Medium / High is not alphabetical, but most lists are fine — a
  // number somebody must invent for every row is a tax on adding one.
  check('...which nobody is forced to fill in', !spec.fields[1].required)
  check('and nothing else, unless it belongs to something', spec.fields.length === 2)
}

console.log('\na master that belongs to another')
{
  const spec = masterSpec({ name: 'States', parent: { table: 'countries', label: 'Country' } })
  const link = spec.fields[2]
  check('the parent is a third field', spec.fields.length === 3)
  check('...chosen from the parent master itself', link.type === 'dropdown' && link.table === 'countries')
  check('...labelled as the thing it is', link.label === 'Country')
  check('...and required — a state in no country is a row nothing can use', link.required === true)

  // A master cannot belong to itself: the dropdown would offer the record
  // being created, and the row could never be filled in.
  const masters = [{ key: 'country' }, { key: 'state' }]
  check('itself is not on the list of possible parents',
    possibleParents(masters, 'state').map((m) => m.key).join() === 'country')
  check('with nothing to choose from, the list is empty', possibleParents(null, 'x').length === 0)
}

console.log('\nnamed in the plural, stored in the singular')
{
  // entityNames does not singularise, so "Departments" straight through makes
  // a `departmentses` table — which is noticed only once it exists, and then
  // cannot be renamed.
  const table = (name) => entityNames(masterSpec({ name }).entity).table
  check('Departments → departments', table('Departments') === 'departments')
  check('Categories → categories', table('Categories') === 'categories')
  check('Countries → countries', table('Countries') === 'countries')
  check('Status stays Status → statuses', table('Status') === 'statuses')
  check('a two-word name only loses the last plural', singularOf('Cost centres') === 'Cost centre')
  check('nothing is empty, not a crash', singularOf('') === '')
}

console.log('\nwhat making one actually does')
{
  const saved = []
  const published = []
  const api = {
    saveDraft: async (doc) => { saved.push(doc.id); return doc },
    publish: async (doc) => { published.push(doc.id); return { version: 1 } }
  }

  const made = await createMaster(api, { name: 'Departments' })

  check('both halves are written', saved.join() === 'department_edit,department_list')
  // PUBLISHED, because a master that is a draft has no table: nothing can
  // point at it and nobody can add a row, which is all a master is for.
  check('...and both are published', published.join() === 'department_edit,department_list')
  check('it comes back knowing it is a master', made.master === true)
  check('...and what it is shown by', made.labelField === 'name')
  check('...pointing at its own table', made.source === 'departments')
}

console.log('\nwhat is made is an ordinary screen')
{
  const spec = masterSpec({ name: 'Priorities' })
  check('a master needs a name to be made at all', (() => {
    try { masterSpec({ name: '  ' }); return false } catch (e) { return /needs a name/.test(e.message) }
  })())
  check('the entity is one word, lower case', /^[a-z][a-z0-9_]*$/.test(spec.entity))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
