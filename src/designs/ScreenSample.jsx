import ControlView from './ControlView.jsx'
import { contentBottom, MARGIN } from '../document.js'

// A saved screen, drawn. Presentation only — everything comes from
// useFactoryScreen.
//
// NO MEASURING. Positions are CSS: x and w as percentages of the width, y and h
// in container-query units (cqw = 1% of the screen's width) times the aspect.
// So the screen keeps exactly its proportions at any width, renders on the
// server, and never flashes at the wrong size while a ResizeObserver catches up.

export default function ScreenSample({ ctrl, className, style }) {
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
  const pageHeight = (contentBottom(doc) + MARGIN) * aspect * 100

  return (
    <div className={'xeplr-factory-screen' + (className ? ' ' + className : '')} style={style}>
      <form
        className="xeplr-factory-page"
        style={{ height: `${pageHeight}cqw` }}
        onSubmit={ctrl.submit}
        noValidate
        aria-label={doc.name}
      >
        {[...doc.nodes].sort((a, b) => (a.z || 0) - (b.z || 0)).map((node) => (
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
              options={node.type === 'dropdown' ? ctrl.optionsFor(node) : undefined}
              onChange={(raw) => ctrl.setValue(node, raw)}
              onAction={(action) => { if (action === 'reset') ctrl.reset() }}
              disabled={ctrl.submitting}
            />
          </div>
        ))}
      </form>
      {ctrl.submitError && <div className="xeplr-factory-submit-error" role="alert">{ctrl.submitError}</div>}
    </div>
  )
}
