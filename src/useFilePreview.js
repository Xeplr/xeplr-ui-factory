import { useEffect, useState } from 'react'
import { isImageFile } from './controls.js'

// A STORED PICTURE, SHOWN. Attachments come back only through the factory's
// signed route, which an <img src> cannot call — so the bytes are fetched
// (`readFile`, the host's signed fetch) and shown from a local object URL,
// released when the path changes or the field goes away. No JSX.

/**
 * @param path      a stored path, as the upload answered with it
 * @param readFile  async (path) → Blob, or nothing (then: no preview)
 * @returns {{ url, failed }} — url is null until loaded, for a non-picture,
 *          or without readFile
 */
export function useFilePreview(path, readFile) {
  const [state, setState] = useState({ url: null, failed: false })
  const wanted = Boolean(path && readFile && isImageFile(path))

  useEffect(() => {
    if (!wanted) { setState({ url: null, failed: false }); return undefined }
    let gone = false
    let url = null
    Promise.resolve()
      .then(() => readFile(path))
      .then((blob) => {
        if (gone) return
        url = URL.createObjectURL(blob)
        setState({ url, failed: false })
      })
      .catch(() => { if (!gone) setState({ url: null, failed: true }) })
    return () => {
      gone = true
      if (url) URL.revokeObjectURL(url)
    }
    // readFile is the host's function; a new one each render must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, wanted])

  return state
}
