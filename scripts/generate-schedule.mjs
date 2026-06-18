// Regenerates src/data/schedule.json from the openfootball public dataset.
// Run with: npm run update-data
// The app also fetches this source live in the browser; the bundled copy is a
// reliability fallback so the site always renders even if the source is down.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

const res = await fetch(SOURCE)
if (!res.ok) {
  console.error(`Failed to fetch ${SOURCE}: ${res.status}`)
  process.exit(1)
}
const raw = await res.json()

// "13:00 UTC-6" + "2026-06-11" -> "2026-06-11T13:00:00-06:00"
function toIso(date, time) {
  const m = time.match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})(?::?(\d{2}))?$/)
  if (!m) throw new Error(`Unparseable time: ${time}`)
  const hh = m[1].padStart(2, '0')
  const offH = String(Math.abs(parseInt(m[3], 10))).padStart(2, '0')
  const sign = m[3].startsWith('-') ? '-' : '+'
  const offM = m[4] || '00'
  return `${date}T${hh}:${m[2]}:00${sign}${offH}:${offM}`
}

function stage(round) {
  if (round.startsWith('Matchday')) return 'group'
  if (round === 'Round of 32') return 'r32'
  if (round === 'Round of 16') return 'r16'
  if (round === 'Quarter-final') return 'qf'
  if (round === 'Semi-final') return 'sf'
  if (round === 'Match for third place') return 'third'
  if (round === 'Final') return 'final'
  return 'other'
}

const matches = raw.matches.map((m, i) => ({
  // date+ground is unique across all 104 matches; used to merge live scores
  key: `${m.date}|${m.ground}`,
  index: i,
  stage: stage(m.round),
  round: m.round,
  group: m.group ? m.group.replace('Group ', '') : null,
  team1: m.team1,
  team2: m.team2,
  kickoff: toIso(m.date, m.time),
  city: m.ground,
  score: m.score ?? null,
  goals1: m.goals1 ?? null,
  goals2: m.goals2 ?? null,
}))

// FIFA numbers knockout matches 73..104 chronologically within the bracket;
// W74/L101 refs in the source point at these numbers.
const knockout = matches
  .filter((m) => m.stage !== 'group')
  .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.index - b.index)
knockout.forEach((m, i) => {
  m.matchNumber = 73 + i
})

const out = {
  generatedAt: new Date().toISOString(),
  source: SOURCE,
  matches,
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'schedule.json'), JSON.stringify(out, null, 1))
console.log(`Wrote ${matches.length} matches to src/data/schedule.json`)
