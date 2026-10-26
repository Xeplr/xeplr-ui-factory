import { useCallback, useEffect, useRef, useState } from 'react'
import { functionsFor } from './events.js'

// THE APP'S FUNCTIONS — what a screen's events and a flow's "let a function
// decide" can pick. Registered in the app's code (@xeplr/actions, with an
// `event`); the server lists names, events and descriptions, never code.
// No JSX — a design draws the pickers.

/**
 * @param listFunctions  async () → [{ name, event, description }]  (createFactoryApi's listFunctions)
 */
export function useFunctionCatalog({ listFunctions } = {}) {
  const [functions, setFunctions] = useState([])
  const [loading, setLoading] = useState(Boolean(listFunctions))
  const [error, setError] = useState(null)
  const listRef = useRef(listFunctions); listRef.current = listFunctions

  const reload = useCallback(() => {
    if (!listRef.current) { setLoading(false); return Promise.resolve([]) }
    setLoading(true)
    setError(null)
    return Promise.resolve()
      .then(() => listRef.current())
      .then((rows) => { const list = Array.isArray(rows) ? rows : []; setFunctions(list); return list })
      .catch((err) => { setError(err.message || 'Could not list the app\'s functions'); return [] })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  return {
    functions,
    loading,
    error,
    reload,
    /** The functions one event may pick, by name. */
    forEvent: useCallback((event) => functionsFor(functions, event), [functions]),
    /** One function by name — or null: picked once, no longer registered. */
    byName: useCallback((name) => functions.find((f) => f.name === name) || null, [functions])
  }
}
