// A RECORD'S FEED — comments, and the record's history (its timeline), in one
// list: what was said about an order and what happened to it, newest first.
// Pure: no React, no fetching. The same rules are used by the controller, by
// the server (@xeplr/factory reads this file through ./model) and by any other
// renderer — a phone app included.
//
// The ENTRIES are worked out by a function of the app, registered with
// @xeplr/actions for event "feedEntries" and named in the control's
// `entriesFrom`. It is given the record the screen is about (ctx.record,
// ctx.id) and returns entries. Everything an entry shows is TEXT THE SERVER
// WROTE — "Today, 4:00 pm", "Riya · Packing" — so it reads the same in any
// renderer, in the app's own words and time zone:
//
//   { id, kind: 'comment' | 'event',
//     text,                          what was said, or what happened ("Status → Packed")
//     author?: { name, badge? },     who — a comment's writer, an event's doer
//     at?:     'Today, 4:00 pm',     when, as shown
//     files?:  [{ path, name? }],    a comment's attachments (stored paths)
//     sub?:    'on task Call the customer',    a quieter second line
//     convert?:   { name: 'Call her', … },     it can still become a record of
//                                               another form, starting with these values
//     converted?: { id: 'tk_9', text: 'Call her' } }  the record it became
//
// A COMMENT is written in the box under the feed and SAVED THROUGH A FORM of
// the app (`compose.screen`) — so that form's rules, file limits and events
// (telling everyone) apply exactly as they do anywhere else. The feed fills
// in the link back to the record (`compose.linkField`), the text
// (`compose.textField`) and, when the form has one, a file (`compose.fileField`).
//
// A COMMENT CAN BECOME A RECORD of another form — a task made from what was
// said (`convert`: { screen, linkField, label?, openScreen? }). The function
// decides which entries still can (`convert`, the values that form starts
// with) and which already did (`converted`, the record it became — opened in
// `openScreen` when there is one). The form's own save does the rest: the
// app's rules there say whether that comment may still be converted.
//
// An EVENT is never written here: it is the record's history, said by the
// function. With `eventsSwitch`, a "Comments only" switch hides events.

export const FEED_EVENT = 'feedEntries'
export const FEED_KINDS = ['comment', 'event']
export const FEED_ORDERS = ['newest', 'oldest']

/** Most entries one answer may hold; the rest are dropped. */
export const MAX_FEED_ENTRIES = 500
/** Most characters of one entry's text, and of one comment written. */
export const MAX_ENTRY_TEXT = 5000
/** Least seconds between two reloads of a feed that refreshes itself. */
export const MIN_FEED_REFRESH = 10

const FIELD = /^[A-Za-z_][A-Za-z0-9_]*$/
const SCREEN = /^[A-Za-z0-9_-]+$/

function text(v) {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

/**
 * What a feedEntries function returned, as entries a renderer can draw —
 * anything it cannot use is dropped rather than drawn wrong. Accepts the
 * entries or { entries }.
 */
export function entriesOf(out) {
  const list = Array.isArray(out) ? out : out && Array.isArray(out.entries) ? out.entries : []
  const seen = new Set()
  const entries = []
  for (const e of list) {
    if (!e || typeof e !== 'object') continue
    const id = text(e.id)
    if (!id || seen.has(id)) continue
    const body = text(e.text).slice(0, MAX_ENTRY_TEXT)
    const files = Array.isArray(e.files)
      ? e.files.filter((f) => f && typeof f.path === 'string' && f.path).map((f) => ({ path: f.path, name: text(f.name) || null }))
      : []
    if (!body && !files.length) continue
    seen.add(id)
    const author = e.author && typeof e.author === 'object' && text(e.author.name)
      ? { name: text(e.author.name), badge: text(e.author.badge) || null }
      : null
    entries.push({
      id,
      kind: FEED_KINDS.includes(e.kind) ? e.kind : 'comment',
      text: body,
      author,
      at: text(e.at) || null,
      files,
      sub: text(e.sub) || null,
      convert: convertOf(e.convert),
      converted: e.converted && typeof e.converted === 'object' && text(e.converted.id)
        ? { id: text(e.converted.id), text: text(e.converted.text) || null }
        : null
    })
    if (entries.length >= MAX_FEED_ENTRIES) break
  }
  return entries
}

// The values an entry's conversion starts with: field names to plain values
// only — anything else is dropped rather than handed to a form.
function convertOf(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const out = {}
  Object.keys(v).forEach((k) => {
    const x = v[k]
    if (FIELD.test(k) && (x === null || ['string', 'number', 'boolean'].includes(typeof x))) out[k] = x
  })
  return out
}

/**
 * What the conversion form is opened with: the entry's starting values, and
 * the link back to the record the feed is about (which the entry cannot
 * change). Null when this feed or this entry does not convert.
 */
export function convertParams(convert, recordId, entry) {
  if (!convert || !entry || !entry.convert || entry.converted) return null
  if (recordId === null || recordId === undefined || recordId === '') return null
  return { ...entry.convert, [convert.linkField]: recordId }
}

/** The entries shown: events left out when only comments are asked for. */
export function shownEntries(entries, commentsOnly) {
  return commentsOnly ? entries.filter((e) => e.kind === 'comment') : entries
}

/** "Amit Verma" → "AV", "Riya" → "R" — the round avatar's letters. */
export function initials(name) {
  const words = text(name).trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}

/**
 * The values a comment is saved with, through the compose form: the link back
 * to the record, the text, and the file when one was attached.
 * @returns {{ values?: object, error?: string }}
 */
export function composeValues(compose, recordId, typed, filePath) {
  if (!compose) return { error: 'This feed takes no comments' }
  if (recordId === null || recordId === undefined || recordId === '') return { error: 'Save the record first — a comment belongs to it' }
  const body = text(typed).trim()
  if (!body && !filePath) return { error: 'Write something first' }
  if (body.length > MAX_ENTRY_TEXT) return { error: `A comment can be at most ${MAX_ENTRY_TEXT} characters` }
  if (filePath && !compose.fileField) return { error: 'This feed takes no files' }
  const values = { [compose.linkField]: recordId, [compose.textField]: body }
  if (filePath) values[compose.fileField] = filePath
  return { values }
}

/**
 * Every problem with a feed control's props, as [{ path, message }] under `at`
 * — all but `entriesFrom`, a function name, which validateDocument checks with
 * the other function names.
 */
export function feedProblems(props, at) {
  const out = []
  const err = (path, message) => out.push({ path, message })
  const p = props || {}
  if (p.title !== undefined && typeof p.title !== 'string') err(`${at}.props.title`, 'must be a string')
  if (p.order !== undefined && !FEED_ORDERS.includes(p.order)) err(`${at}.props.order`, `must be one of: ${FEED_ORDERS.join(', ')}`)
  if (p.eventsSwitch !== undefined && typeof p.eventsSwitch !== 'boolean') err(`${at}.props.eventsSwitch`, 'must be true or false')
  if (p.refreshEvery !== undefined && !(Number.isInteger(p.refreshEvery) && p.refreshEvery >= MIN_FEED_REFRESH)) {
    err(`${at}.props.refreshEvery`, `must be a whole number of seconds, at least ${MIN_FEED_REFRESH}`)
  }
  if (p.empty !== undefined && typeof p.empty !== 'string') err(`${at}.props.empty`, 'must be a string — what shows when there is nothing yet')
  if (p.compose !== undefined) {
    const c = p.compose
    const cat = `${at}.props.compose`
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      err(cat, 'must be { screen, linkField, textField, fileField?, placeholder? } — the form a comment is saved through')
    } else {
      const allowed = ['screen', 'linkField', 'textField', 'fileField', 'placeholder', 'button']
      Object.keys(c).forEach((k) => { if (!allowed.includes(k)) err(`${cat}.${k}`, `is not used — allowed: ${allowed.join(', ')}`) })
      if (!(typeof c.screen === 'string' && SCREEN.test(c.screen))) err(`${cat}.screen`, 'is required — the id of the form a comment is saved through, e.g. "order_comment_edit"')
      if (!(typeof c.linkField === 'string' && FIELD.test(c.linkField))) err(`${cat}.linkField`, 'is required — the field on that form pointing back at this record, e.g. "orderId"')
      if (!(typeof c.textField === 'string' && FIELD.test(c.textField))) err(`${cat}.textField`, 'is required — the field on that form the text is saved in, e.g. "body"')
      if (c.fileField !== undefined && !(typeof c.fileField === 'string' && FIELD.test(c.fileField))) err(`${cat}.fileField`, 'must be the file field on that form, e.g. "attachment"')
      if (c.placeholder !== undefined && typeof c.placeholder !== 'string') err(`${cat}.placeholder`, 'must be a string')
      if (c.button !== undefined && typeof c.button !== 'string') err(`${cat}.button`, 'must be a string — the label of the button that posts')
      const fields = [c.linkField, c.textField, c.fileField].filter((f) => typeof f === 'string')
      if (new Set(fields).size !== fields.length) err(cat, 'linkField, textField and fileField must be three different fields')
    }
  }
  if (p.convert !== undefined) {
    const c = p.convert
    const cat = `${at}.props.convert`
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      err(cat, 'must be { screen, linkField, label?, openScreen? } — the form a comment becomes a record of')
    } else {
      const allowed = ['screen', 'linkField', 'label', 'openScreen']
      Object.keys(c).forEach((k) => { if (!allowed.includes(k)) err(`${cat}.${k}`, `is not used — allowed: ${allowed.join(', ')}`) })
      if (!(typeof c.screen === 'string' && SCREEN.test(c.screen))) err(`${cat}.screen`, 'is required — the id of the form a comment becomes, e.g. "order_task_edit"')
      if (!(typeof c.linkField === 'string' && FIELD.test(c.linkField))) err(`${cat}.linkField`, 'is required — the field on that form pointing back at this record, e.g. "orderId"')
      if (c.label !== undefined && typeof c.label !== 'string') err(`${cat}.label`, 'must be a string — the button on each comment, e.g. "Convert to task"')
      if (c.openScreen !== undefined && !(typeof c.openScreen === 'string' && SCREEN.test(c.openScreen))) err(`${cat}.openScreen`, 'must be the id of the screen the record it became opens in, e.g. "order_task_view"')
    }
  }
  return out
}
