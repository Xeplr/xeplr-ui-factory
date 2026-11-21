// A PANEL OF BUTTONS ON A PHONE. Each runs a function of the app on the
// server with the screen's parameters; which show and which are greyed out
// the controller works out from the record (useFactoryScreen.buttonsFor).
//
// A button that asks first opens a sheet: its message, its fields (number,
// text, date, a choice, a tick, a checklist, rows — one per packet), a note,
// and files (camera or gallery). A checklist with `scan` ticks by code: Scan
// opens the app's camera (host.scanCode), again after each one found. The same checks as the web's dialog run
// before anything is sent (askFieldValues), and again on the server.
// Presentation only — the press and the upload are the controller's.
import { useEffect, useRef, useState } from 'react'
import { Image, Pressable, Text, TextInput, View } from 'react-native'
import { Btn, Field, PickList, Sheet, styles, GAP, RADIUS } from './parts.jsx'
import { NativeInput } from './inputs.jsx'
import { toneOf, useNativeTheme } from './theme.js'
import { askFields, askFieldStart, askFieldValues, checklistOptionsOf, askChoiceOptions, isFedChoice, emptyRow, startRowsOf, MAX_ASK_ROWS, tickByCode } from '../buttons.js'

export default function NativeButtons({ node, panel, host }) {
  const t = useNativeTheme()
  const p = node.props || {}
  const [asking, setAsking] = useState(null)
  if (!panel) return null
  const note = panel.note
  const run = (b) => (b.ask ? setAsking(b) : panel.press(b))
  return (
    <View style={{ marginBottom: GAP }}>
      {p.title ? <Text style={{ color: t.muted, fontWeight: '600', marginBottom: 6 }}>{p.title}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {panel.buttons.map((b) => (
          <Btn key={b.id} label={b.label} small variant={b.variant === 'primary' ? 'primary' : b.variant === 'danger' ? 'danger' : 'secondary'}
               pressed={b.pressed} disabled={b.disabled || Boolean(panel.pressing)} busy={panel.pressing === b.id} onPress={() => run(b)} />
        ))}
      </View>
      {note && !asking ? (
        <Pressable onPress={panel.clearNote} accessibilityRole={note.kind === 'error' ? 'alert' : 'text'} accessibilityHint="Tap to dismiss"
                   style={{ marginTop: 8, padding: 10, borderRadius: RADIUS, backgroundColor: toneOf(t, note.kind === 'error' ? 'danger' : 'success').bg }}>
          <Text style={{ color: toneOf(t, note.kind === 'error' ? 'danger' : 'success').fg }}>{note.text}  ×</Text>
        </Pressable>
      ) : null}
      {asking ? (
        <AskSheet
          button={asking}
          busy={panel.pressing === asking.id}
          error={note && note.kind === 'error' && note.button === asking.id ? note.text : null}
          onCancel={() => { setAsking(null); panel.clearNote() }}
          upload={(file) => panel.upload(file, asking)}
          options={panel.options ? (field) => panel.options(asking, field) : null}
          readFile={panel.readFile}
          record={panel.record}
          host={host}
          onConfirm={async (typed, files, values) => { if (await panel.press(asking, typed, files, values)) setAsking(null) }}
        />
      ) : null}
    </View>
  )
}

function AskSheet({ button, busy, error, onCancel, onConfirm, upload, readFile, record, options, host }) {
  const t = useNativeTheme()
  const ask = button.ask || {}
  const file = ask.file && typeof ask.file === 'object' ? ask.file : null
  const fields = askFields(button)
  const [typed, setTyped] = useState('')
  const [files, setFiles] = useState(file && file.multiple ? [] : '')
  const [given, setGiven] = useState(() => Object.fromEntries(fields.map((f) => [f.name, askFieldStart(f, record)])))
  const [shown, setShown] = useState({})
  const [offered, setOffered] = useState({})
  const [choosing, setChoosing] = useState(null)

  // What a checklist or a fed choice offers, and rows given last time — asked as the sheet opens.
  useEffect(() => {
    let live = true
    fields.filter((f) => f.type === 'checklist' || isFedChoice(f) || (f.type === 'rows' && f.startFrom)).forEach((f) => {
      if (!options) { setOffered((o) => ({ ...o, [f.name]: { list: [], error: 'This list cannot be loaded here' } })); return }
      setOffered((o) => ({ ...o, [f.name]: { loading: true, list: [] } }))
      Promise.resolve(options(f.name)).then((list) => {
        if (!live) return
        if (f.type === 'rows') { setGiven((g) => ({ ...g, [f.name]: startRowsOf(f, list) })); setOffered((o) => ({ ...o, [f.name]: { list: [] } })) }
        else setOffered((o) => ({ ...o, [f.name]: { list: checklistOptionsOf(list) } }))
      }, (err) => { if (live) setOffered((o) => ({ ...o, [f.name]: { list: [], error: err.message || 'Could not load the list' } })) })
    })
    return () => { live = false }
  }, [button.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (name, v) => { givenRef.current = { ...givenRef.current, [name]: v }; setGiven((g) => ({ ...g, [name]: v })); setShown((m) => ({ ...m, [name]: undefined })) }
  const givenRef = useRef(given); givenRef.current = given
  const [scanned, setScanned] = useState({})   // { [field]: { text, bad } } — what the last scan did

  // A checklist's Scan: tick the entry with that code, then the camera again —
  // until the person is done, or a code nothing here has (said, and stopped).
  const scanInto = async (f) => {
    const list = (offered[f.name] || {}).list || []
    let note = null
    for (;;) {
      let code
      try { code = await host.scanCode({ title: f.label, note, many: true }) } catch (err) { setScanned((m) => ({ ...m, [f.name]: { text: err.message || 'Could not open the camera', bad: true } })); return }
      if (!code || !String(code).trim()) return
      const out = tickByCode(list, givenRef.current[f.name], code)
      if (!out.option) { setScanned((m) => ({ ...m, [f.name]: { text: out.message, bad: true } })); return }
      set(f.name, out.ticked)
      note = out.message
      setScanned((m) => ({ ...m, [f.name]: { text: out.message, bad: false } }))
    }
  }
  const fileList = Array.isArray(files) ? files : files ? [files] : []
  const missing = Boolean(file && file.required && !fileList.length)
  const confirm = () => {
    const offeredIds = Object.fromEntries(fields.filter((f) => f.type === 'checklist' || isFedChoice(f)).map((f) => [f.name, ((offered[f.name] || {}).list || []).map((o) => o.id)]))
    const out = askFieldValues(button, given, undefined, offeredIds)
    if (out.errors.length) { setShown(Object.fromEntries(out.errors.map((e) => [e.field, e.message]))); return }
    setShown({})
    onConfirm(typed, fileList, out.values)
  }

  return (
    <Sheet visible title={ask.title || `${button.label}?`} onClose={onCancel} busy={busy}
           footer={<>
             <Btn label="Cancel" onPress={onCancel} disabled={busy} />
             <Btn label={busy ? 'Working' : button.label} busy={busy} variant={button.variant === 'danger' ? 'danger' : 'primary'} onPress={confirm} disabled={missing} />
           </>}>
      {ask.message ? <Text style={{ color: t.ink, fontSize: 16, marginBottom: GAP }}>{ask.message}</Text> : null}
      {fields.map((f) => {
        const err = shown[f.name]
        if (f.type === 'checklist') {
          const o = offered[f.name] || { loading: true, list: [] }
          const ticked = Array.isArray(given[f.name]) ? given[f.name] : []
          return (
            <Field key={f.name} label={f.label} required={f.required} error={err || o.error}>
              {f.scan && host && host.scanCode && o.list.length ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Btn label="Scan" small onPress={() => scanInto(f)} disabled={busy} accessibilityLabel={`Scan into ${f.label}`} />
                  {scanned[f.name] ? <Text style={[styles.small, { flex: 1, color: scanned[f.name].bad ? t.danger : t.muted }]} accessibilityRole={scanned[f.name].bad ? 'alert' : 'text'}>{scanned[f.name].text}</Text> : null}
                </View>
              ) : null}
              {o.loading ? <Text style={{ color: t.muted }}>Loading…</Text> : null}
              {!o.loading && !o.error && !o.list.length ? <Text style={{ color: t.muted }}>Nothing to choose</Text> : null}
              {o.list.map((opt) => {
                const on = ticked.includes(opt.id)
                return (
                  <Pressable key={opt.id} onPress={() => set(f.name, on ? ticked.filter((x) => x !== opt.id) : [...ticked, opt.id])} disabled={busy}
                             accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                             style={[styles.option, { borderBottomColor: t.border }]}>
                    <Text style={[styles.optionMark, { color: on ? t.accent : t.border }]}>{on ? '☑' : '☐'}</Text>
                    {opt.image ? <Image source={{ uri: opt.image }} style={{ width: 44, height: 44, borderRadius: 6 }} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.ink }}>{opt.label}</Text>
                      {opt.sub ? <Text style={[styles.small, { color: t.muted }]}>{opt.sub}</Text> : null}
                    </View>
                  </Pressable>
                )
              })}
            </Field>
          )
        }
        if (f.type === 'rows') {
          const rows = Array.isArray(given[f.name]) ? given[f.name] : []
          const cols = (f.fields || []).filter((c) => c && c.name)
          const o = offered[f.name] || {}
          const max = Math.min(Number.isInteger(f.max) ? f.max : MAX_ASK_ROWS, MAX_ASK_ROWS)
          const keep = Math.max(1, Number.isInteger(f.min) ? f.min : 1)
          const what = f.rowLabel || 'Row'
          return (
            <Field key={f.name} label={f.label} required={f.required} error={err || o.error}>
              {o.loading ? <Text style={{ color: t.muted }}>Loading what was given before…</Text> : null}
              {rows.map((r, i) => (
                <View key={i} style={{ borderWidth: 1, borderColor: t.border, borderRadius: RADIUS, padding: 10, marginBottom: 8, backgroundColor: t.surface }} accessibilityLabel={`${what} ${i + 1}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ color: t.ink, fontWeight: '700', flex: 1 }}>{what} {i + 1}</Text>
                    {rows.length > keep ? <Btn label="×" small variant="plain" accessibilityLabel={`Remove ${what.toLowerCase()} ${i + 1}`} disabled={busy}
                                               onPress={() => set(f.name, rows.filter((_, j) => j !== i))} /> : null}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {cols.map((c) => (
                      <View key={c.name} style={{ minWidth: '45%', flexGrow: 1 }}>
                        <Text style={{ color: t.muted, fontSize: 12, marginBottom: 4 }}>{c.label}{c.required ? ' *' : ''}{c.unit ? ` (${c.unit})` : ''}</Text>
                        <TextInput value={r[c.name] === undefined || r[c.name] === null ? '' : String(r[c.name])} editable={!busy}
                                   keyboardType={c.type === 'number' ? 'decimal-pad' : 'default'} accessibilityLabel={`${what} ${i + 1}: ${c.label}`}
                                   onChangeText={(s) => set(f.name, rows.map((x, j) => (j === i ? { ...x, [c.name]: s } : x)))}
                                   style={[styles.input, { color: t.ink, borderColor: t.border, backgroundColor: t.field }]} />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              {rows.length < max ? <Btn label={`+ ${f.addLabel || `Add ${what.toLowerCase()}`}`} small onPress={() => set(f.name, [...rows, emptyRow(f)])} disabled={busy} /> : null}
            </Field>
          )
        }
        if (f.type === 'choice') {
          const fed = isFedChoice(f) ? (offered[f.name] || { loading: true, list: [] }) : null
          const items = fed ? fed.list.map((o) => ({ id: o.id, name: o.label, sub: o.sub })) : askChoiceOptions(f).map((o) => ({ id: o.value, name: o.label }))
          const pick = items.find((x) => String(x.id) === String(given[f.name]))
          return (
            <Field key={f.name} label={f.label} required={f.required} error={err || (fed && fed.error)}>
              <Pressable onPress={() => setChoosing(f.name)} disabled={busy} accessibilityRole="button"
                         style={[styles.input, { borderColor: err ? t.danger : t.border, backgroundColor: t.field, justifyContent: 'center' }]}>
                <Text style={{ color: pick ? t.ink : t.muted, fontSize: 16 }}>{pick ? pick.name : fed && fed.loading ? 'Loading…' : 'Choose…'}</Text>
              </Pressable>
              <PickList visible={choosing === f.name} title={f.label} items={items} value={given[f.name]} loading={fed && fed.loading}
                        onClose={() => setChoosing(null)} onPick={(o) => { set(f.name, String(o.id)); setChoosing(null) }} />
            </Field>
          )
        }
        // number, text, date, a tick: the screen's own field, under the ask field's name.
        const asField = { id: `ask-${f.name}`, type: f.type === 'checkbox' ? 'checkbox' : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text', props: { name: f.name, label: `${f.label}${f.unit ? ` (${f.unit})` : ''}`, required: f.required } }
        return <NativeInput key={f.name} node={asField} value={given[f.name]} error={err} onChange={(v) => set(f.name, v)} host={host} />
      })}
      {ask.note ? (
        <Field label={ask.note}>
          <TextInput value={typed} onChangeText={setTyped} multiline maxLength={1000} editable={!busy} accessibilityLabel={ask.note}
                     style={[styles.input, { color: t.ink, borderColor: t.border, backgroundColor: t.field, minHeight: 80, textAlignVertical: 'top' }]} />
        </Field>
      ) : null}
      {file ? (
        <NativeInput node={{ id: 'ask-file', type: 'file', props: { name: 'files', label: file.label || (file.multiple ? 'Files' : 'File'), required: file.required, accept: file.accept, multiple: file.multiple, maxFiles: file.maxFiles, source: file.source } }}
                     value={files} onChange={setFiles} upload={upload} readFile={readFile} host={host} />
      ) : null}
      {error ? <Text style={{ color: t.danger, marginTop: 8 }} accessibilityRole="alert">{error}</Text> : null}
    </Sheet>
  )
}
