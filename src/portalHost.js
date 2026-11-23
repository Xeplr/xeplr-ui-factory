// WHERE A POPUP IS PORTALED. A popup is portaled out of the screen so a
// control's own box cannot clip it — but straight into <body> it also leaves
// the app's theme: @xeplr/ui-account's ThemeProvider sets the --xeplr-*
// colours on a `xeplr-theme-<name>` wrapper, not on :root, and a popup outside
// it falls back to the light defaults (a white dialog in a dark app). So it
// goes into that wrapper when there is one, and into <body> when there is not.
export function portalHost() {
  if (typeof document === 'undefined') return null
  return document.querySelector('[class*="xeplr-theme-"]') || document.body
}
