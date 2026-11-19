import { useEffect, useState } from 'react'

// A PUBLISHED SCREEN DOCUMENT, LOADED ONCE PER VISIT — for a page that is one
// screen (Orders, Packing), on the web or on a phone. `loadScreen` is the
// host's (createFactoryApi(...).loadScreen); `key` the screen's id.
//
//   const screen = useScreenDocument(factory.loadScreen, 'orders_board')
//   screen.doc / screen.error / screen.reload()

export function useScreenDocument(loadScreen, key) {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let live = true
    // Another screen on the same page: never the last one's meanwhile.
    setDoc(null)
    setError(null)
    Promise.resolve()
      .then(() => loadScreen(key))
      .then((d) => { if (live) setDoc(d || null) }, (e) => { if (live) setError((e && e.message) || 'Could not load the screen') })
    return () => { live = false }
  }, [key, version]) // eslint-disable-line react-hooks/exhaustive-deps
  return { doc, error, reload: () => setVersion((v) => v + 1) }
}
