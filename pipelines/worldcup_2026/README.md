# World Cup 2026 Bruin Pipeline

This pipeline lands FIFA World Cup 2026 soccer data into local DuckDB and exports
an app-ready schedule overlay for the React app.

## Layout

- `assets/raw/`: `ingestr` assets for the requested soccer sources plus local
  reference JSON ingested through DuckDB.
- `assets/marts/`: DuckDB SQL assets that normalize Bruin-ingested data for the app.
- `data/worldcup2026.duckdb`: default local warehouse path.
- `src/data/bruin/schedule.json`: generated app match data.
- `src/data/bruin/teams.json`: generated team metadata.
- `src/data/bruin/details.json`: generated match-summary data.

## Sources

The raw layer follows the official ingestr soccer source docs:

- API-Football: `api-football://?api_key=<key>&league=1&season=2026`
- BallDontLie FIFA: `balldontlie-fifa://?api_key=<key>&season=2026`
- football-data.org: `football-data://?api_key=<token>&competition=WC&season=2026`
- ESPN: `espn://?sport=soccer&league=fifa.world&dates=20260610-20260721&limit=300`

The raw table assets include teams, stadiums/venues where available, group
standings, matches, players/rosters, lineups, and match events.

## Config

Copy `.bruin.yml.example` to `.bruin.yml` and set these environment variables:

```bash
export API_FOOTBALL_API_KEY=...
export BALLDONTLIE_FIFA_API_KEY=...
export FOOTBALL_DATA_ORG_API_KEY=...
```

Then validate, run the app-data selector, and export:

```bash
npm run pipeline:validate
npm run pipeline:run
npm run pipeline:export
```

`pipeline:run` executes the upstream assets needed for `marts.app_data_manifest`:
ESPN scoreboard ingestion, local reference JSON ingestion, and app-facing marts.
`pipeline:export` serializes those DuckDB marts/raw rows into `src/data/bruin/`.
The app imports only these generated files at runtime.

## Current Tooling Note

Bruin CLI `v0.11.633` recognizes and executes ESPN ingestr assets via its
embedded `ingestr` runner. The standalone `ingestr` binary installed as
`v1.0.34` still rejects the documented ESPN and soccer URI schemes, so run these
assets through `bruin run` instead of invoking the local `ingestr` binary
directly.
