// AN AUTOCOMPLETE FIELD — text the person types, with suggestions an app
// function works out as they type (a product from the shop, a customer by
// name). A suggestion is help, not a rule: whatever is typed is saved.
//
//   { type: 'autocomplete', props: { name: 'name', label: 'Product',
//     suggestFrom: 'productSuggestions', minChars: 2 } }
//
// The function is registered with @xeplr/actions under event "suggest" and
// named in the screen — never in the request. It is given ctx.query.q and
// returns suggestions:
//
//   [{ value: 'Silver Gallop Horse', label?, sub?: 'SKU GA-HR-01', image?: 'https://…',
//      fill?: { sku: 'GA-HR-01', productImage: 'https://…' } }]
//
// Picking one sets the field to `value`, and every field named in `fill` that
// is on the same screen (any other name is left alone — a function written for
// one screen may be named on another).
//
// Pure: no React. The server (@xeplr/factory) checks what the function
// returns with the same suggestionsOf(); the web view is in designs/ControlView.jsx.

import { inputNodes } from './document.js'

export const SUGGEST_EVENT = 'suggest'

/** Most suggestions one search shows. */
export const MAX_SUGGESTIONS = 20

/** Characters typed before the first search, unless the field says. */
export const DEFAULT_MIN_CHARS = 2

/** Longest search sent. */
export const MAX_SUGGEST_QUERY = 200

const text = (v) => (v === undefined || v === null ? '' : String(v))

/**
 * What a suggest function returned, as suggestions: only those with a value,
 * each { value, label, sub?, image?, fill? } with text values, at most
 * MAX_SUGGESTIONS. Anything else (not a list, a bad entry) is dropped.
 */
export function suggestionsOf(out) {
  if (!Array.isArray(out)) return []
  const list = []
  out.forEach((s) => {
    if (list.length >= MAX_SUGGESTIONS || !s || typeof s !== 'object') return
    const value = text(s.value).trim()
    if (!value) return
    const one = { value, label: text(s.label).trim() || value }
    if (s.sub !== undefined && s.sub !== null && text(s.sub).trim()) one.sub = text(s.sub).trim()
    if (typeof s.image === 'string' && s.image.trim()) one.image = s.image.trim()
    if (s.fill && typeof s.fill === 'object' && !Array.isArray(s.fill)) {
      const fill = {}
      Object.keys(s.fill).forEach((k) => {
        const v = s.fill[k]
        if (v === undefined || (v !== null && typeof v === 'object')) return
        fill[k] = v
      })
      if (Object.keys(fill).length) one.fill = fill
    }
    list.push(one)
  })
  return list
}

/** Whether a field asks for suggestions yet: `q` (trimmed) at least its minChars long. */
export function shouldSuggest(props, q) {
  const min = props && Number.isInteger(props.minChars) ? props.minChars : DEFAULT_MIN_CHARS
  return text(q).trim().length >= Math.max(1, min)
}

/**
 * What picking a suggestion writes: { fieldName: value } — the field itself,
 * then each `fill` whose name is another field on the screen.
 */
export function pickValues(doc, node, suggestion) {
  const out = { [node.props.name]: suggestion.value }
  const fill = suggestion.fill || {}
  const names = new Set(inputNodes(doc).map((n) => n.props.name))
  Object.keys(fill).forEach((k) => {
    if (k !== node.props.name && names.has(k)) out[k] = fill[k]
  })
  return out
}
