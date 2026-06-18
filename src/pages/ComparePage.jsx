import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import teams from '../data/bruin/teams.json'
import { useData, matchStatus } from '../lib/data.jsx'
import { teamTournamentRecord } from '../lib/standings'
import { track } from '../lib/analytics'
import MatchCard from '../components/MatchCard'

const bySlug = Object.fromEntries(Object.entries(teams).map(([name, t]) => [t.slug, name]))

function Picker({ value, onChange, exclude }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Pick a team…</option>
      {Object.entries(teams)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, t]) => (
          <option key={t.slug} value={t.slug} disabled={t.slug === exclude}>
            {t.flag} {name}
          </option>
        ))}
    </select>
  )
}

function Row({ label, a, b }) {
  return (
    <tr>
      <td className="cmp-a">{a}</td>
      <th>{label}</th>
      <td className="cmp-b">{b}</td>
    </tr>
  )
}

export default function ComparePage() {
  const [params, setParams] = useSearchParams()
  const { matches } = useData()
  const slugA = params.get('a')
  const slugB = params.get('b')
  const nameA = bySlug[slugA]
  const nameB = bySlug[slugB]

  useEffect(() => {
    if (nameA && nameB) track('teams_compared', { a: nameA, b: nameB })
  }, [nameA, nameB])

  const set = (key) => (slug) => {
    const next = new URLSearchParams(params)
    if (slug) next.set(key, slug)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const meeting = useMemo(
    () =>
      nameA && nameB
        ? matches.find(
            (m) =>
              (m.team1 === nameA && m.team2 === nameB) ||
              (m.team1 === nameB && m.team2 === nameA),
          )
        : null,
    [matches, nameA, nameB],
  )

  const tA = nameA ? teams[nameA] : null
  const tB = nameB ? teams[nameB] : null
  const recA = nameA ? teamTournamentRecord(matches, nameA) : null
  const recB = nameB ? teamTournamentRecord(matches, nameB) : null

  return (
    <div className="page">
      <h2>⚖️ Head-to-head</h2>
      <div className="cmp-pickers">
        <Picker value={slugA} onChange={set('a')} exclude={slugB} />
        <span className="vs">vs</span>
        <Picker value={slugB} onChange={set('b')} exclude={slugA} />
      </div>

      {tA && tB ? (
        <>
          <div className="cmp-heads">
            <Link to={`/team/${slugA}`} className="cmp-head">
              <span className="flag huge">{tA.flag}</span>
              <span>{nameA}</span>
            </Link>
            <Link to={`/team/${slugB}`} className="cmp-head">
              <span className="flag huge">{tB.flag}</span>
              <span>{nameB}</span>
            </Link>
          </div>
          <table className="cmp-table card">
            <tbody>
              <Row label="WC titles" a={tA.titles.length || '—'} b={tB.titles.length || '—'} />
              <Row
                label="Appearances"
                a={tA.history.length + 1}
                b={tB.history.length + 1}
              />
              <Row label="First WC" a={tA.firstAppearance} b={tB.firstAppearance} />
              <Row label="Best finish" a={tA.bestFinish} b={tB.bestFinish} />
              <Row
                label="All-time WC top scorer"
                a={tA.topScorer ? `${tA.topScorer.name} (${tA.topScorer.goals})` : '—'}
                b={tB.topScorer ? `${tB.topScorer.name} (${tB.topScorer.goals})` : '—'}
              />
              <Row
                label="2026 record (W-D-L)"
                a={`${recA.w}-${recA.d}-${recA.l}`}
                b={`${recB.w}-${recB.d}-${recB.l}`}
              />
              <Row label="2026 goals (for/against)" a={`${recA.gf}/${recA.ga}`} b={`${recB.gf}/${recB.ga}`} />
            </tbody>
          </table>
          {meeting && (
            <>
              <h3>
                They {matchStatus(meeting) === 'ft' ? 'met' : 'meet'} at this World Cup
              </h3>
              <MatchCard match={meeting} showDate />
            </>
          )}
        </>
      ) : (
        <p className="hint">Pick two teams to compare their World Cup pedigree and 2026 form.</p>
      )}
    </div>
  )
}
