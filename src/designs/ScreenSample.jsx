import ControlView from './ControlView.jsx'
import { contentBottom, inputNodes, MARGIN } from '../document.js'
import { screenStyle } from './styles.js'
import { CHOICE_TYPES } from '../controls.js'

// A saved screen, drawn. Presentation only — everything comes from
// useFactoryScreen.
//
// NO MEASURING. Positions are CSS: x and w as percentages of the width, y and h
// in container-query units (cqw = 1% of the screen's width) times the aspect.
// The screen is never wider than the width it was designed at, so what was
// designed at 800px is shown at 800px, and only a narrower screen scales it.
//
// NO SUBMIT. The status line says what the background save is doing.

const STATUS = {
  idle: '',
  pending: 'Unsaved changes…',
  saving: 'Saving…',
  saved: 'All changes saved',
  incomplete: 'Fill in the required fields to save',
  invalid: 'Fix the highlighted fields to save'
}

/**
 * Back and Next, under the page. Next holds at a step whose own fields are not
 * filled in — and shows why, rather than moving on and leaving a problem
 * behind on a step nobody is looking at.
 */
function StepNav({ ctrl, node, children }) {
  const at = ctrl.steps.active(node.id)
  const last = ctrl.steps.count(node.id) - 1
  const unfinished = ctrl.steps.fieldsOn(node.id, at).filter((n) => ctrl.allErrors[n.props.name])
  const go = (to, direction) => {
    if (to > at && unfinished.length) { unfinished.forEach((n) => ctrl.touch(n)); return }
    ctrl.steps.go(node.id, Math.min(Math.max(to, 0), last), direction)
  }
  return (
    <div className="xeplr-factory-stepnav">
      <button type="button" className="xeplr-factory-secondary" onClick={() => go(at - 1, 'back')} disabled={at === 0}>Back</button>
      <span className="xeplr-factory-stepnav-where">Step {at + 1} of {last + 1}</span>
      <button type="button" className="xeplr-factory-primary" onClick={() => go(at + 1, 'next')} disabled={at === last}>Next</button>
      {children}
    </div>
  )
}

/** Leaves the page — after whatever is still being saved has gone out. */
function DoneButton({ ctrl }) {
  const saving = ctrl.status === 'pending' || ctrl.status === 'saving'
  return (
    <button type="button" className="xeplr-factory-secondary" onClick={() => ctrl.flush().then(ctrl.done, ctrl.done)}>
      {saving ? 'Saving…' : 'Done'}
    </button>
  )
}

export default function ScreenSample({ ctrl, className, style, renderPopup }) {
  const { document: doc } = ctrl

  if (ctrl.documentErrors.length) {
    return (
      <div className="xeplr-factory-invalid" role="alert">
        <strong>This screen cannot be shown — its definition has problems:</strong>
        <ul>
          {ctrl.documentErrors.map((e, i) => <li key={i}><code>{e.path || '(screen)'}</code> {e.message}</li>)}
        </ul>
      </div>
    )
  }

  const aspect = doc.aspect
  // Only what the open steps show — the page is as tall as the step being
  // filled in, not as tall as every step stacked up.
  const shown = ctrl.visibleNodes && ctrl.visibleNodes.length ? ctrl.visibleNodes : doc.nodes
  const pageHeight = (contentBottom(doc, shown) + MARGIN) * aspect * 100
  const fieldNodes = inputNodes(doc)
  const statusText = ctrl.status === 'error' ? `Not saved — ${ctrl.saveError}` : STATUS[ctrl.status]
  // A screen with no fields of its own (a list screen) has nothing to save.
  const hasFields = fieldNodes.length > 0

  return (
    <div
      className={'xeplr-factory-screen' + (className ? ' ' + className : '')}
      style={{ maxWidth: doc.width, ...screenStyle(doc), ...style }}
    >
      {hasFields && (
        <div className={`xeplr-factory-status xeplr-factory-status--${ctrl.status}`} role="status" aria-live="polite">
          <span>{ctrl.recordId !== null && ctrl.recordId !== undefined ? 'Editing record' : 'New record'}</span>
          <span>{statusText}</span>
        </div>
      )}
      <form
        className="xeplr-factory-page"
        style={{ height: `${pageHeight}cqw` }}
        // Enter in a field saves now rather than posting a page.
        onSubmit={(e) => { e.preventDefault(); ctrl.saveNow() }}
        noValidate
        aria-label={doc.name}
      >
        {[...shown].sort((a, b) => (a.z || 0) - (b.z || 0)).map((node) => (
          <div
            key={node.id}
            className={`xeplr-factory-node xeplr-factory-node--${node.type}`}
            style={{
              left: `${node.x * 100}%`,
              top: `${node.y * aspect * 100}cqw`,
              width: `${node.w * 100}%`,
              height: `${node.h * aspect * 100}cqw`
            }}
          >
            <ControlView
              node={node}
              mode="live"
              value={node.props?.name ? ctrl.values[node.props.name] : undefined}
              error={node.props?.name ? ctrl.errors[node.props.name] : undefined}
              options={CHOICE_TYPES.includes(node.type) ? ctrl.optionsFor(node) : undefined}
              upload={node.type === 'file' ? ctrl.upload : undefined}
              stepper={node.type === 'stepper' ? { active: ctrl.steps.active(node.id), onStep: (i) => ctrl.steps.go(node.id, i, 'jump') } : undefined}
              onChange={(raw) => ctrl.setValue(node, raw)}
              onBlur={() => ctrl.touch(node)}
              list={node.type === 'list' ? {
                doc,
                list: ctrl.listFor(node),
                fieldNodes: ctrl.fieldsFor(node),
                optionsFor: ctrl.optionsFor,
                currentId: ctrl.recordId,
                recordKey: ctrl.recordKey,
                canDelete: ctrl.canDelete,
                extraActions: ctrl.actionsFor ? ctrl.actionsFor(node) : [],
                // A list with an edit screen opens it in a popup; one on a form
                // opens the row in the form's own fields.
                onEdit: (rec) => (node.props.editScreen ? ctrl.openEditor(node, rec) : ctrl.openRecord(rec)),
                // eslint-disable-next-line no-alert
                onDelete: (rec) => ctrl.deleteRecord(node, rec).catch((err) => window.alert(err.message || 'Could not delete')),
                onNew: () => (node.props.editScreen ? ctrl.openEditor(node, null) : ctrl.newRecord())
              } : undefined}
            />
          </div>
        ))}
      </form>
      {ctrl.steps.nodes.map((node, i) => (
        <StepNav key={node.id} ctrl={ctrl} node={node}>
          {ctrl.done && i === ctrl.steps.nodes.length - 1 && <DoneButton ctrl={ctrl} />}
        </StepNav>
      ))}
      {ctrl.done && !ctrl.steps.nodes.length && (
        <div className="xeplr-factory-done"><DoneButton ctrl={ctrl} /></div>
      )}
      {ctrl.popup && renderPopup && renderPopup(ctrl.popup, ctrl)}
    </div>
  )
}
