import { useFactoryBuilder } from './useFactoryBuilder.js'
import { useFactoryScreen } from './useFactoryScreen.js'
import { BuilderSample, ScreenSample } from './designs/index.js'

/**
 * The builder, ready-made. Saves itself — there is no Save button.
 *
 * @prop document     the screen to edit (omit for a new one)
 * @prop name         name for a new screen
 * @prop onSave       async (document) → void — called automatically after edits, only with a valid document
 * @prop onChange     (document) → void — every edit
 * @prop listTables   async () → [{ id, name }] | string[] — for "Saves to", lists and table dropdowns
 * @prop fetchOptions async ({ table }) → [{ id, name }] — Preview with real options
 * @prop fetchRecords async ({ source }) → records — Preview with real records
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
        <FactoryScreen document={doc} fetchOptions={props.fetchOptions} fetchRecords={props.fetchRecords} controls={props.controls} />
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
 * @prop controls     control registry (default: built-ins)
 */
export function FactoryScreen(props) {
  const ctrl = useFactoryScreen(props)
  return <ScreenSample ctrl={ctrl} className={props.className} style={props.style} />
}
