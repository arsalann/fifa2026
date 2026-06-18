import { useState } from 'react'
import TeamTag from './TeamTag'
import MatchFacts from './MatchFacts'
import { matchStatus, finalScore, isInPlay } from '../lib/data.jsx'
import { STADIUMS, fmtTime, fmtDate, shortCity, liveLabel } from '../lib/format'
import { track } from '../lib/analytics'

// In-play badge: a pulsing red dot + minute clock (amber, no pulse, at HT).
function LiveBadge({ status, clock }) {
  const atBreak = status === 'ht'
  return (
    <span className={`badge live-badge${atBreak ? ' paused' : ''}`}>
      {!atBreak && <span className="live-dot" />}
      {liveLabel(status, clock)}
    </span>
  )
}

export default function MatchCard({ match, showDate = false, highlight = false }) {
  const [factsOpen, setFactsOpen] = useState(false)
  const status = matchStatus(match)
  const final = finalScore(match)
  const ht = match.score?.ht
  const pens = match.score?.p
  // a live snapshot only counts while the match is actually in play
  const live = !final && isInPlay(status) ? match.live : null

  // Tapping the card opens match facts once there's something to show;
  // team names (links inside) still navigate to team pages.
  const openable =
    status !== 'upcoming' &&
    Boolean(match.espnId || final || ht || match.goals1?.length || match.goals2?.length)

  const label = match.group ? `Group ${match.group}` : match.round
  const stadium = STADIUMS[match.city]

  const openFacts = () => {
    track('match_facts_opened', { stage: match.stage, status })
    setFactsOpen(true)
  }

  return (
    <>
      <div
        className={`match-card${highlight ? ' fav' : ''}${openable ? ' tappable' : ''}${
          live ? ' is-live' : ''
        }`}
        onClick={openable ? openFacts : undefined}
      >
        <div className="match-meta">
          <span>
            {label}
            {match.matchNumber ? ` · M${match.matchNumber}` : ''}
          </span>
          <span>
            {stadium ? `${stadium}, ` : ''}
            {shortCity(match.city)}
          </span>
        </div>
        <div className="match-main">
          <div className="side home" onClick={(e) => e.stopPropagation()}>
            <TeamTag name={match.team1} bold />
          </div>
          <div className="center">
            {final ? (
              <>
                <div className="score">
                  {final[0]} – {final[1]}
                </div>
                {pens ? (
                  <div className="score-note">
                    {pens[0]}–{pens[1]} pens
                  </div>
                ) : match.score?.et ? (
                  <div className="score-note">aet</div>
                ) : null}
                <span className="badge ft">FT</span>
              </>
            ) : live?.score ? (
              <>
                <div className="score live-score">
                  {live.score[0]} – {live.score[1]}
                </div>
                <LiveBadge status={status} clock={live.clock} />
              </>
            ) : ht ? (
              <>
                <div className="score">
                  {ht[0]} – {ht[1]}
                </div>
                <LiveBadge status={status} clock={null} />
              </>
            ) : (
              <>
                <div className="kickoff">
                  {showDate && <div className="kickoff-date">{fmtDate(match.kickoff)}</div>}
                  <div className="kickoff-time">{fmtTime(match.kickoff)}</div>
                </div>
                {isInPlay(status) && <LiveBadge status={status} clock={live?.clock ?? null} />}
                {status === 'pending' && <span className="badge pending">Result pending</span>}
              </>
            )}
          </div>
          <div className="side away" onClick={(e) => e.stopPropagation()}>
            <TeamTag name={match.team2} bold />
          </div>
        </div>
        {openable && <div className="match-foot">Match facts ›</div>}
      </div>
      {factsOpen && <MatchFacts match={match} onClose={() => setFactsOpen(false)} />}
    </>
  )
}
