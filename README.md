# World Cup 2026 App

A recreated version of `worldcup-teams-stats`: a static React/Vite app for World
Cup 2026 groups, schedule, teams, bracket, scorers, and comparisons, with a
Bruin pipeline scaffold for API-backed ingestion.

## App

```bash
npm install
npm run dev
npm test
npm run build
```

The app runtime reads Bruin-generated JSON from `src/data/bruin/`:

- `schedule.json` - app-ready matches from Bruin marts.
- `teams.json` - team metadata from Bruin-ingested reference data.
- `details.json` - ESPN match summaries exported from Bruin-ingested ESPN rows.

The original reference JSON under `src/data/` remains only as a Bruin ingestion
input. The browser no longer fetches ESPN or openfootball directly.

## Bruin Pipeline

The Bruin project lives in `pipelines/worldcup_2026` and targets local DuckDB at
`data/worldcup2026.duckdb`.

```bash
cp .bruin.yml.example .bruin.yml
export API_FOOTBALL_API_KEY=...
export BALLDONTLIE_FIFA_API_KEY=...
export FOOTBALL_DATA_ORG_API_KEY=...

npm run pipeline:validate
npm run pipeline:run
npm run pipeline:export
```

The raw layer uses the requested ingestr soccer sources:

- ESPN scoreboard, teams, competitors, standings, and news
- API-Football
- BallDontLie FIFA
- football-data.org

See `pipelines/worldcup_2026/README.md` for the source/table map and the current
local tooling limitation around the unreleased soccer URI schemes.
