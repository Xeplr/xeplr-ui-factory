import { useRef } from 'react'
import { useFactoryBuilder } from './useFactoryBuilder.js'
import { useFactoryScreen } from './useFactoryScreen.js'
import { useFlowRun } from './useFlowRun.js'
import { useFlowBuilder } from './useFlowBuilder.js'
import { BuilderSample, ScreenSample, ScreenModal, FlowRunnerSample, FlowBuilderSample } from './designs/index.js'

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
 */
export function FactoryBuilder(props) {
  const ctrl = useFactoryBuilder(props)
  return (
    <BuilderSample
      ctrl={ctrl}
      className={props.className}
      style={props.style}
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
    record: run.values || undefined
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
 */
export function FlowBuilder(props) {
  const ctrl = useFlowBuilder(props)
  return <FlowBuilderSample ctrl={ctrl} className={props.className} style={props.style} />
}
