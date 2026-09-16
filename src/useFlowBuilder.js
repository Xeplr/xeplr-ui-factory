import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createFlow, addStep, moveStep, setStep, removeStep,
  addTransition, setTransition, removeTransition, validateFlow, firstStep, FLOW_END
} from './flow.js'
import { inputNodes } from './document.js'

// DESIGNING a flow: which screens, in what order, and what decides the order.
//
// The same shape as useFactoryBuilder, so the two designers feel like one
// product: the document, what is selected, and a save that happens by itself
// once what is drawn makes sense. Publishing is separate and deliberate — a
// flow that is published is what people actually walk through.

/** Quiet time after the last change before a save goes out. */
export const FLOW_AUTOSAVE_DELAY = 800

/**
 * @param flow        the flow to edit (omit for a new one)
 * @param name        name for a new flow
 * @param screens     [{ id, name }] — the published screens a step can show
 * @param loadScreen  async (id) → the screen document, so a condition can offer its fields
 * @param onSave      async (flow) → void — called after edits, only with a flow that makes sense
 * @param onPublish   async (key) → void — shows a Publish button
 * @param onChange    (flow) → void — every edit
 */
export function useFlowBuilder({ flow: given, name, screens = [], loadScreen, onSave, onPublish, onChange } = {}) {
  const [flow, setFlow] = useState(() => given || createFlow({ name }))
  const [selected, setSelected] = useState(null)          // a step key
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState(null)

  // A flow handed in from outside replaces what is being edited only when it
  // is a different flow — otherwise a re-render would undo what was typed.
  const givenKey = given && given.key
  useEffect(() => { if (given) { setFlow(given); setDirty(false) } }, [givenKey])   // eslint-disable-line react-hooks/exhaustive-deps

  const live = useRef({})
  live.current = { flow, onSave, onChange }

  const check = useMemo(() => validateFlow(flow, { screens: screens.map((s) => s.id) }), [flow, screens])
  const errorsByStep = useMemo(() => {
    const out = {}
    check.errors.forEach((e) => {
      const m = /^steps\[(\d+)\]/.exec(e.path || '')
      if (!m) return
      const step = flow.steps[Number(m[1])]
      if (!step) return
      out[step.stepKey] = [...(out[step.stepKey] || []), e]
    })
    return out
  }, [check, flow])

  // ── the fields a condition can test ───────────────────────────────────
  // A condition reads what the person filled in on THAT step's screen, so the
  // designer offers exactly those fields, by name, with their labels.
  const [fields, setFields] = useState({})                // screen id → [{ name, label }]
  const loadRef = useRef(loadScreen); loadRef.current = loadScreen
  useEffect(() => {
    const wanted = [...new Set(flow.steps.map((s) => s.screen).filter(Boolean))]
    const missing = wanted.filter((id) => !fields[id])
    if (!missing.length || !loadRef.current) return undefined
    let cancelled = false
    Promise.all(missing.map((id) => Promise.resolve()
      .then(() => loadRef.current(id))
      .then((doc) => [id, inputNodes(doc).map((n) => ({ name: n.props.name, label: n.props.label || n.props.name }))])
      .catch(() => [id, []])))
      .then((pairs) => { if (!cancelled) setFields((f) => ({ ...f, ...Object.fromEntries(pairs) })) })
    return () => { cancelled = true }
  }, [flow.steps, fields])

  /** The fields of the screen a step shows — what its arrows can test. */
  const fieldsFor = useCallback((stepKey) => {
    const step = flow.steps.find((s) => s.stepKey === stepKey)
    return (step && fields[step.screen]) || []
  }, [flow, fields])

  // ── edits ─────────────────────────────────────────────────────────────
  const update = useCallback((fn) => {
    setFlow((f) => {
      const next = fn(f)
      if (next === f) return f
      live.current.flow = next
      setDirty(true)
      if (live.current.onChange) live.current.onChange(next)
      return next
    })
  }, [])

  const rename = useCallback((value) => update((f) => ({ ...f, name: value })), [update])
  const add = useCallback((screen, at) => {
    let added = null
    update((f) => {
      const r = addStep(f, screen, { at })
      added = r.step
      return r.flow
    })
    if (added) setSelected(added.stepKey)
    return added
  }, [update])
  const move = useCallback((stepKey, at) => update((f) => moveStep(f, stepKey, at)), [update])
  const change = useCallback((stepKey, patch) => update((f) => setStep(f, stepKey, patch)), [update])
  const remove = useCallback((stepKey) => {
    update((f) => removeStep(f, stepKey))
    setSelected((s) => (s === stepKey ? null : s))
  }, [update])
  const connect = useCallback((fromKey, target, when = null) => update((f) => addTransition(f, fromKey, target, when)), [update])
  const changeTransition = useCallback((fromKey, index, patch) => update((f) => setTransition(f, fromKey, index, patch)), [update])
  const disconnect = useCallback((fromKey, index) => update((f) => removeTransition(f, fromKey, index)), [update])

  // ── saving ────────────────────────────────────────────────────────────
  const timer = useRef(null)
  useEffect(() => {
    if (!dirty || !onSave) return undefined
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const f = live.current.flow
      if (!validateFlow(f, { screens: screens.map((s) => s.id) }).ok) return       // saved once it makes sense
      setSaving(true)
      setSaveError(null)
      Promise.resolve()
        .then(() => live.current.onSave(f))
        .then(() => { setDirty(false) })
        .catch((err) => setSaveError(err.message || 'Could not save'))
        .finally(() => setSaving(false))
    }, FLOW_AUTOSAVE_DELAY)
    return () => clearTimeout(timer.current)
  }, [flow, dirty, onSave, screens])

  const publish = useCallback(async () => {
    if (!onPublish) return
    setPublishing(true)
    setPublishResult(null)
    try {
      clearTimeout(timer.current)
      if (dirty && onSave) await onSave(live.current.flow)
      await onPublish(live.current.flow.key)
      setDirty(false)
      setPublishResult({ ok: true, message: 'Published — people can walk through it now' })
    } catch (err) {
      setPublishResult({ ok: false, message: err.message || 'Could not publish' })
    } finally {
      setPublishing(false)
    }
  }, [onPublish, onSave, dirty])

  const status = saveError ? 'error' : saving ? 'saving' : dirty ? (check.ok ? 'pending' : 'invalid') : 'saved'

  return {
    flow,
    screens,
    selected,
    setSelected,
    selectedStep: flow.steps.find((s) => s.stepKey === selected) || null,
    first: firstStep(flow),
    validation: check,
    errorsByStep,
    fieldsFor,
    rename,
    addStep: add,
    moveStep: move,
    setStep: change,
    removeStep: remove,
    connect,
    setTransition: changeTransition,
    disconnect,
    end: FLOW_END,
    status,
    saving,
    saveError,
    dirty,
    canPublish: Boolean(onPublish),
    publish,
    publishing,
    publishResult,
    clearPublishResult: () => setPublishResult(null)
  }
}
