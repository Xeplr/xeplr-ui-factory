// A FLOW — screens, one after another, and what decides which comes next.
//
// A screen is a form; a flow is the journey across several of them. Each step
// shows one screen, and the arrows leaving it say where to go once it is
// filled in: the first arrow whose test passes, and failing all of them, the
// one with no test — "otherwise". A step with no arrows ends the journey.
//
// Pure data, like controls.js: no React, no requests. The designer edits this
// shape, the server is handed the same shape, and both sides check it with
// validateFlow().
//
//   { kind: 'xeplr-flow', version: 1, key: 'employee_registration',
//     name: 'Employee registration',
//     steps: [
//       { stepKey: 'details', screen: 'employee_edit', label: 'Details',
//         layout: { x: 40, y: 40 },
//         transitions: [
//           { when: { field: 'type', op: '=', value: 'contractor' }, target: 'contract' },
//           { when: null, target: 'payroll' }
//         ] },
//       …
//     ] }
//
// WHO RUNS IT: the workflow engine, not the browser. A run remembers where it
// got to, so a journey can be left and picked up later — by someone else, on
// another day. The browser only shows the screen it is told to and sends back
// what was typed.

export const FLOW_KIND = 'xeplr-flow'
export const FLOW_VERSION = 1

/** Where a journey can end, instead of another step — the engine's own word for a journey that finished. */
export const FLOW_END = 'end_success'

/**
 * The tests an arrow can carry, spelled the way the workflow engine accepts
 * them. One comparison per arrow; more than one is more steps.
 */
export const FLOW_OPERATORS = [
  { op: '=', label: 'is' },
  { op: '!=', label: 'is not' },
  { op: '>', label: 'is more than' },
  { op: '>=', label: 'is at least' },
  { op: '<', label: 'is less than' },
  { op: '<=', label: 'is at most' },
  { op: 'contains', label: 'contains' },
  { op: 'notContains', label: 'does not contain' },
  { op: 'startsWith', label: 'starts with' },
  { op: 'endsWith', label: 'ends with' },
  { op: 'isEmpty', label: 'is empty' },
  { op: 'isNotEmpty', label: 'is not empty' }
]

/** The comparisons that need no value typed beside them. */
export const VALUELESS_OPERATORS = ['isEmpty', 'isNotEmpty']

const KEY = /^[A-Za-z][A-Za-z0-9_]*$/
const MAX_KEY = 63

/** An empty flow, ready to have screens dropped on it. */
export function createFlow({ key, name } = {}) {
  const flowName = name || 'New flow'
  return {
    kind: FLOW_KIND,
    version: FLOW_VERSION,
    key: key || flowKey(flowName),
    name: flowName,
    steps: []
  }
}

/** "Employee registration" → "employee_registration". */
export function flowKey(name) {
  const out = String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, MAX_KEY)
  return KEY.test(out) ? out : 'flow_' + out.replace(/^[^A-Za-z]+/, '')
}

/** Adds a step showing `screen`, at `at` (canvas pixels). Returns { flow, step }. */
export function addStep(flow, screen, { at, label, stepKey } = {}) {
  const base = stepKey || uniqueStepKey(flow, flowKey(screen))
  const step = {
    stepKey: base,
    screen,
    label: label || screen,
    layout: { x: Math.round((at && at.x) || 40), y: Math.round((at && at.y) || 40) },
    transitions: []
  }
  const steps = [...flow.steps, step]
  // The step before it, if it ended the journey, now leads here: dropping a
  // second screen on an empty canvas means "and then this one".
  const previous = flow.steps[flow.steps.length - 1]
  if (previous && !previous.transitions.length) {
    return { flow: { ...flow, steps: steps.map((s) => (s.stepKey === previous.stepKey ? { ...s, transitions: [{ when: null, target: step.stepKey }] } : s)) }, step }
  }
  return { flow: { ...flow, steps }, step }
}

/** A step key nothing else in the flow is using. */
export function uniqueStepKey(flow, base) {
  const taken = new Set(flow.steps.map((s) => s.stepKey))
  const stem = KEY.test(base) ? base : 'step'
  if (!taken.has(stem)) return stem
  let n = 2
  while (taken.has(`${stem}_${n}`)) n++
  return `${stem}_${n}`
}

/** Moves a step on the canvas. */
export function moveStep(flow, stepKey, at) {
  return mapStep(flow, stepKey, (s) => ({ ...s, layout: { x: Math.round(at.x), y: Math.round(at.y) } }))
}

/** Changes one thing about a step — its screen, its label. */
export function setStep(flow, stepKey, patch) {
  return mapStep(flow, stepKey, (s) => ({ ...s, ...patch }))
}

/** Removes a step, and every arrow pointing at it. */
export function removeStep(flow, stepKey) {
  return {
    ...flow,
    steps: flow.steps
      .filter((s) => s.stepKey !== stepKey)
      .map((s) => ({ ...s, transitions: s.transitions.filter((t) => t.target !== stepKey) }))
  }
}

/**
 * Draws an arrow from one step to another (or to the end). A step's LAST
 * arrow is the one with no test — "otherwise" — so a new arrow goes in front
 * of it and the flow always has somewhere to go.
 */
export function addTransition(flow, fromKey, target, when = null) {
  return mapStep(flow, fromKey, (s) => {
    const rest = s.transitions.filter((t) => t.when !== null)
    const otherwise = s.transitions.find((t) => t.when === null)
    const next = when === null
      ? [...rest, { when: null, target }]
      : [...rest, { when, target }, ...(otherwise ? [otherwise] : [])]
    return { ...s, transitions: next }
  })
}

/** Changes one arrow of a step, by its position. */
export function setTransition(flow, fromKey, index, patch) {
  return mapStep(flow, fromKey, (s) => ({
    ...s,
    transitions: s.transitions.map((t, i) => (i === index ? { ...t, ...patch } : t))
  }))
}

/** Removes one arrow of a step, by its position. */
export function removeTransition(flow, fromKey, index) {
  return mapStep(flow, fromKey, (s) => ({ ...s, transitions: s.transitions.filter((_, i) => i !== index) }))
}

/** The step a journey starts at: the first one that nothing else points to, else the first. */
export function firstStep(flow) {
  if (!flow.steps.length) return null
  const pointedAt = new Set(flow.steps.flatMap((s) => s.transitions.map((t) => t.target)))
  return flow.steps.find((s) => !pointedAt.has(s.stepKey)) || flow.steps[0]
}

/** Every step that can be reached from the first one. */
export function reachableSteps(flow) {
  const start = firstStep(flow)
  if (!start) return new Set()
  const byKey = new Map(flow.steps.map((s) => [s.stepKey, s]))
  const seen = new Set()
  const walk = (key) => {
    if (!key || key === FLOW_END || seen.has(key)) return
    const step = byKey.get(key)
    if (!step) return
    seen.add(key)
    step.transitions.forEach((t) => walk(t.target))
  }
  walk(start.stepKey)
  return seen
}

/**
 * What is wrong with this flow, in the words of the person drawing it.
 * @param options.screens  the screen keys that exist, so a step cannot point at one that does not
 * @returns {{ ok, errors: [{ path, message }] }}
 */
export function validateFlow(flow, options = {}) {
  const errors = []
  const err = (path, message) => errors.push({ path, message })

  if (!flow || typeof flow !== 'object' || Array.isArray(flow)) {
    err('', 'A flow must be an object')
    return { ok: false, errors }
  }
  if (flow.kind !== FLOW_KIND) err('kind', `must be "${FLOW_KIND}"`)
  if (flow.version !== FLOW_VERSION) err('version', `must be ${FLOW_VERSION}`)
  if (!KEY.test(String(flow.key || ''))) err('key', 'must start with a letter and contain only letters, digits and _')
  else if (String(flow.key).length > MAX_KEY) err('key', `is longer than ${MAX_KEY} characters`)
  if (!String(flow.name || '').trim()) err('name', 'is required — what this journey is called')
  if (!Array.isArray(flow.steps)) {
    err('steps', 'must be an array of steps')
    return { ok: false, errors }
  }
  if (!flow.steps.length) err('steps', 'a flow needs at least one screen')

  const keys = new Map()
  const screens = options.screens ? new Set(options.screens) : null

  flow.steps.forEach((step, i) => {
    const at = `steps[${i}]`
    if (!step || typeof step !== 'object') { err(at, 'must be an object'); return }
    if (!KEY.test(String(step.stepKey || ''))) err(`${at}.stepKey`, 'must start with a letter and contain only letters, digits and _')
    else if (keys.has(step.stepKey)) err(`${at}.stepKey`, `"${step.stepKey}" is already used by steps[${keys.get(step.stepKey)}]`)
    else keys.set(step.stepKey, i)
    if (!String(step.screen || '').trim()) err(`${at}.screen`, 'must name the screen this step shows')
    else if (screens && !screens.has(step.screen)) err(`${at}.screen`, `"${step.screen}" is not a published screen`)
    if (step.layout && (!Number.isFinite(step.layout.x) || !Number.isFinite(step.layout.y))) {
      err(`${at}.layout`, 'must be { x, y } in pixels')
    }
    if (!Array.isArray(step.transitions)) { err(`${at}.transitions`, 'must be an array'); return }
    let otherwiseAt = -1
    step.transitions.forEach((t, j) => {
      const tp = `${at}.transitions[${j}]`
      if (!t || typeof t !== 'object') { err(tp, 'must be { when, target }'); return }
      if (!String(t.target || '').trim()) err(`${tp}.target`, `must name the step this arrow goes to, or "${FLOW_END}"`)
      if (t.when === null || t.when === undefined) {
        if (otherwiseAt !== -1) err(tp, 'a step can have only one "otherwise" — the others need a test')
        otherwiseAt = j
      } else {
        checkWhen(t.when, tp, err)
        if (otherwiseAt !== -1) err(tp, '"otherwise" must be the last arrow, or the ones after it are never tried')
      }
    })
  })

  // Targets are checked once every step key is known.
  flow.steps.forEach((step, i) => {
    ;(step.transitions || []).forEach((t, j) => {
      const target = t && t.target
      if (!target || target === FLOW_END) return
      if (!keys.has(target)) err(`steps[${i}].transitions[${j}].target`, `"${target}" is not a step of this flow`)
    })
  })

  const reachable = reachableSteps(flow)
  flow.steps.forEach((step, i) => {
    if (step && step.stepKey && !reachable.has(step.stepKey)) {
      err(`steps[${i}]`, `nothing leads to "${step.label || step.stepKey}" — draw an arrow to it, or remove it`)
    }
  })

  return { ok: errors.length === 0, errors }
}

function checkWhen(when, at, err) {
  if (typeof when !== 'object' || Array.isArray(when)) { err(at + '.when', 'must be { field, op, value }'); return }
  if (!String(when.field || '').trim()) err(`${at}.when.field`, 'must name a field of the screen this step shows')
  const known = FLOW_OPERATORS.some((o) => o.op === when.op)
  if (!known) err(`${at}.when.op`, `must be one of: ${FLOW_OPERATORS.map((o) => o.op).join(', ')}`)
  if (known && !VALUELESS_OPERATORS.includes(when.op) && (when.value === undefined || when.value === null || when.value === '')) {
    err(`${at}.when.value`, 'needs a value to compare with')
  }
}

/** A test in words: "Type is contractor". */
export function describeWhen(when, fieldLabel) {
  if (!when) return 'otherwise'
  const op = FLOW_OPERATORS.find((o) => o.op === when.op)
  const name = fieldLabel || when.field
  if (VALUELESS_OPERATORS.includes(when.op)) return `${name} ${op ? op.label : when.op}`
  return `${name} ${op ? op.label : when.op} ${when.value}`
}

function mapStep(flow, stepKey, fn) {
  return { ...flow, steps: flow.steps.map((s) => (s.stepKey === stepKey ? fn(s) : s)) }
}
