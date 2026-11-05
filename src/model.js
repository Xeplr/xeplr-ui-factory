// The model alone — no React, no CSS. Runs in node: a server checking a
// submission, the CLI, tests, or Claude writing a screen.
//
//   import { screenFromSpec, validateDocument, formSchema } from '@xeplr/ui-factory/model'

export { CONTROLS, OPTION_ID, OPTION_LABEL, LABEL_VARIANTS, LABEL_PRESETS, LIST_ACTIONS, STYLE_KEYS, SCREEN_STYLE_KEYS, FONT_FAMILIES, LAYOUTS, CHOICE_TYPES, STEP_LIMIT, MULTI_SEPARATOR, FILE_KINDS, MAX_FILE_MB, IMAGE_EXTENSIONS, FILE_SOURCES, MAX_FILES, isImageFile, filePicker, acceptList, controlGroups, withControls } from './controls.js'
export {
  DOCUMENT_KIND, DOCUMENT_VERSION, DEFAULT_ASPECT, DEFAULT_WIDTH, MARGIN, GAP,
  createScreen, renameScreen, setScreenProperty, addControl, moveNode, setNodeProperty, getNodeProperty, removeNodes,
  inputNodes, readingOrder, contentBottom, camelName, slugify, uniqueFieldName, nextPosition,
  screenParams, paramsText, setScreenParams,
  steppers, stepsOf, stepOf, setNodeStep, nodesForSteps, resolveStep, reachableStep, nextOpenStep
} from './document.js'
export { validateDocument, assertValidDocument } from './validateDocument.js'
// A screen's events: functions picked by name, run on the server.
export { SCREEN_EVENTS, SCREEN_EVENT_KEYS, DECIDE_EVENT, FUNCTION_NAME, screenFunctions, missingFunctions, functionProblems, setEvent, functionsFor } from './events.js'
// Buttons and lists whose rows a function works out — names and values only.
export {
  BUTTON_EVENT, LIST_ROWS_EVENT, ROW_DETAILS_EVENT, BUTTON_VARIANTS, COLUMN_DISPLAYS, LIST_LAYOUTS, BADGE_TONES, NOTE_INPUT, FILES_INPUT, CONDITION_OPERATORS,
  conditionMet, buttonShown, buttonDisabled, buttonPressed, screenButtons, buttonById, buttonInput, askFile, askFileProblem, askFields, askFieldStart, askFieldValues, ASK_FIELD_TYPES, nodeFunctions, paramProblems, optionValues
} from './buttons.js'
// Which pages are drawn from documents and which are web only (ui/pages.json).
export { checkInventory, routesIn, pageWarnings, webOnlyMenus } from './pagesInventory.js'
export { formSchema, initialValues, parseInput, validateValues, fieldError, sameId, optionValue, chooseable, saveState, recordValues, displayValue, fileLabel, isMultiFile, toDbValue, fromDbValue, listColumns, listSource } from './values.js'
export { screenFromSpec, screensFromSpec, entityNames, SPEC_HEIGHTS, ROW_GAP } from './generate.js'
export { scaffoldEntity } from './scaffold.js'
export { getAtPath, setAtPath } from './propertyPath.js'
export { createFactoryApi } from './remote.js'
export {
  STANDARD_COLUMNS, RESERVED_COLUMNS, MAX_IDENTIFIER,
  columnForField, tableForScreen, columnSql, widening, diffTables, migrationFor, nextMigrationName,
  createStatements, addStatements, alterStatement, dropStatement, columnFromDatabase, planTableChange, conversionFor
} from './tableSchema.js'
// A value with a {params.x} token is a binding; a plain value is a literal.
export { resolveBinding, isBinding, previousBinding } from './values.js'
// A code people can read out, unlike the record's own key.
export { codeFields, countedFields, generateCode } from './values.js'
export { FIELD_PRESETS, PATTERNS, INPUT_TYPES, presetFor, presetProps, suggestPreset, presetGroup, presetHints, convertField } from './presets.js'
export { createFlowsApi } from './flows.js'
export {
  FLOW_KIND, FLOW_VERSION, FLOW_END, FLOW_OPERATORS, VALUELESS_OPERATORS,
  createFlow, flowKey, addStep, uniqueStepKey, moveStep, setStep, removeStep,
  addTransition, setTransition, removeTransition, firstStep, reachableSteps, layoutFlow, validateFlow, describeWhen,
  arrowTargets, navigationOf, setNavigation
} from './flow.js'
// A function-fed list's date range: presets → days, and what a day is.
export { DATE_PRESETS, DATE_PRESET_VALUES, resolveRange, customRange, isDay, dayOf } from './listRange.js'
