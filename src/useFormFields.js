import { useEffect, useState } from 'react'
import { inputNodes } from './document.js'

// THE APP'S FORMS AND THEIR FIELDS — what a field's "Fill in from" picker
// offers: in a flow, a screen before this one, and what it saved. No JSX.
//
// Every published screen that has fields of its own (a list screen has none),
// each with `id` — the row it saved — then its fields by the name they are
// saved under. Loaded once per builder, through the app's own API client.

/**
 * @param api  a createFactoryApi() instance (builderProps.screenApi)
 * @returns [{ key, name, fields: [{ name, label }] }]
 */
export function useFormFields(api) {
  const [forms, setForms] = useState([])
  useEffect(() => {
    if (!api || !api.listScreens || !api.loadScreen) return undefined
    let gone = false
    Promise.resolve()
      .then(() => api.listScreens())
      .then((rows) => Promise.all((rows || []).filter((r) => r && r.version).map(async (r) => {
        try {
          const doc = await api.loadScreen(r.screenKey)
          const fields = inputNodes(doc).map((n) => ({ name: n.props.name, label: n.props.label || n.props.name }))
          if (!fields.length) return null
          return { key: doc.id, name: doc.name || doc.id, fields: [{ name: 'id', label: 'the row it saved (id)' }, ...fields] }
        } catch (err) {
          return null
        }
      })))
      .then((list) => { if (!gone) setForms(list.filter(Boolean)) })
      .catch(() => { /* the picker then offers this screen's own inputs only */ })
    return () => { gone = true }
  }, [api])
  return forms
}
