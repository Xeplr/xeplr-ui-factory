// The model alone — no React, no CSS. Runs in node: a server checking a
// submission, the CLI, tests, or Claude writing a screen.
//
//   import { screenFromSpec, validateDocument, formSchema } from '@xeplr/ui-factory/model'

export { CONTROLS, OPTION_ID, OPTION_LABEL, LABEL_VARIANTS, BUTTON_ACTIONS, controlGroups, withControls } from './controls.js'
export {
  DOCUMENT_KIND, DOCUMENT_VERSION, DEFAULT_ASPECT, MARGIN, GAP,
  createScreen, renameScreen, addControl, moveNode, setNodeProperty, getNodeProperty, removeNodes,
  inputNodes, readingOrder, contentBottom, camelName, slugify, uniqueFieldName, nextPosition
} from './document.js'
export { validateDocument, assertValidDocument } from './validateDocument.js'
export { formSchema, initialValues, parseInput, validateValues, fieldError, sameId, optionValue } from './values.js'
export { screenFromSpec, SPEC_HEIGHTS, ROW_GAP } from './generate.js'
export { getAtPath, setAtPath } from './propertyPath.js'
