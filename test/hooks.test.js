// FactoryHooks: every method is the default; a subclass changes what it needs
// and reaches the default with super.
import { FactoryHooks, hookMethod } from '../src/hooks.js'

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }

const calls = []
const ctx = (extra) => ({
  screen: 'task_edit',
  defaults: {
    get: () => { calls.push('get'); return [{ id: 1, title: 'a', status: 'done' }, { id: 2, title: 'b', status: 'todo' }] },
    save: (values) => { calls.push(['save', values]); return { id: 9, ...values } },
    delete: (record) => { calls.push(['delete', record.id]); return undefined }
  },
  ...extra
})

console.log('\nthe base class is the default')
{
  const base = new FactoryHooks()
  check('get runs the default', base.get(ctx()).length === 2)
  check('save runs the default with the values given', base.save({ title: 'x' }, ctx()).title === 'x')
  base.delete({ id: 4 }, ctx())
  check('delete runs the default', calls.some((c) => c[0] === 'delete' && c[1] === 4))
  check('no extra actions', Array.isArray(base.actions(ctx())) && base.actions(ctx()).length === 0)
}

console.log('\na subclass: before, after, override — through super')
{
  class TaskHooks extends FactoryHooks {
    async save(values, c) {
      const saved = await super.save({ ...values, title: values.title.trim() }, c)   // before
      return { ...saved, shown: true }                                              // after
    }
    async get(c) {
      const rows = await super.get(c)
      return rows.filter((r) => r.status !== 'done')
    }
    delete() { return 'kept' }                                                       // override
    actions() { return [{ label: 'Mark done', onClick: () => {} }] }
  }
  const hooks = new TaskHooks()
  calls.length = 0
  const saved = await hooks.save({ title: '  Launch  ' }, ctx())
  check('before: super received the changed values', calls[0][1].title === 'Launch')
  check('after: the result is what the subclass returned', saved.id === 9 && saved.shown === true)
  check('get filters what super loaded', (await hooks.get(ctx())).map((r) => r.id).join() === '2')
  calls.length = 0
  check('override: super never called', hooks.delete({ id: 1 }, ctx()) === 'kept' && !calls.length)
  check('actions are the subclass\'s', hooks.actions(ctx())[0].label === 'Mark done')
}

console.log('\na plain object with only some methods')
{
  const partial = { save: (values, c) => c.defaults.save({ ...values, from: 'object' }) }
  check('its own method is used', hookMethod(partial, 'save')({ title: 't' }, ctx()).from === 'object')
  check('a missing one falls back to the default', hookMethod(partial, 'get')(ctx()).length === 2)
  check('no hooks at all: the default', hookMethod(undefined, 'save')({ title: 'u' }, ctx()).title === 'u')
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
