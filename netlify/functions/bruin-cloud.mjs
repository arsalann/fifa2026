const DEFAULT_BASE_URL = 'https://cloud.getbruin.com'
const DEFAULT_PROJECT_ID = '01kvdhnz90my4p88y0b8fzbk0z'
const DEFAULT_PIPELINE = 'worldcup_2026'
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000

const ACTIVE_STATUSES = new Set(['running', 'queued', 'pending'])
const TERMINAL_STATUSES = new Set(['success', 'succeeded', 'failed', 'cancelled', 'canceled', 'skipped'])

let inFlight = null

function envNumber(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function config() {
  return {
    apiKey: process.env.BRUIN_CLOUD_API_KEY ?? '',
    baseUrl: process.env.BRUIN_CLOUD_BASE_URL ?? DEFAULT_BASE_URL,
    projectId: process.env.BRUIN_CLOUD_PROJECT_ID ?? DEFAULT_PROJECT_ID,
    pipeline: process.env.BRUIN_CLOUD_PIPELINE ?? DEFAULT_PIPELINE,
    cooldownMs: envNumber('BRUIN_TRIGGER_COOLDOWN_MS', DEFAULT_COOLDOWN_MS),
  }
}

function cleanBaseUrl(value) {
  return String(value).replace(/\/+$/, '')
}

function authHeaders(apiKey) {
  return {
    accept: 'application/json',
    authorization: `Bearer ${apiKey}`,
  }
}

export function parseBruinDate(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof value === 'object' && typeof value.date === 'string') {
    const suffix = value.timezone === 'Z' ? 'Z' : ''
    const parsed = Date.parse(`${value.date.replace(' ', 'T')}${suffix}`)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export function runTimestamp(run) {
  return (
    parseBruinDate(run?.start_date) ??
    parseBruinDate(run?.end_date) ??
    parseBruinDate(run?.data_interval_start) ??
    parseBruinDate(run?.data_interval_end)
  )
}

export function hasActiveRun(runs) {
  return runs.some((run) => {
    const status = String(run?.status ?? '').toLowerCase()
    return ACTIVE_STATUSES.has(status) || (status && !TERMINAL_STATUSES.has(status))
  })
}

export function hasRecentRun(runs, now = Date.now(), cooldownMs = DEFAULT_COOLDOWN_MS) {
  if (!cooldownMs) return false
  return runs.some((run) => {
    const timestamp = runTimestamp(run)
    return timestamp != null && now - timestamp >= 0 && now - timestamp < cooldownMs
  })
}

export function triggerWindow(now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()),
  )
  const end = new Date(start)
  end.setUTCHours(end.getUTCHours() + 1)
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  }
}

async function cloudFetch(path, options = {}, cfg = config()) {
  const response = await fetch(`${cleanBaseUrl(cfg.baseUrl)}${path}`, {
    ...options,
    headers: {
      ...authHeaders(cfg.apiKey),
      ...options.headers,
    },
  })

  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { message: text }
    }
  }
  if (!response.ok) {
    throw new Error(`Bruin Cloud API returned ${response.status}`)
  }
  return body
}

async function listRuns(cfg) {
  const params = new URLSearchParams({
    project: cfg.projectId,
    name: cfg.pipeline,
    limit: '10',
  })
  const runs = await cloudFetch(`/pipeline-runs?${params}`, {}, cfg)
  return Array.isArray(runs) ? runs : []
}

async function triggerRun(cfg) {
  const { startDate, endDate } = triggerWindow()
  return cloudFetch(
    '/trigger-pipeline-run',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project: cfg.projectId,
        pipeline: cfg.pipeline,
        start_date: startDate,
        end_date: endDate,
      }),
    },
    cfg,
  )
}

export async function ensureBruinRun() {
  const cfg = config()
  if (!cfg.apiKey) return { checked: false, skipped: 'missing_api_key' }

  if (inFlight) return inFlight

  inFlight = (async () => {
    const runs = await listRuns(cfg)
    if (hasActiveRun(runs)) return { checked: true, triggered: false, reason: 'active_run' }
    if (hasRecentRun(runs, Date.now(), cfg.cooldownMs)) {
      return { checked: true, triggered: false, reason: 'recent_run' }
    }
    await triggerRun(cfg)
    return { checked: true, triggered: true }
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}
