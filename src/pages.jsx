import { useFactoryBuilder } from './useFactoryBuilder.js'
import { useFactoryScreen } from './useFactoryScreen.js'
import { BuilderSample, ScreenSample, ScreenModal } from './designs/index.js'

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
 * @prop onDelete     async ({ id, source, record }) → void
 * @prop onChange     (values) → void
 * @prop screens      { id → document } — the screens a list's Edit / New open in a popup
 * @prop loadScreen   async (id) → document — for screens not in `screens`
 * @prop controls     control registry (default: built-ins)
 */
export function FactoryScreen(props) {
  const ctrl = useFactoryScreen(props)
  return (
    <ScreenSample
      ctrl={ctrl}
      className={props.className}
      style={props.style}
      renderPopup={(popup) => (
        <ScreenModal
          title={popup.document ? popup.document.name : 'Loading…'}
          width={popup.document ? popup.document.width : undefined}
          onClose={ctrl.closeEditor}
        >
          {popup.error && <div className="xeplr-factory-invalid" role="alert">{popup.error}</div>}
          {popup.loading && <div className="xeplr-factory-hint">Loading…</div>}
          {popup.document && (
            // The same component, one level down: the edit screen saves itself,
            // and every save refreshes the list behind the popup.
            <FactoryScreen
              key={`${popup.screenId}:${popup.record ? popup.record[ctrl.recordKey] : 'new'}`}
              document={popup.document}
              record={popup.record}
              recordKey={props.recordKey}
              onSave={ctrl.popupSave}
              fetchOptions={props.fetchOptions}
              fetchRecords={props.fetchRecords}
              onDelete={props.onDelete}
              screens={props.screens}
              loadScreen={props.loadScreen}
              controls={props.controls}
            />
          )}
        </ScreenModal>
      )}
    />
  )
}
