import { XeplrCanvas } from '@xeplr/ui-canvas'
import { FLOW_END, FLOW_OPERATORS, VALUELESS_OPERATORS, describeWhen } from '../flow.js'

// THE FLOW DESIGNER — screens on a canvas, arrows between them.
//
// A box is a screen. An arrow leaving it is a question asked once the screen
// is filled in: the first arrow whose test passes wins, and the one with no
// test — "otherwise" — catches the rest. That is the whole language, and it is
// the same one the engine runs.
//
// Presentation only: everything comes from useFlowBuilder.

const STEP_W = 200
const STEP_H = 86

const STATUS = {
  saved: 'All changes saved',
  pending: 'Unsaved changes…',
  saving: 'Saving…',
  invalid: 'Not saved — finish the flow first',
  error: 'Not saved'
}

export default function FlowBuilderSample({ ctrl, className, style }) {
  const { flow } = ctrl
  const items = flow.steps.map((s) => ({
    id: s.stepKey,
    x: (s.layout && s.layout.x) || 40,
    y: (s.layout && s.layout.y) || 40,
    w: STEP_W,
    h: STEP_H
  }))
  // One arrow per transition. A step that ends the journey gets a stub to a
  // "Finished" pill, the way the workflow editor draws its ends.
  const edges = flow.steps.flatMap((s) => s.transitions.map((t, i) => ({
    id: `${s.stepKey}-${i}`,
    from: s.stepKey,
    ...(t.target === FLOW_END || !flow.steps.some((x) => x.stepKey === t.target)
      ? { toOffset: { x: 90, y: 0 }, done: true }
      : { to: t.target }),
    variant: t.when ? undefined : 'dashed',
    label: describeWhen(t.when, labelOf(ctrl, s.stepKey, t.when))
  })))

  return (
    <div className={'xeplr-factory-flow-builder' + (className ? ' ' + className : '')} style={style}>
      <header className="xeplr-factory-bar">
        <input
          className="xeplr-factory-name"
          value={flow.name}
          onChange={(e) => ctrl.rename(e.target.value)}
          placeholder="What is this journey called?"
          aria-label="Flow name"
        />
        <code className="xeplr-factory-flow-key" title="The key this flow is known by — it never changes">{flow.key}</code>
        <div className={`xeplr-factory-bar-status xeplr-factory-bar-status--${ctrl.status}`} role="status" aria-live="polite">
          {ctrl.status === 'error' ? `Not saved — ${ctrl.saveError}` : STATUS[ctrl.status]}
        </div>
        {ctrl.validation.errors.length > 0 && (
          <span className="xeplr-factory-problems" title={ctrl.validation.errors.map((x) => `${x.path}: ${x.message}`).join('\n')}>
            {ctrl.validation.errors.length} problem{ctrl.validation.errors.length === 1 ? '' : 's'}
          </span>
        )}
        {flow.steps.length > 1 && (
          <button type="button" className="xeplr-factory-secondary" onClick={ctrl.tidy} title="Lay the screens out as the journey reads">Tidy</button>
        )}
        {ctrl.canPublish && (
          <button type="button" className="xeplr-factory-primary" onClick={ctrl.publish} disabled={ctrl.publishing || !ctrl.validation.ok}>
            {ctrl.publishing ? 'Publishing…' : 'Publish'}
          </button>
        )}
      </header>

      {ctrl.publishResult && (
        <div className={`xeplr-factory-publish${ctrl.publishResult.ok ? ' is-ok' : ' is-error'}`} role="status">
          <span>{ctrl.publishResult.message}</span>
          <button type="button" className="xeplr-factory-icon-button" aria-label="Dismiss" onClick={ctrl.clearPublishResult}>×</button>
        </div>
      )}

      <div className="xeplr-factory-body">
        <aside className="xeplr-factory-palette" aria-label="Screens">
          <div className="xeplr-factory-palette-group">
            <h3 className="xeplr-factory-palette-title">Screens</h3>
            {ctrl.screens.length === 0 && <p className="xeplr-factory-hint">No published forms yet.</p>}
            {ctrl.screens.map((s) => (
              <button
                key={s.id}
                type="button"
                className="xeplr-factory-palette-item"
                onClick={() => ctrl.addStep(s.id, nextPlace(flow))}
                title={`Add ${s.name || s.id} to the journey`}
              >
                {s.name || s.id}
              </button>
            ))}
          </div>
        </aside>

        <div className="xeplr-factory-stage">
          <XeplrCanvas
            className="xeplr-factory-flow-canvas"
            items={items}
            edges={edges}
            features={{ drag: true, snap: true }}
            selection={ctrl.selected ? [ctrl.selected] : []}
            onSelectionChange={(ids) => ctrl.setSelected([...ids][0] || null)}
            onItemChange={(id, patch) => ctrl.moveStep(id, patch)}
            onItemClick={(id) => ctrl.setSelected(id)}
            renderItem={(item) => {
              const step = flow.steps.find((s) => s.stepKey === item.id)
              if (!step) return null
              const problems = ctrl.errorsByStep[step.stepKey] || []
              return (
                <div className={`xeplr-factory-step-card${ctrl.selected === step.stepKey ? ' is-selected' : ''}${problems.length ? ' has-error' : ''}`}>
                  <span className="xeplr-factory-step-card-name">{step.label || step.stepKey}</span>
                  <span className="xeplr-factory-step-card-screen">{screenName(ctrl, step.screen)}</span>
                  {ctrl.first && ctrl.first.stepKey === step.stepKey && <span className="xeplr-factory-step-card-first">starts here</span>}
                </div>
              )
            }}
            renderEdgeLabel={(edge, { mid }) => (
              <span className="xeplr-factory-edge-label" style={{ position: 'absolute', left: mid.x, top: mid.y, transform: 'translate(-50%, -50%)' }}>
                {edge.done ? 'Finished' : edge.label}
              </span>
            )}
            underlay={flow.steps.length === 0 && (
              <div className="xeplr-factory-empty">Add a screen from the left to start the journey</div>
            )}
          />
        </div>

        <StepPanel ctrl={ctrl} />
      </div>
    </div>
  )
}

/** What a step does, and where it goes next. */
function StepPanel({ ctrl }) {
  const step = ctrl.selectedStep
  if (!step) {
    return (
      <aside className="xeplr-factory-panel" aria-label="Step">
        <p className="xeplr-factory-panel-empty">
          Pick a screen on the canvas to say what happens after it.
          <br /><br />
          Each arrow is a question asked once that screen is filled in — the first one that fits wins, and “otherwise” catches the rest.
        </p>
      </aside>
    )
  }
  const fields = ctrl.fieldsFor(step.stepKey)
  const others = ctrl.flow.steps.filter((s) => s.stepKey !== step.stepKey)

  return (
    <aside className="xeplr-factory-panel" aria-label="Step">
      <div className="xeplr-factory-panel-head">
        <span className="xeplr-factory-panel-type">{step.label || step.stepKey}</span>
        <button type="button" className="xeplr-factory-danger-link" onClick={() => ctrl.removeStep(step.stepKey)}>Remove</button>
      </div>

      <fieldset className="xeplr-factory-group">
        <legend>Step</legend>
        <div className="xeplr-factory-prop">
          <label className="xeplr-factory-prop-label" htmlFor="xf-step-label">Name</label>
          <input id="xf-step-label" className="xeplr-factory-prop-input" value={step.label || ''} onChange={(e) => ctrl.setStep(step.stepKey, { label: e.target.value })} />
        </div>
        <div className="xeplr-factory-prop">
          <label className="xeplr-factory-prop-label" htmlFor="xf-step-screen">Shows</label>
          <select id="xf-step-screen" className="xeplr-factory-prop-input" value={step.screen} onChange={(e) => ctrl.setStep(step.stepKey, { screen: e.target.value })}>
            {ctrl.screens.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
          </select>
        </div>
      </fieldset>

      <fieldset className="xeplr-factory-group">
        <legend>Then</legend>
        {step.transitions.length === 0 && <p className="xeplr-factory-hint">The journey ends here.</p>}
        {step.transitions.map((t, i) => (
          <div key={i} className="xeplr-factory-arrow">
            {t.when === null ? (
              <span className="xeplr-factory-arrow-when">Otherwise</span>
            ) : (
              <div className="xeplr-factory-arrow-test">
                <select
                  className="xeplr-factory-prop-input"
                  value={t.when.field || ''}
                  onChange={(e) => ctrl.setTransition(step.stepKey, i, { when: { ...t.when, field: e.target.value } })}
                  aria-label="Field"
                >
                  <option value="">Which field…</option>
                  {fields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
                </select>
                <select
                  className="xeplr-factory-prop-input"
                  value={t.when.op}
                  onChange={(e) => ctrl.setTransition(step.stepKey, i, { when: { ...t.when, op: e.target.value } })}
                  aria-label="Test"
                >
                  {FLOW_OPERATORS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
                </select>
                {!VALUELESS_OPERATORS.includes(t.when.op) && (
                  <input
                    className="xeplr-factory-prop-input"
                    value={t.when.value ?? ''}
                    placeholder="value"
                    onChange={(e) => ctrl.setTransition(step.stepKey, i, { when: { ...t.when, value: e.target.value } })}
                    aria-label="Value"
                  />
                )}
              </div>
            )}
            <div className="xeplr-factory-arrow-target">
              <span>go to</span>
              <select
                className="xeplr-factory-prop-input"
                value={t.target}
                onChange={(e) => ctrl.setTransition(step.stepKey, i, { target: e.target.value })}
                aria-label="Goes to"
              >
                {others.map((s) => <option key={s.stepKey} value={s.stepKey}>{s.label || s.stepKey}</option>)}
                <option value={FLOW_END}>Finish</option>
              </select>
              <button type="button" className="xeplr-factory-icon-button" aria-label="Remove this arrow" onClick={() => ctrl.disconnect(step.stepKey, i)}>×</button>
            </div>
          </div>
        ))}
        <div className="xeplr-factory-arrow-add">
          <button
            type="button"
            className="xeplr-factory-add"
            onClick={() => ctrl.connect(step.stepKey, others.length ? others[0].stepKey : FLOW_END, { field: fields[0] ? fields[0].name : '', op: '=', value: '' })}
          >
            + If a field says…
          </button>
          {!step.transitions.some((t) => t.when === null) && (
            <button
              type="button"
              className="xeplr-factory-add"
              onClick={() => ctrl.connect(step.stepKey, others.length ? others[0].stepKey : FLOW_END, null)}
            >
              + Otherwise
            </button>
          )}
        </div>
      </fieldset>

      {(ctrl.errorsByStep[step.stepKey] || []).length > 0 && (
        <div className="xeplr-factory-panel-errors" role="alert">
          {ctrl.errorsByStep[step.stepKey].map((e, i) => <div key={i}>{e.message}</div>)}
        </div>
      )}
    </aside>
  )
}

/** Where the next screen goes: to the right of the last one, a row lower after four. */
function nextPlace(flow) {
  const n = flow.steps.length
  return { x: 60 + (n % 4) * (STEP_W + 90), y: 80 + Math.floor(n / 4) * (STEP_H + 110) }
}

function screenName(ctrl, id) {
  const hit = ctrl.screens.find((s) => s.id === id)
  return (hit && hit.name) || id
}

/** A field's label, for an arrow that tests it — the person never sees column names. */
function labelOf(ctrl, stepKey, when) {
  if (!when) return null
  const hit = ctrl.fieldsFor(stepKey).find((f) => f.name === when.field)
  return hit ? hit.label : when.field
}
