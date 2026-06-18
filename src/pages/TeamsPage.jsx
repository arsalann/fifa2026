import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import teams from '../data/bruin/teams.json'
import { useData } from '../lib/data.jsx'
import { computeGroups } from '../lib/standings'
import { useFavorite } from '../lib/prefs'

export default function TeamsPage() {
  const { matches } = useData()
  const [favorite] = useFavorite()
  const [q, setQ] = useState('')

  const groupOf = useMemo(() => {
    const map = {}
    for (const m of matches) {
      if (m.stage !== 'group') continue
      map[m.team1] = m.group
      map[m.team2] = m.group
    }
    return map
  }, [matches])

  const standings = useMemo(() => computeGroups(matches), [matches])
  const posOf = useMemo(() => {
    const map = {}
    for (const rows of Object.values(standings)) {
      rows.forEach((r, i) => {
        map[r.team] = i + 1
      })
    }
    return map
  }, [standings])

  const list = Object.entries(teams)
    .filter(([name, t]) => {
      const needle = q.trim().toLowerCase()
      if (!needle) return true
      return (
        name.toLowerCase().includes(needle) ||
        t.nickname.toLowerCase().includes(needle) ||
        (groupOf[name] && `group ${groupOf[name]}`.toLowerCase().includes(needle))
      )
    })
    .sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="page">
      <input
        className="search"
        type="search"
        placeholder="Search 48 teams… (name, nickname, group)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <Link className="compare-link" to="/compare">
        ⚖️ Compare two teams head-to-head →
      </Link>
      <div className="team-list">
        {list.map(([name, t]) => (
          <Link className="team-row" key={name} to={`/team/${t.slug}`}>
            <span className="flag big">{t.flag}</span>
            <div className="team-row-main">
              <div className="team-row-name">
                {name} {favorite === name && <span className="star inline">★</span>}
              </div>
              <div className="team-row-sub">
                {t.nickname} · Group {groupOf[name] ?? '?'}
                {posOf[name] ? ` · ${posOf[name]}${['st', 'nd', 'rd'][posOf[name] - 1] ?? 'th'} place` : ''}
              </div>
            </div>
            <div className="team-row-tags">
              {t.titles.length > 0 && <span className="title-badge">🏆×{t.titles.length}</span>}
              {t.history.length === 0 && <span className="debut-badge">debut</span>}
            </div>
          </Link>
        ))}
        {list.length === 0 && <p className="hint">No team matches “{q}”.</p>}
      </div>
    </div>
  )
}
