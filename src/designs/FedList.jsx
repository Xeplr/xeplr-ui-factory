import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XeplrTable } from '@xeplr/ui-table'
import { boxStyle, fieldStyle } from './styles.js'
import { rangePresets, customRange, isDay } from '../listRange.js'
import { BADGE_TONES } from '../buttons.js'
import { Icon } from './icons.jsx'

// A LIST WHOSE ROWS A FUNCTION WORKS OUT (rowsFrom) — live, in @xeplr/ui-table.
//
// Everything it shows is TEXT THE SERVER WROTE: a column sorts by its `field`
// and shows its `text` field, so "Today, 4:00 pm" or "2d 3h" is said once, by
// the app that knows its time zone and its words, and reads the same in any
// renderer. What this file draws is only how: a second line, badges, the
// pictures, an activity line with its hover box.
//
// Above the rows: a date range and KPI cards (a dashboard), then the search
// box and the filter chips, each card and chip with the count the function
// gave it. A card is a filter too: a click shows its rows, another lets go.
//
// The rows are a table, or (layout "cards") a card each: the first column is
// the heading, an "items" column the pictures — large, to be recognised at a
// glance — and every other column a line under its label.
// Presentation only — the query, the rows and what a click does arrive as props.

const OPEN_DELAY_MS = 250
const CLOSE_DELAY_MS = 200
const BOX_WIDTH = 380
const BOX_MAX_HEIGHT = 360
const MIN_BELOW = 200

export default function FedList({ node, list, query, onOpen, rowDetails, recordKey = 'id', extraActions = [] }) {
  const p = node.props || {}
  const columns = Array.isArray(p.columns) ? p.columns : []
  const rows = list.rows || []
  const counts = list.counts || {}
  const chips = Array.isArray(p.filters) ? p.filters : []
  const active = query.filter || (chips[0] && chips[0].key) || ''
  const pageSize = p.pageSize || 10
  const style = { ...fieldStyle(p.style), ...boxStyle(p.style) }

  // The search box shows what is typed at once; the controller asks after a pause.
  const [typed, setTyped] = useState(query.q)
  useEffect(() => { setTyped(query.q) }, [query.q])

  const open = p.rowOpen || (p.actions || []).includes('edit') ? onOpen : null

  const rowActions = []
  if ((p.actions || []).includes('edit')) rowActions.push({ key: 'edit', label: 'Edit', onClick: (row) => onOpen(row) })
  extraActions.forEach((a, i) => rowActions.push({ key: 'extra-' + i + '-' + a.label, label: a.label, variant: a.variant, onClick: (row) => a.onClick(row) }))

  const schema = {
    0: {
      key: node.id,
      columns: columns.map((c, i) => ({
        accessor: c.field,
        // An icon before the label makes the header an element; its width is measured by the label.
        header: c.icon ? () => <span className="xeplr-factory-col-head"><Icon name={c.icon} />{c.label}</span> : c.label,
        headerText: c.label,
        enableSorting: c.sortable !== false,
        cell: ({ row }) => (
          <Cell column={c} row={row.original} index={row.index} first={i === 0} open={open}
                details={c.display === 'activity' && c.details ? () => rowDetails(node, c, row.original[recordKey]) : null}
                onOpenAt={open ? (where) => open(row.original, where) : null} />
        )
      }))
    }
  }

  // A click anywhere on a row opens it; the first cell is also a real button,
  // for the keyboard. Clicks on the row's own buttons and links are theirs.
  function openFromRow(e) {
    if (!open || e.target.closest('button, a, input, select, .xeplr-factory-activity-box')) return
    const tr = e.target.closest('tbody tr')
    const marker = tr && tr.querySelector('[data-xf-row]')
    if (marker) open(rows[Number(marker.getAttribute('data-xf-row'))])
  }

  const kpis = Array.isArray(p.kpis) ? p.kpis : []
  const kpiCounts = list.kpis || {}
  const range = query.rangeFor ? query.rangeFor(node) : null

  return (
    <div className="xeplr-factory-list xeplr-factory-list--fed" style={style}>
      {(range || kpis.length > 0) && (
        <div className="xeplr-factory-dash">
          {range && <RangePicker label={p.dateRange.label} presets={rangePresets(p.dateRange)} range={range} onChange={query.setDates} />}
          {kpis.length > 0 && (
            <div className="xeplr-factory-kpis" role="group" aria-label={p.title ? `${p.title} at a glance` : 'At a glance'}>
              {kpis.map((k) => {
                const on = query.kpi === k.key
                const n = kpiCounts[k.key]
                return (
                  <button
                    key={k.key}
                    type="button"
                    aria-pressed={on}
                    className={`xeplr-factory-kpi xeplr-factory-kpi--${k.tone || 'accent'}${on ? ' is-on' : ''}`}
                    onClick={() => query.setKpi(on ? '' : k.key)}
                  >
                    <span className="xeplr-factory-kpi-count">{n === undefined ? '—' : n}</span>
                    <span className="xeplr-factory-kpi-label">{k.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      <div className="xeplr-factory-list-tools">
        {p.title && <span className="xeplr-factory-list-title">{p.title}</span>}
        {p.search && p.search.placeholder && (
          <input
            type="search"
            className="xeplr-factory-list-search"
            aria-label={p.search.placeholder}
            placeholder={p.search.placeholder}
            value={typed}
            maxLength={200}
            onChange={(e) => { setTyped(e.target.value); query.setQ(e.target.value) }}
          />
        )}
        {chips.length > 0 && (
          <div className="xeplr-factory-chips" role="tablist" aria-label={p.title ? `Filter ${p.title}` : 'Filter'}>
            {chips.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={f.key === active}
                className={'xeplr-factory-chip' + (f.key === active ? ' is-on' : '')}
                onClick={() => query.setFilter(f.key === (chips[0] && chips[0].key) ? '' : f.key)}
              >
                {f.label}
                {counts[f.key] !== undefined && <span className="xeplr-factory-chip-count">{counts[f.key]}</span>}
              </button>
            ))}
          </div>
        )}
        {list.loading && <span className="xeplr-factory-hint">Loading…</span>}
        {list.error && <span className="xeplr-factory-error-inline" role="alert">{list.error}</span>}
      </div>
      {rows.length === 0
        ? !list.loading && !list.error && <div className="xeplr-factory-list-empty">{query.q || query.kpi || (range && range.from) ? 'Nothing matches.' : 'Nothing here yet.'}</div>
        : p.layout === 'cards'
          ? <Cards rows={rows} columns={columns} pageSize={pageSize} open={open} highlight={p.highlight} dim={p.dim} />
          : (
          <div className={'xeplr-factory-fed-table' + (open ? ' is-openable' : '')} onClick={openFromRow}>
            <XeplrTable
              data={rows}
              schema={schema}
              showToolbar={false}
              enableFiltering={false}
              pageSize={pageSize}
              enablePagination={rows.length > pageSize}
              rowActions={rowActions.length ? rowActions : undefined}
              rowClassName={(row) => [p.highlight && row && row[p.highlight] ? 'xeplr-factory-row-marked' : '', p.dim && row && row[p.dim] ? 'xeplr-factory-row-dim' : ''].filter(Boolean).join(' ') || null}
            />
          </div>
        )}
    </div>
  )
}

/** From–To: a preset, or two days typed. Whatever is chosen is kept as one value. */
function RangePicker({ label, presets, range, onChange }) {
  const custom = !range.preset
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  useEffect(() => { setFrom(range.from); setTo(range.to) }, [range.from, range.to])
  const typed = (f, t) => {
    setFrom(f); setTo(t)
    if ((f === '' || isDay(f)) && (t === '' || isDay(t)) && !(f && t && f > t)) onChange(customRange(f, t))
  }
  return (
    <div className="xeplr-factory-range" role="group" aria-label={label ? `${label} between` : 'Dates'}>
      {label && <span className="xeplr-factory-range-label">{label}</span>}
      <select
        className="xeplr-factory-range-preset"
        aria-label={label ? `${label}: range` : 'Range'}
        value={custom ? 'custom' : range.preset}
        onChange={(e) => onChange(e.target.value === 'custom' ? customRange(range.from, range.to) : e.target.value)}
      >
        {presets.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        <option value="custom">Between…</option>
      </select>
      {(custom || range.from || range.to) && (
        <span className="xeplr-factory-range-days">
          <input type="date" className="xeplr-factory-range-day" aria-label="From" value={from} max={to || undefined}
                 onChange={(e) => typed(e.target.value, to)} />
          <span aria-hidden="true">–</span>
          <input type="date" className="xeplr-factory-range-day" aria-label="To" value={to} min={from || undefined}
                 onChange={(e) => typed(from, e.target.value)} />
        </span>
      )}
    </div>
  )
}

/** One cell: the server's text, and how this column draws it. */
function Cell({ column: c, row, index, first, open, details, onOpenAt }) {
  const value = row[c.field]
  const shown = c.text ? row[c.text] : value
  const badges = (c.badges || []).filter((b) => row[b.field])
  const marker = first ? { 'data-xf-row': index } : {}
  const cellTone = c.toneFrom && BADGE_TONES.includes(row[c.toneFrom]) ? row[c.toneFrom] : null
  const tone = cellTone && c.display !== 'chip' ? ' xeplr-factory-cell--' + cellTone : ''
  const bold = c.bold ? ' is-bold' : ''

  if (c.display === 'chip') {
    const zero = isNothing(value) && isNothing(shown)
    const t = zero ? 'zero' : (cellTone || c.tone || 'accent')
    const pill = <span className={'xeplr-factory-pill xeplr-factory-pill--' + t + bold}>{text(shown)}</span>
    if (first && open) return <button type="button" className="xeplr-factory-cell xeplr-factory-cell-open" onClick={(e) => { e.stopPropagation(); open(row) }} {...marker}>{pill}</button>
    return <span className="xeplr-factory-cell" {...marker}>{pill}</span>
  }

  if (c.display === 'images') {
    const pics = Array.isArray(value) ? value.filter((x) => x && x.src) : []
    const more = c.more ? Number(row[c.more]) || 0 : 0
    return (
      <span className="xeplr-factory-thumbs" {...marker}>
        {pics.map((img, n) => <img key={n} src={img.src} alt={img.name || ''} title={img.name || ''} loading="lazy" />)}
        {more > 0 && <small>+{more}</small>}
      </span>
    )
  }

  if (c.display === 'items') {
    const items = itemsOf(value)
    return (
      <span className="xeplr-factory-items-line" {...marker}>
        {items.map((it, n) => (
          <span key={n} className="xeplr-factory-items-chip">
            {it.src && <img src={it.src} alt="" loading="lazy" />}
            <span>{[it.qty > 1 ? it.qty + ' ×' : '', it.name, it.detail].filter(Boolean).join(' ')}</span>
          </span>
        ))}
      </span>
    )
  }

  if (c.display === 'activity') {
    return <Activity text={text(shown)} details={details} onOpenAt={onOpenAt} marker={marker} />
  }

  const body = (
    <>
      <span className="xeplr-factory-cell-main">{text(shown)}</span>
      {badges.map((b) => <span key={b.field} className={`xeplr-factory-badge xeplr-factory-badge--${b.tone || 'accent'}`}>{b.label}</span>)}
      {c.sub && row[c.sub] !== undefined && row[c.sub] !== null && row[c.sub] !== '' && <span className="xeplr-factory-cell-sub">{text(row[c.sub])}</span>}
    </>
  )
  // The first cell of a row that opens is a button: the keyboard's way in.
  if (first && open) {
    return <button type="button" className={'xeplr-factory-cell xeplr-factory-cell-open' + tone + bold} onClick={(e) => { e.stopPropagation(); open(row) }} {...marker}>{body}</button>
  }
  return <span className={'xeplr-factory-cell' + tone + bold} {...marker}>{body}</span>
}

/** 0, empty or nothing: a chip with no tone. */
function isNothing(v) {
  return v === null || v === undefined || v === '' || v === 0 || v === '0'
}

/** An "items" value: [{ src, name, detail, qty }], anything else dropped. */
function itemsOf(value) {
  return (Array.isArray(value) ? value : []).filter((x) => x && typeof x === 'object' && (x.src || x.name))
    .map((x) => ({ src: x.src || '', name: text(x.name), detail: text(x.detail), qty: Number(x.qty) || 0 }))
}

/**
 * A CARD PER ROW. The first column is the heading (a button when rows open —
 * the keyboard's way in; a tap anywhere else on the card opens it too), with
 * its badges; an "items" column draws each thing large, with its name, its
 * detail and how many; the other columns are lines under their labels. The
 * first `pageSize` cards, then "Show more".
 */
function Cards({ rows, columns, pageSize, open, highlight, dim }) {
  const [shown, setShown] = useState(pageSize)
  const [head, ...rest] = columns
  const onCard = (e, row) => {
    if (!open || e.target.closest('button, a, input, select')) return
    open(row)
  }
  return (
    <div className="xeplr-factory-cards">
      {rows.slice(0, shown).map((row, i) => {
        const title = head ? text(head.text ? row[head.text] : row[head.field]) : ''
        const badges = head ? (head.badges || []).filter((b) => row[b.field]) : []
        return (
          <article
            key={row.id || i}
            className={'xeplr-factory-card' + (open ? ' is-openable' : '') + (highlight && row[highlight] ? ' is-marked' : '') + (dim && row[dim] ? ' is-dim' : '')}
            onClick={(e) => onCard(e, row)}
          >
            <header className="xeplr-factory-card-head">
              {open
                ? <button type="button" className="xeplr-factory-card-title" onClick={() => open(row)}>{title}</button>
                : <span className="xeplr-factory-card-title">{title}</span>}
              {badges.map((b) => <span key={b.field} className={`xeplr-factory-badge xeplr-factory-badge--${b.tone || 'accent'}`}>{b.label}</span>)}
              {head && head.sub && row[head.sub] ? <span className="xeplr-factory-card-sub">{text(row[head.sub])}</span> : null}
            </header>
            {rest.map((c) => <CardPart key={c.field} column={c} row={row} />)}
          </article>
        )
      })}
      {rows.length > shown && (
        <button type="button" className="xeplr-factory-cards-more" onClick={() => setShown((n) => n + pageSize)}>
          Show more ({rows.length - shown})
        </button>
      )}
    </div>
  )
}

function CardPart({ column: c, row }) {
  const value = row[c.field]
  if (c.display === 'items') {
    const items = itemsOf(value)
    if (!items.length) return null
    return (
      <ul className="xeplr-factory-card-items" aria-label={c.label || 'Items'}>
        {items.map((it, n) => (
          <li key={n} className="xeplr-factory-card-item">
            {it.src
              ? <img src={it.src} alt={it.name} loading="lazy" />
              : <span className="xeplr-factory-card-noimg" aria-hidden="true">No picture</span>}
            <span className="xeplr-factory-card-item-text">
              {it.qty > 0 && <span className="xeplr-factory-card-qty">{it.qty} ×</span>}
              <span className="xeplr-factory-card-item-name">{it.name}</span>
              {it.detail && <span className="xeplr-factory-card-item-detail">{it.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    )
  }
  if (c.display === 'images') {
    const pics = Array.isArray(value) ? value.filter((x) => x && x.src) : []
    if (!pics.length) return null
    return <span className="xeplr-factory-thumbs">{pics.map((img, n) => <img key={n} src={img.src} alt={img.name || ''} loading="lazy" />)}</span>
  }
  const shown = text(c.text ? row[c.text] : value)
  const sub = c.sub ? text(row[c.sub]) : ''
  if (!shown && !sub) return null
  return (
    <p className="xeplr-factory-card-line">
      {c.label && <span className="xeplr-factory-card-label">{c.label}</span>}
      <span>{[shown, sub].filter(Boolean).join(' · ')}</span>
    </p>
  )
}

function text(v) {
  if (v === undefined || v === null) return ''
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

/**
 * WHAT LAST HAPPENED, and a box with the latest few — on hover or focus,
 * loaded the first time and kept until the line changes. Drawn at the page's
 * root so the table's scrolling never clips it; under its cell, or above it
 * near the bottom of the window. A tap on a phone opens the row instead.
 */
function Activity({ text: line, details, onOpenAt, marker }) {
  const cellRef = useRef(null)
  const timer = useRef(null)
  const [box, setBox] = useState(null)              // { top, left, maxHeight, above }
  const [items, setItems] = useState(null)          // { line, list, error }

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => { setItems(null) }, [line])

  if (!details) return <span className="xeplr-factory-cell xeplr-factory-activity" {...marker}>{line}</span>

  function show() {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const r = cellRef.current && cellRef.current.getBoundingClientRect()
      if (!r) return
      const below = window.innerHeight - r.bottom - 16
      const above = below < MIN_BELOW
      const left = Math.max(8, Math.min(r.left, window.innerWidth - BOX_WIDTH - 8))
      setBox(above
        ? { left, bottom: window.innerHeight - r.top + 8, maxHeight: Math.min(BOX_MAX_HEIGHT, r.top - 16), above }
        : { left, top: r.bottom + 8, maxHeight: Math.min(BOX_MAX_HEIGHT, below), above })
      if (!items || items.line !== line) {
        details().then(
          (list) => setItems({ line, list: Array.isArray(list) ? list : [], error: null }),
          (err) => setItems({ line, list: [], error: err.message || 'Could not load' })
        )
      }
    }, OPEN_DELAY_MS)
  }
  function hide() {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setBox(null), CLOSE_DELAY_MS)
  }
  // Touch has no hover: a tap is the row's, which opens it.
  const hoverable = typeof window === 'undefined' || !window.matchMedia || !window.matchMedia('(hover: none)').matches

  return (
    <span
      ref={cellRef}
      className="xeplr-factory-cell xeplr-factory-activity"
      tabIndex={hoverable ? 0 : undefined}
      onMouseEnter={hoverable ? show : undefined}
      onMouseLeave={hoverable ? hide : undefined}
      onFocus={hoverable ? show : undefined}
      onBlur={hoverable ? hide : undefined}
      {...marker}
    >
      {line}
      {box && typeof document !== 'undefined' && createPortal(
        <div
          className="xeplr-factory-activity-box"
          role="dialog"
          aria-label="Latest activity"
          style={{ left: box.left, top: box.top, bottom: box.bottom, maxHeight: box.maxHeight, width: BOX_WIDTH }}
          onMouseEnter={() => clearTimeout(timer.current)}
          onMouseLeave={hide}
        >
          {!items && <div className="xeplr-factory-hint">Loading…</div>}
          {items && items.error && <div className="xeplr-factory-error-inline" role="alert">{items.error}</div>}
          {items && !items.error && !items.list.length && <div className="xeplr-factory-hint">Nothing yet.</div>}
          {items && items.list.map((it, i) => {
            const body = (
              <>
                <span className="xeplr-factory-activity-text">{text(it.text)}</span>
                {(it.sub || it.at) && <span className="xeplr-factory-activity-sub">{[it.sub, it.at].filter(Boolean).map(text).join(' · ')}</span>}
              </>
            )
            return it.open && onOpenAt
              ? <button key={i} type="button" className="xeplr-factory-activity-item" onClick={(e) => { e.stopPropagation(); setBox(null); onOpenAt(it.open) }}>{body}</button>
              : <div key={i} className="xeplr-factory-activity-item">{body}</div>
          })}
        </div>,
        document.body
      )}
    </span>
  )
}
