import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CONTROLS, CHOICE_TYPES } from './controls.js'
import { inputNodes, nodesForSteps, steppers, stepsOf, stepOf, resolveStep, reachableStep, nextOpenStep } from './document.js'
import { validateDocument } from './validateDocument.js'
import { initialValues, parseInput, saveState, fieldError, optionValue, recordValues, listSource } from './values.js'
import { hookMethod } from './hooks.js'

// A saved screen, running. No JSX — designs/ScreenSample.jsx draws it.
//
// ── SAVED BY A BUTTON, OVER AJAX — NEVER A FORM SUBMIT ───────────────────
// Nothing is written while the person types. Changes are held in the form
// ("Unsaved changes") until they press Save, which makes ONE AJAX call to the
// host's onSave. There is no <form> post and no page reload — and no
// background save either: a half-typed record never lands in the table. The
// first save of a new record creates it (the host hands back its id); every
// save after that updates the same record. Leaving with unsaved changes asks
// first (Cancel, the popup's ×, closing the tab).
//
// ── THE DATABASE IS THE HOST'S ───────────────────────────────────────────
// Everything that reads or writes data is a call the host supplies:
//   onSave(values, { id, source, screen, document })   → the saved record (with its id)
//   fetchRecords({ source, screen, node })             → rows, for a list
//   onDelete({ id, source, screen, record })
//   fetchOptions({ table, node })              → [{ id, name }], for a table dropdown
//   uploadFile(file, { screen, field, node })  → { path } — a file field's upload
//
// ── LIST → EDIT IN A POPUP ───────────────────────────────────────────────
// A list whose `editScreen` names another screen opens that screen in a popup
// for Edit and New. The screen comes from `screens` ({ id → document }) or the
// host's `loadScreen(id)`. The list refreshes as the popup saves.

/**
 * @param document      a valid screen document
 * @param record        the record to open, e.g. { id: 7, firstName: 'Ada' } — omit for a new one
 * @param recordKey     the id field on a record (default 'id')
 * @param onSave        async (values, { id, source, document }) → saved record | void
 * @param fetchOptions  async ({ table, node }) → [{ id, name }]
 * @param onOpenRecord  ({ screen, id, record, source }) → void — where a list whose "Opens in" is a page sends Edit / New
 * @param onDone        () → void — a page's "Done": back to wherever the person came from
 * @param uploadFile    async (file, { screen, field, node }) → { path } — what a file field saves
 * @param fileUrl       (path) → the address an attached file is read back from
 * @param fetchRecords  async ({ source, node }) → records, for lists
 * @param onDelete      async ({ id, source, record }) → void
 * @param onChange      (values) → void — every change, before any save
 * @param fetchRecord   async ({ screen, id }) → record — Edit loads the record fresh (through the server's get hooks)
 * @param screens       { id → document } — screens a list's Edit / New can open
 * @param loadScreen    async (id) → document — for screens not in `screens`
 * @param onDirtyChange (dirty) → void — whether there are unsaved changes, as that changes
 * @param controls      the control registry (default: the built-ins)
 * @param hooks         a FactoryHooks (or an object with some of its methods) — get / save / delete / actions
 */
export function useFactoryScreen({
  document: doc, record, recordKey = 'id', onSave, fetchOptions, fetchRecords, fetchRecord, onDelete, onChange, screens, loadScreen, hooks, uploadFile, fileUrl,
  onOpenRecord, onDone, onDirtyChange,
  controls = CONTROLS
} = {}) {
  const check = useMemo(() => validateDocument(doc, controls), [doc, controls])
  // Read at call time, so a new hooks object never re-runs loads by itself.
  const hooksRef = useRef(hooks); hooksRef.current = hooks
  const hook = (name) => hookMethod(hooksRef.current, name)
  const inputs = useMemo(() => (check.ok ? inputNodes(doc, controls) : []), [doc, controls, check.ok])

  // A LIST SCREEN has no fields of its own; what its columns mean — that
  // `department` is a dropdown whose 2 reads "Finance" — lives on the screen it
  // edits in. Those fields are borrowed for display, and their table options
  // loaded alongside this screen's own.
  //
  // An edit screen not passed in `screens` is fetched with loadScreen as soon
  // as the list shows — not when Edit is first pressed — or the list's columns
  // would show stored values ("in_progress") until then.
  const [loadedScreens, setLoadedScreens] = useState({})
  const knownScreens = useMemo(() => ({ ...loadedScreens, ...(screens || {}) }), [loadedScreens, screens])
  const editScreenIds = check.ok && !inputs.length
    ? [...new Set(doc.nodes.filter((n) => n.type === 'list' && n.props.editScreen).map((n) => n.props.editScreen))].join('|')
    : ''
  useEffect(() => {
    if (!editScreenIds || !loadScreen) return undefined
    let cancelled = false
    editScreenIds.split('|').filter((id) => !(screens && screens[id])).forEach((id) => {
      loadScreen(id).then(
        (found) => { if (!cancelled && found) setLoadedScreens((m) => (m[id] ? m : { ...m, [id]: found })) },
        () => { /* shown when Edit is pressed, where the person is looking */ }
      )
    })
    return () => { cancelled = true }
  }, [editScreenIds])                                          // eslint-disable-line react-hooks/exhaustive-deps

  const fieldsFor = useCallback((node) => {
    if (inputs.length || !node || !node.props.editScreen) return inputs
    const editDoc = knownScreens[node.props.editScreen]
    return editDoc && validateDocument(editDoc, controls).ok ? inputNodes(editDoc, controls) : []
  }, [inputs, knownScreens, controls])
  const optionNodes = useMemo(() => {
    if (!check.ok) return []
    const borrowed = doc.nodes.filter((n) => n.type === 'list').flatMap((n) => (inputs.length ? [] : fieldsFor(n)))
    return [...inputs, ...borrowed]
  }, [check.ok, doc, inputs, fieldsFor])
  const source = check.ok ? doc.source || null : null

  const startValues = useCallback(
    (rec) => (rec ? { ...initialValues(doc, {}, controls), ...recordValues(doc, rec, controls) } : initialValues(doc, {}, controls)),
    [doc, controls]
  )

  const [values, setValues] = useState(() => (check.ok ? startValues(record) : {}))
  const [recordId, setRecordId] = useState(() => (record ? record[recordKey] ?? null : null))
  const [touched, setTouched] = useState(() => new Set())
  const [status, setStatus] = useState('idle')    // idle | pending (unsaved changes) | saving | saved | incomplete | invalid | error
  const [saveError, setSaveError] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const [listVersion, setListVersion] = useState(0)
  // Messages the SERVER put on fields — a hook's reject, a rule only it knows.
  // Shown like the form's own, and cleared as soon as that field is changed.
  const [serverErrors, setServerErrors] = useState({})

  // UNSAVED CHANGES: every change bumps `changes`; a save records which count
  // it wrote. A change made while a save was on the wire stays unsaved.
  const changes = useRef(0)
  const savedChanges = useRef(0)
  const [dirty, setDirtyState] = useState(false)
  const onDirtyRef = useRef(onDirtyChange); onDirtyRef.current = onDirtyChange
  const setDirty = useCallback((d) => {
    setDirtyState((was) => { if (was !== d) onDirtyRef.current?.(d); return d })
  }, [])

  // Latest of everything a save needs, read at the moment it runs.
  const live = useRef({})
  live.current = { doc, values, recordId, touched, source, onSave, controls, recordKey }

  // ── options for table dropdowns, fetched once per table ───────────────
  const [options, setOptions] = useState({})   // node id → { loading, items, error }
  const fetchOptionsRef = useRef(fetchOptions); fetchOptionsRef.current = fetchOptions
  useEffect(() => {
    let cancelled = false
    const tableNodes = optionNodes.filter((n) => CHOICE_TYPES.includes(n.type) && n.props.data?.source === 'table')
    if (!tableNodes.length) { setOptions({}); return undefined }
    setOptions(Object.fromEntries(tableNodes.map((n) => [n.id, { loading: true, items: [], error: null }])))
    const byTable = new Map()
    tableNodes.forEach((n) => {
      const t = n.props.data.table
      if (!byTable.has(t)) byTable.set(t, [])
      byTable.get(t).push(n)
    })
    byTable.forEach((nodes, table) => {
      const run = fetchOptionsRef.current
        ? Promise.resolve().then(() => fetchOptionsRef.current({ table, node: nodes[0] }))
        : Promise.reject(new Error(`No fetchOptions was provided to read "${table}"`))
      run
        .then((rows) => {
          const items = normaliseOptions(rows)
          if (!cancelled) setOptions((o) => ({ ...o, ...Object.fromEntries(nodes.map((n) => [n.id, { loading: false, items, error: null }])) }))
        })
        .catch((err) => {
          if (!cancelled) setOptions((o) => ({ ...o, ...Object.fromEntries(nodes.map((n) => [n.id, { loading: false, items: [], error: err.message || 'Could not load options' }])) }))
        })
    })
    return () => { cancelled = true }
  }, [optionNodes])

  // ── steps ─────────────────────────────────────────────────────────────
  // A stepper shows one step at a time. Which step each is open at lives here;
  // the fields of the steps not showing are still filled in, still checked and
  // still saved — a step is what the person sees, not a separate form.
  const [openSteps, setOpenSteps] = useState({})
  // Steps the app has switched off — { stepper id: [index, …] }. A screen may
  // have branches; which of them apply is the app's to say, from its hooks.
  const [disabledSteps, setDisabledSteps] = useState({})
  const stepperNodes = useMemo(() => (check.ok ? steppers(doc, controls) : []), [check.ok, doc, controls])
  const visibleNodes = useMemo(() => (check.ok ? nodesForSteps(doc, openSteps, controls) : []), [check.ok, doc, openSteps, controls])

  // A screen whose steps changed under it (a field moved to another step, a
  // step removed) must not stay open at a step that is gone.
  useEffect(() => {
    setOpenSteps((open) => {
      let changed = false
      const next = {}
      stepperNodes.forEach((n) => {
        const count = stepsOf(n).length
        const at = Number.isInteger(open[n.id]) ? open[n.id] : 0
        next[n.id] = Math.min(Math.max(at, 0), Math.max(count - 1, 0))
        if (next[n.id] !== open[n.id]) changed = true
      })
      return changed || Object.keys(next).length !== Object.keys(open).length ? next : open
    })
  }, [stepperNodes])

  const stepControl = useMemo(() => {
    const at = (id) => (Number.isInteger(openSteps[id]) ? openSteps[id] : 0)
    const only = () => (stepperNodes.length === 1 ? stepperNodes[0].id : null)
    const nodeFor = (id) => stepperNodes.find((n) => n.id === id) || stepperNodes[0] || null
    const lastOf = (id) => stepsOf(nodeFor(id)).length - 1
    /** A step named by its key ("planning"), its label, or its number from 0. */
    const indexOf = (id, which) => resolveStep(stepsOf(nodeFor(id)), which)
    const offList = (id) => disabledSteps[id] || []
    const isOff = (id, index) => offList(id).includes(index)
    const reachable = (id, index, direction) => reachableStep(lastOf(id) + 1, index, offList(id), direction, at(id))
    const setOff = (id, list) => setDisabledSteps((d) => ({ ...d, [id || only()]: list }))

    const control = {
      nodes: stepperNodes,
      active: at,
      count: (id) => stepsOf(nodeFor(id)).length,
      labels: (id) => stepsOf(nodeFor(id)),
      indexOf,
      /** Is this step switched off — shown, but not one you can be on? */
      isDisabled: (id, index) => isOff(id, index),
      disabled: (id) => (disabledSteps[id || only()] || []).slice(),
      /**
       * Switch steps off (a key, a number, or a list of them). A step that is
       * off cannot be reached by Next, Back or a click, and Next passes over
       * it. Switching off the step someone is on moves them to the nearest one
       * that is open.
       */
      disable: (which, id) => {
        const on = id || only()
        if (!on) return []
        const add = (Array.isArray(which) ? which : [which]).map((w) => indexOf(on, w)).filter((i) => i >= 0)
        const next = [...new Set([...(disabledSteps[on] || []), ...add])]
        setOff(on, next)
        return next
      },
      /** Switch them back on. No arguments switches every step of it back on. */
      enable: (which, id) => {
        const on = id || only()
        if (!on) return []
        if (which === undefined) { setOff(on, []); return [] }
        const drop = (Array.isArray(which) ? which : [which]).map((w) => indexOf(on, w))
        const next = (disabledSteps[on] || []).filter((i) => !drop.includes(i))
        setOff(on, next)
        return next
      },
      /**
       * Move, if the app's `step` hook lets it: false keeps the person where
       * they are, a number sends them somewhere else. The hook runs for Next,
       * Back and a click on the bar alike, so a rule cannot be walked around.
       */
      go: async (id, index, direction) => {
        const on = id || only()
        const from = at(on)
        const way = direction || (index > from ? 'next' : 'back')
        const to = reachable(on, indexOf(on, index), way)
        if (to === from) return from
        const decide = hookMethod(hooksRef.current, 'step')
        const answer = await decide({
          from,
          to,
          direction: way,
          values: live.current.values,
          stepper: on,
          screen: doc.id,
          document: doc,
          // What the hook can DO from here: send them somewhere, or say which
          // steps this answer makes beside the point.
          steps: control,
          go: (where) => control.go(on, where, 'jump'),
          disable: (which) => control.disable(which, on),
          enable: (which) => control.enable(which, on)
        })
        if (answer === false) return from
        const asked = Number.isInteger(answer) || typeof answer === 'string' ? indexOf(on, answer) : to
        const where = reachable(on, asked >= 0 ? asked : to, way)
        setOpenSteps((o) => ({ ...o, [on]: where }))
        return where
      },
      /** The next step in this direction that is open, for Back and Next. */
      nextOpen: (id, direction) => {
        const on = id || only()
        return nextOpenStep(lastOf(on) + 1, at(on), offList(on), direction)
      },
      /** The fields on this step, so Next can hold at a step that is not filled in. */
      fieldsOn: (id, index) => inputNodes(doc, controls).filter((n) => {
        const step = stepOf(n)
        return step && step.of === (id || only()) && step.index === index
      })
    }
    return control
  }, [stepperNodes, openSteps, disabledSteps, doc, controls])

  live.current.steps = stepControl

  // A step that is switched off cannot be the one showing.
  useEffect(() => {
    stepperNodes.forEach((n) => {
      if (stepControl.isDisabled(n.id, stepControl.active(n.id))) stepControl.go(n.id, stepControl.active(n.id) + 1, 'next')
    })
  }, [stepperNodes, stepControl])

  // ── a file field's upload ─────────────────────────────────────────────
  const uploadRef = useRef(uploadFile); uploadRef.current = uploadFile
  const upload = useCallback(async (file, node) => {
    if (!uploadRef.current) throw new Error('No uploadFile was provided, so a file cannot be attached')
    const out = await uploadRef.current(file, { screen: doc.id, field: node.props.name, node })
    if (!out || !out.path) throw new Error('The upload did not answer with the stored file')
    return out
  }, [doc.id])

  const optionsFor = useCallback((node) => {
    if (node.props.data?.source === 'static') return { loading: false, items: node.props.data.options, error: null }
    return options[node.id] || { loading: false, items: [], error: null }
  }, [options])

  const loadedItems = useMemo(() => {
    const map = {}
    Object.entries(options).forEach(([id, o]) => { if (!o.loading && !o.error) map[id] = o.items })
    return map
  }, [options])
  live.current.loadedItems = loadedItems

  const state = useMemo(() => (check.ok ? saveState(doc, values, touched, loadedItems, controls) : { canSave: false, status: 'invalid', errors: {}, shown: {} }),
    [check.ok, doc, values, touched, loadedItems, controls])

  // ── saving ────────────────────────────────────────────────────────────
  const inFlight = useRef(null)     // the promise of the save running now

  /** Save — what the Save button does. One AJAX call; never on its own. */
  const runSave = useCallback(async () => {
    if (inFlight.current) return inFlight.current
    const l = live.current
    const st = saveState(l.doc, l.values, l.touched, l.loadedItems, l.controls)
    if (!st.canSave) {
      // Pressing Save is the moment to say what is missing — on every field,
      // including the ones nobody has been in yet.
      const t = new Set([...l.touched, ...Object.keys(st.errors)])
      live.current.touched = t
      setTouched(t)
      setStatus('invalid')
      return { ok: false, errors: st.errors }
    }
    const customSave = hooksRef.current && typeof hooksRef.current.save === 'function'
    const writing = changes.current
    if (!l.onSave && !customSave) { savedChanges.current = writing; setDirty(false); setStatus('saved'); return { ok: true } }

    setStatus('saving')
    setSaveError(null)
    const task = (async () => {
      try {
        const meta = { id: l.recordId, source: l.source, screen: l.doc.id, document: l.doc }
        const saved = await hook('save')(l.values, {
          ...meta,
          isNew: l.recordId === null || l.recordId === undefined,
          // Save is where an app usually learns which branch it is on, so it
          // can switch steps off from here as well as from step().
          steps: live.current.steps,
          defaults: { save: (vals) => (l.onSave ? l.onSave(vals, meta) : undefined) }
        })
        // A new record's first save creates it; its id makes the next save an update.
        if (saved && typeof saved === 'object' && saved[l.recordKey] !== undefined && saved[l.recordKey] !== null) {
          setRecordId(saved[l.recordKey])
          live.current.recordId = saved[l.recordKey]
        }
        savedChanges.current = writing
        const still = changes.current !== writing
        setDirty(still)
        setSavedAt(new Date())
        setListVersion((v) => v + 1)
        setStatus(still ? 'pending' : 'saved')
        return { ok: true, record: saved }
      } catch (err) {
        const onFields = Array.isArray(err.fields) ? err.fields.filter((f) => f && f.field && f.message) : []
        if (onFields.length) {
          setServerErrors(Object.fromEntries(onFields.map((f) => [f.field, f.message])))
          setStatus('invalid')
          setSaveError(null)
        } else {
          setSaveError(err.message || 'Could not save')
          setStatus('error')
        }
        return { ok: false, error: err }
      } finally {
        inFlight.current = null
      }
    })()
    inFlight.current = task
    return task
  }, [setDirty])

  /** Save if there is anything unsaved — what a flow's Next does before moving on. */
  const flush = useCallback(async () => {
    if (inFlight.current) await inFlight.current
    if (changes.current !== savedChanges.current) return runSave()
    return { ok: true }
  }, [runSave])

  /**
   * May the person leave? True when nothing is unsaved, or when they agree to
   * lose it. Cancel, the popup's × and opening another record all ask this.
   */
  const confirmDiscard = useCallback(() => {
    if (changes.current === savedChanges.current) return true
    // eslint-disable-next-line no-alert
    return typeof window === 'undefined' || window.confirm('Discard your unsaved changes?')
  }, [])

  // Closing the tab or reloading with unsaved changes: the browser's own prompt.
  useEffect(() => {
    if (!dirty || typeof window === 'undefined') return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // ── editing ───────────────────────────────────────────────────────────
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange
  const setValue = useCallback((node, raw) => {
    let value = parseInput(node, raw)
    if ((node.type === 'dropdown' || node.type === 'radio') && value !== undefined) value = optionValue(optionsFor(node).items, value)
    if (node.type === 'multiselect' && Array.isArray(value)) value = value.map((v) => optionValue(optionsFor(node).items, v))
    const name = node.props.name
    const next = { ...live.current.values }
    if (value === undefined) delete next[name]
    else next[name] = value
    live.current.values = next
    setValues(next)
    setServerErrors((e) => {
      if (!(name in e)) return e
      const rest = { ...e }
      delete rest[name]
      return rest
    })
    if (!live.current.touched.has(name)) {
      const t = new Set(live.current.touched); t.add(name)
      live.current.touched = t
      setTouched(t)
    }
    onChangeRef.current?.(next)
    changes.current += 1
    setDirty(true)
    setStatus('pending')
  }, [optionsFor, setDirty])

  /** Leaving a field shows its message, even if nothing was typed. */
  const touch = useCallback((node) => {
    const name = node.props.name
    if (live.current.touched.has(name)) return
    const t = new Set(live.current.touched); t.add(name)
    live.current.touched = t
    setTouched(t)
  }, [])

  /** Open a record (null: a new one). Unsaved changes are dropped — ask confirmDiscard first. */
  const openRecord = useCallback(async (rec) => {
    if (inFlight.current) await inFlight.current
    changes.current = 0
    savedChanges.current = 0
    setDirty(false)
    const next = startValues(rec)
    live.current.values = next
    live.current.recordId = rec ? rec[recordKey] ?? null : null
    live.current.touched = new Set()
    setValues(next)
    setRecordId(live.current.recordId)
    setTouched(new Set())
    setSaveError(null)
    setServerErrors({})
    setStatus('idle')
  }, [startValues, recordKey, setDirty])

  const newRecord = useCallback(() => openRecord(null), [openRecord])

  // A different document, or a different record handed in, starts over.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    if (!check.ok) return
    openRecord(record || null)
  }, [doc, record]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── lists ─────────────────────────────────────────────────────────────
  const [lists, setLists] = useState({})   // node id → { loading, rows, error }
  const fetchRecordsRef = useRef(fetchRecords); fetchRecordsRef.current = fetchRecords
  const listNodes = useMemo(() => (check.ok ? doc.nodes.filter((n) => n.type === 'list') : []), [doc, check.ok])
  useEffect(() => {
    if (!listNodes.length) return undefined
    let cancelled = false
    listNodes.forEach((node) => {
      const src = listSource(doc, node)
      setLists((l) => ({ ...l, [node.id]: { rows: l[node.id]?.rows || [], loading: true, error: null } }))
      const run = Promise.resolve().then(() => hook('get')({
        many: true, id: null, screen: doc.id, source: src, node, document: doc,
        steps: live.current.steps,
        defaults: {
          get: () => {
            if (!fetchRecordsRef.current) throw new Error(`No fetchRecords was provided to list "${src}"`)
            return fetchRecordsRef.current({ source: src, screen: doc.id, node })
          }
        }
      }))
      run
        .then((rows) => { if (!cancelled) setLists((l) => ({ ...l, [node.id]: { rows: Array.isArray(rows) ? rows : [], loading: false, error: null } })) })
        .catch((err) => { if (!cancelled) setLists((l) => ({ ...l, [node.id]: { rows: l[node.id]?.rows || [], loading: false, error: err.message || 'Could not load records' } })) })
    })
    return () => { cancelled = true }
  }, [listNodes, listVersion, doc])

  const listFor = useCallback((node) => lists[node.id] || { rows: [], loading: false, error: null }, [lists])

  /** Extra row buttons from hooks.actions — each onClick gets the row's record. */
  const actionsFor = useCallback((node) => {
    const ctx = { screen: doc.id, source: listSource(doc, node), node, document: doc, refresh: () => setListVersion((v) => v + 1) }
    let extra
    try { extra = hook('actions')(ctx) } catch (err) { console.error('[factory] hooks.actions failed:', err); extra = [] }
    return (Array.isArray(extra) ? extra : []).filter((a) => a && a.label && typeof a.onClick === 'function').map((a) => ({
      ...a,
      onClick: (rec) => Promise.resolve().then(() => a.onClick(rec, ctx)).catch((err) => {
        console.error('[factory] action "' + a.label + '" failed:', err)
        // eslint-disable-next-line no-alert
        if (typeof window !== 'undefined') window.alert(err.message || 'Could not ' + a.label)
      })
    }))
  }, [doc, lists])                                              // eslint-disable-line react-hooks/exhaustive-deps

  const onDeleteRef = useRef(onDelete); onDeleteRef.current = onDelete
  const deleteRecord = useCallback(async (node, rec) => {
    const id = rec ? rec[recordKey] : undefined
    await hook('delete')(rec, {
      id, source: listSource(doc, node), screen: doc.id, node, document: doc,
      defaults: {
        delete: (r) => {
          if (!onDeleteRef.current) throw new Error('No onDelete was provided')
          return onDeleteRef.current({ id: r ? r[recordKey] : id, source: listSource(doc, node), screen: doc.id, record: r })
        }
      }
    })
    // Deleting the record that is open leaves nothing to save into.
    if (id !== undefined && id === live.current.recordId) {
      await openRecord(null)
    }
    setListVersion((v) => v + 1)
  }, [doc, recordKey, openRecord])

  // ── popup: a list's Edit / New in its edit screen ─────────────────────
  const [popup, setPopup] = useState(null)   // { node, screenId, record, document, loading, error }
  const screensRef = useRef(knownScreens); screensRef.current = knownScreens
  const fetchRecordRef = useRef(fetchRecord); fetchRecordRef.current = fetchRecord
  const loadScreenRef = useRef(loadScreen); loadScreenRef.current = loadScreen

  /**
   * Edit (a record) or New (null) in the list's edit screen — in a popup, or
   * on a page of the app's own when the list says so. A page is the app's to
   * open: the factory has no router, so it asks.
   */
  const openRecordRef = useRef(onOpenRecord); openRecordRef.current = onOpenRecord
  const openEditor = useCallback(async (node, rec) => {
    const screenId = node.props.editScreen
    if (node.props.openIn === 'page') {
      if (!openRecordRef.current) throw new Error('This list opens records on a page, but no onOpenRecord was provided to go there')
      const id = rec ? rec[live.current.recordKey] : null
      return openRecordRef.current({ screen: screenId, id, record: rec || null, source: listSource(doc, node), node })
    }
    const base = { node, screenId, record: rec || null, document: null, loading: true, error: null }
    setPopup(base)
    try {
      let found = screensRef.current && screensRef.current[screenId]
      if (!found && loadScreenRef.current) found = await loadScreenRef.current(screenId)
      if (!found) throw new Error(`Screen "${screenId}" was not provided — pass it in \`screens\` or supply loadScreen`)
      const checked = validateDocument(found, live.current.controls)
      if (!checked.ok) throw new Error(`Screen "${screenId}" is not valid: ${checked.errors[0].path} ${checked.errors[0].message}`)
      // Edit opens the record as it is NOW, through the server's get hooks —
      // not the list's copy, which may be stale or shaped for the list.
      let fresh = rec || null
      if (rec && rec[live.current.recordKey] !== undefined) {
        const id = rec[live.current.recordKey]
        fresh = await hook('get')({
          many: false, id, screen: screenId, document: found,
          defaults: { get: () => (fetchRecordRef.current ? fetchRecordRef.current({ screen: screenId, id }) : rec) }
        })
      }
      setPopup((p) => (p && p.screenId === screenId ? { ...p, document: found, record: fresh, loading: false } : p))
    } catch (err) {
      setPopup((p) => (p && p.screenId === screenId ? { ...p, loading: false, error: err.message } : p))
    }
  }, [])

  const closeEditor = useCallback(() => {
    setPopup(null)
    setListVersion((v) => v + 1)
  }, [])

  /** The popup's saves go to the host's onSave, and refresh the list behind it. */
  const onSaveRef = useRef(onSave); onSaveRef.current = onSave
  const popupSave = useCallback(async (vals, meta) => {
    const saved = onSaveRef.current ? await onSaveRef.current(vals, meta) : undefined
    setListVersion((v) => v + 1)
    return saved
  }, [])

  return {
    document: doc,
    documentErrors: check.errors,
    popup,
    fieldsFor,
    openEditor,
    closeEditor,
    popupSave,
    values,
    recordId,
    errors: { ...state.shown, ...serverErrors },
    allErrors: state.errors,
    status,
    saveError,
    savedAt,
    setValue,
    touch,
    optionsFor,
    done: onDone || null,
    steps: stepControl,
    visibleNodes,
    upload,
    fileUrl,
    flush,
    save: runSave,
    saveNow: runSave,
    dirty,
    confirmDiscard,
    openRecord,
    newRecord,
    listFor,
    deleteRecord,
    recordKey,
    canDelete: Boolean(onDelete) || Boolean(hooks && typeof hooks.delete === 'function'),
    actionsFor,
    hooks
  }
}

/** Rows from the host → [{ id, name }]. Anything else on a row is ignored. */
export function normaliseOptions(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.id !== undefined && r.id !== null)
    .map((r) => ({ id: r.id, name: r.name == null ? String(r.id) : String(r.name) }))
}
