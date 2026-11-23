// A PHONE APP'S PAGES, ready-made — every one drawn from what the server
// holds, so an app built in Configure UI is on the phone with no screen code:
//
//   <NativeFormRecords factory={factory} form="rental" onOpen={({ id }) => …} />   a form's list (<form>_list)
//   <NativeRecord factory={factory} form="rental" id={id | 'new'} onDone={…} />    one record in its form (<form>_edit)
//   <NativeMenu items={phoneMenu(access)} onOpen={(item) => …} header={…} />        the menu, as tiles
//   <NativeFlows flows={flowsApi} onStart={(flow) => …} />                          the journeys to start
//
// No router: where a tap goes is the app's (onOpen / onDone / onStart). Pull
// down to read a page again; `reloadKey` reads it again too (the app bumps it
// when a page comes back into view, so what was done elsewhere shows here).
import { useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { NativeScreen } from './NativeScreen.jsx'
import { useScreenDocument } from '../useScreenDocument.js'
import { useNativeHost } from './host.jsx'
import { Btn } from './parts.jsx'
import { useNativeTheme } from './theme.js'

function Say({ text, danger }) {
  const t = useNativeTheme()
  return <View style={{ flex: 1, padding: 16, backgroundColor: t.plane }}><Text style={{ color: danger ? t.danger : t.muted }}>{text}</Text></View>
}

/** A form's records — its <form>_list screen: a card per row, + New, and a tap opens one (onOpen({ id })). */
export function NativeFormRecords({ factory, form, screen, onOpen, reloadKey, host, ...rest }) {
  const doc = useScreenDocument(factory.loadScreen, screen || `${form}_list`)
  const fromApp = useNativeHost()
  const [tick, setTick] = useState(0)
  if (doc.error) return <Say text={`Could not load the screen — ${doc.error}`} danger />
  if (!doc.doc) return <Say text="Loading…" />
  return (
    <NativeScreen document={doc.doc} {...factory.screenProps} {...rest} host={host || fromApp}
                  reloadKey={`${reloadKey ?? ''}-${tick}`} onOpenRecord={onOpen} onRefresh={() => setTick((n) => n + 1)} />
  )
}

/**
 * One record in its form — <form>_edit (or `screen`); `id` "new" is a new one.
 * Save or Cancel ends with onDone. A button pressed on it reads it again, so
 * its status and buttons follow (Hand out → Returned).
 */
export function NativeRecord({ factory, form, screen, id, onDone, onOpen, reloadKey, host, ...rest }) {
  const key = screen || `${form}_edit`
  const doc = useScreenDocument(factory.loadScreen, key)
  const fromApp = useNativeHost()
  const isNew = id === 'new' || id === null || id === undefined
  const [record, setRecord] = useState(isNew ? null : undefined)
  const [error, setError] = useState(null)
  const [pressed, setPressed] = useState(0)

  useEffect(() => {
    if (isNew) return undefined
    let live = true
    factory.fetchRecord({ screen: key, id })
      .then((r) => { if (live) { setRecord(r); setError(null) } }, (e) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [factory, key, id, isNew, reloadKey, pressed])

  if (doc.error || error) return <Say text={`Could not open it — ${doc.error || error}`} danger />
  if (!doc.doc || record === undefined) return <Say text="Loading…" />
  return (
    <NativeScreen key={`${key}:${id}`} document={doc.doc} {...factory.screenProps} {...rest} host={host || fromApp}
                  record={record || undefined} reloadKey={`${reloadKey ?? ''}-${pressed}`}
                  onButtonDone={() => setPressed((n) => n + 1)} onOpenRecord={onOpen} onDone={onDone}
                  onRefresh={() => setPressed((n) => n + 1)} />
  )
}

const ICONS = { form: '▤', flows: '⇢', page: '•' }

/** The menu as tiles, two to a row: [{ key, label, kind, icon? }] (phoneMenu), then the app's own footer (Sign out). */
export function NativeMenu({ items, onOpen, header, footer, empty = 'Nothing on the menu for you yet.' }) {
  const t = useNativeTheme()
  return (
    <ScrollView style={{ backgroundColor: t.plane }} contentContainerStyle={{ padding: 16 }}>
      {header || null}
      {!items || !items.length ? <Text style={{ color: t.muted }}>{empty}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {(items || []).map((m) => (
          <Pressable key={m.key} onPress={() => onOpen(m)} accessibilityRole="button" accessibilityLabel={m.label}
                     style={({ pressed }) => ({ width: '47%', flexGrow: 1, padding: 18, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ fontSize: 24, marginBottom: 6, color: t.accent }}>{m.icon || ICONS[m.kind] || '•'}</Text>
            <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700' }}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      {footer || null}
    </ScrollView>
  )
}

/** The published journeys, each with Start (onStart({ key, name })). `flows` is createFlowsApi(…). */
export function NativeFlows({ flows, onStart, reloadKey }) {
  const t = useNativeTheme()
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    flows.listFlows().then((l) => { if (live) { setList((l || []).filter((f) => f.status === 'published')); setError(null) } }, (e) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [flows, reloadKey, tick])
  if (error) return <Say text={`Could not list the journeys — ${error}`} danger />
  if (!list) return <Say text="Loading…" />
  return (
    <ScrollView style={{ backgroundColor: t.plane }} contentContainerStyle={{ padding: 16, gap: 12 }}
                refreshControl={<RefreshControl refreshing={false} onRefresh={() => setTick((n) => n + 1)} />}>
      <Text style={{ color: t.muted, marginBottom: 4 }}>Forms one after another. A journey you leave is kept, and picks up where it stopped.</Text>
      {!list.length ? <Text style={{ color: t.muted }}>No journeys to start yet.</Text> : null}
      {list.map((f) => (
        <View key={f.key} style={{ padding: 16, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700' }}>{f.name}</Text>
            <Text style={{ color: t.muted }}>{typeof f.steps === 'number' ? f.steps : (f.steps || []).length} screens</Text>
          </View>
          <Btn label="Start" variant="primary" onPress={() => onStart(f)} />
        </View>
      ))}
    </ScrollView>
  )
}
