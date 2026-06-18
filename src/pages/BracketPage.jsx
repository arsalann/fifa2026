import { useMemo } from 'react'
import { useData } from '../lib/data.jsx'
import MatchCard from '../components/MatchCard'

const ROUNDS = [
  ['r32', 'Round of 32'],
  ['r16', 'Round of 16'],
  ['qf', 'Quarter-finals'],
  ['sf', 'Semi-finals'],
  ['third', 'Third place'],
  ['final', 'Final'],
]

export default function BracketPage() {
  const { matches } = useData()
  const byStage = useMemo(() => {
    const map = {}
    for (const m of matches) {
      if (m.stage === 'group') continue
      ;(map[m.stage] ??= []).push(m)
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0))
    }
    return map
  }, [matches])

  return (
    <div className="page">
      <p className="hint">
        Slots fill in automatically as the group stage and earlier rounds finish.
        “Winner of Match N” refers to the match numbers shown on each card.
      </p>
      {ROUNDS.map(([stage, label]) => (
        <section key={stage} className="bracket-round">
          <h2>{label}</h2>
          {(byStage[stage] ?? []).map((m) => (
            <MatchCard key={m.key} match={m} showDate />
          ))}
        </section>
      ))}
    </div>
  )
}
