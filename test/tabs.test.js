// A STEPPER SHOWN AS TABS (display "tabs") — the same steps, any one opened
// with a click, no Back / Next. What a screen may say, what the spec makes,
// and what each tab shows. (How it is drawn is checked in a real browser.)
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { validateDocument, screenFromSpec, nodesForSteps, isTabs, STEPPER_DISPLAYS } from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)

const spec = (display) => ({
  name: 'Order', source: 'orders', columns: 1,
  fields: [
    { label: 'Name' },
    { type: 'stepper', steps: ['Comments', 'Tasks'], ...(display ? { display } : {}) },
    { label: 'Note', type: 'textarea', step: 'Comments' },
    { label: 'Due', type: 'date', step: 'Tasks' }
  ]
})

console.log('what a screen may say')
const doc = screenFromSpec(spec('tabs'))
const tabs = doc.nodes.find((n) => n.type === 'stepper')
check('a spec\'s display reaches the stepper', tabs.props.display === 'tabs' && isTabs(tabs))
check('tabs: valid', errs(doc).length === 0, errs(doc).join('; '))
check('steps and tabs are the two ways', STEPPER_DISPLAYS.join() === 'steps,tabs')
const bad = { ...doc, nodes: doc.nodes.map((n) => (n.type === 'stepper' ? { ...n, props: { ...n.props, display: 'pills' } } : n)) }
check('another display: refused, saying what tabs mean', errs(bad).some((e) => e.includes('props.display') && e.includes('"tabs"')), errs(bad).join('; '))
check('a plain stepper is not tabs', !isTabs(screenFromSpec(spec()).nodes.find((n) => n.type === 'stepper')))

console.log('what shows')
const names = (active) => nodesForSteps(doc, active).filter((n) => n.props.name).map((n) => n.props.name)
check('the first tab: its fields and the ones on every tab', names({}).join() === 'name,note')
check('the second tab', names({ [tabs.id]: 1 }).join() === 'name,due')

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
