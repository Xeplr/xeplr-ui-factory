// A SCREEN'S EVENTS — the moments a developer's code may run around its
// records, each picked BY NAME from the functions the app registered.
//
// The code lives in the app (registered with @xeplr/actions, `event` set to
// one of the keys below); the screen only names it:
//
//   doc.events = { beforeSave: 'checkSalaryBand', afterSave: 'notifyHR' }
//
// One function per event, and this is the ONLY way to attach one — the screen
// is the one place that says what runs. Every event runs on the SERVER: a rule
// that runs in the browser is one a person can skip.
//
// What each is called with, and what it may return, is the contract a
// developer writes to. `@xeplr/factory` runs them; the designer lists them.

export const SCREEN_EVENTS = [
  {
    key: 'beforeLoad',
    label: 'Before load',
    when: 'Before records are read — the list, and one record for Edit',
    gets: 'ctx.query (narrow it), ctx.id (one record) or ctx.many (the list), ctx.user, ctx.tenant',
    returns: 'nothing, or a new query'
  },
  {
    key: 'beforeSave',
    label: 'Before save',
    when: 'Before a record is written — the screen\'s rules run on what it returns',
    gets: 'ctx.values, ctx.isNew, ctx.previous (on update), ctx.user',
    returns: 'the values to save (or nothing to keep them); ctx.reject(message, { field }) refuses'
  },
  {
    key: 'afterSave',
    label: 'After save',
    when: 'Once the record is saved',
    gets: 'ctx.result (the saved row), ctx.isNew, ctx.values',
    returns: 'nothing — what it does is the point (an email, another record)'
  },
  {
    key: 'beforeDelete',
    label: 'Before delete',
    when: 'Before a record is deleted',
    gets: 'ctx.previous (the row), ctx.id',
    returns: 'nothing; ctx.reject(message) refuses'
  },
  {
    key: 'onError',
    label: 'On error',
    when: 'When loading, saving or deleting failed',
    gets: 'ctx.error, ctx.op (get, save or delete)',
    returns: 'nothing — the error is still the answer; this is for telling someone'
  }
]

export const SCREEN_EVENT_KEYS = SCREEN_EVENTS.map((e) => e.key)

/**
 * A FLOW's "let a function decide": the function an arrow asks for the next
 * step. Not a screen event — the workflow engine runs it, between screens.
 */
export const DECIDE_EVENT = 'decide'

/** A function's name: what it was registered under. */
export const FUNCTION_NAME = /^[A-Za-z_][\w.-]{0,99}$/

/** The functions a screen names, as [{ event, name }] — what has to be registered for it to run. */
export function screenFunctions(doc) {
  const ev = (doc && doc.events) || {}
  return SCREEN_EVENT_KEYS.filter((k) => typeof ev[k] === 'string' && ev[k]).map((k) => ({ event: k, name: ev[k] }))
}

/**
 * Which of a screen's functions are not registered, or are registered for a
 * different event — given the registry's list ([{ name, event }]). Empty when
 * the screen can run. Said by name, so the fix is obvious.
 */
export function missingFunctions(doc, registered) {
  const byName = new Map((registered || []).map((f) => [f.name, f]))
  return screenFunctions(doc).flatMap(({ event, name }) => {
    const f = byName.get(name)
    if (!f) return [{ event, name, problem: `"${name}" is not a registered function` }]
    if (f.event !== event) return [{ event, name, problem: `"${name}" is written for ${f.event ? `"${f.event}"` : 'a workflow step'}, not "${event}"` }]
    return []
  })
}
