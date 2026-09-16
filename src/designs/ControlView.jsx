import { useState } from 'react'
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

export default function ControlView({ node, mode = 'live', value, error, options, onChange, onBlur, disabled, list, upload }) {
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
      upload={upload}
    />
  )
}

function Field({ node, p, error, children, inline }) {
  return (
    <div className={`xeplr-factory-field${inline ? ' xeplr-factory-field--inline' : ''}${error ? ' has-error' : ''}`} style={fieldStyle(p.style)}>
      {!inline && (
        <label className="xeplr-factory-label" id={`${ids(node)}-label`} htmlFor={ids(node)} style={labelStyle(p.style)}>
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

/** The options a group control shows: typed in, or loaded from a table. */
function groupItems(p, design, options) {
  const data = p.data || {}
  return data.source === 'static' ? (data.options || []) : (design ? [] : options.items)
}

/** What the designer shows in place of options it cannot load on the canvas. */
function OptionsHint({ data }) {
  const n = (data.options || []).length
  return (
    <div className="xeplr-factory-hint">
      {data.source === 'table'
        ? (data.table ? `from table ${data.table}` : 'no table chosen')
        : `${n} option${n === 1 ? '' : 's'}`}
    </div>
  )
}

function RadioView({ node, p, design, value, error, options, onChange, onBlur, disabled }) {
  const items = groupItems(p, design, options)
  const text = boxStyle(p.style)
  return (
    <Field node={node} p={p} error={error || (!design && options.error) || null}>
      <div className={`xeplr-factory-group xeplr-factory-group--${p.layout === 'horizontal' ? 'horizontal' : 'vertical'}`} role="radiogroup" aria-labelledby={`${ids(node)}-label`}>
        {items.map((o) => (
          <label key={String(o.id)} className="xeplr-factory-option" style={{ fontSize: text.fontSize, fontWeight: text.fontWeight, fontStyle: text.fontStyle, color: text.color }}>
            <input
              type="radio"
              name={p.name}
              value={String(o.id)}
              checked={value !== undefined && value !== null && String(value) === String(o.id)}
              disabled={disabled || (!design && options.loading)}
              tabIndex={disabled ? -1 : undefined}
              onChange={() => onChange(o.id)}
              onBlur={onBlur}
            />
            <span>{o.name}</span>
          </label>
        ))}
      </div>
      {design && <OptionsHint data={p.data || {}} />}
      {!design && options.loading && <div className="xeplr-factory-hint">Loading…</div>}
    </Field>
  )
}

function MultiselectView({ node, p, design, value, error, options, onChange, onBlur, disabled }) {
  const items = groupItems(p, design, options)
  const chosen = Array.isArray(value) ? value : []
  const text = boxStyle(p.style)
  const toggle = (id, on) => {
    const next = chosen.filter((v) => String(v) !== String(id))
    onChange(on ? [...next, id] : next)
  }
  return (
    <Field node={node} p={p} error={error || (!design && options.error) || null}>
      <div className={`xeplr-factory-group xeplr-factory-group--${p.layout === 'horizontal' ? 'horizontal' : 'vertical'}`} role="group" aria-labelledby={`${ids(node)}-label`}>
        {items.map((o) => (
          <label key={String(o.id)} className="xeplr-factory-option" style={{ fontSize: text.fontSize, fontWeight: text.fontWeight, fontStyle: text.fontStyle, color: text.color }}>
            <input
              type="checkbox"
              name={p.name}
              value={String(o.id)}
              checked={chosen.some((v) => String(v) === String(o.id))}
              disabled={disabled || (!design && options.loading)}
              tabIndex={disabled ? -1 : undefined}
              onChange={(e) => toggle(o.id, e.target.checked)}
              onBlur={onBlur}
            />
            <span>{o.name}</span>
          </label>
        ))}
      </div>
      {design && <OptionsHint data={p.data || {}} />}
      {!design && options.loading && <div className="xeplr-factory-hint">Loading…</div>}
    </Field>
  )
}

function DatetimeView({ node, p, value, error, onChange, onBlur, disabled }) {
  const v = p.validation || {}
  return (
    <Field node={node} p={p} error={error}>
      <input
        className="xeplr-factory-input"
        type="datetime-local"
        min={v.min}
        max={v.max}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps(node, p, error, disabled, onBlur)}
      />
    </Field>
  )
}

/**
 * A file field holds the stored file's PATH, not the file. Picking one uploads
 * it straight away (`upload`, supplied by the screen) and what comes back is
 * the value that is saved with the record.
 */
function FileView({ node, p, design, value, error, onChange, onBlur, disabled, upload }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)
  const accept = p.accept || ''
  const choose = async (file) => {
    if (!file || !upload) return
    setFailed(null)
    setBusy(true)
    try {
      const out = await upload(file, node)
      onChange(out && out.path ? out.path : undefined)
    } catch (e) {
      setFailed(e && e.message ? e.message : 'The file could not be uploaded')
    } finally {
      setBusy(false)
      onBlur()
    }
  }
  return (
    <Field node={node} p={p} error={error || failed}>
      {value
        ? (
          <div className="xeplr-factory-file">
            <span className="xeplr-factory-file-name" title={String(value)}>{fileName(value)}</span>
            <button type="button" className="xeplr-factory-file-clear" disabled={disabled} onClick={() => { onChange(undefined); onBlur() }}>Remove</button>
          </div>
        )
        : (
          <input
            className="xeplr-factory-input xeplr-factory-file-input"
            type="file"
            accept={accept}
            disabled={disabled || busy}
            onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; choose(f) }}
            {...inputProps(node, p, error, disabled || busy, onBlur)}
          />
        )}
      {busy && <div className="xeplr-factory-hint">Uploading…</div>}
      {!busy && !value && (design || accept) && (
        <div className="xeplr-factory-hint">{accept || 'any file'}{p.maxSize ? ` · up to ${p.maxSize} MB` : ''}</div>
      )}
    </Field>
  )
}

/** The name at the end of a stored path, for showing what is attached. */
export function fileName(path) {
  const s = String(path)
  const cut = s.slice(s.lastIndexOf('/') + 1)
  // Stored names start with the id that keeps them apart: "a1b2c3__report.pdf".
  const sep = cut.indexOf('__')
  return sep === -1 ? cut : cut.slice(sep + 2)
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
  radio: RadioView,
  multiselect: MultiselectView,
  datetime: DatetimeView,
  file: FileView,
  label: LabelView,
  list: ListControl
}
