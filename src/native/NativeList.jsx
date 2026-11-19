// A LIST WHOSE ROWS A FUNCTION WORKS OUT (rowsFrom), ON A PHONE — always a
// card per row: the first column is the card's heading (with its badges and
// second line), pictures and items large, every other column a line under its
// label. Above them: the date range, the KPI cards, the title with + New,
// the search box and the filter chips — each chip with its count.
//
// Everything a card says is text the server wrote, as on the web. Presentation
// only: the rows, the query and what a tap does arrive as props.
import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Btn, Pill, PickList, styles, toneColor, GAP, RADIUS } from './parts.jsx'
import { toneOf, useNativeTheme } from './theme.js'
import { rangePresets } from '../listRange.js'
import { BADGE_TONES } from '../tones.js'
import { readableWhen } from './inputs.jsx'

const text = (v) => (v === undefined || v === null ? '' : typeof v === 'object' ? '' : String(v))
const isNothing = (v) => v === null || v === undefined || v === '' || v === 0 || v === '0'

export default function NativeList({ node, list, query, onOpen, onNew, host }) {
  const t = useNativeTheme()
  const p = node.props || {}
  if (!p.rowsFrom) {
    return <Text style={{ color: t.muted, marginBottom: GAP }}>{p.title ? `${p.title}: ` : ''}this list is not on the phone yet — open it on a computer.</Text>
  }
  const columns = Array.isArray(p.columns) ? p.columns : []
  const rows = list.rows || []
  const counts = list.counts || {}
  const chips = Array.isArray(p.filters) ? p.filters : []
  const active = query.filter || (chips[0] && chips[0].key) || ''
  const kpis = Array.isArray(p.kpis) ? p.kpis : []
  const kpiCounts = list.kpis || {}
  const range = query.rangeFor ? query.rangeFor(node) : null
  const pageSize = p.pageSize || 10
  const open = p.rowOpen || (p.actions || []).includes('edit') ? onOpen : null

  return (
    <View style={{ marginBottom: GAP }}>
      {range ? <Range label={p.dateRange.label} presets={rangePresets(p.dateRange)} range={range} onChange={query.setDates} /> : null}
      {kpis.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: GAP }}>
          {kpis.map((k) => {
            const on = query.kpi === k.key
            const c = toneOf(t, k.tone || 'accent')
            return (
              <Pressable key={k.key} onPress={() => query.setKpi(on ? '' : k.key)} accessibilityRole="button" accessibilityState={{ selected: on }}
                         style={{ minWidth: 112, padding: 12, borderRadius: RADIUS, borderWidth: 1, borderColor: on ? c.fg : t.border, backgroundColor: on ? c.bg : t.surface }}>
                <Text style={{ color: c.fg, fontSize: 24, fontWeight: '700' }}>{kpiCounts[k.key] === undefined ? '—' : String(kpiCounts[k.key])}</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>{k.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {p.title ? <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700', flex: 1 }} accessibilityRole="header">{p.title}</Text> : <View style={{ flex: 1 }} />}
        {onNew && (p.actions || []).includes('new') && (p.newScreen || p.editScreen) ? <Btn label="+ New" variant="primary" small onPress={onNew} /> : null}
      </View>
      {p.search && p.search.placeholder ? <Search placeholder={p.search.placeholder} q={query.q} onChange={query.setQ} /> : null}
      {chips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: GAP }}>
          {chips.map((f) => {
            const on = f.key === active
            return (
              <Pressable key={f.key} onPress={() => query.setFilter(f.key === (chips[0] && chips[0].key) ? '' : f.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                         style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
                                  borderColor: on ? t.accent : t.border, backgroundColor: on ? t.accent : t.surface }}>
                <Text style={{ color: on ? t.accentInk : t.ink, fontWeight: '600' }}>{f.label}</Text>
                {counts[f.key] !== undefined ? <Text style={{ color: on ? t.accentInk : t.muted, fontSize: 12 }}>{String(counts[f.key])}</Text> : null}
              </Pressable>
            )
          })}
        </ScrollView>
      ) : null}
      {list.loading && !rows.length ? <Text style={{ color: t.muted }}>Loading…</Text> : null}
      {list.error ? <Text style={{ color: t.danger, marginBottom: 8 }} accessibilityRole="alert">{list.error}</Text> : null}
      {rows.length === 0 && !list.loading && !list.error
        ? <Text style={{ color: t.muted, paddingVertical: 16, textAlign: 'center' }}>{query.q || query.kpi || (range && range.from) ? 'Nothing matches.' : p.empty || 'Nothing here yet.'}</Text>
        : <Cards rows={rows} columns={columns} pageSize={pageSize} open={open} highlight={p.highlight} dim={p.dim} host={host} />}
    </View>
  )
}

/** The search box: shows what is typed at once; the controller asks after a pause. */
function Search({ placeholder, q, onChange }) {
  const t = useNativeTheme()
  const [typed, setTyped] = useState(q || '')
  useEffect(() => { setTyped(q || '') }, [q])
  return (
    <TextInput value={typed} onChangeText={(s) => { setTyped(s); onChange(s) }} placeholder={placeholder} placeholderTextColor={t.muted}
               returnKeyType="search" autoCorrect={false} accessibilityLabel={placeholder} maxLength={200}
               style={[styles.input, { color: t.ink, borderColor: t.border, backgroundColor: t.field, marginBottom: GAP }]} />
  )
}

/** From–To as a preset ("Last 7 days"); the days themselves are a computer's to type. */
function Range({ label, presets, range, onChange }) {
  const t = useNativeTheme()
  const [open, setOpen] = useState(false)
  const current = presets.find((x) => x.value === range.preset)
  const shown = current ? current.label : range.from || range.to ? `${readableWhen(range.from) || '…'} – ${readableWhen(range.to) || '…'}` : 'All'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: GAP }}>
      {label ? <Text style={{ color: t.muted, fontWeight: '600' }}>{label}</Text> : null}
      <Btn label={`${shown} ▾`} small onPress={() => setOpen(true)} />
      <PickList visible={open} title={label ? `${label}: when` : 'When'} items={presets.map((x) => ({ id: x.value, name: x.label }))}
                value={range.preset} onClose={() => setOpen(false)} onPick={(o) => { onChange(o.id); setOpen(false) }} />
    </View>
  )
}

/** A picture's address: the server's, or one of the app's own relative paths, said against the app's server. */
function picture(src, host) {
  if (!src) return null
  return /^\//.test(src) && host && host.baseUrl ? host.baseUrl + src : src
}

function Cards({ rows, columns, pageSize, open, highlight, dim, host }) {
  const t = useNativeTheme()
  const [shown, setShown] = useState(pageSize)
  const [head, ...rest] = columns
  return (
    <View>
      {rows.slice(0, shown).map((row, i) => {
        const title = head ? text(head.text ? row[head.text] : row[head.field]) : ''
        const badges = head ? (head.badges || []).filter((b) => row[b.field]) : []
        const sub = head && head.sub ? text(row[head.sub]) : ''
        const headTone = head && head.toneFrom && BADGE_TONES.includes(row[head.toneFrom]) ? row[head.toneFrom] : null
        const body = (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: open ? t.accent : toneColor(t, headTone), fontSize: 17, fontWeight: '700' }}>{title}</Text>
              {badges.map((b) => <Pill key={b.field} text={b.label} tone={b.tone || 'accent'} />)}
            </View>
            {sub ? <Text style={{ color: t.muted, marginTop: 2 }}>{sub}</Text> : null}
            {rest.map((c) => <CardPart key={c.field} column={c} row={row} host={host} />)}
          </>
        )
        const look = [{ backgroundColor: t.surface, borderColor: highlight && row[highlight] ? t.accent : t.border, borderWidth: 1, borderRadius: RADIUS, padding: 14, marginBottom: 10 },
          dim && row[dim] ? { opacity: 0.6 } : null]
        return open
          ? <Pressable key={row.id || i} onPress={() => open(row)} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [look, pressed && styles.down]}>{body}</Pressable>
          : <View key={row.id || i} style={look}>{body}</View>
      })}
      {rows.length > shown ? <Btn label={`Show more (${rows.length - shown})`} onPress={() => setShown((n) => n + pageSize)} /> : null}
    </View>
  )
}

/** One column on a card: its label and what the row says, drawn as the column says. */
function CardPart({ column: c, row, host }) {
  const t = useNativeTheme()
  const value = row[c.field]
  const cellTone = c.toneFrom && BADGE_TONES.includes(row[c.toneFrom]) ? row[c.toneFrom] : null
  const labelled = (child) => (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'flex-start' }}>
      {c.label ? <Text style={{ color: t.muted, width: 104, fontSize: 13, paddingTop: 2 }}>{c.label}</Text> : null}
      <View style={{ flex: 1 }}>{child}</View>
    </View>
  )
  if (c.display === 'items') {
    const items = (Array.isArray(value) ? value : []).filter((x) => x && (x.src || x.name))
    if (!items.length) return null
    return (
      <View style={{ marginTop: 8, gap: 8 }}>
        {items.map((it, n) => (
          <View key={n} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {it.src ? <Image source={{ uri: picture(it.src, host) }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: t.raised }} /> : <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: t.raised }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontWeight: '600' }}>{Number(it.qty) > 0 ? `${it.qty} × ` : ''}{text(it.name)}</Text>
              {it.detail ? <Text style={{ color: t.muted, fontSize: 13 }}>{text(it.detail)}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    )
  }
  if (c.display === 'images') {
    const pics = Array.isArray(value) ? value.filter((x) => x && x.src) : []
    if (!pics.length) return null
    const more = c.more ? Number(row[c.more]) || 0 : 0
    return labelled(
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        {pics.map((img, n) => <Image key={n} source={{ uri: picture(img.src, host) }} style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: t.raised }} accessibilityLabel={img.name || ''} />)}
        {more > 0 ? <Text style={{ color: t.muted }}>+{more}</Text> : null}
      </View>
    )
  }
  if (c.display === 'steps') {
    const steps = Array.isArray(value) ? value.filter((s) => s && s.label) : []
    if (!steps.length) return null
    const last = [...steps].reverse().find((s) => s.done) || null
    return labelled(<Text style={{ color: t.ink }}>{last ? `${last.label}${last.at ? ' · ' + text(last.at) : ''}` : 'Not started'}</Text>)
  }
  const shown = text(c.text ? row[c.text] : value)
  const sub = c.sub ? text(row[c.sub]) : ''
  const badges = (c.badges || []).filter((b) => row[b.field])
  if (!shown && !sub && !badges.length) return null
  if (c.display === 'chip') {
    return labelled(<Pill text={shown || '0'} tone={cellTone || c.tone || 'accent'} zero={isNothing(value) && isNothing(row[c.text])} />)
  }
  return labelled(
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {shown ? <Text style={{ color: toneColor(t, cellTone), fontWeight: c.bold ? '700' : '400' }}>{shown}</Text> : null}
        {badges.map((b) => <Pill key={b.field} text={b.label} tone={b.tone || 'accent'} />)}
      </View>
      {sub ? <Text style={{ color: t.muted, fontSize: 13 }}>{sub}</Text> : null}
    </View>
  )
}
