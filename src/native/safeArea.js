// THE PHONE'S NOTCH AND HOME BAR — how far a full-screen sheet keeps clear of
// them. The app knows (react-native-safe-area-context's useSafeAreaInsets)
// and hands them in with <NativeInsets value={insets}>; @xeplr/ui-factory
// itself depends on no native library. Without them: nothing kept clear.
import { createContext, createElement, useContext } from 'react'

const NONE = Object.freeze({ top: 0, bottom: 0, left: 0, right: 0 })
const InsetsContext = createContext(NONE)

export function NativeInsets({ value, children }) {
  return createElement(InsetsContext.Provider, { value: value || NONE }, children)
}

export function useSafeAreaInsets() {
  return useContext(InsetsContext) || NONE
}
