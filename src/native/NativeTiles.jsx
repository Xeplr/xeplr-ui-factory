// MENU TILES on a phone (tiles.js): two to a row, each a place in the app —
// its icon (text, such as an emoji, or an element), its name, a line under it
// when the app gives one. A tap is the app's (onNavigate).
import { Pressable, Text, View } from 'react-native'
import { styles, GAP, RADIUS } from './parts.jsx'
import { useNativeTheme } from './theme.js'

export default function NativeTiles({ node, tiles }) {
  const t = useNativeTheme()
  const p = node.props || {}
  const items = (tiles && tiles.items) || []
  if (!items.length) return null
  const open = tiles && tiles.open
  return (
    <View style={{ marginBottom: GAP }} accessibilityRole="menu">
      {p.title ? <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700', marginBottom: 8 }} accessibilityRole="header">{p.title}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((item) => (
          <Pressable key={item.key} onPress={() => open && open(item)} disabled={!open} accessibilityRole="button" accessibilityLabel={item.label}
                     style={({ pressed }) => [{ width: '48%', minHeight: 88, padding: 14, borderRadius: RADIUS, borderWidth: 1, borderColor: t.border,
                       backgroundColor: t.surface, justifyContent: 'center', gap: 6 }, pressed && styles.down]}>
            {item.icon ? (typeof item.icon === 'string' ? <Text style={{ fontSize: 24, color: t.accent }}>{item.icon}</Text> : item.icon) : null}
            <Text style={{ color: t.ink, fontSize: 16, fontWeight: '600' }} numberOfLines={2}>{item.label}</Text>
            {item.description ? <Text style={[styles.small, { color: t.muted }]} numberOfLines={2}>{item.description}</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  )
}
