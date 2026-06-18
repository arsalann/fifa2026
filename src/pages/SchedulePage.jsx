import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../lib/data.jsx'
import { useFavorite } from '../lib/prefs'
import { dayKey, fmtDateLong, tzLabel } from '../lib/format'
import { track } from '../lib/analytics'
import teams from '../data/bruin/teams.json'
import MatchCard from '../components/MatchCard'

const DAY_MS = 86400000

// Monday of the week containing the given local date.
function mondayOf(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

function flagsFor(match) {
  const f1 = teams[match.team1]?.flag ?? '·'
  const f2 = teams[match.team2]?.flag ?? '·'
  return `${f1}${f2}`
}

function WeekView({ matches, favorite }) {
  const byDay = useMemo(() => {
    const map = new Map()
    for (const m of matches) {
      const k = dayKey(m.kickoff)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(m)
    }
    return map
  }, [matches])

  const firstDay = mondayOf(new Date(matches[0].kickoff))
  const lastDay = mondayOf(new Date(matches[matches.length - 1].kickoff))
  const todayMonday = mondayOf(new Date())
  const initial = todayMonday < firstDay ? firstDay : todayMonday > lastDay ? lastDay : todayMonday

  const [weekStart, setWeekStart] = useState(initial)
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = dayKey(new Date())
    return byDay.has(today) ? today : null
  })

  const days = [...Array(7)].map((_, i) => new Date(weekStart.getTime() + i * DAY_MS))
  const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS)
  const shiftWeek = (dir) => {
    const next = new Date(weekStart.getTime() + dir * 7 * DAY_MS)
    if (next < firstDay || next > lastDay) return
    track('schedule_week_changed', { dir: dir > 0 ? 'next' : 'prev' })
    setWeekStart(next)
    setSelectedDay(null)
  }

  const shownDay =
    selectedDay && days.some((d) => dayKey(d) === selectedDay)
      ? selectedDay
      : (days.map(dayKey).find((k) => byDay.has(k)) ?? null)

  return (
    <div>
      <div className="week-nav">
        <button onClick={() => shiftWeek(-1)} disabled={weekStart <= firstDay} aria-label="Previous week">
          ‹
        </button>
        <span>
          {weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} –{' '}
          {weekEnd.toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>
        <button onClick={() => shiftWeek(1)} disabled={weekStart >= lastDay} aria-label="Next week">
          ›
        </button>
      </div>
      <div className="week-grid">
        {days.map((d) => {
          const k = dayKey(d)
          const dayMatches = byDay.get(k) ?? []
          const isToday = k === dayKey(new Date())
          return (
            <button
              key={k}
              className={`day-cell${k === shownDay ? ' selected' : ''}${isToday ? ' today' : ''}`}
              onClick={() => setSelectedDay(k)}
              disabled={dayMatches.length === 0}
            >
              <div className="day-name">{d.toLocaleDateString([], { weekday: 'short' })}</div>
              <div className="day-num">{d.getDate()}</div>
              <div className="day-flags">
                {dayMatches.slice(0, 3).map((m) => (
                  <div key={m.key}>{flagsFor(m)}</div>
                ))}
                {dayMatches.length > 3 && <div className="more">+{dayMatches.length - 3}</div>}
              </div>
            </button>
          )
        })}
      </div>
      {shownDay ? (
        <div className="day-list">
          <h3>{fmtDateLong(`${shownDay}T12:00:00`)}</h3>
          {(byDay.get(shownDay) ?? []).map((m) => (
            <MatchCard
              key={m.key}
              match={m}
              highlight={favorite && (m.team1 === favorite || m.team2 === favorite)}
            />
          ))}
        </div>
      ) : (
        <p className="hint">No matches this week.</p>
      )}
    </div>
  )
}

function ListView({ matches, favorite }) {
  const todayRef = useRef(null)
  const today = dayKey(new Date())

  const byDay = useMemo(() => {
    const out = []
    let current = null
    for (const m of matches) {
      const k = dayKey(m.kickoff)
      if (!current || current.key !== k) {
        current = { key: k, kickoff: m.kickoff, matches: [] }
        out.push(current)
      }
      current.matches.push(m)
    }
    return out
  }, [matches])

  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <div>
      {byDay.map((day) => (
        <section key={day.key} ref={day.key === today ? todayRef : undefined}>
          <h3 className="date-header">{fmtDateLong(day.kickoff)}</h3>
          {day.matches.map((m) => (
            <MatchCard
              key={m.key}
              match={m}
              highlight={favorite && (m.team1 === favorite || m.team2 === favorite)}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

export default function SchedulePage() {
  const { matches } = useData()
  const [favorite] = useFavorite()
  const [view, setView] = useState('week')

  const sorted = useMemo(
    () => [...matches].sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    [matches],
  )

  return (
    <div className="page">
      <div className="toolbar">
        <div className="segmented">
          <button
            className={view === 'week' ? 'active' : ''}
            onClick={() => {
              track('schedule_view_changed', { view: 'week' })
              setView('week')
            }}
          >
            Weekly
          </button>
          <button
            className={view === 'list' ? 'active' : ''}
            onClick={() => {
              track('schedule_view_changed', { view: 'list' })
              setView('list')
            }}
          >
            All matches
          </button>
        </div>
        <span className="tz-note">Times shown in your time zone ({tzLabel()})</span>
      </div>
      {view === 'week' ? (
        <WeekView matches={sorted} favorite={favorite} />
      ) : (
        <ListView matches={sorted} favorite={favorite} />
      )}
    </div>
  )
}
