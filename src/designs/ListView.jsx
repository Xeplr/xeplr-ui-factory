import { XeplrTable } from '@xeplr/ui-table'
import { displayValue, listColumns, listSource } from '../values.js'
import { boxStyle, fieldStyle } from './styles.js'

// A list of the saved records, in @xeplr/ui-table.
//
// On the canvas (design) it is a still picture of the columns — there are no
// records while designing. Live, rows come from the host's fetchRecords.
// Edit and New open the list's edit screen in a popup (`editScreen`), or, for a
// list on a form, load the row into the form's own fields. Delete removes it.

export default function ListView({ node, doc, design, list, onEdit, onDelete, onNew, currentId, recordKey = 'id', canDelete, fieldNodes, optionsFor, extraActions = [] }) {
  const p = node.props || {}
  const columns = listColumns(doc, node)
  const actions = p.actions || ['new', 'edit', 'delete']
  const style = { ...fieldStyle(p.style), ...boxStyle(p.style) }

  if (design) {
    return (
      <div className="xeplr-factory-list xeplr-factory-list--design" style={style}>
        <div className="xeplr-factory-list-head">
          <span className="xeplr-factory-list-title">{p.title}</span>
          <span className="xeplr-factory-hint">from {listSource(doc, node) || 'no table'}</span>
          {actions.includes('new') && <span className="xeplr-factory-list-new">+ New</span>}
        </div>
        <table className="xeplr-factory-list-mock">
          <thead>
            <tr>
              {columns.map((c) => <th key={c.field}>{c.label}</th>)}
              {(actions.includes('edit') || actions.includes('delete')) && <th />}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((i) => (
              <tr key={i}>{columns.map((c) => <td key={c.field}><span className="xeplr-factory-list-bar" /></td>)}{(actions.includes('edit') || actions.includes('delete')) && <td />}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const byField = Object.fromEntries((fieldNodes || []).map((n) => [n.props.name, n]))
  // What the table shows: a dropdown's NAME and Yes/No — the raw record is kept
  // alongside, so Edit opens exactly what was saved.
  const rows = (list.rows || []).map((rec) => {
    const shown = { __record: rec }
    columns.forEach((c) => {
      const f = byField[c.field]
      shown[c.field] = displayValue(f, rec[c.field], f && f.type === 'dropdown' ? optionsFor(f).items : undefined)
    })
    return shown
  })

  const rowActions = []
  if (actions.includes('edit')) {
    rowActions.push({ key: 'edit', label: 'Edit', onClick: (row) => onEdit(row.__record) })
  }
  if (actions.includes('delete') && canDelete) {
    rowActions.push({
      key: 'delete',
      label: 'Delete',
      variant: 'danger',
      onClick: (row) => {
        // eslint-disable-next-line no-alert
        if (typeof window === 'undefined' || window.confirm('Delete this record?')) onDelete(row.__record)
      }
    })
  }

  // The app's own buttons (hooks.actions), after the built-in ones.
  extraActions.forEach((a, i) => {
    rowActions.push({ key: 'extra-' + i + '-' + a.label, label: a.label, variant: a.variant, onClick: (row) => a.onClick(row.__record) })
  })

  return (
    <div className="xeplr-factory-list" style={style}>
      <div className="xeplr-factory-list-head">
        <span className="xeplr-factory-list-title">{p.title}</span>
        {list.loading && <span className="xeplr-factory-hint">Loading…</span>}
        {list.error && <span className="xeplr-factory-error-inline" role="alert">{list.error}</span>}
        {actions.includes('new') && (
          <button type="button" className="xeplr-factory-list-new" onClick={onNew}>+ New</button>
        )}
      </div>
      {!list.loading && !list.error && rows.length === 0 ? (
        <div className="xeplr-factory-list-empty">Nothing saved yet.</div>
      ) : (
        <XeplrTable
          data={rows}
          schema={{ 0: { key: listSource(doc, node) || 'records', columns: columns.map((c) => ({ accessor: c.field, header: c.label })) } }}
          pageSize={p.pageSize || 10}
          rowActions={rowActions.length ? rowActions : undefined}
          rowClassName={(row) => (currentId !== null && currentId !== undefined && row.__record && row.__record[recordKey] === currentId ? 'xeplr-factory-row-open' : null)}
          enableFiltering={rows.length > 5}
        />
      )}
    </div>
  )
}
