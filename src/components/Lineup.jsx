import { useEffect, useState } from 'react'
import { fetchLineups, POSITION_GROUPS } from '../lib/espn'
import { fmtDate } from '../lib/format'

const TWO_HOURS = 2 * 3600e3

function CaptainBadge() {
  return (
    <span className="cap-badge" title="Captain" aria-label="Captain">
      C
    </span>
  )
}

function PlayerRow({ p }) {
  return (
    <li className="lineup-row">
      <span className="player-num">{p.number ?? '–'}</span>
      <span className="player-name">{p.name}</span>
      {p.captain && <CaptainBadge />}
    </li>
  )
}

export default function Lineup({ team, matches }) {
  // null = loading, false = none available, object = { starters, bench, match }
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    setData(null)
    const now = Date.now()
    // The team's most recent matches whose lineup could be published (started,
    // or kicking off within ~2h). Newest first; try until one yields an XI.
    const candidates = matches
      .filter(
        (m) =>
          (m.team1 === team || m.team2 === team) &&
          m.espnId &&
          new Date(m.kickoff).getTime() <= now + TWO_HOURS,
      )
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
      .slice(0, 4)

    ;(async () => {
      for (const m of candidates) {
        try {
          const lineups = await fetchLineups(m)
          const mine = lineups?.[team]
          if (mine && mine.starters.length > 0) {
            if (alive) setData({ ...mine, match: m })
            return
          }
        } catch {
          /* try the next-most-recent match */
        }
      }
      if (alive) setData(false)
    })()

    return () => {
      alive = false
    }
  }, [team, matches])

  if (data === null) {
    return (
      <section className="card">
        <h3>Lineup</h3>
        <p className="hint">Loading lineup…</p>
      </section>
    )
  }
  if (data === false) {
    return (
      <section className="card">
        <h3>Lineup</h3>
        <p className="hint">
          The starting XI appears here once a match lineup is published (about an hour
          before kickoff).
        </p>
      </section>
    )
  }

  const { starters, bench, match } = data
  const opponent = match.team1 === team ? match.team2 : match.team1
  const groups = POSITION_GROUPS.map(([key, label]) => [
    label,
    starters.filter((p) => p.group === key),
  ]).filter(([, list]) => list.length > 0)

  return (
    <section className="card">
      <h3>Lineup</h3>
      <p className="lineup-caption">
        Starting XI from {fmtDate(match.kickoff)} vs {opponent}
      </p>
      {groups.map(([label, list]) => (
        <div className="lineup-group" key={label}>
          <h4>{label}</h4>
          <ul className="lineup-list">
            {list.map((p, i) => (
              <PlayerRow key={`${p.number}-${i}`} p={p} />
            ))}
          </ul>
        </div>
      ))}
      {bench.length > 0 && (
        <div className="lineup-group">
          <h4>Reserves</h4>
          <ul className="lineup-list">
            {bench.map((p, i) => (
              <PlayerRow key={`${p.number}-${i}`} p={p} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
