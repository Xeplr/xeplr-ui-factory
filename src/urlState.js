// WHERE YOU ARE LIVES IN THE URL — the pure half, no React.
//
// The step a stepper is open at, and the control (or flow step) whose
// properties are open, are places a person navigates to: a refresh or a
// shared link must land on them again. This file is how they are named in the
// URL's query; useUrlPlaces.js reads and writes them.
//
// THE KEYS ARE THE HOST'S. A builder, a running screen and the preview inside
// the builder can share one page, and the host app has keys of its own, so a
// hook writes the URL only when given a `urlKey`. Without one it keeps the
// same values in memory, exactly as before.

/**
 * The query keys under a host's `urlKey`, or null (in memory).
 *   factoryUrlKeys('form') → { steps: 'formSteps', selected: 'formSelected', tab: 'formTab' }
 */
export function factoryUrlKeys(urlKey) {
  if (!urlKey) return null
  return { steps: `${urlKey}Steps`, selected: `${urlKey}Selected`, tab: `${urlKey}Tab` }
}

/**
 * Which step each stepper is open at → one query value. Step 0 is where a
 * stepper starts, so it is left out — a screen on its first steps has a
 * clean URL. Ids are URI-encoded, so one holding ':' or ',' splits back.
 *   { s1: 2, s2: 0 } → 's1:2'
 */
export function encodeSteps(open) {
  return Object.keys(open || {})
    .filter((id) => Number.isInteger(open[id]) && open[id] > 0)
    .map((id) => `${encodeURIComponent(id)}:${open[id]}`)
    .join(',') || null
}

/** The query value back to { stepper id: index }; anything unreadable is dropped. */
export function decodeSteps(value) {
  const open = {}
  if (!value || typeof value !== 'string') return open
  value.split(',').forEach((pair) => {
    const at = pair.lastIndexOf(':')
    if (at <= 0) return
    if (!/^\d+$/.test(pair.slice(at + 1))) return
    const index = Number(pair.slice(at + 1))
    let id
    try { id = decodeURIComponent(pair.slice(0, at)) } catch { return }
    open[id] = index
  })
  return open
}

/**
 * Selecting adds a history entry when it opens or closes the properties
 * (nothing → something, something → nothing), so Back closes them; moving
 * from one selected thing to another is a switch and replaces the entry.
 */
export function replacesHistory(previous, next) {
  const had = previous !== null && previous !== undefined && previous !== ''
  const has = next !== null && next !== undefined && next !== ''
  return had && has
}

/**
 * A multi-selection is NOT a place: it is a working set for Delete or
 * Duplicate, not somewhere a person goes. Only a single selection — the one
 * whose properties are open — is named in the URL.
 *   one id → that id      none, or several → null
 */
export function selectionPlace(ids) {
  const list = ids ? [...ids] : []
  return list.length === 1 ? list[0] : null
}
