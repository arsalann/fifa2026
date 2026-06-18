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

function query(sql) {
  if (dbPath) {
    const out = execFileSync('duckdb', ['-readonly', dbPath, '-json', sql], { encoding: 'utf8' })
    return JSON.parse(out || '[]')
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
    { encoding: 'utf8' },
  )
  const parsed = JSON.parse(out || '[]')
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

function summaryFromScoreboard(row) {
  const competitions = parseJson(row.competitions, [])
  const competition = competitions?.[0]
  const competitors = competition?.competitors ?? []
  const teams = competitors.map((c) => ({
    team: {
      displayName: c.team?.displayName ?? c.team?.name,
      name: c.team?.name,
      id: c.team?.id,
    },
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
  SELECT
      match_index,
      match_key,
      stage,
      round,
      group_name,
      team1,
      team2,
      kickoff,
      city,
      team1_espn_name,
      team2_espn_name,
      reference_score,
      reference_goals1,
      reference_goals2,
      espn_id,
      home_team,
      away_team,
      status_state,
      status_name,
      status_period,
      display_clock,
      team1_score,
      team2_score,
      team1_ht_score,
      team2_ht_score,
      competitions
  FROM marts.app_matches
  ORDER BY match_index
`)

const matches = matchRows.map((row) => {
  const matchScore = score(row)
  const state = liveState(row)
  const [goals1, goals2] = goals(row)
  return {
    key: row.match_key,
    index: Number(row.match_index),
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
  }
})

const schedulePayload = {
  generatedAt,
  source: `bruin:${dbPath ?? bruinConnection}:marts.app_matches`,
  matches,
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
    SELECT id, competitions, venue
    FROM raw.espn_scoreboard_window
    QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY date DESC) = 1
    ORDER BY id
  `)
  details = {
    ...details,
    summaries: Object.fromEntries(summaryRows.map((row) => [row.id, summaryFromScoreboard(row)])),
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
console.log(`Exported ${Object.keys(details.summaries).length} ESPN summaries to ${detailsPath}`)
console.log(`Exported ${Object.keys(details.summaries).length} ESPN summaries to ${publicDetailsPath}`)
