export const STADIUMS = {
  'Mexico City': 'Estadio Azteca',
  'Guadalajara (Zapopan)': 'Estadio Akron',
  'Monterrey (Guadalupe)': 'Estadio BBVA',
  Atlanta: 'Mercedes-Benz Stadium',
  Toronto: 'BMO Field',
  'San Francisco Bay Area (Santa Clara)': "Levi's Stadium",
  'Los Angeles (Inglewood)': 'SoFi Stadium',
  Vancouver: 'BC Place',
  Seattle: 'Lumen Field',
  'New York/New Jersey (East Rutherford)': 'MetLife Stadium',
  'Boston (Foxborough)': 'Gillette Stadium',
  Philadelphia: 'Lincoln Financial Field',
  'Miami (Miami Gardens)': 'Hard Rock Stadium',
  Houston: 'NRG Stadium',
  'Kansas City': 'Arrowhead Stadium',
  'Dallas (Arlington)': 'AT&T Stadium',
}

export function shortCity(city) {
  return city.replace(/\s*\(.*\)$/, '')
}

// All times render via the browser's own locale + time zone — a visitor in
// Toronto sees Eastern time, one in Lisbon sees WEST, automatically.
export function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export function fmtDateLong(iso) {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

// Local-calendar-day key (YYYY-MM-DD in the user's time zone).
export function dayKey(dateLike) {
  return new Date(dateLike).toLocaleDateString('en-CA')
}

export function tzLabel() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')
  } catch {
    return ''
  }
}

const GROUP_REF = /^([12])([A-L])$/
const THIRD_REF = /^3([A-L])((?:\/[A-L])+)$/
const MATCH_REF = /^([WL])(\d+)$/

// Knockout slots reference group positions ("1A", "3A/B/C/D/F") or match
// outcomes ("W74") until the live feed fills in real team names.
export function placeholderLabel(code) {
  let m = GROUP_REF.exec(code)
  if (m) return `${m[1] === '1' ? 'Winner' : 'Runner-up'} Group ${m[2]}`
  m = THIRD_REF.exec(code)
  if (m) return `Best 3rd (${m[1]}${m[2]})`
  m = MATCH_REF.exec(code)
  if (m) return `${m[1] === 'W' ? 'Winner' : 'Loser'} of Match ${m[2]}`
  return code
}

export function scoreline(score) {
  if (!score) return null
  const main = score.et ?? score.ft
  if (!main) return null
  let s = `${main[0]} – ${main[1]}`
  if (score.p) s += ` (${score.p[0]}–${score.p[1]} pens)`
  else if (score.et) s += ' (aet)'
  return s
}

// Short label for an in-play match: the live minute when known, else a state.
export function liveLabel(status, clock) {
  if (status === 'ht') return 'HT'
  if (status === 'pens') return 'PENS'
  if (clock) return clock // e.g. "67'"
  if (status === 'et') return 'ET'
  return 'LIVE'
}
