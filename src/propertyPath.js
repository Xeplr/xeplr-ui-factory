// Read and write a value by dotted path — `props.validation.maxLength`. The
// property panel addresses every field this way, so a new property is a path in
// controls.js and never a new setter.
//
// Writes are immutable: every object along the path is copied, nothing else is.

export function getAtPath(obj, path) {
  return String(path).split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), obj)
}

/**
 * Sets `value` at `path`. A BLANK value — undefined, '' or an empty object left
 * behind — removes the key instead, so clearing "Max length" leaves no
 * `maxLength: ''` in the saved document for a validator to trip over.
 */
export function setAtPath(obj, path, value) {
  const keys = String(path).split('.')
  const [head, ...rest] = keys
  const base = obj && typeof obj === 'object' ? obj : {}
  if (!rest.length) {
    const next = { ...base }
    if (isBlank(value)) delete next[head]
    else next[head] = value
    return next
  }
  const child = setAtPath(base[head], rest.join('.'), value)
  const next = { ...base }
  if (child && typeof child === 'object' && !Array.isArray(child) && !Object.keys(child).length) delete next[head]
  else next[head] = child
  return next
}

function isBlank(v) {
  return v === undefined || v === ''
}
