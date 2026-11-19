// WHAT IS KNOWN ABOUT A RECORD, ON A PHONE — the record's own line (title,
// pills, a second line), its journey, then each section as a box: its items
// with their pictures, its label / value rows (a phone number calls, a link
// opens). "More" asks for what the function keeps for when it is asked.
// Presentation only (useRecordDetails).
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { Btn, Pill, toneColor, GAP, RADIUS } from './parts.jsx'
import { useNativeTheme } from './theme.js'

export default function NativeDetails({ node, details, host }) {
  const t = useNativeTheme()
  const p = node.props || {}
  if (!details) return null
  const nothing = !details.loading && !details.error && !details.waiting && details.sections.length === 0
  if (nothing && !p.empty) return null
  return (
    <View style={{ marginBottom: GAP }}>
      {p.title ? <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{p.title}</Text> : null}
      {details.error ? <Text style={{ color: t.danger }} accessibilityRole="alert">{details.error}</Text> : null}
      {details.loading && !details.sections.length ? <Text style={{ color: t.muted }}>Loading…</Text> : null}
      {nothing ? <Text style={{ color: t.muted }}>{p.empty}</Text> : null}
      <Sections sections={details.sections} host={host} />
      {details.canShowMore ? <Btn label={p.moreLabel || 'More'} small onPress={details.showMore} style={{ alignSelf: 'flex-start' }} /> : null}
      {details.more ? (
        <View style={{ marginTop: GAP }}>
          {details.more.loading ? <Text style={{ color: t.muted }}>Loading…</Text> : null}
          {details.more.error ? <Text style={{ color: t.danger }}>{details.more.error}</Text> : null}
          <Sections sections={details.more.sections} host={host} />
          {!details.more.loading ? <Btn label="Less" small onPress={details.hideMore} style={{ alignSelf: 'flex-start' }} /> : null}
        </View>
      ) : null}
    </View>
  )
}

function Sections({ sections, host }) {
  return sections.map((s, i) => (s.kind === 'header' ? <Header key={i} section={s} /> : s.kind === 'journey' ? <Journey key={i} section={s} /> : <Box key={i} section={s} host={host} />))
}

function Header({ section: s }) {
  const t = useNativeTheme()
  return (
    <View style={{ marginBottom: GAP }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: t.ink, fontSize: 24, fontWeight: '800' }} accessibilityRole="header">{s.title}</Text>
        {s.badges.map((b, i) => <Pill key={i} text={b.text} tone={b.tone} />)}
      </View>
      {s.sub ? <Text style={{ color: t.muted, marginTop: 4 }}>{s.sub}</Text> : null}
      {s.aside ? <Text style={{ color: t.ink, fontWeight: '600', marginTop: 2 }}>{s.aside}</Text> : null}
    </View>
  )
}

/** The record's journey, across: each step, reached or not yet. Scrolls sideways on a narrow phone. */
function Journey({ section: s }) {
  const t = useNativeTheme()
  const steps = Array.isArray(s.steps) ? s.steps : []
  return (
    <View style={{ marginBottom: GAP, backgroundColor: t.surface, borderRadius: RADIUS, borderWidth: 1, borderColor: t.border, paddingVertical: 10 }}>
      {s.title ? <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', marginHorizontal: 12, marginBottom: 6 }}>{s.title.toUpperCase()}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 14 }}>
        {steps.map((st, i) => {
          const c = st.done ? toneColor(t, st.tone || 'success') : t.border
          return (
            <View key={i} style={{ alignItems: 'center', minWidth: 84 }} accessibilityLabel={`${st.label}: ${st.done ? st.at || 'done' : 'not yet'}`}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: st.done ? c : 'transparent', borderWidth: 2, borderColor: c }} />
              <Text style={{ color: t.ink, fontSize: 13, fontWeight: '600', marginTop: 4, textAlign: 'center' }}>{st.label}</Text>
              <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>{st.done ? st.at || '' : 'Not yet'}</Text>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

function Box({ section: s, host }) {
  const t = useNativeTheme()
  return (
    <View style={{ marginBottom: GAP, backgroundColor: t.surface, borderRadius: RADIUS, borderWidth: 1, borderColor: t.border, padding: 12 }}>
      {s.title ? <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>{String(s.title).toUpperCase()}</Text> : null}
      {(s.items || []).map((it, j) => (
        <View key={j} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {it.src ? <Image source={{ uri: /^\//.test(it.src) && host && host.baseUrl ? host.baseUrl + it.src : it.src }} style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: t.raised }} />
            : <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: t.raised }} />}
          <View style={{ flex: 1 }}>
            {it.name ? <Text style={{ color: t.ink, fontWeight: '600' }}>{it.name}</Text> : null}
            {it.detail ? <Text style={{ color: t.muted, fontSize: 13 }}>{it.detail}</Text> : null}
          </View>
          {it.qty !== null && it.qty !== undefined ? <Text style={{ color: t.ink, fontWeight: '700' }}>× {it.qty}</Text> : null}
        </View>
      ))}
      {(s.rows || []).map((r, j) => (
        <View key={j} style={{ flexDirection: 'row', gap: 10, paddingVertical: 4 }}>
          {r.label ? <Text style={{ color: t.muted, width: 112, fontSize: 14 }}>{r.label}</Text> : null}
          {r.href
            ? <Pressable style={{ flex: 1 }} onPress={() => Linking.openURL(r.href)} accessibilityRole="link"><Text style={{ color: t.accent, fontSize: 15 }}>{r.text}</Text></Pressable>
            : <Text style={{ flex: 1, color: toneColor(t, r.tone), fontSize: 15 }}>{r.text}</Text>}
        </View>
      ))}
    </View>
  )
}
