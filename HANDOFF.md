# Handoff

## Goal

Recreate the World Cup 2026 teams/stats app and turn it into a Bruin data-ingestion demo. The app should display data produced by Bruin/ingestr into DuckDB, not fetch provider data directly from the browser. The ad slot should be removed.

## Current State

- React/Vite app is in place and running from `src/`.
- Bruin CLI is upgraded to `v0.11.633`.
- Bruin pipeline lives in `pipelines/worldcup_2026/`.
- App runtime imports generated Bruin JSON only:
  - `src/data/bruin/schedule.json`
  - `src/data/bruin/teams.json`
  - `src/data/bruin/details.json`
- Original reference files remain as Bruin ingestion inputs:
  - `src/data/schedule.json`
  - `src/data/teams.json`
- Bruin app-data run works with:
  - `bruin run pipelines/worldcup_2026 --selector +marts.app_data_manifest --config-file .context/bruin.app.yml`
- Export works with:
  - `WORLDCUP_DUCKDB_PATH=data/worldcup2026.duckdb npm run pipeline:export`
- Latest generated app data contains:
  - 104 matches
  - 48 teams
  - 5 ESPN scoreboard overlays/summaries
- Dev server was started at `http://127.0.0.1:5173/`.
- `npm test` passes.
- `npm run build` passes.

## Files In Flight

- `src/App.jsx`
- `src/lib/data.jsx`
- `src/lib/espn.js`
- `src/styles.css`
- `src/data/bruin/schedule.json`
- `src/data/bruin/teams.json`
- `src/data/bruin/details.json`
- `scripts/export-bruin-data.mjs`
- `pipelines/worldcup_2026/pipeline.yml`
- `pipelines/worldcup_2026/assets/raw/*.asset.yml`
- `pipelines/worldcup_2026/assets/raw/reference_schedule_json.sql`
- `pipelines/worldcup_2026/assets/raw/reference_teams_json.sql`
- `pipelines/worldcup_2026/assets/marts/app_matches.sql`
- `pipelines/worldcup_2026/assets/marts/app_teams.sql`
- `pipelines/worldcup_2026/assets/marts/app_data_manifest.sql`
- `pipelines/worldcup_2026/assets/marts/provider_coverage.sql`
- `.bruin.yml.example`
- `.env.example`
- `.gitignore`
- `vite.config.js`
- `tests/suite.test.jsx`
- `README.md`
- `pipelines/worldcup_2026/README.md`
- `CLAUDE.md`
- `package.json`

## Changed

- Copied/recreated the upstream World Cup stats app in this workspace.
- Added Bruin pipeline scaffolding and assets for:
  - ESPN
  - API-Football
  - BallDontLie FIFA
  - football-data.org
  - local reference schedule/team JSON ingestion into DuckDB
- Added ESPN raw assets:
  - `raw.espn_teams`
  - `raw.espn_scoreboard`
  - `raw.espn_competitors`
  - `raw.espn_standings`
  - `raw.espn_news`
- Added app-facing marts:
  - `marts.app_matches`
  - `marts.app_teams`
  - `marts.app_data_manifest`
- Changed `npm run pipeline:run` to run the Bruin selector `+marts.app_data_manifest`.
- Changed `scripts/export-bruin-data.mjs` to export schedule, teams, and ESPN details JSON from DuckDB.
- Changed app data imports from static `src/data/*.json` to generated `src/data/bruin/*.json`.
- Removed browser-side ESPN/openfootball fetching from `src/lib/data.jsx`.
- Changed match facts/lineups to read Bruin-exported details JSON instead of fetching ESPN summary from the browser.
- Removed the ad slot completely:
  - deleted `src/components/AdSlot.jsx`
  - removed `AdSlot` from `src/App.jsx`
  - removed ad CSS
  - removed AdSense `ads.txt` plugin from `vite.config.js`
  - removed ad env vars and tests

## Failed Attempts

- Initial standalone `ingestr` checks failed because `ingestr v1.0.34` rejected documented soccer URI schemes:
  - `api-football://`
  - `balldontlie-fifa://`
  - `football-data://`
  - `espn://`
- Bruin generic connections could not be used for ingestr source URIs; Bruin panicked because generic connections do not implement the ingestr URI interface.
- A direct `bruin run` of `marts.app_data_manifest` did not run upstream dependencies. The working command uses selector syntax: `--selector +marts.app_data_manifest`.
- Temporary Bruin config under `.context` initially wrote DuckDB relative to `.context`; later a config with an absolute DuckDB path was generated at `.context/bruin.app.yml`.
- The first ESPN mart export failed to orient `DR Congo` scores because ESPN calls the team `Congo DR`. Fixed by adding ESPN alias fields in `marts.app_matches`.
- Browser plugin/in-app browser automation was unavailable earlier (`agent.browsers.list()` returned no browsers), so frontend verification relied on route-render tests, build, and HTTP smoke checks.

## Next Steps

- Decide whether to commit generated `src/data/bruin/*.json` or generate them in CI before build.
- Add a checked-in non-secret `.bruin.yml` workflow or document that `.context/bruin.app.yml` is local-only and must be recreated from `.bruin.yml.example`.
- Expand Bruin ingestion beyond ESPN scoreboard once the provider connectors are confirmed executable through Bruin:
  - API-Football tables
  - BallDontLie FIFA tables
  - football-data.org tables
- Add richer marts for goals, lineups, and match facts if ESPN/other source raw tables expose enough structured fields.
- Consider removing or archiving old `scripts/generate-schedule.mjs` if the Bruin flow is now the only accepted data path.
- Re-run:
  - `bruin validate pipelines/worldcup_2026 --config-file .context/bruin.app.yml`
  - `bruin run pipelines/worldcup_2026 --selector +marts.app_data_manifest --config-file .context/bruin.app.yml`
  - `WORLDCUP_DUCKDB_PATH=data/worldcup2026.duckdb npm run pipeline:export`
  - `npm test`
  - `npm run build`
