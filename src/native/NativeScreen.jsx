// A SAVED SCREEN, RUNNING ON A PHONE — the same document the web draws, with
// React Native components. The controller is the web's own
// (useFactoryScreen), so a screen's rules, its checks, its lists, buttons,
// comments and details behave exactly as they do in a browser.
//
// A phone has no room for the designed positions: every control comes one
// under another in READING ORDER (top to bottom, left to right across a row) —
// what the web does below 640px. Tabs open any step with a tap; a screen with
// fields ends with Cancel / Save. A list's Edit / New, a task opened from its
// card, a comment turned into a task, open in a full-screen sheet: the same
// component, one level down.
//
// Props are FactoryScreen's (@xeplr/ui-factory's createFactoryApi(...).screenProps,
// record, onOpenRecord, onDone, onButtonDone, reloadKey, params), plus:
//   host  { pickFile, pickDate, scanCode, baseUrl } — what only the app can do (inputs.jsx)
//   header  an element drawn above the screen, inside its scroll (a page title)
//   scroll  false when the app scrolls the screen itself
import { useRef } from 'react'
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useFactoryScreen } from '../useFactoryScreen.js'
import { readingOrder, inputNodes } from '../document.js'
import { CHOICE_TYPES, isTabs } from '../controls.js'
import { NativeInput, Label } from './inputs.jsx'
import NativeList from './NativeList.jsx'
import NativeButtons from './NativeButtons.jsx'
import NativeDetails from './NativeDetails.jsx'
import NativeFeed from './NativeFeed.jsx'
import { Btn, Sheet, GAP } from './parts.jsx'
import { useNativeTheme } from './theme.js'

const STATUS = { saving: 'Saving…', saved: 'Saved', incomplete: 'Fill in the required fields', invalid: 'Fix the fields marked in red' }

/** Ask before dropping unsaved changes — React Native has no window.confirm. */
function askDiscard(ctrl, then) {
  if (!ctrl.dirty) { then(); return }
  Alert.alert('Discard your changes?', 'What you changed here is not saved.', [
    { text: 'Keep editing', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: then }
  ])
}

export function NativeScreen(props) {
  const ctrl = useFactoryScreen(props)
  return <NativeScreenView ctrl={ctrl} props={props} />
}

function NativeScreenView({ ctrl, props }) {
  const t = useNativeTheme()
  const host = props.host || null
  const doc = ctrl.document
  const popupDirty = useRef(false)

  if (ctrl.documentErrors.length) {
    return (
      <View style={{ padding: 16 }} accessibilityRole="alert">
        <Text style={{ color: t.danger, fontWeight: '700', marginBottom: 6 }}>This screen cannot be shown — its definition has problems:</Text>
        {ctrl.documentErrors.map((e, i) => <Text key={i} style={{ color: t.danger }}>{e.path || '(screen)'} {e.message}</Text>)}
      </View>
    )
  }

  const shown = readingOrder(ctrl.visibleNodes && ctrl.visibleNodes.length ? ctrl.visibleNodes : doc.nodes)
  const hasFields = inputNodes(doc).length > 0
  const footer = !ctrl.embedded && (hasFields || ctrl.doneLabel)
  const saving = ctrl.status === 'saving'

  const body = (
    <>
      {props.header || null}
      {shown.map((node) => <Control key={node.id} node={node} ctrl={ctrl} host={host} />)}
      {footer ? (
        <View style={{ marginTop: GAP }}>
          {ctrl.status === 'error' ? <Text style={{ color: t.danger, marginBottom: 8 }} accessibilityRole="alert">Not saved — {ctrl.saveError}</Text>
            : STATUS[ctrl.status] && doc.source ? <Text style={{ color: t.muted, marginBottom: 8 }} accessibilityLiveRegion="polite">{STATUS[ctrl.status]}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            {ctrl.done && !ctrl.doneLabel ? <Btn label="Cancel" disabled={saving} onPress={() => askDiscard(ctrl, () => ctrl.done())} /> : null}
            {ctrl.doneLabel
              ? <Btn label={ctrl.doneLabel} variant="primary" busy={saving} onPress={() => ctrl.flush().then((r) => { if (r && r.ok) ctrl.done(r) })} />
              : <Btn label="Save" variant="primary" busy={saving} onPress={() => ctrl.save().then((r) => { if (r && r.ok && ctrl.done) ctrl.done() })} />}
          </View>
        </View>
      ) : null}
    </>
  )

  const popup = ctrl.popup
  const closePopup = () => {
    if (!popupDirty.current) { ctrl.closeEditor(); return }
    Alert.alert('Discard your changes?', 'What you changed here is not saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { popupDirty.current = false; ctrl.closeEditor() } }
    ])
  }

  return (
    <View style={{ flex: props.scroll === false ? undefined : 1, backgroundColor: t.plane }}>
      {props.scroll === false
        ? <View style={{ padding: 16 }}>{body}</View>
        : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled"
                      refreshControl={props.onRefresh ? <RefreshControl refreshing={Boolean(props.refreshing)} onRefresh={props.onRefresh} /> : undefined}>
            {body}
          </ScrollView>
        )}
      {popup ? (
        <Sheet visible title={popup.document ? [popup.document.name, popup.label].filter(Boolean).join(' · ') : popup.error ? 'Could not open' : 'Loading…'} onClose={closePopup}>
          {popup.error ? <Text style={{ color: t.danger }}>{popup.error}</Text> : null}
          {popup.loading ? <Text style={{ color: t.muted }}>Loading…</Text> : null}
          {popup.document ? (
            <NativeScreen
              key={`${popup.screenId}:${popup.record ? popup.record[ctrl.recordKey] : 'new'}`}
              {...popupProps(props)}
              document={popup.document}
              record={popup.record}
              params={popup.params || undefined}
              onSave={ctrl.popupSave}
              onButtonDone={ctrl.popupPressed}
              onDone={() => { popupDirty.current = false; ctrl.closeEditor() }}
              onDirtyChange={(d) => { popupDirty.current = d }}
              scroll={false}
              host={host}
            />
          ) : null}
        </Sheet>
      ) : null}
    </View>
  )
}

/** What the popup's screen is given: the host's API, never its own record, page or URL. */
function popupProps(props) {
  const keep = ['recordKey', 'fetchOptions', 'fetchRecord', 'fetchRecords', 'onDelete', 'uploadFile', 'fileUrl', 'readFile', 'pressButton', 'uploadButtonFile',
    'buttonOptions', 'fetchRows', 'suggest', 'fetchRowDetails', 'fetchFeed', 'fetchDetails', 'screens', 'loadScreen', 'controls', 'hooks']
  return Object.fromEntries(keep.filter((k) => props[k] !== undefined).map((k) => [k, props[k]]))
}

/** One control of the screen, as a phone draws it. */
function Control({ node, ctrl, host }) {
  const t = useNativeTheme()
  switch (node.type) {
    case 'label':
      return <Label node={node} />
    case 'list':
      return <NativeList node={node} list={ctrl.listFor(node)} query={ctrl.listQuery} host={host}
                         onOpen={(rec, where) => ctrl.openEditor(node, rec, where)}
                         onNew={() => ctrl.openEditor(node, null)} />
    case 'buttons':
      return <NativeButtons node={node} panel={ctrl.buttonsFor ? ctrl.buttonsFor(node) : null} host={host} />
    case 'details':
      return <NativeDetails node={node} details={ctrl.detailsFor ? ctrl.detailsFor(node) : null} host={host} />
    case 'feed':
      return <NativeFeed node={node} feed={ctrl.feedFor ? { ...ctrl.feedFor(node), readFile: ctrl.readFile } : null} host={host} />
    case 'stepper':
      return <Steps node={node} ctrl={ctrl} />
    case 'subform':
    case 'table':
      return <Text style={{ color: t.muted, marginBottom: GAP }}>{(node.props && (node.props.title || node.props.label)) || 'This part'} is not on the phone yet — open it on a computer.</Text>
    default:
      return (
        <NativeInput
          node={node}
          value={node.props && node.props.name ? ctrl.values[node.props.name] : undefined}
          error={node.props && node.props.name ? ctrl.errors[node.props.name] : undefined}
          options={CHOICE_TYPES.includes(node.type) ? ctrl.optionsFor(node) : undefined}
          upload={node.type === 'file' ? (file) => ctrl.upload(file, node) : undefined}
          readFile={node.type === 'file' ? ctrl.readFile : undefined}
          suggest={node.type === 'autocomplete' && ctrl.suggestFor ? ctrl.suggestFor(node) : undefined}
          onPick={node.type === 'autocomplete' && ctrl.pickSuggestion ? (s) => ctrl.pickSuggestion(node, s) : undefined}
          onChange={(raw) => ctrl.setValue(node, raw)}
          onBlur={() => ctrl.touch(node)}
          host={host}
        />
      )
  }
}

/**
 * A stepper: tabs (any one, with a tap) or steps (Back / Next, a step's
 * required fields filled first). Where it is is the controller's.
 */
function Steps({ node, ctrl }) {
  const t = useNativeTheme()
  const steps = (node.props && node.props.steps) || []
  const at = ctrl.steps.active(node.id)
  if (isTabs(node)) {
    return (
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.border, marginBottom: GAP }} accessibilityRole="tablist">
        {steps.map((s, i) => (
          <Btn key={s.key || i} label={s.label} variant="plain" small onPress={() => ctrl.steps.go(node.id, i, 'jump')}
               disabled={ctrl.steps.isDisabled(node.id, i)}
               style={{ borderRadius: 0, borderBottomWidth: 2, borderBottomColor: i === at ? t.accent : 'transparent', marginBottom: -1 }} />
        ))}
      </View>
    )
  }
  const unfinished = ctrl.steps.fieldsOn(node.id, at).filter((n) => ctrl.allErrors[n.props.name])
  const back = ctrl.steps.nextOpen(node.id, 'back')
  const forward = ctrl.steps.nextOpen(node.id, 'next')
  return (
    <View style={{ marginBottom: GAP }}>
      <Text style={{ color: t.muted, marginBottom: 6 }}>Step {at + 1} of {steps.length}{steps[at] && steps[at].label ? ` — ${steps[at].label}` : ''}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {back !== null && back !== undefined ? <Btn label="Back" small onPress={() => ctrl.steps.go(node.id, back, 'back')} /> : null}
        {forward !== null && forward !== undefined ? <Btn label="Next" small variant="primary" onPress={() => {
          if (unfinished.length) { unfinished.forEach((n) => ctrl.touch(n)); return }
          ctrl.steps.go(node.id, forward, 'next')
        }} /> : null}
      </View>
    </View>
  )
}
