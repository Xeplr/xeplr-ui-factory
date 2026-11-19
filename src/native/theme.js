// THE PHONE APP'S LOOK — colours by name, for React Native. A document only
// ever says a tone's NAME ("warning", BADGE_TONES); this file decides what it
// looks like on a phone, dark or light. The app may hand its own palette in
// through <NativeTheme value={…}>; without one the phone's own setting picks
// (dark when it says nothing).
import { createContext, createElement, useContext } from 'react'
import { useColorScheme } from 'react-native'

export const DARK = Object.freeze({
  dark: true,
  plane: '#0f1115',
  surface: '#181b21',
  raised: '#20242c',
  border: '#2c313b',
  ink: '#e8eaee',
  muted: '#9aa1ad',
  accent: '#7b8cff',
  accentInk: '#0f1115',
  field: '#12151a',
  danger: '#ff6b6b',
  tones: {
    accent: { fg: '#a9b4ff', bg: '#262c4d' },
    success: { fg: '#6fd39a', bg: '#173326' },
    warning: { fg: '#f3c069', bg: '#3a2e14' },
    danger: { fg: '#ff8a8a', bg: '#3d1d1f' },
    muted: { fg: '#a3a9b4', bg: '#262a31' },
    info: { fg: '#7cc4f5', bg: '#15303f' },
    violet: { fg: '#c4a3ff', bg: '#2e2346' }
  }
})

export const LIGHT = Object.freeze({
  dark: false,
  plane: '#f3f4f7',
  surface: '#ffffff',
  raised: '#f7f8fa',
  border: '#dde1e8',
  ink: '#1b1f27',
  muted: '#646c79',
  accent: '#4b5fd6',
  accentInk: '#ffffff',
  field: '#ffffff',
  danger: '#c62828',
  tones: {
    accent: { fg: '#3346b8', bg: '#e7eafc' },
    success: { fg: '#1d7a44', bg: '#e1f4e8' },
    warning: { fg: '#8a5a00', bg: '#fbf0d6' },
    danger: { fg: '#b42323', bg: '#fbe3e3' },
    muted: { fg: '#5b6370', bg: '#eceef2' },
    info: { fg: '#1b6c99', bg: '#e0f0fa' },
    violet: { fg: '#6a3fb8', bg: '#eee6fb' }
  }
})

const ThemeContext = createContext(null)

/** The app's own palette for every screen under it (optional). */
export function NativeTheme({ value, children }) {
  return createElement(ThemeContext.Provider, { value }, children)
}

/** The palette in use: the app's, else the phone's setting (dark by default). */
export function useNativeTheme() {
  const given = useContext(ThemeContext)
  const scheme = useColorScheme()
  return given || (scheme === 'light' ? LIGHT : DARK)
}

/** A tone's two colours; an unknown name is the accent. */
export function toneOf(theme, name) {
  return theme.tones[name] || theme.tones.accent
}
