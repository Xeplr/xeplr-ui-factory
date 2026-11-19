import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { entriesOf, shownEntries, composeValues, convertParams } from './feed.js'
import { inputNodes } from './document.js'

// THE FEEDS ON A SCREEN — each one's entries for the record the screen is
// about, the "Comments only" switch, and the box a comment is written in.
// No JSX: any design (the web's, a phone's) draws what this returns.
//
// A feed asks again when the record changes, when something is posted, when
// the host says something changed (reloadKey), and every `refreshEvery`
// seconds when the screen says so. A screen with no saved record shows no
// entries and takes no comment — there is nothing yet for one to be about.

/**
 * @param doc        the screen
 * @param recordId   the record the screen is about (null for a new one)
 * @param fetchFeed  async ({ screen, node, id }) → { entries }
 * @param onSave     async (values, { screen }) → saved — the compose form's save
 * @param uploadFile async (file, { screen, field }) → { path } — the compose form's file field
 * @param loadScreen async (id) → document — reads the compose form's file rules
 * @param reloadKey  anything — when it changes, every feed asks again
 * @param openPopup  ({ screenId, id?, params?, label? }) — opens a form in the
 *                   screen's popup: a comment's conversion, or what it became
 */
export function useFeeds({ doc, recordId, fetchFeed, onSave, uploadFile, loadScreen, reloadKey, openPopup }) {
  const nodes = useMemo(() => ((doc && doc.nodes) || []).filter((n) => n.type === 'feed'), [doc])
  const [state, setState] = useState({})              // node id → { entries, loading, error }
  const [commentsOnly, setCommentsOnly] = useState({}) // node id → true
  const [drafts, setDrafts] = useState({})             // node id → { text, file, posting, error }
  const [rules, setRules] = useState({})               // compose screen id → its file field's rules
  const [version, setVersion] = useState(0)
  const fetchRef = useRef(fetchFeed); fetchRef.current = fetchFeed
  const saveRef = useRef(onSave); saveRef.current = onSave
  const uploadRef = useRef(uploadFile); uploadRef.current = uploadFile
  const popupRef = useRef(openPopup); popupRef.current = openPopup
  const has = recordId !== null && recordId !== undefined && recordId !== ''

  useEffect(() => {
    if (!nodes.length) return undefined
    let gone = false
    nodes.forEach((node) => {
      if (!has || !fetchRef.current) {
        setState((s) => ({ ...s, [node.id]: { entries: [], loading: false, error: has ? 'No fetchFeed was provided — the feed cannot be read' : null } }))
        return
      }
      setState((s) => ({ ...s, [node.id]: { entries: s[node.id]?.entries || [], loading: true, error: null } }))
      Promise.resolve()
        .then(() => fetchRef.current({ screen: doc.id, node: node.id, id: recordId }))
        .then((out) => { if (!gone) setState((s) => ({ ...s, [node.id]: { entries: entriesOf(out), loading: false, error: null } })) })
        .catch((err) => { if (!gone) setState((s) => ({ ...s, [node.id]: { entries: s[node.id]?.entries || [], loading: false, error: err.message || 'Could not load' } })) })
    })
    return () => { gone = true }
  }, [nodes, doc, recordId, has, version, reloadKey])

  // A feed whose entries say "2h ago" asks again now and then.
  const every = useMemo(() => Math.min(...nodes.map((n) => n.props.refreshEvery || Infinity)), [nodes])
  useEffect(() => {
    if (!Number.isFinite(every) || !has) return undefined
    const t = setInterval(() => setVersion((v) => v + 1), every * 1000)
    return () => clearInterval(t)
  }, [every, has])

  // The compose forms' file rules (accept, size), so the picker offers only
  // what the form will take. Without loadScreen the server still refuses.
  const composeScreens = nodes.map((n) => n.props.compose && n.props.compose.fileField ? n.props.compose.screen : null).filter(Boolean).join('|')
  useEffect(() => {
    if (!composeScreens || !loadScreen) return undefined
    let gone = false
    composeScreens.split('|').forEach((id) => {
      Promise.resolve().then(() => loadScreen(id)).then((found) => {
        if (gone || !found) return
        const fileFields = inputNodes(found).filter((n) => n.type === 'file')
        setRules((r) => ({ ...r, [id]: Object.fromEntries(fileFields.map((n) => [n.props.name, n.props])) }))
      }, () => {})
    })
    return () => { gone = true }
  }, [composeScreens]) // eslint-disable-line react-hooks/exhaustive-deps

  const draftOf = (id) => drafts[id] || { text: '', file: null, posting: false, error: null }
  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...(d[id] || { text: '', file: null, posting: false, error: null }), ...patch } }))

  const feedFor = useCallback((node) => {
    const p = node.props || {}
    const s = state[node.id] || { entries: [], loading: has, error: null }
    const only = Boolean(commentsOnly[node.id])
    const ordered = p.order === 'oldest' ? [...s.entries].reverse() : s.entries
    const c = p.compose || null
    const draft = draftOf(node.id)
    const fileRules = c && c.fileField ? ((rules[c.screen] || {})[c.fileField] || {}) : null
    return {
      entries: shownEntries(ordered, only),
      hasEvents: s.entries.some((e) => e.kind === 'event'),
      loading: s.loading,
      error: s.error,
      waiting: !has,
      commentsOnly: only,
      setCommentsOnly: (v) => setCommentsOnly((m) => ({ ...m, [node.id]: Boolean(v) })),
      reload: () => setVersion((v) => v + 1),
      // A comment that can still become a task: its button opens the task's
      // form, filled in from it. One that did: a link to the task.
      convert: p.convert && popupRef.current ? {
        label: p.convert.label || 'Convert',
        can: (entry) => Boolean(convertParams(p.convert, recordId, entry)),
        start: (entry) => {
          const params = convertParams(p.convert, recordId, entry)
          if (params) popupRef.current({ screenId: p.convert.screen, params })
        },
        canOpen: (entry) => Boolean(entry && entry.converted && p.convert.openScreen),
        open: (entry) => {
          if (entry && entry.converted && p.convert.openScreen) popupRef.current({ screenId: p.convert.openScreen, id: entry.converted.id, label: entry.converted.text, params: has && p.convert.linkField ? { [p.convert.linkField]: recordId } : null })
        }
      } : null,
      compose: c && has && onSave ? {
        text: draft.text,
        file: draft.file,
        posting: draft.posting,
        error: draft.error,
        placeholder: c.placeholder || 'Write a comment…',
        button: c.button || 'Post',
        fileRules: fileRules ? { accept: fileRules.accept, maxSize: fileRules.maxSize, source: fileRules.source } : null,
        setText: (t) => setDraft(node.id, { text: t, error: null }),
        // The file is stored when it is chosen, so posting only names it.
        upload: c.fileField && uploadRef.current ? async (file) => {
          setDraft(node.id, { error: null })
          const out = await uploadRef.current(file, { screen: c.screen, field: c.fileField })
          setDraft(node.id, { file: out && out.path ? { path: out.path, name: file.name } : null })
          return out
        } : null,
        removeFile: () => setDraft(node.id, { file: null }),
        post: async () => {
          const d = draftOf(node.id)
          const made = composeValues(c, recordId, d.text, d.file && d.file.path)
          if (made.error) { setDraft(node.id, { error: made.error }); return false }
          setDraft(node.id, { posting: true, error: null })
          try {
            await saveRef.current(made.values, { id: null, screen: c.screen })
            setDraft(node.id, { text: '', file: null, posting: false, error: null })
            setVersion((v) => v + 1)
            return true
          } catch (err) {
            setDraft(node.id, { posting: false, error: err.message || 'Could not post' })
            return false
          }
        }
      } : null
    }
  }, [state, commentsOnly, drafts, rules, has, recordId, onSave]) // eslint-disable-line react-hooks/exhaustive-deps

  return { feedFor, hasFeeds: nodes.length > 0 }
}
