// A FUNCTION-FED LIST'S DATE RANGE AND KPI CARDS — the parts of a dashboard.
//
//   "dateRange": { "label": "Placed", "default": "last30" },
//   "kpis": [{ "key": "ordered", "label": "Not started" }, { "key": "open", "label": "Open" }, …]
//
// The range is one value, kept in the URL as it was chosen — a preset
// ("last30") or two days ("2026-10-01..2026-10-31") — and turned into the
// two days the function is asked for (`from`, `to`, both included) on the day
// it is asked: "last 30 days" opened tomorrow is tomorrow's last 30 days.
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
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'all', label: 'All time' }
]

export const DATE_PRESET_VALUES = DATE_PRESETS.map((p) => p.value)

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
 * empty for "all time". `today` is "YYYY-MM-DD" (the caller's own day).
 * Anything unreadable falls back to `fallback` (the list's default), so an old
 * or mistyped link opens the usual range rather than an error.
 */
export function resolveRange(value, today, fallback = 'all') {
  const v = typeof value === 'string' ? value : ''
  if (v.includes('..')) {
    const [from, to] = v.split('..')
    if ((from === '' || isDay(from)) && (to === '' || isDay(to)) && !(from && to && from > to)) return { from, to, preset: null }
    return resolveRange(fallback, today, 'all')
  }
  const month = today.slice(0, 7)
  switch (v) {
    case 'today': return { from: today, to: today, preset: v }
    case 'yesterday': { const y = addDays(today, -1); return { from: y, to: y, preset: v } }
    case 'last7': return { from: addDays(today, -6), to: today, preset: v }
    case 'last30': return { from: addDays(today, -29), to: today, preset: v }
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
