// A SCREEN'S FIELDS ON A PHONE — text, numbers, a choice from a list, a tick,
// a date, files, and the screen's own labels. Presentation only: the value,
// its error and what a change does arrive as props (useFactoryScreen).
//
// What only the app can do — open the camera or the gallery, show the
// phone's own date picker — is handed in as `host`:
//   host.pickFile({ camera, multiple, accept }) → [{ uri, name, type, size }]
//   host.pickDate({ mode: 'date' | 'datetime', value }) → 'YYYY-MM-DD' | 'YYYY-MM-DDTHH:mm' | null
//   host.scanCode({ title }) → the code read by the camera (a barcode, a QR code), or null
// Without pickDate, a date is typed; without pickFile, files are shown only;
// without scanCode, a field with `scan` has no Scan button (the code is typed).
import { useEffect, useRef, useState } from 'react'
import { Image, Pressable, Switch, Text, TextInput, View } from 'react-native'
import { Btn, Field, PickList, styles, GAP } from './parts.jsx'
import { useNativeTheme } from './theme.js'
import { fileLabel, isMultiFile } from '../values.js'
import { isImageFile } from '../controls.js'
import { addTag, removeTag, setTagQty, tagLimit, suggestionForCode } from '../suggest.js'

const KEYBOARD = { email: 'email-address', tel: 'phone-pad', url: 'url' }

export function NativeInput({ node, value, error, onChange, onBlur, options, upload, readFile, host, suggest, onPick }) {
  const t = useNativeTheme()
  const p = node.props || {}
  const field = (child, hint) => <Field label={p.label} required={p.required} error={error} hint={hint}>{child}</Field>
  const box = [styles.input, { color: t.ink, borderColor: error ? t.danger : t.border, backgroundColor: t.field }]

  switch (node.type) {
    case 'autocomplete':
      return field(<Autocomplete node={node} value={value} onChange={onChange} onBlur={onBlur} invalid={Boolean(error)} suggest={suggest} onPick={onPick} host={host} />)
    case 'text':
    case 'id':
      return field(
        <TextInput style={box} value={value === undefined || value === null ? '' : String(value)}
                   onChangeText={onChange} onBlur={onBlur} placeholder={p.placeholder || ''} placeholderTextColor={t.muted}
                   editable={node.type !== 'id'} keyboardType={KEYBOARD[p.inputType] || 'default'}
                   autoCapitalize={p.inputType === 'email' || p.inputType === 'url' ? 'none' : 'sentences'}
                   maxLength={p.validation && p.validation.maxLength} accessibilityLabel={p.label} />
      )
    case 'textarea':
      return field(
        <TextInput style={[box, { minHeight: 96, textAlignVertical: 'top' }]} multiline value={value === undefined || value === null ? '' : String(value)}
                   onChangeText={onChange} onBlur={onBlur} placeholder={p.placeholder || ''} placeholderTextColor={t.muted}
                   maxLength={p.validation && p.validation.maxLength} accessibilityLabel={p.label} />
      )
    case 'number':
      return field(
        <TextInput style={box} value={value === undefined || value === null ? '' : String(value)} keyboardType="decimal-pad"
                   onChangeText={onChange} onBlur={onBlur} placeholder={p.placeholder || ''} placeholderTextColor={t.muted} accessibilityLabel={p.label} />
      )
    case 'checkbox':
      return (
        <View style={[styles.field, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={{ color: t.ink, fontSize: 16, flex: 1 }}>{p.label}{p.required ? ' *' : ''}</Text>
          <Switch value={Boolean(value)} onValueChange={(v) => { onChange(v); if (onBlur) onBlur() }} accessibilityLabel={p.label} />
          {error ? <Text style={[styles.small, { color: t.danger }]}>{error}</Text> : null}
        </View>
      )
    case 'dropdown':
    case 'radio':
    case 'multiselect':
      return field(<Choice node={node} value={value} onChange={onChange} onBlur={onBlur} options={options} invalid={Boolean(error)} />)
    case 'date':
    case 'datetime':
      return field(<When node={node} value={value} onChange={onChange} onBlur={onBlur} host={host} invalid={Boolean(error)} />,
        host && host.pickDate ? null : node.type === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm')
    case 'file':
      return field(<Files node={node} value={value} onChange={onChange} onBlur={onBlur} upload={upload} readFile={readFile} host={host} />)
    case 'label':
      return <Label node={node} />
    default:
      return field(<Text style={{ color: t.muted }}>This field is not on the phone yet — open it on a computer.</Text>)
  }
}

/** The screen's own words: a heading, a line, or a note. */
export function Label({ node }) {
  const t = useNativeTheme()
  const p = node.props || {}
  const heading = p.variant === 'heading' || p.variant === 'title'
  return <Text style={{ color: heading ? t.ink : t.muted, fontSize: heading ? 22 : 15, fontWeight: heading ? '700' : '400', marginBottom: GAP }} accessibilityRole={heading ? 'header' : 'text'}>{p.text}</Text>
}

/** One (or several) of a list — the dropdown's rows, or its fixed options. */
function Choice({ node, value, onChange, onBlur, options, invalid }) {
  const t = useNativeTheme()
  const [open, setOpen] = useState(false)
  const multiple = node.type === 'multiselect'
  const o = options || { items: [], loading: false, error: null }
  const items = (o.items || []).map((x) => ({ id: x.id, name: x.name === undefined || x.name === null ? String(x.id) : String(x.name) }))
  const picked = multiple ? (Array.isArray(value) ? value : []) : value
  const names = (multiple ? picked : [picked]).map((v) => {
    const hit = items.find((x) => String(x.id) === String(v))
    return hit ? hit.name : v === undefined || v === null || v === '' ? null : String(v)
  }).filter(Boolean)
  const close = () => { setOpen(false); if (onBlur) onBlur() }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${node.props.label || 'Choose'}: ${names.join(', ') || 'none'}`}
                 style={[styles.input, { borderColor: invalid ? t.danger : t.border, backgroundColor: t.field, flexDirection: 'row', alignItems: 'center' }]}>
        <Text style={{ flex: 1, color: names.length ? t.ink : t.muted, fontSize: 16 }} numberOfLines={2}>{names.length ? names.join(', ') : node.props.placeholder || 'Select…'}</Text>
        <Text style={{ color: t.muted }}>▾</Text>
      </Pressable>
      <PickList visible={open} title={node.props.label || 'Choose'} items={items} value={picked} multiple={multiple} loading={o.loading} error={o.error}
                onClose={close}
                onPick={(item) => {
                  if (!multiple) { onChange(String(picked) === String(item.id) && !node.props.required ? '' : item.id); close(); return }
                  const has = picked.some((v) => String(v) === String(item.id))
                  onChange(has ? picked.filter((v) => String(v) !== String(item.id)) : [...picked, item.id])
                }} />
    </>
  )
}

/** "19 Nov 2026, 4:30 pm" from "2026-11-19T16:30" — how a picked moment reads. */
export function readableWhen(v, withTime) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(v || ''))
  if (!m) return ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`
  if (!withTime || m[4] === undefined) return day
  const h = Number(m[4])
  return `${day}, ${h % 12 || 12}:${m[5]} ${h < 12 ? 'am' : 'pm'}`
}

/** A date, or a date and time: the phone's own picker when the app gives one, else typed. */
function When({ node, value, onChange, onBlur, host, invalid }) {
  const t = useNativeTheme()
  const withTime = node.type === 'datetime'
  const v = value === undefined || value === null ? '' : String(value)
  if (!host || !host.pickDate) {
    return (
      <TextInput style={[styles.input, { color: t.ink, borderColor: invalid ? t.danger : t.border, backgroundColor: t.field }]}
                 value={v.replace('T', ' ')} placeholder={withTime ? '2026-11-19 16:30' : '2026-11-19'} placeholderTextColor={t.muted}
                 onChangeText={(s) => onChange(withTime ? s.replace(' ', 'T') : s)} onBlur={onBlur} autoCapitalize="none" accessibilityLabel={node.props.label} />
    )
  }
  const pick = async () => {
    const got = await host.pickDate({ mode: withTime ? 'datetime' : 'date', value: v })
    if (got) onChange(got)
    if (onBlur) onBlur()
  }
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel={`${node.props.label || 'Date'}: ${readableWhen(v, withTime) || 'not set'}`}
                 style={[styles.input, { flex: 1, borderColor: invalid ? t.danger : t.border, backgroundColor: t.field, justifyContent: 'center' }]}>
        <Text style={{ color: v ? t.ink : t.muted, fontSize: 16 }}>{readableWhen(v, withTime) || (withTime ? 'Pick a date and time' : 'Pick a date')}</Text>
      </Pressable>
      {v && !node.props.required ? <Btn label="Clear" small onPress={() => { onChange(''); if (onBlur) onBlur() }} /> : null}
    </View>
  )
}

/** A stored picture, read through the app (it carries the sign-in), as an <Image>. */
export function useStoredPicture(path, readFile) {
  const [uri, setUri] = useState(null)
  useEffect(() => {
    if (!path || !readFile || !isImageFile(path)) { setUri(null); return undefined }
    let gone = false
    Promise.resolve().then(() => readFile(path)).then((blob) => new Promise((resolve, reject) => {
      // A Blob → a data: URI, the one form every React Native <Image> takes.
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })).then((u) => { if (!gone) setUri(u) }, () => { if (!gone) setUri(null) })
    return () => { gone = true }
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps
  return uri
}

function StoredFile({ path, readFile, onRemove }) {
  const t = useNativeTheme()
  const uri = useStoredPicture(path, readFile)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      {uri ? <Image source={{ uri }} style={{ width: 56, height: 56, borderRadius: 8 }} /> : null}
      <Text style={{ flex: 1, color: t.ink }} numberOfLines={2}>{fileLabel(path)}</Text>
      {onRemove ? <Btn label="Remove" small onPress={onRemove} /> : null}
    </View>
  )
}

/** A file field: what it holds, and Camera / Choose to add (uploaded as soon as picked). */
function Files({ node, value, onChange, onBlur, upload, readFile, host }) {
  const t = useNativeTheme()
  const p = node.props || {}
  const several = isMultiFile(node)
  const list = several ? (Array.isArray(value) ? value : []) : (value ? [value] : [])
  const full = several ? Boolean(p.maxFiles) && list.length >= p.maxFiles : list.length >= 1
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)
  const add = async (camera) => {
    if (!host || !host.pickFile || !upload) return
    setFailed(null)
    let picked
    try { picked = await host.pickFile({ camera, multiple: several, accept: p.accept }) } catch (err) { setFailed(err.message || 'Could not open the picker'); return }
    if (!picked || !picked.length) return
    setBusy(true)
    let next = list
    try {
      for (const file of picked.slice(0, several ? (p.maxFiles ? Math.max(p.maxFiles - list.length, 0) : picked.length) : 1)) {
        const out = await upload(file)
        next = several ? [...next, out.path] : [out.path]
        onChange(several ? next : next[0])
      }
    } catch (err) {
      setFailed(err.message || 'Could not attach')
    } finally {
      setBusy(false)
      if (onBlur) onBlur()
    }
  }
  const remove = (path) => { const rest = list.filter((x) => x !== path); onChange(several ? rest : ''); if (onBlur) onBlur() }
  return (
    <View>
      {list.map((path) => <StoredFile key={path} path={path} readFile={readFile} onRemove={() => remove(path)} />)}
      {!full && host && host.pickFile && upload ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {p.source !== 'files' ? <Btn label="Camera" small busy={busy} onPress={() => add(true)} /> : null}
          {p.source !== 'camera' ? <Btn label={busy ? 'Attaching' : 'Choose'} small busy={busy} onPress={() => add(false)} /> : null}
        </View>
      ) : null}
      {!host || !host.pickFile ? <Text style={[styles.small, { color: t.muted }]}>Files can be added from a computer.</Text> : null}
      {failed ? <Text style={[styles.small, { color: t.danger }]}>{failed}</Text> : null}
    </View>
  )
}

/** How long typing pauses before an autocomplete asks. */
const SUGGEST_PAUSE_MS = 300

/**
 * TEXT WITH SUGGESTIONS (suggest.js), on a phone. Typing asks after a pause;
 * the suggestions come under the box — a tap picks one. With `multiple`, each
 * pick is a chip (with how many, with `quantity`); "Add as typed" keeps what
 * was typed. With `scan` and the app's camera (host.scanCode), Scan reads a
 * code and picks the suggestion that has it.
 */
function Autocomplete({ node, value, onChange, onBlur, invalid, suggest, onPick, host }) {
  const t = useNativeTheme()
  const p = node.props || {}
  const multiple = Boolean(p.multiple)
  const tags = multiple && Array.isArray(value) ? value : []
  const [typed, setTyped] = useState(multiple ? '' : null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [said, setSaid] = useState(null)       // { text, bad } — what a scan did
  const [scanning, setScanning] = useState(false)
  const asking = useRef(0)
  const suggestRef = useRef(suggest); suggestRef.current = suggest
  const text = multiple ? typed : (value === undefined || value === null ? '' : String(value))
  const full = multiple && tags.length >= tagLimit(p)
  const canScan = Boolean(p.scan && host && host.scanCode && suggest)

  // Asked after a pause, only for what was typed (never for a value loaded with the record).
  const [asked, setAsked] = useState(null)
  useEffect(() => {
    if (asked === null || !suggestRef.current) return undefined
    const timer = setTimeout(() => {
      const mine = ++asking.current
      setLoading(true)
      Promise.resolve(suggestRef.current(asked))
        .then((list) => { if (mine === asking.current) setItems(list || []) })
        .catch(() => { if (mine === asking.current) setItems([]) })
        .finally(() => { if (mine === asking.current) setLoading(false) })
    }, SUGGEST_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [asked])
  const close = () => { asking.current += 1; setItems([]); setLoading(false); setAsked(null) }

  const take = (s) => {
    close()
    if (multiple) { setTyped(''); onChange(addTag(tags, s, Boolean(p.quantity))) }
    else if (onPick) onPick(s)
    else onChange(s.value)
    if (onBlur) onBlur()
  }
  const type = (s) => {
    setSaid(null)
    if (multiple) setTyped(s); else onChange(s)
    setAsked(s)
  }

  // Scan: the camera again after each code found, until the person is done —
  // a box of products is scanned one after another. The last result is shown
  // over the camera. A code nothing has stops it, and says so.
  const tagsRef = useRef(tags); tagsRef.current = tags
  const scan = async () => {
    setSaid(null)
    let note = null
    for (;;) {
      let code
      try { code = await host.scanCode({ title: p.label || 'Scan', note, many: multiple }) } catch (err) { setSaid({ text: err.message || 'Could not open the camera', bad: true }); return }
      code = String(code || '').trim()
      if (!code) return
      setScanning(true)
      let hit
      try { hit = suggestionForCode(await suggestRef.current(code), code) } catch (err) { setSaid({ text: err.message || 'Could not look the code up', bad: true }); return } finally { setScanning(false) }
      if (!hit) { setSaid({ text: `Nothing has the code ${code}`, bad: true }); return }
      const name = hit.label || hit.value
      if (!multiple) { take(hit); setSaid({ text: `Picked ${name}`, bad: false }); return }
      const before = tagsRef.current
      const again = before.some((x) => x && x.value === hit.value)
      const next = addTag(before, hit, Boolean(p.quantity))
      tagsRef.current = next
      close(); setTyped(''); onChange(next)
      note = !again ? `Added ${name}` : p.quantity ? `One more ${name}` : `${name} is added already`
      setSaid({ text: note, bad: false })
      if (next.length >= tagLimit(p)) return
    }
  }

  const box = [styles.input, { flex: 1, color: t.ink, borderColor: invalid ? t.danger : t.border, backgroundColor: t.field }]
  return (
    <View>
      {tags.map((tag, i) => (
        <View key={`${tag.value}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {tag.image ? <Image source={{ uri: tag.image }} style={{ width: 44, height: 44, borderRadius: 6 }} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink }} numberOfLines={2}>{tag.label || tag.value}</Text>
            {tag.sub ? <Text style={[styles.small, { color: t.muted }]} numberOfLines={1}>{tag.sub}</Text> : null}
          </View>
          {p.quantity ? (
            <TextInput value={tag.qty === undefined || tag.qty === null ? '1' : String(tag.qty)} keyboardType="number-pad"
                       accessibilityLabel={`How many ${tag.label || tag.value}`}
                       onChangeText={(s) => onChange(setTagQty(tags, i, s === '' ? '' : Number(s)))}
                       style={[styles.input, { width: 64, textAlign: 'center', color: t.ink, borderColor: t.border, backgroundColor: t.field }]} />
          ) : null}
          <Btn label="×" small variant="plain" accessibilityLabel={`Remove ${tag.label || tag.value}`} onPress={() => onChange(removeTag(tags, i))} />
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput style={box} value={text} editable={!full} onChangeText={type}
                   onBlur={() => { if (!multiple && onBlur) onBlur() }}
                   onSubmitEditing={() => { if (multiple && typed.trim()) take(suggestionForCode(items, typed) || { value: typed.trim() }) }}
                   returnKeyType={multiple ? 'done' : 'default'} autoCapitalize="sentences"
                   placeholder={full ? `At most ${tagLimit(p)}` : (p.placeholder || '')} placeholderTextColor={t.muted}
                   maxLength={p.validation && p.validation.maxLength} accessibilityLabel={p.label} />
        {canScan ? <Btn label={scanning ? 'Looking' : 'Scan'} small busy={scanning} disabled={full} onPress={scan} accessibilityLabel={`Scan ${p.label || 'a code'}`} /> : null}
      </View>
      {loading ? <Text style={[styles.small, { color: t.muted }]}>Looking…</Text> : null}
      {asked !== null && !loading && (items.length || (multiple && typed.trim())) ? (
        <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: 8, marginTop: 4, backgroundColor: t.surface }}>
          {items.map((s, i) => (
            <Pressable key={`${s.value}-${i}`} onPress={() => take(s)} accessibilityRole="button"
                       style={[styles.option, { borderBottomColor: t.border }]}>
              {s.image ? <Image source={{ uri: s.image }} style={{ width: 40, height: 40, borderRadius: 6 }} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink }}>{s.label || s.value}</Text>
                {s.sub ? <Text style={[styles.small, { color: t.muted }]}>{s.sub}</Text> : null}
              </View>
            </Pressable>
          ))}
          {multiple && typed.trim() && !items.some((s) => s.value === typed.trim()) ? (
            <Pressable onPress={() => take({ value: typed.trim() })} accessibilityRole="button" style={[styles.option, { borderBottomColor: t.border }]}>
              <Text style={{ color: t.accent }}>Add “{typed.trim()}” as typed</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {said ? <Text style={[styles.small, { color: said.bad ? t.danger : t.muted }]} accessibilityRole={said.bad ? 'alert' : 'text'}>{said.text}</Text> : null}
    </View>
  )
}
