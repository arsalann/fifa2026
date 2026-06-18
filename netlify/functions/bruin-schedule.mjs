import { DuckDBInstance } from '@duckdb/node-api'

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

function toMatch(row) {
  const matchScore = score(row)
  const state = liveState(row)
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
    goals1: parseJson(row.reference_goals1),
    goals2: parseJson(row.reference_goals2),
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
          reference_score,
          reference_goals1,
          reference_goals2,
          espn_id,
          status_state,
          status_name,
          status_period,
          display_clock,
          team1_score,
          team2_score,
          team1_ht_score,
          team2_ht_score
      FROM marts.app_matches
      ORDER BY match_index
    `)
    const rows = result.getRowObjects()
    return {
      generatedAt: new Date().toISOString(),
      source: `motherduck:${DB_NAME}:marts.app_matches`,
      matches: rows.map(toMatch),
    }
  } finally {
    conn.closeSync()
  }
}

export async function handler() {
  try {
    if (cachedPayload && Date.now() - cachedAt < CACHE_MS) {
      return json(200, cachedPayload)
    }
    cachedPayload = await loadPayload()
    cachedAt = Date.now()
    return json(200, cachedPayload)
  } catch (error) {
    return json(500, { error: error?.message ?? 'Unable to load Bruin data' })
  }
}
