// A FUNCTION-FED LIST'S DATE RANGE AND KPI CARDS — the parts of a dashboard.
//
//   "dateRange": { "label": "Placed", "default": "last7",
//                  "presets": ["today", "yesterday", "last2", "last3", "last7"] },
//   "kpis": [{ "key": "ordered", "label": "Not started" }, { "key": "open", "label": "Open" }, …]
//
// The range is one value, kept in the URL as it was chosen — a preset
// ("last30") or two days ("2026-10-01..2026-10-31") — and turned into the
// two days the function is asked for (`from`, `to`, both included) on the day
// it is asked: "last 30 days" opened tomorrow is tomorrow's last 30 days.
// `presets` (optional) is which of DATE_PRESETS the picker offers, in that
// order — all of them when left out; "Between…" two days is always there.
//
// A KPI card is a count the function works out for the range, and a filter:
// clicking one asks for its rows (`kpi`), clicking it again lets go. What
// each card counts is the function's to decide — the document names them.
//
// Pure: no React, no requests.

/** The ranges a person can pick without typing two dates. */
export const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last2', label: 'Last 2 days' },
  { value: 'last3', label: 'Last 3 days' },
  { value: 'last4', label: 'Last 4 days' },
  { value: 'last5', label: 'Last 5 days' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'all', label: 'All time' }
]

export const DATE_PRESET_VALUES = DATE_PRESETS.map((p) => p.value)

/** The presets a list's dateRange offers: its `presets`, in its order, or all of them. */
export function rangePresets(dateRange) {
  const chosen = dateRange && Array.isArray(dateRange.presets) ? dateRange.presets : null
  if (!chosen || !chosen.length) return DATE_PRESETS
  return chosen.map((v) => DATE_PRESETS.find((p) => p.value === v)).filter(Boolean)
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Whether a string is a real day, "YYYY-MM-DD". */
export function isDay(s) {
  if (typeof s !== 'string' || !DAY.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** A Date's own calendar day where it is — "YYYY-MM-DD". */
export function dayOf(date) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * A range as it is kept → the days it means: { from, to, preset } — from/to
 * empty for "all time". `today` is "YYYY-MM-DD" (the caller's own day);
 * `offered`, the preset values the list offers (rangePresets).
 * Anything unreadable falls back to `fallback` (the list's default), so an old
 * or mistyped link opens the usual range rather than an error.
 */
export function resolveRange(value, today, fallback = 'all', offered = DATE_PRESET_VALUES) {
  const v = typeof value === 'string' ? value : ''
  // A preset this list does not offer (an old link): the list's own default.
  if (!v.includes('..') && v !== fallback && DATE_PRESET_VALUES.includes(v) && !offered.includes(v)) return resolveRange(fallback, today, 'all')
  if (v.includes('..')) {
    const [from, to] = v.split('..')
    if ((from === '' || isDay(from)) && (to === '' || isDay(to)) && !(from && to && from > to)) return { from, to, preset: null }
    return resolveRange(fallback, today, 'all')
  }
  const month = today.slice(0, 7)
  switch (v) {
    case 'today': return { from: today, to: today, preset: v }
    case 'yesterday': { const y = addDays(today, -1); return { from: y, to: y, preset: v } }
    case 'last2': case 'last3': case 'last4': case 'last5': case 'last7': case 'last30': {
      const n = Number(v.slice(4))
      return { from: addDays(today, 1 - n), to: today, preset: v }
    }
    case 'thisMonth': return { from: month + '-01', to: today, preset: v }
    case 'lastMonth': {
      const firstThis = month + '-01'
      const lastPrev = addDays(firstThis, -1)
      return { from: lastPrev.slice(0, 7) + '-01', to: lastPrev, preset: v }
    }
    case 'all': return { from: '', to: '', preset: 'all' }
    default: return v === fallback ? { from: '', to: '', preset: 'all' } : resolveRange(fallback, today, 'all')
  }
}

/** Two days typed → how the range is kept. */
export function customRange(from, to) {
  return `${from || ''}..${to || ''}`
}
