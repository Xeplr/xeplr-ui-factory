// Where you are lives in the URL: the key format, and the three controllers
// reading their places back from a real react-router MemoryRouter (rendered
// with react-dom/server) and writing them in memory, as a click would.
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { factoryUrlKeys, encodeSteps, decodeSteps, replacesHistory, selectionPlace } from '../src/urlState.js'
import { createScreen, addControl } from '../src/document.js'
import { createFlow, addStep } from '../src/flow.js'
import { useFactoryBuilder } from '../src/useFactoryBuilder.js'
import { useFactoryScreen } from '../src/useFactoryScreen.js'
import { useFlowBuilder } from '../src/useFlowBuilder.js'

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

console.log('\nthe keys are the host\'s')
check('derived from urlKey', same(factoryUrlKeys('form'), { steps: 'formSteps', selected: 'formSelected' }))
check('none without one: in memory', factoryUrlKeys(undefined) === null && factoryUrlKeys('') === null)

console.log('\nsteps in one value')
check('step 0 is left out, so a fresh screen has a clean URL', encodeSteps({ s1: 2, s2: 0 }) === 's1:2')
check('nothing open past the first step: no value', encodeSteps({ s1: 0 }) === null && encodeSteps(undefined) === null)
check('ids with : and , round-trip', same(decodeSteps(encodeSteps({ 'a:b': 1, 'c,d': 3 })), { 'a:b': 1, 'c,d': 3 }))
check('unreadable pairs are dropped', same(decodeSteps('s1:2,:4,s2:x,s3:-1,s4,%E0%A4%A:1,s5:01'), { s1: 2, s5: 1 }))
check('no value: nothing open', same(decodeSteps(null), {}) && same(decodeSteps(''), {}))

console.log('\nhistory and selection')
check('opening or closing adds an entry', !replacesHistory(null, 'a') && !replacesHistory('a', null) && !replacesHistory('', 'a'))
check('moving between two replaces it', replacesHistory('a', 'b'))
check('one selected is a place', selectionPlace(new Set(['n1'])) === 'n1')
check('none or several is not', selectionPlace(new Set()) === null && selectionPlace(['a', 'b']) === null && selectionPlace(null) === null)

// A screen with a three-step stepper and a field on each step.
let doc = createScreen({ name: 'Wizard' })
let r = addControl(doc, 'stepper', { props: { steps: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }] } })
doc = r.document
const stepper = r.node.id
const fields = []
for (let i = 0; i < 3; i++) {
  r = addControl(doc, 'text', { step: { of: stepper, index: i }, props: { name: `f${i}`, label: `F${i}` } })
  doc = r.document
  fields.push(r.node.id)
}

let flow = createFlow({ name: 'Onboard' })
flow = addStep(flow, 'details').flow
flow = addStep(flow, 'review').flow
const [first, second] = flow.steps.map((s) => s.stepKey)

/** One render at `url`; what the hook returned. */
function at(url, useHook, options) {
  let seen = null
  function Probe() { seen = useHook(options); return null }
  renderToString(createElement(MemoryRouter, { initialEntries: [url] }, createElement(Probe)))
  return seen
}

/** A script of clicks, one per render, in memory (no urlKey): what each render saw after one. */
function play(useHook, options, steps) {
  const log = []
  let i = 0
  function Probe() {
    const c = useHook(options)
    if (i > 0) log.push(c)
    if (i < steps.length) steps[i++](c)
    return null
  }
  renderToString(createElement(MemoryRouter, null, createElement(Probe)))
  return log
}

console.log('\nuseFactoryBuilder')
{
  const c = at(`/?bSelected=${fields[2]}&bSteps=${stepper}:2`, useFactoryBuilder, { document: doc, urlKey: 'b' })
  check('a link opens the control it names', c.selectedNode && c.selectedNode.id === fields[2])
  check('...on the step it names', c.steps.active(stepper) === 2 && c.visibleNodes.some((n) => n.id === fields[2]) && !c.visibleNodes.some((n) => n.id === fields[0]))
  const gone = at('/?bSelected=nope', useFactoryBuilder, { document: doc, urlKey: 'b' })
  check('a control that is not in the screen selects nothing', gone.selected.size === 0 && gone.selectedNode === null)
  const other = at(`/?bSelected=${fields[2]}`, useFactoryBuilder, { document: doc })
  check('without urlKey the URL is not read', other.selected.size === 0)

  const log = play(useFactoryBuilder, { document: doc }, [
    (b) => b.setSelected(new Set([fields[0]])),
    (b) => b.setSelected(new Set([fields[0], fields[1]])),
    (b) => b.setSelected((s) => new Set([...s].slice(1))),
    (b) => b.steps.go(stepper, 1),
    (b) => b.removeSelected(),
    () => {}
  ])
  check('selecting one opens it', log[0].selectedNode && log[0].selectedNode.id === fields[0])
  check('several stay selected, with no single control open', log[1].selected.size === 2 && log[1].selectedNode === null)
  check('an updater gets the current selection', log[2].selectedNode && log[2].selectedNode.id === fields[1])
  check('going to a step shows that step', log[3].steps.active(stepper) === 1)
  check('removing clears the selection', log[4].selected.size === 0 && !log[4].document.nodes.some((n) => n.id === fields[1]))
}

console.log('\nuseFactoryScreen')
{
  const c = at(`/?sSteps=${stepper}:1`, useFactoryScreen, { document: doc, urlKey: 's' })
  check('a link opens the step it names', c.steps.active(stepper) === 1)
  const none = at(`/?sSteps=${stepper}:1`, useFactoryScreen, { document: doc })
  check('without urlKey the URL is not read', none.steps.active(stepper) === 0)
}

console.log('\nuseFlowBuilder')
{
  const c = at(`/?fSelected=${second}`, useFlowBuilder, { flow, urlKey: 'f' })
  check('a link opens the step it names', c.selectedStep && c.selectedStep.stepKey === second)
  const log = play(useFlowBuilder, { flow }, [
    (f) => f.setSelected(first),
    (f) => f.setSelected(second),
    (f) => f.removeStep(second),
    () => {}
  ])
  check('selecting a step opens it', log[0].selected === first)
  check('switching to another', log[1].selected === second)
  check('removing the selected step closes it', log[2].selected === null && !log[2].flow.steps.some((s) => s.stepKey === second))
  const again = play(useFlowBuilder, { flow }, [(f) => f.setSelected(first), (f) => f.setSelected(first), () => {}])
  check('selecting what is already selected changes nothing — no render, no history entry', again.length === 1)
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
