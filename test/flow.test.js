// A FLOW: screens one after another, and what decides which comes next.
//
// Plain script, like model.test.js: prints its checks, exits non-zero on failure.
import {
  createFlow, flowKey, addStep, moveStep, setStep, removeStep,
  addTransition, setTransition, removeTransition, firstStep, reachableSteps,
  validateFlow, describeWhen, FLOW_END, FLOW_OPERATORS
} from '../src/model.js'
import { createFlowsApi } from '../src/flows.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }

const SCREENS = ['employee_edit', 'contract_edit', 'payroll_edit']
const build = () => {
  let flow = createFlow({ name: 'Employee registration' })
  ;({ flow } = addStep(flow, 'employee_edit', { at: { x: 40, y: 40 }, label: 'Details' }))
  ;({ flow } = addStep(flow, 'contract_edit', { at: { x: 320, y: 40 }, label: 'Contract' }))
  ;({ flow } = addStep(flow, 'payroll_edit', { at: { x: 600, y: 40 }, label: 'Payroll' }))
  return flow
}

console.log('\na flow is made of screens')
{
  const flow = build()
  check('its key comes from its name', flow.key === 'employee_registration')
  check('a name with nothing usable still makes a key', /^flow/.test(flowKey('!!!')))
  check('three screens, three steps', flow.steps.map((s) => s.stepKey).join() === 'employee_edit,contract_edit,payroll_edit')
  check('a second screen follows the first by default',
    flow.steps[0].transitions.length === 1 && flow.steps[0].transitions[0].when === null && flow.steps[0].transitions[0].target === 'contract_edit')
  check('the journey starts where nothing points', firstStep(flow).stepKey === 'employee_edit')
  check('everything is reachable', reachableSteps(flow).size === 3)
  check('a step remembers where it was dropped', moveStep(flow, 'contract_edit', { x: 500, y: 90 }).steps[1].layout.x === 500)
  check('a step can be renamed without touching its key', setStep(flow, 'contract_edit', { label: 'The contract' }).steps[1].label === 'The contract')
  check('the same screen can be used twice, under keys of its own',
    addStep(flow, 'employee_edit').flow.steps.map((s) => s.stepKey).includes('employee_edit_2'))
}

console.log('\narrows decide where the journey goes')
{
  let flow = build()
  flow = addTransition(flow, 'employee_edit', 'payroll_edit', { field: 'type', op: '=', value: 'permanent' })
  check('a test goes in FRONT of "otherwise", or it would never be tried',
    flow.steps[0].transitions.map((t) => (t.when ? t.when.value : 'otherwise')).join() === 'permanent,otherwise')
  check('the flow still makes sense', validateFlow(flow, { screens: SCREENS }).ok)
  check('an arrow reads as a sentence', describeWhen(flow.steps[0].transitions[0].when, 'Type') === 'Type is permanent')
  check('...and "otherwise" says so', describeWhen(null) === 'otherwise')
  check('every operator the designer offers has words for it', FLOW_OPERATORS.every((o) => o.op && o.label))

  const changed = setTransition(flow, 'employee_edit', 0, { target: FLOW_END })
  check('an arrow can end the journey', changed.steps[0].transitions[0].target === FLOW_END && validateFlow(changed, { screens: SCREENS }).ok)
  const fewer = removeTransition(flow, 'employee_edit', 0)
  check('an arrow can be taken away', fewer.steps[0].transitions.length === 1)

  const gone = removeStep(flow, 'contract_edit')
  check('removing a step takes the arrows pointing at it with it',
    !gone.steps.some((s) => s.transitions.some((t) => t.target === 'contract_edit')))
}

console.log('\nwhat the designer refuses to publish')
{
  const flow = build()
  const bad = (f) => validateFlow(f, { screens: SCREENS })
  check('a step showing a screen nobody published', !bad({ ...flow, steps: flow.steps.map((s) => ({ ...s, screen: 'ghost_edit' })) }).ok)
  check('a step showing nothing at all', !bad({ ...flow, steps: flow.steps.map((s) => ({ ...s, screen: '' })) }).ok)
  check('an arrow to a step that is not there',
    !bad(setTransition(flow, 'employee_edit', 0, { target: 'nowhere' })).ok)
  check('two "otherwise" arrows on one step',
    !bad(addTransition({ ...flow, steps: flow.steps.map((s) => (s.stepKey === 'employee_edit' ? { ...s, transitions: [{ when: null, target: 'contract_edit' }, { when: null, target: 'payroll_edit' }] } : s)) }, 'employee_edit', 'payroll_edit', null)).ok)
  check('a test with no field named',
    !bad(addTransition(flow, 'contract_edit', 'payroll_edit', { field: '', op: '=', value: 'x' })).ok)
  check('a comparison nobody can make', !bad(addTransition(flow, 'contract_edit', 'payroll_edit', { field: 'a', op: 'rhymes_with', value: 'x' })).ok)
  check('a comparison with nothing to compare against',
    !bad(addTransition(flow, 'contract_edit', 'payroll_edit', { field: 'a', op: '=', value: '' })).ok)
  check('...except the ones that need no value',
    bad(addTransition(flow, 'contract_edit', 'payroll_edit', { field: 'a', op: 'not_empty' })).ok)
  check('a step nothing leads to', !bad({ ...flow, steps: [...flow.steps, { stepKey: 'orphan', screen: 'payroll_edit', label: 'Orphan', layout: { x: 0, y: 0 }, transitions: [] }] }).ok)
  check('a flow with no screens at all', !bad(createFlow({ name: 'Empty' })).ok)
  check('a key that is not a key', !bad({ ...flow, key: '2 bad' }).ok)
}

console.log('\nthe calls a flow makes')
{
  const seen = []
  const api = createFlowsApi({
    fetch: async (url, options) => {
      seen.push(`${options.method} ${url}` + (options.body ? ' ' + options.body : ''))
      return { code: 200, dataArray: [{ runId: 'r1', status: 'waiting', stepKey: 'contract', screen: 'contract_edit' }] }
    },
    base: '/api'
  })
  await api.startRun('employee_registration')
  check('starting a journey asks the flow for a run', seen[0] === 'POST /api/flows/employee_registration/runs')
  const next = await api.submitRun('r1', { type: 'contractor' }, 'emp_7')
  check('what was filled in goes to the run, with the row it saved',
    seen[1] === 'POST /api/flows/runs/r1/submit {"values":{"type":"contractor"},"recordId":"emp_7"}')
  check('...and the run answers with the next screen', next.screen === 'contract_edit' && next.stepKey === 'contract')
  await api.loadRun('r1')
  check('a run can be picked up where it was left', seen[2] === 'GET /api/flows/runs/r1')
  await api.myRuns('employee_registration')
  check('journeys still going can be listed', seen[3] === 'GET /api/flows/employee_registration/runs?mine=1')
  check('the runner gets exactly the calls it needs', Object.keys(api.runnerProps).join() === 'startRun,loadRun,submitRun,myRuns')
  check('a client with no fetch is refused', (() => { try { createFlowsApi({}); return false } catch (_) { return true } })())
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
