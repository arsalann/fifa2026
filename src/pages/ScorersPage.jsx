import { useMemo } from 'react'
import { useData } from '../lib/data.jsx'
import { goldenBoot, tournamentTotals } from '../lib/scorers'
import { formatProbability, formatVolume } from '../lib/betting'
import teams from '../data/bruin/teams.json'

function GoldenBootMarkets({ markets }) {
  if (!markets?.length) return null
  return (
    <section className="card">
      <h3>Market favorites</h3>
      <div className="market-list">
        {markets.slice(0, 8).map((market) => {
          const volume = formatVolume(market.volume)
          return (
            <div className="market-row" key={market.marketId}>
              <div>
                <div className="market-row-main">{market.label}</div>
                <div className="market-row-sub">
                  {market.source}
                  {volume ? ` · ${volume}` : ''}
                </div>
              </div>
              <strong>{formatProbability(market.probability)}</strong>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function ScorersPage() {
  const { matches, betting } = useData()
  const boot = useMemo(() => goldenBoot(matches), [matches])
  const totals = useMemo(() => tournamentTotals(matches), [matches])

  return (
    <div className="page">
      <h2>👟 Golden Boot race</h2>
      <div className="stat-grid three">
        <div className="stat">
          <div className="stat-value">{totals.played}</div>
          <div className="stat-label">Matches played</div>
        </div>
        <div className="stat">
          <div className="stat-value">{totals.goals}</div>
          <div className="stat-label">Goals scored</div>
        </div>
        <div className="stat">
          <div className="stat-value">
            {totals.played ? (totals.goals / totals.played).toFixed(2) : '—'}
          </div>
          <div className="stat-label">Goals per match</div>
        </div>
      </div>
      <GoldenBootMarkets markets={betting?.goldenBoot} />
      {boot.length === 0 ? (
        <p className="hint">
          No goals yet — the leaderboard fills in as soon as matches are played. Scores and
          scorers update at half-time and full-time.
        </p>
      ) : (
        <table className="boot-table card">
          <thead>
            <tr>
              <th className="pos">#</th>
              <th className="player-col">Player</th>
              <th className="team-col">Team</th>
              <th>Goals</th>
              <th>Pens</th>
            </tr>
          </thead>
          <tbody>
            {boot.slice(0, 30).map((s, i) => (
              <tr key={`${s.name}|${s.team}`}>
                <td className="pos">{i + 1}</td>
                <td className="player-col">{s.name}</td>
                <td className="team-col">
                  <span className="flag">{teams[s.team]?.flag}</span> {s.team}
                </td>
                <td className="pts">{s.goals}</td>
                <td>{s.pens || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint">Own goals don’t count toward a player’s tally.</p>
    </div>
  )
}
