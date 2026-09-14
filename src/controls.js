// THE CONTROLS a screen is made of — one entry per type, and nothing about any
// control lives anywhere else. The palette lists these, the property panel is
// generated from `properties`, the document checker reads `props`, and the
// form schema reads `valueType`. Adding a control is adding an entry.
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
    props: ['name', 'label', 'placeholder', 'required', 'default', 'validation'],
    validation: ['minLength', 'maxLength', 'pattern', 'patternMessage'],
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
      }
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
    props: ['name', 'label', 'placeholder', 'required', 'default', 'validation'],
    validation: ['minLength', 'maxLength'],
    properties: [
      FIELD_BASICS([PLACEHOLDER, { path: 'props.default', label: 'Default value', type: 'textarea' }]),
      {
        key: 'validation',
        title: 'Validation',
        fields: [
          { path: 'props.validation.minLength', label: 'Min length', type: 'number' },
          { path: 'props.validation.maxLength', label: 'Max length', type: 'number' }
        ]
      }
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
    props: ['name', 'label', 'placeholder', 'required', 'default', 'validation'],
    validation: ['min', 'max', 'integer'],
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
      }
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
    props: ['name', 'label', 'required', 'default', 'validation'],
    validation: ['min', 'max'],
    properties: [
      FIELD_BASICS([{ path: 'props.default', label: 'Default value', type: 'date' }]),
      {
        key: 'validation',
        title: 'Validation',
        fields: [
          { path: 'props.validation.min', label: 'Earliest', type: 'date' },
          { path: 'props.validation.max', label: 'Latest', type: 'date' }
        ]
      }
    ]
  },

  checkbox: {
    type: 'checkbox',
    label: 'Checkbox',
    group: 'Inputs',
    input: true,
    valueType: 'boolean',
    defaultSize: { w: 0.44, h: 0.06 },
    defaults: { label: 'Checkbox', default: false },
    // `required` on a checkbox means it must be ticked — "I accept".
    props: ['name', 'label', 'required', 'default'],
    validation: [],
    properties: [
      FIELD_BASICS([{ path: 'props.default', label: 'Ticked by default', type: 'toggle' }])
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
    props: ['name', 'label', 'placeholder', 'required', 'default', 'data'],
    validation: [],
    properties: [
      FIELD_BASICS([PLACEHOLDER]),
      {
        key: 'data',
        title: 'Options',
        fields: [
          { path: 'props.data', label: 'Options come from', type: 'dataSource' }
        ]
      }
    ]
  },

  label: {
    type: 'label',
    label: 'Label',
    group: 'Content',
    input: false,
    defaultSize: { w: 0.92, h: 0.06 },
    defaults: { text: 'Label', variant: 'text' },
    props: ['text', 'variant'],
    validation: [],
    properties: [
      {
        key: 'content',
        title: 'Content',
        fields: [
          { path: 'props.text', label: 'Text', type: 'textarea' },
          { path: 'props.variant', label: 'Style', type: 'select', options: [
            { value: 'heading', label: 'Heading' },
            { value: 'subheading', label: 'Subheading' },
            { value: 'text', label: 'Text' }
          ] }
        ]
      }
    ]
  },

  button: {
    type: 'button',
    label: 'Button',
    group: 'Actions',
    input: false,
    defaultSize: { w: 0.18, h: 0.07 },
    defaults: { label: 'Save', action: 'submit' },
    props: ['label', 'action'],
    validation: [],
    properties: [
      {
        key: 'button',
        title: 'Button',
        fields: [
          { path: 'props.label', label: 'Label', type: 'text' },
          { path: 'props.action', label: 'Does', type: 'select', options: [
            { value: 'submit', label: 'Submit the form' },
            { value: 'reset', label: 'Reset the form' }
          ] }
        ]
      }
    ]
  }
}

export const LABEL_VARIANTS = ['heading', 'subheading', 'text']
export const BUTTON_ACTIONS = ['submit', 'reset']

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
