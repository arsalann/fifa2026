import { DuckDBInstance } from '@duckdb/node-api'
import { ensureBruinRun } from './bruin-cloud.mjs'

const DB_NAME = process.env.MOTHERDUCK_DATABASE ?? 'fifa'
const CACHE_MS = 15 * 1000
const DUCKDB_HOME = process.env.DUCKDB_HOME || '/tmp'

let cachedPayload = null
let cachedAt = 0
let instancePromise = null

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(body),
  }
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

function isoDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
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

function toMatch(row) {
  const matchScore = score(row)
  const state = liveState(row)
  const [goals1, goals2] = goals(row)
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
  }
}

async function getInstance() {
  if (!process.env.MOTHERDUCK_TOKEN) {
    throw new Error('MOTHERDUCK_TOKEN is not configured')
  }
  if (!instancePromise) {
    process.env.HOME ||= DUCKDB_HOME
    const token = encodeURIComponent(process.env.MOTHERDUCK_TOKEN)
    instancePromise = DuckDBInstance.create(`md:${DB_NAME}?motherduck_token=${token}`, {
      home_directory: DUCKDB_HOME,
      temp_directory: process.env.DUCKDB_TEMP_DIRECTORY ?? '/tmp',
    })
  }
  return instancePromise
}

async function loadPayload() {
  const instance = await getInstance()
  const conn = await instance.connect()
  try {
    const result = await conn.runAndReadAll(`
      WITH app_freshness AS (
        SELECT max(generated_at) AS app_data_generated_at
        FROM marts.app_live_manifest
      ),
      scoreboard_freshness AS (
        SELECT max(ingested_at) AS scoreboard_ingested_at
        FROM raw.espn_scoreboard_window
      ),
      match_numbers AS (
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
          m.competitions,
          app_data_generated_at,
          scoreboard_ingested_at
      FROM marts.app_matches m
      LEFT JOIN match_numbers mn
        ON m.match_index = mn.match_index
      CROSS JOIN app_freshness
      CROSS JOIN scoreboard_freshness
      ORDER BY m.match_index
    `)
    const rows = result.getRowObjects()
    const firstRow = rows[0] ?? {}
    return {
      generatedAt:
        isoDate(firstRow.app_data_generated_at) ??
        isoDate(firstRow.scoreboard_ingested_at) ??
        new Date().toISOString(),
      readAt: new Date().toISOString(),
      source: `motherduck:${DB_NAME}:marts.app_matches`,
      matches: rows.map(toMatch),
    }
  } finally {
    conn.closeSync()
  }
}

export async function handler() {
  let pipelineRun = null
  try {
    try {
      pipelineRun = await ensureBruinRun()
    } catch {
      pipelineRun = { checked: true, triggered: false, reason: 'cloud_error' }
    }
    if (cachedPayload && Date.now() - cachedAt < CACHE_MS) {
      return json(200, { ...cachedPayload, pipelineRun })
    }
    cachedPayload = await loadPayload()
    cachedAt = Date.now()
    return json(200, { ...cachedPayload, pipelineRun })
  } catch (error) {
    return json(500, { error: error?.message ?? 'Unable to load Bruin data' })
  }
}
