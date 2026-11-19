import { boxStyle, fieldStyle } from './styles.js'
import { Steps } from './listExtras.jsx'

// A RECORD'S DETAILS, DRAWN — sections side by side (one under another on a
// phone), each a title and label / value rows or a list of items with their
// pictures; "More" opens what the function keeps for when it is asked.
// Presentation only: the sections and the asking are the controller's
// (useRecordDetails.js). On the canvas it shows what it will hold.

export default function DetailsView({ node, design, details }) {
  const p = node.props || {}
  const style = { ...fieldStyle(p.style), ...boxStyle(p.style), '--xf-details-columns': p.columns || 2 }

  if (design || !details) {
    return (
      <div className="xeplr-factory-details xeplr-factory-details--design" style={style}>
        {p.title && <div className="xeplr-factory-details-title">{p.title}</div>}
        <span className="xeplr-factory-hint">
          {p.detailsFrom ? `What is known about the record, from “${p.detailsFrom}”` : 'Pick the function its details come from, in Properties.'}
        </span>
      </div>
    )
  }

  const nothing = !details.loading && !details.error && !details.waiting && details.sections.length === 0
  if (nothing && !p.empty) return null
  return (
    <div className="xeplr-factory-details" style={style} aria-busy={details.loading || undefined}>
      {p.title && <div className="xeplr-factory-details-title">{p.title}</div>}
      {details.error && <span className="xeplr-factory-details-error" role="alert">{details.error}</span>}
      {nothing && <span className="xeplr-factory-hint">{p.empty}</span>}
      <Sections sections={details.sections} columns={p.columns || 2} />
      {details.canShowMore && (
        <button type="button" className="xeplr-factory-secondary xeplr-factory-details-more" onClick={details.showMore}>{p.moreLabel || 'More'}</button>
      )}
      {details.more && (
        <div className="xeplr-factory-details-extra">
          {details.more.loading && <span className="xeplr-factory-hint">Loading…</span>}
          {details.more.error && <span className="xeplr-factory-details-error" role="alert">{details.more.error}</span>}
          <Sections sections={details.more.sections} columns={1} />
          {!details.more.loading && (
            <button type="button" className="xeplr-factory-secondary xeplr-factory-details-more" onClick={details.hideMore}>Less</button>
          )}
        </div>
      )}
    </div>
  )
}

// The record's own line and its journey go across the top; the other
// sections pack into columns under them, each as tall as it is, so a short
// one never leaves a hole beside a long one.
function Sections({ sections, columns = 2 }) {
  if (!sections.length) return null
  const wide = sections.filter((s) => s.kind === 'header' || s.kind === 'journey')
  const boxes = sections.filter((s) => s.kind !== 'header' && s.kind !== 'journey')
  return (
    <>
      {wide.map((s, i) => (s.kind === 'header' ? <Header key={'w' + i} section={s} /> : (
        <section key={'w' + i} className="xeplr-factory-details-journey">
          {s.title && <h4 className="xeplr-factory-details-section-title">{s.title}</h4>}
          <Steps value={s.steps} notYet="Not yet" />
        </section>
      )))}
      {boxes.length > 0 && <Boxes sections={boxes} columns={columns} />}
    </>
  )
}

function Header({ section: s }) {
  return (
    <header className="xeplr-factory-details-header">
      <div className="xeplr-factory-details-header-main">
        <span className="xeplr-factory-details-header-title">{s.title}</span>
        {s.badges.map((b, i) => <span key={i} className={`xeplr-factory-details-pill xeplr-factory-details-pill--${b.tone}`}>{b.text}</span>)}
      </div>
      {(s.sub || s.aside) && (
        <div className="xeplr-factory-details-header-line">
          {s.sub && <span>{s.sub}</span>}
          {s.aside && <span className="xeplr-factory-details-header-aside">{s.aside}</span>}
        </div>
      )}
    </header>
  )
}

// Never more columns than boxes: two boxes share the width, not a third of it each.
function Boxes({ sections, columns }) {
  return (
    <div className="xeplr-factory-details-grid" style={{ '--xf-details-columns': Math.max(1, Math.min(columns, sections.length)) }}>
      {sections.map((s, i) => (
        <section key={i} className="xeplr-factory-details-section">
          {s.title && <h4 className="xeplr-factory-details-section-title">{s.title}</h4>}
          {s.items.length > 0 && (
            <ul className="xeplr-factory-details-items">
              {s.items.map((it, j) => (
                <li key={j} className="xeplr-factory-details-item">
                  {it.src ? <img src={it.src} alt="" loading="lazy" /> : <span className="xeplr-factory-details-noimg" aria-hidden="true" />}
                  <span className="xeplr-factory-details-item-text">
                    {it.name && <span className="xeplr-factory-details-item-name">{it.name}</span>}
                    {it.detail && <span className="xeplr-factory-details-item-detail">{it.detail}</span>}
                  </span>
                  {it.qty !== null && <span className="xeplr-factory-details-qty">× {it.qty}</span>}
                </li>
              ))}
            </ul>
          )}
          {s.rows.length > 0 && (
            <dl className="xeplr-factory-details-rows">
              {s.rows.map((r, j) => (
                <div key={j} className={'xeplr-factory-details-row' + (r.tone ? ' xeplr-factory-details-row--' + r.tone : '')}>
                  {r.label && <dt>{r.label}</dt>}
                  <dd>{r.href ? <a href={r.href} target={/^https?:/i.test(r.href) ? '_blank' : undefined} rel="noreferrer">{r.text}</a> : r.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}
    </div>
  )
}
