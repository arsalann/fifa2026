import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import bruinData from '../data/bruin/schedule.json'

const LIVE_MS = 25 * 1000 // poll hard while a match is being played
const IDLE_MS = 5 * 60 * 1000 // gentle background poll otherwise
const SOON_MS = 5 * 60 * 1000 // ramp up this long before a kickoff
const ACTIVE_USER_REFRESH_MS = 15 * 1000

const LIVE_STATES = new Set(['1h', 'ht', '2h', 'et', 'pens', 'live'])
const BASE_URL = import.meta.env?.BASE_URL ?? '/'
const PUBLIC_SCHEDULE_URL = `${BASE_URL}data/bruin/schedule.json`
const LIVE_SCHEDULE_URL = `${BASE_URL}.netlify/functions/bruin-schedule`

const DataContext = createContext(null)

const GROUP_STAGE_NAMES = new Set(['group', 'groups', 'group stage'])

function parseJson(value, fallback = value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function normalizeStage(stage) {
  const value = String(stage ?? '').trim().toLowerCase()
  return GROUP_STAGE_NAMES.has(value) ? 'group' : value
}

function normalizeMatch(match, fallbackMatch = null) {
  const group = match?.group ?? match?.groupName ?? match?.group_name
  return {
    ...match,
    stage: normalizeStage(match?.stage ?? match?.stageName ?? match?.stage_name),
    group: group == null ? group : String(group).trim(),
    score: parseJson(match?.score, null),
    goals1: parseJson(match?.goals1, match?.goals1),
    goals2: parseJson(match?.goals2, match?.goals2),
    betting: match?.betting ?? fallbackMatch?.betting,
  }
}

function hasRenderableGroups(matches) {
  return matches.some((m) => m.stage === 'group' && m.group && m.team1 && m.team2)
}

function stateFromPayload(payload, fallbackPayload = null) {
  const fallbackMatches = new Map(
    (fallbackPayload?.matches ?? []).map((match) => [Number(match.index), match]),
  )
  return {
    matches: Array.isArray(payload?.matches)
      ? payload.matches.map((match) => normalizeMatch(match, fallbackMatches.get(Number(match.index))))
      : [],
    updatedAt: payload?.generatedAt ? new Date(payload.generatedAt) : null,
    source: payload?.source ?? 'bruin',
    betting: payload?.betting ?? fallbackPayload?.betting ?? { teamMarkets: {} },
  }
}

export function scheduleStateFromPayload(payload, fallbackPayload = bruinData) {
  const state = stateFromPayload(payload, fallbackPayload)
  if (hasRenderableGroups(state.matches)) return state

  const fallbackState = stateFromPayload(fallbackPayload)
  return hasRenderableGroups(fallbackState.matches) ? fallbackState : state
}

export function DataProvider({ children }) {
  const [state, setState] = useState(() => scheduleStateFromPayload(bruinData))
  const stateRef = useRef(state)
  const refreshPromiseRef = useRef(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const refresh = useCallback(() => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current

    if (typeof fetch !== 'function') {
      setState(stateFromPayload(bruinData))
      return Promise.resolve()
    }

    refreshPromiseRef.current = fetch(`${LIVE_SCHEDULE_URL}?t=${Date.now()}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load Bruin data: ${response.status}`)
        return response.json()
      })
      .catch(() =>
        fetch(`${PUBLIC_SCHEDULE_URL}?t=${Date.now()}`, { cache: 'no-store' }).then((response) => {
          if (!response.ok) throw new Error(`Unable to load Bruin fallback data: ${response.status}`)
          return response.json()
        }),
      )
      .then((payload) => setState(scheduleStateFromPayload(payload)))
      .catch(() => setState(scheduleStateFromPayload(bruinData)))
      .finally(() => {
        refreshPromiseRef.current = null
      })

    return refreshPromiseRef.current
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    let stopped = false
    let timer = null

    const schedule = () => {
      if (stopped) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (document.visibilityState === 'hidden') {
          schedule()
          return
        }
        refresh().finally(() => {
          schedule()
        })
      }, nextRefreshDelay(stateRef.current.matches))
    }

    schedule()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [refresh])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined

    let lastActivityRefresh = 0
    const shouldRefreshForActivity = (now) => {
      const delay = nextRefreshDelay(stateRef.current.matches, new Date(now))
      const minimumGap = delay <= LIVE_MS ? ACTIVE_USER_REFRESH_MS : IDLE_MS
      return now - lastActivityRefresh >= minimumGap
    }
    const maybeRefresh = (force = false) => {
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      if (!force && !shouldRefreshForActivity(now)) return
      lastActivityRefresh = now
      refresh()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') maybeRefresh(true)
    }
    const onActivity = () => maybeRefresh(false)

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    window.addEventListener('pointerdown', onActivity, { passive: true })
    window.addEventListener('keydown', onActivity)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
    }
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
