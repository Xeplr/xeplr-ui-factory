// THIS APP'S SCREENS, AS ANOTHER PACKAGE'S DESIGNER WANTS THEM.
//
// One hook, so that using @xeplr/factory's forms inside @xeplr/ui-workflow's
// flow designer is two props rather than a page of glue in every application:
//
//   const { screens, screenEditor } = useScreenSource(factory, { Builder: FactoryBuilder })
//   <WorkflowDesigner screens={screens} screenEditor={screenEditor} … />
//
// It answers both questions that designer asks its host — which screens exist
// and what each one holds, and how to design one without leaving the flow —
// and it reloads itself when a form is published from in there, so a form
// made inside a flow is immediately choosable in it.
//
// WHY HERE. The alternative was the same twenty lines copied into every app
// the CLI scaffolds: list the screens, read each document, filter the nodes
// that hold a value, wire a builder to publish. Copied code cannot be fixed
// once — an app generated last month keeps that copy forever, and a control
// type added to this package never reaches any of them.
//
// No JSX, like every other hook here: the element is built with
// createElement so the file stays .js.

import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import { loadScreens } from './screenSource.js'
import { ScreenEditorSample } from './designs/ScreenEditorSample.jsx'

/**
 * @param api  a createFactoryApi() instance
 * @param opts { Builder, labels } — the builder component to draw, normally
 *             FactoryBuilder. Passed in rather than imported so this hook does
 *             not pull the whole builder into a bundle that never opens it.
 * @returns { screens, screenEditor, reload, loading, error }
 */
export function useScreenSource(api, opts) {
  opts = opts || {}
  var Builder = opts.Builder
  var labels = opts.labels

  const [screens, setScreens] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [round, setRound] = useState(0)

  const reload = useCallback(() => setRound((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // The names arrive first so the menu works while the documents are still
    // being read — see loadScreens.
    loadScreens(api, (stubs) => { if (!cancelled) setScreens(stubs) })
      .then((full) => { if (!cancelled) { setScreens(full); setError(null) } })
      // A designer that still works, minus the menu: a key can be typed.
      .catch((e) => { if (!cancelled) { setScreens([]); setError(e.message) } })
      .then(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [api, round])

  // The render prop @xeplr/ui-workflow calls inside its modal. Stable, so
  // typing in the flow does not remount the builder.
  const screenEditor = useCallback((props) => {
    if (!Builder) return null
    return createElement(ScreenEditorSample, {
      api: api,
      Builder: Builder,
      screenKey: props.screenKey,
      labels: labels,
      onDone: function (screen) {
        // Reload, so a form made in there joins the menu. The designer is
        // also told directly, so the step is right before this lands.
        reload()
        if (props.onDone) props.onDone(screen)
      }
    })
  }, [api, Builder, labels, reload])

  return useMemo(
    () => ({ screens, screenEditor, reload, loading, error }),
    [screens, screenEditor, reload, loading, error]
  )
}
