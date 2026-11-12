// The browser side of @xeplr/factory: every call FactoryScreen and
// FactoryBuilder need, as requests to its routes. Records live in REAL tables
// in the app's database; this only sends and receives.
//
//   import { authFetch } from '@xeplr/ui-account'
//   const factory = createFactoryApi({ fetch: authFetch, fetchFile: authFetchFile })
//   <FactoryScreen document={screen} {...factory.screenProps} />
//   <FactoryBuilder document={screen} {...factory.builderProps} lockedNames={…} />
//
// Responses are xeplr's { code, message, error, dataArray }.

/**
 * @param options.fetch  a fetch that adds auth and tenant headers (e.g. @xeplr/ui-account's authFetch)
 * @param options.base   prefix before /factory, if the router is mounted elsewhere (default '')
 * @param options.fetchFile  (url) → Blob, signed like `fetch` (@xeplr/ui-account's authFetchFile):
 *                       how an attached picture is read back for its preview. Without it
 *                       a file field shows names only — an <img> cannot send the token.
 */
import { createChildTable } from './masters.js'

export function createFactoryApi({ fetch: doFetch, fetchFile, base = '' } = {}) {
  if (typeof doFetch !== 'function') throw new Error('createFactoryApi: pass { fetch } — usually authFetch from @xeplr/ui-account')

  // Two kinds of fetch are accepted, because both are what apps have:
  //   window.fetch-like  → a Response: read it, and throw on !res.ok
  //   authFetch-like     → the PARSED body, and on failure it throws an Error
  //                        carrying status and the body (err.status, err.body)
  // Either way a failure becomes the same Error, with the server's fields,
  // confirm and refused lists on it.
  async function call(method, path, body) {
    let res
    try {
      res = await doFetch(`${base}/factory${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      })
    } catch (err) {
      if (err && err.body !== undefined && err.status) throw failure(method, path, err.status, err.body, err.message)
      throw err
    }
    if (res && typeof res.json === 'function' && typeof res.ok === 'boolean') {
      let json = null
      try { json = await res.json() } catch (_) { /* not JSON — reported below */ }
      if (!res.ok) throw failure(method, path, res.status, json)
      return json ? json.dataArray : []
    }
    return res && Array.isArray(res.dataArray) ? res.dataArray : []
  }

  /**
   * The same call, with a body the browser must describe itself (a FormData's
   * multipart boundary). Nothing sets Content-Type here — see authFetch.
   */
  async function send(method, path, body) {
    let res
    try {
      res = await doFetch(`${base}/factory${path}`, { method, body })
    } catch (err) {
      if (err && err.body !== undefined && err.status) throw failure(method, path, err.status, err.body, err.message)
      throw err
    }
    if (res && typeof res.json === 'function' && typeof res.ok === 'boolean') {
      let json = null
      try { json = await res.json() } catch (_) { /* not JSON — reported below */ }
      if (!res.ok) throw failure(method, path, res.status, json)
      return json ? json.dataArray : []
    }
    return res && Array.isArray(res.dataArray) ? res.dataArray : []
  }

  function failure(method, path, status, json, fallback) {
    const err = new Error((json && json.message) || fallback || `${method} ${path} failed (${status})`)
    err.status = status
    err.fields = json && json.error && json.error.fields
    const extra = (json && json.dataArray && json.dataArray[0]) || {}
    // Publish: columns it would drop, waiting for a yes — and what it keeps.
    err.confirm = extra.confirm
    // …columns changing kind, waiting for a yes; and ones whose values will not fit.
    err.convert = extra.convert
    err.wontFit = extra.wontFit
    err.keep = extra.keep
    err.refused = extra.refused
    if (extra.statements) err.detail = extra.statements.join('\n')
    return err
  }
  const one = (rows) => (Array.isArray(rows) ? rows[0] : rows)
  const enc = encodeURIComponent
  const query = (params) => {
    const pairs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    return pairs.length ? '?' + pairs.map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&') : ''
  }

  const api = {
    // screens
    listScreens: () => call('GET', '/screens'),
    loadScreen: async (key) => one(await call('GET', `/screens/${enc(key)}`)).document,
    loadDraft: async (key) => one(await call('GET', `/screens/${enc(key)}?draft=true`)),
    saveDraft: (doc) => call('PUT', `/screens/${enc(doc.id)}/draft`, { document: doc }),
    // Changes the screen's table directly. Rejects with err.confirm = [{ column, records }]
    // when a removed field would drop a column; call again with { confirmDrop: [names] }.
    publish: async (doc, options) => one(await call('POST', `/screens/${enc(doc.id)}/publish`, {
      confirmDrop: (options && options.confirmDrop) || [],
      confirmConvert: (options && options.confirmConvert) || []
    })),
    listTables: () => call('GET', '/tables'),
    // The app's registered functions a screen's events — and a flow's "let a
    // function decide" — can pick: [{ name, event, description }], never code.
    listFunctions: () => call('GET', '/functions'),
    // DELETE A FORM'S SCREEN. The design always goes; the table only when it
    // is empty and nothing else describes it — the answer says which
    // happened, and how many records kept it. Refused while another
    // published screen chooses from this form's table.
    deleteScreen: async (key) => one(await call('DELETE', `/screens/${enc(key)}`)),
    // A new form from its name: { entity, plural? } → { entity, name, source, edit, list } — both screens as drafts.
    createEntity: async (spec) => one(await call('POST', '/entities', spec)),

    // records
    // `belongsTo` + `belongsToId`: a sub-table on a form asks for the rows of
    // another table that belong to THIS record. Without an owner the server
    // answers with none — a record that has not been saved yet owns nothing,
    // and showing the whole table there is how somebody edits another
    // record's lines.
    fetchRecords: ({ screen, belongsTo, belongsToId }) => call('GET', belongsTo
      ? `/records/${enc(screen)}?belongsTo=${enc(belongsTo)}&belongsToId=${enc(belongsToId == null ? '' : belongsToId)}`
      : `/records/${enc(screen)}`),
    // One record, through the screen's get hooks — what Edit opens.
    fetchRecord: async ({ screen, id }) => one(await call('GET', `/records/${enc(screen)}/${enc(id)}`)),
    onSave: async (values, { id, screen }) => one(await call('POST', `/records/${enc(screen)}/save`, { id, values })),
    onDelete: ({ id, screen }) => call('POST', `/records/${enc(screen)}/delete`, { id }),
    fetchOptions: ({ table }) => call('GET', `/options/${enc(table)}`),

    // ROWS A FUNCTION WORKS OUT, for a list with rowsFrom: { rows, counts }.
    // Only what the person typed goes with it — the function is the screen's.
    fetchRows: async ({ screen, node, q, filter, kpi, from, to }) => one(await call('GET', `/rows/${enc(screen)}${query({ node, q, filter, kpi, from, to })}`)),
    // AN AUTOCOMPLETE'S SUGGESTIONS for what was typed: [{ value, label, sub?, image?, fill? }].
    // The function is the screen's (suggestFrom); only the text goes with it.
    suggest: async ({ screen, node, q }) => {
      const out = await call('GET', `/suggest/${enc(screen)}${query({ node, q })}`)
      return Array.isArray(out) ? out : []
    },
    // An activity cell's hover box for one row.
    fetchRowDetails: ({ screen, node, column, id }) => call('GET', `/rows/${enc(screen)}/details${query({ node, column, id })}`),
    // A button's press on one record → { button, message, output }. The
    // server reads the button — its function and parameters — from the
    // published screen; the request names it and carries the note.
    pressButton: async ({ screen, button, id, note, files, values }) => one(await call('POST', `/buttons/${enc(screen)}/${enc(button)}`, {
      id, ...(note ? { note } : {}), ...(Array.isArray(files) && files.length ? { files } : {}),
      ...(values && Object.keys(values).length ? { values } : {})
    })),
    // A file a button's ask.file takes, stored before the press; the press
    // then names it by the path this answers with.
    uploadButtonFile: async (file, { screen, button }) => {
      const form = new FormData()
      form.append('file', file)
      return one(await send('POST', `/buttons/${enc(screen)}/${enc(button)}/files`, form))
    },

    // A file field's upload. The answer's `path` is what the record stores;
    // the file itself is read back through the same route, with auth.
    uploadFile: async (file, { screen, field }) => {
      const form = new FormData()
      form.append('file', file)
      return one(await send('POST', `/files/${enc(screen)}/${enc(field)}`, form))
    },
    fileUrl: (path) => `${base}/factory/files/${String(path).split('/').map(enc).join('/')}`,
    // An attached file's bytes (a picture's preview), when the host said how.
    readFile: typeof fetchFile === 'function' ? (path) => fetchFile(api.fileUrl(path)) : undefined
  }
  api.screenProps = { loadScreen: api.loadScreen, onSave: api.onSave, fetchRecords: api.fetchRecords, fetchRecord: api.fetchRecord, onDelete: api.onDelete, fetchOptions: api.fetchOptions, uploadFile: api.uploadFile, fileUrl: api.fileUrl, readFile: api.readFile,
    fetchRows: api.fetchRows, fetchRowDetails: api.fetchRowDetails, suggest: api.suggest, pressButton: api.pressButton, uploadButtonFile: api.uploadButtonFile }
  // makeChildTable: a list on a form can make the table it is about to point
  // at — rows belonging to this record — without leaving the designer. A
  // server act, which is why the builder is given it rather than doing it.
  api.builderProps = { onSave: api.saveDraft, onPublish: api.publish, listTables: api.listTables, listFunctions: api.listFunctions, fetchOptions: api.fetchOptions, fetchRecords: api.fetchRecords, makeChildTable: function (spec) { return createChildTable(api, spec) },
    // The builder designs a child table in place, which needs the same calls
    // this api already makes — handed over rather than rebuilt.
    screenApi: api }
  return api
}
