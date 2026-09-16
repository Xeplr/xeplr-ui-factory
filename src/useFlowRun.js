import { useCallback, useEffect, useRef, useState } from 'react'

// RUNNING a flow: one screen at a time, and the run decides which.
//
// The browser holds no route through the journey. It asks the run what to
// show, renders that screen, and when the person is finished with it sends
// the values back — the engine tests the arrows leaving that step and answers
// with the next screen, or that the journey is done.
//
// The record itself is saved the ordinary way, by the screen, into its own
// table. What travels with the run is only what the arrows need to decide,
// plus the id of the row that was written.

/**
 * @param flowKey    which flow to run (starting one, or picking up a run)
 * @param runId      an existing run to continue — omit to start one
 * @param startRun   async (flowKey) → { runId, status, stepKey, screen }
 * @param loadRun    async (runId) → { runId, status, stepKey, screen, values }
 * @param submitRun  async (runId, values, recordId) → { status, stepKey, screen }
 * @param loadScreen async (key) → the screen document
 * @param onStep     (step) → void — told each time the run moves, for the address bar
 * @param onFinish   (run) → void — the journey is over
 */
export function useFlowRun({ flowKey, runId, startRun, loadRun, submitRun, loadScreen, onStep, onFinish } = {}) {
  const [state, setState] = useState({ loading: true, error: null, runId: runId || null, status: null, stepKey: null, screen: null, document: null, values: null })
  const [sending, setSending] = useState(false)
  const live = useRef({})
  live.current = { startRun, loadRun, submitRun, loadScreen, onStep, onFinish, flowKey }

  /** A step the run reports → the screen to draw. */
  const open = useCallback(async (run) => {
    if (!run) throw new Error('The run said nothing about what to show')
    if (run.status === 'done' || !run.screen) {
      setState((s) => ({ ...s, loading: false, error: null, runId: run.runId || s.runId, status: 'done', stepKey: null, screen: null, document: null }))
      if (live.current.onFinish) live.current.onFinish(run)
      return
    }
    if (!live.current.loadScreen) throw new Error('No loadScreen was provided, so the flow cannot show "' + run.screen + '"')
    const doc = await live.current.loadScreen(run.screen)
    setState({
      loading: false, error: null,
      runId: run.runId, status: run.status || 'running', stepKey: run.stepKey, screen: run.screen,
      document: doc, values: run.values || null
    })
    if (live.current.onStep) live.current.onStep(run)
  }, [])

  // Start, or pick up where a run got to.
  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    const begin = async () => {
      if (runId) {
        if (!live.current.loadRun) throw new Error('No loadRun was provided')
        return live.current.loadRun(runId)
      }
      if (!live.current.startRun) throw new Error('No startRun was provided')
      return live.current.startRun(live.current.flowKey)
    }
    begin()
      .then((run) => { if (!cancelled) return open(run) })
      .catch((err) => { if (!cancelled) setState((s) => ({ ...s, loading: false, error: err.message || 'The flow could not be opened' })) })
    return () => { cancelled = true }
  }, [flowKey, runId, open])

  /**
   * Done with this screen. The values go to the run, which decides what comes
   * next; `recordId` is the row the screen just saved, so later steps and
   * their arrows can refer to it.
   */
  const submit = useCallback(async (values, recordId) => {
    if (!live.current.submitRun) throw new Error('No submitRun was provided')
    setSending(true)
    try {
      const next = await live.current.submitRun(state.runId, values || {}, recordId)
      await open({ runId: state.runId, ...next })
    } catch (err) {
      setState((s) => ({ ...s, error: err.message || 'That could not be sent' }))
      throw err
    } finally {
      setSending(false)
    }
  }, [state.runId, open])

  return { ...state, sending, submit }
}
