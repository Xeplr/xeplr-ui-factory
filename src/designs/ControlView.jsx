// How each control LOOKS — the one renderer, used both on the builder's
// canvas (mode 'design': inert, so a press drags it) and on a live screen
// (mode 'live'). Sharing it is what makes the builder honest: what you place is
// what the form shows.
//
// Presentation only. Values, options and errors arrive as props.

const ids = (node) => `xeplr-factory-${node.id}`

export default function ControlView({ node, mode = 'live', value, error, options, onChange, onAction, disabled }) {
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
      onAction={onAction || (() => {})}
      disabled={design || disabled}
    />
  )
}

function Field({ node, p, error, children, inline }) {
  return (
    <div className={`xeplr-factory-field${inline ? ' xeplr-factory-field--inline' : ''}${error ? ' has-error' : ''}`}>
      {!inline && (
        <label className="xeplr-factory-label" htmlFor={ids(node)}>
          {p.label}{p.required && <span className="xeplr-factory-required" aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {error && <div className="xeplr-factory-error" id={`${ids(node)}-error`} role="alert">{error}</div>}
    </div>
  )
}

function inputProps(node, p, error, disabled) {
  return {
    id: ids(node),
    name: p.name,
    disabled,
    required: undefined, // validation is ours, with our messages — not the browser's bubbles
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${ids(node)}-error` : undefined,
    tabIndex: disabled ? -1 : undefined
  }
}

function TextView({ node, p, value, error, onChange, disabled }) {
  return (
    <Field node={node} p={p} error={error}>
      <input
        className="xeplr-factory-input"
        type="text"
        placeholder={p.placeholder || ''}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps(node, p, error, disabled)}
      />
    </Field>
  )
}

function TextareaView({ node, p, value, error, onChange, disabled }) {
  return (
    <Field node={node} p={p} error={error}>
      <textarea
        className="xeplr-factory-input xeplr-factory-textarea"
        placeholder={p.placeholder || ''}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps(node, p, error, disabled)}
      />
    </Field>
  )
}

function NumberView({ node, p, value, error, onChange, disabled }) {
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
        {...inputProps(node, p, error, disabled)}
      />
    </Field>
  )
}

function DateView({ node, p, value, error, onChange, disabled }) {
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
        {...inputProps(node, p, error, disabled)}
      />
    </Field>
  )
}

function CheckboxView({ node, p, value, error, onChange, disabled }) {
  return (
    <Field node={node} p={p} error={error} inline>
      <label className="xeplr-factory-check" htmlFor={ids(node)}>
        <input
          type="checkbox"
          checked={Boolean(value ?? p.default)}
          onChange={(e) => onChange(e.target.checked)}
          {...inputProps(node, p, error, disabled)}
        />
        <span>{p.label}{p.required && <span className="xeplr-factory-required" aria-hidden="true"> *</span>}</span>
      </label>
    </Field>
  )
}

function DropdownView({ node, p, design, value, error, options, onChange, disabled }) {
  const data = p.data || {}
  const items = data.source === 'static' ? (data.options || []) : options.items
  return (
    <Field node={node} p={p} error={error || (!design && options.error) || null}>
      <select
        className="xeplr-factory-input xeplr-factory-select"
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps(node, p, error, disabled || (!design && options.loading))}
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
  const Tag = variant === 'heading' ? 'h2' : variant === 'subheading' ? 'h3' : 'p'
  return <Tag className={`xeplr-factory-text xeplr-factory-text--${variant}`}>{p.text}</Tag>
}

function ButtonView({ p, design, onAction, disabled }) {
  const action = p.action || 'submit'
  return (
    <button
      className={`xeplr-factory-button xeplr-factory-button--${action}`}
      type={design ? 'button' : action === 'reset' ? 'button' : 'submit'}
      disabled={disabled}
      tabIndex={design ? -1 : undefined}
      onClick={action === 'reset' && !design ? () => onAction('reset') : undefined}
    >
      {p.label}
    </button>
  )
}

export const VIEWS = {
  text: TextView,
  textarea: TextareaView,
  number: NumberView,
  date: DateView,
  checkbox: CheckboxView,
  dropdown: DropdownView,
  label: LabelView,
  button: ButtonView
}
