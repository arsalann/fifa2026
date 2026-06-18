import { useEffect, useState } from 'react'
import teams from '../data/bruin/teams.json'
import { fetchMatchFacts } from '../lib/espn'
import { matchStatus, finalScore, isInPlay } from '../lib/data.jsx'
import { STADIUMS, fmtDateLong, fmtTime, shortCity, liveLabel } from '../lib/format'

const FACTS_POLL_MS = 30 * 1000

function GoalTimeline({ match }) {
  const rows = []
  for (const [goals, team, side] of [
    [match.goals1, match.team1, 'a'],
    [match.goals2, match.team2, 'b'],
  ]) {
    for (const g of goals ?? []) rows.push({ ...g, team, side })
  }
  if (rows.length === 0) return null
  rows.sort((x, y) => (x.minute ?? 0) - (y.minute ?? 0))
  return (
    <div className="facts-goals">
      {rows.map((g, i) => (
        <div key={i} className={`facts-goal ${g.side}`}>
          <span>
            ⚽ {g.name}
            {g.minute != null ? ` ${g.minute}'` : ''}
            {g.penalty ? ' (pen)' : ''}
            {g.owngoal ? ' (og)' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function MatchFacts({ match, onClose }) {
  const [facts, setFacts] = useState(null)
  const [error, setError] = useState(false)

  // Fetch facts on open, and while the match is in play re-poll for live
  // stats — without flicking back to the loading state on each refresh.
  useEffect(() => {
    let alive = true
    if (!match.espnId) {
      setError(true)
      return
    }
    const load = () =>
      fetchMatchFacts(match)
        .then((f) => alive && f && setFacts(f))
        .catch(() => alive && setError(true))
    load()
    const timer = isInPlay(matchStatus(match)) ? setInterval(load, FACTS_POLL_MS) : null
    return () => {
      alive = false
      if (timer) clearInterval(timer)
    }
    // espnId is the stable identity; match object changes each poll but the
    // fetch target doesn't, so we avoid resetting the interval every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.espnId])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const status = matchStatus(match)
  const final = finalScore(match)
  const live = !final && isInPlay(status) ? match.live : null
  const score = final ?? live?.score ?? match.score?.ht
  const ht = match.score?.ht
  const pens = match.score?.p
  const t1 = teams[match.team1]
  const t2 = teams[match.team2]
  const stadium = STADIUMS[match.city]
  const hasStats = facts && facts.stats.length > 0

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="sheet-head">
          <div className="sheet-team">
            <span className="flag big">{t1?.flag ?? '·'}</span>
            <span>{match.team1}</span>
          </div>
          <div className="sheet-score">
            {score ? (
              <>
                <div className="score">
                  {score[0]} – {score[1]}
                </div>
                {pens && (
                  <div className="score-note">
                    {pens[0]}–{pens[1]} pens
                  </div>
                )}
                {status === 'ft' && ht && (
                  <div className="score-note">HT {ht[0]} – {ht[1]}</div>
                )}
                {live && (
                  <div className="score-note live-note">
                    <span className="live-dot" />
                    {liveLabel(status, live.clock)}
                  </div>
                )}
              </>
            ) : (
              <div className="kickoff-time">{fmtTime(match.kickoff)}</div>
            )}
          </div>
          <div className="sheet-team">
            <span className="flag big">{t2?.flag ?? '·'}</span>
            <span>{match.team2}</span>
          </div>
        </div>

        <GoalTimeline match={match} />

        {hasStats ? (
          <table className="facts-stats">
            <tbody>
              {facts.stats.map((s, i) => (
                <tr key={i}>
                  <td className="va">{s.a}</td>
                  <th>{s.label}</th>
                  <td className="vb">{s.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : error ? (
          <p className="hint center">
            Detailed stats aren’t available for this match (yet).
          </p>
        ) : (
          <p className="hint center">Loading match stats…</p>
        )}

        <div className="facts-info">
          {(facts?.info ?? []).map(([k, v]) => (
            <div key={k}>
              <strong>{k}:</strong> {v}
            </div>
          ))}
          {!facts?.info?.some(([k]) => k === 'Venue') && (
            <div>
              <strong>Venue:</strong> {stadium ? `${stadium}, ` : ''}
              {shortCity(match.city)}
            </div>
          )}
          <div>
            <strong>Date:</strong> {fmtDateLong(match.kickoff)} · {fmtTime(match.kickoff)}
          </div>
        </div>
      </div>
    </div>
  )
}
