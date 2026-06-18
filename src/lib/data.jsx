import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import bruinData from '../data/bruin/schedule.json'

const LIVE_MS = 25 * 1000 // poll hard while a match is being played
const IDLE_MS = 5 * 60 * 1000 // gentle background poll otherwise
const SOON_MS = 5 * 60 * 1000 // ramp up this long before a kickoff

const LIVE_STATES = new Set(['1h', 'ht', '2h', 'et', 'pens', 'live'])

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [state, setState] = useState(() => {
    const generatedAt = bruinData.generatedAt ? new Date(bruinData.generatedAt) : null
    return {
      matches: Array.isArray(bruinData.matches) ? bruinData.matches.map((m) => ({ ...m })) : [],
      updatedAt: generatedAt,
      source: 'bruin',
    }
  })

  const refresh = useCallback(() => {
    setState({
      matches: Array.isArray(bruinData.matches) ? bruinData.matches.map((m) => ({ ...m })) : [],
      updatedAt: bruinData.generatedAt ? new Date(bruinData.generatedAt) : null,
      source: 'bruin',
    })
  }, [])

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
