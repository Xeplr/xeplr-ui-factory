import { useEffect, useRef, useState } from 'react'
import { useFactoryBuilder } from './useFactoryBuilder.js'
import { useFactoryScreen } from './useFactoryScreen.js'
import { useFlowRun } from './useFlowRun.js'
import { useFlowBuilder } from './useFlowBuilder.js'
import { useScreenEvents } from './useScreenEvents.js'
import { useFunctionCatalog } from './useFunctionCatalog.js'
import { useUrlTab } from './useUrlPlaces.js'
import { loadScreens } from './screenSource.js'
import { BuilderSample, ScreenSample, ScreenModal, FlowRunnerSample, FlowBuilderSample, FlowDesignerSample } from './designs/index.js'

/**
 * The builder, ready-made. Saves itself — there is no Save button.
 *
 * @prop document     the screen to edit (omit for a new one)
 * @prop name         name for a new screen
 * @prop onSave       async (document) → void — called automatically after edits, only with a valid document
 * @prop onChange     (document) → void — every edit
 * @prop onPublish    async (document) → { version } — shows a Publish button; throw to refuse, with `detail` to show (e.g. the migration to run)
 * @prop listTables   async () → [{ id, name }] | string[] — for "Saves to", lists and table dropdowns
 * @prop fetchOptions async ({ table }) → [{ id, name }] — Preview with real options
 * @prop fetchRecords async ({ source }) → records — Preview with real records
 * @prop lockedNames  field names that are already columns of the table — shown read-only
 * @prop screens      [{ id, name, document? }] — other screens: "Edit in" choices, and Preview's popups
 * @prop controls     control registry (default: built-ins)
 * @prop urlKey       keep the selected control and open steps in the URL (<urlKey>Selected, <urlKey>Steps)
 */
export function FactoryBuilder(props) {
  const ctrl = useFactoryBuilder(props)
  return (
    <BuilderSample
      ctrl={ctrl}
      className={props.className}
      style={props.style}
      // So a child table made here can be designed here — see the modal in
      // BuilderSample. Supplied by createFactoryApi's builderProps.
      screenApi={props.screenApi}
      renderPreview={(doc) => (
        // Preview never writes: onSave/onDelete are left out on purpose.
        <FactoryScreen
          document={doc}
          fetchOptions={props.fetchOptions}
          fetchRecords={props.fetchRecords}
          screens={Object.fromEntries((props.screens || []).filter((s) => s.document).map((s) => [s.id, s.document]))}
          controls={props.controls}
        />
      )}
    />
  )
}

/**
 * A saved screen, running. Saves itself in the background — there is no submit.
 *
 * @prop document     a screen document (an invalid one renders its problems, loudly)
 * @prop record       the record to open (omit for a new one)
 * @prop recordKey    the id field on a record (default 'id')
 * @prop onSave       async (values, { id, source, document }) → the saved record, with its id
 * @prop fetchOptions async ({ table }) → [{ id, name }] — rows for table dropdowns
 * @prop fetchRecords async ({ source }) → records — rows for lists
 * @prop fetchRecord  async ({ screen, id }) → record — Edit loads the record fresh
 * @prop onDelete     async ({ id, source, record }) → void
 * @prop onChange     (values) → void
 * @prop screens      { id → document } — the screens a list's Edit / New open in a popup
 * @prop loadScreen   async (id) → document — for screens not in `screens`
 * @prop controls     control registry (default: built-ins)
 * @prop hooks        your FactoryHooks subclass (get / save / delete / actions) — also used by the popup
 * @prop urlKey       keep the open step of each stepper in the URL (<urlKey>Steps); never passed to the popup
 */
export function FactoryScreen(props) {
  const ctrl = useFactoryScreen(props)
  // Whether the popup's form holds unsaved changes — its × asks before
  // dropping them, as its Cancel does.
  const popupDirty = useRef(false)
  const closePopup = () => {
    // eslint-disable-next-line no-alert
    if (popupDirty.current && typeof window !== 'undefined' && !window.confirm('Discard your unsaved changes?')) return
    popupDirty.current = false
    ctrl.closeEditor()
  }
  return (
    <ScreenSample
      ctrl={ctrl}
      className={props.className}
      style={props.style}
      // A form inside this one: the same component again, saving into its own
      // table, checked and saved by this one's Save (see useFactoryScreen).
      // Keyed by the form, never by this record's id — a new record's first
      // save changes that id while the subform is being saved.
      renderSubform={(node, sub) => (
        <FactoryScreen
          key={`${node.id}:${sub.document.id}`}
          document={sub.document}
          record={sub.record || undefined}
          link={node.props.belongsTo}
          onReady={(api) => ctrl.registerSubform(node.id, api)}
          onDirtyChange={(d) => ctrl.subformDirty(node.id, d)}
          recordKey={props.recordKey}
          onSave={props.onSave}
          fetchOptions={props.fetchOptions}
          fetchRecord={props.fetchRecord}
          fetchRecords={props.fetchRecords}
          onDelete={props.onDelete}
          uploadFile={props.uploadFile}
          fileUrl={props.fileUrl}
          screens={props.screens}
          loadScreen={props.loadScreen}
          controls={props.controls}
          hooks={props.hooks}
        />
      )}
      renderPopup={(popup) => (
        <ScreenModal
          title={popup.document ? popup.document.name : 'Loading…'}
          width={popup.document ? popup.document.width : undefined}
          onClose={closePopup}
        >
          {popup.error && <div className="xeplr-factory-invalid" role="alert">{popup.error}</div>}
          {popup.loading && <div className="xeplr-factory-hint">Loading…</div>}
          {popup.document && (
            // The same component, one level down. Its Save refreshes the list
            // behind the popup and closes it; Cancel closes it unsaved.
            <FactoryScreen
              key={`${popup.screenId}:${popup.record ? popup.record[ctrl.recordKey] : 'new'}`}
              document={popup.document}
              record={popup.record}
              // What the sub-table calls it with: the column pointing back at
              // the record this list is on. Hidden on the form when the
              // screen says a field is filled in by whoever opens it.
              params={popup.params || undefined}
              recordKey={props.recordKey}
              onSave={ctrl.popupSave}
              fetchOptions={props.fetchOptions}
              fetchRecord={props.fetchRecord}
              fetchRecords={props.fetchRecords}
              onDelete={props.onDelete}
              screens={props.screens}
              loadScreen={props.loadScreen}
              controls={props.controls}
              hooks={props.hooks}
              onDone={() => { popupDirty.current = false; ctrl.closeEditor() }}
              onDirtyChange={(d) => { popupDirty.current = d }}
            />
          )}
        </ScreenModal>
      )}
    />
  )
}

/**
 * A FLOW, running: one screen at a time, and the run decides which comes next.
 *
 * The journey is not in this page. It asks the run what to show, renders that
 * screen — which saves itself into its own table, as anywhere else — and hands
 * back what was filled in; the arrows leaving that step decide the rest.
 *
 * @prop flowKey    the flow to start
 * @prop runId      a run to pick up instead of starting one
 * @prop startRun   async (flowKey) → { runId, status, stepKey, screen }
 * @prop loadRun    async (runId) → { runId, status, stepKey, screen, values }
 * @prop submitRun  async (runId, values, recordId) → { status, stepKey, screen }
 * @prop onStep     (step) → void — each move, for the address bar
 * @prop onFinish   (run) → void — the journey is over
 * @prop renderDone what to show at the end (default: a plain "All done")
 * Everything a screen needs — loadScreen, onSave, fetchOptions, uploadFile… —
 * is passed straight through, so `{...factory.screenProps}` covers it.
 */
export function FlowRunner(props) {
  const run = useFlowRun(props)
  const screen = useFactoryScreen({
    ...props,
    document: run.document || EMPTY_SCREEN,
    record: run.values || undefined,
    // What the flow called this screen with — its step's own input, resolved
    // by the engine. A field bound to {params.x} is filled from here.
    params: run.given || undefined
  })
  return (
    <FlowRunnerSample
      run={run}
      screen={screen}
      title={props.title}
      renderDone={props.renderDone}
      className={props.className}
      style={props.style}
    />
  )
}

// A screen the runner can hold before the run has said what to show. Valid, so
// the controller has nothing to complain about, and never drawn.
const EMPTY_SCREEN = {
  kind: 'xeplr-screen', version: 1, id: 'flow_waiting', name: 'Waiting',
  units: 'fraction', aspect: 1, width: 800, nodes: []
}

/**
 * The FLOW designer, ready-made: screens on a canvas, arrows between them.
 *
 * Saves itself once what is drawn makes sense; Publish is deliberate, because
 * a published flow is what people walk through.
 *
 * @prop flow       the flow to edit (omit for a new one)
 * @prop name       name for a new flow
 * @prop screens    [{ id, name }] — the published screens a step can show
 * @prop loadScreen async (id) → the screen document, so an arrow can offer its fields
 * @prop onSave     async (flow) → void
 * @prop onPublish  async (key) → void
 * @prop onChange   (flow) → void
 * @prop urlKey     keep the selected step in the URL (<urlKey>Selected)
 */
export function FlowBuilder(props) {
  const ctrl = useFlowBuilder(props)
  return <FlowBuilderSample ctrl={ctrl} className={props.className} style={props.style} />
}

/**
 * The FLOW designer as a list — the screens of a journey down the left; for
 * the one picked, its form (Form design), the app's functions that run around
 * its records (Events) and where it goes next (Navigation). The design is
 * FlowDesignerSample; its controllers are useFlowBuilder, useScreenEvents and
 * useFunctionCatalog, for a custom design to use directly.
 *
 * @prop flow, name, screens, loadScreen, onSave, onPublish, onChange  as FlowBuilder
 * @prop listFunctions  async () → [{ name, event, description }] — the app's registered functions
 * @prop loadDraft      async (screenId) → { document } — a step's screen, to set its events
 * @prop saveDraft      async (document) → void
 * @prop publishScreen  async (document) → { version } — makes a screen's events take effect
 * @prop builderProps   what FactoryBuilder needs for the Form design tab (createFactoryApi's builderProps)
 * @prop urlKey         keep the selected step and tab in the URL (<urlKey>Selected, <urlKey>Tab)
 */
export function FlowDesigner(props) {
  const ctrl = useFlowBuilder(props)
  const catalog = useFunctionCatalog({ listFunctions: props.listFunctions })
  // The step open on the right: the one picked, else the first — a journey
  // opened with nothing in the URL shows its start, not a blank page.
  const step = ctrl.selectedStep || ctrl.flow.steps[0] || null
  const events = useScreenEvents({
    screen: step ? step.screen : null,
    loadDraft: props.loadDraft,
    saveDraft: props.saveDraft,
    publish: props.publishScreen,
    functions: catalog.functions
  })
  const [tab, setTab] = useUrlTab(props.urlKey, 'settings')
  return (
    <FlowDesignerSample
      ctrl={ctrl}
      step={step}
      events={events}
      catalog={catalog}
      tab={tab}
      onTab={setTab}
      className={props.className}
      style={props.style}
      renderFormDesign={() => (events.document ? (
        <FactoryBuilder
          key={events.document.id}
          {...(props.builderProps || {})}
          document={events.document}
          // One draft, two editors: the builder's changes become the
          // document Events sets functions on (useScreenEvents.adopt).
          onChange={events.adopt}
          screens={(props.screens || []).map((s) => ({ id: s.id, name: s.name }))}
        />
      ) : (
        <div className="xeplr-factory-hint">{events.error || 'Opening the screen…'}</div>
      ))}
    />
  )
}

/**
 * <FlowDesigner>, wired to an app's two API clients — what an app's
 * /configure/flows/:key page renders, so the wiring lives here and not, copied
 * and drifting, in every generated app.
 *
 * Loads the flow and the app's FORMS (screens with fields of their own — a
 * step shows one to be filled in) and hands everything else straight on.
 *
 * @prop factory   createFactoryApi(…) — screens, drafts, publish, the app's functions
 * @prop flows     createFlowsApi(…) — load, save, publish the flow
 * @prop flowKey   the flow to open
 * @prop urlKey    keep the selected step and tab in the URL
 */
export function FlowDesignerPage({ factory, flows, flowKey, urlKey, className, style }) {
  const [flow, setFlow] = useState(null)
  const [screens, setScreens] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let gone = false
    setFlow(null); setError(null)
    Promise.all([flows.loadFlow(flowKey), loadScreens(factory)]).then(([f, list]) => {
      if (gone) return
      setFlow(f)
      setScreens(list.filter((s) => s.fields && s.fields.length).map((s) => ({ id: s.key, name: s.name })))
    }, (e) => { if (!gone) setError(e.message || `Could not open "${flowKey}"`) })
    return () => { gone = true }
  }, [factory, flows, flowKey])

  if (error) return <div className="xeplr-factory-invalid" role="alert">{error}</div>
  if (!flow || !screens) return <div className="xeplr-factory-hint">Opening the flow…</div>
  return (
    <FlowDesigner
      flow={flow}
      screens={screens}
      loadScreen={factory.loadScreen}
      onSave={flows.saveFlow}
      onPublish={flows.publishFlow}
      listFunctions={factory.listFunctions}
      loadDraft={factory.loadDraft}
      saveDraft={factory.saveDraft}
      publishScreen={factory.publish}
      builderProps={factory.builderProps}
      urlKey={urlKey}
      className={className}
      style={style}
    />
  )
}
