// The browser side of FLOWS: designing a chain of screens, and running one.
//
// The factory does not run a flow — the app's workflow service does, which is
// why every call here goes to endpoints the app supplies. A run remembers
// where it got to, so a journey can be left and picked up later; the browser
// only asks "what should this person see now" and sends back what was typed.
//
//   import { authFetch } from '@xeplr/ui-account'
//   const flows = createFlowsApi({ fetch: authFetch, base: '/api' })
//   <FlowRunner {...flows.runnerProps} flowKey="employee_registration" />
//
// Answers may come as xeplr's { code, message, dataArray } or as the plain
// object or list itself — the workflow service speaks the second. Both are read
// the same way (payload()), so a client never cares which service it is talking to.

import { FLOW_KIND, FLOW_VERSION } from './flow.js'

/**
 * A flow as the server sends it → the document the designer edits. The server
 * stores steps, not the document's envelope, so the envelope is put back here
 * and a step with no label is named after its screen.
 */
export function asFlow(row) {
  if (!row) return row
  return {
    kind: FLOW_KIND,
    version: FLOW_VERSION,
    key: row.key,
    name: row.name,
    status: row.status,
    // A list or a publish answer counts the steps rather than listing them.
    ...(Array.isArray(row.steps) ? {} : { stepCount: Number(row.steps) || 0 }),
    steps: (Array.isArray(row.steps) ? row.steps : []).map((s) => ({
      stepKey: s.stepKey,
      screen: s.screen,
      label: s.label || s.screen,
      layout: s.layout || { x: 40, y: 40 },
      transitions: s.transitions || []
    }))
  }
}

/**
 * @param options.fetch  a fetch that adds auth and tenant headers (authFetch)
 * @param options.base   prefix before /flows (default '')
 */
export function createFlowsApi({ fetch: doFetch, base = '' } = {}) {
  if (typeof doFetch !== 'function') throw new Error('createFlowsApi: pass { fetch } — usually authFetch from @xeplr/ui-account')

  async function call(method, path, body) {
    let res
    try {
      res = await doFetch(`${base}/flows${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      })
    } catch (err) {
      if (err && err.body !== undefined && err.status) throw failure(method, path, err.status, err.body, err.message)
      throw err
    }
    if (res && typeof res.json === 'function' && typeof res.ok === 'boolean') {
      let json = null
      try { json = await res.json() } catch (_) { /* not JSON — reported below */ }
      if (!res.ok) throw failure(method, path, res.status, json)
      return payload(json)
    }
    return payload(res)
  }

  /** The payload, enveloped or not. */
  function payload(json) {
    if (json === null || json === undefined) return []
    if (typeof json === 'object' && !Array.isArray(json) && Array.isArray(json.dataArray)) return json.dataArray
    return json
  }

  function failure(method, path, status, json, fallback) {
    const err = new Error((json && json.message) || fallback || `${method} ${path} failed (${status})`)
    err.status = status
    err.fields = json && json.error && json.error.fields
    err.code = json && json.code
    return err
  }
  const one = (rows) => (Array.isArray(rows) ? rows[0] : rows)
  const enc = encodeURIComponent

  const api = {
    // designing
    listFlows: () => call('GET', ''),
    createFlow: async (spec) => asFlow(one(await call('POST', '', spec))),
    loadFlow: async (key) => asFlow(one(await call('GET', `/${enc(key)}`))),
    saveFlow: async (flow) => asFlow(one(await call('PUT', `/${enc(flow.key)}`, {
      name: flow.name,
      steps: flow.steps.map((s) => ({ stepKey: s.stepKey, label: s.label, screen: s.screen, layout: s.layout, transitions: s.transitions }))
    }))),
    // Answers with the flow's status, not its steps — nothing to rebuild from it.
    publishFlow: async (key) => one(await call('POST', `/${enc(key)}/publish`)),

    // running
    startRun: async (key) => one(await call('POST', `/${enc(key)}/runs`)),
    loadRun: async (runId) => one(await call('GET', `/runs/${enc(runId)}`)),
    /** What the person filled in. Answers with the next screen, or that it is done. */
    submitRun: async (runId, values, recordId) => one(await call('POST', `/runs/${enc(runId)}/submit`, { values, recordId })),
    /** Journeys of this flow that are still going — "in progress". */
    myRuns: (key) => call('GET', `/${enc(key)}/runs?mine=1`)
  }

  api.builderProps = { listFlows: api.listFlows, loadFlow: api.loadFlow, onSave: api.saveFlow, onPublish: api.publishFlow, onCreate: api.createFlow }
  api.runnerProps = { startRun: api.startRun, loadRun: api.loadRun, submitRun: api.submitRun, myRuns: api.myRuns }
  return api
}
