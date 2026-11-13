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

// ── tag mode: several values, each with a quantity ──────────────────────────
//
//   { type: 'autocomplete', props: { name: 'addProducts', suggestFrom: 'productSuggestions',
//     multiple: true, quantity: true, maxTags?: 50 } }
//
// Each pick (or Enter on typed text) adds a CHIP; the same value again adds to
// its quantity. The value is a list — [{ value, label?, sub?, image?, fill?, qty? }]
// (qty only with `quantity`) — handed to the screen's events (ctx.values) and
// never written: a tag field has no column. What the app keeps of it is its own.

/** Most chips a tag field holds, whatever maxTags says. */
export const MAX_TAGS = 100

/** Largest quantity on one chip. */
export const MAX_TAG_QTY = 100000

/** Longest chip value. */
export const MAX_TAG_VALUE = 255

/** A tag field: an autocomplete holding several values, with no column of its own. */
export function isTagField(node) {
  return Boolean(node && node.type === 'autocomplete' && node.props && node.props.multiple)
}

/** How many chips this field takes. */
export function tagLimit(props) {
  const n = props && props.maxTags
  return Number.isInteger(n) && n >= 1 && n <= MAX_TAGS ? n : MAX_TAGS
}

/**
 * The chips after picking `suggestion` (or typing its value): a new chip, or
 * the same value's quantity one more. `withQty`: chips carry a qty.
 */
export function addTag(list, suggestion, withQty) {
  const tags = Array.isArray(list) ? list : []
  const value = text(suggestion && suggestion.value).trim()
  if (!value) return tags
  const at = tags.findIndex((t) => t && t.value === value)
  if (at !== -1) {
    if (!withQty) return tags
    return tags.map((t, i) => (i === at ? { ...t, qty: Math.min(MAX_TAG_QTY, (Number(t.qty) || 1) + 1) } : t))
  }
  const one = suggestionsOf([suggestion])[0] || { value, label: value }
  return [...tags, withQty ? { ...one, qty: 1 } : one]
}

/** The chips with one chip's quantity set (typed text: kept as typed; checked on save). */
export function setTagQty(list, index, qty) {
  return (Array.isArray(list) ? list : []).map((t, i) => (i === index ? { ...t, qty } : t))
}

/** The chips without one. */
export function removeTag(list, index) {
  return (Array.isArray(list) ? list : []).filter((_, i) => i !== index)
}

/**
 * A tag field's value, checked: { tags, error }. Both sides use it — the form
 * before Save, the server before the screen's events see it. `tags` is the
 * clean list (text trimmed, qty a whole number with `quantity`, without it
 * none); `error` says what is wrong, or is null.
 */
export function tagsOf(node, value) {
  const p = (node && node.props) || {}
  const label = p.label || p.name || 'This field'
  if (value === undefined || value === null || value === '') value = []
  if (!Array.isArray(value)) return { tags: [], error: `${label} must be a list` }
  const limit = tagLimit(p)
  if (value.length > limit) return { tags: [], error: `${label}: at most ${limit}` }
  const tags = []
  for (let i = 0; i < value.length; i++) {
    const t = value[i]
    if (!t || typeof t !== 'object' || Array.isArray(t)) return { tags: [], error: `${label}: entry ${i + 1} is not a value` }
    const v = text(t.value).trim()
    if (!v) return { tags: [], error: `${label}: entry ${i + 1} has no value` }
    if (v.length > MAX_TAG_VALUE) return { tags: [], error: `${label}: "${v.slice(0, 40)}…" is longer than ${MAX_TAG_VALUE} characters` }
    if (t.fill !== undefined && t.fill !== null) {
      if (typeof t.fill !== 'object' || Array.isArray(t.fill) || Object.values(t.fill).some((x) => x !== null && typeof x === 'object')) {
        return { tags: [], error: `${label}: "${v}" fills in something that is not a plain value` }
      }
    }
    const one = suggestionsOf([{ ...t, value: v }])[0]
    if (p.quantity) {
      const raw = t.qty === undefined || t.qty === null || t.qty === '' ? 1 : t.qty
      const q = typeof raw === 'number' ? raw : Number(String(raw).trim())
      if (!Number.isInteger(q) || q < 1 || q > MAX_TAG_QTY) return { tags: [], error: `${label}: how many of "${v}" must be a whole number from 1 to ${MAX_TAG_QTY}` }
      one.qty = q
    }
    tags.push(one)
  }
  if (!tags.length && p.required) return { tags, error: `${label}: add at least one` }
  return { tags, error: null }
}
