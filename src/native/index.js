// @xeplr/ui-factory/native — the same screen documents, drawn with React
// Native components for a phone app. The controllers and the model are the
// web's own (useFactoryScreen, buttons.js, feed.js…); only the views differ.
//
//   import { NativeScreen } from '@xeplr/ui-factory/native'
//   <NativeScreen document={doc} {...factory.screenProps} record={rec} host={{ pickFile, pickDate, baseUrl }} />
//
// Needs react-native (a peer, optional for web-only apps). See README → "On a phone".
export { NativeScreen, NativeScreenView } from './NativeScreen.jsx'
// A whole phone app from what the server holds: a form's records, one record, the menu, the journeys.
export { NativeFormRecords, NativeRecord, NativeMenu, NativeFlows } from './pages.jsx'
export { NativeFlowRunner } from './NativeFlowRunner.jsx'
export { NativeHostProvider, useNativeHost } from './host.jsx'
export { phoneMenu, FORM_PREFIX } from '../phoneMenu.js'
export { NativeTheme, useNativeTheme, DARK, LIGHT, toneOf } from './theme.js'
export { NativeInsets } from './safeArea.js'
export { readableWhen } from './inputs.jsx'
export { useScreenDocument } from '../useScreenDocument.js'
// The pieces the screens are made of, for an app's own screens (sign-in, a menu) to look the same.
export { Btn, Field, Pill, Sheet, PickList, NativeLayer } from './parts.jsx'
