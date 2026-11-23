// A `table` control on a phone — rows the screen is HANDED (a journey's step
// input, `rows: '{params.lines}'`), not a table it reads; with a tick per
// row when it is `selectable` (on by default), whose value is the rows
// ticked. The web draws a table; a phone has no room for one, so each row is
// a card: its columns as labelled lines, and a tick to choose it — "Tick
// every row" above, "2 of 5 ticked" under, as on the web.
import { Pressable, Text, View } from 'react-native'
import { tableColumns } from '../controls.js'
import { Field, GAP } from './parts.jsx'
import { useNativeTheme } from './theme.js'

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b)
const shownAs = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

function Tick({ on, label, onPress, disabled }) {
  const t = useNativeTheme()
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }} accessibilityLabel={label}
               hitSlop={8} style={{ width: 28, height: 28, borderRadius: 7, borderWidth: 2, borderColor: on ? t.accent : t.border, backgroundColor: on ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Text style={{ color: t.accentInk, fontWeight: '900', fontSize: 16 }}>✓</Text> : null}
    </Pressable>
  )
}

export default function NativeTable({ node, rows, value, error, onChange, disabled }) {
  const t = useNativeTheme()
  const p = node.props || {}
  const shown = Array.isArray(rows) ? rows : []
  const columns = tableColumns(p, shown)
  const chosen = Array.isArray(value) ? value : []
  const selectable = p.selectable !== false
  const ticked = (row) => chosen.some((c) => same(c, row))
  const toggle = (row) => onChange(ticked(row) ? chosen.filter((c) => !same(c, row)) : [...chosen, row])
  const all = shown.length > 0 && shown.every(ticked)

  return (
    <Field label={p.label || p.title} required={p.required} error={error}>
      {shown.length === 0 ? <Text style={{ color: t.muted }}>Nothing to show.</Text> : null}
      {selectable && shown.length > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: GAP }}>
          <Tick on={all} label="Tick every row" disabled={disabled} onPress={() => onChange(all ? [] : shown.slice())} />
          <Text style={{ color: t.ink }}>Tick every row</Text>
        </View>
      ) : null}
      {shown.map((row, i) => {
        const on = selectable && ticked(row)
        return (
          <Pressable key={i} onPress={selectable && !disabled ? () => toggle(row) : undefined} accessibilityLabel={'Row ' + (i + 1)}
                     style={{ flexDirection: 'row', gap: 12, padding: 14, marginBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: on ? t.accent : t.border, backgroundColor: t.surface }}>
            {selectable ? <Tick on={on} label={'Row ' + (i + 1)} disabled={disabled} onPress={() => toggle(row)} /> : null}
            <View style={{ flex: 1, gap: 4 }}>
              {columns.map((c) => (
                <View key={c} style={{ flexDirection: 'row', gap: 12 }}>
                  <Text style={{ color: t.muted, width: 110 }} numberOfLines={1}>{c}</Text>
                  <Text style={{ color: t.ink, flex: 1, textAlign: typeof (row && row[c]) === 'number' ? 'right' : 'left' }}>{shownAs(row && row[c])}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        )
      })}
      {selectable && shown.length > 0 ? <Text style={{ color: t.muted }}>{chosen.length} of {shown.length} ticked</Text> : null}
    </Field>
  )
}
