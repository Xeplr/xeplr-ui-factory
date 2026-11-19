// A RECORD'S COMMENTS AND HISTORY, ON A PHONE — comments as full rows (round
// initials, name, badge, when, what was said, its picture or file), the
// record's history as quiet lines between them, "Comments only", and the box
// a comment is written in (with Camera / Choose for a file). A comment can
// become a task ("Convert to task"); once it has, it says which.
// Presentation only (useFeeds).
import { useState } from 'react'
import { Image, Pressable, Switch, Text, TextInput, View } from 'react-native'
import { Btn, Pill, styles, GAP, RADIUS } from './parts.jsx'
import { useStoredPicture } from './inputs.jsx'
import { toneOf, useNativeTheme } from './theme.js'
import { initials } from '../feed.js'
import { fileLabel } from '../values.js'

export default function NativeFeed({ node, feed, host }) {
  const t = useNativeTheme()
  const p = node.props || {}
  if (!feed) return null
  const compose = feed.compose && p.order !== 'oldest' ? <Compose compose={feed.compose} host={host} /> : null
  return (
    <View style={{ marginBottom: GAP }}>
      {p.title || (p.eventsSwitch && feed.hasEvents) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700', flex: 1 }}>{p.title || ''}</Text>
          {p.eventsSwitch && feed.hasEvents ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: t.muted, fontSize: 13 }}>Comments only</Text>
              <Switch value={feed.commentsOnly} onValueChange={feed.setCommentsOnly} accessibilityLabel="Comments only" />
            </View>
          ) : null}
        </View>
      ) : null}
      {compose}
      {feed.waiting ? <Text style={{ color: t.muted }}>Save first — comments belong to a saved record.</Text> : null}
      {feed.error ? <Text style={{ color: t.danger }} accessibilityRole="alert">{feed.error}</Text> : null}
      {feed.loading && !feed.entries.length ? <Text style={{ color: t.muted }}>Loading…</Text> : null}
      {!feed.waiting && !feed.error && !feed.loading && !feed.entries.length ? <Text style={{ color: t.muted, paddingVertical: 8 }}>{p.empty || 'Nothing here yet.'}</Text> : null}
      {feed.entries.map((e) => (e.kind === 'event'
        ? <EventRow key={e.id} entry={e} />
        : <CommentRow key={e.id} entry={e} readFile={feed.readFile} convert={feed.convert} />))}
      {feed.compose && p.order === 'oldest' ? <Compose compose={feed.compose} host={host} /> : null}
    </View>
  )
}

function CommentRow({ entry, readFile, convert }) {
  const t = useNativeTheme()
  const name = entry.author ? entry.author.name : ''
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: toneOf(t, 'accent').bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: toneOf(t, 'accent').fg, fontWeight: '700', fontSize: 13 }}>{initials(name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {name ? <Text style={{ color: t.ink, fontWeight: '700' }}>{name}</Text> : null}
          {entry.author && entry.author.badge ? <Pill text={entry.author.badge} tone="muted" /> : null}
          {entry.at ? <Text style={{ color: t.muted, fontSize: 12 }}>{entry.at}</Text> : null}
        </View>
        {entry.sub ? <Text style={{ color: t.muted, fontSize: 13 }}>{entry.sub}</Text> : null}
        {entry.text ? <Text style={{ color: t.ink, fontSize: 15, marginTop: 2 }} selectable>{entry.text}</Text> : null}
        {entry.files.map((f) => <Attachment key={f.path} file={f} readFile={readFile} />)}
        {convert ? <Convert entry={entry} convert={convert} /> : null}
      </View>
    </View>
  )
}

/** Turn it into a task, or — once it is one — the task it became, which opens it. */
function Convert({ entry, convert }) {
  const t = useNativeTheme()
  if (entry.converted) {
    const label = entry.converted.text ? `✓ Became “${entry.converted.text}”` : '✓ Converted'
    const look = { color: toneOf(t, 'success').fg, fontWeight: '600', marginTop: 6 }
    return convert.canOpen(entry)
      ? <Pressable onPress={() => convert.open(entry)} accessibilityRole="button"><Text style={look}>{label}</Text></Pressable>
      : <Text style={look}>{label}</Text>
  }
  if (!convert.can(entry)) return null
  return <Btn label={convert.label} small onPress={() => convert.start(entry)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
}

function EventRow({ entry }) {
  const t = useNativeTheme()
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.muted, marginTop: 6, marginLeft: 13, marginRight: 13 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.muted, fontSize: 14 }}>{entry.text}{entry.author ? ` · ${entry.author.name}` : ''}{entry.sub ? ` · ${entry.sub}` : ''}</Text>
        {entry.at ? <Text style={{ color: t.muted, fontSize: 12 }}>{entry.at}</Text> : null}
      </View>
    </View>
  )
}

function Attachment({ file, readFile }) {
  const t = useNativeTheme()
  const uri = useStoredPicture(file.path, readFile)
  if (uri) return <Image source={{ uri }} style={{ width: 120, height: 120, borderRadius: 8, marginTop: 6 }} accessibilityLabel={file.name || fileLabel(file.path)} />
  return <Text style={{ color: t.accent, marginTop: 6 }}>📎 {file.name || fileLabel(file.path)}</Text>
}

function Compose({ compose, host }) {
  const t = useNativeTheme()
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState(null)
  const busy = compose.posting || uploading
  const attach = async (camera) => {
    if (!host || !host.pickFile || !compose.upload) return
    setFileError(null)
    try {
      const picked = await host.pickFile({ camera, multiple: false, accept: compose.fileRules && compose.fileRules.accept })
      if (!picked || !picked.length) return
      setUploading(true)
      await compose.upload(picked[0])
    } catch (err) {
      setFileError(err.message || 'Could not attach')
    } finally {
      setUploading(false)
    }
  }
  return (
    <View style={{ marginBottom: GAP }}>
      <TextInput value={compose.text} onChangeText={compose.setText} multiline editable={!compose.posting}
                 placeholder={compose.placeholder} placeholderTextColor={t.muted} accessibilityLabel={compose.placeholder}
                 style={[styles.input, { color: t.ink, borderColor: t.border, backgroundColor: t.field, minHeight: 72, textAlignVertical: 'top' }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {compose.upload && host && host.pickFile ? (
          compose.file
            ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS, backgroundColor: t.raised }}>
                <Text style={{ color: t.ink }} numberOfLines={1}>📎 {compose.file.name || fileLabel(compose.file.path)}</Text>
                <Pressable onPress={compose.removeFile} disabled={busy} accessibilityLabel="Remove the file" hitSlop={8}><Text style={{ color: t.muted, fontSize: 18 }}>×</Text></Pressable>
              </View>
            : <>
                <Btn label="Camera" small onPress={() => attach(true)} disabled={busy} />
                <Btn label={uploading ? 'Attaching' : 'Attach'} small busy={uploading} onPress={() => attach(false)} disabled={busy} />
              </>
        ) : null}
        <View style={{ flex: 1 }} />
        <Btn label={compose.posting ? 'Posting' : compose.button} variant="primary" small busy={compose.posting} onPress={() => compose.post()} disabled={busy} />
      </View>
      {compose.error || fileError ? <Text style={{ color: t.danger, marginTop: 6 }} accessibilityRole="alert">{compose.error || fileError}</Text> : null}
    </View>
  )
}
