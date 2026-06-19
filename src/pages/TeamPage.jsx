import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import teams from '../data/bruin/teams.json'
import { useData } from '../lib/data.jsx'
import { computeGroups, teamTournamentRecord } from '../lib/standings'
import { goldenBoot } from '../lib/scorers'
import { useFavorite } from '../lib/prefs'
import { track } from '../lib/analytics'
import { flattenTeamMarkets, formatProbability, formatVolume } from '../lib/betting'
import MatchCard from '../components/MatchCard'
import Lineup from '../components/Lineup'

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function MarketRow({ market }) {
  const volume = formatVolume(market.volume)
  return (
    <div className="market-row">
      <div>
        <div className="market-row-main">
          {market.label} · {market.source}
        </div>
        {volume && <div className="market-row-sub">{volume}</div>}
      </div>
      <strong>{formatProbability(market.probability)}</strong>
    </div>
  )
}

export default function TeamPage() {
  const { slug } = useParams()
  const { matches, betting } = useData()
  const [favorite, setFavorite] = useFavorite()

  const entry = Object.entries(teams).find(([, t]) => t.slug === slug)
  const name = entry?.[0] ?? null

  const teamMatches = useMemo(
    () =>
      matches
        .filter((m) => m.team1 === name || m.team2 === name)
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    [matches, name],
  )
  const groups = useMemo(() => computeGroups(matches), [matches])
  const groupName = teamMatches.find((m) => m.group)?.group
  const groupRows = groupName ? groups[groupName] : null
  const pos = groupRows ? groupRows.findIndex((r) => r.team === name) + 1 : 0
  const row = groupRows?.find((r) => r.team === name)
  const rec = useMemo(() => teamTournamentRecord(matches, name), [matches, name])

  const scorers = useMemo(() => goldenBoot(matches).filter((s) => s.team === name), [matches, name])
  const markets = useMemo(
    () => flattenTeamMarkets(betting?.teamMarkets?.[name]).slice(0, 5),
    [betting, name],
  )

  useEffect(() => {
    if (name) track('team_viewed', { team: name })
  }, [name])

  if (!entry) {
    return (
      <div className="page">
        <p className="hint">Team not found.</p>
        <Link to="/teams">← All teams</Link>
      </div>
    )
  }
  const t = entry[1]
  const isFav = favorite === name
  const appearances = t.history.length + 1 // + 2026

  return (
    <div className="page">
      <header className="team-header">
        <span className="flag huge">{t.flag}</span>
        <div>
          <h2>{name}</h2>
          <div className="team-sub">
            {t.nickname} · {t.confederation}
            {groupName && (
              <>
                {' · '}
                <Link to="/">Group {groupName}</Link>
              </>
            )}
          </div>
        </div>
        <button
          className={`star-btn${isFav ? ' on' : ''}`}
          onClick={() => {
            track(isFav ? 'favorite_cleared' : 'favorite_set', { team: name })
            setFavorite(isFav ? null : name)
          }}
          aria-label={isFav ? 'Remove favorite' : 'Set as favorite team'}
        >
          {isFav ? '★' : '☆'}
        </button>
      </header>

      <section className="card">
        <h3>World Cup 2026</h3>
        <div className="stat-grid">
          <Stat label={groupName ? `Group ${groupName} position` : 'Position'} value={pos ? `${pos} / 4` : '—'} />
          <Stat label="Points (group)" value={row?.pts ?? 0} />
          <Stat label="Record (W-D-L)" value={`${rec.w}-${rec.d}-${rec.l}`} />
          <Stat label="Goals for / against" value={`${rec.gf} / ${rec.ga}`} />
        </div>
        {markets.length > 0 && (
          <>
            <h4>Market view</h4>
            <div className="market-list">
              {markets.map((market) => (
                <MarketRow
                  key={`${market.source}-${market.type}-${market.label}`}
                  market={market}
                />
              ))}
            </div>
          </>
        )}
        {scorers.length > 0 && (
          <>
            <h4>2026 goalscorers</h4>
            <ul className="scorer-list">
              {scorers.map((s) => (
                <li key={s.name}>
                  ⚽ {s.name} — {s.goals}
                  {s.pens > 0 ? ` (${s.pens} pen)` : ''}
                </li>
              ))}
            </ul>
          </>
        )}
        <h4>Matches</h4>
        {teamMatches.map((m) => (
          <MatchCard key={m.key} match={m} showDate />
        ))}
      </section>

      <Lineup team={name} matches={teamMatches} />

      <section className="card">
        <h3>World Cup history</h3>
        <div className="stat-grid">
          <Stat label="Appearances (incl. 2026)" value={appearances} />
          <Stat label="Titles" value={t.titles.length > 0 ? `🏆 ${t.titles.join(', ')}` : '—'} />
          <Stat label="First appearance" value={t.firstAppearance} />
          <Stat label="Best finish" value={t.bestFinish} />
        </div>
        {t.topScorer && (
          <p className="kv">
            <strong>All-time WC top scorer:</strong> {t.topScorer.name} ({t.topScorer.goals})
          </p>
        )}
        {t.legend && (
          <p className="kv">
            <strong>Icon:</strong> {t.legend}
          </p>
        )}
        {t.history.length > 0 ? (
          <>
            <h4>Past tournaments</h4>
            <table className="history-table">
              <tbody>
                {[...t.history].reverse().map((h) => (
                  <tr key={h.year}>
                    <td className="year">{h.year}</td>
                    <td>
                      {h.result}
                      {/Champions/.test(h.result) && ' 🏆'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="hint">2026 is their first ever World Cup. 🎉</p>
        )}
      </section>

      <section className="card">
        <h3>Did you know?</h3>
        <ul className="facts">
          {t.facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        <p className="hint">Historical data via Wikipedia / FIFA records (through 2022).</p>
      </section>

      <Link className="compare-link" to={`/compare?a=${t.slug}`}>
        ⚖️ Compare {name} with another team →
      </Link>
    </div>
  )
}
