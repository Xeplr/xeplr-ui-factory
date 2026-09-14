// THE CONTROLS a screen is made of — one entry per type, and nothing about any
// control lives anywhere else. The palette lists these, the property panel is
// generated from `properties`, the document checker reads `props`, `validation`
// and `styles`, and the form schema reads `valueType`. Adding a control is
// adding an entry.
//
// Pure data: no React. The renderers are in designs/ControlView.jsx, keyed by
// the same `type`, so this file also runs in node — the CLI and the tests read
// it, and so can Claude when it writes a screen.
//
// Sizes are FRACTIONS: `w` of the screen's width, `h` of one page's height
// (width × the screen's aspect). See document.js.

/** A dropdown binds `id` and shows `name` — always. */
export const OPTION_ID = 'id'
export const OPTION_LABEL = 'name'

// ── styles ───────────────────────────────────────────────────────────────
// Every look a control can have is a key under `props.style`, described once
// here: its editor, and the values it accepts. Sizes are PIXELS at the screen's
// design width; a screen shown narrower shrinks them in proportion, and never
// enlarges them.

export const FONT_FAMILIES = [
  { value: 'system-ui, -apple-system, "Segoe UI", sans-serif', label: 'System' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New' },
  { value: 'ui-monospace, SFMono-Regular, Menlo, monospace', label: 'Monospace' }
]

const WEIGHTS = [
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra bold' }
]

/**
 * key → { label, type (editor), check }. `check` is what the document checker
 * accepts; `hint` is what it says when a value is refused.
 */
export const STYLE_KEYS = {
  fontFamily: { label: 'Font', type: 'font', hint: 'a CSS font-family, e.g. "Georgia, serif"' },
  fontSize: { label: 'Font size (px)', type: 'number', min: 8, max: 96, hint: 'a number of pixels from 8 to 96' },
  fontWeight: { label: 'Weight', type: 'select', options: WEIGHTS, hint: 'one of 300, 400, 500, 600, 700, 800' },
  fontStyle: { label: 'Italic', type: 'toggleValue', on: 'italic', hint: '"normal" or "italic"' },
  textAlign: { label: 'Align', type: 'select', options: [
    { value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }
  ], hint: '"left", "center" or "right"' },
  color: { label: 'Text colour', type: 'color', hint: 'a colour as #rgb or #rrggbb' },
  background: { label: 'Background', type: 'color', hint: 'a colour as #rgb or #rrggbb, or "transparent"' },
  borderColor: { label: 'Border colour', type: 'color', hint: 'a colour as #rgb or #rrggbb, or "transparent"' },
  borderWidth: { label: 'Border width (px)', type: 'number', min: 0, max: 10, hint: 'a number of pixels from 0 to 10' },
  borderRadius: { label: 'Corner radius (px)', type: 'number', min: 0, max: 40, hint: 'a number of pixels from 0 to 40' },
  labelFontSize: { label: 'Label size (px)', type: 'number', min: 8, max: 48, hint: 'a number of pixels from 8 to 48' },
  labelFontWeight: { label: 'Label weight', type: 'select', options: WEIGHTS, hint: 'one of 300, 400, 500, 600, 700, 800' },
  labelColor: { label: 'Label colour', type: 'color', hint: 'a colour as #rgb or #rrggbb' }
}

/** The screen-wide defaults every control inherits. */
export const SCREEN_STYLE_KEYS = ['fontFamily', 'fontSize', 'color', 'background']

const INPUT_STYLES = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textAlign', 'color', 'background', 'borderColor', 'borderWidth', 'borderRadius', 'labelFontSize', 'labelFontWeight', 'labelColor']

/** Property-panel groups for a control's styles, split the way people look for them. */
function styleGroups(keys) {
  const field = (k) => ({ path: `props.style.${k}`, label: STYLE_KEYS[k].label, type: STYLE_KEYS[k].type, options: STYLE_KEYS[k].options, on: STYLE_KEYS[k].on, min: STYLE_KEYS[k].min, max: STYLE_KEYS[k].max })
  const groups = [
    { key: 'text', title: 'Text', keys: ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textAlign', 'color'] },
    { key: 'box', title: 'Box', keys: ['background', 'borderColor', 'borderWidth', 'borderRadius'] },
    { key: 'labelStyle', title: 'Label', keys: ['labelFontSize', 'labelFontWeight', 'labelColor'] }
  ]
  return groups
    .map((g) => ({ key: g.key, title: g.title, fields: g.keys.filter((k) => keys.includes(k)).map(field) }))
    .filter((g) => g.fields.length)
}

// ── property panel contract ──────────────────────────────────────────────
// { key, title, fields: [{ path, label, type, options?, help? }] }
// The same shape as the BI dashboard's widgetProperties.js, so the two panels
// can become one. `path` points into the node (`props.label`), and the editor
// for each `type` is in designs/PropertyPanel.jsx.

const FIELD_BASICS = (extra) => ({
  key: 'field',
  title: 'Field',
  fields: [
    { path: 'props.label', label: 'Label', type: 'text' },
    { path: 'props.name', label: 'Field name', type: 'text', help: 'The key this value is saved under — letters, digits and _' },
    ...(extra || []),
    { path: 'props.required', label: 'Required', type: 'toggle' }
  ]
})

const PLACEHOLDER = { path: 'props.placeholder', label: 'Placeholder', type: 'text' }

export const CONTROLS = {
  text: {
    type: 'text',
    label: 'Text',
    group: 'Inputs',
    input: true,
    valueType: 'string',
    defaultSize: { w: 0.44, h: 0.08 },
    defaults: { label: 'Text' },
    props: ['name', 'label', 'placeholder', 'required', 'default', 'validation', 'style'],
    validation: ['minLength', 'maxLength', 'pattern', 'patternMessage'],
    styles: INPUT_STYLES,
    properties: [
      FIELD_BASICS([PLACEHOLDER, { path: 'props.default', label: 'Default value', type: 'text' }]),
      {
        key: 'validation',
        title: 'Validation',
        fields: [
          { path: 'props.validation.minLength', label: 'Min length', type: 'number' },
          { path: 'props.validation.maxLength', label: 'Max length', type: 'number' },
          { path: 'props.validation.pattern', label: 'Pattern (regex)', type: 'text' },
          { path: 'props.validation.patternMessage', label: 'Pattern message', type: 'text', help: 'Shown when the pattern does not match' }
        ]
      },
      ...styleGroups(INPUT_STYLES)
    ]
  },

  textarea: {
    type: 'textarea',
    label: 'Text area',
    group: 'Inputs',
    input: true,
    valueType: 'string',
    defaultSize: { w: 0.92, h: 0.18 },
    defaults: { label: 'Notes' },
    props: ['name', 'label', 'placeholder', 'required', 'default', 'validation', 'style'],
    validation: ['minLength', 'maxLength'],
    styles: INPUT_STYLES,
    properties: [
      FIELD_BASICS([PLACEHOLDER, { path: 'props.default', label: 'Default value', type: 'textarea' }]),
      {
        key: 'validation',
        title: 'Validation',
        fields: [
          { path: 'props.validation.minLength', label: 'Min length', type: 'number' },
          { path: 'props.validation.maxLength', label: 'Max length', type: 'number' }
        ]
      },
      ...styleGroups(INPUT_STYLES)
    ]
  },

  number: {
    type: 'number',
    label: 'Number',
    group: 'Inputs',
    input: true,
    valueType: 'number',
    defaultSize: { w: 0.44, h: 0.08 },
    defaults: { label: 'Number' },
    props: ['name', 'label', 'placeholder', 'required', 'default', 'validation', 'style'],
    validation: ['min', 'max', 'integer'],
    styles: INPUT_STYLES,
    properties: [
      FIELD_BASICS([PLACEHOLDER, { path: 'props.default', label: 'Default value', type: 'number' }]),
      {
        key: 'validation',
        title: 'Validation',
        fields: [
          { path: 'props.validation.min', label: 'Minimum', type: 'number' },
          { path: 'props.validation.max', label: 'Maximum', type: 'number' },
          { path: 'props.validation.integer', label: 'Whole numbers only', type: 'toggle' }
        ]
      },
      ...styleGroups(INPUT_STYLES)
    ]
  },

  date: {
    type: 'date',
    label: 'Date',
    group: 'Inputs',
    input: true,
    valueType: 'date',
    defaultSize: { w: 0.44, h: 0.08 },
    defaults: { label: 'Date' },
    props: ['name', 'label', 'required', 'default', 'validation', 'style'],
    validation: ['min', 'max'],
    styles: INPUT_STYLES,
    properties: [
      FIELD_BASICS([{ path: 'props.default', label: 'Default value', type: 'date' }]),
      {
        key: 'validation',
        title: 'Validation',
        fields: [
          { path: 'props.validation.min', label: 'Earliest', type: 'date' },
          { path: 'props.validation.max', label: 'Latest', type: 'date' }
        ]
      },
      ...styleGroups(INPUT_STYLES)
    ]
  },

  checkbox: {
    type: 'checkbox',
    label: 'Checkbox',
    group: 'Inputs',
    input: true,
    valueType: 'boolean',
    defaultSize: { w: 0.44, h: 0.05 },
    defaults: { label: 'Checkbox', default: false },
    // `required` on a checkbox means it must be ticked — "I accept".
    props: ['name', 'label', 'required', 'default', 'style'],
    validation: [],
    styles: ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color'],
    properties: [
      FIELD_BASICS([{ path: 'props.default', label: 'Ticked by default', type: 'toggle' }]),
      ...styleGroups(['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color'])
    ]
  },

  dropdown: {
    type: 'dropdown',
    label: 'Dropdown',
    group: 'Inputs',
    input: true,
    // Whatever the source's ids are — a table's may be numbers or strings.
    valueType: null,
    defaultSize: { w: 0.44, h: 0.08 },
    defaults: { label: 'Dropdown', placeholder: 'Select…', data: { source: 'static', options: [] } },
    props: ['name', 'label', 'placeholder', 'required', 'default', 'data', 'style'],
    validation: [],
    styles: INPUT_STYLES.filter((k) => k !== 'textAlign'),
    properties: [
      FIELD_BASICS([PLACEHOLDER]),
      {
        key: 'data',
        title: 'Options',
        fields: [
          { path: 'props.data', label: 'Options come from', type: 'dataSource' }
        ]
      },
      ...styleGroups(INPUT_STYLES.filter((k) => k !== 'textAlign'))
    ]
  },

  label: {
    type: 'label',
    label: 'Label',
    group: 'Content',
    input: false,
    defaultSize: { w: 0.92, h: 0.05 },
    defaults: { text: 'Label', variant: 'text' },
    props: ['text', 'variant', 'style'],
    validation: [],
    styles: ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textAlign', 'color', 'background', 'borderColor', 'borderWidth', 'borderRadius'],
    properties: [
      {
        key: 'content',
        title: 'Content',
        fields: [
          { path: 'props.text', label: 'Text', type: 'textarea' },
          { path: 'props.variant', label: 'Preset', type: 'select', options: [
            { value: 'heading', label: 'Heading' },
            { value: 'subheading', label: 'Subheading' },
            { value: 'text', label: 'Text' }
          ], help: 'A starting size and weight — the Text settings below override it' }
        ]
      },
      ...styleGroups(['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textAlign', 'color', 'background', 'borderColor', 'borderWidth', 'borderRadius'])
    ]
  }
}

/** What a list's rows can offer. */
export const LIST_ACTIONS = ['new', 'edit', 'delete']

CONTROLS.list = {
  type: 'list',
  label: 'List',
  group: 'Data',
  input: false,
  defaultSize: { w: 0.92, h: 0.42 },
  // No columns → the screen's own fields, in reading order.
  defaults: { title: 'Saved records', pageSize: 10, actions: ['new', 'edit', 'delete'] },
  // editScreen: the id of the screen Edit and New open in a POPUP. Without one,
  // Edit opens the row in this screen's own fields (a list on a form).
  props: ['title', 'source', 'editScreen', 'columns', 'pageSize', 'actions', 'style'],
  validation: [],
  styles: ['fontFamily', 'fontSize', 'color', 'background', 'borderColor', 'borderWidth', 'borderRadius'],
  properties: [
    {
      key: 'list',
      title: 'List',
      fields: [
        { path: 'props.title', label: 'Title', type: 'text' },
        { path: 'props.source', label: 'Records from', type: 'table', help: 'Blank → the table this screen saves to' },
        { path: 'props.editScreen', label: 'Edit in', type: 'screen', help: 'The screen Edit and New open in a popup' },
        { path: 'props.pageSize', label: 'Rows per page', type: 'number' }
      ]
    },
    { key: 'columns', title: 'Columns', fields: [{ path: 'props.columns', label: 'Columns', type: 'columns' }] },
    { key: 'actions', title: 'Actions', fields: [{ path: 'props.actions', label: 'Actions', type: 'actions' }] },
    ...styleGroups(['fontFamily', 'fontSize', 'color', 'background', 'borderColor', 'borderWidth', 'borderRadius'])
  ]
}

export const LABEL_VARIANTS = ['heading', 'subheading', 'text']

/** The sizes a label preset starts from, in px at the design width. */
export const LABEL_PRESETS = {
  heading: { fontSize: 26, fontWeight: 700 },
  subheading: { fontSize: 18, fontWeight: 600 },
  text: { fontSize: 14, fontWeight: 400 }
}

/** Palette order: grouped, in declaration order. */
export function controlGroups(controls = CONTROLS) {
  const groups = []
  Object.values(controls).forEach((c) => {
    let g = groups.find((x) => x.title === c.group)
    if (!g) { g = { title: c.group, controls: [] }; groups.push(g) }
    g.controls.push(c)
  })
  return groups
}

/** A registry with extra or replaced controls, leaving the built-ins untouched. */
export function withControls(extra, base = CONTROLS) {
  return { ...base, ...extra }
}
