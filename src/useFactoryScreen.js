import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CONTROLS } from './controls.js'
import { inputNodes } from './document.js'
import { validateDocument } from './validateDocument.js'
import { initialValues, parseInput, saveState, fieldError, optionValue, recordValues, listSource } from './values.js'

// A saved screen, running. No JSX — designs/ScreenSample.jsx draws it.
//
// ── NO SUBMIT ────────────────────────────────────────────────────────────
// The screen saves ITSELF, in the background, a moment after the person stops
// changing something — once what is entered is acceptable. There is no button
// to press and no page to post. The first save of a new record creates it
// (the host hands back its id); every save after that updates the same record.
//
// ── THE DATABASE IS THE HOST'S ───────────────────────────────────────────
// Everything that reads or writes data is a call the host supplies:
//   onSave(values, { id, source, screen, document })   → the saved record (with its id)
//   fetchRecords({ source, screen, node })             → rows, for a list
//   onDelete({ id, source, screen, record })
//   fetchOptions({ table, node })              → [{ id, name }], for a table dropdown
//
// ── LIST → EDIT IN A POPUP ───────────────────────────────────────────────
// A list whose `editScreen` names another screen opens that screen in a popup
// for Edit and New. The screen comes from `screens` ({ id → document }) or the
// host's `loadScreen(id)`. The list refreshes as the popup saves.

/** Quiet time after the last change before a save goes out. */
export const AUTOSAVE_DELAY = 700

/**
 * @param document      a valid screen document
 * @param record        the record to open, e.g. { id: 7, firstName: 'Ada' } — omit for a new one
 * @param recordKey     the id field on a record (default 'id')
 * @param onSave        async (values, { id, source, document }) → saved record | void
 * @param fetchOptions  async ({ table, node }) → [{ id, name }]
 * @param fetchRecords  async ({ source, node }) → records, for lists
 * @param onDelete      async ({ id, source, record }) → void
 * @param onChange      (values) → void — every change, before any save
 * @param fetchRecord   async ({ screen, id }) → record — Edit loads the record fresh (through the server's get hooks)
 * @param screens       { id → document } — screens a list's Edit / New can open
 * @param loadScreen    async (id) → document — for screens not in `screens`
 * @param autosaveDelay ms (default 700)
 * @param controls      the control registry (default: the built-ins)
 */
export function useFactoryScreen({
  document: doc, record, recordKey = 'id', onSave, fetchOptions, fetchRecords, fetchRecord, onDelete, onChange, screens, loadScreen,
  autosaveDelay = AUTOSAVE_DELAY, controls = CONTROLS
} = {}) {
  const check = useMemo(() => validateDocument(doc, controls), [doc, controls])
  const inputs = useMemo(() => (check.ok ? inputNodes(doc, controls) : []), [doc, controls, check.ok])

  // A LIST SCREEN has no fields of its own; what its columns mean — that
  // `department` is a dropdown whose 2 reads "Finance" — lives on the screen it
  // edits in. Those fields are borrowed for display, and their table options
  // loaded alongside this screen's own.
  const fieldsFor = useCallback((node) => {
    if (inputs.length || !node || !node.props.editScreen) return inputs
    const editDoc = screens && screens[node.props.editScreen]
    return editDoc && validateDocument(editDoc, controls).ok ? inputNodes(editDoc, controls) : []
  }, [inputs, screens, controls])
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
  const [status, setStatus] = useState('idle')    // idle | pending | saving | saved | incomplete | invalid | error
  const [saveError, setSaveError] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const [listVersion, setListVersion] = useState(0)
  // Messages the SERVER put on fields — a hook's reject, a rule only it knows.
  // Shown like the form's own, and cleared as soon as that field is changed.
  const [serverErrors, setServerErrors] = useState({})

  // Latest of everything a delayed save needs, read at the moment it runs.
  const live = useRef({})
  live.current = { doc, values, recordId, touched, source, onSave, controls, recordKey }

  // ── options for table dropdowns, fetched once per table ───────────────
  const [options, setOptions] = useState({})   // node id → { loading, items, error }
  const fetchOptionsRef = useRef(fetchOptions); fetchOptionsRef.current = fetchOptions
  useEffect(() => {
    let cancelled = false
    const tableNodes = optionNodes.filter((n) => n.type === 'dropdown' && n.props.data?.source === 'table')
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
  const timer = useRef(null)
  const inFlight = useRef(null)     // the promise of the save running now
  const again = useRef(false)       // a change arrived while it ran

  const runSave = useCallback(async () => {
    clearTimeout(timer.current)
    timer.current = null
    if (inFlight.current) { again.current = true; return inFlight.current }
    const l = live.current
    const st = saveState(l.doc, l.values, l.touched, l.loadedItems, l.controls)
    if (!st.canSave) { setStatus(st.status); return { ok: false, errors: st.errors } }
    if (!l.onSave) { setStatus('saved'); return { ok: true } }

    setStatus('saving')
    setSaveError(null)
    const task = (async () => {
      try {
        const saved = await l.onSave(l.values, { id: l.recordId, source: l.source, screen: l.doc.id, document: l.doc })
        // A new record's first save creates it; its id makes the next save an update.
        if (saved && typeof saved === 'object' && saved[l.recordKey] !== undefined && saved[l.recordKey] !== null) {
          setRecordId(saved[l.recordKey])
          live.current.recordId = saved[l.recordKey]
        }
        setSavedAt(new Date())
        setListVersion((v) => v + 1)
        setStatus('saved')
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
        if (again.current) { again.current = false; schedule() }  // eslint-disable-line no-use-before-define
      }
    })()
    inFlight.current = task
    return task
  }, [])

  const schedule = useCallback(() => {
    clearTimeout(timer.current)
    setStatus('pending')
    timer.current = setTimeout(runSave, autosaveDelay)
  }, [runSave, autosaveDelay])

  /** Save any pending change right away — before opening another record, say. */
  const flush = useCallback(async () => {
    if (timer.current || again.current) return runSave()
    if (inFlight.current) return inFlight.current
    return { ok: true }
  }, [runSave])

  useEffect(() => () => clearTimeout(timer.current), [])

  // ── editing ───────────────────────────────────────────────────────────
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange
  const setValue = useCallback((node, raw) => {
    let value = parseInput(node, raw)
    if (node.type === 'dropdown' && value !== undefined) value = optionValue(optionsFor(node).items, value)
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
    schedule()
  }, [optionsFor, schedule])

  /** Leaving a field shows its message, even if nothing was typed. */
  const touch = useCallback((node) => {
    const name = node.props.name
    if (live.current.touched.has(name)) return
    const t = new Set(live.current.touched); t.add(name)
    live.current.touched = t
    setTouched(t)
  }, [])

  /** Open a record: whatever was pending is saved first. */
  const openRecord = useCallback(async (rec) => {
    await flush()
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
  }, [flush, startValues, recordKey])

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
      const run = fetchRecordsRef.current
        ? Promise.resolve().then(() => fetchRecordsRef.current({ source: src, screen: doc.id, node }))
        : Promise.reject(new Error(`No fetchRecords was provided to list "${src}"`))
      run
        .then((rows) => { if (!cancelled) setLists((l) => ({ ...l, [node.id]: { rows: Array.isArray(rows) ? rows : [], loading: false, error: null } })) })
        .catch((err) => { if (!cancelled) setLists((l) => ({ ...l, [node.id]: { rows: l[node.id]?.rows || [], loading: false, error: err.message || 'Could not load records' } })) })
    })
    return () => { cancelled = true }
  }, [listNodes, listVersion, doc])

  const listFor = useCallback((node) => lists[node.id] || { rows: [], loading: false, error: null }, [lists])

  const onDeleteRef = useRef(onDelete); onDeleteRef.current = onDelete
  const deleteRecord = useCallback(async (node, rec) => {
    const id = rec ? rec[recordKey] : undefined
    if (!onDeleteRef.current) throw new Error('No onDelete was provided')
    await onDeleteRef.current({ id, source: listSource(doc, node), screen: doc.id, record: rec })
    // Deleting the record that is open leaves nothing to save into.
    if (id !== undefined && id === live.current.recordId) {
      clearTimeout(timer.current); timer.current = null
      await openRecord(null)
    }
    setListVersion((v) => v + 1)
  }, [doc, recordKey, openRecord])

  // ── popup: a list's Edit / New in its edit screen ─────────────────────
  const [popup, setPopup] = useState(null)   // { node, screenId, record, document, loading, error }
  const screensRef = useRef(screens); screensRef.current = screens
  const fetchRecordRef = useRef(fetchRecord); fetchRecordRef.current = fetchRecord
  const loadScreenRef = useRef(loadScreen); loadScreenRef.current = loadScreen

  /** Edit (a record) or New (null) in the list's edit screen. */
  const openEditor = useCallback(async (node, rec) => {
    const screenId = node.props.editScreen
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
      if (rec && fetchRecordRef.current && rec[live.current.recordKey] !== undefined) {
        fresh = await fetchRecordRef.current({ screen: screenId, id: rec[live.current.recordKey] })
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
    flush,
    saveNow: runSave,
    openRecord,
    newRecord,
    listFor,
    deleteRecord,
    recordKey,
    canDelete: Boolean(onDelete)
  }
}

/** Rows from the host → [{ id, name }]. Anything else on a row is ignored. */
export function normaliseOptions(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.id !== undefined && r.id !== null)
    .map((r) => ({ id: r.id, name: r.name == null ? String(r.id) : String(r.name) }))
}
