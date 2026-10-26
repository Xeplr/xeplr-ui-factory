import { useCallback, useEffect, useRef, useState } from 'react'
import { SCREEN_EVENTS, setEvent as withEvent, missingFunctions } from './events.js'

// ONE SCREEN'S EVENTS, edited outside its builder — the flow designer's
// "Events" panel for the screen a step shows. No JSX.
//
// Events belong to the SCREEN, not to the flow: a screen's records behave the
// same in every flow that shows it. So a change here is a change to that
// screen's draft — saved at once, like any edit in the builder — and takes
// effect when the screen is PUBLISHED. Publishing is deliberate and separate,
// because the draft may hold other changes (a field added in Form design).

/**
 * @param screen      the screen's id (a step's `screen`), or null
 * @param loadDraft   async (id) → { document } — the screen's draft (createFactoryApi)
 * @param saveDraft   async (document) → void
 * @param publish     async (document) → { version } — refuses with the functions that are missing
 * @param functions   [{ name, event }] — the app's registry, to say which picked ones are gone
 */
export function useScreenEvents({ screen, loadDraft, saveDraft, publish, functions } = {}) {
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('idle')          // idle | saving | saved | error
  const [saveError, setSaveError] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState(null)
  const calls = useRef({}); calls.current = { loadDraft, saveDraft, publish }
  const docRef = useRef(null); docRef.current = doc

  useEffect(() => {
    setDoc(null); setError(null); setStatus('idle'); setPublishResult(null)
    if (!screen || !calls.current.loadDraft) return undefined
    let cancelled = false
    setLoading(true)
    Promise.resolve()
      .then(() => calls.current.loadDraft(screen))
      .then((row) => { if (!cancelled) setDoc((row && row.document) || row || null) })
      .catch((err) => { if (!cancelled) setError(err.message || `Could not open "${screen}"`) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [screen])

  /** Pick a function for an event (or clear it with nothing). Saved to the draft at once. */
  const setEvent = useCallback(async (key, name) => {
    const current = docRef.current
    if (!current) return
    const next = withEvent(current, key, name)
    setDoc(next)
    docRef.current = next
    setPublishResult(null)
    if (!calls.current.saveDraft) return
    setStatus('saving')
    setSaveError(null)
    try {
      await calls.current.saveDraft(next)
      setStatus('saved')
    } catch (err) {
      setSaveError(err.message || 'Could not save')
      setStatus('error')
    }
  }, [])

  const publishNow = useCallback(async () => {
    const current = docRef.current
    if (!current || !calls.current.publish) return
    setPublishing(true)
    setPublishResult(null)
    try {
      const out = await calls.current.publish(current)
      setPublishResult({ ok: true, message: `Published${out && out.version ? ` — version ${out.version}` : ''}. These events run from the next save.` })
    } catch (err) {
      setPublishResult({ ok: false, message: err.message || 'Could not publish' })
    } finally {
      setPublishing(false)
    }
  }, [])

  /**
   * The screen's builder changed the same draft (Form design) — take its
   * document as the one events are set on, so neither editor writes back a
   * copy older than the other's.
   */
  const adopt = useCallback((next) => {
    if (!next) return
    setDoc(next)
    docRef.current = next
  }, [])

  const events = (doc && doc.events) || {}
  return {
    screen,
    document: doc,
    loading,
    error,
    events,
    /** The events a screen has, each with its contract and the function picked for it. */
    rows: SCREEN_EVENTS.map((e) => ({ ...e, picked: events[e.key] || '' })),
    /** Picked functions the app no longer registers, or registered for another event. */
    missing: doc && functions ? missingFunctions(doc, functions) : [],
    setEvent,
    adopt,
    status,
    saveError,
    canPublish: Boolean(publish) && Boolean(doc),
    publish: publishNow,
    publishing,
    publishResult
  }
}
