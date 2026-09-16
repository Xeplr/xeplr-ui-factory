import { useRef } from 'react'
import ScreenSample from './ScreenSample.jsx'

// A flow, running: the screen the run is parked on, and one button forward.
//
// Presentation only — everything comes from useFlowRun and useFactoryScreen.
// The screen saves itself into its own table exactly as it does anywhere else;
// "Next" hands the run what was filled in, and the run says which screen comes
// after it. Nothing here knows the journey.

export default function FlowRunnerSample({ run, screen, className, style, title, renderDone }) {
  const values = useRef({})
  const record = useRef(null)

  if (run.loading) return <div className="xeplr-factory-flow-loading">Opening…</div>
  if (run.error) {
    return (
      <div className="xeplr-factory-invalid" role="alert">
        <strong>This journey cannot go on:</strong> {run.error}
      </div>
    )
  }
  if (run.status === 'done') {
    return (
      <div className={'xeplr-factory-flow' + (className ? ' ' + className : '')} style={style}>
        {renderDone
          ? renderDone(run)
          : <div className="xeplr-factory-flow-done" role="status"><strong>All done.</strong> Nothing more to fill in.</div>}
      </div>
    )
  }
  if (!run.document) return null

  return (
    <div className={'xeplr-factory-flow' + (className ? ' ' + className : '')} style={style}>
      {title !== false && (
        <div className="xeplr-factory-flow-head">
          <span className="xeplr-factory-flow-where">{title || run.document.name}</span>
          {run.sending && <span className="xeplr-factory-flow-sending">Working out what comes next…</span>}
        </div>
      )}
      <ScreenSample
        // A new step is a new form: the key stops the screen keeping the last
        // one's values while the document changes under it.
        key={run.stepKey}
        ctrl={{
          ...screen,
          // The flow's forward button IS the screen's own, renamed: one button,
          // not two that both look like the way on.
          done: () => run.submit(values.current, record.current),
          doneLabel: run.sending ? 'Saving…' : 'Next'
        }}
      />
      <FlowValues screen={screen} values={values} record={record} />
    </div>
  )
}

/**
 * The bridge between the screen and the run: what is filled in, and the row
 * the screen saved. Kept in refs — the run reads them when the person moves
 * on, and a re-render on every keystroke would be the form's business, not
 * the journey's.
 */
function FlowValues({ screen, values, record }) {
  values.current = screen.values
  record.current = screen.recordId
  return null
}
