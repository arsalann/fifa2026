import { useEffect, useMemo, useState } from 'react'
import teams from '../data/bruin/teams.json'
import { fetchMatchFacts } from '../lib/espn'
import { matchStatus, finalScore, isInPlay, useData } from '../lib/data.jsx'
import { computeGroups } from '../lib/standings'
import { STADIUMS, fmtDateLong, fmtTime, shortCity, liveLabel } from '../lib/format'

const FACTS_POLL_MS = 30 * 1000
const STAT_LABELS = {
  totalshots: 'Shots',
  shotsontarget: 'Shots on target',
  possessionpct: 'Possession',
  woncorners: 'Corners',
  foulscommitted: 'Fouls',
  shotassists: 'Key passes',
  goalassists: 'Assists',
}
const STAT_ORDER = [
  'totalshots',
  'shotsontarget',
  'possessionpct',
  'woncorners',
  'foulscommitted',
  'shotassists',
  'goalassists',
]

function statKey(label) {
  return String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function prettyStatLabel(label) {
  const key = statKey(label)
  if (STAT_LABELS[key]) return STAT_LABELS[key]
  return String(label ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function statNumber(value) {
  const n = Number(String(value ?? '').replace('%', ''))
  return Number.isFinite(n) ? n : null
}

function displayStats(stats) {
  return (stats ?? [])
    .map((s, index) => ({
      ...s,
      key: statKey(s.label),
      label: prettyStatLabel(s.label),
      order: STAT_ORDER.indexOf(statKey(s.label)),
      index,
    }))
    .filter((s) => s.key !== 'appearances' && s.key !== 'totalgoals')
    .sort((a, b) => {
      const ao = a.order === -1 ? 999 : a.order
      const bo = b.order === -1 ? 999 : b.order
      return ao - bo || a.index - b.index
    })
}

function ordinal(n) {
  if (!n) return null
  const mod10 = n % 10
  const mod100 = n % 100
  const suffix = mod10 === 1 && mod100 !== 11 ? 'st' : mod10 === 2 && mod100 !== 12 ? 'nd' : mod10 === 3 && mod100 !== 13 ? 'rd' : 'th'
  return `${n}${suffix}`
}

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
            <span aria-hidden="true">⚽</span> {g.name}
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
  const { matches } = useData()
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
  const groups = useMemo(() => computeGroups(matches), [matches])
  const groupRows = match.stage === 'group' ? groups[match.group] ?? [] : []
  const pos1 = ordinal(groupRows.findIndex((r) => r.team === match.team1) + 1)
  const pos2 = ordinal(groupRows.findIndex((r) => r.team === match.team2) + 1)
  const stats = useMemo(() => displayStats(facts?.stats), [facts?.stats])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="sheet-title">
          <span>FIFA World Cup 2026</span>
          {live && <strong>{liveLabel(status, live.clock)}</strong>}
        </div>
        <div className="sheet-head">
          <div className="sheet-team">
            <span className="flag big">{t1?.flag ?? '·'}</span>
            <span>{match.team1}</span>
            {pos1 && <small>{pos1}</small>}
          </div>
          <div className="sheet-score">
            {score ? (
              <>
                <div className="score">
                  <span>{score[0]}</span>
                  <span className="score-dash">-</span>
                  <span>{score[1]}</span>
                </div>
                {pens && (
                  <div className="score-note">
                    {pens[0]}–{pens[1]} pens
                  </div>
                )}
                {status === 'ft' && ht && (
                  <div className="score-note">HT {ht[0]} – {ht[1]}</div>
                )}
              </>
            ) : (
              <div className="kickoff-time">{fmtTime(match.kickoff)}</div>
            )}
            <div className="sheet-stage">
              {match.stage === 'group' ? `Group Stage · Group ${match.group}` : match.stage}
            </div>
          </div>
          <div className="sheet-team">
            <span className="flag big">{t2?.flag ?? '·'}</span>
            <span>{match.team2}</span>
            {pos2 && <small>{pos2}</small>}
          </div>
        </div>

        <GoalTimeline match={match} />

        <div className="facts-panel">
          {hasStats ? (
            <section className="facts-stats-block">
              <div className="facts-stats-head">
                <span className="flag">{t1?.flag ?? '·'}</span>
                <h3>Team stats</h3>
                <span className="flag">{t2?.flag ?? '·'}</span>
              </div>
              <div className="facts-stat-list">
                {stats.map((s, i) => {
                  const a = statNumber(s.a)
                  const b = statNumber(s.b)
                  const leftLeader = a != null && b != null && a > b
                  const rightLeader = a != null && b != null && b > a
                  return (
                    <div className="facts-stat-row" key={`${s.key}-${i}`}>
                      <span className={`facts-value left ${leftLeader ? 'leader' : ''}`}>{s.a}</span>
                      <span className="facts-stat-name">{s.label}</span>
                      <span className={`facts-value right ${rightLeader ? 'leader' : ''}`}>{s.b}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : error ? (
            <p className="hint center">Detailed stats aren’t available for this match yet.</p>
          ) : (
            <p className="hint center">Loading match stats...</p>
          )}
        </div>

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
