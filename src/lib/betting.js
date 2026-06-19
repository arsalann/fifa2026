export function formatProbability(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const pct = Number(value) * 100
  if (pct > 0 && pct < 1) return '<1%'
  return `${Math.round(pct)}%`
}

export function formatProbabilityShort(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const pct = Number(value) * 100
  if (pct > 0 && pct < 1) return '<1'
  return String(Math.round(pct))
}

export function formatExpectedGoals(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(1)
}

export function formatVolume(value) {
  if (value == null || Number.isNaN(Number(value))) return null
  const n = Number(value)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M vol`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K vol`
  return `$${Math.round(n)} vol`
}

export function flattenTeamMarkets(markets) {
  if (!markets) return []
  return [
    ...(markets.winner ?? []),
    ...(markets.advance ?? []),
    ...(markets.group_winner ?? []),
  ].filter((market) => market?.probability != null)
}

export function winnerConsensus(markets) {
  const rows = (markets?.winner ?? []).filter((market) => market?.probability != null)
  if (rows.length < 2) return null
  const probabilities = rows.map((market) => Number(market.probability))
  const average = probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length
  const high = rows.reduce((best, market) =>
    Number(market.probability) > Number(best.probability) ? market : best,
  )
  const low = rows.reduce((best, market) =>
    Number(market.probability) < Number(best.probability) ? market : best,
  )
  return {
    average,
    spread: Number(high.probability) - Number(low.probability),
    high,
    low,
    count: rows.length,
  }
}

export function advanceProbability(markets) {
  const rows = (markets?.advance ?? []).filter((market) => market?.probability != null)
  if (rows.length === 0) return null
  return rows.reduce((best, market) =>
    Number(market.probability) > Number(best.probability) ? market : best,
  )
}
