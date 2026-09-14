import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CONTROLS } from './controls.js'
import { inputNodes } from './document.js'
import { validateDocument } from './validateDocument.js'
import { initialValues, parseInput, validateValues, fieldError, optionValue } from './values.js'

// A saved screen, running: its values, its dropdown options, validation and
// submit. No JSX — designs/ScreenSample.jsx draws it.
//
// The DATABASE IS THE HOST'S. A dropdown reading a table asks the host for its
// rows — `fetchOptions({ table })` → [{ id, name }] — and a submit hands the
// values to `onSubmit`. Nothing here knows where either goes.

/**
 * @param document      a valid screen document
 * @param fetchOptions  async ({ table, node }) → [{ id, name }]  — for table dropdowns
 * @param onSubmit      async (values, { document }) → void
 * @param values        initial values, e.g. the record being edited
 * @param controls      the control registry (default: the built-ins)
 */
export function useFactoryScreen({ document: doc, fetchOptions, onSubmit, values: provided, controls = CONTROLS } = {}) {
  const check = useMemo(() => validateDocument(doc, controls), [doc, controls])
  const inputs = useMemo(() => (check.ok ? inputNodes(doc, controls) : []), [doc, controls, check.ok])

  const [values, setValues] = useState(() => (check.ok ? initialValues(doc, provided, controls) : {}))
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // A different document or record starts the form over.
  const providedRef = useRef(provided); providedRef.current = provided
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    if (!check.ok) return
    setValues(initialValues(doc, providedRef.current, controls))
    setErrors({})
    setSubmitted(false)
    setSubmitError(null)
  }, [doc, provided, controls, check.ok])

  // ── options for table dropdowns, fetched once per table ───────────────
  const [options, setOptions] = useState({})   // node id → { loading, items, error }
  const fetchRef = useRef(fetchOptions); fetchRef.current = fetchOptions
  useEffect(() => {
    let cancelled = false
    const tableNodes = inputs.filter((n) => n.type === 'dropdown' && n.props.data?.source === 'table')
    if (!tableNodes.length) { setOptions({}); return undefined }
    setOptions(Object.fromEntries(tableNodes.map((n) => [n.id, { loading: true, items: [], error: null }])))
    const byTable = new Map()
    tableNodes.forEach((n) => {
      const t = n.props.data.table
      if (!byTable.has(t)) byTable.set(t, [])
      byTable.get(t).push(n)
    })
    byTable.forEach((nodes, table) => {
      const run = fetchRef.current
        ? Promise.resolve().then(() => fetchRef.current({ table, node: nodes[0] }))
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
  }, [inputs])

  /** The options a dropdown shows, whichever source they come from. */
  const optionsFor = useCallback((node) => {
    if (node.props.data?.source === 'static') return { loading: false, items: node.props.data.options, error: null }
    return options[node.id] || { loading: false, items: [], error: null }
  }, [options])

  const loadedItems = useMemo(() => {
    const map = {}
    Object.entries(options).forEach(([id, o]) => { if (!o.loading && !o.error) map[id] = o.items })
    return map
  }, [options])

  // ── editing ───────────────────────────────────────────────────────────
  const setValue = useCallback((node, raw) => {
    let value = parseInput(node, raw)
    if (node.type === 'dropdown' && value !== undefined) value = optionValue(optionsFor(node).items, value)
    setValues((v) => {
      const next = { ...v }
      if (value === undefined) delete next[node.props.name]
      else next[node.props.name] = value
      return next
    })
    // Once a submit has failed, errors follow the typing — the message goes
    // away the moment the field is fixed, not on the next click of Save.
    if (submitted) {
      setErrors((e) => {
        const msg = fieldError(node, value, loadedItems[node.id])
        const next = { ...e }
        if (msg) next[node.props.name] = msg
        else delete next[node.props.name]
        return next
      })
    }
  }, [submitted, optionsFor, loadedItems])

  const reset = useCallback(() => {
    setValues(initialValues(doc, providedRef.current, controls))
    setErrors({})
    setSubmitted(false)
    setSubmitError(null)
  }, [doc, controls])

  const onSubmitRef = useRef(onSubmit); onSubmitRef.current = onSubmit
  const submit = useCallback(async (e) => {
    e?.preventDefault?.()
    setSubmitted(true)
    setSubmitError(null)
    const found = validateValues(doc, values, controls, loadedItems)
    setErrors(found)
    if (Object.keys(found).length) return { ok: false, errors: found }
    if (!onSubmitRef.current) return { ok: true, values }
    setSubmitting(true)
    try {
      await onSubmitRef.current(values, { document: doc })
      return { ok: true, values }
    } catch (err) {
      setSubmitError(err.message || 'Could not submit')
      return { ok: false, error: err }
    } finally {
      setSubmitting(false)
    }
  }, [doc, values, controls, loadedItems])

  return {
    document: doc,
    documentErrors: check.errors,
    values,
    errors,
    setValue,
    optionsFor,
    submit,
    reset,
    submitting,
    submitError
  }
}

/** Rows from the host → [{ id, name }]. Anything else on a row is ignored. */
export function normaliseOptions(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.id !== undefined && r.id !== null)
    .map((r) => ({ id: r.id, name: r.name == null ? String(r.id) : String(r.name) }))
}
