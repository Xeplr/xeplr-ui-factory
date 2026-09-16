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
// Responses are xeplr's { code, message, error, dataArray }.

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
      return json ? json.dataArray : []
    }
    return res && Array.isArray(res.dataArray) ? res.dataArray : []
  }

  function failure(method, path, status, json, fallback) {
    const err = new Error((json && json.message) || fallback || `${method} ${path} failed (${status})`)
    err.status = status
    err.fields = json && json.error && json.error.fields
    return err
  }
  const one = (rows) => (Array.isArray(rows) ? rows[0] : rows)
  const enc = encodeURIComponent

  const api = {
    // designing
    listFlows: () => call('GET', ''),
    createFlow: async (spec) => one(await call('POST', '', spec)),
    loadFlow: async (key) => one(await call('GET', `/${enc(key)}`)),
    saveFlow: async (flow) => one(await call('PUT', `/${enc(flow.key)}`, { name: flow.name, steps: flow.steps })),
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
