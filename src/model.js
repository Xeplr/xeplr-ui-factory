// The model alone — no React, no CSS. Runs in node: a server checking a
// submission, the CLI, tests, or Claude writing a screen.
//
//   import { screenFromSpec, validateDocument, formSchema } from '@xeplr/ui-factory/model'

export { CONTROLS, OPTION_ID, OPTION_LABEL, LABEL_VARIANTS, LABEL_PRESETS, LIST_ACTIONS, STYLE_KEYS, SCREEN_STYLE_KEYS, FONT_FAMILIES, controlGroups, withControls } from './controls.js'
export {
  DOCUMENT_KIND, DOCUMENT_VERSION, DEFAULT_ASPECT, DEFAULT_WIDTH, MARGIN, GAP,
  createScreen, renameScreen, setScreenProperty, addControl, moveNode, setNodeProperty, getNodeProperty, removeNodes,
  inputNodes, readingOrder, contentBottom, camelName, slugify, uniqueFieldName, nextPosition
} from './document.js'
export { validateDocument, assertValidDocument } from './validateDocument.js'
export { formSchema, initialValues, parseInput, validateValues, fieldError, sameId, optionValue, saveState, recordValues, displayValue, listColumns, listSource } from './values.js'
export { screenFromSpec, SPEC_HEIGHTS, ROW_GAP } from './generate.js'
export { getAtPath, setAtPath } from './propertyPath.js'
