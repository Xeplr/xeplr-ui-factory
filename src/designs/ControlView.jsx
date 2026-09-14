import { LABEL_PRESETS } from '../controls.js'
import ListView from './ListView.jsx'
import { fieldStyle, labelStyle, boxStyle } from './styles.js'

// How each control LOOKS — the one renderer, used both on the builder's
// canvas (mode 'design': inert, so a press drags it) and on a live screen
// (mode 'live'). Sharing it is what makes the builder honest: what you place is
// what the form shows, fonts and colours included.
//
// Presentation only. Values, options, errors and list data arrive as props.

const ids = (node) => `xeplr-factory-${node.id}`

export default function ControlView({ node, mode = 'live', value, error, options, onChange, onBlur, disabled, list }) {
  const View = VIEWS[node.type]
  if (!View) {
    return <div className="xeplr-factory-unknown">Unknown control “{node.type}”</div>
  }
  const design = mode === 'design'
  return (
    <View
      node={node}
      p={node.props || {}}
      design={design}
      value={value}
      error={design ? null : error}
      options={options || { loading: false, items: [], error: null }}
      onChange={onChange || (() => {})}
      onBlur={onBlur || (() => {})}
      disabled={design || disabled}
      list={list}
    />
  )
}

function Field({ node, p, error, children, inline }) {
  return (
    <div className={`xeplr-factory-field${inline ? ' xeplr-factory-field--inline' : ''}${error ? ' has-error' : ''}`} style={fieldStyle(p.style)}>
      {!inline && (
        <label className="xeplr-factory-label" htmlFor={ids(node)} style={labelStyle(p.style)}>
          {p.label}{p.required && <span className="xeplr-factory-required" aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {error && <div className="xeplr-factory-error" id={`${ids(node)}-error`} role="alert">{error}</div>}
    </div>
  )
}

function inputProps(node, p, error, disabled, onBlur) {
  return {
    id: ids(node),
    name: p.name,
    disabled,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${ids(node)}-error` : undefined,
    'aria-required': p.required ? true : undefined,
    tabIndex: disabled ? -1 : undefined,
    onBlur,
    style: boxStyle(p.style)
  }
}

function TextView({ node, p, value, error, onChange, onBlur, disabled }) {
  return (
    <Field node={node} p={p} error={error}>
      <input
        className="xeplr-factory-input"
        type="text"
        placeholder={p.placeholder || ''}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps(node, p, error, disabled, onBlur)}
      />
    </Field>
  )
}

function TextareaView({ node, p, value, error, onChange, onBlur, disabled }) {
  return (
    <Field node={node} p={p} error={error}>
      <textarea
        className="xeplr-factory-input xeplr-factory-textarea"
        placeholder={p.placeholder || ''}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps(node, p, error, disabled, onBlur)}
      />
    </Field>
  )
}

function NumberView({ node, p, value, error, onChange, onBlur, disabled }) {
  const v = p.validation || {}
  return (
    <Field node={node} p={p} error={error}>
      <input
        className="xeplr-factory-input"
        type="number"
        inputMode={v.integer ? 'numeric' : 'decimal'}
        step={v.integer ? 1 : 'any'}
        placeholder={p.placeholder || ''}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps(node, p, error, disabled, onBlur)}
      />
    </Field>
  )
}

function DateView({ node, p, value, error, onChange, onBlur, disabled }) {
  const v = p.validation || {}
  return (
    <Field node={node} p={p} error={error}>
      <input
        className="xeplr-factory-input"
        type="date"
        min={v.min}
        max={v.max}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps(node, p, error, disabled, onBlur)}
      />
    </Field>
  )
}

function CheckboxView({ node, p, value, error, onChange, onBlur, disabled }) {
  const text = boxStyle(p.style)
  return (
    <Field node={node} p={p} error={error} inline>
      <label className="xeplr-factory-check" htmlFor={ids(node)} style={{ fontSize: text.fontSize, fontWeight: text.fontWeight, fontStyle: text.fontStyle, color: text.color }}>
        <input
          type="checkbox"
          checked={Boolean(value ?? p.default)}
          onChange={(e) => onChange(e.target.checked)}
          {...inputProps(node, p, error, disabled, onBlur)}
          style={undefined}
        />
        <span>{p.label}{p.required && <span className="xeplr-factory-required" aria-hidden="true"> *</span>}</span>
      </label>
    </Field>
  )
}

function DropdownView({ node, p, design, value, error, options, onChange, onBlur, disabled }) {
  const data = p.data || {}
  const items = data.source === 'static' ? (data.options || []) : options.items
  return (
    <Field node={node} p={p} error={error || (!design && options.error) || null}>
      <select
        className="xeplr-factory-input xeplr-factory-select"
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps(node, p, error, disabled || (!design && options.loading), onBlur)}
      >
        <option value="">{!design && options.loading ? 'Loading…' : (p.placeholder || 'Select…')}</option>
        {!design && items.map((o) => <option key={String(o.id)} value={String(o.id)}>{o.name}</option>)}
      </select>
      {design && (
        <div className="xeplr-factory-hint">
          {data.source === 'table'
            ? (data.table ? `from table ${data.table}` : 'no table chosen')
            : `${(data.options || []).length} option${(data.options || []).length === 1 ? '' : 's'}`}
        </div>
      )}
    </Field>
  )
}

function LabelView({ p }) {
  const variant = p.variant || 'text'
  const preset = LABEL_PRESETS[variant] || LABEL_PRESETS.text
  const Tag = variant === 'heading' ? 'h2' : variant === 'subheading' ? 'h3' : 'p'
  const s = { fontSize: preset.fontSize, fontWeight: preset.fontWeight, ...(p.style || {}) }
  return (
    <Tag
      className={`xeplr-factory-text xeplr-factory-text--${variant}`}
      style={{ ...fieldStyle(s), ...boxStyle(s) }}
    >
      {p.text}
    </Tag>
  )
}

function ListControl({ node, design, list }) {
  return <ListView node={node} design={design} {...(list || {})} />
}

export const VIEWS = {
  text: TextView,
  textarea: TextareaView,
  number: NumberView,
  date: DateView,
  checkbox: CheckboxView,
  dropdown: DropdownView,
  label: LabelView,
  list: ListControl
}
