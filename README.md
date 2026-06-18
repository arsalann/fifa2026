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

## Netlify

This repo is ready to deploy as a static Netlify site. `netlify.toml` sets:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `20`
- No-cache headers for `/data/bruin/*`
- SPA fallback to `index.html`

The deployed app uses the committed Bruin exports under `public/data/bruin/`.
Run `npm run pipeline:refresh` before deploying when you want to refresh DuckDB
and regenerate those JSON files.

The app runtime reads Bruin-generated JSON. `src/data/bruin/` is bundled as a
fallback, and `public/data/bruin/` is fetched on app load/refresh so a fresh
pipeline export can be picked up without changing browser code:

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
npm run pipeline:refresh
npm run dev
```

The raw layer uses the requested ingestr soccer sources:

- ESPN full-window scoreboard backfill plus latest ingestr scoreboard, teams,
  competitors, standings, and news
- API-Football
- BallDontLie FIFA
- football-data.org

See `pipelines/worldcup_2026/README.md` for the source/table map and the current
local tooling limitation around the unreleased soccer URI schemes.
