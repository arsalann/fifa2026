// Full test suite: pure-logic units (standings, scorers, formats, ESPN
// parsing/merging) plus a server-render smoke test of every route.
// Run with: npm test
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import schedule from '../src/data/bruin/schedule.json'
import { computeGroups, thirdPlaceRace, teamTournamentRecord } from '../src/lib/standings.js'
import { goldenBoot, tournamentTotals } from '../src/lib/scorers.js'
import { placeholderLabel, scoreline, dayKey } from '../src/lib/format.js'
import {
  canonName,
  parseScoreboard,
  applyEspn,
  parseSummary,
  parseLineups,
  bucketPosition,
} from '../src/lib/espn.js'
import {
  DataProvider,
  matchStatus,
  finalScore,
  isInPlay,
  nextRefreshDelay,
} from '../src/lib/data.jsx'
import App from '../src/App.jsx'
import {
  analyticsEnabled,
  normalizeRoute,
  track,
  trackPageview,
} from '../src/lib/analytics.js'

let fails = 0
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log(`ok   ${label}`)
  } else {
    fails++
    console.log(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
  }
}

// ---------- standings / scorers / format ----------
{
  const M = (t1, t2, g, ft, ht, goals1 = [], goals2 = []) => ({
    stage: 'group', group: g, team1: t1, team2: t2,
    score: ft ? { ft, ht } : null, goals1, goals2,
    kickoff: '2026-06-11T13:00:00-06:00',
  })
  const ms = [
    M('Mexico', 'South Africa', 'A', [2, 1], [1, 1],
      [{ name: 'Raúl Jiménez', minute: 30, penalty: true }, { name: 'Santiago Giménez', minute: 60 }],
      [{ name: 'Percy Tau', minute: 10 }]),
    M('South Korea', 'Czech Republic', 'A', [1, 1], [0, 0],
      [{ name: 'Son Heung-min', minute: 70 }], [{ name: 'Patrik Schick', minute: 80 }]),
    M('Mexico', 'South Korea', 'A', [0, 0], [0, 0]),
    M('Czech Republic', 'South Africa', 'A', [3, 0], [2, 0],
      [{ name: 'Patrik Schick', minute: 5 }, { name: 'Patrik Schick', minute: 25 },
       { name: 'OG Guy', minute: 50, owngoal: true }]),
  ]
  const g = computeGroups(ms)
  check('group order pts/gd', g.A.map((r) => r.team),
    ['Czech Republic', 'Mexico', 'South Korea', 'South Africa'])
  check('points', g.A.map((r) => r.pts), [4, 4, 2, 0])
  const boot = goldenBoot(ms)
  check('boot leader', [boot[0].name, boot[0].goals], ['Patrik Schick', 3])
  check('own goal excluded', boot.some((s) => s.name === 'OG Guy'), false)
  check('totals', tournamentTotals(ms), { played: 4, goals: 8 })
  check('record', teamTournamentRecord(ms, 'Mexico'), { mp: 2, w: 1, d: 1, l: 0, gf: 2, ga: 1 })
  // head-to-head tiebreak among fully tied pair
  const tied = [M('X', 'Y', 'Z', [1, 0]), M('Y', 'W2', 'Z', [2, 1]), M('X', 'W2', 'Z', [0, 1])]
  check('h2h tiebreak', computeGroups(tied).Z.map((r) => r.team), ['Y', 'W2', 'X'])
  check('label 1A', placeholderLabel('1A'), 'Winner Group A')
  check('label 3rd', placeholderLabel('3A/B/C/D/F'), 'Best 3rd (A/B/C/D/F)')
  check('label W74', placeholderLabel('W74'), 'Winner of Match 74')
  check('scoreline pens', scoreline({ ft: [2, 2], et: [3, 3], p: [4, 2] }), '3 – 3 (4–2 pens)')
  check('dayKey local', typeof dayKey('2026-06-11T13:00:00-06:00'), 'string')
}

// ---------- third place race ----------
{
  const fixtures = []
  const groups = 'ABCDEFGHIJKL'.split('')
  for (const grp of groups) {
    // 3 teams so each group has a 3rd place. Everywhere the 3rd-placed team
    // ends on 0 pts, except group A where a draw gives it 1 pt (and the
    // h2h-then-name tiebreak puts A3 third behind A2).
    fixtures.push(
      { stage: 'group', group: grp, team1: `${grp}1`, team2: `${grp}2`, kickoff: '2026-06-11T13:00:00Z', score: { ft: [1, 0] } },
      { stage: 'group', group: grp, team1: `${grp}2`, team2: `${grp}3`, kickoff: '2026-06-12T13:00:00Z', score: { ft: grp === 'A' ? [0, 0] : [1, 0] } },
      { stage: 'group', group: grp, team1: `${grp}1`, team2: `${grp}3`, kickoff: '2026-06-13T13:00:00Z', score: { ft: [1, 0] } },
    )
  }
  const race = thirdPlaceRace(computeGroups(fixtures))
  check('race has 12 teams', race.length, 12)
  check('race leader is A3 on pts', [race[0].team, race[0].pts], ['A3', 1])
}

// ---------- ESPN parsing / merging ----------
check('alias United States', canonName('United States'), 'USA')
check('alias Türkiye', canonName('Türkiye'), 'Turkey')
check('alias Korea Republic', canonName('Korea Republic'), 'South Korea')
check('alias Cabo Verde', canonName('Cabo Verde'), 'Cape Verde')
check("alias Côte d'Ivoire", canonName("Côte d'Ivoire"), 'Ivory Coast')
check('alias unknown', canonName('Narnia'), null)

{
  const matches = schedule.matches.map((m) => ({ ...m }))
  const sb = parseScoreboard({ events: [
    { // halftime, ESPN home/away flipped vs our team1/team2
      id: '731001', date: '2026-06-11T19:00Z',
      status: { type: { state: 'in', name: 'STATUS_HALFTIME' }, period: 1 },
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { id: '20', displayName: 'South Africa' }, score: '0' },
          { homeAway: 'away', team: { id: '21', displayName: 'Mexico' }, score: '1' },
        ],
        details: [{ scoringPlay: true, type: { text: 'Goal' }, clock: { displayValue: "32'" },
          team: { id: '21' }, athletesInvolved: [{ displayName: 'Raúl Jiménez' }] }],
      }],
    },
    { // 2nd half in play, NO linescores (the Korea–Czech regression):
      // HT must be reconstructed from goal minutes, stoppage counts as 45'
      id: '731002', date: '2026-06-13T16:00Z',
      status: { type: { state: 'in', name: 'STATUS_IN_PROGRESS' }, period: 2 },
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { id: '50', displayName: 'Brazil' }, score: '2' },
          { homeAway: 'away', team: { id: '51', displayName: 'Morocco' }, score: '1' },
        ],
        details: [
          { scoringPlay: true, type: { text: 'Goal' }, clock: { displayValue: "21'" }, team: { id: '50' }, athletesInvolved: [{ displayName: 'Vinícius Júnior' }] },
          { scoringPlay: true, type: { text: 'Goal' }, clock: { displayValue: "45'+3'" }, team: { id: '51' }, athletesInvolved: [{ displayName: 'Youssef En-Nesyri' }] },
          { scoringPlay: true, type: { text: 'Goal' }, clock: { displayValue: "58'" }, team: { id: '50' }, athletesInvolved: [{ displayName: 'Rodrygo' }] },
        ],
      }],
    },
    { // finished after ET + pens, with linescores
      id: '731003', date: '2026-06-12T02:00Z',
      status: { type: { state: 'post', name: 'STATUS_FINAL_PEN' }, period: 5 },
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { id: '30', displayName: 'Korea Republic' }, score: '2', shootoutScore: 4,
            linescores: [{ value: 0 }, { value: 1 }, { value: 1 }, { value: 0 }] },
          { homeAway: 'away', team: { id: '31', displayName: 'Czechia' }, score: '2', shootoutScore: 3,
            linescores: [{ value: 1 }, { value: 0 }, { value: 0 }, { value: 1 }] },
        ],
        details: [
          { scoringPlay: true, type: { text: 'Goal - Header' }, clock: { displayValue: "55'" }, team: { id: '30' }, athletesInvolved: [{ displayName: 'Son Heung-min' }] },
          { scoringPlay: true, type: { text: 'Own Goal' }, clock: { displayValue: "98'" }, team: { id: '30' }, athletesInvolved: [{ displayName: 'Some Defender' }] },
          { scoringPlay: true, type: { text: 'Goal' }, clock: { displayValue: "12'" }, team: { id: '31' }, athletesInvolved: [{ displayName: 'Patrik Schick' }] },
          { scoringPlay: true, type: { text: 'Penalty - Scored' }, clock: { displayValue: "105'+1'" }, team: { id: '31' }, athletesInvolved: [{ displayName: 'Patrik Schick' }] },
          { scoringPlay: true, type: { text: 'Shootout Penalty - Scored' }, clock: { displayValue: "120'" }, team: { id: '30' }, athletesInvolved: [{ displayName: 'Nope' }] },
        ],
      }],
    },
  ]})
  applyEspn(matches, sb)

  const mex = matches.find((m) => m.team1 === 'Mexico' && m.team2 === 'South Africa')
  check('HT score oriented to team1', mex.score, { ht: [1, 0] })
  check('HT status', matchStatus(mex, new Date('2026-06-11T20:00Z')), 'ht')
  check('goal credited to team1', mex.goals1?.[0]?.name, 'Raúl Jiménez')

  const bra = matches.find((m) => m.team1 === 'Brazil' && m.team2 === 'Morocco')
  check('2h derived HT (no linescores)', bra.score, { ht: [1, 1] })
  check('2h status', matchStatus(bra, new Date('2026-06-13T17:00Z')), '2h')

  const kor = matches.find((m) => m.team1 === 'South Korea' && m.team2 === 'Czech Republic')
  check('ET split 90/et/pens', [kor.score?.ft, kor.score?.et, kor.score?.p], [[1, 1], [2, 2], [4, 3]])
  check('shootout excluded from goals', kor.goals1?.map((g) => g.name), ['Son Heung-min', 'Some Defender'])
  check('finalScore prefers et', finalScore(kor), [2, 2])
  check('ft status', matchStatus(kor), 'ft')

  // knockout placeholder adoption + ET final derived without linescores
  const fin = matches.find((m) => m.stage === 'final')
  applyEspn(matches, parseScoreboard({ events: [{
    id: '99', date: fin.kickoff,
    status: { type: { state: 'post', name: 'STATUS_FINAL_AET' }, period: 4 },
    competitions: [{
      competitors: [
        { homeAway: 'home', team: { id: '60', displayName: 'Argentina' }, score: '2' },
        { homeAway: 'away', team: { id: '61', displayName: 'France' }, score: '1' },
      ],
      details: [
        { scoringPlay: true, type: { text: 'Goal' }, clock: { displayValue: "30'" }, team: { id: '60' }, athletesInvolved: [{ displayName: 'Lionel Messi' }] },
        { scoringPlay: true, type: { text: 'Goal' }, clock: { displayValue: "80'" }, team: { id: '61' }, athletesInvolved: [{ displayName: 'Kylian Mbappé' }] },
        { scoringPlay: true, type: { text: 'Goal' }, clock: { displayValue: "112'" }, team: { id: '60' }, athletesInvolved: [{ displayName: 'Lionel Messi' }] },
      ],
    }],
  }]}))
  check('final placeholders adopted', [fin.team1, fin.team2], ['Argentina', 'France'])
  check('final derived 90/et/ht', [fin.score?.ft, fin.score?.et, fin.score?.ht], [[1, 1], [2, 1], [1, 0]])

  // ---------- lineups ----------
  check('bucket GK', bucketPosition({ abbreviation: 'G' }), 'GK')
  check('bucket DEF', bucketPosition({ abbreviation: 'D' }), 'DEF')
  check('bucket MID', bucketPosition({ abbreviation: 'M' }), 'MID')
  check('bucket FWD', bucketPosition({ abbreviation: 'F' }), 'FWD')
  check('bucket by name winger', bucketPosition({ abbreviation: 'X', name: 'Left Winger' }), 'FWD')
  const lineups = parseLineups({
    rosters: [
      {
        team: { displayName: 'Argentina' },
        roster: [
          { starter: true, jersey: '10', captain: true, athlete: { displayName: 'Lionel Messi' }, position: { abbreviation: 'F' } },
          { starter: true, jersey: '23', athlete: { displayName: 'Emiliano Martínez' }, position: { abbreviation: 'G' } },
          { starter: true, jersey: '13', athlete: { displayName: 'Cristian Romero' }, position: { abbreviation: 'D' } },
          { starter: false, jersey: '9', athlete: { displayName: 'Julián Álvarez' }, position: { abbreviation: 'F' } },
          { starter: false, jersey: '2', athlete: { displayName: 'Some Sub' }, position: { abbreviation: 'D' } },
        ],
      },
      { team: { displayName: 'France' }, roster: [
        { starter: true, jersey: '10', athlete: { displayName: 'Kylian Mbappé' }, position: { abbreviation: 'F' } },
      ]},
    ],
  })
  check('lineup keyed by canonical team', Object.keys(lineups).sort(), ['Argentina', 'France'])
  check('starters count', lineups.Argentina.starters.length, 3)
  check('bench count', lineups.Argentina.bench.length, 2)
  check('captain flagged', lineups.Argentina.starters.find((p) => p.captain)?.name, 'Lionel Messi')
  check('starters sorted by number', lineups.Argentina.starters.map((p) => p.number), ['10', '13', '23'])
  check('bench sorted by number', lineups.Argentina.bench.map((p) => p.number), ['2', '9'])
  check('position grouped', lineups.Argentina.starters.find((p) => p.number === '23').group, 'GK')

  const facts = parseSummary({
    boxscore: { teams: [
      { team: { displayName: 'South Africa' }, statistics: [
        { name: 'possessionPct', label: 'Possession', displayValue: '41%' }] },
      { team: { displayName: 'Mexico' }, statistics: [
        { name: 'possessionPct', label: 'Possession', displayValue: '59%' }] },
    ]},
    gameInfo: { attendance: 87523, venue: { fullName: 'Estadio Azteca', address: { city: 'Mexico City' } } },
  }, mex)
  check('facts aligned to team1', [facts.teamA, facts.stats[0].a], ['Mexico', '59%'])
  check('facts attendance', facts.info[1], ['Attendance', '87,523'])
}

// ---------- live (in-play) updates ----------
{
  const matches = schedule.matches.map((m) => ({ ...m }))
  const live = parseScoreboard({
    events: [
      {
        // Mexico 1-0 South Africa, 32' of the first half (ESPN home/away flipped)
        id: 'L1', date: '2026-06-11T19:30Z',
        status: { type: { state: 'in', name: 'STATUS_FIRST_HALF' }, period: 1, displayClock: "32'" },
        competitions: [{
          competitors: [
            { homeAway: 'home', team: { id: '20', displayName: 'South Africa' }, score: '0' },
            { homeAway: 'away', team: { id: '21', displayName: 'Mexico' }, score: '1' },
          ],
          details: [{ scoringPlay: true, type: { text: 'Goal' }, clock: { displayValue: "32'" }, team: { id: '21' }, athletesInvolved: [{ displayName: 'Raúl Jiménez' }] }],
        }],
      },
    ],
  })
  applyEspn(matches, live)
  const mex = matches.find((m) => m.team1 === 'Mexico' && m.team2 === 'South Africa')
  check('live snapshot score (oriented)', mex.live?.score, [1, 0])
  check('live clock', mex.live?.clock, "32'")
  check('live state 1h', matchStatus(mex), '1h')
  check('isInPlay true', isInPlay(matchStatus(mex)), true)
  check('1st half does NOT set official ft', mex.score?.ft ?? null, null)
  check('live goal credited to team1', mex.goals1?.[0]?.name, 'Raúl Jiménez')
  // standings must ignore an in-progress match (no ft yet)
  const g = computeGroups(matches)
  check('live match not counted in standings', g.A.find((r) => r.team === 'Mexico').mp, 0)
  // golden boot DOES reflect live goals
  check('live goal in golden boot', goldenBoot(matches)[0]?.name, 'Raúl Jiménez')

  // adaptive polling: fast when live, gentle otherwise
  const idle = schedule.matches.map((m) => ({ ...m })) // untouched -> all upcoming/far
  const farFuture = new Date('2027-01-01T00:00:00Z')
  check('idle poll is gentle', nextRefreshDelay(idle, farFuture) >= 60000, true)
  check('live poll is fast', nextRefreshDelay(matches, new Date('2026-06-11T19:30Z')) <= 30000, true)
}

// ---------- SSR smoke: every route renders ----------
{
  globalThis.matchMedia = () => ({ matches: false })
  const routes = ['/', '/schedule', '/teams', '/team/brazil', '/team/curacao', '/team/nope',
    '/bracket', '/scorers', '/compare?a=brazil&b=argentina']
  for (const r of routes) {
    try {
      const html = renderToString(
        <MemoryRouter initialEntries={[r]}>
          <DataProvider><App /></DataProvider>
        </MemoryRouter>,
      )
      check(`route ${r} renders`, html.length > 700, true)
      if (r === '/') {
        const groups = [...html.matchAll(/Group <!-- -->([A-L])</g)].map((m) => m[1]).join('')
        check('all 12 groups render', groups, 'ABCDEFGHIJKL')
      }
    } catch (e) {
      fails++
      console.log(`FAIL route ${r}: ${e.message}`)
    }
  }
}

// ---------- analytics (env-gated, no-op when unconfigured) ----------
{
  check('analytics disabled without a key', analyticsEnabled(), false)
  check('normalizeRoute collapses team slugs', normalizeRoute('/team/brazil'), '/team/:slug')
  check('normalizeRoute keeps static routes', normalizeRoute('/schedule'), '/schedule')
  check('normalizeRoute defaults empty to /', normalizeRoute(''), '/')
  // calls must be safe no-ops when disabled (never throw, never load posthog)
  let threw = false
  try {
    track('test_event', { a: 1 })
    trackPageview('/team/brazil')
  } catch {
    threw = true
  }
  check('track/trackPageview are safe no-ops', threw, false)
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nall tests passed')
process.exit(fails ? 1 : 0)
