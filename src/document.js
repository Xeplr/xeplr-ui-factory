// THE SCREEN DOCUMENT — the metadata a screen is saved as, and every change
// the builder makes to it. Pure and immutable: each function returns a new
// document. No React, no storage; the consuming app stores documents.
//
//   {
//     kind: 'xeplr-screen', version: 1,
//     id: 'new_employee', name: 'New employee',
//     source?: 'employees',          ← the table records are saved to (the app's)
//     units: 'fraction', aspect: 1,
//     width: 800,                    ← design width in px: styles are px at this width
//     style?: { fontFamily, fontSize, color, background },   ← screen-wide defaults
//     nodes: [ { id, type, x, y, w, h, z?, groupId?, props } ]
//   }
//
// ── GEOMETRY ─────────────────────────────────────────────────────────────
// Proportional, like the dashboards: x and w are fractions of the screen's
// WIDTH; y and h are fractions of one PAGE, and a page is width × aspect tall.
// With aspect 1 every number is simply a fraction of the width, so a screen
// keeps exactly its proportions at any size. y may exceed 1 — a long form runs
// onto a second page.

import { CONTROLS } from './controls.js'
import { getAtPath, setAtPath } from './propertyPath.js'

export const DOCUMENT_KIND = 'xeplr-screen'
export const DOCUMENT_VERSION = 1
export const DEFAULT_ASPECT = 1
/** Px. Styles are sizes at this width; narrower shrinks them, wider never grows them. */
export const DEFAULT_WIDTH = 800

/** Space kept around and between controls, as fractions. */
export const MARGIN = 0.04
export const GAP = 0.025

/** A new, empty screen. */
export function createScreen({ name, id, aspect, width, source, style } = {}) {
  const title = String(name || 'Untitled screen').trim() || 'Untitled screen'
  const doc = {
    kind: DOCUMENT_KIND,
    version: DOCUMENT_VERSION,
    id: id || slugify(title, '_') || 'screen',
    name: title,
    units: 'fraction',
    aspect: aspect > 0 ? aspect : DEFAULT_ASPECT,
    width: width > 0 ? width : DEFAULT_WIDTH,
    nodes: []
  }
  if (source) doc.source = source
  if (style && Object.keys(style).length) doc.style = style
  return doc
}

export function renameScreen(doc, name) {
  return { ...doc, name: String(name == null ? '' : name) }
}

/**
 * Sets a SCREEN property by path — `source`, `width`, `style.fontSize`. A blank
 * value removes the key, like a control's properties.
 */
export function setScreenProperty(doc, path, value) {
  if (path === 'nodes' || path.startsWith('nodes.')) throw new Error('setScreenProperty cannot change nodes')
  return setAtPath(doc, path, value)
}

/**
 * Adds a control of `type`. Placed at `at` ({ x, y } — the drop point, as the
 * control's top-left) or, without one, below everything already on the screen.
 * Returns { document, node }.
 */
export function addControl(doc, type, { at, props, size, step } = {}, controls = CONTROLS) {
  const def = controls[type]
  if (!def) throw new Error(`Unknown control type "${type}"`)
  const dims = { ...def.defaultSize, ...size }
  const pos = at ? clampPosition(at, dims) : nextPosition(doc, dims)
  const merged = { ...clone(def.defaults), ...props }
  if (def.input) {
    const base = merged.name || camelName(merged.label) || type
    merged.name = uniqueFieldName(doc, base)
  }
  const node = {
    id: uniqueNodeId(doc, def.input ? merged.name : type),
    type,
    x: pos.x,
    y: pos.y,
    w: dims.w,
    h: dims.h,
    z: nextZ(doc),
    props: merged
  }
  // Dropped while a step is open: the control belongs to that step. A stepper
  // never belongs to itself.
  if (step && type !== 'stepper') node.step = { of: step.of, index: step.index }
  return { document: { ...doc, nodes: [...doc.nodes, node] }, node }
}

// ── steps ────────────────────────────────────────────────────────────────
// A stepper shows one step at a time, and every other control says which step
// it belongs to. The document stays FLAT — nothing is nested — so a control is
// still moved, styled and checked exactly as it was; `step` only decides when
// it is on screen.

/** Every stepper on the screen, in reading order. */
export function steppers(doc, controls = CONTROLS) {
  return (doc.nodes || []).filter((n) => n.type === 'stepper' && controls[n.type])
}

/** A stepper's steps, always as [{ key, label }]. */
export function stepsOf(node) {
  return (node && node.props && Array.isArray(node.props.steps) ? node.props.steps : []).map((s, i) => ({
    key: (s && s.key) || `step_${i + 1}`,
    label: (s && s.label) || `Step ${i + 1}`
  }))
}

/** Which step a node is on, or null for "every step". */
export function stepOf(node) {
  const step = node && node.step
  return step && typeof step.of === 'string' && Number.isInteger(step.index) ? step : null
}

/**
 * Puts a node on a step — or on none, with `null`, which shows it whatever
 * step is open.
 */
export function setNodeStep(doc, id, step) {
  return mapNode(doc, id, (n) => {
    const next = { ...n }
    if (step === null || step === undefined) delete next.step
    else next.step = { of: step.of, index: step.index }
    return next
  })
}

/**
 * The nodes to show, given which step each stepper is open at.
 * @param active  { [stepper node id]: index } — missing means its first step
 */
export function nodesForSteps(doc, active = {}, controls = CONTROLS) {
  const open = (id) => (Number.isInteger(active[id]) ? active[id] : 0)
  const byId = new Map((doc.nodes || []).map((n) => [n.id, n]))
  const shown = (node, seen) => {
    const step = stepOf(node)
    if (!step) return true
    const owner = byId.get(step.of)
    // A step of a stepper that is gone shows nothing: the control is orphaned,
    // and the checker says so rather than the screen quietly losing it.
    if (!owner || owner.type !== 'stepper') return false
    if (step.index !== open(owner.id)) return false
    // A stepper inside another stepper's step is only open when that one is.
    if (seen.has(owner.id)) return false
    seen.add(owner.id)
    return shown(owner, seen)
  }
  return (doc.nodes || []).filter((n) => shown(n, new Set()))
}

/** Merges a geometry patch — what the canvas reports on drop. */
export function moveNode(doc, id, patch) {
  const geometry = {}
  ;['x', 'y', 'w', 'h', 'z'].forEach((k) => { if (typeof patch[k] === 'number') geometry[k] = round(patch[k]) })
  return mapNode(doc, id, (n) => ({ ...n, ...geometry }))
}

/**
 * Sets one property by path on a node — `props.validation.maxLength`.
 *
 * Renaming an input's LABEL also renames its field name, for as long as that
 * name is still the one made for it: a dropdown dropped as "Dropdown" and
 * relabelled "Location" should save as `location`, not `dropdown`. A name
 * someone typed is theirs, and is left alone.
 *
 * A LOCKED name — one that is already a column of the table — never changes:
 * not by typing, and not by following the label. Renaming it would start a new
 * empty column and strand the saved data in the old one.
 *
 * @param options.lockedNames  field names that are columns already
 */
export function setNodeProperty(doc, id, path, value, controls = CONTROLS, options = {}) {
  const node = doc.nodes.find((n) => n.id === id)
  const locked = options.lockedNames ? new Set(options.lockedNames) : null
  const isLocked = Boolean(node && locked && locked.has(node.props?.name))
  if (path === 'props.name' && isLocked) return doc
  const followLabel = path === 'props.label' && node && !isLocked && controls[node.type]?.input && isAutoName(node, controls)
  let next = mapNode(doc, id, (n) => {
    const updated = setAtPath(n, path, value)
    // setAtPath prunes an emptied object; `props` itself must always exist.
    return updated.props ? updated : { ...updated, props: {} }
  })
  if (followLabel) {
    const base = camelName(value) || node.type
    const others = { ...next, nodes: next.nodes.filter((n) => n.id !== id) }
    next = mapNode(next, id, (n) => ({ ...n, props: { ...n.props, name: uniqueFieldName(others, base) } }))
  }
  return next
}

/** Is this input's name still the one generated from its label or type? */
function isAutoName(node, controls) {
  const name = node.props?.name
  if (!name) return true
  const stem = name.replace(/\d+$/, '')
  return stem === camelName(node.props.label) || stem === node.type || stem === camelName(controls[node.type]?.defaults?.label)
}

export function getNodeProperty(node, path) {
  return getAtPath(node, path)
}

export function removeNodes(doc, ids) {
  const gone = new Set(ids)
  return { ...doc, nodes: doc.nodes.filter((n) => !gone.has(n.id)) }
}

/** The nodes that hold a value, in reading order (top to bottom, left to right). */
export function inputNodes(doc, controls = CONTROLS) {
  return readingOrder(doc.nodes.filter((n) => controls[n.type]?.input))
}

export function readingOrder(nodes) {
  // Rows are compared with a little tolerance: two fields side by side are
  // rarely at EXACTLY the same y after a drag.
  return [...nodes].sort((a, b) => (Math.abs(a.y - b.y) > 0.02 ? a.y - b.y : a.x - b.x))
}

/** Where the lowest control ends, as a page fraction. */
export function contentBottom(doc, nodes) {
  return (nodes || doc.nodes).reduce((max, n) => Math.max(max, (n.y || 0) + (n.h || 0)), 0)
}

// ── naming ───────────────────────────────────────────────────────────────

/** "Date of birth" → "dateOfBirth". What a field is saved under. */
export function camelName(label) {
  const words = String(label || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const name = words.map((w, i) => {
    const lower = w.toLowerCase()
    return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join('')
  return /^[0-9]/.test(name) ? '_' + name : name
}

export function slugify(text, sep = '-') {
  return String(text || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, sep).replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), '')
}

export function uniqueFieldName(doc, base) {
  const taken = new Set(doc.nodes.map((n) => n.props?.name).filter(Boolean))
  return uniqueOf(base, taken)
}

function uniqueNodeId(doc, base) {
  const taken = new Set(doc.nodes.map((n) => n.id))
  return uniqueOf(base, taken)
}

function uniqueOf(base, taken) {
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(base + i)) i++
  return base + i
}

// ── placement ────────────────────────────────────────────────────────────

/** Below everything already placed, at the left margin. */
export function nextPosition(doc, size) {
  const bottom = contentBottom(doc)
  return clampPosition({ x: MARGIN, y: bottom ? bottom + GAP : MARGIN }, size)
}

function clampPosition(at, size) {
  const w = Math.min(1, size.w)
  return {
    x: round(Math.min(Math.max(0, at.x), 1 - w)),
    y: round(Math.max(0, at.y))
  }
}

function nextZ(doc) {
  return doc.nodes.reduce((max, n) => Math.max(max, n.z || 0), 0) + 1
}

function mapNode(doc, id, fn) {
  let found = false
  const nodes = doc.nodes.map((n) => {
    if (n.id !== id) return n
    found = true
    return fn(n)
  })
  return found ? { ...doc, nodes } : doc
}

/** Four decimals: well under a pixel at any real width, and a diff stays readable. */
export function round(v) {
  return Math.round(v * 10000) / 10000
}

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v))
}
