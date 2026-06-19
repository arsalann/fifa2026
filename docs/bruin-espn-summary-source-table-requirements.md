# ESPN Match Summary Source Table Requirements

## Goal

Add ESPN Site API `summary` support to Bruin's ESPN source so Bruin users can ingest one match-level summary row per event. For soccer, this endpoint contains lineups and starting XI data that are not available in the current Bruin ESPN source tables.

## Current Gap

Bruin ESPN ingestr currently exposes `scoreboard`, `teams`, `competitors`, `standings`, and `news`. The World Cup app can get event IDs, scores, status, competitors, venue, and some statistics from `scoreboard`, but starting lineups require:

```text
GET https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/summary?event={event_id}
```

Example:

```text
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=760414
```

The response includes `rosters[].roster[]` with `starter`, `jersey`, `athlete`, `position`, substitution flags, and player stats.

## Proposed Source Table

Add source table:

```text
summary
```

Recommended destination table shape:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `event_id` | string | yes | ESPN event ID. Primary key. |
| `sport` | string | yes | Connection sport, e.g. `soccer`. |
| `league` | string | yes | Connection league, e.g. `fifa.world`. |
| `season` | string/null | no | Connection season if supplied. |
| `date` | timestamp/null | no | `header.competitions[0].date` or scoreboard event date when available. |
| `name` | string/null | no | Match display name from `header`. |
| `short_name` | string/null | no | Match short name from `header`. |
| `header` | json | no | Full `header` object. |
| `boxscore` | json | no | Full `boxscore` object. |
| `game_info` | json | no | Full `gameInfo` object. |
| `rosters` | json | no | Full `rosters` array; this is the critical lineup field. |
| `leaders` | json | no | Full `leaders` object/array when present. |
| `key_events` | json | no | Full `keyEvents` array when present. |
| `commentary` | json | no | Full `commentary` array when present. |
| `standings` | json | no | Full `standings` object/array when present. |
| `news` | json | no | Full `news` object/array when present. |
| `raw_payload` | json | optional | Full response for forward compatibility. |
| `_ingestr_extracted_at` | timestamp | yes | Standard ingestion timestamp. |

If Bruin prefers the existing scoreboard-style pattern, one row with `id`, `uid`, and nested JSON columns is fine. The minimum useful contract is `event_id` plus `rosters`, `boxscore`, `game_info`, and `raw_payload`.

## Primary Key and Incremental Behavior

Primary key:

```text
event_id
```

Recommended incremental strategy:

```text
merge
```

Rationale:

- Pre-match summaries may exist before lineups are published.
- Soccer lineups usually appear about one hour before kickoff.
- The same event row should be refreshed as ESPN adds rosters, player stats, officials, attendance, commentary, and final box score data.

## Event ID Discovery

The `summary` table needs event IDs. Recommended behavior:

1. Use the configured ESPN connection's `sport`, `league`, `season`, `dates`, and `limit`.
2. Fetch the scoreboard endpoint for the active interval, same as the current `scoreboard` table.
3. Extract `events[].id`.
4. Fetch one summary endpoint per event ID.

For Bruin runs using `--interval-start` / `--interval-end`, map that window to the same ESPN `dates=YYYYMMDD[-YYYYMMDD]` query parameter used by `scoreboard`.

## Configuration

Existing connection should be enough:

```yaml
connections:
  espn:
    - name: "espn-worldcup"
      sport: "soccer"
      league: "fifa.world"
      dates: "20260611-20260719"
      limit: 300
```

Asset:

```yaml
name: raw.espn_match_summary
type: ingestr
connection: motherduck-fifa

parameters:
  source_connection: espn-worldcup
  source_table: summary
  destination: motherduck
```

## HTTP and Rate Behavior

ESPN Site API is public and keyless.

Recommended implementation details:

- Set a normal `User-Agent`.
- Use bounded concurrency, e.g. 4-8 requests.
- Per-request timeout: 20-30 seconds.
- Retry transient `429`, `500`, `502`, `503`, `504` with exponential backoff.
- Keep a failed row observable if possible, or surface failed event IDs clearly in logs.

## Expected Soccer Roster Shape

Important fields under `rosters`:

```json
{
  "team": {
    "id": "451",
    "displayName": "South Korea"
  },
  "roster": [
    {
      "starter": true,
      "jersey": "1",
      "athlete": {
        "id": "175921",
        "displayName": "Kim Seung-Gyu",
        "shortName": "K. Seung-Gyu"
      },
      "position": {
        "name": "Goalkeeper",
        "displayName": "Goalkeeper",
        "abbreviation": "G"
      },
      "subbedIn": false,
      "subbedOut": false,
      "formationPlace": "1"
    }
  ]
}
```

Consumer expectations:

- `rosters` is absent or empty before ESPN publishes lineups.
- Once published, each team normally has 26 roster rows and 11 `starter: true` rows.
- Soccer position abbreviations may be `G`, `D`, `M`, `F`, or other league-specific values.
- Captain data may be absent or represented inconsistently; preserve raw fields.

## Acceptance Criteria

1. `source_table: summary` runs for ESPN soccer `fifa.world`.
2. It produces one row per scoreboard event ID in the configured date window.
3. Row primary key is stable across reruns.
4. Reruns refresh rows when ESPN adds rosters or post-match data.
5. Nested response sections are preserved as JSON, especially `rosters`.
6. A World Cup date-window run for `20260611-20260719&limit=300` returns 104 summary rows.
7. At least completed matches with published ESPN lineups have `rosters` with 2 teams and 22 total starters.
8. Ingestion remains keyless and works through Bruin CLI without direct use of the standalone `ingestr` binary.

## Test Cases

Use known event:

```text
sport=soccer
league=fifa.world
event=760414
```

Expected:

- `event_id = "760414"`
- `rosters` contains South Korea and Czechia.
- Each team has 11 starters when ESPN has published lineups.
- `boxscore.teams` and `gameInfo.venue` are present.

Also test an upcoming event before lineups:

- Row exists.
- `rosters` may be empty/null.
- Later rerun updates same `event_id` row when rosters appear.

## Why This Matters

Apps and analytics workflows need confirmed lineups for:

- Starting XI display.
- Player availability and tactical previews.
- Post-match player stats.
- Match facts and venue/official/attendance context.

Without `summary`, consumers must fetch ESPN outside Bruin, which breaks the desired Bruin-owned ingestion and warehouse-first app data path.
