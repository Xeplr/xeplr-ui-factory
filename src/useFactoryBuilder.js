import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CONTROLS, controlGroups } from './controls.js'
import {
  createScreen, renameScreen, setScreenProperty, addControl as addControlTo, moveNode, setNodeProperty, setNodeStep,
  steppers, stepsOf, stepOf, nodesForSteps,
  removeNodes
} from './document.js'
import { validateDocument } from './validateDocument.js'
import { presetFor, presetProps, presetGroup, presetHints, convertField } from './presets.js'

// The builder's controller: the document being edited, what is selected, and
// every change the builder can make. No JSX — designs/BuilderSample.jsx draws
// it, and a host with its own design can use this hook directly.
//
// STORAGE IS THE HOST'S. This never loads or persists anything: it starts from
// the `document` it is handed and gives the result to `onSave`. A document
// handed in LATER (Claude regenerated the screen, another record was opened)
// replaces what is being edited.
//
// NO SAVE BUTTON. Every edit is saved a moment after the last one, whenever the
// screen is valid; while it is not, the problems are shown and nothing is sent.

/**
 * @param document    the screen to edit; omitted → a new empty screen
 * @param name        the name for a new screen (when no document)
 * @param onSave      async (document) → void; called automatically, only with a valid document
 * @param autosaveDelay ms of quiet after the last edit before saving (default 800)
 * @param onChange    (document) → void; every edit, for hosts that autosave or preview
 * @param listTables  async () → [{ id, name }] | string[]; offered in a dropdown's
 *                    "from a table" picker. Omitted → table sources can still be typed.
 * @param screens     [{ id, name, document? }] — other screens, offered for a list's "Edit in";
 *                    with its document, a list screen can pick columns from its fields
 * @param lockedNames field names that are already columns of the table — they cannot be renamed
 * @param onPublish   async (document, { confirmDrop }) → { version } — makes the saved draft the version
 *                    everyone sees, and changes its table to match. Throw to refuse (the message is
 *                    shown); throw with `confirm: [{ column, records }]` when removed fields would drop
 *                    columns — the builder asks, and calls again with confirmDrop naming them.
 * @param controls    the control registry (default: the built-ins)
 */
export function useFactoryBuilder({ document: given, name, onSave, onChange, onPublish, listTables, screens, lockedNames, controls = CONTROLS, autosaveDelay = 800 } = {}) {
  const [doc, setDoc] = useState(() => given || createScreen({ name }))
  const [selected, setSelected] = useState(() => new Set())
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const docRef = useRef(doc); docRef.current = doc

  // A NEW document from outside replaces the draft. Not a new OBJECT: a host
  // that re-reads what it just saved hands back the same screen as a fresh
  // object on every autosave, and replacing the draft with it would drop the
  // selection each time. Only different content replaces what is being edited.
  const lastGiven = useRef(given)
  useEffect(() => {
    if (!given || given === lastGiven.current) return
    lastGiven.current = given
    if (JSON.stringify(given) === JSON.stringify(docRef.current)) return
    docRef.current = given
    setDoc(given)
    setSelected(new Set())
    setDirty(false)
  }, [given])

  // Every edit goes through here. It works on a REF of the current document,
  // not a state updater: an edit that needs its own result (the id of the
  // control just added) gets it synchronously, and two edits in one event
  // build on each other instead of both starting from the same render.
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange
  const update = useCallback((fn) => {
    const current = docRef.current
    const next = fn(current)
    if (next === current) return current
    docRef.current = next
    setDoc(next)
    setDirty(true)
    onChangeRef.current?.(next)
    return next
  }, [])

  // ── tables for the dropdown source picker ─────────────────────────────
  const [tables, setTables] = useState({ loading: Boolean(listTables), items: [], error: null })
  const listTablesRef = useRef(listTables); listTablesRef.current = listTables
  const hasListTables = Boolean(listTables)
  useEffect(() => {
    if (!hasListTables) return undefined
    let cancelled = false
    Promise.resolve()
      .then(() => listTablesRef.current())
      .then((rows) => {
        if (cancelled) return
        const items = (rows || []).map((t) => (typeof t === 'string' ? { id: t, name: t } : t))
        setTables({ loading: false, items, error: null })
      })
      .catch((err) => { if (!cancelled) setTables({ loading: false, items: [], error: err.message || 'Could not list tables' }) })
    return () => { cancelled = true }
  }, [hasListTables])

  // ── edits ─────────────────────────────────────────────────────────────
  const rename = useCallback((value) => update((d) => renameScreen(d, value)), [update])
  /** A screen property by path — `source`, `width`, `style.fontSize`. */
  const setScreen = useCallback((path, value) => update((d) => setScreenProperty(d, path, value)), [update])

  // ── steps ─────────────────────────────────────────────────────────────
  // Which step of each stepper is open on the canvas. Everything dropped while
  // a step is open belongs to that step, and the canvas shows only that step —
  // so one screen holds as many little screens as it has steps.
  const [openSteps, setOpenSteps] = useState({})
  const stepperNodes = useMemo(() => steppers(doc, controls), [doc, controls])
  const [building, setBuilding] = useState(null)      // the stepper being built
  const activeStepper = stepperNodes.find((n) => n.id === building) || stepperNodes[stepperNodes.length - 1] || null
  const stepAt = useCallback((id) => (Number.isInteger(openSteps[id]) ? openSteps[id] : 0), [openSteps])

  const goToStep = useCallback((id, index) => {
    setBuilding(id)
    setOpenSteps((o) => ({ ...o, [id]: index }))
  }, [])

  /** The step a new control lands on: the one open on the stepper being built. */
  const dropStep = useCallback(() => (
    activeStepper ? { of: activeStepper.id, index: stepAt(activeStepper.id) } : null
  ), [activeStepper, stepAt])

  /** Moves a control to a step, or to none — shown whatever step is open. */
  const setStep = useCallback((id, step) => update((d) => setNodeStep(d, id, step)), [update])

  const visibleNodes = useMemo(() => nodesForSteps(doc, openSteps, controls), [doc, openSteps, controls])

  /**
   * Adds a control and selects it, so its properties are open straight away.
   * `type` may be a ready-made field — "preset:email" — which adds its control
   * with the preset's settings already in it.
   */
  const addControl = useCallback((type, at) => {
    let added = null
    const preset = presetFor(type)
    update((d) => {
      const r = preset
        ? addControlTo(d, preset.control, { at, step: dropStep(), props: presetProps(preset), size: preset.size }, controls)
        : addControlTo(d, type, { at, step: dropStep() }, controls)
      added = r.node
      return r.document
    })
    if (added) setSelected(new Set([added.id]))
    return added
  }, [update, controls, dropStep])

  const moveControl = useCallback((id, patch) => update((d) => moveNode(d, id, patch)), [update])

  const lockedRef = useRef(lockedNames); lockedRef.current = lockedNames
  const setProperty = useCallback((id, path, value) => update((d) => setNodeProperty(d, id, path, value, controls, { lockedNames: lockedRef.current })), [update, controls])

  /**
   * A field becomes another kind — a control type ('number') or a ready-made
   * field ('email'). Returns what did not carry over, in words, for the panel
   * to say ("the pattern", "the options").
   */
  const convertControl = useCallback((id, target) => {
    let dropped = []
    update((d) => {
      const r = convertField(d, id, target, controls, { lockedNames: lockedRef.current })
      dropped = r.dropped
      return r.document
    })
    return dropped
  }, [update, controls])

  const selectedRef = useRef(selected); selectedRef.current = selected
  const removeSelected = useCallback(() => {
    const ids = [...selectedRef.current]
    if (!ids.length) return
    update((d) => removeNodes(d, ids))
    setSelected(new Set())
  }, [update])

  /** Everything selected moves to a copy, just below the original. */
  const duplicateSelected = useCallback(() => {
    const ids = [...selectedRef.current]
    if (!ids.length) return
    const created = []
    update((d) => {
      let next = d
      ids.forEach((id) => {
        const src = d.nodes.find((n) => n.id === id)
        if (!src) return
        const props = JSON.parse(JSON.stringify(src.props))
        delete props.name
        const r = addControlTo(next, src.type, { at: { x: src.x, y: src.y + src.h + 0.02 }, size: { w: src.w, h: src.h }, props }, controls)
        next = r.document
        created.push(r.node.id)
      })
      return next
    })
    setSelected(new Set(created))
  }, [update, controls])

  // ── validation + save ─────────────────────────────────────────────────
  const validation = useMemo(() => validateDocument(doc, controls), [doc, controls])
  /** Fields that read like a ready-made one they are not. Never block anything. */
  const hints = useMemo(() => presetHints(doc, controls), [doc, controls])

  /** Errors grouped by node id, for the canvas and the property panel. */
  const errorsByNode = useMemo(() => {
    const map = {}
    validation.errors.forEach((e) => {
      const m = /^nodes\[(\d+)\]\.?(.*)$/.exec(e.path)
      const node = m && doc.nodes[Number(m[1])]
      const key = node ? node.id : '_document'
      ;(map[key] = map[key] || []).push({ ...e, field: m ? m[2] : e.path })
    })
    return map
  }, [validation, doc.nodes])

  const onSaveRef = useRef(onSave); onSaveRef.current = onSave
  const savingRef = useRef(false)
  const save = useCallback(async () => {
    const current = docRef.current
    const check = validateDocument(current, controls)
    if (!check.ok) return { ok: false, errors: check.errors }
    if (!onSaveRef.current) return { ok: false, errors: [{ path: '', message: 'No onSave was provided' }] }
    if (savingRef.current) return { ok: false, busy: true }
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    try {
      await onSaveRef.current(current)
      // Only clean if nothing changed while the save was out.
      if (docRef.current === current) setDirty(false)
      setSavedAt(new Date())
      return { ok: true }
    } catch (err) {
      setSaveError(err.message || 'Could not save')
      return { ok: false, errors: [{ path: '', message: err.message }] }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [controls])

  // NOTHING SAVES ITSELF. Saving is an act, and the person designing decides
  // when they have finished — a screen that writes itself to the server a
  // moment after every drag means there is no such thing as trying something
  // out, and no moment at which somebody said "this is right".
  //
  // It also made every half-made field an error: a field is invalid while it
  // is being built, and an autosave meets it mid-build and reports it.
  //
  // `save` is called by the Design's Save control (see BuilderSample), and by
  // publish, which saves first because publishing what is on screen is the
  // one thing it must never get wrong. `autosaveDelay` is kept as a prop and
  // ignored, so a host passing it is not broken by this; it does nothing.

  // PUBLISH: the draft becomes the next version — what screens actually show.
  // Deliberate, unlike saving: a half-finished design must not reach everyone
  // filling the form in.
  const onPublishRef = useRef(onPublish); onPublishRef.current = onPublish
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState(null)   // { ok, message, version?, detail? }
  /**
   * @param confirmDrop     column names the person agreed to remove
   * @param confirmConvert  column names the person agreed to convert to their field's new kind
   */
  const publish = useCallback(async (confirmDrop, confirmConvert) => {
    if (!onPublishRef.current) return { ok: false }
    const check = validateDocument(docRef.current, controls)
    if (!check.ok) {
      const r = { ok: false, message: `Fix ${check.errors.length} problem${check.errors.length === 1 ? '' : 's'} before publishing` }
      setPublishResult(r)
      return r
    }
    setPublishing(true)
    setPublishResult(null)
    try {
      const saved = await save()
      if (!saved.ok && !saved.busy) throw new Error((saved.errors && saved.errors[0] && saved.errors[0].message) || 'Could not save the draft')
      const res = await onPublishRef.current(docRef.current, {
        confirmDrop: Array.isArray(confirmDrop) ? confirmDrop : [],
        confirmConvert: Array.isArray(confirmConvert) ? confirmConvert : []
      })
      const kept = (res && res.keep) || []
      const r = {
        ok: true,
        version: res && res.version,
        message: (res && res.version ? `Published version ${res.version}` : 'Published') +
          (kept.length ? ` — kept ${kept.map((k) => k.name).join(', ')} (${kept[0].reason})` : '')
      }
      setPublishResult(r)
      return r
    } catch (err) {
      // A removed field would drop a column, or a field that changed kind would
      // convert one: not an error, a question.
      const asks = (Array.isArray(err.confirm) && err.confirm.length) || (Array.isArray(err.convert) && err.convert.length)
      const r = asks
        ? { ok: false, confirm: err.confirm || [], convert: err.convert || [], message: err.message }
        : { ok: false, message: err.message || 'Could not publish', detail: err.detail, wontFit: err.wontFit }
      setPublishResult(r)
      return r
    } finally {
      setPublishing(false)
    }
  }, [controls, save])

  // `pending` now means "there are changes you have not saved", which is a
  // thing to act on rather than a thing about to happen by itself.
  const status = saveError ? 'error'
    : saving ? 'saving'
    : !validation.ok ? 'invalid'
    : dirty ? 'unsaved'
    : savedAt ? 'saved' : 'idle'

  // ── keyboard: Delete / Backspace removes, Cmd/Ctrl+D duplicates ────────
  useEffect(() => {
    function onKey(e) {
      const t = e.target
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      if (typing) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size) {
        e.preventDefault()
        removeSelected()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selected.size) {
        e.preventDefault()
        duplicateSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, removeSelected, duplicateSelected])

  const selectedNode = selected.size === 1 ? doc.nodes.find((n) => selected.has(n.id)) || null : null

  return {
    document: doc,
    controls,
    // The controls, then the ready-made fields made of the ones this registry has.
    palette: useMemo(() => {
      const ready = presetGroup()
      ready.controls = ready.controls.filter((c) => controls[c.icon] && controls[c.icon].input)
      return ready.controls.length ? [...controlGroups(controls), ready] : controlGroups(controls)
    }, [controls]),
    selected,
    setSelected,
    selectedNode,
    selectedControl: selectedNode ? controls[selectedNode.type] : null,
    rename,
    setScreen,
    addControl,
    moveControl,
    steps: {
      nodes: stepperNodes,
      building: activeStepper ? activeStepper.id : null,
      active: stepAt,
      count: (id) => stepsOf(stepperNodes.find((n) => n.id === id)).length,
      labels: (id) => stepsOf(stepperNodes.find((n) => n.id === id)),
      go: goToStep,
      of: stepOf,
      set: setStep
    },
    visibleNodes,
    setProperty,
    convertControl,
    hints,
    removeSelected,
    duplicateSelected,
    tables,
    screens: screens || [],
    lockedNames: lockedNames || [],
    validation,
    errorsByNode,
    dirty,
    saving,
    saveError,
    savedAt,
    status,
    save,
    canPublish: Boolean(onPublish),
    publish,
    publishing,
    publishResult,
    clearPublishResult: () => setPublishResult(null)
  }
}
