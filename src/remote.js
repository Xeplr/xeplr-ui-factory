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

  async function call(method, path, body) {
    const res = await doFetch(`${base}/factory${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    let json = null
    try { json = await res.json() } catch (_) { /* not JSON — reported below */ }
    if (!res.ok) {
      const err = new Error((json && json.message) || `${method} ${path} failed (${res.status})`)
      err.status = res.status
      err.fields = json && json.error && json.error.fields
      err.detail = json && json.dataArray && json.dataArray[0] && json.dataArray[0].migration
      throw err
    }
    return json ? json.dataArray : []
  }
  const one = (rows) => (Array.isArray(rows) ? rows[0] : rows)
  const enc = encodeURIComponent

  const api = {
    // screens
    listScreens: () => call('GET', '/screens'),
    loadScreen: async (key) => one(await call('GET', `/screens/${enc(key)}`)).document,
    loadDraft: async (key) => one(await call('GET', `/screens/${enc(key)}?draft=true`)),
    saveDraft: (doc) => call('PUT', `/screens/${enc(doc.id)}/draft`, { document: doc }),
    publish: async (doc) => one(await call('POST', `/screens/${enc(doc.id)}/publish`)),
    listTables: () => call('GET', '/tables'),

    // records
    fetchRecords: ({ screen }) => call('GET', `/records/${enc(screen)}`),
    onSave: async (values, { id, screen }) => one(await call('POST', `/records/${enc(screen)}/save`, { id, values })),
    onDelete: ({ id, screen }) => call('POST', `/records/${enc(screen)}/delete`, { id }),
    fetchOptions: ({ table }) => call('GET', `/options/${enc(table)}`)
  }
  api.screenProps = { loadScreen: api.loadScreen, onSave: api.onSave, fetchRecords: api.fetchRecords, onDelete: api.onDelete, fetchOptions: api.fetchOptions }
  api.builderProps = { onSave: api.saveDraft, onPublish: api.publish, listTables: api.listTables, fetchOptions: api.fetchOptions, fetchRecords: api.fetchRecords }
  return api
}
