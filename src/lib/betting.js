export function formatProbability(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const pct = Number(value) * 100
  if (pct > 0 && pct < 1) return '<1%'
  return `${Math.round(pct)}%`
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
