import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import bruinData from '../data/bruin/schedule.json'

const LIVE_MS = 25 * 1000 // poll hard while a match is being played
const IDLE_MS = 5 * 60 * 1000 // gentle background poll otherwise
const SOON_MS = 5 * 60 * 1000 // ramp up this long before a kickoff

const LIVE_STATES = new Set(['1h', 'ht', '2h', 'et', 'pens', 'live'])
const BASE_URL = import.meta.env?.BASE_URL ?? '/'
const PUBLIC_SCHEDULE_URL = `${BASE_URL}data/bruin/schedule.json`

const DataContext = createContext(null)

function stateFromPayload(payload) {
  return {
    matches: Array.isArray(payload?.matches) ? payload.matches.map((m) => ({ ...m })) : [],
    updatedAt: payload?.generatedAt ? new Date(payload.generatedAt) : null,
    source: 'bruin',
  }
}

export function DataProvider({ children }) {
  const [state, setState] = useState(() => stateFromPayload(bruinData))

  const refresh = useCallback(() => {
    if (typeof fetch !== 'function') {
      setState(stateFromPayload(bruinData))
      return Promise.resolve()
    }
    return fetch(`${PUBLIC_SCHEDULE_URL}?t=${Date.now()}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load Bruin data: ${response.status}`)
        return response.json()
      })
      .then((payload) => setState(stateFromPayload(payload)))
      .catch(() => setState(stateFromPayload(bruinData)))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh])
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}

// True while a match is being played (any half, the break, ET or pens).
export function isInPlay(status) {
  return LIVE_STATES.has(status)
}

// Poll fast when any match is in play (or kicks off within a few minutes),
// gently otherwise. Keeps live matches snappy without hammering the feed.
export function nextRefreshDelay(matches, now = new Date()) {
  const t = now.getTime()
  for (const m of matches) {
    if (LIVE_STATES.has(matchStatus(m, now))) return LIVE_MS
    const ko = new Date(m.kickoff).getTime()
    if (ko > t && ko - t < SOON_MS) return LIVE_MS
  }
  return IDLE_MS
}

// Status precedence: a recorded result, then ESPN's live state, then the clock.
// Possible values: upcoming | 1h | ht | 2h | et | pens | live | pending | ft
export function matchStatus(m, now = new Date()) {
  const s = m.score
  if (m.liveState && m.liveState !== 'ft') return m.liveState
  if (s && (s.ft || s.p)) return 'ft'
  if (s && s.ht) return 'ht'
  const ko = new Date(m.kickoff)
  if (now >= ko) {
    // no score yet; matches run ~2h, leave margin for the feed to catch up
    return now - ko < 3 * 60 * 60 * 1000 ? 'live' : 'pending'
  }
  return 'upcoming'
}

export function finalScore(m) {
  const s = m.score
  if (!s) return null
  if (s.et) return s.et
  return s.ft ?? null
}
