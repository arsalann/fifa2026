import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData, matchStatus } from '../lib/data.jsx'
import { computeGroups, thirdPlaceRace } from '../lib/standings'
import { useFavorite } from '../lib/prefs'
import { dayKey, fmtDate, fmtTime } from '../lib/format'
import teams from '../data/bruin/teams.json'
import TeamTag from '../components/TeamTag'
import MatchCard from '../components/MatchCard'

function FavoriteCard({ favorite, matches }) {
  const t = teams[favorite]
  if (!t) return null
  const next = matches
    .filter(
      (m) =>
        (m.team1 === favorite || m.team2 === favorite) && matchStatus(m) === 'upcoming',
    )
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0]
  return (
    <Link className="fav-card" to={`/team/${t.slug}`}>
      <span className="flag big">{t.flag}</span>
      <div>
        <div className="fav-name">{favorite}</div>
        {next ? (
          <div className="fav-next">
            Next: vs {next.team1 === favorite ? next.team2 : next.team1} ·{' '}
            {fmtDate(next.kickoff)}, {fmtTime(next.kickoff)}
          </div>
        ) : (
          <div className="fav-next">View team stats →</div>
        )}
      </div>
      <span className="star">★</span>
    </Link>
  )
}

function TodaySection({ matches, favorite }) {
  const today = dayKey(new Date())
  const todays = matches
    .filter((m) => dayKey(m.kickoff) === today)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  if (todays.length === 0) return null
  return (
    <section>
      <h2 className="section-title">Today's matches</h2>
      {todays.map((m) => (
        <MatchCard
          key={m.key}
          match={m}
          highlight={favorite && (m.team1 === favorite || m.team2 === favorite)}
        />
      ))}
    </section>
  )
}

function ThirdPlaceTable({ groups }) {
  const race = thirdPlaceRace(groups)
  if (race.length < 12) return null
  return (
    <section className="card">
      <h2>3rd-place race</h2>
      <p className="hint">The best 8 of the 12 third-placed teams also advance.</p>
      <table className="standings">
        <thead>
          <tr>
            <th className="pos">#</th>
            <th className="team-col">Team</th>
            <th>Grp</th>
            <th>MP</th>
            <th>GF</th>
            <th>GA</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {race.map((r, i) => (
            <tr key={r.team} className={i < 8 ? 'qualifying' : ''}>
              <td className="pos">{i + 1}</td>
              <td className="team-col">
                <TeamTag name={r.team} />
              </td>
              <td>{r.group}</td>
              <td>{r.mp}</td>
              <td>{r.gf}</td>
              <td>{r.ga}</td>
              <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td className="pts">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function GroupsPage() {
  const { matches } = useData()
  const [favorite] = useFavorite()
  const groups = useMemo(() => computeGroups(matches), [matches])

  return (
    <div className="page">
      {favorite && <FavoriteCard favorite={favorite} matches={matches} />}
      <TodaySection matches={matches} favorite={favorite} />
      <p className="hint">
        Top 2 of each group + the 8 best third-placed teams advance to the Round of 32.
        Tap a team for full stats.
      </p>
      <div className="group-grid">
        {Object.keys(groups)
          .sort()
          .map((g) => (
            <section className="card" key={g}>
              <h2>Group {g}</h2>
              <table className="standings">
                <thead>
                  <tr>
                    <th className="pos">#</th>
                    <th className="team-col">Team</th>
                    <th>MP</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>GF</th>
                    <th>GA</th>
                    <th>GD</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {groups[g].map((row, i) => (
                    <tr key={row.team} className={i < 2 ? 'qualifying' : i === 2 ? 'maybe' : ''}>
                      <td className="pos">{i + 1}</td>
                      <td className="team-col">
                        <TeamTag name={row.team} />
                        {favorite === row.team && <span className="star inline">★</span>}
                      </td>
                      <td>{row.mp}</td>
                      <td>{row.w}</td>
                      <td>{row.d}</td>
                      <td>{row.l}</td>
                      <td>{row.gf}</td>
                      <td>{row.ga}</td>
                      <td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                      <td className="pts">{row.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
      </div>
      <ThirdPlaceTable groups={groups} />
    </div>
  )
}
