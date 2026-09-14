import { useFactoryBuilder } from './useFactoryBuilder.js'
import { useFactoryScreen } from './useFactoryScreen.js'
import { BuilderSample, ScreenSample } from './designs/index.js'

/**
 * The builder, ready-made.
 *
 * @prop document     the screen to edit (omit for a new one)
 * @prop name         name for a new screen
 * @prop onSave       async (document) → void — the app stores it; only called with a valid document
 * @prop onChange     (document) → void — every edit
 * @prop listTables   async () → [{ id, name }] | string[] — for "dropdown from a table"
 * @prop fetchOptions async ({ table }) → [{ id, name }] — enables Preview with real options
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
        <FactoryScreen document={doc} fetchOptions={props.fetchOptions} controls={props.controls} />
      )}
    />
  )
}

/**
 * A saved screen, running.
 *
 * @prop document     a screen document (an invalid one renders its problems, loudly)
 * @prop fetchOptions async ({ table }) → [{ id, name }] — rows for table dropdowns
 * @prop onSubmit     async (values, { document }) → void
 * @prop values       starting values, e.g. the record being edited
 * @prop controls     control registry (default: built-ins)
 */
export function FactoryScreen(props) {
  const ctrl = useFactoryScreen(props)
  return <ScreenSample ctrl={ctrl} className={props.className} style={props.style} />
}
