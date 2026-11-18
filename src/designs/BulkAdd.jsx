import { useCallback, useEffect, useMemo, useState } from 'react'
import ScreenModal from './ScreenModal.jsx'
import { bulkFields, blankRow, isBlank, cellValue, isGridPaste, pastedRows, pasteInto, rowErrors, resolveChoices } from '../bulk.js'

// ADD SEVERAL — a list's `bulkAdd`: its edit screen's fields as a grid, one
// row per record, saved in one go. Paste from a spreadsheet into any cell and
// the rows and columns fill from there. Each row is saved as New would save
// it (the server's checks apply); rows that saved leave the grid, rows that
// did not stay with the reason. See src/bulk.js.

const START_ROWS = 5

export default function BulkAdd({ bulk, title, onClose }) {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [options, setOptions] = useState({})        // field name → [{ id, name }]
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState({})          // row index → { field: message }
  const [rowError, setRowError] = useState({})      // row index → the server's message
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    let gone = false
    bulk.loadScreen().then((d) => { if (!gone) setDoc(d) }, (e) => { if (!gone) setError(e.message || 'Could not open the form') })
    return () => { gone = true }
  }, [bulk])

  const { columns, skipped } = useMemo(() => (doc ? bulkFields(doc, bulk.params) : { columns: [], skipped: [] }), [doc, bulk.params])
  const blank = useMemo(() => (doc ? blankRow(doc, columns, bulk.params) : {}), [doc, columns, bulk.params])

  useEffect(() => {
    if (!doc) return
    setRows(Array.from({ length: START_ROWS }, () => ({ ...blank })))
    // A dropdown on a table: its rows, once, for the cells and for matching pasted names.
    columns.filter((n) => n.type === 'dropdown' || n.type === 'radio').forEach((n) => {
      const data = n.props.data || {}
      if (data.source === 'static') { setOptions((o) => ({ ...o, [n.props.name]: (data.options || []).map((x) => ({ id: x.id, name: x.label || x.name || String(x.id) })) })); return }
      if (data.table) bulk.fetchOptions(data.table, n).then((list) => setOptions((o) => ({ ...o, [n.props.name]: list })), () => {})
    })
  }, [doc]) // eslint-disable-line react-hooks/exhaustive-deps

  const optionsFor = useCallback((n) => options[n.props.name], [options])
  // Names pasted before a table's options arrived: matched once they are here.
  useEffect(() => { setRows((rs) => { const next = rs.map((r) => resolveChoices(r, columns, optionsFor)); return next.some((r, i) => r !== rs[i]) ? next : rs }) }, [optionsFor, columns])

  const setCell = (i, n, value) => {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, [n.props.name]: value } : r)))
    setErrors((es) => { if (!es[i] || !es[i][n.props.name]) return es; const row = { ...es[i] }; delete row[n.props.name]; return { ...es, [i]: row } })
  }

  const onPaste = (i, c) => (e) => {
    const text = e.clipboardData && e.clipboardData.getData('text')
    if (!isGridPaste(text)) return
    e.preventDefault()
    setRows((rs) => pasteInto(rs, i, c, pastedRows(text), columns, optionsFor, blank))
  }

  const filled = rows.filter((r) => !isBlank(r, blank)).length

  async function saveAll() {
    const found = rowErrors(rows, columns, optionsFor, blank)
    setErrors(found)
    setRowError({})
    if (Object.keys(found).length) return
    setSaving(true)
    const kept = []
    const failed = {}
    let saved = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (isBlank(row, blank)) continue
      try {
        await bulk.save({ ...(bulk.params || {}), ...row })
        saved += 1
      } catch (err) {
        failed[kept.length] = err.message || 'Could not save'
        kept.push(row)
      }
    }
    setSaving(false)
    setSavedCount((n) => n + saved)
    if (saved) bulk.done()
    if (!kept.length) { onClose(); return }
    setRows(kept)
    setErrors({})
    setRowError(failed)
  }

  const header = title ? `${title} — add several` : 'Add several'
  return (
    <ScreenModal title={header} width={Math.max(640, columns.length * 170 + 60)} onClose={saving ? () => {} : onClose}>
      {error && <div className="xeplr-factory-error-inline" role="alert">{error}</div>}
      {!doc && !error && <div className="xeplr-factory-hint">Loading…</div>}
      {doc && (
        <div className="xeplr-factory-bulk">
          <p className="xeplr-factory-hint">
            One row per record. Paste rows from a spreadsheet into any cell to fill the grid from there; empty rows are left out.
            {skipped.length > 0 && <> {skipped.map((n) => n.props.label || n.props.name).join(', ')}: add {skipped.length === 1 ? 'it' : 'them'} afterwards with Edit.</>}
          </p>
          <div className="xeplr-factory-bulk-scroll">
            <table className="xeplr-factory-bulk-grid">
              <thead>
                <tr>
                  <th className="xeplr-factory-bulk-n">#</th>
                  {columns.map((n) => <th key={n.id}>{n.props.label || n.props.name}{n.props.required ? ' *' : ''}</th>)}
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={rowError[i] ? 'has-error' : undefined}>
                    <td className="xeplr-factory-bulk-n">{i + 1}</td>
                    {columns.map((n, c) => {
                      const msg = errors[i] && errors[i][n.props.name]
                      return (
                        <td key={n.id} className={msg ? 'has-error' : undefined} title={msg || undefined}>
                          <Cell node={n} value={row[n.props.name]} options={options[n.props.name]} onChange={(v) => setCell(i, n, v)} onPaste={onPaste(i, c)} label={`${n.props.label || n.props.name}, row ${i + 1}`} />
                          {msg && <span className="xeplr-factory-bulk-msg">{msg}</span>}
                        </td>
                      )
                    })}
                    <td>
                      <button type="button" className="xeplr-factory-bulk-remove" aria-label={`Remove row ${i + 1}`}
                        onClick={() => { setRows((rs) => rs.filter((_, k) => k !== i)); setErrors({}); setRowError({}) }}>×</button>
                    </td>
                  </tr>
                ))}
                {Object.keys(rowError).length > 0 && rows.map((_, i) => rowError[i] && (
                  <tr key={'e' + i} className="xeplr-factory-bulk-rowerr"><td /><td colSpan={columns.length + 1} role="alert">Row {i + 1}: {rowError[i]}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="xeplr-factory-bulk-foot">
            <button type="button" className="xeplr-factory-secondary" onClick={() => setRows((rs) => rs.concat(Array.from({ length: START_ROWS }, () => ({ ...blank }))))} disabled={saving}>+ {START_ROWS} rows</button>
            <div className="xeplr-factory-bulk-foot-mid">
              {savedCount > 0 && <span className="xeplr-factory-hint">Saved {savedCount}. </span>}
              {Object.keys(errors).length > 0 && <span className="xeplr-factory-error-inline" role="alert">Some rows need fixing — nothing was saved.</span>}
            </div>
            <button type="button" className="xeplr-factory-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="xeplr-factory-primary" onClick={saveAll} disabled={saving || !filled}>
              {saving ? 'Saving…' : filled ? `Save ${filled}` : 'Save'}
            </button>
          </div>
        </div>
      )}
    </ScreenModal>
  )
}

/** One cell: the field's own kind of input, small. */
function Cell({ node, value, options, onChange, onPaste, label }) {
  const p = node.props
  const common = { 'aria-label': label, onPaste, className: 'xeplr-factory-bulk-input' }
  if (node.type === 'checkbox') {
    return <input type="checkbox" aria-label={label} checked={value === true} onChange={(e) => onChange(e.target.checked)} onPaste={onPaste} />
  }
  if (node.type === 'dropdown' || node.type === 'radio') {
    return (
      <select {...common} value={value === undefined || value === null ? '' : String(value)} onChange={(e) => {
        const hit = (options || []).find((o) => String(o.id) === e.target.value)
        onChange(e.target.value === '' ? undefined : hit ? hit.id : e.target.value)
      }}>
        <option value="">{p.placeholder || 'Select…'}</option>
        {(options || []).map((o) => <option key={String(o.id)} value={String(o.id)}>{o.name}</option>)}
        {value !== undefined && value !== '' && !(options || []).some((o) => String(o.id) === String(value)) && <option value={String(value)}>{String(value)} (not an option)</option>}
      </select>
    )
  }
  const type = node.type === 'number' ? 'number' : node.type === 'date' ? 'date' : node.type === 'datetime' ? 'datetime-local' : p.inputType || 'text'
  return (
    <input {...common} type={type} value={value === undefined || value === null ? '' : String(value)}
      onChange={(e) => onChange(cellValue(node, e.target.value, options))} />
  )
}
