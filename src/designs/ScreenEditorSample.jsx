// DESIGNING A FORM WHERE IT IS USED — the body of another package's modal.
//
// @xeplr/ui-workflow's designer offers a Screen step and a `screenEditor`
// render prop: it owns the window, the host owns what is inside it, because a
// screen belongs to the app and that package knows only a screen key. This is
// @xeplr/factory's answer to it, so that no application has to write one.
//
// Shaped to that contract exactly — ({ screenKey, onDone }) — but it is not
// about workflow: anything wanting "design this screen, tell me what it holds
// when it is saved" uses the same component. `screenKey` null means make one.
//
// PUBLISH IS WHAT COUNTS. A draft changes nothing anybody can run; publishing
// is what changes the table and makes the fields real, so that is the moment
// `onDone` fires and whoever is using the screen is told what it now holds.
import { useCallback, useEffect, useState } from 'react'
import { describeScreen, keyFromName, editScreenOf } from '../screenSource.js'

/**
 * @prop api        a createFactoryApi() instance
 * @prop screenKey  the screen to design; null to make a new one
 * @prop onDone     ({ key, name, fields }) → void, on publish
 * @prop labels     optional copy overrides
 */
export function ScreenEditorSample({ api, screenKey, onDone, Builder, labels = {} }) {
  const [current, setCurrent] = useState(null)   // { key, document, lockedNames }
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const open = useCallback(async (key) => {
    // The draft if there is one, else what is published — with the names that
    // are already columns and therefore cannot be renamed.
    const row = await api.loadDraft(key)
    setCurrent({ key, document: row.document, lockedNames: row.lockedNames || [] })
  }, [api])

  useEffect(() => {
    if (!screenKey) return
    open(screenKey).catch((e) => setError(e.message))
  }, [screenKey, open])

  // A NEW FORM IS A NEW ENTITY: createEntity makes both screens (the add/edit
  // form and its list) as drafts. The form half is the one a step shows.
  const create = async (e) => {
    e.preventDefault()
    const label = name.trim()
    if (!label || busy) return
    setBusy(true)
    try {
      const key = keyFromName(label)
      const made = await api.createEntity({ entity: key })
      await open(editScreenOf(made, key + '_edit'))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const publish = useCallback(async (doc, options) => {
    const result = await api.publish(doc, options)
    const row = await api.loadDraft(doc.id)
    setCurrent((c) => (c && c.key === doc.id ? { ...c, lockedNames: row.lockedNames || [] } : c))
    if (onDone) onDone(describeScreen(doc))
    return result
  }, [api, onDone])

  if (error) return <div className="xf-screen-editor-error">{error}</div>

  if (!current) {
    if (screenKey) return <p className="xf-screen-editor-wait">{labels.opening || 'Opening'} {screenKey}…</p>
    return (
      <form className="xf-screen-editor-new" onSubmit={create}>
        <label>
          <span>{labels.nameIt || 'What is this form called?'}</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={labels.placeholder || 'Leave request'} />
        </label>
        <button type="submit" disabled={!name.trim() || busy}>
          {busy ? (labels.making || 'Making it…') : (labels.make || 'Make the form')}
        </button>
      </form>
    )
  }

  return (
    <Builder
      key={current.key}
      {...api.builderProps}
      document={current.document}
      lockedNames={current.lockedNames}
      onPublish={publish}
    />
  )
}

export default ScreenEditorSample
