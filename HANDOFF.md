# Handoff

## Goal

Recreate the World Cup 2026 teams/stats app as a Bruin data-ingestion demo.
The app should display Bruin-produced data, remove ads, show Bruin branding,
deploy cleanly to Netlify, and be positioned for a future near-live Bruin Cloud
architecture.

## Current State

- Work has been committed and merged to `main` via PR #2:
  - PR: https://github.com/arsalann/fifa2026/pull/2
  - Commit: `60356fd` (`Add Bruin-powered Netlify data refresh`)
  - Merge commit on `origin/main`: `401e7b3`
- Local workspace is on branch `arsalann/recreate-worldcup-stats-bruin`, clean,
  and tracking `origin/arsalann/recreate-worldcup-stats-bruin`.
- React/Vite app is implemented in `src/`.
- App runtime uses Bruin-generated JSON:
  - bundled fallback: `src/data/bruin/*.json`
  - deployed/browser-refreshable copies: `public/data/bruin/*.json`
- Netlify is configured with `netlify.toml`:
  - build command: `npm run build`
  - publish dir: `dist`
  - Node version: `20`
  - no-cache headers for `/data/bruin/*`
  - immutable cache headers for `/assets/*`
  - SPA fallback to `/index.html`
- Bruin CLI used locally: `v0.11.633`.
- Bruin pipeline lives at `pipelines/worldcup_2026/`.
- Latest generated app data contains:
  - 104 matches
  - 48 teams
  - 104 ESPN summaries
- ESPN full-window DuckDB asset now backfills all 104 tournament events:
  - `raw.espn_scoreboard_window`
- Validation passed before merge:
  - `bruin validate pipelines/worldcup_2026 --config-file .context/bruin.app.yml`
  - `bruin run pipelines/worldcup_2026 --selector +marts.app_data_manifest --config-file .context/bruin.app.yml`
  - `WORLDCUP_DUCKDB_PATH=data/worldcup2026.duckdb npm run pipeline:export`
  - `npm test`
  - `npm run build`
  - `git diff --check`
- Netlify deploy preview checks passed before merge.

## Files In Flight

- `netlify.toml`
- `package.json`
- `README.md`
- `pipelines/worldcup_2026/README.md`
- `pipelines/worldcup_2026/assets/raw/espn_scoreboard_window.sql`
- `pipelines/worldcup_2026/assets/marts/app_matches.sql`
- `pipelines/worldcup_2026/assets/marts/app_data_manifest.sql`
- `scripts/export-bruin-data.mjs`
- `src/App.jsx`
- `src/lib/data.jsx`
- `src/styles.css`
- `src/data/bruin/schedule.json`
- `src/data/bruin/teams.json`
- `src/data/bruin/details.json`
- `public/data/bruin/schedule.json`
- `public/data/bruin/teams.json`
- `public/data/bruin/details.json`
- `public/bruin-logo.svg`
- `tests/suite.test.jsx`

## Changed

- Recreated the upstream World Cup stats app in React/Vite.
- Added Bruin pipeline scaffold for:
  - ESPN
  - API-Football
  - BallDontLie FIFA
  - football-data.org
  - local reference schedule/team JSON ingestion into DuckDB
- Switched the app away from browser-side ESPN/openfootball fetching.
- Added Bruin-produced app exports:
  - `schedule.json`
  - `teams.json`
  - `details.json`
- Added public JSON exports under `public/data/bruin/` so Netlify can serve
  refreshable static data without rebuilding app code.
- Added `npm run pipeline:refresh` for `pipeline:run && pipeline:export`.
- Added a Bruin-powered header badge with `public/bruin-logo.svg`.
- Removed the ad slot and related ad config/CSS/tests.
- Fixed match details popup:
  - centered modal on desktop
  - bottom-sheet behavior retained on mobile
- Added ESPN full-window backfill:
  - `raw.espn_scoreboard_window` reads ESPN scoreboard range
    `20260611-20260719`
  - app marts now use this full-window table for scores/details
- Added ESPN aliases in the mart:
  - `Czech Republic` -> `Czechia`
  - `Bosnia & Herzegovina` -> `Bosnia-Herzegovina`
  - existing aliases include `DR Congo`, `USA`, `Turkey`
- Added Netlify deployment config.
- Updated tests so mock ESPN scenarios reset generated score state before
  applying mock feeds.

## Failed Attempts

- Initial standalone `ingestr v1.0.34` rejected documented soccer URI schemes:
  - `api-football://`
  - `balldontlie-fifa://`
  - `football-data://`
  - `espn://`
- Bruin generic connections could not be used for ingestr source URIs; Bruin
  panicked because generic connections do not implement the ingestr URI
  interface.
- Direct `bruin run marts.app_data_manifest` did not run upstream dependencies.
  Working command uses selector syntax:
  - `--selector +marts.app_data_manifest`
- Initial ESPN ingestr scoreboard asset only produced 5 current scoreboard rows,
  causing many past matches to show `Result pending`.
- Running old `raw.espn_scoreboard` and new DuckDB SQL asset together caused a
  DuckDB write-lock conflict. The app-data dependency path now uses
  `raw.espn_scoreboard_window` as the score source.
- ESPN timestamp strings like `2026-06-11T19:00Z` failed DuckDB timestamp
  casting in the first SQL version. The asset stores `date` as varchar.
- Generated Bruin data broke old ESPN mock tests because tests layered mocks on
  top of already-scored real schedule rows. Fixed with a clean schedule helper.
- GitHub connector failed to create the PR with 403, so `gh pr create` was used.
- Browser plugin/in-app browser was unavailable for visual inspection, so UI was
  verified through tests/build/HTTP smoke checks rather than screenshots.

## Next Steps

- If continuing development locally, either switch to `main` and pull:
  - `git checkout main`
  - `git pull origin main`
  or keep working on a new branch from `origin/main`.
- For Netlify static deploys, refresh data before deploy when needed:
  - `npm run pipeline:refresh`
  - commit regenerated `src/data/bruin/*` and `public/data/bruin/*`
  - push to trigger Netlify deploy
- Decide whether to keep the static-deploy model or move to near-live data.
- Proposed near-live architecture:
  - Bruin Cloud scheduled every minute
  - write to a cloud database/warehouse
  - expose a thin read API via Netlify Function or Edge Function
  - React app polls the API every 15-60 seconds during live matches
- Avoid having the browser read most cloud databases directly; credentials and
  CORS/auth make that unsafe. Use an API layer.
- Good cloud targets to evaluate:
  - Postgres/Supabase
  - MotherDuck
  - BigQuery
  - Snowflake
- Add richer marts if upstream data supports them:
  - goals
  - lineups
  - match facts
  - team/player tournament stats
- Expand beyond ESPN full-window data once the API-Football, BallDontLie FIFA,
  and football-data.org Bruin/ingestr connectors are confirmed executable in the
  target environment.
- Re-run core checks after future changes:
  - `bruin validate pipelines/worldcup_2026 --config-file .context/bruin.app.yml`
  - `bruin run pipelines/worldcup_2026 --selector +marts.app_data_manifest --config-file .context/bruin.app.yml`
  - `WORLDCUP_DUCKDB_PATH=data/worldcup2026.duckdb npm run pipeline:export`
  - `npm test`
  - `npm run build`
