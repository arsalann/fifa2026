# Handoff

## Goal

Move the World Cup 2026 app to a lean MotherDuck-backed data flow:

- Bruin writes the app data to MotherDuck database `fifa`.
- Bruin uses connection name `motherduck-fifa`.
- The app reads live schedule data from MotherDuck through a Netlify Function.
- Static JSON remains as a fallback.
- Unused non-ESPN provider assets are removed.

## Current State

- Workspace: `/Users/bear/conductor/workspaces/fifa2026/sun-valley`
- Branch: `arsalann/handoff-next-steps`
- Working tree is dirty with intended uncommitted changes.
- Local `.bruin.yml` has the real `motherduck-fifa` connection and token. It is ignored; do not commit secrets.
- `.bruin.yml.example` documents `motherduck-fifa` with `MOTHERDUCK_TOKEN`.
- Pipeline schedule is every minute: `schedule: "* * * * *"`.
- `npm run pipeline:refresh` has been run successfully against MotherDuck.
- MotherDuck now has app-facing data loaded:
  - `marts.app_matches`: 104 matches
  - `marts.app_teams`: 48 teams
  - `raw.espn_scoreboard_window`: 104 ESPN event rows
- Static fallback JSON was regenerated from MotherDuck-backed tables:
  - `src/data/bruin/schedule.json`
  - `src/data/bruin/details.json`
  - `public/data/bruin/schedule.json`
  - `public/data/bruin/details.json`
- Runtime app fetch order is:
  1. `/.netlify/functions/bruin-schedule`
  2. `/data/bruin/schedule.json`
  3. bundled `src/data/bruin/schedule.json`
- Local direct function test passed:
  - status `200`
  - source `motherduck:fifa:marts.app_matches`
  - 104 matches
- Browser-level local app test passed:
  - loaded built app
  - app requested `/.netlify/functions/bruin-schedule`
  - response came from `motherduck:fifa:marts.app_matches`
  - response had 104 matches

## Files In Flight

- `.bruin.yml.example`
- `.env.example`
- `.gitignore`
- `README.md`
- `netlify.toml`
- `package.json`
- `package-lock.json`
- `scripts/export-bruin-data.mjs`
- `src/lib/data.jsx`
- `netlify/functions/bruin-schedule.mjs`
- `pipelines/worldcup_2026/README.md`
- `pipelines/worldcup_2026/pipeline.yml`
- `pipelines/worldcup_2026/assets/marts/app_data_manifest.sql`
- `pipelines/worldcup_2026/assets/marts/app_matches.sql`
- `pipelines/worldcup_2026/assets/marts/app_teams.sql`
- `pipelines/worldcup_2026/assets/raw/reference_schedule_json.sql`
- `pipelines/worldcup_2026/assets/raw/reference_teams_json.sql`
- `pipelines/worldcup_2026/assets/raw/espn_scoreboard_window.sql`
- ESPN ingestr assets under `pipelines/worldcup_2026/assets/raw/`
- Regenerated Bruin JSON under `src/data/bruin/` and `public/data/bruin/`
- Deleted non-ESPN raw provider assets.
- Deleted `pipelines/worldcup_2026/assets/marts/provider_coverage.sql`.

## Changed

- Bruin pipeline now targets MotherDuck using `motherduck-fifa`.
- SQL assets now explicitly set `connection: motherduck-fifa`; this was required because they otherwise fell back to missing `duckdb-default`.
- Remaining ESPN ingestr assets use:
  - `connection: motherduck-fifa`
  - `destination: motherduck`
- Added `netlify/functions/bruin-schedule.mjs`.
  - Uses `MOTHERDUCK_TOKEN`.
  - Defaults database to `fifa`.
  - Reads `marts.app_matches`.
  - Returns the same schedule JSON shape the app already expects.
- Updated `src/lib/data.jsx` so the app tries the Netlify Function first and falls back to static JSON.
- Added `@duckdb/node-api` pinned exactly to `1.5.3-r.3`.
  - Exact pin matters because MotherDuck rejected DuckDB `1.5.4`.
- Updated `scripts/export-bruin-data.mjs`.
  - Defaults to `bruin query` against `motherduck-fifa`.
  - Still supports local DuckDB export through `WORLDCUP_DUCKDB_PATH`.
  - Now handles Bruin query output shaped as `columns` plus row arrays.
- Removed unused providers and assets:
  - API-Football
  - BallDontLie FIFA
  - football-data.org
- Removed `marts.provider_coverage`, which only covered the removed provider assets.
- Updated docs and examples for the lean ESPN plus MotherDuck path.

## Failed Attempts

- First `npm run pipeline:refresh` failed because SQL assets used `duckdb-default`; fixed by adding explicit `connection: motherduck-fifa` to the SQL asset metadata.
- First Netlify Function test failed because `@duckdb/node-api` installed DuckDB `1.5.4`, which MotherDuck rejected; fixed by pinning `@duckdb/node-api` to `1.5.3-r.3`.
- First static details export produced one `undefined` summary key because Bruin query JSON returned `columns` plus array rows; fixed by normalizing that output in `scripts/export-bruin-data.mjs`.
- In-app Browser control was not exposed in this session, so app verification used local server plus Playwright/Brave instead.

## Next Steps

1. Review the diff.

   ```bash
   git status --short
   git diff --stat
   ```

2. Commit the changes.

3. Push and deploy to Netlify.

4. In Netlify, confirm `MOTHERDUCK_TOKEN` is set.

5. After deploy, open:

   ```text
   https://<site>/.netlify/functions/bruin-schedule
   ```

   It should return JSON with:

   - `source: "motherduck:fifa:marts.app_matches"`
   - `matches.length: 104`

6. Open the app and confirm it renders normally.

7. If this is going to run in Bruin Cloud, add the same `motherduck-fifa` connection/token there and enable the every-minute schedule.

Last successful checks:

```bash
npm run pipeline:refresh
npm run pipeline:validate
npm test
npm run build
git diff --check
```
