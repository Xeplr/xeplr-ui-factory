// A JOURNEY, WALKED ON A PHONE — the native FlowRunner. The run (useFlowRun,
// the web's own) says which screen comes next; the screen (useFactoryScreen,
// the web's own) is drawn by NativeScreenView, its Save renamed Next. Next
// saves the record into its own table, hands the run what was filled in, and
// the run answers with the next screen — or that the journey is done.
//
//   <NativeFlowRunner {...flows.runnerProps} {...factory.screenProps} flowKey="new_rental"
//                     runId={run} host={host} onStep={(s) => remember(s.runId)}
//                     renderDone={() => <Btn label="Start another" … />} />
//
// No router and no URL: where a run is kept (to pick it up again) is the app's
// (onStep hands it the run id).
import { useRef } from 'react'
import { Text, View } from 'react-native'
import { useFlowRun } from '../useFlowRun.js'
import { useFactoryScreen } from '../useFactoryScreen.js'
import { NativeScreenView } from './NativeScreen.jsx'
import { useNativeTheme } from './theme.js'

// A screen the runner holds before the run has said what to show — valid, so
// the controller has something to hold.
const EMPTY = { version: 1, id: 'flow_waiting', name: '', width: 800, nodes: [] }

export function NativeFlowRunner(props) {
  const t = useNativeTheme()
  const run = useFlowRun(props)
  const screen = useFactoryScreen({
    ...props,
    document: run.document || EMPTY,
    record: run.values || undefined,
    // What the flow called this screen with, and what the screens before it saved.
    params: run.given || undefined,
    previous: run.previous || undefined
  })
  // The row the screen saved, for the run — kept in a ref, read when Next is pressed.
  const record = useRef(null)
  record.current = screen.recordId

  const say = (text, color) => <View style={{ flex: 1, padding: 16, backgroundColor: t.plane }}><Text style={{ color: color || t.muted, fontSize: 16 }}>{text}</Text></View>

  if (run.loading) return say('Opening…')
  if (run.error) return say('This journey cannot go on: ' + run.error, t.danger)
  if (run.status === 'done') {
    return props.renderDone ? props.renderDone(run) : (
      <View style={{ flex: 1, padding: 16, backgroundColor: t.plane }} accessibilityLiveRegion="polite">
        <Text style={{ color: t.ink, fontSize: 20, fontWeight: '800', marginBottom: 6 }}>All done</Text>
        <Text style={{ color: t.muted }}>Everything in this journey is filled in.</Text>
      </View>
    )
  }
  if (!run.document) return null

  const ctrl = {
    ...screen,
    // The journey's way on IS the screen's own button, renamed — one button, not two.
    // A new record's id comes from the save Next just made (not yet in the ref).
    done: (r, action) => run.submit(screen.values, r && r.record && r.record[screen.recordKey] != null ? r.record[screen.recordKey] : record.current, action),
    doneLabel: run.sending ? 'Saving…' : 'Next',
    doneButtons: run.buttons && run.buttons.length ? run.buttons : null,
    sending: run.sending
  }
  // A new step is a new form: the key stops the view keeping the last one's state.
  return <NativeScreenView key={run.stepKey} ctrl={ctrl} props={props} />
}
