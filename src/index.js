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
export { useFactoryScreen, normaliseOptions, AUTOSAVE_DELAY } from './useFactoryScreen.js'

// Designs
export { BuilderSample, ScreenSample, ListView, ScreenModal, ControlView, VIEWS, Palette, DRAG_TYPE, PropertyPanel, EDITORS } from './designs/index.js'

// Ready-made
export { FactoryBuilder, FactoryScreen } from './pages.jsx'
