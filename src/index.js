// @xeplr/ui-factory — design data-entry screens on @xeplr/ui-canvas, save them
// as JSON, render them as working forms.
//
// Three ways in, per the xeplr-ui-* convention:
//   1. <FactoryBuilder> / <FactoryScreen> as they are
//   2. useFactoryBuilder / useFactoryScreen with your own design
//   3. the model alone — '@xeplr/ui-factory/model', no React, runs in node

export * from './model.js'

// Controllers
export { useFactoryBuilder } from './useFactoryBuilder.js'
export { useFactoryScreen, normaliseOptions } from './useFactoryScreen.js'
// This app's screens, shaped for another package's designer — see
// useScreenSource.js. Two props instead of a page of glue per application.
export { useScreenSource } from './useScreenSource.js'
export { describeScreen, screenStub, loadScreens, keyFromName, editScreenOf, masterForms, formKeyOf, deleteForm } from './screenSource.js'
// Making a master: the one form shape every application repeats.
export { masterSpec, createMaster, possibleParents, singularOf, MASTER_LABEL, MASTER_ORDER, childSpec, createChildTable } from './masters.js'
export { useFlowRun } from './useFlowRun.js'
export { useFlowBuilder, FLOW_AUTOSAVE_DELAY } from './useFlowBuilder.js'
// A screen's events, set from outside its builder, and the app's functions to pick from.
export { useScreenEvents } from './useScreenEvents.js'
export { useFunctionCatalog } from './useFunctionCatalog.js'
export { useUrlTab } from './useUrlPlaces.js'

// Designs
export { BuilderSample, ScreenSample, ListView, ScreenModal, FlowRunnerSample, FlowBuilderSample, FlowDesignerSample, FLOW_DESIGNER_TABS, ScreenEditorSample, ControlView, VIEWS, Palette, DRAG_TYPE, PropertyPanel, EDITORS } from './designs/index.js'

// Front-end hooks — extend FactoryHooks, override what you need, call super
export { FactoryHooks } from './hooks.js'

// Ready-made
export { FactoryBuilder, FactoryScreen, FlowRunner, FlowBuilder, FlowDesigner, FlowDesignerPage } from './pages.jsx'
