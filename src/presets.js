// READY-MADE FIELDS — an email, a phone number, an age, a gender… — so nobody
// has to remember that a LinkedIn profile is a URL with a particular shape, or
// that an age is a whole number between 0 and 130.
//
// A preset is NOT a new kind of control. It is a named set of props for one of
// the controls that already exist (a text box with an email keyboard and an
// email pattern; a radio group with three options), COPIED into the field when
// it is added or chosen. So:
//
//   · the document stays self-describing — the server, the CLI and Claude
//     read the rules off the field, not out of this file;
//   · every setting stays editable afterwards, like any other field's;
//   · changing a preset here never changes a form already made with it.
//
// The field remembers where it came from in `props.preset` (the key), which is
// what the builder's "Field type" shows. `props.preset: false` means "plain on
// purpose" — the builder stops suggesting one.
//
// Pure data and functions: no React. Runs in node, like controls.js.

import { CONTROLS, CHOICE_TYPES } from './controls.js'
import { camelName, uniqueFieldName } from './document.js'

// ── patterns ─────────────────────────────────────────────────────────────
// Strings, not RegExps: they are stored in the document and checked again on
// the server (schema-handler's `pattern`), with no flags — so any case that
// matters is spelled out.
export const PATTERNS = {
  email: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$',
  // A number people can type the way they write it: +44 20 7946 0958, (555) 010-9999.
  phone: '^\\+?[0-9][0-9 ().\\-]{5,18}[0-9]$',
  url: '^[Hh][Tt][Tt][Pp][Ss]?://[^\\s/]+\\.[^\\s/]+(/\\S*)?$',
  linkedin: '^[Hh][Tt][Tt][Pp][Ss]?://([a-zA-Z]{2,3}\\.)?[Ll][Ii][Nn][Kk][Ee][Dd][Ii][Nn]\\.[Cc][Oo][Mm]/(in|company|pub)/[^\\s/?#]+/?([?#]\\S*)?$',
  postalCode: '^[A-Za-z0-9][A-Za-z0-9 \\-]{1,8}[A-Za-z0-9]$'
}

/** How a text field's box behaves on a phone keyboard, and in autofill. */
export const INPUT_TYPES = ['text', 'email', 'tel', 'url']

// ── countries ────────────────────────────────────────────────────────────
// Stored as the ISO 3166 code (a stable id), shown by name. The names come
// from the runtime's own Intl data, in English, when the preset is applied —
// and are then part of the field like any options typed by hand.
const COUNTRY_CODES = (
  'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ ' +
  'DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG ' +
  'LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY ' +
  'PE PH PL PT PR QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM ' +
  'TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'
).split(' ')

function countryOptions() {
  let names = null
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }) } catch (_) { /* old runtime: codes only */ }
  return COUNTRY_CODES
    .map((code) => ({ id: code, name: (names && names.of(code)) || code }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const options = (...names) => names.map((name) => ({ id: camelName(name), name }))

// ── the catalogue ────────────────────────────────────────────────────────
// Palette order. `match` is how a LABEL is recognised ("LinkedIn URL" → the
// LinkedIn preset) — first match wins, so the specific ones come before the
// general ones they would also match (LinkedIn before Website).
//
//   key       stored in props.preset — never renamed
//   label     the palette's name for it, and the field's starting label
//   control   the control it is made of
//   props     what it sets on that control (copied)
//   size?     a starting height other than the control's own

export const FIELD_PRESETS = [
  {
    key: 'email', label: 'Email', control: 'text',
    match: /\be-?mail\b/i,
    props: { inputType: 'email', placeholder: 'name@example.com', validation: { maxLength: 254, pattern: PATTERNS.email, patternMessage: 'Enter an email address, like name@example.com' } }
  },
  {
    key: 'phone', label: 'Phone', control: 'text',
    match: /\b(phone|mobile|cell|telephone|whats ?app)\b|contact (no|number)/i,
    props: { inputType: 'tel', placeholder: '+1 555 010 9999', validation: { maxLength: 20, pattern: PATTERNS.phone, patternMessage: 'Enter a phone number — digits, spaces, + ( ) and - only' } }
  },
  {
    key: 'linkedin', label: 'LinkedIn profile', control: 'text',
    match: /linked\s*-?\s*in/i,
    props: { inputType: 'url', placeholder: 'https://www.linkedin.com/in/…', validation: { maxLength: 300, pattern: PATTERNS.linkedin, patternMessage: 'Enter a LinkedIn profile address, like https://www.linkedin.com/in/your-name' } }
  },
  {
    key: 'url', label: 'Website', control: 'text',
    match: /\b(website|web ?site|web address|url|homepage|home page|link)\b/i,
    props: { inputType: 'url', placeholder: 'https://example.com', validation: { maxLength: 2000, pattern: PATTERNS.url, patternMessage: 'Enter a web address starting with http:// or https://' } }
  },
  {
    key: 'age', label: 'Age', control: 'number',
    match: /^\s*age\b/i,
    props: { validation: { min: 0, max: 130, integer: true } }
  },
  {
    key: 'dateOfBirth', label: 'Date of birth', control: 'date',
    match: /\b(date of birth|birth ?date|birthday|d\.?o\.?b)\b/i,
    props: { validation: { notFuture: true } }
  },
  {
    key: 'gender', label: 'Gender', control: 'radio',
    match: /\b(gender|sex)\b/i,
    props: { layout: 'horizontal', data: { source: 'static', options: options('Male', 'Female', 'Others') } },
    size: { h: 0.08 }
  },
  {
    key: 'country', label: 'Country', control: 'dropdown',
    match: /\b(country|nationality)\b/i,
    props: () => ({ placeholder: 'Select a country…', data: { source: 'static', options: countryOptions() } })
  },
  {
    key: 'amount', label: 'Amount', control: 'number',
    match: /\b(amount|price|salary|cost|fee|budget|revenue|income|wage)\b/i,
    props: { placeholder: '0.00', validation: { min: 0 } }
  },
  {
    key: 'percentage', label: 'Percentage', control: 'number',
    match: /percent|%/i,
    props: { placeholder: '0–100', validation: { min: 0, max: 100 } }
  },
  {
    key: 'yesNo', label: 'Yes / No', control: 'radio',
    // Nothing to recognise it by — "Blocked?" could be a tick box as well.
    match: null,
    props: { layout: 'horizontal', data: { source: 'static', options: options('Yes', 'No') } },
    size: { h: 0.08 }
  },
  {
    key: 'postalCode', label: 'Postal code', control: 'text',
    match: /\b(postal ?code|post ?code|zip( ?code)?|pin ?code)\b/i,
    props: { validation: { maxLength: 10, pattern: PATTERNS.postalCode, patternMessage: 'Enter a postal code — letters, digits, spaces and - only' } }
  }
]

const BY_KEY = Object.fromEntries(FIELD_PRESETS.map((p) => [p.key, p]))

/** The preset with this key, or null. Accepts "preset:<key>" too — the palette's spelling. */
export function presetFor(key) {
  if (typeof key !== 'string') return null
  return BY_KEY[key.startsWith('preset:') ? key.slice(7) : key] || null
}

/** A fresh copy of what a preset puts on its control (never the shared object). */
export function presetProps(preset) {
  const p = typeof preset === 'string' ? presetFor(preset) : preset
  if (!p) return {}
  const props = typeof p.props === 'function' ? p.props() : p.props
  return { label: p.label, ...JSON.parse(JSON.stringify(props)), preset: p.key }
}

/** The preset a label reads like, or null — "LinkedIn URL" → linkedin. */
export function suggestPreset(label) {
  const text = String(label || '')
  if (!text.trim()) return null
  return FIELD_PRESETS.find((p) => p.match && p.match.test(text)) || null
}

/** The palette's "Common fields" group — shaped like controlGroups()' groups. */
export function presetGroup() {
  return {
    title: 'Common fields',
    controls: FIELD_PRESETS.map((p) => ({ type: 'preset:' + p.key, label: p.label, icon: p.control, preset: p.key }))
  }
}

// ── changing a field's type ──────────────────────────────────────────────

/** What a dropped setting is called, for the note the builder shows. */
const SETTING_WORDS = {
  minLength: 'min length', maxLength: 'max length', pattern: 'the pattern', patternMessage: 'the pattern message',
  min: 'the minimum', max: 'the maximum', integer: '"whole numbers only"', minItems: 'min choices', maxItems: 'max choices',
  notFuture: '"not in the future"', data: 'the options', default: 'the default value', placeholder: 'the placeholder',
  layout: 'the arrangement', accept: 'the file types', maxSize: 'the size limit', inputType: 'the keyboard type'
}

/**
 * A field becomes another kind — another control, or a preset — keeping what
 * still makes sense: where it is, its step, its label (unless it was only the
 * old type's own starting label), its field name (always, once it is a column;
 * otherwise it follows the label as a new field's does), required, and every
 * style the new control has.
 *
 * @param target   a control type ('number'), or a preset key ('email' / 'preset:email')
 * @param options.lockedNames  field names that are columns already — never renamed
 * @returns {{ document, node, dropped: string[] }} — dropped: what did not carry
 *          over, in words ("the pattern", "the options") for the builder to say
 */
export function convertField(doc, id, target, controls = CONTROLS, options = {}) {
  const node = doc.nodes.find((n) => n.id === id)
  if (!node) throw new Error(`No control "${id}"`)
  const from = controls[node.type]
  if (!from || !from.input) throw new Error(`"${id}" is not a field`)
  const preset = presetFor(target)
  const type = preset ? preset.control : target
  const def = controls[type]
  if (!def || !def.input) throw new Error(`"${target}" is not a field type or a ready-made field`)

  const old = node.props || {}
  const oldPreset = presetFor(old.preset)
  const fresh = preset ? presetProps(preset) : {}
  const allowed = new Set(def.props)
  const dropped = []
  const next = {}

  // The label is the person's — unless it is only what the old type started as
  // ("Text"), or, going from one ready-made field to another, the old one's.
  const startingLabels = [from.defaults && from.defaults.label, preset && oldPreset && oldPreset.label].filter(Boolean)
  const keepLabel = old.label && !startingLabels.includes(old.label)
  next.label = keepLabel ? old.label : (fresh.label || (def.defaults && def.defaults.label) || old.label)

  if (old.required !== undefined) next.required = old.required

  // Validation: a preset's rules replace the old ones; a plain type keeps the
  // rules it also has.
  const oldRules = old.validation || {}
  const rules = {}
  if (preset) Object.assign(rules, fresh.validation || {})
  else Object.keys(oldRules).forEach((k) => { if (def.validation.includes(k)) rules[k] = oldRules[k] })
  // Said out loud: every rule that did not carry over — except, going to
  // another ready-made field, the old one's own (replaced, as expected).
  Object.keys(oldRules).forEach((k) => {
    if (sameValue(rules[k], oldRules[k])) return
    if (preset && oldPreset && sameValue(oldRules[k], presetRule(oldPreset, k))) return
    if (k === 'patternMessage' && rules.pattern === undefined && oldRules.pattern !== undefined) return   // said with the pattern
    dropped.push(SETTING_WORDS[k] || k)
  })
  if (Object.keys(rules).length) next.validation = rules

  // Placeholder: the preset's, unless the person wrote their own.
  const startingPlaceholders = [from.defaults && from.defaults.placeholder, oldPreset && presetProps(oldPreset).placeholder].filter(Boolean)
  const theirPlaceholder = old.placeholder && !startingPlaceholders.includes(old.placeholder) ? old.placeholder : null
  if (allowed.has('placeholder')) {
    const value = theirPlaceholder || fresh.placeholder || (def.defaults && def.defaults.placeholder)
    if (value) next.placeholder = value
  } else if (theirPlaceholder) dropped.push(SETTING_WORDS.placeholder)

  // Options: a preset's, else the old ones if both are choice fields, else the
  // new type's empty start.
  if (CHOICE_TYPES.includes(type)) {
    next.data = fresh.data || (CHOICE_TYPES.includes(node.type) && old.data) || JSON.parse(JSON.stringify(def.defaults.data))
    if (allowed.has('layout')) next.layout = fresh.layout || old.layout || def.defaults.layout
  } else if (old.data && ((old.data.options || []).length || old.data.source === 'table')) dropped.push(SETTING_WORDS.data)

  if (fresh.inputType && allowed.has('inputType')) next.inputType = fresh.inputType
  ;['accept', 'maxSize'].forEach((k) => {
    if (old[k] === undefined) return
    if (allowed.has(k)) next[k] = old[k]; else dropped.push(SETTING_WORDS[k])
  })
  // A default is a value of the OLD kind; it carries only to the same control.
  if (old.default !== undefined) {
    if (type === node.type) next.default = old.default; else dropped.push(SETTING_WORDS.default)
  }
  // Anything else the new control starts with (a checkbox's defaults, say).
  Object.keys(def.defaults || {}).forEach((k) => {
    if (next[k] === undefined && k !== 'label' && allowed.has(k)) next[k] = JSON.parse(JSON.stringify(def.defaults[k]))
  })

  if (old.style) {
    const style = {}
    Object.keys(old.style).forEach((k) => { if ((def.styles || []).includes(k)) style[k] = old.style[k] })
    if (Object.keys(style).length) next.style = style
  }

  if (preset) next.preset = preset.key
  else if (old.preset === false) next.preset = false

  // The name: fixed once it is a column; otherwise it follows the label, as a
  // new field's does, when it was only ever the generated one.
  const locked = new Set(options.lockedNames || [])
  const others = { ...doc, nodes: doc.nodes.filter((n) => n.id !== id) }
  const generated = !old.name || locked.has(old.name) ? false : isGeneratedName(old, from, oldPreset)
  next.name = !old.name ? uniqueFieldName(others, camelName(next.label) || type)
    : generated ? uniqueFieldName(others, camelName(next.label) || type)
    : old.name

  const converted = { ...node, type, props: next }
  return {
    document: { ...doc, nodes: doc.nodes.map((n) => (n.id === id ? converted : n)) },
    node: converted,
    dropped: [...new Set(dropped)]
  }
}

function presetRule(preset, key) {
  const v = presetProps(preset).validation
  return v ? v[key] : undefined
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function isGeneratedName(props, def, preset) {
  const stem = String(props.name).replace(/\d+$/, '')
  return stem === camelName(props.label) || stem === camelName(def.defaults && def.defaults.label) || Boolean(preset && stem === camelName(preset.label))
}

// ── suggestions ──────────────────────────────────────────────────────────

/**
 * Fields whose label reads like a ready-made field they are not — "LinkedIn
 * URL" as a plain text box. Suggestions, never errors: they do not stop a save
 * or a publish. A field set to `preset: false` is plain on purpose and skipped.
 *
 * @returns {[{ nodeId, preset, message }]}
 */
export function presetHints(doc, controls = CONTROLS) {
  const out = []
  ;(doc.nodes || []).forEach((node) => {
    const def = controls[node.type]
    if (!def || !def.input) return
    const p = node.props || {}
    if (p.preset === false || p.preset) return
    const s = suggestPreset(p.label)
    if (!s) return
    out.push({ nodeId: node.id, preset: s.key, message: `"${p.label}" could be the ready-made ${s.label} field, which checks the format for you` })
  })
  return out
}

