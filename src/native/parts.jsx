// SMALL PIECES THE PHONE'S CONTROLS ARE MADE OF — a field's label and its
// error, a button, a pill, a sheet that slides up, a list to pick from.
// Presentation only, in React Native.
import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from './safeArea.js'
import { toneOf, useNativeTheme } from './theme.js'

export const GAP = 12
export const RADIUS = 10

/** A field: its label (with * when required), what is inside, and its error under it. */
export function Field({ label, required, error, hint, children }) {
  const t = useNativeTheme()
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: t.muted }]}>{label}{required ? <Text style={{ color: t.danger }}> *</Text> : null}</Text> : null}
      {children}
      {hint && !error ? <Text style={[styles.small, { color: t.muted }]}>{hint}</Text> : null}
      {error ? <Text style={[styles.small, { color: t.danger }]} accessibilityRole="alert">{error}</Text> : null}
    </View>
  )
}

/** A button: 'primary', 'secondary' (outlined), 'danger', or 'plain' (a link). */
export function Btn({ label, onPress, variant = 'secondary', disabled, busy, small, pressed, style, accessibilityLabel }) {
  const t = useNativeTheme()
  const look = variant === 'primary'
    ? { backgroundColor: t.accent, borderColor: t.accent }
    : variant === 'danger'
      ? { backgroundColor: 'transparent', borderColor: t.danger }
      : variant === 'plain'
        ? { backgroundColor: 'transparent', borderColor: 'transparent' }
        : { backgroundColor: pressed ? toneOf(t, 'accent').bg : t.raised, borderColor: pressed ? t.accent : t.border }
  const ink = variant === 'primary' ? t.accentInk : variant === 'danger' ? t.danger : variant === 'plain' ? t.accent : t.ink
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy), selected: Boolean(pressed) }}
      style={({ pressed: down }) => [styles.btn, small && styles.btnSmall, look, (disabled || busy) && styles.off, down && styles.down, style]}
    >
      <Text style={[styles.btnText, small && styles.btnTextSmall, { color: ink }]} numberOfLines={1}>{busy ? `${label}…` : label}</Text>
    </Pressable>
  )
}

/** A rounded label in a tone's colours. */
export function Pill({ text, tone = 'accent', zero }) {
  const t = useNativeTheme()
  const c = zero ? { fg: t.muted, bg: t.raised } : toneOf(t, tone)
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]} numberOfLines={1}>{text}</Text>
    </View>
  )
}

/** Text in a tone's colour, or the ink when it has none. */
export function toneColor(t, tone) {
  return tone ? toneOf(t, tone).fg : t.ink
}

/**
 * A SHEET — a full-height popup with a title and ×, its content scrolling.
 * Android's back button closes it as × does (onClose), unless it is busy.
 */
export function Sheet({ visible, title, onClose, busy, children, footer }) {
  const t = useNativeTheme()
  const inset = useSafeAreaInsets()
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { if (!busy) onClose() }} presentationStyle="fullScreen">
      <View style={[styles.sheet, { backgroundColor: t.plane, paddingTop: inset.top, paddingBottom: inset.bottom }]}>
        <View style={[styles.sheetHead, { borderBottomColor: t.border, backgroundColor: t.surface }]}>
          <Text style={[styles.sheetTitle, { color: t.ink }]} numberOfLines={2} accessibilityRole="header">{title}</Text>
          <Pressable onPress={onClose} disabled={busy} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={styles.close}>
            <Text style={[styles.closeText, { color: t.muted }]}>×</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        {footer ? <View style={[styles.sheetFoot, { borderTopColor: t.border, backgroundColor: t.surface }]}>{footer}</View> : null}
      </View>
    </Modal>
  )
}

/**
 * ONE (or several) OF A LIST, picked in a sheet: [{ id, name, sub? }]. A long
 * list gets a search box. `value` is an id, or ids when `multiple`.
 */
export function PickList({ visible, title, items, value, multiple, onPick, onClose, loading, error }) {
  const t = useNativeTheme()
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? items.filter((o) => String(o.name).toLowerCase().includes(s) || String(o.sub || '').toLowerCase().includes(s)) : items
  }, [items, q])
  const chosen = new Set((multiple ? (Array.isArray(value) ? value : []) : [value]).map((v) => String(v)))
  return (
    <Sheet visible={visible} title={title} onClose={onClose}
           footer={multiple ? <Btn label="Done" variant="primary" onPress={onClose} /> : null}>
      {items.length > 12 && (
        <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={t.muted}
                   style={[styles.input, { color: t.ink, borderColor: t.border, backgroundColor: t.field, marginBottom: GAP }]} />
      )}
      {loading ? <Text style={{ color: t.muted }}>Loading…</Text> : null}
      {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
      {!loading && !shown.length ? <Text style={{ color: t.muted }}>Nothing to choose.</Text> : null}
      {shown.map((o) => {
        const on = chosen.has(String(o.id))
        return (
          <Pressable key={String(o.id)} accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityState={{ checked: on }}
                     onPress={() => onPick(o)}
                     style={({ pressed }) => [styles.option, { borderBottomColor: t.border }, on && { backgroundColor: toneOf(t, 'accent').bg }, pressed && styles.down]}>
            <Text style={[styles.optionMark, { color: on ? t.accent : t.border }]}>{multiple ? (on ? '☑' : '☐') : (on ? '●' : '○')}</Text>
            <View style={styles.flex}>
              <Text style={{ color: t.ink, fontSize: 16 }}>{o.name}</Text>
              {o.sub ? <Text style={[styles.small, { color: t.muted }]}>{o.sub}</Text> : null}
            </View>
          </Pressable>
        )
      })}
    </Sheet>
  )
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { marginBottom: GAP },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  small: { fontSize: 13, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, minHeight: 46 },
  btn: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 14, paddingVertical: 11, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingHorizontal: 10, paddingVertical: 6, minHeight: 34 },
  btnText: { fontSize: 15, fontWeight: '600' },
  btnTextSmall: { fontSize: 13 },
  off: { opacity: 0.45 },
  down: { opacity: 0.7 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  sheet: { flex: 1 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  close: { paddingHorizontal: 6 },
  closeText: { fontSize: 30, lineHeight: 32 },
  sheetBody: { padding: 16, paddingBottom: 40 },
  sheetFoot: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  optionMark: { fontSize: 20, width: 24, textAlign: 'center' }
})
