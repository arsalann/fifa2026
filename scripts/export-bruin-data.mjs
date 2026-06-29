import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const dbPath = process.env.WORLDCUP_DUCKDB_PATH
  ? resolve(process.env.WORLDCUP_DUCKDB_PATH)
  : null
const bruinConnection = process.env.WORLDCUP_BRUIN_QUERY_CONNECTION ?? 'motherduck-fifa'
const bruinConfigFile = process.env.WORLDCUP_BRUIN_CONFIG_FILE ?? '.bruin.yml'
const schedulePath = resolve(
  process.env.WORLDCUP_BRUIN_SCHEDULE_PATH ?? 'src/data/bruin/schedule.json',
)
const teamsPath = resolve(process.env.WORLDCUP_BRUIN_TEAMS_PATH ?? 'src/data/bruin/teams.json')
const detailsPath = resolve(
  process.env.WORLDCUP_BRUIN_DETAILS_PATH ?? 'src/data/bruin/details.json',
)
const publicSchedulePath = resolve(
  process.env.WORLDCUP_PUBLIC_BRUIN_SCHEDULE_PATH ?? 'public/data/bruin/schedule.json',
)
const publicTeamsPath = resolve(
  process.env.WORLDCUP_PUBLIC_BRUIN_TEAMS_PATH ?? 'public/data/bruin/teams.json',
)
const publicDetailsPath = resolve(
  process.env.WORLDCUP_PUBLIC_BRUIN_DETAILS_PATH ?? 'public/data/bruin/details.json',
)
const queryMaxBuffer = 256 * 1024 * 1024

function parseCommandJson(output) {
  const text = String(output ?? '').trim()
  const objectStart = text.indexOf('{')
  const arrayStart = text.indexOf('[')
  const starts = [objectStart, arrayStart].filter((index) => index >= 0)
  const start = starts.length ? Math.min(...starts) : -1
  return JSON.parse(start >= 0 ? text.slice(start) : text || '[]')
}

function query(sql) {
  if (dbPath) {
    const out = execFileSync('duckdb', ['-readonly', dbPath, '-json', sql], {
      encoding: 'utf8',
      maxBuffer: queryMaxBuffer,
    })
    return parseCommandJson(out)
  }

  const out = execFileSync(
    'bruin',
    [
      'query',
      '--config-file',
      bruinConfigFile,
      '--connection',
      bruinConnection,
      '--output',
      'json',
      '--description',
      'exporting app-ready World Cup data',
      '--query',
      sql,
    ],
    { encoding: 'utf8', maxBuffer: queryMaxBuffer },
  )
  const parsed = parseCommandJson(out)
  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed.rows) && Array.isArray(parsed.columns)) {
    const columnNames = parsed.columns.map((column) =>
      typeof column === 'string' ? column : column.name,
    )
    return parsed.rows.map((row) =>
      Array.isArray(row)
        ? Object.fromEntries(columnNames.map((name, index) => [name, row[index]]))
        : row,
    )
  }
  return parsed.rows ?? parsed.data ?? []
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function numberOrNull(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function marketRow(row) {
  return {
    source: row.source,
    type: row.market_type,
    label: row.label ?? row.outcome,
    probability: numberOrNull(row.probability),
    bid: numberOrNull(row.bid),
    ask: numberOrNull(row.ask),
    lastPrice: numberOrNull(row.last_price),
    volume: numberOrNull(row.volume),
    marketId: row.market_id ?? null,
    question: row.question ?? null,
    url: row.url ?? null,
  }
}

function rankedMarketRow(row) {
  return {
    rank: Number(row.rank),
    source: row.source,
    label: row.label,
    probability: numberOrNull(row.probability),
    bid: numberOrNull(row.bid),
    ask: numberOrNull(row.ask),
    lastPrice: numberOrNull(row.last_price),
    volume: numberOrNull(row.volume),
    marketId: row.market_id ?? null,
    question: row.question ?? null,
    url: row.url ?? null,
  }
}

function matchMarketSummary(row) {
  return {
    source: row.source,
    result: {
      team1: numberOrNull(row.team1_win_probability),
      draw: numberOrNull(row.draw_probability),
      team2: numberOrNull(row.team2_win_probability),
    },
    expectedGoals: {
      team1: numberOrNull(row.expected_team1_goals),
      team2: numberOrNull(row.expected_team2_goals),
    },
    over25: numberOrNull(row.over_2_5_probability),
    bothTeamsScore: numberOrNull(row.both_teams_score_probability),
    cleanSheet: {
      team1: numberOrNull(row.team1_clean_sheet_probability),
      team2: numberOrNull(row.team2_clean_sheet_probability),
    },
    topOutcome: row.top_outcome ?? null,
    topProbability: numberOrNull(row.top_probability),
    marketTotalProbability: numberOrNull(row.market_total_probability),
    outcomesCount: Number(row.outcomes_count ?? 0),
  }
}

function score(row) {
  if (row.team1_score == null || row.team2_score == null) return parseJson(row.reference_score)
  const value = { ft: [Number(row.team1_score), Number(row.team2_score)] }
  if (row.team1_ht_score != null && row.team2_ht_score != null) {
    value.ht = [Number(row.team1_ht_score), Number(row.team2_ht_score)]
  }
  return value
}

function liveState(row) {
  if (row.status_state === 'post') return 'ft'
  if (row.status_name === 'STATUS_HALFTIME') return 'ht'
  if (row.status_state === 'in') {
    if (row.status_period === 1) return '1h'
    if (row.status_period === 2) return '2h'
    return 'live'
  }
  return null
}

function parseMinute(clockText) {
  const m = /(\d+)/.exec(String(clockText ?? ''))
  return m ? parseInt(m[1], 10) : null
}

function goalsFromCompetition(competition) {
  const competitors = competition?.competitors ?? []
  const home = competitors.find((c) => c.homeAway === 'home') ?? competitors[0]
  const homeId = String(home?.team?.id ?? home?.id ?? '')
  const goals = [[], []]

  for (const d of competition?.details ?? []) {
    if (!d?.scoringPlay) continue
    const text = d.type?.text ?? ''
    if (/shootout/i.test(text)) continue
    const entry = {
      name: d.athletesInvolved?.[0]?.displayName ?? 'Goal',
      minute: parseMinute(d.clock?.displayValue),
    }
    if (d.penaltyKick || /penalty/i.test(text)) entry.penalty = true
    if (d.ownGoal || /own goal/i.test(text)) entry.owngoal = true
    goals[String(d.team?.id) === homeId ? 0 : 1].push(entry)
  }

  return goals
}

function goals(row) {
  const reference = [parseJson(row.reference_goals1), parseJson(row.reference_goals2)]
  const competition = parseJson(row.competitions, [])?.[0]
  const [homeGoals, awayGoals] = goalsFromCompetition(competition)
  if (!homeGoals.length && !awayGoals.length) return reference
  return row.team1_espn_name === row.home_team ? [homeGoals, awayGoals] : [awayGoals, homeGoals]
}

function displayStat(stat) {
  return {
    name: stat.name ?? stat.label ?? stat.abbreviation,
    label: stat.label ?? stat.displayName ?? stat.name ?? stat.abbreviation,
    displayValue: stat.displayValue ?? stat.value ?? '–',
  }
}

function summaryTeam(team) {
  return {
    displayName: team?.displayName ?? team?.name ?? null,
    name: team?.name ?? null,
    id: team?.id ?? null,
  }
}

function rosterPlayer(player) {
  return {
    starter: Boolean(player.starter),
    captain: Boolean(player.captain ?? player.athlete?.captain),
    jersey: player.jersey ?? player.athlete?.jersey ?? null,
    athlete: {
      displayName: player.athlete?.displayName ?? player.athlete?.shortName ?? null,
      shortName: player.athlete?.shortName ?? null,
    },
    position: player.position
      ? {
          name: player.position.name ?? null,
          displayName: player.position.displayName ?? null,
          abbreviation: player.position.abbreviation ?? null,
        }
      : null,
  }
}

function summaryFromEspnSummary(json, fallback = null) {
  return {
    boxscore: {
      teams:
        json?.boxscore?.teams?.map((team) => ({
          team: summaryTeam(team.team),
          statistics: (team.statistics ?? []).map(displayStat),
        })) ??
        fallback?.boxscore?.teams ??
        [],
    },
    gameInfo: {
      venue: {
        fullName:
          json?.gameInfo?.venue?.fullName ??
          json?.gameInfo?.venue?.displayName ??
          fallback?.gameInfo?.venue?.fullName ??
          null,
        address: {
          city:
            json?.gameInfo?.venue?.address?.city ??
            fallback?.gameInfo?.venue?.address?.city ??
            null,
        },
      },
      attendance: json?.gameInfo?.attendance ?? fallback?.gameInfo?.attendance ?? null,
      officials: json?.gameInfo?.officials ?? json?.officials ?? fallback?.gameInfo?.officials ?? [],
    },
    rosters:
      json?.rosters?.map((roster) => ({
        team: summaryTeam(roster.team),
        roster: (roster.roster ?? []).map(rosterPlayer),
      })) ??
      fallback?.rosters ??
      [],
  }
}

function summaryFromScoreboard(row) {
  const competitions = parseJson(row.competitions, [])
  const competition = competitions?.[0]
  const competitors = competition?.competitors ?? []
  const teams = competitors.map((c) => ({
    team: summaryTeam(c.team),
    statistics: (c.statistics ?? []).map(displayStat),
  }))

  return {
    boxscore: { teams },
    gameInfo: {
      venue: {
        fullName:
          competition?.venue?.fullName ??
          competition?.venue?.displayName ??
          parseJson(row.venue)?.displayName ??
          null,
        address: {
          city: competition?.venue?.address?.city ?? null,
        },
      },
      attendance: competition?.attendance ?? null,
      officials: competition?.officials ?? [],
    },
    rosters: [],
  }
}

if (dbPath && !existsSync(dbPath)) {
  throw new Error(`DuckDB database not found at ${dbPath}. Run npm run pipeline:run first.`)
}

const generatedAt = new Date().toISOString()

const matchRows = query(`
  WITH match_numbers AS (
    SELECT
      CAST(json_extract_string(value, '$.index') AS INTEGER) AS match_index,
      CAST(json_extract_string(value, '$.matchNumber') AS INTEGER) AS match_number
    FROM raw.reference_schedule_json,
      json_each(payload, '$.matches')
    WHERE filename = 'schedule.json'
  )
  SELECT
      m.match_index,
      m.match_key,
      mn.match_number,
      m.stage,
      m.round,
      m.group_name,
      m.team1,
      m.team2,
      m.kickoff,
      m.city,
      m.team1_espn_name,
      m.team2_espn_name,
      m.reference_score,
      m.reference_goals1,
      m.reference_goals2,
      m.espn_id,
      m.home_team,
      m.away_team,
      m.status_state,
      m.status_name,
      m.status_period,
      m.display_clock,
      m.team1_score,
      m.team2_score,
      m.team1_ht_score,
      m.team2_ht_score,
      m.competitions
  FROM marts.app_matches m
  LEFT JOIN match_numbers mn
    ON m.match_index = mn.match_index
  ORDER BY m.match_index
`)

let matchBettingByIndex = new Map()
try {
  const bettingRows = query(`
    SELECT
        match_index,
        source,
        market_type,
        outcome_rank,
        outcome,
        probability,
        bid,
        ask,
        last_price,
        volume,
        market_id,
        url
    FROM marts.app_match_betting
    ORDER BY match_index, market_type, outcome_rank
  `)
  for (const row of bettingRows) {
    const key = Number(row.match_index)
    const current = matchBettingByIndex.get(key) ?? { correctScore: [] }
    if (row.market_type === 'correct_score') {
      current.correctScore.push({ rank: Number(row.outcome_rank), ...marketRow(row) })
    }
    matchBettingByIndex.set(key, current)
  }
} catch {
  matchBettingByIndex = new Map()
}

try {
  const summaryRows = query(`
    SELECT
        match_index,
        source,
        team1_win_probability,
        draw_probability,
        team2_win_probability,
        expected_team1_goals,
        expected_team2_goals,
        over_2_5_probability,
        both_teams_score_probability,
        team1_clean_sheet_probability,
        team2_clean_sheet_probability,
        top_outcome,
        top_probability,
        market_total_probability,
        outcomes_count
    FROM marts.app_match_market_summary
    ORDER BY match_index
  `)
  for (const row of summaryRows) {
    const key = Number(row.match_index)
    const current = matchBettingByIndex.get(key) ?? { correctScore: [] }
    current.summary = matchMarketSummary(row)
    matchBettingByIndex.set(key, current)
  }
} catch {
  // Match market summaries are optional app enhancements.
}

let teamMarkets = {}
try {
  const rows = query(`
    SELECT
        team_name,
        source,
        market_type,
        label,
        probability,
        bid,
        ask,
        last_price,
        volume,
        market_id,
        question,
        url
    FROM marts.app_team_betting
    ORDER BY team_name, market_type, source
  `)
  for (const row of rows) {
    const team = row.team_name
    teamMarkets[team] ??= {}
    teamMarkets[team][row.market_type] ??= []
    teamMarkets[team][row.market_type].push(marketRow(row))
  }
} catch {
  teamMarkets = {}
}

let goldenBootMarkets = []
let continentMarkets = []
try {
  const rows = query(`
    SELECT
        category,
        source,
        rank,
        label,
        probability,
        bid,
        ask,
        last_price,
        volume,
        market_id,
        question,
        url
    FROM marts.app_market_insights
    ORDER BY category, rank
  `)
  goldenBootMarkets = rows
    .filter((row) => row.category === 'golden_boot')
    .map(rankedMarketRow)
  continentMarkets = rows
    .filter((row) => row.category === 'continent_winner')
    .map(rankedMarketRow)
} catch {
  goldenBootMarkets = []
  continentMarkets = []
}

const matches = matchRows.map((row) => {
  const matchScore = score(row)
  const state = liveState(row)
  const [goals1, goals2] = goals(row)
  const betting = matchBettingByIndex.get(Number(row.match_index))
  return {
    key: row.match_key,
    index: Number(row.match_index),
    ...(row.match_number == null ? {} : { matchNumber: Number(row.match_number) }),
    stage: row.stage,
    round: row.round,
    group: row.group_name,
    team1: row.team1,
    team2: row.team2,
    kickoff: row.kickoff,
    city: row.city,
    espnId: row.espn_id ?? null,
    liveState: state && state !== 'ft' ? state : undefined,
    live:
      state && state !== 'ft' && row.team1_score != null && row.team2_score != null
        ? { score: [Number(row.team1_score), Number(row.team2_score)], clock: row.display_clock }
        : undefined,
    score: state === 'ft' ? matchScore : parseJson(row.reference_score),
    goals1,
    goals2,
    ...(betting ? { betting } : {}),
  }
})

const schedulePayload = {
  generatedAt,
  source: `bruin:${dbPath ?? bruinConnection}:marts.app_matches`,
  matches,
  betting: {
    teamMarkets,
    goldenBoot: goldenBootMarkets,
    continents: continentMarkets,
  },
}
writeJson(schedulePath, schedulePayload)
writeJson(publicSchedulePath, schedulePayload)

const teamRows = query(`
  SELECT team_name, payload
  FROM marts.app_teams
  ORDER BY team_name
`)
const teams = Object.fromEntries(teamRows.map((row) => [row.team_name, parseJson(row.payload, {})]))
writeJson(teamsPath, teams)
writeJson(publicTeamsPath, teams)

let details = { generatedAt, source: `bruin:${dbPath ?? bruinConnection}:raw.espn_scoreboard`, summaries: {} }
try {
  const summaryRows = query(`
    WITH scoreboard AS (
      SELECT id, competitions, venue
      FROM raw.espn_scoreboard_window
      QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY date DESC) = 1
    )
    SELECT
      scoreboard.id,
      scoreboard.competitions,
      scoreboard.venue,
      match_summary.summary
    FROM scoreboard
    LEFT JOIN raw.espn_match_summary AS match_summary
      ON match_summary.event_id = scoreboard.id
    ORDER BY id
  `)
  const summaries = summaryRows.map((row) => {
    const fallback = summaryFromScoreboard(row)
    const json = parseJson(row.summary)
    return [row.id, json ? summaryFromEspnSummary(json, fallback) : fallback]
  })
  details = {
    ...details,
    source: `bruin:${dbPath ?? bruinConnection}:raw.espn_scoreboard + raw.espn_match_summary`,
    summaries: Object.fromEntries(summaries),
  }
} catch {
  // ESPN is an app enhancement; schedule/team exports remain valid if the raw
  // scoreboard has not been ingested yet.
}
writeJson(detailsPath, details)
writeJson(publicDetailsPath, details)

console.log(`Exported ${matches.length} matches to ${schedulePath}`)
console.log(`Exported ${matches.length} matches to ${publicSchedulePath}`)
console.log(`Exported ${teamRows.length} teams to ${teamsPath}`)
console.log(`Exported ${teamRows.length} teams to ${publicTeamsPath}`)
console.log(`Exported ${Object.keys(teamMarkets).length} team betting market groups`)
console.log(`Exported ${matchBettingByIndex.size} match betting market groups`)
console.log(`Exported ${goldenBootMarkets.length} Golden Boot market rows`)
console.log(`Exported ${continentMarkets.length} continent market rows`)
console.log(`Exported ${Object.keys(details.summaries).length} ESPN summaries to ${detailsPath}`)
console.log(`Exported ${Object.keys(details.summaries).length} ESPN summaries to ${publicDetailsPath}`)
