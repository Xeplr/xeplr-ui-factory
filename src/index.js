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
export { describeScreen, screenStub, loadScreens, keyFromName, editScreenOf } from './screenSource.js'
export { useFlowRun } from './useFlowRun.js'
export { useFlowBuilder, FLOW_AUTOSAVE_DELAY } from './useFlowBuilder.js'

// Designs
export { BuilderSample, ScreenSample, ListView, ScreenModal, FlowRunnerSample, FlowBuilderSample, ScreenEditorSample, ControlView, VIEWS, Palette, DRAG_TYPE, PropertyPanel, EDITORS } from './designs/index.js'

// Front-end hooks — extend FactoryHooks, override what you need, call super
export { FactoryHooks } from './hooks.js'

// Ready-made
export { FactoryBuilder, FactoryScreen, FlowRunner, FlowBuilder } from './pages.jsx'
