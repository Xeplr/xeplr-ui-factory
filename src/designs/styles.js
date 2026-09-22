// A control's `props.style` → CSS.
//
// Sizes are PIXELS at the screen's design width. `--xf-u` is one such pixel: a
// real pixel at the design width or wider, less on a narrower screen (see
// factory.css). So text stays exactly the size somebody chose, and only ever
// shrinks to keep the layout's proportions.

const u = (n) => `calc(${n} * var(--xf-u))`

/** Wrapper-level: the font the whole control uses. */
export function fieldStyle(style) {
  const s = style || {}
  return clean({ fontFamily: s.fontFamily })
}

/** The label above an input. */
export function labelStyle(style) {
  const s = style || {}
  return clean({
    fontSize: s.labelFontSize != null ? u(s.labelFontSize) : undefined,
    fontWeight: s.labelFontWeight,
    color: s.labelColor
  })
}

/** The input box itself, or a label control's text block. */
export function boxStyle(style) {
  const s = style || {}
  return clean({
    fontSize: s.fontSize != null ? u(s.fontSize) : undefined,
    fontWeight: s.fontWeight,
    fontStyle: s.fontStyle,
    textAlign: s.textAlign,
    color: s.color,
    background: s.background,
    borderColor: s.borderColor,
    borderWidth: s.borderWidth != null ? `${s.borderWidth}px` : undefined,
    borderStyle: s.borderWidth != null ? 'solid' : undefined,
    borderRadius: s.borderRadius != null ? u(s.borderRadius) : undefined
  })
}

/**
 * The screen's defaults, on its container: what every control inherits.
 *
 * A screen with no colours of its own follows the app's theme (factory.css).
 * One that sets them keeps them EVERYWHERE — its ink and paper become the
 * tokens the controls read, input boxes included — so a screen designed dark
 * ink on white is never shown as that ink on a dark theme's input box.
 */
export function screenStyle(doc) {
  const s = doc.style || {}
  return clean({
    '--xf-width': doc.width,
    '--xf-font': s.fontSize,
    '--xf-ink': s.color,
    '--xf-surface': s.background,
    '--xf-field-bg': s.background,
    fontFamily: s.fontFamily,
    color: s.color,
    background: s.background
  })
}

function clean(obj) {
  const out = {}
  Object.keys(obj).forEach((k) => { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') out[k] = obj[k] })
  return out
}
