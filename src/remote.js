// The browser side of @xeplr/factory: every call FactoryScreen and
// FactoryBuilder need, as requests to its routes. Records live in REAL tables
// in the app's database; this only sends and receives.
//
//   import { authFetch } from '@xeplr/ui-account'
//   const factory = createFactoryApi({ fetch: authFetch })
//   <FactoryScreen document={screen} {...factory.screenProps} />
//   <FactoryBuilder document={screen} {...factory.builderProps} lockedNames={…} />
//
// Responses are xeplr's { code, message, error, dataArray }.

/**
 * @param options.fetch  a fetch that adds auth and tenant headers (e.g. @xeplr/ui-account's authFetch)
 * @param options.base   prefix before /factory, if the router is mounted elsewhere (default '')
 */
export function createFactoryApi({ fetch: doFetch, base = '' } = {}) {
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
    // A new form from its name: { entity, plural? } → { entity, name, source, edit, list } — both screens as drafts.
    createEntity: async (spec) => one(await call('POST', '/entities', spec)),

    // records
    fetchRecords: ({ screen }) => call('GET', `/records/${enc(screen)}`),
    // One record, through the screen's get hooks — what Edit opens.
    fetchRecord: async ({ screen, id }) => one(await call('GET', `/records/${enc(screen)}/${enc(id)}`)),
    onSave: async (values, { id, screen }) => one(await call('POST', `/records/${enc(screen)}/save`, { id, values })),
    onDelete: ({ id, screen }) => call('POST', `/records/${enc(screen)}/delete`, { id }),
    fetchOptions: ({ table }) => call('GET', `/options/${enc(table)}`),

    // A file field's upload. The answer's `path` is what the record stores;
    // the file itself is read back through the same route, with auth.
    uploadFile: async (file, { screen, field }) => {
      const form = new FormData()
      form.append('file', file)
      return one(await send('POST', `/files/${enc(screen)}/${enc(field)}`, form))
    },
    fileUrl: (path) => `${base}/factory/files/${String(path).split('/').map(enc).join('/')}`
  }
  api.screenProps = { loadScreen: api.loadScreen, onSave: api.onSave, fetchRecords: api.fetchRecords, fetchRecord: api.fetchRecord, onDelete: api.onDelete, fetchOptions: api.fetchOptions, uploadFile: api.uploadFile, fileUrl: api.fileUrl }
  api.builderProps = { onSave: api.saveDraft, onPublish: api.publish, listTables: api.listTables, fetchOptions: api.fetchOptions, fetchRecords: api.fetchRecords }
  return api
}
