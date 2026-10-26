import { FLOW_END, describeWhen } from '../flow.js'
import { DECIDE_EVENT } from '../events.js'

// THE FLOW DESIGNER, AS A LIST — the screens of a journey down the left; for
// the one picked, its form, its events and where it goes next.
//
//   left    the steps, in order, and "Add a screen"
//   top     the step's name, and the flow's own save state and Publish
//   tabs    Form design — the screen's builder (renderFormDesign)
//           Events & navigation — what runs around its records, and what
//           comes after it
//
// EVENTS ARE THE SCREEN'S, NAVIGATION IS THE FLOW'S. A screen's records behave
// the same in every flow that shows it, so its events are saved to the
// screen's draft and take effect when the screen is published; where a step
// goes next belongs to this flow alone and saves with it.
//
// The code is never here. Each picker offers the functions the app registered
// for that event (useFunctionCatalog), with what each is for and what it is
// handed and returns — the developer writes the code in the app.
//
// Presentation only: everything comes from useFlowBuilder (ctrl),
// useScreenEvents (events) and useFunctionCatalog (catalog).

const FLOW_STATUS = {
  saved: 'All changes saved',
  pending: 'Unsaved changes…',
  saving: 'Saving…',
  invalid: 'Not saved — finish the flow first',
  error: 'Not saved'
}

export const FLOW_DESIGNER_TABS = [
  { key: 'settings', label: 'Events & navigation' },
  { key: 'design', label: 'Form design' }
]

export default function FlowDesignerSample({ ctrl, step, events, catalog, tab, onTab, renderFormDesign, className, style }) {
  const { flow } = ctrl
  return (
    <div className={'xeplr-factory-fd' + (className ? ' ' + className : '')} style={style}>
      <header className="xeplr-factory-bar">
        <input
          className="xeplr-factory-name"
          value={flow.name}
          onChange={(e) => ctrl.rename(e.target.value)}
          placeholder="What is this journey called?"
          aria-label="Flow name"
        />
        <div className={`xeplr-factory-bar-status xeplr-factory-bar-status--${ctrl.status}`} role="status" aria-live="polite">
          {ctrl.status === 'error' ? `Not saved — ${ctrl.saveError}` : FLOW_STATUS[ctrl.status]}
        </div>
        {ctrl.validation.errors.length > 0 && (
          <span className="xeplr-factory-problems" title={ctrl.validation.errors.map((x) => x.message).join('\n')}>
            {ctrl.validation.errors.length} problem{ctrl.validation.errors.length === 1 ? '' : 's'}
          </span>
        )}
        {ctrl.canPublish && (
          <button type="button" className="xeplr-factory-primary" onClick={ctrl.publish} disabled={ctrl.publishing || !ctrl.validation.ok}>
            {ctrl.publishing ? 'Publishing…' : 'Publish flow'}
          </button>
        )}
      </header>

      {ctrl.publishResult && (
        <div className={`xeplr-factory-publish${ctrl.publishResult.ok ? ' is-ok' : ' is-error'}`} role="status">
          <span>{ctrl.publishResult.message}</span>
          <button type="button" className="xeplr-factory-icon-button" aria-label="Dismiss" onClick={ctrl.clearPublishResult}>×</button>
        </div>
      )}

      <div className="xeplr-factory-fd-body">
        <Steps ctrl={ctrl} step={step} />
        <main className="xeplr-factory-fd-main">
          {!step ? (
            <div className="xeplr-factory-fd-empty">Add a screen on the left to start the journey.</div>
          ) : (
            <>
              <div className="xeplr-factory-fd-head">
                <input
                  className="xeplr-factory-fd-step-name"
                  value={step.label || ''}
                  placeholder={step.stepKey}
                  onChange={(e) => ctrl.setStep(step.stepKey, { label: e.target.value })}
                  aria-label="Step name"
                />
                <span className="xeplr-factory-fd-step-screen">Shows <code>{screenName(ctrl, step.screen)}</code></span>
                <button type="button" className="xeplr-factory-fd-remove" onClick={() => ctrl.removeStep(step.stepKey)}>Remove step</button>
              </div>
              <div className="xeplr-factory-fd-tabs" role="tablist">
                {FLOW_DESIGNER_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    className={'xeplr-factory-fd-tab' + (tab === t.key ? ' is-active' : '')}
                    onClick={() => onTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {tab === 'design' ? (
                <div className="xeplr-factory-fd-design">{renderFormDesign ? renderFormDesign(step, events) : null}</div>
              ) : (
                <div className="xeplr-factory-fd-settings">
                  <EventsPanel step={step} events={events} catalog={catalog} ctrl={ctrl} />
                  <NavigationPanel step={step} ctrl={ctrl} catalog={catalog} />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

/** The journey's screens, in order, with "Add a screen" under them. */
function Steps({ ctrl, step }) {
  const { flow } = ctrl
  const unused = ctrl.screens.filter((s) => !flow.steps.some((x) => x.screen === s.id))
  return (
    <nav className="xeplr-factory-fd-steps" aria-label="Screens of this journey">
      <ol className="xeplr-factory-fd-step-list">
        {flow.steps.map((s, i) => {
          const problems = ctrl.errorsByStep[s.stepKey] || []
          const on = step && step.stepKey === s.stepKey
          return (
            <li key={s.stepKey}>
              <button
                type="button"
                className={'xeplr-factory-fd-step' + (on ? ' is-selected' : '') + (problems.length ? ' has-error' : '')}
                aria-current={on ? 'step' : undefined}
                onClick={() => ctrl.setSelected(s.stepKey)}
                title={problems.map((p) => p.message).join('\n') || undefined}
              >
                <span className="xeplr-factory-fd-step-number">{i + 1}</span>
                <span className="xeplr-factory-fd-step-text">
                  <span className="xeplr-factory-fd-step-label">{s.label || s.stepKey}</span>
                  <span className="xeplr-factory-fd-step-next">{nextInWords(ctrl, s)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <label className="xeplr-factory-fd-add">
        <span className="xeplr-factory-fd-add-label">Add a screen</span>
        <select
          value=""
          onChange={(e) => { if (e.target.value) ctrl.addStep(e.target.value) }}
          aria-label="Add a screen to the journey"
        >
          <option value="">{ctrl.screens.length ? 'Choose a form…' : 'No published forms yet'}</option>
          {unused.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
          {unused.length < ctrl.screens.length && unused.length > 0 && <option disabled>──────────</option>}
          {ctrl.screens.filter((s) => !unused.includes(s)).map((s) => <option key={s.id} value={s.id}>{s.name || s.id} (again)</option>)}
        </select>
      </label>
    </nav>
  )
}

/** The screen's events: one function per event, from those the app registered for it. */
function EventsPanel({ step, events, catalog }) {
  return (
    <section className="xeplr-factory-fd-card" aria-labelledby="xf-fd-events">
      <div className="xeplr-factory-fd-card-head">
        <h3 id="xf-fd-events">Events of this screen</h3>
        <p>
          The app’s own functions, run on the server around <strong>{step.label || step.stepKey}</strong>’s records.
          They belong to the screen, so they run in every journey that shows it.
        </p>
      </div>
      {events.loading && <p className="xeplr-factory-hint">Opening the screen…</p>}
      {events.error && <div className="xeplr-factory-invalid" role="alert">{events.error}</div>}
      {catalog.error && <div className="xeplr-factory-invalid" role="alert">{catalog.error}</div>}
      {events.document && (
        <>
          <ul className="xeplr-factory-fd-events">
            {events.rows.map((row) => {
              const options = catalog.forEvent(row.key)
              const picked = row.picked ? catalog.byName(row.picked) : null
              const gone = row.picked && !catalog.loading && (!picked || picked.event !== row.key)
              const id = `xf-fd-event-${row.key}`
              return (
                <li key={row.key} className={'xeplr-factory-fd-event' + (row.picked ? ' is-on' : '') + (gone ? ' has-error' : '')}>
                  <div className="xeplr-factory-fd-event-what">
                    <label htmlFor={id} className="xeplr-factory-fd-event-name">{row.label}</label>
                    <span className="xeplr-factory-fd-event-when">{row.when}</span>
                  </div>
                  <select
                    id={id}
                    value={row.picked}
                    onChange={(e) => events.setEvent(row.key, e.target.value)}
                  >
                    <option value="">{options.length ? 'Nothing runs' : 'No functions for this yet'}</option>
                    {options.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                    {gone && <option value={row.picked}>{row.picked} (not registered)</option>}
                  </select>
                  {row.picked && (
                    <div className="xeplr-factory-fd-contract">
                      {gone
                        ? <p className="xeplr-factory-fd-contract-gone">“{row.picked}” is not registered for {row.label.toLowerCase()} in the app. Publishing this screen will be refused until it is — or pick another.</p>
                        : picked && picked.description && <p className="xeplr-factory-fd-contract-desc">{picked.description}</p>}
                      <dl>
                        <dt>Gets</dt><dd>{row.gets}</dd>
                        <dt>Returns</dt><dd>{row.returns}</dd>
                      </dl>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="xeplr-factory-fd-card-foot">
            <span className={`xeplr-factory-fd-save xeplr-factory-fd-save--${events.status}`} role="status" aria-live="polite">
              {events.status === 'saving' ? 'Saving…'
                : events.status === 'error' ? `Not saved — ${events.saveError}`
                  : events.status === 'saved' ? 'Saved to the screen’s draft — publish the screen to use it'
                    : 'Changes take effect when the screen is published'}
            </span>
            {events.canPublish && (
              <button type="button" className="xeplr-factory-secondary" onClick={events.publish} disabled={events.publishing}>
                {events.publishing ? 'Publishing…' : 'Publish screen'}
              </button>
            )}
          </div>
          {events.publishResult && (
            <div className={'xeplr-factory-fd-result' + (events.publishResult.ok ? ' is-ok' : ' is-error')} role="status">{events.publishResult.message}</div>
          )}
        </>
      )}
    </section>
  )
}

/** Where this step goes once its screen is saved: a screen, a function's choice, or the end. */
function NavigationPanel({ step, ctrl, catalog }) {
  const nav = navigationOfStep(ctrl, step)
  const others = ctrl.flow.steps.filter((s) => s.stepKey !== step.stepKey)
  const deciders = catalog.forEvent(DECIDE_EVENT)
  const set = (patch) => ctrl.setNavigation(step.stepKey, { ...nav, ...patch })
  const name = `xf-fd-nav-${step.stepKey}`
  const picked = nav.mode === 'decide' && nav.decide ? catalog.byName(nav.decide) : null
  const problems = ctrl.errorsByStep[step.stepKey] || []

  return (
    <section className="xeplr-factory-fd-card" aria-labelledby="xf-fd-nav">
      <div className="xeplr-factory-fd-card-head">
        <h3 id="xf-fd-nav">After this screen is saved</h3>
        <p>Where the journey goes next. This belongs to this flow only.</p>
      </div>

      {nav.mode === 'branches' ? (
        <div className="xeplr-factory-fd-branches">
          <p>This step chooses by what was filled in:</p>
          <ul>
            {step.transitions.map((t, i) => (
              <li key={i}>{describeWhen(t.when, fieldLabel(ctrl, step, t.when))} → {targetName(ctrl, t.target)}</li>
            ))}
          </ul>
          <button type="button" className="xeplr-factory-secondary" onClick={() => ctrl.setNavigation(step.stepKey, { mode: 'screen', target: others[0] ? others[0].stepKey : '' })}>
            Replace with one choice below
          </button>
        </div>
      ) : (
        <div className="xeplr-factory-fd-choices" role="radiogroup" aria-labelledby="xf-fd-nav">
          <div className={'xeplr-factory-fd-choice' + (nav.mode === 'screen' ? ' is-on' : '')}>
            <label className="xeplr-factory-fd-choice-pick">
              <input type="radio" name={name} checked={nav.mode === 'screen'} onChange={() => ctrl.setNavigation(step.stepKey, { mode: 'screen', target: others[0] ? others[0].stepKey : '' })} />
              <span>Go to a screen</span>
            </label>
            {nav.mode === 'screen' && (
              <select value={nav.target || ''} onChange={(e) => set({ target: e.target.value })} aria-label="Go to">
                {!nav.target && <option value="">Choose a screen…</option>}
                {others.map((s) => <option key={s.stepKey} value={s.stepKey}>{s.label || s.stepKey}</option>)}
              </select>
            )}
          </div>

          <div className={'xeplr-factory-fd-choice' + (nav.mode === 'decide' ? ' is-on' : '')}>
            <label className="xeplr-factory-fd-choice-pick">
              <input type="radio" name={name} checked={nav.mode === 'decide'} onChange={() => ctrl.setNavigation(step.stepKey, { mode: 'decide', decide: deciders[0] ? deciders[0].name : '', targets: others.map((s) => s.stepKey) })} />
              <span>Let a function decide</span>
            </label>
            {nav.mode === 'decide' && (
              <div className="xeplr-factory-fd-decide">
                <select value={nav.decide || ''} onChange={(e) => set({ decide: e.target.value })} aria-label="Function that decides">
                  {!nav.decide && <option value="">{deciders.length ? 'Choose a function…' : 'No decide functions registered'}</option>}
                  {deciders.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                  {nav.decide && !picked && !catalog.loading && <option value={nav.decide}>{nav.decide} (not registered)</option>}
                </select>
                {picked && picked.description && <p className="xeplr-factory-fd-contract-desc">{picked.description}</p>}
                <fieldset className="xeplr-factory-fd-targets">
                  <legend>It may choose</legend>
                  {others.map((s) => (
                    <label key={s.stepKey} className="xeplr-factory-fd-target">
                      <input
                        type="checkbox"
                        checked={(nav.targets || []).includes(s.stepKey)}
                        onChange={(e) => set({ targets: e.target.checked ? [...(nav.targets || []), s.stepKey] : (nav.targets || []).filter((k) => k !== s.stepKey) })}
                      />
                      <span>{s.label || s.stepKey}</span>
                    </label>
                  ))}
                  <label className="xeplr-factory-fd-target">
                    <input
                      type="checkbox"
                      checked={(nav.targets || []).includes(FLOW_END)}
                      onChange={(e) => set({ targets: e.target.checked ? [...(nav.targets || []), FLOW_END] : (nav.targets || []).filter((k) => k !== FLOW_END) })}
                    />
                    <span>Finish the journey</span>
                  </label>
                </fieldset>
                <p className="xeplr-factory-hint">It is handed what was filled in and returns one of these — anything else stops the journey and says so.</p>
              </div>
            )}
          </div>

          <div className={'xeplr-factory-fd-choice' + (nav.mode === 'end' ? ' is-on' : '')}>
            <label className="xeplr-factory-fd-choice-pick">
              <input type="radio" name={name} checked={nav.mode === 'end'} onChange={() => ctrl.setNavigation(step.stepKey, { mode: 'end' })} />
              <span>Finish the journey</span>
            </label>
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <div className="xeplr-factory-invalid" role="alert">
          {problems.map((p, i) => <div key={i}>{p.message}</div>)}
        </div>
      )}
    </section>
  )
}

function navigationOfStep(ctrl, step) {
  return ctrl.navigationOf(step)
}

/** "→ Contract", "→ routeByAmount decides", "Finishes" — under each step in the list. */
function nextInWords(ctrl, step) {
  const nav = ctrl.navigationOf(step)
  if (nav.mode === 'screen') return '→ ' + targetName(ctrl, nav.target)
  if (nav.mode === 'decide') return nav.decide ? `→ ${nav.decide} decides` : '→ a function decides'
  if (nav.mode === 'branches') return `→ ${step.transitions.length} branches`
  if (nav.mode === 'end') return 'Finishes the journey'
  return 'Where next?'
}

function targetName(ctrl, key) {
  if (!key) return '…'
  if (key === FLOW_END) return 'Finish'
  const s = ctrl.flow.steps.find((x) => x.stepKey === key)
  return s ? (s.label || s.stepKey) : key
}

function screenName(ctrl, id) {
  const hit = ctrl.screens.find((s) => s.id === id)
  return (hit && hit.name) || id
}

function fieldLabel(ctrl, step, when) {
  if (!when) return null
  const hit = ctrl.fieldsFor(step.stepKey).find((f) => f.name === when.field)
  return hit ? hit.label : when.field
}
