import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detailsOf } from './details.js'

// THE DETAILS PANELS ON A SCREEN — each one's sections for the record the
// screen is about, and its "More". No JSX: any design draws what this returns.
//
// A panel asks when the record changes and when the host says something
// changed (reloadKey). "More" asks once, when pressed, and is forgotten when
// the record changes — it is never kept anywhere.

/**
 * @param doc           the screen
 * @param recordId      the record the screen is about (null for a new one)
 * @param fetchDetails  async ({ screen, node, id, more }) → { sections, more }
 * @param reloadKey     anything — when it changes, every panel asks again
 */
export function useRecordDetails({ doc, recordId, fetchDetails, reloadKey }) {
  const nodes = useMemo(() => ((doc && doc.nodes) || []).filter((n) => n.type === 'details'), [doc])
  const [state, setState] = useState({})   // node id → { sections, more, loading, error }
  const [extra, setExtra] = useState({})   // node id → { sections, loading, error, open }
  const fetchRef = useRef(fetchDetails); fetchRef.current = fetchDetails
  const has = recordId !== null && recordId !== undefined && recordId !== ''

  useEffect(() => {
    if (!nodes.length) return undefined
    let gone = false
    setExtra({})
    nodes.forEach((node) => {
      if (!has || !fetchRef.current) {
        setState((s) => ({ ...s, [node.id]: { sections: [], more: false, loading: false, error: has ? 'No fetchDetails was provided — the details cannot be read' : null } }))
        return
      }
      setState((s) => ({ ...s, [node.id]: { sections: s[node.id]?.sections || [], more: false, loading: true, error: null } }))
      Promise.resolve()
        .then(() => fetchRef.current({ screen: doc.id, node: node.id, id: recordId }))
        .then((out) => { if (!gone) setState((s) => ({ ...s, [node.id]: { ...detailsOf(out), loading: false, error: null } })) })
        .catch((err) => { if (!gone) setState((s) => ({ ...s, [node.id]: { sections: [], more: false, loading: false, error: err.message || 'Could not load' } })) })
    })
    return () => { gone = true }
  }, [nodes, doc, recordId, has, reloadKey])

  const detailsFor = useCallback((node) => {
    const s = state[node.id] || { sections: [], more: false, loading: has, error: null }
    const x = extra[node.id] || null
    return {
      sections: s.sections,
      loading: s.loading,
      error: s.error,
      waiting: !has,
      // "More": offered when the function said there is more, and not yet asked.
      canShowMore: Boolean(s.more && !(x && x.open)),
      more: x,
      showMore: async () => {
        if (!fetchRef.current || !has) return
        setExtra((e) => ({ ...e, [node.id]: { sections: [], loading: true, error: null, open: true } }))
        try {
          const out = await fetchRef.current({ screen: doc.id, node: node.id, id: recordId, more: true })
          setExtra((e) => ({ ...e, [node.id]: { sections: detailsOf(out).sections, loading: false, error: null, open: true } }))
        } catch (err) {
          setExtra((e) => ({ ...e, [node.id]: { sections: [], loading: false, error: err.message || 'Could not load', open: true } }))
        }
      },
      hideMore: () => setExtra((e) => ({ ...e, [node.id]: null }))
    }
  }, [state, extra, has, doc, recordId])

  return { detailsFor }
}
